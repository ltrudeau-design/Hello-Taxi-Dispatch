// ============================================================================
// KERNEL-MAP.JS
// Map Initialization, Styles, Polylines, Markers, Geocoding, Layers
// ============================================================================

(function() {
    'use strict';

    // ========================================================================
    // MAP STYLE PRESETS
    // ========================================================================

    var MAP_STYLES = {
        muted: [
            {elementType: 'geometry', stylers: [{color: '#f5f5f5'}, {lightness: 20}]},
            {elementType: 'labels.icon', stylers: [{visibility: 'off'}]},
            {elementType: 'labels.text.fill', stylers: [{color: '#616161'}]},
            {elementType: 'labels.text.stroke', stylers: [{color: '#f5f5f5'}]},
            {featureType: 'administrative', elementType: 'geometry', stylers: [{visibility: 'off'}]},
            {featureType: 'poi', stylers: [{visibility: 'off'}]},
            {featureType: 'road', elementType: 'geometry', stylers: [{color: '#e5e5e5'}]},
            {featureType: 'road.arterial', elementType: 'geometry', stylers: [{color: '#d6d6d6'}]},
            {featureType: 'road.highway', elementType: 'geometry', stylers: [{color: '#c9c9c9'}]},
            {featureType: 'road', elementType: 'labels.icon', stylers: [{visibility: 'off'}]},
            {featureType: 'transit', stylers: [{visibility: 'off'}]},
            {featureType: 'water', elementType: 'geometry', stylers: [{color: '#c9c9c9'}]}
        ],
        cityroads: [
            {elementType: 'geometry', stylers: [{color: '#000000'}]},
            {elementType: 'labels', stylers: [{visibility: 'off'}]},
            {featureType: 'poi', stylers: [{visibility: 'off'}]},
            {featureType: 'transit', stylers: [{visibility: 'off'}]},
            {featureType: 'administrative', stylers: [{visibility: 'off'}]},
            {featureType: 'road', elementType: 'geometry', stylers: [{color: '#ffffff'}, {weight: 0.3}]},
            {featureType: 'road.highway', elementType: 'geometry', stylers: [{color: '#ffffff'}, {weight: 0.5}]},
            {featureType: 'water', elementType: 'geometry', stylers: [{color: '#000000'}]}
        ],
        blueprint: [
            {elementType: 'geometry', stylers: [{color: '#1e3a5f'}]},
            {elementType: 'labels', stylers: [{visibility: 'off'}]},
            {featureType: 'poi', stylers: [{visibility: 'off'}]},
            {featureType: 'transit', stylers: [{visibility: 'off'}]},
            {featureType: 'administrative', stylers: [{visibility: 'off'}]},
            {featureType: 'road', elementType: 'geometry', stylers: [{color: '#3498db'}, {weight: 0.4}]},
            {featureType: 'road.highway', elementType: 'geometry', stylers: [{color: '#3498db'}, {weight: 0.6}]},
            {featureType: 'water', elementType: 'geometry', stylers: [{color: '#0f2537'}]}
        ],
        retro: [
            {elementType: 'geometry', stylers: [{color: '#ebe3cd'}]},
            {elementType: 'labels.text.fill', stylers: [{color: '#523735'}]},
            {elementType: 'labels.text.stroke', stylers: [{color: '#f5f1e6'}]},
            {featureType: 'administrative', elementType: 'geometry.stroke', stylers: [{color: '#c9b2a6'}]},
            {featureType: 'poi', stylers: [{visibility: 'off'}]},
            {featureType: 'road', elementType: 'geometry', stylers: [{color: '#f5f1e6'}]},
            {featureType: 'road.arterial', elementType: 'geometry', stylers: [{color: '#fdfcf8'}]},
            {featureType: 'road.highway', elementType: 'geometry', stylers: [{color: '#f8c967'}]},
            {featureType: 'road.highway', elementType: 'geometry.stroke', stylers: [{color: '#e9bc62'}]},
            {featureType: 'transit', stylers: [{visibility: 'off'}]},
            {featureType: 'water', elementType: 'geometry.fill', stylers: [{color: '#b9d3c2'}]}
        ],
        night: [
            {elementType: 'geometry', stylers: [{color: '#242f3e'}]},
            {elementType: 'labels.text.stroke', stylers: [{color: '#242f3e'}]},
            {elementType: 'labels.text.fill', stylers: [{color: '#746855'}]},
            {featureType: 'poi', stylers: [{visibility: 'off'}]},
            {featureType: 'road', elementType: 'geometry', stylers: [{color: '#38414e'}]},
            {featureType: 'road', elementType: 'geometry.stroke', stylers: [{color: '#212a37'}]},
            {featureType: 'road.highway', elementType: 'geometry', stylers: [{color: '#746855'}]},
            {featureType: 'road.highway', elementType: 'geometry.stroke', stylers: [{color: '#1f2835'}]},
            {featureType: 'transit', stylers: [{visibility: 'off'}]},
            {featureType: 'water', elementType: 'geometry', stylers: [{color: '#17263c'}]}
        ],
        default: []
    };

    // Layer references
    var trafficLayer = null;
    var transitLayer = null;
    var bicyclingLayer = null;

    // Steinbach coordinates
    var steinbach = { lat: 49.5258, lng: -96.6839 };

    // ========================================================================
    // MAP INITIALIZATION
    // ========================================================================

    function initMap() {
        console.log('🗺️ Initializing Google Maps...');
        
        var map = new google.maps.Map(document.getElementById('map'), {
            center: steinbach,
            zoom: 13,
            styles: MAP_STYLES.muted,
            disableDefaultUI: true,
            zoomControl: true,
            mapTypeControl: false,
            scaleControl: false,
            streetViewControl: false,
            rotateControl: false,
            fullscreenControl: false
        });
        
        // Store in STATE
        STATE.map = map;
        STATE.placesService = new google.maps.places.PlacesService(map);
        STATE.geocoder = new google.maps.Geocoder();
        
        // Setup autocomplete
        setupSearch('dispatch-pickup', 'pickup-suggestions');
        setupSearch('dispatch-dropoff', 'dropoff-suggestions');
        setupSearch('nickname-address', 'nickname-suggestions');
        
        // Apply saved map style
        initMapStyle();
        
        console.log('✅ Map initialized');
        console.log('✅ Places service initialized');
        console.log('✅ Geocoder initialized');
        console.log('🔍 Autocomplete search enabled');

        // Map is ready - app initialization handled by kernel-core.js
    }

    // ========================================================================
    // MAP STYLE FUNCTIONS
    // ========================================================================

    function initMapStyle() {
        if (!STATE.map) return;
        
        if (DATA.mapStyle === 'custom' && DATA.customMapStyle) {
            STATE.map.setOptions({ styles: DATA.customMapStyle });
            
            var input = document.getElementById('custom-style-json');
            if (input) {
                input.value = JSON.stringify(DATA.customMapStyle, null, 2);
            }
        } else {
            var style = MAP_STYLES[DATA.mapStyle] || MAP_STYLES.muted;
            STATE.map.setOptions({ styles: style });
            
            // Update active button state
            document.querySelectorAll('.btn-map-style').forEach(function(btn) {
                if (btn.dataset.style === DATA.mapStyle) {
                    btn.classList.add('active');
                } else {
                    btn.classList.remove('active');
                }
            });
        }
        
        console.log('🗺️ Map initialized with style: ' + DATA.mapStyle);
    }

    function setMapStyle(styleName) {
        if (!STATE.map) return;
        
        var style = MAP_STYLES[styleName] || MAP_STYLES.default;
        STATE.map.setOptions({ styles: style });
        
        DATA.mapStyle = styleName;
        save();
        
        // Update active button state
        document.querySelectorAll('.btn-map-style').forEach(function(btn) {
            if (btn.dataset.style === styleName) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
        
        console.log('🗺️ Map style set to: ' + styleName);
    }

    function applyCustomMapStyle() {
        var input = document.getElementById('custom-style-json');
        if (!input) return;
        
        try {
            var customStyle = JSON.parse(input.value);
            STATE.map.setOptions({ styles: customStyle });
            
            DATA.mapStyle = 'custom';
            DATA.customMapStyle = customStyle;
            save();
            
            console.log('✅ Custom map style applied');
            showSystemMessage('Custom map style applied', 3000, 'success');
        } catch (e) {
            console.error('❌ Invalid JSON:', e);
            showSystemMessage('Invalid JSON format', 3000, 'error');
        }
    }

    function clearCustomMapStyle() {
        var input = document.getElementById('custom-style-json');
        if (input) input.value = '';
        
        DATA.customMapStyle = null;
        setMapStyle('muted');
    }

    // ========================================================================
    // QUICK STYLE CONTROLS
    // ========================================================================

    function updateQuickStyle() {
        if (!STATE.map) return;
        
        var bgColor = document.getElementById('quick-bg-color').value;
        var bgLightness = parseInt(document.getElementById('quick-bg-lightness').value);
        var roadColor = document.getElementById('quick-road-color').value;
        var roadSat = parseInt(document.getElementById('quick-road-saturation').value);
        var waterColor = document.getElementById('quick-water-color').value;
        var waterSat = parseInt(document.getElementById('quick-water-saturation').value);
        var labelColor = document.getElementById('quick-label-color').value;
        var labelLightness = parseInt(document.getElementById('quick-label-lightness').value);
        var gamma = parseFloat(document.getElementById('quick-gamma').value);
        var hidePOI = document.getElementById('quick-hide-poi').checked;
        var hideLabels = document.getElementById('quick-hide-labels').checked;
        var hideTransit = document.getElementById('quick-hide-transit').checked;
        
        // Update slider value displays
        var bgLightnessVal = document.getElementById('quick-bg-lightness-val');
        var roadSatVal = document.getElementById('quick-road-saturation-val');
        var waterSatVal = document.getElementById('quick-water-saturation-val');
        var labelLightnessVal = document.getElementById('quick-label-lightness-val');
        var gammaVal = document.getElementById('quick-gamma-val');
        
        if (bgLightnessVal) bgLightnessVal.textContent = bgLightness;
        if (roadSatVal) roadSatVal.textContent = roadSat;
        if (waterSatVal) waterSatVal.textContent = waterSat;
        if (labelLightnessVal) labelLightnessVal.textContent = labelLightness;
        if (gammaVal) gammaVal.textContent = gamma.toFixed(1);
        
        // Build style array
        var style = [
            {
                elementType: 'geometry',
                stylers: [
                    { color: bgColor },
                    { lightness: bgLightness },
                    { gamma: gamma }
                ]
            },
            {
                featureType: 'road',
                elementType: 'geometry',
                stylers: [
                    { color: roadColor },
                    { saturation: roadSat },
                    { gamma: gamma }
                ]
            },
            {
                featureType: 'water',
                elementType: 'geometry',
                stylers: [
                    { color: waterColor },
                    { saturation: waterSat }
                ]
            },
            {
                elementType: 'labels.text.fill',
                stylers: [
                    { color: labelColor },
                    { lightness: labelLightness }
                ]
            }
        ];
        
        if (hidePOI) {
            style.push({ featureType: 'poi', stylers: [{ visibility: 'off' }] });
        }
        
        if (hideLabels) {
            style.push({ elementType: 'labels', stylers: [{ visibility: 'off' }] });
        }
        
        if (hideTransit) {
            style.push({ featureType: 'transit', stylers: [{ visibility: 'off' }] });
        }
        
        STATE.map.setOptions({ styles: style });
        console.log('🎨 Quick style updated');
    }

    function saveQuickStyle() {
        if (!STATE.map) return;
        
        var currentStyle = STATE.map.get('styles');
        
        var textarea = document.getElementById('custom-style-json');
        if (textarea) {
            textarea.value = JSON.stringify(currentStyle, null, 2);
        }
        
        DATA.mapStyle = 'custom';
        DATA.customMapStyle = currentStyle;
        save();
        
        console.log('✅ Quick style saved');
        showSystemMessage('Map style saved', 2000, 'success');
    }

    function resetQuickStyle() {
        document.getElementById('quick-bg-color').value = '#f5f5f5';
        document.getElementById('quick-bg-lightness').value = '20';
        document.getElementById('quick-road-color').value = '#e5e5e5';
        document.getElementById('quick-road-saturation').value = '0';
        document.getElementById('quick-water-color').value = '#c9c9c9';
        document.getElementById('quick-water-saturation').value = '0';
        document.getElementById('quick-label-color').value = '#616161';
        document.getElementById('quick-label-lightness').value = '0';
        document.getElementById('quick-gamma').value = '1.0';
        document.getElementById('quick-hide-poi').checked = false;
        document.getElementById('quick-hide-labels').checked = false;
        document.getElementById('quick-hide-transit').checked = false;
        
        updateQuickStyle();
        console.log('🔄 Quick style reset to defaults');
    }

    // ========================================================================
    // ADVANCED STYLE BUILDER
    // ========================================================================

    function toggleAdvancedBuilder() {
        var container = document.getElementById('advanced-builder-container');
        var chevron = document.querySelector('.advanced-builder-chevron');
        
        if (!container) return;
        
        if (container.classList.contains('collapsed')) {
            container.classList.remove('collapsed');
            container.classList.add('expanded');
            if (chevron) chevron.style.transform = 'rotate(180deg)';
        } else {
            container.classList.remove('expanded');
            container.classList.add('collapsed');
            if (chevron) chevron.style.transform = 'rotate(0deg)';
        }
    }

    function addStyleRule() {
        var featureType = document.getElementById('style-feature-type').value;
        var elementType = document.getElementById('style-element-type').value;
        var color = document.getElementById('style-color').value;
        var visibility = document.getElementById('style-visibility').value;
        var lightness = document.getElementById('style-lightness').value;
        var saturation = document.getElementById('style-saturation').value;
        var gamma = document.getElementById('style-gamma').value;
        var weight = document.getElementById('style-weight').value;
        var invertLightness = document.getElementById('style-invert-lightness').checked;
        
        var rule = {};
        
        if (featureType !== 'all') {
            rule.featureType = featureType;
        }
        
        if (elementType !== 'all') {
            rule.elementType = elementType;
        }
        
        var stylers = [];
        
        if (color) stylers.push({ color: color });
        if (visibility) stylers.push({ visibility: visibility });
        if (lightness) stylers.push({ lightness: parseInt(lightness) });
        if (saturation) stylers.push({ saturation: parseInt(saturation) });
        if (gamma) stylers.push({ gamma: parseFloat(gamma) });
        if (weight) stylers.push({ weight: parseFloat(weight) });
        if (invertLightness) stylers.push({ invert_lightness: true });
        
        if (stylers.length > 0) {
            rule.stylers = stylers;
        }
        
        var textarea = document.getElementById('custom-style-json');
        var existingStyle = [];
        
        if (textarea.value.trim()) {
            try {
                existingStyle = JSON.parse(textarea.value);
            } catch (e) {
                console.error('Invalid existing JSON, starting fresh');
                existingStyle = [];
            }
        }
        
        existingStyle.push(rule);
        textarea.value = JSON.stringify(existingStyle, null, 2);
        
        console.log('✅ Style rule added to JSON');
    }

    function clearStyleBuilder() {
        document.getElementById('style-feature-type').value = 'all';
        document.getElementById('style-element-type').value = 'all';
        document.getElementById('style-color').value = '#000000';
        document.getElementById('style-visibility').value = '';
        document.getElementById('style-lightness').value = '';
        document.getElementById('style-saturation').value = '';
        document.getElementById('style-gamma').value = '';
        document.getElementById('style-weight').value = '';
        document.getElementById('style-invert-lightness').checked = false;
    }

    // ========================================================================
    // MAP LAYERS
    // ========================================================================

    function toggleMapOption(option) {
        if (!STATE.map) return;
        
        switch(option) {
            case 'traffic':
                if (!trafficLayer) {
                    trafficLayer = new google.maps.TrafficLayer();
                }
                if (trafficLayer.getMap()) {
                    trafficLayer.setMap(null);
                } else {
                    trafficLayer.setMap(STATE.map);
                }
                break;
                
            case 'transit':
                if (!transitLayer) {
                    transitLayer = new google.maps.TransitLayer();
                }
                if (transitLayer.getMap()) {
                    transitLayer.setMap(null);
                } else {
                    transitLayer.setMap(STATE.map);
                }
                break;
                
            case 'bicycling':
                if (!bicyclingLayer) {
                    bicyclingLayer = new google.maps.BicyclingLayer();
                }
                if (bicyclingLayer.getMap()) {
                    bicyclingLayer.setMap(null);
                } else {
                    bicyclingLayer.setMap(STATE.map);
                }
                break;
        }
    }

    // ========================================================================
    // POLYLINE SYSTEM
    // ========================================================================

    /**
     * Create animated polyline with glass morphism style
     */
    function createStyledPolyline(path, color, opacity, animate) {
        color = color || '#000000';
        opacity = opacity !== undefined ? opacity : 1.0;
        animate = animate !== undefined ? animate : true;
        
        var polyline = new google.maps.Polyline({
            path: path,
            geodesic: true,
            strokeColor: color,
            strokeOpacity: POLYLINE_CONFIG.strokeOpacity * opacity,
            strokeWeight: POLYLINE_CONFIG.strokeWeight,
            icons: [{
                icon: {
                    path: google.maps.SymbolPath.CIRCLE,
                    scale: POLYLINE_CONFIG.iconScale,
                    fillColor: color,
                    fillOpacity: opacity,
                    strokeColor: '#ffffff',
                    strokeWeight: POLYLINE_CONFIG.iconStrokeWeight
                },
                offset: '0%',
                repeat: POLYLINE_CONFIG.iconRepeat
            }]
        });
        
        if (animate) {
            var offset = 0;
            var animationInterval = setInterval(function() {
                if (!polyline.getMap()) {
                    clearInterval(animationInterval);
                    return;
                }
                offset = (offset + POLYLINE_CONFIG.animationIncrement) % 20;
                var icons = polyline.get('icons');
                if (icons && icons[0]) {
                    icons[0].offset = offset + 'px';
                    polyline.set('icons', icons);
                }
            }, POLYLINE_CONFIG.animationSpeed);
            
            polyline.animationInterval = animationInterval;
        }
        
        return polyline;
    }

    /**
     * Create styled marker
     */
    function createStyledMarker(position, label, color) {
        color = color || '#000000';
        
        var markerConfig = {
            position: position,
            map: null,
            animation: null,
            title: '',
            icon: {
                path: google.maps.SymbolPath.CIRCLE,
                scale: 12,
                fillColor: color,
                fillOpacity: 0.9,
                strokeColor: '#ffffff',
                strokeWeight: 2
            }
        };
        
        if (label && label.length > 0) {
            markerConfig.label = {
                text: label,
                color: '#ffffff',
                fontSize: '11px',
                fontWeight: 'bold'
            };
        }
        
        var marker = new google.maps.Marker(markerConfig);
        
        // Continuous pulse animation
        var scale = 12;
        var growing = true;
        var pulseInterval = setInterval(function() {
            // Stop if marker removed from map
            if (!marker.getMap()) {
                clearInterval(pulseInterval);
                return;
            }
            if (growing) {
                scale += 0.3;
                if (scale >= 14) growing = false;
            } else {
                scale -= 0.3;
                if (scale <= 12) growing = true;
            }
            var icon = marker.getIcon();
            if (icon) {
                icon.scale = scale;
                marker.setIcon(icon);
            }
        }, 100);
        
        // Store interval for cleanup
        marker.pulseInterval = pulseInterval;
        
        return marker;
    }

    // ========================================================================
    // POLYLINE CONFIGURATION CONSTANTS
    // ========================================================================
    
    var POLYLINE_CONFIG = {
        strokeWeight: 4,
        strokeOpacity: 0.8,
        animationSpeed: 50,
        animationIncrement: 2,
        iconScale: 3,
        iconRepeat: '20px',
        iconStrokeWeight: 1
    };

    // ========================================================================
    // CORE POLYLINE FUNCTIONS
    // ========================================================================

    function showPolylineCore(type, id, geoJson, color, opacity, fitBounds, waypoints) {
        if (!geoJson || !geoJson.coordinates) return;
        
        waypoints = waypoints || [];
        
        var path = geoJson.coordinates.map(function(coord) {
            return { lat: coord[1], lng: coord[0] };
        });
        
        // Animate all polylines (queue, live, dispatch)
        var shouldAnimate = true;
        var polyline = createStyledPolyline(path, color, opacity, shouldAnimate);
        polyline.setMap(STATE.map);
        
        var markers = [];
        
        // Start marker (P)
        var startMarker = createStyledMarker(path[0], 'P', color);
        startMarker.setMap(STATE.map);
        markers.push(startMarker);
        
        // Waypoint markers
        waypoints.forEach(function(wp, idx) {
            if (wp && wp.coords && wp.coords.length === 2) {
                var waypointPos = { lat: wp.coords[1], lng: wp.coords[0] };
                var waypointMarker = createStyledMarker(waypointPos, 'W' + (idx + 1), color);
                waypointMarker.setMap(STATE.map);
                markers.push(waypointMarker);
                console.log('✅ Waypoint marker ' + (idx + 1) + ' placed at:', wp.name);
            } else {
                console.warn('⚠️ Invalid waypoint data at index ' + idx + ':', wp);
            }
        });
        
        // End marker (D)
        var endMarker = createStyledMarker(path[path.length - 1], 'D', color);
        endMarker.setMap(STATE.map);
        markers.push(endMarker);
        
        // Store in appropriate STATE location
        if (type === 'dispatch') {
            STATE.dispatchPolyline = polyline;
            STATE.dispatchMarkers = markers;
        } else if (type === 'queue') {
            STATE.queuePolylines[id] = { polyline: polyline, markers: markers };
        } else if (type === 'live') {
            STATE.livePolylines[id] = { polyline: polyline, markers: markers, color: color, opacity: opacity };
        }
        
        // Fit bounds if requested (with padding)
        if (fitBounds) {
            fitMapToPolyline(path, 15);
        }
    }

    function clearPolylineCore(type, id) {
        var layer;
        
        if (type === 'dispatch') {
            if (STATE.dispatchPolyline) STATE.dispatchPolyline.setMap(null);
            STATE.dispatchMarkers.forEach(function(m) { m.setMap(null); });
            STATE.dispatchPolyline = null;
            STATE.dispatchMarkers = [];
            return;
        } else if (type === 'queue') {
            layer = STATE.queuePolylines[id];
            if (layer) {
                layer.polyline.setMap(null);
                layer.markers.forEach(function(m) { m.setMap(null); });
                delete STATE.queuePolylines[id];
            }
        } else if (type === 'live') {
            layer = STATE.livePolylines[id];
            if (layer) {
                layer.polyline.setMap(null);
                layer.markers.forEach(function(m) { m.setMap(null); });
                delete STATE.livePolylines[id];
            }
        }
    }

    // ========================================================================
    // POLYLINE WRAPPER FUNCTIONS
    // ========================================================================

    function showDispatchPolyline(geoJson) {
        clearDispatchPolyline();
        
        // Clear click markers before showing polyline markers
        if (STATE.startMarker) {
            STATE.startMarker.setMap(null);
            STATE.startMarker = null;
        }
        if (STATE.endMarker) {
            STATE.endMarker.setMap(null);
            STATE.endMarker = null;
        }
        for (var i = 1; i <= 3; i++) {
            if (STATE['waypointMarker' + i]) {
                STATE['waypointMarker' + i].setMap(null);
                STATE['waypointMarker' + i] = null;
            }
        }
        
        // Pass waypoints from STATE.tempCalc
        var waypoints = (STATE.tempCalc && STATE.tempCalc.waypoints) ? STATE.tempCalc.waypoints : [];
        showPolylineCore('dispatch', null, geoJson, '#000000', 1.0, true, waypoints);
    }

    function clearDispatchPolyline() {
        clearPolylineCore('dispatch', null);
    }

    function showQueuePolyline(jobId, geoJson) {
        clearQueuePolyline(jobId);
        var job = DATA.queue.find(function(j) { return j.id === jobId; });
        var waypoints = (job && job.waypoints) ? job.waypoints : [];
        showPolylineCore('queue', jobId, geoJson, '#000000', 0.9, true, waypoints);
    }

    function clearQueuePolyline(jobId) {
        clearPolylineCore('queue', jobId);
    }

    function showLivePolyline(tripId, geoJson, color, isStacked) {
        clearLivePolyline(tripId);
        var trip = DATA.live.find(function(t) { return t.id === tripId; });
        var waypoints = (trip && trip.waypoints) ? trip.waypoints : [];
        var opacity = isStacked ? 0.6 : 1.0;
        var fitBounds = !STATE.showAllLiveCalls;
        showPolylineCore('live', tripId, geoJson, color, opacity, fitBounds, waypoints);
    }

    function clearLivePolyline(tripId) {
        clearPolylineCore('live', tripId);
    }

    function clearAllLivePolylines() {
        Object.keys(STATE.livePolylines).forEach(function(id) {
            clearLivePolyline(parseInt(id));
        });
    }

    // ========================================================================
    // MAP UTILITIES
    // ========================================================================
    
    /**
     * Auto-zoom map to fit polyline with padding
     */
    function fitMapToPolyline(path, paddingPercent) {
        if (!path || path.length === 0) return;
        
        paddingPercent = paddingPercent || 10;
        
        var bounds = new google.maps.LatLngBounds();
        path.forEach(function(point) {
            bounds.extend(point);
        });
        
        // Add padding by extending bounds
        var ne = bounds.getNorthEast();
        var sw = bounds.getSouthWest();
        var latRange = ne.lat() - sw.lat();
        var lngRange = ne.lng() - sw.lng();
        var padding = paddingPercent / 100;
        
        bounds.extend({
            lat: ne.lat() + (latRange * padding),
            lng: ne.lng() + (lngRange * padding)
        });
        bounds.extend({
            lat: sw.lat() - (latRange * padding),
            lng: sw.lng() - (lngRange * padding)
        });
        
        STATE.map.fitBounds(bounds);
        console.log('🗺️ Auto-zoomed map to fit polyline');
    }
    
    // ========================================================================
    // APPROACH POLYLINES
    // ========================================================================

    function showApproachPolyline(tripId) {
        var trip = DATA.live.find(function(t) { return t.id === tripId; });
        if (!trip || trip.phase !== 'approach') return;
        
        if (!trip.approachGeo || !trip.approachGeo.coordinates || trip.approachGeo.coordinates.length < 2) {
            console.warn('showApproachPolyline: No valid approachGeo for trip ' + tripId);
            return;
        }
        
        clearApproachPolyline(tripId);
        
        var path = trip.approachGeo.coordinates.map(function(c) {
            return { lat: c[1], lng: c[0] };
        });
        
        console.log('📍 Drawing approach polyline: ' + path.length + ' points');
        
        var driver = DATA.roster.find(function(d) { return d.id === trip.dr.id; });
        var driverColor = driver ? driver.color : '#000000';
        
        // Create animated approach polyline in BLACK
        var polyline = new google.maps.Polyline({
            path: path,
            geodesic: true,
            strokeColor: '#000000',
            strokeOpacity: POLYLINE_CONFIG.strokeOpacity,
            strokeWeight: POLYLINE_CONFIG.strokeWeight,
            icons: [{
                icon: {
                    path: google.maps.SymbolPath.CIRCLE,
                    scale: POLYLINE_CONFIG.iconScale,
                    fillColor: '#000000',
                    fillOpacity: 1.0,
                    strokeColor: '#ffffff',
                    strokeWeight: POLYLINE_CONFIG.iconStrokeWeight
                },
                offset: '0%',
                repeat: POLYLINE_CONFIG.iconRepeat
            }],
            map: STATE.map
        });
        
        // Animate the approach polyline
        var offset = 0;
        var animationInterval = setInterval(function() {
            if (!polyline.getMap()) {
                clearInterval(animationInterval);
                return;
            }
            offset = (offset + POLYLINE_CONFIG.animationIncrement) % 20;
            var icons = polyline.get('icons');
            if (icons && icons[0]) {
                icons[0].offset = offset + 'px';
                polyline.set('icons', icons);
            }
        }, POLYLINE_CONFIG.animationSpeed);
        polyline.animationInterval = animationInterval;
        
        var originMarker = new google.maps.Marker({
            position: path[0],
            map: STATE.map,
            animation: null,
            icon: {
                path: google.maps.SymbolPath.CIRCLE,
                scale: 10,
                fillColor: driverColor,
                fillOpacity: 0.9,
                strokeColor: '#ffffff',
                strokeWeight: 3
            },
            title: '',
            zIndex: 1001
        });
        
        var pickupMarker = new google.maps.Marker({
            position: path[path.length - 1],
            map: STATE.map,
            animation: null,
            label: {
                text: 'P',
                color: '#ffffff',
                fontSize: '11px',
                fontWeight: 'bold'
            },
            icon: {
                path: google.maps.SymbolPath.CIRCLE,
                scale: 12,
                fillColor: driverColor,
                fillOpacity: 0.9,
                strokeColor: '#ffffff',
                strokeWeight: 2
            },
            title: '',
            zIndex: 1000
        });
        
        STATE.livePolylines['approach-' + tripId] = { polyline: polyline, markers: [originMarker, pickupMarker] };
        console.log('✅ Approach polyline rendered for trip ' + tripId);
        
        // Auto-zoom map to fit approach route
        fitMapToPolyline(path, 15);
    }

    function clearApproachPolyline(tripId) {
        var key = 'approach-' + tripId;
        var layer = STATE.livePolylines[key];
        if (!layer) return;
        
        // Stop animation interval
        if (layer.polyline.animationInterval) {
            clearInterval(layer.polyline.animationInterval);
        }
        
        layer.polyline.setMap(null);
        layer.markers.forEach(function(m) { m.setMap(null); });
        delete STATE.livePolylines[key];
    }

    function showAllApproachPolylines() {
        DATA.live.forEach(function(trip) {
            if (trip.phase === 'approach' && trip.status === 'active') {
                showApproachPolyline(trip.id);
            }
        });
    }

    function clearAllApproachPolylines() {
        var keys = Object.keys(STATE.livePolylines).filter(function(k) {
            return k.indexOf('approach-') === 0;
        });
        keys.forEach(function(key) {
            var tripId = parseInt(key.replace('approach-', ''));
            clearApproachPolyline(tripId);
        });
    }

    // ========================================================================
    // DRIVER MARKERS
    // ========================================================================

    function showDriverMarker(driverId) {
        var driver = DATA.roster.find(function(d) { return d.id === driverId; });
        if (!driver) return;
        
        var trips = getDriverTrips(driverId);
        if (trips.length > 0) {
            clearDriverMarker(driverId);
            return;
        }
        
        var location = driver.currentLocation || driver.lastDrop;
        if (!location) return;
        
        clearDriverMarker(driverId);
        
        var position = new google.maps.LatLng(location.lat, location.lon);
        var marker = createStyledMarker(position, '', driver.color);
        marker.setMap(STATE.map);
        
        if (!STATE.driverLocationMarkers) STATE.driverLocationMarkers = {};
        STATE.driverLocationMarkers[driverId] = marker;
    }

    function clearDriverMarker(driverId) {
        if (!STATE.driverLocationMarkers) STATE.driverLocationMarkers = {};
        var marker = STATE.driverLocationMarkers[driverId];
        if (marker) {
            marker.setMap(null);
            delete STATE.driverLocationMarkers[driverId];
        }
    }

    function showAllDriverMarkers() {
        DATA.shift.forEach(function(driverId) {
            showDriverMarker(driverId);
        });
    }

    function clearAllDriverMarkers() {
        if (!STATE.driverLocationMarkers) return;
        Object.keys(STATE.driverLocationMarkers).forEach(function(driverId) {
            clearDriverMarker(parseInt(driverId));
        });
    }

    // ========================================================================
    // TOGGLE SHOW ALL LIVE CALLS
    // ========================================================================

    function toggleShowAllLiveCalls() {
        STATE.showAllLiveCalls = !STATE.showAllLiveCalls;
        
        if (STATE.showAllLiveCalls) {
            showAllDriverMarkers();
            
            DATA.live.forEach(function(trip) {
                showLivePolyline(trip.id, trip.geo, trip.dr.color, trip.status === 'stacked');
                
                if (trip.phase === 'approach' && trip.status === 'active') {
                    showApproachPolyline(trip.id);
                }
            });
            
            var bounds = new google.maps.LatLngBounds();
            DATA.live.forEach(function(trip) {
                if (trip.geo && trip.geo.coordinates) {
                    trip.geo.coordinates.forEach(function(coord) {
                        bounds.extend({ lat: coord[1], lng: coord[0] });
                    });
                }
            });
            if (!bounds.isEmpty()) STATE.map.fitBounds(bounds);
        } else {
            clearAllDriverMarkers();
            clearAllLivePolylines();
            clearAllApproachPolylines();
        }
        
        var btn = document.getElementById('toggle-live-calls-btn');
        if (btn) {
            btn.classList.toggle('active', STATE.showAllLiveCalls);
            btn.innerHTML = STATE.showAllLiveCalls 
                ? '<i class="fas fa-eye-slash"></i> Hide Live Calls'
                : '<i class="fas fa-eye"></i> Show Live Calls';
        }
    }

    // ========================================================================
    // GEOCODING
    // ========================================================================

    function geocodeAddress(address) {
        if (!address || address.trim() === '') return Promise.resolve([]);
        
        var searchTerm = address.toLowerCase().trim();
        
        // 1. Check Place Nicknames
        var nickname = DATA.placeNicknames.find(function(p) {
            return p.nickname.toLowerCase() === searchTerm || p.formal.toLowerCase() === searchTerm;
        });
        if (nickname) {
            console.log('📍 Found in nicknames: ' + nickname.formal);
            return Promise.resolve([{
                displayName: nickname.formal,
                lat: nickname.coords[1],
                lon: nickname.coords[0]
            }]);
        }
        
        // 2. Check Location Corrections
        var correction = DATA.corrections.find(function(c) {
            return c.search_term.toLowerCase() === searchTerm;
        });
        if (correction) {
            console.log('📍 Found in corrections: ' + correction.name);
            return Promise.resolve([{
                displayName: correction.name,
                lat: correction.lat,
                lon: correction.lon
            }]);
        }
        
        // 3. Check Address Cache
        var cached = DATA.addressCache[searchTerm];
        if (cached && (Date.now() - cached.timestamp) < CONFIG.CACHE_EXPIRY) {
            console.log('📍 Found in cache: ' + searchTerm);
            return Promise.resolve(cached.results);
        }
        
        // 4. Query Google Places API (with timeout and retry)
        return geocodeWithRetry(address, searchTerm, 2);
    }

    /**
     * Geocode with timeout and retry logic
     */
    function geocodeWithRetry(address, searchTerm, retriesLeft) {
        return new Promise(function(resolve, reject) {
            var timeoutId;
            var completed = false;
            
            // 10 second timeout
            timeoutId = setTimeout(function() {
                if (!completed) {
                    completed = true;
                    console.warn('⏱️ Geocoding timeout for: ' + address);
                    
                    if (retriesLeft > 0) {
                        console.log('🔄 Retrying... (' + retriesLeft + ' attempts left)');
                        resolve(geocodeWithRetry(address, searchTerm, retriesLeft - 1));
                    } else {
                        console.error('❌ Geocoding failed after all retries');
                        resolve([]);
                    }
                }
            }, 10000);
            
            var request = {
                query: address + ', Steinbach Manitoba',
                fields: ['name', 'geometry', 'formatted_address']
            };
            
            STATE.placesService.textSearch(request, function(results, status) {
                if (completed) return;  // Timeout already fired
                
                clearTimeout(timeoutId);
                completed = true;
                
                if (status === google.maps.places.PlacesServiceStatus.OK && results) {
                    var formatted = results.slice(0, 5).map(function(place) {
                        return {
                            displayName: place.name,
                            fullAddress: place.formatted_address || place.name,
                            lat: place.geometry.location.lat(),
                            lon: place.geometry.location.lng()
                        };
                    });
                    
                    // Cache results
                    DATA.addressCache[searchTerm] = {
                        results: formatted,
                        timestamp: Date.now()
                    };
                    save();
                    
                    console.log('📍 Found via Google Places: ' + formatted.length + ' results');
                    resolve(formatted);
                } else if (status === google.maps.places.PlacesServiceStatus.OVER_QUERY_LIMIT && retriesLeft > 0) {
                    console.warn('⚠️ Rate limit hit, retrying in 2s... (' + retriesLeft + ' attempts left)');
                    setTimeout(function() {
                        resolve(geocodeWithRetry(address, searchTerm, retriesLeft - 1));
                    }, 2000);
                } else {
                    console.log('❌ Geocoding failed: ' + status);
                    resolve([]);
                }
            });
        });
    }

    // ========================================================================
    // AUTOCOMPLETE SEARCH
    // ========================================================================

    function setupSearch(inpId, listId) {
        var input = document.getElementById(inpId);
        var list = document.getElementById(listId);
        
        if (!input || !list) return;
        
        var debounceTimer;
        
        input.addEventListener('input', function() {
            var self = this;
            clearTimeout(debounceTimer);
            var query = this.value.trim();
            
            if (query.length < 2) {
                list.innerHTML = '';
                list.style.display = 'none';
                return;
            }
            
            debounceTimer = setTimeout(function() {
                geocodeAddress(query).then(function(results) {
                    list.innerHTML = '';
                    
                    if (results.length > 0) {
                        results.forEach(function(result) {
                            addSuggestionItem(list, result.displayName, result.lat, result.lon, inpId, result.fullAddress);
                        });
                        list.style.display = 'block';
                    } else {
                        list.style.display = 'none';
                    }
                });
            }, 300);
        });
        
        // Hide suggestions when clicking outside
        document.addEventListener('click', function(e) {
            if (!input.contains(e.target) && !list.contains(e.target)) {
                list.style.display = 'none';
            }
        });
    }

    function addSuggestionItem(list, txt, lat, lon, inpId, fullAddress) {
        var item = document.createElement('div');
        item.className = 'suggestion-item';
        
        if (fullAddress && fullAddress !== txt) {
            item.innerHTML = '<strong>' + txt + '</strong><br><span style="font-size: 11px; opacity: 0.7;">' + fullAddress + '</span>';
        } else {
            item.textContent = txt;
        }
        
        item.addEventListener('click', function() {
            var input = document.getElementById(inpId);
            input.value = fullAddress || txt;
            list.style.display = 'none';
            
            input.dataset.lat = lat;
            input.dataset.lon = lon;
            
            console.log('✅ Selected: ' + txt + ' (' + lat + ', ' + lon + ')');
            
            if (inpId === 'dispatch-pickup' || inpId === 'dispatch-dropoff') {
                checkAndAutoEstimate();
            }
        });
        
        list.appendChild(item);
    }

    function checkAndAutoEstimate() {
        var pickupInput = document.getElementById('dispatch-pickup');
        var dropoffInput = document.getElementById('dispatch-dropoff');
        
        var hasPickup = pickupInput.value.trim() && pickupInput.dataset.lat && pickupInput.dataset.lon;
        var hasDropoff = dropoffInput.value.trim() && dropoffInput.dataset.lat && dropoffInput.dataset.lon;
        
        if (hasPickup && hasDropoff) {
            console.log('🔄 Auto-triggering estimate...');
            if (typeof getEstimate === 'function') {
                getEstimate();
            }
        }
    }

    // ========================================================================
    // MAP PICK MODE
    // ========================================================================

    function mapPick(mode) {
        STATE.mapMode = mode;
        STATE.map.setOptions({ draggableCursor: 'crosshair' });
        
        var clickListener = STATE.map.addListener('click', function(e) {
            var lat = e.latLng.lat();
            var lon = e.latLng.lng();
            
            if (mode.indexOf('driver-location-') === 0) {
                var driverId = parseInt(mode.replace('driver-location-', ''));
                
                STATE.geocoder.geocode({ location: { lat: lat, lng: lon } }, function(results, status) {
                    var address = (status === 'OK' && results[0]) 
                        ? results[0].formatted_address 
                        : lat.toFixed(6) + ', ' + lon.toFixed(6);
                    
                    saveDriverLocation(driverId, lat, lon, address);
                });
                
                google.maps.event.removeListener(clickListener);
                STATE.map.setOptions({ draggableCursor: null });
                STATE.mapMode = null;
                
            } else {
                STATE.geocoder.geocode({ location: { lat: lat, lng: lon } }, function(results, status) {
                    if (status === 'OK' && results[0]) {
                        setCoord(mode, lat, lon, results[0].formatted_address);
                    } else {
                        setCoord(mode, lat, lon, lat.toFixed(6) + ', ' + lon.toFixed(6));
                    }
                });
                
                google.maps.event.removeListener(clickListener);
                STATE.map.setOptions({ draggableCursor: null });
                STATE.mapMode = null;
                
                console.log('📍 Map pin selected: ' + mode + ' at ' + lat + ', ' + lon);
            }
        });
    }

    function setCoord(type, lat, lon, name) {
        var marker = new google.maps.Marker({
            position: { lat: lat, lng: lon },
            map: STATE.map,
            animation: null,
            title: name,
            icon: {
                path: google.maps.SymbolPath.CIRCLE,
                scale: 12,
                fillColor: '#000000',
                fillOpacity: 0.9,
                strokeColor: '#ffffff',
                strokeWeight: 2
            }
        });
        
        // Continuous pulse animation
        var scale = 12;
        var growing = true;
        var pulseInterval = setInterval(function() {
            // Stop if marker removed from map
            if (!marker.getMap()) {
                clearInterval(pulseInterval);
                return;
            }
            if (growing) {
                scale += 0.3;
                if (scale >= 14) growing = false;
            } else {
                scale -= 0.3;
                if (scale <= 12) growing = true;
            }
            var icon = marker.getIcon();
            if (icon) {
                icon.scale = scale;
                marker.setIcon(icon);
            }
        }, 100);
        
        // Store interval for cleanup
        marker.pulseInterval = pulseInterval;
        
        var inputId = null;
        
        if (type === 'start' || type === 'pickup') {
            if (STATE.startMarker) STATE.startMarker.setMap(null);
            STATE.startMarker = marker;
            marker.setLabel('P');
            inputId = 'dispatch-pickup';
        } else if (type === 'end' || type === 'dropoff') {
            if (STATE.endMarker) STATE.endMarker.setMap(null);
            STATE.endMarker = marker;
            marker.setLabel('D');
            inputId = 'dispatch-dropoff';
        } else if (type.indexOf('waypoint-') === 0) {
            var wpNum = parseInt(type.replace('waypoint-', ''));
            if (STATE['waypointMarker' + wpNum]) {
                STATE['waypointMarker' + wpNum].setMap(null);
            }
            STATE['waypointMarker' + wpNum] = marker;
            marker.setLabel('W');
            inputId = type + '-address';
        } else if (type === 'nickname') {
            marker.setLabel('N');
            inputId = 'nickname-address';
        }
        
        if (inputId) {
            var input = document.getElementById(inputId);
            if (input) {
                input.value = name;
                input.dataset.lat = lat;
                input.dataset.lon = lon;
                
                if (inputId === 'dispatch-pickup' || inputId === 'dispatch-dropoff') {
                    checkAndAutoEstimate();
                }
            }
        }
        
        STATE.map.panTo({ lat: lat, lng: lon });
        console.log('✅ Marker created: ' + type + ' - ' + name);
    }

    // ========================================================================
    // DRIVER LOCATION FUNCTIONS
    // ========================================================================

    function setDriverLocation(driverId) {
        STATE.mapMode = 'driver-location-' + driverId;
        STATE.activeDriverLocationId = driverId;
        showSystemMessage('Click map to set driver location', 5000);
        STATE.map.setOptions({ draggableCursor: 'crosshair' });
        mapPick(STATE.mapMode);
    }

    function saveDriverLocation(driverId, lat, lon, name) {
        var driver = DATA.roster.find(function(d) { return d.id === driverId; });
        if (!driver) return;
        
        driver.currentLocation = {
            lat: lat,
            lon: lon,
            name: name,
            timestamp: Date.now()
        };
        
        save();
        
        // Always show marker immediately when location is set
        showDriverMarker(driverId);
        
        showSystemMessage('Driver location set: ' + name, 3000);
        console.log('✅ Driver ' + driver.name + ' location: ' + name);
    }

    // ========================================================================
    // LOCATION CORRECTIONS
    // ========================================================================

    function startCorrection(target) {
        STATE.correctionMode = true;
        STATE.correctionTarget = target;
        
        alert('Click on the map to set the correct location for this address.');
        mapPick('correction');
    }

    function saveCorrection(lat, lon) {
        if (!STATE.correctionTarget) return;
        
        var address = STATE.correctionTarget;
        
        STATE.geocoder.geocode({ location: { lat: lat, lng: lon } }, function(results, status) {
            if (status === 'OK' && results[0]) {
                var correction = {
                    search_term: address.toLowerCase(),
                    lat: lat,
                    lon: lon,
                    name: results[0].formatted_address,
                    verified_date: getTodayDateString()
                };
                
                var existingIndex = DATA.corrections.findIndex(function(c) {
                    return c.search_term === correction.search_term;
                });
                
                if (existingIndex >= 0) {
                    DATA.corrections[existingIndex] = correction;
                } else {
                    DATA.corrections.push(correction);
                }
                
                save();
                if (typeof renderCorrections === 'function') renderCorrections();
                
                console.log('✅ Correction saved: ' + address + ' → ' + correction.name);
                showSystemMessage('Location correction saved', 3000, 'success');
            }
        });
        
        STATE.correctionMode = false;
        STATE.correctionTarget = null;
    }

    // ========================================================================
    // APPROACH ROUTE CALCULATION
    // ========================================================================

    function calculateApproachRoute(driverId, pickupCoords) {
        var driver = DATA.roster.find(function(d) { return d.id === driverId; });
        if (!driver) {
            return Promise.reject(new Error('Driver not found'));
        }
        
        var driverPos = driver.currentLocation || driver.lastDrop;
        if (!driverPos) {
            return Promise.reject(new Error('Driver position not set'));
        }
        
        var directionsService = new google.maps.DirectionsService();
        
        var origin = new google.maps.LatLng(driverPos.lat, driverPos.lon);
        var destination = new google.maps.LatLng(pickupCoords[1], pickupCoords[0]);
        
        return new Promise(function(resolve, reject) {
            directionsService.route({
                origin: origin,
                destination: destination,
                travelMode: google.maps.TravelMode.DRIVING,
                drivingOptions: {
                    departureTime: new Date(),
                    trafficModel: google.maps.TrafficModel.BEST_GUESS
                }
            }, function(result, status) {
                if (status === google.maps.DirectionsStatus.OK) {
                    var route = result.routes[0];
                    var leg = route.legs[0];
                    var durationSecs = (leg.duration_in_traffic ? leg.duration_in_traffic.value : leg.duration.value);
                    var durationMins = Math.max(1, Math.ceil(durationSecs / 60));
                    
                    var coordinates = [];
                    route.overview_path.forEach(function(point) {
                        coordinates.push([point.lng(), point.lat()]);
                    });
                    
                    var geo = {
                        type: 'LineString',
                        coordinates: coordinates
                    };
                    
                    console.log('✅ Approach route: ' + durationMins + ' min, ' + coordinates.length + ' points');
                    resolve({ duration: durationMins, geo: geo });
                } else {
                    reject(new Error('Directions request failed: ' + status));
                }
            });
        }).catch(function(err) {
            console.error('❌ Approach route calculation failed:', err.message);
            console.warn('⚠️ Using straight-line fallback for approach');
            
            var distance = haversineDistance(
                driverPos.lat, driverPos.lon,
                pickupCoords[1], pickupCoords[0]
            );
            var duration = Math.max(2, Math.ceil((distance / 40) * 60));
            
            var geo = {
                type: 'LineString',
                coordinates: [
                    [driverPos.lon, driverPos.lat],
                    [pickupCoords[0], pickupCoords[1]]
                ]
            };
            
            return { duration: duration, geo: geo };
        });
    }

    // ========================================================================
    // EXPOSE TO GLOBAL SCOPE
    // ========================================================================

    // Map styles
    window.MAP_STYLES = MAP_STYLES;
    
    // Map initialization
    window.initMap = initMap;
    window.initMapStyle = initMapStyle;
    window.setMapStyle = setMapStyle;
    window.applyCustomMapStyle = applyCustomMapStyle;
    window.clearCustomMapStyle = clearCustomMapStyle;
    
    // Quick style controls
    window.updateQuickStyle = updateQuickStyle;
    window.saveQuickStyle = saveQuickStyle;
    window.resetQuickStyle = resetQuickStyle;
    
    // Advanced style builder
    window.toggleAdvancedBuilder = toggleAdvancedBuilder;
    window.addStyleRule = addStyleRule;
    window.clearStyleBuilder = clearStyleBuilder;
    
    // Map layers
    window.toggleMapOption = toggleMapOption;
    
    // Polylines
    window.createStyledPolyline = createStyledPolyline;
    window.createStyledMarker = createStyledMarker;
    window.showDispatchPolyline = showDispatchPolyline;
    window.clearDispatchPolyline = clearDispatchPolyline;
    window.showQueuePolyline = showQueuePolyline;
    window.clearQueuePolyline = clearQueuePolyline;
    window.showLivePolyline = showLivePolyline;
    window.clearLivePolyline = clearLivePolyline;
    window.clearAllLivePolylines = clearAllLivePolylines;
    window.showApproachPolyline = showApproachPolyline;
    window.clearApproachPolyline = clearApproachPolyline;
    window.showAllApproachPolylines = showAllApproachPolylines;
    window.clearAllApproachPolylines = clearAllApproachPolylines;
    
    // Driver markers
    window.showDriverMarker = showDriverMarker;
    window.clearDriverMarker = clearDriverMarker;
    window.showAllDriverMarkers = showAllDriverMarkers;
    window.clearAllDriverMarkers = clearAllDriverMarkers;
    window.toggleShowAllLiveCalls = toggleShowAllLiveCalls;
    
    // Geocoding
    window.geocodeAddress = geocodeAddress;
    window.setupSearch = setupSearch;
    window.checkAndAutoEstimate = checkAndAutoEstimate;
    
    // Map pick
    window.mapPick = mapPick;
    window.setCoord = setCoord;
    
    // Driver location
    window.setDriverLocation = setDriverLocation;
    window.saveDriverLocation = saveDriverLocation;
    
    // Corrections
    window.startCorrection = startCorrection;
    window.saveCorrection = saveCorrection;
    
    // Approach route
    window.calculateApproachRoute = calculateApproachRoute;

})();