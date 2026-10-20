import { describe, it, expect } from 'vitest';
import { emitCombatEvent } from './combatEvents';
import { avecLesTables } from './noyau.testkit';
import type { Combatant } from '../engine/types';
import { desDuTest } from '../engine/dice.testkit';

/** Combattant nu (aucun effet de données) — pour vérifier que la diffusion data est INERTE sans donnée. */
const bare = (): Combatant => ({
  id: 'x', name: 'X', kind: 'enemy', characteristics: {}, skills: [], talents: [], traits: [],
  conditions: [], activeEffects: [], liveTraits: [], weapons: [], armour: [],
  wounds: { current: 10, max: 10, base: 10 }, advantage: 0,
}) as unknown as Combatant;

describe('emitCombatEvent — bus unique (machinerie PUIS données)', () => {
  it('joue les hooks MACHINERIE de l’événement via le bus', () => {
    const log: string[] = [];
    avecLesTables({ crochetsDeCombat: [{ id: 'evt-test-hook', phase: 'onMiscast', run: ({ sink }) => sink('machinerie') }] });
    emitCombatEvent('onMiscast', { triggerCtx: { rng: desDuTest },
      get: (() => ({ battle: undefined })) as never, set: (() => {}) as never,
      battle: {} as never, sink: (l) => log.push(l),
    });
    expect(log).toEqual(['machinerie']);
  });

  it('diffuse à `audience` ; une entité SANS effet ne produit AUCUNE ligne (inerte)', () => {
    const log: string[] = [];
    const c = bare();
    emitCombatEvent('onCombatStart', { triggerCtx: { rng: desDuTest },
      get: (() => ({ battle: { combatants: [c] } })) as never, set: (() => {}) as never,
      battle: { combatants: [c] } as never, sink: (l) => log.push(l), audience: [c],
    });
    expect(log).toEqual([]); // pas de hook onCombatStart déclaré + pas d'effet de données → no-op
  });

  it('sans audience ni self : no-op total', () => {
    let n = 0;
    emitCombatEvent('onTurnEnd', { triggerCtx: { rng: desDuTest },
      get: (() => ({})) as never, set: (() => {}) as never, battle: {} as never, sink: () => { n += 1; },
    });
    expect(n).toBe(0);
  });
});
