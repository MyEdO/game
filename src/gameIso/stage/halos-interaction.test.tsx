// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { useGame } from '../../state/store';
import { emptyScene, sceneMetresPerTile, type Scene, type SceneEntity } from '../../state/scene';
import type { Combatant } from '../../engine/types';
import type { Dims } from '../../geometry/iso';
import { MondeDeCampagne } from './MondeDeCampagne';
import { GameStage3D, setStageRendererFactory, type StageWalkAnim } from './GameStage3D';
import { BancRenderer, brancherArdoise, scènes, viderCaptures } from './banc-volumique';
import { HALO_SLOTS } from '../backends/webgl/interactHaloMeshes';
import { haloRadiusK, HALO_RX_PX, type InteractHalo } from '../builders/interactHalos';
import { PING_S } from './interactHaloPose';

/**
 * HALOS D'INTERACTION (#1176, P3-0g). Deux faits distincts s'y mesurent :
 *
 *  1. PRÉSENCE — le décor fouillable appelle le joueur, le drapeau d'épuisement (`__action_<ent>_<action>`)
 *     l'éteint, et le PNJ interlocuteur n'appelle qu'au survol. Ce qui se mesure, c'est ce que les
 *     pools d'anneaux plats peignent et ce qu'ils ne peignent pas.
 *  2. PULSATION PAR FRAME — elle n'est qu'une fonction de l'horloge, rejouée dans la BOUCLE. Le banc
 *     n'appelle donc `root.render` qu'UNE fois : tout ce qui bouge ensuite passe par le battement,
 *     et par lui seul.
 *
 * ANGLES MORTS DÉCLARÉS. (a) Le SURVOL n'est pas posé par un vrai pointeur : jsdom n'a ni layout ni
 * géométrie, donc aucun `pointermove` n'y désigne une tuile. Il passe par la couture DEV de
 * `useStagePointer` (`__wfrpSetHover`, celle de la recette navigateur) — la chaîne pixel → tuile
 * (`stage/pickResolve.ts:pasInterEtages`) reste donc hors mesure ICI, elle est couverte par
 * `stage/pick-parity`. (b) Ce banc
 * ne juge PAS le rendu : jsdom ne rastérise rien — l'apparence (teinte, épaisseur perçue, lueur de
 * survol) se juge au navigateur, pas ici.
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

/** Un décor FOUILLABLE posé sur la carte — l'entité dont le halo est l'affordance. */
const coffre = {
  id: 'coffre',
  kind: 'prop',
  pos: { x: 3, y: 4 },
  ref: 'tonneau',
  usable: { actions: [{ id: 'fouiller', flow: { kind: 'seq', steps: [] }, unique: true }] },
} as unknown as SceneEntity;

/** Un PNJ INTERLOCUTEUR — l'autre CORPS d'un utilisable : un jeton, et le même régime que le décor. */
const marchand = {
  id: 'marchand',
  kind: 'personnage', ref: 'humain',
  pos: { x: 7, y: 2 },
  dialogueId: 'd1',
} as unknown as SceneEntity;

function scèneAvecCoffre(): Scene {
  const s = emptyScene(10, 10);
  return { ...s, entities: [...s.entities, coffre, marchand] };
}

/** Pose le survol comme le fait la souris — par la couture DEV de `useStagePointer`, la même que la
 *  recette navigateur (`__wfrp.hover`) : l'état de survol vit dans ce hook, pas dans le store, et aucun
 *  `pointermove` jsdom ne le poserait (jsdom n'a ni géométrie ni `getBoundingClientRect` utile). */
function survoler(t: { x: number; y: number; z?: number } | null): void {
  const w = window as unknown as { __wfrpSetHover?: (t: unknown) => void };
  expect(w.__wfrpSetHover, 'la couture DEV de survol doit être posée').toBeTypeOf('function');
  act(() => w.__wfrpSetHover!(t));
}

