import { describe, it, expect } from 'vitest';
import { buildFloors } from './floors';
import { buildWalls } from './walls';
import { buildRoofs } from './roofs';
import { emptyScene, type BuildingMass, type Scene, type WallSeg } from '../../state/scene';

/**
 * VÉRITÉ DE VUE ⟂ GÉOMÉTRIE (#808) — le contrat de perf du pas, en contrats POSITIFS.
 * Un pas d'exploration ne change QUE le brouillard (et, en entrant sous un toit, le dégagement) : les
 * builders doivent alors rendre le MÊME TABLEAU (référence) quand rien de leur vérité de vue n'a
 * bougé, et ne réallouer QUE les éléments qui basculent quand elle bouge — les autres gardent leur
 * IDENTITÉ. C'est ce qui laisse vivants les memos du stage (projection, tri, réconciliation React).
 *
 * La vérité elle-même est vérifiée ICI aussi (elle ne se négocie pas contre de la vitesse) : un mur
 * est perçu dès qu'une des deux cases qu'il borde est en vue, un bloc plein dès qu'une case ouverte
 * qu'il borde l'est, une nappe se lève quand un allié tient sous son emprise.
 */

const sceneWith = (walls: WallSeg[]): Scene => {
  const s = emptyScene(6, 6);
  s.walls = walls;
  return s;
};

const mass = (id: string, x: number, y: number, w: number, h: number): BuildingMass => ({
  id, z: 0, footprint: [{ x, y, w, h }], levels: 1, profile: 'gable', ridge: 'x', pitchDeg: 30, material: 'tuile',
});
const sceneWithMasses = (...masses: BuildingMass[]): Scene => {
  const s = emptyScene(20, 20);
  s.architecture = [{ id: 'corps', style: 'maison', storeys: [], facades: [], masses }];
  return s;
};

/** Scène 4×4 avec un BLOC PLEIN (terrain `mur`) en (1,1) — la vérité « perçu » des sols s'y joue. */
function sceneWithBlock(): Scene {
  const s = emptyScene(4, 4);
  s.layers[0].tiles = new Array(16).fill('plancher');
  s.layers[0].tiles[1 * 4 + 1] = 'mur';
  return s;
}

const VIEW = { activeZ: 0, viewZ: null };
const wallAt = (els: readonly { key: string }[], x: number, y: number, side: string) =>
  els.findIndex((e) => e.key === `wall:${x},${y},${side},0`);

describe('buildWalls — vérité de vue résolue au pas, géométrie dérivée UNE fois', () => {
  const scene = sceneWith([{ x: 2, y: 2, side: 'N' }, { x: 4, y: 4, side: 'N' }]);

  it('deux pas de MÊME visibilité rendent le MÊME TABLEAU — la vue est lue par CONTENU, pas par référence d’ensemble', () => {
    const a = buildWalls(scene, 'jeu', new Set(['2,2,0']), VIEW);
    const b = buildWalls(scene, 'jeu', new Set(['2,2,0']), VIEW); // ensemble NEUF, contenu identique
    expect(b).toBe(a);
  });

  it('un mur qui entre en vue ne réalloue QUE lui — les autres gardent leur identité', () => {
    const avant = buildWalls(scene, 'jeu', new Set(['2,2,0']), VIEW);
    const apres = buildWalls(scene, 'jeu', new Set(['2,2,0', '4,4,0']), VIEW);
    const i = wallAt(avant, 2, 2, 'N'), j = wallAt(avant, 4, 4, 'N');
    expect(apres).not.toBe(avant); // une vérité a bougé : tableau neuf
    expect(apres[i]).toBe(avant[i]); // le mur inchangé est le MÊME objet
    expect(avant[j].states.visible).toBe(false);
    expect(apres[j].states.visible).toBe(true);
  });

  it('un mur est PERÇU dès que l’UNE des deux cases qu’il borde est en vue (l’arête N borde y et y−1)', () => {
    const seulementDerriere = buildWalls(scene, 'jeu', new Set(['2,1,0']), VIEW);
    expect(seulementDerriere[wallAt(seulementDerriere, 2, 2, 'N')].states.visible).toBe(true);
    const horsVue = buildWalls(scene, 'jeu', new Set(['0,0,0']), VIEW);
    expect(horsVue[wallAt(horsVue, 2, 2, 'N')].states.visible).toBe(false);
  });

  it('`visible` ABSENT ⇒ tout est en vue (éditeur/QC/POV) — sémantique conservée', () => {
    for (const el of buildWalls(scene, 'jeu', undefined, VIEW)) expect(el.states.visible).toBe(true);
  });

  it('une scène MUTÉE PAR SPREAD re-dérive sa géométrie (aucun cache périmé)', () => {
    const ouverte = { ...scene, walls: [{ x: 2, y: 2, side: 'N' as const, door: true }] };
    const fermee = { ...scene, walls: [{ x: 2, y: 2, side: 'N' as const, door: true, closed: true }] };
    expect(buildWalls(ouverte, 'jeu', undefined, VIEW)[0].states.open).toBe(true);
    expect(buildWalls(fermee, 'jeu', undefined, VIEW)[0].states.open).toBe(false);
  });
});

