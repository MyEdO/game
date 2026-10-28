/**
 * Tableau des OBSESSIONS (EDOC 12 l.170) — table de Cibles des mutations mentales « Haine sporadique »
 * (EDOC 12 l.217) et « Terribles phobies » (EDOC 12 l.241) : chaque rangée désigne un Groupe.
 */
import { describe, it, expect } from 'vitest';
import { makeRNG } from '../engine/dice';
import { findTableEntry } from '../engine/tables';
import { OBSESSIONS, OBSESSIONS_SOURCE, TIRAGE_DE_CIBLE } from './obsessions';
import { attachMutation } from '../engine/corruption';
import { gameOpSchema } from './schemas/grammaire/mecanique';
import { parsePsychTraits } from '../engine/psych/registry';
import { mutationById } from './mutations';
import { findGroupById } from './index';
import type { Combatant } from '../engine/types';
import { ciblePsy } from '../engine/psych/ciblage';

function hero(p: Partial<Combatant> = {}): Combatant {
  return {
    id: 'h', label: 'Cobaye', kind: 'hero',
    characteristics: { 'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 30, endurance: 42, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 35, sociabilite: 30 },
    wounds: { current: 10, max: 12 }, advantage: 0, conditions: [], movement: 4,
    weapons: [], armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    skills: [], talents: [], traits: [], psychTraits: [], psychState: [], mutations: [],
    ...p,
  } as Combatant;
}

const groupeDuJet = (jet: number): string => findTableEntry([...OBSESSIONS], jet).id;

describe('Tableau des Obsessions (EDOC 12 l.170)', () => {
  it('couvre 2d10 sans trou ni chevauchement, source EDOC folio 69', () => {
    for (let jet = 2; jet <= 20; jet++) expect(OBSESSIONS.filter((e) => e.min <= jet && jet <= e.max)).toHaveLength(1);
    expect(OBSESSIONS_SOURCE).toEqual({
      book: 'ennemi-dans-l-ombre-compagnon',
      page: 69,
      note: 'Tableau des Obsessions, EDOC 12 l.170',
    });
  });

  it('chaque rangée désigne un Groupe de `groups.json`', () => {
    expect(OBSESSIONS.filter((e) => !findGroupById(e.id)).map((e) => e.id)).toEqual([]);
  });

  it('les bornes désignent le Groupe imprimé', () => {
    expect(groupeDuJet(2)).toBe('objets-inanimes');
    expect(groupeDuJet(8)).toBe('monstres');
    expect(groupeDuJet(20)).toBe('bonheur');
  });

  it('le tirage (2d10) rend l’id d’une rangée du Tableau', () => {
    const ids = new Set(OBSESSIONS.map((e) => e.id));
    for (let s = 0; s < 30; s++) expect(ids.has(TIRAGE_DE_CIBLE.obsessions(makeRNG(s)))).toBe(true);
  });
});

describe('Cible d’une mutation tirée sur les Obsessions', () => {
  it('« Haine sporadique » → Haine (Cible) dont la Cible tirée est un Groupe effectif (EDOC 12 l.217)', () => {
    const c = hero();
    attachMutation(c, mutationById('haine-sporadique')!, makeRNG(7));
    const haine = (c.traits ?? []).find((t) => t.id === 'haine');
    expect(OBSESSIONS.some((e) => e.id === haine?.arg)).toBe(true);
    expect(parsePsychTraits(c.traits ?? []).psychTraits).toContainEqual({ type: 'haine', cible: ciblePsy.groupe(haine!.arg!) });
  });

  it('« Terribles phobies » → Effrayé (Cible) dont la Cible tirée est un Groupe effectif (EDOC 12 l.241)', () => {
    const c = hero();
    attachMutation(c, mutationById('terribles-phobies')!, makeRNG(3));
    const effraye = (c.traits ?? []).find((t) => t.id === 'effraye');
    expect(OBSESSIONS.some((e) => e.id === effraye?.arg)).toBe(true);
    expect(parsePsychTraits(c.traits ?? []).psychTraits).toContainEqual({ type: 'phobie', cible: ciblePsy.groupe(effraye!.arg!), indice: 0 });
  });
});

describe('Cible tirée d’un `grantTrait` — contre-épreuves (EDOC 12 l.217, l.241)', () => {
  const tirage = { pick: 1, table: { id: 'obsessions' } };
  const chemins = (o: unknown) => {
    const r = gameOpSchema.safeParse(o);
    return r.success ? [] : r.error.issues.map((i) => i.path.join('.'));
  };

  it('une Cible posée ET tirée est refusée', () => {
    expect(chemins({ op: 'grantTrait', trait: { id: 'haine', arg: 'humain' }, cible: tirage })).toEqual(['cible']);
  });

  it('un Trait dont le catalogue de spécialisations n’est pas les Groupes refuse la Cible tirée', () => {
    expect(chemins({ op: 'grantTrait', trait: { id: 'morsure' }, cible: tirage })).toEqual(['cible']);
  });

  it('un Trait dont le catalogue de spécialisations est les Groupes l’admet', () => {
    expect(chemins({ op: 'grantTrait', trait: { id: 'haine' }, cible: tirage })).toEqual([]);
  });
});
