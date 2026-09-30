/**
 * Schéma de `land-cargo.json` — COMMERCE TERRESTRE & FLUVIAL (Mort sur le Reik Compagnon ch.11
 * « Règles du commerce », p.70-78). Consommé par `src/engine/landCargo.ts` (`LAND as unknown as
 * { ... }`, cast inline reflété ICI 1:1). `wine: true` marque le Vin/Eau-de-vie (prix par la table de
 * qualité SECRÈTE `wineQuality`, pas par la colonne saisonnière). La racine est NUE : chaque
 * sous-entrée porte son `source` (`src/data/source-racine-aveugle.test.ts`).
 */
import { z } from 'zod';
import { document } from '../grammaire/document';
import {
  catalogueSaisonnier,
  difficultySchema,
  dispoSaisonniereSchema,
  ecartsDeCouverture,
  plageSchema,
  prixSaisonnierSchema,
  prixTireSchema,
  sourceRefSchema,
} from '../grammaire/valeurs';

export const file = 'land-cargo.json';
export const famille = 'config';

/**
 * BANDES DE LA MISE À PRIX (l.148-156) — la colonne « Richesse de l'emplacement » est un INDICE (l.52-60 :
 * 1 à 5), et la table en donne une ligne par valeur : cinq bandes d'un point, FERMÉES aux deux bouts (le
 * livre n'écrit ici aucun « ou plus », contrairement à son homologue maritime). Le nom `richesse` disait
 * ce que la colonne CONTIENT ; la fourchette dit ce qu'elle est, et `findTableEntry` la lit.
 *
 * La CONTIGUÏTÉ est un invariant du TABLEAU : un trou ouvert au Codex ne lèverait rien — le lookup
 * replie, et un lieu misérable se verrait offrir la prime d'un lieu prospère.
 */
const offerByRichesseSchema = z
  .array(z.strictObject({ ...plageSchema.shape, label: z.string(), pct: z.number() }))
  .superRefine((bandes, ctx) => {
    const ecarts = ecartsDeCouverture(bandes, 1, 5, (b) => `la bande ${b.min}–${b.max} (« ${b.label} »)`);
    if (ecarts.length) {
      ctx.addIssue({
        code: 'custom',
        message: `land-cargo.json › sell.offerByRichesse : les bandes ne couvrent pas l'Indice de richesse 1 à 5 d'un seul tenant — ${ecarts.join(' ; ')}.`,
      });
    }
  });

/** Une CARGAISON ÉCHANGEABLE : disponibilité saisonnière + prix (l.71-89). */
const cargoMarchand = z.strictObject({
  id: z.string(),
  label: z.string(),
  /** Discriminant du catalogue (`catalogueSaisonnier`) : `CargoDef.echangeable` (`src/engine/cargo.ts`). */
  echangeable: z.literal(true).optional(),
  /** Vin/Eau-de-vie : prix par `wineQuality`, pas par la colonne saisonnière (l.93-104). */
  wine: z.boolean().optional(),
  avail: dispoSaisonniereSchema,
  price: z.union([prixSaisonnierSchema, prixTireSchema]),
  source: sourceRefSchema,
});

/** Un MARQUEUR de la colonne Produits de l'Index (« Commerce », « Subsistance », MSRC 13 l.24-28 et
 *  l.119) : il occupe la même colonne que les cargaisons sans être une marchandise — donc ni
 *  disponibilité ni prix. `echangeable: false` est le champ d'EXCLUSION lu par le résolveur
 *  (`engine/landCargo.ts`), qui filtre le catalogue échangeable à la source ; une entrée marchande ne
 *  le porte pas `false`. */
const cargoMarqueur = z.strictObject({
  id: z.string(),
  label: z.string(),
  echangeable: z.literal(false),
  /** Qualificatif d'affichage ÉDITABLE (« plaque tournante » / « rien à échanger ») — cf. `CargoMarkerDef`. */
  hint: z.string().optional(),
  /** Ce marqueur désigne une PLAQUE TOURNANTE du commerce (MSRC 13 l.24-28) — lu par `isTradeHubEntry`
   *  (`engine/cargo.ts`) : double recherche de marchand, quantité inversée, bonus de vente, bradage. */
  tradeHub: z.literal(true).optional(),
  source: sourceRefSchema,
});

/**
 * CATALOGUE DES CARGAISONS (l.73-78) — la COUVERTURE du d100 est un invariant de la COLONNE
 * saisonnière, pas d'une entrée : sans ce verrou, un trou ouvert au Codex ne lèverait rien au parse, et
 * le tirage tomberait sur un ARRÊT au jet (`rollSeasonalCargo`, `src/engine/cargo.ts`) — la faute
 * étant, elle, dans la donnée. La règle est celle des DEUX livres : elle vit dans la grammaire
 * (`catalogueSaisonnier`), ce def n'en déclare que ses entrées et le site cité par le refus.
 */
const cargoesSchema = catalogueSaisonnier(cargoMarchand, cargoMarqueur, { site: 'land-cargo.json › cargoes' });

const doc = document(
  'land-cargo',
  famille,
  {
  cargoes: cargoesSchema,
  wineQuality: z.array(
    z.strictObject({ ...plageSchema.shape, label: z.string(), price: z.number(), source: sourceRefSchema }),
  ),
  buy: z.strictObject({
    availabilityMultiplier: z.number(),
    merchantSkill: z.strictObject({ d10: z.number(), plus: z.number() }),
    partialSurchargePct: z.number(),
    minEnc: z.number(),
    wineEvalDifficulty: difficultySchema,
    wineEvalEasyDifficulty: difficultySchema,
    wineAlcoholResistThreshold: z.number(),
    source: sourceRefSchema,
  }),
  sell: z.strictObject({
    targetPerSize: z.number(),
    commerceBonus: z.number(),
    dumpingPctOfBase: z.number(),
    offerByRichesse: offerByRichesseSchema,
    source: sourceRefSchema,
  }),
  gossip: z.strictObject({ difficulty: difficultySchema, mod: z.number(), source: sourceRefSchema }),
  rumours: z.array(
    z.strictObject({
      ...plageSchema.shape,
      biens: z.array(z.string()),
      /** Prose de la rumeur — `desc`, la cible du rôle prose de l'enveloppe. Ces rangées n'ont pas de
       *  `label` : elles sortent du DÉNOMINATEUR du détecteur de structures, qui ne mesure que les
       *  entrées de racine. Une graphie divergente ne survit pas parce qu'elle est hors mesure — c'est
       *  le MÊME concept que les autres proses, donc la même clé. */
      desc: z.string(),
      source: sourceRefSchema,
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
