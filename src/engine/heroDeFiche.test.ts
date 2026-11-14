import { describe, it, expect, vi } from 'vitest';
import * as dice from './dice';
import { heroDeFiche, type FicheDeHeros } from './heroDeFiche';
import { createHero } from './character';
import { effectiveChar } from './characteristics';
import { designationsFor, skillSlots, talentSlots, availableChars } from './careerSlots';
import { isCareerLevelComplete } from './advancement';
import { levelsForCareer, pregens } from '../data';
import { ficheDuPretire } from '../data/pregens';
import { idsDeTest } from './idsDeTest.testkit';
import { tableTotale } from '../lib/tableTotale';
import { CHAR_KEYS, type Characteristics, type Combatant } from './types';

/** Fiche N1 : halfling herboriste, Initiales et Talents d'après Harbull Piedvelu (EDOC 16 l.425-494), dont
 *  Imperturbable « +5 FM, déjà compté » (l.494) ; Bon marcheur sur une spécialisation du catalogue. */
const HALFLING_HERBORISTE: FicheDeHeros = {
  speciesId: 'halflings',
  parcours: { carrieres: { herboriste: 1 } },
  id: 'fiche-halfling',
  label: 'Témoin halfling',
  initiales: { 'capacite-de-combat': 23, 'capacite-de-tir': 43, force: 21, endurance: 22, initiative: 25, agilite: 32, dexterite: 42, intelligence: 30, 'force-mentale': 54, sociabilite: 40 },
  charAdvances: { initiative: 5 },
  skills: [
    { id: 'emprise-sur-les-animaux', advances: 5 },
    { id: 'escalade', advances: 5 },
    { id: 'perception', advances: 10 },
    { id: 'metier', spec: 'herboriste', advances: 10 },
    { id: 'savoir', spec: 'herbes', advances: 5 },
    { id: 'projectiles', spec: 'fronde', advances: 2 },
  ],
  talents: [
    { id: 'bon-marcheur', spec: 'regions-boisees', times: 1 },
    { id: 'imperturbable', times: 1 },
    { id: 'lire-ecrire', times: 1 },
    { id: 'petit', times: 1 },
    { id: 'resistance', spec: 'corruption', times: 1 },
    { id: 'sens-aiguise', spec: 'gout', times: 1 },
    { id: 'vision-nocturne', times: 1 },
  ],
  trappings: [{ id: 'dague', qte: 1 }, { id: 'fronde', qte: 1 }, { id: 'cape', qte: 1 }],
  spells: [],
  fate: 2,
  resilience: 3,
  xp: 0,
};
const COURANTES_HALFLING: Characteristics = { ...HALFLING_HERBORISTE.initiales, initiative: 30 };

const BENEDICTIONS_D_ULRIC = ['benediction-de-bataille', 'benediction-de-courage', 'benediction-de-puissance', 'benediction-de-sauvagerie', 'benediction-de-tenacite', 'benediction-de-vigueur'];

/** Fiche N3 à deux carrières : Prêtre 1 puis Hors-la-loi 3 ; Très résistant (+5 E) déjà compté aux Initiales. */
const PRETRE_PUIS_HORS_LA_LOI: FicheDeHeros = {
  speciesId: 'humains-reiklander',
  parcours: { carrieres: { pretre: 1, 'hors-la-loi': 3 } },
  id: 'fiche-n3',
  label: 'Témoin N3',
  initiales: { 'capacite-de-combat': 35, 'capacite-de-tir': 30, force: 33, endurance: 38, initiative: 31, agilite: 30, dexterite: 28, intelligence: 29, 'force-mentale': 36, sociabilite: 32 },
  charAdvances: { 'capacite-de-combat': 15, force: 15, endurance: 15, 'capacite-de-tir': 15, initiative: 15 },
  skills: [
    { id: 'athletisme', advances: 15 },
    { id: 'calme', advances: 15 },
    { id: 'corps-a-corps', spec: 'base', advances: 20 },
    { id: 'intimidation', advances: 15 },
    { id: 'pari', advances: 15 },
    { id: 'resistance', advances: 15 },
    { id: 'resistance-a-l-alcool', advances: 15 },
    { id: 'survie-en-exterieur', advances: 15 },
    { id: 'esquive', advances: 10 },
    { id: 'priere', advances: 5 },
  ],
  talents: [
    { id: 'beni', spec: 'ulric', times: 1 },
    { id: 'lire-ecrire', times: 1 },
    { id: 'criminel', times: 1 },
    { id: 'combat-deloyal', times: 1 },
    { id: 'tres-resistant', times: 1 },
  ],
  trappings: [{ id: 'arc', qte: 1 }, { id: 'fleche', qte: 20 }, { id: 'dague', qte: 1 }],
  spells: BENEDICTIONS_D_ULRIC,
  fate: 2,
  resilience: 2,
  xp: 0,
};

/** Les appels aux fabriques et rouleurs de `dice` pendant `f`, espionnés sur leur namespace. */
function desConsommes(f: () => void): number {
  let n = 0;
  const ns = dice as unknown as Record<string, unknown>;
  for (const nom of ['makeRNG', 'fluxDerive', 'roll', 'rollDice', 'd10', 'd100']) {
    const vrai = ns[nom] as (...a: unknown[]) => unknown;
    vi.spyOn(ns, nom, 'get').mockReturnValue((...a: unknown[]) => (n++, vrai(...a)));
  }
  vi.spyOn(Math, 'random').mockImplementation(() => (n++, 0.5));
  f();
  vi.restoreAllMocks();
  return n;
}

