// Specifying access tokens
mapboxgl.accessToken = "pk.eyJ1IjoiaXBpc3Jlc2VhcmNoIiwiYSI6IklBazVQTWcifQ.K13FKWN_xlKPJFj9XjkmbQ";

// Define constants
var styleMapbox = 'mapbox://styles/mapbox/streets-v9';
var styleBing = 
    {
        "version": 8,
        "sources": {
            "bing-source": {
                "type": "raster",
                "tiles": ["http://ecn.t0.tiles.virtualearth.net/tiles/h{quadkey}.jpeg?g=6412"],
                "tileSize": 256
            }
        },
        "layers": [{
            "id": "bing-layer",
            "type": "raster",
            "source": "bing-source",
            "attribution": "© 2018 Microsoft Corporation © 2018 Digital Globe © CNES (2018) Distribution Airbus DS © 2018 HERE" // Not showing?
        }]
    }
var mapCenter = [29.96, -20.3];
var mapZoom = 9;
var minesNumb;
var showAbandonned = false;

// Create map and ui and
var map = new mapboxgl.Map({
    container: 'map', // container id
    style: styleBing,   
    center: mapCenter, // starting position [lng, lat]
    zoom: mapZoom // starting zoom
});

// Set url
var url = 'http://ipis.annexmap.net/api/data/zwe_dev/all'; // ./data/zwe_mines_2019_runde_zela.geojson

// Replace 'null' with null (addSource seems to handle null's badly)
function correctNull(object) {
  for (var key in object) {
    if (object[key] == "null") {
      object[key] = null;
    }
  }
  return object
}

// Disable map rotation using right click + drag
map.dragRotate.disable();

// Disable map rotation using touch rotation gesture
map.touchZoomRotate.disableRotation();

