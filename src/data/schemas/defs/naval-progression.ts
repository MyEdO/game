/**
 * Schéma de `naval-progression.json` — table PROGRESSION D'UN NAVIRE (MDG 13 l.68-75) : bande de DR
 * du Test de Navigation → mode de déplacement (M+2 / M+1 / M / M−1 / M÷2). Consommé par
 * `src/engine/shipNavigation.ts` (`ProgressionEntry`, `findTableEntry`).
 */
import { z } from 'zod';
import { document, type DocumentARangees } from '../grammaire/document';
import { enumNomme, plageSchema, sourceRefSchema } from '../grammaire/valeurs';

/** Les 5 modes de déplacement de la table PROGRESSION D'UN NAVIRE (MDG 13 l.68-75). */
export const progressionModeSchema = enumNomme({
  plus2: 'Progression maximale (M+2)',
  plus1: 'Bonne progression (M+1)',
  normal: 'Progression normale (M)',
  minus1: 'Progression lente (M−1)',
  half: 'Lutte pour avancer (M÷2)',
});

export const file = 'naval-progression.json';
export const famille = 'config';

/** Une bande de DR du Test de Navigation. `mode` observés : les 5 issues RAW (ch.13 l.68-75). */
const progressionEntrySchema = z.strictObject({
  ...plageSchema.shape,
  /** id STABLE = `mode` (déjà une clé fermée à 5 valeurs) — identité d'entrée pour le Codex (#422). */
  id: z.string(),
  mode: progressionModeSchema,
  desc: z.string(),
  source: sourceRefSchema,
});

const doc = document(
  'naval-progression',
  famille,
  {},
  {},
  {
    codex: { keys: ['navalProgression'] },
    edit: { niche: { categories: { navalProgression: 'entries' } } },
  },
  { rangee: progressionEntrySchema },
);

export const schema = doc.schema;
export const meta = doc.meta;
export const exposition = doc.exposition;
export type NavalProgressionData = DocumentARangees<z.infer<typeof progressionEntrySchema>>;
