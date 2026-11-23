#!/usr/bin/env python3
"""Key Shift local server: serves this folder on http://localhost:8765 (local only)."""
import http.server, socketserver, os, sys, webbrowser, functools
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8765
ROOT = os.path.dirname(os.path.abspath(__file__))
class H(http.server.SimpleHTTPRequestHandler):
    extensions_map = {**http.server.SimpleHTTPRequestHandler.extensions_map, '.wasm': 'application/wasm', '.js': 'text/javascript', '.webmanifest': 'application/manifest+json'}
    def end_headers(self):
        self.send_header('Cache-Control', 'no-cache')
        super().end_headers()
Handler = functools.partial(H, directory=ROOT)
class Server(socketserver.ThreadingMixIn, http.server.HTTPServer):
    daemon_threads = True
with Server(('127.0.0.1', PORT), Handler) as httpd:
    url = f'http://localhost:{PORT}/'
    print(f'Key Shift running at {url}  (Ctrl+C to stop)')
    try: webbrowser.open(url)
    except Exception: pass
    httpd.serve_forever()
