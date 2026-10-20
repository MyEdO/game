import { describe, it, expect, afterEach } from 'vitest';
import { runCombatHooks, type CombatHookCtx } from './combatHooks';
import { avecLesTables } from './noyau.testkit';
import { setRule, resetRule } from '../engine/policy';

/** Contexte minimal : les hooks de test n'utilisent que `sink`/des effets de bord locaux. */
const ctx = (): CombatHookCtx => ({ get: (() => {}) as never, set: (() => {}) as never, battle: {} as never, sink: () => {} });

describe('combatHooks — hooks de cycle de vie posés (`TablesDuJeu.crochetsDeCombat`)', () => {
  afterEach(() => resetRule('combat-frappe-mortelle'));

  it('exécute les hooks d’une phase dans l’ordre `order` croissant', () => {
    const seen: string[] = [];
    avecLesTables({ crochetsDeCombat: [
      { id: 't-b', phase: 'onTurnStart', order: 20, run: () => seen.push('b') },
      { id: 't-a', phase: 'onTurnStart', order: 10, run: () => seen.push('a') },
      { id: 't-c', phase: 'onTurnStart', order: 15, run: () => seen.push('c') },
    ] });
    runCombatHooks('onTurnStart', ctx());
    expect(seen).toEqual(['a', 'c', 'b']);
  });

  it('enabledIf : un hook gardé par une règle optionnelle INACTIVE est sauté', () => {
    let ran = false;
    avecLesTables({ crochetsDeCombat: [{ id: 't-gated', phase: 'onCombatEnd', enabledIf: 'combat-frappe-mortelle', run: () => { ran = true; } }] });
    runCombatHooks('onCombatEnd', ctx()); // règle off par défaut
    expect(ran).toBe(false);
    setRule('combat-frappe-mortelle', true);
    runCombatHooks('onCombatEnd', ctx());
    expect(ran).toBe(true);
  });

  it('un hook sans enabledIf est toujours actif', () => {
    let ran = false;
    avecLesTables({ crochetsDeCombat: [{ id: 't-always', phase: 'onCastResolved', run: () => { ran = true; } }] });
    runCombatHooks('onCastResolved', ctx());
    expect(ran).toBe(true);
  });
});
