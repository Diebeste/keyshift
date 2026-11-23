#!/usr/bin/env python3
"""Serve the Pages build (dist/) under the /keyshift/ prefix, like https://diebeste.github.io/keyshift/.
Usage: python3 scripts/serve-pages.py [port] [--https cert.pem key.pem]"""
import http.server, socketserver, os, sys, ssl, functools
args = sys.argv[1:]
PORT = int(args[0]) if args and args[0].isdigit() else 8443
DIST = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'dist')
PREFIX = '/keyshift'

class H(http.server.SimpleHTTPRequestHandler):
    extensions_map = {**http.server.SimpleHTTPRequestHandler.extensions_map,
                      '.wasm': 'application/wasm', '.js': 'text/javascript', '.webmanifest': 'application/manifest+json'}
    def translate_path(self, path):
        p = path.split('?', 1)[0]
        if p == PREFIX:
            return '/nonexistent'
        if not p.startswith(PREFIX + '/'):
            return '/nonexistent'  # 404 outside the prefix, like a project Pages site
        return super().translate_path(p[len(PREFIX):] or '/')
    def do_GET(self):
        if self.path.split('?')[0] == PREFIX:  # GitHub Pages redirects /keyshift → /keyshift/
            self.send_response(301); self.send_header('Location', PREFIX + '/'); self.end_headers(); return
        super().do_GET()
    def log_message(self, *a): pass

class S(socketserver.ThreadingMixIn, http.server.HTTPServer):
    daemon_threads = True
    allow_reuse_address = True

httpd = S(('127.0.0.1', PORT), functools.partial(H, directory=os.path.abspath(DIST)))
if '--https' in args:
    i = args.index('--https')
    ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
    ctx.load_cert_chain(args[i + 1], args[i + 2])
    httpd.socket = ctx.wrap_socket(httpd.socket, server_side=True)
print(f"Serving dist/ at {'https' if '--https' in args else 'http'}://localhost:{PORT}{PREFIX}/", flush=True)
httpd.serve_forever()
