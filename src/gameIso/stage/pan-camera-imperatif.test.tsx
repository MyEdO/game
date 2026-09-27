// @vitest-environment jsdom
import { Profiler, act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { useGame, type BattleState } from '../../state/store';
import { emptyScene } from '../../state/scene';
import { getStagePan, resetStagePan } from '../../state/stagePan';
import type { Combatant } from '../../engine/types';
import { MondeDeCampagne } from './MondeDeCampagne';
import { battreStageFrames } from './stageFrames';
import { DUREE_FOCALE_MS } from './useStageCamera';
import { setStageRendererFactory } from './GameStage3D';
import { BancRenderer, brancherArdoise } from './banc-volumique';

/**
 * GLISSER-CAMÉRA IMPÉRATIF — une valeur de caméra par IMAGE, deux clients servis par elle.
 *
 * Pendant le geste, le décalage vit hors de React (`state/stagePan`) : le store ne reçoit RIEN, donc
 * l'écran ne commite RIEN, et c'est le battement de frame qui repose le groupe d'overlays SVG comme la
 * caméra three. Le commit du store arrive au relâchement, une fois, sur la valeur déjà affichée.
 *
 * Et le groupe d'overlays ne LISSE plus rien de son côté : une transition CSS sur `transform` chasserait
 * une caméra volumique posée, elle, à l'image près — c'est la désynchronisation qu'on voyait au pan.
 */
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

brancherArdoise();
beforeAll(() => setStageRendererFactory(() => new BancRenderer()));
afterAll(() => setStageRendererFactory(null));

function hero(id: string, pos: { x: number; y: number }): Combatant {
  return {
    id, label: id, kind: 'hero', species: 'humains-reiklander', pos, size: 'moyenne',
    wounds: { current: 12, max: 12 }, weapons: [],
    characteristics: {}, advantage: 0, conditions: [], armour: {},
    skills: [], talents: [], movement: 4,
  } as unknown as Combatant;
}

let root: Root | null = null;
let container: HTMLDivElement | null = null;

function monter(retouche: Record<string, unknown> = {}): { el: HTMLDivElement; commits: () => number } {
  useGame.setState({
    scene: emptyScene(8, 8),
    mode: 'exploration',
    partyPos: { x: 2, y: 2 },
    party: [hero('h1', { x: 2, y: 2 })],
    battle: null,
    dialogue: null,
    flags: {},
    camPan: { x: 0, y: 0 },
    ...retouche,
  } as never);
  resetStagePan();
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  let n = 0;
  act(() => root!.render(<Profiler id="stage" onRender={() => { n += 1; }}><MondeDeCampagne /></Profiler>));
  return { el: container!, commits: () => n };
}

/** Remonte un stage SANS toucher ni au store ni au décalage vivant : ce que voit le joueur qui revient
 *  à l'écran (rouvrir la carte, sortir d'un combat) avec l'état laissé par le montage précédent. */
function monterSansReset(): { el: HTMLDivElement } {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => root!.render(<MondeDeCampagne />));
  return { el: container };
}

const groupe = (el: HTMLElement) => el.querySelector('svg.iso-stage > g') as SVGGElement;

