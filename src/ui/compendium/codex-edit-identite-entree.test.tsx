// @vitest-environment jsdom
/**
 * Atelier du Codex — passer d'une entrée à une autre (catégorie ou id) remonte l'atelier : aucun rendu
 * ne présente l'entrée précédente sous la catégorie suivante (un Trait sous les Créatures faisait
 * prévisualiser « Champion » sans espèce, `src/gameIso/rig/bodyPlan.ts:210`).
 */
import { describe, it, expect, afterEach, beforeAll, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';

import { CodexEdit } from '../editor/codex/CodexEdit';
import { datasetArray } from '../../data/overrides';
import { resetDiagOnce } from '../../gameIso/rig/devDiag';

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

let container: HTMLDivElement;
let root: Root;

afterEach(() => {
  act(() => { root.unmount(); });
  container.remove();
  vi.restoreAllMocks();
});

describe('atelier du Codex — l’identité de l’entrée éditée', () => {
  it('Trait puis Créature : aucun aperçu sans espèce, la fiche suivante est rendue dès son premier rendu', () => {
    const creature = (datasetArray('creatures') as { id: string; label: string }[])[0];
    resetDiagOnce();
    const erreurs = vi.spyOn(console, 'error').mockImplementation(() => {});
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => { root.render(<CodexEdit categoryKey="traits" id="champion" onClose={() => {}} />); });
    act(() => { root.render(<CodexEdit categoryKey="creatures" id={creature.id} onClose={() => {}} />); });
    expect(erreurs.mock.calls.map((c) => String(c[0])).filter((m) => /aucune espèce résolue/.test(m))).toEqual([]);
    expect(container.querySelector('.creature-preview-svg')?.getAttribute('aria-label')).toBe(`${creature.label} (front)`);
  });
});
