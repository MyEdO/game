/**
 * Le pointeur de l'éditeur de carte (#3508) : chaque outil routé de l'appui au relâché, avec les crans d'annulation
 * que le geste ouvre, la sélection qu'il désigne et l'arête qu'il vise.
 */
import { describe, expect, it } from 'vitest';
import { emptyScene, tileAt, type Scene } from '../monde/scene';
import { setEdgeWall } from '../sceneEdit';
import type { Layers, Tool } from '../sceneEditLecture';
import { appuyer, areteVisee, glisser, planDuPointeur, relacher, saisirLaPoignee, type ContexteDuPointeur, type PointDeCarte } from './pointeur';

const TOUT: Layers = { triggers: true, spawns: true, roofs: true, entries: true, rest: true, zones: true };
const ctx = (tool: Tool, plus: Partial<ContexteDuPointeur> = {}): ContexteDuPointeur => ({
  tool, z: 0, brush: 1, encId: '', encRef: 'mutant', layers: TOUT, sel: null, terrainRect: false, architecture: null, ...plus,
});
const au = (x: number, y: number, f = { x, y }): PointDeCarte => ({ case: { x, y }, f });
const vide = (): Scene => emptyScene('pointeur', 6, 4);

describe('pointeur de l’éditeur', () => {
  it('hors de la carte, l’appui n’ouvre aucun geste', () => {
    expect(appuyer(vide(), ctx({ mode: 'terrain', terrain: 'pierre' }), au(-1, 0))).toEqual({ geste: null });
  });

  it('le pinceau de terrain : un seul cran pour le trait, le trait tracé case par case', () => {
    const c = ctx({ mode: 'terrain', terrain: 'pierre' });
    const a = appuyer(vide(), c, au(1, 1));
    expect(a.cran).toBe(true);
    const g = glisser(a.scene!, c, a.geste, au(2, 1));
    expect(g.cran).toBe(false);
    expect(tileAt(g.scene!, 2, 1)).toBe('pierre');
    expect(g.geste).toEqual({ sorte: 'trait', cran: true, trace: [{ x: 1, y: 1 }, { x: 2, y: 1 }] });
    expect(relacher(g.scene!, c, g.geste, au(2, 1))).toEqual({ geste: null });
  });

  it('le pinceau de hauteur trace l’emprise de chaque écriture, sa taille comprise', () => {
    const a = appuyer(vide(), ctx({ mode: 'hauteur', metres: 4 }, { brush: 3 }), au(1, 1));
    expect(a.geste?.sorte === 'trait' && a.geste.trace).toHaveLength(9);
  });

  it('la gomme ouvre un cran par entité retirée, et ne trace que sa case', () => {
    const c = ctx({ mode: 'entite', kind: 'prop', ref: 'tonneau' });
    const pose1 = appuyer(vide(), c, au(1, 1)).scene!;
    const pose2 = appuyer(pose1, c, au(3, 1)).scene!;
    const gomme = ctx({ mode: 'gomme' }, { brush: 3 });
    const a = appuyer(pose2, gomme, au(1, 1));
    expect(a.geste, 'la gomme trace sa seule case, quel que soit le pinceau').toEqual({ sorte: 'trait', cran: true, trace: [{ x: 1, y: 1 }] });
    const g = glisser(a.scene!, gomme, a.geste, au(3, 1));
    expect([a.cran, g.cran]).toEqual([true, true]);
    expect(g.scene!.entities).toEqual([]);
  });

  it('le rectangle de terrain se tire puis se remplit au relâché, d’un cran', () => {
    const c = ctx({ mode: 'terrain', terrain: 'pierre' }, { terrainRect: true });
    const a = appuyer(vide(), c, au(1, 1));
    expect(a.scene).toBeUndefined();
    const g = glisser(vide(), c, a.geste, au(3, 2));
    expect(g.geste).toEqual({ sorte: 'rectangle', depart: { x: 1, y: 1 }, rect: { x: 1, y: 1, w: 3, h: 2 } });
    const r = relacher(vide(), c, g.geste, au(3, 2));
    expect(r.cran).toBe(true);
    expect(tileAt(r.scene!, 3, 2)).toBe('pierre');
  });

  it('la zone tirée au rectangle se désigne au relâché', () => {
    const c = ctx({ mode: 'zone', zone: 'trigger' });
    const r = relacher(vide(), c, appuyer(vide(), c, au(0, 0)).geste, au(2, 2));
    expect(r.sel).toEqual({ type: 'trigger', id: r.scene!.triggers[0].id });
  });

  it('l’outil murs vise l’arête la plus proche du point, depuis sa case', () => {
    const c = ctx({ mode: 'arete', paint: 'wall' });
    const pt = au(2, 1, { x: 2.05, y: 0.6 });
    expect(areteVisee(c, pt)).toEqual({ x: 2, y: 1, side: 'N' });
    const a = appuyer(vide(), c, pt);
    expect(a.cran).toBe(true);
    expect(a.scene!.walls).toEqual([expect.objectContaining({ x: 2, y: 1, side: 'N' })]);
    expect(areteVisee(ctx({ mode: 'selection' }), pt)).toBeNull();
  });

  it('en sélection, une arête de mur proche l’emporte sur la case', () => {
    const scene = setEdgeWall(vide(), 2, 1, 'N', 0, 'wall');
    expect(appuyer(scene, ctx({ mode: 'selection' }), au(2, 1, { x: 2, y: 0.55 })).sel).toEqual({ type: 'wall', x: 2, y: 1, side: 'N', z: 0 });
  });

  it('la sélection d’une entité ouvre son déplacement : rien au clic simple, un cran au premier pas réel', () => {
    const scene = appuyer(vide(), ctx({ mode: 'entite', kind: 'prop', ref: 'tonneau' }), au(1, 1)).scene!;
    const c = ctx({ mode: 'selection' });
    const a = appuyer(scene, c, au(1, 1));
    const sel = { type: 'entity', id: scene.entities[0].id };
    expect(a.sel).toEqual(sel);
    expect(glisser(scene, c, a.geste, au(1, 1))).toEqual({ geste: a.geste });
    const g1 = glisser(scene, c, a.geste, au(2, 1));
    const g2 = glisser(g1.scene!, c, g1.geste, au(3, 1));
    expect([g1.cran, g2.cran]).toEqual([true, false]);
    expect(g2.scene!.entities[0].pos).toEqual({ x: 3, y: 1 });
  });

  it('la poignée redimensionne la sélection tenue à sa saisie', () => {
    const c = ctx({ mode: 'zone', zone: 'trigger' });
    const scene = relacher(vide(), c, appuyer(vide(), c, au(0, 0)).geste, au(1, 1)).scene!;
    const sel = { type: 'trigger' as const, id: scene.triggers[0].id };
    const g = glisser(scene, ctx({ mode: 'selection' }), saisirLaPoignee(ctx({ mode: 'selection' }, { sel })), au(3, 2));
    expect(g.cran).toBe(true);
    expect(g.scene!.triggers[0].rect).toEqual({ x: 0, y: 0, w: 4, h: 3 });
  });

  it('le tracé de volée bascule chaque case une fois, sans écrire la scène', () => {
    const c = ctx({ mode: 'escalier', toZ: 1 });
    const a = appuyer(vide(), c, au(1, 1));
    expect(a.volee).toEqual({ x: 1, y: 1 });
    expect(glisser(vide(), c, a.geste, au(1, 1)).volee).toBeUndefined();
    const g = glisser(vide(), c, a.geste, au(1, 2));
    expect([g.volee, g.scene]).toEqual([{ x: 1, y: 2 }, undefined]);
  });

  it('en mode architecture, le plan du pointeur est celui de ses arêtes', () => {
    expect(planDuPointeur(ctx({ mode: 'selection' }, { z: 0, architecture: { z: 1, action: 'selection', bodyId: null } }))).toBe(1);
    expect(planDuPointeur(ctx({ mode: 'selection' }, { z: 0 }))).toBe(0);
  });
});
