/**
 * LE ROSTER ET L'EXPORT DE HÉROS, leur forme et leurs transformations pures (#2404, #3041) : lecture contrôlée et
 * élaguée (#1463 LD.1), écriture sous `FORMAT_ROSTER`, mise à jour d'une entrée, export/import sous
 * `FORMAT_EXPORT_HEROS`.
 */
import { describe, it, expect } from 'vitest';
import { ecrireLeRoster, lireLeRoster, rosterAvecLeHeros, rosterExport, rosterImport, type RosterEntry } from './roster';
import { FORMAT_EXPORT_HEROS, FORMAT_ROSTER } from './formats.generated';
import { nommerLesRetraits } from './elagage';
import type { Combatant } from '../../engine/types';
import { t } from '../../i18n';
import { ciblePsy } from '../../engine/psych/ciblage';

/** Un État du registre courant, et un id qu'aucun registre ne porte. */
const ETAT_CONNU = 'a-terre';
const ETAT_INCONNU = 'etat-hors-registre';
/** Un Groupe de `groups.json`, et un id qu'il ne porte pas. */
const GROUPE_CONNU = 'skaven';
const GROUPE_INCONNU = 'groupe-hors-registre';

const hero = (id: string, label = 'Héros'): Combatant => ({ id, label, kind: 'hero' }) as unknown as Combatant;
const entry = (id: string): RosterEntry => ({ hero: hero(id), wealth: { gold: 1, silver: 2, brass: 3 } });
const porteur = (id: string, ...etats: string[]): RosterEntry => ({ ...entry(id), hero: { ...hero(id), conditions: etats.map((e) => ({ id: e, value: 1 })) } as unknown as Combatant });

describe('roster — lecture et écriture sous `FORMAT_ROSTER`', () => {
  it('écrit sous son format et se relit à l’identique, brouillon du créateur compris, sans retrait', () => {
    const draft = { speciesId: 'humains-reiklander', careerId: 'sorcier', label: 'Brouillon', pettySpells: ['putrefaction'] } as unknown as RosterEntry['draft'];
    const heros = [entry('h1'), { ...entry('h2'), draft }];
    const brut = ecrireLeRoster(heros);
    expect(JSON.parse(brut)).toEqual({ version: FORMAT_ROSTER, heros });
    expect(lireLeRoster(brut)).toEqual({ heros, retraits: null });
  });

  it('d’un autre format, sans tableau de héros, ou illisible : `null`', () => {
    for (const brut of [JSON.stringify({ version: 'autre-format', heros: [entry('h1')] }), JSON.stringify([entry('h1')]), JSON.stringify({ version: FORMAT_ROSTER }), 'null', '{pas du json']) {
      expect(lireLeRoster(brut), brut).toBeNull();
    }
  });

  it('un héros qui porte un État hors du registre est GARDÉ sans cet État, retrait rendu (#1463 LD.1)', () => {
    const lu = lireLeRoster(ecrireLeRoster([entry('h1'), porteur('h2', ETAT_CONNU, ETAT_INCONNU)]));
    expect(lu?.heros.map((e) => e.hero.id), 'aucun héros perdu').toEqual(['h1', 'h2']);
    expect(lu?.heros[1].hero.conditions).toEqual([{ id: ETAT_CONNU, value: 1 }]);
    expect(lu?.retraits).toEqual({ regles: [], etats: [ETAT_INCONNU], groupes: [] });
  });
});

describe('roster — Trait psychologique à Cible hors de `groups.json` (#1463 LD.1, LDB 21 l.17-21)', () => {
  const connu = { type: 'animosite', cible: ciblePsy.groupe(GROUPE_CONNU) };
  const inconnu = { type: 'haine', cible: ciblePsy.groupe(GROUPE_INCONNU) };
  const peur = { type: 'peur', sourceId: 'goule-1', indice: 1 };
  const avecPsy = (traits: object[]): RosterEntry => ({
    ...entry('h1'),
    hero: {
      ...hero('h1'), conditions: [{ id: ETAT_CONNU, value: 1 }], psychTraits: [...traits, { type: 'trauma' }],
      psychState: [...traits.map((x) => ({ ...x, active: true })), peur], activeEffects: [{ id: 'baume', suppressedPsych: traits }],
    } as unknown as Combatant,
  });

  it('roster lu ET export importé : le Trait est retiré ENTIER (Traits, afflictions, Traits suspendus), Cible nommée, le reste intact', () => {
    const attendu = { ...avecPsy([connu]).hero };
    const lu = lireLeRoster(ecrireLeRoster([entry('h0'), avecPsy([inconnu, connu])]));
    expect(lu?.heros.map((e) => e.hero.id), 'aucun héros perdu').toEqual(['h0', 'h1']);
    expect(lu?.heros[1].hero).toEqual(attendu);
    expect(lu?.retraits).toEqual({ regles: [], etats: [], groupes: [GROUPE_INCONNU] });
    expect(nommerLesRetraits(lu!.retraits!)).toBe(t('elagage.groupes', { ids: GROUPE_INCONNU }));
    const importe = rosterImport(rosterExport(avecPsy([inconnu, connu])));
    expect(importe.entry?.hero).toEqual(attendu);
    expect(importe.retraits).toEqual({ regles: [], etats: [], groupes: [GROUPE_INCONNU] });
  });

  it('Cibles connues : rien retiré', () => {
    expect(lireLeRoster(ecrireLeRoster([avecPsy([connu])]))?.retraits).toBeNull();
    expect(rosterImport(rosterExport(avecPsy([connu]))).retraits).toBeUndefined();
  });

  it('porteur mal formé (listes non-listes, entrées `null`) : relu sans lever, le Trait à Cible inconnue retiré et nommé', () => {
    const malForme = (champs: object): RosterEntry => ({ ...entry('h1'), hero: { ...hero('h1'), ...champs } as unknown as Combatant });
    const cas: [object, object][] = [
      [{ psychTraits: [inconnu], psychState: 'x' }, { psychTraits: [], psychState: 'x' }],
      [{ psychTraits: [inconnu], activeEffects: [null] }, { psychTraits: [], activeEffects: [null] }],
      [{ psychTraits: [inconnu], activeEffects: [{ suppressedPsych: 'x' }] }, { psychTraits: [], activeEffects: [{ suppressedPsych: 'x' }] }],
      [{ psychTraits: [null, inconnu], psychState: {} }, { psychTraits: [null], psychState: {} }],
    ];
    for (const [champs, attendu] of cas) {
      const lu = lireLeRoster(ecrireLeRoster([malForme(champs)]));
      expect(lu?.heros[0].hero).toEqual({ ...hero('h1'), ...attendu });
      expect(lu?.retraits).toEqual({ regles: [], etats: [], groupes: [GROUPE_INCONNU] });
    }
  });

  it('Cible vide : le Trait est retiré sans nommer de Cible', () => {
    const vide = { type: 'haine', cible: '' };
    const lu = lireLeRoster(ecrireLeRoster([avecPsy([vide, connu, inconnu])]));
    expect(lu?.heros[0].hero).toEqual(avecPsy([connu]).hero);
    expect(lu?.retraits).toEqual({ regles: [], etats: [], groupes: [GROUPE_INCONNU] });
    const seule = lireLeRoster(ecrireLeRoster([avecPsy([vide])]));
    expect(seule?.heros[0].hero).toEqual(avecPsy([]).hero);
    expect(seule?.retraits).toBeNull();
  });
});

