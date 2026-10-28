/**
 * Le résumé d'op de l'éditeur nomme un état psychologique et sa Cible par leur LIBELLÉ, jamais par leur
 * id (fiche `user-doctrine-ids-stables-labels-affichage`). Entrées choisies par leur forme : un id que son
 * libellé ne contient pas.
 */
import { describe, it, expect } from 'vitest';
import { opSummary } from './resumeDOp';
import { groupLabel, groups, psychologies, psychologyLabel } from '../../../data';
import type { GameOp } from '../../../engine/ops';
import { opPsy } from '../../../engine/psych/opsPsy';
import { ciblePsy } from '../../../engine/psych/ciblage';

const psy = psychologies.find((p) => !p.label.includes(p.id));
const groupe = groups.find((g) => !g.matchesAll && !g.label.includes(g.id));

describe('opSummary des ops psychologiques : libellés, jamais ids', () => {
  it('précondition : une psychologie et un Groupe dont le libellé ne contient pas l’id', () => {
    expect(psy).toBeDefined();
    expect(groupe).toBeDefined();
  });

  it.each<[string, () => GameOp]>([
    ['beginPsych', () => opPsy.pose(psy!.id, { cible: ciblePsy.groupe(groupe!.id) })],
    ['grantPsychTrait', () => opPsy.octroi(psy!.id, ciblePsy.groupe(groupe!.id))],
  ])('%s : la psychologie et sa Cible', (_op, build) => {
    const texte = opSummary(build());
    expect(texte).toContain(psychologyLabel(psy!.id));
    expect(texte).toContain(groupLabel(groupe!.id));
    expect(texte).not.toContain(psy!.id);
    expect(texte).not.toContain(groupe!.id);
  });

  it('endPsych : la psychologie', () => {
    expect(opSummary(opPsy.fin(psy!.id))).toBe(psychologyLabel(psy!.id));
  });
});
