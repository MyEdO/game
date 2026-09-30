// @vitest-environment jsdom
import { act, useRef } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { tileCenter, tileEdge, type Dims } from '../../geometry/iso';
import { metricToLift } from '../../state/relief';
import { emptyScene, heightAt, liftDe, type Scene } from '../../state/scene';
import { aretesUtilisables } from '../../state/aretes';
import { useGame } from '../../state/store';
import type { Pt } from '../../state/path';
import { projeterAretes, type AreteProjetee } from './aretesProjetees';
import { VH, VW } from './useStageCamera';
import { useStagePointer, type StagePointer } from './useStagePointer';
import { AreteOverlay } from './AreteOverlay';

/**
 * ESCALADE ET CHUTE PAR L'ÉTAGE `arete` (#1687, lot 1b-3) — les deux gestes de dénivelé ne sont plus
 * servis par un overlay qui prend le pointeur : ils passent par la chaîne (verdict de pixel), par LA
 * table des gestes (`stage/geste.ts`) et par le régime de geste commun (`hoverClickCommits`). Ce banc
 * remplace les deux bancs de régime du lot 1b-0 sur les MÊMES scènes fabriquées : l'arête peinte est la
 * même, le geste appelé est le même, et la GÉOMÉTRIE est désormais celle du lift MÉTRIQUE — mesurée
 * ci-dessous, plate ET en relief.
 */

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
Object.defineProperty(window, 'matchMedia', { configurable: true, value: vi.fn() });
// `matches: true` = pointeur FIN (souris), défaut de ce banc : un clic COMMET. Un test tactile pose
// `false` lui-même. `restoreMocks: true` (vite.config.ts) rend le `vi.fn()` nu entre deux tests.
beforeEach(() => {
  vi.mocked(window.matchMedia).mockReturnValue({ matches: true } as unknown as MediaQueryList);
});

const dims: Dims = { w: 5, h: 4, rot: 0, view: 'iso' };

/** Élément de stage MESURÉ : sa surface vaut exactement le viewBox (VW×VH) posé au coin (0,0) — un
 *  pixel client EST donc un point de viewBox, le contrat que le picking inverse. */
function stageEl(): SVGSVGElement {
  return {
    getBoundingClientRect: () => ({ left: 0, top: 0, width: VW, height: VH }) as DOMRect,
    setPointerCapture: () => undefined,
    releasePointerCapture: () => undefined,
  } as unknown as SVGSVGElement;
}

function pointerEvent(x: number, y: number) {
  return {
    button: 0,
    clientX: x,
    clientY: y,
    pointerId: 1,
    currentTarget: { style: {} },
  } as unknown as React.PointerEvent;
}

/** Scène 5×4 : une arête grimpable en (1,1,E) — le mobile se tient en (1,1), la case d'en face (2,1)
 *  est 4 m plus haut. */
function scèneGrimpable(): Scene {
  const s = emptyScene(5, 4);
  const h = new Array(5 * 4).fill(0) as number[];
  h[1 * 5 + 2] = 4;
  s.layers[0].height = h;
  s.walls = [{ x: 1, y: 1, side: 'E', climb: { kind: 'surface' } }];
  return s;
}

/** Scène 5×4 : une CORNICHE — toute la rangée y=0 à 4 m, le reste au sol, sans arête `climb`. Depuis
 *  (2,0), seul le cardinal SUD descend. */
function scèneDeFalaise(): Scene {
  const s = emptyScene(5, 4);
  const h = new Array(5 * 4).fill(0) as number[];
  for (let x = 0; x < 5; x += 1) h[x] = 4;
  s.layers[0].height = h;
  return s;
}

/** L'offre de l'hôte : les arêtes du dériveur, projetées par la fonction que le picking ET le peintre
 *  consultent — le lift est celui de la case d'ancrage, en unités de NIVEAU. */
