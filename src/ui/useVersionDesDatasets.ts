import { useSyncExternalStore } from 'react';
import { abonnerAuxDatasets, versionDesDatasets } from '../data/versionDataset';

/** Version des catalogues (`versionDesDatasets`), témoin `abonnerAuxDatasets` : le composant qui
 *  l'appelle re-rend après chaque écriture au seam (édition `CodexEdit`, règle optionnelle). Une
 *  surface qui DESSINE depuis un catalogue l'appelle et la met dans les dépendances de ses mémos. */
export function useVersionDesDatasets(): number {
  return useSyncExternalStore(abonnerAuxDatasets, versionDesDatasets, versionDesDatasets);
}