function monter(flags: Record<string, boolean> = {}, reveler = false): HTMLDivElement {
  useGame.setState({
    scene: scèneAvecCoffre(),
    mode: 'exploration',
    partyPos: { x: 6, y: 6 },
    party: [hero('h1', { x: 6, y: 6 })],
    battle: null,
    dialogue: null,
    flags,
    hovered: null,
    pendingAttack: null,
    reveler,
  } as never);
  viderCaptures();
  conteneur = document.createElement('div');
  document.body.appendChild(conteneur);
  root = createRoot(conteneur);
  act(() => root!.render(<MondeDeCampagne />));
  return conteneur;
}

function démonter(): void {
  if (root) { act(() => root!.unmount()); root = null; }
  if (conteneur) { conteneur.remove(); conteneur = null; }
}

/** Les pools de halos de la dernière frame rendue, par slot. */
function poolsVolumiques(): Record<string, THREE.InstancedMesh> {
  const out: Record<string, THREE.InstancedMesh> = {};
  scènes[scènes.length - 1].traverse((o) => {
    const m = o as THREE.InstancedMesh;
    if (m.isInstancedMesh && m.name.startsWith('halos:')) out[m.name.slice('halos:'.length)] = m;
  });
  return out;
}

/** Total des instances peintes par les pools de halos. */
function totalVolumique(): number {
  const p = poolsVolumiques();
  return HALO_SLOTS.reduce((n, slot) => n + (p[slot]?.count ?? 0), 0);
}

beforeAll(() => {
  Object.defineProperty(HTMLCanvasElement.prototype, 'clientWidth', { configurable: true, get: () => TAILLE.w });
  Object.defineProperty(HTMLCanvasElement.prototype, 'clientHeight', { configurable: true, get: () => TAILLE.h });
  setStageRendererFactory(() => new BancRenderer());
});
afterAll(() => setStageRendererFactory(null));

afterEach(() => {
  démonter();
  vi.restoreAllMocks();
});

