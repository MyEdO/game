/**
 * RACINES VIVANTES ET CLÉS DE DATASET (#1463) — trois gardes par IDENTITÉ ou par ÉGALITÉ, jamais par
 * une table recopiée :
 *  - chaque clé de `CLES_DE_DATASET` a pour binding de la couche donnée (`datasetArray`,
 *    `datasetObject`) la MÊME instance que `collectionDuDataset`, lue sur `RACINES_VIVANTES` ;
 *  - chaque espace de l'INDEX DES IDS se lit au régime vivant, par le même calcul (`lectureDeLEspace`),
 *    à la même liste dans le même ordre, sur l'image de `DATASET_FICHIER_DERIVE` (`RACINES_VIVANTES`) ;
 *    ailleurs le régime vivant rend `undefined`, et l'index généré fait foi ;
 *  - chaque suite de `niche.categories` mène à une collection marquée du JSON disque.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { collectionDuDataset, datasetArray, datasetObject, DATASET_KEYS, OBJECT_DATASET_KEYS, type DatasetKey, type ObjectDatasetKey } from './overrides';
import { CLES_DE_DATASET } from './schemas/_cles-de-dataset.generated';
import { DATASET_FICHIER_DERIVE, DATASET_SUITE_DERIVE } from './schemas/exposition-derivee';
import { IDS_PAR_ESPACE } from './schemas/_ids.generated';
import { SCHEMA_DEFS } from './schemas/_registry.generated';
import { idsVivants } from './schemas/grammaire/idsVivants';
import { collectionALaCle } from './schemas/grammaire/collection-cle';
import { lireCleDEspace } from './schemas/grammaire/cle-d-espace';

const OBJETS: ReadonlySet<string> = new Set(OBJECT_DATASET_KEYS);

describe('CLÉS DE DATASET — le binding de la couche donnée EST la collection de la racine vivante', () => {
  it('le domaine généré égale les clés du seam, 134 clés', () => {
    expect(CLES_DE_DATASET.length).toBe(134);
    expect(Object.keys(DATASET_FICHIER_DERIVE).sort()).toEqual([...CLES_DE_DATASET].sort());
    expect([...DATASET_KEYS, ...OBJECT_DATASET_KEYS].sort()).toEqual([...CLES_DE_DATASET].sort());
  });

  it('pour chaque clé, `datasetArray`/`datasetObject` === `collectionDuDataset`, par cas de route', () => {
    const parCas = { racine: 0, niche: 0, objet: 0 };
    const fautes = CLES_DE_DATASET.flatMap((cle) => {
      const suite = DATASET_SUITE_DERIVE[cle];
      parCas[suite === undefined ? 'objet' : suite === '' ? 'racine' : 'niche']++;
      const binding = OBJETS.has(cle) ? datasetObject(cle as ObjectDatasetKey) : datasetArray(cle as DatasetKey);
      return binding === collectionDuDataset(cle) ? [] : [`${cle} (${DATASET_FICHIER_DERIVE[cle]}${suite ? `#${suite}` : ''})`];
    });
    expect(fautes).toEqual([]);
    expect(parCas).toEqual({ racine: 68, niche: 54, objet: 12 });
  });
});

describe('RÉGIME VIVANT — vivant = généré sur l’image de `DATASET_FICHIER_DERIVE`, `undefined` ailleurs', () => {
  it('pour chaque clé d’`IDS_PAR_ESPACE`, le régime vivant rend la même liste, dans le même ordre, ou `undefined` hors de l’image', () => {
    const image = new Set(Object.values(DATASET_FICHIER_DERIVE));
    const cles = Object.keys(IDS_PAR_ESPACE);
    const parCas = { image: 0, horsImage: 0 };
    const fautes = cles.flatMap((cle) => {
      const vivant = idsVivants(cle);
      if (!image.has(lireCleDEspace(cle).fichier)) {
        parCas.horsImage++;
        return vivant === undefined ? [] : [`${cle} : hors de l’image, vivant`];
      }
      parCas.image++;
      return vivant && JSON.stringify([...vivant]) === JSON.stringify(IDS_PAR_ESPACE[cle]) ? [] : [`${cle} : vivant ≠ généré`];
    });
    expect(fautes).toEqual([]);
    expect(parCas.image).toBeGreaterThan(300);
    expect(parCas.horsImage).toBeGreaterThan(0);
  });
});

describe('`niche.categories` — chaque suite mène à une collection marquée du JSON disque', () => {
  it('les 54 catégories nichées', () => {
    const lues = SCHEMA_DEFS.flatMap((d) => {
      const edit = d.exposition?.edit;
      if (!edit || !('niche' in edit)) return [];
      const racine = JSON.parse(readFileSync(join(d.root, d.file), 'utf8')) as unknown;
      return Object.entries(edit.niche.categories).map(([categorie, suite]) => {
        try {
          const { marque, valeur } = collectionALaCle(d.schema, racine, suite);
          return marque && valeur !== undefined ? '' : `${categorie} → ${d.file}#${suite} : collection absente de la donnée`;
        } catch (e) {
          return `${categorie} → ${d.file}#${suite} : ${(e as Error).message}`;
        }
      });
    });
    expect(lues.length).toBe(54);
    expect(lues.filter(Boolean)).toEqual([]);
  });
});
