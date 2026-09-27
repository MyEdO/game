import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useGame } from '../store';
import '../combatFlow'; // effet de bord : enregistre les hooks de fin de Round (dont `bleed-death`)
import { runCombatHooks, type CombatHookCtx } from '../combatHooks';
import { resolveRoundBoundary } from '../combatFlow';
import { createHero } from '../../engine/character';
import { seedBattleRng } from '../battleRng';
import { ev } from '../combatLog';
import { addCondition, stacks, COND } from '../../engine/conditions';
import { testScene } from '../../scenes/test-fixture';
import type { Combatant } from '../../engine/types';

/**
 * Mort par Hémorragique EN COMBAT (LDB 16 l.105 : « à la fin du Round, 10 %/pion de mourir ; un double =
 * coagulation, retire 1 pion »). Jouée par le hook `bleed-death` (jet RNG) qui MARQUE les morts dans
 * `battle.bleedDoomed`, puis FINALISÉE par `resolveRoundBoundary` — qui SUSPEND pour le Destin d'un héros.
 * Graines d100 (1ᵉʳ jet du Round) : 7 = ≤10 (mort) ; 21 = double (coagulation) ; 1 = >30 (survie).
 */
describe('Mort par Hémorragique en combat (LDB 16 l.105) — hook bleed-death + resolveRoundBoundary', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllTimers();
    useGame.setState({ pendingCascade: null, pendingFateSave: null, battle: null });
  });
  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  function setup() {
    const hero = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', seed: 1 });
    useGame.setState({ party: [hero] });
    useGame.getState().startScene(testScene());
    useGame.getState().startCombat('enc-mutants');
    useGame.getState().confirmRoundStart();
    vi.clearAllTimers();
    const b = useGame.getState().battle!;
    const H = b.combatants.find((c) => c.kind === 'hero')!;
    const enemies = b.combatants.filter((c) => c.kind === 'enemy');
    const E = enemies[0];
    enemies.slice(1).forEach((e) => (e.dead = true)); // une seule source vivante → RNG déterministe
    H.pos = { x: 10, y: 10 };
    E.pos = { x: 20, y: 20 };
    E.wounds = { current: 20, max: 20 }; // marge : les dégâts d'Hémorragie ne le tuent pas avant le jet
    useGame.setState({ battle: { ...b }, pendingCascade: null, pendingLogQueue: [] });
    return { H, E };
  }

  /** Joue la séquence de fin de Round (hooks `onRoundEnd` puis finalisation des morts/Destin). */
  function endRound() {
    const battle = useGame.getState().battle!;
    const sink = (line: string, c?: Combatant) => battle.log.push(ev('condition', line, c?.id));
    const ctx: CombatHookCtx = { get: useGame.getState, set: useGame.setState, battle, sink };
    runCombatHooks('onRoundEnd', ctx);
    resolveRoundBoundary(useGame.getState, useGame.setState);
  }

  it('ennemi : jet ≤ 10×pions → mort finalisée (annonce différée + onSlain)', () => {
    const { E } = setup();
    seedBattleRng(7); // après setup (startCombat a consommé le RNG d'initiative) : 1ᵉʳ d100 = ≤10 → mort
    addCondition(E, COND.hemorragique, 3);
    endRound();
    const e = useGame.getState().battle!.combatants.find((x) => x.id === E.id)!;
    expect(e.dead).toBe(true);
    expect(useGame.getState().pendingFateSave).toBeNull(); // un ennemi n'a pas de Destin
  });

  it('coagulation : un DOUBLE retire 1 pion d’Hémorragique (pas de mort)', () => {
    const { E } = setup();
    seedBattleRng(21); // après setup : 1ᵉʳ d100 = double → coagulation
    addCondition(E, COND.hemorragique, 3);
    endRound();
    const e = useGame.getState().battle!.combatants.find((x) => x.id === E.id)!;
    expect(e.dead).toBeFalsy();
    expect(stacks(e, COND.hemorragique)).toBe(2); // 3 → 2 (coagule)
  });

  it('survie : jet > 10×pions → ni mort ni coagulation', () => {
    const { E } = setup();
    seedBattleRng(1); // après setup : 1ᵉʳ d100 > 30, non-double → survie
    addCondition(E, COND.hemorragique, 3);
    endRound();
    const e = useGame.getState().battle!.combatants.find((x) => x.id === E.id)!;
    expect(e.dead).toBeFalsy();
    expect(stacks(e, COND.hemorragique)).toBe(3); // inchangé
  });

  it('héros à Destin : mort par Hémorragie → SUSPEND (pendingFateSave), le héros ne meurt pas tout de suite', () => {
    const { H } = setup();
    seedBattleRng(7); // après setup : mort
    H.fate = 1;
    addCondition(H, COND.hemorragique, 3);
    endRound();
    const fs = useGame.getState().pendingFateSave;
    expect(fs).toBeTruthy();
    expect(fs!.heroId).toBe(H.id);
    const h = useGame.getState().battle!.combatants.find((x) => x.id === H.id)!;
    expect(h.dead).toBeFalsy(); // suspendu, mort non encore finalisée (le joueur peut dépenser un Point de Destin)
  });

  it('héros SANS Destin : mort par Hémorragie finalisée (pas de suspension)', () => {
    const { H } = setup();
    seedBattleRng(7); // après setup : mort
    H.fate = 0;
    addCondition(H, COND.hemorragique, 3);
    endRound();
    expect(useGame.getState().pendingFateSave).toBeNull();
    const h = useGame.getState().battle!.combatants.find((x) => x.id === H.id)!;
    expect(h.dead).toBe(true);
  });
});
