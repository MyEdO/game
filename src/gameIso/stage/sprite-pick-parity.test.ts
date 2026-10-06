import { Mesh, MeshBasicMaterial, PlaneGeometry, Raycaster, Vector2, Vector3, type OrthographicCamera, type PerspectiveCamera } from 'three';
import { describe, expect, it } from 'vitest';
import { depth, projectOccluder, occludesActor, type Dims } from '../../geometry/iso';
import { metricToLift } from '../../state/relief';
import { emptyScene, sceneMetresPerTile, type Scene } from '../../state/scene';
import { makeShowcaseParty } from '../../data/pregens';
import type { Combatant } from '../../engine/types';
import { buildWalls } from '../builders/walls';
import { affineCamera, projectToScreen } from '../backends/webgl/cameras';
import { BILLBOARD_BOX_ASPECT, anchorAndSize, billboardHeightM } from '../backends/webgl/billboardMath';
import { actorBillboards, bakeWorldGeometry, billboardPose, type BillboardSubject } from '../backends/webgl/sceneMeshes';
import { ndcAt, pickNearestTarget, type PickTarget } from '../backends/webgl/spriteRaycast';
import { actorCapsuleOf } from './actorCapsule';
import { stage3dFraming } from './stage3dCamera';

/**
 * HIT-TEST DE SPRITE — CE QUE CHAQUE VOIE RÉPOND (#1176 lot P2-3, #1297 lot B).
 *
 * Les deux voies tranchent l'empilement AUTREMENT : la voie affine par son TRI DE PROFONDEUR (le
 * dernier peint reçoit l'`elementFromPoint` ; s'il ne porte pas de `data-cid`, il n'y a pas de jeton
 * sous le pixel), la voie volumique par la DISTANCE CAMÉRA d'un lancer de rayon, dont les cibles sont
 * les seuls QUADS : un jeton gagne la matière CUITE du monde (qui laisse passer sa silhouette), jamais
 * un sprite de DÉCOR touché avant lui. Cette garde épingle les DEUX verdicts sur les mêmes situations —
 * leurs accords comme leur divergence, jamais l'intuition de l'un pour l'autre.
 *
 * Les deux mesures sont prises des fonctions de PRODUCTION : côté affine `occludesActor` sur les
 * panneaux projetés (l'occultation écran-espace dont le stage se sert déjà) et les profondeurs `d`
 * qu'émettent les couches ; côté volumique le bake du monde (`bakeWorldGeometry`) et des quads posés
 * exactement comme `GameStage3D` les pose.
 */
const CANVAS = { w: 1280, h: 720 };
const CAM = { x: 0, y: 0 };
const ZOOM = 1;

type Camera = OrthographicCamera | PerspectiveCamera;

const dimsDe = (scene: Scene): Dims => ({ w: scene.dimensions.w, h: scene.dimensions.h, rot: 0, view: 'iso' });

function cameraVolumique(dims: Dims, mpt: number): Camera {
  const f = stage3dFraming({ dims, mpt, cam: CAM, zoom: ZOOM, canvas: CANVAS });
  return affineCamera(f.kind, f.yawDeg, mpt, f.viewport, {
    target: new Vector3(f.centre.x, f.centre.y, f.centre.z),
  }).camera;
}

/** Le quad d'un acteur, posé comme `GameStage3D` le pose : aligné écran, ancré aux pieds. */
function quadDe(sub: BillboardSubject, camera: Camera): Mesh {
  const heightM = billboardHeightM('jeu', sub.kind) * sub.scaleK;
  const quad = anchorAndSize(heightM, BILLBOARD_BOX_ASPECT);
  const mesh = new Mesh(new PlaneGeometry(quad.widthM, quad.heightM), new MeshBasicMaterial());
  mesh.quaternion.copy(camera.quaternion);
  mesh.position.copy(billboardPose(sub.anchor, quad.centerLiftM, camera.quaternion));
  mesh.updateMatrixWorld(true);
  return mesh;
}

/** Le verdict sur les seuls BILLBOARDS (aucun maillage monde) ramené à un id de combattant. */
const cidLePlusProche = (
  camera: OrthographicCamera | PerspectiveCamera,
  cibles: readonly PickTarget[],
  ndc: { x: number; y: number },
): string | null => {
  const visé = pickNearestTarget(camera, cibles, null, ndc);
  return visé?.kind === 'combatant' ? visé.id : null;
};

