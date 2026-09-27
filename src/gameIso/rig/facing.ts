import { rotTile, type Dims, type Rot } from '../../geometry/iso';
import { DIR8_DELTA, type Dir8 } from '../../state/dir8';
export type { Dir8 };

/** Les vues d'un art orienté, dans l'ordre CANONIQUE (face, profil, dos) : SOURCE UNIQUE, dont dérivent
 *  le type `View`, les formats d'art orienté (`viewArt.ts`, `parts/types.ts`) et l'ordre de proximité
 *  des vues (`NEAREST`, `viewArt.ts`). Le profil est mitoyen de la face et du dos. */
export const VIEWS = ['front', 'profile', 'back'] as const;
/** Identifiant d'une vue : un membre de `VIEWS`. */
export type View = (typeof VIEWS)[number];
/** Libellé d'AFFICHAGE d'une vue (colonnes des planches QC) ; aucune logique ne le lit. */
export const VIEW_LABEL = { front: 'face', profile: 'profil', back: 'dos' } as const satisfies Record<View, string>;

/** Direction ÉCRAN (dx,dy px iso) → vue + miroir. PUR.
 *  Latéral net → profile ; vers le bas → front ; vers le haut → back ; mirror = regarde à gauche. */
export function facingView(dx: number, dy: number): { view: View; mirror: boolean } {
  const ax = Math.abs(dx);
  const ay = Math.abs(dy);
  const view: View = ax > ay * 1.5 ? 'profile' : dy >= 0 ? 'front' : 'back';
  return { view, mirror: dx < 0 };
}

/** Vecteur direction ÉCRAN entre deux tuiles, dans l'orientation caméra `dims` (rot). PUR.
 *  (iso : screenX ∝ x−y, screenY ∝ x+y, sur les coords tournées.) */
export function screenDir(
  from: { x: number; y: number },
  to: { x: number; y: number },
  dims?: Dims,
) {
  const a = dims ? rotTile(from.x, from.y, dims) : from;
  const b = dims ? rotTile(to.x, to.y, dims) : to;
  return { dx: b.x - b.y - (a.x - a.y), dy: b.x + b.y - (a.x + a.y) };
}

/** Rotation d'un delta grille par le cran caméra. PUR.
 *  (= partie linéaire de rotTile : les offsets W-1/H-1 s'annulent dans une différence.) */
function rotDelta(gx: number, gy: number, rot: Rot): { gx: number; gy: number } {
  switch (rot) {
    case 1: return { gx: gy, gy: -gx };
    case 2: return { gx: -gx, gy: -gy };
    case 3: return { gx: -gy, gy: gx };
    default: return { gx, gy };
  }
}

/** Orientation MONDE (Dir8) + cran caméra → vue + miroir. PUR.
 *  Recalculée à chaque rendu ⇒ tourner la caméra ré-oriente les sprites (sans event). */
export function project(dir: Dir8, camRot: Rot): { view: View; mirror: boolean } {
  const d = DIR8_DELTA[dir];
  const r = rotDelta(d.gx, d.gy, camRot);
  return facingView(r.gx - r.gy, r.gx + r.gy);
}
