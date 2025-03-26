/**
 * Arrivo EJeep Tracking JavaScript
 * Handles real-time tracking of EJeeps on the map
 */

// Map and tracking variables
let map = null;
let ejeepMarker = null;
let stopMarkers = [];
let routePath = null;
let currentPosition = null;
let watchId = null;
let stops = [];
let nextStopIndex = 0;
let lineId = '';
let isDriver = false;

// Initialize the map
function initializeMap(mapElementId, lineIdentifier, driverStatus) {
    // Set global variables
    lineId = lineIdentifier;
    isDriver = driverStatus;
    
    // Create the map centered at Ateneo
    map = L.map(mapElementId).setView([14.6400, 121.0769], 16);
    
    // Add OpenStreetMap tiles
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© OpenStreetMap contributors'
    }).addTo(map);
    
    // Use default Leaflet markers
    const ejeepIcon = L.divIcon({
        className: 'ejeep-marker',
        html: '<i class="fas fa-bus" style="color: #ff3b30; font-size: 24px;"></i>',
        iconSize: [24, 24],
        iconAnchor: [12, 12],
        popupAnchor: [0, -12]
    });
    
    const stopIcon = L.divIcon({
        className: 'stop-marker',
        html: '<i class="fas fa-map-marker-alt" style="color: #007bff; font-size: 20px;"></i>',
        iconSize: [20, 20],
        iconAnchor: [10, 20],
        popupAnchor: [0, -20]
    });
    
    // Fetch initial data
    fetchEJeepLocation();
    
    // Set up periodic updates
    setInterval(fetchEJeepLocation, 5000); // Update every 5 seconds
    
    // Set up driver tracking if applicable
    if (isDriver) {
        initializeDriverTracking();
    }
}

// Fetch EJeep location from API
function fetchEJeepLocation() {
    fetch(`/landing/api/ejeep/location/${lineId}/`)
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                // Update stops if not already loaded
                if (stops.length === 0 && data.stops) {
                    stops = data.stops;
                    addStopsToMap(stops);
                }
                
                // Update EJeep location if available
                if (data.location) {
                    updateEJeepLocation(data.location);
                } else {
                    // No active EJeep
                    document.getElementById('ejeepStatus').textContent = 'Not in Service';
                    document.getElementById('ejeepStatus').className = 'badge bg-danger';
                    document.getElementById('lastUpdated').textContent = 'N/A';
                    document.getElementById('currentSpeed').textContent = 'N/A';
                    document.getElementById('nextStopName').textContent = 'No EJeep in service';
                    document.getElementById('eta').textContent = '--:--';
                    document.getElementById('progressBar').style.width = '0%';
                }
            } else {
                console.error('Error fetching EJeep location:', data.error);
            }
        })
        .catch(error => {
            console.error('Error fetching EJeep location:', error);
        });
}

// Add stops to the map
function addStopsToMap(stops) {
    stops.forEach(stop => {
        const marker = L.marker([stop.latitude, stop.longitude], { icon: stopIcon })
            .addTo(map)
            .bindPopup(`<b>${stop.name}</b>`);
        
        stopMarkers.push(marker);
    });
    
    // Create a path connecting all stops
    const stopPoints = stops.map(stop => [stop.latitude, stop.longitude]);
    routePath = L.polyline(stopPoints, { color: '#ff3b30', weight: 3, opacity: 0.7 }).addTo(map);
    
    // Fit map to show all stops
    if (stopPoints.length > 0) {
        map.fitBounds(routePath.getBounds(), { padding: [50, 50] });
    }
}

// Update EJeep location on the map
function updateEJeepLocation(location) {
    const lat = parseFloat(location.latitude);
    const lng = parseFloat(location.longitude);
    
    // Update marker
    if (ejeepMarker) {
        ejeepMarker.setLatLng([lat, lng]);
    } else {
        ejeepMarker = L.marker([lat, lng], { icon: ejeepIcon })
            .addTo(map)
            .bindPopup(`<b>EJeep ${lineId}</b><br>Last updated: ${location.last_updated}`);
    }
    
    // Update info
    document.getElementById('ejeepStatus').textContent = 'In Service';
    document.getElementById('ejeepStatus').className = 'badge bg-success';
    document.getElementById('lastUpdated').textContent = formatTimestamp(location.last_updated);
    document.getElementById('currentSpeed').textContent = `${Math.round(location.speed)} km/h`;
    
    // Calculate and update next stop info
    if (stops.length > 0) {
        updateNextStopInfo([lat, lng]);
    }
}

