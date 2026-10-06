// @vitest-environment jsdom
import { act, useRef } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { tileCenter, type Dims } from '../../geometry/iso';
import { emptyScene, type Scene } from '../../state/scene';
import { useGame, type BattleState } from '../../state/store';
import type { Combatant } from '../../engine/types';
import { makePregens } from '../../data/pregens';
import { spawnEnemy } from '../../state/spawn';
import { poserScenario } from '../../state/scenarioFlow';
import { scenario } from '../../scenes/test-scenarios/96-presets-edo';
import { DELAI_APPUI_LONG } from '../../ui/useLongPress';
import { padButton } from '../../ui/useGamepad';
import { runBindingById } from '../../state/keybindings';
import { props } from '../../data';
import { setSpritePicker } from './spritePicker';
import { VH, VW } from './useStageCamera';
import { useStagePointer, type StagePointer } from './useStagePointer';
import { useHoverTargeting } from './useHoverTargeting';

/**
 * #1822 — INSPECTER est un GESTE du plateau, plus un mode : le clic droit et l'appui long au doigt
 * ouvrent la fiche du jeton désigné (`useStagePointer.ficheSous`), en combat comme hors combat ; le
 * clic GAUCHE garde l'attaque, le ciblage et l'offre. L'appui long réutilise la primitive des alvéoles
 * (`ui/useLongPress`) sans voler la capture du panoramique.
 */

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
Object.defineProperty(window, 'matchMedia', { configurable: true, value: vi.fn() });
// jsdom n'a pas de layout : aucun corps peint sous le pixel, la chaîne retombe sur la CASE.
Object.defineProperty(document, 'elementFromPoint', { configurable: true, value: () => null });
beforeEach(() => {
  vi.mocked(window.matchMedia).mockReturnValue({ matches: true } as unknown as MediaQueryList);
});

const CLICK_ENTITY_VRAI = useGame.getState().battleClickEntity;
const CLICK_TILE_VRAI = useGame.getState().battleClickTile;
const SET_INSPECT_VRAI = useGame.getState().setInspectId;

/** Élément de stage MESURÉ au viewBox (un pixel client EST un point de viewBox), aux captures ESPIONNÉES. */
function stageEl() {
  return {
    getBoundingClientRect: () => ({ left: 0, top: 0, width: VW, height: VH }) as DOMRect,
    setPointerCapture: vi.fn(),
    releasePointerCapture: vi.fn(),
  };
}

/** Un événement de pointeur ; `pointerType` absent = pointeur non souris (le défaut de jsdom). */
const ev = (x: number, y: number, pointerId = 1, button = 0, pointerType?: string) =>
  ({ button, clientX: x, clientY: y, pointerId, pointerType, currentTarget: { style: {} }, preventDefault: () => undefined }) as unknown as React.PointerEvent;

let root: Root | null = null;
let pointer: StagePointer | undefined;
let svg: ReturnType<typeof stageEl>;

function monter(dims: Dims) {
  svg = stageEl();
  const Probe = () => {
    const svgRef = useRef(svg as unknown as SVGSVGElement);
    const camRef = useRef({ x: 0, y: 0 });
    pointer = useStagePointer({ svgRef, dims, zoom: 1, camRef, hoverTracking: false, partyLeader: undefined, activeZ: 0, aretes: [] });
    return null;
  };
  root = createRoot(document.createElement('div'));
  act(() => root!.render(<Probe />));
}

afterEach(() => {
  if (root) act(() => root!.unmount());
  root = null;
  pointer = undefined;
  vi.useRealTimers();
  setSpritePicker(null);
  useGame.setState({ battle: null, mode: 'exploration', dialogue: null, inspectId: null, battleClickEntity: CLICK_ENTITY_VRAI, battleClickTile: CLICK_TILE_VRAI, setInspectId: SET_INSPECT_VRAI });
});

