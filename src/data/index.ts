/**
 * Accès typé à NOTRE base de jeu — APP-OWNED et ÉDITABLE (éditeur de données DEV in-app,
 * écran 'dataEditor'). Les *.json de ce dossier sont la SOURCE CANONIQUE app-owned, curée à la main :
 * aucune migration ne les régénère.
 */
import type { EntityAppearance } from '../engine/authoringAppearance';
import type { PlayerText } from '../i18n/playerText';
import { t } from '../i18n';
import type { RigSpeciesId } from '../gameIso/rig/appearance';
import type { SourceRef, SecondaryRef, RaceKey, RefCareerId, DescRef } from './schemas/grammaire/valeurs';
import type { TypeEntite } from './schemas/grammaire/ref';
import { symptomSeveritySchema } from './schemas/grammaire/valeurs';
import { libelleDeValeur } from './schemas/grammaire/meta';
import type { MerchantArchetypeDef } from '../state/merchants/types';
// Types de la SCÈNE, en TYPE seul (aucun cycle runtime) : les semences d'une scène neuve portent
// EXACTEMENT les types des champs qu'elles alimentent — les redéclarer ici en ferait une seconde vérité.
import type { Scene, ReliefDefaults, SceneRoofDefaults, Terrain } from '../state/scene';
import { slugId } from './slug';
import { norm } from '../lib/normalize';
import { effectiveEntry } from '../engine/variants';
import { CATEGORY_BY_SOURCE_KIND, type EffectSource } from '../engine/types';
import characteristicsJson from './characteristics.json';
import speciesJson from './species.json';
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
import { critiqueEntries } from './criticals';
import { SHIP_CRIT_SET, RIVER_CRIT_SET, type ShipCritSet } from './shipCriticals';
import structureCriticalsRawJson from './structure-criticals.json';
import miscastRawJson from './miscast.json';
import trappingsJson from './trappings.json';
import vehiclesJson from './vehicles.json';
import merchantsJson from './merchants.json';
import structuresJson from './structures.json';
import structureAppearanceJson from './structureAppearance.json';
import materialsJson from './materials.json';
import type { MaterialDomain, MaterialEntry, MatiereDe, PropMaterialData, RoofMaterialDef } from './materials.types';
import terrainsJson from './terrains.json';
import type { TerrainDef } from './terrains.types';
import buildingsJson from './buildings.json';
import type { BuildingDef } from './buildings.types';
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
import propsJson from './props.json';
import type { PropData } from './props.types';
import eyesJson from './eyes.json';
import hairsJson from './hairs.json';
import calendarMonthsJson from './calendarMonths.json';
import calendarIntercalaryJson from './calendarIntercalary.json';
import calendarWeekdaysJson from './calendarWeekdays.json';
import calendarPhasesJson from './calendarPhases.json';
import weatherJson from './weather.json';
import ventsTourbillonnantsJson from './vents-tourbillonnants.json';
import symptomsJson from './symptoms.json';
import detailsJson from './details.json';
import semencesDeSceneJson from './semences-de-scene.json';
import defautsDeCompilationJson from './defauts-de-compilation.json';
import starsJson from './stars.json';
import astrologyJson from './astrology.json';
import locationsJson from './locations.json';
import booksJson from './books.json';
import namesJson from './names.json';
import raceAppearanceJson from './raceAppearance.json';
import godsJson from './gods.json';
import pregensJson from './pregens.json';
import oupsJson from './oups.json';
import interludeEventsJson from './interludeEvents.json';
import tavernGamesJson from './tavernGames.json';
import peripetiesJson from './peripeties.json';
import reseauRoutierJson from './reseau-routier.json';
import massBattleJson from './mass-battle.json';
import grappleJson from './grapple.json';
import reglesJson from './regles.json';
import disponibiliteJson from './disponibilite.json';
import waterExposureJson from './water-exposure.json';
import nightStakesJson from './night-stakes.json';
import voyageStakesJson from './voyage-stakes.json';
import flowStakesJson from './flow-stakes.json';
import combatStakesJson from './combat-stakes.json';
import activitiesStakeJson from './activities.json';
import actionsJson from './actions.json';
import axesJson from './axes.json';
import navalProgressionJson from './naval-progression.json';
import seaNavigationJson from './sea-navigation.json';
import seaPerilsJson from './sea-perils.json';
import seaWeatherJson from './sea-weather.json';
import shipConstructionJson from './ship-construction.json';
import riverNavigationJson from './river-navigation.json';
import { CharKey, CHAR_LABELS, Weapon, VehicleData, StructureData, Availability, type TestedAvailability, Difficulty, type NightTestKind, type StakeForm } from '../engine/types';
import type { MutationData, MutationTable } from './mutations'; // type-only (évite le cycle data→mutations→engine→data)
import type { DiseaseDef } from '../engine/disease'; // type-only (le runtime de disease.ts importe `maladies` d'ici)
import type { PowerEstimateRow, MightModifierRow, WarMachineRow, StructureRow as MassBattleStructureRow, HazardRow } from '../engine/massBattle'; // type-only (le runtime de massBattle.ts importe ces tableaux d'ici)
import { type DiceSpec, formatDice } from '../engine/dice';
import type { Money } from '../engine/money'; // type-only (`Money` = SOURCE UNIQUE de la bourse, engine/money.ts)
import { SIZE_LABEL, sizeFromTalents } from '../engine/size'; // runtime : registre feuille (data/sizes.json + engine/qualities/ids), sans cycle vers data/index
import type { PregenDef } from './pregens'; // type-only (pregens.ts importe la donnée d'ici)
import type { OupsRow } from './oups';
import type { InterludeEvent } from './interludeEvents';
import type { Peripetie } from './peripeties';
import type { CharacteristicsData } from './schemas/defs/characteristics';
import type { AxesData } from './schemas/defs/axes';
import type { NavalProgressionData } from './schemas/defs/naval-progression';
import type { SeaNavigationData } from './schemas/defs/sea-navigation';
import type { SeaPerilsData } from './schemas/defs/sea-perils';
import type { SeaWeatherData } from './schemas/defs/sea-weather';
import type { ShipConstructionData } from './schemas/defs/ship-construction';
import type { RiverNavigationData } from './schemas/defs/river-navigation';
import type { SkillRef as EngineSkillRef } from '../engine/skills'; // type-only (aliasé : `SkillRef` est déjà pris ci-dessous, id Codex)

/** Compétence AU CHOIX d'une Activité (`ActivityDef.skills`, `src/engine/skills.ts` `TestSpec`) —
 *  `difficulty?` porte la Difficulté PROPRE à cette voie quand le RAW en attache une différente par
 *  Compétence (Punchausen, AA 12 l.45-49 : Charme Complexe OU Divertissement (Narration)
 *  Intermédiaire) ; absente, la voie retombe sur `ActivityDef.difficulty`. */
export interface ActivitySkill extends EngineSkillRef {
  difficulty?: Difficulty;
}

/** Règle d'EMPOIGNADE en DONNÉE (LDB 14 l.159-169) : `init` = ops à la touche d'une Empoignade déclarée
 *  (Empêtré + relation via le flag `grapple`) ; `win` = les 3 options du Test opposé GAGNÉ (l.161), appliquées
 *  avec `ctx.sl = DR`. La mécanique vit ICI (GameOp éditables), le flux `pendingGrapple` n'orchestre que le choix. */
export interface GrappleRule {
  init: import('../engine/ops').GameOp[];
  win: { damage: import('../engine/ops').GameOp[]; entangle: import('../engine/ops').GameOp[]; free: import('../engine/ops').GameOp[] };
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
 *  d100 « +10 pour chaque DR négatif » → maladie CONTRACTÉE (le Test d'exposition EST le test — pas de
 *  second Test de Contraction). `rerollUnlessWounded` : « Relancez si le Personnage n'est pas blessé ». */
export interface WaterExposureData {
  id: string;
  label: string;
  desc: string;
  test: { skill: EngineSkillRef; difficulty: import('../engine/types').Difficulty };
  rollModPerNegativeSL: number;
  modifiers: WaterExposureModifier[];
  diseases: { min: number; max: number; disease: string; rerollUnlessWounded?: boolean }[];
  source: SourceRef;
}
export const WATER_EXPOSURE = waterExposureJson as WaterExposureData;

/** Enjeu VERBATIM (règle 5, #331) d'un `kind` d'étape de la cascade de nuit (`src/state/restFlow.ts`,
 *  via `nightStakeRef`) — un `kind` absent du catalogue n'affiche rien (surfaçage progressif). */
export interface NightStakeEntry {
  /** Identité STABLE + libellé FR (#422, exposition Codex) — distincts de `kind` (vocabulaire lu par
   *  `nightStakeRef`), ajoutés pour la navigation/l'édition. */
  id: string;
  label: string;
  kind: string;
  stake: string;
  /** FORME DÉCLARÉE du `stake` (garde `night-stake-form.test.ts`) : `verbatim` (défaut) = contigu au
   *  Source, bloc par bloc ; `descripteur` = assemblage mécanique assumé, fiche `rule` exigée. */
  form?: StakeForm;
  source: SourceRef;
  /** FOYER de la règle derrière l'étape : l'id de l'ENTITÉ qui la porte (amendement A) — une fiche
   *  `regles.json` seulement quand aucune entité ne l'héberge. */
  rule?: string;
  /** Catégorie Codex du foyer (`'regles'` par défaut : `'skills'`, `'etats'`, `'symptoms'`…). */
  ruleCategory?: string;
}
export const NIGHT_STAKES = nightStakesJson as NightStakeEntry[];

/** ENJEU d'un `kind` d'étape de cascade de VOYAGE (#1117) — GABARIT de descripteur mécanique dont les
 *  trous `{nom}` sont remplis par le flux avec ses valeurs CALCULÉES. Distinct de `NightStakeEntry`
 *  (verbatim figé) : cf. `schemas/defs/voyage-stakes.ts`. */
export interface VoyageStakeEntry {
  id: string;
  type: 'voyage-stakes';
  label: string;
  kind: string;
  template: string;
  /** Id du FOYER de la règle — l'entité qui la PORTE (Compétence, État…), à défaut la fiche de cadre
   *  de `regles.json`. Même contrat que `flow-stakes`/`combat-stakes`. */
  rule?: string;
  /** Catégorie Codex du foyer (`'regles'` par défaut, `'skills'`, `'etats'`…). */
  ruleCategory?: string;
  source: SourceRef;
}
export const VOYAGE_STAKES = voyageStakesJson as VoyageStakeEntry[];

/** ENJEU d'un JET DE MODALE MONO (#1117 L1b), keyé par l'id de jet `{flow, phase}` — `phase` est LU
 *  dans l'état du pending, jamais écrit au site de rendu. Le foyer de la règle est l'entité qui la
 *  PORTE (`rule` + `ruleCategory`), ou l'ENTRÉE jouée quand `entryCategory` la déclare :
 *  cf. `schemas/defs/flow-stakes.ts`. */
export interface FlowStakeEntry {
  id: string;
  type: 'flow-stakes';
  label: string;
  flow: string;
  phase: string;
  template: string;
  form: StakeForm;
  rule?: string;
  ruleCategory?: string;
  /** Catégorie Codex de l'ENTRÉE jouée — le renvoi descend jusqu'à elle quand la clé la nomme. */
  entryCategory?: string;
  source: SourceRef;
}
export const FLOW_STAKES = flowStakesJson as FlowStakeEntry[];

/** ENJEU d'un `kind` d'étape de CASCADE (#1117 L2) — jumeau de `FlowStakeEntry`, keyé par un `kind`
 *  au lieu du couple `{flow, phase}` : cf. `schemas/defs/combat-stakes.ts`. Le `kind` est celui de
 *  l'applier servi quand il en existe un ; sinon celui du TIRAGE servi, car une même étape peut
 *  jouer sur deux jeux de tables qui ne mettent pas la même chose en jeu (Imparfaite vs Colère).
 *  Famille née en combat, elle sert toute cascade à étapes (mutation, interlude). */
export interface CombatStakeEntry {
  id: string;
  type: 'combat-stakes';
  label: string;
  kind: string;
  /** Gabarit du descripteur — ABSENT quand l'issue du jet se lit en chips d'ops (#1117) : l'entrée ne
   *  porte alors que son foyer de règle. `form` le qualifie, donc absente avec lui. */
  template?: string;
  form?: StakeForm;
  rule?: string;
  ruleCategory?: string;
  /** Catégorie Codex de l'ENTRÉE jouée — le renvoi descend jusqu'à elle quand la clé la nomme. */
  entryCategory?: string;
  /** La catégorie de l'entrée est celle de l'ENTITÉ SOURCE de l'effet, que seul le PRODUCTEUR connaît
   *  (`CATEGORY_BY_SOURCE_KIND`, `engine/types.ts` : un jet exigé par un objet, un Talent, une maladie…
   *  n'a pas de catégorie déclarable au dataset). Vaut PORTE au même titre qu'`entryCategory` : ce qui
   *  est interdit, c'est le silence — pas la catégorie dynamique. */
  entryFromSource?: boolean;
  source: SourceRef;
}
export const COMBAT_STAKES = combatStakesJson as CombatStakeEntry[];

/** ENJEU d'une ACTIVITÉ (#1117 L3) — porté par l'ENTITÉ elle-même (`activities.json`), pas par un
 *  fichier d'enjeux tiers : une Activité EST déjà une entrée Codex éditable qui porte sa règle en
 *  `desc` verbatim. Vue MINIMALE de `ActivityDef` (`src/engine/activities.ts`) réduite aux champs
 *  d'enjeu : `src/data` n'importe pas `src/engine/activities` (du moteur, seul le module FEUILLE
 *  `engine/types` l'est). */
export interface ActivityStakeEntry {
  id: string;
  stake?: string;
  stakeForm?: StakeForm;
  rule?: string;
  ruleCategory?: string;
}
export const ACTIVITY_STAKES = activitiesStakeJson as ActivityStakeEntry[];

/** REGISTRE DES ACTIONS de combat (`actions.json`, spec HUD « Zone 12 ») : une entrée = un acte
 *  offert au joueur, avec son identité STABLE, son affichage, sa règle Codex, son coût et les IDS
 *  de code qui l'exécutent. Le CODE derrière ces ids vit dans `src/state/actionRegistry.ts` —
 *  `src/data` ne dépend jamais de `src/state` ni de `src/engine`. */
export interface ActionDef {
  id: string;
  label: string;
  icon: string;
  surface:
    | 'deduite-du-set' | 'geste-d-etat' | 'grille' | 'gouttiere-arche' | 'selecteur-de-sets'
    | 'coin-de-tour' | 'bandeau-de-phase' | 'interlude' | 'pastille-etat' | 'pastille-entite' | 'frise'
    | 'geste-secondaire';
  /** Un id de prédicat, ou plusieurs — composés par l'ET séquentiel d'`actionGate`. */
  gate: string | string[];
  candidates?: string;
  run?: string;
  mode?: string;
  intent?: string;
  armed?: string;
  /** Champ de POSTURE pré-armée basculé par l'action (`BattleState.stances`, spec HUD §1a G5). */
  stance?: 'heldGround' | 'intoCrowd';
  coutAction: 'action' | 'mouvement' | 'gratuit' | 'aucun';
  /** Arbitrage NON-verbatim du coût — la RAISON en clair (même patron que `TraitData.maison`). */
  maison?: string;
  source?: SourceRef;
  rule?: string;
  ruleCategory?: string;
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
  hote?: string;
}
export const ACTIONS = actionsJson as ActionDef[];
/** Action par id STABLE (jamais par libellé). */
export const findActionById = (id: string): ActionDef | undefined => ACTIONS.find((a) => a.id === id);

/** Id de JET d'une modale mono : le couple `{flow, phase}` aplati en `kind` de `StakeKey`. SOURCE
 *  UNIQUE de la composition — la donnée porte les deux moitiés séparément, la clé les recolle ici. */
const flowKind = (flow: string, phase: string) => `${flow}/${phase}`;

/** DATASET d'enjeux servant une famille de jets (#1117). Union FERMÉE : ajouter une famille = ajouter
 *  son dataset ICI et sa branche dans `resolveStake` — jamais une N-ième porte de résolution. */
export type StakeDataset = 'night' | 'voyage' | 'weather' | 'flow' | 'activity' | 'combat';

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
  kind: string;
  entryId?: string;
  entryCategory?: string;
}

/** RÉFÉRENCE d'enjeu vers un DATASET : la clé de la donnée + les valeurs CALCULÉES par le flux pour
 *  ses trous. Seule forme ouverte au MOTEUR — un littéral de texte au call-site n'y compile pas
 *  (arbitrage Z5 appliqué à la zone d'enjeu), les producteurs passent par les portes fail-closed
 *  (`combatStakeRef`, `flowStakeRef`, `nightStakeRef`, `voyageStakeRef`, `activityStakeRef`,
 *  `weatherStakeRef`). */
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
 *  RÉSERVÉ au contenu : `src/state`/`src/engine` n'en écrivent aucun (garde
 *  `cascade-step-stake-guard.test.ts`, volet « l'enjeu AUTHORÉ reste au contenu ») — c'est la porte
 *  ouverte par l'arbitrage, pas une amnistie du texte au call-site. Aucun foyer de règle : le
 *  document ne renvoie à aucune fiche Codex. */
