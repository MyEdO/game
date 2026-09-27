import { describe, it, expect } from 'vitest';
import { fillDraftDefaults } from './creatorDefaults';
import { newDraft, validateStep, stepIds, talentsDone, skillsSubMessage, buildHero, type CreatorDraft } from './draft';

/** Brouillon complet d'un Prêtre (Niveau 1 : « Béni (Au choix) »), valide à toutes les étapes. */
function pretreComplet(): CreatorDraft {
  return fillDraftDefaults({ ...newDraft(4242), speciesId: 'humains-reiklander', careerId: 'pretre' }, 'presentation');
}
/** Première étape que l'assistant refuse de franchir — `Suivant`/`Engager` suivent `validateStep`. */
const premierRefus = (d: CreatorDraft) => stepIds().map((s) => ({ s, err: validateStep(d, s) })).find((x) => x.err);

describe('brouillon restauré : Talent de carrière joker sans spécialisation', () => {
  it('témoin : le brouillon complet du Prêtre franchit toutes les étapes et construit un héros', () => {
    const d = pretreComplet();
    expect(d.careerId).toBe('pretre');
    expect(premierRefus(d)).toBeUndefined();
    expect(() => buildHero(d)).not.toThrow();
  });

  it('« Béni » nu : refusé à l’étape des Talents, avant toute construction, message affiché', () => {
    const d: CreatorDraft = { ...pretreComplet(), careerTalent: { id: 'beni' } };
    expect(premierRefus(d)).toEqual({ s: 'skills', err: 'Choisissez la spécialisation de votre Talent de carrière « Béni ».' });
    expect(talentsDone(d)).toBe(false);
    expect(skillsSubMessage(d, 'talents')).toBe('Choisissez la spécialisation de votre Talent de carrière « Béni ».');
    expect(validateStep(d, 'skills')).not.toMatch(/LDB|l\.\d/);
  });

  it('Talent absent du Niveau 1 : refusé de même', () => {
    const d: CreatorDraft = { ...pretreComplet(), careerTalent: { id: 'tres-fort' } };
    expect(premierRefus(d)?.s).toBe('skills');
    expect(talentsDone(d)).toBe(false);
  });
});
