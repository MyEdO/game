// @vitest-environment jsdom
import { act, useRef } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { Vector3, type OrthographicCamera, type PerspectiveCamera } from 'three';
import { afterEach, describe, expect, it } from 'vitest';
import type { Dims } from '../../geometry/iso';
import { METRES_PER_LEVEL, metricToLift } from '../../state/relief';
import { emptyScene, heightAt, isWalkable, sceneMetresPerTile, type Scene } from '../../state/scene';
import { buildScene, type MapSpec } from '../../state/mapSpec';
import { chebyshev } from '../../engine/grid';
import { walkNeighbors, type Pt } from '../../state/path';
import { useGame } from '../../state/store';
import { scenario as pont } from '../../scenes/test-scenarios/pont-vitrine';
import { scenario as siege } from '../../scenes/test-scenarios/siege-explore';
import { affineCamera, projectToScreen } from '../backends/webgl/cameras';
import { poseFromDims, screenToWorldAtLift } from './projection';
import { stagePointAt, viewBoxPointAt } from './stageCam';
import { stage3dFraming } from './stage3dCamera';
import { useStagePointer, type StagePointer } from './useStagePointer';
import { setSpritePicker, setStageFrame, type CadreRendu } from './spritePicker';
import { pickTileAt } from './pickProbe';
import { caseAuSol, type Verdict } from './pickResolve';
import type { PickProbe } from '../../state/devtools';
import { buildPropVolumes, type AncrageVolume } from '../builders/propVolumes';
import { findPropById, props, refEstVolumique } from '../../data';
import { capVolumique, polygonesDePrimitive, type PropData } from '../../data/props.types';
import type { SceneEntity } from '../../state/scene';

/**
 * PARITÉ DU PICKING DE TUILE ENTRE LES DEUX VOIES (#1176, lot P2-3).
 *
 * Le pointeur n'a qu'un chemin : il inverse la projection du STAGE (`stage/projection.ts` +
 * `stage/stageCam.ts`). Ce que cette garde mesure, c'est que ce chemin unique désigne la case que la
 * voie VOLUMIQUE dessine sous le pixel. Les deux côtés de l'égalité sont donc calculés par des
 * projections DIFFÉRENTES : à droite le hook complet (`onPointerMove` → `hover`) ; à gauche la caméra
 * three elle-même (`stage3dFraming` → `affineCamera`), inversée ici par résolution du système affine
 * qu'elle applique, à chacune des hauteurs de relief de la carte. La RÈGLE, elle, est la même des deux
 * côtés — celle du rendu : parmi les surfaces marchables dessinées sous le pixel, LA PLUS HAUTE gagne,
 * c'est celle qu'on voit (cf. `stage/pickResolve.ts:caseMarchable`).
 *
 * L'échantillonnage couvre ce que le relief a de piégeux : les trois marches d'un mètre et l'étage 1
 * de la carte-FIXTURE (ci-dessous), rampes et tablier du pont, les remparts du siège, et les cases au
 * bord du vide. Chaque case est visée en son centre, puis à 0,35 px du bord de son losange — un
 * demi-pixel d'écart entre les deux voies y change de case.
 *
 * L'état de caméra n'est pas neutre exprès (décalage manuel, zoom, cadre plus large que le viewBox) :
 * les deux étages de `stageCam` — recouvrement `slice` et caméra du groupe — doivent s'inverser tous
 * les deux.
 */
const CANVAS = { w: 1600, h: 900 };
const CAM = { x: 137, y: -62 };
const ZOOM = 1.3;
/** Retrait depuis le bord du losange, en pixels d'écran. Un demi-pixel de décalage le franchit. */
const AU_BORD = 0.35;
/** Écart LATÉRAL de l'échantillon de bord : il quitte la frontière exacte sans quitter la case. */
const DE_COTE = 0.17;

const dimsDe = (scene: Scene): Dims => ({ w: scene.dimensions.w, h: scene.dimensions.h, rot: 0, view: 'iso' });

/** Le cadre que l'hôte PUBLIE : projection commise + caméra RENDUE (un lecteur, comme `camRef`) + zoom. */
const cadreRendu = (dims: Dims, cam: { x: number; y: number } = CAM, zoom = ZOOM): CadreRendu =>
  ({ dims, camRendue: () => cam, zoom, aretes: () => [] });

type Camera = OrthographicCamera | PerspectiveCamera;

/** La caméra VOLUMIQUE cadrée depuis l'état de stage de cette garde. */
function cameraVolumique(dims: Dims, mpt: number): Camera {
  const f = stage3dFraming({ dims, mpt, cam: CAM, zoom: ZOOM, canvas: CANVAS });
  return affineCamera(f.kind, f.yawDeg, mpt, f.viewport, {
    target: new Vector3(f.centre.x, f.centre.y, f.centre.z),
  }).camera;
}

/** Pixel de l'élément où la voie VOLUMIQUE pose le sol d'une case, à la hauteur métrique `hM`. */
function pixelVolumique(camera: Camera, mpt: number, x: number, y: number, hM: number): { sx: number; sy: number } {
  return projectToScreen(camera, new Vector3(x * mpt, hM, y * mpt), CANVAS);
}

/** Inverse de la projection volumique à hauteur FIXE : le point de grille CONTINU dessiné sous le
 *  pixel. La projection y est affine en (x,y) — deux vecteurs de base suffisent à la retourner, et rien
 *  de l'affine du stage n'entre dans ce calcul. */
function grilleVolumique(camera: Camera, mpt: number, p: { sx: number; sy: number }, hM: number): { x: number; y: number } {
  const o = pixelVolumique(camera, mpt, 0, 0, hM);
  const ex = pixelVolumique(camera, mpt, 1, 0, hM);
  const ey = pixelVolumique(camera, mpt, 0, 1, hM);
  const a = ex.sx - o.sx, b = ey.sx - o.sx;
  const c = ex.sy - o.sy, d = ey.sy - o.sy;
  const det = a * d - b * c;
  const u = p.sx - o.sx, v = p.sy - o.sy;
  return { x: (u * d - v * b) / det, y: (a * v - c * u) / det };
}

/* ── LA CARTE-FIXTURE DE CE BANC ──────────────────────────────────────────────────────────────────
 * Un banc se joue sur une carte CRÉÉE POUR LUI, jamais sur une carte que l'auteur édite
 * (`.claude/memory/user-arbitrage-tests-sur-scenes-dediees-jamais-sur-scenes-utilisees.md`, 2026-09-07) :
 * éditer une carte de campagne ne rougit aucun test d'ici. La fixture est de la donnée d'AUTHORING (`buildScene`) et
 * pose exactement les pièges que les contrats de ce fichier mesurent : trois marches d'un mètre sur
 * l'étage 0 (plusieurs hauteurs de relief à inverser), un étage 1 marchable, un meuble HAUT dont le
 * pixel du dessus tombe sur la case d'un AUTRE décor, et un décor à plateau FIN dont le repli
 * cross-couche rend une case de l'étage du dessus. Les deux types de décor se CHOISISSENT dans le
 * catalogue par leur géométrie mesurée, et les cases piégées se MESURENT sur la projection. */

