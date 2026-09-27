/**
 * Schéma de `driving-mishap.json` — Tableau des Accidents de Conduite d'attelage EN SCÈNE
 * (LDB 09 l.140-149), 1d10. Reflet de `MishapEntry`/`DrivingMishapOutcome`. L'ISSUE tirée est
 * `outcome` — graphie du dépôt pour une issue de table (`sea-navigation.json::orientation.reperes`,
 * `mecanique.ts::travelTableEntry.mount.outcome`), la MÉCANIQUE exécutable restant `ops`
 * (`src/engine/drivingMishap.ts`).
 */
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
const mishapEntrySchema = z.strictObject({
  ...plageSchema.shape,
  id: z.string(),
  label: z.string(),
  outcome: drivingMishapOutcomeSchema,
  desc: z.string(),
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
