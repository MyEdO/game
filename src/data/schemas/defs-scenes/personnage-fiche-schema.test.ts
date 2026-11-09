/**
 * Un personnage de scène NOMME sa fiche (#1882) : `sceneEntitySchema` (`./scene.ts`) l'exige au parse. Le corps
 * désigné par `ref(type)` : `./corps-d-entite.test.ts`.
 */
import { describe, expect, it } from 'vitest';
import { sceneEntitySchema } from './scene';

const FICHE = { type: 'statblock', label: 'Ennemi', char: { B: 10 } };
describe('sceneEntitySchema — un personnage NOMME sa fiche (#1882)', () => {
  it('au SCHÉMA : chaque porteur SEUL suffit, l’absence de tous est l’issue nommée au chemin du premier', () => {
    const base = { id: 'p', kind: 'personnage', pos: { x: 0, y: 0 } };
    const porteurs = [{ creature: { id: 'moritz-valgeir' } }, { vehicule: { id: 'cogue' } }, { engin: { id: 'baliste' } }, { statblock: FICHE }, { presetId: 'baron' }];
    for (const porteur of porteurs)
      expect(sceneEntitySchema.safeParse({ ...base, ...porteur }).success, Object.keys(porteur)[0]).toBe(true);
    expect(sceneEntitySchema.safeParse(base).error?.issues.map((i) => [i.path.join('.'), i.message])).toEqual([
      ['creature', '« creature », « vehicule », « engin », « statblock », « presetId » absents — un personnage NOMME sa fiche (bestiaire, coque, engin de siège, statbloc ou preset de PNJ)'],
    ]);
  });
});
