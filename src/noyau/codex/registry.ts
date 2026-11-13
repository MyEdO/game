/**
 * Registre du Codex — SOURCE UNIQUE des catégories consultables en jeu.
 *
 * Chaque catégorie projette un tableau de `src/data` (façade `index.ts`) en `CodexItem` RICHE :
 * faits-clés + **sections structurées** dont les entités citées (compétences, talents, sorts,
 * traits, qualités…) sont des **liens `CodexRef`** vers leur propre fiche (cross-références).
 * **Ajouter une catégorie = sa clé déclarée au def (`exposition.codex.keys`, ou sa clé de
 * `edit.niche.categories` pour une table nichée, que `document()` pose en `codex.keys`), puis son
 * entrée dans `CODEX_SPECS`**, que `satisfies Record<CleCodex, …>` exige ; enrichir = ajouter des
 * sections (data), pas un composant.
 */
import { composeRollLabel } from '../rollSeam';
import { memoParVersion } from '../../data/versionDataset';
import { CLES_DE_DATASET, type CleCodex } from '../../data/schemas/_cles-de-dataset.generated';
import {
  species, careers, characteristics, classes, skills, talents,
  qualities, trappings, siegeEngines, weaponGroups, etats, maladies, creatures, traits, spells, maneuvers, domains, mutations, mutationTables, gods,
  stars, locations, findLocationById, findCreatureById, books, bookAbr, careerLevels, raceAppearance, levelsForCareer, skillRefLabel, talentRefLabel, refLabel, trappingRefLabel, estMention, mentionsParNature, qualityRefLabel, advancementLabel, weaponGroupLabel, qualitySubtypeLabel, qualityTypeLabel,
  skillInstanceLabel, careersForSpecies, findCareerById, careerLabelFor, entryKey, libelleDeClasse, findSpeciesById, eyes, hairs, tableDesYeux, tableDesCheveux, eyesDie, hairsDie, details, semencesDeScene, defautsDeCompilation, names,
  pregens, oups, interludeEvents, peripeties, talentsAleatoires, carrieresAleatoires, especesAleatoires, cargaisonsAleatoires, porteurDuDeDeCarrieres, psychologyLabel,
  allAxes,
  calendarMonths, calendarIntercalary, calendarWeekdays, calendarPhases, weather, weatherConditions, symptoms, symptomLabel,
  isNamed, specCatalogOf, specLabel, seasonLabel,
  SYMPTOM_SEVERITIES,
  vehicles, celestialHouses, groups, groupLabel, psychologies, seaShanties, crewRoles, crewTestTypes, shipStations, NAVAL_TRAITS, findVehicleById, structures, regles, cibleCodex,
  charAbr, navalPorts, shipConstruction, effectTables, disponibilite, massBattleHazardsDie,
  conditionLabel, traitProjectingManeuver, materials, terrains, props, buildings, libelleOuAbsence, tailleDuProfil, testSkillLabel,
} from '../../data';
// #157 (audit d'exposition Codex) : catalogues app-owned chargés par un module dédié plutôt que la
// façade `index.ts` — réutilisés TELS QUELS (même patron que `POWER_ESTIMATE` etc. ci-dessous, déjà
// importés directement d'`engine/massBattle`).
import type { FoyerDeRegle, RaceKey, SourceRef } from '../../data/schemas/grammaire/valeurs';
import { availabilitySchema, harvestDangerSchema, harvestRaritySchema, symptomSeveritySchema } from '../../data/schemas/grammaire/valeurs';
import { buildingAnchorSchema } from '../../data/schemas/defs/buildings';
import { reliefDefaultsSchema } from '../../data/schemas/defs-scenes/scene';
import type { EnveloppeDocument } from '../../data/schemas/grammaire/document';
import { libelleDeValeur } from '../../data/schemas/grammaire/meta';
import { shipSizeSchema } from '../../data/schemas/grammaire/valeurs';
import { outcomeOnSchema, battleCondSchema, battleOutcomeTargetSchema, battleOutcomeScaleSchema } from '../../data/schemas/defs/activities';
import { equipeSchema } from '../../data/schemas/grammaire/valeurs';
import { phenomenonKindSchema, phenomenonTestSchema, saturationTierSchema } from '../../data/schemas/defs/arcane-phenomena';
import { drivingMishapOutcomeSchema } from '../../data/schemas/defs/driving-mishap';
import { drunkennessOutcomeSchema } from '../../data/schemas/defs/drunkenness';
import { progressionModeSchema } from '../../data/schemas/defs/naval-progression';
import { waterTableSchema } from '../../data/schemas/defs/water-exposure';
import { issueDuTestSchema } from '../../data/schemas/defs/sea-cargo';
import { attackKindSchema } from '../../data/schemas/grammaire/valeurs';
import { trappingCategorieSchema } from '../../data/schemas/defs/trappings';
import { carriereActuelle } from '../../engine/pnjDeCarriere';
import { garanti } from '../../lib/garanti';
import { MOUNT_PROFILES } from '../../engine/mountTravel';
import { windsOfMagicTable } from '../../engine/windsOfMagic';
import { miscastDie } from '../../engine/miscast';
import { MOUNT_INCIDENTS, VEHICLE_PROBLEMS, mountIncidentDie, vehicleProblemDie, encounterDie } from '../../engine/travelTables';
import type { TravelTableEntry } from '../../engine/travelTables';
import { TAVERN_GAMES } from '../../engine/tavernGame';
import { OBSESSIONS, obsessionsDie } from '../../data/obsessions';
import { tableDesCritiquesDeStructure } from '../../engine/structureCritical';
import { bandeAuDe, deDeLaTableTiree, facesDuDe, fourchette, type DeDeTable, type PorteurDeDe } from '../../engine/tables';
import { ARTILLERY_MISFIRE, artilleryMisfireDie } from '../../data/artilleryMisfire';
import { structureCriticalsDie } from '../../data/structureCriticals';
import { deDeTirageDe } from '../../data/rangees';
import drivingMishapJson from '../../data/driving-mishap.json';
import drunkennessJson from '../../data/drunkenness.json';
import ventsJson from '../../data/vents-tourbillonnants.json';
import type * as accidents from '../../data/schemas/defs/driving-mishap';
import type * as ivresse from '../../data/schemas/defs/drunkenness';
import type * as vents from '../../data/schemas/defs/vents-tourbillonnants';
import { deDesEvenementsDeBord, deDuVoyageRapide } from '../../engine/seaVoyage';
import { findCargoEntryById, isEchangeable } from '../../engine/cargo';
import type { SeaEventDef, ManannFactor } from '../../engine/seaVoyage';
import { RIVER_PERILS } from '../../engine/riverNavigation';
import { MORALE_FACTORS, MORALE_BANDS } from '../../engine/crewMorale';
import { STEAM_BREAKDOWNS, steamBreakdownDie } from '../../engine/shipBuild';
import { oupsDie } from '../../data/oups';
import { interludeEventDie } from '../../data/interludeEvents';
import { peripetieDie } from '../../data/peripeties';
import { traumaLabelOf } from '../../engine/trauma';
import { spellOps, type Flow, type FlowTestNode } from '../../engine/flowCore';
import { estCausePersistante, type GameOp } from '../../engine/ops';
import { noeudAmputation } from '../../engine/critical';
import { CRIT_TABLE_LOCATION, critiqueDie, type CritTableKey, type JeuDeCritique } from '../../data/criticals';
import { SHIP_CRIT_SET, RIVER_CRIT_SET, type CrewTarget, type ShipCritEntry, type ShipCritSet } from '../../data/shipCriticals';
import { datasetArray, datasetObject } from '../../data/overrides';
import type { CritTableEntry, MiscastRowEntry } from '../../data/overrides';
import type { RuleValue } from '../../engine/policy';
import SURINCANTATION from '../../data/surincantation.json';
import type { SaturationLevel, WindSaturationEffects, ArcanePhenomenon, ArcaneTable, PhenomenonTestMod, PhenomenonScope } from '../../data/arcanePhenomena';
import type { CastingNumberMod, CastingNumberScope } from '../../engine/castingNumber';
import { effectiveEntry } from '../../engine/variants';
import { isOptionalNote, type TraitList } from '../../engine/statEntry';
import type { TraitPose } from '../../data/schemas/grammaire/reference';
import type { NomDIndividu } from '../../engine/psych/ciblage';
import { damageString } from '../../engine/items';
import { rangeSpecLabel, ammoRangeModLabel, conditionalDamageNote } from '../../engine/weaponStats';
import { formatSpellRange, formatSpellTarget, formatSpellDuration } from '../../engine/spellRangeFormat';
import { talentMaxLabel } from '../../engine/careerSlots';
import type { AdvancementRef, TrappingRef, WaterExposureModifier, SpellData } from '../../data';
import { POWER_ESTIMATE, MIGHT_MODIFIERS, WAR_MACHINES, STRUCTURES as MASS_BATTLE_STRUCTURES, BATTLE_HAZARDS } from '../../engine/massBattle';
import { AVAILABILITIES } from '../../engine/types';
import { ACTIVITIES, testsDeLActivite } from '../../engine/activities';
import type { OutcomeBand } from '../../engine/activities';
import { traitArgSkeleton, traitLisible } from '../../engine/traits/dispatch';
import { resolveQualities } from '../../engine/qualities/dispatch';
import { CHAR_KEYS, CHAR_LABELS, HIT_LOCATION_LABELS, DIFFICULTY_LABELS, LOCALISATIONS_DE_COUP, type Combatant, type CharKey, type HitLocation } from '../../engine/types';
import type { ResolveurDePreset } from '../monde/resolveursDuNarratif';
import type { Porteur, PorteurDeRangee } from './porteur';
import { SIZE_LABEL, SIZE_ORDER, effectiveSize, woundsForSize, type SizeCategory } from '../../engine/size';
import { bonus, effectiveChar } from '../../engine/characteristics';
import { BASE_HUMAINE, baseDEspece } from '../../engine/character';
import { skillBaseValue } from '../../engine/skills';
import { formatDice, formatEffetSigne, totalDuDe, type DiceSpec } from '../../engine/dice';
import { formatDiseaseTime } from '../../engine/disease';
import { costPerEnc } from '../../engine/harvest';
import { formatMoney, priceToMoney, type Money } from '../../engine/money';
import { passiveSection, effectsSection, careerGrantSection, spellFlowSection } from './describe';
import { opRows, tableRows } from './opRows';
import { humanizeCastBonus, causePersistante, replieCausesPersistantes, effetDeContrecoup } from './humanize';
import { reverseGroups, bookContents } from './relations';
import { formatManeuverMeasure } from './maneuverMeasure';
import { metaPourFichier, chargeDiscriminee, noeudDuChamp } from '../../data/schemas/validate';
import { libelleDuChamp } from './editFields';
// Ordre des arrêts d'une rampe de terrain : SOURCE UNIQUE partagée avec les émetteurs SVG — la fiche
// Codex lit la rampe dans l'ordre où le rendu la peint, jamais dans l'ordre des clés du Record.
import { terrainStopsOrdonnes } from '../monde/terrain';
import { slugId } from '../../data/slug';
import { t as tr, type MsgKey } from '../../i18n'; // alias : `t` est un identifiant local très fréquent ici (traits, talents, tables)
import type { EtatDeclare } from '../../data/schemas/defs-scenes/formes-d-etat';

/** Les états de campagne du Codex : aucun. Le Codex ne projette que `src/data`, jamais une couche de
 *  campagne (#767) — ses conditions `etat` se disent par leur id. */
const ETATS_DU_CODEX: readonly EtatDeclare[] = [];

/** Familles du Codex (onglets du haut) : id STABLE → clé de catalogue de son libellé, dans l'ordre
 *  d'affichage. Toute logique est keyée par l'id ; le libellé passe par `codexGroupLabel`. */
const LIBELLE_DE_FAMILLE = {
  personnage: 'codex.famille.personnage',
  competences: 'codex.famille.competences',
  equipement: 'codex.famille.equipement',
  effets: 'codex.famille.effets',
  magie: 'codex.famille.magie',
  monde: 'codex.famille.monde',
  tables: 'codex.famille.tables',
} as const satisfies Record<string, MsgKey>;

export type CodexGroup = keyof typeof LIBELLE_DE_FAMILLE;

/** Ordre d'affichage des familles (onglets du haut). */
export const CODEX_GROUPS = Object.keys(LIBELLE_DE_FAMILLE) as CodexGroup[];

/** Libellé d'affichage d'une famille, résolu au catalogue à la lecture. */
export const codexGroupLabel = (group: CodexGroup): string => tr(LIBELLE_DE_FAMILLE[group]);

/** Vue de projection Codex de `SourceRef` (`src/data/schemas/grammaire/valeurs.ts` — SEULE forme à importer,
 *  #563 dette soldée) : `book` y est déjà résolu en ABRÉVIATION affichable (`bookAbr`, cf. `src()`
 *  ci-dessous), jamais l'id stable — projection d'AFFICHAGE, pas la donnée. */
export type CodexSource = Pick<SourceRef, 'page'> & { book: string };
export interface CodexFact {
  label: string;
  value: string;
  /** Lien Codex du LIBELLÉ (facultatif) — même forme que `CodexRow['kv'].kref` : la bande statbloc
   *  (profil M+carac+B) devient cliquable quand le fait référence une entité du Codex. */
  kref?: { category: string; id: string; label: string };
}
/** Une ligne d'une section. */
export type CodexRow =
  /** Prose en rangée. `porteur` (cf. `PorteurDeRangee`) = le champ d'où sort `text`, VERBATIM
   *  (notation `scripts/source/adresses.mjs`) — `CodexRowView` le complète et le passe à `<Prose>`.
   *  ABSENT = texte SYNTHÉTISÉ ou DÉCORÉ : aucune mention n'y est liée (#1392 Lot E). */
  | { t: 'text'; text: string; porteur?: PorteurDeRangee }
  | { t: 'kv'; k: string; v: string; kref?: { category: string; id: string; label: string } }
  /** Lien vers une autre fiche. `id` = identité STABLE de la cible (navigation) ; `label` reste la clé
   *  de résolution (base, affichage/repli) ; `show` = libellé affiché, qui PORTE les Indices
   *  (« 8 Tentacules +8 ») et est transmis au Codex/popover comme instance.
   *  `badge` = annotation de fin NON cliquable (rang « N2 », « facultatif », « Bénédiction »…). */
  | { t: 'ref'; category: string; id: string; label: string; show: string; badge?: string }
  /** Pastille NUE : un libellé qui ne désigne AUCUNE entité du Codex (nom d'objet authoré en clair,
   *  libellé composite « A ou B »/« au choix »). Même boîte qu'un `t:'ref'` — la borne d'objet se
   *  voit — mais ni lien, ni popover, ni auto-liage : ce n'est pas de la prose de règle (#1392 Lot E,
   *  verdict juge vision : une Possession rendue en PARAGRAPHE inversait la hiérarchie de la section
   *  et fondait « Presse à imprimer » et « Chapeau impressionnant » en un seul objet). */
  | { t: 'chip'; label: string; badge?: string }
  /** CHOIX « A ou B » / « n parmi » d'un emplacement d'avancement (`{pick}`), rendu par `EntityChoice` sur
   *  la STRUCTURE : une option référence = un lien cross-réf par son `id`, une option sans id = une pastille. */
  | { t: 'choice'; category: 'skills' | 'talents'; advancement: Extract<AdvancementRef, { pick: number }> }
  /** Mini sous-en-tête à l'intérieur d'une section (« Compétences », « Talents »…). */
  | { t: 'sub'; label: string }
  /** Bloc REPLIABLE (`<details class="fold">`) : `summary` visible, `text` (Markdown) dévoilé au clic.
   *  Porte la forme TECHNIQUE d'atelier (« Détail technique ») sous la phrase humaine — cf. `describe`. */
  | { t: 'fold'; summary: string; text: string }
  /** COULEUR d'une valeur de rendu (teinte d'aperçu, arrêt de rampe) : la pastille PEINTE + le code
   *  `#rrggbb` en texte — le hex reste lisible et copiable, la couleur cesse d'être à deviner.
   *  `v` est la couleur telle que la donnée l'écrit (`#rrggbb`), jamais un nom inventé. */
  | { t: 'couleur'; k: string; v: string }
  /** Note d'atelier NON cliquable, en fin de section (« se tranchent à l'étape 5 ») — jamais un lien,
   *  jamais une règle inventée : un simple repère de parcours (#393 P2, verdict juge vision P1 item 8). */
  | { t: 'nb'; text: string };
export interface CodexSection {
  /** Vide : section sans titre (la Description d'`InspectPanel`, sous l'onglet qui la nomme). */
  title: string;
  layout?: 'list' | 'chips' | 'grid';
  rows: CodexRow[];
}
/** Regroupement EXPLICITE de sections en UN onglet de fiche (ex. « Profil » = carac+compétences+
 *  talents). Quand une catégorie le fournit, l'onglet groupe ses sections ; sinon = un onglet/section. */
export interface CodexTab {
  title: string;
  sections: CodexSection[];
}
/** Entrée normalisée, rendue uniformément par `CodexEntry`. */
export interface CodexItem {
  /** Identité STABLE (id de l'entité source ; slug dérivé du libellé pour les datasets sans id
   *  propre — cf. `CODEX_SPECS`) — la clé de navigation/comparaison ; `label` reste l'AFFICHAGE. */
  id: string;
  label: string;
  sub?: string;
  /** Groupe pour la liste hiérarchique (famille de race, classe de carrière, dossier de créature…). */
  group?: string;
  meta?: CodexFact[];
  /** Sections riches (statbloc, niveaux de carrière, bénédictions…) avec liens cross-réf. */
  sections?: CodexSection[];
  /** Regroupement EXPLICITE des sections en onglets (sinon : un onglet par section). */
  tabs?: CodexTab[];
  /** Corps prose en **Markdown** (verbatim de la source), rendu par `<Prose>` (auto-liage des règles). */
  desc?: string;
  /** Raison MAISON de l'entrée (clé d'enveloppe `maison`, `grammaire/document.ts`) : en clair,
   *  d'où vient une valeur qu'aucun folio n'imprime. Projetée par `depuisEnveloppe` et rendue UNE fois
   *  par `CodexEntry` — c'est la provenance des documents SANS livre (AGENTS.md règle 7). */
  maison?: string;
  source?: CodexSource | null;
  /** Statbloc COMPACT (bande parchemin en tête de fiche) : profil imprimé (M + 10 caracs + Blessures)
   *  + traits en chips cross-réf. Projection data-driven (catégorie créatures). */
  statblock?: { profile: CodexFact[]; traits: CodexRow[] };
}
/** Facette de filtre d'une catégorie (chips multi-sélection au-dessus de la recherche) : lit UN
 *  champ de l'item ; ses valeurs sont DÉRIVÉES des items au rendu (jamais une liste en dur). */
export interface CodexFacet {
  key: string;
  label: string;
  valueOf: (item: CodexItem) => string | undefined;
}
export interface CodexCategory {
  key: string;
  label: string;
  group: CodexGroup;
  /** Sous-groupe FR (dépliable dans la barre de catégories) — cf. `CodexCategorySpec.cluster`. */
  cluster?: string;
  /** Réf de source de la TABLE entière (« LDB 18 », « MDG 13 ») — affichée discrètement, JAMAIS
   *  dans le libellé joueur (une réf de livre nue n'est pas un nom de catégorie). */
  sourceRef?: string;
  /** Projection PARESSEUSE (getter, `memoParVersion`) : les datasets étant mutés EN PLACE
   *  (`overrides.ts::setDataset`), la re-projection après une écriture au seam lit la donnée FRAÎCHE.
   *  Ne se re-matérialise qu'après une écriture (persist DEV, rare), jamais par rendu. */
  items: CodexItem[];
  /** Facettes de filtre — DÉRIVÉES des items dans la même re-projection (livre partout, groupe là où porté). */
  facets?: CodexFacet[];
  /** La prose de cette catégorie suit la convention d'ÉPIGRAPHE WFRP (`careers`, LDB 2 : citation
   *  `« … »` + attribution) — `<Prose exergues>` les rend en carte-parchemin à leur place. DONNÉE de
   *  catégorie, jamais un test de catégorie au rendu. */
  exergues?: boolean;
}

const src = (s: { book?: string; page?: number } | null | undefined): CodexSource | null =>
  s && s.book ? { book: bookAbr(s.book), page: s.page ?? 0 } : null;

/**
 * DÉFAUT D'ENVELOPPE : l'entrée d'un document (`EnveloppeDocument`) projetée en `CodexItem`.
 * Prend UNE entrée, jamais un dataset — la spec garde son `.map`/`.filter`/tri.
 *
 * `source` passe TOUJOURS par `src()` : `d.source` brut porte l'**id** du livre, et l'imprimer
 * afficherait `livre-de-base` au lieu de l'abréviation `LDB` (cf. `CodexSource` ci-dessus).
 * `desc`, `maison` ET `source` ne sont posées que si la donnée les porte : un champ absent reste ABSENT
 * (ni `undefined`, ni `null`) — la clé même est l'observable, gelée par `registry-enveloppe.test.ts`.
 * `extras` est fusionné APRÈS le défaut — un `label`/`desc` fourni par la spec l'emporte.
 */
export function depuisEnveloppe<E extends Partial<CodexItem>>(
  d: Pick<EnveloppeDocument, 'id' | 'label' | 'desc' | 'source' | 'maison'>,
  extras?: E,
): CodexItem & E {
  const base: CodexItem = { id: d.id, label: d.label };
  const s = src(d.source);
  if (s) base.source = s;
  if (d.desc !== undefined) base.desc = d.desc;
  if (d.maison !== undefined) base.maison = d.maison;
  return { ...base, ...extras } as CodexItem & E;
}

const fact = (label: string, value: unknown): CodexFact | null =>
  value == null || value === '' || value === '–' ? null : { label, value: String(value) };

const facts = (...xs: (CodexFact | null)[]): CodexFact[] => xs.filter((x): x is CodexFact => x != null);

/** Valeur d'un champ de charge rendue LISIBLE sans rien inventer : un booléen se lit « oui », une
 *  valeur simple s'imprime telle quelle. Un champ COMPOSITE (recette de détail) n'a PAS de fait :
 *  ses sous-clés (`seedScope`, `speckle`…) sont des noms de moteur qu'aucune méta ne nomme en
 *  français — au régime `profondeur`, `libelleDuChamp` ne nomme que les sous-champs d'un nœud passé
 *  par `nommerChamps`, et rend la clé nue des autres — et le Codex est un
 *  écran de RÉFÉRENCE joueur (règle stricte 4). Le champ reste ÉDITABLE à l'atelier, sous-formulaire
 *  inféré ; c'est le FAIT de fiche qui exige un nom lisible. */
const valeurDeCharge = (v: unknown): string | null => {
  if (v == null) return null;
  if (typeof v === 'boolean') return v ? tr('codex.fiche.oui') : null;
  if (typeof v === 'object') return null;
  return String(v);
};

const join = (...parts: (string | null | undefined)[]): string | undefined => {
  const s = parts.filter(Boolean).join(' · ');
  return s || undefined;
};

/** Fait « Spécialisations » d'une Compétence/Talent : catalogue ÉNUMÉRABLE (`specCatalogOf` — registre
 *  partagé si `specsSource`, sinon TOUTES les `specs[]`, hors-pool comprises : le Codex est un écran de
 *  RÉFÉRENCE) rendu en libellés FR via `specLabel`. Null si le domaine n'a aucune spec. */
const specsFact = (cat: 'skills' | 'talents', def: { id: string; specsSource?: import('../../data').SpecsSource; specs?: import('../../data').SpecEntry[] }): string | null => {
  const ids = specCatalogOf(def);
  return ids.length ? ids.map((id) => specLabel(cat, def.id, id)).join(', ') : null;
};

/** Prix d'une possession → libellé monnaie canon. La MARQUE de la colonne Prix (`'ND'`, LDB 62 l.28/
 *  l.31, LDB 68 l.11) se rend TELLE QUELLE, comme la colonne Enc rend déjà la sienne (`fact('Enc',
 *  t.enc)`) — le Codex imprime ce que le livre imprime. Null si gratuit/absent. */
const priceLabel = (p: Money | 'ND' | null | undefined): string | null => {
  if (typeof p === 'string') return p;
  return p && (p.gold || p.silver || p.brass) ? formatMoney(priceToMoney(p)) : null;
};

/** Fait « Dégâts » d'une arme/pièce : chaîne imprimée + note CONDITIONNELLE dérivée des capacités de qualité
 *  (Bélier `ram` / Siège `siege`, #135) — jamais un total qui suggère un dégât inconditionnel quand la
 *  donnée dit le contraire. `conditionalDamageNote` = SOURCE UNIQUE (`weaponStats.ts`), la MÊME que
 *  `weaponStatParts` pour les armes EN MAIN (Sac/popover/fiche personnage). */
const damageFact = (t: { damage: import('../../engine/types').WeaponDamageSpec | null; qualities: { id: string; value?: number }[]; onHitEffects?: import('../../engine/flowCore').TriggeredEffect[] }): string | undefined =>
  join(t.damage ? damageString(t.damage) : null, conditionalDamageNote(t));

/** Nom d'auteur d'un décor de `props.json` (le catalogue n'a pas de catégorie Codex et aucun écran ne
 *  l'écrit, `defs/props.ts`) — lecture VIVANTE du dataset ; l'id nu tient lieu de
 *  nom pour une référence hors catalogue, que le parse refuse nominativement (`ref('prop')`). */
const propLabel = (id: string): string => props.find((p) => p.id === id)?.label ?? id;

/** Nom d'auteur d'une matière de `materials.json` — lecture VIVANTE ; sa sous-liste se juge au parse
 *  (`ref('material', …)`), l'id nu tient lieu de nom hors catalogue. */
const matiereLabel = (id: string): string => materials.find((m) => m.id === id)?.label ?? id;

/** Famille d'une race/variante : « Humains (Reiklander) » → « Humains ». */
const family = (label: string): string => label.split(' (')[0].trim();

/** Rangées de référence d'une liste de Caractéristiques : `CharKey` EST l'id de `characteristics.json`
 *  (`charKeySchema`, `grammaire/valeurs.ts`) — aucun round-trip par libellé, même patron
 *  qu'`opRows.ts` (`case 'charMod'`). */
const charRefRows = (keys: readonly CharKey[]): CodexRow[] =>
  keys.map((k) => ({ t: 'ref', category: 'characteristics', id: k, label: CHAR_LABELS[k], show: CHAR_LABELS[k] }));
