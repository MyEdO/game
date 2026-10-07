// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { setStageRendererFactory } from './GameStage3D';
import { BancRenderer, brancherArdoise } from './banc-volumique';
import * as sceneMeshes from '../backends/webgl/sceneMeshes';
import type { KeepEl } from '../backends/webgl/sceneMeshes';
import { useGame } from '../../state/store';
import { emptyScene, heightAt, sceneMetresPerTile, type Scene, type SceneEntity } from '../../state/scene';
import { props } from '../../data';
import type { Combatant } from '../../engine/types';
import * as propsBuilder from '../builders/props';
import * as roomPortalsModule from '../../state/roomPortals';
import * as roofsBuilder from '../builders/roofs';
import { buildRoofs } from '../builders/roofs';
import { estPropVolumique } from '../builders/types';
import { MondeDeCampagne } from './MondeDeCampagne';
import { capsuleCenter, tileCenter, LEVEL_H, type Dims } from '../../geometry/iso';
import { metricToLift } from '../../state/relief';
import { actorCapsuleOf } from './actorCapsule';
import { VW, VH } from './useStageCamera';

/**
 * #817 — un rendu de PLUS (survol, pan caméra, tout état sans rapport avec scène/position
 * logique/pièce/étage/rotation) ne doit RIEN rebâtir : `buildProps` scanne toute la carte
 * (~2144 objets de scène sur La Diligence) et tournait jusqu'à 60×/s pendant une marche
 * (`visualAllies`/`cutawayAllies` recréés à chaque rendu → `propEls` invalidé en boucle).
 */
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

brancherArdoise();
beforeAll(() => setStageRendererFactory(() => new BancRenderer()));
afterAll(() => setStageRendererFactory(null));

function hero(id: string, pos: { x: number; y: number }): Combatant {
  return {
    id, label: id, kind: 'hero', pos, size: 'moyenne',
    wounds: { current: 12, max: 12 }, weapons: [],
    characteristics: {}, advantage: 0, conditions: [], armour: {},
    skills: [], talents: [], movement: 4,
  } as unknown as Combatant;
}

describe('MondeDeCampagne — stabilité de propEls entre deux rendus sans changement logique (#817)', () => {
  let root: Root | null = null;
  let container: HTMLDivElement | null = null;

  afterEach(() => {
    if (root) { act(() => root!.unmount()); root = null; }
    if (container) { container.remove(); container = null; }
    vi.restoreAllMocks();
  });

  it('un second rendu sans changement de scène/position/pièce/étage/rotation ne rappelle pas buildProps', () => {
    const scene = emptyScene(6, 6);
    // Zone descriptive INTÉRIEURE (aucun onCross/perRound/crossTest/barrier/blocksLoS) englobant la
    // position du groupe : `roomFocus` devient non-null → `cutawayAllies` VAUT `visualAllies` (au lieu
    // d'`undefined`), le chemin exact où l'instabilité de référence de #817 se propageait à `propEls`.
    scene.effectZones = [{ id: 'room-a', label: 'Salle', area: { kind: 'rect', x: 0, y: 0, w: 6, h: 6 }, presentation: 'interior', tiles: [{ x: 2, y: 2 }], z: 0 }];
    const H = hero('h1', { x: 2, y: 2 });
    useGame.setState({
      scene,
      mode: 'exploration',
      partyPos: { x: 2, y: 2 },
      party: [H],
      battle: null,
      dialogue: null,
      flags: {},
    });

    const spy = vi.spyOn(propsBuilder, 'buildProps');

    container = document.createElement('div');
    root = createRoot(container);
    act(() => root!.render(<MondeDeCampagne />));
    // Le montage peut déclencher SA PROPRE re-passe interne (effet `markExplored`) — on ne fige le
    // compteur qu'UNE FOIS le montage stabilisé, pour isoler le SEUL rendu forcé qui suit.
    const afterMount = spy.mock.calls.length;
    expect(afterMount).toBeGreaterThan(0);

    // Second rendu FORCÉ (ex. re-rendu React déclenché par un état sans rapport) : aucun changement
    // logique n'a eu lieu entre les deux — `buildProps` ne doit PAS être rappelé.
    act(() => root!.render(<MondeDeCampagne />));
    expect(spy.mock.calls.length).toBe(afterMount);
  });
});

