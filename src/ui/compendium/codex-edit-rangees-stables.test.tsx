// @vitest-environment jsdom
/**
 * #1993 — une rangée de liste éditable garde son IDENTITÉ (`useClesDeRangees`) : retirer une rangée ne
 * fait jamais passer le brouillon d'une source (`SourceRefField`) à sa voisine, ni ne l'y émet. Et deux
 * sources de même libellé, dans deux rangées, ont chacune leur nom accessible.
 *
 * Sondes de la revue du train U promues (défauts 1, 2 et 16), sur des entrées RÉELLES du Codex.
 */
import { describe, it, expect, afterEach, beforeAll } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';

import { CodexEdit } from './CodexEdit';
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

function monter(categoryKey: string, entree: { id: string; label: string }) {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => { root.render(<CodexEdit categoryKey={categoryKey} id={entree.id} onClose={() => {}} />); });
}

/** Saisie utilisateur dans un champ contrôlé React (setter natif du prototype + `input`/`change`). */
function saisir(champ: HTMLInputElement | HTMLSelectElement, valeur: string) {
  const proto = champ instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, 'value')!.set!;
  act(() => {
    setter.call(champ, valeur);
    champ.dispatchEvent(new Event('input', { bubbles: true }));
    champ.dispatchEvent(new Event('change', { bubbles: true }));
  });
}

function nomme<T extends Element>(nom: string): T {
  const el = container.querySelector<T>(`[aria-label="${nom}"]`);
  expect(el, `aucun champ nommé « ${nom} »`).toBeTruthy();
  return el!;
}

const bouton = (dans: ParentNode, texte: string): HTMLButtonElement => {
  const b = [...dans.querySelectorAll<HTMLButtonElement>('button')].find((x) => x.textContent?.includes(texte));
  expect(b, `aucun bouton « ${texte} »`).toBeTruthy();
  return b!;
};

type Source = { book: string; page: number; note?: string };
type Domaine = { id: string; label: string; windModifiers?: { source?: Source }[] };

/** Premier domaine RÉEL à deux rangées `windModifiers` de MÊME source (les deux rangées se valent). */
function domaineARangeesJumelles(): Domaine {
  const d = (datasetArray('domains') as Domaine[]).find((x) => (x.windModifiers?.length ?? 0) >= 2
    && x.windModifiers![0].source != null
    && JSON.stringify(x.windModifiers![0].source) === JSON.stringify(x.windModifiers![1].source));
  expect(d, 'aucun domaine à deux rangées sourcées identiques — la mesure ne porte sur rien').toBeTruthy();
  return d!;
}

/** Rangées SOURCÉES d'un tableau générique (`windModifiers`) : celles qui portent leur bouton de retrait. */
const rangeesSourcees = (): HTMLElement[] => {
  const rangees = [...container.querySelectorAll<HTMLElement>('.ed-subfield')]
    .filter((e) => [...e.children].some((b) => b.textContent?.includes('Retirer la rangée')) && e.querySelector('[aria-label^="Page"]'));
  expect(rangees.length, 'aucune rangée sourcée montée').toBeGreaterThan(0);
  return rangees;
};

describe('atelier du Codex — une rangée retirée emporte son brouillon (#1993)', () => {
  it('variantes : le brouillon de la variante retirée ne passe pas à la suivante', () => {
    const talent = (datasetArray('talents') as { id: string; label: string; variants?: unknown[] }[]).find((t) => !t.variants?.length)!;
    const livre = (datasetArray('books') as { id: string }[])[0].id;
    monter('talents', talent);
    act(() => { bouton(container, '+ Variante').click(); });
    act(() => { bouton(container, '+ Variante').click(); });
    saisir(nomme<HTMLSelectElement>('Livre de la source de la variante 1'), livre);
    saisir(nomme<HTMLInputElement>('Note de la source de la variante 1'), 'BROUILLON-V1');

    const variante1 = nomme('Livre de la source de la variante 1').closest('.ed-subfield')!;
    const retirer = variante1.querySelector<HTMLButtonElement>(':scope > .tf-row button[aria-label="Retirer la variante 1"]');
    expect(retirer, 'la variante 1 n’a pas de bouton « Retirer »').toBeTruthy();
    act(() => { retirer!.click(); });

    expect(container.querySelectorAll('[aria-label^="Livre de la source de la variante"]')).toHaveLength(1);
    expect(nomme<HTMLSelectElement>('Livre de la source de la variante 1').value).toBe('');
    expect(nomme<HTMLInputElement>('Note de la source de la variante 1').value).toBe('');
    saisir(nomme<HTMLInputElement>('Page de la source de la variante 1'), '12');
    expect(nomme<HTMLSelectElement>('Livre de la source de la variante 1').value, 'la page tapée a émis le livre de la variante retirée').toBe('');
  });

  it('tableau générique : le brouillon de la rangée retirée ne passe pas à la suivante', () => {
    const d = domaineARangeesJumelles();
    const suivante = d.windModifiers![1].source!;
    monter('domains', d);
    const [r0] = rangeesSourcees();
    saisir(r0.querySelector<HTMLInputElement>('[aria-label^="Page"]')!, '');
    saisir(r0.querySelector<HTMLInputElement>('[aria-label^="Note"]')!, 'BROUILLON-R0');
    act(() => { bouton(r0, 'Retirer la rangée').click(); });

    const [exR1] = rangeesSourcees();
    expect(exR1.querySelector<HTMLInputElement>('[aria-label^="Page"]')!.value).toBe(String(suivante.page));
    expect(exR1.querySelector<HTMLInputElement>('[aria-label^="Note"]')!.value).toBe(suivante.note ?? '');
    expect(container.querySelector('.codex-edit-errors'), 'une saisie en cours fantôme bloque l’enregistrement').toBeNull();
  });

  it('deux sources de même libellé, dans deux rangées, ont chacune leur nom accessible', () => {
    monter('domains', domaineARangeesJumelles());
    const noms = [...container.querySelectorAll('[aria-label]')].map((e) => e.getAttribute('aria-label')!);
    const doublons = [...new Set(noms.filter((n, i) => noms.indexOf(n) !== i))];
    expect(doublons).toEqual([]);
    expect(noms.filter((n) => /^(Livre|Page|Note) de la source de la rangée 2 /.test(n)), 'la 2ᵉ rangée ne porte aucun nom positionné').toHaveLength(3);
  });
});
