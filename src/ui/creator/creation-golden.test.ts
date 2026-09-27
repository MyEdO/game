import { describe, it, expect } from 'vitest';
import type { Combatant } from '../../engine/types';
import { makePregens } from '../../data/pregens';
import { createHero, competencesDeCarriere, repartitionDeCarriere } from '../../engine/character';
import { firstLevel } from '../../data';
import { makeRNG } from '../../engine/dice';
import { newDraft, withSpecies, withCareer, buildHero, careerSkillEntries, careerAdvTotal, evenCareerSkillAdvances, type CreatorDraft } from './draft';

/** Ce que la création produit — la forme des choix (clés, désignations) n'y figure pas : seules leurs
 *  conséquences sur le héros. */
function empreinte(h: Combatant) {
  return {
    id: h.id,
    species: h.species,
    career: h.career,
    characteristics: h.characteristics,
    charAdvances: h.charAdvances,
    talents: h.talents,
    skills: h.skills,
    spells: h.spells ?? [],
    items: (h.items ?? []).map((i) => i.trappingId ?? i.label),
    wounds: h.wounds,
    fate: h.fate,
    resilience: h.resilience,
    xp: h.xp,
    size: h.size,
    groups: h.groups,
    designations: Object.fromEntries(Object.entries(h.careerSlotChoices ?? {}).map(([c, m]) => [c, Object.values(m).sort()])),
  };
}

/** Un témoin sans `skillAdvances` porte la répartition par défaut (`evenCareerSkillAdvances`). */
const brouillon = (seed: number, speciesId: string, careerId: string, choix: Partial<CreatorDraft>): CreatorDraft => {
  const d: CreatorDraft = { ...withCareer(withSpecies(newDraft(seed), speciesId), careerId), charsRolled: true, talentsRolled: true, label: 'Témoin', ...choix };
  return choix.skillAdvances ? d : { ...d, skillAdvances: evenCareerSkillAdvances(d) };
};

/** Témoins du créateur : un choix « A ou B » d'espèce, un joker de Métier partagé espèce × carrière,
 *  Maître artisan (ajout de Compétence de carrière), un signe astral à `grantTalent` « Au choix », la
 *  Magie mineure, Béni. */
const TEMOINS: Record<string, () => CreatorDraft> = {
  'A ou B d\'espèce + joker Savoir': () => brouillon(11, 'humains-reiklander', 'erudit', {
    speciesTalentChoices: { 'espece:talents:0': 1 },
    specChoices: { 'carriere:competences:7': 'histoire' },
    skillAdvances: { 'divertissement|narration': 5, 'langue|classique': 5, marchandage: 5, pari: 5, ragot: 5, recherche: 5, 'resistance-a-l-alcool': 0, 'savoir|histoire': 10 },
    careerTalent: { id: 'perspicace' },
  }),
  'joker de Métier espèce × carrière + Maître artisan': () => brouillon(22, 'humains-middenheim', 'artisan', {
    speciesTalentChoices: { 'espece:talents:1': 0 },
    specChoices: { 'espece:talents:1': 'guildes', 'carriere:competences:5': 'forgeron' },
    speciesPlus5: [{ id: 'metier', spec: 'forgeron' }, { id: 'calme' }, { id: 'charme' }],
    speciesPlus3: [{ id: 'divertissement', spec: 'chant' }, { id: 'ragot' }, { id: 'marchandage' }],
    skillAdvances: { athletisme: 5, calme: 5, 'discretion|urbaine': 5, esquive: 5, evaluation: 0, 'metier|forgeron': 10, resistance: 10, 'resistance-a-l-alcool': 0 },
    careerTalent: { id: 'maitre-artisan', spec: 'forgeron' },
  }),
  'signe astral à Talent « Au choix »': () => brouillon(33, 'nains', 'artisan', {
    speciesTalentChoices: { 'espece:talents:1': 1, 'espece:talents:2': 1 },
    specChoices: { 'carriere:competences:5': 'brasseur', 'signe:1': 'brasseur' },
    star: 'les-deux-boeufs',
    careerTalent: { id: 'tres-fort' },
  }),
  'Magie mineure': () => brouillon(44, 'humains-reiklander', 'sorcier', {
    speciesTalentChoices: { 'espece:talents:0': 0 },
    specChoices: { 'carriere:competences:3': 'cieux' },
    careerTalent: { id: 'magie-mineure' },
    pettySpells: ['putrefaction', 'choc'],
  }),
  'Béni': () => brouillon(55, 'humains-reiklander', 'pretre', {
    careerTalent: { id: 'beni', spec: 'ulric' },
  }),
  'A ou B à joker d\'espèce + Talent aléatoire': () => brouillon(66, 'halflings-piedpaille', 'erudit', {
    speciesTalentChoices: { 'espece:talents:4': 0 },
    specChoices: { 'espece:talents:4': 'tanneur', 'carriere:competences:7': 'droit' },
    speciesPlus5: [{ id: 'discretion', spec: 'rurale' }, { id: 'metier', spec: 'tanneur' }, { id: 'charme' }],
    speciesPlus3: [{ id: 'escamotage' }, { id: 'perception' }, { id: 'evaluation' }],
    careerTalent: { id: 'lire-ecrire' },
  }),
};

