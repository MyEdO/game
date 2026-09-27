/**
 * Orientation MONDE d'une entité/combattant : 8 directions grille (4 cardinales + 4 diagonales).
 * Source de vérité de l'orientation ; projetée au rendu par `project()`
 * (src/gameIso/rig/facing.ts) en tenant compte de la rotation caméra (`camRot`).
 *
 * `Dir4` (plus bas) est son sous-ensemble CARDINAL : le seul autre terme de CAP du projet.
 */
export type Dir8 = 'N' | 'NE' | 'E' | 'SE' | 'S' | 'SO' | 'O' | 'NO';

/** Les 8 caps en ordre HORAIRE, 45° par cran — SOURCE UNIQUE (arc de tir, rotation, rendu). */
export const DIR8_ORDER: Dir8[] = ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'];

/** CAP CARDINAL — le sous-ensemble de `Dir8` sans diagonale, et le SEUL terme du projet pour une
 *  DIRECTION cardinale : cap d'un décor VOLUMIQUE, côté SORTANT d'un mur (`outwardSide`), pas vers une
 *  case voisine (`CARD_NB`). L'ARÊTE d'une case — QUEL de ses quatre bords porte un mur, une porte, une
 *  paroi de relief — est l'autre concept, et il a lui aussi UN terme : `CellSide` (`state/scene.ts`).
 *  Même cardinal, frontière nette : on ne tourne pas vers une arête, on ne pose pas un mur sur un cap.
 *  Un décor volumique ne prend pas d'autre cap : `data/props.types.ts` `capVolumique`. */
export type Dir4 = Extract<Dir8, 'N' | 'E' | 'S' | 'O'>;
export const DIR4_ORDER: readonly Dir4[] = ['N', 'E', 'S', 'O'];
export const estCardinal = (d: Dir8): d is Dir4 => (DIR4_ORDER as readonly Dir8[]).includes(d);

/**
 * Tourne un cap de `steps` crans de 45° (HORAIRE si `steps > 0` = vers tribord/droite ; anti-horaire si
 * `< 0` = vers bâbord/gauche). PUR. Ex. `rotateDir8('N', 2)` = 'E' (90° à droite, vire tribord) ;
 * `rotateDir8('N', -2)` = 'O' (90° à gauche, vire bâbord) ; `rotateDir8('N', -1)` = 'NO' (45° à gauche).
 */
export function rotateDir8(dir: Dir8, steps: number): Dir8 {
  return DIR8_ORDER[(DIR8_ORDER.indexOf(dir) + (steps % 8) + 8) % 8];
}

/** Dir8 (MONDE) → delta grille unitaire. PUR (#161 : géométrie de
 *  grille, pas du rendu ; `project()` la reprend pour l'orientation écran, cf. commentaire ci-dessus). */
export const DIR8_DELTA: Record<Dir8, { gx: number; gy: number }> = {
  N: { gx: 0, gy: -1 }, NE: { gx: 1, gy: -1 }, E: { gx: 1, gy: 0 }, SE: { gx: 1, gy: 1 },
  S: { gx: 0, gy: 1 }, SO: { gx: -1, gy: 1 }, O: { gx: -1, gy: 0 }, NO: { gx: -1, gy: -1 },
};

/** Delta grille unitaire (signes -1/0/1, jamais `0,0`) → Dir8 — inverse de `DIR8_DELTA`. Exporté pour la
 *  classification RELATIVE d'une case autour d'une empreinte (`crewFormationSlots`, shipPostes.ts). */
export const DELTA_DIR8: Record<string, Dir8> = {
  '0,-1': 'N', '1,-1': 'NE', '1,0': 'E', '1,1': 'SE',
  '0,1': 'S', '-1,1': 'SO', '-1,0': 'O', '-1,-1': 'NO',
};

/** Delta grille (to−from) → Dir8 la plus proche (par signe). Défaut 'S' si nul. PUR. */
export function facingToward(from: { x: number; y: number }, to: { x: number; y: number }): Dir8 {
  const dx = Math.sign(to.x - from.x);
  const dy = Math.sign(to.y - from.y);
  if (dx === 0 && dy === 0) return 'S';
  return DELTA_DIR8[`${dx},${dy}`];
}
