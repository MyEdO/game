/**
 * Le seam `overrides` doit muter les datasets EN PLACE : un consommateur qui a importé le tableau de
 * la façade voit les changements sans réimport (identité de référence préservée). `resetData`
 * restaure le seed d'origine.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { etats } from './index';
import { setDataset, resetData, datasetArray, ancetreDuDe, champDEnTete, deDeLaTable, setEnTete } from './overrides';
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

describe('overrides — en-tête d’une catégorie de niche, porte `setEnTete` (#1667)', () => {
  afterEach(() => resetData());

  it('écrit le dé du document de la table, versionne son fichier, et le lecteur le suit', () => {
    expect(ancetreDuDe('criticalsCorps')).toBe('[criticals-ldb-corps]');
    expect(deDeLaTable('criticalsCorps')).toBe('d100');
    const v0 = versionDuDataset('criticalsTete');
    setEnTete('criticalsCorps', [{ ancetre: '[criticals-ldb-corps]', champ: 'die', valeur: '2d10' }]);
    expect(critiqueDie('ldb', 'corps')).toEqual({ n: 2, sides: 10 });
    expect(critiqueDie('ldb', 'tete'), 'les autres documents gardent leur dé').toEqual({ n: 1, sides: 100 });
    expect(versionDuDataset('criticalsTete'), 'toutes les clés du fichier sont versionnées').toBeGreaterThan(v0);
  });

  it('une racine partagée par trois tables est UN nœud : écrite par l’une, lue par toutes, les trois versionnées', () => {
    const cles = ['rencontresPositives', 'rencontresFortuites', 'rencontresDangereuses'] as const;
    expect(cles.map(ancetreDuDe)).toEqual(['', '', '']);
    const v0 = cles.map(versionDuDataset);
    setEnTete('rencontresFortuites', [{ ancetre: '', champ: 'die', valeur: 'd6' }]);
    expect(cles.map(deDeLaTable)).toEqual(['d6', 'd6', 'd6']);
    expect(encounterDie()).toEqual({ n: 1, sides: 6 });
    cles.forEach((c, i) => expect(versionDuDataset(c), c).toBeGreaterThan(v0[i]));
  });

  it('G1 : le pas `champ` d’un chemin de collection, sœur comprise, est hors de l’en-tête', () => {
    expect(() => setEnTete('seaManannFactors', [{ ancetre: '', champ: 'boardEvents', valeur: {} }])).toThrow(/hors de l.en-tête/);
    expect(() => setEnTete('seaManannFactors', [{ ancetre: 'manann', champ: 'factors', valeur: [] }])).toThrow(/hors de l.en-tête/);
  });

  it('G2 : la clé `par` d’un pas `[clé]` est hors de l’en-tête', () => {
    expect(() => setEnTete('criticalsCorps', [{ ancetre: '[criticals-ldb-corps]', champ: 'id', valeur: 'autre' }])).toThrow(/hors de l.en-tête/);
  });

  it('un nœud tableau n’a pas d’en-tête ; un ancêtre qui n’est pas un préfixe de la collection est refusé', () => {
    expect(() => setEnTete('criticalsCorps', [{ ancetre: '', champ: 'die', valeur: 'd6' }])).toThrow('nœud tableau');
    expect(() => setEnTete('criticalsCorps', [{ ancetre: '[criticals-ldb-tete]', champ: 'die', valeur: 'd6' }])).toThrow(/n.est pas un ancêtre/);
    expect(() => setEnTete('mutationTables', [{ ancetre: '', champ: 'die', valeur: 'd10' }])).toThrow('setDataset');
    expect(deDeLaTable('mutationTables'), 'le dé d’une Table de Corruption est un champ de son entrée').toBeUndefined();
  });

  it('une écriture refusée n’écrit rien, même celles qui la précèdent dans le lot', () => {
    expect(() => setEnTete('seaBoardEvents', [
      { ancetre: 'boardEvents', champ: 'die', valeur: 'd10' },
      { ancetre: '', champ: 'manann', valeur: {} },
    ])).toThrow(/hors de l.en-tête/);
    expect(deDeLaTable('seaBoardEvents')).toBe('d100');
  });

  it('resetData restaure l’en-tête : un champ modifié reprend sa graine, un champ ajouté est retiré', () => {
    setEnTete('seaBoardEvents', [
      { ancetre: 'boardEvents', champ: 'die', valeur: 'd10' },
      { ancetre: '', champ: 'ajout', valeur: 'x' },
    ]);
    expect(champDEnTete('seaBoardEvents', '', 'ajout')).toBe('x');
    resetData();
    expect(deDeLaTable('seaBoardEvents')).toBe('d100');
    expect(champDEnTete('seaBoardEvents', '', 'ajout')).toBeUndefined();
  });
});