/** Sujet de billboard d'un combattant posé sur une case (le chemin de production `actorBillboards`). */
function sujet(scene: Scene, mpt: number, c: Combatant, x: number, y: number): BillboardSubject {
  const [s] = actorBillboards([{ c, x, y, z: 0 }], scene, mpt);
  expect(s, 'aucun sujet de billboard — le rig ne se résout pas').toBeTruthy();
  return s;
}

/** Le verdict VOLUMIQUE sous un point monde : l'id rendu par le rayon (`null` = rien de cliquable). */
function verdictVolumique(camera: Camera, cibles: readonly PickTarget[], pointMonde: Vector3): string | null {
  const p = projectToScreen(camera, pointMonde, CANVAS);
  return cidLePlusProche(camera, cibles, ndcAt({ x: p.sx, y: p.sy }, { w: CANVAS.w, h: CANVAS.h }));
}

/** L'obstacle (masse CUITE du monde ou quad de décor) intercepte-t-il le rayon AVANT le quad, au pixel
 *  visé ? (l'occultation VOLUMIQUE telle que la géométrie la produit — la mesure, indépendante du
 *  verdict de picking.) */
function intercepteAvantLeQuad(camera: Camera, obstacle: Mesh, quad: Mesh, pointMonde: Vector3): boolean {
  const p = projectToScreen(camera, pointMonde, CANVAS);
  const ndc = ndcAt({ x: p.sx, y: p.sy }, { w: CANVAS.w, h: CANVAS.h });
  const r = new Raycaster();
  r.setFromCamera(new Vector2(ndc.x, ndc.y), camera);
  const dQuad = r.intersectObject(quad, true)[0]?.distance ?? Infinity;
  return r.intersectObject(obstacle, true).some((i) => i.distance <= dQuad);
}

/**
 * SILHOUETTE À TRAVERS LES MURS (#1297, arbitrage produit du 2026-08-13). Le peintre affine n'en avait
 * pas : le mur qu'il posait PAR-DESSUS le jeton recevait l'`elementFromPoint`, ne portait aucun
 * `data-cid`, et le clic retombait sur la tuile de sol. Il est mort à C5a ; ce que la voie volumique
 * promet, elle, reste mesuré ici : le pixel où l'on VOIT le jeton rend son id, mur ou pas.
 */
describe('Un jeton derrière un mur qui le COUVRE — le volumique le rend quand même (#1297 lot B)', () => {
  const scene = emptyScene(3, 3);
  scene.walls = [{ x: 1, y: 1, side: 'N' }];
  const dims = dimsDe(scene);
  const mpt = sceneMetresPerTile(scene);
  const [hero] = makeShowcaseParty();

  it('PRÉMISSE écran-espace : le panneau couvre bien la capsule du jeton (sinon la garde ne mesure rien)', () => {
    const murs = buildWalls(scene, 'jeu');
    const capsule = actorCapsuleOf({ x: 0, y: 0, h: 0 }, dims);
    const panneau = projectOccluder(
      { polygons: murs[0].faces.map((face) => face.poly.map((p) => ({ x: p.x, y: p.y, lift: metricToLift(p.h) }))) },
      dims,
    );
    expect(occludesActor(panneau, capsule)).toBe(true);
  });

  it('VOLUMIQUE : la masse intercepte le rayon AVANT le jeton, et le jeton rend quand même son id', () => {
    const camera = cameraVolumique(dims, mpt);
    const baked = bakeWorldGeometry(scene, mpt, 'jeu');
    const monde = new Mesh(baked.geometry, new MeshBasicMaterial());
    monde.updateMatrixWorld(true);
    const sub = sujet(scene, mpt, hero, 0, 0);
    const quad = quadDe(sub, camera);
    // Prémisse : la géométrie occulte RÉELLEMENT le jeton à ce pixel (sinon la garde ne mesure rien).
    expect(intercepteAvantLeQuad(camera, monde, quad, quad.position)).toBe(true);
    // Le monde n'est pas inscrit comme cible (`GameStage3D`) : le verdict ne connaît que les quads.
    expect(verdictVolumique(camera, [{ cid: hero.id, object: quad }], quad.position)).toBe(hero.id);
  });
});

