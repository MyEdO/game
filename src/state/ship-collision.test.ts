import { describe, it, expect } from 'vitest';
import { applyShipCollision } from '../noyau/monde/shipCollision';
import type { Combatant } from '../engine/types';

/**
 * Collision / éperonnage appliqué (MDG 13) — `applyShipCollision` mappe chaque coque en `CollisionShip`
 * (IC = Bonus d'Endurance + Bonus de Blessures restantes ; M depuis le TYPE ; Bélier depuis Traits+Améliorations),
 * résout (`resolveCollision`, PUR) et APPLIQUE les Dégâts aux DEUX coques via l'op `wounds` (mitigation BE + PA
 * de coque + `extraAP` = `armorBonus` situationnel — la mitigation reste DANS l'op).
 */
const hull = (id: string, creatureId: string, E: number, pb: number): Combatant =>
  ({
    id, name: id, kind: 'npc', creatureId, bodyShape: 'vehicule',
    characteristics: { 'capacite-de-combat': 0, 'capacite-de-tir': 0, force: 0, endurance: E, initiative: 0, agilite: 0, dexterite: 0, intelligence: 0, 'force-mentale': 0, sociabilite: 0 },
    wounds: { current: pb, max: pb, base: pb }, advantage: 0, conditions: [], weapons: [],
    armour: { corps: 0 }, skills: [], talents: [],
  }) as unknown as Combatant;

describe('applyShipCollision — Dégâts aux deux coques (MDG 13)', () => {
  it('deux coques sans Bélier : IC=bonus(E)+bonus(PB), Dégâts = IC adverse + M causeur, mitigés BE dans l’op', () => {
    const causer = hull('cogue', 'cogue', 45, 50); // IC 4+5=9 ; M 5 (sail)
    const victim = hull('knarr', 'knarr', 40, 30); // IC 4+3=7 ; M 4
    const r = applyShipCollision(causer, victim, 'maritime', { ramProue: true });
    expect(r.causer.damage).toBe(12); // IC victime 7 + M causeur 5
    expect(r.victim.damage).toBe(14); // IC causeur 9 + M causeur 5
    expect(victim.wounds.current).toBe(30 - (14 - 4)); // 14 − BE(4) − PA(0) = 10 → 20
    expect(causer.wounds.current).toBe(50 - (12 - 4)); // 12 − BE(4) = 8 → 42
  });

  it('Bélier de proue en collision FRONTALE : la victime encaisse +5 (IC) ; le causeur protégé par +5 PA frontaux (extraAP)', () => {
    const causer = hull('patrouille', 'bateau-de-patrouille', 60, 40); // IC 6+4=10 ; M 4 ; Bélier {ic:5, ap:5}
    const victim = hull('knarr', 'knarr', 40, 30); // IC 4+3=7 ; M 4 ; pas de Bélier
    const r = applyShipCollision(causer, victim, 'maritime', { frontal: true });
    expect(r.causer.armorBonus).toBe(5); // 5 PA frontaux du Bélier
    expect(r.victim.damage).toBe(23); // (IC causeur 10 + Bélier 5) + M total (4+4) frontal
    // causeur : 15 (IC victime 7 + M total 8) − BE(6) − extraAP(5) = 4 → 36 ; protégé par sa proue.
    expect(causer.wounds.current).toBe(40 - 4);
    expect(victim.wounds.current).toBe(30 - (23 - 4)); // 23 − BE(4) = 19 → 11 (la victime déguste)
  });
});
