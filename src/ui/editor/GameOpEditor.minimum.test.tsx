// @vitest-environment jsdom
/**
 * La BORNE BASSE d'une Formula (`{minimum, of}`) s'édite au formulaire (règle 2) : « 1d10 – (Bonus
 * d'Endurance) Rounds (minimum de 1) » (AA 07 l.113, LDB 18 l.88) se pose et se RELIT sans JSON.
 * Mesuré au DOM RENDU sur la donnée RÉELLE de `criticals.json` : la somme enveloppée s'affiche comme
 * une somme (ses deux termes édités récursivement), et tout geste rend une forme que `formulaSchema`
 * accepte — la donnée ne peut pas naître dans une forme que le parse refuse.
 */
import { describe, it, expect, afterEach, beforeAll } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { FormulaField, GameOpEditor, shapeOf, formulaForShape } from './GameOpEditor';
import type { Formula, GameOp } from '../../engine/ops';
import { formulaSchema } from '../../data/schemas/grammaire/valeurs';
import { gameOpSchema } from '../../data/schemas/grammaire/mecanique';

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

/** Monte le champ sur UNE formule et rend le dernier état notifié par `onChange`. */
function champ(value: Formula): { dernier: () => Formula } {
  let dernier = value;
  mount(<FormulaField label="Durée (Rounds)" value={value} onChange={(f) => { dernier = f; }} />);
  return { dernier: () => dernier };
}

/** Élit une forme au Nᵉ sélecteur de forme (le parent par défaut) — geste RÉEL. */
const choisirLaForme = (s: string, n = 0) => {
  const select = [...container.querySelectorAll<HTMLSelectElement>('select.fml-shape')][n];
  act(() => {
    select.value = s;
    select.dispatchEvent(new Event('change', { bubbles: true }));
  });
};

/** Saisit `v` dans le champ nombre `title` — frappe RÉELLE (setter natif + événement input). */
const saisir = (title: string, v: string) => {
  const input = container.querySelector<HTMLInputElement>(`input[title="${title}"]`)!;
  act(() => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, v);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
};

/** La DONNÉE réelle : `criticals.json › choc-violent-au-bras.maxWeaponHands.durationRounds`. */
const NUE: Formula = { sum: [{ dice: { n: 1, sides: 10 } }, { times: { of: { bonusOf: 'endurance' }, factor: -1 } }] };
const MIGREE: Formula = { minimum: 1, of: NUE };

describe('FormulaField › forme « Minimum » — la borne basse s’édite au formulaire', () => {
  it('choisir « Minimum » ENVELOPPE la formule courante, sans la perdre', () => {
    const { dernier } = champ(NUE);
    choisirLaForme('minimum');
    expect(dernier()).toEqual(MIGREE);
    expect(formulaSchema.safeParse(dernier()).success, 'l’éditeur a produit une forme que le parse refuse').toBe(true);
  });

  it('la donnée MIGRÉE se relit ENTIÈRE : borne saisissable, somme affichée avec ses DEUX termes', () => {
    champ(MIGREE);
    const formes = [...container.querySelectorAll<HTMLSelectElement>('select.fml-shape')].map((s) => s.value);
    expect(formes[0], 'la borne n’est pas relue sur sa forme').toBe('minimum');
    expect(formes[1], 'la somme enveloppée s’affiche sur une autre forme que « somme »').toBe('somme');
    expect(formes.slice(2, 4), 'les termes de la somme ne sont pas relus sur leur forme').toEqual(['dice', 'times']);
    expect(container.querySelector<HTMLInputElement>('input[title="minimum"]')!.value).toBe('1');
    // Le terme `1d10` est ÉDITABLE au lieu d'un champ vide (le bug : `'dice' in value` faux sur une somme).
    expect(container.querySelector<HTMLInputElement>('input[title="nombre de dés"]')!.value).toBe('1');
    expect(container.querySelector<HTMLInputElement>('input[title="faces"]')!.value).toBe('10');
  });

  it('changer la BORNE au clavier rend `{minimum: 2, of: <somme INCHANGÉE>}`, accepté au parse', () => {
    const { dernier } = champ(MIGREE);
    saisir('minimum', '2');
    expect(dernier()).toEqual({ minimum: 2, of: NUE });
    expect(formulaSchema.safeParse(dernier()).success).toBe(true);
  });

  it('QUITTER « Minimum » rend la formule enveloppée, jamais un littéral de remplacement', () => {
    expect(shapeOf(MIGREE)).toBe('minimum');
    expect(formulaForShape('somme', MIGREE)).toEqual(NUE); // la somme revient telle quelle
    expect(formulaForShape('dice', MIGREE)).toEqual({ dice: { n: 1, sides: 10 } }); // dérivé de `of`, pas d'un défaut nu
  });

  it('la BORNE est un entier ≥ 0 au parse (`formulaSchema`) — ni négative, ni décimale', () => {
    expect(formulaSchema.safeParse({ minimum: 0, of: NUE }).success).toBe(true);
    expect(formulaSchema.safeParse({ minimum: -3, of: NUE }).success).toBe(false);
    expect(formulaSchema.safeParse({ minimum: 1.5, of: NUE }).success).toBe(false);
  });
});

