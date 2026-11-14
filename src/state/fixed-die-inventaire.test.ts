import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { useGame } from './store';
import { setDesFixes, resetDesFixes } from '../engine/fixedDie';
import { rowForcedDie } from '../ui/forcedDieRow';
import { FIXTURES, FLUX, FOE, HERO } from '../noyau/inventaireDuDeFixe.testkit';

/**
 * LIAISON de l'option « Dés fixés » : pour CHAQUE flux portant `imposerLeResultat`, la rangée du store offre le champ
 * « dé fixé » (`rowForcedDie`). La règle du socle (dé PERDANT, valeur appliquée, dé choisi de la Résilience) se joue
 * au banc du noyau, `src/noyau/fixed-die-inventaire.hors-store.test.ts`, sur les mêmes fixtures.
 */
beforeEach(() => {
  resetDesFixes();
  useGame.setState({
    party: [HERO],
    battle: { combatants: [HERO, FOE], log: [], order: ['H', 'E'], turn: 0, round: 1 } as never,
    net: { mode: 'local', mySeat: 0, roomCode: null, seatNames: {}, presence: {}, ownership: {} } as never,
  });
});
afterEach(() => resetDesFixes());

describe('socle du dé fixé — la rangée du store offre le champ', () => {
  for (const k of FLUX) {
    it(`${k} — la rangée offre le champ « dé fixé »`, () => {
      const f = FIXTURES[k]!;
      setDesFixes(true);
      useGame.setState(f.state as never);
      // L'affordance existe VRAIMENT pour ce flux (le champ est rendu).
      const die = rowForcedDie(useGame.getState(), k, { actor: HERO, rolled: true, key: f.pid } as never, true);
      expect(die.forcedRoll?.fixed, `${k} : aucun champ « dé fixé » offert`).toBe(true);
    });
  }
});
