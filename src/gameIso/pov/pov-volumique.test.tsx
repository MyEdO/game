// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { useGame } from '../../state/store';
import { poserCapDuGroupe } from '../../state/combatants';
import { emptyScene, isIndoor, sceneMetresPerTile, type BuildingMass, type Scene } from '../../state/scene';
import { setRevealAll } from '../../state/visionState';
import { bus, EVT } from '../../state/bus';
import { meneurDuMonde } from '../../state/combatants';
import { STEP_MAX_M } from '../../state/relief';
import { createHero } from '../../engine/character';
import { makeRNG } from '../../engine/dice';
import { STEP_MS } from '../../geometry/walk';
import type { Dims } from '../../geometry/iso';
import { GameStage3D, setStageRendererFactory } from '../stage/GameStage3D';
import { BancRenderer, brancherArdoise, caméras, scènes, viderCaptures } from '../stage/banc-volumique';
import { hasSpritePicker } from '../stage/spritePicker';
import { battreStageFrames } from '../stage/stageFrames';
import { EYE_H, farTilesOf } from './camera';
import { MondeDeCampagne } from '../stage/MondeDeCampagne';

/**
 * LE POV VOLUMIQUE (#1176, P3-1a) — la vue première personne montée sur le MÊME monde que le stage
 * isométrique, regardée par une caméra PERSPECTIVE à hauteur d'homme. Ce banc mesure les quatre faits
 * que le lot introduit, et rien de l'apparence (jsdom ne rastérise pas ; le goût se juge au navigateur) :
 *
 *  1. l'HÔTE : la branche volumique de `MondeDeCampagne` monte le monde et abandonne le SVG première personne ;
 *  2. la CAMÉRA : une perspective à `heightAt + EYE_H`, bornée à la portée du milieu (`farTilesOf`),
 *     et qui GLISSE avec la marche du meneur au lieu de sauter de case en case ;
 *  3. le DÉGAGEMENT : à hauteur d'œil, TOUTES les masses se dessinent — le cutaway de la vue de plateau
 *     ouvrirait le ciel au-dessus du groupe entré sous un toit ;
 *  4. le PICKER : aucun lanceur de rayon n'est inscrit (cette vue n'a jamais eu d'affordance de clic).
 *
 * IMAGE D'UNE MARCHE : elle se demande au BATTEMENT du stage (`stage/stageFrames`), jamais à un rendu
 * React — c'est le chemin réel (`fx/useWalkAnim` bat à chaque rAF de marche, et n'appelle `setState`
 * qu'à l'arrivée) ; l'œil qui glisse est une valeur de FRAME, et le redessin de l'écran est piloté par
 * ses données (#1371).
 */
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const TAILLE = { w: 800, h: 600 };

let root: Root | null = null;
let conteneur: HTMLDivElement | null = null;

brancherArdoise();

/** Une masse de bâtiment COIFFANTE : le groupe se tient dessous, donc son toit est ce que le cutaway
 *  de la vue de plateau lèverait. */
const TOIT: BuildingMass = {
  id: 'toit-maison',
  z: 0,
  footprint: [{ x: 3, y: 3, w: 4, h: 4 }],
  levels: 1,
  profile: 'gable',
  ridge: 'x',
  pitchDeg: 45,
  material: 'tuile',
};

function scèneCouverte(): Scene {
  const scene = emptyScene(12, 12);
  scene.architecture = [{ id: 'maison', label: 'Maison', style: 'maison', storeys: [], facades: [], masses: [TOIT] }];
  return scene;
}

/** La géométrie du MONDE cuit, telle qu'elle est DESSINÉE : le dégagement compacte l'index en place
 *  (`applyCutawayMask`), donc la somme des comptes de groupe EST ce qui part au GPU. */
function trianglesDuMonde(scene: THREE.Scene): number {
  let total = 0;
  scene.traverse((o) => {
    const g = (o as THREE.Mesh).geometry as THREE.BufferGeometry | undefined;
    if (!g || !g.userData?.surfaceGroups) return;
    for (const grp of g.groups) total += grp.count;
  });
  return total;
}

