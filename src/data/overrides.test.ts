/**
 * Le seam `overrides` doit muter les datasets EN PLACE : un consommateur qui a importé le tableau de
 * la façade voit les changements sans réimport (identité de référence préservée). `resetData`
 * restaure le seed d'origine.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { etats } from './index';
import { setDataset, resetData, datasetArray, deDeLaTable, setDeDeTable } from './overrides';
import { versionDuDataset } from './versionDataset';
import { critiqueDie } from './criticals';
import { encounterDie } from '../engine/travelTables';

const fakeEtat = { label: 'TEST', desc: 'x', source: { book: 'X', page: 1 } } as never;

describe('overrides — mutation en place de la façade', () => {
  afterEach(() => resetData());

  it('setDataset mute le MÊME tableau (les consommateurs voient le changement)', () => {
    const original = etats.length;
    expect(original).toBeGreaterThan(1);
    setDataset('etats', [fakeEtat]);
    expect(datasetArray('etats')).toBe(etats); // identité préservée (binding jamais réassigné)
    expect(etats.length).toBe(1);
    expect(etats[0].label).toBe('TEST');
  });

  it('resetData restaure le seed d’origine', () => {
    const n0 = etats.length;
    setDataset('etats', []);
    expect(etats.length).toBe(0);
    resetData();
    expect(etats.length).toBe(n0);
    expect(datasetArray('etats')).toBe(etats);
  });
});

describe('overrides — dé de tirage porté par un ancêtre de la table (#1667)', () => {
  afterEach(() => resetData());

  it('setDeDeTable écrit le dé du document de la table, versionne son fichier, et le lecteur le suit', () => {
    expect(deDeLaTable('criticalsCorps')).toBe('d100');
    const v0 = versionDuDataset('criticalsTete');
    setDeDeTable('criticalsCorps', '2d10');
    expect(critiqueDie('ldb', 'corps')).toEqual({ n: 2, sides: 10 });
    expect(critiqueDie('ldb', 'tete'), 'les autres documents gardent leur dé').toEqual({ n: 1, sides: 100 });
    expect(versionDuDataset('criticalsTete'), 'toutes les clés du fichier sont versionnées').toBeGreaterThan(v0);
  });

  it('un dé partagé par la racine l’est par toutes ses tables', () => {
    setDeDeTable('rencontresFortuites', 'd6');
    expect(deDeLaTable('rencontresPositives')).toBe('d6');
    expect(encounterDie()).toEqual({ n: 1, sides: 6 });
  });

  it('refuse une expression illisible et un dé d’ENTRÉE, sans rien écrire', () => {
    expect(() => setDeDeTable('criticalsCorps', 'deux dés')).toThrow('invalide');
    expect(deDeLaTable('criticalsCorps')).toBe('d100');
    expect(deDeLaTable('mutationTables'), 'le dé d’une Table de Corruption est un champ de son entrée').toBeUndefined();
    expect(() => setDeDeTable('mutationTables', 'd10')).toThrow('setDataset');
  });

  it('resetData restaure le dé imprimé', () => {
    setDeDeTable('seaBoardEvents', 'd10');
    resetData();
    expect(deDeLaTable('seaBoardEvents')).toBe('d100');
  });
});
