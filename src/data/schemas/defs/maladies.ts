import { nommerChamps } from '../grammaire/meta';
/** LDB 20. */
import { z } from 'zod';
import { document } from '../grammaire/document';
import { flowSchema, gameOpSchema, noeudTest } from '../grammaire/mecanique';
import { idDe } from '../grammaire/ref';
import { diceSpecSchema, symptomSeveritySchema } from '../grammaire/valeurs';

export const file = 'maladies.json';
export const famille = 'entite';

const diseaseTimeSchema = nommerChamps(z.strictObject({
  dice: diceSpecSchema,
  unit: z.enum(['days', 'hours', 'minutes']),
}), { dice: { label: 'dés' }, unit: { label: 'unité' } });

const diseaseSymptomSchema = nommerChamps(z.strictObject({
  symptomId: z.string(),
  severity: symptomSeveritySchema.optional(),
  difficulty: z.string().optional(),
  spec: z.string().optional(),
}), {
  symptomId: { label: 'symptôme' },
  severity: { label: 'gravité' },
  difficulty: { label: 'difficulté' },
  spec: { label: 'spécialisation' },
});

const doc = document(
  'maladies',
  famille,
  {
    contractDifficulty: z.string(),
    incubation: diseaseTimeSchema,
    duration: diseaseTimeSchema,
    symptoms: z.array(diseaseSymptomSchema),
    /** LDB 20 l.127-129. */
    immuneAfterCure: z.boolean().optional(),
    /** MSRC 16 l.138. */
    infectionPassive: z.array(gameOpSchema).optional(),
    /** MDG 14 l.209. */
    contaminatesWaterBarrel: z.boolean().optional(),
    /** EDOC 08 l.104-108. */
    dailyTest: nommerChamps(z.strictObject({ test: noeudTest(flowSchema, { difficulteRequise: true, echecSeulServi: true }), symptomId: z.string() }), { test: { label: 'Test' }, symptomId: { label: 'symptôme' } }).optional(),
    /** EDOC 08 l.122. */
    mutation: nommerChamps(z.strictObject({ afterDays: z.number(), into: idDe('maladie') }), { afterDays: { label: 'délai en jours' }, into: { label: 'maladie résultante' } }).optional(),
    /** EDOC 08 l.122. */
    reExposition: nommerChamps(z.strictObject({ prolonge: diseaseTimeSchema }), { prolonge: { label: 'prolongation' } }).optional(),
  },
  {
    contractDifficulty: { label: 'Difficulté de contraction' },
    incubation: { label: 'Incubation', hint: 'Délai avant apparition des symptômes' },
    duration: { label: 'Durée', hint: 'Durée de la maladie' },
    symptoms: { label: 'Symptômes' },
    immuneAfterCure: { label: 'Immunise après guérison' },
    infectionPassive: { label: 'Effets passifs (infection)', hint: 'Effets actifs en continu tant que l’infection dure' },
    contaminatesWaterBarrel: { label: 'Contamine un baril d’eau' },
    dailyTest: { label: 'Test quotidien', hint: 'Jet porté par la maladie elle-même, roulé à chaque jour d’entretien (écart à EDOC 08 l.104, #674) ; sa branche d’échec porte la conséquence' },
    mutation: { label: 'Mue', hint: 'Au-delà de N jours de symptômes actifs, la maladie se transforme en une autre' },
    reExposition: { label: 'Ré-exposition', hint: 'Ré-exposé à la cause de contraction alors qu’il la porte déjà : la durée se prolonge (EDOC 08 l.122)' },
  },
  {
    codex: { keys: ['maladies'] },
    edit: { dataset: 'maladies' },
  },
  { exiges: ['desc'] },
);

export const schema = doc.schema;
export const meta = doc.meta;

export const exposition = doc.exposition;