const offre = (scene: Scene, controleur: Pt, visible: string[], lift: (p: Pt) => number = () => 0): readonly AreteProjetee[] => projeterAretes(
  aretesUtilisables({ scene, visible: new Set(visible), controleur, activeZ: controleur.z ?? 0 }),
  dims,
  lift,
);

const ESCALADE = () => offre(scèneGrimpable(), { x: 1, y: 1, z: 0 }, ['1,1,0', '2,1,0']);
const CHUTE = () => offre(scèneDeFalaise(), { x: 2, y: 0, z: 0 }, ['2,0,0', '2,1,0']);
const milieuPt = (a: AreteProjetee) => ({ cx: (a.a.cx + a.b.cx) / 2, cy: (a.a.cy + a.b.cy) / 2 });
const milieu = (a: AreteProjetee) => pointerEvent(milieuPt(a).cx, milieuPt(a).cy);

/** Le SOL, témoin muet : un clic tranché par l'étage `arete` ne fait pas marcher le groupe. On collecte
 *  ce que le déplacement reçoit ; la liste vide EST l'assertion. */
const solQuiCompte = () => {
  const positions: Pt[] = [];
  return { positions, moveParty: vi.fn((pos: Pt) => { positions.push(pos); }) };
};

const CLIMB_ACROSS_VRAI = useGame.getState().climbAcross;
const FALL_ACROSS_VRAI = useGame.getState().fallAcross;
const MOVE_PARTY_VRAI = useGame.getState().moveParty;