/**
 * #817 — les ACCÈS de pièce se recalculent à la CASE, jamais à l'image : hors zone intérieure,
 * `portalsForParty` filtre les sorties sur la composante marchable du groupe (`roomPortals.ts`). Ses
 * seules vraies entrées sont la SCÈNE et la case de CONTRÔLE ; une image d'animation de marche (le
 * jeton glisse, la case ne change pas) ne doit en déclencher AUCUN, et un changement de case UN.
 */
describe('MondeDeCampagne — accès de pièce recalculés à la case, pas à l’image (#817)', () => {
  let root: Root | null = null;
  let container: HTMLDivElement | null = null;

  afterEach(() => {
    if (root) { act(() => root!.unmount()); root = null; }
    if (container) { container.remove(); container = null; }
    vi.restoreAllMocks();
  });

  it('un rendu de plus sans changement de case ne rappelle pas portalsForParty — un pas le rappelle', () => {
    const scene = emptyScene(6, 6);
    useGame.setState({
      scene,
      mode: 'exploration',
      partyPos: { x: 2, y: 2 },
      party: [hero('h1', { x: 2, y: 2 })],
      battle: null,
      dialogue: null,
      flags: {},
    });

    const spy = vi.spyOn(roomPortalsModule, 'portalsForParty');

    container = document.createElement('div');
    root = createRoot(container);
    act(() => root!.render(<MondeDeCampagne />));
    const afterMount = spy.mock.calls.length;
    expect(afterMount).toBeGreaterThan(0);

    // Rendu FORCÉ sans changement logique : c'est le cas d'une image d'animation de marche.
    act(() => root!.render(<MondeDeCampagne />));
    expect(spy.mock.calls.length).toBe(afterMount);

    // Un vrai PAS change la case de contrôle : les accès doivent bien être recalculés (le memo ne
    // sur-cache pas — une porte devenue accessible doit apparaître).
    act(() => { useGame.setState({ partyPos: { x: 3, y: 2 } }); });
    act(() => root!.render(<MondeDeCampagne />));
    expect(spy.mock.calls.length).toBeGreaterThan(afterMount);
  });
});

/**
 * #818/#907 — le DÉGAGEMENT est UNE loi (`cutawayForSection`) sur UNE résolution (`clearedSpace` :
 * pièce occupée, et à DÉFAUT de pièce, emprise qui abrite ou coiffe l'allié). Le stage ne la
 * réimplémente pas : il lui passe les positions alliées. Ce test verrouille le CÂBLAGE : sans les
 * positions alliées, un bâti NON ZONÉ (carte en cours d'édition) ne se dégagerait jamais.
 */
describe('MondeDeCampagne — les positions alliées atteignent la loi de dégagement (#818, #907)', () => {
  let root: Root | null = null;
  let container: HTMLDivElement | null = null;

  afterEach(() => {
    if (root) { act(() => root!.unmount()); root = null; }
    if (container) { container.remove(); container = null; }
    vi.restoreAllMocks();
  });

  it('clearedSpace reçoit les positions alliées, étage compris — jamais la scène seule', () => {
    const scene = emptyScene(6, 6);
    useGame.setState({
      scene,
      mode: 'exploration',
      partyPos: { x: 4, y: 3 },
      party: [hero('h1', { x: 4, y: 3 })],
      battle: null,
      dialogue: null,
      flags: {},
    });

    const spy = vi.spyOn(roofsBuilder, 'clearedSpace');

    container = document.createElement('div');
    root = createRoot(container);
    act(() => root!.render(<MondeDeCampagne />));

    expect(spy).toHaveBeenCalled();
    const allies = spy.mock.calls[spy.mock.calls.length - 1][1];
    expect(allies).toEqual([{ x: 4, y: 3, z: 0 }]);
  });

  /** #950 — la VUE du groupe atteint la même loi : sans elle, aucune nappe ne serait régie par la
   *  vision et les toitures des corps voisins se peindraient par-dessus l'intérieur. */
  it('clearedSpace reçoit aussi les cases VUES par le groupe', () => {
    const scene = emptyScene(6, 6);
    useGame.setState({
      scene,
      mode: 'exploration',
      partyPos: { x: 4, y: 3 },
      party: [hero('h1', { x: 4, y: 3 })],
      battle: null,
      dialogue: null,
      flags: {},
      explored: {},
    });

    const spy = vi.spyOn(roofsBuilder, 'clearedSpace');

    container = document.createElement('div');
    root = createRoot(container);
    act(() => root!.render(<MondeDeCampagne />));
    act(() => root!.render(<MondeDeCampagne />)); // 2e rendu : l'exploré du 1er pas est accumulé

    const sight = spy.mock.calls[spy.mock.calls.length - 1][2];
    expect(sight).toBeInstanceOf(Set);
    expect(sight!.has('4,3,0')).toBe(true);
  });
});