function poser(): { scene: Scene; heroId: string } {
  const hero = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'A', rng: makeRNG(1) });
  const scene = scèneCouverte();
  useGame.setState({
    screen: 'campaign', mode: 'exploration', party: [hero], scene,
    partyPos: { x: 4, y: 4 }, facing: poserCapDuGroupe({}, 'N'),
    dialogue: null, battle: null, povActive: true, lightLevel: 1,
  } as never);
  return { scene, heroId: hero.id };
}

/** La même scène, dotée d'une carte de HAUTEURS (mètres par case) — le banc de base est PLAT, et un
 *  sol plat ne peut rien dire de la cote sous l'œil. */
function poserRelief(coteM: (x: number, y: number) => number): { scene: Scene; heroId: string } {
  const { scene, heroId } = poser();
  const { w, h } = scene.dimensions;
  scene.layers[0].height = Array.from({ length: w * h }, (_, i) => coteM(i % w, Math.floor(i / w)));
  useGame.setState({ scene: { ...scene } });
  return { scene: useGame.getState().scene!, heroId };
}

function monter(node: JSX.Element): HTMLDivElement {
  viderCaptures();
  conteneur = document.createElement('div');
  document.body.appendChild(conteneur);
  root = createRoot(conteneur);
  act(() => root!.render(node));
  return conteneur;
}

function démonter(): void {
  if (root) { act(() => root!.unmount()); root = null; }
  if (conteneur) { conteneur.remove(); conteneur = null; }
}

const dernièreCaméra = () => caméras[caméras.length - 1];
const dernièreScène = () => scènes[scènes.length - 1];

beforeAll(() => {
  Object.defineProperty(HTMLCanvasElement.prototype, 'clientWidth', { configurable: true, get: () => TAILLE.w });
  Object.defineProperty(HTMLCanvasElement.prototype, 'clientHeight', { configurable: true, get: () => TAILLE.h });
  setStageRendererFactory(() => new BancRenderer());
  setRevealAll(true);
});
afterAll(() => {
  setStageRendererFactory(null);
  setRevealAll(false);
});
beforeEach(() => { poser(); });
afterEach(() => {
  démonter();
  vi.restoreAllMocks();
});

describe('POV volumique — l’hôte (#1176 P3-1a)', () => {
  it('le monde volumique prend toute la place : plus une seule géométrie SVG en première personne', () => {
    const vol = monter(<MondeDeCampagne />);
    expect(vol.querySelector('canvas.iso-stage'), 'le monde volumique doit être monté').toBeTruthy();
    expect(vol.querySelector('canvas')!.getAttribute('data-vue')).toBe('pov');
    // Le SVG première personne (géométrie + billboards) ne se peint plus : il ne reste que les VOILES
    // d'écran (voile chaud, vignette — #1176 P3-1c), qui n'ont ni polygone ni tracé.
    expect(vol.querySelector('svg')!.hasAttribute('data-pov-veils'), 'seul le SVG des voiles subsiste').toBe(true);
    expect(vol.querySelectorAll('polygon, path').length, 'aucune géométrie SVG au-dessus du monde volumique').toBe(0);
  });

  it('l’exploré s’accumule (même couture de store que l’iso)', () => {
    const scene = useGame.getState().scene!;
    expect(useGame.getState().explored[scene.id] ?? []).toEqual([]);
    monter(<MondeDeCampagne />);
    expect(useGame.getState().explored[scene.id] ?? []).toContain('4,4,0');
  });
});

describe('POV volumique — la caméra (#1176 P3-1a)', () => {
  it('PERSPECTIVE à hauteur d’œil, bornée à la portée du milieu (jamais un far généreux)', () => {
    const scene = useGame.getState().scene!;
    monter(<MondeDeCampagne />);
    const cam = dernièreCaméra();
    expect((cam as THREE.PerspectiveCamera).isPerspectiveCamera, 'le POV ne se regarde pas en ortho').toBe(true);
    const mpt = sceneMetresPerTile(scene);
    expect((cam as THREE.PerspectiveCamera).far).toBeCloseTo(farTilesOf(isIndoor(scene)) * mpt, 6);
    // Repère three : Y = haut. L'œil est à la surface du sol plus la taille d'un homme.
    expect(cam.position.y).toBeCloseTo(EYE_H, 6);
    expect(cam.position.x).toBeCloseTo(4 * mpt, 6);
    expect(cam.position.z).toBeCloseTo(4 * mpt, 6);
  });

  it('elle GLISSE avec la marche du meneur : à mi-pas, l’œil est à mi-chemin', () => {
    const { heroId } = poser();
    const scene = useGame.getState().scene!;
    const mpt = sceneMetresPerTile(scene);
    let horlogeMs = 0;
    vi.spyOn(performance, 'now').mockImplementation(() => horlogeMs);
    monter(<MondeDeCampagne />);
    expect(dernièreCaméra().position.z).toBeCloseTo(4 * mpt, 6);

    // Un pas vers le nord, et la MOITIÉ de sa durée : la caméra doit être entre les deux cases.
    act(() => { bus.emit(EVT.ANIM_MOVE, { id: heroId, path: [{ x: 4, y: 4 }, { x: 4, y: 3 }] }); });
    horlogeMs = STEP_MS / 2;
    act(() => battreStageFrames());
    expect(dernièreCaméra().position.z, 'l’œil glisse d’une demi-case').toBeCloseTo(3.5 * mpt, 6);
  });
});

