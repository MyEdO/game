/**
 * #2948 — ce que le SCHÉMA de `apparences.json` tient au parse : une entrée sans `forme` est une racine
 * (`id` + `label` + `maniement` éventuel, aucune étiquette), une entrée avec `forme` est une variante d'une
 * RACINE, et ses étiquettes de naissance sont des ids existants — ses qualités, des Qualités d'aspect (#3076).
 */
import { afterEach, describe, expect, it } from 'vitest';
import { schema } from './apparences';
import { schema as schemaObjets } from './trappings';
import apparencesJson from '../../apparences.json';
import { poserRegimeVivant } from '../grammaire/idsVivants';
import { IDS_PAR_ESPACE } from '../_ids.generated';

type Entree = { id: string; type: string; label: string; [k: string]: unknown };
const VARIANTE: Entree = { id: 'variante-de-fixture', type: 'apparences', label: 'Variante de fixture', forme: { id: 'epee' }, especes: ['humains-reiklander'], classes: ['courtisans'], qualites: ['raffine'] };
const avec = (...entrees: Entree[]): Entree[] => [...(structuredClone(apparencesJson) as Entree[]), ...entrees];
const refus = (doc: unknown): string => {
  const r = schema.safeParse(doc);
  expect(r.success, 'le document a parsé alors qu’il devait être REFUSÉ').toBe(false);
  return r.success ? '' : r.error.issues.map((i) => i.message).join(' ');
};

afterEach(() => {
  poserRegimeVivant(undefined);
});

describe('apparences.json — racines et variantes (#2948)', () => {
  const RACINE_EPEE: Entree = { id: 'epee', type: 'apparences', label: 'Épée de fixture' };
  const OBJET_DE_FIXTURE = {
    id: 'hache-de-fixture', type: 'trappings', label: 'Hache de fixture', categorie: 'melee',
    subType: 'base', availability: 'Commune', qualities: [], desc: 'Objet de fixture.',
    price: null, source: { book: 'livre-de-base', page: 294 }, shape: { id: 'hache' },
    formChoices: ['hache'],
  };

  it('les références nommées de forme passent les deux catalogues et refusent les scalaires et les ids inconnus', () => {
    expect(schema.safeParse([RACINE_EPEE, VARIANTE]).success).toBe(true);
    expect(schemaObjets.safeParse([OBJET_DE_FIXTURE]).success).toBe(true);
    for (const forme of ['epee', { id: 'forme-inconnue' }])
      expect(schema.safeParse([RACINE_EPEE, { ...VARIANTE, forme }]).success).toBe(false);
    for (const shape of ['hache', { id: 'forme-inconnue' }])
      expect(schemaObjets.safeParse([{ ...OBJET_DE_FIXTURE, shape }]).success).toBe(false);
    expect(schemaObjets.safeParse([{ ...OBJET_DE_FIXTURE, formChoices: ['forme-inconnue'] }]).success).toBe(false);
  });

  it('le document réel parse', () => {
    expect(schema.safeParse(apparencesJson).success).toBe(true);
  });

  it('une variante d’une racine, à étiquettes existantes, parse', () => {
    expect(schema.safeParse(avec(VARIANTE)).success).toBe(true);
  });

  it('une variante d’une forme inconnue est refusée, nommément', () => {
    expect(refus(avec({ ...VARIANTE, forme: { id: 'forme-inexistante' } }))).toMatch(/« forme-inexistante » est absent du catalogue des apparences/);
  });

  it('une variante d’une VARIANTE est refusée : `forme` vise une racine', () => {
    // Régime vivant : la variante de fixture existe et porte le marqueur `forme`.
    poserRegimeVivant((cle) =>
      cle === 'apparences.json'
        ? new Set([...IDS_PAR_ESPACE['apparences.json'], VARIANTE.id])
        : cle === 'apparences.json?forme'
          ? new Set([VARIANTE.id])
          : undefined,
    );
    const petite = { id: 'variante-de-variante-de-fixture', type: 'apparences', label: 'Variante de variante de fixture', forme: { id: VARIANTE.id } };
    expect(refus(avec(VARIANTE, petite))).toMatch(/« variante-de-fixture » porte le marqueur « forme »/);
  });

  it('une racine qui porte une étiquette de naissance est refusée, nommément', () => {
    const doc = avec();
    doc[0].especes = ['humains-reiklander'];
    expect(refus(doc)).toMatch(new RegExp(`« ${doc[0].id} » est une racine \\(sans \`forme\`\\) — l’étiquette « especes »`));
  });

  it.each([
    ['espèce', { especes: ['espece-inexistante'] }, /« espece-inexistante » est absent du catalogue des espèces/],
    ['classe', { classes: ['classe-inexistante'] }, /« classe-inexistante » est absent du catalogue des classes de carrière/],
    ['qualité sans aspect', { qualites: ['rapide'] }, /« rapide » \(variante-de-fixture\) n’est pas une Qualité d’aspect/],
  ])('une étiquette de %s invalide est refusée', (_cas, etiquette, motif) => {
    expect(refus(avec({ ...VARIANTE, ...etiquette }))).toMatch(motif);
  });

  it('une variante qui porte un maniement est refusée : il appartient à sa racine (#3076)', () => {
    expect(refus(avec({ ...VARIANTE, maniement: 'escrime' }))).toMatch(/« variante-de-fixture » est une variante — « maniement » n’appartient qu’à sa racine/);
  });

  it('une Qualité AJOUTÉE à la donnée avec le marqueur `aspect` fait naître une variante (#3076)', () => {
    poserRegimeVivant((cle) =>
      cle === 'qualities.json'
        ? new Set([...IDS_PAR_ESPACE['qualities.json'], 'qualite-d-aspect-de-fixture'])
        : cle === 'qualities.json?aspect'
          ? new Set([...IDS_PAR_ESPACE['qualities.json?aspect'], 'qualite-d-aspect-de-fixture'])
          : undefined,
    );
    expect(schema.safeParse(avec({ ...VARIANTE, qualites: ['qualite-d-aspect-de-fixture'] })).success).toBe(true);
  });
});