/** Lien cross-réf par `id` STABLE DÉJÀ CONNU, jamais re-résolu par libellé : `label` =
 *  libellé concret (`refLabel`, spécialisation comprise), `show` = texte affiché (valeur, Indice…). */
const idRefRow = (category: string, id: string, spec?: string, show?: string): CodexRow => {
  const label = refLabel(category, { id, spec });
  return { t: 'ref', category, id, label, show: show ?? label };
};
/** Rangée du FOYER d'une règle (`{ id, type }`) : sa fiche Codex (`cibleCodex`). */
const foyerRow = (foyer: FoyerDeRegle): CodexRow => {
  const { category, id } = cibleCodex(foyer);
  return idRefRow(category, id);
};
/** Section « Règle » d'un porteur de foyer (`rule`). */
const regleChips = (foyer: FoyerDeRegle | undefined) => chips(tr('codex.fiche.regle'), foyer ? [foyerRow(foyer)] : []);
/** Rangées d'une `TraitList` par id, libellé joueur (`traitLisible`, l'individu nommé par `nomDIndividu`). */
const traitRefRows = (traits?: readonly TraitPose[] | null, nomDIndividu?: NomDIndividu): CodexRow[] =>
  (traits ?? []).map((t) => idRefRow('traits', t.id, undefined, traitLisible(t, nomDIndividu)));
/** Rangée d'un `AdvancementRef` : `{pick}` → rangée de choix, référence → par id, `{random}` → pastille. */
const advancementRow = (category: 'skills' | 'talents', a: AdvancementRef): CodexRow => {
  if ('pick' in a) return { t: 'choice', category, advancement: a };
  if ('id' in a) return idRefRow(category, a.id, a.spec, advancementLabel(category, a));
  return { t: 'chip', label: advancementLabel(category, a) };
};
const kvRows = (pairs: [string, unknown][]): CodexRow[] =>
  pairs
    .filter(([, v]) => v != null && v !== '' && v !== '–')
    .map(([k, v]) => ({ t: 'kv', k, v: String(v) } as CodexRow));

/** Section de pastilles (skip si vide). */
const chips = (title: string, rows: CodexRow[]): CodexSection | null =>
  rows.length ? { title, layout: 'chips', rows } : null;
/** Ligne cross-réf d'une `TrappingRef` STRUCTURÉE (#904) : la FORME de la référence désigne SON
 *  foyer — `id`→Possessions, `{id, type}`→Créatures ou Véhicules selon `type` — jamais une re-résolution
 *  par libellé. Une somme, une mention et un `{text}` ne désignent aucune entité ;
 *  `choice`/`wildcard` restent un texte composite (pas de `t:'choice'` multi-catégorie ici). */
const trappingRefRow = (ref: TrappingRef): CodexRow => {
  const show = trappingRefLabel(ref);
  if ('type' in ref && ref.type === 'creature') return idRefRow('creatures', ref.id, undefined, show);
  if ('type' in ref) return { t: 'ref', category: 'vehicles', id: ref.id, label: findVehicleById(ref.id)?.label ?? ref.id, show };
  if ('id' in ref) return idRefRow('trappings', ref.id, undefined, show);
  // PASTILLE NUE, jamais de la prose : une somme, une mention ou un `{text}` est un NOM (« Grand hôtel particulier avec
  // jardins » y ferait lier « Grand »), et `choice`/`wildcard` sont des libellés composites. Aucune
  // entité du Codex n'est désignée — donc pas de `t:'ref'` non plus, et aucun porteur : le libellé
  // rendu n'est même pas toujours le champ (`trappingRefLabel` le DÉCORE du compte `ref.count` —
  // « Pamphlétaire (3) »). Même boîte que ses voisines de section.
  return { t: 'chip', label: show };
};
/** Les lignes des dotations `items` : les possessions, puis les mentions de premier niveau sous un sous-titre par nature
 *  (`mentionsParNature`). */
const trappingRefRows = (items?: TrappingRef[] | null): CodexRow[] => [
  ...(items ?? []).filter((r) => !estMention(r)).map(trappingRefRow),
  ...mentionsParNature((items ?? []).filter(estMention)).flatMap(({ titre, mentions }) => [{ t: 'sub', label: titre } as CodexRow, ...mentions.map(trappingRefRow)]),
];
/** Section de pastilles de Possessions (skip si vide) — équivalent `chips` pour les `TrappingRef[]` STRUCTURÉES. */
const trappingChips = (title: string, items?: TrappingRef[] | null): CodexSection | null =>
  items && items.length ? { title, layout: 'chips', rows: trappingRefRows(items) } : null;

/** Compose des sections en écartant les vides/null. */
const sections = (...xs: (CodexSection | null | undefined | false)[]): CodexSection[] =>
  xs.filter((s): s is CodexSection => !!s && s.rows.length > 0);

/** Rubriques d'ANATOMIE D'UN RITUEL (`VDM 02 l.377-393`) portées par `SpellData.ritual` : rendues
 *  dans l'ORDRE imprimé, en lignes `text` (Markdown verbatim passé à `<Prose>`). `NI`, `PX
 *  d'apprentissage` et `Description` n'y figurent pas : ils vivent dans les faits d'en-tête et la
 *  prose de la fiche. */
const ritualSection = (r: SpellData['ritual']): CodexSection | null =>
  r
    ? {
        title: tr('codex.fiche.rituel'),
        layout: 'list',
        // Un sous-en-tête SYNTHÉTISÉ (nu) par rubrique, puis le CHAMP seul — le texte rendu est
        // alors le verbatim du champ, adressable (`ritual.<champ>`). Un `**Composants :** …` inline
        // mêlait libellé fabriqué et verbatim : pas un champ, donc pas un porteur.
        rows: [
          { t: 'sub', label: tr('codex.fiche.type') }, { t: 'text', text: r.type, porteur: { chemin: 'ritual.type' } },
          { t: 'sub', label: tr('codex.fiche.composants') }, { t: 'text', text: r.components, porteur: { chemin: 'ritual.components' } },
          { t: 'sub', label: tr('codex.fiche.conditions') }, { t: 'text', text: r.conditions, porteur: { chemin: 'ritual.conditions' } },
          { t: 'sub', label: tr('codex.fiche.sacrifices') }, { t: 'text', text: r.sacrifices, porteur: { chemin: 'ritual.sacrifices' } },
          { t: 'sub', label: tr('codex.fiche.consequences') }, { t: 'text', text: r.consequences, porteur: { chemin: 'ritual.consequences' } },
        ],
      }
    : null;

/** Fait de Rituel imprimé avec sa PARENTHÈSE de difficulté réduite (`VDM 02 l.398` : « **NI :** 50
 *  (25) », `l.400` : « **PX d'apprentissage :** 200 (100) ») — la rubrique **Type** du Rituel dit
 *  à qui elle s'ouvre, `ritualReduction` (`src/engine/grimoire.ts`) l'applique au lanceur. */
const withReduced = (value: unknown, reduced: number | undefined): unknown =>
  value == null || reduced == null ? value : `${value} (${reduced})`;

/** Sections INVERSES d'une entité (« Créatures ayant ce trait », « Carrières par rang », « Talents le
 *  conférant »…) dérivées de la brique relationnelle id-based (`relations.ts`). Chaque groupe = une
 *  section de chips cross-réf cliquables ; le détail (rang/facultatif/Bénédiction) = badge non cliquable.
 *  Vide si l'entité n'est référencée nulle part. À SPREAD dans `sections(...)`. */
const reverseSections = (category: string, id: string | undefined): CodexSection[] =>
  id == null ? [] : reverseGroups(category, id).map((g) => ({
    title: g.title,
    layout: 'chips' as const,
    rows: g.referrers.map((r) => ({ t: 'ref', category: r.category, id: r.id, label: r.label, show: r.label, badge: r.detail } as CodexRow)),
  }));

/** Fourchette de Statut social d'une carrière (LDB 05) : `status` du 1er échelon → celui du dernier
 *  (« Bronze 1 → Or 1 »). Un seul échelon ⇒ statut simple ; aucune donnée ⇒ null (fait omis). */
const careerStatusRange = (levels: import('../../data').CareerLevelData[]): string | null => {
  if (!levels.length) return null;
  const first = levels[0].status;
  const last = levels[levels.length - 1].status;
  return first === last ? first : `${first} → ${last}`;
};

/**
 * Libellé FR d'une VALEUR d'un champ ÉNUMÉRÉ, lu SUR SON NŒUD (`enumNomme`, #1694) : les noms des
 * valeurs vivent à la déclaration du champ — le Codex les LIT, il n'en tient plus la table.
 */
const valeurFR = (fichier: string, champ: string, valeur: string): string =>
  libelleDeValeur(noeudDuChamp(fichier, champ), valeur);

/** Section « Issues par Degrés de Réussite » d'une Activité (bandes `OutcomeBand[]`) : une sous-tête par
 *  bande (issue + fourchette de DR + gate de bataille) puis note verbatim, résolveur, rendu, effets et
 *  issues de bataille. Vide si l'Activité n'a pas de table d'issues. */
function outcomeBandsSection(bands?: OutcomeBand[]): CodexSection | null {
  if (!bands?.length) return null;
  const rows: CodexRow[] = [];
  for (const [i, b] of bands.entries()) {
    const head = [
      b.on ? libelleDeValeur(outcomeOnSchema, b.on) : tr('codex.fiche.touteIssue'),
      b.minSL != null || b.maxSL != null ? `DR ${fourchette(b.minSL ?? null, b.maxSL ?? null)}` : null,
      b.when ? libelleDeValeur(battleCondSchema, b.when) : null,
    ].filter(Boolean).join(' · ');
    rows.push({ t: 'sub', label: head });
    if (b.note) rows.push({ t: 'text', text: b.note, porteur: { chemin: `outcomes[${i}].note` } });
    if (b.resolver) rows.push({ t: 'kv', k: tr('codex.fiche.resolveur'), v: b.resolver });
    if (b.payoutPct != null) rows.push({ t: 'kv', k: tr('codex.fiche.rendu'), v: `${b.payoutPct} %` });
    // Les ops de la bande se RENDENT (primitive `opRows` — chips codex-liées, phrase humanisée, et un
    // `rollTable` expansé en ses rangées), jamais un compte. Même projection que « Tables d'effets ».
    if (b.ops?.length) rows.push(...opRows(b.ops));
    for (const o of b.battle ?? [])
      rows.push({ t: 'kv', k: tr('codex.fiche.bataille'), v: `${libelleDeValeur(battleOutcomeTargetSchema, o.target)} ${libelleDeValeur(battleOutcomeScaleSchema, o.scale)} ${o.amount >= 0 ? '+' : ''}${o.amount}${o.side ? ` (${libelleDeValeur(equipeSchema, o.side)})` : ''}` });
    if (b.chains?.length) rows.push({ t: 'kv', k: tr('codex.fiche.enchaine'), v: b.chains.join(', ') });
  }
  return { title: tr('codex.fiche.issuesParDegresDeReussite'), layout: 'list', rows };
}

/**
 * SOURCE UNIQUE du contenu structuré d'une fiche de race — onglets Profil / Carrières / Détails.
 * Consommée par le Codex (`registry.races`) ET l'étape Race du créateur (`SpeciesRaceScreen`) : ses
 * sections Compétences/Talents, et ses Caractéristiques par `caracteristiqueDEspece` — Carrières/Détails
 * restent au Codex —, pour qu'elles ne puissent plus diverger. Données tirées des MÊMES tables que le
 * créateur (`careersForSpecies`, `details`, `eyes`, `hairs`). Les faits-clés (M/Destin/Résilience)
 * restent en en-tête (méta), pas ici ; le tirage aléatoire (création) est ajouté PAR le créateur.
 */
/** Base d'espèce d'une Caractéristique et son écart à la colonne Humain, signé (`undefined` sans écart).
 *  Lue par `raceCharSection` et l'étape Race du créateur. LDB 05 l.351-369 */
export function caracteristiqueDEspece(s: Pick<(typeof species)[number], 'baseChar'>, k: CharKey): { base: number; ecart: string | undefined } {
  const base = baseDEspece(s, k);
  const diff = base - BASE_HUMAINE;
  return { base, ecart: diff !== 0 ? `${diff > 0 ? '+' : ''}${diff}` : undefined };
}

/** Section « Caractéristiques de base » d'une race — chaque carac affiche son écart racial (±). */
export function raceCharSection(s: (typeof species)[number]): CodexSection {
  const rows: CodexRow[] = CHAR_KEYS.map((k) => {
    const { base, ecart } = caracteristiqueDEspece(s, k);
    return {
      t: 'kv',
      k: charAbr(k),
      v: ecart ? `${base} (${ecart})` : String(base),
      kref: { category: 'characteristics', id: k, label: CHAR_LABELS[k] },
    };
  });
  return { title: tr('codex.fiche.caracteristiquesDeBase'), layout: 'grid', rows };
}

/** Section « Compétences de race » — chips cliquables, « A ou B » éclaté en choix. */
export function raceSkillSection(s: (typeof species)[number]): CodexSection | null {
  const rows = s.skills.map((a) => advancementRow('skills', a));
  return rows.length ? { title: tr('codex.fiche.competencesDeRace'), layout: 'chips', rows } : null;
}

/** Section « Talents de race » — chips cliquables, « A ou B » éclaté en choix. Note d'atelier finale
 *  (#393 P2, verdict juge vision P1 item 8) : les choix/tirages (« au d100 ») ne se tranchent pas ici,
 *  mais à l'étape 5 (Compétences & Talents) du créateur. */
export function raceTalentSection(s: (typeof species)[number]): CodexSection | null {
  const rows = s.talents.map((a) => advancementRow('talents', a));
  if (!rows.length) return null;
  return { title: tr('codex.fiche.talentsDeRace'), layout: 'chips', rows: [...rows, { t: 'nb', text: tr('codex.fiche.seTranchentALEtape5') }] };
}

/** Section « Carrières accessibles » d'une race — groupées par classe, cliquables (→ fiche carrière). */
export function raceCareerSection(s: (typeof species)[number]): CodexSection | null {
  const accessible = careersForSpecies(s);
  const rows: CodexRow[] = [];
  for (const cl of classes) {
    const list = accessible.filter((c) => c.class.id === cl.id);
    if (list.length) rows.push({ t: 'sub', label: cl.label }, ...list.map((c) => idRefRow('careers', c.id)));
  }
  return rows.length ? { title: tr('codex.fiche.carrieresAccessibles'), layout: 'chips', rows } : null;
}

/** Section « Détails » d'une race — âge, taille, yeux & cheveux, noms (tables de création). */
export function raceDetailSection(s: (typeof species)[number]): CodexSection {
  const ref = s.refChar;
  const txt = details.texts;
  const eyeColors = [...new Set(eyes.map((e) => e.color[ref]).filter(Boolean))];
  const hairColors = [...new Set(hairs.map((e) => e.color[ref]).filter(Boolean))];
  const rows: CodexRow[] = [
    { t: 'sub', label: tr('codex.fiche.age') },
    { t: 'text', text: tr('codex.fiche.ans', { v: formatDice(details.age[ref]) }) },
  ];
  // Les textes d'âge/taille/noms sont des champs de `details.json` — la fiche de Race les AFFICHE,
  // elle ne les porte pas : le porteur nomme l'entrée réelle. Âge/taille FORMATÉS (`formatDice`) et
  // les couleurs JOINTES sont, eux, fabriqués : nus.
  const dTxt = (chemin: string) => ({ type: 'details', id: 'details', chemin });
  if (txt.age.bySpecies[ref]) rows.push({ t: 'text', text: txt.age.bySpecies[ref]!, porteur: dTxt(`texts.age.bySpecies.${ref}`) });
  rows.push({ t: 'sub', label: tr('codex.fiche.taille') }, { t: 'text', text: `${formatDice(details.taille[ref])} cm` });
  const tailleChemin = txt.taille.bySpecies[ref] ? `texts.taille.bySpecies.${ref}` : 'texts.taille.all';
  const tailleTxt = txt.taille.bySpecies[ref] ?? txt.taille.all;
  if (tailleTxt) rows.push({ t: 'text', text: tailleTxt, porteur: dTxt(tailleChemin) });
  if (eyeColors.length) rows.push({ t: 'sub', label: tr('codex.fiche.yeux') }, { t: 'text', text: eyeColors.join(', ') });
  if (hairColors.length) rows.push({ t: 'sub', label: tr('codex.fiche.cheveux') }, { t: 'text', text: hairColors.join(', ') });
  const nomChemin = txt.nom.bySpecies[ref] ? `texts.nom.bySpecies.${ref}` : 'texts.nom.bySpecies.humain';
  const namesTxt = txt.nom.bySpecies[ref] ?? txt.nom.bySpecies.humain;
  if (namesTxt) rows.push({ t: 'sub', label: tr('codex.fiche.noms') }, { t: 'text', text: namesTxt, porteur: dTxt(nomChemin) });
  return { title: tr('codex.fiche.ageTailleApparence'), layout: 'list', rows };
}

export function raceFicheTabs(s: (typeof species)[number]): CodexTab[] {
  const career = raceCareerSection(s);
  return [
    { title: tr('codex.fiche.profil'), sections: sections(raceCharSection(s), raceSkillSection(s), raceTalentSection(s)) },
    ...(career ? [{ title: tr('codex.fiche.carrieres'), sections: [career] }] : []),
    { title: tr('codex.fiche.details'), sections: [raceDetailSection(s)] },
  ];
}

/** SOURCE UNIQUE de la fiche d'un Trait (partagée par la catégorie « Traits » ET le filtre
 *  « Psychologie ») : manœuvres conférées + passifs + effets + réfs INVERSES (créatures/mutations) ;
 *  la capacité psy (LDB 21) remonte en méta (type + immunité + Indice fixe). */
/** Statbloc compact d'une créature : profil IMPRIMÉ (M + les 10 caracs, « – » si inexistante —
 *  LDB 76, Schéma des Profils) + Blessures (valeur livre `char.B` si imprimée, sinon formule
 *  BF+2×BE+BFM × Taille, LDB 85) + traits en chips cross-réf. Zéro logique par-créature. */
export function creatureStatblock(c: (typeof creatures)[number]): NonNullable<CodexItem['statblock']> {
  const cell = (label: string, v: number | null | undefined, kref?: CodexFact['kref']): CodexFact => ({ label, value: v != null ? String(v) : '–', kref });
  const size = tailleDuProfil(c);
  const wounds = typeof c.char.B === 'number'
    ? c.char.B
    : woundsForSize(bonus(c.char.force ?? 0), bonus(c.char.endurance ?? 0), bonus(c.char['force-mentale'] ?? 0), size);
  return {
    profile: [
      cell('M', c.char.M, { category: 'characteristics', id: 'mouvement', label: tr('codex.fiche.mouvement') }),
      ...CHAR_KEYS.map((k) => cell(charAbr(k), c.char[k], { category: 'characteristics', id: k, label: CHAR_LABELS[k] })),
      { label: 'B', value: String(wounds), kref: { category: 'characteristics', id: 'blessure', label: tr('codex.fiche.blessure') } },
    ],
    traits: traitRefRows(c.traits),
  };
}

/** Fiche d'un Trait, projetée par DEUX catégories (`traits` et le filtre `psychologie`). */
const traitItem = (t0: (typeof traits)[number]): CodexItem => {
  // Entrée EFFECTIVE sous les règles optionnelles actives (#563/#564), comme la catégorie Talents :
  // desc, source, capacités, passifs et effets affichés sont ceux de la variante réglée quand elle est
  // active. `traits.json` n'en porte AUCUNE aujourd'hui (mesuré) — la lecture s'aligne sur le schéma
  // (`data/schemas/defs/traits.ts`, champ `variants?`) pour que la première n'arrive pas dans un écran muet.
  const t = effectiveEntry(t0);
  const cap = t.capabilities;
  return depuisEnveloppe(t, {
    sub: traitArgSkeleton(t),
    meta: facts(
      cap?.psychType ? fact(tr('codex.fiche.psychologie'), psychologyLabel(cap.psychType)) : null,
      cap?.psychIndice != null ? fact(tr('codex.fiche.indice'), cap.psychIndice) : null,
    ),
    sections: sections(
      chips(tr('codex.fiche.manoeuvresConferees'), (t.grantsManeuvers ?? []).map((r) => idRefRow('maneuvers', r.id, r.spec))),
      passiveSection(t.passive), effectsSection(t.effects, ETATS_DU_CODEX),
      ...reverseSections('traits', t.id), // Créatures ayant ce trait · Mutations le conférant
    ),
  });
};

// ── Fraîcheur du Codex : projections paresseuses sur le témoin des datasets ─────────────────────
// `setDataset`/`setObjectDataset` (persist d'une édition Codex) mutent `src/data` EN PLACE, et
// `setRule`/`resetRule` basculent une règle optionnelle : tous bumpent `versionDesDatasets`
// (`data/versionDataset.ts`) : les projections et index ci-dessous se
// re-matérialisent à la lecture qui suit (`memoParVersion`), et les composants abonnés
// (`useVersionDesDatasets`) re-rendent.
const LOOKUP = memoParVersion(CLES_DE_DATASET, () => new Map<string, Map<string, CodexItem>>());


/** Libellé de la facette hiérarchique (`group`) par catégorie. */
const GROUP_FACET_LABEL: Partial<Record<CleCodex, MsgKey>> = {
  races: 'codex.fiche.famille', careers: 'codex.fiche.classe', mutations: 'codex.fiche.type', psychologie: 'codex.fiche.type',
  creatures: 'codex.fiche.dossier', locations: 'codex.fiche.lieuParent', books: 'codex.fiche.dossier', careerLevels: 'codex.fiche.carriere',
  arcanePhenomena: 'codex.fiche.rubrique',
};

/** Facettes d'une catégorie, DÉRIVÉES de ses items projetés : une facette n'existe que si des items
 *  PORTENT le champ (livre source partout ; hiérarchie `group` là où la catégorie en a une). */
function deriveFacets(key: CleCodex, items: CodexItem[]): CodexFacet[] | undefined {
  const facets: CodexFacet[] = [];
  if (items.some((i) => i.source?.book)) facets.push({ key: 'book', label: tr('codex.fiche.livre'), valueOf: (i) => i.source?.book });
  if (items.some((i) => i.group)) facets.push({ key: 'group', label: tr(GROUP_FACET_LABEL[key] ?? 'codex.fiche.groupe'), valueOf: (i) => i.group });
  return facets.length ? facets : undefined;
}

/** Spec d'une catégorie : projection `build` (exécutée paresseusement, re-exécutable) ; son identité
 *  est sa clé dans `CODEX_SPECS`. */
interface CodexCategorySpec {
  /** Clé de catalogue du libellé, résolue à la lecture (`makeCategory`). */
  label: MsgKey;
  group: CodexGroup;
  /** Sous-groupe FR : les catégories d'un même `cluster` se replient sous UN dépliable dans la barre
   *  de catégories (anti-avalanche des groupes touffus Effets/Tables). Absent = pastille à plat. Clé de catalogue. */
  cluster?: MsgKey;
  /** Réf de source de la table (« LDB 18 ») — hors du libellé, cf. `CodexCategory.sourceRef`. */
  sourceRef?: string;
  /** cf. `CodexCategory.exergues`. */
  exergues?: boolean;
  build: () => CodexItem[];
}

/** Catégorie à projections PARESSEUSES (`memoParVersion` sur `CLES_DE_DATASET`). */
function makeCategory(key: CleCodex, spec: CodexCategorySpec): CodexCategory {
  const projection = memoParVersion(CLES_DE_DATASET, () => {
    const items = spec.build();
    return { items, facets: deriveFacets(key, items) };
  });
  return {
    key,
    get label() { return tr(spec.label); },
    group: spec.group,
    get cluster() { return spec.cluster && tr(spec.cluster); },
    sourceRef: spec.sourceRef,
    exergues: spec.exergues,
    get items() { return projection().items; },
    get facets() { return projection().facets; },
  };
}

/** Les nœuds `test` d'un Flow, dans l'ordre de jeu — le joueur doit voir AUTANT de jets que le moteur
 *  en joue (doctrine de la forme canonique des jets). Marche récursive, aucune forme n'est supposée. */
function noeudsDeTest(f: Flow | undefined): FlowTestNode[] {
  if (!f) return [];
  switch (f.kind) {
    case 'test': return [f, ...noeudsDeTest(f.reussite), ...noeudsDeTest(f.echec)];
    case 'sequence': return f.etapes.flatMap(noeudsDeTest);
    case 'si': return [...noeudsDeTest(f.alors), ...noeudsDeTest(f.sinon)];
    case 'choix': return [...noeudsDeTest(f.oui), ...noeudsDeTest(f.non)];
    default: return [];
  }
}

/**
 * Ops d'un Flow SANS FRANCHIR un jet — la conséquence de CE niveau, les sous-jets exclus. C'est ce qui
 * distingue « ce que ce jet applique » de « ce que le jet suivant appliquera » : `spellOps` descend dans
 * les branches d'un `test` imbriqué et ferait promettre à un jet les États du suivant (« Coupure à
 * l'orteil » : le gate l.171 annoncerait les États du Test l.237). Les `si` sont TRAVERSÉS (leurs deux
 * branches font partie de la conséquence de ce niveau — l'échelle de DR de l.237), les `test` NON.
 * Sur le Flow entier, la même marche rend l'amputation que la ligne PRONONCE hors de tout jet
 * (« Vous perdez votre main – Amputation (Difficile) », LDB 18 l.124). Question DISTINCTE de
 * `certainFlowOps` (« que promet CETTE branche », fail-closed sur tout nœud incertain).
 */
function opsHorsJet(f: Flow | undefined): GameOp[] {
  if (!f) return [];
  if (f.kind === 'sequence') return f.etapes.flatMap(opsHorsJet);
  if (f.kind === 'si') return [...opsHorsJet(f.alors), ...opsHorsJet(f.sinon)];
  if (f.kind === 'effet' && f.effet.type === 'ops') return f.effet.ops;
  return [];
}

/** Libellé d'un nœud `test` : « Compétence Difficulté », la Compétence résolue PAR ID. */
function libelleDeJet(n: FlowTestNode): string {
  // lecture déclarée : la fiche décrit le Test tel que la donnée l'authore
  return `${refLabel('skills', n.test.skill ?? { id: 'resistance' })} ${DIFFICULTY_LABELS[n.test.difficulty!]}`;
}