/** L'op RÉELLE de `criticals.json › choc-violent-au-bras` — celle qui PORTE la clause du livre. */
const CHOC_AU_BRAS: GameOp = { op: 'maxWeaponHands', hands: 1, durationRounds: MIGREE };

describe('GameOpEditor › `maxWeaponHands` — l’op qui porte la clause s’édite au FORMULAIRE (règle 2)', () => {
  /** Monte l'éditeur sur UNE op et rend le dernier état rendu par `onChange`. */
  function editeur(op: GameOp): { dernier: () => GameOp } {
    let dernier = op;
    mount(<GameOpEditor objets={[]} sansSource={false} ops={[op]} onChange={(ops) => { dernier = ops[0]; }} />);
    return { dernier: () => dernier };
  }

  it('aucun repli JSON : mains, durée bornée et ses deux termes sont LISIBLES au formulaire', () => {
    editeur(CHOC_AU_BRAS);
    expect(container.querySelector('textarea'), 'l’op tombe encore sur le repli JSON').toBeNull();
    expect(container.querySelector<HTMLInputElement>('input[aria-label="Plafond de mains d’arme"]')!.value).toBe('1');
    const formes = [...container.querySelectorAll<HTMLSelectElement>('select.fml-shape')].map((s) => s.value);
    expect(formes.slice(0, 4), 'la durée bornée n’est pas relue forme par forme').toEqual(['minimum', 'somme', 'dice', 'times']);
    expect(container.querySelector<HTMLInputElement>('input[title="minimum"]')!.value).toBe('1');
    expect(container.querySelector<HTMLInputElement>('input[title="nombre de dés"]')!.value).toBe('1');
    expect(container.querySelector<HTMLInputElement>('input[title="faces"]')!.value).toBe('10');
    // Le second terme : (Bonus d'Endurance) × -1 — la carac. est élue dans sa liste, le facteur saisi.
    expect([...container.querySelectorAll<HTMLSelectElement>('select')].some((s) => s.value === 'endurance'), 'le Bonus d’Endurance n’est pas relu').toBe(true);
  });

  it('un geste clavier sur la borne rend l’op ENTIÈRE, durée comprise, acceptée au parse', () => {
    const { dernier } = editeur(CHOC_AU_BRAS);
    saisir('minimum', '2');
    expect(dernier()).toEqual({ op: 'maxWeaponHands', hands: 1, durationRounds: { minimum: 2, of: NUE } });
    expect(gameOpSchema.safeParse(dernier()).success, 'l’éditeur a produit une op que le parse refuse').toBe(true);
  });
});
