/**
 * Accès typé à NOTRE base de jeu — APP-OWNED et ÉDITABLE (éditeur de données DEV in-app,
 * écran 'dataEditor'). Les *.json de ce dossier sont la SOURCE CANONIQUE app-owned, curée à la main :
 * aucune migration ne les régénère.
 */
import type { IconId } from './icons/types';
import type { EntityAppearance, EspeceDApparence } from '../engine/authoringAppearance';
import type { PlayerText } from '../i18n/playerText';
import { listeEt, t } from '../i18n';
import type { Sexe, SourceRef, SecondaryRef, RaceKey, DescRef, FoyerDeRegle, MatiereDArmure } from './schemas/grammaire/valeurs';
import { dansLaSousListe, espaceDe, idsDe, idsDeLaSousListe, lireLEspace, porteLeMarqueur, type FeuilleDId, type Id, type RefASpecialisation, type RefDesignee, type RefTypee, type TypeEntite } from './schemas/grammaire/ref';
import { cleNichee, libelleDeLElement, lireCleDEspace, retenuParFiltre, suivreLeChemin } from './schemas/grammaire/cle-d-espace';
import { VOCABULAIRES, type IdDeColonneDuMarchand } from './schemas/grammaire/vocabulaires';
import { CATEGORIE_CODEX_DU_FICHIER, CLES_CODEX, DATASET_DE_LA_CATEGORIE, DATASET_DE_L_ESPACE, type CleCodex, type CleDeDataset, type DatasetDeCategorie } from './schemas/_cles-de-dataset.generated';
import { RACINES_VIVANTES } from './schemas/_racines-vivantes.generated';
import { INSTANCIABLE_PAR_ID } from './schemas/grammaire/sousListes';
import type { DotationDeMention, DotationDePossession, Somme } from './schemas/grammaire/reference';
import type { IdsParEspace } from './schemas/_ids.generated';
import { natureDeMentionSchema, symptomSeveritySchema, type NatureDeMention, type harvestRaritySchema, type harvestDangerSchema } from './schemas/grammaire/valeurs';
import { LIBELLE_AU_LABEL, resoutEnEntree, SOURCES_DE_SPECS, type SourceDeSpecs } from './schemas/grammaire/sourcesDeSpecs';
import { libelleDeValeur } from './schemas/grammaire/meta';
// Types de la SCÈNE, en TYPE seul (aucun cycle runtime) : les semences d'une scène neuve portent
// EXACTEMENT les types des champs qu'elles alimentent — les redéclarer ici en ferait une seconde vérité.
import type { z } from 'zod';
import type { traitCapabilitiesSchema } from './schemas/defs/traits';
import type { GateDAction, IdDeModeDeCiblage, PorteeDIntention, RunDAction, SelecteurDAction } from './schemas/defs/actions';
import type { Flow, TriggeredEffect } from './schemas/defs-scenes/effets';
import { slugId } from './slug';
import { parLibelle } from '../lib/ordre.mjs';
import { estObjet } from '../lib/objet.mjs';
import { emplacementsDesPieces, localisationsDeLoc } from '../engine/classementDeTrait';
import { norm } from '../lib/normalize';
import { tableTotale } from '../lib/tableTotale';
import { garanti } from '../lib/garanti';
import { effectiveEntry } from '../engine/variants';
import { CATEGORY_BY_SOURCE_KIND, CHAR_LABELS, type EffectSource } from '../engine/types';
import type { PairedSense } from '../engine/ops';
import characteristicsJson from './characteristics.json';
import speciesJson from './species.json';
import speciesRaceJson from './speciesRace.json';
import classesJson from './classes.json';
import careersJson from './careers.json';
import careerLevelsJson from './careerLevels.json';
import skillsJson from './skills.json';
import talentsJson from './talents.json';
import etatsJson from './etats.json';
import psychologyJson from './psychology.json';
import maladiesJson from './maladies.json';
import traitsJson from './traits.json';
import qualitiesJson from './qualities.json';
import mutationsJson from './mutations.json';
import mutationTablesJson from './mutationTables.json';
import { SHIP_CRIT_SET, RIVER_CRIT_SET } from './shipCriticals';
import structureCriticalsJson from './structure-criticals.json';
import { deDeTirageDe, rangeesDe, type RangeeDe } from './rangees';
import { deDeLaTableTiree, type DeDeTable } from '../engine/tables';
import type * as stakesDef from './schemas/defs/stakes';
import type * as careersDef from './schemas/defs/careers';
import type * as careerLevelsDef from './schemas/defs/careerLevels';
import type * as speciesDef from './schemas/defs/species';
import type { Avancement } from './schemas/grammaire/avancement';
import type * as disponibiliteDef from './schemas/defs/disponibilite';
import type * as navalPortsDef from './schemas/defs/naval-ports';
import type * as lieuxServicesDef from './schemas/defs/lieux-services';
import type * as shipStationsDef from './schemas/defs/ship-stations';
import type * as crewRolesDef from './schemas/defs/crew-roles';
import type * as groupsDef from './schemas/defs/groups';
import type * as weaponGroupsDef from './schemas/defs/weaponGroups';
import type * as lightLevelsDef from './schemas/defs/lightLevels';
import type * as lightTonesDef from './schemas/defs/lightTones';
import type * as rendusDef from './schemas/defs/rendus';
import type * as detailsDef from './schemas/defs/details';
import type * as semencesDeSceneDef from './schemas/defs/semences-de-scene';
import type * as defautsDeCompilationDef from './schemas/defs/defauts-de-compilation';
import type * as astrologyDef from './schemas/defs/astrology';
import type * as locationsDef from './schemas/defs/locations';
import type * as godsDef from './schemas/defs/gods';
import type * as namesDef from './schemas/defs/names';
import type * as reseauRoutierDef from './schemas/defs/reseau-routier';
import type * as breathTypesDef from './schemas/defs/breath-types';
import type * as damageTypesDef from './schemas/defs/damage-types';
import type * as characteristicsDef from './schemas/defs/characteristics';
import type * as seaWeatherDef from './schemas/defs/sea-weather';
import type * as shipConstructionDef from './schemas/defs/ship-construction';
import type * as riverNavigationDef from './schemas/defs/river-navigation';
import type * as axesDef from './schemas/defs/axes';
import type * as calendarMonthsDef from './schemas/defs/calendarMonths';
import type * as calendarIntercalaryDef from './schemas/defs/calendarIntercalary';
import type * as calendarPhasesDef from './schemas/defs/calendarPhases';
import type * as merchantsDef from './schemas/defs/merchants';
import type * as buildingsDef from './schemas/defs/buildings';
import type * as structuresDef from './schemas/defs/structures';
import type * as speciesRaceDef from './schemas/defs/speciesRace';
import type * as calendarWeekdaysDef from './schemas/defs/calendarWeekdays';
import type * as qualitySubtypesDef from './schemas/defs/qualitySubtypes';
import type * as qualityTypesDef from './schemas/defs/qualityTypes';
import type * as weatherDef from './schemas/defs/weather';
import type * as planDeBestiaireDef from './schemas/defs/planDeBestiaire';
import type * as booksDef from './schemas/defs/books';
import { books } from './livres';
import type * as vehiclesDef from './schemas/defs/vehicles';
import type * as qualitiesDef from './schemas/defs/qualities';
import type * as tablesDeCorruption from './schemas/defs/mutationTables';
import type * as activitiesDef from './schemas/defs/activities';
import { datasetDe, type DatasetDe, type EntreeDe } from './datasets';
import type { PropData } from './props.types';
import type { PregenDef } from './pregens'; // type-only (pregens.ts importe la donnée d'ici)
import type { MerchantArchetypeDef } from './merchants.types';
import type * as criticalsDef from './schemas/defs/criticals';
import type * as miscastDef from './schemas/defs/miscast';
import type * as structureCriticalsDef from './schemas/defs/structure-criticals';
import type * as artilleryMisfireDef from './schemas/defs/artillery-misfire';
import type * as crewTestTypesDef from './schemas/defs/crew-test-types';
import type { VisuelDeLumiere } from './schemas/defs/lightTones';
import type * as signesAstrologiques from './schemas/defs/stars';
import type * as couleurDesYeux from './schemas/defs/eyes';
import type * as couleurDesCheveux from './schemas/defs/hairs';
import type * as tableauDesOups from './schemas/defs/oups';
import type * as tableDesTalentsAleatoires from './schemas/defs/talents-aleatoires';
import { tableDeCarrieres as tableAvecPortion } from './schemas/defs/carrieres-aleatoires';
import type * as tableDesCarrieresAleatoires from './schemas/defs/carrieres-aleatoires';
import type * as tableauDesRacesAleatoires from './schemas/defs/especes-aleatoires';
import type * as tableauDeLaNatureDeMutation from './schemas/defs/mutation-nature';
import type * as tableauDesCargaisons from './schemas/defs/cargaisons-aleatoires';
import type * as tableauDesEvenements from './schemas/defs/interludeEvents';
import type * as tableDesPeripeties from './schemas/defs/peripeties';
import { trappings, findTrappingById } from './apparencesObjets';
export { trappings, apparences, findTrappingById, findApparenceById } from './apparencesObjets';
import vehiclesJson from './vehicles.json';
import merchantsJson from './merchants.json';
import structuresJson from './structures.json';
import structureAppearanceJson from './structureAppearance.json';
import materialsJson from './materials.json';
import type { MaterialDomain, MatiereDe, PropMaterialData, RoofMaterialDef, TeinteDObjet, CouleurNommee } from './materials.types';
import type * as materialsDef from './schemas/defs/materials';
import terrainsJson from './terrains.json';
import type { TerrainDef } from './terrains.types';
import buildingsJson from './buildings.json';
import ambianceJson from './ambiance.json';
import teintesJeuJson from './teintesJeu.json';
import navalTraitsJson from './naval-traits.json';
import navalPortsJson from './naval-ports.json';
import lieuxServicesJson from './lieux-services.json';
import seaShantiesJson from './sea-shanties.json';
import crewRolesJson from './crew-roles.json';
import crewTestTypesJson from './crew-test-types.json';
import shipStationsJson from './ship-stations.json';
import weaponGroupsJson from './weaponGroups.json';
import merchantFamiliesJson from './merchantFamilies.json';
import qualitySubtypesJson from './qualitySubtypes.json';
import qualityTypesJson from './qualityTypes.json';
import groupsJson from './groups.json';
import breathTypesJson from './breath-types.json';
import damageTypesJson from './damage-types.json';
import creaturesJson from './creatures.json';
import spellsJson from './spells.json';
import maneuversJson from './maneuvers.json';
import domainsJson from './domains.json';
import lightLevelsJson from './lightLevels.json';
import lightTonesJson from './lightTones.json';
import rendusJson from './rendus.json';
import propsJson from './props.json';
import eyesJson from './eyes.json';
import hairsJson from './hairs.json';
import calendarMonthsJson from './calendarMonths.json';
import calendarIntercalaryJson from './calendarIntercalary.json';
import calendarWeekdaysJson from './calendarWeekdays.json';
import calendarPhasesJson from './calendarPhases.json';
import weatherJson from './weather.json';
import { saisonParId } from './saisons';
import symptomsJson from './symptoms.json';
import detailsJson from './details.json';
import semencesDeSceneJson from './semences-de-scene.json';
import defautsDeCompilationJson from './defauts-de-compilation.json';
import starsJson from './stars.json';
import astrologyJson from './astrology.json';
import locationsJson from './locations.json';
import namesJson from './names.json';
import raceAppearanceJson from './raceAppearance.json';
import gabaritsJson from './gabarits.json';
import planDeBestiaireJson from './planDeBestiaire.json';
import type * as gabaritsDef from './schemas/defs/gabarits';
import type { GabaritId, SurchargeDeGabarit } from './schemas/defs/gabarits';
import gardeRobeJson from './garde-robe.json';
import { cleDHabille, type EmplacementId, type HabilleDEnsemble, type PieceId } from './schemas/defs/garde-robe';
import type * as gardeRobeDef from './schemas/defs/garde-robe';
import presetsDePersonnageJson from './presets-de-personnage.json';
import type { PresetDePersonnage } from './schemas/defs/presets-de-personnage';
import godsJson from './gods.json';
import pregensJson from './pregens.json';
import oupsJson from './oups.json';
import talentsAleatoiresJson from './talents-aleatoires.json';
import carrieresAleatoiresJson from './carrieres-aleatoires.json';
import especesAleatoiresJson from './especes-aleatoires.json';
import mutationNatureJson from './mutation-nature.json';
import cargaisonsAleatoiresJson from './cargaisons-aleatoires.json';
import interludeEventsJson from './interludeEvents.json';
import tavernGamesJson from './tavernGames.json';
import peripetiesJson from './peripeties.json';
import reseauRoutierJson from './reseau-routier.json';
import massBattleJson from './mass-battle.json';
import grappleJson from './grapple.json';
import reglesJson from './regles.json';
import disponibiliteJson from './disponibilite.json';
import waterExposureJson from './water-exposure.json';
import stakesJson from './stakes.json';
import activitiesStakeJson from './activities.json';
import actionsJson from './actions.json';
import axesJson from './axes.json';
import seaNavigationJson from './sea-navigation.json';
import seaPerilsJson from './sea-perils.json';
import seaWeatherJson from './sea-weather.json';
import shipConstructionJson from './ship-construction.json';
import riverNavigationJson from './river-navigation.json';
import seaCargoJson from './sea-cargo.json';
import landCargoJson from './land-cargo.json';
import { CharKey, type HitLocation, Weapon, VehicleData, StructureData, Availability, Difficulty, type StakeForm } from '../engine/types';
import type { MutationData } from './mutations'; // type-only (évite le cycle data→mutations→engine→data)
import type { DiseaseDef } from './schemas/defs/maladies';
import type { PowerEstimateRow, MightModifierRow, WarMachineRow, StructureRow as MassBattleStructureRow, HazardRow } from '../engine/massBattle'; // type-only (le runtime de massBattle.ts importe ces tableaux d'ici)
import { type DiceSpec, formatDice } from '../engine/dice';
import { formuleDeMonnaie, type Money } from '../engine/money';
import { sizeFromProfile, sizeFromTalents } from '../engine/size'; // runtime : registre feuille (data/sizes.json + engine/qualities/ids), sans cycle vers data/index
import type { VarianteDeCible } from './schemas/grammaire/valeurs';
import type { SeaNavigationData } from './schemas/defs/sea-navigation';
import type { SeaPerilsData } from './schemas/defs/sea-perils';
import type * as seaCargoDef from './schemas/defs/sea-cargo';
import type * as landCargoDef from './schemas/defs/land-cargo';

/** Règle d'EMPOIGNADE en DONNÉE (LDB 14 l.159-169) : `init` = ops à la touche d'une Empoignade déclarée
 *  (Empêtré + relation via le flag `grapple`) ; `win` = les 3 options du Test opposé GAGNÉ (l.161), appliquées
 *  avec `ctx.sl = DR`. La mécanique vit ICI (GameOp éditables), le flux `pendingGrapple` n'orchestre que le choix. */
export interface GrappleRule {
  init: import('../engine/ops').GameOp[];
  win: { degats: import('../engine/ops').GameOp[]; empetrer: import('../engine/ops').GameOp[]; liberer: import('../engine/ops').GameOp[] };
  source?: SourceRef;
}
export const GRAPPLE = grappleJson as GrappleRule;

/**
 * Dataset dont la prose est ADRESSÉE (`descRef`, #1389) : sur le DISQUE, l'entrée porte son adresse
 * et PAS de `desc` — c'est la forme que TypeScript voit du module JSON. Le module CHARGÉ, lui, est
 * toujours MATÉRIALISÉ : le plugin `wfrp:prose-source` (`scripts/source/prose-source-plugin.mjs`,
 * pendant Vite de `materialiser`) injecte dans chaque nœud adressé la `desc` que son adresse résout,
 * au build comme en dev et sous vitest — c'est la SEULE porte de chargement des `src/data/*.json`.
 * Ce helper NOMME cet écart à UN endroit, au lieu d'un `as unknown as` recopié par famille migrée.
 */
const adressee = <T>(json: unknown): T[] => json as T[];

/** Mode d'exposition hydrique (MSRC 16 l.5/37) : ingestion volontaire (« boit de l'eau de rivière sans
 *  la faire bouillir ») ou immersion (chute/nage — « uniquement à l'immersion » pour le tableau 2). */
export type WaterExposureMode = 'ingestion' | 'immersion';
/** Dérivation AUTOMATIQUE d'un modificateur d'exposition depuis le Combatant (tableau 2 « Blessures et
 *  États », MSRC 16 l.35-47) : PB restants/perdus, PAR pion d'un État, présence d'un État. */
export type WaterExposureAuto =
  | { kind: 'woundsRemaining'; op: '<='; value: number }
  | { kind: 'woundsLost'; op: '>='; value: number }
  | { kind: 'woundsLost'; op: 'between'; min: number; max: number }
  | { kind: 'perCondition'; condition: string }
  | { kind: 'hasCondition'; condition: string };
/** Un modificateur d'exposition hydrique : tableau 1 « Source d'eau » (choix d'AUTEUR de la zone d'eau)
 *  ou tableau 2 « Blessures et États » (dérivé du Combatant via `auto`). « Tous les modificateurs
 *  peuvent être cumulés » (MSRC 16 l.13). NB : « Par État Assommé » (MSRC) → id LDB `sonne` (le LDB 16 n'a
 *  pas d'État « Assommé » ; le même chapitre écrit « État *Sonné* » p.92 — glissement de traduction). */
export interface WaterExposureModifier {
  id: string;
  label: string;
  mod: number;
  appliesTo: WaterExposureMode[];
  table: 'source-d-eau' | 'blessures-et-etats';
  auto?: WaterExposureAuto;
}
/** Tables d'exposition hydrique (MSRC 16 l.13-63) : Test de Résistance Intermédiaire modifié ; raté →
 *  dé de `diseases` « +10 pour chaque DR négatif » → maladie CONTRACTÉE (le Test d'exposition EST le test — pas de
 *  second Test de Contraction). `rerollUnlessWounded` : « Relancez si le Personnage n'est pas blessé ». */
export interface WaterExposureData {
  id: string;
  label: string;
  desc: string;
  test: { skill: RefDesignee; difficulty: import('../engine/types').Difficulty };
  rollModPerNegativeSL: number;
  modifiers: WaterExposureModifier[];
  diseases: { die: string; entries: { min: number; max: number; disease: string; rerollUnlessWounded?: boolean }[] };
  source: SourceRef;
}
export const WATER_EXPOSURE = waterExposureJson as WaterExposureData;

/** CASCADE d'un enjeu de `stakes.json` : la famille de jets qu'il sert — ses valeurs sont celles de
 *  `StakeKey.dataset` (`schemas/defs/stakes.ts`). */
export type StakeCascade = 'nuit' | 'voyage' | 'flux' | 'combat';

/** ENJEU d'un jet de cascade (#1117, collection #1681) — cf. `schemas/defs/stakes.ts`. Lu à la clé
 *  `{ dataset: cascade, kind: id }` par `resolveStake`. */
export type StakeEntry = EntreeDe<typeof stakesDef>;
export const STAKES = datasetDe<typeof stakesDef>(stakesJson);
/** Ids des enjeux d'une cascade : l'union GÉNÉRÉE des ids de l'espace de la cascade (`scripts/gen-espaces.mts`),
 *  l'argument de sa porte typée. */
export type NightStakeId = IdsParEspace['stakes.json?cascade=nuit'];
export type VoyageStakeId = IdsParEspace['stakes.json?cascade=voyage'];
export type FlowStakeId = IdsParEspace['stakes.json?cascade=flux'];
export type CombatStakeId = IdsParEspace['stakes.json?cascade=combat'];

/** ENJEU d'une ACTIVITÉ (#1117 L3) — porté par l'ENTITÉ elle-même (`activities.json`), pas par un
 *  fichier d'enjeux tiers : une Activité EST déjà une entrée Codex éditable qui porte sa règle en
 *  `desc` verbatim. Le catalogue au type de son schéma. */
export const ACTIVITY_STAKES = datasetDe<typeof activitiesDef>(activitiesStakeJson);

/** REGISTRE DES ACTIONS de combat (`actions.json`, spec HUD « Zone 12 ») : une entrée = un acte
 *  offert au joueur, avec son identité STABLE, son affichage, sa règle Codex, son coût et les IDS
 *  de code qui l'exécutent. Le CODE derrière ces ids vit dans `src/noyau/actionRegistry.ts` —
 *  `src/data` n'en dépend jamais. */
export interface ActionDef {
  id: ActionId;
  label: string;
  icon: IconId;
  surface:
    | 'deduite-du-set' | 'geste-d-etat' | 'grille' | 'gouttiere-arche' | 'selecteur-de-sets'
    | 'coin-de-tour' | 'bandeau-de-phase' | 'interlude' | 'pastille-etat' | 'pastille-entite' | 'frise'
    | 'geste-secondaire';
  /** Un id de prédicat, ou plusieurs — composés par l'ET séquentiel d'`actionGate`. */
  gate: GateDAction | GateDAction[];
  candidates?: SelecteurDAction;
  run?: RunDAction;
  mode?: IdDeModeDeCiblage;
  intent?: PorteeDIntention;
  /** L'action ARME son `mode` dans `battle.action` (mode à bouton). */
  armed?: true;
  /** Champ de POSTURE pré-armée basculé par l'action (`BattleState.stances`, spec HUD §1a G5). */
  stance?: 'tirImmobile' | 'dansLeTas';
  coutAction: 'action' | 'mouvement' | 'gratuit' | 'aucun';
  /** Arbitrage NON-verbatim du coût — la RAISON en clair (même patron que `TraitData.maison`). */
  maison?: string;
  source?: SourceRef;
  rule?: FoyerDeRegle;
  keys?: string[];
  blocked?: { ticket: string; raison: string };
  /** Sortie d'interlude atteignable à la touche d'annulation (`surface: 'interlude'`) — `false` :
   *  le dispatcher commet une perte, seul le clic explicite le déclenche. */
  exitSafe?: boolean;
  /** RÔLE sémantique de la sortie d'interlude : `valide` mène le geste à son terme, `renonce`
   *  abandonne/revient. La proéminence du bouton s'en DÉDUIT au rendu — ce n'est pas un style. */
  role?: 'valide' | 'renonce';
  /** L'action fait naître un panneau-paramètre de SON alvéole : la surface y pose l'ancre. */
  panneau?: boolean;
  /** Entrée HÔTE d'un `surface: 'geste-secondaire'` : l'alvéole de CETTE action porte le geste. */
  hote?: { id: ActionId };
}
export const ACTIONS = actionsJson as ActionDef[];
/** Id d'une action du registre : l'union GÉNÉRÉE des ids de `actions.json` (`scripts/gen-espaces.mts`). */
export type ActionId = IdsParEspace['actions.json'];
/** Action par id STABLE (jamais par libellé). */
export const findActionById = (id: string): ActionDef | undefined => ACTIONS.find((a) => a.id === id);

/** DATASET d'enjeux servant une famille de jets (#1117). Union FERMÉE : une cascade de plus est une
 *  valeur de `StakeCascade` et ses entrées dans `stakes.json` ; les trois autres familles portent leur
 *  enjeu sur l'ENTITÉ (météo, Activité, État) et ont chacune leur branche dans `stakeEntry`. */
export type StakeDataset = StakeCascade | 'meteo' | 'activite' | 'etat';

/** CLÉ d'enjeu — la coordonnée de la DONNÉE, jamais son texte. `entryId` fait DESCENDRE la résolution
 *  à l'ENTRÉE jouée quand elle existe (le symptôme d'une étape de maladie, la psychologie affrontée,
 *  demain le péril d'une table régionale) ; sans lui, la résolution reste au `kind`. C'est la clé
 *  `{dataset, kind, entryId?}` du design #1117 — le repli sur `kind` est déclaré, jamais silencieux.
 *
 *  `entryCategory` couvre le cas UN KIND → N CATÉGORIES, que la déclaration statique du dataset ne
 *  peut pas trancher : une Blessure critique se joue sur la table de SA localisation
 *  (`criticalsTete`/`Bras`/`Corps`/`Jambe`), connue seulement au tirage. Le producteur la fournit
 *  alors avec l'`entryId` ; le catalogue déclaratif reste la SOURCE par défaut (le dynamique ne
 *  s'applique qu'aux kinds qui n'en déclarent aucune). */
export interface StakeKey {
  dataset: StakeDataset;
  /** L'id de l'entrée dans son dataset : l'enjeu d'une cascade, la météo, l'Activité, l'État. */
  kind: string;
  entryId?: string;
  entryCategory?: string;
}

/** RÉFÉRENCE d'enjeu vers un DATASET : la clé de la donnée + les valeurs CALCULÉES par le flux pour
 *  ses trous. Seule forme ouverte au MOTEUR — un littéral de texte au call-site n'y compile pas
 *  (arbitrage Z5 appliqué à la zone d'enjeu), les producteurs passent par la porte fail-closed
 *  `stakeRef`, sous ses signatures typées par famille (`combatStakeRef`, `flowStakeRef`, `nightStakeRef`,
 *  `voyageStakeRef`, `activityStakeRef`, `weatherStakeRef`, `stateRecoveryStakeRef`). */
export interface CatalogStake {
  key: StakeKey;
  values?: Record<string, string | number>;
  authored?: never;
  from?: never;
}

/** ENJEU AUTHORÉ par un DOCUMENT DE CONTENU (Flow d'une scène/campagne) — arbitrage user 2026-08-12
 *  (#1262) : « l'enjeu d'un Flow authoré s'AUTHORE DANS LA SCÈNE — champ stake dans l'éditeur de Flow,
 *  comme le reste du contenu de campagne ». Un jet de scène met en jeu SA situation, pas une règle du
 *  moteur : son enjeu voyage avec le document (JSON portable), il ne pointe aucun dataset app-owned —
 *  une réf de catalogue y serait pendante à la première campagne tierce.
 *
 *  RÉSERVÉ au contenu : `src/noyau`/`src/engine` n'en écrivent aucun (garde
 *  `cascade-step-stake-guard.test.ts`, volet « l'enjeu AUTHORÉ reste au contenu ») — c'est la porte
 *  ouverte par l'arbitrage, pas une amnistie du texte au call-site. Aucun foyer de règle : le
 *  document ne renvoie à aucune fiche Codex. */
export interface AuthoredStake {
  authored: string;
  source?: SourceRef;
  adapteDe?: SourceRef;
  key?: never;
  values?: never;
  from?: never;
}

/** ENJEU DÉRIVÉ DU PORTEUR — arbitrage user 2026-08-12 (#1262), verbatim au ticket : « Le socle dérive
 *  l'enjeu de l'entité porteuse ("ce qui se joue : [sort/objet X]" + renvoi Codex — même motif que
 *  l'arbitrage Activités de mer : l'enjeu EST l'entité choisie). Zéro saisie […]. Un auteur PEUT
 *  toujours surcharger par un texte authoré. »
 *
 *  C'est la forme des jets exigés par une ENTITÉ (un `FlowTest` authoré en donnée app-owned : sort,
 *  consommable, Trait, Talent, Atout, État, symptôme, manœuvre) — l'entité qui exige le jet EST ce qui
 *  se joue, et elle porte déjà sa règle en `desc` verbatim dans sa fiche Codex.
 *
 *  IDS SEULEMENT (`EffectSource` = `{kind, id}`) : le libellé est résolu À L'AFFICHAGE par
 *  `resolveStake`. La forme est CALCULÉE au montage de l'étape par le socle (`derivedStake`), jamais
 *  authorée en JSON — aucune migration de sauvegarde : une étape déjà persistée garde la forme sous
 *  laquelle elle a été mintée. */
export interface DerivedStake {
  from: EffectSource;
  key?: never;
  values?: never;
  authored?: never;
}

/** ENJEU d'une entrée de jet (étape de cascade, pending, `FlowTest`) : réf de dataset, texte authoré
 *  par le document, OU dérivé de l'entité porteuse. Les trois passent par la MÊME porte de résolution
 *  (`resolveStake`) — une surface n'en connaît toujours qu'une. */
export type StakeRef = CatalogStake | AuthoredStake | DerivedStake;

/** ENJEU RÉSOLU rendu par la surface : le texte de la donnée (trous remplis) + la fiche de règle
 *  DÉRIVÉE de la même entrée — le producteur ne nomme ni l'un ni l'autre.
 *  `text` ABSENT = l'entrée ne porte pas de gabarit (son issue se lit en chips d'ops, #1117) : la
 *  surface ne rend PAS de phrase, le foyer de règle reste servi. */
export interface ResolvedStake {
  text?: string;
  rule?: { category: string; id: string };
}

/** FICHE Codex d'une référence typée : l'id, dans la catégorie que déclare le fichier de l'espace de son
 *  type (`CATEGORIE_CODEX_DU_FICHIER`). LÈVE, en le nommant, sur un type dont le fichier n'a pas de
 *  catégorie unique : seuls les types PROJETÉS l'exigent. */
export function cibleCodex(r: RefTypee): { category: string; id: string } {
  const espace = espaceDe(r.type);
  const category = CATEGORIE_CODEX_DU_FICHIER[lireCleDEspace(espace).fichier];
  if (category === undefined) throw new Error(`cibleCodex : « ${espace} » (type « ${r.type} ») ne déclare pas une catégorie Codex unique — la fiche de « ${r.id} » ne s'ouvre nulle part.`);
  return { category, id: r.id };
}

/** Fichiers à TABLES TIRÉES dont CHAQUE catégorie Codex (`DATASET_DE_LA_CATEGORIE`) est un pool
 *  d'entrées : le nom est lié par le type au `file` de son def (#3923). */
const FICHIERS_DES_TABLES_TIREES: readonly string[] = [
  'criticals.json' satisfies typeof criticalsDef.file,
  'miscast.json' satisfies typeof miscastDef.file,
  'structure-criticals.json' satisfies typeof structureCriticalsDef.file,
  'artillery-misfire.json' satisfies typeof artilleryMisfireDef.file,
  'crew-test-types.json' satisfies typeof crewTestTypesDef.file,
  'interludeEvents.json' satisfies typeof tableauDesEvenements.file,
  SHIP_CRIT_SET.fichier,
  RIVER_CRIT_SET.fichier,
];

/** Catégories à pool d'un fichier dont les autres catégories n'en sont pas (`sea-events.json` :
 *  `seaFastVoyage`, `seaManannFactors`), liées par le type aux clés Codex (#3923). */
const CATEGORIES_DES_TABLES_TIREES: readonly string[] = [
  'seaBoardEvents' satisfies CleCodex,
  'seaPortEvents' satisfies CleCodex,
];

/** Le prédicat d'appartenance d'un id au pool d'une catégorie. */
type PoolDEntrees = (id: string) => boolean;

/** POOLS des tables tirées, une entrée par catégorie de leurs fichiers, lue sur la racine VIVANTE
 *  (`entreeDeCategorie`) : une édition au Codex y entre. */
function poolsDesTablesTirees(): Partial<Record<CleCodex, PoolDEntrees>> {
  return tableTotale(CLES_CODEX
    .filter((c) => (c in DATASET_DE_LA_CATEGORIE && FICHIERS_DES_TABLES_TIREES.includes(DATASET_DE_LA_CATEGORIE[c].fichier)) || CATEGORIES_DES_TABLES_TIREES.includes(c)),
  (c) => (id: string) => entreeDeCategorie(c, id) !== undefined);
}

/** POOLS d'ids par catégorie Codex, pour les familles dont le foyer DESCEND à l'entrée jouée. Une
 *  catégorie de plus = une ligne ICI (le dataset la NOMME, il ne code pas sa résolution), sauf celles
 *  des tables tirées (`FICHIERS_DES_TABLES_TIREES`, `CATEGORIES_DES_TABLES_TIREES`), qui entrent seules. */
const STAKE_ENTRY_POOLS: Partial<Record<CleCodex, PoolDEntrees>> = {
  symptoms: (id) => symptoms.some((s) => s.id === id),
  seaShanties: (id) => !!findSeaShantyById(id),
  maladies: (id) => !!findDiseaseById(id),
  psychologies: (id) => !!findPsychologyById(id),
  maneuvers: (id) => !!findManeuverById(id),
  spells: (id) => !!findSpellById(id),
  // Familles à TABLE (#1117 L2 vague 4b) : la LIGNE tirée est déjà une entrée Codex éditable — son
  // foyer est SA fiche, jamais une fiche de règle doublon (amendement A). La catégorie voyage avec
  // l'id, versée par la re-pose post-tirage (`stakeAtTableRow`, `noyau/cascade.ts`).
  ...poolsDesTablesTirees(),
  mutations: (id) => mutations.some((m) => m.id === id),
  mutationTables: (id) => mutationTables.some((t) => t.id === id),
  // Un jeu de taverne PORTE sa règle (sa fiche Codex la recopie verbatim) : c'est le foyer des effets
  // qu'une partie inflige (l'ivresse d'un jeu à boire, NADJ 16 l.90).
  tavernGames: (id) => (tavernGamesJson as { id: string }[]).some((g) => g.id === id),
  // Catégories atteignables par l'ENTITÉ SOURCE d'un effet (`CATEGORY_BY_SOURCE_KIND`, engine/types) —
  // la table est TOTALE côté source, donc le pool l'est aussi : sans elles, un jet exigé par un objet
  // ou un Talent replierait en silence sur le foyer de son `kind`.
  talents: (id) => talents.some((t) => t.id === id),
  traits: (id) => traits.some((t) => t.id === id),
  trappings: (id) => findTrappingById(id) !== undefined,
  qualities: (id) => qualities.some((q) => q.id === id),
  etats: (id) => etats.some((e) => e.id === id),
  creatures: (id) => creatures.some((c) => c.id === id),
  regles: (id) => regles.some((r) => r.id === id),
  activities: (id) => ACTIVITY_STAKES.some((a) => a.id === id),
  // La COMPÉTENCE testée est le foyer quand le jet n'existe que par elle (cumuler l'Avantage :
  // Intuition/Savoir/Survie/Prière portent chacune SA phrase de combat, LDB 09).
  skills: (id) => !!byId('skill', id),
};

