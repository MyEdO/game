/**
 * LA PERSISTANCE DES PRÉFÉRENCES sur le `Stockage` d'un hôte (#3041) : une valeur persistée se relit contre la forme
 * de son entrée de la table du noyau (#2404), une valeur non conforme est ignorée ; un réglage écrit la valeur et ne
 * persiste que ce qui s'écarte du défaut. Un stockage absent ou qui lève ne casse aucun geste.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { chargerLesPreferences, reglerUnePreference } from './preferences';
import { cadence, setCadence, CADENCE_DEFAULT } from '../engine/cadence';
import { desFixes, setDesFixes, DES_FIXES_DEFAULT } from '../engine/fixedDie';
import { stockageEnMemoire, stockageQuiLeve } from '../lib/stockage.testkit';
import { VOLUME_DEFAUT, reglerLeVolume, volumeDuCanal } from '../noyau/volumes';

const CLE = 'wfrp4.prefs';
const CADENCE_HORS_DEFAUT = 'auto';

const avec = (valeur: unknown) => {
  const s = stockageEnMemoire();
  s.setItem(CLE, JSON.stringify(valeur));
  return s;
};

beforeEach(() => {
  setCadence(CADENCE_DEFAULT);
  setDesFixes(DES_FIXES_DEFAULT);
  reglerLeVolume('musique', VOLUME_DEFAUT);
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

  it('un nombre (`param`) est chargé dans ses bornes ; hors bornes ou non numérique, il est ignoré', () => {
    chargerLesPreferences(avec({ 'volume-musique': 0.25 }));
    expect(volumeDuCanal('musique')).toBe(0.25);
    reglerLeVolume('musique', VOLUME_DEFAUT);
    for (const v of [1.5, -0.1, '0.5']) {
      chargerLesPreferences(avec({ 'volume-musique': v }));
      expect(volumeDuCanal('musique'), JSON.stringify(v)).toBe(VOLUME_DEFAUT);
    }
  });

  it('un magasin qui n’est pas un dictionnaire, ou un stockage absent ou qui lève, est ignoré', () => {
    for (const s of [avec([CADENCE_HORS_DEFAUT]), null, stockageQuiLeve]) {
      chargerLesPreferences(s);
      expect(cadence()).toBe(CADENCE_DEFAULT);
    }
  });
});

describe('le réglage d’une préférence', () => {
  it('écrit la valeur et ne persiste que l’écart au défaut ; revenue au défaut, la clé sort du stockage', () => {
    const s = stockageEnMemoire();
    expect(reglerUnePreference(s, 'combat-cadence', CADENCE_HORS_DEFAUT)?.id).toBe('combat-cadence');
    expect(cadence()).toBe(CADENCE_HORS_DEFAUT);
    expect(JSON.parse(s.contenu.get(CLE)!)).toEqual({ 'combat-cadence': CADENCE_HORS_DEFAUT });
    reglerUnePreference(s, 'combat-cadence', CADENCE_DEFAULT);
    expect(s.contenu.has(CLE)).toBe(false);
  });

  it('un id inconnu : rien n’est écrit, aucune entrée rendue', () => {
    const s = stockageEnMemoire();
    expect(reglerUnePreference(s, 'preference-hors-table', true)).toBeUndefined();
    expect(s.contenu.size).toBe(0);
  });

  it('une valeur que la forme de l’entrée refuse (hors bornes, hors options, d’un autre type) : rien n’est écrit', () => {
    const s = stockageEnMemoire();
    for (const [id, valeur] of [['volume-musique', 2], ['volume-musique', '0.5'], ['combat-cadence', 'eclair'], ['des-fixes', 1], ['des-fixes', undefined]] as const) {
      expect(reglerUnePreference(s, id, valeur), `${id} = ${String(valeur)}`).toBeUndefined();
    }
    expect([volumeDuCanal('musique'), cadence(), desFixes()]).toEqual([VOLUME_DEFAUT, CADENCE_DEFAULT, DES_FIXES_DEFAULT]);
    expect(s.contenu.size).toBe(0);
  });

  it('un stockage qui lève : la valeur reste effective pour la session', () => {
    reglerUnePreference(stockageQuiLeve, 'des-fixes', true);
    expect(desFixes()).toBe(true);
  });
});