// What to do when map is loaded
map.on('style.load', function () { // Used 'style.load' instead of 'load' such that this also occures when style is switched.
    map.addSource('mines', { type: 'geojson', data: url });
    map.addLayer({
            "id": "mines",
            "type": "circle",
            "source": "mines",
            "paint": {
                "circle-radius": [
                    "interpolate", ["linear"], ["coalesce", ["to-number", ["get", "workers_numb"]], 1],
                    1, 3.5,
                    50, 7,
                    500, 9
                ],
                "circle-color": [
                    "case", 
                    ["==", ["get", "mineral1_name"], "Gold"], "#DAA520", 
                    ["==", ["get", "mineral1_name"], "Chrome"], "#61B8E5", 
                  	["==", ["get", "mineral1_name"], "Other"], "#363636", 
                    "grey"
                ],
                "circle-stroke-color": "white",
                "circle-stroke-width": 0.5
            }
        });

    setFilter();
})

 map.on('load', function () {

 	minesNumb = map.queryRenderedFeatures({layers: ['mines']}).length;
 	setFilter();

    // Create a hover, but don't add it to the map yet.
    var hover = new mapboxgl.Popup({
        closeButton: false,
        closeOnClick: false,
        offset: 8,
    });
    // Create a popup, but don't add it to the map yet.
    var popup = new mapboxgl.Popup({
        closeButton: true,
        closeOnClick: false,
        offset: 8,
    });

    // Add interactivity
    var filters = [
      {id: 'all', className: 'active', innerHTML: 'All', filter: null},
      {id: 'processing_steps_mercury', className: '', innerHTML: 'Mercury used', filter: ['==', ['get', 'processing_steps_mercury'], "1"]},
      {id: 'women_numb', className: '', innerHTML: 'Women workers', filter: ['>', ["to-number", ['get', 'women_numb']], 0]},
      {id: 'environment', className: '', innerHTML: 'Environmental impact', filter: ['==', ['get', 'environment'], "Yes"]},
      {id: 'conflict', className: '', innerHTML: 'Conflict with local community', filter: ['==', ["to-number", ['get', 'conflict_none']], 0]},
      {id: 'incident', className: '', innerHTML: 'Incidents in the last 6 months', filter: ['==', ["to-number", ['get', 'incident_none']], 0]},
      {id: 'authorities', className: '', innerHTML: 'Authorities visiting the site', filter: ['==', ["to-number", ['get', 'authorities_none']], 0]},
    ]
    // Make filters
    filters.forEach(function(properties) {
      var link = document.createElement('a');
          link.href = '#';
          link.id = properties.id;
          link.className = properties.className;
          link.innerHTML = properties.innerHTML;

      link.onclick = function(e) {
          e.preventDefault();
          e.stopPropagation();

          var wasActive = this.className == 'active'

          for (var i = 0; i < filter.children.length; i++) {
            filter.children[i].className = '';
          }

          if(wasActive) {
            setFilter(null);
            document.getElementById("all").className = 'active';
          } else {
            setFilter(properties.filter);
            this.className = 'active';
          }
        }
      filter.appendChild(link);
    });

    var toggles = [
      {id: 'toggleBasemap', className: 'off', innerHTMLOff: 'Switch to Mapbox Streets basemap', innerHTMLOn: 'Switch to Bing Satellite basemap', toggleOff: function(){map.setStyle(styleMapbox)}, toggleOn: function(){map.setStyle(styleBing)}},
      {id: 'toggleAbandonned', className: 'off', innerHTMLOff: 'Show abandonned mines', innerHTMLOn: 'Hide abandonned mines', toggleOff: function(){showAbandonned = true; document.getElementById("all").click()}, toggleOn: function(){showAbandonned = false; document.getElementById("all").click()}}
    ]
    // Make filters
    toggles.forEach(function(properties) {
      var link = document.createElement('a');
          link.href = '#';
          link.id = properties.id;
          link.className = properties.className;
          (properties.className == 'on') ? link.innerHTML = properties.innerHTMLOn: link.innerHTML = properties.innerHTMLOff; 

      link.onclick = function(e) {
          e.preventDefault();
          e.stopPropagation();

          var wasOn = this.className == 'on'

          if(wasOn) {
          	properties.toggleOn();
            this.className = 'off';
            this.innerHTML = properties.innerHTMLOff;
          } else {
          	properties.toggleOff();
            this.className = 'on';
            this.innerHTML = properties.innerHTMLOn;
          }
        }
      toggle.appendChild(link);
    });

    map.on('mouseenter', 'mines', function (e) {
      // Change the cursor to a pointer when the it enters a feature in the 'symbols' layer.
      map.getCanvas().style.cursor = 'pointer';

      var coordinates = e.features[0].geometry.coordinates.slice();
      var properties = correctNull(e.features[0].properties);

      // Open a hover at the location of the feature, with description HTML from its properties.
      // Ensure that if the map is zoomed out such that multiple copies of the feature are visible, the hover appears over the copy being pointed to.
      while (Math.abs(e.lngLat.lng - coordinates[0]) > 180) {
          coordinates[0] += e.lngLat.lng > coordinates[0] ? 360 : -360;
      }
      // Open hover
      hover.setLngLat(coordinates)
        .setHTML(properties.site_name)
        .addTo(map);
    });

    map.on('mouseleave', 'mines', function () {
      // Change cursor back
      map.getCanvas().style.cursor = '';
      hover.remove();
    });

    map.on('click', function (e) {
      popup.remove();
    });

    map.on('click', 'mines', function (e) {
      // Close hover
      hover.remove();
      
      var coordinates = e.features[0].geometry.coordinates.slice();
      var properties = correctNull(e.features[0].properties);

      // Open a popup at the location of the feature, with description HTML from its properties.
      // Ensure that if the map is zoomed out such that multiple copies of the feature are visible, the popup appears over the copy being pointed to.
      while (Math.abs(e.lngLat.lng - coordinates[0]) > 180) {
          coordinates[0] += e.lngLat.lng > coordinates[0] ? 360 : -360;
      }
      // Build HTML
      var content = document.createElement('div');
      content.innerHTML = Mustache.render(
        "<div class='thumbnail'><img id='thumbnail-img' src='http://www.ipisresearch.be/mapping/webmapping/resources/img_sites/{{picture}}' onerror='this.style.display=&#34;none&#34;'></div>" +
        "<table class='infotable heading'><tbody>" +
        "<tr><th>Site name</th><td>{{site_name}}</td></tr>" +
        "<tr><th>Pcode</th><td>{{pcode}}</td></tr>" +
        "<tr><th>Visit date</th><td>{{today}}</td></tr>" +
        "{{#workers_numb}}<tr><th>Number of workers</th><td>{{workers_numb}}{{#women_numb}} ({{women_numb}} women){{/women_numb}}</td></tr>{{/workers_numb}}" +
        "<tr><th>Mineral</th><td>{{mineral1_name}}</td></tr>" +
        "{{#site_status}}<tr><th>Site status</th><td>{{site_status}}</td></tr>{{/site_status}}" +
        "{{#site_type}}<tr><th>Site type</th><td>{{site_type}}</td></tr>{{/site_type}}" +
        "{{#site_regestration_owner}}<tr><th>Site owner</th><td>{{site_regestration_owner}}</td></tr>{{/site_regestration_owner}}" +
        "{{#processing_steps}}<tr><th>Processing steps</th><td>{{processing_steps}}</td></tr>{{/processing_steps}}" +
        "{{#environment_comment}}<tr><th>Environmental impact</th><td>{{environment_comment}}</td></tr>{{/environment_comment}}" +
        "{{#conflict}}<tr><th>Conflict with local community</th><td>{{conflict}}</td></tr>{{/conflict}}" +
        "{{#incident}}<tr><th>Incidents in the last 6 months</th><td>{{incident}}</td></tr>{{/incident}}" +
        "{{#authorities}}<tr><th>Authorities visiting the site</th><td>{{authorities}}</td></tr>{{/authorities}}" +
        "<tbody></table>", properties);

      // Open popup
      popup.setLngLat(coordinates)
        .setDOMContent(content)
        .addTo(map);

      // Add HTML class
      content.parentNode.className += ' mapboxgl-popup--infopopup';
      
      // Picture full screen
      var overlay = document.getElementById('overlay');
      
      var img = document.getElementById('thumbnail-img');
      var overlayImg = document.getElementById('overlay-img');
      img.onclick = function(){
        overlay.style.display = "block";
        overlayImg.src = this.src;
      }

      overlay.onclick = function() {
        overlay.style.display = "none";
      }
    });

    // Add zoom controls
    map.addControl(new mapboxgl.NavigationControl({showCompass: false}), 'top-left');
});

var setFilter = function(f) {
	var allFilters = ["all"];
	if (!showAbandonned) {
		allFilters.push(["==", ["get", "site_available"], "Yes"])
	}
	if (f) {
		allFilters.push(f);
	}
	map.setFilter("mines", allFilters);
	//document.getElementById("filterSubtitle").innerHTML = map.queryRenderedFeatures({layers: ['mines']}).length+" of "+minesNumb;
}