// DOCUMENT À RANGÉES (#3012) — un document `config` qui déclare `options.rangee` (corps `corps.rangees` de
// `document()`, `src/data/schemas/grammaire/document.ts`) : sa rangée est son ENTRÉE, comme la ligne d'un tableau
// racine. Lu par les structures locales (`structuresLocales.mts`) et les consommateurs de champs
// (`schemaFieldConsumers.mjs`). Côté détecteur : il ne lit de `src/` que la porte des produits et la descente.
import { ouverts } from '../../../src/data/schemas/grammaire/descente';
import { classeDeProduit } from '../../../src/data/schemas/grammaire/produits';
import type { SchemaDef } from '../../../src/data/schemas/types';

export const estDocumentARangees = (schema: unknown, famille: SchemaDef['famille']): boolean =>
  famille === 'config' && ouverts([schema]).some((n) => classeDeProduit(n)?.role === 'corps.rangees');
