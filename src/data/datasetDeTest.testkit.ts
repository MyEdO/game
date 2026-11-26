/**
 * UN DATASET DE FIXTURE pour chaque test d'un fichier : le contenu que `suivant` tire du dataset livré, posé par le seam
 * d'écriture (`setDataset`, #1692) avant chaque test, et le dataset livré restauré après.
 */
import { afterEach, beforeEach } from 'vitest';
import { datasetArray, setDataset, type DatasetKey } from './overrides';
import type { EntreeVivante } from './schemas/datasets';

type Entrees<K extends DatasetKey> = ReturnType<typeof datasetArray<K>>;

/** Pose `suivant(livré)` dans le dataset `cle` pour chaque test du fichier. */
export function poserLeDataset<K extends DatasetKey>(cle: K, suivant: (livre: Entrees<K>) => readonly EntreeVivante<Entrees<K>[number]>[]): void {
  // `as never` : TypeScript ne corrèle pas `datasetArray(cle)` et `setDataset(cle, …)` sur une clé générique.
  let avant: Entrees<K>;
  beforeEach(() => {
    avant = datasetArray(cle).slice() as Entrees<K>;
    setDataset(cle, suivant(avant) as never);
  });
  afterEach(() => { setDataset(cle, avant as never); });
}
