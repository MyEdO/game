// @vitest-environment jsdom
/**
 * MARQUEURS D'ARÊTE = VERDICT DE L'ACTION (#700, #2190) — l'hôte RÉEL (`MondeDeCampagne`) n'offre un
 * geste d'arête que si `gesteDArete` (`state/gesteDArete.ts`) l'accepte : afficher et agir ne peuvent pas
 * répondre différemment. POINT D'OBSERVATION : l'offre que l'écran publie (`getStageFrame().aretes()`),
 * celle que le picking consulte.
 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { emptyScene, type Scene } from '../../state/scene';
import { useGame } from '../../state/store';
import { createHero } from '../../engine/character';
import { engage } from '../../engine/engagement';
import { placeCombatant } from '../../state/spawn';
import { testScene } from '../../scenes/test-fixture';
import { MondeDeCampagne } from './MondeDeCampagne';
import { setStageRendererFactory } from './GameStage3D';
import { getStageFrame } from './spritePicker';
import { BancRenderer, brancherArdoise, respirer, simulerRasterisation, viderCaptures } from './banc-volumique';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const TAILLE = { w: 800, h: 600 };
let root: Root | null = null;
let hôte: HTMLDivElement | null = null;
const NET0 = useGame.getState().net;

brancherArdoise();

beforeAll(() => {
  Object.defineProperty(HTMLCanvasElement.prototype, 'clientWidth', { configurable: true, get: () => TAILLE.w });
  Object.defineProperty(HTMLCanvasElement.prototype, 'clientHeight', { configurable: true, get: () => TAILLE.h });
  setStageRendererFactory(() => new BancRenderer());
});
afterAll(() => setStageRendererFactory(null));

beforeEach(() => { simulerRasterisation(); });
afterEach(() => {
  if (root) { act(() => root!.unmount()); root = null; }
  if (hôte) { hôte.remove(); hôte = null; }
  vi.clearAllTimers();
  vi.useRealTimers();
  useGame.setState({ net: NET0, battle: null, dialogue: null });
});

/** Corniche : la rangée y=0 à 4 m, le reste au sol ; depuis (2,0), le cardinal SUD est une `chute`. */
function corniche(): Scene {
  const s = emptyScene(5, 4);
  const h = new Array(20).fill(0) as number[];
  for (let x = 0; x < 5; x += 1) h[x] = 4;
  s.layers[0].height = h;
  return s;
}
const sommet = { x: 2, y: 0 };

async function monter(): Promise<void> {
  viderCaptures();
  hôte = document.createElement('div');
  document.body.appendChild(hôte);
  root = createRoot(hôte);
  await act(async () => { root!.render(<MondeDeCampagne />); });
  await respirer(40);
}

const capacites = (): string[] => (getStageFrame()?.aretes() ?? []).map((p) => p.arete.capacite);

/** Combat : l'actif (héros, ou le premier ennemi si `actif = 'enemy'`) posté au sommet de la corniche. */
function combat(actif: 'hero' | 'enemy' = 'hero') {
  vi.useFakeTimers();
  const hero = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', seed: 1 });
  useGame.setState({ party: [hero], net: NET0, battle: null });
  useGame.getState().startScene(testScene());
  useGame.getState().startCombat('enc-mutants');
  useGame.getState().confirmRoundStart();
  vi.clearAllTimers();
  vi.useRealTimers(); // `respirer` attend en temps réel
  const sc = corniche();
  const b = useGame.getState().battle!;
  const H = b.combatants.find((c) => c.kind === 'hero')!;
  const foes = b.combatants.filter((c) => c.kind === 'enemy');
  foes.forEach((e, i) => { e.engagedWith = []; placeCombatant(e, sc, { x: 4, y: 3 - i }); });
  H.engagedWith = [];
  const mobile = actif === 'hero' ? H : foes[0];
  placeCombatant(mobile, sc, sommet);
  if (actif === 'enemy') placeCombatant(H, sc, { x: 0, y: 3 });
  useGame.setState({
    screen: 'campaign', scene: sc, mode: 'battle', dialogue: null, explored: {}, facing: {}, camRot: 0, viewMode: 'iso', camEdge: false, povActive: false,
    battle: { ...b, turn: b.order.indexOf(mobile.id), action: null, movementUsed: 0, acted: false, movedPreAction: false, reachable: new Map(), preview: null },
  } as never);
  return { H, foe: foes[0] };
}

describe('marqueurs de geste d’arête — l’écran monté répond comme l’action', () => {
  it('exploration : la chute est offerte, et ne l’est plus sous un dialogue ouvert', async () => {
    const hero = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', seed: 1 });
    useGame.setState({
      screen: 'campaign', scene: corniche(), mode: 'exploration', partyPos: sommet, party: [hero], battle: null, dialogue: null,
      explored: {}, facing: {}, camRot: 0, viewMode: 'iso', camEdge: false, povActive: false,
    } as never);
    await monter();
    expect(capacites(), 'prémisse : la corniche offre sa chute').toContain('chute');
    await act(async () => { useGame.setState({ dialogue: {} as never }); });
    await respirer(10);
    expect(capacites()).not.toContain('chute');
  });

  it('combat : héros actif ENGAGÉ → aucune chute offerte (l’action la refuse)', async () => {
    const { H, foe } = combat();
    await monter();
    expect(capacites(), 'prémisse : l’actif libre voit sa chute').toContain('chute');
    await act(async () => {
      const b = useGame.getState().battle!;
      engage(b.combatants.find((c) => c.id === H.id)!, b.combatants.find((c) => c.id === foe.id)!);
      useGame.setState({ battle: { ...b } });
    });
    await respirer(10);
    expect(capacites()).not.toContain('chute');
  });

  it('combat : ennemi mené par le siège MJ LOCAL → la chute est offerte (le siège le mène, `controlsCombatant`)', async () => {
    combat('enemy');
    useGame.setState({ net: { ...NET0, mode: 'host', mySeat: 0, gmSeat: 0, ownership: {}, slots: [0, 0, 0, 0] } });
    await monter();
    expect(capacites()).toContain('chute');
  });

  it('combat : ennemi mené par un AUTRE siège (MJ distant) → aucune chute offerte', async () => {
    combat('enemy');
    useGame.setState({ net: { ...NET0, mode: 'host', mySeat: 0, gmSeat: 1, ownership: {}, slots: [0, 1, 0, 0] } });
    await monter();
    expect(capacites()).not.toContain('chute');
  });
});
