import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { rosterLoad, rosterAdd, rosterRemove, rosterUpdate, rosterExport, rosterImport, takeRosterNotice, RosterEntry } from './roster';
import { FORMAT_EXPORT_HEROS, FORMAT_ROSTER } from './formats.generated';
import type { Combatant } from '../engine/types';

/** Fake Storage minimal — l'environnement de test est `node` (pas de localStorage). */
function fakeStorage(): Storage {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, String(v)),
    removeItem: (k: string) => void m.delete(k),
    clear: () => m.clear(),
    key: (i: number) => [...m.keys()][i] ?? null,
    get length() {
      return m.size;
    },
  } as Storage;
}

const hero = (id: string, label = 'Héros'): Combatant => ({ id, label, kind: 'hero' }) as unknown as Combatant;
const entry = (id: string): RosterEntry => ({
  hero: hero(id),
  wealth: { gold: 1, silver: 2, brass: 3 },
});

describe('roster — persistance des personnages créés', () => {
  beforeEach(() => {
    (globalThis as { localStorage?: Storage }).localStorage = fakeStorage();
  });
  afterEach(() => {
    delete (globalThis as { localStorage?: Storage }).localStorage;
  });

  it('vide au départ', () => {
    expect(rosterLoad()).toEqual([]);
  });

  it('rosterAdd puis rosterLoad : le personnage et sa richesse initiale sont retrouvés', () => {
    rosterAdd(entry('h1'));
    const list = rosterLoad();
    expect(list).toHaveLength(1);
    expect(list[0].hero.id).toBe('h1');
    expect(list[0].wealth).toEqual({ gold: 1, silver: 2, brass: 3 });
  });

  it('rosterAdd avec le même hero.id remplace (pas de doublon)', () => {
    rosterAdd(entry('h1'));
    rosterAdd({ hero: hero('h1', 'Renommé'), wealth: { gold: 0, silver: 0, brass: 9 } });
    const list = rosterLoad();
    expect(list).toHaveLength(1);
    expect(list[0].hero.label).toBe('Renommé');
    expect(list[0].wealth.brass).toBe(9);
  });

  it('rosterRemove retire l’entrée visée et garde les autres', () => {
    rosterAdd(entry('h1'));
    rosterAdd(entry('h2'));
    rosterRemove('h1');
    const list = rosterLoad();
    expect(list).toHaveLength(1);
    expect(list[0].hero.id).toBe('h2');
  });

  it('le roster est stocké sous son format, sans suffixe numérique', () => {
    rosterAdd(entry('h1'));
    expect(JSON.parse(localStorage.getItem('wfrp4.roster')!)).toEqual({ version: FORMAT_ROSTER, heros: [entry('h1')] });
    expect(takeRosterNotice()).toBe(false);
  });

  it('roster d’un autre format, ou illisible : RETIRÉ, témoin posé (à usage unique)', () => {
    for (const contenu of [JSON.stringify({ version: 'autre-format', heros: [entry('h1')] }), JSON.stringify([entry('h1')]), '{pas du json']) {
      localStorage.setItem('wfrp4.roster', contenu);
      expect(rosterLoad()).toEqual([]);
      expect(localStorage.getItem('wfrp4.roster')).toBeNull();
      expect(takeRosterNotice()).toBe(true);
      expect(takeRosterNotice()).toBe(false);
    }
  });

  it('le brouillon du créateur voyage tel quel sous le format du roster', () => {
    const draft = { speciesId: 'humains-reiklander', careerId: 'sorcier', label: 'Brouillon', pettySpells: ['putrefaction'] } as unknown as RosterEntry['draft'];
    rosterAdd({ ...entry('h1'), draft });
    expect(rosterLoad()[0].draft).toEqual(draft);
  });

  it('sans localStorage (environnement sans stockage) : load → [], add/remove ne jettent pas', () => {
    delete (globalThis as { localStorage?: Storage }).localStorage;
    expect(rosterLoad()).toEqual([]);
    expect(() => rosterAdd(entry('h1'))).not.toThrow();
    expect(() => rosterRemove('h1')).not.toThrow();
  });

  it('rosterUpdate : met à jour le héros présent (bio propagée), sans doublon', () => {
    rosterAdd(entry('h1'));
    const edited = { id: 'h1', name: 'Héros', motivation: 'Foi', details: { ambitionShort: 'Survivre', ambitionLong: 'Régner' } } as unknown as Combatant;
    rosterUpdate(edited);
    const list = rosterLoad();
    expect(list).toHaveLength(1);
    expect(list[0].hero.motivation).toBe('Foi');
    expect(list[0].hero.details?.ambitionShort).toBe('Survivre');
    expect(list[0].hero.details?.ambitionLong).toBe('Régner');
  });

  it('rosterUpdate : N’AJOUTE PAS un héros absent du roster (prétiré édité)', () => {
    rosterAdd(entry('h1'));
    rosterUpdate(hero('absent'));
    const list = rosterLoad();
    expect(list).toHaveLength(1);
    expect(list[0].hero.id).toBe('h1');
  });
});

describe('roster — export / import (portabilité, sous `FORMAT_EXPORT_HEROS`)', () => {
  it('round-trip valide → entry restituée', () => {
    const back = rosterImport(rosterExport(entry('h1')));
    expect(back.entry).toBeDefined();
    expect(back.entry!.hero.id).toBe('h1');
    expect(back.entry!.wealth).toEqual({ gold: 1, silver: 2, brass: 3 });
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

  it('kind différent → message explicite', () => {
    const res = rosterImport(JSON.stringify({ kind: 'autre-chose', version: FORMAT_EXPORT_HEROS, hero: { id: 'h5' } }));
    expect(res.entry).toBeUndefined();
    expect(res.error).toBeTruthy();
  });

  it('erreur (JSON invalide ou hero.id manquant/non-chaîne) → message explicite, jamais null muet', () => {
    expect(rosterImport('pas du json').error).toBeTruthy();
    expect(rosterImport('{}').error).toBeTruthy();
    expect(rosterImport(JSON.stringify({ kind: 'wfrp4-hero', version: FORMAT_EXPORT_HEROS, hero: {}, wealth: {} })).error).toBeTruthy();
    expect(rosterImport(JSON.stringify({ kind: 'wfrp4-hero', version: FORMAT_EXPORT_HEROS, hero: { id: 42 }, wealth: {} })).error).toBeTruthy();
  });
});
