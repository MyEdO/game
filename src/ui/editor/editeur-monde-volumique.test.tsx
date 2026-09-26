// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import * as THREE from 'three';
import { EditorCanvas } from './EditorCanvas';
import { DEFAULT_LAYERS } from './editorState';
import { emptyScene, type Scene } from '../../state/scene';
import { tileCenter } from '../../geometry/iso';
import { setStageRendererFactory, type StageRenderer } from '../../gameIso/stage/GameStage3D';
import { hasSpritePicker } from '../../gameIso/stage/spritePicker';
import { buildTokens } from '../../gameIso/builders/tokens';
import * as propsBuilder from '../../gameIso/builders/props';
import { props as catalogueProps } from '../../data';
import { scenario as scenarioToits } from '../../scenes/test-scenarios/zones-pieces';
import { RENDER_ORDER } from '../../gameIso/backends/webgl/renderRanks';
import { CALAGE_APLAT, NOM_ARETES_CALAGE, rangsDeDecor as rangsDeDecorDuMonde } from '../../gameIso/backends/webgl/calageProps';
import type { WorldGeometry } from '../../gameIso/backends/webgl/sceneMeshes';
import { effectiveLowerLayerMode, layerHidden, LOWER_LAYER_ISOLATE_BELOW } from './lowerLayerGabarit';
import type { PlanDefectAt } from '../../state/planDefects';
import { brancherArdoise } from '../../gameIso/stage/banc-volumique';

/**
 * L'ÉDITEUR SUR LA VOIE VOLUMIQUE (#1176, P3-3, vague A). Ce qui se mesure ici :
 *  - la voie est EXCLUSIVE (le monde se peint une fois) et le SVG d'authoring RESTE, au-dessus ;
 *  - le picking de l'éditeur ne bascule PAS : aucun picker de sprite n'est inscrit (il resterait
 *    inscrit pour le JEU — le registre est un singleton) ;
 *  - la CADENCE de la cuisson : un geste qui ne touche pas le read-set du monde n'en recuit rien, un
 *    TRAIT de pinceau reste sur la cuisson d'avant le geste, et le RELÂCHÉ en paie exactement une.
 * `data-bake` est la seule trace lisible de cette dernière : un canevas WebGL n'a pas d'arbre.
 */
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/** La DERNIÈRE scène three que le renderer a reçue — par où se mesurent les faces réellement
 *  dessinées (le dégagement d'authoring compacte l'index du monde cuit, il ne le reconstruit pas). */
let derniereScene: THREE.Scene | null = null;

/** Renderer de banc : jsdom n'a aucun contexte WebGL, et cet écran n'en demande pas plus que ça. */
function rendererDeBanc(): StageRenderer {
  return {
    setPixelRatio: () => {},
    setClearColor: () => {},
    setSize: () => {},
    render: (scene: THREE.Scene) => { derniereScene = scene; },
    dispose: () => {},
    shadowMap: { enabled: false, autoUpdate: false, needsUpdate: false, type: THREE.PCFShadowMap },
    capabilities: { getMaxAnisotropy: () => 1 },
  };
}

/** FACES du monde réellement dessinées à la dernière frame : le mesh du monde porte la géométrie
 *  CUITE (marquée `emprunte`), dont `applyCutawayMask` a compacté les plages de dessin. */
function facesDessinees(): number {
  let total = 0;
  derniereScene?.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh && m.userData.emprunte && m.geometry) total += m.geometry.groups.reduce((s, g) => s + g.count, 0);
  });
  return total;
}

beforeAll(() => setStageRendererFactory(rendererDeBanc));
// Cet écran MONTE `GameStage3D` : il hérite donc des caches, de la file du cuiseur et de la boucle
// d'images que la suite partage (`isolate: false`), et les lègue au fichier suivant.
brancherArdoise();

/** Scène d'atelier : du sol partout (le SVG affine en peint les losanges), aucune entité — les
 *  billboards n'ont alors rien à rasteriser, ce que jsdom ne saurait pas faire. */
function sceneAtelier(): Scene {
  return emptyScene(8, 8);
}

/** La même, plus un ENNEMI D'EMBUSCADE (`hiddenUntilCombat`) ENRÔLÉ dans une rencontre — invisible EN
 *  JEU avant le combat, et dont l'auteur voyait seulement l'empreinte pointillée : un cadre vide. */
function sceneEmbuscade(): Scene {
  const s = emptyScene(8, 8);
  const embusque = {
    id: 'embusque-1', kind: 'personnage', pos: { x: 3, y: 3 }, ref: 'brigand',
    combat: { hiddenUntilCombat: true },
  } as unknown as Scene['entities'][number];
  const rencontre = { id: 'guet-apens', members: [{ entityId: 'embusque-1' }] } as unknown as Scene['encounters'][number];
  return { ...s, entities: [embusque], encounters: [rencontre] };
}

