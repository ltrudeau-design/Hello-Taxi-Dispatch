// ============================================================================
// KERNEL-LIVE.JS
// Live Trips, Driver Cards, Phase Management, Global ETA, Trip Operations
// ============================================================================

(function() {
    'use strict';

    // ========================================================================
    // JOB ACTIVATION
    // ========================================================================

    /**
     * Activate job - Assign driver and move to live
     */
    function activateJob(job, driverId) {
        console.log('[LIVE] Activating job ' + job.id + ' for driver ' + driverId);
        
        var driver = DATA.roster.find(function(d) { return d.id === driverId; });
        if (!driver) {
            alert('Driver not found');
            return;
        }
        
        // Position check removed - driver can accept trip without set position
        // If no position, approach time defaults to 5 minutes
        var driverPos = driver.currentLocation || driver.lastDrop;
        
        showSystemMessage('Calculating approach route...', 2000, 'info');
        
        // Calculate approach route
        calculateApproachRoute(driverId, job.s).then(function(approachResult) {
            var approachMins = approachResult.duration;
            var approachGeo = approachResult.geo;
            
            console.log('[MAP] Approach: ' + approachMins + ' min, geo: ' + (approachGeo ? 'yes' : 'no'));
            
            // Determine start time
            var now = Date.now();
            var tripStartTime = now;
            var tripStatus = 'active';
            
            // Check if driver has active or stacked trips to stack behind
            var driverActiveTrips = DATA.live.filter(function(t) {
                return t.dr && t.dr.id === driverId && (t.status === 'active' || t.status === 'stacked');
            });
            
            if (driverActiveTrips.length > 0) {
                // Stack this trip
                var lastTrip = driverActiveTrips.sort(function(a, b) { return b.end - a.end; })[0];
                tripStartTime = lastTrip.end;
                tripStatus = 'stacked';
                console.log('[STACK] Stacking trip after existing trip (starts at ' + new Date(tripStartTime).toLocaleTimeString() + ')');
            } else if (job.prebook) {
                // Handle prebook
                var prebookTime = new Date(job.prebook).getTime();
                var approachTime = approachMins * 60000;
                var idealStartTime = prebookTime - approachTime;
                
                if (idealStartTime > now) {
                    tripStartTime = idealStartTime;
                    tripStatus = 'stacked';
                    console.log('📅 Prebook trip scheduled for ' + new Date(tripStartTime).toLocaleTimeString());
                }
            }
            
            // Calculate end times
            var bufferMins = job.buffer || 0;
            var totalDuration = job.mins + approachMins + bufferMins;
            var approachEnd = tripStartTime + ((approachMins + bufferMins) * 60000);
            var end = tripStartTime + (totalDuration * 60000);
            
            // Create live trip object
            var liveTrip = {
                id: job.id,
                ts: job.ts,
                cName: job.cName,
                cPhone: job.cPhone,
                tripName: job.tripName,
                prebook: job.prebook,
                notes: job.notes,
                buffer: job.buffer || 0,
                geo: job.geo,
                mins: job.mins,
                minsWithTraffic: job.minsWithTraffic,
                s: job.s,
                e: job.e,
                sN: job.sN,
                eN: job.eN,
                waypoints: job.waypoints,
                pickupQuote: job.pickupQuote,
                dr: {
                    id: driver.id,
                    name: driver.name,
                    call: driver.call,
                    color: driver.color
                },
                start: tripStartTime,
                approachEnd: approachEnd,
                end: end,
                approach: approachMins,
                approachGeo: approachGeo,
                status: tripStatus,
                phase: tripStatus === 'stacked' ? null : 'approach',
                phaseOverdue: false,
                currentWaypointIndex: -1,
                phaseStart: tripStartTime,
                phaseEnd: approachEnd
            };
            
            // Add to live trips
            DATA.live.push(liveTrip);
            
            // DEBUG: Confirm trip was added with correct status
            console.log('[LIVE] Trip added to DATA.live: id=' + liveTrip.id + 
                ', status=' + liveTrip.status + 
                ', driver=' + driver.name +
                ', DATA.live.length=' + DATA.live.length);
            
            // Remove from queue
            DATA.queue = DATA.queue.filter(function(j) { return j.id !== job.id; });
            
            // Clear queue polyline and markers
            clearQueuePolyline(job.id);
            
            // Clear dispatch form markers if they match this job
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
            
            // Update turn sequence
            if (DATA.turnSequence.indexOf(driverId) === -1) {
                DATA.turnSequence.push(driverId);
            } else {
                DATA.turnSequence = DATA.turnSequence.filter(function(id) { return id !== driverId; });
                DATA.turnSequence.push(driverId);
            }
            
            save(true);  // IMMEDIATE save (no debounce) for live trips
            updateBadges();
            renderQueue();

            // Force driver card expansion for newly assigned/stacked trip
            STATE.forceExpandDriverId = driverId;

            // Use renderDriverCards() for consistent rendering (50ms debounce)
            // This prevents race conditions with other render calls
            renderDriverCards();

            // Clear force-expand after render completes (not immediately!)
            setTimeout(function() {
                STATE.forceExpandDriverId = null;
            }, 100);

            console.log('[LIVE] Job activated: ' + job.tripName + ' -> ' + driver.name + ' (status: ' + tripStatus + ')');
            showSystemMessage('Trip assigned to ' + driver.name, 3000, 'success');
            
        }).catch(function(err) {
            console.error('Approach calculation failed:', err);
            showSystemMessage('Failed to calculate approach route', 4000, 'error');
        });
    }

    // ========================================================================
    // DRIVER CARDS RENDERING
    // ========================================================================

    // Debounce timer for renderDriverCards
    var renderTimeout = null;
    var renderPending = false;

    /**
     * Render driver cards in the Live Pane (debounced to prevent race conditions)
     */
    function renderDriverCards() {
        // Debounce: coalesce rapid calls into single render
        if (renderTimeout) {
            clearTimeout(renderTimeout);
            renderPending = true;
        }
        
        renderTimeout = setTimeout(function() {
            renderTimeout = null;
            renderPending = false;
            _renderDriverCardsImpl();
        }, 50); // 50ms debounce
    }
    
    /**
     * Actual implementation of driver card rendering
     */
    function _renderDriverCardsImpl() {
        try {
            var container = document.getElementById('live-content');
            if (!container) {
                console.error('[RENDER] ❌ live-content container not found!');
                return;
            }

            // Preserve expansion state before re-render
            var expandedDriverIds = [];
            document.querySelectorAll('.driver-card-details.expanded').forEach(function(details) {
                var driverId = parseInt(details.id.replace('driver-details-', ''));
                expandedDriverIds.push(driverId);
            });

            // Include force-expand driver (for newly assigned trips)
            if (STATE.forceExpandDriverId && expandedDriverIds.indexOf(STATE.forceExpandDriverId) === -1) {
                expandedDriverIds.push(STATE.forceExpandDriverId);
            }

            // Get clocked-in drivers sorted by name
            var clockedInDrivers = DATA.roster
                .filter(function(d) { return DATA.shift.indexOf(d.id) !== -1; })
                .sort(function(a, b) { return a.name.localeCompare(b.name); });

            // DEBUG: Log clocked-in drivers
            console.log('[RENDER] Clocked-in drivers:', clockedInDrivers.map(function(d) {
                return d.name + ' (ID:' + d.id + ')';
            }).join(', '));
            console.log('[RENDER] DATA.shift:', DATA.shift);

            // Empty state
            if (clockedInDrivers.length === 0) {
                container.innerHTML =
                    '<div class="text-center" style="padding: 40px 20px; color: rgba(255, 255, 255, 0.5);">' +
                        '<i class="fas fa-user-clock fa-3x mb-2" style="opacity: 0.3;"></i>' +
                        '<p>No drivers clocked in</p>' +
                        '<p style="font-size: 12px; margin-top: 8px;">Clock in drivers from the Roster page</p>' +
                    '</div>';
                return;
            }

            container.innerHTML = '';

            // DEBUG: Log DATA.live state before rendering
            console.log('[RENDER] DATA.live.length:', DATA.live.length, 'Trips:', DATA.live.map(function(t) {
                return t.id + ':' + (t.status || 'NO_STATUS') + ':' + (t.dr ? t.dr.name : 'NO_DRIVER');
            }).join(', '));

            clockedInDrivers.forEach(function(driver) {
                var trips = getDriverTrips(driver.id);

                // DEBUG: Log trip statuses to catch disappearing trips
                if (trips.length > 0) {
                    console.log('[RENDER] Driver ' + driver.name + ' - Total trips:', trips.length, '| Active:', trips.filter(function(t) { return t.status === 'active'; }).length, '| Stacked:', trips.filter(function(t) { return t.status === 'stacked'; }).length);
                    console.log('[RENDER]   Trips:', trips.map(function(t) {
                        return t.id + ':' + t.status + ':' + t.tripName;
                    }).join(', '));
                }

                // Defensive filtering: ensure status exists and matches exactly
                var activeTrip = trips.find(function(t) {
                    return t && t.status && t.status === 'active';
                });
                var stackedTrips = trips.filter(function(t) {
                    return t && t.status && t.status === 'stacked';
                });

                // WARN: Log if we have trips that don't match active or stacked
                var unmatchedTrips = trips.filter(function(t) {
                    return t && (!t.status || (t.status !== 'active' && t.status !== 'stacked'));
                });
                if (unmatchedTrips.length > 0) {
                    console.warn('[RENDER] Driver ' + driver.name + ' has trips with invalid status:',
                        unmatchedTrips.map(function(t) { return t.id + ':' + t.status; }));
                }

                var onBreak = DATA.breaks.find(function(b) { return b.driverId === driver.id && b.active; });

                var card = buildDriverCard(driver, activeTrip, stackedTrips, onBreak, expandedDriverIds);
                container.appendChild(card);
            });

            console.log('[OK] Driver cards rendered: ' + clockedInDrivers.length + ' drivers');
        } catch (err) {
            console.error('[RENDER] ❌ CRITICAL ERROR in _renderDriverCardsImpl:', err);
            console.error('[RENDER] Stack:', err.stack);
        }
    }

    /**
     * Build a single driver card element
     */
    function buildDriverCard(driver, activeTrip, stackedTrips, onBreak, expandedDriverIds) {
        var card = document.createElement('div');
        card.className = 'driver-card-live';
        card.id = 'driver-card-' + driver.id;
        card.style.borderLeft = '3px solid ' + driver.color;

        // Check if this driver should be expanded
        var shouldExpand = expandedDriverIds && expandedDriverIds.indexOf(driver.id) !== -1;

        // Set state class
        if (onBreak) {
            card.classList.add('on-break');
        } else if (activeTrip) {
            card.classList.add('busy');
        } else {
            card.classList.add('available');
        }

        // Assignment mode styling only - click handler moved to details area
        var isAssignmentSelectable = false;
        if (STATE.assignmentMode && !onBreak) {
            var tripCount = getDriverTrips(driver.id).length;
            if (tripCount < 3) {
                card.classList.add('assignment-selectable');
                isAssignmentSelectable = true;
            }
        }
        
        // Determine display content
        var tripNameDisplay = '';
        var statusText = '';
        
        if (onBreak) {
            statusText = 'On Break';
        } else if (activeTrip) {
            tripNameDisplay = activeTrip.tripName;
        } else if (stackedTrips.length > 0) {
            var nextTrip = stackedTrips[0];
            var startsIn = Math.max(0, Math.ceil((nextTrip.start - Date.now()) / 60000));
            statusText = 'Next trip in ' + startsIn + ' min';
        } else {
            statusText = 'Available';
        }
        
        // Build progress bar
        var progressHTML = '';
        if (activeTrip && !onBreak) {
            progressHTML = '<div class="driver-card-progress">' + buildDriverProgressBar(activeTrip) + '</div>';
        }
        
        // Build stacked trip summary for collapsed state
        var stackedSummary = '';
        if (stackedTrips.length > 0) {
            stackedSummary = '<div class="driver-stacked-summary">' +
                '<i class="fas fa-layer-group"></i> ' + stackedTrips.length + ' Stacked Trip' + (stackedTrips.length > 1 ? 's' : '') +
            '</div>';
        }
        
        // Build nested cards (always visible when expanded)
        var nestedCards = '';
        if (activeTrip) {
            nestedCards += buildNestedCallCard(activeTrip, true);
        }
        stackedTrips.forEach(function(trip) {
            nestedCards += buildNestedCallCard(trip, false);
        });
        
        if (!activeTrip && stackedTrips.length === 0) {
            nestedCards = 
                '<div class="driver-no-trips">' +
                    '<i class="fas fa-inbox" style="font-size: 24px; opacity: 0.3; margin-bottom: 8px; display: block;"></i>' +
                    'No assigned trips' +
                '</div>';
        }
        
        // Only show pin button when driver is available with no trips
        var showPin = !onBreak && !activeTrip && stackedTrips.length === 0;
        var pinButtonHTML = showPin 
            ? '<button class="btn-driver-location-pin" onclick="event.stopPropagation(); setDriverLocation(' + driver.id + ');" title="Set driver location">' +
                  '<i class="fas fa-map-marker-alt"></i>' +
              '</button>'
            : '';
        
        card.innerHTML = 
            '<div class="driver-card-header" onclick="toggleDriverCardExpand(' + driver.id + ')">' +
                '<div class="driver-name-badge" style="background-color: ' + driver.color + ';">' +
                    driver.name +
                    pinButtonHTML +
                '</div>' +
                '<div class="driver-active-info">' +
                    (tripNameDisplay 
                        ? '<div class="driver-trip-name">' + tripNameDisplay + '</div>'
                        : '<div class="driver-status-text">' + statusText + '</div>') +
                    stackedSummary +
                '</div>' +
                '<div class="driver-expand-icon">' +
                    '<i class="fas fa-chevron-down"></i>' +
                '</div>' +
            '</div>' +
            progressHTML +
            '<div class="driver-card-details' + (shouldExpand ? ' expanded' : '') + '" id="driver-details-' + driver.id + '">' +
                (activeTrip ? buildDriverBufferControls(activeTrip) : '') +
                '<div class="driver-trips-container">' +
                    nestedCards +
                '</div>' +
            '</div>';

        // Add expanded class to card if needed
        if (shouldExpand) {
            card.classList.add('expanded');
        }
        
        // Add assignment click handler to entire card
        if (isAssignmentSelectable) {
            card.onclick = function(e) {
                // Exclude interactive elements (buttons, buffer controls)
                if (e.target.closest('button') || 
                    e.target.closest('.driver-buffer-row') ||
                    e.target.closest('.nested-card-actions')) {
                    return; // Let the button handle its own click
                }
                
                // Check if clicking header
                var clickedHeader = e.target.closest('.driver-card-header');
                var details = document.getElementById('driver-details-' + driver.id);
                var isExpanded = details && details.classList.contains('expanded');
                
                // If clicking header on collapsed card, assign driver
                // If clicking header on expanded card, let toggle work (return)
                // If clicking body/details on expanded card, assign driver
                if (clickedHeader && !isExpanded) {
                    // Collapsed card header click = assignment
                    e.preventDefault();
                    e.stopPropagation();
                    selectDriverForAssignment(driver.id);
                } else if (clickedHeader && isExpanded) {
                    // Expanded card header click = let toggle work
                    return;
                } else {
                    // Body/details click = assignment
                    e.stopPropagation();
                    selectDriverForAssignment(driver.id);
                }
            };
        }
        
        return card;
    }

    /**
     * Build progress bar for driver card
     */
    function buildDriverProgressBar(trip) {
        var now = Date.now();
        var progressPercent = 0;
        var phaseText = '';
        var timeRemaining = '';
        var phaseClass = trip.phase || 'approach';
        
        if (trip.phase === 'approach') {
            var phaseElapsed = now - trip.phaseStart;
            var phaseDuration = trip.phaseEnd - trip.phaseStart;
            progressPercent = Math.min(100, Math.max(0, (phaseElapsed / phaseDuration) * 100));
            phaseText = 'En route to pickup';
            
            var remainingSecs = Math.max(0, Math.ceil((trip.phaseEnd - now) / 1000));
            var mins = Math.floor(remainingSecs / 60);
            var secs = remainingSecs % 60;
            timeRemaining = mins + ':' + String(secs).padStart(2, '0');
            
        } else if (trip.phase === 'active') {
            var phaseElapsed = now - trip.phaseStart;
            var phaseDuration = trip.phaseEnd - trip.phaseStart;
            progressPercent = Math.min(100, Math.max(0, (phaseElapsed / phaseDuration) * 100));
            phaseText = 'En route';
            
            var remainingSecs = Math.max(0, Math.ceil((trip.phaseEnd - now) / 1000));
            var mins = Math.floor(remainingSecs / 60);
            var secs = remainingSecs % 60;
            timeRemaining = mins + ':' + String(secs).padStart(2, '0');
            
        } else if (trip.phase === 'waiting') {
            var phaseElapsed = now - trip.phaseStart;
            var phaseDuration = trip.phaseEnd - trip.phaseStart;
            progressPercent = Math.min(100, Math.max(0, (phaseElapsed / phaseDuration) * 100));
            phaseText = 'Waiting at stop';
            
            var remainingSecs = Math.max(0, Math.ceil((trip.phaseEnd - now) / 1000));
            var mins = Math.floor(remainingSecs / 60);
            var secs = remainingSecs % 60;
            timeRemaining = mins + ':' + String(secs).padStart(2, '0');
            phaseClass = 'waiting';
        }
        
        return '<div class="live-progress-bar">' +
                '<div class="live-progress-fill ' + phaseClass + '" id="driver-progress-fill-' + trip.id + '" style="width: ' + progressPercent + '%"></div>' +
                '<div class="live-progress-text" id="driver-progress-text-' + trip.id + '">' +
                    phaseText + (timeRemaining ? ' (' + timeRemaining + ')' : '') +
                '</div>' +
            '</div>';
    }

    /**
     * Build buffer controls
     */
    function buildDriverBufferControls(trip) {
        return '<div class="driver-buffer-row">' +
                '<span class="driver-buffer-label">Buffer:</span>' +
                '<button class="btn btn-sm" onclick="event.stopPropagation(); TimingService.adjustBuffer(' + trip.id + ', -1);">' +
                    '<i class="fas fa-minus"></i>' +
                '</button>' +
                '<div class="buffer-display" id="driver-buffer-' + trip.id + '">+' + (trip.buffer || 0) + ' min</div>' +
                '<button class="btn btn-sm" onclick="event.stopPropagation(); TimingService.adjustBuffer(' + trip.id + ', 1);">' +
                    '<i class="fas fa-plus"></i>' +
                '</button>' +
            '</div>';
    }

    /**
     * Build nested call card
     */
    function buildNestedCallCard(trip, isActive) {
        var labelClass = isActive ? 'active' : 'stacked';
        var cardClass = isActive ? 'active-trip' : 'stacked-trip';
        var labelText = isActive ? 'ACTIVE' : 'STACKED';
        
        // Time info for stacked
        var timeInfo = '';
        if (!isActive) {
            var startsIn = Math.max(0, Math.ceil((trip.start - Date.now()) / 60000));
            if (startsIn > 60) {
                var hours = Math.floor(startsIn / 60);
                var mins = startsIn % 60;
                timeInfo = 'Starts in ' + hours + 'h ' + mins + 'm';
            } else {
                timeInfo = 'Starts in ' + startsIn + ' min';
            }
        }
        
        // Route display
        var routeDisplay = '<i class="fas fa-map-marker-alt"></i> ' + trip.sN;
        if (trip.waypoints && trip.waypoints.length > 0) {
            trip.waypoints.forEach(function(wp) {
                var waitNote = wp.waitTime > 0 ? ' (' + wp.waitTime + 'min)' : '';
                routeDisplay += ' <i class="fas fa-arrow-right" style="font-size: 10px; opacity: 0.5;"></i> ' + wp.name + waitNote;
            });
        }
        routeDisplay += ' <i class="fas fa-arrow-right" style="font-size: 10px; opacity: 0.5;"></i> <i class="fas fa-flag-checkered"></i> ' + trip.eN;
        
        // Prebook badge
        var prebookBadge = '';
        if (trip.prebook) {
            var prebookDate = new Date(trip.prebook);
            var prebookStr = prebookDate.toLocaleString('en-US', {
                month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true
            });
            prebookBadge = '<div class="prebook-badge" style="margin-bottom: 8px;">' +
                '<i class="fas fa-calendar-alt"></i> Prebook: ' + prebookStr +
            '</div>';
        }
        
        // Action buttons
        var actionButtons = '';
        if (isActive) {
            var waypointCount = trip.waypoints ? trip.waypoints.length : 0;
            var atFinalDestination = trip.phase === 'active' && (trip.currentWaypointIndex + 1) >= waypointCount;
            
            if (atFinalDestination) {
                actionButtons = 
                    '<button class="btn btn-sm btn-success" onclick="event.stopPropagation(); pickUpNow(' + trip.id + ');" style="flex: 1;">' +
                        '<i class="fas fa-check"></i> Complete' +
                    '</button>' +
                    '<button class="btn btn-sm" onclick="event.stopPropagation(); recalculateTrip(' + trip.id + ');" style="flex: 1;">' +
                        '<i class="fas fa-sync"></i> Recalc' +
                    '</button>';
            } else {
                actionButtons = 
                    '<button class="btn btn-sm btn-primary" onclick="event.stopPropagation(); pickUpNow(' + trip.id + ');" style="flex: 1;">' +
                        '<i class="fas fa-forward"></i> Next Phase' +
                    '</button>' +
                    '<button class="btn btn-sm" onclick="event.stopPropagation(); recalculateTrip(' + trip.id + ');" style="flex: 1;">' +
                        '<i class="fas fa-sync"></i> Recalc' +
                    '</button>';
            }
        } else {
            // Stacked trip - always show Activate Now button
            actionButtons = 
                '<button class="btn btn-sm btn-success" onclick="event.stopPropagation(); activateStackedTripManually(' + trip.id + ');" style="flex: 1;">' +
                    '<i class="fas fa-play"></i> Activate Now' +
                '</button>';
        }
        
        return '<div class="nested-call-card ' + cardClass + '" id="nested-trip-' + trip.id + '">' +
                '<div class="nested-card-header">' +
                    '<span class="nested-card-label ' + labelClass + '">' + labelText + '</span>' +
                    (timeInfo ? '<span class="nested-card-time">' + timeInfo + '</span>' : '') +
                '</div>' +
                prebookBadge +
                '<div class="nested-card-trip-name">' + trip.tripName + '</div>' +
                '<div class="nested-card-customer">' + (trip.cName || 'Anonymous') + '</div>' +
                '<div class="nested-card-phone">' + (trip.cPhone || 'No phone') + '</div>' +
                '<div class="nested-card-route">' + routeDisplay + '</div>' +
                (trip.notes ? '<div class="nested-card-notes"><i class="fas fa-sticky-note"></i> ' + trip.notes + '</div>' : '') +
                '<div class="nested-card-actions">' +
                    '<button class="btn btn-sm" onclick="event.stopPropagation(); copyTripSMSById(' + trip.id + ', \'live\');" style="flex: 1;">' +
                        '<i class="fas fa-copy"></i> Copy SMS' +
                    '</button>' +
                    actionButtons +
                    '<button class="btn btn-sm btn-danger" onclick="event.stopPropagation(); cancelTrip(' + trip.id + ');" style="flex: 1;">' +
                        '<i class="fas fa-times"></i> Cancel' +
                    '</button>' +
                    '<button class="btn btn-sm" onclick="event.stopPropagation(); returnToQueue(' + trip.id + ');" style="flex: 1;">' +
                        '<i class="fas fa-undo"></i> Return' +
                    '</button>' +
                '</div>' +
            '</div>';
    }

    /**
     * Toggle driver card expansion
     */
    function toggleDriverCardExpand(driverId) {
        var card = document.getElementById('driver-card-' + driverId);
        var details = document.getElementById('driver-details-' + driverId);
        
        if (!card || !details) return;
        
        var driver = DATA.roster.find(function(d) { return d.id === driverId; });
        if (!driver) return;
        
        var isExpanded = details.classList.contains('expanded');
        
        // Collapse all other cards first
        document.querySelectorAll('.driver-card-details.expanded').forEach(function(d) {
            d.classList.remove('expanded');
            var parentCard = d.closest('.driver-card-live');
            if (parentCard) parentCard.classList.remove('expanded');
            
            var otherDriverId = parseInt(d.id.replace('driver-details-', ''));
            var otherTrips = getDriverTrips(otherDriverId);
            otherTrips.forEach(function(trip) {
                clearLivePolyline(trip.id);
                clearApproachPolyline(trip.id);
            });
        });
        
        if (!isExpanded) {
            details.classList.add('expanded');
            card.classList.add('expanded');
            
            if (!STATE.showAllLiveCalls) {
                var trips = getDriverTrips(driverId);
                showDriverMarker(driverId);
                
                trips.forEach(function(trip) {
                    var isStacked = trip.status === 'stacked';
                    if (trip.geo) {
                        showLivePolyline(trip.id, trip.geo, driver.color, isStacked);
                    }
                    if (trip.phase === 'approach' && !isStacked) {
                        showApproachPolyline(trip.id);
                    }
                });
            }
        } else {
            if (!STATE.showAllLiveCalls) {
                clearDriverMarker(driverId);
                var trips = getDriverTrips(driverId);
                trips.forEach(function(trip) {
                    clearLivePolyline(trip.id);
                    clearApproachPolyline(trip.id);
                });
            }
        }
    }

    // ========================================================================
    // DRIVER CARD TIMERS
    // ========================================================================

    /**
     * Update driver card timers
     */
    function updateDriverCardTimers() {
        DATA.live.forEach(function(trip) {
            if (trip.status === 'stacked') return;
            
            var progressFill = document.getElementById('driver-progress-fill-' + trip.id);
            var progressText = document.getElementById('driver-progress-text-' + trip.id);
            
            if (!progressFill || !progressText) return;
            
            var now = Date.now();
            var progressPercent = 0;
            var phaseText = '';
            var timeRemaining = '';
            
            if (trip.phase === 'approach') {
                var phaseElapsed = now - trip.phaseStart;
                var phaseDuration = trip.phaseEnd - trip.phaseStart;
                progressPercent = Math.min(100, Math.max(0, (phaseElapsed / phaseDuration) * 100));
                phaseText = 'En route to pickup';
                
                var remainingSecs = Math.max(0, Math.ceil((trip.phaseEnd - now) / 1000));
                var mins = Math.floor(remainingSecs / 60);
                var secs = remainingSecs % 60;
                timeRemaining = mins + ':' + String(secs).padStart(2, '0');
                
            } else if (trip.phase === 'active') {
                var phaseElapsed = now - trip.phaseStart;
                var phaseDuration = trip.phaseEnd - trip.phaseStart;
                progressPercent = Math.min(100, Math.max(0, (phaseElapsed / phaseDuration) * 100));
                phaseText = 'En route';
                
                var remainingSecs = Math.max(0, Math.ceil((trip.phaseEnd - now) / 1000));
                var mins = Math.floor(remainingSecs / 60);
                var secs = remainingSecs % 60;
                timeRemaining = mins + ':' + String(secs).padStart(2, '0');
                
            } else if (trip.phase === 'waiting') {
                var phaseElapsed = now - trip.phaseStart;
                var phaseDuration = trip.phaseEnd - trip.phaseStart;
                progressPercent = Math.min(100, Math.max(0, (phaseElapsed / phaseDuration) * 100));
                phaseText = 'Waiting at stop';
                
                var remainingSecs = Math.max(0, Math.ceil((trip.phaseEnd - now) / 1000));
                var mins = Math.floor(remainingSecs / 60);
                var secs = remainingSecs % 60;
                timeRemaining = mins + ':' + String(secs).padStart(2, '0');
            }
            
            progressFill.style.width = progressPercent + '%';
            progressText.textContent = phaseText + (timeRemaining ? ' (' + timeRemaining + ')' : '');
        });
        
        // Update stacked trip countdown
        document.querySelectorAll('.nested-call-card.stacked-trip').forEach(function(card) {
            var tripId = parseInt(card.id.replace('nested-trip-', ''));
            var trip = DATA.live.find(function(t) { return t.id === tripId; });
            if (!trip) return;
            
            var timeEl = card.querySelector('.nested-card-time');
            if (!timeEl) return;
            
            var startsIn = Math.max(0, Math.ceil((trip.start - Date.now()) / 60000));
            if (startsIn > 60) {
                var hours = Math.floor(startsIn / 60);
                var mins = startsIn % 60;
                timeEl.textContent = 'Starts in ' + hours + 'h ' + mins + 'm';
            } else {
                timeEl.textContent = 'Starts in ' + startsIn + ' min';
            }
        });
    }

    // ========================================================================
    // PHASE MANAGEMENT
    // ========================================================================

    /**
     * Monitor trip phases and auto-advance
     */
    function monitorTripPhases() {
        var now = Date.now();
        var needsRender = false;
        
        DATA.live.forEach(function(trip) {
            // Check if stacked trip should activate
            if (trip.status === 'stacked' && now >= trip.start) {
                console.log('[STACK] ⚠️ Activating stacked trip:', {
                    id: trip.id,
                    tripName: trip.tripName,
                    driverId: trip.dr.id,
                    driverName: trip.dr.name,
                    startTime: new Date(trip.start).toLocaleTimeString(),
                    currentTime: new Date(now).toLocaleTimeString(),
                    minutesOverdue: Math.round((now - trip.start) / 60000)
                });
                
                trip.status = 'active';
                trip.phase = 'approach';
                trip.phaseStart = now;
                trip.phaseEnd = now + (trip.approach * 60000);
                needsRender = true;
                
                // Force-expand the driver card so they see the activation
                STATE.forceExpandDriverId = trip.dr.id;
                console.log('[STACK] ✅ Status changed: stacked → active, forcing card expansion for driver', trip.dr.name);
            }

            if (trip.status !== 'active') return;
            
            // Check if current phase has expired
            if (now >= trip.phaseEnd) {
                console.log('[TIME] Phase expired for ' + (trip.tripName || trip.id) + ': ' + trip.phase);
                
                if (trip.phase === 'approach') {
                    // Auto-advance to active phase
                    console.log('[OK] Approach complete, auto-advancing to active');
                    
                    trip.phase = 'active';
                    trip.currentWaypointIndex = -1;
                    trip.phaseOverdue = false;
                    
                    // Update driver position
                    var driver = DATA.roster.find(function(d) { return d.id === trip.dr.id; });
                    if (driver) {
                        driver.lastDrop = {
                            lat: trip.s[1],
                            lon: trip.s[0],
                            name: trip.sN
                        };
                        console.log('[MAP] Updated ' + driver.name + ' position: ' + trip.sN);
                    }
                    
                    // Calculate active phase duration
                    var activeDuration = trip.mins * 60000;
                    if (trip.waypoints && trip.waypoints.length > 0) {
                        var legs = trip.waypoints.length + 1;
                        activeDuration = (trip.mins * 60000) / legs;
                    }
                    
                    trip.phaseStart = now;
                    trip.phaseEnd = now + activeDuration;
                    
                    clearApproachPolyline(trip.id);
                    if (trip.geo) {
                        showLivePolyline(trip.id, trip.geo, trip.dr.color, false);
                    }
                    
                    needsRender = true;
                    
                } else if (trip.phase === 'active') {
                    // Check if at waypoint or destination
                    if (trip.waypoints && trip.waypoints.length > 0 && trip.currentWaypointIndex < trip.waypoints.length - 1) {
                        var nextWaypointIndex = trip.currentWaypointIndex + 1;
                        var waypoint = trip.waypoints[nextWaypointIndex];
                        
                        if (waypoint.waitTime && waypoint.waitTime > 0) {
                            console.log('[OK] Arrived at waypoint ' + (nextWaypointIndex + 1) + ', waiting ' + waypoint.waitTime + ' min');
                            trip.phase = 'waiting';
                            trip.currentWaypointIndex = nextWaypointIndex;
                            
                            var driver = DATA.roster.find(function(d) { return d.id === trip.dr.id; });
                            if (driver) {
                                driver.lastDrop = {
                                    lat: waypoint.coords[1],
                                    lon: waypoint.coords[0],
                                    name: waypoint.name
                                };
                            }
                            
                            trip.phaseStart = now;
                            trip.phaseEnd = now + (waypoint.waitTime * 60000);
                            trip.phaseOverdue = false;
                            needsRender = true;
                        } else {
                            console.log('[OK] Passed waypoint ' + (nextWaypointIndex + 1) + ', continuing');
                            trip.currentWaypointIndex = nextWaypointIndex;
                            
                            var legs = trip.waypoints.length + 1;
                            var legDuration = (trip.mins * 60000) / legs;
                            
                            trip.phaseStart = now;
                            trip.phaseEnd = now + legDuration;
                            needsRender = true;
                        }
                    } else {
                        if (!trip.phaseOverdue) {
                            trip.phaseOverdue = true;
                            needsRender = true;
                            console.log('[WARN] Trip complete, awaiting manual completion: ' + trip.id);
                        }
                    }
                    
                } else if (trip.phase === 'waiting') {
                    console.log('[OK] Wait complete, advancing to next leg');
                    trip.phase = 'active';
                    
                    var remainingWaypoints = trip.waypoints.length - trip.currentWaypointIndex - 1;
                    var legs = remainingWaypoints + 1;
                    var legDuration = (trip.end - now) / legs;
                    
                    trip.phaseStart = now;
                    trip.phaseEnd = now + Math.max(legDuration, 60000);
                    trip.phaseOverdue = false;
                    needsRender = true;
                }
            }
        });
        
        if (needsRender) {
            save();
            renderDriverCards();
        }
    }

    /**
     * Activate stacked trip immediately (during waiting phase)
     */
    function activateStackedTrip(tripId) {
        console.log('[LIVE] Activating stacked trip early: ' + tripId);
        
        var trip = DATA.live.find(function(t) { return t.id === tripId; });
        if (!trip || trip.status !== 'stacked') {
            console.error('[ERR] Trip ' + tripId + ' not found or not stacked');
            return;
        }
        
        // Verify driver's active trip is in waiting phase
        var driverActiveTrip = DATA.live.find(function(t) {
            return t.dr && t.dr.id === trip.dr.id && t.status === 'active';
        });
        
        if (!driverActiveTrip || driverActiveTrip.phase !== 'waiting') {
            showSystemMessage('Can only start stacked trip during waiting phase', 3000, 'warning');
            return;
        }
        
        var now = Date.now();
        
        // Calculate actual approach time from driver's current location
        var driver = DATA.roster.find(function(d) { return d.id === trip.dr.id; });
        var driverPos = driver ? (driver.currentLocation || driver.lastDrop) : null;
        
        if (driverPos && trip.s && typeof calculateApproachRoute === 'function') {
            // Async calculate real approach time
            calculateApproachRoute(trip.dr.id, trip.s).then(function(approachResult) {
                var approachMins = approachResult.duration || 5;
                
                trip.status = 'active';
                trip.phase = 'approach';
                trip.approach = approachMins;
                trip.start = now;
                trip.approachEnd = now + ((approachMins + (trip.buffer || 0)) * 60000);
                trip.end = now + ((trip.mins + approachMins + (trip.buffer || 0)) * 60000);
                trip.phaseStart = now;
                trip.phaseEnd = trip.approachEnd;
                
                // Update approach polyline if available
                if (approachResult.geo) {
                    trip.approachGeo = approachResult.geo;
                    if (typeof showApproachPolyline === 'function') {
                        showApproachPolyline(trip.id, approachResult.geo, trip.dr.color);
                    }
                }
                
                save();
                renderDriverCards();
                
                showSystemMessage('Stacked trip activated: ' + trip.tripName + ' (ETA ' + approachMins + ' min)', 3000, 'success');
                console.log('[OK] Stacked trip ' + tripId + ' activated with calculated approach: ' + approachMins + ' min');
            }).catch(function(err) {
                console.warn('[WARN] Approach calc failed, using default 5 min:', err);
                activateWithDefaultApproach(trip, now, 5);
            });
        } else {
            // Fallback to default 5 min if no position data
            activateWithDefaultApproach(trip, now, 5);
        }
    }
    
    // Helper for fallback activation
    function activateWithDefaultApproach(trip, now, approachMins) {
        trip.status = 'active';
        trip.phase = 'approach';
        trip.approach = approachMins;
        trip.start = now;
        trip.approachEnd = now + ((approachMins + (trip.buffer || 0)) * 60000);
        trip.end = now + ((trip.mins + approachMins + (trip.buffer || 0)) * 60000);
        trip.phaseStart = now;
        trip.phaseEnd = trip.approachEnd;
        
        save();
        renderDriverCards();
        
        showSystemMessage('Stacked trip activated: ' + trip.tripName, 3000, 'success');
        console.log('[OK] Stacked trip activated with default approach: ' + approachMins + ' min');
    }

    /**
     * Advance trip to next phase manually
     */
    function pickUpNow(tripId) {
        console.log('[LIVE] pickUpNow called with tripId: ' + tripId);
        
        var trip = DATA.live.find(function(t) { return t.id === tripId; });
        if (!trip) {
            console.error('[ERR] Trip ' + tripId + ' not found');
            return;
        }
        
        var now = Date.now();
        console.log('[LIVE] Advancing phase for trip ' + tripId + ' (current phase: ' + trip.phase + ')');
        
        if (trip.phase === 'waiting') {
            trip.phase = 'active';
            trip.currentWaypointIndex++;
            TimingService.recalculateRemainingRoute(trip);
            console.log('[OK] Waiting complete, advancing to waypoint ' + trip.currentWaypointIndex);
            
        } else if (trip.phase === 'approach') {
            clearApproachPolyline(tripId);
            trip.phase = 'active';
            trip.approachEnd = now;
            
            var driver = DATA.roster.find(function(d) { return d.id === trip.dr.id; });
            if (driver) {
                driver.lastDrop = {
                    lat: trip.s[1],
                    lon: trip.s[0],
                    name: trip.sN
                };
                console.log('[MAP] Updated ' + driver.name + ' position: ' + trip.sN);
            }
            
            var totalLegs = (trip.waypoints ? trip.waypoints.length : 0) + 1;
            var legDuration = Math.ceil(trip.mins / totalLegs);
            trip.phaseStart = now;
            trip.phaseEnd = now + (legDuration * 60000);
            
            console.log('[OK] Arrived at pickup, trip started');
            
        } else if (trip.phase === 'active') {
            trip.currentWaypointIndex++;
            
            if (trip.waypoints && trip.currentWaypointIndex < trip.waypoints.length) {
                var waypoint = trip.waypoints[trip.currentWaypointIndex];
                
                if (waypoint.waitTime > 0) {
                    trip.phase = 'waiting';
                    trip.waitStart = now;
                    trip.waitEnd = now + (waypoint.waitTime * 60000);
                    trip.phaseStart = now;
                    trip.phaseEnd = trip.waitEnd;
                    
                    console.log('[WAIT] Waiting at waypoint ' + trip.currentWaypointIndex + ' for ' + waypoint.waitTime + ' min');
                } else {
                    TimingService.recalculateRemainingRoute(trip);
                    console.log('[OK] Passed waypoint ' + trip.currentWaypointIndex + ', continuing');
                }
            } else {
                console.log('[OK] Trip completed, auto-completing');
                save();
                completeTrip(trip.id);
                return;
            }
        }
        
        save();
        renderDriverCards();
    }

    // ========================================================================
    // TIMING FUNCTIONS - MOVED TO kernel-timing.js
    // ========================================================================
    // recalculateRemainingRoute() - moved to kernel-timing.js
    // adjustBuffer() - moved to kernel-timing.js

    // ========================================================================
    // TRIP OPERATIONS
    // ========================================================================

    /**
     * Complete trip
     */
    /**
     * Manually activate a stacked trip
     */
    function activateStackedTripManually(tripId) {
        var trip = DATA.live.find(function(t) { return t.id === tripId; });
        if (!trip || trip.status !== 'stacked') {
            console.error('[ERR] Trip not found or not stacked');
            return;
        }
        
        console.log('[LIVE] Manually activating stacked trip: ' + trip.tripName);
        
        // Check if driver has an active trip
        var driverActiveTrip = DATA.live.find(function(t) {
            return t.dr && t.dr.id === trip.dr.id && t.status === 'active';
        });
        
        if (driverActiveTrip) {
            // Complete the current active trip first
            if (confirm('Complete current trip "' + driverActiveTrip.tripName + '" to activate "' + trip.tripName + '"?')) {
                completeTrip(driverActiveTrip.id);
                // The stacked trip will auto-activate via completeTrip logic
            }
        } else {
            // No active trip, calculate actual approach time
            var now = Date.now();
            var driver = DATA.roster.find(function(d) { return d.id === trip.dr.id; });
            
            if (driver && (driver.currentLocation || driver.lastDrop) && trip.s && typeof calculateApproachRoute === 'function') {
                calculateApproachRoute(driver.id, trip.s).then(function(approachResult) {
                    var approachMins = approachResult.duration || 5;
                    
                    trip.status = 'active';
                    trip.phase = 'approach';
                    trip.approach = approachMins;
                    trip.start = now;
                    trip.approachEnd = now + ((approachMins + (trip.buffer || 0)) * 60000);
                    trip.end = now + ((trip.mins + approachMins + (trip.buffer || 0)) * 60000);
                    trip.phaseStart = now;
                    trip.phaseEnd = trip.approachEnd;
                    
                    if (approachResult.geo) {
                        trip.approachGeo = approachResult.geo;
                        if (typeof showApproachPolyline === 'function') {
                            showApproachPolyline(trip.id, approachResult.geo, trip.dr.color);
                        }
                    }
                    
                    console.log('[OK] Stacked trip activated manually with approach: ' + approachMins + ' min');
                    
                    save();
                    updateBadges();
                    renderDriverCards();
                    showSystemMessage('Trip activated: ' + trip.tripName + ' (ETA ' + approachMins + ' min)', 3000, 'success');
                }).catch(function(err) {
                    console.warn('[WARN] Approach calc failed, using default:', err);
                    activateWithDefaultApproach(trip, now, 5);
                    updateBadges();
                });
            } else {
                // Fallback to default 5 min
                activateWithDefaultApproach(trip, now, 5);
                updateBadges();
            }
        }
    }

    function completeTrip(tripId) {
        var trip = DATA.live.find(function(t) { return t.id === tripId; });
        if (!trip) return;
        
        console.log('[OK] Completing trip ' + tripId);
        
        // Update driver position
        var driver = DATA.roster.find(function(d) { return d.id === trip.dr.id; });
        if (driver) {
            driver.lastDrop = {
                lat: trip.e[1],
                lon: trip.e[0],
                name: trip.eN
            };
            console.log('[MAP] Updated ' + driver.name + ' lastDrop: ' + trip.eN);
            
            // FIX: Update driver marker on map
            if (typeof showDriverMarker === 'function') {
                showDriverMarker(driver.id);
            }
        }
        
        // Move to dispatch sheet
        DATA.dispatchSheet.push({
            id: trip.id,
            ts: trip.ts,
            cName: trip.cName,
            cPhone: trip.cPhone,
            tripName: trip.tripName,
            prebook: trip.prebook,
            notes: trip.notes,
            geo: trip.geo,
            mins: trip.mins,
            s: trip.s,
            e: trip.e,
            sN: trip.sN,
            eN: trip.eN,
            waypoints: trip.waypoints,
            dr: trip.dr,
            completedAt: Date.now(),
            status: 'completed'
        });
        
        // Remove from live
        DATA.live = DATA.live.filter(function(t) { return t.id !== tripId; });
        
        // Clear polylines
        clearLivePolyline(tripId);
        clearApproachPolyline(tripId);
        
        // Check for stacked trips
        var stackedTrips = DATA.live.filter(function(t) {
            return t.dr && t.dr.id === trip.dr.id && t.status === 'stacked';
        }).sort(function(a, b) { return a.start - b.start; });
        
        if (stackedTrips.length > 0) {
            var nextTrip = stackedTrips[0];
            console.log('[STACK] Activating stacked trip: ' + nextTrip.tripName);
            
            var now = Date.now();
            
            // Calculate actual approach time from driver's NEW lastDrop position (just updated)
            if (driver && driver.lastDrop && nextTrip.s && typeof calculateApproachRoute === 'function') {
                calculateApproachRoute(driver.id, nextTrip.s).then(function(approachResult) {
                    var approachMins = approachResult.duration || 5;
                    
                    nextTrip.status = 'active';
                    nextTrip.phase = 'approach';
                    nextTrip.approach = approachMins;
                    nextTrip.start = now;
                    nextTrip.approachEnd = now + ((approachMins + (nextTrip.buffer || 0)) * 60000);
                    nextTrip.end = now + ((nextTrip.mins + approachMins + (nextTrip.buffer || 0)) * 60000);
                    nextTrip.phaseStart = now;
                    nextTrip.phaseEnd = nextTrip.approachEnd;
                    
                    // Update approach polyline
                    if (approachResult.geo) {
                        nextTrip.approachGeo = approachResult.geo;
                        if (typeof showApproachPolyline === 'function') {
                            showApproachPolyline(nextTrip.id, approachResult.geo, nextTrip.dr.color);
                        }
                    }
                    
                    save();
                    renderDriverCards();
                    console.log('[OK] Stacked trip activated with calculated approach: ' + approachMins + ' min');
                }).catch(function(err) {
                    console.warn('[WARN] Approach calc failed for stacked trip, using default:', err);
                    activateWithDefaultApproach(nextTrip, now, 5);
                });
            } else {
                // Fallback to default 5 min
                activateWithDefaultApproach(nextTrip, now, 5);
            }
        }
        
        save();
        updateBadges();
        renderDriverCards();
        if (typeof renderRoster === 'function') renderRoster();
        if (typeof renderDispatchSheet === 'function') renderDispatchSheet();
        
        showSystemMessage('Trip completed', 3000, 'success');
        console.log('[OK] Trip completed: ' + trip.tripName);
    }

    /**
     * Cancel trip
     */
    function cancelTrip(tripId) {
        var trip = DATA.live.find(function(t) { return t.id === tripId; });
        if (!trip) return;
        
        // Move to dispatch sheet with cancelled status
        DATA.dispatchSheet.push({
            id: trip.id,
            ts: trip.ts,
            cName: trip.cName,
            cPhone: trip.cPhone,
            tripName: trip.tripName,
            notes: trip.notes,
            sN: trip.sN,
            eN: trip.eN,
            waypoints: trip.waypoints,
            dr: trip.dr,
            completedAt: Date.now(),
            status: 'cancelled'
        });
        
        // Remove from live
        DATA.live = DATA.live.filter(function(t) { return t.id !== tripId; });
        
        // Clear polylines
        clearLivePolyline(tripId);
        clearApproachPolyline(tripId);
        
        save();
        updateBadges();
        renderDriverCards();
        
        showSystemMessage('Trip cancelled', 3000, 'warning');
        console.log('[OK] Trip cancelled: ' + trip.tripName);
    }

    /**
     * Return trip to queue
     */
    function returnToQueue(tripId) {
        var trip = DATA.live.find(function(t) { return t.id === tripId; });
        if (!trip) return;
        
        // Clear polylines
        clearLivePolyline(tripId);
        clearApproachPolyline(tripId);
        
        // Create queue job
        var queueTrip = {
            id: trip.id,
            ts: trip.ts,
            cName: trip.cName,
            cPhone: trip.cPhone,
            tripName: trip.tripName,
            prebook: trip.prebook,
            notes: trip.notes,
            buffer: trip.buffer,
            geo: trip.geo,
            mins: trip.mins,
            minsWithTraffic: trip.minsWithTraffic,
            s: trip.s,
            e: trip.e,
            sN: trip.sN,
            eN: trip.eN,
            waypoints: trip.waypoints,
            pickupQuote: trip.pickupQuote
        };
        
        DATA.queue.push(queueTrip);
        DATA.live = DATA.live.filter(function(t) { return t.id !== tripId; });
        
        save();
        updateBadges();
        renderQueue();
        renderDriverCards();
        
        showSystemMessage('Trip returned to queue', 3000, 'info');
        console.log('[OK] Trip returned to queue: ' + trip.tripName);
    }

    /**
     * Recalculate ETA for active trip
     */
    function recalculateTrip(tripId) {
        var trip = DATA.live.find(function(t) { return t.id === tripId; });
        if (!trip) return;

        showSystemMessage('Recalculating ETA...', 2000, 'info');

        TimingService.recalculateETA(tripId).then(function(result) {
            if (result) {
                var changeText = result.changeFromOriginal > 0
                    ? '+' + result.changeFromOriginal + ' min delay'
                    : result.changeFromOriginal < 0
                        ? result.changeFromOriginal + ' min ahead'
                        : 'On time';

                showSystemMessage(
                    'ETA: ' + result.updatedMinutes + 'min (' + changeText + ') - ' + result.reason,
                    5000,
                    result.changeFromOriginal > 5 ? 'warning' : 'success'
                );

                console.log('📞 Customer message: ' + result.customerMessage);
            }
        });
    }

    // ========================================================================
    // GLOBAL ETA SYSTEM - MOVED TO kernel-timing.js
    // ========================================================================
    // analyzeDriverAvailability() - moved to kernel-timing.js
    // calculateDeterministicETA() - moved to kernel-timing.js
    // calculateGlobalTaxiETA() - moved to kernel-timing.js
    // updateGlobalETA() - moved to kernel-timing.js

    // ========================================================================
    // INITIALIZATION
    // ========================================================================

    /**
     * Initialize intervals
     */
    function initLiveIntervals() {
        // Guard: Only initialize once
        if (STATE.liveTimersInitialized) {
            console.log('[WARN] Live timers already initialized, skipping');
            return;
        }
        
        // Clear existing
        if (STATE.intervals.driverTimers) clearInterval(STATE.intervals.driverTimers);
        if (STATE.intervals.phaseMonitor) clearInterval(STATE.intervals.phaseMonitor);
        if (STATE.intervals.globalETA) clearInterval(STATE.intervals.globalETA);
        
        // Start intervals
        STATE.intervals.driverTimers = setInterval(updateDriverCardTimers, 1000);
        STATE.intervals.phaseMonitor = setInterval(monitorTripPhases, 1000);
        
        // Mark as initialized
        STATE.liveTimersInitialized = true;
        console.log('[OK] Live timers initialized');
        
        // Global ETA
        TimingService.updateGlobalETA();
        STATE.intervals.globalETA = setInterval(TimingService.updateGlobalETA, 30000);
        
        console.log('[OK] Live intervals initialized');
    }

    // ========================================================================
    // EXPOSE TO GLOBAL SCOPE
    // ========================================================================

    // Job activation
    window.activateJob = activateJob;
    
    // Driver cards
    window.renderDriverCards = renderDriverCards;
    window.toggleDriverCardExpand = toggleDriverCardExpand;
    window.updateDriverCardTimers = updateDriverCardTimers;
    
    // Phase management
    window.monitorTripPhases = monitorTripPhases;
    window.pickUpNow = pickUpNow;
    window.activateStackedTrip = activateStackedTrip;
    // recalculateRemainingRoute moved to kernel-timing.js
    
    // Trip operations
    // adjustBuffer moved to kernel-timing.js
    window.activateStackedTripManually = activateStackedTripManually;
    window.completeTrip = completeTrip;
    window.cancelTrip = cancelTrip;
    window.returnToQueue = returnToQueue;
    window.recalculateTrip = recalculateTrip;
    
    // Global ETA
    
    // Initialization
    window.initLiveIntervals = initLiveIntervals;
    
    // ========================================================================
    // AUTO-INITIALIZATION
    // ========================================================================
    
    // Start live timers when page loads
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() {
            console.log('🎬 Auto-initializing live timers...');
            initLiveIntervals();
        });
    } else {
        console.log('🎬 Auto-initializing live timers (immediate)...');
        initLiveIntervals();
    }

})();