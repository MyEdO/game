/**
 * Ombrage PUR — avec la donnée JSON (matériaux), la SEULE source de couleur d'un renderer d'environnement.
 * Un renderer ne porte donc aucun littéral de couleur : l'identité d'un matériau vient du JSON, la LUMIÈRE
 * (ombre d'orientation, occlusion, spéculaire) vient d'ici. Dérive un ton en multipliant la luminance d'une
 * base par un facteur, clampé ; un `var(--x)` CSS (pierre) passe tel quel. Aucune lecture DOM.
 */

/** Parse `#rgb`/`#rrggbb` en canaux [r,g,b] (0–255) ; null si non-hex (`var(--x)`, `rgb(...)`).
 *  Parseur UNIQUE partagé par `shade`/`mix` ici ET par les helpers de teinte POV (camera.ts). */
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

/** Un octet sRGB (0–255) en valeur LINÉAIRE — la transfert standard, celle que three applique aux
 *  couleurs de sommet et à la sortie du rendu. */
export const srgbToLinear = (octet: number): number => {
  const u = octet / 255;
  return u <= 0.04045 ? u / 12.92 : ((u + 0.055) / 1.055) ** 2.4;
};

/** Hex → vecteur `ab` d'Oklab (Björn Ottosson, 2020) ; un non-hex vaut le noir. */
export function abOklab(hex: string): [number, number] {
  const [r, g, b] = (parseHex(hex) ?? [0, 0, 0]).map(srgbToLinear);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s];
}

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

/** Pondération de LUMINANCE PERÇUE (Rec. 709) — source unique des deux lecteurs : la luminance d'une
 *  couleur hexa ci-dessous, et celle d'une couleur `three` déjà parsée (`luminance709`,
 *  `stage/boardPose.ts`). Deux jeux de poids en feraient deux gris différents. */
export const LUMA_709 = { r: 0.2126, g: 0.7152, b: 0.0722 } as const;

/** LUMINANCE PERÇUE (0..1) d'une couleur `#rrggbb`, dans l'espace où elle est ÉCRITE (sRGB — les
 *  octets de la donnée). `null` si non-hex. */
export function luminanceHex(hex: string): number | null {
  const c = parseHex(hex);
  return c ? (LUMA_709.r * c[0] + LUMA_709.g * c[1] + LUMA_709.b * c[2]) / 255 : null;
}

// Facteurs de LUMIÈRE (source en haut-gauche) — pas des identités de matériau (celles-ci sont en JSON).
/** Face N (bas-droite, ombre) : ×0.86, calibré sur la palette bois iso (unifie 0.845→0.883 hand-tunés). */
export const SIDE_N = 0.86;
export const SIDE_LIT = 1;
export const POST_CAP = 1.71;
export const POST_BASE = 0.68;

// Voiles de lumière semi-transparents (couleur fixe, alpha selon la géométrie).
export const ao = (alpha: number) => `rgba(0,0,0,${alpha})`;
export const spec = (alpha: number) => `rgba(255,255,255,${alpha})`;
export const warm = (alpha: number) => `rgba(255,240,210,${alpha})`;
