// @vitest-environment jsdom
/** #2967 ; #3160 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import { setDataset } from '../data/overrides';
import { trappings } from '../data';
import { useVersionDesDatasets } from './useVersionDesDatasets';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const catalogueDOrigine = trappings.slice();
let root: Root | null = null;
let hote: HTMLDivElement | null = null;

afterEach(() => {
  if (root) act(() => root!.unmount());
  root = null;
  hote?.remove();
  hote = null;
  act(() => setDataset('trappings', catalogueDOrigine));
});

/** Surface qui dessine depuis le catalogue : le premier libellé d'objet, relu à chaque rendu. */
function PremierObjet() {
  useVersionDesDatasets();
  return <span>{trappings[0].label}</span>;
}

describe('useVersionDesDatasets', () => {
  it('une écriture au seam des datasets re-rend la surface qui l’appelle', () => {
    hote = document.createElement('div');
    document.body.appendChild(hote);
    root = createRoot(hote);
    act(() => root!.render(<PremierObjet />));
    expect(hote.textContent).toBe(catalogueDOrigine[0].label);
    act(() => setDataset('trappings', trappings.map((t, i) => (i === 0 ? { ...t, label: 'Objet réécrit' } : t))));
    expect(hote.textContent).toBe('Objet réécrit');
  });
});
