import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import * as THREE from 'three';
import { diamondPath, tileEdge, type Dims } from '../../geometry/iso';
import { emptyScene, hauteurDe, heightAt, liftDe, type Scene } from '../../state/scene';
import { metricToLift } from '../../state/relief';
import { aretesUtilisables, type ContexteAretes } from '../../state/aretes';
import { piece } from '../../state/pieces.fixture';
import type { BattleState } from '../../state/store';
import type { Combatant } from '../../engine/types';
import { buildFloors } from '../builders/floors';
import { buildHighlights, type HighlightsView } from '../builders/highlights';
import { highlightMatrix, highlightSlot, slotLiftM } from '../backends/webgl/highlightMeshes';
import { buildDynamicMarkMesh, dynSlotLiftM } from '../backends/webgl/dynamicMarkMeshes';
import { HERO_RING } from '../teamColors';
import type { DynamicMarks } from '../builders/dynamicMarks';
import { poseDynamicMarks } from './dynamicMarkPose';
import { projeterAretes } from './aretesProjetees';
import { TapPreview } from './MoveOverlays';

/**
 * LE RELIEF DE LA COUCHE 0 COMPTE (#1687, lot 1b-5) — un point de grille a UNE élévation d'affichage,
 * celle du socle `state/scene.ts:liftDe`, et elle ne dépend PAS de l'index de couche. Le trait de mur
 * la lit sans garde (`stage/layers.tsx:99`, `metricToLift(heightAt(…))`) ; ce banc mesure que la prise
 * d'une arête et le marqueur d'un aperçu de déplacement posent le MÊME segment sur une falaise de
 * couche 0 — là où trois recopies d'une garde `p.z ? … : 0` les laissait au plancher, un niveau
 * (`LEVEL_H` = 96 px) plus bas par 4 m de relief.
 *
 * Scène FABRIQUÉE ici, jamais une scène de campagne : l'éditer ne doit rougir aucun banc.
 */

const dims: Dims = { w: 5, h: 4, rot: 0, view: 'iso' };

/** La case en relief, sur la COUCHE 0 : 4 m, soit exactement UN niveau d'écran. Sa voisine EST est à
 *  la même hauteur — sans quoi l'arête porterait une CHUTE, prioritaire sur la porte, et ce banc
 *  mesurerait une autre capacité que celle qu'il nomme. */
const RELIEF = { x: 2, y: 1 } as const;
const PLAT = { x: 0, y: 3 } as const;
const RELIEF_M = 4;

/** Une scène d'UNE seule couche, plate sauf le palier de 4 m qui porte la porte de son arête E, entre
 *  deux pièces : ce seuil est le seul accès de la pièce du palier, que la falaise isole ailleurs. */
function scèneÀReliefDeCouche0(): Scene {
  const s = emptyScene(dims.w, dims.h);
  const h = new Array(dims.w * dims.h).fill(0) as number[];
  h[RELIEF.y * dims.w + RELIEF.x] = RELIEF_M;
  h[RELIEF.y * dims.w + RELIEF.x + 1] = RELIEF_M;
  s.layers[0].height = h;
  s.walls = [{ x: RELIEF.x, y: RELIEF.y, side: 'E', door: true }];
  s.effectZones = [piece('room-a', RELIEF.x, RELIEF.y), piece('room-b', RELIEF.x + 1, RELIEF.y)];
  return s;
}

const contexte = (scene: Scene): ContexteAretes => ({
  scene,
  visible: new Set([`${RELIEF.x},${RELIEF.y},0`, `${RELIEF.x + 1},${RELIEF.y},0`]),
  controleur: { x: RELIEF.x, y: RELIEF.y },
  activeZ: 0,
  battle: null,
});

const héros = {
  id: 'h1', label: 'h1', kind: 'hero', pos: { x: 0, y: 0 }, size: 'moyenne',
  conditions: [], characteristics: {}, liveTraits: [], items: [],
} as unknown as Combatant;

