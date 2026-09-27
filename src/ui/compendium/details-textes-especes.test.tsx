// @vitest-environment jsdom
/**
 * #1525 — les surcharges par espèce de `details.texts` sont keyées par `raceKeySchema` (sceau du
 * dataset, `src/data/schemas/defs/details.ts:19`) : l'atelier ne doit pouvoir POSER qu'une clé du
 * sceau, une seule fois, et ne rien supprimer sans geste explicite. Gestes RÉELS sur le champ monté.
 */
import { tableTotale } from '../../lib/tableTotale';
import { describe, it, expect, afterEach, beforeAll } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { DetailsTextsField } from './CodexEdit';
import { raceKeySchema } from '../../data/schemas/grammaire/valeurs';

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

type DetailText = { all: string; bySpecies: Record<string, string> };
type DetailsTexts = Record<string, DetailText>;

let container: HTMLDivElement;
let root: Root;
let valeur: DetailsTexts;

afterEach(() => {
  act(() => { root.unmount(); });
  container.remove();
});

function mount(initial: DetailsTexts) {
  valeur = initial;
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  const onChange = (v: DetailsTexts) => {
    valeur = v;
    act(() => { root.render(<DetailsTextsField value={valeur} onChange={onChange} />); });
  };
  act(() => { root.render(<DetailsTextsField value={valeur} onChange={onChange} />); });
}

const bouton = () => [...container.querySelectorAll('button')].find((b) => b.textContent?.includes('+ Espèce'))!;
const selects = () => [...container.querySelectorAll('select')];
const options = (s: HTMLSelectElement) => [...s.options].map((o) => o.value);

describe('DetailsTextsField — la clé d’espèce se CHOISIT (#1525)', () => {
  it('la surcharge n’offre que les clés du sceau PAS ENCORE posées (+ la sienne)', () => {
    mount({ nom: { all: 'g', bySpecies: { humain: 'h', nain: 'n' } } });
    const posees = selects();
    expect(posees.map((s) => s.value)).toEqual(['humain', 'nain']);
    // la clé courante reste offerte, la clé du VOISIN non, aucune clé hors sceau
    expect(options(posees[0])).toContain('humain');
    expect(options(posees[0])).not.toContain('nain');
    expect(options(posees[1])).toContain('nain');
    expect(options(posees[1])).not.toContain('humain');
    for (const s of posees) for (const o of options(s)) expect(raceKeySchema.options as readonly string[]).toContain(o);
  });

  it('les blocs de surcharge sont COMPOSÉS dans `Grid` (responsive, charte UI règle 4)', () => {
    mount({ nom: { all: 'g', bySpecies: { humain: 'h', nain: 'n' } } });
    const grilles = [...container.querySelectorAll('.grid')];
    expect(grilles).toHaveLength(1);
    // chaque select d'espèce vit SOUS la grille — la composition porte bien les blocs
    for (const s of selects()) expect(grilles[0].contains(s)).toBe(true);
  });

  it('« + Espèce » pose une VRAIE clé libre (jamais la clé vide), et n’écrase rien', () => {
    mount({ nom: { all: 'g', bySpecies: { humain: 'h' } } });
    act(() => { bouton().click(); });
    const cles = Object.keys(valeur.nom.bySpecies);
    expect(cles).toHaveLength(2);
    expect(cles).not.toContain('');
    expect(valeur.nom.bySpecies.humain).toBe('h');
    for (const k of cles) expect(raceKeySchema.options as readonly string[]).toContain(k);
  });

  it('7/7 posées : l’action est GATÉE avec sa raison atteignable (jamais `disabled` nu)', () => {
    const bySpecies = tableTotale(raceKeySchema.options, (k) => k);
    mount({ nom: { all: 'g', bySpecies } });
    const b = bouton();
    expect(b.getAttribute('aria-disabled')).toBe('true');
    expect(b.hasAttribute('disabled')).toBe(false);
    const raison = container.querySelector(`#${b.getAttribute('aria-describedby')}`);
    expect(raison?.textContent).toMatch(/7 espèces/);
    act(() => { b.click(); });
    expect(Object.keys(valeur.nom.bySpecies)).toHaveLength(7);
  });

  it('retirer une surcharge est un geste EXPLICITE (bouton ✕), rien d’autre ne la supprime', () => {
    mount({ nom: { all: 'g', bySpecies: { humain: 'h', nain: 'n' } } });
    const retirer = [...container.querySelectorAll('button')].filter((b) => b.textContent === '✕');
    expect(retirer).toHaveLength(2);
    act(() => { retirer[0].click(); });
    expect(Object.keys(valeur.nom.bySpecies)).toEqual(['nain']);
  });

  it('6/7 posées : la rangée n’offre que sa clé + l’unique libre, et un renommage LIBÈRE l’ancienne', () => {
    const cles = raceKeySchema.options as readonly string[];
    const [libre, ...posees] = cles;
    mount({ nom: { all: 'g', bySpecies: tableTotale(posees, (k) => k) } });
    const s = selects()[0];
    expect(s.value).toBe(posees[0]);
    expect(options(s).slice().sort()).toEqual([posees[0], libre].slice().sort());
    act(() => {
      Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')!.set!.call(s, libre);
      s.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(Object.keys(valeur.nom.bySpecies)).toContain(libre);
    expect(Object.keys(valeur.nom.bySpecies)).not.toContain(posees[0]);
    expect(options(selects().find((x) => x.value === posees[1])!)).toContain(posees[0]);
  });

  it('7/7 posées : chaque rangée n’offre plus QUE sa propre clé', () => {
    const bySpecies = tableTotale(raceKeySchema.options, (k) => k);
    mount({ nom: { all: 'g', bySpecies } });
    for (const s of selects()) expect(options(s)).toEqual([s.value]);
  });
});
