import { nommerChamps } from '../grammaire/meta';
/** ADE II 8 ; AA ; AA 10 l.26-92 ; ADE II ; ADE II 89 ; AA 119-120 */
import { z } from 'zod';
import { couvertDifficultySchema, sizeCategorySchema } from '../grammaire/valeurs';
import { document } from '../grammaire/document';
import { ref } from '../grammaire/ref';

export const file = 'structures.json';
export const famille = 'entite';

const doc = document(
  'structures',
  famille,
  {
    kind: z.enum(['porte', 'mur']),
    /** Nature d'AUTHORING (posable sur une arête) — redéfinit `kind` quand il diverge (Herse, #830). */
    edgeKind: z.enum(['porte', 'mur']).optional(),
    /** AA 10 */
    vehicle: z.boolean().optional(),
    /** RENDU (pas règle) : fortification de siège (rempart de pierre) vs cloison ordinaire. */
    fortified: z.boolean().optional(),
    char: nommerChamps(z.strictObject({ BE: z.number(), B: z.number() }), { BE: { label: 'Bonus d’Endurance' }, B: { label: 'Blessures' } }),
    /** ADE II 8 */
    traits: z.array(ref('trait')),
    /** AA ; AA 10 l.28-52 ; ADE II */
    enc: z.number().optional(),
    encLimit: z.number().optional(),
    couvertPenalty: couvertDifficultySchema.optional(),
    /** LDB 14 l.86 ; LDB 85 l.329 */
    occulte: z.literal(false).optional(),
    /** AA 10 l.98 ; LDB 85 l.344 */
    taille: sizeCategorySchema,
  },
  {
    kind: { label: 'Nature de la Structure', hint: 'Porte ou Mur, pour la résolution mécanique' },
    edgeKind: { label: 'Nature d’authoring', hint: 'Redéfinit kind quand elle diverge à la pose sur une arête' },
    vehicle: {
      label: 'Véhicule (partage la mécanique)',
      hint: 'Partage la mécanique de Points de Vie d’une Structure mais jamais posable sur une arête',
    },
    fortified: { label: 'Fortification (rendu)', hint: 'Rendu visuel seulement — jamais une règle' },
    char: { label: 'Blessures et Bonus d’Endurance' },
    traits: { label: 'Traits de Structure' },
    enc: {
      label: 'Encombrement',
      hint: 'Absent des entrées ADE II, et N/A pour certaines entrées AA (Structures fixes sans ENC)',
    },
    encLimit: { label: 'Limite d’Encombrement', hint: 'Encombrement maximal que la Structure peut recevoir' },
    couvertPenalty: { label: 'Pénalité de Couvert' },
    occulte: {
      label: 'Laisse voir à travers',
      hint: 'Ne se pose qu’à « faux », et exige un arbitrage maison ; retirer le champ rend la Structure occultante',
    },
    taille: {
      label: 'Taille de la Structure',
      hint: 'Compte son Bonus d’Endurance une fois de plus par catégorie au-dessus de l’attaquant ; exige un arbitrage maison',
    },
  },
  {
    codex: { keys: ['structures'] },
    edit: { dataset: 'structures' },
  },
  {
    exiges: ['source'],
    /** LDB 14 l.86 ; LDB 85 l.329 */
    affinerEntree: (entree) =>
      entree.superRefine((v, ctx) => {
        const e = v as { id: string; occulte?: unknown; maison?: unknown; taille?: unknown };
        const sansRaison = typeof e.maison !== 'string' || !e.maison;
        if (e.occulte === false && sansRaison)
          ctx.addIssue({
            code: 'custom',
            path: ['maison'],
            message: `${e.id} : \`occulte: false\` sans \`maison\` — aucun folio ne rend une Structure transparente (LDB 14 l.86), l’arbitrage se nomme.`,
          });
        if (e.taille != null && sansRaison)
          ctx.addIssue({
            code: 'custom',
            path: ['maison'],
            message: `${e.id} : \`taille\` sans \`maison\` — aucune table de source n’imprime la Taille d’une Structure (AA 10 l.98 la laisse à déterminer), l’arbitrage se nomme.`,
          });
      }),
  },
);

export const schema = doc.schema;
export const meta = doc.meta;

export const exposition = doc.exposition;
