/**
 * LES ÉCHANTILLONS PAR LE PONT (#3802, `CONTRAT.md`, section « Atelier 3D ») : `echantillons` sert, hors partie, les
 * familles de ce que le jeu dessine en 3D et leurs entrées, et `echantillon` la scène dessinée de chaque entrée, celle
 * du noyau (`echantillonDessine`) ; une famille ou une entrée hors de `echantillons` est refusée.
 */
import { describe, it, expect } from 'vitest';
import { erreurDe, table } from './pont.testkit';
import { echantillonDessine, famillesDEchantillons, type FamilleDEchantillons } from '../../../src/noyau/index';

const { appel } = table();

describe('les échantillons par le pont', () => {
  it('`echantillons` sert les familles du noyau, hors partie', () => {
    const r = appel('echantillons');
    expect(r.ok).toBe(true);
    expect((r as unknown as { familles: FamilleDEchantillons[] }).familles).toEqual(famillesDEchantillons());
  });

  it('`echantillon` rend la scène dessinée de la première entrée de chaque famille', () => {
    for (const famille of famillesDEchantillons()) {
      const { id } = famille.entrees[0]!;
      const { ok, ...dessine } = appel('echantillon', { famille: famille.id, id });
      expect(ok, `${famille.id} ${id}`).toBe(true);
      expect(dessine, `${famille.id} ${id}`).toEqual(JSON.parse(JSON.stringify(echantillonDessine(famille.id, id))));
    }
  });

  it('`echantillon` refuse une famille ou une entrée hors de `echantillons`', () => {
    expect(erreurDe(appel('echantillon', { famille: 'nuage', id: 'cumulus' }))).toMatchObject({ categorie: 'validation', message: expect.stringContaining('famille') });
    expect(erreurDe(appel('echantillon', { famille: 'sol', id: 'nuage' }))).toMatchObject({ categorie: 'validation', message: expect.stringContaining('famille sol') });
  });
});
