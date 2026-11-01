/**
 * #3114, #3113, #3111 — ce que le SCHÉMA de `garde-robe.json` tient au parse : une pièce d'accessoire nomme son
 * emplacement et elle seule, un ensemble habille UNE chose qu'aucun autre n'habille, toute référence
 * interne (emplacement, pièces) résout dans sa sous-liste, une tête nomme sa race de rendu sous l'id de
 * cette race et aucune autre ligne ne porte un id de race, une coiffure ne porte aucune clé de charge, les
 * têtes sont celles des espèces jouables, et un emblème porte un document SVG complet à `viewBox` carré.
 */
import { describe, expect, it } from 'vitest';
import { cleDHabille, schema, type HabilleDEnsemble } from './garde-robe';
import gardeRobeJson from '../../garde-robe.json';
import speciesJson from '../../species.json';
import raceAppearanceJson from '../../raceAppearance.json';
import { findCoiffureById, findEnsembleParHabille, findPieceById, findTeteById } from '../../index';

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

describe('garde-robe.json — têtes, coiffures, emplacements, pièces, ensembles, emblèmes (#3114, #3113, #3111)', () => {
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

  it('un `habille` de tenue résout dans la sous-liste `tenue` de la garde-robe, et elle seule', () => {
    expect(refus(avec('tenue-uniforme-de-soldat', { habille: { id: 'robe-de-moine', type: 'tenue' } }))).toMatch(/« robe-de-moine » est hors de la sous-liste « tenue »/);
    expect(refus(avec('tenue-uniforme-de-soldat', { habille: { id: 'casque', type: 'tenue' } }))).toMatch(/« casque » est hors de la sous-liste « tenue »/);
  });

  it('un `habille` qui ne résout pas dans l’espace de son type est refusé', () => {
    expect(refus(avec('trapping-plastron', { habille: { id: 'cuirasse-de-mithril', type: 'trapping' } }))).toMatch(/« cuirasse-de-mithril » est absent du catalogue des objets/);
  });

  it('deux ensembles qui habillent la même chose sont refusés, quels que soient leurs ids', () => {
    expect(refus(avec('trapping-plastron', { habille: { id: 'gants', type: 'trapping' } }))).toMatch(/les ensembles « trapping-plastron » et « trapping-gants » habillent tous deux \{ id: « gants », type: « trapping » \}/);
    const r = schema.safeParse(avec('trapping-plastron', { id: 'cuirasse' }));
    expect(r.success, r.success ? '' : r.error.issues.map((i) => i.message).join(' ')).toBe(true);
  });

  it('le doublon de `habille` se localise sur le `habille` du second ensemble', () => {
    const doc = avec('trapping-plastron', { habille: { id: 'gants', type: 'trapping' } });
    const second = Math.max(...['trapping-plastron', 'trapping-gants'].map((id) => doc.findIndex((e) => e.id === id)));
    const r = schema.safeParse(doc);
    const issue = r.success ? undefined : r.error.issues.find((i) => i.message.includes('habillent tous deux'));
    expect(issue?.path).toEqual([second, 'habille']);
  });

  it('`cleDHabille` distingue deux couples `{ type, id }` distincts, et eux seuls', () => {
    const couples: HabilleDEnsemble[] = [
      { id: 'plastron', type: 'trapping' },
      { id: 'plastron', type: 'apparence' },
      { id: 'gants', type: 'trapping' },
      { id: 'uniforme-de-soldat', type: 'tenue' },
    ];
    expect(new Set(couples.map(cleDHabille)).size).toBe(couples.length);
    expect(cleDHabille({ id: 'plastron', type: 'trapping' })).toBe(cleDHabille(couples[0]));
  });

  it('`findEnsembleParHabille` résout tout ensemble par son `habille`, et rien d’un autre type au même id', () => {
    for (const e of gardeRobeJson as Entree[]) {
      if (e.kind === 'ensemble') expect(findEnsembleParHabille(e.habille as HabilleDEnsemble), e.id).toBe(e);
    }
    expect(findEnsembleParHabille({ id: 'uniforme-de-soldat', type: 'trapping' })).toBeUndefined();
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

  it('un id de garde-robe autre qu’une tête n’est jamais un id de race (`raceAppearance.json`)', () => {
    const races = new Set(raceAppearanceJson.map((r) => r.id));
    expect((gardeRobeJson as Entree[]).filter((e) => e.kind !== 'tete' && races.has(e.id)).map((e) => `${e.id} (kind « ${String(e.kind)} »)`)).toEqual([]);
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