describe('POV volumique — ce que la première personne ne porte PAS (#1176 P3-1a)', () => {
  it('à hauteur d’œil TOUTES les masses se dessinent — le toit du dessus reste en place', () => {
    const scene = useGame.getState().scene!;
    monter(<MondeDeCampagne />);
    const dessinéEnPov = trianglesDuMonde(dernièreScène());
    démonter();

    // Témoin : le MÊME monde, dont le dégagement retire les nappes (ce que fait la vue de plateau
    // quand le groupe entre sous un toit).
    const dims: Dims = { w: scene.dimensions.w, h: scene.dimensions.h, rot: 0, view: 'iso' };
    monter(
      <GameStage3D
        scene={scene}
        mpt={sceneMetresPerTile(scene)}
        frame={{ mode: 'plateau', dims, cam: { x: 0, y: 0 }, zoom: 1 }}
        tintAt={() => 1}
        keepEl={(el) => el.kind !== 'roof'}
        els={{ tokens: [], props: [] }}
        actors={[]}
        gameTime={720}
        lightLevel={null}
        lights={[]}
      />,
    );
    const dessinéSansToit = trianglesDuMonde(dernièreScène());
    expect(dessinéSansToit, 'le témoin doit VRAIMENT retirer quelque chose').toBeGreaterThan(0);
    expect(dessinéEnPov, 'le POV garde les nappes que le cutaway lèverait').toBeGreaterThan(dessinéSansToit);
  });

  it('aucun lanceur de rayon inscrit en POV — la vue affine, elle, en inscrit un', () => {
    const scene = useGame.getState().scene!;
    monter(<MondeDeCampagne />);
    expect(hasSpritePicker(), 'la première personne n’ouvre aucune affordance de clic').toBe(false);
    démonter();

    const dims: Dims = { w: scene.dimensions.w, h: scene.dimensions.h, rot: 0, view: 'iso' };
    monter(
      <GameStage3D
        scene={scene}
        mpt={sceneMetresPerTile(scene)}
        frame={{ mode: 'plateau', dims, cam: { x: 0, y: 0 }, zoom: 1 }}
        tintAt={() => 1}
        keepEl={() => true}
        els={{ tokens: [], props: [] }}
        actors={[]}
        gameTime={720}
        lightLevel={null}
        lights={[]}
      />,
    );
    expect(hasSpritePicker(), 'le témoin doit VRAIMENT inscrire un picker').toBe(true);
  });
});

/**
 * QUI l'œil suit, et à quelle HAUTEUR il se tient. Trois faits que le banc plat d'origine ne pouvait
 * pas mesurer : la scène de base n'a aucune cote, et un roster d'un seul héros valide ne distingue pas
 * la première case du roster du meneur.
 */
