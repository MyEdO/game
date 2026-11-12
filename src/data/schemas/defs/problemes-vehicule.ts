/**
 * Schéma de `problemes-vehicule.json` — Problèmes de véhicule EDOC 7 (d100) : des `TravelTableEntry`
 * (`src/engine/travelTables.ts`), schéma PROMU dans `grammaire/mecanique.ts` (`travelTableEntrySchema`/`stageOutcomeSchema`
 * — partagé avec `rencontres-edoc.ts`/`incidents-monture.ts`).
 */
import { document } from '../grammaire/document';
import { travelTableEntrySchema } from '../grammaire/mecanique';

export const file = 'problemes-vehicule.json';
export const famille = 'config';

export const rangee = travelTableEntrySchema;

const doc = document(
  'problemes-vehicule',
  famille,
  {},
  {},
  {
    edit: { niche: { categories: { problemesVehicule: 'entries' } } },
  },
  { rangee, deDeTirage: true },
);

export const schema = doc.schema;
export const meta = doc.meta;

export const exposition = doc.exposition;
