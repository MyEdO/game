// @vitest-environment jsdom
/**
 * `grantTrait` à l'atelier : le Trait octroyé se saisit en chaîne de livre, relue par `relireTraits`
 * (`refFormatLivre.ts`) ; sa Cible est posée par le Trait ou tirée sur une table de Cibles
 * (`tablesDeCiblesSchema`), élue par son id. EDOC 12 l.217, l.241.
 */
import { describe, it, expect, afterEach, beforeAll } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { GameOpEditor } from './GameOpEditor';
import { valeursDe } from '../../data/schemas/grammaire/meta';
import { gameOpSchema, tablesDeCiblesSchema } from '../../data/schemas/grammaire/mecanique';
import type { GameOp } from '../../engine/ops';

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

let container: HTMLDivElement;
let root: Root | undefined;

function demonter() {
  const monte = root;
  if (!monte) return;
  act(() => { monte.unmount(); });
  container.remove();
  root = undefined;
}

function monter(ops: GameOp[], vus: GameOp[][]) {
  demonter();
  container = document.createElement('div');
  document.body.appendChild(container);
  const monte = createRoot(container);
  root = monte;
  const rendre = (courants: GameOp[]) => act(() => {
    monte.render(<GameOpEditor ops={courants} onChange={(next) => { vus.push(next); rendre(next); }} />);
  });
  rendre(ops);
}

afterEach(demonter);

const dernier = (vus: GameOp[][]) => vus[vus.length - 1]?.[0] as Extract<GameOp, { op: 'grantTrait' }>;
const champDuTrait = () => container.querySelector<HTMLInputElement>('input[aria-label="Trait octroyé"]')!;
const selectDeCible = () => container.querySelector<HTMLSelectElement>('select[aria-label="Cible"]')!;

function saisir(champ: HTMLInputElement, texte: string) {
  act(() => { champ.focus(); });
  act(() => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(champ, texte);
    champ.dispatchEvent(new Event('input', { bubbles: true }));
  });
  act(() => { champ.blur(); });
}

function choisir(select: HTMLSelectElement, valeur: string) {
  act(() => {
    Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')!.set!.call(select, valeur);
    select.dispatchEvent(new Event('change', { bubbles: true }));
  });
}

describe('GameOpEditor — grantTrait', () => {
  it('la chaîne de livre se relit en Trait posé, Cible désignée par son id', () => {
    const vus: GameOp[][] = [];
    monter([{ op: 'grantTrait', trait: { id: 'peur', value: 1 } } as GameOp], vus);
    saisir(champDuTrait(), 'Haine (Humain)');
    const op = dernier(vus);
    expect(op.trait).toEqual({ id: 'haine', arg: 'humain' });
    expect(gameOpSchema.safeParse(op).success).toBe(true);
  });

  it('un Indice formulé survit à une chaîne qui n’en porte pas', () => {
    const vus: GameOp[][] = [];
    const indice = { bonusOf: 'force-mentale' as const };
    monter([{ op: 'grantTrait', trait: { id: 'peur', value: indice } } as GameOp], vus);
    saisir(champDuTrait(), 'Terreur');
    expect(dernier(vus).trait).toEqual({ id: 'terreur', value: indice });
  });

  it('les Cibles tirées s’élisent parmi les tables de Cibles, par id ; tirer ôte la Cible posée', () => {
    const vus: GameOp[][] = [];
    monter([{ op: 'grantTrait', trait: { id: 'haine', arg: 'humain' } } as GameOp], vus);
    expect([...selectDeCible().querySelectorAll('option')].map((o) => o.value))
      .toEqual(['', ...Object.keys(valeursDe(tablesDeCiblesSchema) ?? {})]);
    const table = Object.keys(valeursDe(tablesDeCiblesSchema) ?? {})[0];
    choisir(selectDeCible(), table);
    const op = dernier(vus);
    expect(op.cible).toEqual({ pick: 1, table: { id: table } });
    expect(op.trait).toEqual({ id: 'haine' });
    expect(gameOpSchema.safeParse(op).success).toBe(true);
    choisir(selectDeCible(), '');
    expect('cible' in dernier(vus)).toBe(false);
  });

  it('l’Indice d’un Trait octroyé ne propose que les formes sans tirage, au dialecte de son nœud', () => {
    const formes = (op: GameOp) => {
      monter([op], []);
      const select = container.querySelector<HTMLSelectElement>('select.fml-shape')!;
      return [...select.querySelectorAll('option')].map((o) => o.value);
    };
    for (const op of [
      { op: 'grantTrait', trait: { id: 'peur', value: 1 } },
      { op: 'domeWard', trait: { id: 'protection', value: 6 } },
    ] as GameOp[]) {
      const offertes = formes(op);
      expect(offertes, op.op).toContain('bonus');
      expect(offertes, op.op).not.toContain('dice');
      expect(offertes, op.op).not.toContain('rolled');
      expect(offertes, op.op).not.toContain('dr');
    }
    expect(formes({ op: 'wounds', amount: 1 } as GameOp)).toContain('dice');
  });
});

