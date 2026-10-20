/**
 * Porte-bouclier, variante « Avantage de groupe » (AA 13 l.80, l.84 ; AA 11 l.71). La frappe EST le Test
 * opposé de défense : gagné, il inflige les Dégâts du bouclier + le DR opposé par l'applicateur de la
 * touche (LDB 13 l.151, l.183 ; LDB 18 l.17, l.46) ; perdu, rien (LDB 13 l.123). #1595 c.6234104573 ; #1093.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { useGame, type BattleState } from './store';
import { applyAttackResult } from '../noyau/combatFlow';
import { shieldReactionCost } from '../engine/combatFeatures/dispatch';
import { seedBattleRng } from '../noyau/battleRng';
import { setRule, resetRule } from '../engine/policy';
import { isOutOfAction } from '../engine/conditions';
import type { AttackResult } from '../engine/combat';
import type { Combatant, Weapon } from '../engine/types';
import { testScene } from '../scenes/test-fixture';
import { avanceEtapeCascade, poseSurDeNonTombe } from './cascade.testkit';

const chars = { 'capacite-de-combat': 50, 'capacite-de-tir': 30, force: 45, endurance: 40, initiative: 40, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 };
const SHIELD: Weapon = { name: 'Bouclier', label: 'Bouclier', uid: 'sh1', trappingId: 'bouclier', type: 'melee', damage: { plusBF: true, flat: 2, bare: false }, qualities: [] } as never;
const SWORD: Weapon = { name: 'Épée', label: 'Épée', uid: 'sw1', type: 'melee', damage: { plusBF: true, flat: 4, bare: false }, qualities: [] } as never;
const ARM0 = { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 };

function setup(o: { talents?: { talentId: string; times: number }[]; reserve: number; pbAttaquant?: number; important?: boolean; traitsAttaquant?: { id: string; value?: number }[]; pnj?: boolean }): void {
  seedBattleRng(7);
  const defender = {
    id: 'd1', name: 'Défenseur', label: 'Défenseur', kind: o.pnj ? 'enemy' : 'hero', important: true, characteristics: chars, wounds: { current: 30, max: 30 },
    advantage: 0, conditions: [], movement: 4, skills: [], talents: o.talents ?? [{ talentId: 'porte-bouclier', times: 1 }], traits: [], engagedWith: ['a1'], pos: { x: 5, y: 5 },
    size: 'moyenne', weapons: [SWORD, SHIELD], armour: ARM0, items: [], fate: 0, criticalWounds: 0, traumas: [],
  } as unknown as Combatant;
  const attacker = {
    id: 'a1', name: 'Attaquant', label: 'Attaquant', kind: o.pnj ? 'hero' : 'enemy', important: o.important ?? true, characteristics: chars, wounds: { current: o.pbAttaquant ?? 20, max: 20 },
    advantage: 0, conditions: [], movement: 4, skills: [], talents: [], traits: o.traitsAttaquant ?? [], engagedWith: ['d1'], pos: { x: 4, y: 5 },
    size: 'moyenne', weapons: [SWORD], items: [], criticalWounds: 0, traumas: [], armour: ARM0,
  } as unknown as Combatant;
  const battle = {
    combatants: [defender, attacker], order: [attacker.id, defender.id], baseOrder: [attacker.id, defender.id],
    turn: 0, round: 1, action: null, selectedSpellId: null, reachable: new Map(),
    movementUsed: 0, movedPreAction: false, acted: false, log: [], over: null,
    advantagePools: o.pnj ? { allies: 0, foes: o.reserve } : { allies: o.reserve, foes: 0 },
  } as unknown as BattleState;
  useGame.setState({
    battle, mode: 'battle', scene: testScene(), party: [o.pnj ? attacker : defender], pendingDefense: null, pendingAttack: null, pendingCascade: null,
    suspendedCascades: [], pendingLogQueue: [], journal: [], net: { ...useGame.getState().net, mode: 'local', mySeat: 0, gmSeat: undefined, ownership: {} },
  } as never);
}

/** Parade au Bouclier, Test opposé GAGNÉ par la défense au jet `roll`, DR opposé 3. */
const defenseGagnee = (roll = 24): AttackResult => ({
  hit: false, attackerRoll: 64, defenderRoll: roll, netSL: 3, critical: false, advantageTo: 'defender', defenderDefeated: false, log: 'Attaquant manque Défenseur.',
  parryWeapon: SHIELD,
  defenderDetail: { label: 'Corps à corps', base: 50, target: 50, roll, success: true, sl: 2, mods: [], mode: 'parade' },
  attackerDetail: { label: 'Corps à corps', base: 50, target: 50, roll: 64, success: false, sl: -1, mods: [] },
} as unknown as AttackResult);