/** Sommet MONDE d'un décor posé, dérivé de ses faces réelles (aucune relecture de recette). */
function sommetDuDecor(prop: PropData, ancrage: AncrageVolume, mpt: number): number {
  return Math.max(...buildPropVolumes(prop, ancrage, mpt).flatMap((f) => f.poly.map((p) => p.h)));
}

/** Épaisseur (mètres) de la tranche qui PORTE le dessus d'un type de décor — un plateau FIN n'offre
 *  au rayon qu'une tranche, et c'est alors la case DESSINÉE qui décide. Mesurée sur la géométrie
 *  locale du catalogue, métrique en hauteur comme les faces monde. */
function epaisseurDuDessus(prop: PropData): number {
  const tranches = (prop.volume?.primitives ?? []).map((p) => {
    const hs = polygonesDePrimitive(p).flat().map((s) => s.hM);
    return { haut: Math.max(...hs), bas: Math.min(...hs) };
  });
  const sommet = Math.max(...tranches.map((t) => t.haut));
  return Math.min(...tranches.filter((t) => t.haut === sommet).map((t) => t.haut - t.bas));
}

/** Étage 0 : trois marches d'un mètre (`1`/`2`/`3`, hauteurs posées par `elevate`), le reste à plat. */
const MARCHES = String.raw`
..............
..............
..123.........
..123.........
..123.........
..............
..............
..............
..............
..............
..............
..............
..............
..............
`;

/** Étage 1 : vide partout — son plateau est posé en COORDONNÉES, à la case que la mesure désigne. */
const SANS_ETAGE = String.raw`
..............
..............
..............
..............
..............
..............
..............
..............
..............
..............
..............
..............
..............
..............
`;

/** La spec d'authoring de la fixture, jouée DEUX fois : une première pour mesurer sa projection, la
 *  seconde avec les poses que cette mesure désigne. */
const specFixture = (pose: Partial<MapSpec>): MapSpec => ({
  id: 'pick-parity-fixture',
  label: 'Fixture du banc de picking',
  size: [14, 14],
  levels: { z0: MARCHES, z1: SANS_ETAGE },
  legend: { '1': 'pierre', '2': 'pierre', '3': 'pierre' },
  elevate: { '1': 1, '2': 2, '3': 3 },
  heroStart: [0, 0],
  ...pose,
});

const SOCLE = buildScene(specFixture({}));
const DIMS_FIXTURE = dimsDe(SOCLE);
const MPT_FIXTURE = sceneMetresPerTile(SOCLE);
const CAMERA_FIXTURE = cameraVolumique(DIMS_FIXTURE, MPT_FIXTURE);

/** La case que l'inversion du STAGE au lift `lift` rend pour le pixel volumique du point (`ancre`,
 *  `hM`) : la mesure qui place les pièges de la fixture, jamais une coordonnée devinée. */
function caseInverseeAuLift(ancre: Pt, hM: number, lift: number): Pt {
  const px = pixelVolumique(CAMERA_FIXTURE, MPT_FIXTURE, ancre.x, ancre.y, hM);
  const g = stagePointAt(viewBoxPointAt({ sx: px.sx, sy: px.sy }, CANVAS), CAM, ZOOM);
  const p = screenToWorldAtLift(poseFromDims(DIMS_FIXTURE), g, lift);
  return { x: Math.round(p.x), y: Math.round(p.y) };
}

/** L'ancrage NEUTRE d'un type de décor — l'origine, cap `S`, pied au sol : ce que le catalogue seul
 *  décide, avant toute pose dans une scène. */
const ANCRAGE_A_PLAT: AncrageVolume = { ancre: { x: 0, y: 0 }, facing: 'S', baseHeightM: 0 };

/** La case que le pixel du DESSUS d'un type de décor désigne quand on l'inverse au lift du SOL. */
const caseDuDessus = (prop: PropData, ancre: Pt): Pt =>
  caseInverseeAuLift(ancre, sommetDuDecor(prop, { ...ANCRAGE_A_PLAT, ancre }, MPT_FIXTURE), 0);

/** Cases d'ANCRAGE des décors de la fixture : hors de l'escalier, et assez loin des bords pour que
 *  les cases mesurées autour d'elles restent sur la carte. */
const POSE_HAUTE: Pt = { x: 9, y: 5 };
const POSE_FINE: Pt = { x: 4, y: 7 };

const VOLUMIQUES = props.filter((p) => refEstVolumique(p.id));

/** MEUBLE HAUT — le décor le plus HAUT du catalogue dont le DESSUS, inversé au lift du SOL, désigne
 *  la case VOISINE : c'est ce décalage d'un pas que le rayon doit trancher, et la fixture pose l'autre
 *  décor sur la case ainsi mesurée. */
const MEUBLE_HAUT = VOLUMIQUES
  .filter((p) => chebyshev(POSE_HAUTE, caseDuDessus(p, POSE_HAUTE)) === 1)
  .sort((a, b) => sommetDuDecor(b, ANCRAGE_A_PLAT, MPT_FIXTURE) - sommetDuDecor(a, ANCRAGE_A_PLAT, MPT_FIXTURE))[0];

/** PLATEAU FIN — le dessus le plus MINCE du catalogue parmi les décors qui ne décalent AUCUNE case :
 *  rien que le rayon puisse toucher, et aucun décalage du dessus pour masquer le repli cross-couche. */
const PLATEAU_FIN = VOLUMIQUES
  .filter((p) => chebyshev(POSE_FINE, caseDuDessus(p, POSE_FINE)) === 0)
  .sort((a, b) => epaisseurDuDessus(a) - epaisseurDuDessus(b))[0];

const MEUBLE_HAUT_ID = 'fixture-meuble-haut';
const VOISIN_ID = 'fixture-voisin-du-dessus';
const PLATEAU_FIN_ID = 'fixture-plateau-fin';

/** Le plateau de l'ÉTAGE 1, posé à la case que le repli cross-couche désigne depuis le pixel du sol
 *  du décor à plateau fin — c'est la géométrie qui décide de l'endroit, pas l'inverse. */
const CASE_ETAGE = caseInverseeAuLift(POSE_FINE, heightAt(SOCLE, POSE_FINE.x, POSE_FINE.y, 0), 1);
/** Une case de marge autour d'elle. Les deux specs d'authoring ne disent pas une aire de la même
 *  façon : `terrainRects` prend un COIN et une taille, `relief` une BOÎTE inclusive (`applyRelief`). */
const COTE_PLATEAU = 3;
const PLATEAU_COIN: [number, number, number, number] = [CASE_ETAGE.x - 1, CASE_ETAGE.y - 1, COTE_PLATEAU, COTE_PLATEAU];
const PLATEAU_BOITE: [number, number, number, number] = [CASE_ETAGE.x - 1, CASE_ETAGE.y - 1, CASE_ETAGE.x + 1, CASE_ETAGE.y + 1];

