import { describe, it, expect } from 'vitest';
import { collisionIndex, resolveCollision } from './collision';
import type { Combatant } from './types';
import { blessuresSurLeProfil, blessuresDeBase } from './combattantDeTest.testkit';

/** Coque minimale (forme d'un Combattant-coque) : seuls Endurance + Blessures restantes sont lus par collisionIndex. */
const mkHull = (E: number, wounds: number): Combatant =>
  (blessuresSurLeProfil({
    id: 'h', name: 'coque', kind: 'npc',
    characteristics: { 'capacite-de-combat': 0, 'capacite-de-tir': 0, force: 0, endurance: E, initiative: 0, agilite: 0, dexterite: 0, intelligence: 0, 'force-mentale': 0, sociabilite: 0 },
    wounds: blessuresDeBase(wounds), advantage: 0,
    conditions: [], weapons: [], armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    skills: [], talents: [], movement: 0,
  })) as unknown as Combatant;

/**
 * COLLISIONS & ÉPERONNAGE (MDG 13 l.423-465). Indice de Collision = Bonus d'Endurance + Bonus de
 * Blessures restantes (l.444). Chaque navire reçoit l'IC de l'AUTRE + le M du causeur (frontal = +M total).
 * Facteurs : milieu ×2, poupe +2 PA, s'éloigne −M, manœuvre (DR ± l'IC des deux). Coups → Localisation Coque.
 */
describe('collisionIndex — BE + Bonus de Blessures restantes (MDG 13 l.444)', () => {
  it('exemple RAW : E20 (BE 2) + 15 Blessures (BB 1) → IC 3', () => {
    expect(collisionIndex(mkHull(20, 15))).toBe(3);
  });
  it('grosse coque : E45 (BE 4) + 50 Blessures (BB 5) → IC 9', () => {
    expect(collisionIndex(mkHull(45, 50))).toBe(9);
  });
});

describe('resolveCollision — chacun reçoit l’IC de l’AUTRE + le M du causeur (l.446)', () => {
  const causer = { ic: 9, m: 5 };
  const victim = { ic: 3, m: 2 };

  it('éperonnage normal : causeur subit IC_victime+M_causeur ; victime subit IC_causeur+M_causeur', () => {
    const r = resolveCollision(causer, victim);
    expect(r.causer.damage).toBe(3 + 5); // 8
    expect(r.victim.damage).toBe(9 + 5); // 14
  });

  it('collision FRONTALE : chacun reçoit l’IC de l’autre + le M TOTAL des deux (l.462)', () => {
    const r = resolveCollision(causer, victim, { frontal: true });
    expect(r.causer.damage).toBe(3 + 7); // 10
    expect(r.victim.damage).toBe(9 + 7); // 16
  });

  it('milieu de coque → Dégâts ×2 ; poupe → +2 PA', () => {
    const mid = resolveCollision(causer, { ...victim, struck: 'milieu' });
    expect(mid.victim.damage).toBe((9 + 5) * 2); // 28
    const stern = resolveCollision(causer, { ...victim, struck: 'poupe' });
    expect(stern.victim.armorBonus).toBe(2);
    expect(stern.victim.damage).toBe(9 + 5); // PA s'applique à la résolution, pas aux Dégâts bruts
  });

  it('la victime qui s’éloigne directement réduit ses Dégâts de son M (min 0)', () => {
    const away = resolveCollision(causer, { ...victim, movingAway: true });
    expect(away.victim.damage).toBe(9 + 5 - 2); // 12
  });

  it('manœuvre : le DR (signé) s’ajoute/se soustrait à l’IC des DEUX navires', () => {
    const mitig = resolveCollision({ ...causer, maneuverDR: -3 }, victim); // limiter : −3 sur les deux IC
    expect(mitig.causer.damage).toBe(Math.max(0, 3 - 3) + 5); // IC_victime 0 → 5
    expect(mitig.victim.damage).toBe(9 - 3 + 5); // IC_causeur 6 → 11
  });
});
