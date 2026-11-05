import type { GabaritResolu } from '../../../src/noyau/index.ts';

export const FACTEURS_NEUTRES: GabaritResolu = Object.freeze({ sl: 1, legs: 1, arms: 1, head: 1, st: 1 });

/** Vrai si chaque facteur de `facteurs` vaut le neutre de sa propre clé (`FACTEURS_NEUTRES`). */
export const sontNeutres = (facteurs: GabaritResolu): boolean =>
  Object.entries(facteurs).every(([cle, valeur]) => valeur === FACTEURS_NEUTRES[cle as keyof GabaritResolu]);
