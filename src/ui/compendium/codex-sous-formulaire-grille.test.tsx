// @vitest-environment jsdom
/**
 * #1921 — un objet imbriqué dans une rangée (`ObjectField`) range ses sous-champs dans la grille
 * `.ed-champs` des rangées (`Grid min="sm"`, `CodexEdit.tsx`), jamais dans une ligne flex sans retour.
 */
import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { act } from 'react';
import { monterRacine, demonterRacines } from '../../monterRacine.testkit';
import { CodexEdit } from '../editor/codex/CodexEdit';

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});
afterEach(demonterRacines);

describe('Codex — un sous-formulaire imbriqué empile ses champs dans la grille des rangées', () => {
  it('lumière : chaque `.ed-subform` de `cancelledBy` porte sa grille `.ed-champs`', () => {
    const montage = monterRacine(null);
    act(() => montage.rendre(<CodexEdit categoryKey="domains" id="lumiere" onClose={() => {}} />));
    const sousFormulaires = [...montage.container.querySelectorAll<HTMLElement>('.ed-subform')]
      .filter((s) => s.querySelector('[aria-label*="de annulation de la rangée 1"]'));
    expect(sousFormulaires.length, 'aucun sous-formulaire `cancelledBy` monté').toBeGreaterThan(0);
    let grilles = 0;
    for (const s of sousFormulaires) {
      const titre = s.querySelector(':scope > span')?.textContent;
      const blocs = [...s.children].filter((e) => e.tagName !== 'SPAN' && e.tagName !== 'BUTTON');
      expect(blocs.filter((e) => !e.classList.contains('ed-champs')).map((e) => e.className), `« ${titre} » hors grille`).toEqual([]);
      grilles += blocs.length;
    }
    expect(grilles, 'aucun bloc `.ed-champs` sous les sous-formulaires `cancelledBy`').toBeGreaterThan(0);
  });
});
