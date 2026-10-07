import { nommerChamps } from '../grammaire/meta';
/** MDG 12 l.108-193 */
import { z } from 'zod';
import { document, type EnveloppeDocument } from '../grammaire/document';
import { ecartsDeCouverture, plageOuverteSchema, shipSizeSchema, sourceRefSchema } from '../grammaire/valeurs';
import { listeCle, marquerCollection, marqueDeListe } from '../grammaire/collection-cle';

export const file = 'ship-construction.json';
export const famille = 'config';

const propulsionRow = nommerChamps(z.strictObject({ m: z.number(), crew: z.number() }), { m: { label: 'Mouvement' }, crew: { label: 'Équipage' } });

const champs = {
  standard: marquerCollection(
    z.array(
      nommerChamps(z.strictObject({
        /** id STABLE = `size` (déjà une clé fermée à 7 valeurs) — identité d'entrée pour le Codex (#422). */
        id: z.string(),
        size: shipSizeSchema,
        costGold: z.number(),
        crew: z.number(),
        /** Absent pour les catégories non propulsables à la voile/à la rame (l.133). */
        sail: propulsionRow.optional(),
        oars: propulsionRow.optional(),
        /** Colonne « Taille » du tableau standard (l.122-129), en mètres : une FOURCHETTE `{min, max}`
         *  que `findTableEntry` (`src/engine/tables.ts`) lit. La dernière bande est OUVERTE — le livre
         *  imprime « 81+ » (l.129) et aucun plafond (`plageOuverteSchema`). */
        lengthM: plageOuverteSchema,
        e: z.number(),
        b: z.number(),
        capacity: z.number(),
        source: sourceRefSchema,
      }), {
        id: { label: 'Identifiant' },
        size: { label: 'Taille' },
        costGold: { label: 'Coût en couronnes d’or' },
        crew: { label: 'Équipage' },
        sail: { label: 'Voile' },
        oars: { label: 'Avirons' },
        lengthM: { label: 'Longueur (m)' },
        e: { label: 'Endurance' },
        b: { label: 'Extrémité d’arrivée' },
        capacity: { label: 'Capacité' },
        source: { label: 'Source' },
      }),
    ).superRefine((rangees, ctx) => {
      // CONTIGUÏTÉ des longueurs — invariant du TABLEAU, pas d'une rangée : une taille seule ne sait
      // pas si sa voisine commence là où elle s'arrête. Sans ce verrou, un trou ouvert au Codex ne
      // lèverait RIEN — `shipSizeOfLength` (`src/engine/shipBuild.ts`) lit la table par
      // `findTableEntry`, qui REPLIE sur la dernière bande : une chaloupe de 12 m serait Monstrueuse.
      const ecarts = ecartsDeCouverture(
        rangees.map((r) => ({ ...r.lengthM, size: r.size })),
        1,
        'ouverte',
        (f) => `la taille « ${f.size} » (${f.min}–${f.max ?? '+'} m)`,
      );
      if (ecarts.length) {
        ctx.addIssue({
          code: 'custom',
          message: `ship-construction.json › standard : les longueurs ne couvrent pas la colonne « Taille » d'un seul tenant depuis 1 m — ${ecarts.join(' ; ')}.`,
        });
      }
    }),
    marqueDeListe<{ id: string }>('id'),
  ),
  propulsion: nommerChamps(z.strictObject({ secondaryMalus: z.number(), secondaryMinM: z.number(), source: sourceRefSchema }), {
    secondaryMalus: { label: 'Malus du mode secondaire' },
    secondaryMinM: { label: 'Mouvement minimal du mode secondaire' },
    source: { label: 'Source' },
  }),
  manoeuvrability: z.array(nommerChamps(z.strictObject({ manDR: z.number(), costPct: z.number(), source: sourceRefSchema }), { manDR: { label: 'DR de manœuvre' }, costPct: { label: 'Coût (%)' }, source: { label: 'Source' } })),
  speedTraits: listeCle(
    nommerChamps(z.strictObject({
      id: z.string(),
      label: z.string(),
      mMod: z.number(),
      capacityPct: z.number(),
      manDR: z.number(),
      costPct: z.number(),
      source: sourceRefSchema,
    }), {
      id: { label: 'Identifiant' },
      label: { label: 'Libellé' },
      mMod: { label: 'Modificateur de Mouvement' },
      capacityPct: { label: 'Capacité (%)' },
      manDR: { label: 'DR de manœuvre' },
      costPct: { label: 'Coût (%)' },
      source: { label: 'Source' },
    }),
    'id',
  ),
  constructionTraits: listeCle(
    nommerChamps(z.strictObject({
      id: z.string(),
      maxLevel: z.number(),
      costPctPerLevel: z.number(),
      ePerLevel: z.number().optional(),
      bPctPerLevel: z.number().optional(),
      capacityPctPerLevel: z.number().optional(),
      source: sourceRefSchema,
    }), {
      id: { label: 'Identifiant' },
      maxLevel: { label: 'Niveau maximal' },
      costPctPerLevel: { label: 'Coût par niveau (%)' },
      ePerLevel: { label: 'Endurance par niveau' },
      bPctPerLevel: { label: 'Blessures par niveau (%)' },
      capacityPctPerLevel: { label: 'Capacité par niveau (%)' },
      source: { label: 'Source' },
    }),
    'id',
  ),
};

const doc = document(
  'ship-construction',
  famille,
  champs,
  {
    standard: { label: 'Caractéristiques standard', hint: 'Une ligne par taille de coque : coût, équipage, propulsion, gabarit, capacité' },
    propulsion: { label: 'Propulsion secondaire', hint: "Malus et Mouvement minimum d'une propulsion secondaire (rames sur voilier, etc.)" },
    manoeuvrability: { label: 'Manœuvrabilité', hint: 'Table DR de manœuvre vers surcoût de construction' },
    speedTraits: { label: 'Traits de vitesse', hint: 'Traits de coque agissant sur Mouvement/capacité/manœuvre/coût' },
    constructionTraits: { label: 'Traits de construction', hint: 'Traits de coque à paliers (E/Blindage/capacité par niveau)' },
  },
  {
    codex: { keys: ['shipHullSizes', 'shipSpeedTraits', 'shipConstructionTraits'] },
    edit: { niche: { categories: { shipHullSizes: 'standard', shipSpeedTraits: 'speedTraits', shipConstructionTraits: 'constructionTraits' } } },
  },
);

export const schema = doc.schema;
export const meta = doc.meta;
export const exposition = doc.exposition;
export type ShipConstructionData = EnveloppeDocument & z.infer<z.ZodObject<typeof champs>>;
