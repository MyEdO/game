/**
 * Édition DEV d'une entrée du Compendium — édite la VRAIE donnée (`src/data/*.json`, app-owned).
 * Réutilise le navigateur du Compendium (cet éditeur ne vit QUE dans le panneau détail) + le motif
 * `<datalist>` d'autocomplétion (cf. SpellsField) pour les champs-références (traits/talents/sorts…
 * piochés dans leurs vrais datasets, param libre « 8 Tentacules +8 » conservé). Sauvegarde via File
 * System Access (`fsPersist`) + preview mémoire (`setDataset`).
 */
import { useEffect, useMemo, useState } from 'react';
import { datasetArray, setDataset, datasetObject, datasetObjectSerializeRoot, setObjectDataset, datasetFile, datasetSerializeRoot, datasetObjectFile, type DatasetKey, type ObjectDatasetKey } from '../../data/overrides';
import { CATEGORY_DATASET_DERIVE, OBJECT_CATEGORY_DERIVE } from '../../data/schemas/exposition-derivee';
import type { SkillRef } from '../../engine/skills';
import type { SteamBreakdownEntry } from '../../engine/shipBuild';
import { serializeDataset } from '../../data/serialize';
import { validateDataset, metaPourFichier, chargeDiscriminee, brouillonNeuf, noeudDuChamp, noeudObjet, schemaForFile } from '../../data/schemas/validate';
import * as fs from '../../data/fsPersist';
import { estDerive, inferFields, type FieldDesc } from './editFields';
import { libelleDeValeur, valeursDe } from '../../data/schemas/grammaire/meta';
import { entryKey, invalidateCodexLookup } from './registry';
import { ACTIVITY_RESOLVERS, RESOLVER_OWNER, resolversOwnedBy } from '../../engine/activities';
import type { ActivityContext, OutcomeBand, BattleOutcome, BattleSide, BattleOutcomeTarget, BattleOutcomeScale, BattleCond, ActivityResolver, ResolverOwner } from '../../engine/activities';
import { weatherCondition } from '../../engine/travelStages';
import { weatherIdSchema } from '../../data/schemas/defs/weather';
import { outcomeOnSchema, battleCondSchema, battleOutcomeTargetSchema, battleOutcomeScaleSchema, battleSideSchema } from '../../data/schemas/defs/activities';
import { waterAppliesToSchema, waterTableSchema } from '../../data/schemas/defs/water-exposure';
import { RefField, refFieldCfg } from './RefField';
import { DescRefField } from './DescRefField';
import type { DescRef } from '../../data/source/decoupe';
import { Icon } from '../Icon';
import { NumberField } from '../NumberField';
import { PlageField, type PlageValue } from '../PlageField';
import { GatedAction } from '../GatedAction';
import { raceKeySchema } from '../../data/schemas/grammaire/valeurs';
import { MonsterPartsFields } from '../editor/MonsterPartsFields';
import { FlowEditor, NoeudTestField, type NoeudTest } from '../editor/FlowEditor';
import { ctxDeCatalogue } from '../editor/EffectList';
import { GameOpEditor, FormulaField, opsMissingRefs } from '../editor/GameOpEditor';
import type { GameOp } from '../../engine/ops';
import type { ConsumableDuration } from '../../engine/consumables';
import { JsonField } from '../editor/JsonField';
import { creatureSpeciesOptions, QUAD_SPECIES, WINGED_SPECIES } from '../../gameIso/rig/creatures';
import { CreaturePreview } from './CreaturePreview';
import { porteurDApercu } from './apercuPorteur';
import type { EntityAppearance } from '../../engine/authoringAppearance';
import { type Flow, EMPTY_FLOW, type TriggeredEffect, type EffectTrigger } from '../../state/flow';
import { effectOnSchema, effectTriggerSchema } from '../../data/schemas/grammaire/mecanique';
import type { ManeuverDef, ManeuverMeasure } from '../../data';
import { SYMPTOM_SEVERITIES } from '../../data';
import type { AttackKind } from '../../engine/creatureAttacks';
import { WeaponField } from '../editor/WeaponField';
import { PsychTraitsField } from '../editor/PsychTraitsField';
import type { Weapon } from '../../engine/types';
import type { PsychTrait } from '../../engine/psychology';
import { SymptomsField, SymptomTickField, DiseaseDailyTestField, type DiseaseDailyTest, ShipCrewHitField, type ShipCrewHitValue, TalentTestField, CombatField, AdvancementRefField, TrappingRefField, CharKeysField, DispoSaisonniereField, DomainEffectsField, TraitListField, OptionalsListField, HarvestField, SpecsField, RuleValueField, RuleActionField, type RuleShape } from './StructFields';
import type { OptionalRule } from '../../engine/policy';
import type { TraitInstance, OptionalEntry } from '../../engine/statEntry';
import type { DomainData } from '../../data';
import type { CharKey, Difficulty } from '../../engine/types';
import { CHAR_KEYS, CHAR_LABELS, DIFFICULTY_LABELS, HIT_LOCATION_LABELS } from '../../engine/types';
import type { DiseaseSymptom } from '../../engine/disease';
import type { CombatFeature } from '../../engine/combatFeatures/types';
import type { AdvancementRef, TrappingRef, TalentTest, SpecEntry, WaterExposureData, WaterExposureModifier } from '../../data';
import { skillRefLabel, talentRefLabel, type SkillRef as SkillRefLivre, type TalentRef } from '../../data';
import { specsSourceSchema, symptomSeveritySchema } from '../../data/schemas/grammaire/valeurs';
import { parseSkillRef, parseTalentRef } from '../editor/refFormatLivre';
import type { SecondaryRef, Variant } from '../../data/schemas/grammaire/valeurs';
import { OPTIONAL_RULES, type RuleKind, type RuleValue } from '../../engine/policy';
import { VARIANT_RESOLVED_FIELDS as TALENT_VARIANT_FIELDS } from '../../data/schemas/defs/talents';
import { VARIANT_RESOLVED_FIELDS as SPELL_VARIANT_FIELDS } from '../../data/schemas/defs/spells';
import { Grid } from '../Layout';

/** Catégories à VARIANTES réglées (#563/#564), avec les champs que leur résolution APPLIQUE — valeurs
 *  LUES des defs (`VARIANT_RESOLVED_FIELDS`), jamais recopiées : `VariantsField` en déduit les sous-
 *  éditeurs à rendre, donc aucun champ republiable n'est inoéditable et aucun ne s'affiche à vide. */
const VARIANT_FIELDS_BY_CATEGORY: Record<string, readonly string[]> = {
  talents: TALENT_VARIANT_FIELDS,
  spells: SPELL_VARIANT_FIELDS,
};

/** Catégorie Codex → dataset-LISTE éditable, et catégorie Codex → dataset-OBJET : DÉRIVÉS des
 *  déclarations `exposition` des defs de schéma (`src/data/schemas/exposition-derivee.ts`, #1472).
 *  Le cast aux clés d'`overrides` est tenu par `exposition-contrats.test.ts` (routes ⊆ bindings). */
const CATEGORY_DATASET = CATEGORY_DATASET_DERIVE as Record<string, DatasetKey>;
const OBJECT_CATEGORY = OBJECT_CATEGORY_DERIVE as Record<string, { ds: ObjectDatasetKey; mode: 'single' | 'record' }>;
export const editableObjectDataset = (categoryKey: string): { ds: ObjectDatasetKey; mode: 'single' | 'record' } | undefined => OBJECT_CATEGORY[categoryKey];
/** Une catégorie est éditable au Codex ssi elle a un dataset tableau OU un dataset-objet. */
export const editableDataset = (categoryKey: string): DatasetKey | undefined => CATEGORY_DATASET[categoryKey];
export const isEditableCategory = (categoryKey: string): boolean => !!CATEGORY_DATASET[categoryKey] || !!OBJECT_CATEGORY[categoryKey];

/** Champ-réf → son dataset. Double usage : autocomplétion `<datalist>` des champs-listes ET
 *  validation des refs (`validateEntry` : chaque `{id}` du champ doit résoudre dans ce dataset). */
const REF_LIST_DATASET: Record<string, DatasetKey> = {
  traits: 'traits', optionals: 'traits', skills: 'skills', talents: 'talents',
  spells: 'spells', trappings: 'trappings', blessings: 'spells', miracles: 'spells', chaosSpells: 'spells',
  traumas: 'traumas',
};

/** Catégories/CHAMPS portant un `GameOp[]` NOMMÉ autre que `passive` (#157) — MÊME éditeur
 *  (`GameOpEditor`), juste un champ différent : `ops` (effet immédiat d'un Critique/Traumatisme),
 *  `occupantOps` (subi par un tiers — cavalier/passager), `crewOps`/`captainOps` (Chant de marin).
 *  Généralise l'idée d'`isPassive` (qui ne couvre QUE `passive`) sans dupliquer l'éditeur : ajouter une
 *  source = ajouter SA/SES clé(s) ici (lu par `dedicatedFieldKeys` ET le rendu). */
/** Les 10 catégories de Critiques de coque (MDG 13 navire + MSRC 07 fluvial, #157 suite) —
 *  MÊME forme `ShipCritEntry` (`ops` sur la coque + `crewHit` sur l'équipage), partagée par
 *  `OPS_FIELDS` et le rendu. */
const SHIP_CRIT_CATEGORIES = [
  'shipCriticalsCargaison', 'shipCriticalsGreement', 'shipCriticalsCoque', 'shipCriticalsAvirons', 'shipCriticalsEquipements',
  'riverCriticalsGreement', 'riverCriticalsAvirons', 'riverCriticalsGouvernail', 'riverCriticalsCoque', 'riverCriticalsSuperstructure',
];

/** Les 8 catégories de Critiques localisés (LDB 18 + AA 07, #173) partageant `traumas: string[]` — DES
 *  IDS de fiches de traumatisme (`traumas.json`), résolus PAR ID (`traumaFicheById`/`traumaById`,
 *  `engine/critical.ts`). Éditeur dédié (`TraumaListField`, sélecteurs
 *  id→label) plutôt que le datalist générique : les fiches partagent des labels NON uniques (deux
 *  fiches « Fracture » à sévérité différente) — un datalist par label ne pourrait même pas les distinguer. */
const CRITICAL_CATEGORIES = [
  'criticalsTete', 'criticalsBras', 'criticalsCorps', 'criticalsJambe',
  'aaCriticalsTete', 'aaCriticalsBras', 'aaCriticalsCorps', 'aaCriticalsJambe',
];

const OPS_FIELDS: Record<string, string[]> = {
  traumas: ['ops'],
  activities: ['onSuccess'], // #168 : effet mécanique de réussite (GameOp[]) → GameOpEditor commun
  maladies: ['infectionPassive'], // MSRC 16 l.138 : passifs actifs pendant l'infection (Vers du Reik)

  criticalsTete: ['ops'], criticalsBras: ['ops'], criticalsCorps: ['ops'], criticalsJambe: ['ops'],
  aaCriticalsTete: ['ops'], aaCriticalsBras: ['ops'], aaCriticalsCorps: ['ops'], aaCriticalsJambe: ['ops'],
  incidentsMonture: ['occupantOps'], problemesVehicule: ['occupantOps'],
  seaShanties: ['crewOps', 'captainOps'],
  drunkenness: ['ops'], // LOT 1 #422 (suite) : effet mécanique optionnel d'un résultat d'Ivresse (LDB 09)
  stars: ['ops'], // #1467 L1b : effet du signe aux attributs de départ (ADE II 3 l.38) — GameOp[] comme les autres
  // LOT 3 #422 (FINAL) : Empoignade — `init` (à la touche) en `GameOp[]` top-level (`win.damage/entangle/
  // free`, sous `win`, retombent en sous-formulaire récursif `object`, hors guard — même patron `windEffect`
  // de `riverNavigation`). Incantations Imparfaites/Colère des dieux — `ops` (dialecte compilé, mais MÊMES
  // kinds `condition`/`wounds`/`corruption`/`reduceToZero`/`castPenalty` que le vocabulaire `GameOp` réel).
  grapple: ['init'],
  miscastMinor: ['ops'], miscastMajor: ['ops'], miscastWrath: ['ops'],
  ...Object.fromEntries(SHIP_CRIT_CATEGORIES.map((k) => [k, ['ops']])),
};
const opsFieldsOf = (categoryKey: string): string[] => OPS_FIELDS[categoryKey] ?? [];

type Entry = Record<string, unknown>;

/** ids d'un champ-liste de refs — descend dans les branches `of` d'un `{pick}` (`AdvancementRef`) et
 *  dans le `choice` d'une `TrappingRef` ; ignore les `{text}` narratifs et jokers. Une CHAÎNE BRUTE (ex.
 *  `criticalsTete.traumas: string[]`) est traitée comme un id DIRECT (#173 : ces listes référencent
 *  leur dataset par id, jamais par libellé — cf. `STRING_LIST_LABEL_EXCEPTIONS` pour l'unique
 *  contre-exemple documenté). */
function refIdsIn(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  const out: string[] = [];
  for (const x of v) {
    if (typeof x === 'string') { out.push(x); continue; }
    if (!x || typeof x !== 'object') continue;
    const o = x as { choice?: unknown; of?: unknown; ref?: { id?: unknown }; id?: unknown };
    if (o.of) out.push(...refIdsIn(o.of));
    else if (o.choice) out.push(...refIdsIn(o.choice));
    else if (o.ref && typeof o.ref.id === 'string') out.push(o.ref.id);
    else if (typeof o.id === 'string') out.push(o.id);
  }
  return out;
}

/** (categorie.champ) où un champ-liste de CHAÎNES de `REF_LIST_DATASET` porte légitimement des
 *  LIBELLÉS et non des ids — SEULE exception connue : `pregens.pettySpells` (libellés d'AUTHORING de
 *  sorts de Magie mineure, validés + résolus en id par la fabrique du pré-tiré, `src/data/pregens.ts`
 *  fonction `buildPregenHero` — #421 ; jamais relu par id depuis le JSON). Toute autre liste de
 *  chaînes d'un champ-réf DOIT contenir des ids qui résolvent (#173 : un éditeur par datalist-de-
 *  labels y écrivait un libellé, cassant `traumaFicheById` au runtime — cf. `criticalsTete.traumas`). */
const STRING_LIST_LABEL_EXCEPTIONS = new Set(['pregens.pettySpells']);

/** Champs-réf NICHÉS (une valeur ou une liste, sous un sous-objet/sous-tableau — hors de portée de
 *  `REF_LIST_DATASET`, qui ne regarde QUE les champs top-level de `entry`) : même garantie de
 *  résolvabilité, décrite par un accesseur PUR `entry → (id|undefined)[]`. #173 : `mutationTables.
 *  ranges[].mutation` et `domains.castBonus.perCondition` en sont les 2 sites CONFIRMÉS (un éditeur par
 *  datalist-de-labels y écrivait un libellé, cassant `mutations.ts::rollMutation`/`state/combatFlow.ts::
 *  domainCastBonus` au runtime) — ajouter une réf nichée = ajouter SON accesseur ici. `weather.json`
 *  partage la forme `ranges[]` mais sa clé est `.weather` (union fermée, pas une réf de dataset) :
 *  l'accesseur `mutation` y est simplement `undefined`, filtré plus bas — aucun faux positif. */
const NESTED_REF_FIELDS: { key: string; ds: DatasetKey; get: (entry: Entry) => (string | undefined)[] }[] = [
  { key: 'ranges[].mutation', ds: 'mutations', get: (e) => ((e.ranges as { mutation?: string }[] | undefined) ?? []).map((r) => r.mutation) },
  { key: 'castBonus.perCondition', ds: 'etats', get: (e) => [(e.castBonus as { perCondition?: string } | undefined)?.perCondition] },
  { key: 'prosthesis[].trappingId', ds: 'trappings', get: (e) => ((e.prosthesis as { trappingId?: string }[] | undefined) ?? []).map((p) => p.trappingId) },
];

/** Valide une entrée AVANT persist (bouton Enregistrer bloqué tant que non vide) : identité
 *  (id non vide + unique, libellé non vide) + refs (`{id}` ou chaîne directe) résolvables dans leur
 *  dataset. PUR. `selfIndex` = position de l'entrée éditée dans `entries` (−1 pour une création). */
export function validateEntry(categoryKey: string, entry: Entry, entries: Entry[], selfIndex: number): string[] {
  const errors: string[] = [];
  // id : requis + unique là où le dataset est id-based (toutes les entités migrées par-id).
  if (entries.some((e) => typeof e.id === 'string')) {
    const id = typeof entry.id === 'string' ? entry.id.trim() : '';
    if (!id) errors.push('id vide — identifiant stable requis');
    else if (entries.some((e, i) => i !== selfIndex && e.id === id)) errors.push(`id « ${id} » déjà pris par une autre entrée`);
  }
  // Libellé : la clé d'identité générique (label/name/key/id) ne peut pas être vide — c'est elle
  // que le navigateur du Codex et l'éditeur utilisent pour retrouver l'entrée.
  if (!entryKey(entry).trim()) errors.push('libellé vide');
  // Refs résolvables : chaque `{id}` (ou chaîne directe) d'un champ-réf doit exister dans son dataset —
  // détecté par nom de champ (table unique), sauf la contre-exception déclarée ci-dessus.
  for (const [field, ds] of Object.entries(REF_LIST_DATASET)) {
    if (!(field in entry)) continue;
    if (STRING_LIST_LABEL_EXCEPTIONS.has(`${categoryKey}.${field}`)) continue;
    const known = new Set((datasetArray(ds) as { id?: string }[]).map((e) => e.id).filter(Boolean));
    for (const id of refIdsIn(entry[field])) {
      if (id === '') errors.push(`${field} : réf à choisir (${ds})`);
      else if (!known.has(id)) errors.push(`${field} : réf « ${id} » introuvable (${ds})`);
    }
    // `trappings` (classes/careerLevels) porte aussi la dotation VÉHICULE `{vehicleId}` (foyer
    // `vehicles.json`, jamais le foyer trappings) : même garantie de résolvabilité.
    if (field === 'trappings') {
      const knownVehicles = new Set((datasetArray('vehicles') as { id?: string }[]).map((e) => e.id).filter(Boolean));
      for (const tr of (entry[field] as { vehicleId?: unknown }[] | undefined) ?? []) {
        if (tr && typeof tr === 'object' && typeof tr.vehicleId === 'string' && !knownVehicles.has(tr.vehicleId)) {
          errors.push(`${field} : réf véhicule « ${tr.vehicleId} » introuvable (vehicles)`);
        }
      }
    }
  }
  // Refs NICHÉES (#173) : même garantie, pour les champs-réf sous un sous-objet/sous-tableau.
  for (const { key, ds, get } of NESTED_REF_FIELDS) {
    const known = new Set((datasetArray(ds) as { id?: string }[]).map((e) => e.id).filter(Boolean));
    for (const id of get(entry)) {
      if (id == null) continue;
      if (id === '') errors.push(`${key} : réf à choisir (${ds})`);
      else if (!known.has(id)) errors.push(`${key} : réf « ${id} » introuvable (${ds})`);
    }
  }
  // Ops MÉCANIQUES portées par l'entrée (`passive`, `effects`, `ops`, rangées de table…) : une réf de
  // registre REQUISE non élue rend l'op inapplicable — source unique `OP_REF_FIELDS`.
  errors.push(...opsMissingRefs(entry));
  if (categoryKey === 'reglesOptionnelles') errors.push(...ruleValueErrors(entry));
  return errors;
}

