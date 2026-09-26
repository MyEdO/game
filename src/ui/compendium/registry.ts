/**
 * Registre du Codex — SOURCE UNIQUE des catégories consultables en jeu.
 *
 * Chaque catégorie projette un tableau de `src/data` (façade `index.ts`) en `CodexItem` RICHE :
 * faits-clés + **sections structurées** dont les entités citées (compétences, talents, sorts,
 * traits, qualités…) sont des **liens `CodexRef`** vers leur propre fiche (cross-références).
 * **Ajouter une catégorie = UNE entrée dans `CODEX`** ; enrichir = ajouter des sections (data),
 * pas un composant.
 */
import { useSyncExternalStore } from 'react';
import {
  species, careers, characteristics, classes, skills, talents,
  qualities, trappings, siegeEngines, weaponGroups, etats, maladies, creatures, traits, spells, maneuvers, domains, mutations, mutationTables, gods,
  stars, locations, findLocationById, books, bookAbr, careerLevels, raceAppearance, levelsForCareer, skillRefLabel, talentRefLabel, refLabel, trappingRefLabel, qualityRefLabel, advancementLabel, advancementBaseId, weaponGroupLabel, qualitySubtypeLabel, qualityTypeLabel,
  skillInstanceLabel, careersForSpecies, findCareerById, findClassById, findSpeciesById, eyes, hairs, details, semencesDeScene, defautsDeCompilation, names,
  pregens, oups, interludeEvents, peripeties, psychologyLabel,
  allAxes,
  calendarMonths, calendarIntercalary, calendarWeekdays, calendarPhases, weather, weatherConditions, symptoms, symptomLabel, windsOfMagicTable,
  isNamed, specCatalogOf, specLabel, seasonLabel,
  SYMPTOM_SEVERITIES,
  vehicles, celestialHouses, groups, psychologies, seaShanties, crewRoles, crewTestTypes, shipStations, NAVAL_TRAITS, findVehicleById, structures, regles,
  charAbr, rigSpeciesId, navalPorts, shipConstruction, effectTables, disponibilite,
  conditionLabel, traitProjectingManeuver, materials, terrains, props, buildings,
} from '../../data';
// #157 (audit d'exposition Codex) : catalogues app-owned chargés par un module dédié plutôt que la
// façade `index.ts` — réutilisés TELS QUELS (même patron que `POWER_ESTIMATE` etc. ci-dessous, déjà
// importés directement d'`engine/massBattle`).
import type { RaceKey, SourceRef } from '../../data/schemas/grammaire/valeurs';
import { symptomSeveritySchema } from '../../data/schemas/grammaire/valeurs';
import { buildingAnchorSchema } from '../../data/schemas/defs/buildings';
import type { EnveloppeDocument } from '../../data/schemas/grammaire/document';
import { libelleDeValeur } from '../../data/schemas/grammaire/meta';
import { shipSizeSchema } from '../../data/schemas/grammaire/valeurs';
import { outcomeOnSchema, battleCondSchema, battleOutcomeTargetSchema, battleOutcomeScaleSchema, battleSideSchema } from '../../data/schemas/defs/activities';
import { phenomenonKindSchema, phenomenonTestSchema, saturationTierSchema } from '../../data/schemas/defs/arcane-phenomena';
import { drivingMishapOutcomeSchema } from '../../data/schemas/defs/driving-mishap';
import { drunkennessOutcomeSchema } from '../../data/schemas/defs/drunkenness';
import { progressionModeSchema } from '../../data/schemas/defs/naval-progression';
import { waterTableSchema } from '../../data/schemas/defs/water-exposure';
import { attackKindSchema } from '../../data/schemas/defs/maneuvers';
import { trappingCategorieSchema } from '../../data/schemas/defs/trappings';
import { MOUNT_PROFILES } from '../../engine/mountTravel';
import { MOUNT_INCIDENTS, VEHICLE_PROBLEMS } from '../../engine/travelTables';
import type { TravelTableEntry } from '../../engine/travelTables';
import { TAVERN_GAMES } from '../../engine/tavernGame';
import { OBSESSIONS } from '../../data/obsessions';
import { STRUCTURE_CRITICALS } from '../../data/structureCriticals';
import { ARTILLERY_MISFIRE } from '../../data/artilleryMisfire';
import { type LandCargoDef } from '../../engine/landCargo';
import { findCargoEntryById, isEchangeable } from '../../engine/seaVoyage';
import type { SeaEventDef, ManannFactor } from '../../engine/seaVoyage';
import { RIVER_PERILS } from '../../engine/riverNavigation';
import { MORALE_FACTORS, MORALE_BANDS } from '../../engine/crewMorale';
import { STEAM_BREAKDOWNS } from '../../engine/shipBuild';
import { traumaLabelOf } from '../../engine/trauma';
import { spellOps, type Flow, type FlowTestNode } from '../../engine/flowCore';
import { estCausePersistante, type GameOp } from '../../engine/ops';
import { noeudAmputation } from '../../engine/critical';
import { CRIT_TABLE_LOCATION, type CritTableKey, type JeuDeCritique } from '../../data/criticals';
import type { CrewTarget, ShipCritEntry } from '../../data/shipCriticals';
import { datasetArray, datasetObject } from '../../data/overrides';
import type { CritTableEntry, MiscastRowEntry } from '../../data/overrides';
import type { RuleValue } from '../../engine/policy';
import SURINCANTATION from '../../data/surincantation.json';
import type { SaturationLevel, WindSaturationEffects, ArcanePhenomenon, ArcaneTable, PhenomenonTestMod, PhenomenonScope } from '../../data/arcanePhenomena';
import type { CastingNumberMod, CastingNumberScope } from '../../engine/castingNumber';
import { effectiveEntry } from '../../engine/variants';
import { statName, isOptionalNote, type TraitList } from '../../engine/statEntry';
import { damageString } from '../../engine/items';
import { rangeSpecLabel, ammoRangeModLabel, conditionalDamageNote } from '../weaponStats';
import { formatSpellRange, formatSpellTarget, formatSpellDuration } from '../../engine/spellRangeFormat';
import { talentMaxLabel } from '../../engine/careerSlots';
import type { AdvancementRef, TrappingRef, WaterExposureModifier, SpellData } from '../../data';
import { POWER_ESTIMATE, MIGHT_MODIFIERS, WAR_MACHINES, STRUCTURES as MASS_BATTLE_STRUCTURES, BATTLE_HAZARDS } from '../../engine/massBattle';
import { AVAILABILITIES } from '../../engine/types';
import { ACTIVITIES } from '../../engine/activities';
import type { OutcomeBand } from '../../engine/activities';
import { formatTrait, traitArgSkeleton } from '../../engine/traits/dispatch';
import { resolveQualities } from '../../engine/qualities/dispatch';
import { CHAR_KEYS, CHAR_LABELS, HIT_LOCATION_LABELS, DIFFICULTY_LABELS, type Combatant, type CharKey, type HitLocation } from '../../engine/types';
import { SIZE_LABEL, SIZE_ORDER, effectiveSize, woundsForSize, type SizeCategory } from '../../engine/size';
import { bonus, effectiveChar } from '../../engine/characteristics';
import { skillBaseValue } from '../../engine/skills';
import { sizeFromTraits } from '../../state/spawn';
import { formatDice, type DiceSpec } from '../../engine/dice';
import { formatDiseaseTime } from '../../engine/disease';
import { costPerEnc } from '../../engine/harvest';
import { formatMoney, priceToMoney, type Money } from '../../engine/money';
import type { EntityAppearance } from '../../engine/authoringAppearance';
import { passiveSection, effectsSection, careerGrantSection, spellFlowSection, capabilitySection } from './describe';
import { opRows, tableRows } from './opRows';
import { humanizeCastBonus, CAUSE_PERSISTANTE, replieCausesPersistantes } from './humanize';
import { reverseGroups, bookContents } from './relations';
import { formatManeuverMeasure } from './maneuverMeasure';
import { metaPourFichier, chargeDiscriminee, noeudDuChamp } from '../../data/schemas/validate';
import { libelleDuChamp } from './editFields';
// Ordre des arrêts d'une rampe de terrain : SOURCE UNIQUE partagée avec les émetteurs SVG — la fiche
// Codex lit la rampe dans l'ordre où le rendu la peint, jamais dans l'ordre des clés du Record.
import { terrainStopsOrdonnes } from '../../gameIso/catalog/terrain';
import { porteurDApercu } from './apercuPorteur';
import { slugId } from '../../data/slug';

export type CodexGroup = 'Personnage' | 'Compétences' | 'Équipement' | 'Effets' | 'Magie' | 'Monde' | 'Tables';

/** Ordre d'affichage des familles (onglets du haut). */
export const CODEX_GROUPS: CodexGroup[] = ['Personnage', 'Compétences', 'Équipement', 'Effets', 'Magie', 'Monde', 'Tables'];

/**
 * Identité GÉNÉRIQUE d'une entrée de dataset — clé STABLE servant À LA FOIS de `CodexItem.label`
 * (ce que le navigateur passe à l'éditeur) ET de cible du `findIndex` côté `CodexEdit`. Précédence
 * `label → id` : un dataset qui porte un `label` l'expose (maladies, gods, raceAppearance depuis
 * #1467 L1b V-P4…), sinon son `id` fait l'affichage. Mesuré sur les 2 racines (`src/data`, `src/scenes`) : aucune entrée
 * de premier niveau ne porte `key` ni `name` — le dernier porteur de `key` (`calendarPhases`) est
 * passé à `id` en #1467 L1b V-P1.
 * EXCEPTION careerLevels : le libellé de niveau (« Recrue ») revient sur plusieurs carrières et
 * n'identifie rien seul → composite carrière + niveau, identique des deux côtés (l'éditeur réécrit la
 * bonne entrée, plus de collision sur le 1er homonyme).
 */
export function entryKey(e: Record<string, unknown>): string {
  if (typeof e.career === 'string' && typeof e.level === 'number')
    return `${findCareerById(e.career)?.label ?? e.career} · N${e.level} ${e.label ?? ''}`.trim();
  return String(e.label ?? e.id ?? '');
}

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
/**
 * PORTEUR d'une rangée de prose : le champ d'où sort son texte, VERBATIM. `type`/`id` NOMMENT
 * l'entrée quand la rangée rend le champ d'une AUTRE entrée que la fiche qui l'affiche (fiche de
 * Race rendant les textes d'âge/taille/nom de `details.json`) ; absents, `CodexRowView` les complète
 * avec l'entrée affichée. Un porteur désigne le champ RÉEL, jamais la fiche où on le lit.
 */
export interface PorteurDeRangee {
  type?: string;
  id?: string;
  chemin: string;
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
  /** CHOIX « A ou B » : chaque option est un lien cross-réf cliquable, séparées par « ou ». */
  | { t: 'choice'; category: string; options: { id: string; label: string; show: string }[] }
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
  /** Arbitrage MAISON de l'entrée (clé d'enveloppe `maison`, `grammaire/document.ts`) : la raison, en
   *  clair, d'une valeur qu'aucun folio n'imprime. Projetée par `depuisEnveloppe` et rendue UNE fois
   *  par `CodexEntry` — c'est la provenance des documents SANS livre (CLAUDE.md règle 7). */
  maison?: string;
  source?: CodexSource | null;
  /** Apparence (rig) à prévisualiser dans la fiche : créature, difformité de mutation, trait à visuel. */
  appearance?: EntityAppearance;
  /** `id` de créature pour résoudre l'aperçu rig PAR ID (Nuées/non-bipèdes lisent leurs traits du record). */
  previewRef?: string;
  /** Espèce du PORTEUR sur lequel prévisualiser une `appearance` qui est un FRAGMENT (mutation, trait) —
   *  déclarée par la catégorie (`porteurDApercu`). Absente = entité autonome, résolue par son record. */
  previewPorteur?: string;
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
  /** Projection PARESSEUSE (getter, cache par version) : les datasets étant mutés EN PLACE
   *  (`overrides.ts::setDataset`), la re-projection après `invalidateCodexLookup()` lit la donnée
   *  FRAÎCHE. Ne se re-matérialise qu'à l'invalidation (persist DEV, rare), jamais par rendu. */
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
 *  français — `MetaChamp` ne couvre que le PREMIER NIVEAU d'un document (`document()` exige une méta
 *  par clé de `champs`, `libelleDuChamp` rend la clé nue au régime `profondeur`) — et le Codex est un
 *  écran de RÉFÉRENCE joueur (règle stricte 4). Le champ reste ÉDITABLE à l'atelier, sous-formulaire
 *  inféré ; c'est le FAIT de fiche qui exige un nom lisible. */