/**
 * LES QUATRE ARÊTES DE LA CASE DU JETON — la table complète, mesurée (#1176 P2-3, #1297 lot B).
 *
 * `murParDessus` est un ORACLE FIGÉ : il valait, à l'origine, le verdict du peintre AFFINE — l'invariant
 * « jeton > mur » (offset de jeton +0,5 contre +0,45 au mur) ne jouait que pour les murs dont
 * `wallDepth` prend pour base la case DU JETON, les arêtes N et O ; aux arêtes S et E le mur se peignait
 * APRÈS le jeton et le clic retombait sur la tuile. Ce peintre est mort à C5a, la table reste : ce sont
 * EXACTEMENT les arêtes que la géométrie volumique met devant le jeton, et sur lesquelles la silhouette
 * (#1297) répond là où l'affine se taisait.
 */
describe('Les QUATRE arêtes de la case du jeton (#1176 P2-3, #1297 lot B)', () => {
  const [hero] = makeShowcaseParty();
  const ARETES = [
    { nom: 'N', seg: { x: 1, y: 1, side: 'N' as const }, murParDessus: false },
    { nom: 'O', seg: { x: 0, y: 1, side: 'E' as const }, murParDessus: false },
    { nom: 'S', seg: { x: 1, y: 2, side: 'N' as const }, murParDessus: true },
    { nom: 'E', seg: { x: 1, y: 1, side: 'E' as const }, murParDessus: true },
  ];

  for (const arete of ARETES) {
    const scene = emptyScene(3, 3);
    scene.walls = [arete.seg];
    const dims = dimsDe(scene);
    const mpt = sceneMetresPerTile(scene);

    it(`arête ${arete.nom} — VOLUMIQUE : la masse ${arete.murParDessus ? 'intercepte' : 'n’intercepte pas'} le rayon, et l’id est rendu`, () => {
      const camera = cameraVolumique(dims, mpt);
      const monde = new Mesh(bakeWorldGeometry(scene, mpt, 'jeu').geometry, new MeshBasicMaterial());
      monde.updateMatrixWorld(true);
      const quad = quadDe(sujet(scene, mpt, hero, 1, 1), camera);
      expect(intercepteAvantLeQuad(camera, monde, quad, quad.position)).toBe(arete.murParDessus);
      // Le monde n'est PAS une cible du picking : occulté ou non, le jeton rend son id.
      expect(verdictVolumique(camera, [{ cid: hero.id, object: quad }], quad.position)).toBe(hero.id);
    });
  }
});

describe('Deux jetons qui se CHEVAUCHENT — même vainqueur des deux côtés (#1176 P2-3)', () => {
  const scene = emptyScene(6, 6);
  const dims = dimsDe(scene);
  const mpt = sceneMetresPerTile(scene);
  const [a, b] = makeShowcaseParty();
  const POSE_A = { x: 2, y: 2 };
  const POSE_B = { x: 3, y: 3 }; // juste DEVANT A à l'écran (même colonne, une rangée de profondeur en plus)

  it('PRÉMISSE : B est bien le plus PROFOND des deux à l’écran (le témoin de la situation mesurée)', () => {
    expect(depth(POSE_B.x, POSE_B.y, dims, 0)).toBeGreaterThan(depth(POSE_A.x, POSE_A.y, dims, 0));
  });

  it('VOLUMIQUE : le quad le plus PROCHE de la caméra gagne — le même jeton, et l’ordre du tableau n’y fait rien', () => {
    const camera = cameraVolumique(dims, mpt);
    const qa = quadDe(sujet(scene, mpt, a, POSE_A.x, POSE_A.y), camera);
    const qb = quadDe(sujet(scene, mpt, b, POSE_B.x, POSE_B.y), camera);
    // MI-CHEMIN des deux quads : le pixel où ils se recouvrent (B est décalé d'une rangée de
    // profondeur, soit moins que la hauteur d'un corps — leurs boîtes se chevauchent largement).
    const milieu = qa.position.clone().add(qb.position).multiplyScalar(0.5);
    const p = projectToScreen(camera, milieu, CANVAS);
    const ndc = ndcAt({ x: p.sx, y: p.sy }, { w: CANVAS.w, h: CANVAS.h });
    // Prémisse : les deux quads sont bien touchés à ce pixel (sinon la garde ne mesurerait rien).
    expect(cidLePlusProche(camera, [{ cid: a.id, object: qa }], ndc)).toBe(a.id);
    expect(cidLePlusProche(camera, [{ cid: b.id, object: qb }], ndc)).toBe(b.id);
    // …et le verdict ne dépend que de la DISTANCE : les deux ordres de tableau donnent B.
    expect(cidLePlusProche(camera, [{ cid: a.id, object: qa }, { cid: b.id, object: qb }], ndc)).toBe(b.id);
    expect(cidLePlusProche(camera, [{ cid: b.id, object: qb }, { cid: a.id, object: qa }], ndc)).toBe(b.id);
  });
});

