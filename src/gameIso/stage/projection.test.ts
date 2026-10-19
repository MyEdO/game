import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { Vector3 } from 'three';
import {
  poseFromDims,
  screenToTileAtLift,
  screenToWorldAtLift,
  stageKindOf,
  worldToScreen,
  type StagePose,
  type StageWorld,
} from './projection';
import {
  screenToTileAtZ,
  screenToTileF,
  tileCenter,
  type Dims,
  type ProjKind,
  type Rot,
} from '../../geometry/iso';
import { METRES_PER_LEVEL } from '../../noyau/monde/relief';
import { affineCamera, projectToScreen, rotYaw } from '../backends/webgl/cameras';

/**
 * Le module de projection du stage doit RETOMBER sur les deux références qu'il réconcilie : la
 * projection SVG de production (`tileCenter`/`screenToTileF`) à pose crantée, et la caméra volumique
 * (`affineCamera`) au lacet quelconque. Tolérance : celle du flottant, pas un « à peu près ».
 */
const TOL = 1e-6;
const TOL_INV = 1e-9;
const MAP = { w: 29, h: 41 };
const ROTS: Rot[] = [0, 1, 2, 3];
const KINDS: ProjKind[] = ['iso', 'edge', 'top'];

/** Grille d'échantillons : cases entières ET fractionnaires (coins de grille, sous-case), lifts nuls
 *  et non nuls (étages entiers, hauteurs de relief fractionnaires). */
const SAMPLES: StageWorld[] = [];
for (const x of [0, 3.5, 12, 20.25, 28])
  for (const y of [0, 7, 18.5, 30, 40])
    for (const lift of [0, 0.425, 1, 2.3125]) SAMPLES.push({ x, y, lift });

/** Cases ENTIÈRES seules : le picking cranté (`screenToTileAtZ`) arrondit, la confrontation ne vaut
 *  qu'aux points où la vérité attendue est un entier. */
const TILES: StageWorld[] = [];
for (const x of [0, 4, 12, 28]) for (const y of [0, 7, 19, 40]) for (const lift of [0, 1, 2.3125]) TILES.push({ x, y, lift });

function dimsFor(kind: ProjKind, rot: Rot): Dims {
  const base: Dims = { ...MAP, rot };
  if (kind === 'edge') return { ...base, edge: true };
  if (kind === 'top') return { ...base, view: 'top' };
  return base;
}

describe('Pose crantée — la projection du stage EST celle de production', () => {
  it('`stageKindOf`/`poseFromDims` traduisent `Dims` sans perte (vue, lacet, ancrage)', () => {
    expect(KINDS.map((k) => stageKindOf(dimsFor(k, 0)))).toEqual(KINDS);
    for (const rot of ROTS) expect(poseFromDims(dimsFor('iso', rot)).yawDeg).toBe(rotYaw(rot));
    const pose = poseFromDims(dimsFor('iso', 2));
    const { cx, cy } = tileCenter(pose.pivot.x, pose.pivot.y, dimsFor('iso', 2), 0);
    expect(worldToScreen(pose, pose.pivot)).toEqual({ x: cx, y: cy });
  });

  for (const kind of KINDS)
    for (const rot of ROTS) {
      const dims = dimsFor(kind, rot);
      const pose = poseFromDims(dims);

      it(`${kind} rot${rot} : \`worldToScreen\` = \`tileCenter\` à ${TOL} px (x, y, lift)`, () => {
        let worst = 0;
        for (const s of SAMPLES) {
          const attendu = tileCenter(s.x, s.y, dims, s.lift);
          const mesure = worldToScreen(pose, s);
          worst = Math.max(worst, Math.abs(mesure.x - attendu.cx), Math.abs(mesure.y - attendu.cy));
        }
        expect(worst).toBeLessThanOrEqual(TOL);
      });

      it(`${kind} rot${rot} : \`screenToWorldAtLift\` = \`screenToTileF\` à ${TOL} tuile (confrontation directe)`, () => {
        let worst = 0;
        for (const s of SAMPLES) {
          const { cx, cy } = tileCenter(s.x, s.y, dims, s.lift);
          for (const [px, py] of [[cx, cy], [cx + 17.5, cy - 9.25], [cx - 31, cy + 6]] as const) {
            const attendu = screenToTileF(px, py, dims, s.lift);
            const mesure = screenToWorldAtLift(pose, { x: px, y: py }, s.lift);
            worst = Math.max(worst, Math.abs(mesure.x - attendu.x), Math.abs(mesure.y - attendu.y));
          }
        }
        expect(worst).toBeLessThanOrEqual(TOL);
      });

      it(`${kind} rot${rot} : arrondi, l'inverse rend la case de \`screenToTileAtZ\` (aller-retour)`, () => {
        for (const s of TILES) {
          const { cx, cy } = tileCenter(s.x, s.y, dims, s.lift);
          const mesure = screenToWorldAtLift(pose, { x: cx, y: cy }, s.lift);
          // `+ 0` : `Math.round(-1e-15)` rend `-0`, que `toEqual` distingue de `0` (artefact de
          // signe du flottant, pas un écart de case).
          const case_ = { x: Math.round(mesure.x) + 0, y: Math.round(mesure.y) + 0 };
          expect(case_).toEqual(screenToTileAtZ(cx, cy, dims, s.lift));
          expect(case_).toEqual({ x: s.x, y: s.y });
        }
      });
    }
});

