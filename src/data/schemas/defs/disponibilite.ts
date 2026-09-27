/**
 * Schéma de `disponibilite.json` — les deux tables numériques de « Faire son marché » (LDB 59)
 * en donnée éditable (#366) : `dispoPct` (Tableau de Disponibilité, folio 290 l.25-30) et
 * `barterRatios` (RATIOS DE TROC, folio 291 l.68-76). Consommé par `src/engine/disponibilite.ts`
 * (`DISPO_PCT` / `BARTER_RATIOS`). `availability` = `Availability` (`src/engine/types.ts`), clé
 * STABLE ; `village`/`ville`/`cite` = `Settlement`.
 */
import { tableTotale } from '../../../lib/tableTotale';
import { z } from 'zod';
import { document } from '../grammaire/document';
import { availabilitySchema, sourceRefSchema } from '../grammaire/valeurs';
import { AVAILABILITIES } from '../../../engine/types';

export const file = 'disponibilite.json';
export const famille = 'config';

/** Les Disponibilités qui portent un % (LDB 59 l.25-30) — SÉLECTION du canon, pas une union recopiée :
 *  `extract` borne son argument aux paliers de `availabilitySchema`. Jumeau runtime de
 *  `TestedAvailability` (`src/engine/types.ts`), égalité verrouillée par `unions-canon.test.ts`. */
export const dispoPctAvailabilitySchema = availabilitySchema.extract(['Limitée', 'Rare']);

const ratioSchema = z.strictObject({ give: z.number(), get: z.number() });

const doc = document(
  'disponibilite',
  famille,
  {
  /** Tableau de Disponibilité — % de réussite du Test (d100 ≤ %) par taille de colonie. Commune
   *  (toujours en stock) et Exotique (jamais) n'ont pas de %, donc absentes de la table. */
  dispoPct: z.array(
    z.strictObject({
      availability: dispoPctAvailabilitySchema,
      pct: z.strictObject({ village: z.number(), ville: z.number(), cite: z.number() }),
      source: sourceRefSchema,
    }),
  ),
  /** RATIOS DE TROC — une entrée par Disponibilité de l'objet DONNÉ (`give`), portant le ratio
   *  `{give,get}` contre chaque Disponibilité d'objet ACQUIS. */
  barterRatios: z.array(
    z.strictObject({
      give: availabilitySchema,
      ratios: z.strictObject(tableTotale(AVAILABILITIES, () => ratioSchema)),
      source: sourceRefSchema,
    }),
  ),
  },
  {
    dispoPct: { label: 'Tableau de Disponibilité', hint: "Pourcentage de réussite du Test d'achat, par taille de colonie" },
    barterRatios: { label: 'Ratios de troc', hint: "Ratio d'objets échangés entre deux Disponibilités, au troc" },
  },
  { codex: { keys: ['disponibilite'] }, edit: { object: 'single' } },
);

export const schema = doc.schema;
export const meta = doc.meta;

export const exposition = doc.exposition;
