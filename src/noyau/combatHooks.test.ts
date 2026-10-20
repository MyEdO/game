import { describe, it, expect, afterEach } from 'vitest';
import { registerCombatHook, runCombatHooks, combatHooksOf, type CombatHookCtx } from './combatHooks';
import { setRule, resetRule } from '../engine/policy';

/** Contexte minimal : les hooks de test n'utilisent que `sink`/des effets de bord locaux. */
const ctx = (): CombatHookCtx => ({ get: (() => {}) as never, set: (() => {}) as never, battle: {} as never, sink: () => {} });

describe('combatHooks — registre de hooks de cycle de vie (calqué sur cascadeAppliers)', () => {
  afterEach(() => resetRule('combat-frappe-mortelle'));

  it('exécute les hooks d’une phase dans l’ordre `order` croissant', () => {
    const seen: string[] = [];
    registerCombatHook({ id: 't-b', phase: 'onTurnStart', order: 20, run: () => seen.push('b') });
    registerCombatHook({ id: 't-a', phase: 'onTurnStart', order: 10, run: () => seen.push('a') });
    registerCombatHook({ id: 't-c', phase: 'onTurnStart', order: 15, run: () => seen.push('c') });
    runCombatHooks('onTurnStart', ctx());
    expect(seen).toEqual(['a', 'c', 'b']);
  });

  it('réenregistrer le même id REMPLACE (pas de doublon — sûr face au double-import)', () => {
    let n = 0;
    registerCombatHook({ id: 't-dup', phase: 'onTurnEnd', run: () => { n += 1; } });
    registerCombatHook({ id: 't-dup', phase: 'onTurnEnd', run: () => { n += 1; } });
    runCombatHooks('onTurnEnd', ctx());
    expect(n).toBe(1);
    expect(combatHooksOf('onTurnEnd').filter((h) => h.id === 't-dup')).toHaveLength(1);
  });

  it('enabledIf : un hook gardé par une règle optionnelle INACTIVE est sauté', () => {
    let ran = false;
    registerCombatHook({ id: 't-gated', phase: 'onCombatEnd', enabledIf: 'combat-frappe-mortelle', run: () => { ran = true; } });
    runCombatHooks('onCombatEnd', ctx()); // règle off par défaut
    expect(ran).toBe(false);
    setRule('combat-frappe-mortelle', true);
    runCombatHooks('onCombatEnd', ctx());
    expect(ran).toBe(true);
  });

  it('un hook sans enabledIf est toujours actif', () => {
    let ran = false;
    registerCombatHook({ id: 't-always', phase: 'onCastResolved', run: () => { ran = true; } });
    runCombatHooks('onCastResolved', ctx());
    expect(ran).toBe(true);
  });
});
