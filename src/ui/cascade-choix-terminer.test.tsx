// @vitest-environment jsdom
/**
 * ÉTAPE CHOIX non tranchée (#1765, recettes 6133978543 / 6136064136) — la coquille de cascade MONTÉE
 * (`CascadeBody`) : « Terminer » est REFUSÉ et porte sa raison (`RollAction.refus` → `GatedAction`)
 * tant que `stepReady` est faux, puis s'offre une fois l'option prise. Le choix est posé par la
 * couture du jeu (`cascadeChoose`), jamais par une fixture.
 */
import { fixtureText } from '../i18n/fixtureText';
import { describe, it, expect, beforeEach, afterEach, beforeAll } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { useGame } from '../state/store';
import { startCascade } from '../noyau/cascade';
import { choiceStep } from '../noyau/rollSeam';
import { CascadeBody } from './CascadeModal';
import { avecLesTables, cleDeFixture } from '../noyau/noyau.testkit';
import { tablesDuJeu } from '../noyau/tablesDuJeu';

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

let host: HTMLDivElement;
let root: Root;

function openChoix() {
  useGame.setState({
    battle: null, party: [], pendingCascade: null, suspendedCascades: [], journal: [],
    net: { mode: 'local', mySeat: 0, roomCode: null, seatNames: {}, presence: {}, ownership: {} } as never,
  });
  const step = choiceStep({
    id: 'ch', kind: cleDeFixture('uiChoixSpy'), label: fixtureText('Dévier ou subir ?'), actorId: 'h1',
    options: [{ key: 'devier', label: fixtureText('Dévier') }, { key: 'subir', label: fixtureText('Subir') }],
  })!;
  startCascade(useGame.getState, useGame.setState, { title: 'Blessure critique', purpose: 'test', steps: [step] });
}

const render = () => act(() => { root.render(<CascadeBody />); });
const terminer = () => [...host.querySelectorAll('button')].find((b) => b.textContent?.trim() === 'Terminer');

beforeEach(() => {
  avecLesTables({ appliers: { ...tablesDuJeu().appliers, uiChoixSpy: () => {} } });
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

describe('Étape CHOIX : « Terminer » refusé avec sa raison tant que le choix n’est pas tranché', () => {
  it('non tranché : `aria-disabled` + raison lisible ; tranché : offert', () => {
    openChoix();
    render();
    const avant = terminer();
    expect(avant, 'le bouton « Terminer » est servi').toBeTruthy();
    expect(avant!.getAttribute('aria-disabled')).toBe('true');
    const raisonId = avant!.getAttribute('aria-describedby');
    expect(raisonId, 'le refus pointe sur un texte').toBeTruthy();
    expect(document.getElementById(raisonId!)?.textContent).toContain('Choisis une option');

    act(() => { useGame.getState().cascadeChoose('ch', 'subir'); });
    const apres = terminer();
    expect(apres!.getAttribute('aria-disabled')).toBeNull();
    expect(apres!.disabled).toBe(false);
  });
});
