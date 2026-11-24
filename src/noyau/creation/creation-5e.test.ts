/**
 * La procédure de création du livre de base 5e (règle `creation-5e`), jouée par le brouillon : clé posée à l'ouverture,
 * espèces et listes du CRB, gains des premiers tirages, méthodes de Caractéristiques, Augmentations de +5 et leur
 * plafond, héros construit. CRB 005-016
 */
import { describe, it, expect } from 'vitest';
import { setRule, resetRule } from '../../engine/policy';
import { idsDeTest } from '../../engine/idsDeTest.testkit';
import { fortuneMax } from '../../engine/talentEffects';
import { casesDuNiveau } from '../../engine/casesDeCarriere';
import { groupesDe } from '../../engine/groups';
import { blessuresSurLeProfil } from '../../engine/combattantDeTest.testkit';
import { especesCrb } from '../../data';
import type { CharKey, Combatant } from '../../engine/types';
import {
  newDraft, stepIds, especesOffertes, draftSpecies, rollDraftSpecies, rollDraftCareer, rollDraftChars, rerollDraftChars, withSpecies, withCareer,
  withCharMode, withCompteur, withDotationDuNiveauSuivant, withSpeciesSkillTier, gainDEspece, gainDeCarriere, gainDeLaMethode, ohFickleFate,
  bornesDuCompteur, repartition, careerSkillEntries, careerCharKeys, validateStep, buildHero, draftWealth, draftChars, speciesSkillRefs,
  type CreatorDraft,
} from './brouillon';
import { fillDraftDefaults } from './defauts';

/** Un brouillon ouvert sous la règle `creation-5e`. */
const brouillon5e = (seed: number): CreatorDraft => {
  setRule('creation-5e', true);
  const d = newDraft(seed);
  resetRule('creation-5e');
  return d;
};
/** Graine dont le premier tirage d'espèce donne l'Humain et le premier jet de carrière le Garde. */
const GARDE = 7;
/** Graine dont le premier tirage d'espèce donne le Halfling. */
const HALFLING = 5;
const tire = (seed: number) => rollDraftCareer(rollDraftSpecies(brouillon5e(seed)));
const humainGarde = (): CreatorDraft => withCareer(withSpecies(brouillon5e(1), 'humains-reiklander'), 'garde');

describe('clé de la procédure', () => {
  it('posée à l’ouverture depuis la règle, gardée quand la règle change ensuite', () => {
    const d = brouillon5e(1);
    expect(d.procedure).toBe('5e');
    expect(newDraft(1).procedure).toBe('4e');
    expect(stepIds(d)).toEqual(['species', 'career', 'chars', 'skills', 'trappings', 'details', 'presentation']); // CRB 005 l.11-18
  });

  it('les espèces offertes sont les cinq du CRB, listes du CRB (CRB 006 l.5 ; CRB 010 l.59-63)', () => {
    expect(especesOffertes(brouillon5e(1)).map((s) => s.id)).toEqual(['humains-reiklander', 'nains', 'halflings', 'hauts-elfes', 'elfes-sylvains']);
    const halfling = draftSpecies(withSpecies(brouillon5e(1), 'halflings'))!;
    expect(halfling.baseChar.initiative).toBe(40); // CRB 015 l.22
    expect(halfling.talents.some((t) => 'id' in t && t.id === 'petit')).toBe(false);
  });
});

