/**
 * Phase 3 — MAGIE : specs de magie unifiées sur les IDS de `domains.json` (fin de l'incohérence
 * Vent↔Lore). `focalisation` porte des ids de domaine et AFFICHE le Vent (Ghur) ; `magie-des-arcanes`
 * porte des ids de domaine et AFFICHE le Lore (Bête) ; `beni`/`invocation`/`magie-du-chaos` portent des
 * `gods.key`. Un mage Bête (focalisation `bete` [Ghur] + magie-des-arcanes `bete` [Bête]) matche un Sort
 * Bête (`domainId:'bete'`) — le Talent lanceur ET la Focalisation le trouvent.
 */
import { describe, it, expect } from 'vitest';
import type { Combatant } from './types';
import { findDomainByWind, findDomainById, refLabel, spells } from '../data';
import { focusSpecOf, focusSkillFor } from './magic';
import { eligibleTalent } from './grimoire';
import { blessuresSurLeProfil, blessuresDeBase } from './combattantDeTest.testkit';

function mage(p: Partial<Combatant> = {}): Combatant {
  return blessuresSurLeProfil({
    id: 'm', label: 'Mage', kind: 'hero',
    characteristics: { 'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 30, endurance: 30, initiative: 30, agilite: 30, dexterite: 30, intelligence: 42, 'force-mentale': 40, sociabilite: 30 },
    wounds: blessuresDeBase(12, 10), advantage: 0, conditions: [], movement: 4,
    weapons: [], armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    skills: [], talents: [], spells: [], xp: 1000,
    ...p,
  }) as Combatant;
}

describe('findDomainByWind — Vent → id de domaine (LDB 48 desc « Domaine du Feu (Aqshy) »)', () => {
  it('les 8 Vents élémentaires + Dhar résolvent leur domaine', () => {
    expect(findDomainByWind('Aqshy')?.id).toBe('feu');
    expect(findDomainByWind('Azyr')?.id).toBe('cieux');
    expect(findDomainByWind('Chamon')?.id).toBe('metal');
    expect(findDomainByWind('Ghur')?.id).toBe('bete');
    expect(findDomainByWind('Ghyran')?.id).toBe('vie');
    expect(findDomainByWind('Hysh')?.id).toBe('lumiere');
    expect(findDomainByWind('Shyish')?.id).toBe('mort');
    expect(findDomainByWind('Ulgu')?.id).toBe('ombres');
    expect(findDomainByWind('Dhar')?.id).toBe('dhar');
  });
  it('un Vent inconnu → undefined', () => {
    expect(findDomainByWind('Inconnu')).toBeUndefined();
    expect(findDomainByWind(undefined)).toBeUndefined();
  });
  it('chaque domaine élémentaire porte le Vent extrait de son desc', () => {
    expect(findDomainById('bete')?.wind).toBe('Ghur');
    expect(findDomainById('feu')?.wind).toBe('Aqshy');
    // Un domaine non-élémentaire n'a pas de Vent propre.
    expect(findDomainById('necromancie')?.wind).toBeUndefined();
  });
});

describe('refLabel — affichage Vent (focalisation) vs Lore (arcanes) vs Culte (prières)', () => {
  it('Focalisation affiche le VENT du domaine (id bete → « Ghur »)', () => {
    expect(refLabel('skills', { id: 'focalisation', spec: 'bete' })).toBe('Focalisation (Ghur)');
    expect(refLabel('skills', { id: 'focalisation', spec: 'dhar' })).toBe('Focalisation (Dhar)');
  });
  it('Magie des Arcanes affiche le LORE du domaine (id bete → « Bête »)', () => {
    expect(refLabel('talents', { id: 'magie-des-arcanes', spec: 'bete' })).toBe('Magie des Arcanes (Bête)');
  });
  it('Béni/Invocation/Magie du Chaos affichent le nom du dieu (id → label via gods.label)', () => {
    expect(refLabel('talents', { id: 'beni', spec: 'sigmar' })).toBe('Béni (Sigmar)');
    expect(refLabel('talents', { id: 'invocation', spec: 'manann' })).toBe('Invocation (Manann)');
    expect(refLabel('talents', { id: 'magie-du-chaos', spec: 'tzeentch' })).toBe('Magie du Chaos (Tzeentch)');
  });
});

describe('mage Bête — Focalisation ET Talent lanceur matchent un Sort Bête (domainId bete)', () => {
  const beteSpell = spells.find((s) => s.domainId === 'bete')!;

  it('focusSpecOf lit le domainId du Sort', () => {
    expect(focusSpecOf(beteSpell)).toBe('bete');
  });

  it('la Focalisation (Ghur) [id bete] est trouvée pour un Sort Bête', () => {
    const c = mage({ skills: [{ id: 'focalisation', spec: 'bete', characteristic: 'force-mentale', advances: 5 }] as never });
    expect(focusSkillFor(c, beteSpell)).toBeTruthy();
    // Une Focalisation d'un AUTRE Vent (Aqshy → feu) ne matche pas un Sort Bête.
    const feuMage = mage({ skills: [{ id: 'focalisation', spec: 'feu', characteristic: 'force-mentale', advances: 5 }] as never });
    expect(focusSkillFor(feuMage, beteSpell)).toBeFalsy();
  });

  it('le Talent Magie des Arcanes (Bête) [id bete] rend le Sort Bête apprenable', () => {
    const c = mage({ talents: [{ talentId: 'magie-des-arcanes', spec: 'bete', times: 1 }] });
    expect(eligibleTalent(c, beteSpell)).toBeTruthy();
    // Un mage d'un autre Domaine (Feu) ne peut pas l'apprendre.
    const feuMage = mage({ talents: [{ talentId: 'magie-des-arcanes', spec: 'feu', times: 1 }] });
    expect(eligibleTalent(feuMage, beteSpell)).toBeFalsy();
  });
});
