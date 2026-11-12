import shipCriticalsJson from './ship-criticals.json';
import type { Tirage } from '../engine/dice';
import { deDeLaTableTiree, type DeDeTable } from '../engine/tables';
import riverCriticalsJson from './river-criticals.json';
import type * as shipCriticalsDef from './schemas/defs/ship-criticals';
import type * as riverCriticalsDef from './schemas/defs/river-criticals';
import type { ShipLocation } from '../engine/combat';
import type { GameOp, Formula } from '../engine/ops';
import type { FlowTestNode } from '../engine/flowCore';

/** QUI encaisse un coup à l'ÉQUIPAGE — les trois désignations imprimées : l'équipage d'une pièce
 *  (`MDG 13 l.763`), la ou les PRÉSENCES à bord (`ship-stations.json` — `MDG 13 l.680/l.714/l.730/
 *  l.751`, `MSRC 07 l.78/l.82/l.94`), ou le RÔLE que le livre nomme (`MSRC 07 l.86`). */
export type CrewTarget = { poste: true } | { stations: string[] } | { role: { id: string } };

/** Ce qu'un Critique de coque fait à l'ÉQUIPAGE. `crewTarget` (REQUIS) dit QUI encaisse ; l'ISSUE est
 *  SOIT une ÉPREUVE (`test` : le nœud `test` du Flow, sa branche d'échec porte la conséquence), SOIT
 *  des ops CERTAINES (`ops` — MSRC 07 l.82, où le livre n'appelle aucun jet). */
export interface ShipCrewHit {
  crewTarget: CrewTarget;
  test?: FlowTestNode;
  ops?: GameOp[];
}

/**
 * Tables de Blessures critiques sur un NAVIRE — MDG 13 « Critiques sur un navire » (p.124),
 * transcrites verbatim. MÊME patron que `criticals.json` (LDB Traumatisme) : la DONNÉE vit dans
 * `ship-criticals.json` (éditable), ce module n'est que le TYPE + le chargement + le mapping des
 * Localisations sur `ShipLocation`.
 *
 * Un Critique de navire est tiré sur un d10 dans la table de la Localisation touchée (MDG 13 :
 * double sur un coup réussi, ou tout coup une fois le score de Blessures tombé à 0). Champs
 * MÉCANISABLES (réutilisent les briques existantes — pas de mécanique parallèle) :
 *  - `shrapnel` : Éclats (Indice) → un nb de membres d'équipage = Indice subissent 9 Dégâts ;
 *  - `leak`     : Voie d'eau (Indice) → cumul qui coule le navire à Endurance ;
 *  - `fire`     : nb d'États En flammes infligés à la Localisation ;
 *  - `hullCrits`: Critiques SUPPLÉMENTAIRES sur la Coque (tirage).
 * `note` = effets LONG TERME / narratifs verbatim (réductions de Man/Mouvement, réparations, chutes
 * du gréement…), journalisés mais arbitrés/câblés au combat naval. L'Équipage touché suit les
 * Critiques de personnage EXISTANTS (LDB/AA) — aucune table dupliquée.
 */
export interface ShipCritEntry {
  min: number;
  max: number;
  /** id STABLE (slug) — toute réf croisée passe par lui, JAMAIS le `label` (affichage). */
  id: string;
  label: string;
  /** Effets « État » immédiats AUTHORÉS en `GameOp` (En flammes / Voie d'eau via op `condition`) —
   *  langue UNIQUE, appliqués par `applyOps` (comme tout effet). */
  ops?: GameOp[];
  /** Éclats (Indice) — `shrapnel` membres d'équipage subissent 9 Dégâts (MDG 13). */
  shrapnel?: number;
  /** Critiques supplémentaires sur la Coque. */
  hullCrits?: Tirage;
  /** « Canon détaché » (MDG 13 l.763-764) : le coup encaissé par l'ÉQUIPAGE (le canon RESTE à bord —
   *  ≠ « Canon perdu », qui utilise l'op `removeShipPoste` dans `ops`, appliquée à la COQUE). */
  crewHit?: ShipCrewHit;
  note: string;
}
export type ShipCritTable = ShipCritEntry[];

/** Localisations de navire dotées d'une table de Critiques (l'Équipage utilise les Critiques de
 *  personnage ; les Équipements n'ont pas d'enum de coque touchable hors leur propre table). */
export type ShipCritKey = Exclude<ShipLocation, 'equipage'>;

/**
 * UNE BANDE de table de hauteur de chute (« Tomber du gréement », `MDG 13 l.684-688`) : les Tailles de
 * bateau couvertes, et la hauteur PAR PRÉSENCE à bord — clé = id de `ship-stations.json`, valeur =
 * `Formula` (un nombre, ou un tirage `{dice}`). La colonne se lit PAR LA CLÉ de station : aucun
 * branchement par id ne vit dans le moteur.
 */
export interface FallHeightBand {
  tailles: string[];
  hauteurs: Record<string, Formula>;
}

/** Table de hauteur de chute — la cible de l'op `fall` (`{ hauteur: { table } }`). */
export interface FallHeightTable {
  id: string;
  label: string;
  bandes: FallHeightBand[];
}

const T = shipCriticalsJson.tables as Record<ShipCritKey, ShipCritTable>;

/** Jeu MDG (mer) — ne couvre QUE ses 5 Localisations navales (pas gouvernail/superstructure, fluviales MSRC).
 *  Type INFÉRÉ (5 clés) → assignable à `Partial<Record<ShipCritKey, …>>` du jeu, sans exiger les clés fluviales. */
