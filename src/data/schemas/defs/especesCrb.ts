/**
 * Schéma de `especesCrb.json` — la création du livre de base 5e (CRB 008-012), une entrée par espèce du CRB, keyée par
 * l'id de son espèce de `species.json`, même forme que ses champs de création. CRB 006 l.19-29
 */
import { z } from 'zod';
import { document } from '../grammaire/document';
import { charKeySchema } from '../grammaire/valeurs';
import { refOuSpec } from '../grammaire/ref';
import { avancement, talentDEspece } from '../grammaire/avancement';

export const file = 'especesCrb.json';
export const famille = 'entite';

const doc = document(
  'especesCrb',
  famille,
  {
    /** CRB 008 l.75 */
    movement: z.number(),
    /** CRB 008 l.67 */
    fate: z.number(),
    /** CRB 008 l.71 */
    fortune: z.number(),
    /** CRB 015 l.16-27 */
    baseChar: z.record(charKeySchema, z.number()),
    /** CRB 008 l.55 */
    langues: z.array(refOuSpec('skill')),
    /** CRB 008 l.59 */
    skills: z.array(avancement('skill')),
    /** CRB 008 l.63 */
    talents: z.array(talentDEspece),
  },
  {
    movement: { label: 'Mouvement' },
    fate: { label: 'Destin' },
    fortune: { label: 'Fortune' },
    baseChar: { label: 'Caractéristiques de base' },
    langues: { label: 'Langues courantes' },
    skills: { label: 'Compétences d’espèce', inverseCodex: true },
    talents: { label: 'Talents d’espèce', inverseCodex: { type: 'talent' } },
  },
  {
    codex: { keys: ['especesCrb'] },
    edit: { dataset: 'especesCrb' },
  },
  { exiges: ['source'] },
);

export const schema = doc.schema;
export const meta = doc.meta;

export const exposition = doc.exposition;
