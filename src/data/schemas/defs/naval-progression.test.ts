/** #1595 — couverture du tableau Progression (MDG 13 l.71, l.75), patron `structureCriticals.test.ts`. */
import { describe, expect, it } from 'vitest';
import { validateDataset } from '../validate';
import navalProgressionJson from '../../naval-progression.json';
import { catalogueDuProcessus } from '../../catalogueDuProcessus';

const clone = () => structuredClone(navalProgressionJson);

describe('naval-progression.json — les bandes de DR couvrent le Test de Navigation d’un seul tenant', () => {
  it('le schéma accepte la table, et REFUSE une bande du milieu sans plancher', () => {
    expect(validateDataset('naval-progression.json', navalProgressionJson, catalogueDuProcessus())).toBeNull();
    const trouee = clone();
    trouee.entries[2].min = null;
    expect(validateDataset('naval-progression.json', trouee, catalogueDuProcessus())).toMatch(/les bandes ne couvrent pas les DR du Test de Navigation/);
  });

  it('REFUSE une bande du milieu sans plafond', () => {
    const trouee = clone();
    trouee.entries[1].max = null;
    expect(validateDataset('naval-progression.json', trouee, catalogueDuProcessus())).toMatch(/la bande « plus1 » n'a pas de borne haute/);
  });
});
