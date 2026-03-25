# Hello Taxi Dispatch System

**Version:** V113  
**Last Updated:** March 20, 2026  
**Status:** Production Ready

---

## Overview

Hello Taxi is a real-time taxi dispatch web application used in active production. Built with vanilla JavaScript (7 kernel modules), Python WebSocket server (Qwen3.5-4B inference), and Google Maps API.

### Key Features

- **LLM-Powered Dispatch Parsing** - Natural language input → structured call cards
- **Real-Time Driver Tracking** - Live trip phases, progress bars, ETA updates
- **Smart Driver Assignment** - Scoring system (60% distance, 25% availability, 15% fairness)
- **Stacked Trips** - Multiple trips per driver with automatic activation
- **Place Nicknames** - Local shorthand resolution (e.g., "Superstore" → full address)
- **Client Database** - Phone lookup, default addresses, notes
- **Dispatch Sheets** - Historical trip records, PDF export
- **Shift Management** - Clock in/out, breaks, turn sequence

---

## Architecture

### Kernel Structure

```
js/
├── kernel-core.js (V108)     # Bootstrap, DATA, STATE, LLM, Archivist, Storage
├── kernel-data.js (V109)     # Clients, Nicknames, Roster, SMS generation
├── kernel-dispatch.js (V110) # Dispatch form, LLM parsing, queue management
├── kernel-map.js (V111)      # Google Maps, polylines, geocoding
├── kernel-live.js (V112)     # Live trips, driver cards, phase management
├── kernel-timing.js (V113)   # ETA calculations, driver scoring, TimingService
└── kernel-preparser.js       # Legacy (disabled, LLM handles all parsing)
```

### Server Architecture

```
Browser (Index_v105.html)
    ↓ HTTP GET (static files)
python3 -m http.server :8080

    ↓ WebSocket ws://localhost:8765
hello_taxi_ws_server.py (lightweight proxy)
    ↓ HTTP POST http://localhost:8766/v1/chat/completions
llama-server :8766
    ↓ Metal GPU inference
Qwen3.5-4B-Q4_K_M.gguf (~/.cluster/models/)

    ↓ Google Maps API (geocoding + routing)
maps.googleapis.com
```

### Data Flow

```
LLM Parsing → Form Population → Geocoding → Route Calculation → Queue → Assignment → Live Trips → Dispatch Sheet
```

---

## Quick Start

### Double-Click (Easiest)

Double-click `START_HELLO_TAXI.command` in Finder. Done.

### From Terminal

```bash
cd "/Users/eaumac/Desktop/Code/Hello Taxi Dispatch" && bash START_HELLO_TAXI.command
```

### From EauDev

Say **"start Hello Taxi"** or **"HT up"**

### Manual Start

```bash
cd "/Users/eaumac/Desktop/Code/Hello Taxi Dispatch"

# 1. Kill existing instances
lsof -ti:8080,8765,8766 | xargs kill -9 2>/dev/null

# 2. Start HTTP server
python3 -m http.server 8080 &

# 3. Start llama-server (Qwen3.5-4B)
llama-server -m ~/.cluster/models/Qwen3.5-4B-Q4_K_M.gguf \
  --host 127.0.0.1 --port 8766 -ngl 99 -c 8192 --flash-attn on --no-mmap &

# 4. Start WebSocket proxy
python3 hello_taxi_ws_server.py &

# 5. Wait for model load, then open
sleep 12 && open http://localhost:8080/Index_v105.html
```

### Stop Servers

```bash
lsof -ti:8080,8765,8766 | xargs kill
```

---

## Configuration

| Setting | File | Default |
|---------|------|---------|
| AI Model | `START_HELLO_TAXI.command` | `Qwen3.5-4B-Q4_K_M.gguf` |
| Context Window | `START_HELLO_TAXI.command` | 8192 tokens |
| Max Tokens | `hello_taxi_ws_server.py` | 500 |
| llama-server Port | `START_HELLO_TAXI.command` | 8766 |
| HTTP Port | `START_HELLO_TAXI.command` | 8080 |
| WebSocket Port | `hello_taxi_ws_server.py` | 8765 |
| Google API Key | `kernel-core.js` | (configured) |
| Log Level | `kernel-core.js` | 2 (INFO) |

