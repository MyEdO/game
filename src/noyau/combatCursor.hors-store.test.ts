/**
 * `intentionDuClicDeCase` (noyau) : ce que joue la case → ennemi → attaque, case libre → déplacement, allié → rien ;
 * `jouerLeClicDuCombattant` / `jouerLeClicDeCase` : le geste joué, lu par le commit du curseur, le clic-sol
 * (`useStagePointer.performClick`), la frappe d'une structure et la frise.
 */
import { idsDeTest } from '../engine/idsDeTest.testkit';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { intentionDuClicDeCase, jouerLeClicDeCase, jouerLeClicDuCombattant } from './combatOrParty';
import { tousLesHerosDeScenario } from '../scenes/test-scenarios/_heros';
import { spawnEnemy } from './monde/spawn';

/** Arène d'herbe minimale (intentionDuClicDeCase dérive l'affordance d'attaque → besoin d'une scène). */
const arena = () => {
  const w = 22, h = 16;
  return { id: 's', dimensions: { w, h }, layers: [{ z: 0, tiles: new Array(w * h).fill('herbe') }], entities: [], dialogues: [], triggers: [], encounters: [] } as never;
};

describe('intentionDuClicDeCase — clic-sol et commit du curseur (mode-aware)', () => {
  let banc: Banc;
  beforeEach(() => { banc = ouvrirLeBanc(); });
  function makeState() {
    const hero = tousLesHerosDeScenario(idsDeTest)[0]; hero.id = 'h1'; hero.pos = { x: 6, y: 10 };
    const ally = tousLesHerosDeScenario(idsDeTest)[1]; ally.id = 'h2'; ally.pos = { x: 5, y: 10 };
    const enemy = spawnEnemy({ ref: 'humain' }, 'e1', { x: 7, y: 10 }); // adjacent au héros
    const battle = {
      combatants: [hero, ally, enemy], order: ['h1', 'h2', 'e1'], baseOrder: ['h1', 'h2', 'e1'],
      turn: 0, round: 1, action: null, selectedSpellId: null, reachable: new Map(),
      movementUsed: 0, movedPreAction: false, acted: false, log: [], over: null,
    };
    banc.setState({ battle: battle as never, scene: arena(), party: [hero, ally] });
    return { hero, ally, enemy };
  }

  it('curseur sur un ennemi → intention { combattant }', () => {
    const { enemy } = makeState();
    expect(intentionDuClicDeCase(banc.getState, { x: 7, y: 10 })).toEqual({ kind: 'combattant', id: enemy.id });
  });

  it('curseur sur une case libre → intention { case }', () => {
    makeState();
    expect(intentionDuClicDeCase(banc.getState, { x: 12, y: 4 })).toEqual({ kind: 'case', pt: { x: 12, y: 4 } });
  });

  it('curseur sur un allié non actionnable → null (no-op, jamais clic-case)', () => {
    makeState();
    expect(intentionDuClicDeCase(banc.getState, { x: 5, y: 10 })).toBeNull();
  });

  it('combat terminé → null ; une case libre d’étage garde son `z`', () => {
    makeState();
    expect(intentionDuClicDeCase(banc.getState, { x: 12, y: 4, z: 1 })).toEqual({ kind: 'case', pt: { x: 12, y: 4, z: 1 } });
    banc.setState({ battle: { ...banc.getState().battle!, over: 'victoire' } as never });
    expect(intentionDuClicDeCase(banc.getState, { x: 12, y: 4 })).toBeNull();
  });

  it('hors combat → null', () => {
    banc.setState({ battle: null });
    expect(intentionDuClicDeCase(banc.getState, { x: 1, y: 1 })).toBeNull();
  });
});

describe('jouerLeClicDuCombattant / jouerLeClicDeCase — le geste du clic, lu dans l’état au moment du clic', () => {
  let banc: Banc;
  beforeEach(() => { banc = ouvrirLeBanc(); });
  /** Le verbe du champ remplacé DANS L'ÉTAT, comme l'enrobage d'intention de l'invité coop (`reseau.ts`, `transmettreLesIntentions`). */
  function poser() {
    const hero = tousLesHerosDeScenario(idsDeTest)[0]; hero.id = 'h1'; hero.pos = { x: 6, y: 10 };
    const ally = tousLesHerosDeScenario(idsDeTest)[1]; ally.id = 'h2'; ally.pos = { x: 5, y: 10 };
    const enemy = spawnEnemy({ ref: 'humain' }, 'e1', { x: 7, y: 10 });
    const battle = {
      combatants: [hero, ally, enemy], order: ['h1', 'h2', 'e1'], baseOrder: ['h1', 'h2', 'e1'],
      turn: 0, round: 1, action: null, selectedSpellId: null, reachable: new Map(),
      movementUsed: 0, movedPreAction: false, acted: false, log: [], over: null,
    };
    const clic = vi.fn();
    banc.setState({ battle: battle as never, scene: arena(), party: [hero, ally], cliquerLaCase: clic });
    return clic;
  }

  it('combattant qui agit → true, cliquerLaCase(sa case, id, confirm)', () => {
    const clic = poser();
    expect(jouerLeClicDuCombattant(banc.getState, 'e1', true)).toBe(true);
    expect(clic.mock.calls).toEqual([[{ x: 7, y: 10 }, 'e1', { confirm: true }]]);
  });

  it('combattant qui n’agit pas → false, aucun verbe', () => {
    const clic = poser();
    expect(jouerLeClicDuCombattant(banc.getState, 'h2', false)).toBe(false);
    expect(clic.mock.calls).toEqual([]);
  });

  it('case occupée par un combattant qui agit → son clic, confirm transmis', () => {
    const clic = poser();
    expect(jouerLeClicDeCase(banc.getState, { x: 7, y: 10 }, false)).toBe(true);
    expect(clic.mock.calls).toEqual([[{ x: 7, y: 10 }, 'e1', { confirm: false }]]);
  });

  it('case libre → true, cliquerLaCase(pt, sans entité, confirm)', () => {
    const clic = poser();
    expect(jouerLeClicDeCase(banc.getState, { x: 12, y: 4 }, true)).toBe(true);
    expect(clic.mock.calls).toEqual([[{ x: 12, y: 4 }, undefined, { confirm: true }]]);
  });

  it('intention nulle (allié non actionnable) → false, aucun verbe', () => {
    const clic = poser();
    expect(jouerLeClicDeCase(banc.getState, { x: 5, y: 10 }, true)).toBe(false);
    expect(clic.mock.calls).toEqual([]);
  });
});
