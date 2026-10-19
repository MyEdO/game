import { describe, it, expect } from 'vitest';
import {
  makeCamera,
  project,
  clipNear,
  tileCornersWorld,
  povView,
  tint,
  fogAt,
  fogCurveOf,
  farTilesOf,
  povDepth,
  mixHex,
  EYE_H,
  NEAR,
  VW,
  VH,
  AMBIENT_FLOOR,
  FOG_COLOR,
  type CamPose,
  type Vec3,
} from './camera';
import { WALL_H_M } from '../iso';
import { METRES_PER_LEVEL } from '../../noyau/monde/relief';
import { emptyScene, type Scene } from '../../noyau/monde/scene';
import { type Dir8 } from '../rig/facing';

// — Fabrique de caméra de test : scène plate (herbe, height 0), groupe au centre regardant Nord.
function flatScene(): Scene {
  const s = emptyScene(20, 20);
  s.layers = [{ z: 0, tiles: new Array(20 * 20).fill('sol') }]; // marchable, height absent = 0
  return s;
}
function camN(): CamPose {
  return makeCamera(flatScene(), { x: 10, y: 10 }, 'N');
}

describe('WALL_H_M', () => {
  it('UNIFIÉ : un mur = un étage → WALL_H_M = METRES_PER_LEVEL = 4 m', () => {
    expect(WALL_H_M).toBeCloseTo(METRES_PER_LEVEL, 6);
  });
});

describe('makeCamera', () => {
  it('cap N → fwd (0,-1), right (1,0)=est ; eye = surface + EYE_H', () => {
    const cam = camN();
    expect(cam.fwd.x).toBeCloseTo(0, 6);
    expect(cam.fwd.y).toBeCloseTo(-1, 6);
    expect(cam.right.x).toBeCloseTo(1, 6);
    expect(cam.right.y).toBeCloseTo(0, 6);
    expect(cam.eye.z).toBeCloseTo(EYE_H, 6); // height 0 + EYE_H
    expect(cam.mpt).toBe(2);
    expect(cam.z).toBe(0);
  });
  it('diagonale NE → fwd normalisé (1/√2, -1/√2)', () => {
    const cam = makeCamera(flatScene(), { x: 10, y: 10 }, 'NE');
    expect(cam.fwd.x).toBeCloseTo(Math.SQRT1_2, 6);
    expect(cam.fwd.y).toBeCloseTo(-Math.SQRT1_2, 6);
    expect(Math.hypot(cam.fwd.x, cam.fwd.y)).toBeCloseTo(1, 6);
  });
  it('right = (-fwd.y, fwd.x) pour les 8 caps', () => {
    const dirs: Dir8[] = ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'];
    for (const d of dirs) {
      const cam = makeCamera(flatScene(), { x: 10, y: 10 }, d);
      expect(cam.right.x).toBeCloseTo(-cam.fwd.y, 6);
      expect(cam.right.y).toBeCloseTo(cam.fwd.x, 6);
    }
  });
});

describe('project', () => {
  it('point droit devant à hauteur des yeux → horizon (VW/2, VH/2)', () => {
    const cam = camN(); // eye à z=EYE_H, regarde Nord (y décroissant)
    // 5 m devant (nord) à la même hauteur d'œil.
    const P: Vec3 = { x: cam.eye.x, y: cam.eye.y - 5, z: cam.eye.z };
    const r = project(cam, P);
    expect(r.behind).toBe(false);
    expect(r.sx).toBeCloseTo(VW / 2, 4);
    expect(r.sy).toBeCloseTo(VH / 2, 4);
    expect(r.depth).toBeCloseTo(5, 6);
  });
  it('point de SOL devant (plus bas) → sy > VH/2 (sous l’horizon)', () => {
    const cam = camN();
    const P: Vec3 = { x: cam.eye.x, y: cam.eye.y - 5, z: 0 }; // sol
    const r = project(cam, P);
    expect(r.sy).toBeGreaterThan(VH / 2);
  });
  it('horizon INVARIANT à la distance (à hauteur d’œil, sy reste VH/2)', () => {
    const cam = camN();
    for (const dist of [2, 6, 12]) {
      const r = project(cam, { x: cam.eye.x, y: cam.eye.y - dist, z: cam.eye.z });
      expect(r.sy).toBeCloseTo(VH / 2, 4);
    }
  });
  it('symétrie gauche/droite : miroir de Xc ⇒ sx miroir autour de VW/2', () => {
    const cam = camN();
    const rR = project(cam, { x: cam.eye.x + 1, y: cam.eye.y - 5, z: cam.eye.z }); // à droite (est)
    const rL = project(cam, { x: cam.eye.x - 1, y: cam.eye.y - 5, z: cam.eye.z }); // à gauche
    expect(rR.sx - VW / 2).toBeCloseTo(-(rL.sx - VW / 2), 4);
  });
  it('hauteur des yeux : lever EYE_H abaisse le sy d’un point de sol', () => {
    const scene = flatScene();
    const cam = makeCamera(scene, { x: 10, y: 10 }, 'N');
    const floorP: Vec3 = { x: cam.eye.x, y: cam.eye.y - 5, z: 0 };
    const syBase = project(cam, floorP).sy;
    // caméra plus haute (œil plus haut) : le même point de sol descend à l’écran.
    const camHigh: CamPose = { ...cam, eye: { ...cam.eye, z: cam.eye.z + 1 } };
    const syHigh = project(camHigh, floorP).sy;
    expect(syHigh).toBeGreaterThan(syBase);
  });
  it('behind = true pour un point derrière la caméra', () => {
    const cam = camN();
    const r = project(cam, { x: cam.eye.x, y: cam.eye.y + 5, z: cam.eye.z }); // au sud (derrière)
    expect(r.behind).toBe(true);
  });
});

