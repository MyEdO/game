import { describe, it, expect } from 'vitest';
import { emptyScene } from '../../noyau/monde/scene';
import { validateScene } from '../../noyau/validateScene';
import { changePropRef } from '../../noyau/sceneEdit';
import { buildProps } from '../../gameIso/builders/props';
import { estPropVolumique } from '../../gameIso/builders/types';

/** Le cap d'identité que `changePropRef` pose se lit au constructeur de props du rendu (`gameIso`). */
describe('éditeur — les places assises suivent le geste, atomiquement', () => {
  it('changer la ref vers un décor VOLUMIQUE fait retomber un cap refusé au cap d’identité : le geste ne crée pas de faute (C2)', () => {
    const s = emptyScene('scene-test', 8, 8);
    // Un décor HORS catalogue (repli #877) n'a pas de recette : son cap diagonal n'est pas la faute nommée.
    s.entities = [{ id: 'p3', kind: 'prop', pos: { x: 4, y: 4 }, decor: { id: 'decor-hors-catalogue' }, facing: 'NE' }];
    expect(validateScene([s]).filter((w) => w.refId === 'p3' && /orientation/.test(w.message))).toEqual([]);
    const apres = changePropRef(s, 'p3', 'tonneau');
    expect(apres.entities[0]).toMatchObject({ decor: { id: 'tonneau' }, facing: 'S' });
    expect(validateScene([apres]).filter((w) => w.refId === 'p3')).toEqual([]);
    const [el] = buildProps(apres).filter((e) => e.entId === 'p3');
    expect(estPropVolumique(el), 'le tonneau se cuit en volume, au cap d’identité').toBe(true);
    // Un cap ADMIS par le nouveau type n'est pas touché.
    expect(changePropRef({ ...s, entities: [{ ...s.entities[0], facing: 'E' }] }, 'p3', 'tonneau').entities[0].facing).toBe('E');
    expect(changePropRef(apres, 'p3', 'brasero').entities[0].facing).toBe('S');
  });
});
