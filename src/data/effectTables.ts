/**
 * Tables d'EFFETS référençables (`tables.json`) — des tableaux `[min,max] → GameOp[]` tirés par l'op
 * `rollTable` variante `table: { id }` (moteur : `applyOps`). MÊME patron que `mutationTables.ts` (plages +
 * référence par id), mais la rangée porte des `GameOp[]` (grantTrait/rollMutation…) au lieu d'un id de
 * mutation. Découple la DONNÉE (le Tableau RAW, éditable/citable) de la MÉCANIQUE (l'op générique) : un
 * sort « lancez sur le Tableau » ne recopie plus la table dans son Flow, il la RÉFÉRENCE par `table.id`.
 * Ce module = TYPES + lecteur vivant + lookup ; ajouter/régler = éditer `tables.json`, jamais ce fichier.
 */
import { tableOuverte, type DeDeTable } from '../engine/tables';
import { garanti } from '../lib/garanti';
import effectTablesJson from './tables.json';
import { deDeTirageDe, type RangeeDe } from './schemas/rangees';
import { datasetDe, type EntreeDe } from './schemas/datasets';
import { memoParVersion } from './versionDataset';
import type * as tablesDEffets from './schemas/defs/tables';

/** Une rangée d'une table d'effets TELLE QUE LA DONNÉE LA PORTE : fourchette `[min,max]` du jet (borne non
 *  imprimée `null`, VDM 12 l.435) → `ops` appliquées (même ctx), `label` d'affichage RAW optionnel. */
type EffectTableRow = RangeeDe<typeof tablesDEffets>;

/** Une TABLE d'effets (`tables.json`) : `id` STABLE + `die` (dé de tirage) + rangées. */
type EffectTable = EntreeDe<typeof tablesDEffets>;

/** Une table d'effets telle que `findTableEntry` la lit : ses bandes ouvertes le sont à l'infini
 *  (`tableOuverte`). */
export type EffectTableLue = Omit<EffectTable, 'entries'> & { entries: (EffectTableRow & { min: number; max: number })[] };

/** Toutes les tables d'effets — le binding VIVANT du seam (`ARRAYS.effectTables`, `src/data/overrides.ts`),
 *  muté EN PLACE par l'atelier du Codex. */
export const effectTables = datasetDe<typeof tablesDEffets>(effectTablesJson);

/** Tables LUES par id, reconstruites à la version du dataset (#1667). */
const tablesLues = memoParVersion('effectTables', () =>
  new Map(effectTables.map((table: EffectTable): [string, EffectTableLue] => {
    const entries = table.borneHauteOuverte
      ? tableOuverte(table.entries)
      : table.entries.map((rangee, i) => ({
        ...rangee,
        min: garanti(rangee.min, table.id, `borne basse de la rangée ${i + 1} de la table d’effets fermée`),
        max: garanti(rangee.max, table.id, `borne haute de la rangée ${i + 1} de la table d’effets fermée`),
      }));
    return [table.id, { ...table, entries }];
  })));

/** Table d'effets par `id` STABLE — FAIL-FAST (id inconnu = bug de données côté op `rollTable`/authoring). */
export function findEffectTableById(id: string): EffectTableLue {
  const t = tablesLues().get(id);
  if (!t) throw new Error(`findEffectTableById : table d'effets « ${id} » introuvable (tables.json)`);
  return t;
}

/** Le DÉ DE TIRAGE de la table d'effets `id` (`die`), lu VIVANT à l'appel (`deDeTirageDe`). */
export function effectTableDie(id: string): DeDeTable {
  return deDeTirageDe<typeof tablesDEffets>(effectTablesJson, id);
}
