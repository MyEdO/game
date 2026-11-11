/**
 * Les valeurs et verdicts de l'assistant que lisent l'écran ET le geste (#3059) : compteurs d'allocation (LDB 05 l.341,
 * l.426, l.459, l.535), PX offerts (LDB 04 l.91, LDB 05 l.210-212, l.337-341), rang d'étape, sous-écran soldé, palier
 * d'espèce d'une Compétence désignée (LDB 05 l.484).
 */
import { describe, it, expect } from 'vitest';
import {
  newDraft, withSpecies, withCareer, rollDraftCareer, rollDraftChars, rerollDraftChars, careerXpDuProchainJet, charsXpDeLaMethode,
  repartition, bornesDuCompteur, withCompteur, valeurDuCompteur, etapeDeRang, stepIds, skillsSubDone, speciesSkillTier,
  speciesSkillRefs, withSpeciesSkillTier, careerSkillEntries, careerCharKeys, validateStep,
} from './brouillon';
import { memeSpecialisation } from '../../data/schemas/grammaire/ref';
import { fillDraftDefaults } from './defauts';

const pret = () => withCareer(withSpecies(newDraft(7), 'humains-reiklander'), 'soldat');

describe('compteurs d’allocation de l’assistant', () => {
  it('100 Points : bornes 4 et 18 par Caractéristique, total sur 100 ; hors bornes, le brouillon est inchangé', () => {
    const d = pret();
    expect(bornesDuCompteur(d, { genre: 'points', k: 'capacite-de-combat' })).toEqual({ min: 4, max: 18 });
    expect(repartition(d, 'points')).toEqual({ total: 100, quota: 100 });
    expect(withCompteur(d, { genre: 'points', k: 'capacite-de-combat' }, 19)).toBe(d);
    expect(withCompteur(d, { genre: 'points', k: 'capacite-de-combat' }, 3)).toBe(d);
    expect(valeurDuCompteur(withCompteur(d, { genre: 'points', k: 'capacite-de-combat' }, 18), { genre: 'points', k: 'capacite-de-combat' })).toBe(18);
  });

  it('5 Augmentations de carrière : le plafond d’une Caractéristique suit ce qui reste à répartir', () => {
    const [k1, k2] = careerCharKeys(pret());
    let d = withCompteur(pret(), { genre: 'augmentation', k: k1 }, 3);
    expect(repartition(d, 'augmentation')).toEqual({ total: 3, quota: 5 });
    expect(bornesDuCompteur(d, { genre: 'augmentation', k: k2 })).toEqual({ min: 0, max: 2 });
    expect(withCompteur(d, { genre: 'augmentation', k: k2 }, 3)).toBe(d);
    d = withCompteur(d, { genre: 'augmentation', k: k2 }, 2);
    expect(repartition(d, 'augmentation')).toEqual({ total: 5, quota: 5 });
    expect(bornesDuCompteur(d, { genre: 'augmentation', k: k1 })).toEqual({ min: 0, max: 3 });
  });

  it('Destin et Résilience : les Points supplémentaires de l’espèce (Humain : 3) se partagent', () => {
    const d = withCompteur(pret(), { genre: 'destin', k: 'fate' }, 2);
    expect(repartition(d, 'destin')).toEqual({ total: 2, quota: 3 });
    expect(bornesDuCompteur(d, { genre: 'destin', k: 'resilience' })).toEqual({ min: 0, max: 1 });
    expect(withCompteur(d, { genre: 'destin', k: 'resilience' }, 2)).toBe(d);
  });

  it('40 Augmentations de Compétences de carrière, 10 au plus par Compétence', () => {
    const d = pret();
    const [c] = careerSkillEntries(d);
    expect(repartition(d, 'competence')).toEqual({ total: 0, quota: 40 });
    expect(bornesDuCompteur(d, { genre: 'competence', cle: c.cle })).toEqual({ min: 0, max: 10 });
    expect(withCompteur(d, { genre: 'competence', cle: c.cle }, 11)).toBe(d);
  });

  it('la validation de l’étape Caractéristiques lit les mêmes répartitions', () => {
    const d = rollDraftChars(pret());
    expect(validateStep(d, 'chars')).toBe('Répartissez 5 Augmentations sur les Caractéristiques de carrière (actuel : 0).');
  });
});

describe('PX offerts par les gestes de l’assistant', () => {
  it('carrière : 50 au 1ᵉʳ jet, 25 aux deux de plus, puis 0 à la relance libre', () => {
    let d = withSpecies(newDraft(7), 'humains-reiklander');
    expect(careerXpDuProchainJet(d)).toBe(50);
    d = rollDraftCareer(d);
    expect(careerXpDuProchainJet(d)).toBe(25);
    d = rollDraftCareer(d);
    expect(careerXpDuProchainJet(d)).toBe(0);
  });

  it('caractéristiques : 50 garder, 25 réassigner, 0 en répartition de points ou après relance', () => {
    const d = pret();
    expect(charsXpDeLaMethode(d, 'tire')).toBe(50);
    expect(charsXpDeLaMethode(d, 'reassigne')).toBe(25);
    expect(charsXpDeLaMethode(d, 'repartition')).toBe(0);
    expect(charsXpDeLaMethode(rerollDraftChars(d), 'tire')).toBe(0);
  });
});

describe('état de l’assistant', () => {
  it('le rang d’étape au-delà de la dernière rend la dernière', () => {
    expect(etapeDeRang(0)).toBe('species');
    expect(etapeDeRang(99)).toBe('presentation');
    expect(etapeDeRang(stepIds().length - 1)).toBe('presentation');
  });

  it('sous-écran de l’étape 5 soldé', () => {
    const d = { ...fillDraftDefaults(newDraft(4242), 'skills'), skillAdvances: {} };
    expect(skillsSubDone(d, 'race')).toBe(true);
    expect(skillsSubDone(d, 'career')).toBe(false);
    expect(skillsSubDone(pret(), 'race')).toBe(false);
  });

  it('palier d’espèce d’une Compétence de carrière désignée', () => {
    const d0 = pret();
    const ref = speciesSkillRefs(d0).find((r) => r.choix == null && careerSkillEntries(d0).some((c) => c.designee?.id === r.id && memeSpecialisation(c.designee.spec, r.spec)));
    if (!ref) throw new Error('le soldat humain partage une Compétence avec son espèce');
    const d = withSpeciesSkillTier(d0, ref, 5);
    const designee = careerSkillEntries(d).find((c) => c.designee?.id === ref.id)?.designee;
    if (!designee) throw new Error('désignée');
    expect(speciesSkillTier(d, designee)).toBe(5);
  });
});
