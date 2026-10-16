import { describe, it, expect } from 'vitest';
import { talentTestSLBonus } from './magic';
import { talents, skills } from '../data';
import type { Combatant } from './types';

/**
 * Règle LDB 10 (« Tests » : +1 DR par acquisition d'un Talent lié, sur un Test RÉUSSI) appliquée
 * UNIVERSELLEMENT via le matcher STRUCTURÉ `talent.test.matches` (id-based ; jamais un match par libellé).
 * `talentTestSLBonus` est la SOURCE UNIQUE du bonus (Tests de compétence ET incantation). Les contextes
 * `when` (Condition, couche state) sont injectés par `whenHolds` → le moteur reste pur.
 */
const c = (talents: { talentId: string; times: number; spec?: string }[]): Combatant =>
  ({ id: 't', name: 'T', kind: 'hero', characteristics: {}, skills: [], talents, traits: [], conditions: [] } as unknown as Combatant);

describe('talentTestSLBonus — règle LDB 10 universelle (matcher structuré test.matches)', () => {
  it('compétence pure : Grimpeur ×2 → +2 DR sur un Test d’Escalade, 0 ailleurs', () => {
    expect(talentTestSLBonus(c([{ talentId: 'grimpeur', times: 2 }]), { skill: 'escalade' })).toBe(2);
    expect(talentTestSLBonus(c([{ talentId: 'grimpeur', times: 2 }]), { skill: 'natation' })).toBe(0);
  });

  it('spec FIXE : Diction instinctive ne booste que Langue (Magick), pas (Bretonnien)', () => {
    const d = c([{ talentId: 'diction-instinctive', times: 1 }]);
    expect(talentTestSLBonus(d, { skill: 'langue', spec: 'magick' })).toBe(1);
    expect(talentTestSLBonus(d, { skill: 'langue', spec: 'bretonnien' })).toBe(0);
  });

  it('specFromInstance : Maître artisan (Serrurier) booste Métier (Serrurier), pas (Forgeron)', () => {
    const m = c([{ talentId: 'maitre-artisan', times: 1, spec: 'serrurier' }]);
    expect(talentTestSLBonus(m, { skill: 'metier', spec: 'serrurier' })).toBe(1);
    expect(talentTestSLBonus(m, { skill: 'metier', spec: 'forgeron' })).toBe(0);
    expect(talentTestSLBonus(m, { skill: 'metier' })).toBe(0); // une spec d’instance est EXIGÉE
  });

  it('exceptSpec : Linguistique booste les langues de communication, PAS Langue (Magick)', () => {
    const l = c([{ talentId: 'linguistique', times: 3 }]);
    expect(talentTestSLBonus(l, { skill: 'langue', spec: 'bretonnien' })).toBe(3);
    expect(talentTestSLBonus(l, { skill: 'langue', spec: 'magick' })).toBe(0); // desc : « ne fonctionne pas avec Langue (Magick) »
  });

  it('manual (contexte narratif) : Haine ne s’applique JAMAIS automatiquement', () => {
    expect(talentTestSLBonus(c([{ talentId: 'haine', times: 3 }]), { char: 'force-mentale' })).toBe(0);
  });

  it('when : Vigilance ne booste Perception que si le contexte (whenHolds) est vrai', () => {
    const v = c([{ talentId: 'vigilance', times: 1 }]);
    expect(talentTestSLBonus(v, { skill: 'perception' }, () => true)).toBe(1);
    expect(talentTestSLBonus(v, { skill: 'perception' }, () => false)).toBe(0);
    expect(talentTestSLBonus(v, { skill: 'perception' })).toBe(0); // défaut conservateur : when non vérifié → pas appliqué
  });
});

describe('Intégrité des talent.test.matches (garde de curation)', () => {
  const skillIds = new Set(skills.map((s) => s.id));
  const CHARS = new Set(['capacite-de-combat', 'capacite-de-tir', 'force', 'endurance', 'initiative', 'agilite', 'dexterite', 'intelligence', 'force-mentale', 'sociabilite']);
  it('chaque match a skill XOR char, et l’id/la Caractéristique résout', () => {
    const bad: string[] = [];
    for (const t of talents) {
      for (const m of t.test?.matches ?? []) {
        if ((m.skill != null) === (m.char != null)) bad.push(`${t.id}: match doit avoir skill XOR char`);
        if (m.skill != null && !skillIds.has(m.skill.id)) bad.push(`${t.id}: skill '${m.skill.id}' inconnu`);
        if (m.char != null && !CHARS.has(m.char)) bad.push(`${t.id}: char '${m.char}' inconnu`);
      }
    }
    expect(bad).toEqual([]);
  });
});
