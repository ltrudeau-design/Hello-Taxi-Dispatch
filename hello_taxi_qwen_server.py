#!/usr/bin/env python3
"""
Hello Taxi Custom Server — Qwen 2.5 Omni 7B
Optimized for Hello Taxi AI agent workflows
"""

import asyncio
import json
import sys
from pathlib import Path

try:
    from llama_cpp import Llama
    from llama_cpp.llama_chat_format import Jinja2ChatFormatter
except ImportError:
    print("ERROR: llama-cpp-python not installed")
    print("Install with: pip install llama-cpp-python")
    sys.exit(1)

# Configuration
MODEL_PATH = Path.home() / ".cluster/models/Qwen2.5-7B-Instruct-Q4_K_M.gguf"
HOST = "127.0.0.1"
PORT = 8765
CONTEXT_SIZE = 8192
GPU_LAYERS = 99  # Use all layers on GPU (Metal for Mac)

# Qwen chat template
QWEN_CHAT_TEMPLATE = """{% for message in messages %}{% if loop.first and messages[0]['role'] != 'system' %}{{ '<|im_start|>system
You are a helpful AI assistant.<|im_end|>
' }}{% endif %}{{'<|im_start|>' + message['role'] + '
' + message['content'] + '<|im_end|>' + '
'}}{% endfor %}{% if add_generation_prompt %}{{ '<|im_start|>assistant
' }}{% endif %}"""


class QwenServer:
    def __init__(self):
        self.model = None
        
    def load_model(self):
        """Load Qwen model with llama.cpp."""
        print(f"Loading model: {MODEL_PATH}")
        
        if not MODEL_PATH.exists():
            print(f"ERROR: Model not found at {MODEL_PATH}")
            sys.exit(1)
        
        self.model = Llama(
            model_path=str(MODEL_PATH),
            n_ctx=CONTEXT_SIZE,
            n_gpu_layers=GPU_LAYERS,
            chat_format="chatml",  # Qwen uses ChatML format
            verbose=False
        )
        
        print(f"✓ Model loaded")
        print(f"  Context: {CONTEXT_SIZE}")
        print(f"  GPU layers: {GPU_LAYERS}")
    
    def generate(self, prompt: str, max_tokens: int = 2048, temperature: float = 0.7) -> str:
        """Generate response from prompt."""
        
        messages = [
            {"role": "system", "content": "You are a helpful AI assistant optimized for code generation and analysis."},
            {"role": "user", "content": prompt}
        ]
        
        response = self.model.create_chat_completion(
            messages=messages,
            max_tokens=max_tokens,
            temperature=temperature,
            top_p=0.95,
            stream=False
        )
        
        return response['choices'][0]['message']['content']
    
    async def handle_request(self, reader, writer):
        """Handle incoming HTTP requests."""
        
        # Read request
        request_line = await reader.readline()
        request = request_line.decode().strip()
        
        # Read headers
        headers = {}
        while True:
            line = await reader.readline()
            if line == b'\r\n' or line == b'\n':
                break
            if b':' in line:
                key, value = line.decode().strip().split(':', 1)
                headers[key.strip().lower()] = value.strip()
        
        # Read body if present
        body = b''
        if 'content-length' in headers:
            content_length = int(headers['content-length'])
            body = await reader.read(content_length)
        
        # Parse request
        method, path, _ = request.split() if ' ' in request else ('', '', '')
        
        # Handle routes
        if path == '/health':
            response = json.dumps({"status": "ok", "model": "Qwen2.5-Omni-7B"})
            await self.send_response(writer, 200, response)
        
        elif path == '/generate' and method == 'POST':
            try:
                data = json.loads(body.decode())
                prompt = data.get('prompt', '')
                max_tokens = data.get('max_tokens', 2048)
                temperature = data.get('temperature', 0.7)
                
                print(f"\n[REQUEST] {len(prompt)} chars, max_tokens={max_tokens}, temp={temperature}")
                
                # Generate
                result = self.generate(prompt, max_tokens, temperature)
                
                print(f"[RESPONSE] {len(result)} chars")
                
                response = json.dumps({"response": result})
                await self.send_response(writer, 200, response)
                
            except Exception as e:
                print(f"ERROR: {e}")
                response = json.dumps({"error": str(e)})
                await self.send_response(writer, 500, response)
        
        elif path == '/v1/chat/completions' and method == 'POST':
            # OpenAI-compatible endpoint
            try:
                data = json.loads(body.decode())
                messages = data.get('messages', [])
                max_tokens = data.get('max_tokens', 2048)
                temperature = data.get('temperature', 0.7)
                
                print(f"\n[CHAT] {len(messages)} messages, max_tokens={max_tokens}")
                
                response = self.model.create_chat_completion(
                    messages=messages,
                    max_tokens=max_tokens,
                    temperature=temperature,
                    top_p=0.95
                )
                
                print(f"[RESPONSE] {len(response['choices'][0]['message']['content'])} chars")
                
                await self.send_response(writer, 200, json.dumps(response))
                
            except Exception as e:
                print(f"ERROR: {e}")
                response = json.dumps({"error": str(e)})
                await self.send_response(writer, 500, response)
        
        else:
            response = json.dumps({"error": "Not found"})
            await self.send_response(writer, 404, response)
    
    async def send_response(self, writer, status: int, body: str):
        """Send HTTP response."""
        status_text = {200: "OK", 404: "Not Found", 500: "Internal Server Error"}
        
        response = f"HTTP/1.1 {status} {status_text.get(status, 'Unknown')}\r\n"
        response += "Content-Type: application/json\r\n"
        response += f"Content-Length: {len(body)}\r\n"
        response += "Access-Control-Allow-Origin: *\r\n"
        response += "\r\n"
        response += body
        
        writer.write(response.encode())
        await writer.drain()
        writer.close()
        await writer.wait_closed()
    
    async def start(self):
        """Start the server."""
        server = await asyncio.start_server(
            self.handle_request,
            HOST,
            PORT
        )
        
        addr = server.sockets[0].getsockname()
        print(f"\n{'='*60}")
        print(f"HELLO TAXI — QWEN 2.5 OMNI 7B SERVER")
        print(f"{'='*60}")
        print(f"Model:   Qwen2.5-Omni-7B-Q4_K_M")
        print(f"Address: http://{addr[0]}:{addr[1]}")
        print(f"Endpoints:")
        print(f"  GET  /health                  - Health check")
        print(f"  POST /generate                - Simple generation")
        print(f"  POST /v1/chat/completions     - OpenAI-compatible")
        print(f"{'='*60}\n")
        
        async with server:
            await server.serve_forever()


def main():
    """Main entry point."""
    
    server = QwenServer()
    
    print("Initializing Hello Taxi Qwen Server...")
    server.load_model()
    
    try:
        asyncio.run(server.start())
    except KeyboardInterrupt:
        print("\n\nShutting down...")
    except Exception as e:
        print(f"ERROR: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
