import { idsDeTest } from '../engine/idsDeTest.testkit';
import { describe, it, expect, beforeEach } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { applyEffects } from './combatEffects';
import { flowFromEffects } from './monde/flow';
import { createHero } from '../engine/character';
import type { Effect } from '../data/schemas/defs-scenes/effets';
import { blessuresDeBase } from '../engine/combattantDeTest.testkit';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });

/**
 * TRANCHE VERTICALE « zéro hardcode » : la bombe de « Une nuit à l'Opéra » composée UNIQUEMENT
 * d'Effets de scène en DONNÉES (Lot 0 `delayedEffect` + Lot 3 `inflictDamage`), pilotée par le banc
 * du noyau. Prouve que la mèche brûle puis explose au franchissement de l'horloge, et que poser le
 * `cancelFlag` (désamorçage) avant l'échéance annule l'explosion.
 */
describe('Tranche verticale — la bombe compose en données (Lot 0 + Lot 3)', () => {
  // 20:02 (comme à l'Opéra) ; un seul héros bien portant (PB > dégâts → pas d'À Terre parasite).
  beforeEach(() => banc.setState({ gameTime: 20 * 60 + 2 }));

  function lonePartyAt(wounds: number) {
    const h = createHero({ idNeuf: idsDeTest, speciesId: 'humains-reiklander', careerId: 'soldat', label: 'A', seed: 1 });
    h.wounds = blessuresDeBase(wounds, wounds, h);
    banc.setState({ party: [h] });
    return h;
  }

  // La bombe = un Effet PROGRAMMÉ (mèche d'1 h) qui applique le souffle ; désamorçable par flag.
  const bomb: Effect = {
    type: 'delayedEffect',
    afterMinutes: 60,
    cancelFlag: 'bombeDesamorcee',
    flow: flowFromEffects([{ type: 'ops', on: 'groupe', ops: [{ op: 'wounds', amount: 15 }] }]),
  };

  it('la mèche brûle puis explose : à 22h02 le groupe subit le souffle', () => {
    lonePartyAt(30);
    applyEffects(banc.getState, banc.setState, [bomb]);
    expect(banc.getState().scheduledEffects).toHaveLength(1);

    banc.getState().avancerLeTemps(59); // 21:01 — pas encore
    expect(banc.getState().party[0].wounds.current).toBe(30);

    banc.getState().avancerLeTemps(1); // 22:02 — franchit l'échéance
    expect(banc.getState().party[0].wounds.current).toBe(15);
    expect(banc.getState().scheduledEffects).toHaveLength(0);
  });

  it('désamorcée avant l’échéance : retrait du détonateur (cancelFlag) → pas d’explosion', () => {
    lonePartyAt(30);
    applyEffects(banc.getState, banc.setState, [bomb]);
    banc.setState({ flags: { bombeDesamorcee: true } }); // un Effet setFlag d'un autre trigger, ici simulé
    banc.getState().avancerLeTemps(120);
    expect(banc.getState().party[0].wounds.current).toBe(30);
    expect(banc.getState().scheduledEffects).toHaveLength(0); // consommée SANS s'appliquer
  });
});