---

## Usage Guide

### Dispatch Workflow

1. **Input** - Type or dictate in dispatch pane input field:
   ```
   John 204-555-1234 from: Superstore to: 128 Reimer Street
   ```

2. **Process** - Click "Process with Qwen" or let pre-parser auto-fill

3. **Review** - Verify populated fields:
   - Phone, Name (auto-recall from client database)
   - Pickup, Dropoff (geocoded with lat/lon)
   - Prebook date/time (if scheduled)
   - Notes, waypoints (if any)

4. **Add to Queue** - Click "Add to Queue" button

5. **Assign Driver** - Click trip in queue → select driver from Live pane

6. **Monitor** - Watch live trip progress, phase transitions

7. **Complete** - Driver completes trip → auto-moves to dispatch sheet

### Natural Language Formats Supported

**Structured:**
```
10:00pm
Mike 456 339 5960
from: SRSS
to: McDonalds
```

**Conversational:**
```
Hi this is Mike calling 456-339-5960 I need a taxi pickup at SRSS going to McDonald's please book for 10pm thanks
```

**Minimal:**
```
John 204-555-1234 Superstore to Walmart prebook 2pm tomorrow
```

### Place Nicknames

Common local shorthand is auto-resolved:
- "Superstore" → Real Canadian Superstore address
- "Hub" → Steinbach Hub
- "St. Joe's" → St. Joseph's General Hospital
- "The Mall" → Pine Ridge Shopping Centre

Add custom nicknames in Settings & Data → Place Nicknames.

### Client Database

Regular clients are auto-recalled by phone number:
- Name auto-fills
- Default address suggests
- Notes visible to driver

Add clients in Settings & Data → Clients.

---

## Kernel Documentation

### kernel-core.js (V108)

**Purpose:** App bootstrap, global state, storage, LLM abstraction

**Key Objects:**
- `CONFIG` - App configuration
- `DATA` - Persistent data (roster, queue, live, clients, etc.)
- `STATE` - Runtime state (map, markers, intervals)
- `LLM` - WebSocket LLM interface to Cluster V2
- `Archivist` - Cluster vault sync (optional)
- `Storage` - localStorage persistence
- `WeatherService`, `TrafficService` - External data
- `ContextBuilder` - Build context for LLM calls

**Exposed Functions:**
- `save()` - Save DATA to localStorage
- `getDriverTrips(driverId)` - Get driver's trips
- `getActiveTrip(driverId)` - Get active trip
- `getStackedTrips(driverId)` - Get stacked trips
- `canDriverAcceptTrip(driverId)` - Check capacity
- `getTodayDateString()` - Format date

---

### kernel-data.js (V109)

**Purpose:** Data management - clients, nicknames, roster, SMS

**Key Functions:**
- `renderClients()` - Render client list
- `addClient()`, `editClient()`, `deleteClient()` - Client CRUD
- `renderPlaceNicknames()` - Render nickname list
- `addPlaceNickname()` - Add nickname
- `renderRoster()` - Render driver roster
- `addDriver()`, `editDriver()`, `deleteDriver()` - Driver CRUD
- `clk(driverId)` - Clock in/out driver
- `startBreak()`, `endBreak()` - Break management
- `renderDispatchSheet()` - Render dispatch sheet
- `exportSheetPDF()` - Export to PDF
- `copyTripSMS()` - Generate SMS for driver
- `generateTripSMSTemplate()` - Template-based SMS
- `getLLMCorrectionsContext()` - LLM context injection

---

### kernel-dispatch.js (V110)

**Purpose:** Dispatch form, LLM parsing, queue, assignment

**Key Functions:**
- `processDispatchLLM()` - Parse natural language input
- `autoGeocodeAndEstimate()` - Geocode addresses, calculate route
- `addToQueue()` - Add trip to queue
- `renderQueue()` - Render queue pane
- `assignDriver(jobId)` - Enter assignment mode
- `selectDriverForAssignment(driverId)` - Execute assignment
- `cancelAssignment()` - Cancel assignment mode
- `calculateUrgency(job)` - Calculate urgency level
- `generateCallSummaryToNotes()` - Generate call summary
- `copyTripSMSById()` - Copy trip SMS

