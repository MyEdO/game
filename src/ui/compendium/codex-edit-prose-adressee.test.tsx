// @vitest-environment jsdom
/**
 * #1389 (épique #1388) — l'atelier n'offre JAMAIS deux surfaces d'édition pour un même texte.
 *
 * Une entrée dont la prose est ADRESSÉE (`descRef`) porte quand même une `desc` EN MÉMOIRE : le
 * plugin `wfrp:prose-source` l'injecte au chargement du module (c'est elle que le joueur lit). Tant
 * que l'atelier inférait ses champs de la donnée chargée, il montrait donc un `textarea`
 * « Description » — 615 caractères de markdown éditable — au-dessus du champ d'adresse, pour un
 * texte que la porte de sérialisation (`versDisque`) refuse d'écrire. Recette C5, `auteur-terreur`.
 *
 * La règle est STRUCTURELLE, pas un cas `psychology` : un champ DÉRIVÉ d'un autre champ de l'entrée
 * ne s'offre pas à l'édition (`estDerive`, `editFields.ts`). Le geste inverse est le DÉTACHEMENT :
 * remettre le livre de l'adresse à vide rend l'entrée à sa prose, qui redevient éditable — avec le
 * texte matérialisé pour valeur initiale, jamais un champ vide à retaper.
 *
 * Le geste mesuré est celui de l'écran : `CodexEdit` monté sur l'entrée RÉELLE (patron
 * `codex-edit-charge-discriminee.test.tsx`).
 */
import { describe, it, expect, afterEach, beforeAll } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';

import { CodexEdit } from './CodexEdit';
import { estDerive } from './editFields';
import { psychologies } from '../../data';

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

let container: HTMLDivElement | undefined;
let root: Root | undefined;

// Un cas qui ne monte RIEN (le témoin de donnée ci-dessous) laisse la racine absente : la démonter
// lèverait, et le cas passerait pour rouge sans qu'aucune assertion n'ait échoué.
afterEach(() => {
  if (root) act(() => { root!.unmount(); });
  container?.remove();
  root = undefined;
  container = undefined;
});

function monte(categoryKey: string, id: string) {
  container = document.createElement('div');
  document.body.appendChild(container);
  const racine = createRoot(container);
  root = racine;
  act(() => { racine.render(<CodexEdit categoryKey={categoryKey} id={id} onClose={() => {}} />); });
}

/** Le champ nommé `label`, tel que l'écran le porte. */
function champ(label: string): HTMLLabelElement | undefined {
  return [...container!.querySelectorAll<HTMLLabelElement>('.codex-edit-form label.ed-field')]
    .find((l) => l.querySelector('span')?.textContent?.trim() === label);
}

/**
 * Libellés des champs que le formulaire PRÉSENTE, dans l'ordre du DOM. Un champ à éditeur dédié peut
 * PROLONGER son libellé d'une consigne (`DescRefField` : « … — adresse du passage dans le Source … ») :
 * le rang lu est celui du LIBELLÉ de tête, jamais la phrase entière.
 */
function champsPresentes(): string[] {
  return [...container!.querySelectorAll<HTMLElement>('.codex-edit-form .ed-field > span, .codex-edit-form .ed-check > span')]
    .map((s) => (s.textContent ?? '').trim().split(' — ')[0].trim())
    .filter(Boolean);
}

/** Le sélecteur de LIVRE du champ d'adresse — la porte du détachement. */
function selecteurDeLivre(): HTMLSelectElement {
  const select = container!.querySelector<HTMLSelectElement>('select[aria-label="Livre du passage"]');
  if (!select) throw new Error('le champ d’adresse n’est pas monté : la sonde ne mesure rien');
  return select;
}

/** L'entrée du dataset CHARGÉ (donc matérialisée par le plugin). */
const TERREUR = psychologies.find((p) => p.id === 'terreur')!;