/** Le pool de la catégorie `categorie`, `undefined` quand elle n'en a pas. */
function poolDeLaCategorie(categorie: string): PoolDEntrees | undefined {
  return Object.prototype.hasOwnProperty.call(STAKE_ENTRY_POOLS, categorie) ? STAKE_ENTRY_POOLS[categorie as CleCodex] : undefined;
}

/** La catégorie d'entrée `categorie` a-t-elle un pool ? Lu par le parse d'une clé d'enjeu AUTHORÉE (`catalogStakeSchema`). */
export const categorieDEntreeAPool = (categorie: string): boolean => poolDeLaCategorie(categorie) !== undefined;

/** Le pool de la catégorie d'entrée que l'enjeu `e` déclare. LÈVE, en nommant l'enjeu et la catégorie, quand elle n'en a pas. */
function poolDeLEnjeu(e: StakeEntry): PoolDEntrees {
  const pool = poolDeLaCategorie(e.entryCategory!);
  if (!pool) throw new Error(`stakes.json › ${e.id} : la catégorie d'entrée « ${e.entryCategory} » n'a aucun pool (\`STAKE_ENTRY_POOLS\`).`);
  return pool;
}

/** CATALOGUE d'ENTRÉES d'un `kind` : où vit la fiche de l'entrée JOUÉE, quand la clé en nomme une.
 *  Déclaratif — ajouter une famille à entrées (tables régionales de Lustrie, périls…) = une ligne ICI,
 *  jamais un `if` par kind au rendu. La famille MALADIE l'énumère (les trois étapes de maladie jouent
 *  un SYMPTÔME nommé) ; les jets de modale mono la DÉRIVENT de leur donnée (`entryCategory`). */
const stakeEntryCatalog = memoParVersion(['stakes'], (): Record<string, { category: string; has: PoolDEntrees }> => ({
  'maladie-test-quotidien': { category: 'symptoms', has: (id) => symptoms.some((s) => s.id === id) },
  'maladie-gangrene': { category: 'symptoms', has: (id) => symptoms.some((s) => s.id === id) },
  'maladie-persistance': { category: 'symptoms', has: (id) => symptoms.some((s) => s.id === id) },
  ...Object.fromEntries(
    STAKES
      .filter((e) => e.entryCategory)
      .map((e) => [e.id, { category: e.entryCategory!, has: poolDeLEnjeu(e) }]),
  ),
}));

/** ENJEU porté par l'ENTRÉE elle-même, par catégorie Codex — patron `ActivityDef.stake` (l'entité
 *  qui PORTE la règle porte aussi ce que son jet met en jeu). Une catégorie de plus = une ligne ICI.
 *  Quand elle rend un texte, il PRIME sur le gabarit du `kind` : c'est la seule façon d'échapper au
 *  descripteur tautologique quand les conséquences sont AUTHORÉES par entrée (les psychologies :
 *  `resolution`/`failCondition`/`failAmount`/`becomes` diffèrent d'une entrée à l'autre). */
const STAKE_ENTRY_TEXTS: Record<string, (id: string) => string | undefined> = {
  psychologies: (id) => findPsychologyById(id)?.stake,
  maneuvers: (id) => findManeuverById(id)?.stake,
};

/** Catégorie de l'ENTRÉE d'un `kind` — TABLE DES PORTES vers le foyer de la règle. Toute porte est
 *  NOMMÉE ici ; une porte qu'on n'écrit pas s'invente ailleurs.
 *  (a) DÉCLARATIVE : le `kind` figure au catalogue `stakeEntryCatalog` (dataset ou énumération),
 *      sa catégorie est la même à chaque tirage — porte par défaut, elle PRIME sur les suivantes.
 *  (b) DYNAMIQUE BORNÉE : le producteur fournit `key.entryCategory`, valide seulement si le nom
 *      figure dans `STAKE_ENTRY_POOLS` — pour un `kind` jouant sur N catégories connues au tirage
 *      (les Critiques par localisation).
 *  (c) PAR LA SOURCE : le dataset pose `entryFromSource: true` (schéma `defs/stakes.ts`),
 *      qui déclare que la catégorie ne se connaît qu'au RUNTIME — le producteur la tire de
 *      `ActiveEffect.source` (`CATEGORY_BY_SOURCE_KIND`) et la verse par la porte (b) ; le kind
 *      `agir-malgre-effet` en vit (un même gate est exigé par un objet, un Talent, une maladie…).
 *      CRITÈRE : `entryFromSource` ne se déclare que si la catégorie est irréductiblement dynamique
 *      (le même `kind` sert N natures de source) — si une déclaration statique peut la dire, c'est
 *      (a) ou (b). */
function entryCategoryOf(key: StakeKey): { category: string; has: (id: string) => boolean } | undefined {
  const declared = stakeEntryCatalog()[key.kind];
  if (declared) return declared;
  const dyn = key.entryCategory;
  const has = dyn === undefined ? undefined : poolDeLaCategorie(dyn);
  return dyn && has ? { category: dyn, has } : undefined;
}

/** Fiche de l'ENTRÉE jouée — `undefined` si la clé n'en nomme pas, si le `kind` n'a pas de catégorie
 *  d'entrées, ou si l'id est inconnu (repli DÉCLARÉ sur la fiche du `kind`). */
function entryRule(key: StakeKey): { category: string; id: string } | undefined {
  const cat = key.entryId ? entryCategoryOf(key) : undefined;
  return cat && cat.has(key.entryId!) ? { category: cat.category, id: key.entryId! } : undefined;
}

/** Texte porté par l'ENTRÉE jouée, s'il existe (sinon le gabarit du `kind` fait foi). */
function entryText(key: StakeKey): string | undefined {
  const rule = entryRule(key);
  return rule ? STAKE_ENTRY_TEXTS[rule.category]?.(rule.id) : undefined;
}

function stakeEntry(key: StakeKey): { text?: string; rule?: { category: string; id: string } } | undefined {
  if (key.dataset === 'meteo') {
    // MÉTÉO : l'enjeu de la traversée vit sur la CONDITION (`weather.json`, `resistanceTest.enjeu`) —
    // key.kind = l'id de météo. Même porte, même fail-closed : pas d'entrée → pas d'enjeu.
    const rt = weatherData.conditions.find((c) => c.id === key.kind)?.resistanceTest;
    return rt?.enjeu ? { text: rt.enjeu } : undefined;
  }
  if (key.dataset === 'etat') {
    // RÉCUPÉRATION d'un État : l'enjeu vit sur l'État (`etats.json`, `recover.enjeu`) — key.kind = l'id
    // de l'État, qui est aussi le foyer de la règle.
    const r = etats.find((x) => x.id === key.kind)?.recover;
    return r ? { text: r.enjeu, rule: { category: 'etats', id: key.kind } } : undefined;
  }
  if (key.dataset === 'activite') {
    // ACTIVITÉS : `key.kind` = l'id de l'`ActivityDef`. Le FOYER par DÉFAUT est l'Activité ELLE-MÊME
    // (catégorie Codex `activities`, où vit sa `desc` verbatim) — une fiche `regles.json` doublon
    // serait le péché de l'amendement A. Une entrée peut NOMMER un autre foyer (`rule`) quand la
    // règle vit ailleurs (Augure → la table des Symboles).
    const e = ACTIVITY_STAKES.find((x) => x.id === key.kind);
    if (!e?.stake) return undefined;
    return { text: e.stake, rule: e.rule ? cibleCodex(e.rule) : { category: 'activities', id: e.id } };
  }
  // CASCADES (`stakes.json`) : `key.dataset` est la cascade, `key.kind` l'id de l'enjeu.
  const cascade: StakeCascade = key.dataset;
  const e = STAKES.find((x) => x.cascade === cascade && x.id === key.kind);
  if (!e) return undefined;
  // La fiche de l'ENTRÉE jouée PRIME sur celle du `kind` (une étape « Blessé » renvoie au symptôme
  // Blessé, pas à l'intro du chapitre des maladies ; la maladie contractée, la manœuvre subie, la
  // chanson chantée) ; à défaut, le foyer que l'entrée déclare.
  const rule = entryRule(key) ?? (e.rule ? cibleCodex(e.rule) : undefined);
  // Entrée SANS gabarit : le foyer voyage seul (aucune phrase à rendre — l'issue se lit en chips).
  const text = entryText(key) ?? e.template;
  return { ...(text ? { text } : {}), ...(rule ? { rule } : {}) };
}

/** Un TROU du gabarit d'enjeu : `{nom}`, rempli par la valeur que le flux calcule (`CatalogStake.values`). */
const TROU_D_ENJEU = /\{(\w+)\}/g;

/** Les TROUS du texte que `resolveStake` rendrait pour cette clé — `undefined` si la clé ne nomme aucune
 *  entrée d'enjeu. Lu par le parse de la forme AUTHORÉE (`catalogStakeSchema`), qui n'a pas de `values`. */
export function trousDeLEnjeu(key: StakeKey): string[] | undefined {
  const entry = stakeEntry(key);
  return entry && [...(entry.text ?? '').matchAll(TROU_D_ENJEU)].map((m) => m[1]);
}

/** RÉFÉRENCE d'enjeu — l'UNIQUE constructeur : la clé se valide À LA CONSTRUCTION (fail-closed au plus
 *  tôt : une étape qui LANCE et dont l'enjeu n'existe pas ne se construit pas). `entryId` = l'ENTRÉE
 *  JOUÉE quand l'étape en nomme une (le symptôme, la maladie contractée, la manœuvre subie, la chanson
 *  chantée) : le renvoi descend alors à SA fiche ; un id inconnu replie sur le foyer de la clé (déclaré,
 *  jamais silencieux). `entryCategory` = la catégorie FOURNIE par le producteur, pour les clés dont le
 *  dataset ne peut pas la déclarer (`entryFromSource` : l'entité source d'un effet peut être de
 *  n'importe quelle nature). */
function stakeRef(
  dataset: StakeDataset,
  kind: string,
  opts: { entryId?: string; entryCategory?: string; values?: Record<string, string | number> } = {},
): StakeRef {
  if (!stakeEntry({ dataset, kind })) {
    throw new Error(`stakeRef('${dataset}/${kind}') : aucune entrée d'enjeu — une surface qui LANCE dit ce qu'elle met en jeu`);
  }
  return {
    key: {
      dataset, kind,
      ...(opts.entryId ? { entryId: opts.entryId } : {}),
      ...(opts.entryCategory ? { entryCategory: opts.entryCategory } : {}),
    },
    ...(opts.values ? { values: opts.values } : {}),
  };
}

/** Enjeu d'une étape de cascade de VOYAGE (`stakeRef`) : les valeurs remplissent les trous du gabarit. */
export function voyageStakeRef(id: VoyageStakeId, values?: Record<string, string | number>): StakeRef {
  return stakeRef('voyage', id, { values });
}

/** Enjeu d'une étape de cascade de COMBAT (#1117 L2, `stakeRef`) : `entryId`/`entryCategory` viennent du
 *  `meta` de l'étape ou de la source de l'effet. */
export function combatStakeRef(
  id: CombatStakeId,
  opts?: { entryId?: string; entryCategory?: string; values?: Record<string, string | number> },
): StakeRef {
  return stakeRef('combat', id, opts);
}

/** Enjeu d'une étape de NUIT (`stakeRef`) : le TYPE ferme l'id (`NightStakeId`, généré) en PREMIER
 *  rideau, le throw est le second. `entryId` = le symptôme joué par une étape de maladie. */
export function nightStakeRef(id: NightStakeId, entryId?: string): StakeRef {
  return stakeRef('nuit', id, { entryId });
}

/** L'Activité a-t-elle son enjeu authoré ? PRÉDICAT de la MÊME porte que `activityStakeRef` — pour
 *  les surfaces qui rendent un catalogue MIXTE (le volet d'Activité sert aussi celles SANS Test, qui
 *  n'ont rien à mettre en jeu) sans connaître le stock ni rattraper un throw. */
export function hasActivityStake(activityId: string): boolean {
  return !!stakeEntry({ dataset: 'activite', kind: activityId });
}

/** Enjeu d'une ACTIVITÉ (#1117 L3, `stakeRef`) : le renvoi vise le foyer déclaré, à défaut la fiche
 *  Codex de l'Activité elle-même. */
export function activityStakeRef(activityId: string): StakeRef {
  return stakeRef('activite', activityId);
}

/** Enjeu de MÉTÉO (Test de Résistance de traversée, `stakeRef`) : l'appelant n'appelle QUE si la
 *  condition déclare un Test (`weatherResistanceTest`). */
export function weatherStakeRef(weatherId: string): StakeRef {
  return stakeRef('meteo', weatherId);
}

/** Enjeu de RÉCUPÉRATION d'un État (`stakeRef`) : l'appelant n'appelle QUE pour un État qui déclare
 *  `recover` (`etats.json`), dont `enjeu` est exigé au schéma. */
export function stateRecoveryStakeRef(etatId: string): StakeRef {
  return stakeRef('etat', etatId);
}

/** Enjeu d'une MODALE MONO (#1117 L1b, `stakeRef`) : le TYPE ferme l'id (`FlowStakeId`, généré) en
 *  PREMIER rideau, le throw est le second. `entryId` = la chanson chantée, le type de Test d'équipage. */
export function flowStakeRef(
  id: FlowStakeId,
  opts?: { entryId?: string; values?: Record<string, string | number> },
): StakeRef {
  return stakeRef('flux', id, opts);
}

/** ENTITÉ PORTEUSE d'un enjeu dérivé, résolue en `{catégorie Codex, fiche}` — `undefined` si la
 *  nature de source n'a pas de foyer interrogeable ou si l'id n'y existe pas. FAIL-CLOSED : sans
 *  entité résolue il n'y a NI texte NI renvoi, donc pas d'enjeu dérivé (jamais une phrase qui nomme
 *  un id brut ou un foyer mort). */
function derivedEntry(from: EffectSource): { category: string; entry: { label: string } } | undefined {
  const category = CATEGORY_BY_SOURCE_KIND[from.kind];
  const entry = category ? findById(category, from.id) : undefined;
  return entry ? { category, entry } : undefined;
}

/** PORTE de l'enjeu DÉRIVÉ du porteur (#1262 V2 L6d) — la troisième provenance, à côté du dataset
 *  (`combatStakeRef`…) et du document (`AuthoredStake`). Rend `undefined` quand la source manque ou
 *  ne nomme aucune fiche : le producteur n'a alors rien à dire, et il vaut mieux se taire qu'inventer.
 *  PURE : aucun texte ici — seuls les IDS entrent dans la référence. */
export function derivedStake(from: EffectSource | undefined): StakeRef | undefined {
  return from && derivedEntry(from) ? { from: { kind: from.kind, id: from.id } } : undefined;
}

/** L'enjeu PARLE-t-il ? PRÉDICAT partagé par le RÉSOLVEUR (qui jette sinon) et par le VALIDATEUR de
 *  scène (qui refuse le document) — une seule définition de « utilisable », sans quoi l'authoring
 *  déclarerait bon ce que le runtime refuse. Un enjeu authoré BLANC ne dit rien : un document portable
 *  peut être édité hors de l'app (JSON à la main, outil tiers), et `'   '` y passerait la présence.
 *  Une réf de dataset parle par construction (ses portes sont fail-closed à la construction) ; un
 *  enjeu DÉRIVÉ parle si son entité porteuse a toujours sa fiche. PUR. */
export function stakeSpeaks(stake: StakeRef | undefined): boolean {
  if (!stake) return false;
  if (stake.from != null) return !!derivedEntry(stake.from);
  return stake.authored != null ? !!stake.authored.trim() : true;
}

/** RÉSOLVEUR UNIQUE d'enjeu (#1117) — la seule porte qui transforme une `StakeRef` en texte affichable.
 *  FAIL-CLOSED aux DEUX bouts : une clé sans entrée JETTE (une surface qui demande son enjeu et n'en
 *  reçoit AUCUN en silence, c'est l'étape muette qu'on a supprimée), et un trou sans valeur JETTE
 *  aussi (un « {driftKm} » affiché tel quel serait un texte cassé rendu au joueur).
 *  Une entrée SANS gabarit rend un enjeu sans `text` : ce n'est pas un silence — son issue est dite
 *  par les chips d'ops du jet, et son foyer de règle reste rendu.
 *  ENJEU AUTHORÉ (`AuthoredStake`, Flow d'un document de scène) : le document EST la source, il n'y a
 *  ni entrée à chercher ni trou à remplir — le texte sort tel qu'authoré, sans foyer de règle.
 *  ENJEU DÉRIVÉ (`DerivedStake`) : l'entité porteuse EST ce qui se joue — son LIBELLÉ est résolu ICI
 *  (l'étape ne porte que des ids) et sa fiche est le foyer de règle. La porte reste UNIQUE : la
 *  surface ne connaît toujours que `resolveStake`. */
export function resolveStake(ref: StakeRef): ResolvedStake {
  if (ref.from != null) {
    const found = derivedEntry(ref.from);
    if (!found) throw new Error(`resolveStake(dérivé '${ref.from.kind}/${ref.from.id}') : entité porteuse introuvable — une surface qui LANCE dit ce qu'elle met en jeu`);
    return { text: `Ce qui se joue : ${found.entry.label}.`, rule: { category: found.category, id: ref.from.id } };
  }
  if (ref.authored != null) {
    if (!stakeSpeaks(ref)) throw new Error('resolveStake(authoré) : enjeu vide — un Flow qui LANCE dit ce qu\'il met en jeu');
    return { text: ref.authored };
  }
  const entry = stakeEntry(ref.key);
  if (!entry) {
    throw new Error(`resolveStake('${ref.key.dataset}/${ref.key.kind}') : aucune entrée d'enjeu — une surface qui LANCE dit ce qu'elle met en jeu`);
  }
  const text = entry.text?.replace(TROU_D_ENJEU, (_m, name: string) => {
    const v = ref.values?.[name];
    if (v == null) throw new Error(`resolveStake('${ref.key.dataset}/${ref.key.kind}') : valeur manquante pour « ${name} »`);
    return String(v);
  });
  return { ...(text ? { text } : {}), ...(entry.rule ? { rule: entry.rule } : {}) };
}

/** Une espèce jouable, au type de son schéma (`schemas/defs/species.ts`) : `id` STABLE (cible de `Combatant.species`,
 *  pregens, draft), le `label` ne sert qu'à l'affichage. */
export type SpeciesData = EntreeDe<typeof speciesDef>;
export interface ClassData {
  /** id STABLE (slug du libellé) — cible de `CareerData.class`. */
  id: string;
  type: 'classes';
  label: string;
  /** Ids de `groups.json` accordés à tout titulaire d'une carrière de cette Classe (`groupesDe`) —
   *  ex. la classe des Roublards ouvre le Groupe « Criminel ». Absent = aucun Groupe. */
  grantGroups?: string[];
  /** Possessions de départ (`dotationSansTexteSchema`). LDB 05 l.552 */
  trappings: TrappingRef[];
  desc: string;
  source: SourceRef;
}
export type CareerData = EntreeDe<typeof careersDef>;
/** Un Niveau de Carrière, au type de son schéma (`schemas/defs/careerLevels.ts`). LDB 7 */
export type CareerLevelData = EntreeDe<typeof careerLevelsDef>;
/** Entrée `specs[]` d'une Compétence/Talent — id STABLE (résolu par `specLabel`, cf. `langue`/
 *  `chevaucher`/`discretion`/`art`/talent `resistance`) + libellé d'affichage FR. Un domaine
 *  `specsSource` n'a PAS de `specs[]` (le pool DÉRIVE du registre partagé, cf. `specPoolOf`).
 *  `pool: false` — l'entrée est VALIDE (résolution, `testValue`, bonus de règle) mais n'est pas
 *  PROPOSÉE d'office par le créateur/l'avancement (`LDB 09 l.40`) ; les écrans de RÉFÉRENCE
 *  l'impriment (`specCatalogOf`). Absente = dans le pool. CATALOGUE ⊇ POOL (`specAuCatalogue`, `grammaire/ref.ts`). */
export type SpecEntry = { id: string; label: string; source?: SourceRef; alsoIn?: SecondaryRef[]; pool?: false };
/** id d'une entrée `specs[]`. */
export function specEntryId(e: SpecEntry): string {
  return e.id;
}
/** Libellé d'affichage d'une entrée `specs[]`, lu comme l'espace de ses libellés le lit (`LIBELLE_AU_LABEL`). */
export function specEntryLabel(e: SpecEntry): PlayerText {
  return dataLabel(libelleDeLElement(e, LIBELLE_AU_LABEL.champs), e.id);
}
/** Registre partagé qui DÉRIVE le pool d'ids d'une `specs[]` (résolu en libellé par `specLabel`, énuméré
 *  par `wildcardSpecs`) — chaque valeur pointe UNE entrée du catalogue `SPEC_SOURCES` (SSOT, fin des
 *  `specs[]` maintenues à la main qui dérivaient) : `weaponGroupsMelee`/`weaponGroupsRanged` (Corps à
 *  corps / Projectiles — ids de `weaponGroups.json` filtrés par `combat`), `winds` (Focalisation —
 *  Domaines à `wind` de `domains.json`, AFFICHE le Vent), `arcaneDomains` (Magie des Arcanes — Domaines
 *  `arcane` de `domains.json`, AFFICHE le Lore), `cultBlessings`/`cultMiracles`/`cultChaos` (Béni /
 *  Invocation / Magie du Chaos — `gods.id` filtrés par `blessings`/`miracles`/`chaosSpells`, AFFICHE le
 *  nom du dieu), `seaShanties` (Chanson de marin — ids de `sea-shanties.json`). Sources d'ARGUMENT de Trait
 *  (Immunité, Peur, Vulnérabilité, Mutation, Souffle…) : `ciblesPsy` (Cible d'un Trait psy ciblé — un Groupe de `groups.json` ; une scène admet en plus `@id`, un
 *  individu, `refusDuTraitPose` de `grammaire/reference.ts`),
 *  `groupesDAppartenance` (Ennemi de Sans Peur — la sous-liste `CIBLE_D_APPARTENANCE` de `groups.json`),
 *  `diseases` (Maladie — `maladies.json`), `sizes` (catégorie de Taille — `engine/size`), `mutations`
 *  (Mutation — `mutations.json`), `breathTypes` (Type de Souffle — `breath-types.json`), `damageTypes`
 *  (Immunité aux Dégâts — `damage-types.json`, lue par la Condition `has … what:'immunity'`), `weaponsMelee`/
 *  `weaponsRanged` (Arme / À distance, LDB 85 l.33/9 — `arg` = une arme PRÉCISE du catalogue `trappings`
 *  filtrée par `type`, `specsOpen` car ces traits acceptent aussi une attaque naturelle/générique hors
 *  catalogue), `exposureLevels` (Degré de Corruption — vocabulaire `ExposureLevel`), `difficulties`
 *  (Difficulté du Venin — vocabulaire `Difficulty`). Absent = specs inline (`SpecEntry[]`). */
export type SpecsSource =
  | 'weaponGroupsMelee'
  | 'weaponGroupsRanged'
  | 'winds'
  | 'arcaneDomains'
  | 'cultBlessings'
  | 'cultMiracles'
  | 'cultChaos'
  | 'seaShanties'
  | 'ciblesPsy'
  | 'groupesDAppartenance'
  | 'diseases'
  | 'sizes'
  | 'mutations'
  | 'breathTypes'
  | 'damageTypes'
  | 'weaponsMelee'
  | 'weaponsRanged'
  | 'exposureLevels'
  | 'difficulties';
export interface SkillData {
  /** Identifiant STABLE (slug du libellé d'origine) — cible des références structurées, robuste au
   *  renommage du `label`. Source unique pour la porte `byId('skill', …)`. */
  id: string;
  type: 'skills';
  label: string;
  characteristic: import('../engine/types').CharKey;
  /** ACCÈS (`LDB 09 l.25/l.30`) : `base` (testable sans formation) / `avancee` (exige une Augmentation). */
  acces: 'base' | 'avancee';
  /** Spécialisations inline (`SpecEntry[]`) — ABSENT quand `specsSource` est présent (le pool DÉRIVE
   *  alors du registre partagé, cf. `specPoolOf` : aucune liste tenue à la main). */
  specs?: SpecEntry[];
  /** Source du pool de spéc (via `SPEC_SOURCES`/`specPoolOf`/`specLabel`) : FERMÉE. Si présent, les `spec`
   *  des instances de cette Compétence sont des ids résolus via ce registre partagé — `weaponGroupsMelee`/
   *  `weaponGroupsRanged` (Corps à corps / Projectiles → ids de `weaponGroups.json` filtrés par `combat`)
   *  ou `winds` (Focalisation → Domaines à Vent de `domains.json`, AFFICHE le Vent) — et `specs[]` est
   *  ABSENT. Sans `specsSource` = specs inline (`SpecEntry[]`). */
  specsSource?: SpecsSource;
  /** Le domaine accepte-t-il un TEXTE LIBRE hors `specs[]` (Métier, Savoir-région) ? `true` = OUVERT —
   *  `specs[]` n'est qu'un historique/suggestions, pas une liste fermée. Absent/`false` = FERMÉ — la
   *  valeur `spec` d'une instance DOIT être un id de `specs[]` (`refusDeSpec`, `schemas/grammaire/ref.ts`). */
  specsOpen?: boolean;
  /** Posséder une Spécialisation rend les autres de Base (`possesses`). LDB 09 l.571. */
  specsSoeursDeBase?: boolean;
  desc: string;
  source: SourceRef;
  /** Test « impliquant un déplacement » (LDB 16 l.35/64) : ciblé par les pénalités d'État À Terre /
   *  Empêtré (`movementOnly`). Classification de COMPÉTENCE portée par la DONNÉE (éditable au Codex),
   *  lue par `engine/conditions.testStatePenalty`, jamais par une liste d'ids en dur. */
  movement?: boolean;
  /** Sens qu'implique un Test de cette Compétence (LDB 16 l.29, l.45 ; LDB 18 l.273) : ciblé par les
   *  pénalités restreintes à un sens (`testMod.sense`). Classification portée par la DONNÉE, lue par
   *  `engine/conditions`. LDB 18 l.273 « et autres » : seules les Compétences qu'il nomme sont classées. */
  senses?: PairedSense[];
  /** Caractéristique ALTERNATIVE de cette Compétence sous RÈGLE OPTIONNELLE (Métier comme Savoir → Int,
   *  `LDB 09 l.358` ; Intimidation → FM/Int, `LDB 09 l.294`) : `gatedByRule` = la règle optionnelle
   *  (`ref('regleOptionnelle')`, `schemas/defs/skills.ts`), `from` = Caractéristique de base à laquelle la
   *  substitution s'applique (absente = toutes), `chars` = Caractéristique à utiliser PAR VALEUR de la
   *  règle (clé = valeur rendue par `rule()` convertie en chaîne — `"true"` pour un interrupteur ; une
   *  LISTE = la MEILLEURE des Caractéristiques citées chez le porteur). Lu par `altCharKey`
   *  (`engine/skills`), POINT UNIQUE : le moteur ne nomme plus aucune compétence. */
  altChar?: {
    gatedByRule: { id: IdsParEspace['reglesOptionnelles.json'] };
    from?: CharKey;
    chars: Record<string, CharKey | CharKey[]>;
  };
  /** Application de COMBAT « cumuler l'Avantage » (LDB 09 l.60/305-308) : passer son tour à réussir un Test
   *  de cette Compétence donne +1 Avantage, jusqu'à un maximum égal au Bonus de la Caractéristique `cap`
   *  (Intuition/Savoir/Survie → Int ; Prière → Soc). Lu par `engine/skillCombatApps.skillAdvantageCap`. */
  combatAdvantage?: { cap: CharKey };
  /** Substitution en COMBAT d'une Compétence sociale à la Compétence de combat (LDB 09) : Intimidation
   *  « à la place de Corps à corps … face à ceux qui ont peur de vous » (l.287), Dressage « au lieu de
   *  Corps à corps » après avoir instillé la peur (l.207). `role` = défense / attaque / les deux ; `gate`
   *  = condition d'accès (`peur` : l'adversaire est sous une Peur/intimidation SOURCÉE par ce personnage).
   *  Lu par `engine/skillCombatApps`. */
  combatSubstitute?: { role: 'defense' | 'attaque' | 'lesDeux'; gate: 'peur' };
  /** OUTIL requis par la Compétence (Crochetage → outils de crochetage, LDB 09 l.168 : « Les Niveaux de
   *  Difficulté supposent l'utilisation d'outils de crochetage. Des crochets improvisés… peuvent être
   *  utilisés avec une pénalité de -10 ») : `capability` = clé `ItemCapabilities` que doit porter un
   *  objet POSSÉDÉ de l'acteur (lecture NON gatée sur le port, comme `isRations`) ; sans un tel objet,
   *  `withoutMod` s'applique au Test (`testValue`). GÉNÉRIQUE — toute compétence-à-outil se déclare en
   *  donnée (skills.json), zéro code par objet. */
  tool?: { capability: keyof ItemCapabilities; withoutMod: number };
}
/** UN « matcher » de Test (recodage de la ligne « Tests : » du livre, cf. `TalentTest`) : à quel(s)
 *  Test(s) le talent se rapporte. `skill` (référence de Compétence `{id, spec?}`, XOR `characteristic`) OU `characteristic`
 *  (Caractéristique nue). La `spec` de la référence est la spécialisation FIXE ; `specFromInstance` =
 *  « (Au choix) » → matche la spec CHOISIE de l'instance (`t.spec`). `when` = contexte MÉCANISABLE (Condition combat — auto si vraie) ; `manual` =
 *  contexte NARRATIF inmécanisable (« quand vous soulevez ») → advisory, JAMAIS auto-appliqué. */
export interface TestMatch {
  skill?: RefDesignee;
  characteristic?: import('../engine/types').CharKey;
  specFromInstance?: boolean;
  /** EXCLUT une spécialisation (matche toute spec SAUF celle-ci) — Linguistique « Langue (toutes) » qui
   *  « ne fonctionne pas avec Langue (Magick) » : `{ skill:{id:'langue'}, exceptSpec:'magick' }`. */
  exceptSpec?: string;
  when?: import('../engine/flowCore').Condition;
  manual?: boolean;
}
/** Champ « Tests » d'un Talent (LDB 10 : +1 DR/niveau sur un Test lié RÉUSSI). `raw` = la ligne du livre
 *  VERBATIM (affichage Codex, rule 5) ; `matches` = la forme STRUCTURÉE id-based lue par la logique
 *  (`talentTestSLBonus`/`castTestTalentDR`) — la logique ne lit JAMAIS `raw`. */
export interface TalentTest {
  raw: string;
  matches: TestMatch[];
}
export interface TalentData {
  /** Identifiant STABLE (slug du libellé d'origine) — cible des références structurées, robuste au
   *  renommage du `label`. Source unique pour `findTalentById`. */
  id: string;
  type: 'talents';
  label: string;
  /** Maxi d'acquisitions (LDB 10 « Schéma des Talents ») : un nombre fixe, ou le BONUS d'une
   *  caractéristique (`{bonusOf}`, structuré — remplace la chaîne « Bonus de X » re-parsée par regex),
   *  ou `null` = sans limite (ex-« Aucun »). */
  max: number | { bonusOf: import('../engine/types').CharKey } | 'sortsDuDomaine' | null;
  /** Ligne « Tests » recodée : `{ raw verbatim (Codex), matches[] structuré (logique) }`. `null` = le
   *  talent ne se rapporte à aucun Test. */
  test: TalentTest | null;
  desc: string;
  /** Lecture ALTERNATIVE « Avantage de groupe » (Aux Armes, Annexe III — l.4347-4442), verbatim. Affichée
   *  à la place de `desc` quand la règle `combat-aa-avantage-groupe` est active (Compendium/Codex). Le champ
   *  MÉCANIQUE correspondant est `combat.aa`. Absent = le Talent ne change pas en mode groupe. */
  descAA?: string;
  specs?: SpecEntry[];
  /** Catégorie de Taille CONFÉRÉE par le talent (Massif → `grande`, Petit → `petite`, LDB 85 l.344-354) —
   *  lue par `createHero` (#572), même vocabulaire que la Taille de créature (`SizeCategory`). */
  size?: import('../engine/size').SizeCategory;
  /** Source du pool de spéc (via `SPEC_SOURCES`/`specPoolOf`/`specLabel`) : `arcaneDomains` (Magie des
   *  Arcanes → Domaines `arcane` de `domains.json`, AFFICHE le Lore), `cultBlessings`/`cultMiracles`/
   *  `cultChaos` (Béni / Invocation / Magie du Chaos → `gods.id` filtrés, AFFICHE le nom du dieu) ou
   *  `seaShanties` (Chanson de marin). Quand présent, `specs[]` est ABSENT (le pool dérive). */
  specsSource?: SpecsSource;
  /** Ids de `groups.json` accordés au porteur du Talent (`groupesDe`). Absent = aucun Groupe. */
  grantGroups?: string[];
  /** Le `spec` de ce Talent nomme une entrée de son registre (`SPEC_SOURCES[specsSource].entree`) dont les
   *  `grantGroups` sont accordés au porteur (`groupesDe`) — Béni (Sigmar) fait un « sigmarite ». Absent =
   *  aucun Groupe. */
  grantSpecGroups?: true;
  /** Le `spec` de ce Talent nomme un Domaine arcanique (`DomainData.id`) que le porteur PRATIQUE — il
   *  compte donc dans les Domaines TENUS et sous le plafond d'apprentissage (`LDB 46 l.177`, repris
   *  `VDM 02 l.190-192`), lu par `heldArcaneDomains` (`engine/careerSlots`). Volontairement DISTINCT de
   *  `specsSource: 'arcaneDomains'`, qui ne décrit que le POOL de spécialisations offert au picker : un
   *  Talent futur pourrait nommer un Domaine sans en octroyer la pratique. */
  grantsArcaneDomain?: true;
  /** Le domaine de ce Talent accepte-t-il un TEXTE LIBRE hors `specs[]` ? Même sémantique que
   *  `SkillData.specsOpen` (absent/`false` = FERMÉ, `spec` DOIT être un id de `specs[]`). */
  specsOpen?: boolean;
  /** Trait de créature conféré, la spécialisation de l'instance en argument (`traitsConferes`). LDB 10 l.506, l.548 */
  confereTrait?: { id: string };
  source: SourceRef;
  /** Emplacements SECONDAIRES du même Talent (`sourceRefs.ts`), l'ancre `source` restant la seule à
   *  porter la `desc`. */
  alsoIn?: SecondaryRef[];
  /** Effets MÉCANIQUES authorés (déclencheur → ops du Flow) — Talents « effet sur événement » (Assaut
   *  féroce `onHit`, Frappe réactive `onCharged`…), appliqués par `noyau/triggeredEffects` exactement comme
   *  les traits. Type-only (le moteur reste pur). Édité au Codex par `TriggeredEffectsField`. */
  effects?: TriggeredEffect[];
  /** Modificateurs PASSIFS continus (Coup puissant, Dur à cuire…) en `OpPassive[]` — MÊME vocabulaire que les
   *  sorts/traits, lus par le collecteur passif (`talentPassiveMods` → `passiveMods`, kind `intrinseque`,
   *  répété par niveau). Édité au Codex par `GameOpEditor`. L'octroi d'attaque gratuite (Frénésie) vit ici :
   *  `grantFreeAttack{when:'available'}`, lu par `availableAttacks`. */
  passive?: import('../engine/ops').OpPassive[];
  /** Capacités de combat/jeu (LDB 10) en DONNÉE : sac de flags lu par `featuresOf`/`dispatch` (Coup
   *  puissant `meleeDamageBonus`, Riposte, Tueur, castingKind…). Remplace les `combatFeatures/defs/*.ts`. */
  combat?: import('../engine/combatFeatures/types').CombatFeature;
  /** `true` = contenu de RÉFÉRENCE (PNJ/campagne scriptée), pas un Talent de progression PJ standard —
   *  le RAW lui-même le dit explicite (« ne sont pas accessibles à d'autres personnes dans des
   *  circonstances normales », EDOC 13 l.83 ; « Carrière destinée uniquement aux PNJ … avec la
   *  permission du MJ », EDOC 13 l.137 ; lignage Éonir Harioth hors espèces jouables, ADE I 6 l.185).
   *  Lu par `computeObtainability` (`scripts/data/lib/obtainabilityGraph.ts`, #326) pour exempter la
   *  garde `obtainability-guard.test.ts` — jamais un silence sur un Talent sans chemin d'octroi PJ. */
  codexOnly?: true;
  /** Arbitrage NON-verbatim documentant l'entrée (même patron que `TraitData.maison`/`CreatureData.maison`) —
   *  porte la CITATION du passage et la couture qui manque quand le Talent n'a PAS de `passive`/`effects`/`combat`
   *  alors que sa prose donne une mécanique (#1011). Jamais lu par le moteur. */
  maison?: string;
}
/** Capacités IRRÉDUCTIBLES d'un objet (drapeaux NON exprimables en GameOp) — canal `capabilities`, MÊME
 *  logique que `TraitCapabilities`/`QualityCapabilities` : règles que le moteur INTERROGE par id, jamais
 *  par le nom FR de l'objet. Lues par `engine/capabilities` (`itemCapability` par-objet, `hasCapability`
 *  agrégat par-personnage cross-source). */
