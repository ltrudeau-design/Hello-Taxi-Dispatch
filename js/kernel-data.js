// ============================================================================
// HELLO TAXI DISPATCH V100 - KERNEL-DATA.JS
// ============================================================================
// Data Management Kernel
// Roster, Clients, Nicknames, Dispatch Sheet, Session Notes, SMS Generation
// 
// Dependencies: kernel-core.js (CONFIG, DATA, STATE, save())
//               kernel-live.js (renderDriverCards())
// ============================================================================

(function() {
    'use strict';
    
    console.log('📦 Loading kernel-data.js...');
    
    // ============================================================================
    // CLIENTS MODULE
    // ============================================================================
    
    /**
     * Render clients list
     */
    function renderClients() {
        const container = document.getElementById('clients-list');
        const countBadge = document.getElementById('clients-count');
        
        if (!container) return;
        
        container.innerHTML = '';
        
        if (DATA.clients.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; padding: 20px; color: rgba(255, 255, 255, 0.5);">
                    <i class="fas fa-users fa-2x" style="opacity: 0.3; margin-bottom: 12px;"></i>
                    <p style="font-size: 13px;">No clients saved.</p>
                </div>
            `;
            if (countBadge) countBadge.textContent = '0';
            return;
        }
        
        // Sort alphabetically by name
        const sortedClients = [...DATA.clients].sort((a, b) => 
            a.name.localeCompare(b.name)
        );
        
        sortedClients.forEach(client => {
            const card = document.createElement('div');
            card.className = 'driver-card';
            card.style.marginBottom = '8px';
            card.style.cursor = 'pointer';
            
            // Truncate notes for preview
            const notesPreview = client.notes ? 
                (client.notes.length > 50 ? client.notes.substring(0, 50) + '...' : client.notes) : 
                'No notes';
            
            card.innerHTML = `
                <div class="driver-info" style="flex: 1;">
                    <div class="driver-name" style="font-size: 14px;">${client.name}</div>
                    <div class="driver-details" style="font-size: 12px;">
                        <i class="fas fa-phone"></i>
                        <span>${client.phone}</span>
                    </div>
                    <div style="font-size: 11px; color: rgba(255,255,255,0.5); margin-top: 4px; font-style: italic;">
                        ${notesPreview}
                    </div>
                </div>
                <div class="driver-actions">
                    <button class="btn btn-sm" onclick="editClient(${client.id}); event.stopPropagation();">
                        <i class="fas fa-edit"></i>
                    </button>
                </div>
            `;
            
            container.appendChild(card);
        });
        
        if (countBadge) countBadge.textContent = DATA.clients.length;
        console.log(`✅ Clients rendered: ${DATA.clients.length}`);
    }
    
    /**
     * Clear client form
     */
    function clearClientForm() {
        document.getElementById('client-phone').value = '';
        document.getElementById('client-name').value = '';
        document.getElementById('client-notes').value = '';
        
        // Hide delete button
        document.getElementById('delete-client-btn').style.display = 'none';
        
        // Reset editing state
        STATE.editingClientId = null;
        
        // Update button text
        document.getElementById('client-submit-btn').innerHTML = '<i class="fas fa-plus"></i> Add Client';
        
        console.log('✅ Client form cleared');
    }
    
    /**
     * Add or update client
     */
    function addClient() {
        const phone = document.getElementById('client-phone').value.trim();
        const name = document.getElementById('client-name').value.trim();
        const notes = document.getElementById('client-notes').value.trim();
        
        // Validation
        if (!phone) {
            alert('Please enter phone number');
            return;
        }
        
        if (!name) {
            alert('Please enter customer name');
            return;
        }
        
        // Check if editing existing client
        if (STATE.editingClientId) {
            const client = DATA.clients.find(c => c.id === STATE.editingClientId);
            if (client) {
                client.phone = phone;
                client.name = name;
                client.notes = notes;
                
                console.log(`✅ Client updated: ${name}`);
            }
        } else {
            // Check for duplicate phone
            const existing = DATA.clients.find(c => c.phone === phone);
            if (existing) {
                alert('A client with this phone number already exists');
                return;
            }
            
            // Create new client
            const newClient = {
                id: Date.now(),
                phone: phone,
                name: name,
                notes: notes,
                locations: []
            };
            
            DATA.clients.push(newClient);
            console.log(`✅ Client created: ${name}`);
        }
        
        save();
        renderClients();
        clearClientForm();
    }
    
    /**
     * Edit client
     */
    function editClient(id) {
        const client = DATA.clients.find(c => c.id === id);
        if (!client) return;
        
        // Populate form
        document.getElementById('client-phone').value = client.phone;
        document.getElementById('client-name').value = client.name;
        document.getElementById('client-notes').value = client.notes || '';
        
        // Show delete button
        document.getElementById('delete-client-btn').style.display = 'inline-block';
        
        // Set editing state
        STATE.editingClientId = id;
        
        // Update button text
        document.getElementById('client-submit-btn').innerHTML = '<i class="fas fa-save"></i> Update Client';
        
        // Scroll to top
        document.querySelector('#settings-overlay .overlay-body').scrollTop = 0;
        
        console.log(`📝 Editing client: ${client.name}`);
    }
    
    /**
     * Delete client
     */
    function deleteClient() {
        if (!STATE.editingClientId) return;
        
        const client = DATA.clients.find(c => c.id === STATE.editingClientId);
        if (!client) return;
        
        // Remove from clients
        DATA.clients = DATA.clients.filter(c => c.id !== client.id);
        
        save();
        renderClients();
        clearClientForm();
        
        console.log(`✅ Client deleted: ${client.name}`);
    }
    
    // ============================================================================
    // NICKNAMES MODULE
    // ============================================================================
    
    /**
     * Render place nicknames list
     */
    function renderPlaceNicknames() {
        const container = document.getElementById('nicknames-list');
        const countBadge = document.getElementById('nicknames-count');
        
        if (!container) return;
        
        container.innerHTML = '';
        
        if (DATA.placeNicknames.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; padding: 20px; color: rgba(255, 255, 255, 0.5);">
                    <i class="fas fa-map-marker-alt fa-2x" style="opacity: 0.3; margin-bottom: 12px;"></i>
                    <p style="font-size: 13px;">No place nicknames saved.</p>
                </div>
            `;
            if (countBadge) countBadge.textContent = '0';
            return;
        }
        
        // Sort alphabetically by nickname
        const sortedNicknames = [...DATA.placeNicknames].sort((a, b) => 
            a.nickname.localeCompare(b.nickname)
        );
        
        sortedNicknames.forEach(place => {
            const card = document.createElement('div');
            card.className = 'driver-card';
            card.style.marginBottom = '8px';
            card.innerHTML = `
                <div class="driver-info" style="flex: 1;">
                    <div class="driver-name" style="font-size: 14px;">${place.nickname} → ${place.formal}</div>
                    <div class="driver-details" style="font-size: 12px;">
                        <i class="fas fa-map-marker-alt"></i>
                        <span>${place.address}</span>
                    </div>
                </div>
                <div class="driver-actions">
                    <button class="btn btn-sm btn-danger" onclick="deletePlaceNickname(${place.id})">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            `;
            container.appendChild(card);
        });
        
        if (countBadge) countBadge.textContent = DATA.placeNicknames.length;
        console.log(`✅ Place nicknames rendered: ${DATA.placeNicknames.length}`);
    }
    
    /**
     * Clear nickname form
     */
    function clearNicknameForm() {
        document.getElementById('nickname-short').value = '';
        document.getElementById('nickname-formal').value = '';
        document.getElementById('nickname-address').value = '';
        
        // Clear data attributes
        document.getElementById('nickname-address').dataset.lat = '';
        document.getElementById('nickname-address').dataset.lon = '';
        
        // Hide delete button
        document.getElementById('delete-nickname-btn').style.display = 'none';
        
        console.log('✅ Nickname form cleared');
    }
    
    /**
     * Add place nickname
     */
    function addPlaceNickname() {
        const nickname = document.getElementById('nickname-short').value.trim();
        const formal = document.getElementById('nickname-formal').value.trim();
        const address = document.getElementById('nickname-address').value.trim();
        const lat = parseFloat(document.getElementById('nickname-address').dataset.lat);
        const lon = parseFloat(document.getElementById('nickname-address').dataset.lon);
        
        // Validation
        if (!nickname) {
            alert('Please enter a nickname');
            return;
        }
        
        if (!formal) {
            alert('Please enter a formal name');
            return;
        }
        
        if (!address || !lat || !lon) {
            alert('Please select an address from suggestions or use map pin');
            return;
        }
        
        // Check for duplicate nickname
        const existing = DATA.placeNicknames.find(p => 
            p.nickname.toLowerCase() === nickname.toLowerCase()
        );
        if (existing) {
            alert('A place with this nickname already exists');
            return;
        }
        
        // Create new place nickname
        const newPlace = {
            id: Date.now(),
            nickname: nickname,
            formal: formal,
            address: address,
            coords: [lon, lat]  // [lon, lat] format
        };
        
        DATA.placeNicknames.push(newPlace);
        
        save();
        renderPlaceNicknames();
        clearNicknameForm();
        
        console.log(`✅ Place nickname created: ${nickname} → ${formal}`);
    }
    
    /**
     * Delete place nickname
     */
    function deletePlaceNickname(id) {
        const place = DATA.placeNicknames.find(p => p.id === id);
        if (!place) return;
        
        // Remove from placeNicknames
        DATA.placeNicknames = DATA.placeNicknames.filter(p => p.id !== id);
        
        save();
        renderPlaceNicknames();
        
        console.log(`✅ Place nickname deleted: ${place.nickname}`);
    }
    
    // ============================================================================
    // ROSTER MODULE
    // ============================================================================
    
    /**
     * Initialize color swatches
     */
    function initSwatches() {
        const container = document.getElementById('color-swatches');
        if (!container) return;
        
        container.innerHTML = '';
        
        CONFIG.COLORS.forEach((color, index) => {
            const swatch = document.createElement('div');
            swatch.className = 'swatch';
            swatch.style.backgroundColor = color;
            swatch.dataset.color = color;
            swatch.onclick = function() {
                // Remove selected class from all swatches
                document.querySelectorAll('.swatch').forEach(s => s.classList.remove('selected'));
                // Add selected class to clicked swatch
                this.classList.add('selected');
            };
            
            container.appendChild(swatch);
        });
        
        // Select first color by default
        container.firstChild.classList.add('selected');
        
        console.log('✅ Color swatches initialized');
    }
    
    /**
     * Get selected color from swatches
     */
    function getSelectedColor() {
        const selected = document.querySelector('.swatch.selected');
        return selected ? selected.dataset.color : CONFIG.COLORS[0];
    }
    
    /**
     * Clear driver form
     */
    function clearDriverForm() {
        document.getElementById('driver-name').value = '';
        document.getElementById('driver-phone').value = '';
        document.getElementById('driver-car').value = '';
        
        // Reset color selection to first color
        document.querySelectorAll('.swatch').forEach(s => s.classList.remove('selected'));
        document.querySelector('.swatch').classList.add('selected');
        
        // Hide delete button
        document.getElementById('delete-driver-btn').style.display = 'none';
        
        // Reset editing state
        STATE.editingDriverId = null;
        
        // Update button text
        document.getElementById('roster-submit-btn').innerHTML = '<i class="fas fa-plus"></i> Create Driver';
        
        console.log('✅ Driver form cleared');
    }
    
    /**
     * Render roster list
     */
    function renderRoster() {
        const container = document.getElementById('roster-list');
        if (!container) return;
        
        container.innerHTML = '';
        
        if (DATA.roster.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; padding: 40px; color: rgba(255, 255, 255, 0.5);">
                    <i class="fas fa-users fa-3x" style="opacity: 0.3; margin-bottom: 16px;"></i>
                    <p>No drivers in roster. Add your first driver above.</p>
                </div>
            `;
            var rosterCount = document.getElementById('roster-count');
            if (rosterCount) rosterCount.textContent = '0';
            return;
        }
        
        // Sort: clocked-in first, then alphabetical
        const sortedRoster = [...DATA.roster].sort((a, b) => {
            const aClocked = DATA.shift.includes(a.id);
            const bClocked = DATA.shift.includes(b.id);
            
            if (aClocked && !bClocked) return -1;
            if (!aClocked && bClocked) return 1;
            
            return a.name.localeCompare(b.name);
        });
        
        sortedRoster.forEach(driver => {
            const isClockedIn = DATA.shift.includes(driver.id);
            const onBreak = DATA.breaks.find(b => b.driverId === driver.id && b.active);
            const hasBusyJob = DATA.live.some(trip => trip.dr && trip.dr.id === driver.id);
            
            let status = 'off';
            let statusText = 'Off Duty';
            
            if (isClockedIn) {
                if (onBreak) {
                    status = 'break';
                    statusText = 'On Break';
                } else if (hasBusyJob) {
                    status = 'busy';
                    statusText = 'Busy';
                } else {
                    status = 'available';
                    statusText = 'Available';
                }
            }
            
            const card = document.createElement('div');
            card.className = 'driver-card';
            card.innerHTML = `
                <div class="driver-info">
                    <div class="driver-name">${driver.name}</div>
                    <div class="driver-details">
                        <div class="driver-color-indicator" style="background-color: ${driver.color};"></div>
                        <span>Car ${driver.car || 'N/A'}</span>
                        <span>•</span>
                        <span>${driver.call}</span>
                    </div>
                </div>
                <div class="driver-actions">
                    <span class="status-badge status-${status}">${statusText}</span>
                    ${isClockedIn ? `
                        <button class="btn btn-sm" onclick="clk(${driver.id})">
                            <i class="fas fa-clock"></i> Clock Out
                        </button>
                    ` : `
                        <button class="btn btn-sm btn-success" onclick="clk(${driver.id})">
                            <i class="fas fa-clock"></i> Clock In
                        </button>
                    `}
                    ${isClockedIn && !onBreak ? `
                        <button class="btn btn-sm" onclick="startBreak(${driver.id})">
                            <i class="fas fa-coffee"></i> Break
                        </button>
                    ` : ''}
                    ${onBreak ? `
                        <button class="btn btn-sm btn-primary" onclick="endBreak(${driver.id})">
                            <i class="fas fa-play"></i> End Break
                        </button>
                    ` : ''}
                    <button class="btn btn-sm" onclick="editDriver(${driver.id})">
                        <i class="fas fa-edit"></i> Edit
                    </button>
                </div>
            `;
            
            container.appendChild(card);
        });
        
        var rosterCount = document.getElementById('roster-count');
        if (rosterCount) rosterCount.textContent = DATA.roster.length;
        console.log(`✅ Roster rendered: ${DATA.roster.length} drivers`);
    }
    
    /**
     * Add or update driver
     */
    function addDriver() {
        const name = document.getElementById('driver-name').value.trim();
        const phone = document.getElementById('driver-phone').value.trim();
        const car = document.getElementById('driver-car').value.trim();
        const color = getSelectedColor();
        
        // Validation
        if (!name) {
            alert('Please enter driver name');
            return;
        }
        
        if (!phone) {
            alert('Please enter phone number');
            return;
        }
        
        if (car.length > 2) {
            alert('Car number must be max 2 characters');
            return;
        }
        
        // Check if editing existing driver
        if (STATE.editingDriverId) {
            const driver = DATA.roster.find(d => d.id === STATE.editingDriverId);
            if (driver) {
                driver.name = name;
                driver.call = phone;
                driver.car = car;
                driver.color = color;
                
                console.log(`✅ Driver updated: ${name}`);
            }
        } else {
            // Create new driver
            const newDriver = {
                id: Date.now(),
                name: name,
                call: phone,
                car: car,
                color: color,
                lastDrop: null
            };
            
            DATA.roster.push(newDriver);
            console.log(`✅ Driver created: ${name}`);
        }
        
        save();
        renderRoster();
        clearDriverForm();
    }
    
    /**
     * Edit driver
     */
    function editDriver(id) {
        const driver = DATA.roster.find(d => d.id === id);
        if (!driver) return;
        
        // Populate form
        document.getElementById('driver-name').value = driver.name;
        document.getElementById('driver-phone').value = driver.call;
        document.getElementById('driver-car').value = driver.car || '';
        
        // Select color
        document.querySelectorAll('.swatch').forEach(swatch => {
            if (swatch.dataset.color === driver.color) {
                swatch.classList.add('selected');
            } else {
                swatch.classList.remove('selected');
            }
        });
        
        // Show delete button
        document.getElementById('delete-driver-btn').style.display = 'inline-block';
        
        // Set editing state
        STATE.editingDriverId = id;
        
        // Update button text
        document.getElementById('roster-submit-btn').innerHTML = '<i class="fas fa-save"></i> Update Driver';
        
        // Scroll to top
        document.querySelector('.overlay-body').scrollTop = 0;
        
        console.log(`📝 Editing driver: ${driver.name}`);
    }
    
    /**
     * Delete driver
     */
    function deleteDriver() {
        if (!STATE.editingDriverId) return;
        
        const driver = DATA.roster.find(d => d.id === STATE.editingDriverId);
        if (!driver) return;
        
        // Validation: cannot delete if clocked in
        if (DATA.shift.includes(driver.id)) {
            alert('Cannot delete driver who is clocked in. Please clock them out first.');
            return;
        }
        
        // Validation: cannot delete if has active job
        const hasActiveJob = DATA.live.some(trip => trip.dr && trip.dr.id === driver.id);
        if (hasActiveJob) {
            alert('Cannot delete driver with active job. Please complete or reassign their trips first.');
            return;
        }
        
        // Track deleted driver ID (file-as-master sync)
        var deletedDriverIds = JSON.parse(localStorage.getItem(CONFIG.DB + '_deletedDrivers') || '[]');
        if (deletedDriverIds.indexOf(driver.id) === -1) {
            deletedDriverIds.push(driver.id);
            localStorage.setItem(CONFIG.DB + '_deletedDrivers', JSON.stringify(deletedDriverIds));
        }
        
        // Remove from roster
        DATA.roster = DATA.roster.filter(d => d.id !== driver.id);
        
        // Remove from turn sequence
        DATA.turnSequence = DATA.turnSequence.filter(id => id !== driver.id);
        
        save();
        renderRoster();
        clearDriverForm();
        
        console.log(`✅ Driver deleted: ${driver.name} (tracked for sync exclusion)`);
    }
    
    /**
     * Clock in/out driver
     */
    function clk(id) {
        const driver = DATA.roster.find(d => d.id === id);
        if (!driver) return;
        
        const isClockedIn = DATA.shift.includes(id);
        
        if (isClockedIn) {
            // Clock out
            DATA.shift = DATA.shift.filter(dId => dId !== id);
            
            // End any active break
            const activeBreak = DATA.breaks.find(b => b.driverId === id && b.active);
            if (activeBreak) {
                activeBreak.active = false;
                activeBreak.end = Date.now();
            }
            
            // Remove from turn sequence
            DATA.turnSequence = DATA.turnSequence.filter(dId => dId !== id);
            
            console.log(`⏰ Driver clocked out: ${driver.name}`);
        } else {
            // Clock in
            DATA.shift.push(id);
            
            // Add to turn sequence if not already there
            if (!DATA.turnSequence.includes(id)) {
                DATA.turnSequence.push(id);
            }
            
            console.log(`⏰ Driver clocked in: ${driver.name}`);
        }
        
        save();
        renderRoster();
        renderDriverCards();  // Update Live Pane when drivers clock in/out
    }
    
    /**
     * Start driver break
     */
    function startBreak(driverId) {
        const driver = DATA.roster.find(d => d.id === driverId);
        if (!driver) return;
        
        // Check if driver has active job
        const hasActiveJob = DATA.live.some(trip => trip.dr && trip.dr.id === driverId);
        if (hasActiveJob) {
            alert('Cannot start break while driver has active trip.');
            return;
        }
        
        // Check if already on break
        const existingBreak = DATA.breaks.find(b => b.driverId === driverId && b.active);
        if (existingBreak) {
            alert('Driver is already on break.');
            return;
        }
        
        // Create break record
        const breakRecord = {
            driverId: driverId,
            start: Date.now(),
            end: null,
            active: true
        };
        
        DATA.breaks.push(breakRecord);
        save();
        renderRoster();
        renderDriverCards();  // Update Live Pane when driver goes on break
        
        console.log(`☕ Break started: ${driver.name}`);
    }
    
    /**
     * End driver break
     */
    function endBreak(driverId) {
        const driver = DATA.roster.find(d => d.id === driverId);
        if (!driver) return;
        
        const activeBreak = DATA.breaks.find(b => b.driverId === driverId && b.active);
        if (!activeBreak) {
            alert('No active break found for this driver.');
            return;
        }
        
        activeBreak.active = false;
        activeBreak.end = Date.now();
        
        save();
        renderRoster();
        renderDriverCards();  // Update Live Pane when driver ends break
        
        console.log(`✅ Break ended: ${driver.name}`);
    }
    
    // ============================================================================
    // DISPATCH SHEET MODULE
    // ============================================================================
    
    /**
     * Render dispatch sheet for current date
     */
    function renderDispatchSheet() {
    const container = document.getElementById('sheet-table-container');
    const countBadge = document.getElementById('sheet-trip-count');
    const datePicker = document.getElementById('sheet-date-picker');
    
    if (!container) return;
    
    // Get current sheet date (defaults to today)
    if (!DATA.currentSheetDate) {
        // Use local date, not UTC
        var now = new Date();
        var year = now.getFullYear();
        var month = String(now.getMonth() + 1).padStart(2, '0');
        var day = String(now.getDate()).padStart(2, '0');
        DATA.currentSheetDate = year + '-' + month + '-' + day;
    }
    
    // Update date picker
    if (datePicker) {
        datePicker.value = DATA.currentSheetDate;
    }
    
    // Filter trips for current date (use local date, not UTC)
    const tripsForDate = DATA.dispatchSheet.filter(trip => {
        const d = new Date(trip.completedAt);
        const tripDate = d.getFullYear() + '-' + 
            String(d.getMonth() + 1).padStart(2, '0') + '-' + 
            String(d.getDate()).padStart(2, '0');
        return tripDate === DATA.currentSheetDate;
    });
    
    // Sort by completion time (newest first)
    const sortedTrips = tripsForDate.sort((a, b) => b.completedAt - a.completedAt);
    
    // Update count badge
    if (countBadge) {
        countBadge.textContent = sortedTrips.length;
    }
    
    // Empty state
    if (sortedTrips.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 60px 20px; color: rgba(255, 255, 255, 0.5);">
                <i class="fas fa-clipboard-list fa-3x" style="opacity: 0.3; margin-bottom: 16px;"></i>
                <p style="font-size: 16px; margin-bottom: 8px;">No trips completed</p>
                <p style="font-size: 13px;">${DATA.currentSheetDate}</p>
            </div>
        `;
        return;
    }
    
    // Build table
    let tableHTML = `
        <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
            <thead>
                <tr style="background: rgba(0,0,0,0.4); border-bottom: 1px solid rgba(255,255,255,0.2);">
                    <th style="border: 2px solid #000; padding: 12px; text-align: left; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; font-size: 0.95rem; background: #f0f0f0; color: #333;">Time</th>
                    <th style="border: 2px solid #000; padding: 12px; text-align: left; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; font-size: 0.95rem; background: #f0f0f0; color: #333;">Customer</th>
                    <th style="border: 2px solid #000; padding: 12px; text-align: left; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; font-size: 0.95rem; background: #f0f0f0; color: #333;">Phone</th>
                    <th style="border: 2px solid #000; padding: 12px; text-align: left; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; font-size: 0.95rem; background: #f0f0f0; color: #333;">Trip</th>
                    <th style="border: 2px solid #000; padding: 12px; text-align: left; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; font-size: 0.95rem; background: #f0f0f0; color: #333;">Driver</th>
                    <th style="border: 2px solid #000; padding: 12px; text-align: left; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; font-size: 0.95rem; background: #f0f0f0; color: #333;">Notes</th>
                    <th style="border: 2px solid #000; padding: 12px; text-align: center; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; font-size: 0.95rem; background: #f0f0f0; color: #333;" class="no-print">Actions</th>
                </tr>
            </thead>
            <tbody>
    `;
    
    sortedTrips.forEach((trip, idx) => {
        const completedTime = new Date(trip.completedAt).toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
        });

        const driverName = trip.dr?.name || 'Unknown';
        const driverColor = trip.dr?.color || '#999';

        const notes = trip.notes || '';

        // Screen styles (glass UI)
        const rowBg = idx % 2 === 0 ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.1)';

        // Use Trip Name instead of full addresses (privacy for printed sheets)
        // Trip name format: "123 Main St → Walmart" or "Superstore → Hub"
        const tripText = trip.tripName || 'Unnamed Trip';

        // Print-friendly row background (zebra stripes for print)
        const printRowBg = idx % 2 === 0 ? '#ffffff' : '#f9f9f9';

        tableHTML += `
            <tr style="background: ${rowBg};">
                <td style="border: 2px solid #000; padding: 12px; font-size: 1rem; word-wrap: break-word; background: ${printRowBg}; color: #000;">${completedTime}</td>
                <td style="border: 2px solid #000; padding: 12px; font-size: 1rem; word-wrap: break-word; background: ${printRowBg}; color: #000;">${trip.cName}</td>
                <td style="border: 2px solid #000; padding: 12px; font-size: 1rem; word-wrap: break-word; background: ${printRowBg}; color: #000;">${trip.cPhone}</td>
                <td style="border: 2px solid #000; padding: 12px; font-size: 0.95rem; word-wrap: break-word; line-height: 1.4; background: ${printRowBg}; color: #000;">${tripText}</td>
                <td style="border: 2px solid #000; padding: 12px; font-size: 1rem; word-wrap: break-word; background: ${printRowBg}; color: #000;">${driverName}</td>
                <td style="border: 2px solid #000; padding: 12px; font-size: 1rem; word-wrap: break-word; background: ${printRowBg}; color: #000;">${notes}</td>
                <td style="border: 2px solid #000; padding: 8px; text-align: center; background: ${printRowBg}; color: #000;" class="no-print">
                    <button class="btn btn-sm btn-danger" onclick="deleteSheetEntry(${trip.id})" title="Delete this entry" style="padding: 4px 8px; font-size: 12px;">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `;
    });
    
    tableHTML += `
            </tbody>
        </table>
    `;
    
    container.innerHTML = tableHTML;
    
    console.log(`✅ Dispatch sheet rendered: ${sortedTrips.length} trips on ${DATA.currentSheetDate}`);
}