/** Item Codex d'une entrée de table de Blessures Critiques par Localisation (LDB 18 « Traumatisme » ET
 *  AA « approche alternative », #157) — 8 catégories (4 familles × 2 jeux), MÊME projection : plage
 *  d100 → nom, effet immédiat (`ops`, même vocabulaire GameOp que passifs/sorts), le JET de la rangée
 *  (Difficulté + conséquence de l'échec, #1682) et les Traumatismes engendrés en cross-réf (résolus par
 *  id → libellé, comme les Tables de Corruption pour les mutations). La trivialité (« T », AA 07
 *  l.79) est DÉRIVÉE de la rangée, jamais relue d'un champ.
 *
 *  Le/les Test(s) d'AMPUTATION (LDB 18 l.237) sont DÉRIVÉS du nœud que le moteur fabrique
 *  (`noeudAmputation`) — jamais re-décrits ici : la vue et le jeu ne peuvent pas diverger. */
function critEntryItem(e: CritTableEntry, jeu: JeuDeCritique, table: CritTableKey): CodexItem {
  const jet = e.test;
  const amputation = noeudAmputation(e, jeu, CRIT_TABLE_LOCATION[table]);
  const jetsAmp = noeudsDeTest(amputation);
  return depuisEnveloppe(e, {
    sub: bandeAuDe(critiqueDie(jeu, table), e.min, e.max),
    meta: facts(
      e.lethal ? fact(tr('codex.fiche.letal'), tr('codex.fiche.oui')) : null,
      !e.lethal && !(e.ops ?? []).some((o) => o.op === 'wounds') ? fact(tr('codex.fiche.type'), tr('codex.fiche.trivialeT')) : null,
      jet ? fact(tr('codex.fiche.jet'), libelleDeJet(jet)) : null,
      jetsAmp.length ? fact(jetsAmp.length > 1 ? tr('codex.fiche.jetsDAmputation') : tr('codex.fiche.jetDAmputation'), jetsAmp.map(libelleDeJet).join(' puis ')) : null,
      e.amputation?.timing === 'postEncounter' ? fact(tr('codex.fiche.quand'), tr('codex.fiche.uneFoisLaRencontreTerminee')) : null,
    ),
    sections: sections(
      passiveSection(e.ops, tr('codex.fiche.effetImmediat')),
      jet ? passiveSection(opsHorsJet(jet.echec), tr('codex.fiche.siLeJetEchoue')) : null,
      jet ? passiveSection(opsHorsJet(jet.reussite), tr('codex.fiche.siLeJetReussit')) : null,
      ...jetsAmp.map((n) => passiveSection(opsHorsJet(n.echec), tr('codex.fiche.siLeJetEchoue2', { v: libelleDeJet(n) }))),
      // L'amputation que la ligne PRONONCE (22 rangées sur 26 : « Vous perdez votre main ») vit HORS des
      // branches — sans cette section, le Codex ne montrerait que le jet et tairait la perte elle-même.
      passiveSection(opsHorsJet(amputation), tr('codex.fiche.amputationQuoiQueDonneLeJet')),
      e.traumas?.length
        ? {
            title: tr('codex.fiche.traumatismesEngendres'), layout: 'chips',
            rows: e.traumas.map((id) => { const label = traumaLabelOf(id); return { t: 'ref', category: 'traumas', id, label, show: label } as CodexRow; }),
          }
        : null,
    ),
  });
}

/** Item Codex d'une entrée de table de voyage (`TravelTableEntry` — Incidents de monte EDOC 7,
 *  Problèmes de véhicule EDOC 7, Rencontres EDOC 8, #157 suite) — MÊME projection pour les 3
 *  familles : bande au dé `de` de sa table → texte + Dégâts véhicule éventuels + effet GameOp sur les occupants. */
function travelEntryItem(e: TravelTableEntry, de: DeDeTable, occupantsTitle: string): CodexItem {
  return depuisEnveloppe(e, {
    sub: bandeAuDe(de, e.min, e.max),
    meta: facts(fact(tr('codex.fiche.degatsVehicule'), e.vehicleWounds ? formatDice(e.vehicleWounds.dice) : null)),
    sections: sections(passiveSection(e.occupantOps, occupantsTitle)),
  });
}

/** QUI encaisse, en LIBELLÉS résolus depuis les catalogues (`ship-stations.json`, `crew-roles.json`) —
 *  la donnée porte des ids, l'affichage vient du `label` de l'entrée. */
function crewTargetLabel(cible: CrewTarget): string {
  if ('poste' in cible) return tr('codex.crewTarget.poste');
  if ('role' in cible) return refLabel('crewRoles', cible.role);
  return cible.stations.map((id) => refLabel('shipStations', { id })).join(' · ');
}

/** Item Codex d'une entrée de Critique de coque (`ShipCritEntry` — MDG 13 navire, MSRC 07 fluvial,
 *  #157 suite) : bande au dé du `jeu`, aucune quand il n'en tire pas (`die: null`) → effet immédiat (`ops`) + coup à l'équipage (`crewHit` : qui encaisse, et
 *  soit l'épreuve du nœud `test` avec les ops de sa branche d'échec, soit les ops certaines), MÊME
 *  vocabulaire que les autres Critiques (`critEntryItem`). */
function shipCritEntryItem(e: ShipCritEntry, jeu: ShipCritSet): CodexItem {
  const ch = e.crewHit;
  const jet = ch?.test?.test;
  const sujet = jet && (testSkillLabel(jet) ?? '');
  return depuisEnveloppe(e, {
    sub: jeu.die ? bandeAuDe(jeu.die, e.min, e.max) : undefined,
    desc: e.note,
    meta: facts(
      typeof e.shrapnel === 'number' ? fact(tr('codex.fiche.eclatsIndice'), e.shrapnel) : null,
      e.hullCrits ? fact(tr('codex.fiche.critiquesCoqueSuppl'), formatDice(e.hullCrits.dice)) : null,
    ),
    sections: sections(
      passiveSection(e.ops, tr('codex.fiche.effetImmediat')),
      ch
        ? {
            title: tr('codex.fiche.coupALEquipage'),
            layout: 'list',
            rows: [
              // lecture déclarée : la fiche décrit le Test tel que la donnée l'authore
              { t: 'kv', k: tr('codex.fiche.jet'), v: jet ? `${sujet}${jet.difficulty ? ` ${DIFFICULTY_LABELS[jet.difficulty]}` : ''}` : tr('codex.fiche.automatiqueAucunTest') } as CodexRow,
              { t: 'kv', k: tr('codex.fiche.cible'), v: crewTargetLabel(ch.crewTarget) } as CodexRow,
            ],
          }
        : null,
      ch ? passiveSection(ch.test ? spellOps(ch.test.echec, 'target') : ch.ops, ch.test ? tr('codex.fiche.consequenceEchecDuTest') : tr('codex.fiche.consequenceCertaine')) : null,
    ),
  });
}

/** Item Codex d'un Événement de bord/de port ou d'un palier du Voyage rapide (`SeaEventDef` — MDG 15,
 *  #157 suite, #1667) : plage de jet → texte verbatim, et sa `consequence` en grammaire. */
function seaEventItem(e: SeaEventDef, faces?: number): CodexItem {
  return depuisEnveloppe(e, {
    sub: fourchette(e.min, e.max, faces),
    sections: sections(spellFlowSection(e.consequence, ETATS_DU_CODEX, tr('codex.fiche.consequences'))),
  });
}

/** Item Codex d'un Facteur d'Humeur de Manann (`ManannFactor` — MDG 15, #157 suite) : effet signé
 *  appliqué UNE fois par navire. */
function manannFactorItem(f: ManannFactor): CodexItem {
  return depuisEnveloppe(f, {
    meta: facts(fact(tr('codex.fiche.effetSurLHumeurDeManann'), formatEffetSigne(f.effect))),
  });
}

/** Section « Modificateurs » d'Exposition hydrique — groupée par table (Source d'eau / Blessures et
 *  États), chaque ligne portant son contexte d'application (Ingestion/Immersion). */
function waterModifiersSection(mods: WaterExposureModifier[]): CodexSection | null {
  if (!mods.length) return null;
  const groups = [...new Set(mods.map((m) => m.table))];
  const rows: CodexRow[] = [];
  for (const g of groups) {
    rows.push({ t: 'sub', label: libelleDeValeur(waterTableSchema, g) });
    for (const m of mods.filter((x) => x.table === g))
      rows.push({ t: 'kv', k: m.label, v: `${m.mod > 0 ? '+' : ''}${m.mod} (${m.appliesTo.join(', ')})` });
  }
  return { title: tr('codex.fiche.modificateurs'), layout: 'list', rows };
}

// ── LOT 1 #422 : famille NAVALE (MDG 12/13/15) — Ports, Progression, Navigation, Périls, Météo,
//    Construction navale. Ports & sous-tableaux de construction restent des CATÉGORIES-tableau (une
//    fiche par entité, patron `criticalsTete`) ; Navigation/Périls/Météo sont des FICHES DE RÈGLE
//    UNIQUES (dataset-objet, MÊME patron que `waterExposure`, #157 suite) — chaque config imbriquée
//    (Salissures, Orientation, Détroits, Tourbillons…) devient une section plutôt qu'une entité isolée. ──

/** Libellé FR d'une entrée de `production`/`surplus`/`demande` d'un Port (`naval-ports.json`) : le
 *  catalogue `cargoes.json` porte tout le vocabulaire de la colonne. Une MARCHANDISE ouvre un lien
 *  cross-réf vers sa fiche ; un MARQUEUR (`echangeable: false`, MDG 15 l.321) n'a pas de fiche — il
 *  s'annonce en texte simple, avec son qualificatif `hint` lu EN DONNÉE (« plaque tournante » /
 *  « rien à échanger »), jamais un suffixe codé ici ni un texte par id. */
function portCargoRow(id: string, qty?: number): CodexRow {
  const entry = findCargoEntryById(id);
  const label = entry?.label ?? id;
  const nom = entry && !isEchangeable(entry) && entry.hint ? `${label} (${entry.hint})` : label;
  const show = qty != null ? `${nom} (${qty})` : nom;
  // Repli : une cargaison NON échangeable n'a pas de fiche à ouvrir — pastille NUE, jamais un
  // paragraphe de prose au milieu des pastilles voisines (même classe que les Possessions).
  return entry && isEchangeable(entry) ? { t: 'ref', category: 'cargoes', id: entry.id, label, show } : { t: 'chip', label: show };
}

/** Valeur signée (« +10 », « −2 », « 0 »). */
const signe = (n: number): string => (n > 0 ? `+${n}` : String(n));

/** Compétence d'un marchand tiré au hasard (« 3d10 + 40 »), MDG 15 l.337 et MSRC 13 l.129. */
const competenceDuMarchand = (c: { d10: number; plus: number }): string => `${c.d10}d10 + ${c.plus}`;

/** Fait signé (« +10 % », « −20 », « 0 ») — évite de dupliquer le ternaire de signe à chaque site. */
const signedFact = (label: string, v: number | undefined, suffix = ''): CodexFact | null =>
  v == null ? null : fact(label, `${signe(v)}${suffix}`);

/** Section « Propulsion & Manœuvrabilité » (MDG 12 l.131-144, `ship-construction.json::propulsion`/
 *  `::manoeuvrability`) — règle GLOBALE de construction (pas une entité par gabarit) : répétée telle
 *  quelle sur chaque fiche de coque (patron « note de règle partagée », comme `Ligne CE` sur un profil
 *  de créature). Lecture seule — les 2 sous-tables restent hors des 3 catégories-tableau (aucun id
 *  propre par ligne côté source), mais le FICHIER entier reste couvert par le schéma/la garde d'exposition. */
function shipConstructionRulesSection(): CodexSection {
  const p = shipConstruction.propulsion;
  return {
    title: tr('codex.fiche.propulsionManoeuvrabiliteRegleDeConstruction'), layout: 'list',
    rows: [
      { t: 'kv', k: tr('codex.fiche.propulsionSecondaireMalusAuCout'), v: `${p.secondaryMalus > 0 ? '+' : ''}${p.secondaryMalus}` } as CodexRow,
      { t: 'kv', k: tr('codex.fiche.propulsionSecondaireMMinimum'), v: String(p.secondaryMinM) } as CodexRow,
      ...shipConstruction.manoeuvrability.map((m) => ({
        t: 'kv', k: tr('codex.fiche.manoeuvrabilite', { v: m.manDR >= 0 ? '+' : '', manDR: m.manDR }), v: tr('codex.fiche.cout', { v: m.costPct >= 0 ? '+' : '', costPct: m.costPct }),
      } as CodexRow)),
    ],
  };
}

// ── LOT 1 #422 : famille RÈGLES LDB — Coût des Augmentations (07), Disponibilité & Troc (59), Accidents
//    de Conduite d'attelage / Ivresse (09), Surchargé par palier (61). Coût des Augmentations/Surchargé
//    restent des CATÉGORIES-tableau (une bande/un palier = une entité, id/label ajoutés en donnée pour
//    l'exposition, #422) ; Disponibilité & Troc est une FICHE DE RÈGLE UNIQUE (dataset-objet, patron
//    `waterExposure`) ; Accidents de Conduite / Ivresse restent des CATÉGORIES-tableau (id/name déjà
//    en donnée, MÊME patron que `incidentsMonture`/`problemesVehicule`). ──

/** Valeur d'une règle optionnelle rendue LISIBLE (un booléen se lit « Activée »/« Désactivée », pas
 *  « true ») — `RuleValue` est une union fermée booléen | nombre | chaîne. */
function ruleValueLabel(v: RuleValue): string {
  return typeof v === 'boolean' ? (v ? tr('codex.fiche.activee') : tr('codex.fiche.desactivee')) : String(v);
}

/** Section « % de Disponibilité » (LDB 59 l.25-30, `disponibilite.json::dispoPct`) — une sous-tête par
 *  classe (Limitée/Rare), % de réussite du Test (d100 ≤ %) par taille de colonie. */
function dispoPctSection(rows: (typeof disponibilite)['dispoPct']): CodexSection {
  const rowsOut: CodexRow[] = [];
  for (const r of rows) {
    rowsOut.push({ t: 'sub', label: libelleDeValeur(availabilitySchema, r.availability) } as CodexRow);
    rowsOut.push({ t: 'kv', k: tr('codex.fiche.village'), v: `${r.pct.village} %` } as CodexRow);
    rowsOut.push({ t: 'kv', k: tr('codex.fiche.ville'), v: `${r.pct.ville} %` } as CodexRow);
    rowsOut.push({ t: 'kv', k: tr('codex.fiche.cite'), v: `${r.pct.cite} %` } as CodexRow);
  }
  return { title: tr('codex.fiche.deDisponibiliteTestD100ParTaille'), layout: 'list', rows: rowsOut };
}

/** Section « Ratios de Troc » (LDB 59 l.68-76, `disponibilite.json::barterRatios`) — pour chaque
 *  Disponibilité de l'objet DONNÉ, le ratio `give:get` contre chaque Disponibilité de l'objet ACQUIS. */
function barterRatiosSection(rows: (typeof disponibilite)['barterRatios']): CodexSection {
  const rowsOut: CodexRow[] = [];
  for (const r of rows) {
    rowsOut.push({ t: 'sub', label: tr('codex.fiche.donne', { give: libelleDeValeur(availabilitySchema, r.give) }) } as CodexRow);
    for (const acquired of AVAILABILITIES) {
      const ratio = r.ratios[acquired];
      rowsOut.push({ t: 'kv', k: tr('codex.fiche.acquis', { acquired: libelleDeValeur(availabilitySchema, acquired) }), v: `${ratio.give} : ${ratio.get}` } as CodexRow);
    }
  }
  return { title: tr('codex.fiche.ratiosDeTrocDonneAcquis'), layout: 'list', rows: rowsOut };
}

// ── LOT 3 #422 (FINAL) : exemptions AUDIT — Empoignade (LDB 14, fiche de règle
//    UNIQUE), Incantations Imparfaites/Colère des dieux (LDB 46/40, DIALECTE compilé — PAS de vrais
//    `GameOp`, cf. `MiscastRowEntry`/`engine/miscast.ts::JsonRow` — renderer DÉDIÉ ci-dessous, jamais
//    `passiveSection`). ──

/** Libellé lisible d'un montant du DIALECTE miscast (nombre / dé / terme de Péché / somme —
 *  `JsonFormula`, `engine/miscast.ts`). Le terme de Péché n'est résolu qu'à l'exécution (Points de
 *  Péché du lanceur) : ici, affichage d'AUTEUR (« 1d10 + Points de Péché »), jamais une valeur bakée. */
function miscastAmountLabel(a: unknown): string {
  if (typeof a === 'number') return String(a);
  if (a && typeof a === 'object') {
    if ('sinPoints' in a) return tr('codex.miscast.sinPoints');
    if ('sum' in a) return (a as { sum: unknown[] }).sum.map(miscastAmountLabel).join(' + ');
    if ('dice' in a) return formatDice((a as { dice: DiceSpec }).dice);
  }
  return String(a);
}

/** Une op du DIALECTE miscast (`JsonOp`) → sa ligne Codex — sous-ensemble des `op` réellement présents
 *  dans `miscast.json` (`condition`/`wounds`/`corruption`/`reduceToZero`/`castPenalty`/`suppressTalents`/`deitySkillMod`/`deityBan`/`prayerForAction`, cf.
 *  `engine/miscast.ts::expandOp`). Chip cross-réf pour l'État ; texte structuré pour le reste. */
function miscastOpRow(o: Record<string, unknown>): CodexRow {
  switch (o.op) {
    case 'condition': {
      const { id } = o.id as { id: string };
      const label = conditionLabel(id);
      const value = o.value != null ? miscastAmountLabel(o.value) : null;
      const dur = o.durationRounds != null ? tr('codex.fiche.roundS', { v: miscastAmountLabel(o.durationRounds) }) : undefined;
      // CAUSE PERSISTANTE (`LDB 16 l.117`) : la rangée pose UN État et le MAINTIENT — la persistance se
      // dit au BADGE de SA chip, du mot du journal et de la même forme que l'autre lecteur (`opRows`).
      const badge = [estCausePersistante(o) ? causePersistante() : undefined, dur].filter((s): s is string => !!s).join(' · ') || undefined;
      const show = value && value !== '1' ? `${value} × ${label}` : label;
      return { t: 'ref', category: 'etats', id, label, show, badge };
    }
    case 'wounds': {
      // Mitigation DITE par la donnée (`ignoreTB`/`ignoreAP`), aux trois régimes du RAW — LDB 46
      // l.63 et l.69, LDB 40 l.68.
      const ignore = [o.ignoreTB ? tr('codex.fiche.leBonusDEndurance') : null, o.ignoreAP ? tr('codex.fiche.lesPa') : null].filter(Boolean);
      return { t: 'kv', k: tr('codex.fiche.blessures'), v: `${miscastAmountLabel(o.amount)}${ignore.length ? tr('codex.fiche.ignorant', { v: ignore.join(tr('codex.fiche.et')) }) : ''}` };
    }
    case 'corruption':
      return { t: 'kv', k: tr('codex.fiche.corruption'), v: tr('codex.fiche.pointS', { v: o.amount as number }) };
    case 'reduceToZero':
      return { t: 'text', text: tr('codex.fiche.pointsDeBlessureReduitsA0') };
    case 'castPenalty': {
      const skill = o.skill as { id: string } | undefined;
      const skillId = skill?.id;
      const dur = o.rounds != null ? tr('codex.fiche.roundS', { v: miscastAmountLabel(o.rounds) })
        : o.hours != null ? tr('codex.fiche.heureS', { v: miscastAmountLabel(o.hours) })
        : o.minutes != null ? tr('codex.fiche.minuteS', { v: miscastAmountLabel(o.minutes) })
        : o.days != null ? tr('codex.fiche.jourS', { v: miscastAmountLabel(o.days) }) : undefined;
      const eff = effetDeContrecoup({ blocked: !!o.blocked, maxZeroDR: !!o.maxZeroDR, mod: o.mod as number | undefined });
      return skillId
        ? { t: 'ref', category: 'skills', id: skillId, label: refLabel('skills', skill!), show: `${eff}${dur ? ` (${dur})` : ''}` }
        : { t: 'kv', k: tr('codex.fiche.magie'), v: `${eff}${dur ? ` (${dur})` : ''}` };
    }
    case 'suppressTalents':
      return { t: 'kv', k: tr('codex.fiche.talentsSuspendus'), v: tr('codex.fiche.jourS2', { v: (o.talents as { id: string }[]).map((x) => refLabel('talents', x)).join(', '), v2: miscastAmountLabel(o.durationDays) }) };
    case 'deitySkillMod': {
      const dur = o.durationHours != null ? tr('codex.fiche.heureS', { v: miscastAmountLabel(o.durationHours) }) : tr('codex.fiche.jourS', { v: miscastAmountLabel(o.durationDays) });
      const qui = o.pick === 'all' ? tr('codex.fiche.toutes') : tr('codex.fiche.uneTireeAuHasard');
      return { t: 'kv', k: tr('codex.fiche.competencesAssocieesAuDieu'), v: `${o.mod as number} (${qui} ; ${dur})` };
    }
    case 'deityBan':
      return { t: 'kv', k: tr('codex.fiche.benedictionsEtMiraclesDuDieu'), v: tr('codex.fiche.echouentJourS', { v: miscastAmountLabel(o.durationDays) }) };
    case 'prayerForAction':
      return { t: 'kv', k: tr('codex.fiche.action'), v: tr('codex.fiche.testDePriereImposeRoundS', { v: miscastAmountLabel(o.durationRounds) }) };
    default:
      return { t: 'text', text: String(o.op) };
  }
}

/** Section « Test imbriqué » d'une entrée miscast (« Résistance Accessible ou Sonné »), palier
 *  `onFailHard` inclus (« si vous échouez avec DR ≤ N → EN PLUS »). */
function miscastTestSection(t: NonNullable<MiscastRowEntry['test']>): CodexSection {
  const who = testSkillLabel(t.test) ?? tr('codex.fiche.test');
  const rows: CodexRow[] = [
    { t: 'kv', k: tr('codex.fiche.test'), v: `${who} ${DIFFICULTY_LABELS[t.test.difficulty!]}` },
    { t: 'sub', label: tr('codex.fiche.echec') },
    ...replieCausesPersistantes(t.onFail).map(miscastOpRow),
  ];
  if (t.onFailHard) rows.push({ t: 'sub', label: tr('codex.fiche.echecDr', { dr: t.onFailHard.dr }) }, ...replieCausesPersistantes(t.onFailHard.ops).map(miscastOpRow));
  return { title: tr('codex.fiche.testImbrique'), layout: 'list', rows };
}

/** Item Codex d'une entrée de table miscast (Incantation Imparfaite / Colère des dieux) — plage d100 →
 *  nom, effet immédiat (`ops`, dialecte) + Test imbriqué éventuel + relance (cascade/multiplication). */
function miscastRowItem(e: MiscastRowEntry, de: DeDeTable): CodexItem {
  return depuisEnveloppe(e, {
    sub: bandeAuDe(de, e.min, e.max),
    meta: facts(e.reroll ? fact(tr('codex.fiche.relance'), e.reroll === 'majeure' ? tr('codex.fiche.cascadeTableauMajeur') : tr('codex.fiche.multiplication2TiragesMineurs')) : null),
    sections: sections(
      e.ops?.length ? { title: tr('codex.fiche.effetImmediat'), layout: 'list', rows: replieCausesPersistantes(e.ops).map(miscastOpRow) } : null,
      e.targetOps?.length ? { title: tr('codex.fiche.effetSurLesCibles'), layout: 'list', rows: replieCausesPersistantes(e.targetOps).map(miscastOpRow) } : null,
      e.test ? miscastTestSection(e.test) : null,
    ),
  });
}

/** Portée d'un modificateur de Test/NI environnemental (Domaines/Vent dominant/Magie du Chaos/Sorts
 *  nommés…) → texte compact, liens Domaine/Sort résolus par `refLabel`. */
function phenomenonScopeLabel(scope: PhenomenonScope | CastingNumberScope | undefined): string | undefined {
  if (!scope) return undefined;
  const parts: (string | undefined)[] = [
    scope.domains?.length ? scope.domains.map((d) => refLabel('domains', { id: d })).join(', ') : undefined,
    scope.domainsExcept?.length ? tr('codex.fiche.hors', { v: scope.domainsExcept.map((d) => refLabel('domains', { id: d })).join(', ') }) : undefined,
    scope.chaosMagic ? tr('codex.fiche.magieDuChaos') : undefined,
    'dominantWinds' in scope && scope.dominantWinds ? tr('codex.fiche.ventSPredominantS') : undefined,
    'nonDominantWinds' in scope && scope.nonDominantWinds ? tr('codex.fiche.ventSNonPredominantS') : undefined,
    'spellIds' in scope && scope.spellIds?.length ? scope.spellIds.map((id) => refLabel('spells', { id })).join(', ') : undefined,
    'kinds' in scope && scope.kinds?.length ? scope.kinds.join('/') : undefined,
  ];
  const text = parts.filter(Boolean).join(' · ');
  return text || undefined;
}

/** Une rangée de Test (`PhenomenonTestMod`) → ligne Codex (Incantation/Focalisation +N DR, portée). */
function testModRow(m: PhenomenonTestMod): CodexRow {
  const tests = m.tests.map((t) => libelleDeValeur(phenomenonTestSchema, t)).join(' / ');
  const drText = m.drMax != null && m.drMax !== m.dr
    ? `${m.dr >= 0 ? '+' : ''}${m.dr}…${m.drMax >= 0 ? '+' : ''}${m.drMax} DR`
    : `${m.dr >= 0 ? '+' : ''}${m.dr} DR`;
  const v = [
    drText,
    m.drDie ? `1d${m.drDie.faces}/${m.drDie.divide}${m.drDie.perRound ? tr('codex.fiche.parRound') : ''}` : undefined,
    phenomenonScopeLabel(m.scope),
    m.windRestricted ? tr('codex.fiche.ventSDuSite') : undefined,
  ].filter(Boolean).join(' · ');
  return { t: 'kv', k: tests, v };
}

/** Une rangée de modificateur de Niveau d'Incantation (`CastingNumberMod`) → ligne Codex. */
function niModRow(m: CastingNumberMod): CodexRow {
  const bits = [
    m.multiply ? `×${m.multiply}` : undefined,
    m.divide ? `÷${m.divide}${m.round ? tr('codex.fiche.arrondi', { round: m.round }) : ''}` : undefined,
    m.delta ? `${m.delta >= 0 ? '+' : ''}${m.delta}` : undefined,
    m.min != null ? tr('codex.fiche.plancher', { min: m.min }) : undefined,
  ].filter(Boolean).join(' ');
  return { t: 'kv', k: tr('codex.fiche.niveauDIncantation'), v: [bits, phenomenonScopeLabel(m.scope)].filter(Boolean).join(' — ') };
}

