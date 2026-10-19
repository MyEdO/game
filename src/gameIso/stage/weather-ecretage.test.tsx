// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import * as THREE from 'three';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { useGame } from '../../state/store';
import { emptyScene, sceneMetresPerTile, type BuildingMass, type Scene } from '../../noyau/monde/scene';
import { setRevealAll } from '../../state/visionState';
import type { Combatant } from '../../engine/types';
import { MondeDeCampagne } from './MondeDeCampagne';
import { setStageRendererFactory } from './GameStage3D';
import { BancRenderer, brancherArdoise, scènes, viderCaptures } from './banc-volumique';
import { clearedSpace, massFootprintCells, massSpaceCells, shelterField, shelterSectionAt } from '../builders/roofs';
import { cutawayForSection } from './architectureVisibility';

/**
 * ÉCRÊTAGE DE LA PLUIE AU CUTAWAY (#1247) — la précipitation s'arrête sous le couvert du PLAN
 * (`shelterField`, qui ignore la vue). Quand la VUE lève la nappe qui coiffe une colonne, ce qui
 * tombait dessus s'arrêtait donc EN L'AIR, au-dessus d'un toit qu'on ne dessine plus.
 *
 * Ce banc mesure le geste sur le chemin RÉEL (`MondeDeCampagne` en voie volumique, les matrices d'instance
 * telles qu'elles partent au GPU) et ses deux invariants :
 *  - la colonne coiffée par une section CACHÉE ne rend AUCUNE particule (la colonne entière, pas
 *    « au-dessus du faîte » : la pluie réapparaîtrait entre l'égout et le faîte) ;
 *  - le CHAMP ne bouge pas : ni son compte, ni son objet — l'écrêtage n'est pas une emprise, donc il
 *    ne re-sème rien au pas du cutaway.
 */
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const TAILLE = { w: 800, h: 600 };
/** La masse qui coiffe le carré de cases (3,3)-(6,6). */
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
const SOUS_TOIT = { x: 4, y: 4 };
/** Dehors, à l'écart du bâtiment. Une masse qui recouvre le groupe en PROJECTION n'est plus retirée
 *  (#1176, M3) — ce cas-ci mesure le toit DESSINÉ, et rien ne le retire tant que le groupe n'est pas
 *  dessous. */
const DEHORS = { x: 10, y: 10 };

let root: Root | null = null;
let conteneur: HTMLDivElement | null = null;

brancherArdoise();

function hero(id: string, pos: { x: number; y: number }): Combatant {
  return {
    id, label: id, kind: 'hero', pos, size: 'moyenne',
    wounds: { current: 12, max: 12 }, weapons: [],
    characteristics: {}, advantage: 0, conditions: [], armour: {},
    skills: [], talents: [], movement: 4,
  } as unknown as Combatant;
}

function scèneCouverte(): Scene {
  const scene = emptyScene(12, 12);
  scene.weather = 'pluie';
  scene.architecture = [{ id: 'maison', label: 'Maison', style: 'maison', storeys: [], facades: [], masses: [TOIT] }];
  return scene;
}

/** Pose le groupe à `pos` sur la scène donnée (la MÊME référence d'un cas à l'autre : c'est ce qui
 *  rend le champ de pluie comparable). La carte est ENTIÈREMENT explorée : la vue d'une nappe dépend
 *  aussi de ce que le groupe a vu (`seenSections`, #950), et ce banc mesure le cutaway, pas la
 *  découverte. */
function poser(scene: Scene, pos: { x: number; y: number }): void {
  const { w, h } = scene.dimensions;
  const toutes: string[] = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) toutes.push(`${x},${y},0`);
  useGame.setState({
    screen: 'campaign',
    scene,
    mode: 'exploration',
    partyPos: pos,
    party: [hero('h1', pos)],
    explored: { [scene.id]: toutes },
    battle: null,
    dialogue: null,
    flags: {},
    lightLevel: 1,
  } as never);
}

function monter(): HTMLDivElement {
  viderCaptures();
  conteneur = document.createElement('div');
  document.body.appendChild(conteneur);
  root = createRoot(conteneur);
  act(() => root!.render(<MondeDeCampagne />));
  return conteneur;
}

const dernièreScène = () => scènes[scènes.length - 1];
const semisMonté = () => dernièreScène().getObjectByName('precip') as THREE.InstancedMesh;

/** Les particules du semis, avec leur case et la nullité de leur base (un quad effondré ne peint
 *  rien). C'est la matrice d'instance TELLE QU'ELLE PART AU GPU, pas une intention. */
function particules(mesh: THREE.InstancedMesh, mpt: number): { x: number; y: number; rendue: boolean }[] {
  const m = mesh.instanceMatrix.array as Float32Array;
  const out: { x: number; y: number; rendue: boolean }[] = [];
  for (let i = 0; i < mesh.count; i++) {
    const o = i * 16;
    const base = [0, 1, 2, 4, 5, 6, 8, 9, 10].map((k) => m[o + k]);
    out.push({
      x: Math.round(m[o + 12] / mpt),
      y: Math.round(m[o + 14] / mpt),
      rendue: base.some((v) => v !== 0),
    });
  }
  return out;
}

const sousLeToit = (p: { x: number; y: number }) => p.x >= 3 && p.x <= 6 && p.y >= 3 && p.y <= 6;

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
afterEach(() => {
  // Le drapeau de recette est un SINGLETON d'état que la suite partage : un cas qui le débraye le
  // rend ici, jamais en dernière ligne d'un `it` (une assertion qui lève avant sauterait la remise).
  useGame.setState({ debugRoofCut: true });
  if (root) { act(() => root!.unmount()); root = null; }
  if (conteneur) { conteneur.remove(); conteneur = null; }
});

