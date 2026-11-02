import { describe, it, expect } from 'vitest';
import { firedAttackBlock } from '../noyau/combatFlow';
import type { Combatant } from '../engine/types';
import type { GameState } from './store';
import { blessuresSurLeProfil, blessuresDeBase } from '../engine/combattantDeTest.testkit';

/**
 * INTÉGRATION bout-en-bout de la garde d'arc d'un poste : un canonnier (arme montée `mountSide`) servant un
 * navire ne peut tirer QUE dans l'arc de sa bordée, relatif au cap du navire (MDG 12-13). `firedAttackBlock`
 * (prédicat partagé réticule + clic) renvoie la raison `arc` hors-bordée, `null` dedans. KIND-AGNOSTIQUE :
 * `firedAttackBlock` ne s'arme que pour le héros (chemin joueur), mais la LOGIQUE (shipOfCrew/mountedWeaponBears)
 * ne regarde pas le kind — l'IA câblera le même prédicat.
 */
const cannon = { name: 'Canon', type: 'ranged' as const, damage: { plusBF: false, flat: 14 }, range: 75, qualities: [], mountSide: 'tribord' as const };

const gunner = (): Combatant =>
  (blessuresSurLeProfil({
    id: 'gunner', name: 'Canonnier', kind: 'hero',
    characteristics: { 'capacite-de-combat': 30, 'capacite-de-tir': 45, force: 30, endurance: 30, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 },
    wounds: blessuresDeBase(12), advantage: 0, conditions: [], skills: [], talents: [],
    weapons: [cannon], armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    movement: 4, pos: { x: 5, y: 5 },
  })) as unknown as Combatant;

const enemyAt = (id: string, x: number, y: number): Combatant =>
  ({ id, name: id, kind: 'enemy', pos: { x, y }, conditions: [], weapons: [] }) as unknown as Combatant;

/** Coque dont l'équipage inclut le canonnier — son cap détermine l'arc. */
const hull = (): Combatant =>
  ({ id: 'hull', name: 'Cogue', kind: 'enemy', pos: { x: 5, y: 5 }, crewIds: ['gunner'], conditions: [], weapons: [] }) as unknown as Combatant;

const mkGet = (combatants: Combatant[], heading: string): (() => GameState) =>
  (() => ({
    battle: { combatants, order: combatants.map((c) => c.id), turn: 0, movementUsed: 0, action: null, selectedSpellId: null, acted: false, over: null },
    facing: { hull: heading }, gameTime: 0, log: () => {},
  })) as unknown as () => GameState;

describe('firedAttackBlock — garde d’arc de bordée bout-en-bout (MDG 12-13)', () => {
  const east = enemyAt('east', 9, 5); // à l'est de la coque
  const west = enemyAt('west', 1, 5); // à l'ouest

  it('cap Nord : la cible à TRIBORD (est) porte → null ; à BÂBORD (ouest) → raison « arc »', () => {
    const g = gunner();
    const get = mkGet([g, hull(), east, west], 'N');
    expect(firedAttackBlock(get, g, east)).toBeNull(); // est = tribord d'un cap Nord → le canon tribord porte
    expect(firedAttackBlock(get, g, west)).toMatchObject({ reason: 'arc' }); // ouest = bâbord → hors arc
  });

  it('virer le navire au Sud inverse les bords : l’est passe HORS arc, l’ouest DEDANS', () => {
    const g = gunner();
    const get = mkGet([g, hull(), east, west], 'S');
    expect(firedAttackBlock(get, g, east)).toMatchObject({ reason: 'arc' });
    expect(firedAttackBlock(get, g, west)).toBeNull();
  });
});