/** Fait « Saturation environnementale » portée par un phénomène (`ArcanePhenomenon.saturation`). */
function phenomenonSaturationFact(s: ArcanePhenomenon['saturation']): CodexFact | null {
  if (!s) return null;
  const value = [
    s.levelsPerYear ? tr('codex.fiche.niveauAn', { v: s.levelsPerYear >= 0 ? '+' : '', levelsPerYear: s.levelsPerYear }) : undefined,
    s.levelsPerMonth ? tr('codex.fiche.niveauMois', { v: s.levelsPerMonth >= 0 ? '+' : '', levelsPerMonth: s.levelsPerMonth }) : undefined,
    s.levels ? tr('codex.fiche.niveauX', { v: s.levels >= 0 ? '+' : '', levels: s.levels }) : undefined,
    s.viaGrandVortex ? tr('codex.fiche.viaLeGrandVortex') : undefined,
    s.blocksPropagation ? tr('codex.fiche.bloqueLaPropagation') : undefined,
    s.preventsJonctionSaturee ? tr('codex.fiche.empecheLaJonctionSaturee') : undefined,
    s.whenOffLine ? tr('codex.fiche.siHorsLigneDeForce') : undefined,
  ].filter(Boolean).join(' · ');
  return fact(tr('codex.fiche.saturationEnvironnementale'), value || null);
}

/** Rangées d'une table du chapitre (`ArcaneTable.entries`, plage d100/d10 → libellé), Domaine(s) liés
 *  quand la rangée en désigne (Flux magique). */
function arcaneTableRows(t: ArcaneTable): CodexRow[] {
  return t.entries.map((r) => ({
    t: 'kv',
    k: fourchette(r.min, r.max, facesDuDe(deDeLaTableTiree(t))),
    v: [r.label, r.domainIds?.length ? `(${r.domainIds.map((d) => refLabel('domains', { id: d })).join(', ')})` : undefined].filter(Boolean).join(' '),
  } as CodexRow));
}

/**
 * CORPS AFFICHÉ d'une dépense de ressource (`characteristics.options`). La DONNÉE reste le VERBATIM
 * recollable de la Source, puce de liste comprise (« - **Je te renie ! :** … », règle 5) : c'est
 * l'AFFICHAGE qui retire ce que le sous-en-tête dit DÉJÀ — la puce orpheline et le libellé répété.
 * Retrait STRUCTUREL (le préfixe est reconnu depuis le `label` de l'option, jamais réécrit) : une
 * option dont le verbatim ne commence pas par son nom est rendue telle quelle.
 */
export function optionBody(o: { label: string; desc: string }): string {
  const sansPuce = o.desc.replace(/^\s*[-*]\s+/, '');
  const echappe = o.label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return sansPuce.replace(new RegExp(`^\\*\\*${echappe}\\s*:\\*\\*\\s*`), '');
}

/** La fiche d'une table tirée dont chaque rangée désigne une entrée de `category` à sa fourchette, au dé que porte `porteurDuDe`. */
function ficheDeTableDeRefs(t: (typeof talentsAleatoires | typeof carrieresAleatoires | typeof especesAleatoires | typeof cargaisonsAleatoires)[number], porteurDuDe: PorteurDeDe, category: string, libelle: (id: string) => string) {
  return depuisEnveloppe(t, {
    sub: tr('codex.fiche.plages', { length: t.entries.length, die: porteurDuDe.die }),
    sections: sections({
      title: tr('codex.fiche.tirages'), layout: 'list',
      rows: t.entries.map((r) => {
        const label = libelle(r.id);
        return { t: 'ref', category, id: r.id, label, show: label, badge: bandeAuDe(deDeLaTableTiree(porteurDuDe), r.min, r.max) } as CodexRow;
      }),
    }),
  });
}

