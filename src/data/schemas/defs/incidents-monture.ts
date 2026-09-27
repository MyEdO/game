/**
 * Schéma de `incidents-monture.json` — Incidents de monte EDOC 7 (d100), miroir de la forme
 * enveloppe `TravelTable` (`src/engine/travelTables.ts`) portant des `TravelTableEntry`
 * (`.../travelTables.ts`), PROMU dans `grammaire/mecanique.ts` (`travelTableEntrySchema`/`stageOutcomeSchema`
 * — partagé avec `rencontres-edoc.ts`/`problemes-vehicule.ts`). Aucune entrée ne
 * porte `stageOutcome`/`vehicleWounds`/`occupantOps` (propres aux deux autres tables) — champs quand
 * même déclarés `.optional()` dans le schéma commun, sans conséquence ici.
 */
import { document } from '../grammaire/document';
import { travelTableEntrySchema } from '../grammaire/mecanique';

export const file = 'incidents-monture.json';
export const famille = 'config';

const doc = document(
  'incidents-monture',
  famille,
  {},
  {},
  {
    codex: { keys: ['incidentsMonture'] },
    edit: { niche: { categories: { incidentsMonture: 'entries' } } },
  },
  { rangee: travelTableEntrySchema, deDeTirage: true },
);

export const schema = doc.schema;
export const meta = doc.meta;

export const exposition = doc.exposition;
