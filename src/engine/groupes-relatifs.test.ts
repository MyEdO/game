/**
 * Groupes relatifs (#1463, #3045) : chacun se lit par rapport au PORTEUR du Trait psy qui le vise (`vise`).
 * Engagés (LDB 85 l.282 ; Q12 B), Étrangers (Q15 A), autres Races (LDB 19 l.152 ; EDOC 12 l.219).
 * Fiches fabriquées ; les entrées de donnée sont choisies par leur forme, sauf une Race que nomme un livre.
 */
import { describe, it, expect } from 'vitest';
import { targetedTrigger, vise, type PsychType, sourceCombattant } from './psychology';
import { ciblePsy } from './psych/ciblage';
import { attachMutation } from './corruption';
import { relatifSchema, type Relatif } from '../data/schemas/defs/groups';
import { groups, mutations, psychologies } from '../data';
import type { Combatant } from './types';
import { mutationById } from '../data/mutations';
import { desDuTest } from './dice.testkit';
import { blessuresSurLeProfil, blessuresDeBase } from './combattantDeTest.testkit';

const mk = (id: string, kind: Combatant['kind'], o: Partial<Combatant> = {}): Combatant => (blessuresSurLeProfil({
  id, label: id, kind, advantage: 0, conditions: [], characteristics: {} as never, psychState: [], psychTraits: [],
  groups: [], weapons: [], armour: {} as never, skills: [], talents: [], movement: 4, wounds: blessuresDeBase(10), ...o,
}) as Combatant);

const relatif = (r: Relatif) => groups.find((g) => g.relatif === r);
const cibleRelative = (r: Relatif) => ciblePsy.groupe(relatif(r)!.id);
const races = groups.filter((g) => g.race);
const [raceA, raceB] = races;
const sansRace = groups.find((g) => !g.race && !g.relatif && !g.matchesAll);
const lien = psychologies.find((p) => p.triggerOn === 'threatened' && p.cibles?.includes('groupe') && p.cibles.includes('individu'));

describe('préconditions de forme', () => {
  it('chaque Groupe relatif de l’énumération est porté par un Groupe ; la donnée a deux Races, un Groupe sans Race et un lien', () => {
    for (const r of relatifSchema.options) expect(relatif(r), r).toBeDefined();
    for (const x of [raceA, raceB, sansRace, lien]) expect(x).toBeDefined();
  });
});

describe('Engagés avec le porteur (LDB 85 l.282 ; Q12 B)', () => {
  const cible = () => cibleRelative('engagesAvecPorteur');

  it('vise tout combattant Engagé avec le porteur, de tout camp, et lui seul', () => {
    const porteur = mk('p', 'ennemi', { engagedWith: ['a', 'b'] });
    expect(vise(cible(), sourceCombattant(mk('a', 'heros')), 'appartenance', porteur)).toBe(true);
    expect(vise(cible(), sourceCombattant(mk('b', 'ennemi')), 'percu', porteur)).toBe(true);
    expect(vise(cible(), sourceCombattant(mk('c', 'heros')), 'appartenance', porteur)).toBe(false);
  });

  it('un interlocuteur n’est jamais Engagé', () => {
    expect(vise(cible(), { genre: 'interlocuteur', groups: [] }, 'percu', mk('p', 'ennemi'))).toBe(false);
  });
});

describe('Étrangers au porteur (Q15 A)', () => {
  const cible = () => cibleRelative('etrangersAuPorteur');

  it('vise un combattant d’un autre camp, jamais un compagnon ni le porteur', () => {
    const porteur = mk('p', 'heros');
    expect(vise(cible(), sourceCombattant(mk('e', 'ennemi')), 'percu', porteur)).toBe(true);
    expect(vise(cible(), sourceCombattant(mk('n', 'pnj')), 'percu', porteur)).toBe(true);
    expect(vise(cible(), sourceCombattant(mk('h', 'heros')), 'percu', porteur)).toBe(false);
    expect(vise(cible(), sourceCombattant(porteur), 'percu', porteur)).toBe(false);
  });

  it('le camp d’un PNJ est son groupe', () => {
    const porteur = mk('p', 'ennemi');
    expect(vise(cible(), sourceCombattant(mk('e', 'ennemi')), 'percu', porteur)).toBe(false);
    expect(vise(cible(), sourceCombattant(mk('h', 'heros')), 'percu', porteur)).toBe(true);
  });

  it('ni l’individu ni le Groupe que vise un lien du porteur (Amour, Camaraderie) n’est étranger', () => {
    const parIndividu = mk('p', 'heros', { psychTraits: [{ type: lien!.id as PsychType, cible: ciblePsy.individu('e') }] });
    expect(vise(cible(), sourceCombattant(mk('e', 'ennemi')), 'percu', parIndividu)).toBe(false);
    expect(vise(cible(), sourceCombattant(mk('f', 'ennemi')), 'percu', parIndividu)).toBe(true);
    const parGroupe = mk('p', 'heros', { psychTraits: [{ type: lien!.id as PsychType, cible: ciblePsy.groupe(sansRace!.id) }] });
    expect(vise(cible(), sourceCombattant(mk('e', 'ennemi', { groups: [sansRace!.id] })), 'percu', parGroupe)).toBe(false);
  });

  it('un interlocuteur est étranger, sauf si ses Groupes sont visés par un lien du porteur', () => {
    const porteur = mk('p', 'heros', { psychTraits: [{ type: lien!.id as PsychType, cible: ciblePsy.groupe(sansRace!.id) }] });
    expect(vise(cible(), { genre: 'interlocuteur', groups: [] }, 'percu', porteur)).toBe(true);
    expect(vise(cible(), { genre: 'interlocuteur', groups: [sansRace!.id] }, 'percu', porteur)).toBe(false);
  });

  it('un lien à Cible relative ne retire personne des étrangers', () => {
    const porteur = mk('p', 'heros', { psychTraits: [{ type: lien!.id as PsychType, cible: cible() }] });
    expect(vise(cible(), sourceCombattant(mk('e', 'ennemi')), 'percu', porteur)).toBe(true);
  });
});

