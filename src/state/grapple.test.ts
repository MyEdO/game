import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useGame } from './store';
import { applyAttackResult, availableAttacks } from './combatFlow';
import { createHero } from '../engine/character';
import { testScene } from '../scenes/test-fixture';
import { areGrappling, setGrapple } from '../engine/grapple';
import { addCondition, hasCondition, stacks, COND } from '../engine/conditions';
import { unarmedWeapon } from '../engine/items';
import type { AttackResult } from '../engine/combat';
import type { Combatant } from '../engine/types';

// Empoignade (Issue #42.1, LDB 14 l.159/161/169).

const hitRes: AttackResult = {
  hit: true, attackerRoll: 40, netSL: 2, location: 'corps', damage: 8, woundsLost: 8,
  critical: false, advantageTo: 'attacker', defenderDefeated: false, log: '',
};
const missRes: AttackResult = {
  hit: false, attackerRoll: 80, netSL: 0, damage: 0, woundsLost: 0,
  critical: false, advantageTo: null, defenderDefeated: false, log: '',
};

describe('Empoignade — store + funnel (LDB 14 l.159/161/169)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllTimers();
    useGame.setState({ pendingGrapple: null, battle: null });
  });
  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  function setup() {
    const hero = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', seed: 1 });
    useGame.setState({ party: [hero] });
    useGame.getState().startScene(testScene());
    useGame.getState().startCombat('enc-mutants');
    useGame.getState().confirmRoundStart();
    vi.clearAllTimers();
    const b = useGame.getState().battle!;
    const H = b.combatants.find((c) => c.kind === 'hero')!;
    const enemies = b.combatants.filter((c) => c.kind === 'enemy');
    return { H, enemies };
  }

  const live = (id: string) => useGame.getState().battle!.combatants.find((c) => c.id === id)!;

  /** Place le tour sur H, Action libre, H Engagé avec `foe`. */
  function activate(H: Combatant, foe: Combatant) {
    H.engagedWith = [foe.id];
    foe.engagedWith = [H.id];
    const b = useGame.getState().battle!;
    const turn = b.order.indexOf(H.id);
    useGame.setState({ battle: { ...b, turn, action: null, movementUsed: 0, acted: false } });
  }

  // ── b. Initiation (déclarée avant le jet, « au lieu des Dégâts ») ──
  it('initiation : touche en mode Empoignade → les deux Empoignés, cible Empêtrée, ZÉRO Dégât', () => {
    const { H, enemies } = setup();
    const E = enemies[0];
    enemies.slice(1).forEach((e) => (e.dead = true));
    activate(H, E);
    const h = live(H.id), e = live(E.id);
    const woundsBefore = e.wounds.current;
    // grapple=true (10ᵉ arg) : sur une touche, pose l'Empoignade au lieu de blesser.
    applyAttackResult(useGame.getState, useGame.setState, h, e, unarmedWeapon(), { ...hitRes }, { suite: { grapple: true } });
    expect(areGrappling(live(H.id), live(E.id))).toBe(true);
    expect(hasCondition(live(E.id), COND.empetre)).toBe(true);
    expect(live(E.id).wounds.current).toBe(woundsBefore); // pas de Dégâts sur l'initiation
  });

  it('initiation qui RATE → ni Empoignade ni Empêtré', () => {
    const { H, enemies } = setup();
    const E = enemies[0];
    enemies.slice(1).forEach((e) => (e.dead = true));
    activate(H, E);
    applyAttackResult(useGame.getState, useGame.setState, live(H.id), live(E.id), unarmedWeapon(), { ...missRes }, { suite: { grapple: true } });
    expect(areGrappling(live(H.id), live(E.id))).toBe(false);
    expect(hasCondition(live(E.id), COND.empetre)).toBe(false);
  });

  it('NON-régression : une touche SANS Empoignade inflige toujours des Dégâts (et n’Empoigne pas)', () => {
    const { H, enemies } = setup();
    const E = enemies[0];
    enemies.slice(1).forEach((e) => (e.dead = true));
    activate(H, E);
    const e0 = live(E.id);
    e0.armour = { tete: 0, corps: 0, brasG: 0, brasD: 0, jambeG: 0, jambeD: 0 } as never;
    e0.wounds = { current: 20, max: 20 } as never;
    const before = live(E.id).wounds.current;
    applyAttackResult(useGame.getState, useGame.setState, live(H.id), live(E.id), unarmedWeapon(), { ...hitRes }); // pas de grapple
    expect(live(E.id).wounds.current).toBeLessThan(before); // Dégâts appliqués
    expect(areGrappling(live(H.id), live(E.id))).toBe(false);
  });

  // ── c. Action « pendant l'Empoignade » ──
  it('availableAttacks expose « Empoignade » quand les deux sont Empoignés', () => {
    const { H, enemies } = setup();
    const E = enemies[0];
    enemies.slice(1).forEach((e) => (e.dead = true));
    activate(H, E);
    setGrapple(live(H.id), live(E.id));
    const opts = availableAttacks(live(H.id), useGame.getState().battle!);
    expect(opts.some((o) => o.id === 'grapple' && o.targeting === 'grapple')).toBe(true);
  });

  it('Avantage supérieur → « Briser » dispo, libère l’Empoignade et retire l’Empêtré de l’acteur', () => {
    const { H, enemies } = setup();
    const E = enemies[0];
    enemies.slice(1).forEach((e) => (e.dead = true));
    activate(H, E);
    const h = live(H.id), e = live(E.id);
    setGrapple(h, e);
    addCondition(h, COND.empetre, 1); // (met l'Avantage à 0)
    h.advantage = 2; e.advantage = 0; // Avantage strictement supérieur
    useGame.getState().battleGrapple(E.id);
    const pd = useGame.getState().pendingGrapple!;
    expect(pd.canBreak).toBe(true);
    useGame.getState().grappleBreak();
    expect(useGame.getState().pendingGrapple).toBeNull();
    expect(areGrappling(live(H.id), live(E.id))).toBe(false);
    expect(hasCondition(live(H.id), COND.empetre)).toBe(false);
    expect(useGame.getState().battle!.acted).toBe(false); // Briser est GRATUIT
  });

  it('Test de Force gagné, option Dégâts → BF + DR en IGNORANT les PA (cible blindée subit autant que nue)', () => {
    const { H, enemies } = setup();
    const E = enemies[0];
    enemies.slice(1).forEach((e) => (e.dead = true));
    activate(H, E);
    const h = live(H.id), e = live(E.id);
    h.characteristics = { ...h.characteristics, force: 40 } as never; // BF 4
    e.characteristics = { ...e.characteristics, endurance: 30 } as never;  // BE 3
    e.armour = { tete: 5, corps: 5, brasG: 5, brasD: 5, jambeG: 5, jambeD: 5 } as never; // PA ignorés
    e.wounds = { current: 20, max: 20 } as never;
    setGrapple(h, e);
    useGame.getState().battleGrapple(E.id);
    const pd = useGame.getState().pendingGrapple!;
    // Force l'issue : l'acteur l'emporte avec DR net 2 (def.sl 2 vs atk.sl 0).
    useGame.setState({ pendingGrapple: { ...pd,
      def: { roll: 30, target: 40, success: true, sl: 2, isDouble: false },
      atk: { roll: 50, target: 40, success: true, sl: 0, isDouble: false },
      result: 'success' } });
    useGame.getState().grappleConfirm();
    expect(useGame.getState().pendingGrapple?.phase).toBe('options');
    const before = live(E.id).wounds.current;
    useGame.getState().grappleChoose('damage');
    // BF(4) + DR(2) = 6, − BE(3) = 3, PA ignorés (armure 5 sans effet).
    expect(before - live(E.id).wounds.current).toBe(3);
    expect(useGame.getState().battle!.acted).toBe(true);
  });

  it('option Empêtrer → l’adversaire gagne l’État Empêtré', () => {
    const { H, enemies } = setup();
    const E = enemies[0];
    enemies.slice(1).forEach((e) => (e.dead = true));
    activate(H, E);
    const h = live(H.id), e = live(E.id);
    setGrapple(h, e);
    useGame.getState().battleGrapple(E.id);
    const pd = useGame.getState().pendingGrapple!;
    useGame.setState({ pendingGrapple: { ...pd, def: pd.atk, result: 'success', phase: 'roll' } });
    useGame.getState().grappleConfirm();
    useGame.getState().grappleChoose('entangle');
    expect(hasCondition(live(E.id), COND.empetre)).toBe(true);
  });

  it('option Se libérer → retire son propre Empêtré (1 + DR pions)', () => {
    const { H, enemies } = setup();
    const E = enemies[0];
    enemies.slice(1).forEach((e) => (e.dead = true));
    activate(H, E);
    const h = live(H.id), e = live(E.id);
    setGrapple(h, e);
    addCondition(h, COND.empetre, 3); // 3 pions sur l'acteur
    useGame.getState().battleGrapple(E.id);
    const pd = useGame.getState().pendingGrapple!;
    // DR net 1 (def.sl 1 vs atk.sl 0) → retire 1 + 1 = 2 pions.
    useGame.setState({ pendingGrapple: { ...pd,
      def: { roll: 30, target: 40, success: true, sl: 1, isDouble: false },
      atk: { roll: 50, target: 40, success: true, sl: 0, isDouble: false },
      result: 'success', phase: 'roll' } });
    useGame.getState().grappleConfirm();
    useGame.getState().grappleChoose('free');
    expect(stacks(live(H.id), COND.empetre)).toBe(1); // 3 − (1 + DR 1) = 1
  });

  it('Test de Force PERDU → l’adversaire gagne +1 Avantage', () => {
    const { H, enemies } = setup();
    const E = enemies[0];
    enemies.slice(1).forEach((e) => (e.dead = true));
    activate(H, E);
    const h = live(H.id), e = live(E.id);
    setGrapple(h, e);
    e.advantage = 1;
    useGame.getState().battleGrapple(E.id);
    const pd = useGame.getState().pendingGrapple!;
    useGame.setState({ pendingGrapple: { ...pd, def: pd.atk, result: 'failure' } });
    useGame.getState().grappleConfirm();
    expect(live(E.id).advantage).toBe(2); // +1 Avantage (l.161)
    expect(useGame.getState().pendingGrapple).toBeNull();
    expect(useGame.getState().battle!.acted).toBe(true);
  });
});
