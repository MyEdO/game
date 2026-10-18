// @vitest-environment jsdom
/**
 * La modale de taverne ANNONCE la Difficulté que la partie jouera (`difficulteDeBase`,
 * `engine/tavernGame.ts`) : celle de la racine du jeu quand il n'offre pas d'options.
 * NADJ 16 l.90, l.105, l.125, l.145.
 */
import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { monterRacine, demonterRacines } from '../monterRacine.testkit';
import { useGame } from '../state/store';
import { pregenParty, PREGEN } from '../data/pregens';
import { setRule, resetRule } from '../engine/policy';
import { findTavernGameById } from '../engine/tavernGame';
import { TavernGameModal } from './TavernGameModal';

const g = useGame.getState;
beforeAll(() => { (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true; });
beforeEach(() => {
  useGame.setState(useGame.getInitialState(), true);
  setRule('tavern-games', true);
  useGame.setState({ party: pregenParty(PREGEN.soldat) });
});
afterEach(() => {
  demonterRacines();
  resetRule('tavern-games');
});

describe('Modale de taverne — la Difficulté annoncée suit la donnée', () => {
  it.each([['cerevis', 'Accessible'], ['dominos', 'Accessible'], ['moulins', 'Facile'], ['pierres', 'Accessible']])('%s annonce %s', (id, attendu) => {
    act(() => { g().openTavernGames(); });
    const doc = monterRacine(<TavernGameModal />).container.ownerDocument;
    const label = findTavernGameById(id)!.label;
    const bouton = [...doc.querySelectorAll('button')].find((b) => b.textContent?.trim() === label)!;
    act(() => { bouton.click(); });
    const ligne = [...doc.querySelectorAll('p.tavern-detail')].map((p) => p.textContent ?? '').find((t) => t.startsWith('Test opposé'));
    expect(ligne).toContain(attendu);
  });
});
