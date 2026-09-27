/**
 * Schéma de `sea-events.json` — Humeur de Manann + Événements de bord/de port (MDG 15 l.83-129).
 * Dérivé de la vue typée `EVENTS`/`SeaEventDef`/`ManannFactor` (`src/engine/seaVoyage.ts`), seul
 * consommateur. `params` est un sac hétérogène PAR `kind` (ex. `moraleD10`, `days`, `roll`, `creatures`,
 * `restart`…), lu dynamiquement par clé (`eventParam`, `src/state/seaVoyageFlow.ts`) — reflet du
 * typage source `Record<string, unknown>`, jamais un champ ad hoc par `kind` (aucune contrainte connue
 * au-delà de « objet »).
 */
import { z } from 'zod';
import { document } from '../grammaire/document';
import { plageSchema, sourceRefSchema } from '../grammaire/valeurs';
import { listeCle } from '../grammaire/collection-cle';

export const file = 'sea-events.json';
export const famille = 'config';

/** `ManannFactor.effect` (`src/engine/seaVoyage.ts`) : signe fixe (1|-1) + décompte flat/d10. */
const manannFactor = z.strictObject({
  id: z.string(),
  label: z.string(),
  effect: z.strictObject({
    sign: z.union([z.literal(1), z.literal(-1)]),
    flat: z.number(),
    d10: z.number(),
  }),
  source: sourceRefSchema,
});

/** `SeaEventDef` (`src/engine/seaVoyage.ts`) — `params` = sac hétérogène PAR `kind`, lu par clé. */
const seaEventDef = z.strictObject({
  ...plageSchema.shape,
  id: z.string(),
  label: z.string(),
  desc: z.string(),
  kind: z.string(),
  params: z.record(z.string(), z.unknown()),
  source: sourceRefSchema,
});

/** Palier du VOYAGE RAPIDE (`FastVoyagePalier`, `src/engine/seaVoyage.ts`) — cran du d10 (l.33-37) :
 *  fourchette `[min,max]` (`findTableEntry`) + conséquences en % (équipage/cargaison/Blessures) et
 *  Coups Critiques. `desc` = verbatim RAW (règle 5). */
const fastVoyagePalier = z.strictObject({
  ...plageSchema.shape,
  id: z.string(),
  label: z.string(),
  desc: z.string(),
  crewLostPct: z.number(),
  cargoLostPct: z.number(),
  hullLostPct: z.number(),
  criticals: z.number(),
  source: sourceRefSchema,
});

const doc = document(
  'sea-events',
  famille,
  {
    manann: z.strictObject({
      base: z.number(),
      portEventMod: z.number(),
      source: sourceRefSchema,
      factors: listeCle(manannFactor, 'id'),
    }),
    boardEvents: listeCle(seaEventDef, 'id'),
    portEvents: listeCle(seaEventDef, 'id'),
    fastVoyage: z.strictObject({ source: sourceRefSchema, paliers: z.array(fastVoyagePalier) }),
  },
  {
    manann: { label: 'Humeur de Manann', hint: 'Score de départ + facteurs signés qui font varier l’humeur du dieu de la mer' },
    boardEvents: { label: 'Événements de bord', hint: 'Table de tirage d’événements en cours de traversée' },
    portEvents: { label: 'Événements de port', hint: 'Table de tirage d’événements à l’escale' },
    fastVoyage: {
      label: 'Voyage rapide',
      hint: 'Paliers de conséquences (équipage/cargaison/coque/Critiques) du choix de forcer l’allure',
    },
  },
  {
    codex: { keys: ['seaManannFactors', 'seaBoardEvents', 'seaPortEvents'] },
    edit: { niche: { categories: ['seaManannFactors', 'seaBoardEvents', 'seaPortEvents'] } },
  },
);

export const schema = doc.schema;
export const meta = doc.meta;

export const exposition = doc.exposition;
