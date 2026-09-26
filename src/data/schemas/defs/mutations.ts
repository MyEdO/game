/**
 * Schéma de `mutations.json` — Mutations (entités, LDB 19 l.112-165 + suppléments), miroir de
 * `MutationData = Omit<Mutation, 'roll' | 'talentsAcquis'>` (`src/data/mutations.ts`, `Mutation` définie
 * `src/engine/corruption.ts`). `roll` (jet d100, traçabilité de tirage) et `talentsAcquis` (provenance
 * posée par `attachMutation`) n'appartiennent PAS à l'entité éditable — portés seulement par l'INSTANCE
 * tirée ou attachée à l'exécution (hors dataset).
 */
import { z } from 'zod';
import { document } from '../grammaire/document';
import { entityAppearanceSchema, mutationKindSchema } from '../grammaire/valeurs';
import { gameOpSchema, triggeredEffectSchema } from '../grammaire/mecanique';

export const file = 'mutations.json';
export const famille = 'entite';

const doc = document(
  'mutations',
  famille,
  {
    kind: mutationKindSchema,
    passive: z.array(gameOpSchema).optional(),
    effects: z.array(triggeredEffectSchema).optional(),
    note: z.string().optional(),
    nonVisual: z.boolean().optional(),
    /** id d'une autre entrée `mutations.json` (Tête bestiale EDOC → sous-table alignée, `rollMutation`). */
    subTable: z.string().optional(),
    appearance: entityAppearanceSchema.optional(),
  },
  {
    kind: {
      label: 'Type de Mutation',
      hint: 'Physique ou mentale',
    },
    passive: { label: 'Effets passifs' },
    effects: { label: 'Effets déclenchés' },
    note: { label: 'Note', hint: 'Note mécanique de l’entrée — ex. bonus de Perception' },
    nonVisual: { label: 'Non visible', hint: 'La mutation n’affecte pas l’apparence' },
    subTable: { label: 'Sous-table de tirage', hint: 'Entrée dont la sous-table est tirée en cascade' },
    appearance: { label: 'Apparence' },
  },
  {
    codex: { keys: ['mutations'] },
    edit: { dataset: 'mutations' },
  },
  { exiges: ['desc'] },
);

export const schema = doc.schema;
export const meta = doc.meta;

export const exposition = doc.exposition;
