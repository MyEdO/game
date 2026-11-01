import type { Rot } from '../geometry/iso';
import { DIR8_DELTA, type Dir8 } from '../geometry/dir8';

/** Les vues d'un art orienté, dans l'ordre CANONIQUE (face, profil, dos) : SOURCE UNIQUE, dont dérivent
 *  le type `View`, le format d'art orienté (`catalog/viewArt.ts`) et l'ordre de proximité
 *  des vues (`NEAREST`, `catalog/viewArt.ts`). Le profil est mitoyen de la face et du dos. */
export const VIEWS = ['front', 'profile', 'back'] as const;
/** Identifiant d'une vue : un membre de `VIEWS`. */
export type View = (typeof VIEWS)[number];

/** Direction ÉCRAN (dx,dy px iso) → vue + miroir. PUR.
 *  Latéral net → profile ; vers le bas → front ; vers le haut → back ; mirror = regarde à gauche. */
export function facingView(dx: number, dy: number): { view: View; mirror: boolean } {
  const ax = Math.abs(dx);
  const ay = Math.abs(dy);
  const view: View = ax > ay * 1.5 ? 'profile' : dy >= 0 ? 'front' : 'back';
  return { view, mirror: dx < 0 };
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
