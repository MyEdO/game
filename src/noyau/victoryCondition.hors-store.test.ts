import { describe, it, expect, beforeEach } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { draineCascade } from './cascade.testkit';
import { checkBattleOver } from './combatFlow';
import { createHero } from '../engine/character';
import { testScene } from '../scenes/test-fixture';
import { structureIsDown, structureDownKey } from './monde/scene';
import type { Scene } from './monde/scene';
import { blessuresDeBase } from '../engine/characteristics';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });

/**
 * OBJECTIF de victoire authorable (#197) — `checkBattleOver` lit l'objectif de la rencontre : par
 * défaut (absent), « tous les ennemis hors d'action » ; une rencontre peut aussi viser une structure (bélier-porte), un nombre de Rounds tenus, ou une zone atteinte.
 */

function startFixtureCombat(scene: Scene = testScene()) {
  const hero = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', seed: 1 });
  banc.setState({ party: [hero], battle: null });
  banc.getState().startScene(scene);
  banc.getState().startCombat('enc-mutants');
}

describe('checkBattleOver — objectif de victoire authorable (#197)', () => {
  it("absent (défaut) : comportement HISTORIQUE inchangé — tous les ennemis morts → victoire", () => {
    startFixtureCombat();
    expect(banc.getState().battle!.victoryCondition).toBeUndefined();
    const b = banc.getState().battle!;
    for (const c of b.combatants) if (c.kind === 'enemy') c.dead = true;
    banc.setState({ battle: { ...b } });
    checkBattleOver(banc.getState, banc.setState);
    draineCascade(banc.getState);
    expect(banc.getState().battle!.over).toBe('victory');
  });

  it("destroyStructure : le dernier ennemi mort mais la structure INTACTE → le combat CONTINUE (bug exact du ticket)", () => {
    const scene = structuredClone(testScene());
    scene.walls = [{ x: 2, y: 2, side: 'E', structure: 'porte' }];
    scene.encounters[0].victoryCondition = { type: 'destroyStructure', edge: { x: 2, y: 2, side: 'E' } };
    startFixtureCombat(scene);
    expect(banc.getState().battle!.victoryCondition).toEqual({ type: 'destroyStructure', edge: { x: 2, y: 2, side: 'E' } });
    const b = banc.getState().battle!;
    for (const c of b.combatants) if (c.kind === 'enemy') c.dead = true; // dernier ennemi mort
    banc.setState({ battle: { ...b } });
    const over = checkBattleOver(banc.getState, banc.setState);
    expect(over).toBe(false);
    expect(banc.getState().battle!.over).toBeNull(); // PAS de victoire : porte intacte
  });

  it("destroyStructure : la porte ABATTUE déclenche la victoire même avec des ennemis vivants", () => {
    const scene = structuredClone(testScene());
    scene.walls = [{ x: 2, y: 2, side: 'E', structure: 'porte' }];
    scene.encounters[0].victoryCondition = { type: 'destroyStructure', edge: { x: 2, y: 2, side: 'E' } };
    startFixtureCombat(scene);
    // Tous les ennemis restent vivants : seule la brèche compte.
    const afterFlag = structureDownKey(2, 2, 'E', 0);
    banc.setState({ scene: { ...banc.getState().scene!, flags: { ...banc.getState().scene!.flags, [afterFlag]: true } } });
    expect(structureIsDown(banc.getState().scene!, { x: 2, y: 2, side: 'E' })).toBe(true);
    const over = checkBattleOver(banc.getState, banc.setState);
    draineCascade(banc.getState);
    expect(over).toBe(true);
    expect(banc.getState().battle!.over).toBe('victory');
  });

  it("surviveRounds : victoire posée au DÉBUT du Round N+1, ennemis toujours vivants", () => {
    startFixtureCombat();
    banc.setState({ battle: { ...banc.getState().battle!, victoryCondition: { type: 'surviveRounds', rounds: 3 }, round: 3 } });
    expect(checkBattleOver(banc.getState, banc.setState)).toBe(false); // Round 3 : surviveRounds(3) exige round > 3, condition non remplie
    banc.setState({ battle: { ...banc.getState().battle!, round: 4 } });
    const over = checkBattleOver(banc.getState, banc.setState);
    draineCascade(banc.getState);
    expect(over).toBe(true);
    expect(banc.getState().battle!.over).toBe('victory');
  });

  it("reachZone : un héros dans le rectangle déclenche la victoire, ennemis vivants", () => {
    startFixtureCombat();
    banc.setState({
      battle: { ...banc.getState().battle!, victoryCondition: { type: 'reachZone', rect: { x: 6, y: 10, w: 1, h: 1 } } },
    });
    const b = banc.getState().battle!;
    const hero = b.combatants.find((c) => c.kind === 'hero')!;
    hero.pos = { x: 6, y: 10 }; // dans le rectangle
    banc.setState({ battle: { ...b } });
    const over = checkBattleOver(banc.getState, banc.setState);
    draineCascade(banc.getState);
    expect(over).toBe(true);
    expect(banc.getState().battle!.over).toBe('victory');
  });

  it("reachZone : aucun héros dans le rectangle → le combat continue", () => {
    startFixtureCombat();
    banc.setState({
      battle: { ...banc.getState().battle!, victoryCondition: { type: 'reachZone', rect: { x: 0, y: 0, w: 1, h: 1 } } },
    });
    const over = checkBattleOver(banc.getState, banc.setState);
    expect(over).toBe(false);
    expect(banc.getState().battle!.over).toBeNull();
  });

  describe('woundsThreshold — reddition à seuil de dommage partiel (#215)', () => {
    it("seuil franchi (Blessures < belowPercent%) → victoire, cible hors de combat, journal de reddition", () => {
      startFixtureCombat();
      const b = banc.getState().battle!;
      const enemy = b.combatants.find((c) => c.kind === 'enemy')!;
      enemy.wounds = blessuresDeBase(10, 4); // 40% < 50%
      banc.setState({
        battle: { ...b, victoryCondition: { type: 'woundsThreshold', targetId: enemy.id, belowPercent: 50 } },
      });
      const over = checkBattleOver(banc.getState, banc.setState);
      draineCascade(banc.getState);
      expect(over).toBe(true);
      expect(banc.getState().battle!.over).toBe('victory');
      const resolved = banc.getState().battle!.combatants.find((c) => c.id === enemy.id)!;
      expect(resolved.outOfRencontre).toBe(true);
      expect(banc.getState().battle!.log.some((e) => e.text.includes('amène son pavillon'))).toBe(true);
    });

    it("seuil NON franchi → le combat continue, cible toujours en jeu", () => {
      startFixtureCombat();
      const b = banc.getState().battle!;
      const enemy = b.combatants.find((c) => c.kind === 'enemy')!;
      enemy.wounds = blessuresDeBase(10, 8); // 80% ≥ 50%
      banc.setState({
        battle: { ...b, victoryCondition: { type: 'woundsThreshold', targetId: enemy.id, belowPercent: 50 } },
      });
      const over = checkBattleOver(banc.getState, banc.setState);
      expect(over).toBe(false);
      expect(banc.getState().battle!.over).toBeNull();
      const resolved = banc.getState().battle!.combatants.find((c) => c.id === enemy.id)!;
      expect(resolved.outOfRencontre).toBeFalsy();
    });

    it("cible tuée (0 Blessure) → victoire a fortiori, même seuil non franchi explicitement", () => {
      startFixtureCombat();
      const b = banc.getState().battle!;
      const enemy = b.combatants.find((c) => c.kind === 'enemy')!;
      enemy.wounds = blessuresDeBase(10, 0);
      enemy.dead = true;
      banc.setState({
        battle: { ...b, victoryCondition: { type: 'woundsThreshold', targetId: enemy.id, belowPercent: 50 } },
      });
      const over = checkBattleOver(banc.getState, banc.setState);
      draineCascade(banc.getState);
      expect(over).toBe(true);
      expect(banc.getState().battle!.over).toBe('victory');
    });
  });
});
