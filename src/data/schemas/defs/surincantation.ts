/**
 * Schéma de `surincantation.json` — TABLEAU DE SURINCANTATION des Vents de Magie (VDM 02 l.205-215,
 * folio 23). Document UNIQUE de famille `config`, même patron qu'`obsessions.json`.
 * Une rangée = un PALIER de DR dépensés sur UNE colonne : `targets` = Cibles ADDITIONNELLES,
 * `damage` = Dégât en plus (Projectiles magiques, VDM 02 l.198), `range`/`zone`/`duration` =
 * multiplicateurs de la valeur listée par le Sort. Rangées AUTHORÉES dans l'ordre imprimé (DR
 * croissant) ; le lookup (`src/engine/overcast.ts`) retient le palier le plus haut ≤ DR dépensés.
 * `id`/`label` = identité STABLE de la rangée pour l'exposition et l'édition au Compendium.
 *
 * Une rangée porte un seuil `dr` (aucune borne haute) et le lookup retient le plus haut palier ≤ DR
 * dépensés : le concept `palier` qui le nomme est la question #1666.
 */
import { z } from 'zod';
import { document, type DocumentARangees } from '../grammaire/document';

export const file = 'surincantation.json';
export const famille = 'config';

/** Un palier : des DR dépensés sur UNE colonne. */
const palierSchema = z.strictObject({
  id: z.string().min(1),
  label: z.string().min(1),
  dr: z.number().int().min(1),
  targets: z.number().int().min(0),
  damage: z.number().int().min(0),
  range: z.number().int().min(1),
  zone: z.number().int().min(1),
  duration: z.number().int().min(1),
});

const doc = document(
  'surincantation',
  famille,
  {},
  {},
  {
    codex: { keys: ['surincantation'] },
    edit: { niche: { categories: { surincantation: 'entries' } } },
  },
  { rangee: palierSchema },
);

export const schema = doc.schema;
export const meta = doc.meta;
export const exposition = doc.exposition;
export type SurincantationData = DocumentARangees<z.infer<typeof palierSchema>>;
