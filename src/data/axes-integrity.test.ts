import { describe, it, expect } from 'vitest';
import { allAxes, byId, findTalentById, specResolves } from './index';

/**
 * Garde d'INTÉGRITÉ de `axes.json` (#409) — patron `book-source-integrity.test.ts` : chaque
 * `id` de Compétence ou de Talent DOIT être un `id` STABLE de `skills.json`/`talents.json`, chaque `spec` DOIT
 * être VALIDE pour sa Compétence/Talent (`specResolves`, inline OU `specsSource`). Un id
 * qui ne résout plus (renommage/suppression amont) casse le moteur (`axisScore`) en silence sans
 * cette garde.
 */
describe('#409 — intégrité de axes.json', () => {
  for (const axis of allAxes) {
    describe(`axe « ${axis.id} »`, () => {
      for (const ref of axis.skills ?? []) {
        it(`compétence ${ref.id}${ref.spec ? ` (${ref.spec})` : ''} existe`, () => {
          const skill = byId('skill', ref.id);
          expect(skill, `id « ${ref.id} » introuvable dans skills.json`).toBeDefined();
          if (ref.spec && skill) {
            expect(specResolves(skill, ref.spec), `spec « ${ref.spec} » ne résout pas pour « ${ref.id} »`).toBe(true);
          }
        });
      }
      for (const ref of axis.talents ?? []) {
        it(`talent ${ref.id}${ref.spec ? ` (${ref.spec})` : ''} existe`, () => {
          const talent = findTalentById(ref.id);
          expect(talent, `id « ${ref.id} » introuvable dans talents.json`).toBeDefined();
          if (ref.spec && talent) {
            expect(specResolves(talent, ref.spec), `spec « ${ref.spec} » ne résout pas pour « ${ref.id} »`).toBe(true);
          }
        });
      }
    });
  }

  it('ids d\'axe uniques et non vides', () => {
    const ids = allAxes.map((a) => a.id);
    expect(ids.every((x) => !!x)).toBe(true);
    expect(new Set(ids).size).toBe(ids.length);
  });

  /** Réfutation utilisateur 2026-07-14 (« bonne en ingénierie » / « taggée Soins » sans formation) :
   *  un axe EXPERT (scénario, non-`core`) ne doit reposer QUE sur des Compétences AVANCÉES (LDB 09
   *  l.30 — inutilisables sans Augmentation, cf. `docs/raw/4e/competences.md`), jamais une Compétence de
   *  Base qui laisserait la Caractéristique nue « allumer » l'axe sans formation. Verrou id par id
   *  (pas un sondage sur les pregens) — une régression de DONNÉE (ajout d'un skillId de Base à un axe
   *  expert) casse ce test AVANT de reproduire le bug en jeu. */
  it('les axes EXPERT (non-core) ne dérivent QUE de Compétences AVANCÉES — jamais de Compétence de Base', () => {
    const offenders: string[] = [];
    for (const axis of allAxes) {
      if (axis.core) continue;
      for (const ref of axis.skills ?? []) {
        const skill = byId('skill', ref.id);
        if (skill && skill.acces !== 'avancee') offenders.push(`${axis.id} ← ${ref.id} (accès « ${skill.acces} »)`);
      }
    }
    expect(offenders, `Axe(s) expert dérivant d'une Compétence de Base (RAW l.25 : testable sans formation) :\n${offenders.join('\n')}`).toEqual([]);
  });
});
