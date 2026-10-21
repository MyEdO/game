// @vitest-environment jsdom
/**
 * Les helpers de recette qui lisent le DOM monté : `__wfrp.areteScreenPos` (le trait de prise du
 * peintre d'arêtes, `gameIso/stage/AreteOverlay`) et `__wfrp.editorWorldMap` (le brouillon de carte du
 * monde publié au pont de l'éditeur, `state/editeurBridge`).
 */
import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { buildApi, setDialogueProbe, setCodexProbe } from './devtools';
import { categoryByKey } from '../ui/compendium/registry';
import { dialogueDuDessus, useDismissLayer, resetDismissLayers } from '../ui/useDismissLayer';
import { useRef } from 'react';
import { getStagePan, poserPan, resetStagePan } from './stagePan';
import { stageCamAffine } from '../gameIso/stage/stageCam';
import { useGame } from './store';
import { viewYawDeg, poserYaw, resetStageYaw, SENSIBILITE_DRAG_DEG_PX, lacetActif, demarrerLacet } from './stageYaw';
import { AreteOverlay } from '../gameIso/stage/AreteOverlay';
import { scèneÀDeuxPièces, aretesDePortes } from '../gameIso/stage/arete-dans-la-chaine.fixture';
import { Editor } from '../ui/editor/Editor';
import { emptyScene } from '../noyau/monde/scene';
import { __setFabriqueIdbForTest } from '../web/indexedDb';
import { brancherBasesSimulees } from '../web/indexedDb.testkit';
import { tileEdge, screenToTileF, type Dims } from '../geometry/iso';
import { canonEdge } from '../noyau/sceneEdit';
import { nearestEdge } from '../ui/editor/editorState';

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

let root: Root | null = null;
let container: HTMLDivElement | null = null;
afterEach(async () => {
  await act(async () => { root?.unmount(); });
  container?.remove();
  root = null;
  container = null;
  useGame.setState({ scene: null });
  __setFabriqueIdbForTest(null);
  setDialogueProbe(null);
  setCodexProbe(null);
  resetStageYaw();
  resetDismissLayers();
  resetStagePan();
  vi.unstubAllGlobals();
});

async function monter(el: React.ReactElement): Promise<HTMLDivElement> {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => { root!.render(el); });
  return container;
}

describe('__wfrp — observation du Codex et de la caméra', () => {
  const brancherCodex = () => setCodexProbe((id) => {
    const cat = categoryByKey(id);
    return cat ? { tab: cat.label, group: cat.group, cluster: cat.cluster ?? null } : null;
  });

  it('localise skills et weather par le registre vivant, en copie détachée et sans changer l’état', () => {
    brancherCodex();
    const api = buildApi();
    const avant = useGame.getState();
    expect(api.codexLocate('skills')).toEqual({ tab: 'Compétences', group: 'Compétences', cluster: null });
    expect(api.codexLocate('weather')).toEqual({ tab: 'Météo de voyage', group: 'Tables', cluster: 'Voyage terrestre' });
    const copie = api.codexLocate('skills');
    copie.tab = 'copie';
    expect(api.codexLocate('skills').tab).toBe(categoryByKey('skills')!.label);
    const stable = api.codexLocate('skills');
    setCodexProbe(() => stable);
    const detachee = api.codexLocate('skills');
    detachee.tab = 'copie';
    expect(stable.tab).toBe(categoryByKey('skills')!.label);
    expect(useGame.getState()).toBe(avant);
  });

  it('refuse une catégorie inconnue en la nommant sans changer l’état', () => {
    brancherCodex();
    const avant = useGame.getState();
    expect(() => buildApi().codexLocate('absent-recette')).toThrow(/codexLocate.*absent-recette/);
    expect(useGame.getState()).toBe(avant);
  });

  it('observe le lacet cranté et continu et la sensibilité canonique sans stage ni écriture', () => {
    useGame.setState({ scene: null, camRot: 1, camEdge: true });
    poserYaw(17.5);
    const avant = useGame.getState();
    expect(buildApi().camera()).toEqual({ deg: 152.5, active: lacetActif(), sensibilite: SENSIBILITE_DRAG_DEG_PX });
    expect(useGame.getState()).toBe(avant);
    poserYaw(-30);
    expect(buildApi().camera().deg).toBe(105);
    vi.stubGlobal('requestAnimationFrame', () => 1);
    demarrerLacet(1);
    expect(buildApi().camera().active).toBe(true);
    expect(useGame.getState()).toBe(avant);
  });
});