describe('création de personnage — golden (8 pré-tirés, 6 témoins du créateur)', () => {
  it('les 8 pré-tirés', async () => {
    const pregens = makePregens();
    expect(pregens).toHaveLength(8);
    await expect(JSON.stringify(pregens.map(empreinte), null, 1)).toMatchFileSnapshot('./__golden__/pregens.json');
  });
  it('les témoins du créateur', async () => {
    const out = Object.fromEntries(Object.entries(TEMOINS).map(([nom, d]) => [nom, empreinte(buildHero(d(), 'temoin'))]));
    await expect(JSON.stringify(out, null, 1)).toMatchFileSnapshot('./__golden__/temoins.json');
  });
});

describe('40 Augmentations de carrière — plafond PAR Compétence (LDB 05 l.535)', () => {
  // Intendant : « Savoir (Région) » au Niveau 1 ; Voyageur aguerri (Talent d'espèce halfling de
  // Basseronce) l'ajoute aussi (`grantCareerSkill`). C'est UNE Compétence (LDB 10 l.70, l.745, l.891 ;
  // LDB 11 l.204).
  const choixVoyageur = { 'espece:talents:4': 1 };
  it('10 Augmentations allouées à une Compétence donnent 10, même si un Talent l\'ajoute aussi', () => {
    const hero = createHero({ speciesId: 'halflings-basseronce', careerId: 'intendant', label: 'x', rng: makeRNG(1),
      speciesTalentChoices: choixVoyageur, skillAdvances: { 'savoir|region': 10 } });
    expect(hero.skills.find((s) => s.id === 'savoir' && s.spec === 'region')?.advances).toBe(10);
  });
  it('le brouillon compte cette Compétence UNE fois', () => {
    const d = { ...withCareer(withSpecies(newDraft(1), 'halflings-basseronce'), 'intendant'), speciesTalentChoices: choixVoyageur, skillAdvances: { 'savoir|region': 10 } };
    expect(careerSkillEntries(d).filter((c) => c.designee?.id === 'savoir')).toHaveLength(1);
    expect(careerAdvTotal(d)).toBe(10);
  });
  it('une Compétence AJOUTÉE par un Talent est acquise hors des 40 Augmentations (LDB 05 l.535)', () => {
    const base = { speciesId: 'halflings-basseronce', careerId: 'artisan', label: 'x', speciesTalentChoices: choixVoyageur };
    const entrees = competencesDeCarriere(firstLevel('artisan'), createHero({ ...base, rng: makeRNG(1) }), {});
    const ajout = entrees.filter((c) => c.ajout);
    expect(ajout.map((c) => c.ref.id)).toContain('savoir');
    const allocation = Object.fromEntries(ajout.map((c) => [c.cle, 10]));
    const d = { ...withCareer(withSpecies(newDraft(1), 'halflings-basseronce'), 'artisan'), speciesTalentChoices: choixVoyageur, skillAdvances: allocation };
    expect(careerSkillEntries(d).some((c) => c.ajout)).toBe(false);
    expect(careerAdvTotal(d)).toBe(0);
    const sans = createHero({ ...base, rng: makeRNG(1) });
    const avec = createHero({ ...base, rng: makeRNG(1), skillAdvances: { ...repartitionDeCarriere(entrees), ...allocation } });
    expect(avec.skills).toEqual(sans.skills);
  });
});