describe('premiers tirages gardés', () => {
  it('espèce gardée : +1 Fortune (CRB 006 l.7)', () => {
    const d = tire(GARDE);
    expect(d.speciesId).toBe('humains-reiklander');
    expect(gainDEspece(d)).toEqual({ fortune: 1 });
    expect(gainDEspece(withSpecies(d, 'nains'))).toEqual({});
  });

  it('premier jet de carrière gardé : 2 dotations du niveau 2, chacune cochée ; trois jets : 1 (CRB 013 l.11-15)', () => {
    let d = tire(GARDE);
    expect(d.careerId).toBe('garde');
    expect(gainDeCarriere(d)).toEqual({ dotations: 2 });
    d = withDotationDuNiveauSuivant(withDotationDuNiveauSuivant(d, 2), 4);
    expect(withDotationDuNiveauSuivant(d, 0)).toBe(d);
    expect(validateStep(d, 'career')).toBeNull();
    const h = buildHero(fillDraftDefaults(d, 'presentation'), idsDeTest, 'garde');
    expect(h.casesDeCarriere?.garde?.[1]?.dotations).toEqual(['cotte-de-mailles', 'lance']);
    expect(casesDuNiveau(h, 'garde', 1)).toBe(2);
    expect((h.items ?? []).map((i) => i.trappingId)).toEqual(expect.arrayContaining(['cotte-de-mailles', 'lance']));
    const troisJets = rollDraftCareer(d);
    expect(troisJets.careerRolls).toHaveLength(3);
    expect(validateStep(troisJets, 'career')).toMatch(/au plus 1 dotation/);
  });

  it('Oh Fickle Fate : +1 Destin quand espèce, carrière et caractéristiques gardent leur premier tirage, méthode A seule (CRB 016 l.69 ; CRB 014 l.5)', () => {
    const d = rollDraftChars(tire(GARDE));
    expect(ohFickleFate(d)).toBe(1);
    expect(ohFickleFate(withCharMode(d, 'reassigne'))).toBe(0);
    expect(ohFickleFate(rerollDraftChars(d))).toBe(0);
    expect(ohFickleFate(withSpecies(d, 'nains'))).toBe(0);
    const h = buildHero(fillDraftDefaults(d, 'presentation'), idsDeTest, 'garde');
    const humain = especesCrb.find((e) => e.id === 'humains-reiklander')!;
    expect(h.fate).toBe(humain.fate + 1);
    expect(h.fortuneDeBase).toBe(humain.fortune + 1);
  });
});

describe('caractéristiques (CRB 014 l.5-21)', () => {
  it('A : +6, B : +3, C : rien, ajoutés à la base et jamais aux Augmentations', () => {
    const d = rollDraftChars(humainGarde());
    expect(gainDeLaMethode(d, 'tire')).toEqual({ bonusDeCarriere: 6 });
    expect(gainDeLaMethode(d, 'reassigne')).toEqual({ bonusDeCarriere: 3 });
    expect(gainDeLaMethode(d, 'repartition')).toEqual({});
    expect(gainDeLaMethode(rerollDraftChars(d), 'tire')).toEqual({});
    expect(repartition(d, 'augmentation')).toEqual({ total: 0, quota: 6 });
    const [k] = careerCharKeys(d) as CharKey[];
    const alloue = withCompteur(d, { genre: 'augmentation', k }, 6);
    expect(validateStep(alloue, 'chars')).toBeNull();
    expect(validateStep(d, 'chars')).toBeNull(); // CRB 014 l.11 « up to »
    expect(validateStep(withCharMode(alloue, 'reassigne'), 'chars')).toMatch(/au plus 3 points/);
    const h = buildHero(fillDraftDefaults(alloue, 'presentation'), idsDeTest, 'x');
    expect(h.charAdvances).toEqual({});
    expect(h.characteristics[k]).toBe(draftChars(alloue)[k] + 6);
  });

  it('C : 100 points de 4 à 16 (CRB 014 l.17)', () => {
    const d = withCharMode(humainGarde(), 'repartition');
    expect(bornesDuCompteur(d, { genre: 'points', k: 'force' })).toEqual({ min: 4, max: 16 });
    expect(withCompteur(d, { genre: 'points', k: 'force' }, 17)).toBe(d);
    expect(repartition(d, 'augmentation').quota).toBe(0);
  });
});