export interface ItemCapabilities {
  /** LDB 62 l.58 ; AA 08 l.212 */
  improvisedWithoutCharge?: boolean;
  /** Gantelet verrouillé (AA folio 94) : le porteur NE LÂCHE PAS l'arme tenue dans la main gantée la 1re
   *  fois que les circonstances l'y forceraient (désarmement / Piège-lame) — lu par `applyBladeTrap`
   *  (GATÉ sur le port). */
  preventForcedDrop?: boolean;
  /** Protège des intempéries (Cape/Manteau, LDB 65 l.44) — annule le malus de Test d'Exposition au
   *  froid (GATÉ sur le port). */
  weatherProtection?: boolean;
  /** Abri de campement (Tente, LDB 74 l.39) — annule/atténue l'Exposition d'une nuit dehors (NON gaté). */
  isShelter?: boolean;
  /** Ration de voyage (« Ration (1 jour) », LDB 66 l.20) — consommée par l'entretien de Faim (NON gaté). */
  isRations?: boolean;
  /** Grimoire / livre de Sorts (LDB 47 l.21) — un Sort non mémorisé du Domaine peut y être lu (NON gaté). */
  isGrimoire?: boolean;
  /** Outils de crochetage (LDB 67 l.66 : « nécessaire pour utiliser la Compétence Crochetage sans
   *  pénalité ») — consommé par `SkillData.tool` (crochetage → −10 sans outil, LDB 09 l.168). NON gaté
   *  sur le port : les posséder suffit (on les sort pour s'en servir, comme `isRations`). */
  lockpicks?: boolean;
  /** Soupe de chou fermenté (MDG 14 l.230) : le Test de contraction du scorbut passe à Facile (+40)
   *  « si le Personnage mange régulièrement de la soupe » — NON gaté (posséder ses rations suffit). */
  scurvyGuard?: boolean;
  /** Peau de phoque (MDG 14 l.277-279) : « +1 DR sur les Tests de Résistance effectués pour supporter
   *  l'exposition au froid » — GATÉ sur le port (c'est un pardessus). */
  sealskin?: boolean;
  /** Pièces détachées de navire (MDG 14 l.281-283) : « consommées quand vous entreprenez l'Activité
   *  Entretien du navire » — NON gaté (stock de cale). */
  shipParts?: boolean;
  /** Arme SOLIDEMENT FIXÉE au porteur (Poing de fer ogre, ADE II 02 l.694-698 : « il ne pourra pas en
   *  être désarmé ») — immunité PERMANENTE et INCONDITIONNELLE au retrait (`case 'disarm'`, `engine/ops.ts`),
   *  distincte du Gantelet verrouillé (`preventForcedDrop`, AA folio 94 : protection À USAGE UNIQUE par
   *  période avec pénalité de -20). Lue par-objet (`itemCapability`), pas gatée sur le port : l'arme est
   *  fixée à la main qui la tient. */
  disarmImmune?: boolean;
  /** Arme à corde séparable (Lance-harpon, ADE II 02 l.677 : « Si la corde est séparée de la flèche, la
   *  portée passe à 60 et l'arme ne possède plus l'Atout Immobilisante ») — active le mode de tir
   *  `WeaponContext.harpoonRopeCut` (`effectiveWeapon`, `noyau/combatFlow.ts` `weaponContextOf`), choisi
   *  par le joueur avant le jet (`PendingAttack.harpoonRopeCut`). Lue par-objet (`itemCapability`). */
  ropeMode?: boolean;
  /** Contenant d'eau (Outre à eau, LDB 64 l.18 / Seau, LDB 67 l.59) : consommé par l'action de combat « Asperger
   *  d'eau » (MDG 16 l.19, #497) qui pose `Combatant.wateredThisRound` sur une Créature marine
   *  adjacente hors de l'eau — NON gaté sur le port (on le sort du sac, comme `isRations`). */
  waterContainer?: boolean;
}
export interface TrappingData {
  /** id STABLE (slug du libellé) — cible des `TrappingRef`, robuste au renommage. */
  id: string;
  label: string;
  /** Latéralité TYPÉE (LDB 62) : `2` = arme à deux mains, absent = une main. SOURCE DE VÉRITÉ unique
   *  et multilangue-safe — jamais un marqueur d'affichage re-parsé dans le libellé. */
  hands?: 1 | 2;
  /** Taille TYPÉE du paquet de munitions (« 12 flèches », LDB 290) — jamais lue dans le libellé. */
  packSize?: number;
  /** CATÉGORIE de catalogue — vocabulaire FERMÉ `TrappingTypeId`, miroir de l'enum du def.
   *  ≠ `Weapon.type` (moteur) et ≠ `ItemInstance.kind` : le pont est `kindOf()` (traduction). */
  categorie: TrappingTypeId;
  /** Groupe d'objet (`WeaponGroupData`) : Groupe d'arme (Base/Escrime…), famille de munition
   *  (Arc/Poudre noire…), type d'armure (Plate/Mailles…) ou catégorie d'inventaire. */
  subType: { id: string } | null;
  /** Groupe de Projectiles qui OPÈRE une arme de siège (`WeaponGroupData` : arbalete/catapulte/ingenierie/
   *  poudre-noire, AA 10 l.178-193) quand `subType` = catégorie de catalogue (« armes-de-siege »). Pilote
   *  la Spé de tir (`acceptableSpecs`) et le décompte d'équipage (Projectiles appropriée, AA 10 l.230). */
  weaponGroup?: { id: string };
  /** Rendu visuel et sonore de l'arme (`rendus.json`), à la place de celui de son Groupe : un engin de siège, dont le
   *  Groupe dit qui le sert, pas ce qu'il tire (#3771). */
  rendu?: { id: string };
  /** Pièce d'artillerie « relativement simple » (la baliste, AA 10 l.148) : tirée par UN seul servant
   *  valide → perd tous ses Atouts (garde ses Défauts). Lu par `crewedFireWeapon`. */
  soloSimple?: boolean;
  /** Pièce à TIR INDIRECT (mortier/catapulte — « arc élevé », AA 10 l.169/171) : peut viser une CASE au sol.
   *  Propagé Trapping → ItemInstance → Weapon (`indirect`) ; lu par `availableAttacks`. Canon/baliste = direct. */
  indirect?: boolean;
  /** LDB 62 l.278 — approximation MAISON (le RAW ne liste pas les armes à lame), éditable. Propagé
   *  Trapping → ItemInstance → Weapon (`bladed`). */
  bladed?: boolean;
  /** LDB 47 — approximation MAISON (matière du projectile, non tabulée par le RAW), éditable. Propagé
   *  Trapping → ItemInstance → Weapon (`organicProjectile`). */
  organicProjectile?: boolean;
  /** Effets DÉCLENCHÉS « à la touche » portés en DONNÉE (`TriggeredEffect[]`, MÊME vocabulaire que les
   *  enchantements d'arme et les traits) : Canon à flammes nain — « 2 + DR États En flammes à chaque cible
   *  affectée » (ADE II 8 l.243). Propagé Trapping → ItemInstance → Weapon (`onHitEffects`), dispatché
   *  par `fireTriggers('onHit')` sur la cible primaire ET les cibles de la zone d'Explosion. */
  onHitEffects?: import('../engine/flowCore').TriggeredEffect[];
  /** PORTÉE MINIMALE de tir (bande) : la cible plus proche que cette bande REFUSE le tir (≠ malus). Machines
   *  de siège à distance = `'courte'` (pas de Bout Portant, ADE II 8 l.253) ; trébuchet/mortier =
   *  `'moyenne'` (« distance inférieure à leur Portée Courte » interdite, l.251). Propagé jusqu'à `Weapon`,
   *  lu par `firedAttackBlock` (`belowMinRangeBand`). Absent = pas de minimale. */
  minRangeBand?: import('../engine/types').RangeBandId;
  /** Les munitions (`categorie:'ammunition'`) d'une arme de siège, la représentative en tête : les seules qu'elle
   *  charge (`chargeLArme`). AA 10 l.150 ; MDG 12 l.410-424 */
  munitions?: string[];
  /** EMPREINTE de grille (côté N×N) de l'affût POSÉ en combat — recopiée sur `Combatant.footprint`
   *  (`footprintN`), MÊME champ que `VehicleData.ship.footprint`. ADE II 8 l.239/258 (profil + description
   *  physique du tronc suspendu sur portique à roues) ne chiffre aucune Taille en cases : la valeur posée
   *  en donnée (2, belier-ade2, #210) reste éditable au Compendium plutôt que codée en dur ailleurs. Absent
   *  = empreinte 1 (affûts compacts type baliste/canon). */
  siegeFootprint?: number;
  /** #2967 */
  shape?: { id: string };
  /** LDB 62 l.28 */
  unarmed?: true;
  /** LDB 62 l.31 ; LDB 62 l.135 */
  improvised?: true;
  /** LDB 62 l.33-35 ; AA 08 l.156 ; ZI 13 l.911 ; AA 08 l.290 ; ADE II 02 l.613 */
  shield?: true;
  /** Formes choisibles (racines de `apparences.json`) d'une arme ABSTRAITE (« Arme simple » → épée/hache/
   *  masse/marteau de guerre/demi-lance). Le picker pose le choix sur `ItemInstance.apparence` ;
   *  défaut = `shape` du trapping. Absent pour une arme à forme unique. */
  formChoices?: string[];
  /** Emplacement de la garde-robe où l'objet porté se range hors des mains (#3116). */
  rangement?: { id: EmplacementId };
  /** Arme INHABITUELLE (ACE 12 l.17 « Entraînement avec une arme inhabituelle ») : exige la
   *  maîtrise (`Combatant.masteredWeapons`) pour être maniée avec la Compétence du Groupe. Flag
   *  d'AUTEUR (artefacts uniques : « le couteau de lancer de Harald L'Infâme ») — éditable au Codex. */
  requiresMastery?: boolean;
  /** Maniements de l'arme dans d'autres Groupes de Corps à corps que `subType`, par id de Groupe
   *  (`WeaponGroupData.id`) ; ils s'ajoutent à ceux de son Groupe (`GroupeDArme.manieAussi`), et l'emportent
   *  sur eux à Groupe égal. Choix : `maniementRetenu` (`engine/weaponGroup.ts`). AA 08 l.188 ; AA 08 l.190 ;
   *  AA 08 l.314 ; AA 08 l.343 */
  manieAussi?: Record<string, ManiementAlternatif>;
  /** PROTHÈSE (LDB 73) : ses PALIERS d'entraînement, achetés dans l'ordre déclaré. `cost` = PX ;
   *  `label` = libellé JOUEUR du palier (éditable — aucun texte de palier en dur à l'écran) ;
   *  `reduces` = points de pénalité rachetés par ce palier (`ItemInstance.prosthesisReduced`, cumulés) ;
   *  `grants` = aspect ENTIÈREMENT levé (`movement` → `prosthesisMoveTrained`, `all` → `prosthesisTrained`).
   *  Les deux formes du RAW : Fausse jambe = 2 paliers à `grants` (100 PX Mouvement puis 200 PX Esquive,
   *  l.23) ; Crochet = rachat GRADUÉ (l.19 « 100 PX pour chaque tranche de 5, soustraite de la pénalité,
   *  retirant la pénalité entière pour 400 PX ») = 4 paliers `reduces:5`, le dernier portant `grants:'all'`.
   *  Lu par `nextProsthesisTier` (engine/trauma) — l'écran et le flux d'achat ne nomment aucune prothèse. */
  prosthesisTraining?: { px: number; label: string; reduces?: number; grants?: 'movement' | 'all' }[];
  /** Encombrement (Points d'Encombrement). Honnête : la donnée porte aussi des STRINGS pour des cas
   *  NON-ENCOMBRANTS / non chiffrés — `'ND'` (ateliers : on ne les transporte pas) et `'Variable'`
   *  (arme improvisée). Ces strings sont traitées comme 0 au calcul (`itemFromTrappingById`). */
  enc: number | 'ND' | 'Variable' | null;
  /** Taille PRÉVUE pour l'objet (ADE II 2 l.706-710) — présente sur la version « taille ogre » d'une
   *  possession ordinaire (`enc` reste la valeur CLASSIQUE, doublée au runtime, `totalEncumbrance`). Absente
   *  sur le catalogue NATIVEMENT ogre (massue ogre, pansière ogre… l.604 : Enc déjà entré à sa valeur pleine,
   *  pas de doublement). Propagée à `ItemInstance.sizeFor` / `Weapon.sizeFor`. */
  sizeFor?: import('../engine/size').SizeCategory;
  availability: Availability | 'ND' | null;
  /** Allonge de MÊLÉE — vocabulaire FERMÉ `ReachValue` (les sept longueurs de LDB 62 l.156-164, plus
   *  « Variable » l.31) ou null, VALIDÉ au chargement par le schéma zod (`schemas/defs/trappings.ts`).
   *  NE conflate PLUS aucune Portée de tir : ni nombre, ni formule « BFx3 » (→ `range:{bf}`), ni
   *  modificateur de munition « Moitié de l'arme »/« +50 »/« Comme l'arme » (→ `ammoRangeMod`). */
  reach: import('../engine/types').ReachValue | null;
  /** Portée de TIR — SPEC non résolue (`WeaponRangeSpec`) : `number` = mètres FIXES (arc/arbalète/
   *  pistolet…), `{bf}` = Bonus de Force × bf mètres (armes de JET — javelot/bombe…). Absent/null pour
   *  la mêlée et les munitions (qui héritent de l'arme). Résolue à l'usage par `effectiveRange`. */
  range?: import('../engine/types').WeaponRangeSpec | null;
  /** MUNITION : modificateur STRUCTURÉ de la Portée de l'arme de tir (`AmmoRangeMod` : `{mult}` fraction /
   *  `{add}` mètres ±). Appliqué en combat (`porteeDeTir`) à l'arme qui tire cette munition. « Comme
   *  l'arme » = absent/null (Portée de l'arme inchangée). Sorti de `reach` (qui n'est qu'une Allonge mêlée). */
  ammoRangeMod?: import('../engine/types').AmmoRangeMod | null;
  loc: string | null;
  pa: number | null;
  /** Dégâts d'arme STRUCTURÉS (cf. `WeaponDamageSpec`) — remplace la chaîne « +BF+4 » re-parsée au runtime. */
  damage: import('../engine/types').WeaponDamageSpec | null;
  /** Qualités d'arme/armure (`QualityRef` : id + Indice éventuel « Solide 3 » → value, spec = arg éventuel). */
  qualities: QualityRef[];
  desc?: string;
  /** Effet d'un CONSOMMABLE (potion/drogue/bandage — LDB 71/72/67) en **Flow** (noyau `engine/flowCore`) :
   *  feuilles `do` d'ops (MÊME vocabulaire que sorts/passifs), branches `if` (Fleur de lune par race),
   *  nœuds `test` pour les Tests « au boire » (Brise-cœur/Belladone/Nécessaire antipoison), résolus
   *  cadence-aware par le runner state (`runConsumable`). Édité au Codex via `FlowEditor` (comme les
   *  effets d'un sort). Lu au catalogue par `consommableDe` (`engine/consumables.ts`). */
  consumable?: import('../engine/flowCore').Flow;
  /** Durée d'HORLOGE des effets durables du consommable (LDB 71/72 « Durée : … ») — résolue AU BOIRE
   *  (dés tirés une fois), les ops durables du Flow expirent à l'échéance (`purgeClockEffects`). */
  consumableDuration?: import('../engine/consumables').ConsumableDuration;
  /** Contenant (LDB 64) : capacité de rangement (« Contenu », en Enc). Sacs/sacoches/sac à dos. */
  container?: { capacity: number };
  /** NI d'énergie magique qu'UN GRAMME de cet objet apporte à un Test d'Incantation/Focalisation en
   *  malepierre (`VDM 02 l.165` : « 1 gramme de malepierre équivaut à 20 NI »). Éditable — jamais une
   *  constante de code. Absent = objet non consommable comme réserve de NI. */
  niPerGram?: number;
  /** Taux de consommation de la réserve de NI d'un objet `niPerGram` : NI décomptés par point de DR
   *  bonus accordé (`VDM 02 l.163-165` ne fixe AUCUNE formule de consommation, seulement l'équivalence
   *  `niPerGram`) — arbitrage documenté par l'entrée elle-même (champ `maison` du schéma), éditable —
   *  jamais une constante de code. Absent = 1 (défaut). */
  niConsumedPerDR?: number;
  /** Arbitrage NON-verbatim documentant un ou plusieurs champs (ex. `niConsumedPerDR`) — même patron
   *  que `CreatureData.maison`/`NavalTraitData.maison`/`CrewRoleData.wage.maison`. */
  maison?: string;
  /** Colonne « Prix »/« Coût ». Honnête, comme `enc` : un montant chiffré, la MARQUE `'ND'` que le
   *  livre imprime (LDB 62 l.28 Mains nues, l.31 Arme improvisée, LDB 68 l.11 Licence de Guilde), ou
   *  `null` quand le livre n'imprime AUCUNE valeur (Rocher, Filet, sel sacré, carte marine…). `'ND'`
   *  et `null` valent tous deux zéro sou au calcul (`priceToMoney`) ; seule la MARQUE se rend. */
  price: Money | 'ND' | null;
  source: SourceRef;
  /** Emplacement SECONDAIRE (#563) — même objet réimprimé/à cheval prose⇄ligne-de-stats ailleurs
   *  (ex. Cimeterre : prose AA 90, ligne de stats AA 91). Accessors `allLocations`/`sourceBooks`
   *  (`src/data/sourceRefs.ts`), aucun lecteur n'inline `alsoIn`. */
  alsoIn?: SecondaryRef[];
  /** Arme DÉRIVÉE conférée tant que l'objet est ÉQUIPÉ (prothèse-arme, LDB 73 : le Crochet « est
   *  considéré comme une Dague » en mêlée). Lue par recomputeLoadout : ajouter une prothèse-arme =
   *  remplir ce champ dans la donnée, jamais un name-match `i.name === 'Crochet'`. */
  derivedWeapon?: ArmeDerivee;
  /** Capacités IRRÉDUCTIBLES de l'objet (drapeaux NON exprimables en GameOp) — canal `capabilities`,
   *  MÊME logique que `TraitCapabilities`/`QualityCapabilities` : règles que le moteur INTERROGE par id
   *  (`engine/capabilities`), jamais par le nom FR de l'objet. Couvre les 5 marqueurs de catégorie :
   *  `weatherProtection` (Cape/Manteau), `isShelter` (Tente), `isRations` (Ration), `isGrimoire`
   *  (Grimoire), `preventForcedDrop` (Gantelet verrouillé). Édité au Compendium. */
  capabilities?: ItemCapabilities;
  /** Modificateurs PASSIFS continus de l'objet (OpPassive[], MÊME vocabulaire que traits/qualités/sorts) —
   *  appliqués tant que l'objet est PORTÉ ou TENU (collecteur `passiveMods`). Ex. Bésicles → `skillMod`
   *  +20 Langue/Perception (LDB 67). */
  passive?: import('../engine/ops').OpPassive[];
  /** Tarif d'un SERVICE (LDB 66 l.12-14), pas un objet possédable : marqueur de la sous-liste
   *  `INSTANCIABLE_PAR_ID` (`schemas/grammaire/sousListes.ts`), hors de `trappingsInstanciables` ;
   *  reste la source de PRIX de son consommateur (référencée par id) et visible au Codex/Compendium. */
  service?: boolean;
}
/** Profil d'arme d'une DONNÉE (`TrappingData.derivedWeapon`) : la `Weapon` du moteur, ses Groupes désignés
 *  par `ref('weaponGroup')`. Le moteur l'arme par `armeDeLaDonnee` (`engine/items.ts`). */
export type ArmeDerivee = Omit<Weapon, 'subType' | 'weaponGroup'> & { subType?: { id: string }; weaponGroup?: { id: string } };
/** Groupe d'objet (taxonomie `subType` id-ifiée) : Groupe d'ARME (Base, Escrime, Deux-mains, Armes
 *  d'hast…), famille de MUNITION (Arc, Arbalète, Poudre noire…), type d'ARMURE (Plate, Mailles, Cuir
 *  souple/bouilli) ou catégorie d'INVENTAIRE (Outils, Possessions diverses…). `id` = cible de
 *  `Trapping/Weapon/ItemInstance.subType` (réf, ≠ libellé). Union discriminée par `kind`, chaque cas sa
 *  CHARGE (`defs/weaponGroups.ts`). */
export type WeaponGroupData = EntreeDe<typeof weaponGroupsDef>;
/** Un Groupe d'ARME. */
export type GroupeDArme = Extract<WeaponGroupData, { kind: 'weapon' }>;
/** Maniement d'une arme dans un autre Groupe de Corps à corps que le sien, ouvert au porteur qui en possède
 *  la Spé. `qualites` y remplacent celles de même id de l'arme, `retire` y ôte les qualités nommées (de
 *  l'arme ou de son Groupe) ; `aPied` : seulement quand le porteur n'est pas monté ; `mains` : l'arme y est
 *  tenue à une main. */
export interface ManiementAlternatif {
  qualites?: QualityRef[];
  retire?: string[];
  aPied?: true;
  mains?: 1;
}
/** Un Groupe d'ARMURE. */
export type GroupeDArmure = Extract<WeaponGroupData, { kind: 'armour' }>;
/** Groupe d'APPARTENANCE (WFRP4, Traits psy ciblés — LDB 21) : identité CANONIQUE i18n-safe.
 *  `id` STABLE (jamais traduit) ; `label` = rendu FR localisable. Registre SSOT (`groups.json`),
 *  référencé par les cibles de Traits psy et les filtres `onlyGroups`/`exceptGroups`/zones. */
export type GroupData = EntreeDe<typeof groupsDef>;
/** Famille de PRÉSENTATION du stock marchand (`MerchantPanel`, ordre d'affichage = ordre du tableau).
 *  `match` = règle de classement d'une ligne de stock (priorité unit > shield > categorie > fallback
 *  au `match` vide) ; `columns` = ids de colonnes de stats à afficher (vocabulaire `colonnesDuMarchand`). */
export interface MerchantFamilyData {
  id: string;
  type: 'merchantFamilies';
  label: string;
  match: { categorie?: TrappingTypeId; shield?: boolean; unit?: boolean };
  columns: IdDeColonneDuMarchand[];
}
export const merchantFamilies = merchantFamiliesJson as MerchantFamilyData[];
/** Rareté de récolte/trophée = `Availability` (LDB 59) ÉTENDUE de `'unique'` (pièce de bestiaire singulière). */
export type HarvestRarity = z.infer<typeof harvestRaritySchema>;
export type HarvestDanger = z.infer<typeof harvestDangerSchema>;

export interface CreatureData {
  /** `id` STABLE (slug) — clé de résolution runtime/données (scènes, encounters). « Plus de label » :
   *  les références pointent l'id (robuste au renommage/multilangue) ; le `label` ne sert qu'à l'affichage. */
  id: string;
  label: string;
  title: string | null;
  /** `true` = individu NOMMÉ (vs rôle générique / espèce de bestiaire) ; absent/`false` = générique.
   *  SOURCE UNIQUE de la nommé-ité — ne PAS l'inférer de `title`. Éditable au Codex. */
  named?: boolean;
  folder: string | null;
  char: Partial<Record<CharKey | 'M' | 'B', number | null>>;
  /** Traits POSÉS (`TraitPose[]`) — source app-owned migrée du parsing de chaînes (de-POC), résolus au
   *  spawn (`traitsDuPorteur`). */
  traits: import('./schemas/grammaire/reference').TraitPose[];
  /** OPTIONNELS (LDB 76) — affichés au Codex, choisissables au spawn : Traits posés ordinaires OU
   *  NOTES composées (joker « tous les traits », variante « remplacer des Traits par un bonus », ZI). */
  optionals: import('../engine/statEntry').OptionalEntry[];
  /** Compétences STRUCTURÉES (`SkillRef` par id stable + valeur de Test imprimée) — fin du parsing
   *  de chaînes « Calme 58 ». Le bestiaire stocke des refs ; `skillRefLabel` reformate à l'affichage. */
  skills: SkillRef[];
  /** Talents STRUCTURÉS (`TalentRef` par id stable + niveau/spécialisation). `talentRefLabel` les rend
   *  à l'affichage ; au spawn, `talentsFromBook` en fait des `TalentInstance` (`talentId` + `spec`). */
  talents: TalentRef[];
  /** Possessions (`TrappingRef`). */
  trappings: TrappingRef[];
  /** Sorts connus — ids de `spells.json`. */
  spells: string[];
  desc?: string;
  source: SourceRef;
  /** Apparence par défaut UNIFIÉE (plan P2) — UN seul bloc éditable porté par l'enregistrement, couche
   *  de défaut sous une éventuelle surcharge de scène. Même format que `EntityAppearance` (éditeur de
   *  scène) → une SEULE structure d'apparence dans toute l'app. */
  /** #2993 : son espèce range son corps au plan de bestiaire (`planDeBestiaire`). */
  appearance: EntityAppearance & { species: string };
  /** Récolte « Précieuses Entrailles » (ZI) : rareté + dangerosité (→ coût par Enc des pièces,
   *  cf. engine/harvest) et usages supposés des organes. Porté par la créature (pas de table //). */
  harvest?: { rarity: HarvestRarity; danger: HarvestDanger; uses: string };
  /** Ids de `groups.json` de cette créature (Traits psy ciblés, LDB 21 — `groupsFor`) : sa CATÉGORIE
   *  (« demon », « bete »…) et, le cas échéant, le Groupe du dieu du Chaos qu'elle sert. Absent = aucun. */
  grantGroups?: string[];
  /** Entrée du bestiaire dont cette créature est une espèce ou une variante : `groupsFor` lui en ajoute
   *  les Groupes déclarés, de genre en genre. Absent = la créature est son propre genre. */
  genre?: { id: string };
  /** Cette entrée du bestiaire suit-elle les règles de PERSONNAGE (#143/#152 — Corruption LDB 19,
   *  composant d'incantation LDB 46, Tests de fin de combat Maladie/Corruption LDB 18/20) ? Rétro-flag
   *  du bestiaire HUMAIN (Cultiste, Brigand, Voleur… — ce sont des Personnages, pas des créatures
   *  génériques) ; propagé au spawn par `creatureToCombatant` (même prédicat unique `followsCharacterRules`,
   *  `engine/relations.ts`, que `CustomStatblock.followsCharacterRules` côté éditeur). Absent = créature. */
  followsCharacterRules?: boolean;
  /** EDO 01 l.504 ; LDB 19. */
  corruption?: number;
  /** Facette ACHAT (marché/possession de carrière) — LDB 70, EDOC 07. */
  purchase?: { price: Money; availability?: Availability };
  /** Arbitrage NON-verbatim documentant un ou plusieurs champs (ex. `char`/`purchase` approximés
   *  faute de statbloc imprimé) — même patron que `ActivityData.maison`, `TraumaData.maison`. */
  maison?: string;
}
/** Base PARTAGÉE d'un STATUT porté pilotant des effets en DONNÉES — soit un État (LDB 16, `EtatData`), soit
 *  un état psychologique (LDB 21, `PsychologyData`). Porte le vocabulaire commun : modificateurs PASSIFS
 *  (`passive: OpPassive[]`, MÊME éditeur `GameOpEditor` que traits/atouts) ET effets DÉCLENCHÉS
 *  (`effects: TriggeredEffect[]`). Folding UNIQUE : `passiveMods` (passifs) + `fireStatusEffects` (déclenchés)
 *  itèrent indifféremment États et états psy → zéro duplication de schéma ni de collecteur. */
export interface StatusData {
  /** id STABLE (slug du libellé) — cible des instances (`ConditionInstance.name` / `PsychAffliction.type`). */
  id: string;
  type: 'etats';
  label: string;
  desc: string;
  /** ADRESSE du passage quand la prose n'est pas recopiée (#1389). Elle vit À CÔTÉ de la `desc` dans
   *  la vue TS parce qu'un module CHARGÉ porte les deux : l'adresse authorée, et le texte que le
   *  plugin en matérialise (`adressee`, plus bas). Sur le DISQUE, l'une exclut l'autre (V1 du refine
   *  `grammaire/prose.ts`). */
  descRef?: DescRef;
  source: SourceRef;
  /** Modificateurs PASSIFS continus (pénalité de Test, `incomingAttackMod`, `sbBonus`…) en `OpPassive[]`, lus
   *  par `passiveMods` (kind `etat` : pool non-cumul, le pire seul, LDB 16 l.13). MÊME éditeur GameOpEditor. */
  passive?: import('../engine/ops').OpPassive[];
  /** Effets DÉCLENCHÉS (dégâts par round → `onRoundEnd` ; sortie de Frénésie → `onTurnStart`…) en
   *  `TriggeredEffect[]`, diffusés par `fireStatusEffects` — le même cœur `applyTriggeredEffects`. */
  effects?: TriggeredEffect[];
  /** Restriction d'Action / de Mouvement / de défense imposée par le STATUT (États : À Terre/Sonné/
   *  Inconscient/Surpris/Empêtré ; et Psychologie — « Etat comme Psy »), lue en DONNÉES par les prédicats
   *  moteur `canTakeAction`/`effectiveMovement`/`cannotDefend` via le collecteur `conditionGating` (jamais
   *  une branche par-nom). Sur `StatusData` → partagée par `EtatData` ET `PsychologyData`. */
  gating?: { action?: 'none'; movement?: 'none' | 'half' | 'crawl'; cannotDefend?: true };
}

