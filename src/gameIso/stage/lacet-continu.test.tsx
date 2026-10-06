import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { Vector3 } from 'three';
import { CursorOverlay } from './MoveOverlays';
import { AreteOverlay } from './AreteOverlay';
import { projeterAretes } from './aretesProjetees';
import { aretesUtilisables } from '../../state/aretes';
import { emptyScene, type Scene } from '../../state/scene';
import { cloisons, piece } from '../../state/pieces.fixture';
import { poseFromDims, screenToTileAtLift, worldToScreen } from './projection';
import { LEVEL_H, screenToTileAtZ, tileCenter, type Dims, type Rot } from '../../geometry/iso';
import { affineCamera, projectToScreen } from '../backends/webgl/cameras';
import { yawStep, yawTarget } from '../../state/stageYaw';
import { chebyshev } from '../../engine/grid';

/**
 * LACET CONTINU du stage (#1176, P2-7). Ce qui se mesure ici n'est pas la projection nue (c'est
 * `projection.test.ts`) mais LES OVERLAYS RÉELS : la surbrillance de case et la porte, rendus par leurs
 * composants de production, à un lacet qui n'est PAS un cran. Leurs sommets doivent tomber au pixel de
 * `worldToScreen` — et donc de la caméra volumique, à qui la même garde les confronte.
 *
 * Trois faits distincts, chacun réfutable seul :
 *  1. au CRAN, le lacet libre et la voie crantée rendent le MÊME pixel (rien n'a bougé sous l'affine) ;
 *  2. entre deux crans, les overlays suivent la caméra three ;
 *  3. le pixel où un overlay DESSINE une case est celui où le picking la RETROUVE (clic juste à 45°).
 */
const TOL = 1e-6;
const CARTE = { w: 13, h: 9 };
const ROTS: Rot[] = [0, 1, 2, 3];
const MPT = 2;
const VIEWPORT = { w: 1600, h: 1000 };

const dimsCran = (rot: Rot, edge = false): Dims => ({ ...CARTE, rot, view: 'iso', ...(edge ? { edge: true } : {}) });
const dimsLibre = (yawDeg: number): Dims => ({ ...CARTE, rot: 0, view: 'iso', yawDeg });

/** Sommets du losange d'une surbrillance de case, LUS DU RENDU du composant de production. */
function sommetsSurbrillance(tile: { x: number; y: number }, dims: Dims): { x: number; y: number }[] {
  const html = renderToStaticMarkup(<CursorOverlay tile={tile} footN={1} dims={dims} liftAt={() => 0} />);
  const d = html.match(/ d="([^"]+)"/)?.[1];
  if (!d) throw new Error('surbrillance sans chemin');
  return d.replace(/[MLZ]/g, ' ').trim().split(/\s+/)
    .map((p) => p.split(','))
    .map(([x, y]) => ({ x: Number(x), y: Number(y) }));
}

/** Deux pièces d'une case, (4,3) et (5,3), et la porte FERMÉE de leur arête (4,3,E) : le seul accès
 *  de la première, murée ailleurs. */
function scèneÀUnePorte(dims: Dims): Scene {
  const s = emptyScene(dims.w, dims.h);
  s.effectZones = [piece('room-a', 4, 3), piece('room-b', 5, 3)];
  s.walls = [...cloisons(4, 3, ['N', 'S', 'O']), { x: 4, y: 3, side: 'E', door: true, closed: true }];
  return s;
}

/** Les deux bouts de la CIBLE de clic d'une porte, LUS DU RENDU de `AreteOverlay`. */
function boutsDePorte(dims: Dims): { x: number; y: number }[] {
  const html = renderToStaticMarkup(
    <AreteOverlay
      aretes={projeterAretes(
        aretesUtilisables({ scene: scèneÀUnePorte(dims), visible: new Set(['4,3,0']), controleur: { x: 4, y: 3, z: 0 }, activeZ: 0 }),
        dims,
        () => 0,
      )}
      areteSurvolee={null}
      activerArete={() => {}}
      onFocusArete={() => {}}
      onBlurArete={() => {}}
    />,
  );
  const cible = html.match(/<line data-arete-cible="porte"[^>]*>/)?.[0];
  if (!cible) throw new Error('porte sans cible de clic');
  const at = (n: string) => Number(cible.match(new RegExp(`${n}="([^"]+)"`))?.[1]);
  return [{ x: at('x1'), y: at('y1') }, { x: at('x2'), y: at('y2') }];
}

/** Coins de grille d'une case, dans l'ordre que rend `diamondCorners` (top, right, bot, left). */
const COINS: [number, number][] = [[-0.5, -0.5], [0.5, -0.5], [0.5, 0.5], [-0.5, 0.5]];