describe('en combat : clic droit et appui long INSPECTENT, le clic gauche attaque', () => {
  const dims: Dims = { w: 8, h: 8, rot: 0, view: 'iso' };
  const px = (x: number, y: number) => tileCenter(x, y, dims);

  function combat() {
    const hero = makePregens()[0]; hero.id = 'h1'; hero.pos = { x: 3, y: 4 };
    const ally = makePregens()[1]; ally.id = 'h2'; ally.pos = { x: 1, y: 1 };
    const enemy: Combatant = spawnEnemy({ ref: 'brigand' }, 'e1', { x: 4, y: 4 }); // adjacent au héros
    const battle = {
      combatants: [hero, ally, enemy], order: ['h1', 'h2', 'e1'], baseOrder: ['h1', 'h2', 'e1'],
      turn: 0, round: 1, action: null, selectedSpellId: null, reachable: new Map(),
      movementUsed: 0, movedPreAction: false, acted: false, log: [], over: null, preview: null,
    } as unknown as BattleState;
    const battleClickEntity = vi.fn();
    const battleClickTile = vi.fn();
    const setInspectId = vi.fn();
    const scene: Scene = emptyScene(8, 8);
    useGame.setState({ scene, mode: 'battle', dialogue: null, battle, party: [hero, ally], inspectId: null, battleClickEntity, battleClickTile, setInspectId });
    monter(dims);
    return { battleClickEntity, battleClickTile, setInspectId };
  }

  const clicDroit = (x: number, y: number) =>
    act(() => pointer!.handlers.onContextMenu({ clientX: x, clientY: y, preventDefault: () => undefined } as unknown as React.MouseEvent));

  it('clic droit sur un jeton ENNEMI : sa fiche, et AUCUNE attaque', () => {
    const { battleClickEntity, setInspectId } = combat();
    const { cx, cy } = px(4, 4);
    clicDroit(cx, cy);
    expect(setInspectId).toHaveBeenCalledWith('e1');
    expect(battleClickEntity, 'le clic droit n’attaque pas').not.toHaveBeenCalled();
  });

  it('clic droit sur un jeton ALLIÉ : sa fiche', () => {
    const { setInspectId } = combat();
    const { cx, cy } = px(1, 1);
    clicDroit(cx, cy);
    expect(setInspectId).toHaveBeenCalledWith('h2');
  });

  it('clic droit sur une case vide : rien ne s’ouvre', () => {
    const { setInspectId } = combat();
    const { cx, cy } = px(6, 1);
    clicDroit(cx, cy);
    expect(setInspectId).not.toHaveBeenCalled();
  });

  it('clic GAUCHE sur l’ennemi à portée : l’attaque, sans fiche', () => {
    const { battleClickEntity, setInspectId } = combat();
    const { cx, cy } = px(4, 4);
    act(() => pointer!.handlers.onPointerDown(ev(cx, cy)));
    act(() => pointer!.handlers.onPointerUp(ev(cx, cy)));
    expect(battleClickEntity).toHaveBeenCalledWith('e1', { confirm: true });
    expect(setInspectId).not.toHaveBeenCalled();
  });

  it(`appui long (${DELAI_APPUI_LONG} ms immobile) sur l’ennemi : sa fiche — puis ni clic au relâchement, ni second geste au \`contextmenu\` dérivé`, () => {
    vi.useFakeTimers();
    const { battleClickEntity, setInspectId } = combat();
    const { cx, cy } = px(4, 4);
    act(() => pointer!.handlers.onPointerDown(ev(cx, cy)));
    act(() => { vi.advanceTimersByTime(DELAI_APPUI_LONG - 1); });
    expect(setInspectId, 'avant le seuil, rien').not.toHaveBeenCalled();
    act(() => { vi.advanceTimersByTime(1); });
    expect(setInspectId).toHaveBeenCalledWith('e1');
    act(() => pointer!.handlers.onPointerUp(ev(cx, cy)));
    expect(battleClickEntity, 'l’appui long a été servi : pas de `performClick`').not.toHaveBeenCalled();
    clicDroit(cx, cy);
    expect(setInspectId, 'le `contextmenu` dérivé de l’appui est avalé').toHaveBeenCalledTimes(1);
  });

  it('un glisser de 7 px n’inspecte pas, et le panoramique garde sa capture jusqu’au relâchement', () => {
    vi.useFakeTimers();
    const { setInspectId, battleClickEntity } = combat();
    const { cx, cy } = px(4, 4);
    act(() => pointer!.handlers.onPointerDown(ev(cx, cy)));
    expect(svg.setPointerCapture).toHaveBeenCalledTimes(1);
    act(() => pointer!.handlers.onPointerMove(ev(cx + 7, cy)));
    act(() => { vi.advanceTimersByTime(DELAI_APPUI_LONG * 2); });
    expect(setInspectId, 'le panoramique a désarmé l’appui').not.toHaveBeenCalled();
    expect(svg.releasePointerCapture, 'l’annulation de l’appui ne rend pas la capture du glisser').not.toHaveBeenCalled();
    act(() => pointer!.handlers.onPointerUp(ev(cx + 7, cy)));
    expect(svg.releasePointerCapture).toHaveBeenCalledTimes(1);
    expect(battleClickEntity, 'un glisser n’est pas un clic').not.toHaveBeenCalled();
  });

  it('un DEUXIÈME doigt annule l’appui : rien ne s’ouvre, et le geste suivant n’est pas avalé', () => {
    vi.useFakeTimers();
    const { setInspectId } = combat();
    const { cx, cy } = px(4, 4);
    act(() => pointer!.handlers.onPointerDown(ev(cx, cy, 1)));
    act(() => pointer!.handlers.onPointerDown(ev(cx + 80, cy + 40, 2)));
    act(() => { vi.advanceTimersByTime(DELAI_APPUI_LONG); });
    expect(setInspectId).not.toHaveBeenCalled();
    act(() => pointer!.handlers.onPointerUp(ev(cx + 80, cy + 40, 2)));
    act(() => pointer!.handlers.onPointerUp(ev(cx, cy, 1)));
    clicDroit(cx, cy);
    expect(setInspectId, 'aucun appui n’a été servi : le clic droit qui suit ouvre la fiche').toHaveBeenCalledWith('e1');
  });

  for (const [regime, survol, type] of [['stylet, pointeur à survol', true, 'pen'], ['doigt, sans survol', false, 'touch']] as const) {
    it(`${regime} : appui TENU puis relâché à 1300 ms — la fiche, et AUCUN clic au relâchement`, () => {
      vi.useFakeTimers();
      vi.mocked(window.matchMedia).mockReturnValue({ matches: survol } as unknown as MediaQueryList);
      const { battleClickEntity, setInspectId } = combat();
      const { cx, cy } = px(4, 4);
      act(() => pointer!.handlers.onPointerDown(ev(cx, cy, 1, 0, type)));
      act(() => { vi.advanceTimersByTime(DELAI_APPUI_LONG); });
      expect(setInspectId).toHaveBeenCalledWith('e1');
      act(() => { vi.advanceTimersByTime(1300 - DELAI_APPUI_LONG); });
      act(() => pointer!.handlers.onPointerUp(ev(cx, cy, 1, 0, type)));
      expect(battleClickEntity, 'l’appui tenu a été servi : pas de clic au relâchement').not.toHaveBeenCalled();
    });
  }

  it('SOURIS : un clic gauche LENT (600 ms) sur l’ennemi ATTAQUE, sans fiche — la souris a le clic droit', () => {
    vi.useFakeTimers();
    const { battleClickEntity, setInspectId } = combat();
    const { cx, cy } = px(4, 4);
    act(() => pointer!.handlers.onPointerDown(ev(cx, cy, 1, 0, 'mouse')));
    act(() => { vi.advanceTimersByTime(600); });
    act(() => pointer!.handlers.onPointerUp(ev(cx, cy, 1, 0, 'mouse')));
    expect(setInspectId).not.toHaveBeenCalled();
    expect(battleClickEntity).toHaveBeenCalledWith('e1', { confirm: true });
  });

  it('Android : `contextmenu` natif AVANT le minuteur, puis `pointercancel` — la fiche, aucun clic, la capture rendue', () => {
    vi.useFakeTimers();
    vi.mocked(window.matchMedia).mockReturnValue({ matches: false } as unknown as MediaQueryList);
    const { battleClickEntity, setInspectId } = combat();
    const { cx, cy } = px(4, 4);
    act(() => pointer!.handlers.onPointerDown(ev(cx, cy, 1, 0, 'touch')));
    act(() => { vi.advanceTimersByTime(400); });
    clicDroit(cx, cy);
    expect(setInspectId).toHaveBeenCalledWith('e1');
    act(() => pointer!.handlers.onPointerCancel(ev(cx, cy, 1, 0, 'touch')));
    act(() => { vi.advanceTimersByTime(DELAI_APPUI_LONG * 2); });
    expect(battleClickEntity, 'le `pointercancel` ne rejoue pas le clic').not.toHaveBeenCalled();
    expect(setInspectId, 'le minuteur, terminé, ne rouvre rien').toHaveBeenCalledTimes(1);
    expect(svg.releasePointerCapture).toHaveBeenCalledTimes(1);
  });

  it('un appui lent sur le SOL n’est pas armé : il reste un clic', () => {
    vi.useFakeTimers();
    const { battleClickTile, setInspectId } = combat();
    const { cx, cy } = px(6, 1);
    act(() => pointer!.handlers.onPointerDown(ev(cx, cy)));
    act(() => { vi.advanceTimersByTime(DELAI_APPUI_LONG * 2); });
    act(() => pointer!.handlers.onPointerUp(ev(cx, cy)));
    expect(setInspectId).not.toHaveBeenCalled();
    expect(battleClickTile).toHaveBeenCalledWith({ x: 6, y: 1 }, { confirm: true });
  });
});

