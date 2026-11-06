/**
 * #1186 — LE RACCORD DE NAPPES (`walls.ts`) lit la hauteur du champ de nappe du noyau (`resolveNappes`,
 * `noyau/monde/volume/toits.ts`) : une seule vérité de hauteur de toit.
 */
import { describe, it, expect } from 'vitest';
import { buildWalls } from './walls';
import { fieldHeightAt, nappeKey, resolveNappes } from '../../noyau/monde/volume/toits';
import { WALL_H_M } from '../../noyau/monde/iso';
import { emptyScene, type Scene } from '../../noyau/monde/scene';
import { perimeterWallSegs } from '../../noyau/sceneEdit.testkit';
import { diligenceCampaign, paquetDuJeu } from '../../scenes/campaign';

const AILE_E = { x: 12, y: 4, w: 8, h: 8 };
const nappeOf = (scene: Scene, massId: string) => resolveNappes(scene).get(nappeKey('corps', massId))!;

/** Pose la cote métrique `metres` sur les cases `cells` de la couche `z`. */
function coter(scene: Scene, z: number, metres: number, cells: readonly { x: number; y: number }[]): void {
  const layer = scene.layers.find((l) => l.z === z)!;
  const { w, h } = scene.dimensions;
  const height = layer.height ?? new Array<number>(w * h).fill(0);
  for (const c of cells) height[c.y * w + c.x] = metres;
  layer.height = height;
}

describe('raccords de nappes', () => {
  it('le RACCORD de nappes (`walls.ts`) lit la MÊME hauteur que les pans — une seule vérité', () => {
    // Un BLOC sur terrasse (autre égout, donc autre nappe) vient buter contre le BOUT de faîtage du
    // corps central. Là, le versant du groupe arrive à PLEINE hauteur (extrémité fermée) : le quad de
    // raccord doit relier CETTE cote, jamais la retombée qu'aurait la masse lue seule sur ses cases.
    const CENTRE_C = { x: 8, y: 4, w: 4, h: 8 };
    const BLOC = { x: 8, y: 0, w: 4, h: 4 };
    const scene = emptyScene('scene-test', 24, 20);
    scene.walls = perimeterWallSegs([CENTRE_C, AILE_E, BLOC]);
    scene.architecture = [{
      id: 'corps', style: 'maison', storeys: [], facades: [],
      masses: [
        { id: 'aile-e', z: 0, footprint: [AILE_E], levels: 1, profile: 'gable', ridge: 'x', pitchDeg: 45, material: 'tuile' },
        { id: 'centre', z: 0, footprint: [CENTRE_C], levels: 1, profile: 'gable', ridge: 'y', pitchDeg: 45, material: 'tuile' },
        { id: 'bloc', z: 0, footprint: [BLOC], levels: 1, profile: 'hip', pitchDeg: 45, material: 'tuile' },
      ],
    }];
    coter(scene, 0, WALL_H_M, [...Array(BLOC.w * BLOC.h)].map((_, i) => ({
      x: BLOC.x + (i % BLOC.w), y: BLOC.y + Math.floor(i / BLOC.w),
    })));
    const centre = nappeOf(scene, 'centre').field;
    const bloc = nappeOf(scene, 'bloc').field;
    expect(nappeOf(scene, 'centre').groupId).not.toBe(nappeOf(scene, 'bloc').groupId);
    const seams = buildWalls(scene, 'jeu').filter((el) => el.key.includes('centre') && el.key.includes('bloc'));
    expect(seams.length).toBeGreaterThan(0);
    let mesures = 0;
    let auDessusEgout = 0;
    for (const el of seams) {
      for (const p of el.faces[0].poly) {
        const v = { x: p.x + 0.5, y: p.y + 0.5 };
        const attendues = [fieldHeightAt(centre, v), fieldHeightAt(bloc, v)];
        expect(attendues.some((h) => Math.abs(h - p.h) < 1e-9)).toBe(true); // aucune cote inventée
        mesures++;
        if (Math.abs(p.h - fieldHeightAt(centre, v)) < 1e-9 && p.h > centre.shape.eaveHeightM + 1e-9) auDessusEgout++;
      }
    }
    expect(mesures).toBeGreaterThan(0);
    expect(auDessusEgout).toBeGreaterThan(0); // le raccord monte jusqu'au versant, pas jusqu'à l'égout
  });

  it('La Diligence : ses nappes d’étage continues au joint, aucun mur de raccord n’a de marche à combler', () => {
    const scene = paquetDuJeu(diligenceCampaign).scenes[0];
    expect(buildWalls(scene, 'jeu').filter((el) => el.key.startsWith('seam:') && el.cell.z === 1)).toEqual([]);
  });
});
