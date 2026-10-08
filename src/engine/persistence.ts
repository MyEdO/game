/**
 * Persistance d'un combattant : ce qui entre du héros du groupe dans le combat, et ce qui en revient
 * (`REPORT_DE_COMBATTANT`, #2312). États persistants : LDB 16 (`etats.json`, `persistsAfterCombat`).
 */
import type { Combatant, ConditionInstance } from './types';
import { findConditionById } from '../data';
import { oublierCycleDeCharge } from './items';

/** Cet État suit-il le porteur hors du combat ? Drapeau DÉCLARÉ sur l'entrée d'`etats.json`
 *  (`EtatData.persistsAfterCombat`) : le moteur lit le champ, il n'énumère aucun id. Un État absent du
 *  catalogue (marqueur narratif sans entrée) est transitoire par défaut. */
export function isPersistentCondition(id: string): boolean {
  return findConditionById(id)?.persistsAfterCombat === true;
}

/**
 * Report d'un champ de `Combatant` entre le héros du groupe et son combattant (#2312) :
 * - `sort: true` : le combattant EST le héros pendant le combat ; sa valeur revient au groupe ;
 * - `sort: 'etats-persistants'` : seuls les États `persistsAfterCombat` reviennent, et entrent ;
 * - `sort: false` : propre à la rencontre ; le héros du groupe garde la sienne. `raison` : la réf nue de
 *   la règle, ou la raison d'ingénierie.
 * `entree` : la valeur posée à l'entrée en combat (`entreeEnRencontre`) ; absente, celle du groupe entre.
 * `sortie` : la transformation de la valeur qui revient au groupe (`carryOverState`) ; absente, elle revient telle quelle.
 */
export type Report<V = unknown> =
  | { sort: true; entree?: unknown; sortie?: (v: V) => V; raison?: string }
  | { sort: 'etats-persistants' }
  | { sort: false; raison: string; entree?: unknown };

const PERSISTE = { sort: true } as const;
const rencontre = (raison: string, entree?: unknown) => (entree === undefined ? { sort: false, raison } as const : { sort: false, raison, entree } as const);

const TOUR = 'compteur du tour ou du Round de combat';
const COQUE = 'coque, poste ou équipage d’un combat naval, jamais porté par un héros du groupe';
const POSITION = 'placement sur la grille de la rencontre';
const DERIVE = 'dérivé des `items`, re-dérivé à l’entrée (`recomputeLoadout`)';
const RELATION = 'relation à un autre combattant de la rencontre';

