import { findTrappingById } from '../data';
import { describe, it, expect } from 'vitest';
import { rangedDefenseModes, bestRangedDefense, resolveRanged } from './combat';
import { makeRNG } from './dice';
import type { Combatant, Weapon } from './types';
import { blessuresSurLeProfil, blessuresDeBase } from './combattantDeTest.testkit';

// Portée 20 m → Bout Portant si dist×2 ≤ 20/10 = 2, donc à ≤ 1 tuile (combat.ts rangeBandName).
const bow = (): Weapon => ({ name: 'Arc', type: 'distance', damage: { plusBF: false, flat: 0 }, range: 20, qualities: [] } as unknown as Weapon);
const shield = (indice: number): Weapon =>
  ({ name: 'Bouclier', type: 'melee', damage: { plusBF: true, flat: 0, bare: true }, qualities: [{ id: 'protectrice', value: indice }] } as unknown as Weapon);

// Un combattant réel porte Caractéristiques + Compétences (CC/Parade, Ag/Esquive) : le stub est COMPLET pour
// que la sélection de mode (`bestRangedDefense`) puisse scorer chaque mode — un défenseur creux n'existe pas.
const chars = { 'capacite-de-combat': 35, 'capacite-de-tir': 35, force: 35, endurance: 35, initiative: 30, agilite: 45, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 };
const combatant = (id: string, kind: 'heros' | 'ennemi', over: Partial<Combatant>): Combatant =>
  (blessuresSurLeProfil({ id, name: id, kind, characteristics: chars, conditions: [], engagedWith: [], skills: [], talents: [],
     weapons: [], advantage: 0, size: 'moyenne', wounds: blessuresDeBase(20),
     armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 }, ...over }) as unknown as Combatant);
const atk = (over: Partial<Combatant> = {}): Combatant => combatant('a', 'heros', over);
const def = (over: Partial<Combatant> = {}): Combatant => combatant('d', 'ennemi', over);

describe('rangedDefenseModes — RAW défense contre les attaques à distance', () => {
  const w = bow();

  it('défaut : AUCUNE défense contre un tir (LDB 13 l.135)', () => {
    expect(rangedDefenseModes(findTrappingById, atk(), def(), w, 5, true, 2)).toEqual([]);
  });

  it('bouclier Protectrice 2+ en Ligne de Vue → Parade (LDB 62 l.296)', () => {
    expect(rangedDefenseModes(findTrappingById, atk(), def({ weapons: [shield(2)] }), w, 5, true, 2)).toEqual(['parade']);
  });

  it('Protectrice 1 ne suffit pas (Indice < 2)', () => {
    expect(rangedDefenseModes(findTrappingById, atk(), def({ weapons: [shield(1)] }), w, 5, true, 2)).toEqual([]);
  });

  it('Protectrice 2+ HORS Ligne de Vue → aucune parade', () => {
    expect(rangedDefenseModes(findTrappingById, atk(), def({ weapons: [shield(2)] }), w, 5, false, 2)).toEqual([]);
  });

  it('Bout Portant → Esquive (LDB 14 l.40)', () => {
    expect(rangedDefenseModes(findTrappingById, atk(), def(), w, 1, true, 2)).toEqual(['esquive']);
  });

  it('tireur Engagé → Parade « n’importe quelle Corps à corps » (LDB 14 l.44)', () => {
    expect(rangedDefenseModes(findTrappingById, atk({ engagedWith: ['d'] }), def(), w, 5, true, 2)).toEqual(['parade']);
  });

  it('Bout Portant + bouclier Protectrice 2+ → Parade ET Esquive (le défenseur choisit)', () => {
    expect(rangedDefenseModes(findTrappingById, atk(), def({ weapons: [shield(2)] }), w, 1, true, 2).sort()).toEqual(['esquive', 'parade']);
  });

  it('cible qui ne peut pas se défendre (Surpris) → aucun mode', () => {
    expect(rangedDefenseModes(findTrappingById, atk({ engagedWith: ['d'] }), def({ conditions: [{ id: 'surpris' }] as never }), w, 1, true, 2)).toEqual([]);
  });
});

describe('bestRangedDefense — meilleure défense AUTO contre un tir', () => {
  const w = bow();
  it('aucune exception → undefined (tir non opposé)', () => {
    expect(bestRangedDefense(findTrappingById, atk(), def(), w, 5, true, 2)).toBeUndefined();
  });
  it('Bout Portant → esquive', () => {
    expect(bestRangedDefense(findTrappingById, atk(), def(), w, 1, true, 2)?.mode).toBe('esquive');
  });
  it('bouclier Protectrice 2+ → parade avec le bouclier', () => {
    const r = bestRangedDefense(findTrappingById, atk(), def({ weapons: [shield(2)] }), w, 5, true, 2);
    expect(r?.mode).toBe('parade');
    expect(r?.parryWeapon?.qualities.some((q) => q.id === 'protectrice' && q.value === 2)).toBe(true);
  });
});

describe('resolveRanged — tir DÉFENDU = Test OPPOSÉ (cœur combineOpposed partagé avec la mêlée)', () => {
  const chars = { 'capacite-de-combat': 35, 'capacite-de-tir': 55, force: 35, endurance: 35, initiative: 30, agilite: 45, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 };
  const base = (id: string, kind: 'heros' | 'ennemi', over: Partial<Combatant> = {}): Combatant =>
    (blessuresSurLeProfil({ id, name: id, kind, characteristics: chars, conditions: [], engagedWith: [], skills: [], talents: [],
       weapons: [], advantage: 0, size: 'moyenne', wounds: blessuresDeBase(20),
       armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 }, ...over }) as unknown as Combatant);
  const bw: Weapon = { name: 'Arc', type: 'distance', damage: { plusBF: false, flat: 4 }, range: 60, qualities: [] } as unknown as Weapon;

  it('sans défense → résolution NON opposée (aucun defenderDetail)', () => {
    const r = resolveRanged(findTrappingById, base('a', 'heros'), base('d', 'ennemi'), bw, makeRNG(3), 10, undefined, undefined, undefined, 2);
    expect(r.defenderDetail).toBeUndefined();
  });
  it('avec défense (esquive) → Test OPPOSÉ (defenderDetail présent)', () => {
    const r = resolveRanged(findTrappingById, base('a', 'heros'), base('d', 'ennemi'), bw, makeRNG(3), 10, undefined, [], { mode: 'esquive' }, 2);
    expect(r.defenderDetail).toBeDefined();
  });
});
