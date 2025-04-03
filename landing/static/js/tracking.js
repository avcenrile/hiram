/**
 * Arrivo EJeep Tracking JavaScript
 * Handles real-time tracking of EJeeps on the map
 * Enhanced version with improved tracking and ETA calculations
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
let lastKnownLocation = null;
let connectionAttempts = 0;
let maxConnectionAttempts = 5;
let reconnectInterval = null;
let trafficConditions = 'normal'; // Can be 'normal', 'moderate', 'heavy'
let delayReason = null;
let lastUpdateTime = null;

// Traffic delay factors (multipliers for ETA)
const trafficFactors = {
    'normal': 1.0,
    'moderate': 1.3,
    'heavy': 1.8
};

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
    
    // Create custom icons for better visibility
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
    
    // Set up periodic updates with reconnection logic
    startLocationUpdates();
    
    // Set up driver tracking if applicable
    if (isDriver) {
        initializeDriverTracking();
    }
}

// Start periodic location updates with reconnection logic
function startLocationUpdates() {
    // Clear any existing interval
    if (reconnectInterval) {
        clearInterval(reconnectInterval);
    }
    
    // Set up a new interval for updates
    reconnectInterval = setInterval(() => {
        fetchEJeepLocation();
    }, 5000); // Update every 5 seconds
}

// Fetch EJeep location from API with improved error handling
function fetchEJeepLocation() {
    // Show loading indicator
    if (!lastUpdateTime) {
        document.getElementById('ejeepStatus').textContent = 'Connecting...';
        document.getElementById('ejeepStatus').className = 'badge bg-info';
    }
    
    fetch(`/landing/api/ejeep/location/${lineId}/`)
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            // Reset connection attempts on successful connection
            connectionAttempts = 0;
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
                    lastKnownLocation = data.location;
                    lastUpdateTime = new Date();
                    updateEJeepLocation(data.location);
                    
                    // Check if the location is recent (within the last 5 minutes)
                    const lastUpdated = new Date(data.location.last_updated);
                    const now = new Date();
                    const diffMinutes = (now - lastUpdated) / (1000 * 60);
                    
                    if (diffMinutes > 5) {
                        // Location data is stale
                        document.getElementById('ejeepStatus').textContent = 'Connection Lost';
                        document.getElementById('ejeepStatus').className = 'badge bg-warning';
                        
                        // Show a notification about stale data
                        showNotification('Tracking Update', 'EJeep location data is stale. The driver may have stopped sharing their location.');
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
                
                // Simulate traffic conditions (in a real app, this would come from the server)
                simulateTrafficConditions();
            } else {
                console.error('Error fetching EJeep location:', data.error);
                handleConnectionError(data.error);
            }
        })
        .catch(error => {
            console.error('Error fetching EJeep location:', error);
            handleConnectionError(error.message);
        });
}

// Handle connection errors with exponential backoff
function handleConnectionError(errorMessage) {
    connectionAttempts++;
    
    // Show error in UI
    document.getElementById('ejeepStatus').textContent = 'Connection Error';
    document.getElementById('ejeepStatus').className = 'badge bg-danger';
    
    // If we have a last known location, keep showing it but mark it as stale
    if (lastKnownLocation && ejeepMarker) {
        const now = new Date();
        const lastUpdated = new Date(lastKnownLocation.last_updated);
        const diffMinutes = (now - lastUpdated) / (1000 * 60);
        
        if (diffMinutes > 5) {
            ejeepMarker.setOpacity(0.5); // Make the marker semi-transparent to indicate stale data
            
            // Update the popup to show it's stale
            ejeepMarker.bindPopup(`<b>EJeep ${lineId}</b><br>Last updated: ${lastKnownLocation.last_updated}<br><span style="color: red;">Data is stale</span>`);
        }
    }
    
    // If we've tried too many times, slow down the reconnection attempts
    if (connectionAttempts > maxConnectionAttempts) {
        clearInterval(reconnectInterval);
        reconnectInterval = setInterval(fetchEJeepLocation, 15000); // Try every 15 seconds after multiple failures
        
        // Show a notification about connection issues
        showNotification('Connection Issue', 'Having trouble connecting to the tracking server. Will keep trying.');
    }
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
        ejeepMarker.setOpacity(1.0); // Ensure marker is fully visible
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

// Calculate next stop and ETA with traffic considerations
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
    
    // Calculate ETA based on distance, average speed, and traffic conditions
    const distanceToNextStop = calculateDistance(
        currentPosition[0], currentPosition[1],
        nextStop.latitude, nextStop.longitude
    );
    
    // Convert distance from km to meters
    const distanceInMeters = distanceToNextStop * 1000;
    
    // Base average speed of 15 km/h = 4.17 m/s
    const baseSpeed = 4.17;
    
    // Apply traffic factor to adjust speed
    const adjustedSpeed = baseSpeed / trafficFactors[trafficConditions];
    
    // Calculate ETA in seconds with traffic consideration
    const etaSeconds = distanceInMeters / adjustedSpeed;
    
    // Format ETA
    let etaText;
    if (etaSeconds < 60) {
        etaText = 'Less than 1 min';
    } else {
        const etaMinutes = Math.round(etaSeconds / 60);
        etaText = `${etaMinutes} min`;
    }
    
    // Add traffic info if not normal
    if (trafficConditions !== 'normal') {
        etaText += ` (${trafficConditions} traffic)`;
    }
    
    // Add delay reason if any
    if (delayReason) {
        etaText += ` - Delay: ${delayReason}`;
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

// Update ETAs for all stops with traffic considerations
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
    
    // Base speed (15 km/h = 4.17 m/s)
    const baseSpeed = 4.17;
    
    // Apply traffic factor to adjust speed
    const adjustedSpeed = baseSpeed / trafficFactors[trafficConditions];
    
    // Convert to meters and calculate time with traffic consideration
    const timeToNextStop = (distanceToNextStop * 1000) / adjustedSpeed;
    
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
            
            // Add to cumulative distance and time with traffic consideration
            cumulativeDistance += distance;
            cumulativeTime += (distance * 1000) / adjustedSpeed; // Convert to seconds
        }
        
        // Format and display ETA
        let etaText;
        if (cumulativeTime < 60) {
            etaText = '<1m';
        } else {
            const etaMinutes = Math.round(cumulativeTime / 60);
            etaText = `${etaMinutes}m`;
        }
        
        // Add traffic indicator for non-normal conditions
        if (trafficConditions !== 'normal') {
            etaText += '*'; // Asterisk indicates traffic delay
        }
        
        // Update the badge for this stop
        const etaBadge = document.getElementById(`stop-eta-${stop.id}`);
        if (etaBadge) {
            etaBadge.textContent = etaText;
            
            // Change badge color based on traffic conditions
            if (trafficConditions === 'heavy') {
                etaBadge.className = 'badge bg-danger rounded-pill';
            } else if (trafficConditions === 'moderate') {
                etaBadge.className = 'badge bg-warning rounded-pill';
            } else {
                etaBadge.className = 'badge bg-primary rounded-pill';
            }
        }
    }
}

// Simulate traffic conditions (in a real app, this would come from the server)
function simulateTrafficConditions() {
    // In a real app, this would be based on real-time traffic data
    // For this demo, we'll randomly change traffic conditions
    
    // Only change traffic conditions occasionally (10% chance)
    if (Math.random() < 0.1) {
        const rand = Math.random();
        
        if (rand < 0.6) {
            // 60% chance of normal traffic
            trafficConditions = 'normal';
            delayReason = null;
        } else if (rand < 0.9) {
            // 30% chance of moderate traffic
            trafficConditions = 'moderate';
            delayReason = 'Moderate traffic congestion';
        } else {
            // 10% chance of heavy traffic
            trafficConditions = 'heavy';
            delayReason = 'Heavy traffic due to rush hour';
        }
        
        // Occasionally add specific delay reasons
        if (trafficConditions !== 'normal' && Math.random() < 0.3) {
            const reasons = [
                'Road construction ahead',
                'Minor accident reported',
                'Event causing congestion',
                'Weather-related slowdown'
            ];
            delayReason = reasons[Math.floor(Math.random() * reasons.length)];
        }
        
        // Update UI with traffic info if we have an active ejeep
        if (ejeepMarker && lastKnownLocation) {
            updateNextStopInfo([
                parseFloat(lastKnownLocation.latitude),
                parseFloat(lastKnownLocation.longitude)
            ]);
            
            // Show notification for significant traffic changes
            if (trafficConditions === 'heavy') {
                showNotification('Traffic Alert', `Heavy traffic reported. ${delayReason || 'Expect delays.'}`);
            }
        }
    }
}

// Initialize driver tracking functionality
function initializeDriverTracking() {
    const activeTrackingToggle = document.getElementById('activeTracking');
    const driverStatus = document.getElementById('driverStatus');
    const stopTrackingBtn = document.getElementById('stopTracking');
    const requestPermissionBtn = document.getElementById('requestPermission');
    const startTrackingBtn = document.getElementById('startTracking');
    
    // Don't start tracking automatically - wait for user action
    driverStatus.className = 'alert alert-warning';
    driverStatus.innerHTML = '<i class="fas fa-exclamation-triangle me-2"></i> Click "Start Tracking" to share your location';
    
    // Start tracking button
    startTrackingBtn.addEventListener('click', function() {
        startTracking();
        activeTrackingToggle.checked = true;
    });
    
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
        const requestPermissionBtn = document.getElementById('requestPermission');
        requestPermissionBtn.disabled = true;
        requestPermissionBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i> Requesting...';
        
        // Add a small delay to prevent conflicts with other permission requests
        setTimeout(() => {
            Notification.requestPermission().then(permission => {
                if (permission === 'granted') {
                    // Show a test notification after a short delay
                    setTimeout(() => {
                        showNotification('Arrivo Driver Tracking', 'Notifications enabled! You will be notified of any tracking issues.');
                    }, 1000);
                    
                    requestPermissionBtn.disabled = true;
                    requestPermissionBtn.innerHTML = '<i class="fas fa-check me-2"></i> Notifications Enabled';
                } else if (permission === 'denied') {
                    requestPermissionBtn.disabled = false;
                    requestPermissionBtn.innerHTML = '<i class="fas fa-times me-2"></i> Notifications Blocked';
                } else {
                    // Permission request was dismissed
                    requestPermissionBtn.disabled = false;
                    requestPermissionBtn.innerHTML = '<i class="fas fa-bell me-2"></i> Enable Notifications';
                }
            }).catch(error => {
                console.error('Error requesting notification permission:', error);
                requestPermissionBtn.disabled = false;
                requestPermissionBtn.innerHTML = '<i class="fas fa-bell me-2"></i> Enable Notifications';
            });
        }, 1000);
    }
}

// Show a notification
function showNotification(title, message) {
    if ('Notification' in window && Notification.permission === 'granted') {
        try {
            new Notification(title, {
                body: message,
                icon: '/static/images/logo.png'
            });
        } catch (e) {
            console.error('Error showing notification:', e);
        }
    }
}

// Start tracking driver location with improved error handling
function startTracking() {
    if (navigator.geolocation) {
        try {
            const driverStatus = document.getElementById('driverStatus');
            driverStatus.className = 'alert alert-info';
            driverStatus.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i> Requesting location access...';
            
            // Use high accuracy options for better tracking
            const geoOptions = {
                enableHighAccuracy: true,
                maximumAge: 0,
                timeout: 15000
            };
            
            // Use a timeout to ensure we're not requesting permissions too quickly
            setTimeout(() => {
                // First, get a single position to immediately show the driver's location
                navigator.geolocation.getCurrentPosition(
                    (position) => {
                        // Successfully got position, now start continuous tracking
                        updateDriverPosition(position);
                        
                        // Start watching for position updates with more frequent updates
                        if (watchId === null) {
                            watchId = navigator.geolocation.watchPosition(
                                updateDriverPosition,
                                handleLocationError,
                                geoOptions
                            );
                        }
                        
                        console.log('Geolocation tracking started');
                        
                        // Show success message
                        driverStatus.className = 'alert alert-success';
                        driverStatus.innerHTML = '<i class="fas fa-broadcast-tower me-2"></i> Your location is being shared';
                    },
                    (error) => {
                        handleLocationError(error);
                        
                        // Try again with less strict options if high accuracy fails
                        if (error.code === error.TIMEOUT) {
                            navigator.geolocation.getCurrentPosition(
                                updateDriverPosition,
                                handleLocationError,
                                { enableHighAccuracy: false, timeout: 30000, maximumAge: 60000 }
                            );
                        }
                    },
                    geoOptions
                );
            }, 500);
        } catch (e) {
            console.error('Error starting tracking:', e);
            alert('Error starting location tracking. Please try again or use a different browser.');
        }
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

// Update driver position and send to server with improved error handling
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
    
    // Send position to server with retry logic
    sendPositionToServer(lat, lng, heading, speed);
}

// Send position to server with retry logic
function sendPositionToServer(lat, lng, heading, speed, retryCount = 0) {
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
            const driverStatus = document.getElementById('driverStatus');
            driverStatus.className = 'alert alert-warning';
            driverStatus.innerHTML = `<i class="fas fa-exclamation-triangle me-2"></i> Server error: ${data.error}`;
            
            // Retry if needed
            if (retryCount < 3) {
                setTimeout(() => {
                    sendPositionToServer(lat, lng, heading, speed, retryCount + 1);
                }, 1000 * (retryCount + 1)); // Exponential backoff
            }
        }
    })
    .catch(error => {
        console.error('Error updating location:', error);
        const driverStatus = document.getElementById('driverStatus');
        driverStatus.className = 'alert alert-warning';
        driverStatus.innerHTML = `<i class="fas fa-exclamation-triangle me-2"></i> Connection error: ${error.message}`;
        
        // Retry if needed
        if (retryCount < 3) {
            setTimeout(() => {
                sendPositionToServer(lat, lng, heading, speed, retryCount + 1);
            }, 1000 * (retryCount + 1)); // Exponential backoff
        }
    });
}

// Handle geolocation errors with improved user feedback
function handleLocationError(error) {
    let errorMessage;
    const driverStatus = document.getElementById('driverStatus');
    const activeTrackingToggle = document.getElementById('activeTracking');
    
    switch(error.code) {
        case error.PERMISSION_DENIED:
            errorMessage = "Location permission denied. Please click 'Start Tracking' again and allow location access when prompted.";
            // Provide specific instructions for common browsers
            if (navigator.userAgent.indexOf("Chrome") !== -1) {
                errorMessage += " In Chrome, look for the location icon in the address bar and click it to enable permissions.";
            } else if (navigator.userAgent.indexOf("Firefox") !== -1) {
                errorMessage += " In Firefox, check the permissions icon in the address bar.";
            } else if (navigator.userAgent.indexOf("Safari") !== -1) {
                errorMessage += " In Safari, check your browser settings under Privacy & Security > Location Services.";
            }
            // Reset the tracking toggle
            activeTrackingToggle.checked = false;
            break;
        case error.POSITION_UNAVAILABLE:
            errorMessage = "Location information is unavailable. Please check your device's GPS or network connection.";
            break;
        case error.TIMEOUT:
            errorMessage = "The request to get your location timed out. Please try again by clicking 'Start Tracking'.";
            // Don't auto-restart, let the user try again manually
            activeTrackingToggle.checked = false;
            break;
        case error.UNKNOWN_ERROR:
            errorMessage = "An unknown error occurred. Please try again or use a different browser.";
            activeTrackingToggle.checked = false;
            break;
    }
    
    console.error('Geolocation error:', errorMessage, error);
    
    driverStatus.className = 'alert alert-danger';
    driverStatus.innerHTML = `<i class="fas fa-exclamation-triangle me-2"></i> ${errorMessage}`;
    
    // Clear any existing watch
    if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
        watchId = null;
    }
    
    // Show a notification if permissions are granted
    showNotification('Arrivo Tracking Error', errorMessage);
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