---

### kernel-map.js (V111)

**Purpose:** Google Maps integration, polylines, geocoding

**Key Functions:**
- `initMap()` - Initialize Google Maps
- `setMapStyle()` - Change map style
- `geocodeAddress(address)` - Geocode with nickname/cache lookup
- `setupSearch(inputId, listId)` - Autocomplete setup
- `mapPick(mode)` - Map pin selection mode
- `showDispatchPolyline(geoJson)` - Show route polyline
- `showQueuePolyline(id, geo)` - Show queue route
- `showLivePolyline(id, geo, color)` - Show live route
- `calculateApproachRoute(driverId, pickupCoords)` - Calculate approach

---

### kernel-live.js (V112)

**Purpose:** Live trips, driver cards, phase management

**Key Functions:**
- `activateJob(job, driverId)` - Assign driver, move to live
- `renderDriverCards()` - Render live pane
- `toggleDriverCardExpand(driverId)` - Expand/collapse card
- `updateDriverCardTimers()` - Update progress bars
- `monitorTripPhases()` - Auto-advance phases
- `pickUpNow(tripId)` - Advance to next phase
- `activateStackedTripManually(tripId)` - Activate stacked trip
- `completeTrip(tripId)` - Complete trip, move to sheet
- `cancelTrip(tripId)` - Cancel trip
- `returnToQueue(tripId)` - Return trip to queue

---

### kernel-timing.js (V113)

**Purpose:** ETA calculations, driver scoring, timing

**Key Objects:**
- `TimingService` - Main service object (all functions exposed)
- `LLMTimingService` - LLM-based ETA (optional)
- `TIMING_CONSTANTS` - Configuration constants

**Key Functions:**
- `calculatePickupQuote(pickupCoords)` - Sync pickup ETA
- `calculatePickupQuoteAsync(pickupCoords)` - Async pickup ETA (Google API)
- `analyzeDriverAvailability(drivers)` - Analyze driver status
- `calculateDeterministicETA(analysis)` - Calculate global ETA
- `updateGlobalETA()` - Update ETA widget
- `getSuggestedDrivers(job)` - Get driver suggestions (sync)
- `getSuggestedDriversAsync(job)` - Get driver suggestions (async)
- `adjustBuffer(tripId, delta)` - Adjust trip buffer
- `recalculateRemainingRoute(trip)` - Recalculate after waypoint

---

## Data Structures

### Trip Object (Queue/Live)

```javascript
{
    id: Number,              // Unique ID (Date.now())
    ts: Number,              // Timestamp created
    cName: String,           // Customer name
    cPhone: String,          // Customer phone
    tripName: String,        // "Pickup St → Dropoff St"
    prebook: String|null,    // ISO date string or null
    notes: String,           // Special instructions
    buffer: Number,          // Buffer minutes (0-60)
    geo: Object,             // GeoJSON polyline
    mins: Number,            // Trip duration
    minsWithTraffic: Number, // With traffic adjustment
    s: [lon, lat],           // Pickup coordinates
    e: [lon, lat],           // Dropoff coordinates
    sN: String,              // Pickup address
    eN: String,              // Dropoff address
    waypoints: Array,        // [{coords, name, waitTime}]
    pickupQuote: Object,     // {quotedMinutes, confidence, drivers}
    // Live-only:
    dr: Object,              // Driver {id, name, call, color}
    start: Number,           // Trip start timestamp
    approachEnd: Number,     // Approach phase end
    end: Number,             // Trip end timestamp
    approach: Number,        // Approach minutes
    approachGeo: Object,     // Approach polyline
    status: String,          // "active" | "stacked"
    phase: String,           // "approach" | "active" | "waiting"
    phaseStart: Number,      // Current phase start
    phaseEnd: Number,        // Current phase end
    currentWaypointIndex: Number  // Current waypoint
}
```

### Driver Object

```javascript
{
    id: Number,              // Unique ID
    name: String,            // Driver name
    call: String,            // Phone number
    car: String,             // Car number
    color: String,           // Hex color
    lastDrop: Object,        // {lat, lon, name}
    currentLocation: Object  // {lat, lon, name, timestamp}
}
```

---

## Troubleshooting

### Map Not Loading

