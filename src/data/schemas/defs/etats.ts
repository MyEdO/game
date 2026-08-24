/**
 * Schéma de `etats.json` — dérivé de l'inventaire COMPLET des clés (script node, n=20/20) et de
 * `StatusData`/`EtatData` (`src/data/index.ts`). `effects` (`TriggeredEffect[]`) et
 * son `Flow` récursif : MÊME algèbre que talents.json (`engine/flowCore.ts`), PROMUE dans
 * `common.ts` (`flowSchema`/`conditionSchema`/`triggeredEffectSchema`).
 */
import { z } from 'zod';
import { charKeySchema, sourceRefSchema, gameOpSchema, difficultySchema, triggeredEffectSchema } from '../common';

export const file = 'etats.json';

/** `StatusData.gating` (`src/data/index.ts`) — restriction Action/Mouvement/défense. */
const gatingSchema = z.strictObject({
  action: z.literal('none').optional(),
  movement: z.enum(['none', 'half', 'crawl']).optional(),
  cannotDefend: z.literal(true).optional(),
});

/** `EtatData.recover` (`src/data/index.ts`). */
const recoverSchema = z.strictObject({
  skill: z.string().optional(),
  characteristic: charKeySchema.optional(),
  opposedBy: z.literal('source').optional(),
  difficulty: difficultySchema.optional(),
});

export const schema = z.array(
  z.strictObject({
    id: z.string(),
    label: z.string(),
    desc: z.string(),
    source: sourceRefSchema,
    passive: z.array(gameOpSchema).optional(),
    effects: z.array(triggeredEffectSchema).optional(),
    gating: gatingSchema.optional(),
    /** Icône du registre `<Icon>` (`famille/nom`) — pas d'enum fermé ici (registre hors dataset). */
    icon: z.string().optional(),
    severity: z.number().optional(),
    aiThreat: z.number().optional(),
    perStack: z.boolean().optional(),
    /** `stacksReducedBy` = clé de `CombatFeature` (ex. `bleedIgnore`) — laissé en `z.string()` (référence
     *  croisée hors périmètre d'un seul dataset). */
    stacksReducedBy: z.string().optional(),
    restrictsAction: z.boolean().optional(),
    recover: recoverSchema.optional(),
    /** `EtatData.recoverRequires` — exigences d'un remède qui n'est pas un Test (À Terre : `LDB 16 l.35`). */
    recoverRequires: z.strictObject({ minWounds: z.number().optional() }).optional(),
    /** `EtatData.persistsAfterCombat` (`src/data/index.ts`) — LDB 16 l.56/70/84/92/107/117, LDB 62 l.250. */
    persistsAfterCombat: z.boolean().optional(),
    /** Arbitrage NON-verbatim (`EtatData.maison`, `src/data/index.ts`) — même patron que
     *  `naval-traits.json`/`creatures.json`. */
    maison: z.string().optional(),
  }),
);
