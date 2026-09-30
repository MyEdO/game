import { describe, expect, it } from 'vitest';
import { Box3, Vector3 } from 'three';
import {
  DEPTH_MARGIN_M,
  FIT_FILL,
  affineCamera,
  affineScales,
  fitAffineView,
  orthoDepthRange,
  povCamera,
  projectToScreen,
  rotYaw,
} from './cameras';
import { LEVEL_H, TH, TW, tileCenter, type Dims, type ProjKind, type Rot } from '../../../geometry/iso';
import { METRES_PER_LEVEL, metricToLift } from '../../../state/relief';
import { buildScene } from '../../../state/mapSpec';
import { spec as siegeSpec } from '../../../scenes/test-scenarios/siege-enceinte';
import { sceneMetresPerTile } from '../../../state/scene';
import { DIR8_ORDER } from '../../../state/dir8';
import { VH, VW, makeCamera, project } from '../../pov/camera';
import { pxPerM } from './worldTris';
import { ISO_PX_PER_M } from '../../iso';
import { buildWorldGeometry, collectBillboards, contentBox, wholeSceneBillboardEls } from './sceneMeshes';
import { anchorAndSize, billboardHeightM, BILLBOARD_BOX_ASPECT } from './billboardMath';

/**
 * LE test du lot : la caméra three doit rendre le MÊME pixel que la projection SVG de production, à
 * viewport et ancrage égaux. Toute divergence de pitch, d'échelle ou de sens de rotation s'y voit.
 * La fidélité n'est définie que sur les CRANS de production (0/90/180/270°) : un lacet libre n'a
 * aucune vérité SVG en face.
 */
const scene = buildScene(siegeSpec());
const mpt = sceneMetresPerTile(scene);
const VIEWPORT = { w: 1600, h: 1000 };
/** L'écart mesuré est 0,000000 px : la tolérance est celle du flottant, pas un « à peu près ». */
const TOL = 1e-6;

/** Grille d'échantillons (tuiles × hauteurs métriques) couvrant la scène-témoin. */
const SAMPLES: { x: number; y: number; h: number }[] = [];
for (const x of [0, 7, 14.5, 22, 29]) for (const y of [0, 11, 23.5, 34, 45]) for (const h of [0, 1.7, 4, 9.25]) SAMPLES.push({ x, y, h });

const worldOf = (s: { x: number; y: number; h: number }) => new Vector3(s.x * mpt, s.h, s.y * mpt);

function svgScreen(s: { x: number; y: number; h: number }, dims: Dims): { sx: number; sy: number } {
  const { cx, cy } = tileCenter(s.x, s.y, dims, metricToLift(s.h));
  return { sx: cx, sy: cy };
}

function dimsFor(kind: ProjKind, rot: Rot): Dims {
  const base = { w: scene.dimensions.w, h: scene.dimensions.h, rot };
  if (kind === 'edge') return { ...base, edge: true };
  if (kind === 'top') return { ...base, view: 'top' as const };
  return base;
}

/** Écart maximal (px) entre une caméra et la projection SVG, ancrés sur le MÊME point de référence. */
function deltaOf(camera: Parameters<typeof projectToScreen>[0], dims: Dims): number {
  const ref = SAMPLES[0];
  const refSvg = svgScreen(ref, dims);
  const refGl = projectToScreen(camera, worldOf(ref), VIEWPORT);
  let worst = 0;
  for (const s of SAMPLES) {
    const svg = svgScreen(s, dims);
    const gl = projectToScreen(camera, worldOf(s), VIEWPORT);
    worst = Math.max(
      worst,
      Math.abs(gl.sx - refGl.sx - (svg.sx - refSvg.sx)),
      Math.abs(gl.sy - refGl.sy - (svg.sy - refSvg.sy)),
    );
  }
  return worst;
}

function maxDelta(kind: ProjKind, rot: Rot): number {
  return deltaOf(affineCamera(kind, rotYaw(rot), mpt, VIEWPORT).camera, dimsFor(kind, rot));
}