const FIXTURE = buildScene(specFixture({
  entities: [
    { id: MEUBLE_HAUT_ID, kind: 'prop', ref: MEUBLE_HAUT.id, pos: POSE_HAUTE, facing: 'S' },
    { id: VOISIN_ID, kind: 'prop', ref: PLATEAU_FIN.id, pos: caseDuDessus(MEUBLE_HAUT, POSE_HAUTE), facing: 'S' },
    { id: PLATEAU_FIN_ID, kind: 'prop', ref: PLATEAU_FIN.id, pos: POSE_FINE, facing: 'S' },
  ],
  terrainRects: [{ rect: PLATEAU_COIN, terrain: 'planches', z: 1 }],
  // Le plancher de l'étage est à UN niveau d'écran : le lift auquel le repli cross-couche inverse la couche 1.
  relief: [{ rect: PLATEAU_BOITE, height: METRES_PER_LEVEL, z: 1 }],
}));

/** Les étages que la fixture porte, et que le banc parcourt. */
const ETAGES_FIXTURE = [0, 1];

/** Hauteurs métriques DISTINCTES auxquelles une case de cet étage peut être dessinée, décroissantes. */
function hauteurs(scene: Scene, z: number): number[] {
  const hs = new Set<number>([0]);
  for (let y = 0; y < scene.dimensions.h; y++) {
    for (let x = 0; x < scene.dimensions.w; x++) if (isWalkable(scene, x, y, z)) hs.add(heightAt(scene, x, y, z));
  }
  return [...hs].sort((p, q) => q - p);
}

/** Case MARCHABLE que la voie volumique dessine sous le pixel — la plus HAUTE gagne, c'est celle qu'on
 *  voit. `null` si aucune surface de cet étage n'y est dessinée. */
function caseVueVolumique(scene: Scene, camera: Camera, mpt: number, z: number, p: { sx: number; sy: number }): Pt | null {
  const { w, h } = scene.dimensions;
  for (const hM of hauteurs(scene, z)) {
    const g = grilleVolumique(camera, mpt, p, hM);
    const x = Math.round(g.x), y = Math.round(g.y);
    if (x < 0 || y < 0 || x >= w || y >= h) continue;
    if (!isWalkable(scene, x, y, z)) continue;
    if (heightAt(scene, x, y, z) !== hM) continue; // cette case n'est pas dessinée à cette hauteur
    return z ? { x, y, z } : { x, y };
  }
  return null;
}

/** Élément de stage MESURÉ (cadre `CANVAS` au coin (0,0)) : le picking inverse une GÉOMÉTRIE
 *  d'élément, pas un CTM de SVG — la voie volumique peint sur un canevas, qui n'en a pas. */
function stageEl(): SVGSVGElement {
  return {
    getBoundingClientRect: () => ({ left: 0, top: 0, width: CANVAS.w, height: CANVAS.h }) as DOMRect,
    setPointerCapture: () => undefined,
    releasePointerCapture: () => undefined,
  } as unknown as SVGSVGElement;
}

function moveEvent(sx: number, sy: number) {
  return { button: 0, clientX: sx, clientY: sy, pointerId: 1, currentTarget: { style: {} } } as unknown as React.PointerEvent;
}

let root: Root | null = null;

afterEach(() => {
  setSpritePicker(null);
  document.querySelectorAll('svg.iso-stage').forEach((el) => el.remove());
  setStageFrame(null);
  if (root) {
    act(() => root!.unmount());
    root = null;
  }
});

/** Monte l'élément de stage que la sonde cherche dans le DOM (`svg.iso-stage`), mesuré au cadre de ce
 *  banc, et PUBLIE le cadre rendu qu'elle lit. Le démontage est celui du fichier (`afterEach`). */
function monterStage(cadre: CadreRendu): SVGSVGElement {
  const el = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  el.setAttribute('class', 'iso-stage');
  el.getBoundingClientRect = () => ({ left: 0, top: 0, width: CANVAS.w, height: CANVAS.h }) as DOMRect;
  document.body.appendChild(el);
  setStageFrame(cadre);
  return el;
}

/** Monte le pointeur sur une scène, à l'étage `activeZ`, et rend « viser un pixel → la case survolée ». */
function viseur(scene: Scene, activeZ: number, partyPos: Pt, cadre?: Dims): (sx: number, sy: number) => Pt | null {
  const dims = cadre ?? dimsDe(scene);
  useGame.setState({ scene, mode: 'exploration', partyPos, party: [], battle: null, dialogue: null });
  let pointer: StagePointer | undefined;
  const Probe = () => {
    const svgRef = useRef(stageEl());
    const camRef = useRef(CAM);
    pointer = useStagePointer({
      svgRef, dims, zoom: ZOOM, camRef, hoverTracking: false, partyLeader: undefined, activeZ, aretes: [],
    });
    return null;
  };
  const container = document.createElement('div');
  root = createRoot(container);
  act(() => root!.render(<Probe />));
  return (sx, sy) => {
    act(() => pointer!.handlers.onPointerMove(moveEvent(sx, sy)));
    return pointer!.hover;
  };
}

/** Cases marchables de l'étage, réparties, avec les SOULEVÉES d'abord (rampes, marches, tabliers,
 *  chemins de ronde) — c'est là que l'inversion à plat se trompait de case. */
function echantillon(scene: Scene, z: number, combien: number): Pt[] {
  const hautes: Pt[] = [], plates: Pt[] = [];
  const { w, h } = scene.dimensions;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!isWalkable(scene, x, y, z)) continue;
      (metricToLift(heightAt(scene, x, y, z)) > 0 ? hautes : plates).push(z ? { x, y, z } : { x, y });
    }
  }
  const etaler = (l: Pt[]) => {
    const pas = Math.max(1, Math.floor(l.length / combien));
    return l.filter((_, i) => i % pas === 0).slice(0, combien);
  };
  return [...etaler(hautes), ...etaler(plates)];
}

/** Point de départ du groupe qui ne CHANGE PAS d'étage d'un pas : le pas inter-étages
 *  (`stage/pickResolve.ts:pasInterEtages`) a sa propre garde (`useStagePointer.test.tsx`) et n'a rien
 *  à faire ici. */
function posteDuGroupe(scene: Scene, z: number, defaut: Pt): Pt {
  for (let y = 0; y < scene.dimensions.h; y++) {
    for (let x = 0; x < scene.dimensions.w; x++) {
      if (!isWalkable(scene, x, y, z)) continue;
      const p: Pt = z ? { x, y, z } : { x, y };
      if (!walkNeighbors(scene, p).some((n) => (n.z ?? 0) !== z)) return p;
    }
  }
  return defaut;
}

const CARTES: { nom: string; scene: Scene; etages: number[] }[] = [
  { nom: 'fixture', scene: FIXTURE, etages: ETAGES_FIXTURE },
  { nom: 'pont-vitrine', scene: pont.scene as Scene, etages: [0, 1] },
  { nom: 'siege-enceinte', scene: siege.scene as Scene, etages: [0] },
];

