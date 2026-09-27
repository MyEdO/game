import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useGame } from './store';
import { checkBattleOver } from './combatFlow';
import { createHero } from '../engine/character';
import { testScene } from '../scenes/test-fixture';
import { structureIsDown, structureDownKey } from './scene';
import type { Scene } from './scene';

/**
 * OBJECTIF de victoire authorable (#197) — `checkBattleOver` ne se rabat plus systématiquement sur
 * « tous les ennemis hors d'action » : par défaut (absent) c'est inchangé, mais une rencontre peut
 * viser une structure (bélier-porte), un nombre de Rounds tenus, ou une zone atteinte.
 */

/** Résout la cascade de fin de combat (Tests de Résistance influençables) — no-op si aucune. */
function drainCombatEndCascade(): void {
  for (let guard = 0; guard < 30; guard++) {
    const p = useGame.getState().pendingCascade;
    if (!p?.combatEndBoundary) break;
    const cur = p.participants[p.cursor];
    // Les jets de bilan de combat sont des BANDES (#1117 L4) : on lance chaque RANGÉE ; une étape MONO
    // (upkeep différé non bandable) garde son lancer d'étape.
    if (cur?.participants) { for (const row of cur.participants) if (!row.result) useGame.getState().cascadeBatchRoll(row.id); }
    else if (cur?.target != null && !cur.result) useGame.getState().cascadeRoll(cur.id);
    useGame.getState().cascadeNext();
  }
}

function startFixtureCombat(scene: Scene = testScene) {
  const hero = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', seed: 1 });
  useGame.setState({ party: [hero], battle: null });
  useGame.getState().startScene(scene);
  useGame.getState().startCombat('enc-mutants');
}

