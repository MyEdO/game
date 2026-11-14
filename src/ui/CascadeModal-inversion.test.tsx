// @vitest-environment jsdom
/**
 * Bande de Peur de combat (LDB 21 l.25) rendue par `CascadeBody` : la rangée d'un héros qui porte le jeton de
 * Convalescence offre l'inversion, et le bouton annonce l'issue que la rangée écrira. ADE II 09 l.33, LDB 12 l.42
 */
import { idsDeTest } from '../engine/idsDeTest.testkit';
import { describe, it, expect, beforeEach, afterEach, beforeAll } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { useGame } from '../state/store';
import { createHero } from '../engine/character';
import { applyOps } from '../engine/ops';
import { makeRNG } from '../engine/dice';
import { testScene } from '../scenes/test-fixture';
import { openRoundEndCascade } from '../noyau/combatFlow';
import { CascadeBody } from './CascadeModal';

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

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
  useGame.setState({ pendingCascade: null, battle: null, party: [], suspendedCascades: [] });
});

/** Bande de Peur ouverte par le producteur du jeu, la rangée du héros posée à cible 55, dé 64. */
function bandeDePeur(jeton: boolean): void {
  useGame.setState({ party: [createHero({ idNeuf: idsDeTest, speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H1', seed: 1 })], pendingCascade: null });
  useGame.getState().lancerLaScene(testScene());
  useGame.getState().lancerLeCombat('enc-mutants');
  useGame.getState().fenetreValider('debutDuRound');
  const b = useGame.getState().battle!;
  const H = b.combatants.find((c) => c.kind === 'heros')!;
  const enemies = b.combatants.filter((c) => c.kind === 'ennemi');
  const E = enemies[0];
  enemies.slice(1).forEach((e) => (e.dead = true));
  E.size = 'grande';
  H.pos = { x: 10, y: 10 };
  E.pos = { x: 11, y: 10 };
  H.psychState = [{ type: 'peur', sourceId: E.id, indice: 5, calmeDR: 3, lastTestRound: b.round - 2 }];
  if (jeton) applyOps(H, [{ op: 'grantReverseToken', skill: { id: 'calme' }, contexte: 'psych' }], { idNeuf: idsDeTest, rng: makeRNG(1), label: 'Convalescence' });
  useGame.setState({ battle: { ...b, turn: b.order.indexOf(H.id) }, pendingCascade: null });
  openRoundEndCascade(useGame.getState, useGame.setState);
  const pc = useGame.getState().pendingCascade!;
  const band = pc.participants[0];
  expect(band.psychologieDeCombat?.kind, 'témoin : la bande est une Peur').toBe('peur');
  const participants = band.participants!.map((p) => (p.id === H.id ? { ...p, target: 55, result: { roll: 64, target: 55, sl: -1, success: false } } : p));
  useGame.setState({ pendingCascade: { ...pc, participants: [{ ...band, participants }, ...pc.participants.slice(1)] } });
  act(() => { root.render(<CascadeBody />); });
}

const boutonsInverser = () => [...host.querySelectorAll('button')].map((n) => n.textContent?.replace(/\s+/g, ' ').trim() ?? '').filter((s) => s.startsWith('Inverser'));

describe('Bande de Peur — bouton « Inverser »', () => {
  it('jeton de Convalescence : « Inverser → 46 (RS +1) »', () => {
    bandeDePeur(true);
    expect(boutonsInverser()).toEqual(['Inverser → 46 (RS +1)']);
  });
  it('sans jeton : aucun bouton', () => {
    bandeDePeur(false);
    expect(boutonsInverser()).toEqual([]);
  });
});
