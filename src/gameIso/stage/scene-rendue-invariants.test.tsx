// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { useGame } from '../../state/store';
import { emptyScene, type Scene, type SceneEntity } from '../../noyau/monde/scene';
import type { Combatant } from '../../engine/types';
import { MondeDeCampagne } from './MondeDeCampagne';
import { setStageRendererFactory } from './GameStage3D';
import { BancRenderer, brancherArdoise, scènes, viderCaptures } from './banc-volumique';

/**
 * INVARIANTS DE LA SCÈNE RÉELLEMENT MONTÉE — la mesure SÉMANTIQUE que les gardes textuelles ne
 * peuvent pas rendre : on ne lit plus des littéraux de source, on traverse le graphe three que
 * `MondeDeCampagne` remet au renderer, et on interroge les objets tels qu'ils partiront au dessin.
 *
 *  1. AUCUN matériau `transparent && side === DoubleSide && forceSinglePass === false`. C'est
 *     exactement la condition de la branche à DEUX PASSES de `WebGLRenderer.renderObject` : deux
 *     rendus et deux résolutions de programme par matériau et par frame, avec un `needsUpdate` de
 *     part et d'autre.
 *  2. TOUT `InstancedMesh` vérifie `visible === (count > 0)`. Un pool à zéro instance qui reste
 *     visible traverse le rendu, y résout son programme, et ne peint rien.
 *
 * ANGLES MORTS DÉCLARÉS. (a) Une seule scène (exploration, un coffre fouillable, un héros) : ce qui
 * n'y est pas monté n'est pas mesuré — le combat, la météo et le POV ont leurs propres bancs. (b) Les
 * BILLBOARDS n'entrent pas dans ce relevé : jsdom n'a pas `URL.createObjectURL`, donc leur texture ne
 * se rastérise pas et le quad est sauté au montage ; leurs matériaux se mesurent en unité
 * (`stage/boardPose.test.ts`). (c) jsdom ne rastérise rien : ce banc ne juge aucune apparence,
 * seulement l'état des objets three.
 */
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const TAILLE = { w: 800, h: 600 };

let root: Root | null = null;
let conteneur: HTMLDivElement | null = null;

brancherArdoise();

function hero(id: string, pos: { x: number; y: number }): Combatant {
  return {
    id, label: id, kind: 'hero', pos, size: 'moyenne',
    wounds: { current: 12, max: 12 }, weapons: [],
    characteristics: { 'capacite-de-combat': 40, force: 30, endurance: 30, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 },
    advantage: 0, conditions: [], armour: {},
    skills: [], talents: [], movement: 4,
  } as unknown as Combatant;
}

/** Un décor FOUILLABLE : il monte les pools de halos, dont plusieurs restent à zéro instance. */
const coffre = {
  id: 'coffre',
  kind: 'prop',
  pos: { x: 3, y: 4 },
  ref: 'tonneau',
  usable: { actions: [{ id: 'fouiller', flow: { kind: 'seq', steps: [] }, unique: true }] },
} as unknown as SceneEntity;

function scèneAvecCoffre(): Scene {
  const s = emptyScene(10, 10);
  return { ...s, entities: [...s.entities, coffre] };
}

function monter(): void {
  useGame.setState({
    scene: scèneAvecCoffre(),
    mode: 'exploration',
    partyPos: { x: 6, y: 6 },
    party: [hero('h1', { x: 6, y: 6 })],
    battle: null,
    dialogue: null,
    flags: {},
    hovered: null,
    pendingAttack: null,
  } as never);
  viderCaptures();
  conteneur = document.createElement('div');
  document.body.appendChild(conteneur);
  root = createRoot(conteneur);
  act(() => root!.render(<MondeDeCampagne />));
}

/** Le nom lisible d'un objet de la scène — un maillage anonyme se désigne par son type. */
const nomDe = (o: THREE.Object3D) => o.name || `<${o.type}>`;

/** Tous les matériaux de la dernière scène rendue, avec le nom de l'objet qui les porte. */
function matériaux(): { nom: string; mat: THREE.Material }[] {
  const out: { nom: string; mat: THREE.Material }[] = [];
  scènes[scènes.length - 1].traverse((o) => {
    const m = (o as THREE.Mesh).material;
    if (!m) return;
    for (const mat of Array.isArray(m) ? m : [m]) out.push({ nom: nomDe(o), mat });
  });
  return out;
}

function pools(): THREE.InstancedMesh[] {
  const out: THREE.InstancedMesh[] = [];
  scènes[scènes.length - 1].traverse((o) => {
    if ((o as THREE.InstancedMesh).isInstancedMesh) out.push(o as THREE.InstancedMesh);
  });
  return out;
}

beforeAll(() => {
  Object.defineProperty(HTMLCanvasElement.prototype, 'clientWidth', { configurable: true, get: () => TAILLE.w });
  Object.defineProperty(HTMLCanvasElement.prototype, 'clientHeight', { configurable: true, get: () => TAILLE.h });
  setStageRendererFactory(() => new BancRenderer());
});
afterAll(() => setStageRendererFactory(null));

afterEach(() => {
  if (root) { act(() => root!.unmount()); root = null; }
  if (conteneur) { conteneur.remove(); conteneur = null; }
});

describe('Scène montée — invariants de coût du rendu', () => {
  it('aucun matériau ne part en DEUX PASSES (transparent + DoubleSide sans forceSinglePass)', () => {
    monter();
    const relevé = matériaux();
    expect(relevé.length, 'témoin : la scène porte bien des matériaux').toBeGreaterThan(0);
    const doublés = relevé
      .filter(({ mat }) => mat.transparent && mat.side === THREE.DoubleSide && mat.forceSinglePass === false)
      .map(({ nom, mat }) => `${nom} (${mat.type})`);
    expect(doublés, `Router par materiauPlanTransparent :\n${doublés.join('\n')}`).toEqual([]);
  });

  it('tout pool d’instances est visible SI ET SEULEMENT SI il a quelque chose à peindre', () => {
    monter();
    const p = pools();
    expect(p.length, 'témoin : la scène porte bien des pools').toBeGreaterThan(0);
    expect(p.some((m) => m.count === 0), 'témoin : au moins un pool est vide dans cette scène').toBe(true);
    const écarts = p.filter((m) => m.visible !== m.count > 0).map((m) => `${nomDe(m)} : count=${m.count} visible=${m.visible}`);
    expect(écarts, `Router par poserCompteInstances :\n${écarts.join('\n')}`).toEqual([]);
  });
});
