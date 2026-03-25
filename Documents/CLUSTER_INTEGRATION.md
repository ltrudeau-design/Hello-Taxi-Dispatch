# Hello Taxi → Cluster Integration

**Status:** ✅ APPROVED by Opus 4.5 - Ready for Implementation  
**Date:** 2026-01-18  
**Approved Implementation Start:** Post-shift (after testing)

---

## Opus Review & Approval Notes

**Document Status:** Approved with recommendations

### What's Correct
- ✅ Real-time sync with local cache (Option C) is the right model
- ✅ Separation of persistent app data vs. session archives
- ✅ API endpoint structure is clean and appropriate
- ✅ Scribe as project-agnostic document generator is correct
- ✅ Phased rollout reduces risk

### Recommendations

**1. Offline Handling**
Add queue for writes when Cluster is unavailable:
```javascript
const writeQueue = [];

async function writeToCluster(endpoint, data) {
    try {
        await fetch(endpoint, { method: 'POST', body: JSON.stringify(data) });
    } catch (error) {
        writeQueue.push({ endpoint, data, timestamp: Date.now() });
        console.warn('Cluster unavailable, queued for retry');
    }
}

// Retry queue periodically
setInterval(async () => {
    while (writeQueue.length > 0) {
        const item = writeQueue[0];
        try {
            await fetch(item.endpoint, { method: 'POST', body: JSON.stringify(item.data) });
            writeQueue.shift(); // Success, remove from queue
        } catch {
            break; // Still offline, try again later
        }
    }
}, 5000);
```

**2. Data Validation**
Add schema validation on Cluster side to catch corrupt data before it's stored.

**3. Session Export Edge Cases**
What happens if:
- Shift spans midnight? (Start Jan 18 11pm, end Jan 19 1am)
- Multiple exports same day? (Forgot to export, do it twice)
- Export with active trips still in progress?

**Recommendation:** Use `YYYY-MM-DD_HHmmss.json` format instead of just date.

**4. Scribe Error Handling**
What if Scribe generates malformed PDF? Need:
- Validation step before returning to user
- Fallback to template-based generation
- User can regenerate if needed

---

## Architecture: Real-Time Sync with Local Cache

```
┌─────────────────────────────────────────────────────────────┐
│ Hello Taxi (Browser)                                         │
│                                                              │
│  DATA (Local Cache)                                          │
│  ├── roster      ────┐                                       │
│  ├── clients         │  Write immediately on change         │
│  ├── nicknames       │  (~20ms per operation)               │
│  ├── completedTrips ─┘                                       │
│                                                              │
│  STATE (Session-only, not persisted)                         │
│  ├── queue, live, shift, breaks, etc.                        │
└──────────────────┬───────────────────────────────────────────┘
                   │
                   │ HTTP API (localhost:8765)
                   ▼
┌─────────────────────────────────────────────────────────────┐
│ Cluster Backend                                              │
│                                                              │
│  Archivist Vault: ~/.cluster/archivist/vaults/taxi/         │
│  ├── roster.json           (Persistent - all drivers)       │
│  ├── clients.json          (Persistent - all customers)     │
│  ├── nicknames.json        (Persistent - all shortcuts)     │
│  └── sessions/                                               │
│      ├── 2026-01-18.json   (Archived shift data)            │
│      ├── 2026-01-17.json                                     │
│      └── ...                                                 │
└─────────────────────────────────────────────────────────────┘
```

**Key Principles:**
- ✅ Hello Taxi loads data from Cluster on startup
- ✅ Operates on local cache for performance
- ✅ Writes critical changes to Cluster immediately (~20ms)
- ✅ Cluster = source of truth, Hello Taxi = view layer
- ✅ Browser crash = no data loss (Cluster has everything)

---

## Data Architecture

### Persistent App Data (Cross-Session)

Stored in Archivist vault root, updated throughout operations:

**1. `roster.json`**
```javascript
[
  {
    id: 1,
    name: "Nina",
    phone: "204-555-0001",
    active: true,
    color: "#e74c3c",
    car: "Toyota Camry",
    carColor: "Silver",
    licenseNumber: "ABC 123"
  }
]
```
- **Updated when:** Driver added/edited/deleted
- **Write trigger:** Immediate on change
- **Loaded on:** App startup

**2. `clients.json`**
```javascript
[
  {
    id: 1,
    name: "John Smith",
    phone: "204-555-1234",
    notes: "Wheelchair accessible, prefers Nina"
  }
]
```
- **Updated when:** Client added/edited/deleted
- **Write trigger:** Immediate on change
- **Loaded on:** App startup

**3. `nicknames.json`**
```javascript
[
  {
    nickname: "Resthaven",
    address: "123 Care Home Rd",
    notes: "Use back entrance"
  }
]
```
- **Updated when:** Nickname added/deleted
- **Write trigger:** Immediate on change
- **Loaded on:** App startup

---

### Session Data (Per-Shift Archives)

Stored in `sessions/YYYY-MM-DD_HHmmss.json`, exported at end of shift:

```javascript
{
  date: "2026-01-18",
  exportedAt: "2026-01-18T18:30:00Z",
  
  // Shift metadata
  shift: [
    { name: "Nina", startTime: 1705588800000, endTime: 1705606800000 }
  ],
  
  // Completed trips (source for dispatch sheet)
  completedTrips: [
    {
      id: 123,
      tripName: "Trip #123",
      driver: "Nina",
      customer: { name: "John Smith", phone: "204-555-1234" },
      pickup: { name: "123 Main St", lat: 49.5258, lng: -96.6839 },
      dropoff: { name: "456 Oak Ave", lat: 49.5289, lng: -96.6901 },
      waypoints: [],
      assignedAt: 1705588800000,
      completedAt: 1705592400000,
      duration: 15,
      distance: 5.2,
      notes: "Medical appointment"
    }
  ],
  
  // Analytics
  metrics: {
    totalTrips: 47,
    totalDrivers: 6,
    totalRevenue: null  // Future enhancement
  }
}
```

- **Created when:** "Export to Cluster" button clicked at end of shift
- **Purpose:** Historical record, dispatch sheet generation, analytics
- **Immutable:** Once exported, session data doesn't change

---

### Session-Only Data (Not Persisted)

These remain in Hello Taxi's `STATE` object, reset each session:

- `queue` - Scheduled/unassigned trips
- `live` - Active trips in progress
- `shift` - Today's clocked-in drivers
- `breaks` - Driver break tracking
- `turnSequence` - Fair assignment rotation
- `addressCache` - Geocoding performance cache

**Rationale:** These are ephemeral workflow state, not historical records.

---

## API Endpoints

### On Startup (Read)

**`GET /api/taxi/roster`**
```javascript
// Response
{
  success: true,
  data: [...drivers],
  updated: "2026-01-18T08:00:00Z"
}
```

**`GET /api/taxi/clients`**
```javascript
// Response
{
  success: true,
  data: [...clients],
  updated: "2026-01-18T08:00:00Z"
}
```

**`GET /api/taxi/nicknames`**
```javascript
// Response
{
  success: true,
  data: [...nicknames],
  updated: "2026-01-18T08:00:00Z"
}
```

---

### During Shift (Write - Real-time)

**`POST /api/taxi/roster`**
```javascript
// Request
{
  action: "add" | "edit" | "delete",
  driver: { id, name, phone, ... }
}

// Response
{
  success: true,
  updated: "2026-01-18T14:30:00Z"
}
```

**`POST /api/taxi/clients`**
```javascript
// Request
{
  action: "add" | "edit" | "delete",
  client: { id, name, phone, notes }
}

// Response
{
  success: true,
  updated: "2026-01-18T14:30:00Z"
}
```

**`POST /api/taxi/nicknames`**
```javascript
// Request
{
  action: "add" | "delete",
  nickname: { nickname, address, notes }
}

// Response
{
  success: true,
  updated: "2026-01-18T14:30:00Z"
}
```

**`POST /api/taxi/trip/complete`**
```javascript
// Request
{
  trip: {
    id, tripName, driver, customer, pickup, dropoff,
    waypoints, assignedAt, completedAt, duration, distance, notes
  }
}

// Response
{
  success: true,
  tripId: 123
}
```

---

### End of Shift (Archive + Generate)

**`POST /api/taxi/export_session`**
```javascript
// Request
{
  date: "2026-01-18",
  shift: [...],
  completedTrips: [...],
  metrics: { totalTrips, totalDrivers, totalRevenue }
}

// Response
{
  success: true,
  sessionPath: "sessions/2026-01-18_183045.json",
  tripCount: 47
}
```

**`POST /api/taxi/generate_dispatch_sheet`**
```javascript
// Request
{
  date: "2026-01-18"
}

// Response
{
  success: true,
  pdf: "base64EncodedPDF" | "url",
  format: "application/pdf"
}
```

**Backend Flow:**
1. Cluster loads `sessions/2026-01-18_*.json` (latest for that date)
2. Delegates to **Scribe** sub-agent with:
   - Session data
   - Template/format requirements
   - Generation instructions
3. Scribe returns formatted PDF
4. Cluster returns PDF to Hello Taxi

---

## Scribe Sub-Agent Design

**Purpose:** General-purpose document generator (project-agnostic)

**YAML Definition:** `agents/definitions/scribe.yaml`

```yaml
name: scribe
description: Document generation specialist (PDFs, reports, formatted output)
model: mlx-community/Qwen2.5-Coder-32B-Instruct-4bit
temperature: 0.3
max_tokens: 4096

tools:
  - read_file
  - write_file

system_prompt: |
  You are SCRIBE, a document generation specialist.
  
  Your task: Generate professional, well-formatted documents based on data provided.
  
  Input: Structured data (JSON) + template/format requirements
  Output: Formatted document (HTML, PDF-ready, markdown, etc.)
  
  Guidelines:
  - Follow the exact format/style specified
  - Be precise with data (no hallucinations)
  - Maintain professional presentation
  - Include all required fields
  - Optimize for print/PDF when applicable
```