/**
 * Règle optionnelle (V9 #1318) : sa VALEUR doit être du type que son `kind` promet. `ruleValueSchema`
 * est l'union booléen|nombre|chaîne — elle laisse donc passer `"false"` sur un `flag`, et le moteur
 * (`rule(id) === true`) ne reconnaîtrait plus rien : la règle s'éteindrait SANS UN MOT. Refus
 * BRUYANT ici, en plus du contrôle typé du formulaire (`RuleValueField`) : une donnée éditée à la
 * main hors du Codex passe par cette porte au premier enregistrement.
 */
function ruleValueErrors(entry: Entry): string[] {
  const out: string[] = [];
  const kind = entry.kind;
  const options = Array.isArray(entry.options) ? (entry.options as unknown[]).filter((o) => typeof o === 'string') as string[] : [];
  const check = (champ: string, v: unknown): void => {
    if (v === undefined) return;
    if (kind === 'flag' && typeof v !== 'boolean') out.push(`${champ} : un interrupteur (kind « flag ») vaut un booléen, pas ${typeof v === 'string' ? `la chaîne « ${v} »` : String(v)}`);
    if (kind === 'param' && typeof v !== 'number') out.push(`${champ} : un nombre (kind « param ») vaut un nombre, pas ${typeof v === 'string' ? `la chaîne « ${v} »` : String(v)}`);
    if (kind === 'mode') {
      if (typeof v !== 'string') out.push(`${champ} : un choix (kind « mode ») vaut une des valeurs de \`options\``);
      else if (options.length > 0 && !options.includes(v)) out.push(`${champ} : « ${v} » n'est pas une des \`options\` (${options.join(', ')})`);
    }
  };
  check('default', entry.default);
  const action = entry.action as { when?: unknown } | undefined;
  if (action && typeof action === 'object') check('action.when', action.when);
  if (kind === 'mode' && options.length < 2) out.push('options : un choix (kind « mode ») propose au moins deux valeurs');
  if (kind === 'param' && (typeof entry.min !== 'number' || typeof entry.max !== 'number')) out.push('min/max : un nombre (kind « param ») déclare ses bornes');
  if (kind === 'param' && typeof entry.default === 'number' && typeof entry.min === 'number' && typeof entry.max === 'number'
      && (entry.default < entry.min || entry.default > entry.max)) {
    out.push(`default : ${entry.default} sort des bornes [${entry.min}, ${entry.max}]`);
  }
  return out;
}

/**
 * COUTURE format livre ↔ refs structurées de l'atelier (#1548) : une ref par LIGNE, rendue par le
 * libellé d'affichage de son concept (`skillRefLabel`/`talentRefLabel`) et relue par le parse inverse
 * de la porte unique (`refFormatLivre`). Ces deux fonctions PURES sont exactement ce que le champ
 * appelle — le round-trip se mesure donc sur la vraie couture (`codex-creature-refs-roundtrip.test`).
 */
export function refsEnLignes<T>(refs: readonly T[] | undefined, libelle: (r: T) => string): string {
  return (refs ?? []).map(libelle).join('\n');
}
export function lignesEnRefs<T>(texte: string, parse: (ligne: string) => T): T[] {
  return texte.split('\n').map((s) => s.trim()).filter(Boolean).map(parse);
}

/** Champ MULTILIGNE de refs au format livre (une par ligne). La saisie vit en BROUILLON local et se
 *  POSE au blur : la normalisation par la porte ne réécrit jamais la ligne sous les doigts de
 *  l'auteur. Le blur ne REFUSE rien : toute ligne est coercée en ref par le parse (un nom inconnu
 *  devient son slug). Le refus est NOMINATIF au Save — `validateEntry` rend « skills : réf « X »
 *  introuvable (skills) » et l'enregistrement reste bloqué tant qu'une erreur subsiste. */
function LignesFormatLivreField({ label, hint, value, onCommit }: { label: string; hint: string; value: string; onCommit: (texte: string) => void }) {
  const [brouillon, setBrouillon] = useState<string | null>(null);
  return (
    <label className="ed-field">
      <span>{label}</span>
      <span className="de-hint">{hint}</span>
      <textarea
        rows={6}
        value={brouillon ?? value}
        onChange={(e) => setBrouillon(e.target.value)}
        onBlur={() => { if (brouillon != null) { onCommit(brouillon); setBrouillon(null); } }}
      />
    </label>
  );
}

/** Axes du PROFIL de manœuvre rendus par `ManeuverDefField` (selects/checkbox). */
const MANEUVER_PROFILE_KEYS = ['kind', 'activation', 'advantageCost', 'advantageMode', 'stat', 'defense', 'targeting', 'range', 'blast', 'magic'];

/**
 * Clés de champ COUVERTES par un éditeur dédié (sorties du formulaire générique inféré), PAR catégorie.
 * SOURCE UNIQUE : utilisée par le filtre de `CodexEdit` ET par le garde-fou `no-json-fields.test` (qui
 * vérifie qu'aucun champ d'aucun dataset éditable ne retombe en `kind:'json'`). Ajouter un éditeur dédié
 * = ajouter sa/ses clé(s) ici (et le composant dans le rendu). */
export function dedicatedFieldKeys(categoryKey: string): Set<string> {
  const k = new Set<string>();
  const add = (...keys: string[]) => keys.forEach((x) => k.add(x));
  if (['creatures', 'traits', 'mutations'].includes(categoryKey)) add('appearance');
  if (['spells', 'traits', 'qualities', 'domains', 'talents', 'maneuvers', 'etats', 'psychologies', 'symptoms', 'mutations'].includes(categoryKey)) add('effects');
  if (categoryKey === 'maneuvers') add(...MANEUVER_PROFILE_KEYS);
  if (['traits', 'qualities', 'mutations', 'talents', 'etats', 'trappings', 'psychologies', 'navalTraits'].includes(categoryKey)) add('passive');
  if (categoryKey === 'structures' || categoryKey === 'races') add('traits'); // {id,value?}[] → réutilise TraitListField (comme creatures) — Trait racial d'espèce (encombrance/consommation), #572
  if (categoryKey === 'crewRoles') add('skills'); // {id,spec?}[] → éditeur dédié (SkillSpecListField)
  if (categoryKey === 'axes') add('skills', 'talents'); // #409 : {id,spec?}[]/{talentId,spec?}[] → SkillSpecListField/TalentSpecListField
  if (categoryKey === 'traumas') add('prosthesis'); // {trappingId,cancels}[] → éditeur dédié (ProsthesisField)
  if (CRITICAL_CATEGORIES.includes(categoryKey)) add('traumas', 'test'); // string[] d'ids → TraumaListField (#173) ; `test` → FlowEditor (#1682)
  if (categoryKey === 'steamBreakdowns') add('restart'); // {skill:{id,spec?},difficulty,extendedDR?}[] → éditeur dédié
  add(...opsFieldsOf(categoryKey)); // ops/occupantOps/crewOps/captainOps → GameOpEditor (#157)
  if (categoryKey === 'symptoms') add('passive', 'passiveBySeverity', 'onTick', 'visiblePassive', 'visibleLocations'); // GameOp[] + test de cycle + gate visibilité → éditeurs dédiés (capabilities = sous-form générique)
  if (categoryKey === 'stars') add('sub');
  if (categoryKey === 'mutationTables' || categoryKey === 'weather') add('ranges');
  if (categoryKey === 'mutations') add('psychTraits');
  if (['mutations', 'trappings'].includes(categoryKey)) add('derivedWeapon');
  if (categoryKey === 'trappings') add('consumable', 'consumableDuration', 'onHitEffects'); // onHitEffects → TriggeredEffectsField (#175)
  // #1318 E4/C-γ : paliers d'entraînement d'une PROTHÈSE (LDB 73) — `{cost,label,reduces?,grants?}[]`,
  // tableau d'objets HOMOGÈNES → éditeur GÉNÉRIQUE commun (`GenericArrayField`), jamais le repli JSON.
  if (categoryKey === 'trappings') add('prosthesisTraining');
  if (categoryKey === 'maladies') add('symptoms', 'dailyTest'); // `dailyTest` porte un nœud `test` du Flow → DiseaseDailyTestField (#1657 B2b)
  if (categoryKey === 'talents') add('combat', 'test');
  if (VARIANT_FIELDS_BY_CATEGORY[categoryKey]) add('variants'); // variants → VariantsField (#563 Lot 5)
  if (['trappings', 'qualities', 'spells', 'traits', 'navalTraits', 'talents', 'domains', 'creatures', 'races'].includes(categoryKey)) add('alsoIn'); // alsoIn → AlsoInField (#563 Lot 5)
  if (categoryKey === 'skills' || categoryKey === 'talents') add('specs');
  if (categoryKey === 'traits') add('specsSource', 'indice', 'range', 'specsOpen', 'specsMulti'); // schéma d'argument → éditeur dédié
  // V9 #1318 : la VALEUR d'une règle optionnelle est typée par son `kind` (`RuleValueField`/
  // `RuleActionField`) — le champ inféré serait un TEXTE pour les 81 règles (échantillon `mode`),
  // et `"false"` y éteindrait une règle sans un mot. `validateEntry` refuse en plus au save.
  if (categoryKey === 'reglesOptionnelles') add('default', 'action');

  if (categoryKey === 'races' || categoryKey === 'careerLevels') add('skills', 'talents');
  if (categoryKey === 'classes' || categoryKey === 'careerLevels' || categoryKey === 'creatures') add('trappings'); // TrappingRef[] — MEME forme, MEME éditeur (#1548)
  // Créature : `skills`/`talents` sont des REFS structurées (`SkillRef`/`TalentRef`) — éditées au FORMAT
  // LIVRE (porte partagée avec l'éditeur de statbloc de scène), jamais par le champ-liste générique.
  if (categoryKey === 'creatures') add('skills', 'talents');
  if (categoryKey === 'careerLevels') add('characteristics');
  if (categoryKey === 'domains') add('castBonus', 'missile', 'casterOps');
  // Rubrique de VENT (`windModifiers`, #729) : tableau top-level d'objets → éditeur GÉNÉRIQUE commun.
  if (categoryKey === 'domains') add('windModifiers');
  if (categoryKey === 'characteristics') add('options'); // dépenses d'une ressource → éditeur GÉNÉRIQUE commun
  // options de Test (l.121), barème par plage de DR (l.111), camps asymétriques (l.27) → MÊME éditeur générique
  if (categoryKey === 'tavernGames') add('options', 'table', 'sides');
  if (categoryKey === 'creatures') add('traits', 'optionals', 'harvest');
  if (categoryKey === 'details') add('texts');
  if (SHIP_CRIT_CATEGORIES.includes(categoryKey)) add('crewHit'); // {crewTarget?, test | ops} — nœud `test` du Flow → ShipCrewHitField (#1657 B2c)
  if (categoryKey === 'waterExposure') add('test', 'modifiers', 'diseases'); // #157 suite (MSRC 16)
  // LOT 1 #422 : seules les tables NICHÉES en TABLEAU top-level d'une fiche-objet navale retombent en
  // json (repli générique) — chaque sous-objet HÉTÉROGÈNE (vitesseMax/salissures/orientation/phares/
  // poursuite/reparation…) recourt déjà au sous-formulaire récursif (`ObjectField`), hors guard.
  if (categoryKey === 'seaNavigation') add('forcerLeRythme');
  if (categoryKey === 'seaPerils') add('hazards', 'detroits', 'tourbillons', 'gestionDesPerils');
  if (categoryKey === 'seaWeather') add('table', 'precipitations', 'temperatures', 'visibilites', 'vents', 'roseDesVents');
  // LOT 1 #422 (suite) : Disponibilité & Troc (`disponibilite`, mode 'single', patron `waterExposure`) —
  // `dispoPct`/`barterRatios` (tableaux top-level) → éditeur GÉNÉRIQUE commun (`GenericArrayField`).
  if (categoryKey === 'disponibilite') add('dispoPct', 'barterRatios');
  // LOT 2 #422 : Navigation fluviale (`riverNavigation`, mode 'single', patron `waterExposure`) —
  // `windForces`/`windDirections` (tableaux top-level) → éditeur GÉNÉRIQUE commun (`GenericArrayField`).
  // `windEffect`/`capsize`/`rowingAgility`/`outOfControl`/`echouage`/`temporaryRepair` sont des objets
  // (hétérogènes ou Record de Record) déjà couverts par le sous-formulaire récursif (`ObjectField`).
  if (categoryKey === 'riverNavigation') add('windForces', 'windDirections');
  // Fourchettes à DEUX bornes (#1659) — toutes servies par la MÊME primitive (`PlageField`) : la
  // longueur de coque (bande finale ouverte, MDG 12 l.129), le sous-tirage astral (1d10, ADE II 03
  // l.63) ci-dessus, et les quatre colonnes de disponibilité saisonnière (d100). Sans cette ligne,
  // `avail` retombait sur le sous-formulaire générique et rendait ses clefs techniques à l'écran.
  if (categoryKey === 'shipHullSizes') add('lengthM');
  if (categoryKey === 'seaCargo' || categoryKey === 'landCargo') add('avail');
  // #168 : Activité — Test « posté » (contexts/skills « au choix »/char/difficulty) + table d'issues
  // `outcomes` (OutcomeBand[]) → éditeurs dédiés ; `onSuccess` couvert par opsFieldsOf ci-dessus.
  // `resolver` (#1318 V6) : vocabulaire FERMÉ → sélecteur dédié, jamais le champ texte générique.
  if (categoryKey === 'activities') add('contexts', 'skills', 'char', 'difficulty', 'outcomes', 'resolver');
  // #1612 : `testMods` (modificateurs de situation) et `worldRolls` (dés de MONDE après le Test) sont des
  // tableaux top-level d'objets HOMOGÈNES → éditeur GÉNÉRIQUE commun (`GenericArrayField`), MEME patron
  // que la rubrique de Vent et les options de jeu de taverne — jamais le repli JSON.
  if (categoryKey === 'activities') add('testMods', 'worldRolls');
  // #851 : Magie environnementale (`arcanePhenomena`, mode 'single', patron `waterExposure`) — ses 4
  // tableaux top-level → éditeur GÉNÉRIQUE commun (`GenericArrayField`).
  if (categoryKey === 'arcanePhenomena') add('saturationLevels', 'windSaturationEffects', 'phenomena', 'tables');
  // #1715 : ornements d'identité d'un bâtiment — tableau d'objets HOMOGÈNES `{id, anchor}` → éditeur
  // GÉNÉRIQUE commun (`GenericArrayField`, nœud du schéma), jamais le repli JSON.
  if (categoryKey === 'buildings') add('features');
  return k;
}

/** Échantillons pour `inferFields` d'une catégorie éditable (tableau d'entités, objet unique, ou
 *  valeurs d'un Record keyé). SOURCE UNIQUE des champs inférés — utilisée par `CodexEdit` ET le
 *  garde-fou no-json-fields.test (pas de duplication de la logique de projection). */
export function editableEntries(categoryKey: string): Entry[] {
  const obj = editableObjectDataset(categoryKey);
  if (obj) {
    const data = datasetObject(obj.ds) as Record<string, unknown>;
    if (obj.mode === 'single') return [data as Entry];
    const entries = Object.values(data) as Entry[];
    return entries.length ? entries : [{}];
  }
  return datasetArray(editableDataset(categoryKey)!) as Entry[];
}

/** Props de l'atelier : l'ancrage est un VERROU PAR CONSTRUCTION (#1472) — soit l'entrée est NEUVE
 *  (`isNew`, le save APPEND), soit elle porte l'`id` STABLE du document édité. Aucun appel ne peut
 *  être « ni l'un ni l'autre » : la branche APPEND silencieuse n'est plus atteignable. */
type CodexEditProps = { categoryKey: string; label: string; onClose: () => void }
  & ({ isNew: true; id?: undefined } | { isNew?: false; id: string });