const CODEX_SPECS = {
  arcanePhenomena: {
    label: 'codex.fiche.magieEnvironnementale', group: 'magie', sourceRef: 'VDM 14',
    build: () => {
      const d = datasetObject('arcanePhenomena') as {
        saturationLevels: SaturationLevel[]; windSaturationEffects: WindSaturationEffects[];
        phenomena: ArcanePhenomenon[]; tables: ArcaneTable[];
      };
      return [
        ...[...d.saturationLevels].sort((a, b) => a.order - b.order).map((l) => depuisEnveloppe(l, {
          group: tr('codex.fiche.paliersDeSaturation'),
          meta: facts(
            fact(tr('codex.fiche.effetsDeSaturation'), fourchette(l.effectsMin, l.effectsMax)),
            fact(tr('codex.fiche.peutSeCorrompre'), l.corrupts ? 'oui (Geheimnisnacht/Hexensnacht)' : null),
          ),
          sections: l.testMods?.length ? sections({ title: tr('codex.fiche.modificateursDeTest'), layout: 'list', rows: l.testMods.map(testModRow) }) : undefined,
        })),
        ...d.windSaturationEffects.map((w) => depuisEnveloppe({ ...w, label: `${w.wind} — ${refLabel('domains', w.domainId)}` }, {
          group: tr('codex.fiche.effetsDeSaturationParVent'),
          sub: w.environments.join(', '),
          sections: sections(
            { title: tr('codex.fiche.effetsDeSaturation'), layout: 'list', rows: w.effects.map((e) => ({ t: 'kv', k: libelleDeValeur(saturationTierSchema, e.tier), v: e.label } as CodexRow)) },
            // Surnoms : des ÉTIQUETTES (un surnom par rangée), aucune entité désignée → pastille nue.
            w.surnoms.length ? { title: tr('codex.fiche.surnoms'), layout: 'chips', rows: w.surnoms.map((s) => ({ t: 'chip', label: s } as CodexRow)) } : null,
          ),
        })),
        ...d.phenomena.map((p) => depuisEnveloppe(p, {
          group: tr('codex.fiche.phenomenesArcaniques'), sub: libelleDeValeur(phenomenonKindSchema, p.kind),
          meta: facts(
            phenomenonSaturationFact(p.saturation),
            fact(tr('codex.fiche.influenceMalfaisante'), p.influenceMalveillante ? 'oui (WFJDR 236)' : null),
            fact(tr('codex.fiche.incantationCritique'), p.critOnTens ? tr('codex.fiche.deuxFoisPlusProbableDoubleOu') : null),
            fact(tr('codex.fiche.demonsInvoques'), p.daemonsDoubled ? tr('codex.fiche.nombreDouble') : null),
            fact(tr('codex.fiche.ventRefracte'), p.singleWind ? tr('codex.fiche.unSeulALaFois') : null),
            p.cancelsTraitId ? { label: tr('codex.fiche.annuleLeTrait'), value: refLabel('traits', p.cancelsTraitId), kref: { category: 'traits', id: p.cancelsTraitId.id, label: refLabel('traits', p.cancelsTraitId) } } : null,
            p.controlFlux ? fact(tr('codex.fiche.controleDuFlux'), tr('codex.fiche.testDeFocalisation', { v: DIFFICULTY_LABELS[p.controlFlux.difficulty as keyof typeof DIFFICULTY_LABELS] ?? p.controlFlux.difficulty })) : null,
            p.overcastPerSpell ? fact(tr('codex.fiche.surincantationParSort'), formatDice(p.overcastPerSpell.dice)) : null,
            p.stonePropertySlots ? fact(tr('codex.fiche.proprietesDePierreGardienne'), String(p.stonePropertySlots.max)) : null,
            p.draws ? fact(tr('codex.fiche.tirages'), String(p.draws)) : null,
          ),
          sections: sections(
            p.testMods?.length ? { title: tr('codex.fiche.modificateursDeTest'), layout: 'list', rows: p.testMods.map(testModRow) } : null,
            p.niMods?.length ? { title: tr('codex.fiche.modificateursDeNiveauDIncantation'), layout: 'list', rows: p.niMods.map(niModRow) } : null,
            p.tableId || p.fluxTableId
              ? {
                title: tr('codex.fiche.tableAssociee'), layout: 'list',
                rows: [p.tableId, p.fluxTableId].flatMap((r) => (r ? [r.id] : [])).map((id) => {
                  const t = d.tables.find((x) => x.id === id);
                  return { t: 'ref', category: 'arcanePhenomena', id, label: t?.label ?? id, show: t?.label ?? id } as CodexRow;
                }),
              }
              : null,
          ),
        })),
        ...d.tables.map((t) => depuisEnveloppe(t, {
          group: tr('codex.fiche.rubriqueTables'), sub: tr('codex.fiche.rangeeS', { length: t.entries.length, die: t.die }),
          sections: sections({ title: tr('codex.fiche.tirage', { die: t.die }), layout: 'list', rows: arcaneTableRows(t) }),
        })),
      ];
    },
  },
  advancementCosts: {
    label: 'codex.fiche.coutDesAugmentations', group: 'tables', cluster: 'codex.fiche.creationDePersonnage', sourceRef: 'LDB 07',
    build: () => datasetArray('advancementCosts').map((b) => depuisEnveloppe(b, {
      sub: tr('codex.fiche.augmentationsDejaAchetees'),
      meta: facts(fact(tr('codex.fiche.coutCaracteristique'), b.coutCarac), fact(tr('codex.fiche.coutCompetence'), b.coutCompetence)),
    })),
  },
  disponibilite: {
    label: 'codex.fiche.disponibiliteTroc', group: 'tables', sourceRef: 'LDB 59',
    build: () => {
      const d = datasetObject('disponibilite');
      return [{
        id: 'disponibilite', label: tr('codex.fiche.disponibiliteTrocFaireSonMarche'),
        source: src(d.dispoPct[0]?.source),
        sections: sections(dispoPctSection(d.dispoPct), barterRatiosSection(d.barterRatios)),
      }];
    },
  },
  sizes: {
    label: 'codex.fiche.taillesBarresParCategorie', group: 'tables', sourceRef: 'LDB 85',
    build: () => {
      const s = datasetObject('sizes');
      const cats = (Object.keys(SIZE_ORDER) as SizeCategory[]).sort((a, b) => SIZE_ORDER[a] - SIZE_ORDER[b]);
      const table = (title: string, t: Record<string, number>, fmt: (n: number) => string): CodexSection => ({
        title, layout: 'list',
        rows: cats.map((c) => ({ t: 'kv', k: SIZE_LABEL[c], v: fmt(t[c]) }) as CodexRow),
      });
      return [{
        id: 'sizes', label: tr('codex.fiche.taillesBarresParCategorie'),
        sections: sections(
          table(tr('codex.fiche.modificateurDAToucherAuTir'), s.rangedMod, (n) => (n > 0 ? `+${n}` : String(n))),
          table(tr('codex.fiche.encombrementOccupeABordSelonLa'), s.shipboardEnc, (n) => tr('codex.fiche.enc', { n: n })),
          table(tr('codex.fiche.empreinteDeGrilleParDefautCote'), s.footprintSide, (n) => tr('codex.fiche.caseS', { n: n, n2: n })),
        ),
      }];
    },
  },
  drivingMishap: {
    label: 'codex.fiche.accidentsDeConduiteDAttelage', group: 'tables', cluster: 'codex.fiche.voyageTerrestre', sourceRef: 'LDB 09',
    build: () => datasetArray('drivingMishap').map((e) => ({
      id: e.id, label: e.label, sub: bandeAuDe(deDeTirageDe<typeof accidents>(drivingMishapJson), e.min, e.max), desc: e.desc,
      meta: facts(fact(tr('codex.fiche.type'), libelleDeValeur(drivingMishapOutcomeSchema, e.outcome))),
    })),
  },
  drunkenness: {
    label: 'codex.fiche.ivresseTableau', group: 'tables', sourceRef: 'LDB 09',
    build: () => datasetArray('drunkenness').map((e) => ({
      id: e.id, label: e.label, sub: bandeAuDe(deDeTirageDe<typeof ivresse>(drunkennessJson), e.min, e.max), desc: e.desc,
      meta: facts(fact(tr('codex.fiche.type'), libelleDeValeur(drunkennessOutcomeSchema, e.outcome))),
      sections: sections(passiveSection(e.ops, tr('codex.fiche.effet'))),
    })),
  },
  encumbranceTiers: {
    label: 'codex.fiche.surchargePaliersDEncombrement', group: 'tables', sourceRef: 'LDB 61',
    build: () => datasetArray('encumbranceTiers').map((t) => ({
      id: t.id, label: t.label,
      meta: facts(
        fact(tr('codex.fiche.penaliteDeMouvement'), t.immobile ? tr('codex.fiche.immobilise') : (t.movePenalty ? tr('codex.fiche.plancher2', { movePenalty: t.movePenalty, moveFloor: t.moveFloor }) : tr('codex.fiche.aucune'))),
        fact(tr('codex.fiche.penaliteDAgilite'), t.agilityPenalty ? String(t.agilityPenalty) : null),
        fact(tr('codex.fiche.fatigueDeVoyageEtatsExtenue'), t.travelFatigue || null),
      ),
      source: src(t.source),
    })),
  },
  riverNavigation: {
    label: 'codex.fiche.navigationFluvialeVentChavirageEchouage', group: 'tables', cluster: 'codex.fiche.merRiviere', sourceRef: 'MSRC 7',
    build: () => {
      const n = datasetObject('riverNavigation');
      const forceLabel = new Map(n.windForces.entries.map((f) => [f.id, f.label]));
      const dirLabel = new Map(n.windDirections.entries.map((d) => [d.id, d.label]));
      const effectText = (e: { pourcentage?: number; derive?: boolean; louvoyage?: boolean; risqueDeChavirage?: boolean; risqueDeGreement?: boolean } | undefined): string => {
        if (!e) return '—';
        const parts: string[] = [];
        if (e.pourcentage != null) parts.push(tr('codex.riviere.vitesse', { pct: `${e.pourcentage > 0 ? '+' : ''}${e.pourcentage}` }));
        if (e.derive) parts.push(tr('codex.riviere.derive'));
        if (e.louvoyage) parts.push(tr('codex.riviere.louvoyer'));
        if (e.risqueDeChavirage) parts.push(tr('codex.riviere.chavirage'));
        if (e.risqueDeGreement) parts.push(tr('codex.riviere.greement'));
        return parts.join(' · ') || '—';
      };
      return [{
        id: 'riverNavigation', label: tr('codex.fiche.navigationFluviale'), source: src(n.source),
        meta: facts(
          fact(tr('codex.fiche.savoirVoiesFluviales'), `+${n.savoirVoiesFluvialesDR} DR`),
          fact(tr('codex.fiche.difficulteDeBase'), DIFFICULTY_LABELS[n.navBaseDifficulty]),
          fact(tr('codex.fiche.difficulteDeLouvoyer'), DIFFICULTY_LABELS[n.tackDifficulty]),
        ),
        sections: sections(
          {
            title: tr('codex.fiche.forceDuVent', { die: formatDice(deDeLaTableTiree(n.windForces)) }), layout: 'list',
            rows: n.windForces.entries.map((f) => ({ t: 'kv', k: fourchette(f.min, f.max, facesDuDe(deDeLaTableTiree(n.windForces))), v: f.label } as CodexRow)),
          },
          {
            title: tr('codex.fiche.directionDuVentRelativeAu', { die: formatDice(deDeLaTableTiree(n.windDirections)) }), layout: 'list',
            rows: n.windDirections.entries.map((d) => ({ t: 'kv', k: fourchette(d.min, d.max, facesDuDe(deDeLaTableTiree(n.windDirections))), v: d.label } as CodexRow)),
          },
          {
            title: tr('codex.fiche.effetDuVentForceDirection'), layout: 'list',
            rows: n.windForces.entries.flatMap((f) => n.windDirections.entries.map((d) => ({
              t: 'kv', k: `${forceLabel.get(f.id)} · ${dirLabel.get(d.id)}`, v: effectText(n.windEffect[f.id]?.[d.id as 'arriere' | 'cote' | 'contraire']),
            } as CodexRow))),
          },
          {
            title: tr('codex.fiche.chavirageTresFortDeCote'), layout: 'list',
            rows: [
              { t: 'kv', k: tr('codex.fiche.retirerLaVoile'), v: DIFFICULTY_LABELS[n.capsize.removeSailDifficulty] } as CodexRow,
              { t: 'kv', k: tr('codex.fiche.redresserParRound'), v: tr('codex.fiche.cumulatifParEchec', { v: DIFFICULTY_LABELS[n.capsize.rightDifficulty], v2: Math.abs(n.capsize.rightCumulativePenalty) }) } as CodexRow,
            ],
          },
          {
            title: tr('codex.fiche.autresDangers'), layout: 'list',
            rows: [
              { t: 'kv', k: tr('codex.fiche.horsDeControle'), v: tr('codex.fiche.navigation', { navPenalty: n.horsDeControle.navPenalty }) } as CodexRow,
              { t: 'kv', k: tr('codex.fiche.sEchouer'), v: tr('codex.fiche.degatsDeCoque', { hullDamage: n.echouage.hullDamage }) } as CodexRow,
              { t: 'kv', k: tr('codex.fiche.reparationTemporaire'), v: tr('codex.fiche.charpentierBlessures', { v: DIFFICULTY_LABELS[n.temporaryRepair.difficulty], charpentierPenalty: n.temporaryRepair.charpentierPenalty, v2: formatDice(n.temporaryRepair.woundsPerRepair.dice) }) } as CodexRow,
            ],
          },
        ),
      }];
    },
  },

  // ── LOT 3 #422 (FINAL) : les 3 dernières exemptions AUDIT ──
  grapple: {
    label: 'codex.fiche.empoignadeMecanique', group: 'tables', sourceRef: 'LDB 14',
    build: () => {
      const g = datasetObject('grapple');
      return [{
        id: 'grapple', label: tr('codex.fiche.empoignadeMecaniqueGameop'),
        source: src(g.source),
        sections: sections(
          passiveSection(g.init, tr('codex.fiche.aLaToucheEmpetre')),
          passiveSection(g.win.degats, tr('codex.fiche.testOpposeGagneInfligerDesDegats')),
          passiveSection(g.win.empetrer, tr('codex.fiche.testOpposeGagneEmpetrerDavantage')),
          passiveSection(g.win.liberer, tr('codex.fiche.testOpposeGagneSeLiberer')),
        ),
      }];
    },
  },
  imparfaiteMineure: {
    label: 'codex.fiche.incantationsImparfaitesMineures', group: 'magie', sourceRef: 'LDB 46',
    build: () => datasetArray('imparfaiteMineure').map((e) => miscastRowItem(e, miscastDie('miscast-mineure'))),
  },
  imparfaiteMajeure: {
    label: 'codex.fiche.incantationsImparfaitesMajeures', group: 'magie', sourceRef: 'LDB 46',
    build: () => datasetArray('imparfaiteMajeure').map((e) => miscastRowItem(e, miscastDie('miscast-majeure'))),
  },
  imparfaiteMineureVdm: {
    label: 'codex.fiche.incantationsImparfaitesMineuresVdm', group: 'magie', sourceRef: 'VDM 02',
    build: () => datasetArray('imparfaiteMineureVdm').map((e) => miscastRowItem(e, miscastDie('miscast-mineure-vdm'))),
  },
  imparfaiteMajeureVdm: {
    label: 'codex.fiche.incantationsImparfaitesMajeuresVdm', group: 'magie', sourceRef: 'VDM 02',
    build: () => datasetArray('imparfaiteMajeureVdm').map((e) => miscastRowItem(e, miscastDie('miscast-majeure-vdm'))),
  },
  colereDesDieux: {
    label: 'codex.fiche.colereDesDieux', group: 'magie', sourceRef: 'LDB 40',
    build: () => datasetArray('colereDesDieux').map((e) => miscastRowItem(e, miscastDie('miscast-colere'))),
  },
  stakes: {
    // Enjeux des jets de cascade (#1117, collection #1681), groupés par cascade.
    label: 'codex.fiche.enjeuxDeJet', group: 'tables', sourceRef: 'LDB 09/15/16/18/19/20/21/46/47/62/85 · AA 07 · MSRC 7 · MDG 09/12/13/14',
    build: () => datasetArray('stakes').map((e) => depuisEnveloppe(e, {
      group: valeurFR('stakes.json', 'cascade', e.cascade), desc: e.template, sections: sections(regleChips(e.rule)),
    })),
  },

  races: {
    label: 'codex.fiche.races', group: 'personnage',
    build: () => species.map((s) => ({
      id: s.id,
      label: s.label,
      group: family(s.label),
      desc: s.desc,
      source: src(s.source),
      meta: facts(fact(tr('codex.fiche.mouvement'), s.movement), fact(tr('codex.fiche.destin'), s.fate?.fate), fact(tr('codex.fiche.resilience'), s.fate?.resilience)),
      // Contenu = SOURCE UNIQUE partagée avec le créateur (plus de ré-implémentation divergente).
      tabs: raceFicheTabs(s),
    })),
  },
  careers: {
    // Les desc de Carrière (LDB 2) suivent la convention d'épigraphe WFRP : leurs couples
    // citation+attribution se rendent en carte-parchemin, à LEUR place dans le corps.
    label: 'codex.fiche.carrieres', group: 'personnage', exergues: true,
    build: () => careers.map((c) => {
      const levels = levelsForCareer(c.id);
      const className = libelleDeClasse(c.class.id);
      // Les 4 échelons réunis en UN onglet « Progression » (au lieu d'un onglet par niveau) → la
      // montée en Carrière se lit d'un trait ; la description flavor gagne en proéminence relative.
      const levelSections: CodexSection[] = levels.map((lv) => ({
        title: tr('codex.fiche.niveau', { level: lv.level, label: lv.label, status: lv.status }),
        layout: 'chips' as const,
        rows: [
          // Les Caractéristiques avancées sont des IDS (`CharKey` = id de `characteristics.json`) :
          // elles sortent en rangées de référence, jamais en phrase jointe re-appariée par libellé.
          ...(lv.characteristics.length ? [{ t: 'sub', label: tr('codex.fiche.caracteristiquesAvancees') } as CodexRow, ...charRefRows(lv.characteristics)] : []),
          ...(lv.skills.length ? [{ t: 'sub', label: tr('codex.fiche.competences') } as CodexRow, ...lv.skills.map((a) => advancementRow('skills', a))] : []),
          ...(lv.talents.length ? [{ t: 'sub', label: tr('codex.fiche.talents') } as CodexRow, ...lv.talents.map((a) => advancementRow('talents', a))] : []),
          ...(lv.trappings.length ? [{ t: 'sub', label: tr('codex.fiche.possessions') } as CodexRow, ...trappingRefRows(lv.trappings)] : []),
        ],
      }));
      return depuisEnveloppe(c, {
        sub: className, group: className,
        // Faits-clés en en-tête (comme les Races portent M/Destin/Résilience) : Classe + fourchette de Statut social.
        meta: facts(fact(tr('codex.fiche.classe'), className), fact(tr('codex.fiche.statut'), careerStatusRange(levels))),
        tabs: [
          ...(levelSections.length ? [{ title: tr('codex.fiche.progression'), sections: levelSections }] : []),
          ...reverseSections('careers', c.id).map((s) => ({ title: s.title, sections: [s] })), // Races y accédant
        ],
      });
    }),
  },
  characteristics: {
    label: 'codex.fiche.caracteristiques', group: 'personnage',
    build: () => characteristics.map((c) => depuisEnveloppe(c, {
      sub: c.abr,
      // Bonus de Caractéristique = chiffre des dizaines (LDB 03) — rappel sur les caracs à jet (d100).
      meta: c.nature === 'roll' ? facts(fact(tr('codex.fiche.bonus'), tr('codex.fiche.chiffreDesDizaines'))) : undefined,
      sections: sections(
        // DÉPENSES de la ressource (Résilience : ses deux choix) — la règle vit sur l'ENTITÉ qui la
        // porte (amendement A, #1117) ; `regles.json` ne garde que les règles de CADRE. Même forme
        // qu'une section dérivée d'un champ de donnée (`symptoms.onTick`) : un sous-en-tête par
        // option, son verbatim dessous — DÉDOUBLONNÉ à l'AFFICHAGE par `optionBody`.
        c.options?.length
          ? {
            title: tr('codex.fiche.depenses'), layout: 'list' as const,
            // PORTEUR licite malgré le dédoublonnage : `optionBody` ne réécrit rien — il RETRANCHE le
            // libellé répété en tête, donc le rendu est un SOUS-TEXTE CONTIGU de `options[i].desc`.
            rows: c.options.flatMap((o, i) => [{ t: 'sub', label: o.label } as CodexRow, { t: 'text', text: optionBody(o), porteur: { chemin: `options[${i}].desc` } } as CodexRow]),
          }
          : null,
        ...reverseSections('characteristics', c.id),
      ),
    })),
  },
  classes: {
    label: 'codex.fiche.classes', group: 'personnage',
    build: () => classes.map((c) => depuisEnveloppe(c, {
      sections: sections(trappingChips(tr('codex.fiche.possessionsDeDepart'), c.trappings), ...reverseSections('classes', c.id)),
    })),
  },
  stars: {
    label: 'codex.fiche.etoiles', group: 'personnage',
    build: () => stars.map((s) => depuisEnveloppe(s, {
      sub: s.signe,
      meta: facts(fact(tr('codex.fiche.dates'), s.dates), fact(tr('codex.fiche.dieu'), s.dieux), fact(tr('codex.fiche.ascendant'), s.ascendant)),
      sections: sections(passiveSection(s.ops, tr('codex.fiche.effetDuSigne'))),
    })),
  },
  skills: {
    label: 'codex.fiche.competences', group: 'competences',
    build: () => skills.map((s) => depuisEnveloppe(s, {
      sub: join(CHAR_LABELS[s.characteristic], valeurFR('skills.json', 'acces', s.acces)),
      meta: facts(fact(tr('codex.fiche.caracteristique'), CHAR_LABELS[s.characteristic]), fact(tr('codex.fiche.acces'), valeurFR('skills.json', 'acces', s.acces)), fact(tr('codex.fiche.specialisations'), specsFact('skills', s))),
      sections: sections(...reverseSections('skills', s.id)),
    })),
  },
  talents: {
    label: 'codex.fiche.talents', group: 'competences',
    build: () => talents.map((t) => {
      // Entrée EFFECTIVE sous les règles optionnelles actives (#563/#564) : desc, source, Test, Max,
      // passifs et effets affichés sont ceux de la variante réglée quand elle est active.
      const e = effectiveEntry(t);
      return depuisEnveloppe(e, {
      meta: facts(fact(tr('codex.fiche.max'), talentMaxLabel(e.max)), fact(tr('codex.fiche.test'), e.test?.raw ?? null), fact(tr('codex.fiche.specialisations'), specsFact('talents', e))),
      sections: sections(
        careerGrantSection(e.passive), // Compétence/Talent ajouté à toute carrière (Maître artisan, Flagellant…)
        passiveSection(e.passive),
        effectsSection(e.effects, ETATS_DU_CODEX, tr('codex.fiche.effetsDeclenches')),
        ...reverseSections('talents', e.id), // Races · Carrières (rang) · Créatures · Talents le conférant
      ),
      });
    }),
  },
  axes: {
    label: 'codex.fiche.axesDeForces', group: 'competences',
    build: () => allAxes.map((a) => depuisEnveloppe(a, {
      meta: facts(fact(tr('codex.fiche.portee'), a.core ? tr('codex.fiche.socleDeBase') : tr('codex.fiche.axeDeScenario'))),
      sections: sections(
        a.skills?.length ? { title: tr('codex.fiche.competences'), layout: 'chips', rows: a.skills.map((r) => idRefRow('skills', r.id, r.spec)) } : null,
        a.talents?.length ? { title: tr('codex.fiche.talents'), layout: 'chips', rows: a.talents.map((r) => idRefRow('talents', r.id, r.spec)) } : null,
      ),
    })),
  },
  trappings: {
    label: 'codex.fiche.possessions', group: 'equipement',
    build: () => trappings.map((t) => {
      // Capacités FONCTIONNELLES (canal `capabilities`, lu PAR ID — ≠ nom FR) + arme dérivée tant qu'équipée.
      const caps = t.capabilities;
      const props = [
        caps?.weatherProtection ? tr('codex.fiche.protegeDesIntemperies') : null,
        caps?.isShelter ? tr('codex.fiche.abriDeCampement') : null,
        caps?.isRations ? tr('codex.fiche.rationDeVoyage') : null,
        caps?.isGrimoire ? tr('codex.fiche.grimoireLectureDeSorts') : null,
        caps?.preventForcedDrop ? tr('codex.fiche.empecheLeLacherForceGanteletVerrouille') : null,
        t.derivedWeapon ? tr('codex.fiche.armeDerivee', { label: t.derivedWeapon.label, v: damageString(t.derivedWeapon.damage) }) : null,
      ].filter(Boolean) as string[];
      // Allonge = mêlée, Portée = distance (LDB 62). Tir/munition : « Portée 50 m » (fixe) / « BF×3 m » (jet)
      // sinon le modificateur de munition (« Portée ×½ », `ammoRangeModLabel`) ; jamais « Allonge 50 ».
      const reachFact = (t.categorie === 'distance' || t.categorie === 'ammunition')
        ? fact(tr('codex.fiche.portee'), rangeSpecLabel(t.range) ?? ammoRangeModLabel(t.ammoRangeMod))
        : fact(tr('codex.fiche.allonge'), t.reach);
      return depuisEnveloppe(t, {
        sub: join(libelleDeValeur(trappingCategorieSchema, t.categorie), weaponGroupLabel(t.subType?.id) || undefined),
        meta: facts(fact(tr('codex.fiche.prix'), priceLabel(t.price)), fact(tr('codex.fiche.enc2'), t.enc), fact(tr('codex.fiche.disponibilite'), t.availability && libelleDeValeur(availabilitySchema, t.availability)), fact(tr('codex.fiche.emplacement'), t.loc), fact(tr('codex.fiche.degats'), damageFact(t)), fact('PA', t.pa), reachFact),
        sections: sections(
          chips(tr('codex.fiche.qualites'), resolveQualities({ qualities: t.qualities, subType: t.subType?.id }).map((r) => idRefRow('qualities', r.id, undefined, qualityRefLabel({ id: r.id, value: r.indice })))),
          props.length ? { title: tr('codex.fiche.proprietes'), layout: 'list', rows: [{ t: 'text', text: props.join(' · ') }] } : null,
          ...reverseSections('trappings', t.id),
        ),
      });
    }),
  },
  siegeEngines: {
    label: 'codex.fiche.enginsDeSiege', group: 'equipement',
    // Trappings d'un Groupe d'engins de siège, sélectionnés par `siegeEngines` comme dans la palette.
    build: () => siegeEngines().map((t) => depuisEnveloppe(t, {
      sub: join(libelleDeValeur(trappingCategorieSchema, t.categorie), weaponGroupLabel(t.subType?.id) || undefined),
      meta: facts(
        fact(tr('codex.fiche.prix'), priceLabel(t.price)), fact(tr('codex.fiche.enc2'), t.enc), fact(tr('codex.fiche.disponibilite'), t.availability && libelleDeValeur(availabilitySchema, t.availability)),
        fact(tr('codex.fiche.degats'), damageFact(t)), fact('PA', t.pa),
        fact(tr('codex.fiche.portee'), rangeSpecLabel(t.range) ?? ammoRangeModLabel(t.ammoRangeMod)),
      ),
      sections: sections(
        chips(tr('codex.fiche.qualites'), t.qualities.map((q) => idRefRow('qualities', q.id, undefined, qualityRefLabel(q)))),
        ...reverseSections('trappings', t.id),
      ),
    })),
  },
  weaponGroups: {
    label: 'codex.fiche.groupesDObjet', group: 'equipement',
    build: () => weaponGroups.map((g) => depuisEnveloppe(g, { sub: valeurFR('weaponGroups.json', 'kind', g.kind), sections: sections(...reverseSections('weaponGroups', g.id)) })),
  },
  qualities: {
    label: 'codex.fiche.qualites', group: 'equipement',
    build: () => qualities.map((q) => depuisEnveloppe(q, {
      sub: join(qualityTypeLabel(q.polarite), qualitySubtypeLabel(q.subType)),
      sections: sections(passiveSection(q.passive), effectsSection(q.effects, ETATS_DU_CODEX, tr('codex.fiche.effetsDeclenches')), ...reverseSections('qualities', q.id)),
    })),
  },
  etats: {
    label: 'codex.fiche.etats', group: 'effets',
    build: () => etats.map((e) => depuisEnveloppe(e, {
      sections: sections(...reverseSections('etats', e.id)), // Sorts/Traits/Qualités/Talents/Domaines l'infligeant
    })),
  },
  maladies: {
    label: 'codex.fiche.maladies', group: 'effets',
    build: () => maladies.map((m) => depuisEnveloppe(m, {
      sub: m.symptoms.map((s) => symptomLabel(s.symptomId)).join(', '),
      meta: facts(
        fact(tr('codex.fiche.contraction'), DIFFICULTY_LABELS[m.contractDifficulty]),
        fact(tr('codex.fiche.incubation'), formatDiseaseTime(m.incubation)),
        fact(tr('codex.fiche.duree'), formatDiseaseTime(m.duration)),
      ),
      sections: sections({
        title: tr('codex.fiche.symptomes'), layout: 'list',
        rows: m.symptoms.map((s) => ({
          // `spec` = localisation/précision imprimée de l'instance (« Gonflement (Visage et tête) », EDO 11 l.119).
          t: 'kv', k: `${symptomLabel(s.symptomId)}${s.spec ? ` (${s.spec})` : ''}`,
          v: [s.severity ? libelleDeValeur(symptomSeveritySchema, s.severity) : null, s.difficulty ? tr('codex.fiche.test2', { v: DIFFICULTY_LABELS[s.difficulty] }) : null].filter(Boolean).join(' · ') || '—',
        } as CodexRow)),
      }),
    })),
  },
  symptoms: {
    label: 'codex.fiche.symptomes', group: 'effets',
    build: () => symptoms.map((s) => depuisEnveloppe(s, {
      sections: sections(
        passiveSection(s.passive),
        ...SYMPTOM_SEVERITIES.map((cle) => passiveSection(s.passiveBySeverity?.[cle], tr('codex.fiche.modificateurs2', { v: libelleDeValeur(symptomSeveritySchema, cle) }))),
        s.onTick
          ? {
              title: tr('codex.fiche.cycleQuotidien'), layout: 'list',
              rows: [
                { t: 'kv', k: tr('codex.fiche.difficulte'), v: s.onTick.test?.test.difficulty ? DIFFICULTY_LABELS[s.onTick.test.test.difficulty] : tr('codex.fiche.inconditionnel') } as CodexRow,
                s.onTick.afterDays ? ({ t: 'kv', k: tr('codex.fiche.declenchement'), v: tr('codex.fiche.jourDePhaseActive', { v: s.onTick.once ? tr('codex.fiche.uneFoisAu') : tr('codex.fiche.aPartirDu'), afterDays: s.onTick.afterDays }) } as CodexRow) : null,
                // Conséquence : branche `echec` du nœud `test`, ou ops CERTAINES d'un cycle sans jet (ops
                // directes ou `rollTable` : table EXPANSÉE en rangées lisibles).
                ...opRows(s.onTick.test ? spellOps(s.onTick.test.echec, 'target') : (s.onTick.ops ?? [])),
              ].filter((r): r is CodexRow => r != null),
            }
          : null,
      ),
    })),
  },
  mutations: {
    label: 'codex.fiche.mutations', group: 'effets',
    build: () => mutations.map((m) => depuisEnveloppe(m, {
      sub: valeurFR('mutations.json', 'kind', m.kind),
      group: valeurFR('mutations.json', 'kind', m.kind),
      // PA / arme naturelle / traits conférés sont désormais des GameOps du `passive` (ap /
      // grantNaturalWeapon / grantTrait) → rendus par passiveSection ; plus de facts/chips dédiés.
      sections: sections(
        passiveSection(m.passive),
        ...reverseSections('mutations', m.id), // Tables de Corruption la tirant
      ),
    })),
  },
  mutationTables: {
    label: 'codex.fiche.tablesDeCorruption', group: 'effets',
    build: () => mutationTables.map((t) => depuisEnveloppe(t, {
      sub: tr('codex.fiche.plages', { length: t.entries.length, die: t.die }),
      // Tirage au dé de la table → Mutation : chaque plage est un lien cross-réf vers la fiche de mutation.
      sections: sections({
        title: tr('codex.fiche.tirageMutation', { die: formatDice(deDeLaTableTiree(t)) }), layout: 'list',
        rows: t.entries.map((r) => {
          const label = mutations.find((mu) => mu.id === r.mutation)?.label ?? r.mutation;
          return { t: 'ref', category: 'mutations', id: r.mutation, label, show: label, badge: fourchette(r.min, r.max, facesDuDe(deDeLaTableTiree(t))) } as CodexRow;
        }),
      }),
    })),
  },
  effectTables: {
    label: 'codex.fiche.tablesDEffets', group: 'effets',
    // Tables `[min,max] → GameOp[]` référencées par l'op `rollTable` (Allure démoniaque : Tableau des
    // aspects démoniaques par Domaine du Chaos). Chaque rangée = fourchette + ops (chips codex-liées).
    build: () => effectTables.map((t) => depuisEnveloppe(t, {
      sub: tr('codex.fiche.rangeeS', { length: t.entries.length, die: t.die }),
      sections: sections({ title: tr('codex.fiche.tirageEffet', { die: t.die }), layout: 'list', rows: tableRows(t) }),
    })),
  },
  maneuvers: {
    label: 'codex.fiche.manoeuvres', group: 'effets',
    // Une manœuvre est la PROJECTION mécanique d'un Trait de créature (#1226) : la prose affichée est le
    // VERBATIM du trait projetant (`traitProjectingManeuver`), jamais un résumé recopié dans la manœuvre.
    build: () => maneuvers.map((m) => depuisEnveloppe(m, {
      sub: libelleDeValeur(attackKindSchema, m.kind), desc: traitProjectingManeuver(m.id)?.desc,
      meta: facts(
        fact(tr('codex.fiche.activation'), valeurFR('maneuvers.json', 'activation', m.activation)),
        fact(tr('codex.fiche.coutAv'), m.coutEnAvantage),
        fact(tr('codex.fiche.portee'), m.range ? formatManeuverMeasure(m.range) : null),
        fact(tr('codex.fiche.cible'), valeurFR('maneuvers.json', 'ciblage', m.ciblage)),
      ),
      sections: sections(...reverseSections('maneuvers', m.id)),
    })),
  },
  psychologie: {
    label: 'codex.fiche.psychologie', group: 'effets',
    // Filtre DATA-DRIVEN des Traits à capacité psychologique (LDB 21, migration #1) : réutilise la
    // fiche de Trait (traitItem) — « Créatures ayant ce trait » montre QUI cause/possède la Psychologie.
    // Groupés par type (Peur, Terreur, Animosité…). Édition = catégorie « Traits » (source unique).
    build: () => traits
      .filter((t) => t.capabilities?.psychType || t.capabilities?.psychImmune)
      .map((t) => ({ ...traitItem(t), group: t.capabilities?.psychType ? psychologyLabel(t.capabilities.psychType) : tr('codex.fiche.immunite') })),
  },
  domains: {
    label: 'codex.fiche.domaines', group: 'magie',
    build: () => domains.map((d) => depuisEnveloppe(d, {
      meta: facts(
        fact(tr('codex.fiche.projectile'), d.missile ? tr('codex.fiche.ignoreLesPa', { v: d.missile.bypass === 'metal' ? tr('codex.fiche.metalliques') : tr('codex.fiche.nonMagiques'), v2: d.missile.bonusFromBypass ? tr('codex.fiche.degats2') : '' }) : null),
        fact(tr('codex.fiche.bonusDIncantation'), d.castBonus ? humanizeCastBonus(d.castBonus) : null),
        fact(tr('codex.fiche.postIncantation'), d.casterOps?.length ? tr('codex.fiche.opSAuLanceur', { length: d.casterOps.length }) : null),
      ),
      sections: sections(effectsSection(d.effects, ETATS_DU_CODEX, tr('codex.fiche.ridersALaTouche')), ...reverseSections('domains', d.id)),
    })),
  },
  spells: {
    label: 'codex.fiche.sorts', group: 'magie',
    // Entrée EFFECTIVE sous les règles optionnelles actives (#563/#564) : desc, source, NI, Durée et
    // effet mécanique affichés sont ceux de la variante réglée quand elle est active (VDM).
    build: () => spells.map((s0) => effectiveEntry(s0)).map((s) => depuisEnveloppe(s, {
      sub: join(s.ecole, s.subType),
      meta: facts(
        // Un Rituel dont la rubrique NI imprime une formule sur la cible (`VDM 02 l.379`) n'a pas
        // de nombre : c'est ce texte qui est le NI imprimé.
        fact('NI', withReduced(s.cn ?? s.ritual?.cnFrom, s.ritual?.reduced?.cn)),
        fact(tr('codex.fiche.pxDApprentissage'), withReduced(s.ritual?.xp, s.ritual?.reduced?.xp)),
        fact(tr('codex.fiche.portee'), s.range ? formatSpellRange(s.range) : null),
        fact(tr('codex.fiche.cible'), s.target ? formatSpellTarget(s.target) : null),
        fact(tr('codex.fiche.duree'), s.duration ? formatSpellDuration(s.duration) : null),
        // Projectile magique (#2 data-driven) : Dégâts additifs + DR + BFM, ignore éventuellement PA/BE.
        fact(tr('codex.fiche.origineVO'), s.titreVO ? join(s.titreVO, s.livreVO ? refLabel('books', s.livreVO) : null) : null),
        fact(tr('codex.fiche.projectile'), s.missile ? tr('codex.fiche.degatsDrBfm', { v: s.damage ? `${s.damage} + ` : '', v2: s.ignorePA ? tr('codex.fiche.ignorePa') : '', v3: s.ignoreBE ? tr('codex.fiche.ignoreBe') : '' }) : null),
      ),
      sections: sections(
        ritualSection(s.ritual), // Anatomie d'un Rituel (`VDM 02 l.377-393`)
        spellFlowSection(s.effects, ETATS_DU_CODEX), // Effet mécanique (Flow) — #5 data-driven
        ...reverseSections('spells', s.id), // Cultes (Bénédictions/Miracles) · Créatures · Domaine
      ),
    })),
  },
  gods: {
    label: 'codex.fiche.dieux', group: 'magie',
    build: () => gods.map((c) => depuisEnveloppe(c, {
      sub: c.title,
      sections: sections(
        chips(tr('codex.fiche.benedictions'), c.blessings.map((id) => idRefRow('spells', id))),
        chips(tr('codex.fiche.miracles'), c.miracles.map((id) => idRefRow('spells', id))),
        chips(tr('codex.fiche.sortsDuChaos'), (c.chaosSpells ?? []).map((id) => idRefRow('spells', id))),
        chips(tr('codex.fiche.competencesAssociees'), (c.associatedSkills ?? []).map((id) => idRefRow('skills', id))),
      ),
    })),
  },
  ventsTourbillonnants: {
    label: 'codex.fiche.ventsTourbillonnants', group: 'magie',
    // Option `vents-tourbillonnants` (LDB 46 l.179-190) : table de force des Vents, ajoutée
    // aux Tests d'Incantation/Focalisation (`engine/windsOfMagic.ts`).
    build: () => windsOfMagicTable.map((e) => ({
      id: e.id, label: e.label, sub: bandeAuDe(deDeTirageDe<typeof vents>(ventsJson), e.min, e.max),
      meta: facts(fact(tr('codex.fiche.modificateur'), e.mod >= 0 ? `+${e.mod}` : `${e.mod}`)),
    })),
  },
  creatures: {
    label: 'codex.fiche.creatures', group: 'monde',
    build: () => creatures.map((c) => depuisEnveloppe(c, {
      sub: c.title ?? undefined, group: c.folder ?? undefined,
      statblock: creatureStatblock(c),
      meta: facts(
        // pastille d'en-tête TOUJOURS visible : marque l'individu nommé (lu via `isNamed`, jamais via `title`).
        isNamed(c) ? fact(tr('codex.fiche.type'), tr('codex.fiche.individuNomme')) : null,
        c.harvest ? fact(tr('codex.fiche.recolte1Enc'), formatMoney(costPerEnc(c.harvest))) : null,
      ),
      sections: sections(
        { title: tr('codex.fiche.caracteristiques'), layout: 'grid', rows: kvRows(Object.entries(c.char)) },
        chips(tr('codex.fiche.traits'), traitRefRows(c.traits)),
        chips(tr('codex.fiche.traitsOptionnels'), (c.optionals ?? []).map((e) => (isOptionalNote(e) ? { t: 'chip', label: e.label } as CodexRow : idRefRow('traits', e.id, undefined, traitLisible(e))))),
        chips(tr('codex.fiche.competences'), c.skills.map((r) => idRefRow('skills', r.id, r.spec, skillRefLabel(r)))),
        chips(tr('codex.fiche.talents'), c.talents.map((r) => idRefRow('talents', r.id, r.spec, talentRefLabel(r)))),
        chips(tr('codex.fiche.sorts'), c.spells.map((id) => idRefRow('spells', id))),
        trappingChips(tr('codex.fiche.possessions'), c.trappings),
        c.harvest
          ? {
              title: tr('codex.fiche.recoltePrecieusesEntrailles'),
              layout: 'list',
              rows: [
                { t: 'kv', k: tr('codex.fiche.rarete'), v: libelleDeValeur(harvestRaritySchema, c.harvest.rarity) },
                { t: 'kv', k: tr('codex.fiche.dangerosite'), v: libelleDeValeur(harvestDangerSchema, c.harvest.danger) },
                { t: 'kv', k: tr('codex.fiche.valeur1EncConserve'), v: formatMoney(costPerEnc(c.harvest)) },
                { t: 'text', text: c.harvest.uses, porteur: { chemin: 'harvest.uses' } },
              ],
            }
          : null,
      ),
    })),
  },
  traits: {
    label: 'codex.fiche.traits', group: 'monde',
    build: () => traits.map((t) => traitItem(t)),
  },
  locations: {
    label: 'codex.fiche.lieux', group: 'monde',
    // `parent` résolu en libellé pour l'affichage ; la réf inverse « Sous-lieux » clé par id.
    build: () => locations.map((l) => {
      const parentLabel = findLocationById(l.parent?.id)?.label;
      return depuisEnveloppe(l, {
        sub: parentLabel, group: parentLabel,
        sections: sections(...reverseSections('locations', l.id)),
      });
    }),
  },
  books: {
    label: 'codex.fiche.livres', group: 'monde',
    // Fiche Livre : « contenu, par type » (index `bookContents`) projeté DANS le build (paresseux).
    // Les entités référencent leur livre par son ABBR (`source.book`) → match sur abbr + libellé ;
    // `categoryByKey(...)?.label` ne lit que l'identité STATIQUE des catégories (pas leurs items :
    // aucun cycle de projection).
    build: () => books.map((b) => ({
      id: b.id, label: b.label, sub: b.abbr ?? b.folder ?? undefined, group: b.folder ?? undefined, desc: b.desc ?? undefined,
      sections: bookContents(b.id).map((g) => ({
        title: categoryByKey(g.category)?.label ?? g.category,
        layout: 'chips' as const,
        rows: g.entries.map((e) => ({ t: 'ref', category: g.category, id: e.id, label: e.label, show: e.label } as CodexRow)),
      })),
    })),
  },
  // ── Tables & gabarits éditables (E3a) ─────────────────────────────────────────
  careerLevels: {
    label: 'codex.fiche.niveauxDeCarriere', group: 'tables',
    // Le `label` reste composé par `entryKey` (même composition côté éditeur `CodexEdit`) : un même
    // libellé de niveau sert plusieurs carrières, il n'identifie rien à lui seul. L'`id`, lui, est
    // celui de la DONNÉE (#1467 L1b V-P1) — le registre ne recompose plus d'identité.
    build: () => careerLevels.map((lv) => depuisEnveloppe(lv, {
      label: entryKey(lv as unknown as Record<string, unknown>),
      sub: lv.status, group: findCareerById(lv.career.id)?.label ?? lv.career.id,
      sections: sections(
        lv.characteristics.length ? { title: tr('codex.fiche.caracteristiquesAvancees'), layout: 'chips', rows: charRefRows(lv.characteristics) } : null,
        chips(tr('codex.fiche.competences'), lv.skills.map((a) => advancementRow('skills', a))),
        chips(tr('codex.fiche.talents'), lv.talents.map((a) => advancementRow('talents', a))),
        trappingChips(tr('codex.fiche.possessions'), lv.trappings),
      ),
    })),
  },
  eyes: {
    label: 'codex.fiche.couleurDesYeux', group: 'tables', cluster: 'codex.fiche.creationDePersonnage',
    build: () => couleursDuTableau(tableDesYeux, eyesDie()),
  },
  hairs: {
    label: 'codex.fiche.couleurDesCheveux', group: 'tables', cluster: 'codex.fiche.creationDePersonnage',
    build: () => couleursDuTableau(tableDesCheveux, hairsDie()),
  },
  calendarMonths: {
    label: 'codex.fiche.calendrierMois', group: 'tables', cluster: 'codex.fiche.calendrier',
    build: () => calendarMonths.map((m) => depuisEnveloppe(m, { sub: tr('codex.fiche.jours', { days: m.days }) })),
  },
  calendarIntercalary: {
    label: 'codex.fiche.calendrierJoursIntercalaires', group: 'tables', cluster: 'codex.fiche.calendrier',
    build: () => calendarIntercalary.map((i) => depuisEnveloppe(i, {
      sub: i.afterMonth < 0 ? tr('codex.fiche.avantLe1Mois') : tr('codex.fiche.apres', { v: libelleOuAbsence(calendarMonths[i.afterMonth], 'mois', String(i.afterMonth)) }),
    })),
  },
  calendarWeekdays: {
    label: 'codex.fiche.calendrierJoursDeLaSemaine', group: 'tables', cluster: 'codex.fiche.calendrier',
    build: () => calendarWeekdays.map((w) => depuisEnveloppe(w)),
  },
  calendarPhases: {
    label: 'codex.fiche.calendrierPhasesDuJour', group: 'tables', cluster: 'codex.fiche.calendrier',
    build: () => calendarPhases.map((p) => ({
      id: p.id, label: p.label, // `p.icon` = id d'icône (time/*, registre src/data/icons), plus un glyphe affichable en préfixe

      sub: tr('codex.fiche.des', { v: String(Math.floor(p.seuil / 60)).padStart(2, '0'), v2: String(p.seuil % 60).padStart(2, '0') }),
    })),
  },
  weather: {
    label: 'codex.fiche.meteoDeVoyage', group: 'tables', cluster: 'codex.fiche.voyageTerrestre',
    build: () => weather.map((s) => depuisEnveloppe(s, { sub: tr('codex.fiche.plagesEdoc8', { length: s.entries.length, die: s.die }) })),
  },
  weatherConditions: {
    label: 'codex.fiche.conditionsMeteo', group: 'tables', cluster: 'codex.fiche.voyageTerrestre',
    // Effets par condition (EDOC 8) — cible Codex des chips « Météo : … » des lignes de jet
    // (`engine/weatherTestMod.ts`, `noyau/combatFlow.ts`, `noyau/travelPostes.ts`).
    build: () => weatherConditions.map((c) => ({
      id: c.id, label: c.label, desc: c.desc, source: src(c.source),
      meta: facts(
        fact(tr('codex.fiche.visibilite'), c.visibiliteM != null ? `${c.visibiliteM} m` : null),
        fact(tr('codex.fiche.armesADistance'), c.rangedUseless ? tr('codex.fiche.inutilisables') : c.rangedMod != null ? String(c.rangedMod) : null),
        fact(tr('codex.fiche.testsPhysiques'), c.physicalTestMod != null ? String(c.physicalTestMod) : null),
        fact(tr('codex.fiche.mouvement'), c.movementWalkOnly ? tr('codex.fiche.marcheSeulement') : null),
        fact(tr('codex.fiche.poudreExposee'), c.powderUseless ? tr('codex.fiche.inutilisable') : null),
      ),
    })),
  },
  raceAppearance: {
    label: 'codex.fiche.apparences', group: 'tables', cluster: 'codex.fiche.creationDePersonnage',
    build: () => raceAppearance.map((r) => ({ id: r.id, label: r.label })),
  },
  pregens: {
    label: 'codex.fiche.preTires', group: 'tables', cluster: 'codex.fiche.creationDePersonnage',
    build: () => pregens.map((p) => {
      const actuelle = garanti(carriereActuelle({ carrieres: p.carrieres }), p.id, 'carrière actuelle du pré-tiré');
      return depuisEnveloppe(p, {
        sub: join(findSpeciesById(p.species.id)?.label ?? p.species.id, careerLabelFor({ career: actuelle.id, appearance: { sex: p.sex } }), tr('codex.fiche.niveau2', { level: actuelle.niveau })),
        meta: facts(fact(tr('codex.fiche.motivation'), p.motivation)),
      });
    }),
  },
  oups: {
    label: 'codex.fiche.oups', group: 'tables',
    // Le `label` EST le texte du résultat → on le garde tel quel ;
    // on enrichit par le TYPE d'effet (kind) en méta.
    build: () => oups.map((o) => {
      const range = 'min' in o ? bandeAuDe(oupsDie(), o.min, o.max) : tr('codex.fiche.horsTableArmeAPoudreNoire');
      return depuisEnveloppe(o, {
        sub: range,
        meta: facts(fact(tr('codex.fiche.type'), valeurFR('oups.json', 'kind', o.kind))),
      });
    }),
  },
  interludeEvents: {
    label: 'codex.fiche.entreDeuxAventures', group: 'tables',
    build: () => interludeEvents.map((e) => depuisEnveloppe(e, { sub: bandeAuDe(interludeEventDie(), e.min, e.max) })),
  },
  peripeties: {
    label: 'codex.fiche.peripetiesDeVoyage', group: 'tables', cluster: 'codex.fiche.voyageTerrestre',
    build: () => peripeties.map((p) => depuisEnveloppe(p, { sub: `${bandeAuDe(peripetieDie(), p.roll, p.roll)} · ${p.kind}` })),
  },
  activities: {
    label: 'codex.fiche.activites', group: 'tables',
    // Catalogue UNIQUE des Activités (interlude LDB 23 / voyage EDOC 8 / mer MDG 15 / bataille de
    // masse ADE II 8). Un Test « posté » (Tests au choix, chacun avec sa Difficulté) dont l'issue s'exprime
    // en `onSuccess` (GameOp) et/ou en bandes `outcomes` (table DR → résultat, verbatim + effets).
    build: () => ACTIVITIES.map((a) => depuisEnveloppe(a, {
      sub: a.contexts.map((c) => valeurFR('activities.json', 'contexts', c)).join(', '),
      meta: facts(
        fact(tr('codex.fiche.contextes'), a.contexts.map((c) => valeurFR('activities.json', 'contexts', c)).join(', ')),
        fact(tr('codex.fiche.testsAuChoix'), a.tests?.length
          ? a.tests.map((o) => [testSkillLabel(o), o.difficulty && DIFFICULTY_LABELS[o.difficulty]].filter(Boolean).join(' ')).join(' / ')
          : null),
        fact(tr('codex.fiche.difficulte'), a.difficulty ? DIFFICULTY_LABELS[a.difficulty] : null),
        fact(tr('codex.fiche.testEtendu'), a.extended ? tr('codex.fiche.drEtape', { drPerStage: a.extended.drPerStage }) : null),
        fact(tr('codex.fiche.resolveur'), a.resolver ?? null),
      ),
      sections: sections(
        chips(tr('codex.fiche.testsAuChoixListe'), testsDeLActivite(a).flatMap((t) => (t.skill ? [idRefRow('skills', t.skill.id, t.skill.spec)] : charRefRows([t.characteristic])))),
        chips(tr('codex.fiche.competenceLibre'), (a.freeSkill ?? []).map((s) => idRefRow('skills', s.id, s.spec))),
        passiveSection(a.onSuccess, tr('codex.fiche.effetDeReussite')),
        outcomeBandsSection(a.outcomes),
        regleChips(a.rule),
      ),
    })),
  },
  // ── Combat de masse / Puissance de Bataille (ADE II 8, #148) — 5 tables verbatim NICHÉES dans
  // UN seul fichier (`mass-battle.json`, moteur `engine/massBattle.ts`). Champs déjà imprimés en
  // STRINGS par la source (prix/portée/dégâts/atouts) → faits bruts (`fact`), pas de cross-réf chips :
  // les libellés d'Atouts imprimés ici (« Explosion 15 », « Impénétrable »…) ne correspondent PAS
  // toujours tels quels aux libellés canoniques de `qualities`/`traits` (ex. qualité « À Explosion » vs
  // « Explosion » ici, trait « Impénétrable (structure) » vs « Impénétrable » ici) — une décomposition
  // par id resterait à faire côté donnée (hors périmètre #148, ne pas inventer un rapprochement flou). ──
  massBattlePowerEstimate: {
    label: 'codex.fiche.batailleDeMasseEstimationDePuissance', group: 'tables', cluster: 'codex.fiche.batailleDeMasse',
    build: () => POWER_ESTIMATE.map((p) => depuisEnveloppe(p, {
      meta: facts(fact(tr('codex.fiche.puissanceAlliee'), p.allie), fact(tr('codex.fiche.puissanceEnnemie'), p.ennemi)),
      desc: p.example,
    })),
  },
  massBattleMightModifiers: {
    label: 'codex.fiche.batailleDeMasseModificateursDePuissance', group: 'tables', cluster: 'codex.fiche.batailleDeMasse',
    build: () => MIGHT_MODIFIERS.map((m) => depuisEnveloppe(m, {
      meta: facts(fact(tr('codex.fiche.modificateur'), m.mod > 0 ? `+${m.mod}` : String(m.mod))),
      desc: m.example,
    })),
  },
  massBattleWarMachines: {
    label: 'codex.fiche.batailleDeMasseMachinesDeGuerre', group: 'tables', cluster: 'codex.fiche.batailleDeMasse',
    build: () => WAR_MACHINES.map((w) => depuisEnveloppe(w, {
      meta: facts(
        fact(tr('codex.fiche.prix'), formatMoney(w.price)), fact(tr('codex.fiche.equipe'), w.crew), fact(tr('codex.fiche.disponibilite'), libelleDeValeur(availabilitySchema, w.availability)),
        fact(tr('codex.fiche.portee'), w.range), fact(tr('codex.fiche.degats'), w.damage), fact(tr('codex.fiche.atouts'), w.traits),
      ),
    })),
  },
  massBattleStructures: {
    label: 'codex.fiche.batailleDeMasseStructures', group: 'tables', cluster: 'codex.fiche.batailleDeMasse',
    build: () => MASS_BATTLE_STRUCTURES.map((s) => depuisEnveloppe(s, {
      meta: facts(fact('BE', s.be), fact(tr('codex.fiche.blessures'), s.wounds), fact(tr('codex.fiche.atouts'), s.traits)),
    })),
  },
  massBattleHazards: {
    label: 'codex.fiche.batailleDeMasseAleasDeBataille', group: 'tables', cluster: 'codex.fiche.batailleDeMasse',
    build: () => BATTLE_HAZARDS.map((h) => depuisEnveloppe(h, { sub: bandeAuDe(massBattleHazardsDie(), h.min, h.max) })),
  },
  // ── Datasets-OBJETS uniques (E3b) : config de création (objet) + banque de noms (Record par race) ──
  details: {
    label: 'codex.fiche.detailsDeCreation', group: 'tables', cluster: 'codex.fiche.creationDePersonnage', sourceRef: 'LDB 05',
    // UNE seule entrée (objet `details.json`) — formules Âge/Taille par espèce + textes d'aide.
    build: () => [{
      id: 'details', label: tr('codex.fiche.detailsDeCreation'),
      sections: sections({
        title: tr('codex.fiche.jetsDAgeDeTaille'), layout: 'list',
        rows: (Object.keys(details.age) as RaceKey[]).map((sp) => ({
          t: 'kv', k: sp,
          v: tr('codex.fiche.ageTailleCm', { v: formatDice(details.age[sp]), v2: formatDice(details.taille[sp]) }),
        } as CodexRow)),
      }),
    }],
  },
  semencesDeScene: {
    label: 'codex.fiche.semencesDeScene', group: 'tables',
    // UNE seule entrée (objet `semences-de-scene.json`) — ce qu'une scène NEUVE reçoit à sa création
    // (`emptyScene`, `noyau/monde/scene.ts`). Les valeurs s'ÉDITENT ici (atelier, `edit.object: 'single'`).
    build: () => [{
      id: 'semences-de-scene', label: tr('codex.fiche.semencesDeScene'),
      sections: sections({
        title: tr('codex.fiche.ceQuUneSceneNeuveRecoit'), layout: 'list',
        rows: [
          { t: 'kv', k: tr('codex.fiche.ambiance'), v: semencesDeScene.ambiance },
          { t: 'kv', k: tr('codex.fiche.metresParCase'), v: `${semencesDeScene.metresPerTile} m` },
          // Absent = `auto` : l’éclairage suit l’horloge (même convention que `Scene.ambientLight`).
          { t: 'kv', k: tr('codex.fiche.eclairage'), v: semencesDeScene.ambientLight ?? tr('codex.fiche.automatiqueSuitLHorloge') },
          { t: 'kv', k: tr('codex.fiche.solDeDepart'), v: refLabel('terrains', semencesDeScene.terrain) },
          { t: 'kv', k: tr('codex.fiche.matieresDeRelief'), v: Object.entries(semencesDeScene.reliefDefaults).map(([part, mat]) => `${libelleDuChamp(part, { noeud: reliefDefaultsSchema, niveau: 'profondeur' })} : ${matiereLabel(mat.id)}`).join(' · ') },
          { t: 'kv', k: tr('codex.fiche.toiture'), v: tr('codex.fiche.combleEtageS', { material: matiereLabel(semencesDeScene.roofDefaults.material.id), pitchDeg: semencesDeScene.roofDefaults.pitchDeg, riseMaxStoreys: semencesDeScene.roofDefaults.riseMaxStoreys }) },
        ],
      }),
    }],
  },
  defautsDeCompilation: {
    label: 'codex.fiche.defautsDeCompilation', group: 'tables',
    // UNE seule entrée (objet `defauts-de-compilation.json`) — ce que le compilateur de scène pose
    // quand l'auteur laisse le terrain implicite (`noyau/mapSpec.ts`). Éditable ici (`edit.object: 'single'`).
    build: () => [{
      id: 'defauts-de-compilation', label: tr('codex.fiche.defautsDeCompilation'),
      sections: sections({
        title: tr('codex.fiche.ceQueLeCompilateurPoseA'), layout: 'list',
        rows: [
          { t: 'kv', k: tr('codex.fiche.cheminDeRonde'), v: refLabel('terrains', defautsDeCompilation.cheminDeRonde) },
          { t: 'kv', k: tr('codex.fiche.masseDUnMurPlein'), v: refLabel('terrains', defautsDeCompilation.masse) },
          { t: 'kv', k: tr('codex.fiche.pontDeNavire'), v: refLabel('terrains', defautsDeCompilation.pont) },
        ],
      }),
    }],
  },
  names: {
    label: 'codex.fiche.banqueDeNoms', group: 'tables', cluster: 'codex.fiche.creationDePersonnage',
    // LISTE de documents (#1467 L1b V-FLIP-RECORD) : chaque banque porte SON id (le `RaceKey`) et SON
    // libellé — l'affichage se lit sur le document, sans lookup transverse.
    build: () => names.map((pool) => ({
      id: pool.id, label: pool.label,
      sub: tr('codex.fiche.noms2', { length: pool.maleFirstNames.length, length2: pool.femaleFirstNames.length, length3: pool.lastNames.length }),
      sections: sections(
        // RESTE ASSUMÉ : une rangée porte la LISTE entière (`join(', ')`), pas un nom — en pastille
        // elle ferait une pastille géante. Éclater la donnée en une pastille par nom est un chantier
        // de DONNÉES, hors #1392 Lot E.
        pool.maleFirstNames.length ? { title: tr('codex.fiche.prenomsMasculins'), layout: 'chips', rows: [{ t: 'text', text: pool.maleFirstNames.join(', ') }] } : null,
        pool.femaleFirstNames.length ? { title: tr('codex.fiche.prenomsFeminins'), layout: 'chips', rows: [{ t: 'text', text: pool.femaleFirstNames.join(', ') }] } : null,
        pool.lastNames.length ? { title: tr('codex.fiche.nomsDeFamille'), layout: 'chips', rows: [{ t: 'text', text: pool.lastNames.join(', ') }] } : null,
      ),
    })),
  },
  // ── #157 : catalogues de CONTENU app-owned (façade ou module dédié) exposés au Codex. ──
  structures: {
    label: 'codex.fiche.structuresSiege', group: 'monde',
    build: () => structures.map((s) => depuisEnveloppe(s, {
      sub: s.kind === 'porte' ? tr('codex.fiche.porte') : tr('codex.fiche.mur'),
      meta: facts(
        fact('BE', s.char.BE), fact(tr('codex.fiche.blessures'), s.char.B), fact(tr('codex.fiche.fortifiee'), s.fortified ? tr('codex.fiche.oui') : null),
      ),
      sections: sections(chips(tr('codex.fiche.atouts'), traitRefRows(s.traits as unknown as TraitList))),
    })),
  },
  materials: {
    // Matières du monde (#1686) : UN document à DISCRIMINANT (`domain`) — le groupe, le sous-titre et
    // les champs affichés découlent de la valeur du discriminant, par le canal registre. Aucune table
    // de libellés ni de clés ici : l'enum NOMMÉ du nœud `domain` nomme les domaines, `chargeDiscriminee` dit ce
    // que porte le domaine d'une entrée, `libelleDuChamp` nomme chaque champ.
    label: 'codex.fiche.matieres', group: 'monde',
    build: () => {
      const meta = metaPourFichier('materials.json');
      return materials.map((m) => {
        const domaine = valeurFR('materials.json', 'domain', m.domain);
        const entree = m as unknown as Record<string, unknown>;
        const charge = chargeDiscriminee('materials.json', entree)?.duCas ?? [];
        return depuisEnveloppe(m, {
          group: domaine,
          sub: domaine,
          meta: facts(...charge.map((cle) => fact(libelleDuChamp(cle, { meta }), valeurDeCharge(entree[cle])))),
        });
      });
    },
  },
  terrains: {
    // Sols de la grille (#1690) : UNE forme sans discriminant — chaque entrée porte les mêmes clés de
    // RÈGLE (franchissabilité, précédence de raccord, blocage de la vue, surface bâtie, hauteur du bloc
    // plein) et les mêmes clés de RENDU (teinte, rampe, décor posé). Aucune table de libellés ici : les
    // noms FR viennent de la méta du def (`libelleDuChamp`), l'ordre des arrêts de rampe de la source
    // unique `terrainStopsOrdonnes`, et le nom du décor posé de l'entrée `props.json` qu'il référence.
    label: 'codex.fiche.terrains', group: 'monde',
    build: () => {
      const meta = metaPourFichier('terrains.json');
      const nom = (cle: string) => libelleDuChamp(cle, { meta });
      return terrains.map((t) => depuisEnveloppe(t, {
        meta: facts(
          // `walkable` se dit dans les DEUX sens : un sol infranchissable est le fait le plus lourd de
          // la fiche, d'où la valeur écrite ici ('oui'/'non') plutôt que `valeurDeCharge`, qui tait un
          // booléen faux.
          fact(nom('walkable'), t.walkable ? tr('codex.fiche.oui') : tr('codex.fiche.non')),
          fact(nom('priority'), t.priority),
          fact(nom('opaque'), t.opaque ? tr('codex.fiche.oui') : null),
          fact(nom('built'), t.built ? tr('codex.fiche.oui') : null),
          fact(nom('solidHeightM'), t.solidHeightM != null ? `${t.solidHeightM} m` : null),
          fact(nom('matiere'), t.matiere ? matiereLabel(t.matiere.id) : null),
          fact(nom('overlayProp'), t.overlayProp ? propLabel(t.overlayProp.id) : null),
        ),
        // Les DEUX porteurs de couleur du terrain (teinte d'aperçu + arrêts de la rampe) tiennent la
        // MÊME section : ce sont des couleurs, rendues par la même rangée `couleur` (pastille peinte +
        // hex). Le titre est écrit ici : la méta d'un def nomme des CHAMPS, aucune section.
        sections: sections({
          title: tr('codex.fiche.rendu'), layout: 'list',
          rows: [
            { t: 'couleur', k: nom('swatch'), v: t.swatch } as CodexRow,
            { t: 'sub', label: nom('stops') } as CodexRow,
            ...terrainStopsOrdonnes(t.stops).map(([offset, couleur]) => ({ t: 'couleur', k: offset, v: couleur } as CodexRow)),
          ],
        }),
      }));
    },
  },
  buildings: {
    // Types de bâtiment (#1715) : UNE forme sans discriminant — chaque entrée porte la couverture de
    // référence du type et les ornements d'identité que le rendu émet en billboard. Aucune table de
    // libellés ici : les noms FR viennent de la méta du def
    // (`libelleDuChamp`), le nom d'une couverture de l'entrée `materials.json` visée, celui d'un
    // ornement de l'entrée `props.json` qu'il référence, et l'ancrage de l'enum NOMMÉ du schéma.
    label: 'codex.fiche.batiments', group: 'monde',
    build: () => {
      const meta = metaPourFichier('buildings.json');
      const nom = (cle: string) => libelleDuChamp(cle, { meta });
      return buildings.map((b) => depuisEnveloppe(b, {
        meta: facts(
          fact(nom('roofMaterial'), matiereLabel(b.roofMaterial.id)),
          fact(
            nom('features'),
            b.features?.length
              ? b.features.map((f) => `${propLabel(f.id)} (${libelleDeValeur(buildingAnchorSchema, f.anchor)})`).join(' · ')
              : null,
          ),
        ),
      }));
    },
  },
  vehicles: {
    label: 'codex.fiche.vehicules', group: 'monde',
    build: () => vehicles.map((v) => depuisEnveloppe(v, {
      meta: facts(
        fact(tr('codex.fiche.prix'), priceLabel(v.purchase?.price)), fact(tr('codex.fiche.disponibilite'), v.purchase?.availability ? libelleDeValeur(availabilitySchema, v.purchase.availability) : null),
        fact(tr('codex.fiche.enc2'), v.enc), fact(tr('codex.fiche.mouvementVoyage'), v.travel?.movement),
        fact(tr('codex.fiche.endurance'), v.hull?.char.endurance), fact(tr('codex.fiche.blessures'), v.hull?.char.B),
      ),
    })),
  },
  celestialHouses: {
    label: 'codex.fiche.demeuresAstrologiques', group: 'personnage',
    // ADE II 03 l.504-512, l.514
    build: () => celestialHouses.map((h, i) => depuisEnveloppe(h, { sub: fourchette((celestialHouses[i - 1]?.rand ?? 0) + 1, h.rand) })),
  },
  groups: {
    label: 'codex.fiche.groupesCible', group: 'monde',
    build: () => groups.map((g) => depuisEnveloppe(g)),
  },
  psychologies: {
    label: 'codex.fiche.etatsPsychologiques', group: 'effets',
    build: () => psychologies.map((p) => depuisEnveloppe(p, {
      sections: sections(passiveSection(p.passive), effectsSection(p.effects, ETATS_DU_CODEX), ...reverseSections('psychologies', p.id)),
    })),
  },
  seaShanties: {
    label: 'codex.fiche.chantsDeMarins', group: 'monde',
    build: () => seaShanties.map((s) => depuisEnveloppe(s, {
      meta: facts(fact(tr('codex.fiche.note'), s.note ?? null)),
      sections: sections(passiveSection(s.crewOps, tr('codex.fiche.effetEquipage')), passiveSection(s.captainOps, tr('codex.fiche.effetCapitaine'))),
    })),
  },
  shipStations: {
    label: 'codex.fiche.stationsABord', group: 'monde',
    build: () => shipStations.map((st) => depuisEnveloppe(st, {
      meta: facts(fact(tr('codex.fiche.traitNavalRequis'), st.requiresTrait ? refLabel('navalTraits', st.requiresTrait) : null)),
    })),
  },
  crewRoles: {
    label: 'codex.fiche.rolesDEquipage', group: 'monde',
    build: () => crewRoles.map((r) => depuisEnveloppe(r, {
      sections: sections(chips(tr('codex.fiche.competences'), r.skills.map((sk) => idRefRow('skills', sk.id, sk.spec)))),
    })),
  },
  crewTestTypes: {
    label: 'codex.fiche.testsDEquipageTypes', group: 'monde',
    build: () => crewTestTypes.map((t) => depuisEnveloppe(t, {
      meta: facts(fact(tr('codex.fiche.roleEssentiel'), crewRoles.find((r) => r.id === t.essential.id)?.label ?? t.essential.id)),
      sections: sections(
        chips(tr('codex.fiche.rolesContributeurs'), t.roles.map((id) => idRefRow('crewRoles', id))),
        regleChips(t.rule),
      ),
    })),
  },
  navalTraits: {
    label: 'codex.fiche.traitsAmeliorationsNavales', group: 'equipement',
    build: () => NAVAL_TRAITS.map((t) => depuisEnveloppe(t, {
      sub: t.kind === 'trait' ? tr('codex.fiche.traitConstruction') : tr('codex.fiche.amelioration'),
      sections: sections(passiveSection(t.passive)),
    })),
  },
  traumas: {
    label: 'codex.fiche.traumatismesSequelles', group: 'effets',
    build: () => datasetArray('traumas').map((f) => depuisEnveloppe(f, {
      sub: f.kind ? `${f.kind === 'dechirure' ? tr('codex.fiche.dechirure') : tr('codex.fiche.fracture')}${f.severity ? ` (${f.severity})` : ''}` : undefined,
      sections: sections(passiveSection(f.ops, tr('codex.fiche.effetPermanent'))),
    })),
  },
  criticalsTete: {
    label: 'codex.fiche.critiquesTeteTraumatisme', group: 'effets', cluster: 'codex.fiche.blessuresCritiques', sourceRef: 'LDB 18',
    build: () => datasetArray('criticalsTete').map((e) => critEntryItem(e, 'ldb', 'tete')),
  },
  criticalsBras: {
    label: 'codex.fiche.critiquesBrasTraumatisme', group: 'effets', cluster: 'codex.fiche.blessuresCritiques', sourceRef: 'LDB 18',
    build: () => datasetArray('criticalsBras').map((e) => critEntryItem(e, 'ldb', 'bras')),
  },
  criticalsCorps: {
    label: 'codex.fiche.critiquesCorpsTraumatisme', group: 'effets', cluster: 'codex.fiche.blessuresCritiques', sourceRef: 'LDB 18',
    build: () => datasetArray('criticalsCorps').map((e) => critEntryItem(e, 'ldb', 'corps')),
  },
  criticalsJambe: {
    label: 'codex.fiche.critiquesJambeTraumatisme', group: 'effets', cluster: 'codex.fiche.blessuresCritiques', sourceRef: 'LDB 18',
    build: () => datasetArray('criticalsJambe').map((e) => critEntryItem(e, 'ldb', 'jambe')),
  },
  aaCriticalsTete: {
    label: 'codex.fiche.critiquesTeteApprocheAlternative', group: 'effets', cluster: 'codex.fiche.blessuresCritiques', sourceRef: 'AA',
    build: () => datasetArray('aaCriticalsTete').map((e) => critEntryItem(e, 'aa', 'tete')),
  },
  aaCriticalsBras: {
    label: 'codex.fiche.critiquesBrasApprocheAlternative', group: 'effets', cluster: 'codex.fiche.blessuresCritiques', sourceRef: 'AA',
    build: () => datasetArray('aaCriticalsBras').map((e) => critEntryItem(e, 'aa', 'bras')),
  },
  aaCriticalsCorps: {
    label: 'codex.fiche.critiquesCorpsApprocheAlternative', group: 'effets', cluster: 'codex.fiche.blessuresCritiques', sourceRef: 'AA',
    build: () => datasetArray('aaCriticalsCorps').map((e) => critEntryItem(e, 'aa', 'corps')),
  },
  aaCriticalsJambe: {
    label: 'codex.fiche.critiquesJambeApprocheAlternative', group: 'effets', cluster: 'codex.fiche.blessuresCritiques', sourceRef: 'AA',
    build: () => datasetArray('aaCriticalsJambe').map((e) => critEntryItem(e, 'aa', 'jambe')),
  },
  incidentsMonture: {
    label: 'codex.fiche.incidentsDeMonte', group: 'tables', cluster: 'codex.fiche.voyageTerrestre',
    build: () => MOUNT_INCIDENTS.map((e) => travelEntryItem(e, mountIncidentDie(), tr('codex.fiche.effetSurLeCavalier'))),
  },
  problemesVehicule: {
    label: 'codex.fiche.problemesDeVehicule', group: 'tables', cluster: 'codex.fiche.voyageTerrestre',
    build: () => VEHICLE_PROBLEMS.map((e) => travelEntryItem(e, vehicleProblemDie(), tr('codex.fiche.effetSurLesOccupants'))),
  },
  rencontresPositives: {
    label: 'codex.fiche.rencontresPositives', group: 'tables', cluster: 'codex.fiche.rencontres',
    build: () => datasetArray('rencontresPositives').map((e) => travelEntryItem(e, encounterDie(), tr('codex.fiche.effetSurLesOccupants'))),
  },
  rencontresFortuites: {
    label: 'codex.fiche.rencontresFortuites', group: 'tables', cluster: 'codex.fiche.rencontres',
    build: () => datasetArray('rencontresFortuites').map((e) => travelEntryItem(e, encounterDie(), tr('codex.fiche.effetSurLesOccupants'))),
  },
  rencontresDangereuses: {
    label: 'codex.fiche.rencontresDangereuses', group: 'tables', cluster: 'codex.fiche.rencontres',
    build: () => datasetArray('rencontresDangereuses').map((e) => travelEntryItem(e, encounterDie(), tr('codex.fiche.effetSurLesOccupants'))),
  },
  shipCriticalsCargaison: {
    label: 'codex.fiche.critiquesDeNavireCargaison', group: 'effets', cluster: 'codex.fiche.critiquesDeNavire', sourceRef: 'MDG 13',
    build: () => datasetArray('shipCriticalsCargaison').map((e) => shipCritEntryItem(e, SHIP_CRIT_SET)),
  },
  shipCriticalsGreement: {
    label: 'codex.fiche.critiquesDeNavireGreement', group: 'effets', cluster: 'codex.fiche.critiquesDeNavire', sourceRef: 'MDG 13',
    build: () => datasetArray('shipCriticalsGreement').map((e) => shipCritEntryItem(e, SHIP_CRIT_SET)),
  },
  shipCriticalsCoque: {
    label: 'codex.fiche.critiquesDeNavireCoque', group: 'effets', cluster: 'codex.fiche.critiquesDeNavire', sourceRef: 'MDG 13',
    build: () => datasetArray('shipCriticalsCoque').map((e) => shipCritEntryItem(e, SHIP_CRIT_SET)),
  },
  shipCriticalsAvirons: {
    label: 'codex.fiche.critiquesDeNavireAvirons', group: 'effets', cluster: 'codex.fiche.critiquesDeNavire', sourceRef: 'MDG 13',
    build: () => datasetArray('shipCriticalsAvirons').map((e) => shipCritEntryItem(e, SHIP_CRIT_SET)),
  },
  shipCriticalsEquipements: {
    label: 'codex.fiche.critiquesDeNavireEquipements', group: 'effets', cluster: 'codex.fiche.critiquesDeNavire', sourceRef: 'MDG 13',
    build: () => datasetArray('shipCriticalsEquipements').map((e) => shipCritEntryItem(e, SHIP_CRIT_SET)),
  },
  riverCriticalsGreement: {
    label: 'codex.fiche.critiquesFluviauxGreement', group: 'effets', cluster: 'codex.fiche.critiquesFluviaux', sourceRef: 'MSRC 7',
    build: () => datasetArray('riverCriticalsGreement').map((e) => shipCritEntryItem(e, RIVER_CRIT_SET)),
  },
  riverCriticalsAvirons: {
    label: 'codex.fiche.critiquesFluviauxRames', group: 'effets', cluster: 'codex.fiche.critiquesFluviaux', sourceRef: 'MSRC 7',
    build: () => datasetArray('riverCriticalsAvirons').map((e) => shipCritEntryItem(e, RIVER_CRIT_SET)),
  },
  riverCriticalsGouvernail: {
    label: 'codex.fiche.critiquesFluviauxGouvernail', group: 'effets', cluster: 'codex.fiche.critiquesFluviaux', sourceRef: 'MSRC 7',
    build: () => datasetArray('riverCriticalsGouvernail').map((e) => shipCritEntryItem(e, RIVER_CRIT_SET)),
  },
  riverCriticalsCoque: {
    label: 'codex.fiche.critiquesFluviauxCoque', group: 'effets', cluster: 'codex.fiche.critiquesFluviaux', sourceRef: 'MSRC 7',
    build: () => datasetArray('riverCriticalsCoque').map((e) => shipCritEntryItem(e, RIVER_CRIT_SET)),
  },
  riverCriticalsSuperstructure: {
    label: 'codex.fiche.critiquesFluviauxSuperstructure', group: 'effets', cluster: 'codex.fiche.critiquesFluviaux', sourceRef: 'MSRC 7',
    build: () => datasetArray('riverCriticalsSuperstructure').map((e) => shipCritEntryItem(e, RIVER_CRIT_SET)),
  },
  seaManannFactors: {
    label: 'codex.fiche.humeurDeManannFacteurs', group: 'tables', cluster: 'codex.fiche.merRiviere', sourceRef: 'MDG 15',
    build: () => datasetArray('seaManannFactors').map(manannFactorItem),
  },
  seaBoardEvents: {
    label: 'codex.fiche.evenementsDeBordMer', group: 'tables', cluster: 'codex.fiche.merRiviere', sourceRef: 'MDG 15',
    build: () => datasetArray('seaBoardEvents').map((e) => seaEventItem(e, facesDuDe(deDesEvenementsDeBord()))),
  },
  seaPortEvents: {
    label: 'codex.fiche.evenementsDePortMer', group: 'tables', cluster: 'codex.fiche.merRiviere', sourceRef: 'MDG 15',
    build: () => datasetArray('seaPortEvents').map((e) => seaEventItem(e)),
  },
  seaFastVoyage: {
    label: 'codex.fiche.voyageRapideMer', group: 'tables', cluster: 'codex.fiche.merRiviere', sourceRef: 'MDG 15',
    build: () => datasetArray('seaFastVoyage').map((e) => seaEventItem(e, facesDuDe(deDuVoyageRapide()))),
  },
  waterExposure: {
    label: 'codex.fiche.expositionALEauMaladiesHydriques', group: 'tables', cluster: 'codex.fiche.merRiviere', sourceRef: 'MSRC 16',
    build: () => {
      const w = datasetObject('waterExposure');
      return [{
        id: 'waterExposure', label: w.label, desc: w.desc, source: src(w.source),
        meta: facts(
          fact(tr('codex.fiche.test'), `${refLabel('skills', w.test.skill)} ${DIFFICULTY_LABELS[w.test.difficulty]}`),
          fact(tr('codex.fiche.malusParDrNegatifJetDe'), `+${w.rollModPerNegativeSL}`),
        ),
        sections: sections(
          waterModifiersSection(w.modifiers),
          {
            title: tr('codex.fiche.maladiesJetApresEchecDu', { die: formatDice(deDeLaTableTiree(w.diseases)) }), layout: 'list',
            rows: w.diseases.entries.map((d) => {
              const label = maladies.find((m) => m.id === d.disease)?.label ?? d.disease;
              return { t: 'ref', category: 'maladies', id: d.disease, label, show: label, badge: `${fourchette(d.min, d.max, facesDuDe(deDeLaTableTiree(w.diseases)))}${d.rerollUnlessWounded ? tr('codex.fiche.relanceSiIndemne') : ''}` } as CodexRow;
            }),
          },
        ),
      }];
    },
  },
  navalPorts: {
    label: 'codex.fiche.portsIndexDeLaMerDes', group: 'monde', sourceRef: 'MDG 15',
    build: () => navalPorts.map((p) => depuisEnveloppe(p, {
      group: p.region,
      meta: facts(
        fact(tr('codex.fiche.taille'), p.taille), fact(tr('codex.fiche.richesse'), p.richesse),
        fact(tr('codex.fiche.dirigeant'), p.dirigeant ?? null), fact(tr('codex.fiche.cosmopolite'), p.cosmopolite ? tr('codex.fiche.oui') : null),
      ),
      sections: sections(
        p.production?.length ? { title: tr('codex.fiche.production'), layout: 'chips', rows: p.production.map((id) => portCargoRow(id)) } : null,
        p.surplus && Object.keys(p.surplus).length ? { title: tr('codex.fiche.surplus'), layout: 'chips', rows: Object.entries(p.surplus).map(([id, q]) => portCargoRow(id, q)) } : null,
        p.demande && Object.keys(p.demande).length ? { title: tr('codex.fiche.demande'), layout: 'chips', rows: Object.entries(p.demande).map(([id, q]) => portCargoRow(id, q)) } : null,
      ),
    })),
  },
  navalProgression: {
    label: 'codex.fiche.progressionDeNavireDrDeNavigation', group: 'tables', cluster: 'codex.fiche.merRiviere', sourceRef: 'MDG 13',
    build: () => datasetArray('navalProgression').map((e) => ({
      id: e.id, label: libelleDeValeur(progressionModeSchema, e.mode),
      sub: `DR ${fourchette(e.min, e.max)}`, desc: e.desc, source: src(e.source),
    })),
  },
  shipHullSizes: {
    label: 'codex.fiche.gabaritsDeCoqueConstructionNavale', group: 'equipement', cluster: 'codex.fiche.merRiviere', sourceRef: 'MDG 12',
    build: () => datasetArray('shipHullSizes').map((s) => ({
      id: s.id, label: libelleDeValeur(shipSizeSchema, s.size), source: src(s.source),
      meta: facts(
        fact(tr('codex.fiche.cout2'), formatMoney(priceToMoney({ gold: s.costGold, silver: 0, brass: 0 }))),
        fact(tr('codex.fiche.equipage'), s.crew),
        s.sail ? fact(tr('codex.fiche.voile'), tr('codex.fiche.mEquipage', { m: s.sail.m, crew: s.sail.crew })) : null,
        s.oars ? fact(tr('codex.fiche.rames'), tr('codex.fiche.mEquipage', { m: s.oars.m, crew: s.oars.crew })) : null,
        fact(tr('codex.fiche.longueur'), `${fourchette(s.lengthM.min, s.lengthM.max)} m`), // MDG 12 l.129
        fact(tr('codex.fiche.endurance'), s.e), fact(tr('codex.fiche.blessures'), s.b), fact(tr('codex.fiche.capacite'), s.capacity),
      ),
      sections: sections(shipConstructionRulesSection()),
    })),
  },
  shipSpeedTraits: {
    label: 'codex.fiche.traitsDeVitesseConstructionNavale', group: 'equipement', cluster: 'codex.fiche.merRiviere', sourceRef: 'MDG 12',
    build: () => datasetArray('shipSpeedTraits').map((t) => depuisEnveloppe(t, {
      meta: facts(
        signedFact(tr('codex.fiche.mouvement'), t.mMod), signedFact(tr('codex.fiche.capacite'), t.capacityPct, ' %'),
        signedFact(tr('codex.fiche.manoeuvrabilite2'), t.manDR), signedFact(tr('codex.fiche.cout2'), t.costPct, ' %'),
      ),
    })),
  },
  shipConstructionTraits: {
    label: 'codex.fiche.traitsDeConstructionNavire', group: 'equipement', cluster: 'codex.fiche.merRiviere', sourceRef: 'MDG 12',
    build: () => datasetArray('shipConstructionTraits').map((t) => ({
      id: t.id, label: refLabel('navalTraits', { id: t.id }), source: src(t.source),
      meta: facts(
        fact(tr('codex.fiche.niveauMax'), t.maxLevel), signedFact(tr('codex.fiche.coutNiveau'), t.costPctPerLevel, ' %'),
        signedFact(tr('codex.fiche.enduranceNiveau'), t.ePerLevel), signedFact(tr('codex.fiche.blessuresNiveau'), t.bPctPerLevel, ' %'),
        signedFact(tr('codex.fiche.capaciteNiveau'), t.capacityPctPerLevel, ' %'),
      ),
    })),
  },
  seaNavigation: {
    label: 'codex.fiche.navigationMaritimeProgressionSalissuresOrientationPhares', group: 'tables', cluster: 'codex.fiche.merRiviere', sourceRef: 'MDG 13/15',
    build: () => {
      const n = datasetObject('seaNavigation');
      const derive = n.orientation.reperes.find((r) => r.outcome === 'derive-majeure'); // MDG 13 l.320
      return [{
        id: 'seaNavigation', label: tr('codex.fiche.navigationMaritime'), source: src(n.workPeriodHours.source),
        sections: sections(
          {
            title: tr('codex.fiche.periodesDeTravailEpuisement'), layout: 'list',
            rows: [
              { t: 'kv', k: tr('codex.fiche.voileBarre'), v: `${n.workPeriodHours.voile} h` },
              { t: 'kv', k: tr('codex.fiche.rames'), v: `${n.workPeriodHours.avirons} h` },
              { t: 'kv', k: tr('codex.fiche.testDEpuisement'), v: DIFFICULTY_LABELS[n.epuisement.difficulty] },
              { t: 'kv', k: tr('codex.fiche.testDEpuisementRythmeForce'), v: DIFFICULTY_LABELS[n.epuisement.forcedDifficulty] },
            ],
          },
          {
            title: tr('codex.fiche.forcerLeRythme'), layout: 'list',
            rows: n.forcerLeRythme.map((r) => ({
              t: 'kv', k: `+${r.bonusM} M`,
              v: [r.voile ? tr('codex.fiche.voile2', { v: DIFFICULTY_LABELS[r.voile] }) : null, r.avirons ? tr('codex.fiche.rames2', { v: DIFFICULTY_LABELS[r.avirons] }) : null].filter(Boolean).join(' · '),
            } as CodexRow)),
          },
          {
            title: tr('codex.fiche.vitessesMaximumCaVaLacherCapitaine'), layout: 'list',
            rows: [
              { t: 'kv', k: tr('codex.fiche.sansRisque'), v: tr('codex.fiche.jusquAM', { safeBonus: n.vitesseMax.safeBonus }) } as CodexRow,
              ...n.vitesseMax.table.map((row) => ({ t: 'kv', k: tr('codex.fiche.bonusDeM', { v: fourchette(row.min, row.max) }), v: tr('codex.fiche.degats3', { v: DIFFICULTY_LABELS[row.difficulty], damage: row.damage, per: row.per }) } as CodexRow)),
            ],
          },
          {
            title: tr('codex.fiche.salissuresTestHebdomadaireDeResistanceDu'), layout: 'list',
            rows: n.salissures.levels.map((l) => ({ t: 'kv', k: tr('codex.fiche.niveau2', { level: l.level }), v: tr('codex.fiche.manMNavReparation', { manDR: l.manDR, mMod: l.mMod, navDR: l.navDR, repairPctOfBase: l.repairPctOfBase, desc: l.desc }) } as CodexRow)),
          },
          {
            title: tr('codex.fiche.orientationReperes1TestJour'), layout: 'list',
            rows: n.orientation.reperes.map((r) => ({ t: 'kv', k: `DR ${fourchette(r.min, r.max)}`, v: r.desc } as CodexRow)),
          },
          {
            title: tr('codex.fiche.changementDeCap', { die: formatDice(deDeLaTableTiree(n.orientation.changementDeCap)), v: derive ? tr('codex.fiche.aDr', { bonusDeDeriveMajeure: n.orientation.bonusDeDeriveMajeure, v: fourchette(derive.min, derive.max) }) : '' }), layout: 'list',
            rows: n.orientation.changementDeCap.entries.map((r) => ({ t: 'kv', k: fourchette(r.min, r.max, facesDuDe(deDeLaTableTiree(n.orientation.changementDeCap))), v: r.desc } as CodexRow)),
          },
          {
            title: composeRollLabel(undefined, tr('codex.fiche.pharesClochers'), { skill: { id: 'perception' } }), layout: 'list',
            rows: n.phares.voirLaLumiere.map((r) => ({ t: 'kv', k: tr('codex.fiche.milles', { v: fourchette(r.min, r.max) }), v: DIFFICULTY_LABELS[r.difficulty] } as CodexRow)),
          },
          {
            title: tr('codex.fiche.longsVoyages'), layout: 'list',
            rows: [
              { t: 'kv', k: tr('codex.fiche.millesJourParPointDeM'), v: String(n.longsVoyages.millesParJourParM) } as CodexRow,
              { t: 'kv', k: tr('codex.fiche.sansVoguerDeNuit'), v: `÷${n.longsVoyages.sansVoguerDeNuitDiviseur}` } as CodexRow,
              { t: 'kv', k: tr('codex.fiche.progressionDuTestDEquipage'), v: `±${n.longsVoyages.progressionPctParDR} % / DR` } as CodexRow,
            ],
          },
          {
            title: tr('codex.fiche.coursePoursuiteDistancesDEvasion'), layout: 'list',
            rows: n.poursuite.escapeDistances.map((e) => ({ t: 'kv', k: e.label, v: tr('codex.fiche.points', { distance: e.distance }) } as CodexRow)),
          },
          {
            title: tr('codex.fiche.reparationsAuPort'), layout: 'list',
            rows: [
              { t: 'kv', k: tr('codex.fiche.coutAuPort'), v: tr('codex.fiche.poBlessure', { portCostGoldPerWound: n.reparation.portCostGoldPerWound }) } as CodexRow,
              { t: 'kv', k: tr('codex.fiche.tempsDeTest'), v: formatDice(n.reparation.testHours.dice) } as CodexRow,
              { t: 'kv', k: tr('codex.fiche.blessuresRepareesTest'), v: formatDice(n.reparation.woundsPerTest.dice) } as CodexRow,
            ],
          },
        ),
      }];
    },
  },
  seaPerils: {
    label: 'codex.fiche.perilsEnMerEchouageIcebergsDetroits', group: 'tables', cluster: 'codex.fiche.merRiviere', sourceRef: 'MDG 13',
    build: () => {
      const p = datasetObject('seaPerils');
      return [{
        id: 'seaPerils', label: tr('codex.fiche.perilsEnMer'), desc: p.echouer.desc, source: src(p.echouer.source),
        sections: sections(
          {
            title: tr('codex.fiche.dangersFlottants'), layout: 'list',
            rows: p.hazards.map((h) => ({ t: 'kv', k: h.label, v: `IC ${h.ic}${h.m != null ? ` · M${h.m}` : ''}${h.strandChancePct != null ? tr('codex.fiche.echouage', { strandChancePct: h.strandChancePct }) : ''}${h.entangleChancePct != null ? tr('codex.fiche.empetrement', { entangleChancePct: h.entangleChancePct }) : ''} — ${h.desc}` } as CodexRow)),
          },
          {
            title: tr('codex.fiche.detroits'), layout: 'list',
            rows: p.detroits.map((d) => ({ t: 'kv', k: d.label, v: `M${d.m} · Nav ${d.navDR}` } as CodexRow)),
          },
          {
            title: tr('codex.fiche.tourbillons'), layout: 'list',
            rows: p.tourbillons.map((w) => ({ t: 'kv', k: w.label, v: tr('codex.fiche.mRayonMSpiraleMMan', { m: w.m, zoneRadiusM: w.zoneRadiusM, zoneSpiralM: w.zoneSpiralM, manDR: w.manDR, ic: w.ic, v: DIFFICULTY_LABELS[w.evasion.difficulty], drCible: w.evasion.drCible }) } as CodexRow)),
          },
          {
            title: tr('codex.fiche.gestionDesPerilsReperageEvitementPar'), layout: 'list',
            rows: p.gestionDesPerils.map((g) => ({ t: 'kv', k: `${g.distanceM} m`, v: tr('codex.fiche.reperageEvitement', { v: DIFFICULTY_LABELS[g.spot], v2: DIFFICULTY_LABELS[g.avoid] }) } as CodexRow)),
          },
        ),
      }];
    },
  },
  seaWeather: {
    label: 'codex.fiche.meteoDeLaMerDesGriffes', group: 'tables', cluster: 'codex.fiche.merRiviere', sourceRef: 'MDG 13',
    build: () => {
      const w = datasetObject('seaWeather');
      // Les 4 aspects du tirage (`table[].precipitations`/`.temperature`/`.visibilite`/`.vent`) sont des
      // ids de catalogue (`w.precipitations`/`.temperatures`/`.visibilites`/`.vents`, CHACUN déjà porteur
      // de son `label` FR verbatim MDG) — la fiche résout id→label PAR LOOKUP (jamais l'id affiché ;
      // aucune duplication de `label` sur `table.entries[]`, la SOURCE UNIQUE du libellé reste le catalogue).
      const precipLabel = new Map(w.precipitations.map((p) => [p.id, p.label]));
      const tempLabel = new Map(w.temperatures.map((t) => [t.id, t.label]));
      const visLabel = new Map(w.visibilites.map((v) => [v.id, v.label]));
      const windLabel = new Map(w.vents.map((v) => [v.id, v.label]));
      return [{
        id: 'seaWeather', label: tr('codex.fiche.meteoDeLaMerDesGriffes'), source: src(w.table.entries[0]?.source),
        meta: facts(fact(tr('codex.fiche.modificateurMerChaude'), w.warmSeaMod)),
        sections: sections(
          {
            title: tr('codex.fiche.tirageQuotidienSaisonParAspect', { die: formatDice(deDeLaTableTiree(w.table)) }), layout: 'list',
            rows: w.table.entries.map((row) => ({
              t: 'kv', k: fourchette(row.min, row.max),
              v: [precipLabel.get(row.precipitations), tempLabel.get(row.temperature), visLabel.get(row.visibilite), windLabel.get(row.vent)].join(' · '),
            } as CodexRow)),
          },
          {
            title: tr('codex.fiche.modificateurSaisonnier'), layout: 'list',
            // Les saisons ET leurs noms viennent de la DONNÉE (`weather` + `seasonLabel`) : la
            // rubrique ne connaît ni la liste ni les libellés.
            rows: weather.map((s) => (
              { t: 'kv', k: seasonLabel(s.id), v: String((w.seasonMod.saisons as Record<string, number>)[s.id]) } as CodexRow
            )),
          },
          {
            title: tr('codex.fiche.precipitations'), layout: 'list',
            rows: w.precipitations.map((p) => ({ t: 'kv', k: p.label, v: p.desc ?? '—' } as CodexRow)),
          },
          {
            title: tr('codex.fiche.temperature'), layout: 'list',
            rows: w.temperatures.map((t) => ({ t: 'kv', k: t.label, v: t.difficulty ? tr('codex.fiche.testToutesLesH', { testEveryHours: String(t.testEveryHours), v: DIFFICULTY_LABELS[t.difficulty], exposure: String(t.exposure) }) : '—' } as CodexRow)),
          },
          {
            title: tr('codex.fiche.visibilite'), layout: 'list',
            rows: w.visibilites.map((v) => ({ t: 'kv', k: v.label, v: v.drPenalty != null ? tr('codex.fiche.drAuDelaDeM', { drPenalty: v.drPenalty, beyondM: String(v.beyondM) }) : '—' } as CodexRow)),
          },
          {
            title: tr('codex.fiche.vents'), layout: 'chips',
            // Libellés d'état de vent : des ÉTIQUETTES → pastille nue, comme leurs voisines.
            rows: w.vents.map((v) => ({ t: 'chip', label: v.label } as CodexRow)),
          },
        ),
      }];
    },
  },
  seaCargo: {
    label: 'codex.fiche.commerceMaritimeAchatVenteSurcharge', group: 'tables', cluster: 'codex.fiche.merRiviere', sourceRef: 'MDG 15',
    build: () => {
      const c = datasetObject('seaCargo');
      const { achat, vente, surcharge, opportunite } = c;
      return [{
        id: 'seaCargo', label: c.label, source: src(c.source),
        sections: sections(
          {
            title: tr('codex.fiche.achat'), layout: 'list',
            rows: [
              { t: 'kv', k: tr('codex.fiche.multiplicateurDeDisponibilite'), v: `×${achat.multiplicateurDeDisponibilite}` },
              { t: 'kv', k: tr('codex.fiche.competenceDuMarchand'), v: competenceDuMarchand(achat.competenceDuMarchand) },
              { t: 'kv', k: tr('codex.fiche.competenceDansUnGrandPort'), v: competenceDuMarchand(achat.competenceGrandPort) },
              { t: 'kv', k: tr('codex.fiche.drDuVendeurPourAchatPartiel'), v: signe(achat.drVendeurAchatPartiel) },
              { t: 'kv', k: tr('codex.fiche.drDuVendeurPourSurplus'), v: signe(achat.drVendeurSurplus) },
            ],
          },
          {
            title: tr('codex.fiche.prixDOffreRichesseTailleDemande'), layout: 'list',
            rows: vente.prixDOffre.map((b) => ({ t: 'kv', k: fourchette(b.min, b.max), v: `${signe(b.pct)} %` } as CodexRow)),
          },
          {
            title: tr('codex.fiche.vente'), layout: 'list',
            rows: [
              { t: 'kv', k: tr('codex.fiche.cibleSansProductionParTaille'), v: String(vente.cibleParTailleSansProduction) },
              { t: 'kv', k: tr('codex.fiche.bonusDeCommerce'), v: signe(vente.bonusDeCommerce) },
              { t: 'kv', k: tr('codex.fiche.ragotSurLaProduction'), v: tr('codex.fiche.ragotCibleParTailleMilles', { v: DIFFICULTY_LABELS[vente.ragotSiProduction.difficulty], cibleParTaille: vente.ragotSiProduction.cibleParTaille, millesMin: vente.ragotSiProduction.millesMin }) },
              { t: 'kv', k: tr('codex.fiche.ragotSurLeSurplus'), v: tr('codex.fiche.ragotCibleParTaille', { v: DIFFICULTY_LABELS[vente.ragotSiSurplus.difficulty], cibleParTaille: vente.ragotSiSurplus.cibleParTaille }) },
              { t: 'kv', k: tr('codex.fiche.drDuVendeur'), v: tr('codex.fiche.drDuVendeurParRelation', { sansProduction: signe(vente.drDuVendeur.sansProduction), demande: signe(vente.drDuVendeur.demande), production: signe(vente.drDuVendeur.production), surplus: signe(vente.drDuVendeur.surplus) }) },
              { t: 'kv', k: tr('codex.fiche.prixDeLiquidation'), v: tr('codex.fiche.pctDuPrixDeBase', { pct: vente.pctDeBradage }) },
            ],
          },
          {
            title: tr('codex.fiche.surchargeDeLaCale'), layout: 'list',
            rows: [
              ...surcharge.paliers.map((p) => ({ t: 'kv', k: `> ${p.pctDepuis} %`, v: tr('codex.fiche.palierDeSurcharge', { label: p.label, mMod: signe(p.mMod), drDeManoeuvre: signe(p.drDeManoeuvre) }) } as CodexRow)),
              { t: 'kv', k: tr('codex.fiche.limiteAbsolue'), v: `${surcharge.pctPlafond} %` },
            ],
          },
          {
            title: tr('codex.fiche.commerceDOpportunite'), layout: 'list',
            rows: [
              { t: 'kv', k: tr('codex.fiche.test'), v: `${refLabel('skills', opportunite.test.skill!)} ${DIFFICULTY_LABELS[opportunite.test.difficulty!]}` },
              { t: 'kv', k: tr('codex.fiche.drAAtteindre'), v: String(opportunite.drCible) },
              { t: 'kv', k: tr('codex.fiche.tentativesMaximales'), v: String(opportunite.tentativesMax) },
              ...(opportunite.encInvestiMax ? [{ t: 'kv', k: tr('codex.fiche.investissementMaximalEnc'), v: tr('codex.fiche.oui') } as CodexRow] : []),
              ...opportunite.outcomes.map((o) => ({
                t: 'kv',
                k: [
                  libelleDeValeur(issueDuTestSchema, o.on),
                  o.manquantMin != null ? tr('codex.fiche.manqueAuMoinsDr', { n: o.manquantMin }) : null,
                  o.drSupplementaireMin != null ? tr('codex.fiche.drEnPlusOuDavantage', { n: o.drSupplementaireMin }) : null,
                ].filter(Boolean).join(' · '),
                v: `${signe(o.pct)} %`,
              } as CodexRow)),
            ],
          },
        ),
      }];
    },
  },
  landCargo: {
    label: 'codex.fiche.commerceTerrestreEtFluvialVinAchat', group: 'tables', cluster: 'codex.fiche.voyageTerrestre', sourceRef: 'MSRC 13',
    build: () => {
      const c = datasetObject('landCargo');
      const { achat, vente, ragot } = c;
      return [{
        id: 'landCargo', label: c.label, source: src(achat.source),
        meta: facts(fact(tr('codex.fiche.ragot'), tr('codex.fiche.difficulteEtModificateur', { v: DIFFICULTY_LABELS[ragot.difficulty], mod: signe(ragot.mod) }))),
        sections: sections(
          {
            title: tr('codex.fiche.qualiteDuVin', { die: formatDice(deDeLaTableTiree(c.qualiteDuVin)) }), layout: 'list',
            rows: c.qualiteDuVin.entries.map((q) => ({ t: 'kv', k: fourchette(q.min, q.max, facesDuDe(deDeLaTableTiree(c.qualiteDuVin))), v: tr('codex.fiche.qualitePrixCo', { label: q.label, price: q.price }) } as CodexRow)),
          },
          {
            title: tr('codex.fiche.achat'), layout: 'list',
            rows: [
              { t: 'kv', k: tr('codex.fiche.multiplicateurDeDisponibilite'), v: `×${achat.multiplicateurDeDisponibilite}` },
              { t: 'kv', k: tr('codex.fiche.competenceDuMarchand'), v: competenceDuMarchand(achat.competenceDuMarchand) },
              { t: 'kv', k: tr('codex.fiche.surcoutDAchatPartiel'), v: `${signe(achat.pctSurcoutPartiel)} %` },
              { t: 'kv', k: tr('codex.fiche.encombrementMinimal'), v: String(achat.encMin) },
              { t: 'kv', k: tr('codex.fiche.evaluationDuVin'), v: tr('codex.fiche.evaluationDuVinSeuil', { v: DIFFICULTY_LABELS[achat.difficulteEvaluationVin], v2: DIFFICULTY_LABELS[achat.difficulteEvaluationVinFacile], seuil: achat.seuilResistanceAlcool }) },
            ],
          },
          {
            title: tr('codex.fiche.miseAPrixSelonLaRichesse'), layout: 'list',
            rows: vente.offreParRichesse.map((b) => ({ t: 'kv', k: `${fourchette(b.min, b.max)} · ${b.label}`, v: `${signe(b.pct)} %` } as CodexRow)),
          },
          {
            title: tr('codex.fiche.vente'), layout: 'list',
            rows: [
              { t: 'kv', k: tr('codex.fiche.cibleParTaille'), v: String(vente.cibleParTaille) },
              { t: 'kv', k: tr('codex.fiche.bonusDeCommerce'), v: signe(vente.bonusDeCommerce) },
              { t: 'kv', k: tr('codex.fiche.prixDeBradage'), v: tr('codex.fiche.pctDuPrixDeBase', { pct: vente.pctDeBradage }) },
            ],
          },
          {
            title: tr('codex.fiche.rumeursCommerciales', { die: formatDice(deDeLaTableTiree(c.rumeurs)) }), layout: 'list',
            rows: c.rumeurs.entries.flatMap((r) => [
              { t: 'sub', label: fourchette(r.min, r.max, facesDuDe(deDeLaTableTiree(c.rumeurs))) } as CodexRow,
              { t: 'text', text: r.desc } as CodexRow,
              ...r.biens.map((id) => portCargoRow(id)),
            ]),
          },
        ),
      }];
    },
  },
  montures: {
    label: 'codex.fiche.monturesProfilsDeVoyage', group: 'monde',
    build: () => MOUNT_PROFILES.map((p) => depuisEnveloppe(p, {
      meta: facts(fact(tr('codex.fiche.mouvement'), p.m), fact(tr('codex.fiche.endurance'), p.e), fact(tr('codex.fiche.trotte'), p.trot ? tr('codex.fiche.oui') : tr('codex.fiche.non'))),
      sections: sections(chips(tr('codex.fiche.betesLiees'), p.creatureIds.map((id) => idRefRow('creatures', id)))),
    })),
  },
  tavernGames: {
    label: 'codex.fiche.jeuxDeTaverne', group: 'monde',
    build: () => TAVERN_GAMES.map((g) => depuisEnveloppe(g, {
      meta: facts(
        fact(tr('codex.fiche.competence'), g.skill ? refLabel('skills', g.skill) : tr('codex.fiche.pariAucuneCompetence')),
        fact(tr('codex.fiche.caracteristique'), g.characteristic ? CHAR_LABELS[g.characteristic] : null),
        fact(tr('codex.fiche.difficulte'), g.difficulty ? DIFFICULTY_LABELS[g.difficulty] : null),
        fact(tr('codex.fiche.speciaux'), g.specials?.length ? g.specials.map((sp) => `${refLabel('talents', { id: sp.hasTalent })} : ${
          sp.effet === 'cran' ? tr('codex.fiche.cranPlusFacile', { steps: sp.steps, v: sp.steps > 1 ? 's' : '' }) : DIFFICULTY_LABELS[sp.difficulty]}`).join(' ; ') : null),
        fact(tr('codex.fiche.mode'), g.pot ? tr('codex.fiche.miseEtPotD', { die: formatDice(deDeLaTableTiree(g.pot)) })
          : g.volley ? tr('codex.fiche.voleeDeLancers', { throws: g.volley.throws })
            : g.mode === 'etendu' ? tr('codex.fiche.etenduDr', { v: g.target ?? '?' }) : tr('codex.fiche.opposeSimple')),
        fact(tr('codex.fiche.plafondDeDr'), g.drCap ?? null),
        fact(tr('codex.fiche.nombreCible'), g.pot?.targetRange ? fourchette(g.pot.targetRange.min, g.pot.targetRange.max) : null),
        fact(tr('codex.fiche.totalExact'), g.volley?.exact ?? null),
        fact(tr('codex.fiche.aAbattre'), g.volley?.reserve ?? null),
        fact(tr('codex.fiche.camps'), g.sides?.length ? g.sides.map((s) => tr('codex.fiche.pieces', { label: s.label, pieces: s.pieces })).join(tr('codex.fiche.contre')) : null),
        fact(tr('codex.fiche.toursMaison'), g.combined?.tours ?? null),
      ),
    })),
  },
  obsessions: {
    label: 'codex.fiche.obsessionsTable', group: 'tables',
    build: () => OBSESSIONS.map((o) => ({ id: o.id, label: groupLabel(o.id), sub: bandeAuDe(obsessionsDie(), o.min, o.max) })),
  },
  talentsAleatoires: {
    label: 'codex.fiche.talentsAleatoires', group: 'tables',
    build: () => talentsAleatoires.map((t) => ficheDeTableDeRefs(t, t, 'talents', (id) => talentRefLabel({ id }))),
  },
  carrieresAleatoires: {
    label: 'codex.fiche.carrieresAleatoires', group: 'tables',
    build: () => carrieresAleatoires.map((t) => ficheDeTableDeRefs(t, porteurDuDeDeCarrieres(t), 'careers', (id) => refLabel('careers', { id }))),
  },
  especesAleatoires: {
    label: 'codex.fiche.especesAleatoires', group: 'tables',
    build: () => especesAleatoires.map((t) => ficheDeTableDeRefs(t, t, 'races', (id) => refLabel('races', { id }))),
  },
  cargaisonsAleatoires: {
    label: 'codex.fiche.cargaisonsAleatoires', group: 'tables',
    build: () => cargaisonsAleatoires.map((t) => ficheDeTableDeRefs(t, t, 'cargoes', (id) => refLabel('cargoes', { id }))),
  },
  reglesOptionnelles: {
    // V9 #1318 : le catalogue des règles optionnelles est une DONNÉE (`reglesOptionnelles.json`) —
    // exposé/éditable ici comme tout catalogue. Le panneau in-game reste la porte de la VALEUR jouée
    // (surcharge runtime persistée) ; cette fiche montre le catalogue lui-même.
    label: 'codex.fiche.reglesOptionnelles', group: 'tables',
    build: () => datasetArray('reglesOptionnelles').map((r) => depuisEnveloppe(r, {
      sub: r.group, desc: r.hint,
      meta: facts(
        fact(tr('codex.fiche.ref'), r.ref),
        fact(tr('codex.fiche.controle'), valeurFR('reglesOptionnelles.json', 'kind', r.kind)),
        fact(tr('codex.fiche.defaut'), ruleValueLabel(r.default)),
        fact(tr('codex.fiche.valeurs'), r.options?.join(' · ') ?? null),
        fact(tr('codex.fiche.bornes'), r.kind === 'param' && r.min != null && r.max != null ? tr('codex.fiche.deA', { min: r.min, max: r.max, v: r.step ? tr('codex.fiche.pasDe', { step: r.step }) : '' }) : null),
        fact(tr('codex.fiche.actionAttachee'), r.action ? tr('codex.fiche.si', { label: r.action.label, v: ruleValueLabel(r.action.when) }) : null),
      ),
    })),
  },
  surincantation: {
    label: 'codex.fiche.tableauDeSurincantationVdm', group: 'tables', sourceRef: 'VDM 02',
    build: () => datasetArray('surincantation').map((r) => ({
      id: r.id, label: r.label, sub: tr('codex.fiche.drDepensesSurUneColonne'),
      meta: facts(
        fact(tr('codex.fiche.cibleAdditionnelle'), `+${r.targets}`),
        fact(tr('codex.fiche.degatEnPlus'), `+${r.damage}`),
        fact(tr('codex.fiche.porteeEtendue'), tr('codex.fiche.portee2', { range: r.range })),
        fact(tr('codex.fiche.zdeEtendue'), r.zone === 1 ? tr('codex.fiche.zdeListee') : `${r.zone} × ZdE`),
        fact(tr('codex.fiche.dureeProlongee'), r.duration === 1 ? tr('codex.fiche.dureeListee') : tr('codex.fiche.duree2', { duration: r.duration })),
      ),
      source: src(SURINCANTATION.source),
    })),
  },
  structureCriticals: {
    label: 'codex.fiche.critiquesDeStructure', group: 'effets',
    build: () => tableDesCritiquesDeStructure().map((c) => ({
      id: c.id, label: c.label, sub: bandeAuDe(structureCriticalsDie(), c.min, c.max), desc: c.note,
      meta: facts(
        c.wounds != null ? fact(tr('codex.fiche.blessures'), c.wounds) : null,
        c.trivial ? fact(tr('codex.fiche.type'), tr('codex.fiche.trivialeT')) : null,
        c.destroyed ? fact(tr('codex.fiche.effondrement'), tr('codex.fiche.oui')) : null,
      ),
    })),
  },
  artilleryMisfire: {
    label: 'codex.fiche.incidentsDeTirParSalve', group: 'effets',
    build: () => ARTILLERY_MISFIRE.map((e) => ({
      id: e.id, label: e.label, sub: bandeAuDe(artilleryMisfireDie(), e.min, e.max), desc: e.note,
      meta: facts(
        fact(tr('codex.fiche.localisation'), e.location === 'brasPrincipal' ? tr('codex.fiche.brasPrincipal') : tr('codex.fiche.aleatoire')),
        e.perSalveIndex ? fact(tr('codex.fiche.repetition'), tr('codex.fiche.parIndiceDeSalveRestant')) : null,
        e.destroyed ? fact(tr('codex.fiche.pieceDetruite'), tr('codex.fiche.oui')) : null,
        e.strayFire ? fact(tr('codex.fiche.tirPerdu'), tr('codex.fiche.oui')) : null,
      ),
    })),
  },
  // Cargaisons (#1684) : le DATASET éditable est le tableau brut du JSON (marqueurs de l'Index compris,
  // cf. `data/overrides.ts`), la VUE Compendium n'en montre que les marchandises — un marqueur n'a ni
  // prix ni disponibilité, donc aucune fiche à ouvrir. Le filtre est ICI, pas dans la donnée. Les
  // marchandises se groupent par voie, la table du livre qui les porte.
  cargoes: {
    label: 'codex.fiche.cargaisons', group: 'monde',
    build: () => datasetArray('cargoes').filter(isEchangeable).map((c) => {
      const voie = valeurFR('cargoes.json', 'voie', c.voie);
      return depuisEnveloppe(c, { group: voie, sub: voie, meta: facts(fact(tr('codex.fiche.vin'), c.wine ? tr('codex.fiche.oui') : null)) });
    }),
  },
  riverPerils: {
    label: 'codex.fiche.perilsFluviaux', group: 'monde',
    build: () => RIVER_PERILS.map((p) => depuisEnveloppe(p, { sub: p.kind })),
  },
  crewMoraleFactors: {
    label: 'codex.fiche.moralDEquipageFacteurs', group: 'tables', cluster: 'codex.fiche.equipageNavire',
    build: () => MORALE_FACTORS.map((f) => depuisEnveloppe(f, { desc: formatEffetSigne(f.effect) })),
  },
  crewMoraleBands: {
    label: 'codex.fiche.moralDEquipageEffets', group: 'tables', cluster: 'codex.fiche.equipageNavire',
    build: () => MORALE_BANDS.map((b) => depuisEnveloppe(b, {
      sub: tr('codex.fiche.moral', { v: fourchette(b.min, b.max) }),
      meta: facts(
        fact(tr('codex.fiche.drCommandementCapitaine'), b.captainCmdDR), fact(tr('codex.fiche.drTestsEquipage'), b.crewTestDR),
        fact(tr('codex.fiche.desertionSeuilD100'), b.desertionRoll ?? null),
      ),
    })),
  },
  steamBreakdowns: {
    label: 'codex.fiche.pannesDeNavireAVapeur', group: 'tables', cluster: 'codex.fiche.equipageNavire',
    build: () => STEAM_BREAKDOWNS.map((e) => depuisEnveloppe(e, {
      sub: bandeAuDe(steamBreakdownDie(), e.min, e.max),
      meta: facts(fact(tr('codex.fiche.moteurDetruit'), e.engineDestroyed ? tr('codex.fiche.oui') : null)),
    })),
  },
  regles: {
    // Procédures / options de jeu au texte VERBATIM (Sombre Pacte, Empoignade, modes d'attaque…) —
    // cible des tooltips `CodexRef` qui portaient une paraphrase de règle (#392).
    label: 'codex.fiche.reglesDeJeu', group: 'monde',
    // Une règle chiffrée montre les valeurs et les Tests que le moteur lit (`engine/reglesChiffrees.ts`, #1173).
    build: () => regles.map((r) => {
      const sections: CodexSection[] = [
        ...(r.rangees?.length ? [{
          title: tr('codex.fiche.valeursChiffrees'), layout: 'list' as const,
          rows: r.rangees.map((x): CodexRow => ({ t: 'kv', k: x.label, v: x.palier !== undefined ? DIFFICULTY_LABELS[x.palier] : `${x.valeur! >= 0 ? '+' : '−'}${Math.abs(x.valeur!)}` })),
        }] : []),
        ...(r.tests?.length ? [{
          title: tr('codex.fiche.testsNommes'), layout: 'list' as const,
          rows: r.tests.map(({ label, test: t }): CodexRow => ({ t: 'kv', k: label, v: `${refLabel('skills', t.skill)} ${DIFFICULTY_LABELS[t.difficulty]}` })),
        }] : []),
      ];
      return depuisEnveloppe(r, sections.length ? { sections } : undefined);
    }),
  },
} satisfies Record<CleCodex, CodexCategorySpec>;

