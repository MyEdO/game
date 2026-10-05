// @vitest-environment jsdom
/**
 * L'op `condition` s'édite ENTIÈREMENT au formulaire (règle 2) : sa durée, ses verrous (LDB 18) et
 * son drapeau « porté » (#1695, LDB 48 l.495) y ont chacun leur champ. Mesuré au DOM RENDU : un
 * Critique VERROUILLÉ se pose et se relit, et « porté » est EXCLUSIF des durées comme des verrous —
 * la donnée ne peut donc pas naître dans la forme que le parse refuse (`refusLoose`, mecanique.ts).
 */
import { describe, it, expect, afterEach, beforeAll } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { GameOpEditor } from './GameOpEditor';
import type { GameOp } from '../../engine/ops';
import { gameOpSchema, SUJETS_DE_VERROU } from '../../data/schemas/grammaire/mecanique';

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

/** La case à cocher dont le libellé CONTIENT `texte`. */
const caseDe = (texte: string): HTMLInputElement =>
  [...container.querySelectorAll('label')].find((l) => l.textContent?.includes(texte))!.querySelector('input[type=checkbox]')!;

const cocher = (texte: string) => {
  const input = caseDe(texte);
  act(() => { input.click(); }); // clic RÉEL : c'est lui qui bascule la case ET notifie React
};

/** Monte l'éditeur sur UNE op et rend le dernier état rendu par `onChange`. */
function editeur(op: GameOp): { dernier: () => GameOp } {
  let dernier = op;
  mount(<GameOpEditor sansSource={false} ops={[op]} onChange={(ops) => { dernier = ops[0]; }} />);
  return { dernier: () => dernier };
}

describe('GameOpEditor › op `condition` — durée, verrous et « porté » s’éditent au formulaire', () => {
  it('un Critique VERROUILLÉ (LDB 18) se pose et se RELIT sans JSON', () => {
    const op: GameOp = { op: 'condition', id: 'aveugle', unlockBy: 'medicalAid', lockedUntil: { kind: 'compare', subject: { who: 'target', condition: 'hemorragique' }, op: '==', value: 0 } };
    editeur(op);
    const acte = container.querySelector<HTMLSelectElement>('select')!;
    expect([...container.querySelectorAll('select')].some((s) => s.value === 'medicalAid'), 'l’acte de soin n’est pas relu').toBe(true);
    expect(acte).toBeTruthy();
    expect(caseDe('verrouillé tant que').checked, 'le prédicat de verrou n’est pas relu').toBe(true);
    // Le prédicat s'édite par l'éditeur CANONIQUE de l'algèbre `Condition`, restreint aux sujets que
    // le contexte de verrou garantit (`SUJETS_DE_VERROU`) — pas de `flag`, pas d'horloge.
    const kinds = [...container.querySelector<HTMLSelectElement>('select.cond-kind')!.options].map((o) => o.value);
    expect(new Set(kinds), 'les sujets offerts ne sont pas ceux que le contexte de verrou garantit').toEqual(new Set(SUJETS_DE_VERROU));
  });

  it('cocher « porté » EFFACE la durée et les verrous — la forme rendue passe le parse', () => {
    const { dernier } = editeur({ op: 'condition', id: 'sonne', durationRounds: 3, unlockBy: 'medicalAid' });
    cocher('porté par la source');
    expect(dernier()).toEqual({ op: 'condition', id: 'sonne', carried: true });
    expect(gameOpSchema.safeParse(dernier()).success, 'l’éditeur a produit une forme que le parse refuse').toBe(true);
  });

  it('sur une op « portée », aucun champ de durée ni de verrou n’est proposé (affordance morte évitée)', () => {
    editeur({ op: 'condition', id: 'sonne', carried: true });
    expect(caseDe('porté par la source').checked).toBe(true);
    for (const mort of ['dure N Rounds', 'dure N minutes', 'dure N heures', 'verrouillé tant que']) {
      expect([...container.querySelectorAll('label')].some((l) => l.textContent?.includes(mort)), `« ${mort} » est encore proposé sur une op portée`).toBe(false);
    }
    expect(container.textContent).toContain('la durée et le verrou de l’État sont ceux de l’effet actif de la source');
  });
});
