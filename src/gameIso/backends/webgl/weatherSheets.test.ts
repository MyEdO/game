/**
 * NAPPES DE BRUME (#1247) — la brume volumique est de la MATIÈRE posée dans le monde, pas une rampe de
 * profondeur caméra. Ce banc mesure ce dont dépend sa justesse : où elle est (les colonnes à CIEL
 * OUVERT, par la vérité d'abri du dépôt), à quelle cote, et à quel prix de géométrie.
 */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { brumeSheetGeometry, buildBrumeSheets, openSkyRuns, retainBrumeSheets } from './weatherSheets';
import { sceneGroundSpan } from './weatherParticles';
import { emptyScene, sceneMetresPerTile, type BuildingMass, type Scene } from '../../../noyau/monde/scene';
import { isSheltered, shelterField } from '../../builders/roofs';
import type { WeatherBrumeDef } from '../../catalog/ambiance';

const BRUME: WeatherBrumeDef = {
  color: '#aab4bd',
  layers: [{ hM: 0.6, alpha: 0.3 }, { hM: 2.2, alpha: 0.22 }, { hM: 4.5, alpha: 0.14 }],
};

/** Une masse qui coiffe le carré (3,3)-(6,6). */
const TOIT: BuildingMass = {
  id: 'toit-maison',
  z: 0,
  footprint: [{ x: 3, y: 3, w: 4, h: 4 }],
  levels: 1,
  profile: 'gable',
  ridge: 'x',
  pitchDeg: 45,
  material: 'tuile',
};

function scèneCouverte(): Scene {
  const scene = emptyScene('scene-test', 12, 12);
  scene.architecture = [{ id: 'maison', label: 'Maison', style: 'maison', storeys: [], facades: [], masses: [TOIT] }];
  return scene;
}

/** Les nappes d'une scène, par le chemin RÉEL de l'écran : plan retenu, puis meshes. */
const nappesDe = (scene: Scene, def = BRUME) =>
  buildBrumeSheets(retainBrumeSheets(null, scene, sceneMetresPerTile(scene), def).plan, def);

describe('weatherSheets — les nappes ne couvrent QUE le ciel ouvert', () => {
  it('carte NUE : une bande pleine par rangée (la fusion, pas un quad par case)', () => {
    const scene = emptyScene('scene-test', 12, 12);
    const runs = openSkyRuns(scene);
    expect(runs.length).toBe(12);
    for (const r of runs) expect([r.x0, r.x1]).toEqual([0, 11]);
  });

  it('sous une masse : la colonne coiffée est RETIRÉE, la rangée se coupe en deux bandes', () => {
    const scene = scèneCouverte();
    const runs = openSkyRuns(scene);
    const rangée = runs.filter((r) => r.y === 4);
    expect(rangée.map((r) => [r.x0, r.x1])).toEqual([[0, 2], [7, 11]]);
    // …et c'est bien la vérité d'ABRI du dépôt qui décide, pas un second calcul de ce module.
    const abris = shelterField(scene);
    for (let x = 3; x <= 6; x++) expect(isSheltered(abris, x, 4, 0)).toBe(true);
    expect(isSheltered(abris, 2, 4, 0)).toBe(false);
  });

  it('aucune colonne ouverte (bâti partout) : AUCUNE nappe montée', () => {
    const scene = emptyScene('scene-test', 4, 4);
    scene.architecture = [{
      id: 'bloc', label: 'Bloc', style: 'maison', storeys: [], facades: [],
      masses: [{ ...TOIT, id: 'toit-bloc', footprint: [{ x: 0, y: 0, w: 4, h: 4 }] }],
    }];
    expect(openSkyRuns(scene)).toEqual([]);
    expect(nappesDe(scene)).toEqual([]);
  });
});

