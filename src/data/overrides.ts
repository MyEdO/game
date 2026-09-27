/**
 * Seam app-owned : mutation EN PLACE des datasets de la façade (`src/data/index.ts`). On remplace le
 * CONTENU des tableaux exportés sans JAMAIS réassigner le binding → les ~52 consommateurs (qui
 * gardent la même référence d'array) voient les changements en direct. Unique point de branchement :
 *  - l'éditeur de données in-app (preview live avant écriture disque) ;
 *  - la future couche de surcharges PAR CAMPAGNE (apply au chargement, reset à la sortie).
 *
 * Couvre les datasets-TABLEAUX (`ARRAYS`) ET les datasets-OBJETS uniques (`OBJECTS`, E3b) :
 * `details` (objet de config imbriqué), fiches de règle uniques. Tous mutés EN PLACE,
 * jamais réassignés → les consommateurs gardent la même référence et voient l'édition en direct.
 */
import {
  characteristics, species, classes, careers, careerLevels, skills, talents, etats, maladies, traits,
  qualities, qualitySubtypes, qualityTypes, mutations, mutationTables, trappings, weaponGroups, breathTypes, damageTypes, creatures, spells, maneuvers, domains, lightLevels, lightTones, props, eyes, hairs, stars, locations, books, raceAppearance, gods, structures,
  materials, terrains, buildings,
  pregens, oups, interludeEvents, peripeties, details, semencesDeScene, defautsDeCompilation, names, allAxes,
  calendarMonths, calendarIntercalary, calendarWeekdays, calendarPhases, weather, weatherConditions, symptoms,
  massBattleWarMachines, massBattleStructures, massBattleHazards, massBattleMightModifiers, massBattlePowerEstimate, massBattleData,
  vehicles, celestialHouses, groups, psychologies, seaShanties, crewRoles, crewTestTypes, shipStations, NAVAL_TRAITS,
  WATER_EXPOSURE, navalPorts,
  navalProgression, seaNavigation, seaPerils, seaWeather, shipConstruction,
  disponibilite, riverNavigation,
  GRAPPLE, NIGHT_STAKES, VOYAGE_STAKES, FLOW_STAKES, COMBAT_STAKES,
  windsOfMagicTable,
} from './index';
// #157 : catalogues de CONTENU déjà chargés par un module dédié (`src/data/*.ts` ou `src/engine/*.ts`,
// pas la façade `index.ts`) — importés DIRECTEMENT ici (même patron que `massBattle*` ci-dessus, qui
// vient déjà d'`engine/massBattle.ts`). Le module JSON est un singleton ESM : cette référence EST la
// même que celle lue par le moteur → l'édition Codex (splice en place) reste visible en jeu.
import type { RefDesignee } from './schemas/grammaire/ref';
import { versDisque } from './schemas/grammaire/prose';
import { ACTIVITIES } from '../engine/activities';
import { MOUNT_PROFILES } from '../engine/mountTravel';
import { MOUNT_INCIDENTS, VEHICLE_PROBLEMS, encounterTable } from '../engine/travelTables';
import { TAVERN_GAMES } from '../engine/tavernGame';
import { OBSESSIONS } from './obsessions';
import { STRUCTURE_CRITICALS } from './structureCriticals';
import { LAND_CARGO_ENTRIES, type LandCargoEntry } from '../engine/landCargo';
import { CARGO_ENTRIES, type CargoEntry, MANANN_FACTORS, BOARD_EVENTS, PORT_EVENTS } from '../engine/seaVoyage';
import { RIVER_PERILS } from '../engine/riverNavigation';
import { MORALE_FACTORS, MORALE_BANDS } from '../engine/crewMorale';
import { STEAM_BREAKDOWNS } from '../engine/shipBuild';
import weatherRawJson from './weather.json';
import crewTestTypesRawJson from './crew-test-types.json';
import landCargoRawJson from './land-cargo.json';
import seaCargoRawJson from './sea-cargo.json';
import riverPerilsRawJson from './river-perils.json';
import crewMoraleRawJson from './crew-morale.json';
import { DATASET_FICHIER_DERIVE, DATASETS_EDITABLES_DERIVE } from './schemas/exposition-derivee';
import { poserSourceDIdsVivants } from './schemas/grammaire/idsVivants';
import { bumperDataset, versionDuDataset } from './versionDataset';
import { critiqueEntries, type CritEntry } from './criticals';
import { SHIP_CRITICAL_TABLES, RIVER_CRIT_SET } from './shipCriticals';
import type { GameOp } from '../engine/ops';
import type { SourceRef } from './schemas/grammaire/valeurs';
import criticalsRawJson from './criticals.json';
import traumasRawJson from './traumas.json';
import shipCriticalsRawJson from './ship-criticals.json';
import riverCriticalsRawJson from './river-criticals.json';
import rencontresRawJson from './rencontres-edoc.json';
import seaEventsRawJson from './sea-events.json';
// LOT 1 #422 : famille RÈGLES LDB — Coût des Augmentations (07), % de Disponibilité (59), Accidents de
// Conduite d'attelage (09) et Ivresse (09) NICHÉS dans un objet `{table,source}` (même patron que
// `incidents-monture.json`/`problemes-vehicule.json`), Surchargé par palier (61).
import advancementCostsRawJson from './advancementCosts.json';
import drivingMishapRawJson from './driving-mishap.json';
import drunkennessRawJson from './drunkenness.json';
import encumbranceTiersRawJson from './encumbranceTiers.json';
import type { MishapEntry } from '../engine/drivingMishap';
import type { DrunkEntry } from '../engine/drunkenness';
// LOT 3 #422 (FINAL) : dernières 3 exemptions AUDIT — Empoignade (LDB 14, fiche de règle UNIQUE, même
// patron que `disponibilite`/`riverNavigation`), Incantations Imparfaites/Colère des dieux (LDB 46/40,
// 3 tables NICHÉES dans `miscast.json`, même patron que `criticalsTete`/`aaCriticalsTete`), enjeux de
// la cascade de nuit (`night-stakes.json`, tableau RACINE, nom de fichier kebab-case divergent).
import miscastRawJson from './miscast.json';
// Tailles (`sizes.json`) : ses 3 tables sont lues par `engine/size.ts` (dont deux via une référence
// capturée sur la table NICHÉE) — d'où la fusion EN PLACE récursive de `setObjectDataset`.
import sizesRawJson from './sizes.json';
// #851 : Magie environnementale (VDM 14, `arcane-phenomena.json`) — fiche de règle UNIQUE portant 4
// tableaux frères NICHÉS (`saturationLevels`/`windSaturationEffects`/`phenomena`/`tables`, même patron
// que `sizes`/`waterExposure`). Importé RAW (comme `sizesRawJson`) : `data/arcanePhenomena.ts` (lu par
// `engine/magicEnvironment.ts`) importe le MÊME module JSON singleton, sans index précalculé — une
// édition Compendium reste visible en direct, sans rechargement de page.
import arcanePhenomenaRawJson from './arcane-phenomena.json';
import type { SaturationLevel, WindSaturationEffects, ArcanePhenomenon, ArcaneTable } from './arcanePhenomena';
// V9 #1318 : registre des règles optionnelles (`engine/policy.ts`, tableau RACINE) et Tableau de
// Surincantation (VDM 02, tableau NICHÉ dans `{source,ref,table}`) — importés comme les autres
// datasets migrés du CODE en donnée, MÊME module JSON singleton que leur lecteur moteur.
import { OPTIONAL_RULES } from '../engine/policy';
import surincantationRawJson from './surincantation.json';
// #1467 L1b V-FLIP-TABLE : les 7 documents dont le tableau ÉDITÉ est NICHÉ sous leur enveloppe — la
// racine à réécrire au save est le DOCUMENT entier, jamais le tableau nu (5 clefs y étaient sans
// root déclaré et auraient écrasé leur enveloppe ; 2 documents deviennent éditables ici).
import monturesRawJson from './montures.json';
import incidentsMontureRawJson from './incidents-monture.json';
import problemesVehiculeRawJson from './problemes-vehicule.json';
import structureCriticalsRawJson from './structure-criticals.json';
import obsessionsRawJson from './obsessions.json';
import artilleryMisfireRawJson from './artillery-misfire.json';
import ventsTourbillonnantsRawJson from './vents-tourbillonnants.json';
import { ARTILLERY_MISFIRE } from './artilleryMisfire';

