/**
 * Le CATALOGUE d'une suite qui juge une porte (#5070) : la base vivante, plus les entrées que la suite déclare. Une entrée
 * déclarée vit dans le catalogue sans exister dans l'index des ids ni dans la base vivante.
 */
import { BIBLIOTHEQUE } from './_racines-vivantes.generated';
import { catalogueDuProcessus } from './catalogueDuProcessus';
import { composer, type Catalogue } from './schemas/catalogue/catalogue';
import type { LivreDeTest } from './schemas/catalogue/catalogueDeTest.testkit';

/** Les rangées d'un document à rangées (`entries`). */
type DocumentARangees = { readonly entries: readonly unknown[] };

/** Le catalogue de la base vivante sous ses règles (`catalogueDuProcessus`), chaque document de `ajouts` augmenté,
 *  après ses entrées vivantes, des entrées que la suite déclare : un document-liste de ses entrées, un document à
 *  rangées des rangées (`entries`) du document déclaré. */
export function catalogueAvec(ajouts: Omit<LivreDeTest, 'regles'>): Catalogue {
  const documents: Record<string, unknown> = { ...BIBLIOTHEQUE };
  for (const [fichier, ajout] of Object.entries(ajouts)) {
    const vivant = BIBLIOTHEQUE[fichier];
    documents[fichier] = Array.isArray(vivant)
      ? [...vivant, ...(ajout as readonly unknown[])]
      : { ...(vivant as DocumentARangees), entries: [...(vivant as DocumentARangees).entries, ...(ajout as DocumentARangees).entries] };
  }
  return composer(documents, { regles: catalogueDuProcessus().regles });
}
