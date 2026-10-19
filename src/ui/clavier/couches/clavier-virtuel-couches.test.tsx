// @vitest-environment jsdom
/**
 * #2724 — les couches lisent leurs touches NOMMÉES par `e.key` : un clavier virtuel (mobile) émet
 * Entrée, Échap, Tab et les flèches sans position (`code` vide), et la modale y répond comme au
 * clavier physique.
 */
import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { act } from 'react';
import { monterRacine, demonterRacines } from '../../../monterRacine.testkit';
import { Modal } from '../../Modal';
import { rendreVisible } from '../../layoutJsdom.testkit';
import { resetDismissLayers } from '../../useDismissLayer';

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});
afterEach(() => { demonterRacines(); resetDismissLayers(); });

/** Appui d'un clavier virtuel : la touche nommée, aucune position. */
const appuiVirtuel = (cible: EventTarget, key: string, shiftKey = false) =>
  act(() => { cible.dispatchEvent(new KeyboardEvent('keydown', { key, code: '', shiftKey, bubbles: true, cancelable: true })); });

function monter() {
  const compte = { valide: 0, ferme: 0 };
  const { container } = monterRacine(
    <Modal title="Saisie" onClose={() => { compte.ferme += 1; }}
      footer={<><button className="btn">Autre</button><button className="btn btn-primary" onClick={() => { compte.valide += 1; }}>Appliquer</button></>}>
      <p>Corps</p>
    </Modal>,
  );
  container.querySelectorAll<HTMLElement>('button').forEach(rendreVisible);
  return { compte, autre: container.querySelector<HTMLElement>('.btn:not(.btn-primary)')!, primaire: container.querySelector<HTMLElement>('.btn-primary')! };
}

describe('Couches clavier — touches nommées sans position', () => {
  it('Entrée valide la boîte par son primaire', () => {
    const { compte } = monter();
    (document.activeElement as HTMLElement | null)?.blur();
    appuiVirtuel(document.body, 'Enter');
    expect(compte.valide).toBe(1);
  });

  it('Échap ferme la modale', () => {
    const { compte } = monter();
    appuiVirtuel(document.body, 'Escape');
    expect(compte.ferme).toBe(1);
  });

  it('les flèches roulent le focus, Tab et Maj+Tab bouclent dans la boîte', () => {
    const { autre, primaire } = monter();
    autre.focus();
    appuiVirtuel(autre, 'ArrowDown');
    expect(document.activeElement).toBe(primaire);
    appuiVirtuel(primaire, 'ArrowUp');
    expect(document.activeElement).toBe(autre);
    primaire.focus();
    appuiVirtuel(primaire, 'Tab');
    expect(document.activeElement).toBe(autre);
    appuiVirtuel(autre, 'Tab', true);
    expect(document.activeElement).toBe(primaire);
  });
});