describe('weatherSheets — cotes et matière', () => {
  it('une nappe PAR couche, à la cote de la donnée AU-DESSUS du sol le plus bas', () => {
    const scene = emptyScene('scene-test', 6, 6);
    const { groundM } = sceneGroundSpan(scene);
    const nappes = nappesDe(scene);
    expect(nappes.length).toBe(3);
    nappes.forEach((mesh, i) => {
      const pos = mesh.geometry.getAttribute('position');
      const cotes = new Set<number>();
      for (let k = 0; k < pos.count; k++) cotes.add(pos.getY(k));
      expect(cotes.size, 'une nappe est PLATE : une seule cote').toBe(1);
      expect([...cotes][0]).toBeCloseTo(groundM + BRUME.layers[i].hM, 5); // tampon Float32
    });
  });

  it('le relief déplace TOUTES les nappes du même cran (cote au sol le plus BAS)', () => {
    const scene = emptyScene('scene-test', 6, 6);
    scene.layers[0].height = new Array(36).fill(3);
    const nappes = nappesDe(scene);
    const y = (m: THREE.Mesh) => (m.geometry.getAttribute('position') as THREE.BufferAttribute).getY(0);
    expect(y(nappes[0])).toBeCloseTo(3 + BRUME.layers[0].hM, 5);
    expect(sceneGroundSpan(scene).groundM).toBe(3);
  });

  it('la géométrie couvre l’emprise MÉTRIQUE des bandes, deux triangles chacune', () => {
    const mpt = sceneMetresPerTile(emptyScene('scene-test', 4, 4));
    const geo = brumeSheetGeometry([{ y: 2, x0: 1, x1: 3 }], mpt, 5);
    const pos = geo.getAttribute('position');
    expect(pos.count).toBe(6); // 2 triangles
    const xs = Array.from({ length: 6 }, (_, k) => pos.getX(k));
    const zs = Array.from({ length: 6 }, (_, k) => pos.getZ(k));
    expect(Math.min(...xs)).toBeCloseTo(0.5 * mpt, 9);
    expect(Math.max(...xs)).toBeCloseTo(3.5 * mpt, 9);
    expect(Math.min(...zs)).toBeCloseTo(1.5 * mpt, 9);
    expect(Math.max(...zs)).toBeCloseTo(2.5 * mpt, 9);
  });

  it('matériau : translucide à l’alpha de la donnée, sans écriture de profondeur, NON embrumé', () => {
    const nappes = nappesDe(emptyScene('scene-test', 4, 4));
    const mat = nappes[0].material as THREE.MeshBasicMaterial;
    expect(mat.transparent).toBe(true);
    expect(mat.opacity).toBe(BRUME.layers[0].alpha);
    expect(mat.depthWrite).toBe(false);
    expect(mat.fog, 'une nappe EST la météo : la brume de distance la délaverait deux fois').toBe(false);
    expect(`#${mat.color.getHexString()}`).toBe(BRUME.color);
  });
});

/**
 * RÉTENTION DU PLAN (#1247) — une nappe ne se reconstruit pas au pas du groupe. Le store produit une
 * NOUVELLE référence de scène à chaque pas d'un combattant (documenté au semis, `precipFieldKey`) :
 * keyée dessus, la nappe rebâtissait tout le couvert (6,9 ms mesurés sur 60×60 à 81 masses) pour une
 * géométrie identique.
 */
describe('weatherSheets — le plan est RETENU, pas rebâti (#1247)', () => {
  const mptDe = (s: Scene) => sceneMetresPerTile(s);

  it('nouvelle référence de scène, MÊME contenu ⇒ le MÊME plan (objet identique)', () => {
    const scene = scèneCouverte();
    const slot = retainBrumeSheets(null, scene, mptDe(scene), BRUME);
    const apresUnPas = retainBrumeSheets(slot, { ...scene }, mptDe(scene), BRUME);
    expect(apresUnPas, 'un pas de combattant ne rebâtit rien').toBe(slot);
    expect(apresUnPas.plan).toBe(slot.plan);
  });

  it('le BÂTI change (l’éditeur retire une masse) ⇒ un plan NEUF, et un couvert neuf', () => {
    const scene = scèneCouverte();
    const slot = retainBrumeSheets(null, scene, mptDe(scene), BRUME);
    const sansToit = { ...scene, architecture: [] };
    const neuf = retainBrumeSheets(slot, sansToit, mptDe(scene), BRUME);
    expect(neuf).not.toBe(slot);
    expect(neuf.plan.runs.length, 'sans bâti : une bande pleine par rangée').toBe(12);
    expect(slot.plan.runs.length, 'avec la maison : la rangée coiffée se coupe en deux').toBeGreaterThan(12);
  });

  it('la MÉTÉO, l’échelle ou la donnée de brume changent ⇒ un plan NEUF', () => {
    const scene = scèneCouverte();
    const mpt = mptDe(scene);
    const slot = retainBrumeSheets(null, scene, mpt, BRUME);
    expect(retainBrumeSheets(slot, { ...scene, weather: 'tempete' }, mpt, BRUME)).not.toBe(slot);
    expect(retainBrumeSheets(slot, { ...scene }, mpt * 2, BRUME)).not.toBe(slot);
    expect(retainBrumeSheets(slot, { ...scene }, mpt, { ...BRUME, color: '#ffffff' })).not.toBe(slot);
  });

  it('le RELIEF entre dans le plan : une couche réécrite rebâtit (la cote des nappes en dépend)', () => {
    const scene = emptyScene('scene-test', 6, 6);
    const slot = retainBrumeSheets(null, scene, mptDe(scene), BRUME);
    const surButte = { ...scene, layers: [{ ...scene.layers[0], height: new Array(36).fill(4) }] };
    const neuf = retainBrumeSheets(slot, surButte, mptDe(scene), BRUME);
    expect(neuf).not.toBe(slot);
    expect(neuf.plan.groundM).toBe(4);
  });
});