describe('Caméras WebGL — coïncidence pixel avec la projection de production', () => {
  const rots: Rot[] = [0, 1, 2, 3];

  for (const kind of ['iso', 'edge'] as const)
    for (const rot of rots)
      it(`ortho ${kind} rot${rot} : à ${TOL} px de la projection SVG (x, y, hauteur)`, () => {
        expect(maxDelta(kind, rot)).toBeLessThanOrEqual(TOL);
      });

  it(`ortho top : à ${TOL} px de la projection SVG (regard vertical, hauteur sans effet écran)`, () => {
    expect(maxDelta('top', 0)).toBeLessThanOrEqual(TOL);
  });

  it(`perspective POV : à ${TOL} px de \`project\` (pov/camera.ts), 8 caps × 3 positions, en pixels ABSOLUS`, () => {
    let worst = 0;
    let comptes = 0;
    for (const pos of [{ x: 8, y: 40, z: 0 }, { x: 15, y: 22, z: 0 }, { x: 24, y: 8, z: 0 }]) {
      for (const facing of DIR8_ORDER) {
        const pose = makeCamera(scene, pos, facing);
        const camera = povCamera(scene, pos, facing, { w: VW, h: VH });
        for (const d of [2, 6, 15, 40]) {
          for (const lat of [-6, 0, 6]) {
            for (const z of [0, 1.7, 5]) {
              const gx = pos.x + pose.fwd.x * d + pose.right.x * lat;
              const gy = pos.y + pose.fwd.y * d + pose.right.y * lat;
              const P = { x: gx * mpt, y: gy * mpt, z };
              const ref = project(pose, P);
              if (ref.behind) continue;
              const gl = projectToScreen(camera, new Vector3(P.x, P.z, P.y), { w: VW, h: VH });
              worst = Math.max(worst, Math.abs(gl.sx - ref.sx), Math.abs(gl.sy - ref.sy));
              comptes++;
            }
          }
        }
      }
    }
    expect(comptes).toBeGreaterThan(500);
    expect(worst).toBeLessThanOrEqual(TOL);
  });
});

describe('ANISOTROPIE — elle vit DANS la caméra, jamais dans un post-traitement', () => {
  it('un `updateProjectionMatrix()` de plus ne change RIEN à la coïncidence pixel', () => {
    const dims = dimsFor('iso', 0);
    const { camera } = affineCamera('iso', rotYaw(0), mpt, VIEWPORT);
    expect(camera.stretch).not.toBe(1); // sinon la garde passerait sans anisotropie à préserver
    const avant = deltaOf(camera, dims);
    expect(avant).toBeLessThanOrEqual(TOL);
    camera.updateProjectionMatrix();
    expect(deltaOf(camera, dims)).toBe(avant);
    camera.updateProjectionMatrix();
    camera.updateProjectionMatrix();
    expect(deltaOf(camera, dims)).toBeLessThanOrEqual(TOL);
  });

  it('l’étirement est celui de `affineScales`, ré-appliqué à chaque reconstruction de la projection', () => {
    const { camera, stretch } = affineCamera('edge', rotYaw(2), mpt, VIEWPORT);
    expect(camera.stretch).toBe(stretch);
    const elements = [...camera.projectionMatrix.elements];
    camera.updateProjectionMatrix();
    expect([...camera.projectionMatrix.elements]).toEqual(elements);
  });
});

