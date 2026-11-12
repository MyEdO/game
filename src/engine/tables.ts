import { formatDice, parseDice, totalDuDe, type DiceSpec } from './dice';

/**
 * Lookup PARTAGÉ d'une entrée de table d100 par fourchette `[min, max]` — SOURCE UNIQUE des tirages
 * sur table (Critiques, Oups !, Imparfaites/Colère, Corruptions, péripéties d'interlude…). Repli sur
 * la DERNIÈRE entrée si le jet dépasse la table (ne devrait jamais arriver pour une table bien formée).
 *
 * Réutiliser ; ne JAMAIS réécrire `table.find((e) => roll >= e.min && roll <= e.max) ?? table.at(-1)`.
 */
export function findTableEntry<T extends { min: number; max: number }>(table: T[], roll: number): T {
  return table.find((e) => roll >= e.min && roll <= e.max) ?? table[table.length - 1];
}

/**
 * Lookup PARTAGÉ d'une table à PALIERS (`palierSchema`, `src/data/schemas/grammaire/valeurs.ts`) —
 * SOURCE UNIQUE du « plus haut palier atteint » : la rangée de plus grand `seuil` ≤ `valeur`,
 * indépendante de l'ordre d'authoring. `undefined` sous le plus bas palier : le repli est celui de
 * l'appelant, qui le nomme. PUR.
 */
export function findTierEntry<T extends { seuil: number }>(table: readonly T[], valeur: number): T | undefined {
  let atteint: T | undefined;
  for (const r of table) if (r.seuil <= valeur && (atteint === undefined || r.seuil > atteint.seuil)) atteint = r;
  return atteint;
}

/**
 * Bande d'une table dont une borne EXTRÊME n'est pas imprimée — `null` (JSON n'a pas d'Infinity) :
 * `max: null` pour la DERNIÈRE bande (« 71 et + », LDB 07 l.70 ; « 4 ou plus », MDG 15 l.383 ;
 * « 81+ », MDG 12 l.129 ; « 96 ou plus », AA 10 l.127 ; « 101 ou plus », MDG 14 l.188), `min: null`
 * pour la PREMIÈRE (« 50 ou moins », MDG 14 l.199 ; « –5 ou moins », MDG 13 l.75).
 */
export interface BandeOuverte { min: number | null; max: number | null }

/**
 * La table telle que `findTableEntry` la lit : la borne que le livre n'écrit pas s'ouvre à l'infini
 * (`min: null` → −∞, `max: null` → +∞). Une borne ÉCRITE reste FERMÉE : une valeur qui ne tombe
 * dans aucune bande est une ANOMALIE que l'appelant NOMME (`findTableEntryIndex` < 0), jamais le
 * repli de `findTableEntry` sur la dernière bande.
 *
 * SOURCE UNIQUE des tables ouvertes du moteur et de leurs lecteurs : la forme ouverte est déclarée
 * UNE fois en grammaire (`plageOuverteSchema`), elle s'ouvre UNE fois ici. PUR.
 */
export function tableOuverte<T extends BandeOuverte>(bandes: readonly T[]): (T & { min: number; max: number })[] {
  return bandes.map((b) => ({ ...b, min: b.min ?? Number.NEGATIVE_INFINITY, max: b.max ?? Number.POSITIVE_INFINITY }));
}

/** GRAPHIE UNIQUE d'une bande, telle qu'elle se lit sur le tableau imprimé : bornes cadrées sur les
 *  faces du dé quand la table se tire au dé (d100 → « 01–50 », d10 → « 1–5 »), « 96+ » pour la bande
 *  ouverte en haut, « ≤50 » pour la bande ouverte en bas (`null` ou `tableOuverte`). Une ligne à
 *  borne unique ne s'écrit pas « 7–7 ». Une borne négative prend le signe moins « − » et la bande
 *  le séparateur « à » (« −4 à −3 », MDG 13 l.74). docs/charte-ui.md, « Bande de table ». PUR. */
export function fourchette(min: number | null, max: number | null, dieMax = 0): string {
  const borne = (n: number) => (n < 0 ? `−${-n}` : dieMax >= 100 ? String(n).padStart(2, '0') : String(n));
  const bas = min ?? Number.NEGATIVE_INFINITY;
  const haut = max ?? Number.POSITIVE_INFINITY;
  const basOuvert = bas === Number.NEGATIVE_INFINITY;
  const hautOuvert = haut === Number.POSITIVE_INFINITY;
  if (basOuvert && hautOuvert) throw new Error('fourchette : une bande porte au moins une borne écrite');
  if (basOuvert) return `≤${borne(haut)}`;
  if (hautOuvert) return `${borne(bas)}+`;
  if (bas === haut) return borne(bas);
  return bas < 0 || haut < 0 ? `${borne(bas)} à ${borne(haut)}` : `${borne(bas)}–${borne(haut)}`;
}

declare const DE_DE_TABLE: unique symbol;
/** Le dé d'une table tirée, LU SUR SA TABLE (#1667) : seul `deDeLaTableTiree` le forge, depuis le nœud
 *  qui le porte. Le type refuse le dé nu (chaîne, `DiceSpec` littéral) ; le lint `murs/marques`
 *  (`oxlint.config.mjs`) refuse le cast qui NOMME la marque. */
export type DeDeTable = DiceSpec & { readonly [DE_DE_TABLE]: true };

/** Le nœud qui porte le dé d'une table, sous sa clé `die` (`deDeTirageSchema`) : la table elle-même, ou le
 *  sous-tirage qui départage ses rangées (`stars.json › sub`, `peripeties.json › tirageQuotidien`). */
export type PorteurDeDe = { readonly die: string; readonly id?: string };

/** LE constructeur du dé d'une table tirée : il le lit sur son nœud — FAIL-FAST sur une expression illisible. PUR. */
export function deDeLaTableTiree(table: PorteurDeDe): DeDeTable {
  const de = parseDice(table.die);
  if (!de) throw new Error(`${table.id ?? 'table'}.die invalide : ${table.die}`);
  // eslint-disable-next-line murs/marques -- #1667 : l'unique cast de ce module — forger la marque EST le corps de métier de `deDeLaTableTiree` (cf. JSDoc de `DeDeTable`).
  return de as DeDeTable;
}

/** SOURCE UNIQUE du plus grand total du dé d'une table : `d10` → 10, `d100` → 100, `2d10` → 20. PUR. */
export function facesDuDe(de: DeDeTable): number {
  return totalDuDe(de, de.n * de.sides);
}

/** GRAPHIE UNIQUE d'une bande précédée de son dé (« 1d100 01–35 », « 1d10 9–10 ») : libellé du dé
 *  par `formatDice`, bande par `fourchette` cadrée sur `facesDuDe`. docs/charte-ui.md,
 *  « Bande de table ». PUR. */
export function bandeAuDe(de: DeDeTable, min: number | null, max: number | null): string {
  return `${formatDice(de)} ${fourchette(min, max, facesDuDe(de))}`;
}

/** Variante INDEX de `findTableEntry` — pour les appelants qui doivent ensuite décaler l'entrée
 *  trouvée dans la table (crans de bonus/malus). Repli à −1 si aucune entrée ne couvre `roll` (le
 *  repli, contrairement à `findTableEntry`, est laissé à l'appelant). */
export function findTableEntryIndex<T extends { min: number; max: number }>(table: T[], roll: number): number {
  return table.findIndex((e) => roll >= e.min && roll <= e.max);
}
