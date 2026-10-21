/**
 * Preuve que les MANŒUVRES sont pilotées par la DONNÉE (`maneuvers.json`, GameOp), pas par du code.
 * On référence la manœuvre PAR SON ID (`findManeuverById`, convention du projet) et on applique ses
 * `effects` (le chemin de la résolution réelle : `resolveManeuver` → `applyTriggeredEffects`). TOUTE
 * la mécanique (Dégâts `wounds {indiceOf}` + États) vient de la donnée. Combattants à la main, pas de
 * store/spawn. Couvre : Indice + mitigation par drapeaux, seuil de marge (slThreshold), et la preuve
 * « ÉDITER les effects CHANGE la résolution » (recréable depuis le Codex).
 */
import { describe, it, expect } from 'vitest';
import { applyTriggeredEffects } from '../noyau/triggeredEffects';
import { maneuvers, findManeuverById } from '../data';
import { setDataset } from '../data/overrides';
import { makeRNG } from '../engine/dice';
import type { Combatant } from '../engine/types';
import type { TriggeredEffect } from '../data/schemas/defs-scenes/effets';

const mk = (over: Partial<Combatant> = {}): Combatant => ({
  id: 'c', label: 'C', kind: 'enemy',
  characteristics: { 'capacite-de-combat': 35, 'capacite-de-tir': 25, force: 35, endurance: 35, initiative: 30, agilite: 30, dexterite: 30, intelligence: 25, 'force-mentale': 25, sociabilite: 25 },
  wounds: { current: 30, max: 30 }, advantage: 0, conditions: [], skills: [], talents: [],
  weapons: [], armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 }, items: [],
  ...over,
} as Combatant);

const get = (() => ({ battle: undefined })) as never;
const cond = (c: Combatant, name: string) => c.conditions.find((x) => x.id === name);
/** Applique les effects onHit de la manœuvre `id` (depuis la DONNÉE) à `victim`, avec Indice + marge —
 *  comme la résolution réelle (`resolveManeuver` → `applyTriggeredEffects(def.effects, …)`). */
const fire = (id: string, victim: Combatant, indice: number, margin?: number) =>
  applyTriggeredEffects(get, mk({ id: 'a' }), findManeuverById(id)!.effects ?? [], 'onHit', { victim, indice, margin, rng: makeRNG(2) });

describe('manœuvres = donnée éditable (GameOp)', () => {
  it('souffle-feu : Dégâts « Indice » ignorant les PA + En flammes — depuis les effects GameOp', () => {
    const e = mk({ armour: { tete: 0, brasG: 0, brasD: 0, corps: 5, jambeG: 0, jambeD: 0 } }); // PA 5
    fire('souffle-feu', e, 15);
    expect(e.wounds.current).toBe(18); // 30 − (Indice 15 − BE 3 − PA 5 IGNORÉS) = 30 − 12
    expect(cond(e, 'en-flammes')).toBeTruthy();
  });

  it('regard-petrifiant : marge ≥6 → Pétrifié + 0 PB ; marge ≥2 → Sonné (slThreshold, depuis la donnée)', () => {
    const petrified = mk();
    fire('regard-petrifiant', petrified, 0, 6);
    expect(cond(petrified, 'petrifie')).toBeTruthy();
    expect(petrified.wounds.current).toBe(0); // op reduceToZero
    const stunned = mk();
    fire('regard-petrifiant', stunned, 0, 3);
    expect(cond(stunned, 'sonne')).toBeTruthy();
    expect(cond(stunned, 'petrifie')).toBeFalsy();
  });

  it('etreinte-glaciale : 1d10 + DR ignorant BE ET PA (depuis la donnée)', () => {
    const tank = mk({
      characteristics: { 'capacite-de-combat': 35, 'capacite-de-tir': 25, force: 35, endurance: 70, initiative: 30, agilite: 30, dexterite: 30, intelligence: 25, 'force-mentale': 25, sociabilite: 25 }, // BE 7
      armour: { tete: 0, brasG: 0, brasD: 0, corps: 9, jambeG: 0, jambeD: 0 }, // PA 9
    });
    const before = tank.wounds.current;
    fire('etreinte-glaciale', tank, 0, 4); // marge 4 → +4 DR
    expect(before - tank.wounds.current).toBeGreaterThanOrEqual(5); // ≥ 1d10(≥1) + 4, NON réduit par BE 7 + PA 9
  });

  it('ÉDITER les effects d’une ManeuverDef CHANGE la résolution (recréable depuis le Codex)', () => {
    const avant = [...maneuvers];
    const edited: TriggeredEffect[] = [
      { trigger: 'onHit', on: 'victim', flow: { kind: 'do', effect: { type: 'ops', on: 'target', ops: [{ op: 'condition', id: 'empoisonne' }] } } },
    ];
    try {
      setDataset('maneuvers', maneuvers.map((m) => (m.id === 'souffle-feu' ? { ...m, effects: edited } : m))); // « édition » : Empoisonné, sans Dégâts
      const e = mk();
      fire('souffle-feu', e, 15);
      expect(cond(e, 'empoisonne')).toBeTruthy(); // le NOUVEL effet s'applique
      expect(cond(e, 'en-flammes')).toBeFalsy();  // l'ancien a disparu
      expect(e.wounds.current).toBe(30);           // plus de wounds op → 0 Dégât
    } finally {
      setDataset('maneuvers', avant); // restaure la donnée partagée
    }
  });
});
