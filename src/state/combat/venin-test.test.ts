import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useGame } from '../store';
import { fireTriggers } from '../triggeredEffects';
import '../combatFlow'; // effet de bord : installe le routeur de Test + l'applier triggeredTest + le hook onGainCondition
import { createHero } from '../../engine/character';
import { makeRNG } from '../../engine/dice';
import { seedBattleRng } from '../battleRng';
import { hasCondition } from '../../engine/conditions';

import { testScene } from '../../scenes/test-fixture';
import { resetCadence } from '../../engine/cadence';

/**
 * Venin (LDB 85) en nœud Flow `test` (Lot 4a) : `onHit` causant des PB → la victime teste sa Résistance
 * (Difficulté = l'arg d'instance « Venin (Difficile) » via `argDifficulty` honoré par `withArg`) ; échec
 * → Empoisonné. Trois cas RAW :
 *  (a) victime HÉROS MANUEL → étape de cascade `triggeredTest` INFLUENÇABLE, Difficulté DIFFICILE (arg) ;
 *  (b) victime ENNEMIE → jet INLINE + Empoisonné sur échec ;
 *  (c) victime IMMUNISÉE (Poison) → AUCUN test (gate `unlessImmune` = no-op).
 */
describe('Venin — nœud Flow test routé cadence-aware (gates argDifficulty/unlessImmune)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllTimers();
    resetCadence();
    useGame.setState({ pendingCascade: null, battle: null, pendingLogQueue: [] });
  });
  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  function setup() {
    const hero = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', seed: 1 });
    useGame.setState({ party: [hero] });
    useGame.getState().startScene(testScene);
    useGame.getState().startCombat('enc-mutants');
    useGame.getState().confirmRoundStart();
    vi.clearAllTimers();
    const b = useGame.getState().battle!;
    const H = b.combatants.find((c) => c.kind === 'hero')!;
    const enemies = b.combatants.filter((c) => c.kind === 'enemy');
    const snake = enemies[0]; // l'attaquant venimeux
    const prey = enemies[1];  // une victime ennemie (cas b/c)
    enemies.slice(2).forEach((e) => (e.dead = true));
    H.wounds.max = 200; H.wounds.current = 200;
    prey.wounds.max = 200; prey.wounds.current = 200;
    useGame.setState({ battle: { ...b }, pendingCascade: null, pendingLogQueue: [] });
    return { H, snake, prey };
  }

  it('(a) victime HÉROS MANUEL : étape de cascade triggeredTest Résistance DIFFICILE (arg honoré), influençable', () => {
    seedBattleRng(7);
    const { H, snake } = setup();
    snake.traits = [...(snake.traits ?? []), { id: 'venin', arg: 'Difficile' }]; // « Venin (Difficile) »

    // onHit causant des PB sur le héros (victime) → le trait Venin teste sa Résistance.
    fireTriggers(useGame.getState, snake, 'onHit', { victim: H, woundsDealt: 4, rng: makeRNG(1), set: useGame.setState });

    const casc = useGame.getState().pendingCascade!;
    expect(casc).toBeTruthy();
    expect(casc.purpose).toBe('combat');
    const step = casc.participants.find((s) => s.kind === 'triggeredTest')!;
    expect(step).toBeTruthy();
    expect(step.actorId).toBe(H.id);
    expect(step.result).toBeFalsy(); // pas encore lancé → Chance/Résilience possibles
    expect(step.rollLabel).toBe('Résistance'); // cadre de jet = la Compétence RÉELLE
    // Difficulté DIFFICILE (−20) honorée depuis l'arg « Venin (Difficile) » : cible = base − 20 (pénalités
    // d'États nulles ici). Sans `argDifficulty`, le défaut serait Intermédiaire (+0) → cible = base.
    const base = step.base!;
    expect(step.target).toBe(base - 20); // Difficile = −20 (DIFFICULTY_MODIFIERS), substitué au défaut par withArg
  });

  it('(b) victime ENNEMIE : jet INLINE + Empoisonné sur échec (pas de cascade)', () => {
    seedBattleRng(1); // jet élevé → Résistance échouée → Empoisonné
    const { snake, prey } = setup();
    snake.traits = [...(snake.traits ?? []), { id: 'venin', arg: 'Difficile' }];
    prey.characteristics.endurance = 1; // Résistance minimale → échec quasi certain

    fireTriggers(useGame.getState, snake, 'onHit', { victim: prey, woundsDealt: 4, rng: makeRNG(1), set: useGame.setState });

    expect(useGame.getState().pendingCascade).toBeNull(); // ennemi → jamais d'étape influençable
    const live = useGame.getState().battle!.combatants.find((c) => c.id === prey.id)!;
    expect(hasCondition(live, 'empoisonne')).toBe(true); // échec → Empoisonné posé inline
    // La ligne de parité du Test (traceLineOf) part dans la file différée (Résistance Difficile).
    expect(useGame.getState().pendingLogQueue.some((q) => /Résistance/.test(q.line))).toBe(true);
  });

  it('(c) victime IMMUNISÉE (Poison) : AUCUN test, AUCUN Empoisonné (gate unlessImmune = no-op)', () => {
    seedBattleRng(1);
    const { snake, prey } = setup();
    snake.traits = [...(snake.traits ?? []), { id: 'venin', arg: 'Difficile' }];
    prey.characteristics.endurance = 1;
    prey.traits = [...(prey.traits ?? []), { id: 'immunite', arg: 'Poison' }]; // Immunité (Poison)

    fireTriggers(useGame.getState, snake, 'onHit', { victim: prey, woundsDealt: 4, rng: makeRNG(1), set: useGame.setState });

    expect(useGame.getState().pendingCascade).toBeNull();
    const live = useGame.getState().battle!.combatants.find((c) => c.id === prey.id)!;
    expect(hasCondition(live, 'empoisonne')).toBe(false); // immunisé → pas de Test, pas d'Empoisonné
    // Aucun jet de Résistance n'a eu lieu.
    expect(useGame.getState().pendingLogQueue.some((q) => /Résistance/.test(q.line))).toBe(false);
  });
});
