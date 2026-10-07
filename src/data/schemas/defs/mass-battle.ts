import { nommerChamps, metaDesChamps } from '../grammaire/meta';
/** ADE II 8. */
import { z } from 'zod';
import { document } from '../grammaire/document';
import { moneySchema, plageSchema, sourceRefSchema } from '../grammaire/valeurs';
import { listeCle } from '../grammaire/collection-cle';

export const file = 'mass-battle.json';
export const famille = 'config';

const powerEstimateRowSchema = nommerChamps(z.strictObject({
  id: z.string(),
  label: z.string(),
  ally: z.number(),
  enemy: z.number(),
  example: z.string(),
  source: sourceRefSchema,
}), {
  id: { label: 'identifiant' },
  label: { label: 'libellé' },
  ally: { label: 'alliés' },
  enemy: { label: 'ennemis' },
  example: { label: 'exemple' },
  source: { label: 'source' },
});

const mightModifierRowSchema = nommerChamps(z.strictObject({
  id: z.string(),
  label: z.string(),
  mod: z.number(),
  example: z.string(),
  source: sourceRefSchema,
}), {
  id: { label: 'identifiant' },
  label: { label: 'libellé' },
  mod: { label: 'modificateur' },
  example: { label: 'exemple' },
  source: { label: 'source' },
});

const warMachineRowSchema = nommerChamps(z.strictObject({
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
}), {
  id: { label: 'identifiant' },
  label: { label: 'libellé' },
  price: { label: 'prix' },
  crew: { label: 'équipage' },
  availability: { label: 'disponibilité' },
  range: { label: 'portée' },
  damage: { label: 'dégâts' },
  traits: { label: 'Traits' },
  siege: { label: 'siège' },
  source: { label: 'source' },
});

const structureRowSchema = nommerChamps(z.strictObject({
  id: z.string(),
  label: z.string(),
  be: z.number(),
  wounds: z.number(),
  traits: z.string(),
  source: sourceRefSchema,
}), {
  id: { label: 'identifiant' },
  label: { label: 'libellé' },
  be: { label: 'Bonus d’Endurance' },
  wounds: { label: 'Blessures' },
  traits: { label: 'Traits' },
  source: { label: 'source' },
});

const hazardRowSchema = nommerChamps(z.strictObject({
  ...plageSchema.shape,
  id: z.string(),
  label: z.string(),
  desc: z.string(),
  source: sourceRefSchema,
}), {
  ...metaDesChamps(plageSchema, { exigees: true }),
  id: { label: 'identifiant' },
  label: { label: 'libellé' },
  desc: { label: 'texte' },
  source: { label: 'source' },
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
    edit: { niche: { categories: { massBattlePowerEstimate: 'powerEstimate', massBattleMightModifiers: 'mightModifiers', massBattleWarMachines: 'warMachines', massBattleStructures: 'structures', massBattleHazards: 'hazards' } } },
  },
);

export const schema = doc.schema;
export const meta = doc.meta;

export const exposition = doc.exposition;