/**
 * Navigate sheet date (days offset)
 */
    function sheetNavigate(days) {
    const currentDate = new Date(DATA.currentSheetDate + 'T00:00:00');
    currentDate.setDate(currentDate.getDate() + days);
    
    // FIX: Use local date, not UTC
    const year = currentDate.getFullYear();
    const month = String(currentDate.getMonth() + 1).padStart(2, '0');
    const day = String(currentDate.getDate()).padStart(2, '0');
    const newDate = `${year}-${month}-${day}`;
    setSheetDate(newDate);
}

/**
 * Set sheet date (YYYY-MM-DD or 'today')
 */
    function setSheetDate(date) {
    if (date === 'today') {
        // Use local date, not UTC
        var now = new Date();
        var year = now.getFullYear();
        var month = String(now.getMonth() + 1).padStart(2, '0');
        var day = String(now.getDate()).padStart(2, '0');
        DATA.currentSheetDate = year + '-' + month + '-' + day;
    } else {
        DATA.currentSheetDate = date;
    }
    
    renderDispatchSheet();
    console.log(`📅 Sheet date changed to: ${DATA.currentSheetDate}`);
}

/**
 * Export dispatch sheet to PDF (opens print dialog in new window)
 */
    function exportSheetPDF() {
    // Get current sheet data (use local date, not UTC)
    const tripsForDate = DATA.dispatchSheet.filter(trip => {
        const d = new Date(trip.completedAt);
        const tripDate = d.getFullYear() + '-' + 
            String(d.getMonth() + 1).padStart(2, '0') + '-' + 
            String(d.getDate()).padStart(2, '0');
        return tripDate === DATA.currentSheetDate;
    });
    
    if (tripsForDate.length === 0) {
        alert('No trips to export for this date.');
        return;
    }
    
    // Sort by completion time (newest first)
    const sortedTrips = tripsForDate.sort((a, b) => b.completedAt - a.completedAt);
    
    // Format date for display
    const displayDate = new Date(DATA.currentSheetDate + 'T00:00:00').toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
    
    // Build table HTML (V98 styling)
    let tableHTML = `
        <table style="width: 100%; border-collapse: collapse;">
            <thead>
                <tr style="background: #333; color: white;">
                    <th style="border: 1px solid #000; padding: 8px; text-align: left; font-weight: 600; text-transform: uppercase; font-size: 11px;">TIME</th>
                    <th style="border: 1px solid #000; padding: 8px; text-align: left; font-weight: 600; text-transform: uppercase; font-size: 11px;">NAME</th>
                    <th style="border: 1px solid #000; padding: 8px; text-align: left; font-weight: 600; text-transform: uppercase; font-size: 11px;">PHONE</th>
                    <th style="border: 1px solid #000; padding: 8px; text-align: left; font-weight: 600; text-transform: uppercase; font-size: 11px;">TRIP</th>
                    <th style="border: 1px solid #000; padding: 8px; text-align: left; font-weight: 600; text-transform: uppercase; font-size: 11px;">DRIVER</th>
                    <th style="border: 1px solid #000; padding: 8px; text-align: left; font-weight: 600; text-transform: uppercase; font-size: 11px;">NOTES</th>
                </tr>
            </thead>
            <tbody>
    `;
    
    sortedTrips.forEach((trip, idx) => {
        const completedTime = new Date(trip.completedAt).toLocaleTimeString('en-US', { 
            hour: '2-digit', 
            minute: '2-digit',
            hour12: true 
        });
        
        const driverName = trip.dr?.name || '';
        const notes = trip.notes || '';
        
        // Format phone with line breaks (V98 style: "204 596\n5832")
        let formattedPhone = trip.cPhone || '';
        if (formattedPhone) {
            // Remove all non-digits
            const digits = formattedPhone.replace(/\D/g, '');
            if (digits.length === 10) {
                // Format as: "XXX XXX\nXXXX"
                formattedPhone = `${digits.substr(0, 3)} ${digits.substr(3, 3)}<br>${digits.substr(6, 4)}`;
            }
        }

        // Use Trip Name instead of full addresses (privacy for printed sheets)
        // Trip name format: "123 Main St → Walmart" or "Superstore → Hub"
        const tripText = trip.tripName || 'Unnamed Trip';

        tableHTML += `
            <tr style="background: white;">
                <td style="border: 1px solid #000; padding: 8px; font-size: 13px; vertical-align: top;">${completedTime}</td>
                <td style="border: 1px solid #000; padding: 8px; font-size: 13px; vertical-align: top;">${trip.cName}</td>
                <td style="border: 1px solid #000; padding: 8px; font-size: 13px; vertical-align: top;">${formattedPhone}</td>
                <td style="border: 1px solid #000; padding: 8px; font-size: 13px; vertical-align: top;">${tripText}</td>
                <td style="border: 1px solid #000; padding: 8px; font-size: 13px; vertical-align: top;">${driverName}</td>
                <td style="border: 1px solid #000; padding: 8px; font-size: 13px; vertical-align: top;">${notes}</td>
            </tr>
        `;
    });
    
    tableHTML += `
            </tbody>
        </table>
    `;
    
    // Create complete HTML document for print window (V98 styling)
    const printHTML = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>Dispatch Sheet - ${displayDate}</title>
            <style>
                body {
                    font-family: Arial, sans-serif;
                    margin: 20px;
                    background: white;
                    color: black;
                }
                h1 {
                    font-size: 28px;
                    font-weight: bold;
                    margin: 0 0 4px 0;
                    color: #000;
                }
                .subtitle {
                    font-size: 14px;
                    color: #000;
                    margin: 0 0 20px 0;
                }
                .footer {
                    margin-top: 20px;
                    font-size: 14px;
                    font-weight: bold;
                }
                @media print {
                    @page {
                        margin: 1cm;
                    }
                    body {
                        margin: 0;
                        padding: 10px;
                    }
                }
            </style>
        </head>
        <body>
            <h1>DISPATCH SHEET - ${displayDate}</h1>
            <div class="subtitle">Shift: N/A | Drivers: N/A</div>
            ${tableHTML}
            <div class="footer">Total Trips: ${sortedTrips.length}</div>
        </body>
        </html>
    `;
    
    // Open new window with print content
    const printWindow = window.open('', '_blank', 'width=1000,height=800');
    
    if (!printWindow) {
        alert('Pop-up blocked. Please allow pop-ups to export PDF.');
        return;
    }
    
    printWindow.document.write(printHTML);
    printWindow.document.close();
    
    // Wait for content to load, then print
    printWindow.onload = function() {
        printWindow.focus();
        printWindow.print();
        // Close window after print dialog (optional)
        // printWindow.close();
    };
    
    console.log(`📄 Opened print window for ${sortedTrips.length} trips on ${DATA.currentSheetDate}`);
}

/**
 * Export dispatch sheet to Cluster inbox for Archivist processing
 */
function exportSheetToCluster() {
    // Get current sheet data
    const tripsForDate = DATA.dispatchSheet.filter(trip => {
        const d = new Date(trip.completedAt);
        const tripDate = d.getFullYear() + '-' + 
            String(d.getMonth() + 1).padStart(2, '0') + '-' + 
            String(d.getDate()).padStart(2, '0');
        return tripDate === DATA.currentSheetDate;
    });
    
    if (tripsForDate.length === 0) {
        showSystemMessage('No trips to export for this date.');
        return;
    }
    
    // Sort by completion time
    const sortedTrips = tripsForDate.sort((a, b) => a.completedAt - b.completedAt);
    
    // Normalize trip data for Archivist
    const normalizedTrips = sortedTrips.map((trip, idx) => {
        const completedTime = new Date(trip.completedAt).toLocaleTimeString('en-US', { 
            hour: '2-digit', minute: '2-digit', hour12: true 
        });
        
        return {
            id: DATA.currentSheetDate.replace(/-/g, '') + '_' + String(idx + 1).padStart(3, '0'),
            date: DATA.currentSheetDate,
            time: completedTime,
            timestamp: new Date(trip.completedAt).toISOString(),
            client_name: trip.cName || '',
            client_phone: trip.cPhone || '',
            pickup: trip.sN || '',
            dropoff: trip.eN || '',
            stops: trip.waypoints ? trip.waypoints.map(wp => wp.name || wp.address) : null,
            driver_name: trip.dr?.name || '',
            notes: trip.notes || '',
            passengers: trip.passengers || 1,
            status: 'completed'
        };
    });
    
    // Build export payload
    const exportData = {
        date: DATA.currentSheetDate,
        exported_at: new Date().toISOString(),
        total_trips: normalizedTrips.length,
        drivers: [...new Set(normalizedTrips.map(t => t.driver_name).filter(Boolean))],
        trips: normalizedTrips,
        source: 'hello_taxi_app'
    };
    
    // Send to Cluster via WebSocket
    if (LLM.isAvailable()) {
        LLM.send({
            type: 'vault_save',
            domain: 'hello_taxi',
            path: 'vault/hello_taxi/inbox/' + DATA.currentSheetDate + '_dispatch_sheet.json',
            collection: 'dispatch_inbox',
            data: exportData
        });
        
        showSystemMessage('Exported ' + normalizedTrips.length + ' trips to Cluster inbox');
        console.log('[Export] Sent dispatch sheet to Cluster inbox:', DATA.currentSheetDate);
    } else {
        // Fallback: download as JSON
        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = DATA.currentSheetDate + '_dispatch_sheet.json';
        a.click();
        URL.revokeObjectURL(url);
        
        showSystemMessage('Cluster offline - downloaded JSON file');
    }
}

/**
 * Delete entire dispatch sheet
 */
    function deleteDispatchSheet() {
    const count = DATA.dispatchSheet.length;
    if (count === 0) {
        showSystemMessage('Sheet is already empty');
        return;
    }
    
    const confirmed = confirm(`Delete entire dispatch sheet? This will permanently remove ${count} trip(s). This cannot be undone.`);
    if (!confirmed) return;
    
    DATA.dispatchSheet = [];
    save();
    renderDispatchSheet();
    showSystemMessage('Dispatch sheet cleared');
    console.log('🗑️ Dispatch sheet cleared');
}

/**
 * Delete single entry from dispatch sheet
 */
    function deleteSheetEntry(tripId) {
    const trip = DATA.dispatchSheet.find(t => t.id === tripId);
    if (!trip) return;
    
    const confirmed = confirm(`Delete trip: ${trip.tripName}?\n\nThis cannot be undone.`);
    if (!confirmed) return;
    
    DATA.dispatchSheet = DATA.dispatchSheet.filter(t => t.id !== tripId);
    save();
    renderDispatchSheet();
    showSystemMessage('Trip deleted from sheet');
    console.log(`🗑️ Sheet entry deleted: ${trip.tripName}`);
}

    // ============================================================================
    // SESSION NOTES MODULE - REMOVED (now in kernel-core.js)
    // SessionNotes is defined in kernel-core.js and exposed globally
    // ============================================================================

/**
 * Generate call summary with Qwen and append to Notes
 */
async function generateCallSummaryToNotes(job) {
    try {
        // Check if LLM available
        if (!LLMTimingService?.enabled) {
            // Fallback to template
            const summary = generateCallSummaryTemplate(job);
            SessionNotes.append(summary);
            return;
        }
        
        // Build route string
        let routeStr = `${job.sN}`;
        if (job.waypoints && job.waypoints.length > 0) {
            job.waypoints.forEach(wp => {
                const waitNote = wp.waitTime > 0 ? ` (${wp.waitTime}min wait)` : '';
                routeStr += ` → ${wp.name}${waitNote}`;
            });
        }
        routeStr += ` → ${job.eN}`;
        
        const prebookStr = job.prebook 
            ? new Date(job.prebook).toLocaleString('en-US', {
                month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true
            })
            : 'ASAP';
        
        const prompt = `Generate a clean, structured call summary for taxi dispatch notes. Format it EXACTLY like this:

[Time] — [Customer Name] ([Phone])
Route: [Pickup] → [Stops] → [Destination]
Duration: [X min] | Pickup: [Time/ASAP]
Notes: [Any special instructions]
---

Rules:
- Start with current time in 12-hour format
- Keep it compact and scannable
- Use " → " for route segments
- Include wait times in brackets if they exist
- Only include "Notes:" line if there are actual notes
- End with "---" separator
- NO extra commentary or explanations

Trip details:
- Trip Name: ${job.tripName || 'Unnamed Trip'}
- Customer: ${job.cName || 'Anonymous'} (${job.cPhone || 'No phone'})
- Route: ${routeStr}
- Duration: ${job.minsWithTraffic || job.mins} minutes
- Pickup time: ${prebookStr}
- Notes: ${job.notes || 'None'}

Return ONLY the formatted summary, nothing else.`;

        const systemPrompt = 'You are the AI assistant for Hello Taxi, a taxi dispatch service in Steinbach, Manitoba, Canada. Generate clean, professional call summaries for dispatch notes. Be concise and include all relevant trip details.';
        
        // Use centralized LLM abstraction (Cluster integration)
        const result = await LLM.call({
            system: systemPrompt,
            prompt: prompt,
            temperature: 0.2
        });
        
        if (!result.success) throw new Error(result.error || 'LLM request failed');
        
        let summary = result.content?.trim();
        
        if (!summary || summary.length < 20) throw new Error('LLM returned invalid response');
        
        // Clean up formatting
        summary = summary
            .replace(/```[\s\S]*?```/g, '')
            .replace(/^\s*```\s*/gm, '')
            .replace(/\*\*/g, '')
            .trim();
        
        // Append to notes
        SessionNotes.append('\n' + summary + '\n');
        console.log('📝 Call summary generated with LLM');
        
    } catch (err) {
        console.warn('LLM summary generation failed, using template:', err.message);
        const summary = generateCallSummaryTemplate(job);
        SessionNotes.append(summary);
    }
}