describe('__wfrp — observation du dialogue et panoramique #1561', () => {
  it('désigne la boîte modale supérieure réelle par plan, ignore les popovers et renouvelle la marque éphémère', async () => {
    function Couche({ kind, plan, popover = false }: { kind: string; plan: 'scene' | 'application'; popover?: boolean }) {
      const boite = useRef<HTMLDivElement>(null);
      useDismissLayer({ kind, plan, nature: popover ? 'popover' : 'modale', boite }, null);
      return <div ref={boite} role={popover ? undefined : 'dialog'} aria-label={kind}>{kind}</div>;
    }
    setDialogueProbe(dialogueDuDessus);
    expect(buildApi().dialogueDuDessus()).toBeNull();
    const c = await monter(<><Couche kind="conversation" plan="scene" /><Couche kind="fiche" plan="application" /><Couche kind="bulle" plan="application" popover /></>);
    const dessus = buildApi().dialogueDuDessus()!;
    expect(dessus).toEqual({ kind: 'fiche', plan: 'application', nom: 'fiche', selecteur: '[data-wfrp-dialogue-dessus]' });
    expect(c.querySelectorAll(dessus.selecteur)).toHaveLength(1);
    expect(c.querySelector(dessus.selecteur)?.getAttribute('aria-label')).toBe('fiche');
    await act(async () => { root!.render(<Couche kind="conversation" plan="scene" />); });
    expect(buildApi().dialogueDuDessus()).toMatchObject({ kind: 'conversation', plan: 'scene' });
    expect(c.querySelectorAll(dessus.selecteur)).toHaveLength(1);
    await act(async () => { root!.render(null); });
    expect(buildApi().dialogueDuDessus()).toBeNull();
    expect(document.querySelector(dessus.selecteur)).toBeNull();
  });

  it('panTo convertit le centre via CTM au pan vivant, mesure le rendu, et refuse la rotation transitoire', async () => {
    vi.stubGlobal('DOMPoint', class {
      constructor(public x: number, public y: number) {}
      matrixTransform(m: { a: number; b: number; c: number; d: number; e: number; f: number }) {
        return { x: m.a * this.x + m.c * this.y + m.e, y: m.b * this.x + m.d * this.y + m.f };
      }
    });
    vi.stubGlobal('requestAnimationFrame', (fn: FrameRequestCallback) => { fn(0); return 1; });
    useGame.setState({ scene: emptyScene('scene-test', 8, 8), camRot: 0, camEdge: false, camPan: { x: 10, y: 20 } });
    poserPan(40, 70);
    const c = await monter(<svg className="iso-stage"><g style={{ opacity: 1 }} /></svg>);
    const svg = c.querySelector('svg')!;
    const group = c.querySelector('g')!;
    svg.getBoundingClientRect = () => ({ x: 60, y: 90, width: 500, height: 300 }) as DOMRect;
    const st = useGame.getState();
    const dims: Dims = { ...st.scene!.dimensions, rot: st.camRot, view: st.viewMode, edge: st.camEdge, yawDeg: viewYawDeg(st.camRot, st.camEdge) };
    const corner = (await import('../geometry/iso')).diamondCorners(3, 4, dims, 0);
    const tx = (corner.top[0] + corner.bot[0]) / 2, ty = (corner.top[1] + corner.bot[1]) / 2;
    group.getScreenCTM = () => {
      const committed = useGame.getState().camPan;
      const pan = committed.x === 10 && committed.y === 20 ? { x: 40, y: 70 } : committed;
      const affine = stageCamAffine(pan, 2);
      const a = affine.k * 1.3, d = affine.k * 0.8;
      const e = 60 + affine.tx * 1.3, f = 90 + affine.ty * 0.8;
      return { a, b: 0, c: 0, d, e, f, inverse: () => ({ a: 1 / a, b: 0, c: 0, d: 1 / d, e: -e / a, f: -f / d }) } as DOMMatrix;
    };
    const initial = group.getScreenCTM()!;
    const expectedPan = { x: 40 + (310 - initial.e) / initial.a - tx, y: 70 + (240 - initial.f) / initial.d - ty };
    const position = buildApi().tileScreenPos({ x: 3, y: 4, z: 0.5 })!;
    expect(Object.keys(position).sort()).toEqual(['height', 'width', 'x', 'y']);
    expect(Object.values(position).every(Number.isFinite)).toBe(true);
    const cameraAvant = { ...useGame.getState().camPan };
    for (const tile of [7, { x: NaN, y: 4 }, { x: 3, y: Infinity }, { x: 3, y: 4, z: NaN }, { x: 3, y: 4, z: Infinity }]) {
      expect(() => buildApi().tileScreenPos(tile as { x: number; y: number; z?: number })).toThrow(/tileScreenPos.*coordonnées invalides/);
      expect(useGame.getState().camPan).toEqual(cameraAvant);
    }
    for (const z of [NaN, Infinity, -Infinity]) {
      const before = { ...useGame.getState().camPan };
      try {
        const refusal = await buildApi().panTo({ x: 3, y: 4, z }).then(() => null, (e: unknown) => e);
        expect(useGame.getState().camPan).toEqual(before);
        expect(refusal).toBeInstanceOf(Error);
        expect((refusal as Error).message).toContain('coordonnées invalides');
      } finally {
        useGame.setState({ camPan: before });
      }
    }
    const out = await buildApi().panTo({ x: 3, y: 4 });
    expect(out.pan.x).toBeCloseTo(expectedPan.x);
    expect(out.pan.y).toBeCloseTo(expectedPan.y);
    expect(out.centre.x).toBeCloseTo(310);
    expect(out.centre.y).toBeCloseTo(240);
    group.style.opacity = '0.6';
    await expect(buildApi().panTo({ x: 3, y: 4 })).rejects.toThrow(/rotation en cours/);
    await expect(buildApi().panTo('absent')).rejects.toThrow(/cible/);
  });

  it.each(['focale', 'reset'] as const)('panTo mesure et corrige le rendu pendant une évolution de %s', async (evolution) => {
    vi.stubGlobal('DOMPoint', class {
      constructor(public x: number, public y: number) {}
      matrixTransform(m: { a: number; b: number; c: number; d: number; e: number; f: number }) {
        return { x: m.a * this.x + m.c * this.y + m.e, y: m.b * this.x + m.d * this.y + m.f };
      }
    });
    useGame.setState({ scene: emptyScene('scene-test', 8, 8), camRot: 0, camEdge: false, camPan: { x: 10, y: 20 } });
    poserPan(40, 70);
    const c = await monter(<svg className="iso-stage"><g style={{ opacity: 1 }} /></svg>);
    const svg = c.querySelector('svg')!;
    const group = c.querySelector('g')!;
    svg.getBoundingClientRect = () => ({ x: 60, y: 90, width: 500, height: 300 }) as DOMRect;
    let frame = 0;
    let focal = { x: 0, y: 0 };
    let resetApplique = false;
    vi.stubGlobal('requestAnimationFrame', (fn: FrameRequestCallback) => {
      frame++;
      const committed = useGame.getState().camPan;
      const live = getStagePan();
      poserPan(live.x + (committed.x - live.x) * 0.25, live.y + (committed.y - live.y) * 0.25);
      if (evolution === 'focale') focal = { x: Math.min(frame, 18) * 5, y: Math.min(frame, 18) * 2.5 };
      if (evolution === 'reset' && frame === 7) {
        useGame.getState().setCamPan(0, 0);
        poserPan(0, 0);
        resetApplique = true;
      }
      fn(frame);
      return frame;
    });
    group.getScreenCTM = () => {
      const pan = getStagePan();
      const affine = stageCamAffine({ x: pan.x + focal.x, y: pan.y + focal.y }, 2);
      const a = affine.k * 1.3, d = affine.k * 0.8;
      const e = 60 + affine.tx * 1.3, f = 90 + affine.ty * 0.8;
      return { a, b: 0, c: 0, d, e, f, inverse: () => ({ a: 1 / a, b: 0, c: 0, d: 1 / d, e: -e / a, f: -f / d }) } as DOMMatrix;
    };
    const api = buildApi();
    const out = await api.panTo({ x: 3, y: 4 });
    const observed = api.tileScreenPos({ x: 3, y: 4 })!;
    expect(Math.hypot(observed.x + observed.width / 2 - 310, observed.y + observed.height / 2 - 240)).toBeLessThanOrEqual(2);
    expect(out.centre.x).toBeCloseTo(observed.x + observed.width / 2);
    expect(out.centre.y).toBeCloseTo(observed.y + observed.height / 2);
    expect(frame).toBeLessThanOrEqual(122);
    if (evolution === 'focale') expect(focal).toEqual({ x: 90, y: 45 });
    else expect(resetApplique).toBe(true);
  });
});

