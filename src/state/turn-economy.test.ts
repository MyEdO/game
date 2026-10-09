import { describe, it, expect } from 'vitest';
import { hasMeaningfulOption, canActFirst } from './turnEconomy';
import type { Combatant } from '../engine/types';
import type { BattleState } from './store';

const hero = (over: Partial<Combatant> = {}): Combatant =>
  ({
    id: 'H', name: 'H', kind: 'hero',
    characteristics: { 'capacite-de-combat': 40, 'capacite-de-tir': 40, force: 30, endurance: 30, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 },
    wounds: { current: 10, max: 10 }, advantage: 0, conditions: [],
    weapons: [{ name: 'Épée', type: 'melee', damage: { plusBF: true, flat: 0, bare: true }, qualities: [] }],
    armour: {}, skills: [], talents: [], movement: 4, pos: { x: 0, y: 0 }, ...over,
  }) as unknown as Combatant;

const battle = (active: Combatant, over: Partial<BattleState> = {}): BattleState =>
  ({
    combatants: [active], order: [active.id], turn: 0, round: 1, action: null, selectedSpellId: null,
    reachable: new Map(), movementUsed: 0, movedPreAction: false, acted: false, log: [], over: null, ...over,
  }) as unknown as BattleState;

describe('hasMeaningfulOption — garde-fou « tour gâché » (R6)', () => {
  it('tour frais (Action + Mouvement) → true', () => {
    const h = hero();
    expect(hasMeaningfulOption(h, battle(h), 0)).toBe(true);
  });

  it('Action ET Mouvement dépensés, rien d’autre → false', () => {
    const h = hero();
    expect(hasMeaningfulOption(h, battle(h, { acted: true, movementUsed: 99, movedPreAction: true }), 0)).toBe(false);
  });

  it('Action dépensée mais Mouvement restant → true', () => {
    const h = hero();
    expect(hasMeaningfulOption(h, battle(h, { acted: true, movementUsed: 0 }), 0)).toBe(true);
  });

  it('tout dépensé mais Détermination + un État retirable → true', () => {
    const h = hero({ resolve: 1, conditions: [{ id: 'sonne', value: 1 }] });
    expect(hasMeaningfulOption(h, battle(h, { acted: true, movementUsed: 99, movedPreAction: true }), 0)).toBe(true);
  });

  it('tout dépensé, Détermination SANS aucun État → true (immunité Psychologie / ignorer les modificateurs de critique, LDB 17 l.59-61)', () => {
    const h = hero({ resolve: 1, conditions: [] });
    expect(hasMeaningfulOption(h, battle(h, { acted: true, movementUsed: 99, movedPreAction: true }), 0)).toBe(true);
  });

  it('tout dépensé, Détermination à 0 et un État → false (rien à dépenser)', () => {
    const h = hero({ resolve: 0, conditions: [{ id: 'sonne', value: 1 }] });
    expect(hasMeaningfulOption(h, battle(h, { acted: true, movementUsed: 99, movedPreAction: true }), 0)).toBe(false);
  });

  it('tout dépensé mais attaque libre de Frénésie disponible → true', () => {
    const h = hero({ psychState: [{ type: 'frenesie' }], talents: [{ talentId: 'frenesie', times: 1 }] });
    expect(hasMeaningfulOption(h, battle(h, { acted: true, movementUsed: 99, movedPreAction: true }), 0)).toBe(true);
  });

  it('Brisé (LDB 16 l.52), Action intacte mais Mouvement dépensé et Détermination à 0 → false (verrou d’État)', () => {
    const h = hero({ resolve: 0, conditions: [{ id: 'brise', value: 1 }] });
    expect(hasMeaningfulOption(h, battle(h, { acted: false, movementUsed: 99, movedPreAction: true }), 0)).toBe(false);
  });

  it('Brisé, Mouvement restant → true (la fuite échappe au verrou)', () => {
    const h = hero({ resolve: 0, conditions: [{ id: 'brise', value: 1 }] });
    expect(hasMeaningfulOption(h, battle(h, { acted: true, movementUsed: 0 }), 0)).toBe(true);
  });

  it('Brisé, tout dépensé, Détermination en réserve → true (la Détermination échappe au verrou, LDB 17 l.59-61)', () => {
    const h = hero({ resolve: 1, conditions: [{ id: 'brise', value: 1 }] });
    expect(hasMeaningfulOption(h, battle(h, { acted: true, movementUsed: 99, movedPreAction: true }), 0)).toBe(true);
  });

  it('un ennemi n’a jamais d’« option de joueur » → false', () => {
    const e = hero({ id: 'E', kind: 'enemy' });
    expect(hasMeaningfulOption(e, battle(e), 0)).toBe(false);
  });
});

describe('canActFirst — pré-emption d’initiative en début de Round (LDB 17 l.25)', () => {
  // Ordre par défaut [E, H] : l'ennemi est en tête, donc le héros peut se placer devant lui.
  const duel = (h: Combatant, e: Combatant, over: Partial<BattleState> = {}): BattleState =>
    ({
      combatants: [h, e], order: [e.id, h.id], turn: 0, round: 2, action: null, selectedSpellId: null,
      reachable: new Map(), movementUsed: 0, movedPreAction: false, acted: false, log: [], over: null, ...over,
    }) as unknown as BattleState;

  it('héros avec ≥1 Chance, pas déjà en tête → true', () => {
    const h = hero({ id: 'H', fortune: 1 });
    const e = hero({ id: 'E', kind: 'enemy' });
    expect(canActFirst(h, duel(h, e))).toBe(true);
  });

  it('héros sans Chance → false', () => {
    const h = hero({ id: 'H', fortune: 0 });
    const e = hero({ id: 'E', kind: 'enemy' });
    expect(canActFirst(h, duel(h, e))).toBe(false);
  });

  it('héros déjà en tête de l’ordre → false', () => {
    const h = hero({ id: 'H', fortune: 1 });
    const e = hero({ id: 'E', kind: 'enemy' });
    expect(canActFirst(h, duel(h, e, { order: ['H', 'E'] }))).toBe(false);
  });

  it('un ennemi (même avec de la Chance) → false', () => {
    const h = hero({ id: 'H' });
    const e = hero({ id: 'E', kind: 'enemy', fortune: 5 });
    expect(canActFirst(e, duel(h, e))).toBe(false);
  });

  it('héros hors de combat (Inconscient) → false', () => {
    const h = hero({ id: 'H', fortune: 2, conditions: [{ id: 'inconscient', value: 1 }] });
    const e = hero({ id: 'E', kind: 'enemy' });
    expect(canActFirst(h, duel(h, e))).toBe(false);
  });
});
