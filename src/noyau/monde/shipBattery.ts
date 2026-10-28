/**
 * TIR DE BATTERIE — « lâcher une bordée » (MDG 14 l.126-130). Couche STATE (la bordée qui porte dépend du
 * cap `Dir8` + géométrie, comme `fireArc`/`shipManeuver` ; le moteur reste pur). RAW verbatim (l.128) :
 * « Plutôt que de lancer les dés pour toucher pour chaque canon, le Test d'équipage de Tir de batterie peut
 * être effectué et le total de DR s'applique à toutes les armes à feu tournées vers l'ennemi, pour le meilleur
 * et pour le pire. » → UN Test d'équipage (Artilleur ESSENTIEL) produit un DR PARTAGÉ qui remplace le jet de
 * chaque pièce de la bordée qui porte.
 *
 * Ce module produit le PLAN de la bordée (le bord qui porte + ses pièces + le DR partagé) — PUR et testable
 * sans navigateur. L'APPLICATION par pièce (Dégâts = Dégâts de l'arme + DR ; Critiques de navire sur double)
 * réutilise la résolution de tir d'UNE pièce (Étape « Servir un poste », `firedAttackBlock`/flux d'attaque)
 * avec ce DR forcé, dans `shipBatteryConfirm` (combatSlice).
 */
import { targetArc } from './fireArc';
import { resolveCrewTestByRoles, type CrewAssignment, type CrewTestResult } from '../../engine/crewMorale';
import type { RefDesignee } from '../../data/schemas/grammaire/ref';
import { type RNG } from '../../engine/dice';
import type { Combatant, ShipPoste, FireArc } from '../../engine/types';
import type { Dir8 } from '../../geometry/dir8';

export interface BatteryPlan {
  /** Le bord (bordée) qui PORTE sur la cible — l'arc où tombe la cible (proue/tribord/poupe/bâbord). */
  side: FireArc;
  /** Les pièces de CE bord (toutes partagent l'arc du bord → toutes portent, ou aucune). */
  postes: ShipPoste[];
  /** Le Test d'équipage « Tir de batterie » (Artilleur essentiel, MDG 14). */
  crewTest: CrewTestResult;
  /** DR total PARTAGÉ par toute la bordée — appliqué à chaque pièce « pour le meilleur et pour le pire » (l.128). */
  dr: number;
}

/**
 * Plan d'un Tir de batterie : la bordée qui porte sur `target` + son Test d'équipage (DR partagé). `heading` =
 * cap du navire `hull` ; `assignments` = équipage par rôle (Artilleur essentiel) ; `moraleScore` = Moral du
 * navire (bande de DR appliquée au total). PUR (RNG injecté). Renvoie `null` si les positions ne sont pas
 * résolues ou si AUCUNE pièce ne porte sur la bordée visée (rien à lâcher).
 */
export function resolveBattery(
  hull: Combatant, target: Combatant, heading: Dir8 | undefined,
  assignments: CrewAssignment[], moraleScore: number, navigation: RefDesignee, rng: RNG,
): BatteryPlan | null {
  if (!hull.pos || !target.pos) return null;
  const side = targetArc(heading ?? 'N', hull.pos, target.pos); // la bordée où tombe la cible
  const postes = (hull.postes ?? []).filter((p) => p.side === side);
  if (!postes.length) return null; // aucune pièce sur ce bord → pas de bordée à lâcher
  const crewTest = resolveCrewTestByRoles(assignments, 'batterie', 'intermediaire', moraleScore, navigation, rng);
  return { side, postes, crewTest, dr: crewTest.total };
}

/** Ordre de préférence des bords pour « le plus armé » : les BORDÉES (travers) massent les pièces (MDG 12 l.428),
 *  la proue/poupe sont des postes de CHASSE étroits — départage stable à effectif égal. */
export const SHIP_ARC_PREF: FireArc[] = ['tribord', 'babord', 'proue', 'poupe'];

/** Le bord le PLUS ARMÉ d'une coque (pièces CHARGÉES), départagé par `SHIP_ARC_PREF`. `null` si aucune pièce chargée. PUR. */
export function mostArmedSide(ship: Combatant): FireArc | null {
  const counts = new Map<FireArc, number>();
  for (const p of postesPretsAFaireFeu(ship)) if (p.side) counts.set(p.side, (counts.get(p.side) ?? 0) + 1);
  let best: FireArc | null = null;
  let bestN = 0;
  for (const s of SHIP_ARC_PREF) { const n = counts.get(s) ?? 0; if (n > bestN) { best = s; bestN = n; } }
  return best;
}

/** Pièces d'un navire qui peuvent FAIRE FEU : **chargées** (`loaded !== false`, MDG 12 / LDB 62 l.333). PUR —
 *  source unique lue par la bordée (`bearingPostes` → `batteryBlock`, commit de `battleShipBattery`) et par
 *  le gate d'offre `pieces-au-navire`. */
export function postesPretsAFaireFeu(ship: Combatant): ShipPoste[] {
  return (ship.postes ?? []).filter((p) => p.loaded !== false);
}

/** Pièces prêtes à faire feu (`postesPretsAFaireFeu`) montées sur le bord `side` : « le bord qui peut lâcher
 *  une bordée ». PUR. */
export function bearingPostes(ship: Combatant, side: FireArc): ShipPoste[] {
  return postesPretsAFaireFeu(ship).filter((p) => p.side === side);
}
