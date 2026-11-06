import { describe, it, expect } from 'vitest';
import { categoryByKey } from './registry';
import { careerLevels } from '../../data';

/**
 * #1467 L1b V-P1 — la rubrique « Niveaux de carrière » du Codex EXPOSE l'id de la DONNÉE.
 *
 * Le registre recomposait l'identité au vol (`` `${lv.career}:${lv.level}` ``) : une SECONDE graphie
 * de l'id, d'un séparateur qui n'est celui d'aucun id du dépôt, fabriquée à un seul call-site. Depuis
 * que `careerLevels.json` porte son `id`, le registre le LIT. Toute recomposition rougit ici.
 */
describe('Codex registry — « Niveaux de carrière » : l’id vient de la donnée (#1467 L1b V-P1)', () => {
  it('les ids de la rubrique sont EXACTEMENT ceux du dataset, dans le même ordre', () => {
    const items = categoryByKey('careerLevels')!.items;
    expect(items.map((i) => i.id)).toEqual(careerLevels.map((lv) => lv.id));
  });

  it('aucun id de la rubrique ne porte le séparateur `:` d’une identité recomposée', () => {
    const recomposes = categoryByKey('careerLevels')!.items
      .map((i) => i.id)
      .filter((id) => id.includes(':'));
    expect(recomposes, 'id recomposé au call-site au lieu d’être lu sur l’entrée').toEqual([]);
  });

  it('échantillon nommé : le Pamphlétaire est `agitateur-1`', () => {
    const items = categoryByKey('careerLevels')!.items;
    expect(items.find((i) => i.id === 'agitateur-1')).toBeTruthy();
  });
});