export interface AuthoredStake {
  authored: string;
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

/** POOLS d'ids par catégorie Codex, pour les familles dont le foyer DESCEND à l'entrée jouée. Une
 *  catégorie de plus = une ligne ICI (le dataset la NOMME, il ne code pas sa résolution). */
const STAKE_ENTRY_POOLS: Record<string, (id: string) => boolean> = {
  symptoms: (id) => symptoms.some((s) => s.id === id),
  seaShanties: (id) => !!findSeaShantyById(id),
  crewTestTypes: (id) => crewTestTypes.some((t) => t.id === id),
  maladies: (id) => !!findDiseaseById(id),
  psychologies: (id) => !!findPsychologyById(id),
  maneuvers: (id) => !!findManeuverById(id),
  spells: (id) => !!findSpellById(id),
  // Familles à TABLE (#1117 L2 vague 4b) : la LIGNE tirée est déjà une entrée Codex éditable — son
  // foyer est SA fiche, jamais une fiche de règle doublon (amendement A). La catégorie voyage avec
  // l'id, versée par la re-pose post-tirage (`stakeAtTableRow`, `state/cascade.ts`).
  criticalsTete: (id) => critiqueEntries('criticals-ldb-tete').some((r) => r.id === id),
  criticalsBras: (id) => critiqueEntries('criticals-ldb-bras').some((r) => r.id === id),
  criticalsCorps: (id) => critiqueEntries('criticals-ldb-corps').some((r) => r.id === id),
  criticalsJambe: (id) => critiqueEntries('criticals-ldb-jambe').some((r) => r.id === id),
  aaCriticalsTete: (id) => critiqueEntries('criticals-aa-tete').some((r) => r.id === id),
  aaCriticalsBras: (id) => critiqueEntries('criticals-aa-bras').some((r) => r.id === id),
  aaCriticalsCorps: (id) => critiqueEntries('criticals-aa-corps').some((r) => r.id === id),
  aaCriticalsJambe: (id) => critiqueEntries('criticals-aa-jambe').some((r) => r.id === id),
  structureCriticals: (id) => structureCriticalRows.some((r) => r.id === id),
  // Critiques de COQUE : une catégorie Codex par jeu × Localisation (`registry.ts`, clusters
  // « Critiques de navire » / « Critiques fluviaux »). Dérivées des jeux CHARGÉS, jamais recopiées :
  // une Localisation de plus dans un `.json` entre ici sans une ligne de code.
  ...shipCritPools(SHIP_CRIT_SET, 'shipCriticals'),
  ...shipCritPools(RIVER_CRIT_SET, 'riverCriticals'),
  miscastMinor: (id) => miscastMinorRows.some((r) => r.id === id),
  miscastMajor: (id) => miscastMajorRows.some((r) => r.id === id),
  miscastWrath: (id) => miscastWrathRows.some((r) => r.id === id),
  mutations: (id) => mutations.some((m) => m.id === id),
  mutationTables: (id) => mutationTables.some((t) => t.id === id),
  interludeEvents: (id) => interludeEvents.some((e) => e.id === id),
  // Un jeu de taverne PORTE sa règle (sa fiche Codex la recopie verbatim) : c'est le foyer des effets
  // qu'une partie inflige (l'ivresse d'un jeu à boire, NADJ 16 l.90).
  tavernGames: (id) => (tavernGamesJson as { id: string }[]).some((g) => g.id === id),
  // Catégories atteignables par l'ENTITÉ SOURCE d'un effet (`CATEGORY_BY_SOURCE_KIND`, engine/types) —
  // la table est TOTALE côté source, donc le pool l'est aussi : sans elles, un jet exigé par un objet
  // ou un Talent replierait en silence sur le foyer de son `kind`.
  talents: (id) => talents.some((t) => t.id === id),
  traits: (id) => traits.some((t) => t.id === id),
  trappings: (id) => trappings.some((t) => t.id === id),
  qualities: (id) => qualities.some((q) => q.id === id),
  etats: (id) => etats.some((e) => e.id === id),
  creatures: (id) => creatures.some((c) => c.id === id),
  regles: (id) => regles.some((r) => r.id === id),
  activities: (id) => ACTIVITY_STAKES.some((a) => a.id === id),
  // La COMPÉTENCE testée est le foyer quand le jet n'existe que par elle (cumuler l'Avantage :
  // Intuition/Savoir/Survie/Prière portent chacune SA phrase de combat, LDB 09).
  skills: (id) => !!byId('skill', id),
};

/** Rangées BRUTES des tables tirées par une étape, réduites à leur id — le résolveur d'enjeu n'a
 *  besoin que du pool d'ids, et les lit sur le MÊME JSON que le Codex édite. */
const structureCriticalRows = (structureCriticalsRawJson as { entries: { id: string }[] }).entries;

/** POOLS d'ids d'un jeu de Critiques de coque, une entrée par Localisation — les clés sont celles des
 *  catégories Codex (`shipCriticalsGreement`…), et la MEME dérivation (préfixe + segment capitalisé)
 *  que `shipCritEntryCodexCategory` (`engine/shipCritical.ts`) côté producteur. */
function shipCritPools(set: ShipCritSet, prefixe: string): Record<string, (id: string) => boolean> {
  return Object.fromEntries(Object.entries(set.tables).map(([loc, rows]) => [
    `${prefixe}${loc[0].toUpperCase()}${loc.slice(1)}`,
    (id: string) => (rows ?? []).some((r) => r.id === id),
  ]));
}
const miscastDocs = miscastRawJson as unknown as { id: string; entries: { id: string }[] }[];
/** Rangées d'UN tableau d'Incantation Imparfaite, par id de DOCUMENT (`miscast.json`) — FAIL-FAST :
 *  un id absent rendrait le résolveur d'enjeu silencieusement aveugle. */
function miscastRowsOf(tableId: string): { id: string }[] {
  const doc = miscastDocs.find((d) => d.id === tableId);
  if (!doc) throw new Error(`miscastRowsOf : tableau « ${tableId} » absent de miscast.json (ids : ${miscastDocs.map((d) => d.id).join(', ')}).`);
  return doc.entries;
}
const miscastMinorRows = miscastRowsOf('miscast-mineure');
const miscastMajorRows = miscastRowsOf('miscast-majeure');
const miscastWrathRows = miscastRowsOf('miscast-colere');

/** CATALOGUE d'ENTRÉES d'un `kind` : où vit la fiche de l'entrée JOUÉE, quand la clé en nomme une.
 *  Déclaratif — ajouter une famille à entrées (tables régionales de Lustrie, périls…) = une ligne ICI,
 *  jamais un `if` par kind au rendu. La famille MALADIE l'énumère (les trois étapes de maladie jouent
 *  un SYMPTÔME nommé) ; les jets de modale mono la DÉRIVENT de leur donnée (`entryCategory`). */
const STAKE_ENTRY_CATALOG: Record<string, { category: string; has: (id: string) => boolean }> = {
  diseaseTick: { category: 'symptoms', has: (id) => symptoms.some((s) => s.id === id) },
  diseaseGangrene: { category: 'symptoms', has: (id) => symptoms.some((s) => s.id === id) },
  diseasePersist: { category: 'symptoms', has: (id) => symptoms.some((s) => s.id === id) },
  ...Object.fromEntries(
    (flowStakesJson as FlowStakeEntry[])
      .filter((e) => e.entryCategory)
      .map((e) => [flowKind(e.flow, e.phase), { category: e.entryCategory!, has: STAKE_ENTRY_POOLS[e.entryCategory!] ?? (() => false) }]),
  ),
  ...Object.fromEntries(
    (combatStakesJson as CombatStakeEntry[])
      .filter((e) => e.entryCategory)
      .map((e) => [e.kind, { category: e.entryCategory!, has: STAKE_ENTRY_POOLS[e.entryCategory!] ?? (() => false) }]),
  ),
};

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
 *  (a) DÉCLARATIVE : le `kind` figure au catalogue `STAKE_ENTRY_CATALOG` (dataset ou énumération),
 *      sa catégorie est la même à chaque tirage — porte par défaut, elle PRIME sur les suivantes.
 *  (b) DYNAMIQUE BORNÉE : le producteur fournit `key.entryCategory`, valide seulement si le nom
 *      figure dans `STAKE_ENTRY_POOLS` — pour un `kind` jouant sur N catégories connues au tirage
 *      (les Critiques par localisation).
 *  (c) PAR LA SOURCE : le dataset pose `entryFromSource: true` (schéma `defs/combat-stakes.ts`),
 *      qui déclare que la catégorie ne se connaît qu'au RUNTIME — le producteur la tire de
 *      `ActiveEffect.source` (`CATEGORY_BY_SOURCE_KIND`) et la verse par la porte (b) ; le kind
 *      `actGate` en vit (un même gate est exigé par un objet, un Talent, une maladie…).
 *      CRITÈRE : `entryFromSource` ne se déclare que si la catégorie est irréductiblement dynamique
 *      (le même `kind` sert N natures de source) — si une déclaration statique peut la dire, c'est
 *      (a) ou (b). */
function entryCategoryOf(key: StakeKey): { category: string; has: (id: string) => boolean } | undefined {
  const declared = STAKE_ENTRY_CATALOG[key.kind];
  if (declared) return declared;
  const dyn = key.entryCategory;
  return dyn && STAKE_ENTRY_POOLS[dyn] ? { category: dyn, has: STAKE_ENTRY_POOLS[dyn] } : undefined;
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
  // La fiche de l'ENTRÉE jouée PRIME sur celle du `kind` (une étape « Blessé » renvoie au symptôme
  // Blessé, pas à l'intro du chapitre des maladies) ; à défaut, la fiche du kind.
  const kindRule = (id?: string, category = 'regles') => entryRule(key) ?? (id ? { category, id } : undefined);
  if (key.dataset === 'night') {
    const e = NIGHT_STAKES.find((x) => x.kind === key.kind);
    if (!e) return undefined;
    // Le FOYER peut être une entité (compétence, État, symptôme) — sa catégorie voyage avec l'id.
    const rule = kindRule(e.rule, e.ruleCategory ?? 'regles');
    return { text: e.stake, ...(rule ? { rule } : {}) };
  }
  if (key.dataset === 'weather') {
    // MÉTÉO : l'enjeu de la traversée vit sur la CONDITION (`weather.json`, `resistanceTest.enjeu`) —
    // key.kind = l'id de météo. Même porte, même fail-closed : pas d'entrée → pas d'enjeu.
    const rt = weatherData.conditions.find((c) => c.id === key.kind)?.resistanceTest;
    return rt?.enjeu ? { text: rt.enjeu } : undefined;
  }
  if (key.dataset === 'flow') {
    // MODALES MONO : `key.kind` = l'id de jet `{flow, phase}` aplati. Le FOYER est l'entité porteuse
    // déclarée par l'entrée ; l'ENTRÉE JOUÉE (chanson, type de Test d'équipage) prime quand la clé la nomme.
    const e = FLOW_STAKES.find((x) => flowKind(x.flow, x.phase) === key.kind);
    if (!e) return undefined;
    const rule = kindRule(e.rule, e.ruleCategory ?? 'regles');
    return { text: entryText(key) ?? e.template, ...(rule ? { rule } : {}) };
  }
  if (key.dataset === 'combat') {
    // COMBAT : `key.kind` = le `kind` de l'applier de cascade. Même règle de foyer que `flow` —
    // l'ENTRÉE JOUÉE (la maladie contractée, la manœuvre subie, le sort prolongé) prime sur le kind.
    const e = COMBAT_STAKES.find((x) => x.kind === key.kind);
    if (!e) return undefined;
    const rule = kindRule(e.rule, e.ruleCategory ?? 'regles');
    // Entrée SANS gabarit : le foyer voyage seul (aucune phrase à rendre — l'issue se lit en chips).
    const text = entryText(key) ?? e.template;
    return { ...(text ? { text } : {}), ...(rule ? { rule } : {}) };
  }
  if (key.dataset === 'activity') {
    // ACTIVITÉS : `key.kind` = l'id de l'`ActivityDef`. Le FOYER par DÉFAUT est l'Activité ELLE-MÊME
    // (catégorie Codex `activities`, où vit sa `desc` verbatim) — une fiche `regles.json` doublon
    // serait le péché de l'amendement A. Une entrée peut NOMMER un autre foyer (`rule`) quand la
    // règle vit ailleurs (Augure → la table des Symboles).
    const e = ACTIVITY_STAKES.find((x) => x.id === key.kind);
    if (!e?.stake) return undefined;
    return { text: e.stake, rule: e.rule ? { category: e.ruleCategory ?? 'regles', id: e.rule } : { category: 'activities', id: e.id } };
  }
  const e = VOYAGE_STAKES.find((x) => x.kind === key.kind);
  if (!e) return undefined;
  const rule = kindRule(e.rule, e.ruleCategory ?? 'regles');
  return { text: e.template, ...(rule ? { rule } : {}) };
}

/** RÉFÉRENCE d'enjeu de VOYAGE — valide le `kind` À LA CONSTRUCTION (fail-closed au plus tôt : une
 *  étape qui LANCE et dont l'enjeu n'existe pas ne se construit pas). */
export function voyageStakeRef(kind: string, values?: Record<string, string | number>): StakeRef {
  if (!stakeEntry({ dataset: 'voyage', kind })) {
    throw new Error(`voyageStakeRef('${kind}') : aucun gabarit d'enjeu (voyage-stakes.json) — une étape qui LANCE dit ce qu'elle met en jeu`);
  }
  return { key: { dataset: 'voyage', kind }, ...(values ? { values } : {}) };
}

/** RÉFÉRENCE d'enjeu de COMBAT (#1117 L2) — patron `voyageStakeRef` : le `kind` se valide À LA
 *  CONSTRUCTION (fail-closed au plus tôt). `entryId` = l'ENTRÉE JOUÉE quand l'étape en nomme une dans
 *  son `meta` (la maladie contractée, la manœuvre subie, le sort prolongé) : le renvoi descend alors à
 *  SA fiche ; un id inconnu replie sur le foyer du `kind` (déclaré, jamais silencieux). */
export function combatStakeRef(
  kind: string,
  opts?: { entryId?: string; entryCategory?: string; values?: Record<string, string | number> },
): StakeRef {
  if (!stakeEntry({ dataset: 'combat', kind })) {
    throw new Error(`combatStakeRef('${kind}') : aucune entrée d'enjeu (combat-stakes.json) — une étape de combat qui LANCE dit ce qu'elle met en jeu`);
  }
  return {
    key: {
      dataset: 'combat', kind,
      ...(opts?.entryId ? { entryId: opts.entryId } : {}),
      // Catégorie FOURNIE par le producteur, pour les kinds dont le dataset ne peut pas la déclarer
      // (`entryFromSource` : l'entité source d'un effet peut être de n'importe quelle nature).
      ...(opts?.entryCategory ? { entryCategory: opts.entryCategory } : {}),
    },
    ...(opts?.values ? { values: opts.values } : {}),
  };
}

/** RÉFÉRENCE d'enjeu de NUIT — même patron fail-closed que `voyageStakeRef` : le TYPE ferme le
 *  vocabulaire (`NightTestKind`, 16 kinds) en PREMIER rideau, le throw est le second. Plus de
 *  `undefined` rendu en silence : une étape de nuit qui existe a son enjeu authoré.
 *  `entryId` = l'ENTRÉE JOUÉE quand le kind en a une (symptôme d'une étape de maladie) : la fiche
 *  renvoyée descend alors à CETTE entrée. Un id inconnu replie sur la fiche du kind (déclaré). */
export function nightStakeRef(kind: NightTestKind, entryId?: string): StakeRef {
  if (!stakeEntry({ dataset: 'night', kind })) {
    throw new Error(`nightStakeRef('${kind}') : aucune entrée d'enjeu (night-stakes.json) — une étape de nuit qui LANCE dit ce qu'elle met en jeu`);
  }
  return { key: { dataset: 'night', kind, ...(entryId ? { entryId } : {}) } };
}

/** L'Activité a-t-elle son enjeu authoré ? PRÉDICAT de la MÊME porte que `activityStakeRef` — pour
 *  les surfaces qui rendent un catalogue MIXTE (le volet d'Activité sert aussi celles SANS Test, qui
 *  n'ont rien à mettre en jeu) sans connaître le stock ni rattraper un throw. */
export function hasActivityStake(activityId: string): boolean {
  return !!stakeEntry({ dataset: 'activity', kind: activityId });
}

/** RÉFÉRENCE d'enjeu d'une ACTIVITÉ (#1117 L3) — patron `voyageStakeRef` : l'id se valide À LA
 *  CONSTRUCTION. Le renvoi vise le foyer déclaré, à défaut la fiche Codex de l'Activité elle-même. */
export function activityStakeRef(activityId: string): StakeRef {
  if (!stakeEntry({ dataset: 'activity', kind: activityId })) {
    throw new Error(`activityStakeRef('${activityId}') : aucun enjeu authoré (activities.json) — une Activité qui LANCE dit ce qu'elle met en jeu`);
  }
  return { key: { dataset: 'activity', kind: activityId } };
}

/** RÉFÉRENCE d'enjeu de MÉTÉO (Test de Résistance de traversée) — fail-closed : l'appelant n'appelle
 *  QUE si la condition déclare un Test (`weatherResistanceTest`), une météo sans enjeu JETTE. */
export function weatherStakeRef(weatherId: string): StakeRef {
  if (!stakeEntry({ dataset: 'weather', kind: weatherId })) {
    throw new Error(`weatherStakeRef('${weatherId}') : aucun enjeu déclaré (weather.json, resistanceTest.enjeu)`);
  }
  return { key: { dataset: 'weather', kind: weatherId } };
}

/** RÉFÉRENCE d'enjeu d'une MODALE MONO (#1117 L1b) — patron `voyageStakeRef` : le couple `{flow, phase}`
 *  se valide À LA CONSTRUCTION (fail-closed au plus tôt), la `phase` venant TOUJOURS d'un champ d'état
 *  du pending. `entryId` = l'ENTRÉE JOUÉE quand le jet en nomme une (la chanson chantée, le type de
 *  Test d'équipage) : le renvoi descend alors à SA fiche ; un id inconnu replie sur le foyer du jet.
 *
 *  ASYMÉTRIE ASSUMÉE vs `nightStakeRef` (dont le TYPE ferme le vocabulaire, `NightTestKind`) : ici les
 *  deux moitiés sont des `string`. Une union TS dérivée du dataset est impraticable sans codegen
 *  (`resolveJsonModule` élargit tout littéral JSON en `string`), et une union manuscrite serait une 2ᵉ
 *  source du même vocabulaire (le péché que #1117 combat). La fermeture vit donc au TEST, où les deux
 *  vraies autorités sont confrontables : `state/flow-stake-coverage.test.ts` croise l'union de phase de
 *  CHAQUE pending câblé (`Record<union, true>` → `tsc` rouge si l'union s'élargit) et la donnée éditable
 *  (`etats.recover`, dans les deux sens) avec ce dataset. Le throw ci-dessous reste le SECOND rideau. */
/** L'id de jet `{flow, phase}` a-t-il son entrée d'enjeu ? PRÉDICAT de la MÊME porte que
 *  `flowStakeRef` (aucune seconde résolution) — pour les surfaces qui listent des jets dont SEULS
 *  CERTAINS sont authorés (le menu d'infirmerie : ses actes de Guérison le sont, la rééducation non).
 *  Elles n'ont ainsi ni à connaître le stock, ni à rattraper un throw. */
export function hasFlowStake(flow: string, phase: string): boolean {
  return !!stakeEntry({ dataset: 'flow', kind: flowKind(flow, phase) });
}

export function flowStakeRef(
  flow: string,
  phase: string,
  opts?: { entryId?: string; values?: Record<string, string | number> },
): StakeRef {
  const kind = flowKind(flow, phase);
  if (!stakeEntry({ dataset: 'flow', kind })) {
    throw new Error(`flowStakeRef('${kind}') : aucune entrée d'enjeu (flow-stakes.json) — une modale qui LANCE dit ce qu'elle met en jeu`);
  }
  return {
    key: { dataset: 'flow', kind, ...(opts?.entryId ? { entryId: opts.entryId } : {}) },
    ...(opts?.values ? { values: opts.values } : {}),
  };
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
  const text = entry.text?.replace(/\{(\w+)\}/g, (_m, name: string) => {
    const v = ref.values?.[name];
    if (v == null) throw new Error(`resolveStake('${ref.key.dataset}/${ref.key.kind}') : valeur manquante pour « ${name} »`);
    return String(v);
  });
  return { ...(text ? { text } : {}), ...(entry.rule ? { rule: entry.rule } : {}) };
}

export interface SpeciesData {
  /** id STABLE (slug du libellé) — cible de `Combatant.species`, pregens, draft. Le `label` ne sert
   *  qu'à l'affichage (`speciesSingular`). */
  id: string;
  label: string;
  /** Race (famille d'espèces) pour le groupage d'affichage : « Humains (Middenheim) » → « Humains ».
   *  DONNÉE requise (garde-fou data-wellformed) — plus aucune dérivation regex du libellé. */
  family: string;
  /** Variante régionale/sous-espèce (« Middenheim », « Norse »…) — absent pour l'espèce nominale. */
  variant?: string;
  /** id STABLE (`RaceKey`, #313) — colonne des tables Âge/Taille/Yeux/Cheveux (`ageBase`/`ageRoll`/
   *  `heightBase`/`heightRoll`/`hairs.color`/`eyes.color`). */
  refChar: RaceKey;
  /** id STABLE (`RefCareerId`, #313) — colonne du Tableau des Classes et Carrières aléatoires
   *  (`CareerData.rand`). */
  refCareer: RefCareerId;
  rand: number;
  desc: string;
  movement: number;
  fate: { fate: number; resilience: number; extra: number };
  baseChar: Partial<Record<CharKey, number>>;
  /** Compétences d'espèce (`AdvancementRef[]` ; positionnel +5/+3 — lu via `advancementLabel`). */
  skills: AdvancementRef[];
  /** Talents d'espèce (`AdvancementRef[]` : réf, `{pick}` « A ou B », `{random}` « N aléatoire », `choix`). */
  talents: AdvancementRef[];
  source: SourceRef;
  /** Ids de `groups.json` de l'espèce (Traits psy ciblés, LDB 21) : racial, plus la sous-espèce
   *  quand elle porte son propre Groupe (« Humains (Tiléens) » → `humain` + `tileen`). Lus tels
   *  quels par `groupsFor` (`engine/groups`), qui ne dérive plus rien du `label`. */
  grantGroups: string[];
  /** Profil standard du PNJ de l'espèce (`LDB 77 l.7`) — réf à `creatures.json`, posée par espèce.
   *  Absent = aucun profil standard (`gnomes`). */
  profilStandard?: { id: string };
  /** Seuil d100 de mutation PHYSIQUE (LDB 19 l.78-81 : d100 ≤ seuil → corps, sinon esprit) :
   *  Elfe 0, Nain 5, Halfling 10, Humain 50. Ogre 10 (ADE II « Ogres et Mutations »). ABSENT = défaut
   *  Humain (50) — le Gnome y est rattaché par NADJ « Gnomes et Corruption » (« mutent comme les humains »). */
  mutationBodyMax?: number;
  /** Habillage de l'APERÇU (créateur, carte de race #431) — id de carrière ICONIQUE et COMMUNE à
   *  l'espèce (flavor de vitrine, pas une règle) : la tuile de famille montre un personnage vêtu
   *  plutôt qu'une tunique nue. Absent = pas de tenue (repli existant). */
  previewCareer?: { id: string };
  /** Trait RACIAL de l'espèce (#572) — MÊME forme structurée que les Traits de créature du bestiaire
   *  (`import('../engine/statEntry').TraitInstance`, jamais une glose de règle en `desc`) : Ogre porte
   *  `{id:'ogre'}` (ADE2 « Ogres et Mutations » l.708 « Un Lourd Fardeau », encombrance/consommation
   *  ×2 lues par `traitEncumbranceFactor`/`traitConsumptionFactor` sur `Combatant.traits`). La Taille
   *  (LDB 85 l.342) N'EST PAS un trait — elle est portée par le TALENT Massif/Petit (déjà présent
   *  dans `talents`, lu par `createHero`). Posé sur `Combatant.traits` à `createHero`. Absent = aucun
   *  trait racial mécanique (espèce sans règle raciale hors talents/skills). */
  traits?: import('../engine/statEntry').TraitInstance[];
  /** Domaines magiques multiples (`VDM 02 l.190` / `LDB 46 l.177`, « lanceur de sorts elfe ») —
   *  Caractéristique dont le Bonus fixe le plafond de Domaines NON sombres du Talent
   *  `magie-des-arcanes` (`careerSlots.arcaneDomainCap`). Absent = plafond 1 (hors elfe). */
  arcaneDomainsBonusOf?: CharKey;
  /** id d'`OptionalRule` (`src/data/reglesOptionnelles.json`) dont l'activation OUVRE l'espèce au
   *  joueur — lu par `speciesAllowed` (`engine/creation`). Absent = espèce ouverte sans condition.
   *  Portée sur `gnomes` (`NADJ 14 l.5`, règle `creation-gnome-jouable`). */
  gatedByRule?: string;
}
export interface ClassData {
  /** id STABLE (slug du libellé) — cible de `CareerData.class`. */
  id: string;
  type: 'classes';
  label: string;
  /** Ids de `groups.json` accordés à tout titulaire d'une carrière de cette Classe (`groupsFor`) —
   *  ex. la classe des Roublards ouvre le Groupe « Criminel ». Absent = aucun Groupe. */
  grantGroups?: string[];
  /** Possessions de départ (`TrappingRef` : id du catalogue + quantité, ou `{text}` flavor hors catalogue). */
  trappings: TrappingRef[];
  desc: string;
  source: SourceRef;
}
export interface CareerData {
  /** id STABLE (slug du libellé) — cible de `Combatant.career`, `CareerLevelData.career`, pregens. */
  id: string;
  type: 'careers';
  label: string;
  /** Forme féminine d'AFFICHAGE (le LDB n'imprime que le masculin — féminisation standard MAISON) ;
   *  absent = forme épicène (identique au masculin). Lu par `careerLabelFor` (bord UI). */
  labelF?: string;
  /** `id` de la Classe (`ClassData.id`) — réf d'entité, ≠ libellé. */
  class: string;
  /** Ids de `groups.json` accordés au titulaire de cette carrière (`groupsFor`), en plus de ceux de
   *  sa Classe. Absent = la carrière n'ouvre aucun Groupe d'appartenance. */
  grantGroups?: string[];
  /** id d'une tenue spécifique (`TENUE_BY_ID`) réutilisée par cette carrière quand son rendu
   *  reprend la tenue d'une autre carrière (variants MDG « (Côtier) », MDG 09 l.255/343/458). */
  tenue?: string;
  /** Tableau des Classes et Carrières aléatoires (LDB 05 l.197+) : borne haute d100 par colonne
   *  d'espèce (`SpeciesData.refCareer`). Clé ABSENTE = carrière INDISPONIBLE pour cette espèce (l.360). */
  rand: Partial<Record<RefCareerId, number | null>>;
  desc: string;
  source: SourceRef;
}
export interface CareerLevelData {
  /** Identité du niveau — composite `<career>-<level>` (`agitateur-1`). */
  id: string;
  type: 'careerLevels';
  label: string;
  /** Forme féminine d'AFFICHAGE du niveau (MAISON, cf. `CareerData.labelF`) ; absent = épicène. */
  labelF?: string;
  /** `id` de la Carrière (`CareerData.id`) — réf d'entité, ≠ libellé. */
  career: string;
  level: number;
  /** Compétences/talents d'emplacement (`AdvancementRef[]` : réf / `choix` / `{pick}`) — lus via
   *  `advancementLabel` (slotsOfLevel) ou structure. */
  skills: AdvancementRef[];
  talents: AdvancementRef[];
  /** Possessions de niveau (`TrappingRef` : id catalogue + quantité « (3) », ou `{text}` flavor). */
  trappings: TrappingRef[];
  /** Caractéristiques de carrière (clés `CharKey` — « CT », « F »… ; pas de libellé, multilangue). */
  characteristics: CharKey[];
  status: string;
}
/** Entrée `specs[]` d'une Compétence/Talent — id STABLE (résolu par `specLabel`, cf. `langue`/
 *  `chevaucher`/`discretion`/`art`/talent `resistance`) + libellé d'affichage FR. Un domaine
 *  `specsSource` n'a PAS de `specs[]` (le pool DÉRIVE du registre partagé, cf. `specPoolOf`).
 *  `pool: false` — l'entrée est VALIDE (résolution, `testValue`, bonus de règle) mais n'est pas
 *  PROPOSÉE d'office par le créateur/l'avancement (`LDB 09 l.40`) ; les écrans de RÉFÉRENCE
 *  l'impriment (`specCatalogOf`). Absente = dans le pool. VALIDITÉ ⊇ POOL, cf. `specResolves`. */
export type SpecEntry = { id: string; label: string; source?: SourceRef; alsoIn?: SecondaryRef[]; pool?: false };
/** id d'une entrée `specs[]`. */
export function specEntryId(e: SpecEntry): string {
  return e.id;
}
/** Libellé d'affichage d'une entrée `specs[]`. */
export function specEntryLabel(e: SpecEntry): string {
  return e.label;
}
/** Registre partagé qui DÉRIVE le pool d'ids d'une `specs[]` (résolu en libellé par `specLabel`, énuméré
 *  par `wildcardSpecs`) — chaque valeur pointe UNE entrée du catalogue `SPEC_SOURCES` (SSOT, fin des
 *  `specs[]` maintenues à la main qui dérivaient) : `weaponGroupsMelee`/`weaponGroupsRanged` (Corps à
 *  corps / Projectiles — ids de `weaponGroups.json` filtrés par `combat`), `winds` (Focalisation —
 *  Domaines à `wind` de `domains.json`, AFFICHE le Vent), `arcaneDomains` (Magie des Arcanes — Domaines
 *  `arcane` de `domains.json`, AFFICHE le Lore), `cultBlessings`/`cultMiracles`/`cultChaos` (Béni /
 *  Invocation / Magie du Chaos — `gods.id` filtrés par `blessings`/`miracles`/`chaosSpells`, AFFICHE le
 *  nom du dieu), `seaShanties` (Chanson de marin — ids de `sea-shanties.json`). Sources d'ARGUMENT de Trait
 *  (Immunité, Peur, Vulnérabilité, Mutation, Souffle…) : `groups` (Groupe d'appartenance — `groups.json`),
 *  `diseases` (Maladie — `maladies.json`), `sizes` (catégorie de Taille — `engine/size`), `mutations`
 *  (Mutation — `mutations.json`), `breathTypes` (Type de Souffle — `breath-types.json`), `damageTypes`
 *  (Immunité aux Dégâts — `damage-types.json`, matché aussi par `unlessImmune` des Flows), `weaponsMelee`/
 *  `weaponsRanged` (Arme / À distance, LDB 85 l.33/9 — `arg` = une arme PRÉCISE du catalogue `trappings`
 *  filtrée par `type`, `specsOpen` car ces traits acceptent aussi une attaque naturelle/générique hors
 *  catalogue). Absent = specs inline (`SpecEntry[]`). */
export type SpecsSource =
  | 'weaponGroupsMelee'
  | 'weaponGroupsRanged'
  | 'winds'
  | 'arcaneDomains'
  | 'cultBlessings'
  | 'cultMiracles'
  | 'cultChaos'
  | 'seaShanties'
  | 'groups'
  | 'diseases'
  | 'sizes'
  | 'mutations'
  | 'breathTypes'
  | 'damageTypes'
  | 'weaponsMelee'
  | 'weaponsRanged';
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
   *  valeur `spec` d'une instance DOIT être un id de `specs[]` (garde-fou `refs-migrated.test.ts`). */
  specsOpen?: boolean;
  desc: string;
  source: SourceRef;
  /** Test « impliquant un déplacement » (LDB 16 l.35/64) : ciblé par les pénalités d'État À Terre /
   *  Empêtré (`movementOnly`). Classification de COMPÉTENCE portée par la DONNÉE (éditable au Codex),
   *  lue par `engine/conditions.testStatePenalty`, jamais par une liste d'ids en dur. */
  movement?: boolean;
  /** Test « impliquant l'audition » (LDB 16 l.29) : ciblé par la pénalité d'État Assourdi (`hearingOnly`).
   *  Classification de COMPÉTENCE portée par la DONNÉE (Perception — l'ouïe est un de ses sens), lue par
   *  `engine/conditions.testStatePenalty`. Approximation assumée : le −10 d'Assourdi ne s'applique qu'aux
   *  Tests des Compétences marquées `hearing` (faute d'un tag « ce Test précis fait appel à l'ouïe »). */
  hearing?: boolean;
  /** Caractéristique ALTERNATIVE de cette Compétence sous RÈGLE OPTIONNELLE (Métier comme Savoir → Int,
   *  `LDB 09 l.358` ; Intimidation → FM/Int, `LDB 09 l.294`) : `gatedByRule` = id d'`OptionalRule`
   *  (FK anti-fantôme `data/variants-integrity.test.ts`), `from` = Caractéristique de base à laquelle la
   *  substitution s'applique (absente = toutes), `chars` = Caractéristique à utiliser PAR VALEUR de la
   *  règle (clé = valeur rendue par `rule()` convertie en chaîne — `"true"` pour un interrupteur ; une
   *  LISTE = la MEILLEURE des Caractéristiques citées chez le porteur). Lu par `altCharKey`
   *  (`engine/skills`), POINT UNIQUE : le moteur ne nomme plus aucune compétence. */
  altChar?: {
    gatedByRule: string;
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
   *  = condition d'accès (`fear` : l'adversaire est sous une Peur/intimidation SOURCÉE par ce personnage).
   *  Lu par `engine/skillCombatApps`. */
  combatSubstitute?: { role: 'defense' | 'attack' | 'both'; gate: 'fear' };
  /** OUTIL requis par la Compétence (Crochetage → outils de crochetage, LDB 09 l.168 : « Les Niveaux de
   *  Difficulté supposent l'utilisation d'outils de crochetage. Des crochets improvisés… peuvent être
   *  utilisés avec une pénalité de -10 ») : `capability` = clé `ItemCapabilities` que doit porter un
   *  objet POSSÉDÉ de l'acteur (lecture NON gatée sur le port, comme `isRations`) ; sans un tel objet,
   *  `withoutMod` s'applique au Test (`testValue`). GÉNÉRIQUE — toute compétence-à-outil se déclare en
   *  donnée (skills.json), zéro code par objet. */
  tool?: { capability: keyof ItemCapabilities; withoutMod: number };
}
/** UN « matcher » de Test (recodage de la ligne « Tests : » du livre, cf. `TalentTest`) : à quel(s)
 *  Test(s) le talent se rapporte. `skill` (référence de Compétence `{id, spec?}`, XOR `char`) OU `char`
 *  (Caractéristique nue). La `spec` de la référence est la spécialisation FIXE ; `specFromInstance` =
 *  « (Au choix) » → matche la spec CHOISIE de l'instance (`t.spec`). `when` = contexte MÉCANISABLE (Condition combat — auto si vraie) ; `manual` =
 *  contexte NARRATIF inmécanisable (« quand vous soulevez ») → advisory, JAMAIS auto-appliqué. */
