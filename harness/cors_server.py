"""Static file server with CORS headers, for injecting the built card
into demo.home-assistant.io during development."""

import functools
from http.server import HTTPServer, SimpleHTTPRequestHandler
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


class CORSHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


if __name__ == "__main__":
    handler = functools.partial(CORSHandler, directory=str(ROOT))
    print(f"serving {ROOT} on http://127.0.0.1:8643 with CORS")
    HTTPServer(("127.0.0.1", 8643), handler).serve_forever()
