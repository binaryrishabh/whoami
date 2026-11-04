// A tiny static server for the toy studio: /three/* comes from the project's node_modules.
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
const THREE = path.resolve(here, '../../node_modules/three');
const types = { '.js': 'text/javascript', '.html': 'text/html', '.mjs': 'text/javascript' };
http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split('?')[0]);
  const f = u.startsWith('/three/') ? path.join(THREE, u.slice(7)) : path.join(here, u === '/' ? 'studio.html' : u);
  fs.readFile(f, (e, d) => { if (e) { res.writeHead(404); res.end(); return; } res.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' }); res.end(d); });
}).listen(5599, () => console.log('toy studio on http://localhost:5599'));