describe('hors combat : le clic droit ouvre la fiche d’un PNJ, le clic gauche garde l’offre', () => {
  function exploration() {
    poserScenario(useGame.getState, scenario);
    const scene = useGame.getState().scene!;
    const dims: Dims = { w: scene.dimensions.w, h: scene.dimensions.h, rot: 0, view: 'iso' };
    monter(dims);
    return { scene, px: (x: number, y: number) => tileCenter(x, y, dims) };
  }

  it('clic droit sur `npc-phillipe` : sa fiche', () => {
    const { px } = exploration();
    const { cx, cy } = px(5, 4);
    act(() => pointer!.handlers.onContextMenu({ clientX: cx, clientY: cy, preventDefault: () => undefined } as unknown as React.MouseEvent));
    expect(useGame.getState().inspectId).toBe('npc-phillipe');
  });

  it('clic droit sur le sol : rien ne s’ouvre', () => {
    const { px } = exploration();
    const { cx, cy } = px(0, 0);
    act(() => pointer!.handlers.onContextMenu({ clientX: cx, clientY: cy, preventDefault: () => undefined } as unknown as React.MouseEvent));
    expect(useGame.getState().inspectId).toBeNull();
  });

  it('clic GAUCHE sur `npc-phillipe` (une offre : parler) : l’offre, jamais la fiche', () => {
    const { px } = exploration();
    const { cx, cy } = px(5, 4);
    act(() => pointer!.handlers.onPointerDown(ev(cx, cy)));
    act(() => pointer!.handlers.onPointerUp(ev(cx, cy)));
    const st = useGame.getState();
    expect(st.inspectId).toBeNull();
    expect(st.dialogue ?? st.pendingInteract, 'le clic joue ou vise l’offre').toBeTruthy();
  });

  it('clic GAUCHE sur le figurant `npc-josef` : la marche ou sa réplique, jamais la fiche', () => {
    const { px } = exploration();
    const journal0 = useGame.getState().journal.length;
    const pos0 = useGame.getState().partyPos;
    vi.useFakeTimers();
    const { cx, cy } = px(3, 2);
    act(() => pointer!.handlers.onPointerDown(ev(cx, cy)));
    act(() => pointer!.handlers.onPointerUp(ev(cx, cy)));
    act(() => { vi.runOnlyPendingTimers(); });
    const st = useGame.getState();
    expect(st.inspectId).toBeNull();
    expect(st.journal.length > journal0 || st.partyPos !== pos0, 'le figurant répond ou le groupe s’approche').toBe(true);
  });
});

