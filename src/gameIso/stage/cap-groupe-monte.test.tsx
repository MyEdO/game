// @vitest-environment jsdom
/**
 * LE CAP DU GROUPE, SUR L'ÉCRAN MONTÉ (#1362 L1a) — l'hôte réel (`MondeDeCampagne`) dérive le jeton de
 * groupe (`partyTokenOf`), le monde volumique en fait une pose, et le stage la passe au backend.
 *
 * POINT D'OBSERVATION : le `BillboardSubject` MONTÉ, tel que la passe de frame le repose
 * (`sceneMeshes.reposerActeurs` → `sujet.facing = capActeur(pose)`). C'est le dernier étage avant le
 * quad, et le plus proche du pixel que jsdom permette (le rasteriseur y est simulé) — et c'est le SEUL
 * juste : un cap qui tourne ne remonte AUCUN sujet (#1396), `actorBillboards` n'est donc pas rappelé
 * par un pivot (mesuré : 1 appel au montage, 0 après le pivot). Un banc qui appellerait
 * `partyActorPose` à la main ne prouverait rien du CÂBLAGE : c'est précisément ce qu'une pose inline
 * dans `VolumetricWorld` pouvait contredire sans rougir.
 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { emptyScene, type Scene } from '../../state/scene';
import { useGame } from '../../state/store';
import { capDuGroupe, meneurDuMonde } from '../../state/combatants';
import { createHero } from '../../engine/character';
import { makeRNG } from '../../engine/dice';
import type { Combatant } from '../../engine/types';
import * as sceneMeshes from '../backends/webgl/sceneMeshes';
import { actorPoseKey, type ActorPose, type BillboardSubject } from '../backends/webgl/sceneMeshes';
import type { Dir8 } from '../../state/dir8';
import type { Dims } from '../../geometry/iso';
import { discCapPath } from '../builders/dynamicMarks';
import { MondeDeCampagne } from './MondeDeCampagne';
import { setStageRendererFactory } from './GameStage3D';
import { BancRenderer, brancherArdoise, respirer, simulerRasterisation, viderCaptures } from './banc-volumique';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const TAILLE = { w: 800, h: 600 };
let root: Root | null = null;
let hôte: HTMLDivElement | null = null;

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
});

const héros = (label: string, graine: number): Combatant =>
  ({ ...createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label, rng: makeRNG(graine) }), id: label }) as Combatant;

function scène(): Scene {
  return emptyScene(12, 12);
}

/** L'hôte RÉEL, en exploration, groupe de deux héros posté au centre. */
async function monter(vue: 'iso' | 'top' = 'iso'): Promise<void> {
  viderCaptures();
  useGame.setState({
    screen: 'campaign',
    scene: scène(),
    mode: 'exploration',
    partyPos: { x: 5, y: 5 },
    party: [héros('a', 3), héros('b', 4)],
    battle: null,
    dialogue: null,
    explored: {},
    facing: {},
    camRot: 0,
    viewMode: vue,
    camEdge: false,
    povActive: false,
  } as never);
  hôte = document.createElement('div');
  document.body.appendChild(hôte);
  root = createRoot(hôte);
  await act(async () => { root!.render(<MondeDeCampagne />); });
  await respirer(40);
}

type EspionRepose = { mock: { calls: unknown[][] } };

/** Le SUJET MONTÉ du jeton de groupe (celui que la repose de frame vient d'orienter), et le cap que
 *  porte sa pose — pris au dernier appel de `reposerActeurs` qui le connaît. */
function sujetDuGroupe(espion: EspionRepose): { facingMonté: Dir8 | undefined; pose: ActorPose } {
  const meneur = meneurDuMonde(useGame.getState())!;
  for (let i = espion.mock.calls.length - 1; i >= 0; i--) {
    const [subjects, actors] = espion.mock.calls[i] as [readonly BillboardSubject[], readonly ActorPose[]];
    const sujet = subjects.find((s) => s.cid === meneur.id);
    const pose = actors.find((p) => p.c.id === meneur.id);
    if (sujet && pose) return { facingMonté: sujet.facing, pose };
  }
  throw new Error('aucun sujet monté pour le jeton de groupe : le banc ne mesure rien');
}

describe('Cap du GROUPE — sur l’écran MONTÉ (#1362)', () => {
  it('PIVOT : le quad du groupe reçoit le cap du GROUPE, jamais un cap keyé par le meneur', async () => {
    const espion = vi.spyOn(sceneMeshes, 'reposerActeurs');
    await monter();
    await act(async () => { useGame.getState().pivotParty(1); });
    await respirer(80);

    const s = useGame.getState();
    const cap = capDuGroupe(s)!;
    expect(cap, 'prémisse : le pivot a bien posé un cap de groupe').toBeTruthy();
    expect(s.facing[meneurDuMonde(s)!.id], 'prémisse : AUCUN cap n’est keyé par le meneur').toBeUndefined();

    const { facingMonté, pose } = sujetDuGroupe(espion);
    expect(facingMonté, 'le cap porté par le SUJET monté').toBe(cap);
    expect(pose.facing, 'et la pose qui le lui donne').toBe(cap);
    expect(actorPoseKey(pose), 'la clé de mémo retient le même cap').toContain(`:${cap}:`);
  });

  it('VUE DU DESSUS : le disque du groupe, monté par l’hôte, porte le quartier du cap de GROUPE', async () => {
    await monter('top');
    await act(async () => { useGame.getState().pivotParty(1); });
    await respirer(80);
    const cap = capDuGroupe(useGame.getState())!;
    const meneur = meneurDuMonde(useGame.getState())!;
    const dims = { ...useGame.getState().scene!.dimensions, rot: 0, view: 'top', edge: false } as Dims;
    const tracés = [...hôte!.querySelectorAll(`g[data-pion-cid="${meneur.id}"] path`)].map((p) => p.getAttribute('d'));
    expect(tracés.length, 'prémisse : le disque du groupe est bien monté').toBeGreaterThan(0);
    expect(tracés, 'le quartier de cap suit le GROUPE').toContain(discCapPath(cap, 1, dims));
  });

  it('CHANGEMENT DE MENEUR, groupe immobile : le cap servi au quad ne bouge pas', async () => {
    const espion = vi.spyOn(sceneMeshes, 'reposerActeurs');
    await monter();
    await act(async () => { useGame.getState().pivotParty(-1); });
    await respirer(80);
    const capAvant = sujetDuGroupe(espion).facingMonté;
    expect(capAvant, 'le cap monté est celui du GROUPE').toBe(capDuGroupe(useGame.getState()));
    expect(capAvant, 'prémisse : un cap est bien monté avant la chute').toBeTruthy();

    await act(async () => {
      useGame.setState((s) => ({ party: s.party.map((h) => (h.id === 'a' ? { ...h, wounds: { ...h.wounds, current: 0 } } : h)) }));
    });
    await respirer(80);

    const { facingMonté, pose } = sujetDuGroupe(espion);
    expect(pose.c.id, 'le corps dessiné est le nouveau meneur').toBe('b');
    expect(facingMonté, 'le regard, lui, appartient au groupe').toBe(capAvant);
    expect(facingMonté).toBe(capDuGroupe(useGame.getState()));
  });
});
