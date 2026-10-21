/**
 * INTENTION LOCALE — le mode « je choisis mon geste AVANT de cliquer le champ » (spec HUD zone 4).
 *
 * Modèle de gestes en vigueur : spec HUD, § « ARBITRAGE 2026-08-19 » (`docs/plans/2026-08-16-spec-hud-combat.md`).
 * Une intention ARME un geste que le champ ne fait plus tout seul : la Course s'arme pour dépasser la
 * Marche, l'approche vers un ennemi s'arme par la Charge, et la zone d'un geste armé est la seule qui
 * se peigne en plus de la Marche. Elle se dissout au clic qui la commet (ou à Échap / au re-clic de sa
 * case), et son annulation est GRATUITE par construction — aucune ressource n'est engagée à l'armement.
 *
 * COOP : `localIntent` vit à la RACINE du store, HORS `battle` — le mode est LOCAL au client (aucun
 * intent réseau à l'armement, seul le COMMIT du geste part), et `applyHostSnapshot` le préserve
 * (`netFlow.ts`). Les POSTURES, elles, sont du JEU : elles vivent dans `battle`.
 *
 * Chaque action du registre qui arme une intention déclare, en donnée (`intent` de `actions.json`),
 * l'id de la PORTÉE que le champ doit peindre ; le code de cette portée vit ici, jamais en JSON.
 */
import type { Get } from './flowTypes';
import { computeChargeReach, computeRunReach, displayedReach } from './combatFlow';
import { findActionById } from '../data/index';
import { unSiegeAgit } from './netOwnership';

/** Le mode d'intention ARMÉ (un seul à la fois) : l'id d'action du registre qui l'a posé. */
export interface LocalIntent {
  actionId: string;
}

/** Les PORTÉES affichables, par id (`intent` de `actions.json`) : case → coût, comme toute portée du
 *  moteur. `null` = l'intention n'a pas de bande de cases PROPRE : la portée d'ARME se lit aux bandes
 *  de tir (`HighlightsView.rangeBandSource`) et la COURSE à la zone de Course du champ
 *  (`HighlightsView.runReach`) — jamais une 2ᵉ écriture de la même vérité.
 *
 *  Les entrées sont des LAMBDAS, pas les fonctions du moteur directement : ce module est importé par
 *  `targetingModes`, lui-même dans le cycle de `combatFlow` — un binding capturé à l'évaluation du
 *  module y valait `undefined`, et toute portée d'intention se peignait VIDE (mesuré 2026-08-19 :
 *  `intention-portee` rouge, « expected [] to deeply equal [207 cases] »). Résolues à l'APPEL, elles
 *  sont insensibles à l'ordre d'évaluation des modules. */
export const INTENT_REACH: Record<string, ((get: Get) => Map<string, number>) | null> = {
  'portee-mouvement': (get) => displayedReach(get),
  'portee-course': null,
  'portee-charge': (get) => computeChargeReach(get),
  'portee-arme': null,
};

/** L'intention armée du PROPRIÉTAIRE du store, ou `null` quand un geste s'exécute au nom d'un AUTRE
 *  siège (`withActingSeat`) : celui-là n'a droit qu'au verdict qu'il joint (`argsAvecVerdictLocal`),
 *  et un verdict absent vaut « non armé ». Seule lecture de `localIntent` par le geste. */
export function intentionDuProprietaire(get: Get): LocalIntent | null {
  return unSiegeAgit() ? null : get().localIntent;
}

/** Id de PORTÉE de l'intention armée (`intent` de son action), ou `null` — la seule lecture par
 *  laquelle une surface apprend CE QUE le joueur a demandé à voir. */
export function armedIntentPortee(get: Get): string | null {
  const armed = intentionDuProprietaire(get);
  return (armed ? findActionById(armed.actionId)?.intent : undefined) ?? null;
}

/** Bande de cases à peindre pour l'intention ARMÉE — vide si aucune, si l'action ne déclare pas de
 *  portée, ou si sa portée n'a rien à montrer. Source UNIQUE du 3ᵉ `kind` de surbrillance. */