/**
 * CE QUE LA FIXTURE POSE — hors de la boucle des cartes, donc INSENSIBLE à ce que cette boucle
 * parcourt : une carte retirée de `CARTES` fait disparaître ses `it` sans un seul rouge, et ce
 * describe est l'endroit où cela se voit. Il mesure sur la fixture ce dont les contrats de ce fichier
 * ont besoin pour départager quoi que ce soit.
 */
describe('la carte-FIXTURE porte les pièges que ces contrats mesurent', () => {
  it('étage 0 : un escalier — plusieurs hauteurs de relief, et des cases SOULEVÉES dans l’échantillon', () => {
    expect(hauteurs(FIXTURE, 0).length, 'une seule hauteur n’inverse qu’un plan').toBeGreaterThan(1);
    const soulevees = echantillon(FIXTURE, 0, 8).filter((t) => metricToLift(heightAt(FIXTURE, t.x, t.y, 0)) > 0);
    expect(soulevees.length, 'l’échantillon met les cases soulevées d’abord').toBeGreaterThan(0);
  });

  it('chaque étage offre au moins quatre cases à viser — aucun étage de ce banc ne tourne à vide', () => {
    for (const z of ETAGES_FIXTURE) expect(echantillon(FIXTURE, z, 8).length, `étage ${z}`).toBeGreaterThanOrEqual(4);
  });

  it('et la boucle de parité la PARCOURT, sur ses deux étages', () => {
    expect(CARTES.find((c) => c.scene === FIXTURE)?.etages, 'hors de `CARTES`, la fixture perd ses `it` sans un seul rouge').toEqual(ETAGES_FIXTURE);
  });

  it('l’étage 1 est marchable, et c’est le repli cross-couche du décor à plateau fin qui l’a placé', () => {
    expect(hauteurs(FIXTURE, 1), 'le plancher de l’étage est posé à un niveau d’écran').toContain(METRES_PER_LEVEL);
    expect(isWalkable(FIXTURE, CASE_ETAGE.x, CASE_ETAGE.y, 1), 'la case que le repli désigne est marchable').toBe(true);
  });

  it('les deux décors du piège sont CHOISIS sur leur géométrie, et posés sur des cases distinctes', () => {
    expect(chebyshev(POSE_HAUTE, caseDuDessus(MEUBLE_HAUT, POSE_HAUTE)), 'le dessus du meuble haut décale la case').toBeGreaterThan(0);
    expect(chebyshev(POSE_FINE, caseDuDessus(PLATEAU_FIN, POSE_FINE)), 'le plateau fin, lui, ne décale rien').toBe(0);
    expect(FIXTURE.entities.filter((e) => e.kind === 'prop').map((e) => e.id))
      .toEqual([MEUBLE_HAUT_ID, VOISIN_ID, PLATEAU_FIN_ID]);
  });
});

describe('Picking de TUILE — la case résolue est celle que la voie volumique dessine (#1176 P2-3)', () => {
  for (const carte of CARTES) {
    const dims = dimsDe(carte.scene);
    const mpt = sceneMetresPerTile(carte.scene);
    const camera = cameraVolumique(dims, mpt);
    for (const z of carte.etages) {
      const cases = echantillon(carte.scene, z, 8);
      if (cases.length < 4) continue;
      const poste = posteDuGroupe(carte.scene, z, cases[0]);

      it(`${carte.nom} — étage ${z} : le CENTRE de chaque case résout la case que le volumique y dessine`, () => {
        const vise = viseur(carte.scene, z, poste);
        const ecarts: string[] = [];
        for (const t of cases) {
          const p = pixelVolumique(camera, mpt, t.x, t.y, heightAt(carte.scene, t.x, t.y, z));
          const attendu = caseVueVolumique(carte.scene, camera, mpt, z, p);
          const vu = vise(p.sx, p.sy);
          if (vu?.x !== attendu?.x || vu?.y !== attendu?.y || (vu?.z ?? 0) !== (attendu?.z ?? 0)) {
            ecarts.push(`(${t.x},${t.y}) volumique=${attendu ? `${attendu.x},${attendu.y}` : 'rien'} pointeur=${vu ? `${vu.x},${vu.y}` : 'rien'}`);
          }
        }
        expect(ecarts).toEqual([]);
      });

      it(`${carte.nom} — étage ${z} : à 0,35 px du BORD du losange, les deux voies désignent encore la même case`, () => {
        const vise = viseur(carte.scene, z, poste);
        const ecarts: string[] = [];
        let vises = 0;
        for (const t of cases) {
          const hM = heightAt(carte.scene, t.x, t.y, z);
          const centre = pixelVolumique(camera, mpt, t.x, t.y, hM);
          for (const d of [{ x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }]) {
            const voisin = pixelVolumique(camera, mpt, t.x + d.x, t.y + d.y, hM);
            const demi = Math.hypot(voisin.sx - centre.sx, voisin.sy - centre.sy) / 2; // centre → bord partagé
            const k = (demi - AU_BORD) / (demi * 2);
            // …et DE CÔTÉ : un point rigoureusement sur la frontière d'une case ne départage rien (il
            // tombe sur le .5 d'un arrondi, que deux chaînes de flottants tranchent chacune pour soi —
            // cf. le test de frontière ci-dessous). L'échantillon s'en écarte, sans quitter la case.
            const ux = (voisin.sx - centre.sx) / (2 * demi), uy = (voisin.sy - centre.sy) / (2 * demi);
            const p = {
              sx: centre.sx + (voisin.sx - centre.sx) * k - uy * DE_COTE,
              sy: centre.sy + (voisin.sy - centre.sy) * k + ux * DE_COTE,
            };
            const attendu = caseVueVolumique(carte.scene, camera, mpt, z, p);
            const vu = vise(p.sx, p.sy);
            vises++;
            if (vu?.x !== attendu?.x || vu?.y !== attendu?.y || (vu?.z ?? 0) !== (attendu?.z ?? 0)) {
              ecarts.push(`(${t.x},${t.y})→(${t.x + d.x},${t.y + d.y}) volumique=${attendu ? `${attendu.x},${attendu.y}` : 'rien'} pointeur=${vu ? `${vu.x},${vu.y}` : 'rien'}`);
            }
          }
        }
        expect(vises).toBeGreaterThan(8); // la garde vise vraiment des bords, elle ne tourne pas à vide
        expect(ecarts).toEqual([]);
      });
    }
  }
});

/**
 * SUR LA FRONTIÈRE EXACTE de deux cases, il n'y a rien à départager : la coordonnée continue y vaut un
 * demi, et deux chaînes de flottants distinctes le tranchent chacune pour soi. Ce que cette garde
 * mesure, c'est qu'il ne reste QUE cela : les deux inversions rendent le MÊME point continu (à 1e-9
 * près), à chaque hauteur de relief — c'est la portée exacte de la réserve écrite au JSDoc de
 * `screenToTileAtLift`.
 */
