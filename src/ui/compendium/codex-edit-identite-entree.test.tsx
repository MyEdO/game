// @vitest-environment jsdom
/**
 * Atelier du Codex — passer d'une entrée à une autre (catégorie ou id) remonte l'atelier : aucun rendu
 * ne présente l'entrée précédente sous la catégorie suivante.
 */
import { describe, it, expect, afterEach, beforeAll } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';

import { CodexEdit } from '../editor/codex/CodexEdit';
import { datasetArray } from '../../data/overrides';

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

let container: HTMLDivElement;
let root: Root;

afterEach(() => {
  act(() => { root.unmount(); });
  container.remove();
});

describe('atelier du Codex — l’identité de l’entrée éditée', () => {
  it('Trait puis Créature : la fiche suivante est rendue dès son premier rendu, sans valeur de la précédente', () => {
    const creature = (datasetArray('creatures') as { id: string; label: string }[])[0];
    const trait = (datasetArray('traits') as { id: string; label: string }[]).find((t) => t.id === 'champion')!;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => { root.render(<CodexEdit categoryKey="traits" id="champion" onClose={() => {}} />); });
    const valeurs = () => [...container.querySelectorAll('input')].map((i) => i.value);
    expect(valeurs(), 'la sonde mord : le trait montre son libellé').toContain(trait.label);
    act(() => { root.render(<CodexEdit categoryKey="creatures" id={creature.id} onClose={() => {}} />); });
    expect(valeurs()).toContain(creature.label);
    expect(valeurs()).not.toContain(trait.label);
  });
});