export interface TestMatch {
  skill?: Ref;
  char?: import('../engine/types').CharKey;
  specFromInstance?: boolean;
  /** EXCLUT une spécialisation (matche toute spec SAUF celle-ci) — Linguistique « Langue (toutes) » qui
   *  « ne fonctionne pas avec Langue (Magick) » : `{ skill:{id:'langue'}, exceptSpec:'magick' }`. */
  exceptSpec?: string;
  when?: import('../state/flow').Condition;
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
  max: number | { bonusOf: import('../engine/types').CharKey } | null;
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
  /** Le `spec` de ce Talent nomme un CULTE (`GodData.id`) dont les `grantGroups` sont accordés au
   *  porteur (`groupsFor`) — Béni (Sigmar) fait un « sigmarite ». Absent = aucun Groupe. */
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
  /** Borne haute de plage d100 sur le Tableau des Talents aléatoires (null = hors table). */
  rand?: number | null;
  source: SourceRef;
  /** Emplacements SECONDAIRES du même Talent (`sourceRefs.ts`), l'ancre `source` restant la seule à
   *  porter la `desc`. */
  alsoIn?: SecondaryRef[];
  /** Effets MÉCANIQUES authorés (déclencheur → ops du Flow) — Talents « effet sur événement » (Assaut
   *  féroce `onHit`, Frappe réactive `onCharged`…), appliqués par `state/triggeredEffects` exactement comme
   *  les traits. Type-only (le moteur reste pur). Édité au Codex par `TriggeredEffectsField`. */
  effects?: import('../state/flow').TriggeredEffect[];
  /** Modificateurs PASSIFS continus (Coup puissant, Dur à cuire…) en `GameOp[]` — MÊME vocabulaire que les
   *  sorts/traits, lus par le collecteur passif (`talentPassiveMods` → `passiveMods`, kind `intrinseque`,
   *  répété par niveau). Édité au Codex par `GameOpEditor`. L'octroi d'attaque gratuite (Frénésie) vit ici :
   *  `grantFreeAttack{when:'available'}`, lu par `availableAttacks`. */
  passive?: import('../engine/ops').GameOp[];
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
   *  `WeaponContext.harpoonRopeCut` (`effectiveWeapon`, `state/combatFlow.ts` `weaponContextOf`), choisi
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
  /** `id` du Groupe d'objet (`WeaponGroupData.id`) : Groupe d'arme (Base/Escrime…), famille de munition
   *  (Arc/Poudre noire…), type d'armure (Plate/Mailles…) ou catégorie d'inventaire — réf d'entité, ≠ libellé. */
  subType: string | null;
  /** Groupe de Projectiles qui OPÈRE une arme de siège (`WeaponGroupData.id` : arbalete/catapulte/ingenierie/
   *  poudre-noire, AA 10 l.178-193) quand `subType` = catégorie de catalogue (« armes-de-siege »). Pilote
   *  la Spé de tir (`acceptableSpecs`) et le décompte d'équipage (Projectiles appropriée, AA 10 l.230). */
  weaponGroup?: string;
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
  /** Engin de siège POSABLE : id de la def rig `creatures/defs/<Engin>.ts` (plan 'engin') dessinant
   *  l'affût rendu en emplacement. Pur ROUTAGE D'APPARENCE (≠ règle), comme `shape` route l'art d'arme.
   *  Absent ⇒ l'arme n'est pas posable comme emplacement (pas d'art d'affût). */
  siegeRig?: string;
  /** `id` de munition REPRÉSENTATIVE (`TrappingData.id`, `categorie:'ammunition'`) d'une arme de siège — les
   *  familles `armes-de-siege`/`munition-de-siege` (`ammoFamily`) regroupent des munitions non-interchangeables
   *  (carreau de baliste ≠ boulet de canon ≠ bombe de mortier ≠ balles de pierrier, MDG 12 l.410-424) ; le
   *  `subType` seul ne discrimine pas la bonne famille pour le hint joueur. Propagé jusqu'à `Weapon`,
   *  résolu en libellé FR par `ammoFamilyLabel`. Absent = hint générique de la famille (`ammoFamilyLabel`). */
  defaultAmmo?: string;
  /** EMPREINTE de grille (côté N×N) de l'affût POSÉ en combat — recopiée sur `Combatant.footprint`
   *  (`footprintN`), MÊME champ que `VehicleData.ship.footprint`. ADE II 8 l.239/258 (profil + description
   *  physique du tronc suspendu sur portique à roues) ne chiffre aucune Taille en cases : la valeur posée
   *  en donnée (2, belier-ade2, #210) reste éditable au Compendium plutôt que codée en dur ailleurs. Absent
   *  = empreinte 1 (affûts compacts type baliste/canon). */
  siegeFootprint?: number;
  /** Slug de FORME (`WeaponDef`/`ShieldDef.slug`) — id STABLE de routage de l'art d'arme/bouclier (rig),
   *  ≠ libellé. Posé à la migration par jointure `norm(label)` → forme. Absent pour munitions/armes de
   *  siège/Mains nues (aucune silhouette tenue). Propagé sur `ItemInstance.shape` puis `Weapon.shape`. */
  shape?: string;
  /** Cette entrée EST l'arme « Mains nues » du catalogue (`LDB 62 l.28`) : marque STABLE et multilangue,
   *  SEULE lecture de `isUnarmed`/`isUnarmedTrapping` (`engine/items`) — les poings ne comptent pas comme
   *  arme tenue (`EquipmentPanel`, choix d'attaque/parade) et ne sont pas invocables (`conjuredWeapons`). */
  unarmed?: true;
  /** Cette entrée EST l'« Arme improvisée » du catalogue (`LDB 62 l.31`), lue par `isImprovisedTrapping`
   *  (`engine/items`). À NE PAS confondre avec `weaponDamage.isImprovised`, qui décrit une arme RÉDUITE à
   *  l'état improvisé par l'usure (`LDB 62 l.135`). */
  improvised?: true;
  /** Formes choisibles (slugs `WeaponDef.slug`) d'une arme ABSTRAITE (« Arme simple » → épée/hache/
   *  masse/marteau de guerre/demi-lance). Le picker pose le choix sur `ItemInstance.shape` ; défaut =
   *  `shape` du trapping. Absent pour une arme à forme unique. */
  formChoices?: string[];
  /** Arme INHABITUELLE (ACE 12 l.17 « Entraînement avec une arme inhabituelle ») : exige la
   *  maîtrise (`Combatant.masteredWeapons`) pour être maniée avec la Compétence du Groupe. Flag
   *  d'AUTEUR (artefacts uniques : « le couteau de lancer de Harald L'Infâme ») — éditable au Codex. */
  requiresMastery?: boolean;
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
  availability: string | null;
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
   *  `{add}` mètres ±). Appliqué en combat (`effectiveWeaponRange`) à l'arme qui tire cette munition. « Comme
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
   *  effets d'un sort). Copié sur `ItemInstance.consumable` à la construction. */
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
   *  que `CreatureData.maison`/`NavalTraitData.maison`/`CrewWage.maison`. */
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
  derivedWeapon?: Weapon;
  /** Capacités IRRÉDUCTIBLES de l'objet (drapeaux NON exprimables en GameOp) — canal `capabilities`,
   *  MÊME logique que `TraitCapabilities`/`QualityCapabilities` : règles que le moteur INTERROGE par id
   *  (`engine/capabilities`), jamais par le nom FR de l'objet. Couvre les 5 marqueurs de catégorie :
   *  `weatherProtection` (Cape/Manteau), `isShelter` (Tente), `isRations` (Ration), `isGrimoire`
   *  (Grimoire), `preventForcedDrop` (Gantelet verrouillé). Édité au Compendium. */
  capabilities?: ItemCapabilities;
  /** Modificateurs PASSIFS continus de l'objet (GameOp[], MÊME vocabulaire que traits/qualités/sorts) —
   *  appliqués tant que l'objet est PORTÉ ou TENU (collecteur `passiveMods`). Ex. Bésicles → `skillMod`
   *  +20 Langue/Perception (LDB 67). */
  passive?: import('../engine/ops').GameOp[];
  /** Tarif d'un SERVICE (LDB 66 l.12-14 : chambre/écurie…), pas un objet possédable — Enc « – » dans la
   *  source (≠ 0, RAW ne le compte même pas comme non-encombrant). N'entre JAMAIS en stock marchand
   *  (`computeFreshStockLines`), ni en inventaire (`itemFromTrappingById` refuse bruyamment) ; reste
   *  la source de PRIX pour son consommateur (référencée par id) et visible au Codex/Compendium. */
  service?: boolean;
}
/** Groupe d'objet (taxonomie `subType` id-ifiée) : Groupe d'ARME (Base, Escrime, Deux-mains, Armes
 *  d'hast…), famille de MUNITION (Arc, Arbalète, Poudre noire…), type d'ARMURE (Plate, Mailles, Cuir
 *  souple/bouilli) ou catégorie d'INVENTAIRE (Outils, Possessions diverses…). `id` = cible de
 *  `Trapping/Weapon/ItemInstance.subType` (réf, ≠ libellé) ; `kind` = métadonnée d'affichage. */
export interface WeaponGroupData {
  id: string;
  type: 'weaponGroups';
  label: string;
  kind: 'weapon' | 'ammo' | 'armour' | 'inventory';
  /** Matériau d'une armure (groupes `kind:'armour'`) — source TYPÉE des exemptions de Magie des Arcanes
   *  (LDB 46 l.150-152 ; `chaos` = armure du Chaos, exemptée pour le Sorcier du Chaos, VDM 02 l.169).
   *  Remplace la devinette par regex sur le nom. */
  material?: 'metal' | 'leather' | 'chaos';
  /** Sous-ensemble de COMBAT d'un Groupe d'arme (`kind:'weapon'`/`'ammo'`) : `melee` = Spé de Corps à corps,
   *  `ranged` = Spé de Projectiles. SOURCE des pools `weaponGroupsMelee`/`weaponGroupsRanged` (SPEC_SOURCES)
   *  — fin des `specs[]` maintenues à la main sur `corps-a-corps`/`projectiles`. */
  combat?: 'melee' | 'ranged';
  /** Qualités COMMUNES à toute la famille (mêmes ids que `TrappingData.qualities`) — mergées avec les
   *  qualités propres de l'arme par `resolveQualities` (`engine/qualities/dispatch.ts`), qui l'emportent
   *  en cas de conflit. Ex. Escrime → Rapide+Empaleuse (LDB 62 l.137). */
  qualities?: QualityRef[];
}
/** Groupe d'APPARTENANCE (WFRP4, Traits psy ciblés — LDB 21) : identité CANONIQUE i18n-safe.
 *  `id` STABLE (jamais traduit) ; `label` = rendu FR localisable. Registre SSOT (`groups.json`),
 *  référencé par les cibles de Traits psy et les filtres `onlyGroups`/`exceptGroups`/zones. */
export interface GroupData {
  id: string;
  type: 'groups';
  label: string;
  /** Groupe-CIBLE JOKER : il vise n'importe quel combattant (`groupMatch`, `engine/groups`), hormis
   *  les porteurs d'un `exceptGroups`. Absent = appartenance STRICTE par id. */
  matchesAll?: true;
  /** Ids de `groups.json` RETRANCHÉS du joker — un combattant qui en porte un n'est pas visé
   *  (« vivant » = tout sauf Mort-vivant/Démon). */
  exceptGroups?: string[];
}
/** Famille de PRÉSENTATION du stock marchand (`MerchantPanel`, ordre d'affichage = ordre du tableau).
 *  `match` = règle de classement d'une ligne de stock (priorité unit > shield > categorie > fallback
 *  au `match` vide) ; `columns` = ids de colonnes de stats à afficher, résolus contre le registre de
 *  renderers `MERCHANT_COL_RENDERERS` (`ui/MerchantPanel.tsx`). */
export interface MerchantFamilyData {
  id: string;
  type: 'merchantFamilies';
  label: string;
  match: { categorie?: string; shield?: boolean; unit?: boolean };
  columns: string[];
}
export const merchantFamilies = merchantFamiliesJson as MerchantFamilyData[];
/** Rareté de récolte/trophée = `Availability` (LDB 59) ÉTENDUE de `'Unique'` (pièce de bestiaire singulière). */
export type HarvestRarity = Availability | 'Unique';
export type HarvestDanger = 'Inoffensive' | 'Inquiétante' | 'Menaçante' | 'Mortelle';

export interface CreatureData {
  /** `id` STABLE (slug) — clé de résolution runtime/données (scènes, encounters, rig). « Plus de label » :
   *  les références pointent l'id (robuste au renommage/multilangue) ; le `label` ne sert qu'à l'affichage. */
  id: string;
  label: string;
  title: string | null;
  /** `true` = individu NOMMÉ (vs rôle générique / espèce de bestiaire) ; absent/`false` = générique.
   *  SOURCE UNIQUE de la nommé-ité — ne PAS l'inférer de `title`. Éditable au Codex. */
  named?: boolean;
  folder: string | null;
  char: Record<string, number | null>;
  /** Traits STRUCTURÉS (`TraitInstance[]`) — source app-owned migrée du parsing de chaînes (de-POC).
   *  Lus sans aucun parsing (`resolveTraits`/`hasTraitKey`). */
  traits: import('../engine/statEntry').TraitList;
  /** OPTIONNELS (LDB 76) — affichés au Codex, choisissables au spawn : `TraitInstance` ordinaires OU
   *  NOTES composées (joker « tous les traits », variante « remplacer des Traits par un bonus », ZI). */
  optionals: import('../engine/statEntry').OptionalEntry[];
  /** Compétences STRUCTURÉES (`SkillRef` par id stable + valeur de Test imprimée) — fin du parsing
   *  de chaînes « Calme 58 ». Le bestiaire stocke des refs ; `skillRefLabel` reformate à l'affichage. */
  skills: SkillRef[];
  /** Talents STRUCTURÉS (`TalentRef` par id stable + niveau/spécialisation) — fin du parsing de chaînes
   *  « Maîtrise du combat 2 », « Magie des Arcanes (Ghur) ». `talentRefLabel` reformate à l'affichage ;
   *  au spawn, `talentsFromBook` reconstruit le libellé canonique AVEC sa spec (clé du registre). */
  talents: TalentRef[];
  /** Possessions (`TrappingRef` : id catalogue + quantité, ou `{text}` narratif — « collection d'alcool »). */
  trappings: TrappingRef[];
  /** Sorts connus (`Ref` par id de sort). */
  spells: Ref[];
  desc?: string;
  source: SourceRef;
  /** Apparence par défaut UNIFIÉE (plan P2) — UN seul bloc éditable porté par l'enregistrement :
   *  espèce, tenue, parts monstrueux, couleurs, coiffure, sexe/carrure, yeux. Le rig la lit comme
   *  couche de défaut (sous une éventuelle surcharge de scène). Même format que `EntityAppearance`
   *  (éditeur de scène) → une SEULE structure d'apparence dans toute l'app. */
  appearance?: EntityAppearance;
  /** Récolte « Précieuses Entrailles » (ZI) : rareté + dangerosité (→ coût par Enc des pièces,
   *  cf. engine/harvest) et usages supposés des organes. Porté par la créature (pas de table //). */
  harvest?: { rarity: HarvestRarity; danger: HarvestDanger; uses: string };
  /** Ids de `groups.json` de cette créature (Traits psy ciblés, LDB 21 — `groupsFor`) : sa CATÉGORIE
   *  (« demon », « bete »…) et, le cas échéant, le Groupe du dieu du Chaos qu'elle sert. Absent = aucun. */
  grantGroups?: string[];
  /** Cette entrée du bestiaire suit-elle les règles de PERSONNAGE (#143/#152 — Corruption LDB 19,
   *  composant d'incantation LDB 46, Tests de fin de combat Maladie/Corruption LDB 18/20) ? Rétro-flag
   *  du bestiaire HUMAIN (Cultiste, Brigand, Voleur… — ce sont des Personnages, pas des créatures
   *  génériques) ; propagé au spawn par `creatureToCombatant` (même prédicat unique `followsCharacterRules`,
   *  `engine/relations.ts`, que `CustomStatblock.followsCharacterRules` côté éditeur). Absent = créature. */
  followsCharacterRules?: boolean;
  /** Facette ACHAT (marché/possession de carrière) — LDB 70, EDOC 07. */
  purchase?: { price: Money; availability?: string };
  /** Arbitrage NON-verbatim documentant un ou plusieurs champs (ex. `char`/`purchase` approximés
   *  faute de statbloc imprimé) — même patron que `ActivityData.maison`, `TraumaData.maison`. */
  maison?: string;
}
/** Base PARTAGÉE d'un STATUT porté pilotant des effets en DONNÉES — soit un État (LDB 16, `EtatData`), soit
 *  un état psychologique (LDB 21, `PsychologyData`). Porte le vocabulaire commun : modificateurs PASSIFS
 *  (`passive: GameOp[]`, MÊME éditeur `GameOpEditor` que traits/atouts) ET effets DÉCLENCHÉS
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
  /** Modificateurs PASSIFS continus (pénalité de Test, `incomingAttackMod`, `sbBonus`…) en `GameOp[]`, lus
   *  par `passiveMods` (kind `etat` : pool non-cumul, le pire seul, LDB 16 l.13). MÊME éditeur GameOpEditor. */
  passive?: import('../engine/ops').GameOp[];
  /** Effets DÉCLENCHÉS (dégâts par round → `onRoundEnd` ; sortie de Frénésie → `onTurnStart`…) en
   *  `TriggeredEffect[]`, diffusés par `fireStatusEffects` — le même cœur `applyTriggeredEffects`. */
  effects?: import('../state/flow').TriggeredEffect[];
  /** Restriction d'Action / de Mouvement / de défense imposée par le STATUT (États : À Terre/Sonné/
   *  Inconscient/Surpris/Empêtré ; et Psychologie — « Etat comme Psy »), lue en DONNÉES par les prédicats
   *  moteur `canTakeAction`/`effectiveMovement`/`cannotDefend` via le collecteur `conditionGating` (jamais
   *  une branche par-nom). Sur `StatusData` → partagée par `EtatData` ET `PsychologyData`. */
  gating?: { action?: 'none'; movement?: 'none' | 'half' | 'crawl'; cannotDefend?: true };
}

export interface EtatData extends StatusData {
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
  recover?: { skill?: Ref; characteristic?: import('../engine/types').CharKey; opposedBy?: 'source'; difficulty?: import('../engine/types').Difficulty };
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
   *  partagé par le gate de hotbar (`battleSelectAction`) ET l'IA (dépense PROACTIVE de Détermination pour se
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
  icon?: string;
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
  icon?: string;
  /** Porter cet état psy IMMUNISE à la Psychologie (Frénésie, LDB 21 l.33) — lu GÉNÉRIQUEMENT par
   *  `isPsychImmune` (jamais codé par-nom), à l'égal du drapeau de trait « Immunité (Psychologie) ». */
  psychImmune?: boolean;
  /** Trait psychologique CIBLÉ (Animosité/Haine/Préjugé/Amour/Camaraderie/Phobie, LDB 21) : résolution
   *  binaire de Calme pilotée par un Groupe-Cible. Dérive `estCibleType` de la donnée (jamais un Set codé). */
  targeted?: boolean;
  /** RAW LDB 21 : cette affliction CIBLÉE cesse dès que son porteur tombe sous un AUTRE effet psychologique
   *  « dominant » (Peur/Terreur/Haine…) — « Animosité est annulé par Peur et Terreur » ; Préjugé idem. */
  endedByOtherPsych?: boolean;
  /** RAW LDB 21 l.41 : tant que cette affliction CIBLÉE est active, son porteur est IMMUNISÉ aux CANAUX
   *  listés causés par un membre de sa Cible (Haine → `['peur']` ; l'Intimidation du RAW attend sa mécanique, #1234).
   *  Lu par `psychImmuneToFrom` (siège unique : `fearSourceFor` + `psychDRAdjust`). */
  immuneToFromTarget?: string[];
  /** Contribution de cet état psy au DEGRÉ DE RÉUSSITE de l'ATTAQUE de son porteur (LDB 21, ±1 DR) — lu
   *  par `psychDRAdjust` (plus de ±1 codé par-nom). `vs:'source'` = Peur vs sa source (active non vaincue,
   *  l.29) ; `vs:'group'` = Haine/Animosité vs le groupe ciblé actif (l.22/41) ; `vs:'any'` = Amour/
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
  /** Mode de RÉSOLUTION du Test de Psychologie (LDB 21), lu par l'applier GÉNÉRIQUE `combatPsych` (jamais
   *  un dispatch `kind === 'terreur'` codé) : `'extended'` = Test ÉTENDU de Calme cumulant le DR vers l'Indice
   *  (Peur, l.27) ; `'terreur'` = Test BINAIRE dont l'échec inflige `failCondition` (Indice + |DR négatifs|)
   *  puis pose l'état `becomes` (Terreur → Peur, l.55-57) ; `'binary'` = Test BINAIRE activant l'affliction
   *  CIBLÉE (traits ciblés). Absent (Frénésie/trauma) = pas de Test de résolution surmontable. */
  resolution?: 'extended' | 'terreur' | 'binary';
  /** (résolution `'terreur'`) État infligé à l'ÉCHEC (l'id de l'état, p.ex. `'brise'`) ; la QUANTITÉ est
   *  déclarée par `failAmount` (défaut = Indice + |DR négatifs|, LDB 21 l.54). */
  failCondition?: string;
  /** (résolution `'terreur'`) QUANTITÉ d'état infligée à l'échec, EN DONNÉES (`failConditionAmount`) :
   *  `base` (l'Indice de l'affliction via `'indice'`, ou un nombre FIXE) + `perDegreeOfFailure` par DR
   *  négatif. Défauts `{ base:'indice', perDegreeOfFailure:1 }` = la règle Brisé Terreur — plus de calcul
   *  codé : un nouvel État/Psy déclare ICI sa quantité (fixe, ou par degrés seuls). */
  failAmount?: { base?: 'indice' | number; perDegreeOfFailure?: number };
  /** (résolution `'terreur'`) État psychologique SUBSÉQUENT au Test (la Terreur devient une Peur, l.55). */
  becomes?: string;
  /** Paramètres du Test de Psychologie (LDB 21) : `skill` (compétence stable, défaut `calme` — la valeur
   *  NUE est lue par `skillBaseValue`) + `difficulty` (défaut Intermédiaire +0). Lu par `psychStepFor`/
   *  l'encounter, plus de Calme/Intermédiaire codé : un nouvel État/Psy déclare ICI son Test (ex. testé en
   *  Résistance, ou à une difficulté propre). « Sans Peur (Ennemi) » force Accessible à part (par-combattant). */
  test?: { skill?: Ref; difficulty?: import('../engine/types').Difficulty };
}
/** Tables Couleur des Yeux / Cheveux (LDB 05 l.698-744) : 2d10, par colonne `RaceKey` (#313). */
export interface DetailColorData {
  id: string;
  /** Deux datasets partagent CE contrat (`eyes.json` et `hairs.json`) : le `type` dit lequel. */
  type: 'eyes' | 'hairs';
  label: string;
  /** Borne haute 2d10 (incluse). */
  rand: number;
  /** Override de `rand` PAR RACE (`RaceKey`, #313) quand une édition utilise d'autres bornes que le
   *  LDB (ex. gnome NADJ, #420) ; défaut = `rand`. Lu par `rollDetail`. */
  randByRace?: Partial<Record<RaceKey, number>>;
  color: Partial<Record<RaceKey, string>>;
}
/** Texte d'aide (LDB 05 « Détails ») : global + surcharges par colonne `RaceKey` (#313), partielles. */
export interface DetailText {
  all: string;
  bySpecies: Partial<Record<RaceKey, string>>;
}
/** Formules d'Âge/Taille (LDB 05 l.691-707) : « base + N d10 », par colonne `RaceKey` (#313) —
 *  + textes d'aide (conventions de noms, espérance de vie, tailles moyennes, Ambitions). */
