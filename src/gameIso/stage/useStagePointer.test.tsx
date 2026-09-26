// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { act, useRef } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screenToTileAtZ, tileCenter, type Dims } from '../../geometry/iso';
import { emptyScene, isWalkable, setDoorOpen } from '../../state/scene';
import { metricToLift } from '../../state/relief';
import { walkNeighbors } from '../../state/path';
import { chebyshev } from '../../engine/grid';
import { resolveCursorZ } from '../../state/combatCursor';
import { placesJouables, seatPoseOf, seatSlotsOf } from '../../state/seating';
import { cleActionJouee, estUtilisable } from '../../state/usable';
import { interactionHalos } from '../builders/interactHalos';
import type { BillboardPropEl } from '../builders/types';
import { exploreMovePlan, exploreSeatPlan } from '../../state/exploreNav';
import { offresUtilisables } from '../../state/offresUtilisables';
import { useGame } from '../../state/store';
import { props } from '../../data';
import { bus, EVT } from '../../state/bus';
import { STEP_MS } from '../../geometry/walk';
import type { Combatant } from '../../engine/types';
import type { RoomPortal } from '../../state/roomPortals';
import { aretesUtilisables, type AreteUtilisable } from '../../state/aretes';
import { projeterAretes } from './aretesProjetees';
import { VH, VW } from './useStageCamera';
import { useStagePointer, type StagePointer } from './useStagePointer';
import { setSpritePicker } from './spritePicker';
import { SENSIBILITE_DRAG_DEG_PX, getStageYaw, poserYaw, resetStageYaw } from '../../state/stageYaw';
import { getStagePan, resetStagePan } from '../../state/stagePan';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
Object.defineProperty(window, 'matchMedia', { configurable: true, value: vi.fn() });
// L'implémentation par défaut se REPOSE avant CHAQUE test : `restoreMocks: true` (vite.config.ts)
// rend tout espion et tout `vi.fn()` à son état nu entre deux tests, y compris celui-ci. Un test qui
// ne la pose pas lui-même lirait sinon `undefined` au lieu d'un `MediaQueryList`.
// `matches: true` = pointeur FIN (souris) : le défaut de ce banc ; un test tactile pose `false`.
beforeEach(() => {
  vi.mocked(window.matchMedia).mockReturnValue({ matches: true } as unknown as MediaQueryList);
});

const dims: Dims = { w: 8, h: 8, rot: 0, view: 'iso' };

/** Un décor encore BILLBOARD, DÉRIVÉ du catalogue : la vague volumique (#1343) convertit les refs lot
 *  par lot — une ref écrite en dur ferait rougir cette garde le jour de SA recette. */
const REF_BILLBOARD = props.find((p) => !p.volume)!.id;

/** Élément de stage MESURÉ : sa surface vaut exactement le viewBox (VW×VH) posé au coin (0,0) — le
 *  recouvrement `slice` y vaut donc 1, et un pixel client EST un point de viewBox. C'est le contrat
 *  que le picking inverse (`viewBoxPointAt` puis `stagePointAt`, `stage/stageCam.ts`) : une géométrie
 *  d'élément, jamais un CTM de SVG — la voie volumique peint sur un canevas, qui n'en a pas. */
function stageEl(): SVGSVGElement {
  return {
    getBoundingClientRect: () => ({ left: 0, top: 0, width: VW, height: VH }) as DOMRect,
    setPointerCapture: () => undefined,
    releasePointerCapture: () => undefined,
  } as unknown as SVGSVGElement;
}

const portal: RoomPortal = {
  id: '0:2,2:N:room-a:room-b',
  z: 0,
  edge: { x: 2, y: 2, side: 'N' },
  fromZoneId: 'room-a',
  toZoneId: 'room-b',
  kind: 'passage',
  exterior: false,
  from: { x: 2, y: 1 },
  to: { x: 2, y: 2 },
};
const closedExteriorPortal: RoomPortal = {
  id: '0:0,1:E:exterior:room-a',
  z: 0,
  edge: { x: 0, y: 1, side: 'E' },
  fromZoneId: null,
  toZoneId: 'room-a',
  kind: 'door-closed',
  exterior: true,
  from: { x: 0, y: 1 },
  to: { x: 1, y: 1 },
};

/** L'ARÊTE d'un accès, dérivée comme l'hôte la dérive (`state/aretes.ts`) : le verdict de pixel et la
 *  touche Entrée du peintre passent tous deux par elle, jamais par le `RoomPortal` nu. */
const areteDe = (p: RoomPortal): AreteUtilisable => aretesUtilisables({
  scene: emptyScene(1, 1),
  visible: new Set([`${p.from.x},${p.from.y},${p.z}`]),
  controleur: null,
  activeZ: p.z,
  portails: [p],
})[0];

function pointerEvent(x: number, y: number) {
  return {
    button: 0,
    clientX: x,
    clientY: y,
    pointerId: 1,
    currentTarget: { style: {} },
  } as unknown as React.PointerEvent;
}

// Ce banc remplace l'ACTION `moveParty` du store par une sonde. Le store est partagé par toute la
// suite (`isolate: false`) : une action laissée stubbée fait tourner à vide le pas d'un fichier
// voisin, qui mesure alors un monde qui ne bouge plus.
const MOVE_PARTY_VRAI = useGame.getState().moveParty;
afterEach(() => useGame.setState({ moveParty: MOVE_PARTY_VRAI }));

