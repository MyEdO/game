// @vitest-environment jsdom
import { describe, it, expect, beforeAll } from 'vitest';
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import {
  centerScrollFor,
  centerScrollForClear,
  clearParts,
  useEditorView,
  type ScrollBox,
  type ScrollPort,
} from './useEditorView';
import { diamondCorners, stageSize, type Dims } from '../../geometry/iso';
import { TraceLayerPanel } from './TraceLayerPanel';

// #894 — une case fautive peut se retrouver sous un panneau flottant ANCRÉ EN BAS du canevas
// (`.trace-layer-panel`, jamais scrollé avec la grille), tout comme sous la barre d'étages en haut :
// le cadrage doit refuser de la déclarer « vue » et la sortir de dessous — sinon le pinceau clique
// sur le panneau, jamais sur la case (clic mort). Mais ces surcouches sont ÉTROITES et ancrées à
// GAUCHE : ce qu'elles masquent est une BOÎTE, pas une bande pleine largeur.

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

const port = (over: Partial<ScrollPort> = {}): ScrollPort => ({
  scrollLeft: 0,
  scrollTop: 0,
  clientWidth: 1000,
  clientHeight: 500,
  scrollWidth: 1000,
  scrollHeight: 2000,
  ...over,
});

/** Le panneau de calque tel qu'il est posé : 220px de large, ancré en bas à GAUCHE. */
const panneauBasGauche: ScrollBox = { left: 14, right: 234, top: 380, bottom: 486 };
/** La barre d'étages telle qu'elle est posée : chip d'environ 300px, ancré en haut à GAUCHE. */
const barreHautGauche: ScrollBox = { left: 14, right: 314, top: 10, bottom: 54 };

describe('centerScrollFor — bandes PLEINE LARGEUR (loi de conteneur, sans surcouche)', () => {
  it('une boîte posée dans la bande basse réservée n’est PAS "vue" : elle doit être recadrée', () => {
    const box: ScrollBox = { left: 100, right: 200, top: 460, bottom: 490 }; // dans les 50 derniers px
    expect(centerScrollFor(box, port(), 0, 50)).not.toBeNull();
  });

  it('la MÊME boîte, SANS marge basse (insetBottom=0), est déjà "vue" — aucun recadrage', () => {
    const box: ScrollBox = { left: 100, right: 200, top: 460, bottom: 490 };
    expect(centerScrollFor(box, port(), 0, 0)).toBeNull();
  });

  it('après recadrage, la boîte retombe dans la fourchette DÉGAGÉE (hors des deux bandes)', () => {
    const box: ScrollBox = { left: 100, right: 200, top: 460, bottom: 490 };
    const insetTop = 30,
      insetBottom = 50;
    const next = centerScrollFor(box, port(), insetTop, insetBottom)!;
    expect(next).not.toBeNull();
    // la boîte ne bouge pas au contenu, seul le scroll change — sa position ÉCRAN = box - next.top.
    expect(box.top - next.top).toBeGreaterThanOrEqual(insetTop - 0.01);
    expect(box.bottom - next.top).toBeLessThanOrEqual(port().clientHeight - insetBottom + 0.01);
  });

  it('marge haute ET basse cumulées : une boîte plus haute que le champ dégagé ne boucle pas (clamp)', () => {
    const box: ScrollBox = { left: 0, right: 10, top: 0, bottom: 1999 }; // couvre tout le contenu
    const next = centerScrollFor(box, port(), 100, 100);
    expect(next).not.toBeNull();
    expect(Number.isFinite(next!.top)).toBe(true);
  });
});

describe('clearParts — ce qui reste CLIQUABLE sous une boîte', () => {
  it('un trou qui coupe le rectangle en deux laisse les deux pans', () => {
    const rect: ScrollBox = { left: 0, right: 100, top: 0, bottom: 10 };
    const parts = clearParts(rect, [{ left: 40, right: 60, top: -5, bottom: 15 }]);
    expect(parts).toEqual([
      { left: 0, right: 40, top: 0, bottom: 10 },
      { left: 60, right: 100, top: 0, bottom: 10 },
    ]);
  });

  it('un trou qui couvre TOUT le rectangle ne laisse rien', () => {
    const rect: ScrollBox = { left: 10, right: 20, top: 10, bottom: 20 };
    expect(clearParts(rect, [{ left: 0, right: 100, top: 0, bottom: 100 }])).toEqual([]);
  });

  it('deux trous qui, ENSEMBLE, recouvrent tout ne laissent rien non plus', () => {
    const rect: ScrollBox = { left: 0, right: 100, top: 0, bottom: 10 };
    const parts = clearParts(rect, [
      { left: -10, right: 50, top: -10, bottom: 20 },
      { left: 50, right: 110, top: -10, bottom: 20 },
    ]);
    expect(parts).toEqual([]);
  });

  it('un trou disjoint laisse le rectangle entier', () => {
    const rect: ScrollBox = { left: 0, right: 100, top: 0, bottom: 10 };
    expect(clearParts(rect, [{ left: 300, right: 400, top: 0, bottom: 10 }])).toEqual([rect]);
  });
});

