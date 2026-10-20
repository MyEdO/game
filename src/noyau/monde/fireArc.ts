/**
 * ARCS DE TIR / BORDÉES d'un navire (MDG 12-13). Couche STATE (et non engine) car l'arc dépend du cap
 * `Dir8` et de la géométrie de cases — comme `footprint.ts` / `combatGeometry.ts` ; le moteur reste pur.
 *
 * Le RAW nomme un CÔTÉ relatif au cap du navire (bâbord = gauche, tribord = droite, du point de vue du
 * navire ; proue = avant, poupe = arrière — MDG 13 l.262-271) et une portée, mais PAS un angle d'arc.
 * Convention retenue (DOCUMENTÉE, à valider — règle 1 : on n'enferme que le côté que le RAW énonce) :
 * modèle **BORDÉE** — proue et poupe sont des postes de CHASSE étroits (droit devant / droit derrière,
 * 1 octant) ; bâbord et tribord couvrent toute la **bordée** du travers, avant ET arrière de ce bord
 * (3 octants), conforme à « masser les pièces d'un bord pour lâcher une bordée » (MDG 12 l.428) et au
 * « canon tourné vers sa poupe » de l'exemple de poursuite (l.410). [Alternative écartée : quadrant 90°.]
 */
import { facingToward, rotateDir8, DIR8_ORDER, type Dir8 } from './dir8';
import type { FireArc } from '../../engine/types';


type Pt = { x: number; y: number };

/** Octant RELATIF (0 = droit devant … 4 = droit derrière, sens horaire) de la cible vs le cap du navire. PUR. */
function relativeOctant(heading: Dir8, shipPos: Pt, targetPos: Pt): number {
  const bearing = facingToward(shipPos, targetPos);
  return (DIR8_ORDER.indexOf(bearing) - DIR8_ORDER.indexOf(heading) + 8) % 8;
}

/** Côté (arc de tir) du navire de cap `heading` vers lequel se trouve la cible — modèle BORDÉE. PUR. */
export function targetArc(heading: Dir8, shipPos: Pt, targetPos: Pt): FireArc {
  switch (relativeOctant(heading, shipPos, targetPos)) {
    case 0: return 'proue';
    case 4: return 'poupe';
    case 1:
    case 2:
    case 3: return 'tribord';
    default: return 'babord'; // 5, 6, 7
  }
}

/** La cible est-elle dans l'arc d'un poste monté sur `gunSide` ? (côté de montage, relatif au cap). PUR. */
export function inFireArc(gunSide: FireArc, heading: Dir8, shipPos: Pt, targetPos: Pt): boolean {
  return targetArc(heading, shipPos, targetPos) === gunSide;
}

/** Cap qui met le bord `side` EN BATTERIE sur une cible de relèvement `bearing` (INVERSE de `targetArc` pour un bord
 *  donné) : travers droit = tribord (relèvement à l'octant +2 vs cap), travers gauche = bâbord (−2), proue = droit
 *  devant, poupe = droit derrière. Sert à l'IA/à la Surprise pour orienter une coque vers l'alignement d'une bordée. PUR. */
export function headingToBear(side: FireArc, bearing: Dir8): Dir8 {
  switch (side) {
    case 'tribord': return rotateDir8(bearing, -2);
    case 'babord': return rotateDir8(bearing, 2);
    case 'poupe': return rotateDir8(bearing, 4);
    default: return bearing;
  }
}