describe('useStagePointer — picking exploration', () => {
  let root: Root | null = null;
  const unsubs: (() => void)[] = [];

  afterEach(() => {
    for (const unsub of unsubs.splice(0)) unsub();
    if (root) {
      act(() => root!.unmount());
      root = null;
    }
    vi.useRealTimers();
  });

  it('préfère la surface marchable de activeZ à une couche supérieure superposée', () => {
    vi.useFakeTimers();
    const scene = emptyScene(8, 8);
    const upper = new Array(64).fill('vide');
    upper[5 + 5 * 8] = 'herbe';
    scene.layers.push({ z: 1, tiles: upper });
    const moveParty = vi.fn();
    useGame.setState({
      scene,
      mode: 'exploration',
      partyPos: { x: 2, y: 1 },
      party: [],
      dialogue: null,
      moveParty,
    });

    let pointer: StagePointer | undefined;
    const Probe = () => {
      const svgRef = useRef(stageEl());
      const camRef = useRef({ x: 0, y: 0 });
      pointer = useStagePointer({
        svgRef,
        dims,
        zoom: 1,
        camRef,
        hoverTracking: false,
        partyLeader: undefined,
        activeZ: 0,
        aretes: [],
      });
      return null;
    };
    renderToStaticMarkup(<Probe />);

    const center = tileCenter(2, 2, dims);
    expect(screenToTileAtZ(center.cx, center.cy, dims, 1)).toEqual({ x: 5, y: 5 });
    expect(isWalkable(scene, 5, 5, 1)).toBe(true);
    expect(resolveCursorZ(scene, 5, 5)).toBe(1);
    const event = pointerEvent(center.cx, center.cy);
    pointer!.handlers.onPointerDown(event);
    pointer!.handlers.onPointerUp(event);
    vi.runAllTimers();

    expect(moveParty).toHaveBeenLastCalledWith({ x: 2, y: 2 });
  });

  it('efface le hover au clic exploration accepté et ne le recrée qu’au prochain pointer move', () => {
    vi.useFakeTimers();
    const scene = emptyScene(8, 8);
    useGame.setState({
      scene,
      mode: 'exploration',
      partyPos: { x: 2, y: 1 },
      party: [],
      dialogue: null,
      moveParty: vi.fn(),
    });

    let pointer: StagePointer | undefined;
    const Probe = () => {
      const svgRef = useRef(stageEl());
      const camRef = useRef({ x: 0, y: 0 });
      pointer = useStagePointer({
        svgRef,
        dims,
        zoom: 1,
        camRef,
        hoverTracking: false,
        partyLeader: undefined,
        activeZ: 0,
        aretes: [],
      });
      return null;
    };

    const container = document.createElement('div');
    root = createRoot(container);
    act(() => root!.render(<Probe />));
    const center = tileCenter(2, 2, dims);
    const event = pointerEvent(center.cx, center.cy);

    act(() => pointer!.handlers.onPointerMove(event));
    expect(pointer!.hover).toEqual({ x: 2, y: 2 });

    act(() => {
      pointer!.handlers.onPointerDown(event);
      pointer!.handlers.onPointerUp(event);
    });
    expect(pointer!.hover).toBeNull();

    act(() => vi.runAllTimers());
    expect(pointer!.hover).toBeNull();

    act(() => pointer!.handlers.onPointerMove(event));
    expect(pointer!.hover).toEqual({ x: 2, y: 2 });
  });

  it('n’anime aucun pas au-delà de la position logique quand un dialogue interrompt la marche', () => {
    vi.useFakeTimers();
    const scene = emptyScene(8, 8);
    const moveParty = vi.fn((pos: { x: number; y: number; z?: number }) => {
      useGame.setState({
        partyPos: pos,
        dialogue: {} as NonNullable<ReturnType<typeof useGame.getState>['dialogue']>,
      });
    });
    useGame.setState({
      scene,
      mode: 'exploration',
      partyPos: { x: 2, y: 1 },
      party: [],
      dialogue: null,
      moveParty,
    });
    const emitted: { id: string; path: { x: number; y: number }[] }[] = [];
    unsubs.push(bus.on(EVT.ANIM_MOVE, (payload) => emitted.push(payload)));

    let pointer: StagePointer | undefined;
    const Probe = () => {
      const svgRef = useRef(stageEl());
      const camRef = useRef({ x: 0, y: 0 });
      pointer = useStagePointer({
        svgRef,
        dims,
        zoom: 1,
        camRef,
        hoverTracking: false,
        partyLeader: { id: 'hero' } as Combatant,
        activeZ: 0,
        aretes: [],
      });
      return null;
    };
    renderToStaticMarkup(<Probe />);

    const center = tileCenter(2, 4, dims);
    const event = pointerEvent(center.cx, center.cy);
    pointer!.handlers.onPointerDown(event);
    pointer!.handlers.onPointerUp(event);
    vi.advanceTimersByTime(STEP_MS * 4);

    expect(moveParty).toHaveBeenCalledTimes(1);
    expect(useGame.getState().partyPos).toEqual({ x: 2, y: 2 });
    expect(emitted).toEqual([{ id: 'hero', path: [{ x: 2, y: 1 }, { x: 2, y: 2 }] }]);
  });

  it('arrête la marche avant toute nouvelle émission si la scène active est remplacée', () => {
    vi.useFakeTimers();
    const scene = emptyScene(8, 8);
    const replacement = emptyScene(8, 8);
    replacement.id = 'replacement';
    const moveParty = vi.fn((pos: { x: number; y: number; z?: number }) => {
      useGame.setState({ scene: replacement, partyPos: pos, mode: 'exploration', dialogue: null });
    });
    useGame.setState({
      scene,
      mode: 'exploration',
      partyPos: { x: 2, y: 1 },
      party: [],
      dialogue: null,
      moveParty,
    });
    const emitted: { id: string; path: { x: number; y: number }[] }[] = [];
    unsubs.push(bus.on(EVT.ANIM_MOVE, (payload) => emitted.push(payload)));

    let pointer: StagePointer | undefined;
    const Probe = () => {
      const svgRef = useRef(stageEl());
      const camRef = useRef({ x: 0, y: 0 });
      pointer = useStagePointer({
        svgRef,
        dims,
        zoom: 1,
        camRef,
        hoverTracking: false,
        partyLeader: { id: 'hero' } as Combatant,
        activeZ: 0,
        aretes: [],
      });
      return null;
    };
    renderToStaticMarkup(<Probe />);

    const center = tileCenter(2, 4, dims);
    const event = pointerEvent(center.cx, center.cy);
    pointer!.handlers.onPointerDown(event);
    pointer!.handlers.onPointerUp(event);
    vi.advanceTimersByTime(STEP_MS * 4);

    expect(useGame.getState().scene).toBe(replacement);
    expect(moveParty).toHaveBeenCalledTimes(1);
    expect(emitted).toEqual([{ id: 'hero', path: [{ x: 2, y: 1 }, { x: 2, y: 2 }] }]);
  });

  it('anime un trajet complet par émissions contiguës cadencées et atteint la destination', () => {
    vi.useFakeTimers();
    const scene = emptyScene(8, 8);
    const moveParty = vi.fn((pos: { x: number; y: number; z?: number }) => useGame.setState({ partyPos: pos }));
    useGame.setState({
      scene,
      mode: 'exploration',
      partyPos: { x: 2, y: 1 },
      party: [],
      dialogue: null,
      moveParty,
    });
    const emitted: { id: string; path: { x: number; y: number }[] }[] = [];
    unsubs.push(bus.on(EVT.ANIM_MOVE, (payload) => emitted.push(payload)));

    let pointer: StagePointer | undefined;
    const Probe = () => {
      const svgRef = useRef(stageEl());
      const camRef = useRef({ x: 0, y: 0 });
      pointer = useStagePointer({
        svgRef,
        dims,
        zoom: 1,
        camRef,
        hoverTracking: false,
        partyLeader: { id: 'hero' } as Combatant,
        activeZ: 0,
        aretes: [],
      });
      return null;
    };
    renderToStaticMarkup(<Probe />);

    const center = tileCenter(2, 4, dims);
    const event = pointerEvent(center.cx, center.cy);
    pointer!.handlers.onPointerDown(event);
    pointer!.handlers.onPointerUp(event);

    expect(emitted).toEqual([{ id: 'hero', path: [{ x: 2, y: 1 }, { x: 2, y: 2 }] }]);
    vi.advanceTimersByTime(STEP_MS);
    expect(emitted[emitted.length - 1]?.path).toEqual([{ x: 2, y: 2 }, { x: 2, y: 3 }]);
    vi.advanceTimersByTime(STEP_MS);
    expect(emitted[emitted.length - 1]?.path).toEqual([{ x: 2, y: 3 }, { x: 2, y: 4 }]);
    vi.runAllTimers();

    expect(emitted).toHaveLength(3);
    expect(moveParty).toHaveBeenCalledTimes(3);
    expect(useGame.getState().partyPos).toEqual({ x: 2, y: 4 });
  });

  it('continue sans rollback après un remplacement immutable de la même scène', () => {
    vi.useFakeTimers();
    const scene = emptyScene(8, 8);
    const positions: { x: number; y: number; z?: number }[] = [];
    const moveParty = vi.fn((pos: { x: number; y: number; z?: number }) => {
      positions.push(pos);
      useGame.setState((state) => ({
        partyPos: pos,
        scene: { ...state.scene!, flags: { ...state.scene!.flags, revealed: true } },
      }));
    });
    useGame.setState({
      scene,
      mode: 'exploration',
      partyPos: { x: 2, y: 1 },
      party: [],
      dialogue: null,
      moveParty,
    });

    let pointer: StagePointer | undefined;
    const Probe = () => {
      const svgRef = useRef(null);
      const camRef = useRef({ x: 0, y: 0 });
      pointer = useStagePointer({
        svgRef,
        dims,
        zoom: 1,
        camRef,
        hoverTracking: false,
        partyLeader: undefined,
        activeZ: 0,
        aretes: [],
      });
      return null;
    };
    renderToStaticMarkup(<Probe />);

    pointer!.activerArete(areteDe({ ...portal, to: { x: 2, y: 4 } }));
    vi.runAllTimers();

    expect(positions).toEqual([{ x: 2, y: 2 }, { x: 2, y: 3 }, { x: 2, y: 4 }]);
    expect(positions.filter((position) => position.y === 4)).toHaveLength(1);
  });

  it('s’arrête avant un seuil refermé entre deux pas sans restaurer une ancienne position', () => {
    vi.useFakeTimers();
    const scene = emptyScene(8, 8);
    scene.walls = [{ x: 2, y: 3, side: 'N', door: true }];
    const positions: { x: number; y: number; z?: number }[] = [];
    const moveParty = vi.fn((pos: { x: number; y: number; z?: number }) => {
      positions.push(pos);
      useGame.setState((state) => ({
        partyPos: pos,
        scene: positions.length === 1
          ? setDoorOpen(state.scene!, 2, 3, 'N', 0, false)
          : state.scene,
      }));
    });
    useGame.setState({
      scene,
      mode: 'exploration',
      partyPos: { x: 2, y: 1 },
      party: [],
      dialogue: null,
      moveParty,
    });

    let pointer: StagePointer | undefined;
    const Probe = () => {
      const svgRef = useRef(null);
      const camRef = useRef({ x: 0, y: 0 });
      pointer = useStagePointer({
        svgRef,
        dims,
        zoom: 1,
        camRef,
        hoverTracking: false,
        partyLeader: undefined,
        activeZ: 0,
        aretes: [],
      });
      return null;
    };
    renderToStaticMarkup(<Probe />);

    pointer!.activerArete(areteDe({ ...portal, to: { x: 2, y: 4 } }));
    vi.runAllTimers();

    expect(positions).toEqual([{ x: 2, y: 2 }]);
    expect(useGame.getState().partyPos).toEqual({ x: 2, y: 2 });
  });

  it('le CLIC sur le pixel d’un seuil passe par le VERDICT et joue LE geste de l’arête', () => {
    vi.useFakeTimers();
    const scene = emptyScene(8, 8);
    const positions: { x: number; y: number; z?: number }[] = [];
    useGame.setState({
      scene,
      mode: 'exploration',
      partyPos: { x: 2, y: 1 },
      party: [],
      dialogue: null,
      moveParty: (pos) => {
        positions.push(pos);
        useGame.setState({ partyPos: pos });
      },
    });
    // L'offre que l'hôte projette, à la géométrie du peintre : un seul accès, l'arête N de (2,2).
    const aretes = projeterAretes([areteDe(portal)], dims, () => 0);
    const [a, b] = [aretes[0].a, aretes[0].b];
    const pixel = pointerEvent((a.cx + b.cx) / 2, (a.cy + b.cy) / 2);

    let pointer: StagePointer | undefined;
    const Probe = () => {
      const svgRef = useRef(stageEl());
      const camRef = useRef({ x: 0, y: 0 });
      pointer = useStagePointer({
        svgRef,
        dims,
        zoom: 1,
        camRef,
        hoverTracking: false,
        partyLeader: undefined,
        activeZ: 0,
        aretes,
      });
      return null;
    };
    const container = document.createElement('div');
    root = createRoot(container);
    act(() => root!.render(<Probe />));

    act(() => pointer!.handlers.onPointerDown(pixel));
    act(() => pointer!.handlers.onPointerUp(pixel));
    act(() => vi.runAllTimers());

    expect(positions).toEqual([{ x: 2, y: 2 }]);
  });

  it('réutilise la confirmation tactile : premier tap aperçu, second tap déplacement exact du portail', () => {
    vi.useFakeTimers();
    vi.mocked(window.matchMedia).mockReturnValue({ matches: false } as unknown as MediaQueryList);
    const scene = emptyScene(8, 8);
    const positions: { x: number; y: number; z?: number }[] = [];
    useGame.setState({
      scene,
      mode: 'exploration',
      partyPos: { x: 2, y: 1 },
      party: [],
      dialogue: null,
      moveParty: (pos) => {
        positions.push(pos);
        useGame.setState({ partyPos: pos });
      },
    });

    let pointer: StagePointer | undefined;
    const Probe = () => {
      const svgRef = useRef<SVGSVGElement>(null);
      const camRef = useRef({ x: 0, y: 0 });
      pointer = useStagePointer({
        svgRef,
        dims,
        zoom: 1,
        camRef,
        hoverTracking: false,
        partyLeader: undefined,
        activeZ: 0,
        aretes: [],
      });
      return null;
    };
    const container = document.createElement('div');
    root = createRoot(container);
    act(() => root!.render(<Probe />));

    act(() => pointer!.activerArete(areteDe(portal)));
    expect(positions).toEqual([]);
    expect(pointer!.areteSurvolee?.portail).toEqual(portal);

    act(() => pointer!.activerArete(areteDe(portal)));
    act(() => vi.runAllTimers());

    expect(positions).toEqual([{ x: 2, y: 2 }]);
  });

  it('ouvre une porte extérieure fermée sans marcher puis emprunte le seuil au clic suivant', () => {
    vi.useFakeTimers();
    const scene = emptyScene(4, 3);
    scene.effectZones = [{
      id: 'room-a',
      label: 'Pièce A',
      presentation: 'interior',
      area: { kind: 'rect', x: 1, y: 1, w: 1, h: 1 },
    }];
    scene.walls = [{ x: 0, y: 1, side: 'E', door: true, closed: true }];
    const positions: { x: number; y: number; z?: number }[] = [];
    useGame.setState({
      scene,
      mode: 'exploration',
      partyPos: { x: 0, y: 1 },
      party: [],
      dialogue: null,
      moveParty: (pos) => {
        positions.push(pos);
        useGame.setState({ partyPos: pos });
      },
    });

    let pointer: StagePointer | undefined;
    const Probe = () => {
      const svgRef = useRef<SVGSVGElement>(null);
      const camRef = useRef({ x: 0, y: 0 });
      pointer = useStagePointer({
        svgRef,
        dims,
        zoom: 1,
        camRef,
        hoverTracking: false,
        partyLeader: undefined,
        activeZ: 0,
        aretes: [],
      });
      return null;
    };
    renderToStaticMarkup(<Probe />);

    pointer!.activerArete(areteDe(closedExteriorPortal));
    vi.runAllTimers();
    expect(positions).toEqual([]);

    pointer!.activerArete(areteDe({ ...closedExteriorPortal, kind: 'door-open' }));
    vi.runAllTimers();
    expect(positions).toEqual([{ x: 1, y: 1 }]);
  });

  it('anime un saut comme un unique segment engagé entre le départ et l’atterrissage', () => {
    vi.useFakeTimers();
    const scene = emptyScene(8, 8);
    scene.layers[0].tiles.fill('vide');
    scene.layers[0].tiles[1 + 1 * 8] = 'herbe';
    scene.layers[0].tiles[3 + 1 * 8] = 'herbe';
    const hero = {
      id: 'hero',
      label: 'Héros',
      kind: 'hero',
      characteristics: {
        'capacite-de-combat': 30,
        'capacite-de-tir': 30,
        force: 30,
        endurance: 30,
        initiative: 30,
        agilite: 30,
        dexterite: 30,
        intelligence: 30,
        'force-mentale': 30,
        sociabilite: 30,
      },
      wounds: { current: 10, max: 10 },
      advantage: 0,
      conditions: [],
      weapons: [],
      armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
      items: [],
      skills: [],
      talents: [],
      movement: 12,
    } as Combatant;
    const moveParty = vi.fn((pos: { x: number; y: number; z?: number }) => useGame.setState({ partyPos: pos }));
    useGame.setState({
      scene,
      mode: 'exploration',
      partyPos: { x: 1, y: 1 },
      party: [hero],
      dialogue: null,
      moveParty,
    });
    const emitted: { id: string; path: { x: number; y: number }[] }[] = [];
    unsubs.push(bus.on(EVT.ANIM_MOVE, (payload) => emitted.push(payload)));

    let pointer: StagePointer | undefined;
    const Probe = () => {
      const svgRef = useRef(stageEl());
      const camRef = useRef({ x: 0, y: 0 });
      pointer = useStagePointer({
        svgRef,
        dims,
        zoom: 1,
        camRef,
        hoverTracking: false,
        partyLeader: hero,
        activeZ: 0,
        aretes: [],
      });
      return null;
    };
    renderToStaticMarkup(<Probe />);

    const center = tileCenter(3, 1, dims);
    const event = pointerEvent(center.cx, center.cy);
    pointer!.handlers.onPointerDown(event);
    pointer!.handlers.onPointerUp(event);

    expect(emitted).toEqual([{ id: 'hero', path: [{ x: 1, y: 1 }, { x: 3, y: 1 }] }]);
    expect(moveParty).toHaveBeenCalledOnce();
    expect(useGame.getState().partyPos).toEqual({ x: 3, y: 1 });
  });
});