describe('__wfrp.areteScreenPos — le trait de prise du peintre, au pixel (#2306)', () => {
  it('rend le centre ÉCRAN du trait de l’arête visée, quel que soit le côté nommé, et son libellé', async () => {
    const scene = scèneÀDeuxPièces();
    useGame.setState({ scene });
    const st = useGame.getState();
    const dims: Dims = { ...scene.dimensions, rot: st.camRot, view: st.viewMode, edge: st.camEdge, yawDeg: viewYawDeg(st.camRot, st.camEdge) };
    const aretes = aretesDePortes(scene, dims);
    const porte = aretes.find(({ arete }) => arete.x === 3 && arete.y === 2)!;
    const c = await monter(
      <svg className="iso-stage"><g>
        <AreteOverlay aretes={aretes} areteSurvolee={null} activerArete={() => {}} onFocusArete={() => {}} onBlurArete={() => {}} />
      </g></svg>,
    );
    // jsdom ne mise rien en page : la boîte d'un trait est celle de ses attributs (repère identité).
    for (const l of c.querySelectorAll('line[data-arete-cible]')) {
      const n = (k: string) => Number(l.getAttribute(k));
      l.getBoundingClientRect = () => {
        const x = Math.min(n('x1'), n('x2')), y = Math.min(n('y1'), n('y2'));
        return { x, y, width: Math.abs(n('x2') - n('x1')), height: Math.abs(n('y2') - n('y1')) } as DOMRect;
      };
    }
    const attendu = [{ x: (porte.a.cx + porte.b.cx) / 2, y: (porte.a.cy + porte.b.cy) / 2, libelle: porte.arete.libelle, capacite: 'porte' }];
    expect(buildApi().areteScreenPos(3, 2, 0, 'E')).toEqual(attendu);
    expect(buildApi().areteScreenPos(4, 2, 0, 'O'), 'le O de la case voisine est la même arête').toEqual(attendu);
    expect(buildApi().areteScreenPos(1, 1, 0, 'N')).toMatch(/^✗ aucune arête utilisable/);
  });

  it('stage non monté, ou hors scène : refus nommés', () => {
    expect(buildApi().areteScreenPos(0, 0, 0, 'N')).toBe('✗ aucune scène');
    useGame.setState({ scene: emptyScene('scene-test', 4, 4) });
    expect(buildApi().areteScreenPos(0, 0, 0, 'N')).toMatch(/^✗ stage non monté/);
  });
});

