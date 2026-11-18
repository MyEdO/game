import { nommerChamps, metaDesChamps } from '../grammaire/meta';
/** LDB 46 ; VDM 02 ; LDB 40. */
import { z } from 'zod';
import { document } from '../grammaire/document';
import { suiteDesEntrees } from '../grammaire/cle-d-espace';
import { plageOuverteSchema, sourceRefSchema } from '../grammaire/valeurs';
import { executeesDe, gameOpSchema, opsAuPecheSchema, testFixeSchema, porteurDeTestFixe } from '../grammaire/mecanique';

export const file = 'miscast.json';
export const famille = 'entite';

/** Test imbriqué d'une rangée : ses ops d'échec ignorent le Péché (`gameOpSchema`). */
const testImbriqueSchema = nommerChamps(porteurDeTestFixe(z.strictObject({
  test: testFixeSchema,
  onFail: executeesDe(gameOpSchema),
  onFailHard: nommerChamps(z.strictObject({ dr: z.number(), ops: executeesDe(gameOpSchema) }), { dr: { label: 'DR' }, ops: { label: 'opérations' } }).optional(),
}), 'difficulty'), {
  test: { label: 'Test' },
  onFail: { label: 'échec' },
  onFailHard: { label: 'échec aggravé' },
});

/** Rangée de table (`engine/miscast.ts`) — entrée de table d100 (`min`/`max` inclusifs). */
export const rangee = nommerChamps(z.strictObject({
  ...plageOuverteSchema.shape,
  /** Identité STABLE (#422, exposition Codex) — slug préfixé par table (`mineure-`/`majeure-`/`colere-`)
   *  pour éviter toute collision inter-tables ; consommée par le Codex, jamais par `engine/miscast.ts`. */
  id: z.string(),
  label: z.string(),
  ops: opsAuPecheSchema.optional(),
  /** Ops appliqués aux CIBLES de l'incantation qui a déclenché le tirage. LDB 40 l.64. */
  targetOps: opsAuPecheSchema.optional(),
  test: testImbriqueSchema.optional(),
  reroll: z.enum(['majeure', 'mineure-x2']).optional(),
  /** VDM 02 l.238. */
  domainTable: z.string().optional(),
  source: sourceRefSchema.optional(),
}), {
  ...metaDesChamps(plageOuverteSchema, { exigees: true }),
  id: { label: 'identifiant' },
  label: { label: 'libellé' },
  ops: { label: 'opérations' },
  targetOps: { label: 'opérations sur les cibles' },
  test: { label: 'Test' },
  reroll: { label: 'relance' },
  domainTable: { label: 'table du domaine' },
  source: { label: 'source' },
});

/** Catégorie Codex de chaque document-table → son id, dans l'ordre de la donnée. */
const CATEGORIES = {
  imparfaiteMineure: 'miscast-mineure', imparfaiteMajeure: 'miscast-majeure',
  imparfaiteMineureVdm: 'miscast-mineure-vdm', imparfaiteMajeureVdm: 'miscast-majeure-vdm',
  colereDesDieux: 'miscast-colere',
} as const;

const doc = document(
  'miscast',
  famille,
  {},
  {},
  {
    edit: {
      niche: {
        categories: Object.fromEntries(Object.entries(CATEGORIES).map(([categorie, id]) => [categorie, suiteDesEntrees(id)])),
      },
    },
  },
  { rangee, deDeTirage: true },
);

export const schema = doc.schema;
export const meta = doc.meta;

export const exposition = doc.exposition;