const batailleQuiVise = (tile: { x: number; y: number }): BattleState => ({
  combatants: [héros], order: ['h1'], turn: 0, movementUsed: 0,
  preview: { kind: 'move', path: [{ x: 0, y: 0 }, tile], tile, cost: 2 },
} as unknown as BattleState);

describe('Le relief de la COUCHE 0 porte le lift — socle unique, une seule hauteur à l’écran', () => {
  const scene = scèneÀReliefDeCouche0();

  it('le socle rend la hauteur MÉTRIQUE de la case, `z` absent ou non — c’est le calcul du trait de mur', () => {
    // Le membre droit est l'expression EXACTE de `stage/layers.tsx:99`, qui trace le mur.
    expect(liftDe(scene, RELIEF)).toBe(metricToLift(heightAt(scene, RELIEF.x, RELIEF.y, 0)));
    expect(liftDe(scene, RELIEF), 'un palier de 4 m vaut UN niveau d’écran').toBe(1);
    expect(liftDe(scene, { ...RELIEF, z: 0 }), '`z: 0` explicite dit la même chose que `z` absent').toBe(1);
    expect(liftDe(scene, PLAT), 'à plat, rien ne bouge').toBe(0);
  });

  it('le lift DÉRIVE de la hauteur métrique — la hauteur d’un point se calcule à UN seul endroit', () => {
    expect(liftDe(scene, RELIEF), 'sur le palier').toBe(metricToLift(hauteurDe(scene, RELIEF)));
    expect(hauteurDe(scene, RELIEF), 'et le socle rend des MÈTRES, pas des niveaux').toBe(RELIEF_M);
    expect(liftDe(scene, PLAT), 'et à plat').toBe(metricToLift(hauteurDe(scene, PLAT)));
    expect(hauteurDe(scene, PLAT)).toBe(0);
  });

  it('la PRISE d’une arête se pose au lift de son ancrage, relief de couche 0 compris', () => {
    const aretes = aretesUtilisables(contexte(scene));
    const porteDeLaFalaise = aretes.filter((a) => a.capacite === 'porte');
    expect(porteDeLaFalaise, 'la scène offre bien la porte du palier en relief').toHaveLength(1);

    const [projetée] = projeterAretes(porteDeLaFalaise, dims, (p) => liftDe(scene, p));
    const traitDeMur = tileEdge(RELIEF.x, RELIEF.y, 'E', dims, metricToLift(heightAt(scene, RELIEF.x, RELIEF.y, 0)));
    expect([projetée.a, projetée.b], 'la prise et le trait de mur sont le MÊME segment').toEqual(traitDeMur);

    const auPlancher = tileEdge(RELIEF.x, RELIEF.y, 'E', dims, 0);
    expect(auPlancher[0].cy - projetée.a.cy, 'un niveau d’écran sépare la prise du plancher').toBeGreaterThan(0);
  });

  it('le MARQUEUR d’un aperçu de déplacement suit le même sol que le trait de mur', () => {
    const html = renderToStaticMarkup(
      <svg>
        <TapPreview battle={batailleQuiVise(RELIEF)} activeC={héros} dims={dims} liftOf={(p) => liftDe(scene, p)} myTurn />
      </svg>,
    );
    expect(html, 'la destination est dessinée au lift de sa case').toContain(diamondPath(RELIEF.x, RELIEF.y, dims, liftDe(scene, RELIEF)));
    expect(html, 'et jamais au plancher').not.toContain(diamondPath(RELIEF.x, RELIEF.y, dims, 0));
  });

  it('à PLAT, rien ne change : le marqueur reste au plancher', () => {
    const html = renderToStaticMarkup(
      <svg>
        <TapPreview battle={batailleQuiVise(PLAT)} activeC={héros} dims={dims} liftOf={(p) => liftDe(scene, p)} myTurn />
      </svg>,
    );
    expect(html).toContain(diamondPath(PLAT.x, PLAT.y, dims, 0));
  });
});

/** Le SOL que le monde volumique BÂTIT sur cette case : la hauteur métrique du losange de sol produit
 *  par `builders/floors.ts` — la référence contre laquelle toute marque posée dessus se mesure. */
