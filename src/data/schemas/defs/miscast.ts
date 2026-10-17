import { nommerChamps, metaDesChamps } from '../grammaire/meta';
/** LDB 46 ; VDM 02 ; LDB 40. */
import { z } from 'zod';
import { document } from '../grammaire/document';
import { formulaSchema, formulaSinSchema, plageSchema, sourceRefSchema } from '../grammaire/valeurs';
import { idDe, refOuSpec } from '../grammaire/ref';

export const file = 'miscast.json';
export const famille = 'entite';

const difficultySchemaLocal = z.enum([
  'tresFacile', 'facile', 'accessible', 'intermediaire', 'complexe',
  'difficile', 'tresDifficile', 'presqueImpossible', 'impossible',
]);

/**
 * `JsonOp` (`engine/miscast.ts`) — miroir aplati du `GameOp` runtime (`op:'condition'|'wounds'|
 * 'corruption'|'reduceToZero'|'castPenalty'`, seuls op observés dans la donnée), en `JsonFormula`.
 * `escapeStrength` porte la `Formula` générale (`formulaSchema`) : `expandOp` la recopie telle quelle
 * dans le `GameOp`, que `applyOps` résout par `resolveFormula` (`engine/ops.ts`).
 */
const jsonOpSchema = nommerChamps(z.strictObject({
  op: z.string(),
  id: z.string().optional(),
  value: formulaSinSchema.optional(),
  durationRounds: formulaSinSchema.optional(),
  /** LDB 40 l.75 ; LDB 16 l.117. */
  perRound: z.literal(true).optional(),
  /** Gate d'État de l'op `condition`, recopiée littéralement par `expandOp` (`engine/miscast.ts`) :
   *  une RÉFÉRENCE à `etats.json`, donc posée par la fabrique. (`id` reste `z.string()` : polymorphe
   *  dans ce dialecte plat — État, Compétence ou table selon l'`op` de la ligne.) */
  unlessCondition: idDe('etat').optional(),
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
  escapeStrength: formulaSchema.optional(),
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
  escapeStrength: { label: 'Force pour s’échapper' },
});

/** `JsonNestedTest` (`engine/miscast.ts`). */
const jsonNestedTestSchema = nommerChamps(z.strictObject({
  skill: refOuSpec('skill').optional(),
  characteristic: z.string().optional(),
  difficulty: difficultySchemaLocal,
  onFail: z.array(jsonOpSchema),
  onFailHard: nommerChamps(z.strictObject({ dr: z.number(), ops: z.array(jsonOpSchema) }), { dr: { label: 'DR' }, ops: { label: 'opérations' } }).optional(),
}), {
  skill: { label: 'Compétence' },
  characteristic: { label: 'caractéristique' },
  difficulty: { label: 'difficulté' },
  onFail: { label: 'échec' },
  onFailHard: { label: 'échec aggravé' },
});

/** `JsonRow` (`engine/miscast.ts`) — entrée de table d100 (`min`/`max` inclusifs). */
const jsonRowSchema = nommerChamps(z.strictObject({
  ...plageSchema.shape,
  /** Identité STABLE (#422, exposition Codex) — slug préfixé par table (`mineure-`/`majeure-`/`colere-`)
   *  pour éviter toute collision inter-tables ; consommée par le Codex, jamais par `engine/miscast.ts`. */
  id: z.string(),
  label: z.string(),
  ops: z.array(jsonOpSchema).optional(),
  test: jsonNestedTestSchema.optional(),
  reroll: z.enum(['majeure', 'mineure-x2']).optional(),
  /** VDM 02 l.238. */
  domainTable: z.string().optional(),
  source: sourceRefSchema.optional(),
}), {
  ...metaDesChamps(plageSchema, { exigees: true }),
  id: { label: 'identifiant' },
  label: { label: 'libellé' },
  ops: { label: 'opérations' },
  test: { label: 'Test' },
  reroll: { label: 'relance' },
  domainTable: { label: 'table du domaine' },
  source: { label: 'source' },
});

const doc = document(
  'miscast',
  famille,
  {
    /** Catégorie Codex où vivent les LIGNES de ce tableau quand elles y sont exposées. Les deux
     *  révisions VDM n'en ont pas : le Codex n'expose que les trois tableaux du Livre de base, un
     *  renvoi y serait mort. */
    codexCategory: z.string().optional(),
  },
  {
    codexCategory: { label: 'Catégorie Codex des lignes', hint: 'Clé de la catégorie Compendium qui expose les rangées (absente = tableau non exposé)' },
  },
  {
    codex: { keys: ['miscastMinor', 'miscastMajor', 'miscastWrath'] },
    edit: { niche: { categories: { miscastMinor: '[miscast-mineure].entries', miscastMajor: '[miscast-majeure].entries', miscastWrath: '[miscast-colere].entries' } } },
  },
  { rangee: jsonRowSchema },
);

export const schema = doc.schema;
export const meta = doc.meta;

export const exposition = doc.exposition;