describe('PROFONDEUR — le buffer ne couvre que la scène', () => {
  it('near/far encadrent la sphère englobante, marge comprise', () => {
    expect(orthoDepthRange(120, 40)).toEqual({ near: 120 - 40 - DEPTH_MARGIN_M, far: 120 + 40 + DEPTH_MARGIN_M });
  });

  it('une caméra plus proche que le rayon garde un near strictement positif', () => {
    expect(orthoDepthRange(5, 40).near).toBeGreaterThan(0);
  });

  it('un rayon de scène resserre la caméra (fini le far à des milliers de mètres)', () => {
    const distance = 150;
    const radius = 60;
    const { camera } = affineCamera('iso', rotYaw(0), mpt, VIEWPORT, { distance, radius });
    expect(camera.near).toBe(distance - radius - DEPTH_MARGIN_M);
    expect(camera.far).toBe(distance + radius + DEPTH_MARGIN_M);
    expect(camera.far - camera.near).toBe(2 * (radius + DEPTH_MARGIN_M));
  });

  it('sans rayon fourni, la portée reste large (scène inconnue)', () => {
    const { camera } = affineCamera('iso', rotYaw(0), mpt, VIEWPORT);
    expect(camera.far).toBeGreaterThan(1000);
  });

  it('resserrer la profondeur ne bouge PAS le pixel', () => {
    const dims = dimsFor('iso', 0);
    const { camera } = affineCamera('iso', rotYaw(0), mpt, VIEWPORT, { distance: 150, radius: 60 });
    expect(deltaOf(camera, dims)).toBeLessThanOrEqual(TOL);
  });
});

describe('LACET LIBRE — les crans de production en sont les cas particuliers', () => {
  const heading = (yawDeg: number): number => {
    const d = affineCamera('iso', yawDeg, mpt, VIEWPORT).camera.getWorldDirection(new Vector3());
    return (Math.atan2(d.z, d.x) * 180) / Math.PI;
  };
  const ecart = (a: number, b: number): number => {
    let v = a - b;
    while (v > 180) v -= 360;
    while (v <= -180) v += 360;
    return v;
  };

  it('un cran vaut 90°', () => {
    expect(([0, 1, 2, 3] as Rot[]).map(rotYaw)).toEqual([0, 90, 180, 270]);
  });

  it('le lacet 90° donne EXACTEMENT la caméra du cran 1 (aucun résidu de trigonométrie)', () => {
    const cran = affineCamera('iso', rotYaw(1), mpt, VIEWPORT).camera;
    const libre = affineCamera('iso', 90, mpt, VIEWPORT).camera;
    expect([...libre.matrixWorld.elements]).toEqual([...cran.matrixWorld.elements]);
    expect([...libre.projectionMatrix.elements]).toEqual([...cran.projectionMatrix.elements]);
  });

  it('un lacet intermédiaire tourne vraiment la caméra, entre ses deux crans', () => {
    expect(Math.abs(ecart(heading(45), heading(0)))).toBeCloseTo(45, 6);
    expect(Math.abs(ecart(heading(90), heading(45)))).toBeCloseTo(45, 6);
    expect(Math.abs(ecart(heading(25), heading(0)))).toBeCloseTo(25, 6);
    expect(Math.abs(ecart(heading(65), heading(0)))).toBeCloseTo(65, 6);
  });

  it('le lacet ne touche NI le pitch NI les échelles (seule l’orientation tourne)', () => {
    const a = affineCamera('iso', 25, mpt, VIEWPORT);
    const b = affineCamera('iso', rotYaw(0), mpt, VIEWPORT);
    expect({ sx: a.sx, sy: a.sy, pitch: a.pitch, stretch: a.stretch }).toEqual({ sx: b.sx, sy: b.sy, pitch: b.pitch, stretch: b.stretch });
    expect(a.camera.getWorldDirection(new Vector3()).y).toBeCloseTo(b.camera.getWorldDirection(new Vector3()).y, 12);
  });

  it('un lacet négatif ou > 360° reste équivalent à son cran (modulo un tour)', () => {
    const ref = affineCamera('edge', rotYaw(3), mpt, VIEWPORT).camera;
    for (const yaw of [-90, 630]) {
      expect([...affineCamera('edge', yaw, mpt, VIEWPORT).camera.matrixWorld.elements]).toEqual([...ref.matrixWorld.elements]);
    }
  });
});

