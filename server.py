#!/usr/bin/env python3
"""
Afterlife Game Server
Serves the React web app and persists the local save, mirroring the Unity SaveStore:
atomic replacement of save.json with the previous save kept as save.json.bak, and rejected saves
preserved as save.json.rejected-<timestamp>. Zero external dependencies - runs on Python 3.8+.
"""

import http.server
import json
import os
import shutil
import subprocess
import sys
import threading
import urllib.parse
from datetime import datetime, timezone
from pathlib import Path

PORT = int(os.environ.get("PORT", 8087))
ROOT_DIR = Path(__file__).resolve().parent
SAVE_FILE = ROOT_DIR / "save.json"
BACKUP_SAVE_FILE = ROOT_DIR / "save.json.bak"
MAX_SAVE_BYTES = 32 * 1024 * 1024

# Safely initialize content manager backend (supports running isolated in tests)
try:
    from backend.api_handler import ContentApiHandler
    content_handler = ContentApiHandler()
except Exception:
    try:
        if str(ROOT_DIR) not in sys.path:
            sys.path.insert(0, str(ROOT_DIR))
        from backend.api_handler import ContentApiHandler
        content_handler = ContentApiHandler()
    except Exception:
        content_handler = None

# Determine static serving directory (check dist, web/dist, then the preserved browser build)
if (ROOT_DIR / "dist" / "index.html").exists():
    STATIC_DIR = ROOT_DIR / "dist"
elif (ROOT_DIR / "web" / "dist" / "index.html").exists():
    STATIC_DIR = ROOT_DIR / "web" / "dist"
else:
    STATIC_DIR = ROOT_DIR / "Legacy" / "Browser"


def read_text(path):
    return path.read_text(encoding="utf-8") if path.exists() else None


def write_save(text):
    """Atomically replace save.json, keeping the previous save as the backup."""
    temp_file = ROOT_DIR / f"save.json.tmp.{os.getpid()}"
    temp_file.write_text(text, encoding="utf-8")
    if SAVE_FILE.exists():
        shutil.copy2(SAVE_FILE, BACKUP_SAVE_FILE)
    os.replace(temp_file, SAVE_FILE)


def open_folder(path):
    if sys.platform == "darwin":
        subprocess.Popen(["open", str(path)])
    elif os.name == "nt":
        os.startfile(str(path))  # noqa: S606 - local desktop convenience
    else:
        subprocess.Popen(["xdg-open", str(path)])


class AfterlifeHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(STATIC_DIR), **kwargs)

    def end_headers(self):
        # Allow the Vite dev server (another localhost port) to use the API.
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        if not self.path.startswith("/api/"):
            self.send_header("Cache-Control", "no-cache")
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(204)
        self.end_headers()

    def do_GET(self):
        path = urllib.parse.urlparse(self.path).path

        if path.startswith("/api/content/"):
            if content_handler is None:
                self.send_json({"error": "Content backend not available in isolated environment"}, status=503)
                return
            status, data = content_handler.handle("GET", self.path, b"")
            self.send_json(data, status=status)
            return

        if path == "/dashboard":
            self.send_response(301)
            self.send_header("Location", "/dashboard/")
            self.end_headers()
            return

        if path.startswith("/dashboard/"):
            sub = urllib.parse.unquote(path[len("/dashboard/"):].strip("/")) or "index.html"
            # The studio shows the game's sprites; they live in web/public/unity.
            if sub.startswith("art/"):
                base, sub = ROOT_DIR / "web" / "public" / "unity", sub[len("art/"):]
            else:
                base = ROOT_DIR / "backend" / "dashboard"
            dash_path = (base / sub).resolve()
            if os.path.commonpath([str(dash_path), str(base.resolve())]) != str(base.resolve()):
                self.send_error(404, "Not found")
                return
            if not dash_path.is_file():
                if base.name == "unity":
                    self.send_error(404, "Not found")
                    return
                dash_path = ROOT_DIR / "backend" / "dashboard" / "index.html"
            if dash_path.exists():
                content = dash_path.read_bytes()
                self.send_response(200)
                self.send_header("Content-Type", self.guess_type(str(dash_path)))
                self.send_header("Content-Length", str(len(content)))
                self.end_headers()
                self.wfile.write(content)
                return
            self.send_error(404, "Dashboard files not found")
            return

        if path == "/api/health":
            self.send_json({"status": "ok", "game": "Afterlife", "static_dir": str(STATIC_DIR)})
            return

        if path == "/api/save":
            try:
                self.send_json({
                    "save": read_text(SAVE_FILE),
                    "backup": read_text(BACKUP_SAVE_FILE),
                    "path": str(SAVE_FILE),
                })
            except OSError as e:
                self.send_json({"error": str(e)}, status=500)
            return

        # Single page app fallback: unknown non-API paths serve index.html
        requested_file = STATIC_DIR / path.lstrip("/")
        if not requested_file.exists() and not path.startswith("/api/") and (STATIC_DIR / "index.html").exists():
            self.path = "/index.html"
        return super().do_GET()

    def do_POST(self):
        path = urllib.parse.urlparse(self.path).path

        if path.startswith("/api/content/"):
            if content_handler is None:
                self.send_json({"error": "Content backend not available in isolated environment"}, status=503)
                return
            length = int(self.headers.get("Content-Length", 0))
            body_bytes = self.rfile.read(length) if length > 0 else b""
            status, data = content_handler.handle("POST", self.path, body_bytes)
            self.send_json(data, status=status)
            return

        if path == "/api/save":
            length = int(self.headers.get("Content-Length", 0))
            if length <= 0 or length > MAX_SAVE_BYTES:
                self.send_json({"error": "Save body is empty or too large."}, status=400)
                return
            text = self.rfile.read(length).decode("utf-8")
            try:
                json.loads(text)
            except ValueError as e:
                self.send_json({"error": "Save is not valid JSON: " + str(e)}, status=400)
                return
            try:
                write_save(text)
            except OSError as e:
                self.send_json({"error": str(e)}, status=500)
                return
            self.send_json({"status": "saved", "size": SAVE_FILE.stat().st_size})
            return

        if path == "/api/save/reject":
            if SAVE_FILE.exists():
                stamp = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")
                shutil.copy2(SAVE_FILE, ROOT_DIR / f"save.json.rejected-{stamp}")
            self.send_json({"status": "preserved"})
            return

        if path == "/api/open-save-folder":
            try:
                open_folder(ROOT_DIR)
                self.send_json({"status": "opened", "path": str(ROOT_DIR)})
            except OSError as e:
                self.send_json({"error": str(e)}, status=500)
            return

        if path == "/api/shutdown":
            self.send_json({"status": "stopping"})
            threading.Thread(target=self.server.shutdown, daemon=True).start()
            return

        self.send_error(404, "Endpoint not found")

    def do_PUT(self):
        path = urllib.parse.urlparse(self.path).path
        if path.startswith("/api/content/"):
            if content_handler is None:
                self.send_json({"error": "Content backend not available in isolated environment"}, status=503)
                return
            length = int(self.headers.get("Content-Length", 0))
            body_bytes = self.rfile.read(length) if length > 0 else b""
            status, data = content_handler.handle("PUT", self.path, body_bytes)
            self.send_json(data, status=status)
            return
        self.send_error(404, "Endpoint not found")

    def do_DELETE(self):
        path = urllib.parse.urlparse(self.path).path
        if path.startswith("/api/content/"):
            if content_handler is None:
                self.send_json({"error": "Content backend not available in isolated environment"}, status=503)
                return
            length = int(self.headers.get("Content-Length", 0))
            body_bytes = self.rfile.read(length) if length > 0 else b""
            status, data = content_handler.handle("DELETE", self.path, body_bytes)
            self.send_json(data, status=status)
            return
        self.send_error(404, "Endpoint not found")

    def send_json(self, data, status=200):
        body = json.dumps(data).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def guess_type(self, path):
        # Ensure JavaScript modules have application/javascript MIME type
        if path.endswith(".mjs") or path.endswith(".js"):
            return "application/javascript"
        return super().guess_type(path)

    def do_HEAD(self):
        self.do_GET()

    def log_message(self, format, *args):
        # Autosaves every five seconds would otherwise flood the terminal.
        first_arg = str(args[0]) if args else ""
        if "/api/save" not in first_arg:
            super().log_message(format, *args)


def run():
    print("=== Afterlife Game Server ===")
    print(f"Serving static assets from: {STATIC_DIR}")
    print(f"Saves: {SAVE_FILE}")
    print(f"Game URL: http://127.0.0.1:{PORT}/")
    print("Press Ctrl+C to stop.")

    http.server.ThreadingHTTPServer.allow_reuse_address = True
    try:
        httpd = http.server.ThreadingHTTPServer(("127.0.0.1", PORT), AfterlifeHandler)
    except OSError as e:
        if e.errno == 48:
            print(f"Port {PORT} is already in use by an active Afterlife server. Opening http://127.0.0.1:{PORT}/")
            open_folder(f"http://127.0.0.1:{PORT}/")
            sys.exit(0)
        raise
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping server.")
    finally:
        httpd.server_close()


if __name__ == "__main__":
    run()
