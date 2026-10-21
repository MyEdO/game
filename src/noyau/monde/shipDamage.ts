/**
 * Foyer COQUE — vocabulaire UNIQUE des Dégâts/soins de coque (MSRC 7, MDG 13-15) : les Dégâts de
 * coque RAW sont des valeurs FINALES (bélier, échouage, collision, réparation temporaire) — jamais
 * mitigées par BE/PA, `ignoreTB`/`ignoreAP` du GameOp `wounds` (LDB 18) l'expriment directement.
 *
 * SOURCE UNIQUE de la coque : `state.vessel.wounds` (#296). Le Combattant-coque de trajet
 * (`travelPlan.vehicle`) reste une COPIE DE TRAVAIL nécessaire à `applyOps` (langue unique des effets)
 * et au combat ; sa mutation passe TOUJOURS par `damageHull`/`healHull` ci-dessous, jamais un accès
 * direct à `.wounds`. La PERSISTANCE vers `vessel.wounds` (le seam qui rend cette copie de travail
 * réconciliable) vit dans `damageVesselHull`/`healVesselHull` (`seaVoyageFlow.ts`, réutilisées par
 * `riverVoyageFlow.ts`) — UNE écriture par appel, jamais un chemin bare parallèle.
 */
import type { Combatant } from '../../engine/types';
import { applyOps } from '../../engine/ops';
import { battleRng } from '../battleRng';

/** Inflige `amount` Dégâts de coque (valeur finale, ignore BE+PA) au Combattant-coque. Mute `hull` en
 *  place ; renvoie le journal `applyOps`. */
export function damageHull(hull: Combatant, amount: number): string[] {
  if (amount <= 0) return [];
  return applyOps(hull, [{ op: 'wounds', amount, ignoreTB: true, ignoreAP: true }], { rng: battleRng() });
}

/** Restaure `amount` Blessures de coque (plafonné au max) au Combattant-coque. Mute `hull` en place ;
 *  renvoie le journal `applyOps`. */
export function healHull(hull: Combatant, amount: number): string[] {
  if (amount <= 0) return [];
  return applyOps(hull, [{ op: 'heal', amount }], { rng: battleRng() });
}
