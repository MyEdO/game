/**
 * Le seam `overrides` doit muter les datasets EN PLACE : un consommateur qui a importé le tableau de
 * la façade voit les changements sans réimport (identité de référence préservée). `resetData`
 * restaure le seed d'origine.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { etats, weatherPhysicalTestChars, structureCriticalsLabel } from './index';
import { setDataset, resetData, datasetArray, ancetreDuDe, champDEnTete, deDeLaTable, setEnTete, type DatasetKey } from './overrides';
import { SHIP_CRIT_SET, RIVER_CRIT_SET, findFallTable, shipCritSetIds } from './shipCriticals';
import { moraleBase } from '../engine/crewMorale';
import { manannBase } from '../engine/seaVoyage';
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

describe('overrides — tout lecteur d’un champ d’en-tête le lit à l’appel (#1667)', () => {
  afterEach(() => resetData());

  const chute = { id: 'chute-ecrite', label: 'Chute écrite', bandes: [] };
  const lecteurs: { fichier: string; cle: DatasetKey; ancetre: string; champ: string; valeur: unknown; lire: () => unknown; attendu: unknown }[] = [
    { fichier: 'crew-morale', cle: 'crewMoraleFactors', ancetre: '', champ: 'base', valeur: 40, lire: moraleBase, attendu: 40 },
    { fichier: 'sea-events', cle: 'seaManannFactors', ancetre: 'manann', champ: 'base', valeur: 7, lire: () => manannBase().score, attendu: 7 },
    { fichier: 'ship-criticals', cle: 'shipCriticalsCoque', ancetre: '', champ: 'shrapnelHit', valeur: [], lire: () => SHIP_CRIT_SET.shrapnelHit, attendu: [] },
    { fichier: 'ship-criticals', cle: 'shipCriticalsCoque', ancetre: '', champ: 'replisSansExpose', valeur: { cible: 'greement' }, lire: () => SHIP_CRIT_SET.replisSansExpose, attendu: { cible: 'greement' } },
    { fichier: 'river-criticals', cle: 'riverCriticalsCoque', ancetre: '', champ: 'replisSansExpose', valeur: { cible: 'greement' }, lire: () => RIVER_CRIT_SET.replisSansExpose, attendu: { cible: 'greement' } },
    { fichier: 'ship-criticals', cle: 'shipCriticalsCoque', ancetre: '', champ: 'tablesDeChute', valeur: [chute], lire: () => findFallTable(chute.id), attendu: chute },
    { fichier: 'weather', cle: 'weather', ancetre: '', champ: 'physicalTestChars', valeur: ['sociabilite'], lire: weatherPhysicalTestChars, attendu: ['sociabilite'] },
    { fichier: 'ship-criticals', cle: 'shipCriticalsCoque', ancetre: '', champ: 'id', valeur: 'jeu-ecrit', lire: shipCritSetIds, attendu: ['jeu-ecrit', 'river-criticals'] },
    { fichier: 'river-criticals', cle: 'riverCriticalsCoque', ancetre: '', champ: 'id', valeur: 'jeu-ecrit', lire: () => RIVER_CRIT_SET.id, attendu: 'jeu-ecrit' },
    { fichier: 'structure-criticals', cle: 'structureCriticals', ancetre: '', champ: 'label', valeur: 'Libellé écrit', lire: structureCriticalsLabel, attendu: 'Libellé écrit' },
  ];

  it.each(lecteurs)('$fichier › $ancetre $champ : la valeur écrite par `setEnTete` est lue, `resetData` rend la graine', ({ cle, ancetre, champ, valeur, lire, attendu }) => {
    const graine = structuredClone(lire());
    expect(graine, 'la graine diffère de la valeur écrite').not.toEqual(attendu);
    setEnTete(cle, [{ ancetre, champ, valeur }]);
    expect(lire()).toEqual(attendu);
    resetData();
    expect(lire()).toEqual(graine);
  });
});

describe('overrides — `setEnTete` ne garde aucune référence de l’appelant (#1667)', () => {
  afterEach(() => resetData());

  it('un même objet écrit sur deux racines : `resetData` rend à chacune SA graine', () => {
    const graines = [structuredClone(SHIP_CRIT_SET.replisSansExpose), structuredClone(RIVER_CRIT_SET.replisSansExpose)];
    const valeur = { cible: 'greement' };
    setEnTete('shipCriticalsCoque', [{ ancetre: '', champ: 'replisSansExpose', valeur }]);
    setEnTete('riverCriticalsCoque', [{ ancetre: '', champ: 'replisSansExpose', valeur }]);
    resetData();
    expect([SHIP_CRIT_SET.replisSansExpose, RIVER_CRIT_SET.replisSansExpose]).toEqual(graines);
    expect(valeur, 'la valeur de l’appelant reste la sienne').toEqual({ cible: 'greement' });
  });
});
