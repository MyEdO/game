/**
 * #3114, #3113 — ce que le SCHÉMA de `garde-robe.json` tient au parse : une pièce d'accessoire nomme son
 * emplacement et elle seule, un ensemble habille UNE chose sous l'id qui la nomme, toute référence
 * interne (emplacement, pièces) résout dans sa sous-liste, une tête nomme sa race de rendu sous l'id de
 * cette race, une coiffure ne porte aucune clé de charge, et les têtes sont celles des espèces jouables.
 */
import { describe, expect, it } from 'vitest';
import { schema } from './garde-robe';
import gardeRobeJson from '../../garde-robe.json';
import speciesJson from '../../species.json';
import { findCoiffureById, findPieceById, findTeteById } from '../../index';

type Entree = { id: string; [k: string]: unknown };
const avec = (id: string, champs: Record<string, unknown>): Entree[] => {
  const doc = structuredClone(gardeRobeJson) as Entree[];
  Object.assign(doc.find((e) => e.id === id)!, champs);
  return doc;
};
const refus = (doc: unknown): string => {
  const r = schema.safeParse(doc);
  expect(r.success, 'le document a parsé alors qu’il devait être REFUSÉ').toBe(false);
  return r.success ? '' : r.error.issues.map((i) => i.message).join(' ');
};

describe('garde-robe.json — têtes, coiffures, emplacements, pièces, ensembles (#3114, #3113)', () => {
  it('le document réel parse', () => {
    const r = schema.safeParse(gardeRobeJson);
    expect(r.success, r.success ? '' : r.error.issues.map((i) => `${i.path.join('.')} : ${i.message}`).join('\n')).toBe(true);
  });

  it('une pièce d’accessoire sans emplacement est refusée', () => {
    expect(refus(avec('insigne', { emplacement: undefined }))).toMatch(/pièce d’accessoire « insigne » EXIGE son emplacement/);
  });

  it('une pièce non accessoire avec emplacement est refusée', () => {
    expect(refus(avec('casque', { emplacement: { id: 'tete' } }))).toMatch(/« casque » n’est pas un accessoire/);
  });

  it('un emplacement inconnu est refusé', () => {
    expect(refus(avec('insigne', { emplacement: { id: 'nombril' } }))).toMatch(/« nombril » est hors de la sous-liste « emplacement »/);
  });

  it('un emplacement qui vise une pièce est refusé', () => {
    expect(refus(avec('insigne', { emplacement: { id: 'casque' } }))).toMatch(/« casque » est hors de la sous-liste « emplacement »/);
  });

  it('un `habille` d’un type hors objet/apparence, ou à clé en trop, est refusé', () => {
    expect(refus(avec('trapping-plastron', { habille: { id: 'plastron', type: 'prop' } }))).toMatch(/type de référence absent ou inconnu/);
    refus(avec('trapping-plastron', { habille: { id: 'plastron', type: 'trapping', apparence: 'plastron' } }));
  });

  it('un `habille` qui ne résout pas dans l’espace de son type est refusé', () => {
    expect(refus(avec('trapping-plastron', { habille: { id: 'cuirasse-de-mithril', type: 'trapping' } }))).toMatch(/« cuirasse-de-mithril » est absent du catalogue des objets/);
  });

  it('un id d’ensemble non dérivé de son `habille` est refusé', () => {
    expect(refus(avec('trapping-plastron', { id: 'cuirasse' }))).toMatch(/« cuirasse » doit s’appeler « trapping-plastron »/);
  });

  it('une pièce inconnue dans un ensemble est refusée', () => {
    expect(refus(avec('trapping-gants', { pieces: ['moufles'] }))).toMatch(/« moufles » est hors de la sous-liste « piece »/);
  });

  it('un ensemble qui répète une pièce est refusé', () => {
    expect(refus(avec('trapping-gants', { pieces: ['gants', 'gants'] }))).toMatch(/répète gants/);
  });

  it('une pièce sans catégorie est refusée', () => {
    expect(refus(avec('casque', { categorie: undefined }))).toMatch(/« casque » \(kind « piece »\) exige « categorie »/);
  });

  it('une tête qui nomme sa race et une coiffure sans charge parsent', () => {
    const doc = [
      { id: 'humain', type: 'garde-robe', label: 'Tête de test', kind: 'tete', race: { id: 'humain' } },
      { id: 'coiffure-test', type: 'garde-robe', label: 'Coiffure de test', kind: 'coiffure' },
    ];
    const r = schema.safeParse(doc);
    expect(r.success, r.success ? '' : r.error.issues.map((i) => i.message).join('\n')).toBe(true);
  });

  it('une tête sans race est refusée', () => {
    expect(refus(avec('humain', { race: undefined }))).toMatch(/« humain » \(kind « tete »\) exige « race »/);
  });

  it('une tête dont l’id n’est pas sa race est refusée', () => {
    expect(refus(avec('nain', { race: { id: 'orc' } }))).toMatch(/la tête « nain » doit s’appeler « orc », l’id de sa race/);
  });

  it('une race de tête absente de `raceAppearance.json` est refusée', () => {
    expect(refus(avec('humain', { race: { id: 'homme-lezard' } }))).toMatch(/« homme-lezard » est absent du catalogue des races de rendu/);
  });

  it('les têtes sont EXACTEMENT les espèces jouables, une par colonne d’apparence (`species.json › refChar`)', () => {
    const tetes = (gardeRobeJson as Entree[]).filter((e) => e.kind === 'tete').map((e) => e.id).sort();
    expect(tetes).toEqual([...new Set(speciesJson.map((s) => s.refChar))].sort());
  });

  it('une clé de charge sur une tête ou une coiffure est refusée', () => {
    expect(refus(avec('humain', { categorie: 'vetement' }))).toMatch(/« categorie » n’appartient qu’au\(x\) cas kind « piece » — refusée sur « humain » \(kind « tete »\)/);
    expect(refus(avec('crane-rase', { emplacement: { id: 'tete' } }))).toMatch(/« emplacement » n’appartient qu’au\(x\) cas kind « piece » — refusée sur « crane-rase » \(kind « coiffure »\)/);
  });

  it.each([
    ['tete', findTeteById],
    ['coiffure', findCoiffureById],
  ] as const)('`find` de la nature « %s » résout toute ligne de sa nature sur elle-même et aucune autre ligne', (kind, find) => {
    for (const e of gardeRobeJson as Entree[]) {
      if (e.kind === kind) expect(find(e.id), e.id).toBe(e);
      else expect(find(e.id), e.id).toBeUndefined();
    }
  });

  it('`findPieceById` résout toute pièce sur elle-même et aucune autre ligne', () => {
    for (const e of gardeRobeJson as Entree[]) {
      if (e.kind === 'piece') expect(findPieceById(e.id), e.id).toBe(e);
      else expect(findPieceById(e.id), e.id).toBeUndefined();
    }
  });
});
