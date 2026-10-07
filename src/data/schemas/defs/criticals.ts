import { nommerChamps, metaDesChamps } from '../grammaire/meta';
/** LDB 18 ; AA 07 ; LDB 18 l.53 ; AA 07 l.40 ; AA 07 l.79. */
import { z } from 'zod';
import { document } from '../grammaire/document';
import { suiteAvecPas } from '../grammaire/cle-d-espace';
import { difficultySchema, enumNomme, hitLocationSchema, plageSchema, sourceRefSchema, formulaSchema } from '../grammaire/valeurs';
import { gameOpSchema, flowSchema, noeudTest } from '../grammaire/mecanique';


export const critTableSchema = enumNomme({ tete: 'Tête', bras: 'Bras', corps: 'Corps', jambe: 'Jambe' });

export const file = 'criticals.json';
// Un FICHIER, 8 DOCUMENTS-tables : famille `entite` + charge `options.rangee` (patron `miscast.ts`).
export const famille = 'entite';

/** Le nœud de jet des Blessures critiques : `difficulty` RESSERRÉE (39/39 la portent, aucune n'est
 *  une épreuve sans Difficulté). Partagé par la rangée et par l'escalade `onNextCritWhileCondition`. */
const noeudCritique = noeudTest(flowSchema, { difficulteRequise: true });


export const critEscalationSchema = nommerChamps(z.strictObject({

  perRound: nommerChamps(z.strictObject({ versTraumaId: z.string(), unites: z.number().optional() }), { versTraumaId: { label: 'séquelle résultante' }, unites: { label: 'unités' } }).optional(),
  apresDelai: nommerChamps(z.strictObject({ jours: formulaSchema, versTraumaId: z.string() }), { jours: { label: 'jours' }, versTraumaId: { label: 'séquelle résultante' } }).optional(),

  medicalAidGate: nommerChamps(z
    .strictObject({
      label: z.string(),
      disable: z.array(gameOpSchema),
      restoreDR: z.number(),
      recoveryPenalty: z.array(gameOpSchema),
    }), {
    label: { label: 'libellé' },
    disable: { label: 'désactivation' },
    restoreDR: { label: 'DR de récupération' },
    recoveryPenalty: { label: 'pénalité de récupération' },
  })
    .optional(),
  // LDB 18 l.101/118/143/145/148/175 ; AA 07 l.119/147/149/152/175.
  bleedOnReinjury: nommerChamps(z.strictObject({ amount: z.number(), label: z.string() }), { amount: { label: 'quantité' }, label: { label: 'libellé' } }).optional(),
  // LDB 18 l.71 ; AA 07 l.96.
  onRepeat: nommerChamps(z
    .strictObject({
      traumas: z.array(z.string()).optional(),
      ops: z.array(gameOpSchema).optional(),
    }), { traumas: { label: 'séquelles' }, ops: { label: 'opérations' } })
    .optional(),
  // LDB 18 l.74.
  onNextCritWhileCondition: nommerChamps(z
    .strictObject({
      label: z.string(),
      location: hitLocationSchema.optional(),
      whileCondition: z.string(),
      test: noeudCritique,
    }), {
    label: { label: 'libellé' },
    location: { label: 'localisation' },
    whileCondition: { label: 'pendant l’État' },
    test: { label: 'Test' },
  })
    .optional(),
  // LDB 18 l.304.
  onHealGrant: nommerChamps(z.strictObject({ scar: z.string(), whenClear: z.array(z.string()) }), { scar: { label: 'cicatrice' }, whenClear: { label: 'États à retirer' } }).optional(),
}), {
  perRound: { label: 'par Round' },
  apresDelai: { label: 'après un délai' },
  medicalAidGate: { label: 'aide médicale requise' },
  bleedOnReinjury: { label: 'hémorragie sur nouvelle blessure' },
  onRepeat: { label: 'nouvelle occurrence' },
  onNextCritWhileCondition: { label: 'prochain critique pendant l’État' },
  onHealGrant: { label: 'octroi après guérison' },
});

/** LDB 18 l.237. */
export const amputationSchema = nommerChamps(z.strictObject({
  difficulty: difficultySchema,
  sequels: z.array(z.string()),

  unites: formulaSchema.optional(),
  // LDB 18 l.171 ; AA 07 l.171.
  timing: z.literal('postEncounter').optional(),

  loss: nommerChamps(z.strictObject({ difficulty: difficultySchema.optional(), perDR: z.boolean().optional() }), { difficulty: { label: 'difficulté' }, perDR: { label: 'par DR' } }).optional(),
}), {
  difficulty: { label: 'difficulté' },
  sequels: { label: 'séquelles' },
  unites: { label: 'unités' },
  timing: { label: 'moment' },
  loss: { label: 'perte' },
});

const critEntrySchema = nommerChamps(z.strictObject({
  ...plageSchema.shape,
  id: z.string(),
  label: z.string(),
  ops: z.array(gameOpSchema).optional(),
  test: noeudCritique.optional(),
  lethal: z.boolean().optional(),
  amputation: amputationSchema.optional(),
  traumas: z.array(z.string()).optional(),
  escalation: critEscalationSchema.optional(),
  // Note MAISON (#195) : trace éditable d'une valeur mécanique absente littéralement du texte RAW (règle stricte 7).
  maison: z.string().optional(),
  desc: z.string(),
  source: sourceRefSchema,
}), {
  ...metaDesChamps(plageSchema, { exigees: true }),
  id: { label: 'identifiant' },
  label: { label: 'libellé' },
  ops: { label: 'opérations' },
  test: { label: 'Test' },
  lethal: { label: 'mortel' },
  amputation: { label: 'amputation' },
  traumas: { label: 'séquelles' },
  escalation: { label: 'aggravation' },
  maison: { label: 'arbitrage maison' },
  desc: { label: 'texte' },
  source: { label: 'source' },
});

/** Catégorie Codex de chaque document-table → son id, dans l'ordre de la donnée (LDB puis Aux Armes). */
const CATEGORIES = {
  criticalsTete: 'criticals-ldb-tete', criticalsBras: 'criticals-ldb-bras', criticalsCorps: 'criticals-ldb-corps', criticalsJambe: 'criticals-ldb-jambe',
  aaCriticalsTete: 'criticals-aa-tete', aaCriticalsBras: 'criticals-aa-bras', aaCriticalsCorps: 'criticals-aa-corps', aaCriticalsJambe: 'criticals-aa-jambe',
} as const;

const doc = document(
  'criticals',
  famille,
  {
    /** LDB 18 ; AA 07. */
    jeu: z.enum(['ldb', 'aa']),
    /** LDB 76 l.21. */
    localisation: critTableSchema,
  },
  {
    jeu: { label: 'Système de règles', hint: 'ldb = Traumatisme (LDB 18) ; aa = approche alternative (AA 07)' },
    localisation: { label: 'Localisation', hint: 'Famille de Localisation couverte par ce tableau' },
  },
  {
    codex: { keys: Object.keys(CATEGORIES) },
    edit: {
      niche: {
        categories: Object.fromEntries(
          Object.entries(CATEGORIES).map(([categorie, id]) => [categorie, suiteAvecPas(suiteAvecPas('', { cle: id }), { champ: 'entries' })]),
        ),
      },
    },
  },
  { rangee: critEntrySchema },
);

export const schema = doc.schema;
export const meta = doc.meta;

export const exposition = doc.exposition;
