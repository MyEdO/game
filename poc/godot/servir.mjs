#!/usr/bin/env node
// Serveur statique de l'export web du prototype #2793 (mono-thread : ni COOP ni COEP).
// Usage : node poc/godot/servir.mjs [dossier] [--port <n>]   (défaut : poc/godot/build/web/, port 8060)
import { createReadStream, statSync } from 'node:fs';
import { createServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ICI = path.dirname(fileURLToPath(import.meta.url));
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.wasm': 'application/wasm',
  '.pck': 'application/octet-stream',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

function lireOptions(argv) {
  let dossier = path.join(ICI, 'build', 'web');
  let port = 8060;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--port') {
      port = Number(argv[++i]);
      if (!Number.isInteger(port) || port <= 0 || port > 65535) throw new Error('--port attend un entier entre 1 et 65535');
    } else dossier = path.resolve(argv[i]);
  }
  return { dossier, port };
}

const { dossier, port } = lireOptions(process.argv.slice(2));

createServer((req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost');
  const relatif = decodeURIComponent(url.pathname).replace(/^\/+/, '') || 'index.html';
  const chemin = path.resolve(dossier, relatif);
  if (chemin !== dossier && !chemin.startsWith(dossier + path.sep)) {
    res.writeHead(403).end();
    return;
  }
  let st;
  try {
    st = statSync(chemin);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end(`introuvable : ${relatif}`);
    return;
  }
  if (!st.isFile()) {
    res.writeHead(404).end();
    return;
  }
  res.writeHead(200, {
    'Content-Type': TYPES[path.extname(chemin).toLowerCase()] ?? 'application/octet-stream',
    'Content-Length': st.size,
    'Cache-Control': 'no-cache',
  });
  createReadStream(chemin).pipe(res);
}).listen(port, () => {
  console.log(`[servir] ${dossier} sur http://localhost:${port}/`);
});
