/**
 * Les clics du champ chez l'INVITÉ coop : `commitCursor` (curseur), `jouerLeClicDeCase` (clic-sol) et
 * `jouerLeClicDuCombattant` (frappe d'une structure, frise) lisent `cliquerLaCase` dans
 * l'état AU MOMENT du clic, donc le substitut que pose `interceptGuestActions` (`state/netFlow.ts`) : le geste
 * part en intention vers l'hôte, il ne se joue jamais en local.
 */
import { idsDeTest } from '../engine/idsDeTest.testkit';
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

/** Invité du siège 0, qui tient le tour de h1. Les verbes locaux sont des espions, que le substitut d'invité
 *  enrobe ; un espion EXTÉRIEUR enregistre ce que le site appelle dans l'état. */
function invite() {
  const hero = makePregens(idsDeTest)[0]; hero.id = 'h1'; hero.pos = { x: 6, y: 10 };
  const enemy = spawnEnemy({ ref: 'humain' }, 'e1', { x: 7, y: 10 });
  const battle = {
    combatants: [hero, enemy], order: ['h1', 'e1'], baseOrder: ['h1', 'e1'],
    turn: 0, round: 1, action: null, selectedSpellId: null, reachable: new Map(),
    movementUsed: 0, movedPreAction: false, acted: false, log: [], over: null,
  };
  const local = vi.fn();
  useGame.setState({
    battle: battle as never, scene: arena(), party: [hero], mode: 'battle',
    net: { ...initialNet(), mode: 'guest', mySeat: 0, ownership: { h1: 0 } },
    cliquerLaCase: local,
  });
  interceptGuestActions();
  const clic = vi.fn(get().cliquerLaCase);
  useGame.setState({ cliquerLaCase: clic });
  return { local, clic };
}

beforeEach(() => { useGame.setState({ battle: null, party: [], combatCursor: null, net: initialNet() }); });
afterEach(() => {
  restoreGuestActions();
  useGame.setState({ battle: null, party: [], combatCursor: null, net: initialNet() });
});

describe('clics du champ chez l’invité — le geste part en intention, à chaque site', () => {
  it('curseur (`commitCursor`) sur un ennemi', () => {
    const { local, clic } = invite();
    useGame.setState({ combatCursor: { tile: { x: 7, y: 10 } } });
    get().commitCursor();
    expect(clic.mock.calls).toEqual([[{ x: 7, y: 10 }, 'e1', { confirm: true }]]);
    expect(local.mock.calls, 'le geste s’est joué en local au lieu de partir à l’hôte').toEqual([]);
  });

  it('clic-sol (`jouerLeClicDeCase`) sur une case libre', () => {
    const { local, clic } = invite();
    expect(jouerLeClicDeCase(useGame.getState, { x: 12, y: 4 }, false)).toBe(true);
    expect(clic.mock.calls).toEqual([[{ x: 12, y: 4 }, undefined, { confirm: false }]]);
    expect(local.mock.calls, 'le geste s’est joué en local au lieu de partir à l’hôte').toEqual([]);
  });

  it('frappe d’une structure et frise (`jouerLeClicDuCombattant`) sur un ennemi', () => {
    const { local, clic } = invite();
    expect(jouerLeClicDuCombattant(useGame.getState, 'e1', false)).toBe(true);
    expect(clic.mock.calls).toEqual([[{ x: 7, y: 10 }, 'e1', { confirm: false }]]);
    expect(local.mock.calls, 'le geste s’est joué en local au lieu de partir à l’hôte').toEqual([]);
  });
});
