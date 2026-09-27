import { Scene, isWalkable, wallBetween, climbEdgeBetween, surfaceLink } from './scene';
import { areteEntre } from '../geometry/arete';
import type { Pt } from './path';

/**
 * Chute VOLONTAIRE — « à dessein » (LDB 15 l.82) : depuis une case en bordure d'un dénivelé `cliff`
 * (`state/relief.ts` — infranchissable à pied, SANS arête `WallSeg.climb`, déjà couverte par le flux
 * dédié `climbAcross`/Escalade) vers la case plus basse, un Personnage peut CHOISIR de sauter en bas
 * plutôt que d'y être infranchissable. `planFall` calcule la hauteur RÉELLE (mètres, relief) — la
 * résolution du Test (numérique, DR-driven, LDB 15 l.82) vit dans `rollFlowSpecs.fall` (patron
 * `pendingRun`), PAS ici : contrairement à `climbMove.ts`/`flow.ts::testFlow` (binaire, réservé à
 * l'Escalade), la réduction « −1 m par DR » exige la sortie NUMÉRIQUE de la modale canonique.
 */
export type FallPlan =
  | { kind: 'none' } // arête non adjacente/murée/grimpable, ou pas une falaise DESCENDANTE → geste inapplicable
  | { kind: 'fall'; metres: number };

/** `from` = case du sauteur, `to` = case cardinale adjacente PLUS BASSE. PUR. */
export function planFall(scene: Scene, from: Pt, to: Pt): FallPlan {
  if (!areteEntre(from.x, from.y, to.x, to.y)) return { kind: 'none' }; // cardinal seulement (patron climb/jump)
  const z = from.z ?? 0;
  if (wallBetween(scene, from.x, from.y, to.x, to.y, z)) return { kind: 'none' }; // mur/porte fermée bloque le saut
  if (climbEdgeBetween(scene, from, to)) return { kind: 'none' }; // arête grimpable → flux dédié (climbAcross/Escalade)
  if (!isWalkable(scene, to.x, to.y, to.z ?? 0)) return { kind: 'none' }; // aucune surface réelle en bas
  const link = surfaceLink(scene, from, to);
  if (!link || link.grade !== 'cliff' || link.drop >= 0) return { kind: 'none' }; // pas une falaise DESCENDANTE
  return { kind: 'fall', metres: -link.drop };
}