/** Point monde three (Y = haut) d'un point de grille : le lift est en NIVEAUX, `METRES_PER_LEVEL` m chacun. */
const worldOf = (s: StageWorld, mpt: number) => new Vector3(s.x * mpt, (s.lift ?? 0) * METRES_PER_LEVEL, s.y * mpt);

const VIEWPORT = { w: 1600, h: 1000 };
const PIVOT = { x: (MAP.w - 1) / 2, y: (MAP.h - 1) / 2 };

/** Pose ANCRÉE SUR LA CAMÉRA : le pont que ce module apporte en production — l'ancrage écran
 *  (`origin`) se lit en projetant le pivot avec la caméra, le reste doit suivre tout seul. */
function poseOnCamera(kind: ProjKind, yawDeg: number, mpt: number): { pose: StagePose; project: (s: StageWorld) => { sx: number; sy: number } } {
  const { camera } = affineCamera(kind, yawDeg, mpt, VIEWPORT);
  const project = (s: StageWorld) => projectToScreen(camera, worldOf(s, mpt), VIEWPORT);
  const ancre = project({ ...PIVOT, lift: 0 });
  return { pose: { kind, yawDeg, pivot: PIVOT, origin: { x: ancre.sx, y: ancre.sy } }, project };
}

describe('Lacet RÉEL — la projection du stage EST la caméra volumique', () => {
  const YAWS = [...ROTS.map(rotYaw), 45, 137, -22.5, 312.75];

  for (const kind of KINDS)
    for (const mpt of [1.5, 2.75])
      it(`${kind} (mpt=${mpt}) : \`worldToScreen\` = \`affineCamera\`+\`projectToScreen\` à ${TOL} px, crans ET lacets libres`, () => {
        let worst = 0;
        for (const yawDeg of YAWS) {
          const { pose, project } = poseOnCamera(kind, yawDeg, mpt);
          for (const s of SAMPLES) {
            const gl = project(s);
            const mesure = worldToScreen(pose, s);
            worst = Math.max(worst, Math.abs(mesure.x - gl.sx), Math.abs(mesure.y - gl.sy));
          }
        }
        expect(worst).toBeLessThanOrEqual(TOL);
      });

  it('la coïncidence n’est pas triviale : les échantillons couvrent des centaines de pixels d’étendue', () => {
    const { project } = poseOnCamera('iso', 137, 2);
    const xs = SAMPLES.map((s) => project(s).sx);
    const ys = SAMPLES.map((s) => project(s).sy);
    expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(500);
    expect(Math.max(...ys) - Math.min(...ys)).toBeGreaterThan(500);
  });
});

describe('Involution — l’inverse est exact au lacet libre', () => {
  for (const kind of KINDS)
    it(`${kind} : \`screenToWorldAtLift(worldToScreen(w))\` = w à ${TOL_INV} tuile`, () => {
      let worst = 0;
      for (const yawDeg of [0, 45, 137, -22.5, 312.75]) {
        const pose: StagePose = { kind, yawDeg, pivot: PIVOT, origin: { x: 640, y: 360 } };
        for (const s of SAMPLES) {
          const retour = screenToWorldAtLift(pose, worldToScreen(pose, s), s.lift);
          worst = Math.max(worst, Math.abs(retour.x - s.x), Math.abs(retour.y - s.y));
        }
      }
      expect(worst).toBeLessThanOrEqual(TOL_INV);
    });
});

describe('VUE DU DESSUS — l’élévation ne se lit pas à l’écran', () => {
  const PIX = { x: 811, y: 437 };
  const LIFTS = [0, 1, 2, 3.5];

  it('en `top`, tous les lifts rendent la MÊME case — le picking multi-hypothèses doit y résoudre l’étage AUTREMENT', () => {
    // Projection verticale : deux étages superposés tombent sur le même pixel. `screenToWorldAtLift` est
    // exact (il rend la colonne), mais il ne DÉPARTAGE pas les étages — un appelant qui itère les lifts
    // en vue du dessus obtient N fois la même case, et doit trancher sur la couche active/l'occupation.
    const pose = poseFromDims(dimsFor('top', 1));
    const cases = LIFTS.map((l) => screenToWorldAtLift(pose, PIX, l));
    for (const c of cases) expect(c).toEqual(cases[0]);
  });

  it('en `iso`/`edge`, les mêmes lifts rendent des cases DISTINCTES (la dégénérescence est propre à `top`)', () => {
    for (const kind of ['iso', 'edge'] as const) {
      const pose = poseFromDims(dimsFor(kind, 1));
      const cases = LIFTS.map((l) => screenToWorldAtLift(pose, PIX, l));
      const distinctes = new Set(cases.map((c) => `${c.x.toFixed(6)},${c.y.toFixed(6)}`));
      expect(distinctes.size).toBe(LIFTS.length);
    }
  });
});

