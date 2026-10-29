/**
 * Cicatrices sociales post-guérison — LDB 18 l.61 (Blessure spectaculaire) et l.72 (Nez cassé).
 * Sonde sur le chemin RÉEL : la valeur du Test vient de `testValue`, le jet du flux `test` du noyau
 * (`testRoll`, RNG de combat seedé), et le DR de l'op `skillDRBonus` du collecteur (engine/ops).
 * Deux mesures : un jet AU-DESSUS de la valeur reste un échec (aucun DR n'entre) ; un jet réussi
 * gagne exactement +1 DR par rapport au MÊME jet sans la cicatrice.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { seedBattleRng } from './battleRng';
import { testValue } from '../engine/skills';
import { skillDRBonus } from '../engine/ops';
import { traumaById } from '../engine/trauma';
import { bonus, effectiveChar } from '../engine/characteristics';
import { EMPTY_FLOW } from '../engine/flowCore';
import type { Combatant } from '../engine/types';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });

/** Sociabilité 30 + 5 avances d'Intimidation = valeur de Test 35. */
const hero = (scarId?: string): Combatant =>
  ({
    id: 'H', label: 'Héros', kind: 'hero',
    characteristics: { 'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 30, endurance: 30, initiative: 30, agilite: 45, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 },
    wounds: { current: 10, max: 10 }, advantage: 0, conditions: [], talents: [], items: [], traits: [], weapons: [],
    armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 }, movement: 4,
    skills: [{ id: 'intimidation', advances: 5 }, { id: 'charme', advances: 5 }],
    traumas: scarId ? [traumaById(scarId)] : [],
  } as unknown as Combatant);

/** Ouvre le pending du flux `test` (Intimidation) et le roule au RNG seedé — chemin de production. */
function rollIntimidation(c: Combatant, seed: number) {
  banc.setState({ party: [c] });
  banc.setState({
    pendingTest: {
      actorId: c.id, actorName: c.label, label: 'Test d’Intimidation', skillId: 'intimidation',
      skillValue: testValue(c, 'intimidation'), difficulty: 'intermediaire', requireSL: 0,
      target: testValue(c, 'intimidation'), roll: null, success: false, sl: 0,
      onSuccess: EMPTY_FLOW, onFailure: EMPTY_FLOW,
    } as never,
  });
  seedBattleRng(seed);
  banc.getState().testRoll();
  return banc.getState().pendingTest!;
}

const SEED_38 = 49; // 1er d100 = 38 (> 35)
const SEED_12 = 135; // 1er d100 = 12 (≤ 35)

beforeEach(() => {
  banc.setState({ battle: null, scene: null, mode: 'exploration', party: [], journal: [], pendingTest: null });
});

describe('Cicatrice impressionnante (LDB 18 l.61) — le bonus vit au DR, pas à la valeur du Test', () => {
  it('la valeur du Test d’Intimidation est inchangée (35), le DR vaut +1', () => {
    const c = hero('cicatrice-spectaculaire');
    expect(testValue(c, 'intimidation')).toBe(35);
    expect(testValue(hero(), 'intimidation')).toBe(35);
    expect(skillDRBonus(c, 'intimidation')).toBe(1);
    expect(skillDRBonus(c, 'charme')).toBe(0); // hors du périmètre arbitré
    expect(skillDRBonus(hero(), 'intimidation')).toBe(0);
  });

  it('jet 38 contre 35 : ÉCHEC, identique au héros sans cicatrice (aucune réussite fabriquée)', () => {
    const avec = rollIntimidation(hero('cicatrice-spectaculaire'), SEED_38);
    const sans = rollIntimidation(hero(), SEED_38);
    expect(avec.roll).toBe(38);
    expect(avec.target).toBe(35);
    expect(avec.success).toBe(false);
    expect(sans.success).toBe(false);
    expect(avec.sl).toBe(sans.sl); // un Test raté n'encaisse aucun DR
  });

  it('jet 12 contre 35 : RÉUSSITE, et exactement +1 DR par rapport au même jet sans cicatrice', () => {
    const avec = rollIntimidation(hero('cicatrice-spectaculaire'), SEED_12);
    const sans = rollIntimidation(hero(), SEED_12);
    expect(avec.roll).toBe(12);
    expect(avec.success).toBe(true);
    expect(sans.success).toBe(true);
    expect(avec.sl).toBe(sans.sl + 1);
  });
});

describe('Nez cassé (LDB 18 l.72) — DR +1 / −1 selon le périmètre arbitré', () => {
  it('Intimidation +1 DR, Charme −1 DR, valeurs de Test inchangées', () => {
    const c = hero('cicatrice-nez-casse');
    expect(skillDRBonus(c, 'intimidation')).toBe(1);
    expect(skillDRBonus(c, 'charme')).toBe(-1);
    expect(testValue(c, 'intimidation')).toBe(35);
    expect(testValue(c, 'charme')).toBe(35);
  });
});

describe('témoin — les autres sources du collecteur de DR sont intactes', () => {
  it('Furtif (LDB 85) : +Bonus d’Agilité au DR de Discrétion', () => {
    const c = { ...hero(), traits: [{ id: 'furtif' }] } as Combatant;
    expect(skillDRBonus(c, 'discretion')).toBe(bonus(effectiveChar(c, 'agilite'))); // Ag 45 → 4
    expect(skillDRBonus(c, 'intimidation')).toBe(0);
  });
});
