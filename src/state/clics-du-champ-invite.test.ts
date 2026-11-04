/**
 * Les clics du champ chez l'INVITÉ coop : `commitCursor` (curseur), `jouerLeClicDeCase` (clic-sol) et
 * `jouerLeClicDuCombattant` (frappe d'une structure, frise) lisent `battleClickEntity`/`battleClickTile` dans
 * l'état AU MOMENT du clic, donc le substitut que pose `interceptGuestActions` (`state/netFlow.ts`) : le geste
 * part en intention vers l'hôte, il ne se joue jamais en local.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useGame } from './store';
import { interceptGuestActions, restoreGuestActions } from './netFlow';
import { initialNet } from '../noyau/etat';
import { jouerLeClicDeCase, jouerLeClicDuCombattant } from '../noyau/combatOrParty';
import { makePregens } from '../data/pregens';
import { spawnEnemy } from '../noyau/monde/spawn';

const get = () => useGame.getState();
const arena = () => {
  const w = 22, h = 16;
  return { id: 's', dimensions: { w, h }, layers: [{ z: 0, tiles: new Array(w * h).fill('herbe') }], entities: [], dialogues: [], triggers: [], encounters: [] } as never;
};
const reels = { battleClickEntity: get().battleClickEntity, battleClickTile: get().battleClickTile };

/** Invité du siège 0, qui tient le tour de h1. Les verbes locaux sont des espions, que le substitut d'invité
 *  enrobe ; un espion EXTÉRIEUR enregistre ce que le site appelle dans l'état. */
function invite() {
  const hero = makePregens()[0]; hero.id = 'h1'; hero.pos = { x: 6, y: 10 };
  const enemy = spawnEnemy({ ref: 'humain' }, 'e1', { x: 7, y: 10 });
  const battle = {
    combatants: [hero, enemy], order: ['h1', 'e1'], baseOrder: ['h1', 'e1'],
    turn: 0, round: 1, action: null, selectedSpellId: null, reachable: new Map(),
    movementUsed: 0, movedPreAction: false, acted: false, log: [], over: null,
  };
  const localE = vi.fn(), localT = vi.fn();
  useGame.setState({
    battle: battle as never, scene: arena(), party: [hero], mode: 'battle',
    net: { ...initialNet(), mode: 'guest', mySeat: 0, ownership: { h1: 0 } },
    battleClickEntity: localE, battleClickTile: localT,
  });
  interceptGuestActions();
  const entite = vi.fn(get().battleClickEntity), tuile = vi.fn(get().battleClickTile);
  useGame.setState({ battleClickEntity: entite, battleClickTile: tuile });
  return { localE, localT, entite, tuile };
}

beforeEach(() => { useGame.setState({ battle: null, party: [], combatCursor: null, net: initialNet() }); });
afterEach(() => {
  restoreGuestActions();
  useGame.setState({ ...reels, battle: null, party: [], combatCursor: null, net: initialNet() });
});

describe('clics du champ chez l’invité — le geste part en intention, à chaque site', () => {
  it('curseur (`commitCursor`) sur un ennemi', () => {
    const { localE, localT, entite, tuile } = invite();
    useGame.setState({ combatCursor: { tile: { x: 7, y: 10 } } });
    get().commitCursor();
    expect(entite.mock.calls).toEqual([['e1', { confirm: true }]]);
    expect(tuile.mock.calls).toEqual([]);
    expect(localE.mock.calls, 'le geste s’est joué en local au lieu de partir à l’hôte').toEqual([]);
    expect(localT.mock.calls).toEqual([]);
  });

  it('clic-sol (`jouerLeClicDeCase`) sur une case libre', () => {
    const { localE, localT, entite, tuile } = invite();
    expect(jouerLeClicDeCase(useGame.getState, { x: 12, y: 4 }, false)).toBe(true);
    expect(tuile.mock.calls).toEqual([[{ x: 12, y: 4 }, { confirm: false }]]);
    expect(entite.mock.calls).toEqual([]);
    expect(localT.mock.calls, 'le geste s’est joué en local au lieu de partir à l’hôte').toEqual([]);
    expect(localE.mock.calls).toEqual([]);
  });

  it('frappe d’une structure et frise (`jouerLeClicDuCombattant`) sur un ennemi', () => {
    const { localE, entite, tuile } = invite();
    expect(jouerLeClicDuCombattant(useGame.getState, 'e1', false)).toBe(true);
    expect(entite.mock.calls).toEqual([['e1', { confirm: false }]]);
    expect(tuile.mock.calls).toEqual([]);
    expect(localE.mock.calls, 'le geste s’est joué en local au lieu de partir à l’hôte').toEqual([]);
  });
});
