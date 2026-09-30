// @vitest-environment jsdom
/**
 * #2099 — l'atelier du Codex rend CHAQUE rangée des trois tables de `miscast.json` exposées
 * (Incantations Imparfaites mineures/majeures, Colère des dieux), console à 0 erreur, et aucun sélecteur
 * de forme de `Formula` n'affiche « Dés » sans ses champs.
 */
import { describe, it, expect, afterEach, beforeAll, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';

import { CodexEdit, editableEntries } from './CodexEdit';
import { exposition } from '../../data/schemas/defs/miscast';
import { LIBELLE_DE_FORME, type FormulaShape } from '../editor/GameOpEditor';

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

let container: HTMLDivElement | undefined;
let root: Root | undefined;

afterEach(() => {
  if (root) act(() => { root!.unmount(); });
  container?.remove();
  root = undefined;
  container = undefined;
  vi.restoreAllMocks();
});

const CODEX = exposition.codex;
if (!('keys' in CODEX)) throw new Error('miscast.json : l’exposition Codex ne déclare plus de clés de catégorie — la mesure ne porte sur rien');
const CATEGORIES = CODEX.keys;

const estForme = (s: string): s is FormulaShape => Object.prototype.hasOwnProperty.call(LIBELLE_DE_FORME, s);

/** Faute de lecture d'un sélecteur de forme : hors alphabet, libellé faux, ou forme affichée SANS son
 *  éditeur — une valeur sans option retombe sur la première (« Nombre ») sans son champ nombre. */
function fauteDeForme(s: HTMLSelectElement): string | null {
  const forme = s.value;
  if (!estForme(forme)) return `forme « ${forme} » hors alphabet`;
  if (s.selectedOptions[0]?.textContent !== LIBELLE_DE_FORME[forme]) return `libellé de « ${forme} » non affiché`;
  const rangee = s.parentElement!;
  if (forme === 'lit' && !rangee.querySelector(':scope > input[type="number"]')) return '« Nombre » sans champ nombre';
  if (forme === 'dice' && !rangee.querySelector(':scope > .fml-dice')) return '« Dés » sans champ';
  return null;
}

describe('atelier du Codex — chaque rangée de miscast s’édite sans erreur (#2099)', () => {
  it('les tables exposées au Codex sont déclarées au schéma', () => {
    expect(CATEGORIES.length).toBeGreaterThan(0);
  });

  it('Colère des dieux : le terme de Péché se relit et s’offre ; absent d’un Critique ordinaire', () => {
    // Une rangée dont le Péché vit dans un champ que l'atelier édite par `FormulaField` (`wounds.amount`).
    type Op = { op: string; amount?: unknown };
    const colere = (editableEntries('miscastWrath') as { id: string; label: string; ops?: Op[] }[])
      .find((e) => (e.ops ?? []).some((o) => o.op === 'wounds' && JSON.stringify(o.amount).includes('sinPoints')))!;
    expect(colere, 'aucune rangée de la Colère des dieux ne porte le Péché').toBeTruthy();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => { root!.render(<CodexEdit categoryKey="miscastWrath" id={colere.id} onClose={() => {}} />); });
    const formes = [...container.querySelectorAll<HTMLSelectElement>('select.fml-shape')];
    expect(formes.some((s) => s.value === 'peche'), 'le terme de Péché n’est pas relu sur sa forme').toBe(true);
    act(() => { root!.unmount(); });
    container.remove();

    // Un Critique localisé dont une op porte une durée en `Formula` (`durationRounds`, `formulaSchema`).
    const [categorie, critique] = ['criticalsTete', 'criticalsBras', 'criticalsCorps', 'criticalsJambe']
      .flatMap((c) => (editableEntries(c) as { id: string; label: string; ops?: unknown[] }[]).map((e) => [c, e] as const))
      .find(([, e]) => JSON.stringify(e.ops ?? []).includes('durationRounds')) ?? [];
    expect(critique, 'aucun Critique à durée — la mesure ne porte sur rien').toBeTruthy();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => { root!.render(<CodexEdit categoryKey={categorie!} id={critique!.id} onClose={() => {}} />); });
    const offertes = [...container.querySelectorAll<HTMLSelectElement>('select.fml-shape')];
    expect(offertes.length, 'aucune Formula montée sur le Critique').toBeGreaterThan(0);
    expect(offertes.some((s) => [...s.options].some((o) => o.value === 'peche')), 'Péché offert sur une op ordinaire').toBe(false);
  });

  for (const categoryKey of CATEGORIES) {
    it(`${categoryKey} : chaque rangée se monte, console.error à 0, aucune forme « Dés » vide`, () => {
      const entrees = editableEntries(categoryKey) as { id: string; label: string }[];
      expect(entrees.length, `${categoryKey} : aucune rangée — la mesure ne porte sur rien`).toBeGreaterThan(0);
      const erreurs = vi.spyOn(console, 'error').mockImplementation(() => {});
      const fautes: string[] = [];
      for (const e of entrees) {
        container = document.createElement('div');
        document.body.appendChild(container);
        root = createRoot(container);
        try {
          act(() => { root!.render(<CodexEdit categoryKey={categoryKey} id={e.id} onClose={() => {}} />); });
        } catch (err) {
          fautes.push(`${e.id} : ${(err as Error).message}`);
        }
        for (const s of container.querySelectorAll<HTMLSelectElement>('select.fml-shape')) {
          const faute = fauteDeForme(s);
          if (faute) fautes.push(`${e.id} : ${faute}`);
        }
        act(() => { root!.unmount(); });
        container.remove();
        root = undefined;
        container = undefined;
      }
      expect(fautes).toEqual([]);
      expect(erreurs.mock.calls.map((c) => String(c[0]).slice(0, 200))).toEqual([]);
    });
  }
});
