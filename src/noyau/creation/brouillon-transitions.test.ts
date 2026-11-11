/**
 * Les transitions du brouillon que l'écran du créateur appelle (#3059) : chacune est une fonction de `brouillon.ts`,
 * ses refus et ses réinitialisations compris — méthode des Caractéristiques et réassignation (LDB 05 l.337-341),
 * signe astral (ADE II 3 l.36), Compétences de race (LDB 05 l.484), répartition de carrière et Talent de carrière
 * (LDB 05 l.535), Magie mineure (LDB 10 l.714), état civil.
 */
import { describe, it, expect } from 'vitest';
import {
  newDraft, withSpecies, withCareer, withCharMode, withAssignment, withIgnoreRestrictions, withStar, withStarTalentSpec,
  withSpeciesSkillDefaults, withEvenCareerSkillAdvances, withCareerTalent, withCareerTalentSpec, careerTalentOptions,
  withPettySpellToggled, pettySpellQuota, withTrappingChoice, withEtatCivil, withSexeSuivant, rollDraftName, rollDraftDetails,
  validateStep,
} from './brouillon';
import { adresseDeCreation } from '../../engine/adresseDeCreation';

const page = () => newDraft(7);
const pret = () => withCareer(withSpecies(page(), 'humains-reiklander'), 'soldat');

describe('Caractéristiques : méthode et réassignation', () => {
  it('la méthode se pose ; la même méthode rend le brouillon inchangé', () => {
    const d = pret();
    expect(withCharMode(d, 'tire')).toBe(d);
    expect(withCharMode(d, 'repartition').charMode).toBe('repartition');
  });

  it('réassigner échange les deux jets : l’affectation reste une permutation', () => {
    const d = withAssignment(pret(), 'capacite-de-combat', 3);
    expect(d.assignment).toEqual({
      'capacite-de-combat': 3, 'capacite-de-tir': 1, force: 2, endurance: 0, initiative: 4,
      agilite: 5, dexterite: 6, intelligence: 7, 'force-mentale': 8, sociabilite: 9,
    });
  });

  it('un jet hors des dix rend le brouillon inchangé', () => {
    const d = pret();
    expect(withAssignment(d, 'capacite-de-combat', 10)).toBe(d);
  });
});

describe('Carrière : filtre par espèce', () => {
  it('lever le filtre se pose ; le même état rend le brouillon inchangé', () => {
    const d = pret();
    expect(withIgnoreRestrictions(d, false)).toBe(d);
    expect(withIgnoreRestrictions(d, true).ignoreRestrictions).toBe(true);
  });

  it('une carrière hors de la liste de l’espèce ne valide l’étape que sous le filtre levé', () => {
    const libre = withCareer(withIgnoreRestrictions(withSpecies(page(), 'humains-reiklander'), true), 'tueur');
    expect(validateStep(libre, 'career')).toBeNull();
    expect(validateStep(withIgnoreRestrictions(libre, false), 'career')).toBe('Cette carrière n’est pas ouverte à votre race : choisissez-en une autre, ou levez les restrictions de race.');
    expect(validateStep(pret(), 'career')).toBeNull();
  });
});

describe('signe astral', () => {
  it('la spécialisation du Talent octroyé se pose et s’efface à l’adresse du signe', () => {
    const d = withStarTalentSpec(withStar(pret(), 'les-deux-boeufs'), 1, 'alchimiste');
    expect(d.specChoices).toEqual({ [adresseDeCreation.signe(1)]: 'alchimiste' });
    expect(withStarTalentSpec(d, 1, '').specChoices).toEqual({});
  });

  it('changer de signe, ou n’en prendre aucun, efface les spécialisations de l’ancien ; les autres restent', () => {
    const autre = adresseDeCreation.especeTalent(0);
    const d = withStarTalentSpec(withStar({ ...pret(), specChoices: { [autre]: 'x' } }, 'les-deux-boeufs'), 1, 'alchimiste');
    expect(withStar(d, 'la-grande-croix').specChoices).toEqual({ [autre]: 'x' });
    expect(withStar(d, undefined)).toMatchObject({ star: undefined, specChoices: { [autre]: 'x' } });
    expect(withStar(d, 'les-deux-boeufs')).toBe(d);
  });
});

