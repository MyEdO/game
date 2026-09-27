// @vitest-environment jsdom
/**
 * RANGÉE DE READY-CHECK (#1411 P2-A) — la primitive n'affiche QUE les sièges que le dispatcher
 * attend (`siegesRequis`) : les deux rangées d'origine (VictoryScreen, RestModal) montraient TOUS
 * les `net.seatNames`, y compris un siège sans héros vivant — un joueur voyait « en attente » un
 * siège que le quorum n'attendait pas. Le nom du siège est RENDU (il vivait dans un `title`, donc
 * invisible), et l'état prêt/attendu est lisible par siège.
 */
import { describe, it, expect, beforeEach, afterEach, beforeAll } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { useGame } from '../state/store';
import { createHero } from '../engine/character';
import type { Combatant } from '../engine/types';
import { ReadyRow } from './ReadyRow';

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

function hero(id: string, label: string, over: Partial<Combatant> = {}): Combatant {
  const h = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label, seed: 2 });
  h.id = id;
  return Object.assign(h, over);
}

let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  useGame.setState({ net: { ...useGame.getState().net, mode: 'local', ownership: {}, seatNames: {} } });
});

/** Trois sièges NOMMÉS ; le 3ᵉ ne tient aucun héros, le 2ᵉ en tient un dont l'état varie. */
function table(over: Partial<Combatant> = {}, ready: Record<number, boolean> = {}) {
  act(() => {
    useGame.setState({
      party: [hero('h1', 'Gunnar'), hero('h2', 'Rolf', over)],
      net: { ...useGame.getState().net, mode: 'host', mySeat: 0, ownership: { h1: 0, h2: 1 }, seatNames: { 0: 'L’hôte', 1: 'Rolf', 2: 'Spectateur' } },
    });
  });
  act(() => { root.render(<ReadyRow ready={ready} />); });
  return [...host.querySelectorAll('.ready-chip')] as HTMLElement[];
}

describe('ReadyRow — n’affiche que les sièges REQUIS', () => {
  it('TÉMOIN : deux sièges tiennent un héros en jeu, le 3ᵉ n’en tient aucun → deux chips', () => {
    const chips = table();
    expect(chips.map((c) => c.getAttribute('data-seat'))).toEqual(['0', '1']);
  });

  it('un siège dont le seul héros est MORT sort de la rangée', () => {
    const chips = table({ dead: true });
    expect(chips.map((c) => c.getAttribute('data-seat')), 'un siège non requis était affiché « en attente »').toEqual(['0']);
  });

  it('chaque chip DIT son siège et son état (prêt / attendu), sans title invisible', () => {
    const chips = table({}, { 0: true });
    expect(chips[0].hasAttribute('data-pret'), 'le siège validé n’est pas marqué').toBe(true);
    expect(chips[1].hasAttribute('data-pret'), 'un siège en attente est marqué prêt').toBe(false);
    expect(chips[0].className).toContain('ok');
    expect(chips[0].textContent).toContain('L’hôte');
    expect(chips[1].textContent).toContain('Rolf');
    expect(host.querySelector('[title]'), 'le nom du siège ne doit plus vivre dans un title').toBeNull();
  });
});
