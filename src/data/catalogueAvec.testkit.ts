/**
 * Le CATALOGUE d'une suite qui juge une porte (#5070) : la base vivante, plus les entrées que la suite déclare. Une entrée
 * déclarée vit dans le catalogue sans exister dans l'index des ids ni dans la base vivante.
 */
import { BIBLIOTHEQUE } from './_racines-vivantes.generated';
import { catalogueDuProcessus } from './catalogueDuProcessus';
import { composer, type Catalogue } from './schemas/catalogue/catalogue';
import type { LivreDeTest } from './schemas/catalogue/catalogueDeTest.testkit';
import { garanti } from '../lib/garanti';

/** Le catalogue de la base vivante sous ses règles (`catalogueDuProcessus`), chaque document-liste de `ajouts` augmenté,
 *  après ses entrées vivantes, des entrées que la suite déclare. */
export function catalogueAvec(ajouts: Omit<LivreDeTest, 'regles'>): Catalogue {
  const documents: Record<string, unknown> = { ...BIBLIOTHEQUE };
  for (const [fichier, entrees] of Object.entries(ajouts)) documents[fichier] = [...(BIBLIOTHEQUE[fichier] as readonly unknown[]), ...(entrees as readonly unknown[])];
  return composer(documents, { regles: catalogueDuProcessus().regles });
}

/** La copie de l'entrée `id` des entrées `entrees` sous l'id `neuf`. */
export const copie = <E extends { id: string }>(entrees: readonly E[], id: string, neuf: string): E => ({ ...garanti(entrees.find((e) => e.id === id), id, 'entrée copiée'), id: neuf });