/** Entrée d'une table de miscast (`entries` d'un document de `miscast.json`) — DIALECTE compilé (PAS
 *  des `GameOp` standard, cf. `engine/miscast.ts::JsonRow`) : `ops`/`test` restent au format JSON brut
 *  du dialecte (sin-paramétrage), projetés par un renderer DÉDIÉ côté Codex (jamais `passiveSection`,
 *  qui suppose de vrais `GameOp`). */
export interface MiscastRowEntry {
  id: string; min: number; max: number; label: string;
  ops?: Record<string, unknown>[];
  test?: { skill?: RefDesignee; characteristic?: string; difficulty: string; onFail: Record<string, unknown>[]; onFailHard?: { dr: number; ops: Record<string, unknown>[] } };
  reroll?: 'majeure' | 'mineure-x2';
  source?: SourceRef;
}
/** Les DOCUMENTS de `miscast.json` (un par tableau tirable) — la racine sérialisée au save. */
const miscastRoot = miscastRawJson as unknown as { id: string; entries: MiscastRowEntry[] }[];
/** Rangées LIVE d'UN tableau, par id de DOCUMENT — FAIL-FAST : un id absent laisserait une catégorie
 *  Codex sur un tableau vide, sans un mot. */
function miscastEntries(tableId: string): MiscastRowEntry[] {
  const doc = miscastRoot.find((d) => d.id === tableId);
  if (!doc) throw new Error(`miscastEntries : tableau « ${tableId} » absent de miscast.json (ids : ${miscastRoot.map((d) => d.id).join(', ')}).`);
  return doc.entries;
}

/** Fiche de Traumatisme (`traumas.json`, #157) — MÊME schéma que `engine/trauma.ts::TraumaFiche`
 *  (module-privé là-bas, redéclaré ici a minima pour le seam d'édition ; `traumaFicheById` reste la
 *  SOURCE de vérité runtime, ce type ne sert qu'au dataset éditable). */