/** Deux couches de plein sol : de quoi mesurer ce que le canevas fait de la couche du DESSOUS. */
function sceneDeuxCouches(): Scene {
  const s = emptyScene(6, 6);
  const base = s.layers[0];
  return { ...s, layers: [base, { ...base, z: 1, tiles: [...base.tiles] }] };
}

/** Deux couches, un DÉCOR billboard sur chacune : de quoi mesurer ce que le canevas fait du DESSUS.
 *  La ref est DÉRIVÉE du catalogue — la vague volumique (#1343) convertit les refs lot par lot, et le
 *  jour où il n'en reste aucune ce banc doit le DIRE plutôt que rendre un `TypeError` opaque. */
function sceneDeuxDecors(): Scene {
  const s = sceneDeuxCouches();
  const sansRecette = catalogueProps.find((p) => !p.volume);
  if (!sansRecette) throw new Error('plus aucune ref sans recette au catalogue : ce banc n’a plus de voie billboard à mesurer');
  const ref = sansRecette.id;
  const decor = (id: string, z: number) =>
    ({ id, kind: 'prop', pos: { x: 2, y: 2 }, ...(z ? { z } : {}), ref }) as unknown as Scene['entities'][number];
  return { ...s, entities: [decor('decor-rez', 0), decor('decor-etage', 1)] };
}

/** Une scène qui porte une LAMPE posée (`mapLights` la voit : un prop dont l'instance donne un rayon). */
function sceneLampe(): Scene {
  const s = emptyScene(6, 6);
  const brasero = {
    id: 'brasero-1', kind: 'prop', pos: { x: 2, y: 2 }, ref: 'tonneau', light: { radiusM: 6 },
  } as unknown as Scene['entities'][number];
  return { ...s, entities: [brasero] };
}

/** Plaque de décalquage d'auteur : une image minuscule, calée comme le ferait le calage 2 points. */
function plaque(position: 'above' | 'below') {
  return {
    imageDataUrl: 'data:image/png;base64,iVBORw0KGgo=',
    naturalWidth: 400,
    naturalHeight: 300,
    opacity: 0.6,
    visible: true,
    position,
    contraste: false,
    transform: { tx: 20, ty: -10, scale: 0.5, rotateDeg: 0 },
  };
}

/** La scène d'atelier, plus un MEUBLE VOLUMIQUE : de quoi juger ce que le mode calage contraste. */
function sceneMobilier(): Scene {
  const s = emptyScene(8, 8);
  const table = {
    id: 'table-1', kind: 'prop', pos: { x: 2, y: 3 }, ref: 'table-ronde-4-tabourets', facing: 'S',
  } as unknown as Scene['entities'][number];
  return { ...s, entities: [table] };
}

type Plaque = ReturnType<typeof plaque>;