export interface EtatData extends StatusData {
  /** Ids de `groups.json` accordés au porteur tant qu'il porte l'État (`groupesDe`). Absent = aucun Groupe. */
  grantGroups?: string[];
  /** Type de Dégâts (`DamageTypeData.id`) des `effects` de l'État, lu par `degatsDeLEtatIgnores`. LDB 85 l.174 ; VDM 10 l.153 */
  typeDeDegats?: { id: string };
  /** La marque de l'État sur son porteur (#3834) : sa teinte, son visuel et son son en boucle. */
  marqueCouleur: string;
  marqueVisuel?: VisuelDeLumiere;
  marqueSon?: { id: string };
  /** Les magnitudes du `passive` sont-elles multipliées par le nombre de pions (Exténué −10/pion, LDB 16
   *  l.90) ? Appliqué à l'émission par le collecteur `passiveMods`. Défaut (absent) : magnitude fixe. */
  perStack?: boolean;
  /** Le nombre de pions vu par les `effects` (le `{stacks:'self'}` des dégâts par-round) est RÉDUIT du
   *  niveau de cette capacité de combat chez la cible — ex. Hémorragique réduit par Endurci (`bleedIgnore`,
   *  LDB 10). Clé de `CombatFeature` ; lu génériquement par `fireConditionEffects` (jamais codé par-nom). */
  stacksReducedBy?: string;
  /** Récupération de l'État par une ACTION (LDB 16 : Empêtré « se libérer » l.66 = Test OPPOSÉ de Force
   *  contre la source de l'empêtrement ; En flammes « se rouler » l.84 = Test d'Athlétisme simple). Lue par
   *  l'action `recover` (IA inline ET flux joueur — SOURCE UNIQUE `resolveRecoverTest`) au lieu des branches
   *  par-nom. `opposedBy:'source'` → opposé contre la Force d'entrave : `escapeStrength` FIGÉE en priorité
   *  (vaut même source absente), sinon Force de la source VIVANTE. Retire 1 + DR pions sur succès. */
  recover?: { skill?: RefDesignee; characteristic?: import('../engine/types').CharKey; opposedBy?: 'source'; difficulty?: import('../engine/types').Difficulty; opposedDifficulty?: import('../engine/types').Difficulty; enjeu: string; form: StakeForm };
  /** VERROU DE TYPE : tant que cette Condition est fausse, AUCUNE instance de cet État ne se retire
   *  (À Terre — `LDB 18 l.15`). Même champ, même algèbre et même porte de parse que le verrou d'INSTANCE
   *  (`ConditionInstance.lockedUntil`) ; lu par `isConditionLocked`. */
  lockedUntil?: import('../engine/flowCore').Condition;
  /** Ce que le joueur lit quand `lockedUntil` tient (fragment français, éditable). */
  lockedReason?: string;
  /** Blessures RENDUES quand une dépense de Détermination retire cet État — `LDB 17 l.61`. Le soin
   *  précède le retrait : c'est lui qui lève le verrou d'À Terre. */
  resolveHeals?: number;
  /** Cet État VERROUILLE l'Action : le Mouvement + l'Action doivent servir à fuir/se cacher (Brisé, LDB 16
   *  l.52). Drapeau DÉCLARATIF lu en DONNÉES par `isActionLocked`/`restrictingConditions` (engine/conditions),
   *  partagé par le gate de hotbar (`armerLeMode`) ET l'IA (dépense PROACTIVE de Détermination pour se
   *  ressaisir) — plus de nom d'État en dur. */
  restrictsAction?: boolean;
  /** Cet État ne porte JAMAIS plus d'un pion, quelle que soit la cause — LDB 16 l.115 (Inconscient :
   *  « soit vous êtes *Inconscient*, soit vous ne l'êtes pas »), l.37 (À Terre), l.137 (Surpris).
   *  Drapeau DÉCLARATIF lu par `addCondition`/`syncDerivedConditions` (engine/conditions) — la pose,
   *  dérivée ou native, y est bornée à 1 par CONSTRUCTION. */
  nonCumulable?: boolean;
  /** Cet État SUIT le porteur hors du combat (LDB 16 : Brisé l.57, Empoisonné l.70, En flammes l.77,
   *  Exténué l.91, Hémorragique l.107, Inconscient l.116 ; Munition logée LDB 62 l.250) — par opposition
   *  au transitoire, retiré au teardown. Drapeau DÉCLARATIF lu par `isPersistentCondition`
   *  (engine/persistence), seul juge du report vers le groupe et du carry-in au combat suivant. */
  persistsAfterCombat?: boolean;
  /** AFFICHAGE (couche UI, hors RAW LDB 16) : icône du registre `<Icon>` (id `famille/nom`) + sévérité
   *  0-100 (≥50 = incapacitant → créneau unique de l'ordre de bataille). Lus par `effectIcons.conditionMeta`. */
  icon?: IconId;
  severity?: number;
  /** Dangerosité IA de l'État infligé, en « Blessures espérées » (contrôle > simple malus) — lue par
   *  `aiSpellValue.opValue` (`op:'condition'`). Absente → menace mineure (1). */
  aiThreat?: number;
  /** Arbitrage NON-verbatim documentant l'entrée (même patron que `TraitData.maison`/`NavalTraitData.maison`/
   *  `CreatureData.maison`) — porte la CITATION du passage et la couture qui manque. Jamais lu par le moteur. */
  maison?: string;
}

/** État PSYCHOLOGIQUE en DONNÉES (LDB 21) — `id` = `PsychType` (`frenesie`, à terme `peur`/`terreur`/…).
 *  Étend `StatusData` (passive/effects mutualisés) ; n'ajoute que la capacité propre à la psychologie. */
export interface PsychologyData extends StatusData {
  /** ENJEU du Test de cette affliction (#1117 L2) — porté par l'ENTRÉE (patron `ActivityDef.stake`) :
   *  ses conséquences lui sont propres (`resolution`/`failCondition`/`failAmount`/`becomes`), un texte
   *  au `kind` serait tautologique. Résolu par `resolveStake` via l'`entryId` de l'étape. */
  stake?: string;
  stakeForm?: StakeForm;
  /** AFFICHAGE (couche UI, hors RAW LDB 21) : icône du registre `<Icon>` (id `famille/nom`), à l'égal
   *  d'`EtatData.icon`. Lu par `cibleLabel` (engine/psychology.ts). */
  icon?: IconId;
  /** Porter cet état psy IMMUNISE à la Psychologie (Frénésie, LDB 21 l.33) — lu GÉNÉRIQUEMENT par
   *  `isPsychImmune` (jamais codé par-nom), à l'égal du drapeau de trait « Immunité (Psychologie) ». */
  psychImmune?: boolean;
  /** Variantes de Cible admises (Groupe, individu) d'un Trait psychologique CIBLÉ (LDB 21) ; leur présence
   *  fait le type ciblé (`estCibleType`), lues par `varianteAdmise` (`engine/psych/ciblage.ts`). #3045 */
  cibles?: VarianteDeCible[];
  /** RAW LDB 21 : cette affliction CIBLÉE cesse dès que son porteur tombe sous un AUTRE effet psychologique
   *  « dominant » (Peur/Terreur/Haine…) — « Animosité est annulé par Peur et Terreur » ; Préjugé idem. */
  endedByOtherPsych?: boolean;
  /** RAW LDB 21 l.41 : tant que cette affliction CIBLÉE est active, son porteur est IMMUNISÉ aux CANAUX
   *  listés causés par un membre de sa Cible (Haine → `['peur']` ; l'Intimidation du RAW attend sa mécanique, #1234).
   *  Lu par `psychImmuneToFrom` (siège unique : `fearSourceFor` + `psychDRAdjust`). */
  immuneToFromTarget?: string[];
  /** Contribution de cet état psy au DEGRÉ DE RÉUSSITE de l'ATTAQUE de son porteur (LDB 21, ±1 DR) — lu
   *  par `psychDRAdjust` (plus de ±1 codé par-nom). `vs:'source'` = Peur vs sa source (`sousPeur`,
   *  l.29) ; `vs:'group'` = Haine/Animosité vs le groupe ciblé actif (l.22/41), qui oriente aussi le
   *  vivier de l'IA (`noyau/monde/ai.ts`) ; `vs:'any'` = Amour/
   *  Camaraderie en défense, dès lors qu'actif (l.77/82). */
  attackDR?: { amount: number; vs: 'source' | 'group' | 'any' };
  /** RAW LDB 21 l.75 : tant que cette affliction est active, son porteur est IMMUNISÉ aux CANAUX listés,
   *  mais SEULEMENT tant que l'affliction est ACTIVE, ce que `refreshDefendedPsych` conditionne à la présence
   *  d'un membre de sa Cible en état d'être défendu (Amour → `['peur']`). Même siège `psychImmuneToFrom`. */
  immuneWhileActive?: string[];
  /** RAW LDB 21 l.19/l.48 : modificateur aux Tests de Sociabilité envers la Cible que subit le porteur du
   *  Trait tant qu'il n'est PAS en affliction active (issue du Test de Psychologie RÉUSSI — Animosité −20,
   *  Préjugé −10). Lu par `socialPsychMod`/`socialPsychLabel` (plus de −20/−10 ni de type codé par-nom). */
  containedSocialMod?: number;
  /** RAW LDB 21 l.87 : l'OBJET de ce Trait CIBLÉ est traité comme CAUSANT l'état psy `kind` d'Indice
   *  `indice` (Phobie → Peur 1) — l'entrée n'a donc pas de Test propre : tout le régime de `kind` s'applique.
   *  `indice` est le DÉFAUT, surchargé par l'Indice de l'instance possédée (« Vous pouvez vouloir augmenter
   *  l'Indice de Peur si la Phobie est particulièrement forte » — éditable au Codex). Lu par `fearSourceFor`. */
  targetCauses?: { kind: string; indice: number };
  /** SITUATION qui EXPOSE au Trait CIBLÉ (LDB 21 l.9), lue par `targetedTrigger` — jamais un camp.
   *  `'encounter'` (défaut) : « chaque fois que vous rencontrez l'un de ces groupes » (Animosité l.19,
   *  Préjugé l.45 ; Haine l.39 « Lorsque vous rencontrez ceux qui vous provoquent la Haine »).
   *  `'threatened'` : « Vous devez venir en aide à quelqu'un que vous aimez s'il se retrouve menacé »
   *  (Amour l.75 ; Camaraderie l.81 « si ce groupe est menacé ») — un tiers doit être agressif envers
   *  le membre de la Cible (`agressifEnvers`). */
  triggerOn?: 'encounter' | 'threatened';
  /** Moment du re-test d'une affliction ciblée active ; absent = début du Round. LDB 21 l.9, l.19, l.39, l.48 */
  retestAt?: 'roundStart' | 'roundEnd';
  /** Mode de RÉSOLUTION du Test de Psychologie (LDB 21), lu par l'applier GÉNÉRIQUE `psychologieDeCombat` (jamais
   *  un dispatch `kind === 'terreur'` codé) : `'etendu'` = Test ÉTENDU de Calme cumulant le DR vers l'Indice
   *  (Peur, l.27) ; `'terreur'` = Test SIMPLE dont l'échec inflige `failCondition` (Indice + |DR négatifs|)
   *  puis pose l'état `becomes` (Terreur → Peur, l.55-57) ; `'simple'` = Test SIMPLE (LDB 12 l.3-7) activant l'affliction
   *  CIBLÉE (traits ciblés). Absent (Frénésie/trauma) = pas de Test de résolution surmontable. */
  resolution?: 'etendu' | 'terreur' | 'simple';
  /** (résolution `'terreur'`) État infligé à l'ÉCHEC (`EtatData.id`) ; la QUANTITÉ est déclarée par
   *  `failAmount` (défaut = Indice + |DR négatifs|, LDB 21 l.54). */
  failCondition?: { id: string };
  /** (résolution `'terreur'`) QUANTITÉ d'état infligée à l'échec, EN DONNÉES (`failConditionAmount`) :
   *  `base` (l'Indice de l'affliction via `'indice'`, ou un nombre FIXE) + `perDegreeOfFailure` par DR
   *  négatif. Défauts `{ base:'indice', perDegreeOfFailure:1 }` = la règle Brisé Terreur — plus de calcul
   *  codé : un nouvel État/Psy déclare ICI sa quantité (fixe, ou par degrés seuls). */
  failAmount?: { base?: 'indice' | number; perDegreeOfFailure?: number };
  /** (résolution `'terreur'`) État psychologique SUBSÉQUENT au Test (la Terreur devient une Peur, l.55). */
  becomes?: { id: string };
  /** Paramètres du Test de Psychologie (LDB 21) : `skill` (compétence stable, défaut `calme` — la valeur
   *  NUE est lue par `skillBaseValue`) + `difficulty` (défaut Intermédiaire +0). Lu par `psychStepFor`/
   *  l'encounter, plus de Calme/Intermédiaire codé : un nouvel État/Psy déclare ICI son Test (ex. testé en
   *  Résistance, ou à une difficulté propre). « Sans Peur (Ennemi) » force Accessible à part (par-combattant). */
  test?: { skill?: RefDesignee; difficulty?: import('../engine/types').Difficulty };
}
/** Rangée des Tableaux de couleur des yeux / des cheveux (LDB 05 l.742-768), par colonne `RaceKey` (#313). */
export type DetailColorData = RangeeDe<typeof couleurDesYeux>;
/** MANŒUVRE de combat (attaque naturelle activée — LDB 85) — ENTITÉ ÉDITABLE de PREMIÈRE CLASSE (au
 *  même titre qu'un Sort) : son propre dataset `maneuvers.json`, sa catégorie Codex, ses effets
 *  AUTHORÉS en GameOp (`effects`). Un trait l'OCTROIE (`TraitData.grantsManeuvers`) ; le résolveur
 *  générique (`noyau/combatManeuvers.resolveManeuver`) la joue ENTIÈREMENT depuis cette donnée — jamais
 *  une table en dur ni un applier par type. `kind` ne sert QU'À l'anim/pose/icône (jamais à résoudre).
 *  La géométrie/portée/opposition restent moteur (règle 3) ; Dégâts (`wounds`) + États = data. */
/** Mesure de géométrie de manœuvre en MÈTRES (Portée/Souffle) : `bonus(ref)` de la carac `bonusOf` (référent
 *  = Attaquant pour la Portée, Cible au centre pour le Souffle, RAW l.251) + constante `plus`. Résolue par
 *  `measureMeters` (`combatManeuvers`) — remplace la formule-chaîne FR re-parsée par regex au runtime. */
export interface ManeuverMeasure {
  bonusOf?: CharKey;
  plus?: number;
}
export interface ManeuverDef {
  id: string;
  type: 'maneuvers';
  label: string;
  /** Anim/pose/icône SEULEMENT (pas la résolution) — type d'attaque naturelle (geste distinct). */
  kind: import('../engine/creatureAttacks').AttackKind;
  /** Déclenchement RAW : Action normale, gratuite (coût d'Avantage), ou gratuite à la Charge. */
  activation: 'action' | 'free' | 'charge';
  coutEnAvantage: number;
  /** Gestion de l'Avantage dépensé : `fixe` = `coutEnAvantage` (défaut) ; `variable` = le joueur
   *  CHOISIT (Regard : +1 DR par Avantage, LDB 85 l.290) ; `tout` = dépense tout (Hurlement, l.170). */
  modeDAvantage?: 'fixe' | 'variable' | 'tout';
  /** Caractéristique du jet de l'attaquant (capacite-de-combat mêlée / capacite-de-tir distance·zone) ;
   *  absent = AUCUN jet d'attaquant (Hurlement : chaque cible teste sa Résistance). */
  stat?: 'capacite-de-combat' | 'capacite-de-tir';
  /** Défense opposée : Esquive / Parade, Initiative (Regard), Résistance/auto sans opposition. */
  defense?: 'esquive' | 'parade' | 'init' | 'resist' | 'auto';
  /** Mode de ciblage (le résolveur en dérive la géométrie moteur). `soi` = capacité SUR SOI (pas de
   *  cible adverse ni d'opposition — transformation, mue, auto-buff) : les `effects` s'appliquent au
   *  porteur. `adversairesAutour` / `toutAutour` = même géométrie (rayon autour de l'attaquant), populations
   *  DIFFÉRENTES : le camp adverse quand le texte le désigne (Middenheim 04 l.11 « contre ses ennemis »),
   *  TOUT le monde quand il ne le désigne pas (LDB 85 l.170 « Toutes les créatures vivantes »). */
  ciblage: 'melee' | 'distance' | 'zone' | 'adversairesAutour' | 'toutAutour' | 'soi';
  /** Portée / Souffle STRUCTURÉS (`ManeuverMeasure`) — mètres = `bonus(ref) + plus`. `range` résolu contre
   *  l'Attaquant, `blast` contre la cible au centre (RAW l.251). Remplace la formule-chaîne re-parsée au runtime. */
  range?: ManeuverMeasure;
  blast?: ManeuverMeasure;
  /** Attaque magique (Souffle, Étreinte glaciale) → soumise à la Résistance à la Magie, etc. */
  magic?: boolean;
  /** La zone se remplit de fumée (`souffleDuType`). LDB 85 l.329 */
  fumee?: boolean;
  /** Écart de Taille minimal sur la cible au contact : la manœuvre est ouverte à TOUT combattant, sans
   *  trait (`attaquesNaturelles`). LDB 85 l.387 ; LDB 85 l.344 */
  ecartDeTailleMin?: number;
  /** Groupe d'armes (id de `weaponGroups`) de l'arme synthétisée par `freeAttackWeapon`. */
  subType?: RefDesignee;
  /** Dégâts de l'arme synthétisée ; absent = l'Indice du trait qui octroie la manœuvre. */
  damage?: import('../engine/types').WeaponDamageSpec;
  /** Effets AUTHORÉS (Dégâts `wounds` + États) appliqués quand la manœuvre touche (`onHit`) — MÊME
   *  vocabulaire que les sorts (Flow d'ops), exécutés par `applyTriggeredEffects`. */
  effects?: TriggeredEffect[];
  /** Folio du Trait PROJETANT — la manœuvre ne porte AUCUNE prose (#1226) : sa description est celle du
   *  trait, résolue à l'affichage par `traitProjectingManeuver`. */
  source?: SourceRef;
  /** ENJEU porté par l'ENTRÉE (#1117 L2, patron `ActivityDef.stake`/`PsychologyData.stake`) : les
   *  `effects` d'une manœuvre sont AUTHORÉS entrée par entrée (aucune formule commune), donc un
   *  gabarit au `kind` serait tautologique. Rendu par `resolveStake` (dataset `combat`, kind
   *  `combat-manoeuvre-defense`, `entryId` = l'id de la manœuvre) : il PRIME sur le gabarit du kind. */
  stake?: string;
  /** FORME déclarée de l'enjeu — `verbatim` (contigu au Source) ou `descripteur` (assemblage des ops). */
  stakeForm?: StakeForm;
  /** Valeurs des trous de `stake`, posées par la composition (`souffleDuType`) ; aucune entrée n'en porte. */
  enjeu?: Record<string, string>;
  /** Rendu visuel et sonore d'une manœuvre de zone (`rendus.json`) ; celui d'un Souffle composé est celui de son Type
   *  (`souffleDuType`). */
  rendu?: { id: string };
}
/** Drapeaux de CAPACITÉ IRRÉDUCTIBLES d'un trait (LDB 85) — décisions d'IA/psychologie, règles de
 *  résolution de combat, capacités de construction/déplacement/vision : NI un modificateur (`passive`)
 *  NI un effet déclenché (`effects`), mais une règle que le moteur INTERROGE. Édité au Codex. Le
 *  seuil/type éventuel (Démoniaque 8+, Immunité (Poison)) vient de l'INDICE/arg de l'INSTANCE, pas d'ici. */
export type TraitCapabilities = z.infer<typeof traitCapabilitiesSchema>;
/** Trait de créature (LDB 85) : libellé canonique + desc VERBATIM (affichée à l'inspecteur). */
export interface TraitData {
  /** Identifiant STABLE (slug du libellé) — clé d'instance/lookup, indépendant de la langue. */
  id: string;
  type: 'traits';
  label: string;
  /** Sens de la valeur NUMÉRIQUE `value` de l'instance (Difficulté, Indice, Degré…) — `label` affiché
   *  devant/autour du nombre. Absent = le trait ne porte pas de valeur numérique. */
  indice?: { label: string };
  /** L'Indice est un nombre de PA, qu'une instance peut poser Localisation par Localisation
   *  (`TraitPose.parLocalisation`), sa matière avec (`TraitPose.matiere`) — lus par `armureDuTrait`, la saisie
   *  et les migrations. LDB 85 l.37-39. */
  parLocalisation?: boolean;
  /** L'instance porte-t-elle un champ `range` (portée en mètres/cases : Souffle, Aura…) ? Absent/`false` = non. */
  range?: boolean;
  /** Trait d'ATTAQUE : son Indice est celui des Dégâts (« +N ») et une instance peut conférer des Traits à
   *  ses touches (`TraitPose.confere`). LDB 85 l.31-33 ; ZI 03 l.75, l.77 */
  attaque?: boolean;
  /** L'Indice de Dégâts du Trait inclut déjà le Bonus de Force (`WeaponDamageSpec.bfInclus`). LDB 85 l.35,
   *  l.47, l.83, l.237, l.405 */
  bfInclus?: true;
  /** Une instance peut fixer la Difficulté des Tests qui éliminent l'État que le Trait inflige
   *  (`TraitPose.difficulte`). LDB 16 l.70 ; MDG 16 l.226 */
  difficulte?: boolean;
  /** Registre de l'ARGUMENT `arg` du trait (catalogue `SPEC_SOURCES` : `ciblesPsy`/`diseases`/`sizes`/
   *  `mutations`/`breathTypes`/`weaponGroups*`…). Le pool DÉRIVE alors du registre, jamais d'une liste en dur. */
  specsSource?: SpecsSource;
  /** L'`arg` de ce Trait nomme une entrée de son registre (`SPEC_SOURCES[specsSource].entree`) dont les
   *  `grantGroups` sont accordés au porteur (`groupesDe`). Absent = l'`arg` n'ouvre aucun Groupe. */
  grantSpecGroups?: true;
  /** L'`arg` accepte un TEXTE LIBRE (argument authentiquement descriptif, hors registre). Absent/`false`
   *  = FERMÉ (l'`arg` DOIT être un id du pool `specsSource`). */
  specsOpen?: boolean;
  /** Trait EXCLU d'un octroi EN MASSE des Traits d'une créature — `LDB 48 l.23` : « Gagnez tous les
   *  Traits standards de la créature sauf Bestial. » Lu par `polymorphOps` (`engine/polymorph`). */
  nonTransferable?: boolean;
  desc: string;
  source: SourceRef;
  /** Emplacement SECONDAIRE (#563) — même Trait réimprimé/à cheval ailleurs (ex. Fouissement : ZI 23
   *  ET 134). Accessors `allLocations`/`sourceBooks` (`src/data/sourceRefs.ts`). */
  alsoIn?: SecondaryRef[];
  /** Effets MÉCANIQUES authorés (déclencheur → ops du Flow) — Traits « effet sur événement » (Toile,
   *  Sang corrosif, Régénération…) appliqués par `noyau/triggeredEffects`, jamais par un handler en dur.
   *  Type-only (le moteur reste pur : la donnée référence le Flow sans en dépendre à l'exécution). */
  effects?: TriggeredEffect[];
  /** Manœuvres OCTROYÉES par ce trait (Morsure, Attaque caudale, Souffle…) — `RefDesignee[]` vers le dataset
   *  `maneuvers`. Un trait d'attaque naturelle octroie sa/ses manœuvre(s) ; `engine/creatureAttacks`
   *  les résout par id (`findManeuverById`). Le trait Souffle en octroie plusieurs (un par Type). */
  grantsManeuvers?: RefDesignee[];
  /** Modificateurs de PROFIL PASSIFS (Élite +20 CC/CT/FM, Brutal −1 M…) en `OpPassive[]` — le MÊME vocabulaire
   *  d'ops que les sorts et `Trauma.ops`, CONTINUS (sans wrapper Flow/déclencheur, ≠ `effects`) : édités par
   *  `GameOpEditor` (le composant de liste d'ops existant), lus par le collecteur passif (`traitPassiveMods`
   *  → liveTraits) qui leur AFFECTE le `kind` `intrinseque` (comme la séquelle dérive le sien). */
  passive?: import('../engine/ops').OpPassive[];
  /** Drapeaux de CAPACITÉ irréductibles (décisions IA/psy, résolution, build/déplacement/vision) —
   *  lus PAR ID par `engine/traits/dispatch`. Édité au Codex. */
  capabilities?: TraitCapabilities;
  /** Capacités d'AUTRES traits du même porteur ANNULÉES par ce trait (« entraîné à IGNORER son Trait
   *  X » — LDB 85 : Dressé (Dompté) ignore Bestial). Mécanisme GÉNÉRIQUE de suppression, lu par
   *  `traitCapability` : une capacité supprimée par n'importe quel trait porté répond false. */
  suppressesCapabilities?: (keyof TraitCapabilities)[];
  /** AURA de combat : projette des `passive` OpPassive[] sur les combattants À PORTÉE (Perturbant : −20 aux
   *  Tests à `rangeChar` mètres, LDB 85 l.262 ; `affects` = quel camp est touché ; l'émetteur ne se touche
   *  jamais).
   *  Recalculée chaque Round par le hook GÉNÉRIQUE `recompute-auras`, accumulée dans `Combatant.auraMods`
   *  (emballée en `PassiveMod`, le trait émetteur en `src`), lue par `combatTestPenaltyParts` — pool
   *  NON-CUMUL, « une seule fois, peu importe le nombre d'ennemis Perturbants » — et par
   *  `skillDRBonus`/`charDRBonusOf`. Aucun code par-nom. */
  aura?: {
    rangeChar: CharKey;
    affects?: 'ennemis' | 'allies' | 'tous';
    passive: import('../engine/ops').OpPassive[];
  };
  /** Trait STANDARD (LDB 76 l.28-31 : « ajoutés à la liste Facultative de TOUTES les créatures ») —
   *  proposé par le picker de Traits facultatifs sur n'importe quel bestiaire. Édité au Codex. */
  standard?: boolean;
  /** Arbitrage NON-verbatim documentant l'entrée (même patron que `NavalTraitData.maison`/`CreatureData.maison`) —
   *  porte la CITATION du passage et la couture qui manque quand le Trait n'a PAS de `passive`/`effects`/`aura`
   *  alors que sa prose donne une mécanique (#1011). Jamais lu par le moteur. */
  maison?: string;
}
/** Drapeaux/marqueurs de CAPACITÉ IRRÉDUCTIBLES d'une qualité d'arme/armure/objet (LDB 62-63) — règles
 *  que le moteur INTERROGE (résolution de combat, économie d'artisanat) : NI un modificateur (`passive`)
 *  NI un effet déclenché (`effects`). Lus PAR ID par `engine/qualities/dispatch`.
 *  Les INDICES (Salve N, Protectrice N, Arme d'équipe N…) sont portés par l'instance (`QualityInstance.value`)
 *  — la capability n'est qu'un marqueur de PRÉSENCE, jamais le porteur de l'Indice. Édité au Codex. */
export interface QualityCapabilities {
  // Résolution de combat (mêlée)
  fastStrike?: boolean;   // Rapide : pré-emption d'initiative + −10 parade adverse non-Rapide
  slowStrike?: boolean;   // Lente : frappe en dernier
  fumbleOn9?: boolean;    // Dangereuse : Maladresse sur tout Test raté incluant un 9
  fumbleDigits?: number[]; // Seuil de Maladresse paramétrable (chiffre en dizaines OU unités) — AA 08 l.544
  pushback?: boolean;     // Perturbante : repousse au lieu de blesser
  piegeALame?: boolean;    // Piège-lame : piéger/briser une lame sur un Critique défensif
  damagesArmour?: boolean;// Taille : endommage l'armure/le bouclier frappé
  // (Taillade « État sur Critique » n'est PLUS une capability : `effects:[{trigger:'onCrit'}]` data-driven.)
  // Armes à feu / chargeurs
  firearm?: boolean;            // Poudre noire / Explosion : Incident de Tir + terreur (Nerveux)
  canFireWhileEngaged?: boolean;// Pistolet : tir au contact
  magazine?: boolean;           // À Répétition : chargeur (Indice)
  salvo?: number;               // Salve : chargeur (Indice), pénalité de chaque tir suivant du Round
  areaFire?: boolean;           // Tir de zone : nuage de projectiles (Indice)
  explosion?: boolean;          // À Explosion : tous à Indice m du point cible subissent DR+Dégâts + États de l'arme (LDB 62 l.254)
  crewedTeam?: number;          // Arme d'équipe : sous-effectif (Indice), pénalité par Défaut redoublé
  parryAP?: boolean;            // Protectrice : Indice PA en opposant (Indice)
  // Objet / artisanat (LDB 60)
  encDelta?: number;            // Léger −1 / Volumineux +1 Encombrement
  // Armure (LDB 63)
  layerable?: boolean;          // Flexible : superposition sous une couche non Flexible
  apIgnoredOnEven?: boolean;    // Partielle : PA ignorés sur jet pair ou Critique
  apIgnoredOnImpaleCrit?: boolean; // Points faibles : PA ignorés sur Critique Empaleuse
  // Siège (ADE II 8)
  siege?: boolean;              // Atout Siège : double les Dégâts aux structures, outrepasse Résistant/Impénétrable
  ram?: boolean;                // Bélier : la pièce n'endommage QUE les portes (ADE II 8 l.249) — lu par engine/structures
  // Marqueurs
  unbreakable?: boolean;        // Incassable : insensible aux dégâts/destruction
  magic?: boolean;              // Magique : attaques magiques (blesse l'Éthéré)
  withheldOnRestraint?: boolean; // Retirée quand on Retient ses coups (AA 07 l.61 — Empaleuse/Percutante/Perforante)
  /** Préséance : cette qualité l'emporte sur les `beats` (ids) si toutes deux présentes (Imprécise > Précise, Lente > Rapide). */
  beats?: string[];
}
/** Atout/Défaut d'arme (LDB 62-63) : libellé + desc VERBATIM + effets déclenchés authorés (mêmes
 *  `TriggeredEffect` que les Traits — un Atout « à la touche : 1d10 + Empêtré » s'édite au Codex). */
export interface QualityData {
  /** id STABLE (slug du libellé) — cible des `RefDesignee` de qualité, robuste au renommage. */
  id: string;
  type: 'qualities';
  label: string;
  /** POLARITÉ : Atout (bénéfique) / Défaut (handicap) — `id` de `qualityTypes.json`. Trois PAIRES de
   *  rubriques : objet `LDB 60 l.9`/`l.40`, arme `LDB 62 l.217`/`l.309`, armure `LDB 63 l.68`/`l.80`. */
  polarite: 'atout' | 'defaut';
  subType: EntreeDe<typeof qualitiesDef>['subType'];
  desc: string;
  source?: SourceRef;
  /** Emplacement SECONDAIRE (#563) — même Qualité réimprimée/à cheval ailleurs (ex. Tir de zone :
   *  AA 89 + MDG 102). Accessors `allLocations`/`sourceBooks` (`src/data/sourceRefs.ts`). */
  alsoIn?: SecondaryRef[];
  effects?: TriggeredEffect[];
  /** Modificateurs PASSIFS continus (objet Laid : −10 aux Tests de Soc ; PASSIFS d'arme : weaponRollMod/
   *  weaponDamageMod/armourPierce/critOnRoll) en `OpPassive[]` — MÊME vocab/éditeur (`GameOpEditor`) que les
   *  traits et les sorts ; lus par `engine/qualities/dispatch` (par id) et le collecteur passif. */
  passive?: import('../engine/ops').OpPassive[];
  /** Drapeaux/marqueurs de CAPACITÉ irréductibles (résolution combat, artisanat) — lus PAR ID par
   *  `engine/qualities/dispatch`. Édité au Codex. */
  capabilities?: QualityCapabilities;
  /** Cette qualité est INDICÉE (LDB 60 l.28) — forme de `TraitData.indice`, plus l'UNITÉ imprimée avec
   *  la valeur quand le livre en pose une (`AA 08 l.87` « Taillade (XA) » ; `LDB 62 l.66` « Recharge 1 »
   *  n'en a pas). Lue par `qualityRefLabel`. */
  indice?: { label: string; unite?: string };
  /** Qualité d'ASPECT (LDB 60 l.24 ; LDB 60 l.52) : une apparence d'objet peut naître d'elle (`defs/apparences.ts`). */
  aspect?: true;
}
/** Capacités IRRÉDUCTIBLES d'un symptôme de maladie — drapeaux lus par la machinerie de cycle
 *  (`engine/disease`), pour les comportements non exprimables en GameOp continu. */
export interface SymptomCapabilities {
  blocksHealing?: boolean;   // « Blessé »/Gangrène : bloque la guérison d'1 PB par symptôme (LDB 20 l.145)
  amputation?: boolean;      // Gangrène : Test quotidien, échecs > BE → Localisation perdue (l.176)
  contagious?: boolean;      // Toux & éternuements : expose l'entourage (l.206)
  nausea?: boolean;          // Nausée : Sonné sur Test de déplacement raté en combat (l.194)
  endTest?: boolean;         // Persistant : Test de fin de Durée (difficulté portée par l'instance, l.200)
  persistentActive?: boolean; // Vers de carie : la phase active NE guérit JAMAIS naturellement (dégénérescence quotidienne jusqu'à la Mort, MSRC 16 l.90-101)
}
/** Symptôme de maladie (LDB 20) — entité de DONNÉE éditable au Codex, mécaniques en GameOp / 3 canaux
 *  (comme un trait/qualité). `passive` = pénalités continues (charMod) ; `passiveBySeverity` = ops de
 *  chaque palier ATTEINT par l'instance, l'op de même cible REMPLACÉE (`symptomPassive`,
 *  LDB 20 l.157/l.170) ; `onTick` = Test de cycle quotidien +
 *  conséquence GameOp appliquée par la cascade (différée/influençable) ; `capabilities` = règles
 *  irréductibles lues par la machinerie de maladie. */
