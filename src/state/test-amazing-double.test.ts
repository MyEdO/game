import { describe, it, expect, beforeEach } from 'vitest';
import { useGame } from './store';
import { FLOWS } from './rollFlowSpecs';
import { amazingTestLabel } from './flowOutcomes';
import { rule, setRule, resetRule } from '../engine/policy';
import { isDoubleRoll } from '../engine/tests';
import type { PendingTest } from '../noyau/pendings';
import type { Combatant } from '../engine/types';

/**
 * Option « Succès / échec stupéfiants » (LDB 12 l.127) : un Test résolu sur un DOUBLE devient un
 * Succès / Échec Stupéfiant — PUREMENT un libellé (aucune mécanique nouvelle). On vérifie (1) que
 * `pendingTest.isDouble` est bien PROPAGÉ par la fabrique de flux jusqu'au pending, (2) que le
 * libellé pur `amazingTestLabel` lit ce flag correctement, piloté par la règle.
 */

const hero = (p: Partial<Combatant>): Combatant =>
  ({
    id: 'h', label: 'Hilda', kind: 'hero',
    characteristics: { 'capacite-de-combat': 50, 'capacite-de-tir': 50, force: 50, endurance: 50, initiative: 50, agilite: 50, dexterite: 50, intelligence: 50, 'force-mentale': 50, sociabilite: 50 },
    wounds: { current: 10, max: 10 }, advantage: 0, conditions: [], skills: [], talents: [],
    weapons: [], armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    fate: 3, fortune: 0, resilience: 0, ...p,
  } as Combatant);

const basePending = (over: Partial<PendingTest> = {}): PendingTest => ({
  actorId: 'h', actorName: 'Hilda', label: 'Test', skill: 'Athlétisme', skillValue: 50,
  difficulty: 'intermediaire', requireSL: 0, target: 50, isDouble: false,
  roll: null, success: false, sl: 0, ...over,
});

describe('amazingTestLabel — libellé du double (LDB 12 l.127), PUR', () => {
  it('aucun badge avant le jet', () => {
    expect(amazingTestLabel(basePending({ roll: null }))).toBeNull();
  });
  it('aucun badge si le jet n’est PAS un double', () => {
    expect(amazingTestLabel(basePending({ roll: 23, success: true, isDouble: false }))).toBeNull();
  });
  it('Succès Stupéfiant sur une réussite + double', () => {
    expect(amazingTestLabel(basePending({ roll: 22, success: true, isDouble: true })))
      .toEqual({ success: true, text: 'Succès Stupéfiant' });
  });
  it('Échec Stupéfiant sur un échec + double', () => {
    expect(amazingTestLabel(basePending({ roll: 88, success: false, isDouble: true })))
      .toEqual({ success: false, text: 'Échec Stupéfiant' });
  });
  it('aucun badge sur une réussite FORCÉE (Résilience) — pas un vrai double de dé', () => {
    expect(amazingTestLabel(basePending({ roll: 1, success: true, isDouble: false, forced: true }))).toBeNull();
  });
});

describe('test-critiques-doubles — la règle pilote l’affichage du badge', () => {
  beforeEach(() => { resetRule('test-critiques-doubles'); });

  it('défaut false → le badge reste éteint même sur un double', () => {
    expect(rule('test-critiques-doubles')).toBe(false);
    const pt = basePending({ roll: 22, success: true, isDouble: true });
    // L'UI ne calcule `amazingTestLabel` QUE si la règle est vraie.
    const amazing = rule('test-critiques-doubles') ? amazingTestLabel(pt) : null;
    expect(amazing).toBeNull();
  });

  it('règle activée → le badge s’affiche sur un double', () => {
    setRule('test-critiques-doubles', true);
    const pt = basePending({ roll: 22, success: true, isDouble: true });
    const amazing = rule('test-critiques-doubles') ? amazingTestLabel(pt) : null;
    expect(amazing).toEqual({ success: true, text: 'Succès Stupéfiant' });
    resetRule('test-critiques-doubles');
  });
});

describe('FLOWS.test — isDouble PROPAGÉ du jet jusqu’au pendingTest', () => {
  beforeEach(() => { useGame.setState({ battle: null, mode: 'exploration' }); });

  it('après testRoll, pendingTest.isDouble est cohérent avec isDoubleRoll(roll), et vrai au moins une fois', () => {
    const h = hero({});
    let sawDouble = false;
    // Le jet du flux `test` utilise le RNG par défaut (non seedé) ; on répète jusqu'à voir un double
    // (garanti statistiquement) et on vérifie la cohérence à CHAQUE itération.
    for (let i = 0; i < 400; i++) {
      useGame.setState({ party: [h], pendingTest: basePending() });
      FLOWS.test.roll(useGame.getState, useGame.setState);
      const pt = useGame.getState().pendingTest!;
      expect(pt.roll).not.toBeNull();
      // Le flag du pending = le double du dé réellement obtenu (propagation via le commit de la fabrique).
      expect(!!pt.isDouble).toBe(isDoubleRoll(pt.roll!));
      if (pt.isDouble) sawDouble = true;
    }
    expect(sawDouble).toBe(true);
    useGame.setState({ pendingTest: null });
  });
});