/** Parade au Bouclier, Test opposé PERDU : l'attaquant touche. */
const defensePerdue = (): AttackResult => ({
  hit: true, attackerRoll: 24, defenderRoll: 64, netSL: 2, critical: false, advantageTo: 'attacker', defenderDefeated: false, location: 'corps', damage: 6, woundsLost: 2,
  log: 'Attaquant touche Défenseur.', parryWeapon: SHIELD,
  defenderDetail: { label: 'Corps à corps', base: 50, target: 50, roll: 64, success: false, sl: -1, mods: [], mode: 'parade' },
  attackerDetail: { label: 'Corps à corps', base: 50, target: 50, roll: 24, success: true, sl: 2, mods: [] },
} as unknown as AttackResult);

const G = useGame.getState;
const S = useGame.setState;
const alliesPool = (): number => G().battle!.advantagePools!.allies;
const cur = (id: string): Combatant => G().battle!.combatants.find((c) => c.id === id)!;
const draine = (): void => { for (let k = 0; k < 20 && G().pendingCascade; k++) avanceEtapeCascade(G, poseSurDeNonTombe(1), () => 'subir'); };
const coup = (res: AttackResult, reaction: 'damage' | 'push', suite: Record<string, unknown> = {}) =>
  applyAttackResult(G, S, cur('a1'), cur('d1'), SWORD, res, { suite: { enchainement: { mode: 'aucun' }, reaction, ...suite } });