describe('__wfrp.editorWorldMap — le brouillon de carte du monde, par le pont d’intention (#2306)', () => {
  it('rend lieux et routes par id, `when` et `refus` compris, en COPIE détachée', async () => {
    brancherBasesSimulees();
    const api = buildApi();
    const entree = api.projectMinimal('carte-recette', 'Carte de recette');
    const scene = entree.startSceneId;
    const when = { kind: 'flag' as const, expr: 'pont-repare' };
    entree.project.worldMap = {
      id: 'carte', label: 'Carte',
      places: [
        { id: 'a', label: 'Village', pos: { x: 10, y: 10 }, scene },
        { id: 'b', label: 'Bourg', pos: { x: 60, y: 40 }, scene, when: { kind: 'flag', expr: 'bourg-connu' } },
      ],
      routes: [
        { id: 'r-ouverte', a: 'a', b: 'b', km: 12, modes: ['pied'] },
        { id: 'r-gatee', a: 'b', b: 'a', km: 20, modes: ['pied'], when, refus: { texte: 'Le pont est effondré.' } },
      ],
    };
    expect(await api.projectSave(entree)).toMatch(/^✓/);
    await monter(<Editor initialScene={emptyScene('scene-test', 4, 4)} />);
    let ouvert: unknown;
    await act(async () => { ouvert = await api.editorOpen('carte-recette'); });
    expect(ouvert).toMatch(/^✓/);
    const lue = (await api.editorWorldMap())!;
    expect(lue).toEqual({
      id: 'carte', label: 'Carte',
      lieux: [
        { id: 'a', label: 'Village', scene, pos: { x: 10, y: 10 } },
        { id: 'b', label: 'Bourg', scene, pos: { x: 60, y: 40 }, when: { kind: 'flag', expr: 'bourg-connu' } },
      ],
      routes: [
        { id: 'r-ouverte', a: 'a', b: 'b', km: 12 },
        { id: 'r-gatee', a: 'b', b: 'a', km: 20, when, refus: 'Le pont est effondré.' },
      ],
    });
    expect(Object.keys(lue.routes[0]), 'route ouverte : ni `when` ni `refus`, pas même à undefined').toEqual(['id', 'a', 'b', 'km']);
    (lue.routes[1].when as { expr: string }).expr = 'trafique';
    expect((await api.editorWorldMap())!.routes[1].when, 'muter la lecture ne touche pas le brouillon').toEqual(when);

    // Une édition de la CARTE seule (scène inchangée) se lit aussitôt : la commande republiée suit la carte.
    const ouvrirCarte = [...container!.querySelectorAll('button')].find((b) => b.title === 'Carte du monde du projet : lieux, routes, voyage')!;
    await act(async () => { ouvrirCarte.click(); });
    const nom = [...container!.querySelectorAll('.wme-inspector label.ed-field')].find((l) => l.textContent?.startsWith('Nom'))!.querySelector('input')!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(nom, 'Carte renommée');
      nom.dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect((await api.editorWorldMap())!.label).toBe('Carte renommée');
  });

  it('projet sans carte du monde : `null`', async () => {
    await monter(<Editor initialScene={emptyScene('scene-test', 4, 4)} />);
    expect(await buildApi().editorWorldMap()).toBeNull();
  });
});

