/**
 * Les VOLUMES des canaux du mixage (#3949) — préférences de confort, en valeur pure : ce module FEUILLE porte la
 * valeur de chaque canal (`CANAUX_DE_SON`), `noyau/preferences.ts` la table, `hote/preferences.ts` la persistance,
 * chaque hôte l'effet qu'il déclare. Même partage que `engine/cadence.ts`.
 *
 * SEULE source de vérité du volume d'un canal : un hôte lit `volumeDuCanal` à chaque son qu'il joue.
 */
import { CANAUX_DE_SON, type CanalDeSon } from '../data/sons/types';
import { tableTotale } from '../lib/tableTotale';

/** Volume d'un canal tant que le joueur ne l'a pas réglé (0..1). */
export const VOLUME_DEFAUT = 1;

const courants = tableTotale(CANAUX_DE_SON, () => VOLUME_DEFAUT);

/** Volume courant du canal `canal` (0..1). */
export const volumeDuCanal = (canal: CanalDeSon): number => courants[canal];

/** Écrit le volume du canal `canal` — table des préférences : `noyau/preferences.ts`. */
export function reglerLeVolume(canal: CanalDeSon, volume: number): void {
  courants[canal] = volume;
}