export function CodexEdit({ categoryKey, label, id, onClose, isNew }: CodexEditProps) {
  // SOURCE de données UNIFIÉE (tableau d'entités OU dataset-objet) → la même UI de formulaire édite les
  // deux formes : tableau (une entité par item Codex) et objet unique (`details`, fiches de règle).
  // `entries` = échantillons pour `inferFields` ; `initial` = l'objet édité ;
  // `file`/`persist` = écriture disque (preview live in-place + `serializeDataset` byte-fidèle).
  const obj = editableObjectDataset(categoryKey);
  const src = useMemo<{ entries: Entry[]; initial: Entry; index: number; file: string; persist: (entry: Entry) => void }>(() => {
    const entries = editableEntries(categoryKey);
    if (obj) {
      const data = datasetObject(obj.ds) as Record<string, unknown>;
      const file = datasetObjectFile(obj.ds);
      return { entries, initial: data as Entry, index: -1, file, persist: (e) => setObjectDataset(obj.ds, e as never) };
    }
    const dsKey = editableDataset(categoryKey)!;
    const arr = entries;
    // `isNew` : entrée VIERGE (le save APPEND) ; sinon ancrage par ID STABLE (#1472) — `id` est celui
    // de l'item du navigateur, qui EST l'`id` du document projeté ; `label` reste de l'AFFICHAGE.
    const index = isNew ? -1 : arr.findIndex((e) => String(e.id ?? '') === id);
    const file = datasetFile(dsKey);
    return {
      entries: arr,
      // Une entrée NEUVE part de ce que le def DÉTERMINE (`brouillonNeuf`) : le `type` d'enveloppe et,
      // pour un document discriminé, la valeur que le `select` affiche en tête — sinon l'écran promet
      // un cas que l'état ne porte pas (union des champs présentés, refus `invalid_value` au save).
      initial: arr[index] ?? brouillonNeuf(file, arr as Record<string, unknown>[]),
      index,
      file,
      persist: (e) => setDataset(dsKey, (index < 0 ? [...arr, e] : arr.map((x, i) => (i === index ? e : x))) as never),
    };
  }, [obj, categoryKey, label, id, isNew]);

  const [entry, setEntry] = useState<Entry>(() => structuredClone(src.initial));
  const [dir, setDir] = useState<FileSystemDirectoryHandle | null>(null);
  const [needsGrant, setNeedsGrant] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [msg, setMsg] = useState('');
  // Refus de SCHÉMA (contrat de donnée #176) : message champ-par-champ (formatZodError) quand la donnée
  // sérialisée ne parse pas son schéma zod — l'écriture disque est bloquée. Effacé à toute ré-édition.
  const [schemaError, setSchemaError] = useState<string | null>(null);

  useEffect(() => { fs.restoreDataDir().then((r) => { if (r) { setDir(r.handle); setNeedsGrant(!r.granted); } }); }, []);
  useEffect(() => { setEntry(structuredClone(src.initial)); setDirty(false); setMsg(''); setSchemaError(null); }, [src]);

  // L'apparence (MonsterPartsFields) ET les EFFETS d'un sort (FlowEditor) ont leur éditeur dédié — on les
  // sort du formulaire générique (sinon rendus en JSON brut). Les autres champs gardent le formulaire
  // inféré. Même patron : on filtre le champ et on rend l'éditeur spécialisé. L'apparence est éditable sur
  // les créatures ET les difformités déclarées en donnée (traits / mutations → fragment `appearance`).
  const hasAppearance = categoryKey === 'creatures' || categoryKey === 'traits' || categoryKey === 'mutations';
  const isSpell = categoryKey === 'spells';
  // Porteurs d'effets DÉCLENCHÉS (mêmes `TriggeredEffect` éditables) : Traits, Atouts d'arme, Domaines
  // (riders « à la touche »…) ET Talents (Assaut féroce onHit, Frappe réactive onCharged…).
  // États psychologiques (`psychologies`, LDB 21, #157) ÉTENDENT le même `StatusData` que les États
  // (`passive`/`effects` mutualisés) — même patron de rendu.
  const isTriggered = categoryKey === 'traits' || categoryKey === 'qualities' || categoryKey === 'domains' || categoryKey === 'talents' || categoryKey === 'etats' || categoryKey === 'psychologies' || categoryKey === 'symptoms' || categoryKey === 'mutations';
  // Manœuvre = ENTITÉ de 1ʳᵉ classe : profil dédié + ses effets AUTHORÉS (Dégâts + États) en GameOp.
  const isManeuver = categoryKey === 'maneuvers';
  // Porteurs de modificateurs PASSIFS continus (`GameOp[]`) édités par ops (GameOpEditor), comme un sort.
  // Talents inclus (Coup puissant, Dur à cuire… ou Frénésie → grantFreeAttack, tous en `passive`).
  // `psychologies` (États psy) et `navalTraits` (Trait/Amélioration de navire, #157) rejoignent le lot.
  const isPassive = categoryKey === 'traits' || categoryKey === 'qualities' || categoryKey === 'mutations' || categoryKey === 'talents' || categoryKey === 'etats' || categoryKey === 'symptoms' || categoryKey === 'trappings' || categoryKey === 'psychologies' || categoryKey === 'navalTraits';
  // Structure de siège (`structures`, #157) : `traits` = {id,value?}[] → réutilise TraitListField (comme
  // les Traits/Traits optionnels d'une créature).
  const isStructure = categoryKey === 'structures';
  // Rôle d'équipage (`crewRoles`, #157) : `skills` = {id,spec?}[] → éditeur dédié.
  const hasCrewSkills = categoryKey === 'crewRoles';
  // Axe de forces (`axes`, #409) : `skills`/`talents` = {id,spec?}[]/{talentId,spec?}[] → éditeurs dédiés
  // (SkillSpecListField, réutilisé tel quel côté Compétences ; TalentSpecListField, même patron côté Talents).
  const hasAxes = categoryKey === 'axes';
  // Traumatisme (`traumas`, #157) : `prosthesis` (prothèses annulatrices, LDB 73) = {trappingId,cancels}[].
  const hasProsthesis = categoryKey === 'traumas';
  // Critique localisé (LDB 6/AA, #173) : `traumas` = string[] d'ids de fiche (`traumas.json`) →
  // éditeur dédié (TraumaListField, sélecteurs id→label) au lieu du datalist générique par-label.
  const hasTraumaList = CRITICAL_CATEGORIES.includes(categoryKey);
  // Panne de Vapeur (`steamBreakdowns`, #157) : `restart` (Test de redémarrage) = {skill:{id,spec?},difficulty,extendedDR?}[].
  const hasRestartTest = categoryKey === 'steamBreakdowns';
  // Champs `GameOp[]` autres que `passive` (ops/occupantOps/crewOps/captainOps, #157) — même GameOpEditor.
  const opsFields = opsFieldsOf(categoryKey);
  // Symptôme de maladie : passifs `passiveBySeverity` par PALIER + Test de cycle `onTick`
  // (difficulté + conséquence GameOp `onFail`) — éditeurs dédiés au-dessus du formulaire générique.
  const isSymptom = categoryKey === 'symptoms';
  // Règle optionnelle : sa valeur par défaut (et le `when` de son action) sont typées par son `kind`.
  const isOptionalRule = categoryKey === 'reglesOptionnelles';
  // Table de Corruption : ses `ranges` (plages d100 → réf mutation) ont leur éditeur dédié.
  const isMutationTable = categoryKey === 'mutationTables';
  // Météo : ses `ranges` (plages d100 → type de météo) ont leur éditeur dédié.
  const isWeather = categoryKey === 'weather';
  // Mutation : traits psy conférés (PsychTraitsField) — sorti du repli JSON.
  const isMutation = categoryKey === 'mutations';
  // Arme DÉRIVÉE (WeaponField) : portée par une Mutation (Tentacule…) OU une Possession (prothèse-arme).
  const hasDerivedWeapon = categoryKey === 'mutations' || categoryKey === 'trappings';
  const hasConsumable = categoryKey === 'trappings';
  // Maladie : ses `symptoms` (DiseaseSymptom[]) ont un éditeur dédié (type + sévérité + difficulté).
  const isDisease = categoryKey === 'maladies';
  // Talent : sa capacité de combat `combat` (CombatFeature : drapeaux + castingKind/attackModes/offHand).
  const hasCombat = categoryKey === 'talents';
  // Variantes réglées par règle optionnelle (`variants`, #563 Lot 5) — VariantsField, dont les sous-
  // éditeurs DÉRIVENT de la liste blanche du dataset (`VARIANT_FIELDS_BY_CATEGORY`).
  const variantFields = VARIANT_FIELDS_BY_CATEGORY[categoryKey];
  // Emplacement(s) secondaire(s) d'une entrée réimprimée ailleurs (`alsoIn`, #563 Lot 5) — AlsoInField.
  const hasAlsoIn = ['trappings', 'qualities', 'spells', 'traits', 'navalTraits', 'talents', 'domains', 'creatures'].includes(categoryKey);
  // Compétence/Talent : `specs` = SpecEntry[] ({id,label}).
  const hasSpecs = categoryKey === 'skills' || categoryKey === 'talents';
  // Avancement (espèce / niveau de carrière) : `skills`/`talents` = AdvancementRef[] (réf/joker/choix/aléatoire).
  const hasAdvancement = categoryKey === 'races' || categoryKey === 'careerLevels';
  // Possessions (classe / niveau de carrière / créature) : `trappings` = TrappingRef[] (id catalogue + quantité, ou texte).
  const hasTrappings = categoryKey === 'classes' || categoryKey === 'careerLevels' || categoryKey === 'creatures';
  // Niveau de carrière : `characteristics` = CharKey[] (vocab fermé) → multi-sélection (pas de saisie libre).
  const hasCharKeys = categoryKey === 'careerLevels';
  // Étoile : `sub` = la fourchette du 1d10 interne (Étoile du Sorcier, ADE II 03 l.63) → `PlageField`.
  const hasStarSub = categoryKey === 'stars';
  // Cargaison (maritime/terrestre) : `avail` = quatre colonnes d100, une fourchette par saison.
  const hasDispoSaisonniere = categoryKey === 'seaCargo' || categoryKey === 'landCargo';
  // Domaine de magie : `castBonus`/`missile`/`casterOps` = attributs de domaine (éditeur dédié).
  const hasDomainEffects = categoryKey === 'domains';
  // Créature : `traits`/`optionals` = TraitInstance[] (réutilise `TraitListField` du StatblockEditor),
  // `harvest` = objet { rareté, dangerosité, usages } (HarvestField) → sortis du repli JSON.
  const isCreature = categoryKey === 'creatures';
  // Détails de création (objet unique `details.json`) : `texts` (5 entrées { all, bySpecies }) a son
  // éditeur dédié ; les 4 records Âge/Taille restent au formulaire générique (`recordNumber`).
  const isDetails = categoryKey === 'details';
  // Trait : SCHÉMA de son argument (indice/range/specsSource/specsOpen/specsMulti) → éditeur dédié
  // (select des sources DÉRIVÉ de SPEC_SOURCES + booléens + libellé d'indice), sorti du repli générique.
  const isTrait = categoryKey === 'traits';
  // Espèce : Trait racial (`traits`, #572) → réutilise TraitListField (comme creatures/structures) —
  // Ogre `{id:'ogre'}` (encombrance/consommation ×2 ; la Taille est portée par le talent Massif/Petit).
  const isRace = categoryKey === 'races';
  // Critique de coque (10 catégories navire/fluvial, #157 suite) : `crewHit` (crewTarget?, et `test`
  // ⊕ `ops`) → éditeur dédié (`ShipCrewHitField`) ; les `ops` de la COQUE restent sur le lot
  // GameOpEditor commun.
  const isShipCrit = SHIP_CRIT_CATEGORIES.includes(categoryKey);
  // Exposition à l'eau (`waterExposure`, #157 suite, MSRC 16) : `test` (Compétence+Difficulté),
  // `modifiers` (WaterExposureModifier[]) et `diseases` (plages d100 → maladie) ont chacun leur éditeur.
  const isWaterExposure = categoryKey === 'waterExposure';
  // LOT 1 #422 : fiches de règle navales UNIQUES (mode 'single', patron `waterExposure`) — leurs
  // tableaux top-level NICHÉS (`forcerLeRythme`/`hazards`/…/`roseDesVents`) ont un éditeur GÉNÉRIQUE
  // commun (`GenericArrayField`, réutilise `inferFields`+`Field` — pas de forme dédiée par champ).
  const isSeaNavigation = categoryKey === 'seaNavigation';
  const isSeaPerils = categoryKey === 'seaPerils';
  const isSeaWeather = categoryKey === 'seaWeather';
  // LOT 1 #422 (suite) : Disponibilité & Troc (`disponibilite`, mode 'single') — `dispoPct`/`barterRatios`
  // (tableaux top-level) au MÊME éditeur générique commun que les fiches navales ci-dessus.
  const isDisponibilite = categoryKey === 'disponibilite';
  // LOT 2 #422 : Navigation fluviale (`riverNavigation`, mode 'single') — `windForces`/`windDirections`
  // (tableaux top-level) au MÊME éditeur générique commun que les fiches ci-dessus.
  const isRiverNavigation = categoryKey === 'riverNavigation';
  const hasHullLength = categoryKey === 'shipHullSizes'; // `lengthM` : [minM,maxM]
  // #168 : Activité (`activities`) — Test « posté » (contexts/skills « au choix »/char/difficulty) +
  // table d'issues `outcomes` (OutcomeBand[]) ; `onSuccess` reste sur le lot GameOpEditor commun.
  const isActivity = categoryKey === 'activities';
  // #851 : Magie environnementale (`arcanePhenomena`, mode 'single') — ses 4 tableaux top-level au
  // MÊME éditeur générique commun que les fiches ci-dessus.
  const isArcanePhenomena = categoryKey === 'arcanePhenomena';
  // Champs au formulaire GÉNÉRIQUE = tous les champs inférés SAUF ceux couverts par un éditeur dédié
  // (`dedicatedFieldKeys`, source unique partagée avec le garde-fou no-json-fields.test).
  // Descripteurs de TOUS les champs inferés (avant retrait des éditeurs dédiés) : `VariantsField` y
  // repique le gabarit d'un champ republiable sans éditeur bespoke (NI, Durée…) pour le rendre pareil
  // que sur l'entrée de base.
  // La méta d'ÉDITION du document arrive par le CANAL REGISTRE (`SchemaDef.meta`, posée par
  // `document()`) — un def qui adopte la fabrique fait apparaître ses libellés FR sans une ligne d'UI.
  const allFields = useMemo(() => inferFields(src.entries as Record<string, unknown>[], { meta: metaPourFichier(src.file), noeud: noeudObjet(schemaForFile(src.file)) }), [src.entries, src.file]);
  // Un éditeur DÉDIÉ de tableau d'objets reçoit le NŒUD de SON champ, comme le chemin générique
  // (`Field` → `GenericArrayField`, `field.noeud`) : c'est le nœud qui porte le libellé des VALEURS
  // (`enumNomme`, #1694), donc le `select` nommé à toute profondeur du sous-formulaire.
  const noeudDe = (champ: string): unknown => noeudDuChamp(src.file, champ);
  // Un document DISCRIMINÉ (`SchemaDef.discriminant`) présente la charge du CAS de l'entrée — jamais
  // l'union des cas (mesuré sur `materials.json` : union 28 clés, 7 portées par une matière `prop`).
  // Le discriminant lui-même reste à l'écran : c'est en le changeant qu'on change de cas.
  const charge = useMemo(() => chargeDiscriminee(src.file, entry), [src.file, entry]);
  // Le `type` d'ENVELOPPE est un `z.literal` posé par la fabrique (`grammaire/document.ts`) : il
  // s'affiche, il ne se saisit pas. Un document SANS méta n'est pas passé par la fabrique — son `type`
  // y est un discriminant de CHARGE utile, qui reste éditable (même frontière que `libelleDuChamp`).
  const typeFige = !!metaPourFichier(src.file);
  const fields = useMemo(() => {
    const handled = dedicatedFieldKeys(categoryKey);
    return allFields
      // Un champ DÉRIVÉ de l'entrée ÉDITÉE ne s'offre pas à la saisie (`estDerive`, `editFields.ts`) :
      // le filtre est sur `entry`, pas sur l'échantillon du dataset — une entrée à la prose ADRESSÉE
      // n'expose pas son `desc` matérialisé, sa voisine à prose inline garde le sien.
      .filter((f) => !handled.has(f.key) && !estDerive(entry, f.key) && (!charge || f.key === charge.champ || charge.duCas.includes(f.key) || !charge.toutes.includes(f.key)))
      .map((f) => (typeFige && f.key === 'type' ? { ...f, fige: true } : f));
  }, [allFields, categoryKey, charge, entry, typeFige]);
  const edit = (key: string, v: unknown) => { setEntry((e) => ({ ...e, [key]: v })); setDirty(true); setSchemaError(null); };
  // Erreurs BLOQUANTES avant persist (identité + refs résolvables) — pas de validation des
  // datasets-objet (`details`, fiches de règle : pas d'identité par entrée).
  const errors = useMemo(() => (obj ? [] : validateEntry(categoryKey, entry, src.entries, src.index)), [obj, categoryKey, entry, src]);
  const canSave = dirty && errors.length === 0;

  const save = async () => {
    // Contrat de donnée (#176) : la source entière doit parser son schéma zod (SCHEMA_DEFS) avant toute
    // écriture disque. La racine à valider est celle que la mémoire PORTE (mutation en place) : la pose
    // est donc TRANSACTIONNELLE (#1530) — au refus, l'état d'avant est REPRIS, sinon un save refusé
    // laissait l'app diverger du disque en silence.
    const dsKey = obj ? null : editableDataset(categoryKey)!;
    const avant: unknown = obj ? structuredClone(datasetObject(obj.ds)) : (datasetArray(dsKey!) as unknown[]).slice();
    src.persist(entry); // preview mémoire (live) — mutation en place (tableau ou objet)
    // Le texte écrit = la SOURCE entière (tableau ou objet-dataset), re-sérialisée byte-fidèle.
    // Les DEUX portes de SÉRIALISATION, jamais la lecture runtime : elles seules rendent la FORME
    // DISQUE (`versDisque` — le `desc` matérialisé d'une entrée adressée n'y repart pas).
    const root = obj ? datasetObjectSerializeRoot(obj.ds) : datasetSerializeRoot(dsKey!);
    const schemaErr = validateDataset(src.file, root);
    if (schemaErr) {
      if (obj) setObjectDataset(obj.ds, avant as never);
      else setDataset(dsKey!, avant as never);
      setSchemaError(schemaErr); setMsg(''); return;
    }
    invalidateCodexLookup(); // l'index de `codexLookup` repart de la donnée persistée
    setSchemaError(null);
    const text = serializeDataset(root);
    try {
      if (fs.FS_API && dir && !needsGrant) { await fs.writeFile(dir, src.file, text); setMsg(`Enregistré ${src.file} — Vite recharge…`); }
      else { fs.downloadFallback(src.file, text); setMsg(`Téléchargé ${src.file} — reposez-le dans src/data/`); }
      setDirty(false);
    } catch (e) { setMsg(`Échec : ${String(e)}`); }
  };

  return (
    <div className="codex-edit">
      <div className="codex-edit-bar">
        {!fs.FS_API && <span className="de-warn">FS Access indisponible — sauvegarde par téléchargement</span>}
        {fs.FS_API && !dir && <button className="btn small" onClick={() => fs.connectDataDir().then((h) => { setDir(h); setNeedsGrant(false); }).catch(() => {})}><Icon id="file/folder" size="sm" /> Connecter src/data…</button>}
        {fs.FS_API && dir && needsGrant && <button className="btn small" onClick={() => dir && fs.grantPermission(dir).then((ok) => ok && setNeedsGrant(false))}>Autoriser l'écriture</button>}
        {fs.FS_API && dir && !needsGrant && <span className="de-ok"><Icon id="file/folder" size="sm" /> connecté</span>}
        <span className="de-spacer" />
        {msg && <span className="de-msg">{msg}</span>}
        <button className="btn small" onClick={onClose}>Fermer</button>
        <button className="btn small btn-primary" disabled={!canSave} onClick={save}>Enregistrer{dirty ? ' •' : ''}</button>
      </div>
      {dirty && errors.length > 0 && (
        <ul className="codex-edit-errors">
          {errors.map((e) => <li key={e}>{e}</li>)}
        </ul>
      )}
      {schemaError && (
        <ul className="codex-edit-errors">
          {schemaError.split('\n').map((line, i) => <li key={i}>{line}</li>)}
        </ul>
      )}
      <div className="codex-edit-form">
        {hasAppearance && <AppearanceField label={String(entry.label ?? label)} porteur={porteurDApercu(categoryKey)} value={entry.appearance as EntityAppearance | undefined} onChange={(v) => edit('appearance', v)} />}
        {isSpell && <SpellEffectsField value={entry.effects as Flow | undefined} onChange={(v) => edit('effects', v)} />}
        {CRITICAL_CATEGORIES.includes(categoryKey) && (
          <NoeudTestField
            racine="critique"
            desc="jet de la rangée (nœud `test` — Difficulté, compétence, conséquences des deux branches)"
            value={entry.test as NoeudTest | undefined}
            onChange={(v) => edit('test', v)}
          />
        )}
        {isPassive && (
          <div className="ed-field">
            <span>modificateurs PASSIFS continus (mêmes ops que les sorts — sans déclencheur)</span>
            <GameOpEditor ops={(entry.passive as GameOp[] | undefined) ?? []} onChange={(ops) => edit('passive', ops)} />
          </div>
        )}
        {isOptionalRule && (
          <>
            <RuleValueField
              id="rule-default"
              label="valeur par défaut"
              rule={entry as unknown as RuleShape}
              value={entry.default as RuleValue | undefined}
              onChange={(v) => edit('default', v)}
            />
            <RuleActionField
              rule={entry as unknown as RuleShape}
              value={entry.action as OptionalRule['action']}
              onChange={(v) => edit('action', v)}
            />
          </>
        )}
        {isSymptom && SYMPTOM_SEVERITIES.map((cle) => {
          const parPalier = (entry.passiveBySeverity as Record<string, GameOp[] | undefined> | undefined) ?? {};
          return (
            <div className="ed-field" key={cle}>
              <span>modificateurs PASSIFS du palier {libelleDeValeur(symptomSeveritySchema, cle)} — ils S’AJOUTENT aux « Effets passifs » dès que l’instance atteint ce palier ; une pénalité s’y écrit en valeur ABSOLUE, la pire l’emporte (LDB 20 l.157, l.170)</span>
              <GameOpEditor
                ops={parPalier[cle] ?? []}
                onChange={(ops) => {
                  const suivant = { ...parPalier, [cle]: ops.length ? ops : undefined };
                  const reste = Object.fromEntries(Object.entries(suivant).filter(([, v]) => v?.length));
                  edit('passiveBySeverity', Object.keys(reste).length ? reste : undefined);
                }}
              />
            </div>
          );
        })}
        {isSymptom && (
          <div className="ed-field">
            <span>passifs conditionnés à la VISIBILITÉ de la lésion (Vers du Reik −10 Soc si visible, MSRC 16 l.140) — actifs seulement si la localisation tirée est cochée ci-dessous</span>
            <GameOpEditor ops={(entry.visiblePassive as GameOp[] | undefined) ?? []} onChange={(ops) => edit('visiblePassive', ops.length ? ops : undefined)} />
            <div className="de-reflrow">
              {(['tete', 'brasG', 'brasD', 'corps', 'jambeG', 'jambeD'] as const).map((loc) => {
                const cur = (entry.visibleLocations as string[] | undefined) ?? [];
                return (
                  <label key={loc}>
                    <input type="checkbox" checked={cur.includes(loc)} onChange={(e) => {
                      const next = e.target.checked ? [...cur, loc] : cur.filter((l) => l !== loc);
                      edit('visibleLocations', next.length ? next : undefined);
                    }} /> {HIT_LOCATION_LABELS[loc]}
                  </label>
                );
              })}
            </div>
          </div>
        )}
        {isSymptom && <SymptomTickField value={entry.onTick as import('./StructFields').SymptomTick | undefined} onChange={(v) => edit('onTick', v)} />}
        {isTriggered && <TriggeredEffectsField value={entry.effects as TriggeredEffect[] | undefined} onChange={(v) => edit('effects', v)} />}
        {hasConsumable && <TriggeredEffectsField label="effets à la touche de l’arme (onHit → Flow d’ops, ADE II)" value={entry.onHitEffects as TriggeredEffect[] | undefined} onChange={(v) => edit('onHitEffects', v.length ? v : undefined)} />}
        {isManeuver && <ManeuverDefField entry={entry} edit={edit} />}
        {isMutationTable && <MutationTableField value={entry.ranges as MutationRange[] | undefined} onChange={(v) => edit('ranges', v)} />}
        {isWeather && <WeatherRangesField value={entry.ranges as { min: number; max: number; weather: string }[] | undefined} onChange={(v) => edit('ranges', v)} />}
        {hasDerivedWeapon && <WeaponField value={entry.derivedWeapon as Weapon | undefined} onChange={(v) => edit('derivedWeapon', v)} />}
        {hasConsumable && (
          <div className="ed-field">
            <span>effet d’un CONSOMMABLE (potion/drogue/bandage) — Flow appliqué au buveur (ops, branches, Tests « au boire »)</span>
            <FlowEditor flow={(entry.consumable as Flow | undefined) ?? EMPTY_FLOW} ctx={ctxDeCatalogue('consommable')}
              onChange={(f) => edit('consumable', f.kind === 'seq' && f.steps.length === 0 ? undefined : f)} />
          </div>
        )}
        {hasConsumable && <ConsumableDurationField value={entry.consumableDuration as ConsumableDuration | undefined} onChange={(v) => edit('consumableDuration', v)} />}
        {isMutation && <PsychTraitsField value={entry.psychTraits as PsychTrait[] | undefined} onChange={(v) => edit('psychTraits', v)} />}
        {isDisease && <SymptomsField value={entry.symptoms as DiseaseSymptom[] | undefined} onChange={(v) => edit('symptoms', v)} />}
        {isDisease && <DiseaseDailyTestField value={entry.dailyTest as DiseaseDailyTest | undefined} onChange={(v) => edit('dailyTest', v)} />}
        {hasCombat && <TalentTestField value={entry.test as TalentTest | undefined} onChange={(v) => edit('test', v)} />}
        {hasCombat && <CombatField value={entry.combat as Partial<CombatFeature> | undefined} allFeatures={src.entries.map((e) => e.combat as Partial<CombatFeature> | undefined)} onChange={(v) => edit('combat', v)} />}
        {variantFields && <VariantsField value={entry.variants as Variant[] | undefined} resolved={variantFields} entryFields={allFields} allFeatures={src.entries.map((e) => e.combat as Partial<CombatFeature> | undefined)} onChange={(v) => edit('variants', v.length ? v : undefined)} />}
        {hasAlsoIn && <AlsoInField value={entry.alsoIn as SecondaryRef[] | undefined} onChange={(v) => edit('alsoIn', v.length ? v : undefined)} />}
        {hasSpecs && <SpecsField value={entry.specs as SpecEntry[] | undefined} onChange={(v) => edit('specs', v)} />}
        {hasAdvancement && <AdvancementRefField ds="skills" label="Compétences" value={entry.skills as AdvancementRef[] | undefined} onChange={(v) => edit('skills', v)} />}
        {hasAdvancement && <AdvancementRefField ds="talents" label="Talents" value={entry.talents as AdvancementRef[] | undefined} onChange={(v) => edit('talents', v)} />}
        {hasTrappings && <TrappingRefField value={entry.trappings as TrappingRef[] | undefined} onChange={(v) => edit('trappings', v)} />}
        {hasCharKeys && <CharKeysField value={entry.characteristics as CharKey[] | undefined} onChange={(v) => edit('characteristics', v)} />}
        {hasStarSub && (
          <PlageField
            label="Sous-tirage"
            // ADE II 03 l.63 : « L'Étoile du Sorcier | Lancez un 1d10 » — le dé et son domaine sont un
            // fait de la TABLE, cité ici ; la primitive n'en connaît aucun.
            domaine={{ nom: '1d10', min: 1, max: 10 }}
            optionnelle
            activation="sous-tirage"
            value={entry.sub as PlageValue | undefined}
            onChange={(v) => edit('sub', v)}
          />
        )}
        {hasDispoSaisonniere && (
          <DispoSaisonniereField
            label="Disponibilité par saison"
            value={entry.avail as Parameters<typeof DispoSaisonniereField>[0]['value']}
            onChange={(v) => edit('avail', v)}
          />
        )}
        {hasDomainEffects && (
          <DomainEffectsField
            castBonus={entry.castBonus as DomainData['castBonus']}
            missile={entry.missile as DomainData['missile']}
            casterOps={entry.casterOps as DomainData['casterOps']}
            onCastBonus={(v) => edit('castBonus', v)}
            onMissile={(v) => edit('missile', v)}
            onCasterOps={(v) => edit('casterOps', v)}
          />
        )}
        {hasDomainEffects && <GenericArrayField noeud={noeudDe('windModifiers')} label="windModifiers (rubrique de Vent — DR par circonstance)" value={entry.windModifiers as Record<string, unknown>[] | undefined} onChange={(v) => edit('windModifiers', v)} />}
        {/* DÉPENSES d'une ressource (`characteristics.options` — Résilience, #1117 geste 5) : tableau
            top-level d'objets homogènes → MÊME éditeur générique que la rubrique de Vent. */}
        {categoryKey === 'characteristics' && <GenericArrayField noeud={noeudDe('options')} label="options (dépenses de la ressource — verbatim du Source)" value={entry.options as Record<string, unknown>[] | undefined} onChange={(v) => edit('options', v)} />}
        {/* OPTIONS de Test d'un jeu de taverne (`tavernGames.options` — Middenball NADJ 16 l.119 :
            Bagarre (+20) OU Athlétisme (+0)) : même forme, même éditeur générique. */}
        {categoryKey === 'tavernGames' && <GenericArrayField noeud={noeudDe('options')} label="options de Test (la règle en offre plusieurs — le joueur choisit)" value={entry.options as Record<string, unknown>[] | undefined} onChange={(v) => edit('options', v)} />}
        {/* Barème de points par plage de DR (`tavernGames.table` — Torchon trempé NADJ 16 l.111). */}
        {categoryKey === 'tavernGames' && <GenericArrayField noeud={noeudDe('table')} label="barème de points par plage de DR" value={entry.table as Record<string, unknown>[] | undefined} onChange={(v) => edit('table', v)} />}
        {/* Ornements d'identité d'un bâtiment (#1715) : `{id, anchor}[]` — le nœud porte les libellés des ancrages. */}
        {categoryKey === 'buildings' && <GenericArrayField noeud={noeudDe('features')} label="ornements d’identité (décor posé et son ancrage)" value={entry.features as Record<string, unknown>[] | undefined} onChange={(v) => edit('features', v.length ? v : undefined)} />}
        {isCreature && (
          <>
            <TraitListField label="Traits" hint="(LDB 85 — armement « Arme (Épée) +7 », Psychologie « Peur 3 »…)" value={entry.traits as TraitInstance[] | undefined} onChange={(v) => edit('traits', v)} />
            <OptionalsListField label="Traits optionnels" hint="(LDB 76 — proposés au spawn ; notes composées « swap »/« tous les traits » en lecture seule)" value={entry.optionals as OptionalEntry[] | undefined} onChange={(v) => edit('optionals', v)} />
            <HarvestField value={entry.harvest as { rarity: import('../../data').HarvestRarity; danger: import('../../data').HarvestDanger; uses: string } | undefined} onChange={(v) => edit('harvest', v)} />
            <LignesFormatLivreField
              label="Compétences"
              hint="(une par ligne, format livre « Compétence (Spéc) Valeur » : « Langue (Magick) 63 », « Savoir (Au choix) 65 », « Métier (Armurier ou Forgeron) 50 », « Esquive 48 » — la valeur est le Test FINAL)"
              value={refsEnLignes(entry.skills as SkillRefLivre[] | undefined, skillRefLabel)}
              onCommit={(t) => edit('skills', lignesEnRefs(t, parseSkillRef))}
            />
            <LignesFormatLivreField
              label="Talents"
              hint="(un par ligne, format livre « Talent (Spéc) Niveau » : « Magie des Arcanes (Bête) », « Maîtrise du combat 3 », « Lire/Écrire »)"
              value={refsEnLignes(entry.talents as TalentRef[] | undefined, talentRefLabel)}
              onCommit={(t) => edit('talents', lignesEnRefs(t, parseTalentRef))}
            />
          </>
        )}
        {isDetails && <DetailsTextsField value={entry.texts as DetailsTexts | undefined} onChange={(v) => edit('texts', v)} />}
        {isTrait && <TraitSchemaField entry={entry} edit={edit} />}
        {isStructure && <TraitListField label="Atouts" hint="(Résistant/Impénétrable — ADE II 8)" value={entry.traits as TraitInstance[] | undefined} onChange={(v) => edit('traits', v)} />}
        {isRace && <TraitListField label="Trait racial" hint="(#572 — Ogre : encombrance/consommation ×2 ; Taille = talent Massif/Petit)" value={entry.traits as TraitInstance[] | undefined} onChange={(v) => edit('traits', v)} />}
        {hasCrewSkills && <SkillSpecListField value={entry.skills as SkillRef[] | undefined} onChange={(v) => edit('skills', v)} />}
        {hasAxes && <SkillSpecListField hint="compétences contribuant à l'axe (facultatif)" value={entry.skills as SkillRef[] | undefined} onChange={(v) => edit('skills', v)} />}
        {hasAxes && <TalentSpecListField value={entry.talents as { talentId: string; spec?: string }[] | undefined} onChange={(v) => edit('talents', v)} />}
        {hasConsumable && <GenericArrayField noeud={noeudDe('prosthesisTraining')} label="prosthesisTraining (paliers d’entraînement — PX, libellé joueur, tranche rachetée, aspect levé)" value={entry.prosthesisTraining as Record<string, unknown>[] | undefined} onChange={(v) => edit('prosthesisTraining', v.length ? v : undefined)} />}
        {hasProsthesis && <ProsthesisField value={entry.prosthesis as { trappingId: string; cancels: 'all' | 'movement' }[] | undefined} onChange={(v) => edit('prosthesis', v.length ? v : undefined)} />}
        {hasTraumaList && <TraumaListField value={entry.traumas as string[] | undefined} onChange={(v) => edit('traumas', v.length ? v : undefined)} />}
        {hasRestartTest && <RestartTestField value={entry.restart as RestartTest[] | undefined} onChange={(v) => edit('restart', v.length ? v : undefined)} />}
        {isShipCrit && <ShipCrewHitField value={entry.crewHit as ShipCrewHitValue | undefined} onChange={(v) => edit('crewHit', v)} />}
        {isWaterExposure && <WaterTestField value={entry.test as WaterTest | undefined} onChange={(v) => edit('test', v)} />}
        {isWaterExposure && <WaterModifiersField value={entry.modifiers as WaterExposureModifier[] | undefined} onChange={(v) => edit('modifiers', v)} />}
        {isWaterExposure && <WaterDiseasesField value={entry.diseases as WaterExposureData['diseases'] | undefined} onChange={(v) => edit('diseases', v)} />}
        {isSeaNavigation && <GenericArrayField noeud={noeudDe('forcerLeRythme')} label="forcerLeRythme (bonus M → difficulté Voile/Rames)" value={entry.forcerLeRythme as Record<string, unknown>[] | undefined} onChange={(v) => edit('forcerLeRythme', v)} />}
        {isSeaPerils && <GenericArrayField noeud={noeudDe('hazards')} label="hazards (dangers flottants)" value={entry.hazards as Record<string, unknown>[] | undefined} onChange={(v) => edit('hazards', v)} />}
        {isSeaPerils && <GenericArrayField noeud={noeudDe('detroits')} label="detroits" value={entry.detroits as Record<string, unknown>[] | undefined} onChange={(v) => edit('detroits', v)} />}
        {isSeaPerils && <GenericArrayField noeud={noeudDe('tourbillons')} label="tourbillons" value={entry.tourbillons as Record<string, unknown>[] | undefined} onChange={(v) => edit('tourbillons', v)} />}
        {isSeaPerils && <GenericArrayField noeud={noeudDe('gestionDesPerils')} label="gestionDesPerils" value={entry.gestionDesPerils as Record<string, unknown>[] | undefined} onChange={(v) => edit('gestionDesPerils', v)} />}
        {isSeaWeather && <GenericArrayField noeud={noeudDe('table')} label="table (tirage quotidien)" value={entry.table as Record<string, unknown>[] | undefined} onChange={(v) => edit('table', v)} />}
        {isSeaWeather && <GenericArrayField noeud={noeudDe('precipitations')} label="precipitations" value={entry.precipitations as Record<string, unknown>[] | undefined} onChange={(v) => edit('precipitations', v)} />}
        {isSeaWeather && <GenericArrayField noeud={noeudDe('temperatures')} label="temperatures" value={entry.temperatures as Record<string, unknown>[] | undefined} onChange={(v) => edit('temperatures', v)} />}
        {isSeaWeather && <GenericArrayField noeud={noeudDe('visibilites')} label="visibilites" value={entry.visibilites as Record<string, unknown>[] | undefined} onChange={(v) => edit('visibilites', v)} />}
        {isSeaWeather && <GenericArrayField noeud={noeudDe('vents')} label="vents" value={entry.vents as Record<string, unknown>[] | undefined} onChange={(v) => edit('vents', v)} />}
        {isSeaWeather && <GenericArrayField noeud={noeudDe('roseDesVents')} label="roseDesVents" value={entry.roseDesVents as Record<string, unknown>[] | undefined} onChange={(v) => edit('roseDesVents', v)} />}
        {isDisponibilite && <GenericArrayField noeud={noeudDe('dispoPct')} label="dispoPct (% de Disponibilité par taille de colonie)" value={entry.dispoPct as Record<string, unknown>[] | undefined} onChange={(v) => edit('dispoPct', v)} />}
        {isDisponibilite && <GenericArrayField noeud={noeudDe('barterRatios')} label="barterRatios (Ratios de Troc)" value={entry.barterRatios as Record<string, unknown>[] | undefined} onChange={(v) => edit('barterRatios', v)} />}
        {isArcanePhenomena && <GenericArrayField noeud={noeudDe('saturationLevels')} label="saturationLevels (Paliers de Saturation)" value={entry.saturationLevels as Record<string, unknown>[] | undefined} onChange={(v) => edit('saturationLevels', v)} />}
        {isArcanePhenomena && <GenericArrayField noeud={noeudDe('windSaturationEffects')} label="windSaturationEffects (Effets de Saturation par Vent)" value={entry.windSaturationEffects as Record<string, unknown>[] | undefined} onChange={(v) => edit('windSaturationEffects', v)} />}
        {isArcanePhenomena && <GenericArrayField noeud={noeudDe('phenomena')} label="phenomena (Phénomènes arcaniques)" value={entry.phenomena as Record<string, unknown>[] | undefined} onChange={(v) => edit('phenomena', v)} />}
        {isArcanePhenomena && <GenericArrayField noeud={noeudDe('tables')} label="tables (Tables du chapitre)" value={entry.tables as Record<string, unknown>[] | undefined} onChange={(v) => edit('tables', v)} />}
        {isRiverNavigation && <GenericArrayField noeud={noeudDe('windForces')} label="windForces (Force du vent, 1d10)" value={entry.windForces as Record<string, unknown>[] | undefined} onChange={(v) => edit('windForces', v)} />}
        {isRiverNavigation && <GenericArrayField noeud={noeudDe('windDirections')} label="windDirections (Direction du vent, 1d10)" value={entry.windDirections as Record<string, unknown>[] | undefined} onChange={(v) => edit('windDirections', v)} />}
        {hasHullLength && (
          <PlageField
            label="Longueur"
            // MDG 12 l.122-129, colonne « Taille » : des mètres, depuis 1, et une dernière bande sans
            // plafond (« 81+ », l.129).
            domaine={{ nom: 'mètres', min: 1 }}
            ouvrable
            value={entry.lengthM as PlageValue | undefined}
            onChange={(v) => v && edit('lengthM', v)}
          />
        )}
        {isActivity && <ActivityTestField entry={entry} edit={edit} />}
        {isActivity && <ActivityResolverField entry={entry} edit={edit} />}
        {isActivity && <OutcomeBandsField value={entry.outcomes as OutcomeBand[] | undefined} onChange={(v) => edit('outcomes', v.length ? v : undefined)} />}
        {isActivity && <GenericArrayField noeud={noeudDe('testMods')} label="testMods (modificateurs de situation du Test)" value={entry.testMods as Record<string, unknown>[] | undefined} onChange={(v) => edit('testMods', v.length ? v : undefined)} />}
        {isActivity && <GenericArrayField noeud={noeudDe('worldRolls')} label="worldRolls (tirages d’environnement après le Test)" value={entry.worldRolls as Record<string, unknown>[] | undefined} onChange={(v) => edit('worldRolls', v.length ? v : undefined)} />}
        {opsFields.map((fieldKey) => (
          <div className="ed-field" key={fieldKey}>
            <span>{fieldKey} — effet (GameOp[], même éditeur que les modificateurs passifs)</span>
            <GameOpEditor ops={(entry[fieldKey] as GameOp[] | undefined) ?? []} onChange={(ops) => edit(fieldKey, ops)} />
          </div>
        ))}
        {fields.map((f) => {
          const cfg = refFieldCfg(categoryKey, f.key);
          return cfg
            ? <RefField key={f.key} cfg={cfg} categoryKey={categoryKey} fieldKey={f.key} label={f.label} nullable={f.nullable} value={entry[f.key]} onChange={(v) => edit(f.key, v)} />
            : <Field key={f.key} field={f} value={entry[f.key]} onChange={(v) => edit(f.key, v)} />;
        })}
      </div>
    </div>
  );
}

/** Éditeur d'apparence par défaut d'une créature (bloc `appearance` UNIFIÉ) — réutilise la brique
 *  partagée `MonsterPartsFields` (espèce + parts/couleurs/coiffure/tenue/harnachement/yeux). Édite le VRAI record
 *  `creatures.json` ; le rig le lit comme couche de défaut → l'apparence en jeu reflète l'édition. */
function AppearanceField({ label, porteur, value, onChange }: { label: string; porteur?: string; value: EntityAppearance | undefined; onChange: (v: EntityAppearance) => void }) {
  const a = value ?? {};
  const patch = (p: Partial<EntityAppearance>) => onChange({ ...a, ...p });
  // Le harnachement est un canal du pipeline QUADRUPÈDE (quad ∪ ailé) : hors de ces gabarits, la
  // clé serait de la donnée absurde, ignorée au rendu — le sélecteur n'est donc pas offert.
  const quadrupede = !!a.species && (a.species in QUAD_SPECIES || a.species in WINGED_SPECIES);
  return (
    <div className="ed-field ed-appearance">
      <span>apparence par défaut (rig) — éditée sur le record, reflétée en jeu</span>
      <CreaturePreview label={label} appearance={a} porteur={porteur} />{/* aperçu LIVE : se met à jour à chaque modification */}
      <label className="ed-subfield">
        Espèce
        <select value={a.species ?? ''} onChange={(e) => patch({ species: e.target.value || undefined })}>
          <option value="">(par défaut : Humain)</option>
          {creatureSpeciesOptions().map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
        </select>
      </label>
      <MonsterPartsFields
        monster={a.monster} colors={a.colors} sex={a.sex} build={a.build} hairstyle={a.hairstyle} tenue={a.tenue} harnais={a.harnais} eyes={a.eyes} features={a.features}
        onMonster={(p) => patch({ monster: { ...(a.monster ?? {}), ...p } })}
        onColors={(p) => patch({ colors: { ...(a.colors ?? {}), ...p } })}
        onSex={(s) => patch({ sex: s })}
        onBuild={(b) => patch({ build: b })}
        onHairstyle={(id) => patch({ hairstyle: id })}
        onTenue={(c) => patch({ tenue: c })}
        onHarnais={quadrupede ? (id) => patch({ harnais: id }) : undefined}
        onEyes={(p) => patch({ eyes: { ...(a.eyes ?? {}), ...p } })}
        onFeatures={(f) => patch({ features: f.length ? f : undefined })}
      />
      <label className="dr">
        <input type="checkbox" checked={!!a.armurePortee} onChange={(e) => patch({ armurePortee: e.target.checked || undefined })} />
        {' '}Armure du statblock VISIBLE (portée) — sinon les PA (trait Armure) restent mécaniques purs, sans art
      </label>
    </div>
  );
}

/** Éditeur de la DURÉE d'horloge d'un consommable (`TrappingData.consumableDuration` — LDB 71/72
 *  « Durée : … ») : UNE unité (minutes/heures/jours) + une Formule (littéral, dés, « dés × facteur »
 *  pour « 1d10 × 10 minutes »). Résolue AU BOIRE (`consumableUntilTime`). */
function ConsumableDurationField({ value, onChange }: { value: ConsumableDuration | undefined; onChange: (v: ConsumableDuration | undefined) => void }) {
  const unit: keyof ConsumableDuration = value?.days != null ? 'days' : value?.hours != null ? 'hours' : 'minutes';
  const formula = value?.[unit];
  return (
    <div className="ed-field">
      <span>durée d’horloge du consommable (« Durée : … », LDB 71/72) — vide = effets instantanés/permanents</span>
      <div className="tf-row">
        <label className="dr"><input type="checkbox" checked={value != null} onChange={(e) => onChange(e.target.checked ? { minutes: 10 } : undefined)} /> durée</label>
        {value != null && (
          <>
            <select value={unit} onChange={(e) => onChange({ [e.target.value as keyof ConsumableDuration]: formula ?? 1 })}>
              <option value="minutes">minutes</option>
              <option value="hours">heures</option>
              <option value="days">jours</option>
            </select>
            <FormulaField label="Durée" value={formula} min={1} onChange={(f) => onChange({ [unit]: f })} />
          </>
        )}
      </div>
    </div>
  );
}

/** Éditeur des EFFETS d'un sort (`SpellData.effects`) — le `Flow` ÉDITABLE (do/si/test, feuilles
 *  EffectOp). Réutilise le `FlowEditor` de l'éditeur de scène (source UNIQUE de la logique authorée) :
 *  pose des effets mécaniques `on:'target'`/`on:'caster'`, des branches conditionnelles, des Tests. Écrit
 *  le record `spells.json` au save → l'incantation en jeu lit ces effets (runCombatFlow). Racine de
 *  CATALOGUE `sort` (`ctxDeCatalogue`) : ni encounters/dialogues de scène, et la table de cibles d'un sort. */
function SpellEffectsField({ value, onChange }: { value: Flow | undefined; onChange: (v: Flow) => void }) {
  return (
    <div className="ed-field">
      <span>effets du sort (Flow éditable — effets mécaniques, conditions, tests)</span>
      <FlowEditor flow={value ?? EMPTY_FLOW} ctx={ctxDeCatalogue('sort')} onChange={onChange} />
    </div>
  );
}


/** Éditeur des EFFETS DÉCLENCHÉS (`TriggeredEffect[]`) — porté indifféremment par un Trait OU un Atout
 *  d'arme. MÊME logique authorée que les sorts : une LISTE d'effets, chacun = un DÉCLENCHEUR (sur
 *  événement) + une CIBLE + un `Flow` d'ops éditable (réutilise `FlowEditor`/`GameOpEditor`). Écrit le
 *  record `traits.json`/`qualities.json` au save → `state/triggeredEffects` les applique en jeu. */
function TriggeredEffectsField({ value, onChange, label = 'effets déclenchés (déclencheur → Flow d’ops, comme un sort)' }: { value: TriggeredEffect[] | undefined; onChange: (v: TriggeredEffect[]) => void; label?: string }) {
  const list = value ?? [];
  const set = (i: number, patch: Partial<TriggeredEffect>) => onChange(list.map((e, j) => (j === i ? { ...e, ...patch } : e)));
  const add = () => onChange([...list, { trigger: 'onHit', on: 'victim', flow: EMPTY_FLOW }]);
  return (
    <div className="ed-field">
      <span>{label}</span>
      {list.map((eff, i) => (
        <div className="ed-subfield trait-effect" key={i}>
          <div className="tf-row">
            <label className="dr">Déclencheur
              <select value={eff.trigger} onChange={(e) => set(i, { trigger: e.target.value as EffectTrigger })}>
                {optionsDuNoeud(effectTriggerSchema).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </label>
            <label className="dr">Cible
              <select value={typeof eff.on === 'object' ? ('pick' in eff.on ? 'pick' : 'near') : eff.on}
                onChange={(e) => set(i, { on:
                  e.target.value === 'near' ? { near: 'victim', radiusMeters: 2 }
                  : e.target.value === 'pick' ? { pick: 'engaged', sizeAtMost: 'self', max: 1 }
                  : e.target.value as TriggeredEffect['on'] })}>
                {optionsDuNoeud(effectOnSchema).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                <option value="near">les cibles à portée (zone)</option>
                <option value="pick">un adversaire engagé (sélection)</option>
              </select>
            </label>
            {typeof eff.on === 'object' && 'near' in eff.on && (
              <label className="dr">à ≤ <NumberField variant="nu" label="Rayon de la zone (m)" min={1} width="3.4em" value={eff.on.radiusMeters} onChange={(radiusMeters) => set(i, { on: { near: (eff.on as { near: 'self' | 'victim' }).near, radiusMeters } })} /> m de
              <select value={eff.on.near} onChange={(e) => set(i, { on: { near: e.target.value as 'self' | 'victim', radiusMeters: (eff.on as { radiusMeters: number }).radiusMeters } })}>
                <option value="victim">la victime</option>
                <option value="self">soi</option>
              </select></label>
            )}
            {typeof eff.on === 'object' && 'pick' in eff.on && (
              <label className="dr">max <NumberField variant="nu" label="Nombre maximum de cibles" min={1} width="3.4em" value={eff.on.max} onChange={(max) => set(i, { on: { pick: 'engaged', ...((eff.on as { sizeAtMost?: 'self' }).sizeAtMost ? { sizeAtMost: 'self' as const } : {}), max } })} />
              <input type="checkbox" checked={(eff.on as { sizeAtMost?: 'self' }).sizeAtMost === 'self'} onChange={(e) => set(i, { on: { pick: 'engaged', ...(e.target.checked ? { sizeAtMost: 'self' as const } : {}), max: (eff.on as { max: number }).max } })} /> Taille ≤ la sienne</label>
            )}
            <label className="dr" title="RAW « Vous pouvez… » (Contrôle de la Frénésie) : le héros CHOISIT de déclencher (étape de choix en fin de Round) ; l’IA ne l’exerce jamais">
              <input type="checkbox" checked={!!eff.optional} onChange={(e) => set(i, { optional: e.target.checked || undefined })} /> optionnel
            </label>
            <button className="btn small danger" title="Supprimer l’effet" onClick={() => onChange(list.filter((_, j) => j !== i))}>✕</button>
          </div>
          <FlowEditor flow={eff.flow ?? EMPTY_FLOW} ctx={ctxDeCatalogue('declenche')} onChange={(flow) => set(i, { flow })} />
        </div>
      ))}
      <button className="btn small" onClick={add}>+ Effet de trait</button>
    </div>
  );
}

/** Options d'un champ ÉNUMÉRÉ d'un document, lues SUR SON NŒUD (`enumNomme`, #1694) :
 *  l'éditeur dédié d'une manœuvre tire ses `<option>` de la MÊME déclaration que le formulaire
 *  générique et que le Codex — plus aucune table de libellés par valeur ici. */
const optionsDe = (fichier: string, champ: string): [string, string][] => Object.entries(valeursDe(noeudDuChamp(fichier, champ)) ?? {});

/** Options d'un nœud énuméré IMPORTÉ (enum NICHÉ, hors d'atteinte de `noeudDuChamp` qui ne voit que le
 *  premier niveau) — même lecture, même déclaration : `valeursDe` du nœud lui-même. */
const optionsDuNoeud = (noeud: unknown): [string, string][] => Object.entries(valeursDe(noeud) ?? {});

/** Éditeur d'une MANŒUVRE (entité de 1ʳᵉ classe, `maneuvers.json`) : son PROFIL (type/activation/coût/
 *  jet/défense/ciblage/portée/magie) + ses effets AUTHORÉS (Dégâts + États en GameOp, via
 *  `TriggeredEffectsField`). Édite les champs TOP-LEVEL de `ManeuverDef` (id/label/desc/source restent
 *  au repli générique). Source UNIQUE de résolution : ces effets sont joués tels quels par `resolveManeuver`. */
/** Éditeur d'une `ManeuverMeasure` (Portée/Souffle) : Bonus de carac + constante (mètres). Structuré —
 *  plus de saisie prose « Bonus de Force mètres » re-parsée au runtime. */
function MeasureField({ label, value, onChange }: { label: string; value: ManeuverMeasure | undefined; onChange: (v: ManeuverMeasure | undefined) => void }) {
  const v = value ?? {};
  const upd = (p: Partial<ManeuverMeasure>) => {
    const bonusOf = 'bonusOf' in p ? p.bonusOf : v.bonusOf;
    const plus = 'plus' in p ? p.plus : v.plus;
    const next: ManeuverMeasure = {};
    if (bonusOf) next.bonusOf = bonusOf;
    if (plus != null) next.plus = plus;
    onChange(next.bonusOf || next.plus != null ? next : undefined);
  };
  return (
    <label className="dr">{label}
      <select value={v.bonusOf ?? ''} onChange={(e) => upd({ bonusOf: (e.target.value || undefined) as CharKey | undefined })}>
        <option value="">— (aucun)</option>
        {CHAR_KEYS.map((k) => <option key={k} value={k}>Bonus de {CHAR_LABELS[k]}</option>)}
      </select>
      <NumberField variant="nu" label={`${label} — bonus fixe (m)`} placeholder="+ m" width={64} vide value={v.plus} onChange={(n) => upd({ plus: n ?? undefined })} /> m
    </label>
  );
}

function ManeuverDefField({ entry, edit }: { entry: Entry; edit: (key: string, v: unknown) => void }) {
  const m = entry as Partial<ManeuverDef>;
  return (
    <div className="ed-field ed-maneuver">
      <div className="tf-row">
        <label className="dr">Type (geste)
          <select value={m.kind ?? 'morsure'} onChange={(e) => edit('kind', e.target.value as AttackKind)}>
            {optionsDe('maneuvers.json', 'kind').map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        </label>
        <label className="dr">Activation
          <select value={m.activation ?? 'free'} onChange={(e) => edit('activation', e.target.value as ManeuverDef['activation'])}>
            {optionsDe('maneuvers.json', 'activation').map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </label>
        <label className="dr">Coût d’Avantage<NumberField variant="nu" label="Coût d’Avantage" min={0} value={m.advantageCost ?? 0} onChange={(n) => edit('advantageCost', n)} /></label>
        <label className="dr">Avantage
          <select value={m.advantageMode ?? 'fixed'} onChange={(e) => edit('advantageMode', e.target.value === 'fixed' ? undefined : (e.target.value as ManeuverDef['advantageMode']))}>
            {optionsDe('maneuvers.json', 'advantageMode').map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </label>
      </div>
      <div className="tf-row">
        <label className="dr">Jet d’attaquant
          <select value={m.stat ?? ''} onChange={(e) => edit('stat', e.target.value || undefined)}>
            <option value="">— (aucun)</option>
            {optionsDe('maneuvers.json', 'stat').map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </label>
        <label className="dr">Défense
          <select value={m.defense ?? ''} onChange={(e) => edit('defense', e.target.value || undefined)}>
            <option value="">— (aucune)</option>
            {optionsDe('maneuvers.json', 'defense').map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </label>
        <label className="dr">Ciblage
          <select value={m.targeting ?? 'melee'} onChange={(e) => edit('targeting', e.target.value as ManeuverDef['targeting'])}>
            {optionsDe('maneuvers.json', 'targeting').map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </label>
        <label className="dr"><input type="checkbox" checked={!!m.magic} onChange={(e) => edit('magic', e.target.checked || undefined)} /> Magique</label>
      </div>
      <div className="tf-row">
        <MeasureField label="Portée" value={m.range} onChange={(v) => edit('range', v)} />
        <MeasureField label="Souffle/zone" value={m.blast} onChange={(v) => edit('blast', v)} />
      </div>
      <span>effets AUTHORÉS de la manœuvre (Dégâts + États, appliqués quand ELLE touche)</span>
      <TriggeredEffectsField value={m.effects} onChange={(effects) => edit('effects', effects.length ? effects : undefined)} />
    </div>
  );
}

/** Éditeur du SCHÉMA d'ARGUMENT d'un Trait (`traits.json`) : décrit comment son INSTANCE porte sa
 *  valeur/argument — `indice` (sens de la valeur numérique : Indice/Difficulté/Degré…), `range` (portée
 *  en m), `specsSource` (registre d'où l'`arg` tire ses ids — catalogue `SPEC_SOURCES`), `specsOpen`
 *  (arg = texte libre), `specsMulti` (arg = liste d'ids séparés par virgules). Réutilise les motifs
 *  existants (select comme `ManeuverDefField`, checkbox `.dr`, input `.dr`). Gate `traits` uniquement. */
function TraitSchemaField({ entry, edit }: { entry: Entry; edit: (key: string, v: unknown) => void }) {
  const indice = entry.indice as { label: string } | undefined;
  return (
    <div className="ed-field">
      <span>schéma de l’argument — comment l’instance porte sa valeur/argument</span>
      <div className="tf-row">
        <label className="dr">valeur numérique — libellé
          <input placeholder="ex. Indice / Difficulté / Degré" value={indice?.label ?? ''}
            onChange={(e) => edit('indice', e.target.value ? { label: e.target.value } : undefined)} />
        </label>
        <label className="dr"><input type="checkbox" checked={!!entry.range} onChange={(e) => edit('range', e.target.checked || undefined)} /> porte une portée (m)</label>
      </div>
      <div className="tf-row">
        <label className="dr">source de l’argument (registre)
          <select value={(entry.specsSource as string) ?? ''} onChange={(e) => edit('specsSource', e.target.value || undefined)}>
            <option value="">— (aucune / argument libre) —</option>
            {optionsDuNoeud(specsSourceSchema).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </label>
        <label className="dr"><input type="checkbox" checked={!!entry.specsOpen} onChange={(e) => edit('specsOpen', e.target.checked || undefined)} /> argument en texte libre (ouvert)</label>
        <label className="dr"><input type="checkbox" checked={!!entry.specsMulti} onChange={(e) => edit('specsMulti', e.target.checked || undefined)} /> liste d’ids (séparés par virgules)</label>
      </div>
    </div>
  );
}

/** Compétences d'un Rôle d'équipage (`crewRoles.skills`, MDG 14, #157) OU d'un axe de forces
 *  (`axes.skills`, #409) : `{id,spec?}[]` — plusieurs Compétences candidates possibles (`hint`
 *  précise la sémantique par appelant : « la meilleure retenue » pour un rôle, dérivation pour un axe). */
function SkillSpecListField({ value, onChange, hint = 'compétences du rôle (au moins une ; « au choix » si plusieurs — la meilleure est retenue)' }: { value: SkillRef[] | undefined; onChange: (v: SkillRef[]) => void; hint?: string }) {
  const list = value ?? [];
  const skillOpts = datasetArray('skills') as { id: string; label: string }[];
  const set = (next: typeof list) => onChange(next);
  return (
    <div className="ed-field">
      <span>{hint}</span>
      {list.map((s, i) => (
        <div className="tf-row" key={i}>
          <select value={s.id} onChange={(e) => set(list.map((x, j) => (j === i ? { ...x, id: e.target.value } : x)))}>
            {!s.id && <option value="">— (choisir une compétence) —</option>}
            {skillOpts.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
          </select>
          <input placeholder="spécialisation (facultatif)" value={s.spec ?? ''} onChange={(e) => set(list.map((x, j) => (j === i ? { ...x, spec: e.target.value || undefined } : x)))} />
          <button className="btn small danger" title="Retirer" onClick={() => set(list.filter((_, j) => j !== i))}>✕</button>
        </div>
      ))}
      <button className="btn small" onClick={() => set([...list, { id: '' }])}>+ Compétence</button>
    </div>
  );
}

/** Talents contribuant à un axe de forces (`axes.talents`, #409) : `{talentId,spec?}[]` — MÊME patron
 *  que `SkillSpecListField` (Compétences), sur le dataset `talents`. */
function TalentSpecListField({ value, onChange }: { value: { talentId: string; spec?: string }[] | undefined; onChange: (v: { talentId: string; spec?: string }[]) => void }) {
  const list = value ?? [];
  const talentOpts = datasetArray('talents') as { id: string; label: string }[];
  const set = (next: typeof list) => onChange(next);
  return (
    <div className="ed-field">
      <span>talents contribuant à l'axe (facultatif)</span>
      {list.map((s, i) => (
        <div className="tf-row" key={i}>
          <select value={s.talentId} onChange={(e) => set(list.map((x, j) => (j === i ? { ...x, talentId: e.target.value } : x)))}>
            {!s.talentId && <option value="">— (choisir un talent) —</option>}
            {talentOpts.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
          </select>
          <input placeholder="spécialisation (facultatif)" value={s.spec ?? ''} onChange={(e) => set(list.map((x, j) => (j === i ? { ...x, spec: e.target.value || undefined } : x)))} />
          <button className="btn small danger" title="Retirer" onClick={() => set(list.filter((_, j) => j !== i))}>✕</button>
        </div>
      ))}
      <button className="btn small" onClick={() => set([...list, { talentId: '' }])}>+ Talent</button>
    </div>
  );
}

/** Prothèses ANNULATRICES d'un Traumatisme (`traumas.prosthesis`, LDB 73, #157) : `{trappingId,cancels}[]`
 *  — un objet porté (jambe de bois, crochet…) qui annule tout ou partie de la séquelle. */
function ProsthesisField({ value, onChange }: { value: { trappingId: string; cancels: 'all' | 'movement' }[] | undefined; onChange: (v: { trappingId: string; cancels: 'all' | 'movement' }[]) => void }) {
  const list = value ?? [];
  const trappingOpts = datasetArray('trappings') as { id: string; label: string }[];
  const set = (next: typeof list) => onChange(next);
  return (
    <div className="ed-field">
      <span>prothèses annulatrices (LDB 73) — objet porté qui annule cette séquelle</span>
      {list.map((p, i) => (
        <div className="tf-row" key={i}>
          <select value={p.trappingId} onChange={(e) => set(list.map((x, j) => (j === i ? { ...x, trappingId: e.target.value } : x)))}>
            <option value="">— (choisir une possession) —</option>
            {trappingOpts.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
          </select>
          <select value={p.cancels} onChange={(e) => set(list.map((x, j) => (j === i ? { ...x, cancels: e.target.value as 'all' | 'movement' } : x)))}>
            <option value="all">annule tout</option>
            <option value="movement">annule le Mouvement seul</option>
          </select>
          <button className="btn small danger" title="Retirer" onClick={() => set(list.filter((_, j) => j !== i))}>✕</button>
        </div>
      ))}
      <button className="btn small" onClick={() => set([...list, { trappingId: '', cancels: 'all' }])}>+ Prothèse</button>
    </div>
  );
}

/** Traumatismes STRUCTURELS infligés par un Critique localisé (`criticals[Tete|Bras|Corps|Jambe].traumas`,
 *  `aaCriticals*`, LDB 18/AA 07, #173) : `string[]` d'ids de fiche (`traumas.json`), lus PAR ID
 *  (`traumaFicheById`/`traumaById`). Sélecteurs id→label (comme `SkillSpecListField`/`ProsthesisField`),
 *  PAS le motif `<datalist>` par label : plusieurs fiches partagent le même libellé (« Fracture » mineure
 *  ET majeure) — un datalist par label ne pourrait même pas les distinguer, et écrirait un libellé au lieu
 *  de l'id attendu par le lecteur. */
function TraumaListField({ value, onChange }: { value: string[] | undefined; onChange: (v: string[]) => void }) {
  const list = value ?? [];
  const traumaOpts = datasetArray('traumas') as { id: string; label: string }[];
  const set = (next: string[]) => onChange(next);
  return (
    <div className="ed-field">
      <span>traumatismes (LDB 73) — séquelle(s) structurelle(s) infligée(s) par ce critique</span>
      {list.map((id, i) => (
        <div className="tf-row" key={i}>
          <select value={id} onChange={(e) => set(list.map((x, j) => (j === i ? e.target.value : x)))}>
            <option value="">— (choisir un traumatisme) —</option>
            {traumaOpts.map((o) => <option key={o.id} value={o.id}>{o.label} — {o.id}</option>)}
          </select>
          <button className="btn small danger" title="Retirer" onClick={() => set(list.filter((_, j) => j !== i))}>✕</button>
        </div>
      ))}
      <button className="btn small" onClick={() => set([...list, ''])}>+ Traumatisme</button>
    </div>
  );
}

/** Sous-formulaire `{book,page,note?}` (patron du kind `source` générique, `Field` l.~1486) — réutilisé
 *  tel quel par `AlsoInField` (+ `quote`) et `VariantsField` (`variant.source`, optionnel). */
function SourceSubForm({ value, onChange }: { value: { book?: string; page?: number; note?: string }; onChange: (v: { book?: string; page?: number; note?: string }) => void }) {
  return (
    <div className="de-source">
      <input placeholder="livre" value={value.book ?? ''} onChange={(e) => onChange({ ...value, book: e.target.value })} />
      <NumberField variant="nu" label="page" placeholder="page" vide value={value.page} onChange={(n) => onChange({ ...value, page: n ?? 0 })} />
      <input placeholder="note (facultatif)" value={value.note ?? ''} onChange={(e) => onChange({ ...value, note: e.target.value || undefined })} />
    </div>
  );
}

/** Emplacements SECONDAIRES d'une entrée réimprimée ailleurs (`alsoIn: SecondaryRef[]`, #563, doctrine
 *  user 2026-07-17 — « jamais 2 talents différents »). L'ANCRE (`source`) reste seule à porter la
 *  `desc` (règle stricte 5) ; chaque rangée secondaire = `{book,page,note?}` + `quote` (preuve
 *  verbatim, obligatoire si le label n'est pas imprimé tel quel dans ce span). */
function AlsoInField({ value, onChange }: { value: SecondaryRef[] | undefined; onChange: (v: SecondaryRef[]) => void }) {
  const list = value ?? [];
  const set = (next: SecondaryRef[]) => onChange(next);
  return (
    <div className="ed-field">
      <span>autres emplacements (`alsoIn`, #563) — l'ancre (`source`) ci-dessus reste seule à porter la desc</span>
      {list.map((r, i) => (
        <div className="ed-subfield" key={i}>
          <SourceSubForm value={r} onChange={(v) => set(list.map((x, j) => (j === i ? { ...x, ...v } : x)))} />
          <input placeholder="citation verbatim — preuve du span (obligatoire si le label n'y est pas imprimé)" value={r.quote ?? ''} onChange={(e) => set(list.map((x, j) => (j === i ? { ...x, quote: e.target.value || undefined } : x)))} />
          <button className="btn small danger" title="Retirer" onClick={() => set(list.filter((_, j) => j !== i))}>✕</button>
        </div>
      ))}
      <button className="btn small" onClick={() => set([...list, { book: '', page: 0 }])}>+ Emplacement secondaire</button>
    </div>
  );
}

/** Variantes RÉGLÉES d'une entrée sous une règle optionnelle (`variants: Variant[]`, #563/#564) —
 *  `when.rule` est un id du registre `OPTIONAL_RULES` (`engine/policy.ts`, SELECT peuplé, jamais une
 *  saisie libre : pas de gate fantôme, doctrine id/label). Les champs republiables sont ceux que le
 *  DATASET résout (`resolved` = sa `VARIANT_RESOLVED_FIELDS`) : `combat` réutilise `CombatField`,
 *  `effects` le même éditeur de Flow que l'entrée de base, et tout autre champ (NI, Durée…) reprend
 *  son gabarit inféré (`entryFields`) — aucune liste de champs écrite à la main ici. */
/** Coerce la valeur SAISIE de `when.equals` au type que la règle compare au runtime (`activeVariant`
 *  fait `rule(id) === equals`, stricte égalité) : `flag`→boolean, `param`→number, `mode`/défaut→string.
 *  Sans ça une chaîne « true »/« 2 » ne serait jamais `===` au boolean/number réel — gate cassé en silence. */
function coerceRuleValue(raw: string, kind: RuleKind | undefined): RuleValue | undefined {
  if (raw === '') return undefined;
  if (kind === 'flag') return raw === 'true';
  if (kind === 'param') return Number(raw);
  return raw;
}

function VariantsField({ value, resolved, entryFields, allFeatures, onChange }: { value: Variant[] | undefined; resolved: readonly string[]; entryFields: FieldDesc[]; allFeatures: (Partial<CombatFeature> | undefined)[]; onChange: (v: Variant[]) => void }) {
  const list = value ?? [];
  const set = (next: Variant[]) => onChange(next);
  const patch = (i: number, key: string, v: unknown) => set(list.map((x, j) => (j === i ? { ...x, [key]: v } : x)));
  // Champs republiables SANS éditeur bespoke ci-dessous : rendus par le gabarit de l'entrée de base.
  const generic = entryFields.filter((f) => resolved.includes(f.key) && !['desc', 'source', 'combat', 'effects'].includes(f.key));
  return (
    <div className="ed-field">
      <span>variantes réglées par règle optionnelle (#563/#564 — gatées par le MODULE, jamais par la source)</span>
      {list.map((v, i) => (
        <div className="ed-subfield" key={i}>
          <div className="tf-row">
            <label className="dr">Règle
              <select value={v.when.rule} onChange={(e) => set(list.map((x, j) => (j === i ? { ...x, when: { ...x.when, rule: e.target.value } } : x)))}>
                <option value="">— (choisir une règle optionnelle) —</option>
                {OPTIONAL_RULES.map((r) => <option key={r.id} value={r.id}>{r.label} — {r.id}</option>)}
              </select>
            </label>
            <label className="dr">Valeur attendue
              <input placeholder="défaut : true" value={v.when.equals == null ? '' : String(v.when.equals)}
                onChange={(e) => set(list.map((x, j) => (j === i ? { ...x, when: { ...x.when, equals: coerceRuleValue(e.target.value, OPTIONAL_RULES.find((r) => r.id === x.when.rule)?.kind) } } : x)))} />
            </label>
            <button className="btn small danger" title="Retirer" onClick={() => set(list.filter((_, j) => j !== i))}>✕</button>
          </div>
          {resolved.includes('desc') && (
            <label className="ed-subfield">description (facultatif — sinon celle de l'ancre)
              <textarea rows={2} value={v.desc ?? ''} onChange={(e) => patch(i, 'desc', e.target.value || undefined)} />
            </label>
          )}
          {resolved.includes('source') && (
            <div className="ed-subfield">
              <span>source (facultatif)</span>
              <SourceSubForm value={v.source ?? {}} onChange={(s) => patch(i, 'source', (s.book || s.page) ? { book: s.book ?? '', page: s.page ?? 0, note: s.note } : undefined)} />
            </div>
          )}
          {generic.map((f) => <Field key={f.key} field={f} value={v[f.key]} onChange={(nv) => patch(i, f.key, nv)} />)}
          {resolved.includes('effects') && <SpellEffectsField value={v.effects as Flow | undefined} onChange={(fl) => patch(i, 'effects', fl)} />}
          {resolved.includes('combat') && <CombatField value={v.combat as Partial<CombatFeature> | undefined} allFeatures={allFeatures} onChange={(c) => patch(i, 'combat', c)} />}
        </div>
      ))}
      <button className="btn small" onClick={() => set([...list, { when: { rule: '' } }])}>+ Variante</button>
    </div>
  );
}

const DIFFICULTIES = Object.keys(DIFFICULTY_LABELS) as Difficulty[];

type RestartTest = NonNullable<SteamBreakdownEntry['restart']>[number];
type WaterTest = WaterExposureData['test'];

/** Test de REDÉMARRAGE d'un moteur à vapeur (`steamBreakdowns.restart`, MDG 12, #157) :
 *  `{skill:{id,spec?},difficulty,extendedDR?}[]` — Compétence + Difficulté (+ DR cumulés si Test étendu). */
function RestartTestField({ value, onChange }: { value: RestartTest[] | undefined; onChange: (v: RestartTest[]) => void }) {
  const list = value ?? [];
  const skillOpts = datasetArray('skills') as { id: string; label: string }[];
  const set = (next: typeof list) => onChange(next);
  return (
    <div className="ed-field">
      <span>Test de redémarrage du moteur — Compétence OU Caractéristique + Difficulté (DR cumulés si Test étendu)</span>
      {list.map((r, i) => (
        <div className="tf-row" key={i}>
          <select value={r.skill?.id ?? ''} onChange={(e) => set(list.map((x, j) => (j === i ? { ...x, skill: e.target.value ? { ...x.skill, id: e.target.value } : undefined } : x)))}>
            <option value="">— (Caractéristique) —</option>
            {skillOpts.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
          </select>
          {r.skill
            ? <input placeholder="spécialisation (facultatif)" value={r.skill.spec ?? ''} onChange={(e) => set(list.map((x, j) => (j === i ? { ...x, skill: { id: x.skill!.id, spec: e.target.value || undefined } } : x)))} />
            : (
              <select value={r.char ?? ''} onChange={(e) => set(list.map((x, j) => (j === i ? { ...x, char: (e.target.value || undefined) as CharKey | undefined } : x)))}>
                <option value="">— (choisir une Caractéristique) —</option>
                {CHAR_KEYS.map((c) => <option key={c} value={c}>{CHAR_LABELS[c]}</option>)}
              </select>
            )}
          <select value={r.difficulty} onChange={(e) => set(list.map((x, j) => (j === i ? { ...x, difficulty: e.target.value as Difficulty } : x)))}>
            {DIFFICULTIES.map((d) => <option key={d} value={d}>{DIFFICULTY_LABELS[d]}</option>)}
          </select>
          <NumberField variant="nu" label="DR cumulés (étendu)" min={1} placeholder="DR cumulés (étendu)" width={64} vide value={r.extendedDR} onChange={(n) => set(list.map((x, j) => (j === i ? { ...x, extendedDR: n ?? undefined } : x)))} />
          <button className="btn small danger" title="Retirer" onClick={() => set(list.filter((_, j) => j !== i))}>✕</button>
        </div>
      ))}
      <button className="btn small" onClick={() => set([...list, { skill: { id: '' }, difficulty: DIFFICULTIES[0] }])}>+ Test</button>
    </div>
  );
}

/** Test de Résistance d'Exposition hydrique (`waterExposure.test`, MSRC 16 l.13, #157 suite) :
 *  Compétence + Difficulté — sorti du repli générique (le repli traiterait ce couple {skill,difficulty}
 *  en `recordText` renommable, ce qui autoriserait de corrompre les clés d'un objet à forme FIXE). */
function WaterTestField({ value, onChange }: { value: WaterTest | undefined; onChange: (v: WaterTest) => void }) {
  const skillOpts = datasetArray('skills') as { id: string; label: string }[];
  const v = value ?? { skill: { id: '' }, difficulty: DIFFICULTIES[0] };
  return (
    <div className="ed-field">
      <span>Test de Résistance (MSRC 16 l.13) — Compétence + Difficulté</span>
      <div className="tf-row">
        <select value={v.skill.id} onChange={(e) => onChange({ ...v, skill: { ...v.skill, id: e.target.value } })}>
          {!v.skill.id && <option value="">— (choisir une compétence) —</option>}
          {skillOpts.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
        </select>
        <select value={v.difficulty} onChange={(e) => onChange({ ...v, difficulty: e.target.value as Difficulty })}>
          {DIFFICULTIES.map((d) => <option key={d} value={d}>{DIFFICULTY_LABELS[d]}</option>)}
        </select>
      </div>
    </div>
  );
}

const WATER_APPLIES_TO_OPTS = optionsDuNoeud(waterAppliesToSchema) as [WaterExposureModifier['appliesTo'][number], string][];
const WATER_TABLE_OPTS = optionsDuNoeud(waterTableSchema);

/** Modificateurs du Test de Résistance d'Exposition hydrique (`waterExposure.modifiers`, MSRC 16 l.23-47) :
 *  id/libellé/valeur + contexte (Ingestion/Immersion, cumulables) + table d'origine. `auto` (dérivation
 *  automatique depuis le Combatant — PB restants/perdus, État) reste en JSON : union à 5 formes, rare
 *  (6/12 entrées), pas assez structurante pour justifier un 2ᵉ éditeur dédié. */
function WaterModifiersField({ value, onChange }: { value: WaterExposureModifier[] | undefined; onChange: (v: WaterExposureModifier[]) => void }) {
  const list = value ?? [];
  const set = (i: number, patch: Partial<WaterExposureModifier>) => onChange(list.map((m, j) => (j === i ? { ...m, ...patch } : m)));
  const toggleAppliesTo = (i: number, ctx: 'ingestion' | 'immersion') => {
    const cur = list[i].appliesTo;
    set(i, { appliesTo: cur.includes(ctx) ? cur.filter((c) => c !== ctx) : [...cur, ctx] });
  };
  return (
    <div className="ed-field">
      <span>modificateurs du Test de Résistance (MSRC 16 l.23-47) — cumulables</span>
      {list.map((m, i) => (
        <div className="ed-subfield" key={i}>
          <div className="tf-row">
            <input placeholder="id" style={{ width: 140 }} value={m.id} onChange={(e) => set(i, { id: e.target.value })} />
            <input placeholder="libellé" value={m.label} onChange={(e) => set(i, { label: e.target.value })} />
            <NumberField variant="nu" label={`Modificateur — ${m.label || m.id || 'sans libellé'}`} width={64} value={m.mod} onChange={(mod) => set(i, { mod })} />
            <select value={m.table} onChange={(e) => set(i, { table: e.target.value as WaterExposureModifier['table'] })}>
              {WATER_TABLE_OPTS.map(([id, l]) => <option key={id} value={id}>{l}</option>)}
            </select>
            <button className="btn small danger" title="Retirer" onClick={() => onChange(list.filter((_, j) => j !== i))}>✕</button>
          </div>
          <div className="tf-row">
            {WATER_APPLIES_TO_OPTS.map(([id, l]) => (
              <label className="dr" key={id}><input type="checkbox" checked={m.appliesTo.includes(id)} onChange={() => toggleAppliesTo(i, id)} /> {l}</label>
            ))}
          </div>
          <JsonField label="condition automatique (auto — facultatif, dérivée du Combatant)" value={m.auto} onChange={(v) => set(i, { auto: v as WaterExposureModifier['auto'] })} />
        </div>
      ))}
      <button className="btn small" onClick={() => onChange([...list, { id: '', label: '', mod: 0, appliesTo: [], table: 'source-d-eau' }])}>+ Modificateur</button>
    </div>
  );
}

/** Maladies contractées sur Exposition hydrique (`waterExposure.diseases`, MSRC 16 l.49-61) : plage d100
 *  (jet APRÈS échec du Test) → maladie référencée par ID (sélecteur, comme `SkillSpecListField`/
 *  `ProsthesisField`/`MutationTableField` — la donnée est un id, jamais un label). */
function WaterDiseasesField({ value, onChange }: { value: WaterExposureData['diseases'] | undefined; onChange: (v: WaterExposureData['diseases']) => void }) {
  const list = value ?? [];
  const maladieOpts = datasetArray('maladies') as { id: string; label: string }[];
  const set = (i: number, patch: Partial<WaterExposureData['diseases'][number]>) => onChange(list.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  return (
    <div className="ed-field">
      <span>maladies contractées — jet d100 après échec du Test de Résistance (MSRC 16 l.49-61)</span>
      {list.map((r, i) => (
        <div className="tf-row" key={i}>
          <label className="dr">d100&nbsp;<NumberField variant="nu" label="Plage d100 — borne basse" min={1} max={100} value={r.min} onChange={(min) => set(i, { min })} />–<NumberField variant="nu" label="Plage d100 — borne haute" min={1} max={100} value={r.max} onChange={(max) => set(i, { max })} /></label>
          <select value={r.disease} onChange={(e) => set(i, { disease: e.target.value })}>
            <option value="">— (choisir une maladie) —</option>
            {maladieOpts.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
          </select>
          <label className="dr"><input type="checkbox" checked={!!r.rerollUnlessWounded} onChange={(e) => set(i, { rerollUnlessWounded: e.target.checked || undefined })} /> relance si indemne</label>
          <button className="btn small danger" title="Retirer" onClick={() => onChange(list.filter((_, j) => j !== i))}>✕</button>
        </div>
      ))}
      <button className="btn small" onClick={() => onChange([...list, { min: 1, max: 1, disease: '' }])}>+ Maladie</button>
    </div>
  );
}

// ── Activités (`activities.json`, #168) — Test « posté » + table d'issues `OutcomeBand[]` ────────────
const ACTIVITY_CONTEXTS = optionsDe('activities.json', 'contexts') as [ActivityContext, string][];
// Les quatre `select` d'issue lisent leurs options SUR LE NŒUD de `activities.ts` (`enumNomme`, #1694) —
// nœuds NICHÉS (`outcomes[].on`, `outcomes[].battle[].target`…), donc importés du def, pas `noeudDuChamp`.
const OUTCOME_ON_OPTIONS = optionsDuNoeud(outcomeOnSchema);
const BATTLE_COND_OPTIONS = optionsDuNoeud(battleCondSchema);
const BATTLE_TARGET_OPTIONS = optionsDuNoeud(battleOutcomeTargetSchema);
const BATTLE_SCALE_OPTIONS = optionsDuNoeud(battleOutcomeScaleSchema);
const BATTLE_SIDE_OPTIONS = optionsDuNoeud(battleSideSchema);

/** Test « posté » d'une Activité (`TestSpec` — LDB 12) : contextes de proposition + compétence(s) « au
 *  choix » (la meilleure de l'acteur est retenue) + caractéristique de repli + Difficulté. Réutilise
 *  `SkillSpecListField` (mêmes `{id,spec?}[]` que les Rôles d'équipage). Vide = Activité SANS Test. */
function ActivityTestField({ entry, edit }: { entry: Entry; edit: (key: string, v: unknown) => void }) {
  const contexts = (entry.contexts as ActivityContext[] | undefined) ?? [];
  const toggle = (c: ActivityContext) => edit('contexts', contexts.includes(c) ? contexts.filter((x) => x !== c) : [...contexts, c]);
  return (
    <div className="ed-field">
      <span>contextes où l’Activité est proposable (au moins un)</span>
      <div className="tf-row">
        {ACTIVITY_CONTEXTS.map(([c, l]) => (
          <label className="dr" key={c}><input type="checkbox" checked={contexts.includes(c)} onChange={() => toggle(c)} /> {l}</label>
        ))}
      </div>
      <span>Test « posté » — compétence(s) « au choix » + caractéristique de repli + Difficulté (laisser vide = Activité SANS Test)</span>
      <SkillSpecListField value={entry.skills as SkillRef[] | undefined} onChange={(v) => edit('skills', v.length ? v : undefined)} />
      <div className="tf-row">
        <label className="dr">Caractéristique (repli)
          <select value={(entry.char as string) ?? ''} onChange={(e) => edit('char', e.target.value || undefined)}>
            <option value="">— (aucune) —</option>
            {CHAR_KEYS.map((k) => <option key={k} value={k}>{CHAR_LABELS[k]}</option>)}
          </select>
        </label>
        <label className="dr">Difficulté
          <select value={(entry.difficulty as string) ?? ''} onChange={(e) => edit('difficulty', e.target.value || undefined)}>
            <option value="">— (aucune) —</option>
            {DIFFICULTIES.map((d) => <option key={d} value={d}>{DIFFICULTY_LABELS[d]}</option>)}
          </select>
        </label>
      </div>
    </div>
  );
}

/** Issues de BATAILLE (ADE II 8) d'une bande — portent sur l'ARMÉE (delta de Puissance / mod de Test),
 *  échelle `scale` (plat / × DR / × touches / × ennemis tués), montant SIGNÉ, camp éventuel. */
function BattleOutcomeListField({ value, onChange }: { value: BattleOutcome[] | undefined; onChange: (v: BattleOutcome[]) => void }) {
  const list = value ?? [];
  const set = (i: number, patch: Partial<BattleOutcome>) => onChange(list.map((o, j) => (j === i ? { ...o, ...patch } : o)));
  return (
    <div className="ed-subfield">
      <span>issues de BATAILLE (ADE II 8) — portent sur l’ARMÉE, pas sur le héros</span>
      {list.map((o, i) => (
        <div className="tf-row" key={i}>
          <select value={o.target} onChange={(e) => set(i, { target: e.target.value as BattleOutcomeTarget })}>
            {BATTLE_TARGET_OPTIONS.map(([t, l]) => <option key={t} value={t}>{l}</option>)}
          </select>
          <select value={o.scale} onChange={(e) => set(i, { scale: e.target.value as BattleOutcomeScale })}>
            {BATTLE_SCALE_OPTIONS.map(([s, l]) => <option key={s} value={s}>{l}</option>)}
          </select>
          <label className="dr">montant<NumberField variant="nu" label="montant" width={72} value={o.amount} onChange={(amount) => set(i, { amount })} /></label>
          <select value={o.side ?? ''} onChange={(e) => set(i, { side: (e.target.value || undefined) as BattleSide | undefined })}>
            <option value="">— camp (auto) —</option>
            {BATTLE_SIDE_OPTIONS.map(([s, l]) => <option key={s} value={s}>{l}</option>)}
          </select>
          <button className="btn small danger" title="Retirer" onClick={() => onChange(list.filter((_, j) => j !== i))}>✕</button>
        </div>
      ))}
      <button className="btn small" onClick={() => onChange([...list, { target: 'might', scale: 'fixed', amount: 0 }])}>+ Issue de bataille</button>
    </div>
  );
}

/** Scènes IMPOSÉES au Round suivant si la bande matche (ids de rencontre/scène — enchaînements de bataille). */
function ChainsField({ value, onChange }: { value: string[] | undefined; onChange: (v: string[]) => void }) {
  const list = value ?? [];
  return (
    <div className="ed-subfield">
      <span>scènes enchaînées (imposées au Round suivant) — ids de rencontre/scène</span>
      {list.map((c, i) => (
        <div className="de-reflrow" key={i}>
          <input value={c} onChange={(e) => onChange(list.map((x, j) => (j === i ? e.target.value : x)))} />
          <button className="btn small danger" title="Retirer" onClick={() => onChange(list.filter((_, j) => j !== i))}>✕</button>
        </div>
      ))}
      <button className="btn small" onClick={() => onChange([...list, ''])}>+ Scène enchaînée</button>
    </div>
  );
}

/** Famille de résolveurs (`RESOLVER_OWNER`) atteignable depuis chaque contexte d'Activité. Table
 *  TOTALE (`Record<ActivityContext, …>`) : un contexte de plus doit se classer. `null` = contexte sans
 *  dispatch de résolveur — `bataille`/`bataille-round` se résolvent par `sceneKind` (ADE II 8),
 *  `auberge` n'a pas de flux propre. */
const OWNERS_BY_CONTEXT: Record<ActivityContext, ResolverOwner | null> = {
  interlude: 'interlude', mer: 'mer', voyage: 'voyage',
  bataille: null, 'bataille-round': null, auberge: null,
};

export interface ResolverChoices { options: ActivityResolver[]; familles: ResolverOwner[] }

/** Choix de résolveur offerts pour des `contexts` donnés, et la valeur courante à préserver. PURE.
 *  `null` = AUCUN champ à rendre : tous les contextes déclarés sont sans famille, il n'y a rien à
 *  choisir (jamais un sélecteur à zéro option). Sans contexte déclaré, rien ne filtre ⇒ vocabulaire
 *  complet. La valeur courante est toujours proposée (une entrée authorée ne se perd pas au rendu). */
export function resolverChoicesFor(contexts: ActivityContext[], cur?: ActivityResolver): ResolverChoices | null {
  const familles = [...new Set(contexts.map((c) => OWNERS_BY_CONTEXT[c]).filter((o): o is ResolverOwner => !!o))];
  if (!contexts.length) return { options: [...ACTIVITY_RESOLVERS], familles: [] };
  if (!familles.length) return cur ? { options: [cur], familles: [] } : null;
  const choix = familles.flatMap(resolversOwnedBy);
  return { options: cur && !choix.includes(cur) ? [cur, ...choix] : choix, familles };
}

/** Résolveur BESPOKE d'une Activité — vocabulaire FERMÉ (`ACTIVITY_RESOLVERS`), jamais une saisie
 *  libre : un nom inventé ici serait un no-op silencieux à l'exécution. */
function ActivityResolverField({ entry, edit }: { entry: Record<string, unknown>; edit: (k: string, v: unknown) => void }) {
  const cur = entry.resolver as ActivityResolver | undefined;
  const choix = resolverChoicesFor((entry.contexts as ActivityContext[] | undefined) ?? [], cur);
  if (!choix) return null;
  const { options, familles } = choix;
  return (
    <label className="ed-field">
      <span>résolveur (bespoke) — logique nommée du flux propriétaire{familles.length ? ` (familles : ${familles.join(', ')})` : ''}</span>
      <select value={cur ?? ''} onChange={(e) => edit('resolver', (e.target.value || undefined) as ActivityResolver | undefined)}>
        <option value="">— aucun (issue par ops/outcomes) —</option>
        {options.map((r) => <option key={r} value={r}>{r} · {RESOLVER_OWNER[r]}</option>)}
      </select>
    </label>
  );
}
/** Table d'ISSUES d'une Activité (`OutcomeBand[]`, ACE Annexe I / ADE II 8) : chaque bande = une
 *  fourchette de DR (`minSL`/`maxSL`, primitive de PLAGE comme mutationTables/weather) filtrée par issue
 *  (`on`) et gate de bataille (`when`), portant sa note VERBATIM, son effet `ops` (GameOpEditor commun),
 *  ses issues de bataille et ses enchaînements. Maladresse (`on:'fumble'`) REMPLACE toute autre issue. */
function OutcomeBandsField({ value, onChange }: { value: OutcomeBand[] | undefined; onChange: (v: OutcomeBand[]) => void }) {
  const list = value ?? [];
  const set = (i: number, patch: Partial<OutcomeBand>) => onChange(list.map((b, j) => (j === i ? { ...b, ...patch } : b)));
  return (
    <div className="ed-field">
      <span>issues par Degrés de Réussite (bandes DR → résultat) — Maladresse remplace toute autre issue ; sans « issue » la bande matche par DR seul (ACE Annexe I)</span>
      {list.map((b, i) => (
        <div className="ed-subfield" key={i}>
          <div className="tf-row">
            <label className="dr">Issue
              <select value={b.on ?? ''} onChange={(e) => set(i, { on: (e.target.value || undefined) as OutcomeBand['on'] })}>
                <option value="">— toute issue —</option>
                {OUTCOME_ON_OPTIONS.map(([o, l]) => <option key={o} value={o}>{l}</option>)}
              </select>
            </label>
            <label className="dr">DR min<NumberField variant="nu" label="DR min" width={64} vide value={b.minSL} onChange={(n) => set(i, { minSL: n ?? undefined })} /></label>
            <label className="dr">DR max<NumberField variant="nu" label="DR max" width={64} vide value={b.maxSL} onChange={(n) => set(i, { maxSL: n ?? undefined })} /></label>
            <label className="dr">gate bataille
              <select value={b.when ?? ''} onChange={(e) => set(i, { when: (e.target.value || undefined) as BattleCond | undefined })}>
                <option value="">— aucun —</option>
                {BATTLE_COND_OPTIONS.map(([c, l]) => <option key={c} value={c}>{l}</option>)}
              </select>
            </label>
            <button className="btn small danger" title="Supprimer la bande" onClick={() => onChange(list.filter((_, j) => j !== i))}>✕</button>
          </div>
          <label className="ed-subfield">note (texte de résultat VERBATIM de la source)
            <textarea rows={2} value={b.note ?? ''} onChange={(e) => set(i, { note: e.target.value || undefined })} />
          </label>
          <div className="tf-row">
            <label className="dr">résolveur (bespoke)
              <select value={b.resolver ?? ''} onChange={(e) => set(i, { resolver: (e.target.value || undefined) as ActivityResolver | undefined })}>
                <option value="">— aucun —</option>
                {ACTIVITY_RESOLVERS.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </label>
            <label className="dr">rendu %<NumberField variant="nu" label="rendu %" width={64} vide value={b.payoutPct} onChange={(n) => set(i, { payoutPct: n ?? undefined })} /></label>
          </div>
          <div className="ed-subfield">
            <span>effet mécanique sur le Personnage (GameOp[])</span>
            <GameOpEditor ops={b.ops ?? []} onChange={(ops) => set(i, { ops: ops.length ? ops : undefined })} />
          </div>
          <BattleOutcomeListField value={b.battle} onChange={(v) => set(i, { battle: v.length ? v : undefined })} />
          <ChainsField value={b.chains} onChange={(v) => set(i, { chains: v.length ? v : undefined })} />
        </div>
      ))}
      <button className="btn small" onClick={() => onChange([...list, {}])}>+ Bande d’issue</button>
    </div>
  );
}

/** Une plage d100 d'une Table de Corruption : [min,max] → mutation référencée PAR ID (`mutations.ts` :
 *  `BY_ID.get(range.mutation)`). */
interface MutationRange { min: number; max: number; mutation: string; }

/** Éditeur des PLAGES d'une Table de Corruption (`mutationTables.json`) : chaque rangée = un intervalle d100
 *  → une mutation (sélecteur id→label, #173 — PAS le datalist par label : la donnée est un id). La table
 *  renvoie la mutation dont l'intervalle contient le jet (`findTableEntry`). DÉCOUPLÉ de la mutation :
 *  plusieurs tables (une par dieu du Chaos, Compagnon T1) peuvent pointer la même mutation à des plages
 *  différentes. */
/** Éditeur des PLAGES de Météo d'une saison (`weather.json`) : chaque rangée = un intervalle d100
 *  `{min, max}` bornes incluses → une Météo (parmi les types connus). La table renvoie la météo dont
 *  l'intervalle CONTIENT le jet (`findTableEntry`) — les deux bornes s'éditent, comme la source les
 *  imprime (EDOC 08 l.52-59), et l'ordre des rangées ne décide plus du tirage. */
function WeatherRangesField({ value, onChange }: { value: { min: number; max: number; weather: string }[] | undefined; onChange: (v: { min: number; max: number; weather: string }[]) => void }) {
  const list = value ?? [];
  const set = (i: number, patch: Partial<{ min: number; max: number; weather: string }>) => onChange(list.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  return (
    <div className="ed-field">
      <span>plages d100 → météo (bornes incluses ; la table renvoie la météo dont l'intervalle contient le jet)</span>
      {list.map((r, i) => (
        <div className="ed-subfield" key={i}>
          <div className="tf-row">
            <label className="dr">d100&nbsp;<NumberField variant="nu" label="Plage d100 — borne basse" min={1} max={100} value={r.min} onChange={(min) => set(i, { min })} />–<NumberField variant="nu" label="Plage d100 — borne haute" min={1} max={100} value={r.max} onChange={(max) => set(i, { max })} /></label>
            <select value={r.weather} onChange={(e) => set(i, { weather: e.target.value })}>
              {/* ÉNUMÉRATION depuis la DÉCLARATION (patron `RACE_KEYS`) — jamais depuis `weatherConditions`,
                  qui est la donnée en cours d'édition : une fiche supprimée dans l'onglet voisin ne doit pas
                  amputer l'alphabet des plages. Le LIBELLÉ, lui, vient de la donnée (porte unique). */}
              {weatherIdSchema.options.map((w) => <option key={w} value={w}>{weatherCondition(w).label}</option>)}
            </select>
            <button className="btn small danger" title="Supprimer la plage" onClick={() => onChange(list.filter((_, j) => j !== i))}>✕</button>
          </div>
        </div>
      ))}
      <button className="btn small" onClick={() => onChange([...list, { min: 1, max: 100, weather: 'beau' }])}>+ Plage d100</button>
    </div>
  );
}

function MutationTableField({ value, onChange }: { value: MutationRange[] | undefined; onChange: (v: MutationRange[]) => void }) {
  const list = value ?? [];
  const mutationOpts = datasetArray('mutations') as { id: string; label: string }[];
  const set = (i: number, patch: Partial<MutationRange>) => onChange(list.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  return (
    <div className="ed-field">
      <span>plages d100 → mutation (la table renvoie la mutation dont l'intervalle contient le jet)</span>
      {list.map((r, i) => (
        <div className="ed-subfield" key={i}>
          <div className="tf-row">
            <label className="dr">d100&nbsp;<NumberField variant="nu" label="Plage d100 — borne basse" min={1} max={100} value={r.min} onChange={(min) => set(i, { min })} />–<NumberField variant="nu" label="Plage d100 — borne haute" min={1} max={100} value={r.max} onChange={(max) => set(i, { max })} /></label>
            <select value={r.mutation} onChange={(e) => set(i, { mutation: e.target.value })}>
              <option value="">— (choisir une mutation) —</option>
              {mutationOpts.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
            </select>
            <button className="btn small danger" title="Supprimer la plage" onClick={() => onChange(list.filter((_, j) => j !== i))}>✕</button>
          </div>
        </div>
      ))}
      <button className="btn small" onClick={() => onChange([...list, { min: 1, max: 1, mutation: '' }])}>+ Plage d100</button>
    </div>
  );
}

/** Texte d'aide LDB 05 (« Détails ») : global + par espèce (HTML léger). Clé de `bySpecies` = id
 *  d'espèce `RaceKey` (#1467 L1b V-P4) ; le sceau du dataset refuse toute autre clé. */
interface DetailText { all: string; bySpecies: Record<string, string>; }
/** Bloc `details.texts` : 5 entrées d'aide (nom/âge/taille/Ambitions courte & longue). Clés OUVERTES
 *  (un nouveau texte ajouté à la donnée apparaît tout seul). */
type DetailsTexts = Record<string, DetailText>;

const RACE_KEYS = raceKeySchema.options;

const DETAIL_TEXT_LABEL: Record<string, string> = {
  nom: 'Noms', age: 'Âge', taille: 'Taille', ambitionShort: 'Ambition (court terme)', ambitionLong: 'Ambition (long terme)',
};

/** Éditeur du bloc `details.texts` (objet `details.json`) — pour chaque entrée d'aide : un texte GLOBAL
 *  (`all`) + des surcharges PAR ESPÈCE (`bySpecies`, clé = id `RaceKey`). HTML léger autorisé (rendu via
 *  LoreText au Codex). Réutilise le motif `de-reflrow` (rangée + ✕ + « + »). Sort `texts` du repli JSON. */
export function DetailsTextsField({ value, onChange }: { value: DetailsTexts | undefined; onChange: (v: DetailsTexts) => void }) {
  const texts = value ?? {};
  const EMPTY_TEXT: DetailText = { all: '', bySpecies: {} };
  const setText = (key: string, patch: Partial<DetailText>) => onChange({ ...texts, [key]: { ...EMPTY_TEXT, ...texts[key], ...patch } });
  const setSpecies = (key: string, sp: string, v: string) => setText(key, { bySpecies: { ...texts[key]?.bySpecies, [sp]: v } });
  const renameSpecies = (key: string, oldSp: string, newSp: string) => {
    const by = { ...texts[key]?.bySpecies };
    const v = by[oldSp]; delete by[oldSp]; if (newSp) by[newSp] = v ?? '';
    setText(key, { bySpecies: by });
  };
  const clesLibres = (key: string, sauf?: string) => RACE_KEYS.filter((k) => k === sauf || !(k in (texts[key]?.bySpecies ?? {})));
  const removeSpecies = (key: string, sp: string) => {
    const by = { ...texts[key]?.bySpecies }; delete by[sp];
    setText(key, { bySpecies: by });
  };
  return (
    <div className="ed-field">
      <span>textes d'aide de création (LDB 05 — global + surcharges par espèce, HTML léger)</span>
      {Object.keys(texts).map((key) => {
        const t = texts[key];
        return (
          <div className="ed-field" key={key}>
            <b>{DETAIL_TEXT_LABEL[key] ?? key}</b>
            <label className="ed-subfield">global<textarea rows={3} value={t.all} onChange={(e) => setText(key, { all: e.target.value })} /></label>
            <span className="de-hint">par espèce</span>
            <Grid min="md" stackBelow={700}>
              {Object.keys(t.bySpecies ?? {}).map((sp) => (
                <div className="ed-field" key={sp}>
                  <div className="de-reflrow">
                    <select aria-label={`Espèce de la surcharge — ${DETAIL_TEXT_LABEL[key] ?? key}`} value={sp} onChange={(e) => renameSpecies(key, sp, e.target.value)}>
                      {clesLibres(key, sp).map((k) => <option key={k} value={k}>{k}</option>)}
                    </select>
                    <div className="de-spacer" />
                    <button className="btn small danger" title="Retirer l'espèce" onClick={() => removeSpecies(key, sp)}>✕</button>
                  </div>
                  <textarea rows={2} value={t.bySpecies[sp]} onChange={(e) => setSpecies(key, sp, e.target.value)} />
                </div>
              ))}
            </Grid>
            <GatedAction id={`details-add-species-${key}`} label="+ Espèce" primary={false} btnClassName="small"
              enabled={clesLibres(key).length > 0}
              reason="Les 7 espèces ont déjà leur surcharge."
              onClick={() => { const libre = clesLibres(key)[0]; if (libre) setSpecies(key, libre, ''); }} />
          </div>
        );
      })}
    </div>
  );
}

/** Rendu d'un champ, avec autocomplétion `<datalist>` pour les listes de références. */
function Field({ field, value, onChange }: { field: FieldDesc; value: unknown; onChange: (v: unknown) => void }) {
  // `key` = IDENTITÉ du champ (jointures de valeurs, `REF_LIST_DATASET`) ; `label` = AFFICHAGE (#1466).
  const { key, kind, label } = field;
  const refDs = REF_LIST_DATASET[key];

  if (kind === 'stringList') {
    const list = (value as string[]) ?? [];
    const set = (next: string[]) => onChange(next);
    return (
      <div className="ed-field">
        <span>{label}{refDs && <em className="de-hint"> (autocomplétion {refDs})</em>}</span>
        {list.map((item, i) => (
          <div key={i} className="de-reflrow">
            <input value={item} list={refDs ? `dl-${refDs}` : undefined}
              onChange={(e) => set(list.map((x, j) => (j === i ? e.target.value : x)))} />
            <button className="btn small danger" onClick={() => set(list.filter((_, j) => j !== i))}>✕</button>
          </div>
        ))}
        <button className="btn small" onClick={() => set([...list, ''])}>+ Ajouter</button>
        {refDs && <RefDatalist ds={refDs} />}
      </div>
    );
  }
  if (kind === 'numberList') {
    const list = (value as number[]) ?? [];
    const set = (next: number[]) => onChange(next);
    return (
      <div className="ed-field">
        <span>{label}</span>
        {list.map((item, i) => (
          <div key={i} className="de-reflrow">
            <NumberField variant="nu" label={`${label} — valeur ${i + 1}`} value={item} onChange={(n) => set(list.map((x, j) => (j === i ? n : x)))} />
            <button className="btn small danger" onClick={() => set(list.filter((_, j) => j !== i))}>✕</button>
          </div>
        ))}
        <button className="btn small" onClick={() => set([...list, 0])}>+ Ajouter</button>
      </div>
    );
  }
  if (kind === 'select' && field.valeurs) {
    // Choix BORNÉ d'un champ énuméré : options ET libellés viennent de son nœud (`enumNomme`) —
    // même `<select>` que les autres choix bornés de l'atelier (`ManeuverDefField` ci-dessus).
    const valeurs = field.valeurs;
    return (
      <label className="ed-field"><span>{label}</span>
        <select value={(value as string) ?? ''} onChange={(e) => onChange(e.target.value || (field.nullable ? null : e.target.value))}>
          {field.nullable && <option value="">— (aucun)</option>}
          {Object.keys(valeurs).map((v) => <option key={v} value={v}>{valeurs[v]}</option>)}
        </select>
      </label>
    );
  }
  if (kind === 'textarea')
    return <label className="ed-field"><span>{label}</span><textarea rows={3} value={(value as string) ?? ''} onChange={(e) => onChange(e.target.value)} /></label>;
  if (kind === 'number')
    return <label className="ed-field"><span>{label}</span><NumberField variant="nu" label={label} vide value={value as number | null} onChange={(n) => onChange(n ?? (field.nullable ? null : 0))} /></label>;
  if (kind === 'checkbox')
    return <label className="ed-check"><input type="checkbox" checked={!!value} onChange={(e) => onChange(e.target.checked)} /><span>{label}</span></label>;
  if (kind === 'source') {
    const s = (value as { book?: string; page?: number }) ?? {};
    return <div className="ed-field"><span>{label}</span><div className="de-source"><input placeholder="livre" value={s.book ?? ''} onChange={(e) => onChange({ ...s, book: e.target.value })} /><NumberField variant="nu" label={`${label} — page`} placeholder="page" vide value={s.page} onChange={(n) => onChange({ ...s, page: n ?? 0 })} /></div></div>;
  }
  if (kind === 'descRef') {
    return <DescRefField label={label} value={value as DescRef | undefined} onChange={onChange as (v: DescRef | undefined) => void} />;
  }
  if (kind === 'recordNumber') {
    const rec = (value as Record<string, number | null>) ?? {};
    const keys = Object.keys(rec);
    return <div className="ed-field"><span>{label}</span>{keys.length === 0 ? <em className="de-hint">vide</em> : <div className="de-grid">{keys.map((k) => <label key={k} className="de-cell"><span>{k}</span><NumberField variant="nu" label={`${label} — ${k}`} vide value={rec[k]} onChange={(n) => onChange({ ...rec, [k]: n })} /></label>)}</div>}</div>;
  }
  if (kind === 'recordText') return <RecordTextField label={label} value={value as Record<string, string> | undefined} onChange={onChange} />;
  if (kind === 'object') return <ObjectField label={label} value={value as Record<string, unknown> | undefined} noeud={field.noeud} onChange={onChange} />;
  if (kind === 'json') {
    // Un tableau d'objets PLATS niché (`vitesseMax.table`, `hazards[].entanglePenalties`… sous un
    // `ObjectField`/`GenericArrayField` récursif, hors du périmètre TOP-LEVEL du garde
    // `no-json-fields.test`) retombe sur le MÊME éditeur générique que les tableaux top-level
    // (`GenericArrayField`) plutôt que `JsonField` — y compris quand CETTE instance vaut `null`/absent
    // (champ optionnel non renseigné sur cette entrée : `GenericArrayField` démarre vide, « + Ajouter »
    // fonctionnel). `JsonField` ne reste qu'un filet pour une forme vraiment hors gabarit (tableau de
    // tableaux…), aucun cas réel actuel.
    if (value == null || (Array.isArray(value) && value.every((x) => x != null && typeof x === 'object' && !Array.isArray(x))))
      return <GenericArrayField label={label} value={value as Record<string, unknown>[] | undefined} noeud={field.noeud} onChange={onChange as (v: Record<string, unknown>[]) => void} />;
    return <JsonField label={label} value={value} onChange={onChange} />;
  }
  // `fige` : valeur POSÉE par le def — affichée, jamais saisie (un champ ouvert à la frappe dont une
  // seule valeur parse est une affordance qui ment).
  if (field.fige) return <label className="ed-field"><span>{label}</span><input value={(value as string) ?? ''} readOnly /></label>;
  return <label className="ed-field"><span>{label}</span><input value={(value as string) ?? ''} onChange={(e) => onChange(field.nullable && e.target.value === '' ? null : e.target.value)} /></label>;
}

/** Record homogène clé→chaîne (couleur par espèce des yeux/cheveux, palette de couleurs d'apparence) :
 *  une rangée par clé (clé renommable + valeur), + ajout/retrait. Clés OUVERTES → un nouveau membre
 *  s'ajoute sans toucher le code. */
function RecordTextField({ label, value, onChange }: { label: string; value: Record<string, string> | undefined; onChange: (v: Record<string, string>) => void }) {
  const rec = value ?? {};
  const keys = Object.keys(rec);
  const rename = (oldK: string, newK: string) => {
    const next: Record<string, string> = {};
    for (const k of keys) next[k === oldK ? newK : k] = rec[k]; // ordre préservé
    onChange(next);
  };
  return (
    <div className="ed-field">
      <span>{label}</span>
      {keys.map((k) => (
        <div className="de-reflrow" key={k}>
          <input style={{ width: 140 }} value={k} onChange={(e) => rename(k, e.target.value)} />
          <input value={rec[k]} onChange={(e) => onChange({ ...rec, [k]: e.target.value })} />
          <button className="btn small danger" title="Retirer" onClick={() => { const next = { ...rec }; delete next[k]; onChange(next); }}>✕</button>
        </div>
      ))}
      <button className="btn small" onClick={() => onChange({ ...rec, '': '' })}>+ Entrée</button>
    </div>
  );
}

/** Objet de config hétérogène (`interludeEvents.fx`, `raceAppearance.eyes`…) : SOUS-FORMULAIRE inféré
 *  (récursif) — chaque sous-champ retrouve son kind structuré (number/checkbox/stringList/recordText/…)
 *  via le MÊME `inferFields` + `Field`, sans repli JSON pour les objets plats. */
function ObjectField({ label, value, noeud, onChange }: { label: string; value: Record<string, unknown> | undefined; noeud?: unknown; onChange: (v: Record<string, unknown>) => void }) {
  const obj = value ?? {};
  // Régime PROFONDEUR : un sous-champ nommé `id`/`maison` n'est pas le champ d'enveloppe du même nom —
  // il reste en clé technique, sa méta relève de la dérivation des widgets (#1466 L6). Le NŒUD, lui,
  // redescend : les libellés de VALEURS d'un enum nommé valent à toute profondeur (#1694).
  const subFields = useMemo(() => inferFields([obj], { niveau: 'profondeur', noeud: noeudObjet(noeud) }), [obj, noeud]);
  return (
    <div className="ed-field ed-subform">
      <span>{label}</span>
      <div className="ed-subfield">
        {subFields.map((f) => (
          <Field key={f.key} field={f} value={obj[f.key]} onChange={(v) => onChange({ ...obj, [f.key]: v })} />
        ))}
      </div>
    </div>
  );
}

/** Tableau de lignes HÉTÉROGÈNES (LOT 1 #422) — une entrée par rangée, colonnes DÉRIVÉES par
 *  `inferFields` (comme `ObjectField`, mais pour un tableau top-level plutôt qu'un objet unique). Chaque
 *  champ retrouve son kind structuré (number/text/source/stringList…) ; un sous-champ COLONNE lui-même
 *  tableau-d'objets (ex. `hazards[].entanglePenalties`) reste JSON-FREE : il redescend en `GenericArrayField`
 *  RÉCURSIF — ses propres colonnes sont dérivées de TOUTES les occurrences non-vides de cette colonne
 *  À TRAVERS les rangées (`nestedCols`), pas seulement de la valeur de la rangée courante — sinon une
 *  rangée où le sous-champ est encore vide/absent (ex. `entanglePenalties` non renseigné sur Iceberg,
 *  alors que Débris marins le porte) perdrait la forme et retomberait sur `JsonField` faute de colonne
 *  inférable localement. `columns` (optionnel) permet à un appelant récursif d'imposer ce gabarit externe
 *  plutôt que de le re-dériver depuis un tableau parfois vide. « + Ajouter » clone la 1ʳᵉ ligne (gabarit
 *  de champs) ou démarre vide si le tableau l'est. */
function GenericArrayField({ label, value, noeud, onChange, columns }: { label: string; value: Record<string, unknown>[] | undefined; noeud?: unknown; onChange: (v: Record<string, unknown>[]) => void; columns?: FieldDesc[] }) {
  const list = value ?? [];
  // Colonnes de PROFONDEUR : même frontière que `ObjectField` (méta de profondeur = #1466 L6 ; le nœud
  // de rangée porte, lui, les libellés de valeurs de ses enums nommés, #1694).
  const selfCols = useMemo(() => inferFields(list, { niveau: 'profondeur', noeud: noeudObjet(noeud) }), [list, noeud]);
  const cols = columns ?? selfCols;
  const nestedCols = useMemo(() => {
    const map = new Map<string, FieldDesc[]>();
    for (const f of cols) {
      if (f.kind !== 'json') continue;
      const pool = list.flatMap((r) => (Array.isArray(r[f.key]) ? (r[f.key] as Record<string, unknown>[]) : []));
      if (pool.length && pool.every((x) => x != null && typeof x === 'object' && !Array.isArray(x))) map.set(f.key, inferFields(pool, { niveau: 'profondeur', noeud: noeudObjet(f.noeud) }));
    }
    return map;
  }, [list, cols]);
  const setRow = (i: number, key: string, v: unknown) => onChange(list.map((r, j) => (j === i ? { ...r, [key]: v } : r)));
  return (
    <div className="ed-field ed-subform">
      <span>{label}</span>
      {list.map((row, i) => (
        <div className="ed-subfield" key={i}>
          {cols.map((f) => nestedCols.has(f.key)
            ? <GenericArrayField key={f.key} label={f.label} value={(row[f.key] as Record<string, unknown>[] | undefined) ?? []} noeud={f.noeud} columns={nestedCols.get(f.key)} onChange={(v) => setRow(i, f.key, v)} />
            : <Field key={f.key} field={f} value={row[f.key]} onChange={(v) => setRow(i, f.key, v)} />)}
          <button className="btn small danger" onClick={() => onChange(list.filter((_, j) => j !== i))}>✕ Retirer la rangée</button>
        </div>
      ))}
      <button className="btn small" onClick={() => onChange([...list, {}])}>+ Ajouter</button>
    </div>
  );
}

/** `<datalist>` des libellés d'un dataset (dé-dupliqués) — réutilise le motif SpellsField. */
function RefDatalist({ ds }: { ds: DatasetKey }) {
  const labels = useMemo(() => [...new Set((datasetArray(ds) as { label?: string }[]).map((e) => e.label).filter(Boolean))] as string[], [ds]);
  return <datalist id={`dl-${ds}`}>{labels.map((l) => <option key={l} value={l} />)}</datalist>;
}

