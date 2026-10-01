#!/usr/bin/env python3
"""
Exports the design kit's UI sprites that Unity's Resources were missing.

Most kit UI art sets its text in the Silkscreen font on a canvas, so it can only be drawn in a
browser. This serves Tools/ArtSource and saves what Tools/ArtSource/export-kit-ui.html renders:

    python3 Tools/export-kit-ui.py          then open the printed URL in a browser

PNGs are written to Assets/Afterlife/Resources/<folder>/<name>.png. Afterwards run
`node Tools/export-web-assets.mjs` to copy them into the web build.
"""

import http.server
import json
import os
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SERVE = ROOT / "Tools" / "ArtSource"
RESOURCES = ROOT / "Assets" / "Afterlife" / "Resources"
PORT = int(os.environ.get("PORT", 8123))
NAME = re.compile(r"^[a-z0-9_]{1,64}$")
FOLDERS = {"UI", "FX"}


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(SERVE), **kwargs)

    def do_GET(self):
        # /shipped/<name>.png is the PNG already in Resources/UI, for pixel verification.
        if self.path.startswith("/shipped/"):
            name = self.path[len("/shipped/"):].removesuffix(".png")
            target = RESOURCES / "UI" / f"{name}.png"
            if not NAME.match(name) or not target.exists():
                self.send_error(404)
                return
            data = target.read_bytes()
            self.send_response(200)
            self.send_header("Content-Type", "image/png")
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)
            return
        super().do_GET()

    def do_POST(self):
        query = dict(p.split("=", 1) for p in self.path.partition("?")[2].split("&") if "=" in p)
        folder, name = query.get("folder", "UI"), query.get("name", "")
        if not self.path.startswith("/save?") or folder not in FOLDERS or not NAME.match(name):
            self.send_error(400, "Expected /save?folder=UI|FX&name=[a-z0-9_]+")
            return
        data = self.rfile.read(int(self.headers.get("Content-Length", 0)))
        if not data.startswith(b"\x89PNG"):
            self.send_error(400, "Body must be a PNG")
            return
        target = RESOURCES / folder / f"{name}.png"
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(data)
        body = json.dumps({"saved": str(target.relative_to(ROOT))}).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


if __name__ == "__main__":
    print(f"Open http://127.0.0.1:{PORT}/export-kit-ui.html to export the kit UI sprites. Ctrl+C to stop.")
    http.server.ThreadingHTTPServer(("127.0.0.1", PORT), Handler).serve_forever()
