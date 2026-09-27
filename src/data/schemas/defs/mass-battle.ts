/**
 * Schéma de `mass-battle.json` — 5 tables de bataille de masse (ADE II 8), miroir strict de
 * `PowerEstimateRow`/`MightModifierRow`/`WarMachineRow`/`StructureRow`/`HazardRow`
 * (`src/engine/massBattle.ts`).
 */
import { z } from 'zod';
import { document } from '../grammaire/document';
import { moneySchema, plageSchema, sourceRefSchema } from '../grammaire/valeurs';
import { listeCle } from '../grammaire/collection-cle';

export const file = 'mass-battle.json';
export const famille = 'config';

const powerEstimateRowSchema = z.strictObject({
  id: z.string(),
  label: z.string(),
  ally: z.number(),
  enemy: z.number(),
  example: z.string(),
  source: sourceRefSchema,
});

const mightModifierRowSchema = z.strictObject({
  id: z.string(),
  label: z.string(),
  mod: z.number(),
  example: z.string(),
  source: sourceRefSchema,
});

const warMachineRowSchema = z.strictObject({
  id: z.string(),
  label: z.string(),
  price: moneySchema,
  crew: z.number(),
  availability: z.string(),
  range: z.string(),
  damage: z.string(),
  traits: z.string(),
  siege: z.boolean(),
  source: sourceRefSchema,
});

const structureRowSchema = z.strictObject({
  id: z.string(),
  label: z.string(),
  be: z.number(),
  wounds: z.number(),
  traits: z.string(),
  source: sourceRefSchema,
});

const hazardRowSchema = z.strictObject({
  ...plageSchema.shape,
  id: z.string(),
  label: z.string(),
  desc: z.string(),
  source: sourceRefSchema,
});

const doc = document(
  'mass-battle',
  famille,
  {
    powerEstimate: listeCle(powerEstimateRowSchema, 'id'),
    mightModifiers: listeCle(mightModifierRowSchema, 'id'),
    warMachines: listeCle(warMachineRowSchema, 'id'),
    structures: listeCle(structureRowSchema, 'id'),
    hazards: listeCle(hazardRowSchema, 'id'),
  },
  {
    powerEstimate: { label: 'Estimation de Puissance', hint: "Table d'exemples de composition d'armée par valeur de Puissance" },
    mightModifiers: { label: 'Modificateurs de Force', hint: 'Modificateurs de Force militaire par facteur tactique' },
    warMachines: { label: 'Machines de guerre', hint: 'Catalogue des machines de siège (coût, équipage, portée, Dégâts, Traits)' },
    structures: { label: 'Structures', hint: 'Catalogue des structures assiégeables (BE, Blessures, Traits)' },
    hazards: { label: 'Aléas de bataille', hint: "Table de tirage d'incidents de la bataille de masse" },
  },
  {
    codex: {
      keys: ['massBattlePowerEstimate', 'massBattleMightModifiers', 'massBattleWarMachines', 'massBattleStructures', 'massBattleHazards'],
    },
    edit: { niche: { categories: ['massBattlePowerEstimate', 'massBattleMightModifiers', 'massBattleWarMachines', 'massBattleStructures', 'massBattleHazards'] } },
  },
);

export const schema = doc.schema;
export const meta = doc.meta;

export const exposition = doc.exposition;