/** Table TOTALE des champs de `Combatant` (#2312) : un champ ajouté au type sans classement ne compile pas. */
export const REPORT_DE_COMBATTANT = {
  id: PERSISTE, label: PERSISTE, kind: PERSISTE, followsCharacterRules: PERSISTE, creatureId: PERSISTE, porteurDeFiche: PERSISTE,
  crewIds: rencontre(COQUE), postes: rencontre(COQUE), saboteurDR: rencontre(COQUE), cargoEnc: rencontre(COQUE),
  lastShantyQuart: rencontre(COQUE), singingShanty: rencontre('MDG 09 l.38'), upgrades: rencontre(COQUE), mannedPoste: rencontre(COQUE),
  teamCommanderId: rencontre('AA 13 l.29-35'),
  species: PERSISTE, career: PERSISTE, careerHistory: PERSISTE,
  offTerrain: rencontre(POSITION), size: PERSISTE, footprint: PERSISTE, bodyShape: PERSISTE,
  structureEdge: rencontre(COQUE), inert: rencontre(COQUE), aiControlled: rencontre('pilotage d’un allié PNJ de la rencontre'),
  causesPeur: PERSISTE, causesTerreur: PERSISTE, psychImmune: PERSISTE,
  psychState: rencontre('LDB 21 l.9'),
  groups: PERSISTE, aiDoctrine: PERSISTE, psychTraits: PERSISTE, briseFromTerreur: PERSISTE, traits: PERSISTE, liveTraits: PERSISTE, swarm: PERSISTE,
  mountId: rencontre('LDB 14 l.175-187'), riderId: rencontre('LDB 14 l.175-187'), mountable: PERSISTE,
  travelRole: PERSISTE, shipRole: PERSISTE, shipStation: PERSISTE,
  pendingFreeAttacks: rencontre(TOUR), chargedThisTurn: rencontre(TOUR), approachMoves: rencontre('LDB 21 l.27'),
  effortRounds: rencontre('LDB 16 l.97'), freeAttacksThisTurn: rencontre(TOUR), dispelledThisRound: rencontre('LDB 46 l.156'),
  characteristics: PERSISTE, wounds: PERSISTE,
  advantage: rencontre('LDB 14 l.219', 0),
  conditions: { sort: 'etats-persistants' },
  weapons: rencontre(DERIVE), armour: rencontre(DERIVE), encumbrance: rencontre(DERIVE),
  items: { sort: true, sortie: oublierCycleDeCharge, raison: 'LDB 62 l.335 ; #1678 P4' },
  skills: PERSISTE, talents: PERSISTE, loadouts: PERSISTE, activeLoadoutId: PERSISTE, barre: PERSISTE,
  spells: PERSISTE, componentSpells: PERSISTE, sinPoints: PERSISTE, masteredWeapons: PERSISTE,
  activeEffects: { sort: true, raison: 'LDB 46 l.93, CRB 070 l.27' }, castPenalties: PERSISTE,
  focus: rencontre('Focalisation en cours d’une incantation de la rencontre'),
  dispel: rencontre('cumul du Test étendu de Dissipation (LDB 46 l.158-162) mené pendant la rencontre'),
  craft: PERSISTE, ritual: PERSISTE, movement: PERSISTE,
  fate: PERSISTE, fortune: PERSISTE, resilience: PERSISTE, resolve: PERSISTE, resistanceUsed: PERSISTE,
  motivation: PERSISTE, star: PERSISTE, details: PERSISTE, criticalWounds: PERSISTE,
  tookCriticalThisFight: rencontre('LDB 20 l.90', false),
  critEntriesSuffered: PERSISTE,
  woundDressed: rencontre('LDB 09 l.260', false),
  traumas: PERSISTE, handGates: PERSISTE, corruption: PERSISTE, mutations: PERSISTE, damned: PERSISTE, nightmares: PERSISTE,
  diseases: PERSISTE, hunger: PERSISTE, thirst: PERSISTE, drunk: PERSISTE, diseaseImmunities: PERSISTE, residualDiseaseTestMod: PERSISTE,
  diseaseExposure: rencontre('LDB 20 l.25'),
  nextActionPenalty: rencontre('LDB 14 l.26'), loseNextAction: rencontre('LDB 14 l.28'), loseNextMovement: rencontre('LDB 14 l.27'), actLastNextRound: rencontre('LDB 14 l.25'),
  roundsAtZero: rencontre(TOUR, 0),
  suffocationCountdown: rencontre('LDB 18 l.346'), breathHoldSeconds: rencontre('LDB 18 l.346'),
  wateredThisRound: rencontre(TOUR),
  soinRencontreUtilise: { sort: true, entree: false, raison: 'LDB 09 l.260' },
  dead: PERSISTE, slainNotified: rencontre('garde d’unicité de l’émission `onSlain` dans la rencontre'), important: PERSISTE,
  outOfRencontre: rencontre('LDB 17 l.31'), exitReason: rencontre('LDB 17 l.31'),
  summon: rencontre('invocation liée à la rencontre (`summonFlow`)'),
  shotsThisTurn: rencontre(TOUR), pushbackMode: rencontre('LDB 62 l.272-274'), auraMods: rencontre('LDB 85 l.262'),
  xp: PERSISTE, charAdvances: PERSISTE, careerLevel: PERSISTE, careerSlotChoices: PERSISTE,
  pos: rencontre(POSITION), initiative: rencontre('Initiative de la rencontre'),
  gainedAdvThisRound: rencontre(TOUR), usedShieldReactionRound: rencontre(TOUR), distractedRounds: rencontre(TOUR),
  defensiveStance: rencontre(TOUR), dualStrikeDefensePenalty: rencontre(TOUR), aiming: rencontre(TOUR),
  envWeather: rencontre('EDOC 8 l.82'),
  engagedWith: rencontre(RELATION, []), meleeThisRound: rencontre(RELATION, []), attackedThisRound: rencontre(RELATION),
  contactWith: rencontre(RELATION), grapplingWith: rencontre(RELATION),
  appearance: PERSISTE, appearanceOverride: PERSISTE,
} satisfies { [K in keyof Combatant]-?: Report<Combatant[K]> };

const CHAMPS = Object.entries(REPORT_DE_COMBATTANT) as [keyof Combatant, Report][];

/** États persistants seuls. Copie défensive. */
function persistentConditions(c: Combatant): ConditionInstance[] {
  return c.conditions.filter((x) => isPersistentCondition(x.id)).map((x) => ({ ...x }));
}

/** Couture de RETOUR (fin de combat, `finalizeBattle`) : tout ce qui sort du combattant vers le héros du
 *  groupe, selon `REPORT_DE_COMBATTANT`. Copie défensive. */
export function carryOverState(c: Combatant): Partial<Combatant> {
  const out: Record<string, unknown> = {};
  for (const [cle, r] of CHAMPS) {
    if (r.sort === 'etats-persistants') out[cle] = persistentConditions(c);
    else if (r.sort) out[cle] = r.sortie ? r.sortie(structuredClone(c[cle])) : structuredClone(c[cle]);
  }
  return out as Partial<Combatant>;
}

/** Couture d'ENTRÉE (`startCombat`) : le combattant né du héros du groupe, selon `REPORT_DE_COMBATTANT`.
 *  Copie défensive ; la position reste à poser par l'appelant. */
export function entreeEnRencontre(h: Combatant): Combatant {
  const c = structuredClone(h);
  const champs = c as unknown as Record<string, unknown>;
  for (const [cle, r] of CHAMPS) {
    if (r.sort === 'etats-persistants') champs[cle] = persistentConditions(h);
    else if (r.entree !== undefined) champs[cle] = structuredClone(r.entree);
  }
  return c;
}