export interface DetailsData {
  ageBase: Partial<Record<RaceKey, number>>;
  ageRoll: Partial<Record<RaceKey, number>>;
  heightBase: Partial<Record<RaceKey, number>>;
  heightRoll: Partial<Record<RaceKey, number>>;
  texts: {
    nom: DetailText;
    age: DetailText;
    taille: DetailText;
    ambitionShort: DetailText;
    ambitionLong: DetailText;
  };
}
/**
 * SEMENCES d'une scène NEUVE (#1716) — ce que `emptyScene` (`state/scene.ts`) pose à la création.
 * Chaque champ porte le TYPE du champ de scène qu'il alimente : une semence n'est pas un vocabulaire
 * parallèle, c'est la valeur de départ du champ homonyme. `terrain` est le seul sans homonyme —
 * c'est le sol dont la couche 0 est remplie.
 */
export interface SemencesDeSceneData {
  ambiance: NonNullable<Scene['ambiance']>;
  metresPerTile: number;
  /** ABSENT = `auto` : l’éclairage suit l’horloge via `ambiance` — la sentinelle est l’absence,
   *  jamais une valeur du champ typé (`idDe('lightLevel')`, `schemas/defs/semences-de-scene.ts`). */
  ambientLight?: Scene['ambientLight'];
  terrain: Terrain;
  reliefDefaults: ReliefDefaults;
  roofDefaults: SceneRoofDefaults;
}
/**
 * DÉFAUTS DE COMPILATION (#1716/#1789) — ce que le compilateur de scène (`state/mapSpec.ts`) pose
 * quand une section d'un `MapSpec` laisse le terrain implicite. Distinct des SEMENCES : celles-ci
 * fondent une scène neuve, ceux-là remplissent une déclaration déjà écrite.
 */
export interface DefautsDeCompilationData {
  cheminDeRonde: Terrain;
  masse: Terrain;
  pont: Terrain;
}
/** MANŒUVRE de combat (attaque naturelle activée — LDB 85) — ENTITÉ ÉDITABLE de PREMIÈRE CLASSE (au
 *  même titre qu'un Sort) : son propre dataset `maneuvers.json`, sa catégorie Codex, ses effets
 *  AUTHORÉS en GameOp (`effects`). Un trait l'OCTROIE (`TraitData.grantsManeuvers`) ; le résolveur
 *  générique (`state/combatManeuvers.resolveManeuver`) la joue ENTIÈREMENT depuis cette donnée — jamais
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
  advantageCost: number;
  /** Gestion de l'Avantage dépensé : `fixed` = `advantageCost` (défaut) ; `variable` = le joueur
   *  CHOISIT (Regard : +1 DR par Avantage, LDB 85 l.290) ; `all` = dépense tout (Hurlement, l.170). */
  advantageMode?: 'fixed' | 'variable' | 'all';
  /** Caractéristique du jet de l'attaquant (capacite-de-combat mêlée / capacite-de-tir distance·zone) ;
   *  absent = AUCUN jet d'attaquant (Hurlement : chaque cible teste sa Résistance). */
  stat?: 'capacite-de-combat' | 'capacite-de-tir';
  /** Défense opposée : Esquive / Parade, Initiative (Regard), Résistance/auto sans opposition. */
  defense?: 'esquive' | 'parade' | 'init' | 'resist' | 'auto';
  /** Mode de ciblage (le résolveur en dérive la géométrie moteur). `self` = capacité SUR SOI (pas de
   *  cible adverse ni d'opposition — transformation, mue, auto-buff) : les `effects` s'appliquent au
   *  porteur. `allFoes` / `allAround` = même géométrie (rayon autour de l'attaquant), populations
   *  DIFFÉRENTES : le camp adverse quand le texte le désigne (Middenheim 04 l.11 « contre ses ennemis »),
   *  TOUT le monde quand il ne le désigne pas (LDB 85 l.170 « Toutes les créatures vivantes »). */
  targeting: 'melee' | 'ranged' | 'zone' | 'allFoes' | 'allAround' | 'self';
  /** Portée / Souffle STRUCTURÉS (`ManeuverMeasure`) — mètres = `bonus(ref) + plus`. `range` résolu contre
   *  l'Attaquant, `blast` contre la cible au centre (RAW l.251). Remplace la formule-chaîne re-parsée au runtime. */
  range?: ManeuverMeasure;
  blast?: ManeuverMeasure;
  /** Attaque magique (Souffle, Étreinte glaciale) → soumise à la Résistance à la Magie, etc. */
  magic?: boolean;
  /** Effets AUTHORÉS (Dégâts `wounds` + États) appliqués quand la manœuvre touche (`onHit`) — MÊME
   *  vocabulaire que les sorts (Flow d'ops), exécutés par `applyTriggeredEffects`. */
  effects?: import('../state/flow').TriggeredEffect[];
  /** Folio du Trait PROJETANT — la manœuvre ne porte AUCUNE prose (#1226) : sa description est celle du
   *  trait, résolue à l'affichage par `traitProjectingManeuver`. */
  source?: SourceRef;
  /** Pertinence de BASE pour le scoreur d'attaque (clic droit joueur ET décision IA) : POIDS ÉDITABLE,
   *  plus haut = choisie plus volontiers. Combinée aux bonus situationnels AUTO (dégâts attendus,
   *  multi-cible, état onHit applicable). Défaut 1 ; 0 = jamais auto-choisie (reste manuelle). */
  priority?: number;
  /** ENJEU porté par l'ENTRÉE (#1117 L2, patron `ActivityDef.stake`/`PsychologyData.stake`) : les
   *  `effects` d'une manœuvre sont AUTHORÉS entrée par entrée (aucune formule commune), donc un
   *  gabarit au `kind` serait tautologique. Rendu par `resolveStake` (dataset `combat`, kind
   *  `maneuverDefense`, `entryId` = l'id de la manœuvre) : il PRIME sur le gabarit du kind. */
  stake?: string;
  /** FORME déclarée de l'enjeu — `verbatim` (contigu au Source) ou `descripteur` (assemblage des ops). */
  stakeForm?: StakeForm;
}
/** Drapeaux de CAPACITÉ IRRÉDUCTIBLES d'un trait (LDB 85) — décisions d'IA/psychologie, règles de
 *  résolution de combat, capacités de construction/déplacement/vision : NI un modificateur (`passive`)
 *  NI un effet déclenché (`effects`), mais une règle que le moteur INTERROGE. Édité au Codex. Le
 *  seuil/type éventuel (Démoniaque 8+, Immunité (Poison)) vient de l'INDICE/arg de l'INSTANCE, pas d'ici. */
