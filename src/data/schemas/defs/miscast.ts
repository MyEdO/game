import { nommerChamps, metaDesChamps } from '../grammaire/meta';
/** LDB 46 ; VDM 02 ; LDB 40. */
import { z } from 'zod';
import { document } from '../grammaire/document';
import { suiteDesEntrees } from '../grammaire/cle-d-espace';
import { formulaSchema, formulaSinSchema, plageOuverteSchema, sourceRefSchema } from '../grammaire/valeurs';
import { ref, refOuSpec } from '../grammaire/ref';
import { deitySkillPickSchema, exigerDuTest, flowTestSchema, MESSAGE_DUREE_DE_DIVINITE, refDEtatSchema } from '../grammaire/mecanique';

export const file = 'miscast.json';
export const famille = 'entite';

/**
 * `JsonOp` (`engine/miscast.ts`) — miroir aplati du `GameOp` runtime (`op:'condition'|'wounds'|
 * 'corruption'|'reduceToZero'|'castPenalty'|'suppressTalents'|'deitySkillMod'|'deityBan'|'prayerForAction'`, seuls op observés dans la donnée), en `JsonFormula`.
 * `escapeStrength` porte la `Formula` générale (`formulaSchema`) : `expandOp` la recopie telle quelle
 * dans le `GameOp`, que `applyOps` résout par `resolveFormula` (`engine/ops.ts`).
 */
const jsonOpSchema = nommerChamps(z.strictObject({
  op: z.string(),
  /** État de l'op `condition`, recopié littéralement par `expandOp` (`engine/miscast.ts`), comme sa gate. */
  id: refDEtatSchema.optional(),
  value: formulaSinSchema.optional(),
  durationRounds: formulaSinSchema.optional(),
  /** LDB 40 l.75 ; LDB 16 l.117. */
  perRound: z.literal(true).optional(),
  unlessCondition: refDEtatSchema.optional(),
  amount: formulaSinSchema.optional(),
  /** LDB 46. */
  ignoreTB: z.boolean().optional(),
  ignoreAP: z.boolean().optional(),
  skill: refOuSpec('skill').optional(),
  mod: z.number().optional(),
  blocked: z.boolean().optional(),
  maxZeroDR: z.boolean().optional(),
  rounds: formulaSinSchema.optional(),
  hours: formulaSinSchema.optional(),
  minutes: formulaSinSchema.optional(),
  days: formulaSinSchema.optional(),
  /** LDB 40 l.80, l.82. */
  talents: z.array(ref('talent')).min(1).optional(),
  durationDays: formulaSinSchema.optional(),
  /** LDB 40 l.61, l.70. */
  pick: deitySkillPickSchema.optional(),
  durationHours: formulaSinSchema.optional(),
  escapeStrength: formulaSchema.optional(),
}).superRefine((v, ctx) => {
  if (v.op === 'deitySkillMod' && (v.durationHours === undefined) === (v.durationDays === undefined)) {
    ctx.addIssue({ code: 'custom', path: ['durationHours'], message: MESSAGE_DUREE_DE_DIVINITE });
  }
  if (v.op === 'deityBan' && v.durationDays === undefined) ctx.addIssue({ code: 'custom', path: ['durationDays'], message: '`deityBan` exige sa durée en jours (LDB 40 l.64).' });
  if (v.op === 'condition' && v.id === undefined) ctx.addIssue({ code: 'custom', path: ['id'], message: '`condition` exige son État.' });
  if (v.op === 'prayerForAction' && v.durationRounds === undefined) ctx.addIssue({ code: 'custom', path: ['durationRounds'], message: '`prayerForAction` exige sa durée en Rounds (LDB 40 l.74).' });
}), {
  op: { label: 'opération' },
  id: { label: 'identifiant' },
  value: { label: 'valeur' },
  durationRounds: { label: 'durée en Rounds' },
  perRound: { label: 'par Round' },
  unlessCondition: { label: 'État empêchant l’effet' },
  amount: { label: 'quantité' },
  ignoreTB: { label: 'Bonus d’Endurance ignoré' },
  ignoreAP: { label: 'PA ignorés' },
  skill: { label: 'Compétence' },
  mod: { label: 'modificateur' },
  blocked: { label: 'bloqué' },
  maxZeroDR: { label: 'plafond de zéro DR' },
  rounds: { label: 'Rounds' },
  hours: { label: 'heures' },
  minutes: { label: 'minutes' },
  days: { label: 'jours' },
  talents: { label: 'Talents suspendus' },
  durationDays: { label: 'durée en jours' },
  pick: { label: 'Compétences frappées' },
  durationHours: { label: 'durée en heures' },
  escapeStrength: { label: 'Force pour s’échapper' },
});

/** `JsonNestedTest` (`engine/miscast.ts`). */
const jsonNestedTestSchema = nommerChamps(z.strictObject({
  test: flowTestSchema,
  onFail: z.array(jsonOpSchema),
  onFailHard: nommerChamps(z.strictObject({ dr: z.number(), ops: z.array(jsonOpSchema) }), { dr: { label: 'DR' }, ops: { label: 'opérations' } }).optional(),
}).superRefine(exigerDuTest('difficulty')), {
  test: { label: 'Test' },
  onFail: { label: 'échec' },
  onFailHard: { label: 'échec aggravé' },
});

/** `JsonRow` (`engine/miscast.ts`) — entrée de table d100 (`min`/`max` inclusifs). */
export const rangee = nommerChamps(z.strictObject({
  ...plageOuverteSchema.shape,
  /** Identité STABLE (#422, exposition Codex) — slug préfixé par table (`mineure-`/`majeure-`/`colere-`)
   *  pour éviter toute collision inter-tables ; consommée par le Codex, jamais par `engine/miscast.ts`. */
  id: z.string(),
  label: z.string(),
  ops: z.array(jsonOpSchema).optional(),
  /** Ops appliqués aux CIBLES de l'incantation qui a déclenché le tirage. LDB 40 l.64. */
  targetOps: z.array(jsonOpSchema).optional(),
  test: jsonNestedTestSchema.optional(),
  reroll: z.enum(['majeure', 'mineure-x2']).optional(),
  /** VDM 02 l.238. */
  domainTable: z.string().optional(),
  source: sourceRefSchema.optional(),
}), {
  ...metaDesChamps(plageOuverteSchema, { exigees: true }),
  id: { label: 'identifiant' },
  label: { label: 'libellé' },
  ops: { label: 'opérations' },
  targetOps: { label: 'opérations sur les cibles' },
  test: { label: 'Test' },
  reroll: { label: 'relance' },
  domainTable: { label: 'table du domaine' },
  source: { label: 'source' },
});

/** Catégorie Codex de chaque document-table → son id, dans l'ordre de la donnée. */
const CATEGORIES = {
  imparfaiteMineure: 'miscast-mineure', imparfaiteMajeure: 'miscast-majeure',
  imparfaiteMineureVdm: 'miscast-mineure-vdm', imparfaiteMajeureVdm: 'miscast-majeure-vdm',
  colereDesDieux: 'miscast-colere',
} as const;

const doc = document(
  'miscast',
  famille,
  {},
  {},
  {
    edit: {
      niche: {
        categories: Object.fromEntries(Object.entries(CATEGORIES).map(([categorie, id]) => [categorie, suiteDesEntrees(id)])),
      },
    },
  },
  { rangee, deDeTirage: true },
);

export const schema = doc.schema;
export const meta = doc.meta;

export const exposition = doc.exposition;
