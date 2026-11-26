/**
 * FOSSILE 1 du catalogue en valeur (#5069, `docs/plans/2026-11-25-composition-d-un-jeu.md` § 5.1, point 5) : le
 * catalogue composé sur la base vivante du processus et sur ses règles maison, recomposé à chaque écriture au seam.
 */
import { BIBLIOTHEQUE } from './_racines-vivantes.generated';
import { versionDesDatasets } from './versionDataset';
import { composer, type Catalogue } from './schemas/catalogue/catalogue';
import { ruleOverrides } from '../engine/policy';
import { memoByDeps } from '../lib/memoParIdentite';
import { poserLeCatalogueHorsFenetre } from './schemas/grammaire/ref';

const retenu = memoByDeps<Catalogue>();

/** Le catalogue de la base vivante (`BIBLIOTHEQUE`, les objets que mute `overrides.ts`) sous les règles maison
 *  (`ruleOverrides`), mémoïsé par `versionDesDatasets`. */
export const catalogueDuProcessus = (): Catalogue =>
  retenu([versionDesDatasets()], () => composer(BIBLIOTHEQUE, { regles: ruleOverrides() }));

poserLeCatalogueHorsFenetre(catalogueDuProcessus);
