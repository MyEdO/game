/** Type d'une entrée des registres de schémas GÉNÉRÉS — UN document authoré, d'une des DEUX racines :
 *  `SCHEMA_DEFS` (`src/data`, catalogues de jeu) et `SCHEMA_DEFS_SCENES` (`src/scenes`, projets de
 *  campagne), émis par `scripts/gen-registry.mjs` et réunis par `DEFS_DE_DOCUMENT` (`validate.ts`). */
import type { z } from 'zod';
import type { Exposition, FamilleDocument } from './grammaire/document';
import type { MetaChamp } from './grammaire/meta';

/** Racine d'un document authoré — les DEUX sont peuplées (#1466) : `src/data` (catalogues de jeu,
 *  registre `SCHEMA_DEFS`) et `src/scenes` (projets de campagne, registre `SCHEMA_DEFS_SCENES`). */
export type RacineDocument = 'src/data' | 'src/scenes';

export interface SchemaDef {
  /** Désignation du document sous sa racine (`<root>/<file>`), telle qu'exportée par son module de
   *  def. La graphie SUIT LA RACINE : BASENAME pour `root: 'src/data'` (catalogues à plat,
   *  `characteristics.json`), CHEMIN RELATIF à la racine pour `root: 'src/scenes'` (documents en
   *  sous-dossiers, `arene/arene-projet.json`). C'est la clé de `validateDataset`/`schemaForFile`. */
  file: string;
  /** Racine du dataset — émise par `scripts/gen-registry.mjs`, jamais déclarée par le def. */
  root: RacineDocument;
  /** Schéma zod STRICT du dataset (racine = le tableau/objet exact du JSON). */
  schema: z.ZodType;
  /**
   * Famille du document, MESURÉE sur la structure réelle du dataset et déclarée par son def : elle
   * dit si le document porte des ids de premier niveau (`entite`/`record`) ou n'en porte aucun par
   * construction (`config`). `document()` marque la racine d'un document `entite`/`record` ESPACE DE NOMS
   * (`grammaire/collection-cle.ts`), que la phase 2 de `npm run gen` indexe (`IDS_PAR_ESPACE`).
   */
  famille: FamilleDocument;
  /**
   * Méta d'ÉDITION par champ de premier niveau (libellé FR, aide, widget, rang) — émise par
   * `scripts/gen-registry.mjs` quand le module de def exporte `meta`, ce que fait tout def passé par
   * `document()`. OPTIONNELLE — portée par les seuls defs qui exportent une méta ; un def sans méta
   * laisse l'atelier sur la clé technique. Adoption par def : lot L1b #1467.
   */
  meta?: Readonly<Record<string, MetaChamp>>;
  /**
   * EXPOSITION du document — DÉRIVÉE du handle `document()` (`doc.exposition`), jamais redéclarée :
   * où il se lit (`codex`) et où il s'édite (`edit`). Portée par les DEUX racines depuis #1552 : un
   * document de `src/scenes` déclare son exemption Codex et `edit: none` (il s'édite dans l'éditeur de
   * scènes) ; `deriveExposition` (`exposition-derivee.ts`) ne dérive de routes que depuis `SCHEMA_DEFS`.
   */
  exposition?: Exposition;
}