describe('centerScrollForClear — la surcouche masque une BOÎTE, pas une bande', () => {
  it('une case sous le panneau bas-GAUCHE n’est pas "vue" : elle est recadrée AU-DESSUS de lui', () => {
    const box: ScrollBox = { left: 40, right: 96, top: 420, bottom: 476 }; // pile sous le panneau
    const next = centerScrollForClear(box, port(), [panneauBasGauche])!;
    expect(next).not.toBeNull();
    expect(box.bottom - next.top).toBeLessThanOrEqual(panneauBasGauche.top + 0.01);
  });

  it('la MÊME case, à la MÊME hauteur mais à DROITE, est cliquable : aucun recadrage (axe X)', () => {
    const box: ScrollBox = { left: 800, right: 856, top: 420, bottom: 476 };
    expect(centerScrollForClear(box, port(), [panneauBasGauche])).toBeNull();
    // Contre-épreuve appariée : le modèle « bande pleine largeur » la recadrait pour rien.
    expect(centerScrollFor(box, port(), 0, port().clientHeight - panneauBasGauche.top)).not.toBeNull();
  });

  it('une case sous la barre d’étages haut-GAUCHE est dégagée SOUS elle ; la même à droite ne bouge pas', () => {
    // Fenêtre défilée en plein contenu : la case affleure le haut du champ, donc sous la barre.
    const vue = port({ scrollTop: 1000 });
    const sousLaBarre: ScrollBox = { left: 40, right: 96, top: 1020, bottom: 1050 };
    const next = centerScrollForClear(sousLaBarre, vue, [barreHautGauche])!;
    expect(next).not.toBeNull();
    expect(sousLaBarre.top - next.top).toBeGreaterThanOrEqual(barreHautGauche.bottom - 0.01);

    const aDroite: ScrollBox = { left: 700, right: 756, top: 1020, bottom: 1050 };
    expect(centerScrollForClear(aDroite, vue, [barreHautGauche])).toBeNull();
  });

  it('une case hors du champ reste amenée au centre, surcouches ou pas', () => {
    const box: ScrollBox = { left: 100, right: 200, top: 1500, bottom: 1560 };
    expect(centerScrollForClear(box, port(), [panneauBasGauche, barreHautGauche])).not.toBeNull();
  });

  it('need="reachable" : une case seulement MORDUE par la surcouche ne bouge pas ; entièrement avalée, si', () => {
    const mordue: ScrollBox = { left: 200, right: 300, top: 420, bottom: 476 }; // dépasse à droite du panneau
    expect(centerScrollForClear(mordue, port(), [panneauBasGauche], 'reachable')).toBeNull();
    // Contre-épreuve appariée : en régime "whole", cette même case EST recadrée.
    expect(centerScrollForClear(mordue, port(), [panneauBasGauche], 'whole')).not.toBeNull();

    const avalee: ScrollBox = { left: 40, right: 96, top: 420, bottom: 476 };
    expect(centerScrollForClear(avalee, port(), [panneauBasGauche], 'reachable')).not.toBeNull();
  });

  it('need="reachable" : une case entièrement HORS du champ est ramenée (inatteignable aussi)', () => {
    const box: ScrollBox = { left: 100, right: 200, top: 1500, bottom: 1560 };
    expect(centerScrollForClear(box, port(), [], 'reachable')).not.toBeNull();
  });
});

// ── CÂBLAGE : refs du hook → boîtes mesurées → défilement réel du conteneur ────────────────────
// Le contexte n'est pas forgé : on branche `bottomOverlayRef`/`topOverlayRef` comme l'éditeur le fait
// (`panelRef` de TraceLayerPanel, `ref` de `.ed-level-bar`) et on mesure `wrap.scrollTop`.

