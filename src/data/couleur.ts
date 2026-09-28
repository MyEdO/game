/**
 * COULEUR `#rrggbb` — PURE : parse, émission, mélange, et la MÉTRIQUE perceptuelle avec son plancher de
 * teintes contiguës. Module FEUILLE (aucun import), donc lisible par le schéma de donnée
 * (`schemas/defs/teintesJeu.ts`) comme par l'ombrage du rendu (`gameIso/shade.ts`).
 */

/** Parse `#rgb`/`#rrggbb` en canaux [r,g,b] (0–255) ; null si non-hex (`var(--x)`, `rgb(...)`). */
export function parseHex(hex: string): [number, number, number] | null {
  const m = hex.trim().match(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/);
  if (!m) return null;
  const h = m[1].length === 3 ? m[1].replace(/(.)/g, '$1$1') : m[1];
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}
const clamp255 = (n: number) => Math.max(0, Math.min(255, Math.round(n)));
/** Canaux [r,g,b] (0–255, arrondis et bornés) en `#rrggbb`. Émetteur UNIQUE, pendant de `parseHex`. */
export const toHex = (r: number, g: number, b: number) =>
  `#${[r, g, b].map((c) => clamp255(c).toString(16).padStart(2, '0')).join('')}`;

/** Interpolation linéaire (`t` 0→a, 1→b). Non-hex : renvoie `a`. */
export function mix(a: string, b: string, t: number): string {
  const ca = parseHex(a);
  const cb = parseHex(b);
  return ca && cb ? toHex(ca[0] + (cb[0] - ca[0]) * t, ca[1] + (cb[1] - ca[1]) * t, ca[2] + (cb[2] - ca[2]) * t) : a;
}

/** Distance PERCEPTUELLE bon marché entre deux couleurs hexadécimales (pondération RVB classique 2/4/3 :
 *  l'œil discrimine le vert le plus finement, le rouge le moins). L'échelle va de 0 à 765 (noir ⇄ blanc).
 *  Une norme : l'inégalité triangulaire tient. Un non-hex lève. */
export function distanceTeinte(a: string, b: string): number {
  const ca = parseHex(a);
  const cb = parseHex(b);
  if (!ca || !cb) throw new Error(`distanceTeinte : « ${ca ? b : a} » n’est pas une couleur hexadécimale.`);
  const [r1, g1, b1] = ca;
  const [r2, g2, b2] = cb;
  return Math.sqrt(2 * (r1 - r2) ** 2 + 4 * (g1 - g2) ** 2 + 3 * (b1 - b2) ** 2);
}

/** Plancher de distance perceptuelle (`distanceTeinte`) entre deux teintes CONTIGUËS — qui se touchent
 *  à l'écran et doivent s'y distinguer. Étalon : `SEUIL_IDENTITE_HEROS` (`schemas/defs/teintesJeu.ts`). */
export const SEUIL_TEINTES_CONTIGUES = 90;