export const SHIP_CRITICAL_TABLES = {
  cargaison: T.cargaison,
  greement: T.greement,
  coque: T.coque,
  avirons: T.avirons,
  equipements: T.equipements,
};

/** Jeu de tables de Critiques d'une coque : effet des Éclats (per-règle) + tables par Localisation
 *  (chaque jeu ne couvre QUE ses Localisations — MDG couvre cargaison/équipements, MSRC gouvernail/
 *  superstructure ; la table de Localisation appariée ne produit jamais une clé absente du jeu). */
export interface ShipCritSet {
  die: DeDeTable | null;
  /** id STABLE du jeu — la valeur que porte `hull.criticalTable`. */
  id: string;
  /** Fichier du jeu, racine de l'espace de ses tables (`categorieDeLaNiche`), lié par le type au `file`
   *  de son def. */
  fichier: typeof shipCriticalsDef.file | typeof riverCriticalsDef.file;
  /** Effet des Éclats — le SEUL jeu qui en porte est MDG (mot-clé « Éclats N », ch.13) ; MSRC ne
   *  l'emploie jamais. Absent ⇒ aucune rangée du jeu ne peut porter d'Indice, et `applyHullCritical`
   *  le dit par une anomalie nommée plutôt que par un repli muet. */
  shrapnelHit?: GameOp[];
  /** Localisation qui encaisse un coup à l'Équipage quand PERSONNE n'est exposé — `MDG 13 l.584`
   *  (« le coup touche la Coque », RAW) et `MSRC 07 l.70` (le livre laisse le choix au MJ ; il n'y a
   *  pas de MJ, l'arbitrage est AUTHORÉ et éditable). Le coup n'est jamais abandonné. */
  replisSansExpose: { cible: ShipCritKey; maison?: string };
  /** Tables de hauteur de CHUTE que ce jeu imprime (`MDG 13 l.678-688`) — le fleuve n'en a aucune. */
  tablesDeChute?: FallHeightTable[];
  tables: Partial<Record<ShipCritKey, ShipCritTable>>;
}

/** Jeu MDG (mer, ch.13) — Éclats 9 Dégâts. */
export const SHIP_CRIT_SET: ShipCritSet = {
  get id() { return shipCriticalsJson.id; },
  fichier: 'ship-criticals.json' satisfies typeof shipCriticalsDef.file,
  get die() { return deDeLaTableTiree(shipCriticalsJson); },
  get shrapnelHit() { return shipCriticalsJson.shrapnelHit as GameOp[]; },
  get replisSansExpose() { return shipCriticalsJson.replisSansExpose as { cible: ShipCritKey; maison?: string }; },
  get tablesDeChute() { return shipCriticalsJson.tablesDeChute as FallHeightTable[]; },
  tables: SHIP_CRITICAL_TABLES,
};

/** Jeu MSRC (fleuve, ch.5) — Éclats +5 Dégâts, Localisations Gréement/Rames/Gouvernail/Coque/Superstructure. */
export const RIVER_CRIT_SET: ShipCritSet = {
  get id() { return riverCriticalsJson.id; },
  fichier: 'river-criticals.json' satisfies typeof riverCriticalsDef.file,
  die: null,
  get replisSansExpose() { return riverCriticalsJson.replisSansExpose as { cible: ShipCritKey; maison?: string }; },
  tables: riverCriticalsJson.tables as unknown as Partial<Record<ShipCritKey, ShipCritTable>>,
};

/** Registre des jeux de Critiques de coque, résolus par leur propre `id` lu à l'appel. Ajouter un jeu =
 *  une entrée de PLUS dans cette liste (et son JSON) — aucun branchement à écrire. */
const CRIT_SETS: readonly ShipCritSet[] = [SHIP_CRIT_SET, RIVER_CRIT_SET];

/** Ids des jeux de Critiques RÉELLEMENT chargés, lus à l'appel — vocabulaire fermé de `hull.criticalTable`. */
export const shipCritSetIds = (): string[] => CRIT_SETS.map((s) => s.id);

/** Les tables de chute des jeux CHARGÉS, dans l'ordre de la donnée, lues à l'appel sur l'en-tête vivant
 *  de chaque jeu — CANDIDATS du champ `fall` de l'atelier. Dérivée du registre : un jeu qui en authore
 *  une l'y ajoute sans une ligne de code de plus, et l'atelier ne code aucun id. */
export const fallTables = (): FallHeightTable[] => CRIT_SETS.flatMap((s) => s.tablesDeChute ?? []);

/** Table de hauteur de chute par id (op `fall`) — `undefined` si l'authoring en nomme une inconnue,
 *  que l'appelant NOMME (aucun repli muet : une chute sans hauteur ne serait pas une chute). */
export function findFallTable(id: string): FallHeightTable | undefined {
  return fallTables().find((t) => t.id === id);
}

/** Résout le jeu de Critiques d'une coque par l'id de sa `criticalTable` (`hull.criticalTable`).
 *  Absent/`null` = jeu MDG naval (défaut). Un id INCONNU jette : un repli silencieux résoudrait la
 *  coque fluviale sur les tables maritimes (même coquille d'authoring que `shipHitLocation`). */
export function shipCritSet(id?: string | null): ShipCritSet {
  if (!id) return SHIP_CRIT_SET;
  const set = CRIT_SETS.find((s) => s.id === id);
  if (!set) throw new Error(`shipCritSet : jeu de Critiques de coque inconnu « ${id} » (attendu : ${shipCritSetIds().join(' | ')}).`);
  return set;
}
