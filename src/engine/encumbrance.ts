/**
 * Pénalités d'Encombrement — Livre de base, « Surchargé » (p.295).
 *
 * Capacité sans pénalité = Bonus de Force + Bonus d'Endurance (cf. maxEncumbrance).
 * Au-delà, le Personnage est Surchargé, par paliers exprimés en multiples de la
 * capacité :
 *
 *   | Enc porté                | Pénalité                                   |
 *   |--------------------------|--------------------------------------------|
 *   | ≤ capacité               | aucune                                     |
 *   | ≤ 2× capacité (palier 1) | −1 Mouvement (min 3), −10 Agilité, +1 Fat. |
 *   | ≤ 3× capacité (palier 2) | −2 Mouvement (min 2), −20 Agilité, +2 Fat. |
 *   | > 3× capacité (palier 3) | immobilisé                                 |
 *
 * « Des pénalités de Mouvement […] sont appliquées immédiatement. » La Fatigue
 * du voyage (États Exténué) s'accumule en fin de journée de voyage — échelle
 * voyage, non appliquée automatiquement en combat tactique.
 */
import { Combatant } from './types';
import { maxEncumbrance, totalEncumbrance } from './items';
import { conditionGating } from './conditions';
import { traumaMovementHalved, passiveMoveMod, prosthesisMoveRestore } from './trauma';
import { offTerrainMoveCap } from './ops';
import { flyMeters } from './traits/dispatch';
import encumbranceTiersJson from '../data/encumbranceTiers.json';
import { datasetDe, type EntreeDe } from '../data/datasets';
import type * as encumbranceTiersDef from '../data/schemas/defs/encumbranceTiers';

export type EncumbrancePenalties = EntreeDe<typeof encumbranceTiersDef>;

/** Profils de pénalité par palier (LDB 61 l.35-40) — DONNÉE (`src/data/encumbranceTiers.json`). Le palier 3
 *  porte `movePenalty: null` (immobilisé : le flag `immobile` court-circuite, plus d'`Infinity`). */
const ENCUMBRANCE_TIERS = datasetDe<typeof encumbranceTiersDef>(encumbranceTiersJson);

/** Pénalités d'Encombrement d'un combattant selon le Livre de base (p.295). Le PALIER (multiples de la
 *  capacité) est calculé ici ; les VALEURS du palier viennent de la donnée. */
export function encumbrancePenalties(c: Combatant): EncumbrancePenalties {
  const cap = maxEncumbrance(c);
  const enc = totalEncumbrance(c);

  // Capacité non finie (combattant sans F/E — données incomplètes) : aucun palier (et surtout pas
  // « immobile », ce que donneraient les comparaisons `enc <= NaN` toutes fausses).
  if (!Number.isFinite(cap) || enc <= cap) return { ...ENCUMBRANCE_TIERS[0] };
  if (enc <= cap * 2) return { ...ENCUMBRANCE_TIERS[1] };
  if (enc <= cap * 3) return { ...ENCUMBRANCE_TIERS[2] };
  return { ...ENCUMBRANCE_TIERS[3] }; // > 3× la capacité : « Vous ne pouvez pas vous déplacer. »
}

/** Part du Mouvement que les États de `c` lui laissent à l'allure `allure`, lue en DONNÉES (`gating.movement`) :
 *  rien sous `none` (Empêtré LDB 16 l.64, Surpris l.132) ; la moitié sous `half` (Sonné l.125) ; sous `crawl`
 *  (À Terre l.35), la moitié en rampant, rien en vol. */
function partSousLesEtats(c: Combatant, allure: 'marche' | 'vol'): 0 | 0.5 | 1 {
  const gate = conditionGating(c).movement;
  if (gate === 'none' || (gate === 'crawl' && allure === 'vol')) return 0;
  return gate === 'half' || gate === 'crawl' ? 0.5 : 1;
}

/** Mètres de Marche par point de Mouvement. LDB 15 l.18-31 */
const METRES_PAR_POINT_DE_MOUVEMENT = 2;

/** Vol (Indice) de `c` en points de Mouvement, sous ses États (`partSousLesEtats`) ; `null` sans Vol. Lu sur la
 *  géométrie porteuse (`mountMovement`, `buildAiInput`) et par le choix de la marche ou du vol (`moveReachFor`).
 *  LDB 85 l.428-439 ; LDB 15 l.18-31 */
export function mouvementDeVol(c: Combatant): number | null {
  const metres = flyMeters(c.traits);
  if (metres == null) return null;
  return Math.floor((metres * partSousLesEtats(c, 'vol')) / METRES_PAR_POINT_DE_MOUVEMENT);
}

/**
 * Mouvement effectif après pénalité d'Encombrement.
 * effM = min(baseM, max(baseM − pénalité, plancher)) — le plancher n'augmente
 * jamais un Mouvement déjà inférieur ; 0 si immobilisé.
 */
export function effectiveMovement(c: Combatant): number {
  const p = encumbrancePenalties(c);
  const part = partSousLesEtats(c, 'marche');
  if (p.immobile || part === 0) return 0;
  // `moveMod` ADDITIF du collecteur passif unifié : mutation PERMANENTE (Pattes d'animaux +1 / Corpulent /
  // Court sur pattes −1, kind `intrinseque`) + sort actif (kind `magique`) — sommés avant tout demi-Mouvement.
  // HORS de son terrain (op `offTerrainMod`, gaté par `c.offTerrain`) : le M est REMPLACÉ (Créature marine
  // « son M tombe à 1 » MDG 16 l.17 ; Aquatique → 0, MSRC 15 l.139) — les gates/demi-Mouvement s'appliquent dessus.
  const mv = offTerrainMoveCap(c) ?? Math.max(0, c.movement + passiveMoveMod(c));
  // `movePenalty` n'est null que sur le palier immobilisé (déjà court-circuité ci-dessus) → `?? 0` sûr.
  const base = p.tier === 0 ? mv : Math.min(mv, Math.max(mv - (p.movePenalty ?? 0), p.moveFloor));
  // Demi-Mouvement : part des États (`partSousLesEtats`) OU traumatisme de jambe/torse (LDB 18 :
  // Déchirure/Fracture). Un seul halving (pas de cumul inventé). Fausse jambe PORTÉE mais pas encore
  // entraînée au Mouvement (100 PX, LDB 73 l.23) : +1 PM ignoré POST-halving (`prosthesisMoveRestore`) —
  // 0 hors ce cas précis (pas de trauma de jambe concerné, ou ÷2 déjà levé par l'entraînement).
  return (part === 0.5 || traumaMovementHalved(c)) ? Math.floor(base / 2) + prosthesisMoveRestore(c) : base;
}

/** Modificateur signé aux tests d'Agilité dû à l'Encombrement (0 / −10 / −20). */
export function agilityTestPenalty(c: Combatant): number {
  return encumbrancePenalties(c).agilityPenalty;
}
