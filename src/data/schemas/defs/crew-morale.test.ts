/** #1595 — couverture des bandes de Moral (MDG 14 l.188, l.199), patron `structureCriticals.test.ts`. */
import { describe, expect, it } from 'vitest';
import { validateDataset } from '../validate';
import crewMoraleJson from '../../crew-morale.json';

type Bande = { id: string; min: number | null; max: number | null };
const clone = () => structuredClone(crewMoraleJson) as unknown as { bands: Bande[] };

describe('crew-morale.json — les bandes de Moral couvrent le score d’un seul tenant', () => {
  it('le schéma accepte les bandes, et REFUSE une bande du milieu sans plafond', () => {
    expect(validateDataset('crew-morale.json', crewMoraleJson)).toBeNull();
    const trouee = clone();
    trouee.bands[1].max = null;
    expect(validateDataset('crew-morale.json', trouee)).toMatch(/la bande « excellent-equipage » n'a pas de borne haute/);
  });

  it('REFUSE la bande « 50 ou moins » refermée par un plancher (MDG 14 l.199)', () => {
    const refermee = clone();
    refermee.bands[3].min = 0;
    expect(validateDataset('crew-morale.json', refermee)).toMatch(/la bande « canailles » est la PREMIÈRE et porte un plancher \(0\)/);
  });
});
