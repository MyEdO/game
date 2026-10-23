import { describe, it, expect } from 'vitest';
import {
  identityTransform,
  canvasToImagePoint,
  computeTransform,
  computeLockedTransform,
  nearestNode,
  advanceCalibration,
  type CalibProgress,
} from './traceCalibration';

/** Grille carrée 56px/case (comme la vue plan `top`, CELL=56), origine à (100,100) — pas besoin de
 *  reproduire `geometry/iso.ts`, juste une fonction affine plausible pour éprouver la similitude. */
const CELL = 56;
const ORIGIN = { x: 100, y: 100 };
const tileCenterOf = (x: number, y: number) => ({ cx: ORIGIN.x + x * CELL, cy: ORIGIN.y + y * CELL });

describe('computeTransform', () => {
  it('cale exactement les 2 points fournis sur les centres de case attendus', () => {
    const p1 = { img: { x: 10, y: 20 }, tile: { x: 2, y: 3 } };
    const p2 = { img: { x: 210, y: 20 }, tile: { x: 5, y: 3 } }; // même y image → alignement horizontal
    const t = computeTransform(p1, p2, tileCenterOf);
    const q1 = tileCenterOf(p1.tile.x, p1.tile.y);
    const q2 = tileCenterOf(p2.tile.x, p2.tile.y);

    // R(t)·scale·img + translate doit retomber EXACTEMENT sur chaque centre de case.
    const apply = (p: { x: number; y: number }) => {
      const rad = (t.rotateDeg * Math.PI) / 180;
      const rx = p.x * Math.cos(rad) - p.y * Math.sin(rad);
      const ry = p.x * Math.sin(rad) + p.y * Math.cos(rad);
      return { x: t.tx + t.scale * rx, y: t.ty + t.scale * ry };
    };
    const a1 = apply(p1.img);
    const a2 = apply(p2.img);
    expect(a1.x).toBeCloseTo(q1.cx, 6);
    expect(a1.y).toBeCloseTo(q1.cy, 6);
    expect(a2.x).toBeCloseTo(q2.cx, 6);
    expect(a2.y).toBeCloseTo(q2.cy, 6);
  });

  it('déduit une rotation non nulle quand les deux vecteurs (image, grille) ne sont pas alignés', () => {
    const p1 = { img: { x: 0, y: 0 }, tile: { x: 0, y: 0 } };
    const p2 = { img: { x: 100, y: 0 }, tile: { x: 0, y: 2 } }; // vecteur image horizontal, grille verticale → 90°
    const t = computeTransform(p1, p2, tileCenterOf);
    expect(Math.abs(t.rotateDeg)).toBeCloseTo(90, 3);
  });

  it('2 points image confondus retombe sur l’identité (garde de robustesse, pas de crash/NaN)', () => {
    const p1 = { img: { x: 5, y: 5 }, tile: { x: 0, y: 0 } };
    const p2 = { img: { x: 5, y: 5 }, tile: { x: 3, y: 3 } };
    expect(computeTransform(p1, p2, tileCenterOf)).toEqual(identityTransform());
  });
});

describe('canvasToImagePoint', () => {
  it('est l’inverse exact de la transformation appliquée (aller-retour)', () => {
    const t = { tx: 40, ty: -15, scale: 1.7, rotateDeg: 33 };
    const img = { x: 12, y: -8 };
    const rad = (t.rotateDeg * Math.PI) / 180;
    const rx = img.x * Math.cos(rad) - img.y * Math.sin(rad);
    const ry = img.x * Math.sin(rad) + img.y * Math.cos(rad);
    const canvasPt = { x: t.tx + t.scale * rx, y: t.ty + t.scale * ry };
    const back = canvasToImagePoint(canvasPt, t);
    expect(back.x).toBeCloseTo(img.x, 6);
    expect(back.y).toBeCloseTo(img.y, 6);
  });

  it('avec la transformation identité, un clic canvas = le même point image', () => {
    expect(canvasToImagePoint({ x: 42, y: 7 }, identityTransform())).toEqual({ x: 42, y: 7 });
  });
});

