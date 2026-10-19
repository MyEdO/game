// @vitest-environment jsdom
/**
 * #2724 — le remap d'un raccourci (panneau Clavier) est une couche de la pile : Échap
 * l'annule SEUL, la surface qui la porte reste ouverte ; la touche suivante est la donnée capturée.
 */
import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest';
import { act } from 'react';
import { monterRacine, demonterRacines } from '../../monterRacine.testkit';
import { useGame } from '../../state/store';
import { resetDismissLayers } from '../useDismissLayer';
import { Modal } from '../Modal';
import { KeyBindingsPanel } from '../KeyBindingsPanel';

beforeAll(() => { (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true; });
beforeEach(() => resetDismissLayers());
afterEach(() => {
  demonterRacines();
  useGame.getState().resetKeyBindings();
});

const appui = (code: string, key = code) => {
  const cible = document.activeElement ?? document.body;
  act(() => { cible.dispatchEvent(new KeyboardEvent('keydown', { key, code, bubbles: true, cancelable: true })); });
  act(() => { cible.dispatchEvent(new KeyboardEvent('keyup', { key, code, bubbles: true, cancelable: true })); });
};

/** Le panneau Clavier dans une modale, la capture armée sur son premier raccourci. */
function armerLaCapture() {
  const fermer = vi.fn();
  monterRacine(<Modal title="Options" onClose={fermer}><KeyBindingsPanel /></Modal>);
  const bouton = document.querySelector<HTMLButtonElement>('.opt-key-row button[aria-pressed]')!;
  act(() => { bouton.focus(); bouton.click(); });
  expect(bouton.getAttribute('aria-pressed')).toBe('true');
  return { fermer, bouton };
}

describe('capture d’une touche — couche de la pile', () => {
  it('Échap annule la capture SEULE : la modale reste, aucune touche n’est réassignée ; l’Échap suivant la ferme', () => {
    const { fermer, bouton } = armerLaCapture();
    appui('Escape');
    expect(bouton.getAttribute('aria-pressed'), 'Échap n’a pas annulé la capture').toBe('false');
    expect(fermer, 'Échap pendant la capture a fermé la surface qui la porte').not.toHaveBeenCalled();
    expect(useGame.getState().keyOverrides).toEqual({});
    appui('Escape');
    expect(fermer).toHaveBeenCalledOnce();
  });

  it('la touche suivante est capturée par sa position, et la modale reste ouverte ; une touche sans position (clavier virtuel) n’en désigne aucune', () => {
    const { fermer, bouton } = armerLaCapture();
    appui('ShiftLeft');
    expect(bouton.getAttribute('aria-pressed'), 'un modificateur seul a clos la capture').toBe('true');
    appui('', 'j');
    expect(bouton.getAttribute('aria-pressed'), 'une touche sans position a clos la capture').toBe('true');
    appui('KeyJ');
    expect(bouton.getAttribute('aria-pressed')).toBe('false');
    expect(Object.values(useGame.getState().keyOverrides)).toEqual(['KeyJ']);
    expect(fermer).not.toHaveBeenCalled();
  });
});
