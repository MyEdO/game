// @vitest-environment jsdom
/**
 * #3433 — l'atelier des règles de négoce (`sea-cargo.json`, MDG 15 ; `land-cargo.json`, MSRC 13) monte
 * leur fiche UNIQUE, chaque champ sous son libellé FR, jamais sous sa clé technique.
 */
import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { act } from 'react';
import { monterRacine, demonterRacines } from '../../monterRacine.testkit';
import { CodexEdit } from '../editor/codex/CodexEdit';
import { datasetObject } from '../../data/overrides';

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});
afterEach(demonterRacines);

/** Les intitulés de champ rendus par le formulaire. */
function intitules(cle: 'seaCargo' | 'landCargo'): string[] {
  const montage = monterRacine(null);
  act(() => montage.rendre(<CodexEdit categoryKey={cle} id={datasetObject(cle).id} onClose={() => {}} />));
  return [...montage.container.querySelectorAll<HTMLElement>('.ed-field > span, .ed-subform > span, .ed-check > span')].map((s) => s.textContent ?? '');
}

const CLE_TECHNIQUE = /^[a-z]+[A-Z0-9]\w*$/;

describe('Atelier — règles de négoce (#3433)', () => {
  it('maritime : barèmes d’achat, de vente, de surcharge et du Commerce d’opportunité, nommés en français', () => {
    const vus = intitules('seaCargo');
    for (const attendu of ['Règles d\'achat', 'Règles de vente', 'Surcharge', 'Commerce d\'opportunité', 'Compétence dans un grand port', 'Paliers', 'Issues'])
      expect(vus.some((v) => v.startsWith(attendu)), attendu).toBe(true);
    expect(vus.filter((v) => CLE_TECHNIQUE.test(v))).toEqual([]);
  });

  it('terrestre : qualité du vin et rumeurs en tableaux de rangées, nommés en français', () => {
    const vus = intitules('landCargo');
    for (const attendu of ['Qualité du vin', 'Rumeurs', 'Règles d\'achat', 'Ragot', 'Mise à prix selon la Richesse'])
      expect(vus.some((v) => v.startsWith(attendu)), attendu).toBe(true);
    expect(vus.filter((v) => CLE_TECHNIQUE.test(v))).toEqual([]);
  });
});
