// @vitest-environment jsdom
/**
 * Bande de Peur de combat (LDB 21 l.25) rendue par `CascadeBody` : la barre de DR de la rangée annonce le
 * cumul APRÈS le jet que l'applier de la bande pose (`cumulEtenduDeRangee`). LDB 12 l.170-185
 */
import { idsDeTest } from '../engine/idsDeTest.testkit';
import { describe, it, expect, beforeEach, afterEach, beforeAll } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { useGame } from '../state/store';
import { createHero } from '../engine/character';
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

describe('Peur de combat entamée — barre de la rangée', () => {
  it('échec DR −2 sur un cumul de 3 (Indice 5) : la barre annonce 1 / 5 DR', () => {
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
    useGame.setState({ battle: { ...b, turn: b.order.indexOf(H.id) }, pendingCascade: null });
    openRoundEndCascade(useGame.getState, useGame.setState);
    const pc = useGame.getState().pendingCascade!;
    const band = pc.participants[0];
    expect(band.psychologieDeCombat?.kind).toBe('peur');
    const participants = band.participants!.map((p) => (p.id === H.id ? { ...p, result: { roll: 99, target: p.target, sl: -2, success: false } } : p));
    useGame.setState({ pendingCascade: { ...pc, participants: [{ ...band, participants }, ...pc.participants.slice(1)] } });
    act(() => { root.render(<CascadeBody />); });
    expect([...host.querySelectorAll('.dr-bar-val')].map((n) => n.textContent?.replace(/\s+/g, ' ').trim())).toEqual(['1 / 5 DR']);
  });
});
