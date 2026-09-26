import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { listerArbre } from '../../scripts/guards/lib/lister.mjs';
import { findPropById, props } from '../data';
import { setDataset } from '../data/overrides';
import { empriseLocaleM, type PropPrimitive } from '../data/props.types';
import { emptyScene, heightAt, tileAt, sceneMetresPerTile, type Scene, type SceneEntity } from '../state/scene';
import { propFootTiles } from '../state/footprint';
import { parseProject } from '../state/worldMap';
import { fieldHeightAt, massCovers, resolveNappes } from '../gameIso/builders/roofs';
import { SCENARIOS } from './test-scenarios/_registry.generated';

/**
 * AUCUN DÉCOR VOLUMIQUE NE TRAVERSE UNE DALLE NI UN TOIT (#1343). Le corps d'un décor posé au niveau
 * `z` monte depuis le sol de sa case (`heightAt`, le `solM` de `gameIso/builders/props.ts`) jusqu'au
 * `haut` de sa primitive la plus haute (`empriseLocaleM`). Son PLAFOND, case par case de son empreinte :
 * - le sol du premier niveau supérieur dont la case n'est pas `vide` — un volume à double hauteur
 *   (étage `vide` au-dessus) prend le plafond du niveau d'après ;
 * - sinon le point le plus BAS du toit au-dessus de la case : parmi les nappes qui la coiffent à ce
 *   niveau (`resolveNappes`, `massCovers`), le minimum de `fieldHeightAt` sur ses quatre coins ;
 * - sinon rien : une case à ciel ouvert n'a pas de plafond.
 */

const SCENES_DIR = __dirname;
const projets = listerArbre(SCENES_DIR, { filtre: (rel: string) => rel.endsWith('-projet.json') }) as string[];
const scenesDeProjet: Scene[] = projets.flatMap((f) => parseProject(JSON.parse(readFileSync(join(SCENES_DIR, f), 'utf8'))).scenes);
const scenesDeScenario: Scene[] = (SCENARIOS as { scene?: Scene }[]).flatMap((sc) => (sc.scene?.entities ? [sc.scene] : []));
const SCENES: Scene[] = [...scenesDeScenario, ...scenesDeProjet];

function plafondM(scene: Scene, x: number, y: number, z: number): number | undefined {
  const dessus = scene.layers.map((l) => l.z).filter((zz) => zz > z).sort((a, b) => a - b);
  for (const zz of dessus) if (tileAt(scene, x, y, zz) !== 'vide') return heightAt(scene, x, y, zz);
  let toit: number | undefined;
  for (const nappe of resolveNappes(scene).values()) {
    if (!massCovers(nappe.mass, nappe.cells, x, y, z)) continue;
    const coins = [{ x, y }, { x: x + 1, y }, { x, y: y + 1 }, { x: x + 1, y: y + 1 }];
    toit = Math.min(toit ?? Infinity, ...coins.map((v) => fieldHeightAt(nappe.field, v)));
  }
  return toit;
}

/** Les décors volumiques d'une scène qui dépassent le plafond d'une case de leur empreinte. */
function decorsQuiTraversent(scene: Scene): string[] {
  const mpt = sceneMetresPerTile(scene);
  const out: string[] = [];
  for (const e of scene.entities as SceneEntity[]) {
    const prop = e.kind === 'prop' ? findPropById(e.ref) : undefined;
    if (!prop?.volume) continue;
    const z = e.z ?? 0;
    const hautM = Math.max(...prop.volume.primitives.map((p) => empriseLocaleM(p).haut));
    const sommet = heightAt(scene, e.pos.x, e.pos.y, z) + hautM;
    for (const t of propFootTiles(e.ref, e.pos, e.facing, mpt)) {
      const plafond = plafondM(scene, t.x, t.y, z);
      if (plafond !== undefined && sommet > plafond + 1e-6) {
        out.push(`${scene.id} ${e.id} (${e.ref}) z${z} : sommet ${sommet.toFixed(2)} m > plafond ${plafond.toFixed(2)} m en (${t.x},${t.y})`);
        break;
      }
    }
  }
  return out;
}

describe('aucun décor volumique ne traverse une dalle ni un toit (#1343)', () => {
  it('le corpus porte des scènes à étage ET des scènes coiffées de toits', () => {
    expect(SCENES.some((s) => s.layers.length > 1), 'une scène à étage au moins').toBe(true);
    expect(SCENES.some((s) => resolveNappes(s).size > 0), 'une nappe de toiture au moins').toBe(true);
  });

  it('dans toutes les scènes (scénarios de test et projets), chaque corps reste sous le plafond de ses cases', () => {
    const fautes = SCENES.flatMap(decorsQuiTraversent);
    expect(fautes, fautes.join('\n')).toEqual([]);
  });

  it('un corps dont le sommet passe entre le coin bas et le coin haut d\'un pan en pente le traverse', () => {
    const scene = emptyScene(8, 8);
    scene.architecture = [{
      id: 'corps-fixture', label: 'Corps de fixture', style: 'maison', storeys: [], facades: [],
      masses: [{ id: 'nef', z: 0, footprint: [{ x: 1, y: 1, w: 4, h: 4 }], levels: 1, profile: 'gable', ridge: 'x', pitchDeg: 45, material: 'tuile' }],
    }];
    const pos = { x: 2, y: 1 };
    const nappe = [...resolveNappes(scene).values()][0];
    const coins = [pos, { x: pos.x + 1, y: pos.y }, { x: pos.x, y: pos.y + 1 }, { x: pos.x + 1, y: pos.y + 1 }].map((v) => fieldHeightAt(nappe.field, v));
    const [bas, haut] = [Math.min(...coins), Math.max(...coins)];
    const cible = (bas + haut) / 2 - heightAt(scene, pos.x, pos.y, 0);
    const tonneau = findPropById('tonneau')!;
    const bloc: PropPrimitive = { kind: 'box', center: { xM: 0, yM: 0, hM: cible - 0.1 }, size: { xM: 0.6, yM: 0.6, hM: 0.2 }, material: 'bois-chene' };
    const fixture = { ...tonneau, id: '__fixture-sous-pan__', volume: { ...tonneau.volume!, primitives: [bloc] } };
    scene.entities = [{ id: 'decor-sous-pan', kind: 'prop', ref: fixture.id, pos } as SceneEntity];
    const livres = [...props];
    try {
      setDataset('props', [...livres, fixture]);
      expect(haut - bas, 'la case de fixture est sous un pan en pente').toBeGreaterThan(0.5);
      expect(propFootTiles(fixture.id, pos, undefined, sceneMetresPerTile(scene)), 'la fixture tient dans sa case de pose').toEqual([pos]);
      expect(decorsQuiTraversent(scene)).toEqual([expect.stringContaining('decor-sous-pan')]);
    } finally {
      setDataset('props', livres);
    }
  });
});