describe('POV volumique — le marcheur suivi et la cote sous l’œil (#1176 P3-1a)', () => {
  /** 10 échantillons dans un pas (62,5 Hz) : un cran plus serré que les 60 Hz d'un écran, et des
   *  instants EXACTS (aucun échantillon ne tombe après la fin de la marche). */
  const FRAME_MS = STEP_MS / 10;

  it('l’œil suit le MENEUR VALIDE, pas la première case du roster', () => {
    const mort = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'Mort', rng: makeRNG(2) });
    mort.dead = true;
    const debout = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'Debout', rng: makeRNG(3) });
    const scene = scèneCouverte();
    useGame.setState({
      screen: 'campaign', mode: 'exploration', party: [mort, debout], scene,
      partyPos: { x: 4, y: 4 }, facing: poserCapDuGroupe({}, 'N'),
      dialogue: null, battle: null, povActive: true, lightLevel: 1,
    } as never);
    const mpt = sceneMetresPerTile(scene);
    let horlogeMs = 0;
    vi.spyOn(performance, 'now').mockImplementation(() => horlogeMs);
    monter(<MondeDeCampagne />);
    expect(dernièreCaméra().position.z).toBeCloseTo(4 * mpt, 6);

    // Le store émet la marche pour le meneur VALIDE (`meneurDuMonde`, `store.stepPartyRelative`) : ici
    // le 2e héros, le premier étant mort.
    const meneur = meneurDuMonde(useGame.getState())!;
    expect(meneur.id).toBe(debout.id);
    act(() => { bus.emit(EVT.ANIM_MOVE, { id: meneur.id, path: [{ x: 4, y: 4 }, { x: 4, y: 3 }] }); });
    horlogeMs = STEP_MS / 2;
    act(() => battreStageFrames());
    expect(dernièreCaméra().position.z, 'l’œil glisse avec le marcheur, pas avec le mort en tête de roster').toBeCloseTo(3.5 * mpt, 6);
  });

  it('le SOL porte l’œil : sur un plateau à 2 m, l’œil est à 2 m + EYE_H, à la case comme à mi-pas', () => {
    const { heroId } = poserRelief(() => 2);
    let horlogeMs = 0;
    vi.spyOn(performance, 'now').mockImplementation(() => horlogeMs);
    monter(<MondeDeCampagne />);
    expect(dernièreCaméra().position.y, 'à la case').toBeCloseTo(2 + EYE_H, 6);

    act(() => { bus.emit(EVT.ANIM_MOVE, { id: heroId, path: [{ x: 4, y: 4 }, { x: 4, y: 3 }] }); });
    horlogeMs = STEP_MS / 2;
    act(() => battreStageFrames());
    expect(dernièreCaméra().position.y, 'à position FRACTIONNAIRE, la cote reste celle du plateau').toBeCloseTo(2 + EYE_H, 6);
  });

  it('sur un ressaut FRANCHISSABLE (1 m), la cote de l’œil monte par petits crans, jamais d’un bond', () => {
    // Ressaut d'1 m (= `STEP_MAX_M`, franchissable) entre la case du groupe (y=4, 0 m) et sa voisine
    // nord (y=3, 1 m) : le pas le plus raide qu'un marcheur puisse franchir.
    const { heroId } = poserRelief((_x, y) => (y <= 3 ? STEP_MAX_M : 0));
    let horlogeMs = 0;
    vi.spyOn(performance, 'now').mockImplementation(() => horlogeMs);
    monter(<MondeDeCampagne />);
    const cotes: number[] = [dernièreCaméra().position.y];

    act(() => { bus.emit(EVT.ANIM_MOVE, { id: heroId, path: [{ x: 4, y: 4 }, { x: 4, y: 3 }] }); });
    for (let f = 1; f < 10; f++) {
      horlogeMs = f * FRAME_MS;
      act(() => battreStageFrames());
      cotes.push(dernièreCaméra().position.y);
    }
    let saut = 0;
    for (let i = 1; i < cotes.length; i++) saut = Math.max(saut, Math.abs(cotes[i] - cotes[i - 1]));
    // Borne : le ressaut s'étale sur la durée du pas → au plus `STEP_MAX_M × (frame ÷ STEP_MS)` par
    // échantillon (0,10 m ici ; 0,104 m à 60 Hz). Une cote prise à la case ARRONDIE saute d'1 m d'un coup.
    expect(saut, `saut de cote maximal mesuré : ${saut.toFixed(3)} m`).toBeLessThanOrEqual(STEP_MAX_M * (FRAME_MS / STEP_MS) + 1e-6);
    expect(cotes[0], 'départ : la case basse').toBeCloseTo(EYE_H, 6);
    expect(cotes[cotes.length - 1], 'dernier dixième du pas : quasiment sur le ressaut').toBeCloseTo(0.9 * STEP_MAX_M + EYE_H, 6);
  });
});