/**
 * Generate call summary using template (fallback)
 */
    function generateCallSummaryTemplate(job) {
    const now = new Date().toLocaleString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
    });
    
    const customer = `${job.cName || 'Anonymous'} (${job.cPhone || 'No phone'})`;
    
    let route = job.sN;
    if (job.waypoints && job.waypoints.length > 0) {
        job.waypoints.forEach(wp => {
            const waitNote = wp.waitTime > 0 ? ` [${wp.waitTime}min]` : '';
            route += ` → ${wp.name}${waitNote}`;
        });
    }
    route += ` → ${job.eN}`;
    
    const prebookStr = job.prebook 
        ? new Date(job.prebook).toLocaleString('en-US', {
            month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true
        })
        : 'ASAP';
    
    const duration = job.minsWithTraffic || job.mins;
    
    let summary = `\n${now} — ${customer}\n`;
    summary += `Trip: ${job.tripName || 'Unnamed Trip'}\n`;
    summary += `Route: ${route}\n`;
    summary += `Duration: ${duration} min | Pickup: ${prebookStr}\n`;
    
    if (job.notes) {
        summary += `Notes: ${job.notes}\n`;
    }
    
    summary += `---\n`;
    
    console.log('📝 Call summary generated with template');
    return summary;
}

/**
 * Copy trip details to clipboard (formatted for SMS)
 */