function baseProps() {
  return {
    pushSnapshot: () => {},
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

function vueTop() {
  return {
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
    wrapRef: { current: null as HTMLElement | null },
    stageRef: { current: { w: 0, h: 0 } },
  };
}

function evenement(type: string, opts: { clientX: number; clientY: number }) {
  return new MouseEvent(type, { bubbles: true, cancelable: true, clientX: opts.clientX, clientY: opts.clientY, button: 0 });
}

let root: Root | null = null;
let container: HTMLDivElement | null = null;

afterEach(() => {
  if (root) { act(() => root!.unmount()); root = null; }
  if (container) { container.remove(); container = null; }
});

/** Monte l'éditeur, la scène suivie comme le ferait l'historique. Les options portent ce que les
 *  correctifs interrogent : scène de départ, couche éditée, mode de couche, calques d'authoring. */
async function monter(
  tool: { mode: 'tile'; terrain: 'eau' } | { mode: 'erase' } | { mode: 'select' },
  opts: {
    scene?: Scene;
    currentLayer?: number;
    lowerLayerMode?: 'gabarit' | 'isolee';
    lowerLayerOpacity?: number;
    roofs?: boolean;
    traceLayer?: { position: 'above' | 'below' } | null;
  } = {},
) {
  let scene = opts.scene ?? sceneAtelier();
  // La plaque de l'auteur telle que le panneau la tient : une RÉFÉRENCE neuve à chaque réglage (c'est
  // ce que fait `TraceLayerPanel` — un cran de curseur = un objet de plus).
  let trace: Plaque | null = opts.traceLayer ? plaque(opts.traceLayer.position) : null;
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  const vue = vueTop();
  const rendre = () =>
    root!.render(
      <EditorCanvas
        scene={scene}
        view={vue as never}
        {...baseProps()}
        currentLayer={opts.currentLayer ?? 0}
        lowerLayerMode={opts.lowerLayerMode ?? 'gabarit'}
        lowerLayerOpacity={opts.lowerLayerOpacity ?? 0.22}
        traceLayer={trace}
        layers={{ ...DEFAULT_LAYERS, roofs: opts.roofs ?? DEFAULT_LAYERS.roofs }}
        tool={tool as never}
        setScene={(s) => { scene = s; rendre(); }}
        setSceneNoHistory={(s) => { scene = s; rendre(); }}
      />,
    );
  await act(async () => rendre());
  // Le canevas d'un jsdom n'a AUCUNE mise en page : sans taille, la passe de dessin sort avant de
  // rendre quoi que ce soit, et rien ne serait mesurable de ce que le monde peint.
  const canvasMonte = container.querySelector('canvas.iso-stage');
  if (canvasMonte) {
    Object.defineProperty(canvasMonte, 'clientWidth', { value: 800, configurable: true });
    Object.defineProperty(canvasMonte, 'clientHeight', { value: 600, configurable: true });
    await act(async () => rendre());
  }
  const svg = container.querySelector('svg.editor-iso') as SVGSVGElement;
  const point = { x: 0, y: 0, matrixTransform: () => ({ x: point.x, y: point.y }) };
  (svg as unknown as { getScreenCTM: () => unknown }).getScreenCTM = () => ({ inverse: () => ({}) });
  (svg as unknown as { createSVGPoint: () => unknown }).createSVGPoint = () => point;
  const dims = { ...scene.dimensions, rot: 0 as const, view: 'top' as const };
  const à = (type: string, x: number, y: number) => {
    const { cx, cy } = tileCenter(x, y, dims);
    return act(async () => { svg.dispatchEvent(evenement(type, { clientX: cx, clientY: cy })); });
  };
  return {
    svg,
    el: container,
    canvas: () => container!.querySelector('canvas.iso-stage') as HTMLCanvasElement | null,
    cuissons: () => Number((container!.querySelector('canvas.iso-stage') as HTMLCanvasElement).dataset.bake),
    /** Losanges de sol peints par le SVG (`floorSvg` remplit d'un dégradé de terrain). */
    solsSvg: () => svg.querySelectorAll('path[fill^="url(#"]').length,
    down: (x: number, y: number) => à('pointerdown', x, y),
    move: (x: number, y: number) => à('pointermove', x, y),
    up: (x: number, y: number) => à('pointerup', x, y),
    /** Rendu de l'éditeur AVEC une nouvelle référence de scène qui ne change QUE les entités —
     *  ce que produit un déplacement d'entité, de zone ou de trigger au pointeur. */
    bougerUneEntite: () => act(async () => { scene = { ...scene, entities: [...scene.entities] }; rendre(); }),
    /** SUJETS de billboard que l'hôte a donnés à peindre (décor + jetons d'entité). */
    sujets: () => Number((container!.querySelector('canvas.iso-stage') as HTMLCanvasElement).dataset.sujets),
    faces: () => facesDessinees(),
    /**
     * LUMINOSITÉ MOYENNE des couleurs de sommet réellement DESSINÉES (canal TEINTE). Une couleur de
     * sommet porte l'albédo de la surface × sa variance de tuile × la teinte de visibilité : seule la
     * dernière bouge d'un montage à l'autre à scène égale, donc la moyenne se compare — jamais un
     * minimum absolu, qui ne mesurerait que le matériau le plus sombre de la carte.
     */
    lumiereMoyenne: () => {
      let somme = 0;
      let n = 0;
      derniereScene?.traverse((o) => {
        const m = o as THREE.Mesh;
        if (!m.isMesh || !m.userData.emprunte || !m.geometry) return;
        const col = m.geometry.getAttribute('color')?.array as Float32Array | undefined;
        const idx = m.geometry.getIndex();
        if (!col || !idx) return;
        for (const g of m.geometry.groups)
          for (let i = g.start; i < g.start + g.count; i++) {
            const v = idx.array[i] as number;
            somme += (col[v * 3] + col[v * 3 + 1] + col[v * 3 + 2]) / 3;
            n += 1;
          }
      });
      return n ? somme / n : 0;
    },
    /** UN RÉGLAGE de la plaque, par le chemin du panneau : référence neuve, un rendu. */
    régler: (patch: Partial<Plaque>) => act(async () => { trace = { ...trace!, ...patch }; rendre(); }),
    /** La plaque de décalquage montée dans le volume (`null` si aucune). */
    decalque: () => {
      let trouve: THREE.Mesh | null = null;
      derniereScene?.traverse((o) => { if (o.name === 'decalque') trouve = o as THREE.Mesh; });
      return trouve as THREE.Mesh | null;
    },
    /** Les matériaux RÉELLEMENT portés par le maillage du monde cuit, dans l'ordre des groupes. */
    materiauxDuMonde: (): THREE.Material[] => {
      let mats: THREE.Material[] = [];
      derniereScene?.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.isMesh && m.userData.emprunte && Array.isArray(m.material)) mats = m.material as THREE.Material[];
      });
      return mats;
    },
    /** Rangs des groupes de DÉCOR VOLUMIQUE de la géométrie montée (le périmètre du mode calage). */
    rangsDeDecor: (): number[] => {
      let rangs: number[] = [];
      derniereScene?.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.isMesh && m.userData.emprunte && m.geometry?.userData?.surfaceGroups) rangs = rangsDeDecorDuMonde(m.geometry as WorldGeometry);
      });
      return rangs;
    },
    /** Le maillage d'ARÊTES du mode calage (`null` si le mode est éteint). */
    aretesCalage: () => {
      let trouve: THREE.LineSegments | null = null;
      derniereScene?.traverse((o) => { if (o.name === NOM_ARETES_CALAGE) trouve = o as THREE.LineSegments; });
      return trouve as THREE.LineSegments | null;
    },
    marqueursLampe: () => svg.querySelectorAll('[data-lampes-auteur] circle').length,
    /** Traits de la GRILLE d'authoring montés dans le SVG. */
    grille: () => svg.querySelectorAll('[data-grille] line').length,
    /** Les losanges d'empreinte d'une entité (marque de sol) et leur remplissage. */
    empreintes: () => [...svg.querySelectorAll('path[stroke-dasharray="4 3"]')] as SVGPathElement[],
  };
}

