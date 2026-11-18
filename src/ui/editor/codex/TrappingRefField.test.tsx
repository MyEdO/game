// @vitest-environment jsdom
/**
 * La quantité d'une possession (`TrappingRefField`) s'édite par le schéma (`countSpecSchema`) : un choix aucune /
 * fixé / jet, puis une saisie de nombre entier de 1 ou le dé de tirage (`DeDeTirageField`), jamais un texte (#4056).
 */
import { describe, it, expect, afterEach, beforeAll } from 'vitest';
import { act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';

import { TrappingRefField } from './StructFields';
import { trappingsInstanciables, type TrappingRef } from '../../../data';

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

let container: HTMLDivElement;
let root: Root;
let ecrites: TrappingRef[][];

afterEach(() => {
  act(() => { root.unmount(); });
  container.remove();
});

function Hote({ depart }: { depart: TrappingRef[] }) {
  const [liste, poser] = useState(depart);
  return <TrappingRefField value={liste} onChange={(v) => { ecrites.push(v); poser(v); }} />;
}

function monter(depart: TrappingRef[]) {
  ecrites = [];
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => { root.render(<Hote depart={depart} />); });
}

function saisir(champ: HTMLInputElement, valeur: string) {
  act(() => {
    champ.focus();
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(champ, valeur);
    champ.dispatchEvent(new Event('input', { bubbles: true }));
  });
  act(() => { champ.blur(); });
}

function choisir(champ: HTMLSelectElement, valeur: string) {
  act(() => {
    Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')!.set!.call(champ, valeur);
    champ.dispatchEvent(new Event('change', { bubbles: true }));
  });
}

const choix = () => container.querySelector<HTMLSelectElement>('select[aria-label="Quantité"]')!;
const fixee = () => container.querySelector<HTMLInputElement>('input[aria-label="Quantité fixée"]');
const de = (part: 'nombre de dés' | 'faces') => container.querySelector<HTMLInputElement>(`input[aria-label="Dé de tirage — ${part}"]`);
const derniere = () => ecrites[ecrites.length - 1]?.[0];
const id = trappingsInstanciables()[0]!.id;

describe('quantité d’une possession — `TrappingRefField`', () => {
  it('une quantité fixée s’affiche en nombre, sans saisie texte, et s’écrit entière de 1', () => {
    monter([{ id, count: { fixed: 10 } } as TrappingRef]);
    expect([...choix().options].map((o) => o.textContent)).toEqual(['aucune', 'fixé', 'jet']);
    expect(choix().selectedOptions[0]?.textContent).toBe('fixé');
    expect(fixee()?.value).toBe('10');
    expect(container.querySelector('input[placeholder="3 / 1d10"]')).toBeNull();
    saisir(fixee()!, '3');
    expect(derniere()).toEqual({ id, count: { fixed: 3 } });
    saisir(fixee()!, '0');
    expect(derniere()).toEqual({ id, count: { fixed: 1 } });
  });

  it('le jet pose le dé de tirage neuf, puis ses nombres de dés et faces', () => {
    monter([{ id, count: { fixed: 10 } } as TrappingRef]);
    choisir(choix(), '1');
    expect(derniere()).toEqual({ id, count: { roll: { n: 1, sides: 1 } } });
    expect(fixee()).toBeNull();
    saisir(de('nombre de dés')!, '2');
    saisir(de('faces')!, '10');
    expect(derniere()).toEqual({ id, count: { roll: { n: 2, sides: 10 } } });
  });

  it('« aucune » retire la quantité, « fixé » la pose à 1', () => {
    monter([{ id, count: { roll: { n: 3, sides: 10 } } } as TrappingRef]);
    expect(de('nombre de dés')?.value).toBe('3');
    choisir(choix(), '');
    expect(derniere()).toEqual({ id, count: undefined });
    expect(de('nombre de dés')).toBeNull();
    choisir(choix(), '0');
    expect(derniere()).toEqual({ id, count: { fixed: 1 } });
  });
});