describe('Porte-bouclier — réaction à coût d’Avantages (AA 13 l.84)', () => {
  beforeEach(() => { useGame.setState({ battle: null }); setRule('combat-aa-avantage-groupe', true); });
  afterEach(() => { resetRule('combat-aa-avantage-groupe'); resetRule('combat-sudden-death'); });

  it('offre la réaction (coût 2) au Bouclier + talent ; ni à l’Épée, ni sans le talent', () => {
    setup({ reserve: 3 });
    expect(shieldReactionCost(cur('d1'), SHIELD)).toBe(2);
    expect(shieldReactionCost(cur('d1'), SWORD)).toBe(0);
    setup({ reserve: 3, talents: [] });
    expect(shieldReactionCost(cur('d1'), SHIELD)).toBe(0);
  });

  it('B1 — défense gagnée : Dégâts du bouclier + DR opposé, par la touche (BF 4 + 2 + DR 3 − BE 4 = 5)', () => {
    setup({ reserve: 3 });
    const avant = alliesPool();
    coup(defenseGagnee(), 'damage'); draine();
    expect(cur('a1').wounds.current).toBe(15);
    expect(alliesPool(), '+1 de la défense gagnée, −2 de la réaction (LDB 14 l.208-209)').toBe(avant + 1 - 2);
    expect(cur('d1').usedShieldReactionRound).toBe(true);
  });

  it('B2 — dépassement des PB : Blessure critique (LDB 18 l.17)', () => {
    setup({ reserve: 3, pbAttaquant: 2 });
    coup(defenseGagnee(), 'damage'); draine();
    expect(cur('a1').wounds.current).toBe(0);
    expect(cur('a1').criticalWounds ?? 0).toBeGreaterThan(0);
  });

  it('B2 — dépassement d’un PNJ mineur : Mort subite, hors de combat (LDB 18 l.46)', () => {
    setup({ reserve: 3, pbAttaquant: 2, important: false });
    coup(defenseGagnee(), 'damage'); draine();
    expect(isOutOfAction(cur('a1'))).toBe(true);
  });

  it('B3 — défense perdue : aucune frappe, aucun débit (LDB 13 l.123)', () => {
    setup({ reserve: 3 });
    coup(defensePerdue(), 'damage'); draine();
    expect(cur('a1').wounds.current).toBe(20);
    expect(alliesPool()).toBe(3);
    expect(cur('d1').usedShieldReactionRound).toBeFalsy();
  });

  it('B4 — une fois par Round : la 2ᵉ défense gagnée ne frappe ni ne débite', () => {
    setup({ reserve: 4 });
    coup(defenseGagnee(), 'damage'); draine();
    const pb = cur('a1').wounds.current;
    const pool = alliesPool();
    expect(pb).toBeLessThan(20);
    coup(defenseGagnee(), 'damage'); draine();
    expect(cur('a1').wounds.current).toBe(pb);
    expect(alliesPool()).toBe(pool + 1);
  });

  it('B5 — mode Livre de base : réaction absente, aucune frappe', () => {
    resetRule('combat-aa-avantage-groupe');
    setup({ reserve: 3 });
    expect(shieldReactionCost(cur('d1'), SHIELD)).toBe(0);
    coup(defenseGagnee(), 'damage'); draine();
    expect(cur('a1').wounds.current).toBe(20);
  });

  it('B6 — « Repousser » : débite 2, repousse l’attaquant de 2 m et rompt l’Engagement', () => {
    setup({ reserve: 3 });
    coup(defenseGagnee(), 'push'); draine();
    expect(alliesPool()).toBe(3 + 1 - 2);
    expect(cur('a1').pos).toEqual({ x: 3, y: 5 });
    expect(cur('d1').engagedWith).not.toContain('a1');
    expect(cur('a1').engagedWith).not.toContain('d1');
    expect(cur('a1').wounds.current).toBe(20);
  });

  it('B6 — réserve insuffisante : réaction inerte', () => {
    setup({ reserve: 0 });
    coup(defenseGagnee(), 'push'); draine();
    expect(cur('d1').usedShieldReactionRound).toBeFalsy();
    expect(cur('a1').pos).toEqual({ x: 4, y: 5 });
  });

  it('B7 — une sauvegarde suspend la frappe, puis la reprise la termine et rend l’Action', () => {
    setup({ reserve: 3, traitsAttaquant: [{ id: 'demoniaque', value: 9 }] });
    coup(defenseGagnee(), 'damage', { restitution: { prevActed: false } });
    expect(G().pendingCascade, 'la sauvegarde de l’attaquant tient la main').not.toBeNull();
    expect(G().battle!.acted, 'la suite du coup attend la reprise').toBe(true);
    draine();
    expect(cur('a1').wounds.current).toBeLessThan(20);
    expect(G().battle!.acted, 'la suite du coup a rendu l’Action').toBe(false);
  });

  it('B8 — PNJ Porte-bouclier, défense gagnée : l’IA déclare les Dégâts, la frappe part (AA 13 l.84)', () => {
    setup({ reserve: 3, pnj: true });
    applyAttackResult(G, S, cur('a1'), cur('d1'), SWORD, defenseGagnee(), { suite: { enchainement: { mode: 'aucun' } } }); draine();
    expect(cur('a1').wounds.current).toBe(15);
    expect(cur('d1').usedShieldReactionRound).toBe(true);
  });

  it('B8 — héros surfacé, réaction non déclarée : aucune frappe', () => {
    setup({ reserve: 3 });
    applyAttackResult(G, S, cur('a1'), cur('d1'), SWORD, defenseGagnee(), { suite: { enchainement: { mode: 'aucun' } } }); draine();
    expect(cur('a1').wounds.current).toBe(20);
  });
});