**Error:** "BillingNotEnabledMapError"

**Fix:** Add billing to Google Cloud project. Google gives $200/month free credit.

### WebSocket Disconnected

**Error:** "Cluster Offline" badge

**Fix:** Restart WebSocket proxy:
```bash
lsof -ti:8765 | xargs kill
python3 hello_taxi_ws_server.py &
```

### LLM Not Parsing

**Symptoms:** Form not populating after "Process with Qwen"

**Fix:**
1. Check console for LLM errors
2. Verify model loaded: `lsof -i:8766`
3. Restart llama-server if needed

### Geocoding Fails

**Error:** "Could not geocode pickup or dropoff address"

**Fix:**
1. Use more complete address (add street suffix)
2. Use place nickname if available
3. Use map pin to select location

### Stacked Trips Not Activating

**Symptoms:** Stacked trip doesn't activate when previous trip completes

**Fix:**
1. Check trip status in console logs
2. Verify `monitorTripPhases()` is running
3. Manually activate with "Activate Now" button

---

## Version History

| Version | Date | Notes |
|---------|------|-------|
| V118 | 2026-03-22 | Dispatch sheets use Trip Names (privacy for printed sheets) |
| V117 | 2026-03-21 | **FIX**: Stacked trip auto-activation now force-expands driver card. Detailed logging added. |
| V116 | 2026-03-21 | Enhanced debug logging for disappearing driver cards. Added try/catch error handling. |
| V115 | 2026-03-20 | **CRITICAL**: Fixed stacked trips disappearing. Render race condition resolved. |
| V114 | 2026-03-20 | SMS Copy uses Trip Name instead of addresses |
| V113 | 2026-03-20 | kernel-timing.js: Fixed recalculateETA() LLM call pattern |
| V112 | 2026-03-20 | kernel-live.js: Fixed comment block, service name consistency |
| V111 | 2026-03-20 | kernel-map.js: Removed dead initApp() call |
| V110 | 2026-03-20 | kernel-dispatch.js: Fixed LLM checks, SMS street numbers |
| V109 | 2026-03-20 | kernel-data.js: Fixed LLM service check |
| V108 | 2026-03-20 | kernel-core.js: Fixed deprecated functions, log level |
| V107 | 2026-03-19 | Geocoding suffix fallback for partial addresses |
| V106 | 2026-03-19 | LLM address parsing: raw output, geocoder resolves |
| V105 | 2026-03-19 | SMS format, stacked trips, trip names, Qwen3.5-4B |
| V104 | 2026-02-24 | Stable production version (Qwen3.5-9B) |

---

## Code Quality

### Audit Summary (V113)

| Kernel | Lines | Issues Found | Fixed |
|--------|-------|--------------|-------|
| kernel-core.js | 2,020 | 7 | ✅ |
| kernel-data.js | 1,770 | 3 | ✅ |
| kernel-dispatch.js | 2,238 | 4 | ✅ |
| kernel-map.js | 1,558 | 3 | ✅ |
| kernel-live.js | 1,401 | 3 | ✅ |
| kernel-timing.js | 1,899 | 3 | ✅ |
| **Total** | **10,886** | **23** | **✅ All Fixed** |

### Code Standards

- **Strict mode:** `'use strict'` in all kernels
- **IIFE pattern:** All kernels wrapped in `(function() { ... })()`
- **Naming:** camelCase for functions, UPPER_CASE for constants
- **Comments:** JSDoc-style for public functions
- **Error handling:** Try/catch for localStorage, LLM calls
- **Logging:** Configurable log levels (ERROR, WARN, INFO, DEBUG)

---

## Support

### Documentation Files

- `README.md` - This file (comprehensive documentation)
- `START_HELLO_TAXI.md` - Startup guide
- `PENDING_FIXES.md` - Future improvements (archived)
- `.agent.md` - EauDev workspace context

### Backup Files

- `Index_v104.html` - Stable backup version
- `js/*.bak` - Old backups (safe to delete)

### Vault

- `VAULT/` - Historical data, shift reports, documentation
- `Dispatch Sheets/` - PDF dispatch sheets (historical records)

---

*Hello Taxi Dispatch System - Built for Steinbach, Manitoba*  
*© 2026 - Production Ready V113*