describe('Halos d’interaction — le monde volumique peint l’affordance (#1176 P3-0g)', () => {
  it('RIEN n’est allumé en permanence ; la RÉVÉLATION allume TOUS les utilisables, décor ET PNJ', () => {
    monter();
    expect(Object.keys(poolsVolumiques()).sort(), 'les pools sont montés d’emblée').toEqual(HALO_SLOTS.slice().sort().map((s) => s));
    expect(totalVolumique(), 'sans Alt ni survol, le champ est muet').toBe(0);
    démonter();

    monter({}, true);
    const p = poolsVolumiques();
    expect(p.haloDisque.count, 'un disque par utilisable : le coffre ET le marchand').toBe(2);
    expect(p.haloContour.count, 'le contour doré').toBeGreaterThan(3);
    expect(p.haloEtincelle.count, 'l’étincelle au-dessus de chacun').toBe(2);
    expect(p.haloDisqueSurvol.count + p.haloContourSurvol.count, 'rien n’est survolé').toBe(0);
  });

  it('ÉPUISEMENT : le drapeau `__action_<ent>_<action>` éteint le halo du décor, pas celui du PNJ', () => {
    monter({ __action_coffre_fouiller: true }, true);
    expect(poolsVolumiques().haloDisque.count, 'un coffre vidé n’appelle plus ; le marchand, si').toBe(1);
    démonter();

    // TÉMOIN : sans le flag, les DEUX appellent (le test ci-dessus ne mesure pas une scène vide).
    monter({}, true);
    expect(poolsVolumiques().haloDisque.count).toBe(2);
  });

  it('le halo volumique est au PIED de son porteur, au rayon que la loi de halo demande', () => {
    monter({}, true);
    const mpt = sceneMetresPerTile(emptyScene(10, 10));
    const m = new THREE.Matrix4();
    const pos = new THREE.Vector3();
    const pieds = [coffre.pos, marchand.pos!].map((c) => ({ x: c.x * mpt, z: c.y * mpt }));
    const disques = poolsVolumiques().haloDisque;
    const posesDisques = [...Array(disques.count).keys()].map((i) => {
      disques.getMatrixAt(i, m);
      pos.setFromMatrixPosition(m);
      return { x: pos.x, z: pos.z };
    });
    for (const pied of pieds)
      expect(posesDisques.some((d) => Math.abs(d.x - pied.x) < 1e-4 && Math.abs(d.z - pied.z) < 1e-4), `${pied.x},${pied.z}`).toBe(true);
    // Les cordes du contour sont sur le cercle dont l'ellipse d'un porteur 1×1 (rayon écran
    // `HALO_RX_PX`, la constante partagée de `builders/interactHalos`) EST la projection — et c'est LE
    // même rayon pour les deux corps : un utilisable n'a pas de kind.
    const contour = poolsVolumiques().haloContour;
    const rAttendu = haloRadiusK(HALO_RX_PX) * mpt;
    for (let i = 0; i < contour.count; i++) {
      contour.getMatrixAt(i, m);
      pos.setFromMatrixPosition(m);
      const écarts = pieds.map((pied) => Math.abs(Math.hypot(pos.x - pied.x, pos.z - pied.z) - rAttendu));
      expect(Math.min(...écarts), `corde ${i}`).toBeLessThan(1e-4);
    }
  });

  it('le SURVOLÉ porte la variante renforcée — un PNJ comme un décor, et lui seul', () => {
    monter();
    expect(poolsVolumiques().haloDisqueSurvol.count, 'sans survol : rien').toBe(0);
    survoler({ x: marchand.pos!.x, y: marchand.pos!.y, z: 0 });
    const p = poolsVolumiques();
    expect(p.haloDisqueSurvol.count, 'le disque renforcé du survolé').toBe(1);
    expect(p.haloContourSurvol.count, 'et son contour doré').toBeGreaterThan(3);
    expect(p.haloDisque.count, 'les autres utilisables restent muets').toBe(0);
    survoler(null);
    expect(totalVolumique()).toBe(0);
  });

  it('SUPPRESSION : le halo retiré vide ses pools AU RENDU, sans attendre un battement', () => {
    monter({}, true);
    expect(poolsVolumiques().haloDisque.count, 'témoin : les deux appellent').toBe(2);
    const frames = scènes.length;
    // Le décor est fouillé : c'est le RENDU qui doit vider les pools — la boucle de pulsation ne bat
    // pas dans ce banc (aucun `requestAnimationFrame` n'est déclenché ici).
    act(() => useGame.setState({ flags: { __action_coffre_fouiller: true } } as never));
    expect(scènes.length, 'le rendu a bien rejoué la scène volumique').toBeGreaterThan(frames);
    expect(poolsVolumiques().haloDisque.count, 'et rien ne reste des instances de la frame précédente').toBe(1);
  });
});

// ── PULSATION PAR FRAME ────────────────────────────────────────────────────────────────────────────

const SCENE_NUE: Scene = emptyScene(10, 10);
const DIMS: Dims = { w: SCENE_NUE.dimensions.w, h: SCENE_NUE.dimensions.h, rot: 0, view: 'iso' };
const HALOS: readonly InteractHalo[] = [
  { id: 'coffre', cell: { x: 3, y: 4, z: 0 }, n: 1, scaleK: 1, bodyTopFrac: 1, span: { w: 1, h: 1 }, centre: { x: 3, y: 4 }, echelle: { x: 1, y: 1 }, etat: 'revele', visible: true },
];

