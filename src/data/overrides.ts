/**
 * Seam app-owned : mutation EN PLACE des datasets de la façade (`src/data/index.ts`). On remplace le
 * CONTENU des tableaux exportés sans JAMAIS réassigner le binding → les ~52 consommateurs (qui
 * gardent la même référence d'array) voient les changements en direct. Unique point de branchement :
 *  - l'éditeur de données in-app (preview live avant écriture disque) ;
 *  - la future couche de surcharges PAR CAMPAGNE (apply au chargement, reset à la sortie).
 *
 * Couvre les datasets-TABLEAUX (`ARRAYS`) et les datasets-OBJETS uniques (`OBJECTS`), tous mutés EN
 * PLACE, jamais réassignés → les consommateurs gardent la même référence et voient l'édition en direct.
 * Chaque clé de dataset (`CLES_DE_DATASET`) désigne une collection de la RACINE VIVANTE de son fichier
 * (`RACINES_VIVANTES`, `collectionDuDataset`) : ce que le save sérialise, et ce que le régime vivant des
 * ids navigue.
 */
import {
  characteristics, species, classes, careers, careerLevels, skills, talents, etats, maladies, traits,
  qualities, qualitySubtypes, qualityTypes, mutations, mutationTables, trappings, weaponGroups, breathTypes, damageTypes, creatures, spells, maneuvers, domains, lightLevels, lightTones, props, eyes, hairs, stars, locations, books, raceAppearance, gods, structures,
  materials, terrains, buildings,
  pregens, oups, interludeEvents, peripeties, details, semencesDeScene, defautsDeCompilation, names, allAxes,
  calendarMonths, calendarIntercalary, calendarWeekdays, calendarPhases, weather, weatherConditions, symptoms,
  massBattleWarMachines, massBattleStructures, massBattleHazards, massBattleMightModifiers, massBattlePowerEstimate,
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
import { DATASET_FICHIER_DERIVE, DATASET_SUITE_DERIVE, DATASETS_EDITABLES_DERIVE } from './schemas/exposition-derivee';
import { poserRegimeVivant } from './schemas/grammaire/idsVivants';
import { atteindre, idsDeLEspace, lectureDeLEspace, type AccesAuxDocuments } from './schemas/grammaire/collection-cle';
import { lireCleDEspace } from './schemas/grammaire/cle-d-espace';
import { SCHEMA_DEFS } from './schemas/_registry.generated';
import { RACINES_VIVANTES } from './schemas/_racines-vivantes.generated';
import { CLES_DE_DATASET, type CleDeDataset } from './schemas/_cles-de-dataset.generated';
import { bumperDataset, memoParVersion } from './versionDataset';
import { critiqueEntries, type CritEntry } from './criticals';
import { SHIP_CRITICAL_TABLES, RIVER_CRIT_SET } from './shipCriticals';
import type { GameOp } from '../engine/ops';
import type { SourceRef } from './schemas/grammaire/valeurs';
import traumasRawJson from './traumas.json';
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
/** Les DOCUMENTS de `miscast.json` (un par tableau tirable). */
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
  // mutation en place, et c'est lui qui rend vivante la lecture des vues par domaine (`matieresDe`,
  // `src/data/index.ts`) : une matière retouchée se voit au rendu sans rechargement. Son def déclare
  // `exposition.edit` = `dataset` (lot 3a-2) : la clé a sa route de sauvegarde vers `materials.json`,
  // et l'onglet Codex « Matières » l'édite.
  materials,
  // Terrains du monde (#1690) : UN document, règle et rendu dans la même entrée. Ce binding EST le
  // seam de mutation en place, et c'est lui qui rend vivante la lecture de la façade `src/state/terrain`
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
  // marqueurs de l'Index), pas la vue filtrée `cargoes`/`landCargoes` — sinon une réécriture du
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
  // #422 : Ports (MDG 15), Progression de navire (MDG 13), Construction navale (MDG 12) — les 4
  // derniers NICHÉS dans leur document, dont la racine vivante est réécrite au save.
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

/** Datasets-OBJETS uniques : pas un tableau d'entités mais UN objet de config (`details`) ou une fiche
 *  de règle UNIQUE (`waterExposure`, MSRC 16). Mutés EN PLACE (mêmes garanties que les tableaux) →
 *  preview live + écriture disque par l'éditeur du Codex. Le fichier disque est celui du def qui
 *  déclare leur route `object` (`DATASET_FICHIER_DERIVE`). */
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

/** Fichier disque d'un dataset-objet : celui du def qui déclare sa route `object`. */
export function datasetObjectFile(key: ObjectDatasetKey): string {
  return DATASET_FICHIER_DERIVE[key];
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

/** Fichier disque d'un dataset-tableau ÉDITABLE : celui du document qui le porte (`DATASET_FICHIER_DERIVE`). */
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

/** Schéma de chaque document de `src/data` : ses marques de collection guident la navigation. */
const SCHEMA_DU_FICHIER = new Map(SCHEMA_DEFS.map((d) => [d.file, d.schema] as const));

/** Les documents VIVANTS : schéma et racine vivante de chaque fichier qui porte une clé de dataset
 *  (`RACINES_VIVANTES`) ; `undefined` ailleurs, où l'INDEX DES IDS généré fait foi. */
const accesVivant: AccesAuxDocuments = (fichier) =>
  fichier in RACINES_VIVANTES ? { schema: SCHEMA_DU_FICHIER.get(fichier), racine: RACINES_VIVANTES[fichier] } : undefined;

/**
 * COLLECTION d'une clé de dataset, sur la racine vivante de son fichier (`DATASET_FICHIER_DERIVE`) —
 * trois cas : route `dataset` ou `none` + `dataset`, la liste marquée de la racine (suite `''`) ; route
 * `niche`, la collection au bout de la suite que déclare `niche.categories` ; route `object`, la
 * RACINE elle-même. La co-descente ne valide pas : un arbre invalide se navigue (`atteindre`).
 */
export function collectionDuDataset(cle: CleDeDataset): unknown {
  const fichier = DATASET_FICHIER_DERIVE[cle];
  const racine = RACINES_VIVANTES[fichier];
  const suite = DATASET_SUITE_DERIVE[cle];
  return suite === undefined ? racine : atteindre(SCHEMA_DU_FICHIER.get(fichier), racine, suite)?.valeur;
}

/** Les clés de dataset de chaque fichier : une écriture sur l'une change la racine du fichier. */
const CLES_DU_FICHIER = new Map<string, CleDeDataset[]>();
for (const cle of CLES_DE_DATASET) {
  const fichier = DATASET_FICHIER_DERIVE[cle];
  CLES_DU_FICHIER.set(fichier, [...(CLES_DU_FICHIER.get(fichier) ?? []), cle]);
}

type LectureVivante = { readonly ids: ReadonlySet<string> } | { readonly univers: string } | undefined;

/** Lecture vivante de chaque espace, mémorisée par la version des clés de dataset de son fichier. */
const LECTURES_VIVANTES = new Map<string, () => LectureVivante>();

/** La lecture vivante de l'espace `cle` (`lectureDeLEspace` sur les racines vivantes, ids en ensemble) ;
 *  `undefined` hors des fichiers qui portent une clé de dataset. */
function lectureVivante(cle: string): LectureVivante {
  let lire = LECTURES_VIVANTES.get(cle);
  if (!lire) {
    const cles = CLES_DU_FICHIER.get(lireCleDEspace(cle).fichier);
    if (!cles) return undefined;
    lire = memoParVersion(cles, () => {
      const lecture = lectureDeLEspace(cle, accesVivant);
      return lecture && ('ids' in lecture ? { ids: new Set(lecture.ids) } : lecture);
    });
    LECTURES_VIVANTES.set(cle, lire);
  }
  return lire();
}

/**
 * RÉGIME VIVANT DES IDS (#1686 lot 3a-2, #1463) — le second régime de `_ids.generated.ts` : les ids de
 * l'espace `cle` sur les racines vivantes (`lectureVivante`, le calcul de la phase 2 de `npm run gen`),
 * si bien qu'une entité créée ou renommée à l'atelier est référençable par la donnée AVANT tout
 * `npm run gen`. L'univers d'une `specsSource` se suit (`idsDeLEspace`) à SA lecture, datée par son
 * propre fichier.
 */
const idsVivantsDeLEspace = (cle: string): ReadonlySet<string> | undefined => idsDeLEspace(cle, lectureVivante);
poserRegimeVivant(idsVivantsDeLEspace);

/** Ce dataset a-t-il une route d'ÉDITION déclarée ? (sinon `datasetFile` refuse — #1530) */
export function datasetEditable(key: DatasetKey): boolean {
  return DATASETS_EDITABLES_DERIVE.has(key);
}
/** Racine à SÉRIALISER au save : la racine VIVANTE du fichier du dataset (`RACINES_VIVANTES`) — ses
 *  collections sœurs et son enveloppe survivent à l'édition d'une seule —, en FORME DISQUE.
 *
 *  `versDisque` est la porte UNIQUE entre la forme RUNTIME (le `desc` d'une entrée adressée est
 *  matérialisé par le plugin `wfrp:prose-source` au chargement du module JSON) et la forme DISQUE
 *  (`desc` ⊕ `descRef`, `schemas/grammaire/prose.ts`) : sans elle, un save réécrirait la prose du
 *  livre DANS la donnée, et le schéma la refuserait. Elle rend une COPIE — le dataset vivant n'est
 *  jamais amputé. */
export function datasetSerializeRoot(key: DatasetKey): unknown {
  return versDisque(RACINES_VIVANTES[DATASET_FICHIER_DERIVE[key]]);
}

/** Racine à SÉRIALISER au save d'un dataset-OBJET (fiches de règle, `details`…), en FORME DISQUE —
 *  la porte SYMÉTRIQUE de `datasetSerializeRoot` pour l'autre branche de sauvegarde de `CodexEdit`.
 *  `datasetObject` sert la lecture RUNTIME (même référence que la façade) : la sortie disque passe
 *  par ici, sinon un `desc` matérialisé repartirait dans la donnée et le schéma refuserait le save. */
export function datasetObjectSerializeRoot(key: ObjectDatasetKey): unknown {
  return versDisque(RACINES_VIVANTES[DATASET_FICHIER_DERIVE[key]]);
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
