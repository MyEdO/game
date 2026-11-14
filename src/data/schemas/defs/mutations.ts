/**
 * Schéma de `mutations.json` — Mutations (entités, LDB 19 l.112-165 + suppléments), miroir de
 * `MutationData` (`src/data/mutations.ts`, `MutationDeCatalogue` de `src/engine/corruption.ts`). L'état
 * d'exécution (`EtatDeMutation` : `roll`, `usure`, `talentsAcquis`) n'appartient PAS à l'entité éditable — porté
 * seulement par l'INSTANCE tirée ou attachée (hors dataset).
 */
import { z } from 'zod';
import { document } from '../grammaire/document';
import { mutationKindSchema } from '../grammaire/valeurs';
import { mecaniqueDe, passifsDe, triggeredEffectSchema } from '../grammaire/mecanique';

export const file = 'mutations.json';
export const famille = 'entite';

const doc = document(
  'mutations',
  famille,
  {
    kind: mutationKindSchema,
    passive: passifsDe(mecaniqueDe({ 'charMod.min': 'admis' }).gameOp).optional(),
    effects: z.array(triggeredEffectSchema).optional(),
    note: z.string().optional(),
    /** id d'une autre entrée `mutations.json` (Tête bestiale EDOC → sous-table alignée, `rollMutation`). */
    subTable: z.string().optional(),
  },
  {
    kind: {
      label: 'Type de Mutation',
      hint: 'Physique ou mentale',
    },
    passive: { label: 'Effets passifs' },
    effects: { label: 'Effets déclenchés' },
    note: { label: 'Note', hint: 'Note mécanique de l’entrée — ex. bonus de Perception' },
    subTable: { label: 'Sous-table de tirage', hint: 'Entrée dont la sous-table est tirée en cascade' },
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