describe('__wfrp.editorAreteScreenPos — viser une arête au pixel dans le canevas de l’ÉDITEUR (#2404)', () => {
  const ctmOrigine = SVGSVGElement.prototype.getScreenCTM;
  afterEach(() => { SVGSVGElement.prototype.getScreenCTM = ctmOrigine; });

  it('rend le point ÉCRAN du milieu de l’arête, que l’outil murs résout en CETTE arête', async () => {
    const m = { a: 2, b: 0, c: 0, d: 2, e: 10, f: 20 };
    SVGSVGElement.prototype.getScreenCTM = () => m as DOMMatrix;
    const scene = emptyScene('scene-test', 6, 6);
    await monter(<Editor initialScene={scene} />);
    const pos = await buildApi().editorAreteScreenPos(2, 3, 0, 'S');
    if (typeof pos === 'string') throw new Error(pos);
    const dims: Dims = { ...scene.dimensions, rot: 0, view: 'top' };
    const [a, b] = tileEdge(2, 4, 'N', dims, 0);
    expect(pos).toEqual({ x: m.a * (a.cx + b.cx) / 2 + m.e, y: m.d * (a.cy + b.cy) / 2 + m.f });
    const f = screenToTileF((pos.x - m.e) / m.a, (pos.y - m.f) / m.d, dims, 0);
    const px = Math.round(f.x), py = Math.round(f.y);
    expect(canonEdge(px, py, nearestEdge(f.x - px, f.y - py)), 'le pixel rendu retombe sur l’arête visée').toEqual(canonEdge(2, 3, 'S'));
  });

  it('pont vide : rejet NOMMÉ portant ce helper', async () => {
    await expect(buildApi().editorAreteScreenPos(0, 0, 0, 'N', 50)).rejects.toThrow('editorAreteScreenPos');
  });
});