/**
 * RELIEF ET ÉTAGES au pointeur — le clic doit atteindre ce que le rendu DESSINE.
 *
 * Deux vérités s'y rencontrent. (1) Une case en relief est dessinée SOULEVÉE de sa hauteur métrique
 * (`metricToLift(heightAt)`, la projection que le rendu et le curseur clavier `screenStepDot`
 * emploient) : l'inverser à plat désigne une AUTRE case. (2) Le franchissement vertical n'est plus un
 * escalier explicite mais un voisinage marchable auto-dérivé du relief (`walkNeighbors`) : le clavier
 * le franchit, la souris doit pouvoir aussi — sans que l'étage du dessus, hors de portée d'un pas, se
 * mette à voler le clic au sol qu'on foule.
 */
describe('useStagePointer — relief et franchissement d’étage à la souris', () => {
  const mountProbe = (activeZ = 0) => {
    let pointer: StagePointer | undefined;
    const Probe = () => {
      const svgRef = useRef(stageEl());
      const camRef = useRef({ x: 0, y: 0 });
      pointer = useStagePointer({
        svgRef,
        dims,
        zoom: 1,
        camRef,
        hoverTracking: false,
        partyLeader: undefined,
        activeZ,
        aretes: [],
      });
      return null;
    };
    renderToStaticMarkup(<Probe />);
    return pointer!;
  };

  const clickAt = (pointer: StagePointer, cx: number, cy: number) => {
    const event = pointerEvent(cx, cy);
    pointer.handlers.onPointerDown(event);
    pointer.handlers.onPointerUp(event);
    vi.runAllTimers();
  };

  it('vise une MARCHE au pixel où elle est dessinée, pas à son aplomb au sol', () => {
    vi.useFakeTimers();
    const scene = emptyScene(8, 8);
    scene.layers[0].height = new Array(64).fill(0);
    scene.layers[0].height![3 + 2 * 8] = 1; // marche d'1 m : rampe franchissable (STEP_MAX_M), rendue soulevée
    const moveParty = vi.fn();
    useGame.setState({ scene, mode: 'exploration', partyPos: { x: 2, y: 1 }, party: [], dialogue: null, moveParty });

    const marche = tileCenter(3, 2, dims, metricToLift(1));
    // Le piège : à plat, ce pixel désigne la case du GROUPE — le clic n'allait donc nulle part.
    expect(screenToTileAtZ(marche.cx, marche.cy, dims, 0)).toEqual({ x: 2, y: 1 });

    clickAt(mountProbe(), marche.cx, marche.cy);

    expect(moveParty).toHaveBeenLastCalledWith({ x: 3, y: 2 });
  });

  it('monte d’un étage en cliquant la surface voisine, comme le pas clavier la franchit', () => {
    vi.useFakeTimers();
    const scene = emptyScene(8, 8);
    scene.layers[0].height = new Array(64).fill(0);
    scene.layers[0].height![4 + 4 * 8] = 3; // haut de l'escalier : 3 m, à une marche du plancher de l'étage
    const upper = new Array(64).fill('vide');
    upper[5 + 4 * 8] = 'plancher';
    scene.layers.push({ z: 1, tiles: upper, height: new Array(64).fill(4) });
    const moveParty = vi.fn();
    useGame.setState({ scene, mode: 'exploration', partyPos: { x: 4, y: 4 }, party: [], dialogue: null, moveParty });

    const palier = tileCenter(5, 4, dims, metricToLift(4));
    // Le piège : à plat, le pixel du palier désigne une case du REZ, parfaitement marchable — c'est elle
    // que le clic servait, et l'étage restait inatteignable à la souris.
    const auSol = screenToTileAtZ(palier.cx, palier.cy, dims, 0);
    expect(auSol).toEqual({ x: 2, y: 1 });
    expect(isWalkable(scene, auSol.x, auSol.y, 0)).toBe(true);

    clickAt(mountProbe(), palier.cx, palier.cy);

    expect(moveParty).toHaveBeenLastCalledWith({ x: 5, y: 4, z: 1 });
  });

  it('laisse le sol qu’on foule au clic sous une surface d’étage HORS de portée d’un pas', () => {
    vi.useFakeTimers();
    const scene = emptyScene(8, 8);
    const upper = new Array(64).fill('vide');
    upper[6 + 6 * 8] = 'plancher';
    scene.layers.push({ z: 1, tiles: upper, height: new Array(64).fill(4) });
    const moveParty = vi.fn();
    useGame.setState({ scene, mode: 'exploration', partyPos: { x: 2, y: 3 }, party: [], dialogue: null, moveParty });

    const surplomb = tileCenter(6, 6, dims, metricToLift(4));
    const auSol = screenToTileAtZ(surplomb.cx, surplomb.cy, dims, 0);
    expect(auSol).toEqual({ x: 3, y: 3 });
    // 4 m au-dessus du sol : aucune rampe, donc aucun pas — ni clavier ni souris — ne l'atteint.
    expect(walkNeighbors(scene, { x: 2, y: 3 }).some((n) => (n.z ?? 0) === 1)).toBe(false);

    clickAt(mountProbe(), surplomb.cx, surplomb.cy);

    expect(moveParty).toHaveBeenLastCalledWith({ x: 3, y: 3 });
  });
});

