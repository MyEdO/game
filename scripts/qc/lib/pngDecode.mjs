/**
 * DÉCODEUR PNG PARTAGÉ des harnais QC (#1263) — SOURCE UNIQUE. PNG 8 bits non entrelacé, couleur
 * RGBA (type 6) ou RGB (type 2), rendu TOUJOURS en RGBA (un canal alpha plein est ajouté pour un
 * RGB) : les rendus `resvg` et les captures `toDataURL` d'un canevas sont en RGBA, celles de
 * `Page.captureScreenshot` (CDP) en RGB, et les deux se mesurent au même endroit.
 *
 * Format `.mjs` (+ sidecar `pngDecode.d.mts`) : importable par un module node NU
 * (`scripts/recette/*.mjs`) COMME par un CLI `tsx`.
 */
import { inflateSync } from 'node:zlib';

export function decodePng(buf) {
  let off = 8, w = 0, h = 0, canaux = 4;
  const idat = [];
  while (off < buf.length) {
    const len = buf.readUInt32BE(off);
    const type = buf.toString('ascii', off + 4, off + 8);
    const data = buf.subarray(off + 8, off + 8 + len);
    if (type === 'IHDR') {
      w = data.readUInt32BE(0); h = data.readUInt32BE(4);
      if (data[8] !== 8 || (data[9] !== 6 && data[9] !== 2)) throw new Error(`attendu RGB/RGBA 8-bit, reçu depth=${data[8]} color=${data[9]}`);
      canaux = data[9] === 6 ? 4 : 3;
    } else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
    off += 12 + len;
  }
  const raw = inflateSync(Buffer.concat(idat));
  const stride = w * canaux;
  const out = Buffer.alloc(w * h * 4, 0xff);
  let prev = Buffer.alloc(stride);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)];
    const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    const cur = Buffer.alloc(stride);
    for (let x = 0; x < stride; x++) {
      const a = x >= canaux ? cur[x - canaux] : 0, b = prev[x], c = x >= canaux ? prev[x - canaux] : 0;
      let v = line[x];
      if (f === 1) v += a; else if (f === 2) v += b; else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) { const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
      cur[x] = v & 0xff;
    }
    if (canaux === 4) cur.copy(out, y * w * 4);
    else for (let x = 0; x < w; x++) cur.copy(out, (y * w + x) * 4, x * 3, x * 3 + 3);
    prev = cur;
  }
  return { w, h, data: out };
}
