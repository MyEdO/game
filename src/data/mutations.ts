/**
 * Mutations & Tableaux de Corruption — Livre de base, chapitre 19 (p.184-185), VERBATIM.
 *
 * DÉCOUPLÉ : la MUTATION (identité + effets) vit dans `mutations.json` (entité éditable, SANS plage de
 * tirage) ; les TABLES de Corruption vivent dans `mutationTables.json` — des plages d100 qui RÉFÉRENCENT
 * des mutations par id, et sont elles-mêmes indexées par leur propre `id` (physique/mentale/khorne…).
 * Plusieurs tables peuvent pointer la même mutation SANS collision (LDB : physique/mentale ; Compagnon
 * T1 : une table par dieu du Chaos rejoue les mêmes mutations à d'autres plages). Ce module = TYPES +
 * chargement + tirage ; ajouter/régler = éditer le JSON (mutation OU table),
 * jamais ce fichier. Effets modélisés sur la mutation : TOUT en `passive` (GameOp[]) — charMod/moveMod
 * (carac), `ap` (armure naturelle), `grantNaturalWeapon` (arme), `grantTrait`/`grantPsychTrait` (traits) ;
 * descriptif non modélisable en `note`.
 */
import { RNG, deMonde } from '../engine/dice';
import { findTableEntry } from '../engine/tables';
import type { Mutation } from '../engine/corruption';
import mutationsJson from './mutations.json';
import mutationTablesJson from './mutationTables.json';
import { stripBookMarker } from './bookMarker';
import { indexParId, memoParVersion } from './versionDataset';
import type { PlayerText } from '../i18n/playerText';

/** Une MUTATION (entité, `mutations.json`) : identité + effets, INDÉPENDANTE de toute table de tirage. */
export type MutationData = Omit<Mutation, 'roll' | 'talentsAcquis'> & { type: 'mutations' };

/** Une TABLE de Corruption (`mutationTables.json`) : plages d100 → référence de mutation par id.
 *  `id` STABLE (langue-indépendant — 'physique'/'mentale'/'khorne'…) ; `label` = affichage. */
export interface MutationTable {
  id: string;
  type: 'mutationTables';
  label: string;
  ranges: { min: number; max: number; mutation: string }[];
}

const MUTATIONS = mutationsJson as MutationData[];
const TABLES = mutationTablesJson as MutationTable[];
const mutationParId = indexParId('mutations', MUTATIONS);
const tableParId = indexParId('mutationTables', TABLES);

/** `id`s par nature de mutation — pour le registre visuel du rig et son test d'exhaustivité.
 *  ACCESSEURS (#1692) : le jeu de mutations est celui de la donnée À CET INSTANT — une mutation
 *  ajoutée/retirée au Codex entre et sort de ces listes sans rechargement. */
export const idsPhysiques = memoParVersion('mutations', (): readonly string[] =>
  MUTATIONS.filter((m) => m.kind === 'physique').map((m) => m.id));
export const idsMentales = memoParVersion('mutations', (): readonly string[] =>
  MUTATIONS.filter((m) => m.kind === 'mentale').map((m) => m.id));

/** Une LIGNE d'étape d'une table de Corruption : la fourchette d100 de `mutationTables.json` projetée
 *  sur l'**id** STABLE de la mutation référencée, plus son `label` (AFFICHAGE seul — picker de lignes).
 *  Forme compatible `TableStepRow` (`state/cascade.ts`) : la DONNÉE reste la seule source des plages. */
export interface MutationTableRow {
  min: number;
  max: number;
  id: string;
  label?: string;
}

/** Le CACHE des lignes projetées, remis à neuf par toute écriture sur l'un des DEUX datasets qu'une
 *  ligne lit : les fourchettes viennent de `mutationTables`, le libellé de chaque ligne de `mutations`. */
const lignesParTable = memoParVersion(['mutationTables', 'mutations'], () => new Map<string, MutationTableRow[]>());

/** ids de TOUTES les tables de Corruption (LDB, EDOC par Puissance, sous-tables) — source unique des
 *  tables déclarables en étape de séquence, ACCESSEUR (#1692) : une table ajoutée au Codex y entre,
 *  une table retirée en sort, sans rechargement. */
export const mutationTableIds = memoParVersion('mutationTables', (): readonly string[] => TABLES.map((t) => t.id));

function tableOf(table: string): MutationTable {
  const t = tableParId(table);
  if (!t) throw new Error(`mutations : table « ${table} » introuvable (mutationTables.json)`);
  return t;
}

/** Libellé d'AUTHORING d'une table (tel qu'écrit en donnée : il PORTE la provenance — « Physique —
 *  Khorne (EDOC) » — parce que l'auteur en a besoin au Codex/à l'éditeur pour distinguer deux tables
 *  homonymes de livres différents). JAMAIS rendu au joueur : cf. `mutationTablePlayerLabel`. */
export function mutationTableLabel(table: string): string {
  return tableOf(table).label;
}