export interface TraitCapabilities {
  // Construction / spawn
  bonusWoundsBE?: boolean;
  mutationAtSpawn?: 'physique' | 'mentale';
  /** Tirage PLURIEL et ALTERNÉ de Mutations au spawn (Marque de Tzeentch, EDOC 13 l.522-524 : « gagne
   *  1d10/3 Mutations (arrondi à l'entier supérieur), alternant entre Mutations mentales et
   *  physiques » sur la colonne du dieu). `countDie`/`countDivide` = la formule de comptage (⌈1d`countDie`
   *  / `countDivide`⌉) ; `first` = la nature du 1er tirage (RAW liste « mentales et physiques » en premier) ;
   *  `mentalTable`/`physTable` = ids de `mutationTables.json` (colonne du dieu). Distinct de `mutationAtSpawn`
   *  (singulier, table générique 'physique'/'mentale') — les deux capacités coexistent sans collision. */
  markMutations?: { countDie: number; countDivide: number; first: 'physique' | 'mentale'; mentalTable: string; physTable: string };
  swarm?: boolean;
  /** Attaque NATURELLE (LDB 85) : le trait EST une arme (morsure, cornes, tentacules…) — pas d'objet
   *  tenu par le rig. La reconnaissance est TYPÉE, jamais découpée du libellé
   *  (`statEntry` interdit le parsing de chaîne au runtime). `ranged` pour les attaques à distance (crachat). */
  naturalWeapon?: { ranged?: boolean };
  /** Lanceur de Sorts (LDB 85 l.182-183 : « La créature peut lancer des Sorts ») — autorise
   *  l'incantation SANS Compétence avancée (statblocs du bestiaire), lu par `knowsCastingSkill`. */
  spellcaster?: boolean;
  /** Porte le Trait Mort-vivant (LDB 85 l.239, lu par Hurlement fantomatique LDB 85 l.170 :
   *  « créatures vivantes (ne possédant pas le trait Mort-vivant) ») — le TRAIT, PAS le Groupe
   *  bestiaire (un folder « Morts sans repos » sans ce Trait, ex. Goule de crypte, N'EST PAS visé). */
  undead?: boolean;
  // Résolution de combat (seuil/type éventuel depuis l'instance)
  wardSave?: boolean;
  damageImmunity?: boolean;
  /** Manifestation de Ghur (bestiaire de Middenheim) : le porteur est IMMUNISÉ aux effets des Sorts
   *  du Domaine d'id donné (« bete » = Domaine de la Bête / Ghur). Lu PAR ID par le chemin
   *  d'incantation (`immuneToSpellDomain` → `applyCast`) : les effets d'un Sort de ce Domaine ne
   *  s'appliquent pas au porteur. NB : la clause RAW de vulnérabilité aux dégâts supplémentaires
   *  anti-démon/mort-vivant (hors Bête) n'est PAS modélisée — le moteur n'a aucun concept de créature
   *  « vulnérable comme un démon/mort-vivant » (les riders de Domaine ciblent l'appartenance LITTÉRALE
   *  à un Groupe/Trait), donc rien d'inventé. */
  spellDomainImmunity?: string;
  /** Contre-attaque en gagnant un Test opposé de défense (Champion LDB 85). MÊME capacité GÉNÉRIQUE que
   *  le talent Riposte (`CombatFeature.counterOnDefenseWin`) — un seul concept pour traits ET talents. */
  counterOnDefenseWin?: boolean;
  counterRequiresFastParry?: boolean;
  unstable?: boolean;
  painless?: boolean;
  /** Se cabrer (LDB 85 l.314) : « Pour une Action de Mouvement, la créature peut effectuer une Attaque
   *  de Piétinement si elle est plus grande que son adversaire » — SANS le coût d'1 Avantage de l'Action
   *  gratuite générique (LDB 85 l.387, déjà câblée pour toute créature plus grande). Lu par le coût de
   *  l'attaque gratuite `pietinement` (`aiCreatureFreeAttacks`) : la condition de Taille reste celle du
   *  Piétinement générique (`trampleTarget`), inchangée. */
  freeTrample?: boolean;
  // Psychologie / IA
  psychImmuneIfAhead?: boolean;
  /** Psychologie portée par le trait (LDB 21), lue par `parsePsychTraits` (data-driven). L'Indice
   *  (Peur/Terreur) vient de l'instance (`value`) ; la Cible (Animosité…) de l'instance (`arg`). */
  psychType?: 'peur' | 'terreur' | 'animosite' | 'haine' | 'prejuge' | 'amour' | 'camaraderie' | 'phobie';
  psychImmune?: boolean; // Immunité (Psychologie) — annule Peur/Terreur (LDB 85 l.143-144)
  psychIndice?: number; // Indice FIXE si absent de l'instance (Phobie = 1, Effrayé = 0)
  /** Cible FIXE (id de `groups.json`) d'un `psychType` CIBLÉ quand elle est imposée par le RAW du trait
   *  lui-même, pas choisie à l'instanciation (Marque de Khorne « envers ceux qui sont ouvertement des
   *  suivants de Slaanesh », MDG 07 l.250 — ≠ Animosité (au choix)). Fallback SEULEMENT si
   *  l'instance ne porte pas d'`arg` (`parsePsychTraits`). */
  psychCible?: string;
  /** Ids de Groupe (`groups.json`) ACCORDÉS au porteur de ce Trait, en plus de sa dérivation
   *  habituelle (folder/espèce/carrière…) — patron `psychCible` : la Cible d'une Animosité RÉCIPROQUE
   *  ailleurs sur le bestiaire (« les suivants de Slaanesh éprouvent Animosité envers la créature »,
   *  Marque de Khorne, MDG 07 l.250) a besoin d'un Groupe à VISER ; sans ce Trait, aucun `groupMatch`
   *  ne peut cibler le porteur. Lu par `groupsFor` (SOURCE UNIQUE des groupes d'un combattant). */
  grantGroups?: string[];
  /** Peut entrer en Frénésie (LDB 21 l.31 / LDB 85 l.150 Trait « Frénésie » / LDB 10 l.506 Talent
   *  « Frénésie »), lu par `isFrenzyCapable` (une des 3 sources : Trait, Talent, Trait psy octroyé). */
  frenzyCapable?: boolean;
  mindless?: boolean;
  /** Blessures calculées avec le Bonus de FORCE au lieu du Bonus de Force Mentale (Fabriqué, LDB 85
   *  l.142 : « au lieu d'utiliser son bonus de Force Mentale, utilisez son bonus de Force »). Lu par
   *  `maxWounds`/`effectiveMaxWounds` — capacité DISTINCTE de `mindless` (qui porte l'auto-réussite
   *  des Tests d'Int/FM/Soc et le profil IA « horde »), un autre trait pourrait un jour substituer la
   *  même formule sans être Fabriqué. */
  woundsUseForce?: boolean;
  bestial?: boolean;
  coldBlooded?: boolean;
  stupid?: boolean;
  rage?: boolean;
  territorial?: boolean;
  /** Monture trop ombrageuse pour agir seule (Nerveux, LDB 14 l.182) : MONTÉE, elle ne consacre pas sa
   *  propre Action à attaquer (une monture SANS ce drapeau est « un combattant à part entière »). Lu par
   *  l'IA de combat monté — drapeau de donnée, plus de test par-nom du trait. */
  skittishMount?: boolean;
  // Structure de siège (ADE II 8) — Atouts de la table « Barricades et protections typiques »
  structResistant?: boolean;    // Résistant : imparable par une Arme à DISTANCE sans l'Atout Siège (ADE II 8 l.296)
  structImpenetrable?: boolean; // Impénétrable : imparable par TOUTE Arme sans l'Atout Siège (ADE II 8 l.300)
  // Déplacement / vision
  fly?: boolean;
  leap?: boolean;
  stride?: boolean;
  /** Grimpant (LDB 85 l.160-162) : « réussit automatiquement tous ses Tests d'Escalade » — le geste
   *  d'escalade (échelle/arête `WallSeg.climb`) se résout SANS jet (pas un jet silencieux : aucun jet).
   *  Lu par `state/climbMove` (`planClimb`) et `state/path` (pathing/IA, `MoveEnv.traverse`). */
  autoClimb?: boolean;
  /** Grimpant (LDB 85 l.160-162) : « avance à sa vitesse maximale de Mouvement sur toutes les surfaces
   *  appropriées » — coût de Mouvement NORMAL (1 case) au lieu de la ½ vitesse du Talent Grimpeur
   *  (`climbMovementCost`, joueur, LDB 15 l.53). Orthogonal à `autoClimb` (accueille une future capacité
   *  qui réussirait automatiquement sans pour autant grimper à pleine vitesse). */
  climbFullSpeed?: boolean;
  /** Rampant (MSRC 15) : la créature ne peut PAS réaliser d'Action de Course (budget de Course nul). */
  noRun?: boolean;
  seesInDark?: boolean;
  /** Portée de vision dans le noir, en cases (Vision nocturne 20 m/niv = 10 — `LDB 11 l.176` ;
   *  Infravision = illimité, grande valeur — `LDB 85 l.191`). Lue par `darkSightTiles`. */
  darkSightTiles?: number;
  /** Salive analgésique (MSRC 15) : la morsure INDOLORE de la créature ne RÉVEILLE pas une proie
   *  endormie (Inconscient magique) — elle s'y accroche sans être détectée. Lu par le modifier `wake-sleeper`. */
  wakelessBite?: boolean;
  /** Encombrement portable ×N (ADE II 2 l.708, folio 31 : « un ogre peut porter deux fois
   *  l'Encombrement normal d'un humain : (Bonus de Force + Bonus d'Endurance) × 2 ») — porté par le
   *  Trait racial ogre, lu par `traitEncumbranceFactor` (`combatFeatures/dispatch.ts`), composé au PLUS GRAND
   *  facteur des Traits portés dans `maxEncumbrance` (`items.ts`) — jamais cumulatif. */
  encumbranceFactor?: number;
  /** Consommation de vivres/eau ×N (ADE II 2 l.708, folio 31 : « les ogres doivent manger et boire
   *  au moins deux fois plus qu'un humain en une journée ») — porté par le Trait racial ogre, lu par
   *  `traitConsumptionFactor` (`engine/provisions.ts`). */
  consumptionFactor?: number;
}
/** Trait de créature (LDB 85) : libellé canonique + desc VERBATIM (affichée à l'inspecteur). */
export interface TraitData {
  /** Identifiant STABLE (slug du libellé) — clé d'instance/lookup, indépendant de la langue. */
  id: string;
  type: 'traits';
  label: string;
  /** Sens de la valeur NUMÉRIQUE `value` de l'instance (Difficulté, Indice, Degré…) — `label` affiché
   *  devant/autour du nombre. Absent = le trait ne porte pas de valeur numérique. */
  indice?: { label: string };
  /** L'instance porte-t-elle un champ `range` (portée en mètres/cases : Souffle, Aura…) ? Absent/`false` = non. */
  range?: boolean;
  /** Registre de l'ARGUMENT `arg` du trait (catalogue `SPEC_SOURCES` : `groups`/`diseases`/`sizes`/
   *  `mutations`/`breathTypes`/`weaponGroups*`…). Le pool DÉRIVE alors du registre, jamais d'une liste en dur. */
  specsSource?: SpecsSource;
  /** L'`arg` accepte un TEXTE LIBRE (argument authentiquement descriptif, hors registre). Absent/`false`
   *  = FERMÉ (l'`arg` DOIT être un id du pool `specsSource`). */
  specsOpen?: boolean;
  /** L'`arg` peut être une LISTE d'ids jointe par virgules (« Immunité (Feu, Poison) »). Absent/`false`
   *  = un seul id. */
  specsMulti?: boolean;
  /** Trait EXCLU d'un octroi EN MASSE des Traits d'une créature — `LDB 48 l.23` : « Gagnez tous les
   *  Traits standards de la créature sauf Bestial. » Lu par `polymorphOps` (`engine/polymorph`). */
  nonTransferable?: boolean;
  desc: string;
  source: SourceRef;
  /** Emplacement SECONDAIRE (#563) — même Trait réimprimé/à cheval ailleurs (ex. Fouissement : ZI 23
   *  ET 134). Accessors `allLocations`/`sourceBooks` (`src/data/sourceRefs.ts`). */
  alsoIn?: SecondaryRef[];
  /** Effets MÉCANIQUES authorés (déclencheur → ops du Flow) — Traits « effet sur événement » (Toile,
   *  Sang corrosif, Régénération…) appliqués par `state/triggeredEffects`, jamais par un handler en dur.
   *  Type-only (le moteur reste pur : la donnée référence le Flow sans en dépendre à l'exécution). */
  effects?: import('../state/flow').TriggeredEffect[];
  /** Manœuvres OCTROYÉES par ce trait (Morsure, Attaque caudale, Souffle…) — `Ref[]` vers le dataset
   *  `maneuvers`. Un trait d'attaque naturelle octroie sa/ses manœuvre(s) ; `engine/creatureAttacks`
   *  les résout par id (`findManeuverById`). Le trait Souffle en octroie plusieurs (un par Type). */
  grantsManeuvers?: Ref[];
  /** Modificateurs de PROFIL PASSIFS (Élite +20 CC/CT/FM, Brutal −1 M…) en `GameOp[]` — le MÊME vocabulaire
   *  d'ops que les sorts et `Trauma.ops`, CONTINUS (sans wrapper Flow/déclencheur, ≠ `effects`) : édités par
   *  `GameOpEditor` (le composant de liste d'ops existant), lus par le collecteur passif (`traitPassiveMods`
   *  → liveTraits) qui leur AFFECTE le `kind` `intrinseque` (comme la séquelle dérive le sien). */
  passive?: import('../engine/ops').GameOp[];
  /** Apparence COSMÉTIQUE déclarée en DONNÉE (calques du catalogue via `features` + `colors` + `eyes`) —
   *  fusionnée sur le rig quand le trait est présent (cf. `combatantVisuals`). Même fragment éditable
   *  (`AppearanceField`) que les créatures/mutations. */
  appearance?: EntityAppearance;
  /** Drapeaux de CAPACITÉ irréductibles (décisions IA/psy, résolution, build/déplacement/vision) —
   *  lus PAR ID par `engine/traits/dispatch`. Édité au Codex. */
  capabilities?: TraitCapabilities;
  /** Capacités d'AUTRES traits du même porteur ANNULÉES par ce trait (« entraîné à IGNORER son Trait
   *  X » — LDB 85 : Dressé (Dompté) ignore Bestial). Mécanisme GÉNÉRIQUE de suppression, lu par
   *  `traitCapability` : une capacité supprimée par n'importe quel trait porté répond false. */
  suppressesCapabilities?: (keyof TraitCapabilities)[];
  /** AURA de combat : projette des `passive` GameOp[] sur les combattants À PORTÉE (Perturbant : −20 aux
   *  Tests à `rangeChar` mètres, LDB 85 l.262 ; `affects` = quel camp est touché, `affectsGroups` = à
   *  quels Groupes d'appartenance la cible doit appartenir, `includesSelf` = l'émetteur se touche aussi).
   *  Recalculée chaque Round par le hook GÉNÉRIQUE `recompute-auras`, accumulée dans `Combatant.auraMods`
   *  (emballée en `PassiveMod`, le trait émetteur en `src`), lue par `combatTestPenaltyParts` — pool
   *  NON-CUMUL, « une seule fois, peu importe le nombre d'ennemis Perturbants » — et par
   *  `skillDRBonus`/`charDRBonusOf`. Aucun code par-nom. */
  aura?: {
    rangeChar?: CharKey;
    rangeMeters?: number;
    affects?: 'enemies' | 'allies' | 'all';
    affectsGroups?: string[];
    includesSelf?: boolean;
    passive: import('../engine/ops').GameOp[];
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
 *  Les INDICES (Salve N, Protectrice N, Arme d'équipe N…) restent lus du RUNTIME string (`parseQuality().indice`)
 *  — la capability n'est qu'un marqueur de PRÉSENCE, jamais le porteur de l'Indice. Édité au Codex. */
export interface QualityCapabilities {
  // Résolution de combat (mêlée)
  fastStrike?: boolean;   // Rapide : pré-emption d'initiative + −10 parade adverse non-Rapide
  slowStrike?: boolean;   // Lente : frappe en dernier
  fumbleOn9?: boolean;    // Dangereuse : Maladresse sur tout Test raté incluant un 9
  fumbleDigits?: number[]; // Seuil de Maladresse paramétrable (chiffre en dizaines OU unités) — AA 08 l.544
  pushback?: boolean;     // Perturbante : repousse au lieu de blesser
  bladeTrap?: boolean;    // Piège-lame : piéger/briser une lame sur un Critique défensif
  damagesArmour?: boolean;// Taille : endommage l'armure/le bouclier frappé
  // (Taillade « État sur Critique » n'est PLUS une capability : `effects:[{trigger:'onCrit'}]` data-driven.)
  // Armes à feu / chargeurs
  firearm?: boolean;            // Poudre noire / Explosion : Incident de Tir + terreur (Nerveux)
  canFireWhileEngaged?: boolean;// Pistolet : tir au contact
  magazine?: boolean;           // À Répétition : chargeur (Indice)
  salvo?: boolean;              // Salve : chargeur (Indice)
  areaFire?: boolean;           // Tir de zone : nuage de projectiles (Indice)
  explosion?: boolean;          // À Explosion : tous à Indice m du point cible subissent DR+Dégâts + États de l'arme (LDB 62 l.254)
  crewedTeam?: boolean;         // Arme d'équipe : sous-effectif (Indice)
  parryAP?: boolean;            // Protectrice : Indice PA en opposant (Indice)
  // Objet / artisanat (LDB 60)
  encDelta?: number;            // Léger −1 / Volumineux +1 Encombrement
  // Armure (LDB 63)
  layerable?: boolean;          // Flexible : superposition sous une couche non Flexible
  critImmuneOdd?: boolean;      // Impénétrable : Critiques sur jet impair ignorés
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
  /** id STABLE (slug du libellé) — cible des `Ref` de qualité, robuste au renommage. */
  id: string;
  type: 'qualities';
  label: string;
  /** POLARITÉ : Atout (bénéfique) / Défaut (handicap) — `id` de `qualityTypes.json`. Trois PAIRES de
   *  rubriques : objet `LDB 60 l.9`/`l.40`, arme `LDB 62 l.217`/`l.309`, armure `LDB 63 l.68`/`l.80`. */
  polarite: 'atout' | 'defaut';
  subType: string | null;
  desc: string;
  source?: SourceRef;
  /** Emplacement SECONDAIRE (#563) — même Qualité réimprimée/à cheval ailleurs (ex. Tir de zone :
   *  AA 89 + MDG 102). Accessors `allLocations`/`sourceBooks` (`src/data/sourceRefs.ts`). */
  alsoIn?: SecondaryRef[];
  effects?: import('../state/flow').TriggeredEffect[];
  /** Modificateurs PASSIFS continus (objet Laid : −10 aux Tests de Soc ; PASSIFS d'arme : weaponRollMod/
   *  weaponDamageMod/armourPierce/critOnRoll) en `GameOp[]` — MÊME vocab/éditeur (`GameOpEditor`) que les
   *  traits et les sorts ; lus par `engine/qualities/dispatch` (par id) et le collecteur passif. */
  passive?: import('../engine/ops').GameOp[];
  /** Drapeaux/marqueurs de CAPACITÉ irréductibles (résolution combat, artisanat) — lus PAR ID par
   *  `engine/qualities/dispatch`. Édité au Codex. */
  capabilities?: QualityCapabilities;
  /** Cette qualité est INDICÉE (LDB 60 l.28) — forme de `TraitData.indice`, plus l'UNITÉ imprimée avec
   *  la valeur quand le livre en pose une (`AA 08 l.87` « Taillade (XA) » ; `LDB 62 l.66` « Recharge 1 »
   *  n'en a pas). Lue par `qualityRefLabel`. */
  indice?: { label: string; unite?: string };
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
 *  (comme un trait/qualité). `passive` = pénalités continues (charMod) ; `passiveBySeverity` S'AJOUTE à
 *  `passive` pour chaque palier ATTEINT par l'instance, en magnitude ABSOLUE — la pire pénalité l'emporte
 *  (LDB 20 l.157/l.170) ; `onTick` = Test de cycle quotidien +
 *  conséquence GameOp appliquée par la cascade (différée/influençable) ; `capabilities` = règles
 *  irréductibles lues par la machinerie de maladie. */
export interface SymptomData {
  id: string;
  type: 'symptoms';
  label: string;
  desc: string;
  source?: SourceRef;
  passive?: import('../engine/ops').GameOp[];
  passiveBySeverity?: { moderee?: import('../engine/ops').GameOp[]; grave?: import('../engine/ops').GameOp[] };
  /** Effets DÉCLENCHÉS du symptôme (MÊME `TriggeredEffect` que Traits/Atouts/États) — dispatchés par
   *  `fireTriggers` quand le porteur est actif (Crampes abdominales : `onOwnTestFailed` → Sonné/FM/
   *  Inconscient par paliers de `slThreshold`, MSRC 16 l.152-158). Source du dispatcher via
   *  `effectSourcesOf` (les symptômes ACTIFS deviennent une source, comme les États). */
  effects?: import('../state/flow').TriggeredEffect[];
  /** Cycle de PHASE ACTIVE. `test` = le nœud `test` du Flow (`engine/flowCore.ts`) : le jet ET sa
   *  conséquence (branche `fail`). `ops` = la conséquence CERTAINE d'un cycle sans jet (éclatement du
   *  Vers du Reik, d'issue invariante — MSRC 16 l.142) : l'un OU l'autre, jamais les deux.
   *  `difficultyBySeverity` INDEXE la Difficulté du nœud sur la sévérité de l'instance (Toxine,
   *  LDB 20 l.215 : Modéré→Facile, Grave→Accessible) — clé absente pour la sévérité portée = Difficulté
   *  du nœud inchangée. Lu par `symptomOnTick`. `afterDays`/`once` cadencent le cycle sur la phase
   *  ACTIVE (Vers de carie : Test quotidien À PARTIR de J+7, MSRC 16 l.90 ; Vers du Reik : 7ᵉ jour). */
  onTick?: {
    test?: import('../engine/flowCore').FlowTestNode;
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
  visiblePassive?: import('../engine/ops').GameOp[];
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
  /** Emplacements SECONDAIRES du même Domaine — republication à l'identique (doctrine « UNE entité,
   *  N livres ») : l'attribut du Domaine de la Lumière est reparu tel quel dans les Vents de Magie
   *  (`VDM 04 l.252-260`, folio 62). L'ancre `source` reste seule à porter la `desc`. */
  alsoIn?: SecondaryRef[];
  /** Vent de Magie (Couleur) du Domaine, EXTRAIT du `desc` (« Domaine du Feu (Aqshy) », LDB 48) — source
   *  d'AFFICHAGE de la Compétence Focalisation (spécialisée par Vent) et clé de `findDomainByWind`. Les 8
   *  Domaines élémentaires + Dhar en portent un ; les Domaines dérivés (Sorcellerie/Nécromancie/
   *  Démonologie/Magie naturelle, homebrew Skaven…) n'ont pas de Vent propre (ils canalisent Dhar ou un
   *  Vent élémentaire). Édité au Codex. */
  wind?: string;
  /** Domaine ENSEIGNABLE via le Talent Magie des Arcanes (LDB 48) : SOURCE du pool `arcaneDomains`
   *  (SPEC_SOURCES) — fin de la liste `specs[]` maintenue à la main sur `magie-des-arcanes`. Les Lores de
   *  sorts non-arcanes (ex. Magie des mers de Triton) ne le portent pas. */
  arcane?: boolean;
  /** `VDM 02 l.192` (`careerSlots.arcaneDomainGate`) — Nécromancie, Démonologie (LDB 50). */
  dark?: boolean;
  /** Tables d'effets (`tables.json`) DÉCLARÉES par le Domaine, par CLÉ de rôle — résolues par l'op
   *  `rollDomainTable` (`engine/ops.ts`). Clé `arcaneMark` : Marques Arcaniques du Vent
   *  (`VDM 02 l.238`). Le lien Domaine→table vit ici, jamais dans le code. */
  tables?: Record<string, string>;
  /** Effets DÉCLENCHÉS « à la touche » sur une cible d'un Sort du Domaine (Feu → En flammes…) — MÊMES
   *  `TriggeredEffect` éditables que Traits/Atouts, gatés par les Conditions Flow `relation`/`has`. */
  effects?: import('../state/flow').TriggeredEffect[];
  /** Mitigation des Projectiles : ignore les PA d'une matière (`metal`/`nonMagic`) ; `bonusFromBypass`
   *  les ajoute aussi aux Dégâts (Métal). */
  missile?: { bypass: 'metal' | 'nonMagic'; bonusFromBypass?: boolean };
  /** Ops appliquées AU LANCEUR après une incantation réussie (ex. Bête → Peur 1 pendant 1d10 Rounds).
   *  Canal CAPABILITY (pas passive ni effects) : l'effet cible le lanceur lui-même, non une cible.
   *  Exécutées par `domainCasterOps` (engine/domainAttributes) via `applyOps`. */
  casterOps?: import('../engine/ops').GameOp[];
  /** Élément du Souffle conféré par le Talent Magie des Arcanes du Domaine (Cieux → Électricité,
   *  Métal → Corrosif, Ombres → Fumée, Feu → Feu) — lu par le résolveur de Souffle. */
  breathType?: string;
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
   *  par jet d'Imparfaite, État Hémorragique possible) — gated par la règle optionnelle `magic-sorcellerie`. */
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
  /** id STABLE (slug du libellé) — cible des `Ref` de sort (sorts de créature, bénédictions/miracles). */
  id: string;
  label: string;
  /** ÉCOLE — libellé d'affichage hérité (dépotoir de 18 valeurs) ; la logique branche sur `family`/`domainId`. Dette : #1517. */
  ecole: string;
  subType: string | null;
  /** id STABLE du Domaine de magie (= `DomainData.id`, ex. « feu ») — source RUNTIME du chemin
   *  sort→domaine (attributs LDB 48). Dérivé du `subType` (libellé) à l'authoring ; le runtime ne
   *  lit QUE l'id. Absent = Sort sans Domaine (Magie Mineure, Prière…). */
  domainId?: string;
  /** Le Sort est un RITUEL (`VDM 02 l.363`) : même résolution qu'un Sort (`l.379`), rubriques
   *  d'anatomie en plus (`l.377-393`). TAG lu par les modificateurs de NI qui ne visent qu'une des
   *  deux natures (`VDM 12 l.646-647`, `VDM 14 l.489`). */
  isRitual?: boolean;
  /** Rubriques d'ANATOMIE D'UN RITUEL (`VDM 02 l.377-393`) : ce qu'un Rituel imprime EN PLUS d'un
   *  Sort. Rendues par la fiche Codex des Sorts (`ui/compendium/registry.ts`) ; `cnFrom` y remplace
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
  /** Portée STRUCTURÉE (LDB 46/47) — d'où le sort peut être lancé. `null` = donnée absente (homebrew
   *  non extrait). Aucune prose n'est re-parsée au runtime ; l'affichage est DÉRIVÉ
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
  // Présents sur toutes les entrées OFFICIELLES (curated:true) ; absents sur les sorts homebrew (frenchy.bzh).
  /** Vrai pour une entrée curée de la base officielle. Absent/false pour les sorts homebrew (frenchy.bzh).
   *  Permet au test de couverture de vérifier que TOUS les sorts officiels ont une spec complète. */
  curated?: boolean;
  // POUSSÉE / TÉLÉPORTATION / ATTAQUES EN CHAÎNE : effets POSITIONNELS portés par des ops
  // IMPURES (`push`/`teleport`/`chain`, on:'caster') dans `effects`, résolus par combatFlow (cf. engine/ops).
  /** Sort « Souffle » (LDB 47 l.503) : délégué à l'attaque de ZONE du Trait Souffle. */
  breathAttack?: true;
  /** OPPOSITION de la cible (multijet dans la modale d'incantation).
   *  `resist` : Test opposé par la caractéristique/compétence `char`/`skill` de la cible.
   *  `contact` : Sort de Portée Contact — frappe via Test opposé de Corps à corps (Bagarre). */
  opposed?: {
    kind: 'resist' | 'contact';
    /** Caractéristique opposée (`resist` uniquement). */
    char?: import('../engine/types').CharKey;
    /** Compétence opposée (`resist` uniquement, rare) — référence `{ id, spec? }`. */
    skill?: Ref;
  };
  /**
   * EFFETS du sort — `Flow` ÉDITABLE (système logique unique : `do`/`if`/`test`), source des effets
   * mécaniques appliqués à l'incantation (feuilles EffectOp `{type:'ops', on:'target'|'caster', ops}`).
   * Édité dans le Compendium (CodexEdit → FlowEditor), exécuté par `runCombatFlow`. SOURCE UNIQUE des
   * effets. Import TYPE seul (effacé à la compilation) → la couche data NE dépend PAS d'une valeur
   * de `state` (pureté préservée). Absent = aucun effet mécanique (narratif).
   */
  effects?: import('../state/flow').Flow;
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
  type: 'stars';
  label: string;
  rand: number;
  signe: string | null;
  classique: string | null;
  ascendant: string | null;
  dates: string | null;
  dieux: string | null;
  apparence: string | null;
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
/** Demeure céleste (ADE II 3 l.502-512) : section du ciel gouvernée par un signe — thème astral
 *  facultatif de la création (flavor pur). `desc` = VERBATIM de la source ; `rand` = borne haute 1d10. */
export interface CelestialHouseData {
  /** id STABLE (slug du libellé) — `HeroDetails.dwellings[].house` stocke cet ID (libellé à l'affichage). */
  id: string;
  type: 'astrology';
  label: string;
  rand: number;
  desc: string;
  source: SourceRef;
}
/** Lieu (Glorieux Reikland, LDB) : hiérarchie par `parent` (label d'un autre lieu). */
export interface LocationData {
  /** id STABLE (slug du libellé) — cible de `parent` (réf id, ≠ libellé) et des réfs inverses. */
  id: string;
  type: 'locations';
  label: string;
  /** `id` du lieu parent (`LocationData.id`), ou null si racine — réf d'entité, ≠ libellé. */
  parent: string | null;
  prefix: string | null;
  suffix: string | null;
  desc?: string;
  source: SourceRef;
}
/** Ouvrage WFRP4 référencé (bibliographie). `desc` = présentation en texte/Markdown (règle 5). */
export interface BookData {
  id: string;
  type: 'books';
  label: string;
  abbr: string;
  dir?: string | null;
  /** Nom du PDF officiel sous `Source/` — résolu par `scripts/raw/_lib.mjs#pdfDe`. */
  pdf?: string | null;
  extractionDir?: string | null;
  language: string | null;
  /** Corps de règles dont ce livre est le CŒUR (`4e`, `5e`) — absent (ou vidé à l'atelier) d'un supplément. */
  coeur?: string | null;
  /** Teneur des chapitres non couverts par une fiche d'Atlas — absente = livre de RÈGLES. */
  teneur?: 'scenario' | 'mixte' | null;
  /** Niveau de heading qui porte les SUJETS de ce livre (`sectionsOf`) — absent = 2. */
  niveauDeSection?: number | null;
  folder: string | null;
  desc?: string;
}
/**
 * Apparence de base d'une espèce de rig (Humain, Ogre, Skaven…) — éditable dans le Compendium.
 * PAR RÉFÉRENCE : `featureKeys` (catalogue d'éléments, résolus par `feat()`), ids de gabarit/tête/
 * jambes, libellé de tenue, couleurs. Les SVG/gabarits restent des registres CODE (résolus par le
 * rig). Le rig (`raceById`) lit ce dataset comme SOURCE et le résout en `RaceDef`.
 */
export interface RaceAppearanceData {
  id: string;
  label: string;
  gabarit: string;
  gabaritOverride?: Record<string, number>;
  palette?: Record<string, string>;
  paletteF?: Record<string, string>;
  head?: string;
  legs?: string;
  armG?: string;
  armD?: string;
  dropHeadgear?: boolean;
  tirageIndividuel?: Partial<Record<import('./palette.types').Slot, string[]>>;
  featureKeys?: string[];
  pose?: Record<string, number>;
  tenue?: string;
  colors?: Record<string, string>;
  sex?: 'M' | 'F';
  parts?: { cheveux?: number; visage?: number };
  scale?: number;
  eyes?: { G?: string; D?: string };
}
/** Banque de noms d'UNE race jouable : prénoms M/F + noms de famille (LDB 05). L'`id` est le
 *  `RaceKey` de la race (`species.refChar`) ; le `label` est de l'AFFICHAGE. */
export interface NamePool {
  id: RaceKey;
  type: 'names';
  label: string;
  maleFirstNames: string[];
  femaleFirstNames: string[];
  lastNames: string[];
  /** Suffixes de patronyme par sexe du PERSONNAGE (Nain, LDB 05 l.627-633 : « –sson » fils de…, « –snev »
   *  neveu de…, « –sdottir » fille de…, « –sniz » nièce de…) — le nom de famille est généré depuis le
   *  parent + suffixe quand `lastNames` est vide. Absent = pas de génération par suffixe. */
  lastNameSuffixes?: { M: string[]; F: string[] };
}

import { indexParChamp, indexParId, memoParVersion } from './versionDataset';
/** Les primitives d'INDEX VIF (#1692), REEXPORTÉES par la façade : un lecteur hors `src/data` compose
 *  l'accesseur d'ici plutôt que de rebâtir son propre index sur un dataset muté en place. */
export { indexParChamp, indexParId, memoParVersion, versionDuDataset } from './versionDataset';

export const characteristics = characteristicsJson as CharacteristicsData;
/** Abréviation FR AFFICHÉE d'une caractéristique à jet (« CC », « Ag »…), dérivée de `characteristics.json`
 *  par `id` (jamais recopiée en dur dans l'UI — `CharKey` reste un id opaque, cf. engine/types.ts). */
const charARoulerParId = indexParChamp('characteristics', characteristics, (c) => (c.nature === 'roll' ? c.id : undefined));
export const charAbr = (k: CharKey): string => charARoulerParId(k)?.abr ?? k;
export const species = speciesJson as SpeciesData[];
export const classes = classesJson as ClassData[];
export const careers = careersJson as CareerData[];
export const careerLevels = careerLevelsJson as CareerLevelData[];
export const skills = skillsJson as SkillData[];
export const talents = talentsJson as TalentData[];
export const etats = etatsJson as EtatData[];
/** Procédures / options de jeu (Sombre Pacte, modes d'attaque/défense, Empoignade, Focalisation
 *  étendue…) — texte VERBATIM du Source (règle stricte 5), app-owned éditable au Codex. Routées en
 *  tooltip `CodexRef` (catégorie `regles`). */
export interface RegleData {
  id: string;
  type: 'regles';
  label: string;
  desc: string;
  source: SourceRef;
}
export const regles = adressee<RegleData>(reglesJson);
/** Index par `id` STABLE — patron des datasets HORS seam `ARRAYS` d'`overrides.ts` (même forme que
 *  `lieuServiceById`) : `regles` n'y est pas routé, `indexParId` ne peut donc pas le clefer. */
const regleParId = new Map(regles.map((r) => [r.id, r]));
/** Résout une fiche de Règle par son `id` STABLE. */
export function findRegleById(id: string): RegleData | undefined {
  return regleParId.get(id);
}
/** Tables numériques de Disponibilité & de Troc (LDB 59 « Faire son marché » p.290-291) — app-owned
 *  éditable ; consommé par `engine/disponibilite` (mêmes références). */
export interface DispoPctRow { availability: TestedAvailability; pct: Record<'village' | 'ville' | 'cite', number>; source: SourceRef }
export interface BarterRatioRow { give: Availability; ratios: Record<Availability, { give: number; get: number }>; source: SourceRef }
export interface DispoData { dispoPct: DispoPctRow[]; barterRatios: BarterRatioRow[] }
export const disponibilite = disponibiliteJson as DispoData;
/** Maladies (LDB 20) — app-owned éditable au Codex ; le COMPORTEMENT (cycle/symptômes) vit dans
 *  `engine/disease`. `DiseaseDef` (type) y est défini ; ici on n'expose que la DONNÉE. */
export const maladies = maladiesJson as DiseaseDef[];
const maladieParId = indexParId('maladies', maladies);
/** Résout une Maladie par son `id` STABLE. */
export function findDiseaseById(id: string): DiseaseDef | undefined {
  return maladieParId(id);
}
/** Libellé d'affichage d'une Maladie par son id (repli sur l'id). */
export function diseaseLabel(id: string): string {
  return maladieParId(id)?.label ?? id;
}
// Traits app-owned (officiels + homebrew frenchy.bzh Aura de Dhar/Mort, Charnier + suppléments
// Redoutable/Fouissement ZI) — TOUT dans `traits.json` ; chaque entrée garde sa vraie `source` : ZI, frenchy.bzh…).
export const traits = traitsJson as TraitData[];
const traitParLabelMinuscule = indexParChamp('traits', traits, (t) => t.label.toLowerCase());
/** `id` STABLE d'un Trait depuis un LIBELLÉ d'AUTHORING (statbloc saisi, migration), casse ignorée —
 *  `undefined` si le texte ne nomme aucun trait du catalogue. La couture label→id vit ICI, au
 *  CHARGEMENT de la donnée (CLAUDE.md § Pour TOUT agent) : `src/engine` délègue à ce résolveur d'ID
 *  et ne manipule que des ids ; le runtime résout par `findTraitById`. Patron `talentIdByLabel`. */
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
export const symptomLabel = (id: string): string => symptomeParId(id)?.label ?? id;
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
export const symptomInstanceLabel = (inst: { symptomId: string; severity?: 'moderee' | 'grave'; spec?: string }): string => {
  const qualifs = [inst.severity ? libelleDeValeur(symptomSeveritySchema, inst.severity) : null, inst.spec ?? null].filter(Boolean);
  return qualifs.length ? `${symptomLabel(inst.symptomId)} (${qualifs.join(', ')})` : symptomLabel(inst.symptomId);
};
/** Mutations (entités) + Tables de Corruption (plages d100 → réf), DÉCOUPLÉES (cf. data/mutations.ts) —
 *  app-owned éditables au Codex. Le runtime du tirage (`rollMutation`) vit dans `mutations.ts`. */
export const mutations = mutationsJson as MutationData[];
export const mutationTables = mutationTablesJson as MutationTable[];
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
export function mutationLabel(id: string | null | undefined): string {
  return id ? (mutationParId(id)?.label ?? id) : '';
}
export const trappings = trappingsJson as TrappingData[];
/** Engins de siège POSABLES = trappings portant un art d'affût (`siegeRig`). FOYER UNIQUE du filtre :
 *  l'invariant « posable ⇔ l'engin a un art d'affût, et c'est ce rig qui rend l'affût inerte en
 *  éditeur comme en combat » ne vit QU'ICI — partagé par l'outil emplacement de l'éditeur
 *  (Palette/Inspecteur/StatusBar) ET la catégorie Codex « Engins de siège », plus aucun
 *  `trappings.filter(siegeRig)` dupliqué ailleurs. */
export const siegeEngines = memoParVersion('trappings', () => trappings.filter((t) => !!t.siegeRig));
/** Véhicules / embarcations à coque — FOYER UNIQUE app-owned (data-driven). Trois facettes par
 *  enregistrement (achat / voyage / coque) ; cf. `VehicleData`. La facette `travel` est lue par
 *  `engine/travel` ; les facettes `purchase`/`hull` par le marché et les incidents/combat. */
export const vehicles = vehiclesJson as VehicleData[];
const vehiculeParId = indexParId('vehicles', vehicles);
export const findVehicleById: (id: string) => VehicleData | undefined = vehiculeParId;

/** Archétypes de marchand (#2, donnée éditable — aucun archétype en dur dans le code) — FOYER UNIQUE
 *  app-owned. `MERCHANTS`/`MERCHANT_ARCHETYPES` (`state/merchants/index.ts`) réexportent ce registre :
 *  ajouter un 7e archétype = une entrée JSON ici, rien d'autre. */
export const MERCHANT_ARCHETYPES = merchantsJson as MerchantArchetypeDef[];
export const merchantArchetypeById: Map<string, MerchantArchetypeDef> = new Map(MERCHANT_ARCHETYPES.map((m) => [m.id, m]));
export const findMerchantArchetypeById = (id: string): MerchantArchetypeDef | undefined => merchantArchetypeById.get(id);

/** Structures destructibles de siège (ADE II 8) — catalogue app-owned éditable au Codex. Modèle à PV
 *  calqué sur la facette `hull` des véhicules ; lu par `engine/structures.ts` (`structureCombatant`). */
export const structures = structuresJson as StructureData[];
const structureParId = indexParId('structures', structures);
export const findStructureById: (id: string) => StructureData | undefined = structureParId;
/** Apparence de RENDU des structures (murs/portes) — donnée pure, découplée des règles ci-dessus. */
export const structureAppearances = structureAppearanceJson as import('../gameIso/catalog/structures/types').StructureAppearanceDef[];

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
export const massBattleHazards = massBattleJson.hazards as HazardRow[];
/** Objet racine (mêmes références vivantes que les 5 tableaux ci-dessus) — cible de sérialisation PLEINE
 *  au save d'une entrée d'un sous-tableau (l'éditeur ne doit PAS écrire QUE le tableau touché, sous peine
 *  de perdre les 4 autres sections du fichier). Cf. `data/overrides.ts::NESTED_ARRAY_ROOT`. */
export const massBattleData = massBattleJson;

/** LES matières du monde (#1686) — donnée pure, UN document, le domaine PORTÉ par l'entrée. */
export const materials = materialsJson as MaterialEntry[];

/** LES terrains du monde (#1690) — règle (franchissabilité, raccord, opacité, bâti) ET rendu (teinte,
 *  rampe, recette, décor posé, bloc plein) dans UNE entrée. Binding muté EN PLACE par `setDataset`
 *  (`data/overrides.ts`) : la façade `src/state/terrain` et le catalogue de rendu le lisent VIF. */
export const terrains = terrainsJson as unknown as TerrainDef[];

/** LES types de bâtiment (#1715) — empreinte et couverture par défaut à la pose, ornements d'identité
 *  émis en billboard. Binding muté EN PLACE par `setDataset` (`data/overrides.ts`) : la façade
 *  `src/state/buildings` le lit VIF. */
export const buildings = buildingsJson as unknown as BuildingDef[];

/**
 * Les matières d'UN domaine — vue DÉRIVÉE du document, jamais un second catalogue, et jamais un
 * SNAPSHOT : la fonction balaie `materials` À L'APPEL. Le tableau est le seul binding partagé, splicé
 * en place par `setDataset` (`data/overrides.ts`) ; une vue évaluée au niveau module aurait figé les
 * entrées d'avant l'édition. Coût mesuré du balayage de 16 entrées au cardinal réel du rendu
 * (18 026 lookups, 65 scènes) : +4,1 ms contre un index `Map` (#1686 lot 3a-1).
 * Apparences servies : `prop` (recettes volumiques de décor), `roof` (couvertures + plan vu du
 * dessus), `relief` (falaises/rampes/tabliers/piliers/POV).
 */
export const matieresDe = <D extends MaterialDomain>(domain: D): MatiereDe<D>[] =>
  materials.filter((m): m is MatiereDe<D> => m.domain === domain);

/** Matières POSABLES sur une masse de toit : les entrées de domaine `roof` que la DONNÉE déclare
 *  couvrantes (`couverture`) — SOURCE UNIQUE du validateur de scène (`state/validateScene.ts`) et des
 *  sélecteurs de l'éditeur (`ui/editor/Inspector.tsx`), qui vivent dans deux couches et ne peuvent pas
 *  s'importer l'une l'autre. Lecture VIVE, comme `matieresDe`. */
export const matieresCouvrantes = (): RoofMaterialDef[] => matieresDe('roof').filter((m) => m.couverture);

/** L'entrée du PLAN vu du dessus — celle que la DONNÉE marque `vueDeDessus` (#1691), jamais un id
 *  littéral au call-site. Le schéma en garantit l'unicité (`schemas/defs/materials.ts`,
 *  `affinerDataset`) ; le premier marqué est donc LE plan. Lecture VIVE, comme `matieresCouvrantes`. */
export const matierePlan = (): RoofMaterialDef => {
  const plan = matieresDe('roof').find((m) => m.vueDeDessus);
  if (!plan) throw new Error('matierePlan() : aucune entrée `roof` ne porte `vueDeDessus` — materials.json');
  return plan;
};

/** AMBIANCE de rendu partagée iso ⇄ POV (ciel/brumes/vignette/voile chaud/filtre d'étage) — donnée pure. */
export const ambiance = ambianceJson as import('../gameIso/catalog/ambiance').AmbianceDef;

/** TEINTES DE JEU du terrain (surbrillances tactiques + identité d'unité), `id → #rrggbb` — donnée
 *  pure, servie aux peintres par les deux façades `gameIso/highlightTints.ts` et
 *  `gameIso/teamColors.ts` (schéma et invariants : `schemas/defs/teintesJeu.ts`). */
export const teintesJeu: Record<import('./schemas/defs/teintesJeu').TeinteId, string> = teintesJeuJson.entries;

/** Traits & Améliorations de navire (MDG 12) — catalogue app-owned éditable au Codex. La DONNÉE (`desc`
 *  verbatim + effet) vit ici ; `engine/navalTraits.ts` ne fait que la LIRE (aucune valeur codée en dur).
 *  `kind` distingue Trait (construction) et Amélioration (ajout/retrait) ; `ranked` = prend un Indice
 *  (« Renforcé 2 », « Peu maniable 1 »). L'EFFET mécanique passe par la langue UNIQUE `GameOp[]` (`passive`,
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
 *  `value` = CO (coût) ou Enc (poids) selon le champ porteur ; `maison` = réf nue du tarif au-delà de la
 *  dernière borne chiffrée par le livre porté sur la bande concernée. */
export interface InstallBand { maxLengthM: number | null; value: number; maison?: string }
/** Coût / Poids d'INSTALLATION d'une Amélioration navale (MDG 12, lignes « Coût : / Poids : » de chaque
 *  Amélioration, l.195-364 ; MSRC 12 l.1-140) — VERBATIM structuré par paliers de LONGUEUR. `per: '5m'` =
 *  « par tranche de 5 m de Taille » (Blindage, Lissage) ; `per: 'unite'` = « par cabine » (Cabine de luxe) ;
 *  `'modele'` = ceux du modèle embarqué (Embarcation de bord). `weightEnc` absent = aucun poids (Lissage).
 *  Donnée consommée par le chantier construction/réparation navale (lot systèmes) — aucune valeur codée en
 *  dur. */
export interface NavalInstall {
  installation: { bands: InstallBand[]; per?: '5m' | '10m' | 'unite' } | 'modele';
  weightEnc?: { bands: InstallBand[]; per?: '5m' | '10m' | 'unite' } | 'modele';
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
  /** Effet mécanique en `GameOp[]` (langue unique) — lu par `navalPassiveOps` puis filtré par effet
   *  (`ap`/`moveMod`/`skillDRBonus`), répété ×Indice si `ranked`. MÊME éditeur `GameOpEditor` que les traits. */
  passive?: import('../engine/ops').GameOp[];
  /** Bélier (MDG 12 l.221) : bonus de COLLISION (géométrie proue/frontale) — sous-système navire hors
   *  vocabulaire combattant (≠ `ap` qui mitige TOUT) → injecté dans `resolveCollision` via `belierRam`. */
  ram?: { ic: number; ap: number };
  /** Couvert de pont GRADUÉ (`DeckCoverClass`) offert par l'Amélioration à ses postes — Sabord/Murs blindés
   *  = `totale` (MDG 12 l.364 / MSRC 12 l.85), Plat-bord = `moyenne` (MSRC 12 l.111). Géométrie de Pont,
   *  consommée par `effectiveDeckPostes`/le rendu du Pont. Sous-système navire, hors vocabulaire combattant. */
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
 *  `state/worldMap.ts`). `production`/`surplus`/`demande` sont keyés par id de `sea-cargo.json`
 *  (+ marqueurs `commerce`/`minimum-vital`), même vocabulaire que `PortProfile` (`engine/seaVoyage.ts`). */
export interface NavalPortData {
  id: string;
  type: 'naval-ports';
  label: string;
  /** Région/nation de la colonne « Lieu » de l'Index (regroupement RAW, ex. « Nordland », « Tilée »). */
  region: string;
  taille: number;
  richesse: number;
  production?: string[];
  surplus?: Record<string, number>;
  demande?: Record<string, number>;
  /** Grand port cosmopolite (Marienburg/Lothern, MDG 15 l.343-349). */
  cosmopolite?: boolean;
  /** Colonne Dirigeant, verbatim. */
  dirigeant?: string;
  /** Colonne Notes, verbatim Markdown. */
  desc?: string;
  source: SourceRef;
}
export const navalPorts = navalPortsJson as NavalPortData[];
const portNavalParId = indexParId('navalPorts', navalPorts);
export function findNavalPortById(id: string): NavalPortData | undefined {
  return portNavalParId(id);
}

/** LOT 1 #422 : 5 datasets NAVAUX de contenu (tables MDG 12/13/15) exposés au Codex — mêmes garanties
 *  de référence LIVE (singleton ESM, même fichier physique relu par `engine/shipNavigation.ts`,
 *  `engine/seaNavigation.ts`, `engine/seaPerils.ts`, `engine/seaWeather.ts`, `engine/shipBuild.ts`) que
 *  `WATER_EXPOSURE` ci-dessus. Types réutilisés DEPUIS le schéma zod (`schemas/defs/*`, patron
 *  `CharacteristicsData`/`AxesData`) — pas de redéclaration divergente. */
export const navalProgression = navalProgressionJson as NavalProgressionData;
export const seaNavigation = seaNavigationJson as SeaNavigationData;
export const seaPerils = seaPerilsJson as SeaPerilsData;
export const seaWeather = seaWeatherJson as SeaWeatherData;
export const shipConstruction = shipConstructionJson as ShipConstructionData;

/** LOT 2 #422 : Navigation fluviale (MSRC 7) — pendant fluvial de `seaNavigation`, même patron
 *  d'export (référence LIVE au même fichier physique relu par `engine/riverNavigation.ts`). */
export const riverNavigation = riverNavigationJson as RiverNavigationData;

/** Vocabulaire des SERVICES de lieu (#343, `lieux-services.json`) — catalogue EXTENSIBLE consommé par
 *  référence (`MapPlace.services[].kind`) et résolu par `placeServices` (`src/state/worldMap.ts`).
 *  `port`/`marché` gardent leur propre schéma riche ; ce catalogue couvre le RESTE (auberge/temple/
 *  forgeron/guilde…) — id STABLE → libellé/icône d'affichage du hub de lieu. */
export interface LieuServiceData {
  id: string;
  type: 'lieux-services';
  label: string;
  icon?: string;
  desc?: string;
  /** Réplique de boniment (saveur maison) du bandeau d'interlocuteur statique (`SpeakerBanner`). */
  hostLine?: string;
  /** Bande d'ambiance par défaut (id du registre `src/ui/backdrops`). */
  backdrop?: string;
  /** Archétype marchand ouvert par ce service (`src/data/merchants.json`, #369). */
  merchantArchetype?: string;
  /** Écran plein-champ EXISTANT vers lequel ce service PORTE (#369) : `port` = l'écran de port
   *  (onglet Chantier par défaut), sous garde de navire de campagne. Champ DÉCLARÉ, jamais un
   *  branchement d'id (#842). */
  opensScreen?: 'port';
  /** Libellé du bouton d'entrée du service qui porte un `opensScreen`. */
  enterLabel?: string;
  /** Note d'infobulle sur la case à cocher du service (éditeur, `WorldMapPlacePanel`) — précision
   *  ponctuelle sur ce qui dérive déjà ce service ailleurs (ex. auberge ⇄ offre de repos de la scène
   *  liée). Champ DÉCLARÉ sur l'entrée, jamais un branchement d'id (#834). */
  editorNote?: string;
}
export const lieuxServices = lieuxServicesJson as LieuServiceData[];
const lieuServiceById = new Map(lieuxServices.map((s) => [s.id, s]));
export function findLieuServiceById(id: string): LieuServiceData | undefined {
  return lieuServiceById.get(id);
}
/** Chanson de marins (MDG 09 l.218-248, payload du Talent Chanson de marin) — catalogue app-owned.
 *  `crewOps` = effet exprimé dans la langue UNIQUE `GameOp[]`, appliqué à CHAQUE membre d'équipage pendant
 *  l'effet (3 min + DR du Test de Divertissement (Chant) en minutes, 1 chanson par quart — activation
 *  `battleSingShanty`, state/combatSlice). `captainOps` = ops appliquées au seul CAPITAINE (titulaire du
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
export interface CrewWage {
  daily: Money;
  weekly: Money;
  source?: SourceRef;
  maison?: string;
}
export interface CrewRoleData {
  id: string;
  type: 'crew-roles';
  label: string;
  skills: EngineSkillRef[];
  desc: string;
  wage?: CrewWage;
}
/** Type de Test d'équipage (MDG 14) : rôles contributeurs + rôle ESSENTIEL (son DR compte double). */
export interface CrewTestTypeData {
  id: string;
  label: string;
  roles: string[];
  essential: string;
  /** Fiche de RÈGLE (`regles.json`) qui porte le VERBATIM MDG 14 de ce Test d'équipage — la règle est
   *  à un clic depuis l'étape. L'ENJEU AFFICHÉ, lui, est le descripteur d'EFFET du `kind` joué
   *  (`voyage-stakes.json`, `voyageStake`) : deux natures, deux datasets. */
  rule?: string;
  /** Un total NÉGATIF de ce Test retire autant de Moral à l'équipage — MDG 14 l.110. */
  moraleOnNegativeDR?: boolean;
  /** Test d'équipage qui DIRIGE le navire : reçoit les modificateurs de Navigation pour diriger
   *  (Traits/Améliorations de coque, MSRC 12 l.66/140) et la gêne d'un empêtrement. */
  steering?: boolean;
}
/** PRÉSENCE à bord que les livres NOMMENT (`ship-stations.json`) — seule cible de
 *  `ShipCrewHit.crewTarget.stations` et de l'épinglage `Combatant.shipStation`. `requiresTrait` gate
 *  la station sur un Trait naval de la coque (`cale` — MSRC 07 l.94 ; `nid-de-pie` — MDG 12 l.299). */
export interface ShipStationData {
  id: string;
  type: 'ship-stations';
  label: string;
  desc: string;
  requiresTrait?: { id: string };
}
export const shipStations = shipStationsJson as ShipStationData[];
const stationParId = indexParId('shipStations', shipStations);
export const findShipStation: (id: string) => ShipStationData | undefined = stationParId;
export const crewRoles = crewRolesJson as CrewRoleData[];
const roleEquipageParId = indexParId('crewRoles', crewRoles);
export const findCrewRoleById: (id: string) => CrewRoleData | undefined = roleEquipageParId;
export const crewTestTypes = (crewTestTypesJson as { types: CrewTestTypeData[] }).types;
const testEquipageParId = indexParId('crewTestTypes', crewTestTypes);
export const findCrewTestTypeById: (id: string) => CrewTestTypeData | undefined = testEquipageParId;
/** Groupes d'objet app-owned (taxonomie `subType` id-ifiée) — éditable au Codex. */
export const weaponGroups = weaponGroupsJson as WeaponGroupData[];
export const groups = groupsJson as GroupData[];
// Bestiaire APP-OWNED : officiel + complément « frenchy.bzh » INTÉGRÉ directement dans creatures.json
// (fusionné 2026-06-15, espèce explicite posée) — plus de dataset frenchy séparé à merger.
export const creatures = creaturesJson as CreatureData[];
// Sorts app-owned — officiels + homebrew « frenchy.bzh » des casters (Magie Mineure/Arcanes,
// Bénédictions, Miracles…) TOUT dans `spells.json` ; chaque sort garde sa `source`, dont `frenchy.bzh` pour le homebrew).
export const spells = spellsJson as SpellData[];
/** Manœuvres app-owned (attaques naturelles activées — LDB 85) : ENTITÉ de 1ʳᵉ classe éditable au Codex,
 *  effets en GameOp. Octroyées aux créatures via `TraitData.grantsManeuvers` ; résolues par id. */
export const maneuvers = maneuversJson as ManeuverDef[];
/** Niveaux de lumière ambiante app-owned (brouillard de guerre) : `scalar` 0..1 (assombrissement du
 *  rendu) + `baseSightTiles` (rayon de vue de base en cases — réglage MAISON : le LDB ne stat pas la
 *  portée de vue). Édité au Codex. `Scene.ambientLight` réfère un `id` (ou `auto` = suit l'horloge). */
export interface LightLevelDef { id: string; type: 'lightLevels'; label: string; scalar: number; baseSightTiles: number }
export const lightLevels = lightLevelsJson as LightLevelDef[];
const niveauLumiereParId = indexParId('lightLevels', lightLevels);
export const findLightLevelById: (id: string) => LightLevelDef | undefined = niveauLumiereParId;
/** TON de lumière app-owned (#1245, L4) : l'APPARENCE d'une source PONCTUELLE — couleur, part
 *  d'intensité (facteur du calage anti-saturation du rendu, jamais une intensité absolue) et
 *  vacillement optionnel. Aucune conséquence de règle : le moteur ne connaît d'une source que son
 *  RAYON (LDB 74). Référencé par `tone` (prop, instance de scène, op `light`, `ActiveEffect.light`) ;
 *  absent = `flamme`. Résolu au bord du RENDU (`gameIso/stage/stagePointLights.ts`). */
export interface LightToneDef { id: string; type: 'lightTones'; label: string; color: string; intensity: number; flicker?: { amplitude: number; hz: number } }
export const lightTones = lightTonesJson as LightToneDef[];
/** Lookup LIVE par BALAYAGE, et non par `indexParId` : à QUATRE entrées, l'index ne rachète pas son
 *  coût — même choix MESURÉ que `matieresDe` (`+4,1 ms` contre un index sur 18 026 lookups, #1686 lot
 *  3a-1, cf. `findPropMaterialById` ci-dessous). Le balayage est vif par construction : le catalogue
 *  se mute EN PLACE (`data/overrides.ts`). */
export const findLightToneById = (id: string): LightToneDef | undefined => lightTones.find((t) => t.id === id);
/** Ton SERVI à une source qui n'en nomme aucun — le feu, le cas du monde (brasero, feu de camp). */
export const DEFAULT_LIGHT_TONE_ID = 'flamme';
/** Contrats NEUTRES du décor (type de prop, recette volumique, matériaux, places assises) — définis
 *  hors du chargeur pour rester importables par `src/state` et `src/gameIso` (cf. `props.types.ts`). */
export type { PropData, PropMaterialData, PropMaterialId, PropPoint3, PropSize3, PropPrimitive, PropVolumeRecipe, PropSeatSlot } from './props.types';
export { validatePropCatalog, propFootOf } from './props.types';
export const props = propsJson as PropData[];
/** Type de décor par id — `undefined` en entrée rend `undefined` : une entité qui ne NOMME aucun type
 *  n'en résout aucun, exactement comme une ref hors registre (#877). */
export const findPropById = indexParId('props', props);
/** Un type de décor rend-il en VOLUME (recette authorée) plutôt qu'en billboard ? RÈGLE UNIQUE, propriété
 *  du CATALOGUE : l'émetteur de décor (`gameIso/builders/props.ts`) comme le validateur de scène
 *  (`state/validateScene.ts`) la lisent ici — aucun site ne la redevine. `ref` absente = aucun type
 *  résolu, donc aucun volume : la même absence qu'une ref hors registre (#877). */
export const refEstVolumique = (ref: string | undefined): boolean => !!findPropById(ref)?.volume;
/** Matière de rendu d'une recette volumique de décor, par id — lecture VIVE du document (`matieresDe`),
 *  jamais un index cuit au chargement. Unicité des ids sur tout le périmètre des matières :
 *  `data/materials-identite.test.ts` (#1686). */
export const findPropMaterialById = (id: string): PropMaterialData | undefined => matieresDe('prop').find((m) => m.id === id);
/** Domaines de magie app-owned (LDB 48) — ENTITÉ éditable au Codex (attributs en données : onHit,
 *  projectile, post-incantation). Le RUNTIME résout par `id` STABLE (= `SpellData.domainId`, cf.
 *  `findDomainById`) ; `domainByLabel`/`findDomain` restent pour l'authoring/affichage. */
export const domains = domainsJson as DomainData[];
const domaineParLabel = indexParChamp('domains', domains, (d) => d.label);
export const findDomain: (label: string | null | undefined) => DomainData | undefined = domaineParLabel;
/** Index des Domaines par `id` STABLE — lookup RUNTIME indépendant de la langue (sort→domaine). */
const domaineParId = indexParId('domains', domains);
export const findDomainById: (id: string | null | undefined) => DomainData | undefined = domaineParId;
/** Index des Domaines par `wind` (Vent de Magie) — résout un Vent (Ghur, Aqshy, Dhar…) vers son Domaine.
 *  SOURCE de la Compétence Focalisation (spécialisée par Vent) : un `focalisation.spec` porte l'id du
 *  Domaine et AFFICHE le Vent ; ce lookup fait l'inverse (authoring/migration Vent → id). */
const domaineParVent = indexParChamp('domains', domains, (d) => d.wind);
export const findDomainByWind: (wind: string | null | undefined) => DomainData | undefined = domaineParVent;
/** Un axe du catalogue `axes.json` (#409) — vue TS de son schéma zod. */
export type AxisData = AxesData[number];
/** Catalogue des axes de forces/faiblesses (mécanique MAISON, #409) : socle de base (`core`) +
 *  exemples de scénario (négoce/ingénierie/navigation). `derivation` liste des ids STABLES de
 *  `skills.json`/`talents.json` — résolus par `axisScore` (`src/engine/axes.ts`). Intégrité des ids
 *  vérifiée par `axes-integrity.test.ts` (patron `book-source-integrity.test.ts`). */
export const allAxes = axesJson as AxisData[];
const axeParId = indexParId('axes', allAxes);
export const findAxisById: (id: string) => AxisData | undefined = axeParId;
/** Socle par défaut d'une campagne SANS `activeAxes` déclaré (`WorldMap.activeAxes`). */
export const coreAxisIds = memoParVersion('axes', (): string[] => allAxes.filter((a) => a.core).map((a) => a.id));
export const eyes = eyesJson as DetailColorData[];
export const hairs = hairsJson as DetailColorData[];
/** Calendrier impérial — tables de CONTENU éditables au Codex (cf. `engine/clock.ts` pour la mécanique). */
export const calendarMonths = calendarMonthsJson as { id: string; type: 'calendarMonths'; label: string; days: number }[];
export const calendarIntercalary = calendarIntercalaryJson as { id: string; type: 'calendarIntercalary'; label: string; afterMonth: number }[];
export const calendarWeekdays = calendarWeekdaysJson as { id: string; type: 'calendarWeekdays'; label: string }[];
export const calendarPhases = calendarPhasesJson as { id: string; type: 'calendarPhases'; start: number; label: string; icon: string }[];
/** Table de Météo de voyage TERRESTRE (EDOC 8). `seasons` = plages d100 → météo par saison ;
 *  `conditions` = EFFETS par météo (mêmes formes de donnée que `sea-weather.json`). Éditable au Codex. */
const weatherData = weatherJson as {
  seasons: { id: string; label: string; ranges: { min: number; max: number; weather: string }[] }[];
  physicalTestChars: string[];
  conditions: {
    id: string; label: string; desc?: string;
    visibiliteM?: number; rangedMod?: number; rangedUseless?: boolean; powderUseless?: boolean;
    physicalTestMod?: number; movementWalkOnly?: boolean; lightningNervous?: boolean;
    resistanceTest?: { difficulty: string; onFail: 'extenue'; enjeu?: string };
    source?: SourceRef;
  }[];
};
/** 1 entrée par saison, `ranges` = plages d100 → météo (lecture par `rollStageWeather`). */
export const weather = weatherData.seasons;
/**
 * Libellé d'affichage d'une SAISON (`Season`, `src/engine/travelStages.ts`) — SOURCE UNIQUE, keyée par
 * l'id STABLE : le nom FR vit dans la donnée éditable (`weather.json › seasons[].label`), jamais en
 * table d'écran. Même patron que `specLabel`/`refLabel` ci-dessous. Une saison sans fiche météo n'a
 * pas de nom à afficher : elle est NOMMÉE par sa clé plutôt que passée sous silence.
 */
export function seasonLabel(id: string): string {
  return libelleOuAbsence(weatherData.seasons.find((s) => s.id === id), 'saison', id);
}

/** Nature d'une entité dont l'ABSENCE est atteignable en jeu (#1906) : héros sorti du groupe, combattant
 *  sorti du combat, lieu effacé de la carte, navire retiré du catalogue, saison sans fiche météo. */
export type NatureAbsente = 'heros' | 'combattant' | 'lieu' | 'navire' | 'saison' | 'mois' | 'race' | 'carriere';
/** Le libellé d'une entité résolue, ou son ABSENCE nommée en français de joueur par sa nature (#1906) —
 *  jamais un littéral qui la masque. Une absence IMPOSSIBLE ne passe pas ici : elle lève. */
export function libelleOuAbsence(e: { label: string } | undefined, nature: NatureAbsente, id: string): string {
  return e ? e.label : t(`absent.${nature}`, { id });
}
/** Effets par météo (visibilité, mods de tir, poudre, Tests physiques, plafond de mouvement…). */
export const weatherConditions = weatherData.conditions;
/** Caractéristiques réputées « physiques » (liste MAISON, EDOC 8 l.82 non chiffrée). */
export const weatherPhysicalTestChars = weatherData.physicalTestChars;
/** Tableau des Vents Tourbillonnants (LDB 46 l.183-190, option `vents-tourbillonnants`) — tirage 1d10
 *  (`engine/windsOfMagic.ts`, lecture JSON directe comme `drunkenness.ts`) ; réexporté ICI pour le
 *  Codex (`ventsTourbillonnants`, `ui/compendium/registry.ts`). */
export const windsOfMagicTable = (ventsTourbillonnantsJson as { entries: { id: string; min: number; max: number; mod: number; label: string }[] }).entries;
export const details = detailsJson as DetailsData;
/** Semences d'une scène NEUVE (#1716) — lues par `emptyScene` (`state/scene.ts`), éditables au Codex. */
export const semencesDeScene = semencesDeSceneJson as SemencesDeSceneData;
/** Défauts du COMPILATEUR de scène (#1716) — lus par `mapSpec.ts`/`buildBoardingScene`, éditables au Codex. */
export const defautsDeCompilation = defautsDeCompilationJson as DefautsDeCompilationData;
export const stars = starsJson as StarData[];
/** Les 5 demeures célestes (ADE II 3 l.502-512, « Déterminer les demeures célestes ») — ossature
 *  narrative du thème astral (flavor pur, aucun effet mécanique). `rand` = borne haute du 1d10. */
export const celestialHouses = astrologyJson as CelestialHouseData[];
/** Apparences d'espèce de rig (app-owned, éditable) — SOURCE lue+résolue par `raceById` (rig). */
export const raceAppearance = raceAppearanceJson as RaceAppearanceData[];
export const locations = locationsJson as LocationData[];
const lieuParId = indexParId('locations', locations);
/** Résout un Lieu par son `id` STABLE (cible de `LocationData.parent`). Le libellé ne sert qu'à l'affichage. */
export function findLocationById(id: string | null | undefined): LocationData | undefined {
  return lieuParId(id);
}
export const books = booksJson as BookData[];
const livreParId = indexParId('books', books);
/** Résout un Livre par son `id` STABLE (cible de `source.book`) — `abbr`/`label` ne servent qu'à l'affichage. */
export function findBookById(id: string | null | undefined): BookData | undefined {
  return livreParId(id);
}
/** Acronyme d'un livre depuis l'`id` porté par `source.book` (fallback = l'id si inconnu). */
export function bookAbr(id: string | null | undefined): string {
  if (!id) return '';
  return livreParId(id)?.abbr ?? id;
}
/** Culte/Dieu (LDB 41) : `id` = slug STABLE (« sigmar »), `label` = nom affiché (« Sigmar »), Bénédictions/
 *  Miracles en `Ref[]` (sorts par id), desc = lore HTML (Codex). Dataset éditable (Compendium) — remplace
 *  les `cults/defs/*.ts` (codegen retiré). */
export interface GodData {
  id: string;
  type: 'gods';
  label: string;
  /** Ids de `groups.json` accordés au fidèle de ce culte — poussés par un Talent qui porte
   *  `grantSpecGroups` et dont le `spec` nomme ce dieu (`groupsFor`). Absent = aucun Groupe. */
  grantGroups?: string[];
  title?: string;
  blessings: Ref[];
  miracles: Ref[];
  /** Sorts du Chaos accordés par ce Dieu Sombre (LDB 10 « Magie du Chaos » : « Domaine du Chaos » de
   *  Nurgle/Slaanesh/Tzeentch), IDS de sort — l'analogue de `blessings`/`miracles` pour la 3e famille de
   *  lanceur. SOURCE d'identité (le grimoire compare par id) ; le `subType` du sort ne sert qu'à l'affichage. */
  chaosSpells?: Ref[];
  desc?: string;
  source?: SourceRef;
  /** VERROU de Péché du culte (MDG 11 l.148, Stromfels : « retire à un suivant la capacité d'utiliser le
   *  Talent *Invocation* s'il possède au moins deux Points de Péché et celle d'utiliser le Talent *Béni*
   *  s'il possède au moins cinq Points de Péché ») — seuil de Points de Péché à partir duquel le dieu
   *  RETIRE l'usage du Talent de Prière (clé = famille d'incantation). GÉNÉRIQUE : aucun culte LDB n'en
   *  porte (LDB 40 ne connaît que la Colère au dé des unités) ; consommé par le flux de Prière
   *  (`prayerSinLock`, engine/magic). */
  sinLocks?: { beni?: number; invocation?: number };
}
export const gods = godsJson as GodData[];
/** Banques de noms — UN document par race jouable, d'`id` égal à son `RaceKey` (celui de
 *  `species.refChar`) : `engine/names` retrouve la banque par cet id (#1467 L1b V-FLIP-RECORD). */
export const names = namesJson as NamePool[];
/** Personnages pré-tirés (DÉFINITIONS) — app-owned éditable au Codex ; la FABRIQUE (`createHero`)
 *  vit dans `pregens.ts`, qui consomme CE tableau (même référence → mutation live de l'éditeur). */
export const pregens = pregensJson as PregenDef[];
/** Tableau des Oups ! (LDB Maladresses) — app-owned éditable ; consommé par `oups.ts` (même référence). */
export const oups = oupsJson as OupsRow[];
/** Événements « Entre deux aventures » (LDB d100) — app-owned éditable ; consommé par `interludeEvents.ts`. */
export const interludeEvents = interludeEventsJson as InterludeEvent[];
/** Péripéties de voyage (1d10) — app-owned éditable ; consommé par `peripeties.ts` (même référence). */
export const peripeties = peripetiesJson as Peripetie[];

/** Réseau routier impérial (EDOC 3 « Les routes et grandes routes » et EDOC 6 « Patrouilleurs
 *  routiers ») — catalogue de CALIBRATION d'une `MapRoute` : classes de route et leurs largeurs,
 *  espacement des auberges relais, compagnies de diligences nommées, tarif et espacement des postes
 *  de péage, effectifs de patrouille. Aucun de ces champs n'étend le vocabulaire de `MapRoute` : ils
 *  se posent sur `inns`/`prices`/`speed`/`km` à l'authoring de carte. */
export interface ReseauRoutierData {
  id: string;
  type: 'reseau-routier';
  label: string;
  /** Ce dont l'entrée parle — discriminant FERMÉ. */
  kind: 'classe' | 'relais' | 'compagnie' | 'peage' | 'patrouille';
  desc?: string;
  source?: SourceRef;
  largeurMinM?: number;
  largeurMaxM?: number;
  espacementKm?: number;
  etapeDiligenceJours?: number;
  etapeChevalJours?: number;
  etapePiedJours?: number;
  espacementKmMin?: number;
  espacementKmMax?: number;
  /** Droit de passage en sous de cuivre (`brass`, unité de `vehicles.json`) par jambe qui traverse. */
  tarifBrassMin?: number;
  tarifBrassMax?: number;
  prixSurcotePct?: number;
  effectifMin?: number;
  effectifMax?: number;
  effectifRouteReculeeMin?: number;
  effectifRouteReculeeMax?: number;
  facteurZoneDangereuse?: number;
  facteurGrandsTroublesMin?: number;
  facteurGrandsTroublesMax?: number;
}
export const reseauRoutier = reseauRoutierJson as ReseauRoutierData[];
const reseauRoutierById = new Map(reseauRoutier.map((r) => [r.id, r]));
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
export function conditionLabel(id: string): string {
  return etatParId(id)?.label ?? id;
}
/** Libellé d'affichage d'un état psychologique par son `id` (`PsychType`), repli sur l'id — délègue au
 *  résolveur de libellé GÉNÉRIQUE (`refLabel`), jamais une copie locale du motif `MAP.get(id)?.label ?? id`. */
export function psychologyLabel(id: string): string {
  return refLabel('psychologies', { id });
}
/** ids d'États du catalogue, dans l'ordre du dataset — vue VIVE (`memoParVersion`), reconstruite
 *  après une édition au Codex. Consommée par le scan du journal (`engine/conditions.conditionIdInText`)
 *  qui itère des ids et n'obtient le libellé que pour le chercher dans un texte FRANÇAIS. */
export const conditionIds = memoParVersion('etats', () => etats.map((e) => e.id));
const etatParLabelMinuscule = indexParChamp('etats', etats, (e) => e.label.toLowerCase());
/** Résout un `id` d'État depuis un LIBELLÉ (authoring : parsing de desc/texte) — insensible à la casse. */
export function conditionIdByLabel(label: string): string | undefined {
  return etatParLabelMinuscule(label.toLowerCase())?.id;
}
/** Inverse de `CHAR_LABELS` (engine/types) : nom FR complet (« Force Mentale ») → `CharKey` (« FM »).
 *  Couture UNIQUE label→id des Caractéristiques — consommée par `engine/spellRange.ts` pour parser
 *  la prose des Portées/ZdE de sort (« (Bonus de Force Mentale) mètres »), jamais recopiée ailleurs. */
const CHAR_KEY_BY_LABEL = new Map<string, CharKey>((Object.entries(CHAR_LABELS) as [CharKey, string][]).map(([k, v]) => [v, k]));
export function charKeyByLabel(label: string): CharKey | undefined {
  return CHAR_KEY_BY_LABEL.get(label);
}
const especeParId = indexParId('species', species);
/** Résout une Espèce par son `id` STABLE (slug du libellé) — réf runtime/données (Combatant.species,
 *  pregens, draft). Le libellé ne sert qu'à l'affichage (`speciesSingular`). */
export function findSpeciesById(id: string | undefined): SpeciesData | undefined {
  return especeParId(id);
}
/** Les profils standard (`LDB 77 l.7`) : les fiches que `species.json` désigne par `profilStandard`,
 *  sans doublon, dans l'ordre du dataset. */
export function profilsStandard(): string[] {
  return [...new Set(species.flatMap((s) => (s.profilStandard ? [s.profilStandard.id] : [])))];
}
/** La réf d'un PERSONNAGE désigne-t-elle une fiche SPAWNABLE ? Créature du bestiaire, coque de véhicule
 *  (`vehicles.json` facette `hull`, MDG 13), affût d'engin de siège (`trappings.json` `siegeRig`, AA 10).
 *  SOURCE UNIQUE de la famille (#1882) : la porte du schéma (`sceneEntitySchema`), `validateScene` et le
 *  spawn (`spawnEnemy`) la lisent ici. */
export function refEntiteResolue(ref: string): boolean {
  return !!(findCreatureById(ref) || findVehicleById(ref)?.hull || findTrappingById(ref)?.siegeRig);
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
/** Ce qu'un effet NEUF sème avant tout choix d'auteur (`givePossession`, `startPursuit`) — et ce que
 *  reçoit un `creatureId`/`vehicleId` VIDE semé avant #1882 (`PROJECT_MIGRATIONS[13]`). */
export const creatureSemee = (): string => premierOffert(creatures, 'Créature semée par un effet neuf');
export const vehiculeSeme = (): string => premierOffert(vehicles, 'Véhicule semé par un effet neuf');
export const navireSeme = (): string => premierOffert(vehicles.filter((v) => v.ship), 'Navire semé par un effet neuf');
/** Taille CONFÉRÉE par les talents d'espèce FIXES (une référence ARRÊTÉE, jamais un `{pick}`, un
 *  `{random}` ni un `choix` résiduels — chip décoratif du créateur avant résolution complète, #572).
 *  Même vocabulaire que `sizeFromTalents` (engine/character.ts) : la plus grande catégorie parmi
 *  `TalentData.size`. */
export function speciesSize(sp: SpeciesData): import('../engine/size').SizeCategory {
  const ids = sp.talents.filter((t): t is Ref => 'id' in t && t.choix == null).map((t) => t.id);
  return sizeFromTalents(ids, (id) => findTalentById(id)?.size);
}
/** id d'espèce RIG (slug, clé `appearance.species`) dérivé d'un id d'espèce RULES (ou chaîne libre) :
 *  slug du LIBELLÉ d'espèce. Pont UNIQUE rules→rig (pregens/draft/creator/defaultAppearance).
 *  Sortie = l'id species.json de l'entrée trouvée (invariant `slugId(label) === id`, 27/27, gardé par
 *  `refs-migrated.test.ts`). DEUX branches sortent de ce vocabulaire : sans entrée, le `rulesId` est
 *  slugué tel quel (identité sur un id inconnu) ; sans argument, la sortie est `humain` — un id de
 *  `raceAppearance.json`, PAS de species.json. */
export function rigSpeciesId(rulesId: string | undefined): RigSpeciesId {
  return slugId(findSpeciesById(rulesId)?.label ?? rulesId ?? 'Humain') as RigSpeciesId;
}
/** Seuil d100 de mutation PHYSIQUE d'une espèce par `id` (LDB 19 l.78-81). Défaut **50** = colonne
 *  Humain (LDB) — couvre aussi le Gnome (NADJ « Gnomes et Corruption » : « mutent comme les humains »)
 *  et toute espèce hors Tableau. Les valeurs ≠ 50 (Elfe 0, Nain 5, Halfling 10, Ogre 10) sont en donnée. */
export function mutationBodyMaxForSpecies(id: string | undefined): number {
  return findSpeciesById(id)?.mutationBodyMax ?? 50;
}

/** Affichage SINGULIER de l'espèce d'un INDIVIDU : les `label` du catalogue sont des libellés de
 *  CATÉGORIE au pluriel (« Nains », « Humains (Reiklander) ») ; un personnage est un individu (B1).
 *  Mappe le groupe pluriel → singulier en conservant la sous-espèce entre parenthèses. Repli = tel quel. */
const SPECIES_SINGULAR: Record<string, string> = {
  Humains: 'Humain',
  Halflings: 'Halfling',
  Nains: 'Nain',
  Gnomes: 'Gnome',
  Ogres: 'Ogre',
  'Hauts elfes': 'Haut elfe',
  'Elfes sylvains': 'Elfe sylvain',
};
export function speciesSingular(label: string | undefined): string {
  if (!label) return '';
  const i = label.indexOf('(');
  const group = (i >= 0 ? label.slice(0, i) : label).trim();
  const suffix = i >= 0 ? ' ' + label.slice(i).trim() : '';
  return (SPECIES_SINGULAR[group] ?? group) + suffix;
}
/**
 * Carrières accessibles à une espèce (Tableau des Classes et Carrières aléatoires, LDB 05
 * l.197+ : « certaines ont des restrictions liées à la Race », l.360). `ignoreRestrictions`
 * = option « Mais je veux jouer un elfe sylvain Flagellant ! » (l.362, accord du MJ).
 */
export function careersForSpecies(refCareer: RefCareerId, ignoreRestrictions = false): CareerData[] {
  if (ignoreRestrictions) return careers;
  return careers.filter((c) => c.rand?.[refCareer] != null);
}
const carriereParId = indexParId('careers', careers);
/** Résout une Carrière par son `id` STABLE. Le libellé ne sert qu'à l'affichage. */
export function findCareerById(id: string | undefined): CareerData | undefined {
  return carriereParId(id);
}
/** Choix d'AFFICHAGE masculin/féminin (source unique) : `labelF` si sexe F et disponible, sinon
 *  `label`. Le sexe vit dans l'apparence cosmétique (`Combatant.appearance.sex`), jamais dans le moteur. */
export function displayLabelForSex(sex: 'M' | 'F' | undefined, label: string, labelF?: string): string {
  return sex === 'F' && labelF ? labelF : label;
}
/** Libellé de Carrière à AFFICHER pour un personnage (forme féminine si sexe F). Bord UI — le
 *  retour est du texte d'affichage, JAMAIS une clé. */
export function careerLabelFor(c: { career?: string; appearance?: { sex?: 'M' | 'F' } }): string {
  const career = findCareerById(c.career);
  if (!career) return c.career ?? '';
  return displayLabelForSex(c.appearance?.sex, career.label, career.labelF);
}
const classeParId = indexParId('classes', classes);
/** Résout une Classe par son `id` STABLE (= `CareerData.class`). */
export function findClassById(id: string | undefined): ClassData | undefined {
  return classeParId(id);
}
export function levelsForCareer(careerId: string): CareerLevelData[] {
  return careerLevels.filter((c) => c.career === careerId).sort((a, b) => a.level - b.level);
}
export function firstLevel(careerId: string): CareerLevelData | undefined {
  return levelsForCareer(careerId)[0];
}
export function findSkill(label: string): SkillData | undefined {
  // Exact d'abord, puis casse ignorée (les statblocs de campagne écrivent « Corps à Corps »).
  return skills.find((s) => s.label === label) ?? skills.find((s) => s.label.toLowerCase() === label.toLowerCase());
}
/** Résout un `id` de Compétence depuis un LIBELLÉ d'AUTHORING (entrée de carrière/espèce, texte
 *  saisi) — repli `slugId` si le libellé n'est pas au catalogue (dette de donnée, jamais un crash).
 *  Couture label→id (doctrine CLAUDE.md) : SEULE définition, `src/engine` délègue ici. */
export function skillIdByLabel(label: string): string {
  return findSkill(label)?.id ?? slugId(label);
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
/** Noyau de RÉFÉRENCE structurée par `id` STABLE — partagé par toutes les refs de la donnée
 *  (compétences, talents, sorts, qualités, possessions, bénédictions…). `id` = slug du libellé
 *  (robuste au renommage) ; `spec` = spécialisation/type concret libre (« Ghur », « Reikland »), non un id. */
export interface Ref {
  id: string;
  spec?: string;
}
/**
 * Référence STRUCTURÉE à une Compétence — la réf de la grammaire (`refOuSpec('skill')`, régimes
 * `spec` DÉSIGNÉE XOR `choix` à faire) + `value`, le nombre IMPRIMÉ au statbloc.
 *
 * `choix` ne survit PAS au spawn : `skillsFromBook` (`state/spawn.ts`) DÉSIGNE une spécialisation, et
 * la `SkillInstance` runtime est toujours concrète.
 */
export interface SkillRef extends Ref {
  choix?: true | string[];
  value: number;
}
/** Libellé d'affichage d'une `SkillRef` : « Langue (Magick) 63 », « Savoir (Au choix) 65 »,
 *  « Métier (Armurier ou Forgeron) 50 ». */
export function skillRefLabel(ref: SkillRef): string {
  const base = ref.choix != null ? choixLabel('skills', ref.id, ref.choix) : refLabel('skills', ref);
  return `${base} ${ref.value}`;
}
export function findTalent(label: string): TalentData | undefined {
  return talents.find((t) => t.label === label);
}
/** Résout un `id` de Talent depuis un LIBELLÉ d'AUTHORING (entrée de carrière/espèce, texte saisi) —
 *  repli `slugId` si le libellé n'est pas au catalogue (dette de donnée, jamais un crash). Couture
 *  label→id (doctrine CLAUDE.md) : SEULE définition, `src/engine` délègue ici. */
export function talentIdByLabel(label: string): string {
  return findTalent(label)?.id ?? slugId(label);
}
/** Specs PROPOSÉES par un libellé d'AUTHORING à joker (« Nom (Au choix) ») — résout Compétence OU
 *  Talent par libellé puis délègue à `specPoolOf` (hoisté plus bas dans ce module). `[]` si le nom
 *  ne porte aucune spec ou n'est pas au catalogue. */
export function wildcardSpecIds(name: string): string[] {
  const def = findSkill(name) ?? findTalent(name);
  return def ? specPoolOf(def) : [];
}
const talentParId = indexParId('talents', talents);
/** Résout un Talent par son `id` STABLE (référence structurée — fin du lookup par libellé parsé). */
export function findTalentById(id: string): TalentData | undefined {
  return talentParId(id);
}
/** Référence STRUCTURÉE à un Talent (`Ref` + niveau `times` ≥2) — fin des chaînes « Maîtrise du combat 2 ». */
export interface TalentRef extends Ref {
  times?: number;
}
/** Libellé d'affichage d'une `TalentRef` : « Magie des Arcanes (Ghur) », « Maîtrise du combat 2 »
 *  (base+spec via `refLabel`, + niveau si ≥2). La spec RESTE dans le libellé (clé du registre combatFeatures). */
export function talentRefLabel(ref: TalentRef): string {
  return refConcrete('talents', ref) + (ref.times && ref.times > 1 ? ` ${ref.times}` : '');
}
/** Sous-type d'une QUALITÉ (classification RAW : qualités d'Arme LDB 62, d'Armure LDB 63, d'Objet). */
export interface QualitySubtypeData { id: string; type: 'qualitySubtypes'; label: string; }
export const qualitySubtypes = qualitySubtypesJson as QualitySubtypeData[];
const sousTypeQualiteParId = indexParId('qualitySubtypes', qualitySubtypes);
/** Résout un sous-type de Qualité par son `id` STABLE (= `QualityData.subType`). */
export function findQualitySubtypeById(id: string | null | undefined): QualitySubtypeData | undefined {
  return sousTypeQualiteParId(id);
}
/** Libellé d'affichage d'un sous-type de Qualité par son id (repli sur l'id). SOURCE UNIQUE du nom. */
export function qualitySubtypeLabel(id: string | null | undefined): string {
  return id ? (sousTypeQualiteParId(id)?.label ?? id) : '';
}
/** Type d'une QUALITÉ : Atout (bénéfique) / Défaut (handicap) — classification RAW (LDB 62/63). */
export interface QualityTypeData { id: string; type: 'qualityTypes'; label: string; }
export const qualityTypes = qualityTypesJson as QualityTypeData[];
const typeQualiteParId = indexParId('qualityTypes', qualityTypes);
/** Résout un type de Qualité par son `id` STABLE (= `QualityData.polarite`). */
export function findQualityTypeById(id: string | null | undefined): QualityTypeData | undefined {
  return typeQualiteParId(id);
}
/** Libellé d'affichage d'un type de Qualité par son id (repli sur l'id). SOURCE UNIQUE du nom. */
export function qualityTypeLabel(id: string | null | undefined): string {
  return id ? (typeQualiteParId(id)?.label ?? id) : '';
}
const groupeObjetParId = indexParId('weaponGroups', weaponGroups);
/** Résout un Groupe d'objet par son `id` STABLE (= `subType` d'un trapping/Weapon/ItemInstance). */
export function findWeaponGroupById(id: string | null | undefined): WeaponGroupData | undefined {
  return groupeObjetParId(id);
}
/** Libellé d'affichage d'un Groupe d'objet par son id (repli sur l'id). SOURCE UNIQUE du nom de Groupe. */
export function weaponGroupLabel(id: string | null | undefined): string {
  return id ? (groupeObjetParId(id)?.label ?? id) : '';
}
/** VOCABULAIRE FERMÉ des catégories de possession (`TrappingData.categorie`), miroir de l'enum du
 *  schéma `src/data/schemas/defs/trappings.ts` — une union, pas un registre de données. */
export type TrappingTypeId = 'melee' | 'ranged' | 'ammunition' | 'armor' | 'trapping';
const armeParLabelNormalise = indexParChamp('trappings', trappings, (t) =>
  (t.categorie === 'melee' || t.categorie === 'ranged') && t.subType ? norm(t.label) : undefined);
/** `id` de Groupe d'arme (`TrappingData.subType`) depuis un LIBELLÉ d'arme SAISI (arme custom, statbloc
 *  sans identité de catalogue) — libellé normalisé, `undefined` hors catalogue. La couture label→id vit
 *  ICI, au chargement de la donnée (CLAUDE.md § Pour TOUT agent) : `engine/weaponGroup` délègue et ne
 *  manipule que des ids. Patron `traitIdByLabel`/`qualityIdByLabel`. */
export function weaponGroupIdByWeaponLabel(label: string): string | undefined {
  return armeParLabelNormalise(norm(label))?.subType ?? undefined;
}
const groupeObjetParLabelMinuscule = indexParChamp('weaponGroups', weaponGroups, (g) => g.label.toLowerCase());
/** Résout un `id` de Groupe depuis un LIBELLÉ (authoring/données de Sort « subType » par libellé) —
 *  insensible à la casse. Renvoie l'id si déjà un id connu, sinon résout le libellé. */
export function weaponGroupIdByLabel(label: string | null | undefined): string | undefined {
  if (!label) return undefined;
  if (groupeObjetParId(label)) return label; // déjà un id
  return groupeObjetParLabelMinuscule(label.toLowerCase())?.id;
}
const groupeParId = indexParId('groups', groups);
/** Résout un Groupe d'APPARTENANCE par son `id` STABLE (cible de Trait psy, filtre onlyGroups/exceptGroups). */
export function findGroupById(id: string | null | undefined): GroupData | undefined {
  return groupeParId(id);
}
/** Libellé d'affichage d'un Groupe d'appartenance par son id (repli sur l'id). SOURCE UNIQUE du nom de Groupe. */
export function groupLabel(id: string | null | undefined): string {
  return id ? (groupeParId(id)?.label ?? id) : '';
}
/** Type de Souffle d'une créature (Feu/Froid/Corrosif/Électrique/Poison/Fumée) — argument du Trait Souffle,
 *  aligné sur les manœuvres `souffle-*`. Registre SSOT (`breath-types.json`). */
export interface BreathTypeData { id: string; type: 'breath-types'; label: string; }
export const breathTypes = breathTypesJson as BreathTypeData[];
const typeSouffleParId = indexParId('breathTypes', breathTypes);
/** Résout un Type de Souffle par son `id` STABLE. */
export function findBreathTypeById(id: string | null | undefined): BreathTypeData | undefined {
  return typeSouffleParId(id);
}
/** Libellé d'affichage d'un Type de Souffle par son id (repli sur l'id). SOURCE UNIQUE du nom. */
export function breathTypeLabel(id: string | null | undefined): string {
  return id ? (typeSouffleParId(id)?.label ?? id) : '';
}
/** Type de Dégâts ignoré par le Trait Immunité (LDB 85 : « poison, magiques ou électriques ») — argument du
 *  Trait Immunité (multi-valeurs) ET référent des `unlessImmune` des Flows (Venin (Poison)…). Registre SSOT
 *  (`damage-types.json`, éditable). */
export interface DamageTypeData { id: string; type: 'damage-types'; label: string; }
export const damageTypes = damageTypesJson as DamageTypeData[];
const typeDegatsParId = indexParId('damageTypes', damageTypes);
/** Résout un Type de Dégâts par son `id` STABLE. */
export function findDamageTypeById(id: string | null | undefined): DamageTypeData | undefined {
  return typeDegatsParId(id);
}
/** Libellé d'affichage d'un Type de Dégâts par son id (repli sur l'id). SOURCE UNIQUE du nom. */
export function damageTypeLabel(id: string | null | undefined): string {
  return id ? (typeDegatsParId(id)?.label ?? id) : '';
}
const creatureParId = indexParId('creatures', creatures);
/** Résout une créature par son `id` STABLE — référence runtime/données (scènes, encounters, rig). */
export function findCreatureById(id: string | undefined): CreatureData | undefined {
  return creatureParId(id);
}
/** Libellé d'affichage d'une créature par son id (repli sur l'id si introuvable). */
export function creatureLabel(id: string): string {
  return creatureParId(id)?.label ?? id;
}
/** Seul lecteur autorisé de la nommé-ité (jamais via `title`) : `true` si la créature est un individu nommé. */
export function isNamed(c: CreatureData): boolean {
  return c.named === true;
}
/** Lookup par LIBELLÉ — réservé à l'AUTHORING/affichage (picker éditeur, Codex) ; le runtime résout par id. */
export function findCreature(label: string): CreatureData | undefined {
  return creatures.find((c) => c.label === label);
}
/** Sort par LIBELLÉ — bord AUTHORING/affichage ; rend l'entrée EFFECTIVE, comme `findSpellById`. */
export function findSpell(label: string): SpellData | undefined {
  return effectiveEntry(spells.find((s) => s.label === label));
}
/** Signe astral par LIBELLÉ — bord AUTHORING/affichage (l'éditeur, le tirage qui produit un libellé). */
export function findStar(label: string): StarData | undefined {
  return stars.find((s) => s.label === label);
}
const signeAstralParId = indexParId('stars', stars);
/** Signe astral par `id` STABLE — lookup RUNTIME indépendant de la langue (`Combatant.star` = id). */
export function findStarById(id: string | null | undefined): StarData | undefined {
  return signeAstralParId(id);
}

const possessionParId = indexParId('trappings', trappings);
/** Résout une Possession par son `id` STABLE (référence structurée — ≠ `findTrapping` par libellé, authoring). */
export function findTrappingById(id: string): TrappingData | undefined {
  return possessionParId(id);
}
const possessionParLabelNormalise = indexParChamp('trappings', trappings, (t) => norm(t.label));
/** Résout une Possession par LIBELLÉ normalisé — bord AUTHORING (texte libre saisi par l'auteur : override
 *  de scène `weapon:'X'`, fixtures de test), JAMAIS au runtime moteur (qui reste sur `findTrappingById`,
 *  seule la couture label→id à l'authoring/chargement est tolérée, cf. CLAUDE.md règle stricte 7). */
export function findTrappingByLabel(label: string): TrappingData | undefined {
  return possessionParLabelNormalise(norm(label));
}
/** Résout une Qualité par son `id` STABLE. */
export function findQualityById(id: string): QualityData | undefined {
  return qualiteParId(id);
}
const qualiteParLabelMinuscule = indexParChamp('qualities', qualities, (q) => q.label.toLowerCase());
const qualiteParSlugDeLabel = indexParChamp('qualities', qualities, (q) => slugId(q.label));
/** `id` STABLE d'une Qualité depuis un LIBELLÉ saisi à l'AUTHORING (« Solide », « solide »,
 *  « tir-de-zone ») — casse ignorée puis slug du libellé, `undefined` si hors catalogue. La couture
 *  label→id vit ICI, au chargement de la donnée, JAMAIS dans `src/engine`/`src/state`
 *  (CLAUDE.md § Pour TOUT agent) : le moteur ne reçoit qu'un id, résolu par `findQualityById`. */
export const qualityIdByLabel = (label: string): string | undefined => {
  const q = qualiteParLabelMinuscule(label.toLowerCase()) ?? qualiteParSlugDeLabel(slugId(label));
  if (!q) return undefined;
  // Doublon de LIBELLÉ imprimé du catalogue (« Immobilisante », `qualities.json:230` et `:271`) :
  // l'authoring par libellé atteint l'entrée CANONIQUE — celle dont l'`id` EST le slug du libellé ;
  // l'homonyme ne s'authore que par son `id` (`immobilisante-fixe`, `state/zi-filets.test.ts`).
  const canonique = slugId(q.label);
  return qualiteParId(canonique) ? canonique : q.id;
};
const sortParId = indexParId('spells', spells);
/** Résout un Sort par son `id` STABLE, sous la forme EFFECTIVE des règles optionnelles actives
 *  (`effectiveEntry`, `src/engine/variants.ts`) — POINT UNIQUE de lecture d'un sort par id : moteur,
 *  store et UI passent tous par ici, aucun ne relit `spells.json` par lui-même. Une variante réglée
 *  (VDM, `magic-vdm-incantation`) y republie ses champs de `VARIANT_RESOLVED_FIELDS`
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
export function godLabel(id: string): string {
  return findGodById(id)?.label ?? id;
}
/** Ids des cultes À BÉNÉDICTIONS, triés — DÉRIVÉ de la donnée (choix de culte du joker
 *  « Béni (Au choix) » à la création/avancement). Les fiches de SAVEUR (dieux nains/elfes/halflings,
 *  provinciaux, Puissances de la Ruine) n'accordent ni Bénédictions ni Miracles (LDB 37 l.17,
 *  LDB 36 l.9) → exclues de tout choix de Prière. */
export const cultIds = memoParVersion('gods', (): string[] => gods.filter((g) => g.blessings.length > 0).map((g) => g.id).sort());
/** Les six Bénédictions d'un culte, IDS de sort (le runtime/grimoire compare par id ; l'UI résout en
 *  libellé). Culte inconnu → []. */
export function blessingsOf(cult: string): string[] {
  return (findGodById(cult)?.blessings ?? []).map((r) => r.id);
}
/** Les Miracles d'un culte, IDS de sort. Culte inconnu → []. */
export function miraclesOf(cult: string): string[] {
  return (findGodById(cult)?.miracles ?? []).map((r) => r.id);
}
/** Les Sorts du Chaos accordés par un Dieu Sombre, IDS de sort (le grimoire compare par id). Dieu inconnu → []. */
export function chaosSpellsOf(god: string): string[] {
  return (findGodById(god)?.chaosSpells ?? []).map((r) => r.id);
}

/** Référence à une Qualité d'objet (`Ref` + Indice éventuel : « Solide 3 » → value 3). */
export interface QualityRef extends Ref {
  value?: number;
}
/** Quantité d'une possession conférée : nombre fixe (« (3) ») ou jet de dés structuré (« (1d10) »). */
export type CountSpec = { fixed: number } | { roll: DiceSpec };
/** Référence à une Possession : par `id` du catalogue (+ quantité éventuelle), texte NARRATIF hors
 *  catalogue (statblocs de créature : « collection d'alcool sans pareille »), dotation VÉHICULE
 *  (`vehicles.json`) — grant de POSSESSION (matérialisé en T1, jamais un objet de sac en T0), résolue
 *  DIRECTEMENT par `findVehicleById`, jamais par le foyer trappings — OU dotation BÊTE (`creatures.json`,
 *  SOCLE POSSESSIONS #615/#617 §9), résolue DIRECTEMENT par `findCreatureById` — OU choix « A ou B »
 *  (`choice`, RÉCURSIF, EN MIROIR d'`AdvancementRef`) — OU joker « n'importe quel <catégorie> »
 *  (`wildcard`, ex. `{wildcard:'arme'}`). `choice`/`wildcard` sont des EMPLACEMENTS non résolus,
 *  résolus par `resolveTrappingChoices` (`src/engine/trappingChoices.ts`) avant matérialisation.
 *  Une ref `{id}` peut aussi porter des Atouts d'objet ATTACHÉS (`qualities`, ex. Fabrication LDB
 *  ch.60 « Solide »/« Raffiné »/« Léger »/« Pratique ») ou un EMPLACEMENT « Atout au choix »
 *  (`qualityChoice: true`, « X de qualité ») — résolu par `resolveTrappingChoices` en `qualities`
 *  (#657 Lot 1, moteur fondation — matérialisé par `buildInventory`, `src/engine/items.ts`). */
export type TrappingRef =
  | (Ref & { count?: CountSpec; qualities?: QualityRef[]; qualityChoice?: true })
  | { text: string; count?: CountSpec }
  | { vehicleId: string; count?: CountSpec; label?: string }
  | { creatureId: string; count?: CountSpec; label?: string }
  | { choice: TrappingRef[] }
  | { wildcard: string };
/** EMPLACEMENT d'avancement (espèce/carrière) : un espace de CHOIX, pas une instance résolue — la
 *  composition de la grammaire (`schemas/grammaire/avancement.ts`). Référence à spécialisation
 *  FACULTATIVE (`{id}`, `{id, spec}`, `{id, choix: true}` « Au choix », `{id, choix: [ids]}` choix
 *  borné « Fléau ou À deux mains »), « n parmi » (`{pick, of}` — le « A ou B » des listes), ou
 *  tirage (`{random: n}`, « N Talent aléatoire »). */
export type AdvancementRef =
  | (Ref & { choix?: true | string[] })
  | { pick: number; of: AdvancementRef[] }
  | { random: number };

/** Résout une entrée de dataset par (catégorie, `id`) — rendu/lookup des refs structurées. */
export function findById(category: string, id: string): { label: string } | undefined {
  switch (category) {
    case 'skills': return byId('skill', id);
    case 'talents': return findTalentById(id);
    case 'trappings': return findTrappingById(id);
    case 'weaponGroups': return findWeaponGroupById(id);
    case 'qualitySubtypes': return findQualitySubtypeById(id);
    case 'breathTypes': return findBreathTypeById(id);
    case 'damageTypes': return findDamageTypeById(id);
    case 'qualityTypes': return findQualityTypeById(id);
    case 'groups': return findGroupById(id);
    case 'domains': return findDomainById(id);
    case 'qualities': return findQualityById(id);
    case 'spells': return findSpellById(id);
    case 'maneuvers': return findManeuverById(id);
    case 'careers': return findCareerById(id);
    case 'classes': return findClassById(id);
    case 'races': return findSpeciesById(id);
    case 'etats': return findConditionById(id);
    case 'psychologies': return findPsychologyById(id); // clé de CATÉGORIE Codex (cf. `CATEGORY_BY_SOURCE_KIND`)
    case 'traits': return findTraitById(id);
    case 'mutations': return findMutationById(id); // clé de CATÉGORIE Codex (compendium/registry, relations)
    case 'symptoms': return findSymptomById(id);
    case 'maladies': return findDiseaseById(id) ? { label: findDiseaseById(id)!.label } : undefined;
    case 'shipStations': return findShipStation(id);
    case 'crewRoles': return findCrewRoleById(id);
    case 'navalTraits': return findNavalTrait(id);
    default: return undefined;
  }
}
/** CATALOGUE des sources de spéc partagées (SSOT) : `pool()` = ids DÉRIVÉS du registre (énumérés par
 *  `wildcardSpecs`, fin des `specs[]` maintenues à la main), `label(id)` = leur rendu FR. Chaque
 *  `SpecsSource` a exactement UNE entrée — ajouter une source = l'ajouter ICI, jamais un `if` par-source. */
/** UNE source de spéc : `pool()` = ids CHOISISSABLES par un joueur (registre FILTRÉ — 8 Vents+Dhar, Groupes
 *  de mêlée…) ; `label()` = affichage d'un id ; `resolves()` = l'id existe-t-il dans le REGISTRE sous-jacent
 *  (que `label` interroge). VALIDITÉ (resolves) ⊇ POOL : un statbloc de créature RAW peut porter une spéc HORS
 *  du pool joueur mais RÉELLE — ex. le Triton FOCALISE « Magie des mers de Triton » (un domaine, hors des Vents
 *  canalisables par un PC). Le pool borne le CHOIX joueur ; resolves borne la VALIDITÉ des données. */
export const SPEC_SOURCES: Record<SpecsSource, { pool(): string[]; label(id: string): string; resolves(id: string): boolean }> = {
  weaponGroupsMelee:  { pool: () => weaponGroups.filter((g) => g.combat === 'melee').map((g) => g.id),  label: (id) => weaponGroupLabel(id), resolves: (id) => !!findWeaponGroupById(id) },
  weaponGroupsRanged: { pool: () => weaponGroups.filter((g) => g.combat === 'ranged').map((g) => g.id), label: (id) => weaponGroupLabel(id), resolves: (id) => !!findWeaponGroupById(id) },
  winds:         { pool: () => domains.filter((d) => d.wind).map((d) => d.id),   label: (id) => findDomainById(id)?.wind ?? findDomainById(id)?.label ?? id, resolves: (id) => !!findDomainById(id) },
  arcaneDomains: { pool: () => domains.filter((d) => d.arcane).map((d) => d.id), label: (id) => findDomainById(id)?.label ?? id, resolves: (id) => !!findDomainById(id) },
  cultBlessings: { pool: () => gods.filter((g) => g.blessings.length).map((g) => g.id).sort(),  label: (id) => godLabel(id), resolves: (id) => !!findGodById(id) },
  cultMiracles:  { pool: () => gods.filter((g) => g.miracles.length).map((g) => g.id).sort(),   label: (id) => godLabel(id), resolves: (id) => !!findGodById(id) },
  cultChaos:     { pool: () => gods.filter((g) => (g.chaosSpells?.length ?? 0) > 0).map((g) => g.id).sort(), label: (id) => godLabel(id), resolves: (id) => !!findGodById(id) },
  seaShanties:   { pool: () => seaShanties.map((s) => s.id), label: (id) => findSeaShantyById(id)?.label ?? id, resolves: (id) => !!findSeaShantyById(id) },
  groups:        { pool: () => groups.map((g) => g.id),       label: (id) => groupLabel(id),       resolves: (id) => !!findGroupById(id) },
  diseases:      { pool: () => maladies.map((m) => m.id),     label: (id) => diseaseLabel(id),     resolves: (id) => !!findDiseaseById(id) },
  sizes:         { pool: () => Object.keys(SIZE_LABEL),       label: (id) => (SIZE_LABEL as Record<string, string>)[id] ?? id, resolves: (id) => id in SIZE_LABEL },
  mutations:     { pool: () => mutations.map((m) => m.id),    label: (id) => mutationLabel(id),    resolves: (id) => !!findMutationById(id) },
  breathTypes:   { pool: () => breathTypes.map((b) => b.id),  label: (id) => breathTypeLabel(id),  resolves: (id) => !!findBreathTypeById(id) },
  damageTypes:   { pool: () => damageTypes.map((t) => t.id),  label: (id) => damageTypeLabel(id),  resolves: (id) => !!findDamageTypeById(id) },
  weaponsMelee:  { pool: () => trappings.filter((t) => t.categorie === 'melee').map((t) => t.id),  label: (id) => findTrappingById(id)?.label ?? id, resolves: (id) => findTrappingById(id)?.categorie === 'melee' },
  weaponsRanged: { pool: () => trappings.filter((t) => t.categorie === 'ranged').map((t) => t.id), label: (id) => findTrappingById(id)?.label ?? id, resolves: (id) => findTrappingById(id)?.categorie === 'ranged' },
};
/** POOL d'une def (Compétence/Talent) — ce qu'un choix joueur PROPOSE d'office (`LDB 09 l.40`) :
 *  pool DÉRIVÉ du registre partagé si `specsSource` (SSOT `SPEC_SOURCES`), sinon les entrées `specs[]`
 *  inline SANS `pool: false`. Consommé par `wildcardSpecs` (créateur, avancement, Entraînement).
 *  Ne JAMAIS l'utiliser pour juger de la VALIDITÉ d'une spec (cf. `specResolves`). */
export function specPoolOf(def: { specsSource?: SpecsSource; specs?: SpecEntry[] }): string[] {
  return def.specsSource
    ? SPEC_SOURCES[def.specsSource].pool()
    : (def.specs ?? []).filter((e) => e.pool !== false).map(specEntryId);
}
/** CATALOGUE ÉNUMÉRABLE d'une def : toutes les entrées `specs[]` (y compris `pool: false`), sinon le
 *  pool du registre partagé. C'est la liste qu'un écran de RÉFÉRENCE imprime (Codex/éditeur) et la
 *  base des round-trips libellé→id. `specsSource` résout AU-DELÀ de cet énumérable (registre entier,
 *  cf. `specResolves`) : ce qui est énumérable ⊆ ce qui est valide. */
export function specCatalogOf(def: { specsSource?: SpecsSource; specs?: SpecEntry[] }): string[] {
  return def.specsSource ? SPEC_SOURCES[def.specsSource].pool() : (def.specs ?? []).map(specEntryId);
}
/** VALIDITÉ d'une spéc pour une def : l'id existe au catalogue inline (pool ou non) OU dans le REGISTRE
 *  d'une `specsSource` (⊇ son pool joueur — un statbloc RAW porte une spéc réelle non choisissable).
 *  Porte de la RÉSOLUTION (`resolveSpecId`, `testValue` par id, bonus de règle) et des gardes. */
export function specResolves(def: { specsSource?: SpecsSource; specs?: SpecEntry[] }, specId: string): boolean {
  return def.specsSource
    ? SPEC_SOURCES[def.specsSource].resolves(specId)
    : (def.specs ?? []).some((e) => specEntryId(e) === specId);
}
/** Libellé d'affichage d'une spéc (`Ref.spec`) : si la def désigne une `specsSource`, résout via le
 *  catalogue `SPEC_SOURCES` (registre partagé d'ids : Groupe d'arme → libellé, Vent, Lore, dieu, chanson) ;
 *  sinon cherche l'id dans `def.specs` (`SpecEntry[]`, résolu en label FR) ; sinon verbatim (texte
 *  libre / id inconnu — jamais d'erreur d'affichage). SOURCE UNIQUE de résolution de spéc. */
export function specLabel(category: string, refId: string, specId: string): string {
  const def = category === 'skills' ? byId('skill', refId) : category === 'talents' ? findTalentById(refId) : undefined;
  if (def?.specsSource) return SPEC_SOURCES[def.specsSource].label(specId);
  const entry = def?.specs?.find((s) => specEntryId(s) === specId);
  return entry ? specEntryLabel(entry) : specId;
}
/**
 * MINTEUR (b) de `PlayerText` (#1318 V8a₁) — le PASSAGE des textes AUTHORÉS (le `label` d'une entité
 * de catalogue, le `title` d'une entrée de table, le `prompt` d'un nœud de Flow, l'intitulé d'un péril
 * de scène) vers l'affichage. Ces textes ne sont PAS traduisibles par clé : ils vivent dans la donnée,
 * et une 2ᵉ langue les surcharge par fichier `id → label` (plan évacué → #320, Phase E).
 *
 * CE QU'IL N'EST PAS : le fossile `rawText` sous un autre nom — d'autant moins négociable que ce fossile
 * est MORT (#1318 E7-FINAL). Il gelait un LITTÉRAL FR écrit au call-site ; ici l'argument est TOUJOURS lu
 * dans la donnée. Le cliquet nominatif `state/player-text-ratchet.test.ts` tient cette différence à ZÉRO,
 * sans gel : un littéral FR passé à `dataLabel(` rougit la CI — la garde, pas le nom, ferme le retour.
 *
 * `repli` : la dégradation quand la donnée ne porte pas de texte — un ID, ou un libellé DÉJÀ dérivé du
 * catalogue (`refLabel`, `CHAR_LABELS`). Jamais un littéral FR : même cliquet.
 */
export function dataLabel(texte: string | undefined | null, repli?: string): PlayerText {
  // eslint-disable-next-line no-restricted-syntax -- #1318 V8a₁ : l'unique cast de ce minteur (b) — forger la marque EST son corps de métier (cf. JSDoc), et le cliquet `state/player-text-ratchet.test.ts` refuse qu'un littéral FR y entre.
  return (texte ?? repli ?? '') as PlayerText;
}

/**
 * CLÉ RUNTIME concrète d'une `Ref` : « Magie des Arcanes (Ghur) » — base (repli sur l'id) + spec.
 * SOURCE UNIQUE de l'index utilisé par les registres (`opts.skillAdvances` dans `engine/character.ts`,
 * `combatFeatures`, grimoire).
 *
 * NON-MINTEUR, et c'est tout le point (#1318 V8a₁, grief T3) : un texte qui sert de CLÉ n'est pas du
 * texte joueur. Tant que les deux usages partageaient une seule fonction, traduire la donnée aurait
 * cassé des lookups silencieusement. `refLabel` ci-dessous en est la face AFFICHAGE, et la seule à
 * minter.
 */
export function refConcrete(category: string, ref: Ref): string {
  const base = findById(category, ref.id)?.label ?? ref.id;
  return ref.spec ? `${base} (${specLabel(category, ref.id, ref.spec)})` : base;
}

/** Libellé CONCRET d'une `Ref` pour l'AFFICHAGE : « Magie des Arcanes (Ghur) ». Face minteuse de
 *  `refConcrete` (cf. son JSDoc pour la scission). Un site qui INDEXE avec ce texte appelle `refConcrete`. */
export function refLabel(category: string, ref: Ref): PlayerText {
  return dataLabel(refConcrete(category, ref));
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
export function qualityRefLabel(q: QualityRef): string {
  const base = refLabel('qualities', q);
  if (q.value == null) return base;
  const unite = qualiteParId(q.id)?.indice?.unite;
  return unite ? `${base} (${q.value}${unite})` : `${base} ${q.value}`;
}
/** Libellé d'affichage / CLÉ d'une `SkillInstance` (id+spec → « Langue (Magick) »). Repli sur l'id.
 *  Passe par `refConcrete` : ce texte indexe aussi (avancements, fiche). */
export function skillInstanceLabel(s: { id: string; spec?: string }): string {
  return refConcrete('skills', { id: s.id, spec: s.spec });
}
/** Libellé CONCRET d'une `TalentInstance` (id+spec → « Magie des Arcanes (Bête) ») — clé du registre
 *  combatFeatures + affichage. Repli sur l'id. CLÉ d'abord, donc `refConcrete`. */
export function talentConcrete(t: { talentId: string; spec?: string }): string {
  return refConcrete('talents', { id: t.talentId, spec: t.spec });
}
/**
 * Libellé d'un EMPLACEMENT de spécialisation NON DÉSIGNÉ : « Savoir (Au choix) » pour un choix
 * LIBRE, « Métier (Armurier ou Forgeron) » pour un choix BORNÉ (options résolues en LIBELLÉS par
 * `specLabel`, jamais des ids bruts). SOURCE UNIQUE du rendu d'un `choix` — la réf de statbloc
 * (`skillRefLabel`) comme l'emplacement d'avancement (`advancementLabel`) passent ici.
 * Repasse par `refConcrete` : ce texte INDEXE aussi (`opts.skillAdvances`, `specChoices`).
 * `LDB 09 l.40` ; choix imprimé sur une ligne de table : `frenchy.bzh 83 l.25`.
 */
export function choixLabel(category: string, id: string, choix: true | string[]): string {
  const base = refConcrete(category, { id });
  return Array.isArray(choix) && choix.length
    ? `${base} (${choix.map((o) => specLabel(category, id, o)).join(' ou ')})`
    : t('ref.auChoix', { base });
}
/** Libellé d'affichage/clé concrète d'un `AdvancementRef` : « Savoir (Au choix) », « A ou B »,
 *  « 3 Talents aléatoires », « Magie des Arcanes (Bête) ». SOURCE UNIQUE (Codex + résolution création).
 *  Passe par `refConcrete` : ce texte INDEXE `opts.skillAdvances` (`engine/character.ts`). */
export function advancementLabel(category: string, a: AdvancementRef): string {
  if ('id' in a) return a.choix == null ? refConcrete(category, a) : choixLabel(category, a.id, a.choix);
  if ('pick' in a) {
    const options = a.of.map((x) => advancementLabel(category, x));
    return a.pick > 1 ? `${a.pick} parmi : ${options.join(', ')}` : options.join(' ou ');
  }
  return a.random === 1 ? 'Talent aléatoire' : `${a.random} Talents aléatoires`;
}
/** id de base d'un `AdvancementRef` SIMPLE (référence, avec ou sans régime de spécialisation) — pour
 *  matcher par id une compétence/un talent POSSÉDÉ (ex. compétence de revenus). undefined pour un
 *  `{pick}`/`{random}` (pas un id unique). */
export function advancementBaseId(a: AdvancementRef): string | undefined {
  return 'id' in a ? a.id : undefined;
}
/** Libellé d'affichage d'une `TrappingRef` : « Marteau », « Pamphlétaire (3) », « Chiffon (1d10) »,
 *  « Outils professionnels (Maréchal-ferrant) » (`spec`, rendue par `refConcrete` comme toute autre
 *  `Ref` — `LDB 08 l.1130`), texte narratif hors catalogue, choix « A ou B » (récursif), ou joker
 *  « Arme (au choix) ». SOURCE UNIQUE (Codex, créateur, marchand, inventaire). */
export function trappingRefLabel(ref: TrappingRef): string {
  if ('choice' in ref) return ref.choice.map(trappingRefLabel).join(' ou ');
  if ('wildcard' in ref) return ref.wildcard === 'arme' ? 'Arme (au choix)' : `${ref.wildcard} (au choix)`;
  const base = 'text' in ref
    ? ref.text
    : 'vehicleId' in ref
      ? (findVehicleById(ref.vehicleId)?.label ?? ref.vehicleId)
      : 'creatureId' in ref
        ? (findCreatureById(ref.creatureId)?.label ?? ref.creatureId)
        : refConcrete('trappings', ref);
  const count = ref.count ? ('fixed' in ref.count ? ` (${ref.count.fixed})` : ` (${formatDice(ref.count.roll)})`) : '';
  const quality = 'id' in ref && ref.qualityChoice
    ? ' (qualité au choix)'
    : 'id' in ref && ref.qualities?.length
      ? ` (${ref.qualities.map(qualityRefLabel).join(', ')})`
      : '';
  return base + count + quality;
}
