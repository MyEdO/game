import { nommerChamps, metaDesChamps } from '../grammaire/meta';
/** MDG 15 l.309-436 */
import { z } from 'zod';
import { document } from '../grammaire/document';
import {
  catalogueSaisonnier,
  difficultySchema,
  dispoSaisonniereSchema,
  ecartsDeCouverture,
  plageOuverteSchema,
  prixSaisonnierSchema,
  prixTireSchema,
  sourceRefSchema,
} from '../grammaire/valeurs';
import { refOuSpec } from '../grammaire/ref';

export const file = 'sea-cargo.json';
export const famille = 'config';

/** Une CARGAISON ÉCHANGEABLE : disponibilité saisonnière + prix (tableau des cargaisons, l.406-434). */
const cargoMarchand = nommerChamps(z.strictObject({
  id: z.string(),
  label: z.string(),
  /** Discriminant du catalogue (`catalogueSaisonnier`) : `CargoDef.echangeable` (`src/engine/cargo.ts`). */
  echangeable: z.literal(true).optional(),
  avail: dispoSaisonniereSchema,
  price: z.union([prixSaisonnierSchema, prixTireSchema]),
  source: sourceRefSchema,
}), {
  id: { label: 'Identifiant' },
  label: { label: 'Libellé' },
  echangeable: { label: 'Échangeable' },
  avail: { label: 'Disponibilité' },
  price: { label: 'Prix' },
  source: { label: 'Source' },
});

/**
 * BANDES DU PRIX D'OFFRE (l.378-383) — la colonne « Richesse + Taille + Demande du Lieu » est un SEUIL,
 * donc une fourchette : la table s'énumère 1, 2, 3, puis « 4 ou plus », dernière bande sans plafond
 * (`plageOuverteSchema`). Le nom `sum` disait la formule qui produit l'entrée, pas ce que la colonne EST.
 *
 * La CONTIGUÏTÉ est un invariant du TABLEAU, pas d'une bande : sans elle, un trou ouvert au Codex ne
 * lèverait rien — `findTableEntry` (`src/engine/tables.ts`) replie sur la dernière bande, et une escale
 * misérable se verrait offrir le prix de base plein.
 */
const offerPriceSchema = z
  .array(nommerChamps(z.strictObject({ ...plageOuverteSchema.shape, pct: z.number() }), { ...metaDesChamps(plageOuverteSchema, { exigees: true }), pct: { label: 'Pourcentage' } }))
  .superRefine((bandes, ctx) => {
    const ecarts = ecartsDeCouverture(bandes, 1, 'ouverte', (b) => `la bande ${b.min}–${b.max ?? '+'} (${b.pct} %)`);
    if (ecarts.length) {
      ctx.addIssue({
        code: 'custom',
        message: `sea-cargo.json › sell.offerPrice : les bandes ne couvrent pas Richesse + Taille + Demande d'un seul tenant depuis 1 — ${ecarts.join(' ; ')}.`,
      });
    }
  });

/** MDG 15 l.321 */
const cargoMarqueur = nommerChamps(z.strictObject({
  id: z.string(),
  label: z.string(),
  echangeable: z.literal(false),
  /** Qualificatif d'affichage ÉDITABLE (« plaque tournante » / « rien à échanger ») — cf. `CargoMarkerDef`. */
  hint: z.string().optional(),
  /** MDG 15 l.321 */
  tradeHub: z.literal(true).optional(),
  source: sourceRefSchema,
}), {
  id: { label: 'Identifiant' },
  label: { label: 'Libellé' },
  echangeable: { label: 'Échangeable' },
  hint: { label: 'Aide' },
  tradeHub: { label: 'Centre de commerce' },
  source: { label: 'Source' },
});

/**
 * CATALOGUE DES CARGAISONS (l.406-418) — la COUVERTURE du d100 est un invariant de la COLONNE
 * saisonnière, pas d'une entrée : sans ce verrou, un trou ouvert au Codex ne lèverait rien au parse, et
 * le tirage tomberait sur un ARRÊT au jet (`rollSeasonalCargo`, `src/engine/cargo.ts`) — la faute
 * étant, elle, dans la donnée. La règle est celle des DEUX livres : elle vit dans la grammaire
 * (`catalogueSaisonnier`), ce def n'en déclare que ses entrées et le site cité par le refus.
 */
const cargoesSchema = catalogueSaisonnier(cargoMarchand, cargoMarqueur, { site: 'sea-cargo.json › cargoes' });