export function intentReach(get: Get): Map<string, number> {
  const portee = armedIntentPortee(get);
  const reach = portee ? INTENT_REACH[portee] : null;
  return reach ? reach(get) : new Map();
}

/** Portée d'ARME : l'intention qui délègue son affichage aux BANDES DE TIR existantes (`rangeBand`),
 *  au lieu d'ouvrir une 2ᵉ écriture de la même vérité. */
export const PORTEE_ARME = 'portee-arme';

/** Portée de COURSE : même délégation, vers la ZONE DE COURSE du champ (`HighlightsView.runReach`,
 *  nature `run`). Depuis l'arbitrage du 2026-08-19 cette zone ne se peint plus d'office : elle est
 *  l'affordance de l'intention armée, et se peint EXACTEMENT quand cette intention l'est. */
export const PORTEE_COURSE = 'portee-course';

/** L'intention armée est-elle celle qui débloque la zone de COURSE (spec § 2026-08-19, école BG3) ?
 *  Source UNIQUE du verdict, lue par le champ (peinture) comme par le clic (commit). */
export function courseArmee(get: Get): boolean {
  return armedIntentPortee(get) === PORTEE_COURSE;
}

/** Les PORTÉES que le champ peint au tour du joueur (`gameIso/stage/highlightLayer.tsx`) et qu'un hôte lit, l'armée
 *  d'abord : celle de l'intention armée (`intentReach`), la zone de Course quand elle est armée (`computeRunReach`), puis
 *  la Marche (`displayedReach`). Vides hors de son tour. */
export function porteesDuTour(get: Get, monTour: boolean): { intention: Map<string, number>; course: Map<string, number>; marche: Map<string, number> } {
  return {
    intention: monTour && get().localIntent ? intentReach(get) : new Map(),
    course: monTour && courseArmee(get) ? computeRunReach(get) : new Map(),
    marche: monTour ? displayedReach(get) : new Map(),
  };
}

/** Même verdict pour l'APPROCHE vers un ennemi (Charge) : le clic-ennemi ne s'approche plus tout seul,
 *  il frappe à portée — l'approche se demande, par la case Charge. */
export const PORTEE_CHARGE = 'portee-charge';
export function chargeArmee(get: Get): boolean {
  return armedIntentPortee(get) === PORTEE_CHARGE;
}

/**
 * VERDICT D'ARMEMENT JOINT AUX ARGS D'UN INTENT RÉSEAU, par action de clic.
 *
 * L'intention est LOCALE au client (hors snapshot, plus haut) : un invité qui arme sa Course puis
 * clique n'envoie que `battleClickTile(pt, opts)`, et l'HÔTE l'exécute dans SON store — où cette
 * intention n'existe pas. Sans ce joint, un invité ne pourrait jamais courir ni charger, et l'hôte
 * débloquerait le geste d'autrui en armant SA propre case. Le verdict se calcule donc CHEZ
 * L'ÉMETTEUR, au moment du geste, et voyage dans les args comme `confirm`.
 *
 * Table déclarative (jamais un `if (action === …)` au fil de `netFlow`) : une action de clic, la
 * façon d'enrichir SES args. Les intents absents d'ici voyagent inchangés.
 */
export const INTENT_VERDICT_ARGS: Record<string, (get: Get, args: readonly unknown[]) => unknown[]> = {
  battleClickEntity: (get, [id, opts]) => [id, { ...(opts as object | undefined), approche: chargeArmee(get) }],
  battleClickTile: (get, [pt, opts]) => [pt, { ...(opts as object | undefined), courseArmee: courseArmee(get) }],
};

/** Args d'un intent, enrichis du verdict d'armement LOCAL quand l'action en demande un. */
export function argsAvecVerdictLocal(get: Get, action: string, args: readonly unknown[]): unknown[] {
  return INTENT_VERDICT_ARGS[action]?.(get, args) ?? [...args];
}
