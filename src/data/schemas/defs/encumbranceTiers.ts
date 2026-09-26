/**
 * Schéma de `encumbranceTiers.json` — Profils de pénalité d'Encombrement par palier (LDB 61 l.35-40),
 * consommé par `src/engine/encumbrance.ts` (`EncumbrancePenalties[]`, qui ignore `id`/`label`).
 * Tableau de 4 entrées à index FIXE (0 = aucune pénalité … 3 = immobilisé). `movePenalty: null`
 * UNIQUEMENT sur le palier immobilisé (le flag `immobile` court-circuite avant lecture — cf.
 * commentaire du consommateur). `id`/`label` = identité STABLE du palier, ajoutée pour l'exposition
 * Codex (#422).
 */
import { z } from 'zod';
import { document } from '../grammaire/document';

export const file = 'encumbranceTiers.json';
export const famille = 'entite';

const doc = document(
  'encumbranceTiers',
  famille,
  {
    tier: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]),
    movePenalty: z.number().nullable(),
    moveFloor: z.number(),
    agilityPenalty: z.number(),
    travelFatigue: z.number(),
    immobile: z.boolean(),
  },
  {
    tier: { label: 'Palier', hint: 'Palier de surcharge, de 0 (aucune) à 3 (immobilisé)' },
    movePenalty: { label: 'Réduction de Mouvement', hint: 'Cases de Mouvement retirées ; null au palier immobilisé (immobile court-circuite)' },
    moveFloor: {
      label: 'Plancher de Mouvement',
      hint: 'Plancher sous lequel la réduction ne fait pas descendre le Mouvement (il ne relève jamais un Mouvement déjà inférieur)',
    },
    agilityPenalty: { label: 'Malus d’Agilité', hint: 'Modificateur au Test d’Agilité à ce palier' },
    travelFatigue: { label: 'États gagnés en voyage', hint: 'États Exténué gagnés par journée de voyage à ce palier' },
    immobile: { label: 'Immobilisé', hint: 'Le porteur ne peut plus se déplacer à ce palier' },
  },
  {
    codex: { keys: ['encumbranceTiers'] },
    edit: { dataset: 'encumbranceTiers' },
  },
);

export const schema = doc.schema;
export const meta = doc.meta;

export const exposition = doc.exposition;