**Usage Pattern:**
```python
# In Cluster backend
from cluster.factory import get_agent

scribe = get_agent("scribe")

# Generate dispatch sheet
prompt = f"""
Generate a Hello Taxi dispatch sheet for {date}.

Data: {json.dumps(session_data, indent=2)}

Format requirements:
- PDF-ready HTML
- Company header with logo
- Trip table (time, customer, phone, route, driver, notes)
- Driver summary section
- Trip count totals
- Use existing Hello Taxi styling (colors, fonts)

Return clean HTML ready for PDF conversion.
"""

html_output = scribe.run(prompt)
pdf = convert_html_to_pdf(html_output)
```

---

## Implementation Phases

### Phase 1: Backend Infrastructure (Cluster)
**Goal:** Set up Archivist vault and API endpoints

**Tasks:**
1. Create taxi vault structure in Archivist
2. Implement `/api/taxi/*` endpoints in `api_server.py`
3. Add Scribe sub-agent to Cluster
4. Test endpoints with curl

**Deliverables:**
- `~/.cluster/archivist/vaults/taxi/` exists
- API endpoints respond correctly
- Scribe can generate test documents

**Estimated Time:** 3-4 hours

---

### Phase 2: Hello Taxi Refactor (Frontend)
**Goal:** Replace localStorage with Cluster API calls

**Tasks:**
1. Add API wrapper functions to `kernel-core.js`
2. Replace `loadAll()` with Cluster API calls
3. Replace `save()` with immediate API calls for critical events
4. Update `kernel-data.js` CRUD functions
5. Test data persistence across browser refresh

**Deliverables:**
- Roster/clients/nicknames load from Cluster on startup
- Changes save to Cluster immediately
- Browser crash = no data loss

**Estimated Time:** 4-5 hours

---

### Phase 3: Session Export & Dispatch Sheet
**Goal:** End-of-shift workflow

**Tasks:**
1. Add "Export to Cluster" button to UI
2. Implement session export function
3. Add "Generate Dispatch Sheet" button
4. Test PDF generation via Scribe
5. Validate dispatch sheet accuracy

**Deliverables:**
- One-click session export
- Scribe-generated dispatch sheet PDF
- Accurate trip data (no duplicates/canceled trips)

**Estimated Time:** 3-4 hours

---

### Phase 4: Testing & Validation
**Goal:** Prove reliability in production

**Tasks:**
1. Run full shift with new system
2. Compare Scribe-generated sheet vs. manual .txt notes
3. Identify and fix any data discrepancies
4. Stress test (crash browser mid-shift, verify data recovery)
5. Document any edge cases

**Deliverables:**
- System proven reliable for production use
- Manual .txt notes no longer needed
- Documented known issues (if any)

**Estimated Time:** 1-2 shifts (real-world testing)

---

## Success Criteria

**Phase 1-3 Complete When:**
- ✅ Hello Taxi loads roster/clients/nicknames from Cluster
- ✅ All changes persist to Cluster immediately
- ✅ Browser crash doesn't lose data
- ✅ "Export to Cluster" creates session archive
- ✅ "Generate Dispatch Sheet" produces accurate PDF
- ✅ Dispatch sheet matches reality (no duplicates/errors)

**System Proven When:**
- ✅ User stops maintaining manual .txt notes
- ✅ Dispatch sheet is trusted for management reporting
- ✅ No data loss incidents for 1 week of production use

---

## Risks & Mitigations

**Risk 1: Network latency slows dispatch**
- **Mitigation:** Localhost API calls are fast (~20ms), non-blocking
- **Fallback:** Queue writes if Cluster temporarily unavailable

**Risk 2: Scribe generates incorrect dispatch sheets**
- **Mitigation:** Cross-reference with manual notes initially
- **Fallback:** Keep template-based generation as backup

**Risk 3: Data corruption in Archivist**
- **Mitigation:** Archivist uses file-based storage (human-readable JSON)
- **Fallback:** Manual recovery possible via vault files

**Risk 4: Breaking production during refactor**
- **Mitigation:** Phased rollout, keep localStorage as fallback initially
- **Fallback:** Revert to previous version if critical issues

---

## Future Enhancements (Post-MVP)

**Analytics & Intelligence:**
- Trip search via Archivist FTS5 ("Show me all medical trips")
- Client frequency tracking (identify VIP customers)
- Driver performance metrics
- Revenue reports

**Integrations:**
- Twilio integration for automated SMS sending
- Multi-device support (multiple dispatchers)
- Real-time sync across devices

**Advanced Features:**
- Customer portal (track their rides)
- Driver mobile app (accept assignments)
- Automated billing/invoicing

---

## Implementation Status

**Current Phase:** Design Complete, Awaiting Implementation  
**Next Step:** Phase 1 - Backend Infrastructure  
**Blocked By:** None  
**Estimated Start:** Post-shift testing (Jan 19, 2026)

---

**Document Version:** 1.0  
**Last Updated:** 2026-01-18 13:30  
**Author:** Rovodev (Sonnet)  
**Reviewed By:** Opus 4.5 ✅  
**Approved By:** User ✅
