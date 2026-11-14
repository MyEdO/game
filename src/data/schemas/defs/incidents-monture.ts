/**
 * Schéma de `incidents-monture.json` — Incidents de monte EDOC 7 (d100) : des `TravelTableEntry`
 * (`src/engine/travelTables.ts`), schéma PROMU dans `grammaire/mecanique.ts` (`travelTableEntrySchema`/`stageOutcomeSchema`
 * — partagé avec `rencontres-edoc.ts`/`problemes-vehicule.ts`). Aucune entrée ne
 * porte `stageOutcome`/`vehicleWounds`/`occupantOps` (propres aux deux autres tables) — champs quand
 * même déclarés `.optional()` dans le schéma commun, sans conséquence ici.
 */
import { document } from '../grammaire/document';
import { travelTableEntrySchema } from '../grammaire/mecanique';

export const file = 'incidents-monture.json';
export const famille = 'config';

export const rangee = travelTableEntrySchema;

const doc = document(
  'incidents-monture',
  famille,
  {},
  {},
  {
    edit: { niche: { categories: { incidentsMonture: 'entries' } } },
  },
  { rangee, deDeTirage: true },
);

export const schema = doc.schema;
export const meta = doc.meta;

export const exposition = doc.exposition;