function svgMesuré(el: HTMLElement): SVGSVGElement {
  const svg = el.querySelector('svg.iso-stage') as SVGSVGElement;
  svg.getBoundingClientRect = () => ({ left: 0, top: 0, width: 1280, height: 720, right: 1280, bottom: 720, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect;
  svg.setPointerCapture = () => undefined;
  svg.releasePointerCapture = () => undefined;
  return svg;
}

/** Un geste de pointeur au bouton `bouton` (0 = principal), en pixels client. */
function geste(svg: SVGSVGElement, type: string, p: { x: number; y: number }, bouton = 0): void {
  act(() => { svg.dispatchEvent(new MouseEvent(type, { clientX: p.x, clientY: p.y, button: bouton, bubbles: true })); });
}

beforeEach(() => {
  vi.stubGlobal('requestAnimationFrame', () => 0);
  vi.stubGlobal('cancelAnimationFrame', () => {});
});

afterEach(() => {
  if (root) { act(() => root!.unmount()); root = null; }
  if (container) { container.remove(); container = null; }
  resetStagePan();
  useGame.setState({ camPan: { x: 0, y: 0 } });
});

describe('Glisser-caméra — impératif pendant le geste, commis au relâchement', () => {
  it('la vue suit le pointeur SANS aucun `set` du store ni aucun commit React', () => {
    const { el, commits } = monter();
    const svg = svgMesuré(el);
    const depart = groupe(el).style.transform;
    const avant = commits();

    geste(svg, 'pointerdown', { x: 400, y: 300 });
    geste(svg, 'pointermove', { x: 500, y: 340 });

    expect(getStagePan().x).not.toBe(0); // prémisse : le geste a bien passé le seuil de panoramique
    expect(useGame.getState().camPan).toEqual({ x: 0, y: 0 }); // rien n'est entré dans le store…
    expect(commits()).toBe(avant); // …donc rien n'a été re-rendu
    expect(groupe(el).style.transform).not.toBe(depart); // et la vue a pourtant bougé, à l'image

    geste(svg, 'pointerup', { x: 500, y: 340 });
    expect(useGame.getState().camPan.x).toBeCloseTo(getStagePan().x, 9); // UN commit, sur la valeur affichée
  });

  it('le groupe d’overlays ne porte AUCUNE transition sur `transform`', () => {
    const { el } = monter();
    expect(groupe(el).style.transition).not.toContain('transform');
  });

  it('un RECENTRAGE en plein geste gagne : ni saut au relâchement, ni décalage réécrit par-dessus', () => {
    const { el } = monter();
    const svg = svgMesuré(el);
    const centré = groupe(el).style.transform;

    geste(svg, 'pointerdown', { x: 400, y: 300 });
    geste(svg, 'pointermove', { x: 460, y: 300 });
    expect(groupe(el).style.transform).not.toBe(centré); // prémisse : le geste déplace bien la vue

    // Touche de recentrage / nouvelle unité active, EN PLEIN glisser.
    act(() => { useGame.getState().resetCamPan(); });
    expect(getStagePan()).toEqual({ x: 0, y: 0 });
    expect(groupe(el).style.transform).toBe(centré); // le recentrage a repris la main tout de suite

    // Le doigt repart de LÀ : ce qui suit se mesure depuis le recentrage…
    geste(svg, 'pointermove', { x: 520, y: 300 });
    const avantUp = groupe(el).style.transform;
    geste(svg, 'pointerup', { x: 520, y: 300 });

    expect(groupe(el).style.transform).toBe(avantUp); // …et le relâchement ne fait SAUTER rien du tout
    expect(useGame.getState().camPan.x).toBeCloseTo(getStagePan().x, 9);
  });

  it('un démontage EN PLEIN geste ne laisse AUCUN décalage orphelin au montage suivant', () => {
    const { el } = monter();
    const svg = svgMesuré(el);
    const depart = groupe(el).style.transform;

    geste(svg, 'pointerdown', { x: 400, y: 300 });
    geste(svg, 'pointermove', { x: 540, y: 380 });
    expect(getStagePan().x).not.toBe(0); // prémisse : un décalage vivant est bien en vol

    // L'écran est QUITTÉ sans `pointerup` (changement de scène, combat qui s'ouvre).
    act(() => root!.unmount()); root = null;
    container!.remove(); container = null;
    expect(getStagePan()).toEqual(useGame.getState().camPan); // le vivant est rendu au commis

    const second = monterSansReset();
    expect(groupe(second.el).style.transform).toBe(depart); // la vue rouvre au MÊME cadrage
  });
});

/**
 * ADOUCISSEMENT DE FOCALE — quand la caméra change de SUJET, elle ne saute pas : elle court en JS,
 * dans la valeur unique que les deux clients lisent. Le battement est appelé DIRECTEMENT ici (le rAF
 * du navigateur n'existe pas sous jsdom) : c'est exactement ce que fait la boucle.
 */
describe('Focale — la vue COURT vers sa nouvelle cible, elle n’y saute pas', () => {
  let horloge = 0;

  beforeEach(() => {
    horloge = 5000;
    vi.spyOn(performance, 'now').mockImplementation(() => horloge);
  });

  /** Combat à deux unités distantes, au tour de `h1` : le sujet suivi est l'unité ACTIVE (`stageFocus`). */
  const combat = (turn: number): BattleState => ({
    combatants: [hero('h1', { x: 2, y: 2 }), { ...hero('e1', { x: 6, y: 6 }), kind: 'enemy' }],
    order: ['h1', 'e1'], turn, round: 2, over: false, action: null, acted: false, movementUsed: 0,
    preview: null, reachable: new Map<string, number>(), zones: [], log: [],
  }) as unknown as BattleState;

  it('au saut : la vue reste au point QUITTÉ, puis arrive EXACTEMENT sur la cible et s’y arrête', () => {
    const { el } = monter({ mode: 'battle', battle: combat(0), pendingAttack: null, pendingCast: null, hoverCombatantId: null });
    const quitté = groupe(el).style.transform;

    // Le sujet suivi change (l'unité active passe à `e1`) ET son point focal saute de plusieurs cases.
    act(() => { useGame.setState({ battle: combat(1) }); });
    expect(groupe(el).style.transform).toBe(quitté); // le rendu a posé la cible ; l'adoucissement l'a reprise

    horloge += DUREE_FOCALE_MS / 2;
    act(() => { battreStageFrames(); });
    const àMiCourse = groupe(el).style.transform;
    expect(àMiCourse).not.toBe(quitté); // la vue a bougé…

    horloge += DUREE_FOCALE_MS / 2;
    act(() => { battreStageFrames(); });
    const arrivée = groupe(el).style.transform;
    expect(arrivée).not.toBe(àMiCourse); // …et continue jusqu'à l'échéance

    horloge += 1000;
    act(() => { battreStageFrames(); });
    expect(groupe(el).style.transform).toBe(arrivée); // arrivée EXACTE : plus rien ne bouge après
  });
});
