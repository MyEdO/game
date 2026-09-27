// @vitest-environment jsdom
import { describe, it, expect, beforeAll } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { EditorCanvas } from './EditorCanvas';
import { emptyScene, type Scene } from '../../state/scene';
import { sceneZoneTiles } from '../../state/zones';
import { diamondPath, tileCenter } from '../../geometry/iso';
import { DEFAULT_LAYERS } from './editorState';
import type { LowerLayerMode } from './lowerLayerGabarit';
import type { PlanDefectAt } from '../../state/planDefects';

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

/** Événement pointeur minimal — jsdom n'a pas `PointerEvent` complet ; un `MouseEvent` typé
 *  `pointerdown`/`pointermove`/`pointerup` porte les mêmes propriétés lues par les handlers
 *  (`clientX`/`clientY`/`button`), et React délègue par NOM d'événement (pas par constructeur). */
function pointerEvent(type: string, opts: { clientX?: number; clientY?: number; button?: number } = {}) {
  return new MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    clientX: opts.clientX ?? 0,
    clientY: opts.clientY ?? 0,
    button: opts.button ?? 0,
  });
}

/** Props minimales requises par `EditorCanvas`, hors `scene`/`view` (fournies par le test). */
function baseProps() {
  return {
    setScene: () => {},
    setSceneNoHistory: () => {},
    pushSnapshot: () => {},
    tool: { mode: 'select' as const },
    brush: 1,
    terrainRect: false,
    encTarget: '',
    setEncTarget: () => {},
    encRef: '',
    layers: DEFAULT_LAYERS,
    sel: null,
    planFocus: null as PlanDefectAt | null,
    onSelect: () => {},
    onHover: () => {},
    stairRun: [],
    onStairTrace: () => {},
    currentLayer: 0,
    architectureMode: false,
    architectureBodyId: null,
    architectureZ: null,
    architectureAction: 'select' as const,
    onArchitectureActionComplete: () => {},
    traceLayer: null,
    lowerLayerOpacity: 0.22,
    lowerLayerMode: 'gabarit' as const,
    traceCalibStep: 'idle' as const,
    onTraceCalibClick: () => {},
  };
}

describe('EditorCanvas — panoramique (clic-milieu / Espace + glisser)', () => {
  it(
    "un pointerMove dont le setView différé s'exécute APRÈS la remise à null du panRef (React 18 " +
      "peut rejouer l'updater APRÈS qu'un pointerUp natif ait déjà tourné) ne doit JAMAIS déréférencer `null`",
    async () => {
      let capturedUpdater: ((v: { zoom: number; x: number; y: number }) => unknown) | null = null;
      const view = {
        rot: 0 as const,
        setRot: () => {},
        viewMode: 'top' as const,
        setViewMode: () => {},
        view: { zoom: 1, x: 0, y: 0 },
        // Simule le flush DIFFÉRÉ de React 18 : capture l'updater sans l'exécuter tout de suite.
        setView: (updater: unknown) => {
          capturedUpdater = typeof updater === 'function' ? (updater as typeof capturedUpdater) : null;
        },
        zoomAt: () => {},
        spaceRef: { current: false },
        panRef: { current: null as null | { sx: number; sy: number; vx: number; vy: number } },
        canvasRef: { current: null as SVGSVGElement | null },
        stageRef: { current: { w: 100, h: 100 } },
      };

      const container = document.createElement('div');
      document.body.appendChild(container);
      const root: Root = createRoot(container);
      await act(async () => {
        root.render(<EditorCanvas scene={emptyScene()} view={view as never} {...baseProps()} />);
      });

      const svg = container.querySelector('svg.editor-iso') as SVGSVGElement;
      expect(svg).toBeTruthy();
      // jsdom n'implémente ni CTM ni `getBoundingClientRect` réel — bouchons minimaux pour le picking.
      svg.getBoundingClientRect = () =>
        ({ width: 100, height: 100, top: 0, left: 0, right: 100, bottom: 100, x: 0, y: 0, toJSON() {} }) as DOMRect;
      (svg as unknown as { getScreenCTM: () => unknown }).getScreenCTM = () => ({ inverse: () => ({}) });
      (svg as unknown as { createSVGPoint: () => unknown }).createSVGPoint = () => ({
        x: 0,
        y: 0,
        matrixTransform: () => ({ x: 0, y: 0 }),
      });

      // 1. Clic-milieu : arme le pan (panRef.current renseigné par `pointerDown`).
      await act(async () => {
        svg.dispatchEvent(pointerEvent('pointerdown', { clientX: 10, clientY: 10, button: 1 }));
      });
      expect(view.panRef.current).toEqual({ sx: 10, sy: 10, vx: 0, vy: 0 });

      // 2. Glisser : `pointerMove` PROGRAMME un `setView` (updater capturé, exécution DIFFÉRÉE).
      await act(async () => {
        svg.dispatchEvent(pointerEvent('pointermove', { clientX: 20, clientY: 20 }));
      });
      expect(capturedUpdater).toBeTruthy();

      // 3. Relâcher : `pointerUp` remet `panRef.current` à `null` — AVANT que l'updater capturé ne
      //    s'exécute (la course réelle du crash : #1 diagnostiqué dans le brief).
      await act(async () => {
        svg.dispatchEvent(pointerEvent('pointerup', { clientX: 20, clientY: 20 }));
      });
      expect(view.panRef.current).toBeNull();

      // 4. React rejoue enfin l'updater : ne doit JAMAIS planter sur `panRef.current!.vx` (null).
      expect(() => capturedUpdater!({ zoom: 1, x: 0, y: 0 })).not.toThrow();

      await act(async () => {
        root.unmount();
      });
      container.remove();
    },
  );
});

