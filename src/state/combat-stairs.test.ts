import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { emptyScene, type Scene, type Terrain } from './scene';
import { useGame } from './store';
import { createHero } from '../engine/character';
import { placeCombatant } from './spawn';
import { testScene } from '../scenes/test-fixture';
import { displayedReach, movePreviewAt } from './combatFlow';

/**
 * Combat multi-couche z-aware (relief unifié — plus d'escaliers) : la traversée verticale s'auto-dérive
 * du relief. Une case de tablier (z=1) reliée au sol par une RAMPE (dénivelé ≤ STEP_MAX) entre dans la
 * portée de Marche (clé z-aware « x,y,z »), l'aperçu la cible, et le clic y monte/descend le combattant.
 * z=0 reste byte-identique : un clic-sol ordinaire produit une position SANS z ni h.
 */

// Scène 6×6 : sol z0 « herbe », 0 m. Couche z1 = un tablier (plancher) d'UNE case en (2,2) à 1 m, relié
// au sol voisin par une simple rampe (Δ 1 m = STEP_MAX → marchable en un pas).
function rampScene(): Scene {
  const s = emptyScene(6, 6);
  const w = 6;
  const z1 = new Array(w * 6).fill('vide') as Terrain[];
  const h1 = new Array(w * 6).fill(0) as number[];
  z1[2 * w + 2] = 'plancher'; h1[2 * w + 2] = 1; // tablier (2,2,z1) à 1 m
  s.layers.push({ z: 1, tiles: z1, height: h1 });
  return s;
}

describe('combat multi-couche — rampe : portée/aperçu/clic z-aware', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useGame.setState({ battle: null });
  });
  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  // Démarre un combat sur testScene puis SUBSTITUE la scène à rampe et place le héros actif.
  function setup(heroPos: { x: number; y: number; z?: number }) {
    const hero = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', seed: 1 });
    useGame.setState({ party: [hero] });
    useGame.getState().startScene(testScene);
    useGame.getState().startCombat('enc-mutants');
    useGame.getState().confirmRoundStart();
    vi.clearAllTimers();
    const sc = rampScene();
    const b = useGame.getState().battle!;
    const H = b.combatants.find((c) => c.kind === 'hero')!;
    b.combatants.filter((c) => c.kind === 'enemy').forEach((e) => (e.dead = true)); // libère la grille 6×6
    H.engagedWith = []; // libre de se déplacer
    placeCombatant(H, sc, heroPos); // stampe pos.h depuis le relief
    useGame.setState({
      scene: sc,
      battle: { ...b, turn: b.order.indexOf(H.id), action: null, movementUsed: 0, acted: false, movedPreAction: false, reachable: new Map(), preview: null },
    });
    return { H };
  }

  it('la portée de Marche inclut le tablier z1 relié par la rampe (clé « x,y,z ») + garde des clés z0', () => {
    setup({ x: 2, y: 3 }); // au pied de la rampe
    const reach = displayedReach(useGame.getState);
    expect(reach.has('2,2,1')).toBe(true); // le tablier, via la rampe (Δ 1 m)
    expect([...reach.keys()].some((k) => k.split(',').length === 2)).toBe(true); // …et des cases z0 restent en « x,y »
  });

  it('l’aperçu de déplacement cible une case de tablier z1 atteignable (clé de portée z-aware)', () => {
    setup({ x: 2, y: 3 });
    const pv = movePreviewAt(useGame.getState, { x: 2, y: 2, z: 1 });
    expect(pv).not.toBeNull();
    expect(pv!.kind === 'move' || pv!.kind === 'run').toBe(true);
    expect(pv!.path.length).toBeGreaterThanOrEqual(2); // un vrai chemin (pied → tablier)
  });

  it('cliquer le tablier fait MONTER le héros (z=1) et stampe sa hauteur (h=1)', () => {
    const { H } = setup({ x: 2, y: 3 });
    useGame.getState().battleClickTile({ x: 2, y: 2, z: 1 }, { confirm: true });
    const pos = useGame.getState().battle!.combatants.find((c) => c.id === H.id)!.pos!;
    expect(pos).toEqual({ x: 2, y: 2, z: 1, h: 1 }); // monté sur le tablier, hauteur métrique portée
  });

  it('depuis le tablier, cliquer une case de sol fait DESCENDRE le héros (z0, sans z ni h)', () => {
    const { H } = setup({ x: 2, y: 2, z: 1 }); // sur le tablier
    useGame.getState().battleClickTile({ x: 2, y: 3 }, { confirm: true });
    const pos = useGame.getState().battle!.combatants.find((c) => c.id === H.id)!.pos!;
    expect(pos).toEqual({ x: 2, y: 3 }); // redescendu au sol
  });

  it('NON-RÉGRESSION z=0 : un clic-sol ordinaire produit une position SANS z', () => {
    const { H } = setup({ x: 2, y: 3 });
    useGame.getState().battleClickTile({ x: 4, y: 4 }, { confirm: true }); // déplacement plat
    const pos = useGame.getState().battle!.combatants.find((c) => c.id === H.id)!.pos!;
    expect(pos).toEqual({ x: 4, y: 4 }); // pas de champ z/h parasite
  });
});