describe('clipNear', () => {
  it('un quad qui chevauche Zc=NEAR → polygone clippé, tous Zc ≥ NEAR', () => {
    const cam = camN(); // regarde Nord (y↓) ; Zc = -(dy)
    // quad vertical qui va de derrière (y = eye.y + 1) à devant (y = eye.y - 3).
    const y0 = cam.eye.y + 1; // derrière
    const y1 = cam.eye.y - 3; // devant
    const quad: Vec3[] = [
      { x: cam.eye.x - 1, y: y0, z: 0 },
      { x: cam.eye.x + 1, y: y0, z: 0 },
      { x: cam.eye.x + 1, y: y1, z: 0 },
      { x: cam.eye.x - 1, y: y1, z: 0 },
    ];
    const out = clipNear(quad, cam);
    expect(out.length).toBeGreaterThanOrEqual(3);
    for (const p of out) {
      const zc = (p.x - cam.eye.x) * cam.fwd.x + (p.y - cam.eye.y) * cam.fwd.y;
      expect(zc).toBeGreaterThanOrEqual(NEAR - 1e-9);
    }
  });
  it('quad clippé : aucune inversion sx (tous à Zc≥NEAR → sx finis)', () => {
    const cam = camN();
    const quad: Vec3[] = [
      { x: cam.eye.x - 1, y: cam.eye.y + 1, z: 0 },
      { x: cam.eye.x + 1, y: cam.eye.y + 1, z: 0 },
      { x: cam.eye.x + 1, y: cam.eye.y - 3, z: 0 },
      { x: cam.eye.x - 1, y: cam.eye.y - 3, z: 0 },
    ];
    const out = clipNear(quad, cam);
    for (const p of out) {
      const r = project(cam, p);
      expect(Number.isFinite(r.sx)).toBe(true);
      expect(Number.isFinite(r.sy)).toBe(true);
    }
  });
  it('quad entièrement DERRIÈRE → []', () => {
    const cam = camN();
    const behind: Vec3[] = [
      { x: cam.eye.x - 1, y: cam.eye.y + 2, z: 0 },
      { x: cam.eye.x + 1, y: cam.eye.y + 2, z: 0 },
      { x: cam.eye.x + 1, y: cam.eye.y + 4, z: 0 },
      { x: cam.eye.x - 1, y: cam.eye.y + 4, z: 0 },
    ];
    expect(clipNear(behind, cam)).toEqual([]);
  });
  it('quad entièrement DEVANT → inchangé (4 sommets)', () => {
    const cam = camN();
    const front: Vec3[] = [
      { x: cam.eye.x - 1, y: cam.eye.y - 2, z: 0 },
      { x: cam.eye.x + 1, y: cam.eye.y - 2, z: 0 },
      { x: cam.eye.x + 1, y: cam.eye.y - 4, z: 0 },
      { x: cam.eye.x - 1, y: cam.eye.y - 4, z: 0 },
    ];
    expect(clipNear(front, cam).length).toBe(4);
  });
  it('polygone vide → []', () => {
    expect(clipNear([], camN())).toEqual([]);
  });
});

