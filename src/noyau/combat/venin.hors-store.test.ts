import { describe, it, expect, beforeEach } from 'vitest';
import { ouvrirLeBanc, type Banc } from '../banc.testkit';
import { fireTriggers } from '../triggeredEffects';
import { createHero } from '../../engine/character';
import { makeRNG } from '../../engine/dice';
import { seedBattleRng } from '../battleRng';
import { stacks } from '../../engine/conditions';
import { testScene } from '../../scenes/test-fixture';
import type { Combatant } from '../../engine/types';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });

/**
 * Venin (LDB 85 l.425 ; LDB 16 l.70 ; AU1 04 l.24) : quand la créature inflige des Points de Blessure avec
 * ses Attaques venimeuses, son adversaire subit un État Empoisonné, sans Test ; la Difficulté du Venin est
 * celle du Test qui retire l'État, Intermédiaire si aucune n'est indiquée. Immunité (Poison) : LDB 85 l.174.
 */
describe('Venin — la touche qui blesse pose Empoisonné à la Difficulté du Venin', () => {
  beforeEach(() => {
    banc.setState({ pendingCascade: null, battle: null, pendingLogQueue: [] });
  });

  function setup() {
    const hero = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', seed: 1 });
    banc.setState({ party: [hero] });
    banc.getState().startScene(testScene());
    banc.getState().startCombat('enc-mutants');
    banc.getState().confirmRoundStart();
    banc.abandonner();
    const b = banc.getState().battle!;
    const H = b.combatants.find((c) => c.kind === 'hero')!;
    const enemies = b.combatants.filter((c) => c.kind === 'enemy');
    const serpent = enemies[0];
    const proie = enemies[1];
    enemies.slice(2).forEach((e) => (e.dead = true));
    for (const c of [H, proie]) { c.wounds.max = 200; c.wounds.current = 200; c.conditions = []; }
    banc.setState({ battle: { ...b }, pendingCascade: null, pendingLogQueue: [] });
    return { H, serpent, proie };
  }
  const vivant = (c: Combatant): Combatant => banc.getState().battle!.combatants.find((x) => x.id === c.id)!;
  const touche = (serpent: Combatant, victime: Combatant, woundsDealt: number): void => {
    seedBattleRng(1);
    fireTriggers(banc.getState, serpent, 'onHit', { victim: victime, woundsDealt, rng: makeRNG(1), set: banc.setState });
  };
  const empoisonne = (c: Combatant) => vivant(c).conditions.find((x) => x.id === 'empoisonne');

  it('Venin (Difficile) qui blesse un héros : Empoisonné posé à la Difficulté Difficile, sans Test ni cascade', () => {
    const { H, serpent } = setup();
    serpent.traits = [...(serpent.traits ?? []), { id: 'venin', arg: 'difficile' }];
    touche(serpent, H, 4);
    expect(banc.getState().pendingCascade).toBeNull();
    expect(empoisonne(H)).toMatchObject({ value: 1, difficulte: 'difficile' });
    expect(banc.getState().pendingLogQueue.some((q) => /Résistance/.test(q.line))).toBe(false);
  });

  it('Venin sans Difficulté : Empoisonné sans Difficulté propre, son Test de retrait reste Intermédiaire', () => {
    const { serpent, proie } = setup();
    serpent.traits = [...(serpent.traits ?? []), { id: 'venin' }];
    touche(serpent, proie, 4);
    expect(empoisonne(proie)).toBeDefined();
    expect(empoisonne(proie)!.difficulte).toBeUndefined();
  });

  it('une touche sans Point de Blessure infligé ne pose rien', () => {
    const { serpent, proie } = setup();
    serpent.traits = [...(serpent.traits ?? []), { id: 'venin', arg: 'difficile' }];
    touche(serpent, proie, 0);
    expect(empoisonne(proie)).toBeUndefined();
  });

  it('chaque touche qui blesse ajoute un État Empoisonné, même déjà Empoisonné', () => {
    const { serpent, proie } = setup();
    serpent.traits = [...(serpent.traits ?? []), { id: 'venin', arg: 'complexe' }];
    touche(serpent, proie, 3);
    touche(serpent, proie, 3);
    expect(stacks(vivant(proie), 'empoisonne')).toBe(2);
  });

  it('cible Immunisée (Poison) : aucun Empoisonné', () => {
    const { serpent, proie } = setup();
    serpent.traits = [...(serpent.traits ?? []), { id: 'venin', arg: 'difficile' }];
    proie.traits = [...(proie.traits ?? []), { id: 'immunite', arg: 'Poison' }];
    touche(serpent, proie, 4);
    expect(empoisonne(proie)).toBeUndefined();
  });

  // (#3060 ; LDB 16 l.70) Difficulté la plus dure des poisons cumulés ; un Venin sans
  // Difficulté vaut le défaut du Test de l'État (`etats.json › empoisonne`, `LDB 85 l.425`).
  it.each([
    ['difficile', 'facile', 'difficile'],
    ['facile', 'difficile', 'difficile'],
    [undefined, 'accessible', undefined],
    ['accessible', undefined, undefined],
    [undefined, 'difficile', 'difficile'],
    ['difficile', undefined, 'difficile'],
  ] as const)('poisons %s puis %s : l’État garde la plus dure (%s)', (premier, second, attendue) => {
    const { serpent, proie } = setup();
    const venin = (arg: string | undefined) => { serpent.traits = [...(serpent.traits ?? []).filter((t) => t.id !== 'venin'), { id: 'venin', ...(arg ? { arg } : {}) }]; };
    venin(premier);
    touche(serpent, proie, 3);
    venin(second);
    touche(serpent, proie, 3);
    expect(empoisonne(proie)!.value).toBe(2);
    expect(empoisonne(proie)!.difficulte).toBe(attendue);
  });
});
