import { DoubleSide, Mesh, MeshBasicMaterial, OrthographicCamera, PerspectiveCamera, PlaneGeometry, PointLight, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { billboardDepthOffsetUnits, billboardPose, BILLBOARD_DEPTH_BIAS_M, DEPTH_BUFFER_BITS, type BillboardSubject, type TintAt } from '../backends/webgl/sceneMeshes';
import { affineCamera } from '../backends/webgl/cameras';
import { FOV_X } from '../pov/camera';
import { TEINTE_PLEINE, billboardMaterial, boardCenter, poseBoards, UP_ECRAN_COUCHE, type Board, type FrameLights } from './boardPose';
import { billboardExposure, FLAME_INTENSITY, FLAME_LIFT_M, type PointLightSlots } from './stagePointLights';

/**
 * LA PASSE DE POSE DES BILLBOARDS DU DÉCOR (#1176, P2-4). Elle ne construit rien : elle ré-oriente les
 * quads montés face à la caméra de la frame, leur donne leur biais de profondeur et leur exposition.
 */
const CAMERA = new OrthographicCamera(-10, 10, 10, -10, 0.1, 100);

function sujet(anchor: Vector3): BillboardSubject {
  return {
    identity: 'sonde:decor',
    kind: 'prop',
    anchor,
    facing: 'S',
    scaleK: 1,
    cell: { x: 0, y: 0, z: 0 },
    box: { w: 120, h: 150 },
    svg: () => '',
  };
}

function board(anchor: Vector3): Board {
  const material = new MeshBasicMaterial();
  return {
    sub: sujet(anchor),
    quad: { widthM: 2, heightM: 3, centerLiftM: 1.5 },
    mesh: new Mesh(new PlaneGeometry(2, 3), material),
    material,
  };
}

/**
 * L'EXPOSITION du quad (#1245, L3) se recalcule à la pose, à l'endroit où le sujet se pose.
 */
const PORTEE_M = 8; // brasero : 4 cases × 2 m
const EXTINCTION = 0.6; // ce qu'il reste à allumer sous le palier d'ambiance de la frame
const INTENSITE = FLAME_INTENSITY * Math.PI * EXTINCTION;
const LUM = 0.4; // exposition globale de la frame

/** Une lampe du pool telle que la décision l'a écrite (`stagePointLights`), portée ou posée. */
const lampe = (srcId: string, x: number, z: number) => ({ srcId, x, y: FLAME_LIFT_M, z, intensity: INTENSITE, distance: PORTEE_M, color: 0xffffff });

/** Le POOL monté sur cette table — les lampes que la passe de pose déplace, index par index. */
function flaques(slots: PointLightSlots): FrameLights & { pool: PointLight[] } {
  const pool = slots.map((w) => {
    const l = new PointLight(0xffffff, 0, 0, 0);
    if (w) { l.position.set(w.x, w.y, w.z); l.intensity = w.intensity; l.distance = w.distance; }
    return l;
  });
  return { pool, surfaceLuminance: LUM };
}

describe('poseBoards — le personnage ENTRE dans la flaque (#1245 L3)', () => {
  it('le quad au pied de la lampe est PLUS CLAIR que le même quad à six cases', () => {
    const f = flaques([lampe('b0', 0, 0)]);
    const auFoyer = board(new Vector3(0, 0, 0));
    const auLoin = board(new Vector3(12, 0, 0)); // 6 cases × 2 m
    poseBoards([auFoyer, auLoin], CAMERA, f, TEINTE_PLEINE);
    expect(auFoyer.material.color.r).toBeGreaterThan(auLoin.material.color.r);
    // …et c'est bien l'exposition PAR SUJET qui est posée, teinte de visibilité comprise.
    expect(auFoyer.material.color.r).toBeCloseTo(billboardExposure({ x: 0, y: 0, z: 0 }, f.pool, LUM), 12);
    expect(auLoin.material.color.r).toBe(LUM); // hors de la flaque : l'exposition de la frame, à l'octet
  });

});

/**
 * LE BIAIS DE PROFONDEUR SOUS UNE CAMÉRA PERSPECTIVE (#1176, P3-1b — sonde du juge, promue). La
 * profondeur FENÊTRE d'une perspective n'est pas linéaire : un biais métrique constant y vaut
 * `near·far/d²` unités, pas `1/(far−near)`. La passe appelait la branche ORTHO pour TOUTE caméra —
 * au POV, la silhouette qui touche le sol ou un mur en était tranchée, faute de biais.
 */
const NEAR = 0.1;
const FAR = 4000; // le far par défaut de `povCamera` (`backends/webgl/cameras.ts`)
const PERSPECTIVE = new PerspectiveCamera(60, 4 / 3, NEAR, FAR);
PERSPECTIVE.updateMatrixWorld(true);

/** Un board dont le CENTRE de quad tombe à `distanceM` devant une caméra à l'origine (regard −z,
 *  quaternion identité : le quad monte de son `centerLiftM` le long de +y). */
function boardÀ(distanceM: number): Board {
  const b = board(new Vector3(0, -1.5, -distanceM));
  b.material.polygonOffset = true;
  return b;
}

describe('poseBoards — le biais de profondeur suit la DISTANCE en perspective (#1176 P3-1b)', () => {
  it('à 1 m, les unités sont celles de la branche PERSPECTIVE — jamais de l’ortho', () => {
    const b = boardÀ(1);
    poseBoards([b], PERSPECTIVE, flaques([]), TEINTE_PLEINE);
    expect(b.mesh.position.distanceTo(PERSPECTIVE.position), 'la sonde doit vraiment être à 1 m').toBeCloseTo(1, 9);
    expect(b.material.polygonOffsetUnits).toBeCloseTo(billboardDepthOffsetUnits(NEAR, FAR, 1), 6);
    // …et l'écart n'est pas cosmétique : la branche ortho vaut `near·far/d²` fois moins à cette
    // distance (0,1 × 4000 = 400 pour le far par défaut du POV).
    const ortho = billboardDepthOffsetUnits(NEAR, FAR);
    expect(b.material.polygonOffsetUnits / ortho).toBeCloseTo(NEAR * FAR, 6);
  });

  it('deux boards à des distances DIFFÉRENTES reçoivent des biais différents (par board, pas par frame)', () => {
    const près = boardÀ(1);
    const loin = boardÀ(4);
    poseBoards([près, loin], PERSPECTIVE, flaques([]), TEINTE_PLEINE);
    expect(loin.material.polygonOffsetUnits).toBeCloseTo(billboardDepthOffsetUnits(NEAR, FAR, 4), 6);
    // Loi en 1/d² : quatre fois plus loin, seize fois moins d'unités.
    expect(près.material.polygonOffsetUnits / loin.material.polygonOffsetUnits).toBeCloseTo(16, 6);
  });

  it('TÉMOIN ortho : la profondeur y est linéaire — une seule valeur pour toute la frame', () => {
    const près = boardÀ(1);
    const loin = boardÀ(40);
    poseBoards([près, loin], CAMERA, flaques([]), TEINTE_PLEINE);
    const attendu = billboardDepthOffsetUnits(CAMERA.near, CAMERA.far);
    expect(près.material.polygonOffsetUnits).toBeCloseTo(attendu, 12);
    expect(loin.material.polygonOffsetUnits).toBeCloseTo(attendu, 12);
  });
});

/**
 * LE BIAIS OBTENU EN TOUT POINT DE L'ÉCRAN (#1176, P3-1b — sonde B du juge, promue). La profondeur
 * FENÊTRE d'une perspective ne dépend QUE de `z_view` : un quad aligné écran est parallèle au plan
 * image, donc son `z_view` est constant sur toute sa surface, là où sa distance à l'œil croît vers les
 * bords du champ. Mesurer la distance rendait un biais de 0,185 m au coin de l'écran pour 0,300 m
 * demandés (56 % du biais visé, FOV_X 75°) — la silhouette y retombait dans la géométrie qu'elle
 * effleure, précisément là où le champ est le plus large.
 */
const AR = 16 / 9;
/** La caméra du POV telle que `povCamera` la fabrique : `FOV_X` horizontal, pixels carrés, far à 4000. */
const POV = new PerspectiveCamera((2 * Math.atan(Math.tan(FOV_X / 2) / AR) * 180) / Math.PI, AR, NEAR, FAR);
POV.position.set(0, 1.7, 0);
POV.updateMatrixWorld(true);

const TAN_X = Math.tan(FOV_X / 2);
const TAN_Y = TAN_X / AR;

/** Un board dont le CENTRE de quad tombe à la profondeur `d`, aux fractions d'écran `u`/`v` (±1 = le
 *  bord du champ). Le quad monte de son `centerLiftM` le long de +y : l'ancre en descend d'autant. */
function boardÉcran(d: number, u: number, v: number): Board {
  const b = board(new Vector3(u * TAN_X * d, 1.7 + v * TAN_Y * d - 1.5, -d));
  b.material.polygonOffset = true;
  return b;
}

/** Le biais MÉTRIQUE que les unités écrites valent RÉELLEMENT à la profondeur du quad : la marche de
 *  profondeur fenêtre obtenue, divisée par ce qu'un mètre y vaut. */
function biaisObtenuM(b: Board): number {
  const z = Math.abs(b.mesh.position.clone().applyMatrix4(POV.matrixWorldInverse).z);
  const parMetre = (NEAR * FAR) / ((FAR - NEAR) * z ** 2);
  return Math.abs(b.material.polygonOffsetUnits * 2 ** -DEPTH_BUFFER_BITS) / parMetre;
}

describe('poseBoards — le biais métrique tient EN TOUT POINT de l’écran (#1176 P3-1b)', () => {
  const POINTS: [string, number, number, number][] = [
    ['axe, 3 m', 3, 0, 0],
    ['bord droit, 3 m', 3, 0.98, 0],
    ['bord haut, 3 m', 3, 0, 0.98],
    ['coin, 3 m', 3, 0.98, 0.98],
    ['coin, 1 m', 1, 0.98, 0.98],
    ['coin, 12 m', 12, 0.98, 0.98],
  ];

  it('les six positions sont bien RÉPARTIES à l’écran (la sonde n’est pas vide)', () => {
    for (const [nom, d, u, v] of POINTS) {
      const b = boardÉcran(d, u, v);
      poseBoards([b], POV, flaques([]), TEINTE_PLEINE);
      const ndc = b.mesh.position.clone().project(POV);
      expect(ndc.x, `${nom} : abscisse écran`).toBeCloseTo(u, 6);
      expect(ndc.y, `${nom} : ordonnée écran`).toBeCloseTo(v, 6);
    }
  });

  it('le biais obtenu vaut 0,300 m à 1 % près, du centre au coin du champ', () => {
    for (const [nom, d, u, v] of POINTS) {
      const b = boardÉcran(d, u, v);
      poseBoards([b], POV, flaques([]), TEINTE_PLEINE);
      const obtenu = biaisObtenuM(b);
      expect(Math.abs(obtenu - BILLBOARD_DEPTH_BIAS_M) / BILLBOARD_DEPTH_BIAS_M, `${nom} : ${obtenu.toFixed(4)} m`).toBeLessThanOrEqual(0.01);
    }
  });

  it('la DISTANCE à l’œil n’est PAS la grandeur : au coin, elle dépasse la profondeur d’un tiers', () => {
    const b = boardÉcran(3, 0.98, 0.98);
    poseBoards([b], POV, flaques([]), TEINTE_PLEINE);
    const z = Math.abs(b.mesh.position.clone().applyMatrix4(POV.matrixWorldInverse).z);
    const d = POV.position.distanceTo(b.mesh.position);
    expect(d / z).toBeGreaterThan(1.3);
    // …et un biais pris sur la distance y perdrait ce facteur AU CARRÉ : le témoin de la mutation.
    expect(BILLBOARD_DEPTH_BIAS_M * (z / d) ** 2).toBeLessThan(0.19);
  });
});

/**
 * ANCRE DU QUAD À LA VERTICALE (#1176, P3-5c) — la sonde du juge, à travers la VRAIE `affineCamera` de
 * production, aux quatre crans de lacet et sous les deux regards de plateau.
 *
 * LA LOI : la montée d'un quad — une demi-hauteur de corps — se fait le long de la VERTICALE MONDE dès
 * que le haut d'écran de la caméra est COUCHÉ dans le plan du sol (`up.y` ≈ 0, le cas de la vue du
 * DESSUS). Portée par le haut d'écran, elle y serait une TRANSLATION HORIZONTALE : 0,767 case à `mpt`
 * 1,5 pour un sujet de 2,3 m, proportionnelle à sa taille et TOURNANT avec le lacet — c'est la mesure
 * du témoin ci-dessous. Sur le plateau iso, où le haut d'écran est debout, les deux coïncident.
 */
describe('boardCenter — le corps se lève à la VERTICALE quand le haut d’écran est couché (#1176 P3-5c)', () => {
  const MPT = 1.5;
  const VUE = { w: 1280, h: 720 };
  const ANCRE = new Vector3(4 * MPT, 0, 7 * MPT);
  const LIFT = 1.15; // demi-hauteur d'un sujet de 2,30 m
  const CRANS = [0, 90, 180, 270];
  const dHoriz = (p: Vector3) => Math.hypot(p.x - ANCRE.x, p.z - ANCRE.z);

  it('VUE DU DESSUS : le centre reste À L’APLOMB de l’ancre, à tous les crans, et monte du lift EXACT', () => {
    for (const yaw of CRANS) {
      const { camera } = affineCamera('top', yaw, MPT, VUE);
      // TÉMOIN : le haut d'écran de cette caméra est bien couché dans le plan du sol.
      const up = new Vector3(0, 1, 0).applyQuaternion(camera.quaternion);
      expect(Math.abs(up.y), `cran ${yaw}° : haut d’écran couché`).toBeLessThan(UP_ECRAN_COUCHE);
      const p = boardCenter(ANCRE, LIFT, camera.quaternion, new Vector3());
      expect(dHoriz(p), `cran ${yaw}° : aucun décalage horizontal`).toBeCloseTo(0, 12);
      expect(p.y - ANCRE.y, `cran ${yaw}° : la montée vaut le lift`).toBeCloseTo(LIFT, 12);
    }
  });

  it('TÉMOIN de la mutation : le haut d’écran, lui, décale de 0,767 case et TOURNE avec le lacet', () => {
    const decales = CRANS.map((yaw) => {
      const { camera } = affineCamera('top', yaw, MPT, VUE);
      return billboardPose(ANCRE, LIFT, camera.quaternion);
    });
    for (const p of decales) {
      expect(dHoriz(p) / MPT, 'décalage horizontal en cases').toBeCloseTo(LIFT / MPT, 6);
      expect(p.y - ANCRE.y, 'et rien du lift ne monte').toBeCloseTo(0, 12);
    }
    // …et il TOURNE : quatre crans, quatre points distincts autour de la même case.
    expect(new Set(decales.map((p) => `${p.x.toFixed(4)},${p.z.toFixed(4)}`)).size).toBe(4);
  });

  it('PLATEAU ISO : rien ne change — le quad monte le long du haut d’écran, arête basse sur l’ancre', () => {
    for (const yaw of CRANS) {
      const { camera } = affineCamera('iso', yaw, MPT, VUE);
      const up = new Vector3(0, 1, 0).applyQuaternion(camera.quaternion);
      expect(Math.abs(up.y), `cran ${yaw}° : haut d’écran DEBOUT`).toBeGreaterThan(UP_ECRAN_COUCHE);
      const p = boardCenter(ANCRE, LIFT, camera.quaternion, new Vector3());
      expect(p.distanceTo(billboardPose(ANCRE, LIFT, camera.quaternion)), `cran ${yaw}°`).toBeCloseTo(0, 12);
      expect(dHoriz(p), `cran ${yaw}° : et il avance bien dans le plan du sol`).toBeGreaterThan(0.1);
    }
  });

});

describe('forceSinglePass — un quad aligné écran n’a pas de face arrière à trier séparément', () => {
  it('billboardMaterial passe en une seule passe, deux faces', () => {
    const mat = billboardMaterial(new MeshBasicMaterial().map!, 1);
    expect(mat.forceSinglePass).toBe(true);
    expect(mat.side).toBe(DoubleSide);
    expect(mat.transparent).toBe(true);
  });
});

/**
 * LA TEINTE DE VISIBILITÉ est une valeur de FRAME (#1396) : elle se prend à la CASE du sujet, dans
 * cette passe, et elle module l'exposition du quad.
 */
describe('poseBoards — la teinte de la case module le quad (#1396)', () => {
  const CASE_SOMBRE: TintAt = () => 0.25;

  it('le quad s’atténue de la teinte de sa case, et la teinte REVIENT sans cumuler', () => {
    const b = board(new Vector3(10, 0, 10));
    poseBoards([b], CAMERA, flaques([]), TEINTE_PLEINE);
    expect(b.material.color.r).toBeCloseTo(LUM, 12);
    poseBoards([b], CAMERA, flaques([]), CASE_SOMBRE);
    expect(b.material.color.r).toBeCloseTo(LUM * 0.25, 12);
    poseBoards([b], CAMERA, flaques([]), TEINTE_PLEINE);
    expect(b.material.color.r).toBeCloseTo(LUM, 12);
  });
});