describe('advanceCalibration — machine à états du calage 2 points', () => {
  it('déroule les 4 clics (image1 → tile1 → image2 → tile2) et produit la transformation finale', () => {
    const identity = identityTransform();
    const tileFromScreen = (pt: { x: number; y: number }) => ({
      x: Math.round((pt.x - ORIGIN.x) / CELL),
      y: Math.round((pt.y - ORIGIN.y) / CELL),
    });
    let progress: CalibProgress = { step: 'image1' };

    // 1er point repère sur l'image (identité → clic canvas = point image).
    let out = advanceCalibration(progress, { x: 10, y: 20 }, identity, tileFromScreen, tileCenterOf);
    progress = out.progress;
    expect(progress.step).toBe('tile1');
    expect(out.transform).toBeUndefined();

    // Sa case de grille correspondante (case 2,3 → centre écran (212,268)).
    const q1 = tileCenterOf(2, 3);
    out = advanceCalibration(progress, { x: q1.cx, y: q1.cy }, identity, tileFromScreen, tileCenterOf);
    progress = out.progress;
    expect(progress.step).toBe('image2');
    expect(progress.tile1).toEqual({ x: 2, y: 3 });

    // 2e point repère sur l'image.
    out = advanceCalibration(progress, { x: 210, y: 20 }, identity, tileFromScreen, tileCenterOf);
    progress = out.progress;
    expect(progress.step).toBe('tile2');

    // Sa case de grille (case 5,3).
    const q2 = tileCenterOf(5, 3);
    out = advanceCalibration(progress, { x: q2.cx, y: q2.cy }, identity, tileFromScreen, tileCenterOf);
    expect(out.progress.step).toBe('idle');
    expect(out.transform).toBeDefined();
    expect(out.transform!.scale).toBeCloseTo(computeTransform(
      { img: { x: 10, y: 20 }, tile: { x: 2, y: 3 } },
      { img: { x: 210, y: 20 }, tile: { x: 5, y: 3 } },
      tileCenterOf,
    ).scale, 6);
  });

  it('idle ne fait rien (aucun clic parasite hors calibration)', () => {
    const out = advanceCalibration({ step: 'idle' }, { x: 1, y: 2 }, identityTransform(), () => ({ x: 0, y: 0 }), tileCenterOf);
    expect(out.progress.step).toBe('idle');
    expect(out.transform).toBeUndefined();
  });
});

describe('computeLockedTransform — rotation VERROUILLÉE par défaut (retour user 2026-07-25)', () => {
  it('un clic humain légèrement décalé (quelques pixels) ne fait JAMAIS pivoter l’image : angle exactement 0', () => {
    // Points « imparfaits » comme un vrai clic : le 2e point image n'est PAS parfaitement aligné
    // horizontalement avec le 1er (décalage de 3px en y) alors que les cases visées SONT alignées
    // horizontalement — une similitude complète en déduirait une légère rotation parasite.
    const p1 = { img: { x: 10, y: 20 }, tile: { x: 2, y: 3 } };
    const p2 = { img: { x: 210, y: 23 }, tile: { x: 5, y: 3 } };
    const t = computeLockedTransform(p1, p2, tileCenterOf);
    expect(t.rotateDeg).toBe(0);
  });

  it('cale l’échelle sur la DISTANCE entre les 2 points (seule grandeur invariante par rotation)', () => {
    const p1 = { img: { x: 0, y: 0 }, tile: { x: 0, y: 0 } };
    const p2 = { img: { x: 100, y: 0 }, tile: { x: 2, y: 0 } }; // 2 cases = 2*CELL px écran, 100px image
    const t = computeLockedTransform(p1, p2, tileCenterOf);
    expect(t.scale).toBeCloseTo((2 * CELL) / 100, 6);
  });

  it('répartit l’erreur : cale le MILIEU image sur le milieu écran (jamais un ancrage exact du 1er point)', () => {
    const p1 = { img: { x: 0, y: 0 }, tile: { x: 0, y: 0 } };
    const p2 = { img: { x: 100, y: 0 }, tile: { x: 2, y: 0 } };
    const t = computeLockedTransform(p1, p2, tileCenterOf);
    const midImg = { x: 50, y: 0 };
    const midScreen = { x: (tileCenterOf(0, 0).cx + tileCenterOf(2, 0).cx) / 2, y: (tileCenterOf(0, 0).cy + tileCenterOf(2, 0).cy) / 2 };
    // Application de t au milieu image doit retomber EXACTEMENT sur le milieu écran (angle 0 → identité).
    expect(t.tx + t.scale * midImg.x).toBeCloseTo(midScreen.x, 6);
    expect(t.ty + t.scale * midImg.y).toBeCloseTo(midScreen.y, 6);
  });

  it('2 points image confondus retombe sur l’identité (même garde que le mode libre)', () => {
    const p1 = { img: { x: 5, y: 5 }, tile: { x: 0, y: 0 } };
    const p2 = { img: { x: 5, y: 5 }, tile: { x: 3, y: 3 } };
    expect(computeLockedTransform(p1, p2, tileCenterOf)).toEqual(identityTransform());
  });
});

