import { describe, it, expect, vi } from 'vitest';
import { useGame } from './state/store';
import { etatViergeDuStore } from './test-setup';

/**
 * CONTRAT de la remise à plat du store (`etatViergeDuStore`, `src/test-setup.ts`, #3503) : ses
 * ACTIONS comprises. Sous `isolate: false`, une action que le banc substitue (`vi.fn()`) se lèguerait
 * sinon à tous les fichiers suivants du worker.
 *
 * Les deux derniers `it` sont ORDONNÉS : le second mesure l'effet du `beforeEach` global sur le premier.
 */
const ACTIONS = Object.entries(useGame.getInitialState()).filter(([, v]) => typeof v === 'function');

/** Les actions du store qui ne sont plus celles de l'état initial. */
function actionsSubstituees(): string[] {
  const courant = new Map(Object.entries(useGame.getState()));
  return ACTIONS.filter(([k, v]) => courant.get(k) !== v).map(([k]) => k);
}

describe('remise à plat du store (test-setup) — les actions comprises', () => {
  it('toute action substituée revient à celle de l’état initial', () => {
    expect(ACTIONS.length).toBeGreaterThan(0);
    useGame.setState((s) => {
      const substitue = { ...s };
      for (const [k] of ACTIONS) Reflect.set(substitue, k, vi.fn());
      return substitue;
    });
    expect(actionsSubstituees()).toHaveLength(ACTIONS.length);
    useGame.setState(etatViergeDuStore());
    expect(actionsSubstituees()).toEqual([]);
  });

  it('un test substitue `jouerAction`…', () => {
    useGame.setState({ jouerAction: vi.fn() });
    expect(actionsSubstituees()).toEqual(['jouerAction']);
  });

  it('…et le SUIVANT retrouve la vraie : le `beforeEach` global l’a rendue', () => {
    expect(actionsSubstituees()).toEqual([]);
  });
});
