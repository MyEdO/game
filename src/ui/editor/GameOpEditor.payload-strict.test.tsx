// @vitest-environment jsdom
/**
 * PAYLOAD STRICT de l'éditeur d'ops (#1789) — une option ABSENTE s'OMET, elle ne se pose jamais à
 * `undefined` : `'clé' in op` reste le test d'existence, ici comme au moteur, et un payload sérialisé
 * ne doit pas porter de clé morte. Le filtre d'`upd` ne balaie que le PREMIER niveau ; un patch qui
 * écrit un SOUS-objet applique la même loi lui-même (`sansClesVides`). Ce test mesure le niveau
 * IMBRIQUÉ, celui que le filtre ne voit pas : `condition › valuePerSL › onFailure`.
 */
import { describe, it, expect, afterEach, beforeAll } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { GameOpEditor } from './GameOpEditor';
import type { GameOp } from '../../engine/ops';

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

let container: HTMLDivElement;
let root: Root;

function monter(ops: GameOp[], vus: GameOp[][]) {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => { root.render(<GameOpEditor sansSource={false} ops={ops} onChange={(next) => vus.push(next)} />); });
}

afterEach(() => {
  act(() => { root.unmount(); });
  container.remove();
});

const caseACocher = (etiquette: string) =>
  [...container.querySelectorAll<HTMLLabelElement>('label')]
    .find((l) => l.textContent?.includes(etiquette))!
    .querySelector<HTMLInputElement>('input[type="checkbox"]')!;

describe('GameOpEditor — une clé vidée s’OMET, jusque dans un SOUS-objet', () => {
  it('décocher « sur l’échec » ôte `onFailure` de `valuePerSL`, sans y laisser une clé à `undefined`', () => {
    const vus: GameOp[][] = [];
    monter([{ op: 'condition', id: 'etourdi', value: 1, valuePerSL: { every: 1, amount: 1, onFailure: true } } as GameOp], vus);
    const coche = caseACocher("sur l'échec");
    expect(coche.checked, 'la case ne reflète pas le payload d’entrée').toBe(true);
    act(() => {
      coche.click();
    });
    const valuePerSL = (vus[vus.length - 1][0] as unknown as { valuePerSL: Record<string, unknown> }).valuePerSL;
    expect('onFailure' in valuePerSL, 'la clé décochée reste au SOUS-objet, à `undefined`').toBe(false);
    expect(valuePerSL, 'le reste du sous-objet a été perdu').toMatchObject({ every: 1, amount: 1 });
  });

  it('cocher « sur l’échec » pose la clé à `true`', () => {
    const vus: GameOp[][] = [];
    monter([{ op: 'condition', id: 'etourdi', value: 1, valuePerSL: { every: 1, amount: 1 } } as GameOp], vus);
    act(() => {
      caseACocher("sur l'échec").click();
    });
    expect((vus[vus.length - 1][0] as unknown as { valuePerSL: unknown }).valuePerSL).toEqual({ every: 1, amount: 1, onFailure: true });
  });
});