describe('checkBattleOver — objectif de victoire authorable (#197)', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.clearAllTimers(); useGame.setState({ battle: null }); });
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

  it("absent (défaut) : comportement HISTORIQUE inchangé — tous les ennemis morts → victoire", () => {
    startFixtureCombat();
    expect(useGame.getState().battle!.victoryCondition).toBeUndefined();
    const b = useGame.getState().battle!;
    for (const c of b.combatants) if (c.kind === 'enemy') c.dead = true;
    useGame.setState({ battle: { ...b } });
    checkBattleOver(useGame.getState, useGame.setState);
    drainCombatEndCascade();
    expect(useGame.getState().battle!.over).toBe('victory');
  });

  it("destroyStructure : le dernier ennemi mort mais la structure INTACTE → le combat CONTINUE (bug exact du ticket)", () => {
    const scene = structuredClone(testScene);
    scene.walls = [{ x: 2, y: 2, side: 'E', structure: 'porte' }];
    scene.encounters[0].victoryCondition = { type: 'destroyStructure', edge: { x: 2, y: 2, side: 'E' } };
    startFixtureCombat(scene);
    expect(useGame.getState().battle!.victoryCondition).toEqual({ type: 'destroyStructure', edge: { x: 2, y: 2, side: 'E' } });
    const b = useGame.getState().battle!;
    for (const c of b.combatants) if (c.kind === 'enemy') c.dead = true; // dernier ennemi mort
    useGame.setState({ battle: { ...b } });
    const over = checkBattleOver(useGame.getState, useGame.setState);
    expect(over).toBe(false);
    expect(useGame.getState().battle!.over).toBeNull(); // PAS de victoire : porte intacte
  });

  it("destroyStructure : la porte ABATTUE déclenche la victoire même avec des ennemis vivants", () => {
    const scene = structuredClone(testScene);
    scene.walls = [{ x: 2, y: 2, side: 'E', structure: 'porte' }];
    scene.encounters[0].victoryCondition = { type: 'destroyStructure', edge: { x: 2, y: 2, side: 'E' } };
    startFixtureCombat(scene);
    // Tous les ennemis restent vivants : seule la brèche compte.
    const afterFlag = structureDownKey(2, 2, 'E', 0);
    useGame.setState({ scene: { ...useGame.getState().scene!, flags: { ...useGame.getState().scene!.flags, [afterFlag]: true } } });
    expect(structureIsDown(useGame.getState().scene!, { x: 2, y: 2, side: 'E' })).toBe(true);
    const over = checkBattleOver(useGame.getState, useGame.setState);
    drainCombatEndCascade();
    expect(over).toBe(true);
    expect(useGame.getState().battle!.over).toBe('victory');
  });

  it("surviveRounds : victoire posée au DÉBUT du Round N+1, ennemis toujours vivants", () => {
    startFixtureCombat();
    useGame.setState({ battle: { ...useGame.getState().battle!, victoryCondition: { type: 'surviveRounds', rounds: 3 }, round: 3 } });
    expect(checkBattleOver(useGame.getState, useGame.setState)).toBe(false); // Round 3 : surviveRounds(3) exige round > 3, condition non remplie
    useGame.setState({ battle: { ...useGame.getState().battle!, round: 4 } });
    const over = checkBattleOver(useGame.getState, useGame.setState);
    drainCombatEndCascade();
    expect(over).toBe(true);
    expect(useGame.getState().battle!.over).toBe('victory');
  });

  it("reachZone : un héros dans le rectangle déclenche la victoire, ennemis vivants", () => {
    startFixtureCombat();
    useGame.setState({
      battle: { ...useGame.getState().battle!, victoryCondition: { type: 'reachZone', rect: { x: 6, y: 10, w: 1, h: 1 } } },
    });
    const b = useGame.getState().battle!;
    const hero = b.combatants.find((c) => c.kind === 'hero')!;
    hero.pos = { x: 6, y: 10 }; // dans le rectangle
    useGame.setState({ battle: { ...b } });
    const over = checkBattleOver(useGame.getState, useGame.setState);
    drainCombatEndCascade();
    expect(over).toBe(true);
    expect(useGame.getState().battle!.over).toBe('victory');
  });

  it("reachZone : aucun héros dans le rectangle → le combat continue", () => {
    startFixtureCombat();
    useGame.setState({
      battle: { ...useGame.getState().battle!, victoryCondition: { type: 'reachZone', rect: { x: 0, y: 0, w: 1, h: 1 } } },
    });
    const over = checkBattleOver(useGame.getState, useGame.setState);
    expect(over).toBe(false);
    expect(useGame.getState().battle!.over).toBeNull();
  });

  describe('woundsThreshold — reddition à seuil de dommage partiel (#215)', () => {
    it("seuil franchi (Blessures < belowPercent%) → victoire, cible hors de combat, journal de reddition", () => {
      startFixtureCombat();
      const b = useGame.getState().battle!;
      const enemy = b.combatants.find((c) => c.kind === 'enemy')!;
      enemy.wounds = { current: 4, max: 10 }; // 40% < 50%
      useGame.setState({
        battle: { ...b, victoryCondition: { type: 'woundsThreshold', targetId: enemy.id, belowPercent: 50 } },
      });
      const over = checkBattleOver(useGame.getState, useGame.setState);
      drainCombatEndCascade();
      expect(over).toBe(true);
      expect(useGame.getState().battle!.over).toBe('victory');
      const resolved = useGame.getState().battle!.combatants.find((c) => c.id === enemy.id)!;
      expect(resolved.outOfRencontre).toBe(true);
      expect(useGame.getState().battle!.log.some((e) => e.text.includes('amène son pavillon'))).toBe(true);
    });

    it("seuil NON franchi → le combat continue, cible toujours en jeu", () => {
      startFixtureCombat();
      const b = useGame.getState().battle!;
      const enemy = b.combatants.find((c) => c.kind === 'enemy')!;
      enemy.wounds = { current: 8, max: 10 }; // 80% ≥ 50%
      useGame.setState({
        battle: { ...b, victoryCondition: { type: 'woundsThreshold', targetId: enemy.id, belowPercent: 50 } },
      });
      const over = checkBattleOver(useGame.getState, useGame.setState);
      expect(over).toBe(false);
      expect(useGame.getState().battle!.over).toBeNull();
      const resolved = useGame.getState().battle!.combatants.find((c) => c.id === enemy.id)!;
      expect(resolved.outOfRencontre).toBeFalsy();
    });

    it("cible tuée (0 Blessure) → victoire a fortiori, même seuil non franchi explicitement", () => {
      startFixtureCombat();
      const b = useGame.getState().battle!;
      const enemy = b.combatants.find((c) => c.kind === 'enemy')!;
      enemy.wounds = { current: 0, max: 10 };
      enemy.dead = true;
      useGame.setState({
        battle: { ...b, victoryCondition: { type: 'woundsThreshold', targetId: enemy.id, belowPercent: 50 } },
      });
      const over = checkBattleOver(useGame.getState, useGame.setState);
      drainCombatEndCascade();
      expect(over).toBe(true);
      expect(useGame.getState().battle!.over).toBe('victory');
    });
  });
});
