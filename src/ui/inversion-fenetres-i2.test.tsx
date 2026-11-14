// @vitest-environment jsdom
/**
 * Fenêtres qui gagnent l'inversion (LDB 12 l.42) : Activité (Studieux LDB 11 l.55), Battement (jeton
 * d'Entraînement au Combat LDB 23 l.209, LDB 10 l.103) et Test étendu (Studieux sur Recherche). Le bouton
 * annonce l'issue que le flux écrira.
 */
import { idsDeTest } from '../engine/idsDeTest.testkit';
import { describe, it, expect, beforeEach, afterEach, beforeAll } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { useGame } from '../state/store';
import { createHero } from '../engine/character';
import { applyOps } from '../engine/ops';
import { makeRNG } from '../engine/dice';
import { hydrateTR } from '../engine/tests';
import type { Combatant } from '../engine/types';
import type { PendingActivity } from '../noyau/interludeFlow';
import { ActivityModal } from './ActivityModal';
import { BattementModal } from './BattementModal';
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
  useGame.setState({ pendingActivity: null, pendingBattement: null, pendingExtendedTest: null, pendingCascade: null, battle: null, party: [] });
});

const heros = (label: string, studieux: boolean): Combatant => {
  const h = createHero({ idNeuf: idsDeTest, speciesId: 'humains-reiklander', careerId: 'soldat', label, seed: 1 });
  h.talents = studieux ? [...(h.talents ?? []), { talentId: 'studieux', times: 1 }] : (h.talents ?? []).filter((t) => t.talentId !== 'studieux');
  return h;
};
const boutonsInverser = () => [...host.querySelectorAll('button')].map((n) => n.textContent?.replace(/\s+/g, ' ').trim() ?? '').filter((s) => s.startsWith('Inverser'));

describe('Activité — bouton « Inverser »', () => {
  const ouvrir = (studieux: boolean) => {
    const h = heros('H1', studieux);
    const pa = {
      heroId: h.id, kind: 'catalog', label: 'Recherche universitaire', skillLabel: 'Recherche', skillValue: 55, difficulty: 'intermediaire',
      ligne: { base: 55, mods: [], target: 55, difficulty: 'intermediaire' }, roll: 64, target: 55, sl: -1, success: false, chosenSkill: { id: 'recherche' },
    } as unknown as PendingActivity;
    useGame.setState({ party: [h], pendingActivity: pa });
    act(() => { root.render(<ActivityModal />); });
  };
  it('Studieux sur la Recherche : « Inverser → 46 (RS +1) »', () => {
    ouvrir(true);
    expect(boutonsInverser()).toEqual(['Inverser → 46 (RS +1)']);
  });
  it('sans Talent : aucun bouton', () => {
    ouvrir(false);
    expect(boutonsInverser()).toEqual([]);
  });
});

describe('Battement — bouton « Inverser »', () => {
  const ouvrir = (jeton: boolean) => {
    const h = heros('H1', false);
    const e = { ...heros('E1', false), id: 'E1', kind: 'ennemi' as const };
    h.pos = { x: 1, y: 1 }; e.pos = { x: 2, y: 1 };
    if (jeton) applyOps(h, [{ op: 'grantReverseToken', skill: { id: 'corps-a-corps' } }], { idNeuf: idsDeTest, rng: makeRNG(1), label: 'Entraînement au Combat' });
    useGame.setState({
      battle: { combatants: [h, e], order: [h.id, e.id], turn: 0, round: 1, log: [], over: null } as never,
      pendingBattement: { attackerId: h.id, foeId: e.id, result: hydrateTR({ roll: 64, target: 55, base: 45, sl: -1, success: false }) },
    });
    act(() => { root.render(<BattementModal />); });
  };
  it('jeton d’Entraînement (Corps à corps) : « Inverser → 46 (RS +1) »', () => {
    ouvrir(true);
    expect(boutonsInverser()).toEqual(['Inverser → 46 (RS +1)']);
  });
  it('sans jeton : aucun bouton', () => {
    ouvrir(false);
    expect(boutonsInverser()).toEqual([]);
  });
});

describe('Test étendu — bouton « Inverser »', () => {
  const ouvrir = (studieux: boolean) => {
    const h = heros('H1', studieux);
    useGame.setState({ party: [h], battle: null, pendingCascade: null });
    useGame.getState().ouvrirLeTestEtendu({ actorId: h.id, label: 'Fouiller les archives', skillLabel: 'Recherche', skill: { id: 'recherche' }, target: 55, drCible: 5 });
    const p = useGame.getState().pendingExtendedTest!;
    useGame.setState({ pendingExtendedTest: { ...p, rounds: [{ ...p.rounds[0], result: { roll: 64, sl: -1, success: false } }] } });
    act(() => { root.render(<CascadeBody />); });
  };
  it('Studieux sur une Recherche étendue : « Inverser → 46 (RS +1) »', () => {
    ouvrir(true);
    expect(boutonsInverser()).toEqual(['Inverser → 46 (RS +1)']);
  });
  it('sans Talent : aucun bouton', () => {
    ouvrir(false);
    expect(boutonsInverser()).toEqual([]);
  });
});