describe('buildFloors — vérité de vue résolue au pas', () => {
  const scene = sceneWithBlock();

  it('deux pas de MÊME visibilité rendent le MÊME TABLEAU', () => {
    expect(buildFloors(scene, new Set(['0,1,0']), VIEW)).toBe(buildFloors(scene, new Set(['0,1,0']), VIEW));
  });

  it('un BLOC PLEIN est perçu dès qu’une case OUVERTE qu’il borde est en vue, et pas avant', () => {
    const bloc = (els: readonly { key: string; states: { visible: boolean } }[]) =>
      els.find((e) => e.key === 'floor:1,1,0')!;
    expect(bloc(buildFloors(scene, new Set(['3,3,0']), VIEW)).states.visible).toBe(false);
    expect(bloc(buildFloors(scene, new Set(['1,0,0']), VIEW)).states.visible).toBe(true);
  });

  it('un sol ORDINAIRE reste sous le voile quelle que soit la vue — et garde son identité d’un pas à l’autre', () => {
    const a = buildFloors(scene, new Set(['3,3,0']), VIEW);
    const b = buildFloors(scene, new Set(['1,0,0']), VIEW);
    const i = a.findIndex((e) => e.key === 'floor:3,3,0');
    expect(a[i].states.visible).toBe(false);
    expect(b[i]).toBe(a[i]); // le bloc a basculé, ce sol NON → même objet
  });
});

describe('buildRoofs — le dégagement est la SEULE vérité de vue d’une nappe', () => {
  const scene = sceneWithMasses(mass('a', 2, 2, 4, 2));

  it('deux pas sans changement de pièce occupée rendent le MÊME TABLEAU', () => {
    const a = buildRoofs(scene, { allies: [{ x: 10, y: 10, z: 0 }] });
    const b = buildRoofs(scene, { allies: [{ x: 11, y: 10, z: 0 }] }); // toujours dehors
    expect(b).toBe(a);
    for (const el of a) expect(el.states.roofOccupied).toBe(false);
  });

  it('un allié SOUS l’emprise lève la nappe ENTIÈRE ; en ressortir REND les mêmes objets, et le pas suivant re-stabilise', () => {
    const dehors = buildRoofs(scene, { allies: [{ x: 10, y: 10, z: 0 }] });
    const dessous = buildRoofs(scene, { allies: [{ x: 3, y: 2, z: 0 }] });
    expect(dessous).not.toBe(dehors); // une vérité a bougé : tableau neuf
    for (const el of dessous) expect(el.states.roofOccupied).toBe(true);
    // Ressortir rejoue la variante DÉJÀ matérialisée : mêmes ÉLÉMENTS (aucune réallocation de nappe).
    const retour = buildRoofs(scene, { allies: [{ x: 10, y: 10, z: 0 }] });
    retour.forEach((el, i) => expect(el).toBe(dehors[i]));
    // Le tableau, lui, se re-stabilise dès le pas suivant sans changement.
    expect(buildRoofs(scene, { allies: [{ x: 11, y: 10, z: 0 }] })).toBe(retour);
  });

  it('une nappe reste TOUJOURS hors du voile — le brouillard ne la concerne pas (#818)', () => {
    for (const el of buildRoofs(scene, { allies: [{ x: 3, y: 2, z: 0 }] })) expect(el.states.visible).toBe(true);
  });
});
