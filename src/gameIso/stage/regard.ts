/**
 * LE REGARD — ce dont l'ART d'un billboard dépend, et rien d'autre (#1373).
 *
 * Deux vues, une seule unité : sur la vue de plateau le CRAN d'art (quart de tour, `rot`) ; en
 * première personne le CAP Dir8 du meneur (`facing`), dont le cran se DÉRIVE (`povArtRot`). Le module
 * est PUR : il ne connaît ni three, ni React, ni le stage — il répond « quelle caméra », « quelle
 * identité de cache », « quels regards voisins », pour que la repose des quads et la pré-chauffe des
 * textures posent la MÊME question au même endroit.
 */
import type { Rot } from '../../geometry/iso';
import { DIR8_ORDER, type Dir8 } from '../../noyau/monde/dir8';
import type { BillboardCamera } from '../backends/webgl/billboardMath';
import type { BillboardSubject } from '../backends/webgl/sceneMeshes';
import { dir8Basis } from '../pov/camera';

/** Un REGARD : le cran d'art, et le cap de première personne quand il y en a un (`null` = plateau). */
export interface Regard { rot: Rot; facing: Dir8 | null }

/** CLÉ stable d'un regard — l'identité que portent les quads montés, et que la relève d'une texture
 *  compare au regard courant. Le CAP prime : huit caps se planchérisent sur quatre crans, deux caps
 *  voisins peuvent donc partager leur cran sans montrer le même art. PURE. */
export function cleRegard(r: Regard): string {
  return r.facing ?? `r${r.rot}`;
}

/** LACET (degrés, convention de `freeYaw`/`artRot`) du regard PREMIÈRE PERSONNE de cap `facing`.
 *  La caméra affine du cran `r` regarde la diagonale `DIR8_ORDER[(7 + 2r) % 8]` : à ce cap, la vue
 *  perspective rend exactement ce que rend `project(·, r)` sur les huit orientations (parité mesurée,
 *  `billboards-pov.test.tsx`). Les huit caps se répartissent donc tous les 45°, le cap N à 45°. PUR. */
export function povYawDeg(facing: Dir8): number {
  return ((DIR8_ORDER.indexOf(facing) + 1) * 45) % 360;
}

/** CRAN d'ART d'un regard première personne (#1176, P3-1b) : le lacet de son cap, PLANCHÉRISÉ par la
 *  MÊME loi qu'`artRot` — l'atlas de décor n'existe qu'aux quarts de tour (`propSvg(ref, dir, camRot)`),
 *  et les quatre caps CARDINAUX tombent entre deux crans. Sans lui, les props d'une vue première
 *  personne gardent le cran de la dernière vue de plateau. PUR. */
export function povArtRot(facing: Dir8): Rot {
  return (Math.floor(povYawDeg(facing) / 90) % 4) as Rot;
}

/** Caméra de billboard d'un regard — la MÊME dérivation qu'au montage des quads : en première
 *  personne le CAP du meneur, sur la vue de plateau le cran d'art. PURE. */
export function bbCameraDe(regard: Regard): BillboardCamera {
  return regard.facing ? { kind: 'perspective', ...dir8Basis(regard.facing) } : { kind: 'ortho', yawDeg: regard.rot * 90 };
}

/** Les quatre CRANS d'art d'une vue de plateau — l'art de décor n'existe qu'aux quarts de tour. */
export const CRANS_ART: readonly Rot[] = [0, 1, 2, 3];

/** Les regards VOISINS d'un regard donné — ceux qu'un temps mort réchauffe, pour que le prochain
 *  changement trouve sa texture au cache : les trois autres crans sur la vue de plateau, les deux caps
 *  à ±45° en première personne (un demi-tour progressif passe par eux). PUR. */
export function regardsVoisins(regard: Regard): Regard[] {
  if (!regard.facing) return CRANS_ART.filter((r) => r !== regard.rot).map((r) => ({ rot: r, facing: null }));
  const i = DIR8_ORDER.indexOf(regard.facing);
  return [1, 7].map((d) => {
    const cap = DIR8_ORDER[(i + d) % 8];
    return { rot: povArtRot(cap), facing: cap };
  });
}

/** IDENTITÉ de cache d'un sujet AU CRAN `rot` : le cran entre dans celle d'un décor, jamais dans celle
 *  d'un personnage (son art l'ignore — l'y mettre rasteriserait quatre fois la MÊME image). PURE. */
export function identiteAuCran(sub: BillboardSubject, rot: Rot): string {
  return sub.kind === 'prop' ? `${sub.identity}|r${rot}` : sub.identity;
}
