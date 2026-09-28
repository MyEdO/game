import { gammeDe } from '../../../../data/palette.types';
import type { PartArt, ViewSet } from '../types';

/**
 * GABARIT de JAMBE partagé (#633) — contour + galbe genou/mollet faits UNE fois, à l'image de
 * la composition d'authoring du torse (`BODIES.nu.torse*` + surface). Une tenue appelle `jambeVetue`
 * en fournissant SON tissu et SON détail peint ; le CONTOUR (rempli `@tissu`) et le galbe lissé
 * viennent du gabarit → le fix de galbe (mollet doux, `rig/SKELETON-CONTRACT.md` genou 22..30) se
 * propage à tout def qui l'appelle, au lieu d'être recopié inline dans chaque tenue.
 *
 * Repère os `cuisse` : 0 = hanche, genou 22..30, 50 = cheville. front/back partagent leur contour ;
 * le profil a le sien. La jambe NUE (`bodies/defs/nu.ts`) est la 1re instance (tissu `peau`).
 */

// Contour UNIQUE face/dos (déménagé de nu.ts) — sommet arrondi rentré (±3 à y≈0, la cuisse émerge de
// sous le bassin), ouverture à ±4.5 vers y≈13, fuselé à la cheville (∓4 à y=50).
export const JAMBE_CONTOUR =
  'M-3 0.5 Q0 -0.8 3 0.5 C3.4 4 4.5 8 4.5 13 Q5 26 4 50 L-4 50 Q-5 26 -4.5 13 C-4.5 8 -3.4 4 -3 0.5 Z';
// Nappe du flanc externe (galbe de la cuisse, sommet rentré) — géométrie partagée face/dos.
export const JAMBE_FLANC =
  'M-3 0.5 C-3.4 4 -4.5 8 -4.5 13 Q-5 26 -4 50 L-2.3 49.6 Q-3.4 26 -3 13 C-3 8 -2 4 -1.8 1 Z';
// Contour du PROFIL (déménagé de nu.ts) — cuisse pleine, léger creux arrière du genou (∓3.3 à 22),
// mollet DOUX et progressif (pic ≈4.0 vers y≈34, le fix #633), cheville étroite.
export const JAMBE_PROFILE_CONTOUR =
  'M-3.4 0.6 Q-3.6 12 -3.3 22 Q-4.3 32 -3.9 38 Q-3.3 45 -2.6 50 L2.9 50 Q3.2 42 3.1 33 Q4.5 27 4.4 22 Q4.6 10 3.8 0.6 Q0 -0.9 -3.4 0.6 Z';
// Nappe arrière du profil (ischio → mollet → tendon), lissée le long du galbe.
const JAMBE_PROFILE_FLANC =
  'M-3.4 0.6 Q-3.6 12 -3.3 22 Q-4.3 32 -3.9 38 Q-3.3 45 -2.6 50 L-1.6 49.7 Q-2.4 45 -2.8 38 Q-3.2 32 -2.4 22 Q-2.6 12 -2.4 0.6 Z';

// Galbe PARTAGÉ genou/mollet (le fix fait UNE fois) : rotule (front), mollet + pli du genou (dos),
// arc du mollet (profil). Teintes @tissuH/@tissuO → suit le recoloriage de carrière.
const galbeFront = (t: string) =>
  `<path d="M-3.6 22 Q-4.6 25.5 -2.9 28.5 Q1.4 29.4 3.2 25.8 Q3.7 22.4 2 20 Q-0.8 21.4 -3.6 22 Z" fill="@${gammeDe(t, 'lumiere')}" opacity="0.45"/>`;
const galbeBack = (t: string) =>
  `<path d="M-2.4 29.5 Q-3.6 34.5 -2.2 39.5 Q0.8 40.6 2.4 36.5 Q2.9 32 1.2 29 Q-0.6 30 -2.4 29.5 Z" fill="@${gammeDe(t, 'lumiere')}" opacity="0.4"/>`
  + `<path d="M-2.6 25 Q0 26.6 2.8 25" fill="none" stroke="@${gammeDe(t, 'ombre')}" stroke-width="0.6" opacity="0.6"/>`;
