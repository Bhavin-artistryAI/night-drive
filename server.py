import json
import mimetypes
import os
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib import request, parse
from pathlib import Path

HOST = "127.0.0.1"
PORT = int(os.environ.get("PORT", "8000"))
MESH_API_KEY = os.environ.get("MESH_API_KEY", "rsk_01KX02VF3BV88S6QH6W6HWRZ3F")
ROOT = Path(__file__).resolve().parent


class Handler(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        self.send_cors_headers()
        self.send_response(204)
        self.end_headers()

    def do_GET(self):
        if self.path.startswith("/api/"):
            self.send_json(404, {"error": "Not found"})
            return
        self.serve_static()

    def do_POST(self):
        if self.path == "/api/coach":
            self.handle_coach()
            return
        self.send_json(404, {"error": "Not found"})

    def handle_coach(self):
        length = int(self.headers.get("Content-Length", "0"))
        body = self.rfile.read(length).decode("utf-8") if length else "{}"
        try:
            payload = json.loads(body or "{}")
        except json.JSONDecodeError:
            self.send_json(400, {"error": "Invalid JSON"})
            return

        mesh_payload = {
            "model": payload.get("model", "ai21/jamba-1-5-large-v1"),
            "messages": payload.get("messages", []),
            "max_tokens": payload.get("max_tokens", 60),
        }

        req = request.Request(
            "https://api.meshapi.ai/v1/chat/completions",
            data=json.dumps(mesh_payload).encode("utf-8"),
            headers={
                "Authorization": f"Bearer {MESH_API_KEY}",
                "Content-Type": "application/json",
            },
            method="POST",
        )

        try:
            with request.urlopen(req, timeout=20) as resp:
                response_data = json.loads(resp.read().decode("utf-8"))
            self.send_json(resp.status, response_data)
        except Exception as exc:
            self.send_json(502, {"error": str(exc)})

    def serve_static(self):
        path = self.path.split("?", 1)[0]
        if path in ["", "/"]:
            path = "/index.html"
        file_path = (ROOT / path.lstrip("/")).resolve()
        if not str(file_path).startswith(str(ROOT)):
            self.send_json(403, {"error": "Forbidden"})
            return
        if not file_path.exists() or not file_path.is_file():
            self.send_json(404, {"error": "Not found"})
            return

        content_type, _ = mimetypes.guess_type(str(file_path))
        if not content_type:
            content_type = "application/octet-stream"
        try:
            data = file_path.read_bytes()
            self.send_response(200)
            self.send_header("Content-Type", content_type)
            self.send_cors_headers()
            self.end_headers()
            self.wfile.write(data)
        except Exception as exc:
            self.send_json(500, {"error": str(exc)})

    def send_json(self, status, data):
        body = json.dumps(data).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_cors_headers()
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def send_cors_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")


if __name__ == "__main__":
    server = ThreadingHTTPServer((HOST, PORT), Handler)
    print(f"Server running at http://{HOST}:{PORT}")
    server.serve_forever()