describe('povView', () => {
  // 4 caméras cardinales (fwd, right). Table des 8 caps d’entité × attendu.
  const cams: Record<'N' | 'E' | 'S' | 'O', { fwd: { x: number; y: number }; right: { x: number; y: number } }> = {
    N: { fwd: { x: 0, y: -1 }, right: { x: 1, y: 0 } },
    E: { fwd: { x: 1, y: 0 }, right: { x: 0, y: 1 } },
    S: { fwd: { x: 0, y: 1 }, right: { x: -1, y: 0 } },
    O: { fwd: { x: -1, y: 0 }, right: { x: 0, y: -1 } },
  };
  it('caméra N : une entité regardant S (vers nous) = face ; N = dos ; E/O = profil', () => {
    const { fwd, right } = cams.N;
    expect(povView(fwd, right, 'S').view).toBe('front'); // vient vers la caméra
    expect(povView(fwd, right, 'N').view).toBe('back'); // dos
    expect(povView(fwd, right, 'E').view).toBe('profile');
    expect(povView(fwd, right, 'O').view).toBe('profile');
    expect(povView(fwd, right, 'E').mirror).toBe(false); // E = tribord → pas miroir
    expect(povView(fwd, right, 'O').mirror).toBe(true); // O = bâbord → miroir
  });
  it('caméra E : entité regardant O = face ; E = dos ; N/S = profil', () => {
    const { fwd, right } = cams.E;
    expect(povView(fwd, right, 'O').view).toBe('front');
    expect(povView(fwd, right, 'E').view).toBe('back');
    expect(povView(fwd, right, 'N').view).toBe('profile');
    expect(povView(fwd, right, 'S').view).toBe('profile');
  });
  it('caméra S : entité regardant N = face ; S = dos', () => {
    const { fwd, right } = cams.S;
    expect(povView(fwd, right, 'N').view).toBe('front');
    expect(povView(fwd, right, 'S').view).toBe('back');
  });
  it('caméra O : entité regardant E = face ; O = dos', () => {
    const { fwd, right } = cams.O;
    expect(povView(fwd, right, 'E').view).toBe('front');
    expect(povView(fwd, right, 'O').view).toBe('back');
  });
  it('mirror = signe de la composante latérale (s = e·right)', () => {
    // caméra N, right = est. Une entité regardant vers l’ouest (bâbord) → mirror.
    expect(povView(cams.N.fwd, cams.N.right, 'O').mirror).toBe(true);
    expect(povView(cams.N.fwd, cams.N.right, 'E').mirror).toBe(false);
  });
});

describe('tint', () => {
  it('light=1, fog=0 → ~base', () => {
    expect(tint('#804020', 1, 0)).toBe('rgb(128,64,32)');
  });
  it('light=0 → écrasé au plancher AMBIENT_FLOOR', () => {
    const r = tint('#ffffff', 0, 0);
    const expected = Math.round(255 * AMBIENT_FLOOR);
    expect(r).toBe(`rgb(${expected},${expected},${expected})`);
  });
  it('fog=1 → couleur de brouillard', () => {
    const fr = parseInt(FOG_COLOR.slice(1, 3), 16);
    const fg = parseInt(FOG_COLOR.slice(3, 5), 16);
    const fb = parseInt(FOG_COLOR.slice(5, 7), 16);
    expect(tint('#ffffff', 1, 1)).toBe(`rgb(${fr},${fg},${fb})`);
  });
});

describe('fogAt — courbes de brume en DONNÉE (ambiance.json)', () => {
  const out = fogCurveOf(false);
  const ind = fogCurveOf(true);
  it('extérieur : 0 avant le début, 1 exactement à la portée max (coupure invisible), monotone', () => {
    expect(fogAt(0, out)).toBe(0);
    expect(fogAt(out.start, out)).toBe(0);
    expect(fogAt(out.end, out)).toBe(1);
    expect(fogAt(out.end + 10, out)).toBe(1); // clampé
    const mid = (out.start + out.end) / 2;
    expect(fogAt(mid, out)).toBeGreaterThan(0);
    expect(fogAt(mid, out)).toBeLessThan(1);
    expect(fogAt(mid + 4, out)).toBeGreaterThan(fogAt(mid, out)); // croissance
  });
  it('gamma > 1 : la brume démarre plus DOUX que la rampe linéaire (silhouettes lisibles au milieu)', () => {
    const mid = (out.start + out.end) / 2;
    expect(fogAt(mid, out)).toBeLessThan((mid - out.start) / (out.end - out.start));
  });
  it('intérieur = brume sombre COURTE : portée max < extérieur ; farTilesOf = fin de courbe', () => {
    expect(ind.end).toBeLessThan(out.end);
    expect(farTilesOf(true)).toBe(ind.end);
    expect(farTilesOf(false)).toBe(out.end);
    expect(farTilesOf(false)).toBeGreaterThanOrEqual(28); // profondeur : portée étendue
  });
});