describe('Frontière de deux cases — les deux inversions coïncident, seul l’arrondi du .5 les sépare', () => {
  const carte = { nom: 'fixture', scene: FIXTURE };
  const dims = dimsDe(carte.scene);
  const mpt = sceneMetresPerTile(carte.scene);
  const camera = cameraVolumique(dims, mpt);
  const pose = poseFromDims(dims);

  it('fixture : le point continu du pointeur EST celui de la caméra volumique', () => {
    let pires = 0;
    let points = 0;
    for (const t of echantillon(carte.scene, 0, 8)) {
      const hM = heightAt(carte.scene, t.x, t.y, 0);
      const centre = pixelVolumique(camera, mpt, t.x, t.y, hM);
      for (const d of [{ x: 1, y: 0 }, { x: 0, y: 1 }]) {
        const voisin = pixelVolumique(camera, mpt, t.x + d.x, t.y + d.y, hM);
        const p = { sx: (centre.sx + voisin.sx) / 2, sy: (centre.sy + voisin.sy) / 2 }; // LA frontière
        for (const h of hauteurs(carte.scene, 0)) {
          const a = grilleVolumique(camera, mpt, p, h);
          const b = screenToWorldAtLift(pose, stagePointAt(viewBoxPointAt({ sx: p.sx, sy: p.sy }, CANVAS), CAM, ZOOM), metricToLift(h));
          pires = Math.max(pires, Math.abs(a.x - b.x), Math.abs(a.y - b.y));
          points++;
        }
      }
    }
    expect(points).toBeGreaterThan(50);
    expect(pires).toBeLessThan(1e-9);
  });
});

/**
 * MEUBLE HAUT — le pixel du DESSUS appartient au meuble, et c'est le RAYON qui le dit (#1443, round 2).
 *
 * La résolution de case du pointeur inverse l'écran au LIFT DU SOL : sur une FACE SUPÉRIEURE portée en
 * hauteur, elle rend une case décalée vers l'arrière — le piège que la fixture pose, un meuble haut
 * dont le pixel du dessus désigne la case du décor voisin, où un clic enverrait le groupe au lieu de
 * servir le meuble visé. Le rayon, lui, touche la face RÉELLEMENT dessinée à sa hauteur réelle : quand il nomme
 * un décor, c'est lui qui décide ; la case dessinée n'est qu'un REPLI (plateau fin, aucune face touchée).
 */
describe('meuble HAUT — le rayon décide, la case dessinée n’est qu’un repli (#1443)', () => {
  const scene = FIXTURE;
  const dims = dimsDe(scene);
  const mpt = sceneMetresPerTile(scene);
  const camera = cameraVolumique(dims, mpt);

  /** Sommet MONDE d'un décor POSÉ dans la scène, cap et altitude de son pied compris. */
  const sommet = (ent: SceneEntity): number => sommetDuDecor(findPropById(ent.ref)!, {
    ancre: ent.pos,
    facing: capVolumique(ent.facing)!,
    baseHeightM: heightAt(scene, ent.pos.x, ent.pos.y, ent.z ?? 0),
    entId: ent.id,
  }, mpt);

  /** Les décors dont le pixel du DESSUS tombe, au lift du SOL, sur la case d'un AUTRE décor : le cas
   *  exact que la règle tranche — la fixture en pose un, et le contrat refuse une liste vide. */
  const pieges = scene.entities
    .filter((e) => e.kind === 'prop' && (e.z ?? 0) === 0)
    .map((e) => ({ ent: e, px: pixelVolumique(camera, mpt, e.pos.x, e.pos.y, sommet(e)) }))
    .map(({ ent, px }) => {
      const vb = viewBoxPointAt({ sx: px.sx, sy: px.sy }, CANVAS);
      const g = stagePointAt(vb, CAM, ZOOM);
      const sol = screenToWorldAtLift(poseFromDims(dims), g, 0);
      const dessous = scene.entities.find((e) => e.kind === 'prop' && e.pos.x === Math.round(sol.x) && e.pos.y === Math.round(sol.y) && (e.z ?? 0) === 0);
      return { ent, px, voisin: dessous && dessous.id !== ent.id ? dessous : null };
    })
    .filter((c) => !!c.voisin);

  it('le pixel du DESSUS d’un meuble haut cible CE meuble, jamais le voisin que le lift du sol désigne', () => {
    expect(pieges.map((c) => c.ent.id), 'la fixture pose un meuble haut dont le dessus décale la case').toContain(MEUBLE_HAUT_ID);
    const ecarts: string[] = [];
    for (const { ent, px, voisin } of pieges) {
      setSpritePicker(() => ({ kind: 'entity', id: ent.id })); // le rayon touche la face du dessus
      const vise = viseur(scene, 0, posteDuGroupe(scene, 0, { x: 0, y: 0 }));
      const vu = vise(px.sx, px.sy);
      if (vu?.x !== ent.pos.x || vu?.y !== ent.pos.y) {
        ecarts.push(`${ent.id} (${ent.pos.x},${ent.pos.y}) → pointeur=${vu ? `${vu.x},${vu.y}` : 'rien'} (voisin piège : ${voisin!.id})`);
      }
      act(() => root!.unmount());
      root = null;
    }
    expect(ecarts).toEqual([]);
  });

  it('TÉMOIN — sans rayon, le repli par la case dessinée désigne bien le voisin : c’est ce que la règle évite', () => {
    const { ent, px, voisin } = pieges[0];
    setSpritePicker(null); // aucune voie de rayon inscrite → repli par la case dessinée
    const vise = viseur(scene, 0, posteDuGroupe(scene, 0, { x: 0, y: 0 }));
    const vu = vise(px.sx, px.sy);
    expect(`${vu?.x},${vu?.y}`, `le repli désigne ${voisin!.id}, pas ${ent.id}`).toBe(`${voisin!.pos.x},${voisin!.pos.y}`);
  });
});

/**
 * SONDE DE RECETTE ⇄ GESTE — la sonde `__wfrp.pickTileAt` rapporte ce qu'un CLIC ferait (#1680).
 *
 * La sonde sert à diagnostiquer un « clic qui ne fait rien » : si elle et le geste divergent, elle
 * innocente le pixel que le clic manque, et la recette conclut faux. Les deux décisions du picking
 * vivent donc en un lieu (`stage/pickResolve.ts`) : la CONDITION DE TIR du rayon — que la sonde
 * bornait au COMBAT alors que le geste tire aussi hors combat sur une scène à décor volumique — et la
 * RÉSOLUTION de ce que le rayon nomme, dont la branche `entity` retombait en silence sur le sol.
 */
