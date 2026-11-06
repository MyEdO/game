import { nommerChamps, metaDesChamps } from '../grammaire/meta';

import { z } from 'zod';
import { document, type EnveloppeDocument } from '../grammaire/document';
import { refs } from '../grammaire/ref';
import {
  difficultySchema,
  ecartsDeCouverture,
  plageSchema,
  sourceRefSchema,
} from '../grammaire/valeurs';

export const file = 'land-cargo.json';
export const famille = 'config';


const offerByRichesseSchema = z
  .array(nommerChamps(z.strictObject({ ...plageSchema.shape, label: z.string(), pct: z.number() }), {
    ...metaDesChamps(plageSchema, { exigees: true }),
    label: { label: 'Libellé' },
    pct: { label: 'Pourcentage' },
  }))
  .superRefine((bandes, ctx) => {
    const ecarts = ecartsDeCouverture(bandes, 1, 5, (b) => `la bande ${b.min}–${b.max} (« ${b.label} »)`);
    if (ecarts.length) {
      ctx.addIssue({
        code: 'custom',
        message: `land-cargo.json › sell.offerByRichesse : les bandes ne couvrent pas l'Indice de richesse 1 à 5 d'un seul tenant — ${ecarts.join(' ; ')}.`,
      });
    }
  });


const champs = {
  wineQuality: z.array(
    nommerChamps(z.strictObject({ ...plageSchema.shape, label: z.string(), price: z.number(), source: sourceRefSchema }), {
      ...metaDesChamps(plageSchema, { exigees: true }),
      label: { label: 'Libellé' },
      price: { label: 'Prix' },
      source: { label: 'Source' },
    }),
  ),
  buy: nommerChamps(z.strictObject({
    availabilityMultiplier: z.number(),
    merchantSkill: nommerChamps(z.strictObject({ d10: z.number(), plus: z.number() }), { d10: { label: 'Dés à dix faces' }, plus: { label: 'Ajout' } }),
    partialSurchargePct: z.number(),
    minEnc: z.number(),
    wineEvalDifficulty: difficultySchema,
    wineEvalEasyDifficulty: difficultySchema,
    wineAlcoholResistThreshold: z.number(),
    source: sourceRefSchema,
  }), {
    availabilityMultiplier: { label: 'Multiplicateur de disponibilité' },
    merchantSkill: { label: 'Compétence du marchand' },
    partialSurchargePct: { label: 'Surcoût d’achat partiel (%)' },
    minEnc: { label: 'Encombrement minimal' },
    wineEvalDifficulty: { label: 'Difficulté d’évaluation du vin' },
    wineEvalEasyDifficulty: { label: 'Difficulté d’évaluation facile du vin' },
    wineAlcoholResistThreshold: { label: 'Seuil de Résistance à l’alcool' },
    source: { label: 'Source' },
  }),
  sell: nommerChamps(z.strictObject({
    targetPerSize: z.number(),
    commerceBonus: z.number(),
    dumpingPctOfBase: z.number(),
    offerByRichesse: offerByRichesseSchema,
    source: sourceRefSchema,
  }), {
    targetPerSize: { label: 'Cible par taille' },
    commerceBonus: { label: 'Bonus de Commerce' },
    dumpingPctOfBase: { label: 'Prix de bradage (% du prix de base)' },
    offerByRichesse: { label: 'Mise à prix selon la Richesse' },
    source: { label: 'Source' },
  }),
  gossip: nommerChamps(z.strictObject({ difficulty: difficultySchema, mod: z.number(), source: sourceRefSchema }), {
    difficulty: { label: 'Difficulté' },
    mod: { label: 'Modificateur' },
    source: { label: 'Source' },
  }),
  rumours: z.array(
    nommerChamps(z.strictObject({
      ...plageSchema.shape,
      biens: refs('cargo', { sousListe: 'terre' }),
      /** Prose de la rumeur — `desc`, la cible du rôle prose de l'enveloppe. Ces rangées n'ont pas de
       *  `label` : elles sortent du DÉNOMINATEUR du détecteur de structures, qui ne mesure que les
       *  entrées de racine. Une graphie divergente ne survit pas parce qu'elle est hors mesure — c'est
       *  le MÊME concept que les autres proses, donc la même clé. */
      desc: z.string(),
      source: sourceRefSchema,
    }), {
      ...metaDesChamps(plageSchema, { exigees: true }),
      biens: { label: 'Biens' },
      desc: { label: 'Texte' },
      source: { label: 'Source' },
    }),
  ),
};

const doc = document(
  'land-cargo',
  famille,
  champs,
  {
    wineQuality: {
      label: 'Qualité du vin',
      hint: "Table secrète de prix du Vin/Eau-de-vie, tirée à part de la colonne saisonnière",
    },
    buy: { label: "Règles d'achat", hint: 'Barème de Marchandage, disponibilité, seuils de dégustation du vin' },
    sell: { label: 'Règles de vente', hint: 'Cible de production, bonus de Commerce, bradage, offre par richesse du lieu' },
    gossip: { label: 'Ragot', hint: 'Difficulté et modificateur du Test de Ragot préalable à la vente' },
    rumours: { label: 'Rumeurs', hint: 'Table de tirage d100 de rumeurs commerciales' },
  },
  { codex: { keys: ['landCargo'] }, edit: { object: 'single' } },
);

export const schema = doc.schema;
export const meta = doc.meta;

export const exposition = doc.exposition;
export type LandCargoData = EnveloppeDocument & z.infer<z.ZodObject<typeof champs>>;
