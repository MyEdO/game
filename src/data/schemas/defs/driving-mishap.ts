import { nommerChamps, metaDesChamps } from '../grammaire/meta';
/** LDB 09 l.140-149. */
import { z } from 'zod';
import { document } from '../grammaire/document';
import { enumNomme, plageSchema } from '../grammaire/valeurs';

/** Les 4 issues du tableau (`DrivingMishapOutcome`, lu par `mishapCausesCrash`). */
export const drivingMishapOutcomeSchema = enumNomme({
  harness: 'Harnais cassé',
  jolt: 'Cahots de la route',
  wheel: 'Roue brisée',
  crash: 'Essieu cassé (Accidenté)',
});

export const file = 'driving-mishap.json';
export const famille = 'config';

/** Une rangée du 1d10 : `outcome` = identifiant de l'ISSUE tirée. */
const mishapEntrySchema = nommerChamps(z.strictObject({
  ...plageSchema.shape,
  id: z.string(),
  label: z.string(),
  outcome: drivingMishapOutcomeSchema,
  desc: z.string(),
}), {
  ...metaDesChamps(plageSchema, { exigees: true }),
  id: { label: 'identifiant' },
  label: { label: 'libellé' },
  outcome: { label: 'issue' },
  desc: { label: 'texte' },
});

const doc = document(
  'driving-mishap',
  famille,
  {},
  {},
  {
    codex: { keys: ['drivingMishap'] },
    edit: { niche: { categories: { drivingMishap: 'entries' } } },
  },
  { rangee: mishapEntrySchema },
);

export const schema = doc.schema;
export const meta = doc.meta;

export const exposition = doc.exposition;
