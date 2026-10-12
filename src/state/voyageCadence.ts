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
 * Tests de ROUTE que des ORDRES COMMANDÉS résolvent d'office à la porte (`rollSeam.surfaceDesTenus`) —
 * LISTE FERMÉE (par `voyage.kind`), UNE pour les deux routes (mer, fleuve). Le jour commandé, lui, se joue
 * d'un bloc par `runCascadeImmediate` (`traverseeCommandee`) : seule une décision l'interrompt.
 * Mer : jets d'ÉQUIPAGE quotidiens (MDG 13 l.111) et Tests PERSONNELS de l'entretien-survie du bord
 * (MDG 13 l.203-225, 14 l.206-234). Fleuve : dé d'Exposition hydrique et son Test (MSRC 16 l.5-13).
 * L'Exposition y entre par le `kind` PROPRE à sa route (`sea-exposition`, `river-exposition`) : un ordre
 * de traversée ne commande ni la nuit de camp (`exposure`) ni un Effet de scène (`waterExposure`).
 * Ce qui réunit ces jets est l'ORDRE donné au départ, attendu validé en recette #1426 « Traversée
 * commandée sans fenêtre » (#1479).
 *
 * INTERROMPENT toujours (hors liste, donc fenêtre) : les CRISES (`poursuite`, `tourbillon`), l'`ouragan`
 * et l'`extermination`, l'`embuscade` ancrée, le `voyage-rapide`, et tout Test dont l'échec ouvre une
 * DÉCISION. Les urgences (`pendingSteamSave`), les événements de bord à choix, le conseil de bord,
 * l'atterrage et le combat sont des surfaces PROPRES : ils suspendent la boucle par eux-mêmes.
 */
export const KINDS_SOUS_ORDRES: ReadonlySet<string> = new Set([
  'progression', 'affaler', 'phare', 'orientation', 'entretien',
  'sea-tonneau-expose', 'sea-tonneau-contamine', 'sea-mal-de-mer', 'sea-scorbut', 'sea-exposition', 'sea-epuisement',
  'riverExposureChance', 'river-exposition',
]);

/** La traversée est-elle COMMANDÉE ? Régit le jour d'un bloc (`runCascadeImmediate`), mer comme fleuve. */
export function traverseeCommandee(orders: VoyageOrders | undefined): boolean {
  return orders?.cadence === 'commande';
}

/** Un Test de route de `kind` se résout-il d'office sous ces ordres ? (route COMMANDÉE + `kind` couvert). */
export function resoluSousOrdres(orders: VoyageOrders | undefined, kind: string): boolean {
  return traverseeCommandee(orders) && KINDS_SOUS_ORDRES.has(kind);
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
