#!/usr/bin/env python3
import asyncio
import websockets
import json
import urllib.request
import urllib.error

LLAMA_SERVER_URL = "http://localhost:8766/v1/chat/completions"

class Server:
    def __init__(self):
        self.request_count = 0
        print("✓ WebSocket proxy ready — forwarding to llama-server on port 8766")

    def call_llama(self, messages, max_tokens=500, temperature=0.7):
        payload = json.dumps({
            "messages": messages,
            "max_tokens": max_tokens,
            "temperature": temperature,
            "stream": False,
            "chat_template_kwargs": {"enable_thinking": False}
        }).encode("utf-8")
        req = urllib.request.Request(
            LLAMA_SERVER_URL,
            data=payload,
            headers={"Content-Type": "application/json"}
        )
        with urllib.request.urlopen(req, timeout=120) as resp:
            data = json.loads(resp.read().decode("utf-8"))
        msg = data["choices"][0]["message"]
        # Qwen3.5 thinking mode puts output in reasoning_content when content is empty
        content = msg.get("content") or msg.get("reasoning_content") or ""
        return content

    async def handle(self, websocket):
        print("✓ Client connected")
        try:
            async for message in websocket:
                data = json.loads(message)
                msg_type = data.get("type")

                if msg_type == "register":
                    print(f"✓ App registered: {data.get('app_id')}")
                    await websocket.send(json.dumps({
                        "type": "registered",
                        "status": "success"
                    }))

                elif msg_type == "inference":
                    prompt = data.get("prompt", "")
                    print(f"Inference: {prompt[:50]}...")
                    response = self.call_llama(
                        [{"role": "user", "content": prompt}],
                        max_tokens=data.get("max_tokens", 500),
                        temperature=data.get("temperature", 0.7)
                    )
                    await websocket.send(json.dumps({
                        "type": "inference_result",
                        "result": response,
                        "status": "success"
                    }))

                elif msg_type == "chat":
                    msg = data.get("message", "")
                    request_id = data.get("request_id", "")
                    temperature = data.get("temperature", 0.7)
                    max_tokens = data.get("max_tokens", 500)
                    self.request_count += 1
                    print(f"Chat [{request_id}] (#{self.request_count}): {msg[:50]}...")
                    response = self.call_llama(
                        [{"role": "user", "content": msg}],
                        max_tokens=max_tokens,
                        temperature=temperature
                    )
                    await websocket.send(json.dumps({
                        "type": "chat_response",
                        "request_id": request_id,
                        "content": response,
                        "status": "success"
                    }))

                elif msg_type == "ping":
                    await websocket.send(json.dumps({"type": "pong"}))

        except Exception as e:
            print(f"Error: {e}")

async def main():
    server = Server()
    print(f"\n🚕 WebSocket Server on ws://localhost:8765\n")
    async with websockets.serve(server.handle, "localhost", 8765):
        await asyncio.Future()

if __name__ == "__main__":
    asyncio.run(main())
