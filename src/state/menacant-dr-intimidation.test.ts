/**
 * Menaçant — LDB 10 l.787. Le +DR par niveau passe par la règle UNIVERSELLE `talentTestSLBonus`
 * (`TalentData.test.matches`, `src/engine/magic.ts:349`), consommée par le Test de compétence
 * générique (`rollFlowSpecs.ts:1925`, `applyRoll` l.1962), l'incantation (`castTestTalentDR`) et le
 * moral d'équipage (`crewMorale.ts:339`).
 *
 * Ces sites SOMMENT `talentTestSLBonus` ET `skillDRBonus` : une seconde source pour le MÊME talent
 * (un `passive: skillDRBonus` posé sur `menacant`) le compterait DEUX fois. Le contrat ci-dessous
 * verrouille les deux versants : le bonus RÉEL par le canal canonique, et l'absence de doublon.
 */
import { describe, it, expect } from 'vitest';
import { talentTestSLBonus } from '../engine/magic';
import { skillDRBonus } from '../engine/ops';
import { talentsFromBook } from '../noyau/monde/spawn';
import { findCreatureById } from '../data/index';
import type { Combatant } from '../engine/types';

const caledair = findCreatureById('caledair-la-faux-de-feu');

/** Combattant minimal porteur des Talents AUTHORÉS de la créature (chemin réel `talentsFromBook`). */
const withTalents = (talents: ReturnType<typeof talentsFromBook>): Combatant =>
  ({ id: 't', label: 'test', skills: [], talents, traits: [] } as unknown as Combatant);

describe('Menaçant : +Niveaux de DR aux Tests d’Intimidation (LDB 10 l.787)', () => {
  it('donnée RÉELLE — Caledair porte Menaçant ×3 et gagne +3 DR d’Intimidation', () => {
    expect(caledair).toBeTruthy();
    const talents = talentsFromBook(caledair!.talents);
    expect(talents.find((t) => t.talentId === 'menacant')?.times).toBe(3);
    const c = withTalents(talents);
    expect(talentTestSLBonus(c, { skill: 'intimidation' })).toBe(3);
    expect(talentTestSLBonus(c, { skill: 'charme' })).toBe(0);
  });

  it('une SEULE source — `skillDRBonus` ne recompte pas le talent (les sites somment les deux)', () => {
    const c = withTalents(talentsFromBook(caledair!.talents));
    expect(skillDRBonus(c, 'intimidation')).toBe(0);
  });
});
