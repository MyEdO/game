/**
 * RNG de combat — seedable (déterminisme des tests + future coop réseau). Module partagé par le
 * store et les modules de flux (combat/magie/IA…) : tous tirent du MÊME générateur via `battleRng()`,
 * réensemencé par `seedBattleRng` (action `store.seedRng`).
 */
import { RNG, makeRNG } from '../engine/dice';
import type { Get, Set } from './flowTypes';
import type { ActionsDuNoyau } from './actionsDuNoyau';

/** Le RNG de combat que l'hôte a semé (`seedBattleRng` : `creerPartie`, le store au chargement), ou `null`. */
let _rng: RNG | null = null;

/** Le RNG de combat courant. */
export function battleRng(): RNG {
  if (!_rng) throw new Error('RNG de combat absent : l’hôte le sème par `seedBattleRng` (src/noyau/battleRng.ts) avant tout tirage.');
  return _rng;
}

/** Réensemence le RNG de combat (tests déterministes, coop réseau). */
export function seedBattleRng(seed: number): void {
  _rng = makeRNG(seed);
}

export function creerActionsDesDes(_get: Get, _set: Set) {
  return {
    seedRng: (seed) => {
      seedBattleRng(seed);
    },
  } satisfies Partial<ActionsDuNoyau>;
}
