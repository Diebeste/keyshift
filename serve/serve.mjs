// Key Shift local server (Node 16+): node serve.mjs [port]. Serves this folder on localhost only.
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { exec } from 'node:child_process';
const root = dirname(fileURLToPath(import.meta.url));
const port = Number(process.argv[2] || 8765);
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.wasm': 'application/wasm',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json', '.webmanifest': 'application/manifest+json' };
http.createServer(async (req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p.endsWith('/')) p += 'index.html';
  const file = normalize(join(root, p));
  if (!file.startsWith(root)) { res.writeHead(403); return res.end(); }
  try {
    const body = await readFile(file);
    res.writeHead(200, { 'Content-Type': types[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(body);
  } catch { res.writeHead(404); res.end('Not found'); }
}).listen(port, '127.0.0.1', () => {
  const url = `http://localhost:${port}/`;
  console.log(`Key Shift running at ${url}  (Ctrl+C to stop)`);
  const open = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start ""' : 'xdg-open';
  exec(`${open} ${url}`, () => {});
});