/**
 * Copy trip SMS by ID (wrapper for onclick handlers)
 */
    function copyTripSMSById(tripId, source) {
    const trip = source === 'queue' 
        ? DATA.queue.find(j => j.id === tripId)
        : DATA.live.find(t => t.id === tripId);
    
    if (!trip) {
        showSystemMessage('Trip not found');
        return;
    }
    
    copyTripSMS(trip);
}

/**
 * Copy trip SMS summary to clipboard
 * Uses LLM for contextual message generation with fallback
 */
async function copyTripSMS(trip) {
    if (!trip) {
        showSystemMessage('Trip not found');
        return;
    }

    showSystemMessage('Generating SMS...');

    // Build Google Maps URL
    const mapsUrl = buildGoogleMapsUrl(trip);

    // Try LLM generation, fallback to template
    let smsText;
    try {
        smsText = await generateTripSMSWithLLM(trip);
        console.log('[SMS] LLM generated:', smsText);
    } catch (err) {
        console.warn('LLM SMS generation failed, using template:', err.message);
        smsText = generateTripSMSTemplate(trip);
        console.log('[SMS] Template generated:', smsText);
    }

    // Combine message and URL
    const fullText = `${smsText}\n\n${mapsUrl}`;
    console.log('[SMS] Full text to copy:', fullText);

    // Copy to clipboard
    navigator.clipboard.writeText(fullText).then(() => {
        showSystemMessage('SMS copied to clipboard');
        console.log('📋 SMS copied:', trip.tripName);
    }).catch(err => {
        console.error('Copy failed:', err);
        showSystemMessage('Copy failed');

        // Fallback: show in prompt for manual copy
        prompt('Copy this text:', fullText);
    });
}

