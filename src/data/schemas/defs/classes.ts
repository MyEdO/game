/**
 * Schéma de `classes.json` — dérivé du contenu RÉEL et de `ClassData`
 * (`src/data/index.ts`). `trappings` = `TrappingRef[]` (id catalogue + quantité, ou texte
 * flavor hors catalogue) — MÊME forme que `careerLevels.trappings`/`species`, PROMUE dans `grammaire/reference.ts`.
 * L'`id` est le slug du libellé — cible de `CareerData.class`.
 */
import { z } from 'zod';
import { document } from '../grammaire/document';
import { trappingRefSchema } from '../grammaire/reference';
import { refs } from '../grammaire/ref';
import { DECLARABLE_PAR_UN_PORTEUR } from '../grammaire/sousListes';

export const file = 'classes.json';
export const famille = 'entite';

const doc = document(
  'classes',
  famille,
  {
    /** Ids de `groups.json` accordés à tout titulaire d'une carrière de cette Classe (`groupesDe`).
     *  Absent = la Classe n'ouvre aucun Groupe d'appartenance. */
    grantGroups: refs('groupe', { sousListe: DECLARABLE_PAR_UN_PORTEUR }).optional(),
    /** Possessions de départ. */
    trappings: z.array(trappingRefSchema),
  },
  {
    grantGroups: { label: 'Groupes accordés', hint: 'Groupes d’appartenance accordés à tout titulaire d’une carrière de cette Classe' },
    trappings: { label: 'Possessions de départ', hint: 'Équipement de départ commun aux carrières de cette Classe' },
  },
  {
    codex: { keys: ['classes'] },
    edit: { dataset: 'classes' },
  },
  { exiges: ['desc', 'source'] },
);

export const schema = doc.schema;
export const meta = doc.meta;

export const exposition = doc.exposition;
