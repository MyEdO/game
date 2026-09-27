// @vitest-environment jsdom
/**
 * VOILE D'ENTRÉE EN SCÈNE — DÉMONTAGE PENDANT LE VOL (#1680).
 *
 * Le montage d'une scène demande ses textures à la file cadencée du cuiseur, et chacune revient plus
 * tard par l'une de ses DEUX issues — résolue ou rejetée. Les deux servent le voile
 * (`servirEntrée`) : un sujet perdu n'entrera jamais en scène, il ne peut pas retenir l'écran voilé.
 *
 * Ce banc tient les deux faits que cette symétrie impose :
 *  1. TÉMOIN POSITIF — sur un écran MONTÉ, ces deux issues font bien tomber le voile ; c'est la
 *     chaîne que le fait 2 doit voir coupée, et sans elle il serait vrai du vide ;
 *  2. DÉMONTÉ, plus rien du voile ne s'exécute : ni pose d'état sur un composant qui n'est plus là,
 *     ni erreur non gérée.
 *
 * Panne mesurée en face (CI de `main`, run 33719038837) : `ReferenceError: window is not defined`
 * levée APRÈS le teardown jsdom du fichier de test voisin, pile
 * `finirEntrée` ← `jugerEntrée` ← `servirEntrée` ← le rejet d'une texture de billboard ←
 * `dispatchSetState` — la suite passait ses 1599 fichiers et sortait quand même en 1 (« Errors 1 »).
 * Le fait 2 reproduit cette condition-là : l'environnement du composant démonté est rendu
 * INACCESSIBLE (le global `window` lève, comme après un teardown), puis les deux issues sont servies.
 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { emptyScene, sceneMetresPerTile, type Scene } from '../../state/scene';
import type { BillboardPropEl } from '../builders/types';
import type { ActorPose, KeepEl, SceneBillboardEls, TintAt } from '../backends/webgl/sceneMeshes';
import { AMBIANCE } from '../catalog/ambiance';
import { GameStage3D, setStageRendererFactory, type StageFrame, type StageWalkAnim } from './GameStage3D';
import {
  BancRenderer,
  PLAFOND_ATTENTE_MS,
  PLAFOND_HORS_ATTEINTE_MS,
  attendreQue,
  brancherArdoise,
  canevas,
  respirer as respirerBanc,
  simulerRasterisation,
  viderCaptures,
  type Rasterisation,
} from './banc-volumique';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.setConfig({ testTimeout: PLAFOND_ATTENTE_MS + 10_000 });

const TAILLE = { w: 800, h: 600 };
const SCENE: Scene = emptyScene(40, 40);
const MPT = sceneMetresPerTile(SCENE);
/** Le GROUPE au milieu de la carte : les décors posés à côté de lui sont DANS le rayon d'entrée
 *  (`AMBIANCE.entreeEnScene.rayonM`), donc ce sont eux qui tiennent le voile levé. */
const GROUPE = { x: 20, y: 20 };

const TINT: TintAt = () => 1;
const KEEP: KeepEl = () => true;
const SANS_ACTEUR: ActorPose[] = [];

const décor = (id: string, x: number): BillboardPropEl => ({
  kind: 'prop', source: 'entity', key: `prop:${id}`, entId: id, span: { w: 1, h: 1 }, ref: 'tonneau', facing: 'S',
  cell: { x, y: GROUPE.y, z: 0 }, foot: { offX: 0, offY: 0, scale: 1 },
  states: { visible: true },
});

/** Deux décors PROCHES : deux textures en vol au même instant — de quoi servir les DEUX issues
 *  (résolution et rejet) sur le même écran. */
const DEUX_PROCHES: SceneBillboardEls = { tokens: [], props: [décor('près1', GROUPE.x + 1), décor('près2', GROUPE.x + 2)] };

const cadrePov = (): StageFrame => ({ mode: 'pov', partyPos: GROUPE, facing: 'N', indoor: false, cid: null });

let root: Root | null = null;
let hôte: HTMLDivElement | null = null;
let battre: (() => void) | null = null;
let ras!: Rasterisation;

brancherArdoise();

const anim: StageWalkAnim = {
  subscribe: (onFrame) => { battre = onFrame; return () => { battre = null; }; },
  glide: () => null,
  cam: () => ({ x: GROUPE.x, y: GROUPE.y }),
};

const plafondNominal = AMBIANCE.entreeEnScene.plafondMs;
const attendre = (fait: () => boolean): Promise<void> => attendreQue(fait, PLAFOND_ATTENTE_MS, () => battre?.());
const voileLevé = (): boolean => !!canevas(hôte!).dataset.voile;

function monter(états: boolean[]): void {
  viderCaptures();
  hôte = document.createElement('div');
  document.body.appendChild(hôte);
  root = createRoot(hôte);
  act(() => {
    root!.render(
      <GameStage3D
        scene={SCENE}
        mpt={MPT}
        frame={cadrePov()}
        tintAt={TINT}
        keepEl={KEEP}
        els={DEUX_PROCHES}
        actors={SANS_ACTEUR}
        gameTime={720}
        lightLevel={1}
        lights={[]}
        anim={anim}
        onEntreeEnScene={(v) => états.push(v)}
      />,
    );
  });
}

