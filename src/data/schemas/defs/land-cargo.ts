import { nommerChamps, metaDesChamps } from '../grammaire/meta';

import { z } from 'zod';
import { document, tableTiree, type EnveloppeDocument } from '../grammaire/document';
import { refs } from '../grammaire/ref';
import {
  difficultySchema,
  ecartsDeCouverture,
  plageSchema,
  prixDuLivreSchema,
  sourceRefSchema,
} from '../grammaire/valeurs';

export const file = 'land-cargo.json';
export const famille = 'config';


const offreParRichesseSchema = z
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
        message: `land-cargo.json › vente.offreParRichesse : les bandes ne couvrent pas l'Indice de richesse 1 à 5 d'un seul tenant — ${ecarts.join(' ; ')}.`,
      });
    }
  });


const champs = {
  /** MSRC 13 l.91 */
  prixDuLivre: prixDuLivreSchema,
  /** MSRC 13 l.97 */
  qualiteDuVin: tableTiree(
    nommerChamps(z.strictObject({ ...plageSchema.shape, label: z.string(), price: z.number(), source: sourceRefSchema }), {
      ...metaDesChamps(plageSchema, { exigees: true }),
      label: { label: 'Libellé' },
      price: { label: 'Prix' },
      source: { label: 'Source' },
    }),
  ),
  achat: nommerChamps(z.strictObject({
    multiplicateurDeDisponibilite: z.number(),
    competenceDuMarchand: nommerChamps(z.strictObject({ d10: z.number(), plus: z.number() }), { d10: { label: 'Dés à dix faces' }, plus: { label: 'Ajout' } }),
    pctSurcoutPartiel: z.number(),
    encMin: z.number(),
    difficulteEvaluationVin: difficultySchema,
    difficulteEvaluationVinFacile: difficultySchema,
    seuilResistanceAlcool: z.number(),
    source: sourceRefSchema,
  }), {
    multiplicateurDeDisponibilite: { label: 'Multiplicateur de disponibilité' },
    competenceDuMarchand: { label: 'Compétence du marchand' },
    pctSurcoutPartiel: { label: 'Surcoût d’achat partiel (%)' },
    encMin: { label: 'Encombrement minimal' },
    difficulteEvaluationVin: { label: 'Difficulté d’évaluation du vin' },
    difficulteEvaluationVinFacile: { label: 'Difficulté d’évaluation facile du vin' },
    seuilResistanceAlcool: { label: 'Seuil de Résistance à l’alcool' },
    source: { label: 'Source' },
  }),
  vente: nommerChamps(z.strictObject({
    cibleParTaille: z.number(),
    bonusDeCommerce: z.number(),
    pctDeBradage: z.number(),
    offreParRichesse: offreParRichesseSchema,
    source: sourceRefSchema,
  }), {
    cibleParTaille: { label: 'Cible par taille' },
    bonusDeCommerce: { label: 'Bonus de Commerce' },
    pctDeBradage: { label: 'Prix de bradage (% du prix de base)' },
    offreParRichesse: { label: 'Mise à prix selon la Richesse' },
    source: { label: 'Source' },
  }),
  ragot: nommerChamps(z.strictObject({ difficulty: difficultySchema, mod: z.number(), source: sourceRefSchema }), {
    difficulty: { label: 'Difficulté' },
    mod: { label: 'Modificateur' },
    source: { label: 'Source' },
  }),
  /** MSRC 13 l.283 */
  rumeurs: tableTiree(
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
    prixDuLivre: { label: 'Unité du prix du livre', hint: 'Points d’Encombrement que couvre un prix de base du livre' },
    qualiteDuVin: {
      label: 'Qualité du vin',
      hint: "Table secrète de prix du Vin/Eau-de-vie, tirée à part de la colonne saisonnière",
    },
    achat: { label: "Règles d'achat", hint: 'Barème de Marchandage, disponibilité, seuils de dégustation du vin' },
    vente: { label: 'Règles de vente', hint: 'Cible de production, bonus de Commerce, bradage, offre par richesse du lieu' },
    ragot: { label: 'Ragot', hint: 'Difficulté et modificateur du Test de Ragot préalable à la vente' },
    rumeurs: { label: 'Rumeurs', hint: 'Table de tirage de rumeurs commerciales' },
  },
  { codex: { keys: ['landCargo'] }, edit: { object: 'unique' } },
);

export const schema = doc.schema;
export const meta = doc.meta;

export const exposition = doc.exposition;
export type LandCargoData = EnveloppeDocument & z.infer<z.ZodObject<typeof champs>>;