describe('compétences (CRB 015 l.7-29 ; CRB 008 l.55-59)', () => {
  it('8 Augmentations de +5, au plus 3 par Compétence, espèce comprise', () => {
    const d = humainGarde();
    expect(repartition(d, 'competence')).toEqual({ total: 0, quota: 40 });
    const [c] = careerSkillEntries(d);
    expect(bornesDuCompteur(d, { genre: 'competence', cle: c.cle })).toEqual({ min: 0, max: 15 });
    expect(withCompteur(d, { genre: 'competence', cle: c.cle }, 7)).toBe(d);
    const espece = speciesSkillRefs(d).find((r) => careerSkillEntries(d).some((e) => e.designee?.id === r.id && e.designee.spec === r.spec))!;
    const avecEspece = withSpeciesSkillTier(d, espece, 5);
    const partagee = careerSkillEntries(avecEspece).find((e) => e.designee?.id === espece.id)!;
    expect(bornesDuCompteur(avecEspece, { genre: 'competence', cle: partagee.cle }).max).toBe(10);
  });

  it('5 Compétences d’espèce à +5, aucune à +3', () => {
    const d = humainGarde();
    const [r] = speciesSkillRefs(d);
    expect(withSpeciesSkillTier(d, r, 3)).toEqual(d);
    expect(validateStep(fillDraftDefaults(d, 'skills'), 'skills')).toBeNull();
  });

  it('un compteur de carrière hors du pas de 5 est refusé à la construction', () => {
    const d = fillDraftDefaults(humainGarde(), 'presentation');
    const [c] = careerSkillEntries(d);
    expect(() => buildHero({ ...d, skillAdvances: { ...d.skillAdvances, [c.cle]: 3 } }, idsDeTest, 'x')).toThrow(/pas de 5/);
  });
});

describe('héros construit', () => {
  it('progression 5e, Destin et Fortune du CRB, ni Résilience ni Détermination, langue à +30, aucun PX', () => {
    const h = buildHero(fillDraftDefaults(humainGarde(), 'presentation'), idsDeTest, 'x');
    expect(h.progression).toBe('5e');
    expect(h.fate).toBe(4); // CRB 008 l.67
    expect(h.fortuneDeBase).toBe(3); // CRB 008 l.71
    expect(h.fortune).toBe(fortuneMax(h));
    expect('resilience' in h).toBe(false);
    expect('resolve' in h).toBe(false);
    expect(h.skills.find((s) => s.id === 'langue' && s.spec === 'reikspiel')?.advances).toBe(30); // CRB 008 l.55
    expect(h.xp).toBe(0);
  });

  it('richesse : terme fixe plus les dés du Standing (CRB 016 l.15-21)', () => {
    const d = humainGarde();
    const { faces, montant } = draftWealth(d);
    expect(faces).toHaveLength(1);
    expect(montant.silver).toBe(10 + faces[0]);
  });
});

/** Ce que la création produit. */
function empreinte(h: Combatant) {
  return blessuresSurLeProfil({
    species: h.species,
    career: h.career,
    progression: h.progression,
    characteristics: h.characteristics,
    charAdvances: h.charAdvances,
    talents: h.talents,
    skills: h.skills,
    items: (h.items ?? []).map((i) => i.trappingId ?? i.label),
    wounds: h.wounds,
    fate: h.fate,
    fortuneDeBase: h.fortuneDeBase,
    fortune: h.fortune,
    xp: h.xp,
    size: h.size,
    groups: groupesDe(h),
    casesDeCarriere: h.casesDeCarriere,
  });
}

/** Témoins de la procédure 5e : tous les premiers tirages gardés et deux dotations du niveau 2 ; un Halfling tiré aux
 *  Talents aléatoires du CRB, jets réassignés ; un Nain choisi, 100 points répartis. */
const TEMOINS: Record<string, () => CreatorDraft> = {
  'premiers tirages gardés, deux dotations du niveau 2': () => withDotationDuNiveauSuivant(withDotationDuNiveauSuivant(rollDraftChars(tire(GARDE)), 0), 3),
  'Halfling, jets réassignés': () => withCharMode(rollDraftChars(tire(HALFLING)), 'reassigne'),
  'Nain choisi, 100 points': () => withCharMode(withCareer(withSpecies(brouillon5e(9), 'nains'), 'mineur'), 'repartition'),
};

describe('création 5e — golden', () => {
  it('les témoins de la procédure 5e', async () => {
    const out = Object.fromEntries(Object.entries(TEMOINS).map(([nom, d]) => [nom, empreinte(buildHero(fillDraftDefaults(d(), 'presentation'), idsDeTest, 'temoin'))]));
    await expect(JSON.stringify(out, null, 1)).toMatchFileSnapshot('./__golden__/temoins-5e.json');
  });
});
