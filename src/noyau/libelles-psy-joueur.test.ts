/**
 * Le joueur lit un Trait psy par son LIBELLÉ, jamais par son id (fiche
 * `user-doctrine-ids-stables-labels-affichage`) : issue d'un Test de Psychologie de rencontre.
 * Le verrou de la classe est le paramètre typé de `t()` (`i18n.test.ts`) ; ici, le rendu réel.
 */
import { describe, it, expect } from 'vitest';
import { describeEncounterPsych } from './flowOutcomes';
import { psychologies, psychologyLabel } from '../data';
import type { PsychType } from '../engine/psychology';

const cible = psychologies.find((p) => p.targeted && !p.label.includes(p.id));

describe('issue d’un Trait ciblé à la rencontre : le libellé, jamais l’id', () => {
  it('précondition : un Trait ciblé dont le libellé ne contient pas l’id', () => {
    expect(cible).toBeDefined();
  });

  it.each([true, false])('réussite %s', (success) => {
    const texte = describeEncounterPsych({
      heroId: 'h', kind: cible!.id as PsychType, sourceId: 's', sourceName: 'S', indice: 0, result: { success },
    }, 'H');
    expect(texte).toContain(psychologyLabel(cible!.id));
    expect(texte).not.toContain(cible!.id);
  });
});