/**
 * DIVERGENCE MESURÉE ET ASSUMÉE (P2-3) : le rayon touche la BOÎTE du billboard, pas le tracé du corps.
 * Le hit-test natif du SVG, lui, suit la géométrie remplie — un clic dans le vide d'un sprite traverse
 * jusqu'au sol. La voie volumique est donc plus « collante » d'une demi-boîte autour du sujet. Lever
 * l'écart demande de lire l'alpha de la texture à l'UV touché (rasterisation en cache) : hors de ce lot.
 */
describe('Coin de la boîte d’un billboard — la voie volumique y répond ENCORE (écart assumé)', () => {
  it('un point du COIN du quad, hors du corps dessiné, rend quand même l’id', () => {
    const scene = emptyScene(6, 6);
    const dims = dimsDe(scene);
    const mpt = sceneMetresPerTile(scene);
    const [hero] = makeShowcaseParty();
    const camera = cameraVolumique(dims, mpt);
    const sub = sujet(scene, mpt, hero, 2, 2);
    const quad = quadDe(sub, camera);
    const heightM = billboardHeightM('jeu', sub.kind) * sub.scaleK;
    const { widthM } = anchorAndSize(heightM, BILLBOARD_BOX_ASPECT);
    // Coin haut-droit de la boîte, à 1 % du bord : le corps d'un rig n'y peint rien.
    const droite = new Vector3(1, 0, 0).applyQuaternion(camera.quaternion).multiplyScalar(widthM * 0.49);
    const haut = new Vector3(0, 1, 0).applyQuaternion(camera.quaternion).multiplyScalar(heightM * 0.49);
    const coin = quad.position.clone().add(droite).add(haut);
    expect(verdictVolumique(camera, [{ cid: hero.id, object: quad }], coin)).toBe(hero.id);
  });
});

/**
 * ÉGALITÉ EXACTE DE DISTANCE — le cas où la distance caméra ne tranche plus rien : deux jetons posés
 * sur la MÊME case y ont des quads COPLANAIRES (même ancre aux pieds, même orientation écran), donc
 * touchés au même millimètre par le rayon. Le verdict doit alors rester le même quel que soit l'ordre
 * du tableau de cibles — c'est ce que promet le JSDoc de `pickNearestTarget`, et ce que son départage
 * (l'id lexicographique entre candidats nommés) rend vrai.
 */