export interface SymptomData {
  id: string;
  type: 'symptoms';
  label: string;
  desc: string;
  source?: SourceRef;
  passive?: import('../engine/ops').OpPassive[];
  passiveBySeverity?: { moderee?: import('../engine/ops').OpPassive[]; grave?: import('../engine/ops').OpPassive[] };
  /** Effets DÉCLENCHÉS du symptôme (MÊME `TriggeredEffect` que Traits/Atouts/États) — dispatchés par
   *  `fireTriggers` quand le porteur est actif (Crampes abdominales : `onOwnTestFailed` → Sonné/FM/
   *  Inconscient par paliers de `slThreshold`, MSRC 16 l.152-158). Source du dispatcher via
   *  `effectSourcesOf` (les symptômes ACTIFS deviennent une source, comme les États). */
  effects?: TriggeredEffect[];
  /** Cycle de PHASE ACTIVE. `test` = le nœud `test` du Flow (`engine/flowCore.ts`) : le jet ET sa
   *  conséquence (branche `fail`). `ops` = la conséquence CERTAINE d'un cycle sans jet (éclatement du
   *  Vers du Reik, d'issue invariante — MSRC 16 l.142) : l'un OU l'autre, jamais les deux.
   *  `difficultyBySeverity` INDEXE la Difficulté du nœud sur la sévérité de l'instance (Toxine,
   *  LDB 20 l.215 : Modéré→Facile, Grave→Accessible) — clé absente pour la sévérité portée = Difficulté
   *  du nœud inchangée. Lu par `symptomOnTick`. `afterDays`/`once` cadencent le cycle sur la phase
   *  ACTIVE (Vers de carie : Test quotidien À PARTIR de J+7, MSRC 16 l.90 ; Vers du Reik : 7ᵉ jour). */
  onTick?: {
    test?: import('../engine/flowCore').NoeudDecideAuPorteur;
    ops?: import('../engine/ops').GameOp[];
    difficultyBySeverity?: Partial<Record<'moderee' | 'grave', import('../engine/types').Difficulty>>;
    /** Ne se déclenche qu'à partir du Nᵉ jour de PHASE ACTIVE (1 = premier jour actif). Absent = dès le 1ᵉʳ. */
    afterDays?: number;
    /** UNE seule fois, au jour `afterDays` exact (Vers du Reik) ; absent/false = quotidien (Vers de carie). */
    once?: boolean;
  };
  /** Passifs conditionnés à la VISIBILITÉ de la lésion (Vers du Reik : « si l'ampoule se trouve à un endroit
   *  visible… −10 Sociabilité », MSRC 16 l.140) — appliqués SEULEMENT si la localisation tirée à l'entrée en
   *  phase active (`Disease.blisterLocation`) ∈ `visibleLocations`. Jet de Localisation canonique (`hitLocation`). */
  visiblePassive?: import('../engine/ops').OpPassive[];
  /** Localisations comptées comme VISIBLES (arbitrage `maison` : tête/bras visibles, corps/jambes couverts) —
   *  gate de `visiblePassive`. Éditable au Codex. */
  visibleLocations?: import('../engine/types').HitLocation[];
  capabilities?: SymptomCapabilities;
}
/** Domaine de magie (Couleur, LDB 48) : ses ATTRIBUTS éditables au Codex — riders « à la touche »
 *  (`effects`, gatés par les Conditions Flow `relation`/`has`), mitigation de Projectile
 *  (`missile`), ops post-incantation au lanceur (`casterOps`). Le `label` correspond au `subType`
 *  d'un Sort d'Arcane (`domainOf`). */
export interface DomainData {
  id: string;
  type: 'domains';
  label: string;
  desc?: string;
  source?: SourceRef;
  /** Motif de la valeur maison de l'entrée. */
  maison?: string;
  /** Emplacements SECONDAIRES du même Domaine — republication à l'identique (doctrine « UNE entité,
   *  N livres ») : l'attribut du Domaine de la Lumière est reparu tel quel dans les Vents de Magie
   *  (`VDM 04 l.252-260`, folio 62). L'ancre `source` reste seule à porter la `desc`. */
  alsoIn?: SecondaryRef[];
  /** Vent de Magie (Couleur) du Domaine, EXTRAIT du `desc` (« Domaine du Feu (Aqshy) », LDB 48) — source
   *  d'AFFICHAGE de la Compétence Focalisation (spécialisée par Vent) et clé de `findDomainByWind`. Les 8
   *  Domaines élémentaires + Dhar en portent un ; les Domaines dérivés (Sorcellerie/Nécromancie/
   *  Démonologie/Magie naturelle…) n'ont pas de Vent propre (ils canalisent Dhar ou un
   *  Vent élémentaire). Édité au Codex. */
  wind?: string;
  /** Teinte des effets visuels d'un Sort du Domaine, à la place de celle de son rendu (#3771). */
  couleur?: string;
  /** Rendu visuel et sonore d'un Sort du Domaine (`rendus.json`), à défaut celui des Sorts des Vents (#3771). */
  rendu?: { id: string };
  /** Domaine ENSEIGNABLE via le Talent Magie des Arcanes (LDB 48) : SOURCE du pool `arcaneDomains`
   *  (SPEC_SOURCES). Les Lores de sorts non-arcanes (ex. Magie des mers de Triton) ne le portent pas.
   *  La marque EST le Type de Souffle (`breath-types.json`) du sort Souffle lancé par un mage du Domaine ; l'arbitrage se dit au
   *  `maison` de l'entrée. LDB 47 l.509 */
  arcane?: { id: string };
  /** `VDM 02 l.192` (`careerSlots.arcaneDomainGate`) — Nécromancie, Démonologie (LDB 50). */
  dark?: boolean;
  /** Ids de `groups.json` accordés au porteur d'un Talent ou d'un Trait dont la spécialisation nomme ce
   *  Domaine (`grantSpecGroups`, `groupesDe`). Absent = aucun Groupe. */
  grantGroups?: string[];
  /** Tables d'effets (`tables.json`) DÉCLARÉES par le Domaine, par CLÉ de rôle — résolues par l'op
   *  `rollDomainTable` (`engine/ops.ts`). Clé `arcaneMark` : Marques Arcaniques du Vent
   *  (`VDM 02 l.238`). Le lien Domaine→table vit ici, jamais dans le code. */
  tables?: Record<string, string>;
  /** Effets DÉCLENCHÉS « à la touche » sur une cible d'un Sort du Domaine (Feu → En flammes…) — MÊMES
   *  `TriggeredEffect` éditables que Traits/Atouts, gatés par les Conditions Flow `relation`/`has`. */
  effects?: TriggeredEffect[];
  /** Mitigation des Projectiles : ignore les PA d'une matière (`metal`/`nonMagic`) ; `bonusFromBypass`
   *  les ajoute aussi aux Dégâts (Métal). */
  missile?: { bypass: 'metal' | 'nonMagic'; bonusFromBypass?: boolean };
  /** Ops appliquées AU LANCEUR après une incantation réussie (ex. Bête → Peur 1 pendant 1d10 Rounds).
   *  Canal CAPABILITY (pas passive ni effects) : l'effet cible le lanceur lui-même, non une cible.
   *  Exécutées par `domainCasterOps` (engine/domainAttributes) via `applyOps`. */
  casterOps?: import('../engine/ops').GameOp[];
  /** Bonus d'incantation CONDITIONNEL (Aqshy l.157) : +`bonus` par État `perCondition` porté par un
   *  combattant situé à `radiusStat` (Bonus de carac.) mètres du lanceur (géométrie résolue par state).
   *  CAPABILITY irréductible : modifie le JET d'incantation via la géométrie de l'arène → hors GameOp
   *  (cf. 3 canaux passive / effects / capabilities). */
  castBonus?: { perCondition: string; radiusStat: import('../engine/types').CharKey; bonus: number };
  /** Caractéristique des Tests d'Incantation (Langue (Magick)) des Sorts de ce Domaine, à la place de la
   *  carac par défaut (ADE II 2 l.728 : la Magie de la Gueule, réservée aux ogres, se lance sur l'Endurance).
   *  Lue par `castingValue` — porté par la DONNÉE du domaine, aucun sniff d'espèce dans le moteur. */
  castingChar?: import('../engine/types').CharKey;
  /** Bonus d'incantation lié à l'ENVIRONNEMENT (LDB 48 l.690, Vie/Ghyran : +10 pour Incanter ou
   *  Focaliser dans un environnement rural ou sauvage). `environments` = classifications de Scène
   *  (`Scene.environment`) qui déclenchent le bonus ; `mod` = valeur. Lu par `domainEnvironmentBonus`. */
  environmentBonus?: { environments: string[]; mod: number };
  /** Domaine de la SORCELLERIE (LDB 49) : marqueur DONNÉE. Un Sort dont le `domainId` porte ce marqueur
   *  active le mode Sorcellerie (composant obligatoire sinon Imparfaite Mineure systématique, +1 Corruption
   *  par jet d'Imparfaite, État Hémorragique possible) — gated par la règle optionnelle `magie-sorcellerie`. */
  sorcery?: boolean;
  /** Modificateur des Vents de Magie EN MER (MDG 02 l.178-186). Règle d'application (l.178) :
   *  « Les modificateurs suivants s'appliquent aux tentatives de Focalisation et d'Incantation en mer. »
   *  Seuls 4 Domaines en portent un (Bête/Feu/Cieux/Vie). Lu par `domainSea*` (`engine/domainAttributes`),
   *  consommé par `resolveFocus`/`resolveCasting`/`evaluateCasting` (`engine/magic`) via un contexte
   *  `{ atSea, wind }` fourni par l'appelant (état — géométrie/météo hors du moteur pur). */
  seaModifier?: {
    /** Feu (Aqshy, l.182) : DR de Focalisation en mer. */
    focalisationDR?: number;
    /** Vie (Ghyran, l.186) : le DR de Focalisation en mer est DOUBLÉ. */
    focalisationDrDoubled?: boolean;
    /** Vie (Ghyran, l.186) : Focalisation Critique en mer → Imparfaite MAJEURE (au lieu de Mineure). */
    focusCritMiscastMajeure?: boolean;
    /** Cieux (Azyr, l.184) : DR d'Incantation en mer pendant une Violente tempête / en Calme plat. */
    incantationStormDR?: number;
    incantationCalmDR?: number;
    /** Bête (Ghur, l.180) : Critique/Maladresse déclenchés aussi sur un résultat finissant par 0. */
    critFumbleOnTens?: boolean;
  };
  /** Modificateurs de DR PROPRES au Vent du Domaine, hors mer (`VDM 04 l.48-56` « Un Vent difficile »
   *  et ses 7 homologues, un par Vent). Lus par le point UNIQUE `domainWindDR`
   *  (`engine/domainAttributes`), consommés par `resolveCasting`/`resolveFocus`/`castLandProbability`
   *  (`engine/magic`) via un contexte `{ circumstances }` fourni par l'appelant (météo/saison/lieu et
   *  annulations en cours — hors du moteur pur). */
  windModifiers?: {
    tests: ('incantation' | 'focalisation' | 'seconde-vue')[];
    dr: number;
    /** Ids de circonstances dont UNE suffit à déclencher le modificateur. Absent = permanent. */
    when?: string[];
    /** Annulation par un TIERS : `circumstance` est signalée par l'appelant quand un assistant
     *  possédant `requiresSkill` a réussi `test` et maintient son action (`sustained`). */
    cancelledBy?: {
      circumstance: string;
      requiresSkill?: { id: string; spec?: string };
      test: import('../engine/flowCore').FlowTest;
      sustained?: boolean;
      source: SourceRef;
      desc: string;
    };
    source: SourceRef;
    desc: string;
  }[];
}
export interface SpellData {
  /** id STABLE (slug du libellé) — cible des références de sort (sorts de créature, bénédictions/miracles). */
  id: string;
  label: string;
  /** ÉCOLE — libellé d'affichage hérité (dépotoir de 18 valeurs) ; la logique branche sur `family`/`domainId`. Dette : #1517. */
  ecole: string;
  subType: string | null;
  /** Domaine de magie du Sort — source RUNTIME du chemin sort→domaine (attributs LDB 48). Absent = Sort
   *  sans Domaine (Magie Mineure, Prière…). */
  domainId?: { id: string };
  /** Le Sort est un RITUEL (`VDM 02 l.363`) : même résolution qu'un Sort (`l.379`), rubriques
   *  d'anatomie en plus (`l.377-393`). TAG lu par les modificateurs de NI qui ne visent qu'une des
   *  deux natures (`VDM 12 l.646-647`, `VDM 14 l.489`). */
  isRitual?: boolean;
  /** Rubriques d'ANATOMIE D'UN RITUEL (`VDM 02 l.377-393`) : ce qu'un Rituel imprime EN PLUS d'un
   *  Sort. Rendues par la fiche Codex des Sorts (`noyau/codex/registry.ts`) ; `cnFrom` y remplace
   *  le NI quand la rubrique imprime une formule sur la cible plutôt qu'un nombre (`cn: null`). */
  ritual?: {
    type: string;
    /** Domaines ADMIS en ids (`VDM 02 l.381`) — cf. `schemas/defs/spells.ts` : liste peuplée =
     *  restreinte à ces Domaines, liste vide = tout Domaine. Lue par `arcaneDomainsOf`
     *  (`engine/grimoire.ts`). */
    domains: string[];
    cnFrom?: string;
    xp: number;
    /** Valeur RÉDUITE imprimée entre parenthèses (`VDM 02 l.398`/`l.400`), gatée sur les Domaines
     *  que PRATIQUE le lanceur — cf. `schemas/defs/spells.ts`. Lue par `ritualReduction`
     *  (`engine/grimoire.ts`). */
    reduced?: {
      domains: string[];
      chaosMagic?: true;
      cn: number;
      xp: number;
    };
    components: string;
    conditions: string;
    sacrifices: string;
    consequences: string;
  };
  /** Famille d'incantation STABLE (id, multilangue) — DISCRIMINANT moteur (familyOf / isArcaneSpell /
   *  canCastFromGrimoire / Chaos) ; `type` ci-dessus est un libellé d'affichage. */
  family: import('../engine/combatFeatures/types').CastingKind;
  /** Niveau d'Incantation (NI). `null` pour les Prières (Béni/Invocation). */
  cn: number | null;
  /** Portée STRUCTURÉE (LDB 46/47) — d'où le sort peut être lancé. `null` = donnée absente. Aucune prose n'est re-parsée au runtime ; l'affichage est DÉRIVÉ
   *  (`engine/spellRangeFormat`). */
  range: import('../engine/spellRange').SpellRange | null;
  /** Cible STRUCTURÉE (LDB 47) — qui/quoi est affecté (compte, ZONE par rayon/diamètre, cône, spécial).
   *  `null` = donnée absente. L'aire vit ICI (source unique). */
  target: import('../engine/spellRange').SpellTarget | null;
  /** Durée STRUCTURÉE (LDB 47) — instant/Rounds/horloge/lever-du-soleil/spécial. `null` = donnée absente.
   *  L'échelle Rounds vit ICI (source unique). */
  duration: import('../engine/spellDuration').SpellDuration | null;
  desc: string;
  /** Projectile magique (Dégâts résolus façon attaque) — DONNÉE (multilangue ; remplace la regex
   *  `/projectile magique/` sur la desc). `damage` = bonus ADDITIF (+ DR + BFM, LDB 46) ; `ignorePA`/
   *  `ignoreBE` = ignore les PA / le Bonus d'Endurance de la cible. Lus par `evaluateMissile`/IA. */
  missile?: boolean;
  damage?: number;
  ignorePA?: boolean;
  ignoreBE?: boolean;
  // ── MÉTADONNÉES DE RÉSOLUTION ──────────────────────────────────────────────────────────────────
  // Ces champs sont multilingue-safe (ids/formules, jamais du texte d'affichage).
  // POUSSÉE / TÉLÉPORTATION / ATTAQUES EN CHAÎNE : effets POSITIONNELS portés par des ops
  // IMPURES (`push`/`teleport`/`chain`, on:'caster') dans `effects`, résolus par combatFlow (cf. engine/ops).
  /** Sort « Souffle » (LDB 47 l.503) : délégué à l'attaque de ZONE du Trait Souffle. */
  breathAttack?: true;
  /** Titre et livre VO d'un sort qu'un livre fan traduit — `schemas/defs/spells.ts` (#3666). */
  titreVO?: string;
  livreVO?: { id: string };
  /** OPPOSITION de la cible (multijet dans la modale d'incantation).
   *  `resist` : Test opposé par la caractéristique/compétence `characteristic`/`skill` de la cible.
   *  `contact` : Sort de Portée Contact — frappe via Test opposé de Corps à corps (Bagarre). */
  opposed?: {
    kind: 'resist' | 'contact';
    /** Caractéristique opposée (`resist` uniquement). */
    characteristic?: import('../engine/types').CharKey;
    /** Compétence opposée (`resist` uniquement, rare) — référence `{ id, spec? }`. */
    skill?: RefDesignee;
  };
  /**
   * EFFETS du sort — `Flow` ÉDITABLE (système logique unique : `do`/`if`/`test`), source des effets
   * mécaniques appliqués à l'incantation (feuilles EffectOp `{type:'ops', on:'target'|'caster', ops}`).
   * Édité dans le Compendium (CodexEdit → FlowEditor), exécuté par `runCombatFlow`. SOURCE UNIQUE des
   * effets. Import TYPE seul (effacé à la compilation) → la couche data NE dépend PAS d'une valeur
   * du code de règle (pureté préservée). Absent = aucun effet mécanique (narratif).
   */
  effects?: Flow;
  source: SourceRef;
  /** Emplacement SECONDAIRE (#563) — même Sort à cheval prose⇄stat-bloc ailleurs (ex. Maître de la
   *  bête : prose LDB 246, stat-bloc NI/Portée/Cible/Durée LDB 245). Accessors `allLocations`/
   *  `sourceBooks` (`src/data/sourceRefs.ts`). */
  alsoIn?: SecondaryRef[];
}

/** Signe astral (ADE II) : table d100 (`rand` = borne haute cumulée), flavor + effet de création. */
export interface StarData {
  /** id STABLE (slug du libellé) — `Combatant.star` le stocke, le runtime résout par `findStarById`
   *  (≠ libellé — multilangue-safe). */
  id: string;
  label: string;
  rand: number;
  signe: string;
  classique: string;
  ascendant: string;
  dates: string;
  dieux: string;
  apparence: string;
  /** Effet ADE II appliqué AUX ATTRIBUTS DE DÉPART (ch.03 l.38) — donnée éditable au Codex
   *  (`GameOpEditor`) : `charMod` (±carac) et/ou `grantTalent` (talent octroyé). Appliqué une
   *  fois à la création (cf. `applyStarOps`), pas collecté en passif continu. */
  ops?: import('../engine/ops').GameOp[];
  /** L'Étoile du Sorcier (ADE II 3 l.63) : fourchette du 1d10 interne parmi les variantes partageant
   *  `rand:100`, dans la forme que `findTableEntry` lit. Absent = pas de sous-tirage (signe simple). */
  sub?: { min: number; max: number };
  desc?: string;
  source: SourceRef;
}
/** Lieu (Glorieux Reikland, LDB) : hiérarchie par `parent` (label d'un autre lieu). */
export type LocationData = EntreeDe<typeof locationsDef>;
/** Ouvrage WFRP4 référencé (bibliographie). `desc` = présentation en texte/Markdown (règle 5). */
export type BookData = EntreeDe<typeof booksDef>;
/** Apparence de base d'une espèce (Humain, Ogre, Skaven…) — éditable dans le Compendium. PAR
 *  RÉFÉRENCE : id de gabarit (`gabarits.json`). */
export interface RaceAppearanceData {
  id: string;
  label: string;
  gabarit: { id: GabaritId };
  gabaritOverride?: SurchargeDeGabarit;
}
/** Une espèce du plan de bestiaire (`planDeBestiaire.json`, #2993) : la base humanoïde à sa race de rendu, un corps
 *  de générateur, ou omise et son motif ; l'échelle d'art de qui porte un corps. */
export type PlanDEspece = EntreeDe<typeof planDeBestiaireDef>;
/** Banque de noms d'UNE race jouable : prénoms M/F + noms de famille (LDB 05). L'`id` est le
 *  `RaceKey` de la race (`species.refChar`) ; le `label` est de l'AFFICHAGE. */
export type NamePool = EntreeDe<typeof namesDef>;

import { indexParChamp, indexParId, memoParVersion } from './versionDataset';
/** Les primitives d'INDEX VIVANT (#1692), REEXPORTÉES par la façade : un lecteur hors `src/data` compose
 *  l'accesseur d'ici plutôt que de rebâtir son propre index sur un dataset muté en place. */
export { indexParChamp, indexParId, memoParVersion, versionDuDataset } from './versionDataset';

export const characteristics = datasetDe<typeof characteristicsDef>(characteristicsJson);
/** Abréviation FR AFFICHÉE d'une caractéristique à jet (« CC », « Ag »…), dérivée de `characteristics.json`
 *  par `id` (jamais recopiée en dur dans l'UI — `CharKey` reste un id opaque, cf. engine/types.ts). */
const charARoulerParId = indexParChamp('characteristics', characteristics, (c) => (c.nature === 'roll' ? c.id : undefined));
export const charAbr = (k: CharKey): PlayerText => dataLabel(charARoulerParId(k)?.abr, k);
/** La caractéristique à jet qu'abrège un sigle imprimé (« F », « FM »), casse ignorée — inverse de
 *  `charAbr`, lu par la saisie d'un Indice relatif (`lireIndiceRelatif`). */
export const caracDuSigle = (sigle: string): CharKey | undefined =>
  characteristics.find((c) => c.nature === 'roll' && c.abr != null && norm(c.abr) === norm(sigle))?.id as CharKey | undefined;
export const species = datasetDe<typeof speciesDef>(speciesJson);
export const classes = classesJson as ClassData[];
export const careers = datasetDe<typeof careersDef>(careersJson);
export const careerLevels = datasetDe<typeof careerLevelsDef>(careerLevelsJson);
export const skills = skillsJson as SkillData[];
export const talents = talentsJson as TalentData[];
export const etats = etatsJson as EtatData[];
/** Procédures / options de jeu (Sombre Pacte, modes d'attaque/défense, Empoignade, Focalisation
 *  étendue…) — prose du livre ADRESSÉE au `Source/` (`descRef`, #1887) ou inline (`desc`, stock
 *  `PROSE_INLINE_TOLEREE`), app-owned. Routées en tooltip
 *  `CodexRef` (catégorie `regles`). */
export interface RegleData {
  id: string;
  type: 'regles';
  label: string;
  desc: string;
  source: SourceRef;
  /** Les valeurs que le livre chiffre, lues par `engine/reglesChiffrees.ts` (schéma `defs/regles.ts`). */
  rangees?: RangeeDeRegleData[];
  /** Les Tests que la règle nomme, lus par `engine/reglesChiffrees.ts` (`testDeRegle`) ; la Difficulté y
   *  est exigée par le schéma. */
  tests?: TestDeRegleData[];
}
export interface TestDeRegleData {
  id: string;
  label: string;
  source: SourceRef;
  test: import('../engine/flowCore').JetFixe<'skill' | 'difficulty'>;
}
export interface RangeeDeRegleData {
  id: string;
  label: string;
  palier?: Difficulty;
  valeur?: number;
  famille: import('../engine/types').ModFamille;
  seuil?: number;
  plafond?: number;
}
export const regles = adressee<RegleData>(reglesJson);
/** Index VIVANT par `id` STABLE : `regles` est routé par le seam `ARRAYS` d'`overrides.ts`. */
const regleParId = indexParId('regles', regles);
/** Résout une fiche de Règle par son `id` STABLE. */
export function findRegleById(id: string): RegleData | undefined {
  return regleParId(id);
}
/** Tables numériques de Disponibilité & de Troc (LDB 59 « Faire son marché » p.290-291) — app-owned
 *  éditable ; consommé par `engine/disponibilite` (mêmes références). */
export const disponibilite = datasetDe<typeof disponibiliteDef>(disponibiliteJson);
/** Maladies (LDB 20) — app-owned éditable au Codex ; le COMPORTEMENT (cycle/symptômes) vit dans
 *  `engine/disease`, le type `DiseaseDef` dérive du schéma (`schemas/defs/maladies.ts`). */
export const maladies = maladiesJson as DiseaseDef[];
const maladieParId = indexParId('maladies', maladies);
/** Résout une Maladie par son `id` STABLE. */
export function findDiseaseById(id: string): DiseaseDef | undefined {
  return maladieParId(id);
}
/** Libellé d'affichage d'une Maladie par son id (repli sur l'id). */
export function diseaseLabel(id: string): PlayerText {
  return dataLabel(maladieParId(id)?.label, id);
}
// Traits app-owned — TOUT dans `traits.json` ; chaque entrée garde sa vraie `source`.
export const traits = traitsJson as TraitData[];
const traitParLabelMinuscule = indexParChamp('traits', traits, (t) => t.label.toLowerCase());
/** `id` STABLE d'un Trait depuis un LIBELLÉ d'AUTHORING (statbloc saisi, migration), casse ignorée —
 *  `undefined` si le texte ne nomme aucun trait du catalogue. La couture label→id vit ICI, au
 *  CHARGEMENT de la donnée (AGENTS.md § Pour TOUT agent) : `src/engine` délègue à ce résolveur d'ID
 *  et ne manipule que des ids ; le runtime résout par `findTraitById`. */
export const traitIdByLabel = (label: string): string | undefined => traitParLabelMinuscule(label.toLowerCase())?.id;
const traitParId = indexParId('traits', traits);
/** Trait par `id` STABLE (slug) — lookup runtime indépendant de la langue. */
export const findTraitById: (id: string) => TraitData | undefined = traitParId;
export const qualities = qualitiesJson as QualityData[];
/** Index des Atouts/Défauts par `id` STABLE (slug) — lookup runtime indépendant de la langue (dispatch). */
const qualiteParId = indexParId('qualities', qualities);
/** Atouts de Fabrication (LDB 60 l.9-32) — DÉRIVÉS de la donnée : les qualités `atout` d'objet que la
 *  Compétence Métier produit, donc hors qualités MAGIQUES (`capabilities.magic` : Maudit, VDM 12
 *  folio 170, est un Atout d'objet qu'aucun artisan ne fabrique). */
export const fabricationAtouts = memoParVersion('qualities', (): string[] =>
  qualities.filter((q) => q.polarite === 'atout' && q.subType === 'objet' && !q.capabilities?.magic).map((q) => q.id),
);
/** Atout de fabrication par DÉFAUT (fallback maison quand le joueur ne choisit pas ; le RAW n'en fixe
 *  aucun — un objet de qualité a toujours UN Atout, LDB 60 l.11). */
export const DEFAULT_FABRICATION_ATOUT = 'raffine';
/** `QualityRef` d'un Atout de fabrication résolu — une qualité INDICÉE (`indice`) prend l'Indice 1
 *  par défaut d'un Atout UNIQUE de fabrication (Solide « encaisse Indice PdD », LDB 60 l.30). */
export function fabricationAtoutQuality(id: string): { id: string; value?: number } {
  return qualiteParId(id)?.indice ? { id, value: 1 } : { id };
}
/** Symptômes de maladie (LDB 20) — entités de DONNÉE éditables au Codex (passive/onTick/capabilities). */
export const symptoms = symptomsJson as SymptomData[];
const symptomeParId = indexParId('symptoms', symptoms);
export const findSymptomById: (id: string) => SymptomData | undefined = symptomeParId;
/** Libellé FR d'un symptôme par son id (repli sur l'id si inconnu). */
export const symptomLabel = (id: string): PlayerText => dataLabel(symptomeParId(id)?.label, id);
/** Les paliers de SÉVÉRITÉ d'une instance de symptôme, dans l'ordre CROISSANT (LDB 20 l.157 « (Modéré) »,
 *  l.170 « (Grave) ») — SOURCE UNIQUE de l'énumération (canaux `passiveBySeverity`/`difficultyBySeverity`,
 *  atelier du Codex). La LOGIQUE reste keyée par ces ids ; leur AFFICHAGE vit sur le nœud
 *  `symptomSeveritySchema` (`schemas/grammaire/valeurs.ts`), lu par `libelleDeValeur`. */
export const SYMPTOM_SEVERITIES = ['moderee', 'grave'] as const;
/** Libellé d'une INSTANCE de symptôme portée par une maladie : le nom du symptôme, suivi de ce qui
 *  QUALIFIE l'instance — sa sévérité (`LDB 20 l.156-159`, `LDB 20 l.170`) et sa précision imprimée
 *  (`EDO App.2 l.143`, « Gonflement (Visage et tête) »). SOURCE UNIQUE de cette composition : une
 *  instance ne se nomme jamais par son seul `symptomLabel`, sinon deux fièvres de sévérités
 *  différentes s'affichent à l'identique. */
export const symptomInstanceLabel = (inst: { symptomId: string; severity?: 'moderee' | 'grave'; spec?: string }): PlayerText => {
  const qualifs = [inst.severity ? libelleDeValeur(symptomSeveritySchema, inst.severity) : null, inst.spec ?? null].filter(Boolean);
  return qualifs.length ? dataLabel(`${symptomLabel(inst.symptomId)} (${qualifs.join(', ')})`) : symptomLabel(inst.symptomId);
};
/** Mutations (entités) + Tables de Corruption (plages de leur dé → réf), DÉCOUPLÉES (cf. data/mutations.ts) —
 *  app-owned éditables au Codex. Le runtime du tirage (`rollMutation`) vit dans `mutations.ts`. */
export const mutations = mutationsJson as MutationData[];
export const mutationTables = datasetDe<typeof tablesDeCorruption>(mutationTablesJson);
/** Tables d'EFFETS référençables (`tables.json`, tirées par l'op `rollTable` variante `tableId`) —
 *  loader + lookup fail-fast dans `data/effectTables.ts` (importe le type `GameOp` du moteur, réservé). */
export { effectTables, findEffectTableById, type EffectTable, type EffectTableRow } from './effectTables';
const mutationParId = indexParId('mutations', mutations);
/** Résout une Mutation (entité) par son `id` STABLE — lookup DONNÉE sans cycle (le résolveur de tirage
 *  `mutationById` de `data/mutations` importe le moteur → réservé au runtime de corruption). */
export function findMutationById(id: string | null | undefined): MutationData | undefined {
  return mutationParId(id);
}
/** Libellé d'affichage d'une Mutation par son id (repli sur l'id). SOURCE UNIQUE du nom. */
export function mutationLabel(id: string | null | undefined): PlayerText {
  return dataLabel(id ? (mutationParId(id)?.label ?? id) : '');
}

const marqueDeSiege = porteLeMarqueur('weaponGroup', 'siege');
/** Groupe d'engins de siège : marqueur `siege` de `weaponGroups.json`. AA 10 l.136 */
export const groupeDeSiege = (id: string | null | undefined): boolean => !!id && marqueDeSiege(id);
/** Engins de siège posables : trappings d'un Groupe d'engins de siège (`groupeDeSiege`). Foyer du filtre
 *  partagé par les emplacements, les références d'entité et la catégorie du Codex. */
export const siegeEngines = memoParVersion(['trappings', 'weaponGroups'], () => trappings.filter((t) => groupeDeSiege(t.subType?.id)));
/** Trappings que le moteur INSTANCIE par leur id (`INSTANCIABLE_PAR_ID`, `dansLaSousListe`) : la vue que
 *  lit tout producteur d'ids d'objet (fabrication, commande, stock marchand, conjuration, armes
 *  choisissables, galeries). Le catalogue brut ne se lit qu'aux sites que nomme `trappings-vue-guard.test.ts`. */
export const trappingsInstanciables = memoParVersion('trappings', () => trappings.filter((t) => dansLaSousListe(INSTANCIABLE_PAR_ID, t)));
/** Pièce d'armure nommée, lue au catalogue des armures, sa matière au Groupe : la parenthèse d'une Armure
 *  qui nomme des pièces (`classerParenthese`, `lireMatiere`). LDB 63 l.13 ; #1463. */
export const emplacementsDesPiecesDuCatalogue = memoParVersion('trappings', () => emplacementsDesPieces(trappings, matiereDuGroupe));
/** Véhicules / embarcations à coque — FOYER UNIQUE app-owned (data-driven). Trois facettes par
 *  enregistrement (achat / voyage / coque) ; cf. `VehicleData`. La facette `travel` est lue par
 *  `engine/travel` ; les facettes `purchase`/`hull` par le marché et les incidents/combat. */
export const vehicles = datasetDe<typeof vehiclesDef>(vehiclesJson);
const vehiculeParId = indexParId('vehicles', vehicles);
export const findVehicleById: (id: string) => VehicleData | undefined = vehiculeParId;

/** Archétypes de marchand (#2, donnée éditable — aucun archétype en dur dans le code) — FOYER UNIQUE
 *  app-owned, indexé par `findMerchantArchetypeById` :
 *  ajouter un archétype = une entrée JSON ici, rien d'autre. */
export const MERCHANT_ARCHETYPES = datasetDe<typeof merchantsDef>(merchantsJson);
export const findMerchantArchetypeById: (id: string) => MerchantArchetypeDef | undefined = indexParId('merchants', MERCHANT_ARCHETYPES);

/** Structures destructibles de siège (ADE II 8) — catalogue app-owned éditable au Codex. Modèle à PV
 *  calqué sur la facette `hull` des véhicules ; lu par `engine/structures.ts` (`structureCombatant`). */
export const structures = datasetDe<typeof structuresDef>(structuresJson);
const structureParId = indexParId('structures', structures);
export const findStructureById: (id: string) => StructureData | undefined = structureParId;
/** Apparence de RENDU des structures (murs/portes) — donnée pure, découplée des règles ci-dessus. */
export const structureAppearances = structureAppearanceJson as import('./structureAppearance.types').StructureAppearanceDef[];

/** Combat de masse / Puissance de Bataille (ADE II 8, l.13-321) — 5 tables verbatim NICHÉES dans
 *  UN seul fichier (`mass-battle.json`, pas un tableau plat par table) : exposées ICI (facade) pour que
 *  le Codex/l'éditeur DEV les édite comme n'importe quel autre dataset (seam `overrides.ts`) ; le moteur
 *  pur (`engine/massBattle.ts`) les relit d'ICI (types définis là-bas, réimportés en `import type` —
 *  même patron que `maladies`/`DiseaseDef`). Noms préfixés `massBattle*` : `structures` est déjà pris par
 *  le catalogue de structures de siège JOUABLES ci-dessus (schéma différent : BE/B structuré + traits
 *  `{id}[]`, quand mass-battle.json reste `be`/`wounds`/`traits` en chaîne verbatim imprimée). */
export const massBattlePowerEstimate = massBattleJson.powerEstimate as PowerEstimateRow[];
export const massBattleMightModifiers = massBattleJson.mightModifiers as MightModifierRow[];
export const massBattleWarMachines = massBattleJson.warMachines as WarMachineRow[];
export const massBattleStructures = massBattleJson.structures as MassBattleStructureRow[];
export const massBattleHazards = massBattleJson.hazards.entries as HazardRow[];
/** Le dé des Facteurs environnementaux (ADE II 08 l.311), lu sur leur nœud à l'appel. */
export const massBattleHazardsDie = (): DeDeTable => deDeLaTableTiree(massBattleJson.hazards);

/** LES matières du monde (#1686) — donnée pure, UN document, le domaine PORTÉ par l'entrée. */
export const materials = datasetDe<typeof materialsDef>(materialsJson);

/** LES terrains du monde (#1690) — règle (franchissabilité, raccord, opacité, bâti) ET rendu (teinte,
 *  rampe, recette, décor posé, bloc plein) dans UNE entrée. Binding muté EN PLACE par `setDataset`
 *  (`data/overrides.ts`) : la façade `src/noyau/monde/terrain` et le catalogue de rendu le lisent VIVANT. */