const courantes = (h: Combatant) => tableTotale(CHAR_KEYS, (k) => effectiveChar(h, k));

describe('heroDeFiche — le héros d\'une fiche imprimée', () => {
  it('N1 : Courantes = Initiales + Augmentations, les +N des Talents comptés une fois', () => {
    const h = heroDeFiche(HALFLING_HERBORISTE, idsDeTest);
    expect(courantes(h)).toEqual(COURANTES_HALFLING);
    expect([h.career, h.careerLevel, h.careerHistory]).toEqual(['herboriste', 1, ['herboriste']]);
    expect(h.skills.map((s) => [s.id, s.spec, s.advances])).toEqual(HALFLING_HERBORISTE.skills.map((s) => [s.id, s.spec, s.advances]));
    expect(h.talents.map((t) => [t.talentId, t.spec, t.times])).toEqual(HALFLING_HERBORISTE.talents.map((t) => [t.id, t.spec, t.times]));
    expect(designationsFor(h, 'herboriste')).toEqual({ '1:talent:0:bon-marcheur*': 'bon-marcheur|regions-boisees' });
    expect(h.size).toBe('petite');
  });

  it('N3 à deux carrières : carrière actuelle, parcours, désignations, Niveau complété, sorts sans doublon', () => {
    const h = heroDeFiche(PRETRE_PUIS_HORS_LA_LOI, idsDeTest);
    const f = PRETRE_PUIS_HORS_LA_LOI;
    expect(courantes(h)).toEqual(tableTotale(CHAR_KEYS, (k) => f.initiales[k] + (f.charAdvances[k] ?? 0)));
    expect([h.career, h.careerLevel, h.careerHistory]).toEqual(['hors-la-loi', 3, ['pretre', 'hors-la-loi']]);
    expect(h.talents.map((t) => [t.talentId, t.spec, t.times])).toEqual(f.talents.map((t) => [t.id, t.spec, t.times]));
    expect(h.skills.map((s) => [s.id, s.spec, s.advances])).toEqual(f.skills.map((s) => [s.id, s.spec, s.advances]));
    expect(designationsFor(h, 'pretre')).toEqual({ '1:talent:1:beni*': 'beni|ulric' });
    expect(designationsFor(h, 'hors-la-loi')).toEqual({});
    const levels = levelsForCareer('hors-la-loi');
    expect(isCareerLevelComplete(h, 3, { skillSlots: skillSlots(levels, 3), talentSlots: talentSlots(levels, 3), careerChars: availableChars(levels, 3), designations: designationsFor(h, 'hors-la-loi') })).toBe(true);
    expect([...(h.spells ?? [])].sort()).toEqual([...BENEDICTIONS_D_ULRIC].sort());
    expect(h.items?.find((i) => i.trappingId === 'fleche')?.qty).toBe(20);
  });

  it('le Maxi en Bonus de Caractéristique se lit sur la fiche imprimée, ses +N de Talents comptés une fois (LDB 10 l.17)', () => {
    const fiche = (fois: number): FicheDeHeros => ({ ...HALFLING_HERBORISTE, initiales: { ...HALFLING_HERBORISTE.initiales, endurance: 45 }, charAdvances: {}, talents: [{ id: 'dur-a-cuire', times: fois }, { id: 'tres-resistant', times: 1 }] });
    expect(heroDeFiche(fiche(4), idsDeTest).talents.find((t) => t.talentId === 'dur-a-cuire')?.times).toBe(4);
    expect(() => heroDeFiche(fiche(5), idsDeTest)).toThrow(/Maxi/);
  });

  it('une possession hors catalogue devient autant d\'objets sans stats que sa quantité imprimée', () => {
    const h = heroDeFiche({ ...HALFLING_HERBORISTE, trappings: [...HALFLING_HERBORISTE.trappings, { text: 'Gamelles', qte: 2 }] }, idsDeTest);
    const gamelles = (h.items ?? []).filter((i) => i.label === 'Gamelles');
    expect(gamelles.map((i) => [i.kind, i.trappingId, i.enc])).toEqual([['misc', undefined, 0], ['misc', undefined, 0]]);
    expect(new Set(gamelles.map((i) => i.uid)).size).toBe(2);
    expect(h.items?.find((i) => i.trappingId === 'fronde')?.equipped).toBe(true);
  });

  // ZI 14 l.125
  it('une possession de fiche à Atout attaché donne un objet qui porte cet Atout', () => {
    const h = heroDeFiche(ficheDuPretire({ ...pregens[0], trappings: [{ id: 'vetements', qualities: [{ id: 'raffine' }] }] }), idsDeTest);
    expect(h.items?.find((i) => i.trappingId === 'vetements')?.qualities?.map((q) => q.id)).toContain('raffine');
  });

  it('aucun dé consommé ; la même création le consomme (espion câblé)', () => {
    expect(desConsommes(() => heroDeFiche(PRETRE_PUIS_HORS_LA_LOI, idsDeTest))).toBe(0);
    expect(desConsommes(() => createHero({ seed: 1, speciesId: 'halflings', careerId: 'herboriste', label: 'Tiré', idNeuf: idsDeTest }))).toBeGreaterThan(0);
  });
});
