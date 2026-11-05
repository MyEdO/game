import { nommerChamps, metaDesChamps } from '../grammaire/meta';

import { z } from 'zod';
import { document } from '../grammaire/document';
import { refs } from '../grammaire/ref';
import {
  cargaisonMarchandeSchema,
  catalogueSaisonnier,
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
    label: { label: 'libellé' },
    pct: { label: 'pourcentage' },
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


/** MSRC 13 l.93-104 */
const cargoMarchand = nommerChamps(z.strictObject({ ...cargaisonMarchandeSchema.shape, wine: z.boolean().optional() }), {
  ...metaDesChamps(cargaisonMarchandeSchema, { exigees: true }),
  wine: { label: 'Vin' },
});

const cargoesSchema = catalogueSaisonnier(cargoMarchand, { site: 'land-cargo.json › cargoes' });

const doc = document(
  'land-cargo',
  famille,
  {
  cargoes: cargoesSchema,
  wineQuality: z.array(
    nommerChamps(z.strictObject({ ...plageSchema.shape, label: z.string(), price: z.number(), source: sourceRefSchema }), {
      ...metaDesChamps(plageSchema, { exigees: true }),
      label: { label: 'libellé' },
      price: { label: 'prix' },
      source: { label: 'source' },
    }),
  ),
  buy: nommerChamps(z.strictObject({
    availabilityMultiplier: z.number(),
    merchantSkill: nommerChamps(z.strictObject({ d10: z.number(), plus: z.number() }), { d10: { label: 'dés à dix faces' }, plus: { label: 'ajout' } }),
    partialSurchargePct: z.number(),
    minEnc: z.number(),
    wineEvalDifficulty: difficultySchema,
    wineEvalEasyDifficulty: difficultySchema,
    wineAlcoholResistThreshold: z.number(),
    source: sourceRefSchema,
  }), {
    availabilityMultiplier: { label: 'multiplicateur de disponibilité' },
    merchantSkill: { label: 'Compétence du marchand' },
    partialSurchargePct: { label: 'surcharge partielle en pourcentage' },
    minEnc: { label: 'encombrement minimal' },
    wineEvalDifficulty: { label: 'difficulté d’évaluation du vin' },
    wineEvalEasyDifficulty: { label: 'difficulté d’évaluation facile du vin' },
    wineAlcoholResistThreshold: { label: 'seuil de Résistance à l’alcool' },
    source: { label: 'source' },
  }),
  sell: nommerChamps(z.strictObject({
    targetPerSize: z.number(),
    commerceBonus: z.number(),
    dumpingPctOfBase: z.number(),
    offerByRichesse: offerByRichesseSchema,
    source: sourceRefSchema,
  }), {
    targetPerSize: { label: 'cible par taille' },
    commerceBonus: { label: 'bonus de commerce' },
    dumpingPctOfBase: { label: 'prix de bradage en pourcentage' },
    offerByRichesse: { label: 'offre selon la richesse' },
    source: { label: 'source' },
  }),
  gossip: nommerChamps(z.strictObject({ difficulty: difficultySchema, mod: z.number(), source: sourceRefSchema }), {
    difficulty: { label: 'difficulté' },
    mod: { label: 'modificateur' },
    source: { label: 'source' },
  }),
  rumours: z.array(
    nommerChamps(z.strictObject({
      ...plageSchema.shape,
      biens: refs('landCargo'),
      /** Prose de la rumeur — `desc`, la cible du rôle prose de l'enveloppe. Ces rangées n'ont pas de
       *  `label` : elles sortent du DÉNOMINATEUR du détecteur de structures, qui ne mesure que les
       *  entrées de racine. Une graphie divergente ne survit pas parce qu'elle est hors mesure — c'est
       *  le MÊME concept que les autres proses, donc la même clé. */
      desc: z.string(),
      source: sourceRefSchema,
    }), {
      ...metaDesChamps(plageSchema, { exigees: true }),
      biens: { label: 'biens' },
      desc: { label: 'texte' },
      source: { label: 'source' },
    }),
  ),
  },
  {
    cargoes: {
      label: 'Cargaisons',
      hint: 'Catalogue des cargaisons terrestres/fluviales échangeables et des marqueurs de colonne Produits',
    },
    wineQuality: {
      label: 'Qualité du vin',
      hint: "Table secrète de prix du Vin/Eau-de-vie, tirée à part de la colonne saisonnière",
    },
    buy: { label: "Règles d'achat", hint: 'Barème de Marchandage, disponibilité, seuils de dégustation du vin' },
    sell: { label: 'Règles de vente', hint: 'Cible de production, bonus de Commerce, bradage, offre par richesse du lieu' },
    gossip: { label: 'Ragot', hint: 'Difficulté et modificateur du Test de Ragot préalable à la vente' },
    rumours: { label: 'Rumeurs', hint: 'Table de tirage d100 de rumeurs commerciales' },
  },
  {
    codex: { keys: ['landCargo'] },
    edit: { niche: { categories: { landCargo: 'cargoes' } } },
  },
);

export const schema = doc.schema;
export const meta = doc.meta;

export const exposition = doc.exposition;
