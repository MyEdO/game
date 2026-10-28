// @vitest-environment jsdom
/**
 * #1318 E1 — CÂBLAGE de la borne du champ « Enc » : la surface de transfert ne rejoue plus la borne à
 * la main, elle la DÉCLARE à `NumberField` (`min={0} max={maxEnc}`). Ce que ce test verrouille, c'est
 * que la borne DITE est bien celle du domaine (le lot disponible ∩ la place libre du destinataire) et
 * que le champ VIDE reste un état signifiant : « tout ce qui peut passer », jamais 0.
 */
import { describe, it, expect, afterEach, beforeAll } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { CargoTransferPanel } from './CargoTransferPanel';
import type { CargoCarrier } from '../engine/cargo';

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

let container: HTMLDivElement;
let root: Root;

const porteur = (id: string, cargo: { cargoId: string; enc: number }[], capacity: number): CargoCarrier => ({
  id, label: id, hull: 'vehicule' as CargoCarrier['hull'], capacity, discreteEnc: 0,
  cargo: cargo as CargoCarrier['cargo'], location: { kind: 'au-lieu', placeId: 'bourg' },
});

function monter(onMove: (f: string, t: string, c: string, e: number) => void) {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root.render(
      <CargoTransferPanel
        carriers={[porteur('chariot', [{ cargoId: 'ble', enc: 12 }], 40), porteur('mule', [], 5)]}
        onMove={onMove}
        labelOf={(id) => id}
      />,
    );
  });
}

afterEach(() => {
  act(() => { root.unmount(); });
  container.remove();
});

const champ = () => container.querySelector('input[type="number"]') as HTMLInputElement;

function saisir(texte: string) {
  const input = champ();
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
  act(() => {
    setter.call(input, texte);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

describe('CargoTransferPanel — la borne du champ « Enc » est celle du domaine', () => {
  it('la borne DITE = lot ∩ place libre du destinataire (12 Enc de blé, mule de 5)', () => {
    monter(() => {});
    expect(champ().getAttribute('min')).toBe('0');
    expect(champ().getAttribute('max')).toBe('5'); // pas 12 : la mule ne porte que 5
    expect(champ().getAttribute('aria-label')).toBe('Enc à transférer');
  });

  it('saisie au-dessus de la borne : CALÉE à la place libre, le transfert part avec la valeur vue', () => {
    const bougé: number[] = [];
    monter((_f, _t, _c, e) => bougé.push(e));
    saisir('99');
    expect(champ().value, 'la valeur AFFICHÉE est celle qui partira — jamais un écart entre l’œil et le moteur').toBe('5');
    act(() => { (container.querySelector('button') as HTMLButtonElement).click(); });
    expect(bougé).toEqual([5]);
  });

  it('champ VIDE = « tout ce qui peut passer » (le maximum), jamais 0 — et le transfert le revide', () => {
    const bougé: number[] = [];
    monter((_f, _t, _c, e) => bougé.push(e));
    saisir('3');
    saisir('');
    expect(champ().value).toBe('');
    act(() => { (container.querySelector('button') as HTMLButtonElement).click(); });
    expect(bougé).toEqual([5]);
    expect(champ().value, 'après le transfert, le champ retourne à l’état « tout »').toBe('');
  });
});