describe('Cibles à distance ÉGALE — le verdict ne dépend pas de l’ordre du tableau (#1176 P2-3)', () => {
  const scene = emptyScene(6, 6);
  const dims = dimsDe(scene);
  const mpt = sceneMetresPerTile(scene);
  const [a, b] = makeShowcaseParty();
  const camera = cameraVolumique(dims, mpt);
  const suba = sujet(scene, mpt, a, 2, 2);
  const subb = sujet(scene, mpt, b, 2, 2);
  const qa = quadDe(suba, camera);
  const qb = quadDe(subb, camera);
  /** Juste au-dessus de l'ancre partagée : un point que les DEUX boîtes contiennent. */
  const vise = new Vector3(suba.anchor.x, suba.anchor.y, suba.anchor.z).add(
    new Vector3(0, 1, 0).applyQuaternion(camera.quaternion).multiplyScalar(0.2),
  );
  const p = projectToScreen(camera, vise, CANVAS);
  const ndc = ndcAt({ x: p.sx, y: p.sy }, { w: CANVAS.w, h: CANVAS.h });

  it('prémisse : les deux quads sont COPLANAIRES et touchés au même pixel', () => {
    expect(suba.anchor).toEqual(subb.anchor);
    expect(cidLePlusProche(camera, [{ cid: a.id, object: qa }], ndc)).toBe(a.id);
    expect(cidLePlusProche(camera, [{ cid: b.id, object: qb }], ndc)).toBe(b.id);
  });

  it('deux JETONS : le même id dans les deux ordres — le plus petit id, arbitraire mais STABLE', () => {
    const ca: PickTarget = { cid: a.id, object: qa };
    const cb: PickTarget = { cid: b.id, object: qb };
    expect(cidLePlusProche(camera, [ca, cb], ndc)).toBe(cidLePlusProche(camera, [cb, ca], ndc));
    expect(cidLePlusProche(camera, [ca, cb], ndc)).toBe([a.id, b.id].sort()[0]);
  });

  it('un JETON et un DÉCOR coplanaires : le jeton rend son id dans les deux ordres (#1297 lot B)', () => {
    // Décor SYNTHÉTIQUE : un quad posé exactement dans le plan du jeton — la seule façon de fabriquer
    // l'égalité EXACTE de distance qu'une scène ne produit qu'au hasard d'une coïncidence.
    const masse: PickTarget = { cid: null, object: quadDe(suba, camera) };
    const jeton: PickTarget = { cid: a.id, object: qa };
    expect(cidLePlusProche(camera, [jeton, masse], ndc)).toBe(a.id);
    expect(cidLePlusProche(camera, [masse, jeton], ndc)).toBe(a.id);
  });
});

/**
 * OCCULTATION SPRITE-CONTRE-SPRITE (#1297, correctif du juge du cumul) : un billboard de DÉCOR est une
 * cible du rayon SANS id. Il ne rend jamais d'id, mais touché le premier il rend le verdict `null` —
 * ce qui cache un corps le rend inatteignable, et le clic retombe sur la tuile. Seule la matière CUITE
 * du monde laisse passer le clic, parce qu'elle laisse passer la SILHOUETTE.
 */
describe('Un jeton derrière un billboard de DÉCOR — le clic retombe sur la tuile (#1297)', () => {
  const scene = emptyScene(6, 6);
  const dims = dimsDe(scene);
  const mpt = sceneMetresPerTile(scene);
  const [hero] = makeShowcaseParty();
  const camera = cameraVolumique(dims, mpt);
  const quad = quadDe(sujet(scene, mpt, hero, 2, 2), camera);
  const jeton: PickTarget = { cid: hero.id, object: quad };

  /** Un quad de décor sur le même rayon, décalé de `m` mètres le long de l'axe de vue (positif = vers
   *  la caméra). Le décor porte `cid: null`, comme les props que `GameStage3D` inscrit. */
  function decor(m: number): PickTarget {
    const d = quadDe(sujet(scene, mpt, hero, 2, 2), camera);
    d.position.add(new Vector3(0, 0, 1).applyQuaternion(camera.quaternion).multiplyScalar(m));
    d.updateMatrixWorld(true);
    return { cid: null, object: d };
  }

  it('prémisse : sans décor, le pixel rend l’id du jeton', () => {
    expect(verdictVolumique(camera, [jeton], quad.position)).toBe(hero.id);
  });

  it('décor DEVANT : il intercepte le rayon avant le jeton, et le verdict est `null` dans les deux ordres', () => {
    const d = decor(1);
    expect(intercepteAvantLeQuad(camera, d.object as Mesh, quad, quad.position)).toBe(true);
    expect(verdictVolumique(camera, [d, jeton], quad.position)).toBeNull();
    expect(verdictVolumique(camera, [jeton, d], quad.position)).toBeNull();
  });

  it('décor DERRIÈRE : il ne dispute rien — l’id du jeton est rendu', () => {
    const d = decor(-1);
    expect(intercepteAvantLeQuad(camera, d.object as Mesh, quad, quad.position)).toBe(false);
    expect(verdictVolumique(camera, [d, jeton], quad.position)).toBe(hero.id);
    expect(verdictVolumique(camera, [jeton, d], quad.position)).toBe(hero.id);
  });
});
