/**
 * Tables d100 de VOYAGE (EDOC 7-8), en DONNÉE (`src/data/*.json`) — lookup partagé via `findTableEntry`.
 * Aucune table en dur : incidents de monte, problèmes de véhicule et rencontres vivent en JSON éditable.
 * Le tirage du d100 et l'application des effets restent à l'appelant (boucle de voyage).
 */
import { deDeLaTableTiree, findTableEntry, type DeDeTable } from './tables';
import incidentsMonteJson from '../data/incidents-monture.json';
import problemesVehiculeJson from '../data/problemes-vehicule.json';
import { deDeTirageDe, rangeesDe } from '../data/rangees';
import type * as incidentsDeMonte from '../data/schemas/defs/incidents-monture';
import type * as problemesDeVehicule from '../data/schemas/defs/problemes-vehicule';
import rencontresJson from '../data/rencontres-edoc.json';
import { datasetDe } from '../data/datasets';
import type * as rencontresDef from '../data/schemas/defs/rencontres-edoc';
import type * as mecanique from '../data/schemas/grammaire/mecanique';
import type { z } from 'zod';

/** Entrée d'une table de voyage (EDOC 07, EDOC 08) : sa fourchette d100, et ses suites (`mount`, `stageOutcome`,
 *  `vehicleWounds`, `occupantOps`). */
export type TravelTableEntry = z.output<(typeof mecanique)['travelTableEntrySchema']>;
/** Suite MÉCANIQUE d'un Incident de MONTE (EDOC 07 l.157-174), lue par `engine/mountTravel.ts`. */
export type MountIncidentEffects = NonNullable<TravelTableEntry['mount']>;

/** Incidents de monte (EDOC 07 l.150-155). */
export const MOUNT_INCIDENTS: TravelTableEntry[] = rangeesDe<typeof incidentsDeMonte>(incidentsMonteJson);
/** Problèmes de véhicule (EDOC 07 l.259-264). */
export const VEHICLE_PROBLEMS: TravelTableEntry[] = rangeesDe<typeof problemesDeVehicule>(problemesVehiculeJson);

/** Dé AUTHORÉ des Incidents de monte (`incidents-monture.json`, `die`), lu VIVANT à l'appel. */
export const mountIncidentDie = (): DeDeTable => deDeTirageDe<typeof incidentsDeMonte>(incidentsMonteJson);
/** Dé AUTHORÉ des Problèmes de véhicule (`problemes-vehicule.json`, `die`), lu VIVANT à l'appel. */
export const vehicleProblemDie = (): DeDeTable => deDeTirageDe<typeof problemesDeVehicule>(problemesVehiculeJson);

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
export type EncounterCategory = keyof (typeof RENCONTRES)['tables'];

const RENCONTRES = datasetDe<typeof rencontresDef>(rencontresJson);
/** Dé AUTHORÉ des Rencontres (`rencontres-edoc.json`, `die`), partagé par ses trois tables, lu VIVANT à l'appel. */
export const encounterDie = (): DeDeTable => deDeLaTableTiree(RENCONTRES);

export function encounterTable(category: EncounterCategory): TravelTableEntry[] {
  return RENCONTRES.tables[category];
}
export function rollEncounter(category: EncounterCategory, roll: number): TravelTableEntry {
  return findTableEntry(RENCONTRES.tables[category], roll);
}
