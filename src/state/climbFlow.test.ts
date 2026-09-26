import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { emptyScene, type Scene, type WallClimb } from './scene';
import { useGame } from './store';
import { applyEffects } from './combatFlow';
import { createHero } from '../engine/character';
import { makeRNG } from '../engine/dice';
import { placeCombatant } from './spawn';
import { testScene } from '../scenes/test-fixture';
import { draineCascade } from './cascadeTestKit';
import { t } from '../i18n';

/**
 * Câblage de l'ESCALADE (LDB 15 l.53-57) à la géométrie z (#82) : `climbAcross` grimpe une arête
 * `WallSeg.climb` — exploration (le groupe) et combat (le héros actif). Échelle = sans Test, coût de
 * Mouvement (½ vitesse) ; paroi = Test d'Escalade (échec → chute) consommant l'Action (LDB 13 l.86-88) ;
 * paroi exigeant Grimpeur, Talent absent = refus.
 */

// Falaise de 4 m entre le pied (2,1) à 0 m et le sommet (2,0) à 4 m ; l'arête N de (2,1) porte la grimpe.
function cliffScene(climb: WallClimb): Scene {
  const s = emptyScene(4, 4);
  const w = 4;
  const h = new Array(w * 4).fill(0) as number[];
  h[0 * w + 2] = 4;
  s.layers[0].height = h;
  s.walls = [{ x: 2, y: 1, side: 'N', climb }];
  return s;
}
const foot = { x: 2, y: 1 };
const top = { x: 2, y: 0 };

describe('climbAcross — aucun grimpeur (#1906)', () => {
  it('seul héros à 0 PB, conscient : refus NOMMÉ au journal, le groupe ne bouge pas, rien ne lève', () => {
    const hero = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', rng: makeRNG(1) });
    hero.wounds.current = 0;
    for (const climb of [{ kind: 'surface', requiresGrimpeur: true }, { kind: 'ladder' }] as WallClimb[]) {
      useGame.setState({ battle: null, party: [hero], mode: 'exploration', partyPos: foot, scene: cliffScene(climb), journal: [] });
      expect(() => useGame.getState().climbAcross(foot, top)).not.toThrow();
      expect(useGame.getState().journal.slice(-1)[0]).toBe(t('climb.personne'));
      expect(useGame.getState().partyPos).toEqual(foot);
    }
  });
});

describe('climbAcross — exploration', () => {
  beforeEach(() => {
    const hero = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', rng: makeRNG(1) });
    useGame.setState({ battle: null, party: [hero], mode: 'exploration', partyPos: foot, scene: cliffScene({ kind: 'ladder' }) });
  });

  it('échelle : le groupe monte au sommet (z-transition, sans Test)', () => {
    useGame.setState({ scene: cliffScene({ kind: 'ladder' }), partyPos: foot });
    useGame.getState().climbAcross(foot, top);
    expect(useGame.getState().partyPos).toEqual(top);
  });

  it('paroi exigeant Grimpeur, Talent absent : le groupe ne bouge pas (refus)', () => {
    useGame.setState({ scene: cliffScene({ kind: 'surface', requiresGrimpeur: true }), partyPos: foot });
    useGame.getState().climbAcross(foot, top);
    expect(useGame.getState().partyPos).toEqual(foot);
  });

  it('arête non grimpable : aucun effet', () => {
    const s = cliffScene({ kind: 'ladder' });
    s.walls = [{ x: 2, y: 1, side: 'N' }];
    useGame.setState({ scene: s, partyPos: foot });
    useGame.getState().climbAcross(foot, top);
    expect(useGame.getState().partyPos).toEqual(foot);
  });
});

