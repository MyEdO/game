import { describe, it, expect } from 'vitest';
import type { Combatant } from './types';
import { makeRNG } from './dice';
import { applyAlcoholTest, drunkPenalty, drunkCharPenalties, isDrunk, alcoholFailures, soberUp, drunkStaggers, DRUNK_CARACS } from './drunkenness';
import { effectiveChar } from './characteristics';
import { hasCondition, addClockCondition } from './conditions';
import { applyOps } from './ops';
import { deFixe, desDuTest } from './dice.testkit';
import { ciblePsy } from './psych/ciblage';

/** Joue la MÉCANIQUE d'un résultat d'Ivresse (`drunkOps`) — reproduit `case 'intoxicate'` d'`applyOps`
 *  (`effectId:'ivresse'` marque les ActiveEffect posés, retirés en bloc par `soberUp`). */
const applyDrunkOps = (c: Combatant, ops: import('./ops').GameOp[] | undefined) => applyOps(c, ops ?? [], { rng: desDuTest, effectId: 'ivresse' });

function hero(E = 30): Combatant {
  return {
    id: 'h', name: 'Gunnar', kind: 'hero',
    characteristics: { 'capacite-de-combat': 40, 'capacite-de-tir': 40, force: 30, endurance: E, initiative: 30, agilite: 40, dexterite: 40, intelligence: 40, 'force-mentale': 30, sociabilite: 30 },
    wounds: { current: 12, max: 12 }, advantage: 0, conditions: [], activeEffects: [],
    weapons: [], armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    items: [], skills: [], talents: [], traits: [], psychTraits: [], movement: 4,
  } as unknown as Combatant;
}

/** d10 forcé (int(1,10) → roll). */
const d10fixed = deFixe;

describe('Ivresse — Résistance à l’alcool (LDB 09 l.471-487)', () => {
  it('réussir le Test : rien ne se passe', () => {
    const c = hero();
    applyAlcoholTest(c, true, 3, makeRNG(1));
    expect(alcoholFailures(c)).toBe(0);
    expect(drunkPenalty(c)).toBe(0);
  });

  it('−10 aux CC/CT/Ag/Dex/Int par Test raté, plafond −30', () => {
    const c = hero();
    applyAlcoholTest(c, false, 5, makeRNG(1)); // 1 échec → −10 (BE 3, toujours sobre à ce stade car BE=3? E30→BE3)
    expect(drunkPenalty(c)).toBe(-10);
    for (const k of DRUNK_CARACS) expect(drunkCharPenalties(c, k)).toEqual([-10]);
    expect(drunkCharPenalties(c, 'force')).toEqual([]); // F non touchée
    applyAlcoholTest(c, false, 5, makeRNG(1)); // 2
    applyAlcoholTest(c, false, 5, makeRNG(1)); // 3
    applyAlcoholTest(c, false, 5, makeRNG(1)); // 4 → plafond
    expect(drunkPenalty(c)).toBe(-30); // plafonné à −30
  });

  it('la pénalité entre dans effectiveChar (pool non-cumul)', () => {
    const c = hero();
    applyAlcoholTest(c, false, 5, makeRNG(1));
    expect(effectiveChar(c, 'capacite-de-combat')).toBe(30); // 40 − 10
    expect(effectiveChar(c, 'force')).toBe(30); // inchangée
  });

  it('Détermination (flag drunkIgnore) : ignore les malus d’ivresse 1 Round', () => {
    const c = hero();
    applyAlcoholTest(c, false, 5, makeRNG(1)); // −10 CC
    expect(effectiveChar(c, 'capacite-de-combat')).toBe(30);
    c.activeEffects = [...(c.activeEffects ?? []), { label: 'Détermination', bonus: 0, duration: { scale: 'rounds', left: 1 }, drunkIgnore: true }];
    expect(effectiveChar(c, 'capacite-de-combat')).toBe(40); // malus ignoré
  });

  it('seuil d’Ivresse : échecs ≥ Bonus d’Endurance → 1d10 sur le Tableau', () => {
    const c = hero(30); // BE 3
    applyAlcoholTest(c, false, 3, makeRNG(1));
    applyAlcoholTest(c, false, 3, makeRNG(1));
    expect(isDrunk(c)).toBe(false); // 2 échecs < BE 3
    const r = applyAlcoholTest(c, false, 3, d10fixed(5)); // 3ᵉ échec = BE → Ivre, d10=5 → « pièce tourne »
    expect(isDrunk(c)).toBe(true);
    expect(r.becameDrunk?.id).toBe('piece-tourne');
    expect(drunkStaggers(c)).toBe(true); // Mouvement OU Action
  });

  it('Ivresse 1-2 : Bravoure du Marienburgher → +20 Calme (ActiveEffect skillMod, rendu en GameOp[])', () => {
    const c = hero(20); // BE 2
    applyAlcoholTest(c, false, 2, d10fixed(1));
    const r = applyAlcoholTest(c, false, 2, d10fixed(1)); // BE 2 atteint → Ivre, d10=1 → Bravoure
    expect(r.becameDrunk?.id).toBe('bravoure-marienburgher');
    expect(r.drunkOps).toEqual([{ op: 'skillMod', skill: { id: 'calme' }, mod: 20 }]);
    applyDrunkOps(c, r.drunkOps);
    expect(c.activeEffects?.some((e) => e.effectId === 'ivresse' && e.passive?.some((op) => op.op === 'skillMod' && op.skill.id === 'calme' && op.mod === 20))).toBe(true);
  });

  it('Ivresse 7-8 : Animosité (Tout le monde !), rendue en GameOp[] `grantPsychTrait`', () => {
    const c = hero(20);
    applyAlcoholTest(c, false, 2, d10fixed(7));
    const r = applyAlcoholTest(c, false, 2, d10fixed(7));
    applyDrunkOps(c, r.drunkOps);
    // Cible = id de Groupe `tout` (wildcard « n'importe qui », groupMatch engine/groups.ts:155).
    expect(c.psychTraits?.some((p) => p.type === 'animosite' && p.cible === ciblePsy.groupe('tout'))).toBe(true);
  });

  it('soberUp : lève l’ivresse, retire les ActiveEffect d’ivresse (par `effectId`), renvoie la gueule de bois (Exténué horloge)', () => {
    const c = hero(20);
    applyAlcoholTest(c, false, 2, d10fixed(1)); // Bravoure (+20 Calme)
    const r = applyAlcoholTest(c, false, 2, d10fixed(1));
    applyDrunkOps(c, r.drunkOps);
    expect(isDrunk(c)).toBe(true);
    const now = 1000;
    const { hangover } = soberUp(c, now, 2, 1); // DR dissipation 2, DR gueule de bois 1
    expect(isDrunk(c)).toBe(false);
    expect(drunkPenalty(c)).toBe(0);
    expect(c.activeEffects?.some((e) => e.effectId === 'ivresse')).toBe(false); // Bravoure retirée
    expect(hangover).toEqual({ id: 'extenue', value: 1, until: now + (5 - 1) * 60 }); // 4 h
    // L'appelant pose la gueule de bois :
    addClockCondition(c, hangover!.id, hangover!.value, hangover!.until);
    expect(hasCondition(c, 'extenue')).toBe(true);
  });
});