/**
 * Build Google Maps directions URL from trip data
 */
    function buildGoogleMapsUrl(trip) {
    if (!trip.s || !trip.e) return '';
    
    const origin = `${trip.s[1]},${trip.s[0]}`; // [lon, lat] -> lat,lon
    const destination = `${trip.e[1]},${trip.e[0]}`;
    
    // Add waypoints if present
    let waypoints = '';
    if (trip.waypoints && trip.waypoints.length > 0) {
        const waypointCoords = trip.waypoints.map(wp => `${wp.coords[1]},${wp.coords[0]}`).join('|');
        waypoints = `&waypoints=${waypointCoords}`;
    }
    
    return `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}${waypoints}`;
}

/**
 * Generate SMS using Qwen LLM
 * @param {Object} trip - Trip object
 * @returns {string} Generated SMS text
 */
async function generateTripSMSWithLLM(trip) {
    // Check if LLM available
    if (!LLM || !LLM.isAvailable()) {
        throw new Error('LLM not available');
    }
    
    // Build context for LLM
    const stopsText = trip.waypoints && trip.waypoints.length > 0
        ? trip.waypoints.map(w => {
            let stop = w.name;
            if (w.waitTime > 0) stop += ` (${w.waitTime} min wait)`;
            return stop;
        }).join(', ')
        : null;
    
    const prebookText = trip.prebook
        ? new Date(trip.prebook).toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
        })
        : 'ASAP';
    
    const etaMinutes = trip.pickupQuote?.quotedMinutes || trip.mins || '?';
    
    const prompt = `Generate a minimal, clean SMS for a taxi driver. Use this exact format:

TAXI - [Name] [Phone]
[Route Summary]
ETA: [X] min | [ASAP or Prebook time]

Rules:
- Keep it SHORT (under 160 characters before the maps link)
- Route Summary should be brief: "StreetName → StreetName" or landmark names only
- NO full street addresses (no numbers, no postal codes, no city, no province)
- No emojis
- No extra fluff or greetings

Trip details:
- Trip Name: ${trip.tripName || 'Unnamed Trip'}
- Customer: ${trip.cName || 'Customer'} ${trip.cPhone || ''}
- Pickup: ${trip.sN}
- Stops: ${stopsText || 'None'}
- Final destination: ${trip.eN}
- ETA: ${etaMinutes} minutes
- Pickup time: ${prebookText}

Return ONLY the SMS text, nothing else.`;

    const smsSystemPrompt = 'You are the AI assistant for Hello Taxi. Generate friendly, professional SMS messages to customers about their taxi pickup. Include driver name, vehicle info, and ETA. Keep messages under 160 characters when possible.';
    
    // Use centralized LLM abstraction (Cluster integration)
    const result = await LLM.call({
        system: smsSystemPrompt,
        prompt: prompt,
        temperature: 0.3
    });
    
    if (!result.success) {
        throw new Error(result.error || 'LLM request failed');
    }
    
    let smsText = result.content?.trim();
    
    if (!smsText || smsText.length < 20) {
        throw new Error('LLM returned empty or too short response');
    }
    
    // Clean up any markdown or extra formatting LLM might add
    smsText = smsText
        .replace(/```[\s\S]*?```/g, '')  // Remove code blocks
        .replace(/^\s*```\s*/gm, '')      // Remove stray backticks
        .replace(/\*\*/g, '')             // Remove bold markers
        .trim();
    
    return smsText;
}

/**
 * Fallback template-based SMS generation
 * @param {Object} trip - Trip object
 * @returns {string} Generated SMS text
 */
    function generateTripSMSTemplate(trip) {
    // Extract simplified route names (no full addresses)
    const tripName = trip.tripName || '--';
    const customerName = trip.cName || '--';
    const customerPhone = trip.cPhone || '--';
    const notes = trip.notes || '--';

    // Get simplified pickup/dropoff (extract just street name or landmark)
    let pickupShort = trip.sN || '--';
    let dropoffShort = trip.eN || '--';
    
    // Remove full address details - keep only first part before comma
    if (pickupShort.includes(',')) {
        pickupShort = pickupShort.split(',')[0].trim();
    }
    if (dropoffShort.includes(',')) {
        dropoffShort = dropoffShort.split(',')[0].trim();
    }
    
    // Remove street numbers from pickup
    pickupShort = pickupShort.replace(/^\d+\s+/, '').trim();
    
    // Build route summary
    const routeSummary = `${pickupShort} → ${dropoffShort}`;

    // Format ETA line
    let etaLine = 'ETA: ASAP';
    if (trip.prebook) {
        const prebookTime = new Date(trip.prebook).toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
        });
        etaLine = `ETA: ${prebookTime}`;
    } else if (trip.pickupQuote?.quotedMinutes) {
        etaLine = `ETA: ${trip.pickupQuote.quotedMinutes} min | ASAP`;
    } else if (trip.mins) {
        etaLine = `ETA: ${trip.mins} min | ASAP`;
    }

    // Build SMS
    let sms = `TAXI - ${customerName} ${customerPhone}\n`;
    sms += `${routeSummary}\n`;
    sms += etaLine;

    return sms;
}

    // ============================================================================
    // LLM CORRECTIONS MANAGEMENT
    // ============================================================================
    
    /**
     * Render LLM corrections list
     */
    function renderLLMCorrections() {
        const container = document.getElementById('llm-corrections-list');
        const countBadge = document.getElementById('llm-corrections-count');
        
        if (!container) return;
        
        container.innerHTML = '';
        
        if (!DATA.llmCorrections || DATA.llmCorrections.length === 0) {
            container.innerHTML = 
                '<div class="text-center" style="padding: 40px 20px; color: rgba(255, 255, 255, 0.5);">' +
                    '<i class="fas fa-spell-check fa-3x mb-2" style="opacity: 0.3;"></i>' +
                    '<p style="font-size: 13px;">No LLM corrections saved.</p>' +
                '</div>';
            if (countBadge) countBadge.textContent = '0';
            return;
        }
        
        // Sort alphabetically by misheard term
        const sortedCorrections = [...DATA.llmCorrections].sort((a, b) => 
            a.misheard.localeCompare(b.misheard)
        );
        
        sortedCorrections.forEach(correction => {
            const card = document.createElement('div');
            card.className = 'driver-card';
            card.innerHTML = 
                '<div style="display: flex; justify-content: space-between; align-items: center;">' +
                    '<div>' +
                        '<div class="driver-name" style="font-size: 14px;">' + correction.misheard + ' → ' + correction.correct + '</div>' +
                    '</div>' +
                    '<button class="btn btn-sm btn-danger" onclick="deleteLLMCorrection(' + correction.id + ')">' +
                        '<i class="fas fa-trash"></i>' +
                    '</button>' +
                '</div>';
            container.appendChild(card);
        });
        
        if (countBadge) countBadge.textContent = DATA.llmCorrections.length;
        console.log('✅ LLM corrections rendered: ' + DATA.llmCorrections.length);
    }
    
    /**
     * Clear LLM correction form
     */
    function clearLLMCorrectionForm() {
        document.getElementById('llm-misheard').value = '';
        document.getElementById('llm-correct').value = '';
        console.log('✅ LLM correction form cleared');
    }
    
    /**
     * Add LLM correction
     */
    function addLLMCorrection() {
        const misheard = document.getElementById('llm-misheard').value.trim();
        const correct = document.getElementById('llm-correct').value.trim();
        
        if (!misheard || !correct) {
            alert('Please enter both misheard and correct terms');
            return;
        }
        
        // Initialize array if needed
        if (!DATA.llmCorrections) {
            DATA.llmCorrections = [];
        }
        
        // Check for duplicates
        const existing = DATA.llmCorrections.find(c => 
            c.misheard.toLowerCase() === misheard.toLowerCase()
        );
        
        if (existing) {
            if (confirm('This misheard term already exists. Update it?')) {
                existing.correct = correct;
                save();
                renderLLMCorrections();
                clearLLMCorrectionForm();
                console.log('✅ LLM correction updated: ' + misheard);
            }
            return;
        }
        
        const newCorrection = {
            id: Date.now(),
            misheard: misheard,
            correct: correct
        };
        
        DATA.llmCorrections.push(newCorrection);
        save();
        renderLLMCorrections();
        clearLLMCorrectionForm();
        
        console.log('✅ LLM correction added: ' + misheard + ' → ' + correct);
    }
    
    /**
     * Delete LLM correction
     */
    function deleteLLMCorrection(id) {
        const correction = DATA.llmCorrections.find(c => c.id === id);
        if (!correction) return;
        
        if (!confirm('Delete correction "' + correction.misheard + ' → ' + correction.correct + '"?')) {
            return;
        }
        
        DATA.llmCorrections = DATA.llmCorrections.filter(c => c.id !== id);
        save();
        renderLLMCorrections();
        
        console.log('✅ LLM correction deleted: ' + correction.misheard);
    }
    
    /**
     * Get LLM corrections as prompt context
     */
    function getLLMCorrectionsContext() {
        let context = '';

        // Place nicknames — local shorthand that geocoders don't know
        if (DATA.placeNicknames && DATA.placeNicknames.length > 0) {
            context += '\n\nPLACE NICKNAMES (always resolve these to their full address):\n';
            DATA.placeNicknames.forEach(n => {
                context += '- "' + n.nickname + '" → "' + n.address + '"\n';
            });
        }

        // Known clients — match by name to pre-fill phone and address
        if (DATA.clients && DATA.clients.length > 0) {
            context += '\n\nKNOWN CLIENTS (if caller name matches, use their phone and default address):\n';
            DATA.clients.forEach(c => {
                let entry = '- Name: "' + (c.name || '') + '"  Phone: "' + (c.phone || '') + '"';
                if (c.address) entry += '  Default pickup: "' + c.address + '"';
                context += entry + '\n';
            });
        }

        // LLM corrections — misheard or misrecognised terms
        if (DATA.llmCorrections && DATA.llmCorrections.length > 0) {
            context += '\n\nLOCATION CORRECTIONS (use these when parsing addresses):\n';
            DATA.llmCorrections.forEach(c => {
                context += '- "' + c.misheard + '" → "' + c.correct + '"\n';
            });
        }

        return context;
    }

    // ============================================================================
    // ATTACH FUNCTIONS TO WINDOW
    // ============================================================================
    
    // Clients
    window.renderClients = renderClients;
    window.clearClientForm = clearClientForm;
    window.addClient = addClient;
    window.editClient = editClient;
    window.deleteClient = deleteClient;
    
    // Nicknames
    window.renderPlaceNicknames = renderPlaceNicknames;
    window.clearNicknameForm = clearNicknameForm;
    window.addPlaceNickname = addPlaceNickname;
    window.deletePlaceNickname = deletePlaceNickname;
    
    // LLM Corrections
    window.renderLLMCorrections = renderLLMCorrections;
    window.clearLLMCorrectionForm = clearLLMCorrectionForm;
    window.addLLMCorrection = addLLMCorrection;
    window.deleteLLMCorrection = deleteLLMCorrection;
    window.getLLMCorrectionsContext = getLLMCorrectionsContext;
    
    // Roster
    window.initSwatches = initSwatches;
    window.getSelectedColor = getSelectedColor;
    window.clearDriverForm = clearDriverForm;
    window.renderRoster = renderRoster;
    window.addDriver = addDriver;
    window.editDriver = editDriver;
    window.deleteDriver = deleteDriver;
    window.clk = clk;
    window.startBreak = startBreak;
    window.endBreak = endBreak;
    
    // Dispatch Sheet
    window.renderDispatchSheet = renderDispatchSheet;
    window.sheetNavigate = sheetNavigate;
    window.setSheetDate = setSheetDate;
    window.exportSheetPDF = exportSheetPDF;
    window.exportSheetToCluster = exportSheetToCluster;
    window.deleteDispatchSheet = deleteDispatchSheet;
    window.deleteSheetEntry = deleteSheetEntry;
    
    // Session Notes
    // window.SessionNotes - now exported from kernel-core.js
    window.generateCallSummaryTemplate = generateCallSummaryTemplate;
    
    // SMS Generation
    window.copyTripSMSById = copyTripSMSById;
    window.copyTripSMS = copyTripSMS;
    window.generateTripSMSWithLLM = generateTripSMSWithLLM;
    window.generateTripSMSTemplate = generateTripSMSTemplate;
    window.buildGoogleMapsUrl = buildGoogleMapsUrl;
    
    console.log('✅ kernel-data.js loaded');
    
})();
