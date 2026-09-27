/**
 * GARDE — la porte de `SceneEntity.weapon` (#1897).
 *
 * QUESTION : « quelle arme cette entité tient-elle ? » — la porte n'admet-elle qu'un id de possession de
 * catégorie `melee` ou `ranged`, et refuse-t-elle, en le nommant, un id de possession qui n'est pas une arme ?
 */
import { describe, expect, it } from 'vitest';
import { sceneEntitySchema } from './scene';
import { findTrappingById } from '../../index';

const entite = (weapon: string) => ({ id: 'garde', kind: 'personnage', pos: { x: 1, y: 1 }, ref: 'humain', weapon });

describe('SceneEntity.weapon — sous-listes `melee` et `ranged` du catalogue des possessions', () => {
  it('une arme de corps à corps et une arme à distance passent la porte', () => {
    expect(findTrappingById('hallebarde')?.categorie).toBe('melee');
    expect(findTrappingById('arc')?.categorie).toBe('ranged');
    expect(sceneEntitySchema.safeParse(entite('hallebarde')).success).toBe(true);
    expect(sceneEntitySchema.safeParse(entite('arc')).success).toBe(true);
  });

  it('une possession qui n’est pas une arme est REFUSÉE au parse, au chemin `weapon`, en la nommant', () => {
    expect(findTrappingById('corde')?.categorie).toBe('trapping');
    const r = sceneEntitySchema.safeParse(entite('corde'));
    expect(r.success).toBe(false);
    expect(r.error!.issues.map((i) => ({ path: i.path, message: i.message }))).toEqual([
      { path: ['weapon'], message: expect.stringContaining('« corde » n\'est pas une arme') },
    ]);
  });
});
