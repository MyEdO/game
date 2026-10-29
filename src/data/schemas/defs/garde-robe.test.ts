/**
 * #3114, #3111 — ce que le SCHÉMA de `garde-robe.json` tient au parse : une pièce d'accessoire nomme son
 * emplacement et elle seule, un ensemble habille UNE chose sous l'id qui la nomme, toute référence
 * interne (emplacement, pièces) résout dans sa sous-liste, et un emblème porte un document SVG complet
 * à `viewBox` carré.
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

describe('garde-robe.json — emplacements, pièces, ensembles, emblèmes (#3114, #3111)', () => {
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

  it('un emblème sans dessin est refusé, comme un dessin sur une autre ligne', () => {
    expect(refus(avec('taureau-rouge', { svg: undefined }))).toMatch(/« taureau-rouge » \(kind « embleme »\) exige « svg »/);
    refus(avec('casque', { svg: '<svg viewBox="0 0 8 8"></svg>' }));
  });

  it('un dessin d’emblème qui n’est pas un document SVG est refusé', () => {
    expect(refus(avec('taureau-rouge', { svg: '<g fill="#b01c1c"></g>' }))).toMatch(/l’emblème « taureau-rouge » n’est pas un document « <svg …>…<\/svg> »/);
  });

  it('un dessin d’emblème à viewBox non carré, ou sans viewBox, est refusé', () => {
    expect(refus(avec('taureau-rouge', { svg: '<svg viewBox="0 0 256 128"></svg>' }))).toMatch(/l’emblème « taureau-rouge » porte le viewBox « 0 0 256 128 », carré attendu/);
    expect(refus(avec('taureau-rouge', { svg: '<svg width="256" height="256"></svg>' }))).toMatch(/l’emblème « taureau-rouge » n’a pas de viewBox, carré attendu/);
  });

  it('un dessin d’emblème à prologue XML, commentaire ou doctype en tête, ou à viewBox entre apostrophes, est accepté', () => {
    for (const svg of [
      '<?xml version="1.0" encoding="UTF-8" standalone="no"?>\n<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 8 8"></svg>\n',
      '<!-- Créé avec Inkscape -->\n<svg viewBox="0 0 8 8"></svg>',
      '<?xml version="1.0"?>\n<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">\n<svg viewBox="0 0 8 8"></svg>',
      "<svg viewBox='0 0 8 8'></svg>",
      '<svg viewBox = "0,0,8,8"></svg>',
    ]) {
      const r = schema.safeParse(avec('taureau-rouge', { svg }));
      expect(r.success, `${svg} : ${r.success ? '' : r.error.issues.map((i) => i.message).join(' ')}`).toBe(true);
    }
  });

  it('un dessin d’emblème dont width et height, côté du viewBox à défaut, ne font pas un carré est refusé', () => {
    for (const [attributs, taille] of [
      ['width="300" height="100"', '300 × 100'],
      ['width="300"', '300 × 256'],
      ["height='10cm'", '256 × 10cm'],
      ['width="100" height="100mm"', '100 × 100mm'],
      ['width="auto" height="auto"', 'auto × auto'],
    ]) {
      expect(refus(avec('taureau-rouge', { svg: `<svg viewBox="0 0 256 256" ${attributs}></svg>` }))).toContain(
        `l’emblème « taureau-rouge » a pour taille intrinsèque « ${taille} » (width et height, côté du viewBox à défaut), carrée attendue`,
      );
    }
  });

  it('un dessin d’emblème à width et height carrés, unités comprises, est accepté', () => {
    for (const attributs of ['width="64" height="64"', 'width="512px" height="512"', "width='10cm' height=' 10cm '", 'width="256"', 'height="256px"']) {
      const svg = `<svg viewBox="0 0 256 256" ${attributs}></svg>`;
      const r = schema.safeParse(avec('taureau-rouge', { svg }));
      expect(r.success, `${svg} : ${r.success ? '' : r.error.issues.map((i) => i.message).join(' ')}`).toBe(true);
    }
  });

  it('un dessin d’emblème au viewBox qui n’a pas quatre nombres est refusé pour cette raison', () => {
    expect(refus(avec('taureau-rouge', { svg: "<svg viewBox='0 0 8'></svg>" }))).toMatch(/l’emblème « taureau-rouge » porte le viewBox « 0 0 8 », quatre nombres attendus/);
  });

  it('`findPieceById` résout toute pièce sur elle-même et aucune autre ligne', () => {
    for (const e of gardeRobeJson as Entree[]) {
      if (e.kind === 'piece') expect(findPieceById(e.id), e.id).toBe(e);
      else expect(findPieceById(e.id), e.id).toBeUndefined();
    }
  });
});
