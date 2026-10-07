// @vitest-environment jsdom
/**
 * La forme `charMod` de l'éditeur d'ops expose TOUT le payload déclaré (règle 2) : ses trois durées
 * propres, et le plancher `min` — champ RÉSERVÉ au `passive` de mutation (`reserve`, `grammaire/
 * mecanique.ts`), rendu SEULEMENT là où la famille du porteur l'admet. EDO 11 l.190 ; #1853.
 */
import { describe, it, expect, afterEach, beforeAll } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { GameOpEditor, opSummary } from './GameOpEditor';
import type { GameOp } from '../../engine/ops';
import { noeudDuChamp } from '../../data/schemas/validate';

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

let container: HTMLDivElement;
let root: Root;

function monter(ops: GameOp[], noeud: unknown, vus: GameOp[][]) {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => { root.render(<GameOpEditor ops={ops} noeud={noeud} onChange={(next) => vus.push(next)} />); });
}

afterEach(() => {
  act(() => { root.unmount(); });
  container.remove();
});

const PLANCHER = 'Plancher de la perte';
const champPlancher = () => container.querySelector<HTMLInputElement>(`input[aria-label="${PLANCHER}"]`);

/** Frappe RÉELLE dans un champ nombre (setter natif + événement input). */
const saisir = (input: HTMLInputElement, v: string) => {
  act(() => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, v);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
};

const caseACocher = (etiquette: string) =>
  [...container.querySelectorAll<HTMLLabelElement>('label')]
    .find((l) => l.textContent?.includes(etiquette))!
    .querySelector<HTMLInputElement>('input[type="checkbox"]')!;

const CRETIN: GameOp = { op: 'charMod', char: 'intelligence', mod: -40 };

describe('GameOpEditor › charMod — tout le payload déclaré, plancher au seul porteur qui l’admet', () => {
  it('dans le `passive` d’une mutation, le plancher est rendu et sa saisie écrit `min`', () => {
    const vus: GameOp[][] = [];
    monter([CRETIN], noeudDuChamp('mutations.json', 'passive'), vus);
    const input = champPlancher();
    expect(input, 'le plancher n’est pas offert au porteur qui l’admet').not.toBeNull();
    saisir(input!, '10');
    expect(vus[vus.length - 1][0]).toEqual({ ...CRETIN, min: 10 });
  });

  it('un plancher vidé ôte la clé, jamais `min: undefined`', () => {
    const vus: GameOp[][] = [];
    monter([{ ...CRETIN, min: 10 }], noeudDuChamp('mutations.json', 'passive'), vus);
    saisir(champPlancher()!, '');
    const op = vus[vus.length - 1][0];
    expect('min' in op).toBe(false);
    expect(op).toEqual(CRETIN);
  });

  it('dans le `passive` d’un talent, le plancher n’est PAS rendu', () => {
    monter([CRETIN], noeudDuChamp('talents.json', 'passive'), []);
    expect(container.querySelector('input[type="number"]'), 'le montage n’a rendu aucun champ').not.toBeNull();
    expect(champPlancher()).toBeNull();
  });

  it('la durée en heures est rendue et éditable, exclusive des Rounds', () => {
    const vus: GameOp[][] = [];
    monter([{ ...CRETIN, durationRounds: 2 }], noeudDuChamp('talents.json', 'passive'), vus);
    act(() => { caseACocher('dure N heures').click(); });
    expect(vus[vus.length - 1][0]).toEqual({ ...CRETIN, durationHours: 1 });
  });

  it('le résumé dit le plancher, et rien sans lui', () => {
    expect(opSummary(CRETIN)).toBe('-40 Intelligence');
    expect(opSummary({ ...CRETIN, min: 10 })).toBe('-40 Intelligence, min 10');
  });

  it('le résumé dit la durée propre, à ses trois échelles', () => {
    expect(opSummary({ ...CRETIN, min: 10, durationHours: 3 })).toBe('-40 Intelligence, min 10, 3 heures');
    expect(opSummary({ ...CRETIN, durationMinutes: 30 })).toBe('-40 Intelligence, 30 minutes');
    expect(opSummary({ ...CRETIN, durationRounds: 1 })).toBe('-40 Intelligence, 1 Round');
  });
});