/**
 * #892 — la VUE DU DESSUS est le mode TACTIQUE du jeu : on y regarde UN plancher À LA VERTICALE.
 * La distinction ne passe par AUCUN réglage d'affichage : l'appelant fournit le `viewZ` du pivot
 * (isolement d'un étage), et les builders continuent d'ignorer le mode de vue.
 *
 * DEUX porteurs depuis que le monde est volumique (#1176 P3-4, commit C5a) : les DÉCORS et les JETONS
 * reçoivent le pivot par leur `viewZ` de builder ; la MASSE du monde, elle, est cuite en bloc
 * (`bakeWorldGeometry` prend la scène entière) et le reçoit par la loi de dégagement que le stage
 * remet à `applyCutawayMask`. Les deux se mesurent ici — l'étage isolé ne doit dépendre d'aucun des
 * deux chemins pris isolément.
 */
describe('MondeDeCampagne — la vue du dessus isole l’étage actif (#892)', () => {
  let root: Root | null = null;
  let container: HTMLDivElement | null = null;

  afterEach(() => {
    if (root) { act(() => root!.unmount()); root = null; }
    if (container) { container.remove(); container = null; }
    vi.restoreAllMocks();
  });

  /** Auberge à deux planchers, avec un décor au REZ et un autre à l'ÉTAGE. */
  function twoStoreyScene() {
    const scene = emptyScene(6, 6);
    scene.layers.push({ z: 1, tiles: new Array(36).fill('herbe') });
    // Un décor de TERRAIN par étage (`bois` → overlay `arbre`) : la population que `buildProps` filtre
    // par l'étage demandé.
    scene.layers[0].tiles[3 * 6 + 2] = 'bois'; // (2,3) au rez
    scene.layers[1].tiles[3 * 6 + 3] = 'bois'; // (3,3) à l'étage
    return scene;
  }
  const storeysBuilt = (spy: { mock: { results: { value: unknown }[] } }) =>
    [...new Set((spy.mock.results[spy.mock.results.length - 1].value as { cell: { z: number } }[]).map((el) => el.cell.z))].sort();

  it('groupe à l’étage : l’iso pose les décors de l’étage ET du rez ; la vue du dessus, ceux du seul étage', () => {
    useGame.setState({
      scene: twoStoreyScene(),
      mode: 'exploration',
      partyPos: { x: 2, y: 2, z: 1 },
      party: [hero('h1', { x: 2, y: 2 })],
      battle: null,
      dialogue: null,
      flags: {},
      viewMode: 'iso',
    });
    const spy = vi.spyOn(propsBuilder, 'buildProps');

    container = document.createElement('div');
    root = createRoot(container);
    act(() => root!.render(<MondeDeCampagne />));
    expect(storeysBuilt(spy)).toEqual([0, 1]); // iso : le contrebas reste du contexte utile

    act(() => { useGame.setState({ viewMode: 'top' }); });
    expect(storeysBuilt(spy)).toEqual([1]); // plan : l'étage actif, et lui seul

    act(() => { useGame.setState({ viewMode: 'iso' }); });
    expect(storeysBuilt(spy)).toEqual([0, 1]); // retour en iso : rien n'a changé
  });

  /** Élément de MASSE posé à l'étage `z` — ce que la loi de dégagement reçoit du monde cuit. */
  const solAu = (z: number) => ({ kind: 'floor', key: `f:2,2,${z}`, cell: { x: 2, y: 2, z }, states: {} } as unknown as Parameters<KeepEl>[0]);

  it('…et la MASSE du monde suit le MÊME pivot : en vue du dessus, le rez ne se superpose plus à l’étage', () => {
    useGame.setState({
      scene: twoStoreyScene(),
      mode: 'exploration',
      partyPos: { x: 2, y: 2, z: 1 },
      party: [hero('h1', { x: 2, y: 2 })],
      battle: null,
      dialogue: null,
      flags: {},
      viewMode: 'iso',
    });
    // La loi RÉELLEMENT remise au monde cuit : celle que le stage passe à `applyCutawayMask`.
    const spy = vi.spyOn(sceneMeshes, 'applyCutawayMask');

    container = document.createElement('div');
    root = createRoot(container);
    act(() => root!.render(<MondeDeCampagne />));
    const loiIso = spy.mock.calls[spy.mock.calls.length - 1][1];
    expect(loiIso(solAu(1)), 'iso : l’étage actif est dessiné').toBe(true);
    expect(loiIso(solAu(0)), 'iso : le contrebas reste du contexte utile').toBe(true);

    act(() => { useGame.setState({ viewMode: 'top' }); });
    const loiPlan = spy.mock.calls[spy.mock.calls.length - 1][1];
    expect(loiPlan(solAu(1)), 'plan : l’étage actif est dessiné').toBe(true);
    expect(loiPlan(solAu(0)), 'plan : le rez ne se superpose PLUS à l’étage').toBe(false);
  });
});