/** Les catégories consultables, dans l'ordre de déclaration de `CODEX_SPECS` — chaque `items`/`facets`
 *  est un getter re-projetable (fraîcheur). */
export const CODEX: CodexCategory[] = (Object.entries(CODEX_SPECS) as [CleCodex, CodexCategorySpec][]).map(([key, spec]) => makeCategory(key, spec));

/** Les couleurs d'un Tableau de couleur (yeux/cheveux) : chacune à sa bande du dé `de` de la table, sous
 *  la source du tableau. Rangée et colonne d'espèce partagent la dérivation, la colonne sur sa borne
 *  effective (`randByRace`, sinon `rand`), comme `rollDetail` (`engine/creation.ts`). */
function couleursDuTableau(table: typeof tableDesYeux, de: DeDeTable): CodexItem[] {
  const rangee = (e: (typeof eyes)[number]) => e.rand;
  const colonne = (race: RaceKey) => (e: (typeof eyes)[number]) => e.randByRace?.[race] ?? e.rand;
  /** Bande de `e` sous la borne `borne` : de la borne précédente + 1 (ou du plus petit total du dé) à la sienne. */
  const bande = (borne: (e: (typeof eyes)[number]) => number, e: (typeof eyes)[number]) => {
    const precedentes = table.entries.map(borne).filter((b) => b < borne(e));
    return bandeAuDe(de, precedentes.length ? Math.max(...precedentes) + 1 : totalDuDe(de, de.n), borne(e));
  };
  return table.entries.map((e) => {
    const sub = bande(rangee, e);
    return depuisEnveloppe({ ...e, source: table.source }, { sub, sections: sections(colorTableSection(e, sub, (race) => bande(colonne(race), e))) });
  });
}