const galbeProfile = (t: string) =>
  `<path d="M-3.2 30 Q-3.9 35 -3.2 40" fill="none" stroke="@${gammeDe(t, 'lumiere')}" stroke-width="0.7" opacity="0.5"/>`;

// Tige de botte standard (segment bas de jambe y..50) — jeton de cuir, suit le contour.
const bootShaft = (y: number, token: string) =>
  `<path d="M-4.4 ${y} Q0 ${y - 1.6} 4.4 ${y} L4 50 L-4 50 Z" fill="@${token}" stroke="@${gammeDe(token, 'ombre')}" stroke-width="0.5"/>`;

/**
 * Construit la jambe VÊTUE d'une tenue, 3 vues, sur le contour partagé.
 * - `tissu` : jeton de remplissage du contour (`vet1`|`cuir`|`peau`…). Le flanc suit en `@tissuO`.
 * - `surfaces` : détail peint SUR le contour, CLIPPÉ à la silhouette de jambe. `front` requis ;
 *   `back`/`profile` absents → surface générique du gabarit (couture + `botte` si fournie).
 * - `deborde` : calque NON clippé (revers/genouillère qui débordent légitimement le contour).
 * - `galbe` : ajoute les nappes genou/mollet PARTAGÉES (le fix lissé, une fois).
 * - `botte` : tige de botte standard segment y..50 (`token` par défaut `cuir`).
 */
export function jambeVetue(opts: {
  tissu: string;
  surfaces: Exclude<PartArt, string>;
  deborde?: Partial<ViewSet>;
  galbe?: boolean;
  botte?: { y: number; token?: string };
}): ViewSet {
  const { tissu: t, surfaces, deborde = {}, galbe = false, botte } = opts;
  const baseFB =
    `<path d="${JAMBE_CONTOUR}" fill="@${t}" stroke="@${gammeDe(t, 'ombre')}" stroke-width="0.5"/>`
    + `<path d="${JAMBE_FLANC}" fill="@${gammeDe(t, 'ombre')}" opacity="0.3"/>`;
  const baseP =
    `<path d="${JAMBE_PROFILE_CONTOUR}" fill="@${t}" stroke="@${gammeDe(t, 'ombre')}" stroke-width="0.5"/>`
    + `<path d="${JAMBE_PROFILE_FLANC}" fill="@${gammeDe(t, 'ombre')}" opacity="0.35"/>`;
  const boot = botte ? bootShaft(botte.y, botte.token ?? 'cuir') : '';
  // Surface générique d'une vue back/profile non fournie : couture centrale + botte.
  const genericBack = `<path d="M0 4 L0 48" stroke="@${gammeDe(t, 'ombre')}" stroke-width="0.5" opacity="0.4"/>${boot}`;
  const genericProfile = `<path d="M2.6 6 Q2.9 26 2.4 47" fill="none" stroke="@${gammeDe(t, 'lumiere')}" stroke-width="0.5" opacity="0.4"/>${boot}`;
  // Détail (galbe + surface) CLIPPÉ à la silhouette de jambe ; le débord reste hors clip.
  const clip = (id: string, inner: string) => (inner ? `<g clip-path="url(#${id})">${inner}</g>` : '');
  return {
    front:
      baseFB + clip('rigJambeClip', (galbe ? galbeFront(t) : '') + surfaces.front) + (deborde.front ?? ''),
    back:
      baseFB + clip('rigJambeClip', (galbe ? galbeBack(t) : '') + (surfaces.back ?? genericBack)) + (deborde.back ?? ''),
    profile:
      baseP + clip('rigJambeClipProfil', (galbe ? galbeProfile(t) : '') + (surfaces.profile ?? genericProfile)) + (deborde.profile ?? ''),
  };
}