const ecart = (a: { x: number; y: number }[], b: { x: number; y: number }[]): number =>
  Math.max(...a.map((p, i) => chebyshev(p, b[i])));

describe('Au CRAN, le lacet libre EST la projection crantée', () => {
  it('`tileCenter` rend le pixel du cran, case par case, aux quatre quarts de tour', () => {
    let pire = 0;
    for (const rot of ROTS)
      for (let x = 0; x < CARTE.w; x++)
        for (let y = 0; y < CARTE.h; y++)
          for (const z of [0, 1.5]) {
            const cran = tileCenter(x, y, dimsCran(rot), z);
            const libre = tileCenter(x, y, dimsLibre(rot * 90), z);
            pire = Math.max(pire, Math.abs(cran.cx - libre.cx), Math.abs(cran.cy - libre.cy));
          }
    expect(pire).toBeLessThanOrEqual(TOL);
  });

  it("l'edge-on N'EST PAS une seconde famille : c'est le losange à +45° (à l'ancrage près)", () => {
    // `edge(d) = iso(R(45°)·d)` : on compare des ÉCARTS entre cases, seule façon de neutraliser les
    // deux ancrages (`originX` vaut EDGE_W en axis-aligné, une demi-diagonale en losange).
    const ref = { x: 6, y: 4 };
    let pire = 0;
    for (const rot of ROTS) {
      const cranE = dimsCran(rot, true);
      const libre = dimsLibre(rot * 90 + 45);
      const o1 = tileCenter(ref.x, ref.y, cranE);
      const o2 = tileCenter(ref.x, ref.y, libre);
      for (let x = 0; x < CARTE.w; x++)
        for (let y = 0; y < CARTE.h; y++) {
          const a = tileCenter(x, y, cranE);
          const b = tileCenter(x, y, libre);
          pire = Math.max(pire, Math.abs((a.cx - o1.cx) - (b.cx - o2.cx)), Math.abs((a.cy - o1.cy) - (b.cy - o2.cy)));
        }
    }
    expect(pire).toBeLessThanOrEqual(TOL);
  });

  it('un `Dims` SANS lacet ne connaît aucun régime continu (la voie affine est intacte)', () => {
    expect(dimsCran(2).yawDeg).toBeUndefined();
    expect(poseFromDims(dimsCran(2))).toEqual(poseFromDims({ ...CARTE, rot: 2, view: 'iso' }));
  });
});

describe('Entre deux crans, les OVERLAYS RÉELS suivent la projection du stage', () => {
  const LACETS = [45, 22.5, 137, -68.25, 312.75];

  it('la surbrillance de case : ses 4 sommets sont les COINS DE GRILLE projetés', () => {
    let pire = 0;
    for (const yawDeg of LACETS) {
      const dims = dimsLibre(yawDeg);
      const pose = poseFromDims(dims);
      for (const tile of [{ x: 0, y: 0 }, { x: 6, y: 4 }, { x: 12, y: 8 }]) {
        const attendu = COINS.map(([dx, dy]) => worldToScreen(pose, { x: tile.x + dx, y: tile.y + dy }));
        pire = Math.max(pire, ecart(sommetsSurbrillance(tile, dims), attendu));
      }
    }
    expect(pire).toBeLessThanOrEqual(TOL);
  });

  it('la PORTE : sa cible de clic tient l’arête de grille, projetée', () => {
    let pire = 0;
    for (const yawDeg of LACETS) {
      const dims = dimsLibre(yawDeg);
      const pose = poseFromDims(dims);
      // Arête E de (4,3) = le segment des coins de grille (5,3)→(5,4), soit `tileCenter(±0.5)`.
      const attendu = [{ x: 4.5, y: 2.5 }, { x: 4.5, y: 3.5 }].map((p) => worldToScreen(pose, p));
      pire = Math.max(pire, ecart(boutsDePorte(dims), attendu));
    }
    expect(pire).toBeLessThanOrEqual(TOL);
  });

  it('…et la projection qu’ils suivent EST la caméra three (mêmes sommets, à ancrage commun)', () => {
    const pivot = { x: (CARTE.w - 1) / 2, y: (CARTE.h - 1) / 2 };
    let pire = 0;
    let etendue = 0;
    for (const yawDeg of LACETS) {
      const { camera } = affineCamera('iso', yawDeg, MPT, VIEWPORT);
      const gl = (p: { x: number; y: number }) => projectToScreen(camera, new Vector3(p.x * MPT, 0, p.y * MPT), VIEWPORT);
      const ancre = gl(pivot);
      const dims = dimsLibre(yawDeg);
      const decal = worldToScreen(poseFromDims(dims), pivot); // l'ancrage SVG, que la caméra ne partage pas
      for (const tile of [{ x: 1, y: 1 }, { x: 6, y: 4 }, { x: 11, y: 7 }]) {
        const svg = sommetsSurbrillance(tile, dims);
        const coins = COINS.map(([dx, dy]) => ({ x: tile.x + dx, y: tile.y + dy }));
        coins.forEach((c, i) => {
          const p = gl(c);
          pire = Math.max(pire, Math.abs(svg[i].x - decal.x + ancre.sx - p.sx), Math.abs(svg[i].y - decal.y + ancre.sy - p.sy));
          etendue = Math.max(etendue, Math.abs(p.sx - ancre.sx), Math.abs(p.sy - ancre.sy));
        });
      }
    }
    expect(pire).toBeLessThanOrEqual(TOL);
    expect(etendue).toBeGreaterThan(200); // la coïncidence n'est pas triviale : des centaines de pixels d'écart au pivot
  });

  it('le lacet libre DÉPLACE vraiment les sommets (la garde ne mesure pas une projection figée)', () => {
    const a = sommetsSurbrillance({ x: 12, y: 8 }, dimsLibre(0));
    const b = sommetsSurbrillance({ x: 12, y: 8 }, dimsLibre(45));
    expect(ecart(a, b)).toBeGreaterThan(50);
  });
});

