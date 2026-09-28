/**
 * Schéma de `etats.json` — dérivé de l'inventaire COMPLET des clés (script node, n=20/20) et de
 * `StatusData`/`EtatData` (`src/data/index.ts`). `effects` (`TriggeredEffect[]`) et
 * son `Flow` récursif : MÊME algèbre que talents.json (`engine/flowCore.ts`), PROMUE dans
 * `grammaire/mecanique.ts` (`flowSchema`/`conditionSchema`/`triggeredEffectSchema`).
 * `icon` et `maison` sont des clés d'ENVELOPPE, posées par la fabrique.
 */
import { z } from 'zod';
import { charKeySchema, difficultySchema, stakeFormSchema } from '../grammaire/valeurs';
import { document } from '../grammaire/document';
import { conditionSchema, gameOpSchema, sujetsNonGarantis, triggeredEffectSchema } from '../grammaire/mecanique';
import { refOuSpec } from '../grammaire/ref';

export const file = 'etats.json';
export const famille = 'entite';

/** `StatusData.gating` (`src/data/index.ts`) — restriction Action/Mouvement/défense. */
const gatingSchema = z.strictObject({
  action: z.literal('none').optional(),
  movement: z.enum(['none', 'half', 'crawl']).optional(),
  cannotDefend: z.literal(true).optional(),
});

/** `EtatData.recover` (`src/data/index.ts`). */
const recoverSchema = z.strictObject({
  skill: refOuSpec('skill').optional(),
  characteristic: charKeySchema.optional(),
  opposedBy: z.literal('source').optional(),
  difficulty: difficultySchema.optional(),
  /** Enjeu du jet de récupération, porté par l'État (patron `ActivityDef.stake`) — lu par `stateRecoveryStakeRef`. */
  enjeu: z.string(),
  /** Forme déclarée de `enjeu` (garde `night-stake-form.test.ts`). */
  form: stakeFormSchema,
});

/** `EtatData.lockedUntil` : même contexte d'évaluation que le verrou d'instance (`conditionLockCtx`),
 *  donc même refus — un sujet que cette vue ne porte pas serait évalué FAUX en silence. */
const verrouDEtatSchema = conditionSchema.superRefine((v, ctx) => {
  for (const kind of sujetsNonGarantis(v)) {
    ctx.addIssue({
      code: 'custom',
      message: `Verrou d'État : la Condition « ${kind} » lit un état que le contexte de verrou ne porte pas `
        + '(`conditionLockCtx`, engine/actorView.ts — la vue du seul PORTEUR).',
    });
  }
});

const doc = document(
  'etats',
  famille,
  {
    passive: z.array(gameOpSchema).optional(),
    effects: z.array(triggeredEffectSchema).optional(),
    gating: gatingSchema.optional(),
    severity: z.number().optional(),
    aiThreat: z.number().optional(),
    perStack: z.boolean().optional(),
    /** `stacksReducedBy` = clé de `CombatFeature` (ex. `bleedIgnore`) — laissé en `z.string()` (référence
     *  croisée hors périmètre d'un seul dataset). */
    stacksReducedBy: z.string().optional(),
    restrictsAction: z.boolean().optional(),
    /** LDB 16 l.115 (Inconscient), l.37 (À Terre), l.137 (Surpris) — « ne se cumule pas ». */
    nonCumulable: z.boolean().optional(),
    recover: recoverSchema.optional(),
    /** `EtatData.lockedUntil` — verrou de TYPE (À Terre : `LDB 18 l.15`). Même porte que le verrou
     *  d'instance de l'op `condition` : un sujet hors du contexte de verrou est refusé ICI, nommé. */
    lockedUntil: verrouDEtatSchema.optional(),
    lockedReason: z.string().optional(),
    /** `EtatData.resolveHeals` — `LDB 17 l.61`. Un soin NUL se dit par l'absence du champ. */
    resolveHeals: z.number().int().min(1).optional(),
    /** `EtatData.persistsAfterCombat` (`src/data/index.ts`) — LDB 16 l.56/70/84/92/107/117, LDB 62 l.250. */
    persistsAfterCombat: z.boolean().optional(),
  },
  {
    passive: { label: 'Effets passifs', hint: 'Effets mécaniques appliqués en continu tant que l’État est actif' },
    effects: { label: 'Effets déclenchés' },
    gating: { label: 'Restrictions Action/Mouvement/défense', hint: 'Limite Action/Mouvement/défense pendant l’État' },
    severity: { label: 'Sévérité' },
    aiThreat: { label: 'Menace pour l’IA', hint: 'Poids pris en compte par l’IA pour évaluer la dangerosité de l’État' },
    perStack: { label: 'Par cumul', hint: 'L’effet se recalcule à chaque palier de cumul, pas une seule fois' },
    stacksReducedBy: { label: 'Cumuls réduits par', hint: 'Capacité de combat qui réduit le nombre de cumuls' },
    nonCumulable: { label: 'Ne se cumule pas', hint: 'Un seul pion, quelle que soit la cause — le porteur l’a ou ne l’a pas' },
    restrictsAction: {
      label: 'Action verrouillée',
      hint: 'État bloquant (Brisé) : l’IA dépense sa Détermination pour le lever',
    },
    recover: { label: 'Guérison', hint: 'Test (Compétence/Caractéristique/Difficulté) qui met fin à l’État' },
    lockedUntil: {
      label: 'Verrouillé tant que',
      hint: 'Tant que la Condition est fausse, l’État ne se retire par aucun moyen (À Terre à 0 Blessure)',
    },
    lockedReason: { label: 'Raison du verrou', hint: 'Ce que le joueur lit quand le verrou refuse le geste' },
    resolveHeals: {
      label: 'Blessures rendues par la Détermination',
      hint: 'Blessures regagnées quand un point de Détermination retire cet État (À Terre : 1)',
    },
    persistsAfterCombat: { label: 'Persiste hors combat' },
  },
  {
    codex: { keys: ['etats'] },
    edit: { dataset: 'etats' },
  },
  { exiges: ['desc', 'source'] },
);

export const schema = doc.schema;
export const meta = doc.meta;

export const exposition = doc.exposition;
