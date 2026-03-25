// ============================================================================
// KERNEL-CORE.JS
// Configuration, State, Storage, Utilities, Clock, Badges, Views
// ============================================================================

(function() {
    'use strict';

    // ========================================================================
    // CONFIGURATION
    // ========================================================================

    const CONFIG = {
        DB: 'stein_v99',
        GOOGLE_API_KEY: '***REMOVED***',
        COLORS: [
            '#e74c3c', '#3498db', '#27ae60', '#f39c12', '#9b59b6',
            '#1abc9c', '#e67e22', '#34495e', '#16a085', '#27ae60',
            '#2980b9', '#8e44ad', '#2c3e50', '#f1c40f', '#e84393',
            '#00b894', '#0984e3', '#6c5ce7', '#fd79a8', '#fdcb6e'
        ],
        CACHE_EXPIRY: 604800000, // 7 days in milliseconds
        LOCALS: [
            { n: 'Hub', lat: 49.5258, lon: -96.6839 },
            { n: 'Walmart', lat: 49.5234, lon: -96.6812 },
            { n: 'Hospital', lat: 49.5289, lon: -96.6901 }
        ],
        
        // Logging Configuration
        DEBUG_MODE: true,  // Set to false in production to suppress debug logs
        LOG_LEVELS: {
            ERROR: 0,    // Always shown
            WARN: 1,     // Warnings
            INFO: 2,     // General info
            DEBUG: 3     // Verbose debugging
        },
        CURRENT_LOG_LEVEL: 2,  // INFO for production. Set to 3 for DEBUG (verbose) logs
        
        // LLM Configuration (Cluster V2 Integration - WebSocket)
        LLM: {
            wsEndpoint: 'ws://localhost:8765',
            appId: 'hello_taxi',
            timeout: 60000,  // Increased from 30s to 60s for complex requests
            enabled: true,
            debug: true,  // Log LLM requests/responses
            reconnectDelay: 3000,  // Retry connection every 3 seconds
            maxReconnectAttempts: 10
        }
    };
    
    // ========================================================================
    // LLM ABSTRACTION LAYER (Cluster V2 - WebSocket)
    // ========================================================================
    
    /**
     * Centralized LLM interface for all AI features.
     * Connects to Cluster V2 via WebSocket on port 8766.
     */
    const LLM = {
        ws: null,
        available: null,
        registered: false,
        reconnectAttempts: 0,
        messageQueue: [],
        pendingRequests: new Map(),
        messageId: 0,
        currentModel: null,
        
        /**
         * Initialize WebSocket connection to Cluster V2
         */
        init: function() {
            if (!CONFIG.LLM.enabled) {
                console.log('🤖 LLM disabled in config');
                return;
            }
            
            this.connect();
        },
        
        /**
         * Connect to Cluster V2 WebSocket server
         */
        connect: function() {
            var self = this;
            
            try {
                console.log('🤖 Connecting to Cluster V2:', CONFIG.LLM.wsEndpoint);
                this.ws = new WebSocket(CONFIG.LLM.wsEndpoint);
                
                this.ws.onopen = function() {
                    console.log('🤖 WebSocket connected');
                    self.reconnectAttempts = 0;
                    
                    // Register with Cluster
                    self.send({
                        type: 'register',
                        app_id: CONFIG.LLM.appId
                    });
                };
                
                this.ws.onmessage = function(event) {
                    try {
                        var data = JSON.parse(event.data);
                        self.handleMessage(data);
                    } catch (error) {
                        console.error('🤖 Failed to parse message:', error);
                    }
                };
                
                this.ws.onerror = function(error) {
                    console.error('🤖 WebSocket error:', error);
                    self.available = false;
                };
                
                this.ws.onclose = function() {
                    console.log('🤖 WebSocket disconnected');
                    self.available = false;
                    self.registered = false;
                    self.ws = null;
                    
                    // Attempt reconnection
                    if (self.reconnectAttempts < CONFIG.LLM.maxReconnectAttempts) {
                        self.reconnectAttempts++;
                        console.log('🤖 Reconnecting in ' + (CONFIG.LLM.reconnectDelay / 1000) + 's... (attempt ' + self.reconnectAttempts + ')');
                        setTimeout(function() {
                            self.connect();
                        }, CONFIG.LLM.reconnectDelay);
                    } else {
                        console.error('🤖 Max reconnection attempts reached');
                    }
                };
                
            } catch (error) {
                console.error('🤖 Failed to create WebSocket:', error);
                this.available = false;
            }
        },
        
        /**
         * Handle incoming WebSocket messages
         */
        handleMessage: function(data) {
            if (CONFIG.LLM.debug) {
                console.log('🤖 Received:', data.type, data);
            }
            
            switch (data.type) {
                case 'registered':
                    this.registered = true;
                    this.available = true;
                    this.currentModel = data.model;
                    console.log('✅ LLM registered:', data.model, '(tier: ' + data.tier + ')');
                    
                    // Update UI badge
                    this.updateStatusBadge('ready', data.model);
                    
                    // Process queued messages
                    this.processQueue();
                    
                    // Replay any queued Archivist saves
                    if (typeof Archivist !== 'undefined') {
                        Archivist.replayQueue();
                    }
                    break;
                    
                case 'chat_response':
                    var requestId = data.request_id;
                    var resolver = this.pendingRequests.get(requestId);
                    if (resolver) {
                        var content = data.content || data.message || '';
                        resolver.resolve({ success: true, content: content });
                        this.pendingRequests.delete(requestId);
                    }
                    break;
                    
                case 'vault_load_response':
                    // Route to Archivist
                    if (typeof Archivist !== 'undefined') {
                        Archivist.handleLoadResponse(data);
                    }
                    break;
                    
                case 'vault_save_response':
                    if (data.success) {
                        console.log('[Cluster] Vault save confirmed:', data.path);
                    } else {
                        console.error('[Cluster] Vault save failed:', data.error);
                    }
                    break;
                    
                case 'error':
                    var reqId = data.request_id;
                    var res = this.pendingRequests.get(reqId);
                    if (res) {
                        res.resolve({ success: false, error: data.error });
                        this.pendingRequests.delete(reqId);
                    }
                    console.error('🤖 Cluster error:', data.error);
                    break;
                    
                case 'model_changed':
                    this.currentModel = data.model;
                    console.log('🤖 Model changed to:', data.model);
                    this.updateStatusBadge('ready', data.model);
                    break;
            }
        },
        
        /**
         * Send message to Cluster
         */
        send: function(message) {
            if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                this.ws.send(JSON.stringify(message));
                return true;
            }
            return false;
        },
        
        /**
         * Process queued messages after connection
         */
        processQueue: function() {
            while (this.messageQueue.length > 0 && this.registered) {
                var msg = this.messageQueue.shift();
                this.send(msg);
            }
        },
        
        /**
         * Make an LLM call with system/user messages
         * @param {Object} options - { system, prompt, temperature, timeout }
         * @returns {Promise<{success: boolean, content?: string, error?: string}>}
         */
        call: async function(options) {
            var system = options.system || '';
            var prompt = options.prompt || '';
            var temperature = options.temperature !== undefined ? options.temperature : 0.7;
            var timeout = options.timeout || CONFIG.LLM.timeout;
            
            if (!CONFIG.LLM.enabled) {
                return { success: false, error: 'LLM disabled in config' };
            }
            
            if (!this.available) {
                return { success: false, error: 'LLM not connected' };
            }
            
            var self = this;
            var requestId = 'req_' + (++this.messageId);
            
            // Build message for Cluster V2
            var message = system + '\n\n' + prompt;
            
            if (CONFIG.LLM.debug) {
                console.log('🤖 LLM Request [' + requestId + ']:', {
                    system: system.substring(0, 100) + '...',
                    prompt: prompt.substring(0, 200) + '...'
                });
            }
            
            // Send chat message
            var chatMessage = {
                type: 'chat',
                request_id: requestId,
                message: message,
                session_id: 'hello_taxi_session'
            };
            
            // Create promise that resolves when response arrives
            return new Promise(function(resolve) {
                // Store resolver
                self.pendingRequests.set(requestId, { resolve: resolve });
                
                // Set timeout
                var timeoutId = setTimeout(function() {
                    if (self.pendingRequests.has(requestId)) {
                        self.pendingRequests.delete(requestId);
                        resolve({ success: false, error: 'Request timed out (' + (timeout/1000) + 's)' });
                    }
                }, timeout);
                
                // Send message
                if (self.registered) {
                    self.send(chatMessage);
                } else {
                    // Queue if not registered yet
                    self.messageQueue.push(chatMessage);
                }
            });
        },
        
        /**
         * Update LLM status badge in UI
         */
        updateStatusBadge: function(status, model) {
            var badge = document.getElementById('llm-status-badge');
            if (!badge) return;
            
            if (status === 'ready') {
                badge.textContent = 'Connected To Cluster';
                badge.style.background = '#27ae60';
            } else if (status === 'connecting') {
                badge.textContent = 'Connecting...';
                badge.style.background = '#f39c12';
            } else if (status === 'error') {
                badge.textContent = 'Cluster Offline';
                badge.style.background = '#e74c3c';
            }
        },
        
        /**
         * Check if LLM is available
         */
        isAvailable: function() {
            return this.available === true && this.registered === true;
        },
        
        /**
         * Get current model name
         */
        getModel: function() {
            return this.currentModel || 'unknown';
        },
        
        /**
         * Request model change (if supported by Cluster)
         */
        requestModel: function(modelName) {
            if (!this.registered) {
                console.warn('🤖 Cannot change model: not registered');
                return;
            }
            
            this.send({
                type: 'request_model',
                model: modelName
            });
        },
        
        /**
         * Initialize model from localStorage (legacy compatibility)
         */
        initModel: function() {
            // Deprecated - Cluster V2 manages models server-side
            console.log('🤖 Model management handled by Cluster V2');
        },
        
        lastResponseTime: null  // Track last response timing
    };
    
    // ========================================================================
    // LLM MODEL UI FUNCTIONS (Deprecated - Cluster V2 manages models)
    // ========================================================================
    // Note: These functions are deprecated. Cluster V2 manages models server-side.
    // Kept for backward compatibility but no longer functional.

    /**
     * Refresh and populate the model dropdown (DEPRECATED)
     * Cluster V2 manages models automatically.
     */
    async function refreshLLMModels() {
        console.log('[LLM] refreshLLMModels called (deprecated - Cluster V2 manages models)');
        var statusEl = document.getElementById('llm-status');
        
        // Just confirm connection - no model list needed
        if (LLM.isAvailable()) {
            if (statusEl) statusEl.textContent = 'Connected to Cluster';
            console.log('[LLM] Cluster connection confirmed');
        } else {
            if (statusEl) statusEl.textContent = 'Cluster unavailable';
            console.warn('[LLM] Cluster not available');
        }
    }

    /**
     * Update the selected LLM model (DEPRECATED)
     * Cluster V2 manages models automatically.
     */
    function updateLLMModel(modelName) {
        console.warn('[LLM] updateLLMModel called (deprecated) - Model changes handled by Cluster V2');
        showSystemMessage('Model changes managed by Cluster V2', 3000, 'info');
    }

    /**
     * Test LLM connection with a simple request
     */
    async function testLLMConnection() {
        var statusEl = document.getElementById('llm-status');
        var timeEl = document.getElementById('llm-last-response-time');

        if (statusEl) statusEl.textContent = 'Testing...';

        var startTime = performance.now();

        var result = await LLM.call({
            system: 'You are a test assistant. Respond with exactly: OK',
            prompt: 'Test connection',
            temperature: 0,
            timeout: 10000
        });

        var elapsed = Math.round(performance.now() - startTime);
        LLM.lastResponseTime = elapsed;

        if (result.success) {
            if (statusEl) statusEl.textContent = '✅ Connected';
            if (timeEl) timeEl.textContent = elapsed + 'ms';
            showSystemMessage('LLM Connection OK (' + elapsed + 'ms)', 3000, 'success');
        } else {
            if (statusEl) statusEl.textContent = '❌ ' + result.error;
            if (timeEl) timeEl.textContent = 'Failed';
            showSystemMessage('LLM Connection failed: ' + result.error, 5000, 'error');
        }
    }

    // ========================================================================
    // DATA STORE (Persistent)
    // ========================================================================

    const DATA = {
        roster: [],
        shift: [],
        queue: [],
        live: [],
        dispatchSheet: [],
        dispatchSheetHistory: {},
        currentSheetDate: null,
        clients: [],
        corrections: [],
        breaks: [],
        addressCache: {},
        turnSequence: [],
        placeNicknames: [],
        llmCorrections: [],
        shiftHistory: [],
        mapStyle: 'muted',
        customMapStyle: null
    };

    // ========================================================================
    // CACHE (External Data)
    // ========================================================================

    const CACHE = {
        weather: {
            data: null,
            timestamp: 0,
            ttl: 600000  // 10 minutes
        },
        traffic: {
            data: null,
            timestamp: 0,
            ttl: 300000  // 5 minutes
        }
    };

    // ========================================================================
    // STATE (Runtime - Not Persisted)
    // ========================================================================

    const STATE = {
        // Google Maps
        map: null,
        placesService: null,
        geocoder: null,
        
        // Map Interaction Modes
        mapMode: null,
        correctionMode: false,
        correctionTarget: null,
        pendingCorrection: null,
        driverPositionMode: null,
        driverStartMode: 'direct',
        adhocLocation: null,
        
        // Temporary Map Layers
        tempCalc: null,
        tempLayer: null,
        tempLayerInterval: null,
        jobLayers: {},
        
        // Polyline System
        dispatchPolyline: null,
        dispatchMarkers: [],
        queuePolylines: {},
        livePolylines: {},
        showAllLiveCalls: false,
        
        // Markers
        startMarker: null,
        endMarker: null,
        hoverMarkers: [],
        hoverAnimationInterval: [],
        driverPosMarkers: [],
        driverLocationMarkers: {},
        expandedTripMarkers: [],
        expandedTripInterval: [],
        
        // Queue State
        expandedQueueTrip: null,
        
        // Form State
        customStartName: null,
        customEndName: null,
        
        // Assignment Mode State
        assignmentMode: false,
        assignmentJobId: null,
        
        // Interval Management
        intervals: {
            clock: null,
            queueTimers: null,
            driverTimers: null,
            phaseMonitor: null,
            globalETA: null
        },
        
        // Initialization guards
        liveTimersInitialized: false,
        
        // Waypoint counter
        waypointCount: 0
    };

    // ========================================================================
    // ARCHIVIST INTEGRATION (Cluster V2 WebSocket Data Persistence)
    // ========================================================================
    
    const ARCHIVIST_ENABLED = true;
    
    // Persistent collections (synced to Cluster vault)
    const PERSISTENT_COLLECTIONS = [
        'roster', 'clients', 'placeNicknames', 'corrections', 
        'llmCorrections', 'addressCache', 'mapStyle'
    ];
    
    // Map collection names to vault paths
    const VAULT_PATHS = {
        roster: 'vault/hello_taxi/config/roster.json',
        clients: 'vault/hello_taxi/config/clients.json',
        placeNicknames: 'vault/hello_taxi/config/place_nicknames.json',
        corrections: 'vault/hello_taxi/config/address_corrections.json',
        llmCorrections: 'vault/hello_taxi/config/llm_corrections.json',
        addressCache: 'vault/hello_taxi/cache/address_cache.json',
        mapStyle: 'vault/hello_taxi/config/map_style.json',
        dispatchSheet: 'vault/hello_taxi/trips/{date}_dispatch_sheet.json',
        shiftLogs: 'vault/hello_taxi/drivers/{date}_shifts.json'
    };
    
    // Queue for offline sync
    var syncQueue = [];
    var saveDebounceTimers = {};
    
    const Archivist = {
        pendingLoads: new Map(),
        loadRequestId: 0,
        
        /**
         * Check if collection should be persisted to Cluster
         */
        isPersistent: function(collection) {
            return PERSISTENT_COLLECTIONS.includes(collection);
        },
        
        /**
         * Get vault path for a collection
         */
        getVaultPath: function(collection, date) {
            var path = VAULT_PATHS[collection];
            if (path && date) {
                path = path.replace('{date}', date);
            }
            return path;
        },
        
        /**
         * Load a collection from Cluster vault (with localStorage fallback)
         */
        load: function(collection) {
            var self = this;
            
            return new Promise(function(resolve) {
                // If not persistent or Cluster not available, use localStorage
                if (!self.isPersistent(collection) || !LLM.isAvailable()) {
                    var localData = self._loadFromLocalStorage(collection);
                    resolve(localData);
                    return;
                }
                
                var requestId = 'load_' + (++self.loadRequestId);
                var vaultPath = self.getVaultPath(collection);
                
                // Store resolver
                self.pendingLoads.set(requestId, {
                    resolve: resolve,
                    collection: collection
                });
                
                // Send load request via WebSocket
                var sent = LLM.send({
                    type: 'vault_load',
                    request_id: requestId,
                    domain: 'hello_taxi',
                    path: vaultPath,
                    collection: collection
                });
                
                if (!sent) {
                    self.pendingLoads.delete(requestId);
                    resolve(self._loadFromLocalStorage(collection));
                    return;
                }
                
                // Timeout fallback
                setTimeout(function() {
                    if (self.pendingLoads.has(requestId)) {
                        console.warn('[Archivist] Load timeout for ' + collection + ', using localStorage');
                        self.pendingLoads.delete(requestId);
                        resolve(self._loadFromLocalStorage(collection));
                    }
                }, 5000);
            });
        },
        
        /**
         * Handle vault_load response from Cluster
         */
        handleLoadResponse: function(data) {
            var pending = this.pendingLoads.get(data.request_id);
            if (!pending) return;
            
            this.pendingLoads.delete(data.request_id);
            
            if (data.success && data.data) {
                console.log('[Archivist] Loaded ' + pending.collection + ' from Cluster vault');
                // Update localStorage cache
                this._saveToLocalStorage(pending.collection, data.data);
                pending.resolve(data.data);
            } else {
                console.warn('[Archivist] Vault load failed for ' + pending.collection + ', using localStorage');
                pending.resolve(this._loadFromLocalStorage(pending.collection));
            }
        },
        
        /**
         * Save a collection to Cluster vault (debounced)
         */
        save: function(collection, data, immediate) {
            var self = this;
            
            // Always save to localStorage first
            this._saveToLocalStorage(collection, data);
            
            // Only sync persistent collections to Cluster
            if (!this.isPersistent(collection)) return;
            if (!ARCHIVIST_ENABLED) return;
            
            // Clear existing debounce timer
            if (saveDebounceTimers[collection]) {
                clearTimeout(saveDebounceTimers[collection]);
            }
            
            if (immediate) {
                this._saveToCluster(collection, data);
            } else {
                // Debounce saves (5 seconds)
                saveDebounceTimers[collection] = setTimeout(function() {
                    self._saveToCluster(collection, data);
                }, 5000);
            }
        },
        
        /**
         * Internal: Save to Cluster via WebSocket
         */
        _saveToCluster: function(collection, data) {
            if (!LLM.isAvailable()) {
                this._queueForSync(collection, data);
                return;
            }
            
            var vaultPath = this.getVaultPath(collection);
            
            var sent = LLM.send({
                type: 'vault_save',
                domain: 'hello_taxi',
                path: vaultPath,
                collection: collection,
                data: data
            });
            
            if (sent) {
                console.log('[Archivist] Saved ' + collection + ' to Cluster vault');
            } else {
                this._queueForSync(collection, data);
            }
        },
        
        /**
         * Save archival data (dispatch sheets, shift logs) with date
         */
        saveArchival: function(collection, data, date) {
            if (!LLM.isAvailable()) {
                console.warn('[Archivist] Cannot save archival data - Cluster offline');
                return;
            }
            
            var vaultPath = this.getVaultPath(collection, date);
            
            LLM.send({
                type: 'vault_save',
                domain: 'hello_taxi',
                path: vaultPath,
                collection: collection,
                data: data,
                archival: true
            });
            
            console.log('[Archivist] Archived ' + collection + ' for ' + date);
        },
        
        /**
         * Load from localStorage
         */
        _loadFromLocalStorage: function(collection) {
            var key = CONFIG.DB + '_' + collection;
            try {
                var data = localStorage.getItem(key);
                return data ? JSON.parse(data) : null;
            } catch (e) {
                console.error('[Archivist] localStorage parse error for ' + collection);
                return null;
            }
        },
        
        /**
         * Save to localStorage
         */
        _saveToLocalStorage: function(collection, data) {
            var key = CONFIG.DB + '_' + collection;
            try {
                localStorage.setItem(key, JSON.stringify(data));
            } catch (e) {
                console.error('[Archivist] localStorage save error for ' + collection);
            }
        },
        
        /**
         * Queue data for sync when back online
         */
        _queueForSync: function(collection, data) {
            var idx = syncQueue.findIndex(function(q) { return q.collection === collection; });
            if (idx !== -1) syncQueue.splice(idx, 1);
            
            syncQueue.push({
                collection: collection,
                data: data,
                timestamp: Date.now()
            });
            console.log('[Archivist] Queued ' + collection + ' for sync (' + syncQueue.length + ' pending)');
        },
        
        /**
         * Replay queued saves when reconnected
         */
        replayQueue: function() {
            var self = this;
            if (syncQueue.length === 0) return;
            
            console.log('[Archivist] Replaying ' + syncQueue.length + ' queued saves...');
            
            syncQueue.forEach(function(item) {
                self._saveToCluster(item.collection, item.data);
            });
            
            syncQueue = [];
            console.log('[Archivist] Sync queue cleared');
        },
        
        /**
         * Load all persistent data from Cluster on init
         */
        loadAll: async function() {
            var self = this;
            console.log('[Archivist] Loading persistent data from Cluster...');
            
            var results = {};
            
            for (var i = 0; i < PERSISTENT_COLLECTIONS.length; i++) {
                var collection = PERSISTENT_COLLECTIONS[i];
                results[collection] = await self.load(collection);
            }
            
            return results;
        }
    };
    
    // Export for global access
    window.Archivist = Archivist;
    window.ARCHIVIST_ENABLED = ARCHIVIST_ENABLED;

    // ========================================================================
    // STORAGE MODULE
    // ========================================================================

    const Storage = {
        saveTimeout: null,
        savePending: false,
        
        /**
         * Load all data from localStorage
         */
        load: function() {
            console.log('📂 Loading data...');
            
            try {
                // Load deleted driver IDs from localStorage
                var deletedDriverIds = JSON.parse(localStorage.getItem(CONFIG.DB + '_deletedDrivers') || '[]');
                
                // Always load roster from SHIFT_START_ROSTER.json (file-as-master)
                fetch('VAULT/SHIFT_START_ROSTER.json')
                    .then(function(response) { return response.json(); })
                    .then(function(fileData) {
                        if (fileData.roster && fileData.roster.length > 0) {
                            // Filter out deleted drivers
                            DATA.roster = fileData.roster.filter(function(driver) {
                                return deletedDriverIds.indexOf(driver.id) === -1;
                            });
                            
                            // Load other persistent config from file if not in localStorage
                            if (!DATA.clients || DATA.clients.length === 0) {
                                DATA.clients = fileData.clients || [];
                            }
                            if (!DATA.placeNicknames || DATA.placeNicknames.length === 0) {
                                DATA.placeNicknames = fileData.placeNicknames || [];
                            }
                            if (!DATA.corrections || DATA.corrections.length === 0) {
                                DATA.corrections = fileData.corrections || [];
                            }
                            if (!DATA.addressCache || Object.keys(DATA.addressCache).length === 0) {
                                DATA.addressCache = fileData.addressCache || {};
                            }
                            
                            var deletedCount = fileData.roster.length - DATA.roster.length;
                            console.log('✅ Loaded ' + DATA.roster.length + ' drivers from SHIFT_START_ROSTER' + 
                                (deletedCount > 0 ? ' (' + deletedCount + ' excluded)' : ''));
                            
                            if (typeof renderRoster === 'function') renderRoster();
                        }
                    })
                    .catch(function(err) {
                        console.log('📂 SHIFT_START_ROSTER not available, using localStorage:', err.message);
                        DATA.roster = JSON.parse(localStorage.getItem(CONFIG.DB + '_r') || '[]');
                    });
                
                // Load session data from localStorage
                DATA.shift = JSON.parse(localStorage.getItem(CONFIG.DB + '_s') || '[]');
                DATA.queue = JSON.parse(localStorage.getItem(CONFIG.DB + '_q') || '[]');
                DATA.live = JSON.parse(localStorage.getItem(CONFIG.DB + '_l') || '[]');
                
                // Sanitize live trips: ensure valid status
                DATA.live = DATA.live.filter(function(trip) {
                    if (!trip || !trip.status) {
                        console.warn('[SANITIZE] Removing trip with no status:', trip ? trip.id : 'null');
                        return false;
                    }
                    if (trip.status !== 'active' && trip.status !== 'stacked') {
                        console.warn('[SANITIZE] Removing trip with invalid status:', trip.id, trip.status);
                        return false;
                    }
                    return true;
                });
                
                DATA.dispatchSheet = JSON.parse(localStorage.getItem(CONFIG.DB + '_ds') || '[]');
                DATA.clients = JSON.parse(localStorage.getItem(CONFIG.DB + '_clients') || '[]');
                DATA.corrections = JSON.parse(localStorage.getItem(CONFIG.DB + '_corrections') || '[]');
                DATA.breaks = JSON.parse(localStorage.getItem(CONFIG.DB + '_breaks') || '[]');
                DATA.addressCache = JSON.parse(localStorage.getItem(CONFIG.DB + '_addressCache') || '{}');
                DATA.turnSequence = JSON.parse(localStorage.getItem(CONFIG.DB + '_turnSequence') || '[]');
                DATA.placeNicknames = JSON.parse(localStorage.getItem(CONFIG.DB + '_placeNicknames') || '[]');
                DATA.mapStyle = localStorage.getItem(CONFIG.DB + '_mapStyle') || 'muted';
                DATA.customMapStyle = JSON.parse(localStorage.getItem(CONFIG.DB + '_customMapStyle') || 'null');
                
                console.log('✅ Data loaded successfully');
                console.log('   Roster: ' + DATA.roster.length + ' drivers');
                console.log('   Queue: ' + DATA.queue.length + ' trips');
                console.log('   Live: ' + DATA.live.length + ' trips');
                console.log('   Clients: ' + DATA.clients.length + ' clients');
            } catch (error) {
                console.error('❌ Error loading data:', error);
            }
        },
        
        /**
         * Save all data to localStorage (debounced)
         */
        save: function(immediate) {
            var self = this;
            
            // If immediate save requested, clear pending and save now
            if (immediate) {
                if (self.saveTimeout) {
                    clearTimeout(self.saveTimeout);
                    self.saveTimeout = null;
                }
                self._performSave();
                return;
            }
            
            // If save already pending, just extend the timer
            if (self.saveTimeout) {
                clearTimeout(self.saveTimeout);
            }
            
            // Schedule save for 100ms from now
            self.savePending = true;
            self.saveTimeout = setTimeout(function() {
                self._performSave();
                self.saveTimeout = null;
                self.savePending = false;
            }, 100);
        },
        
        /**
         * Internal: Perform actual save to localStorage
         */
        _performSave: function() {
            try {
                localStorage.setItem(CONFIG.DB + '_r', JSON.stringify(DATA.roster));
                localStorage.setItem(CONFIG.DB + '_s', JSON.stringify(DATA.shift));
                localStorage.setItem(CONFIG.DB + '_q', JSON.stringify(DATA.queue));
                localStorage.setItem(CONFIG.DB + '_l', JSON.stringify(DATA.live));
                localStorage.setItem(CONFIG.DB + '_ds', JSON.stringify(DATA.dispatchSheet));
                localStorage.setItem(CONFIG.DB + '_clients', JSON.stringify(DATA.clients));
                localStorage.setItem(CONFIG.DB + '_corrections', JSON.stringify(DATA.corrections));
                localStorage.setItem(CONFIG.DB + '_breaks', JSON.stringify(DATA.breaks));
                localStorage.setItem(CONFIG.DB + '_addressCache', JSON.stringify(DATA.addressCache));
                localStorage.setItem(CONFIG.DB + '_turnSequence', JSON.stringify(DATA.turnSequence));
                localStorage.setItem(CONFIG.DB + '_placeNicknames', JSON.stringify(DATA.placeNicknames));
                localStorage.setItem(CONFIG.DB + '_mapStyle', DATA.mapStyle);
                localStorage.setItem(CONFIG.DB + '_customMapStyle', JSON.stringify(DATA.customMapStyle));
                
                console.log('💾 Data saved to localStorage');
            } catch (error) {
                console.error('❌ Error saving data:', error);
            }
        },
        
        /**
         * Hard reset - clear all data
         */
        hardReset: function() {
            if (confirm('⚠️ This will delete ALL data. Are you sure?')) {
                localStorage.clear();
                location.reload();
            }
        },
        
        /**
         * Export data as JSON file
         */
        exportData: function() {
            var exportObj = {
                roster: DATA.roster,
                shift: DATA.shift,
                queue: DATA.queue,
                live: DATA.live,
                dispatchSheet: DATA.dispatchSheet,
                clients: DATA.clients,
                corrections: DATA.corrections,
                breaks: DATA.breaks,
                turnSequence: DATA.turnSequence,
                placeNicknames: DATA.placeNicknames,
                exportDate: new Date().toISOString()
            };
            
            var dataStr = JSON.stringify(exportObj, null, 2);
            var dataBlob = new Blob([dataStr], { type: 'application/json' });
            var url = URL.createObjectURL(dataBlob);
            var link = document.createElement('a');
            link.href = url;
            link.download = 'dispatch_backup_' + Date.now() + '.json';
            link.click();
            URL.revokeObjectURL(url);
            
            console.log('📤 Data exported');
        },
        
        /**
         * Import data from JSON file
         */
        importData: function(fileInput) {
            var file = fileInput.files[0];
            if (!file) return;
            
            var reader = new FileReader();
            reader.onload = function(e) {
                try {
                    var importedData = JSON.parse(e.target.result);
                    
                    DATA.roster = importedData.roster || [];
                    DATA.shift = importedData.shift || [];
                    DATA.queue = importedData.queue || [];
                    DATA.live = importedData.live || [];
                    DATA.dispatchSheet = importedData.dispatchSheet || [];
                    DATA.clients = importedData.clients || [];
                    DATA.corrections = importedData.corrections || [];
                    DATA.breaks = importedData.breaks || [];
                    DATA.turnSequence = importedData.turnSequence || [];
                    DATA.placeNicknames = importedData.placeNicknames || [];
                    
                    Storage.save(true);  // Immediate save before reload
                    console.log('📥 Data imported successfully');
                    location.reload();
                } catch (error) {
                    console.error('❌ Error importing data:', error);
                    alert('Error importing data. Please check the file format.');
                }
            };
            reader.readAsText(file);
        }
    };

    // ========================================================================
    // LOGGING SYSTEM
    // ========================================================================

    /**
     * Centralized logging with level control
     */
    const Logger = {
        error: function(message) {
            if (CONFIG.CURRENT_LOG_LEVEL >= CONFIG.LOG_LEVELS.ERROR) {
                console.error('❌ ' + message);
            }
        },
        
        warn: function(message) {
            if (CONFIG.CURRENT_LOG_LEVEL >= CONFIG.LOG_LEVELS.WARN) {
                console.warn('⚠️ ' + message);
            }
        },
        
        info: function(message) {
            if (CONFIG.CURRENT_LOG_LEVEL >= CONFIG.LOG_LEVELS.INFO) {
                console.log(message);
            }
        },
        
        debug: function(message) {
            if (CONFIG.CURRENT_LOG_LEVEL >= CONFIG.LOG_LEVELS.DEBUG) {
                console.log(message);
            }
        },
        
        // Legacy console.log replacement (defaults to INFO level)
        log: function(message) {
            this.info(message);
        },
        
        // Suppress all logging (for production)
        setProductionMode: function(enabled) {
            CONFIG.DEBUG_MODE = !enabled;
            CONFIG.CURRENT_LOG_LEVEL = enabled ? CONFIG.LOG_LEVELS.WARN : CONFIG.LOG_LEVELS.DEBUG;
            console.log(enabled ? '🔇 Production mode: verbose logs disabled' : '🔊 Debug mode: all logs enabled');
        }
    };
    
    // Override console.log in production mode (preserves error/warn)
    if (!CONFIG.DEBUG_MODE) {
        var originalConsoleLog = console.log;
        console.log = function() {
            // Only suppress if first arg starts with emoji or debug markers
            var firstArg = arguments[0];
            if (typeof firstArg === 'string') {
                // Allow critical messages (✅ loaded, ❌ errors)
                if (firstArg.indexOf('✅') === 0 && firstArg.indexOf('loaded') !== -1) {
                    originalConsoleLog.apply(console, arguments);
                    return;
                }
                // Suppress verbose debug output (📊, 🎯, 📦, 🗺️, etc.)
                if (/^[📊🎯📦🗺️🚕═]/.test(firstArg)) {
                    return; // Suppress
                }
            }
            originalConsoleLog.apply(console, arguments);
        };
    }

    // ========================================================================
    // UTILITY FUNCTIONS
    // ========================================================================

    /**
     * Get today's date string in YYYY-MM-DD format
     */
    function getTodayDateString() {
        var now = new Date();
        var year = now.getFullYear();
        var month = String(now.getMonth() + 1).padStart(2, '0');
        var day = String(now.getDate()).padStart(2, '0');
        return year + '-' + month + '-' + day;
    }

    /**
     * Format date string for display
     */
    function getFormattedDate(dateString) {
        var date = new Date(dateString);
        return date.toLocaleDateString('en-US', { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
        });
    }

    // ========================================================================
    // TIME FORMATTING UTILITIES
    // ========================================================================

    /**
     * Format milliseconds to MM:SS string
     * @param {Number} ms - Time in milliseconds
     * @returns {String} Formatted time "MM:SS"
     */
    function formatTimeMMSS(ms) {
        var totalSeconds = Math.floor(Math.abs(ms) / 1000);
        var minutes = Math.floor(totalSeconds / 60);
        var seconds = totalSeconds % 60;
        return String(minutes).padStart(2, '0') + ':' + String(seconds).padStart(2, '0');
    }

    /**
     * Format milliseconds to HH:MM:SS string
     * @param {Number} ms - Time in milliseconds
     * @returns {String} Formatted time "HH:MM:SS"
     */
    function formatTimeHHMMSS(ms) {
        var totalSeconds = Math.floor(Math.abs(ms) / 1000);
        var hours = Math.floor(totalSeconds / 3600);
        var minutes = Math.floor((totalSeconds % 3600) / 60);
        var seconds = totalSeconds % 60;
        return String(hours).padStart(2, '0') + ':' + String(minutes).padStart(2, '0') + ':' + String(seconds).padStart(2, '0');
    }

    /**
     * Format seconds to M:SS or MM:SS string (no leading zero on minutes if < 10)
     * @param {Number} seconds - Time in seconds
     * @returns {String} Formatted time "M:SS" or "MM:SS"
     */
    function formatSecondsShort(seconds) {
        var mins = Math.floor(Math.abs(seconds) / 60);
        var secs = Math.abs(seconds) % 60;
        return mins + ':' + String(secs).padStart(2, '0');
    }

    /**
     * Calculate distance between two coordinates using Haversine formula
     * Returns distance in kilometers
     */
    // MOVED TO kernel-timing.js
    // haversineDistance()
    // calculateApproachTime()

    // ========================================================================
    // CLOCK SYSTEM
    // ========================================================================

    function updateClock() {
        var now = new Date();
        
        // Format date: "SUNDAY, DECEMBER 29, 2025"
        var dateOptions = { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' };
        var dateString = now.toLocaleDateString('en-US', dateOptions).toUpperCase();
        
        // Format time: "14:35:22"
        var timeString = now.toLocaleTimeString('en-US', { 
            hour12: false, 
            hour: '2-digit', 
            minute: '2-digit', 
            second: '2-digit' 
        });
        
        var dateEl = document.getElementById('system-date');
        var timeEl = document.getElementById('system-time');
        
        if (dateEl) dateEl.textContent = dateString;
        if (timeEl) timeEl.textContent = timeString;
    }

    // ========================================================================
    // BADGE & MESSAGE SYSTEM
    // ========================================================================

    function updateBadges() {
        var qCount = DATA.queue.length;
        var lCount = DATA.live.length;
        
        // Count drivers clocked in
        var clockedInCount = DATA.shift.length;
        
        var qBadge = document.getElementById('q-badge');
        var lBadge = document.getElementById('l-badge');
        var systemMsg = document.getElementById('system-message');
        
        if (qBadge) qBadge.textContent = qCount;
        if (lBadge) lBadge.textContent = clockedInCount;
        
        // Update system message with more context
        var statusParts = [];
        if (clockedInCount > 0) {
            statusParts.push(clockedInCount + ' Driver' + (clockedInCount !== 1 ? 's' : ''));
        }
        if (lCount > 0) {
            statusParts.push(lCount + ' Active Trip' + (lCount !== 1 ? 's' : ''));
        }
        if (qCount > 0) {
            statusParts.push(qCount + ' Pending');
        }
        
        if (systemMsg) {
            systemMsg.textContent = statusParts.length > 0 ? statusParts.join(' • ') : 'No Activity';
        }
    }

    /**
     * Message Queue System - Single message display with fade out
     */
    var MessageQueue = {
        queue: [],
        currentMessage: null,
        currentTimeout: null,
        isDisplaying: false,
        
        add: function(message, duration, type) {
            this.queue.push({ message: message, duration: duration || 20000, type: type || 'info' });
            this.processQueue();
        },
        
        processQueue: function() {
            if (this.isDisplaying || this.queue.length === 0) return;
            
            this.currentMessage = this.queue.shift();
            this.display(this.currentMessage.message, this.currentMessage.type);
            this.isDisplaying = true;
            
            var self = this;
            this.currentTimeout = setTimeout(function() {
                self.fadeOut();
            }, this.currentMessage.duration);
        },
        
        display: function(message, type) {
            var logContainer = document.getElementById('system-messages-log');
            if (!logContainer) {
                console.log('[SYSTEM] ' + type.toUpperCase() + ': ' + message);
                return;
            }
            
            var icons = {
                info: 'ℹ️',
                success: '✅',
                warning: '⚠️',
                error: '❌'
            };
            
            var colors = {
                info: 'rgba(52, 152, 219, 0.8)',
                success: 'rgba(39, 174, 96, 0.8)',
                warning: 'rgba(243, 156, 18, 0.8)',
                error: 'rgba(231, 76, 60, 0.8)'
            };
            
            var icon = icons[type] || icons.info;
            var color = colors[type] || colors.info;
            
            logContainer.innerHTML = '';
            var entry = document.createElement('div');
            entry.id = 'current-system-message';
            entry.style.cssText = 'padding: 4px 0; border-left: 3px solid ' + color + '; padding-left: 10px; transition: opacity 0.6s ease-out; word-wrap: break-word; word-break: break-word; overflow: hidden; font-size: 0.85em; line-height: 1.3; display: flex; align-items: center;';
            entry.innerHTML = '<span style="margin-right: 8px; font-size: 1em;">' + icon + '</span><span style="flex: 1;">' + message + '</span>';
            
            logContainer.appendChild(entry);
            console.log('[SYSTEM] ' + type.toUpperCase() + ': ' + message);
        },
        
        fadeOut: function() {
            var entry = document.getElementById('current-system-message');
            if (entry) {
                entry.style.opacity = '0';
                var self = this;
                setTimeout(function() {
                    entry.innerHTML = '';
                    self.isDisplaying = false;
                    self.processQueue();
                }, 600);
            } else {
                this.isDisplaying = false;
                this.processQueue();
            }
        }
    };
    
    function showSystemMessage(message, duration, type) {
        MessageQueue.add(message, duration, type);
    }

    // ========================================================================
    // VIEW MANAGEMENT
    // ========================================================================

    var currentView = 'workspace';
    var workspacePanesVisible = true;

    function toggleView(view) {
        // Get all panes
        var panes = [
            document.getElementById('dispatch-pane'),
            document.getElementById('queue-pane'),
            document.getElementById('drivers-pane'),
            document.getElementById('messenger-pane')
        ];
        
        // Update nav button states
        var navBtns = document.querySelectorAll('.nav-btn');
        navBtns.forEach(function(btn) {
            btn.classList.remove('active');
        });
        if (event && event.target) {
            event.target.classList.add('active');
        }
        
        // Hide all overlays first
        var rosterOverlay = document.getElementById('roster-overlay');
        var sheetOverlay = document.getElementById('sheet-overlay');
        var notesOverlay = document.getElementById('notes-overlay');
        var settingsOverlay = document.getElementById('settings-overlay');
        
        if (rosterOverlay) rosterOverlay.style.display = 'none';
        if (sheetOverlay) sheetOverlay.style.display = 'none';
        if (notesOverlay) notesOverlay.style.display = 'none';
        if (settingsOverlay) settingsOverlay.style.display = 'none';
        
        if (view === 'workspace') {
            // Toggle workspace panes on/off
            workspacePanesVisible = !workspacePanesVisible;
            
            panes.forEach(function(pane) {
                if (pane) pane.style.display = workspacePanesVisible ? 'flex' : 'none';
            });
            
            console.log('📍 Workspace panes: ' + (workspacePanesVisible ? 'VISIBLE' : 'HIDDEN'));
            currentView = 'workspace';
        } else {
            // Hide panes and show appropriate overlay
            panes.forEach(function(pane) {
                if (pane) pane.style.display = 'none';
            });
            workspacePanesVisible = false;
            currentView = view;
            
            if (view === 'roster') {
                if (rosterOverlay) rosterOverlay.style.display = 'block';
                if (typeof renderRoster === 'function') renderRoster();
                console.log('📍 View: Roster overlay');
            } else if (view === 'sheet') {
                if (sheetOverlay) sheetOverlay.style.display = 'block';
                if (typeof renderDispatchSheet === 'function') renderDispatchSheet();
                console.log('📍 View: Dispatch Sheet overlay');
            } else if (view === 'notes') {
                if (notesOverlay) notesOverlay.style.display = 'block';
                if (typeof SessionNotes !== 'undefined') SessionNotes.load();
                console.log('📍 View: Notes overlay');
            } else if (view === 'settings') {
                if (settingsOverlay) settingsOverlay.style.display = 'block';
                if (typeof renderLLMCorrections === 'function') renderLLMCorrections();
                // Load LLM models when settings opens
                if (typeof refreshLLMModels === 'function') refreshLLMModels();
                console.log('📍 View: Settings & Data overlay');
            }
        }
    }

    /**
     * Toggle pane collapse state
     */
    function togglePaneCollapse(paneId) {
        var pane = document.getElementById(paneId);
        if (!pane) return;
        
        pane.classList.toggle('collapsed');
        
        var isCollapsed = pane.classList.contains('collapsed');
        console.log(paneId + ': ' + (isCollapsed ? 'collapsed' : 'expanded'));
    }

    // ========================================================================
    // DRIVER-CENTRIC HELPERS
    // ========================================================================

    /**
     * Get all trips for a specific driver, sorted by status and start time
     */
    function getDriverTrips(driverId) {
        return DATA.live.filter(function(t) {
            return t.dr && t.dr.id === driverId;
        }).sort(function(a, b) {
            // Active first, then stacked by start time
            if (a.status === 'active' && b.status === 'stacked') return -1;
            if (a.status === 'stacked' && b.status === 'active') return 1;
            return a.start - b.start;
        });
    }

    /**
     * Get the active (non-stacked) trip for a driver
     */
    function getActiveTrip(driverId) {
        return DATA.live.find(function(t) {
            return t.dr && t.dr.id === driverId && t.status === 'active';
        });
    }

    /**
     * Get all stacked trips for a driver, sorted by start time
     */
    function getStackedTrips(driverId) {
        return DATA.live.filter(function(t) {
            return t.dr && t.dr.id === driverId && t.status === 'stacked';
        }).sort(function(a, b) {
            return a.start - b.start;
        });
    }

    /**
     * Check if driver can accept more trips (max 3: 1 active + 2 stacked)
     */
    function canDriverAcceptTrip(driverId) {
        var tripCount = getDriverTrips(driverId).length;
        return tripCount < 3;
    }

    /**
     * Get driver position (last known location)
     */
    // MOVED TO kernel-timing.js
    // getDriverPosition()

    // ========================================================================
    // LOOKUP HELPERS (Reduce Code Duplication)
    // ========================================================================

    /**
     * Get driver by ID
     * Replaces: DATA.roster.find(function(d) { return d.id === driverId; })
     */
    function getDriverById(driverId) {
        return DATA.roster.find(function(d) { return d.id === driverId; });
    }

    /**
     * Get job/trip by ID from queue
     */
    function getQueueJobById(jobId) {
        return DATA.queue.find(function(j) { return j.id === jobId; });
    }

    /**
     * Get active trip by ID
     */
    function getLiveTripById(tripId) {
        return DATA.live.find(function(t) { return t.id === tripId; });
    }

    /**
     * Get client by phone number
     */
    function getClientByPhone(phone) {
        return DATA.clients.find(function(c) { return c.phone === phone; });
    }

    // ========================================================================
    // SERVICES: WEATHER
    // ========================================================================

    var WeatherService = {
        apiKey: null,
        
        getCurrentConditions: function() {
            // Return cached weather synchronously
            if (CACHE.weather.data) {
                return CACHE.weather.data;
            }
            
            // Default if no cache
            return {
                condition: 'clear',
                temperature: 0,
                visibility: 'high',
                roadCondition: 'dry'
            };
        },
        
        fetch: function() {
            var self = this;
            
            // Check cache
            if (CACHE.weather.data && (Date.now() - CACHE.weather.timestamp) < CACHE.weather.ttl) {
                return Promise.resolve(CACHE.weather.data);
            }
            
            // Fallback: assume clear conditions
            CACHE.weather.data = {
                condition: 'clear',
                temperature: 0,
                visibility: 'high',
                roadCondition: 'dry'
            };
            CACHE.weather.timestamp = Date.now();
            
            return Promise.resolve(CACHE.weather.data);
        },
        
        mapCondition: function(main) {
            var map = {
                'Clear': 'clear',
                'Clouds': 'clear',
                'Rain': 'rain',
                'Drizzle': 'rain',
                'Snow': 'snow',
                'Fog': 'fog',
                'Mist': 'fog'
            };
            return map[main] || 'clear';
        },
        
        inferRoadCondition: function(data) {
            if (data.rain || (data.weather && data.weather[0] && data.weather[0].main === 'Rain')) return 'wet';
            if (data.snow || (data.weather && data.weather[0] && data.weather[0].main === 'Snow')) return 'slippery';
            if (data.main && data.main.temp < -5) return 'icy';
            return 'dry';
        }
    };

    // ========================================================================
    // SERVICES: TRAFFIC
    // ========================================================================

    var TrafficService = {
        recentDelayFactors: [],
        
        fetch: function() {
            // Check cache
            if (CACHE.traffic.data && (Date.now() - CACHE.traffic.timestamp) < CACHE.traffic.ttl) {
                return Promise.resolve(CACHE.traffic.data);
            }
            
            // Calculate from recent Directions API responses
            var avgDelay = this.recentDelayFactors.length > 0
                ? this.recentDelayFactors.reduce(function(a, b) { return a + b; }, 0) / this.recentDelayFactors.length
                : 1.0;
            
            var condition = 'light';
            if (avgDelay > 1.3) condition = 'heavy';
            else if (avgDelay > 1.15) condition = 'moderate';
            
            CACHE.traffic.data = {
                generalCondition: condition,
                delayFactor: avgDelay,
                incidents: []
            };
            CACHE.traffic.timestamp = Date.now();
            
            return Promise.resolve(CACHE.traffic.data);
        },
        
        recordDelayFactor: function(durationWithTraffic, durationWithoutTraffic) {
            if (!durationWithoutTraffic) return;
            
            var factor = durationWithTraffic / durationWithoutTraffic;
            this.recentDelayFactors.push(factor);
            
            // Keep last 10 readings
            if (this.recentDelayFactors.length > 10) {
                this.recentDelayFactors.shift();
            }
        }
    };

    // ========================================================================
    // SERVICES: LLM TIMING
    // ========================================================================
    // ========================================================================
    // LLM TIMING SERVICE - MOVED TO kernel-timing.js
    // ========================================================================
    // LLMTimingService object moved to kernel-timing.js

    // ========================================================================
    // CONTEXT BUILDER
    // ========================================================================

    var ContextBuilder = {
        build: function(requestType, params) {
            var self = this;
            params = params || {};
            
            return Promise.all([
                WeatherService.fetch(),
                TrafficService.fetch()
            ]).then(function(results) {
                var weather = results[0];
                var traffic = results[1];
                
                return {
                    timestamp: Date.now(),
                    localTime: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
                    dayOfWeek: ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][new Date().getDay()],
                    
                    weather: weather,
                    traffic: traffic,
                    
                    drivers: self.getDriverState(),
                    queueLength: DATA.queue.length,
                    activeTrips: DATA.live.length,
                    
                    requestType: requestType,
                    requestParams: params
                };
            });
        },
        
        getDriverState: function() {
            return DATA.roster
                .filter(function(d) { return DATA.shift.indexOf(d.id) !== -1; })
                .map(function(driver) {
                    var trips = getDriverTrips(driver.id);
                    var activeTrip = getActiveTrip(driver.id);
                    var onBreak = DATA.breaks.find(function(b) { return b.driverId === driver.id && b.active; });
                    
                    var status = 'available';
                    if (onBreak) status = 'break';
                    else if (activeTrip) status = 'busy';
                    
                    var position = null;
                    var availableIn = 0;
                    
                    // Priority 1: Manual location set via map pin
                    if (driver.currentLocation) {
                        position = { lat: driver.currentLocation.lat, lon: driver.currentLocation.lon };
                    }
                    // Priority 2: Active trip dropoff location
                    else if (activeTrip) {
                        position = { lat: activeTrip.e[1], lon: activeTrip.e[0] };
                    }
                    // Priority 3: Last completed trip dropoff
                    else if (driver.lastDrop) {
                        position = { lat: driver.lastDrop.lat, lon: driver.lastDrop.lon };
                    }
                    // Priority 4: Hub default
                    else {
                        position = { lat: CONFIG.LOCALS[0].lat, lon: CONFIG.LOCALS[0].lon };
                    }
                    
                    // Calculate availability time
                    if (activeTrip) {
                        availableIn = Math.max(0, Math.ceil((activeTrip.end - Date.now()) / 60000));
                    }
                    
                    return {
                        id: driver.id,
                        name: driver.name,
                        status: status,
                        position: position,
                        availableIn: availableIn,
                        stackedTrips: trips.filter(function(t) { return t.status === 'stacked'; }).length
                    };
                });
        }
    };

    // ========================================================================
    // PICKUP QUOTE CALCULATOR (Fallback)
    // ========================================================================

    // MOVED TO kernel-timing.js
    // calculatePickupQuote()

    // ========================================================================
    // SESSION NOTES MODULE
    // ========================================================================

    var SessionNotes = {
        storageKey: 'stein_v99_notes',
        
        load: function() {
            var textarea = document.getElementById('session-notes-textarea');
            if (!textarea) {
                console.warn('📝 Session notes textarea not found');
                return;
            }
            
            try {
                var notes = localStorage.getItem(this.storageKey);
                if (notes) {
                    textarea.value = notes;
                    console.log('📝 Session notes loaded: ' + notes.length + ' chars');
                } else {
                    console.log('📝 No saved notes found');
                }
            } catch (err) {
                console.error('❌ Failed to load notes:', err);
            }
        },
        
        save: function() {
            var textarea = document.getElementById('session-notes-textarea');
            if (!textarea) {
                console.warn('📝 Save failed: textarea not found');
                return false;
            }
            
            try {
                var content = textarea.value;
                localStorage.setItem(this.storageKey, content);
                
                // Verify save was successful
                var verified = localStorage.getItem(this.storageKey);
                if (verified !== content) {
                    console.error('❌ Notes save verification failed! Expected ' + content.length + ' chars, got ' + (verified ? verified.length : 0));
                    showSystemMessage('⚠️ Notes save failed - storage may be full', 5000, 'error');
                    return false;
                }
                
                var statusEl = document.getElementById('notes-save-status');
                if (statusEl) {
                    statusEl.innerHTML = '<i class="fas fa-check-circle"></i> Auto-saved (' + content.length + ' chars)';
                    statusEl.style.color = 'rgba(39, 174, 96, 0.8)';
                    
                    setTimeout(function() {
                        statusEl.innerHTML = '<i class="fas fa-check-circle"></i> Auto-saved';
                        statusEl.style.color = 'rgba(255,255,255,0.5)';
                    }, 2000);
                }
                return true;
            } catch (err) {
                console.error('❌ Failed to save notes:', err);
                showSystemMessage('⚠️ Notes save failed: ' + err.message, 5000, 'error');
                
                var statusEl = document.getElementById('notes-save-status');
                if (statusEl) {
                    statusEl.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Save failed!';
                    statusEl.style.color = 'rgba(231, 76, 60, 0.8)';
                }
                return false;
            }
        },
        
        append: function(text) {
            var self = this;
            var textarea = document.getElementById('session-notes-textarea');
            
            console.log('📝 Appending note: ' + text.substring(0, 50) + '...');
            
            if (!textarea) {
                // Textarea not in DOM - append to localStorage directly
                try {
                    var existing = localStorage.getItem(this.storageKey) || '';
                    var newContent = existing + text;
                    
                    // Trim if over 500KB (keep last 250KB)
                    if (newContent.length > 500000) {
                        var trimmed = newContent.slice(-250000);
                        localStorage.setItem(this.storageKey, '\n[...earlier notes trimmed...]\n\n' + trimmed);
                        console.log('⚠️ Session notes trimmed to prevent overflow');
                    } else {
                        localStorage.setItem(this.storageKey, newContent);
                    }
                    
                    // Verify
                    var verified = localStorage.getItem(this.storageKey);
                    console.log('📝 Note appended to localStorage (textarea not visible). New length: ' + (verified ? verified.length : 0));
                } catch (err) {
                    console.error('❌ Failed to append note to localStorage:', err);
                    showSystemMessage('⚠️ Note append failed: ' + err.message, 5000, 'error');
                }
                return;
            }
            
            // Textarea is visible
            var oldLength = textarea.value.length;
            textarea.value += text;
            var newLength = textarea.value.length;
            
            console.log('📝 Appended to textarea: ' + oldLength + ' → ' + newLength + ' chars');
            
            // Trim if over 500KB
            if (textarea.value.length > 500000) {
                var trimmed = textarea.value.slice(-250000);
                textarea.value = '\n[...earlier notes trimmed...]\n\n' + trimmed;
                console.log('⚠️ Session notes trimmed to prevent overflow');
                showSystemMessage('Session notes auto-trimmed (size limit)', 3000, 'warning');
            }
            
            var saved = this.save();
            if (saved) {
                console.log('📝 Note appended and saved successfully');
            } else {
                console.error('❌ Note appended but save failed!');
            }
        },
        
        clear: function() {
            if (!confirm('Clear all notes? This cannot be undone.')) return;
            
            var textarea = document.getElementById('session-notes-textarea');
            if (textarea) {
                textarea.value = '';
            }
            
            try {
                localStorage.removeItem(this.storageKey);
                showSystemMessage('Notes cleared');
                console.log('📝 Session notes cleared');
            } catch (err) {
                console.error('❌ Failed to clear notes:', err);
            }
        },
        
        // Debug helper - call from console: SessionNotes.debug()
        debug: function() {
            var textarea = document.getElementById('session-notes-textarea');
            var stored = localStorage.getItem(this.storageKey);
            console.log('=== SESSION NOTES DEBUG ===');
            console.log('Textarea found:', !!textarea);
            console.log('Textarea length:', textarea ? textarea.value.length : 'N/A');
            console.log('localStorage length:', stored ? stored.length : 0);
            console.log('Match:', textarea && stored ? (textarea.value === stored) : 'N/A');
            console.log('Storage key:', this.storageKey);
            
            // Check localStorage usage
            var total = 0;
            for (var key in localStorage) {
                if (localStorage.hasOwnProperty(key)) {
                    total += localStorage[key].length;
                }
            }
            console.log('Total localStorage usage:', (total / 1024).toFixed(2) + ' KB');
            console.log('===========================');
            return { textareaLength: textarea ? textarea.value.length : 0, storedLength: stored ? stored.length : 0 };
        }
    };

    // ========================================================================
    // INITIALIZATION
    // ========================================================================

    function initCore() {
        console.log('🚀 Initializing Kernel-Core...');
        
        // Load data from localStorage
        Storage.load();
        
        // Initialize dispatch sheet date to today if not set
        if (!DATA.currentSheetDate) {
            DATA.currentSheetDate = getTodayDateString();
            console.log('📅 Initialized dispatch sheet date: ' + DATA.currentSheetDate);
        }
        
        // Initialize LLM connection to Cluster V2
        LLM.init();
        
        // Start clock interval
        if (STATE.intervals.clock) clearInterval(STATE.intervals.clock);
        STATE.intervals.clock = setInterval(updateClock, 1000);
        
        // Start queue timers interval (update every second)
        if (STATE.intervals.queueTimers) clearInterval(STATE.intervals.queueTimers);
        STATE.intervals.queueTimers = setInterval(function() {
            if (typeof updateQueueTimers === 'function') {
                updateQueueTimers();
            }
        }, 1000);
        
        // Initialize live timers (phase monitoring & progress bars)
        if (typeof initLiveIntervals === 'function') {
            initLiveIntervals();
        }
        updateClock();
        
        // Update badges
        updateBadges();
        
        // Render driver cards if drivers are clocked in
        if (typeof renderDriverCards === 'function') {
            renderDriverCards();
        }
        
        // Render queue on page load
        if (typeof renderQueue === 'function') {
            renderQueue();
        }
        
        // Initialize dispatch form date/time fields to current time
        initDispatchDateTime();
        
        // Initialize Global ETA widget - update every 10 seconds
        if (typeof updateGlobalETA === 'function') {
            updateGlobalETA();  // Initial update
            if (STATE.intervals.globalETA) clearInterval(STATE.intervals.globalETA);
            STATE.intervals.globalETA = setInterval(function() {
                if (typeof updateGlobalETA === 'function') {
                    updateGlobalETA();
                }
            }, 10000);  // Update every 10 seconds
        }
        
        console.log('✅ Kernel-Core initialized');
    }

    // ========================================================================
    // EXPOSE TO GLOBAL SCOPE
    // ========================================================================

    // Core objects
    window.CONFIG = CONFIG;
    window.DATA = DATA;
    window.STATE = STATE;
    window.CACHE = CACHE;
    
    // Storage
    window.Storage = Storage;
    window.save = function() { Storage.save(); };
    window.hardReset = function() { Storage.hardReset(); };
    window.exportData = function() { Storage.exportData(); };
    window.importData = function(f) { Storage.importData(f); };
    
    // Logging
    window.Logger = Logger;
    
    // Utilities
    window.getTodayDateString = getTodayDateString;
    window.getFormattedDate = getFormattedDate;
    window.formatTimeMMSS = formatTimeMMSS;
    window.formatTimeHHMMSS = formatTimeHHMMSS;
    window.formatSecondsShort = formatSecondsShort;
    // haversineDistance, calculateApproachTime moved to kernel-timing.js
    
    // Clock & Badges
    window.updateClock = updateClock;
    window.updateBadges = updateBadges;
    window.showSystemMessage = showSystemMessage;
    
    // Views
    /**
     * Toggle Settings section collapse/expand
     */
    function toggleSettingsSection(sectionId) {
        const section = document.getElementById(sectionId);
        const icon = document.getElementById(sectionId + '-icon');
        
        if (!section || !icon) return;
        
        if (section.style.display === 'none') {
            section.style.display = 'block';
            icon.className = 'fas fa-chevron-up';
        } else {
            section.style.display = 'none';
            icon.className = 'fas fa-chevron-down';
        }
    }
    
    window.toggleView = toggleView;
    window.toggleSettingsSection = toggleSettingsSection;
    window.togglePaneCollapse = togglePaneCollapse;
    
    // Driver helpers
    window.getDriverTrips = getDriverTrips;
    window.getActiveTrip = getActiveTrip;
    window.getStackedTrips = getStackedTrips;
    window.canDriverAcceptTrip = canDriverAcceptTrip;
    // getDriverPosition, calculatePickupQuote moved to kernel-timing.js
    
    // Lookup helpers
    window.getDriverById = getDriverById;
    window.getQueueJobById = getQueueJobById;
    window.getLiveTripById = getLiveTripById;
    window.getClientByPhone = getClientByPhone;
    
    // Services
    window.WeatherService = WeatherService;
    window.TrafficService = TrafficService;
    // LLMTimingService moved to kernel-timing.js (still exposed for compatibility)
    window.ContextBuilder = ContextBuilder;
    
    // LLM Abstraction (Cluster Integration)
    window.LLM = LLM;
    
    // LLM UI Functions
    window.refreshLLMModels = refreshLLMModels;
    window.updateLLMModel = updateLLMModel;
    window.testLLMConnection = testLLMConnection;

    // Session Notes
    window.SessionNotes = SessionNotes;
    
    // Initialization
    window.initCore = initCore;

    // Auto-initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initCore);
    } else {
        initCore();
    }

})();