describe('nearestNode — accroche au NŒUD de grille (intersection), jamais au centre de case', () => {
  it('un point proche du centre d’une case (1,1) accroche le nœud (coin) le plus proche, PAS la case', () => {
    // Centre de case (1,1) en espace-tuile est (1,1) ; les nœuds encadrants sont (0.5,0.5)/(1.5,1.5) etc.
    expect(nearestNode({ x: 1.1, y: 1.1 })).toEqual({ x: 1.5, y: 1.5 }); // passé le centre (1,1) → coin 1.5 le plus proche
    expect(nearestNode({ x: 1.9, y: 1.9 })).toEqual({ x: 1.5, y: 1.5 });
  });

  it('accroche au nœud EXACT quand le clic tombe pile sur une intersection', () => {
    expect(nearestNode({ x: 2.5, y: 3.5 })).toEqual({ x: 2.5, y: 3.5 });
  });

  it('coordonnées négatives (bord de grille) : accroche aussi correctement', () => {
    expect(nearestNode({ x: -0.3, y: -0.6 })).toEqual({ x: -0.5, y: -0.5 });
  });

  it('un nœud est TOUJOURS demi-entier (jamais un centre de case entier)', () => {
    for (const v of [0, 0.5, 1, 1.5, 2, 2.99, -1.2]) {
      const n = nearestNode({ x: v, y: v });
      expect(Math.abs(n.x % 1)).toBeCloseTo(0.5, 9); // JS % préserve le signe du dividende (ex. -1.5 % 1 = -0.5)
    }
  });
});

describe('advanceCalibration — allowRotation (défaut FAUX = verrouillé, retour user 2026-07-25)', () => {
  it('par défaut (sans 6e argument), le calage 2 points produit un angle EXACTEMENT 0 même pour des points imparfaitement alignés', () => {
    const identity = identityTransform();
    const tileFromScreen = (pt: { x: number; y: number }) => nearestNode({
      x: (pt.x - ORIGIN.x) / CELL,
      y: (pt.y - ORIGIN.y) / CELL,
    });
    let progress: CalibProgress = { step: 'image1' };
    let out = advanceCalibration(progress, { x: 10, y: 20 }, identity, tileFromScreen, tileCenterOf);
    progress = out.progress;
    const q1 = tileCenterOf(2.5, 3.5);
    out = advanceCalibration(progress, { x: q1.cx, y: q1.cy }, identity, tileFromScreen, tileCenterOf);
    progress = out.progress;
    // 2e point image LÉGÈREMENT décalé en y (imprécision humaine) par rapport à un alignement parfait.
    out = advanceCalibration(progress, { x: 210, y: 23 }, identity, tileFromScreen, tileCenterOf);
    progress = out.progress;
    const q2 = tileCenterOf(5.5, 3.5);
    out = advanceCalibration(progress, { x: q2.cx, y: q2.cy }, identity, tileFromScreen, tileCenterOf);
    expect(out.transform).toBeDefined();
    expect(out.transform!.rotateDeg).toBe(0);
  });

  it('allowRotation=true retrouve la similitude COMPLÈTE (rotation non nulle autorisée, scan de travers)', () => {
    const identity = identityTransform();
    // Nœuds VISÉS dans l'ordre des 2 clics « tile » : (0,0) puis (0,2) — vecteur grille VERTICAL,
    // alors que le vecteur IMAGE ci-dessous est HORIZONTAL → 90° attendus en mode libre.
    const tiles = [{ x: 0, y: 0 }, { x: 0, y: 2 }];
    let call = 0;
    const tileFromScreen = () => tiles[call++];
    let progress: CalibProgress = { step: 'image1' };
    let out = advanceCalibration(progress, { x: 0, y: 0 }, identity, tileFromScreen, tileCenterOf, true);
    progress = out.progress;
    out = advanceCalibration(progress, { x: tileCenterOf(0, 0).cx, y: tileCenterOf(0, 0).cy }, identity, tileFromScreen, tileCenterOf, true);
    progress = out.progress;
    out = advanceCalibration(progress, { x: 100, y: 0 }, identity, tileFromScreen, tileCenterOf, true);
    progress = out.progress;
    const q2 = tileCenterOf(0, 2);
    out = advanceCalibration(progress, { x: q2.cx, y: q2.cy }, identity, tileFromScreen, tileCenterOf, true);
    expect(out.transform).toBeDefined();
    expect(Math.abs(out.transform!.rotateDeg)).toBeCloseTo(90, 3);
  });
});
