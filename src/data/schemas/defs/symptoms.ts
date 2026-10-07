import { nommerChamps } from '../grammaire/meta';
/**
 * Schéma de `symptoms.json` — dérivé de l'inventaire COMPLET des clés (script node, n=16/16) et de
 * `SymptomData`/`SymptomCapabilities` (`src/data/index.ts`).
 */
import { z } from 'zod';
import { document } from '../grammaire/document';
import { flowSchema, gameOpSchema, noeudTest, triggeredEffectSchema } from '../grammaire/mecanique';

export const file = 'symptoms.json';
export const famille = 'entite';

const difficultySchemaLocal = z.enum([
  'tresFacile', 'facile', 'accessible', 'intermediaire', 'complexe',
  'difficile', 'tresDifficile', 'presqueImpossible', 'impossible',
]);

/** `SymptomCapabilities` (`src/data/index.ts`) — sac de flags CLOS. */
const symptomCapabilitiesSchema = nommerChamps(z.strictObject({
  blocksHealing: z.boolean().optional(),
  amputation: z.boolean().optional(),
  contagious: z.boolean().optional(),
  nausea: z.boolean().optional(),
  endTest: z.boolean().optional(),
  persistentActive: z.boolean().optional(),
}), {
  blocksHealing: { label: 'Soins bloqués' },
  amputation: { label: 'Amputation' },
  contagious: { label: 'Contagieux' },
  nausea: { label: 'Nausée' },
  endTest: { label: 'Test de fin' },
  persistentActive: { label: 'Actif en permanence' },
});

const hitLocationSchema = z.enum(['tete', 'brasG', 'brasD', 'corps', 'jambeG', 'jambeD']);

/** LDB 20 l.212 */
const noeudDuCycle = noeudTest(flowSchema, { difficulteRequise: true, echecSeulServi: true });

/** MSRC 16 l.142 */
const onTickSchema = nommerChamps(z
  .strictObject({
    test: noeudDuCycle.optional(),
    ops: z.array(gameOpSchema).optional(),
    /** LDB 20 l.215 */
    difficultyBySeverity: nommerChamps(z
      .strictObject({
        moderee: difficultySchemaLocal.optional(),
        grave: difficultySchemaLocal.optional(),
      }), { moderee: { label: 'Modérée' }, grave: { label: 'Grave' } })
      .optional(),
    /** MSRC 16 */
    afterDays: z.number().optional(),
    /** UNE seule fois (au jour `afterDays` exact — Vers du Reik) ; absent = quotidien (Vers de carie). */
    once: z.boolean().optional(),
  })
  .superRefine((v, ctx) => {
    if (!v.test === !v.ops) {
      ctx.addIssue({
        code: 'custom',
        message: 'un cycle porte SOIT une épreuve (`test`) SOIT une conséquence certaine (`ops`) — jamais les deux, jamais aucune.',
      });
    }
    if (v.difficultyBySeverity && !v.test) {
      ctx.addIssue({
        code: 'custom',
        path: ['difficultyBySeverity'],
        message: '`difficultyBySeverity` indexe la Difficulté d’une épreuve — un cycle sans `test` n’en a aucune.',
      });
    }
  }), {
  test: { label: 'Test' },
  ops: { label: 'Opérations' },
  difficultyBySeverity: { label: 'Difficulté par gravité' },
  afterDays: { label: 'Délai en jours' },
  once: { label: 'Une seule fois' },
});

const doc = document(
  'symptoms',
  famille,
  {
    passive: z.array(gameOpSchema).optional(),
    /** LDB 20 l.157 */
    passiveBySeverity: nommerChamps(z
      .strictObject({
        moderee: z.array(gameOpSchema).optional(),
        grave: z.array(gameOpSchema).optional(),
      }), { moderee: { label: 'Modérée' }, grave: { label: 'Grave' } })
      .optional(),
    /** MSRC 16 */
    effects: z.array(triggeredEffectSchema).optional(),
    onTick: onTickSchema.optional(),
    /** MSRC 16 l.140 */
    visiblePassive: z.array(gameOpSchema).optional(),
    /** Localisations VISIBLES (`maison`) qui activent `visiblePassive`. */
    visibleLocations: z.array(hitLocationSchema).optional(),
    capabilities: symptomCapabilitiesSchema.optional(),
  },
  {
    passive: { label: 'Effets passifs' },
    passiveBySeverity: { label: 'Effets passifs (par palier)', hint: 'Effets passifs qui S’AJOUTENT à « Effets passifs » dès que l’instance atteint ce palier ; une pénalité s’y écrit en valeur ABSOLUE (la pire l’emporte)' },
    effects: { label: 'Effets déclenchés' },
    onTick: {
      label: 'Évolution périodique',
      hint: 'Conséquence récurrente : chaque jour, ou au Nᵉ jour ; sous jet (nœud `test`, la branche d’échec applique ses effets) ou certaine (`ops`)',
    },
    visiblePassive: {
      label: 'Effets passifs (lésion visible)',
      hint: 'Actifs seulement quand la lésion est sur une localisation visible',
    },
    visibleLocations: { label: 'Localisations visibles' },
    capabilities: { label: 'Capacités mécaniques (liste fermée)' },
  },
  {
    codex: { keys: ['symptoms'] },
    edit: { dataset: 'symptoms' },
  },
  { exiges: ['desc'] },
);

export const schema = doc.schema;
export const meta = doc.meta;

export const exposition = doc.exposition;
