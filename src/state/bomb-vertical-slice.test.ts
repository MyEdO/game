import { describe, it, expect, beforeEach } from 'vitest';
import { useGame } from './store';
import { applyEffects } from './combatEffects';
import { flowFromEffects } from './flow';
import { createHero } from '../engine/character';
import type { Effect } from './scene';

/**
 * TRANCHE VERTICALE « zéro hardcode » : la bombe de « Une nuit à l'Opéra » composée UNIQUEMENT
 * d'Effets de scène en DONNÉES (Lot 0 `delayedEffect` + Lot 3 `inflictDamage`), pilotée par le VRAI
 * store. Prouve que la mèche brûle puis explose au franchissement de l'horloge, et que poser le
 * `cancelFlag` (désamorçage) avant l'échéance annule l'explosion.
 */
describe('Tranche verticale — la bombe compose en données (Lot 0 + Lot 3)', () => {
  // 20:02 (comme à l'Opéra) ; un seul héros bien portant (PB > dégâts → pas d'À Terre parasite).
  beforeEach(() => useGame.setState({ battle: null, flags: {}, scheduledEffects: [], gameTime: 20 * 60 + 2 }));

  function lonePartyAt(wounds: number) {
    const h = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'A', seed: 1 });
    h.wounds = { current: wounds, max: wounds };
    useGame.setState({ party: [h] });
    return h;
  }

  // La bombe = un Effet PROGRAMMÉ (mèche d'1 h) qui applique le souffle ; désamorçable par flag.
  const bomb: Effect = {
    type: 'delayedEffect',
    afterMinutes: 60,
    cancelFlag: 'bombeDesamorcee',
    flow: flowFromEffects([{ type: 'ops', on: 'party', ops: [{ op: 'wounds', amount: 15 }] }]),
  };

  it('la mèche brûle puis explose : à 22h02 le groupe subit le souffle', () => {
    lonePartyAt(30);
    applyEffects(useGame.getState, useGame.setState, [bomb]);
    expect(useGame.getState().scheduledEffects).toHaveLength(1);

    useGame.getState().advanceTime(59); // 21:01 — pas encore
    expect(useGame.getState().party[0].wounds.current).toBe(30);

    useGame.getState().advanceTime(1); // 22:02 — franchit l'échéance
    expect(useGame.getState().party[0].wounds.current).toBe(15);
    expect(useGame.getState().scheduledEffects).toHaveLength(0);
  });

  it('désamorcée avant l’échéance : retrait du détonateur (cancelFlag) → pas d’explosion', () => {
    lonePartyAt(30);
    applyEffects(useGame.getState, useGame.setState, [bomb]);
    useGame.setState({ flags: { bombeDesamorcee: true } }); // un Effet setFlag d'un autre trigger, ici simulé
    useGame.getState().advanceTime(120);
    expect(useGame.getState().party[0].wounds.current).toBe(30);
    expect(useGame.getState().scheduledEffects).toHaveLength(0); // consommée SANS s'appliquer
  });
});
