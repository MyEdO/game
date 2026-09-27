// @vitest-environment jsdom
/**
 * Contrat POSITIF du chemin d'écriture de l'onglet PNJ (#671 lot B) : ajouter/éditer/supprimer un
 * preset produit un `NarratifBlock` neuf passé à `onChange`. Wrapper contrôlé (l'état vit chez le
 * parent, comme `Editor`) pour que les éditions successives s'enchaînent sur le narratif à jour.
 */
import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { NarratifEditor } from './NarratifEditor';
import { emptyNarratif, type NarratifBlock } from '../../state/campaignNarratif';
import { narratifSchema } from '../../data/schemas/defs-scenes/narratif';
import { creatures } from '../../data';

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

let container: HTMLDivElement;
let root: Root;
let last: NarratifBlock;

function Harness({ initial }: { initial?: NarratifBlock }) {
  const [n, setN] = useState<NarratifBlock>(initial ?? emptyNarratif());
  last = n;
  return <NarratifEditor narratif={n} onChange={setN} onClose={() => {}} />;
}

function mount(initial?: NarratifBlock) {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => { root.render(<Harness initial={initial} />); });
}

afterEach(() => {
  act(() => { root.unmount(); });
  container.remove();
});

/** Bouton par texte visible. */
function btn(text: string): HTMLButtonElement {
  const b = [...container.querySelectorAll('button')].find((e) => (e.textContent ?? '').includes(text));
  if (!b) throw new Error(`bouton « ${text} » introuvable`);
  return b as HTMLButtonElement;
}
/** Champ (input/select) d'une `.ed-field`/`label` dont le texte inclut `labelText`. */
function field(labelText: string): HTMLInputElement | HTMLSelectElement {
  const wrap = [...container.querySelectorAll('.ed-field, label')].find((e) => (e.textContent ?? '').includes(labelText));
  const el = wrap?.querySelector('input, select');
  if (!el) throw new Error(`champ « ${labelText} » introuvable`);
  return el as HTMLInputElement | HTMLSelectElement;
}
function click(el: HTMLElement) {
  act(() => { el.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
}
function setValue(el: HTMLInputElement | HTMLSelectElement, value: string) {
  const proto = el instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, 'value')!.set!;
  act(() => {
    setter.call(el, value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  });
}

describe('NarratifEditor — onglet PNJ éditable (#671 lot B)', () => {
  it('ajoute un preset via onChange (base valide par défaut)', () => {
    mount();
    click(btn('PNJ'));            // onglet
    click(btn('Ajouter un PNJ'));
    expect(last.presetsPnj).toHaveLength(1);
    expect(last.presetsPnj[0].base).toBeTruthy();
  });

  it('édite la base et le nom du preset', () => {
    mount();
    click(btn('PNJ'));
    click(btn('Ajouter un PNJ'));
    const otherBase = creatures.find((c) => c.id !== last.presetsPnj[0].base)!.id;
    setValue(field('Créature de base'), otherBase);
    expect(last.presetsPnj[0].base).toBe(otherBase);
    setValue(field('Nom du PNJ'), 'Josef Quartjin');
    expect(last.presetsPnj[0].profil?.label).toBe('Josef Quartjin');
  });

  it('supprime le preset sélectionné', () => {
    mount();
    click(btn('PNJ'));
    click(btn('Ajouter un PNJ'));
    expect(last.presetsPnj).toHaveLength(1);
    click(btn('Supprimer ce PNJ'));
    expect(last.presetsPnj).toHaveLength(0);
  });
});

describe('NarratifEditor — l\'éditeur ne produit jamais un bloc invalide (#670)', () => {
  const withOneAffaire = (): NarratifBlock => ({
    ...emptyNarratif(),
    affaires: [{ id: 'affaire-a', titre: 'Le Marché noir' }],
  });

  it('0 affaire : « Ajouter un indice » est refusé avec sa raison (défaut 1)', () => {
    mount();
    click(btn('Indices'));
    expect(btn('Ajouter un indice').getAttribute('aria-disabled')).toBe('true');
    expect(document.body.textContent).toContain('Créez d\'abord une affaire.');
  });

  it('1 affaire : « Ajouter un indice » émet un bloc qui PARSE contre narratifSchema', () => {
    mount(withOneAffaire());
    click(btn('Indices'));
    const addIndice = btn('Ajouter un indice');
    expect(addIndice.getAttribute('aria-disabled')).toBeNull();
    click(addIndice);

    expect(last.indices).toHaveLength(1);
    expect(last.indices[0].affaireId).toBe('affaire-a');
    expect(narratifSchema.safeParse(last).success).toBe(true);
  });

  it('renommer une affaire propage aux indices rattachés et reste valide', () => {
    mount({
      ...withOneAffaire(),
      indices: [{ id: 'indice-1', affaireId: 'affaire-a', kind: 'indice', titre: 'Un indice', stades: [{ id: 'stade-1', prose: '' }] }],
    });
    click(btn('Affaires'));
    click(btn('Le Marché noir'));
    setValue(field('Identifiant'), 'affaire-b');

    expect(last.affaires[0].id).toBe('affaire-b');
    expect(last.indices[0].affaireId).toBe('affaire-b');
    expect(narratifSchema.safeParse(last).success).toBe(true);
  });

  it('renommer une affaire vers l\'id d\'un indice existant est REFUSÉ (défaut 2)', () => {
    mount({
      ...withOneAffaire(),
      indices: [{ id: 'indice-1', affaireId: 'affaire-a', kind: 'indice', titre: 'Un indice', stades: [{ id: 'stade-1', prose: '' }] }],
    });
    click(btn('Affaires'));
    click(btn('Le Marché noir'));
    setValue(field('Identifiant'), 'indice-1');

    expect(last.affaires[0].id).toBe('affaire-a');
  });
});
