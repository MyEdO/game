import { nommerChamps, metaDesChamps } from '../grammaire/meta';
/** MDG 15 l.83-129 */
import { z } from 'zod';
import { document } from '../grammaire/document';
import { plageSchema, sourceRefSchema } from '../grammaire/valeurs';
import { listeCle } from '../grammaire/collection-cle';

export const file = 'sea-events.json';
export const famille = 'config';

/** `ManannFactor.effect` (`src/engine/seaVoyage.ts`) : signe fixe (1|-1) + décompte flat/d10. */
const manannFactor = nommerChamps(z.strictObject({
  id: z.string(),
  label: z.string(),
  effect: nommerChamps(z.strictObject({
    sign: z.union([z.literal(1), z.literal(-1)]),
    flat: z.number(),
    d10: z.number(),
  }), { sign: { label: 'Signe' }, flat: { label: 'Valeur fixe' }, d10: { label: 'Dés à dix faces' } }),
  source: sourceRefSchema,
}), {
  id: { label: 'Identifiant' },
  label: { label: 'Libellé' },
  effect: { label: 'Effet' },
  source: { label: 'Source' },
});

/** `SeaEventDef` (`src/engine/seaVoyage.ts`) — `params` = sac hétérogène PAR `kind`, lu par clé. */
const seaEventDef = nommerChamps(z.strictObject({
  ...plageSchema.shape,
  id: z.string(),
  label: z.string(),
  desc: z.string(),
  kind: z.string(),
  params: z.record(z.string(), z.unknown()),
  source: sourceRefSchema,
}), {
  ...metaDesChamps(plageSchema, { exigees: true }),
  id: { label: 'Identifiant' },
  label: { label: 'Libellé' },
  desc: { label: 'Description' },
  kind: { label: 'Type' },
  params: { label: 'Paramètres' },
  source: { label: 'Source' },
});

/** Palier du VOYAGE RAPIDE (`FastVoyagePalier`, `src/engine/seaVoyage.ts`) — cran du d10 (l.33-37) :
 *  fourchette `[min,max]` (`findTableEntry`) + conséquences en % (équipage/cargaison/Blessures) et
 *  Coups Critiques. `desc` = verbatim RAW (règle 5). */
const fastVoyagePalier = nommerChamps(z.strictObject({
  ...plageSchema.shape,
  id: z.string(),
  label: z.string(),
  desc: z.string(),
  crewLostPct: z.number(),
  cargoLostPct: z.number(),
  hullLostPct: z.number(),
  criticals: z.number(),
  source: sourceRefSchema,
}), {
  ...metaDesChamps(plageSchema, { exigees: true }),
  id: { label: 'Identifiant' },
  label: { label: 'Libellé' },
  desc: { label: 'Description' },
  crewLostPct: { label: 'Équipage perdu (%)' },
  cargoLostPct: { label: 'Cargaison perdue (%)' },
  hullLostPct: { label: 'Coque perdue (%)' },
  criticals: { label: 'Critiques' },
  source: { label: 'Source' },
});

const doc = document(
  'sea-events',
  famille,
  {
    manann: nommerChamps(z.strictObject({
      base: z.number(),
      portEventMod: z.number(),
      source: sourceRefSchema,
      factors: listeCle(manannFactor, 'id'),
    }), {
      base: { label: 'Base' },
      portEventMod: { label: 'Modificateur d’événement au port' },
      source: { label: 'Source' },
      factors: { label: 'Facteurs' },
    }),
    boardEvents: listeCle(seaEventDef, 'id'),
    portEvents: listeCle(seaEventDef, 'id'),
    fastVoyage: nommerChamps(z.strictObject({ source: sourceRefSchema, paliers: z.array(fastVoyagePalier) }), { source: { label: 'Source' }, paliers: { label: 'Paliers' } }),
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
    edit: { niche: { categories: { seaManannFactors: 'manann.factors', seaBoardEvents: 'boardEvents', seaPortEvents: 'portEvents' } } },
  },
);

export const schema = doc.schema;
export const meta = doc.meta;

export const exposition = doc.exposition;
