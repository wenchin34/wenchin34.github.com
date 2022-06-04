/*
Code: opendata/index.html
Version: 2.5.2  @2022/04/18
Revision: 
Author: Wenchin Hsieh @Goomo.Net Studio, wenchin@goomo.net
*/

// 【參數設定】
var paceThreshold = 0.0005 // km 單位（預設 0.5 公尺）。偵測 GPS 比起前次，相距小於 0.5 公尺時，視為靜止狀態。
var gpsInterval = 500; // 250;
var aniInterval = 500; // 200;
var startInterval = 1000;
var carRefresh = 20;
// TDE @precious
var url_rasterMap = 'https://omt.goomo.net/styles/klokantech-basic/{z}/{x}/{y}.png';
//var url_rasterMap = 'https://omt.goomo.net/styles/positron/{z}/{x}/{y}.png';


// Get GeoLocation
var toGetGeo = 0;
var defaultPosition = [121.4472246, 25.0662844];
var currPosition = defaultPosition;
var nextPosition;
var justStart = false;

var posCounter = 0;
var supportGeo = true;

const htmlMsg = document.querySelector('#txtLocation');

// check if the Geolocation API is supported
if (!navigator.geolocation) { // 非 boolean, 無效判斷, FIXME !
    supportGeo = false;
    htmlMsg.classList.add('error');
    htmlMsg.textContent = `您的瀏覽器不支持地理定位`;
} else {
    setTimeout(getGeo, 10); // Wait for the Map to be ready. (10 ms)
}


// handle click event
document.querySelector('#btnStartGeo').addEventListener('click', StartGeo);
document.querySelector('#btnStopGeo').addEventListener('click', StopGeo);


// 【副程式】

function StartGeo() {
    toGetGeo = 1;
    justStart = true;
    getGeo();
}


function StopGeo() {
    toGetGeo = -1;
}


function getGeo() {
    if (supportGeo)
        if (toGetGeo != -1) {
            var options = {
                enableHighAccuracy: true,
                timeout: 2000,
                maximumAge: 0
            };

            posCounter++;
            navigator.geolocation.getCurrentPosition(onSuccess, onError, options);
        }
}


// handle error case
function onError(err) {
    console.warn('ERROR(' + err.code + '): ' + err.message);
    htmlMsg.classList.add('error');
    htmlMsg.textContent = `讀取座標失敗!`;

    if (toGetGeo == 1)
        setTimeout(getGeo, gpsInterval);
}


// handle success case
function onSuccess(position) {
    var coord = position.coords;
    var lon = coord.longitude;
    var lat = coord.latitude;
    //var acc = coord.accuracy;

    var msg = `${posCounter}: (${lon.toFixed(5)}, ${lat.toFixed(5)})`;
    //console.log(msg);
    htmlMsg.classList.add('success');
    htmlMsg.textContent = msg;

    var nextPosition = [lon, lat];
    var newCenter = ol.proj.fromLonLat(nextPosition);
    carGeometry.setCoordinates(newCenter);

    if (toGetGeo == 0) {
        currPosition = nextPosition;
        myView.setCenter(newCenter);
    } else if (toGetGeo == 1) {
        var viewCenter = myView.getCenter();
        var lenPace = distanceMarkers(lon, lat, currPosition[0], currPosition[1]);
        var sameGPS = (lenPace < paceThreshold);
        var sameCenter = (viewCenter[0] == newCenter[0] && viewCenter[1] == newCenter[1]);

        if (sameGPS) {
            // 設為 無指向性 的圓形圖示
            carFeature.setStyle([car_bord_style, car_style]);
        } else {
            // 設為 指向性 的圓錐形圖示
            var radians = Math.atan2(lon - currPosition[0], lat - currPosition[1]);  // 計算移動方向
            arrow_shape.setRotation(radians);
            carFeature.setStyle([car_bord_style, arrow_style, car_style]);
        }

        if (sameGPS && sameCenter) { // Same GPS-Location & Same ViewCenter
            setTimeout(getGeo, gpsInterval);
        } else {                     // Different GPS-Location or Different ViewCenter
            currPosition = nextPosition;
            var iDuration = aniInterval;

            if (justStart) {         // 若為第一次取位，改以慢速動畫方式實現地圖更新
                iDuration = startInterval;
                justStart = false;
            }

            if (!myView.getInteracting()) { // Map元件「並非」處於與使用者互動的當下
                var iTimeout = (sameGPS ? 0 : carRefresh);

                // 在 (iTimeout) 毫秒後，以動畫方式實現地圖更新
                setTimeout(() => {
                    myView.animate(
                        {
                            center: newCenter,
                            duration: iDuration,
                            //zoom: 13,
                        }
                    )
                }, iTimeout);

                // 在 (iDuration + carRefresh + 10) 毫秒後，重新擷取 GPS 座標
                setTimeout(getGeo, iDuration + carRefresh + 10);
            } else { // Map元件「正在」處於與使用者互動的當下
                // 在 (gpsInterval) 毫秒後，重新擷取 GPS 座標
                setTimeout(getGeo, gpsInterval);
            }
        }
    }
}


