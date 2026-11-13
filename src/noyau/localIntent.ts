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
 * intent réseau à l'armement, seul le COMMIT du geste part), et `appliquerLInstantane` le préserve
 * (`LOCALES_AU_CLIENT`, `coop.ts`). Les POSTURES, elles, sont du JEU : elles vivent dans `battle`.
 *
 * Chaque action du registre qui arme une intention déclare, en donnée (`intent` de `actions.json`),
 * l'id de la PORTÉE que le champ doit peindre ; le code de cette portée vit ici, jamais en JSON.
 */
import type { Get } from './flowTypes';
import { computeChargeReach, computeRunReach, displayedReach } from './combatFlow';
import { ACTIONS, findActionById } from '../data/index';
import { unSiegeAgit } from './netOwnership';
import type { Jeu } from './etat';
import type { ActionDeClasse } from './intentionsDeSiege';
import { armerLOffre, refusDuGeste } from './actionRegistry';
import type { VerbesDeLaBarre } from './actionsDuNoyau';
import type { IdDIntention } from './designations';
import type { OptionsDuClic } from './targetingModes';
import type { PorteeDIntention } from '../data/schemas/defs/actions';

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
export const INTENT_REACH: Record<PorteeDIntention, ((get: Get<Jeu>) => Map<string, number>) | null> = {
  'portee-mouvement': (get) => displayedReach(get),
  'portee-course': null,
  'portee-charge': (get) => computeChargeReach(get),
  'portee-arme': null,
};

/** L'intention armée du PROPRIÉTAIRE du store, ou `null` quand un geste s'exécute au nom d'un AUTRE
 *  siège (`withActingSeat`) : celui-là n'a droit qu'à l'intention qu'il joint (`argsAvecIntentionLocale`),
 *  et une intention absente vaut « non armé ». Seule lecture de `localIntent` par le geste. */
export function intentionDuProprietaire(get: Get<Jeu>): LocalIntent | null {
  return unSiegeAgit() ? null : get().localIntent;
}

/** L'intention armée du propriétaire du store (`intentionDuProprietaire`) quand l'offre qui l'arme est le verbe
 *  `armerLIntention` (`IdDIntention`), ou `null` : celle qu'un clic porte. */
export function intentionLocale(get: Get<Jeu>): IdDIntention | null {
  const armed = intentionDuProprietaire(get);
  return armed && findActionById(armed.actionId)?.run === 'armerLIntention' ? armed.actionId : null;
}

/** Id de PORTÉE de l'offre `actionId` (`intent` de son action), ou `null` : la seule lecture par laquelle le champ et
 *  le clic apprennent ce qu'une intention arme. */
function porteeDeLIntention(actionId: string | null): PorteeDIntention | null {
  return (actionId ? findActionById(actionId)?.intent : undefined) ?? null;
}

/** Id de PORTÉE de l'intention armée du propriétaire (`intentionDuProprietaire`), ou `null`. */
export function armedIntentPortee(get: Get<Jeu>): PorteeDIntention | null {
  return porteeDeLIntention(intentionDuProprietaire(get)?.actionId ?? null);
}

/** Bande de cases à peindre pour l'intention ARMÉE — vide si aucune, si l'action ne déclare pas de
 *  portée, ou si sa portée n'a rien à montrer. Source UNIQUE du 3ᵉ `kind` de surbrillance. */
export function intentReach(get: Get<Jeu>): Map<string, number> {
  const portee = armedIntentPortee(get);
  const reach = portee ? INTENT_REACH[portee] : null;
  return reach ? reach(get) : new Map();
}

/** Portée d'ARME : l'intention qui délègue son affichage aux BANDES DE TIR existantes (`rangeBand`),
 *  au lieu d'ouvrir une 2ᵉ écriture de la même vérité. */
export const PORTEE_ARME = 'portee-arme' satisfies PorteeDIntention;

/** Portée de COURSE : même délégation, vers la ZONE DE COURSE du champ (`HighlightsView.runReach`,
 *  nature `run`). Depuis l'arbitrage du 2026-08-19 cette zone ne se peint plus d'office : elle est
 *  l'affordance de l'intention armée, et se peint EXACTEMENT quand cette intention l'est. */
export const PORTEE_COURSE = 'portee-course' satisfies PorteeDIntention;

/** L'intention `intentionId` débloque-t-elle la zone de COURSE (spec § 2026-08-19) ? Lue par le champ (peinture) sur
 *  l'intention locale, par le clic (commit) sur celle du clic (`intentionDuClic`). */
export function courseArmee(intentionId: IdDIntention | null): boolean {
  return porteeDeLIntention(intentionId) === PORTEE_COURSE;
}

/** Les PORTÉES que le champ peint au tour du joueur (`gameIso/stage/highlightLayer.tsx`) et qu'un hôte lit, l'armée
 *  d'abord : celle de l'intention armée (`intentReach`), la zone de Course quand elle est armée (`computeRunReach`), puis
 *  la Marche (`displayedReach`). Vides hors de son tour. */