describe('Échelles affines — dérivées des constantes, jamais posées', () => {
  it('la cadence VERTICALE de l’écran est la SOURCE UNIQUE `ISO_PX_PER_M`', () => {
    const { sy, pitch } = affineScales('iso', mpt);
    expect(ISO_PX_PER_M).toBe(LEVEL_H / METRES_PER_LEVEL);
    expect(sy * Math.cos(pitch)).toBeCloseTo(ISO_PX_PER_M, 9);
  });

  it('la cadence de PROFONDEUR au sol vaut TH/TW de la cadence horizontale (losange 2:1)', () => {
    const { sx, sy, pitch } = affineScales('iso', mpt);
    expect(sy * Math.sin(pitch)).toBeCloseTo(sx * (TH / TW), 9);
    expect(sx).toBeCloseTo((TW * Math.SQRT1_2) / mpt, 9);
    expect(sx).toBeCloseTo(pxPerM(mpt), 12);
  });

  it('iso et edge-on partagent pitch et échelles (l’edge-on EST le losange tourné d’un quart de tour)', () => {
    expect(affineScales('edge', mpt)).toEqual(affineScales('iso', mpt));
  });

  it('un pitch asin(TH/TW) = 30° manquerait la cadence verticale de plus de 0.5 px/m à cette échelle', () => {
    const { sx } = affineScales('iso', mpt);
    const uniform = sx * Math.cos(Math.asin(TH / TW)); // px/m de hauteur d’une ortho UNIFORME à 30°
    expect(Math.abs(uniform - ISO_PX_PER_M)).toBeGreaterThan(0.5);
  });
});