/** Monte le hook et rend son retour — l'éditeur s'en sert exactement comme ça. */
function mountView() {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root: Root = createRoot(container);
  let api: ReturnType<typeof useEditorView> = null as never;
  function Probe() {
    api = useEditorView();
    return null;
  }
  return {
    mount: () => act(() => root.render(createElement(Probe))),
    api: () => api,
    teardown: async () => {
      const wrap = api.wrapRef.current;
      await act(async () => root.unmount());
      wrap?.remove();
      container.remove();
    },
  };
}

/** Conteneur défilable + SVG bouchonnés : jsdom ne calcule ni layout ni `getBoundingClientRect`. */
function fakeCanvas(stage: { w: number; h: number }, visible: { w: number; h: number }) {
  const wrap = document.createElement('main');
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg') as SVGSVGElement;
  wrap.appendChild(svg);
  document.body.appendChild(wrap);
  Object.defineProperties(wrap, {
    clientWidth: { value: visible.w },
    clientHeight: { value: visible.h },
    scrollWidth: { value: stage.w },
    scrollHeight: { value: stage.h },
  });
  wrap.getBoundingClientRect = () =>
    ({
      width: visible.w, height: visible.h, top: 0, left: 0, right: visible.w, bottom: visible.h,
      x: 0, y: 0, toJSON() {},
    }) as DOMRect;
  // Le SVG occupe TOUT le contenu défilable, ancré en haut à gauche : `left/top` suivent le défilement.
  svg.getBoundingClientRect = () =>
    ({
      width: stage.w, height: stage.h,
      left: -wrap.scrollLeft, top: -wrap.scrollTop,
      right: stage.w - wrap.scrollLeft, bottom: stage.h - wrap.scrollTop,
      x: -wrap.scrollLeft, y: -wrap.scrollTop, toJSON() {},
    }) as DOMRect;
  return { wrap, svg };
}

/** Une surcouche à la géométrie imposée (panneau de calque, barre d'étages — bouchonnés pareil). */
function fakeOverlay(box: ScrollBox) {
  const el = document.createElement('div');
  el.getBoundingClientRect = () =>
    ({
      width: box.right - box.left, height: box.bottom - box.top,
      left: box.left, right: box.right, top: box.top, bottom: box.bottom,
      x: box.left, y: box.top, toJSON() {},
    }) as DOMRect;
  return el;
}