export interface TraumaFicheEntry {
  id: string; label: string; desc: string; ops?: GameOp[];
  kind?: 'dechirure' | 'fracture'; severity?: 'mineur' | 'majeur';
  prosthesis?: { trappingId: string; cancels: 'all' | 'movement' }[];
}
const traumas = traumasRawJson as TraumaFicheEntry[];

/** Entrée de table de Blessures Critiques par Localisation (LDB 18 « Traumatisme » ET AA « approche
 *  alternative ») — MÊME schéma pour les DEUX jeux depuis leur fusion (#1657 B2a). ALIAS de `CritEntry`
 *  (`src/data/criticals.ts`), la SEULE déclaration de la forme : une redéclaration structurelle en
 *  amputait `source`, `escalation` et les champs d'`Amputation` (`timing`/`loss`/`unites`), si bien que
 *  le Codex ne pouvait pas voir ce que le moteur joue. */
export type CritTableEntry = CritEntry;
// Les 8 documents-tables de `criticals.json` (4 Localisations × 2 jeux) — rangées LIVE par id de
// DOCUMENT (`critiqueEntries`, même référence que le moteur, patron `miscastEntries`).
const criticalsTete = critiqueEntries('criticals-ldb-tete');
const criticalsBras = critiqueEntries('criticals-ldb-bras');
const criticalsCorps = critiqueEntries('criticals-ldb-corps');
const criticalsJambe = critiqueEntries('criticals-ldb-jambe');
const aaCriticalsTete = critiqueEntries('criticals-aa-tete');
const aaCriticalsBras = critiqueEntries('criticals-aa-bras');
const aaCriticalsCorps = critiqueEntries('criticals-aa-corps');
const aaCriticalsJambe = critiqueEntries('criticals-aa-jambe');

/** 3 catégories de Rencontres de voyage (EDOC 8, `rencontres-edoc.json`) — `encounterTable` retourne
 *  la table LIVE (accès de propriété sur le JSON importé par `engine/travelTables.ts`, jamais une copie). */
const rencontresPositives = encounterTable('positives');
const rencontresFortuites = encounterTable('fortuites');
const rencontresDangereuses = encounterTable('dangereuses');

