import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { useGame, type BattleState } from './store';
import { applyShieldReaction } from './combatFlow';
import { shieldReactionCost } from '../engine/combatFeatures/dispatch';
import { seedBattleRng } from './battleRng';
import { setRule, resetRule } from '../engine/policy';
import type { Combatant, Weapon } from '../engine/types';
import type { Scene } from './scene';

/**
 * Porte-Bouclier — variante « Avantage de groupe » (AA 13 l.84, VERBATIM) : « Quand vous utilisez un
 * bouclier pour vous défendre, une fois par Round, vous pouvez dépenser 2 Avantages soit pour causer des
 * Dégâts quand vous êtes attaqué comme s'il s'agissait de votre Action, soit pour pousser votre adversaire
 * sur 2 mètres dans la direction directement opposée à vous et ne plus être considéré comme Engagé. »
 * Réaction à coût d'Avantages de RÉSERVE : coût/cadence en donnée, débit par `campSpend`, effet par les
 * coutures existantes (poussée + désengagement / Dégâts).
 */
const chars = { 'capacite-de-combat': 50, 'capacite-de-tir': 30, force: 45, endurance: 40, initiative: 40, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 };
const SHIELD: Weapon = { name: 'Bouclier', uid: 'sh1', trappingId: 'bouclier', type: 'melee', damage: { plusBF: true, flat: 0, bare: true }, qualities: [{ id: 'protectrice', value: 2 }] } as never;
const SWORD: Weapon = { name: 'Épée', uid: 'sw1', type: 'melee', damage: { plusBF: true, flat: 2, bare: false }, qualities: [] } as never;

const scene = (): Scene => {
  const w = 10, h = 10;
  const tiles = new Array(w * h).fill('herbe');
  return { id: 's', name: 's', dimensions: { w, h }, ambiance: 'jour', layers: [{ z: 0, tiles }], entities: [], dialogues: [], triggers: [], encounters: [] } as unknown as Scene;
};

function setup(defenderTalents: { talentId: string; times: number }[], reserve: number): { attacker: Combatant; defender: Combatant } {
  const defender = {
    id: 'd1', name: 'Défenseur', kind: 'hero', characteristics: chars, wounds: { current: 30, max: 30 },
    advantage: reserve, conditions: [], movement: 4, skills: [], talents: defenderTalents, traits: [], engagedWith: ['a1'], pos: { x: 5, y: 5 },
    size: 'moyenne', weapons: [SWORD, SHIELD], armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 }, items: [], fate: 0,
  } as unknown as Combatant;
  const attacker = {
    id: 'a1', name: 'Attaquant', kind: 'enemy', characteristics: chars, wounds: { current: 20, max: 20 },
    advantage: 0, conditions: [], movement: 4, skills: [], talents: [], traits: [], engagedWith: ['d1'], pos: { x: 4, y: 5 },
    size: 'moyenne', weapons: [SWORD], items: [], criticalWounds: 0,
    armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
  } as unknown as Combatant;
  const battle: BattleState = {
    combatants: [defender, attacker], order: [defender.id, attacker.id], baseOrder: [defender.id, attacker.id],
    turn: 1, round: 1, action: null, selectedSpellId: null, reachable: new Map(),
    movementUsed: 0, movedPreAction: false, acted: false, log: [], over: null,
    advantagePools: { allies: reserve, foes: 0 },
  } as unknown as BattleState;
  useGame.setState({ battle, mode: 'battle', scene: scene() });
  return { attacker, defender };
}

const G = useGame.getState;
const S = useGame.setState;
const alliesPool = () => useGame.getState().battle!.advantagePools!.allies;
const cur = (id: string) => useGame.getState().battle!.combatants.find((c) => c.id === id)!;

describe('Porte-Bouclier — réaction à coût d’Avantages (variante AA 13 l.84)', () => {
  beforeEach(() => { useGame.setState({ battle: null }); setRule('combat-aa-avantage-groupe', true); seedBattleRng(7); });
  afterEach(() => resetRule('combat-aa-avantage-groupe'));

  it('offre la réaction (coût 2) au Bouclier + talent, en mode groupe seulement', () => {
    const { defender } = setup([{ talentId: 'porte-bouclier', times: 1 }], 3);
    expect(shieldReactionCost(defender, SHIELD)).toBe(2); // Bouclier + talent en mode groupe
    expect(shieldReactionCost(defender, SWORD)).toBe(0); // pas un Bouclier
    resetRule('combat-aa-avantage-groupe');
    expect(shieldReactionCost(defender, SHIELD)).toBe(0); // mode Livre de base → variante absente
    setRule('combat-aa-avantage-groupe', true);
  });

  it('sans le talent → aucune réaction offerte', () => {
    const { defender } = setup([], 3);
    expect(shieldReactionCost(defender, SHIELD)).toBe(0);
  });

  it('« Repousser » : débite 2 de la réserve, repousse l’attaquant de 2 m et rompt l’Engagement', () => {
    const { attacker, defender } = setup([{ talentId: 'porte-bouclier', times: 1 }], 3);
    applyShieldReaction(G, S, defender, attacker, 'push', SHIELD);
    expect(alliesPool()).toBe(1); // 3 − 2
    expect(cur('a1').pos).toEqual({ x: 3, y: 5 }); // 1 case (2 m) dans la direction opposée au défenseur
    expect(cur('d1').engagedWith).not.toContain('a1'); // « ne plus être considéré comme Engagé »
    expect(cur('a1').engagedWith).not.toContain('d1');
    expect(cur('d1').usedShieldReactionRound).toBe(true);
  });

  it('« Dégâts » : débite 2 de la réserve et inflige des Blessures à l’attaquant', () => {
    const { attacker, defender } = setup([{ talentId: 'porte-bouclier', times: 1 }], 3);
    const before = cur('a1').wounds.current;
    applyShieldReaction(G, S, defender, attacker, 'damage', SHIELD);
    expect(alliesPool()).toBe(1); // 3 − 2
    expect(cur('a1').wounds.current).toBeLessThan(before); // une frappe « comme si c’était son Action »
    expect(cur('d1').usedShieldReactionRound).toBe(true);
  });

  it('cadence 1×/Round : une 2ᵉ réaction le même Round est inerte (aucun débit)', () => {
    const { attacker, defender } = setup([{ talentId: 'porte-bouclier', times: 1 }], 4);
    applyShieldReaction(G, S, defender, attacker, 'push', SHIELD);
    expect(alliesPool()).toBe(2);
    applyShieldReaction(G, S, cur('d1'), cur('a1'), 'push', SHIELD); // déjà utilisée ce Round
    expect(alliesPool()).toBe(2); // aucun nouveau débit
  });

  it('réserve insuffisante (< coût) → réaction inerte', () => {
    const { attacker, defender } = setup([{ talentId: 'porte-bouclier', times: 1 }], 1);
    applyShieldReaction(G, S, defender, attacker, 'push', SHIELD);
    expect(alliesPool()).toBe(1); // pas assez → rien dépensé
    expect(cur('d1').usedShieldReactionRound).toBeFalsy();
    expect(cur('a1').pos).toEqual({ x: 4, y: 5 }); // pas repoussé
  });

  it('sans le talent → réaction inerte (aucun dispatch par nom)', () => {
    const { attacker, defender } = setup([], 3);
    applyShieldReaction(G, S, defender, attacker, 'push', SHIELD);
    expect(alliesPool()).toBe(3);
    expect(cur('a1').pos).toEqual({ x: 4, y: 5 });
  });
});
