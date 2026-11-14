import { metaDesChamps, nommerChamps } from '../grammaire/meta';
/**
 * Schéma de `etats.json`, d'où dérive `EtatData` (`src/data/index.ts`). `effects` (`TriggeredEffect[]`) et
 * son `Flow` récursif : MÊME algèbre que talents.json (`engine/flowCore.ts`), PROMUE dans
 * `grammaire/mecanique.ts` (`flowSchema`/`conditionSchema`/`triggeredEffectSchema`).
 * `icon` et `maison` sont des clés d'ENVELOPPE, posées par la fabrique.
 */
import { z } from 'zod';
import { difficultySchema, stakeFormSchema } from '../grammaire/valeurs';
import { document } from '../grammaire/document';
import { conditionSchema, jetSchema, passifsDe, sujetsNonGarantis, triggeredEffectSchema } from '../grammaire/mecanique';
import { ref, refs } from '../grammaire/ref';
import { DECLARABLE_PAR_UN_PORTEUR } from '../grammaire/sousListes';
import { couleurHexSchema } from '../grammaire/valeurs';
import { visuelDeLumiereSchema } from './lightTones';

export const file = 'etats.json';
export const famille = 'entite';

/** Restriction Action/Mouvement/défense, de même forme que `StatusData.gating` (`src/data/index.ts`). */
const gatingSchema = nommerChamps(z.strictObject({
  action: z.literal('none').optional(),
  movement: z.enum(['none', 'half', 'crawl']).optional(),
  cannotDefend: z.literal(true).optional(),
}), {
  action: { label: 'action' },
  movement: { label: 'mouvement' },
  cannotDefend: { label: 'défense impossible' },
});

const recoverSchema = nommerChamps(z.strictObject({
  ...jetSchema.shape,
  opposedBy: z.literal('source').optional(),
  opposedDifficulty: difficultySchema.optional(),
  /** Enjeu du jet de récupération, porté par l'État (patron `ActivityDef.stake`) — lu par `stateRecoveryStakeRef`. */
  enjeu: z.string(),
  /** Forme déclarée de `enjeu` (garde `stake-form.test.ts`). */
  form: stakeFormSchema,
}), {
  ...metaDesChamps(jetSchema, { exigees: true }),
  opposedBy: { label: 'opposition' },
  opposedDifficulty: { label: 'difficulté de l’opposant', hint: 'Absente : Intermédiaire (LDB 12 l.166)' },
  enjeu: { label: 'enjeu' },
  form: { label: 'forme' },
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
    passive: passifsDe().optional(),
    effects: z.array(triggeredEffectSchema).optional(),
    gating: gatingSchema.optional(),
    severity: z.number().optional(),
    aiThreat: z.number().optional(),
    perStack: z.boolean().optional(),

    stacksReducedBy: z.string().optional(),
    restrictsAction: z.boolean().optional(),
    /** LDB 16 l.115. */
    nonCumulable: z.boolean().optional(),
    recover: recoverSchema.optional(),
    /** LDB 18 l.15. */
    lockedUntil: verrouDEtatSchema.optional(),
    lockedReason: z.string().optional(),
    /** LDB 17 l.61. */
    resolveHeals: z.number().int().min(1).optional(),
    /** LDB 16 l.56/70/84/92/107/117 ; LDB 62 l.250. */
    persistsAfterCombat: z.boolean().optional(),
    /** EDOC 12 l.170-197 ; #3045 */
    grantGroups: refs('groupe', { sousListe: DECLARABLE_PAR_UN_PORTEUR }).optional(),
    /** LDB 85 l.174 ; VDM 10 l.153 */
    typeDeDegats: ref('damageType').optional(),
    marqueCouleur: couleurHexSchema,
    marqueVisuel: visuelDeLumiereSchema.optional(),
    marqueSon: ref('son').optional(),
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
    grantGroups: { label: 'Groupes accordés', hint: 'Groupes du porteur tant qu’il porte l’État' },
    typeDeDegats: { label: 'Type de Dégâts', hint: 'Les effets déclenchés de l’État sont des Dégâts de ce Type : une Immunité à ce Type les annule' },
    marqueCouleur: { label: 'Teinte de la marque', hint: 'Teinte `#rrggbb` du nom de l’État au-dessus de son porteur et de son visuel' },
    marqueVisuel: { label: 'Visuel de la marque', hint: 'Ce qui entoure le porteur tant qu’il le porte ; aucun : son nom seul' },
    marqueSon: { label: 'Son de la marque', hint: 'Joué en boucle sur le porteur tant qu’il le porte' },
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
