import { nommerChamps, libelleDeValeur } from '../grammaire/meta';
/** LDB 59. */
import { tableTotale } from '../../../lib/tableTotale';
import { z } from 'zod';
import { document } from '../grammaire/document';
import { availabilitySchema, dispoPctAvailabilitySchema, settlementSchema, sourceRefSchema } from '../grammaire/valeurs';
import { AVAILABILITIES } from '../../../engine/types';

export const file = 'disponibilite.json';
export const famille = 'config';

const ratioSchema = nommerChamps(z.strictObject({ give: z.number(), get: z.number() }), { give: { label: 'donné' }, get: { label: 'reçu' } });

const doc = document(
  'disponibilite',
  famille,
  {

  dispoPct: z.array(
    nommerChamps(z.strictObject({
      availability: dispoPctAvailabilitySchema,
      pct: nommerChamps(z.strictObject(tableTotale(settlementSchema.options, () => z.number())), { ...tableTotale(settlementSchema.options, (taille) => ({ label: libelleDeValeur(settlementSchema, taille) })) }),
      source: sourceRefSchema,
    }), {
      availability: { label: 'disponibilité' },
      pct: { label: 'pourcentage' },
      source: { label: 'source' },
    }),
  ),

  barterRatios: z.array(
    nommerChamps(z.strictObject({
      give: availabilitySchema,
      ratios: nommerChamps(z.strictObject(tableTotale(AVAILABILITIES, () => ratioSchema)), { ...tableTotale(AVAILABILITIES, disponibilite => ({ label: libelleDeValeur(availabilitySchema, disponibilite) })) }),
      source: sourceRefSchema,
    }), {
      give: { label: 'donné' },
      ratios: { label: 'ratios' },
      source: { label: 'source' },
    }),
  ),
  },
  {
    dispoPct: { label: 'Tableau de Disponibilité', hint: "Pourcentage de réussite du Test d'achat, par taille de colonie" },
    barterRatios: { label: 'Ratios de troc', hint: "Ratio d'objets échangés entre deux Disponibilités, au troc" },
  },
  { codex: { keys: ['disponibilite'] }, edit: { object: 'unique' } },
);

export const schema = doc.schema;
export const meta = doc.meta;

export const exposition = doc.exposition;