describe('useEditorView — CÂBLAGE des surcouches sur le cadrage', () => {
  const dims: Dims = { w: 32, h: 38, rot: 0, view: 'top' };
  const VUE = { w: 900, h: 500 };
  const PANNEAU = { left: 14, right: 234, top: VUE.h - 120, bottom: VUE.h - 14 };
  const BARRE = { left: 14, right: 314, top: 10, bottom: 54 };

  /** Hook monté + canevas bouchonné, refs branchées comme `EditorCanvas` le fait. */
  async function setup() {
    const h = mountView();
    await h.mount();
    const stage = stageSize(dims);
    const { wrap, svg } = fakeCanvas(stage, VUE);
    (h.api().wrapRef as { current: HTMLElement | null }).current = wrap;
    (h.api().canvasRef as { current: SVGSVGElement | null }).current = svg;
    h.api().stageRef.current = stage;
    return { h, wrap };
  }

  /** Boîte d'une case en pixels de CONTENU (repère du conteneur défilable). */
  function caseBox(x: number, y: number) {
    const c = diamondCorners(x, y, dims, 0);
    const xs = [c.top[0], c.right[0], c.bot[0], c.left[0]];
    const ys = [c.top[1], c.right[1], c.bot[1], c.left[1]];
    return { left: Math.min(...xs), right: Math.max(...xs), top: Math.min(...ys), bottom: Math.max(...ys) };
  }

  it('le panneau de calque branché par `bottomOverlayRef` DÉGAGE la case qu’il recouvre', async () => {
    const { h, wrap } = await setup();
    // Case à GAUCHE, posée 20px au-dessus du bas de la fenêtre : dans le champ, mais sous le panneau.
    const b = caseBox(1, 20);
    wrap.scrollTop = b.bottom - (VUE.h - 20);
    wrap.scrollLeft = 0;
    const pose = wrap.scrollTop;

    // Sans panneau branché : rien ne bouge (la case est dans le champ).
    await act(async () => h.api().scrollTilesIntoView([{ x: 1, y: 20, z: 0 }], dims));
    expect(wrap.scrollTop).toBe(pose);

    // Panneau branché : sa BOÎTE mesurée sort la case de dessous.
    h.api().bottomOverlayRef.current = fakeOverlay(PANNEAU);
    await act(async () => h.api().scrollTilesIntoView([{ x: 1, y: 20, z: 0 }], dims));
    expect(b.bottom - wrap.scrollTop).toBeLessThanOrEqual(PANNEAU.top + 0.01);

    await h.teardown();
  });

  it('la MÊME hauteur, une case à DROITE du panneau : la vue ne bouge PAS (axe X câblé)', async () => {
    const { h, wrap } = await setup();
    const b = caseBox(14, 20); // bien à droite des 234px du panneau
    expect(b.left).toBeGreaterThan(PANNEAU.right); // la case est réellement hors de son emprise
    wrap.scrollTop = b.bottom - (VUE.h - 20);
    wrap.scrollLeft = 0;
    const pose = wrap.scrollTop;

    h.api().bottomOverlayRef.current = fakeOverlay(PANNEAU);
    await act(async () => h.api().scrollTilesIntoView([{ x: 14, y: 20, z: 0 }], dims));
    expect(wrap.scrollTop).toBe(pose);
    expect(wrap.scrollLeft).toBe(0);

    await h.teardown();
  });

  it('la barre d’étages branchée par `topOverlayRef` dégage sous elle, et laisse la droite tranquille', async () => {
    const { h, wrap } = await setup();
    h.api().topOverlayRef.current = fakeOverlay(BARRE);

    const sous = caseBox(1, 20);
    wrap.scrollTop = sous.top - 20; // case 20px sous le bord haut → sous la barre
    await act(async () => h.api().scrollTilesIntoView([{ x: 1, y: 20, z: 0 }], dims));
    expect(sous.top - wrap.scrollTop).toBeGreaterThanOrEqual(BARRE.bottom - 0.01);

    const droite = caseBox(14, 20);
    expect(droite.left).toBeGreaterThan(BARRE.right);
    wrap.scrollTop = droite.top - 20;
    const pose = wrap.scrollTop;
    await act(async () => h.api().scrollTilesIntoView([{ x: 14, y: 20, z: 0 }], dims));
    expect(wrap.scrollTop).toBe(pose);

    await h.teardown();
  });

  it('need="reachable" : une cible seulement MORDUE par le panneau ne déplace jamais la vue', async () => {
    const { h, wrap } = await setup();
    h.api().bottomOverlayRef.current = fakeOverlay(PANNEAU);
    // Deux cases contiguës : celle de gauche sous le panneau, celle de droite dégagée.
    const b = caseBox(4, 20);
    wrap.scrollTop = b.bottom - (VUE.h - 20);
    const pose = wrap.scrollTop;
    const tiles = [
      { x: 3, y: 20, z: 0 },
      { x: 4, y: 20, z: 0 },
    ];
    await act(async () => h.api().scrollTilesIntoView(tiles, dims, 'reachable'));
    expect(wrap.scrollTop).toBe(pose);
    // Contre-épreuve appariée : en régime "whole", cette même cible EST recadrée.
    await act(async () => h.api().scrollTilesIntoView(tiles, dims, 'whole'));
    expect(wrap.scrollTop).not.toBe(pose);

    await h.teardown();
  });
});

// Maillon amont de la chaîne : `panelRef` doit rendre la BOÎTE du panneau lui-même. Sans lui, le
// cadrage n'a aucune obstruction basse à éviter et la case fautive reste sous le panneau (clic mort).
describe('TraceLayerPanel — `panelRef` rend le panneau MESURABLE', () => {
  it('reçoit l’élément racine du panneau (celui que la CSS ancre en bas-gauche)', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    let recu: HTMLElement | null = null;
    const noop = () => {};
    await act(async () =>
      root.render(
        createElement(TraceLayerPanel, {
          hasLayer: false,
          visible: false,
          opacity: 0.6,
          calibStep: 'idle',
          position: 'above',
          allowRotation: false,
          contraste: false,
          layerZ: 0,
          expanded: true,
          onLoadFile: noop,
          onToggleVisible: noop,
          onOpacityChange: noop,
          onPositionChange: noop,
          onAllowRotationChange: noop,
          onContrasteChange: noop,
          onToggleExpanded: noop,
          onStartCalibration: noop,
          onCancelCalibration: noop,
          onRemove: noop,
          panelRef: (el) => {
            recu = el;
          },
        }),
      ),
    );
    const panneau: HTMLElement | null = recu;
    expect(panneau).not.toBeNull();
    expect(panneau!.classList.contains('trace-layer-panel')).toBe(true);
    expect(panneau!.getBoundingClientRect).toBeTypeOf('function');

    await act(async () => root.unmount());
    container.remove();
  });
});
