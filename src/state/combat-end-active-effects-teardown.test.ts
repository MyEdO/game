/**
 * Fin de combat — un effet actif sort du combat pour sa Durée restante (LDB 46 l.93, CRB 070 l.27) :
 * `finalizeBattle` le rend au groupe par `carryOverState`, et ses Rounds s'écoulent hors combat
 * (LDB 13 l.45-47, `outOfCombatUpkeep`). À l'expiration, la donnée qu'il porte (`grantedMutation`,
 * `grantedTrait` — Allure démoniaque, EDOC 13 l.270-276) se détache par `removeActiveEffects`.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useGame } from './store';
import { finalizeBattle } from './combatFlow';
import { createHero } from '../engine/character';
import { makeRNG } from '../engine/dice';
import { rollMutation } from '../data/mutations';
import { attachMutation } from '../engine/corruption';
import { TIME_COST } from '../engine/timeCost';
import { testScene } from '../scenes/test-fixture';

describe('finalizeBattle — un effet en Rounds revient au groupe et s’écoule hors combat', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.clearAllTimers(); useGame.setState({ battle: null, pendingCast: null }); });
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

  function setup() {
    const W = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'W', seed: 3 });
    useGame.setState({ party: [W] });
    useGame.getState().startScene(testScene());
    useGame.getState().startCombat('enc-mutants');
    useGame.getState().confirmRoundStart();
    vi.clearAllTimers();
    const b = useGame.getState().battle!;
    return b.combatants.find((c) => c.label === 'W')!;
  }
  const heros = (id: string) => useGame.getState().party.find((h) => h.id === id)!;
  const rounds = (n: number) => useGame.getState().advanceTime(n * TIME_COST.combatRound);

  it('mutation accordée pour 3 Rounds : revient au groupe, puis se détache au 3e Round hors combat', () => {
    const caster = setup();
    const m = rollMutation('edoc-phys-nurgle', makeRNG(4));
    attachMutation(caster, m, makeRNG(1));
    caster.activeEffects = [{ label: 'Allure démoniaque', bonus: 0, duration: { scale: 'rounds', left: 3 }, grantedMutation: m }];
    finalizeBattle(useGame.getState, useGame.setState);
    useGame.setState({ battle: null });
    expect(heros(caster.id).activeEffects?.map((e) => e.duration)).toEqual([{ scale: 'rounds', left: 3 }]);
    expect(heros(caster.id).mutations?.some((x) => x.id === m.id)).toBe(true);
    rounds(2);
    expect(heros(caster.id).mutations?.some((x) => x.id === m.id)).toBe(true);
    rounds(1);
    expect(heros(caster.id).activeEffects ?? []).toEqual([]);
    expect(heros(caster.id).mutations?.some((x) => x.id === m.id)).toBe(false);
  });

  it('Trait accordé pour 2 Rounds : revient au groupe, puis se détache à expiration hors combat', () => {
    const caster = setup();
    caster.traits = [...(caster.traits ?? []), { id: 'peur', value: 3 }];
    caster.activeEffects = [{ label: 'Allure démoniaque', bonus: 0, duration: { scale: 'rounds', left: 2 }, grantedTrait: { id: 'peur', value: 3 } }];
    finalizeBattle(useGame.getState, useGame.setState);
    useGame.setState({ battle: null });
    expect((heros(caster.id).traits ?? []).some((t) => t.id === 'peur')).toBe(true);
    rounds(2);
    expect((heros(caster.id).traits ?? []).some((t) => t.id === 'peur')).toBe(false);
  });

  it('effets PERMANENT et d’HORLOGE : reviennent au groupe intacts', () => {
    const caster = setup();
    caster.activeEffects = [
      { label: 'Buff permanent', bonus: 0, duration: { scale: 'permanent' }, char: 'force' },
      { label: 'Contrecoup', bonus: 0, duration: { scale: 'clock', until: 999999 } },
    ];
    finalizeBattle(useGame.getState, useGame.setState);
    expect(heros(caster.id).activeEffects?.map((e) => e.duration.scale)).toEqual(['permanent', 'clock']);
  });
});