describe('climbAcross — combat', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useGame.setState({ battle: null });
  });
  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  function setup(climb: WallClimb, atPos = foot) {
    const hero = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', rng: makeRNG(1) });
    useGame.setState({ party: [hero] });
    useGame.getState().startScene(testScene);
    useGame.getState().startCombat('enc-mutants');
    useGame.getState().confirmRoundStart();
    vi.clearAllTimers();
    const sc = cliffScene(climb);
    const b = useGame.getState().battle!;
    const H = b.combatants.find((c) => c.kind === 'hero')!;
    b.combatants.filter((c) => c.kind === 'enemy').forEach((e) => (e.dead = true));
    H.engagedWith = [];
    placeCombatant(H, sc, atPos);
    useGame.setState({ scene: sc, battle: { ...b, turn: b.order.indexOf(H.id), action: null, movementUsed: 0, acted: false, movedPreAction: false, reachable: new Map(), preview: null } });
    return { H };
  }

  it('échelle : le héros actif monte, le Mouvement est consommé, l’Action NON (pas de Test)', () => {
    const { H } = setup({ kind: 'ladder' });
    useGame.getState().climbAcross(foot, top);
    const b = useGame.getState().battle!;
    expect(b.combatants.find((c) => c.id === H.id)!.pos).toMatchObject({ x: 2, y: 0 });
    expect(b.movementUsed).toBeGreaterThan(0); // ½ vitesse sur 4 m (LDB 15 l.53)
    expect(b.acted).toBe(false);
  });

  it('paroi : le héros monte ET l’Action est consommée (Test requis, LDB 13 l.86-88)', () => {
    const { H } = setup({ kind: 'surface' });
    useGame.getState().climbAcross(foot, top);
    const b = useGame.getState().battle!;
    expect(b.combatants.find((c) => c.id === H.id)!.pos).toMatchObject({ x: 2, y: 0 });
    expect(b.acted).toBe(true);
  });

  it('paroi exigeant Grimpeur, Talent absent : le héros ne bouge pas', () => {
    const { H } = setup({ kind: 'surface', requiresGrimpeur: true });
    useGame.getState().climbAcross(foot, top);
    const b = useGame.getState().battle!;
    expect(b.combatants.find((c) => c.id === H.id)!.pos).toMatchObject({ x: 2, y: 1 });
    expect(b.acted).toBe(false);
  });

  // Grimpant (LDB 85 l.160-162) : résolution automatique — aucun Test (même sur une paroi exigeant
  // Grimpeur), coût de Mouvement NORMAL (climbFullSpeed), journalisé.
  it('Grimpant : paroi exigeant Grimpeur — le porteur du trait monte SANS Test, coût normal, journalisé', () => {
    const { H } = setup({ kind: 'surface', requiresGrimpeur: true });
    H.traits = [{ id: 'grimpant' }];
    useGame.setState({ battle: { ...useGame.getState().battle! } });
    useGame.getState().climbAcross(foot, top);
    const b = useGame.getState().battle!;
    const hc = b.combatants.find((c) => c.id === H.id)!;
    expect(hc.pos).toMatchObject({ x: 2, y: 0 });
    expect(b.acted).toBe(false); // pas de Test → pas d'Action consommée
    expect(b.movementUsed).toBe(1); // coût NORMAL (1 case), pas la ½ vitesse du Talent joueur
    expect(b.log.some((e) => e.text.includes('Grimpant'))).toBe(true);
  });

  it('la chute de combat (échec d’Escalade) ramène le faller nommé au pied et lui coûte des Blessures', () => {
    const { H } = setup({ kind: 'surface' }, top); // héros hissé au sommet (état optimiste)
    const before = useGame.getState().battle!.combatants.find((c) => c.id === H.id)!.wounds.current;
    applyEffects(useGame.getState, useGame.setState, [{ type: 'fall', target: 'hero', heroId: H.id, metres: 4, to: { x: 2, y: 1, z: 0 } }]);
    const hc = useGame.getState().battle!.combatants.find((c) => c.id === H.id)!;
    expect(hc.pos).toMatchObject({ x: 2, y: 1 }); // retombé au pied
    // Le 1d10 des Dégâts tombe à la PORTE (#1508) : l'étape à dé nu appendue le montre et le pose.
    draineCascade(useGame.getState);
    expect(useGame.getState().battle!.combatants.find((c) => c.id === H.id)!.wounds.current)
      .toBeLessThan(before); // 3 Dégâts/m + 1d10 − BE (LDB 15 l.80)
  });
});