describe('roster — mise à jour d’une entrée (`rosterAvecLeHeros`)', () => {
  it('porte le héros édité à son entrée, brouillon resynchronisé (motivation, ambitions), les autres intactes', () => {
    const draft = { label: 'Brouillon', motivation: '', ambitionShort: '', ambitionLong: '' } as unknown as RosterEntry['draft'];
    const edited = { ...hero('h1'), motivation: 'Foi', details: { ambitionShort: 'Survivre', ambitionLong: 'Régner' } } as unknown as Combatant;
    const apres = rosterAvecLeHeros([{ ...entry('h1'), draft }, entry('h2')], edited);
    expect(apres?.map((e) => e.hero.id)).toEqual(['h1', 'h2']);
    expect(apres?.[0].hero).toBe(edited);
    expect(apres?.[0].draft).toMatchObject({ label: 'Brouillon', motivation: 'Foi', ambitionShort: 'Survivre', ambitionLong: 'Régner' });
    expect(apres?.[1]).toEqual(entry('h2'));
  });

  it('un héros absent du roster n’y entre pas : `null`', () => {
    expect(rosterAvecLeHeros([entry('h1')], hero('absent'))).toBeNull();
  });
});

describe('roster — export / import (portabilité, sous `FORMAT_EXPORT_HEROS`)', () => {
  it('round-trip valide → entry restituée', () => {
    const back = rosterImport(rosterExport(entry('h1')));
    expect(back).toEqual({ entry: entry('h1') });
  });

  it('l’export porte son `kind` et le format d’export', () => {
    expect(JSON.parse(rosterExport(entry('h1')))).toMatchObject({ kind: 'wfrp4-hero', version: FORMAT_EXPORT_HEROS });
  });

  it('autre format, numéro de version ou RosterEntry nu → message « autre format » ou invalide, jamais un import silencieux', () => {
    const doc = JSON.parse(rosterExport(entry('h1')));
    for (const autre of [{ ...doc, version: 'autre-format' }, { kind: 'wfrp4-hero', v: 8, hero: doc.hero, wealth: doc.wealth }]) {
      const res = rosterImport(JSON.stringify(autre));
      expect(res.entry).toBeUndefined();
      expect(res.error).toContain('autre format');
    }
    expect(rosterImport(JSON.stringify(entry('h2'))).error).toBe('Fichier de personnage invalide.');
  });

  it('héros qui porte un État hors du registre : importé sans cet État, retrait rendu (#1463 LD.1)', () => {
    const res = rosterImport(rosterExport(porteur('h1', ETAT_CONNU, ETAT_INCONNU)));
    expect(res.error).toBeUndefined();
    expect(res.entry?.hero.conditions).toEqual([{ id: ETAT_CONNU, value: 1 }]);
    expect(res.retraits).toEqual({ regles: [], etats: [ETAT_INCONNU], groupes: [] });
    expect(rosterImport(rosterExport(porteur('h1', ETAT_CONNU))).retraits, 'un héros connu entier ne rend aucun retrait').toBeUndefined();
  });

  it('kind différent, JSON invalide, hero.id manquant ou non-chaîne → message explicite, jamais null muet', () => {
    for (const brut of [
      JSON.stringify({ kind: 'autre-chose', version: FORMAT_EXPORT_HEROS, hero: { id: 'h5' } }),
      'pas du json',
      '{}',
      JSON.stringify({ kind: 'wfrp4-hero', version: FORMAT_EXPORT_HEROS, hero: {}, wealth: {} }),
      JSON.stringify({ kind: 'wfrp4-hero', version: FORMAT_EXPORT_HEROS, hero: { id: 42 }, wealth: {} }),
    ]) {
      const res = rosterImport(brut);
      expect(res.entry, brut).toBeUndefined();
      expect(res.error, brut).toBeTruthy();
    }
  });
});
