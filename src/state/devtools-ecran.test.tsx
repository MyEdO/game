// @vitest-environment jsdom
/**
 * Les helpers de recette qui lisent le DOM monté : `__wfrp.areteScreenPos` (le trait de prise du
 * peintre d'arêtes, `gameIso/stage/AreteOverlay`) et `__wfrp.editorWorldMap` (le brouillon de carte du
 * monde publié au pont de l'éditeur, `state/editeurBridge`).
 */
import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { buildApi } from './devtools';
import { useGame } from './store';
import { viewYawDeg } from './stageYaw';
import { AreteOverlay } from '../gameIso/stage/AreteOverlay';
import { scèneÀDeuxPièces, aretesDePortes } from '../gameIso/stage/arete-dans-la-chaine.fixture';
import { Editor } from '../ui/editor/Editor';
import { emptyScene } from './scene';
import { __setFabriqueIdbForTest } from '../lib/indexedDb';
import { brancherBasesSimulees } from '../lib/indexedDb.testkit';
import { tileEdge, screenToTileF, type Dims } from '../geometry/iso';
import { canonEdge } from './sceneEdit';
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
});

async function monter(el: React.ReactElement): Promise<HTMLDivElement> {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => { root!.render(el); });
  return container;
}

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
    useGame.setState({ scene: emptyScene(4, 4) });
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
    await monter(<Editor initialScene={emptyScene(4, 4)} />);
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
    await monter(<Editor initialScene={emptyScene(4, 4)} />);
    expect(await buildApi().editorWorldMap()).toBeNull();
  });
});

describe('__wfrp.editorAreteScreenPos — viser une arête au pixel dans le canevas de l’ÉDITEUR (#2404)', () => {
  const ctmOrigine = SVGSVGElement.prototype.getScreenCTM;
  afterEach(() => { SVGSVGElement.prototype.getScreenCTM = ctmOrigine; });

  it('rend le point ÉCRAN du milieu de l’arête, que l’outil murs résout en CETTE arête', async () => {
    const m = { a: 2, b: 0, c: 0, d: 2, e: 10, f: 20 };
    SVGSVGElement.prototype.getScreenCTM = () => m as DOMMatrix;
    const scene = emptyScene(6, 6);
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
