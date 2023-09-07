/**
 * TO DO
 * Add ride sidebar or minimap with list/map of rides
 * Add minimap
 * Turf Simplify line to make them more smooth
 * Make everything a function so I can pass in each ride
 */

const params = new URLSearchParams(window.location.search);
const theme = !params.get("theme") ? "light" : params.get("theme");
const ride = !params.get("ride") ? "data/James_Gosling_Blue_Trail.gpx" : params.get("ride");
const style = !params.get("style")
  ? "mapbox://styles/reyemtm/ciufnr1q400912jmo87s45bed"
  : params.get("style");

const trackColor = "hsla(198deg, 35%, 35%, 1)"

console.log("pulling ride from", ride);
console.log("using the", theme, "theme");

const themes = {
  dark: {
    mainColor: "#121212",
    fontColor: "rgba(255,255,255,0.87)",
    trackColor: "#03dac5",
    chartColor: "rgba(3, 218, 197, 0.4)",
  },
  light: {
    mainColor: "#fff",
    fontColor: "hsla(198deg, 35%, 20%, 1)" || "rgba(255,255,255,0.87)",
    trackColor: trackColor || "rgba(178, 34, 34,0.8)",
    chartColor: trackColor.replace('1)', '0.5') || "rgba(178, 34, 34,0.4)",
  },
};

document.body.style.backgroundColor = themes[theme].mainColor;
document.body.style.background = themes[theme].mainColor;
document.body.style.color = themes[theme].fontColor;

let map, myLineChart;
const infoleft = document.getElementById("map-info-left");
const inforight = document.getElementById("map-info-right");

inforight.addEventListener("click", function () {
  const width = window.outerWidth;
  const height = window.outerHeight;
  html2canvas(document.querySelector("body"), {
    // width: width,
    // height: height
    backgroundColor: themes[theme].mainColor,
  }).then((canvas) => {
    // document.querySelector("#snapshot").appendChild(canvas);
    const imageUrl = canvas.toDataURL();
    const img = document.createElement("img");
    img.src = imageUrl;
    const snapshot = document.querySelector("#snapshot");
    if (snapshot.children[1]) {
      snapshot.children[1].src = imageUrl;
    } else {
      snapshot.appendChild(img);
    }
    window.location.hash = "#modal";
  });
});

fetch(ride)
  .then(function (response) {
    return response.text();
  })
  .then(function (gpx) {
    parseGPX(gpx);
  });

function initMap(geojson, smoothed, bounds, center) {
  console.log("initializing map");
  if (map) {
    map.remove();
  }
  mapboxgl.accessToken =
    "pk.eyJ1IjoicmV5ZW10bSIsImEiOiJjazYwdDJmaGYwN2FqM2VvNWNmZm5yZ2l4In0.KB9s_fCNYjbKhHTbPQpkNQ";
  map = new mapboxgl.Map({
    container: "map",
    //           style: {
    //             version: 8,
    //             name: "blank",
    //             sources: {
    //               none: {
    //                 type: "vector",
    //                 url: ""
    //               }
    //             },
    //             layers: [
    //               {
    //                 id: "background",
    //                 type: "background",
    //                 paint: {
    //                   "background-color": "transparent"
    //                 }
    //               }
    //             ]
    //           },
    style: style,
    // debug: 2,
    center: center.geometry.coordinates,
    zoom: 12,
    interactive: true,
    preserveDrawingBuffer: true,
  });
  
  // map.addControl(new mapboxgl.NavigationControl());

  /*End Blank Map*/

  map.on("load", function () {
    if (theme === "light") map.setPaintProperty("background", "background-color", "#fff");

    console.log("map loaded");

    // map.addSource("mapbox-dem", {
    //   type: "raster-dem",
    //   url: "mapbox://mapbox.mapbox-terrain-dem-v1",
    //   tileSize: 512,
    //   maxzoom: 14,
    // });
    // // add the DEM source as a terrain layer with exaggerated height
    // map.setTerrain({ source: "mapbox-dem", exaggeration: 1.5 });

    map.fitBounds(bounds, {
      padding: 120,
    });

    map.addSource("tracksource", {
      type: "geojson",
      data: geojson,
      generateId: true,
    });

    map.addLayer({
      id: "track",
      type: "line",
      source: "tracksource",
      paint: {
        "line-color": themes[theme].trackColor,
        "line-width": 4,
      },
    });

    const trackPoints = {
      type: "FeatureCollection",
      features: [],
    };

    for (let i = 0; i < geojson.features[0].geometry.coordinates.length; i++) {
      const f = geojson.features[0].geometry.coordinates[i];
      trackPoints.features.push(turf.point(f));
    }

    turf.explode(geojson);
    // console.log(trackPoints)
    map.addSource("track-points-source", {
      type: "geojson",
      data: trackPoints,
      generateId: true,
    });

    map.addLayer({
      id: "track-points",
      type: "circle",
      source: "track-points-source",
      paint: {
        "circle-color": "transparent",
        "circle-radius": 10,
      },
    });

    const points = {
      type: "FeatureCollection",
      features: [],
    };
    map.addSource("chart-point-source", {
      type: "geojson",
      data: points,
    });

    map.addLayer({
      id: "chart-point",
      type: "circle",
      source: "chart-point-source",
      paint: {
        "circle-color": themes[theme].trackColor,
        "circle-stroke-color": "rgba(255,255,255,0.6)",
        "circle-stroke-width": 4,
        "circle-radius": 6,
        "circle-blur": 0.1,
      },
    });

    initMapEventListeners(map);
  });
}

