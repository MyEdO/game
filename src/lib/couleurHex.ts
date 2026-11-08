/** Parse `#rgb`/`#rrggbb` en canaux [r,g,b] (0–255) ; null si non-hex (`var(--x)`, `rgb(...)`).
 *  Parseur UNIQUE des couleurs hexadécimales : ombrage du rendu web (`lib/ombrage.ts`), teintes POV, volume du monde
 *  des hôtes (`noyau/monde/volume`). */
export function parseHex(hex: string): [number, number, number] | null {
  const m = hex.trim().match(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/);
  if (!m) return null;
  const h = m[1].length === 3 ? m[1].replace(/(.)/g, '$1$1') : m[1];
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}