function distanceMarkers(lon1, lat1, lon2, lat2) {
    var R = 6371; // km (change this constant to get miles)
    var dLat = (lat2 - lat1) * Math.PI / 180;
    var dLon = (lon2 - lon1) * Math.PI / 180;
    var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    var d = R * c;
    /*
    if (d>1) 
      return Math.round(d*100)/100.0+" km";
    else if (d<=1)
      return Math.round(d*1000)+" m";
    */
    return d;
}



// System Configuration

// 【地圖準備】

var rasterMap = new ol.layer.Tile({
    //source: new ol.source.OSM({ url: url_rasterMap }),
    //source: new ol.source.OSM(),
    //source: new ol.source.Stamen({ layer: 'toner' }),
    source: new ol.source.Stamen({ layer: 'terrain' }),
});

// Style for SpeedTrap
var trap_bord_style = new ol.style.Style({
    image: new ol.style.Circle({
        radius: 12,
        stroke: new ol.style.Stroke({ color: '#FFF', width: 5 }),
    }),
});

var trap_styles = [];
var iColors = ['#FDD', '#FCC', '#FBB', '#FAA', '#F88', '#F66', '#F33', '#F00', '#E00', '#D00', '#C00', '#B00', '#A00', '#900'];

for (var i = 0; i <= 13; i++) {
    var iStyle = new ol.style.Style({
        image: new ol.style.Circle({
            radius: 12,
            fill: new ol.style.Fill({ color: 'rgba(255, 238, 238, 0.9)' }),
            stroke: new ol.style.Stroke({ color: iColors[i], width: 3 }),
        }),
        text: new ol.style.Text({
            text: (i * 10).toString(),
            offsetY: 1,
            scale: 1.2,
            stroke: new ol.style.Stroke({ color: 'white', width: 1 }),
        }),
    });
    trap_styles.push([trap_bord_style, iStyle]);
}


// Features for SpeedTrap: n Points
var trapFeatures = [];

for (var i = 0; i < speedtrap.length; i++) {
    var ispeed = speedtrap[i][2];
    var ifeature = new ol.Feature({
        geometry: new ol.geom.Point(ol.proj.fromLonLat([speedtrap[i][0], speedtrap[i][1]])),
        speedLimit: ispeed,
        address: speedtrap[i][3],
        direct: speedtrap[i][4],
    });

    ifeature.setStyle(trap_styles[(ispeed / 10) | 0]);
    trapFeatures.push(ifeature);
}


var trapLayer = new ol.layer.Vector({
    source: new ol.source.Vector({
        features: trapFeatures,
    }),
});


// Features for Car
var carGeometry = new ol.geom.Point(ol.proj.fromLonLat(currPosition));

var carFeature = new ol.Feature({
    geometry: carGeometry,
});

var car_style = new ol.style.Style({
    image: new ol.style.Circle({
        radius: 10,
        fill: new ol.style.Fill({ color: '#FF0' }),
        stroke: new ol.style.Stroke({ color: '#F84', width: 2 }),
    }),
});

var car_bord_style = new ol.style.Style({
    image: new ol.style.Circle({
        radius: 12,
        fill: new ol.style.Fill({ color: 'white' }),
    }),
});

var arrow_shape = new ol.style.RegularShape({
    points: 3,
    radius: 10,
    rotation: Math.PI / 4,
    rotateWithView: true,
    displacement: [0, 12],
    fill: new ol.style.Fill({ color: '#F84' }),
    stroke: new ol.style.Stroke({ color: 'white', width: 1 }),
});

var arrow_style = new ol.style.Style({
    image: arrow_shape,
});

carFeature.setStyle([car_bord_style, car_style]);

var carLayer = new ol.layer.Vector({
    source: new ol.source.Vector({
        features: [carFeature],
    }),
});


// Define View & Map
var myView = new ol.View({
    center: ol.proj.fromLonLat(currPosition),
    minZoom: 8, // 8, 1
    maxZoom: 18, // 15.99, 16, 19 // Zoom 16 (含)以上，VectorTile 會失效
    zoom: 16, // 13, 16
})


var myMap = new ol.Map({
    target: 'map',
    layers: [
        rasterMap,
        trapLayer,
        carLayer,
    ],
    view: myView,
});


// Define ScaleLine
var myscale = new ol.control.ScaleLine({
    units: 'metric',
    bar: true,
    steps: 4,
    text: false,
    minWidth: 140,
});

myMap.addControl(myscale);

var myzoomslider = new ol.control.ZoomSlider();
myMap.addControl(myzoomslider);

var currzoom = myView.getZoom();

//myMap.on('pointermove', handle_pointermove);
myMap.on('click', handle_pointermove);

function handle_pointermove(event) {
    var features = myMap.getFeaturesAtPixel(event.pixel);
    if (features.length > 0) {
        var properties = features[0].getProperties();
        if (properties["address"] !== undefined) {
            var msg = `${properties["speedLimit"]}:${properties["address"]}-${properties["direct"]}`;
            htmlMsg.classList.add('click');
            htmlMsg.textContent = msg;
        }
    }
}



// 【主程式】
//$(document).ready(function () {});