const doc = document(
  'sea-cargo',
  famille,
  {
  cargoes: cargoesSchema,
  buy: nommerChamps(z.strictObject({
    availabilityMultiplier: z.number(),
    merchantSkill: nommerChamps(z.strictObject({ d10: z.number(), plus: z.number() }), { d10: { label: 'Dés à dix faces' }, plus: { label: 'Ajout' } }),
    bigPortSkill: nommerChamps(z.strictObject({ d10: z.number(), plus: z.number() }), { d10: { label: 'Dés à dix faces' }, plus: { label: 'Ajout' } }),
    partialPurchaseSellerDR: z.number(),
    surplusSellerDR: z.number(),
    source: sourceRefSchema,
  }), {
    availabilityMultiplier: { label: 'Multiplicateur de disponibilité' },
    merchantSkill: { label: 'Compétence du marchand' },
    bigPortSkill: { label: 'Compétence dans un grand port' },
    partialPurchaseSellerDR: { label: 'DR du vendeur pour achat partiel' },
    surplusSellerDR: { label: 'DR du vendeur pour surplus' },
    source: { label: 'Source' },
  }),
  sell: nommerChamps(z.strictObject({
    offerPrice: offerPriceSchema,
    noProduceTargetPerSize: z.number(),
    commerceBonus: z.number(),
    producesGossip: nommerChamps(z.strictObject({ difficulty: difficultySchema, targetPerSize: z.number(), minMilles: z.number() }), {
      difficulty: { label: 'Difficulté' },
      targetPerSize: { label: 'Cible par taille' },
      minMilles: { label: 'Milles minimaux' },
    }),
    surplusGossip: nommerChamps(z.strictObject({ difficulty: difficultySchema, targetPerSize: z.number() }), { difficulty: { label: 'Difficulté' }, targetPerSize: { label: 'Cible par taille' } }),
    sellerDR: nommerChamps(z.strictObject({ noProduce: z.number(), demand: z.number(), produces: z.number(), surplus: z.number() }), {
      noProduce: { label: 'Absence de production' },
      demand: { label: 'Demande' },
      produces: { label: 'Production' },
      surplus: { label: 'Surplus' },
    }),
    dumpingPctOfBase: z.number(),
    source: sourceRefSchema,
  }), {
    offerPrice: { label: 'Prix proposé' },
    noProduceTargetPerSize: { label: 'Cible sans production par taille' },
    commerceBonus: { label: 'Bonus de Commerce' },
    producesGossip: { label: 'Ragot sur la production' },
    surplusGossip: { label: 'Ragot sur le surplus' },
    sellerDR: { label: 'DR du vendeur' },
    dumpingPctOfBase: { label: 'Prix de liquidation (% du prix de base)' },
    source: { label: 'Source' },
  }),
  overload: nommerChamps(z.strictObject({
    hardCapPct: z.number(),
    paliers: z.array(
      nommerChamps(z.strictObject({ id: z.string(), fromPct: z.number(), label: z.string(), mMod: z.number(), manoeuvreDR: z.number() }), {
        id: { label: 'Identifiant' },
        fromPct: { label: 'À partir de (%)' },
        label: { label: 'Libellé' },
        mMod: { label: 'Modificateur de Mouvement' },
        manoeuvreDR: { label: 'DR de manœuvre' },
      }),
    ),
    source: sourceRefSchema,
  }), {
    hardCapPct: { label: 'Limite absolue (%)' },
    paliers: { label: 'Paliers' },
    source: { label: 'Source' },
  }),
  opportunite: nommerChamps(z.strictObject({
    investMaxEnc: z.boolean(),
    test: nommerChamps(z.strictObject({
      skill: refOuSpec('skill'),
      difficulty: difficultySchema,
      totalDR: z.number(),
      maxAttempts: z.number(),
    }), {
      skill: { label: 'Compétence' },
      difficulty: { label: 'Difficulté' },
      totalDR: { label: 'DR cumulés' },
      maxAttempts: { label: 'Tentatives maximales' },
    }),
    outcomes: z.array(
      nommerChamps(z.strictObject({
        on: z.enum(['success', 'failure']),
        minMissing: z.number().optional(),
        minExtraDR: z.number().optional(),
        pct: z.number(),
      }), {
        on: { label: 'Cible' },
        minMissing: { label: 'Manque minimal' },
        minExtraDR: { label: 'DR supplémentaires minimaux' },
        pct: { label: 'Pourcentage' },
      }),
    ),
    source: sourceRefSchema,
  }), {
    investMaxEnc: { label: 'Investissement maximal (Enc)' },
    test: { label: 'Test' },
    outcomes: { label: 'Issues' },
    source: { label: 'Source' },
  }),
  },
  {
    cargoes: { label: 'Cargaisons', hint: 'Catalogue des cargaisons échangeables et des marqueurs de colonne Production' },
    buy: { label: "Règles d'achat", hint: 'Barème de Marchandage et bonus de disponibilité à l’achat' },
    sell: { label: 'Règles de vente', hint: 'Barème de prix, Ragot préalable, DR de camp du Marchandage de vente' },
    overload: { label: 'Surcharge', hint: 'Paliers de surcharge de cale (malus de Mouvement/manœuvre)' },
    opportunite: {
      label: "Commerce d'opportunité",
      hint: 'Test, nombre de tentatives et issues (%) du placement spéculatif de cargaison',
    },
  },
  {
    codex: { keys: ['seaCargo'] },
    edit: { niche: { categories: { seaCargo: 'cargoes' } } },
  },
);

export const schema = doc.schema;
export const meta = doc.meta;

export const exposition = doc.exposition;