describe('sonde de picking — hors combat, un décor volumique nommé rend SA case (#1680)', () => {
  const scene = FIXTURE;
  const cible = scene.entities.find((e) => e.kind === 'prop' && (e.z ?? 0) === 0)!;
  const mpt = sceneMetresPerTile(scene);
  /** Un pixel qui tombe sur une SURFACE dessinée : le repli de sol y a donc une réponse, et le
   *  témoin mesure bien la voie choisie, pas un hors-carte. */
  const px = pixelVolumique(
    cameraVolumique(dimsDe(scene), mpt), mpt,
    cible.pos.x, cible.pos.y, heightAt(scene, cible.pos.x, cible.pos.y, 0),
  );
  const pixel = { x: px.sx, y: px.sy };

  /** Le poste du groupe est POSÉ, jamais hérité : `partyPos.z` décide de l'étage sur lequel la sonde
   *  résout (`state/viewLevel.ts:etageActif`), donc de la voie qui répond — un `z` de 1 laissé par un
   *  test voisin fait rendre `sol` là où l'étage 0 rend `meuble`. */
  function armer(): void {
    monterStage(cadreRendu(dimsDe(scene)));
    useGame.setState({
      scene, mode: 'exploration', battle: null, dialogue: null,
      partyPos: posteDuGroupe(scene, 0, { x: 0, y: 0 }),
      camPan: CAM, zoom: ZOOM, camRot: 0, camEdge: false, viewMode: 'iso',
    });
  }

  it('le rayon nomme une ENTITÉ : la sonde rend sa case d’ancrage, par la voie `decor`', () => {
    armer();
    setSpritePicker(() => ({ kind: 'entity', id: cible.id }));
    // Le verdict porte l'IDENTITÉ frappée à CÔTÉ de sa case d'ancrage (#1687) : aucun lecteur n'a
    // plus à retrouver l'entité par la position rendue.
    expect(pickTileAt(pixel)).toEqual({
      tile: { x: cible.pos.x, y: cible.pos.y, z: cible.z ?? 0 },
      cid: null,
      via: 'decor',
      nature: 'entite',
      entId: cible.id,
      geste: { entId: cible.id },
    });
  });

  it('TÉMOIN — sans voie de rayon inscrite, la même sonde retombe sur la surface du SOL', () => {
    armer();
    setSpritePicker(null);
    const vu = pickTileAt(pixel);
    // La VOIE change — c'est le seul discriminant : au MÊME pixel, la branche `entity` répondait
    // `null` et la sonde poursuivait la chaîne en silence, en rapportant l'étage suivant là où le
    // geste rend le décor que le rayon nomme.
    expect(vu?.via).toBe('meuble');
  });
});

/**
 * CONFORMITÉ de la SONDE DE RECETTE (#1687) — `state/devtools.ts` déclare la forme que le rendu lui
 * rend SANS pouvoir l'importer : la frontière `src/state ↛ src/gameIso` refuse jusqu'au `import type`
 * (`state/frontiere-state-gameiso.test.ts`). Ce test vit du côté qui voit les DEUX types, et refuse
 * qu'une 3ᵉ forme naisse : les deux se contiennent l'une l'autre, sinon le typecheck rougit ici.
 */
describe('sonde de recette — la forme déclarée au store EST le verdict du rendu (#1687)', () => {
  it('les deux types se contiennent : ni champ ni nature ne dérive', () => {
    type Contient<A, B> = [A] extends [B] ? true : false;
    // Ce que la SONDE rend = le verdict du rendu PLUS le geste qu'elle rapporte (`stage/geste.ts`).
    type VerdictSonde = (Verdict & { geste: { entId?: string } }) | null;
    const versLeStore: Contient<VerdictSonde, ReturnType<PickProbe>> = true;
    const versLeRendu: Contient<ReturnType<PickProbe>, VerdictSonde> = true;
    expect([versLeStore, versLeRendu]).toEqual([true, true]);
  });
});

/**
 * CE QUE LE VERDICT NOMME (#1687) — le rayon nomme l'ENTITÉ frappée, un étage de surface ne nomme
 * qu'une CASE.
 *
 * Scène FABRIQUÉE ici, jamais un paquet livré : le cas mesuré est DEUX entités sur la MÊME case — une
 * lecture par position (`entities.find(pos === t)`) les confond, elle rend la PREMIÈRE du document
 * quel que soit le pixel.
 */
describe('verdict de picking — le rayon nomme, la surface ne devine pas (#1687)', () => {
  /** Décor VOLUMIQUE DÉRIVÉ du catalogue (jamais une ref écrite en dur) : c'est sa présence qui
   *  autorise le rayon hors combat (`builders/props.ts:sceneAUnPropVolumique`). */
  const REF_VOLUMIQUE = props.find((p) => refEstVolumique(p.id))!.id;
  const scene = emptyScene(8, 8);
  scene.entities = [
    { id: 'table-1', kind: 'prop', pos: { x: 3, y: 3 }, ref: REF_VOLUMIQUE, facing: 'S' },
    { id: 'coffre-1', kind: 'prop', pos: { x: 3, y: 3 }, ref: REF_VOLUMIQUE, facing: 'S' },
  ] as unknown as SceneEntity[];
  const mpt = sceneMetresPerTile(scene);
  const camera = cameraVolumique(dimsDe(scene), mpt);
  const pixelDe = (x: number, y: number) => {
    const p = pixelVolumique(camera, mpt, x, y, heightAt(scene, x, y, 0));
    return { x: p.sx, y: p.sy };
  };

  function armer(): void {
    monterStage(cadreRendu(dimsDe(scene)));
    useGame.setState({
      scene, mode: 'exploration', battle: null, dialogue: null, party: [],
      partyPos: { x: 1, y: 1 }, camPan: CAM, zoom: ZOOM, camRot: 0, camEdge: false, viewMode: 'iso',
    });
  }

  it('deux entités sur une MÊME case, le pixel tombe sur la SECONDE : le verdict nomme la SECONDE', () => {
    armer();
    setSpritePicker(() => ({ kind: 'entity', id: 'coffre-1' }));
    const vu = pickTileAt(pixelDe(3, 3));
    expect(vu).toEqual({ tile: { x: 3, y: 3, z: 0 }, cid: null, via: 'decor', nature: 'entite', entId: 'coffre-1', geste: { entId: 'coffre-1' } });
  });

  it('case de SOL qu’aucun rayon ne nomme : le verdict est une CASE, et ne nomme aucune entité', () => {
    armer();
    setSpritePicker(null);
    const vu = pickTileAt(pixelDe(6, 6));
    expect(vu).toEqual({ tile: { x: 6, y: 6, z: 0 }, cid: null, via: 'sol', nature: 'case', geste: {} });
    expect(vu && 'entId' in vu, 'un étage de surface ne pose aucune identité').toBe(false);
  });
});

/**
 * PLATEAU FIN — le repli par le MEUBLE DESSINÉ appartient à la CHAÎNE, pas au geste (#1680).
 *
 * Un plateau fin ne présente aucune face au rayon : c'est alors la case DESSINÉE qui décide. La
 * résolution de tuile l'écarte (l'empreinte d'un meuble solide n'est pas marchable) et le repli
 * cross-couche rend une case d'un AUTRE ÉTAGE — le piège que la fixture pose : son étage 1 est
 * justement là où ce repli envoie le pixel du décor à plateau fin, plusieurs pas plus loin. Le geste
 * s'en protégeait seul ; la sonde de recette, qui n'avait pas cet étage, innocentait donc le pixel que
 * le clic manquait.
 */