describe('CADRAGE — la vue affine tient le CONTENU, sans toucher à la définition de la caméra', () => {
  const CADRE = { w: 1280, h: 720 };
  const kinds: ProjKind[] = ['top', 'iso', 'edge'];

  /** Boîte-écran (px du CADRE) du contenu, vue par la caméra cadrée : `zoom` n'agit que par le viewport
   *  passé à `affineCamera`, la projection reste en NDC → le cadre reste `CADRE`. */
  function boiteEcran(kind: ProjKind, rot: Rot, box: Box3) {
    const fit = fitAffineView(kind, rotYaw(rot), mpt, box, CADRE);
    const { camera } = affineCamera(kind, rotYaw(rot), mpt, { w: CADRE.w / fit.zoom, h: CADRE.h / fit.zoom }, { target: fit.target });
    let loX = Infinity, hiX = -Infinity, loY = Infinity, hiY = -Infinity;
    for (const x of [box.min.x, box.max.x])
      for (const y of [box.min.y, box.max.y])
        for (const z of [box.min.z, box.max.z]) {
          const p = projectToScreen(camera, new Vector3(x, y, z), CADRE);
          loX = Math.min(loX, p.sx); hiX = Math.max(hiX, p.sx);
          loY = Math.min(loY, p.sy); hiY = Math.max(hiY, p.sy);
        }
    return { loX, hiX, loY, hiY, w: hiX - loX, h: hiY - loY };
  }

  /** Boîte de CONTENU de la scène-témoin (bâti + sujets), à la convention de taille par défaut. */
  const contenu = (() => {
    const geoBox = buildWorldGeometry(scene, mpt, 'jeu', () => 1).boundingBox!;
    const subs = collectBillboards(scene, mpt, wholeSceneBillboardEls(scene));
    return contentBox(scene, mpt, 'jeu', subs, (s) => anchorAndSize(billboardHeightM('jeu', s.kind) * s.scaleK, BILLBOARD_BOX_ASPECT), geoBox);
  })();

  for (const kind of kinds)
    it(`${kind} : le contenu de siege-enceinte tient ENTIER dans le cadre et en remplit ${FIT_FILL} de la dimension contrainte`, () => {
      const b = boiteEcran(kind, 0, contenu);
      expect(b.loX).toBeGreaterThanOrEqual(-0.5);
      expect(b.loY).toBeGreaterThanOrEqual(-0.5);
      expect(b.hiX).toBeLessThanOrEqual(CADRE.w + 0.5);
      expect(b.hiY).toBeLessThanOrEqual(CADRE.h + 0.5);
      expect(Math.max(b.w / CADRE.w, b.h / CADRE.h)).toBeCloseTo(FIT_FILL, 6);
    });

  // La couverture en SURFACE est bornée par le rapport de forme : le contenu du siège fait 60,2 × 85,9 m
  // (mesuré #1176) — plus haut que large, quand le cadre est en 16/9. Vue du dessus, même collé aux bords,
  // il ne peut couvrir que ~39 % du cadre ; les deux vues inclinées, elles, passent la moitié.
  for (const kind of ['iso', 'edge'] as const)
    it(`${kind} : la boîte projetée du contenu couvre au moins la MOITIÉ du cadre`, () => {
      const b = boiteEcran(kind, 0, contenu);
      expect((b.w * b.h) / (CADRE.w * CADRE.h)).toBeGreaterThanOrEqual(0.5);
    });

  it('la vue du dessus cadre le contenu au lieu de le déborder de 4,4× en surface', () => {
    const nu = affineCamera('top', rotYaw(0), mpt, CADRE, { target: contenu.getCenter(new Vector3()) }).camera;
    let w = 0, h = 0;
    for (const x of [contenu.min.x, contenu.max.x])
      for (const z of [contenu.min.z, contenu.max.z]) {
        const p = projectToScreen(nu, new Vector3(x, contenu.min.y, z), CADRE);
        w = Math.max(w, Math.abs(p.sx - CADRE.w / 2) * 2);
        h = Math.max(h, Math.abs(p.sy - CADRE.h / 2) * 2);
      }
    expect((w * h) / (CADRE.w * CADRE.h)).toBeGreaterThan(4); // l'échelle NUE `CELL/mpt` déborde
    const b = boiteEcran('top', 0, contenu);
    expect(b.w).toBeLessThanOrEqual(CADRE.w + 0.5);
    expect(b.h).toBeLessThanOrEqual(CADRE.h + 0.5);
  });

  it('le cadrage ne dépend PAS du zoom demandé : il rend le facteur, l’appelant compose', () => {
    const a = fitAffineView('iso', rotYaw(1), mpt, contenu, CADRE);
    const b = fitAffineView('iso', rotYaw(1), mpt, contenu, { w: CADRE.w / 2, h: CADRE.h / 2 });
    expect(b.zoom).toBeCloseTo(a.zoom / 2, 9);
    expect(b.target.distanceTo(a.target)).toBeCloseTo(0, 9);
  });

  it('une boîte déjà centrée et de la taille du cadre ne se déplace pas', () => {
    const { sx, sy } = affineScales('top', mpt);
    const demiX = (CADRE.w * FIT_FILL) / (2 * sx);
    const demiZ = (CADRE.h * FIT_FILL) / (2 * sy);
    const box = new Box3(new Vector3(-demiX, 0, -demiZ), new Vector3(demiX, 0, demiZ));
    const fit = fitAffineView('top', rotYaw(0), mpt, box, CADRE);
    expect(fit.zoom).toBeCloseTo(1, 9);
    expect(fit.target.length()).toBeCloseTo(0, 9);
  });

  it('une boîte DÉCENTRÉE ramène la cible sur elle (le cadrage suit le contenu, pas la carte)', () => {
    const box = new Box3(new Vector3(200, 0, -400), new Vector3(240, 6, -360));
    const fit = fitAffineView('iso', rotYaw(0), mpt, box, CADRE);
    const b = boiteEcran('iso', 0, box);
    expect((b.loX + b.hiX) / 2).toBeCloseTo(CADRE.w / 2, 6);
    expect((b.loY + b.hiY) / 2).toBeCloseTo(CADRE.h / 2, 6);
    expect(fit.target.distanceTo(box.getCenter(new Vector3()))).toBeGreaterThan(0); // la cible n'est PAS le centre 3D
  });
});