export const terrains = terrainsJson as unknown as TerrainDef[];

/** LES types de bâtiment (#1715) — empreinte et couverture par défaut à la pose, ornements d'identité
 *  émis en billboard. Binding muté EN PLACE par `setDataset` (`data/overrides.ts`) : la façade
 *  `src/noyau/monde/buildings` le lit VIVANT. */
/** L'ENTRÉE de `buildings.json` et l'ornement d'identité qu'elle porte (`features`). */
export type BuildingDef = EntreeDe<typeof buildingsDef>;
export type BuildingFeature = NonNullable<BuildingDef['features']>[number];
export const buildings = datasetDe<typeof buildingsDef>(buildingsJson);

/**
 * Les matières d'UN domaine — vue DÉRIVÉE du document, jamais un second catalogue, et jamais un
 * SNAPSHOT : la fonction balaie `materials` À L'APPEL. Le tableau est le seul binding partagé, splicé
 * en place par `setDataset` (`data/overrides.ts`) ; une vue évaluée au niveau module aurait figé les
 * entrées d'avant l'édition. Coût mesuré du balayage de 16 entrées au cardinal réel du rendu
 * (18 026 lookups, 65 scènes) : +4,1 ms contre un index `Map` (#1686 lot 3a-1).
 * Apparences servies : `prop` (recettes volumiques de décor), `roof` (couvertures + plan vu du
 * dessus), `relief` (falaises/rampes/tabliers/piliers/POV), `couleur` (nuancier de la palette des personnages).
 */
export const matieresDe = <D extends MaterialDomain>(domain: D): MatiereDe<D>[] =>
  materials.filter((m): m is MatiereDe<D> => m.domain === domain);

/** Matières POSABLES sur une masse de toit : les entrées de domaine `roof` que la DONNÉE déclare
 *  couvrantes (`couverture`) — SOURCE UNIQUE du validateur de scène (`noyau/validateScene.ts`) et des
 *  sélecteurs de l'éditeur, qui vivent dans deux couches et ne peuvent pas
 *  s'importer l'une l'autre. Lecture VIVANTE, comme `matieresDe`. */
export const matieresCouvrantes = (): RoofMaterialDef[] => matieresDe('roof').filter((m) => m.couverture);

/** L'entrée du PLAN vu du dessus — celle que la DONNÉE marque `vueDeDessus` (#1691), jamais un id
 *  littéral au call-site. Le schéma en garantit l'unicité (`schemas/defs/materials.ts`,
 *  `affinerDataset`) ; le premier marqué est donc LE plan. Lecture VIVANTE, comme `matieresCouvrantes`. */
export const matierePlan = (): RoofMaterialDef => {
  const plan = matieresDe('roof').find((m) => m.vueDeDessus);
  if (!plan) throw new Error('matierePlan() : aucune entrée `roof` ne porte `vueDeDessus` — materials.json');
  return plan;
};

/** AMBIANCE de rendu partagée iso ⇄ POV (ciel/brumes/vignette/voile chaud/filtre d'étage) — donnée pure. */
export const ambiance = ambianceJson as import('./ambiance.types').AmbianceDef;

/** TEINTES DE JEU du terrain (surbrillances tactiques + identité d'unité), `id → #rrggbb` — donnée
 *  pure, servie aux peintres (schéma et invariants : `schemas/defs/teintesJeu.ts`). */
export const teintesJeu: Record<import('./schemas/defs/teintesJeu').TeinteId, string> = teintesJeuJson.entries;

/** Traits & Améliorations de navire (MDG 12) — catalogue app-owned éditable au Codex. La DONNÉE (`desc`
 *  verbatim + effet) vit ici ; `engine/navalTraits.ts` ne fait que la LIRE (aucune valeur codée en dur).
 *  `kind` distingue Trait (construction) et Amélioration (ajout/retrait) ; `ranked` = prend un Indice
 *  (« Renforcé 2 », « Peu maniable 1 »). L'EFFET mécanique passe par la langue UNIQUE des ops (`passive: OpPassive[]`,
 *  MÊME vocabulaire/éditeur que traits & mutations) — `ap` (Blindage → PA de coque), `moveMod` (Lissage → M),
 *  `skillDRBonus` (Peu maniable → DR des Tests de Voile/Ramer). Restent en CHAMP DE DOMAINE les sous-systèmes
 *  navire hors vocabulaire combattant : `ram` (Bélier → collision proue/frontale) et `deckCover` (Sabord →
 *  couvert de pont). Absent = pas d'effet mécanisé ou déjà baké dans les colonnes du véhicule
 *  (Renforcé/Solide → E/B). */
/** Taille de navire MDG (catégorie dérivée de la LONGUEUR, tableau CARACTÉRISTIQUES DE BATEAU STANDARD,
 *  MDG 12 l.120-129 : 1-10 m Minuscule … 81 m+ Monstrueuse) — ids stables des bandes d'installation. */
export type ShipSize = 'minuscule' | 'tres-petite' | 'petite' | 'moyenne' | 'grande' | 'enorme' | 'monstrueuse';
/** Palier de LONGUEUR d'un tarif d'installation (#277 : MSRC 12 l.54-135 tarife par TYPE de navire à
 *  longueurs explicites — barque 5 m et esquif 10 m tombent dans la MÊME `ShipSize` « minuscule » avec des
 *  tarifs DIFFÉRENTS, la Taille ne peut donc pas discriminer). `maxLengthM` = borne haute inclusive du
 *  palier (`null` = bande OUVERTE au-delà — le dernier élément du tableau, triés par longueur croissante) ;
 *  `value` = CO (coût), Enc (poids) ou jours (durée de pose) selon le champ porteur ; `maison` = réf nue du tarif au-delà de la
 *  dernière borne chiffrée par le livre porté sur la bande concernée. */
export interface InstallBand { maxLengthM: number | null; value: number; maison?: string }
/** Coût / Poids d'INSTALLATION d'une Amélioration navale (MDG 12, lignes « Coût : / Poids : » de chaque
 *  Amélioration, l.195-364 ; MSRC 12 l.1-140) — VERBATIM structuré par paliers de LONGUEUR. `per: '5m'` =
 *  « par tranche de 5 m de Taille » (Blindage, Lissage) ; `per: 'unite'` = « par cabine » (Cabine de luxe) ;
 *  `'modele'` = ceux du modèle embarqué (Embarcation de bord). `weightEnc` absent = aucun poids (Lissage).
 *  Donnée consommée par le chantier construction/réparation navale (lot systèmes) — aucune valeur codée en
 *  dur. */
export type InstallBareme = { bands: InstallBand[]; per?: '5m' | '10m' | 'unite' } | 'modele';
export interface NavalInstall {
  installation: InstallBareme;
  weightEnc?: InstallBareme;
  /** Durée de la pose (jours) par palier de longueur ; absente : `reparation.joursDePose`. MDG 12 l.230 ; MDG 12 l.293 */
  jours?: InstallBareme;
}
export interface NavalTraitData {
  /** id STABLE (slug) — la clé d'appariement avec `ship.traits`/`Combatant.upgrades` (`NavalTraitRef.id`). */
  id: string;
  type: 'naval-traits';
  /** Libellé VERBATIM de BASE (sans Indice) — affichage seul, résolu par `findNavalTrait(id)?.label`. */
  label: string;
  kind: 'trait' | 'amelioration';
  source?: SourceRef;
  /** Emplacement SECONDAIRE (#563) — même Trait/Amélioration à cheval prose⇄bloc Coût/Poids ailleurs
   *  (ex. Murs blindés : prose MSRC 66, bloc Coût/Poids MSRC 65). Accessors `allLocations`/
   *  `sourceBooks` (`src/data/sourceRefs.ts`). */
  alsoIn?: SecondaryRef[];
  desc: string;
  /** Coût/Poids d'installation (Améliorations seulement) — cf. `NavalInstall`. */
  install?: NavalInstall;
  /** Prend un Indice (le libellé authoré peut être « Renforcé 2 ») — l'effet `passive` est répété par niveau. */
  ranked?: boolean;
  /** Effet mécanique en `OpPassive[]` (langue unique) — lu par `navalPassiveOps` puis filtré par effet
   *  (`ap`/`moveMod`/`skillDRBonus`), répété ×Indice si `ranked`. MÊME éditeur `GameOpEditor` que les traits. */
  passive?: import('../engine/ops').OpPassive[];
  /** Bélier (MDG 12 l.221) : bonus de COLLISION (géométrie proue/frontale) — sous-système navire hors
   *  vocabulaire combattant (≠ `ap` qui mitige TOUT) → injecté dans `resolveCollision` via `belierRam`. */
  ram?: { ic: number; ap: number };
  /** Couvert de pont GRADUÉ (`DeckCoverClass`) offert par l'Amélioration à ses postes — Sabord/Murs blindés
   *  = `totale` (MDG 12 l.364 / MSRC 12 l.85), Plat-bord = `moyenne` (MSRC 12 l.111). Consommé au tir
   *  par `couvertDuPoste`. Sous-système navire, hors vocabulaire combattant. */
  deckCover?: import('../engine/types').DeckCoverClass;
  /** Modificateur (points) au Test de Navigation POUR DIRIGER le bateau — Bouteur +20 (MSRC 12 l.66),
   *  Gréement de course −10 (l.137). Sous-système manœuvre, converti en DR d'équipage par `navalNavTestDR`. */
  navTestMod?: number;
  /** #221 : même champ `maison` que `TraumaFiche` (`src/data/schemas/defs/traumas.ts:32`). */
  maison?: string;
}
export const NAVAL_TRAITS = navalTraitsJson as NavalTraitData[];
const traitNavalParId = indexParId('navalTraits', NAVAL_TRAITS);
/** Entrée du catalogue pour une réf par id STABLE (`NavalTraitRef.id`) — l'Indice vit dans `NavalTraitRef.value`,
 *  PAS dans la clé (jamais un parsing de libellé « Renforcé 2 »). PUR. */
export function findNavalTrait(id: string): NavalTraitData | undefined {
  return traitNavalParId(id);
}
/** Index des ports de la Mer des Griffes (#217, MDG 15 l.439-506) — catalogue app-owned éditable au
 *  Codex, consommé PAR RÉFÉRENCE depuis un lieu de la carte du monde (`MapPlace.port.ref`,
 *  `noyau/worldMap.ts`). `production`/`surplus`/`demande` sont keyés par id de la voie `mer` de `cargoes.json`
 *  (+ marqueurs `commerce-mer`/`minimum-vital`), même vocabulaire que `PortProfile` (`engine/seaVoyage.ts`). */
export type NavalPortData = EntreeDe<typeof navalPortsDef>;
export const navalPorts = datasetDe<typeof navalPortsDef>(navalPortsJson);
const portNavalParId = indexParId('navalPorts', navalPorts);
export function findNavalPortById(id: string): NavalPortData | undefined {
  return portNavalParId(id);
}

/** LOT 1 #422 : 4 datasets NAVAUX de contenu (tables MDG 12/13/15) exposés au Codex — mêmes garanties
 *  de référence LIVE (singleton ESM, même fichier physique relu par `engine/seaNavigation.ts`,
 *  `engine/seaPerils.ts`, `engine/seaWeather.ts`, `engine/shipBuild.ts`) que `WATER_EXPOSURE` ci-dessus. Types réutilisés DEPUIS le schéma zod (`schemas/defs/*`, porte
 *  `datasetDe`) — pas de redéclaration divergente. */
export const seaNavigation = seaNavigationJson as SeaNavigationData;
export const seaPerils = seaPerilsJson as SeaPerilsData;
export type SeaWeatherData = DatasetDe<typeof seaWeatherDef>;
export const seaWeather = datasetDe<typeof seaWeatherDef>(seaWeatherJson);
export const shipConstruction = datasetDe<typeof shipConstructionDef>(shipConstructionJson);

/** LOT 2 #422 : Navigation fluviale (MSRC 7) — pendant fluvial de `seaNavigation`, même patron
 *  d'export (référence LIVE au même fichier physique relu par `engine/riverNavigation.ts`). */
export type RiverNavigationData = DatasetDe<typeof riverNavigationDef>;
export const riverNavigation = datasetDe<typeof riverNavigationDef>(riverNavigationJson);

/** Règles de négoce (#3433) : MDG 15 maritime, MSRC 13 terrestre — lues par `engine/seaVoyage.ts`,
 *  `engine/landCargo.ts` et `engine/cargo.ts`. */
export type SeaCargoData = DatasetDe<typeof seaCargoDef>;
export const seaCargo = datasetDe<typeof seaCargoDef>(seaCargoJson);
export type LandCargoData = DatasetDe<typeof landCargoDef>;
export const landCargo = datasetDe<typeof landCargoDef>(landCargoJson);

/** Vocabulaire des SERVICES de lieu (#343, `lieux-services.json`) — catalogue EXTENSIBLE désigné par
 *  `ref('serviceDeLieu')` (`MapPlace.services[].kind`, `PlacePoi.serviceKind`) et résolu par `placeServices`
 *  (`src/noyau/worldMap.ts`). `port`/`marche` y donnent le libellé, l'icône et le fond par défaut du port et du
 *  marché d'un lieu, qui gardent leur propre schéma riche — id STABLE → libellé/icône d'affichage du hub de lieu. */
export type LieuServiceData = EntreeDe<typeof lieuxServicesDef>;
export const lieuxServices = datasetDe<typeof lieuxServicesDef>(lieuxServicesJson);
const lieuServiceById = new Map<string, LieuServiceData>(lieuxServices.map((s) => [s.id, s]));
export function findLieuServiceById(id: string): LieuServiceData | undefined {
  return lieuServiceById.get(id);
}
/** Chanson de marins (MDG 09 l.218-248, payload du Talent Chanson de marin) — catalogue app-owned.
 *  `crewOps` = effet exprimé dans la langue UNIQUE `GameOp[]`, appliqué à CHAQUE membre d'équipage pendant
 *  l'effet (3 min + DR du Test de Divertissement (Chant) en minutes, 1 chanson par quart — activation
 *  `chanterLaChanson`, noyau/combatSlice). `captainOps` = ops appliquées au seul CAPITAINE (titulaire du
 *  rôle — « Suivez le capitaine », l.246-248). `note` = clause RAW laissée à l'arbitrage MJ (intention/
 *  conséquence de Test non suivies par le moteur) — affichée, jamais un effet inventé. */
export interface SeaShantyData {
  id: string;
  type: 'sea-shanties';
  label: string;
  desc: string;
  crewOps?: import('../engine/ops').GameOp[];
  captainOps?: import('../engine/ops').GameOp[];
  note?: string;
  source: SourceRef;
}
export const seaShanties = seaShantiesJson as SeaShantyData[];
const chansonMarinParId = indexParId('seaShanties', seaShanties);
export function findSeaShantyById(id: string): SeaShantyData | undefined {
  return chansonMarinParId(id);
}
/** Rôles d'équipage naval (MDG 14 « Tests d'équipage ») — catalogue app-owned éditable au Codex.
 *  Chaque rôle mappe une (ou plusieurs, ex. Mousse = Voile/Ramer → meilleure) Compétence par `id` STABLE
 *  (+ `spec` pour Artilleur/Cuisinier/Chansonnier). Le `desc` est le verbatim de la colonne « Tâches ». */
/** Solde d'un rôle (MDG 14 l.293-302 « Exemples de mercenaires ») : coûts quotidien/hebdomadaire
 *  verbatim ; `source` = correspondance RAW explicite, `maison` = correspondance arbitrée. #216 */
export type CrewRoleData = EntreeDe<typeof crewRolesDef>;
/** Type de Test d'équipage — MDG 14. Sa `rule` ADRESSE le passage MDG 14 (`cibleCodex`) ; l'ENJEU AFFICHÉ
 *  est le descripteur d'EFFET du `kind` joué (`stakes.json`, cascade `voyage`, `voyageStakeRef`). */
export type CrewTestTypeData = DatasetDe<typeof crewTestTypesDef>['types'][number];
/** PRÉSENCE à bord que les livres NOMMENT (`ship-stations.json`) — seule cible de
 *  `ShipCrewHit.crewTarget.stations` et de l'épinglage `Combatant.shipStation`. `requiresTrait` gate
 *  la station sur un Trait naval de la coque (`cale` — MSRC 07 l.94 ; `nid-de-pie` — MDG 12 l.299). */
export type ShipStationData = EntreeDe<typeof shipStationsDef>;
export const shipStations = datasetDe<typeof shipStationsDef>(shipStationsJson);
const stationParId = indexParId('shipStations', shipStations);
export const findShipStation: (id: string) => ShipStationData | undefined = stationParId;
export const crewRoles = datasetDe<typeof crewRolesDef>(crewRolesJson);
const roleEquipageParId = indexParId('crewRoles', crewRoles);
export const findCrewRoleById: (id: string) => CrewRoleData | undefined = roleEquipageParId;
export const crewTestTypes = datasetDe<typeof crewTestTypesDef>(crewTestTypesJson).types;
const testEquipageParId = indexParId('crewTestTypes', crewTestTypes);
export const findCrewTestTypeById: (id: string) => CrewTestTypeData | undefined = testEquipageParId;
/** Groupes d'objet app-owned (taxonomie `subType` id-ifiée) — éditable au Codex. */
export const weaponGroups = datasetDe<typeof weaponGroupsDef>(weaponGroupsJson);
export const groups = datasetDe<typeof groupsDef>(groupsJson);
// Bestiaire APP-OWNED — TOUT dans `creatures.json` ; chaque entrée garde sa vraie `source`.
export const creatures = creaturesJson as CreatureData[];
// Sorts app-owned (Magie Mineure/Arcanes, Bénédictions, Miracles…) — TOUT dans `spells.json` ; chaque sort
// garde sa vraie `source`.
export const spells = spellsJson as SpellData[];
/** Manœuvres app-owned (attaques naturelles activées — LDB 85) : ENTITÉ de 1ʳᵉ classe éditable au Codex,
 *  effets en GameOp. Octroyées aux créatures via `TraitData.grantsManeuvers` ; résolues par id. */
export const maneuvers = maneuversJson as ManeuverDef[];
/** Niveaux de lumière ambiante app-owned (brouillard de guerre) : `scalar` 0..1 (assombrissement du
 *  rendu) + `baseSightTiles` (rayon de vue de base en cases — réglage MAISON : le LDB ne stat pas la
 *  portée de vue). Édité au Codex. `Scene.ambientLight` réfère un `id` (ou `auto` = suit l'horloge). */
export type LightLevelDef = EntreeDe<typeof lightLevelsDef>;
export const lightLevels = datasetDe<typeof lightLevelsDef>(lightLevelsJson);
const niveauLumiereParId = indexParId('lightLevels', lightLevels);
export const findLightLevelById: (id: string) => LightLevelDef | undefined = niveauLumiereParId;
/** TON de lumière app-owned (#1245, L4) : l'APPARENCE d'une source PONCTUELLE — couleur, part
 *  d'intensité (facteur du calage anti-saturation du rendu, jamais une intensité absolue) et
 *  vacillement optionnel. Aucune conséquence de règle : le moteur ne connaît d'une source que son
 *  RAYON (LDB 74). Référencé par `tone` (prop, instance de scène, op `light`, `ActiveEffect.light`) ;
 *  absent = `flamme`. Résolu au bord du RENDU. */
export type LightToneDef = EntreeDe<typeof lightTonesDef>;
export const lightTones = datasetDe<typeof lightTonesDef>(lightTonesJson);
/** Lookup LIVE par BALAYAGE, et non par `indexParId` : à QUATRE entrées, l'index ne rachète pas son
 *  coût — même choix MESURÉ que `matieresDe` (`+4,1 ms` contre un index sur 18 026 lookups, #1686 lot
 *  3a-1, cf. `findPropMaterialById` ci-dessous). Le balayage est vivant par construction : le catalogue
 *  se mute EN PLACE (`data/overrides.ts`). */
export const findLightToneById = (id: string): LightToneDef | undefined => lightTones.find((t) => t.id === id);
/** Ton SERVI à une source qui n'en nomme aucun — le feu, le cas du monde (brasero, feu de camp). */
export const DEFAULT_LIGHT_TONE_ID = 'flamme';
/** RENDU d'un coup, d'une incantation ou d'une zone d'effet (#3771, #3783) : couleur, et par phase (départ, impact,
 *  manque, parade, zone) le visuel que l'hôte dessine et le son du registre (`sons/defs`) ; le projectile, sa vitesse et
 *  sa cloche. Référencé par `rendu` (Groupe d'arme, objet, Domaine, Type de Souffle, manœuvre). Aucune conséquence de
 *  règle. Résolu par `effetsDeLAppel` (`src/noyau/effetsDeLAppel.ts`). */
export type RenduDef = EntreeDe<typeof rendusDef>;
export type { VisuelDEffet, Projectile } from './schemas/defs/rendus';
export type { VisuelDeLumiere } from './schemas/defs/lightTones';
export const rendus = datasetDe<typeof rendusDef>(rendusJson);
export const findRenduById = indexParId('rendus', rendus);
/** Contrats NEUTRES du décor (type de prop, recette volumique, matériaux, places assises) — définis
 *  hors du chargeur pour rester importables sans lui (cf. `props.types.ts`). */
export type { PropData, PropMaterialData, PropMaterialId, PropPoint3, PropSize3, PropPrimitive, PropVolumeRecipe, PropSeatSlot } from './props.types';
export { validatePropCatalog } from './props.types';
export const props = propsJson as PropData[];
/** Type de décor par id — `undefined` en entrée rend `undefined` : une entité qui ne NOMME aucun type
 *  n'en résout aucun, exactement comme une ref hors registre (#877). */
export const findPropById = indexParId('props', props);
/** Un type de décor rend-il en VOLUME (recette authorée) plutôt qu'en billboard ? La sous-liste du
 *  marqueur `volume` (`defs/props.ts`), la MÊME que lit le schéma de scène (`defs-scenes/scene.ts`) :
 *  l'émetteur de décor et l'inspecteur la lisent ici. `ref` absente =
 *  aucun type résolu, donc aucun volume : la même absence qu'une ref hors registre (#877). */
const decorVolumique = porteLeMarqueur('prop', 'volume');
export const refEstVolumique = (ref: string | undefined): boolean => ref !== undefined && decorVolumique(ref);
/** Matière de rendu d'une recette volumique de décor, par id — lecture VIVANTE du document (`matieresDe`),
 *  jamais un index cuit au chargement. Unicité des ids sur tout le périmètre des matières (#1686). */
export const findPropMaterialById = (id: string): PropMaterialData | undefined => matieresDe('prop').find((m) => m.id === id);
/** Teinte d’objet par id — lecture vivante du catalogue, absence si l’id est inconnu. */
export const findTeinteById = (id: string | undefined): TeinteDObjet | undefined => matieresDe('objet').find((m) => m.id === id);
/** Couleur nommée du nuancier, par id — lecture VIVANTE du document (`matieresDe`). */
export const findCouleurById = (id: string): CouleurNommee | undefined => matieresDe('couleur').find((m) => m.id === id);
/** Domaines de magie app-owned (LDB 48) — ENTITÉ éditable au Codex (attributs en données : onHit,
 *  projectile, post-incantation). Le RUNTIME résout par `id` STABLE (= `SpellData.domainId.id`, cf.
 *  `findDomainById`). */
export const domains = domainsJson as DomainData[];
/** Index des Domaines par `id` STABLE — lookup RUNTIME indépendant de la langue (sort→domaine). */
const domaineParId = indexParId('domains', domains);
export const findDomainById: (id: string | null | undefined) => DomainData | undefined = domaineParId;
/** Index des Domaines par `wind` (Vent de Magie) — résout un Vent (Ghur, Aqshy, Dhar…) vers son Domaine.
 *  SOURCE de la Compétence Focalisation (spécialisée par Vent) : un `focalisation.spec` porte l'id du
 *  Domaine et AFFICHE le Vent ; ce lookup fait l'inverse (authoring/migration Vent → id). */
const domaineParVent = indexParChamp('domains', domains, (d) => d.wind);
export const findDomainByWind: (wind: string | null | undefined) => DomainData | undefined = domaineParVent;
/** Un axe du catalogue `axes.json` (#409) — vue TS de son schéma zod. */
export type AxisData = EntreeDe<typeof axesDef>;
/** Catalogue des axes de forces/faiblesses (mécanique MAISON, #409) : socle de base (`core`) +
 *  exemples de scénario (négoce/ingénierie/navigation). `derivation` liste des ids STABLES de
 *  `skills.json`/`talents.json` — résolus par `axisScore` (`src/engine/axes.ts`). Intégrité des ids
 *  vérifiée par `axes-integrity.test.ts` (patron `book-source-integrity.test.ts`). */
export const allAxes = datasetDe<typeof axesDef>(axesJson);
const axeParId = indexParId('axes', allAxes);
export const findAxisById: (id: string) => AxisData | undefined = axeParId;
/** Socle par défaut d'une campagne SANS `activeAxes` déclaré (`WorldMap.activeAxes`). */
export const coreAxisIds = memoParVersion('axes', (): string[] => allAxes.filter((a) => a.core).map((a) => a.id));
/** Le Tableau de couleur des yeux (`eyes.json`, LDB 05 l.742-754), document à rangées tiré à son dé. */
export const tableDesYeux = datasetDe<typeof couleurDesYeux>(eyesJson);
/** Le Tableau de couleur des cheveux (`hairs.json`, LDB 05 l.756-768), document à rangées tiré à son dé. */
export const tableDesCheveux = datasetDe<typeof couleurDesCheveux>(hairsJson);
/** Les rangées du Tableau de couleur des yeux. */
export const eyes = rangeesDe<typeof couleurDesYeux>(tableDesYeux);
/** Les rangées du Tableau de couleur des cheveux. */
export const hairs = rangeesDe<typeof couleurDesCheveux>(tableDesCheveux);
/** Le dé du Tableau de couleur des yeux, lu à l'appel. */
export const eyesDie = (): DeDeTable => deDeTirageDe<typeof couleurDesYeux>(tableDesYeux);
/** Le dé du Tableau de couleur des cheveux, lu à l'appel. */
export const hairsDie = (): DeDeTable => deDeTirageDe<typeof couleurDesCheveux>(tableDesCheveux);
/** Calendrier impérial — tables de CONTENU éditables au Codex (cf. `engine/clock.ts` pour la mécanique). */
export const calendarMonths = datasetDe<typeof calendarMonthsDef>(calendarMonthsJson);
export const calendarIntercalary = datasetDe<typeof calendarIntercalaryDef>(calendarIntercalaryJson);
export const calendarWeekdays = datasetDe<typeof calendarWeekdaysDef>(calendarWeekdaysJson);
export const calendarPhases = datasetDe<typeof calendarPhasesDef>(calendarPhasesJson);
/** Table de Météo de voyage TERRESTRE (EDOC 8). `seasons` = plages du dé `die` → météo par saison ;
 *  `conditions` = EFFETS par météo (mêmes formes de donnée que `sea-weather.json`). Éditable au Codex. */
const weatherData = datasetDe<typeof weatherDef>(weatherJson);
/** 1 entrée par saison, `entries` = plages de son dé `die` → météo (lecture par `weatherFromRoll`, `weatherDie`). */
export const weather = weatherData.seasons;
/**
 * Libellé d'affichage d'une SAISON (`Season`, `src/engine/travelStages.ts`) — SOURCE UNIQUE, keyée par
 * l'id STABLE : le nom FR vit dans la donnée éditable (`weather.json › seasons[].label`), jamais en
 * table d'écran. Même patron que `specLabel`/`refLabel` ci-dessous. Une saison sans fiche météo n'a
 * pas de nom à afficher : elle est NOMMÉE par sa clé plutôt que passée sous silence.
 */
export function seasonLabel(id: string): PlayerText {
  return libelleOuAbsence(saisonParId(id), 'saison', id);
}

/** Nature d'une entité dont l'ABSENCE est atteignable en jeu (#1906) : héros sorti du groupe, combattant
 *  sorti du combat, lieu effacé de la carte, navire retiré du catalogue, saison sans fiche météo. */
export type NatureAbsente = 'heros' | 'combattant' | 'lieu' | 'navire' | 'saison' | 'mois' | 'race' | 'carriere' | 'classe';
/** Le libellé d'une entité résolue, ou son ABSENCE nommée en français de joueur par sa nature (#1906) —
 *  jamais un littéral qui la masque. Une absence IMPOSSIBLE ne passe pas ici : elle lève. */
export function libelleOuAbsence(e: { label: string } | undefined, nature: NatureAbsente, id: string): PlayerText {
  return e ? dataLabel(e.label) : t(`absent.${nature}`, { id });
}
/** Effets par météo (visibilité, mods de tir, poudre, Tests physiques, plafond de mouvement…). */
export const weatherConditions = weatherData.conditions;
/** Caractéristiques réputées « physiques » (liste MAISON, EDOC 8 l.82 non chiffrée), lues à l'appel. */
export const weatherPhysicalTestChars = (): CharKey[] => weatherData.physicalTestChars;
/** Jets d'Âge/Taille (LDB 05 l.705-728), un `DiceSpec` par colonne `RaceKey` (#313) — + textes
 *  d'aide (conventions de noms, espérance de vie, tailles moyennes, Ambitions). */
export const details = datasetDe<typeof detailsDef>(detailsJson);
/** Texte d'aide LDB 05 (« Détails ») : global + surcharges par espèce (clé `RaceKey`, #1467 L1b V-P4). */
export type DetailText = DatasetDe<typeof detailsDef>['texts']['nom'];
/** Semences d'une scène NEUVE (#1716) — lues par `emptyScene` (`noyau/monde/scene.ts`), éditables au Codex. */
export const semencesDeScene = datasetDe<typeof semencesDeSceneDef>(semencesDeSceneJson);
/** Défauts du COMPILATEUR de scène (#1716) — lus par `mapSpec.ts`/`buildBoardingScene`, éditables au Codex. */
export const defautsDeCompilation = datasetDe<typeof defautsDeCompilationDef>(defautsDeCompilationJson);
/** Les rangées du Tableau des Signes astrologiques (`stars.json`). */
export const stars = rangeesDe<typeof signesAstrologiques>(starsJson) as StarData[];
/** Le dé du Tableau des Signes astrologiques, lu à l'appel. */
export const starDie = (): DeDeTable => deDeTirageDe<typeof signesAstrologiques>(starsJson);
/** Le dé qui départage les variantes d'un même seuil (`StarData.sub`), lu à l'appel. */
export const starSubDie = (): DeDeTable => deDeLaTableTiree(starsJson.sub);
/** Les 5 demeures célestes (ADE II 3 l.502-512, « Déterminer les demeures célestes ») — ossature
 *  narrative du thème astral (flavor pur, aucun effet mécanique). `rand` = borne haute de sa bande imprimée (l.504-512). */
export const celestialHouses = datasetDe<typeof astrologyDef>(astrologyJson);
/** Apparences d'espèce (app-owned, éditable) — lues par le Codex (`noyau/codex/registry.ts`), la
 *  composition (`noyau/apparence/composition.ts`) et `scripts/personnage-3d/base/`. */
export const raceAppearance = raceAppearanceJson as RaceAppearanceData[];
/** Le plan de bestiaire (`planDeBestiaire.json`, #2993) : lu par la composition d'un combattant
 *  (`noyau/apparence/combattant.ts`) et par `scripts/personnage-3d/base/`. */
export const planDeBestiaire = datasetDe<typeof planDeBestiaireDef>(planDeBestiaireJson);
export const findPlanDEspeceById = indexParId('planDeBestiaire', planDeBestiaire);
export type { GabaritId, SurchargeDeGabarit } from './schemas/defs/gabarits';
/** Carrures (`gabarits.json`, #2972), résolues par `src/noyau/apparence/gabarit.ts`. */
export const gabarits = datasetDe<typeof gabaritsDef>(gabaritsJson);
export const findGabaritById = indexParId('gabarits', gabarits);
/** Garde-robe des éléments 3D (`garde-robe.json`, #3114, #3113, #3111, #3116) : têtes, coiffures, tenues, emplacements, pièces, ensembles, emblèmes, variantes. */
export const gardeRobe = datasetDe<typeof gardeRobeDef>(gardeRobeJson);
/** Une ligne de la garde-robe. */
type EntreeDeGardeRobe = EntreeDe<typeof gardeRobeDef>;
/** Une ligne de la garde-robe, de nature `K`. */
export type LigneDeGardeRobe<K extends EntreeDeGardeRobe['kind'] = EntreeDeGardeRobe['kind']> = Extract<EntreeDeGardeRobe, { kind: K }>;
/** Lecteur d'une nature de la garde-robe par id ; une ligne d'une autre nature n'en est pas une. */
const parNature = <K extends LigneDeGardeRobe['kind']>(kind: K) => {
  const idx = indexParChamp<LigneDeGardeRobe, string>('gardeRobe', gardeRobe, (e) => (e.kind === kind ? e.id : undefined));
  return (id: string | null | undefined) => idx(id) as LigneDeGardeRobe<K> | undefined;
};
export const findPieceById = parNature('piece');
export const findEmblemeById = parNature('embleme');
export const findTeteById = parNature('tete');
export const findCoiffureById = parNature('coiffure');
export const findVarianteById = parNature('variante');
const ensembleParHabille = indexParChamp<LigneDeGardeRobe, string>('gardeRobe', gardeRobe, (e) => (e.kind === 'ensemble' ? cleDHabille(e.habille) : undefined));
/** L'ensemble qui habille `habille` (égalité de `{ id, type }`), `undefined` si la garde-robe n'en déclare pas. */
export const findEnsembleParHabille = (habille: HabilleDEnsemble): LigneDeGardeRobe<'ensemble'> | undefined => {
  const ensemble = ensembleParHabille(cleDHabille(habille));
  return ensemble?.kind === 'ensemble' ? ensemble : undefined;
};
/** Les pièces d'armure qui couvrent une des localisations `locs` (`localisations`, #3456), dans l'ordre de la garde-robe. */
export const piecesCouvrant = (locs: readonly HitLocation[]): PieceId[] =>
  gardeRobe.flatMap((e) => (e.kind === 'piece' && e.localisations?.some((l) => locs.includes(l)) ? [e.id] : []));
