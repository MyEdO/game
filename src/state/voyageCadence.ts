/**
 * CADENCE de VOYAGE — couche PARTAGÉE mer (`seaVoyageFlow`) ⇄ fluvial (`riverVoyageFlow`) : ordres
 * permanents fixés au départ + politique d'interruption (liste FERMÉE) + accumulation du PROCÈS-VERBAL
 * du jour. Ce n'est PAS une feature « mer » : c'est UNE couche que les deux boucles consomment. Elle ne
 * possède NI la boucle de jours NI la résolution des jets — seulement le régime (auto vs modale par jet)
 * et la brique d'entrée du PV.
 *
 * Doctrine : « aucun jet silencieux ». La route COMMANDÉE ne supprime pas des TRACES, seulement des
 * INTERRUPTIONS — chaque jet de ROUTINE auto-résolu laisse sa ligne au PV DU JOUR (l'auto-pilote pilote
 * LE MÊME flux de jet, jamais un `rollTest` inline). Décision requise = modale/cascade ; routine = PV.
 */
import type { NightEntry } from './restFlow';
import type { RollBreakdown } from '../engine/combat';
import type { CascadeStep } from './pendings';
import type { StakeRef } from '../data';

/** COMMANDÉE : les Tests d'équipage de ROUTINE s'auto-résolvent (leurs lignes au PV) ; seules les
 *  décisions interrompent. JOUR-PAR-JOUR : chaque jet ouvre sa modale. */
export type VoyageCadence = 'commande' | 'jour-par-jour';

/** Ordres permanents d'une traversée, fixés au départ et persistés avec le `TravelPlan`. */
export interface VoyageOrders {
  cadence: VoyageCadence;
}

/** Ordres par DÉFAUT d'un `TravelPlan` construit sans cadence explicite — SOURCE UNIQUE, consommée par
 *  `buildSeaPlan`, `buildRiverPlan`, `setVoyageCadence` et le sélecteur de départ de `WorldMapView` (aucune copie en dur du littéral ailleurs). */
export const DEFAULT_VOYAGE_ORDERS: VoyageOrders = { cadence: 'commande' };

/**
 * Tests de mer que des ORDRES COMMANDÉS résolvent d'office — LISTE FERMÉE (par `voyage.kind`).
 * Deux familles, un seul régime : les jets d'ÉQUIPAGE quotidiens sans décision (Progression / Affaler
 * (météo) / Phare / Orientation / Entretien) et les Tests PERSONNELS de l'entretien-survie du bord
 * (tonneau d'eau, mal de mer, scorbut, exposition, épuisement — MDG 13 l.111/203-225, 14 l.206-234).
 * L'Exposition de MER y entre par SON kind (`sea-exposition`, patron `sea-ouragan-affaler`) : la règle
 * est celle de la nuit (LDB 18 l.326-334, même applier), la ROUTE ne l'est pas — un ordre de traversée
 * ne commande pas l'Exposition d'une nuit de camp ni celle d'un effet de scène (`exposure`).
 * Ces derniers n'ont rien d'une « routine d'équipage » : ce qui les réunit ici est l'ORDRE donné au
 * départ (« cap tenu, ne me réveillez pas »), attendu validé en recette #1426 « Traversée commandée
 * sans fenêtre » — d'où le nom de la politique, qui dit l'ordre et non la nature du jet (#1479).
 *
 * INTERROMPENT toujours (hors liste, donc fenêtre) : les CRISES (`poursuite`, `tourbillon`), l'`ouragan`
 * et l'`extermination` (conséquences d'un événement de bord), l'`embuscade` ancrée, le `voyage-rapide`,
 * et tout Test dont l'échec ouvre une DÉCISION. Les urgences (voie d'eau / feu = Fuite de vapeur →
 * `pendingSteamSave`), les événements de bord à choix, le conseil de bord, l'atterrage (événement de
 * port) et le combat (abordage) sont des surfaces PROPRES : ils suspendent la boucle par eux-mêmes.
 */
export const SEA_KINDS_SOUS_ORDRES: ReadonlySet<string> = new Set([
  'progression', 'affaler', 'phare', 'orientation', 'entretien',
  'sea-tonneau-expose', 'sea-tonneau-contamine', 'sea-mal-de-mer', 'sea-scorbut', 'sea-exposition', 'sea-epuisement',
]);

/** Un Test de mer de `kind` se résout-il d'office sous ces ordres ? (route COMMANDÉE + `kind` couvert). */
export function seaAutoResolves(orders: VoyageOrders | undefined, kind: string): boolean {
  return orders?.cadence === 'commande' && SEA_KINDS_SOUS_ORDRES.has(kind);
}

/** Étapes du jour FLUVIAL de ROUTINE (patron `SEA_KINDS_SOUS_ORDRES`) — LISTE FERMÉE : Réparation de
 *  gréement/Agilité de rame/Navigation/Louvoyage/sauvegardes de vent, jets déterministes SANS décision.
 *  `riverPerilCheck` (péril de rivière) en est exclu : sa CONSÉQUENCE peut ESCALADER en CHOIX joueur
 *  (Barrage — `riverObstacleChoice`, l.128), inconnu tant que le péril n'a pas été vérifié (chance
 *  d'auteur tirée à l'application) — une journée qui en porte un force l'INTERACTIF (#351, patron
 *  `seaDayAllRoutine` : toute décision potentielle bascule le jour ENTIER en cascade interactive). */
export const RIVER_ROUTINE_KINDS: ReadonlySet<string> = new Set([
  'riverControlRepair', 'riverAgility', 'riverNav', 'riverTack', 'riverCapsize', 'riverRigging',
]);

/** Une journée FLUVIALE de ROUTINE s'auto-résout-elle ? (route COMMANDÉE + AUCUNE étape hors
 *  `RIVER_ROUTINE_KINDS` — la cascade du jour se joue d'un bloc, sans modale par jet ; #91, filtre #351). */
export function riverAutoResolves(orders: VoyageOrders | undefined, steps: readonly CascadeStep[]): boolean {
  return orders?.cadence === 'commande' && steps.every((s) => RIVER_ROUTINE_KINDS.has(s.kind));
}

/** Brique d'ENTRÉE du PV du jour (une ligne du procès-verbal, rendue par `MultiRollList`). Source unique
 *  de la forme d'entrée pour les jours de voyage — mer comme fleuve accumulent les mêmes `NightEntry`. */
export function voyageDayEntry(opts: {
  id: string;
  actorId?: string;
  label: string;
  icon?: string;
  d?: RollBreakdown;
  text?: string;
  tone?: NightEntry['tone'];
  /** Rubrique commune des lignes d'une même étape (rendue en UNE bande par `MultiRollList`). */
  group?: string;
  /** ENJEU de l'ÉTAPE dont la ligne est issue (`CascadeStep.stake`) — recopié TEL QUEL, jamais
   *  reconstruit : le PV dit ce que le jet mettait en jeu, sans que l'auteur du PV l'écrive. */
  stake?: StakeRef;
}): NightEntry {
  return { id: opts.id, actorId: opts.actorId, label: opts.label, icon: opts.icon, d: opts.d, text: opts.text, tone: opts.tone, group: opts.group, ...(opts.stake ? { stake: opts.stake } : {}) };
}
