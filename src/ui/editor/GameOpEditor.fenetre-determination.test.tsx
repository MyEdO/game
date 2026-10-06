// @vitest-environment jsdom
/**
 * FENÊTRE de Détermination (`resolveWindow` d'une op `condition`, `engine/ops.ts`) — ce que la donnée
 * porte est ÉDITABLE (règle 2). Mesuré au DOM RENDU de l'éditeur d'ops : les quatre formes sont
 * proposées, la forme AUTHORÉE est celle qui s'affiche, et un changement de forme rend une valeur
 * `ResolveWindow` VALIDE (jamais un objet à moitié écrit que `resolveWindowDuration` lirait de travers).
 */
import { describe, it, expect, afterEach, beforeAll } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { GameOpEditor, ResolveWindowField } from './GameOpEditor';
import { resolveWindowDuration, type GameOp, type ResolveWindow } from '../../engine/ops';
import type { Combatant } from '../../engine/types';

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

let container: HTMLDivElement;
let root: Root;

function mount(node: React.ReactElement) {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => { root.render(node); });
}

afterEach(() => {
  act(() => { root.unmount(); });
  container.remove();
});

const selecteur = () => container.querySelector<HTMLSelectElement>('select[aria-label="Fenêtre de Détermination"]')!;

function choisir(valeur: string) {
  const s = selecteur();
  act(() => {
    const proto = Object.getPrototypeOf(s) as HTMLSelectElement;
    Object.getOwnPropertyDescriptor(proto, 'value')!.set!.call(s, valeur);
    s.dispatchEvent(new Event('change', { bubbles: true }));
  });
}

const ref = {} as unknown as Combatant;

describe('ResolveWindowField — les quatre formes de la fenêtre sont AUTHORABLES', () => {
  it('les quatre formes sont proposées, défaut sélectionné quand rien n’est authoré', () => {
    mount(<ResolveWindowField value={undefined} onChange={() => {}} />);
    expect([...selecteur().options].map((o) => o.value)).toEqual(['defaut', 'none', 'rounds', 'clock']);
    expect(selecteur().value).toBe('defaut');
  });

  it('une fenêtre `none` authorée (LDB 20 l.188) s’affiche comme telle', () => {
    mount(<ResolveWindowField value="none" onChange={() => {}} />);
    expect(selecteur().value).toBe('none');
  });

  it('une fenêtre d’horloge à `{rule}` (LDB 20 l.170) ouvre le champ Formula sur la forme « Règle optionnelle »', () => {
    mount(<ResolveWindowField value={{ scale: 'clock', minutes: { rule: 'maladie-conscience-determination-minutes' } }} onChange={() => {}} />);
    expect(selecteur().value).toBe('clock');
    const formes = container.querySelector<HTMLSelectElement>('select.fml-shape')!;
    expect(formes.value).toBe('regle');
    const regles = container.querySelector<HTMLSelectElement>('select[aria-label="Règle optionnelle"]')!;
    expect(regles.value).toBe('maladie-conscience-determination-minutes');
  });

  it('chaque changement de forme rend une `ResolveWindow` que le moteur sait résoudre', () => {
    const vus: (ResolveWindow | undefined)[] = [];
    mount(<ResolveWindowField value="none" onChange={(w) => vus.push(w)} />);
    choisir('rounds');
    choisir('clock');
    choisir('defaut');
    expect(vus).toEqual([{ scale: 'rounds', left: 1 }, { scale: 'clock', minutes: 5 }, undefined]);
    expect(resolveWindowDuration(vus[0], ref, 1_000)).toEqual({ scale: 'rounds', left: 1 });
    expect(resolveWindowDuration(vus[1], ref, 1_000)).toEqual({ scale: 'clock', until: 1_005 });
    expect(resolveWindowDuration(vus[2], ref, 1_000)).toEqual({ scale: 'rounds', left: 1 });
  });
});

describe('GameOpEditor — l’op `condition` porte son champ de fenêtre', () => {
  it('le formulaire dédié de `condition` expose la fenêtre de Détermination', () => {
    const ops: GameOp[] = [{ op: 'condition', id: 'inconscient', resolveWindow: 'none' }];
    mount(<GameOpEditor objets={[]} sansSource={false} ops={ops} onChange={() => {}} />);
    expect(selecteur(), 'aucun champ de fenêtre dans l’éditeur de l’op `condition`').toBeTruthy();
    expect(selecteur().value).toBe('none');
  });

  it('`removeCondition` ne porte PAS de fenêtre (elle RETIRE un État, elle n’en pose aucun)', () => {
    const ops: GameOp[] = [{ op: 'removeCondition', id: 'inconscient' }];
    mount(<GameOpEditor objets={[]} sansSource={false} ops={ops} onChange={() => {}} />);
    expect(container.querySelector('select[aria-label="Fenêtre de Détermination"]')).toBeNull();
  });
});
