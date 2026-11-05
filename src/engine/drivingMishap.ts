/**
 * Accidents de Conduite d'attelage EN SCÈNE — LDB 09 l.140-149, table `driving-mishap.json` (dé `die`).
 *
 * DISTINCT des « Problèmes de véhicule » de VOYAGE (`data/problemes-vehicule.json`, EDOC) : deux axes
 * RAW et deux tables sources. PUR : RNG injecté ; ne mute rien.
 */
import { RNG, d10, rollDice } from './dice';
import { findTableEntry } from './tables';
import drivingMishapJson from '../data/driving-mishap.json';
import { deDeTirageDe, rangeesDe, type RangeeDe } from '../data/rangees';
import type * as accidents from '../data/schemas/defs/driving-mishap';

/** Entrée du Tableau des accidents de Conduite d'attelage. */
type MishapEntry = RangeeDe<typeof accidents>;
export type DrivingMishapOutcome = MishapEntry['outcome'];
/** Le Tableau VIVANT — la collection que le Codex édite (`drivingMishap`, `data/overrides.ts`). */
export const MISHAP_TABLE = rangeesDe<typeof accidents>(drivingMishapJson);

/** Tirage sur le Tableau des accidents de Conduite d'attelage (LDB 09 l.142). Renvoie l'entrée + le dé. */
export function rollDrivingMishap(rng: RNG): { roll: number; entry: MishapEntry } {
  const roll = rollDice(deDeTirageDe<typeof accidents>(drivingMishapJson), rng);
  return { roll, entry: findTableEntry(MISHAP_TABLE, roll) };
}

/** Un véhicule ACCIDENTÉ (Essieu cassé 9-10, ou Roue brisée sur un 2-roues) inflige-t-il les Dégâts ?
 *  `twoWheeler` = un véhicule à deux roues (Roue brisée → Accidenté automatique, l.146). */
export function mishapCausesCrash(outcome: DrivingMishapOutcome, twoWheeler = false): boolean {
  return outcome === 'crash' || (outcome === 'wheel' && twoWheeler);
}

/** Dégâts d'ACCIDENT à UN occupant (LDB 09 l.149) : 2d10 réduits par le Bonus d'Endurance ET les PA,
 *  min 0 — « sauf si le véhicule roulait doucement » (à la discrétion : `slow` annule les Dégâts). Pur. */
export function drivingAccidentDamage(be: number, pa: number, rng: RNG, slow = false): number {
  if (slow) return 0;
  return Math.max(0, d10(rng) + d10(rng) - be - pa);
}
