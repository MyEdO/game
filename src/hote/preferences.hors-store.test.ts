/**
 * LA PERSISTANCE DES PRÉFÉRENCES sur le `Stockage` d'un hôte (#3041) : une valeur persistée se relit contre la forme
 * de son entrée de la table du noyau (#2404), une valeur non conforme est ignorée ; un réglage écrit la valeur et ne
 * persiste que ce qui s'écarte du défaut. Un stockage absent ou qui lève ne casse aucun geste.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { chargerLesPreferences, reglerUnePreference } from './preferences';
import { cadence, setCadence, CADENCE_DEFAULT } from '../engine/cadence';
import { desFixes, setDesFixes, DES_FIXES_DEFAULT } from '../engine/fixedDie';
import type { Stockage } from '../lib/stockage';

const CLE = 'wfrp4.prefs';
const CADENCE_HORS_DEFAUT = 'auto';

function enMemoire(): Stockage & { contenu: Map<string, string> } {
  const contenu = new Map<string, string>();
  return {
    contenu,
    getItem: (k) => contenu.get(k) ?? null,
    setItem: (k, v) => void contenu.set(k, v),
    removeItem: (k) => void contenu.delete(k),
  };
}

const quiLeve: Stockage = {
  getItem: () => { throw new Error('refusé'); },
  setItem: () => { throw new Error('refusé'); },
  removeItem: () => { throw new Error('refusé'); },
};

const avec = (valeur: unknown) => {
  const s = enMemoire();
  s.setItem(CLE, JSON.stringify(valeur));
  return s;
};

beforeEach(() => {
  setCadence(CADENCE_DEFAULT);
  setDesFixes(DES_FIXES_DEFAULT);
});

describe('le chargement des préférences d’un stockage', () => {
  it('une valeur conforme à la forme de son entrée est chargée', () => {
    chargerLesPreferences(avec({ 'combat-cadence': CADENCE_HORS_DEFAUT, 'des-fixes': true }));
    expect([cadence(), desFixes()]).toEqual([CADENCE_HORS_DEFAUT, true]);
  });

  it('une valeur non conforme (mode hors options, flag non booléen) est ignorée : le défaut s’applique', () => {
    chargerLesPreferences(avec({ 'combat-cadence': 'turbo', 'des-fixes': 'oui' }));
    expect([cadence(), desFixes()]).toEqual([CADENCE_DEFAULT, DES_FIXES_DEFAULT]);
  });

  it('un magasin qui n’est pas un dictionnaire, ou un stockage absent ou qui lève, est ignoré', () => {
    for (const s of [avec([CADENCE_HORS_DEFAUT]), null, quiLeve]) {
      chargerLesPreferences(s);
      expect(cadence()).toBe(CADENCE_DEFAULT);
    }
  });
});

describe('le réglage d’une préférence', () => {
  it('écrit la valeur et ne persiste que l’écart au défaut ; revenue au défaut, la clé sort du stockage', () => {
    const s = enMemoire();
    expect(reglerUnePreference(s, 'combat-cadence', CADENCE_HORS_DEFAUT)?.id).toBe('combat-cadence');
    expect(cadence()).toBe(CADENCE_HORS_DEFAUT);
    expect(JSON.parse(s.contenu.get(CLE)!)).toEqual({ 'combat-cadence': CADENCE_HORS_DEFAUT });
    reglerUnePreference(s, 'combat-cadence', CADENCE_DEFAULT);
    expect(s.contenu.has(CLE)).toBe(false);
  });

  it('un id inconnu : rien n’est écrit, aucune entrée rendue', () => {
    const s = enMemoire();
    expect(reglerUnePreference(s, 'preference-hors-table', true)).toBeUndefined();
    expect(s.contenu.size).toBe(0);
  });

  it('un stockage qui lève : la valeur reste effective pour la session', () => {
    reglerUnePreference(quiLeve, 'des-fixes', true);
    expect(desFixes()).toBe(true);
  });
});
