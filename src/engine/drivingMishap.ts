/**
 * Accidents de Conduite d'attelage EN SCÈNE (Livre de base, Compétences, LDB 09 l.140-149). « Un Échec
 * Stupéfiant à un Test de Conduite d'attelage signifie que quelque chose de grave s'est produit. Faites
 * un lancer sur le tableau suivant » — 1d10 :
 *   1-2 Harnais cassé · 3-5 Cahots (1 PB aux passagers) · 6-8 Roue brisée (2 roues → Accidenté auto)
 *   · 9-10 Essieu cassé (Accidenté). « Accident : les occupants … subissent généralement 2d10 Points de
 *   Blessure modifiées par le Bonus d'Endurance et les PA, sauf si le véhicule roulait doucement. »
 *
 * DISTINCT du sous-système EDOC « Problèmes de véhicule » (`data/problemes-vehicule.json`, table d100
 * déclenchée par un ALLURE FORCÉE en VOYAGE longue distance) : ici c'est le fiasco EN SCÈNE d'une
 * Conduite d'attelage ratée de façon spectaculaire (poursuite, manœuvre, terrain — LDB 09), avec sa
 * propre table 1d10. Aucune duplication : deux axes RAW (in-scene vs voyage) et deux tables sources.
 * PUR : RNG injecté ; ne mute rien.
 */
import { RNG, d10 } from './dice';
import { findTableEntry } from './tables';
import drivingMishapJson from '../data/driving-mishap.json';

export type DrivingMishapOutcome = 'harness' | 'jolt' | 'wheel' | 'crash';
/** Entrée du Tableau des accidents de Conduite d'attelage — MÊME schéma que `driving-mishap.json::entries`
 *  (exportée pour l'exposition Codex, #422 : `data/overrides.ts` la réutilise pour typer la table live). */
export interface MishapEntry { id: string; min: number; max: number; label: string; outcome: DrivingMishapOutcome; desc: string }
const MISHAP_TABLE = (drivingMishapJson as { entries: MishapEntry[] }).entries;

/** 1d10 sur le Tableau des accidents de Conduite d'attelage (LDB 09 l.142). Renvoie l'entrée + le dé. */
export function rollDrivingMishap(rng: RNG): { roll: number; entry: MishapEntry } {
  const roll = d10(rng);
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
