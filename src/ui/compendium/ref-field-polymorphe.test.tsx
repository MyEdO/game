// @vitest-environment jsdom
/**
 * #2820 — le FOYER d'une règle (`{ id, type }`, `foyerDeRegleSchema`) se crée, se modifie et se retire à
 * l'atelier : `Field` (`CodexEdit.tsx`) route le nœud `refTypee` vers le mode `polymorphe` de `RefField`
 * — le type d'abord, puis la fiche dans l'espace de ce type —, et l'enregistrement écrit la référence.
 */
import { describe, it, expect, afterEach, beforeAll } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';

import { CodexEdit } from '../editor/codex/CodexEdit';
import { datasetArray, resetData } from '../../data/overrides';

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

let container: HTMLDivElement | undefined;
let root: Root | undefined;

afterEach(() => {
  if (root) act(() => { root!.unmount(); });
  container?.remove();
  root = undefined;
  container = undefined;
  resetData();
});

function monter(categorie: string, id: string): HTMLDivElement {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => { root!.render(<CodexEdit categoryKey={categorie} id={id} onClose={() => {}} />); });
  return container;
}

const select = (ecran: HTMLDivElement, nom: string) => ecran.querySelector<HTMLSelectElement>(`select[aria-label="${nom}"]`);
function choisir(champ: HTMLSelectElement, valeur: string): void {
  act(() => {
    champ.value = valeur;
    champ.dispatchEvent(new Event('change', { bubbles: true }));
  });
}
const enregistrer = (ecran: HTMLDivElement) => act(() => { ecran.querySelector<HTMLButtonElement>('.codex-edit-bar button.btn-primary')!.click(); });
const foyerDe = (ds: 'nightStakes' | 'crewTestTypes', id: string) =>
  (datasetArray(ds) as { id: string; rule?: unknown }[]).find((e) => e.id === id)!.rule;

describe('foyer de règle `{ id, type }` à l’atelier (#2820)', () => {
  it('un enjeu de nuit montre son foyer, en change le TYPE puis la FICHE, et l’enregistre', () => {
    const ecran = monter('nightStakes', 'shelter');
    const type = select(ecran, 'Règle associée — type');
    expect(type, 'aucun sélecteur de type : le foyer n’est pas routé vers le mode polymorphe').toBeTruthy();
    expect(type!.value).toBe('skill');
    expect(select(ecran, 'Règle associée — fiche')!.value).toBe('survie-en-exterieur');
    const rangee = type!.closest('.ed-field')!;
    expect(select(ecran, 'Règle associée — fiche')!.closest('.ed-field'), 'la fiche est un contrôle NU du même champ').toBe(rangee);
    expect(rangee.querySelector('.ed-field'), 'aucun champ imbriqué dans le champ polymorphe').toBeNull();

    choisir(type!, 'regle');
    const fiche = select(ecran, 'Règle associée — fiche')!;
    expect(fiche.value, 'changer de type vide la fiche').toBe('');
    expect([...fiche.options].some((o) => o.value === 'exposition'), 'la fiche se choisit dans l’espace du type choisi').toBe(true);
    choisir(fiche, 'exposition');
    enregistrer(ecran);
    expect(foyerDe('nightStakes', 'shelter')).toEqual({ id: 'exposition', type: 'regle' });
  });

  it('un foyer facultatif se RETIRE (« aucun »)', () => {
    const ecran = monter('nightStakes', 'contagion');
    const type = select(ecran, 'Règle associée — type')!;
    expect(type.value).toBe('symptome');
    choisir(type, '');
    expect(select(ecran, 'Règle associée — fiche'), 'sans type, aucune fiche à choisir').toBeNull();
    enregistrer(ecran);
    expect(foyerDe('nightStakes', 'contagion')).toBeUndefined();
  });

  it('un type de Test d’équipage (rangée NICHÉE) édite son foyer par le même sélecteur', () => {
    const [premier] = datasetArray('crewTestTypes') as { id: string; rule?: { id: string; type: string } }[];
    expect(premier.rule, 'la fixture n’a plus de foyer').toBeTruthy();
    const ecran = monter('crewTestTypes', premier.id);
    // Le nom accessible de chaque contrôle est l'ÉTIQUETTE VISIBLE du champ, suffixée : `— type`, `— fiche`.
    const etiquettes = [...ecran.querySelectorAll('.ed-field > span')].map((e) => e.textContent ?? '');
    const champ = etiquettes.find((e) => select(ecran, `${e} — type`));
    expect(champ, `aucune étiquette ne nomme un sélecteur de type : ${etiquettes.join(' | ')}`).toBeDefined();
    expect(select(ecran, `${champ} — type`)!.value).toBe(premier.rule!.type);
    expect(select(ecran, `${champ} — fiche`)!.value).toBe(premier.rule!.id);
  });
});