describe('Autres Races que le porteur (LDB 19 l.152 ; EDOC 12 l.219)', () => {
  const cible = () => cibleRelative('autresRacesQueLePorteur');
  const porteur = () => mk('p', 'heros', { groups: [raceA!.id] });

  it('vise une source d’une autre Race, jamais une source de la sienne ni le porteur', () => {
    expect(vise(cible(), sourceCombattant(mk('b', 'ennemi', { groups: [raceB!.id] })), 'percu', porteur())).toBe(true);
    expect(vise(cible(), sourceCombattant(mk('a', 'ennemi', { groups: [raceA!.id] })), 'percu', porteur())).toBe(false);
    const p = porteur();
    expect(vise(cible(), sourceCombattant(p), 'percu', p)).toBe(false);
  });

  it('une source sans Race n’est pas de la Race du porteur : elle est visée', () => {
    expect(vise(cible(), sourceCombattant(mk('s', 'ennemi', { groups: [sansRace!.id] })), 'percu', porteur())).toBe(true);
    expect(vise(cible(), { genre: 'interlocuteur', groups: [] }, 'percu', porteur())).toBe(true);
  });

  it('seul un Groupe marqué Race compte : partager un Groupe sans Race n’est pas être de la même Race', () => {
    const p = mk('p', 'heros', { groups: [raceA!.id, sansRace!.id] });
    expect(vise(cible(), sourceCombattant(mk('b', 'ennemi', { groups: [raceB!.id, sansRace!.id] })), 'percu', p)).toBe(true);
  });

  it('un porteur sans Race ne se vise jamais lui-même', () => {
    const p = mk('p', 'heros', { groups: [sansRace!.id] });
    expect(vise(cible(), sourceCombattant(p), 'percu', p)).toBe(false);
    expect(vise(cible(), sourceCombattant(mk('b', 'ennemi', { groups: [raceB!.id] })), 'percu', p)).toBe(true);
  });

  it('un porteur de deux Races ne vise aucune source de l’une ou de l’autre', () => {
    const metis = mk('p', 'heros', { groups: [raceA!.id, raceB!.id] });
    expect(vise(cible(), sourceCombattant(mk('b', 'ennemi', { groups: [raceB!.id] })), 'percu', metis)).toBe(false);
  });
});

describe('Pulsions de haine (LDB 19 l.152 ; EDOC 12 l.219)', () => {
  const pulsions = mutations.find((m) =>
    m.passive?.some((op) => op.op === 'grantPsychTrait' && !!op.cible && 'id' in op.cible && groups.find((g) => 'id' in op.cible! && g.id === op.cible!.id)?.relatif === 'autresRacesQueLePorteur'),
  );
  const cible = () => cibleRelative('autresRacesQueLePorteur');

  it('la mutation pose un Trait qui se déclenche devant une autre Race, pas devant la sienne', () => {
    expect(pulsions).toBeDefined();
    const mutant = mk('m', 'heros', { groups: [raceA!.id], pos: { x: 0, y: 0 } });
    attachMutation(mutant, mutationById(pulsions!.id)!, desDuTest);
    expect(mutant.psychTraits?.some((t) => t.cible === cible())).toBe(true);
    expect(targetedTrigger(mutant, [sourceCombattant(mk('a', 'ennemi', { groups: [raceA!.id] }))])).toBeNull();
    expect(targetedTrigger(mutant, [sourceCombattant(mk('b', 'ennemi', { groups: [raceB!.id] }))])?.cible).toBe(cible());
  });

  it('un skaven mutant ne vise pas un skaven allié : LDB 84 l.63 nomme les skavens une race', () => {
    const mutant = mk('m', 'ennemi', { groups: ['skaven'], pos: { x: 0, y: 0 } });
    attachMutation(mutant, mutationById(pulsions!.id)!, desDuTest);
    expect(targetedTrigger(mutant, [sourceCombattant(mk('allie', 'ennemi', { groups: ['skaven'] }))])).toBeNull();
    expect(targetedTrigger(mutant, [sourceCombattant(mk('h', 'heros', { groups: [raceA!.id] }))])?.cible).toBe(cible());
  });
});