describe('Escalade et chute passent par l’étage `arete`', () => {
  let root: Root | null = null;
  let pointer: StagePointer | undefined;
  /** Conteneur ATTACHÉ au document — un événement natif n'atteint la racine React que dans un arbre
   *  connecté ; détaché quoi qu'il arrive, y compris quand une assertion rompt le test. */
  let attache: HTMLElement | null = null;

  const monter = (aretes: readonly AreteProjetee[]) => {
    const Probe = () => {
      const svgRef = useRef(stageEl());
      const camRef = useRef({ x: 0, y: 0 });
      pointer = useStagePointer({ svgRef, dims, zoom: 1, camRef, hoverTracking: false, partyLeader: undefined, activeZ: 0, aretes });
      return null;
    };
    root = createRoot(document.createElement('div'));
    act(() => root!.render(<Probe />));
  };

  afterEach(() => {
    if (root) {
      act(() => root!.unmount());
      root = null;
    }
    pointer = undefined;
    attache?.remove();
    attache = null;
    useGame.setState({ climbAcross: CLIMB_ACROSS_VRAI, fallAcross: FALL_ACROSS_VRAI, moveParty: MOVE_PARTY_VRAI });
  });

  it('un clic sur le trait d’escalade grimpe vers la case d’en face, par le VERDICT de pixel', () => {
    const climbAcross = vi.fn();
    const { positions, moveParty } = solQuiCompte();
    useGame.setState({ scene: scèneGrimpable(), mode: 'exploration', dialogue: null, partyPos: { x: 1, y: 1 }, party: [], climbAcross, moveParty });
    const aretes = ESCALADE();
    monter(aretes);

    act(() => pointer!.handlers.onPointerDown(milieu(aretes[0])));
    act(() => pointer!.handlers.onPointerUp(milieu(aretes[0])));

    expect(climbAcross).toHaveBeenCalledWith({ x: 1, y: 1, z: 0 }, { x: 2, y: 1, z: 0 });
    expect(positions, 'le sol ne reçoit rien : l’étage `arete` a tranché le pixel').toEqual([]);
  });

  it('un clic sur le trait de chute ouvre le saut vers la case d’en bas, par le VERDICT de pixel', () => {
    const fallAcross = vi.fn();
    const { positions, moveParty } = solQuiCompte();
    useGame.setState({ scene: scèneDeFalaise(), mode: 'exploration', dialogue: null, partyPos: { x: 2, y: 0 }, party: [], fallAcross, moveParty });
    const aretes = CHUTE();
    monter(aretes);

    act(() => pointer!.handlers.onPointerDown(milieu(aretes[0])));
    act(() => pointer!.handlers.onPointerUp(milieu(aretes[0])));

    expect(fallAcross).toHaveBeenCalledWith({ x: 2, y: 0, z: 0 }, { x: 2, y: 1, z: 0 });
    expect(positions, 'le sol ne reçoit rien : l’étage `arete` a tranché le pixel').toEqual([]);
  });

  it('le trait qui porte le nom est hit-testable, et son événement BULLE jusqu’au handler racine du stage', () => {
    // Le nom au survol est ici une infobulle NATIVE (`<title>`) : un élément sans hit-test ne la montre
    // pas. Le trait la reprend donc SANS handler — le `pointerdown` qui s'y pose remonte au SVG racine,
    // qui résout par le PIXEL (`pickResolve`), pas par la cible : une seule chaîne d'activation.
    const climbAcross = vi.fn();
    const { positions, moveParty } = solQuiCompte();
    useGame.setState({ scene: scèneGrimpable(), mode: 'exploration', dialogue: null, partyPos: { x: 1, y: 1 }, party: [], climbAcross, moveParty });
    const aretes = ESCALADE();

    const Harnais = () => {
      const svgRef = useRef<SVGSVGElement>(null);
      const camRef = useRef({ x: 0, y: 0 });
      const p = useStagePointer({ svgRef, dims, zoom: 1, camRef, hoverTracking: false, partyLeader: undefined, activeZ: 0, aretes });
      return (
        <svg ref={svgRef} {...p.handlers}>
          <AreteOverlay
            aretes={aretes}
            areteSurvolee={p.areteSurvolee?.cle ?? null}
            activerArete={p.activerArete}
            onFocusArete={p.survolerArete}
            onBlurArete={() => p.survolerArete(null)}
          />
        </svg>
      );
    };
    const container = document.createElement('div');
    attache = container;
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => root!.render(<Harnais />));
    const svg = container.querySelector('svg')!;
    // jsdom n'a pas de layout : on POSE la surface que le picking inverse — le viewBox au coin (0,0),
    // comme `stageEl()` ci-dessus, et les captures de pointeur que l'élément n'implémente pas.
    Object.assign(svg, {
      getBoundingClientRect: () => ({ left: 0, top: 0, width: VW, height: VH }) as DOMRect,
      setPointerCapture: () => undefined,
      releasePointerCapture: () => undefined,
    });
    const prise = container.querySelector('[data-arete-cible]')!;
    const { cx, cy } = milieuPt(aretes[0]);

    expect(prise.querySelector('title')?.textContent, 'le nom au survol est peint').toBe(aretes[0].arete.libelle);
    expect(prise.getAttribute('pointer-events'), 'sans hit-test, aucune infobulle native').toBe('visibleStroke');

    act(() => {
      prise.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, clientX: cx, clientY: cy }));
      prise.dispatchEvent(new MouseEvent('pointerup', { bubbles: true, clientX: cx, clientY: cy }));
    });

    expect(climbAcross).toHaveBeenCalledWith({ x: 1, y: 1, z: 0 }, { x: 2, y: 1, z: 0 });
    expect(positions, 'le sol ne reçoit rien : l’étage `arete` a tranché le pixel').toEqual([]);
  });

  it('la touche du peintre appelle LE MÊME geste que le pixel — un seul chemin d’activation', () => {
    const climbAcross = vi.fn();
    useGame.setState({ scene: scèneGrimpable(), mode: 'exploration', dialogue: null, climbAcross });
    const aretes = ESCALADE();
    monter(aretes);

    act(() => pointer!.activerArete(aretes[0].arete));

    expect(climbAcross).toHaveBeenCalledWith({ x: 1, y: 1, z: 0 }, { x: 2, y: 1, z: 0 });
  });

  it('sans survol (tactile), le premier tap ARME l’arête et le second la joue — le régime de tout le stage', () => {
    vi.mocked(window.matchMedia).mockReturnValue({ matches: false } as unknown as MediaQueryList);
    const fallAcross = vi.fn();
    useGame.setState({ scene: scèneDeFalaise(), mode: 'exploration', dialogue: null, fallAcross });
    const aretes = CHUTE();
    monter(aretes);

    act(() => pointer!.activerArete(aretes[0].arete));
    expect(fallAcross, 'tap 1 : l’arête est armée, rien n’est joué').not.toHaveBeenCalled();
    expect(pointer!.areteSurvolee?.cle).toBe(aretes[0].arete.cle);

    act(() => pointer!.activerArete(aretes[0].arete));
    expect(fallAcross).toHaveBeenCalledWith({ x: 2, y: 0, z: 0 }, { x: 2, y: 1, z: 0 });
  });

  it('le survol au pixel arme l’arête de dénivelé, et la quitter la désarme', () => {
    useGame.setState({ scene: scèneGrimpable(), mode: 'exploration', dialogue: null });
    const aretes = ESCALADE();
    monter(aretes);

    act(() => pointer!.handlers.onPointerMove(milieu(aretes[0])));
    expect(pointer!.areteSurvolee?.cle).toBe(aretes[0].arete.cle);

    act(() => pointer!.handlers.onPointerMove(pointerEvent(0, 0)));
    expect(pointer!.areteSurvolee).toBeNull();
  });

  describe('LIFT MÉTRIQUE — ce que le lot 1b-3 déplace à l’écran', () => {
    it('à plat, le segment est celui que peignaient les overlays de couche (index 0)', () => {
      for (const [aretes, attendu] of [
        [ESCALADE(), tileEdge(1, 1, 'E', dims, 0)],
        [CHUTE(), tileEdge(2, 1, 'N', dims, 0)],
      ] as const) {
        expect([aretes[0].a, aretes[0].b]).toEqual([
          { cx: attendu[0].cx, cy: attendu[0].cy },
          { cx: attendu[1].cx, cy: attendu[1].cy },
        ]);
      }
    });

    it('en relief, l’arête MONTE de la hauteur métrique de sa case — là où l’index de couche la laissait au plancher', () => {
      // Une passerelle : couche 1, plancher à 6 m — soit 1,5 NIVEAU, quand l'index de couche vaut 1.
      // C'est l'écart que les marqueurs d'escalade/chute portaient (`AreteUtilisable.z` = l'index) et
      // que la projection unique corrige : ils suivent désormais le sol qu'on voit.
      const scene = scèneGrimpable();
      const hauteurs = new Array(5 * 4).fill(6) as number[];
      scene.layers.push({ z: 1, tiles: new Array(5 * 4).fill(scene.layers[0].tiles[0]), height: hauteurs }); // plancher MARCHABLE
      scene.walls = [{ x: 1, y: 1, side: 'E', z: 1, climb: { kind: 'surface' } }];
      const controleur: Pt = { x: 1, y: 1, z: 1 };
      const vues = ['1,1,1', '2,1,1'];
      const metrique = offre(scene, controleur, vues, (p) => liftDe(scene, p));
      const parIndex = offre(scene, controleur, vues, (p) => p.z ?? 0);

      expect(metrique, 'la scène offre bien l’arête grimpable de la couche 1').toHaveLength(1);
      expect(metricToLift(heightAt(scene, 1, 1, 1))).toBe(1.5);
      const montee = tileCenter(0, 0, dims, 1).cy - tileCenter(0, 0, dims, 1.5).cy;
      expect(montee, 'un demi-niveau se voit').toBeGreaterThan(0);
      expect(parIndex[0].a.cy - metrique[0].a.cy).toBeCloseTo(montee, 6);
      expect(parIndex[0].b.cy - metrique[0].b.cy).toBeCloseTo(montee, 6);
      expect(metrique[0].a.cx).toBe(parIndex[0].a.cx);
    });
  });
});
