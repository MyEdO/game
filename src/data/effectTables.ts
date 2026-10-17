/**
 * Tables d'EFFETS référençables (`tables.json`) — des tableaux `[min,max] → GameOp[]` tirés par l'op
 * `rollTable` variante `tableId` (moteur : `applyOps`). MÊME patron que `mutationTables.ts` (plages +
 * référence par id), mais la rangée porte des `GameOp[]` (grantTrait/rollMutation…) au lieu d'un id de
 * mutation. Découple la DONNÉE (le Tableau RAW, éditable/citable) de la MÉCANIQUE (l'op générique) : un
 * sort « lancez sur le Tableau » ne recopie plus la table dans son Flow, il la RÉFÉRENCE par `tableId`.
 * Ce module = TYPES + chargement + lookup ; ajouter/régler = éditer `tables.json`, jamais ce fichier.
 */
import type { GameOp } from '../engine/ops';
import { tableOuverte, type BandeOuverte } from '../engine/tables';
import effectTablesJson from './tables.json';

/** Une rangée d'une table d'effets : fourchette `[min,max]` du jet → `ops` appliquées (même ctx).
 *  `label` = libellé d'affichage RAW de la rangée (colonne du Tableau), optionnel. Bornes telles que
 *  `findTableEntry` les lit : une bande ouverte en donnée (`null`, « 11+ », VDM 12 l.435) l'est à
 *  l'infini (`tableOuverte`, au chargement). */
export interface EffectTableRow {
  min: number;
  max: number;
  label?: string;
  ops: GameOp[];
}

/** Une TABLE d'effets (`tables.json`) : `id` STABLE (langue-indépendant) + `die` (d10/d100) + rangées.
 *  `source` = citation RAW du Tableau. */
export interface EffectTable {
  id: string;
  type: 'tables';
  label: string;
  die: 'd10' | 'd100';
  rows: EffectTableRow[];
  source?: { book: string; page: number };
}

const TABLES: EffectTable[] = (effectTablesJson as unknown as (Omit<EffectTable, 'rows'> & { rows: (BandeOuverte & Omit<EffectTableRow, 'min' | 'max'>)[] })[])
  .map((t) => ({ ...t, rows: tableOuverte(t.rows) }));
const BY_ID = new Map(TABLES.map((t) => [t.id, t]));

/** Toutes les tables d'effets (Codex, éditeur). */
export const effectTables = TABLES;

/** Table d'effets par `id` STABLE — FAIL-FAST (id inconnu = bug de données côté op `rollTable`/authoring). */
export function findEffectTableById(id: string): EffectTable {
  const t = BY_ID.get(id);
  if (!t) throw new Error(`findEffectTableById : table d'effets « ${id} » introuvable (tables.json)`);
  return t;
}
