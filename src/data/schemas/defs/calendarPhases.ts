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
  // Ordre total des paliers de `dayPhase` (`findTierEntry`, `minuteOfDay`, `src/engine/clock.ts`).
  {
    exiges: ['icon'],
    affinerDataset: (dataset) =>
      dataset.superRefine((v, ctx) => {
        const vus = new Map<number, string>();
        (v as { id: string; seuil: number }[]).forEach((p, i) => {
          if (p.seuil < 0 || p.seuil > 1439)
            ctx.addIssue({ code: 'custom', path: [i, 'seuil'], message: `calendarPhases.json : « ${p.id} » commence à la minute ${p.seuil}, hors de la minute du jour (0-1439).` });
          const premier = vus.get(p.seuil);
          if (premier === undefined) vus.set(p.seuil, p.id);
          else ctx.addIssue({ code: 'custom', path: [i, 'seuil'], message: `calendarPhases.json : « ${premier} » et « ${p.id} » portent le même seuil ${p.seuil} — les seuils des phases sont distincts.` });
        });
      }),
  },
);

export const schema = doc.schema;
export const meta = doc.meta;

export const exposition = doc.exposition;
