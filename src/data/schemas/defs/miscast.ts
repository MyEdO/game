/**
 * Schéma de `miscast.json` — DIALECTE compilé (PAS des `GameOp` standard), cf. en-tête de
 * `src/data/data-wellformed.test.ts` et `src/engine/miscast.ts::expandOp`. Modélise
 * `JsonRow`/`JsonNestedTest`/`JsonOp` TELS QU'ILS SONT LUS par `miscast.ts` (miroir du `GameOp`
 * runtime, mais `Formula` → `formulaSinSchema` — la formule générale plus le terme de Péché —, +
 * `durationRounds` propre au dialecte).
 *
 * Le fichier porte une LISTE de 5 documents à rangées — un par jeu de rangées tirable :
 * `miscast-mineure`/`miscast-majeure` (LDB 46 folio 234), leurs révisions `-vdm` (VDM 02 folios
 * 24/25, sélectionnées par la règle optionnelle `magic-vdm-incantation`) et `miscast-colere`
 * (LDB 40 folio 218). Chaque document porte SON identité, SA provenance et SES rangées : le
 * pointeur `rows` d'une méta séparée a disparu avec ce lot (#1467 L1b V-FLIP-TABLE, #309 phase 3).
 */
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
const jsonOpSchema = z.strictObject({
  op: z.string(),
  id: z.string().optional(),
  value: formulaSinSchema.optional(),
  durationRounds: formulaSinSchema.optional(),
  /** État RÉCURRENT (`GameOp['condition'].perRound`) : l'op est RE-JOUÉE à chaque fin de Round tant
   *  que l'effet porteur dure (`durationRounds` en dit la durée). `LDB 40 l.75`, `LDB 16 l.117`. */
  perRound: z.literal(true).optional(),
  /** Gate d'État de l'op `condition`, recopiée littéralement par `expandOp` (`engine/miscast.ts`) :
   *  une RÉFÉRENCE à `etats.json`, donc posée par la fabrique. (`id` reste `z.string()` : polymorphe
   *  dans ce dialecte plat — État, Compétence ou table selon l'`op` de la ligne.) */
  unlessCondition: idDe('etat').optional(),
  amount: formulaSinSchema.optional(),
  /** Mitigation DÉCLARÉE du `wounds` (garde `wounds-mitigation-declaree`) — recopiée telle quelle
   *  par `expandOp` : « qui ignorent les PA » seuls (Poupée de chiffon, LDB 46) ≠ « qui ignorent le
   *  Bonus d'Endurance et les PA » (Choc aethyrique, LDB 46). */
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
});

/** `JsonNestedTest` (`engine/miscast.ts`). */
const jsonNestedTestSchema = z.strictObject({
  skill: refOuSpec('skill').optional(),
  characteristic: z.string().optional(),
  difficulty: difficultySchemaLocal,
  onFail: z.array(jsonOpSchema),
  onFailHard: z.strictObject({ dr: z.number(), ops: z.array(jsonOpSchema) }).optional(),
});

/** `JsonRow` (`engine/miscast.ts`) — entrée de table d100 (`min`/`max` inclusifs). */
const jsonRowSchema = z.strictObject({
  ...plageSchema.shape,
  /** Identité STABLE (#422, exposition Codex) — slug préfixé par table (`mineure-`/`majeure-`/`colere-`)
   *  pour éviter toute collision inter-tables ; consommée par le Codex, jamais par `engine/miscast.ts`. */
  id: z.string(),
  label: z.string(),
  ops: z.array(jsonOpSchema).optional(),
  test: jsonNestedTestSchema.optional(),
  reroll: z.enum(['majeure', 'mineure-x2']).optional(),
  /** CLÉ d'une table déclarée par le Domaine du lanceur (`domains.json` → `tables`) : la rangée tire
   *  sur la table de SON Vent (`arcaneMark` = Marques Arcaniques, `VDM 02 l.238`). Résolue en op
   *  `rollTable`/`tableId` par `engine/miscast.ts` ; Domaine sans cette clé = relance sur le Majeur. */
  domainTable: z.string().optional(),
  source: sourceRefSchema.optional(),
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
