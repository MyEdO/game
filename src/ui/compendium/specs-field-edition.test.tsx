// @vitest-environment jsdom
/**
 * #1342 L3 — l'éditeur de `specs[]` du Codex PORTE l'entrée : renommer un libellé change le libellé
 * et l'id qui en dérive, JAMAIS l'attestation (`source`/`alsoIn`) ni l'appartenance au pool (`pool`).
 * Une entrée hors pool qui remonterait au pool par un simple renommage serait proposée au joueur sans
 * attestation (`LDB 09 l.40`). Geste RÉEL : saisie dans le champ monté, puis clic sur le segment.
 */
import { describe, it, expect, afterEach, beforeAll } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { SpecsField } from '../editor/codex/StructFields';
import type { SpecEntry } from '../../data';

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

const ENTREE: SpecEntry = {
  id: 'marins',
  label: 'Marins',
  source: { book: 'mer-des-griffes', page: 151, note: 'MDG 16 l.360' },
  pool: false,
};

let container: HTMLDivElement;
let root: Root;
let list: SpecEntry[];

afterEach(() => {
  act(() => { root.unmount(); });
  container.remove();
});

function mount(initial: SpecEntry[]) {
  list = initial;
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  const onChange = (v: SpecEntry[]) => {
    list = v;
    act(() => { root.render(<SpecsField value={list} onChange={onChange} />); });
  };
  act(() => { root.render(<SpecsField value={list} onChange={onChange} />); });
}

/** Saisie utilisateur dans un `<input>` contrôlé React (setter natif + événement `input`). */
function saisir(input: HTMLInputElement, valeur: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
  act(() => {
    setter.call(input, valeur);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

describe('SpecsField — renommer une spécialisation (#1342 L3)', () => {
  it('renommer une entrée HORS POOL garde `pool: false` ET sa `source`', () => {
    mount([{ ...ENTREE }]);
    const input = container.querySelector('input') as HTMLInputElement;
    saisir(input, 'Marins fluviaux');
    expect(list[0].label).toBe('Marins fluviaux');
    expect(list[0].id).toBe('marins-fluviaux');
    expect(list[0].pool).toBe(false);
    expect(list[0].source).toEqual(ENTREE.source);
  });

  it('le segment « proposée d’office » / « hors pool » bascule le SEUL champ `pool`', () => {
    mount([{ ...ENTREE }]);
    const [propose, hors] = Array.from(container.querySelectorAll('.seg button')) as HTMLButtonElement[];
    expect(hors.getAttribute('aria-pressed')).toBe('true');
    act(() => { propose.click(); });
    expect('pool' in list[0]).toBe(false); // absent = dans le pool (jamais `pool: true`)
    expect(list[0].source).toEqual(ENTREE.source);
    expect(list[0].id).toBe(ENTREE.id);
    const [, hors2] = Array.from(container.querySelectorAll('.seg button')) as HTMLButtonElement[];
    act(() => { hors2.click(); });
    expect(list[0].pool).toBe(false);
  });
});
