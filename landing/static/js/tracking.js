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
        html: '<i class="fas fa-bus" style="color: #F12D2F; font-size: 24px;"></i>',
        iconSize: [24, 24],
        iconAnchor: [12, 12],
        popupAnchor: [0, -12]
    });
    
    const stopIcon = L.divIcon({
        className: 'stop-marker',
        html: '<i class="fas fa-map-marker-alt" style="color: #000000; font-size: 20px;"></i>',
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
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            return response.json();
        })
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
                    
                    // Check if the location is recent (within the last 5 minutes)
                    const lastUpdated = new Date(data.location.last_updated);
                    const now = new Date();
                    const diffMinutes = (now - lastUpdated) / (1000 * 60);
                    
                    if (diffMinutes > 5) {
                        // Location data is stale
                        document.getElementById('ejeepStatus').textContent = 'Connection Lost';
                        document.getElementById('ejeepStatus').className = 'badge bg-warning';
                    }
                } else {
                    // No active EJeep
                    document.getElementById('ejeepStatus').textContent = 'Not in Service';
                    document.getElementById('ejeepStatus').className = 'badge bg-danger';
                    document.getElementById('lastUpdated').textContent = 'N/A';
                    document.getElementById('currentSpeed').textContent = 'N/A';
                    document.getElementById('nextStopName').textContent = 'No EJeep in service';
                    document.getElementById('eta').textContent = '--:--';
                    document.getElementById('progressBar').style.width = '0%';
                    
                    // Remove ejeep marker if it exists
                    if (ejeepMarker) {
                        ejeepMarker.remove();
                        ejeepMarker = null;
                    }
                }
            } else {
                console.error('Error fetching EJeep location:', data.error);
            }
        })
        .catch(error => {
            console.error('Error fetching EJeep location:', error);
            // Show error in UI
            document.getElementById('ejeepStatus').textContent = 'Connection Error';
            document.getElementById('ejeepStatus').className = 'badge bg-danger';
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
    routePath = L.polyline(stopPoints, { color: '#F12D2F', weight: 3, opacity: 0.7 }).addTo(map);
    
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
    const requestPermissionBtn = document.getElementById('requestPermission');
    
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
    
    // Request notification permission
    requestPermissionBtn.addEventListener('click', function() {
        requestNotificationPermission();
    });
    
    // Check if we already have notification permission
    if ('Notification' in window) {
        if (Notification.permission === 'granted') {
            requestPermissionBtn.disabled = true;
            requestPermissionBtn.innerHTML = '<i class="fas fa-check me-2"></i> Notifications Enabled';
        } else if (Notification.permission === 'denied') {
            requestPermissionBtn.innerHTML = '<i class="fas fa-times me-2"></i> Notifications Blocked';
        }
    } else {
        requestPermissionBtn.disabled = true;
        requestPermissionBtn.innerHTML = '<i class="fas fa-times me-2"></i> Notifications Not Supported';
    }
}

// Request notification permission
function requestNotificationPermission() {
    if ('Notification' in window) {
        Notification.requestPermission().then(permission => {
            const requestPermissionBtn = document.getElementById('requestPermission');
            
            if (permission === 'granted') {
                // Show a test notification
                new Notification('Arrivo Driver Tracking', {
                    body: 'Notifications enabled! You will be notified of any tracking issues.',
                    icon: '/static/images/logo.png'
                });
                
                requestPermissionBtn.disabled = true;
                requestPermissionBtn.innerHTML = '<i class="fas fa-check me-2"></i> Notifications Enabled';
            } else if (permission === 'denied') {
                requestPermissionBtn.innerHTML = '<i class="fas fa-times me-2"></i> Notifications Blocked';
                alert('Please enable notifications in your browser settings to receive tracking alerts.');
            }
        });
    }
}

// Start tracking driver location
function startTracking() {
    if (navigator.geolocation) {
        // First, get a single position to immediately show the driver's location
        navigator.geolocation.getCurrentPosition(
            updateDriverPosition,
            handleLocationError,
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
        
        // Then start watching for position updates
        watchId = navigator.geolocation.watchPosition(
            updateDriverPosition,
            handleLocationError,
            { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 }
        );
        
        console.log('Geolocation tracking started');
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
    const accuracy = position.coords.accuracy || 0;
    
    // Update current position
    currentPosition = [lat, lng];
    
    // Update driver status with accuracy information
    const driverStatus = document.getElementById('driverStatus');
    if (accuracy > 100) {
        driverStatus.className = 'alert alert-warning';
        driverStatus.innerHTML = `<i class="fas fa-broadcast-tower me-2"></i> Your location is being shared (Low accuracy: ${Math.round(accuracy)}m)`;
    } else {
        driverStatus.className = 'alert alert-success';
        driverStatus.innerHTML = `<i class="fas fa-broadcast-tower me-2"></i> Your location is being shared (Accuracy: ${Math.round(accuracy)}m)`;
    }
    
    // Update driver's marker on the map if it exists
    if (ejeepMarker) {
        ejeepMarker.setLatLng([lat, lng]);
        // Center map on driver's position
        map.panTo([lat, lng]);
    } else {
        // Create marker if it doesn't exist
        ejeepMarker = L.marker([lat, lng], { icon: ejeepIcon })
            .addTo(map)
            .bindPopup(`<b>EJeep ${lineId}</b><br>Driver's position`);
    }
    
    console.log(`Position update: ${lat}, ${lng}, heading: ${heading}, speed: ${speed}, accuracy: ${accuracy}m`);
    
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
    .then(response => {
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }
        return response.json();
    })
    .then(data => {
        if (!data.success) {
            console.error('Error updating location:', data.error);
            driverStatus.className = 'alert alert-warning';
            driverStatus.innerHTML = `<i class="fas fa-exclamation-triangle me-2"></i> Server error: ${data.error}`;
        }
    })
    .catch(error => {
        console.error('Error updating location:', error);
        driverStatus.className = 'alert alert-warning';
        driverStatus.innerHTML = `<i class="fas fa-exclamation-triangle me-2"></i> Connection error: ${error.message}`;
    });
}

// Handle geolocation errors
function handleLocationError(error) {
    let errorMessage;
    switch(error.code) {
        case error.PERMISSION_DENIED:
            errorMessage = "User denied the request for Geolocation. Please enable location permissions in your browser settings and refresh the page.";
            break;
        case error.POSITION_UNAVAILABLE:
            errorMessage = "Location information is unavailable. Please check your device's GPS or network connection.";
            break;
        case error.TIMEOUT:
            errorMessage = "The request to get user location timed out. Please try again.";
            // Try to restart tracking after a timeout error
            setTimeout(() => {
                if (document.getElementById('activeTracking').checked) {
                    startTracking();
                }
            }, 5000);
            break;
        case error.UNKNOWN_ERROR:
            errorMessage = "An unknown error occurred. Please refresh the page and try again.";
            break;
    }
    
    console.error('Geolocation error:', errorMessage, error);
    
    const driverStatus = document.getElementById('driverStatus');
    driverStatus.className = 'alert alert-danger';
    driverStatus.innerHTML = `<i class="fas fa-exclamation-triangle me-2"></i> ${errorMessage}`;
    
    // Show a browser notification if possible
    if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('Arrivo Tracking Error', {
            body: errorMessage,
            icon: '/static/images/logo.png'
        });
    }
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