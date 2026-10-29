import { describe, it, expect, beforeEach } from 'vitest';
import { emptyScene, type Scene, type WallClimb } from './monde/scene';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { applyEffects } from './combatEffects';
import { createHero } from '../engine/character';
import { placeCombatant } from './monde/spawn';
import { testScene } from '../scenes/test-fixture';
import { draineCascade } from './cascade.testkit';
import { t } from '../i18n';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });

/**
 * Câblage de l'ESCALADE (LDB 15 l.53-57) à la géométrie z (#82) : `climbAcross` grimpe une arête
 * `WallSeg.climb` — exploration (le groupe) et combat (le héros actif). Échelle = sans Test, coût de
 * Mouvement (½ vitesse) ; paroi = Test d'Escalade (échec → chute) consommant l'Action (LDB 13 l.86-88) ;
 * paroi exigeant Grimpeur, Talent absent = refus.
 */

// Falaise de 4 m entre le pied (2,1) à 0 m et le sommet (2,0) à 4 m ; l'arête N de (2,1) porte la grimpe.
function cliffScene(climb: WallClimb): Scene {
  const s = emptyScene('scene-test', 4, 4);
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
    const hero = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', seed: 1 });
    hero.wounds.current = 0;
    for (const climb of [{ kind: 'surface', requiresGrimpeur: true }, { kind: 'ladder' }] as WallClimb[]) {
      banc.setState({ battle: null, party: [hero], mode: 'exploration', partyPos: foot, scene: cliffScene(climb), journal: [] });
      expect(() => banc.getState().climbAcross(foot, top)).not.toThrow();
      expect(banc.getState().journal.slice(-1)[0]).toBe(t('geste.refus.personne'));
      expect(banc.getState().partyPos).toEqual(foot);
    }
  });
});

describe('climbAcross — exploration', () => {
  beforeEach(() => {
    const hero = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', seed: 1 });
    banc.setState({ battle: null, party: [hero], mode: 'exploration', partyPos: foot, scene: cliffScene({ kind: 'ladder' }) });
  });

  it('échelle : le groupe monte au sommet (z-transition, sans Test)', () => {
    banc.setState({ scene: cliffScene({ kind: 'ladder' }), partyPos: foot });
    banc.getState().climbAcross(foot, top);
    expect(banc.getState().partyPos).toEqual(top);
  });

  it('paroi exigeant Grimpeur, Talent absent : le groupe ne bouge pas (refus)', () => {
    banc.setState({ scene: cliffScene({ kind: 'surface', requiresGrimpeur: true }), partyPos: foot });
    banc.getState().climbAcross(foot, top);
    expect(banc.getState().partyPos).toEqual(foot);
  });

  it('arête non grimpable : refus NOMMÉ, aucun effet', () => {
    const s = cliffScene({ kind: 'ladder' });
    s.walls = [{ x: 2, y: 1, side: 'N' }];
    banc.setState({ scene: s, partyPos: foot, journal: [] });
    banc.getState().climbAcross(foot, top);
    expect(banc.getState().partyPos).toEqual(foot);
    expect(banc.getState().journal.slice(-1)[0]).toBe(t('climb.pasGrimpable'));
  });
});

describe('climbAcross — combat', () => {
  beforeEach(() => {
    banc.setState({ battle: null });
  });

  function setup(climb: WallClimb, atPos = foot) {
    const hero = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', seed: 1 });
    banc.setState({ party: [hero] });
    banc.getState().startScene(testScene());
    banc.getState().startCombat('enc-mutants');
    banc.getState().confirmRoundStart();
    banc.abandonner();
    const sc = cliffScene(climb);
    const b = banc.getState().battle!;
    const H = b.combatants.find((c) => c.kind === 'hero')!;
    b.combatants.filter((c) => c.kind === 'enemy').forEach((e) => (e.dead = true));
    H.engagedWith = [];
    placeCombatant(H, sc, atPos);
    banc.setState({ scene: sc, battle: { ...b, turn: b.order.indexOf(H.id), action: null, movementUsed: 0, acted: false, movedPreAction: false, reachable: new Map(), preview: null } });
    return { H };
  }

  it('échelle : le héros actif monte, le Mouvement est consommé, l’Action NON (pas de Test)', () => {
    const { H } = setup({ kind: 'ladder' });
    banc.getState().climbAcross(foot, top);
    const b = banc.getState().battle!;
    expect(b.combatants.find((c) => c.id === H.id)!.pos).toMatchObject({ x: 2, y: 0 });
    expect(b.movementUsed).toBeGreaterThan(0); // ½ vitesse sur 4 m (LDB 15 l.55)
    expect(b.acted).toBe(false);
  });

  it('paroi : le héros monte ET l’Action est consommée (Test requis, LDB 13 l.86-88)', () => {
    const { H } = setup({ kind: 'surface' });
    banc.getState().climbAcross(foot, top);
    const b = banc.getState().battle!;
    expect(b.combatants.find((c) => c.id === H.id)!.pos).toMatchObject({ x: 2, y: 0 });
    expect(b.acted).toBe(true);
  });

  it('paroi exigeant Grimpeur, Talent absent : le héros ne bouge pas', () => {
    const { H } = setup({ kind: 'surface', requiresGrimpeur: true });
    banc.getState().climbAcross(foot, top);
    const b = banc.getState().battle!;
    expect(b.combatants.find((c) => c.id === H.id)!.pos).toMatchObject({ x: 2, y: 1 });
    expect(b.acted).toBe(false);
  });

  // Grimpant (LDB 85 l.160-162) : résolution automatique — aucun Test (même sur une paroi exigeant
  // Grimpeur), coût de Mouvement NORMAL (climbFullSpeed), journalisé.
  it('Grimpant : paroi exigeant Grimpeur — le porteur du trait monte SANS Test, coût normal, journalisé', () => {
    const { H } = setup({ kind: 'surface', requiresGrimpeur: true });
    H.traits = [{ id: 'grimpant' }];
    banc.setState({ battle: { ...banc.getState().battle! } });
    banc.getState().climbAcross(foot, top);
    const b = banc.getState().battle!;
    const hc = b.combatants.find((c) => c.id === H.id)!;
    expect(hc.pos).toMatchObject({ x: 2, y: 0 });
    expect(b.acted).toBe(false); // pas de Test → pas d'Action consommée
    expect(b.movementUsed).toBe(1); // coût NORMAL (1 case), pas la ½ vitesse du Talent joueur
    expect(b.log.some((e) => e.text.includes('Grimpant'))).toBe(true);
  });

  it('la chute de combat (échec d’Escalade) ramène le faller nommé au pied et lui coûte des Blessures', () => {
    const { H } = setup({ kind: 'surface' }, top); // héros hissé au sommet (état optimiste)
    const before = banc.getState().battle!.combatants.find((c) => c.id === H.id)!.wounds.current;
    applyEffects(banc.getState, banc.setState, [{ type: 'fall', target: 'hero', heroId: H.id, metres: 4, to: { x: 2, y: 1, z: 0 } }]);
    const hc = banc.getState().battle!.combatants.find((c) => c.id === H.id)!;
    expect(hc.pos).toMatchObject({ x: 2, y: 1 }); // retombé au pied
    // Le 1d10 des Dégâts tombe à la PORTE (#1508) : l'étape à dé nu appendue le montre et le pose.
    draineCascade(banc.getState);
    expect(banc.getState().battle!.combatants.find((c) => c.id === H.id)!.wounds.current)
      .toBeLessThan(before); // 3 Dégâts/m + 1d10 − BE (LDB 15 l.80)
  });
});
