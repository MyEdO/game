import { describe, it, expect } from 'vitest';
import { noeudTest, flowSchema } from './mecanique';

/**
 * #1657 B2a / #1682 — RESSERREMENT NOMINATIF de `noeudTest(branche, { difficulteRequise })`.
 *
 * `flowTestSchema.difficulty` est OPTIONNELLE, et elle doit le rester : un Flow peut porter un Test
 * dont la Difficulté est fixée ailleurs (`difficultyBy`, opposition). Les Blessures critiques, elles,
 * la portent TOUTES (39 nœuds sur 39) — sans ce resserrement, l'adoption du nœud partagé aurait
 * relâché en SILENCE l'exigence que portait leur schéma propre.
 *
 * Ce fichier mesure les DEUX faces : le nœud RESSERRÉ refuse en nommant `difficulty`, le nœud PARTAGÉ
 * accepte le même objet. Sans la seconde, un resserrement fuité sur tous les Flows passerait vert.
 */

/** Un nœud `test` COMPLET, sauf sa Difficulté — la seule chose que le resserrement exige. */
const SANS_DIFFICULTE = {
  kind: 'test',
  test: { skill: { id: 'athletisme' } },
  reussite: { kind: 'sequence', etapes: [] },
  echec: { kind: 'effet', effet: { type: 'ops', ops: [{ op: 'condition', id: { id: 'a-terre' }, value: 1 }], on: 'target' } },
};

const AVEC_DIFFICULTE = { ...SANS_DIFFICULTE, test: { ...SANS_DIFFICULTE.test, difficulty: 'intermediaire' } };

const issues = (r: { success: boolean; error?: { issues: { path: PropertyKey[]; message: string }[] } }) =>
  (r.error?.issues ?? []).map((i) => `${i.path.join('.')}: ${i.message}`);

describe('noeudTest — `difficulteRequise` resserre le nœud PARTAGÉ, pour son document seul', () => {
  it('RESSERRÉ : un nœud sans `difficulty` est REFUSÉ, et l’issue NOMME le champ', () => {
    const r = noeudTest(flowSchema, { difficulteRequise: true }).safeParse(SANS_DIFFICULTE);
    expect(r.success, 'le nœud resserré a ACCEPTÉ un jet sans Difficulté').toBe(false);
    expect(issues(r)).toEqual([
      'test.difficulty: Test : `difficulty` exigée.',
    ]);
  });

  it('RESSERRÉ : le même nœud AVEC sa `difficulty` passe (le refus vise la Difficulté, rien d’autre)', () => {
    expect(noeudTest(flowSchema, { difficulteRequise: true }).safeParse(AVEC_DIFFICULTE).success).toBe(true);
  });

  it('PARTAGÉ : le nœud SANS option accepte le même nœud sans `difficulty` — le resserrement ne fuit pas', () => {
    expect(noeudTest(flowSchema).safeParse(SANS_DIFFICULTE).success, 'le resserrement a débordé sur TOUS les Flows').toBe(true);
    expect(noeudTest(flowSchema, {}).safeParse(SANS_DIFFICULTE).success).toBe(true);
    expect(noeudTest(flowSchema, { difficulteRequise: false }).safeParse(SANS_DIFFICULTE).success).toBe(true);
  });
});