/**
 * GLISSER-TOURNER au bouton MILIEU (#1176) — la 4e entrée du lacet libre. Le bouton principal marche
 * et panoramique, le droit ouvre l'attaque pertinente : la rotation à la souris avait seulement le
 * milieu, et elle doit suivre le pointeur AU DEGRÉ dit par `SENSIBILITE_DRAG_DEG_PX`.
 */
describe('useStagePointer — glisser-tourner au bouton MILIEU', () => {
  const monter = () => {
    let pointer: StagePointer | undefined;
    const Probe = () => {
      const svgRef = useRef(stageEl());
      const camRef = useRef({ x: 0, y: 0 });
      pointer = useStagePointer({ svgRef, dims, zoom: 1, camRef, hoverTracking: false, partyLeader: undefined, activeZ: 0, aretes: [] });
      return null;
    };
    renderToStaticMarkup(<Probe />);
    return pointer!;
  };

  /** Événement de pointeur au bouton `button` (le gabarit partagé du fichier est au principal). */
  const evBouton = (x: number, y: number, button: number) =>
    ({ ...pointerEvent(x, y), button, clientX: x, clientY: y, preventDefault: () => undefined }) as unknown as React.PointerEvent;

  afterEach(() => {
    // Lacet ET panoramique sont des modules VIVANTS partagés par la suite (`isolate: false`) : un geste
    // qui les laisse ailleurs qu'au repos décadre la vue des fichiers voisins.
    resetStageYaw();
    resetStagePan();
  });

  it('un glisser de N px au MILIEU pose le lacet à yaw0 + N × SENSIBILITE_DRAG_DEG_PX', () => {
    vi.stubGlobal('requestAnimationFrame', undefined);
    const scene = emptyScene(8, 8);
    useGame.setState({ scene, mode: 'exploration', partyPos: { x: 2, y: 1 }, party: [], dialogue: null });
    resetStageYaw();
    poserYaw(30); // on part d'un angle QUELCONQUE : le glisser est relatif à l'angle du début de geste
    const pointer = monter();

    pointer.handlers.onPointerDown(evBouton(100, 100, 1));
    act(() => pointer.handlers.onPointerMove(evBouton(220, 100, 1)));

    expect(getStageYaw()).toBeCloseTo(30 + 120 * SENSIBILITE_DRAG_DEG_PX, 9);

    // Le geste reste ABSOLU : un retour en arrière ramène l'angle, il ne s'additionne pas.
    act(() => pointer.handlers.onPointerMove(evBouton(40, 100, 1)));
    expect(getStageYaw()).toBeCloseTo(30 - 60 * SENSIBILITE_DRAG_DEG_PX, 9);
    vi.unstubAllGlobals();
  });

  it('le bouton PRINCIPAL panoramique HORS du store, qui ne reçoit son commit qu’au relâchement', () => {
    vi.stubGlobal('requestAnimationFrame', undefined);
    const scene = emptyScene(8, 8);
    useGame.setState({ scene, mode: 'exploration', partyPos: { x: 2, y: 1 }, party: [], dialogue: null, camPan: { x: 0, y: 0 } });
    resetStageYaw();
    resetStagePan();
    const pointer = monter();

    pointer.handlers.onPointerDown(evBouton(100, 100, 0));
    act(() => pointer.handlers.onPointerMove(evBouton(220, 100, 0)));

    expect(getStageYaw()).toBe(0);
    expect(getStagePan().x).not.toBe(0); // c'est bien un PANORAMIQUE qui a eu lieu…
    expect(useGame.getState().camPan).toEqual({ x: 0, y: 0 }); // …et le store n'en a rien su

    // Relâchement : UN commit, sur la valeur que la vue montre déjà.
    act(() => pointer.handlers.onPointerUp(evBouton(220, 100, 0)));
    expect(useGame.getState().camPan.x).toBeCloseTo(getStagePan().x, 9);
    expect(useGame.getState().camPan.x).not.toBe(0);
    vi.unstubAllGlobals();
  });
});

/**
 * DÉCOR VOLUMIQUE SOUS LE POINTEUR — le meuble n'est ni un jeton ni un billboard : il est cuit dans la
 * masse du monde, et c'est la voie de rendu qui le nomme (`targetUnderPointer` → `{kind:'entity'}`).
 * Le pointeur route ce verdict vers la CASE D'ANCRAGE du meuble, d'où l'interaction d'exploration le
 * reprend comme n'importe quel décor — sans quoi le clic retomberait sur la tuile DERRIÈRE le meuble.
 *
 * Et il le fait SANS payer le rayon quand il n'y a rien à nommer : le hit-test tourne à chaque
 * `pointermove`, et le rayon MONDE coûte (1,30 ms mesuré à 39 780 triangles). Hors combat, une scène
 * sans mobilier volumique ne le sollicite donc pas du tout.
 */
