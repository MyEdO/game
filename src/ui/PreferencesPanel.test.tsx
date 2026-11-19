// @vitest-environment jsdom
/**
 * Le panneau « Confort de jeu » et les contrôles audio (#3949) : chaque volume de canal de la table rend son curseur,
 * à ses bornes et à son pas, qui écrit par `setPreference` ; `AudioControls` ne porte que la préférence `son-coupe`,
 * réglée par la même couture (#4081).
 */
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { act } from 'react';
import { PreferencesPanel } from './PreferencesPanel';
import { AudioControls } from './AudioControls';
import { preferenceDef } from '../noyau/preferences';
import { CANAUX_DE_SON } from '../data/sons/types';
import { monterRacine, demonterRacines } from '../monterRacine.testkit';
import { poserLeLocalStorage } from '../lib/stockage.testkit';

const volumeDesEffets = preferenceDef('volume-effets')!;
const sonCoupe = preferenceDef('son-coupe')!;

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  poserLeLocalStorage();
});
afterEach(() => {
  demonterRacines();
  volumeDesEffets.set(volumeDesEffets.default);
  sonCoupe.set(sonCoupe.default);
  vi.unstubAllGlobals();
});

/** Bouge un `<input>` contrôlé par React (setter natif, puis `input`). */
function bouger(input: HTMLInputElement, texte: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
  act(() => {
    setter.call(input, texte);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

describe('PreferencesPanel — la forme `param`', () => {
  it('un curseur par volume de canal, à ses bornes et à son pas', () => {
    const { container } = monterRacine(<PreferencesPanel />);
    const curseurs = [...container.querySelectorAll<HTMLInputElement>('input[type="range"]')];
    const volumes = CANAUX_DE_SON.map((c) => preferenceDef(`volume-${c}`)!);
    expect(curseurs.map((c) => c.getAttribute('aria-label'))).toEqual(volumes.map((v) => v.label));
    for (const c of curseurs) expect([c.min, c.max, c.step], c.getAttribute('aria-label')!).toEqual(['0', '1', '0.05']);
  });

  it('bouger un volume l’écrit dans la table et le persiste', () => {
    const { container } = monterRacine(<PreferencesPanel />);
    const curseur = container.querySelector<HTMLInputElement>(`input[type="range"][aria-label="${volumeDesEffets.label}"]`)!;
    bouger(curseur, '0.4');
    expect(volumeDesEffets.get()).toBe(0.4);
    expect(JSON.parse(localStorage.getItem('wfrp4.prefs')!)).toMatchObject({ 'volume-effets': 0.4 });
  });
});

describe('AudioControls — la préférence `son-coupe` seule', () => {
  it('un seul contrôle : le bouton qui coupe le son', () => {
    const { container } = monterRacine(<AudioControls />);
    expect([...container.querySelectorAll('button, input, select')].map((e) => e.getAttribute('aria-label'))).toEqual(['Couper le son']);
  });

  it('le bouton écrit la préférence dans la table et la persiste, puis la rétablit', () => {
    const { container } = monterRacine(<AudioControls />);
    const bouton = container.querySelector('button')!;
    act(() => bouton.click());
    expect(sonCoupe.get()).toBe(true);
    expect(JSON.parse(localStorage.getItem('wfrp4.prefs')!)).toMatchObject({ 'son-coupe': true });
    expect(bouton.getAttribute('aria-label')).toBe('Réactiver le son');
    act(() => bouton.click());
    expect(sonCoupe.get()).toBe(false);
  });
});