describe('Météo volumique — écrêtage au cutaway (#1247)', () => {
  it('la SONDE du cas : allié sous une masse NON ZONÉE ⇒ la section est CACHÉE', () => {
    const scene = scèneCouverte();
    const cleared = clearedSpace(scene, [{ ...SOUS_TOIT, z: 0 }], new Set(['4,4,0']));
    expect(cutawayForSection({
      sectionId: TOIT.id,
      roomZoneIds: [],
      cells: massSpaceCells(TOIT, massFootprintCells(TOIT.footprint)),
    }, cleared)).toBe('hidden');
    // …et la colonne du groupe est bien coiffée par CETTE section.
    expect(shelterSectionAt(shelterField(scene), SOUS_TOIT.x, SOUS_TOIT.y)).toBe(TOIT.id);
  });

  it('TOIT VU (groupe dehors) : la pluie tombe au-dessus du toit — rien n’est écrêté', () => {
    const scene = scèneCouverte();
    poser(scene, DEHORS);
    monter();
    const mpt = sceneMetresPerTile(scene);
    const ps = particules(semisMonté(), mpt);
    const dessus = ps.filter(sousLeToit);
    expect(dessus.length, 'témoin : le semis doit VRAIMENT poser des particules sur ces colonnes').toBeGreaterThan(0);
    expect(dessus.every((p) => p.rendue), 'toit dessiné : ce qui s’arrête dessus se voit').toBe(true);
  });

  it('TOIT RETIRÉ (groupe dessous) : AUCUNE particule rendue sur ses colonnes, la pluie continue ailleurs', () => {
    const scene = scèneCouverte();
    poser(scene, SOUS_TOIT);
    monter();
    const mpt = sceneMetresPerTile(scene);
    const ps = particules(semisMonté(), mpt);
    const dessus = ps.filter(sousLeToit);
    expect(dessus.length, 'témoin : des particules occupent bien ces colonnes').toBeGreaterThan(0);
    expect(dessus.filter((p) => p.rendue).length, 'la pluie ne s’arrête plus en l’air au-dessus d’un toit non peint').toBe(0);
    expect(ps.filter((p) => !sousLeToit(p) && p.rendue).length, 'dehors, il pleut toujours').toBeGreaterThan(0);
  });

  it('le CHAMP ne se re-sème pas au cutaway : même semis, même compte, d’un cas à l’autre', () => {
    const scene = scèneCouverte();
    poser(scene, DEHORS);
    monter();
    const avant = semisMonté();
    const compteAvant = avant.count;
    expect(compteAvant).toBeGreaterThan(0);

    act(() => { poser(scene, SOUS_TOIT); });
    act(() => root!.render(<MondeDeCampagne />));
    const après = semisMonté();
    expect(après, 'le semis est RETENU : l’écrêtage n’entre pas dans sa clé').toBe(avant);
    expect(après.count).toBe(compteAvant);
    // …et le geste a bien eu lieu sur ce MÊME semis.
    expect(particules(après, sceneMetresPerTile(scene)).filter((p) => sousLeToit(p) && p.rendue).length).toBe(0);
  });

  it('roofCut(false) (#1478) : le lève-toit DÉBRAYÉ laisse la nappe qui coiffe le groupe PEINTE', () => {
    const scene = scèneCouverte();
    // Témoin — lève-toit ACTIF (défaut de jeu) : la nappe qui coiffe le groupe est retirée, et la
    // pluie de ses colonnes est écrêtée (c'est le cas mesuré ci-dessus).
    poser(scene, SOUS_TOIT);
    useGame.setState({ debugRoofCut: true });
    monter();
    expect(
      particules(semisMonté(), sceneMetresPerTile(scene)).filter((p) => sousLeToit(p) && p.rendue).length,
      'témoin : lève-toit ACTIF, la nappe est retirée — rien ne s’arrête dessus',
    ).toBe(0);
    act(() => root!.unmount());
    root = null;
    conteneur!.remove();
    conteneur = null;

    // Lève-toit DÉBRAYÉ, même scène, même position : la nappe revient au monde cuit, et la pluie
    // s'arrête de nouveau dessus — c'est ce qu'on va juger à l'écran.
    poser(scene, SOUS_TOIT);
    useGame.setState({ debugRoofCut: false });
    monter();
    const dessus = particules(semisMonté(), sceneMetresPerTile(scene)).filter(sousLeToit);
    expect(dessus.length, 'témoin : des particules occupent bien ces colonnes').toBeGreaterThan(0);
    expect(dessus.every((p) => p.rendue), 'toit peint : ce qui s’arrête dessus se voit').toBe(true);
  });

  it('la NAPPE de brume ne se rebâtit pas au pas du groupe : le MÊME mesh d’un pas à l’autre', () => {
    const scene = scèneCouverte();
    scene.weather = 'brouillard'; // le type qui porte des nappes en donnée
    poser(scene, DEHORS);
    monter();
    const avant = dernièreScène().getObjectByName('brume:0');
    expect(avant, 'témoin : la scène monte bien une nappe').toBeTruthy();

    // Un pas de combattant : le store rend une NOUVELLE référence de scène, au même contenu.
    act(() => { poser({ ...scene }, SOUS_TOIT); });
    act(() => root!.render(<MondeDeCampagne />));
    expect(dernièreScène().getObjectByName('brume:0'), 'la géométrie de nappe survit au pas').toBe(avant);
  });
});