/**
 * VISÉE DU SUJET : la caméra centre le MILIEU de la capsule du sujet (`actorCapsuleOf`, celle-là même
 * que consomme l'occlusion), jamais le sol de sa case — un cadrage sur le sol pousse le viewport d'une
 * demi-capsule vers le haut de la scène, donc vers ce qui SURPLOMBE le groupe (biais × zoom).
 */
describe('MondeDeCampagne — la caméra vise le milieu de la capsule du sujet', () => {
  let root: Root | null = null;
  let container: HTMLDivElement | null = null;

  afterEach(() => {
    if (root) { act(() => root!.unmount()); root = null; }
    if (container) { container.remove(); container = null; }
    vi.restoreAllMocks();
  });

  /** Point de la SCÈNE que la transformation caméra du stage amène au CENTRE du viewport : la `matrix()`
   *  rendue par `stageCamTransform` (`stage/stageCam.ts`), simplement INVERSÉE — la loi de caméra n'est
   *  pas répliquée ici. */
  function viseOf(el: HTMLDivElement): { x: number; y: number } {
    const style = el.querySelector('svg > g')!.getAttribute('style')!;
    const m = /matrix\(([^)]+)\)/.exec(style)!;
    const [k, , , , tx, ty] = m[1].split(',').map(Number);
    return { x: (VW / 2 - tx) / k, y: (VH / 2 - ty) / k };
  }

  function mount(partyPos: { x: number; y: number; z?: number }, height?: number[]) {
    const scene = emptyScene(6, 6);
    if (height) scene.layers.push({ z: 1, tiles: new Array(36).fill('planches'), height });
    useGame.setState({
      scene,
      mode: 'exploration',
      partyPos,
      party: [hero('h1', { x: partyPos.x, y: partyPos.y })],
      battle: null,
      dialogue: null,
      flags: {},
      viewMode: 'iso',
      camPan: { x: 0, y: 0 },
    });
    container = document.createElement('div');
    root = createRoot(container);
    act(() => root!.render(<MondeDeCampagne />));
    return scene;
  }

  const cas: [string, { x: number; y: number; z?: number }, number[] | undefined][] = [
    ['au rez', { x: 2, y: 2 }, undefined],
    ['à l’étage', { x: 2, y: 2, z: 1 }, new Array(36).fill(4)],
  ];
  it.each(cas)('%s : le centre du viewport tombe sur le milieu de capsule, une demi-capsule au-dessus du sol de la case', (_où, partyPos, height) => {
    const scene = mount(partyPos, height);
    const dims: Dims = { ...scene.dimensions, rot: 0, view: 'iso', edge: false };
    const z = partyPos.z ?? 0;
    const h = heightAt(scene, partyPos.x, partyPos.y, z);
    const vise = viseOf(container!); // point de la SCÈNE amené au centre du viewport

    const milieu = capsuleCenter(actorCapsuleOf({ x: partyPos.x, y: partyPos.y, h }, dims));
    expect(vise.x).toBeCloseTo(milieu.x, 6);
    expect(vise.y).toBeCloseTo(milieu.y, 6);

    const sol = tileCenter(partyPos.x, partyPos.y, dims, metricToLift(h));
    expect(sol.cy - vise.y).toBeCloseTo(LEVEL_H / 2, 6); // demi-capsule (pieds→tête = 1 niveau)
    expect(sol.cx - vise.x).toBeCloseTo(0, 6);
  });
});