// Calculate next stop and ETA
function updateNextStopInfo(currentPosition) {
    // Find the closest stop
    let minDistance = Infinity;
    let closestStopIndex = 0;
    
    stops.forEach((stop, index) => {
        const distance = calculateDistance(
            currentPosition[0], currentPosition[1],
            stop.latitude, stop.longitude
        );
        
        if (distance < minDistance) {
            minDistance = distance;
            closestStopIndex = index;
        }
    });
    
    // The next stop is the one after the closest stop
    nextStopIndex = (closestStopIndex + 1) % stops.length;
    const nextStop = stops[nextStopIndex];
    
    // Update UI
    document.getElementById('nextStopName').textContent = nextStop.name;
    
    // Calculate ETA based on distance and average speed (assuming 15 km/h)
    const distanceToNextStop = calculateDistance(
        currentPosition[0], currentPosition[1],
        nextStop.latitude, nextStop.longitude
    );
    
    // Convert distance from km to meters
    const distanceInMeters = distanceToNextStop * 1000;
    
    // Assume average speed of 15 km/h = 4.17 m/s
    const averageSpeed = 4.17;
    
    // Calculate ETA in seconds
    const etaSeconds = distanceInMeters / averageSpeed;
    
    // Format ETA
    let etaText;
    if (etaSeconds < 60) {
        etaText = 'Less than 1 min';
    } else {
        const etaMinutes = Math.round(etaSeconds / 60);
        etaText = `${etaMinutes} min`;
    }
    
    document.getElementById('eta').textContent = etaText;
    
    // Update progress bar - calculate percentage of distance covered to next stop
    const totalSegmentDistance = calculateDistance(
        stops[closestStopIndex].latitude, stops[closestStopIndex].longitude,
        nextStop.latitude, nextStop.longitude
    );
    
    const distanceCovered = totalSegmentDistance - distanceToNextStop;
    const progressPercentage = (distanceCovered / totalSegmentDistance) * 100;
    
    document.getElementById('progressBar').style.width = `${Math.max(0, Math.min(100, progressPercentage))}%`;
    
    // Update ETAs for all stops
    updateAllStopsETA(currentPosition);
}

// Update ETAs for all stops
function updateAllStopsETA(currentPosition) {
    let cumulativeDistance = 0;
    let cumulativeTime = 0;
    
    // Start from the next stop
    let currentIndex = nextStopIndex;
    
    // Calculate distance to the next stop
    const distanceToNextStop = calculateDistance(
        currentPosition[0], currentPosition[1],
        stops[nextStopIndex].latitude, stops[nextStopIndex].longitude
    );
    
    // Convert to meters and calculate time (assuming 15 km/h = 4.17 m/s)
    const timeToNextStop = (distanceToNextStop * 1000) / 4.17;
    
    // Update ETAs for all stops
    for (let i = 0; i < stops.length; i++) {
        const stopIndex = (nextStopIndex + i) % stops.length;
        const stop = stops[stopIndex];
        
        if (i === 0) {
            // Next stop
            cumulativeTime = timeToNextStop;
        } else {
            // Calculate distance from previous stop
            const prevStopIndex = (stopIndex - 1 + stops.length) % stops.length;
            const distance = calculateDistance(
                stops[prevStopIndex].latitude, stops[prevStopIndex].longitude,
                stop.latitude, stop.longitude
            );
            
            // Add to cumulative distance and time
            cumulativeDistance += distance;
            cumulativeTime += (distance * 1000) / 4.17; // Convert to seconds
        }
        
        // Format and display ETA
        let etaText;
        if (cumulativeTime < 60) {
            etaText = '<1m';
        } else {
            const etaMinutes = Math.round(cumulativeTime / 60);
            etaText = `${etaMinutes}m`;
        }
        
        // Update the badge for this stop
        const etaBadge = document.getElementById(`stop-eta-${stop.id}`);
        if (etaBadge) {
            etaBadge.textContent = etaText;
        }
    }
}