describe('sonde de picking — plateau FIN : la case du meuble DESSINÉ, jamais celle d’un autre étage (#1680)', () => {
  const scene = FIXTURE;
  const dims = dimsDe(scene);
  const mpt = sceneMetresPerTile(scene);
  const camera = cameraVolumique(dims, mpt);
  const pose = poseFromDims(dims);
  const poste = posteDuGroupe(scene, 0, { x: 0, y: 0 });

  /** Les décors de l'étage 0 et le pixel de leur case, à la hauteur du SOL — le pixel d'un plateau fin. */
  const decors = scene.entities
    .filter((e) => e.kind === 'prop' && (e.z ?? 0) === 0)
    .map((ent) => ({ ent, px: pixelVolumique(camera, mpt, ent.pos.x, ent.pos.y, heightAt(scene, ent.pos.x, ent.pos.y, 0)) }));

  function poserStage(): void {
    monterStage(cadreRendu(dims));
    useGame.setState({
      scene, mode: 'exploration', battle: null, dialogue: null, partyPos: poste,
      camPan: CAM, zoom: ZOOM, camRot: 0, camEdge: false, viewMode: 'iso',
    });
  }

  it('sans rayon, chaque décor de l’étage rend SA case par la voie `meuble`', () => {
    poserStage();
    setSpritePicker(null);
    expect(decors.map((d) => d.ent.id), 'la fixture pose ses décors à l’étage 0').toContain(PLATEAU_FIN_ID);
    const ecarts: string[] = [];
    for (const { ent, px } of decors) {
      const vu = pickTileAt({ x: px.sx, y: px.sy });
      if (vu?.via !== 'meuble' || vu.tile?.x !== ent.pos.x || vu.tile?.y !== ent.pos.y || vu.tile?.z !== 0)
        ecarts.push(`${ent.id} (${ent.pos.x},${ent.pos.y}) → ${vu ? `${vu.via} ${vu.tile?.x},${vu.tile?.y},z${vu.tile?.z}` : 'rien'}`);
    }
    expect(ecarts).toEqual([]);
  });

  it('TÉMOIN — le repli cross-couche, lui, désigne bien une case d’un AUTRE étage : c’est ce que cet étage évite', () => {
    const pieges = decors
      .map(({ ent, px }) => {
        const g = stagePointAt(viewBoxPointAt({ sx: px.sx, sy: px.sy }, CANVAS), CAM, ZOOM);
        return { ent, sol: caseAuSol(scene, { pose, dims, activeZ: 0, aretes: [] }, g) };
      })
      .filter(({ ent, sol }) => !!sol && (sol.x !== ent.pos.x || sol.y !== ent.pos.y || (sol.z ?? 0) !== 0));
    expect(pieges.map((p) => p.ent.id), 'aucun piège mesuré : ce contrat ne départage plus rien').toContain(PLATEAU_FIN_ID);
    // Le décalage EST celui du bug : la case rendue est celle de l'ÉTAGE DU DESSUS, plusieurs pas plus loin.
    const { ent, sol } = pieges.find((p) => p.ent.id === PLATEAU_FIN_ID)!;
    expect(sol!.z, 'le repli quitte l’étage où le décor est posé').toBe(1);
    expect(chebyshev(sol!, ent.pos), 'et la case rendue n’est pas la sienne').toBeGreaterThan(0);
  });
});

/**
 * LE CADRE EST PUBLIÉ, PAS REBÂTI — la sonde résout sur la pose que l'écran REND (#1680).
 *
 * L'hôte de rendu commet un cadre qui n'est PAS le store nu : `view: pov ? 'iso' : viewMode`
 * (`MondeDeCampagne.tsx`) — en première personne le monde reste projeté en iso alors que le store peut
 * porter `viewMode: 'top'` — et un `yawDeg` LISSÉ pendant une rotation. Une sonde qui rebâtit le cadre
 * depuis le store résout donc sur une AUTRE pose que l'image, et innocente le pixel que le clic manque.
 * Le cadre commis est publié (`spritePicker.ts:setStageFrame`) ; la sonde le lit.
 */
describe('sonde de picking — le CADRE est celui que l’écran rend, jamais le store nu (#1680)', () => {
  const scene = FIXTURE;
  const poste = posteDuGroupe(scene, 0, { x: 0, y: 0 });

  /** Monte le stage, PUBLIE `cadre`, et pose au store un `viewMode` DIVERGENT — celui qu'une sonde
   *  rebâtisseuse lirait. C'est exactement la situation de la première personne. */
  function armerCadre(cadre: Dims): void {
    monterStage(cadreRendu(cadre));
    useGame.setState({
      scene, mode: 'exploration', battle: null, dialogue: null, partyPos: poste,
      camPan: CAM, zoom: ZOOM, camRot: 0, camEdge: false, viewMode: 'top', // le store DIVERGE du cadre commis
    });
  }

  /** Les pixels d'échantillon : les décors de l'étage 0 vus au cadre PUBLIÉ. */
  const echantillonPixels = (cadre: Dims) => {
    const mpt = sceneMetresPerTile(scene);
    const camera = cameraVolumique(cadre, mpt);
    return scene.entities
      .filter((e) => e.kind === 'prop' && (e.z ?? 0) === 0)
      .map((ent) => pixelVolumique(camera, mpt, ent.pos.x, ent.pos.y, heightAt(scene, ent.pos.x, ent.pos.y, 0)));
  };

  for (const [nom, cadre] of [
    ['première personne (monde en iso, store en top)', { ...dimsDe(scene), view: 'iso' }],
    ['rotation en cours (lacet LISSÉ, hors cran)', { ...dimsDe(scene), view: 'iso', yawDeg: 31.5 }],
  ] as [string, Dims][]) {
    it(`${nom} : la sonde résout à la case du GESTE, au cadre publié`, () => {
      armerCadre(cadre);
      setSpritePicker(null);
      const pixels = echantillonPixels(cadre);
      expect(pixels.length, 'aucun pixel d’échantillon : ce contrat ne mesure plus rien').toBeGreaterThan(0);
      const ecarts: string[] = [];
      for (const px of pixels) {
        // Le GESTE, monté sur le MÊME cadre : c'est lui l'étalon, jamais une seconde formule.
        const vise = viseur(scene, 0, poste, cadre);
        const attendu = vise(px.sx, px.sy);
        act(() => root!.unmount());
        root = null;
        const vu = pickTileAt({ x: px.sx, y: px.sy });
        const cle = (t: { x: number; y: number; z?: number } | null | undefined) => (t ? `${t.x},${t.y},z${t.z ?? 0}` : 'rien');
        if (cle(vu?.tile) !== cle(attendu)) ecarts.push(`(${px.sx.toFixed(1)},${px.sy.toFixed(1)}) geste=${cle(attendu)} sonde=${cle(vu?.tile)}`);
      }
      expect(ecarts).toEqual([]);
    });
  }

  it('hors montage du stage, la sonde NOMME l’absence d’image plutôt que de résoudre à l’aveugle', () => {
    armerCadre(dimsDe(scene));
    setStageFrame(null); // aucun hôte de rendu : plus aucune pose commise
    expect(pickTileAt({ x: CANVAS.w / 2, y: CANVAS.h / 2 })).toEqual({ tile: null, cid: null, via: 'aucune', nature: 'case', geste: {} });
  });
});

