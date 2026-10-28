/**
 * Le Compendium nomme un état psychologique et sa Cible par leur LIBELLÉ, jamais par leur id
 * (fiche `user-doctrine-ids-stables-labels-affichage`) : résumé et rangée codex. Entrées choisies par
 * leur forme : un id que son libellé ne contient pas.
 */
import { describe, it, expect } from 'vitest';
import { humanizeOp } from './humanize';
import { opRow } from './opRows';
import { groupLabel, groups, psychologies, psychologyLabel } from '../../data';
import type { GameOp } from '../../engine/ops';

const psy = psychologies.find((p) => !p.label.includes(p.id));
const groupe = groups.find((g) => !g.matchesAll && !g.label.includes(g.id));

const textes = (o: GameOp): string[] => {
  const row = opRow(o);
  return [humanizeOp(o), row.t === 'ref' ? `${row.show} ${row.badge ?? ''}` : ''];
};

describe('ops psychologiques : libellés, jamais ids', () => {
  it('précondition : une psychologie et un Groupe dont le libellé ne contient pas l’id', () => {
    expect(psy).toBeDefined();
    expect(groupe).toBeDefined();
  });

  it.each<[string, () => GameOp]>([
    ['beginPsych', () => ({ op: 'beginPsych', type: psy!.id, cible: groupe!.id })],
    ['grantPsychTrait', () => ({ op: 'grantPsychTrait', psychType: psy!.id, cible: groupe!.id })],
  ])('%s : la psychologie et sa Cible', (_op, build) => {
    for (const texte of textes(build())) {
      expect(texte).toContain(groupLabel(groupe!.id));
      expect(texte).not.toContain(groupe!.id);
    }
    expect(humanizeOp(build())).toContain(psychologyLabel(psy!.id));
  });
});