describe('useStagePointer — le décor VOLUMIQUE se désigne, et ne coûte que là où il existe', () => {
  let root: Root | null = null;

  afterEach(() => {
    setSpritePicker(null);
    if (root) {
      act(() => root!.unmount());
      root = null;
    }
    vi.useRealTimers();
  });

  /** Meneur MINIMAL mais JOUABLE : le pointeur mesure son Mouvement (`pathOpts`) avant de planifier. */
  const meneurJouable = (): Combatant => ({
    id: 'h', label: 'H', kind: 'hero', wounds: { current: 10, max: 10 }, conditions: [], movement: 4,
    characteristics: { force: 30, endurance: 30, agilite: 30, initiative: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30, 'capacite-de-combat': 30, 'capacite-de-tir': 30 },
    weapons: [], armour: {}, items: [], skills: [], talents: [],
  } as unknown as Combatant);

  const pnjAssis = (id: string) => ({ kind: 'entity' as const, entityId: id });

  /** Scène d'un meuble à recette (fouillable) posé en (2,3), le groupe à portée de bras. */
  const sceneMeuble = (ref: string) => {
    const scene = emptyScene(8, 8);
    scene.entities = [{
      id: 'table-1', kind: 'prop', pos: { x: 2, y: 3 }, ref, facing: 'S',
      usable: { actions: [{ id: 'fouiller', flow: { kind: 'seq', steps: [] }, unique: true }] },
    }] as typeof scene.entities;
    return scene;
  };

  const monter = () => {
    let pointer: StagePointer | undefined;
    const Probe = () => {
      const svgRef = useRef(stageEl());
      const camRef = useRef({ x: 0, y: 0 });
      pointer = useStagePointer({ svgRef, dims, zoom: 1, camRef, hoverTracking: false, partyLeader: undefined, activeZ: 0, aretes: [] });
      return null;
    };
    renderToStaticMarkup(<Probe />);
    return pointer!;
  };

  it('un verdict `entity` cible la case du MEUBLE, pas la tuile sous le pixel', () => {
    vi.useFakeTimers();
    const scene = sceneMeuble('table-ronde-4-tabourets');
    const jouerAction = vi.fn();
    useGame.setState({ scene, mode: 'exploration', partyPos: { x: 2, y: 2 }, party: [], dialogue: null, jouerAction, setPendingInteract: vi.fn() });
    setSpritePicker(() => ({ kind: 'entity', id: 'table-1' }));

    const pointer = monter();
    // Un pixel VOLONTAIREMENT loin de la case du meuble : sans le routage, le clic irait à cette tuile.
    const ailleurs = tileCenter(6, 6, dims);
    const ev = pointerEvent(ailleurs.cx, ailleurs.cy);
    pointer.handlers.onPointerDown(ev);
    pointer.handlers.onPointerUp(ev);
    vi.runAllTimers();

    // Adjacent (2,2)→(2,3), UNE offre ouverte : le clic la JOUE par l'exécuteur unique, nommée.
    expect(jouerAction).toHaveBeenCalledWith('table-1', 'fouiller');
  });

  /**
   * MEUBLE À PLACES cliqué de LOIN : le pointeur arme le MÊME `pendingInteract` que la fouille, mais
   * la marche va jusqu'à l'ABORD de la place — pas « à côté » de la case d'ancrage — et l'assise se
   * fait à l'arrivée, par `interactEntity`. Bout en bout, sans mock d'action de store.
   */
  it('un meuble à places cliqué de loin : marche jusqu’à l’ABORD, puis assoit le meneur', () => {
    vi.useFakeTimers();
    const scene = emptyScene(8, 8);
    scene.entities = [{ id: 'table-1', kind: 'prop', pos: { x: 2, y: 3 }, ref: 'table-ronde-4-tabourets', facing: 'S', usable: { assise: true } }] as typeof scene.entities;
    const meneur = meneurJouable();
    // Bout en bout = ACTIONS RÉELLES : un test voisin a substitué des `vi.fn()` dans le store, et un
    // pending armé sur un espion ne prouverait rien.
    const vierge = useGame.getInitialState();
    useGame.setState({
      scene, mode: 'exploration', partyPos: { x: 6, y: 6 }, party: [meneur], dialogue: null, battle: null, pendingInteract: null, journal: [],
      interactEntity: vierge.interactEntity, jouerAction: vierge.jouerAction, setPendingInteract: vierge.setPendingInteract, moveParty: vierge.moveParty,
    });
    setSpritePicker(() => ({ kind: 'entity', id: 'table-1' }));

    const pointer = monter();
    const ailleurs = tileCenter(7, 7, dims);
    const ev = pointerEvent(ailleurs.cx, ailleurs.cy);
    pointer.handlers.onPointerDown(ev);
    pointer.handlers.onPointerUp(ev);
    expect(useGame.getState().pendingInteract).toMatchObject({ id: 'table-1' }); // pending ARMÉ, marche lancée
    act(() => { vi.runAllTimers(); });

    const abords = seatSlotsOf(useGame.getState().scene!, 'table-1').map((s) => `${s.approach.x},${s.approach.y}`);
    const arrivee = useGame.getState().partyPos;
    expect(abords, 'le groupe s’arrête SUR un abord de place').toContain(`${arrivee.x},${arrivee.y}`);
    expect(arrivee).not.toEqual({ x: 2, y: 3 });                // jamais la case du meuble
    expect(seatPoseOf(useGame.getState().scene!, { kind: 'party', rang: 1 })).toMatchObject({ propId: 'table-1' });
    expect(useGame.getState().pendingInteract).toBeNull();
  });

  /**
   * REPRO PROMUE de la recette navigateur (#1443) puis RECADRÉE par la revue (round 2) : qui décide
   * du meuble visé.
   *  - le RAYON, dès qu'il nomme un décor : il touche la face réellement dessinée, à sa hauteur réelle
   *    (une inversion écran→case au lift du SOL se décale sur un meuble haut, et une OCCULTATION n'est
   *    pas un défaut — le joueur clique ce qu'il voit) ;
   *  - la case DESSINÉE sous le pixel en REPLI, quand le rayon ne nomme rien : un plateau FIN ne lui
   *    présente aucune face, et la résolution de tuile écartait son empreinte (non marchable) pour
   *    rendre une case d'un AUTRE ÉTAGE — la table murale (13,10) résolvait (16,13,z1).
   */
  it('le rayon nomme le meuble visé ; sans rayon, la case dessinée sert de repli', () => {
    const scene = emptyScene(8, 8);
    // ÉTAGE au-dessus : c'est lui que la boucle cross-couche servait à la place du meuble (cas du plateau fin).
    scene.layers = [scene.layers[0], { z: 1, tiles: new Array(8 * 8).fill('bois') }];
    scene.entities = [
      { id: 'table-1', kind: 'prop', pos: { x: 2, y: 3 }, ref: 'table-ronde-4-tabourets', facing: 'S', usable: { assise: true } },
      // Le meuble HAUT que le rayon touche alors que le pixel tombe sur la case de la table : posé
      // ADJACENT au groupe pour que son affordance se serve sur place, et donc s'observe.
      { id: 'comptoir-1', kind: 'prop', pos: { x: 3, y: 2 }, ref: 'comptoir-droit', facing: 'S',
        usable: { actions: [{ id: 'fouiller', flow: { kind: 'seq', steps: [] }, unique: true }] } },
    ] as typeof scene.entities;
    const surLaTable = tileCenter(2, 3, dims);

    // Ce que SERT le clic diffère par la nature du meuble, pas par la question posée : le meuble à
    // PLACES dont un abord est sous les pieds passe par l'arbitrage de proximité (`interactEntity`),
    // le décor à UNE offre ouverte est joué nommément (`jouerAction`). Le test mesure QUI est visé.
    for (const [cas, rayon, cible, geste] of [
      ['rayon MUET (plateau fin) → repli sur la case DESSINÉE', () => null, 'table-1', null],
      ['rayon qui NOMME (face touchée) → CE décor', () => ({ kind: 'entity' as const, id: 'comptoir-1' }), 'comptoir-1', 'fouiller'],
    ] as const) {
      const jouerAction = vi.fn();
      const interactEntity = vi.fn();
      useGame.setState({ scene, mode: 'exploration', partyPos: { x: 2, y: 2 }, party: [], dialogue: null, jouerAction, interactEntity, setPendingInteract: vi.fn(), flags: {} });
      setSpritePicker(rayon);
      const pointer = monter();
      const ev = pointerEvent(surLaTable.cx, surLaTable.cy);
      pointer.handlers.onPointerDown(ev);
      pointer.handlers.onPointerUp(ev);
      // Les deux cibles sont adjacentes : servies sur place, par la porte qui leur revient.
      if (geste) expect(jouerAction, cas).toHaveBeenCalledWith(cible, geste);
      else expect(interactEntity, cas).toHaveBeenCalledWith(cible);
    }
  });

  /**
   * REPRO PROMUE de la recette navigateur (#1443, `la-diligence`) : s'asseoir prenait DEUX clics.
   * Le chemin vers l'abord d'une place LONGE le meuble ; l'ancienne consommation du pending « à
   * l'arrivée adjacente » ouvrait l'interaction sur une case croisée en route (l'abord d'une place
   * DÉJÀ PRISE ici), qui refusait l'assise et brûlait le pending — le groupe finissait sa marche sur
   * le bon abord, debout, et il fallait recliquer. UN geste doit suffire.
   */
  it('le chemin croise l’abord d’une place PRISE : un seul clic assoit quand même à l’arrivée', () => {
    vi.useFakeTimers();
    const scene = emptyScene(8, 8);
    scene.entities = [{ id: 'table-1', kind: 'prop', pos: { x: 2, y: 3 }, ref: 'table-ronde-4-tabourets', facing: 'S', usable: { assise: true } }] as typeof scene.entities;
    // Une SEULE place reste libre (`place-3`) : la marche vers son abord longe celui d'une place prise.
    scene.seatAssignments = { 'table-1': { 'place-1': pnjAssis('a'), 'place-2': pnjAssis('b'), 'place-4': pnjAssis('d') } };
    const vierge = useGame.getInitialState();
    useGame.setState({
      scene, mode: 'exploration', partyPos: { x: 6, y: 6 }, party: [meneurJouable()], dialogue: null, battle: null,
      pendingInteract: null, journal: [], flags: {},
      interactEntity: vierge.interactEntity, jouerAction: vierge.jouerAction, setPendingInteract: vierge.setPendingInteract, moveParty: vierge.moveParty,
    });
    setSpritePicker(() => ({ kind: 'entity', id: 'table-1' }));
    // PRÉCONDITION : le chemin planifié croise bien une case adjacente au meuble qui n'est PAS l'abord visé.
    const sc = useGame.getState().scene!;
    const plan = exploreSeatPlan(sc, { x: 6, y: 6 }, 'table-1')!;
    expect(plan.slotId, 'la seule place libre est `place-3`').toBe('place-3');
    const croisees = plan.path.slice(0, -1).filter((p) => chebyshev(p, { x: 2, y: 3 }) <= 1);
    expect(croisees.length, 'le chemin DOIT longer le meuble, sinon le test ne mord pas').toBeGreaterThan(0);

    const pointer = monter();
    const ailleurs = tileCenter(7, 7, dims);
    const ev = pointerEvent(ailleurs.cx, ailleurs.cy);
    pointer.handlers.onPointerDown(ev);
    pointer.handlers.onPointerUp(ev);
    act(() => { vi.runAllTimers(); });

    expect(useGame.getState().journal.join(' | '), 'aucun refus d’assise en chemin').not.toContain('Vous devez rejoindre la place');
    expect(seatPoseOf(useGame.getState().scene!, { kind: 'party', rang: 1 }), 'assis EN UN GESTE').toMatchObject({ propId: 'table-1', slotId: 'place-3' });
    expect(useGame.getState().pendingInteract).toBeNull();
  });

  /**
   * SONDE C de la revue (#1443, round 2) : DEBOUT SUR L'ABORD D'UNE PLACE PRISE, trois places libres
   * ailleurs. Le pointeur lisait « suis-je sur un abord ? » sur TOUTES les places, quand le plan
   * d'assise ne considère que les LIBRES : il servait donc l'interaction sur place, qui refusait
   * (« Vous devez rejoindre la place »), et personne ne marchait — le 2e clic ne sauvait rien.
   */
  it('debout sur l’abord d’une place PRISE : le clic MARCHE vers une place libre et y assoit', () => {
    vi.useFakeTimers();
    const scene = emptyScene(8, 8);
    scene.entities = [{ id: 'table-1', kind: 'prop', pos: { x: 2, y: 3 }, ref: 'table-ronde-4-tabourets', facing: 'S', usable: { assise: true } }] as typeof scene.entities;
    scene.seatAssignments = { 'table-1': { 'place-1': pnjAssis('a') } }; // une seule des quatre places est prise
    const vierge = useGame.getInitialState();
    const places = seatSlotsOf(scene, 'table-1');
    const PRISE = places.find((s) => s.slotId === 'place-1')!.approach; // on se tient SUR son abord
    useGame.setState({
      scene, mode: 'exploration', partyPos: { x: PRISE.x, y: PRISE.y }, party: [meneurJouable()], dialogue: null, battle: null,
      pendingInteract: null, journal: [], flags: {},
      interactEntity: vierge.interactEntity, jouerAction: vierge.jouerAction, setPendingInteract: vierge.setPendingInteract, moveParty: vierge.moveParty,
    });
    setSpritePicker(() => ({ kind: 'entity', id: 'table-1' }));

    const pointer = monter();
    const ailleurs = tileCenter(7, 7, dims);
    const ev = pointerEvent(ailleurs.cx, ailleurs.cy);
    pointer.handlers.onPointerDown(ev);
    pointer.handlers.onPointerUp(ev);
    act(() => { vi.runAllTimers(); });

    const pose = seatPoseOf(useGame.getState().scene!, { kind: 'party', rang: 1 });
    expect(useGame.getState().journal.join(' | '), 'aucun refus : il restait trois places').not.toContain('Vous devez rejoindre la place');
    expect(pose, 'assis à une place LIBRE, en un geste').toMatchObject({ propId: 'table-1' });
    expect(pose!.slotId, 'jamais la place prise').not.toBe('place-1');
  });

  /**
   * SONDE G2 de la revue (#1443, round 3) : le SURVOL et le CLIC lisent la MÊME source
   * (`exploreMovePlan`) — le module le dit en toutes lettres. Table PLEINE et sans fouille : le survol
   * traçait un chemin vers une case adjacente que le clic n'honorait pas (il journalisait
   * `seating.noReachableSeat` sur place). Le clic PARCOURT le plan promis ; le refus ne se dit qu'À
   * PORTÉE, quand il n'y a plus rien à marcher.
   */
  it('table PLEINE sans fouille : le clic PARCOURT le chemin que le survol trace, et ne refuse qu’à portée', () => {
    vi.useFakeTimers();
    const scene = emptyScene(8, 8);
    scene.entities = [{ id: 'table-1', kind: 'prop', pos: { x: 2, y: 3 }, ref: 'table-ronde-4-tabourets', facing: 'S', usable: { assise: true } }] as typeof scene.entities;
    scene.seatAssignments = { 'table-1': { 'place-1': pnjAssis('a'), 'place-2': pnjAssis('b'), 'place-3': pnjAssis('c'), 'place-4': pnjAssis('d') } };
    const vierge = useGame.getInitialState();
    const poser = (pos: { x: number; y: number }) => useGame.setState({
      scene, mode: 'exploration', partyPos: pos, party: [meneurJouable()], dialogue: null, battle: null,
      pendingInteract: null, journal: [], flags: {},
      interactEntity: vierge.interactEntity, jouerAction: vierge.jouerAction, setPendingInteract: vierge.setPendingInteract, moveParty: vierge.moveParty,
    });
    setSpritePicker(() => ({ kind: 'entity', id: 'table-1' }));
    const surLaTable = tileCenter(2, 3, dims);

    // AU LOIN — le survol PROMET un chemin : le clic doit le parcourir, pas refuser sur place.
    poser({ x: 6, y: 6 });
    const promis = exploreMovePlan(useGame.getState().scene!, { x: 6, y: 6 }, { x: 2, y: 3 }, { blocked: new Set() });
    expect(promis, 'précondition : le survol trace bien une marche').not.toBeNull();
    const p1 = monter();
    const loin = pointerEvent(surLaTable.cx, surLaTable.cy);
    p1.handlers.onPointerDown(loin);
    p1.handlers.onPointerUp(loin);
    act(() => { vi.runAllTimers(); });
    expect(useGame.getState().partyPos, 'le clic a suivi le plan du survol').toMatchObject({ x: promis!.dest.x, y: promis!.dest.y });
    expect(useGame.getState().journal.join(' | '), 'aucun refus tant qu’il restait à marcher').not.toContain('Aucune place libre');

    // À PORTÉE — plus rien à marcher : là, et là seulement, on dit pourquoi le meuble ne sert pas.
    poser({ x: 2, y: 2 });
    const p2 = monter();
    const pres = pointerEvent(surLaTable.cx, surLaTable.cy);
    p2.handlers.onPointerDown(pres);
    p2.handlers.onPointerUp(pres);
    act(() => { vi.runAllTimers(); });
    expect(useGame.getState().partyPos, 'personne ne bouge').toMatchObject({ x: 2, y: 2 });
    // À PORTÉE, le meuble OFFRE encore son assise (`estUtilisable`), ses places sont juste toutes
    // prises : le clic ne joue RIEN et ne journalise RIEN — la raison se lit AU SURVOL, dans
    // l'infobulle unique de sa pastille (arbitrage user 2026-08-24), et c'est l'offre elle-même qui
    // la porte. Le journal n'est pas l'endroit où l'on apprend pourquoi un geste est fermé.
    expect(useGame.getState().journal, 'aucune ligne de journal : la raison vit au survol').toEqual([]);
    const offre = offresUtilisables(useGame.getState())[0].offres[0];
    expect(offre.gate, 'l’offre d’assise est REFUSÉE, avec sa raison lisible')
      .toEqual({ ok: false, reason: 'Toutes les places sont occupées.' });
  });

  /**
   * P3 de la revue (#1443, round 2) : un décor SANS affordance avalait le geste — ni marche, ni
   * journal — là où la case de sol nue juste à côté fait MARCHER. On ne monte pas sur un meuble :
   * loin, on s'en approche (parité sol) ; à portée, on dit qu'il n'y a rien à en tirer.
   */
  it('décor SANS affordance : loin on s’en approche, à portée on le DIT — jamais un geste avalé', () => {
    vi.useFakeTimers();
    const scene = emptyScene(8, 8);
    scene.entities = [{ id: 'tonneau-1', kind: 'prop', pos: { x: 2, y: 3 }, ref: 'tonneau', label: 'Un tonneau' }] as typeof scene.entities;
    const vierge = useGame.getInitialState();
    const poser = (pos: { x: number; y: number }) => useGame.setState({
      scene, mode: 'exploration', partyPos: pos, party: [meneurJouable()], dialogue: null, battle: null,
      pendingInteract: null, journal: [], flags: {},
      interactEntity: vierge.interactEntity, jouerAction: vierge.jouerAction, setPendingInteract: vierge.setPendingInteract, moveParty: vierge.moveParty,
    });
    setSpritePicker(() => ({ kind: 'entity', id: 'tonneau-1' }));
    const surLeTonneau = tileCenter(2, 3, dims);

    poser({ x: 6, y: 6 });
    const p1 = monter();
    const loin = pointerEvent(surLeTonneau.cx, surLeTonneau.cy);
    p1.handlers.onPointerDown(loin);
    p1.handlers.onPointerUp(loin);
    act(() => { vi.runAllTimers(); });
    const arrivee = useGame.getState().partyPos;
    expect(arrivee, 'on ne monte jamais SUR le décor').not.toMatchObject({ x: 2, y: 3 });
    expect(chebyshev(arrivee, { x: 2, y: 3 }), 'on s’est approché, comme du sol nu').toBe(1);

    poser({ x: 2, y: 2 }); // déjà à portée : plus rien à marcher
    const p2 = monter();
    const pres = pointerEvent(surLeTonneau.cx, surLeTonneau.cy);
    p2.handlers.onPointerDown(pres);
    p2.handlers.onPointerUp(pres);
    act(() => { vi.runAllTimers(); });
    expect(useGame.getState().partyPos, 'personne ne bouge').toMatchObject({ x: 2, y: 2 });
    expect(useGame.getState().journal.join(' | '), 'le geste n’est pas avalé').toContain('rien à en tirer');
  });

  /**
   * SONDE promue de la revue (2026-08-21) : un meuble PLEIN qui porte une fouille NON épuisée gardait
   * son halo allumé, et le clic répondait « aucune place accessible » — la branche meuble-à-places
   * INTERCEPTAIT tout. Elle ne doit rien intercepter : sans place servable, la chaîne
   * fouille/marchand/dialogue reprend la main, et le groupe marche jusqu'à une case adjacente.
   */
  it('meuble à places PLEIN mais fouillable : le clic replie sur la FOUILLE, jamais un refus d’assise', () => {
    vi.useFakeTimers();
    const scene = emptyScene(8, 8);
    const prises = { 'place-1': pnjAssis('a'), 'place-2': pnjAssis('b'), 'place-3': pnjAssis('c'), 'place-4': pnjAssis('d') };
    scene.entities = [{
      id: 'table-1', kind: 'prop', pos: { x: 2, y: 3 }, ref: 'table-ronde-4-tabourets', facing: 'S',
      usable: { assise: true, actions: [{ id: 'fouiller', flow: { kind: 'seq', steps: [] }, unique: true }] },
    }] as typeof scene.entities;
    scene.seatAssignments = { 'table-1': prises };
    const vierge = useGame.getInitialState();
    useGame.setState({
      scene, mode: 'exploration', partyPos: { x: 6, y: 6 }, party: [meneurJouable()], dialogue: null, battle: null,
      pendingInteract: null, journal: [], flags: {},
      interactEntity: vierge.interactEntity, jouerAction: vierge.jouerAction, setPendingInteract: vierge.setPendingInteract, moveParty: vierge.moveParty,
    });
    setSpritePicker(() => ({ kind: 'entity', id: 'table-1' }));
    // PRÉCONDITION : le halo appelle — il n'y a plus de place, mais la fouille n'est pas épuisée.
    expect(interactionHalos(
      [],
      [{ kind: 'prop', key: 'prop:table-1', cell: { x: 2, y: 3, z: 0 }, source: 'entity', entId: 'table-1', span: { w: 1, h: 1 },
        ref: 'table-ronde-4-tabourets', foot: { offX: 0, offY: 0, scale: 1 }, states: { visible: true } } satisfies BillboardPropEl],
      useGame.getState().scene!, {}, { survol: null, reveler: true },
    ), 'le halo DOIT appeler pour que le test morde').toHaveLength(1);

    const pointer = monter();
    const ailleurs = tileCenter(7, 7, dims);
    const ev = pointerEvent(ailleurs.cx, ailleurs.cy);
    pointer.handlers.onPointerDown(ev);
    pointer.handlers.onPointerUp(ev);
    expect(useGame.getState().pendingInteract, 'la fouille est ARMÉE, pas refusée').toMatchObject({ id: 'table-1' });
    act(() => { vi.runAllTimers(); });

    const arrivee = useGame.getState().partyPos;
    expect(chebyshev(arrivee, { x: 2, y: 3 }), 'on s’arrête à côté du meuble').toBe(1);
    expect(useGame.getState().journal.join(' | '), 'la fouille a bien été servie').toContain('Fouiller…');
    expect(useGame.getState().journal.join(' | ')).not.toContain('Aucune place libre');
  });

  /**
   * MOITIÉ LOAD-BEARING du repli : en DIAGONALE adjacente, `exploreMovePlan` rend `null` (on est déjà
   * à portée, rien à marcher) ET aucune place n'est servable — la branche meuble-à-places n'a donc NI
   * abord sous les pieds NI plan à suivre. Si elle retournait là, le clic serait muet (ou un refus
   * d'assise) alors que la fouille est à portée de bras : c'est la fallthrough, et elle seule, qui
   * sert la fouille SUR PLACE.
   */
  it('table PLEINE + fouillable, groupe en DIAGONALE adjacente : le clic fouille SUR PLACE', () => {
    vi.useFakeTimers();
    const scene = emptyScene(8, 8);
    scene.entities = [{
      id: 'table-1', kind: 'prop', pos: { x: 2, y: 3 }, ref: 'table-ronde-4-tabourets', facing: 'S',
      usable: { assise: true, actions: [{ id: 'fouiller', flow: { kind: 'seq', steps: [] }, unique: true }] },
    }] as typeof scene.entities;
    scene.seatAssignments = { 'table-1': { 'place-1': pnjAssis('a'), 'place-2': pnjAssis('b'), 'place-3': pnjAssis('c'), 'place-4': pnjAssis('d') } };
    const vierge = useGame.getInitialState();
    const DIAG = { x: 1, y: 2 }; // diagonale du meuble, et AUCUN des quatre abords
    useGame.setState({
      scene, mode: 'exploration', partyPos: { ...DIAG }, party: [meneurJouable()], dialogue: null, battle: null,
      pendingInteract: null, journal: [], flags: {},
      interactEntity: vierge.interactEntity, jouerAction: vierge.jouerAction, setPendingInteract: vierge.setPendingInteract, moveParty: vierge.moveParty,
    });
    setSpritePicker(() => ({ kind: 'entity', id: 'table-1' }));
    // PRÉCONDITIONS — sans elles, le test ne mordrait pas sur la fallthrough.
    const sc = useGame.getState().scene!;
    expect(seatSlotsOf(sc, 'table-1').some((s) => s.approach.x === DIAG.x && s.approach.y === DIAG.y),
      'la case du groupe NE DOIT PAS être un abord').toBe(false);
    expect(exploreSeatPlan(sc, DIAG, 'table-1'), 'aucune place servable : table pleine').toBeNull();
    expect(exploreMovePlan(sc, DIAG, { x: 2, y: 3 }, { blocked: new Set() }),
      'déjà à portée : aucun plan de marche — c’est CE trou que la fallthrough couvre').toBeNull();

    const pointer = monter();
    const ailleurs = tileCenter(7, 7, dims);
    const ev = pointerEvent(ailleurs.cx, ailleurs.cy);
    pointer.handlers.onPointerDown(ev);
    pointer.handlers.onPointerUp(ev);
    act(() => { vi.runAllTimers(); });

    const journal = useGame.getState().journal.join(' | ');
    expect(journal, 'la fouille est servie SUR PLACE').toContain('Fouiller…');
    expect(journal, 'aucun refus d’assise').not.toContain('Aucune place libre');
    expect(useGame.getState().partyPos, 'personne n’a marché : on était déjà à portée').toEqual(DIAG);
    expect(useGame.getState().pendingInteract).toBeNull();
  });

  /**
   * DEUX ENTITÉS SUR UNE MÊME CASE, dont la SECONDE seule est interactive (#1687). Le rayon ne nomme
   * rien (plateau fin) : la question est alors la CASE, et elle se lit à l'index d'ancrage
   * (`state/decorIndex.ts:entitesEnCaseEtage`). L'affordance et le clic lisent la MÊME entité — une
   * main au survol suivie d'un clic qui sert l'autre entité serait un mensonge d'interface.
   */
  const sceneDeuxDecors = () => {
    const scene = emptyScene(8, 8);
    scene.entities = [
      // PREMIER du document, SANS affordance : c'est lui qu'une lecture par position rend, toujours.
      // Décor À PLACES que l'auteur n'a PAS activé — le témoin le plus tendu du contrat : sa
      // GÉOMÉTRIE d'assise existe, et il n'offre pourtant aucun geste.
      { id: 'table-1', kind: 'prop', pos: { x: 2, y: 3 }, ref: 'table-ronde-4-tabourets', facing: 'S' },
      { id: 'coffre-1', kind: 'prop', pos: { x: 2, y: 3 }, ref: REF_BILLBOARD, facing: 'S',
        usable: { actions: [{ id: 'fouiller', flow: { kind: 'seq', steps: [] }, unique: true }] } },
    ] as typeof scene.entities;
    // La fixture DIT ce qu'elle prétend : le premier décor n'offre RIEN (`estUtilisable` faux) alors
    // que son type porte des places — la géométrie ne dépend pas de l'activation (`seatSlotsOf`),
    // l'offre en dépend (`placesJouables`).
    expect(seatSlotsOf(scene, 'table-1').length, 'la géométrie des places existe sans activation').toBeGreaterThan(0);
    expect(placesJouables(scene, 'table-1'), 'décor NON activé : aucune place jouable').toHaveLength(0);
    expect(estUtilisable(scene, scene.entities[0]), 'le décor témoin doit être SANS affordance').toBe(false);
    return scene;
  };

  it('survol d’une case à deux décors : la main s’affiche pour l’entité INTERACTIVE de la case', () => {
    useGame.setState({ scene: sceneDeuxDecors(), mode: 'exploration', partyPos: { x: 2, y: 2 }, party: [], dialogue: null });
    setSpritePicker(null); // aucun rayon : le verdict est une CASE, sans identité
    const pointer = monter();
    const surLeMeuble = tileCenter(2, 3, dims);
    const ev = pointerEvent(surLeMeuble.cx, surLeMeuble.cy);
    pointer.handlers.onPointerMove(ev);
    expect((ev.currentTarget as unknown as SVGElement).style.cursor).toBe('pointer');
  });

  it('décor ÉPUISÉ : plus de curseur main — l’affordance ne promet que ce que le clic fera', () => {
    // Les deux sites de CLIC lisent `st.flags` (une action `unique` déjà jouée sort d'`actionsAuthorees`) :
    // le survol doit lire les MÊMES drapeaux, sinon la main invite à un geste qui ne se jouera plus.
    const scene = sceneMeuble('table-ronde-4-tabourets');
    useGame.setState({ scene, mode: 'exploration', partyPos: { x: 2, y: 2 }, party: [], dialogue: null, flags: {} });
    setSpritePicker(null);
    const surLeMeuble = tileCenter(2, 3, dims);
    const curseurAuSurvol = (): string => {
      const ev = pointerEvent(surLeMeuble.cx, surLeMeuble.cy);
      monter().handlers.onPointerMove(ev);
      return (ev.currentTarget as unknown as SVGElement).style.cursor;
    };
    expect(curseurAuSurvol(), 'témoin : la fouille est intacte, la main invite').toBe('pointer');
    useGame.setState({ flags: { [cleActionJouee('table-1', 'fouiller')]: true } });
    expect(estUtilisable(scene, scene.entities[0], useGame.getState().flags), 'le décor n’offre plus rien').toBe(false);
    expect(curseurAuSurvol(), 'épuisé : aucune main sur un décor qui a tout donné').toBe('');

    // Le même SVG d'un survol à l'autre — sinon le vert ne dirait rien (un élément neuf porte `''`
    // par défaut). Le stage est le SEUL écrivain du curseur du monde : il EFFACE ce qu'il a écrit.
    useGame.setState({ flags: {} });
    const ev = pointerEvent(surLeMeuble.cx, surLeMeuble.cy);
    const svg = ev.currentTarget as unknown as SVGElement;
    const pointeur = monter();
    pointeur.handlers.onPointerMove(ev);
    expect(svg.style.cursor, 'la main s’écrit').toBe('pointer');
    useGame.setState({ flags: { [cleActionJouee('table-1', 'fouiller')]: true } });
    pointeur.handlers.onPointerMove(ev);
    expect(svg.style.cursor, 'et s’efface sur CE même élément dès le survol suivant').toBe('');
  });

  /**
   * CURSEUR RENDU (#1687) — ce que l'écran montre, pas ce que le code écrit : le stage n'écrit que
   * `'pointer'` (utilisable) ou `''` (tout le reste), donc le REPOS du monde est ce que la feuille
   * donne à `.iso-stage`. Une règle qui y poserait `cursor: pointer` rendrait l'effacement INVISIBLE
   * — la main deviendrait l'état de repos, et promettrait partout un geste que le clic ne fera pas
   * (arbitrage 2026-08-24, `user-arbitrage-survol-rt-strict-refus-au-clic`). Mesuré à travers la
   * CASCADE, sur la vraie feuille.
   */
  it('curseur RENDU : flèche au repos, main sur l’utilisable, flèche de nouveau à l’épuisement', () => {
    const feuille = document.createElement('style');
    feuille.textContent = readFileSync(join(process.cwd(), 'src/gameIso/stage/iso-stage.css'), 'utf8');
    document.head.append(feuille);
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'iso-stage');
    document.body.append(svg);
    const rendu = () => getComputedStyle(svg).cursor;
    try {
      // TÉMOIN de cascade : la feuille est bien VIVANTE sur cet élément (sinon le vert ne dirait rien
      // — un élément sans feuille n'a jamais de main).
      expect(getComputedStyle(svg).position, 'la feuille s’applique à `.iso-stage`').toBe('absolute');
      expect(rendu(), 'repos : aucune main').toMatch(/^(|auto|default)$/);

      const scene = sceneMeuble('table-ronde-4-tabourets');
      useGame.setState({ scene, mode: 'exploration', partyPos: { x: 2, y: 2 }, party: [], dialogue: null, flags: {} });
      setSpritePicker(null);
      const surLeMeuble = tileCenter(2, 3, dims);
      const survoler = () => {
        const ev = { ...pointerEvent(surLeMeuble.cx, surLeMeuble.cy), currentTarget: svg } as unknown as React.PointerEvent;
        monter().handlers.onPointerMove(ev);
      };
      survoler();
      expect(rendu(), 'sur un décor utilisable : la main').toBe('pointer');
      useGame.setState({ flags: { [cleActionJouee('table-1', 'fouiller')]: true } });
      survoler();
      expect(rendu(), 'épuisé : la flèche revient À L’ÉCRAN').toMatch(/^(|auto|default)$/);
    } finally {
      feuille.remove();
      svg.remove();
    }
  });

  it('clic sur cette même case : c’est l’entité INTERACTIVE qui est servie, pas la première du document', () => {
    const jouerAction = vi.fn();
    useGame.setState({
      scene: sceneDeuxDecors(), mode: 'exploration', partyPos: { x: 2, y: 2 }, party: [], dialogue: null,
      jouerAction, setPendingInteract: vi.fn(), flags: {},
    });
    setSpritePicker(null);
    const pointer = monter();
    const surLeMeuble = tileCenter(2, 3, dims);
    const ev = pointerEvent(surLeMeuble.cx, surLeMeuble.cy);
    pointer.handlers.onPointerDown(ev);
    pointer.handlers.onPointerUp(ev);
    expect(jouerAction).toHaveBeenCalledWith('coffre-1', 'fouiller'); // adjacent (2,2)→(2,3) : servi sur place
  });

  /**
   * PORTÉE = ÉTAGE COMPRIS (`state/exploreNav.aPorteeDe`, source unique des quatre sites). Le
   * rayon nomme un décor d'un AUTRE étage — ce qu'il fait dès qu'on regarde une loge d'en bas — et il
   * est 8-adjacent DANS LE PLAN : lu au plan seul, le clic jouait le geste à travers le plancher.
   */
  it('décor d’un AUTRE étage, adjacent dans le plan : le clic ne joue RIEN sur place', () => {
    const jouerAction = vi.fn();
    const setPendingInteract = vi.fn();
    const scene = sceneMeuble('table-ronde-4-tabourets'); // décor VOLUMIQUE : le rayon peut le nommer
    (scene.entities[0] as { z?: number }).z = 1; // le meuble est à l'étage, le groupe au rez
    useGame.setState({
      scene, mode: 'exploration', partyPos: { x: 2, y: 2 }, party: [], dialogue: null,
      jouerAction, setPendingInteract, flags: {}, journal: [],
    });
    setSpritePicker(() => ({ kind: 'entity', id: 'table-1' }));
    const pointer = monter();
    const ev = pointerEvent(tileCenter(2, 3, dims).cx, tileCenter(2, 3, dims).cy);
    pointer.handlers.onPointerDown(ev);
    pointer.handlers.onPointerUp(ev);
    expect(jouerAction, 'un plancher sépare les deux : aucun geste joué sur place').not.toHaveBeenCalled();
    expect(setPendingInteract.mock.calls.flat(), 'ni geste VISÉ à travers le plancher').not.toContainEqual(
      expect.objectContaining({ id: 'table-1' }),
    );

    // TÉMOIN — le MÊME clic, le même rayon, le décor RAMENÉ de plain-pied : le geste se joue.
    delete (scene.entities[0] as { z?: number }).z;
    useGame.setState({ scene: { ...scene }, partyPos: { x: 2, y: 2 } });
    const p2 = monter();
    const ev2 = pointerEvent(tileCenter(2, 3, dims).cx, tileCenter(2, 3, dims).cy);
    p2.handlers.onPointerDown(ev2);
    p2.handlers.onPointerUp(ev2);
    expect(jouerAction, 'de plain-pied, la portée est la même qu’avant').toHaveBeenCalledWith('table-1', 'fouiller');
  });

  it('hors combat, le hit-test n’est PAS sollicité sur une scène sans mobilier volumique', () => {
    const picker = vi.fn(() => null);
    setSpritePicker(picker);
    const sansVolume = sceneMeuble(REF_BILLBOARD); // décor BILLBOARD : rien que le rayon monde puisse nommer
    useGame.setState({ scene: sansVolume, mode: 'exploration', partyPos: { x: 2, y: 2 }, party: [], dialogue: null });
    const p1 = monter();
    const centre = tileCenter(3, 3, dims);
    p1.handlers.onPointerMove(pointerEvent(centre.cx, centre.cy));
    expect(picker).not.toHaveBeenCalled();

    // TÉMOIN : la MÊME scène avec un meuble à recette le sollicite — l'écart vient du mobilier, pas du
    // fait qu'aucun pointeur n'ait bougé.
    const avecVolume = sceneMeuble('table-ronde-4-tabourets');
    useGame.setState({ scene: avecVolume });
    const p2 = monter();
    p2.handlers.onPointerMove(pointerEvent(centre.cx, centre.cy));
    expect(picker).toHaveBeenCalled();
  });

  it('le filet des fixtures billboard tient encore : au moins deux refs SANS recette au catalogue', () => {
    expect(
      props.filter((p) => !p.volume).length,
      'la phase 4 de #1343 (mort du chemin billboard des props) fera tomber ce filet EXPRÈS : ces fixtures '
      + 'devront alors être reformulées — il n’y aura plus de décor billboard à témoin.',
    ).toBeGreaterThanOrEqual(2);
  });
});
