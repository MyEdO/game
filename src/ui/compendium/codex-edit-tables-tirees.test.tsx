// @vitest-environment jsdom
/**
 * Atelier du Codex — les tables tirées s'éditent (#1667) : la rangée d'une table d'effets (`tables.json`)
 * s'enregistre et le lecteur du moteur la tire ; une rangée d'Incantation Imparfaite révisée (VDM) offre le
 * dé de son document et s'enregistre par le seam ; un palier du Voyage rapide (`sea-events.json`) offre le dé de
 * sa table et l'éditeur de sa `consequence` ; les colonnes des tableaux aléatoires et le dé des Tableaux de couleur
 * (#3578) s'éditent aussi.
 */
import { describe, it, expect, afterEach, beforeAll } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';

import { CodexEdit } from '../editor/codex/CodexEdit';
import { datasetArray, deDeLaTable, resetData } from '../../data/overrides';
import { findEffectTableById } from '../../data/effectTables';
import { findTableEntry } from '../../engine/tables';
import { deDuVoyageRapide } from '../../engine/seaVoyage';
import { careers, eyesDie, hairsDie, rangeesDesTalentsAleatoires, tableDeCarrieres, talents, talentsAleatoiresDie } from '../../data';

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

let container: HTMLDivElement;
let root: Root;

afterEach(() => {
  act(() => { root.unmount(); });
  container.remove();
  resetData();
});

function monter(categoryKey: string, id: string) {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => { root.render(<CodexEdit categoryKey={categoryKey} id={id} onClose={() => {}} />); });
}

function saisir(champ: HTMLInputElement, valeur: string) {
  act(() => {
    champ.focus();
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(champ, valeur);
    champ.dispatchEvent(new Event('input', { bubbles: true }));
  });
  act(() => { champ.blur(); });
}

function choisir(champ: HTMLSelectElement, valeur: string) {
  act(() => {
    Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')!.set!.call(champ, valeur);
    champ.dispatchEvent(new Event('change', { bubbles: true }));
  });
}

/** Le champ du formulaire que nomme son libellé (`<label><span>libellé</span><input/></label>`). */
function champNomme(libelle: string): HTMLInputElement {
  const label = [...container.querySelectorAll('label.ed-field')].find((l) => l.querySelector('span')?.textContent === libelle);
  expect(label, `aucun champ « ${libelle} »`).toBeDefined();
  return label!.querySelector('input')!;
}

async function enregistrer() {
  const bouton = container.querySelector<HTMLButtonElement>('.codex-edit-bar button.btn-primary')!;
  expect(bouton.disabled, 'la saisie n’a rien rendu modifié').toBe(false);
  await act(async () => { bouton.click(); });
}

