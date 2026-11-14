import { nommerChamps, metaDesChamps } from '../grammaire/meta';
/** MDG 15 l.309-436 */
import { z } from 'zod';
import { document } from '../grammaire/document';
import {
  cibleEtendueSchema,
  difficultySchema,
  ecartsDeCouverture,
  enumNomme,
  plageOuverteSchema,
  prixDuLivreSchema,
  sourceRefSchema,
} from '../grammaire/valeurs';
import { flowTestSchema, porteurDeTestFixe } from '../grammaire/mecanique';

export const file = 'sea-cargo.json';
export const famille = 'config';

/**
 * BANDES DU PRIX D'OFFRE (l.378-383) — la colonne « Richesse + Taille + Demande du Lieu » est un SEUIL,
 * donc une fourchette : la table s'énumère 1, 2, 3, puis « 4 ou plus », dernière bande sans plafond
 * (`plageOuverteSchema`). Le nom `sum` disait la formule qui produit l'entrée, pas ce que la colonne EST.
 *
 * La CONTIGUÏTÉ est un invariant du TABLEAU, pas d'une bande : sans elle, un trou ouvert au Codex ne
 * lèverait rien — `findTableEntry` (`src/engine/tables.ts`) replie sur la dernière bande, et une escale
 * misérable se verrait offrir le prix de base plein.
 */
const prixDOffreSchema = z
  .array(nommerChamps(z.strictObject({ ...plageOuverteSchema.shape, pct: z.number() }), { ...metaDesChamps(plageOuverteSchema, { exigees: true }), pct: { label: 'Pourcentage' } }))
  .superRefine((bandes, ctx) => {
    const ecarts = ecartsDeCouverture(bandes, 1, 'ouverte', (b) => `la bande ${b.min}–${b.max ?? '+'} (${b.pct} %)`);
    if (ecarts.length) {
      ctx.addIssue({
        code: 'custom',
        message: `sea-cargo.json › vente.prixDOffre : les bandes ne couvrent pas Richesse + Taille + Demande d'un seul tenant depuis 1 — ${ecarts.join(' ; ')}.`,
      });
    }
  });

/** MDG 15 l.274-286 */
export const issueDuTestSchema = enumNomme({ reussite: 'Succès', echec: 'Échec' });

