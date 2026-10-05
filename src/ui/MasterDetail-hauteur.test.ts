import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { reglesCss, declarations } from '../../scripts/guards/lib/cssCouches.mjs';

/**
 * Rail de `MasterDetail` (#679) : plafonné (`min(60vh, 520px)`) ; avec un slot d'ACTION, c'est la
 * colonne `.master-detail-rail` qui porte le plafond, la liste s'y rétrécit et défile, et l'action
 * reste sous elle HORS de son défilement — jamais « Ajouter » perdu au pied d'une liste défilante.
 * jsdom ne met rien en page : la mesure en pixels vit à la recette navigateur, ce banc tient le
 * CONTRAT déclaré.
 */
const css = readFileSync(fileURLToPath(new URL('./styles/layout.css', import.meta.url)), 'utf8');
const regle = (selecteur: string): Record<string, string> => {
  const regles = reglesCss(css).filter((r) => r.media == null && r.selecteurs.includes(selecteur));
  expect(regles.length, `\`${selecteur}\` doit porter une règle hors média`).toBeGreaterThan(0);
  return Object.assign({}, ...regles.map((r) => Object.fromEntries(declarations(r.corps).map((x) => [x.prop, x.valeur]))));
};

describe('MasterDetail — rail plafonné, action hors du défilement de la liste', () => {
  it('le rail (liste seule, ou colonne liste + action) porte le plafond', () => {
    expect(regle('.master-detail-list')['max-height']).toBe('min(60vh, 520px)');
    expect(regle('.master-detail-list')['overflow-y']).toBe('auto');
    expect(regle('.master-detail-rail')['max-height']).toBe('min(60vh, 520px)');
  });

  it('avec une action, la liste se rétrécit dans la colonne et l’action ne se rétrécit pas', () => {
    const rail = regle('.master-detail-rail');
    expect(rail.display).toBe('flex');
    expect(rail['flex-direction']).toBe('column');
    const liste = regle('.master-detail-rail > .master-detail-list');
    expect(liste['max-height']).toBe('none');
    expect(liste['min-height']).toBe('0');
    expect(regle('.master-detail-action').flex).toBe('0 0 auto');
  });
});
