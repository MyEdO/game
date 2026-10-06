// @vitest-environment jsdom
/**
 * #1993 — une rangée des listes d'édition garde son IDENTITÉ (`useClesDeRangees`) : l'état qu'elle
 * porte (ici le `<details>` ouvert, comme le texte d'un `JsonField` qu'elle compose) la suit quand une
 * rangée qui la précède est retirée, au lieu de rester sur la position.
 */
import { describe, it, expect, afterEach, beforeAll } from 'vitest';
import { act, useState, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { GameOpEditor } from './GameOpEditor';
import { EffectList } from './EffectList';
import { FlowEditor } from './FlowEditor';
import type { GameOp } from '../../engine/ops';
import type { Effect } from '../../state/scene';
import type { Flow } from '../../state/flow';
import { CIBLES_D_EFFET_DE_SCENE } from '../../state/combatEffects';

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

let container: HTMLDivElement;
let root: Root;

afterEach(() => {
  act(() => { root.unmount(); });
  container.remove();
});

/** Porteur CONTRÔLÉ : la liste vit chez le parent, comme dans l'éditeur. */
function Controle<T>({ initial, rendu }: { initial: T; rendu: (v: T, poser: (v: T) => void) => ReactElement }) {
  const [v, poser] = useState(initial);
  return rendu(v, poser);
}

function monter(el: ReactElement) {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => { root.render(el); });
}

const ctx = { encounters: [], dialogues: [], cibles: CIBLES_D_EFFET_DE_SCENE, objets: [], sansSource: true };
const rangees = () => [...container.querySelectorAll<HTMLDetailsElement>('details.eff-row')];

/** Ouvre la 2ᵉ rangée, retire la 1ʳᵉ : la seule rangée qui reste, la 2ᵉ, est encore ouverte. */
function ouvrirLaSecondeRetirerLaPremiere(titreDuRetrait: string, resumeDeLaSeconde: string) {
  const [, seconde] = rangees();
  expect(seconde.querySelector('summary')!.textContent).toContain(resumeDeLaSeconde);
  act(() => { seconde.open = true; });
  const retirer = rangees()[0].querySelector<HTMLButtonElement>(`button[title="${titreDuRetrait}"]`)!;
  act(() => { retirer.click(); });
  const [restante] = rangees();
  expect(rangees()).toHaveLength(1);
  expect(restante.querySelector('summary')!.textContent).toContain(resumeDeLaSeconde);
  expect(restante.open, 'l’état ouvert est resté sur la position retirée').toBe(true);
}

describe('listes d’édition — l’état d’une rangée la suit au retrait d’une voisine (#1993)', () => {
  it('GameOpEditor', () => {
    const ops: GameOp[] = [{ op: 'maxWeaponHands', hands: 1, durationRounds: 1 }, { op: 'maxWeaponHands', hands: 2, durationRounds: 7 }];
    monter(<Controle initial={ops} rendu={(v, poser) => <GameOpEditor objets={[]} sansSource={false} ops={v} onChange={poser} />} />);
    const resume = rangees()[1].querySelector('summary')!.textContent!;
    ouvrirLaSecondeRetirerLaPremiere("Supprimer l'op", resume);
  });

  it('EffectList', () => {
    const effets: Effect[] = [{ type: 'journal', desc: 'PREMIER' } as Effect, { type: 'journal', desc: 'SECOND' } as Effect];
    monter(<Controle initial={effets} rendu={(v, poser) => <EffectList effects={v} onChange={poser} ctx={ctx} />} />);
    ouvrirLaSecondeRetirerLaPremiere("Supprimer l'effet", 'SECOND');
  });

  it('FlowEditor', () => {
    const flow: Flow = { kind: 'seq', steps: [
      { kind: 'do', effect: { type: 'journal', desc: 'PREMIER' } as Effect },
      { kind: 'do', effect: { type: 'journal', desc: 'SECOND' } as Effect },
    ] } as Flow;
    monter(<Controle initial={flow} rendu={(v, poser) => <FlowEditor flow={v} onChange={poser} ctx={ctx} />} />);
    ouvrirLaSecondeRetirerLaPremiere('Supprimer le bloc', 'SECOND');
  });
});
