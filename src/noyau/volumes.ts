/**
 * Le MIXAGE (#3949, #4081) — préférences de confort, en valeur pure : ce module FEUILLE porte le volume de chaque canal
 * (`CANAUX_DE_SON`) et la coupure de tout le son, `noyau/preferences.ts` la table, `hote/preferences.ts` la
 * persistance, chaque hôte l'effet qu'il déclare. Même partage que `engine/cadence.ts`.
 *
 * SEULE source de vérité du volume d'un canal et de la coupure : un hôte lit `volumeDuCanal` et `sonCoupe` à chaque son
 * qu'il joue.
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

/** Le son est-il coupé tant que le joueur ne l'a pas réglé. */
export const SON_COUPE_DEFAUT = false;

let coupe = SON_COUPE_DEFAUT;

/** Tout le son est-il coupé. */
export const sonCoupe = (): boolean => coupe;

/** Écrit la coupure de tout le son — table des préférences : `noyau/preferences.ts`. */
export function couperLeSon(valeur: boolean): void {
  coupe = valeur;
}
