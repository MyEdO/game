/**
 * REGISTRE D'ORDRE DE RENDU (#1247) — deux faits, et ils ne se déduisent pas l'un de l'autre :
 *  1. la table est TOTALE et STRICTEMENT ordonnée (aucune famille ex æquo : deux familles au même rang
 *     retomberaient sur le tri par centroïde, qui ne départage pas des objets qui couvrent la carte) ;
 *  2. chaque famille RÉELLEMENT montée par l'écran porte son rang — c'est le câblage, pas la table.
 */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { RENDER_ORDER, RENDER_RANKS, withRenderRank } from './renderRanks';
import { buildHighlightMesh } from './highlightMeshes';
import { buildDynamicMarkMesh, buildSilhouetteTwin } from './dynamicMarkMeshes';
import { buildHaloMesh } from './interactHaloMeshes';
import { buildPrecipMesh, makeWeatherField, type PrecipArea } from './weatherParticles';
import { buildBrumeSheets, retainBrumeSheets } from './weatherSheets';
import { emptyScene, sceneMetresPerTile } from '../../../noyau/monde/scene';
import type { WeatherBrumeDef, WeatherPrecipDef } from '../../../data/ambiance.types';

const AIRE: PrecipArea = { x0: 0, x1: 10, z0: 0, z1: 10, groundM: 0, topM: 9 };
const PLUIE: WeatherPrecipDef = {
  density: 0.3, fallMs: 9, windMs: { x: 1, z: 0 },
  widthM: 0.03, lengthM: 0.4, ceilingM: 9, color: '#aebfd0', opacity: 0.45,
};
const BRUME: WeatherBrumeDef = { color: '#aab4bd', layers: [{ hM: 0.6, alpha: 0.3 }, { hM: 2.2, alpha: 0.2 }] };

describe('renderRanks — la table', () => {
  it('elle est STRICTEMENT croissante dans l’ordre déclaré des familles', () => {
    const ordres = RENDER_RANKS.map((r) => RENDER_ORDER[r]);
    for (let i = 1; i < ordres.length; i++)
      expect(ordres[i], `${RENDER_RANKS[i]} doit passer APRÈS ${RENDER_RANKS[i - 1]}`).toBeGreaterThan(ordres[i - 1]);
  });

  it('elle est TOTALE : aucune famille déclarée sans rang, aucun rang sans famille', () => {
    expect(Object.keys(RENDER_ORDER).sort()).toEqual([...RENDER_RANKS].sort());
  });

  it('le jumeau passe AVANT le monde, et le chrome APRÈS les intempéries', () => {
    expect(RENDER_ORDER.jumeau).toBeLessThan(RENDER_ORDER.monde);
    expect(RENDER_ORDER.monde).toBe(0); // le défaut de three : un objet sans rang tombe avec la matière
    expect(RENDER_ORDER.chrome).toBeGreaterThan(RENDER_ORDER.nappe);
    expect(RENDER_ORDER.nappe).toBeGreaterThan(RENDER_ORDER.pluie);
    expect(RENDER_ORDER.pluie).toBeGreaterThan(RENDER_ORDER.pions);
  });

  it('`withRenderRank` pose le rang et rend l’objet', () => {
    const o = new THREE.Object3D();
    expect(withRenderRank(o, 'nappe')).toBe(o);
    expect(o.renderOrder).toBe(RENDER_ORDER.nappe);
  });
});

describe('renderRanks — les familles MONTÉES portent leur rang', () => {
  it('marques de case : rang `monde` (posées au sol, sous les pions)', () => {
    expect(buildHighlightMesh('walk', 4).renderOrder).toBe(RENDER_ORDER.monde);
  });

  it('marques dynamiques et halos : rang `chrome` (les affordances ne se voilent jamais)', () => {
    expect(buildDynamicMarkMesh('tether', 4).renderOrder).toBe(RENDER_ORDER.chrome);
    expect(buildHaloMesh('haloContour', 4).renderOrder).toBe(RENDER_ORDER.chrome);
  });

  it('jumeau de silhouette : rang `jumeau` (il ne peint que des pixels occlus)', () => {
    expect(buildSilhouetteTwin(buildDynamicMarkMesh('anneau', 4)).renderOrder).toBe(RENDER_ORDER.jumeau);
  });

  it('semis de pluie : rang `pluie` ; nappes de brume : rang `nappe`, au-dessus de lui', () => {
    const semis = buildPrecipMesh(makeWeatherField(PLUIE, AIRE, 's'));
    expect(semis.renderOrder).toBe(RENDER_ORDER.pluie);
    const scene = emptyScene('scene-test', 6, 6);
    const nappes = buildBrumeSheets(retainBrumeSheets(null, scene, sceneMetresPerTile(scene), BRUME).plan, BRUME);
    expect(nappes.length).toBe(2);
    for (const n of nappes) expect(n.renderOrder).toBe(RENDER_ORDER.nappe);
    expect(nappes[0].renderOrder).toBeGreaterThan(semis.renderOrder);
  });
});
