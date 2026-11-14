import { nommerChamps, metaDesChamps } from '../grammaire/meta';
/** MSRC 16 l.11-63 */
import { z } from 'zod';
import { document, tableTiree } from '../grammaire/document';
import { enumNomme, plageSchema } from '../grammaire/valeurs';
import { fixerLeTest, flowTestSchema } from '../grammaire/mecanique';
import { idDe } from '../grammaire/ref';

export const file = 'water-exposure.json';
export const famille = 'config';

/** MSRC 16 l.23-47 */
export const waterTableSchema = enumNomme({ 'source-d-eau': 'Source d’eau', 'blessures-et-etats': 'Blessures et États' });

/** MSRC 16 l.25/37 */
export const waterAppliesToSchema = enumNomme({ ingestion: 'Ingestion', immersion: 'Immersion' });

/** Union PLATE (pas `discriminatedUnion` — `woundsLost` a 2 formes selon `op`, discriminant non-unique
 *  sur `kind` seul). */
const waterExposureAutoSchema = z.union([
  nommerChamps(z.strictObject({ kind: z.literal('woundsRemaining'), op: z.literal('<='), value: z.number() }), { kind: { label: 'Type' }, op: { label: 'Opération' }, value: { label: 'Valeur' } }),
  nommerChamps(z.strictObject({ kind: z.literal('woundsLost'), op: z.literal('>='), value: z.number() }), { kind: { label: 'Type' }, op: { label: 'Opération' }, value: { label: 'Valeur' } }),
  nommerChamps(z.strictObject({ kind: z.literal('woundsLost'), op: z.literal('between'), ...plageSchema.shape }), { kind: { label: 'Type' }, op: { label: 'Opération' }, ...metaDesChamps(plageSchema, { exigees: true }) }),
  nommerChamps(z.strictObject({ kind: z.literal('perCondition'), condition: idDe('etat') }), { kind: { label: 'Type' }, condition: { label: 'Condition' } }),
  nommerChamps(z.strictObject({ kind: z.literal('hasCondition'), condition: idDe('etat') }), { kind: { label: 'Type' }, condition: { label: 'Condition' } }),
]);

const doc = document(
  'water-exposure',
  famille,
  {
  test: flowTestSchema,
  rollModPerNegativeSL: z.number(),
  modifiers: z.array(
    nommerChamps(z.strictObject({
      id: z.string(),
      label: z.string(),
      mod: z.number(),
      appliesTo: z.array(waterAppliesToSchema),
      table: waterTableSchema,
      auto: waterExposureAutoSchema.optional(),
    }), {
      id: { label: 'Identifiant' },
      label: { label: 'Libellé' },
      mod: { label: 'Modificateur' },
      appliesTo: { label: 'Application' },
      table: { label: 'Table' },
      auto: { label: 'Automatique' },
    }),
  ),
  /** MSRC 16 l.53 */
  diseases: tableTiree(
    nommerChamps(z.strictObject({
      ...plageSchema.shape,
      disease: idDe('maladie'),
      rerollUnlessWounded: z.boolean().optional(),
    }), {
      ...metaDesChamps(plageSchema, { exigees: true }),
      disease: { label: 'Maladie' },
      rerollUnlessWounded: { label: 'Relancer sauf si blessé' },
    }),
  ),
  },
  {
    test: { label: "Test d'exposition", hint: "Compétence et difficulté du Test déclenché par l'exposition à l'eau" },
    rollModPerNegativeSL: {
      label: 'Malus par DR négatif (jet de maladie)',
      hint: "Modificateur ajouté au tirage de la maladie, +10 par DR négatif du Test d'exposition",
    },
    modifiers: {
      label: 'Modificateurs',
      hint: "Modificateurs de Test par source d'eau/état, appliqués à l'ingestion et/ou l'immersion",
    },
    diseases: { label: 'Maladies contractées', hint: "Table de tirage de la maladie contractée en cas d'échec" },
  },
  { codex: { keys: ['waterExposure'] }, edit: { object: 'unique' } },
  { affinerEntree: (entree) => entree.superRefine(fixerLeTest('skill', 'difficulty')) },
);

export const schema = doc.schema;
export const meta = doc.meta;

export const exposition = doc.exposition;
