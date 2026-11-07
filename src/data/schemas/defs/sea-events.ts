import { nommerChamps, metaDesChamps } from '../grammaire/meta';
/** MDG 15 l.83-129 */
import { z } from 'zod';
import { document, tableTiree } from '../grammaire/document';
import { EXPRESSION_DE_DE, ecartsDeCouverture, effetSigneSchema, plageOuverteSchema, quantiteTireeSchema, sourceRefSchema } from '../grammaire/valeurs';
import { listeCle } from '../grammaire/collection-cle';
import { parseDice, totalDuDe } from '../../../engine/dice';
import { deDeLaTableTiree, facesDuDe } from '../../../engine/tables';
import { flowSchema } from '../grammaire/mecanique';

export const file = 'sea-events.json';
export const famille = 'config';

/** `ManannFactor` (`src/engine/seaVoyage.ts`). */
const manannFactor = nommerChamps(z.strictObject({
  id: z.string(),
  label: z.string(),
  effect: effetSigneSchema,
  source: sourceRefSchema,
}), {
  id: { label: 'Identifiant' },
  label: { label: 'Libellé' },
  effect: { label: 'Effet' },
  source: { label: 'Source' },
});

/** Feuille d'un paramètre d'événement : un dé s'y écrit en tirage, jamais en chaîne (`EXPRESSION_DE_DE`). #1652 */
const feuilleDeParam = z.union([
  quantiteTireeSchema,
  z.boolean(),
  z.string().refine((s) => !EXPRESSION_DE_DE.test(s), { message: 'dé en chaîne : un tirage s’écrit `{ "dice": { "n", "sides", "plus"? } }`' }),
]);

/** `SeaEventDef` (`src/engine/seaVoyage.ts`) — `consequence` = sa suite MÉCANIQUE en grammaire (`Flow`),
 *  jouée par `runFlow` ; sans elle ni genre, la rangée est narrative. `kind`/`params` = le genre d'une
 *  rangée dont la suite est codée (`ParametresDeBord`, `ParametresDePort`) ; `feuilleDeRangee` : la feuille de ses
 *  paramètres, un effet signé n'étant lu qu'à bord (Triton, MDG 15 l.136-139). `relache` : la rangée ne se
 *  joue qu'avec la relâche à terre accordée (MDG 15 l.245, l.260) ; `taillePortMax` : qu'à l'escale d'un port
 *  de Taille au plus celle-ci (MDG 15 l.249). #1652 */
const seaEventDef = (feuilleDeRangee: z.ZodType<unknown>) => nommerChamps(z.strictObject({
  ...plageOuverteSchema.shape,
  id: z.string(),
  label: z.string(),
  desc: z.string(),
  relache: z.literal(true).optional(),
  taillePortMax: z.number().int().min(1).optional(),
  consequence: flowSchema.optional(),
  kind: z.string().optional(),
  params: z.record(z.string(), z.union([
    feuilleDeRangee,
    z.array(feuilleDeParam),
    z.record(z.string(), z.union([feuilleDeParam, z.record(z.string(), feuilleDeParam)])),
  ])).optional(),
  source: sourceRefSchema,
}), {
  ...metaDesChamps(plageOuverteSchema, { exigees: true }),
  id: { label: 'Identifiant' },
  label: { label: 'Libellé' },
  desc: { label: 'Description' },
  relache: { label: 'Relâche à terre requise' },
  taillePortMax: { label: 'Taille de port maximale' },
  consequence: { label: 'Conséquence' },
  kind: { label: 'Type' },
  params: { label: 'Paramètres' },
  source: { label: 'Source' },
});

/** Palier du VOYAGE RAPIDE (`FastVoyagePalier`, `src/engine/seaVoyage.ts`) — cran du dé de sa table (l.33-37) :
 *  fourchette `[min,max]` (`findTableEntry`) et `consequence`, ses pertes en grammaire (`Flow`, ops du navire),
 *  absente pour un palier sans perte. `desc` = verbatim RAW (règle 5). */
