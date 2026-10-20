/**
 * #40 — Gantelet verrouillé (AA, folio 94) : anti-lâcher. Le porteur ne LÂCHE PAS l'arme tenue dans la
 * main gantée la 1re fois que les circonstances l'y obligeraient (désarmement / Piège-lame) — il subit
 * à la place une pénalité de −20 pendant 1 Round (min). Si un SECOND évènement de lâcher survient pendant
 * cette période, l'arme EST lâchée. Capacité portée par la DONNÉE (`preventForcedDrop` sur le trapping),
 * lue génériquement (aucun code par nom dans le moteur).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useGame } from './store';
import type { BattleState } from '../noyau/etat';
import { applyBladeTrap } from '../noyau/combatFlow';
import type { Combatant } from '../engine/types';
import type { BladeTrapFreeze } from '../noyau/pendings';

const chars = { 'capacite-de-combat': 40, 'capacite-de-tir': 30, force: 40, endurance: 40, initiative: 40, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 };

function setup(withGauntlet: boolean): { attacker: Combatant; defender: Combatant } {
  const attacker = {
    id: 'e1', name: 'Mercenaire', kind: 'enemy', characteristics: chars, wounds: { current: 30, max: 30 },
    advantage: 0, conditions: [], movement: 4, skills: [], talents: [], traits: [], pos: { x: 1, y: 0 }, size: 'moyenne',
    weapons: [{ uid: 'w1', name: 'Épée', type: 'melee', damage: { plusBF: true, flat: 4 }, qualities: [] }],
    armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    items: withGauntlet ? [{ uid: 'g1', trappingId: 'gantelet-verrouille', name: 'Gantelet verrouillé', kind: 'melee', qualities: [], enc: 1, equipped: true }] : [],
  } as unknown as Combatant;
  const defender = {
    id: 'h1', name: 'Bretteur', kind: 'hero', characteristics: chars, wounds: { current: 20, max: 20 },
    advantage: 0, conditions: [], movement: 4, skills: [], talents: [], traits: [], pos: { x: 0, y: 0 }, size: 'moyenne',
    weapons: [{ uid: 'd1', name: 'Rapière', type: 'melee', damage: { plusBF: true, flat: 4 }, qualities: [] }],
    armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 }, items: [], fate: 0, criticalWounds: 0,
  } as unknown as Combatant;
  const battle: BattleState = {
    combatants: [attacker, defender], order: ['e1', 'h1'], baseOrder: ['e1', 'h1'],
    turn: 1, round: 1, action: null, selectedSpellId: null, reachable: new Map(),
    movementUsed: 0, movedPreAction: false, acted: false, log: [], over: null,
  } as unknown as BattleState;
  useGame.setState({ battle, mode: 'battle' });
  return { attacker, defender };
}

// netSL = defenderSL + bt.defSL − bt.attackerSL = 2 → < 6 → simple désarmement (pas de casse de lame).
const bt: BladeTrapFreeze = { attackerId: 'e1', weaponUid: 'w1', defSL: 0, attackerSL: 0 };
const has = (id: string, uid: string) => useGame.getState().battle!.combatants.find((c) => c.id === id)!.weapons.some((w) => w.uid === uid);

describe('#40 — Gantelet verrouillé : anti-lâcher (AA folio 94)', () => {
  beforeEach(() => { useGame.setState({ battle: null }); });

  it('1er désarmement : le porteur d’un gantelet verrouillé NE lâche PAS son arme', () => {
    const { defender } = setup(true);
    applyBladeTrap(useGame.getState, useGame.setState, defender, bt, 2);
    expect(has('e1', 'w1')).toBe(true); // arme conservée
  });

  it('2e désarmement pendant la période : l’arme EST lâchée', () => {
    const { defender } = setup(true);
    applyBladeTrap(useGame.getState, useGame.setState, defender, bt, 2); // sauvé
    applyBladeTrap(useGame.getState, useGame.setState, defender, bt, 2); // 2e évènement → lâche
    expect(has('e1', 'w1')).toBe(false);
  });

  it('sans gantelet verrouillé : le 1er désarmement fait lâcher l’arme', () => {
    const { defender } = setup(false);
    applyBladeTrap(useGame.getState, useGame.setState, defender, bt, 2);
    expect(has('e1', 'w1')).toBe(false);
  });
});
