/**
 * #3114 — ce que le SCHÉMA de `garde-robe.json` tient au parse : une pièce d'accessoire nomme son
 * emplacement et elle seule, un ensemble habille UNE chose sous l'id qui la nomme, et toute référence
 * interne (emplacement, pièces) résout dans sa sous-liste.
 */
import { describe, expect, it } from 'vitest';
import { schema } from './garde-robe';
import gardeRobeJson from '../../garde-robe.json';
import { findPieceById } from '../../index';

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

describe('garde-robe.json — emplacements, pièces, ensembles (#3114)', () => {
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

  it('`findPieceById` résout toute pièce sur elle-même et aucune autre ligne', () => {
    for (const e of gardeRobeJson as Entree[]) {
      if (e.kind === 'piece') expect(findPieceById(e.id), e.id).toBe(e);
      else expect(findPieceById(e.id), e.id).toBeUndefined();
    }
  });
});
