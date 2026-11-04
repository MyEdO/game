/**
 * `intentionDuClicDeCase` (noyau) : ce que joue la case → ennemi → attaque, case libre → déplacement, allié → rien ;
 * `jouerLeClicDuCombattant` / `jouerLeClicDeCase` : le geste joué, lu par le commit du curseur, le clic-sol
 * (`useStagePointer.performClick`), la frappe d'une structure et la frise. Le curseur clavier et manette se joue en
 * `src/state/combatCursor.test.ts`.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { intentionDuClicDeCase, jouerLeClicDeCase, jouerLeClicDuCombattant } from './combatOrParty';
import { makePregens } from '../data/pregens';
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
    const hero = makePregens()[0]; hero.id = 'h1'; hero.pos = { x: 6, y: 10 };
    const ally = makePregens()[1]; ally.id = 'h2'; ally.pos = { x: 5, y: 10 };
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
    banc.setState({ battle: { ...banc.getState().battle!, over: 'victory' } as never });
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
  /** Les verbes du champ remplacés DANS L'ÉTAT, comme l'enrobage d'intention de l'invité coop (`state/netFlow.ts`). */
  function poser() {
    const hero = makePregens()[0]; hero.id = 'h1'; hero.pos = { x: 6, y: 10 };
    const ally = makePregens()[1]; ally.id = 'h2'; ally.pos = { x: 5, y: 10 };
    const enemy = spawnEnemy({ ref: 'humain' }, 'e1', { x: 7, y: 10 });
    const battle = {
      combatants: [hero, ally, enemy], order: ['h1', 'h2', 'e1'], baseOrder: ['h1', 'h2', 'e1'],
      turn: 0, round: 1, action: null, selectedSpellId: null, reachable: new Map(),
      movementUsed: 0, movedPreAction: false, acted: false, log: [], over: null,
    };
    const entite = vi.fn(), tuile = vi.fn();
    banc.setState({ battle: battle as never, scene: arena(), party: [hero, ally], battleClickEntity: entite, battleClickTile: tuile });
    return { entite, tuile };
  }

  it('combattant qui agit → true, battleClickEntity(id, confirm)', () => {
    const { entite, tuile } = poser();
    expect(jouerLeClicDuCombattant(banc.getState, 'e1', true)).toBe(true);
    expect(entite.mock.calls).toEqual([['e1', { confirm: true }]]);
    expect(tuile.mock.calls).toEqual([]);
  });

  it('combattant qui n’agit pas → false, aucun verbe', () => {
    const { entite, tuile } = poser();
    expect(jouerLeClicDuCombattant(banc.getState, 'h2', false)).toBe(false);
    expect(entite.mock.calls).toEqual([]);
    expect(tuile.mock.calls).toEqual([]);
  });

  it('case occupée par un combattant qui agit → son clic, confirm transmis', () => {
    const { entite, tuile } = poser();
    expect(jouerLeClicDeCase(banc.getState, { x: 7, y: 10 }, false)).toBe(true);
    expect(entite.mock.calls).toEqual([['e1', { confirm: false }]]);
    expect(tuile.mock.calls).toEqual([]);
  });

  it('case libre → true, battleClickTile(pt, confirm)', () => {
    const { entite, tuile } = poser();
    expect(jouerLeClicDeCase(banc.getState, { x: 12, y: 4 }, true)).toBe(true);
    expect(tuile.mock.calls).toEqual([[{ x: 12, y: 4 }, { confirm: true }]]);
    expect(entite.mock.calls).toEqual([]);
  });

  it('intention nulle (allié non actionnable) → false, aucun verbe', () => {
    const { entite, tuile } = poser();
    expect(jouerLeClicDeCase(banc.getState, { x: 5, y: 10 }, true)).toBe(false);
    expect(entite.mock.calls).toEqual([]);
    expect(tuile.mock.calls).toEqual([]);
  });
});
