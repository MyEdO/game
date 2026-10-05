// @vitest-environment jsdom
import { describe, it, expect, beforeAll } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { centerScrollFor, useEditorView } from './useEditorView';
import { diamondCorners, stageSize, type Dims } from '../../geometry/iso';

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

/** Fenêtre de défilement d'essai : 500×500 visibles sur un contenu de 1300×1300. */
function port(scrollLeft = 0, scrollTop = 0) {
  return { scrollLeft, scrollTop, clientWidth: 500, clientHeight: 500, scrollWidth: 1300, scrollHeight: 1300 };
}

describe('centerScrollFor — amener au centre ce qui manque au champ', () => {
  it('une boîte HORS champ est centrée dans la fenêtre', () => {
    const next = centerScrollFor({ left: 800, right: 900, top: 850, bottom: 950 }, port());
    expect(next).toEqual({ left: 850 - 250, top: 900 - 250 });
  });

  it('une boîte DÉJÀ entièrement visible ne déplace rien (contre-épreuve appariée)', () => {
    expect(centerScrollFor({ left: 100, right: 200, top: 120, bottom: 220 }, port())).toBeNull();
    // Et la même boîte, une fois la fenêtre défilée ailleurs, redevient à recentrer.
    expect(centerScrollFor({ left: 100, right: 200, top: 120, bottom: 220 }, port(0, 700))).not.toBeNull();
  });

  it('le défilement demandé reste borné au contenu (jamais négatif, jamais au-delà)', () => {
    const haut = centerScrollFor({ left: 0, right: 40, top: 0, bottom: 40 }, port(600, 600));
    expect(haut).toEqual({ left: 0, top: 0 });
    const bas = centerScrollFor({ left: 1260, right: 1300, top: 1260, bottom: 1300 }, port());
    expect(bas).toEqual({ left: 800, top: 800 });
  });

  it('une boîte cachée sous une SURCOUCHE flottante n’est pas « vue » : elle est amenée SOUS la bande occupée', () => {
    const box = { left: 100, right: 200, top: 620, bottom: 660 };
    // Sans surcouche, cette boîte tient dans le client rect : rien ne bouge.
    expect(centerScrollFor(box, port(0, 600))).toBeNull();
    // Avec 80 px de bande haute occupée (barre de couche), elle est sous la barre → recadrage.
    const next = centerScrollFor(box, port(0, 600), 80)!;
    expect(next).not.toBeNull();
    expect(box.top - next.top).toBeGreaterThanOrEqual(80); // dégagée de la barre, pas seulement au centre
    expect(box.bottom - next.top).toBeLessThanOrEqual(500); // et toujours dans la fenêtre
  });
});

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
    mount: () => act(() => root.render(<Probe />)),
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
    ({ width: visible.w, height: visible.h, top: 0, left: 0, right: visible.w, bottom: visible.h, x: 0, y: 0, toJSON() {} }) as DOMRect;
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

/** Branche les refs du hook sur ces éléments, comme `EditorCanvas` le fait par ses attributs `ref`. */
function attach(api: ReturnType<typeof useEditorView>, wrap: HTMLElement, svg: SVGSVGElement) {
  (api.wrapRef as { current: HTMLElement | null }).current = wrap;
  (api.canvasRef as { current: SVGSVGElement | null }).current = svg;
}

describe('useEditorView — le défaut visé est AMENÉ dans le champ', () => {
  const dims: Dims = { w: 32, h: 38, rot: 0, view: 'top' };

  it('des cases hors champ font défiler la carte ; les mêmes, une fois à l’écran, ne la bougent plus', async () => {
    const h = mountView();
    await h.mount();
    const stage = stageSize(dims);
    const { wrap, svg } = fakeCanvas(stage, { w: 900, h: 500 });
    attach(h.api(), wrap, svg);
    h.api().stageRef.current = stage;

    const bas = [{ x: 20, y: 34, z: 0 }, { x: 21, y: 35, z: 0 }];
    expect(wrap.scrollTop).toBe(0);
    await act(async () => h.api().scrollTilesIntoView(bas, dims));
    const apres = wrap.scrollTop;
    expect(apres).toBeGreaterThan(0);

    // Contre-épreuve : les mêmes cases sont maintenant dans le champ → aucun défilement de plus.
    await act(async () => h.api().scrollTilesIntoView(bas, dims));
    expect(wrap.scrollTop).toBe(apres);

    await h.teardown();
  });

  it('des cases déjà visibles au chargement (haut de carte) laissent la vue intacte', async () => {
    const h = mountView();
    await h.mount();
    const stage = stageSize(dims);
    const { wrap, svg } = fakeCanvas(stage, { w: 900, h: 500 });
    attach(h.api(), wrap, svg);
    h.api().stageRef.current = stage;

    await act(async () => h.api().scrollTilesIntoView([{ x: 1, y: 1, z: 0 }], dims));
    expect(wrap.scrollTop).toBe(0);
    expect(wrap.scrollLeft).toBe(0);

    await h.teardown();
  });

  it('la barre de couche FLOTTANTE est prise sur sa géométrie réelle : les cases qu’elle recouvre sont dégagées', async () => {
    const h = mountView();
    await h.mount();
    const stage = stageSize(dims);
    const { wrap, svg } = fakeCanvas(stage, { w: 900, h: 500 });
    attach(h.api(), wrap, svg);
    h.api().stageRef.current = stage;

    // Case posée 10 px SOUS le bord haut du conteneur, et à GAUCHE : sous l'emprise RÉELLE de la barre
    // (chip ancré haut-gauche, 200 px de large ici) — une case de droite, elle, resterait cliquable.
    const cible = [{ x: 1, y: 20, z: 0 }];
    const c = diamondCorners(1, 20, dims, 0);
    const hautCase = Math.min(c.top[1], c.right[1], c.bot[1], c.left[1]);
    const marge = 10;
    wrap.scrollTop = hautCase - marge;

    // Sans surcouche déclarée, le cadrage la tient pour vue — rien ne bouge.
    await act(async () => h.api().scrollTilesIntoView(cible, dims));
    expect(wrap.scrollTop).toBe(hautCase - marge);

    // La barre existe : sa BOÎTE MESURÉE (200×44 ici) devient l'obstruction du cadrage.
    const barre = document.createElement('div');
    const HAUTEUR_BARRE = 44;
    barre.getBoundingClientRect = () =>
      ({ width: 200, height: HAUTEUR_BARRE, top: 0, left: 0, right: 200, bottom: HAUTEUR_BARRE, x: 0, y: 0, toJSON() {} }) as DOMRect;
    h.api().topOverlayRef.current = barre;
    await act(async () => h.api().scrollTilesIntoView(cible, dims));
    expect(hautCase - wrap.scrollTop).toBeGreaterThanOrEqual(HAUTEUR_BARRE);

    await h.teardown();
  });

  it('« Zoom arrière » a un effet dès l’état initial : le facteur de zoom DIMINUE', async () => {
    const h = mountView();
    await h.mount();
    h.api().stageRef.current = stageSize(dims);
    expect(h.api().view.zoom).toBe(1);
    await act(async () => h.api().zoomAt(1 / 1.2));
    expect(h.api().view.zoom).toBeLessThan(1);
    await h.teardown();
  });
});
