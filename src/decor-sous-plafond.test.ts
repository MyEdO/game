import { idsDeTest } from './engine/idsDeTest.testkit';
import { describe, it, expect } from 'vitest';
import { findPropById, props } from './data';
import { setDataset } from './data/overrides';
import type { PropPrimitive } from './data/props.types';
import { emptyScene, heightAt, sceneMetresPerTile, type Scene, type SceneEntity } from './noyau/monde/scene';
import { propFootTiles } from './noyau/monde/footprint';
import { parseProject } from './noyau/worldMap';
import { fieldHeightAt, resolveNappes } from './noyau/monde/volume/toits';
import { SCENARIOS } from './scenes/test-scenarios/_registry.generated';
import paquetDeTest from './scenes/fixtures/paquet-de-test.json';
import { decorsQuiTraversent } from './noyau/monde/decorSousPlafond.testkit';


/** Les scènes du commun : les scénarios de test et le paquet de test ; un projet joue les siennes dans sa suite. */
const SCENES: Scene[] = [...SCENARIOS.map((sc) => sc.construire(idsDeTest).scene), ...parseProject(paquetDeTest).scenes];

describe('aucun décor volumique ne traverse une dalle ni un toit (#1343)', () => {
  it('le corpus porte des scènes à étage ET des scènes coiffées de toits', () => {
    expect(SCENES.some((s) => s.layers.length > 1), 'une scène à étage au moins').toBe(true);
    expect(SCENES.some((s) => resolveNappes(s).size > 0), 'une nappe de toiture au moins').toBe(true);
  });

  it('dans toutes les scènes (scénarios de test et paquet de test), chaque corps reste sous le plafond de ses cases', () => {
    const fautes = SCENES.flatMap(decorsQuiTraversent);
    expect(fautes, fautes.join('\n')).toEqual([]);
  });

  it('un corps dont le sommet passe entre le coin bas et le coin haut d\'un pan en pente le traverse', () => {
    const scene = emptyScene('scene-test', 8, 8);
    scene.architecture = [{
      id: 'corps-fixture', label: 'Corps de fixture', style: { id: 'maison' }, storeys: [], facades: [],
      masses: [{ id: 'nef', z: 0, footprint: [{ x: 1, y: 1, w: 4, h: 4 }], levels: 1, profile: 'gable', ridge: 'x', pitchDeg: 45, material: { id: 'tuile' } }],
    }];
    const pos = { x: 2, y: 1 };
    const nappe = [...resolveNappes(scene).values()][0];
    const coins = [pos, { x: pos.x + 1, y: pos.y }, { x: pos.x, y: pos.y + 1 }, { x: pos.x + 1, y: pos.y + 1 }].map((v) => fieldHeightAt(nappe.field, v));
    const [bas, haut] = [Math.min(...coins), Math.max(...coins)];
    const cible = (bas + haut) / 2 - heightAt(scene, pos.x, pos.y, 0);
    const tonneau = findPropById('tonneau')!;
    const bloc: PropPrimitive = { kind: 'box', center: { xM: 0, yM: 0, hM: cible - 0.1 }, size: { xM: 0.6, yM: 0.6, hM: 0.2 }, material: 'bois-chene' };
    const fixture = { ...tonneau, id: '__fixture-sous-pan__', volume: { ...tonneau.volume!, primitives: [bloc] } };
    const posee: Scene = { ...scene, entities: [{ id: 'decor-sous-pan', kind: 'prop', decor: { id: fixture.id }, pos } as SceneEntity] };
    const livres = [...props];
    try {
      setDataset('props', [...livres, fixture]);
      expect(haut - bas, 'la case de fixture est sous un pan en pente').toBeGreaterThan(0.5);
      expect(propFootTiles(fixture.id, pos, undefined, sceneMetresPerTile(posee)), 'la fixture tient dans sa case de pose').toEqual([pos]);
      expect(decorsQuiTraversent(posee)).toEqual([expect.stringContaining('decor-sous-pan')]);
    } finally {
      setDataset('props', livres);
    }
  });
});