function solBâti(scene: Scene, x: number, y: number, z = 0): number {
  const el = buildFloors(scene).find((e) => e.key === `floor:${x},${y},${z}`);
  const dalle = el?.faces.find((f) => f.material.domain === 'terrain' && !f.material.part);
  if (!dalle) throw new Error(`aucune dalle bâtie en (${x},${y},${z})`);
  return dalle.poly[0].h;
}

const MPT = 2;

const VUE: HighlightsView = {
  myTurn: true,
  walkReach: new Map(),
  runReach: new Map(),
  intentReach: new Map(),
  activeId: null,
  eligibleIds: null,
  crowdIds: null,
  candidates: null,
  rangeBandSource: null,
};

const sansCombattant = { combatants: [], zones: [] } as unknown as BattleState;

const aucuneMarque: DynamicMarks = { tethers: [], active: null, party: null, rings: [] };

/** La marque de Marche de cette case, telle que le builder de surbrillances la rend. */
const marqueDeMarche = (scene: Scene, c: { x: number; y: number }) =>
  buildHighlights(scene, sansCombattant, { ...VUE, walkReach: new Map([[`${c.x},${c.y}`, 1]]) })[0];

describe('Marques et halos se posent sur le SOL BÂTI — la couche 0 n’est pas un plancher', () => {
  const scene = scèneÀReliefDeCouche0();

  it('la dalle du monde volumique porte bien le relief de la couche 0', () => {
    expect(solBâti(scene, RELIEF.x, RELIEF.y)).toBe(RELIEF_M);
    expect(solBâti(scene, PLAT.x, PLAT.y)).toBe(0);
  });

  it('le HALO d’une case de Marche est à la hauteur de sa dalle, jamais enterré 4 m dessous', () => {
    const marque = marqueDeMarche(scene, RELIEF);
    expect(marque.cell).toEqual({ x: RELIEF.x, y: RELIEF.y, z: 0 });
    expect(marque.h, 'la hauteur sémantique EST celle du sol bâti').toBe(solBâti(scene, RELIEF.x, RELIEF.y));

    const y = new THREE.Vector3().setFromMatrixPosition(highlightMatrix(marque, MPT)).y;
    expect(
      y - slotLiftM(highlightSlot(marque)),
      'le quad ne flotte que de son décollement de slot au-dessus de la dalle',
    ).toBe(solBâti(scene, RELIEF.x, RELIEF.y));
  });

  it('à PLAT, la même marque reste au sol', () => {
    const marque = marqueDeMarche(scene, PLAT);
    expect(marque.h).toBe(0);
  });

  it('la MARQUE DYNAMIQUE (anneau d’équipe) se pose sur cette même dalle', () => {
    const anneau = buildDynamicMarkMesh('anneau');
    // Le sol que le stage TEND à la passe de pose EST le socle `hauteurDe` (`GameStage3D:solM` et
    // `VolumetricWorld` ne font qu'en adapter la forme par coordonnées) : la prise est RÉELLE.
    const groundM = (x: number, y: number, z: number) => hauteurDe(scene, { x, y, z });
    poseDynamicMarks(
      { anneau },
      { ...aucuneMarque, rings: [{ id: 'h1', cell: { x: RELIEF.x, y: RELIEF.y, z: 0 }, rK: 0.4, color: HERO_RING[0], dash: '5 3' }] },
      { mpt: MPT, glide: () => null, groundM, kind: 'iso' },
    );
    expect(anneau.count, 'l’anneau est peint').toBeGreaterThan(0);

    const m = new THREE.Matrix4();
    anneau.getMatrixAt(0, m);
    const y = new THREE.Vector3().setFromMatrixPosition(m).y;
    // Le buffer d'instances est en `float32` : l'égalité se mesure à 1e-5 m, quatre ordres de
    // grandeur sous l'enterrement de 4 m que ce banc refuse.
    expect(y - dynSlotLiftM('anneau')).toBeCloseTo(solBâti(scene, RELIEF.x, RELIEF.y), 5);
  });
});