function initChart(div, geojson, bezier) {
  if (myLineChart) {
    myLineChart.destroy();
  }
  const data = [];
  geojson.features[0].geometry.coordinates.map(function (c) {
    data.push(c[2]);
  });

  const minElev = Math.min(...data);
  const maxElev = Math.max(...data);
  const range = maxElev - minElev;

  const timeStart = geojson.features[0].properties.coordTimes[0];
  const timeEnd = geojson.features[0].properties.coordTimes[geojson.features[0].geometry.coordinates.length - 1];
  const seconds = Math.floor(new Date(timeEnd).getTime()) - Math.floor(new Date(timeStart));
  console.log(new Date(timeEnd).getTime())
  const miles = turf.length(geojson.features[0], { units: "miles" });
  const minutes = seconds / 3600000 * 60
  console.log(miles, minutes);
  //pace = minutes / miles
  const pace = (minutes / miles).toFixed(2);
  //convert pace to minutes and seconds
  const paceMinutes = Math.floor(pace);
  const paceSeconds = Math.floor((pace - paceMinutes) * 60);
  const paceString = paceMinutes + ":" + paceSeconds;
  infoleft.innerHTML = "PACE " + paceString + " MI<br>ELEV RANGE " + minElev + "'";

  const labelsArray = [];
  for (let n = 0; n < data.length; n++) {
    labelsArray.push(n);
  }
  const gpxchart = document.getElementById(div);
  // gpxchart.onclick = function(evt) {

  // }
  myLineChart = new Chart(gpxchart, {
    type: "line",
    data: {
      labels: labelsArray,
      datasets: [
        {
          label: " GPS Track",
          backgroundColor: themes[theme].chartColor,
          backgroundOpacity: 0.5,
          borderColor: themes[theme].trackColor,
          borderWidth: 2,
          pointRadius: 0,
          pointHitRadius: 4,
          data: data,
        },
      ],
    },
    options: {
      onHover: function (e) {
        const point = myLineChart.getElementAtEvent(e);
        // console.log(point)
        if (point.length > 0) {
          const index = point[0]["_index"];
          // console.log(index)
          const trackpoint = geojson.features[0].geometry.coordinates[index];
          console.log(trackpoint);

          /* show elevation and track time */
          // const elev = trackpoint[2];
          if (geojson.features[0].properties.coordTimes) {
            const timestart = geojson.features[0].properties.coordTimes[0];
            const timenow = geojson.features[0].properties.coordTimes[index];
            // console.log(timenow);
            const seconds =
              Math.floor(new Date(timenow).getTime()) - Math.floor(new Date(timestart));
            const minutes = moment.utc(seconds).format("HH:mm:ss");
            // console.log(minutes);
            infoleft.innerHTML = "Time " + minutes + "<br> ELEV " + trackpoint[2] + "'";
          } else {
            infoleft.innerHTML = "Time 00:0000<br> ELEV " + trackpoint[2] + "'";
          }

          /* show point on map line */
          map.getSource("chart-point-source").setData(turf.point(trackpoint));
          // console.log(myLineChart.getDatasetMeta(2))
        }
      },
      tooltips: {
        enabled: false,
        mode: "nearest",
        intersect: true,
        position: "nearest",
        titleFontColor: "transparent",
        titleMarginBottom: -10,
        bodyFontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, "Open Sans", "Helvetica Neue", sans-serif',
      },
      legend: {
        display: false,
      },
      scales: {
        xAxes: [
          {
            display: false,
          },
        ],
        yAxes: [
          {
            fontFamily: "Segoe UI",
            display: false,
            ticks: {
              // Include a dollar sign in the ticks
              callback: function (value, index, values) {
                return value + "ft";
              },
            },
          },
        ],
      },
    },
  });
}