export function porteesDuTour(get: Get<Jeu>, monTour: boolean): { intention: Map<string, number>; course: Map<string, number>; marche: Map<string, number> } {
  return {
    intention: monTour && get().localIntent ? intentReach(get) : new Map(),
    course: monTour && courseArmee(intentionLocale(get)) ? computeRunReach(get) : new Map(),
    marche: monTour ? displayedReach(get) : new Map(),
  };
}

/** L'intention `intentionId` arme-t-elle l'APPROCHE vers un ennemi (Charge, spec § 2026-08-19) ? */
export const PORTEE_CHARGE = 'portee-charge' satisfies PorteeDIntention;
export function chargeArmee(intentionId: IdDIntention | null): boolean {
  return porteeDeLIntention(intentionId) === PORTEE_CHARGE;
}

/**
 * L'intention d'un clic : celle qu'il désigne (`OptionsDuClic.intentionId`), sinon l'intention locale du propriétaire
 * (`intentionLocale`), son offre jugée dans l'état par le refus de son geste (`refusDuGeste` sur `armerLIntention`), comme
 * le verbe qui l'arme. Rend l'id admis (`null` : rien d'armé), ou la raison du refus.
 */
export function intentionDuClic(get: Get<Jeu>, opts?: OptionsDuClic): { intentionId: IdDIntention | null } | { refus: string } {
  const intentionId = opts?.intentionId ?? intentionLocale(get);
  if (!intentionId) return { intentionId };
  const verdict = refusDuGeste(get(), { verbe: 'armerLIntention', args: [intentionId] });
  return 'refus' in verdict ? verdict : { intentionId };
}

/**
 * INTENTION ARMÉE JOINTE AUX ARGS D'UN INTENT RÉSEAU, par action de clic.
 *
 * L'intention est LOCALE au client (hors snapshot, plus haut) : l'HÔTE qui exécute le clic d'un invité ne la lit pas
 * dans SON store (`intentionDuProprietaire`). L'émetteur joint donc l'id de l'intention qu'il a armée, et l'hôte la juge
 * dans son état (`intentionDuClic`).
 *
 * Table déclarative (jamais un `if (action === …)` au fil de l'émission) : une action de clic, la
 * façon d'enrichir SES args. Les intents absents d'ici voyagent inchangés.
 */
type JointDIntention = (get: Get<Jeu>, args: readonly unknown[]) => unknown[];
export const INTENTION_JOINTE_AUX_ARGS: Readonly<Record<string, JointDIntention>> = {
  cliquerLaCase: (get, args) => {
    const intentionId = intentionLocale(get);
    const [pt, entite, opts] = args as [unknown, unknown, OptionsDuClic | undefined];
    return intentionId ? [pt, entite, { ...opts, intentionId }] : [...args];
  },
} satisfies { readonly [A in ActionDeClasse<'invité'>]?: JointDIntention };

/**
 * CE QUE L'ÉMETTEUR PRÉPARE CHEZ LUI AVANT D'ENVOYER UN INTENT, par action de la classe invité.
 *
 * L'armement d'une intention est LOCAL au client (hors snapshot) : l'hôte qui joue le verbe de la barre d'un invité ne
 * l'arme pas (`armerLOffre`). Un verbe de la barre dont l'offre arme une intention (`attaque`) l'arme donc chez
 * l'émetteur, au geste, sur le refus de son geste dans son état (`refusDuGeste`), comme le verbe l'arme où il se joue.
 */
type PreparationLocale = (get: Get, args: readonly unknown[]) => void;
const armerChezLEmetteur = (verbe: keyof VerbesDeLaBarre): PreparationLocale => (get, args) => {
  const verdict = refusDuGeste(get(), { verbe, args: [...args] });
  if ('def' in verdict) armerLOffre(get, verdict.def);
};
export const INTENT_PREPARATION_LOCALE: Readonly<Record<string, PreparationLocale>> = Object.fromEntries(
  ACTIONS.flatMap((def) => (def.intent && def.run && def.run !== 'armerLIntention' ? [[def.run, armerChezLEmetteur(def.run as keyof VerbesDeLaBarre)]] : [])),
) satisfies { readonly [A in ActionDeClasse<'invité'>]?: PreparationLocale };

/** Prépare chez l'émetteur l'intent `action` qu'il envoie (`INTENT_PREPARATION_LOCALE`). */
export function preparerLIntentLocal(get: Get, action: string, args: readonly unknown[]): void {
  INTENT_PREPARATION_LOCALE[action]?.(get, args);
}

/** Args d'un intent, enrichis de l'intention armée LOCALE quand l'action en demande une (`INTENTION_JOINTE_AUX_ARGS`). */
export function argsAvecIntentionLocale(get: Get<Jeu>, action: string, args: readonly unknown[]): unknown[] {
  return INTENTION_JOINTE_AUX_ARGS[action]?.(get, args) ?? [...args];
}
