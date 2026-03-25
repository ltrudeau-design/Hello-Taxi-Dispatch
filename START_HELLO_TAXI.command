#!/bin/bash
# Hello Taxi — One-click startup
# Double-click this file to start Hello Taxi

cd "/Users/eaumac/Desktop/Code/Hello Taxi Dispatch"

echo "🚕 Starting Hello Taxi Dispatch System..."

# Kill any existing instances
lsof -ti:8080 | xargs kill -9 2>/dev/null
lsof -ti:8765 | xargs kill -9 2>/dev/null
lsof -ti:8766 | xargs kill -9 2>/dev/null
sleep 1

# Start HTTP server
python3 -m http.server 8080 &
HTTP_PID=$!
echo "✓ HTTP server started (PID $HTTP_PID) → http://localhost:8080"

# Start llama-server (Qwen3.5-4B) on port 8766
llama-server \
  -m "$HOME/.cluster/models/Qwen3.5-4B-Q4_K_M.gguf" \
  --host 127.0.0.1 \
  --port 8766 \
  -ngl 99 \
  -t 8 \
  -c 8192 \
  --temp 0.7 \
  --top-p 0.95 \
  --top-k 20 \
  --flash-attn on \
  --no-mmap \
  --log-disable \
  > /tmp/hello_taxi_llama.log 2>&1 &
LLAMA_PID=$!
echo "✓ llama-server starting (PID $LLAMA_PID) → http://localhost:8766 [Qwen3.5-4B]"

# Start WebSocket proxy server
python3 hello_taxi_ws_server.py &
WS_PID=$!
echo "✓ WebSocket proxy started (PID $WS_PID) → ws://localhost:8765"

# Wait for model to load
echo "⏳ Loading AI model (Qwen3.5-4B)..."
sleep 12

# Open app
open "http://localhost:8080/Index_v104.html"
echo "✅ Hello Taxi ready for dispatch!"
echo ""
echo "To stop: close this window or run:"
echo "  lsof -ti:8080,8765,8766 | xargs kill"

# Keep terminal open
wait