/** Datasets-tableaux mutables (clé éditeur → MÊME référence d'array que l'export de la façade). */
const ARRAYS = {
  characteristics, species, classes, careers, careerLevels, skills, talents, etats, maladies, traits,
  qualities, qualitySubtypes, qualityTypes, mutations, mutationTables, trappings, weaponGroups, breathTypes, damageTypes, creatures, spells, maneuvers, domains, lightLevels, lightTones, props, eyes, hairs, stars, locations, books, raceAppearance, gods, structures,
  // Matières du monde (#1686) : UN document, le domaine PORTÉ par l'entrée. Ce binding EST le seam de
  // mutation en place, et c'est lui qui rend vive la lecture des vues par domaine (`matieresDe`,
  // `src/data/index.ts`) : une matière retouchée se voit au rendu sans rechargement. Son def déclare
  // `exposition.edit` = `dataset` (lot 3a-2) : la clé a sa route de sauvegarde vers `materials.json`,
  // et l'onglet Codex « Matières » l'édite.
  materials,
  // Terrains du monde (#1690) : UN document, règle et rendu dans la même entrée. Ce binding EST le
  // seam de mutation en place, et c'est lui qui rend vive la lecture de la façade `src/state/terrain`
  // et du catalogue `gameIso/catalog/terrain` — tous deux indexent le TABLEAU et revérifient son
  // contenu à chaque accès (`indexDesTerrains`), un splice étant invisible à l'identité du tableau.
  terrains,
  // Types de bâtiment (#1715) : UN document, l'empreinte et la couverture offertes à la pose plus les
  // ornements d'identité. Ce binding EST le seam de mutation en place ; la façade
  // `src/state/buildings` reconstruit son index au témoin de VERSION du dataset, si bien
  // qu'une entrée éditée au Codex se voit dans l'éditeur et au rendu sans rechargement.
  buildings,
  pregens, oups, interludeEvents, peripeties, names,
  // Axes de forces/faiblesses (#409) — mécanique MAISON, éditable au Codex comme tout catalogue.
  axes: allAxes,
  calendarMonths, calendarIntercalary, calendarWeekdays, calendarPhases, weather, weatherConditions, symptoms,
  massBattleWarMachines, massBattleStructures, massBattleHazards, massBattleMightModifiers, massBattlePowerEstimate,
  // #168 : catalogue UNIQUE des Activités (interlude/voyage/mer/bataille de masse) exposé au Codex —
  // MÊME référence d'array que le moteur (`engine/activities.ts::ACTIVITIES`, singleton JSON) → l'édition
  // Codex (splice en place) reste visible en jeu. Fichier `activities.json` (défaut), racine = le tableau.
  activities: ACTIVITIES,
  // #157 : catalogues de CONTENU app-owned (façade `index.ts` ou module dédié), exposés au Codex.
  vehicles, celestialHouses, groups, psychologies, seaShanties, crewRoles, crewTestTypes, shipStations, navalTraits: NAVAL_TRAITS,
  montures: MOUNT_PROFILES, incidentsMonture: MOUNT_INCIDENTS, problemesVehicule: VEHICLE_PROBLEMS,
  tavernGames: TAVERN_GAMES, obsessions: OBSESSIONS as unknown as { min: number; max: number; label: string }[],
  structureCriticals: STRUCTURE_CRITICALS, traumas,
  // Catalogues de cargaison : le dataset éditable est le tableau BRUT du JSON (marchandises ET
  // marqueurs de l'Index), pas la vue filtrée `CARGOES`/`LAND_CARGOES` — sinon une réécriture du
  // dataset perdrait les marqueurs. Le Compendium, lui, n'affiche que les marchandises (filtre à la
  // VUE, `ui/compendium/registry.ts`).
  landCargo: LAND_CARGO_ENTRIES as LandCargoEntry[], seaCargo: CARGO_ENTRIES as CargoEntry[], riverPerils: RIVER_PERILS,
  crewMoraleFactors: MORALE_FACTORS, crewMoraleBands: MORALE_BANDS, steamBreakdowns: STEAM_BREAKDOWNS,
  criticalsTete, criticalsBras, criticalsCorps, criticalsJambe,
  aaCriticalsTete, aaCriticalsBras, aaCriticalsCorps, aaCriticalsJambe,
  // #157 (suite) : jeux de Critiques de coque — MDG 13 (navire) / MSRC 7 (fluvial) — nichés PAR
  // Localisation dans LEUR fichier (même patron que `criticals.json` ci-dessus).
  shipCriticalsCargaison: SHIP_CRITICAL_TABLES.cargaison,
  shipCriticalsGreement: SHIP_CRITICAL_TABLES.greement,
  shipCriticalsCoque: SHIP_CRITICAL_TABLES.coque,
  shipCriticalsAvirons: SHIP_CRITICAL_TABLES.avirons,
  shipCriticalsEquipements: SHIP_CRITICAL_TABLES.equipements,
  riverCriticalsGreement: RIVER_CRIT_SET.tables.greement!,
  riverCriticalsAvirons: RIVER_CRIT_SET.tables.avirons!,
  riverCriticalsGouvernail: RIVER_CRIT_SET.tables.gouvernail!,
  riverCriticalsCoque: RIVER_CRIT_SET.tables.coque!,
  riverCriticalsSuperstructure: RIVER_CRIT_SET.tables.superstructure!,
  // Rencontres de voyage (EDOC 8) : 3 catégories NICHÉES dans `rencontres-edoc.json`.
  rencontresPositives, rencontresFortuites, rencontresDangereuses,
  // Longs voyages en mer (MDG 15) : Humeur de Manann (facteurs) + Événements de bord/de port —
  // 3 tableaux frères NICHÉS dans `sea-events.json`.
  seaManannFactors: MANANN_FACTORS, seaBoardEvents: BOARD_EVENTS, seaPortEvents: PORT_EVENTS,
  // LOT 1 #422 : Ports (MDG 15), Progression de navire (MDG 13) et 3 sous-tableaux de
  // Construction navale (MDG 12) — `navalPorts` est DÉJÀ un tableau racine ; les 4 autres sont des
  // sous-tableaux NICHÉS dans un objet-config parent (`navalProgression.entries`, `shipConstruction.*`,
  // même patron que `seaManannFactors`/`seaBoardEvents`/`seaPortEvents` ci-dessus) — `NESTED_ARRAY_ROOT`
  // réécrit le PARENT entier au save.
  navalPorts,
  navalProgression: navalProgression.entries,
  shipHullSizes: shipConstruction.standard,
  shipSpeedTraits: shipConstruction.speedTraits,
  shipConstructionTraits: shipConstruction.constructionTraits,
  // LOT 1 #422 : famille RÈGLES LDB — Coût des Augmentations (tableau RACINE) ; Accidents de Conduite
  // d'attelage / Ivresse (tableaux NICHÉS sous `entries`, MÊME référence que le moteur — accès de
  // propriété, jamais une copie) ; Surchargé par palier (tableau RACINE).
  advancementCosts: advancementCostsRawJson,
  drivingMishap: drivingMishapRawJson.entries as MishapEntry[],
  drunkenness: drunkennessRawJson.entries as DrunkEntry[],
  encumbranceTiers: encumbranceTiersRawJson,
  // LOT 3 #422 (FINAL) : Incantations Imparfaites Mineures/Majeures (LDB 46) + Colère des dieux (LDB 40)
  // — les rangées de 3 des 5 DOCUMENTS de `miscast.json`, adressées par leur id (#1467 L1b).
  miscastMinor: miscastEntries('miscast-mineure'),
  miscastMajor: miscastEntries('miscast-majeure'),
  miscastWrath: miscastEntries('miscast-colere'),
  // LOT 3 #422 (FINAL) : enjeux des cascades — chaque binding écrit EST la racine de son fichier
  // (tableau RACINE, pas un tableau niché sous une enveloppe). Le fichier disque ne se déduit pas de
  // la clé JS : il est DÉRIVÉ de l'`exposition.edit` du def (`nightStakes` → `night-stakes.json`) ;
  // les trois autres sont `edit:{none}` (lecture seule au Codex), donc sans fichier de sauvegarde.
  nightStakes: NIGHT_STAKES,
  voyageStakes: VOYAGE_STAKES,
  flowStakes: FLOW_STAKES,
  combatStakes: COMBAT_STAKES,
  // V9 #1318 : registre des RÈGLES OPTIONNELLES (tableau RACINE de `reglesOptionnelles.json`) —
  // MÊME référence que `engine/policy.ts::OPTIONAL_RULES` (singleton JSON) ; Tableau de
  // Surincantation (VDM 02) NICHÉ dans `surincantation.json` (sous `entries`, même patron que
  // `drivingMishap`/`drunkenness`), MÊME référence que celle lue par `engine/overcast.ts`.
  reglesOptionnelles: OPTIONAL_RULES,
  surincantation: surincantationRawJson.entries,
  // #1467 L1b V-FLIP-TABLE : deux tableaux déjà EXPOSÉS au Codex (`artilleryMisfire`,
  // `ventsTourbillonnants`) qui n'étaient pas ÉDITABLES — même couture que leurs 13 frères, aucun
  // régime à part. MÊME référence que le moteur (`engine/artilleryMisfire.ts`, `engine/windsOfMagic.ts`).
  artilleryMisfire: ARTILLERY_MISFIRE,
  ventsTourbillonnants: windsOfMagicTable,
} as const;