/** Les pièces que revêt un objet porté : celles de l'ensemble qui habille son trapping `trappingId`, à défaut celles qui
 *  couvrent ses localisations, `locs`, à défaut celles de son trapping (`localisationsDeLoc`). #3456 */
export function piecesDeLObjet(trappingId: string | undefined, locs?: readonly HitLocation[]): readonly (PieceId | Id<'gardeRobe'>)[] {
  const ensemble = trappingId === undefined ? undefined : findEnsembleParHabille({ type: 'trapping', id: trappingId });
  return ensemble?.pieces ?? piecesCouvrant(locs ?? localisationsDeLoc(findTrappingById(trappingId)?.loc));
}
/** La tenue de la garde-robe dont `carriere` est une des `carrieres` (#3456), `undefined` sinon. */
export const findTenueDeCarriere = (carriere: string | null | undefined): LigneDeGardeRobe<'tenue'> | undefined =>
  gardeRobe.find((e): e is LigneDeGardeRobe<'tenue'> => e.kind === 'tenue' && carriere != null && (e.carrieres ?? []).some((c) => c === carriere));
/** Presets de personnage entier (`presets-de-personnage.json`, #3086). */
export const presetsDePersonnage = presetsDePersonnageJson as unknown as PresetDePersonnage[];
export const findPresetDePersonnageById = indexParId('presetsDePersonnage', presetsDePersonnage);
export const locations = datasetDe<typeof locationsDef>(locationsJson);
const lieuParId = indexParId('locations', locations);
/** Résout un Lieu par son `id` STABLE (cible de `LocationData.parent`). Le libellé ne sert qu'à l'affichage. */
export function findLocationById(id: string | null | undefined): LocationData | undefined {
  return lieuParId(id);
}
export { books };
const livreParId = indexParId('books', books);
/** Résout un Livre par son `id` STABLE (cible de `source.book`) — `abbr`/`label` ne servent qu'à l'affichage. */
export function findBookById(id: string | null | undefined): BookData | undefined {
  return livreParId(id);
}
/** Libellé d'AFFICHAGE d'une réf de source (« Archives de l'Empire II p. 41 ») : titre du livre résolu
 *  par son `id` (l'id si inconnu), puis la page. */
export function sourceRefLabel(ref: Pick<SourceRef, 'book' | 'page'>): PlayerText {
  return t('ref.sourcePage', { livre: dataLabel(livreParId(ref.book)?.label, ref.book), page: ref.page });
}
/** Acronyme d'un livre depuis l'`id` porté par `source.book` (fallback = l'id si inconnu). */
export function bookAbr(id: string | null | undefined): PlayerText {
  return dataLabel(id ? livreParId(id)?.abbr : '', id ?? '');
}
/** Le libellé d'AUTHORING d'une entrée : son libellé marqué du sigle de son livre (forme de `bookMarker.ts`, « Baliste
 *  (AA) »), qui distingue deux entrées homonymes de livres différents ; jamais rendu au joueur. */
export function libelleDAuteur(entree: { readonly label: string; readonly source?: { readonly book: string } | undefined }): PlayerText {
  return dataLabel(entree.source ? `${entree.label} (${bookAbr(entree.source.book)})` : entree.label);
}
/** Culte/Dieu (LDB 41) : `id` = slug STABLE (« sigmar »), `label` = nom affiché (« Sigmar »), Bénédictions/
 *  Miracles en ids de sort, desc = lore en Markdown (Codex). Dataset éditable (Compendium). */
export type GodData = EntreeDe<typeof godsDef>;
export const gods = datasetDe<typeof godsDef>(godsJson);
/** Banques de noms — UN document par race jouable, d'`id` égal à son `RaceKey` (celui de
 *  `species.refChar`) : `engine/names` retrouve la banque par cet id (#1467 L1b V-FLIP-RECORD). */
export const names = datasetDe<typeof namesDef>(namesJson);
/** Prétirés officiels (fiches imprimées) — éditables au Codex ; la FABRIQUE (`heroDeFiche`)
 *  vit dans `pregens.ts`, qui consomme CE tableau (même référence → mutation live de l'éditeur). */
export const pregens = pregensJson as unknown as PregenDef[];
/** Tableau des Oups ! (LDB Maladresses) — app-owned éditable ; consommé par `oups.ts` (même référence). */
export const oups = rangeesDe<typeof tableauDesOups>(oupsJson);
/** Les documents du Tableau des Talents aléatoires (LDB 05 l.514-531), patron `mutationTables` : le dé est
 *  un champ de l'entrée-document — app-owned éditable au Codex (`setDataset`), même référence. */
export const talentsAleatoires = datasetDe<typeof tableDesTalentsAleatoires>(talentsAleatoiresJson);
/** Les rangées du Tableau des Talents aléatoires, lues à l'appel : tirées par `rollRandomTalent` (`engine/character.ts`). */
export const rangeesDesTalentsAleatoires = (): RangeeDe<typeof tableDesTalentsAleatoires>[] =>
  rangeesDe<typeof tableDesTalentsAleatoires>(talentsAleatoires, 'talents-aleatoires');
/** Le dé du Tableau des Talents aléatoires, lu à l'appel. */
export const talentsAleatoiresDie = (): DeDeTable => deDeTirageDe<typeof tableDesTalentsAleatoires>(talentsAleatoires, 'talents-aleatoires');
/** Les documents du Tableau des Classes et Carrières aléatoires (LDB 05 l.214-299), par `kind` : une colonne
 *  par colonne imprimée, les portions (MDG 09 l.9) et les variantes (AA 02 l.109-128) — app-owned éditable au
 *  Codex (`setDataset`), même référence. */
export const carrieresAleatoires = datasetDe<typeof tableDesCarrieresAleatoires>(carrieresAleatoiresJson);
/** La colonne de base `id`, lue à l'appel. */
export const colonneDeCarrieres = (id: string) =>
  garanti(carrieresAleatoires.find((d) => d.id === id && d.kind === 'colonne'), id, 'colonne du Tableau des Classes et Carrières aléatoires');
/** La portion qui remplace une étendue de la colonne `colonne` (MDG 09 l.9), lue à l'appel. */
export const portionDeLaColonne = (colonne: string) => carrieresAleatoires.find((d) => d.kind === 'portion' && d.colonne === colonne);
/** La table effective de la colonne `colonne`, avec ou sans sa portion, et son dé : lue par `rollCareer`. */
export function tableDeCarrieres(colonne: string, avecPortion: boolean): { die: DeDeTable; entries: RangeeDe<typeof tableDesCarrieresAleatoires>[] } {
  const base = colonneDeCarrieres(colonne);
  return { die: deDeLaTableTiree(base), entries: tableAvecPortion(base.entries, avecPortion ? portionDeLaColonne(colonne)?.entries : undefined) };
}
/** Les carrières que le tirage de `tiree` offre en plus à l'espèce `sp`, admises à sa race (`races`) : celles qui
 *  se choisissent à sa place (`aLaPlaceDe`, ADE I 07 l.11-23), puis celles de sa variante portée par la colonne
 *  de `sp` (AA 02 l.109-128). */
export function carrieresOffertesAvec(tiree: string, sp: SpeciesData): string[] {
  const admise = (c: CareerData | undefined) => c?.races?.includes(sp.refChar) === true;
  const substitutions = careers.filter((c) => c.aLaPlaceDe === tiree && admise(c)).map((c) => c.id);
  const variante = carrieresAleatoires.find((d) => d.kind === 'variante' && d.carriere === tiree && d.colonnes?.some((c) => c === sp.refCareer));
  const variantes = (variante?.entries ?? []).map((r) => r.id).filter((id) => id !== tiree && admise(findCareerById(id)));
  return [...substitutions, ...variantes];
}
/** Les documents du Tableau des Races aléatoires, un par table imprimée (LDB 04 l.93-101 ; NADJ 14 l.66-75 ;
 *  ADE II 02 l.112-121), chaque rangée l'espèce nominale de sa race — app-owned éditable au Codex (`setDataset`),
 *  même référence. */
export const especesAleatoires = datasetDe<typeof tableauDesRacesAleatoires>(especesAleatoiresJson);
/** La seule table du Tableau des Races aléatoires dont les races des rangées égalent `races`, lue à l'appel. */
export function tableDesRacesAleatoires(races: ReadonlySet<RaceKey>): (typeof especesAleatoires)[number] {
  const racesDe = (t: (typeof especesAleatoires)[number]) => new Set(t.entries.map((r) => garanti(findSpeciesById(r.id), r.id, 'espèce du Tableau des Races aléatoires').refChar));
  const tables = especesAleatoires.filter((t) => {
    const r = racesDe(t);
    return r.size === races.size && [...races].every((x) => r.has(x));
  });
  return garanti(tables.length === 1 ? tables[0] : undefined, [...races].join(', '), `table unique du Tableau des Races aléatoires (${tables.length} trouvée(s)) pour les races`);
}
/** Les documents du tableau corps ou esprit de la mutation, un par race (LDB 19 l.76-81 ; ADE II 02 l.172-177 ;
 *  NADJ 15 l.173) — app-owned éditable au Codex (`setDataset`), même référence ; chaque rangée tire l'une des deux
 *  natures (`affinerDataset` de `schemas/defs/mutation-nature.ts`). */
export const mutationNature = datasetDe<typeof tableauDeLaNatureDeMutation>(mutationNatureJson);
/** Le document de la race d'une espèce (`id` STABLE, ou clé de race d'apparence que porte un PNJ), lu à
 *  l'appel ; sans race couverte, celui de la race `humain`. LDB 19 l.76-81 */
export function natureDeMutationDe(speciesId: string | undefined): (typeof mutationNature)[number] {
  const race = findSpeciesById(speciesId)?.refChar ?? speciesId;
  const doc = mutationNature.find((d) => d.race === race) ?? mutationNature.find((d) => d.race === 'humain');
  return garanti(doc, race ?? 'humain', 'document de la nature de la mutation pour la race');
}
/** Les documents du Tableau des cargaisons, un par voie et colonne saisonnière (MDG 15 l.404-418 ; MSRC 13
 *  l.69-78) — app-owned éditable au Codex (`setDataset`), même référence. */
export const cargaisonsAleatoires = datasetDe<typeof tableauDesCargaisons>(cargaisonsAleatoiresJson);
/** Événements « Entre deux aventures » (LDB d100) — app-owned éditable ; consommé par `interludeEvents.ts`. */
export const interludeEvents = rangeesDe<typeof tableauDesEvenements>(interludeEventsJson);
/** Péripéties de voyage (1d10) — app-owned éditable ; consommé par `peripeties.ts` (même référence). */
export const peripeties = rangeesDe<typeof tableDesPeripeties>(peripetiesJson);

/** Réseau routier impérial (EDOC 3 « Les routes et grandes routes » et EDOC 6 « Patrouilleurs
 *  routiers ») — catalogue de CALIBRATION d'une `MapRoute` : classes de route et leurs largeurs,
 *  espacement des auberges relais, compagnies de diligences nommées, tarif et espacement des postes
 *  de péage, effectifs de patrouille. Aucun de ces champs n'étend le vocabulaire de `MapRoute` : ils
 *  se posent sur `inns`/`billets`/`speed`/`km` à l'authoring de carte. */
export type ReseauRoutierData = EntreeDe<typeof reseauRoutierDef>;
export const reseauRoutier = datasetDe<typeof reseauRoutierDef>(reseauRoutierJson);
const reseauRoutierById = new Map<string, ReseauRoutierData>(reseauRoutier.map((r) => [r.id, r]));
/** Résout une entrée du réseau routier par son `id` STABLE. */
export function findReseauRoutierById(id: string): ReseauRoutierData | undefined {
  return reseauRoutierById.get(id);
}

const etatParId = indexParId('etats', etats);
/** Résout un État par son `id` STABLE (`ConditionId`). */
export function findConditionById(id: string): EtatData | undefined {
  return etatParId(id);
}

/** États PSYCHOLOGIQUES (LDB 21) — base app-owned éditable au Codex, prose ADRESSÉE au `Source/`
 *  (`descRef`, #1389 : première famille migrée). */
export const psychologies = adressee<PsychologyData>(psychologyJson);
const psychologieParId = indexParId('psychologies', psychologies);
/** Résout un état psychologique par son `id` STABLE (`PsychType`). Absent → undefined (folding inerte). */
export function findPsychologyById(id: string): PsychologyData | undefined {
  return psychologieParId(id);
}
/** Libellé d'affichage d'un État par son id (repli sur l'id). SOURCE UNIQUE du nom d'État affiché. */
export function conditionLabel(id: string): PlayerText {
  return dataLabel(etatParId(id)?.label, id);
}
/** Libellé d'affichage de la table des Critiques de Structure (rangée de tirage `TableRollLine`), lu VIVANT à l'appel. */
export const structureCriticalsLabel = (): PlayerText => dataLabel(structureCriticalsJson.label);
/** Libellé d'affichage d'un état psychologique par son `id` (`PsychType`), repli sur l'id — délègue au
 *  résolveur de libellé GÉNÉRIQUE (`refLabel`), jamais une copie locale du motif `MAP.get(id)?.label ?? id`. */
export function psychologyLabel(id: string): PlayerText {
  return refLabel('psychologies', { id });
}
/** ids d'États du catalogue, dans l'ordre du dataset — vue VIVANTE (`memoParVersion`), reconstruite
 *  après une édition au Codex. Consommée par le scan du journal (`engine/conditions.conditionIdInText`)
 *  qui itère des ids et n'obtient le libellé que pour le chercher dans un texte FRANÇAIS. */
export const conditionIds = memoParVersion('etats', () => etats.map((e) => e.id));
const especeParId = indexParId('species', species);
/** Résout une Espèce par son `id` STABLE (slug du libellé) — réf runtime/données (Combatant.species,
 *  pregens, draft). Le libellé ne sert qu'à l'affichage. */
export function findSpeciesById(id: string | undefined): SpeciesData | undefined {
  return especeParId(id);
}
/** Les profils standard (`LDB 77 l.7`) : les fiches que `species.json` désigne par `profilStandard`,
 *  sans doublon, dans l'ordre du dataset. */
export function profilsStandard(): string[] {
  return [...new Set(species.flatMap((s) => (s.profilStandard ? [s.profilStandard.id] : [])))];
}
/** Le véhicule `id` d'un PERSONNAGE (sa clé `vehicule`) est-il un navire à ponts (`vehicles.json › ponts`, #3686) ? Ses
 *  ponts ne se posent qu'à un cap cardinal : le schéma de scène refuse les autres (`refusDeLEntite`), l'éditeur ne les
 *  offre pas (`capsOfferts`). */
export const estUnNavireAPonts = (id: string | undefined): boolean => id !== undefined && findVehicleById(id)?.ponts !== undefined;
/** La fiche spawnable non créature que désigne `id` : coque de `vehicles.json` (facette `hull`, MDG 13) ou engin du
 *  sous-type `armes-de-siege` (`trappings.json`, AA 10), réduite à son libellé et sa source ; la clé `definition` d'un élément 3D
 *  `vehicule` la nomme (#2987). */
export function findFicheDeVehicule(id: string): { readonly label: string; readonly source: { readonly book: string } | undefined } | undefined {
  const coque = findVehicleById(id);
  const fiche = (coque?.hull ? coque : undefined) ?? siegeEngines().find((t) => t.id === id);
  return fiche && { label: fiche.label, source: fiche.source };
}
/**
 * Ce qu'un pinceau ou un effet neuf porte AVANT tout choix d'auteur : le PREMIER élément OFFERT par son
 * catalogue (#877, #1882). Un catalogue VIDE n'a PAS de défaut : l'appelant le DIT, jamais un littéral.
 */
export const premierOffert = (catalogue: readonly { id: string }[], quoi: string): string => {
  const premier = catalogue[0];
  if (!premier) throw new Error(`${quoi} : le catalogue est VIDE — l’outil n’a plus de pinceau dérivable.`);
  return premier.id;
};
/** Ce qu'un effet NEUF sème avant tout choix d'auteur (`givePossession`, `startPursuit`, `setVessel`). */
export const creatureSemee = (): string => premierOffert(creatures, 'Créature semée par un effet neuf');
export const vehiculeSeme = (): string => premierOffert(vehicles, 'Véhicule semé par un effet neuf');
export const navireSeme = (): string => premierOffert(vehicles.filter((v) => v.ship), 'Navire semé par un effet neuf');
/** La Taille que porte un Talent du catalogue (`TalentData.size`) : la lecture que les primitives de Taille
 *  de `engine/size.ts` (`sizeFromTalents`, `sizeFromProfile`) reçoivent injectée. */
export const tailleDuTalent = (talentId: string): import('../engine/size').SizeCategory | undefined => findTalentById(talentId)?.size;

/** Taille d'un PROFIL (créature, statbloc) : son `size` explicite, sinon ses Traits puis ses Talents du
 *  catalogue (`sizeFromProfile`), sinon Moyenne — la lecture UNIQUE des sites qui dérivent la Taille d'un profil. */
export function tailleDuProfil(p: {
  readonly size?: import('../engine/size').SizeCategory;
  readonly traits?: Parameters<typeof sizeFromProfile>[0];
  readonly talents?: Parameters<typeof sizeFromProfile>[1];
}): import('../engine/size').SizeCategory {
  return p.size ?? sizeFromProfile(p.traits, p.talents, tailleDuTalent) ?? 'moyenne';
}

/** Taille CONFÉRÉE par les talents d'espèce FIXES (une référence ARRÊTÉE, jamais un `{pick}`, un
 *  `{random}` ni un `choix` résiduels — chip décoratif du créateur avant résolution complète, #572) :
 *  `sizeFromTalents` (engine/size.ts), sinon Moyenne. */
export function speciesSize(sp: SpeciesData): import('../engine/size').SizeCategory {
  const ids = sp.talents.filter((t): t is RefDesignee => 'id' in t && t.choix == null).map((t) => t.id);
  return sizeFromTalents(ids, tailleDuTalent) ?? 'moyenne';
}
/** Tailles DISTINCTES (`speciesSize`) des espèces d'une race d'apparence, jointes par `species.refChar`
 *  (`names-species-keyspaces.test.ts`) : une seule est la Taille de la race ; aucune ou plusieurs, elle est indéterminée. */
export function taillesDeLaRace(race: string): import('../engine/size').SizeCategory[] {
  return [...new Set(species.filter((sp) => sp.refChar === race).map(speciesSize))];
}
/** Espèce d'apparence par DÉFAUT, entrée du plan de bestiaire déclarée en donnée (`speciesRace.json` `default`). */
export const DEFAULT_RACE_ID: string = datasetDe<typeof speciesRaceDef>(speciesRaceJson).default.id;
/** Espèce d'APPARENCE (clé `appearance.species`) d'un id d'espèce RULES : l'id passe tel quel ; sans
 *  argument, `DEFAULT_RACE_ID`.
 *  Pont UNIQUE règles→apparence (pregens/draft/creator/defaultAppearance). */
export function especeDApparence(rulesId: string | undefined): EspeceDApparence {
  return (rulesId ?? DEFAULT_RACE_ID) as EspeceDApparence;
}

/** Affichage SINGULIER de l'espèce d'un INDIVIDU (« Humain (Reiklander) ») : les `label` du catalogue
 *  nomment une CATÉGORIE au pluriel, un personnage est un individu (B1). Lu sur la STRUCTURE de l'espèce :
 *  le nom singulier de sa race (`refChar`) au catalogue `espece.individu.*`, et sa `variant` en donnée. */
export function speciesSingular(speciesId: string | undefined): PlayerText {
  if (!speciesId) return dataLabel('');
  const sp = findSpeciesById(speciesId);
  if (!sp) return libelleOuAbsence(undefined, 'race', speciesId);
  const race = t(`espece.individu.${sp.refChar}`);
  return sp.variant ? dataLabel(`${race} (${sp.variant})`) : race;
}
/** Les carrières que le tirage de `sp` peut offrir sur sa table effective (`tableDeCarrieres`), avec ou sans sa
 *  portion : les rangées, et ce que leur tirage offre en plus (`carrieresOffertesAvec`). */
export function carrieresTirables(sp: SpeciesData, avecPortion: boolean): CareerData[] {
  const ids = new Set(tableDeCarrieres(sp.refCareer, avecPortion).entries.flatMap((r) => [r.id, ...carrieresOffertesAvec(r.id, sp)]));
  return careers.filter((c) => ids.has(c.id));
}
/**
 * Carrières accessibles à une espèce (Tableau des Classes et Carrières aléatoires, LDB 05
 * l.197+, l.360) : celles que son tirage offre, avec ou sans le remplacement (`carrieresTirables`).
 * `ignoreRestrictions` = LDB 05 l.314-316.
 */
export function careersForSpecies(sp: SpeciesData, ignoreRestrictions = false): CareerData[] {
  if (ignoreRestrictions) return careers;
  const ids = new Set([false, true].flatMap((avecPortion) => carrieresTirables(sp, avecPortion).map((c) => c.id)));
  return careers.filter((c) => ids.has(c.id));
}
const carriereParId = indexParId('careers', careers);
/** Résout une Carrière par son `id` STABLE. Le libellé ne sert qu'à l'affichage. */
export function findCareerById(id: string | undefined): CareerData | undefined {
  return carriereParId(id);
}
/**
 * Libellé GÉNÉRIQUE d'une entrée de dataset : le `CodexItem.label` du registre du Codex, et le nom
 * courant de l'entrée éditée à l'atelier, qui la refuse vide (`validateEntry`). Précédence
 * `label → id`. Mesuré sur les 2 racines (`src/data`, `src/scenes`) : aucune entrée de premier niveau
 * ne porte `key` ni `name` (#1467 L1b V-P1).
 * EXCEPTION careerLevels : le libellé de niveau (« Recrue ») revient sur plusieurs carrières et
 * n'identifie rien seul → composite carrière + niveau.
 */
export function entryKey(e: Record<string, unknown>): PlayerText {
  const carriere = estObjet(e.career) ? e.career.id : undefined;
  if (typeof carriere === 'string' && typeof e.level === 'number')
    return dataLabel(`${findCareerById(carriere)?.label ?? carriere} · N${e.level} ${e.label ?? ''}`.trim());
  return dataLabel(String(e.label ?? e.id ?? ''));
}
/** Choix d'AFFICHAGE masculin/féminin (source unique) : `labelF` si sexe F et disponible, sinon
 *  `label`. Le sexe vit dans l'apparence cosmétique (`Combatant.appearance.sex`), jamais dans le moteur. */
export function displayLabelForSex(sex: Sexe | undefined, label: string, labelF?: string): PlayerText {
  return dataLabel(sex === 'F' && labelF ? labelF : label);
}
/** Ce qui porte le sexe d'un personnage : son apparence résolue (héros), celle que pose l'auteur (`appearanceOverride`),
 *  sa fiche du bestiaire. */
export interface PorteurDeSexe { readonly appearance?: { readonly sex?: Sexe }; readonly appearanceOverride?: { readonly sex?: Sexe }; readonly creatureId?: string }
/** LE sexe d'un personnage, source unique du nom, du corps et du libellé de Carrière (#3724) : celui de son apparence
 *  résolue, sinon celui que pose l'auteur, sinon celui de sa fiche du bestiaire. */
export function sexeDuPorteur(c: PorteurDeSexe): Sexe | undefined {
  return c.appearance?.sex ?? c.appearanceOverride?.sex ?? findCreatureById(c.creatureId)?.appearance?.sex;
}
/** Libellé de Carrière à AFFICHER pour un personnage (forme féminine si sexe F). Bord UI — le
 *  retour est du texte d'affichage, JAMAIS une clé. */
export function careerLabelFor(c: { career?: string } & PorteurDeSexe): PlayerText {
  const career = findCareerById(c.career);
  if (!career) return dataLabel(c.career);
  return displayLabelForSex(sexeDuPorteur(c), career.label, career.labelF);
}
const classeParId = indexParId('classes', classes);
/** Résout une Classe par son `id` STABLE (= `CareerData.class`). */
export function findClassById(id: string | undefined): ClassData | undefined {
  return classeParId(id);
}
/** Libellé de la Classe `id`, ou son absence nommée — SOURCE UNIQUE du libellé de Classe. */
export const libelleDeClasse = (id: string): PlayerText => libelleOuAbsence(findClassById(id), 'classe', id);
export function levelsForCareer(careerId: string): CareerLevelData[] {
  return careerLevels.filter((c) => c.career.id === careerId).sort((a, b) => a.level - b.level);
}
export function firstLevel(careerId: string): CareerLevelData | undefined {
  return levelsForCareer(careerId)[0];
}
export function findSkill(label: string): SkillData | undefined {
  // Exact d'abord, puis casse ignorée (les statblocs de campagne écrivent « Corps à Corps »).
  return skills.find((s) => s.label === label) ?? skills.find((s) => s.label.toLowerCase() === label.toLowerCase());
}
/** REGISTRE de la porte `byId` : type d'entité de la grammaire → index de son dataset par `id`
 *  STABLE. Un type y entre AVEC le lot qui migre son concept (patron `TYPES`,
 *  `schemas/grammaire/ref.ts`) — ce qui n'y est pas déclaré ne se résout pas par la porte. */
const PAR_ID = {
  skill: indexParId('skills', skills),
} satisfies Partial<Record<TypeEntite, (id: string) => unknown>>;
/** Types d'entité que la porte résout — sous-ensemble DÉCLARÉ de `TypeEntite`. */
export type TypeResolu = keyof typeof PAR_ID;
type EntiteDe<T extends TypeResolu> = NonNullable<ReturnType<(typeof PAR_ID)[T]>>;
/**
 * PORTE UNIQUE de résolution d'une entité par son `id` STABLE (#1463 L2) : le type d'entité
 * paramètre le lookup ET le type rendu ; `undefined` si l'id est absent de son dataset.
 * L'`id` est un `string` NU — la marque `Id<'skill'>` se frappe à la porte zod, côté DONNÉE
 * (`idDe`, `schemas/grammaire/ref.ts`) ; le moteur, lui, porte des ids nus (`SkillInstance.id`).
 */
export function byId<T extends TypeResolu>(type: T, id: string): EntiteDe<T> | undefined {
  return PAR_ID[type](id) as EntiteDe<T> | undefined;
}
/**
 * Référence STRUCTURÉE à une Compétence — la réf de la grammaire (`refOuSpec('skill')`, régimes
 * `spec` DÉSIGNÉE XOR `choix` à faire) + `value`, le nombre IMPRIMÉ au statbloc.
 *
 * `choix` ne survit PAS au spawn : `skillsFromBook` (`noyau/monde/spawn.ts`) DÉSIGNE une spécialisation, et
 * la `SkillInstance` runtime est toujours concrète.
 */
export type SkillRef = RefASpecialisation & { value: number };
/** Libellé d'affichage d'une `SkillRef` : « Langue (Magick) 63 », « Savoir (Au choix) 65 »,
 *  « Métier (Armurier ou Forgeron) 50 ». */
export function skillRefLabel(ref: SkillRef): PlayerText {
  return dataLabel(`${refLabel('skills', ref)} ${ref.value}`);
}
export function findTalent(label: string): TalentData | undefined {
  return talents.find((t) => t.label === label);
}
const talentParId = indexParId('talents', talents);
/** Résout un Talent par son `id` STABLE (référence structurée — fin du lookup par libellé parsé). */
export function findTalentById(id: string): TalentData | undefined {
  return talentParId(id);
}
/** Référence STRUCTURÉE à un Talent (`RefDesignee` + niveau `times` ≥2) — fin des chaînes « Maîtrise du combat 2 ». */
export interface TalentRef extends RefDesignee {
  times?: number;
}
/** Libellé d'affichage d'une `TalentRef` : « Magie des Arcanes (Ghur) », « Maîtrise du combat 2 »
 *  (base+spec via `refLabel`, + niveau si ≥2). */
export function talentRefLabel(ref: TalentRef): PlayerText {
  return dataLabel(refLabel('talents', ref) + (ref.times && ref.times > 1 ? ` ${ref.times}` : ''));
}
/** Sous-type d'une QUALITÉ (classification RAW : qualités d'Arme LDB 62, d'Armure LDB 63, d'Objet). */
export type QualitySubtypeData = EntreeDe<typeof qualitySubtypesDef>;
export const qualitySubtypes = datasetDe<typeof qualitySubtypesDef>(qualitySubtypesJson);
const sousTypeQualiteParId = indexParId('qualitySubtypes', qualitySubtypes);
/** Résout un sous-type de Qualité par son `id` STABLE (= `QualityData.subType`). */
export function findQualitySubtypeById(id: string | null | undefined): QualitySubtypeData | undefined {
  return sousTypeQualiteParId(id);
}
/** Libellé d'affichage d'un sous-type de Qualité par son id (repli sur l'id). SOURCE UNIQUE du nom. */
export function qualitySubtypeLabel(id: string | null | undefined): PlayerText {
  return dataLabel(id ? sousTypeQualiteParId(id)?.label : '', id ?? '');
}
/** Type d'une QUALITÉ : Atout (bénéfique) / Défaut (handicap) — classification RAW (LDB 62/63). */
export type QualityTypeData = EntreeDe<typeof qualityTypesDef>;
export const qualityTypes = datasetDe<typeof qualityTypesDef>(qualityTypesJson);
const typeQualiteParId = indexParId('qualityTypes', qualityTypes);
/** Résout un type de Qualité par son `id` STABLE (= `QualityData.polarite`). */
export function findQualityTypeById(id: string | null | undefined): QualityTypeData | undefined {
  return typeQualiteParId(id);
}
/** Libellé d'affichage d'un type de Qualité par son id (repli sur l'id). SOURCE UNIQUE du nom. */
export function qualityTypeLabel(id: string | null | undefined): PlayerText {
  return dataLabel(id ? typeQualiteParId(id)?.label : '', id ?? '');
}
const groupeObjetParId = indexParId('weaponGroups', weaponGroups);
/** Résout un Groupe d'objet par son `id` STABLE (`subType` d'un Weapon/ItemInstance, `subType.id` d'un trapping). */
export function findWeaponGroupById(id: string | null | undefined): WeaponGroupData | undefined {
  return groupeObjetParId(id);
}
/** Matière du Groupe d'armure `id` (`material`), `undefined` hors d'un Groupe d'armure. LDB 63 l.41-58 */
export function matiereDuGroupe(id: string | null | undefined): MatiereDArmure | undefined {
  return findGroupeDArmureById(id)?.material;
}
/** Le Groupe d'armure `id`, `undefined` hors d'un Groupe d'armure. */
export function findGroupeDArmureById(id: string | null | undefined): GroupeDArmure | undefined {
  const groupe = findWeaponGroupById(id);
  return groupe?.kind === 'armour' ? groupe : undefined;
}
/** Libellé d'affichage d'un Groupe d'objet par son id (repli sur l'id). SOURCE UNIQUE du nom de Groupe. */
export function weaponGroupLabel(id: string | null | undefined): PlayerText {
  return dataLabel(id ? groupeObjetParId(id)?.label : '', id ?? '');
}
/** VOCABULAIRE FERMÉ des catégories de possession (`TrappingData.categorie`), miroir de l'enum du
 *  schéma `src/data/schemas/defs/trappings.ts` — une union, pas un registre de données. */
export type TrappingTypeId = 'melee' | 'distance' | 'ammunition' | 'armor' | 'trapping';
const groupeParId = indexParId('groups', groups);
/** Résout un Groupe d'APPARTENANCE par son `id` STABLE (cible de Trait psy, filtre onlyGroups/exceptGroups). */
export function findGroupById(id: string | null | undefined): GroupData | undefined {
  return groupeParId(id);
}
/** Libellé d'affichage d'un Groupe d'appartenance par son id (repli sur l'id). SOURCE UNIQUE du nom de Groupe. */
export function groupLabel(id: string | null | undefined): PlayerText {
  return dataLabel(id ? groupeParId(id)?.label : '', id ?? '');
}
/** Libellés d'une liste de Groupes, joints comme le Test les décrit (`FlowTest.vsGroups`). */
export function groupesLabel(ids: readonly string[]): PlayerText {
  return dataLabel(ids.map(groupLabel).join('/'));
}
/** Type de Souffle — argument du Trait Souffle et règle du Type, composée par `souffleDuType`
 *  (`engine/creatureAttacks.ts`). Registre SSOT (`breath-types.json`). LDB 85 l.322-329 ; EDOC 13 l.237 */
export type BreathTypeData = EntreeDe<typeof breathTypesDef>;
export const breathTypes = datasetDe<typeof breathTypesDef>(breathTypesJson);
const typeSouffleParId = indexParId('breathTypes', breathTypes);
/** Résout un Type de Souffle par son `id` STABLE. */
export function findBreathTypeById(id: string | null | undefined): BreathTypeData | undefined {
  return typeSouffleParId(id);
}
/** Libellé d'affichage d'un Type de Souffle par son id (repli sur l'id). SOURCE UNIQUE du nom. */
export function breathTypeLabel(id: string | null | undefined): PlayerText {
  return dataLabel(id ? typeSouffleParId(id)?.label : '', id ?? '');
}
/** Type de Dégâts ignoré par le Trait Immunité (LDB 85 : « poison, magiques ou électriques ») — argument du
 *  Trait Immunité (multi-valeurs) ET valeur de la Condition `has … what:'immunity'` (Venin (Poison)…). Registre SSOT
 *  (`damage-types.json`, éditable). */
export type DamageTypeData = EntreeDe<typeof damageTypesDef>;
export const damageTypes = datasetDe<typeof damageTypesDef>(damageTypesJson);
const typeDegatsParId = indexParId('damageTypes', damageTypes);
/** Résout un Type de Dégâts par son `id` STABLE. */
export function findDamageTypeById(id: string | null | undefined): DamageTypeData | undefined {
  return typeDegatsParId(id);
}
/** Libellé d'affichage d'un Type de Dégâts par son id (repli sur l'id). SOURCE UNIQUE du nom. */
export function damageTypeLabel(id: string | null | undefined): PlayerText {
  return dataLabel(id ? typeDegatsParId(id)?.label : '', id ?? '');
}
const creatureParId = indexParId('creatures', creatures);
/** Résout une créature par son `id` STABLE — référence runtime/données (scènes, encounters). */
export function findCreatureById(id: string | undefined): CreatureData | undefined {
  return creatureParId(id);
}
/** Libellé d'affichage d'une créature par son id (repli sur l'id si introuvable). */
export function creatureLabel(id: string): PlayerText {
  return dataLabel(creatureParId(id)?.label, id);
}
/** Seul lecteur autorisé de la nommé-ité (jamais via `title`) : `true` si la créature est un individu nommé. */
export function isNamed(c: CreatureData): boolean {
  return c.named === true;
}
/** Sort par LIBELLÉ — bord AUTHORING/affichage ; rend l'entrée EFFECTIVE, comme `findSpellById`. */
export function findSpell(label: string): SpellData | undefined {
  return effectiveEntry(spells.find((s) => s.label === label));
}
const signeAstralParId = indexParId('stars', stars);
/** Signe astral par `id` STABLE — lookup RUNTIME indépendant de la langue (`Combatant.star` = id). */
export function findStarById(id: string | null | undefined): StarData | undefined {
  return signeAstralParId(id);
}