describe('EditorCanvas — pelure d’oignon des TOITS (#835 FU-2)', () => {
  // Les sondes de ce bloc lisent ce que le SVG d'authoring émet ENCORE : les nappes de toit en PLAN
  // étiqueté (`roofSvg({ plan: true })`), une vue d'auteur que le canevas ne cuit pas. La matière du
  // monde (sols, murs, corps) est peinte par le canevas volumique, et sa pelure d'oignon est mesurée
  // par `editeur-monde-volumique.test.tsx`.

  /** Emprise BÂTIE de l'étage — le beffroi et rien d'autre : un étage se pose sur du plancher, le
   *  reste de la couche est du vide au-dessus du rez. */
  const BEFFROI = { x: 6, y: 6, w: 3, h: 3 };

  /** Deux masses superposées : une au rez (`z:0`), une à l'étage (`z:1`). Le libellé du plan étiqueté
   *  sert de sonde — il porte le nom du corps, donc l'identité de la masse rendue. */
  function sceneWithTwoRoofs() {
    const scene = emptyScene(12, 12);
    const etage: string[] = new Array(144).fill('vide');
    for (let y = BEFFROI.y; y < BEFFROI.y + BEFFROI.h; y++)
      for (let x = BEFFROI.x; x < BEFFROI.x + BEFFROI.w; x++) etage[y * 12 + x] = 'plancher';
    scene.layers = [
      { z: 0, tiles: new Array(144).fill('herbe') },
      { z: 1, tiles: etage },
    ];
    scene.architecture = [
      {
        id: 'appentis',
        label: 'Appentis',
        style: 'maison',
        storeys: [],
        facades: [],
        masses: [{ id: 'toit-rez', z: 0, footprint: [{ x: 1, y: 1, w: 3, h: 3 }], levels: 1, profile: 'hip', pitchDeg: 28, material: 'tuile' }],
      },
      {
        id: 'tour',
        label: 'Beffroi',
        style: 'maison',
        storeys: [],
        facades: [],
        masses: [{ id: 'toit-etage', z: 1, footprint: [BEFFROI], levels: 2, profile: 'hip', pitchDeg: 28, material: 'tuile' }],
      },
    ];
    return scene;
  }

  const isoView = () => ({
    rot: 0 as const,
    setRot: () => {},
    viewMode: 'iso' as const,
    setViewMode: () => {},
    view: { zoom: 1, x: 0, y: 0 },
    setView: () => {},
    zoomAt: () => {},
    spaceRef: { current: false },
    panRef: { current: null },
    canvasRef: { current: null as SVGSVGElement | null },
    stageRef: { current: { w: 400, h: 400 } },
  });

  async function renderAt(currentLayer: number, lowerLayerMode: LowerLayerMode = 'gabarit') {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root: Root = createRoot(container);
    await act(async () => {
      root.render(
        <EditorCanvas
          scene={sceneWithTwoRoofs()}
          view={isoView() as never}
          {...baseProps()}
          currentLayer={currentLayer}
          lowerLayerMode={lowerLayerMode}
        />,
      );
    });
    const html = container.innerHTML;
    // Groupes portant une opacité PROPRE = les nappes atténuées de la couche active (le gabarit du
    // dessous passe, lui, par un filtre CSS). Une masse rend plusieurs éléments de nappe : on relève
    // les libellés DISTINCTS, plus la liste des opacités appliquées.
    const groupes = Array.from(container.querySelectorAll('g[opacity]'));
    const attenues = [...new Set(groupes.map((g) => g.querySelector('text')?.textContent ?? ''))];
    const attenuation = groupes.map((g) => Number(g.getAttribute('opacity')));
    await act(async () => root.unmount());
    container.remove();
    return { html, attenues, attenuation };
  }

  it('à la couche ACTIVE : la nappe est ÉMISE mais ATTÉNUÉE — le calque « Toits » garde son sens au dernier étage', async () => {
    const { html, attenues, attenuation } = await renderAt(0);
    expect(html).toContain('Appentis'); // toit de plain-pied : au-dessus de l'auteur, donc discret
    expect(attenues).toEqual(['Appentis']);
    expect(Math.max(...attenuation)).toBeLessThan(0.5); // on lit le plancher et les murs au travers
    expect(html).not.toContain('Beffroi'); // nappe d'un étage SUPÉRIEUR : jamais émise
  });

  it('contre-épreuve appariée : la MÊME masse du rez passe en gabarit VOILÉ (sans atténuation propre) quand on édite l’étage', async () => {
    const { html, attenues } = await renderAt(1);
    expect(html).toContain('Appentis'); // seule la couche active a changé entre les deux épreuves
    expect(html).toContain('Beffroi'); // la nappe de l'étage édité est la nappe atténuée
    expect(attenues).toEqual(['Beffroi']);
    // Le voile de couche inférieure est un FILTRE CSS, appliqué au groupe du toit voilé.
    expect(html).toMatch(/filter[^;"]*(saturate|opacity|grayscale)/i);
  });

  it('troisième couche active : les DEUX nappes sont sous elle — gabarit voilé, aucune atténuation', async () => {
    const { html, attenues } = await renderAt(2);
    expect(html).toContain('Appentis');
    expect(html).toContain('Beffroi');
    expect(attenues).toEqual([]); // l'atténuation est bien causée par « z === couche active », rien d'autre
  });

  it('l’ÉDITEUR fournit le libellé : chaque nappe porte, en texte, le nom de son corps', async () => {
    const { html } = await renderAt(2);
    expect(html).toContain('>Appentis</text>');
    expect(html).toContain('>Beffroi</text>');
  });

  describe('mode ISOLÉE : seule la couche active est dessinée', () => {
    it('à l’étage, la nappe de toit du rez n’est plus émise du tout', async () => {
      const gabarit = await renderAt(1, 'gabarit');
      const isolee = await renderAt(1, 'isolee');

      // Sondes BOOLÉENNES : un échec doit nommer la régression, pas déverser le SVG entier.
      expect(isolee.html.includes('Appentis')).toBe(false); // le toit du rez a disparu, pas seulement pâli
      expect(isolee.html.includes('Beffroi')).toBe(true); // la couche active, elle, reste dessinée
      expect(/filter[^;"]*(saturate|opacity|grayscale)/i.test(isolee.html)).toBe(false); // aucun groupe voilé
      expect(gabarit.html).toContain('Appentis');
    });
  });
});

describe('EditorCanvas — mise en évidence d’un défaut de plan (`planFocus`)', () => {
  const view = () => ({
    rot: 0 as const,
    setRot: () => {},
    viewMode: 'iso' as const,
    setViewMode: () => {},
    view: { zoom: 1, x: 0, y: 0 },
    setView: () => {},
    zoomAt: () => {},
    spaceRef: { current: false },
    panRef: { current: null },
    canvasRef: { current: null as SVGSVGElement | null },
    stageRef: { current: { w: 400, h: 400 } },
  });

  /** Rend le canevas sur une scène à deux étages et rapporte l'annotation posée : losanges allumés,
   *  segments d'arête, et la nature du défaut portée par le groupe. */
  async function renderFocus(planFocus: PlanDefectAt | null, currentLayer = 0) {
    const scene = emptyScene(10, 10);
    scene.layers = [
      { z: 0, tiles: new Array(100).fill('herbe') },
      { z: 1, tiles: new Array(100).fill('plancher') },
    ];
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root: Root = createRoot(container);
    await act(async () => {
      root.render(
        <EditorCanvas scene={scene} view={view() as never} {...baseProps()} planFocus={planFocus} currentLayer={currentLayer} />,
      );
    });
    const group = container.querySelector('[data-plan-focus]');
    const out = {
      kind: group?.getAttribute('data-plan-focus') ?? null,
      diamonds: group?.querySelectorAll('path').length ?? 0,
      edges: group?.querySelectorAll('line').length ?? 0,
    };
    await act(async () => root.unmount());
    container.remove();
    return out;
  }

  it('un défaut de ZONE allume TOUTES ses cases fautives, pas une seule', async () => {
    const tiles = [{ x: 2, y: 2, z: 0 }, { x: 3, y: 2, z: 0 }, { x: 4, y: 2, z: 0 }, { x: 4, y: 3, z: 0 }];
    const { kind, diamonds } = await renderFocus({ kind: 'zone', zoneId: 'galerie', z: 0, tiles });
    expect(kind).toBe('zone');
    expect(diamonds).toBe(tiles.length);
  });

  it('un défaut d’ARÊTE dessine sa case et son segment, à la couche du défaut', async () => {
    const at: PlanDefectAt = { kind: 'edge', x: 5, y: 4, side: 'N', z: 1 };
    const surLaCouche = await renderFocus(at, 1);
    expect(surLaCouche.diamonds).toBe(1);
    expect(surLaCouche.edges).toBe(1);
    // Même défaut, couche active INFÉRIEURE : l'étage n'est pas dessiné, son annotation non plus.
    const depuisLeRez = await renderFocus(at, 0);
    expect(depuisLeRez.kind).toBeNull();
  });

  it('sans défaut mis en évidence, aucune annotation n’est posée', async () => {
    const { kind, diamonds } = await renderFocus(null);
    expect(kind).toBeNull();
    expect(diamonds).toBe(0);
  });
});

describe('EditorCanvas — pinceau d’EMPRISE de zone (outil `zoneTiles`)', () => {
  const topView = () => ({
    rot: 0 as const,
    setRot: () => {},
    viewMode: 'top' as const,
    setViewMode: () => {},
    view: { zoom: 1, x: 0, y: 0 },
    setView: () => {},
    zoomAt: () => {},
    spaceRef: { current: false },
    panRef: { current: null },
    canvasRef: { current: null as SVGSVGElement | null },
    stageRef: { current: { w: 400, h: 400 } },
  });

  /** Scène à DEUX zones : « galerie » (3×3 pleine) et « cave », témoin qui ne doit jamais bouger. */
  function sceneDeuxZones(): Scene {
    return {
      ...emptyScene(12, 12),
      effectZones: [
        { id: 'galerie', label: 'Galerie', area: { kind: 'rect', x: 1, y: 1, w: 3, h: 3 } },
        { id: 'cave', label: 'Cave', area: { kind: 'rect', x: 8, y: 8, w: 2, h: 2 } },
      ],
    };
  }

  /** Monte le canevas armé du pinceau, et rend un peintre qui vise une CASE (centre iso → pointeur).
   *  `latest` suit la scène écrite par le canevas, comme l'historique de l'éditeur le ferait. */
  async function armed(paint: 'add' | 'remove') {
    let latest = sceneDeuxZones();
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root: Root = createRoot(container);
    const view = topView();
    const render = () =>
      root.render(
        <EditorCanvas
          scene={latest}
          view={view as never}
          {...baseProps()}
          tool={{ mode: 'zoneTiles', zoneId: 'galerie', paint }}
          setScene={(s) => { latest = s; render(); }}
          setSceneNoHistory={(s) => { latest = s; render(); }}
        />,
      );
    await act(async () => render());

    const svg = container.querySelector('svg.editor-iso') as SVGSVGElement;
    const point = { x: 0, y: 0, matrixTransform: () => ({ x: point.x, y: point.y }) };
    (svg as unknown as { getScreenCTM: () => unknown }).getScreenCTM = () => ({ inverse: () => ({}) });
    (svg as unknown as { createSVGPoint: () => unknown }).createSVGPoint = () => point;

    const dims = { ...latest.dimensions, rot: 0 as const, view: 'top' as const };
    const at = (type: string, x: number, y: number) => {
      const { cx, cy } = tileCenter(x, y, dims);
      return act(async () => {
        svg.dispatchEvent(pointerEvent(type, { clientX: cx, clientY: cy }));
      });
    };
    return {
      down: (x: number, y: number) => at('pointerdown', x, y),
      move: (x: number, y: number) => at('pointermove', x, y),
      up: (x: number, y: number) => at('pointerup', x, y),
      tilesOf: (id: string) =>
        sceneZoneTiles(latest.effectZones!.find((z) => z.id === id)!).map((t) => `${t.x},${t.y}`).sort(),
      end: async () => {
        await act(async () => root.unmount());
        container.remove();
      },
    };
  }

  it('en `remove`, la case peinte SORT de la zone ; la seconde zone reste intacte', async () => {
    const h = await armed('remove');
    expect(h.tilesOf('galerie')).toHaveLength(9);

    await h.down(2, 2);
    expect(h.tilesOf('galerie')).not.toContain('2,2');
    expect(h.tilesOf('galerie')).toHaveLength(8);
    expect(h.tilesOf('cave')).toEqual(['8,8', '8,9', '9,8', '9,9']);

    await h.end();
  });

  it('en `add`, le GLISSÉ qui repasse sur une case peinte la LAISSE dedans (pinceau, pas bascule)', async () => {
    const h = await armed('add');
    // (4,1) est hors de la boîte 3×3 : le pinceau l'ajoute et l'aire s'étend pour la porter.
    await h.down(4, 1);
    expect(h.tilesOf('galerie')).toContain('4,1');
    const apresPose = h.tilesOf('galerie').length;

    await h.move(4, 1); // le glissé réémet la MÊME case (un doigt qui tremble)
    await h.move(4, 1);
    expect(h.tilesOf('galerie')).toContain('4,1');
    expect(h.tilesOf('galerie')).toHaveLength(apresPose);

    await h.end();
  });

  it('un CLIC SIMPLE (appui + relâché, sans le moindre déplacement) peint la case visée — en `remove`', async () => {
    const h = await armed('remove');
    await h.down(2, 2);
    await h.up(2, 2); // aucun `pointermove` entre les deux : le geste de l'auteur qui vise UNE case
    expect(h.tilesOf('galerie')).not.toContain('2,2');
    expect(h.tilesOf('galerie')).toHaveLength(8);
    await h.end();
  });

  it('le MÊME clic simple peint en `add` : la classe entière répond à l’appui, pas seulement au tracé', async () => {
    const h = await armed('add');
    await h.down(4, 1); // hors de la boîte 3×3 : l'aire s'étend pour porter la case
    await h.up(4, 1);
    expect(h.tilesOf('galerie')).toContain('4,1');
    await h.end();
  });

  it('CONTRE-ÉPREUVE : le GLISSÉ peint toute la traînée parcourue, pas la seule case d’appui', async () => {
    const h = await armed('remove');
    await h.down(1, 1);
    await h.move(2, 1);
    await h.move(3, 1);
    await h.up(3, 1);
    const restantes = h.tilesOf('galerie');
    expect(restantes).not.toContain('1,1');
    expect(restantes).not.toContain('2,1');
    expect(restantes).not.toContain('3,1');
    expect(restantes).toHaveLength(6);
    await h.end();
  });

  it('le glissé qui SORT du plateau n’écrit rien au-delà du bord (garde de bornes, appui comme tracé)', async () => {
    const h = await armed('add');
    await h.down(1, 1);
    await h.move(-1, 1); // le doigt déborde la carte
    await h.move(1, 1);
    await h.up(1, 1);
    expect(h.tilesOf('galerie').every((k) => !k.startsWith('-'))).toBe(true);
    await h.end();
  });
});

describe('EditorCanvas — une zone se dessine par ses CASES, jamais par son rectangle', () => {
  const topView = () => ({
    rot: 0 as const,
    setRot: () => {},
    viewMode: 'top' as const,
    setViewMode: () => {},
    view: { zoom: 1, x: 0, y: 0 },
    setView: () => {},
    zoomAt: () => {},
    spaceRef: { current: false },
    panRef: { current: null },
    canvasRef: { current: null as SVGSVGElement | null },
    stageRef: { current: { w: 400, h: 400 } },
  });

  /** Zone 3×3 (« galerie ») + une zone MÉCANIQUE (« brasier », porteuse d'`onCross`) de même taille :
   *  les deux familles rendent sur deux calques distincts et doivent suivre la MÊME vérité d'emprise. */
  function sceneDeuxFamilles(tiles?: { x: number; y: number }[]): Scene {
    return {
      ...emptyScene(12, 12),
      effectZones: [
        { id: 'galerie', label: 'Galerie', area: { kind: 'rect', x: 1, y: 1, w: 3, h: 3 }, ...(tiles ? { tiles } : {}) },
        {
          id: 'brasier',
          label: 'Brasier',
          area: { kind: 'rect', x: 6, y: 6, w: 3, h: 3 },
          onCross: [{ op: 'wounds', amount: { kind: 'flat', value: 1 } }],
          ...(tiles ? { tiles: tiles.map((t) => ({ x: t.x + 5, y: t.y + 5 })) } : {}),
        },
      ],
    } as Scene;
  }

  /** Le dessin RÉEL posé pour la zone `id` : nombre de losanges du remplissage et nombre de segments
   *  du contour, LUS dans la géométrie SVG (`d`) — jamais un compte annoncé par le composant. */
  function drawn(container: HTMLElement, id: string) {
    const g = container.querySelector(`[data-zone="${id}"]`);
    const paths = g ? Array.from(g.querySelectorAll('path')) : [];
    const subPaths = (i: number) => (paths[i]?.getAttribute('d')?.match(/M/g) ?? []).length;
    return { present: !!g, cases: subPaths(0), segments: subPaths(1) };
  }

  /** Monte le canevas armé du pinceau d'emprise sur « galerie ». */
  async function mounted(scene: Scene, paint: 'add' | 'remove' = 'remove') {
    let latest = scene;
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root: Root = createRoot(container);
    const view = topView();
    const render = () =>
      root.render(
        <EditorCanvas
          scene={latest}
          view={view as never}
          {...baseProps()}
          layers={DEFAULT_LAYERS}
          tool={{ mode: 'zoneTiles', zoneId: 'galerie', paint }}
          setScene={(s) => { latest = s; render(); }}
          setSceneNoHistory={(s) => { latest = s; render(); }}
        />,
      );
    await act(async () => render());

    const svg = container.querySelector('svg.editor-iso') as SVGSVGElement;
    const point = { x: 0, y: 0, matrixTransform: () => ({ x: point.x, y: point.y }) };
    (svg as unknown as { getScreenCTM: () => unknown }).getScreenCTM = () => ({ inverse: () => ({}) });
    (svg as unknown as { createSVGPoint: () => unknown }).createSVGPoint = () => point;
    const dims = { ...latest.dimensions, rot: 0 as const, view: 'top' as const };

    return {
      drawn: (id: string) => drawn(container, id),
      tilesOf: (id: string) => sceneZoneTiles(latest.effectZones!.find((z) => z.id === id)!).length,
      paint: (x: number, y: number) => {
        const { cx, cy } = tileCenter(x, y, dims);
        return act(async () => {
          svg.dispatchEvent(pointerEvent('pointerdown', { clientX: cx, clientY: cy }));
          svg.dispatchEvent(pointerEvent('pointerup', { clientX: cx, clientY: cy }));
        });
      },
      end: async () => {
        await act(async () => root.unmount());
        container.remove();
      },
    };
  }

  it('emprise PLEINE : le remplissage porte une case par case de la zone, et le contour fait le tour du carré', async () => {
    const h = await mounted(sceneDeuxFamilles());
    expect(h.drawn('galerie')).toEqual({ present: true, cases: 9, segments: 12 });
    expect(h.drawn('brasier')).toEqual({ present: true, cases: 9, segments: 12 });
    await h.end();
  });

  it('emprise ÉCHANCRÉE : la case retirée disparaît du remplissage et le contour fait le tour de l’encoche', async () => {
    // 3×3 amputée de (2,1), la case du MILIEU du bord haut : le cadre reste 3×3, la forme non.
    const carve = [
      { x: 1, y: 1 }, { x: 3, y: 1 },
      { x: 1, y: 2 }, { x: 2, y: 2 }, { x: 3, y: 2 },
      { x: 1, y: 3 }, { x: 2, y: 3 }, { x: 3, y: 3 },
    ];
    const h = await mounted(sceneDeuxFamilles(carve));
    // 8 cases dessinées, pas les 9 du rectangle englobant — et 14 segments de contour (12 pour le
    // cadre plein) : le trait entre bien DANS l'encoche au lieu d'en faire le tour par le cadre.
    expect(h.drawn('galerie')).toEqual({ present: true, cases: 8, segments: 14 });
    expect(h.drawn('brasier')).toEqual({ present: true, cases: 8, segments: 14 });
    await h.end();
  });

  it('RETOUR IMMÉDIAT : peindre « retirer » sur une case la fait disparaître du dessin dans le même geste', async () => {
    const h = await mounted(sceneDeuxFamilles(), 'remove');
    expect(h.drawn('galerie').cases).toBe(9);

    await h.paint(2, 2); // le centre du 3×3 : son retrait creuse un trou, le contour gagne 4 segments
    expect(h.tilesOf('galerie')).toBe(8);
    expect(h.drawn('galerie')).toEqual({ present: true, cases: 8, segments: 16 });

    await h.paint(1, 1);
    expect(h.drawn('galerie').cases).toBe(7);
    // Le témoin, lui, n'a pas bougé : le pinceau ne vise qu'une zone.
    expect(h.drawn('brasier').cases).toBe(9);
    await h.end();
  });

  it('RETOUR IMMÉDIAT en sens inverse : peindre « ajouter » hors du cadre agrandit le dessin d’une case', async () => {
    const h = await mounted(sceneDeuxFamilles(), 'add');
    expect(h.drawn('galerie').cases).toBe(9);
    await h.paint(4, 1); // hors de la boîte 3×3 : l'aire s'étend, l'emprise se matérialise
    expect(h.drawn('galerie').cases).toBe(10);
    await h.end();
  });
});

/**
 * CONTOUR DE SÉLECTION d'un décor : il couvre les cases de son empreinte au CAP de l'instance
 * (`entiteFootTiles` → `propFootTiles`, la couture que lisent la marchabilité et l'Inspector), jamais
 * la seule case d'ancre. `table-2x1` : 2×1 au cap S, 1×2 au cap E.
 */
describe('EditorCanvas — contour de sélection d’un décor multi-case', () => {
  it.each([
    ['S', [{ x: 3, y: 3 }, { x: 4, y: 3 }]],
    ['E', [{ x: 3, y: 3 }, { x: 3, y: 4 }]],
  ] as const)('cap %s : le contour couvre les cases de l’empreinte tournée', async (facing, attendues) => {
    const scene: Scene = emptyScene(8, 8);
    scene.entities = [{ id: 'table-1', kind: 'prop', pos: { x: 3, y: 3 }, ref: 'table-2x1', facing }];
    const view = {
      rot: 0 as const,
      setRot: () => {},
      viewMode: 'top' as const,
      setViewMode: () => {},
      view: { zoom: 1, x: 0, y: 0 },
      setView: () => {},
      zoomAt: () => {},
      spaceRef: { current: false },
      panRef: { current: null },
      canvasRef: { current: null as SVGSVGElement | null },
      stageRef: { current: { w: 100, h: 100 } },
    };
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root: Root = createRoot(container);
    await act(async () => {
      root.render(
        <EditorCanvas scene={scene} view={view as never} {...baseProps()} sel={{ type: 'entity', id: 'table-1' }} />,
      );
    });
    const dims = { ...scene.dimensions, rot: 0 as const, view: 'top' as const };
    const contour = [...container.querySelectorAll('path')]
      .filter((p) => p.getAttribute('stroke') === 'var(--iso-active-halo)' && p.getAttribute('stroke-width') === '3')
      .map((p) => p.getAttribute('d'))
      .sort();
    expect(contour).toEqual(attendues.map((t) => diamondPath(t.x, t.y, dims, 0)).sort());
    await act(async () => {
      root.unmount();
    });
    container.remove();
  });
});