/** Section d'une couleur (yeux/cheveux) — couleur par colonne d'espèce, suivie de la bande de la colonne
 *  quand elle diffère de `sub`, la bande de la rangée. */
function colorTableSection(c: (typeof eyes)[number], sub: string, bandeDeColonne: (race: RaceKey) => string): CodexSection {
  return {
    title: tr('codex.fiche.couleurParEspeceColonneRefchar'), layout: 'list',
    rows: (Object.entries(c.color) as [RaceKey, string | undefined][]).filter(([, v]) => v).map(([sp, v]) => {
      const bandeSp = bandeDeColonne(sp);
      return { t: 'kv', k: sp, v: bandeSp === sub ? v! : `${v} · ${bandeSp}` } as CodexRow;
    }),
  };
}

/** Catégories d'une famille, dans l'ordre de déclaration. */
export const categoriesIn = (group: CodexGroup): CodexCategory[] => CODEX.filter((c) => c.group === group);

/** Un sous-groupe repliable de catégories (barre de catégories du Compendium). */
/** Sous-groupe replié de la barre de catégories : `id` STABLE (slug du `cluster` authoré) porte la
 *  LOGIQUE (clé de repli, clé React), `label` l'AFFICHAGE — le titre FR n'est jamais une clé (#602). */
export interface CodexCluster { id: string; label: string; cats: CodexCategory[] }
/** Éclate les catégories d'une famille en pastilles À PLAT (sans `cluster`) + sous-groupes repliables
 *  (par `cluster`), dans l'ordre de déclaration. Anti-avalanche des familles touffues (Effets/Tables) :
 *  les catégories d'un même `cluster` se replient sous un unique dépliable. */
