import { nommerChamps } from '../grammaire/meta';
/** LDB 20. */
import { z } from 'zod';
import { document } from '../grammaire/document';
import { flowSchema, noeudTestFixe, passifsDe, sujetDuJetSchema, type SujetDuJet } from '../grammaire/mecanique';
import { idDe } from '../grammaire/ref';
import { diceSpecSchema, difficultySchema, enumNomme, symptomSeveritySchema } from '../grammaire/valeurs';

export const file = 'maladies.json';
export const famille = 'entite';

const diseaseTimeSchema = nommerChamps(z.strictObject({
  dice: diceSpecSchema,
  unit: enumNomme({ weeks: 'Semaines', days: 'Jours', hours: 'Heures', minutes: 'Minutes' }),
}), { dice: { label: 'dés' }, unit: { label: 'unité' } });

const diseaseSymptomSchema = nommerChamps(z.strictObject({
  symptomId: idDe('symptome'),
  severity: symptomSeveritySchema.optional(),
  difficulty: difficultySchema.optional(),
  spec: z.string().optional(),
}), {
  symptomId: { label: 'symptôme' },
  severity: { label: 'gravité' },
  difficulty: { label: 'difficulté' },
  spec: { label: 'spécialisation' },
});

const champs = {
  contractDifficulty: difficultySchema,
  testDeContraction: sujetDuJetSchema.optional(),
  incubation: diseaseTimeSchema,
  duration: diseaseTimeSchema,
  symptoms: z.array(diseaseSymptomSchema),
  /** LDB 20 l.127-129. */
  immuneAfterCure: z.boolean().optional(),
  /** MSRC 16 l.138. */
  infectionPassive: passifsDe().optional(),
  /** MDG 14 l.209. */
  contaminatesWaterBarrel: z.boolean().optional(),
  /** EDOC 08 l.104-108. */
  dailyTest: nommerChamps(z.strictObject({ test: noeudTestFixe(flowSchema, { echecSeulServi: true }), symptomId: idDe('symptome') }), { test: { label: 'Test' }, symptomId: { label: 'symptôme' } }).optional(),
  /** EDOC 08 l.122. */
  mutation: nommerChamps(z.strictObject({ afterDays: z.number(), into: idDe('maladie') }), { afterDays: { label: 'délai en jours' }, into: { label: 'maladie résultante' } }).optional(),
  /** MDG 14 l.232. */
  dureeAuFrais: z.boolean().optional(),
  /** EDOC 08 l.122. */
  reExposition: nommerChamps(z.strictObject({ prolonge: diseaseTimeSchema }), { prolonge: { label: 'prolongation' } }).optional(),
};

const doc = document(
  'maladies',
  famille,
  champs,
  {
    contractDifficulty: { label: 'Difficulté de contraction' },
    testDeContraction: { label: 'Sujet du Test de Contraction', hint: 'Résistance quand aucun autre Test n’est déclaré' },
    incubation: { label: 'Incubation', hint: 'Délai avant apparition des symptômes' },
    duration: { label: 'Durée', hint: 'Durée de la maladie' },
    symptoms: { label: 'Symptômes' },
    immuneAfterCure: { label: 'Immunise après guérison' },
    infectionPassive: { label: 'Effets passifs (infection)', hint: 'Effets actifs en continu tant que l’infection dure' },
    contaminatesWaterBarrel: { label: 'Contamine un baril d’eau' },
    dailyTest: { label: 'Test quotidien', hint: 'Jet porté par la maladie elle-même, roulé à chaque jour d’entretien (écart à EDOC 08 l.104, #674) ; sa branche d’échec porte la conséquence' },
    mutation: { label: 'Mue', hint: 'Au-delà de N jours de symptômes actifs, la maladie se transforme en une autre' },
    dureeAuFrais: { label: 'Durée décomptée aux vivres frais', hint: 'La Durée ne décroît que les jours où le porteur mange des vivres frais (MDG 14 l.232)' },
    reExposition: { label: 'Ré-exposition', hint: 'Ré-exposé à la cause de contraction alors qu’il la porte déjà : la durée se prolonge (EDOC 08 l.122)' },
  },
  {
    codex: { keys: ['maladies'] },
    edit: { dataset: 'maladies' },
  },
  {
    exiges: ['desc'],
    affinerEntree: (entree) => entree.refine(
      ({ testDeContraction }: { testDeContraction?: SujetDuJet }) =>
        !testDeContraction || testDeContraction.skill != null || testDeContraction.characteristic != null,
      { path: ['testDeContraction'], message: 'Nommer la Compétence ou la Caractéristique du Test de Contraction.' },
    ),
  },
);

export const schema = doc.schema;
export const meta = doc.meta;

export const exposition = doc.exposition;
export type DiseaseTime = z.infer<typeof diseaseTimeSchema>;
/** Instance de symptôme, par `z.input` : l'état d'une maladie portée (`Disease.symptoms`) porte des ids nus. */
export type DiseaseSymptom = z.input<typeof diseaseSymptomSchema>;
