mapboxgl.accessToken = 'pk.eyJ1IjoiZ2F1cmF2bmciLCJhIjoiY20xdG1kZTA0MDNiejJ2c2JtMmRlaG02OSJ9._xGChZrx9OZlwpcv3dXVqQ';

const map = new mapboxgl.Map({
    container: 'map',
    style: 'mapbox://styles/mapbox/streets-v12', 
    center: [77.2090, 28.6139], 
    zoom: 12 
});

map.addControl(new mapboxgl.NavigationControl(), 'top-right');

let trafficLayerVisible = false; 
function toggleTraffic() {
    if (trafficLayerVisible) {
        map.removeLayer('traffic'); 
        map.removeSource('traffic'); 
    } else {
        map.addSource('traffic', {
            type: 'vector',
            url: 'mapbox://mapbox.mapbox-traffic-v1'
        });
        
        map.addLayer({
            'id': 'traffic',
            'type': 'line',
            'source': 'traffic',
            'source-layer': 'traffic',
            'layout': {},
            'paint': {
                'line-color': 'rgba(255, 0, 0, 0.7)', 
                'line-width': 2 
            }
        });
    }
    trafficLayerVisible = !trafficLayerVisible; 
}
document.getElementById('toggle-traffic').addEventListener('change', function() {
    toggleTraffic(); 
});

document.getElementById('back-button').addEventListener('click', () => {
    location.reload(); 
  });

document.getElementById('satellite-btn').addEventListener('click', () => {
    map.setStyle('mapbox://styles/mapbox/satellite-v9'); 
  });
  
document.getElementById('outdoors-btn').addEventListener('click', () => {
    map.setStyle('mapbox://styles/mapbox/outdoors-v11'); 
  });
  
document.getElementById('dark-mode-btn').addEventListener('click', () => {
    map.setStyle('mapbox://styles/mapbox/dark-v10'); 
  });

const geocoder = new MapboxGeocoder({
    accessToken: mapboxgl.accessToken,
    mapboxgl: mapboxgl,
    marker: false, 
    placeholder: 'Search for places',
    bbox: [ -180, -90, 180, 90 ],
    proximity: {
        longitude: 77.2090,
        latitude: 28.6139
    }
});

map.addControl(geocoder, 'top-left', );

map.addControl(new mapboxgl.GeolocateControl({
    positionOptions: {
        enableHighAccuracy: true  
    },
    trackUserLocation: true, 
    showUserHeading: true  
}));

function addMarker(coordinates, description, color = 'blue', className = '') {
    new mapboxgl.Marker({ color, className })
        .setLngLat(coordinates)
        .setPopup(new mapboxgl.Popup({ offset: 25 }).setText(description))
        .addTo(map);
}

geocoder.on('result', (e) => {
    const coords = e.result.center;
    removeMainMarkers();
    addMarker(coords, e.result.place_name);
    fetchNearbyPlaces(coords);
    displayCustomRecommendations(coords);
});