export const clustersIn = (group: CodexGroup): { flat: CodexCategory[]; clusters: CodexCluster[] } => {
  const flat: CodexCategory[] = [];
  const clusters: CodexCluster[] = [];
  const byName = new Map<string, CodexCluster>();
  for (const c of categoriesIn(group)) {
    if (!c.cluster) { flat.push(c); continue; }
    let cl = byName.get(c.cluster);
    if (!cl) { cl = { id: slugId(c.cluster), label: c.cluster, cats: [] }; byName.set(c.cluster, cl); clusters.push(cl); }
    cl.cats.push(c);
  }
  return { flat, clusters };
};

/** Catégorie par clé. */
export const categoryByKey = (key: string): CodexCategory | undefined => CODEX.find((c) => c.key === key);

/** Identité STABLE d'une entrée de Codex = sérialisation canonique du couple `{category, id}` —
 *  `CodexItem.id` est unique par catégorie, la clé de navigation qualifie donc la catégorie. C'est
 *  la clé de sélection du navigateur (jamais un `.label ===` nu). */
export const codexItemKey = (category: string, id: string): string => `${category}␞${id}`;

// ── Index de lookup PARESSEUX (par catégorie) ────────────────────────────────────────────────────
// `codexLookupById` est appelé par CHAQUE `CodexRef` à CHAQUE rendu → un `items.find` linéaire ne scale
// pas (des centaines de refs × des centaines d'items). L'index (id → item) se construit à la 1re
// résolution d'une catégorie — sur les `items` COURANTS du getter re-projetable — et se ré-utilise
// ensuite. Reconstruit après une écriture au seam des datasets (`memoParVersion`) : index ET
// projections (`c.items`/`c.facets`) repartent alors de la donnée persistée, et `useVersionDesDatasets` fait
// re-rendre les lecteurs (CompendiumScreen). L'état (`LOOKUP`) vit en tête de fichier, avec la
// machinerie de fraîcheur.

/** Index id → fiche d'une catégorie, construit à la 1re résolution — `undefined` si la catégorie est
 *  inconnue (jamais mis en cache, répond `undefined` à chaque appel). Parcours INVERSÉ + `set` nu : la
 *  PREMIÈRE occurrence d'un id l'emporte. */
function categoryIndex(category: string): Map<string, CodexItem> | undefined {
  const lookup = LOOKUP();
  let idx = lookup.get(category);
  if (!idx) {
    const items = categoryByKey(category)?.items;
    if (!items) return undefined;
    idx = new Map();
    for (let i = items.length - 1; i >= 0; i--) if (items[i].id) idx.set(items[i].id, items[i]);
    lookup.set(category, idx);
  }
  return idx;
}

/** Résout une réf Codex (catégorie + identité STABLE) → sa fiche : la SEULE résolution d'un lien
 *  `CodexRef`, jamais par libellé (#1632). Sans catégorie ou sans id : aucune fiche. */
export function codexLookupById(category: string | undefined, id: string | undefined): CodexItem | undefined {
  if (!category || !id) return undefined;
  return categoryIndex(category)?.get(id);
}

const [tete, brasG, brasD, corps, jambeG, jambeD] = LOCALISATIONS_DE_COUP;
const ARMOUR_LOCS: readonly HitLocation[] = [tete, corps, brasG, brasD, jambeG, jambeD];

/** Statbloc d'un combattant VIVANT (valeurs réelles : carac, armes/armure dérivées, états déjà à
 *  part) en sections — MÊME rendu que la fiche Codex (CodexEntry/CodexSections). Sert l'inspection
 *  d'un ennemi en combat sans recopier un panneau partiel. TOUTES les caracs (« – » si inexistante). La Cible
 *  d'individu d'un Trait psy est nommée par `nomDIndividu`. */
export function combatantSections(c: Combatant, nomDIndividu?: NomDIndividu): CodexSection[] {
  const ch = c.characteristics;
  const charRows: CodexRow[] = [
    { t: 'kv', k: 'M', v: String(c.movement), kref: { category: 'characteristics', id: 'mouvement', label: tr('codex.fiche.mouvement') } },
    ...CHAR_KEYS.map((k) => ({ t: 'kv', k: charAbr(k), v: ch[k] > 0 || c.kind === 'heros' ? String(effectiveChar(c, k)) : '–', kref: { category: 'characteristics', id: k, label: CHAR_LABELS[k] } } as CodexRow)),
    { t: 'kv', k: tr('codex.fiche.taille'), v: SIZE_LABEL[effectiveSize(c.size)] }, // Taille : pas une caractéristique → pas de lien Codex
  ];
  const skillRows: CodexRow[] = (c.skills ?? []).map((s) =>
    idRefRow('skills', s.id, s.spec, `${skillInstanceLabel(s)} ${skillBaseValue(c, { skill: s })}`),
  );
  // Arme liée par son identité de catalogue (`trappingId`, sinon `builtinId`, `engine/types.ts`
  // `Weapon`) ; sans elle, pastille nue. Dégâts en badge (`damageString`).
  const weaponRows: CodexRow[] = (c.weapons ?? []).map((w) => {
    const badge = damageString(w.damage);
    const id = w.trappingId ?? w.builtinId;
    return id ? { ...idRefRow('trappings', id, undefined, w.label), badge } : { t: 'chip', label: w.label, badge };
  });
  const worn = ARMOUR_LOCS.filter((l) => (c.armour?.[l] ?? 0) > 0);
  return sections(
    { title: tr('codex.fiche.caracteristiques'), layout: 'grid', rows: charRows },
    weaponRows.length ? { title: tr('codex.fiche.armes'), layout: 'chips', rows: weaponRows } : null,
    worn.length ? { title: tr('codex.fiche.armure'), layout: 'list', rows: [{ t: 'text', text: worn.map((l) => `${HIT_LOCATION_LABELS[l]} ${c.armour![l]}`).join(' · ') }] } : null,
    chips(tr('codex.fiche.traits'), traitRefRows(c.traits, nomDIndividu)),
    skillRows.length ? { title: tr('codex.fiche.competences'), layout: 'chips', rows: skillRows } : null,
    chips(tr('codex.fiche.talents'), (c.talents ?? []).map((t) => idRefRow('talents', t.talentId, t.spec))),
    chips(tr('codex.fiche.sorts'), (c.spells ?? []).map((id) => idRefRow('spells', id))),
  );
}

/** Catégorie Codex des créatures (`CODEX`, clé `creatures`) : le `type` du porteur de leur `desc`. */
const CATEGORIE_DES_CREATURES = 'creatures';

const sectionDescription = (text: string, porteur: PorteurDeRangee | undefined): CodexSection =>
  ({ title: '', layout: 'list', rows: [{ t: 'text', text, porteur }] });

/**
 * La prose d'un combattant à fiche (#2206) : une section sans titre et l'entrée qui PORTE son texte
 * (`CodexSections`, `entree`), ou `null` sans prose. Lit le porteur de fiche, jamais `creatureId`
 * (`mergeCreatureProfile` laisse un `profil.id` l'écraser) ; lit `desc`, jamais `maison`.
 * - réf : la `desc` de la créature du catalogue ;
 * - preset : la `desc` de la fiche fusionnée. Quand elle EST la `desc` du profil du preset
 *   (`presetDe`, résolveur injecté), son porteur est le champ du document de projet
 *   (`porteurDuNarratif`, injecté : `undefined` hors projet) ; quand elle est la `desc` de sa base,
 *   la base la porte ; sinon (fiche figée, `sceneNpc.ts`) elle est nue ;
 * - statbloc (`defs-scenes/communs.ts`, aucun champ de prose), héros : `null`.
 */
export function proseDeFiche(
  c: Combatant,
  presetDe: ResolveurDePreset,
  porteurDuNarratif: (cle: 'presetsPnj', id: string, suite: string) => Porteur | undefined,
): { section: CodexSection; entree?: { type: string; id: string } } | null {
  const p = c.porteurDeFiche;
  if (p?.presetCreature) {
    const text = p.presetCreature.desc;
    if (!text) return null;
    const preset = presetDe(p.presetId);
    if (preset?.profil?.desc === text) return { section: sectionDescription(text, porteurDuNarratif('presetsPnj', p.presetId, 'profil.desc')) };
    const base = preset?.base?.id;
    return base && findCreatureById(base)?.desc === text
      ? { section: sectionDescription(text, { chemin: 'desc' }), entree: { type: CATEGORIE_DES_CREATURES, id: base } }
      : { section: sectionDescription(text, undefined) };
  }
  if (p?.ref !== undefined) {
    const desc = findCreatureById(p.ref)?.desc;
    return desc ? { section: sectionDescription(desc, { chemin: 'desc' }), entree: { type: CATEGORIE_DES_CREATURES, id: p.ref } } : null;
  }
  return null;
}
