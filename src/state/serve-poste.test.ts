import { describe, it, expect } from 'vitest';
import { availableAttacks } from './combatManeuvers';
import { firedAttackBlock } from './combatFlow';
import type { Combatant, ShipPoste } from '../engine/types';
import type { BattleState, GameState } from './store';
import { objetDeTest } from '../engine/objetDeTest.testkit';

/**
 * Étape 3 « Servir un poste » (MDG 12-13). Un chef de pièce (`mannedPoste`) voit une attaque DÉDIÉE
 * « Servir <arme> » dans `availableAttacks`, portant l'arme du poste via `weaponUid` ÉPINGLÉ (même si le
 * servant garde une arme perso de mêlée pour l'abordage). Le tir ne porte que dans l'ARC de la bordée :
 * `firedAttackBlock` honore le `weaponUid` → arc relatif au cap du navire support (parité réticule/clic).
 */
const POSTE_UID = 'p-pierrier';
const cannon = { label: 'Pierrier', type: 'ranged' as const, damage: { plusBF: false, flat: 9 }, range: 50, qualities: [], uid: POSTE_UID, mountSide: 'tribord' as const };
const personalSword = { label: 'Épée', type: 'melee' as const, damage: { plusBF: true, flat: 0 }, reach: 1, qualities: [], uid: 'sword' };
const poste: ShipPoste = { item: objetDeTest({ uid: POSTE_UID, trappingId: 'pierrier', kind: 'ranged' }), side: 'tribord', crewIds: ['gunner'] };

const gunner = (): Combatant =>
  ({
    id: 'gunner', label: 'Canonnier', kind: 'hero',
    characteristics: { 'capacite-de-combat': 30, 'capacite-de-tir': 45, force: 30, endurance: 30, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 },
    wounds: { current: 12, max: 12 }, advantage: 0, conditions: [], skills: [], talents: [],
    weapons: [personalSword, cannon], armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    movement: 4, pos: { x: 5, y: 5 }, mannedPoste: poste, loaded: true,
  }) as unknown as Combatant;

const enemyAt = (id: string, x: number, y: number): Combatant =>
  ({ id, label: id, kind: 'enemy', pos: { x, y }, conditions: [], weapons: [] }) as unknown as Combatant;

/** Coque AMIE dont l'équipage inclut le canonnier — son cap (`facing[hull]`) détermine l'arc. */
const hull = (): Combatant =>
  ({ id: 'hull', label: 'Chaloupe', kind: 'npc', pos: { x: 5, y: 5 }, crewIds: ['gunner'], conditions: [], weapons: [] }) as unknown as Combatant;

const battle = (combatants: Combatant[]): BattleState =>
  ({ combatants, order: combatants.map((c) => c.id), turn: 0, movementUsed: 0, action: null, selectedSpellId: null, acted: false, over: null }) as unknown as BattleState;

const mkGet = (combatants: Combatant[], heading: string): (() => GameState) =>
  (() => ({ battle: battle(combatants), facing: { hull: heading }, gameTime: 0, log: () => {} })) as unknown as () => GameState;

describe('Étape 3 — Servir un poste (availableAttacks + arc)', () => {
  it('un chef de pièce voit l’attaque « Servir », portant l’arme du poste (weaponUid épinglé)', () => {
    const g = gunner();
    const serve = availableAttacks(g, battle([g, hull(), enemyAt('east', 9, 5)])).find((o) => o.id === 'poste');
    expect(serve).toBeDefined();
    expect(serve!.weaponUid).toBe(POSTE_UID); // le canon est ÉPINGLÉ (pas l'arme perso auto-choisie)
    expect(serve!.label).toContain('Pierrier');
    expect(serve!.cost.action).toBe(true); // servir la pièce coûte l'Action
  });

  it('sans mannedPoste : aucune option « Servir »', () => {
    const g = gunner();
    delete (g as { mannedPoste?: unknown }).mannedPoste;
    expect(availableAttacks(g, battle([g, enemyAt('east', 9, 5)])).some((o) => o.id === 'poste')).toBe(false);
  });

  it('le tir du poste ne porte que dans l’ARC de bordée — weaponUid → cap du navire (MDG 12-13)', () => {
    const g = gunner();
    const east = enemyAt('east', 9, 5); // tribord d'un cap Nord
    const west = enemyAt('west', 1, 5); // bâbord
    const get = mkGet([g, hull(), east, west], 'N');
    expect(firedAttackBlock(get, g, east, POSTE_UID)).toBeNull(); // dans l'arc tribord → le canon porte
    expect(firedAttackBlock(get, g, west, POSTE_UID)).toMatchObject({ reason: 'arc' }); // bâbord → hors arc
  });

  it('virer le navire au Sud inverse les bords (re-mappe l’arc du poste servi)', () => {
    const g = gunner();
    const east = enemyAt('east', 9, 5);
    const west = enemyAt('west', 1, 5);
    const get = mkGet([g, hull(), east, west], 'S');
    expect(firedAttackBlock(get, g, east, POSTE_UID)).toMatchObject({ reason: 'arc' });
    expect(firedAttackBlock(get, g, west, POSTE_UID)).toBeNull();
  });
});
