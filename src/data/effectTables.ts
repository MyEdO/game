/**
 * Tables d'EFFETS référençables (`tables.json`) — des tableaux `[min,max] → GameOp[]` tirés par l'op
 * `rollTable` variante `tableId` (moteur : `applyOps`). MÊME patron que `mutationTables.ts` (plages +
 * référence par id), mais la rangée porte des `GameOp[]` (grantTrait/rollMutation…) au lieu d'un id de
 * mutation. Découple la DONNÉE (le Tableau RAW, éditable/citable) de la MÉCANIQUE (l'op générique) : un
 * sort « lancez sur le Tableau » ne recopie plus la table dans son Flow, il la RÉFÉRENCE par `tableId`.
 * Ce module = TYPES + lecteur vivant + lookup ; ajouter/régler = éditer `tables.json`, jamais ce fichier.
 */
import type { GameOp } from '../engine/ops';
import { tableOuverte, type BandeOuverte, type DeDeTable } from '../engine/tables';
import effectTablesJson from './tables.json';
import { deDeTirageDe } from './rangees';
import { memoParVersion } from './versionDataset';
import type * as tablesDEffets from './schemas/defs/tables';

/** Une rangée d'une table d'effets TELLE QUE LA DONNÉE LA PORTE : fourchette `[min,max]` du jet → `ops`
 *  appliquées (même ctx). `label` = libellé d'affichage RAW de la rangée (colonne du Tableau), optionnel.
 *  Une borne non imprimée est `null` (« 11+ », VDM 12 l.435). */
export interface EffectTableRow extends BandeOuverte {
  label?: string;
  ops: GameOp[];
}

/** Une TABLE d'effets (`tables.json`) : `id` STABLE (langue-indépendant) + `die` (dé de tirage,
 *  `deDeTirageSchema`) + rangées. `source` = citation RAW du Tableau. */
export interface EffectTable {
  id: string;
  type: 'tables';
  label: string;
  die: string;
  entries: EffectTableRow[];
  source?: { book: string; page: number };
}

/** Une table d'effets telle que `findTableEntry` la lit : ses bandes ouvertes le sont à l'infini
 *  (`tableOuverte`). */
export type EffectTableLue = Omit<EffectTable, 'entries'> & { entries: (EffectTableRow & { min: number; max: number })[] };

/** Toutes les tables d'effets — le binding VIVANT du seam (`ARRAYS.effectTables`, `src/data/overrides.ts`),
 *  muté EN PLACE par l'atelier du Codex. */
export const effectTables = effectTablesJson as unknown as EffectTable[];

/** Tables LUES par id, reconstruites à la version du dataset (#1667). */
const tablesLues = memoParVersion('effectTables', () =>
  new Map(effectTables.map((t): [string, EffectTableLue] => [t.id, { ...t, entries: tableOuverte(t.entries) }])));

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