export type DatasetKey = keyof typeof ARRAYS;
export const DATASET_KEYS = Object.keys(ARRAYS) as DatasetKey[];

/** `arcane-phenomena.json` (#851) : 4 tableaux frères NICHÉS — mêmes types que `data/arcanePhenomena.ts`. */
interface ArcanePhenomenaFile {
  saturationLevels: SaturationLevel[]; windSaturationEffects: WindSaturationEffects[];
  phenomena: ArcanePhenomenon[]; tables: ArcaneTable[];
}
const arcanePhenomenaFile = arcanePhenomenaRawJson as unknown as ArcanePhenomenaFile;

/** Datasets-OBJETS uniques (E3b) : pas un tableau d'entités mais UN objet de config (`details`) ou
 *  une fiche de règle UNIQUE (`waterExposure`, MSRC 16 — #157 suite). Mutés
 *  EN PLACE (mêmes garanties que les tableaux) → preview live + écriture disque par l'éditeur du Codex.
 *  Le fichier disque est `<clé>.json` par défaut (`details.json`) ou l'override
 *  `OBJECT_FILE` pour une clé dont le nom diverge du fichier (`waterExposure` → `water-exposure.json`). */
const OBJECTS = {
  details, waterExposure: WATER_EXPOSURE,
  // #1716 : semences d'une scène NEUVE (`emptyScene`) — objet de config unique, même patron que `details`.
  semencesDeScene,
  // #1716 : défauts du COMPILATEUR de scène (`mapSpec`) — même patron, autre moment (compiler, pas créer).
  defautsDeCompilation,
  // LOT 1 #422 : 3 fiches de règle UNIQUES (MDG 13) — même patron que `waterExposure` (MSRC 16).
  seaNavigation, seaPerils, seaWeather,
  // LOT 1 #422 (suite) : Disponibilité & Troc (LDB 59) — fiche de règle UNIQUE, même patron.
  disponibilite,
  // LOT 2 #422 : Navigation fluviale (MSRC 7) — fiche de règle UNIQUE, même patron.
  riverNavigation,
  // LOT 3 #422 (FINAL) : Empoignade (LDB 14) — fiche de règle UNIQUE, même patron.
  grapple: GRAPPLE,
  // Barres par catégorie de Taille (mod de tir LDB 14, Enc à bord MDG 12, empreinte de grille MAISON) —
  // fiche de règle UNIQUE, même patron ; les 3 tables sont NICHÉES (cf. la fusion en place ci-dessous).
  sizes: sizesRawJson,
  // #851 : Magie environnementale (VDM 14) — fiche de règle UNIQUE, même patron, 4 tableaux NICHÉS.
  arcanePhenomena: arcanePhenomenaFile,
} as const;
export type ObjectDatasetKey = keyof typeof OBJECTS;
export const OBJECT_DATASET_KEYS = Object.keys(OBJECTS) as ObjectDatasetKey[];

/** Tableau live d'un dataset (même référence que l'export façade → lecture/itération par les consommateurs). */
export function datasetArray<K extends DatasetKey>(key: K): (typeof ARRAYS)[K] {
  return ARRAYS[key];
}

/** Objet live d'un dataset-objet (même référence que l'export façade → vue live des consommateurs). */
export function datasetObject<K extends ObjectDatasetKey>(key: K): (typeof OBJECTS)[K] {
  return OBJECTS[key];
}