/**
 * LA CAMÉRA DU CADRE EST CELLE DU RENDU, PAS CELLE DU STORE (#1680).
 *
 * Un écran qui SUIT le groupe ne pose rien dans `store.camPan` : le focal vit dans la réf que la boucle
 * d'images réécrit (`MondeDeCampagne.tsx:camRef`), et c'est cette valeur-là que le geste inverse à
 * l'instant de l'événement. Une sonde qui inverse avec le store part donc de tout le focal à côté :
 * au pixel MÊME dont le clic déplace le groupe, elle rend `{tile: null, via: 'aucune'}` (mesuré en
 * recette sur Chrome, 1600×900).
 *
 * D'où le cadre PUBLIÉ en LECTEUR de caméra : les deux porteurs lisent la même valeur au même instant.
 */
describe('sonde de picking — la CAMÉRA du cadre est celle du RENDU, jamais `store.camPan` (#1680)', () => {
  const scene = FIXTURE;
  const dims = dimsDe(scene);
  const mpt = sceneMetresPerTile(scene);
  const camera = cameraVolumique(dims, mpt);
  const poste = posteDuGroupe(scene, 0, { x: 0, y: 0 });
  /** Les décors de l'étage 0, vus au pixel de leur case : l'échantillon des deux contrats voisins. */
  const decors = scene.entities
    .filter((e) => e.kind === 'prop' && (e.z ?? 0) === 0)
    .map((ent) => ({ ent, px: pixelVolumique(camera, mpt, ent.pos.x, ent.pos.y, heightAt(scene, ent.pos.x, ent.pos.y, 0)) }));

  it('cadre publié à la caméra du RENDU, store AU REPOS : la sonde résout la case du geste', () => {
    // L'image est cadrée en `CAM` (c'est la caméra que `viseur` tend au geste par sa réf) ; le store,
    // lui, reste à l'origine — exactement l'état d'un écran centré sur le groupe.
    monterStage(cadreRendu(dims, CAM));
    useGame.setState({
      scene, mode: 'exploration', battle: null, dialogue: null, partyPos: poste,
      camPan: { x: 0, y: 0 }, zoom: ZOOM, camRot: 0, camEdge: false, viewMode: 'iso',
    });
    setSpritePicker(null);
    expect(decors.length, 'aucun pixel d’échantillon : ce contrat ne mesure plus rien').toBeGreaterThan(0);
    const cle = (t: { x: number; y: number; z?: number } | null | undefined) => (t ? `${t.x},${t.y},z${t.z ?? 0}` : 'rien');
    const ecarts: string[] = [];
    for (const { ent, px } of decors) {
      const attendu = viseur(scene, 0, poste, dims)(px.sx, px.sy); // le GESTE, étalon
      act(() => root!.unmount());
      root = null;
      const vu = pickTileAt({ x: px.sx, y: px.sy });
      if (cle(vu?.tile) !== cle(attendu)) ecarts.push(`${ent.id} : geste=${cle(attendu)} sonde=${cle(vu?.tile)} (via ${vu?.via ?? 'rien'})`);
    }
    expect(ecarts).toEqual([]);
  });
});

/**
 * CE QUE LE GESTE SERVIRAIT — la sonde ne s'arrête pas à l'entonnoir de résolution (#1687).
 *
 * Mesuré en recette le 2026-09-10 : au pixel d'un PNJ à dialogue, `pickTileAt` rendait `nature:'case'`
 * — aucun rayon ne nomme un personnage hors combat — alors que le CLIC ouvrait bien son dialogue. La
 * sonde n'appelait que `resoudrePixel` ; le geste, lui, poursuit par l'entité de la case
 * (`stage/geste.ts:entiteDuGeste`). Une sonde qui ne joue pas le geste innocente le pixel que le clic
 * manque : elle rapporte désormais les DEUX, et par la MÊME fonction que le hook.
 *
 * Scène FABRIQUÉE ici (jamais un paquet livré) : un PNJ à `dialogueId`, aucun rayon inscrit.
 */
describe('sonde de recette — le verdict dit la CASE, le geste nomme le PNJ (#1687)', () => {
  const scene = emptyScene(8, 8);
  const PNJ = 'baron-a-la-case';
  scene.entities = [
    { id: PNJ, kind: 'personnage', ref: 'humain', pos: { x: 4, y: 4 }, dialogueId: 'dlg-baron', facing: 'S' },
  ] as unknown as SceneEntity[];
  const mpt = sceneMetresPerTile(scene);
  const px = pixelVolumique(
    cameraVolumique(dimsDe(scene), mpt), mpt, 4, 4, heightAt(scene, 4, 4, 0),
  );

  it('un pixel sur la case d’un PNJ à dialogue : `nature:"case"`, et `geste.entId` = le PNJ', () => {
    monterStage(cadreRendu(dimsDe(scene)));
    setSpritePicker(null); // hors rayon : c'est la CASE qui répond, comme à l'écran hors combat
    useGame.setState({
      scene, mode: 'exploration', battle: null, dialogue: null, party: [],
      partyPos: { x: 0, y: 0 }, camPan: CAM, zoom: ZOOM, camRot: 0, camEdge: false, viewMode: 'iso',
    });
    const vu = pickTileAt({ x: px.sx, y: px.sy });
    expect(vu?.tile).toEqual({ x: 4, y: 4, z: 0 });
    expect(vu?.nature, 'aucun rayon ne nomme un PNJ hors combat').toBe('case');
    expect(vu?.geste).toEqual({ entId: PNJ });
  });

  it('TÉMOIN — une case NUE du même plancher ne fait servir aucune entité', () => {
    monterStage(cadreRendu(dimsDe(scene)));
    setSpritePicker(null);
    useGame.setState({
      scene, mode: 'exploration', battle: null, dialogue: null, party: [],
      partyPos: { x: 0, y: 0 }, camPan: CAM, zoom: ZOOM, camRot: 0, camEdge: false, viewMode: 'iso',
    });
    const nu = pixelVolumique(cameraVolumique(dimsDe(scene), mpt), mpt, 6, 6, heightAt(scene, 6, 6, 0));
    const vu = pickTileAt({ x: nu.sx, y: nu.sy });
    expect(vu?.tile).toEqual({ x: 6, y: 6, z: 0 });
    expect(vu?.geste).toEqual({});
  });
});