describe('atelier du Codex — tables tirées', () => {
  it('la rangée d’une table d’effets s’édite, et le moteur tire la rangée enregistrée', async () => {
    monter('effectTables', 'allure-demoniaque-nurgle');
    const libelle = container.querySelector<HTMLInputElement>('input[aria-label="Libellé de la rangée 10"]');
    expect(libelle, 'les rangées de la table s’éditent').not.toBeNull();
    saisir(libelle!, 'Rangée éditée');
    await enregistrer();
    expect(findTableEntry(findEffectTableById('allure-demoniaque-nurgle').entries, 10).label).toBe('Rangée éditée');
  });

  it('une rangée d’Incantation Imparfaite révisée offre le dé de son document et s’enregistre par le seam', async () => {
    const rangee = (datasetArray('imparfaiteMineureVdm') as { id: string }[])[0];
    monter('imparfaiteMineureVdm', rangee.id);
    const de = container.querySelector<HTMLInputElement>('input[aria-label="Dé de tirage"]')!;
    expect(de.value).toBe('d100');
    saisir(de, '2d50');
    await enregistrer();
    expect(deDeLaTable('imparfaiteMineureVdm')).toBe('2d50');
  });

  it('un palier du Voyage rapide offre l’éditeur de sa conséquence et le dé de sa table, enregistré par le seam', async () => {
    monter('seaFastVoyage', 'desastreux');
    const champs = [...container.querySelectorAll('.ed-field > span')].map((s) => s.textContent ?? '');
    expect(champs.some((t) => t.startsWith('conséquence de l’événement')), 'la conséquence s’édite au FlowEditor').toBe(true);
    const de = container.querySelector<HTMLInputElement>('input[aria-label="Dé de tirage"]')!;
    expect(de.value).toBe('d10');
    saisir(de, 'd20');
    await enregistrer();
    expect(deDuVoyageRapide()).toMatchObject({ n: 1, sides: 20 });
  });

  it('les rangées et le dé du Tableau des Talents aléatoires s’éditent, et le lecteur suit (#3578)', async () => {
    const [premiere, seconde] = rangeesDesTalentsAleatoires();
    const horsTableau = talents.find((t) => !rangeesDesTalentsAleatoires().some((r) => r.id === t.id))!.id;
    monter('talentsAleatoires', 'talents-aleatoires');
    const id = container.querySelector<HTMLSelectElement>('select[aria-label="identifiant de la rangée 1 de Rangées"]');
    expect(id, 'les rangées du tableau s’éditent en rangées, pas en JSON').not.toBeNull();
    choisir(id!, horsTableau);
    saisir(container.querySelector<HTMLInputElement>('input[aria-label="Minimum de la rangée 1 de Rangées"]')!, '2');
    saisir(container.querySelector<HTMLInputElement>('input[aria-label="Maximum de la rangée 1 de Rangées"]')!, String(premiere.max + 1));
    saisir(container.querySelector<HTMLInputElement>('input[aria-label="Minimum de la rangée 2 de Rangées"]')!, String(seconde.min + 1));
    saisir(champNomme('Dé de tirage'), '2d50');
    await enregistrer();
    const [p, s] = rangeesDesTalentsAleatoires();
    expect(p).toEqual({ id: horsTableau, min: 2, max: premiere.max + 1 });
    expect(s).toEqual({ id: seconde.id, min: seconde.min + 1, max: seconde.max });
    expect(talentsAleatoiresDie()).toMatchObject({ n: 2, sides: 50 });
  });

  it('les rangées (bornes, carrière) et le dé d’une colonne du Tableau des Carrières s’éditent, et le lecteur suit (#3578)', async () => {
    const [premiere, seconde] = tableDeCarrieres('humain', false).entries;
    const horsColonne = careers.find((c) => !tableDeCarrieres('humain', false).entries.some((r) => r.id === c.id))!.id;
    monter('carrieresAleatoires', 'humain');
    const id = container.querySelector<HTMLSelectElement>('select[aria-label="identifiant de la rangée 1 de Rangées"]');
    expect(id, 'les rangées de la colonne s’éditent en rangées, pas en JSON').not.toBeNull();
    choisir(id!, horsColonne);
    saisir(container.querySelector<HTMLInputElement>('input[aria-label="Minimum de la rangée 1 de Rangées"]')!, '2');
    saisir(container.querySelector<HTMLInputElement>('input[aria-label="Maximum de la rangée 1 de Rangées"]')!, String(premiere.max + 1));
    saisir(container.querySelector<HTMLInputElement>('input[aria-label="Minimum de la rangée 2 de Rangées"]')!, String(seconde.min + 1));
    saisir(champNomme('Dé de tirage'), '2d50');
    await enregistrer();
    const table = tableDeCarrieres('humain', false);
    expect(table.entries.slice(0, 2)).toEqual([
      { id: horsColonne, min: 2, max: premiere.max + 1 },
      { id: seconde.id, min: seconde.min + 1, max: seconde.max },
    ]);
    expect(table.die).toMatchObject({ n: 2, sides: 50 });
  });

  it.each([
    ['eyes', 'vert', eyesDie],
    ['hairs', 'auburn', hairsDie],
  ] as const)('une couleur de %s offre le dé de son tableau, et le lecteur suit (#3578)', async (categorie, id, de) => {
    monter(categorie, id);
    const champ = container.querySelector<HTMLInputElement>('input[aria-label="Dé de tirage"]');
    expect(champ, 'le dé du tableau s’édite avec sa rangée').not.toBeNull();
    expect(champ!.value).toBe('2d10');
    saisir(champ!, '1d10');
    await enregistrer();
    expect(de()).toMatchObject({ n: 1, sides: 10 });
  });
});