/** Fichier disque d'un dataset-OBJET dont la clé JS diverge du nom de fichier (tout fichier de
 *  `src/data` est kebab-case) — pendant, pour `OBJECTS`, de la dérivation `DATASET_FICHIER_DERIVE`.
 *  Absente d'ici → `<clé>.json` (défaut historique, zéro changement pour `details`). */
const OBJECT_FILE: Partial<Record<ObjectDatasetKey, string>> = {
  waterExposure: 'water-exposure.json',
  seaNavigation: 'sea-navigation.json',
  seaPerils: 'sea-perils.json',
  seaWeather: 'sea-weather.json',
  riverNavigation: 'river-navigation.json',
  arcanePhenomena: 'arcane-phenomena.json',
  semencesDeScene: 'semences-de-scene.json',
  defautsDeCompilation: 'defauts-de-compilation.json',
};
/** Fichier disque d'un dataset-objet (`<clé>.json` par défaut, ou l'override `OBJECT_FILE`). */
export function datasetObjectFile(key: ObjectDatasetKey): string {
  return OBJECT_FILE[key] ?? `${key}.json`;
}

/** Seeds immuables (clone du JSON d'origine), capturés à l'init du module — pour `resetData()`. */
const SEED = Object.fromEntries(
  DATASET_KEYS.map((k) => [k, structuredClone(ARRAYS[k] as unknown[])]),
) as Record<DatasetKey, unknown[]>;
const OBJECT_SEED = Object.fromEntries(
  OBJECT_DATASET_KEYS.map((k) => [k, structuredClone(OBJECTS[k])]),
) as Record<ObjectDatasetKey, object>;

/** Remplace EN PLACE le contenu d'un dataset (jamais de réassignation du binding) et VERSIONNE
 *  l'écriture — l'identité du tableau ne bougeant pas, la version est le seul témoin qu'un index
 *  mémoïsé (`indexParId`, `data/index.ts`) puisse consulter (#1692). */
export function setDataset<K extends DatasetKey>(key: K, next: readonly (typeof ARRAYS)[K][number][]): void {
  const arr = ARRAYS[key] as unknown[];
  arr.splice(0, arr.length, ...(next as readonly unknown[]));
  bumperDataset(key);
}

/** Datasets-tableaux NICHÉS sous une enveloppe ou dans un fichier-objet PARTAGÉ : `mass-battle.json`
 *  porte 5 tableaux frères dans UN seul fichier. Mêmes garanties de mutation en place que `ARRAYS`
 *  (`setDataset` fonctionne tel quel sur ces clés), mais le CONTENU à sérialiser au save diverge : il
 *  faut réécrire le PARENT ENTIER (`massBattleData`), sous peine d'écraser les tableaux frères — ou
 *  l'enveloppe du document — avec un tableau nu. `datasetSerializeRoot` retombe sur le tableau lui-même
 *  pour toute clé absente d'ici. Cette table ne porte QUE la racine à sérialiser : le FICHIER, lui,
 *  se DÉRIVE du def porteur (`DATASET_FICHIER_DERIVE`, #1530), source unique de `datasetFile`. */
