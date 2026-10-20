// @vitest-environment jsdom
/**
 * TACTILE À DEUX DOIGTS sur le stage de jeu : la caméra du jeu n'a plus de plaque de boutons — le
 * zoom et le panoramique se prennent au GESTE. Ce qui se mesure ici est le RÉGIME : deux pointeurs
 * actifs pilotent `setZoom` + le pan vivant (`state/stagePan`, posé HORS de React et commis au store
 * au relâchement), un seul garde strictement le glisser historique (et ne touche JAMAIS au zoom).
 * Le patron du geste est celui, éprouvé, de `ui/MapCanvas`.
 */
import { useRef } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Dims } from '../../geometry/iso';
import { emptyScene } from '../../noyau/monde/scene';
import { getStagePan, poserPan } from '../../state/stagePan';
import { useGame } from '../../state/store';
import { VH, VW } from './useStageCamera';
import { useStagePointer, type StagePointer } from './useStagePointer';

const dims: Dims = { w: 8, h: 8, rot: 0, view: 'iso' };

/** Élément de stage MESURÉ : sa surface vaut exactement le viewBox posé au coin (0,0). */
function stageEl(): SVGSVGElement {
  return {
    getBoundingClientRect: () => ({ left: 0, top: 0, width: VW, height: VH }) as DOMRect,
    setPointerCapture: () => undefined,
    releasePointerCapture: () => undefined,
  } as unknown as SVGSVGElement;
}

// Ce banc remplace des ACTIONS du store par des sondes (`setZoom`, `moveParty`). Le store est partagé
// par toute la suite (`isolate: false`) : une action laissée stubbée fait tourner à vide le geste d'un
// fichier voisin, qui mesure alors un monde qui ne bouge plus.
const ACTIONS_VRAIES = { setZoom: useGame.getState().setZoom, moveParty: useGame.getState().moveParty };
afterEach(() => useGame.setState(ACTIONS_VRAIES));

/** Événement de pointeur TACTILE : c'est le `pointerId` qui fait le doigt (le régime se lit à leur nombre). */
const doigt = (pointerId: number, x: number, y: number) =>
  ({ button: 0, clientX: x, clientY: y, pointerId, currentTarget: { style: {} }, preventDefault: () => undefined }) as unknown as React.PointerEvent;

/** Le stage monté sur un état de partie nu. `setZoom` est une SONDE (le zoom est lu au store au moment
 *  du geste) ; le PANORAMIQUE se mesure au pan VIVANT (`getStagePan`) pendant le geste — le store ne
 *  converge qu'au relâchement, c'est la loi de la caméra impérative (`state/stagePan`). */
function monter(): { pointer: StagePointer; setZoom: ReturnType<typeof vi.fn> } {
  const scene = emptyScene('scene-test', 8, 8);
  const setZoom = vi.fn();
  poserPan(0, 0); // le pan vivant est un module : on le remet à zéro entre deux tests
  useGame.setState({ scene, mode: 'exploration', partyPos: { x: 2, y: 1 }, party: [], dialogue: null, zoom: 1, camPan: { x: 0, y: 0 }, setZoom });
  let pointer: StagePointer | undefined;
  const Probe = () => {
    const svgRef = useRef(stageEl());
    const camRef = useRef({ x: 0, y: 0 });
    pointer = useStagePointer({ svgRef, dims, zoom: 1, camRef, hoverTracking: false, partyLeader: undefined, activeZ: 0, aretes: [] });
    return null;
  };
  renderToStaticMarkup(<Probe />);
  return { pointer: pointer!, setZoom };
}

describe('useStagePointer — pincer à deux doigts', () => {
  it('deux doigts qui s’écartent ZOOMENT (rapport des écarts) et leur milieu PANORAMIQUE', () => {
    const { pointer, setZoom } = monter();

    pointer.handlers.onPointerDown(doigt(1, 100, 100));
    pointer.handlers.onPointerDown(doigt(2, 200, 100)); // écart 100, milieu (150,100)
    expect(setZoom).not.toHaveBeenCalled(); // l'appui seul ne zoome pas

    pointer.handlers.onPointerMove(doigt(2, 300, 100)); // écart 200 → ×2 ; milieu (200,100) → il a glissé

    expect(setZoom).toHaveBeenCalledTimes(1);
    expect(setZoom.mock.calls[0][0]).toBeCloseTo(2, 9); // zoom courant 1 × (200/100)
    expect(getStagePan().x).not.toBe(0); // le milieu a glissé vers la droite : panoramique en x (pan VIVANT)
    expect(useGame.getState().camPan.x).toBe(0); // rien n'entre dans le store avant le relâchement

    pointer.handlers.onPointerUp(doigt(2, 300, 100));
    expect(useGame.getState().camPan.x).toBe(getStagePan().x); // FIN DU PINCER : le vivant se commet en UN set
  });

  it('un pincer qui se resserre DÉZOOME, et le geste reste RELATIF au dernier échantillon', () => {
    const { pointer, setZoom } = monter();

    pointer.handlers.onPointerDown(doigt(1, 100, 100));
    pointer.handlers.onPointerDown(doigt(2, 300, 100)); // écart 200
    pointer.handlers.onPointerMove(doigt(2, 200, 100)); // écart 100 → ×0,5

    expect(setZoom.mock.calls[0][0]).toBeCloseTo(0.5, 9);

    pointer.handlers.onPointerMove(doigt(2, 150, 100)); // écart 50 → ×0,5 du PRÉCÉDENT, pas de l'origine
    expect(setZoom.mock.calls[1][0]).toBeCloseTo(0.5, 9); // `zoom` du store est resté 1 (setZoom est ici une sonde)
  });

  it('UN SEUL doigt ne zoome ni ne pince JAMAIS — le glisser historique gouverne seul', () => {
    const { pointer, setZoom } = monter();

    pointer.handlers.onPointerDown(doigt(1, 100, 100));
    pointer.handlers.onPointerMove(doigt(1, 220, 100)); // au-delà de PAN_THRESHOLD : c'est un panoramique

    expect(setZoom).not.toHaveBeenCalled();
    expect(getStagePan().x).not.toBe(0); // le glisser à un doigt panoramique, comme avant (pan VIVANT)
  });

  it('le RELÂCHEMENT d’un doigt du pincer ne commet aucun clic (pas d’ordre de déplacement au bout d’un zoom)', () => {
    const moveParty = vi.fn();
    const { pointer } = monter();
    useGame.setState({ moveParty });

    pointer.handlers.onPointerDown(doigt(1, 100, 100));
    pointer.handlers.onPointerDown(doigt(2, 200, 100));
    pointer.handlers.onPointerMove(doigt(2, 300, 100));
    pointer.handlers.onPointerUp(doigt(2, 300, 100));
    pointer.handlers.onPointerUp(doigt(1, 100, 100));

    expect(moveParty).not.toHaveBeenCalled();
  });
});