beforeAll(() => {
  Object.defineProperty(HTMLCanvasElement.prototype, 'clientWidth', { configurable: true, get: () => TAILLE.w });
  Object.defineProperty(HTMLCanvasElement.prototype, 'clientHeight', { configurable: true, get: () => TAILLE.h });
  setStageRendererFactory(() => new BancRenderer());
});
afterAll(() => setStageRendererFactory(null));

beforeEach(() => {
  // IMAGES RETENUES : ce banc choisit l'instant de chaque issue, et laquelle.
  ras = simulerRasterisation('retenue');
  // Le plafond de sécurité est poussé hors d'atteinte : le voile ne tombe plus tout seul — ce qui le
  // fait tomber (fait 1) comme ce qui doit ne plus rien pouvoir (fait 2) n'a qu'une cause possible.
  AMBIANCE.entreeEnScene.plafondMs = PLAFOND_HORS_ATTEINTE_MS;
});
afterEach(() => {
  AMBIANCE.entreeEnScene.plafondMs = plafondNominal;
  if (root) { act(() => root!.unmount()); root = null; }
  if (hôte) { hôte.remove(); hôte = null; }
  battre = null;
});

/**
 * Sert les issues des images retenues — la PREMIÈRE par son REJET, les suivantes par résolution —
 * jusqu'à la tombée du voile. Le budget est un compte de TOURS, jamais une fenêtre de mur : une
 * machine chargée met plus de temps à faire un tour, elle n'en demande pas un de plus.
 */
async function servirJusquAuVoileTombé(tours: number): Promise<number> {
  let rejetées = 0;
  for (let tour = 0; tour < tours && voileLevé(); tour++) {
    await respirerBanc(20, () => battre?.());
    if (ras.enAttente.length === 0) continue;
    await act(async () => {
      if (rejetées === 0) { ras.rejeterUne(); rejetées += 1; } else ras.résoudreUne();
    });
  }
  return rejetées;
}

/** L'ENVIRONNEMENT du composant, rendu inaccessible : `window` lève à la lecture, exactement comme
 *  après le teardown jsdom d'un fichier de test. Toute pose d'état React y passe (il lit
 *  `window.event` pour donner sa priorité à la mise à jour) — c'est la pile de la CI. */
async function sousTeardown(servir: () => void): Promise<unknown[]> {
  const nonGérées: unknown[] = [];
  const capter = (raison: unknown): void => { nonGérées.push(raison); };
  const avant = Object.getOwnPropertyDescriptor(globalThis, 'window');
  if (!avant) throw new Error('PRÉMISSE : ce banc a besoin du global `window` de jsdom');
  process.on('unhandledRejection', capter);
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    get(): never { throw new ReferenceError('window is not defined'); },
  });
  try {
    servir();
    // Les issues remontent la chaîne par microtâches (rasterisation → texture → file → écran) ; le
    // tour de macrotâche laisse en plus Node signaler une rejection non gérée.
    for (let i = 0; i < 8; i++) await new Promise((r) => setTimeout(r, 0));
  } finally {
    Object.defineProperty(globalThis, 'window', avant);
    process.off('unhandledRejection', capter);
  }
  return nonGérées;
}

describe('Voile d’entrée en scène — les deux issues d’une texture le servent', () => {
  it('TÉMOIN POSITIF — sur un écran MONTÉ, un rejet puis des résolutions le font tomber', async () => {
    const états: boolean[] = [];
    monter(états);
    expect(voileLevé(), 'le voile doit être levé au montage').toBe(true);
    expect(états[états.length - 1], 'l’hôte doit apprendre que l’entrée en scène court').toBe(true);

    const rejetées = await servirJusquAuVoileTombé(40);

    expect(rejetées, 'PRÉMISSE : la première issue servie doit être un REJET — c’est l’issue de la panne').toBe(1);
    expect(voileLevé(), 'le voile n’est jamais tombé : la chaîne issue → `servirEntrée` → voile n’est pas branchée dans ce banc').toBe(false);
    expect(états[états.length - 1], 'l’hôte n’a pas appris la tombée du voile').toBe(false);
  });
});

describe('Voile d’entrée en scène — démonté pendant que ses textures sont EN VOL', () => {
  it('la résolution ET le rejet tardifs ne servent plus rien : aucune pose d’état, aucune erreur non gérée', async () => {
    const états: boolean[] = [];
    monter(états);

    await attendre(() => ras.enAttente.length >= 2);
    expect(ras.enAttente.length, 'PRÉMISSE : deux textures doivent être en vol — sans elles il n’y a rien à servir après coup')
      .toBeGreaterThanOrEqual(2);
    expect(voileLevé(), 'PRÉMISSE : le voile doit être encore LEVÉ au démontage').toBe(true);

    act(() => { root!.unmount(); root = null; });

    const nonGérées = await sousTeardown(() => {
      ras.résoudreUne();
      ras.rejeterUne();
    });

    expect(nonGérées, 'une texture arrivée après le démontage a encore servi le voile — c’est la sortie en 1 de la CI')
      .toEqual([]);
  });
});
