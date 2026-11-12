import { metaDesChamps, nommerChamps } from '../grammaire/meta';
/** MDG 13 l.423-564 */
import { z } from 'zod';
import { document, type EnveloppeDocument } from '../grammaire/document';
import { cibleEtendueSchema, difficultySchema, shipSizeSchema, sourceRefSchema } from '../grammaire/valeurs';
import { fixerLeTest, flowTestSchema } from '../grammaire/mecanique';
import { listeCle } from '../grammaire/collection-cle';

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
  freeTest: nommerChamps(z.strictObject({ test: flowTestSchema, ...cibleEtendueSchema.shape }).superRefine(fixerLeTest('difficulty')), {
    test: { label: 'Test' },
    ...metaDesChamps(cibleEtendueSchema, { exigees: true }),
  }).optional(),
  desc: z.string(),
  source: sourceRefSchema,
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
  evasion: nommerChamps(z.strictObject({ difficulty: difficultySchema, ...cibleEtendueSchema.shape }), { difficulty: { label: 'Difficulté' }, ...metaDesChamps(cibleEtendueSchema, { exigees: true }) }),
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
  /** L'espace des périls : la `collision` d'une op `perilDeMer` et l'`evite` d'une op `navireMod` y résolvent. */
  hazards: listeCle(seaHazardDef, 'id', { espace: {} }),
  detroits: z.array(straitDef),
  /** L'espace des tourbillons : le `tourbillon` d'une op `perilDeMer` y résout. */
  tourbillons: listeCle(whirlpoolDef, 'id', { espace: {} }),
  tourbillonSwim: nommerChamps(z.strictObject({ test: flowTestSchema, source: sourceRefSchema }).superRefine(fixerLeTest('skill', 'difficulty')), { test: { label: 'Test' }, source: { label: 'Source' } }),
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
    hazards: { label: 'Dangers de navigation', hint: 'Catalogue des dangers (Iceberg/Débris/Rocher/Bas-fonds) — collision, empêtrement' },
    detroits: { label: 'Détroits', hint: 'Passages resserrés : Mouvement max et DR de Navigation pour les franchir' },
    tourbillons: { label: 'Tourbillons', hint: "Zones dangereuses : rayon, spirale d'aspiration, chance d'évasion" },
    tourbillonSwim: { label: 'Nage hors tourbillon', hint: "Compétence et difficulté pour s'extraire à la nage" },
    gestionDesPerils: { label: 'Gestion à distance', hint: "Distance de détection/d'évitement d'un péril repéré à temps" },
  },
  { codex: { keys: ['seaPerils'] }, edit: { object: 'unique' } },
);

export const schema = doc.schema;
export const meta = doc.meta;
export const exposition = doc.exposition;
export type SeaPerilsData = EnveloppeDocument & z.infer<z.ZodObject<typeof champs>>;