/**
 * DÉCOR VOLUMIQUE SOLIDAIRE D'UNE NAPPE (#1624) : un ornement de faîte cuit dans la masse commune ne
 * peut plus être sauté par le builder (la cuisson appelle `buildProps` SANS vue) — c'est la loi de
 * dégagement, la MÊME que pour les pans, qui doit le retirer quand le toit se lève. Le test interroge
 * la loi RÉELLEMENT remise au monde cuit (`applyCutawayMask`) avec les éléments RÉELS des builders —
 * catalogue compris : le clocheton de chapelle porte sa recette dans `props.json`.
 */
describe('MondeDeCampagne — le faîteau volumique se lève AVEC son toit (#1624)', () => {
  let root: Root | null = null;
  let container: HTMLDivElement | null = null;

  afterEach(() => {
    if (root) { act(() => root!.unmount()); root = null; }
    if (container) { container.remove(); container = null; }
    vi.restoreAllMocks();
  });

  function chapelle() {
    const scene = emptyScene(10, 10);
    scene.architecture = [{
      id: 'corps-chapelle',
      style: 'chapelle',
      storeys: [{ id: 'z0', z: 0, parts: [], roomZoneIds: [] }],
      facades: [],
      masses: [{ id: 'nef', z: 0, footprint: [{ x: 2, y: 2, w: 4, h: 4 }], levels: 1, profile: 'gable', ridge: 'x', pitchDeg: 30, material: 'tuile' }],
    }];
    return scene;
  }

  /** Monte l'hôte avec le groupe à `pos` et rend la loi de dégagement effectivement remise au bake. */
  function loiDeDégagement(scene: ReturnType<typeof chapelle>, pos: { x: number; y: number }): KeepEl {
    const spy = vi.spyOn(sceneMeshes, 'applyCutawayMask');
    useGame.setState({
      scene, mode: 'exploration', partyPos: pos, party: [hero('h1', pos)],
      battle: null, dialogue: null, flags: {}, viewMode: 'iso',
    });
    container = document.createElement('div');
    root = createRoot(container);
    act(() => root!.render(<MondeDeCampagne />));
    return spy.mock.calls[spy.mock.calls.length - 1][1];
  }

  /** Le pan de toit de la nef et le faîteau volumique de la même masse, tels que les builders les rendent. */
  function élémentsDeLaNef(scene: ReturnType<typeof chapelle>) {
    const pan = buildRoofs(scene).find((el) => el.sectionId === 'nef')!;
    const faîteau = propsBuilder.buildProps(scene).filter(estPropVolumique).find((el) => el.source === 'ornament')!;
    return { pan, faîteau };
  }

  it('allié SOUS l’empreinte : la nappe est retirée, et le faîteau volumique avec elle', () => {
    const scene = chapelle();
    const loi = loiDeDégagement(scene, { x: 3, y: 3 }); // dans l'emprise bâtie
    const { pan, faîteau } = élémentsDeLaNef(scene);
    expect(faîteau.faces.length).toBeGreaterThan(0); // il est bien CUIT dans la masse commune
    // MÊME identité de nappe que les pans (la SECTION), et l'emprise entière de la masse : c'est ce
    // que la loi commune interroge.
    expect(faîteau.nappe!.sectionId).toBe(pan.sectionId);
    expect(new Set(faîteau.nappe!.cells.map((c) => `${c.x},${c.y}`)))
      .toEqual(new Set(['2,2', '3,2', '4,2', '5,2', '2,3', '3,3', '4,3', '5,3', '2,4', '3,4', '4,4', '5,4', '2,5', '3,5', '4,5', '5,5']));
    expect(loi(pan), 'le toit se lève').toBe(false);
    expect(loi(faîteau), 'le faîteau ne reste pas à flotter au-dessus du vide').toBe(false);
  });

  it('groupe DEHORS, bâtiment en vue : la nappe se dessine, et le faîteau avec elle', () => {
    const scene = chapelle();
    const loi = loiDeDégagement(scene, { x: 1, y: 1 }); // au pied du corps, jamais dessous
    const { pan, faîteau } = élémentsDeLaNef(scene);
    expect(loi(pan)).toBe(true);
    expect(loi(faîteau)).toBe(true);
  });
});

