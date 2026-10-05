// @vitest-environment jsdom
/**
 * #1993 F2/F8 — une clé de record de textes (`RecordTextField`) en CONFLIT (vide, ou déjà portée par
 * une autre entrée) est une SAISIE EN COURS non retenue : elle reste à l'écran telle que tapée,
 * `aria-invalid` et décrite par un message qui dit pourquoi, et elle bloque « Enregistrer » par la
 * même porte que les sources incomplètes (`SuiviDesSaisies`). « + Entrée » ajoute une rangée, ou se
 * refuse avec sa raison (`GatedAction`).
 */
import { describe, it, expect, afterEach, beforeAll } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';

import { CodexEdit } from './CodexEdit';
import { datasetArray, resetData } from '../../data/overrides';

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

type Yeux = { id: string; label: string; color?: Record<string, string> };
function yeux(): Yeux {
  const e = (datasetArray('eyes') as Yeux[]).find((x) => Object.keys(x.color ?? {}).length >= 2);
  expect(e, 'aucune couleur d’yeux à record de deux clés — la mesure ne porte sur rien').toBeTruthy();
  return e!;
}
function monter(e: Yeux) {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => { root.render(<CodexEdit categoryKey="eyes" id={e.id} onClose={() => {}} />); });
}
function saisir(champ: HTMLInputElement, valeur: string) {
  act(() => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(champ, valeur);
    champ.dispatchEvent(new Event('input', { bubbles: true }));
  });
}
const cles = () => [...container.querySelectorAll<HTMLInputElement>('input[aria-label*=" — clé "]')];
const cle = (n: number) => container.querySelector<HTMLInputElement>(`input[aria-label$=" — clé ${n}"]`)!;
const valeur = (n: number) => container.querySelector<HTMLInputElement>(`input[aria-label$=" — valeur ${n}"]`)!;
const message = (champ: HTMLInputElement) => {
  const id = champ.getAttribute('aria-describedby');
  return id ? document.getElementById(id)?.textContent ?? null : null;
};
const enregistrer = () => container.querySelector<HTMLButtonElement>('.codex-edit-bar button.btn-primary')!;
const bandeau = () => container.querySelector('.codex-edit-errors')?.textContent ?? '';
const ajouter = () => [...container.querySelectorAll<HTMLButtonElement>('button')].find((b) => b.textContent === '+ Entrée')!;

describe('record de textes — une clé en conflit est une saisie en cours, visible et bloquante', () => {
  it('doublon : la frappe reste telle quelle, marquée et expliquée ; le record garde la clé retenue ; Enregistrer bloqué puis débloqué', () => {
    const e = yeux();
    const [k1, k2] = Object.keys(e.color!);
    monter(e);
    saisir(valeur(3), 'valeur modifiée');
    expect(enregistrer().disabled, 'l’entrée modifiée ne s’enregistre pas — la mesure ne porte sur rien').toBe(false);
    saisir(cle(1), k2);
    expect(cle(1).value, 'la frappe a été avalée').toBe(k2);
    expect(cle(1).getAttribute('aria-invalid')).toBe('true');
    expect(message(cle(1))).toContain(`Clé « ${k2} » déjà portée par l'entrée 2 : non retenue.`);
    expect(message(cle(1))).toContain(`La clé retenue reste « ${k1} ».`);
    expect(valeur(2).value, 'la valeur de la clé voisine a été écrasée').toBe(e.color![k2]);
    expect(enregistrer().disabled, 'une clé en conflit ne bloque pas Enregistrer').toBe(true);
    expect(bandeau()).toContain('Une saisie en cours n\'est pas retenue');

    saisir(cle(1), `${k2}-bis`);
    expect(cle(1).getAttribute('aria-invalid')).toBeNull();
    expect(message(cle(1))).toBeNull();
    expect(enregistrer().disabled, 'la clé devenue libre n’a pas débloqué Enregistrer').toBe(false);
    expect(bandeau()).not.toContain('Une saisie en cours');
  });

  it('clé vide : non retenue, marquée et expliquée ; Enregistrer bloqué', () => {
    const e = yeux();
    const [k1] = Object.keys(e.color!);
    monter(e);
    saisir(valeur(2), 'valeur modifiée');
    expect(enregistrer().disabled, 'l’entrée modifiée ne s’enregistre pas — la mesure ne porte sur rien').toBe(false);
    saisir(cle(1), '');
    expect(cle(1).value).toBe('');
    expect(cle(1).getAttribute('aria-invalid')).toBe('true');
    expect(message(cle(1))).toBe(`Clé vide : l'entrée 1 n'est pas retenue. La clé retenue reste « ${k1} ».`);
    expect(enregistrer().disabled).toBe(true);
  });

  it('« + Entrée » ajoute une rangée à clé vide ; tant qu’elle attend sa clé, un second « + Entrée » est REFUSÉ avec sa raison', () => {
    const e = yeux();
    const n = Object.keys(e.color!).length;
    monter(e);
    saisir(valeur(1), 'valeur modifiée');
    expect(enregistrer().disabled, 'l’entrée modifiée ne s’enregistre pas — la mesure ne porte sur rien').toBe(false);
    act(() => { ajouter().click(); });
    expect(cles(), 'aucune rangée ajoutée').toHaveLength(n + 1);
    expect(cle(n + 1).getAttribute('aria-invalid')).toBe('true');
    expect(message(cle(n + 1))).toBe(`Clé vide : l'entrée ${n + 1} n'est pas retenue.`);
    expect(enregistrer().disabled, 'une rangée sans clé ne bloque pas Enregistrer').toBe(true);

    expect(ajouter().getAttribute('aria-disabled')).toBe('true');
    const raison = document.getElementById(ajouter().getAttribute('aria-describedby')!)?.textContent;
    expect(raison).toBe(`L'entrée ${n + 1} attend sa clé.`);
    act(() => { ajouter().click(); });
    expect(cles(), 'le second « + Entrée » a écrasé ou ajouté en silence').toHaveLength(n + 1);

    saisir(cle(n + 1), 'neuve');
    expect(cle(n + 1).getAttribute('aria-invalid')).toBeNull();
    expect(ajouter().getAttribute('aria-disabled')).toBeNull();
    expect(enregistrer().disabled).toBe(false);
  });
});