describe('Compétences et Talent de carrière', () => {
  it('répartition par défaut des Compétences de race : 3 à +5, 3 à +3 ; sans espèce, inchangé', () => {
    const d = withSpeciesSkillDefaults(pret());
    expect(d.speciesPlus5).toEqual([{ id: 'calme' }, { id: 'charme' }, { id: 'commandement' }]);
    expect(d.speciesPlus3).toEqual([{ id: 'corps-a-corps', spec: 'base' }, { id: 'evaluation' }, { id: 'langue', spec: 'bretonnien' }]);
    const vide = page();
    expect(withSpeciesSkillDefaults(vide)).toBe(vide);
  });

  it('répartition simple : +5 sur les huit Compétences de carrière', () => {
    expect(withEvenCareerSkillAdvances(pret()).skillAdvances).toEqual({
      athletisme: 5, calme: 5, 'corps-a-corps|base': 5, escalade: 5, esquive: 5, 'langue|bataille': 5, musicien: 5, resistance: 5,
    });
  });

  it('spécialisation d’un Talent joker : il devient le Talent de carrière ; vide, il se retire, un autre Talent reste', () => {
    const d = withCareer(withSpecies(page(), 'humains-reiklander'), 'artisan');
    const [artiste, , maitre] = careerTalentOptions(d).map((o) => o.ref);
    const pris = withCareerTalentSpec(d, maitre, 'alchimiste');
    expect(pris.careerTalent).toEqual({ id: 'maitre-artisan', spec: 'alchimiste' });
    expect(withCareerTalentSpec(pris, maitre, '').careerTalent).toBeUndefined();
    expect(withCareerTalentSpec(pris, artiste, '')).toBe(pris);
  });
});

describe('Magie mineure', () => {
  const sorcier = () => withCareerTalent(withCareer(withSpecies(page(), 'humains-reiklander'), 'sorcier'), { id: 'magie-mineure' });

  it('quota 2 : deux sorts se retiennent, le troisième rend le brouillon inchangé ; un sort retenu se retire', () => {
    const s = sorcier();
    expect(pettySpellQuota(s)).toBe(2);
    const deux = withPettySpellToggled(withPettySpellToggled(s, 'alerte'), 'bruits');
    expect(deux.pettySpells).toEqual(['alerte', 'bruits']);
    expect(withPettySpellToggled(deux, 'choc')).toBe(deux);
    expect(withPettySpellToggled(deux, 'alerte').pettySpells).toEqual(['bruits']);
  });

  it('sans le Talent, aucun sort ne se retient', () => {
    const d = pret();
    expect(withPettySpellToggled(d, 'alerte')).toBe(d);
  });
});

describe('dotation', () => {
  it('l’option d’un emplacement se pose à son adresse', () => {
    expect(withTrappingChoice(pret(), adresseDeCreation.dotation([0]), 1).trappingChoices).toEqual({ [adresseDeCreation.dotation([0])]: 1 });
  });
});

describe('état civil', () => {
  it('les champs se posent, une clé à undefined efface le trait', () => {
    const d = withEtatCivil(pret(), { label: 'Gunther', age: 30, motivation: 'Venger son frère' });
    expect(d).toMatchObject({ label: 'Gunther', age: 30, motivation: 'Venger son frère' });
    expect(withEtatCivil(d, { age: undefined }).age).toBeUndefined();
  });

  it('le sexe passe de Masculin à Féminin, puis revient', () => {
    const f = withSexeSuivant(pret());
    expect(f.apparence.sex).toBe('F');
    expect(withSexeSuivant(f).apparence.sex).toBe('M');
  });

  it('le physique tiré (graine 7, Reiklander) ; sans espèce, inchangé', () => {
    expect(rollDraftDetails(pret())).toMatchObject({ age: 25, height: 172, eyes: 'Gris', hair: 'Brun clair' });
    const vide = page();
    expect(rollDraftDetails(vide)).toBe(vide);
  });

  it('le nom tiré au générateur (graine 42, Reiklander, Masculin) ; sans espèce, inchangé', () => {
    expect(rollDraftName(pret(), 42).label).toBe('Lupold Kalberer');
    const vide = page();
    expect(rollDraftName(vide, 42)).toBe(vide);
  });
});