const NESTED_ARRAY_ROOT: Partial<Record<DatasetKey, { root: () => unknown }>> = {
  massBattleWarMachines: { root: () => massBattleData },
  massBattleStructures: { root: () => massBattleData },
  massBattleHazards: { root: () => massBattleData },
  massBattleMightModifiers: { root: () => massBattleData },
  massBattlePowerEstimate: { root: () => massBattleData },
  // Blessures critiques, LES DEUX jeux (#1657 B2a) : rangées NICHÉES dans l'un des 8 documents-tables
  // de `criticals.json` — réécrire la LISTE entière au save (les 7 documents frères doivent survivre),
  // même patron que `miscast.json`.
  criticalsTete: { root: () => criticalsRawJson },
  criticalsBras: { root: () => criticalsRawJson },
  criticalsCorps: { root: () => criticalsRawJson },
  criticalsJambe: { root: () => criticalsRawJson },
  aaCriticalsTete: { root: () => criticalsRawJson },
  aaCriticalsBras: { root: () => criticalsRawJson },
  aaCriticalsCorps: { root: () => criticalsRawJson },
  aaCriticalsJambe: { root: () => criticalsRawJson },
  // Critiques de coque (MDG 13, navire) : 5 Localisations NICHÉES dans `ship-criticals.json`.
  shipCriticalsCargaison: { root: () => shipCriticalsRawJson },
  shipCriticalsGreement: { root: () => shipCriticalsRawJson },
  shipCriticalsCoque: { root: () => shipCriticalsRawJson },
  shipCriticalsAvirons: { root: () => shipCriticalsRawJson },
  shipCriticalsEquipements: { root: () => shipCriticalsRawJson },
  // Critiques de coque (MSRC 7, fluvial) : 5 Localisations NICHÉES dans `river-criticals.json`.
  riverCriticalsGreement: { root: () => riverCriticalsRawJson },
  riverCriticalsAvirons: { root: () => riverCriticalsRawJson },
  riverCriticalsGouvernail: { root: () => riverCriticalsRawJson },
  riverCriticalsCoque: { root: () => riverCriticalsRawJson },
  riverCriticalsSuperstructure: { root: () => riverCriticalsRawJson },
  // Rencontres de voyage (EDOC 8) : 3 catégories NICHÉES dans `rencontres-edoc.json`.
  rencontresPositives: { root: () => rencontresRawJson },
  rencontresFortuites: { root: () => rencontresRawJson },
  rencontresDangereuses: { root: () => rencontresRawJson },
  // Longs voyages en mer (MDG 15) : 3 tableaux frères NICHÉS dans `sea-events.json`.
  seaManannFactors: { root: () => seaEventsRawJson },
  seaBoardEvents: { root: () => seaEventsRawJson },
  seaPortEvents: { root: () => seaEventsRawJson },
  // LOT 1 #422 : Progression de navire (1 tableau NICHÉ dans `naval-progression.json`) et 3 sous-tableaux
  // de Construction navale NICHÉS dans `ship-construction.json` — réécrire le PARENT entier au save.
  navalProgression: { root: () => navalProgression },
  shipHullSizes: { root: () => shipConstruction },
  shipSpeedTraits: { root: () => shipConstruction },
  shipConstructionTraits: { root: () => shipConstruction },
  // LOT 1 #422 : Accidents de Conduite d'attelage / Ivresse — tableau NICHÉ sous `entries` dans
  // `driving-mishap.json`/`drunkenness.json`, réécrire le PARENT entier au save (l'enveloppe doit survivre).
  drivingMishap: { root: () => drivingMishapRawJson },
  drunkenness: { root: () => drunkennessRawJson },
  // LOT 3 #422 (FINAL) : miscast — rangées NICHÉES dans l'un des 5 documents de `miscast.json`,
  // réécrire la LISTE entière au save (les 4 documents frères doivent survivre).
  miscastMinor: { root: () => miscastRoot },
  miscastMajor: { root: () => miscastRoot },
  miscastWrath: { root: () => miscastRoot },
  // V9 #1318 : Tableau de Surincantation NICHÉ sous `entries` — réécrire le PARENT entier au save
  // (l'enveloppe du document doit survivre à l'édition des rangées).
  surincantation: { root: () => surincantationRawJson },
  // #1467 L1b V-FLIP-TABLE : les 14 documents uniques de la vague portent une ENVELOPPE (id/type/
  // label/source). Sans entrée ici, `datasetSerializeRoot` rendait le TABLEAU NU et le save écrasait
  // l'enveloppe — 5 clés étaient dans ce cas. Les 2 dernières naissent éditables avec leur entrée.
  montures: { root: () => monturesRawJson },
  incidentsMonture: { root: () => incidentsMontureRawJson },
  problemesVehicule: { root: () => problemesVehiculeRawJson },
  structureCriticals: { root: () => structureCriticalsRawJson },
  obsessions: { root: () => obsessionsRawJson },
  artilleryMisfire: { root: () => artilleryMisfireRawJson },
  ventsTourbillonnants: { root: () => ventsTourbillonnantsRawJson },
  // #1530 : clés dont le tableau est NICHÉ sous l'enveloppe de son document — sans root ici, le save
  // sérialisait le tableau NU par-dessus le document (l'enveloppe et les tableaux frères mouraient).
  weather: { root: () => weatherRawJson },
  weatherConditions: { root: () => weatherRawJson },
  crewTestTypes: { root: () => crewTestTypesRawJson },
  landCargo: { root: () => landCargoRawJson },
  seaCargo: { root: () => seaCargoRawJson },
  riverPerils: { root: () => riverPerilsRawJson },
  crewMoraleFactors: { root: () => crewMoraleRawJson },
  crewMoraleBands: { root: () => crewMoraleRawJson },
};
/** Fichier disque d'un dataset-tableau (`<clé>.json` par défaut ; le fichier PARENT pour un tableau niché). */
export function datasetFile(key: DatasetKey): string {
  const fichier = DATASET_FICHIER_DERIVE[key];
  if (fichier === undefined || !DATASETS_EDITABLES_DERIVE.has(key)) {
    throw new Error(
      `datasetFile('${key}') : aucun document de \`SCHEMA_DEFS\` ne déclare l'édition de ce dataset ` +
        `(\`exposition.edit\` = dataset ou niche) — sans route d'édition déclarée il n'y a pas de fichier ` +
        `de sauvegarde : déclarer au def, ou ne pas sauvegarder.`,
    );
  }
  return fichier;
}

/**
 * SOURCE VIVANTE DES IDS (#1686 lot 3a-2) — le second régime de `_ids.generated.ts`, posé ICI parce que
 * c'est ici que vivent les bindings mutés en place : une entité créée ou renommée à l'atelier est
 * référençable par la donnée AVANT tout `npm run gen` (`ref.ts` lit ce seam à chaque validation).
 *
 * PÉRIMÈTRE : TOUS les datasets-TABLEAUX du seam (`ARRAYS`), éditables ou non — chacun a son fichier
 * déclaré au def (`DATASET_FICHIER_DERIVE`), un dataset sans fichier lève, nommément. NICHÉS EXCLUS —
 * un tableau niché (`mass-battle.json` en porte 5, `criticals.json` 8) n'est pas la liste d'entrées de
 * son document, et son fichier désigne le PARENT. Un fichier revendiqué par DEUX datasets non nichés
 * serait une ambiguïté : elle lève, nommément.
 */
