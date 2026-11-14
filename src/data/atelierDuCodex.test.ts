/**
 * Contrat de la transaction d'enregistrement d'une entrée du Codex (`enregistrerEntree`, #3059) :
 * l'entrée valide est posée et rendue sérialisée ; une entrée refusée laisse le dataset tel qu'avant.
 * Le dataset se pose et se restaure par son seam (`setDataset`).
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { enregistrerEntree } from './atelierDuCodex';
import { ancetreDuDe, champDEnTete, datasetArray, deDeLaTable, entreesDuDataset, resetData, setDataset, type DatasetKey } from './overrides';
import { CATEGORY_DATASET_DERIVE } from './schemas/exposition-derivee';
import { effectTableDie, findEffectTableById } from './effectTables';
import { findTableEntry } from '../engine/tables';
import { miscastDie, miscastRowAt } from '../engine/miscast';
import { deDuVoyageRapide, resolveFastVoyage } from '../engine/seaVoyage';
import { makeRNG } from '../engine/dice';
import { deSelonLaPlage } from '../engine/dice.testkit';
import { scatter } from '../engine/scatter';
import { tirerLaReactionAuStatut, tirerLeCapricieux } from '../engine/social';

type Entree = Record<string, unknown>;
const traits = () => datasetArray('traits');
let avant = traits().slice();
beforeEach(() => { avant = traits().slice(); });
afterEach(() => { setDataset('traits', avant); });

describe('enregistrerEntree — transaction d’une entrée éditée', () => {
  it('une entrée valide est posée à sa position et rendue en forme disque', () => {
    const editee = { ...avant[0], label: 'Libellé édité' };
    const issue = enregistrerEntree('traits', editee, 0);
    expect(issue.ok).toBe(true);
    if (!issue.ok) return;
    expect(issue.fichier).toBe('traits.json');
    expect(issue.texte).toContain('"label": "Libellé édité"');
    expect(traits()[0].label).toBe('Libellé édité');
    expect(traits()).toHaveLength(avant.length);
  });

  it('une entrée NEUVE (index −1) est ajoutée en fin de dataset', () => {
    const neuve = { ...avant[0], id: 'trait-neuf-du-contrat', label: 'Trait neuf' };
    expect(enregistrerEntree('traits', neuve, -1).ok).toBe(true);
    expect(traits()[traits().length - 1].id).toBe('trait-neuf-du-contrat');
    expect(traits()).toHaveLength(avant.length + 1);
  });

  it('une racine que son schéma refuse est REPRISE : le dataset revient à l’état d’avant', () => {
    const issue = enregistrerEntree('traits', { ...avant[0], label: 42 }, 0);
    expect(issue.ok).toBe(false);
    if (issue.ok) return;
    expect(issue.erreurs.length).toBeGreaterThan(0);
    expect(traits()).toEqual(avant);
    expect(traits()[0]).toBe(avant[0]);
  });

  it('une collision d’id est refusée sans rien poser', () => {
    const issue = enregistrerEntree('traits', { ...avant[0], id: avant[1].id }, 0);
    expect(issue).toEqual({ ok: false, erreurs: [`id « ${String(avant[1].id)} » déjà pris par une autre entrée`] });
    expect(traits()[0]).toBe(avant[0]);
  });

  it('une réf d’op requise manquante est refusée sans rien poser', () => {
    const issue = enregistrerEntree('traits', { ...avant[0], passive: [{ op: 'grantTalent', talent: {} }] }, 0);
    expect(issue).toEqual({ ok: false, erreurs: ['Accorder un Talent : Talent à choisir'] });
    expect(traits()[0]).toBe(avant[0]);
  });
});

describe('enregistrerEntree — une référence morte d’un champ typé est refusée au parse, son catalogue nommé', () => {
  afterEach(() => resetData());
  /** L'issue d'une entrée `modifiee` de `categorie` à la position 0 ; le dataset reste celui d'avant. */
  const refus = (categorie: string, modifiee: (e: Entree) => Entree): string => {
    const ds = CATEGORY_DATASET_DERIVE[categorie] as DatasetKey;
    const premiere = entreesDuDataset(ds)[0];
    const issue = enregistrerEntree(categorie, modifiee(premiere), 0);
    expect(issue.ok, categorie).toBe(false);
    expect(entreesDuDataset(ds)[0], categorie).toBe(premiere);
    return issue.ok ? '' : issue.erreurs.join('\n');
  };

  it('un Trait inconnu d’une créature', () => {
    expect(refus('creatures', (e) => ({ ...e, traits: [{ id: 'trait-fantome' }] }))).toMatch(/« trait-fantome » est absent du catalogue des traits/);
  });

  it('un LIBELLÉ écrit à la place de l’id d’une séquelle de Critique (#173)', () => {
    expect(refus('criticalsTete', (e) => ({ ...e, traumas: ['Fracture'] }))).toMatch(/« Fracture » est absent du catalogue des séquelles/);
  });

  it('une dotation de POSSESSION `{ id, type }` d’un véhicule inconnu', () => {
    const marchand = datasetArray('careerLevels').findIndex((e) => e.id === 'marchand-1');
    const entree = datasetArray('careerLevels')[marchand];
    const trappings = entree.trappings.map((t) => ('type' in t && t.type === 'vehicle' ? { ...t, id: 'vehicule-fantome' } : t));
    const issue = enregistrerEntree('careerLevels', { ...entree, trappings }, marchand);
    expect(issue.ok).toBe(false);
    expect(issue.ok ? '' : issue.erreurs.join('\n')).toMatch(/« vehicule-fantome » est absent du catalogue des véhicules/);
  });
});

