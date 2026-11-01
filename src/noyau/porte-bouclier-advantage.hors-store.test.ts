import { describe, it, expect, beforeEach } from 'vitest';
import { itemFromTrappingById, weaponFromItem } from '../engine/items';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import type { BattleState } from './etat';
import { applyAttackResult } from './combatFlow';
import { seedBattleRng } from './battleRng';
import { setRule } from '../engine/policy';
import type { Combatant, Weapon } from '../engine/types';
import type { AttackResult } from '../engine/combat';
import { blessuresSurLeProfil, blessuresDeBase } from '../engine/combattantDeTest.testkit';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });

/**
 * Porte-Bouclier (LDB 10 l.972, VERBATIM) : « vous gagnez un nombre d'Avantages égal au nombre de Niveaux
 * que vous possédez en Porte-bouclier SI VOUS PERDEZ le Test opposé » en vous défendant au Bouclier. C'est
 * une consolation de défense PERDUE (« situation désespérée »), pas un bonus de défense gagnée — le code
 * l'accordait à tort sur une défense GAGNÉE (advantageTo 'defender'). Fixe la fidélité RAW.
 */
const chars = { 'capacite-de-combat': 50, 'capacite-de-tir': 30, force: 45, endurance: 40, initiative: 40, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 };
const SHIELD: Weapon = { ...weaponFromItem(itemFromTrappingById('bouclier')!), label: 'Bouclier', trappingId: 'bouclier', type: 'melee', damage: { plusBF: true, flat: 0, bare: true }, qualities: [{ id: 'protectrice', value: 2 }] } as never;
const SWORD: Weapon = { label: 'Épée', type: 'melee', damage: { plusBF: true, flat: 0, bare: true }, qualities: [] } as never;

function setup(defenderTalents: { talentId: string; times: number }[]): { attacker: Combatant; defender: Combatant } {
  const defender = blessuresSurLeProfil({
    id: 'd1', label: 'Défenseur', kind: 'enemy', characteristics: chars, wounds: blessuresDeBase(30),
    advantage: 0, conditions: [], movement: 4, skills: [], talents: defenderTalents, traits: [], engagedWith: [], pos: { x: 1, y: 0 },
    size: 'moyenne', weapons: [SHIELD], armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 }, items: [],
  }) as unknown as Combatant;
  const attacker = blessuresSurLeProfil({
    id: 'a1', label: 'Attaquant', kind: 'hero', characteristics: chars, wounds: blessuresDeBase(20),
    advantage: 0, conditions: [], movement: 4, skills: [], talents: [], traits: [], engagedWith: [], pos: { x: 0, y: 0 },
    size: 'moyenne', weapons: [SWORD], items: [], criticalWounds: 0, fate: 0,
    armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
  }) as unknown as Combatant;
  const battle: BattleState = {
    combatants: [defender, attacker], order: [defender.id, attacker.id], baseOrder: [defender.id, attacker.id],
    turn: 1, round: 1, action: null, selectedSpellId: null, reachable: new Map(),
    movementUsed: 0, movedPreAction: false, acted: false, log: [], over: null,
  } as unknown as BattleState;
  banc.setState({ battle, mode: 'battle' });
  return { attacker, defender };
}

/** Attaque où le DÉFENSEUR PERD (advantageTo 'attacker'), a paré au Bouclier, encaisse une Blessure. */
const loseWithShield: AttackResult = {
  hit: true, attackerRoll: 20, defenderRoll: 75, netSL: 2, location: 'corps', damage: 5, woundsLost: 5,
  critical: false, advantageTo: 'attacker', defenderDefeated: false, log: '', parryWeapon: SHIELD,
  defenderDetail: { target: 50, roll: 75, dr: -2 } as never,
};
const adv = (id: string) => banc.getState().battle!.combatants.find((c) => c.id === id)!.advantage;

describe('Porte-Bouclier — Avantage en défense PERDUE (LDB 10 l.972)', () => {
  it('défense PERDUE au Bouclier + Porte-Bouclier 2 → le défenseur gagne 2 Avantages (consolation)', () => {
    seedBattleRng(7);
    const { attacker, defender } = setup([{ talentId: 'porte-bouclier', times: 2 }]);
    applyAttackResult(banc.getState, banc.setState, attacker, defender, attacker.weapons[0], loseWithShield);
    expect(adv(defender.id)).toBe(2); // +niveau, APRÈS la perte d'Avantage due à la Blessure
  });

  it('défense GAGNÉE au Bouclier → PAS de bonus Porte-Bouclier (juste le +1 normal, plus l’ancien double-compte)', () => {
    seedBattleRng(7);
    const { attacker, defender } = setup([{ talentId: 'porte-bouclier', times: 2 }]);
    applyAttackResult(banc.getState, banc.setState, attacker, defender, attacker.weapons[0],
      { ...loseWithShield, hit: false, woundsLost: 0, advantageTo: 'defender' });
    expect(adv(defender.id)).toBe(1); // défense gagnée = +1 standard, aucun niveau de Bouclier ajouté
  });

  it('défense PERDUE mais parade à l’ÉPÉE (pas un Bouclier) → aucune consolation', () => {
    seedBattleRng(7);
    const { attacker, defender } = setup([{ talentId: 'porte-bouclier', times: 2 }]);
    applyAttackResult(banc.getState, banc.setState, attacker, defender, attacker.weapons[0],
      { ...loseWithShield, parryWeapon: SWORD });
    expect(adv(defender.id)).toBe(0);
  });

  it('défense PERDUE au Bouclier mais SANS le Talent → aucune consolation', () => {
    seedBattleRng(7);
    const { attacker, defender } = setup([]);
    applyAttackResult(banc.getState, banc.setState, attacker, defender, attacker.weapons[0], loseWithShield);
    expect(adv(defender.id)).toBe(0);
  });

  it('variante « Avantage de groupe » (Aux Armes) → pas de gain par-combattant (shieldAdvantageLevel = 0)', () => {
    seedBattleRng(7);
    setRule('combat-aa-avantage-groupe', true);
    const { attacker, defender } = setup([{ talentId: 'porte-bouclier', times: 2 }]);
    applyAttackResult(banc.getState, banc.setState, attacker, defender, attacker.weapons[0], loseWithShield);
    expect(adv(defender.id)).toBe(0); // le gain va (ou non) à la réserve de camp, jamais au combattant
  });
});
