// @vitest-environment jsdom
/** `useClesDeRangees` (#1993) : la clé d'une rangée la suit à travers retrait, déplacement et édition. */
import { describe, it, expect, afterEach, beforeAll } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { useClesDeRangees } from './useClesDeRangees';

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

let container: HTMLDivElement;
let root: Root;
let lues: readonly number[] = [];

function Sonde({ liste }: { liste: readonly unknown[] | undefined }) {
  lues = useClesDeRangees(liste);
  return null;
}

function rendre(liste: readonly unknown[] | undefined): readonly number[] {
  act(() => { root.render(<Sonde liste={liste} />); });
  return lues;
}

afterEach(() => {
  act(() => { root.unmount(); });
  container.remove();
});

const monter = () => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
};

describe('useClesDeRangees', () => {
  const a = { n: 'a' }, b = { n: 'b' }, c = { n: 'c' };

  it('retrait : les rangées restantes gardent leur clé', () => {
    monter();
    const [, cb, cc] = rendre([a, b, c]);
    expect(rendre([b, c])).toEqual([cb, cc]);
  });

  it('déplacement : la clé suit la rangée', () => {
    monter();
    const [ca, cb] = rendre([a, b]);
    expect(rendre([b, a])).toEqual([cb, ca]);
  });

  it('édition : la rangée éditée (objet neuf) garde sa clé', () => {
    monter();
    const [ca, cb] = rendre([a, b]);
    expect(rendre([a, { ...b, n: 'B' }])).toEqual([ca, cb]);
  });

  it('ajout : la rangée neuve reçoit une clé jamais servie, même après un retrait', () => {
    monter();
    const avant = rendre([a, b]);
    rendre([a]);
    const [, neuve] = rendre([a, c]);
    expect(avant).not.toContain(neuve);
  });

  it('une liste absente, puis vide à chaque rendu, ne change rien', () => {
    monter();
    expect(rendre(undefined)).toEqual([]);
    expect(rendre([])).toEqual([]);
    const [ca] = rendre([a]);
    expect(rendre([a])).toEqual([ca]);
  });
});