describe('enregistrerEntree — écritures d’en-tête de la table (#1667)', () => {
  afterEach(() => resetData());
  const rangees = () => datasetArray('drunkenness');
  const de = (valeur: string) => [{ ancetre: '', champ: 'die', valeur }];

  it('le dé posé s’écrit avec l’entrée, et la forme disque le porte', () => {
    const issue = enregistrerEntree('drunkenness', rangees()[0], 0, de('2d10'));
    expect(issue.ok).toBe(true);
    if (!issue.ok) return;
    expect(deDeLaTable('drunkenness')).toBe('2d10');
    expect(issue.texte).toContain('"die": "2d10"');
  });

  it('un dé illisible : la racine refusée REPREND l’en-tête', () => {
    const issue = enregistrerEntree('drunkenness', rangees()[0], 0, de('beaucoup'));
    expect(issue.ok).toBe(false);
    expect(deDeLaTable('drunkenness')).toBe('d10');
  });

  it('une racine refusée par son schéma REPREND l’entrée ET l’en-tête, champ ajouté compris', () => {
    const entree = rangees()[0];
    const issue = enregistrerEntree('drunkenness', { ...entree, label: 42 }, 0, [...de('2d10'), { ancetre: '', champ: 'ajout', valeur: 'x' }]);
    expect(issue.ok).toBe(false);
    expect(rangees()[0]).toBe(entree);
    expect(deDeLaTable('drunkenness')).toBe('d10');
    expect(champDEnTete('drunkenness', '', 'ajout')).toBeUndefined();
  });

  it('toute catégorie dont un ancêtre porte le dé refuse un dé illisible et garde le sien', () => {
    const portees = Object.entries(CATEGORY_DATASET_DERIVE).flatMap(([categorie, ds]) => {
      const ancetre = ancetreDuDe(ds as DatasetKey);
      return ancetre === undefined ? [] : [{ categorie, ds: ds as DatasetKey, ancetre }];
    });
    expect(portees.length).toBeGreaterThan(0);
    for (const { categorie, ds, ancetre } of portees) {
      const avantDe = deDeLaTable(ds);
      const issue = enregistrerEntree(categorie, entreesDuDataset(ds)[0], 0, [{ ancetre, champ: 'die', valeur: 'beaucoup' }]);
      expect(issue.ok, categorie).toBe(false);
      expect(deDeLaTable(ds), categorie).toBe(avantDe);
    }
  });
});