describe('Éditeur — la voie volumique monte le MÊME monde que le jeu (#1176, P3-3)', () => {
  it('canevas AVANT le SVG (donc dessous), SVG au-dessus par son contexte d’empilement, et le SVG ne peint plus le sol', async () => {
    const h = await monter({ mode: 'select' });
    const canvas = h.canvas();
    expect(canvas).not.toBeNull();
    expect(canvas!.compareDocumentPosition(h.svg) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(h.svg.getAttribute('class')).toContain('editor-iso-3d');
    expect(h.solsSvg()).toBe(0);
  });

  it('AUCUN picker de sprite inscrit — le picking de l’éditeur reste géométrique', async () => {
    await monter({ mode: 'select' });
    expect(hasSpritePicker()).toBe(false);
  });
});

describe('Éditeur — cadence de la cuisson (#1176, P3-3)', () => {
  it('un geste qui ne touche PAS le read-set du monde (déplacement d’entité) ne recuit rien', async () => {
    const h = await monter({ mode: 'select' });
    const avant = h.cuissons();
    await h.bougerUneEntite();
    await h.bougerUneEntite();
    expect(h.cuissons()).toBe(avant);
  });

  it('un TRAIT de pinceau reste sur la cuisson d’AVANT le geste ; le relâché en paie exactement UNE', async () => {
    const h = await monter({ mode: 'tile', terrain: 'eau' });
    const avant = h.cuissons();
    await h.down(2, 2);
    await h.move(3, 2);
    await h.move(4, 2);
    await h.move(5, 2);
    expect(h.cuissons()).toBe(avant); // 4 cases peintes, zéro cuisson pendant le trait
    await h.up(5, 2);
    expect(h.cuissons()).toBe(avant + 1);
  });

  it('…et pendant le trait, les cases peintes se voient — aperçu WYSIWYG par le backend affine', async () => {
    const h = await monter({ mode: 'tile', terrain: 'eau' });
    expect(h.svg.querySelector('[data-apercu-trait]')).toBeNull();
    await h.down(2, 2);
    await h.move(3, 2);
    const apercu = h.svg.querySelector('[data-apercu-trait]')!;
    expect(Number(apercu.getAttribute('data-apercu-trait'))).toBe(2);
    // Ce sont de VRAIS sols du backend affine (dégradé de terrain), pas des losanges symboliques.
    expect(apercu.querySelectorAll('path[fill^="url(#"]').length).toBeGreaterThanOrEqual(2);
    await h.up(3, 2);
    expect(h.svg.querySelector('[data-apercu-trait]')).toBeNull();
  });
});

/**
 * CE QUE L'AUTEUR DOIT VOIR — les trois trous qu'une voie volumique naïve ouvre dans l'éditeur : un
 * embusqueur sans corps, un jeton d'une couche masquée qui reste au canevas, un calque d'authoring
 * devenu inerte. Aucun ne se voit dans le SVG : ils se mesurent aux traces du canevas.
 */
describe('Éditeur — ce que le monde volumique donne à voir (#1176, P3-3)', () => {
  it('les EMBUSQUEURS ont un corps : la loi de JEU les coupe, l’authoring les montre', async () => {
    // La loi de JEU (aucune option d'authoring) coupe bien l'entité — sans quoi ce test ne dirait rien.
    expect(buildTokens(sceneEmbuscade(), undefined, null, { activeZ: 0, viewZ: null, top: true })).toEqual([]);
    const h = await monter({ mode: 'select' }, { scene: sceneEmbuscade() });
    expect(h.sujets()).toBe(1);
    // …et l'empreinte pointillée de l'auteur reste posée par-dessus, sur le SVG.
    expect(h.svg.querySelectorAll('path[stroke-dasharray]').length).toBeGreaterThan(0);
  });

  it('mode ISOLÉ : un jeton d’une couche masquée ne reste pas au canevas (aucun corps fantôme)', async () => {
    const gabarit = await monter({ mode: 'select' }, { scene: sceneEmbuscade(), currentLayer: 1, lowerLayerMode: 'gabarit' });
    expect(gabarit.sujets()).toBe(1); // couche du dessous : gabarit d'alignement, le corps est là
    await act(async () => root!.unmount());
    root = null;
    container!.remove();
    container = null;
    const isolee = await monter({ mode: 'select' }, { scene: sceneEmbuscade(), currentLayer: 1, lowerLayerMode: 'isolee' });
    expect(isolee.sujets()).toBe(0); // couche isolée : rien du dessous, ni décoration ni corps
  });

  /**
   * #1317 — LE DESSUS RESTE MASQUÉ À L'ÉDITEUR. `buildProps` ne porte plus AUCUNE loi d'étage : c'est
   * le PRÉDICAT UNIQUE du canevas (`layerHidden`) qui tranche pour le décor comme pour les 14
   * surcouches SVG. Rien ne doit donc bouger à l'écran d'authoring — ici, mesuré.
   */
  it('le décor d’une couche du DESSUS ne revient pas au canevas ; celui du DESSOUS reste en gabarit', async () => {
    expect(propsBuilder.buildProps(sceneDeuxDecors()), 'le builder, lui, les émet tous les deux').toHaveLength(2);
    const rez = await monter({ mode: 'select' }, { scene: sceneDeuxDecors(), currentLayer: 0, lowerLayerMode: 'gabarit' });
    expect(rez.sujets()).toBe(1); // on n'édite pas ce qui flotte au-dessus de sa tête
    await act(async () => root!.unmount());
    root = null;
    container!.remove();
    container = null;
    const etage = await monter({ mode: 'select' }, { scene: sceneDeuxDecors(), currentLayer: 1, lowerLayerMode: 'gabarit' });
    expect(etage.sujets()).toBe(2); // le dessous reste dessiné : c'est le gabarit d'alignement
  });

  /**
   * TOITS — une seule voie les peint (#1176, P3-3, vague B). La surcouche SVG les redessine TOUS en
   * mode plan étiqueté (nappe semi-transparente + nom de pièce), pour toutes les couches non cachées :
   * si le canevas peignait en plus leurs masses, chaque toit serait peint DEUX fois — une fois teinté
   * par la lumière, une fois en plan. Le canevas n'en garde donc aucun, et le calque « Toits » agit
   * là où le dessin vit : sur le SVG.
   */
  it('les TOITS ne sont peints qu’une fois : aucune masse au canevas, le plan étiqueté au SVG', async () => {
    const scene = scenarioToits.scene; // masure à 4 pièces sous UNE nappe à deux pans (masse z=0)
    const avec = await monter({ mode: 'select' }, { scene, currentLayer: 1, roofs: true });
    const facesAvec = avec.faces();
    // Les nappes en PLAN de l'éditeur ont leur signature : des losanges à `opacity=0,7` (`authoring/roofsSvg`).
    const plansSvg = avec.svg.querySelectorAll('path[opacity="0.7"]').length;
    expect(facesAvec).toBeGreaterThan(0); // le monde est bien cuit (murs, sols)
    expect(plansSvg).toBeGreaterThan(0); // …et le SVG porte les nappes en plan
    const sans = await remonter({ mode: 'select' }, { scene, currentLayer: 1, roofs: false });
    // Le calque éteint ne change RIEN au canevas (il n'y avait aucune masse à retirer)…
    expect(sans.faces()).toBe(facesAvec);
    // …et retire bien les nappes du SVG : la case garde son sens, sur la voie qui les peint.
    expect(sans.svg.querySelectorAll('path[opacity="0.7"]').length).toBeLessThan(plansSvg);
  });

  /**
   * LA GOMME — mesurée au CODE, pas au brief : `eraseAt` (`state/sceneEdit.ts:461`) retire une
   * ENTITÉ à la case, JAMAIS du terrain. Il n'y a donc rien à « dé-peindre » du monde cuit : ce qui
   * doit disparaître est un BILLBOARD, et il disparaît au tick, sans gel de cadence ni recuisson
   * (les entités ne sont pas dans le read-set de la cuisson).
   */
  it('la GOMME retire le sujet à l’instant du clic — sans geler la cadence, sans recuire le monde', async () => {
    const h = await monter({ mode: 'erase' }, { scene: sceneEmbuscade() });
    const facesAvant = h.faces();
    expect(h.sujets()).toBe(1);
    await h.down(3, 3); // la case de l'embusqueur
    expect(h.sujets()).toBe(0); // le corps a quitté le canevas dans le geste, pas au relâché
    expect(h.cuissons()).toBe(1); // …et pas une seule recuisson : `entities` est hors read-set
    expect(h.faces()).toBe(facesAvant); // le terrain, lui, n'a pas bougé — la gomme n'y touche pas
    await h.up(3, 3);
    expect(h.cuissons()).toBe(1);
  });
});

/**
 * CE QUE L'AUTEUR VOIT DE SA CARTE — les deux manques de la recette 2026-08-13 : plus aucune limite de
 * case (le volume fusionne les faces coplanaires, là où le contour de chaque losange affine donnait la
 * grille), et un embusqué indiscernable d'un figurant (sa marque ne vivait que sur la branche enrôlée).
 */
describe('Éditeur — grille de cases et marques d’entité (#1176, P3-3)', () => {
  it('la GRILLE est montée, un trait par rangée et par colonne', async () => {
    const h = await monter({ mode: 'select' });
    expect(h.grille()).toBe(8 + 8 + 2); // scène d'atelier 8×8
  });

  it('un EMBUSQUÉ non enrôlé porte quand même ses tirets — sinon rien ne le distingue d’un figurant', async () => {
    const seul = { ...sceneEmbuscade(), encounters: [] };
    const h = await monter({ mode: 'select' }, { scene: seul });
    const marques = h.empreintes();
    expect(marques.length).toBeGreaterThan(0);
    // La marque est AU-DESSUS du canevas (le SVG l'est tout entier) et n'est pas transparente.
    const groupe = marques[0].parentElement!;
    expect(Number(groupe.getAttribute('opacity') ?? 1)).toBeGreaterThan(0.5);
  });

  it('…et sa marque est un CONTOUR au sol, jamais un aplat qui barre le corps', async () => {
    const h = await monter({ mode: 'select' }, { scene: sceneEmbuscade() });
    expect(h.empreintes().every((p) => p.getAttribute('fill') === 'none')).toBe(true);
  });
});

/** Remonte un éditeur neuf entre deux mesures (chaque montage a son monde cuit). */
async function remonter(...args: Parameters<typeof monter>) {
  await act(async () => root!.unmount());
  root = null;
  container!.remove();
  container = null;
  return monter(...args);
}

/**
 * LES DEUX CANAUX DE COUCHE (#1176, P3-3, vague B) — le voile d'auteur et l'isolation, portés au
 * volume par les canaux qui existent déjà : la TEINTE (`applyVisibilityTint`) et le DÉGAGEMENT
 * (`applyCutawayMask`). La bascule de l'un à l'autre est arbitrée par un seuil, faute d'opacité dans
 * le volume (raison au site de `LOWER_LAYER_ISOLATE_BELOW`).
 */
describe('Éditeur — canaux ISOLÉ et VOILÉ au canevas (#1176, P3-3, vague B)', () => {
  it.each(['gabarit', 'isolee'] as const)('mode %s : un MEUBLE VOLUMIQUE posé à la couche active est cuit et dessiné au canevas', async (lowerLayerMode) => {
    const meuble = sceneMobilier();
    const avec = await monter({ mode: 'select' }, { scene: meuble, currentLayer: 0, lowerLayerMode });
    const facesAvec = avec.faces();
    const sans = await remonter({ mode: 'select' }, { scene: { ...meuble, entities: [] }, currentLayer: 0, lowerLayerMode });
    expect(facesAvec).toBeGreaterThan(sans.faces());
  });

  it('mode ISOLÉ : les faces de la couche du dessous quittent le dessin (canal DÉGAGEMENT)', async () => {
    const scene = sceneDeuxCouches();
    const gabarit = await monter({ mode: 'select' }, { scene, currentLayer: 1, lowerLayerMode: 'gabarit' });
    const avec = gabarit.faces();
    const isolee = await remonter({ mode: 'select' }, { scene, currentLayer: 1, lowerLayerMode: 'isolee' });
    expect(avec).toBeGreaterThan(0);
    expect(isolee.faces()).toBeLessThan(avec);
  });

  it('mode GABARIT : la couche du dessous est VOILÉE par la teinte, et le curseur la dose', async () => {
    const scene = sceneDeuxCouches();
    const clair = await monter({ mode: 'select' }, { scene, currentLayer: 1, lowerLayerMode: 'gabarit', lowerLayerOpacity: 0.9 });
    const lumClair = clair.lumiereMoyenne();
    const sombre = await remonter({ mode: 'select' }, { scene, currentLayer: 1, lowerLayerMode: 'gabarit', lowerLayerOpacity: 0.3 });
    // À scène et faces IDENTIQUES, la seule chose qui change est la teinte du gabarit : le curseur dose.
    expect(sombre.faces()).toBe(clair.faces());
    expect(sombre.lumiereMoyenne()).toBeLessThan(lumClair);
  });

  it('BASCULE SOUS SEUIL : un gabarit quasi éteint ISOLE au lieu de noircir', async () => {
    const scene = sceneDeuxCouches();
    const visible = await monter({ mode: 'select' }, { scene, currentLayer: 1, lowerLayerOpacity: 0.4 });
    const facesVoilees = visible.faces();
    const eteint = await remonter({ mode: 'select' }, { scene, currentLayer: 1, lowerLayerOpacity: 0.05 });
    // Sous le seuil, la couche du dessous n'est plus DESSINÉE (dégagement) — elle n'est pas peinte en noir.
    expect(eteint.faces()).toBeLessThan(facesVoilees);
    // …et ce qui reste dessiné est à PLEINE teinte : la couche active, pas une couche noircie.
    const actifSeul = await remonter({ mode: 'select' }, { scene, currentLayer: 1, lowerLayerMode: 'isolee' });
    expect(eteint.lumiereMoyenne()).toBeCloseTo(actifSeul.lumiereMoyenne(), 9);
  });

  it('la loi de couche du canevas EST celle du SVG : le prédicat est partagé', () => {
    // `layerHidden` : le dessus toujours masqué, le dessous seulement en isolé.
    expect(layerHidden(2, 1, 'gabarit')).toBe(true);
    expect(layerHidden(0, 1, 'gabarit')).toBe(false);
    expect(layerHidden(0, 1, 'isolee')).toBe(true);
    expect(layerHidden(1, 1, 'isolee')).toBe(false);
    // …et le mode EFFECTIF du monde bascule sous le seuil, jamais au-dessus.
    expect(effectiveLowerLayerMode('gabarit', LOWER_LAYER_ISOLATE_BELOW)).toBe('gabarit');
    expect(effectiveLowerLayerMode('gabarit', LOWER_LAYER_ISOLATE_BELOW - 0.01)).toBe('isolee');
    expect(effectiveLowerLayerMode('isolee', 1)).toBe('isolee');
  });

  /**
   * LES CORPS de l'éditeur suivent le MÊME canal que leur case — mais ce canal a déménagé : la teinte
   * ne se cuit plus dans le sujet, elle s'échantillonne à sa CASE dans la passe de pose (#1396). Le
   * contrat se mesure donc là où les quads existent, sur le montage réel de cet écran :
   * `gameIso/stage/pas-exploration.test.tsx`, « le gabarit de couche basse assombrit les CORPS ».
   */
});

/** Les familles restantes de la vague B : plaque de décalquage au monde, marqueurs de lampe. */
describe('Éditeur — plaque de décalquage et marqueurs d’auteur (#1176, P3-3, vague B)', () => {
  for (const position of ['below', 'above'] as const)
    it(`la plaque « ${position} » est montée en QUAD MONDE (et quitte le SVG)`, async () => {
      const h = await monter({ mode: 'select' }, { traceLayer: { position } });
      const mesh = h.decalque();
      expect(mesh).not.toBeNull();
      expect(mesh!.geometry.getAttribute('position').count).toBe(4);
      expect(mesh!.renderOrder).toBe(RENDER_ORDER[position === 'above' ? 'chrome' : 'decalque']);
      // Une seule plaque : le SVG ne porte plus la sienne (elle serait doublée, et à un autre ancrage).
      expect(h.svg.querySelector('image')).toBeNull();
    });

  /**
   * #1404 — l'opacité de la plaque est un CURSEUR (`ui/editor/TraceLayerPanel`) : chaque cran passait
   * une référence neuve à l'écran, qui libérait géométrie, matériau et texture puis RE-DÉCODAIT le
   * `data:` URL. Un réglage scalaire est une REPOSE : rien ne se remonte, l'opacité s'écrit en place.
   */
  it('un cran d’OPACITÉ s’écrit en place : mêmes objets, image jamais re-décodée', async () => {
    const h = await monter({ mode: 'select' }, { traceLayer: { position: 'above' } });
    const mesh = h.decalque()!;
    const mat = mesh.material as THREE.MeshBasicMaterial;
    const avant = [mesh.uuid, mesh.geometry.uuid, mat.uuid, mat.map!.uuid];
    expect(mat.opacity, 'PRÉMISSE : la plaque part à l’opacité authored').toBe(0.6);

    await h.régler({ opacity: 0.15 });

    const après = h.decalque()!;
    const matAprès = après.material as THREE.MeshBasicMaterial;
    expect([après.uuid, après.geometry.uuid, matAprès.uuid, matAprès.map!.uuid], 'un cran de curseur a remonté la plaque')
      .toEqual(avant);
    expect(matAprès.opacity, 'l’opacité du curseur n’est pas arrivée au matériau').toBe(0.15);
  });

  it('une AUTRE planche, elle, se recharge — et elle seule (le quad et son matériau restent)', async () => {
    const h = await monter({ mode: 'select' }, { traceLayer: { position: 'above' } });
    const mesh = h.decalque()!;
    const mat = mesh.material as THREE.MeshBasicMaterial;
    const texAvant = mat.map!.uuid;

    await h.régler({ imageDataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==' });

    const après = h.decalque()!;
    const matAprès = après.material as THREE.MeshBasicMaterial;
    expect(matAprès.map!.uuid, 'une planche neuve doit Être décodée').not.toBe(texAvant);
    expect([après.uuid, matAprès.uuid], 'seule l’image change : le quad et son matériau restent en place')
      .toEqual([mesh.uuid, mat.uuid]);
  });

  it('un CALAGE déplacé rebâtit la forme, et rien d’autre', async () => {
    const h = await monter({ mode: 'select' }, { traceLayer: { position: 'above' } });
    const mesh = h.decalque()!;
    const mat = mesh.material as THREE.MeshBasicMaterial;
    const géoAvant = mesh.geometry.uuid;

    await h.régler({ transform: { tx: 60, ty: -10, scale: 0.5, rotateDeg: 0 } });

    const après = h.decalque()!;
    const matAprès = après.material as THREE.MeshBasicMaterial;
    expect(après.geometry.uuid, 'les quatre coins ont bougé : la géométrie se rebâtit').not.toBe(géoAvant);
    expect([après.uuid, matAprès.uuid, matAprès.map!.uuid], 'un calage ne re-décode aucune image')
      .toEqual([mesh.uuid, mat.uuid, mat.map!.uuid]);
  });

  it('les SOURCES LUMINEUSES posées portent un marqueur d’auteur (en plein jour, rien ne les trahirait)', async () => {
    const h = await monter({ mode: 'select' }, { scene: sceneLampe() });
    expect(h.marqueursLampe()).toBe(1);
    // …et la portée authorée s'y lit : le cercle est là, à côté du point.
    expect(h.svg.querySelectorAll('[data-lampes-auteur] ellipse').length).toBe(1);
  });

  it('…et une scène SANS source n’en montre aucun', async () => {
    const h = await monter({ mode: 'select' });
    expect(h.svg.querySelector('[data-lampes-auteur]')).toBeNull();
  });
});

/**
 * MODE CALAGE — le CÂBLAGE complet, du réglage du panneau au maillage réellement dessiné : la case
 * « Contraste de calage » du calque passe le mobilier volumique en aplat cyan + arêtes, et le sol
 * garde son matériau. Éteindre la case (ou masquer le calque) rend au décor ses matériaux d'origine,
 * PAR IDENTITÉ : la surcharge ne recuit rien.
 */
describe('Éditeur — mode calage du calque de référence', () => {
  /** Les matériaux des groupes de DÉCOR, et ceux de tout le reste, tels que le monde les porte. */
  function tri(h: Awaited<ReturnType<typeof monter>>) {
    const mats = h.materiauxDuMonde();
    const rangs = new Set(h.rangsDeDecor());
    return {
      decor: mats.filter((_, i) => rangs.has(i)),
      reste: mats.filter((_, i) => !rangs.has(i)),
    };
  }

  it('calque VISIBLE + contraste : le décor passe en aplat cyan UNIQUE, le reste du monde est intact', async () => {
    const h = await monter({ mode: 'select' }, { scene: sceneMobilier(), traceLayer: { position: 'above' } });
    const avant = tri(h);
    expect(avant.decor.length).toBeGreaterThan(0);
    await h.régler({ contraste: true });
    const pendant = tri(h);
    expect(new Set(pendant.decor).size).toBe(1); // UN matériau pour tout le mobilier
    const aplat = pendant.decor[0] as THREE.MeshBasicMaterial;
    expect(aplat.color.getHexString()).toBe(CALAGE_APLAT.slice(1));
    expect(aplat.transparent).toBe(true);
    expect(pendant.reste).toEqual(avant.reste); // sol et murs : les MÊMES matériaux, par identité
    expect(h.aretesCalage()).not.toBeNull();
  });

  it('la case rendue à zéro remet au décor ses matériaux d’ORIGINE et retire les arêtes', async () => {
    const h = await monter({ mode: 'select' }, { scene: sceneMobilier(), traceLayer: { position: 'above' } });
    const avant = tri(h);
    await h.régler({ contraste: true });
    expect(h.aretesCalage()).not.toBeNull();
    await h.régler({ contraste: false });
    expect(tri(h).decor).toEqual(avant.decor);
    expect(h.aretesCalage()).toBeNull();
  });

  it('contraste demandé sur un calque MASQUÉ : le mode ne s’allume pas', async () => {
    const h = await monter({ mode: 'select' }, { scene: sceneMobilier(), traceLayer: { position: 'above' } });
    const avant = tri(h);
    await h.régler({ contraste: true, visible: false });
    expect(tri(h).decor).toEqual(avant.decor);
    expect(h.aretesCalage()).toBeNull();
  });

  it('sans calque du tout, le décor garde son rendu de jeu', async () => {
    const h = await monter({ mode: 'select' }, { scene: sceneMobilier() });
    expect(h.rangsDeDecor().length).toBeGreaterThan(0);
    for (const mat of tri(h).decor) expect((mat as THREE.MeshBasicMaterial).color.getHexString()).not.toBe(CALAGE_APLAT.slice(1));
    expect(h.aretesCalage()).toBeNull();
  });
});

/** Le monde volumique est LE monde, ici comme au jeu (#1176 P3-4) : aucun interrupteur de voie. */
describe('Éditeur — aucun interrupteur de voie ne subsiste', () => {
  it('aucun interrupteur de voie dans la barre de vue', async () => {
    const h = await monter({ mode: 'select' });
    expect(h.el.querySelector('[aria-label="Monde volumique (DEV)"]')).toBeNull();
    expect(h.el.querySelector('[aria-label="Monde en couches SVG (DEV)"]')).toBeNull();
  });

  it('le canevas est monté d’office, sans rien à armer', async () => {
    const h = await monter({ mode: 'select' });
    expect(h.canvas()).not.toBeNull();
  });
});
