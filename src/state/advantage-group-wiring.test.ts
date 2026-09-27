import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useGame } from './store';
import { resolveRoundBoundary } from './combatFlow';
import { setRule, resetRule } from '../engine/policy';
import { createHero } from '../engine/character';
import { seedBattleRng } from './battleRng';
import { testScene } from '../scenes/test-fixture';

/**
 * CÂBLAGE des deux coutures d'intégration du modèle « Avantage de groupe » (AA 11) — par le STORE RÉEL,
 * pas un contexte forgé : `combatSlice.startCombat` (ouverture des réserves de camp) et
 * `combatFlow.resolveRoundBoundary` (transfert de domination de fin de Round). Les tests unitaires de
 * `state/combat/advantage-group.test.ts` appellent les primitives à la main : ils ne prouvent PAS que
 * quelqu'un les appelle en jeu. Ici, la seule entrée est `startCombat` / le franchissement de Round.
 */
function startFixtureCombat() {
  const hero = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', seed: 1 });
  useGame.setState({ party: [hero] });
  useGame.getState().startScene(testScene);
  seedBattleRng(777);
  useGame.getState().startCombat('enc-mutants', undefined, { noSurprise: true });
  return useGame.getState().battle!;
}

describe('startCombat — ouverture des réserves d’Avantage de camp (AA 11 l.47-67)', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.clearAllTimers(); useGame.setState({ battle: null, pendingCascade: null, pendingRoundStart: null }); });
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); resetRule('combat-aa-avantage-groupe'); useGame.setState({ battle: null }); });

  it('règle ACTIVE : la bataille naît avec ses réserves, dérivées du positionnement initial, et projetées', () => {
    setRule('combat-aa-avantage-groupe', true);
    const battle = startFixtureCombat();
    // 1 héros contre 3 Mutants : Surnombre ×3 au camp adverse (AA 11 l.60-62) → +3 dans SA réserve.
    expect(battle.advantagePools).toEqual({ allies: 0, foes: 3 });
    for (const c of battle.combatants) expect(c.advantage).toBe(c.kind === 'hero' ? 0 : 3); // projection
  });

  it('règle INACTIVE (défaut Livre de base) : aucune réserve n’est créée', () => {
    const battle = startFixtureCombat();
    expect(battle.advantagePools).toBeUndefined();
    for (const c of battle.combatants) expect(c.advantage).toBe(0);
  });
});

describe('resolveRoundBoundary — transfert de domination de fin de Round (AA 11 l.44)', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.clearAllTimers(); useGame.setState({ battle: null, pendingCascade: null, pendingRoundStart: null }); });
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); resetRule('combat-aa-avantage-groupe'); useGame.setState({ battle: null }); });

  it('règle ACTIVE : le camp dominant prend 1 Avantage à l’autre (vide → il en gagne 1), re-projeté', () => {
    setRule('combat-aa-avantage-groupe', true);
    const battle = startFixtureCombat();
    const before = { ...battle.advantagePools! };
    resolveRoundBoundary(useGame.getState, useGame.setState);
    const after = useGame.getState().battle!;
    // Les Mutants dominent (3 contre 1) et la réserve alliée est vide → +1 pour eux.
    expect(after.advantagePools).toEqual({ allies: before.allies, foes: before.foes + 1 });
    for (const c of after.combatants) expect(c.advantage).toBe(c.kind === 'hero' ? after.advantagePools!.allies : after.advantagePools!.foes);
  });

  it('règle INACTIVE : décroissance per-combattant du Livre de base (LDB 14 l.219), aucune réserve', () => {
    const battle = startFixtureCombat();
    const hero = battle.combatants.find((c) => c.kind === 'hero')!;
    hero.advantage = 2;
    resolveRoundBoundary(useGame.getState, useGame.setState);
    const after = useGame.getState().battle!;
    expect(after.advantagePools).toBeUndefined();
    expect(after.combatants.find((c) => c.id === hero.id)!.advantage).toBe(1);
  });
});