function initMapEventListeners(e) {
  const $map = e;
  $map.on("zoomend", (e) => {
    // zoom.innerHTML = 'zoom: ' + (map.getZoom()).toFixed(2);
    if (map.getZoom() < 14) {
      // zoom.style.backgroundColor = 'red'
    } else {
      // zoom.style.backgroundColor = 'transparent'
    }
  });
  // $map.on("click", "track", e => console.log(map.queryRenderedFeatures(e.point)));
  $map.on("mousemove", (e) => {
    const features = map.queryRenderedFeatures(e.point, { layers: ["track-points"] });
    if (features.length > 0) {
      // console.log("move")
      const featureIndex = features[0];
      // console.log(featureIndex)
      const meta = myLineChart.getDatasetMeta(0),
        rect = myLineChart.canvas.getBoundingClientRect(),
        point = meta.data[featureIndex.id].getCenterPoint(),
        evt = new MouseEvent("mousemove", {
          clientX: rect.left + point.x,
          clientY: rect.top + point.y,
        });
      // console.log(evt)
      node = myLineChart.canvas;
      node.dispatchEvent(evt);
    }
    map.getCanvas().style.cursor = "pointer";
  });
  $map.on("mouseleave", "track", (e) => {
    map.getCanvas().style.cursor = "";
  });
}
/* trigger click event on chart https://stackoverflow.com/questions/53764367/how-to-trigger-hover-programmatically-in-chartjs*/

function parseGPX(gpx) {
  const parser = new DOMParser();
  const xml = parser.parseFromString(gpx, "text/xml");
  const geojson = toGeoJSON.gpx(xml);
  // console.log(geojson);
  if (
    geojson.features[0].geometry.coordinates[0] &&
    geojson.features[0].geometry.coordinates[0].length < 3
  ) {
    alert("The GPX file does not appear to contain elevation data.");
    return;
  }
  const length = turf.length(geojson.features[0], { units: "miles" });

  if (geojson.features[0].properties.coordTimes) {
    const coords = geojson.features[0].properties.coordTimes;
    const l = coords.length - 1;
    const timestart = coords[0];
    const timeend = coords[l];
    const totalseconds = Math.floor(new Date(timeend).getTime()) - Math.floor(new Date(timestart));
    const totaltime = moment.utc(totalseconds).format("HH:mm:ss");
    // inforight.innerHTML = "TOTAL TIME " + totaltime + "<br>&nbsp;";
    inforight.innerHTML = "DURATION " + totaltime + "<br>Distance " + length.toFixed(2) + " mi";
  } else {
    inforight.innerHTML = "Missing Timestamps<br>Distance " + length.toFixed(2) + " mi";
  }

  // const bezier = turf.bezierSpline(geojson.features[0], {
  //   sharpness: 0.8
  // });
  // console.log(bezier);
  const bbox = turf.bbox(geojson);
  const bboxPoly = turf.bboxPolygon(bbox);
  const center = turf.center(bboxPoly);
  const bufferDist = length * 0.03;
  const buffer = turf.buffer(bboxPoly, bufferDist, { units: "miles" });
  const newbbox = turf.bbox(buffer);
  initMap(geojson, geojson, newbbox, center);
  initChart("chart", geojson, geojson);
}

function onFileDrop(e) {
  // Handle the file drop event
  e.preventDefault();

  // Get the dropped files
  const files = e.dataTransfer.files;

  // Check if any files were dropped
  if (files.length > 0) {
    // Assuming only one file is dropped, you can loop through files if needed
    const file = files[0];

    // Read the file content
    const reader = new FileReader();

    reader.onload = function (event) {
      // Display the file content
      const fileData = event.target.result;
      // console.log(fileData);
      parseGPX(fileData);
    };

    // Start reading the file
    reader.readAsText(file);
  }
}

const fileDrop = document.getElementById("map");
fileDrop.addEventListener("dragover", (e) => e.preventDefault());
fileDrop.addEventListener("drop", onFileDrop);
