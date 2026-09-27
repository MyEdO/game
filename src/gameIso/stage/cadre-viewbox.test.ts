import { describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import { stage3dFramingFor, viewBoxScreen } from './stage3dCamera';
import { viewBoxMeetScale, viewBoxScreenPixel } from './stageCam';
import { affineCamera, projectToScreen } from '../backends/webgl/cameras';
import { stageSize, tileCenter, type Dims, type Rot } from '../../geometry/iso';
import { metricToLift } from '../../state/relief';
import { sceneMetresPerTile } from '../../state/scene';
import { scenario } from '../../scenes/test-scenarios/zones-pieces';
const scenarioConstruit = scenario.construire();

/**
 * CADRE GÉNÉRALISÉ (#1176, P3-3) — la SECONDE convention d'écran du dépôt : le VIEWBOX MOBILE de
 * l'éditeur de scènes (`ui/editor/EditorCanvas.tsx`), par opposition au viewBox FIXE + `slice` du jeu
 * que `stage3dCamera.test.ts` prouve déjà. Ce qui est en jeu ici est le même : l'ANCRAGE ABSOLU. Le
 * SVG d'authoring reste monté par-dessus le canevas, et il porte les surcouches (fantômes, poignées,
 * zones, tracés) — un décalage d'un pixel entre les deux voies se voit à l'œil, sur chaque poignée.
 *
 * Les deux côtés de l'égalité sont INDÉPENDANTS : à gauche la loi SVG (`viewBoxScreenPixel`, le
 * `xMidYMid meet` que le navigateur applique au viewBox), à droite la caméra three montée depuis le
 * cadre (`viewBoxScreen` → `affineCamera` → `projectToScreen`).
 */
const scene = scenarioConstruit.scene;
const mpt = sceneMetresPerTile(scene);
const TOL = 1e-6;

const SAMPLES: { x: number; y: number; h: number }[] = [];
for (const x of [0, 3, 4.5, 9]) for (const y of [0, 2, 5.5, 8]) for (const h of [0, 1.7, 4]) SAMPLES.push({ x, y, h });

const dimsFor = (rot: Rot, top: boolean): Dims => ({ w: scene.dimensions.w, h: scene.dimensions.h, rot, edge: false, view: top ? 'top' : 'iso' });

/**
 * Le cadre de l'ÉDITEUR à un état de vue donné. `zoom`/`pan` sont ceux de `useEditorView`, et `k` le
 * RÉTRÉCISSEMENT CSS (`.editor-iso { max-width: 100% }`) : l'élément garde le rapport de ses attributs
 * `width`/`height`, seule sa TAILLE RENDUE change — c'est elle que `GameStage3D` mesure
 * (`canvas.clientWidth`), et c'est par elle que passe l'échelle.
 */
function cadreEditeur(dims: Dims, zoom: number, pan: { x: number; y: number }, k: number) {
  const stage = stageSize(dims);
  return {
    viewBox: { x: pan.x, y: pan.y, w: stage.w / zoom, h: stage.h / zoom },
    canvas: { w: stage.w * k, h: stage.h * k },
  };
}

function ecartMax(dims: Dims, zoom: number, pan: { x: number; y: number }, k: number): number {
  const { viewBox, canvas } = cadreEditeur(dims, zoom, pan, k);
  const f = stage3dFramingFor({ dims, mpt, screen: viewBoxScreen(viewBox, canvas), canvas });
  const { camera } = affineCamera(f.kind, f.yawDeg, mpt, f.viewport, { target: new Vector3(f.centre.x, f.centre.y, f.centre.z) });
  let pire = 0;
  for (const s of SAMPLES) {
    const a = viewBoxScreenPixel(tileCenter(s.x, s.y, dims, metricToLift(s.h)), viewBox, canvas);
    const b = projectToScreen(camera, new Vector3(s.x * mpt, s.h, s.y * mpt), canvas);
    pire = Math.max(pire, Math.abs(a.sx - b.sx), Math.abs(a.sy - b.sy));
  }
  return pire;
}

/** MÊME preuve, sur un cadre en pixels DONNÉ — donc de rapport quelconque vis-à-vis du viewBox. */
function ecartMaxSurCadre(dims: Dims, viewBox: { x: number; y: number; w: number; h: number }, canvas: { w: number; h: number }): number {
  const f = stage3dFramingFor({ dims, mpt, screen: viewBoxScreen(viewBox, canvas), canvas });
  const { camera } = affineCamera(f.kind, f.yawDeg, mpt, f.viewport, { target: new Vector3(f.centre.x, f.centre.y, f.centre.z) });
  let pire = 0;
  for (const s of SAMPLES) {
    const a = viewBoxScreenPixel(tileCenter(s.x, s.y, dims, metricToLift(s.h)), viewBox, canvas);
    const b = projectToScreen(camera, new Vector3(s.x * mpt, s.h, s.y * mpt), canvas);
    pire = Math.max(pire, Math.abs(a.sx - b.sx), Math.abs(a.sy - b.sy));
  }
  return pire;
}

describe('Cadre volumique de l’ÉDITEUR — viewBox MOBILE, échelle MESURÉE (#1176, P3-3)', () => {
  const PAN = { x: 137, y: -62 };

  for (const rot of [0, 1, 2, 3] as Rot[])
    it(`cran ${rot} : la case du canevas tombe au pixel de la case du SVG d’authoring`, () => {
      expect(ecartMax(dimsFor(rot, false), 1, PAN, 1)).toBeLessThanOrEqual(TOL);
    });

  it('vue du DESSUS (le défaut de l’éditeur : on y travaille le plan)', () => {
    expect(ecartMax(dimsFor(0, true), 1, PAN, 1)).toBeLessThanOrEqual(TOL);
  });

  it('sur toute la course de zoom de l’éditeur (0,25 → 6) et à tout panoramique', () => {
    for (const zoom of [0.25, 0.7, 1, 2.4, 6])
      for (const pan of [{ x: 0, y: 0 }, { x: -320, y: 180 }, { x: 640, y: -410 }])
        expect(ecartMax(dimsFor(0, true), zoom, pan, 1)).toBeLessThanOrEqual(TOL);
  });

  /**
   * L'ÉCHELLE SE MESURE, elle ne se dérive pas du zoom : le SVG de l'éditeur est à TAILLE DE CONTENU
   * et la CSS le rétrécit pour tenir dans la colonne. Un cadrage qui prendrait `zoom` pour échelle
   * serait juste à `k = 1` et faux partout ailleurs — d'où les facteurs de rétrécissement ci-dessous,
   * et la valeur ÉPINGLÉE (`zoom × k`, jamais recalculée par la même formule des deux côtés).
   */
  it('le RÉTRÉCISSEMENT CSS entre dans l’échelle — sinon le monde et les surcouches divergent', () => {
    for (const k of [0.42, 0.75, 1]) {
      for (const zoom of [0.6, 1, 3]) {
        expect(ecartMax(dimsFor(1, false), zoom, PAN, k)).toBeLessThanOrEqual(TOL);
        const { viewBox, canvas } = cadreEditeur(dimsFor(1, false), zoom, PAN, k);
        expect(viewBoxScreen(viewBox, canvas).scale).toBeCloseTo(zoom * k, 9);
      }
    }
  });

  it('l’échelle du viewBox MOBILE est un `meet` (MIN des deux rapports) — valeurs épinglées', () => {
    // 800×600 dans un cadre 400×450 : min(400/800 = 0,5 ; 450/600 = 0,75) = 0,5 (la LARGEUR contraint).
    expect(viewBoxMeetScale({ w: 800, h: 600 }, { w: 400, h: 450 })).toBeCloseTo(0.5, 12);
    // 800×600 dans 1200×300 : min(1,5 ; 0,5) = 0,5 (la HAUTEUR contraint) — le `slice` du jeu, lui,
    // prendrait le MAX (`viewBoxScale`).
    expect(viewBoxMeetScale({ w: 800, h: 600 }, { w: 1200, h: 300 })).toBeCloseTo(0.5, 12);
  });

  it('le centre du cadre est le centre du VIEWBOX (`xMidYMid`), pan compris', () => {
    const { viewBox, canvas } = cadreEditeur(dimsFor(0, true), 1.5, PAN, 0.8);
    const p = viewBoxScreenPixel({ cx: viewBox.x + viewBox.w / 2, cy: viewBox.y + viewBox.h / 2 }, viewBox, canvas);
    expect([p.sx, p.sy]).toEqual([canvas.w / 2, canvas.h / 2]);
    expect(viewBoxScreen(viewBox, canvas).centre).toEqual({ x: viewBox.x + viewBox.w / 2, y: viewBox.y + viewBox.h / 2 });
  });

  it('le VIEWPORT métrique rendu est le cadre en pixels ÷ l’échelle mesurée', () => {
    const dims = dimsFor(2, false);
    const { viewBox, canvas } = cadreEditeur(dims, 2, PAN, 0.55);
    const f = stage3dFramingFor({ dims, mpt, screen: viewBoxScreen(viewBox, canvas), canvas });
    expect(f.viewport.w).toBeCloseTo(canvas.w / f.scale, 9);
    expect(f.viewport.h).toBeCloseTo(canvas.h / f.scale, 9);
  });

  /**
   * CADRE LETTERBOXÉ — le cas que la batterie ci-dessus ne pouvait PAS attraper : elle prend toujours
   * un cadre au MÊME rapport que le viewBox (le SVG de l'éditeur garde le rapport de ses attributs),
   * et sur ce rapport `meet`, `slice` et « largeur seule » coïncident tous. Ici le cadre est délibéré-
   * ment plus large, puis plus haut, que son viewBox : seule la loi réelle du SVG (`meet` = MIN, centré
   * `xMidYMid`) tombe alors au pixel des deux côtés.
   */
  it('cadre de rapport DIFFÉRENT du viewBox : le `meet` centré tient encore au pixel', () => {
    const dims = dimsFor(0, false);
    const { viewBox } = cadreEditeur(dims, 1, PAN, 1);
    for (const canvas of [{ w: 1600, h: 400 }, { w: 300, h: 1100 }, { w: 640, h: 640 }])
      expect(ecartMaxSurCadre(dims, viewBox, canvas)).toBeLessThanOrEqual(TOL);
  });

  /**
   * ANCRAGE DES DÉCORATIONS DE JETON (#1176, P3-3, vague B). Le CORPS d'un jeton est peint par le
   * canevas (billboard ancré aux PIEDS, à `(x·mpt, hauteur, y·mpt)`), mais tout ce que l'auteur y lit
   * reste au SVG : empreinte de rencontre, tirets d'embusqueur, liseré de sélection, tous tracés à
   * `tileCenter`. Si les deux ancrages divergeaient d'un pixel, chaque empreinte flotterait à côté de
   * son corps. C'est la MÊME égalité que le cadre, prise au point d'ancrage d'un jeton.
   */
  it('le pied d’un jeton du canevas tombe au centre de case de sa décoration SVG', () => {
    for (const dims of [dimsFor(0, false), dimsFor(2, false), dimsFor(0, true)]) {
      const { viewBox, canvas } = cadreEditeur(dims, 1.4, PAN, 0.7);
      const f = stage3dFramingFor({ dims, mpt, screen: viewBoxScreen(viewBox, canvas), canvas });
      const { camera } = affineCamera(f.kind, f.yawDeg, mpt, f.viewport, { target: new Vector3(f.centre.x, f.centre.y, f.centre.z) });
      for (const { x, y, h } of [{ x: 2, y: 3, h: 0 }, { x: 7, y: 1, h: 1.7 }, { x: 4, y: 6, h: 4 }]) {
        const svg = viewBoxScreenPixel(tileCenter(x, y, dims, metricToLift(h)), viewBox, canvas);
        const pied = projectToScreen(camera, new Vector3(x * mpt, h, y * mpt), canvas);
        expect(Math.abs(svg.sx - pied.sx)).toBeLessThanOrEqual(TOL);
        expect(Math.abs(svg.sy - pied.sy)).toBeLessThanOrEqual(TOL);
      }
    }
  });
});
