/**
 * Les décors libres dans la case au pointeur de l'éditeur (#3731), le chemin que joue l'éditeur Godot : poser au point
 * touché, sur la table qui s'y trouve ; plaquer un coffre au mur d'un glissé ; deux décors dans une case, chacun
 * désigné par le point ; la table qui emmène sa lettre ; le support retiré qui la fait retomber. Puis ce qu'en dit le
 * validateur.
 */
import { describe, expect, it } from 'vitest';
import { emptyScene, type Scene, type SceneEntity } from '../monde/scene';
import { piedDuDecor } from '../monde/poseDuDecor';
import { validateScene } from '../validateScene';
import type { Layers, Tool } from '../sceneEditLecture';
import { appuyer, glisser, relacher, type ContexteDuPointeur, type PointDeCarte } from './pointeur';

const TOUT: Layers = { triggers: true, spawns: true, roofs: true, entries: true, rest: true, zones: true };
const ctx = (tool: Tool): ContexteDuPointeur => ({
  tool, z: 0, brush: 1, encId: '', encRef: 'mutant', layers: TOUT, sel: null, terrainRect: false, architecture: null,
});
const au = (x: number, y: number): PointDeCarte => ({ case: { x: Math.round(x), y: Math.round(y) }, f: { x, y } });
const outil = (ref: string): Tool => ({ mode: 'entite', kind: 'prop', ref });
const vide = (): Scene => emptyScene('decors-dans-la-case', 6, 4);
const parRef = (s: Scene, ref: string): SceneEntity => s.entities.find((e) => e.decor?.id === ref)!;

/** Un appui de l'outil décor `ref` au point `(x, y)`. */
const poser = (s: Scene, ref: string, x: number, y: number): Scene => appuyer(s, ctx(outil(ref)), au(x, y)).scene!;

/** Un glissé de sélection de `de` à `vers`, joué comme l'envoie Godot : un pas par case franchie, le point au relâché. */
function glisse(s: Scene, de: [number, number], vers: [number, number]): Scene {
  const c = ctx({ mode: 'selection' });
  const a = appuyer(s, c, au(...de));
  const g = glisser(s, c, a.geste, au(...vers));
  const r = relacher(g.scene ?? s, c, g.geste, au(...vers));
  return r.scene ?? g.scene ?? s;
}

describe('décors libres dans la case, au pointeur', () => {
  it('un objet lâché sur une table s’y pose, à la hauteur du plateau', () => {
    const s = poser(poser(vide(), 'table', 2, 1), 'lettre', 2.15, 0.9);
    const table = parRef(s, 'table');
    const lettre = parRef(s, 'lettre');
    expect(lettre.sur).toBe(table.id);
    expect(lettre.pos).toEqual({ x: 2, y: 1 });
    expect(piedDuDecor(s, lettre)).toBeCloseTo(0.78);
  });

  it('un coffre glissé vers le mur nord s’y plaque, sans quitter sa case', () => {
    const s = glisse(poser(vide(), 'coffre', 1, 1), [1, 1], [1, 0.7]);
    expect(parRef(s, 'coffre')).toMatchObject({ pos: { x: 1, y: 1 }, calage: { x: 0, y: -1 } });
  });

  it('un simple clic ne déplace rien', () => {
    const s = poser(vide(), 'coffre', 1, 1);
    expect(glisse(s, [1, 1], [1.02, 1])).toBe(s);
  });

  it('deux décors tiennent dans la même case et chacun se désigne par son point', () => {
    const s = poser(glisse(poser(vide(), 'coffre', 1, 1), [1, 1], [1, 0.7]), 'tonneau', 1, 1.35);
    const coffre = parRef(s, 'coffre');
    const tonneau = parRef(s, 'tonneau');
    expect(tonneau.pos).toEqual(coffre.pos);
    expect(tonneau.sur).toBeUndefined();
    const c = ctx({ mode: 'selection' });
    expect(appuyer(s, c, au(1, 0.68)).sel).toEqual({ type: 'entity', id: coffre.id });
    expect(appuyer(s, c, au(1, 1.3)).sel).toEqual({ type: 'entity', id: tonneau.id });
  });

  it('une table déplacée emmène la lettre posée dessus, et la prise sous le pointeur est gardée', () => {
    const s = poser(poser(vide(), 'table', 2, 1), 'lettre', 2.2, 1);
    const apres = glisse(s, [1.9, 1], [2.9, 2]);
    expect(parRef(apres, 'table')).toMatchObject({ pos: { x: 3, y: 2 } });
    expect(parRef(apres, 'table').calage).toBeUndefined();
    const lettre = parRef(apres, 'lettre');
    expect(lettre).toMatchObject({ pos: { x: 3, y: 2 }, sur: parRef(apres, 'table').id });
    expect(piedDuDecor(apres, lettre)).toBeCloseTo(0.78);
  });

  it('la table gommée, la lettre retombe au sol de sa case', () => {
    const s = poser(poser(vide(), 'table', 2, 1), 'lettre', 2.2, 1);
    const sansTable = appuyer(s, ctx({ mode: 'gomme' }), au(1.85, 1)).scene!;
    expect(sansTable.entities.map((e) => e.decor?.id)).toEqual(['lettre']);
    expect(sansTable.entities[0].sur).toBeUndefined();
  });
});

describe('appui d’un décor hors de l’éditeur', () => {
  it('le validateur dit l’appui qui ne tient pas, sur l’entité fautive', () => {
    const s: Scene = { ...vide(), entities: [{ id: 'lettre-1', kind: 'prop', decor: { id: 'lettre' }, pos: { x: 1, y: 1 }, sur: 'absente' }] };
    expect(validateScene([s]).filter((w) => w.refId === 'lettre-1')).toEqual([
      expect.objectContaining({ level: 'error', scope: 'entity', message: expect.stringMatching(/posé sur « absente »/) }),
    ]);
  });
});
