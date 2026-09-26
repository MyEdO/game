/**
 * Schéma de `sea-cargo.json` — COMMERCE MARITIME (MDG 15 l.309-436). Consommé par
 * `src/engine/seaVoyage.ts` (`CARGO as unknown as { ... }`, cast inline reflété ICI 1:1) : catalogue
 * de cargaisons (`CargoDef` — `src/engine/cargo.ts`), achat, vente, Commerce d'opportunité. `avail` =
 * plages d100 par saison (`Season`, `src/engine/travelStages.ts`) ; `price` = colonne par saison, ou
 * `{ dice }` (Vin maritime : 3d10, tiré une fois à l'achat).
 */
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
const cargoMarchand = z.strictObject({
  id: z.string(),
  label: z.string(),
  avail: dispoSaisonniereSchema,
  price: z.union([prixSaisonnierSchema, prixTireSchema]),
  source: sourceRefSchema,
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
  .array(z.strictObject({ ...plageOuverteSchema.shape, pct: z.number() }))
  .superRefine((bandes, ctx) => {
    const ecarts = ecartsDeCouverture(bandes, 1, 'ouverte', (b) => `la bande ${b.min}–${b.max ?? '+'} (${b.pct} %)`);
    if (ecarts.length) {
      ctx.addIssue({
        code: 'custom',
        message: `sea-cargo.json › sell.offerPrice : les bandes ne couvrent pas Richesse + Taille + Demande d'un seul tenant depuis 1 — ${ecarts.join(' ; ')}.`,
      });
    }
  });

/** Un MARQUEUR de la colonne Production de l'Index (« commerce », « minimum vital », MDG 15 l.321) :
 *  il occupe la même colonne que les cargaisons sans être une marchandise — donc ni disponibilité ni
 *  prix. `echangeable: false` est le champ d'EXCLUSION lu par le résolveur (`engine/seaVoyage.ts`),
 *  qui filtre le catalogue échangeable à la source ; une entrée marchande ne porte pas le champ. */
const cargoMarqueur = z.strictObject({
  id: z.string(),
  label: z.string(),
  echangeable: z.literal(false),
  /** Qualificatif d'affichage ÉDITABLE (« plaque tournante » / « rien à échanger ») — cf. `CargoMarkerDef`. */
  hint: z.string().optional(),
  /** Ce marqueur désigne une PLAQUE TOURNANTE du commerce (MDG 15 l.321) — lu par `isTradeHubEntry`
   *  (`engine/cargo.ts`) : tirage d'une cargaison au hasard, bonus de vente, bradage. */
  tradeHub: z.literal(true).optional(),
  source: sourceRefSchema,
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
  buy: z.strictObject({
    availabilityMultiplier: z.number(),
    merchantSkill: z.strictObject({ d10: z.number(), plus: z.number() }),
    bigPortSkill: z.strictObject({ d10: z.number(), plus: z.number() }),
    partialPurchaseSellerDR: z.number(),
    surplusSellerDR: z.number(),
    source: sourceRefSchema,
  }),
  sell: z.strictObject({
    offerPrice: offerPriceSchema,
    noProduceTargetPerSize: z.number(),
    commerceBonus: z.number(),
    producesGossip: z.strictObject({ difficulty: difficultySchema, targetPerSize: z.number(), minMilles: z.number() }),
    surplusGossip: z.strictObject({ difficulty: difficultySchema, targetPerSize: z.number() }),
    sellerDR: z.strictObject({ noProduce: z.number(), demand: z.number(), produces: z.number(), surplus: z.number() }),
    dumpingPctOfBase: z.number(),
    source: sourceRefSchema,
  }),
  overload: z.strictObject({
    hardCapPct: z.number(),
    paliers: z.array(
      z.strictObject({ id: z.string(), fromPct: z.number(), label: z.string(), mMod: z.number(), manoeuvreDR: z.number() }),
    ),
    source: sourceRefSchema,
  }),
  opportunite: z.strictObject({
    investMaxEnc: z.boolean(),
    test: z.strictObject({
      skill: refOuSpec('skill'),
      difficulty: difficultySchema,
      totalDR: z.number(),
      maxAttempts: z.number(),
    }),
    outcomes: z.array(
      z.strictObject({
        on: z.enum(['success', 'failure']),
        minMissing: z.number().optional(),
        minExtraDR: z.number().optional(),
        pct: z.number(),
      }),
    ),
    source: sourceRefSchema,
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