/**
 * #1317 — PARITÉ D'ÉTAGE. La visibilité d'étage est la loi d'un ÉCRAN, appliquée APRÈS un builder qui
 * n'en porte aucune : un étage dont le PLANCHER est peint montre son DÉCOR, par ses deux voies de
 * rendu (volume cuit dans la masse, billboard monté en quad) et jusqu'au PICKING.
 *
 * Les trois populations se lisent sur le CHEMIN RÉEL, aucune n'est rejouée ici : le plancher par la
 * loi que le stage remet à `applyCutawayMask`, les billboards par les éléments que le stage remet à
 * `collectBillboards`, les triangles visables par l'INDEX DE DESSIN que cette même loi a compacté.
 */
describe('MondeDeCampagne — un étage peint montre son décor, les deux voies et le picking (#1317)', () => {
  let root: Root | null = null;
  let container: HTMLDivElement | null = null;

  afterEach(() => {
    if (root) { act(() => root!.unmount()); root = null; }
    if (container) { container.remove(); container = null; }
    vi.restoreAllMocks();
  });

  /** Refs DÉRIVÉES du catalogue — la vague volumique (#1343) convertit les refs lot par lot, donc
   *  aucune n'est écrite en dur. Le jour où une VOIE disparaît du catalogue, ce banc n'a plus rien à
   *  mesurer et doit le DIRE : un `!` y rendrait un `TypeError` opaque. */
  const refDuCatalogue = (voie: 'volume' | 'billboard') => {
    const p = props.find((q) => (voie === 'volume' ? !!q.volume : !q.volume));
    if (!p) {
      throw new Error(voie === 'volume'
        ? 'plus aucune ref à recette au catalogue : ce banc n’a plus de voie volume à mesurer'
        : 'plus aucune ref sans recette au catalogue : ce banc n’a plus de voie billboard à mesurer');
    }
    return p.id;
  };
  const REF_VOLUME = refDuCatalogue('volume');
  const REF_BILLBOARD = refDuCatalogue('billboard');

  /** GALERIE : un rez et un étage, le groupe au REZ, et à l'ÉTAGE un décor de chaque voie. Aucune
   *  architecture, donc aucune nappe à lever : ce que l'écran retranche ne vient que de l'étage. */
  function galerie(): Scene {
    const scene = emptyScene(6, 6);
    scene.layers.push({ z: 1, tiles: new Array(36).fill('planches') });
    scene.entities = [
      { id: 'lustre', kind: 'prop', pos: { x: 3, y: 3 }, z: 1, ref: REF_VOLUME, facing: 'S' },
      { id: 'loge', kind: 'prop', pos: { x: 4, y: 3 }, z: 1, ref: REF_BILLBOARD },
      { id: 'tabouret', kind: 'prop', pos: { x: 1, y: 1 }, ref: REF_BILLBOARD },
    ] as SceneEntity[];
    return scene;
  }

  /** Élément de PLANCHER de l'étage `z`, tel que la loi d'écran le reçoit du monde cuit. */
  const solAu = (z: number) => ({ kind: 'floor', key: `f:2,2,${z}`, cell: { x: 2, y: 2, z }, states: {} } as unknown as Parameters<KeepEl>[0]);

  /** Monte l'hôte sur la galerie et rend les DEUX sorties réelles : la loi d'écran et les décors
   *  billboard effectivement remis au monteur de quads. */
  function monter(scene: Scene, viewMode: 'iso' | 'top') {
    const loiSpy = vi.spyOn(sceneMeshes, 'applyCutawayMask');
    const bbSpy = vi.spyOn(sceneMeshes, 'collectBillboards');
    useGame.setState({
      scene, mode: 'exploration', partyPos: { x: 2, y: 2 }, party: [hero('h1', { x: 2, y: 2 })],
      battle: null, dialogue: null, flags: {}, viewMode,
    });
    container = document.createElement('div');
    root = createRoot(container);
    act(() => root!.render(<MondeDeCampagne />));
    return {
      loi: loiSpy.mock.calls[loiSpy.mock.calls.length - 1][1],
      billboards: bbSpy.mock.calls[bbSpy.mock.calls.length - 1][2].props,
    };
  }

  const étages = (els: readonly { cell: { z: number } }[]) => [...new Set(els.map((el) => el.cell.z))].sort();

  it('en iso, le plancher de l’étage est peint — donc son décor l’est aussi, volume ET billboard', () => {
    const scene = galerie();
    const { loi, billboards } = monter(scene, 'iso');
    const peints = [0, 1].filter((z) => loi(solAu(z)));
    expect(peints, 'aucune nappe à lever : les deux planchers se peignent').toEqual([0, 1]);
    // VOIE BILLBOARD : la population émise, étage par étage, est celle des planchers peints.
    expect(étages(billboards)).toEqual(peints);
    expect(billboards.map((el) => el.entId).filter(Boolean)).toEqual(expect.arrayContaining(['loge', 'tabouret']));
    // VOIE VOLUME : le même verdict, par la même loi, sur l'élément réel du builder.
    const lustre = propsBuilder.buildProps(scene).filter(estPropVolumique).find((el) => el.entId === 'lustre')!;
    expect(loi(lustre)).toBe(peints.includes(1));
  });

  it('en plan, l’étage du dessus n’est plus peint — et son décor disparaît des deux voies', () => {
    const scene = galerie();
    const { loi, billboards } = monter(scene, 'top');
    const peints = [0, 1].filter((z) => loi(solAu(z)));
    expect(peints, 'le plan isole le plancher du groupe').toEqual([0]);
    expect(étages(billboards)).toEqual(peints);
    const lustre = propsBuilder.buildProps(scene).filter(estPropVolumique).find((el) => el.entId === 'lustre')!;
    expect(loi(lustre)).toBe(false);
  });

  /**
   * CADENCE (#817, même maladie que `visualAllies`) : la loi d'écran connaît la CAMÉRA (`dims` est
   * dans la chaîne de `keepEl`), le décor émis ne la connaît pas. Les deux vérités ne peuvent donc pas
   * vivre dans le même mémo : un quart de tour rebâtirait tout le décor de la carte pour un verdict
   * inchangé. Mesuré sur les DEUX coutures réelles — l'émission (`buildProps`) et ce que le monteur de
   * quads reçoit (`collectBillboards`).
   */
  it('un cran de ROTATION ne rebâtit AUCUN décor — seule la loi d’écran se rejoue', () => {
    const scene = galerie();
    const spyBuild = vi.spyOn(propsBuilder, 'buildProps');
    const spyLoi = vi.spyOn(sceneMeshes, 'applyCutawayMask');
    useGame.setState({
      scene, mode: 'exploration', partyPos: { x: 2, y: 2 }, party: [hero('h1', { x: 2, y: 2 })],
      battle: null, dialogue: null, flags: {}, viewMode: 'iso', camRot: 0,
    });
    container = document.createElement('div');
    root = createRoot(container);
    act(() => root!.render(<MondeDeCampagne />));
    const derniereLoi = () => spyLoi.mock.calls[spyLoi.mock.calls.length - 1][1];
    const emissionsAuMontage = spyBuild.mock.calls.length;
    const loiAvant = derniereLoi();

    // Le cran de caméra se JOUE (le swap de `shownRot` tombe au creux de l'animation, 130 ms) : c'est
    // lui qui renouvelle `dims`, donc la loi d'écran.
    vi.useFakeTimers();
    try {
      act(() => { useGame.setState({ camRot: 1 }); });
      act(() => { vi.advanceTimersByTime(400); });
    } finally {
      vi.useRealTimers();
    }

    // La mesure MORD : le cran a bien renouvelé la LOI remise au monde cuit (sans quoi ce test ne
    // dirait rien de la cadence).
    expect(derniereLoi(), 'le cran renouvelle la loi d’écran').not.toBe(loiAvant);
    // …et l'ÉMISSION, elle, n'a pas rejoué : aucun scan de scène pour une caméra.
    expect(spyBuild.mock.calls.length).toBe(emissionsAuMontage);
    // Le verdict, lui, n'a pas bougé d'un cran à l'autre : les deux planchers restent peints.
    expect([0, 1].filter((z) => derniereLoi()(solAu(z)))).toEqual([0, 1]);
  });

  /** La MÊME galerie, COIFFÉE : une masse dont le couvercle est à l'étage 1 et dont le volume descend
   *  au rez (`levels: 2`), donc le groupe est DESSOUS — le couvercle au-dessus des têtes tombe. */
  function galerieCoiffée(): Scene {
    const scene = galerie();
    scene.architecture = [{
      id: 'corps-opera',
      style: 'auberge',
      storeys: [{ id: 'z0', z: 0, parts: [], roomZoneIds: [] }],
      facades: [],
      masses: [{ id: 'salle', z: 1, footprint: [{ x: 0, y: 0, w: 6, h: 6 }], levels: 2, profile: 'gable', ridge: 'x', pitchDeg: 30, material: 'tuile' }],
    }];
    return scene;
  }

  it('COUVERCLE au-dessus des têtes : l’étage cesse d’être peint, et son décor part avec son plancher', () => {
    const scene = galerieCoiffée();
    const { loi, billboards } = monter(scene, 'iso');
    const peints = [0, 1].filter((z) => loi(solAu(z)));
    expect(peints, 'le groupe est SOUS le couvercle : l’étage 1 se retire').toEqual([0]);
    // C'est ici que la loi d'ÉCRAN porte seule : aucun isolement (`viewZ`) n'est demandé au builder.
    expect(étages(billboards)).toEqual(peints);
    const lustre = propsBuilder.buildProps(scene).filter(estPropVolumique).find((el) => el.entId === 'lustre')!;
    expect(loi(lustre)).toBe(false);
  });

  /** Sommets que l'INDEX DE DESSIN compacté désigne encore, groupe par groupe : exactement ce que le
   *  rayon de picking parcourt (`Mesh.raycast` suit l'index dans les plages de groupe), donc exactement
   *  ce qu'une plage de décor (`propVertexRanges`) peut encore nommer. */
  function sommetsDessinés(geometry: sceneMeshes.WorldGeometry): Set<number> {
    const index = geometry.getIndex()!;
    const vus = new Set<number>();
    for (const g of geometry.groups) for (let i = g.start; i < g.start + g.count; i++) vus.add(index.getX(i));
    return vus;
  }
  /** Le décor `entId` garde-t-il un sommet visable après le masque ? */
  function visable(geometry: sceneMeshes.WorldGeometry, entId: string): boolean {
    const dessinés = sommetsDessinés(geometry);
    return geometry.userData.propVertexRanges.some((r) => r.entId === entId
      && [...Array(r.vertexCount).keys()].some((k) => dessinés.has(r.vertexStart + k)));
  }

  it.each([['iso', true], ['top', false]] as const)(
    'PICKING (%s) : un décor volumique n’est visable que si la loi d’écran le peint',
    (viewMode, attendu) => {
      const scene = galerie();
      const { loi } = monter(scene, viewMode);
      const baked = sceneMeshes.bakeWorldGeometry(scene, sceneMetresPerTile(scene), 'jeu');
      const { geometry } = sceneMeshes.applyCutawayMask(baked, loi);
      expect(visable(geometry, 'lustre')).toBe(attendu);
    },
  );
});
