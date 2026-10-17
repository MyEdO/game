import { nommerChamps } from '../grammaire/meta';
/** MDG 13 l.423-564 */
import { z } from 'zod';
import { document, type EnveloppeDocument } from '../grammaire/document';
import { charKeySchema, difficultySchema, shipSizeSchema, sourceRefSchema } from '../grammaire/valeurs';
import { refOuSpec } from '../grammaire/ref';

export const file = 'sea-perils.json';
export const famille = 'config';

/** `SeaHazardDef` (`src/engine/seaPerils.ts`). */
const seaHazardDef = nommerChamps(z.strictObject({
  id: z.string(),
  label: z.string(),
  m: z.number().optional(),
  ic: z.number(),
  strandChancePct: z.number().optional(),
  entangleChancePct: z.number().optional(),
  entanglePenalties: z
    .array(
      nommerChamps(z.strictObject({
        minSize: shipSizeSchema.optional(),
        maxSize: shipSizeSchema.optional(),
        manDR: z.number(),
        mMod: z.number(),
      }), {
        minSize: { label: 'Taille minimale' },
        maxSize: { label: 'Taille maximale' },
        manDR: { label: 'DR de manœuvre' },
        mMod: { label: 'Modificateur de Mouvement' },
      }),
    )
    .optional(),
  freeTest: nommerChamps(z.strictObject({ skill: refOuSpec('skill').optional(), char: charKeySchema.optional(), difficulty: difficultySchema, totalDR: z.number() }), {
    skill: { label: 'Compétence' },
    char: { label: 'Caractéristique' },
    difficulty: { label: 'Difficulté' },
    totalDR: { label: 'DR cumulés' },
  }).optional(),
  desc: z.string(),
  source: sourceRefSchema,
  /** Poids du tirage de collision (#444) — MAISON, cf. `hazardsWeightNote` ci-dessous. */
  weight: z.number().optional(),
}), {
  id: { label: 'Identifiant' },
  label: { label: 'Libellé' },
  m: { label: 'Mouvement' },
  ic: { label: 'Indice de Critique' },
  strandChancePct: { label: 'Risque d’échouage (%)' },
  entangleChancePct: { label: 'Risque d’enchevêtrement (%)' },
  entanglePenalties: { label: 'Pénalités d’enchevêtrement' },
  freeTest: { label: 'Test de libération' },
  desc: { label: 'Description' },
  source: { label: 'Source' },
  weight: { label: 'Pondération du tirage' },
});

/** `StraitDef` (`src/engine/seaPerils.ts`). */
const straitDef = nommerChamps(z.strictObject({
  id: z.string(),
  label: z.string(),
  m: z.number(),
  navDR: z.number(),
  source: sourceRefSchema,
}), {
  id: { label: 'Identifiant' },
  label: { label: 'Libellé' },
  m: { label: 'Mouvement' },
  navDR: { label: 'DR de Navigation' },
  source: { label: 'Source' },
});

/** `WhirlpoolDef` (`src/engine/seaPerils.ts`). */
const whirlpoolDef = nommerChamps(z.strictObject({
  id: z.string(),
  label: z.string(),
  m: z.number(),
  zoneRadiusM: z.number(),
  zoneSpiralM: z.number(),
  manDR: z.number(),
  ic: z.number(),
  evasion: nommerChamps(z.strictObject({ difficulty: difficultySchema, totalDR: z.number() }), { difficulty: { label: 'Difficulté' }, totalDR: { label: 'DR cumulés' } }),
  source: sourceRefSchema,
}), {
  id: { label: 'Identifiant' },
  label: { label: 'Libellé' },
  m: { label: 'Mouvement' },
  zoneRadiusM: { label: 'Rayon de zone (m)' },
  zoneSpiralM: { label: 'Spirale de zone (m)' },
  manDR: { label: 'DR de manœuvre' },
  ic: { label: 'Indice de Critique' },
  evasion: { label: 'Évasion' },
  source: { label: 'Source' },
});

const champs = {
  echouer: nommerChamps(z.strictObject({ desc: z.string(), source: sourceRefSchema }), { desc: { label: 'Description' }, source: { label: 'Source' } }),
  /** Pondération MAISON du tirage entre `hazards[]` (#444) — le RAW l.475-499 est muet sur la fréquence. */
  hazardsWeightNote: z.string(),
  hazards: z.array(seaHazardDef),
  detroits: z.array(straitDef),
  tourbillons: z.array(whirlpoolDef),
  tourbillonSwim: nommerChamps(z.strictObject({ skill: refOuSpec('skill'), difficulty: difficultySchema, source: sourceRefSchema }), { skill: { label: 'Compétence' }, difficulty: { label: 'Difficulté' }, source: { label: 'Source' } }),
  gestionDesPerils: z.array(
    nommerChamps(z.strictObject({ distanceM: z.number(), spot: difficultySchema, avoid: difficultySchema, source: sourceRefSchema }), {
      distanceM: { label: 'Distance (m)' },
      spot: { label: 'Détection' },
      avoid: { label: 'Évitement' },
      source: { label: 'Source' },
    }),
  ),
};

const doc = document(
  'sea-perils',
  famille,
  champs,
  {
    echouer: { label: 'Échouage', hint: "Description et référence de la règle d'échouage" },
    hazardsWeightNote: { label: 'Note de pondération', hint: 'Pondération MAISON du tirage entre dangers — le RAW ne chiffre pas la fréquence' },
    hazards: { label: 'Dangers de navigation', hint: 'Catalogue des dangers (Iceberg/Débris/Rocher/Bas-fonds) — collision, empêtrement' },
    detroits: { label: 'Détroits', hint: 'Passages resserrés : Mouvement max et DR de Navigation pour les franchir' },
    tourbillons: { label: 'Tourbillons', hint: "Zones dangereuses : rayon, spirale d'aspiration, chance d'évasion" },
    tourbillonSwim: { label: 'Nage hors tourbillon', hint: "Compétence et difficulté pour s'extraire à la nage" },
    gestionDesPerils: { label: 'Gestion à distance', hint: "Distance de détection/d'évitement d'un péril repéré à temps" },
  },
  { codex: { keys: ['seaPerils'] }, edit: { object: 'single' } },
);

export const schema = doc.schema;
export const meta = doc.meta;
export const exposition = doc.exposition;
export type SeaPerilsData = EnveloppeDocument & z.infer<z.ZodObject<typeof champs>>;
