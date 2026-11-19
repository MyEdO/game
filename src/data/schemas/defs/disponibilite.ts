import { nommerChamps, libelleDeValeur } from '../grammaire/meta';
/** LDB 59. */
import { tableTotale } from '../../../lib/tableTotale';
import { z } from 'zod';
import { document } from '../grammaire/document';
import { availabilitySchema, dispoPctAvailabilitySchema, enumNomme, settlementSchema, sourceRefSchema } from '../grammaire/valeurs';
import { provenanceDeValeurSchema } from '../grammaire/route';
import { AVAILABILITIES } from '../../../engine/types';
import { LIBELLES_DE_TAILLE } from '../defs-scenes/worldmap';

export const file = 'disponibilite.json';
export const famille = 'config';

/** Un indice de Taille de lieu (`LIBELLES_DE_TAILLE`), MSRC 13 l.44-50 : la clé de la table `colonneParTaille`. */
const tailleDeLieuSchema = enumNomme(tableTotale(Object.keys(LIBELLES_DE_TAILLE), (taille) => LIBELLES_DE_TAILLE[Number(taille)]));

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

  colonneParTaille: z.record(tailleDeLieuSchema, settlementSchema),
  provenanceDeColonneParTaille: provenanceDeValeurSchema,
  },
  {
    dispoPct: { label: 'Tableau de Disponibilité', hint: "Pourcentage de réussite du Test d'achat, par taille de colonie" },
    barterRatios: { label: 'Ratios de troc', hint: "Ratio d'objets échangés entre deux Disponibilités, au troc" },
    colonneParTaille: { label: 'Colonne par Taille de lieu', hint: 'Colonne du Tableau de Disponibilité que lit un marchand, selon la Taille du lieu où il se tient' },
    provenanceDeColonneParTaille: { label: 'Provenance de la colonne par Taille', hint: 'Source ou arbitrage maison de la table des colonnes par Taille de lieu' },
  },
  { codex: { keys: ['disponibilite'] }, edit: { object: 'unique' } },
);

export const schema = doc.schema;
export const meta = doc.meta;

export const exposition = doc.exposition;
