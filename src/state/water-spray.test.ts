/**
 * « Asperger d'eau » (MDG 16 l.19, #497) — flux combat (`battleWater`, `combatSlice.ts`). Contre-mesure
 * MAISON à la suffocation « hors terrain » d'une Créature marine : Action DIRECTE (aucun jet), gate =
 * contenant d'eau porté (`waterContainer`, `Outre à eau`/`Seau`), cible = allié marine adjacent hors de
 * l'eau. Pose `wateredThisRound`, consomme l'Action ; `suffocationTick` (engine/suffocation.ts) lit et
 * consomme ce flag.
 */
import { describe, it, expect } from 'vitest';
import { useGame } from './store';
import type { Combatant, ItemInstance } from '../engine/types';
import { suffocationTick } from '../engine/suffocation';
import { objetDeTest } from '../engine/objetDeTest.testkit';

function hero(p: Partial<Combatant>): Combatant {
  return {
    id: 'h', label: 'Doc', kind: 'hero',
    characteristics: { 'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 30, endurance: 30, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 },
    wounds: { current: 10, max: 12 }, advantage: 0, conditions: [], movement: 4,
    weapons: [], armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    skills: [], talents: [], traits: [], groups: [], fortune: 0, resilience: 0,
    pos: { x: 1, y: 1 }, ...p,
  } as Combatant;
}

const outreAEau = (): ItemInstance => objetDeTest({ uid: 'outre1', trappingId: 'outre-a-eau' });

function marine(p: Partial<Combatant>): Combatant {
  return hero({
    kind: 'hero', traits: [{ id: 'creature-marine' }], offTerrain: true, wounds: { current: 5, max: 12 }, ...p,
  } as unknown as Partial<Combatant>);
}

function setBattle(combatants: Combatant[], activeId: string) {
  const order = combatants.map((c) => c.id);
  useGame.setState({
    mode: 'battle',
    battle: {
      combatants, order, baseOrder: order, turn: order.indexOf(activeId), round: 1,
      action: null, selectedSpellId: null, reachable: new Map(), movementUsed: 0, acted: false,
      log: [], over: null,
    } as any,
  });
}

const battleWater = (targetId?: string): void => useGame.getState().battleWater(targetId);

describe('battleWater — « Asperger d’eau » (MDG 16 l.19, #497)', () => {
  it('gate : sans contenant d’eau, aucun effet (Action non consommée)', () => {
    const aspergeur = hero({ id: 'a', pos: { x: 1, y: 1 } });
    const cible = marine({ id: 'm', pos: { x: 2, y: 1 } });
    setBattle([aspergeur, cible], 'a');
    battleWater();
    expect(useGame.getState().battle!.acted).toBe(false);
    expect(useGame.getState().battle!.combatants.find((c) => c.id === 'm')!.wateredThisRound).toBeUndefined();
  });

  it('gate : aucune cible marine hors de l’eau adjacente → aucun effet', () => {
    const aspergeur = hero({ id: 'a', pos: { x: 1, y: 1 }, items: [outreAEau()] });
    const cible = marine({ id: 'm', pos: { x: 2, y: 1 }, offTerrain: false }); // déjà dans l'eau
    setBattle([aspergeur, cible], 'a');
    battleWater();
    expect(useGame.getState().battle!.acted).toBe(false);
  });

  it('commit : pose wateredThisRound sur la cible adjacente, consomme l’Action, aucun jet', () => {
    const aspergeur = hero({ id: 'a', pos: { x: 1, y: 1 }, items: [outreAEau()] });
    const cible = marine({ id: 'm', pos: { x: 2, y: 1 } });
    setBattle([aspergeur, cible], 'a');
    battleWater('m');
    const battle = useGame.getState().battle!;
    expect(battle.combatants.find((c) => c.id === 'm')!.wateredThisRound).toBe(true);
    expect(battle.acted).toBe(true);
    expect(battle.action).toBeNull();
  });

  it('suffocationTick : le Round aspergé n’inflige aucune Blessure, puis le flag est consommé (Round suivant → suffoque de nouveau)', () => {
    const aspergeur = hero({ id: 'a', pos: { x: 1, y: 1 }, items: [outreAEau()] });
    const cible = marine({ id: 'm', pos: { x: 2, y: 1 } });
    setBattle([aspergeur, cible], 'a');
    battleWater('m');
    const m = useGame.getState().battle!.combatants.find((c) => c.id === 'm')!;
    const before = m.wounds.current;
    suffocationTick(m);
    expect(m.wounds.current).toBe(before); // aspergée ce Round : aucune perte
    expect(m.wateredThisRound).toBeUndefined(); // consommée
    suffocationTick(m); // pas reposée → suffoque
    expect(m.wounds.current).toBe(before - 1);
  });

  it('déjà agi ce Round (battle.acted) : refuse', () => {
    const aspergeur = hero({ id: 'a', pos: { x: 1, y: 1 }, items: [outreAEau()] });
    const cible = marine({ id: 'm', pos: { x: 2, y: 1 } });
    setBattle([aspergeur, cible], 'a');
    useGame.setState({ battle: { ...useGame.getState().battle!, acted: true } });
    battleWater('m');
    expect(useGame.getState().battle!.combatants.find((c) => c.id === 'm')!.wateredThisRound).toBeUndefined();
  });
});
