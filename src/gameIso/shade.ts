/**
 * Ombrage PUR — avec la donnée JSON (matériaux), la SEULE source de couleur d'un renderer d'environnement.
 * Un renderer ne porte donc aucun littéral de couleur : l'identité d'un matériau vient du JSON, la LUMIÈRE
 * (ombre d'orientation, occlusion, spéculaire) vient d'ici. Dérive un ton en multipliant la luminance d'une
 * base par un facteur, clampé ; un `var(--x)` CSS (pierre) passe tel quel. Aucune lecture DOM.
 */
import { distanceTeinte, mix, parseHex, SEUIL_TEINTES_CONTIGUES, toHex } from '../data/couleur';

/** Un octet sRGB (0–255) en valeur LINÉAIRE — la transfert standard, celle que three applique aux
 *  couleurs de sommet et à la sortie du rendu. */
export const srgbToLinear = (octet: number): number => {
  const u = octet / 255;
  return u <= 0.04045 ? u / 12.92 : ((u + 0.055) / 1.055) ** 2.4;
};

/** Pas de recherche de `tonsDArete` : le chemin cœur → pôle est découpé en `PAS_TONS` crans. */
const PAS_TONS = 256;

/** Écart des deux tons d'un trait d'arête : deux fois le plancher des teintes contiguës. `distanceTeinte`
 *  est une norme (inégalité triangulaire) : pour tout fond S, d(cœur, S) + d(S, bord) ≥ ce plancher
 *  doublé, donc l'un des deux tons est à `SEUIL_TEINTES_CONTIGUES` au moins de S. */
export const ECART_TONS_D_ARETE = 2 * SEUIL_TEINTES_CONTIGUES;

/** Les deux tons d'un TRAIT D'ARÊTE : le CŒUR est `base` à l'identique (la couleur déclarée) ; le BORD
 *  est `base` poussée vers le pôle (noir ou blanc) le plus LOINTAIN, au plus petit cran qui l'en écarte
 *  de `ECART_TONS_D_ARETE`. Toujours atteint : d(base, noir) + d(base, blanc) ≥ d(noir, blanc) = 765,
 *  donc le pôle lointain est à 382,5 au moins. */
export function tonsDArete(base: string): { coeur: string; bord: string } {
  if (!/^#[0-9a-fA-F]{6}$/.test(base)) throw new Error(`tonsDArete : « ${base} » n’est pas une couleur #rrggbb.`);
  const pole = distanceTeinte(base, '#000000') >= distanceTeinte(base, '#ffffff') ? '#000000' : '#ffffff';
  for (let i = 1; i <= PAS_TONS; i++) {
    const bord = mix(base, pole, i / PAS_TONS);
    if (distanceTeinte(base, bord) >= ECART_TONS_D_ARETE) return { coeur: base, bord };
  }
  throw new Error(`tonsDArete : le pôle ${pole} n’atteint pas ${ECART_TONS_D_ARETE} depuis ${base}.`);
}

/** Base × facteur de luminance (clampé). Un non-hex (`var(--x)`) est renvoyé tel quel. */
export function shade(color: string, k: number): string {
  const c = parseHex(color);
  return c ? toHex(c[0] * k, c[1] * k, c[2] * k) : color;
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
