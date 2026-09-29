// @vitest-environment jsdom
/**
 * Champ-réf à saisie libre (`RefField`, `freeText`) : la frappe se fait lettre après lettre dans le MÊME
 * champ (aucun remontage, le focus reste), un libellé du catalogue écrit son `id`, un texte hors
 * catalogue s'écrit tel quel, et une valeur changée par un autre geste se recale à l'affichage.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { act, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { RefField } from './RefField';
import { datasetArray } from '../../data/overrides';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const objets = datasetArray('trappings') as { id: string; label: string }[];
const libelles = objets.map((o) => o.label.toLowerCase());
const cible = objets.find((o) => /^[a-zà-ÿ]{4,}$/i.test(o.label) && libelles.filter((l) => l === o.label.toLowerCase()).length === 1)!;
const autre = objets.find((o) => o.id !== cible.id)!;

const poserValeur = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;

const montes: (() => void)[] = [];
afterEach(() => { montes.splice(0).forEach((demonter) => demonter()); });

/** Hôte qui tient la valeur comme un éditeur réel : ce que le champ émet lui revient en `value`. */
function monter(initiale?: string) {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);
  const emises: unknown[] = [];
  let changerDehors: (v: string | undefined) => void = () => {};
  function Hote() {
    const [v, setV] = useState<string | undefined>(initiale);
    changerDehors = setV;
    return <RefField cfg={{ ds: 'trappings', freeText: true }} value={v} onChange={(n) => { emises.push(n); setV(n as string | undefined); }} />;
  }
  act(() => { root.render(<Hote />); });
  const champ = () => host.querySelector('input')!;
  const taper = (texte: string) => {
    for (let i = 1; i <= texte.length; i++) {
      act(() => {
        poserValeur.call(champ(), texte.slice(0, i));
        champ().dispatchEvent(new Event('input', { bubbles: true }));
      });
    }
  };
  montes.push(() => { act(() => { root.unmount(); }); host.remove(); });
  return { champ, taper, emises, dehors: (v: string | undefined) => act(() => { changerDehors(v); }) };
}

describe('RefField — saisie libre d’un objet', () => {
  it('la fixture a un objet au libellé unique', () => {
    expect(cible, 'aucun objet au libellé simple et unique').toBeDefined();
  });

  it('la frappe lettre après lettre reste dans le même champ et garde tout le texte', () => {
    const m = monter();
    const initial = m.champ();
    const texte = `${cible.label} de secours`;
    m.taper(texte);
    expect(m.champ(), 'le champ a été remonté pendant la frappe').toBe(initial);
    expect(m.champ().value).toBe(texte);
    expect(m.emises[m.emises.length - 1]).toBe(texte);
  });

  it('un libellé du catalogue écrit l’id de son objet', () => {
    const m = monter();
    m.taper(cible.label);
    expect(m.emises[m.emises.length - 1]).toBe(cible.id);
    expect(m.champ().value).toBe(cible.label);
  });

  it('l’espace tapé après un libellé du catalogue reste à l’écran, l’id reste émis', () => {
    const m = monter();
    m.taper(`${cible.label} `);
    expect(m.champ().value).toBe(`${cible.label} `);
    expect(m.emises[m.emises.length - 1]).toBe(cible.id);
  });

  it('une valeur changée par un autre geste se recale à l’affichage, par libellé', () => {
    const m = monter(cible.id);
    expect(m.champ().value).toBe(cible.label);
    m.dehors(autre.id);
    expect(m.champ().value).toBe(autre.label);
  });
});