// Initialize driver tracking functionality
function initializeDriverTracking() {
    const activeTrackingToggle = document.getElementById('activeTracking');
    const driverStatus = document.getElementById('driverStatus');
    const stopTrackingBtn = document.getElementById('stopTracking');
    
    // Start tracking when the page loads
    startTracking();
    
    // Toggle tracking on/off
    activeTrackingToggle.addEventListener('change', function() {
        if (this.checked) {
            startTracking();
            driverStatus.className = 'alert alert-success';
            driverStatus.innerHTML = '<i class="fas fa-broadcast-tower me-2"></i> Your location is being shared';
        } else {
            stopTracking();
            driverStatus.className = 'alert alert-warning';
            driverStatus.innerHTML = '<i class="fas fa-pause-circle me-2"></i> Tracking paused';
        }
    });
    
    // Stop tracking button
    stopTrackingBtn.addEventListener('click', function() {
        stopTracking();
        activeTrackingToggle.checked = false;
        driverStatus.className = 'alert alert-danger';
        driverStatus.innerHTML = '<i class="fas fa-stop-circle me-2"></i> Tracking stopped';
    });
}

// Start tracking driver location
function startTracking() {
    if (navigator.geolocation) {
        watchId = navigator.geolocation.watchPosition(
            updateDriverPosition,
            handleLocationError,
            { enableHighAccuracy: true, maximumAge: 0, timeout: 5000 }
        );
    } else {
        alert('Geolocation is not supported by this browser.');
    }
}

// Stop tracking driver location
function stopTracking() {
    if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
        watchId = null;
    }
}

// Update driver position and send to server
function updateDriverPosition(position) {
    const lat = position.coords.latitude;
    const lng = position.coords.longitude;
    const heading = position.coords.heading || 0;
    const speed = position.coords.speed ? position.coords.speed * 3.6 : 0; // Convert m/s to km/h
    
    // Update current position
    currentPosition = [lat, lng];
    
    // Send position to server
    fetch('/landing/api/ejeep/update_location/', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': getCookie('csrftoken')
        },
        body: JSON.stringify({
            line_id: lineId,
            latitude: lat,
            longitude: lng,
            heading: heading,
            speed: speed
        })
    })
    .then(response => response.json())
    .then(data => {
        if (!data.success) {
            console.error('Error updating location:', data.error);
        }
    })
    .catch(error => {
        console.error('Error updating location:', error);
    });
}

// Handle geolocation errors
function handleLocationError(error) {
    let errorMessage;
    switch(error.code) {
        case error.PERMISSION_DENIED:
            errorMessage = "User denied the request for Geolocation.";
            break;
        case error.POSITION_UNAVAILABLE:
            errorMessage = "Location information is unavailable.";
            break;
        case error.TIMEOUT:
            errorMessage = "The request to get user location timed out.";
            break;
        case error.UNKNOWN_ERROR:
            errorMessage = "An unknown error occurred.";
            break;
    }
    
    console.error('Geolocation error:', errorMessage);
    
    const driverStatus = document.getElementById('driverStatus');
    driverStatus.className = 'alert alert-danger';
    driverStatus.innerHTML = `<i class="fas fa-exclamation-triangle me-2"></i> ${errorMessage}`;
}

// Helper function to calculate distance between two points (Haversine formula)
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Radius of the earth in km
    const dLat = deg2rad(lat2 - lat1);
    const dLon = deg2rad(lon2 - lon1);
    const a = 
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * 
        Math.sin(dLon/2) * Math.sin(dLon/2); 
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
    const distance = R * c; // Distance in km
    return distance;
}

function deg2rad(deg) {
    return deg * (Math.PI/180);
}

// Format timestamp
function formatTimestamp(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    
    // If it's today, just show the time
    if (date.toDateString() === now.toDateString()) {
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else {
        return date.toLocaleString([], { 
            month: 'short', 
            day: 'numeric', 
            hour: '2-digit', 
            minute: '2-digit' 
        });
    }
}

// Get CSRF token from cookies
function getCookie(name) {
    let cookieValue = null;
    if (document.cookie && document.cookie !== '') {
        const cookies = document.cookie.split(';');
        for (let i = 0; i < cookies.length; i++) {
            const cookie = cookies[i].trim();
            if (cookie.substring(0, name.length + 1) === (name + '=')) {
                cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                break;
            }
        }
    }
    return cookieValue;
}