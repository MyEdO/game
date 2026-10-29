/**
 * Fiche du Codex d'une Activité à Compétence libre (`freeSkill`, EDOC 8 l.172) : la liste ÉDITÉE se lit
 * sur la fiche, une rangée-référence par Compétence, comme la liste `skills` du Test posté.
 */
import { describe, it, expect } from 'vitest';
import { categoryByKey } from './registry';
import { activityById } from '../../engine/activities';
import { avecActivite } from '../../engine/activiteMer.testkit';
import { refLabel } from '../../data';

const ficheDePratiquer = () => categoryByKey('activities')!.items.find((i) => i.id === 'pratiquer-competence')!;

describe('Codex — Activité : la liste `freeSkill` éditée se lit sur la fiche', () => {
  it('Pratiquer une Compétence : la section « Compétence libre » rend la liste posée au seam `setDataset`', () => {
    const liste = [{ id: 'metier', spec: 'forgeron' }, { id: 'escalade' }];
    const section = avecActivite({ ...activityById('pratiquer-competence')!, freeSkill: liste },
      () => ficheDePratiquer().sections?.find((s) => s.title === 'Compétence libre'));
    expect(section?.rows).toEqual([
      { t: 'ref', category: 'skills', id: 'metier', label: refLabel('skills', liste[0]), show: refLabel('skills', liste[0]) },
      { t: 'ref', category: 'skills', id: 'escalade', label: refLabel('skills', liste[1]), show: refLabel('skills', liste[1]) },
    ]);
  });
});
