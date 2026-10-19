/**
 * RNG de combat — seedable (déterminisme des tests + future coop réseau). Module partagé par le
 * store et les modules de flux (combat/magie/IA…) : tous tirent du MÊME générateur via `battleRng()`,
 * réensemencé par `seedBattleRng` (action `store.seedRng`).
 */
import { RNG, makeRNG } from '../engine/dice';

let _rng: RNG = makeRNG(Date.now() & 0xffff);

/** Le RNG de combat courant. */
export function battleRng(): RNG {
  return _rng;
}

/** Réensemence le RNG de combat (tests déterministes, coop réseau). */
export function seedBattleRng(seed: number): void {
  _rng = makeRNG(seed);
}