const valeurDeCharge = (v: unknown): string | null => {
  if (v == null) return null;
  if (typeof v === 'boolean') return v ? 'oui' : null;
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
 *  l'écrit, `defs/props.ts`) — lecture VIVE du dataset ; l'id nu tient lieu de
 *  nom pour une référence hors catalogue, que le parse refuse nominativement (`idDe('prop')`). */
const propLabel = (id: string): string => props.find((p) => p.id === id)?.label ?? id;

/** Nom d'auteur d'une matière de RELIEF de `materials.json` (domaine filtré comme le picker,
 *  `REF_FIELD['terrains.matiere']`) — lecture VIVE, l'id nu tenant lieu de nom hors catalogue. */
const matiereLabel = (id: string): string => materials.find((m) => m.id === id && m.domain === 'relief')?.label ?? id;
/** Nom d'auteur d'une matière de COUVERTURE (`materials.json` domaine `roof`) — l'id nu à défaut. */
const couvertureLabel = (id: string): string => materials.find((m) => m.id === id && m.domain === 'roof')?.label ?? id;

/** Famille d'une race/variante : « Humains (Reiklander) » → « Humains ». */
const family = (label: string): string => label.split(' (')[0].trim();

/** Id résolu d'une référence par (catégorie, libellé) — même résolution que `CodexRef` (recherche
 *  exacte puis casse pliée dans les items DÉJÀ projetés de la catégorie cible) ; repli sur un slug
 *  du libellé si la cible n'est pas (encore) au catalogue (défensif — arme naturelle hors catalogue,
 *  entrée cassée… — ne doit jamais faire échouer un build). */
const refId = (category: string, label: string): string => codexLookup(category, label)?.id ?? slugId(label);

/** Rangées de référence d'une liste de Caractéristiques : `CharKey` EST l'id de `characteristics.json`
 *  (`charKeySchema`, `grammaire/valeurs.ts`) — aucun round-trip par libellé, même patron
 *  qu'`opRows.ts` (`case 'charMod'`). */
const charRefRows = (keys: readonly CharKey[]): CodexRow[] =>
  keys.map((k) => ({ t: 'ref', category: 'characteristics', id: k, label: CHAR_LABELS[k], show: CHAR_LABELS[k] }));
/** Lien cross-réf par `id` STABLE DÉJÀ CONNU, jamais re-résolu par libellé (`refId`) : `label` =
 *  libellé concret (`refLabel`, spécialisation comprise), `show` = texte affiché (valeur, Indice…). */
const idRefRow = (category: string, id: string, spec?: string, show?: string): CodexRow => {
  const label = refLabel(category, { id, spec });
  return { t: 'ref', category, id, label, show: show ?? label };
};
/** Rangées d'une `TraitList` par id, libellé formaté (`formatTrait`) en affichage. */
const traitRefRows = (traits?: TraitList | null): CodexRow[] =>
  (traits ?? []).map((t) => idRefRow('traits', t.id, undefined, formatTrait(t)));
/** Rangée d'un `AdvancementRef` : `{pick}` → rangée de choix, référence → par id, `{random}` → pastille. */
const advancementRow = (category: string, a: AdvancementRef): CodexRow => {
  if ('pick' in a) {
    return {
      t: 'choice', category,
      options: a.of.map((x) => {
        const lbl = advancementLabel(category, x);
        const name = statName(lbl);
        return { id: advancementBaseId(x) ?? refId(category, name), label: name, show: lbl };
      }),
    };
  }
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
 *  foyer — `id`→Possessions, `creatureId`→Créatures, `vehicleId`→Véhicules — jamais une re-résolution
 *  par libellé (`refId`/`slugId`). `{text}` reste du texte narratif (aucune entité désignée) ;
 *  `choice`/`wildcard` restent un texte composite (pas de `t:'choice'` multi-catégorie ici). */
const trappingRefRow = (ref: TrappingRef): CodexRow => {
  const show = trappingRefLabel(ref);
  // PASTILLE NUE, jamais de la prose : `{text}` est un NOM D'OBJET (« Grand hôtel particulier avec
  // jardins » y ferait lier « Grand »), et `choice`/`wildcard` sont des libellés composites. Aucune
  // entité du Codex n'est désignée — donc pas de `t:'ref'` non plus, et aucun porteur : le libellé
  // rendu n'est même pas toujours le champ (`trappingRefLabel`, `src/data/index.ts:3573-3589`, le
  // DÉCORE du compte `ref.count` — « Pamphlétaire (3) »). Même boîte que ses voisines de section.
  if ('text' in ref || 'choice' in ref || 'wildcard' in ref) return { t: 'chip', label: show };
  if ('creatureId' in ref) return idRefRow('creatures', ref.creatureId, undefined, show);
  if ('vehicleId' in ref) return { t: 'ref', category: 'vehicles', id: ref.vehicleId, label: findVehicleById(ref.vehicleId)?.label ?? ref.vehicleId, show };
  return idRefRow('trappings', ref.id, undefined, show);
};
const trappingRefRows = (items?: TrappingRef[] | null): CodexRow[] => (items ?? []).map(trappingRefRow);
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
        title: 'Rituel',
        layout: 'list',
        // Un sous-en-tête SYNTHÉTISÉ (nu) par rubrique, puis le CHAMP seul — le texte rendu est
        // alors le verbatim du champ, adressable (`ritual.<champ>`). Un `**Composants :** …` inline
        // mêlait libellé fabriqué et verbatim : pas un champ, donc pas un porteur.
        rows: [
          { t: 'sub', label: 'Type' }, { t: 'text', text: r.type, porteur: { chemin: 'ritual.type' } },
          { t: 'sub', label: 'Composants' }, { t: 'text', text: r.components, porteur: { chemin: 'ritual.components' } },
          { t: 'sub', label: 'Conditions' }, { t: 'text', text: r.conditions, porteur: { chemin: 'ritual.conditions' } },
          { t: 'sub', label: 'Sacrifices' }, { t: 'text', text: r.sacrifices, porteur: { chemin: 'ritual.sacrifices' } },
          { t: 'sub', label: 'Conséquences' }, { t: 'text', text: r.consequences, porteur: { chemin: 'ritual.consequences' } },
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
/** Libellés FR des CAPACITÉS irréductibles d'un Symptôme (drapeaux lus par la machinerie de maladie). */
const SYMPTOM_CAP_LABEL: Record<string, string> = {
  blocksHealing: 'Bloque la guérison (1 PB)', amputation: 'Gangrène (amputation)',
  contagious: 'Contagieux', nausea: 'Nausée (Sonné)',
  endTest: 'Test de fin de Durée', persistentActive: 'Ne guérit jamais naturellement',
};
/** Libellé d'un jet de dés (`{n,d,plus?}`) — « 1d10 », « 2d10+2 ». */
const diceLabel = formatDice;
/** Libellés FR des CAPACITÉS de Trait (drapeaux booléens lus par le moteur — `TraitCapabilities`).
 *  Les capacités psy (psychType/psychImmune/psychIndice) sont surfacées à part (méta). */
const TRAIT_CAP_LABEL: Record<string, string> = {
  bonusWoundsBE: 'Blessures bonifiées (+BE)', swarm: 'Nuée', wardSave: 'Sauvegarde invulnérable',
  damageImmunity: 'Immunité aux dégâts',
  counterOnDefenseWin: 'Contre-attaque (défense gagnée)', counterRequiresFastParry: 'Contre exige arme Rapide', unstable: 'Instable', painless: 'Insensible à la douleur',
  psychImmuneIfAhead: 'Immunité psy si en avantage', mindless: 'Sans esprit', bestial: 'Bestial',
  coldBlooded: 'Sang-froid', stupid: 'Stupidité', rage: 'Rage', territorial: 'Territorial', skittishMount: 'Monture ombrageuse',
  fly: 'Vol', leap: 'Bond', stride: 'Foulée', seesInDark: 'Vision nocturne',
  spellcaster: 'Lanceur de Sorts', frenzyCapable: 'Peut entrer en Frénésie', undead: 'Mort-vivant',
};
/** Libellés FR des CAPACITÉS de Qualité d'arme/armure (`QualityCapabilities`). */
const QUALITY_CAP_LABEL: Record<string, string> = {
  fastStrike: 'Rapide', slowStrike: 'Lente', fumbleOn9: 'Dangereuse', pushback: 'Perturbante',
  bladeTrap: 'Piège-lame', damagesArmour: 'Endommage l’armure', firearm: 'Arme à feu', canFireWhileEngaged: 'Tir au contact',
  magazine: 'À répétition', salvo: 'Salve', areaFire: 'Tir de zone', crewedTeam: 'Arme d’équipe', parryAP: 'Protectrice',
  layerable: 'Flexible', critImmuneOdd: 'Impénétrable', apIgnoredOnEven: 'Partielle', apIgnoredOnImpaleCrit: 'Points faibles',
  unbreakable: 'Incassable', magic: 'Magique',
};

/** Section « Issues par Degrés de Réussite » d'une Activité (bandes `OutcomeBand[]`) : une sous-tête par
 *  bande (issue + fourchette de DR + gate de bataille) puis note verbatim, résolveur, rendu, effets et
 *  issues de bataille. Vide si l'Activité n'a pas de table d'issues. */
function outcomeBandsSection(bands?: OutcomeBand[]): CodexSection | null {
  if (!bands?.length) return null;
  const rows: CodexRow[] = [];
  for (const [i, b] of bands.entries()) {
    const head = [
      b.on ? libelleDeValeur(outcomeOnSchema, b.on) : 'Toute issue',
      b.minSL != null || b.maxSL != null ? `DR ${b.minSL ?? '−∞'} … ${b.maxSL ?? '+∞'}` : null,
      b.when ? libelleDeValeur(battleCondSchema, b.when) : null,
    ].filter(Boolean).join(' · ');
    rows.push({ t: 'sub', label: head });
    if (b.note) rows.push({ t: 'text', text: b.note, porteur: { chemin: `outcomes[${i}].note` } });
    if (b.resolver) rows.push({ t: 'kv', k: 'Résolveur', v: b.resolver });
    if (b.payoutPct != null) rows.push({ t: 'kv', k: 'Rendu', v: `${b.payoutPct} %` });
    // Les ops de la bande se RENDENT (primitive `opRows` — chips codex-liées, phrase humanisée, et un
    // `rollTable` expansé en ses rangées), jamais un compte. Même projection que « Tables d'effets ».
    if (b.ops?.length) rows.push(...opRows(b.ops));
    for (const o of b.battle ?? [])
      rows.push({ t: 'kv', k: 'Bataille', v: `${libelleDeValeur(battleOutcomeTargetSchema, o.target)} ${libelleDeValeur(battleOutcomeScaleSchema, o.scale)} ${o.amount >= 0 ? '+' : ''}${o.amount}${o.side ? ` (${libelleDeValeur(battleSideSchema, o.side)})` : ''}` });
    if (b.chains?.length) rows.push({ t: 'kv', k: 'Enchaîne', v: b.chains.join(', ') });
  }
  return { title: 'Issues par Degrés de Réussite', layout: 'list', rows };
}

/**
 * SOURCE UNIQUE du contenu structuré d'une fiche de race — onglets Profil / Carrières / Détails.
 * Consommée par le Codex (`registry.races`) ET l'étape Race du créateur (`SpeciesRaceScreen`, ses
 * sections Caractéristiques/Compétences/Talents seulement — Carrières/Détails restent au Codex), pour
 * qu'elles ne puissent plus diverger. Données tirées des MÊMES tables que le créateur
 * (`careersForSpecies`, `details`, `eyes`, `hairs`). Les faits-clés (M/Destin/Résilience) restent en
 * en-tête (méta), pas ici ; le tirage aléatoire (création) est ajouté PAR le créateur.
 */
/** Section « Caractéristiques de base » d'une race — chaque carac affiche son écart racial (±). */
export function raceCharSection(s: (typeof species)[number]): CodexSection {
  const rows: CodexRow[] = CHAR_KEYS.map((k) => {
    const base = s.baseChar?.[k] ?? 20;
    const diff = base - 20;
    return {
      t: 'kv',
      k: charAbr(k),
      v: diff !== 0 ? `${base} (${diff > 0 ? '+' : ''}${diff})` : String(base),
      kref: { category: 'characteristics', id: k, label: CHAR_LABELS[k] },
    };
  });
  return { title: 'Caractéristiques de base', layout: 'grid', rows };
}

/** Section « Compétences de race » — chips cliquables, « A ou B » éclaté en choix. */
export function raceSkillSection(s: (typeof species)[number]): CodexSection | null {
  const rows = s.skills.map((a) => advancementRow('skills', a));
  return rows.length ? { title: 'Compétences de race', layout: 'chips', rows } : null;
}

/** Section « Talents de race » — chips cliquables, « A ou B » éclaté en choix. Note d'atelier finale
 *  (#393 P2, verdict juge vision P1 item 8) : les choix/tirages (« au d100 ») ne se tranchent pas ici,
 *  mais à l'étape 5 (Compétences & Talents) du créateur. */
export function raceTalentSection(s: (typeof species)[number]): CodexSection | null {
  const rows = s.talents.map((a) => advancementRow('talents', a));
  if (!rows.length) return null;
  return { title: 'Talents de race', layout: 'chips', rows: [...rows, { t: 'nb', text: 'se tranchent à l’étape 5' }] };
}

/** Section « Carrières accessibles » d'une race — groupées par classe, cliquables (→ fiche carrière). */
export function raceCareerSection(s: (typeof species)[number]): CodexSection | null {
  const accessible = careersForSpecies(s.refCareer);
  const rows: CodexRow[] = [];
  for (const cl of classes) {
    const list = accessible.filter((c) => c.class === cl.id);
    if (list.length) rows.push({ t: 'sub', label: cl.label }, ...list.map((c) => idRefRow('careers', c.id)));
  }
  return rows.length ? { title: 'Carrières accessibles', layout: 'chips', rows } : null;
}

/** Section « Détails » d'une race — âge, taille, yeux & cheveux, noms (tables de création). */
export function raceDetailSection(s: (typeof species)[number]): CodexSection {
  const ref = s.refChar;
  const txt = details.texts;
  const eyeColors = [...new Set(eyes.map((e) => e.color[ref]).filter(Boolean))];
  const hairColors = [...new Set(hairs.map((e) => e.color[ref]).filter(Boolean))];
  const rows: CodexRow[] = [
    { t: 'sub', label: 'Âge' },
    { t: 'text', text: `${details.ageBase[ref] ?? details.ageBase.humain} + ${Math.round(details.ageRoll[ref] ?? 1)}d10 ans` },
  ];
  // Les textes d'âge/taille/noms sont des champs de `details.json` — la fiche de Race les AFFICHE,
  // elle ne les porte pas : le porteur nomme l'entrée réelle. Âge/taille FORMATÉS (`base + Nd10`) et
  // les couleurs JOINTES sont, eux, fabriqués : nus.
  const dTxt = (chemin: string) => ({ type: 'details', id: 'details', chemin });
  if (txt.age.bySpecies[ref]) rows.push({ t: 'text', text: txt.age.bySpecies[ref]!, porteur: dTxt(`texts.age.bySpecies.${ref}`) });
  rows.push({ t: 'sub', label: 'Taille' }, { t: 'text', text: `${details.heightBase[ref] ?? details.heightBase.humain} + ${Math.round(details.heightRoll[ref] ?? 1)}d10 cm` });
  const tailleChemin = txt.taille.bySpecies[ref] ? `texts.taille.bySpecies.${ref}` : 'texts.taille.all';
  const tailleTxt = txt.taille.bySpecies[ref] ?? txt.taille.all;
  if (tailleTxt) rows.push({ t: 'text', text: tailleTxt, porteur: dTxt(tailleChemin) });
  if (eyeColors.length) rows.push({ t: 'sub', label: 'Yeux' }, { t: 'text', text: eyeColors.join(', ') });
  if (hairColors.length) rows.push({ t: 'sub', label: 'Cheveux' }, { t: 'text', text: hairColors.join(', ') });
  const nomChemin = txt.nom.bySpecies[ref] ? `texts.nom.bySpecies.${ref}` : 'texts.nom.bySpecies.humain';
  const namesTxt = txt.nom.bySpecies[ref] ?? txt.nom.bySpecies.humain;
  if (namesTxt) rows.push({ t: 'sub', label: 'Noms' }, { t: 'text', text: namesTxt, porteur: dTxt(nomChemin) });
  return { title: 'Âge, taille & apparence', layout: 'list', rows };
}

export function raceFicheTabs(s: (typeof species)[number]): CodexTab[] {
  const career = raceCareerSection(s);
  return [
    { title: 'Profil', sections: sections(raceCharSection(s), raceSkillSection(s), raceTalentSection(s)) },
    ...(career ? [{ title: 'Carrières', sections: [career] }] : []),
    { title: 'Détails', sections: [raceDetailSection(s)] },
  ];
}

/** SOURCE UNIQUE de la fiche d'un Trait (partagée par la catégorie « Traits » ET le filtre
 *  « Psychologie ») : manœuvres conférées + passifs + effets + réfs INVERSES (créatures/mutations) ;
 *  la capacité psy (LDB 21) remonte en méta (type + immunité + Indice fixe). */
/** Statbloc compact d'une créature : profil IMPRIMÉ (M + les 10 caracs, « – » si inexistante —
 *  LDB 76, Schéma des Profils) + Blessures (valeur livre `char.B` si imprimée, sinon formule
 *  BF+2×BE+BFM × Taille, LDB 85) + traits en chips cross-réf. Zéro logique par-créature. */
function creatureStatblock(c: (typeof creatures)[number]): NonNullable<CodexItem['statblock']> {
  const cell = (label: string, v: number | null | undefined, kref?: CodexFact['kref']): CodexFact => ({ label, value: v != null ? String(v) : '–', kref });
  const size = sizeFromTraits(c.traits) ?? 'moyenne';
  const wounds = typeof c.char.B === 'number'
    ? c.char.B
    : woundsForSize(bonus(c.char.force ?? 0), bonus(c.char.endurance ?? 0), bonus(c.char['force-mentale'] ?? 0), size);
  return {
    profile: [
      cell('M', c.char.M, { category: 'characteristics', id: 'mouvement', label: 'Mouvement' }),
      ...CHAR_KEYS.map((k) => cell(charAbr(k), c.char[k], { category: 'characteristics', id: k, label: CHAR_LABELS[k] })),
      { label: 'B', value: String(wounds), kref: { category: 'characteristics', id: 'blessure', label: 'Blessure' } },
    ],
    traits: traitRefRows(c.traits),
  };
}

/** Fiche d'un Trait, projetée par DEUX catégories (`traits` et le filtre `psychologie`) : chacune
 *  passe SA clé, et c'est elle qui déclare le porteur d'aperçu (`porteurDApercu`) — sans quoi la
 *  déclaration de `psychologie` ne serait jamais lue. */
export const traitItem = (t0: (typeof traits)[number], categoryKey: string): CodexItem => {
  // Entrée EFFECTIVE sous les règles optionnelles actives (#563/#564), comme la catégorie Talents :
  // desc, source, capacités, passifs et effets affichés sont ceux de la variante réglée quand elle est
  // active. `traits.json` n'en porte AUCUNE aujourd'hui (mesuré) — la lecture s'aligne sur le schéma
  // (`data/schemas/defs/traits.ts`, champ `variants?`) pour que la première n'arrive pas dans un écran muet.
  const t = effectiveEntry(t0);
  const cap = t.capabilities;
  return depuisEnveloppe(t, {
    sub: traitArgSkeleton(t), appearance: t.appearance,
    ...(t.appearance ? { previewPorteur: porteurDApercu(categoryKey) } : {}),
    meta: facts(
      cap?.psychType ? fact('Psychologie', psychologyLabel(cap.psychType)) : null,
      cap?.psychImmune ? fact('Immunité', '(Psychologie)') : null,
      cap?.psychIndice != null ? fact('Indice', cap.psychIndice) : null,
    ),
    sections: sections(
      capabilitySection(cap as Record<string, unknown> | undefined, TRAIT_CAP_LABEL),
      chips('Manœuvres conférées', (t.grantsManeuvers ?? []).map((r) => idRefRow('maneuvers', r.id, r.spec))),
      passiveSection(t.passive), effectsSection(t.effects),
      ...reverseSections('traits', t.id), // Créatures ayant ce trait · Mutations le conférant
    ),
  });
};

// ── Fraîcheur du Codex : invalidation, version, projections paresseuses ─────────────────────────
// `setDataset` (persist d'une édition Codex) splice les tableaux de `src/data` EN PLACE : les
// projections ci-dessous redonnent la donnée FRAÎCHE à condition d'être RE-EXÉCUTÉES. Chaque
// catégorie matérialise donc ses `items` (et ses facettes dérivées) PARESSEUSEMENT, cachés tant que
// la version ne bouge pas ; `invalidateCodexLookup()` (appelé par `CodexEdit` au persist) bump la
// version → le prochain accès re-projette, et les composants abonnés (`useCodexVersion`) re-rendent.
let LOOKUP: Map<string, { byId: Map<string, CodexItem>; exact: Map<string, CodexItem>; folded: Map<string, CodexItem> }> | null = null;
let LOOKUP_VERSION = 0;
const VERSION_LISTENERS = new Set<() => void>();

/** Version courante de la donnée Codex — bumpée à chaque invalidation. */
export const codexLookupVersion = (): number => LOOKUP_VERSION;

/** Invalide index ET projections (donnée modifiée — persist de `CodexEdit`) : le prochain accès
 *  (`codexLookup`, `c.items`, `c.facets`) reconstruit depuis les datasets live, et les composants
 *  abonnés via `useCodexVersion()` re-rendent. */
export function invalidateCodexLookup(): void {
  LOOKUP = null;
  LOOKUP_VERSION++;
  for (const l of VERSION_LISTENERS) l();
}

const subscribeCodex = (l: () => void): (() => void) => {
  VERSION_LISTENERS.add(l);
  return () => VERSION_LISTENERS.delete(l);
};

/** Abonne un composant à la fraîcheur du Codex : re-rend après chaque `invalidateCodexLookup()`.
 *  La valeur sert aussi de dépendance de `useMemo` sur `c.items` (cf. `CompendiumScreen`). */
export function useCodexVersion(): number {
  return useSyncExternalStore(subscribeCodex, codexLookupVersion);
}

/** Libellé de la facette hiérarchique (`group`) par catégorie. */
const GROUP_FACET_LABEL: Record<string, string> = {
  races: 'Famille', careers: 'Classe', mutations: 'Type', psychologie: 'Type',
  creatures: 'Dossier', locations: 'Lieu parent', books: 'Dossier', careerLevels: 'Carrière',
  arcanePhenomena: 'Rubrique',
};

/** Facettes d'une catégorie, DÉRIVÉES de ses items projetés : une facette n'existe que si des items
 *  PORTENT le champ (livre source partout ; hiérarchie `group` là où la catégorie en a une). */
function deriveFacets(key: string, items: CodexItem[]): CodexFacet[] | undefined {
  const facets: CodexFacet[] = [];
  if (items.some((i) => i.source?.book)) facets.push({ key: 'book', label: 'Livre', valueOf: (i) => i.source?.book });
  if (items.some((i) => i.group)) facets.push({ key: 'group', label: GROUP_FACET_LABEL[key] ?? 'Groupe', valueOf: (i) => i.group });
  return facets.length ? facets : undefined;
}

/** Spec d'une catégorie : identité + projection `build` (exécutée paresseusement, re-exécutable). */
interface CodexCategorySpec {
  key: string;
  label: string;
  group: CodexGroup;
  /** Sous-groupe FR : les catégories d'un même `cluster` se replient sous UN dépliable dans la barre
   *  de catégories (anti-avalanche des groupes touffus Effets/Tables). Absent = pastille à plat. */
  cluster?: string;
  /** Réf de source de la table (« LDB 18 ») — hors du libellé, cf. `CodexCategory.sourceRef`. */
  sourceRef?: string;
  /** cf. `CodexCategory.exergues`. */
  exergues?: boolean;
  build: () => CodexItem[];
}

/** Catégorie à projections PARESSEUSES (cache keyé sur la version d'invalidation). */
function makeCategory(spec: CodexCategorySpec): CodexCategory {
  let items: CodexItem[] | null = null;
  let facets: CodexFacet[] | undefined;
  let builtAt = -1;
  const fresh = (): CodexItem[] => {
    if (!items || builtAt !== LOOKUP_VERSION) {
      items = spec.build();
      facets = deriveFacets(spec.key, items);
      builtAt = LOOKUP_VERSION;
    }
    return items;
  };
  return {
    key: spec.key,
    label: spec.label,
    group: spec.group,
    cluster: spec.cluster,
    sourceRef: spec.sourceRef,
    exergues: spec.exergues,
    get items() { return fresh(); },
    get facets() { fresh(); return facets; },
  };
}

/** Les nœuds `test` d'un Flow, dans l'ordre de jeu — le joueur doit voir AUTANT de jets que le moteur
 *  en joue (doctrine de la forme canonique des jets). Marche récursive, aucune forme n'est supposée. */
function noeudsDeTest(f: Flow | undefined): FlowTestNode[] {
  if (!f) return [];
  switch (f.kind) {
    case 'test': return [f, ...noeudsDeTest(f.success), ...noeudsDeTest(f.fail)];
    case 'seq': return f.steps.flatMap(noeudsDeTest);
    case 'if': return [...noeudsDeTest(f.then), ...noeudsDeTest(f.else)];
    case 'choice': return [...noeudsDeTest(f.yes), ...noeudsDeTest(f.no)];
    default: return [];
  }
}

/**
 * Ops d'un Flow SANS FRANCHIR un jet — la conséquence de CE niveau, les sous-jets exclus. C'est ce qui
 * distingue « ce que ce jet applique » de « ce que le jet suivant appliquera » : `spellOps` descend dans
 * les branches d'un `test` imbriqué et ferait promettre à un jet les États du suivant (« Coupure à
 * l'orteil » : le gate l.171 annoncerait les États du Test l.237). Les `if` sont TRAVERSÉS (leurs deux
 * branches font partie de la conséquence de ce niveau — l'échelle de DR de l.237), les `test` NON.
 * Sur le Flow entier, la même marche rend l'amputation que la ligne PRONONCE hors de tout jet
 * (« Vous perdez votre main – Amputation (Difficile) », LDB 18 l.124). Question DISTINCTE de
 * `certainFlowOps` (« que promet CETTE branche », fail-closed sur tout nœud incertain).
 */
function opsHorsJet(f: Flow | undefined): GameOp[] {
  if (!f) return [];
  if (f.kind === 'seq') return f.steps.flatMap(opsHorsJet);
  if (f.kind === 'if') return [...opsHorsJet(f.then), ...opsHorsJet(f.else)];
  if (f.kind === 'do' && f.effect.type === 'ops') return f.effect.ops;
  return [];
}

/** Libellé d'un nœud `test` : « Compétence Difficulté », la Compétence résolue PAR ID. */
function libelleDeJet(n: FlowTestNode): string {
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
    sub: `d100 ${e.min}–${e.max}`,
    meta: facts(
      e.lethal ? fact('Létal', 'oui') : null,
      !e.lethal && !(e.ops ?? []).some((o) => o.op === 'wounds') ? fact('Type', 'Triviale (« T »)') : null,
      jet ? fact('Jet', libelleDeJet(jet)) : null,
      jetsAmp.length ? fact(jetsAmp.length > 1 ? 'Jets d’Amputation' : 'Jet d’Amputation', jetsAmp.map(libelleDeJet).join(' puis ')) : null,
      e.amputation?.timing === 'postEncounter' ? fact('Quand', 'Une fois la rencontre terminée') : null,
    ),
    sections: sections(
      passiveSection(e.ops, 'Effet immédiat'),
      jet ? passiveSection(opsHorsJet(jet.fail), 'Si le jet échoue') : null,
      jet ? passiveSection(opsHorsJet(jet.success), 'Si le jet réussit') : null,
      ...jetsAmp.map((n) => passiveSection(opsHorsJet(n.fail), `${libelleDeJet(n)} — si le jet échoue`)),
      // L'amputation que la ligne PRONONCE (22 rangées sur 26 : « Vous perdez votre main ») vit HORS des
      // branches — sans cette section, le Codex ne montrerait que le jet et tairait la perte elle-même.
      passiveSection(opsHorsJet(amputation), 'Amputation — quoi que donne le jet'),
      e.traumas?.length
        ? {
            title: 'Traumatismes engendrés', layout: 'chips',
            rows: e.traumas.map((id) => { const label = traumaLabelOf(id); return { t: 'ref', category: 'traumas', id, label, show: label } as CodexRow; }),
          }
        : null,
    ),
  });
}

/** Item Codex d'une entrée de table de voyage d100 (`TravelTableEntry` — Incidents de monte EDOC 7,
 *  Problèmes de véhicule EDOC 7, Rencontres EDOC 8, #157 suite) — MÊME projection pour les 3
 *  familles : plage d100 → texte + Dégâts véhicule éventuels + effet GameOp sur les occupants. */
function travelEntryItem(e: TravelTableEntry, occupantsTitle: string): CodexItem {
  return depuisEnveloppe(e, {
    sub: `d100 ${e.min}–${e.max}`,
    meta: facts(fact('Dégâts véhicule', e.vehicleWounds ?? null)),
    sections: sections(passiveSection(e.occupantOps, occupantsTitle)),
  });
}

/** QUI encaisse, en LIBELLÉS résolus depuis les catalogues (`ship-stations.json`, `crew-roles.json`) —
 *  la donnée porte des ids, l'affichage vient du `label` de l'entrée. */
function crewTargetLabel(cible: CrewTarget): string {
  if ('poste' in cible) return 'Équipage du poste tiré au sort';
  if ('role' in cible) return refLabel('crewRoles', cible.role);
  return cible.stations.map((id) => refLabel('shipStations', { id })).join(' · ');
}

/** Item Codex d'une entrée de Critique de coque (`ShipCritEntry` — MDG 13 navire, MSRC 07 fluvial,
 *  #157 suite) : plage d10 → effet immédiat (`ops`) + coup à l'équipage (`crewHit` : qui encaisse, et
 *  soit l'épreuve du nœud `test` avec les ops de sa branche d'échec, soit les ops certaines), MÊME
 *  vocabulaire que les autres Critiques (`critEntryItem`). */
function shipCritEntryItem(e: ShipCritEntry): CodexItem {
  const ch = e.crewHit;
  const jet = ch?.test?.test;
  const sujet = jet && (jet.skill ? refLabel('skills', jet.skill) : jet.characteristic ? CHAR_LABELS[jet.characteristic] : '');
  return depuisEnveloppe(e, {
    sub: `d10 ${e.min}–${e.max}`,
    desc: e.note,
    meta: facts(
      typeof e.shrapnel === 'number' ? fact('Éclats (Indice)', e.shrapnel) : null,
      e.hullCrits ? fact('Critiques Coque suppl.', e.hullCrits) : null,
    ),
    sections: sections(
      passiveSection(e.ops, 'Effet immédiat'),
      ch
        ? {
            title: 'Coup à l’équipage',
            layout: 'list',
            rows: [
              { t: 'kv', k: 'Jet', v: jet ? `${sujet}${jet.difficulty ? ` ${DIFFICULTY_LABELS[jet.difficulty]}` : ''}` : 'Automatique (aucun Test)' } as CodexRow,
              { t: 'kv', k: 'Cible', v: crewTargetLabel(ch.crewTarget) } as CodexRow,
            ],
          }
        : null,
      ch ? passiveSection(ch.test ? spellOps(ch.test.fail, 'target') : ch.ops, ch.test ? 'Conséquence (échec du Test)' : 'Conséquence (certaine)') : null,
    ),
  });
}

/** Item Codex d'un Événement de bord/de port (`SeaEventDef` — MDG 15, #157 suite) : plage de jet
 *  (d100 modifié par l'Humeur de Manann, ou 2d10) → texte verbatim. */
function seaEventItem(e: SeaEventDef): CodexItem {
  return depuisEnveloppe(e, { sub: `${e.min}–${e.max}` });
}

/** Item Codex d'un Facteur d'Humeur de Manann (`ManannFactor` — MDG 15, #157 suite) : effet signé
 *  (Nd10 + constante) appliqué UNE fois par navire. */
function manannFactorItem(f: ManannFactor): CodexItem {
  const eff = f.effect;
  const magnitude = eff.d10 > 0 ? diceLabel({ n: eff.d10, sides: 10, plus: eff.flat || undefined }) : String(eff.flat);
  return depuisEnveloppe(f, {
    meta: facts(fact('Effet sur l’Humeur de Manann', `${eff.sign > 0 ? '+' : '−'}${magnitude}`)),
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
  return { title: 'Modificateurs', layout: 'list', rows };
}

// ── LOT 1 #422 : famille NAVALE (MDG 12/13/15) — Ports, Progression, Navigation, Périls, Météo,
//    Construction navale. Ports & sous-tableaux de construction restent des CATÉGORIES-tableau (une
//    fiche par entité, patron `criticalsTete`) ; Navigation/Périls/Météo sont des FICHES DE RÈGLE
//    UNIQUES (dataset-objet, MÊME patron que `waterExposure`, #157 suite) — chaque config imbriquée
//    (Salissures, Orientation, Détroits, Tourbillons…) devient une section plutôt qu'une entité isolée. ──

/** Libellé FR d'une entrée de `production`/`surplus`/`demande` d'un Port (`naval-ports.json`) : le
 *  catalogue `sea-cargo.json` porte tout le vocabulaire de la colonne. Une MARCHANDISE ouvre un lien
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
  return entry && isEchangeable(entry) ? { t: 'ref', category: 'seaCargo', id: entry.id, label, show } : { t: 'chip', label: show };
}

/** Libellés FR des 4 Traits de CONSTRUCTION (`ship-construction.json::constructionTraits`, sans champ
 *  `label` en donnée — id STABLE déjà la clé, MDG 12 l.167-193). */
const CONSTRUCTION_TRAIT_LABEL: Record<string, string> = {
  'peu-maniable': 'Peu maniable', renforce: 'Renforcé', robuste: 'Robuste', solide: 'Solide',
};

/** Fait signé (« +10 % », « −20 », « 0 ») — évite de dupliquer le ternaire de signe à chaque site. */
const signedFact = (label: string, v: number | undefined, suffix = ''): CodexFact | null =>
  v == null ? null : fact(label, `${v > 0 ? '+' : ''}${v}${suffix}`);

/** Section « Propulsion & Manœuvrabilité » (MDG 12 l.131-144, `ship-construction.json::propulsion`/
 *  `::manoeuvrability`) — règle GLOBALE de construction (pas une entité par gabarit) : répétée telle
 *  quelle sur chaque fiche de coque (patron « note de règle partagée », comme `Ligne CE` sur un profil
 *  de créature). Lecture seule — les 2 sous-tables restent hors des 3 catégories-tableau (aucun id
 *  propre par ligne côté source), mais le FICHIER entier reste couvert par le schéma/la garde d'exposition. */
function shipConstructionRulesSection(): CodexSection {
  const p = shipConstruction.propulsion;
  return {
    title: 'Propulsion & Manœuvrabilité (règle de construction)', layout: 'list',
    rows: [
      { t: 'kv', k: 'Propulsion secondaire — malus au coût', v: `${p.secondaryMalus > 0 ? '+' : ''}${p.secondaryMalus}` } as CodexRow,
      { t: 'kv', k: 'Propulsion secondaire — M minimum', v: String(p.secondaryMinM) } as CodexRow,
      ...shipConstruction.manoeuvrability.map((m) => ({
        t: 'kv', k: `Manœuvrabilité ${m.manDR >= 0 ? '+' : ''}${m.manDR}`, v: `Coût ${m.costPct >= 0 ? '+' : ''}${m.costPct} %`,
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
  return typeof v === 'boolean' ? (v ? 'Activée' : 'Désactivée') : String(v);
}

/** Section « % de Disponibilité » (LDB 59 l.25-30, `disponibilite.json::dispoPct`) — une sous-tête par
 *  classe (Limitée/Rare), % de réussite du Test (d100 ≤ %) par taille de colonie. */
function dispoPctSection(rows: (typeof disponibilite)['dispoPct']): CodexSection {
  const rowsOut: CodexRow[] = [];
  for (const r of rows) {
    rowsOut.push({ t: 'sub', label: r.availability } as CodexRow);
    rowsOut.push({ t: 'kv', k: 'Village', v: `${r.pct.village} %` } as CodexRow);
    rowsOut.push({ t: 'kv', k: 'Ville', v: `${r.pct.ville} %` } as CodexRow);
    rowsOut.push({ t: 'kv', k: 'Cité', v: `${r.pct.cite} %` } as CodexRow);
  }
  return { title: '% de Disponibilité (Test d100 ≤ %, par taille de colonie)', layout: 'list', rows: rowsOut };
}

/** Section « Ratios de Troc » (LDB 59 l.68-76, `disponibilite.json::barterRatios`) — pour chaque
 *  Disponibilité de l'objet DONNÉ, le ratio `give:get` contre chaque Disponibilité de l'objet ACQUIS. */
function barterRatiosSection(rows: (typeof disponibilite)['barterRatios']): CodexSection {
  const rowsOut: CodexRow[] = [];
  for (const r of rows) {
    rowsOut.push({ t: 'sub', label: `Donné : ${r.give}` } as CodexRow);
    for (const acquired of AVAILABILITIES) {
      const ratio = r.ratios[acquired];
      rowsOut.push({ t: 'kv', k: `Acquis : ${acquired}`, v: `${ratio.give} : ${ratio.get}` } as CodexRow);
    }
  }
  return { title: 'Ratios de Troc (donné : acquis)', layout: 'list', rows: rowsOut };
}

// ── LOT 3 #422 (FINAL) : les 3 dernières exemptions AUDIT — Empoignade (LDB 14, fiche de règle
//    UNIQUE), Incantations Imparfaites/Colère des dieux (LDB 46/40, DIALECTE compilé — PAS de vrais
//    `GameOp`, cf. `MiscastRowEntry`/`engine/miscast.ts::JsonRow` — renderer DÉDIÉ ci-dessous, jamais
//    `passiveSection`), enjeux de la cascade de nuit (`night-stakes.json`, catégorie-tableau simple). ──

/** Libellé lisible d'un montant du DIALECTE miscast (nombre / dé / terme de Péché / somme —
 *  `JsonFormula`, `engine/miscast.ts`). Le terme de Péché n'est résolu qu'à l'exécution (Points de
 *  Péché du lanceur) : ici, affichage d'AUTEUR (« 1d10 + Points de Péché »), jamais une valeur bakée. */
function miscastAmountLabel(a: unknown): string {
  if (typeof a === 'number') return String(a);
  if (a && typeof a === 'object') {
    if ('sinPoints' in a) return 'Points de Péché';
    if ('sum' in a) return (a as { sum: unknown[] }).sum.map(miscastAmountLabel).join(' + ');
    if ('dice' in a) return formatDice((a as { dice: DiceSpec }).dice);
  }
  return String(a);
}

/** Une op du DIALECTE miscast (`JsonOp`) → sa ligne Codex — sous-ensemble des `op` réellement présents
 *  dans `miscast.json` (`condition`/`wounds`/`corruption`/`reduceToZero`/`castPenalty`, cf.
 *  `engine/miscast.ts::expandOp`). Chip cross-réf pour l'État ; texte structuré pour le reste. */
function miscastOpRow(o: Record<string, unknown>): CodexRow {
  switch (o.op) {
    case 'condition': {
      const id = String(o.id ?? '');
      const label = conditionLabel(id);
      const value = o.value != null ? miscastAmountLabel(o.value) : null;
      const dur = o.durationRounds != null ? `${miscastAmountLabel(o.durationRounds)} Round(s)` : undefined;
      // CAUSE PERSISTANTE (`LDB 16 l.117`) : la rangée pose UN État et le MAINTIENT — la persistance se
      // dit au BADGE de SA chip, du mot du journal et de la même forme que l'autre lecteur (`opRows`).
      const badge = [estCausePersistante(o) ? CAUSE_PERSISTANTE : undefined, dur].filter((s): s is string => !!s).join(' · ') || undefined;
      const show = value && value !== '1' ? `${value} × ${label}` : label;
      return { t: 'ref', category: 'etats', id, label, show, badge };
    }
    case 'wounds': {
      // Mitigation DITE par la donnée (`ignoreTB`/`ignoreAP`), aux trois régimes du RAW — LDB 46
      // l.63 et l.69, LDB 40 l.68.
      const ignore = [o.ignoreTB ? 'le Bonus d’Endurance' : null, o.ignoreAP ? 'les PA' : null].filter(Boolean);
      return { t: 'kv', k: 'Blessures', v: `${miscastAmountLabel(o.amount)}${ignore.length ? ` (ignorant ${ignore.join(' et ')})` : ''}` };
    }
    case 'corruption':
      return { t: 'kv', k: 'Corruption', v: `+${o.amount as number} point(s)` };
    case 'reduceToZero':
      return { t: 'text', text: 'Points de Blessure réduits à 0' };
    case 'castPenalty': {
      const skill = o.skill as { id: string } | undefined;
      const skillId = skill?.id;
      const dur = o.rounds != null ? `${miscastAmountLabel(o.rounds)} Round(s)`
        : o.hours != null ? `${miscastAmountLabel(o.hours)} heure(s)`
        : o.minutes != null ? `${miscastAmountLabel(o.minutes)} minute(s)`
        : o.days != null ? `${miscastAmountLabel(o.days)} jour(s)` : undefined;
      const eff = o.blocked ? 'Bloqué' : o.maxZeroDR ? 'DR plafonné à 0' : `${(o.mod as number | undefined) ?? 0}`;
      return skillId
        ? { t: 'ref', category: 'skills', id: skillId, label: refLabel('skills', skill!), show: `${eff}${dur ? ` (${dur})` : ''}` }
        : { t: 'kv', k: 'Magie', v: `${eff}${dur ? ` (${dur})` : ''}` };
    }
    default:
      return { t: 'text', text: String(o.op) };
  }
}

/** Section « Test imbriqué » d'une entrée miscast (« Résistance Accessible ou Sonné »), palier
 *  `onFailHard` inclus (« si vous échouez avec DR ≤ N → EN PLUS »). */
function miscastTestSection(t: NonNullable<MiscastRowEntry['test']>): CodexSection {
  const who = t.skill ? refLabel('skills', t.skill) : t.characteristic ? CHAR_LABELS[t.characteristic as keyof typeof CHAR_LABELS] : 'Test';
  const rows: CodexRow[] = [
    { t: 'kv', k: 'Test', v: `${who} ${DIFFICULTY_LABELS[t.difficulty as keyof typeof DIFFICULTY_LABELS]}` },
    { t: 'sub', label: 'Échec' },
    ...replieCausesPersistantes(t.onFail).map(miscastOpRow),
  ];
  if (t.onFailHard) rows.push({ t: 'sub', label: `Échec ≤ DR ${t.onFailHard.dr}` }, ...replieCausesPersistantes(t.onFailHard.ops).map(miscastOpRow));
  return { title: 'Test imbriqué', layout: 'list', rows };
}

/** Item Codex d'une entrée de table miscast (Incantation Imparfaite / Colère des dieux) — plage d100 →
 *  nom, effet immédiat (`ops`, dialecte) + Test imbriqué éventuel + relance (cascade/multiplication). */
function miscastRowItem(e: MiscastRowEntry): CodexItem {
  return depuisEnveloppe(e, {
    sub: `d100 ${e.min}–${e.max}`,
    meta: facts(e.reroll ? fact('Relance', e.reroll === 'majeure' ? 'Cascade → Tableau Majeur' : 'Multiplication (2 tirages Mineurs)') : null),
    sections: sections(
      e.ops?.length ? { title: 'Effet immédiat', layout: 'list', rows: replieCausesPersistantes(e.ops).map(miscastOpRow) } : null,
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
    scope.domainsExcept?.length ? `hors ${scope.domainsExcept.map((d) => refLabel('domains', { id: d })).join(', ')}` : undefined,
    scope.chaosMagic ? 'Magie du Chaos' : undefined,
    'dominantWinds' in scope && scope.dominantWinds ? 'Vent(s) prédominant(s)' : undefined,
    'nonDominantWinds' in scope && scope.nonDominantWinds ? 'Vent(s) non prédominant(s)' : undefined,
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
    m.drDie ? `1d${m.drDie.faces}/${m.drDie.divide}${m.drDie.perRound ? ' par Round' : ''}` : undefined,
    phenomenonScopeLabel(m.scope),
    m.windRestricted ? 'Vent(s) du site' : undefined,
  ].filter(Boolean).join(' · ');
  return { t: 'kv', k: tests, v };
}

/** Une rangée de modificateur de Niveau d'Incantation (`CastingNumberMod`) → ligne Codex. */
function niModRow(m: CastingNumberMod): CodexRow {
  const bits = [
    m.multiply ? `×${m.multiply}` : undefined,
    m.divide ? `÷${m.divide}${m.round ? ` (arrondi ${m.round})` : ''}` : undefined,
    m.delta ? `${m.delta >= 0 ? '+' : ''}${m.delta}` : undefined,
    m.min != null ? `plancher ${m.min}` : undefined,
  ].filter(Boolean).join(' ');
  return { t: 'kv', k: 'Niveau d’Incantation', v: [bits, phenomenonScopeLabel(m.scope)].filter(Boolean).join(' — ') };
}

/** Fait « Saturation environnementale » portée par un phénomène (`ArcanePhenomenon.saturation`). */
function phenomenonSaturationFact(s: ArcanePhenomenon['saturation']): CodexFact | null {
  if (!s) return null;
  const value = [
    s.levelsPerYear ? `${s.levelsPerYear >= 0 ? '+' : ''}${s.levelsPerYear} niveau/an` : undefined,
    s.levelsPerMonth ? `${s.levelsPerMonth >= 0 ? '+' : ''}${s.levelsPerMonth} niveau/mois` : undefined,
    s.levels ? `${s.levels >= 0 ? '+' : ''}${s.levels} niveau(x)` : undefined,
    s.viaGrandVortex ? 'via le Grand Vortex' : undefined,
    s.blocksPropagation ? 'bloque la propagation' : undefined,
    s.preventsJonctionSaturee ? 'empêche la Jonction saturée' : undefined,
    s.whenOffLine ? 'si hors ligne de force' : undefined,
  ].filter(Boolean).join(' · ');
  return fact('Saturation environnementale', value || null);
}

/** Rangées d'une table du chapitre (`ArcaneTable.rows`, plage d100/d10 → libellé), Domaine(s) liés
 *  quand la rangée en désigne (Flux magique). */
function arcaneTableRows(t: ArcaneTable): CodexRow[] {
  return t.rows.map((r) => ({
    t: 'kv',
    k: r.min === r.max ? String(r.min) : `${r.min}–${r.max}`,
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

const CODEX_SPECS: CodexCategorySpec[] = [
  {
    key: 'arcanePhenomena', label: 'Magie environnementale', group: 'Magie', sourceRef: 'VDM 14',
    build: () => {
      const d = datasetObject('arcanePhenomena') as {
        saturationLevels: SaturationLevel[]; windSaturationEffects: WindSaturationEffects[];
        phenomena: ArcanePhenomenon[]; tables: ArcaneTable[];
      };
      return [
        ...[...d.saturationLevels].sort((a, b) => a.order - b.order).map((l) => depuisEnveloppe(l, {
          group: 'Paliers de Saturation',
          meta: facts(
            fact('Effets de Saturation', l.effectsMin === l.effectsMax ? String(l.effectsMin) : `${l.effectsMin}–${l.effectsMax}`),
            fact('Peut se corrompre', l.corrupts ? 'oui (Geheimnisnacht/Hexensnacht)' : null),
          ),
          sections: l.testMods?.length ? sections({ title: 'Modificateurs de Test', layout: 'list', rows: l.testMods.map(testModRow) }) : undefined,
        })),
        ...d.windSaturationEffects.map((w) => depuisEnveloppe({ ...w, label: `${w.wind} — ${refLabel('domains', { id: w.domainId })}` }, {
          group: 'Effets de Saturation par Vent',
          sub: w.environments.join(', '),
          sections: sections(
            { title: 'Effets de Saturation', layout: 'list', rows: w.effects.map((e) => ({ t: 'kv', k: libelleDeValeur(saturationTierSchema, e.tier), v: e.label } as CodexRow)) },
            // Surnoms : des ÉTIQUETTES (un surnom par rangée), aucune entité désignée → pastille nue.
            w.surnoms.length ? { title: 'Surnoms', layout: 'chips', rows: w.surnoms.map((s) => ({ t: 'chip', label: s } as CodexRow)) } : null,
          ),
        })),
        ...d.phenomena.map((p) => depuisEnveloppe(p, {
          group: 'Phénomènes arcaniques', sub: libelleDeValeur(phenomenonKindSchema, p.kind),
          meta: facts(
            phenomenonSaturationFact(p.saturation),
            fact('Influence malfaisante', p.influenceMalveillante ? 'oui (WFJDR 236)' : null),
            fact('Incantation Critique', p.critOnTens ? 'deux fois plus probable (double ou finit par 0)' : null),
            fact('Démons invoqués', p.daemonsDoubled ? 'nombre doublé' : null),
            fact('Vent réfracté', p.singleWind ? 'un seul à la fois' : null),
            p.cancelsTraitId ? { label: 'Annule le Trait', value: refLabel('traits', { id: p.cancelsTraitId }), kref: { category: 'traits', id: p.cancelsTraitId, label: refLabel('traits', { id: p.cancelsTraitId }) } } : null,
            p.controlFlux ? fact('Contrôle du Flux', `Test de Focalisation ${DIFFICULTY_LABELS[p.controlFlux.difficulty as keyof typeof DIFFICULTY_LABELS] ?? p.controlFlux.difficulty}`) : null,
            p.overcastPerSpell ? fact('Surincantation par Sort', p.overcastPerSpell.dice) : null,
            p.stonePropertySlots ? fact('Propriétés de pierre gardienne', String(p.stonePropertySlots.max)) : null,
            p.draws ? fact('Tirages', String(p.draws)) : null,
          ),
          sections: sections(
            p.testMods?.length ? { title: 'Modificateurs de Test', layout: 'list', rows: p.testMods.map(testModRow) } : null,
            p.niMods?.length ? { title: 'Modificateurs de Niveau d’Incantation', layout: 'list', rows: p.niMods.map(niModRow) } : null,
            p.tableId || p.fluxTableId
              ? {
                title: 'Table associée', layout: 'list',
                rows: [p.tableId, p.fluxTableId].filter((id): id is string => !!id).map((id) => {
                  const t = d.tables.find((x) => x.id === id);
                  return { t: 'ref', category: 'arcanePhenomena', id, label: t?.label ?? id, show: t?.label ?? id } as CodexRow;
                }),
              }
              : null,
          ),
        })),
        ...d.tables.map((t) => depuisEnveloppe(t, {
          group: 'Tables', sub: `${t.rows.length} rangée(s) · ${t.die}`,
          sections: sections({ title: `Tirage (${t.die})`, layout: 'list', rows: arcaneTableRows(t) }),
        })),
      ];
    },
  },
  {
    key: 'advancementCosts', label: 'Coût des Augmentations', group: 'Tables', cluster: 'Création de personnage', sourceRef: 'LDB 07',
    build: () => datasetArray('advancementCosts').map((b) => depuisEnveloppe(b, {
      sub: 'Augmentations déjà achetées',
      meta: facts(fact('Coût — Caractéristique', b.coutCarac), fact('Coût — Compétence', b.coutCompetence)),
    })),
  },
  {
    key: 'disponibilite', label: 'Disponibilité & Troc', group: 'Tables', sourceRef: 'LDB 59',
    build: () => {
      const d = datasetObject('disponibilite');
      return [{
        id: 'disponibilite', label: 'Disponibilité & Troc (Faire son marché)',
        source: src(d.dispoPct[0]?.source),
        sections: sections(dispoPctSection(d.dispoPct), barterRatiosSection(d.barterRatios)),
      }];
    },
  },
  {
    key: 'sizes', label: 'Tailles — barres par catégorie', group: 'Tables', sourceRef: 'LDB 85',
    build: () => {
      const s = datasetObject('sizes');
      const cats = (Object.keys(SIZE_ORDER) as SizeCategory[]).sort((a, b) => SIZE_ORDER[a] - SIZE_ORDER[b]);
      const table = (title: string, t: Record<string, number>, fmt: (n: number) => string): CodexSection => ({
        title, layout: 'list',
        rows: cats.map((c) => ({ t: 'kv', k: SIZE_LABEL[c], v: fmt(t[c]) }) as CodexRow),
      });
      return [{
        id: 'sizes', label: 'Tailles — barres par catégorie',
        sections: sections(
          table('Modificateur d’à-toucher au TIR selon la Taille de la CIBLE (LDB 14 l.118-131)', s.rangedMod, (n) => (n > 0 ? `+${n}` : String(n))),
          table('Encombrement occupé à bord selon la Taille (MDG 12 l.25-33)', s.shipboardEnc, (n) => `${n} Enc`),
          table('Empreinte de grille par défaut — côté N de N×N (LDB 15 l.12 dit « 2, 4 ou même plus » sans barème : valeurs MAISON)', s.footprintSide, (n) => `${n}×${n} case(s)`),
        ),
      }];
    },
  },
  {
    key: 'drivingMishap', label: 'Accidents de Conduite d’attelage', group: 'Tables', cluster: 'Voyage terrestre', sourceRef: 'LDB 09',
    build: () => datasetArray('drivingMishap').map((e) => ({
      id: e.id, label: e.label, sub: `1d10 ${e.min}–${e.max}`, desc: e.desc,
      meta: facts(fact('Type', libelleDeValeur(drivingMishapOutcomeSchema, e.outcome))),
    })),
  },
  {
    key: 'drunkenness', label: 'Ivresse (Tableau)', group: 'Tables', sourceRef: 'LDB 09',
    build: () => datasetArray('drunkenness').map((e) => ({
      id: e.id, label: e.label, sub: `1d10 ${e.min}–${e.max}`, desc: e.desc,
      meta: facts(fact('Type', libelleDeValeur(drunkennessOutcomeSchema, e.outcome))),
      sections: sections(passiveSection(e.ops, 'Effet')),
    })),
  },
  {
    key: 'encumbranceTiers', label: 'Surchargé — Paliers d’Encombrement', group: 'Tables', sourceRef: 'LDB 61',
    build: () => datasetArray('encumbranceTiers').map((t) => ({
      id: t.id, label: t.label,
      meta: facts(
        fact('Pénalité de Mouvement', t.immobile ? 'Immobilisé' : (t.movePenalty ? `−${t.movePenalty} (plancher ${t.moveFloor})` : 'Aucune')),
        fact('Pénalité d’Agilité', t.agilityPenalty ? String(t.agilityPenalty) : null),
        fact('Fatigue de voyage (États Exténué)', t.travelFatigue || null),
      ),
      source: src(t.source),
    })),
  },
  {
    key: 'riverNavigation', label: 'Navigation fluviale (Vent, Chavirage, Échouage)', group: 'Tables', cluster: 'Mer & rivière', sourceRef: 'MSRC 7',
    build: () => {
      const n = datasetObject('riverNavigation');
      const forceLabel = new Map(n.windForces.map((f) => [f.id, f.label]));
      const dirLabel = new Map(n.windDirections.map((d) => [d.id, d.label]));
      const effectText = (e: { pct?: number; drift?: boolean; tack?: boolean; capsizeRisk?: boolean; riggingRisk?: boolean } | undefined): string => {
        if (!e) return '—';
        const parts: string[] = [];
        if (e.pct != null) parts.push(`${e.pct > 0 ? '+' : ''}${e.pct} % vitesse`);
        if (e.drift) parts.push('Dérive (Navigation −10)');
        if (e.tack) parts.push('Louvoyer (Navigation Accessible +20)');
        if (e.capsizeRisk) parts.push('Risque de chavirage');
        if (e.riggingRisk) parts.push('Risque au gréement');
        return parts.join(' · ') || '—';
      };
      return [{
        id: 'riverNavigation', label: 'Navigation fluviale', source: src(n.source),
        meta: facts(
          fact('Savoir (Voies fluviales)', `+${n.savoirVoiesFluvialesDR} DR`),
          fact('Difficulté de base', DIFFICULTY_LABELS[n.navBaseDifficulty]),
          fact('Difficulté de Louvoyer', DIFFICULTY_LABELS[n.tackDifficulty]),
        ),
        sections: sections(
          {
            title: 'Force du vent (1d10)', layout: 'list',
            rows: n.windForces.map((f) => ({ t: 'kv', k: `1d10 ${f.min}–${f.max}`, v: f.label } as CodexRow)),
          },
          {
            title: 'Direction du vent (1d10, relative au bateau)', layout: 'list',
            rows: n.windDirections.map((d) => ({ t: 'kv', k: `1d10 ${d.min}–${d.max}`, v: d.label } as CodexRow)),
          },
          {
            title: 'Effet du vent (Force × Direction)', layout: 'list',
            rows: n.windForces.flatMap((f) => n.windDirections.map((d) => ({
              t: 'kv', k: `${forceLabel.get(f.id)} · ${dirLabel.get(d.id)}`, v: effectText(n.windEffect[f.id]?.[d.id as 'arriere' | 'cote' | 'contraire']),
            } as CodexRow))),
          },
          {
            title: 'Agilité de rame (Test quotidien)', layout: 'list',
            rows: [
              { t: 'kv', k: 'Difficulté', v: DIFFICULTY_LABELS[n.rowingAgility.difficulty] } as CodexRow,
              { t: 'kv', k: 'Échec', v: `${n.rowingAgility.failSpeedPct} % vitesse` } as CodexRow,
              { t: 'kv', k: `Échec spectaculaire (DR ≤ ${n.rowingAgility.spectacularSL})`, v: `×${n.rowingAgility.spectacularSpeedFactor} vitesse` } as CodexRow,
            ],
          },
          {
            title: 'Chavirage (Très fort de côté)', layout: 'list',
            rows: [
              { t: 'kv', k: 'Retirer la voile', v: DIFFICULTY_LABELS[n.capsize.removeSailDifficulty] } as CodexRow,
              { t: 'kv', k: 'Redresser (par Round)', v: `${DIFFICULTY_LABELS[n.capsize.rightDifficulty]} (−${Math.abs(n.capsize.rightCumulativePenalty)} cumulatif par échec)` } as CodexRow,
            ],
          },
          {
            title: 'Autres dangers', layout: 'list',
            rows: [
              { t: 'kv', k: 'Hors de contrôle', v: `${n.outOfControl.navPenalty} Navigation` } as CodexRow,
              { t: 'kv', k: 'S’échouer', v: `${n.echouage.hullDamage} Dégâts de coque` } as CodexRow,
              { t: 'kv', k: 'Réparation temporaire', v: `${DIFFICULTY_LABELS[n.temporaryRepair.difficulty]} (Charpentier ${n.temporaryRepair.charpentierPenalty}, ${n.temporaryRepair.woundsPerRepair} Blessures)` } as CodexRow,
            ],
          },
        ),
      }];
    },
  },

  // ── LOT 3 #422 (FINAL) : les 3 dernières exemptions AUDIT ──
  {
    key: 'grapple', label: 'Empoignade — mécanique', group: 'Tables', sourceRef: 'LDB 14',
    build: () => {
      const g = datasetObject('grapple');
      return [{
        id: 'grapple', label: 'Empoignade — mécanique (GameOp)',
        source: src(g.source),
        sections: sections(
          passiveSection(g.init, 'À la touche (Empêtré)'),
          passiveSection(g.win.damage, 'Test opposé gagné — Infliger des Dégâts'),
          passiveSection(g.win.entangle, 'Test opposé gagné — Empêtrer davantage'),
          passiveSection(g.win.free, 'Test opposé gagné — Se libérer'),
        ),
      }];
    },
  },
  {
    key: 'miscastMinor', label: 'Incantations Imparfaites — Mineures', group: 'Magie', sourceRef: 'LDB 46',
    build: () => datasetArray('miscastMinor').map(miscastRowItem),
  },
  {
    key: 'miscastMajor', label: 'Incantations Imparfaites — Majeures', group: 'Magie', sourceRef: 'LDB 46',
    build: () => datasetArray('miscastMajor').map(miscastRowItem),
  },
  {
    key: 'miscastWrath', label: 'Colère des dieux', group: 'Magie', sourceRef: 'LDB 40',
    build: () => datasetArray('miscastWrath').map(miscastRowItem),
  },
  {
    key: 'nightStakes', label: 'Enjeux — cascade de repos', group: 'Tables', sourceRef: 'LDB 18/09/20/21',
    build: () => datasetArray('nightStakes').map((e) => depuisEnveloppe(e, { desc: e.stake })),
  },
  {
    // Jumeau du précédent pour les cascades de VOYAGE (#1117) : le contenu est un GABARIT de descripteur
    // mécanique (trous `{nom}` remplis par le flux), là où l'enjeu de nuit est un verbatim figé.
    key: 'voyageStakes', label: 'Enjeux — cascade de voyage', group: 'Tables', sourceRef: 'MSRC 7 · MDG 12',
    build: () => datasetArray('voyageStakes').map((e) => depuisEnveloppe(e, { desc: e.template })),
  },
  {
    // Troisième dataset de la famille (#1117 L1b) : l'enjeu d'un JET DE MODALE MONO, keyé par l'id de
    // jet `{flow, phase}`. Éditable comme ses jumeaux — le contenu est un descripteur mécanique.
    key: 'flowStakes', label: 'Enjeux — modales de jet', group: 'Tables', sourceRef: 'LDB 15/16/19/46/62 · MDG 09/12/14',
    build: () => datasetArray('flowStakes').map((e) => depuisEnveloppe(e, { sub: `${e.flow}/${e.phase}`, desc: e.template })),
  },
  {
    // Quatrième dataset de la famille (#1117 L2) : l'enjeu d'une étape de cascade de COMBAT, keyé par
    // le `kind` de son applier. Éditable comme ses jumeaux — descripteur mécanique lu à l'applier.
    key: 'combatStakes', label: 'Enjeux — cascade de combat', group: 'Tables', sourceRef: 'LDB 16/19/20/47/85 · AA 07',
    build: () => datasetArray('combatStakes').map((e) => depuisEnveloppe(e, { sub: e.kind, desc: e.template })),
  },

  {
    key: 'races', label: 'Races', group: 'Personnage',
    build: () => species.map((s) => ({
      id: s.id,
      label: s.label,
      group: family(s.label),
      desc: s.desc,
      source: src(s.source),
      // Aperçu rig DATA-DRIVEN (même chemin que le créateur) : la fiche de race montre sa silhouette.
      appearance: { species: rigSpeciesId(s.id) },
      meta: facts(fact('Mouvement', s.movement), fact('Destin', s.fate?.fate), fact('Résilience', s.fate?.resilience)),
      // Contenu = SOURCE UNIQUE partagée avec le créateur (plus de ré-implémentation divergente).
      tabs: raceFicheTabs(s),
    })),
  },
  {
    // Les desc de Carrière (LDB 2) suivent la convention d'épigraphe WFRP : leurs couples
    // citation+attribution se rendent en carte-parchemin, à LEUR place dans le corps.
    key: 'careers', label: 'Carrières', group: 'Personnage', exergues: true,
    build: () => careers.map((c) => {
      const levels = levelsForCareer(c.id);
      const className = findClassById(c.class)?.label ?? c.class;
      // Les 4 échelons réunis en UN onglet « Progression » (au lieu d'un onglet par niveau) → la
      // montée en Carrière se lit d'un trait ; la description flavor gagne en proéminence relative.
      const levelSections: CodexSection[] = levels.map((lv) => ({
        title: `Niveau ${lv.level} : ${lv.label} — ${lv.status}`,
        layout: 'chips' as const,
        rows: [
          // Les Caractéristiques avancées sont des IDS (`CharKey` = id de `characteristics.json`) :
          // elles sortent en rangées de référence, jamais en phrase jointe re-appariée par libellé.
          ...(lv.characteristics.length ? [{ t: 'sub', label: 'Caractéristiques avancées' } as CodexRow, ...charRefRows(lv.characteristics)] : []),
          ...(lv.skills.length ? [{ t: 'sub', label: 'Compétences' } as CodexRow, ...lv.skills.map((a) => advancementRow('skills', a))] : []),
          ...(lv.talents.length ? [{ t: 'sub', label: 'Talents' } as CodexRow, ...lv.talents.map((a) => advancementRow('talents', a))] : []),
          ...(lv.trappings.length ? [{ t: 'sub', label: 'Possessions' } as CodexRow, ...trappingRefRows(lv.trappings)] : []),
        ],
      }));
      return depuisEnveloppe(c, {
        sub: className, group: className,
        // Faits-clés en en-tête (comme les Races portent M/Destin/Résilience) : Classe + fourchette de Statut social.
        meta: facts(fact('Classe', className), fact('Statut', careerStatusRange(levels))),
        tabs: [
          ...(levelSections.length ? [{ title: 'Progression', sections: levelSections }] : []),
          ...reverseSections('careers', c.id).map((s) => ({ title: s.title, sections: [s] })), // Races y accédant
        ],
      });
    }),
  },
  {
    key: 'characteristics', label: 'Caractéristiques', group: 'Personnage',
    build: () => characteristics.map((c) => depuisEnveloppe(c, {
      sub: c.abr,
      // Bonus de Caractéristique = chiffre des dizaines (LDB 03) — rappel sur les caracs à jet (d100).
      meta: c.nature === 'roll' ? facts(fact('Bonus', 'chiffre des dizaines')) : undefined,
      sections: sections(
        // DÉPENSES de la ressource (Résilience : ses deux choix) — la règle vit sur l'ENTITÉ qui la
        // porte (amendement A, #1117) ; `regles.json` ne garde que les règles de CADRE. Même forme
        // qu'une section dérivée d'un champ de donnée (`symptoms.onTick`) : un sous-en-tête par
        // option, son verbatim dessous — DÉDOUBLONNÉ à l'AFFICHAGE par `optionBody`.
        c.options?.length
          ? {
            title: 'Dépenses', layout: 'list' as const,
            // PORTEUR licite malgré le dédoublonnage : `optionBody` ne réécrit rien — il RETRANCHE le
            // libellé répété en tête, donc le rendu est un SOUS-TEXTE CONTIGU de `options[i].desc`.
            rows: c.options.flatMap((o, i) => [{ t: 'sub', label: o.label } as CodexRow, { t: 'text', text: optionBody(o), porteur: { chemin: `options[${i}].desc` } } as CodexRow]),
          }
          : null,
        ...reverseSections('characteristics', c.id),
      ),
    })),
  },
  {
    key: 'classes', label: 'Classes', group: 'Personnage',
    build: () => classes.map((c) => depuisEnveloppe(c, {
      sections: sections(trappingChips('Possessions de départ', c.trappings), ...reverseSections('classes', c.id)),
    })),
  },
  {
    key: 'stars', label: 'Étoiles', group: 'Personnage',
    build: () => stars.map((s) => depuisEnveloppe(s, {
      sub: s.signe ?? undefined,
      meta: facts(fact('Dates', s.dates), fact('Dieu', s.dieux), fact('Ascendant', s.ascendant)),
      sections: sections(passiveSection(s.ops, 'Effet du signe')),
    })),
  },
  {
    key: 'skills', label: 'Compétences', group: 'Compétences',
    build: () => skills.map((s) => depuisEnveloppe(s, {
      sub: join(CHAR_LABELS[s.characteristic], valeurFR('skills.json', 'acces', s.acces)),
      meta: facts(fact('Caractéristique', CHAR_LABELS[s.characteristic]), fact('Accès', valeurFR('skills.json', 'acces', s.acces)), fact('Spécialisations', specsFact('skills', s))),
      sections: sections(...reverseSections('skills', s.id)),
    })),
  },
  {
    key: 'talents', label: 'Talents', group: 'Compétences',
    build: () => talents.map((t) => {
      // Entrée EFFECTIVE sous les règles optionnelles actives (#563/#564) : desc, source, Test, Max,
      // passifs et effets affichés sont ceux de la variante réglée quand elle est active.
      const e = effectiveEntry(t);
      return depuisEnveloppe(e, {
      meta: facts(fact('Max', talentMaxLabel(e.max)), fact('Test', e.test?.raw ?? null), fact('Spécialisations', specsFact('talents', e))),
      sections: sections(
        careerGrantSection(e.passive), // Compétence/Talent ajouté à toute carrière (Maître artisan, Flagellant…)
        passiveSection(e.passive),
        effectsSection(e.effects, 'Effets déclenchés'),
        ...reverseSections('talents', e.id), // Races · Carrières (rang) · Créatures · Talents le conférant
      ),
      });
    }),
  },
  {
    key: 'axes', label: 'Axes de forces', group: 'Compétences',
    build: () => allAxes.map((a) => depuisEnveloppe(a, {
      meta: facts(fact('Portée', a.core ? 'Socle de base' : 'Axe de scénario')),
      sections: sections(
        a.skills?.length ? { title: 'Compétences', layout: 'chips', rows: a.skills.map((r) => idRefRow('skills', r.id, r.spec)) } : null,
        a.talents?.length ? { title: 'Talents', layout: 'chips', rows: a.talents.map((r) => idRefRow('talents', r.id, r.spec)) } : null,
      ),
    })),
  },
  {
    key: 'trappings', label: 'Possessions', group: 'Équipement',
    build: () => trappings.map((t) => {
      // Capacités FONCTIONNELLES (canal `capabilities`, lu PAR ID — ≠ nom FR) + arme dérivée tant qu'équipée.
      const caps = t.capabilities;
      const props = [
        caps?.weatherProtection ? 'Protège des intempéries' : null,
        caps?.isShelter ? 'Abri de campement' : null,
        caps?.isRations ? 'Ration de voyage' : null,
        caps?.isGrimoire ? 'Grimoire (lecture de Sorts)' : null,
        caps?.preventForcedDrop ? 'Empêche le lâcher forcé (gantelet verrouillé)' : null,
        t.derivedWeapon ? `Arme dérivée : ${t.derivedWeapon.label} (${damageString(t.derivedWeapon.damage)})` : null,
      ].filter(Boolean) as string[];
      // Allonge = mêlée, Portée = distance (LDB 62). Tir/munition : « Portée 50 m » (fixe) / « BF×3 m » (jet)
      // sinon le modificateur de munition (« Portée ×½ », `ammoRangeModLabel`) ; jamais « Allonge 50 ».
      const reachFact = (t.categorie === 'ranged' || t.categorie === 'ammunition')
        ? fact('Portée', rangeSpecLabel(t.range) ?? ammoRangeModLabel(t.ammoRangeMod))
        : fact('Allonge', t.reach);
      return depuisEnveloppe(t, {
        sub: join(libelleDeValeur(trappingCategorieSchema, t.categorie), weaponGroupLabel(t.subType) || undefined),
        meta: facts(fact('Prix', priceLabel(t.price)), fact('Enc', t.enc), fact('Disponibilité', t.availability), fact('Emplacement', t.loc), fact('Dégâts', damageFact(t)), fact('PA', t.pa), reachFact),
        sections: sections(
          chips('Qualités', resolveQualities({ qualities: t.qualities, subType: t.subType }).map((r) => idRefRow('qualities', r.id, undefined, qualityRefLabel({ id: r.id, value: r.indice })))),
          props.length ? { title: 'Propriétés', layout: 'list', rows: [{ t: 'text', text: props.join(' · ') }] } : null,
          ...reverseSections('trappings', t.id),
        ),
      });
    }),
  },
  {
    key: 'siegeEngines', label: 'Engins de siège', group: 'Équipement',
    // Engins de siège = Possessions portant l'art d'affût `siegeRig` (les mêmes que la Palette de
    // l'éditeur, `siegeEngines`). Miroir de « Créatures » pour l'aperçu rig (l'affût est rendu par le
    // MÊME chemin — appearance.species = siegeRig) ET de « Possessions » pour les faits d'arme
    // (Portée/Dégâts) + Atouts (l'Indice « Arme d'équipe N » = équipage requis).
    build: () => siegeEngines().map((t) => depuisEnveloppe(t, {
      sub: join(libelleDeValeur(trappingCategorieSchema, t.categorie), weaponGroupLabel(t.subType) || undefined),
      // Aperçu rig de l'affût, résolu comme une créature (par id + apparence species).
      appearance: { species: t.siegeRig! }, previewRef: t.siegeRig!,
      meta: facts(
        fact('Prix', priceLabel(t.price)), fact('Enc', t.enc), fact('Disponibilité', t.availability),
        fact('Dégâts', damageFact(t)), fact('PA', t.pa),
        fact('Portée', rangeSpecLabel(t.range) ?? ammoRangeModLabel(t.ammoRangeMod)),
      ),
      sections: sections(
        chips('Qualités', t.qualities.map((q) => idRefRow('qualities', q.id, undefined, qualityRefLabel(q)))),
        ...reverseSections('trappings', t.id),
      ),
    })),
  },
  {
    key: 'weaponGroups', label: 'Groupes d’objet', group: 'Équipement',
    build: () => weaponGroups.map((g) => depuisEnveloppe(g, { sub: valeurFR('weaponGroups.json', 'kind', g.kind), sections: sections(...reverseSections('weaponGroups', g.id)) })),
  },
  {
    key: 'qualities', label: 'Qualités', group: 'Équipement',
    build: () => qualities.map((q) => depuisEnveloppe(q, {
      sub: join(qualityTypeLabel(q.polarite), qualitySubtypeLabel(q.subType)),
      sections: sections(capabilitySection(q.capabilities as Record<string, unknown> | undefined, QUALITY_CAP_LABEL), passiveSection(q.passive), effectsSection(q.effects, 'Effets déclenchés'), ...reverseSections('qualities', q.id)),
    })),
  },
  {
    key: 'etats', label: 'États', group: 'Effets',
    build: () => etats.map((e) => depuisEnveloppe(e, {
      sections: sections(...reverseSections('etats', e.id)), // Sorts/Traits/Qualités/Talents/Domaines l'infligeant
    })),
  },
  {
    key: 'maladies', label: 'Maladies', group: 'Effets',
    build: () => maladies.map((m) => depuisEnveloppe(m, {
      sub: m.symptoms.map((s) => symptomLabel(s.symptomId)).join(', '),
      meta: facts(
        fact('Contraction', DIFFICULTY_LABELS[m.contractDifficulty]),
        fact('Incubation', formatDiseaseTime(m.incubation)),
        fact('Durée', formatDiseaseTime(m.duration)),
      ),
      sections: sections({
        title: 'Symptômes', layout: 'list',
        rows: m.symptoms.map((s) => ({
          // `spec` = localisation/précision imprimée de l'instance (« Gonflement (Visage et tête) », EDO 11 l.119).
          t: 'kv', k: `${symptomLabel(s.symptomId)}${s.spec ? ` (${s.spec})` : ''}`,
          v: [s.severity ? libelleDeValeur(symptomSeveritySchema, s.severity) : null, s.difficulty ? `Test ${DIFFICULTY_LABELS[s.difficulty]}` : null].filter(Boolean).join(' · ') || '—',
        } as CodexRow)),
      }),
    })),
  },
  {
    key: 'symptoms', label: 'Symptômes', group: 'Effets',
    build: () => symptoms.map((s) => depuisEnveloppe(s, {
      sections: sections(
        passiveSection(s.passive),
        ...SYMPTOM_SEVERITIES.map((cle) => passiveSection(s.passiveBySeverity?.[cle], `Modificateurs (${libelleDeValeur(symptomSeveritySchema, cle)})`)),
        s.onTick
          ? {
              title: 'Cycle quotidien', layout: 'list',
              rows: [
                { t: 'kv', k: 'Difficulté', v: s.onTick.test?.test.difficulty ? DIFFICULTY_LABELS[s.onTick.test.test.difficulty] : 'inconditionnel' } as CodexRow,
                s.onTick.afterDays ? ({ t: 'kv', k: 'Déclenchement', v: `${s.onTick.once ? 'une fois, au' : 'à partir du'} ${s.onTick.afterDays}ᵉ jour de phase active` } as CodexRow) : null,
                // Conséquence : branche `fail` du nœud `test`, ou ops CERTAINES d'un cycle sans jet (ops
                // directes ou `rollTable` : table EXPANSÉE en rangées lisibles).
                ...opRows(s.onTick.test ? spellOps(s.onTick.test.fail, 'target') : (s.onTick.ops ?? [])),
              ].filter((r): r is CodexRow => r != null),
            }
          : null,
        capabilitySection(s.capabilities as Record<string, unknown> | undefined, SYMPTOM_CAP_LABEL),
      ),
    })),
  },
  {
    key: 'mutations', label: 'Mutations', group: 'Effets',
    build: () => mutations.map((m) => depuisEnveloppe(m, {
      sub: valeurFR('mutations.json', 'kind', m.kind),
      group: valeurFR('mutations.json', 'kind', m.kind),
      appearance: m.appearance,
      ...(m.appearance ? { previewPorteur: porteurDApercu('mutations') } : {}),
      // PA / arme naturelle / traits conférés sont désormais des GameOps du `passive` (ap /
      // grantNaturalWeapon / grantTrait) → rendus par passiveSection ; plus de facts/chips dédiés.
      sections: sections(
        passiveSection(m.passive),
        ...reverseSections('mutations', m.id), // Tables de Corruption la tirant
      ),
    })),
  },
  {
    key: 'mutationTables', label: 'Tables de Corruption', group: 'Effets',
    build: () => mutationTables.map((t) => depuisEnveloppe(t, {
      sub: `${t.ranges.length} plages d100`,
      // Tirage d100 → Mutation : chaque plage est un lien cross-réf vers la fiche de mutation.
      sections: sections({
        title: 'Tirage (d100 → Mutation)', layout: 'list',
        rows: t.ranges.map((r) => {
          const label = mutations.find((mu) => mu.id === r.mutation)?.label ?? r.mutation;
          return { t: 'ref', category: 'mutations', id: r.mutation, label, show: label, badge: `${r.min}–${r.max}` } as CodexRow;
        }),
      }),
    })),
  },
  {
    key: 'effectTables', label: 'Tables d’effets', group: 'Effets',
    // Tables `[min,max] → GameOp[]` référencées par l'op `rollTable` (Allure démoniaque : Tableau des
    // aspects démoniaques par Domaine du Chaos). Chaque rangée = fourchette + ops (chips codex-liées).
    build: () => effectTables.map((t) => depuisEnveloppe(t, {
      sub: `${t.rows.length} rangée(s) · ${t.die}`,
      sections: sections({ title: `Tirage (${t.die} → effet)`, layout: 'list', rows: tableRows(t.rows) }),
    })),
  },
  {
    key: 'maneuvers', label: 'Manœuvres', group: 'Effets',
    // Une manœuvre est la PROJECTION mécanique d'un Trait de créature (#1226) : la prose affichée est le
    // VERBATIM du trait projetant (`traitProjectingManeuver`), jamais un résumé recopié dans la manœuvre.
    build: () => maneuvers.map((m) => depuisEnveloppe(m, {
      sub: libelleDeValeur(attackKindSchema, m.kind), desc: traitProjectingManeuver(m.id)?.desc,
      meta: facts(
        fact('Activation', valeurFR('maneuvers.json', 'activation', m.activation)),
        fact('Coût Av', m.advantageCost),
        fact('Portée', m.range ? formatManeuverMeasure(m.range) : null),
        fact('Cible', valeurFR('maneuvers.json', 'targeting', m.targeting)),
      ),
      sections: sections(...reverseSections('maneuvers', m.id)),
    })),
  },
  {
    key: 'psychologie', label: 'Psychologie', group: 'Effets',
    // Filtre DATA-DRIVEN des Traits à capacité psychologique (LDB 21, migration #1) : réutilise la
    // fiche de Trait (traitItem) — « Créatures ayant ce trait » montre QUI cause/possède la Psychologie.
    // Groupés par type (Peur, Terreur, Animosité…). Édition = catégorie « Traits » (source unique).
    build: () => traits
      .filter((t) => t.capabilities?.psychType || t.capabilities?.psychImmune)
      .map((t) => ({ ...traitItem(t, 'psychologie'), group: t.capabilities?.psychType ? psychologyLabel(t.capabilities.psychType) : 'Immunité' })),
  },
  {
    key: 'domains', label: 'Domaines', group: 'Magie',
    build: () => domains.map((d) => depuisEnveloppe(d, {
      meta: facts(
        fact('Projectile', d.missile ? `ignore les PA ${d.missile.bypass === 'metal' ? 'métalliques' : 'non magiques'}${d.missile.bonusFromBypass ? ' (+ Dégâts)' : ''}` : null),
        fact('Bonus d’incantation', d.castBonus ? humanizeCastBonus(d.castBonus) : null),
        fact('Post-incantation', d.casterOps?.length ? `${d.casterOps.length} op(s) au lanceur` : null),
      ),
      sections: sections(effectsSection(d.effects, 'Riders à la touche'), ...reverseSections('domains', d.id)),
    })),
  },
  {
    key: 'spells', label: 'Sorts', group: 'Magie',
    // Entrée EFFECTIVE sous les règles optionnelles actives (#563/#564) : desc, source, NI, Durée et
    // effet mécanique affichés sont ceux de la variante réglée quand elle est active (VDM).
    build: () => spells.map((s0) => effectiveEntry(s0)).map((s) => depuisEnveloppe(s, {
      sub: join(s.ecole, s.subType),
      meta: facts(
        // Un Rituel dont la rubrique NI imprime une formule sur la cible (`VDM 02 l.379`) n'a pas
        // de nombre : c'est ce texte qui est le NI imprimé.
        fact('NI', withReduced(s.cn ?? s.ritual?.cnFrom, s.ritual?.reduced?.cn)),
        fact('PX d’apprentissage', withReduced(s.ritual?.xp, s.ritual?.reduced?.xp)),
        fact('Portée', s.range ? formatSpellRange(s.range) : null),
        fact('Cible', s.target ? formatSpellTarget(s.target) : null),
        fact('Durée', s.duration ? formatSpellDuration(s.duration) : null),
        // Projectile magique (#2 data-driven) : Dégâts additifs + DR + BFM, ignore éventuellement PA/BE.
        fact('Projectile', s.missile ? `Dégâts ${s.damage ? `${s.damage} + ` : ''}DR + BFM${s.ignorePA ? ' · ignore PA' : ''}${s.ignoreBE ? ' · ignore BE' : ''}` : null),
      ),
      sections: sections(
        ritualSection(s.ritual), // Anatomie d'un Rituel (`VDM 02 l.377-393`)
        spellFlowSection(s.effects), // Effet mécanique (Flow) — #5 data-driven
        ...reverseSections('spells', s.id), // Cultes (Bénédictions/Miracles) · Créatures · Domaine
      ),
    })),
  },
  {
    key: 'gods', label: 'Dieux', group: 'Magie',
    build: () => gods.map((c) => depuisEnveloppe(c, {
      sub: c.title,
      sections: sections(
        chips('Bénédictions', c.blessings.map((id) => idRefRow('spells', id))),
        chips('Miracles', c.miracles.map((id) => idRefRow('spells', id))),
        chips('Sorts du Chaos', (c.chaosSpells ?? []).map((id) => idRefRow('spells', id))),
      ),
    })),
  },
  {
    key: 'ventsTourbillonnants', label: 'Vents Tourbillonnants', group: 'Magie',
    // Option `vents-tourbillonnants` (LDB 46 l.179-190) : table 1d10 de force des Vents, ajoutée
    // aux Tests d'Incantation/Focalisation (`engine/windsOfMagic.ts`).
    build: () => windsOfMagicTable.map((e) => ({
      id: e.id, label: e.label, sub: `1d10 ${e.min}${e.max > e.min ? `–${e.max}` : ''}`,
      meta: facts(fact('Modificateur', e.mod >= 0 ? `+${e.mod}` : `${e.mod}`)),
    })),
  },
  {
    key: 'creatures', label: 'Créatures', group: 'Monde',
    build: () => creatures.map((c) => depuisEnveloppe(c, {
      sub: c.title ?? undefined, group: c.folder ?? undefined,
      appearance: c.appearance, previewRef: c.id, // aperçu rig résolu par id (Nuées/non-bipèdes lisent leurs traits)
      statblock: creatureStatblock(c),
      meta: facts(
        // pastille d'en-tête TOUJOURS visible : marque l'individu nommé (lu via `isNamed`, jamais via `title`).
        isNamed(c) ? fact('Type', 'Individu nommé') : null,
        c.harvest ? fact('Récolte (1 Enc)', formatMoney(costPerEnc(c.harvest))) : null,
      ),
      sections: sections(
        { title: 'Caractéristiques', layout: 'grid', rows: kvRows(Object.entries(c.char)) },
        chips('Traits', traitRefRows(c.traits)),
        chips('Traits optionnels', (c.optionals ?? []).map((e) => (isOptionalNote(e) ? { t: 'chip', label: e.label } as CodexRow : idRefRow('traits', e.id, undefined, formatTrait(e))))),
        chips('Compétences', c.skills.map((r) => idRefRow('skills', r.id, r.spec, skillRefLabel(r)))),
        chips('Talents', c.talents.map((r) => idRefRow('talents', r.id, r.spec, talentRefLabel(r)))),
        chips('Sorts', c.spells.map((id) => idRefRow('spells', id))),
        trappingChips('Possessions', c.trappings),
        c.harvest
          ? {
              title: 'Récolte (Précieuses Entrailles)',
              layout: 'list',
              rows: [
                { t: 'kv', k: 'Rareté', v: c.harvest.rarity },
                { t: 'kv', k: 'Dangerosité', v: c.harvest.danger },
                { t: 'kv', k: 'Valeur (1 Enc, conservé)', v: formatMoney(costPerEnc(c.harvest)) },
                { t: 'text', text: c.harvest.uses, porteur: { chemin: 'harvest.uses' } },
              ],
            }
          : null,
      ),
    })),
  },
  {
    key: 'traits', label: 'Traits', group: 'Monde',
    build: () => traits.map((t) => traitItem(t, 'traits')),
  },
  {
    key: 'locations', label: 'Lieux', group: 'Monde',
    // `parent` est un id → résolu en libellé pour l'affichage ; la réf inverse « Sous-lieux » clé par id.
    build: () => locations.map((l) => {
      const parentLabel = findLocationById(l.parent)?.label;
      return depuisEnveloppe(l, {
        sub: parentLabel, group: parentLabel,
        sections: sections(...reverseSections('locations', l.id)),
      });
    }),
  },
  {
    key: 'books', label: 'Livres', group: 'Monde',
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
  {
    key: 'careerLevels', label: 'Niveaux de carrière', group: 'Tables',
    // Le `label` reste composé par `entryKey` (même composition côté éditeur `CodexEdit`) : un même
    // libellé de niveau sert plusieurs carrières, il n'identifie rien à lui seul. L'`id`, lui, est
    // celui de la DONNÉE (#1467 L1b V-P1) — le registre ne recompose plus d'identité.
    build: () => careerLevels.map((lv) => depuisEnveloppe(lv, {
      label: entryKey(lv as unknown as Record<string, unknown>),
      sub: lv.status, group: findCareerById(lv.career)?.label ?? lv.career,
      sections: sections(
        lv.characteristics.length ? { title: 'Caractéristiques avancées', layout: 'chips', rows: charRefRows(lv.characteristics) } : null,
        chips('Compétences', lv.skills.map((a) => advancementRow('skills', a))),
        chips('Talents', lv.talents.map((a) => advancementRow('talents', a))),
        trappingChips('Possessions', lv.trappings),
      ),
    })),
  },
  {
    key: 'eyes', label: 'Couleur des yeux', group: 'Tables', cluster: 'Création de personnage',
    build: () => eyes.map((e) => depuisEnveloppe(e, { sub: `2d10 ≤ ${e.rand}`, sections: sections(colorTableSection(e)) })),
  },
  {
    key: 'hairs', label: 'Couleur des cheveux', group: 'Tables', cluster: 'Création de personnage',
    build: () => hairs.map((h) => depuisEnveloppe(h, { sub: `2d10 ≤ ${h.rand}`, sections: sections(colorTableSection(h)) })),
  },
  {
    key: 'calendarMonths', label: 'Calendrier — Mois', group: 'Tables', cluster: 'Calendrier',
    build: () => calendarMonths.map((m) => depuisEnveloppe(m, { sub: `${m.days} jours` })),
  },
  {
    key: 'calendarIntercalary', label: 'Calendrier — Jours intercalaires', group: 'Tables', cluster: 'Calendrier',
    build: () => calendarIntercalary.map((i) => depuisEnveloppe(i, {
      sub: i.afterMonth < 0 ? 'avant le 1ᵉʳ mois' : `après ${calendarMonths[i.afterMonth]?.label ?? `mois ${i.afterMonth}`}`,
    })),
  },
  {
    key: 'calendarWeekdays', label: 'Calendrier — Jours de la semaine', group: 'Tables', cluster: 'Calendrier',
    build: () => calendarWeekdays.map((w) => depuisEnveloppe(w)),
  },
  {
    key: 'calendarPhases', label: 'Calendrier — Phases du jour', group: 'Tables', cluster: 'Calendrier',
    build: () => calendarPhases.map((p) => ({
      id: p.id, label: p.label, // `p.icon` = id d'icône (time/*, registre src/ui/icons), plus un glyphe affichable en préfixe

      sub: `dès ${String(Math.floor(p.start / 60)).padStart(2, '0')}:${String(p.start % 60).padStart(2, '0')}`,
    })),
  },
  {
    key: 'weather', label: 'Météo de voyage', group: 'Tables', cluster: 'Voyage terrestre',
    build: () => weather.map((s) => depuisEnveloppe(s, { sub: `${s.ranges.length} plages d100 (EDOC 8)` })),
  },
  {
    key: 'weatherConditions', label: 'Conditions météo', group: 'Tables', cluster: 'Voyage terrestre',
    // Effets par condition (EDOC 8) — cible Codex des chips « Météo : … » des lignes de jet
    // (`engine/weatherTestMod.ts`, `state/combatFlow.ts`, `state/travelPostes.ts`).
    build: () => weatherConditions.map((c) => ({
      id: c.id, label: c.label, desc: c.desc, source: src(c.source),
      meta: facts(
        fact('Visibilité', c.visibiliteM != null ? `${c.visibiliteM} m` : null),
        fact('Armes à distance', c.rangedUseless ? 'inutilisables' : c.rangedMod != null ? String(c.rangedMod) : null),
        fact('Tests physiques', c.physicalTestMod != null ? String(c.physicalTestMod) : null),
        fact('Mouvement', c.movementWalkOnly ? 'marche seulement' : null),
        fact('Poudre exposée', c.powderUseless ? 'inutilisable' : null),
      ),
    })),
  },
  {
    key: 'raceAppearance', label: 'Apparences (rig)', group: 'Tables', cluster: 'Création de personnage',
    build: () => raceAppearance.map((r) => ({
      id: r.id, label: r.label, sub: r.gabarit, appearance: { species: r.id },
      meta: facts(fact('Gabarit', r.gabarit), fact('Tenue', r.tenue), fact('Tête', r.head), fact('Jambes', r.legs)),
    })),
  },
  {
    key: 'pregens', label: 'Pré-tirés', group: 'Tables', cluster: 'Création de personnage',
    build: () => pregens.map((p) => ({
      id: p.id,
      label: p.label, sub: join(findSpeciesById(p.species)?.label ?? p.species, findCareerById(p.career)?.label ?? p.career),
      meta: facts(fact('Motivation', p.motivation), fact('Graine', p.seed)),
      sections: p.pettySpells?.length ? sections(chips('Sorts', p.pettySpells.map((id) => idRefRow('spells', id)))) : undefined,
    })),
  },
  {
    key: 'oups', label: 'Oups !', group: 'Tables',
    // Le `label` EST le texte du résultat (et la clé d'édition `entryKey`) → on le garde tel quel ;
    // on enrichit par la plage d100 et le TYPE d'effet (kind) en méta.
    build: () => oups.map((o) => {
      const range = 'min' in o ? `d100 ${o.min}–${o.max}` : 'Hors table (arme à Poudre noire, jet pair)';
      return depuisEnveloppe(o, {
        sub: range,
        meta: facts(fact('d100', range), fact('Type', valeurFR('oups.json', 'kind', o.kind))),
      });
    }),
  },
  {
    key: 'interludeEvents', label: 'Entre deux aventures', group: 'Tables',
    build: () => interludeEvents.map((e) => depuisEnveloppe(e, { sub: `d100 ${e.min}–${e.max}` })),
  },
  {
    key: 'peripeties', label: 'Péripéties de voyage', group: 'Tables', cluster: 'Voyage terrestre',
    build: () => peripeties.map((p) => depuisEnveloppe(p, { sub: `1d10 = ${p.roll} · ${p.kind}` })),
  },
  {
    key: 'activities', label: 'Activités', group: 'Tables',
    // Catalogue UNIQUE des Activités (interlude LDB 23 / voyage EDOC 8 / mer MDG 15 / bataille de
    // masse ADE II 8). Un Test « posté » (compétence(s) au choix + Difficulté) dont l'issue s'exprime
    // en `onSuccess` (GameOp) et/ou en bandes `outcomes` (table DR → résultat, verbatim + effets).
    build: () => ACTIVITIES.map((a) => depuisEnveloppe(a, {
      sub: a.contexts.map((c) => valeurFR('activities.json', 'contexts', c)).join(', '),
      meta: facts(
        fact('Contextes', a.contexts.map((c) => valeurFR('activities.json', 'contexts', c)).join(', ')),
        fact('Compétence(s)', a.skills?.length ? a.skills.map((s) => refLabel('skills', { id: s.id, spec: s.spec })).join(' / ') : (a.freeSkill ? 'Au choix (libre)' : null)),
        fact('Caractéristique', a.char ? CHAR_LABELS[a.char] : null),
        fact('Difficulté', a.difficulty ? DIFFICULTY_LABELS[a.difficulty] : null),
        fact('Test étendu', a.extended ? `${a.extended.drPerStage} DR / Étape` : null),
        fact('Résolveur', a.resolver ?? null),
      ),
      sections: sections(
        chips('Compétences (au choix)', (a.skills ?? []).map((s) => idRefRow('skills', s.id, s.spec))),
        passiveSection(a.onSuccess, 'Effet de réussite'),
        outcomeBandsSection(a.outcomes),
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
  {
    key: 'massBattlePowerEstimate', label: 'Bataille de masse — Estimation de Puissance', group: 'Tables', cluster: 'Bataille de masse',
    build: () => POWER_ESTIMATE.map((p) => depuisEnveloppe(p, {
      meta: facts(fact('Puissance alliée', p.ally), fact('Puissance ennemie', p.enemy)),
      desc: p.example,
    })),
  },
  {
    key: 'massBattleMightModifiers', label: 'Bataille de masse — Modificateurs de Puissance', group: 'Tables', cluster: 'Bataille de masse',
    build: () => MIGHT_MODIFIERS.map((m) => depuisEnveloppe(m, {
      meta: facts(fact('Modificateur', m.mod > 0 ? `+${m.mod}` : String(m.mod))),
      desc: m.example,
    })),
  },
  {
    key: 'massBattleWarMachines', label: 'Bataille de masse — Machines de guerre', group: 'Tables', cluster: 'Bataille de masse',
    build: () => WAR_MACHINES.map((w) => depuisEnveloppe(w, {
      meta: facts(
        fact('Prix', formatMoney(w.price)), fact('Équipe', w.crew), fact('Disponibilité', w.availability),
        fact('Portée', w.range), fact('Dégâts', w.damage), fact('Atouts', w.traits),
      ),
    })),
  },
  {
    key: 'massBattleStructures', label: 'Bataille de masse — Structures', group: 'Tables', cluster: 'Bataille de masse',
    build: () => MASS_BATTLE_STRUCTURES.map((s) => depuisEnveloppe(s, {
      meta: facts(fact('BE', s.be), fact('Blessures', s.wounds), fact('Atouts', s.traits)),
    })),
  },
  {
    key: 'massBattleHazards', label: 'Bataille de masse — Aléas de bataille', group: 'Tables', cluster: 'Bataille de masse',
    build: () => BATTLE_HAZARDS.map((h) => depuisEnveloppe(h, { sub: `1d10 = ${h.min}` })),
  },
  // ── Datasets-OBJETS uniques (E3b) : config de création (objet) + banque de noms (Record par race) ──
  {
    key: 'details', label: 'Détails de création', group: 'Tables', cluster: 'Création de personnage', sourceRef: 'LDB 05',
    // UNE seule entrée (objet `details.json`) — formules Âge/Taille par espèce + textes d'aide.
    build: () => [{
      id: 'details', label: 'Détails de création',
      sections: sections({
        title: 'Formules Âge & Taille (base + Nd10)', layout: 'list',
        rows: (Object.keys(details.ageBase) as RaceKey[]).map((sp) => ({
          t: 'kv', k: sp,
          v: `Âge ${details.ageBase[sp]}+${Math.round(details.ageRoll[sp] ?? 1)}d10 · Taille ${details.heightBase[sp]}+${Math.round(details.heightRoll[sp] ?? 1)}d10 cm`,
        } as CodexRow)),
      }),
    }],
  },
  {
    key: 'semencesDeScene', label: 'Semences de scène', group: 'Tables',
    // UNE seule entrée (objet `semences-de-scene.json`) — ce qu'une scène NEUVE reçoit à sa création
    // (`emptyScene`, `state/scene.ts`). Les valeurs s'ÉDITENT ici (atelier, `edit.object: 'single'`).
    build: () => [{
      id: 'semences-de-scene', label: 'Semences de scène',
      sections: sections({
        title: 'Ce qu’une scène neuve reçoit', layout: 'list',
        rows: [
          { t: 'kv', k: 'Ambiance', v: semencesDeScene.ambiance },
          { t: 'kv', k: 'Mètres par case', v: `${semencesDeScene.metresPerTile} m` },
          // Absent = `auto` : l’éclairage suit l’horloge (même convention que `Scene.ambientLight`).
          { t: 'kv', k: 'Éclairage', v: semencesDeScene.ambientLight ?? 'automatique (suit l’horloge)' },
          { t: 'kv', k: 'Sol de départ', v: semencesDeScene.terrain },
          { t: 'kv', k: 'Matières de relief', v: Object.entries(semencesDeScene.reliefDefaults).map(([part, mat]) => `${part} : ${mat}`).join(' · ') },
          { t: 'kv', k: 'Toiture', v: `${semencesDeScene.roofDefaults.material} · ${semencesDeScene.roofDefaults.pitchDeg}° · comble ${semencesDeScene.roofDefaults.riseMaxStoreys} étage(s)` },
        ] as CodexRow[],
      }),
    }],
  },
  {
    key: 'defautsDeCompilation', label: 'Défauts de compilation', group: 'Tables',
    // UNE seule entrée (objet `defauts-de-compilation.json`) — ce que le compilateur de scène pose
    // quand l'auteur laisse le terrain implicite (`state/mapSpec.ts`). Éditable ici (`edit.object: 'single'`).
    build: () => [{
      id: 'defauts-de-compilation', label: 'Défauts de compilation',
      sections: sections({
        title: 'Ce que le compilateur pose à la place de l’auteur', layout: 'list',
        rows: [
          { t: 'kv', k: 'Chemin de ronde', v: defautsDeCompilation.cheminDeRonde },
          { t: 'kv', k: 'Masse d’un mur plein', v: defautsDeCompilation.masse },
          { t: 'kv', k: 'Pont de navire', v: defautsDeCompilation.pont },
        ] as CodexRow[],
      }),
    }],
  },
  {
    key: 'names', label: 'Banque de noms', group: 'Tables', cluster: 'Création de personnage',
    // LISTE de documents (#1467 L1b V-FLIP-RECORD) : chaque banque porte SON id (le `RaceKey`) et SON
    // libellé — l'affichage se lit sur le document, sans lookup transverse.
    build: () => names.map((pool) => ({
      id: pool.id, label: pool.label,
      sub: `${pool.maleFirstNames.length}♂ · ${pool.femaleFirstNames.length}♀ · ${pool.lastNames.length} noms`,
      sections: sections(
        // RESTE ASSUMÉ : une rangée porte la LISTE entière (`join(', ')`), pas un nom — en pastille
        // elle ferait une pastille géante. Éclater la donnée en une pastille par nom est un chantier
        // de DONNÉES, hors #1392 Lot E.
        pool.maleFirstNames.length ? { title: 'Prénoms masculins', layout: 'chips', rows: [{ t: 'text', text: pool.maleFirstNames.join(', ') }] } : null,
        pool.femaleFirstNames.length ? { title: 'Prénoms féminins', layout: 'chips', rows: [{ t: 'text', text: pool.femaleFirstNames.join(', ') }] } : null,
        pool.lastNames.length ? { title: 'Noms de famille', layout: 'chips', rows: [{ t: 'text', text: pool.lastNames.join(', ') }] } : null,
      ),
    })),
  },
  // ── #157 : catalogues de CONTENU app-owned (façade ou module dédié) exposés au Codex. ──
  {
    key: 'structures', label: 'Structures (siège)', group: 'Monde',
    build: () => structures.map((s) => depuisEnveloppe(s, {
      sub: s.kind === 'porte' ? 'Porte' : 'Mur',
      meta: facts(
        fact('BE', s.char.BE), fact('Blessures', s.char.B), fact('Fortifiée', s.fortified ? 'oui' : null),
      ),
      sections: sections(chips('Atouts', traitRefRows(s.traits as unknown as TraitList))),
    })),
  },
  {
    // Matières du monde (#1686) : UN document à DISCRIMINANT (`domain`) — le groupe, le sous-titre et
    // les champs affichés découlent de la valeur du discriminant, par le canal registre. Aucune table
    // de libellés ni de clés ici : l'enum NOMMÉ du nœud `domain` nomme les domaines, `chargeDiscriminee` dit ce
    // que porte le domaine d'une entrée, `libelleDuChamp` nomme chaque champ.
    key: 'materials', label: 'Matières', group: 'Monde',
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
  {
    // Sols de la grille (#1690) : UNE forme sans discriminant — chaque entrée porte les mêmes clés de
    // RÈGLE (franchissabilité, précédence de raccord, blocage de la vue, surface bâtie, hauteur du bloc
    // plein) et les mêmes clés de RENDU (teinte, rampe, décor posé). Aucune table de libellés ici : les
    // noms FR viennent de la méta du def (`libelleDuChamp`), l'ordre des arrêts de rampe de la source
    // unique `terrainStopsOrdonnes`, et le nom du décor posé de l'entrée `props.json` qu'il référence.
    key: 'terrains', label: 'Terrains', group: 'Monde',
    build: () => {
      const meta = metaPourFichier('terrains.json');
      const nom = (cle: string) => libelleDuChamp(cle, { meta });
      return terrains.map((t) => depuisEnveloppe(t, {
        meta: facts(
          // `walkable` se dit dans les DEUX sens : un sol infranchissable est le fait le plus lourd de
          // la fiche, d'où la valeur écrite ici ('oui'/'non') plutôt que `valeurDeCharge`, qui tait un
          // booléen faux.
          fact(nom('walkable'), t.walkable ? 'oui' : 'non'),
          fact(nom('priority'), t.priority),
          fact(nom('opaque'), t.opaque ? 'oui' : null),
          fact(nom('built'), t.built ? 'oui' : null),
          fact(nom('solidHeightM'), t.solidHeightM != null ? `${t.solidHeightM} m` : null),
          fact(nom('matiere'), t.matiere ? matiereLabel(t.matiere) : null),
          fact(nom('overlayProp'), t.overlayProp ? propLabel(t.overlayProp) : null),
        ),
        // Les DEUX porteurs de couleur du terrain (teinte d'aperçu + arrêts de la rampe) tiennent la
        // MÊME section : ce sont des couleurs, rendues par la même rangée `couleur` (pastille peinte +
        // hex). Le titre est écrit ici : la méta d'un def nomme des CHAMPS, aucune section.
        sections: sections({
          title: 'Rendu', layout: 'list',
          rows: [
            { t: 'couleur', k: nom('swatch'), v: t.swatch } as CodexRow,
            { t: 'sub', label: nom('stops') } as CodexRow,
            ...terrainStopsOrdonnes(t.stops).map(([offset, couleur]) => ({ t: 'couleur', k: offset, v: couleur } as CodexRow)),
          ],
        }),
      }));
    },
  },
  {
    // Types de bâtiment (#1715) : UNE forme sans discriminant — chaque entrée porte la couverture de
    // référence du type et les ornements d'identité que le rendu émet en billboard. Aucune table de
    // libellés ici : les noms FR viennent de la méta du def
    // (`libelleDuChamp`), le nom d'une couverture de l'entrée `materials.json` visée, celui d'un
    // ornement de l'entrée `props.json` qu'il référence, et l'ancrage de l'enum NOMMÉ du schéma.
    key: 'buildings', label: 'Bâtiments', group: 'Monde',
    build: () => {
      const meta = metaPourFichier('buildings.json');
      const nom = (cle: string) => libelleDuChamp(cle, { meta });
      return buildings.map((b) => depuisEnveloppe(b, {
        meta: facts(
          fact(nom('roofMaterial'), couvertureLabel(b.roofMaterial)),
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
  {
    key: 'vehicles', label: 'Véhicules', group: 'Monde',
    build: () => vehicles.map((v) => depuisEnveloppe(v, {
      meta: facts(
        fact('Prix', priceLabel(v.purchase?.price)), fact('Disponibilité', v.purchase?.availability ?? null),
        fact('Enc', v.enc), fact('Mouvement (voyage)', v.travel?.movement),
        fact('Endurance', v.hull?.char.endurance), fact('Blessures', v.hull?.char.B),
      ),
    })),
  },
  {
    key: 'celestialHouses', label: 'Demeures astrologiques', group: 'Personnage',
    build: () => celestialHouses.map((h) => depuisEnveloppe(h, { sub: `2d10 ≤ ${h.rand}` })),
  },
  {
    key: 'groups', label: 'Groupes (Cible)', group: 'Monde',
    build: () => groups.map((g) => ({ id: g.id, label: g.label })),
  },
  {
    key: 'psychologies', label: 'États psychologiques', group: 'Effets',
    build: () => psychologies.map((p) => depuisEnveloppe(p, {
      sections: sections(passiveSection(p.passive), effectsSection(p.effects), ...reverseSections('psychologies', p.id)),
    })),
  },
  {
    key: 'seaShanties', label: 'Chants de marins', group: 'Monde',
    build: () => seaShanties.map((s) => depuisEnveloppe(s, {
      meta: facts(fact('Note', s.note ?? null)),
      sections: sections(passiveSection(s.crewOps, 'Effet (équipage)'), passiveSection(s.captainOps, 'Effet (capitaine)')),
    })),
  },
  {
    key: 'shipStations', label: 'Stations à bord', group: 'Monde',
    build: () => shipStations.map((st) => depuisEnveloppe(st, {
      meta: facts(fact('Trait naval requis', st.requiresTrait ? refLabel('navalTraits', st.requiresTrait) : null)),
    })),
  },
  {
    key: 'crewRoles', label: 'Rôles d’équipage', group: 'Monde',
    build: () => crewRoles.map((r) => depuisEnveloppe(r, {
      sections: sections(chips('Compétences', r.skills.map((sk) => idRefRow('skills', sk.id, sk.spec)))),
    })),
  },
  {
    key: 'crewTestTypes', label: 'Tests d’équipage (types)', group: 'Monde',
    build: () => crewTestTypes.map((t) => depuisEnveloppe(t, {
      meta: facts(fact('Rôle essentiel', crewRoles.find((r) => r.id === t.essential)?.label ?? t.essential)),
      sections: sections(chips('Rôles contributeurs', t.roles.map((id) => idRefRow('crewRoles', id)))),
    })),
  },
  {
    key: 'navalTraits', label: 'Traits & améliorations navales', group: 'Équipement',
    build: () => NAVAL_TRAITS.map((t) => depuisEnveloppe(t, {
      sub: t.kind === 'trait' ? 'Trait (construction)' : 'Amélioration',
      sections: sections(passiveSection(t.passive)),
    })),
  },
  {
    key: 'traumas', label: 'Traumatismes (séquelles)', group: 'Effets',
    build: () => datasetArray('traumas').map((f) => depuisEnveloppe(f, {
      sub: f.kind ? `${f.kind === 'dechirure' ? 'Déchirure' : 'Fracture'}${f.severity ? ` (${f.severity})` : ''}` : undefined,
      sections: sections(passiveSection(f.ops, 'Effet permanent')),
    })),
  },
  {
    key: 'criticalsTete', label: 'Critiques — Tête (Traumatisme)', group: 'Effets', cluster: 'Blessures critiques', sourceRef: 'LDB 18',
    build: () => datasetArray('criticalsTete').map((e) => critEntryItem(e, 'ldb', 'tete')),
  },
  {
    key: 'criticalsBras', label: 'Critiques — Bras (Traumatisme)', group: 'Effets', cluster: 'Blessures critiques', sourceRef: 'LDB 18',
    build: () => datasetArray('criticalsBras').map((e) => critEntryItem(e, 'ldb', 'bras')),
  },
  {
    key: 'criticalsCorps', label: 'Critiques — Corps (Traumatisme)', group: 'Effets', cluster: 'Blessures critiques', sourceRef: 'LDB 18',
    build: () => datasetArray('criticalsCorps').map((e) => critEntryItem(e, 'ldb', 'corps')),
  },
  {
    key: 'criticalsJambe', label: 'Critiques — Jambe (Traumatisme)', group: 'Effets', cluster: 'Blessures critiques', sourceRef: 'LDB 18',
    build: () => datasetArray('criticalsJambe').map((e) => critEntryItem(e, 'ldb', 'jambe')),
  },
  {
    key: 'aaCriticalsTete', label: 'Critiques — Tête (approche alternative)', group: 'Effets', cluster: 'Blessures critiques', sourceRef: 'AA',
    build: () => datasetArray('aaCriticalsTete').map((e) => critEntryItem(e, 'aa', 'tete')),
  },
  {
    key: 'aaCriticalsBras', label: 'Critiques — Bras (approche alternative)', group: 'Effets', cluster: 'Blessures critiques', sourceRef: 'AA',
    build: () => datasetArray('aaCriticalsBras').map((e) => critEntryItem(e, 'aa', 'bras')),
  },
  {
    key: 'aaCriticalsCorps', label: 'Critiques — Corps (approche alternative)', group: 'Effets', cluster: 'Blessures critiques', sourceRef: 'AA',
    build: () => datasetArray('aaCriticalsCorps').map((e) => critEntryItem(e, 'aa', 'corps')),
  },
  {
    key: 'aaCriticalsJambe', label: 'Critiques — Jambe (approche alternative)', group: 'Effets', cluster: 'Blessures critiques', sourceRef: 'AA',
    build: () => datasetArray('aaCriticalsJambe').map((e) => critEntryItem(e, 'aa', 'jambe')),
  },
  {
    key: 'incidentsMonture', label: 'Incidents de monte', group: 'Tables', cluster: 'Voyage terrestre',
    build: () => MOUNT_INCIDENTS.map((e) => travelEntryItem(e, 'Effet sur le cavalier')),
  },
  {
    key: 'problemesVehicule', label: 'Problèmes de véhicule', group: 'Tables', cluster: 'Voyage terrestre',
    build: () => VEHICLE_PROBLEMS.map((e) => travelEntryItem(e, 'Effet sur les occupants')),
  },
  {
    key: 'rencontresPositives', label: 'Rencontres — Positives', group: 'Tables', cluster: 'Rencontres',
    build: () => datasetArray('rencontresPositives').map((e) => travelEntryItem(e, 'Effet sur les occupants')),
  },
  {
    key: 'rencontresFortuites', label: 'Rencontres — Fortuites', group: 'Tables', cluster: 'Rencontres',
    build: () => datasetArray('rencontresFortuites').map((e) => travelEntryItem(e, 'Effet sur les occupants')),
  },
  {
    key: 'rencontresDangereuses', label: 'Rencontres — Dangereuses', group: 'Tables', cluster: 'Rencontres',
    build: () => datasetArray('rencontresDangereuses').map((e) => travelEntryItem(e, 'Effet sur les occupants')),
  },
  {
    key: 'shipCriticalsCargaison', label: 'Critiques de navire — Cargaison', group: 'Effets', cluster: 'Critiques de navire', sourceRef: 'MDG 13',
    build: () => datasetArray('shipCriticalsCargaison').map(shipCritEntryItem),
  },
  {
    key: 'shipCriticalsGreement', label: 'Critiques de navire — Gréement', group: 'Effets', cluster: 'Critiques de navire', sourceRef: 'MDG 13',
    build: () => datasetArray('shipCriticalsGreement').map(shipCritEntryItem),
  },
  {
    key: 'shipCriticalsCoque', label: 'Critiques de navire — Coque', group: 'Effets', cluster: 'Critiques de navire', sourceRef: 'MDG 13',
    build: () => datasetArray('shipCriticalsCoque').map(shipCritEntryItem),
  },
  {
    key: 'shipCriticalsAvirons', label: 'Critiques de navire — Avirons', group: 'Effets', cluster: 'Critiques de navire', sourceRef: 'MDG 13',
    build: () => datasetArray('shipCriticalsAvirons').map(shipCritEntryItem),
  },
  {
    key: 'shipCriticalsEquipements', label: 'Critiques de navire — Équipements', group: 'Effets', cluster: 'Critiques de navire', sourceRef: 'MDG 13',
    build: () => datasetArray('shipCriticalsEquipements').map(shipCritEntryItem),
  },
  {
    key: 'riverCriticalsGreement', label: 'Critiques fluviaux — Gréement', group: 'Effets', cluster: 'Critiques fluviaux', sourceRef: 'MSRC 7',
    build: () => datasetArray('riverCriticalsGreement').map(shipCritEntryItem),
  },
  {
    key: 'riverCriticalsAvirons', label: 'Critiques fluviaux — Rames', group: 'Effets', cluster: 'Critiques fluviaux', sourceRef: 'MSRC 7',
    build: () => datasetArray('riverCriticalsAvirons').map(shipCritEntryItem),
  },
  {
    key: 'riverCriticalsGouvernail', label: 'Critiques fluviaux — Gouvernail', group: 'Effets', cluster: 'Critiques fluviaux', sourceRef: 'MSRC 7',
    build: () => datasetArray('riverCriticalsGouvernail').map(shipCritEntryItem),
  },
  {
    key: 'riverCriticalsCoque', label: 'Critiques fluviaux — Coque', group: 'Effets', cluster: 'Critiques fluviaux', sourceRef: 'MSRC 7',
    build: () => datasetArray('riverCriticalsCoque').map(shipCritEntryItem),
  },
  {
    key: 'riverCriticalsSuperstructure', label: 'Critiques fluviaux — Superstructure', group: 'Effets', cluster: 'Critiques fluviaux', sourceRef: 'MSRC 7',
    build: () => datasetArray('riverCriticalsSuperstructure').map(shipCritEntryItem),
  },
  {
    key: 'seaManannFactors', label: 'Humeur de Manann — Facteurs', group: 'Tables', cluster: 'Mer & rivière', sourceRef: 'MDG 15',
    build: () => datasetArray('seaManannFactors').map(manannFactorItem),
  },
  {
    key: 'seaBoardEvents', label: 'Événements de bord (mer)', group: 'Tables', cluster: 'Mer & rivière', sourceRef: 'MDG 15',
    build: () => datasetArray('seaBoardEvents').map(seaEventItem),
  },
  {
    key: 'seaPortEvents', label: 'Événements de port (mer)', group: 'Tables', cluster: 'Mer & rivière', sourceRef: 'MDG 15',
    build: () => datasetArray('seaPortEvents').map(seaEventItem),
  },
  {
    key: 'waterExposure', label: 'Exposition à l’eau (maladies hydriques)', group: 'Tables', cluster: 'Mer & rivière', sourceRef: 'MSRC 16',
    build: () => {
      const w = datasetObject('waterExposure');
      return [{
        id: 'waterExposure', label: w.label, desc: w.desc, source: src(w.source),
        meta: facts(
          fact('Test', `${refLabel('skills', w.test.skill)} ${DIFFICULTY_LABELS[w.test.difficulty]}`),
          fact('Malus par DR négatif (jet de maladie)', `+${w.rollModPerNegativeSL}`),
        ),
        sections: sections(
          waterModifiersSection(w.modifiers),
          {
            title: 'Maladies (jet d100 après échec du Test)', layout: 'list',
            rows: w.diseases.map((d) => {
              const label = maladies.find((m) => m.id === d.disease)?.label ?? d.disease;
              return { t: 'ref', category: 'maladies', id: d.disease, label, show: label, badge: `${d.min}–${d.max}${d.rerollUnlessWounded ? ' · relance si indemne' : ''}` } as CodexRow;
            }),
          },
        ),
      }];
    },
  },
  {
    key: 'navalPorts', label: 'Ports (Index de la Mer des Griffes)', group: 'Monde', sourceRef: 'MDG 15',
    build: () => navalPorts.map((p) => depuisEnveloppe(p, {
      group: p.region,
      meta: facts(
        fact('Taille', p.taille), fact('Richesse', p.richesse),
        fact('Dirigeant', p.dirigeant ?? null), fact('Cosmopolite', p.cosmopolite ? 'oui' : null),
      ),
      sections: sections(
        p.production?.length ? { title: 'Production', layout: 'chips', rows: p.production.map((id) => portCargoRow(id)) } : null,
        p.surplus && Object.keys(p.surplus).length ? { title: 'Surplus', layout: 'chips', rows: Object.entries(p.surplus).map(([id, q]) => portCargoRow(id, q)) } : null,
        p.demande && Object.keys(p.demande).length ? { title: 'Demande', layout: 'chips', rows: Object.entries(p.demande).map(([id, q]) => portCargoRow(id, q)) } : null,
      ),
    })),
  },
  {
    key: 'navalProgression', label: 'Progression de navire (DR de Navigation → Mouvement)', group: 'Tables', cluster: 'Mer & rivière', sourceRef: 'MDG 13',
    build: () => datasetArray('navalProgression').map((e) => ({
      id: e.id, label: libelleDeValeur(progressionModeSchema, e.mode),
      sub: `DR ${e.min}…${e.max}`, desc: e.desc, source: src(e.source),
    })),
  },
  {
    key: 'shipHullSizes', label: 'Gabarits de coque (Construction navale)', group: 'Équipement', cluster: 'Mer & rivière', sourceRef: 'MDG 12',
    build: () => datasetArray('shipHullSizes').map((s) => ({
      id: s.id, label: libelleDeValeur(shipSizeSchema, s.size), source: src(s.source),
      meta: facts(
        fact('Coût', formatMoney(priceToMoney({ gold: s.costGold, silver: 0, brass: 0 }))),
        fact('Équipage', s.crew),
        s.sail ? fact('Voile', `M${s.sail.m} (équipage ${s.sail.crew})`) : null,
        s.oars ? fact('Rames', `M${s.oars.m} (équipage ${s.oars.crew})`) : null,
        // Bande FINALE sans plafond (MDG 12 l.129 « 81+ ») : elle se dit « et plus », pas « –null ».
        fact('Longueur', s.lengthM.max == null ? `${s.lengthM.min} m et plus` : `${s.lengthM.min}–${s.lengthM.max} m`),
        fact('Endurance', s.e), fact('Blessures', s.b), fact('Capacité', s.capacity),
      ),
      sections: sections(shipConstructionRulesSection()),
    })),
  },
  {
    key: 'shipSpeedTraits', label: 'Traits de vitesse (Construction navale)', group: 'Équipement', cluster: 'Mer & rivière', sourceRef: 'MDG 12',
    build: () => datasetArray('shipSpeedTraits').map((t) => depuisEnveloppe(t, {
      meta: facts(
        signedFact('Mouvement', t.mMod), signedFact('Capacité', t.capacityPct, ' %'),
        signedFact('Manœuvrabilité', t.manDR), signedFact('Coût', t.costPct, ' %'),
      ),
    })),
  },
  {
    key: 'shipConstructionTraits', label: 'Traits de construction (navire)', group: 'Équipement', cluster: 'Mer & rivière', sourceRef: 'MDG 12',
    build: () => datasetArray('shipConstructionTraits').map((t) => ({
      id: t.id, label: CONSTRUCTION_TRAIT_LABEL[t.id] ?? t.id, source: src(t.source),
      meta: facts(
        fact('Niveau max', t.maxLevel), signedFact('Coût / niveau', t.costPctPerLevel, ' %'),
        signedFact('Endurance / niveau', t.ePerLevel), signedFact('Blessures / niveau', t.bPctPerLevel, ' %'),
        signedFact('Capacité / niveau', t.capacityPctPerLevel, ' %'),
      ),
    })),
  },
  {
    key: 'seaNavigation', label: 'Navigation maritime (Progression, Salissures, Orientation, Phares, Poursuite…)', group: 'Tables', cluster: 'Mer & rivière', sourceRef: 'MDG 13/15',
    build: () => {
      const n = datasetObject('seaNavigation');
      return [{
        id: 'seaNavigation', label: 'Navigation maritime', source: src(n.workPeriodHours.source),
        sections: sections(
          {
            title: 'Périodes de travail & Épuisement', layout: 'list',
            rows: [
              { t: 'kv', k: 'Voile / Barre', v: `${n.workPeriodHours.voile} h` },
              { t: 'kv', k: 'Rames', v: `${n.workPeriodHours.avirons} h` },
              { t: 'kv', k: 'Test d’Épuisement', v: DIFFICULTY_LABELS[n.epuisement.difficulty] },
              { t: 'kv', k: 'Test d’Épuisement (rythme forcé)', v: DIFFICULTY_LABELS[n.epuisement.forcedDifficulty] },
            ],
          },
          {
            title: 'Forcer le rythme', layout: 'list',
            rows: n.forcerLeRythme.map((r) => ({
              t: 'kv', k: `+${r.bonusM} M`,
              v: [r.voile ? `Voile ${DIFFICULTY_LABELS[r.voile]}` : null, r.avirons ? `Rames ${DIFFICULTY_LABELS[r.avirons]}` : null].filter(Boolean).join(' · '),
            } as CodexRow)),
          },
          {
            title: 'Vitesses maximum (« Ça va lâcher, capitaine ! »)', layout: 'list',
            rows: [
              { t: 'kv', k: 'Sans risque', v: `jusqu’à M+${n.vitesseMax.safeBonus}` } as CodexRow,
              ...n.vitesseMax.table.map((row) => ({ t: 'kv', k: `M+${row.min}${row.max > row.min ? `…+${row.max}` : ''}`, v: `${DIFFICULTY_LABELS[row.difficulty]} · ${row.damage} Dégâts/${row.per}` } as CodexRow)),
            ],
          },
          {
            title: 'Salissures (Test hebdomadaire de Résistance du navire)', layout: 'list',
            rows: n.salissures.levels.map((l) => ({ t: 'kv', k: `Niveau ${l.level}`, v: `Man ${l.manDR} · M${l.mMod} · Nav ${l.navDR} · réparation ${l.repairPctOfBase} % — ${l.desc}` } as CodexRow)),
          },
          {
            title: 'Orientation — Repères (1 Test/jour)', layout: 'list',
            rows: n.orientation.reperes.map((r) => ({ t: 'kv', k: `DR ${r.min}…${r.max}`, v: r.desc } as CodexRow)),
          },
          {
            title: 'Changement de cap', layout: 'list',
            rows: n.orientation.changementDeCap.map((r) => ({ t: 'kv', k: `d10 ${r.min}…${r.max}`, v: r.desc } as CodexRow)),
          },
          {
            title: 'Phares & clochers (Perception)', layout: 'list',
            rows: n.phares.voirLaLumiere.map((r) => ({ t: 'kv', k: `jusqu’à ${r.max} milles`, v: DIFFICULTY_LABELS[r.difficulty] } as CodexRow)),
          },
          {
            title: 'Longs voyages', layout: 'list',
            rows: [
              { t: 'kv', k: 'Milles/jour par point de M', v: String(n.longsVoyages.millesParJourParM) } as CodexRow,
              { t: 'kv', k: 'Sans voguer de nuit', v: `÷${n.longsVoyages.sansVoguerDeNuitDiviseur}` } as CodexRow,
              { t: 'kv', k: 'Progression du Test d’équipage', v: `±${n.longsVoyages.progressionPctParDR} % / DR` } as CodexRow,
            ],
          },
          {
            title: 'Course-poursuite (distances d’évasion)', layout: 'list',
            rows: n.poursuite.escapeDistances.map((e) => ({ t: 'kv', k: e.label, v: `${e.distance} points` } as CodexRow)),
          },
          {
            title: 'Réparations au port', layout: 'list',
            rows: [
              { t: 'kv', k: 'Coût au port', v: `${n.reparation.portCostGoldPerWound} po / Blessure` } as CodexRow,
              { t: 'kv', k: 'Temps de Test', v: n.reparation.testHours } as CodexRow,
              { t: 'kv', k: 'Blessures réparées / Test', v: n.reparation.woundsPerTest } as CodexRow,
            ],
          },
        ),
      }];
    },
  },
  {
    key: 'seaPerils', label: 'Périls en mer (Échouage, Icebergs, Détroits, Tourbillons)', group: 'Tables', cluster: 'Mer & rivière', sourceRef: 'MDG 13',
    build: () => {
      const p = datasetObject('seaPerils');
      return [{
        id: 'seaPerils', label: 'Périls en mer', desc: p.echouer.desc, source: src(p.echouer.source),
        sections: sections(
          {
            title: 'Dangers flottants', layout: 'list',
            rows: p.hazards.map((h) => ({ t: 'kv', k: h.label, v: `IC ${h.ic}${h.m != null ? ` · M${h.m}` : ''}${h.strandChancePct != null ? ` · Échouage ${h.strandChancePct} %` : ''}${h.entangleChancePct != null ? ` · Empêtrement ${h.entangleChancePct} %` : ''} — ${h.desc}` } as CodexRow)),
          },
          {
            title: 'Détroits', layout: 'list',
            rows: p.detroits.map((d) => ({ t: 'kv', k: d.label, v: `M${d.m} · Nav ${d.navDR}` } as CodexRow)),
          },
          {
            title: 'Tourbillons', layout: 'list',
            rows: p.tourbillons.map((w) => ({ t: 'kv', k: w.label, v: `M${w.m} · rayon ${w.zoneRadiusM} m (spirale ${w.zoneSpiralM} m) · Man ${w.manDR} · IC ${w.ic} · évasion ${DIFFICULTY_LABELS[w.evasion.difficulty]} (${w.evasion.totalDR} DR)` } as CodexRow)),
          },
          {
            title: 'Gestion des périls (repérage / évitement par distance)', layout: 'list',
            rows: p.gestionDesPerils.map((g) => ({ t: 'kv', k: `${g.distanceM} m`, v: `repérage ${DIFFICULTY_LABELS[g.spot]} · évitement ${DIFFICULTY_LABELS[g.avoid]}` } as CodexRow)),
          },
        ),
      }];
    },
  },
  {
    key: 'seaWeather', label: 'Météo de la Mer des Griffes', group: 'Tables', cluster: 'Mer & rivière', sourceRef: 'MDG 13',
    build: () => {
      const w = datasetObject('seaWeather');
      // Les 4 aspects du tirage (`table[].precipitations`/`.temperature`/`.visibilite`/`.vent`) sont des
      // ids de catalogue (`w.precipitations`/`.temperatures`/`.visibilites`/`.vents`, CHACUN déjà porteur
      // de son `label` FR verbatim MDG) — la fiche résout id→label PAR LOOKUP (jamais l'id affiché ;
      // aucune duplication de `label` sur `table[]`, la SOURCE UNIQUE du libellé reste le catalogue).
      const precipLabel = new Map(w.precipitations.map((p) => [p.id, p.label]));
      const tempLabel = new Map(w.temperatures.map((t) => [t.id, t.label]));
      const visLabel = new Map(w.visibilites.map((v) => [v.id, v.label]));
      const windLabel = new Map(w.vents.map((v) => [v.id, v.label]));
      return [{
        id: 'seaWeather', label: 'Météo de la Mer des Griffes', source: src(w.table[0]?.source),
        meta: facts(fact('Modificateur mer chaude', w.warmSeaMod)),
        sections: sections(
          {
            title: 'Tirage quotidien (2d10)', layout: 'list',
            rows: w.table.map((row) => ({
              t: 'kv', k: `2d10 ${row.min}…${row.max}`,
              v: [precipLabel.get(row.precipitations), tempLabel.get(row.temperature), visLabel.get(row.visibilite), windLabel.get(row.vent)].join(' · '),
            } as CodexRow)),
          },
          {
            title: 'Modificateur saisonnier', layout: 'list',
            // Les saisons ET leurs noms viennent de la DONNÉE (`weather` + `seasonLabel`) : la
            // rubrique ne connaît ni la liste ni les libellés. Itérer les CLÉS de `seasonMod`
            // rendrait en plus sa clé d'enveloppe `source`.
            rows: weather.map((s) => (
              { t: 'kv', k: seasonLabel(s.id), v: String((w.seasonMod as Record<string, unknown>)[s.id]) } as CodexRow
            )),
          },
          {
            title: 'Précipitations', layout: 'list',
            rows: w.precipitations.map((p) => ({ t: 'kv', k: p.label, v: p.desc ?? '—' } as CodexRow)),
          },
          {
            title: 'Température', layout: 'list',
            rows: w.temperatures.map((t) => ({ t: 'kv', k: t.label, v: t.difficulty ? `Test toutes les ${t.testEveryHours} h — ${DIFFICULTY_LABELS[t.difficulty]} (${t.exposure})` : '—' } as CodexRow)),
          },
          {
            title: 'Visibilité', layout: 'list',
            rows: w.visibilites.map((v) => ({ t: 'kv', k: v.label, v: v.drPenalty != null ? `${v.drPenalty} DR au-delà de ${v.beyondM} m` : '—' } as CodexRow)),
          },
          {
            title: 'Vents', layout: 'chips',
            // Libellés d'état de vent : des ÉTIQUETTES → pastille nue, comme leurs voisines.
            rows: w.vents.map((v) => ({ t: 'chip', label: v.label } as CodexRow)),
          },
        ),
      }];
    },
  },
  {
    key: 'montures', label: 'Montures (profils de voyage)', group: 'Monde',
    build: () => MOUNT_PROFILES.map((p) => ({
      id: p.id, label: p.label,
      meta: facts(fact('Mouvement', p.m), fact('Endurance', p.e), fact('Trotte', p.trot ? 'oui' : 'non')),
      sections: sections(chips('Bêtes liées', p.creatureIds.map((id) => idRefRow('creatures', id)))),
    })),
  },
  {
    key: 'tavernGames', label: 'Jeux de taverne', group: 'Monde',
    build: () => TAVERN_GAMES.map((g) => depuisEnveloppe(g, {
      meta: facts(
        fact('Compétence', g.skill ? refLabel('skills', g.skill) : 'Pari (aucune Compétence)'),
        fact('Caractéristique', g.characteristic ? CHAR_LABELS[g.characteristic] : null),
        fact('Mode', g.pot ? `Mise et pot (${g.pot.dice.count}d${g.pot.dice.faces})`
          : g.volley ? `Volée de ${g.volley.throws} lancers`
            : g.mode === 'extended' ? `Étendu (${g.target ?? '?'} DR)` : 'Opposé simple'),
        fact('Plafond de DR', g.drCap ?? null),
        fact('Nombre cible', g.pot?.targetRange ? `de ${g.pot.targetRange.min} à ${g.pot.targetRange.max}` : null),
        fact('Total exact', g.volley?.exact ?? null),
        fact('À abattre', g.volley?.reserve ?? null),
        fact('Camps', g.sides?.length ? g.sides.map((s) => `${s.label} (${s.pieces} pièces)`).join(' contre ') : null),
        fact('Tours (maison)', g.combined?.tours ?? null),
      ),
    })),
  },
  {
    key: 'obsessions', label: 'Obsessions (table)', group: 'Tables',
    build: () => OBSESSIONS.map((o) => ({ id: o.id, label: o.label, sub: `2d10 ${o.min}–${o.max}` })),
  },
  {
    // V9 #1318 : le catalogue des règles optionnelles est une DONNÉE (`reglesOptionnelles.json`) —
    // exposé/éditable ici comme tout catalogue. Le panneau in-game reste la porte de la VALEUR jouée
    // (surcharge runtime persistée) ; cette fiche montre le catalogue lui-même.
    key: 'reglesOptionnelles', label: 'Règles optionnelles', group: 'Tables',
    build: () => datasetArray('reglesOptionnelles').map((r) => depuisEnveloppe(r, {
      sub: r.group, desc: r.hint,
      meta: facts(
        fact('Réf', r.ref),
        fact('Contrôle', valeurFR('reglesOptionnelles.json', 'kind', r.kind)),
        fact('Défaut', ruleValueLabel(r.default)),
        fact('Valeurs', r.options?.join(' · ') ?? null),
        fact('Bornes', r.kind === 'param' && r.min != null && r.max != null ? `de ${r.min} à ${r.max}${r.step ? ` (pas de ${r.step})` : ''}` : null),
        fact('Action attachée', r.action ? `${r.action.label} (si ${ruleValueLabel(r.action.when)})` : null),
      ),
    })),
  },
  {
    key: 'surincantation', label: 'Tableau de Surincantation (VDM)', group: 'Tables', sourceRef: 'VDM 02',
    build: () => datasetArray('surincantation').map((r) => ({
      id: r.id, label: r.label, sub: 'DR dépensés sur UNE colonne',
      meta: facts(
        fact('Cible additionnelle', `+${r.targets}`),
        fact('Dégât en plus', `+${r.damage}`),
        fact('Portée étendue', `${r.range} × Portée`),
        fact('ZdE étendue', r.zone === 1 ? 'ZdE listée' : `${r.zone} × ZdE`),
        fact('Durée prolongée', r.duration === 1 ? 'Durée listée' : `${r.duration} × Durée`),
      ),
      source: src(SURINCANTATION.source),
    })),
  },
  {
    key: 'structureCriticals', label: 'Critiques de structure', group: 'Effets',
    build: () => STRUCTURE_CRITICALS.map((c) => ({
      id: c.id, label: c.label, sub: `d100 ${c.min}–${c.max}`, desc: c.note,
      meta: facts(
        c.wounds != null ? fact('Blessures', c.wounds) : null,
        c.trivial ? fact('Type', 'Triviale (« T »)') : null,
        c.destroyed ? fact('Effondrement', 'oui') : null,
      ),
    })),
  },
  {
    key: 'artilleryMisfire', label: 'Incidents de Tir par Salve', group: 'Effets',
    build: () => ARTILLERY_MISFIRE.map((e) => ({
      id: e.id, label: e.label, sub: `d10 ${e.min}–${e.max}`, desc: e.note,
      meta: facts(
        fact('Localisation', e.location === 'brasPrincipal' ? 'Bras principal' : 'Aléatoire'),
        e.perSalveIndex ? fact('Répétition', 'par Indice de Salve restant') : null,
        e.destroyed ? fact('Pièce détruite', 'oui') : null,
        e.strayFire ? fact('Tir perdu', 'oui') : null,
      ),
    })),
  },
  // Cargaisons : le DATASET éditable est le tableau brut du JSON (marqueurs de l'Index compris, cf.
  // `data/overrides.ts`), la VUE Compendium n'en montre que les marchandises — un marqueur n'a ni
  // prix ni disponibilité, donc aucune fiche à ouvrir. Le filtre est ICI, pas dans la donnée.
  {
    key: 'landCargo', label: 'Cargaison terrestre', group: 'Monde',
    build: () => datasetArray('landCargo').filter(isEchangeable).map((c) => depuisEnveloppe(c, {
      meta: facts(fact('Vin', (c as LandCargoDef).wine ? 'oui' : null)),
    })),
  },
  {
    key: 'seaCargo', label: 'Cargaison maritime', group: 'Monde',
    build: () => datasetArray('seaCargo').filter(isEchangeable).map((c) => depuisEnveloppe(c)),
  },
  {
    key: 'riverPerils', label: 'Périls fluviaux', group: 'Monde',
    build: () => RIVER_PERILS.map((p) => depuisEnveloppe(p, { sub: p.kind })),
  },
  {
    key: 'crewMoraleFactors', label: 'Moral d’équipage — Facteurs', group: 'Tables', cluster: 'Équipage & navire',
    build: () => MORALE_FACTORS.map((f) => depuisEnveloppe(f, { desc: f.effect })),
  },
  {
    key: 'crewMoraleBands', label: 'Moral d’équipage — Effets', group: 'Tables', cluster: 'Équipage & navire',
    build: () => MORALE_BANDS.map((b) => depuisEnveloppe(b, {
      sub: `d100 ${b.min}–${b.max}`,
      meta: facts(
        fact('DR Commandement (capitaine)', b.captainCmdDR), fact('DR Tests équipage', b.crewTestDR),
        fact('Désertion (seuil d100)', b.desertionRoll ?? null),
      ),
    })),
  },
  {
    key: 'steamBreakdowns', label: 'Pannes de navire à vapeur', group: 'Tables', cluster: 'Équipage & navire',
    build: () => STEAM_BREAKDOWNS.map((e) => depuisEnveloppe(e, {
      sub: `d100 ${e.min}–${e.max}`,
      meta: facts(fact('Moteur détruit', e.engineDestroyed ? 'oui' : null)),
    })),
  },
  {
    // Procédures / options de jeu au texte VERBATIM (Sombre Pacte, Empoignade, modes d'attaque…) —
    // cible des tooltips `CodexRef` qui portaient une paraphrase de règle (#392).
    key: 'regles', label: 'Règles de jeu', group: 'Monde',
    build: () => regles.map((r) => depuisEnveloppe(r)),
  },
];

/** Les catégories consultables — chaque `items`/`facets` est un getter re-projetable (fraîcheur). */
export const CODEX: CodexCategory[] = CODEX_SPECS.map(makeCategory);

/** Section « table 2d10 » d'une couleur (yeux/cheveux) — borne + couleur par colonne d'espèce. */
function colorTableSection(c: (typeof eyes)[number]): CodexSection {
  return {
    title: 'Couleur par espèce (colonne refChar)', layout: 'list',
    rows: Object.entries(c.color).filter(([, v]) => v).map(([sp, v]) => ({ t: 'kv', k: sp, v } as CodexRow)),
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
// `codexLookup` est appelé par CHAQUE `CodexRef` à CHAQUE rendu → un `items.find` linéaire ne scale
// pas (des centaines de refs × des centaines d'items). L'index (label exact → item, + repli casse
// pliée) se construit à la 1re résolution d'une catégorie — sur les `items` COURANTS du getter
// re-projetable — et se ré-utilise ensuite. La 1re occurrence gagne (même précédence que l'ancien
// `find`). Invalidé par `invalidateCodexLookup` (persist d'une édition Codex) : index ET projections
// (`c.items`/`c.facets`) repartent alors de la donnée persistée, et `useCodexVersion` fait re-rendre
// les lecteurs (CompendiumScreen). L'état (`LOOKUP`/`LOOKUP_VERSION`) vit en tête de fichier, avec
// la machinerie de fraîcheur.

/** Index (byId + label exact/casse pliée) d'une catégorie, construit à la 1re résolution — `undefined`
 *  si la catégorie est inconnue (jamais mis en cache, répond `undefined` à chaque appel). */
function categoryIndex(category: string): { byId: Map<string, CodexItem>; exact: Map<string, CodexItem>; folded: Map<string, CodexItem> } | undefined {
  if (!LOOKUP) LOOKUP = new Map();
  let idx = LOOKUP.get(category);
  if (!idx) {
    const items = categoryByKey(category)?.items;
    if (!items) return undefined;
    idx = { byId: new Map(), exact: new Map(), folded: new Map() };
    // Parcours INVERSÉ + `set` nu : le dernier écrit gagne, donc la PREMIÈRE occurrence de la liste
    // l'emporte (précédence historique du `find`), sans interroger un index par libellé (#602) —
    // remplir un index de texte est la couture tolérée, le questionner par `.label` ne l'est pas.
    for (let i = items.length - 1; i >= 0; i--) {
      const it = items[i];
      if (it.id) idx.byId.set(it.id, it);
      if (!it.label) continue; // entrée sans label (défensif) : non indexée
      idx.exact.set(it.label, it);
      idx.folded.set(it.label.toLowerCase(), it);
    }
    LOOKUP.set(category, idx);
  }
  return idx;
}

/** Résout une entrée (catégorie + id) → sa fiche, pour les liens `CodexRef` qui connaissent déjà
 *  l'identité STABLE de leur cible (résolution PRIMAIRE — cf. `codexLookup` pour le repli par libellé). */
export function codexLookupById(category: string, id: string): CodexItem | undefined {
  if (!id) return undefined;
  return categoryIndex(category)?.byId.get(id);
}

/** Résout une entrée (catégorie + libellé) → sa fiche, pour les liens `CodexRef` — REPLI de compat/
 *  affichage (l'auto-liage matche du texte). Exact d'abord, puis casse ignorée (les libellés à
 *  spécialisation s'écrivent parfois autrement). */
export function codexLookup(category: string, label: string): CodexItem | undefined {
  // Robustesse : un libellé absent (entité sans nom — arme/compétence malformée) ou une entrée sans
  // label NE DOIT PAS crasher tout le rendu. Pas de fiche trouvée → le CodexRef se replie en texte.
  if (!label) return undefined;
  const idx = categoryIndex(category);
  if (!idx) return undefined;
  return idx.exact.get(label) ?? idx.folded.get(label.toLowerCase());
}

const ARMOUR_LOCS: HitLocation[] = ['tete', 'corps', 'brasG', 'brasD', 'jambeG', 'jambeD'];

/** Statbloc d'un combattant VIVANT (valeurs réelles : carac, armes/armure dérivées, états déjà à
 *  part) en sections — MÊME rendu que la fiche Codex (CodexEntry/CodexSections). Sert l'inspection
 *  d'un ennemi en combat sans recopier un panneau partiel. TOUTES les caracs (« – » si inexistante). */
export function combatantSections(c: Combatant): CodexSection[] {
  const ch = c.characteristics;
  const charRows: CodexRow[] = [
    { t: 'kv', k: 'M', v: String(c.movement), kref: { category: 'characteristics', id: 'mouvement', label: 'Mouvement' } },
    ...CHAR_KEYS.map((k) => ({ t: 'kv', k: charAbr(k), v: ch[k] > 0 || c.kind === 'hero' ? String(effectiveChar(c, k)) : '–', kref: { category: 'characteristics', id: k, label: CHAR_LABELS[k] } } as CodexRow)),
    { t: 'kv', k: 'Taille', v: SIZE_LABEL[effectiveSize(c.size)] }, // Taille : pas une caractéristique → pas de lien Codex
  ];
  const skillRows: CodexRow[] = (c.skills ?? []).map((s) =>
    idRefRow('skills', s.id, s.spec, `${skillInstanceLabel(s)} ${skillBaseValue(c, s.id, s.spec)}`),
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
    { title: 'Caractéristiques', layout: 'grid', rows: charRows },
    weaponRows.length ? { title: 'Armes', layout: 'chips', rows: weaponRows } : null,
    worn.length ? { title: 'Armure', layout: 'list', rows: [{ t: 'text', text: worn.map((l) => `${HIT_LOCATION_LABELS[l]} ${c.armour![l]}`).join(' · ') }] } : null,
    chips('Traits', traitRefRows(c.traits)),
    skillRows.length ? { title: 'Compétences', layout: 'chips', rows: skillRows } : null,
    chips('Talents', (c.talents ?? []).map((t) => idRefRow('talents', t.talentId, t.spec))),
    chips('Sorts', (c.spells ?? []).map((id) => idRefRow('spells', id))),
  );
}
