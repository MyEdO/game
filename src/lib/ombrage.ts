/**
 * Ombrage PUR — avec la donnée JSON (matériaux), la SEULE source de couleur d'un renderer d'environnement.
 * Un renderer ne porte donc aucun littéral de couleur : l'identité d'un matériau vient du JSON, la LUMIÈRE
 * (ombre d'orientation, occlusion, spéculaire) vient d'ici. Dérive un ton en multipliant la luminance d'une
 * base par un facteur, clampé ; un `var(--x)` CSS (pierre) passe tel quel. Aucune lecture DOM.
 */
import { parseHex } from './couleurHex';

const clamp255 = (n: number) => Math.max(0, Math.min(255, Math.round(n)));
/** Canaux [r,g,b] (0–255, arrondis et bornés) en `#rrggbb`. Émetteur UNIQUE, pendant de `parseHex`. */
export const toHex = (r: number, g: number, b: number) =>
  `#${[r, g, b].map((c) => clamp255(c).toString(16).padStart(2, '0')).join('')}`;

/** Base × facteur de luminance (clampé). Un non-hex (`var(--x)`) est renvoyé tel quel. */
export function shade(color: string, k: number): string {
  const c = parseHex(color);
  return c ? toHex(c[0] * k, c[1] * k, c[2] * k) : color;
}

/** Interpolation linéaire (`t` 0→a, 1→b). Non-hex : renvoie `a`. */
export function mix(a: string, b: string, t: number): string {
  const ca = parseHex(a);
  const cb = parseHex(b);
  return ca && cb ? toHex(ca[0] + (cb[0] - ca[0]) * t, ca[1] + (cb[1] - ca[1]) * t, ca[2] + (cb[2] - ca[2]) * t) : a;
}

// Facteurs de LUMIÈRE (source en haut-gauche) — pas des identités de matériau (celles-ci sont en JSON).
/** Face N (bas-droite, ombre) : ×0.86, calibré sur la palette bois iso (unifie 0.845→0.883 hand-tunés). */
export const SIDE_N = 0.86;
export const SIDE_LIT = 1;
export const POST_CAP = 1.71;
export const POST_BASE = 0.68;