describe('Le pixel qui DESSINE une case est celui qui la RETROUVE (clic juste au lacet libre)', () => {
  it('production (`screenToTileAtZ`) et stage (`screenToTileAtLift`) rendent la case dessinée', () => {
    for (const yawDeg of [45, 22.5, 137, -68.25]) {
      const dims = dimsLibre(yawDeg);
      const pose = poseFromDims(dims);
      for (let x = 0; x < CARTE.w; x++)
        for (let y = 0; y < CARTE.h; y++)
          for (const lift of [0, 1]) {
            const { cx, cy } = tileCenter(x, y, dims, lift);
            // `+ 0` : `Math.round(-1e-15)` rend `-0`, que `toEqual` distingue de `0` — artefact de
            // signe du flottant, pas un écart de case (même réserve que `projection.test.ts`).
            const zero = (c: { x: number; y: number }) => ({ x: c.x + 0, y: c.y + 0 });
            expect(zero(screenToTileAtZ(cx, cy, dims, lift))).toEqual({ x, y });
            expect(zero(screenToTileAtLift(pose, { x: cx, y: cy }, lift))).toEqual({ x, y });
          }
    }
  });
});

describe('APPROCHE du lacet — la caméra COURT vers sa cible, elle n’y saute pas', () => {
  it('un pas rapproche sans dépasser, et la durée ne dépend pas de la cadence de frame', () => {
    const un = yawStep(0, 45, 16);
    expect(un).toBeGreaterThan(0);
    expect(un).toBeLessThan(45);
    // 10 frames de 16 ms ≡ 1 frame de 160 ms : l'approche exponentielle est indépendante de la cadence.
    let cumul = 0;
    for (let i = 0; i < 10; i++) cumul = yawStep(cumul, 45, 16);
    expect(Math.abs(cumul - yawStep(0, 45, 160))).toBeLessThan(1e-9);
  });

  it('l’AVANCE est bornée : maintenir la touche fait tourner, jamais empiler un demi-tour', () => {
    let cible = 0;
    for (let i = 0; i < 12; i++) cible = yawTarget(0, cible, 45); // 12 répétitions clavier d'affilée
    expect(cible).toBe(90);
    expect(yawTarget(0, 0, -45)).toBe(-45);
  });
});

describe('VUE DU DESSUS — le plan tactique garde ses crans', () => {
  it('un lacet posé sur une carte `top` ne change RIEN à sa projection', () => {
    const plan: Dims = { ...CARTE, rot: 1, view: 'top' };
    const avec: Dims = { ...plan, yawDeg: 37 };
    for (const [x, y] of [[0, 0], [6, 4], [12, 8]])
      expect(tileCenter(x, y, avec)).toEqual(tileCenter(x, y, plan));
  });
});

describe('ÉLÉVATION — le lacet libre soulève comme le cran', () => {
  it('un niveau vaut le même décalage vertical qu’au cran (et rien à l’horizontale)', () => {
    const dims = dimsLibre(45);
    const sol = tileCenter(6, 4, dims, 0);
    const haut = tileCenter(6, 4, dims, 1);
    expect(haut.cx).toBeCloseTo(sol.cx, 9);
    expect(sol.cy - haut.cy).toBeCloseTo(LEVEL_H, 9);
  });
});