const DATASET_DU_FICHIER: Record<string, DatasetKey> = {};
for (const cle of DATASET_KEYS) {
  const fichier = DATASET_FICHIER_DERIVE[cle];
  if (fichier === undefined) {
    throw new Error(
      `ids vivants : le dataset '${cle}' n'a aucun fichier déclaré — son def le nomme (\`exposition.edit\` : ` +
        `\`dataset\`, \`niche\`, ou \`none\` + \`dataset\`).`,
    );
  }
  if (NESTED_ARRAY_ROOT[cle]) continue;
  if (DATASET_DU_FICHIER[fichier]) {
    throw new Error(
      `ids vivants : le fichier '${fichier}' est revendiqué par DEUX datasets-tableaux non nichés — ` +
        `un fichier, une liste d'entrées : trancher au def (\`exposition.edit\`).`,
    );
  }
  DATASET_DU_FICHIER[fichier] = cle;
}
poserSourceDIdsVivants({
  entrees: (fichier) => {
    const cle = DATASET_DU_FICHIER[fichier];
    return cle === undefined ? undefined : (ARRAYS[cle] as unknown as readonly Record<string, unknown>[]);
  },
  version: (fichier) => {
    const cle = DATASET_DU_FICHIER[fichier];
    return cle === undefined ? 0 : versionDuDataset(cle);
  },
});

/** Ce dataset a-t-il une route d'ÉDITION déclarée ? (sinon `datasetFile` refuse — #1530) */
export function datasetEditable(key: DatasetKey): boolean {
  return DATASETS_EDITABLES_DERIVE.has(key);
}
/** Racine à SÉRIALISER au save (le tableau lui-même par défaut ; l'objet PARENT entier pour un tableau
 *  niché — ses tableaux frères doivent survivre à l'édition d'un seul), en FORME DISQUE.
 *
 *  `versDisque` est la porte UNIQUE entre la forme RUNTIME (le `desc` d'une entrée adressée est
 *  matérialisé par le plugin `wfrp:prose-source` au chargement du module JSON) et la forme DISQUE
 *  (`desc` ⊕ `descRef`, `schemas/grammaire/prose.ts`) : sans elle, un save réécrirait la prose du
 *  livre DANS la donnée, et le schéma la refuserait. Elle rend une COPIE — le dataset vivant n'est
 *  jamais amputé. */
export function datasetSerializeRoot(key: DatasetKey): unknown {
  return versDisque(NESTED_ARRAY_ROOT[key]?.root() ?? datasetArray(key));
}

/** Racine à SÉRIALISER au save d'un dataset-OBJET (fiches de règle, `details`…), en FORME DISQUE —
 *  la porte SYMÉTRIQUE de `datasetSerializeRoot` pour l'autre branche de sauvegarde de `CodexEdit`.
 *  `datasetObject` sert la lecture RUNTIME (même référence que la façade) : la sortie disque passe
 *  par ici, sinon un `desc` matérialisé repartirait dans la donnée et le schéma refuserait le save. */
export function datasetObjectSerializeRoot(key: ObjectDatasetKey): unknown {
  return versDisque(datasetObject(key));
}

const isPlainObject = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

/** Fusion EN PLACE RÉCURSIVE : les sous-objets et sous-tableaux gardent leur identité (mutés par
 *  `mergeInPlace`/`splice`), seules les feuilles sont réassignées ; une clé absente de `next` est
 *  supprimée. Nécessaire parce qu'un consommateur peut capturer une table NICHÉE (`engine/size.ts`
 *  garde `sizesJson.rangedMod`) : une réassignation du parent lui laisserait une référence morte. */
function mergeInPlace(target: Record<string, unknown>, next: Record<string, unknown>): void {
  for (const k of Object.keys(target)) if (!(k in next)) delete target[k];
  for (const [k, v] of Object.entries(next)) {
    const cur = target[k];
    if (Array.isArray(cur) && Array.isArray(v)) cur.splice(0, cur.length, ...v);
    else if (isPlainObject(cur) && isPlainObject(v)) mergeInPlace(cur, v);
    else target[k] = v;
  }
}

/** Remplace EN PLACE le contenu d'un dataset-objet (réf stable, jusqu'aux tables nichées). */
export function setObjectDataset<K extends ObjectDatasetKey>(key: K, next: (typeof OBJECTS)[K]): void {
  mergeInPlace(OBJECTS[key] as Record<string, unknown>, next as Record<string, unknown>);
  bumperDataset(key);
}

/** Réinitialise tous les datasets (tableaux ET objets) au seed d'origine (JSON app-owned). */
export function resetData(): void {
  for (const k of DATASET_KEYS) {
    const arr = ARRAYS[k] as unknown[];
    arr.splice(0, arr.length, ...structuredClone(SEED[k]));
    bumperDataset(k);
  }
  for (const k of OBJECT_DATASET_KEYS) setObjectDataset(k, structuredClone(OBJECT_SEED[k]) as never);
}
