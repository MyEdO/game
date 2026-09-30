import { describe, it, expect } from 'vitest';
import { emptyScene, tileAt, type Scene } from '../../state/scene';
import { terrainSolidHeightM } from '../../state/terrain';
import { buildWalls } from '../builders/walls';
import { buildRoofs } from '../builders/roofs';
import type { Dims } from '../../geometry/iso';
import { wallLayerObjs, wallTraitObjs } from './layers';
import { scenario as entrainement } from '../../scenes/test-scenarios/entrainement';
import { diligenceCampaign, paquetDuJeu } from '../../scenes/campaign';
const entrainementConstruit = entrainement.construire();

/**
 * Couche des MURS au trait (plan de station, aperçu d'éditeur). Les couches de SOLS et de TOITS
 * projetées en SVG sont mortes avec la voie de jeu affine (#1176 P3-4, commit C5a) : les vérités de
 * SCÈNE qu'elles bakaient (ghost/solidOverhang, hauteur métrique, relations de pièce) sont celles des
 * BUILDERS, et s'y testent — `builders/floors.test.ts`, `builders/props.test.ts`,
 * `builders/roofs.test.ts`. Ce qui reste ici est la PROJECTION, et elle seule.
 */
const DIMS = (s: { dimensions: { w: number; h: number } }): Dims => ({ ...s.dimensions, rot: 0, view: 'iso' });
const OPTS = { zoom: 1, mpt: 2 };

describe('couche des murs — la projection porte les vérités du builder', () => {
  it('murs : PLUS d’op bakée (aucune estompe d’occlusion ici) ; vis = vérité du builder ; x,y,z portés', () => {
    const s = emptyScene(3, 3);
    s.walls = [{ x: 1, y: 1, side: 'N' }];
    const objs = wallLayerObjs(buildWalls(s, 'jeu'), DIMS(s), 0, OPTS);
    expect(objs).toHaveLength(1);
    expect(objs[0].x).toBe(1);
    expect(objs[0].y).toBe(1);
    expect(objs[0].vis).toBe(true); // sans set de visibilité : tout visible (builder)
    expect(objs[0]).toMatchObject({ kind: 'wall', side: 'N' });
  });

  it('propage les relations architecturales du mur au stage, et le builder de toits porte les siennes', () => {
    const s = emptyScene(5, 5);
    s.effectZones = [{ id: 'salle', label: 'Salle', presentation: 'interior', area: { kind: 'rect', x: 2, y: 2, w: 1, h: 1 }, z: 0 }];
    s.walls = [{ x: 2, y: 2, side: 'N' }];
    s.architecture = [{
      id: 'corps', style: 'maison', storeys: [],
      facades: [{ id: 'facade', z: 0, edges: [{ x: 2, y: 2, side: 'N' }], appearance: 'mur-a-ossature-en-bois', roomZoneIds: ['salle'] }],
      masses: [{ id: 'toit', z: 0, footprint: [{ x: 2, y: 2, w: 1, h: 1 }], levels: 1, profile: 'flat', pitchDeg: 30, material: 'tuile' }],
    }];

    expect(wallLayerObjs(buildWalls(s, 'jeu'), DIMS(s), 0, OPTS)[0].roomZoneIds).toEqual(['salle']);
    // La nappe porte la MÊME relation, lue directement au builder : c'est de là que la voie volumique
    // la prend (`MondeDeCampagne.keepEl` → `cutawayForSection`), aucune projection SVG entre les deux.
    expect(buildRoofs(s)[0].roomZoneIds).toEqual(['salle']);
  });
});

/**
 * CONTRAT DU TRAIT D'OBSTACLE (#1176, P3-5b, sonde du juge vision promue) : un obstacle s'auteure de
 * DEUX façons — un segment `WallSeg` sur une arête (scènes bâties) ou une TUILE de terrain à bloc plein
 * (scènes à grille). En vue du dessus, les deux portent la même sémantique et doivent donc produire du
 * TRAIT. Le trou mesuré avant correctif : terrain d'entraînement = 0 trait pour 4 tuiles mur — tout le
 * scénario (couvert, ligne de vue) reposait sur un muret qui se lisait « dalle de sol pâle ».
 */
const TOP = (s: Scene): Dims => ({ w: s.dimensions.w, h: s.dimensions.h, view: 'top' });

/** Combien de tuiles à BLOC PLEIN la couche `z` porte-t-elle (le fait que le trait doit couvrir) ? */
function tuilesPleines(s: Scene, z = 0): number {
  let n = 0;
  for (let y = 0; y < s.dimensions.h; y++)
    for (let x = 0; x < s.dimensions.w; x++) if (terrainSolidHeightM(tileAt(s, x, y, z)) > 0) n += 1;
  return n;
}

describe('trait d’obstacle — éléments de mur ET tuiles à bloc plein', () => {
  it('SCÈNE À GRILLE RÉELLE (terrain d’entraînement) : des tuiles mur ⇒ des traits', () => {
    const s = entrainementConstruit.scene;
    expect(tuilesPleines(s), 'témoin : le muret de couvert est bien authoré en tuiles').toBe(4);
    expect(buildWalls(s, 'jeu', undefined, { activeZ: 0, viewZ: 0 }), 'témoin : et en AUCUN segment de mur').toHaveLength(0);
    // Muret contigu de 4 cases en colonne : le CONTOUR fait 10 arêtes (4 + 4 + 1 + 1), jamais 16.
    expect(wallTraitObjs(s, TOP(s), 0)).toHaveLength(10);
  });

  it('SCÈNE BÂTIE RÉELLE (La Diligence) : les segments continuent de porter le trait, sans doublon', () => {
    const s = paquetDuJeu(diligenceCampaign).scenes[0];
    const segments = buildWalls(s, 'jeu', undefined, { activeZ: 0, viewZ: 0 }).length;
    expect(segments).toBeGreaterThan(0);
    // Aucune tuile pleine sur cette scène : le compte de traits est EXACTEMENT celui des segments.
    expect(tuilesPleines(s)).toBe(0);
    expect(wallTraitObjs(s, TOP(s), 0)).toHaveLength(segments);
  });

  it('CONTRAT : toute couche portant au moins une tuile mur produit du trait ; sans obstacle, aucun', () => {
    const grille = emptyScene(5, 5);
    grille.layers[0].tiles[2 * 5 + 2] = 'mur';
    expect(tuilesPleines(grille)).toBe(1);
    expect(wallTraitObjs(grille, TOP(grille), 0).length).toBeGreaterThan(0);
    // Contrat INVERSE : ni mur d'arête ni tuile pleine ⇒ pas un seul trait (rien à inventer).
    const nue = emptyScene(5, 5);
    expect(tuilesPleines(nue)).toBe(0);
    expect(wallTraitObjs(nue, TOP(nue), 0)).toHaveLength(0);
  });

  it('le BROUILLARD s’applique au trait de tuile comme au reste : tout ou rien', () => {
    const s = emptyScene(5, 5);
    s.layers[0].tiles[2 * 5 + 2] = 'mur';
    expect(wallTraitObjs(s, TOP(s), 0, new Set(['2,2,0'])).length).toBeGreaterThan(0);
    expect(wallTraitObjs(s, TOP(s), 0, new Set(['0,0,0']))).toHaveLength(0);
  });
});
