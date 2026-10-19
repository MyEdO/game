// @vitest-environment jsdom
/**
 * #2724 — ↓ sur l'ancrage d'une infobulle épinglable, dans un dialogue : l'ancrage le prend à sa capture,
 * avant le piège du dialogue, le focus entre dans la boîte au lieu de rouler au contrôle suivant.
 */
import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { monterRacine, demonterRacines } from '../monterRacine.testkit';
import { resetDismissLayers } from './useDismissLayer';
import { Modal } from './Modal';
import { useInfobulle } from './Infobulle';

beforeAll(() => { (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true; });
beforeEach(() => resetDismissLayers());
afterEach(() => demonterRacines());

function AncreEpinglable() {
  const bulle = useInfobulle({ atteignable: true, epinglable: true, sourdine: false, auToucher: false });
  return (
    <>
      <span {...bulle.ancrage}><button type="button">Parade</button></span>
      {bulle.boite(<button type="button">Ouvrir la fiche</button>)}
    </>
  );
}

describe('épinglage au clavier — dans un dialogue', () => {
  it('↓ sur l’ancrage épingle la boîte et y porte le focus ; le piège ne roule pas au contrôle suivant', () => {
    monterRacine(<Modal title="Jet"><AncreEpinglable /><button type="button">Suivant</button></Modal>);
    const ancre = [...document.querySelectorAll('button')].find((b) => b.textContent === 'Parade')!;
    act(() => ancre.focus());
    const appui = new KeyboardEvent('keydown', { key: 'ArrowDown', code: 'ArrowDown', bubbles: true, cancelable: true });
    act(() => { ancre.dispatchEvent(appui); });
    expect(appui.defaultPrevented).toBe(true);
    expect(document.activeElement?.textContent, '↓ a roulé le focus du dialogue au lieu d’épingler').toBe('Ouvrir la fiche');
  });
});
