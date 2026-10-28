// @vitest-environment jsdom
/**
 * Éditeurs dédiés des ops psychologiques : le type s'élit au registre des psychologies,
 * restreint à ce que le schéma de l'op admet, et la Cible au registre des Groupes, offerte au seul type
 * ciblé (#1463, #3045). Entrées de donnée choisies par leur forme, jamais par leur nom.
 */
import { describe, it, expect, afterEach, beforeAll } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { GameOpEditor } from './GameOpEditor';
import type { GameOp } from '../../engine/ops';
import { opPsy } from '../../engine/psych/opsPsy';
import { ciblePsy } from '../../engine/psych/ciblage';
import { groups, psychologies } from '../../data';

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

let container: HTMLDivElement;
let root: Root;

function monter(ops: GameOp[], vus: GameOp[][]) {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => { root.render(<GameOpEditor ops={ops} onChange={(next) => vus.push(next)} />); });
}

/** Le `<select>` du champ dont le libellé visible est `libelle`. */
const choix = (libelle: string) =>
  [...container.querySelectorAll<HTMLLabelElement>('label.ed-field')]
    .find((l) => l.querySelector('span')?.textContent?.startsWith(libelle))
    ?.querySelector('select') ?? null;

const options = (s: HTMLSelectElement | null) => [...(s?.options ?? [])].map((o) => o.value);

const elire = (s: HTMLSelectElement, v: string) => {
  act(() => {
    Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')!.set!.call(s, v);
    s.dispatchEvent(new Event('change', { bubbles: true }));
  });
};

const devenant = psychologies.find((p) => !!p.becomes);
const ciblee = psychologies.find((p) => p.targeted);
const nonCiblee = psychologies.find((p) => !p.targeted && !p.becomes);
const groupe = groups[0];

describe('préconditions de forme', () => {
  it('la donnée porte une entrée qui en devient une autre, un type ciblé, un non ciblé et un Groupe', () => {
    expect(devenant).toBeDefined();
    expect(ciblee).toBeDefined();
    expect(nonCiblee).toBeDefined();
    expect(groupe).toBeDefined();
  });
});

describe('GameOpEditor › beginPsych et grantPsychTrait', () => {
  afterEach(() => {
    act(() => { root.unmount(); });
    container.remove();
  });

  it('la pose n’offre pas une entrée qui en devient une autre ; l’octroi offre tout le registre', () => {
    monter([opPsy.pose(''), opPsy.octroi('')], []);
    const pose = choix('État psychologique');
    expect(pose, 'le type de la pose se choisit au registre').not.toBeNull();
    expect(options(pose)).not.toContain(devenant!.id);
    expect(options(pose)).toContain(nonCiblee!.id);
    expect(options(choix('Trait psychologique'))).toContain(devenant!.id);
    expect(container.querySelectorAll('textarea').length, 'plus de repli JSON').toBe(0);
  });

  it('la fin d’un état et le retrait d’un Trait s’élisent au registre, sans repli JSON', () => {
    const vus: GameOp[][] = [];
    monter([opPsy.fin(''), opPsy.retrait()], vus);
    expect(container.querySelectorAll('textarea').length, 'plus de repli JSON').toBe(0);
    elire(choix('État psychologique')!, nonCiblee!.id);
    expect(vus[vus.length - 1]?.[0]).toEqual(opPsy.fin(nonCiblee!.id));
    elire(choix('Trait psychologique')!, nonCiblee!.id);
    expect(vus[vus.length - 1]?.[1]).toEqual(opPsy.retrait(nonCiblee!.id));
  });

  it('la Cible n’est offerte qu’au type ciblé, et s’élit au registre des Groupes', () => {
    const vus: GameOp[][] = [];
    monter([opPsy.octroi(nonCiblee!.id)], vus);
    expect(choix('Cible')).toBeNull();
    act(() => { root.unmount(); });
    container.remove();
    monter([opPsy.octroi(ciblee!.id)], vus);
    const cible = choix('Cible');
    expect(cible).not.toBeNull();
    elire(cible!, groupe.id);
    expect(vus[vus.length - 1]?.[0]).toEqual(opPsy.octroi(ciblee!.id, ciblePsy.groupe(groupe.id)));
  });

  it('élire un type non ciblé retire la Cible de la pose', () => {
    const vus: GameOp[][] = [];
    monter([opPsy.pose(ciblee!.id, { cible: ciblePsy.groupe(groupe.id) })], vus);
    elire(choix('État psychologique')!, nonCiblee!.id);
    expect(vus[vus.length - 1]?.[0]).toEqual(opPsy.pose(nonCiblee!.id));
  });
});