const fastVoyagePalier = nommerChamps(z.strictObject({
  ...plageOuverteSchema.shape,
  id: z.string(),
  label: z.string(),
  desc: z.string(),
  consequence: flowSchema.optional(),
  source: sourceRefSchema,
}), {
  ...metaDesChamps(plageOuverteSchema, { exigees: true }),
  id: { label: 'Identifiant' },
  label: { label: 'Libellé' },
  desc: { label: 'Description' },
  consequence: { label: 'Conséquence' },
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
    /** MDG 15 l.134 */
    boardEvents: tableTiree(seaEventDef(z.union([feuilleDeParam, effetSigneSchema]))),
    /** MDG 15 l.243 */
    portEvents: tableTiree(seaEventDef(feuilleDeParam)),
    /** MDG 15 l.32 */
    fastVoyage: tableTiree(fastVoyagePalier, { champs: { source: sourceRefSchema }, meta: { source: { label: 'Source' } } }),
  },
  {
    manann: { label: 'Humeur de Manann', hint: 'Score de départ + facteurs signés qui font varier l’humeur du dieu de la mer' },
    boardEvents: { label: 'Événements de bord', hint: 'Table de tirage d’événements en cours de traversée' },
    portEvents: { label: 'Événements de port', hint: 'Table de tirage d’événements à l’escale' },
    fastVoyage: {
      label: 'Voyage rapide',
      hint: 'Paliers de conséquences (équipage, cargaison, coque, Critiques) d’une traversée résolue en un Test',
    },
  },
  {
    codex: { keys: ['seaManannFactors', 'seaBoardEvents', 'seaPortEvents'] },
    edit: { niche: { categories: { seaManannFactors: 'manann.factors', seaBoardEvents: 'boardEvents.entries', seaPortEvents: 'portEvents.entries' } } },
  },
  {
    // MDG 15 l.137, l.235 (boardEvents) ; l.33, l.37 (fastVoyage) ; l.129, l.243-263 (portEvents) ;
    // patron `structure-criticals.ts`.
    affinerDataset: (dataset) =>
      dataset.superRefine((v, ctx) => {
        type Bande = { id?: string; min?: number | null; max?: number | null };
        type Table = { die: string; entries: Bande[] };
        const d = v as { boardEvents?: Table; fastVoyage?: Table; portEvents?: Table; manann?: { portEventMod?: number } };
        const modDePort = d.manann?.portEventMod ?? 0;
        const deDePort = d.portEvents && parseDice(d.portEvents.die) ? deDeLaTableTiree(d.portEvents) : null;
        const tables: [(string | number)[], string, Bande[], number | 'ouverte', number | 'ouverte'][] = [
          [['boardEvents', 'entries'], "le jet d'Événement de bord", d.boardEvents?.entries ?? [], 'ouverte', 'ouverte'],
          [['fastVoyage', 'entries'], `le ${d.fastVoyage?.die} du Voyage rapide`, d.fastVoyage?.entries ?? [], 'ouverte', 'ouverte'],
          ...(deDePort ? [[['portEvents', 'entries'], `le ${d.portEvents!.die} de l'escale, Humeur de Manann comprise`, d.portEvents!.entries, totalDuDe(deDePort, deDePort.n) - modDePort, facesDuDe(deDePort) + modDePort] as [(string | number)[], string, Bande[], number, number]] : []),
        ];
        // #1652 : une rangée migrée porte sa `consequence` et perd `kind`/`params`.
        for (const table of ['boardEvents', 'portEvents'] as const) {
          ((d[table]?.entries ?? []) as { id?: string; consequence?: unknown; kind?: unknown; params?: unknown }[]).forEach((e, i) => {
            if (e.consequence !== undefined && (e.kind !== undefined || e.params !== undefined)) {
              ctx.addIssue({
                code: 'custom',
                path: [table, 'entries', i],
                message: `sea-events.json › ${table} « ${e.id} » : \`consequence\` et \`kind\`/\`params\` coexistent — une rangée en grammaire perd son genre.`,
              });
            }
          });
        }
        for (const [path, domaine, bandes, depuis, jusqua] of tables) {
          const ecarts = ecartsDeCouverture(bandes, depuis, jusqua, (b) => `la bande « ${b.id} »`);
          if (ecarts.length) {
            ctx.addIssue({
              code: 'custom',
              path,
              message: `sea-events.json › ${path.join('.')} : les bandes ne couvrent pas ${domaine} d'un seul tenant — ${ecarts.join(' ; ')}.`,
            });
          }
        }
      }),
  },
);

export const schema = doc.schema;
export const meta = doc.meta;

export const exposition = doc.exposition;