function removeMainMarkers() {
    const existingMainMarkers = document.getElementsByClassName('main-marker');
    while(existingMainMarkers[0]) {
        existingMainMarkers[0].parentNode.removeChild(existingMainMarkers[0]);
    }
}
// Function to fetch nearby places using Mapbox Geocoding API
function fetchNearbyPlaces(center) {
    const types = ['restaurant', 'park', 'hotel'];
    const promises = types.map(type => {
        const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(type)}.json?proximity=${center[0]},${center[1]}&limit=10&access_token=${mapboxgl.accessToken}`;
        return fetch(url).then(response => response.json());
    });
   
    Promise.all(promises)
        .then(results => {
            removeNearbyMarkers();
            const nearbyPlacesDiv = document.getElementById('nearby-places');
            nearbyPlacesDiv.innerHTML = '<ul></ul>';
            results.forEach((data, index) => {
                const type = types[index];
                data.features.forEach(feature => {
                    if(feature.geometry && feature.geometry.coordinates){
                        let color;
                        switch(type){
                            case 'restaurant':
                                color = 'red';
                                break;
                            case 'park':
                                color = 'green';
                                break;
                            case 'hotel':
                                color = 'orange';
                                break;
                            default:
                                color = 'blue';
                        }
                        addMarker(feature.geometry.coordinates, feature.place_name, color, 'nearby-marker');
                        const ul = nearbyPlacesDiv.querySelector('ul');
                        const li = document.createElement('li');
                        li.innerHTML = `<strong>${capitalizeFirstLetter(type)}:</strong> ${feature.text}`;
                        ul.appendChild(li);
                    }
                });
            });
        })
        .catch(error => console.error('Error fetching nearby places:', error));
}

function removeNearbyMarkers() {
    const existingMarkers = document.getElementsByClassName('nearby-marker');
    while(existingMarkers[0]) {
        existingMarkers[0].parentNode.removeChild(existingMarkers[0]);
    }
}

function capitalizeFirstLetter(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
}

const startGeocoder = new MapboxGeocoder({
    accessToken: mapboxgl.accessToken,
    mapboxgl: mapboxgl,
    placeholder: 'Start Location',
    marker: false
});

const endGeocoder = new MapboxGeocoder({
    accessToken: mapboxgl.accessToken,
    mapboxgl: mapboxgl,
    placeholder: 'End Location',
    marker: false
});

document.getElementById('start').appendChild(startGeocoder.onAdd(map));
document.getElementById('end').appendChild(endGeocoder.onAdd(map));
let startCoords = null;
let endCoords = null;

startGeocoder.on('result', (e) => {
    startCoords = e.result.center;
    addMarker(startCoords, 'Start Location', 'green', 'main-marker');
});

endGeocoder.on('result', (e) => {
    endCoords = e.result.center;
    addMarker(endCoords, 'End Location', 'red', 'main-marker');
});

document.getElementById('calculate').addEventListener('click', () => {
    if(startCoords && endCoords){
        const from = turf.point(startCoords);
        const to = turf.point(endCoords);
        const options = { units: 'kilometers' };
        const distance = turf.distance(from, to, options);
        document.getElementById('distance').innerText = `Distance: ${distance.toFixed(2)} km`;
        drawLine(startCoords, endCoords);
    } else {
        alert('Please select both start and end locations.');
    }
});

function drawLine(start, end){
    if(map.getLayer('route')){
        map.removeLayer('route');
    }
    if(map.getSource('route')){
        map.removeSource('route');
    }
    const route = {
        'type': 'Feature',
        'properties': {},
        'geometry': {
            'type': 'LineString',
            'coordinates': [start, end]
        }
    };
    map.addSource('route', {
        'type': 'geojson',
        'data': route
    });
    map.addLayer({
        'id': 'route',
        'type': 'line',
        'source': 'route',
        'layout': {
            'line-join': 'round',
            'line-cap': 'round'
        },
        'paint': {
            'line-color': '#888',
            'line-width': 6
        }
    });
}

document.getElementById('get-route').addEventListener('click', () => {
    if(startCoords && endCoords){
        const mode = document.getElementById('transport-mode').value;
        getRoute(startCoords, endCoords, mode);
    } else {
        alert('Please select both start and end locations.');
    }
});

// Function to get route from Mapbox Directions API
function getRoute(start, end, mode){
    const url = `https://api.mapbox.com/directions/v5/mapbox/${mode}/${start[0]},${start[1]};${end[0]},${end[1]}?geometries=geojson&access_token=${mapboxgl.accessToken}`;

    fetch(url)
        .then(response => response.json())
        .then(data => {
            if(data.routes.length === 0){
                alert('No route found.');
                return;
            }

            const route = data.routes[0].geometry.coordinates;
            const distance = (data.routes[0].distance / 1000).toFixed(2); 
            const duration = (data.routes[0].duration / 60).toFixed(2); 
            if(map.getLayer('route')){
                map.removeLayer('route');
            }
            if(map.getSource('route')){
                map.removeSource('route');
            }
            map.addSource('route', {
                'type': 'geojson',
                'data': {
                    'type': 'Feature',
                    'properties': {},
                    'geometry': {
                        'type': 'LineString',
                        'coordinates': route
                    }
                }
            });
            map.addLayer({
                'id': 'route',
                'type': 'line',
                'source': 'route',
                'layout': {
                    'line-join': 'round',
                    'line-cap': 'round'
                },
                'paint': {
                    'line-color': '#1db7dd',
                    'line-width': 6
                }
            });
            const bounds = new mapboxgl.LngLatBounds();
            route.forEach(coord => bounds.extend(coord));
            map.fitBounds(bounds, { padding: 50 });

            document.getElementById('route-info').innerHTML = `
                <p><strong>Distance:</strong> ${distance} km</p>
                <p><strong>Estimated Time:</strong> ${duration} minutes</p>
            `;
        })
        .catch(error => {
            console.error('Error fetching route:', error);
            alert('An error occurred while fetching the route.');
        });
}

function displayCustomRecommendations(center) {
    // For demonstration, we'll fetch top 5 restaurants
    const type = 'restaurant';
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(type)}.json?proximity=${center[0]},${center[1]}&limit=5&access_token=${mapboxgl.accessToken}`;

    fetch(url)
        .then(response => response.json())
        .then(data => {
            const recommendationsDiv = document.getElementById('custom-recommendations');
            recommendationsDiv.innerHTML = '<ul></ul>';
            const ul = recommendationsDiv.querySelector('ul');

            data.features.forEach(feature => {
                const li = document.createElement('li');
                li.innerHTML = `<strong>${feature.text}</strong><br>${feature.place_name}`;
                ul.appendChild(li);
            });
        })
        .catch(error => console.error('Error fetching custom recommendations:', error));
}