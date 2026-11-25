/**
 * Le CATALOGUE d'une suite (#5069) : composé des seuls documents et règles qu'elle déclare. Un document absent se lit
 * comme une collection vide (`entreeDe`).
 */
import type { EntreeVivante } from '../../datasets';
import { composer, type Catalogue } from './catalogue';

/** Un document déclaré par une suite : ses entrées nomment leurs propres ids (`EntreeVivante`). */
type DocumentDeTest<D> = D extends readonly (infer E)[] ? readonly EntreeVivante<E>[] : D;

/** Les documents et les règles qu'une suite déclare. */
export type LivreDeTest = { readonly [F in keyof Catalogue]?: DocumentDeTest<Catalogue[F]> };

export function catalogueDeTest(livre: LivreDeTest): Catalogue {
  const { regles = {}, ...documents } = livre;
  return composer(documents, { regles });
}
