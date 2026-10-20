/**
 * Les tables du jeu se rassemblent une fois, mais une table tirable dérivée d'une donnée éditable se
 * relit à chaque tirage (#1692, #2889 D10) : le conteneur est figé, jamais la donnée qu'il interroge.
 */
import { describe, it, expect, onTestFinished } from 'vitest';
import { peripeties } from '../data';
import { DATASET_KEYS, OBJECT_DATASET_KEYS, datasetArray, datasetObject, setDataset, setObjectDataset } from '../data/overrides';
import { makeRNG } from '../engine/dice';
import { rollTableStep } from './cascade';
import { tablesDuJeu } from './tablesDuJeu';
import { tablesPosees } from './tablesPosees';

/** Réécrit chaque dataset à l'identique par son seam d'édition : le contenu ne change pas, la version
 *  si. Rend les clés dont la réécriture a fait relire `famille`. */
function datasetsRelusPar(famille: () => ReadonlyMap<string, unknown>): string[] {
  const relus: string[] = [];
  for (const cle of DATASET_KEYS) {
    const avant = famille();
    const copie = [...datasetArray(cle)];
    setDataset(cle, copie as never);
    if (famille() !== avant) relus.push(cle);
  }
  for (const cle of OBJECT_DATASET_KEYS) {
    const avant = famille();
    setObjectDataset(cle, datasetObject(cle));
    if (famille() !== avant) relus.push(cle);
  }
  return relus;
}

describe('tablesDuJeu — une donnée tirable éditée se relit au tirage suivant', () => {
  it('chaque famille de tables tirables relit au moins un dataset après son édition', () => {
    const familles = tablesDuJeu().famillesTirables;
    expect(familles.length, 'des familles sont déclarées').toBeGreaterThan(0);
    const figees = familles
      .map((famille, rang) => ({ tables: [...famille().keys()].slice(0, 2).join(', '), relus: datasetsRelusPar(famille), rang }))
      .filter((f) => f.relus.length === 0)
      .map((f) => `famille n°${f.rang} (${f.tables})`);
    expect(figees, 'une famille qui ne relit aucun dataset sert la donnée d’avant l’édition').toEqual([]);
  });

  it('fourchettes des péripéties éditées après le rassemblement : le même dé tire la ligne éditée, puis la livrée une fois restaurée', () => {
    expect(tablesPosees(), 'les tables posées sont celles du jeu, déjà rassemblées').toBe(tablesDuJeu());
    const livrees = [...peripeties];
    onTestFinished(() => setDataset('peripeties', livrees));
    const tirer = () => rollTableStep({ tableId: 'land-peril-table' }, makeRNG(7));
    const avant = tirer();
    expect(avant.id, 'le tirage de référence lit la donnée livrée').toBe(livrees.find((p) => p.roll === avant.roll)!.id);

    // L'édition du Codex RENVERSE les fourchettes du d10 : la face tirée désigne une autre péripétie.
    setDataset('peripeties', livrees.map((p) => ({ ...p, roll: 11 - p.roll })).reverse());
    const edite = tirer();
    expect(edite.roll, 'même graine, même dé').toBe(avant.roll);
    expect(edite.id, 'la ligne tirée est celle que la donnée éditée met sur cette face').toBe(livrees.find((p) => p.roll === 11 - avant.roll)!.id);

    setDataset('peripeties', livrees);
    expect(tirer(), 'restaurée, la donnée livrée revient au même tirage').toEqual(avant);
  });
});

describe('tablesDuJeu — les tables assemblées sont gelées', () => {
  it('ni le conteneur ni aucune table ne se mute en place', () => {
    const tables = tablesDuJeu();
    expect(() => { (tables as { appliers: unknown }).appliers = {}; }, 'le conteneur').toThrow(TypeError);
    const mutables = Object.entries(tables)
      .filter(([, table]) => typeof table === 'object' && table !== null)
      .filter(([cle, table]) => {
        try {
          if (Array.isArray(table)) table.push(undefined);
          else (table as Record<string, unknown>)['sonde-mutation-en-place'] = undefined;
          return true;
        } catch (e) {
          expect(e, cle).toBeInstanceOf(TypeError);
          return false;
        }
      })
      .map(([cle]) => cle);
    expect(mutables, 'une table mutée en place changerait le jeu de tous les tests suivants').toEqual([]);
  });
});
