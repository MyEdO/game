import { describe, it, expect, beforeEach } from 'vitest';
import { useGame, type BattleState } from './store';
import { applyAttackResult } from './combatFlow';
import { seedBattleRng } from './battleRng';
import type { Combatant, Weapon } from '../engine/types';
import type { AttackResult } from '../engine/combat';

/**
 * PINNING — Défense du champion (LDB 85 l.71 : « Si elle gagne un Test opposé en se défendant en CC,
 * elle cause autant de Dégâts que si elle était l'attaquant ») + Riposte (LDB 10). Comportement NON couvert
 * par golden : on FIGE ici la contre-attaque (le défenseur Champion qui gagne le Test opposé frappe
 * l'attaquant avec son jet de défense) AVANT de migrer la réaction en données — c'est l'oracle de la migration.
 */
const chars = { 'capacite-de-combat': 50, 'capacite-de-tir': 30, force: 45, endurance: 40, initiative: 40, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 };

function setup(targetTraits: { id: string }[], heroArmourCorps = 0): { hero: Combatant; enemy: Combatant } {
  const enemy = {
    id: 'e1', label: 'Champion', kind: 'enemy', characteristics: chars, wounds: { current: 30, max: 30 },
    advantage: 0, conditions: [], movement: 4, skills: [], talents: [], traits: targetTraits, engagedWith: [], pos: { x: 1, y: 0 },
    size: 'moyenne', weapons: [{ label: 'Épée', type: 'melee', damage: { plusBF: true, flat: 0, bare: true }, qualities: [] }],
    armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 }, items: [],
  } as unknown as Combatant;
  const hero = {
    id: 'h1', label: 'Attaquant', kind: 'hero', characteristics: chars, wounds: { current: 20, max: 20 },
    advantage: 0, conditions: [], movement: 4, skills: [], talents: [], traits: [], engagedWith: [], pos: { x: 0, y: 0 },
    size: 'moyenne', weapons: [{ label: 'Dague', type: 'melee', damage: { plusBF: true, flat: 0, bare: true }, qualities: [] }],
    items: [], criticalWounds: 0, fate: 0,
    armour: { tete: 0, brasG: 0, brasD: 0, corps: heroArmourCorps, jambeG: 0, jambeD: 0 },
  } as unknown as Combatant;
  const battle: BattleState = {
    combatants: [enemy, hero], order: [enemy.id, hero.id], baseOrder: [enemy.id, hero.id],
    turn: 1, round: 1, action: null, selectedSpellId: null, reachable: new Map(),
    movementUsed: 0, movedPreAction: false, acted: false, log: [], over: null,
  } as unknown as BattleState;
  useGame.setState({ battle, mode: 'battle' });
  return { hero, enemy };
}

/** Résultat d'attaque où le DÉFENSEUR a gagné le Test opposé (advantageTo 'defender', netSL > 0). */
const defenderWins: AttackResult = {
  hit: false, attackerRoll: 70, defenderRoll: 25, netSL: 2, location: 'corps', damage: 0, woundsLost: 0,
  critical: false, advantageTo: 'defender', defenderDefeated: false, log: '',
  defenderDetail: { target: 50, roll: 25, dr: 2 } as never,
};

describe('Défense du champion / Riposte — contre-attaque (PINNING avant migration)', () => {
  beforeEach(() => { useGame.setState({ battle: null }); });

  it('Champion qui gagne le Test opposé → frappe l’attaquant (Blessures perdues), avec une ligne au journal', () => {
    seedBattleRng(7);
    const { hero, enemy } = setup([{ id: 'champion' }]);
    const before = hero.wounds.current;
    applyAttackResult(useGame.getState, useGame.setState, hero, enemy, hero.weapons[0], defenderWins);
    const h = useGame.getState().battle!.combatants.find((c) => c.id === hero.id)!;
    expect(h.wounds.current).toBeLessThan(before); // l'attaquant a encaissé la contre-attaque
    expect(useGame.getState().battle!.log.some((e) => /riposte|champion|contre/i.test(e.text))).toBe(true);
  });

  it('sans le Trait Champion → AUCUNE contre-attaque (l’attaquant est intact)', () => {
    seedBattleRng(7);
    const { hero, enemy } = setup([]); // pas de Champion
    const before = hero.wounds.current;
    applyAttackResult(useGame.getState, useGame.setState, hero, enemy, hero.weapons[0], defenderWins);
    const h = useGame.getState().battle!.combatants.find((c) => c.id === hero.id)!;
    expect(h.wounds.current).toBe(before);
  });

  it('Champion mais le défenseur PERD le Test opposé (advantageTo attacker) → pas de contre-attaque', () => {
    seedBattleRng(7);
    const { hero, enemy } = setup([{ id: 'champion' }]);
    const before = hero.wounds.current;
    applyAttackResult(useGame.getState, useGame.setState, hero, enemy, hero.weapons[0],
      { ...defenderWins, advantageTo: 'attacker', netSL: 1 });
    const h = useGame.getState().battle!.combatants.find((c) => c.id === hero.id)!;
    expect(h.wounds.current).toBe(before);
  });

  const rapide: Weapon = { label: 'Rapière', type: 'melee', damage: { plusBF: true, flat: 0, bare: true }, qualities: [{ id: 'rapide' }] } as never;
  const lente: Weapon = { label: 'Hache', type: 'melee', damage: { plusBF: true, flat: 0, bare: true }, qualities: [] } as never;

  it('Riposte (talent) + arme de parade RAPIDE → contre-attaque', () => {
    seedBattleRng(7);
    const { hero, enemy } = setup([]); // pas de Champion
    enemy.talents = [{ talentId: 'riposte', times: 1 }] as never; // le défenseur a Riposte
    const before = hero.wounds.current;
    applyAttackResult(useGame.getState, useGame.setState, hero, enemy, hero.weapons[0], { ...defenderWins, parryWeapon: rapide });
    const h = useGame.getState().battle!.combatants.find((c) => c.id === hero.id)!;
    expect(h.wounds.current).toBeLessThan(before); // riposte avec arme Rapide
  });

  it('Riposte (talent) mais arme de parade NON Rapide → pas de contre-attaque', () => {
    seedBattleRng(7);
    const { hero, enemy } = setup([]);
    enemy.talents = [{ talentId: 'riposte', times: 1 }] as never;
    const before = hero.wounds.current;
    applyAttackResult(useGame.getState, useGame.setState, hero, enemy, hero.weapons[0], { ...defenderWins, parryWeapon: lente });
    const h = useGame.getState().battle!.combatants.find((c) => c.id === hero.id)!;
    expect(h.wounds.current).toBe(before); // Riposte exige une arme de parade Rapide (LDB 10)
  });
});