describe('enregistrerEntree — les tables tirées s’éditent et le lecteur suit (#1667)', () => {
  afterEach(() => resetData());

  it('table d’effets : le dé et une rangée édités changent ce que tire le lecteur', () => {
    const tables = datasetArray('effectTables');
    const index = tables.findIndex((t) => t.id === 'allure-demoniaque-nurgle');
    const table = tables[index];
    expect(findTableEntry(findEffectTableById('allure-demoniaque-nurgle').entries, 10).label).toBe(table.entries[9].label);
    const entries = table.entries.map((r, i) => (i === table.entries.length - 1 ? { ...r, max: 20, label: 'Rangée éditée' } : r));
    expect(enregistrerEntree('effectTables', { ...table, die: 'd20', entries }, index).ok).toBe(true);
    expect(effectTableDie('allure-demoniaque-nurgle').sides).toBe(20);
    expect(findTableEntry(findEffectTableById('allure-demoniaque-nurgle').entries, 15).label).toBe('Rangée éditée');
  });

  it('miscast VDM : une rangée puis le dé édités changent ce que tire le lecteur', () => {
    const rangees = datasetArray('imparfaiteMineureVdm');
    // Lecture AVANT l'édition : le lecteur mémoïsé est construit, l'édition doit l'invalider.
    expect(miscastRowAt('miscast-mineure-vdm', 1).label).toBe(rangees[0].label);
    expect(enregistrerEntree('imparfaiteMineureVdm', { ...rangees[0], label: 'Contrecoup édité' }, 0).ok).toBe(true);
    expect(miscastRowAt('miscast-mineure-vdm', 1).label).toBe('Contrecoup édité');
    expect(enregistrerEntree('imparfaiteMineureVdm', rangees[1], 1, [{ ancetre: '[miscast-mineure-vdm]', champ: 'die', valeur: '2d50' }]).ok).toBe(true);
    expect(miscastDie('miscast-mineure-vdm')).toMatchObject({ n: 2, sides: 50 });
  });

  it('Voyage rapide : une rangée puis le dé édités changent ce que tire le lecteur', () => {
    const paliers = datasetArray('seaFastVoyage');
    const parfait = paliers.findIndex((p) => p.id === 'parfait');
    // Lecture AVANT l'édition : le lecteur mémoïsé est construit, l'édition doit l'invalider.
    expect(resolveFastVoyage(20, 0, 0, makeRNG(1)).palier.label).toBe(paliers[parfait].label);
    expect(enregistrerEntree('seaFastVoyage', { ...paliers[parfait], label: 'Palier édité' }, parfait).ok).toBe(true);
    expect(resolveFastVoyage(20, 0, 0, makeRNG(1)).palier.label).toBe('Palier édité');
    expect(enregistrerEntree('seaFastVoyage', paliers[0], 0, [{ ancetre: 'fastVoyage', champ: 'die', valeur: 'd20' }]).ok).toBe(true);
    expect(deDuVoyageRapide()).toMatchObject({ n: 1, sides: 20 });
  });

  it('Dispersion : le dé édité est celui que tire le lecteur', () => {
    const rangees = datasetArray('dispersion');
    setDataset('dispersion', rangees.filter((r) => r.max <= 8));
    expect(enregistrerEntree('dispersion', rangees[0], 0, [{ ancetre: ancetreDuDe('dispersion')!, champ: 'die', valeur: 'd8' }]).ok).toBe(true);
    const plages: number[] = [];
    const de = deSelonLaPlage((_min, max) => { plages.push(max); return max; });
    // Face 8 du d8 = (+1, +1) ; 2d10 = 20 m, demi-distance 20 m → 10 tuiles.
    expect(scatter({ x: 0, y: 0 }, { x: 20, y: 20 }, de, 2)).toEqual({ x: 30, y: 30 });
    expect(plages[0]).toBe(8);
  });

  it('Capricieux et Réaction au Statut : le dé édité est celui que tire le lecteur', () => {
    const plages: number[] = [];
    const de = deSelonLaPlage((_min, max) => { plages.push(max); return max; });
    const capricieux = datasetArray('tableauCapricieux');
    setDataset('tableauCapricieux', capricieux.filter((r) => r.max <= 3));
    expect(enregistrerEntree('tableauCapricieux', capricieux[0], 0, [{ ancetre: ancetreDuDe('tableauCapricieux')!, champ: 'die', valeur: 'd3' }]).ok).toBe(true);
    expect(tirerLeCapricieux(de)).toEqual({ roll: 3, dr: -1 });
    const reaction = datasetArray('reactionAuStatut');
    setDataset('reactionAuStatut', reaction.filter((r) => r.max <= 2));
    expect(enregistrerEntree('reactionAuStatut', reaction[0], 0, [{ ancetre: ancetreDuDe('reactionAuStatut')!, champ: 'die', valeur: 'd2' }]).ok).toBe(true);
    expect(tirerLaReactionAuStatut(de)).toBe('braver-le-statut');
    expect(plages).toEqual([3, 2]);
  });
});