describe('atelier du Codex — la prose ADRESSÉE ne s’édite pas en double (#1389)', () => {
  it('TÉMOIN : l’entrée chargée porte bien les DEUX (l’adresse authorée, la prose matérialisée)', () => {
    expect(TERREUR.descRef, 'l’entrée n’est pas adressée — la sonde mesurerait un cas absent').toBeTruthy();
    expect(typeof TERREUR.desc, 'le plugin n’a pas matérialisé la prose — le doublon ne peut pas naître').toBe('string');
    expect(TERREUR.desc.length).toBeGreaterThan(100);
  });

  it('une entrée ADRESSÉE n’offre PAS de champ « Description » — le champ d’adresse tient sa place', () => {
    monte('psychologies', TERREUR.id);
    const presentes = champsPresentes();
    expect(presentes, 'le formulaire n’est pas monté — la sonde ne mesure rien').toContain('Libellé');
    expect(presentes, 'l’atelier propose de saisir un texte DÉRIVÉ de l’adresse').not.toContain('Description');
    expect(presentes).toContain('Adresse de la prose (livre)');
    // La place : l'adresse occupe le rang que la prose occupait (l'ordre suit la donnée chargée, où
    // `desc` est injecté À la position de `descRef`) — pas la queue du formulaire.
    expect(presentes.indexOf('Adresse de la prose (livre)')).toBeLessThan(presentes.indexOf('Source'));
  });

  it('DÉTACHER — le livre remis à vide rend la prose éditable, avec le texte matérialisé', () => {
    monte('psychologies', TERREUR.id);
    const select = selecteurDeLivre();
    expect(select.value).toBe('livre-de-base');
    const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')!.set!;
    act(() => {
      setter.call(select, '');
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });
    const zone = champ('Description')?.querySelector('textarea');
    expect(zone, 'l’entrée détachée de son adresse n’a plus AUCUNE surface où porter sa prose').toBeTruthy();
    expect(zone!.value, 'la prose détachée revient vide : l’auteur devrait la retaper').toBe(TERREUR.desc);
  });

  it('RE-CHOISIR un livre après détachement : « Description » reste éditable tant que l’adresse n’adresse rien', () => {
    monte('psychologies', TERREUR.id);
    const select = selecteurDeLivre();
    const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')!.set!;
    const choisir = (v: string) => act(() => {
      setter.call(select, v);
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });
    choisir('');
    // Le livre re-choisi rend une adresse INCOMPLÈTE (`{ book, ch: '', parts: [] }`, `DescRefField`) :
    // elle n'adresse aucun passage, donc elle ne DÉRIVE rien — sans quoi l'écran perd sa prose ET
    // toute explication jusqu'à ce que chapitre + section + blocs soient ressaisis (recette 2026-09-14).
    choisir('livre-de-base');
    const zone = champ('Description')?.querySelector('textarea');
    expect(zone, 'le livre re-choisi masque la prose alors qu’aucun passage n’est encore adressé').toBeTruthy();
    expect(zone!.value, 'la prose matérialisée a été perdue en route').toBe(TERREUR.desc);
  });

  it('la règle est STRUCTURELLE : elle porte sur le lien entre champs, pas sur un dataset', () => {
    const FRAGMENT = { kind: 'blocs', sec: 'peur', secOcc: 1, b0: 0, b1: 1, sum: '0123456789abcdef' };
    expect(estDerive({ desc: 'x', descRef: { book: 'livre-de-base', ch: '21', parts: [FRAGMENT] } }, 'desc')).toBe(true);
    expect(estDerive({ desc: 'x' }, 'desc'), 'une prose INLINE reste éditable').toBe(false);
    expect(estDerive({ desc: 'x', descRef: undefined }, 'desc'), 'adresse retirée = prose reprise').toBe(false);
    // Une adresse SANS fragment n'adresse RIEN : la prose appartient encore à l'auteur.
    expect(estDerive({ desc: 'x', descRef: { book: 'livre-de-base', ch: '', parts: [] } }, 'desc'), 'adresse sans fragment : la prose reste éditable').toBe(false);
    expect(estDerive({ desc: 'x', descRef: { book: 'livre-de-base', ch: '21', parts: [FRAGMENT] } }, 'label')).toBe(false);
  });
});