describe('PURETÉ — le module de projection ne tire jamais le moteur volumique', () => {
  const SRC = readFileSync(new URL('./projection.ts', import.meta.url), 'utf8');

  it('`projection.ts` n’importe ni `three` ni le DOM', () => {
    // Angle mort ASSUMÉ : lecture TEXTUELLE du source, pas du graphe de modules — un import
    // transitif de `three` par `geometry/iso.ts` passerait sous ce radar (ce module n'importe que lui).
    expect(SRC).not.toMatch(/from\s+['"]three/);
    expect(SRC).not.toMatch(/\brequire\(\s*['"]three/);
    expect(SRC).toMatch(/from\s+'\.\.\/\.\.\/geometry\/iso'/);
    expect(SRC.match(/^import\s/gm)?.length).toBe(1);
  });
});

/**
 * BALAYAGE DE L'ÉCRAN ENTIER, AUX QUATRE CRANS ET DANS LES TROIS VUES — la portée EXACTE de la réserve
 * écrite au JSDoc de `screenToTileAtLift` : son arrondi tombe APRÈS la dé-rotation, celui de la
 * production (`screenToTileAtZ`) AVANT, et les deux ne peuvent nommer deux cases voisines que là où la
 * coordonnée continue vaut un demi — sur la frontière EXACTE de deux cases, où il n'y a rien à
 * départager. Le cran de rotation est le SEUL axe où ces deux ordres d'arrondi divergent : la garde de
 * picking (`pick-parity.test.tsx`) travaille à `rot: 0`, où l'écart est nul ; ce balayage vise les
 * crans 1 à 3, où il ne l'est pas. Toute divergence AILLEURS qu'au demi est une vraie régression.
 */
describe('Balayage écran — les deux arrondis ne se séparent QUE sur la frontière de deux cases', () => {
  const CARTE = { w: 12, h: 9 };
  /** Pas du balayage, en pixels entiers. Premier avec les pas de grille (32/16 px en losange, 56 en
   *  vue du dessus) : toutes les phases sont visitées, frontières comprises (compteur `frontieres`). */
  const PAS = 3;
  const MARGE = 48; // le balayage déborde la carte : hors-grille aussi, les deux chaînes doivent s'accorder

  function dimsSweep(kind: ProjKind, rot: Rot): Dims {
    const base: Dims = { ...CARTE, rot };
    if (kind === 'edge') return { ...base, edge: true };
    if (kind === 'top') return { ...base, view: 'top' };
    return base;
  }

  it('crans 0-3 × iso/edge/top : toute divergence de case est exactement sur le demi', () => {
    const hors: string[] = [];
    let points = 0;
    let divergences = 0;
    let frontieres = 0;
    for (const kind of KINDS)
      for (const rot of ROTS) {
        const dims = dimsSweep(kind, rot);
        const pose = poseFromDims(dims);
        const coins = [[0, 0], [CARTE.w - 1, 0], [0, CARTE.h - 1], [CARTE.w - 1, CARTE.h - 1]]
          .map(([x, y]) => worldToScreen(pose, { x, y }));
        const x0 = Math.floor(Math.min(...coins.map((c) => c.x))) - MARGE;
        const x1 = Math.ceil(Math.max(...coins.map((c) => c.x))) + MARGE;
        const y0 = Math.floor(Math.min(...coins.map((c) => c.y))) - MARGE;
        const y1 = Math.ceil(Math.max(...coins.map((c) => c.y))) + MARGE;
        for (let px = x0; px <= x1; px += PAS)
          for (let py = y0; py <= y1; py += PAS) {
            const a = screenToTileAtLift(pose, { x: px, y: py }, 0);
            const b = screenToTileAtZ(px, py, dims, 0);
            const w = screenToWorldAtLift(pose, { x: px, y: py }, 0);
            const auDemi = Math.min(
              Math.abs(w.x - Math.floor(w.x) - 0.5),
              Math.abs(w.y - Math.floor(w.y) - 0.5),
            ) === 0;
            points++;
            if (auDemi) frontieres++;
            if (a.x !== b.x || a.y !== b.y) {
              divergences++;
              if (!auDemi) hors.push(`${kind} rot${rot} (${px},${py}) stage=${a.x},${a.y} production=${b.x},${b.y} continu=${w.x.toFixed(4)},${w.y.toFixed(4)}`);
            }
          }
      }
    expect(hors.slice(0, 6)).toEqual([]);
    expect(points).toBeGreaterThan(100_000); // le balayage couvre vraiment les 12 configurations
    expect(frontieres).toBeGreaterThan(0); // …et il VISITE des frontières : la tolérance n'est pas vide
    expect(divergences).toBeLessThanOrEqual(frontieres); // aucune divergence hors des frontières visitées
  });
});
