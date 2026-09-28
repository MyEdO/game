// @vitest-environment jsdom
/**
 * Le choix RETENU d'un appelant se marque `selected` (`aria-pressed`), jamais par un `primary` dérivé
 * de l'égalité : `focusTarget` (`Modal.tsx`) prendrait l'option peinte pour l'option OFFERTE, et le
 * focus initial irait sur le choix déjà posé au lieu du geste qui valide. Mesuré sur l'appelant réel
 * (Activités en mer, verdict du juge B11, D1).
 */
import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { useGame } from '../state/store';
import { createHero } from '../engine/character';
import type { PendingSeaActivities, SeaActivityPick } from '../state/seaActivities';
import { SeaActivitiesModal } from './SeaActivitiesModal';
import { poserLayoutJsdom } from './layoutJsdom.testkit';
import { resetDismissLayers } from './useDismissLayer';

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

let host: HTMLDivElement;
let root: Root;
let retirerLayout: () => void;
const etatInitial = useGame.getState();

beforeEach(() => {
  resetDismissLayers();
  retirerLayout = poserLayoutJsdom();
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  retirerLayout();
  resetDismissLayers();
  useGame.setState(etatInitial, true);
});

const actif = () => (document.activeElement?.textContent ?? '').trim();

describe('Activités en mer — le choix posé est RETENU, le focus va au geste qui valide', () => {
  it('à l’ouverture : « Repos » est retenue (`aria-pressed`), le focus est sur « Valider la semaine », Entrée valide', () => {
    const hero = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'Vétéran', seed: 42 });
    const valides: Record<string, SeaActivityPick | null>[] = [];
    useGame.setState({
      party: [hero],
      vessel: null,
      pendingSeaActivities: { day: { events: [] } } as unknown as PendingSeaActivities,
      seaActivitiesConfirm: (picks) => { valides.push(picks); },
    });
    act(() => root.render(<SeaActivitiesModal />));
    const repos = [...host.querySelectorAll<HTMLButtonElement>('.rm-loc-grid button')].find((b) => b.textContent === 'Repos');
    expect(repos?.getAttribute('aria-pressed')).toBe('true');
    expect(actif()).toBe('Valider la semaine');
    act(() => { (document.activeElement as HTMLElement).click(); });
    expect(valides).toHaveLength(1);
  });
});
