import type { z } from 'zod';
import { DATASET_KEYS, type DatasetKey } from '../../data/overrides';
import { CATEGORY_DATASET_DERIVE, DATASET_FICHIER_DERIVE, DATASET_SUITE_DERIVE } from '../../data/schemas/exposition-derivee';
import { noeudObjet, schemaForFile } from '../../data/schemas/validate';
import { atteindre, noeudsDeLElement } from '../../data/schemas/grammaire/collection-cle';
import { defDe, enfantsDe, ouverts } from '../../data/schemas/grammaire/descente';

/** Dataset-LISTE éditable dont l'élément déclare `capabilities` : sa catégorie Codex de route, et le
 *  nœud OBJET de ses capacités. */
export interface PorteurDeCapacites {
  readonly categorie: string;
  readonly dataset: DatasetKey;
  readonly schema: z.ZodObject;
}

const capacitesDuDataset = (dataset: DatasetKey): z.ZodObject | undefined => {
  const collection = atteindre(schemaForFile(DATASET_FICHIER_DERIVE[dataset]), undefined, DATASET_SUITE_DERIVE[dataset]);
  if (!collection) return undefined;
  const champs = ouverts(noeudsDeLElement(collection.noeuds, collection.marque))
    .filter((n) => defDe(n)?.type === 'object')
    .flatMap((n) => enfantsDe(n).filter((e) => e.cle === 'capabilities').map((e) => noeudObjet(e.noeud) as z.ZodObject));
  return champs[0];
};

/** Les porteurs de capacités, DÉRIVÉS des routes d'édition (`CATEGORY_DATASET_DERIVE`) et des schémas. */
export const PORTEURS_DE_CAPACITES: readonly PorteurDeCapacites[] = Object.entries(CATEGORY_DATASET_DERIVE)
  .flatMap(([categorie, ds]) => {
    const dataset = DATASET_KEYS.find((k) => k === ds);
    if (!dataset) return [];
    const schema = capacitesDuDataset(dataset);
    return schema ? [{ categorie, dataset, schema }] : [];
  });

/** Nœud OBJET des capacités du dataset `dataset`, lu sur sa route d'édition. */
export const capacitesDe = (dataset: DatasetKey): z.ZodObject => {
  const p = PORTEURS_DE_CAPACITES.find((x) => x.dataset === dataset);
  if (!p) throw new Error(`capacitesDe : « ${dataset} » ne porte pas de capacités.`);
  return p.schema;
};