/** Libellé JOUEUR d'une table (rangée de tirage d'une étape, titre d'étape) : le libellé d'authoring
 *  SANS sa marque de provenance (projection PARTAGÉE `stripBookMarker` — même définition que la garde
 *  de charte), capitalisé (« physique » → « Physique »). `docs/charte-ui.md` : « JAMAIS de référence au
 *  livre dans un texte joueur ». La DONNÉE reste intacte (l'authoring garde sa provenance). */
export function mutationTablePlayerLabel(table: string): PlayerText {
  const l = stripBookMarker(mutationTableLabel(table));
  // MINTEUR (b) : texte AUTHORÉ en donnée (cf. `dataLabel`, `data/index.ts`) — cast local pour ne pas
  // créer de cycle `index.ts` ⇄ `mutations.ts`.
  // eslint-disable-next-line no-restricted-syntax -- #1318 V8a₁ : l'unique cast de ce minteur (b), même corps de métier et même cliquet que `dataLabel`.
  return (l.charAt(0).toUpperCase() + l.slice(1)) as PlayerText;
}

/** Lignes d'étape d'une table — mémoïsées : une seule projection par table, rendue PAR RÉFÉRENCE. */
export function mutationTableRows(table: string): MutationTableRow[] {
  const cache = lignesParTable();
  const connu = cache.get(table);
  if (connu) return connu;
  const rows = tableOf(table).ranges.map((r) => ({ min: r.min, max: r.max, id: r.mutation, label: mutationParId(r.mutation)?.label }));
  cache.set(table, rows);
  return rows;
}

/** Mutation d'un id de LIGNE (= id de mutation) + le dé qui l'a atteinte, fail-fast. SEUL chemin de
 *  matérialisation : `rollTableStep` rend déjà l'id de la ligne tirée (l'AUTORITÉ), l'appelant le
 *  CONSOMME au lieu de refaire un lookup sur un dé — naturel ou effectif — qui pourrait diverger. */
export function mutationOfRow(id: string, roll: number): Mutation {
  const m = mutationParId(id);
  if (!m) throw new Error(`mutations : ligne « ${id} » sans mutation valide (mutations.json)`);
  return { ...m, roll };
}

function mutationOfRange(table: string, roll: number, range: { mutation: string } | undefined): Mutation {
  if (!range) throw new Error(`mutations : plage d100=${roll} hors table « ${table} »`);
  return mutationOfRow(range.mutation, roll);
}

/** LOOKUP d'une table par un d100 DÉJÀ tiré : aucun dé consommé, aucune récursion — le site de
 *  résolution d'UN niveau, partagé par `rollMutation` et par l'étape à table du flux de Corruption. */
export function mutationAt(table: string, roll: number): Mutation {
  return mutationOfRange(table, roll, findTableEntry(tableOf(table).ranges, roll));
}

/** SOUS-TABLE d'une mutation tirée sur `table` (ex. « Tête bestiale » EDOC) : `${subTable}${suffixe}`,
 *  où le suffixe est l'alignement de la table courante (« edoc-phys-khorne » → « -khorne »). `null` si
 *  la mutation n'en a pas, ou si la sous-table alignée n'existe pas (tables LDB, sans suffixe). */
export function mutationSubTableFor(table: string, m: { subTable?: string }): string | null {
  if (!m.subTable) return null;
  const suffix = table.includes('-') ? table.slice(table.lastIndexOf('-')) : '';
  return tableParId(m.subTable + suffix) ? m.subTable + suffix : null;
}

/** Tire une mutation sur la TABLE d'`id` `table` (LDB : 'physique'/'mentale' ; Compagnon T1 : 'khorne'…), d100 seedable.
 *  Les plages référencent les mutations par **id** (plus de label).
 *
 *  `forcedRoll` = d100 IMPOSÉ (dé posé, test) : il résout la ligne de CETTE table et le tirage S'ARRÊTE
 *  là — une ligne à sous-table rend la mutation de la ligne, dont la sous-table est un SECOND tirage,
 *  injectable à son tour (`mutationSubTableFor` + un nouvel appel) : la descente devient pilotable
 *  niveau par niveau. Sans `forcedRoll`, la sous-table est ré-tirée dans la foulée. */
export function rollMutation(table: string, rng: RNG, forcedRoll?: number): Mutation {
  if (forcedRoll != null) return mutationAt(table, forcedRoll); // dé POSÉ : aucun dé consommé, arrêt AVANT la sous-table
  const roll = deMonde(rng); // porte du dé de monde (`engine/dice`) : la fenêtre de pose vit chez l'appelant (`corruptionFlow`, étape à table)
  const m = mutationOfRange(table, roll, findTableEntry(tableOf(table).ranges, roll));
  const sub = mutationSubTableFor(table, m);
  return sub ? rollMutation(sub, rng) : m;
}

/** Mutation EXPLICITE par **id** (sans tirage — ex. trait « Mutation (Cornes asymétriques) » résolu en id
 *  au spawn). null si inconnue. */
export function mutationById(id: string): Mutation | null {
  const m = mutationParId(id);
  return m ? { ...m, roll: 0 } : null;
}