describe('Halos d’interaction — la pulsation se prend à la FRAME (#1176 P3-0g)', () => {
  it('un battement fait avancer la PHASE ; aucun rendu React n’y participe', () => {
    viderCaptures();
    let battre: (() => void) | null = null;
    const anim: StageWalkAnim = {
      subscribe: (onFrame) => { battre = onFrame; return () => { battre = null; }; },
      glide: () => null,
      cam: () => ({ x: 0, y: 0 }),
    };
    // L'HORLOGE du banc : c'est elle, et rien d'autre, qui fait battre les halos.
    let horlogeMs = 0;
    vi.spyOn(performance, 'now').mockImplementation(() => horlogeMs);

    conteneur = document.createElement('div');
    document.body.appendChild(conteneur);
    root = createRoot(conteneur);
    act(() => root!.render(
      <GameStage3D
        scene={SCENE_NUE}
        mpt={sceneMetresPerTile(SCENE_NUE)}
        frame={{ mode: 'plateau', dims: DIMS, cam: { x: 0, y: 0 }, zoom: 1 }}
        tintAt={() => 1}
        keepEl={() => true}
        els={{ tokens: [], props: [] }}
        actors={[]}
        gameTime={720}
        lightLevel={null}
        lights={[]}
        halos={HALOS}
        anim={anim}
      />,
    ));

    expect(battre, 'l’écran doit s’être abonné au battement').toBeTypeOf('function');
    const onde = () => poolsVolumiques().haloOnde;
    const rayonOnde = () => {
      const p = onde();
      const m = new THREE.Matrix4();
      const pos = new THREE.Vector3();
      let somme = 0;
      for (let i = 0; i < p.count; i++) {
        p.getMatrixAt(i, m);
        pos.setFromMatrixPosition(m);
        somme += Math.hypot(pos.x - 3 * sceneMetresPerTile(SCENE_NUE), pos.z - 4 * sceneMetresPerTile(SCENE_NUE));
      }
      return somme / p.count;
    };
    const opacitéHalo = () => (poolsVolumiques().haloDisque.material as THREE.MeshBasicMaterial).opacity;

    expect(onde().count, 'le témoin doit VRAIMENT peindre une onde').toBeGreaterThan(0);
    const r0 = rayonOnde();
    const o0 = opacitéHalo();

    // L'horloge avance SANS aucune écriture React (ni store, ni prop, ni état) : tant que la frame ne se
    // rejoue pas, la scène montée garde la pose et l'opacité précédentes.
    const rendusAvant = scènes.length;
    horlogeMs = PING_S * 1000 * 0.3;
    expect(rayonOnde()).toBe(r0);
    expect(opacitéHalo()).toBe(o0);
    expect(scènes.length, 'avancer l’horloge ne déclenche à lui seul aucune frame').toBe(rendusAvant);

    // UN battement, et rien d'autre : la pulsation suit.
    battre!();
    expect(scènes.length).toBe(rendusAvant + 1);
    expect(rayonOnde(), 'l’onde s’est élargie').toBeGreaterThan(r0);
    expect(opacitéHalo(), 'le halo a changé d’opacité').not.toBe(o0);

    // Et la phase BOUCLE : une période plus tard, on retrouve la pose de départ.
    horlogeMs = PING_S * 1000;
    battre!();
    expect(rayonOnde()).toBeCloseTo(r0, 6);
  });

  it('la BOUCLE de pulsation ne bat QUE s’il y a un halo à l’écran', () => {
    const raf = vi.spyOn(globalThis, 'requestAnimationFrame').mockReturnValue(1 as unknown as number);
    viderCaptures();
    conteneur = document.createElement('div');
    document.body.appendChild(conteneur);
    root = createRoot(conteneur);
    const écran = (halos: readonly InteractHalo[] | undefined) => (
      <GameStage3D
        scene={SCENE_NUE}
        mpt={sceneMetresPerTile(SCENE_NUE)}
        frame={{ mode: 'plateau', dims: DIMS, cam: { x: 0, y: 0 }, zoom: 1 }}
        tintAt={() => 1}
        keepEl={() => true}
        els={{ tokens: [], props: [] }}
        actors={[]}
        gameTime={720}
        lightLevel={null}
        lights={[]}
        halos={halos}
      />
    );
    act(() => root!.render(écran(undefined)));
    expect(raf, 'une scène sans halo ne rejoue pas une frame de plus qu’avant ce lot').not.toHaveBeenCalled();
    act(() => root!.render(écran(HALOS)));
    expect(raf, 'un halo à l’écran ouvre la boucle').toHaveBeenCalled();
  });
});
