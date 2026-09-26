/**
 * Schéma de `drunkenness.json` — Tableau d'Ivresse (LDB 09 l.475-481), consommé par
 * `src/engine/drunkenness.ts` (`{ table: DrunkEntry[] }`, lookup `findTableEntry` sur 1d10).
 * `outcome` = id STABLE de l'ISSUE tirée (Mouvement OU Action de « piece-tourne » lu par `drunkStaggers` ;
 * gueule de bois de « blackout » résolue par `soberUp`). La MÉCANIQUE exécutable (Bravoure/meilleur
 * ami/belligérant) est `ops` (`GameOp[]`, langue unique — `applyOps`), absent = rien d'exécutable.
 */
import { z } from 'zod';
import { document } from '../grammaire/document';
import { gameOpSchema } from '../grammaire/mecanique';
import { enumNomme, plageSchema } from '../grammaire/valeurs';

/** Les 5 issues du Tableau d'Ivresse (lues par `drunkStaggers`/`soberUp`). */
export const drunkennessOutcomeSchema = enumNomme({
  bravoure: 'Bravoure du Marienburgher',
  ami: 'Meilleur ami',
  staggering: 'La pièce tourne',
  belligerent: 'Tous, un par un',
  blackout: 'Trou noir (gueule de bois)',
});

export const file = 'drunkenness.json';
export const famille = 'config';

/** Un palier du 1d10 : `outcome` = id de l'ISSUE tirée, `ops` = la mécanique exécutable. */
const drunkEntrySchema = z.strictObject({
  ...plageSchema.shape,
  id: z.string(),
  label: z.string(),
  outcome: drunkennessOutcomeSchema,
  desc: z.string(),
  ops: z.array(gameOpSchema).optional(),
});

const doc = document(
  'drunkenness',
  famille,
  {},
  {},
  {
    codex: { keys: ['drunkenness'] },
    edit: { niche: { categories: { drunkenness: 'entries' } } },
  },
  { rangee: drunkEntrySchema },
);

export const schema = doc.schema;
export const meta = doc.meta;

export const exposition = doc.exposition;
