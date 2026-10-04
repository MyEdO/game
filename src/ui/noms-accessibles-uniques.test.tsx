import type { JSX } from 'react';
// @vitest-environment jsdom
/**
 * #1993 F6 — dans un formulaire d'édition, chaque contrôle porte un nom accessible, UNIQUE, dérivé de
 * sa position (le `sujet`) : l'éditeur Narratif (indice à deux stades, deux PNJ) et une entrée du
 * Codex à rangées (listes de valeurs, rangées d'objets, record de textes, variantes). Le nom est
 * calculé comme le navigateur le calcule (`nomsAccessibles.testkit`).
 */
import { describe, it, expect, afterEach, beforeAll } from 'vitest';
import { act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';

import { NarratifEditor } from './editor/NarratifEditor';
import { CodexEdit } from './compendium/CodexEdit';
import { emptyNarratif, type NarratifBlock } from '../state/campaignNarratif';
import { creatures } from '../data';
import { datasetArray, resetData, setDataset } from '../data/overrides';
import { defautsDeNoms, nomAccessible } from './nomsAccessibles.testkit';

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

let container: HTMLDivElement;
let root: Root;
afterEach(() => {
  act(() => { root.unmount(); });
  container.remove();
  resetData();
});
function monter(el: JSX.Element) {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => { root.render(el); });
}

const bouton = (texte: string) => {
  const b = [...container.querySelectorAll('button')].find((x) => (x.textContent ?? '').includes(texte));
  if (!b) throw new Error(`bouton « ${texte} » introuvable`);
  return b;
};
const cliquer = (el: HTMLElement) => act(() => { el.dispatchEvent(new MouseEvent('click', { bubbles: true })); });

function Narratif({ initial }: { initial: NarratifBlock }) {
  const [n, setN] = useState(initial);
  return <NarratifEditor narratif={n} onChange={setN} onClose={() => {}} />;
}

describe('noms accessibles uniques — éditeur Narratif', () => {
  const base = creatures[0].id;
  const narratif: NarratifBlock = {
    ...emptyNarratif(),
    affaires: [{ id: 'affaire-1', titre: 'Affaire' }, { id: 'affaire-2', titre: 'Affaire' }],
    indices: [
      { id: 'indice-1', affaireId: 'affaire-1', kind: 'indice', titre: 'Indice', stades: [{ id: 'stade-1', prose: '' }, { id: 'stade-2', prose: '' }] },
      { id: 'indice-2', affaireId: 'affaire-1', kind: 'indice', titre: 'Indice', stades: [{ id: 'stade-1', prose: '' }] },
      { id: 'indice-3', affaireId: 'affaire-2', kind: 'rumeur', titre: 'Indice', stades: [{ id: 'stade-1', prose: '' }] },
    ],
    presetsPnj: [{ id: 'pnj-1', base }, { id: 'pnj-2', base }],
  };

  it('onglet Indices (deux stades, recoupements homonymes) : aucun contrôle sans nom, aucun doublon', () => {
    monter(<Narratif initial={narratif} />);
    cliquer(bouton('Indices'));
    expect(container.querySelectorAll('textarea'), 'l’indice mesuré n’a pas deux stades').toHaveLength(2);
    const d = defautsDeNoms(container.querySelector('[role="dialog"]')!);
    expect(d.total).toBeGreaterThan(10);
    expect(d.sansNom).toEqual([]);
    expect(d.doublons).toEqual([]);
  });

  it('onglet PNJ (deux PNJ) : aucun contrôle sans nom, aucun doublon', () => {
    monter(<Narratif initial={narratif} />);
    cliquer(bouton('PNJ'));
    const d = defautsDeNoms(container.querySelector('[role="dialog"]')!);
    expect(d.total).toBeGreaterThan(10);
    expect(d.sansNom).toEqual([]);
    expect(d.doublons).toEqual([]);
  });
});

describe('noms accessibles uniques — entrée du Codex à rangées', () => {
  type Domaine = { id: string; label: string; windModifiers?: unknown[]; tables?: Record<string, string>; effects?: unknown[] };
  it('domaine à rangées (listes de valeurs, rangées d’objets, record de textes) : aucun contrôle sans nom, aucun doublon', () => {
    const domaines = datasetArray('domains') as Domaine[];
    const d = domaines.find((x) => (x.windModifiers?.length ?? 0) >= 2 && Object.keys(x.tables ?? {}).length >= 1);
    expect(d, 'aucun domaine à deux rangées windModifiers et une table — la mesure ne porte sur rien').toBeTruthy();
    // Les éditeurs d'op des effets déclenchés sont hors de cette mesure (#2100) : l'entrée mesurée n'en
    // porte pas. Une seconde table rend le record de textes à deux rangées.
    const tables = { ...d!.tables, 'second-role': Object.values(d!.tables!)[0] };
    setDataset('domains', domaines.map((x) => (x === d ? { ...x, effects: [], tables } : x)) as never);
    monter(<CodexEdit categoryKey="domains" id={d!.id} onClose={() => {}} />);
    const r = defautsDeNoms(container.querySelector('.codex-edit-form')!);
    expect(r.total).toBeGreaterThan(20);
    expect(r.sansNom).toEqual([]);
    expect(r.doublons).toEqual([]);
  });

  type Talent = { id: string; label: string; variants?: unknown[] };
  it('talent à deux variantes : chaque contrôle PROPRE d’une rangée de variante porte son rang', () => {
    const t = (datasetArray('talents') as Talent[]).find((x) => (x.variants?.length ?? 0) >= 1);
    expect(t, 'aucun talent à variante — la mesure ne porte sur rien').toBeTruthy();
    monter(<CodexEdit categoryKey="talents" id={t!.id} onClose={() => {}} />);
    cliquer(bouton('+ Variante'));
    const noms = [...container.querySelectorAll<HTMLElement>('.codex-edit-form button, .codex-edit-form input, .codex-edit-form select, .codex-edit-form textarea')].map(nomAccessible);
    for (const n of [1, 2]) {
      for (const nom of [`Règle de la variante ${n}`, `Valeur attendue de la variante ${n}`, `Retirer la variante ${n}`, `Livre de la source de la variante ${n}`]) {
        expect(noms.filter((x) => x === nom), `« ${nom} »`).toHaveLength(1);
      }
    }
  });
});
