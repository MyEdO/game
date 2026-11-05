/**
 * Schéma de `calendarPhases.json` — les 7 phases de la journée (Aube→Nuit), consommé par
 * `src/data/index.ts` (`{ id, seuil, label, icon }[]`). Chaque phase est un PALIER (`palierSchema`) :
 * `seuil` = minute du jour (0-1439) où elle commence ; `icon` = clé d'ENVELOPPE, EXIGÉE ici
 * (`options.exiges`) — toute phase porte la sienne à l'écran (`ajouter-une-icone`).
 */
import { document } from '../grammaire/document';
import { palierSchema } from '../grammaire/valeurs';

export const file = 'calendarPhases.json';
export const famille = 'entite';

const doc = document(
  'calendarPhases',
  famille,
  { ...palierSchema.shape },
  {
    seuil: { label: 'Heure de début', hint: 'Minute du jour (0-1439) où la phase commence' },
  },
  {
    codex: { keys: ['calendarPhases'] },
    edit: { dataset: 'calendarPhases' },
  },
  { exiges: ['icon'] },
);

export const schema = doc.schema;
export const meta = doc.meta;

export const exposition = doc.exposition;
