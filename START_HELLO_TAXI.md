# Hello Taxi — Startup Guide
**Last updated:** 2026-03-20 | **Current version:** V105

---

## Quickest Start — Double Click

**`START_HELLO_TAXI.command`** — double-click this file in Finder. Done.

Starts both servers, waits for AI model to load, opens the app automatically.

---

## From EauDev / Terminal

Say **"start Hello Taxi"** or **"HT up"** in EauDev, or run:

```bash
cd "/Users/eaumac/Desktop/Code/Hello Taxi Dispatch" && bash START_HELLO_TAXI.command
```

EauDev will respond with confirmation once both servers are running.

---

## Manual Start (if needed)

```bash
cd "/Users/eaumac/Desktop/Code/Hello Taxi Dispatch"

# 1. Kill any existing instances
lsof -ti:8080,8765 | xargs kill -9 2>/dev/null

# 2. Start HTTP server (serves the web app)
python3 -m http.server 8080 &

# 3. Start llama-server (Qwen3.5-4B) on port 8766
llama-server -m ~/.cluster/models/Qwen3.5-4B-Q4_K_M.gguf \
  --host 127.0.0.1 --port 8766 -ngl 99 -c 8192 --flash-attn on --no-mmap &

# 4. Start WebSocket proxy
python3 hello_taxi_ws_server.py &

# 5. Wait for model load, then open
sleep 12 && open http://localhost:8080/Index_v105.html
```

---

## Stop Servers

```bash
lsof -ti:8080,8765,8766 | xargs kill
```

---

## Verify Running

```bash
lsof -i:8080 && lsof -i:8765 && lsof -i:8766
```

**Browser indicators:**
- "Connected to Cluster" message visible
- Console: `🤖 WebSocket connected`
- No red errors in browser console (F12)

---

## Configuration

| Setting | File | Default |
|---------|------|---------|
| AI Model | `START_HELLO_TAXI.command` | `Qwen3.5-4B-Q4_K_M.gguf` |
| Context window | `START_HELLO_TAXI.command` | `-c 8192` |
| Max tokens | `hello_taxi_ws_server.py` | `max_tokens=500` |
| llama-server port | `START_HELLO_TAXI.command` | 8766 |
| HTTP port | `START_HELLO_TAXI.command` | 8080 |
| WebSocket port | `hello_taxi_ws_server.py` | 8765 |

---

## Troubleshooting

| Problem | Cause | Fix |
|---------|-------|-----|
| "Could not geocode" | Address format | Not a server issue — rephrase address |
| WebSocket timeout | Model overloaded | Restart `hello_taxi_ws_server.py` |
| Sluggish after hours | KV cache full | Auto-resets every 50 requests; manual: restart WS server |
| Port already in use | Previous session | `lsof -ti:8080,8765 \| xargs kill` |
| App won't open | HTTP server not running | Check `lsof -i:8080` |

---

## Server Architecture

```
Browser (Index_v105.html)
    ↓ HTTP GET (static files)
python3 -m http.server :8080

    ↓ WebSocket ws://localhost:8765
hello_taxi_ws_server.py  (lightweight proxy)
    ↓ HTTP POST http://localhost:8766/v1/chat/completions
llama-server :8766
    ↓ Metal GPU inference
Qwen3.5-4B-Q4_K_M.gguf (~/.cluster/models/)

    ↓ Google Maps API (geocoding + routing)
maps.googleapis.com
```

---

## Version History

| Version | Notes |
|---------|-------|
| V118 | Dispatch sheets now use Trip Names instead of full addresses (privacy for printed sheets). Google Maps link still has full coordinates. |
| V117 | Enhanced debug logging for disappearing driver cards. Added try/catch error handling, logs clocked-in drivers, DATA.shift state, and per-driver trip counts. |
| V116 | Stacked trip activation fix: Force-expand driver card when stacked trip auto-activates (after ~5 min). Added detailed logging for activation and render events. |
| V115 | CRITICAL FIX: Stacked trips no longer disappear. Fixed race condition in render system - use renderDriverCards() consistently, clear forceExpandDriverId after render completes. Added debug logging. |
| V114 | SMS Copy now uses Trip Name (e.g., "123 Main St → Walmart") instead of full addresses. Google Maps link contains actual coordinates. |
| V113 | kernel-timing.js fixes: Fixed recalculateETA() to use LLM.call() instead of broken fetch() pattern. All 6 kernels audited and fixed! |
| V112 | kernel-live.js fixes: Fixed malformed comment block, fixed LLMTimingService to TimingService for consistency. |
| V111 | kernel-map.js fixes: Removed dead initApp() call, use getTodayDateString() for consistency in saveCorrection(). |
| V110 | kernel-dispatch.js fixes: Fixed LLM.checkHealth() to use LLM.isAvailable(), fixed generateTripSMSTemplate() to keep street numbers (consistent with trip names). |
| V109 | kernel-data.js fixes: Fixed LLMTimingService check to use LLM.isAvailable() in generateTripSMSWithLLM(). |
| V108 | kernel-core.js fixes: Fixed deprecated LLM UI functions, changed LOG_LEVEL to 2 (production), fixed interval timing comments. |
| V107 | Geocoding improved for partial addresses (e.g., "224 Lilac" → finds "224 Lilac Bay" by trying street suffixes). |
| V106 | LLM address parsing fixed - outputs raw addresses (e.g., "Superstore") for geocoder to resolve (no more hallucination). |
| V105 | SMS format fixed (no full addresses). Stacked trips no longer disappear. Trip names include street numbers. Qwen3.5-4B model (balanced speed/capability). |
| V104 | Active. Stable. llama-server backend (Qwen3.5-9B via port 8766). |
| V103 | Legacy. Keep for reference only. |

