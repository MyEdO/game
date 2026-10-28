/**
 * Table de classement d'un Trait imprimé (#1463) : fourchette, Indice par Localisation, Aspect et Indice.
 * Fixtures : textes de profils imprimés (ZI 13 l.31, ZI 04 l.228, AA 09 l.184, LDB 78 l.58, PDT 09 l.52,
 * PDT 09 l.536, ACE 05 l.2043, MCLB 02 l.101, MCLB 02 l.698, MSR 09 l.1504, EDO 03 l.303, EDOC 11 l.169 ;
 * Aspects d'Armure : LDB 77 l.95, LDB 78 l.58, MSR 09 l.767, VDM 11 l.228, NADJ 05 l.193, NADJ 05 l.229,
 * NADJ 05 l.305, NADJ 05 l.346, NADJ 13 l.507, NADJ 13 l.556, et les autres graphies du relevé des profils
 * d'Armure (#1463).
 */
import { describe, it, expect } from 'vitest';
import { aspectAToutesLocalisations, classerParenthese, emplacementsDesPieces, formaterParLocalisation, lireAspectIndice, lireParLocalisation, lirePlage, localisationsDeZone } from './classementDeTrait';

/** Catalogue d'armures de fixture, colonne Emplacements de LDB 63 l.42-58. */
const pieces = emplacementsDesPieces([
  { label: 'Calotte de cuir', loc: 'Tête' },
  { label: 'Veste de cuir', loc: 'Bras, Corps' },
  { label: 'Jambières de cuir', loc: 'Jambes' },
  { label: 'Cotte de mailles', loc: 'Bras, Corps' },
  { label: 'Heaume', loc: 'Tête' },
  { label: 'Heaume ouvert', loc: 'Tête' },
  { label: 'Plastron', loc: 'Corps' },
  { label: 'Plastron de cuir', loc: 'Corps' },
  { label: 'Corde', loc: null },
]);
const restreinte = (locs: Partial<Record<'tete' | 'brasG' | 'brasD' | 'corps' | 'jambeG' | 'jambeD', number>>) =>
  ({ tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0, ...locs });

describe('lirePlage', () => {
  it('lit les bornes incluses, espaces compris', () => {
    expect(lirePlage('1-3')).toEqual({ min: 1, max: 3 });
    expect(lirePlage('1- 3')).toEqual({ min: 1, max: 3 });
    expect(lirePlage('7-9')).toEqual({ min: 7, max: 9 });
  });
  it('refuse ce qui n’est pas une fourchette croissante', () => {
    expect(lirePlage('3-1')).toBeUndefined();
    expect(lirePlage('2-2')).toBeUndefined();
    expect(lirePlage('Peau 1')).toBeUndefined();
    expect(lirePlage('-3')).toBeUndefined();
  });
});

describe('emplacementsDesPieces', () => {
  it('rend les Emplacements d’une pièce nommée, pluriel, casse et « en » pour « de » ignorés', () => {
    expect(pieces('Plastron')).toEqual(['corps']);
    expect(pieces('heaume')).toEqual(['tete']);
    expect(pieces('cotte de maille')).toEqual(['brasG', 'brasD', 'corps']);
    expect(pieces('veste en cuir')).toEqual(['brasG', 'brasD', 'corps']);
    expect(pieces('Jambières de cuir')).toEqual(['jambeG', 'jambeD']);
  });
  it('lit une pièce dont le profil sous-entend la matière, et le Casque pour la Tête', () => {
    expect(pieces('Calotte')).toEqual(['tete']);
    expect(pieces('Casque')).toEqual(['tete']);
  });
  it('rend `undefined` pour un nom hors de la table', () => {
    expect(pieces('Plates')).toBeUndefined();
    expect(pieces('Cuir')).toBeUndefined();
    expect(pieces('Corde')).toBeUndefined();
  });
});

