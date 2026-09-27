/**
 * Tables d100 de VOYAGE (EDOC 7-8), en DONNÉE (`src/data/*.json`) — lookup partagé via `findTableEntry`.
 * Aucune table en dur : incidents de monte, problèmes de véhicule et rencontres vivent en JSON éditable.
 * Le tirage du d100 et l'application des effets restent à l'appelant (boucle de voyage).
 */
import { findTableEntry } from './tables';
import type { StageOutcome } from './activities';
import type { Difficulty } from './types';
import type { RefDesignee } from '../data/schemas/grammaire/ref';
import incidentsMonteJson from '../data/incidents-monture.json';
import problemesVehiculeJson from '../data/problemes-vehicule.json';
import rencontresJson from '../data/rencontres-edoc.json';

/** Suite MÉCANIQUE d'un Incident de MONTE (`incidents-monture.json`, EDOC 07 l.157-174) DÉCLARÉE par
 *  l'entrée : ce que le cavalier risque au moment de l'incident, et la SÉQUELLE que la bête garde.
 *  Lue par `engine/mountTravel.ts` (résolution, allure effective, montabilité) et par le flux de
 *  voyage (soins d'étape) — jamais déduite de l'id de l'entrée. */
export interface MountIncidentEffects {
  /** Test du CAVALIER, sous peine d'une chute de `fallM` mètres (l.166/l.171). */
  riderTest?: { skill: RefDesignee; char?: string; difficulty: Difficulty; fallM: number };
  /** Modificateur PERSISTANT aux Tests de Chevaucher tant que la séquelle dure (l.174 : −20). */
  ridingPenalty?: number;
  /** Allure MAXIMALE imposée à la bête tant que la séquelle dure (Perte d'un fer : le pas). */
  forcedAllure?: 'pas' | 'trot' | 'galop';
  /** La bête ne peut plus être montée ni attelée (Boiteux, Patte brisée). */
  preventsMount?: boolean;
  /** Les soins d'une halte n'effacent PAS cette séquelle (Patte brisée). */
  notHealedByCare?: boolean;
  /** CONDITION DE FIN posée par le `text` verbatim de l'entrée (« jusqu'à réparation de la sellerie »,
   *  « jusqu'au remplacement du fer par un maréchal-ferrant ») — fragment d'AFFICHAGE accolé à la ligne
   *  de séquelle par le gabarit du catalogue, jamais une mécanique. */
  endCondition?: string;
  /** ISSUE de la bête quand le `desc` verbatim en pose une (Patte brisée) — fragment d'AFFICHAGE. */
  outcome?: string;
}

/** Entrée d'une table de voyage : fourchette d100 `[min,max]` (00 = 100) + libellé/texte RAW.
 *  `stageOutcome` : effet de portée Étape (cf. `StageOutcome`). `vehicleWounds` : Dégâts au VÉHICULE
 *  (`Combatant` à coque) en notation de dés (« 1d10 »/« 2d10 ») — premier crochet du véhicule-à-PV. */
export interface TravelTableEntry {
  min: number;
  max: number;
  id: string;
  label: string;
  desc: string;
  /** Incidents de MONTE seuls : la séquelle et le risque déclarés par l'entrée. */
  mount?: MountIncidentEffects;
  stageOutcome?: StageOutcome;
  vehicleWounds?: string | null;
  /** Dégâts aux OCCUPANTS du véhicule, en langue unique `GameOp` (EDOC 07 : Cassé = 1 Blessure ignorant
   *  BE et PA ; Accident = 2d10 Blessures modifiées par BE et PA, min 1). Appliqués par le flux de voyage. */
  occupantOps?: import('./ops').GameOp[];
}

interface TravelTable { id: string; label: string; die: string; source: { book: string; page: number }; entries: TravelTableEntry[] }

/** Incidents de monte (EDOC 07 l.150-155). */
export const MOUNT_INCIDENTS = (incidentsMonteJson as TravelTable).entries;
/** Problèmes de véhicule (EDOC 07 l.259-264). */
export const VEHICLE_PROBLEMS = (problemesVehiculeJson as TravelTable).entries;

export function rollMountIncident(roll: number): TravelTableEntry {
  return findTableEntry(MOUNT_INCIDENTS, roll);
}
/** SÉQUELLE déclarée par l'Incident de monte d'id `injuryId` (l'état persistant `mountInjury` d'une
 *  Possession EST l'id de son incident) — lookup par id STABLE, jamais un branchement. */
export function mountIncidentEffects(injuryId: string | undefined): MountIncidentEffects | undefined {
  return injuryId ? MOUNT_INCIDENTS.find((e) => e.id === injuryId)?.mount : undefined;
}
export function rollVehicleProblem(roll: number): TravelTableEntry {
  return findTableEntry(VEHICLE_PROBLEMS, roll);
}

/** Catégorie de Rencontre de voyage (EDOC 8 l.186-233) — déclenchée par la qualité du Test d'Activité. */
export type EncounterCategory = 'positives' | 'fortuites' | 'dangereuses';

const ENCOUNTERS = (rencontresJson as { tables: Record<EncounterCategory, TravelTableEntry[]> }).tables;

export function encounterTable(category: EncounterCategory): TravelTableEntry[] {
  return ENCOUNTERS[category];
}
export function rollEncounter(category: EncounterCategory, roll: number): TravelTableEntry {
  return findTableEntry(ENCOUNTERS[category], roll);
}
