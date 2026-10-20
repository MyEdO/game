import { describe, it, expect, beforeEach } from 'vitest';
import { useGame, type BattleState } from './store';
import { applyAttackResult } from '../noyau/combatFlow';
import { seedBattleRng } from '../noyau/battleRng';
import { emptyScene } from '../noyau/monde/scene';
import type { Combatant, Weapon } from '../engine/types';
import type { AttackResult } from '../engine/combat';

// Câblage de la Dispersion (LDB 14 l.144-151) : un TIR DE LANCER raté dévie (journal de Dispersion),
// un tir d'ARC raté reste un simple échec sans déviation (Portée FIXE ≠ Portée `{bf}`).

const CHARS = { 'capacite-de-combat': 40, 'capacite-de-tir': 45, force: 40, endurance: 40, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 };

const hero = (p: Partial<Combatant>): Combatant =>
  ({
    id: 'h1', name: 'Lanceur', kind: 'hero', characteristics: CHARS,
    wounds: { current: 15, max: 15 }, advantage: 0, conditions: [], movement: 4, skills: [], talents: [],
    engagedWith: [], pos: { x: 2, y: 2 }, size: 'moyenne', weapons: [], items: [], fate: 0,
    armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    ...p,
  } as unknown as Combatant);

const enemy = (p: Partial<Combatant>): Combatant =>
  ({
    id: 'e1', name: 'Cible', kind: 'enemy', characteristics: CHARS,
    wounds: { current: 20, max: 20 }, advantage: 0, conditions: [], movement: 4, skills: [], talents: [],
    engagedWith: [], pos: { x: 8, y: 2 }, size: 'moyenne',
    weapons: [{ label: 'Gourdin', type: 'melee', damage: { plusBF: true, flat: 0, bare: true }, qualities: [] } as Weapon], items: [],
    armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    ...p,
  } as unknown as Combatant);

const thrown: Weapon = { label: 'Hache de jet', type: 'ranged', damage: { plusBF: true, flat: 0, bare: true }, range: { bf: 3 }, qualities: [] } as Weapon;
const bow: Weapon = { label: 'Arc', type: 'ranged', damage: { plusBF: false, flat: 6 }, range: 30, qualities: [] } as Weapon;

const missRes = (): AttackResult => ({
  hit: false, attackerRoll: 88, netSL: -3, critical: false, advantageTo: null, defenderDefeated: false, log: 'manque sa cible.',
});

function setBattle(combatants: Combatant[]) {
  const battle: BattleState = {
    combatants, order: combatants.map((c) => c.id), baseOrder: combatants.map((c) => c.id),
    turn: 0, round: 1, action: null, selectedSpellId: null, reachable: new Map(),
    movementUsed: 0, movedPreAction: false, acted: false, log: [], over: null,
  } as unknown as BattleState;
  useGame.setState({ battle, mode: 'battle', scene: emptyScene(), gameTime: 12 * 60, pendingCascade: null, pendingFateSave: null });
}

const logText = () => useGame.getState().battle!.log.map((e: { text: string }) => e.text).join(' | ');

describe('Dispersion — câblage d’un raté de Lancer (LDB 14 l.144-151)', () => {
  beforeEach(() => { seedBattleRng(20260627); });

  it('tir de LANCER raté → ligne de journal de Dispersion', () => {
    setBattle([hero({ weapons: [thrown] }), enemy({})]);
    applyAttackResult(useGame.getState, useGame.setState, useGame.getState().battle!.combatants[0], useGame.getState().battle!.combatants[1], thrown, missRes());
    expect(logText()).toMatch(/Dispersion/);
  });

  it('tir d’ARC raté → AUCUNE Dispersion (Portée fixe, pas une arme de jet)', () => {
    setBattle([hero({ weapons: [bow] }), enemy({})]);
    applyAttackResult(useGame.getState, useGame.setState, useGame.getState().battle!.combatants[0], useGame.getState().battle!.combatants[1], bow, missRes());
    expect(logText()).not.toMatch(/Dispersion/);
  });
});
