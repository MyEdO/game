import { describe, it, expect, beforeEach } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import type { BattleState } from './etat';
import { applyAttackResult } from './combatFlow';
import { draineCascade } from './cascade.testkit';
import type { AttackResult } from '../engine/combat';
import { stacks, COND } from '../engine/conditions';
import { seedBattleRng } from './battleRng';
import { emptyScene } from './monde/scene';
import { armeDeTest } from '../engine/objetsDeTest.testkit';
import type { Combatant } from '../engine/types';
import { blessuresSurLeProfil, blessuresDeBase } from '../engine/combattantDeTest.testkit';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); seedBattleRng(20261116); });

const CHARS = { 'capacite-de-combat': 40, 'capacite-de-tir': 45, force: 40, endurance: 40, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 };
const ARMURE = { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 };

const combattant = (id: string, kind: 'heros' | 'ennemi', x: number, traits: { id: string }[] = []): Combatant => (blessuresSurLeProfil({
  id, name: id, kind, characteristics: CHARS, wounds: blessuresDeBase(20), advantage: 0, conditions: [], traits,
  movement: 4, skills: [], talents: [], engagedWith: [], pos: { x, y: 7 }, size: 'moyenne', weapons: [], items: [], armour: ARMURE,
}) as unknown as Combatant);

const RATE: AttackResult = { hit: false, attackerRoll: 72, netSL: -3, critical: false, advantageTo: null, defenderDefeated: false, log: 'manque sa cible.' };

/** Un tir raté de `trappingId` sur la cible, une créature Nerveuse présente au combat : ses États Brisé. */
function brisesApresLeTir(trappingId: string): number {
  const cs = [combattant('h1', 'heros', 2), combattant('e1', 'ennemi', 20), combattant('n1', 'ennemi', 12, [{ id: 'nerveux' }])];
  const battle = {
    combatants: cs, order: cs.map((c) => c.id), baseOrder: cs.map((c) => c.id), turn: 0, round: 1, action: null, selectedSpellId: null,
    reachable: new Map(), movementUsed: 0, movedPreAction: false, acted: false, log: [], over: null, zones: [],
  } as unknown as BattleState;
  banc.setState({ battle, mode: 'battle', scene: { ...emptyScene('scene-test'), metresPerTile: 1 }, gameTime: 12 * 60, pendingCascade: null, pendingFateSave: null });
  const [a, e] = banc.getState().battle!.combatants;
  applyAttackResult(banc.getState, banc.setState, a, e, armeDeTest(trappingId), RATE);
  draineCascade(banc.getState, 20, () => 4);
  return stacks(banc.getState().battle!.combatants.find((c) => c.id === 'n1')!, COND.brise);
}

/** Nerveux, bruits forts (LDB 85 l.249) : le tir d'une arme à poudre (`armeAPoudre`, LDB 14 l.34 ; #4345). */
describe('Nerveux effrayé par le tir d’une arme à poudre (LDB 85 l.249 ; #4345)', () => {
  it.each(['canon-petit', 'pistolet', 'batterie-tonnerre-de-feu-ade2'])('%s : +3 Brisé', (id) => {
    expect(brisesApresLeTir(id)).toBe(3);
  });
  it.each(['mangonneau-ade2', 'arc-long', 'canon-a-flammes-nain-ade2'])('%s : aucun Brisé', (id) => {
    expect(brisesApresLeTir(id)).toBe(0);
  });
});
