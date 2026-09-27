import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useGame } from '../store';
import '../combatFlow'; // effet de bord : enregistre les hooks de fin de Round (dont `bleed-death`)
import { runCombatHooks, type CombatHookCtx } from '../combatHooks';
import { createHero } from '../../engine/character';
import { seedBattleRng } from '../battleRng';
import { ev } from '../combatLog';
import { addCondition, stacks, COND } from '../../engine/conditions';
import { setRule, resetRule } from '../../engine/policy';
import { testScene } from '../../scenes/test-fixture';
import type { Combatant } from '../../engine/types';

/**
 * #38 (d) — Variante Hémorragique d'Aux Armes (l.2451) : le jet de mort par hémorragie (10 %/pion, un
 * double = coagulation) EST le hook LDB `bleed-death` — SEUL le prédicat d'éligibilité diffère : AA
 * l'exige INCONSCIENT (LDB 16 l.105 : tout bleeder encore actif). Graine d100 21 = double → coagulation :
 * le stack tombe de 3 à 2 SI ET SEULEMENT SI le jet a eu lieu (preuve seed-indépendante du gate).
 */
describe('#38 (d) — gate AA du jet de mort par Hémorragique (Aux Armes l.2451)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllTimers();
    useGame.setState({ pendingCascade: null, pendingFateSave: null, battle: null });
  });
  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    resetRule('combat-aa-blessures');
  });

  function setup() {
    const hero = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', seed: 1 });
    useGame.setState({ party: [hero] });
    useGame.getState().startScene(testScene);
    useGame.getState().startCombat('enc-mutants');
    useGame.getState().confirmRoundStart();
    vi.clearAllTimers();
    const b = useGame.getState().battle!;
    const enemies = b.combatants.filter((c) => c.kind === 'enemy');
    const E = enemies[0];
    enemies.slice(1).forEach((e) => (e.dead = true)); // une seule source vivante → RNG déterministe
    E.wounds = { current: 20, max: 20 }; // marge : les dégâts d'Hémorragie ne le tuent pas avant le jet
    useGame.setState({ battle: { ...b }, pendingCascade: null, pendingLogQueue: [] });
    return { E };
  }

  function roundEndHooksOnly() {
    const battle = useGame.getState().battle!;
    const sink = (line: string, c?: Combatant) => battle.log.push(ev('condition', line, c?.id));
    const ctx: CombatHookCtx = { get: useGame.getState, set: useGame.setState, battle, sink };
    runCombatHooks('onRoundEnd', ctx);
    return battle;
  }

  it('mode AA : un bleeder CONSCIENT n’est PAS soumis au jet (aucune coagulation, stack inchangé)', () => {
    setRule('combat-aa-blessures', 'aa');
    const { E } = setup();
    seedBattleRng(21); // double : coagulerait SI le jet avait lieu
    addCondition(E, COND.hemorragique, 3); // pas d'État Inconscient → gate AA 07 l.7 l'exclut
    const battle = roundEndHooksOnly();
    expect(stacks(E, COND.hemorragique)).toBe(3); // jamais roulé → pas de coagulation
    expect((battle.bleedDoomed ?? []).some((d) => d.id === E.id)).toBe(false);
  });

  it('mode AA : un bleeder INCONSCIENT est soumis au jet (double → coagulation, stack 3 → 2)', () => {
    setRule('combat-aa-blessures', 'aa');
    const { E } = setup();
    seedBattleRng(21);
    addCondition(E, COND.inconscient, 1);
    addCondition(E, COND.hemorragique, 3);
    roundEndHooksOnly();
    expect(stacks(E, COND.hemorragique)).toBe(2); // roulé → coagulation (le gate laisse passer l'Inconscient)
  });

  it('mode LDB (défaut) : un bleeder conscient EST soumis au jet (parité l.105, non régressé)', () => {
    const { E } = setup(); // rule ldb par défaut
    seedBattleRng(21);
    addCondition(E, COND.hemorragique, 3);
    roundEndHooksOnly();
    expect(stacks(E, COND.hemorragique)).toBe(2); // roulé en LDB comme avant
  });
});
