/**
 * Preuve que les MANŒUVRES sont pilotées par la DONNÉE (`maneuvers.json`, GameOp), pas par du code.
 * On référence la manœuvre PAR SON ID (`findManeuverById`, convention du projet) et on applique ses
 * `effects` (le chemin de la résolution réelle : `resolveManeuver` → `applyTriggeredEffects`). TOUTE
 * la mécanique (Dégâts `wounds {indiceOf}` + États) vient de la donnée. Combattants à la main, pas de
 * store/spawn. Couvre : Indice + mitigation par drapeaux, seuil de marge (slThreshold), et la preuve
 * « ÉDITER les effects CHANGE la résolution » (recréable depuis le Codex).
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { applyTriggeredEffects } from '../noyau/triggeredEffects';
import { breathTypes, maneuvers, findManeuverById, findConditionById, combatStakeRef, resolveStake, type BreathTypeData } from '../data';
import { DIFFICULTY_LABELS } from '../engine/types';
import { souffleDuType } from '../engine/creatureAttacks';
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
      setDataset('maneuvers', maneuvers.map((m) => (m.id === 'souffle' ? { ...m, effects: edited } : m))); // « édition » : Empoisonné, sans Dégâts
      const e = mk();
      fire('souffle', e, 15);
      expect(cond(e, 'empoisonne')).toBeTruthy(); // le NOUVEL effet s'applique
      expect(e.wounds.current).toBe(30);           // plus de wounds op → 0 Dégât
    } finally {
      setDataset('maneuvers', avant); // restaure la donnée partagée
    }
  });
});

/** LDB 85 l.320-329 ; EDOC 13 l.237 ; MDG 16 l.226 ; LDB 16 l.70 */
describe('Souffle = la manœuvre `souffle` composée avec la règle de son Type', () => {
  const TYPES: BreathTypeData[] = [
    { id: 'perce-fixture', type: 'breath-types', label: 'Perce', ignoreAP: true, etat: 'empoisonne' },
    { id: 'etourdit-fixture', type: 'breath-types', label: 'Étourdit', etat: 'sonne' },
    { id: 'compose-fixture', type: 'breath-types', label: 'Perce et Étourdit', types: [{ id: 'perce-fixture' }, { id: 'etourdit-fixture' }] },
  ];
  const souffle = (type?: string, difficulte?: 'difficile') => souffleDuType(findManeuverById('souffle')!, type, difficulte);
  const frappe = (type?: string, difficulte?: 'difficile') => {
    const e = mk({ armour: { tete: 0, brasG: 0, brasD: 0, corps: 5, jambeG: 0, jambeD: 0 } }); // BE 3, PA 5
    applyTriggeredEffects(get, mk({ id: 'a' }), souffle(type, difficulte).effects ?? [], 'onHit', { victim: e, indice: 15, rng: makeRNG(2) });
    return e;
  };
  const avant = [...breathTypes];
  beforeEach(() => setDataset('breathTypes', [...avant, ...TYPES]));
  afterEach(() => setDataset('breathTypes', avant));

  it('sans Type du registre : Dégâts d’Arme égaux à l’Indice, BE et PA déduits, aucune règle de Type', () => {
    const e = frappe('texte-libre-fixture');
    expect(e.wounds.current).toBe(30 - (15 - 3 - 5));
    expect(e.conditions).toEqual([]);
    expect(souffle('texte-libre-fixture').label).toBe(findManeuverById('souffle')!.label);
  });
  it('un Type applique sa règle : PA ignorées et son État', () => {
    const e = frappe('perce-fixture');
    expect(e.wounds.current).toBe(30 - (15 - 3));
    expect(cond(e, 'empoisonne')).toBeTruthy();
  });
  it('un Type qui en nomme deux applique les règles de chacun', () => {
    const e = frappe('compose-fixture');
    expect(e.wounds.current).toBe(30 - (15 - 3));
    expect(cond(e, 'empoisonne')).toBeTruthy();
    expect(cond(e, 'sonne')).toBeTruthy();
  });
  it('l’enjeu de la défense dit la règle du Type : PA ignorées, États et leur Difficulté (LDB 85 l.322-329)', () => {
    const enjeu = (type?: string, difficulte?: 'difficile') => {
      const def = souffle(type, difficulte);
      return resolveStake(combatStakeRef('maneuverDefense', { entryId: def.id, ...(def.enjeu ? { values: def.enjeu } : {}) })).text!;
    };
    const etat = (id: string) => findConditionById(id)!.label;
    expect(enjeu('texte-libre-fixture')).not.toMatch(/PA ignorées|État/);
    expect(enjeu('perce-fixture')).toContain(`PA ignorées, puis État ${etat('empoisonne')}`);
    expect(enjeu('perce-fixture', 'difficile')).toContain(`État ${etat('empoisonne')} (${DIFFICULTY_LABELS.difficile})`);
    expect(enjeu('etourdit-fixture')).not.toContain('PA ignorées');
    expect(enjeu('compose-fixture')).toMatch(new RegExp(`PA ignorées, puis État ${etat('empoisonne')}.*État ${etat('sonne')}`));
  });
  it('la Difficulté du Trait est celle de l’État que le Souffle pose', () => {
    expect(cond(frappe('perce-fixture', 'difficile'), 'empoisonne')?.difficulte).toBe('difficile');
    expect(cond(frappe('perce-fixture'), 'empoisonne')?.difficulte).toBeUndefined();
  });
});