/** Possession résolue par id STABLE parmi des `objets` d'abord (objets d'une campagne, #767), puis au
 *  catalogue (`findTrappingById`) — SEULE définition de la chaîne, lue par le jeu (`objetDuNarratif`,
 *  `noyau/monde/resolveursDuNarratif.ts`) et par l'éditeur (objets du projet édité). */
export function trappingDesObjetsPuisDuCatalogue(objets: ReadonlyMap<string, TrappingData>, id: string): TrappingData | undefined {
  return objets.get(id) ?? findTrappingById(id);
}
/** Le Groupe d'armes d'une arme : `weaponGroup`, qui prime, sinon `subType`. AA 10 l.178-193 */
export function groupeDeLArme<G>(arme: { weaponGroup?: G | null; subType?: G | null }): G | undefined {
  return arme.weaponGroup ?? arme.subType ?? undefined;
}
/** Familles de catalogue qui ne sont pas des armes portées : les pièces servies (#156) et les munitions. */
const FAMILLES_HORS_ARMES_PORTEES: ReadonlySet<string> = new Set(['armes-de-siege', 'munitions']);
/** ARMES choisissables `{ id, label, groupe }` : toute Possession `melee`/`distance` hors « Mains nues »
 *  (`TrappingData.unarmed`) et hors des familles de catalogue `FAMILLES_HORS_ARMES_PORTEES` (`subType`), triée au
 *  libellé. `id` = `trappingId` STABLE ; `groupe`, son Groupe d'armes (`groupeDeLArme`). */
export const armesChoisissables = memoParVersion('trappings', () => trappingsInstanciables()
  .filter((t) => (t.categorie === 'melee' || t.categorie === 'distance') && !t.unarmed && !FAMILLES_HORS_ARMES_PORTEES.has(t.subType?.id ?? ''))
  .map((t) => ({ id: t.id, label: t.label, groupe: groupeDeLArme(t)?.id }))
  .sort((a, b) => parLibelle(a.label, b.label)));
/** Résout une Qualité par son `id` STABLE. */
export function findQualityById(id: string): QualityData | undefined {
  return qualiteParId(id);
}
const qualiteParLabelMinuscule = indexParChamp('qualities', qualities, (q) => q.label.toLowerCase());
const qualiteParSlugDeLabel = indexParChamp('qualities', qualities, (q) => slugId(q.label));
/** `id` STABLE d'une Qualité depuis un LIBELLÉ saisi à l'AUTHORING (« Solide », « solide »,
 *  « tir-de-zone ») — casse ignorée puis slug du libellé, `undefined` si hors catalogue. La couture
 *  label→id vit ICI, au chargement de la donnée, JAMAIS dans `src/engine`/`src/noyau`
 *  (AGENTS.md § Pour TOUT agent) : le moteur ne reçoit qu'un id, résolu par `findQualityById`. */
export const qualityIdByLabel = (label: string): string | undefined => {
  const q = qualiteParLabelMinuscule(label.toLowerCase()) ?? qualiteParSlugDeLabel(slugId(label));
  if (!q) return undefined;
  // Doublon de LIBELLÉ imprimé du catalogue (« Immobilisante », `qualities.json:230` et `:271`) :
  // l'authoring par libellé atteint l'entrée CANONIQUE — celle dont l'`id` EST le slug du libellé ;
  // l'homonyme ne s'authore que par son `id` (`immobilisante-fixe`, `noyau/zi-filets.hors-store.test.ts`).
  const canonique = slugId(q.label);
  return qualiteParId(canonique) ? canonique : q.id;
};
const sortParId = indexParId('spells', spells);
/** Résout un Sort par son `id` STABLE, sous la forme EFFECTIVE des règles optionnelles actives
 *  (`effectiveEntry`, `src/engine/variants.ts`) — POINT UNIQUE de lecture d'un sort par id : moteur,
 *  store et UI passent tous par ici, aucun ne relit `spells.json` par lui-même. Une variante réglée
 *  (VDM, `magie-vdm-incantation`) y republie ses champs de `VARIANT_RESOLVED_FIELDS`
 *  (`src/data/schemas/defs/spells.ts`). Sans variante active, l'entrée de base est rendue telle quelle. */
export function findSpellById(id: string): SpellData | undefined {
  return effectiveEntry(sortParId(id));
}
const manoeuvreParId = indexParId('maneuvers', maneuvers);
/** Résout une Manœuvre par son `id` STABLE (réf `TraitData.grantsManeuvers` → résolveur générique). */
export function findManeuverById(id: string): ManeuverDef | undefined {
  return manoeuvreParId(id);
}
/** Index INVERSE manœuvre → Trait PROJETANT (#1226), DÉRIVÉ de l'unique déclaration du lien
 *  (`TraitData.grantsManeuvers`) : aucune seconde source de vérité côté manœuvre. Un trait en projette
 *  N (Souffle → un id par Type ; Métamorphose → entrée/sortie), d'où la table id-de-manœuvre → trait.
 *  La relation est de N vers UN : deux traits revendiquant la même manœuvre s'écraseraient ici — le
 *  contrat d'unicité est tenu par `maneuver-trait-projection.test.ts`. */
const traitParManoeuvreOctroyee = memoParVersion('traits', () => new Map<string, TraitData>(
  traits.flatMap((t) => (t.grantsManeuvers ?? []).map((r) => [r.id, t] as const)),
));
/** Le Trait de créature dont la manœuvre est la PROJECTION mécanique — porteur de la prose VERBATIM et
 *  de l'ancrage `source` (LDB 85 = « TRAITS DE CRÉATURE », folios 338-343). Une entité, une prose :
 *  l'affichage d'une manœuvre lit la `desc` du trait résolu ici, la manœuvre n'en porte aucune. La
 *  prose est repérée au FOLIO chez le trait, jamais à la ligne chez la manœuvre (#1228). */
export function traitProjectingManeuver(id: string): TraitData | undefined {
  return traitParManoeuvreOctroyee().get(id);
}
const dieuParId = indexParId('gods', gods);
/** Résout un Culte/Dieu par son id STABLE (« sigmar »). */
export function findGodById(id: string): GodData | undefined {
  return dieuParId(id);
}
/** Libellé affiché d'un Culte/Dieu (id → « Sigmar ») ; id inconnu → l'id lui-même. */
export function godLabel(id: string): PlayerText {
  return dataLabel(findGodById(id)?.label, id);
}
/** Ids des cultes À BÉNÉDICTIONS, triés — DÉRIVÉ de la donnée (choix de culte du joker
 *  « Béni (Au choix) » à la création/avancement). Les fiches de SAVEUR (dieux nains/elfes/halflings,
 *  provinciaux, Puissances de la Ruine) n'accordent ni Bénédictions ni Miracles (LDB 37 l.17,
 *  LDB 36 l.9) → exclues de tout choix de Prière. */
export const cultIds = memoParVersion('gods', (): string[] => gods.filter((g) => g.blessings.length > 0).map((g) => g.id).sort());
/** Les six Bénédictions d'un culte, IDS de sort (le runtime/grimoire compare par id ; l'UI résout en
 *  libellé). Culte inconnu → []. */
export function blessingsOf(cult: string): string[] {
  return findGodById(cult)?.blessings ?? [];
}
/** Les Miracles d'un culte, IDS de sort. Culte inconnu → []. */
export function miraclesOf(cult: string): string[] {
  return findGodById(cult)?.miracles ?? [];
}
/** Les Sorts du Chaos accordés par un Dieu Sombre, IDS de sort (le grimoire compare par id). Dieu inconnu → []. */
export function chaosSpellsOf(god: string): string[] {
  return findGodById(god)?.chaosSpells ?? [];
}

/** Référence à une Qualité d'objet (`RefDesignee` + Indice éventuel : « Solide 3 » → value 3). */
export interface QualityRef extends RefDesignee {
  value?: number;
}
/** Quantité d'une possession conférée : nombre fixe (« (3) ») ou jet de dés structuré (« (1d10) »). */
export type CountSpec = { fixed: number } | { roll: DiceSpec };
/** Référence à une Possession : par `id` du catalogue (+ quantité éventuelle), texte NARRATIF hors
 *  catalogue (statblocs de créature : « collection d'alcool sans pareille »), dotation de POSSESSION
 *  (`DotationDePossession`, véhicule ou bête — SOCLE POSSESSIONS #615/#617 §9, jamais un objet de sac),
 *  résolue DIRECTEMENT par son `type`, jamais par le foyer trappings — OU somme d'argent (`Somme`) —
 *  OU mention par nature (`DotationDeMention`) — OU « 1 parmi »
 *  (`{ pick: 1, of }`, RÉCURSIF, EN MIROIR d'`AdvancementRef`), dont une option peut être un lot d'objets ou de
 *  possessions dotés ensemble (`LotDeDotation`) — OU joker d'arme (`JokerDArme`), de tout le catalogue ou d'un Groupe
 *  d'armes, son Atout au choix compris. `pick`/`wildcard` sont des EMPLACEMENTS, résolus par
 *  `resolveTrappingChoices` (`src/engine/trappingChoices.ts`) avant matérialisation ; non tranchés, ils
 *  restent tels quels et ne produisent aucun objet.
 *  Une ref `{id}` peut aussi porter des Atouts d'objet ATTACHÉS (`qualities`, ex. Fabrication LDB
 *  ch.60 « Solide »/« Raffiné »/« Léger »/« Pratique ») ou un EMPLACEMENT « Atout au choix »
 *  (`qualityChoice: true`, « X de qualité ») — résolu par `resolveTrappingChoices` en `qualities`
 *  (#657 Lot 1, moteur fondation — matérialisé par `buildInventory`, `src/engine/items.ts`). */
export type { DotationDePossession, DotationDeMention, Somme };
/** Un objet du catalogue doté tel quel, sans emplacement. */
type ObjetDote = RefDesignee & { count?: CountSpec; qualities?: QualityRef[]; valeur?: Somme };
/** Une arme au choix, de tout le catalogue ou du seul Groupe d'armes `groupe` ; `qualityChoice`, son Atout au choix. */
export type JokerDArme = { wildcard: 'arme'; groupe?: { id: string }; qualityChoice?: true };
/** Objets et possessions dotés ensemble, option d'un « 1 parmi ». */
export type LotDeDotation = { lot: (ObjetDote | DotationDePossession)[] };
export type TrappingRef =
  | (ObjetDote & { qualityChoice?: true })
  | { text: string; count?: CountSpec }
  | DotationDePossession
  | Somme
  | DotationDeMention
  | { pick: 1; of: BrancheDeDotation[] }
  | JokerDArme;
/** Une option d'un « 1 parmi » de dotation : une dotation, ou un lot. */
export type BrancheDeDotation = TrappingRef | LotDeDotation;
/** La dotation désigne-t-elle un OBJET du catalogue — ni possession, ni somme, ni mention, ni texte, ni emplacement ? */
export const estDotationDObjet = (ref: TrappingRef): ref is Extract<TrappingRef, { id: string; type?: never }> => 'id' in ref && !('type' in ref);
/** La dotation est-elle une somme d'argent ? */
export const estDotationDArgent = (ref: TrappingRef): ref is Somme => 'monnaie' in ref;
/** La dotation est-elle une mention ? */
export const estMention = (ref: TrappingRef): ref is DotationDeMention => 'nature' in ref;
/** Les mentions `xs` groupées par nature, dans l'ordre de `natureDeMentionSchema`, chaque groupe sous son libellé
 *  (« Personnes ») ; une nature sans mention n'a pas de groupe. */
export function mentionsParNature<M extends { nature: NatureDeMention }>(xs: readonly M[]): { nature: NatureDeMention; titre: string; mentions: M[] }[] {
  return natureDeMentionSchema.options.flatMap((nature) => {
    const mentions = xs.filter((m) => m.nature === nature);
    return mentions.length ? [{ nature, titre: libelleDeValeur(natureDeMentionSchema, nature), mentions }] : [];
  });
}
/** EMPLACEMENT d'avancement (espèce/carrière) : un espace de CHOIX, pas une instance résolue — la
 *  composition de la grammaire (`schemas/grammaire/avancement.ts`), au type de sa sortie : Compétence ou Talent. */
export type AdvancementRef = Avancement<'skill'> | Avancement<'talent'>;

/** ENTRÉE d'une catégorie Codex par `id`, lue sur la collection vivante de son dataset — au bout de son
 *  chemin dans la racine vivante de son fichier (`DATASET_DE_LA_CATEGORIE`, `RACINES_VIVANTES`) — par
 *  l'index vivant du dataset (`indexParId`) ; `undefined` hors de ces catégories (clés du prototype
 *  comprises) ou pour un id absent. Porte générique de `findById`. */
export function entreeDeCategorie(category: string, id: string): { id: string; label: string } | undefined {
  if (!Object.prototype.hasOwnProperty.call(DATASET_DE_LA_CATEGORIE, category)) return undefined;
  const d = DATASET_DE_LA_CATEGORIE[category];
  const entrees = suivreLeChemin(RACINES_VIVANTES[d.fichier], d.chemin) as readonly { id: string; label: string }[] | undefined;
  return entrees && indexParId(d.cle, entrees)(id);
}
/** CATÉGORIE CODEX de la collection nichée au bout de `suite` dans `fichier` (`[id].entries`, `tables.coque`) :
 *  celle dont le dataset porte l'espace `fichier#suite` (`DATASET_DE_L_ESPACE` → `DATASET_DE_LA_CATEGORIE`),
 *  tables générées depuis le `niche.categories` du def ; `undefined` pour une collection que le Codex n'expose pas. */
export function categorieDeLaNiche(fichier: string, suite: string): string | undefined {
  const espace = cleNichee(fichier, suite);
  if (!Object.prototype.hasOwnProperty.call(DATASET_DE_L_ESPACE, espace)) return undefined;
  const { cle } = DATASET_DE_L_ESPACE[espace];
  return Object.keys(DATASET_DE_LA_CATEGORIE).find((c) => DATASET_DE_LA_CATEGORIE[c].cle === cle);
}
/** Résout une entrée de dataset par (catégorie, `id`) — rendu/lookup des refs structurées. Une catégorie
 *  sans `case` se lit par la porte générique `entreeDeCategorie`. */
export function findById(category: string, id: string): { label: string } | undefined {
  switch (category) {
    case 'qualitySubtypes': return findQualitySubtypeById(id);
    case 'breathTypes': return findBreathTypeById(id);
    case 'damageTypes': return findDamageTypeById(id);
    case 'qualityTypes': return findQualityTypeById(id);
    case 'spells': return findSpellById(id);
    default: return entreeDeCategorie(category, id);
  }
}
/** La collection VIVANTE d'un dataset, au bout de son chemin dans la racine de son fichier. */
const collectionDeRacine = (d: DatasetDeCategorie): readonly { id: string; label: string }[] =>
  suivreLeChemin(RACINES_VIVANTES[d.fichier], d.chemin) as readonly { id: string; label: string }[];
/** L'entrée `id` de la collection de RACINE de `fichier`, lue sur sa racine vivante par l'index du dataset
 *  qui la porte (`DATASET_DE_L_ESPACE`). */
function entreeDeRacine(fichier: string, id: string): Readonly<Record<string, unknown>> | undefined {
  if (!Object.prototype.hasOwnProperty.call(DATASET_DE_L_ESPACE, fichier)) throw new Error(`entreeDeRacine : « ${fichier} » ne porte aucun dataset de racine.`);
  const d = DATASET_DE_L_ESPACE[fichier];
  return indexParId(d.cle, collectionDeRacine(d))(id) as Readonly<Record<string, unknown>> | undefined;
}
/** Le dataset dont la collection EST l'espace de `type`, son filtre ôté (`DATASET_DE_L_ESPACE`) : une
 *  racine-collection, ou les rangées d'un document mono-table (`steam-breakdown.json#entries`) ;
 *  `undefined` sinon. */
function collectionDuType(type: TypeEntite): DatasetDeCategorie | undefined {
  const { fichier, niche } = lireCleDEspace(espaceDe(type));
  const espace = cleNichee(fichier, niche ?? '');
  return Object.prototype.hasOwnProperty.call(DATASET_DE_L_ESPACE, espace) ? DATASET_DE_L_ESPACE[espace] : undefined;
}
/** Le dataset de l'espace de `type` (`collectionDuType`), `undefined` s'il n'en a pas. */
export function datasetDeLEspaceDuType(type: TypeEntite): CleDeDataset | undefined {
  return collectionDuType(type)?.cle;
}
/** Les choix `{ id, label }` d'une feuille `idDe(type, sousListe)` : les entrées vivantes de l'espace de son type
 *  qu'admet sa sous-liste (`idsDe`, `idsDeLaSousListe`), dans l'ordre de la donnée ; LÈVE si aucun dataset ne porte
 *  l'espace (`datasetDeLEspaceDuType`). */
export function choixDeLaFeuilleDId({ type, sousListe }: Pick<FeuilleDId, 'type' | 'sousListe'>): { id: string; label: string }[] {
  const d = collectionDuType(type);
  if (d === undefined) throw new Error(`choixDeLaFeuilleDId : aucun dataset ne porte l’espace ${espaceDe(type)}.`);
  const admis = new Set(sousListe === undefined ? idsDe(type) : idsDeLaSousListe(type, sousListe));
  return collectionDeRacine(d).filter((e) => admis.has(e.id)).map(({ id, label }) => ({ id, label }));
}
/** Libellé d'affichage d'un id, par source de spéc, tel que sa déclaration le dit (`SourceDeSpecs.libelle`) :
 *  table d'un vocabulaire du moteur, ou champs de l'entrée de l'univers (`entree`) ; sinon l'id. */
function libelleDeSource(decl: SourceDeSpecs, entree: (id: string) => Readonly<Record<string, unknown>> | undefined): (id: string) => string {
  const libelle = decl.libelle;
  if ('vocabulaire' in libelle) {
    const table: Readonly<Record<string, string>> = VOCABULAIRES[libelle.vocabulaire];
    return (id) => table[id] ?? id;
  }
  return (id) => {
    const e = entree(id);
    return (e && libelleDeLElement(e, libelle.champs)) ?? id;
  };
}
/** UNE source de spéc, lue sur sa déclaration (`SOURCES_DE_SPECS`) : `pool()` = ids CHOISISSABLES par un
 *  joueur ; `label()` = affichage ; `entree()` = l'entrée de l'univers qu'un id nomme, lue sur la racine
 *  vivante de son document (`entreeDeRacine`) ; aucune hors d'une source `resoutEnEntree` (vocabulaire, niche). `admetEntree()` juge
 *  une entrée résolue par le filtre déclaré de l'univers, campagne comprise. Le pool borne le CHOIX joueur ;
 *  l'univers (⊇ pool) est le catalogue de l'entrée qui la déclare (`catalogueSpecs`, `grammaire/ref.ts`), le
 *  Triton compris (MDG 16 l.283). */
export const SPEC_SOURCES = tableTotale(
  Object.keys(SOURCES_DE_SPECS) as SpecsSource[],
  (src): { pool(): string[]; label(id: string): string; entree(id: string): Readonly<Record<string, unknown>> | undefined; admetEntree(entree: { readonly id: string }): boolean } => {
    const decl: SourceDeSpecs = SOURCES_DE_SPECS[src];
    const { fichier, filtre } = lireCleDEspace(decl.univers);
    const entree = resoutEnEntree(src) ? (id: string) => entreeDeRacine(fichier, id) : () => undefined;
    return {
      pool: () => [...(lireLEspace(decl.pool ?? decl.univers) ?? [])],
      label: libelleDeSource(decl, entree),
      entree,
      admetEntree: (entree) => filtre ? retenuParFiltre(filtre, entree as Readonly<Record<string, unknown>>) : (lireLEspace(decl.univers)?.has(entree.id) ?? false),
    };
  },
);
/** COUTURE libellé→id de SAISIE (#909) : l'id de l'univers de la source `source` dont le libellé
 *  d'affichage (`SPEC_SOURCES[source].label`) est le texte `label`, à l'égalité de libellé (`norm`, `src/lib/normalize.ts`). */
export function specIdByLabel(label: string, source: SpecsSource): string | undefined {
  const cle = norm(label);
  return [...(lireLEspace(SOURCES_DE_SPECS[source].univers) ?? [])].find((id) => norm(SPEC_SOURCES[source].label(id)) === cle);
}
/** POOL d'une def (Compétence/Talent) — ce qu'un choix joueur PROPOSE d'office (`LDB 09 l.40`) :
 *  pool DÉRIVÉ du registre partagé si `specsSource` (SSOT `SPEC_SOURCES`), sinon les entrées `specs[]`
 *  inline SANS `pool: false`. Consommé par `wildcardSpecs` (créateur), l'avancement et l'Entraînement.
 *  Ne JAMAIS l'utiliser pour juger de la VALIDITÉ d'une spec (`refusDeSpec`, `grammaire/ref.ts`). */
export function specPoolOf(def: { specsSource?: SpecsSource; specs?: SpecEntry[] }): string[] {
  return def.specsSource
    ? SPEC_SOURCES[def.specsSource].pool()
    : (def.specs ?? []).filter((e) => e.pool !== false).map(specEntryId);
}
/** CATALOGUE ÉNUMÉRABLE d'une def : toutes les entrées `specs[]` (y compris `pool: false`), sinon le
 *  pool du registre partagé. C'est la liste qu'un écran de RÉFÉRENCE imprime (Codex/éditeur) et la
 *  base des round-trips libellé→id. Le catalogue d'une `specsSource` va AU-DELÀ de cet énumérable
 *  (univers entier, `specAuCatalogue`, `grammaire/ref.ts`) : ce qui est énumérable ⊆ ce qui est désigné. */
export function specCatalogOf(def: { specsSource?: SpecsSource; specs?: SpecEntry[] }): string[] {
  return def.specsSource ? SPEC_SOURCES[def.specsSource].pool() : (def.specs ?? []).map(specEntryId);
}
/** Libellé d'affichage d'une spéc (`RefDesignee.spec`) : si la def désigne une `specsSource`, résout via le
 *  catalogue `SPEC_SOURCES` (registre partagé d'ids : Groupe d'arme → libellé, Vent, Lore, dieu, chanson) ;
 *  sinon cherche l'id dans `def.specs` (`SpecEntry[]`, résolu en label FR) ; sinon verbatim (texte
 *  libre / id inconnu — jamais d'erreur d'affichage). SOURCE UNIQUE de résolution de spéc. */
export function specLabel(category: string, refId: string, specId: string): PlayerText {
  const def = category === 'skills' ? byId('skill', refId) : category === 'talents' ? findTalentById(refId) : undefined;
  if (def?.specsSource) return dataLabel(SPEC_SOURCES[def.specsSource].label(specId));
  const entry = def?.specs?.find((s) => specEntryId(s) === specId);
  return entry ? specEntryLabel(entry) : dataLabel(specId);
}
/**
 * MINTEUR (b) de `PlayerText` (#1318 V8a₁) — le PASSAGE des textes AUTHORÉS (le `label` d'une entité
 * de catalogue, le `title` d'une entrée de table, l'`invite` d'un nœud de Flow, l'intitulé d'un péril
 * de scène) vers l'affichage. Ces textes ne sont PAS traduisibles par clé : ils vivent dans la donnée,
 * et une 2ᵉ langue les surcharge par fichier `id → label` (plan évacué → #320, Phase E).
 *
 * CE QU'IL N'EST PAS : le fossile `rawText` sous un autre nom — d'autant moins négociable que ce fossile
 * est MORT (#1318 E7-FINAL). Il gelait un LITTÉRAL FR écrit au call-site ; ici l'argument est TOUJOURS lu
 * dans la donnée. Le cliquet nominatif `src/player-text-ratchet.test.ts` tient cette différence à ZÉRO,
 * sans gel : un littéral FR passé à `dataLabel(` rougit la CI — la garde, pas le nom, ferme le retour.
 *
 * `repli` : la dégradation quand la donnée ne porte pas de texte — un ID, ou un libellé DÉJÀ dérivé du
 * catalogue (`refLabel`, `CHAR_LABELS`). Jamais un littéral FR : même cliquet.
 */
export function dataLabel(texte: string | undefined | null, repli?: string): PlayerText {
  // eslint-disable-next-line murs/marques -- #1318 V8a₁ : l'unique cast de ce minteur (b) — forger la marque EST son corps de métier (cf. JSDoc), et le cliquet `src/player-text-ratchet.test.ts` refuse qu'un littéral FR y entre.
  return (texte ?? repli ?? '') as PlayerText;
}

/** Libellé d'affichage d'une `RefDesignee` : « Magie des Arcanes (Ghur) » — base (repli sur l'id) + spec —,
 *  ou d'un emplacement `choix` par `choixLabel`. Aucun site ne s'en sert de clé : une identité de
 *  référence est `refKey(id, spec)`. */
export function refLabel(category: string, ref: RefASpecialisation): PlayerText {
  if (ref.choix != null) return choixLabel(category, ref.id, ref.choix);
  const base = dataLabel(findById(category, ref.id)?.label, ref.id);
  return ref.spec ? dataLabel(`${base} (${specLabel(category, ref.id, ref.spec)})`) : base;
}
/** Copie une `QualityRef` de catalogue en `QualityInstance` RUNTIME FRAÎCHE (`{id, value?}`) — objet neuf
 *  (le runtime mute `qualities` : enchantements, munitions). Plus d'aplatissement en chaîne « id value ». */
export function qualityInstance(q: QualityRef): import('../engine/types').QualityInstance {
  return {
    id: q.id,
    ...(q.value != null ? { value: q.value } : {}),
  };
}
/** Libellé d'affichage d'une `QualityRef` (ou `QualityInstance` runtime) : « Tranchante », « Solide 3 »,
 *  « Taillade (1A) ». La FORME de l'Indice est pilotée par la DONNÉE (`QualityData.indice.unite`) : sans
 *  unité, le livre accole la valeur nue (`LDB 62 l.33` « Protectrice 2 », l.66 « Recharge 1 ») ; avec unité,
 *  il la parenthèse (`AA 08 l.136` « Taillade (1A) », l.304 « Taillade (2A) »). Zéro branche par id. */
export function qualityRefLabel(q: QualityRef): PlayerText {
  const base = refLabel('qualities', q);
  if (q.value == null) return base;
  const unite = qualiteParId(q.id)?.indice?.unite;
  return dataLabel(unite ? `${base} (${q.value}${unite})` : `${base} ${q.value}`);
}
/** Libellé d'affichage d'une `SkillInstance` (id+spec → « Langue (Magick) »). Repli sur l'id. */
export function skillInstanceLabel(s: { id: string; spec?: string }): PlayerText {
  return refLabel('skills', { id: s.id, spec: s.spec });
}
/** Ce que déclare un Test : sa Compétence par RÉFÉRENCE (la Spé vit DANS la référence, emplacement `choix`
 *  compris) ou sa Caractéristique. */
type TestDeclare = { readonly skill?: RefASpecialisation; readonly characteristic?: CharKey; readonly crewTestType?: string };
/** Libellé du Test DÉCLARÉ — Compétence (Spé), Caractéristique ou type de Test d'équipage : « Corps à corps
 *  (Bagarre) » (LDB 14 l.155), « Langue (Magick) » (LDB 46 l.24), « Affaler les voiles » (MDG 15 l.144-145).
 *  `undefined` sans aucun des trois : le repli est au site. */
export function testSkillLabel(test: { readonly skill: RefASpecialisation } | { readonly characteristic: CharKey }): PlayerText;
export function testSkillLabel(test: TestDeclare): PlayerText | undefined;
export function testSkillLabel(test: TestDeclare): PlayerText | undefined {
  if (test.skill) return refLabel('skills', test.skill);
  if (test.crewTestType) return dataLabel(garanti(findCrewTestTypeById(test.crewTestType), test.crewTestType, 'type de Test d’équipage').label);
  return test.characteristic ? dataLabel(CHAR_LABELS[test.characteristic]) : undefined;
}
/** Libellé d'affichage d'une `TalentInstance` (id+spec → « Magie des Arcanes (Bête) »). Repli sur l'id. */
export function talentConcrete(t: { talentId: string; spec?: string }): PlayerText {
  return refLabel('talents', { id: t.talentId, spec: t.spec });
}
/**
 * Libellé d'un EMPLACEMENT de spécialisation NON DÉSIGNÉ : « Savoir (Au choix) » pour un choix
 * LIBRE, « Métier (Armurier ou Forgeron) » pour un choix BORNÉ (options résolues en LIBELLÉS par
 * `specLabel`, jamais des ids bruts). SOURCE UNIQUE du rendu d'un `choix` — la réf de statbloc
 * (`skillRefLabel`) comme l'emplacement d'avancement (`advancementLabel`) passent ici.
 * `LDB 09 l.40`.
 */
export function choixLabel(category: string, id: string, choix: true | string[]): PlayerText {
  const base = refLabel(category, { id });
  return Array.isArray(choix) && choix.length
    ? dataLabel(`${base} (${ouListe(choix.map((o) => specLabel(category, id, o)))})`)
    : t('ref.auChoix', { base, mot: t('ref.motAuChoix') });
}
/** Alternative « A ou B ou C » : le liant vit au catalogue (`ref.ou`). */
function ouListe(options: readonly string[]): PlayerText {
  return dataLabel(options.join(` ${t('ref.ou')} `));
}
/** Libellé d'un nœud `{ pick, of }` (`Parmi`) aux libellés d'options `options` : « 2 parmi : a, b », ou « a ou b ». */
function libelleDuParmi(pick: number, options: PlayerText[]): PlayerText {
  return pick > 1 ? dataLabel(`${t('ref.parmi', { n: pick })} ${options.join(', ')}`) : ouListe(options);
}
/** Libellé d'affichage d'un `AdvancementRef` : « Savoir (Au choix) », « A ou B », « 3 Talents
 *  aléatoires », « Magie des Arcanes (Bête) ». SOURCE UNIQUE (Codex + résolution création). */
export function advancementLabel(category: string, a: AdvancementRef): PlayerText {
  if ('id' in a) return refLabel(category, a);
  if ('pick' in a) return libelleDuParmi(a.pick, a.of.map((x) => advancementLabel(category, x)));
  return a.random === 1 ? t('ref.talentAleatoire') : t('ref.talentsAleatoires', { n: a.random });
}
/** id de base d'un `AdvancementRef` SIMPLE (référence, avec ou sans régime de spécialisation) — pour
 *  matcher par id une compétence/un talent POSSÉDÉ (ex. compétence de revenus). undefined pour un
 *  `{pick}`/`{random}` (pas un id unique). */
export function advancementBaseId(a: AdvancementRef): string | undefined {
  return 'id' in a ? a.id : undefined;
}
/** Libellé d'affichage d'une dotation ou d'une option de « 1 parmi » (`BrancheDeDotation`) : « Marteau », « Pamphlétaire (3) »,
 *  « Chiffon (1d10) », « Outils professionnels (Maréchal-ferrant) » (`spec`, rendue par `refLabel` comme toute autre
 *  `RefDesignee` — `LDB 08 l.1130`), « Bijoux valant 3d10 couronnes d'or » (`valeur`), somme d'argent
 *  « 20 couronnes d'or », mention « Pamphlétaires (3) », texte narratif hors catalogue, « 1 parmi » (récursif), lot
 *  « Arc et Flèche (10) », ou joker « Arme (au choix) », « Arme du groupe Deux-mains (au choix) ». SOURCE UNIQUE
 *  (Codex, créateur, marchand, inventaire). */
export function trappingRefLabel(ref: BrancheDeDotation): PlayerText {
  if ('pick' in ref) return libelleDuParmi(ref.pick, ref.of.map(trappingRefLabel));
  if ('lot' in ref) return dataLabel(listeEt(ref.lot.map(trappingRefLabel)));
  if (estDotationDArgent(ref)) return dataLabel(libelleDeLaSomme(ref));
  const base = 'wildcard' in ref
    ? (ref.groupe ? t('ref.armeDuGroupeAuChoix', { groupe: dataLabel(findWeaponGroupById(ref.groupe.id)?.label, ref.groupe.id) }) : t('ref.armeAuChoix'))
    : 'text' in ref
      ? ref.text
      : estMention(ref)
        ? ref.label
        : !('type' in ref)
          ? refLabel('trappings', ref)
          : ref.type === 'vehicle'
            ? dataLabel(findVehicleById(ref.id)?.label, ref.id)
            : dataLabel(findCreatureById(ref.id)?.label, ref.id);
  const count = 'count' in ref && ref.count ? ('fixed' in ref.count ? ` (${ref.count.fixed})` : ` (${formatDice(ref.count.roll)})`) : '';
  if ('qualityChoice' in ref && ref.qualityChoice) return t('ref.qualiteAuChoix', { base: base + count });
  const quality = 'qualities' in ref && ref.qualities?.length ? ` (${ref.qualities.map(qualityRefLabel).join(', ')})` : '';
  const libelle = base + count + quality;
  return 'valeur' in ref && ref.valeur ? t('ref.valant', { base: libelle, somme: libelleDeLaSomme(ref.valeur) }) : dataLabel(libelle);
}
/** La formule joueur d'une somme (« 3d10 pistoles d'argent », « 20 couronnes d'or »). */
export const libelleDeLaSomme = (s: Somme): string => formuleDeMonnaie('fixed' in s.count ? { n: 0, sides: 0, plus: s.count.fixed } : s.count.roll, s.monnaie);
