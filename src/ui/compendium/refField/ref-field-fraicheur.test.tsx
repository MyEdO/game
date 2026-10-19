// @vitest-environment jsdom
/**
 * #2724 — les options d'un `RefField` sur dataset se recalculent à chaque écriture au seam
 * (`setDataset`, édition au Codex) : un `<select>` monté propose l'entrée écrite après son montage.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { RefField } from './RefField';
import { resetData, setDataset } from '../../../data/overrides';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const montes: (() => void)[] = [];
afterEach(() => { montes.splice(0).forEach((demonter) => demonter()); resetData(); });

/** Livre NOMMÉ du banc, écrit à la main : seuls `id` et `label` portent le contrat. */
const LIVRE_DE_BANC = { id: 'livre-de-banc', type: 'books', label: 'Livre de banc', abbr: 'LDBANC', language: 'VF', folder: null } as const;

describe('RefField — fraîcheur des options', () => {
  it('une entrée écrite au catalogue après le montage devient une option', () => {
    setDataset('books', []);
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);
    act(() => { root.render(<RefField cfg={{ ds: 'books', single: true }} ariaLabel="Livre" value="" onChange={() => {}} />); });
    montes.push(() => { act(() => { root.unmount(); }); host.remove(); });
    const valeurs = () => [...host.querySelectorAll('option')].map((o) => o.value);
    expect(valeurs()).not.toContain('livre-de-banc');
    act(() => setDataset('books', [LIVRE_DE_BANC]));
    expect(valeurs()).toContain('livre-de-banc');
  });
});