describe('hors combat : le SURVOL publie la fiche que le POINTEUR désigne — ce que la touche `inspecter` ouvre', () => {
  /** Le pointeur et le survol COMPOSÉS comme l'hôte du monde les compose (`MondeDeCampagne`). */
  function survol() {
    const scene = useGame.getState().scene!;
    const dims: Dims = { w: scene.dimensions.w, h: scene.dimensions.h, rot: 0, view: 'iso' };
    svg = stageEl();
    const Probe = () => {
      const svgRef = useRef(svg as unknown as SVGSVGElement);
      const camRef = useRef({ x: 0, y: 0 });
      pointer = useStagePointer({ svgRef, dims, zoom: 1, camRef, hoverTracking: false, partyLeader: undefined, activeZ: 0, aretes: [] });
      useHoverTargeting(useGame.getState().scene, pointer.hover, false, null, pointer.ficheSurvolee);
      return null;
    };
    root = createRoot(document.createElement('div'));
    act(() => root!.render(<Probe />));
    return (x: number, y: number) => {
      const { cx, cy } = tileCenter(x, y, dims);
      act(() => pointer!.handlers.onPointerMove(ev(cx, cy)));
      return { cx, cy };
    };
  }

  it('la case de `npc-phillipe` survolée : `hovered` le nomme ; le sol, puis la sortie du stage, le vident', () => {
    poserScenario(useGame.getState, scenario);
    const survoler = survol();
    survoler(5, 4);
    expect(useGame.getState().hovered).toBe('npc-phillipe');
    survoler(0, 0);
    expect(useGame.getState().hovered).toBeNull();
    survoler(5, 4);
    act(() => pointer!.handlers.onPointerLeave());
    expect(useGame.getState().hovered).toBeNull();
  });

  it('un RAYON qui nomme une autre entité que celle que la CASE élirait : la touche I ouvre CELLE du rayon — celle du clic droit', () => {
    // Deux personnages sur la case de Phillipe : la case élit l'UTILISABLE (Phillipe, qui parle,
    // `geste.ts:entiteDuGeste`), le rayon nomme l'autre — c'est lui que le pointeur désigne.
    poserScenario(useGame.getState, scenario);
    const volumique = props.find((p) => p.volume)!.id;
    const sc = useGame.getState().scene!;
    const ombre = { id: 'npc-ombre', kind: 'personnage', pos: { x: 5, y: 4 }, presetId: 'edo-josef-quartjin', label: 'Ombre' };
    const decor = { id: 'decor-volumique', kind: 'prop', pos: { x: 0, y: 0 }, ref: volumique };
    useGame.setState({ screen: 'campaign', inspectId: null, scene: { ...sc, entities: [...sc.entities, ombre, decor] } as Scene });
    setSpritePicker(() => ({ kind: 'entity', id: 'npc-ombre' }));
    const survoler = survol();
    const { cx, cy } = survoler(5, 4);
    expect(useGame.getState().hovered, 'le survol suit le rayon, pas l’élection de la case').toBe('npc-ombre');
    runBindingById('inspecter', useGame.getState);
    expect(useGame.getState().inspectId).toBe('npc-ombre');
    act(() => { useGame.setState({ inspectId: null }); });
    act(() => pointer!.handlers.onContextMenu({ clientX: cx, clientY: cy, preventDefault: () => undefined } as unknown as React.MouseEvent));
    expect(useGame.getState().inspectId, 'le clic droit désigne la même entité').toBe('npc-ombre');
  });
});

describe('manette : R3 sur la carte est la touche `inspecter`', () => {
  it('R3 ouvre la fiche du survolé ; RB, lui, garde la cible suivante et n’ouvre rien', () => {
    poserScenario(useGame.getState, scenario);
    useGame.setState({ screen: 'campaign', inspectId: null, hovered: 'npc-josef' });
    act(() => { padButton('RB'); });
    expect(useGame.getState().inspectId).toBeNull();
    act(() => { padButton('R3'); });
    expect(useGame.getState().inspectId).toBe('npc-josef');
  });
});