/**
 * `povDepth` (#1247) — le RESSERREMENT météo de la première personne. Il n'a de sens qu'appliqué aux
 * DEUX consommateurs de portée à la fois : la courbe de brume et le plan lointain de la caméra. Ce
 * banc tient l'invariant qui l'exprime — la brume atteint 1 EXACTEMENT à la portée rendue, quel que
 * soit le facteur.
 */
describe('povDepth — la portée resserrée par la météo (#1247)', () => {
  it('sans facteur (ou à 1) : la courbe du milieu, à l’identique', () => {
    for (const indoor of [false, true]) {
      expect(povDepth(indoor).curve).toEqual(fogCurveOf(indoor));
      expect(povDepth(indoor, 1).curve).toEqual(fogCurveOf(indoor));
      expect(povDepth(indoor).farTiles).toBe(farTilesOf(indoor));
    }
  });

  it('le facteur resserre le DÉBUT du voile ET la portée — jamais l’un sans l’autre', () => {
    const base = fogCurveOf(false);
    const serre = povDepth(false, 0.45).curve;
    expect(serre.start).toBeCloseTo(base.start * 0.45, 12);
    expect(serre.end).toBeCloseTo(base.end * 0.45, 12);
    expect(serre.gamma, 'le gamma est une FORME de courbe, pas une distance').toBe(base.gamma);
  });

  it('la brume atteint 1 EXACTEMENT à la portée rendue (aucune arête franche au bout du monde)', () => {
    for (const k of [1, 0.7, 0.45, 0.2]) {
      const { curve, farTiles } = povDepth(false, k);
      expect(farTiles, 'un seul nombre pour les deux consommateurs').toBe(curve.end);
      expect(fogAt(farTiles, curve)).toBe(1);
      expect(fogAt(farTiles * 0.999, curve)).toBeLessThan(1);
    }
  });

  it('un facteur hors bornes est ramené dans [0,1] — la météo ne RALLONGE jamais la portée', () => {
    expect(povDepth(false, 4).farTiles).toBe(farTilesOf(false));
    expect(povDepth(false, -1).farTiles).toBe(0);
  });
});

describe('mixHex', () => {
  it('t=0 → a, t=1 → b, t=0.5 → moyenne', () => {
    expect(mixHex('#000000', '#ffffff', 0)).toBe('#000000');
    expect(mixHex('#000000', '#ffffff', 1)).toBe('#ffffff');
    expect(mixHex('#204060', '#204060', 0.37)).toBe('#204060');
    expect(mixHex('#000000', '#ffffff', 0.5)).toBe('#808080');
  });
});

describe('tileCornersWorld', () => {
  it('sol : 4 coins aux (x∓0.5)*mpt, z = height (0)', () => {
    const s = flatScene();
    const c = tileCornersWorld(s, 3, 4, 0, false);
    expect(c.length).toBe(4);
    const xs = c.map((p) => p.x).sort((a, b) => a - b);
    const ys = c.map((p) => p.y).sort((a, b) => a - b);
    expect(xs[0]).toBeCloseTo(2.5 * 2, 6); // (3-0.5)*2
    expect(xs[3]).toBeCloseTo(3.5 * 2, 6); // (3+0.5)*2
    expect(ys[0]).toBeCloseTo(3.5 * 2, 6); // (4-0.5)*2
    expect(ys[3]).toBeCloseTo(4.5 * 2, 6); // (4+0.5)*2
    for (const p of c) expect(p.z).toBeCloseTo(0, 6);
  });
  it('plafond : z = height + WALL_H_M', () => {
    const s = flatScene();
    const c = tileCornersWorld(s, 3, 4, 0, true);
    for (const p of c) expect(p.z).toBeCloseTo(WALL_H_M, 6);
  });
  it('height non nulle est prise en compte', () => {
    const s = flatScene();
    s.layers[0].height = new Array(20 * 20).fill(0);
    s.layers[0].height![4 * 20 + 3] = 1.5;
    const c = tileCornersWorld(s, 3, 4, 0, false);
    for (const p of c) expect(p.z).toBeCloseTo(1.5, 6);
    const ceil = tileCornersWorld(s, 3, 4, 0, true);
    for (const p of ceil) expect(p.z).toBeCloseTo(1.5 + WALL_H_M, 6);
  });
});

