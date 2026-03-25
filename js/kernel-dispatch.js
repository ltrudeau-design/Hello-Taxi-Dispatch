// ============================================================================
// KERNEL-DISPATCH.JS
// Dispatch Form, Waypoints, Queue Management, Assignment, LLM Processing
// ============================================================================

(function() {
    'use strict';

    // ========================================================================
    // DISPATCH FORM MANAGEMENT
    // ========================================================================

    /**
     * Recall client info from phone number
     */
    function recallPickup() {
        var phone = document.getElementById('dispatch-phone').value.trim();
        if (!phone) return;
        
        var client = DATA.clients.find(function(c) { return c.phone === phone; });
        if (client) {
            document.getElementById('dispatch-name').value = client.name;
            console.log('[OK] Client recalled: ' + client.name);
        }
    }

    /**
     * Toggle manual fields visibility
     */
    function toggleManualFields() {
        var container = document.getElementById('manual-fields-container');
        var toggle = document.querySelector('.manual-fields-toggle');
        
        if (!container) return;
        
        if (container.classList.contains('collapsed')) {
            container.classList.remove('collapsed');
            container.classList.add('expanded');
            if (toggle) toggle.classList.add('active');
        } else {
            container.classList.remove('expanded');
            container.classList.add('collapsed');
            if (toggle) toggle.classList.remove('active');
        }
    }

    /**
     * Expand manual fields (called when LLM populates them)
     */
    function expandManualFields() {
        var container = document.getElementById('manual-fields-container');
        var toggle = document.querySelector('.manual-fields-toggle');
        
        if (!container) return;
        
        container.classList.remove('collapsed');
        container.classList.add('expanded');
        if (toggle) toggle.classList.add('active');
    }

    /**
     * Clear dispatch form
     */
    // Update Call Summary Widget
    function updateCallSummary() {
        var widget = document.getElementById('call-summary-widget');
        var phone = document.getElementById('dispatch-phone').value.trim();
        var name = document.getElementById('dispatch-name').value.trim();
        var pickup = document.getElementById('dispatch-pickup').value.trim();
        var dropoff = document.getElementById('dispatch-dropoff').value.trim();
        var tripName = document.getElementById('dispatch-tripname').value.trim();
        var prebookDate = document.getElementById('dispatch-prebook-date').value;
        var prebookTime = document.getElementById('dispatch-prebook-time').value;
        var prebook = (prebookDate && prebookTime) ? prebookDate + ' ' + prebookTime : '';
        var notes = document.getElementById('dispatch-notes').value.trim();
        
        // Collect waypoints
        var stops = [];
        for (var i = 0; i <= 2; i++) {
            var wpInput = document.getElementById('waypoint-' + i + '-address');
            var wpWait = document.getElementById('waypoint-' + i + '-wait');
            if (wpInput && wpInput.value.trim()) {
                var waitTime = wpWait ? parseInt(wpWait.textContent) || 0 : 0;
                stops.push(wpInput.value.trim() + (waitTime > 0 ? ' (' + waitTime + ' min wait)' : ''));
            }
        }
        
        // Update widget content (check elements exist first)
        var summaryPhone = document.getElementById('summary-phone');
        var summaryName = document.getElementById('summary-name');
        var summaryPickup = document.getElementById('summary-pickup');
        var summaryDropoff = document.getElementById('summary-dropoff');
        var summaryTripname = document.getElementById('summary-tripname');
        
        if (summaryPhone) summaryPhone.textContent = phone || '--';
        if (summaryName) summaryName.textContent = name || '--';
        if (summaryPickup) summaryPickup.textContent = pickup || '--';
        if (summaryDropoff) summaryDropoff.textContent = dropoff || '--';
        if (summaryTripname) summaryTripname.textContent = tripName || '--';
        
        // Show/hide stops row (only if waypoints exist)
        var stopsRow = document.getElementById('summary-stops-row');
        var summaryStops = document.getElementById('summary-stops');
        if (stops.length > 0 && summaryStops) {
            summaryStops.textContent = stops.join(', ');
            if (stopsRow) stopsRow.style.display = 'flex';
        } else {
            if (stopsRow) stopsRow.style.display = 'none';
        }
        
        // Always show prebook and notes (even if empty)
        var summaryPrebook = document.getElementById('summary-prebook');
        var summaryNotes = document.getElementById('summary-notes');
        if (summaryPrebook) summaryPrebook.textContent = prebook || '--';
        if (summaryNotes) summaryNotes.textContent = notes || '--';
        
        // Widget always visible (no show/hide logic)
    }
    window.updateCallSummary = updateCallSummary;

    /**
     * Initialize dispatch date/time fields to current time
     */
    function initDispatchDateTime() {
        var now = new Date();
        var year = now.getFullYear();
        var month = String(now.getMonth() + 1).padStart(2, '0');
        var day = String(now.getDate()).padStart(2, '0');
        var currentDate = year + '-' + month + '-' + day;
        var currentTime = now.toTimeString().slice(0, 5);
        
        var dateField = document.getElementById('dispatch-prebook-date');
        var timeField = document.getElementById('dispatch-prebook-time');
        
        if (dateField) dateField.value = currentDate;
        if (timeField) timeField.value = currentTime;
        
        console.log('[OK] Dispatch date/time initialized to: ' + currentDate + ' ' + currentTime);
    }
    window.initDispatchDateTime = initDispatchDateTime;

    function clearForm() {
        document.getElementById('dispatch-phone').value = '';
        document.getElementById('dispatch-name').value = '';
        document.getElementById('dispatch-tripname').value = '';
        document.getElementById('dispatch-pickup').value = '';
        document.getElementById('dispatch-dropoff').value = '';
        document.getElementById('dispatch-notes').value = '';
        
        // Reset date/time to current
        initDispatchDateTime();
        
        // Clear data attributes
        document.getElementById('dispatch-pickup').dataset.lat = '';
        document.getElementById('dispatch-pickup').dataset.lon = '';
        document.getElementById('dispatch-dropoff').dataset.lat = '';
        document.getElementById('dispatch-dropoff').dataset.lon = '';
        
        // Clear waypoints
        document.getElementById('waypoints-container').innerHTML = '';
        STATE.waypointCount = 0;
        
        // Reset estimate box to default state (always visible now)
        if (typeof clearDispatchEstimate === 'function') {
            clearDispatchEstimate();
        }
        
        // Clear map markers
        if (STATE.startMarker) {
            STATE.startMarker.setMap(null);
            STATE.startMarker = null;
        }
        if (STATE.endMarker) {
            STATE.endMarker.setMap(null);
            STATE.endMarker = null;
        }
        
        // Clear waypoint markers
        for (var i = 1; i <= 3; i++) {
            if (STATE['waypointMarker' + i]) {
                STATE['waypointMarker' + i].setMap(null);
                STATE['waypointMarker' + i] = null;
            }
        }
        
        // Clear temp polyline
        if (STATE.tempLayer) {
            STATE.tempLayer.setMap(null);
            STATE.tempLayer = null;
        }
        
        // Clear dispatch polyline
        clearDispatchPolyline();
        
        STATE.tempCalc = null;
        
        console.log('[OK] Form cleared');
    }

    /**
     * Refresh form (keep client info)
     */
    function refreshDispatchForm() {
        var phone = document.getElementById('dispatch-phone').value;
        var name = document.getElementById('dispatch-name').value;
        
        clearForm();
        
        document.getElementById('dispatch-phone').value = phone;
        document.getElementById('dispatch-name').value = name;
        
        console.log('[OK] Form refreshed');
    }

    // ========================================================================
    // WAYPOINT MANAGEMENT
    // ========================================================================

    /**
     * Add waypoint to form
     */
    function addWaypoint() {
        if (STATE.waypointCount >= 3) {
            alert('Maximum 3 waypoints allowed');
            return;
        }
        
        STATE.waypointCount++;
        var container = document.getElementById('waypoints-container');
        var wpNum = STATE.waypointCount;
        
        var waypointCard = document.createElement('div');
        waypointCard.className = 'waypoint-card';
        waypointCard.id = 'waypoint-' + wpNum;
        waypointCard.innerHTML = 
            '<div class="waypoint-header">' +
                '<span class="waypoint-label">Stop ' + wpNum + '</span>' +
                '<button class="btn btn-sm btn-danger" onclick="clearWaypoint(' + wpNum + ')">' +
                    '<i class="fas fa-times"></i>' +
                '</button>' +
            '</div>' +
            '<div style="display: flex; gap: 8px; position: relative;">' +
                '<input type="text" id="waypoint-' + wpNum + '-address" class="form-input" placeholder="Enter waypoint address" style="flex: 1;">' +
                '<button class="btn btn-sm" onclick="mapPick(\'waypoint-' + wpNum + '\')" title="Pick on map">' +
                    '<i class="fas fa-map-marker-alt"></i>' +
                '</button>' +
                '<div id="waypoint-' + wpNum + '-suggestions" class="suggestions" style="display: none;"></div>' +
            '</div>' +
            '<div class="wait-time-controls">' +
                '<span style="font-size: 12px; color: rgba(255,255,255,0.7);">Wait Time:</span>' +
                '<button class="btn btn-sm" onclick="adjustWaitTime(' + wpNum + ', -5)">' +
                    '<i class="fas fa-minus"></i>' +
                '</button>' +
                '<div class="wait-time-display" id="waypoint-' + wpNum + '-wait" data-wait="0">0 min</div>' +
                '<button class="btn btn-sm" onclick="adjustWaitTime(' + wpNum + ', 5)">' +
                    '<i class="fas fa-plus"></i>' +
                '</button>' +
            '</div>';
        
        container.appendChild(waypointCard);
        
        // Setup autocomplete for this waypoint
        setupSearch('waypoint-' + wpNum + '-address', 'waypoint-' + wpNum + '-suggestions');
        
        console.log('[OK] Waypoint ' + wpNum + ' added');
    }

    /**
     * Clear specific waypoint and renumber remaining waypoints
     */
    function clearWaypoint(index) {
        var card = document.getElementById('waypoint-' + index);
        if (!card) return;
        
        // Clear associated marker
        if (STATE['waypointMarker' + index]) {
            STATE['waypointMarker' + index].setMap(null);
            STATE['waypointMarker' + index] = null;
        }
        
        card.remove();
        STATE.waypointCount--;
        
        // Renumber remaining waypoints
        var container = document.getElementById('waypoints-container');
        var remainingCards = container.querySelectorAll('.waypoint-card');
        
        remainingCards.forEach(function(wpCard, newIndex) {
            var newNum = newIndex + 1;
            var oldId = wpCard.id;
            var oldNum = parseInt(oldId.replace('waypoint-', ''));
            
            if (oldNum !== newNum) {
                // Update card ID
                wpCard.id = 'waypoint-' + newNum;
                
                // Update label
                var label = wpCard.querySelector('.waypoint-label');
                if (label) label.textContent = 'Stop ' + newNum;
                
                // Update input IDs and references
                var addressInput = wpCard.querySelector('[id^="waypoint-"][id$="-address"]');
                if (addressInput) {
                    addressInput.id = 'waypoint-' + newNum + '-address';
                }
                
                var suggestions = wpCard.querySelector('[id^="waypoint-"][id$="-suggestions"]');
                if (suggestions) {
                    suggestions.id = 'waypoint-' + newNum + '-suggestions';
                }
                
                var waitDisplay = wpCard.querySelector('[id^="waypoint-"][id$="-wait"]');
                if (waitDisplay) {
                    waitDisplay.id = 'waypoint-' + newNum + '-wait';
                }
                
                // Update button onclick handlers
                var deleteBtn = wpCard.querySelector('.btn-danger');
                if (deleteBtn) {
                    deleteBtn.setAttribute('onclick', 'clearWaypoint(' + newNum + ')');
                }
                
                var minusBtn = wpCard.querySelector('[onclick*="adjustWaitTime"][onclick*="-5"]');
                if (minusBtn) {
                    minusBtn.setAttribute('onclick', 'adjustWaitTime(' + newNum + ', -5)');
                }
                
                var plusBtn = wpCard.querySelector('[onclick*="adjustWaitTime"][onclick*="5"]');
                if (plusBtn && !plusBtn.getAttribute('onclick').includes('-5')) {
                    plusBtn.setAttribute('onclick', 'adjustWaitTime(' + newNum + ', 5)');
                }
                
                var mapBtn = wpCard.querySelector('[onclick*="mapPick"]');
                if (mapBtn) {
                    mapBtn.setAttribute('onclick', "mapPick('waypoint-" + newNum + "')");
                }
                
                // Reassign marker reference
                if (STATE['waypointMarker' + oldNum]) {
                    STATE['waypointMarker' + newNum] = STATE['waypointMarker' + oldNum];
                    STATE['waypointMarker' + oldNum] = null;
                }
            }
        });
        
        console.log('[OK] Waypoint ' + index + ' cleared, remaining waypoints renumbered');
    }

    /**
     * Adjust wait time for waypoint
     */
    function adjustWaitTime(index, delta) {
        var display = document.getElementById('waypoint-' + index + '-wait');
        if (!display) return;
        
        var currentWait = parseInt(display.dataset.wait) || 0;
        var newWait = Math.max(0, Math.min(60, currentWait + delta));
        
        display.textContent = newWait + ' min';
        display.dataset.wait = newWait;
    }

    /**
     * Add return trip (set dropoff = pickup)
     */
    function addReturnTrip() {
        var pickup = document.getElementById('dispatch-pickup').value;
        var pickupLat = document.getElementById('dispatch-pickup').dataset.lat;
        var pickupLon = document.getElementById('dispatch-pickup').dataset.lon;
        
        if (!pickup) {
            alert('Please enter pickup location first');
            return;
        }
        
        document.getElementById('dispatch-dropoff').value = pickup;
        document.getElementById('dispatch-dropoff').dataset.lat = pickupLat;
        document.getElementById('dispatch-dropoff').dataset.lon = pickupLon;
        
        console.log('[OK] Return trip set');
    }

    // ========================================================================
    // ROUTE ESTIMATION
    // ========================================================================

    /**
     * Get estimate using Google Directions API
     */
    function getEstimate() {
        var pickup = document.getElementById('dispatch-pickup').value.trim();
        var dropoff = document.getElementById('dispatch-dropoff').value.trim();
        var pickupLat = parseFloat(document.getElementById('dispatch-pickup').dataset.lat);
        var pickupLon = parseFloat(document.getElementById('dispatch-pickup').dataset.lon);
        var dropoffLat = parseFloat(document.getElementById('dispatch-dropoff').dataset.lat);
        var dropoffLon = parseFloat(document.getElementById('dispatch-dropoff').dataset.lon);
        
        // Validation
        if (!pickup || !dropoff) {
            alert('Please enter pickup and dropoff locations');
            return Promise.resolve();
        }
        
        if (!pickupLat || !pickupLon || !dropoffLat || !dropoffLon) {
            alert('Please select locations from suggestions or use map pin');
            return Promise.resolve();
        }
        
        console.log('[MAP] Calculating route...');
        
        // Build waypoints array
        var waypoints = [];
        for (var i = 1; i <= STATE.waypointCount; i++) {
            var wpCard = document.getElementById('waypoint-' + i);
            if (!wpCard) continue;
            
            var wpAddress = document.getElementById('waypoint-' + i + '-address').value.trim();
            var wpLat = parseFloat(document.getElementById('waypoint-' + i + '-address').dataset.lat);
            var wpLon = parseFloat(document.getElementById('waypoint-' + i + '-address').dataset.lon);
            var wpWait = parseInt(document.getElementById('waypoint-' + i + '-wait').dataset.wait) || 0;
            
            if (wpAddress && wpLat && wpLon) {
                waypoints.push({
                    location: new google.maps.LatLng(wpLat, wpLon),
                    stopover: true,
                    coords: [wpLon, wpLat],
                    name: wpAddress,
                    waitTime: wpWait
                });
            }
        }
        
        // Build Directions request
        var request = {
            origin: new google.maps.LatLng(pickupLat, pickupLon),
            destination: new google.maps.LatLng(dropoffLat, dropoffLon),
            waypoints: waypoints.map(function(wp) {
                return { location: wp.location, stopover: wp.stopover };
            }),
            travelMode: google.maps.TravelMode.DRIVING,
            drivingOptions: {
                departureTime: new Date(),
                trafficModel: google.maps.TrafficModel.BEST_GUESS
            }
        };
        
        var directionsService = new google.maps.DirectionsService();
        
        return new Promise(function(resolve, reject) {
            directionsService.route(request, function(result, status) {
                if (status === 'OK') {
                    resolve(result);
                } else {
                    reject(status);
                }
            });
        }).then(function(result) {
            var route = result.routes[0];
            var leg = route.legs[0];
            
            // Calculate total duration
            var totalDuration = 0;
            route.legs.forEach(function(l) {
                totalDuration += l.duration.value;
            });
            
            // Add wait times
            waypoints.forEach(function(wp) {
                totalDuration += wp.waitTime * 60;
            });
            
            var mins = Math.ceil(totalDuration / 60);
            var distance = (leg.distance.value / 1000).toFixed(1);
            
            // Store in STATE.tempCalc
            STATE.tempCalc = {
                geo: {
                    type: 'LineString',
                    coordinates: route.overview_path.map(function(p) {
                        return [p.lng(), p.lat()];
                    })
                },
                mins: mins,
                minsWithTraffic: mins,
                s: [pickupLon, pickupLat],
                e: [dropoffLon, dropoffLat],
                sN: pickup,
                eN: dropoff,
                waypoints: waypoints.map(function(wp) {
                    return {
                        coords: wp.coords,
                        name: wp.name,
                        waitTime: wp.waitTime
                    };
                }),
                pickupQuote: null
            };
            
            // Clear click markers before showing estimate polyline
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
            
            // Use standard dispatch polyline (follows POLYLINE_CONFIG)
            var geoJson = {
                type: 'LineString',
                coordinates: route.overview_path.map(function(p) {
                    return [p.lng(), p.lat()];
                })
            };
            
            showDispatchPolyline(geoJson);
            
            // Record traffic data
            if (leg.duration && leg.duration_in_traffic) {
                TrafficService.recordDelayFactor(
                    leg.duration_in_traffic.value,
                    leg.duration.value
                );
            }
            
            // Get enhanced ETA from LLM
            var customerPhone = document.getElementById('dispatch-phone').value.trim();
            
            // Check for prebook time
            var prebookDate = document.getElementById('dispatch-prebook-date').value;
            var prebookTime = document.getElementById('dispatch-prebook-time').value;
            var prebookDateTime = null;
            if (prebookDate && prebookTime) {
                prebookDateTime = prebookDate + 'T' + prebookTime;
            }
            
            return LLMTimingService.getTaxiETA(
                [pickupLon, pickupLat],
                [dropoffLon, dropoffLat],
                mins,
                customerPhone,
                prebookDateTime
            ).then(function(llmETA) {
                // Check if tempCalc still exists (user might have cleared form)
                if (!STATE.tempCalc) {
                    console.log('[INFO] Route calculation completed but form was cleared');
                    return;
                }
                
                STATE.tempCalc.pickupQuote = llmETA;
                
                // Display enhanced estimate using structured elements
                var estimateBox = document.getElementById('estimate-box');
                var etaValueEl = document.getElementById('estimate-eta-value');
                var tripValueEl = document.getElementById('estimate-trip-value');
                var fareValueEl = document.getElementById('estimate-fare-value');
                var sourceEl = document.getElementById('estimate-source');
                var routeEl = document.getElementById('estimate-route');
                var routeTextEl = document.getElementById('estimate-route-text');
                
                var confidenceStyles = {
                    high: { bg: 'rgba(39, 174, 96, 0.15)', border: 'rgba(39, 174, 96, 0.4)', text: '#2ecc71' },
                    medium: { bg: 'rgba(241, 196, 15, 0.15)', border: 'rgba(241, 196, 15, 0.4)', text: '#f1c40f' },
                    low: { bg: 'rgba(231, 76, 60, 0.15)', border: 'rgba(231, 76, 60, 0.4)', text: '#e74c3c' }
                };
                
                var isPrebookedDisplay = llmETA.isPrebooked || llmETA.scheduledPickup;
                var fareEstimate = Math.round(4 + (parseFloat(distance) * 2));
                var confStyle = confidenceStyles[llmETA.confidence] || confidenceStyles.medium;
                
                // Update Pickup ETA
                if (etaValueEl) {
                    if (isPrebookedDisplay) {
                        etaValueEl.textContent = 'PREBOOK';
                        etaValueEl.style.color = '#3498db';
                    } else {
                        etaValueEl.textContent = llmETA.quotedMinutes + ' min';
                        etaValueEl.style.color = confStyle.text;
                    }
                }
                
                // Update Trip Time
                if (tripValueEl) {
                    tripValueEl.textContent = mins + ' min';
                    tripValueEl.style.color = '#fff';
                }
                
                // Fare estimate removed from UI
                
                // Update source/confidence badge
                if (sourceEl) {
                    if (isPrebookedDisplay) {
                        var pickupTimeStr = (llmETA.scheduledPickup || prebookDateTime).replace('T', ' ');
                        sourceEl.textContent = pickupTimeStr;
                        sourceEl.style.background = 'rgba(52, 152, 219, 0.3)';
                        sourceEl.style.color = '#3498db';
                    } else {
                        var driverInfo = llmETA.suggestedDriver ? ' • ' + llmETA.suggestedDriver : '';
                        sourceEl.textContent = llmETA.confidence + ' confidence' + driverInfo;
                        sourceEl.style.background = confStyle.bg;
                        sourceEl.style.color = confStyle.text;
                    }
                }
                
                // Update route info
                if (routeEl && routeTextEl) {
                    var routeInfo = distance + ' km';
                    if (llmETA.breakdown) {
                        routeInfo += ' • Driver: ' + llmETA.breakdown.driverApproach + 'm';
                        if (llmETA.breakdown.trafficBuffer > 0) routeInfo += ' • Traffic: +' + llmETA.breakdown.trafficBuffer + 'm';
                        if (llmETA.breakdown.weatherBuffer > 0) routeInfo += ' • Weather: +' + llmETA.breakdown.weatherBuffer + 'm';
                    }
                    if (llmETA.reasoning) {
                        routeInfo += ' — ' + llmETA.reasoning.substring(0, 60) + (llmETA.reasoning.length > 60 ? '...' : '');
                    }
                    if (llmETA.llmFallback) {
                        routeInfo += ' • AI offline';
                    }
                    routeTextEl.textContent = routeInfo;
                    routeEl.style.display = 'block';
                }
                
                // Update box styling based on confidence
                if (estimateBox) {
                    estimateBox.style.background = confStyle.bg;
                    estimateBox.style.borderColor = confStyle.border;
                }
                
                // Show dispatch polyline
                showDispatchPolyline(STATE.tempCalc.geo);
                
                console.log('[OK] Route calculated: ' + mins + ' min, ' + distance + ' km');
                console.log('[OK] Enhanced ETA: ' + llmETA.quotedMinutes + 'min (' + llmETA.confidence + ')');
                
                // Update Call Summary widget
                updateCallSummary();
            });
            
        }).catch(function(error) {
            console.error('[ERR] Route calculation failed:', error);
            alert('Failed to calculate route. Please check addresses.');
        });
    }

    // ========================================================================
    // JOB CREATION & QUEUE
    // ========================================================================

    /**
     * Create job object from form
     */
    function createJobObj() {
        if (!STATE.tempCalc) {
            throw new Error('No route calculated. Please get estimate first.');
        }
        
        var phone = document.getElementById('dispatch-phone').value.trim();
        var name = document.getElementById('dispatch-name').value.trim();
        var tripName = document.getElementById('dispatch-tripname').value.trim();
        var notes = document.getElementById('dispatch-notes').value.trim();
        var prebookDate = document.getElementById('dispatch-prebook-date').value;
        var prebookTime = document.getElementById('dispatch-prebook-time').value;
        
        var prebook = null;
        if (prebookDate && prebookTime) {
            // Check if prebook is in the future
            var prebookDateTime = new Date(prebookDate + 'T' + prebookTime);
            var now = new Date();
            if (prebookDateTime > now) {
                prebook = prebookDate + 'T' + prebookTime;
            }
        }
        
        var job = {
            id: Date.now(),
            ts: Date.now(),
            cName: name || 'Anonymous',
            cPhone: phone || '',
            tripName: tripName || generateSimplifiedTripName(STATE.tempCalc.sN, STATE.tempCalc.eN),
            prebook: prebook,
            notes: notes,
            buffer: 0,
            geo: STATE.tempCalc.geo,
            mins: STATE.tempCalc.mins,
            minsWithTraffic: STATE.tempCalc.minsWithTraffic,
            s: STATE.tempCalc.s,
            e: STATE.tempCalc.e,
            sN: STATE.tempCalc.sN,
            eN: STATE.tempCalc.eN,
            waypoints: STATE.tempCalc.waypoints,
            pickupQuote: STATE.tempCalc.pickupQuote
        };
        
        return job;
    }

    /**
     * Add job to queue
     */
    function addToQueue() {
        try {
            var job = createJobObj();
            
            DATA.queue.push(job);
            save();
            updateBadges();
            
            // Clear dispatch polyline and markers AFTER adding to queue
            // (They should persist until this point)
            setTimeout(function() {
                clearDispatchPolyline();
                
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
            }, 100); // Small delay to keep them visible momentarily
            
            console.log('[OK] Job added to queue: ' + job.tripName);
            showSystemMessage('Trip added to queue', 3000, 'success');
            
            // Refresh queue display
            renderQueue();
            
            // Session Notes autopopulate DISABLED per user request
            // generateCallSummaryToNotes(job);
            
            // Check if client exists, auto-save if new
            if (job.cPhone && job.cName && job.cName !== 'Anonymous') {
                promptSaveNewClient(job.cPhone, job.cName);
            }
            
            // Clear form
            clearForm();
            
        } catch (error) {
            console.error('[ERR] Failed to add to queue:', error);
            alert(error.message);
        }
    }

    /**
     * Prompt to save new client to database
     */
    function promptSaveNewClient(phone, name) {
        if (!phone || !name) return;
        
        var existingClient = DATA.clients.find(function(c) { return c.phone === phone; });
        
        if (existingClient) {
            console.log('[INFO] Client already in database: ' + existingClient.name);
            return;
        }
        
        var newClient = {
            id: Date.now(),
            phone: phone,
            name: name,
            notes: '',
            locations: []
        };
        
        DATA.clients.push(newClient);
        save();
        if (typeof renderClients === 'function') renderClients();
        showSystemMessage('Client saved: ' + name, 3000, 'success');
        
        console.log('[OK] Client saved to database: ' + name);
    }

    /**
     * Quick-add client from dispatch
     */
    function addClientFromDispatch() {
        var phone = document.getElementById('dispatch-phone').value.trim();
        var name = document.getElementById('dispatch-name').value.trim();
        
        if (!phone || !name) {
            alert('Please enter phone and name');
            return;
        }
        
        var existing = DATA.clients.find(function(c) { return c.phone === phone; });
        if (existing) {
            alert('Client already exists');
            return;
        }
        
        var newClient = {
            id: Date.now(),
            phone: phone,
            name: name,
            notes: '',
            locations: []
        };
        
        DATA.clients.push(newClient);
        save();
        
        console.log('[OK] Client added: ' + name);
        alert('Client added to database');
    }

    // ========================================================================
    // QUEUE RENDERING
    // ========================================================================

    /**
     * Render queue list
     */
    function renderQueue() {
        var container = document.getElementById('queue-content');
        if (!container) return;
        
        container.innerHTML = '';
        
        if (DATA.queue.length === 0) {
            container.innerHTML = 
                '<div class="text-center" style="padding: 40px 20px; color: rgba(255, 255, 255, 0.5);">' +
                    '<i class="fas fa-list fa-3x mb-2" style="opacity: 0.3;"></i>' +
                    '<p>No pending trips</p>' +
                '</div>';
            return;
        }
        
        // Sort by prebook time first, then creation time
        var sortedQueue = DATA.queue.slice().sort(function(a, b) {
            if (a.prebook && b.prebook) {
                return new Date(a.prebook).getTime() - new Date(b.prebook).getTime();
            }
            if (a.prebook && !b.prebook) return 1;
            if (!a.prebook && b.prebook) return -1;
            return a.ts - b.ts;
        });
        
        sortedQueue.forEach(function(job) {
            var card = buildQueueCard(job);
            container.appendChild(card);
        });
        
        console.log('[OK] Queue rendered: ' + DATA.queue.length + ' trips');
    }

    /**
     * Build queue card element
     */
    /**
     * Format time with fixed width (always 2-digit hour)
     */
    function formatTimeFixed(date) {
        var hours = date.getHours();
        var minutes = date.getMinutes();
        var ampm = hours >= 12 ? 'PM' : 'AM';
        hours = hours % 12;
        hours = hours ? hours : 12;
        var hoursStr = String(hours).padStart(2, ' ');
        var minutesStr = String(minutes).padStart(2, '0');
        return hoursStr + ':' + minutesStr + ' ' + ampm;
    }
    
    /**
     * Calculate ETA time display for queue card
     */
    function calculateETATime(job) {
        var now = Date.now();
        
        if (job.prebook) {
            // For prebooks, ETA is the prebook time
            return formatTimeFixed(new Date(job.prebook));
        }
        
        // For ASAP calls, calculate ETA based on pickup quote
        var etaMins = 10; // Default
        if (job.pickupQuote && job.pickupQuote.quotedMinutes) {
            etaMins = job.pickupQuote.quotedMinutes;
        } else if (typeof calculatePickupQuote === 'function' && job.s) {
            var quote = calculatePickupQuote(job.s);
            etaMins = quote.quotedMinutes;
        }
        
        var etaTime = new Date(now + (etaMins * 60000));
        return formatTimeFixed(etaTime);
    }
    
    /**
     * Format address for display - remove postal codes and country
     */
    function formatAddressForDisplay(address) {
        if (!address) return '';
        
        // Remove postal code patterns (Canada: A1A 1A1, US: 12345 or 12345-6789)
        var cleaned = address.replace(/[A-Z]\d[A-Z]\s*\d[A-Z]\d/gi, '');
        cleaned = cleaned.replace(/\d{5}(-\d{4})?/g, '');
        
        // Remove country
        cleaned = cleaned.replace(/,\s*Canada\s*$/i, '');
        cleaned = cleaned.replace(/,\s*United States\s*$/i, '');
        cleaned = cleaned.replace(/,\s*USA\s*$/i, '');
        
        // Clean up extra commas and whitespace
        cleaned = cleaned.replace(/,\s*,/g, ',');
        cleaned = cleaned.replace(/,\s*$/g, '');
        cleaned = cleaned.trim();
        
        return cleaned;
    }
    
    /**
     * Generate simplified trip name from addresses
     * Keeps street numbers + abbreviates street suffixes
     */
    function generateSimplifiedTripName(pickupAddr, dropoffAddr) {
        if (!pickupAddr || !dropoffAddr) return '';

        // Helper to extract simplified location
        function simplifyAddress(addr) {
            if (!addr) return '';

            // First clean the address
            var cleaned = formatAddressForDisplay(addr);

            // Split by comma
            var parts = cleaned.split(',').map(function(p) { return p.trim(); });

            // Take first part (usually street address or business name)
            var simplified = parts[0] || '';

            // Abbreviate common street suffixes (keep street numbers!)
            simplified = simplified.replace(/\bStreet\b/gi, 'St');
            simplified = simplified.replace(/\bAvenue\b/gi, 'Ave');
            simplified = simplified.replace(/\bBoulevard\b/gi, 'Blvd');
            simplified = simplified.replace(/\bDrive\b/gi, 'Dr');
            simplified = simplified.replace(/\bRoad\b/gi, 'Rd');
            simplified = simplified.replace(/\bLane\b/gi, 'Ln');
            simplified = simplified.replace(/\bCourt\b/gi, 'Ct');
            simplified = simplified.replace(/\bCircle\b/gi, 'Cir');
            simplified = simplified.replace(/\bHighway\b/gi, 'Hwy');
            simplified = simplified.replace(/\bCrescent\b/gi, 'Cres');

            return simplified;
        }

        var pickup = simplifyAddress(pickupAddr);
        var dropoff = simplifyAddress(dropoffAddr);

        if (!pickup || !dropoff) {
            // Fallback to cleaned full addresses
            return formatAddressForDisplay(pickupAddr) + ' to ' + formatAddressForDisplay(dropoffAddr);
        }

        return pickup + ' → ' + dropoff;
    }
    window.generateSimplifiedTripName = generateSimplifiedTripName;
    
    function buildQueueCard(job) {
        var card = document.createElement('div');
        card.className = 'queue-card';
        card.id = 'queue-card-' + job.id;
        
        // Add urgency classes for prebooks
        if (job.prebook) {
            var prebookTime = new Date(job.prebook).getTime();
            var remainingMs = prebookTime - Date.now();
            var remainingMins = remainingMs / 60000;
            
            if (remainingMins <= 0) {
                card.classList.add('prebook-urgent');
            } else if (remainingMins <= 15) {
                card.classList.add('prebook-urgent');
            } else if (remainingMins <= 30) {
                card.classList.add('prebook-warning');
            }
        }
        
        // Calculate timer display
        var waitingDisplay = '';
        var timerLabel = 'Waiting';
        
        if (job.prebook) {
            var prebookTime = new Date(job.prebook).getTime();
            var remainingMs = prebookTime - Date.now();
            
            if (remainingMs <= 0) {
                waitingDisplay = '00:00';
            } else {
                waitingDisplay = formatTimeMMSS(remainingMs);
            }
            timerLabel = 'Until Pickup';
        } else {
            var waitingMs = Date.now() - job.ts;
            waitingDisplay = formatTimeMMSS(waitingMs);
            timerLabel = 'Waiting';
        }
        
        // Build route display with cleaned addresses
        var pickupClean = formatAddressForDisplay(job.sN);
        var dropoffClean = formatAddressForDisplay(job.eN);
        var routeDisplay = pickupClean + ' → ' + dropoffClean;
        
        if (job.waypoints && job.waypoints.length > 0) {
            var waypointNames = job.waypoints.map(function(wp) { 
                return formatAddressForDisplay(wp.name); 
            }).join(' → ');
            routeDisplay = pickupClean + ' → ' + waypointNames + ' → ' + dropoffClean;
        }
        
        // Prebook badge
        var prebookBadge = '';
        if (job.prebook) {
            var prebookDate = new Date(job.prebook);
            var prebookStr = prebookDate.toLocaleString('en-US', {
                month: 'short',
                day: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
                hour12: true
            });
            prebookBadge = '<div class="prebook-badge"><i class="fas fa-calendar-alt"></i> ' + prebookStr + '</div>';
        }
        
        // Build waypoint details
        var waypointDetails = '';
        if (job.waypoints && job.waypoints.length > 0) {
            job.waypoints.forEach(function(wp, idx) {
                var waitNote = wp.waitTime > 0 ? ' (' + wp.waitTime + ' min wait)' : '';
                waypointDetails += 
                    '<div class="queue-detail-row">' +
                        '<div class="queue-detail-label">Stop ' + (idx + 1) + waitNote + '</div>' +
                        '<div class="queue-detail-value">' + wp.name + '</div>' +
                    '</div>';
            });
        }
        
        card.innerHTML = 
            prebookBadge +
            '<div class="queue-card-header">' +
                '<div class="queue-client-info">' +
                    '<div class="queue-trip-name">' + job.tripName + '</div>' +
                    '<div class="queue-client-name">' + job.cName + '</div>' +
                    '<div class="queue-client-phone">' + job.cPhone + '</div>' +
                '</div>' +
                '<div class="queue-timer-panel">' +
                    '<table class="queue-time-table">' +
                        '<tr><td class="queue-time-label">Made</td><td class="queue-time-value">' + formatTimeFixed(new Date(job.ts)) + '</td></tr>' +
                        '<tr><td class="queue-time-label">ETA</td><td class="queue-time-value">' + calculateETATime(job) + '</td></tr>' +
                    '</table>' +
                    '<div class="queue-timer-value" id="queue-timer-' + job.id + '">' + waitingDisplay + '</div>' +
                    '<div class="queue-timer-label">' + timerLabel + '</div>' +
                '</div>' +
            '</div>' +
            '<div class="queue-route" style="font-size: 11px; opacity: 0.7;">' + routeDisplay + '</div>' +
            '<div class="queue-details" id="queue-details-' + job.id + '">' +
                '<div class="queue-detail-row">' +
                    '<div class="queue-detail-label">Trip Name</div>' +
                    '<div class="queue-detail-value">' + (job.tripName || 'N/A') + '</div>' +
                '</div>' +
                '<div class="queue-detail-row">' +
                    '<div class="queue-detail-label">Pickup</div>' +
                    '<div class="queue-detail-value">' + job.sN + '</div>' +
                '</div>' +
                waypointDetails +
                '<div class="queue-detail-row">' +
                    '<div class="queue-detail-label">Dropoff</div>' +
                    '<div class="queue-detail-value">' + job.eN + '</div>' +
                '</div>' +
                '<div class="queue-detail-row">' +
                    '<div class="queue-detail-label">Trip Duration</div>' +
                    '<div class="queue-detail-value">' + job.mins + ' minutes</div>' +
                '</div>' +
                (job.pickupQuote ? 
                    '<div class="queue-detail-row">' +
                        '<div class="queue-detail-label">Pickup ETA</div>' +
                        '<div class="queue-detail-value">' + job.pickupQuote.quotedMinutes + ' minutes</div>' +
                    '</div>' : '') +
                (job.notes ? 
                    '<div class="queue-notes">' +
                        '<i class="fas fa-sticky-note"></i> ' + job.notes +
                    '</div>' : '') +
                '<div class="queue-meta">' +
                    'Created: ' + new Date(job.ts).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }) +
                '</div>' +
                '<div class="queue-actions">' +
                    '<button class="btn btn-sm btn-success" onclick="assignDriver(' + job.id + ')">' +
                        '<i class="fas fa-user-plus"></i> Assign Driver' +
                    '</button>' +
                    '<button class="btn btn-sm" onclick="event.stopPropagation(); copyTripSMSById(' + job.id + ', \'queue\')">' +
                        '<i class="fas fa-copy"></i> Copy SMS' +
                    '</button>' +
                    '<button class="btn btn-sm" onclick="editQueueTrip(' + job.id + ')">' +
                        '<i class="fas fa-edit"></i> Edit' +
                    '</button>' +
                    '<button class="btn btn-sm btn-danger" onclick="deleteQueueTrip(' + job.id + ')">' +
                        '<i class="fas fa-trash"></i> Delete' +
                    '</button>' +
                '</div>' +
            '</div>';
        
        // Add click handler
        card.addEventListener('click', function(e) {
            if (e.target.closest('button')) return;
            
            if (STATE.assignmentMode && STATE.assignmentJobId === job.id) {
                cancelAssignment();
            } else {
                toggleQueueCard(job.id);
            }
        });
        
        return card;
    }

    /**
     * Toggle queue card expansion
     */
    function toggleQueueCard(jobId) {
        var details = document.getElementById('queue-details-' + jobId);
        if (!details) return;
        
        var job = DATA.queue.find(function(j) { return j.id === jobId; });
        if (!job) return;
        
        var isExpanded = details.classList.contains('expanded');
        
        if (isExpanded) {
            details.classList.remove('expanded');
            clearQueuePolyline(jobId);
        } else {
            // Collapse all other cards first
            document.querySelectorAll('.queue-details.expanded').forEach(function(d) {
                d.classList.remove('expanded');
                var otherJobId = parseInt(d.id.replace('queue-details-', ''));
                clearQueuePolyline(otherJobId);
            });
            
            details.classList.add('expanded');
            if (job.geo) {
                showQueuePolyline(jobId, job.geo);
            }
        }
    }

    /**
     * Update queue timers
     */
    function updateQueueTimers() {
        DATA.queue.forEach(function(job) {
            var timerEl = document.getElementById('queue-timer-' + job.id);
            if (!timerEl) return;
            
            var now = Date.now();
            
            if (job.prebook) {
                var prebookTime = new Date(job.prebook).getTime();
                var remainingMs = prebookTime - now;
                
                if (remainingMs <= 0) {
                    timerEl.textContent = 'NOW';
                    timerEl.style.color = '#e74c3c';
                } else {
                    timerEl.textContent = formatTimeHHMMSS(remainingMs);
                    timerEl.style.color = '';
                }
            } else {
                // ASAP call - count up
                var waitingMs = now - job.ts;
                timerEl.textContent = formatTimeHHMMSS(waitingMs);
                timerEl.style.color = '';
            }
        });
    }

    // ========================================================================
    // QUEUE OPERATIONS
    // ========================================================================

    /**
     * Delete trip from queue
     */
    function deleteQueueTrip(jobId) {
        var job = DATA.queue.find(function(j) { return j.id === jobId; });
        if (!job) return;
        
        clearQueuePolyline(jobId);
        
        DATA.queue = DATA.queue.filter(function(j) { return j.id !== jobId; });
        save();
        renderQueue();
        updateBadges();
        
        console.log('[OK] Queue trip deleted: ' + job.cName);
    }

    /**
     * Edit queue trip (load into dispatch form)
     */
    function editQueueTrip(jobId) {
        var job = DATA.queue.find(function(j) { return j.id === jobId; });
        if (!job) return;
        
        // Populate dispatch form
        document.getElementById('dispatch-phone').value = job.cPhone;
        document.getElementById('dispatch-name').value = job.cName;
        document.getElementById('dispatch-tripname').value = job.tripName || '';
        // Notes: user enters manually (not loaded from saved job)
        
        document.getElementById('dispatch-pickup').value = job.sN;
        document.getElementById('dispatch-pickup').dataset.lat = job.s[1];
        document.getElementById('dispatch-pickup').dataset.lon = job.s[0];
        
        document.getElementById('dispatch-dropoff').value = job.eN;
        document.getElementById('dispatch-dropoff').dataset.lat = job.e[1];
        document.getElementById('dispatch-dropoff').dataset.lon = job.e[0];
        
        // Handle prebook
        if (job.prebook) {
            var prebookDate = new Date(job.prebook);
            // FIX: Use local date, not UTC
            var dateStr = prebookDate.getFullYear() + '-' + 
                String(prebookDate.getMonth() + 1).padStart(2, '0') + '-' + 
                String(prebookDate.getDate()).padStart(2, '0');
            var timeStr = prebookDate.toTimeString().slice(0, 5);
            document.getElementById('dispatch-prebook-date').value = dateStr;
            document.getElementById('dispatch-prebook-time').value = timeStr;
        }
        
        // Handle waypoints
        if (job.waypoints && job.waypoints.length > 0) {
            job.waypoints.forEach(function(wp, idx) {
                addWaypoint();
                var wpIndex = idx + 1;
                var wpAddr = document.getElementById('waypoint-' + wpIndex + '-address');
                var wpWaitEl = document.getElementById('waypoint-' + wpIndex + '-wait');
                if (wpAddr) {
                    wpAddr.value = wp.name;
                    wpAddr.dataset.lat = wp.coords[1];
                    wpAddr.dataset.lon = wp.coords[0];
                }
                if (wpWaitEl) {
                    wpWaitEl.textContent = wp.waitTime + ' min';
                    wpWaitEl.dataset.wait = wp.waitTime;
                }
            });
        }
        
        // Store temp calc
        STATE.tempCalc = {
            geo: job.geo,
            mins: job.mins,
            minsWithTraffic: job.minsWithTraffic,
            s: job.s,
            e: job.e,
            sN: job.sN,
            eN: job.eN,
            waypoints: job.waypoints || [],
            pickupQuote: job.pickupQuote
        };
        
        // Clear polyline before removing from queue
        clearQueuePolyline(jobId);
        
        // Remove from queue
        DATA.queue = DATA.queue.filter(function(j) { return j.id !== jobId; });
        save();
        renderQueue();
        updateBadges();
        
        console.log('[OK] Queue trip loaded into dispatch form: ' + job.cName);
    }

    // ========================================================================
    // ASSIGNMENT SYSTEM
    // ========================================================================

    /**
     * Assign driver to queue trip - Enter assignment mode
     */
    function assignDriver(jobId) {
        var job = DATA.queue.find(function(j) { return j.id === jobId; });
        if (!job) {
            console.error('Job not found');
            return;
        }
        
        // Get available drivers
        var availableDrivers = DATA.roster.filter(function(d) {
            var isClockedIn = DATA.shift.indexOf(d.id) !== -1;
            var onBreak = DATA.breaks.find(function(b) { return b.driverId === d.id && b.active; });
            var tripCount = getDriverTrips(d.id).length;
            var underLimit = tripCount < 3;
            
            return isClockedIn && !onBreak && underLimit;
        });
        
        if (availableDrivers.length === 0) {
            var clockedIn = DATA.roster.filter(function(d) { return DATA.shift.indexOf(d.id) !== -1; });
            if (clockedIn.length === 0) {
                showSystemMessage('No drivers clocked in', 4000, 'error');
            } else {
                var onBreakCount = clockedIn.filter(function(d) {
                    return DATA.breaks.find(function(b) { return b.driverId === d.id && b.active; });
                }).length;
                var atLimitCount = clockedIn.filter(function(d) { return getDriverTrips(d.id).length >= 3; }).length;
                
                var reasons = [];
                if (onBreakCount > 0) reasons.push(onBreakCount + ' on break');
                if (atLimitCount > 0) reasons.push(atLimitCount + ' at limit');
                
                showSystemMessage('No drivers available: ' + reasons.join(', '), 4000, 'error');
            }
            return;
        }
        
        // Get driver suggestion from timing service (sync first for immediate UI)
        var suggestion = TimingService.getSuggestedDrivers(job);
        
        // Enter assignment mode
        STATE.assignmentMode = true;
        STATE.assignmentJobId = jobId;
        STATE.suggestedDriverId = suggestion.primary;
        STATE.alternateDriverId = suggestion.alternate;
        
        // Async enhancement: fetch accurate ETAs in background, update if different
        TimingService.getSuggestedDriversAsync(job).then(function(asyncSuggestion) {
            // Only update if still in assignment mode for this job
            if (STATE.assignmentMode && STATE.assignmentJobId === jobId) {
                if (asyncSuggestion.primary !== suggestion.primary) {
                    console.log('🔄 Async ETA updated suggestion: ' + 
                        (suggestion.primary ? DATA.roster.find(function(d) { return d.id === suggestion.primary; }).name : 'none') + 
                        ' → ' + 
                        (asyncSuggestion.primary ? DATA.roster.find(function(d) { return d.id === asyncSuggestion.primary; }).name : 'none'));
                    
                    // Update state
                    STATE.suggestedDriverId = asyncSuggestion.primary;
                    STATE.alternateDriverId = asyncSuggestion.alternate;
                    
                    // Update visual highlights
                    document.querySelectorAll('.driver-card.suggested').forEach(function(c) {
                        c.classList.remove('suggested');
                    });
                    document.querySelectorAll('.driver-card.alternate').forEach(function(c) {
                        c.classList.remove('alternate');
                    });
                    
                    if (asyncSuggestion.primary) {
                        var suggestedCard = document.getElementById('driver-card-' + asyncSuggestion.primary);
                        if (suggestedCard) suggestedCard.classList.add('suggested');
                    }
                    if (asyncSuggestion.alternate) {
                        var alternateCard = document.getElementById('driver-card-' + asyncSuggestion.alternate);
                        if (alternateCard) alternateCard.classList.add('alternate');
                    }
                    
                    // Update system message
                    var driver = asyncSuggestion.primary ? DATA.roster.find(function(d) { return d.id === asyncSuggestion.primary; }) : null;
                    if (driver) {
                        showSystemMessage('Updated: ' + driver.name + ' - ' + asyncSuggestion.reasoning, 5000, 'info');
                    }
                }
            }
        }).catch(function(err) {
            console.warn('[WARN] Async suggestion fetch failed:', err.message);
        });
        
        // Add visual indicators to queue card
        var queueCard = document.getElementById('queue-card-' + jobId);
        if (queueCard) queueCard.classList.add('assignment-active');
        
        // DO NOT pulse entire pane - we'll pulse individual driver card
        // var livePane = document.getElementById('drivers-pane');
        // if (livePane) livePane.classList.add('assignment-focus');
        
        // Show suggestion in system message
        if (suggestion.primary) {
            var driver = DATA.roster.find(function(d) { return d.id === suggestion.primary; });
            var confidenceEmoji = {
                'high': '',
                'medium': '',
                'low': '',
                'none': ''
            };
            var emoji = confidenceEmoji[suggestion.confidence] || '';
            
            showSystemMessage('Suggested: ' + (driver ? driver.name : 'Unknown') + ' - ' + suggestion.reasoning, 5000, 'info');
        }
        
        // Re-render driver cards (will apply pulse to suggested driver)
        if (typeof renderDriverCards === 'function') renderDriverCards();
        
        // Apply pulse animation after render (DOM needs to be ready)
        setTimeout(function() {
            if (suggestion.primary) {
                var suggestedCard = document.getElementById('driver-card-' + suggestion.primary);
                if (suggestedCard) {
                    suggestedCard.classList.add('driver-suggested');
                }
            }
            if (suggestion.alternate) {
                var alternateCard = document.getElementById('driver-card-' + suggestion.alternate);
                if (alternateCard) {
                    alternateCard.classList.add('driver-alternate');
                }
            }
        }, 50);
        
        console.log('[ASSIGN] Assignment mode activated - Suggested:', suggestion);
    }

    /**
     * Cancel assignment mode
     */
    function cancelAssignment() {
        if (!STATE.assignmentMode) return;
        
        var jobId = STATE.assignmentJobId;
        
        STATE.assignmentMode = false;
        STATE.assignmentJobId = null;
        STATE.suggestedDriverId = null;
        STATE.alternateDriverId = null;
        
        // Remove visual indicators
        var queueCard = document.getElementById('queue-card-' + jobId);
        if (queueCard) queueCard.classList.remove('assignment-active');
        
        // Clear driver pulse animations
        document.querySelectorAll('.driver-suggested, .driver-alternate').forEach(function(el) {
            el.classList.remove('driver-suggested', 'driver-alternate');
        });
        
        if (typeof renderDriverCards === 'function') renderDriverCards();
        
        console.log('[ASSIGN] Assignment mode cancelled');
    }

    /**
     * Execute assignment when driver card is clicked
     */
    function selectDriverForAssignment(driverId) {
        if (!STATE.assignmentMode) return;
        
        var job = DATA.queue.find(function(j) { return j.id === STATE.assignmentJobId; });
        if (!job) {
            cancelAssignment();
            return;
        }
        
        var driver = DATA.roster.find(function(d) { return d.id === driverId; });
        if (!driver) return;
        
        // Clear assignment mode
        STATE.assignmentMode = false;
        var jobId = STATE.assignmentJobId;
        STATE.assignmentJobId = null;
        
        var queueCard = document.getElementById('queue-card-' + jobId);
        if (queueCard) queueCard.classList.remove('assignment-active');
        
        var livePane = document.getElementById('drivers-pane');
        if (livePane) livePane.classList.remove('assignment-focus');
        
        // Activate job
        activateJob(job, driverId);
    }

    // ========================================================================
    // QUEUE URGENCY SYSTEM
    // ========================================================================

    /**
     * Calculate urgency level
     */
    function calculateUrgency(job) {
        var now = Date.now();
        
        if (job.prebook) {
            var prebookTime = new Date(job.prebook).getTime();
            var remainingMs = prebookTime - now;
            var remainingMins = remainingMs / 60000;
            
            var approachBuffer = (job.pickupQuote && job.pickupQuote.breakdown) ? job.pickupQuote.breakdown.driverApproach : 10;
            var dispatchDeadline = prebookTime - (approachBuffer * 60000);
            var untilDispatchMs = dispatchDeadline - now;
            var untilDispatchMins = untilDispatchMs / 60000;
            
            if (remainingMins <= 0) {
                return { level: 'red', percent: 100, overdue: true, remainingMins: remainingMins };
            } else if (untilDispatchMins <= 0) {
                return { level: 'red', percent: 95, overdue: false, remainingMins: remainingMins };
            } else if (untilDispatchMins <= 5) {
                return { level: 'orange', percent: 80, overdue: false, remainingMins: remainingMins };
            } else if (untilDispatchMins <= 15) {
                return { level: 'yellow', percent: 50, overdue: false, remainingMins: remainingMins };
            } else {
                return { level: 'green', percent: 20, overdue: false, remainingMins: remainingMins };
            }
            
        } else {
            var elapsedMs = now - job.ts;
            var elapsedMins = elapsedMs / 60000;
            
            var promisedMins = (job.pickupQuote && job.pickupQuote.quotedMinutes) ? job.pickupQuote.quotedMinutes : 15;
            var percentUsed = (elapsedMins / promisedMins) * 100;
            
            if (elapsedMins >= promisedMins) {
                var overdueBy = elapsedMins - promisedMins;
                return { level: 'red', percent: 100 + overdueBy, overdue: true, elapsedMins: elapsedMins, promisedMins: promisedMins };
            } else if (percentUsed >= 80) {
                return { level: 'orange', percent: percentUsed, overdue: false, elapsedMins: elapsedMins, promisedMins: promisedMins };
            } else if (percentUsed >= 50) {
                return { level: 'yellow', percent: percentUsed, overdue: false, elapsedMins: elapsedMins, promisedMins: promisedMins };
            } else {
                return { level: 'green', percent: percentUsed, overdue: false, elapsedMins: elapsedMins, promisedMins: promisedMins };
            }
        }
    }

    function getUrgencyColor(level) {
        var colors = {
            green: '#27ae60',
            yellow: '#f1c40f',
            orange: '#e67e22',
            red: '#e74c3c'
        };
        return colors[level] || colors.green;
    }

    function getUrgencyBackground(level) {
        var backgrounds = {
            green: 'rgba(39, 174, 96, 0.15)',
            yellow: 'rgba(241, 196, 15, 0.15)',
            orange: 'rgba(230, 126, 34, 0.2)',
            red: 'rgba(231, 76, 60, 0.25)'
        };
        return backgrounds[level] || backgrounds.green;
    }

    // ========================================================================
    // LLM DISPATCH PROCESSING
    // ========================================================================

    /**
     * Check LLM/Cluster status
     */
    function checkLLMStatus() {
        var badge = document.getElementById('llm-status-badge');
        if (!badge) return;

        // Use centralized LLM availability check
        if (LLM && LLM.isAvailable()) {
            badge.style.background = '#27ae60';
            badge.textContent = 'CLUSTER CONNECTED';
            console.log('[LLM] Cluster connection confirmed');
        } else {
            badge.style.background = '#c0392b';
            badge.textContent = 'CLUSTER DISCONNECTED';
            console.warn('[LLM] Cluster not available');
        }
    }

    /**
     * Check LLM Timing System availability
     */
    function checkLLMTimingStatus() {
        // Use centralized LLM availability check
        if (LLM && LLM.isAvailable()) {
            LLMTimingService.enabled = true;
            console.log('[LLM TIMING] ENABLED via Cluster');
        } else {
            LLMTimingService.enabled = false;
            console.log('[LLM TIMING] DISABLED (Cluster not running)');
        }
    }

    /**
     * Process natural language dispatch input via LLM
     */
    function processDispatchLLM() {
        var input = document.getElementById('dispatch-llm-input').value.trim();
        var statusDiv = document.getElementById('dispatch-llm-status');
        
        // Check if form already has data (pre-parser filled it)
        var phone = document.getElementById('dispatch-phone').value.trim();
        var pickup = document.getElementById('dispatch-pickup').value.trim();
        
        if (!input && (phone || pickup)) {
            // Pre-parser already filled the form, calculate route and render to map
            // DO NOT auto-add to queue — dispatcher reviews first
            console.log('[PREPARSER] Form already has data from pre-parser, calculating route...');
            statusDiv.style.display = 'block';
            statusDiv.style.background = 'rgba(52, 152, 219, 0.9)';
            statusDiv.innerHTML = 'Calculating route...';
            
            autoGeocodeAndEstimate(statusDiv).then(function() {
                statusDiv.innerHTML = '✓ Route calculated — review and click "Add to Queue"';
                statusDiv.style.background = 'rgba(39, 174, 96, 0.9)';
                setTimeout(function() { statusDiv.style.display = 'none'; }, 2000);
            }).catch(function(err) {
                console.warn('[PREPARSER] Route calculation failed:', err);
                statusDiv.innerHTML = '⚠ Route failed — check addresses';
                statusDiv.style.background = 'rgba(192, 57, 43, 0.9)';
                setTimeout(function() { statusDiv.style.display = 'none'; }, 3000);
            });
            return;
        }
        
        if (!input) {
            alert('Please enter trip details');
            return;
        }
        
        statusDiv.style.display = 'block';
        statusDiv.style.background = 'rgba(52, 152, 219, 0.9)';
        statusDiv.innerHTML = 'Processing...';
        
        var now = new Date();
        var year = now.getFullYear();
        var month = String(now.getMonth() + 1).padStart(2, '0');
        var day = String(now.getDate()).padStart(2, '0');
        var currentDate = year + '-' + month + '-' + day;
        var currentTime = now.toTimeString().slice(0, 5);
        
        // FIX: Use local date for tomorrow, not UTC
        var tomorrow = new Date(now.getTime() + 86400000);
        var tomorrowDate = tomorrow.getFullYear() + '-' + 
            String(tomorrow.getMonth() + 1).padStart(2, '0') + '-' + 
            String(tomorrow.getDate()).padStart(2, '0');
        
        // Get LLM corrections context
        var correctionsContext = '';
        if (typeof getLLMCorrectionsContext === 'function') {
            correctionsContext = getLLMCorrectionsContext();
        }

        var prompt = 'Parse taxi dispatch details into structured JSON.\n\n' +
            '**DEFAULT BEHAVIOR: THIS IS AN ASAP CALL UNLESS TIME KEYWORDS ARE FOUND**\n\n' +
            'Current system time: ' + currentDate + ' ' + currentTime + '\n\n' +
            correctionsContext +
            '\n' +
            '**ADDRESS PARSING (CRITICAL):**\n' +
            '- Output addresses EXACTLY as written in the input - do NOT change, expand, or resolve them\n' +
            '- Example: If input says "Superstore", output "Superstore" (not a full address)\n' +
            '- Example: If input says "128 Reimer", output "128 Reimer" (not "128 Reimer Street")\n' +
            '- The geocoding system will resolve these to full addresses automatically\n' +
            '- NEVER invent or hallucinate address details that aren\'t in the input\n' +
            '\n' +
            'Return ONLY valid JSON (no markdown, no backticks):\n' +
            '{\n' +
            '    "clientPhone": "phone number or null",\n' +
            '    "clientName": "name or null",\n' +
            '    "pickup": "pickup address or null",\n' +
            '    "waypoints": [\n' +
            '        {"address": "stop address", "waitTime": minutes as number}\n' +
            '    ],\n' +
            '    "dropoff": "dropoff address or null",\n' +
            '    "notes": "any notes or null",\n' +
            '    "prebookDate": null,\n' +
            '    "prebookTime": null,\n' +
            '    "tripName": "route with arrows"\n' +
            '}\n\n' +
            '**TIME PARSING (CRITICAL):**\n' +
            '1. ALWAYS extract ANY time mentioned (1:22pm, 2:30, 3pm, 14:00, etc.)\n' +
            '2. STANDALONE TIME (no date keywords) → Use TODAY\'s date: "' + currentDate + '"\n' +
            '   Examples:\n' +
            '   - "1:22pm" → prebookDate: "' + currentDate + '", prebookTime: "13:22"\n' +
            '   - "2:30" → prebookDate: "' + currentDate + '", prebookTime: "14:30"\n' +
            '   - "3pm" → prebookDate: "' + currentDate + '", prebookTime: "15:00"\n' +
            '3. TOMORROW keyword → Use tomorrow: "' + tomorrowDate + '"\n' +
            '   - "tomorrow 9am" → prebookDate: "' + tomorrowDate + '", prebookTime: "09:00"\n' +
            '4. NO time mentioned → prebookDate: null, prebookTime: null (ASAP call)\n\n' +
            'Parse this input:\n' + input;
        
        // Use centralized LLM abstraction (Cluster integration)
        var systemPrompt = 'You are a taxi dispatch parser. Parse natural language into structured JSON. Return ONLY valid JSON, no markdown or explanation.';
        
        LLM.call({
            system: systemPrompt,
            prompt: prompt,
            temperature: 0.1
        })
        .then(function(result) {
            if (!result.success) throw new Error(result.error || 'LLM request failed');
            
            // Extract JSON from response (handle markdown code blocks)
            var responseText = result.content || '';
            var jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
            var jsonStr = jsonMatch ? jsonMatch[1] : responseText;
            
            var parsed = JSON.parse(jsonStr.trim());
            
            // Fill text fields
            if (parsed.clientPhone) {
                document.getElementById('dispatch-phone').value = parsed.clientPhone;
                document.getElementById('dispatch-phone').dispatchEvent(new Event('change'));
            }
            if (parsed.clientName) document.getElementById('dispatch-name').value = parsed.clientName;
            if (parsed.pickup) document.getElementById('dispatch-pickup').value = parsed.pickup;
            
            // Populate waypoints
            if (parsed.waypoints && Array.isArray(parsed.waypoints)) {
                for (var i = 0; i < Math.min(parsed.waypoints.length, 3); i++) {
                    var wp = parsed.waypoints[i];
                    
                    var waypointSection = document.getElementById('waypoint-' + (i + 1));
                    if (!waypointSection) {
                        addWaypoint();
                    }
                    
                    if (wp.address) {
                        var addressInput = document.getElementById('waypoint-' + (i + 1) + '-address');
                        if (addressInput) addressInput.value = wp.address;
                    }
                    
                    if (wp.waitTime !== undefined) {
                        var waitDisplay = document.getElementById('waypoint-' + (i + 1) + '-wait');
                        if (waitDisplay) {
                            waitDisplay.textContent = wp.waitTime + ' min';
                            waitDisplay.dataset.wait = wp.waitTime;
                        }
                    }
                }
            }
            
            if (parsed.dropoff) {
                if (parsed.dropoff.toLowerCase().indexOf('return') !== -1) {
                    document.getElementById('dispatch-dropoff').value = parsed.pickup || '';
                } else {
                    document.getElementById('dispatch-dropoff').value = parsed.dropoff;
                }
            }
            
            if (parsed.tripName) {
                document.getElementById('dispatch-tripname').value = parsed.tripName;
            }
            
            // Notes field: user enters manually (not autopopulated)
            
            // Handle prebook
            var prebookDateInput = document.getElementById('dispatch-prebook-date');
            var prebookTimeInput = document.getElementById('dispatch-prebook-time');
            
            if (parsed.prebookDate && parsed.prebookTime) {
                prebookDateInput.value = parsed.prebookDate;
                prebookTimeInput.value = parsed.prebookTime;
                console.log('📅 Time extracted: ' + parsed.prebookDate + ' ' + parsed.prebookTime);
                expandManualFields();
            } else if (parsed.prebookTime && !parsed.prebookDate) {
                prebookDateInput.value = currentDate;
                prebookTimeInput.value = parsed.prebookTime;
                console.log('📅 Time extracted (today): ' + currentDate + ' ' + parsed.prebookTime);
                expandManualFields();
            } else {
                // Keep current date/time (initialized on page load), don't blank them
                console.log('[DISPATCH] ASAP call - using current date/time defaults');
            }
            
            statusDiv.style.background = 'rgba(39, 174, 96, 0.9)';
            statusDiv.innerHTML = 'Geocoding addresses...';
            
            updateCallSummary();
            
            return autoGeocodeAndEstimate(statusDiv);
        })
        .catch(function(err) {
            statusDiv.style.background = 'rgba(192, 57, 43, 0.9)';
            statusDiv.innerHTML = 'Error: ' + err.message;
        });
    }

    /**
     * Auto-geocode addresses and trigger estimate
     */
    function autoGeocodeAndEstimate(statusDiv) {
        var placesService = STATE.placesService;
        
        var geocodeAddressInternal = function(address, inputId) {
            return new Promise(function(resolve) {
                if (!address) {
                    resolve(false);
                    return;
                }

                // Check addressCache first
                var cacheKey = address.toLowerCase().trim();
                if (DATA.addressCache && DATA.addressCache[cacheKey]) {
                    var cached = DATA.addressCache[cacheKey];
                    var inputEl = document.getElementById(inputId);
                    if (inputEl) {
                        inputEl.value = cached.displayName;
                        inputEl.dataset.lat = cached.lat;
                        inputEl.dataset.lon = cached.lng;
                    }
                    console.log('[GEOCODE CACHE HIT] ' + address);
                    resolve(true);
                    return;
                }

                // Check if address looks like "number + street name" (missing suffix)
                // e.g., "224 Lilac" → try adding Street, Avenue, Bay, etc.
                var streetSuffixes = ['Street', 'Avenue', 'Bay', 'Drive', 'Road', 'Lane', 'Court', 'Crescent', 'Boulevard', 'Way', 'Place'];
                var addressParts = address.trim().split(/\s+/);
                var looksLikeIncompleteStreet = addressParts.length >= 2 && /^\d+$/.test(addressParts[0]);
                
                // Build query list
                var queries = [
                    address + ' Steinbach Manitoba',
                    address + ' Manitoba',
                    address  // Raw address
                ];
                
                // If address looks incomplete (e.g., "224 Lilac"), try adding suffixes
                if (looksLikeIncompleteStreet) {
                    streetSuffixes.forEach(function(suffix) {
                        queries.push(address + ' ' + suffix + ' Steinbach Manitoba');
                        queries.push(address + ' ' + suffix + ' Manitoba');
                    });
                }

                var tryQuery = function(queryIndex) {
                    if (queryIndex >= queries.length) {
                        console.log('[GEOCODE] All queries failed for: ' + address);
                        resolve(false);
                        return;
                    }

                    var request = {
                        query: queries[queryIndex],
                        fields: ['name', 'formatted_address', 'geometry']
                    };

                    placesService.textSearch(request, function(results, status) {
                        if (status !== google.maps.places.PlacesServiceStatus.OK || !results || results.length === 0) {
                            // Try next query
                            tryQuery(queryIndex + 1);
                            return;
                        }

                        var place = results[0];
                        var lat = place.geometry.location.lat();
                        var lng = place.geometry.location.lng();
                        var displayName = place.formatted_address || place.name;

                        var inputEl = document.getElementById(inputId);
                        inputEl.value = displayName;
                        inputEl.dataset.lat = lat;
                        inputEl.dataset.lon = lng;

                        // Store in addressCache
                        if (!DATA.addressCache) DATA.addressCache = {};
                        DATA.addressCache[cacheKey] = { displayName: displayName, lat: lat, lng: lng };
                        console.log('[LLM GEOCODE] ' + inputId + ': ' + displayName + ' [' + lat + ', ' + lng + '] (query: ' + queries[queryIndex] + ')');
                        resolve(true);
                    });
                };

                tryQuery(0);
            });
        };
        
        var pickupAddress = document.getElementById('dispatch-pickup').value;
        var dropoffAddress = document.getElementById('dispatch-dropoff').value;
        
        return geocodeAddressInternal(pickupAddress, 'dispatch-pickup')
            .then(function() {
                // Geocode waypoints
                var waypointPromises = [];
                for (var i = 0; i < 3; i++) {
                    var wpInput = document.getElementById('waypoint-' + (i + 1) + '-address');
                    if (wpInput && wpInput.value) {
                        waypointPromises.push(geocodeAddressInternal(wpInput.value, wpInput.id));
                    }
                }
                return Promise.all(waypointPromises);
            })
            .then(function() {
                return geocodeAddressInternal(dropoffAddress, 'dispatch-dropoff');
            })
            .then(function() {
                var pickupEl = document.getElementById('dispatch-pickup');
                var dropoffEl = document.getElementById('dispatch-dropoff');
                var hasStart = pickupEl.dataset.lat && pickupEl.dataset.lon;
                var hasEnd = dropoffEl.dataset.lat && dropoffEl.dataset.lon;
                
                if (!hasStart || !hasEnd) {
                    statusDiv.style.background = 'rgba(192, 57, 43, 0.9)';
                    statusDiv.innerHTML = 'Error: Could not geocode pickup or dropoff address.';
                    return;
                }
                
                statusDiv.innerHTML = 'Calculating route...';
                
                return getEstimate().then(function() {
                    statusDiv.style.background = 'rgba(39, 174, 96, 0.9)';
                    statusDiv.innerHTML = '✓ Trip estimated! Review and add to queue.';
                    
                    // Clear LLM input immediately
                    document.getElementById('dispatch-llm-input').value = '';
                    
                    setTimeout(function() {
                        statusDiv.style.display = 'none';
                    }, 3000);
                });
            })
            .catch(function(err) {
                statusDiv.style.background = 'rgba(192, 57, 43, 0.9)';
                statusDiv.innerHTML = 'Geocoding error: ' + err.message;
            });
    }

    // ========================================================================
    // CALL SUMMARY & SMS
    // ========================================================================

    /**
     * Generate call summary and append to Notes
     */
    function generateCallSummaryToNotes(job) {
        if (!LLMTimingService || !LLMTimingService.enabled) {
            var summary = generateCallSummaryTemplate(job);
            SessionNotes.append(summary);
            return;
        }
        
        var routeStr = job.sN;
        if (job.waypoints && job.waypoints.length > 0) {
            job.waypoints.forEach(function(wp) {
                var waitNote = wp.waitTime > 0 ? ' (' + wp.waitTime + 'min wait)' : '';
                routeStr += ' → ' + wp.name + waitNote;
            });
        }
        routeStr += ' → ' + job.eN;
        
        var prebookStr = job.prebook 
            ? new Date(job.prebook).toLocaleString('en-US', {
                month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true
            })
            : 'ASAP';
        
        var prompt = 'Generate a clean call summary for taxi dispatch notes:\n\n' +
            'Trip details:\n' +
            '- Trip Name: ' + (job.tripName || 'Unnamed Trip') + '\n' +
            '- Customer: ' + (job.cName || 'Anonymous') + ' (' + (job.cPhone || 'No phone') + ')\n' +
            '- Route: ' + routeStr + '\n' +
            '- Duration: ' + (job.minsWithTraffic || job.mins) + ' minutes\n' +
            '- Pickup time: ' + prebookStr + '\n' +
            '- Notes: ' + (job.notes || 'None') + '\n\n' +
            'Return ONLY the formatted summary.';
        
        // DISABLED: LLM call summary (too slow, use template instead)
        // Use template-based summary for speed
        var summary = generateCallSummaryTemplate(job);
        SessionNotes.append(summary);
        console.log('📝 Call summary generated (template)');
    }

    /**
     * Generate call summary using template
     */
    function generateCallSummaryTemplate(job) {
        var now = new Date().toLocaleString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
        var customer = (job.cName || 'Anonymous') + ' (' + (job.cPhone || 'No phone') + ')';
        
        var route = job.sN;
        if (job.waypoints && job.waypoints.length > 0) {
            job.waypoints.forEach(function(wp) {
                var waitNote = wp.waitTime > 0 ? ' [' + wp.waitTime + 'min]' : '';
                route += ' → ' + wp.name + waitNote;
            });
        }
        route += ' → ' + job.eN;
        
        var prebookStr = job.prebook 
            ? new Date(job.prebook).toLocaleString('en-US', {
                month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true
            })
            : 'ASAP';
        
        var duration = job.minsWithTraffic || job.mins;
        
        var summary = '\n' + now + ' — ' + customer + '\n';
        summary += 'Trip: ' + (job.tripName || 'Unnamed Trip') + '\n';
        summary += 'Route: ' + route + '\n';
        summary += 'Duration: ' + duration + ' min | Pickup: ' + prebookStr + '\n';
        
        if (job.notes) {
            summary += 'Notes: ' + job.notes + '\n';
        }
        
        summary += '---\n';
        
        console.log('📝 Call summary generated with template');
        return summary;
    }

    /**
     * Copy trip SMS by ID
     */
    function copyTripSMSById(tripId, source) {
        var trip = source === 'queue' 
            ? DATA.queue.find(function(j) { return j.id === tripId; })
            : DATA.live.find(function(t) { return t.id === tripId; });
        
        if (!trip) {
            showSystemMessage('Trip not found');
            return;
        }
        
        copyTripSMS(trip);
    }

    /**
     * Copy trip SMS to clipboard
     */
    function copyTripSMS(trip) {
        if (!trip) {
            showSystemMessage('Trip not found');
            return;
        }
        
        showSystemMessage('Generating SMS...');
        
        var mapsUrl = buildGoogleMapsUrl(trip);
        var smsText = generateTripSMSTemplate(trip);
        var fullText = smsText + '\n\n' + mapsUrl;
        
        navigator.clipboard.writeText(fullText).then(function() {
            showSystemMessage('SMS copied to clipboard');
            console.log('[PREPARSER] SMS copied: ' + trip.tripName);
        }).catch(function(err) {
            console.error('Copy failed:', err);
            showSystemMessage('Copy failed');
            prompt('Copy this text:', fullText);
        });
    }

    /**
     * Build Google Maps URL
     */
    function buildGoogleMapsUrl(trip) {
        if (!trip.s || !trip.e) return '';
        
        var origin = trip.s[1] + ',' + trip.s[0];
        var destination = trip.e[1] + ',' + trip.e[0];
        
        var waypoints = '';
        if (trip.waypoints && trip.waypoints.length > 0) {
            var waypointCoords = trip.waypoints.map(function(wp) {
                return wp.coords[1] + ',' + wp.coords[0];
            }).join('|');
            waypoints = '&waypoints=' + waypointCoords;
        }
        
        return 'https://www.google.com/maps/dir/?api=1&origin=' + origin + '&destination=' + destination + waypoints;
    }

    /**
     * Generate SMS template
     */
    function generateTripSMSTemplate(trip) {
        var customerName = trip.cName || 'Customer';
        var customerPhone = trip.cPhone || '';
        var etaMinutes = (trip.pickupQuote && trip.pickupQuote.quotedMinutes) ? trip.pickupQuote.quotedMinutes : (trip.mins || '?');

        var prebookText = trip.prebook
            ? new Date(trip.prebook).toLocaleString('en-US', {
                month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true
            })
            : 'ASAP';

        // Use Trip Name (already contains simplified route like "123 Main St → Walmart")
        var tripName = trip.tripName || 'Unnamed Trip';

        // Build SMS
        var sms = 'TAXI - ' + customerName + ' ' + customerPhone + '\n';
        sms += tripName + '\n';
        sms += 'ETA: ' + etaMinutes + ' min | ' + prebookText;

        return sms;
    }

    // ========================================================================
    // EXPOSE TO GLOBAL SCOPE
    // ========================================================================

    // Form management
    window.recallPickup = recallPickup;
    window.toggleManualFields = toggleManualFields;
    window.expandManualFields = expandManualFields;
    window.clearForm = clearForm;
    window.refreshDispatchForm = refreshDispatchForm;
    
    // Waypoints
    window.addWaypoint = addWaypoint;
    window.clearWaypoint = clearWaypoint;
    window.adjustWaitTime = adjustWaitTime;
    window.addReturnTrip = addReturnTrip;
    
    // Estimation
    window.getEstimate = getEstimate;
    
    // Job & Queue
    window.createJobObj = createJobObj;
    window.addToQueue = addToQueue;
    window.promptSaveNewClient = promptSaveNewClient;
    window.addClientFromDispatch = addClientFromDispatch;
    
    // Queue rendering
    window.renderQueue = renderQueue;
    window.toggleQueueCard = toggleQueueCard;
    window.updateQueueTimers = updateQueueTimers;
    
    // Queue operations
    window.deleteQueueTrip = deleteQueueTrip;
    window.editQueueTrip = editQueueTrip;
    
    // Assignment
    window.assignDriver = assignDriver;
    window.cancelAssignment = cancelAssignment;
    window.selectDriverForAssignment = selectDriverForAssignment;
    
    // Urgency
    window.calculateUrgency = calculateUrgency;
    window.getUrgencyColor = getUrgencyColor;
    window.getUrgencyBackground = getUrgencyBackground;
    
    // LLM
    window.checkLLMStatus = checkLLMStatus;
    window.checkLLMTimingStatus = checkLLMTimingStatus;
    window.processDispatchLLM = processDispatchLLM;
    window.autoGeocodeAndEstimate = autoGeocodeAndEstimate;
    
    // Call summary & SMS
    window.generateCallSummaryToNotes = generateCallSummaryToNotes;
    window.generateCallSummaryTemplate = generateCallSummaryTemplate;
    window.copyTripSMSById = copyTripSMSById;
    window.copyTripSMS = copyTripSMS;
    window.buildGoogleMapsUrl = buildGoogleMapsUrl;
    window.generateTripSMSTemplate = generateTripSMSTemplate;
    
    // ========================================================================
    // INITIALIZATION
    // ========================================================================
    
    // Check LLM status on page load
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() {
            checkLLMStatus();
            checkLLMTimingStatus();
            initCallSummaryListeners();
        });
    } else {
        checkLLMStatus();
        checkLLMTimingStatus();
        initCallSummaryListeners();
    }
    
    // Initialize Call Summary field listeners
    function initCallSummaryListeners() {
        var fieldIds = [
            'dispatch-phone',
            'dispatch-name',
            'dispatch-pickup',
            'dispatch-dropoff',
            'dispatch-tripname',
            'dispatch-prebook-date',
            'dispatch-prebook-time',
            'dispatch-notes'
        ];
        
        fieldIds.forEach(function(id) {
            var field = document.getElementById(id);
            if (field) {
                field.addEventListener('input', updateCallSummary);
                field.addEventListener('change', updateCallSummary);
            }
        });
        
        // Auto-clear LLM prompt field on focus for easier re-entry
        var llmInput = document.getElementById('dispatch-llm-input');
        if (llmInput) {
            llmInput.addEventListener('focus', function() {
                // Always clear on focus (even if empty)
                llmInput.value = '';
                console.log('[CLEAR] LLM prompt field auto-cleared on focus');
            });
        }
        
        // Allow Tab key in notes field for indentation
        var notesField = document.getElementById('dispatch-notes');
        if (notesField) {
            notesField.addEventListener('keydown', function(e) {
                if (e.key === 'Tab') {
                    e.preventDefault();
                    var start = this.selectionStart;
                    var end = this.selectionEnd;
                    
                    // Insert tab character at cursor position
                    this.value = this.value.substring(0, start) + '\t' + this.value.substring(end);
                    
                    // Move cursor after the tab
                    this.selectionStart = this.selectionEnd = start + 1;
                }
            });
        }
        
        console.log('[OK] Call Summary listeners initialized');
    }

})();