describe('lireParLocalisation', () => {
  it('rend à chaque groupe de zones l’Indice qui le suit, membres des quadrupèdes compris', () => {
    expect(lireParLocalisation('Pattes arrières 1, Tête, Corps et Pattes avant 3')).toEqual({ tete: 3, brasG: 3, brasD: 3, corps: 3, jambeG: 1, jambeD: 1 });
    expect(lireParLocalisation('Corps 2, Bras 4, Tête 2')).toEqual(restreinte({ tete: 2, brasG: 4, brasD: 4, corps: 2 }));
  });
  it('donne l’Indice imprimé dehors aux Localisations nommées, aucun PA ailleurs', () => {
    expect(lireParLocalisation('Corps, Bras, Tête', { indice: 2 })).toEqual(restreinte({ tete: 2, brasG: 2, brasD: 2, corps: 2 }));
    expect(lireParLocalisation('Poitrine', { indice: 3 })).toEqual(restreinte({ corps: 3 }));
  });
  it('donne aux pièces nommées l’union de leurs Emplacements', () => {
    expect(lireParLocalisation('Plastron et heaume', { indice: 2, pieces })).toEqual(restreinte({ tete: 2, corps: 2 }));
    expect(lireParLocalisation('Veste de cuir et cotte de maille', { indice: 2, pieces })).toEqual(restreinte({ brasG: 2, brasD: 2, corps: 2 }));
    expect(lireParLocalisation('Calotte et Veste de cuir', { indice: 1, pieces })).toEqual(restreinte({ tete: 1, brasG: 1, brasD: 1, corps: 1 }));
  });
  it('refuse une Localisation à deux Indices, un groupe sans Indice, un nom ni zone ni pièce', () => {
    expect(lireParLocalisation('Tête 2, Tête 3')).toBeUndefined();
    expect(lireParLocalisation('Tête 2, Bras, Corps et Jambes')).toBeUndefined();
    expect(lireParLocalisation('Heaume 2, Plates 3', { indice: 3, pieces })).toBeUndefined();
    expect(localisationsDeZone('Heaume')).toBeUndefined();
  });
  it('relit ce que formate `formaterParLocalisation`, côtés distincts et Localisations sans PA compris', () => {
    for (const p of [
      { tete: 2, brasG: 3, brasD: 3, corps: 3, jambeG: 3, jambeD: 3 },
      { tete: 1, brasG: 2, brasD: 4, corps: 3, jambeG: 0, jambeD: 1 },
      restreinte({ tete: 2, corps: 2 }),
      restreinte({}),
    ]) expect(lireParLocalisation(formaterParLocalisation(p))).toEqual(p);
    expect(formaterParLocalisation({ tete: 2, brasG: 3, brasD: 3, corps: 3, jambeG: 3, jambeD: 3 })).toBe('Tête 2, Bras 3, Corps 3, Jambes 3');
    expect(formaterParLocalisation(restreinte({ tete: 2, corps: 2 }))).toBe('Tête 2, Corps 2');
  });
});

describe('lireAspectIndice', () => {
  it('sépare l’Aspect de l’Indice de la même parenthèse', () => {
    expect(lireAspectIndice('Peau 1')).toEqual({ aspect: 'Peau', indice: 1 });
    expect(lireAspectIndice('Légère 2')).toEqual({ aspect: 'Légère', indice: 2 });
  });
  it('laisse un Aspect sans Indice, ou une liste', () => {
    expect(lireAspectIndice('Peau')).toBeUndefined();
    expect(lireAspectIndice('Heaume 2, Plates 3')).toBeUndefined();
  });
});

describe('classerParenthese', () => {
  it('classe fourchette, Indice par Localisation pour le Trait qui le lit, puis Aspect et Indice', () => {
    expect(classerParenthese('7-9')).toEqual({ plage: { min: 7, max: 9 } });
    expect(classerParenthese('Pattes arrières 1, Tête, Corps et Pattes avant 3', { pieces })).toEqual({ parLocalisation: { tete: 3, brasG: 3, brasD: 3, corps: 3, jambeG: 1, jambeD: 1 } });
    expect(classerParenthese('Cuir 2', { pieces })).toEqual({ aspect: 'Cuir', indice: 2 });
    expect(classerParenthese('Plastron et heaume')).toBeUndefined();
  });
  it('sans les pièces de l’appelant, aucune parenthèse ne se lit en Localisations', () => {
    expect(classerParenthese('Tête 2')).toEqual({ aspect: 'Tête', indice: 2 });
    expect(classerParenthese('Corps, Bras', { indice: 1 })).toBeUndefined();
  });
  it('avec un Indice imprimé dehors, seule la restriction aux Localisations se lit', () => {
    expect(classerParenthese('Plastron et heaume', { indice: 2, pieces })).toEqual({ parLocalisation: restreinte({ tete: 2, corps: 2 }) });
    expect(classerParenthese('Peau', { indice: 1, pieces })).toBeUndefined();
    expect(classerParenthese('Cuir', { indice: 1, pieces })).toBeUndefined();
  });
});

describe('aspectAToutesLocalisations', () => {
  it.each([
    'Moyenne', 'Légère', 'Peau', 'Fourrure', 'Fourrures', 'Cuirs', 'Peau épaisse', 'Peau de chitine', 'Écailles épineuses',
    'Fausse Plate', 'Demi- plate', 'Demi-plate', 'Plate complète', 'Cuirs et Plates', "Cuirs d'un Doktor de la Peste", 'Divers',
  ])('« %s » vaut à toutes les Localisations', (aspect) => {
    expect(aspectAToutesLocalisations(aspect)).toBe(true);
  });
  it.each(['Veste de cuir', 'Chemise de mailles', 'Plastron', 'Bouclier', 'Heaume 2, Plates 3', 'Calotte et veste de cuir', 'Plastron et Heaume', 'Peau 1', 'Cuir clouté sur le torse', 'Fourrure aux bras', 'Écailles des pattes avant'])('« %s » ne s’y lit pas', (aspect) => {
    expect(aspectAToutesLocalisations(aspect)).toBe(false);
  });
});
