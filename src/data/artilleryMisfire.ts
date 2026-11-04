import artilleryMisfireJson from './artillery-misfire.json';
import { parseDiceRequired } from '../engine/dice';
import { rangeesDe, type RangeeDe } from './rangees';
import type * as incidentsDeSalve from './schemas/defs/artillery-misfire';

const de = parseDiceRequired(artilleryMisfireJson.die, 'artillery-misfire.die');
if (de.n !== 1 || (de.plus ?? 0) !== 0) throw new Error(`artillery-misfire.die exige un dé unique sans modificateur : ${artilleryMisfireJson.die}`);
export const ARTILLERY_MISFIRE_DIE = de;

/**
 * Incidents de Tir d'Artillerie par Salve — Aux Armes « Salve » (AA 10 l.270-277), transcrits
 * verbatim. Table DISTINCTE de l'Incident de tir GÉNÉRIQUE (LDB, `oups.json`/`oupsMisfire`) et de la
 * table de Critiques de Structure (`structure-criticals.json`) : elle ne se tire QU'EN PLUS, quand une
 * arme dotée de l'Atout *Salve* subit un Incident de tir (AA 10 l.264).
 *
 * Champs :
 *  - `location` : `brasPrincipal` (lignes 1-4) ou `random` (lignes 5-10).
 *  - `perSalveIndex` : l'effet se répète une fois PAR Indice de Salve restant (lignes 8-10).
 *  - `destroyed` : la pièce d'artillerie est détruite (lignes 1-9).
 *  - `strayFire` : ligne 10, « tir perdu » — pas de Dégâts directs à l'équipe, effet sur le terrain
 *    (journalisé verbatim en `note`, comme les effets sur les PERSONNES de `structure-criticals.json`).
 */
export type ArtilleryMisfireEntry = RangeeDe<typeof incidentsDeSalve>;

export const ARTILLERY_MISFIRE = rangeesDe<typeof incidentsDeSalve>(artilleryMisfireJson);