const champs = {
  /** MDG 15 l.436 */
  prixDuLivre: prixDuLivreSchema,
  achat: nommerChamps(z.strictObject({
    multiplicateurDeDisponibilite: z.number(),
    competenceDuMarchand: nommerChamps(z.strictObject({ d10: z.number(), plus: z.number() }), { d10: { label: 'Dés à dix faces' }, plus: { label: 'Ajout' } }),
    competenceGrandPort: nommerChamps(z.strictObject({ d10: z.number(), plus: z.number() }), { d10: { label: 'Dés à dix faces' }, plus: { label: 'Ajout' } }),
    drVendeurAchatPartiel: z.number(),
    drVendeurSurplus: z.number(),
    source: sourceRefSchema,
  }), {
    multiplicateurDeDisponibilite: { label: 'Multiplicateur de disponibilité' },
    competenceDuMarchand: { label: 'Compétence du marchand' },
    competenceGrandPort: { label: 'Compétence dans un grand port' },
    drVendeurAchatPartiel: { label: 'DR du vendeur pour achat partiel' },
    drVendeurSurplus: { label: 'DR du vendeur pour surplus' },
    source: { label: 'Source' },
  }),
  vente: nommerChamps(z.strictObject({
    prixDOffre: prixDOffreSchema,
    cibleParTailleSansProduction: z.number(),
    bonusDeCommerce: z.number(),
    ragotSiProduction: nommerChamps(z.strictObject({ difficulty: difficultySchema, cibleParTaille: z.number(), millesMin: z.number() }), {
      difficulty: { label: 'Difficulté' },
      cibleParTaille: { label: 'Cible par taille' },
      millesMin: { label: 'Milles minimaux' },
    }),
    ragotSiSurplus: nommerChamps(z.strictObject({ difficulty: difficultySchema, cibleParTaille: z.number() }), { difficulty: { label: 'Difficulté' }, cibleParTaille: { label: 'Cible par taille' } }),
    drDuVendeur: nommerChamps(z.strictObject({ sansProduction: z.number(), demande: z.number(), production: z.number(), surplus: z.number() }), {
      sansProduction: { label: 'Absence de production' },
      demande: { label: 'Demande' },
      production: { label: 'Production' },
      surplus: { label: 'Surplus' },
    }),
    pctDeBradage: z.number(),
    source: sourceRefSchema,
  }), {
    prixDOffre: { label: 'Prix proposé' },
    cibleParTailleSansProduction: { label: 'Cible sans production par taille' },
    bonusDeCommerce: { label: 'Bonus de Commerce' },
    ragotSiProduction: { label: 'Ragot sur la production' },
    ragotSiSurplus: { label: 'Ragot sur le surplus' },
    drDuVendeur: { label: 'DR du vendeur' },
    pctDeBradage: { label: 'Prix de liquidation (% du prix de base)' },
    source: { label: 'Source' },
  }),
  surcharge: nommerChamps(z.strictObject({
    pctPlafond: z.number(),
    paliers: z.array(
      nommerChamps(z.strictObject({ id: z.string(), pctDepuis: z.number(), label: z.string(), mMod: z.number(), drDeManoeuvre: z.number() }), {
        id: { label: 'Identifiant' },
        pctDepuis: { label: 'À partir de (%)' },
        label: { label: 'Libellé' },
        mMod: { label: 'Modificateur de Mouvement' },
        drDeManoeuvre: { label: 'DR de manœuvre' },
      }),
    ),
    source: sourceRefSchema,
  }), {
    pctPlafond: { label: 'Limite absolue (%)' },
    paliers: { label: 'Paliers' },
    source: { label: 'Source' },
  }),
  opportunite: nommerChamps(porteurDeTestFixe(z.strictObject({
    encInvestiMax: z.boolean(),
    test: flowTestSchema,
    ...cibleEtendueSchema.shape,
    tentativesMax: z.number(),
    outcomes: z.array(
      nommerChamps(z.strictObject({
        on: issueDuTestSchema,
        manquantMin: z.number().optional(),
        drSupplementaireMin: z.number().optional(),
        pct: z.number(),
      }), {
        on: { label: 'Issue du Test' },
        manquantMin: { label: 'Manque minimal' },
        drSupplementaireMin: { label: 'DR supplémentaires minimaux' },
        pct: { label: 'Pourcentage' },
      }),
    ),
    source: sourceRefSchema,
  }), 'skill', 'difficulty'), {
    encInvestiMax: { label: 'Investissement maximal (Enc)' },
    test: { label: 'Test' },
    ...metaDesChamps(cibleEtendueSchema, { exigees: true }),
    tentativesMax: { label: 'Tentatives maximales' },
    outcomes: { label: 'Issues' },
    source: { label: 'Source' },
  }),
};

const doc = document(
  'sea-cargo',
  famille,
  champs,
  {
    prixDuLivre: { label: 'Unité du prix du livre', hint: 'Points d’Encombrement que couvre un prix de base du livre' },
    achat: { label: "Règles d'achat", hint: 'Barème de Marchandage et bonus de disponibilité à l’achat' },
    vente: { label: 'Règles de vente', hint: 'Barème de prix, Ragot préalable, DR de camp du Marchandage de vente' },
    surcharge: { label: 'Surcharge', hint: 'Paliers de surcharge de cale (malus de Mouvement/manœuvre)' },
    opportunite: {
      label: "Commerce d'opportunité",
      hint: 'Test, nombre de tentatives et issues (%) du placement spéculatif de cargaison',
    },
  },
  { codex: { keys: ['seaCargo'] }, edit: { object: 'unique' } },
);

export const schema = doc.schema;
export const meta = doc.meta;

export const exposition = doc.exposition;
