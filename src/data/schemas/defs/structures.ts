/**
 * Schéma de `structures.json` — structures DESTRUCTIBLES de siège, dérivé de l'interface `StructureData`
 * (`src/engine/types.ts`). ADE II 8 l.280-288 ; AA 10 l.40-53 ; LDB 14 l.81.
 */
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
    /** RENDU (pas règle) : fortification de siège (rempart de pierre) vs cloison ordinaire. */
    fortified: z.boolean().optional(),
    char: z.strictObject({ BE: z.number(), B: z.number() }),
    /** Traits de la structure (Résistant / Impénétrable, ADE II 8) — référence NUE vers `traits.json`
     *  (5/5 résolus au 2026-09-01). */
    traits: z.array(ref('trait')),
    /** Profil AA (AA 10 l.28-52) — absents des 5 entrées ADE II ; N/A pour certaines entrées AA
     *  elles-mêmes (Herse/Solide porte en bois sans Pénalité de Couvert, Structures fixes sans ENC). */
    enc: z.number().optional(),
    encLimit: z.number().optional(),
    couvertPenalty: couvertDifficultySchema.optional(),
    /** Laisse-t-elle VOIR à travers ? `false` seul est écrivable, et il exige son `maison` ; l'état
     *  occultant est l'ABSENCE du champ — une seule graphie par état (LDB 14 l.86, LDB 85 l.329). */
    occulte: z.literal(false).optional(),
    /**
     * Catégorie de Taille de la Structure, qui compte son Bonus d'Endurance (`AA 10 l.98`) — et RIEN
     * d'autre : ce n'est pas le Trait Taille d'une créature (LDB 85 l.344), elle ne se pose donc jamais
     * sur le `Combatant` bâti par `structureCombatant`. Aucune table de source ne l'imprime — valeur
     * MAISON par entrée, dont `maison` porte la raison DE CETTE ENTRÉE.
     *
     * Critère d'authoring : on prend la Taille de la créature dont la Structure a l'encombrement (l'exemple
     * RAW est un mur de pierre Énorme).
     */
    taille: sizeCategorySchema,
    /**
     * Soutient-elle l'ÉTAGE qui surmonte son arête (`AA 10 l.127` : « Les Personnages qui se trouvent sur
     * ou dans la Structure ») ? Lu par le seul `etageSoutenu` (`state/scene.ts`). Aucun folio ne le dit —
     * valeur MAISON, dont `maison` porte la raison.
     */
    soutientEtage: z.boolean(),
  },
  {
    kind: { label: 'Nature de la Structure', hint: 'Porte ou Mur, pour la résolution mécanique' },
    edgeKind: { label: 'Nature d’authoring', hint: 'Redéfinit kind quand elle diverge à la pose sur une arête' },
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
    soutientEtage: {
      label: 'Soutient l’étage du dessus',
      hint: 'Abattue, elle effondre l’étage qui surmonte son arête et fait chuter ses occupants ; exige un arbitrage maison',
    },
  },
  {
    codex: { keys: ['structures'] },
    edit: { dataset: 'structures' },
  },
  {
    exiges: ['source'],
    /**
     * `occulte: false` ne peut citer aucun folio (LDB 14 l.86, LDB 85 l.329) : il porte son `maison`,
     * qui nomme le passage dont il est tiré. L'absence du champ reste muette — c'est le défaut, pas une
     * décision par entrée.
     */
    affinerEntree: (entree) =>
      entree.superRefine((v, ctx) => {
        const e = v as { id: string; occulte?: unknown; maison?: unknown; taille?: unknown; soutientEtage?: unknown };
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
        if (e.soutientEtage != null && sansRaison)
          ctx.addIssue({
            code: 'custom',
            path: ['maison'],
            message: `${e.id} : \`soutientEtage\` sans \`maison\` — aucun folio ne dit quelle Structure porte un étage (AA 10 l.127), l’arbitrage se nomme.`,
          });
      }),
  },
);

export const schema = doc.schema;
export const meta = doc.meta;

export const exposition = doc.exposition;
