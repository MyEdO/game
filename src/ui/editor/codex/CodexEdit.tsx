/**
 * Édition DEV d'une entrée du Compendium — édite la VRAIE donnée (`src/data/*.json`, app-owned).
 * Réutilise le navigateur du Compendium (cet éditeur ne vit QUE dans le panneau détail) + la saisie
 * à suggestions `SaisieSuggeree` (`RefField`) pour les champs-références (traits/talents/sorts…
 * piochés dans leurs vrais datasets, param libre « 8 Tentacules +8 » conservé). Validation et
 * transaction d'enregistrement : `data/atelierDuCodex.ts` ; écriture disque : File System Access (`fsPersist`).
 */
import type { Equipe } from '../../../engine/relations';
import { tableTotale } from '../../../lib/tableTotale';
import { Fragment, useEffect, useId, useMemo, useState, type Dispatch, type SetStateAction } from 'react';
import { datasetArray, datasetObject, datasetFile, datasetObjectFile, ancetreDuDe, deDeLaTable, type DatasetKey } from '../../../data/overrides';
import { editableDataset, editableEntries, editableObjectDataset, enregistrerEntree, validateEntry } from '../../../data/atelierDuCodex';
import type { RefDesignee } from '../../../data/schemas/grammaire/ref';
import type { SteamBreakdownEntry } from '../../../engine/shipBuild';
import { metaPourFichier, chargeDiscriminee, brouillonNeuf, noeudDuChamp, noeudObjet, noeudDeLEntree, RangeeSansNoeud, rapportDeFautes } from '../../../data/schemas/validate';
import { enfantsDe, ouverts } from '../../../data/schemas/grammaire/descente';
import * as fs from '../../../web/fsPersist';
import { admetLAbsence, estDerive, inferFields, offreDesRangees, videDuNoeud, type FieldDesc } from '../../../noyau/codex/editFields';
import { libelleDeValeur, metaDesChamps, optionsDuNoeud } from '../../../data/schemas/grammaire/meta';
import { categoryByKey } from '../../../noyau/codex/registry';
import { ACTIVITY_RESOLVERS, RESOLVER_OWNER, resolversOwnedBy } from '../../../engine/activities';
import type { ActivityContext, OutcomeBand, BattleOutcome, BattleOutcomeTarget, BattleOutcomeScale, BattleCond, ActivityResolver, ResolverOwner } from '../../../engine/activities';
import { weatherCondition } from '../../../engine/travelStages';
import { weatherIdSchema } from '../../../data/schemas/defs/weather';
import { outcomeOnSchema, battleCondSchema, battleOutcomeTargetSchema, battleOutcomeScaleSchema } from '../../../data/schemas/defs/activities';
import { equipeSchema } from '../../../data/schemas/grammaire/valeurs';
import { waterAppliesToSchema, waterTableSchema } from '../../../data/schemas/defs/water-exposure';
import { ChoixDeSpec, RefField, SaisieSuggeree, reposerLId, cfgDeLaFeuille, cfgDeLaListe, cfgDuNoeudASpec, cfgDuNoeudType, refFieldCfg } from '../../compendium/refField/RefField';
import { SaisieEnBrouillon } from '../../compendium/refField/SaisieEnBrouillon';
import { DescRefField } from '../../compendium/DescRefField';
import type { DescRef } from '../../../data/source/decoupe';
import { Icon } from '../../Icon';
import { NumberField } from '../../NumberField';
import { grilleDesPonts } from '../../../data/schemas/grammaire/carte-ascii';
import { ProseField } from '../../ProseField';
import { SourceRefField, SuiviDesSaisies, useSaisieEnCours, useSuiviDesSaisies } from '../../SourceRefField';
import { useClesDeRangees } from '../../useClesDeRangees';
import { PlageField, type PlageDomaine, type PlageValue } from '../../PlageField';
import { type DiceSpec, formatDice, parseDice, totalDuDe } from '../../../engine/dice';
import { deDeLaTableTiree, facesDuDe } from '../../../engine/tables';
import { GatedAction } from '../../GatedAction';
import { raceKeySchema } from '../../../data/schemas/grammaire/valeurs';
import { ApparencesObjetsField, ReglagesApparence, apparenceSuivante } from '../ReglagesApparence';
import { armesDEntite } from '../../../noyau/equipementDessine';
import { FlowEditor, NoeudTestField, type NoeudTest } from '../FlowEditor';
import { ctxDeCatalogue } from '../EffectList';
import { GameOpEditor, FormulaField } from '../GameOpEditor';
import type { GameOp } from '../../../engine/ops';
import type { ConsumableDuration } from '../../../engine/consumables';
import { JsonField } from '../JsonField';
import type { EntityAppearance } from '../../../engine/authoringAppearance';
import type { Flow, TriggeredEffect } from '../../../data/schemas/defs-scenes/effets';
import { EMPTY_FLOW, type EffectTrigger, type FlowTest } from '../../../engine/flowCore';
import { effectOnSchema, effectTriggerSchema, familleDesEffets } from '../../../data/schemas/grammaire/mecanique';
import type { ManeuverDef, ManeuverMeasure } from '../../../data';
import { SYMPTOM_SEVERITIES } from '../../../data';
import type { AttackKind } from '../../../engine/creatureAttacks';
import { WeaponField } from '../WeaponField';
import type { ArmeDerivee } from '../../../data';
import { SymptomsField, SymptomTickField, DiseaseDailyTestField, type DiseaseDailyTest, ShipCrewHitField, type ShipCrewHitValue, TalentTestField, CombatField, AdvancementRefField, TrappingRefField, CharKeysField, DomainEffectsField, TraitListField, OptionalsListField, HarvestField, SpecsField, RuleValueField, RuleActionField, type RuleShape } from './StructFields';
import { AlsoInField } from '../../AlsoInField';
import type { OptionalRule } from '../../../engine/policy';
import type { OptionalEntry } from '../../../engine/statEntry';
import type { TraitPose } from '../../../data/schemas/grammaire/reference';
import type { DomainData, EffectTableRow } from '../../../data';
import type { CharKey, Difficulty, Trauma, VehicleData } from '../../../engine/types';
import { CHAR_KEYS, CHAR_LABELS, DIFFICULTY_LABELS, HIT_LOCATION_LABELS, LOCALISATIONS_DE_COUP } from '../../../engine/types';
import type { DiseaseSymptom } from '../../../data/schemas/defs/maladies';
import type { CombatFeature } from '../../../engine/combatFeatures/types';
import type { AdvancementRef, TrappingRef, TalentTest, SpecEntry, WaterExposureData, WaterExposureModifier } from '../../../data';
import { skillRefLabel, talentRefLabel, type SkillRef, type TalentRef } from '../../../data';
import { deDeTirageSchema, specsSourceSchema, symptomSeveritySchema } from '../../../data/schemas/grammaire/valeurs';
import { parseSkillRef, parseTalentRef } from '../../../data/refFormatLivre';
import type { SecondaryRef, SourceRef, Variant } from '../../../data/schemas/grammaire/valeurs';
import { OPTIONAL_RULES, type RuleKind, type RuleValue } from '../../../engine/policy';
import { VARIANT_RESOLVED_FIELDS as TALENT_VARIANT_FIELDS } from '../../../data/schemas/defs/talents';
import { VARIANT_RESOLVED_FIELDS as SPELL_VARIANT_FIELDS } from '../../../data/schemas/defs/spells';
import { Grid } from '../../Layout';
import { entryKey, findTrappingById, starSubDie } from '../../../data';
import { estObjet } from '../../../lib/objet.mjs';

/** Catégories à VARIANTES réglées (#563/#564), avec les champs que leur résolution APPLIQUE — valeurs
 *  LUES des defs (`VARIANT_RESOLVED_FIELDS`), jamais recopiées : `VariantsField` en déduit les sous-
 *  éditeurs à rendre, donc aucun champ republiable n'est inoéditable et aucun ne s'affiche à vide. */
const VARIANT_FIELDS_BY_CATEGORY: Record<string, readonly string[]> = {
  talents: TALENT_VARIANT_FIELDS,
  spells: SPELL_VARIANT_FIELDS,
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
  drunkenness: ['ops'], // #422 (suite) : effet mécanique optionnel d'un résultat d'Ivresse (LDB 09)
  stars: ['ops'], // #1467 L1b : effet du signe aux attributs de départ (ADE II 3 l.38) — GameOp[] comme les autres
  // #422 (FINAL) : Empoignade — `init` (à la touche) en `GameOp[]` top-level (`win.degats/empetrer/
  // liberer`, sous `win`, retombent en sous-formulaire récursif `object`, hors guard — même patron `windEffect`
  // de `riverNavigation`). Incantations Imparfaites/Colère des dieux — `ops` (dialecte compilé, mais MÊMES
  // kinds `condition`/`wounds`/`corruption`/`reduceToZero`/`castPenalty`/`suppressTalents`/`deitySkillMod`/`deityBan`/`prayerForAction`
  // que le vocabulaire `GameOp` réel), et `targetOps` (ops aux cibles de l'incantation).
  grapple: ['init'],
  imparfaiteMineure: ['ops', 'targetOps'], imparfaiteMajeure: ['ops', 'targetOps'], colereDesDieux: ['ops', 'targetOps'],
  imparfaiteMineureVdm: ['ops', 'targetOps'], imparfaiteMajeureVdm: ['ops', 'targetOps'],
  ...tableTotale(SHIP_CRIT_CATEGORIES, () => ['ops']),
};
const opsFieldsOf = (categoryKey: string): string[] => OPS_FIELDS[categoryKey] ?? [];

type Entry = Record<string, unknown>;
/** Les géométries de `TriggeredEffect.on` : la zone autour d'un centre, la sélection d'adversaires engagés. */
type ZoneDEffet = Extract<TriggeredEffect['on'], { near: unknown }>;
type SelectionDEffet = Extract<TriggeredEffect['on'], { pick: unknown }>;

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

/** Champ MULTILIGNE de refs au format livre (une par ligne), en BROUILLON (`SaisieEnBrouillon`) posé au
 *  blur. Le blur ne REFUSE rien : toute ligne est coercée en ref par le parse (un nom inconnu devient son
 *  slug). Le refus est NOMINATIF au Save — `validateEntry` rend « skills : réf « X » introuvable
 *  (skills) » et l'enregistrement reste bloqué tant qu'une erreur subsiste. */
function LignesFormatLivreField<T>(
  { label, hint, value, libelle, parse, onChange }:
  { label: string; hint: string; value: T[] | undefined; libelle: (r: T) => string; parse: (ligne: string) => T; onChange: (refs: T[]) => void },
) {
  return (
    <label className="ed-field">
      <span>{label}</span>
      <span className="ed-hint">{hint}</span>
      <SaisieEnBrouillon
        lignes={6} value={value ?? []} afficher={(v) => refsEnLignes(v, libelle)} relire={(t) => lignesEnRefs(t, parse)} onChange={onChange} />
    </label>
  );
}

/** Axes du PROFIL de manœuvre rendus par `ManeuverDefField` (selects/checkbox). */
const MANEUVER_PROFILE_KEYS = ['kind', 'activation', 'coutEnAvantage', 'modeDAvantage', 'stat', 'defense', 'ciblage', 'range', 'blast', 'magic'];

/** Le document de la catégorie porte-t-il `alsoIn` (clé d'enveloppe, `CLES_ENVELOPPE` de `grammaire/document.ts`) ? */
const porteAlsoIn = (categoryKey: string): boolean => {
  const ds = editableDataset(categoryKey);
  if (ds !== undefined) return noeudDuChamp(datasetFile(ds), 'alsoIn') !== undefined;
  const objet = editableObjectDataset(categoryKey);
  return objet?.mode === 'unique' && noeudDuChamp(datasetObjectFile(objet.ds), 'alsoIn') !== undefined;
};

/**
 * Clés de champ COUVERTES par un éditeur dédié (sorties du formulaire générique inféré), PAR catégorie.
 * SOURCE UNIQUE : utilisée par le filtre de `CodexEdit` ET par le garde-fou `no-json-fields.test` (qui
 * vérifie qu'aucun champ d'aucun dataset éditable ne retombe en `kind:'json'`). Ajouter un éditeur dédié
 * = ajouter sa/ses clé(s) ici (et le composant dans le rendu). */
/** Les tables tirées de `sea-events.json` (événements de bord, d'escale, paliers du Voyage rapide), dont la
 *  `consequence` est un Flow de racine `evenementDeMer`. */
const EVENEMENTS_DE_MER: readonly string[] = ['seaBoardEvents', 'seaPortEvents', 'seaFastVoyage'];

export function dedicatedFieldKeys(categoryKey: string): Set<string> {
  const k = new Set<string>();
  const add = (...keys: string[]) => keys.forEach((x) => k.add(x));
  if (categoryKey === 'creatures') add('appearance');
  if (['spells', 'traits', 'qualities', 'domains', 'talents', 'maneuvers', 'etats', 'psychologies', 'symptoms', 'mutations'].includes(categoryKey)) add('effects');
  if (categoryKey === 'maneuvers') add(...MANEUVER_PROFILE_KEYS);
  if (['traits', 'qualities', 'mutations', 'talents', 'etats', 'trappings', 'psychologies', 'navalTraits'].includes(categoryKey)) add('passive');
  if (categoryKey === 'races') add('traits'); // Traits posés → réutilise TraitListField (comme creatures) — Trait racial d'espèce (encombrance/consommation), #572
  if (categoryKey === 'crewRoles') add('skills'); // {id,spec?}[] → éditeur dédié (SkillSpecListField)
  if (categoryKey === 'axes') add('skills', 'talents'); // #409 : {id,spec?}[] → SkillSpecListField/TalentSpecListField
  if (categoryKey === 'traumas') add('prosthesis'); // {id,cancels}[] → éditeur dédié (ProsthesisField)
  if (CRITICAL_CATEGORIES.includes(categoryKey)) add('traumas', 'test'); // string[] d'ids → TraumaListField (#173) ; `test` → FlowEditor (#1682)
  if (categoryKey === 'steamBreakdowns') add('restart'); // {test,drCible?}[] → éditeur dédié
  if (categoryKey === 'vehicles') add('ponts'); // [cartes, hauteurs] → éditeur dédié (PontsField)
  add(...opsFieldsOf(categoryKey)); // ops/occupantOps/crewOps/captainOps → GameOpEditor (#157)
  if (categoryKey === 'symptoms') add('passive', 'passiveBySeverity', 'onTick', 'visiblePassive', 'visibleLocations'); // GameOp[] + test de cycle + gate visibilité → éditeurs dédiés (capabilities = sous-form générique)
  if (categoryKey === 'stars') add('sub');
  if (['mutationTables', 'weather', 'effectTables'].includes(categoryKey)) add('entries');
  if (['mutations', 'trappings'].includes(categoryKey)) add('derivedWeapon');
  if (categoryKey === 'trappings') add('consumable', 'consumableDuration', 'onHitEffects'); // onHitEffects → TriggeredEffectsField (#175)
  if (EVENEMENTS_DE_MER.includes(categoryKey)) add('consequence'); // Flow joué par `runFlow` → FlowEditor (#1652)
  // #1318 : paliers d'entraînement d'une PROTHÈSE (LDB 73) — `{cost,label,reduces?,grants?}[]`,
  // tableau d'objets HOMOGÈNES → éditeur GÉNÉRIQUE commun (`GenericArrayField`), jamais le repli JSON.
  if (categoryKey === 'trappings') add('prosthesisTraining');
  if (categoryKey === 'maladies') add('symptoms', 'dailyTest'); // `dailyTest` porte un nœud `test` du Flow → DiseaseDailyTestField (#1657)
  if (categoryKey === 'talents') add('combat', 'test');
  if (VARIANT_FIELDS_BY_CATEGORY[categoryKey]) add('variants'); // variants → VariantsField (#563)
  if (porteAlsoIn(categoryKey)) add('alsoIn'); // alsoIn → AlsoInField (#563)
  if (categoryKey === 'skills' || categoryKey === 'talents') add('specs');
  if (categoryKey === 'traits') add('specsSource', 'indice', 'range', 'specsOpen'); // schéma d'argument → éditeur dédié
  // V9 #1318 : la VALEUR d'une règle optionnelle est typée par son `kind` (`RuleValueField`/
  // `RuleActionField`) — le champ inféré serait un TEXTE pour les 81 règles (échantillon `mode`),
  // et `"false"` y éteindrait une règle sans un mot. `validateEntry` refuse en plus au save.
  if (categoryKey === 'reglesOptionnelles') add('default', 'action');

  if (categoryKey === 'races' || categoryKey === 'careerLevels') add('skills', 'talents');
  if (categoryKey === 'classes' || categoryKey === 'careerLevels' || categoryKey === 'creatures') add('trappings'); // TrappingRef[] — MEME forme, MEME éditeur (#1548)
  // Créature : `skills`/`talents` sont des REFS structurées (`SkillRef`/`TalentRef`) — éditées au FORMAT
  // LIVRE (porte partagée avec l'éditeur de statbloc de scène), jamais par le champ-liste générique.
  if (categoryKey === 'creatures') add('skills', 'talents');
  if (categoryKey === 'pregens') add('trappings', 'talents'); // MÊMES refs que la créature : `TalentRef[]` et dotations (id catalogue ou texte)
  if (categoryKey === 'careerLevels') add('characteristics');
  if (categoryKey === 'domains') add('castBonus', 'missile', 'casterOps');
  // Rubrique de VENT (`windModifiers`, #729) : tableau top-level d'objets → éditeur GÉNÉRIQUE commun.
  if (categoryKey === 'domains') add('windModifiers');
  if (categoryKey === 'characteristics') add('options'); // dépenses d'une ressource → éditeur GÉNÉRIQUE commun
  // options de Test (l.119), barème par plage de DR (l.111), camps asymétriques (l.25) → MÊME éditeur générique
  if (categoryKey === 'tavernGames') add('options', 'table', 'sides', 'specials');
  if (categoryKey === 'creatures') add('traits', 'optionals', 'harvest');
  if (categoryKey === 'details') add('texts');
  if (SHIP_CRIT_CATEGORIES.includes(categoryKey)) add('crewHit'); // {crewTarget?, test | ops} — nœud `test` du Flow → ShipCrewHitField (#1657)
  if (categoryKey === 'waterExposure') add('test', 'modifiers', 'diseases'); // #157 suite (MSRC 16)
  // #422 : seules les tables NICHÉES en TABLEAU top-level d'une fiche-objet navale retombent en
  // json (repli générique) — chaque sous-objet HÉTÉROGÈNE (vitesseMax/salissures/orientation/phares/
  // poursuite/reparation…) recourt déjà au sous-formulaire récursif (`ObjectField`), hors guard.
  if (categoryKey === 'seaNavigation') add('forcerLeRythme');
  if (categoryKey === 'seaPerils') add('hazards', 'detroits', 'tourbillons', 'gestionDesPerils');
  if (categoryKey === 'seaWeather') add('precipitations', 'temperatures', 'visibilites', 'vents');
  // #422 (suite) : Disponibilité & Troc (`disponibilite`, mode 'single', patron `waterExposure`) —
  // `dispoPct`/`barterRatios` (tableaux top-level) → éditeur GÉNÉRIQUE commun (`GenericArrayField`).
  if (categoryKey === 'disponibilite') add('dispoPct', 'barterRatios');
  // Fourchettes à DEUX bornes (#1659) — servies par la MÊME primitive (`PlageField`) : la longueur de
  // coque (bande finale ouverte, MDG 12 l.129) et le sous-tirage astral (ADE II 03 l.63) ci-dessus.
  if (categoryKey === 'shipHullSizes') add('lengthM');
  // #168 : Activité — Test « posté » (contexts/tests « au choix »/difficulty) + table d'issues
  // `outcomes` (OutcomeBand[]) → éditeurs dédiés ; `onSuccess` couvert par opsFieldsOf ci-dessus.
  // `resolver` (#1318 V6) : vocabulaire FERMÉ → sélecteur dédié, jamais le champ texte générique.
  if (categoryKey === 'activities') add('contexts', 'tests', 'freeSkill', 'difficulty', 'outcomes', 'resolver');
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

/** Props de l'atelier : l'ancrage est un VERROU PAR CONSTRUCTION (#1472) — soit l'entrée est NEUVE
 *  (`isNew`, le save APPEND), soit elle porte l'`id` STABLE du document édité. Aucun appel ne peut
 *  être « ni l'un ni l'autre » : la branche APPEND silencieuse n'est plus atteignable. */
type CodexEditProps = { categoryKey: string; onClose: () => void }
  & ({ isNew: true; id?: undefined } | { isNew?: false; id: string });

/** Connexion au dossier `src/data` : elle survit au changement d'entrée, qui remonte l'atelier. */
type ConnexionDonnees = { dir: FileSystemDirectoryHandle | null; needsGrant: boolean; echec: string };
type ConnexionProps = { connexion: ConnexionDonnees; setConnexion: Dispatch<SetStateAction<ConnexionDonnees>> };

/** Identité de l'entrée éditée (`catégorie#id`) : un changement d'entrée REMONTE l'atelier, dont l'état
 *  (`entry`, brouillon, erreurs) ne rend jamais l'entrée précédente sous la catégorie suivante. */
const identiteDEntree = (categoryKey: string, id: string | undefined, isNew: boolean | undefined): string => `${categoryKey}#${isNew ? '(neuve)' : (id ?? '')}`;

export function CodexEdit(props: CodexEditProps) {
  const [connexion, setConnexion] = useState<ConnexionDonnees>({ dir: null, needsGrant: false, echec: '' });
  useEffect(() => {
    fs.restoreDataDir().then(
      (r) => { if (r) setConnexion((c) => ({ ...c, dir: r.handle, needsGrant: !r.granted })); },
      (e) => setConnexion((c) => ({ ...c, echec: `Échec de la reconnexion à src/data : ${String(e)}` })),
    );
  }, []);
  return <AtelierDEntree key={identiteDEntree(props.categoryKey, props.id, props.isNew)} {...props} connexion={connexion} setConnexion={setConnexion} />;
}

function AtelierDEntree({ categoryKey, id, onClose, isNew, connexion, setConnexion }: CodexEditProps & ConnexionProps) {
  // SOURCE de données UNIFIÉE (tableau d'entités OU dataset-objet) → la même UI de formulaire édite les
  // deux formes : tableau (une entité par item Codex) et objet unique (`details`, fiches de règle).
  // `entries` = échantillons pour `inferFields` ; `initial` = l'objet édité ;
  // `file` = fichier disque du dataset, qu'écrit l'hôte après la transaction (`enregistrerEntree`).
  const obj = editableObjectDataset(categoryKey);
  const src = useMemo<{ dataset: string; entries: Entry[]; initial: Entry; index: number; file: string }>(() => {
    const entries = editableEntries(categoryKey);
    if (obj) {
      const data = datasetObject(obj.ds) as Record<string, unknown>;
      const file = datasetObjectFile(obj.ds);
      return { dataset: obj.ds, entries, initial: data as Entry, index: -1, file };
    }
    const dsKey = editableDataset(categoryKey)!;
    const arr = entries;
    // `isNew` : entrée VIERGE (le save APPEND) ; sinon ancrage par ID STABLE (#1472) — `id` est celui
    // de l'item du navigateur, qui EST l'`id` du document projeté ; `label` reste de l'AFFICHAGE.
    const index = isNew ? -1 : arr.findIndex((e) => String(e.id ?? '') === id);
    const file = datasetFile(dsKey);
    return {
      dataset: dsKey,
      entries: arr,
      // Une entrée NEUVE part de ce que le def DÉTERMINE (`brouillonNeuf`) : le `type` d'enveloppe et,
      // pour un document discriminé, la valeur que le `select` affiche en tête — sinon l'écran promet
      // un cas que l'état ne porte pas (union des champs présentés, refus `invalid_value` au save).
      initial: arr[index] ?? brouillonNeuf(file, arr as Record<string, unknown>[]),
      index,
      file,
    };
  }, [obj, categoryKey, id, isNew]);

  const [entry, setEntry] = useState<Entry>(() => structuredClone(src.initial));
  // DÉ DE TIRAGE porté par un ANCÊTRE de la table (`deDeLaTable`) : commun à toutes ses rangées, il
  // s'écrit dans la même transaction que l'entrée (#1667). `undefined` : la table n'en porte pas.
  const ancetreDuDeDeLaTable = obj ? undefined : ancetreDuDe(src.dataset as DatasetKey);
  const deImprime = obj ? undefined : deDeLaTable(src.dataset as DatasetKey);
  const [deSaisi, setDeSaisi] = useState(deImprime);
  // Libellé COURANT de l'entrée (`entryKey`), celui de sa catégorie tant qu'elle n'en porte pas (#1830).
  const libelle = entryKey(entry).trim() || categoryByKey(categoryKey)!.label;
  const { dir, needsGrant } = connexion;
  const [dirty, setDirty] = useState(false);
  const [msg, setMsg] = useState('');
  const fsApi = fs.fsApiDisponible();
  // Refus de SCHÉMA (contrat de donnée #176) : message champ-par-champ (validateDataset) quand la donnée
  // sérialisée ne parse pas son schéma zod — l'écriture disque est bloquée. Effacé à toute ré-édition.
  const [schemaError, setSchemaError] = useState<string | null>(null);

  // L'apparence (`AppearanceField`) ET les EFFETS d'un sort (FlowEditor) ont leur éditeur dédié — on les
  // sort du formulaire générique (sinon rendus en JSON brut). Les autres champs gardent le formulaire
  // inféré. Même patron : on filtre le champ et on rend l'éditeur spécialisé. Seul le schéma des
  // créatures porte `appearance`.
  const hasAppearance = categoryKey === 'creatures';
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
  // Rôle d'équipage (`crewRoles`, #157) : `skills` = {id,spec?}[] → éditeur dédié.
  const hasCrewSkills = categoryKey === 'crewRoles';
  // Axe de forces (`axes`, #409) : `skills`/`talents` = {id,spec?}[] → éditeurs dédiés
  // (SkillSpecListField, réutilisé tel quel côté Compétences ; TalentSpecListField, même patron côté Talents).
  const hasAxes = categoryKey === 'axes';
  // Traumatisme (`traumas`, #157) : `prosthesis` (prothèses annulatrices, LDB 73) = {id,cancels}[].
  const hasProsthesis = categoryKey === 'traumas';
  // Critique localisé (LDB 6/AA, #173) : `traumas` = string[] d'ids de fiche (`traumas.json`) →
  // éditeur dédié (TraumaListField, sélecteurs id→label) au lieu du datalist générique par-label.
  const hasTraumaList = CRITICAL_CATEGORIES.includes(categoryKey);
  // Panne de Vapeur (`steamBreakdowns`, #157) : `restart` (Test de redémarrage) = {test,drCible?}[].
  const hasRestartTest = categoryKey === 'steamBreakdowns';
  // Ponts d'un navire (`vehicles.ponts`, #3686) : la paire [cartes, hauteurs].
  const hasPonts = categoryKey === 'vehicles';
  // Champs `GameOp[]` autres que `passive` (ops/occupantOps/crewOps/captainOps, #157) — même GameOpEditor.
  const opsFields = opsFieldsOf(categoryKey);
  // Symptôme de maladie : passifs `passiveBySeverity` par PALIER + Test de cycle `onTick`
  // (difficulté + conséquence GameOp `onFail`) — éditeurs dédiés au-dessus du formulaire générique.
  const isSymptom = categoryKey === 'symptoms';
  // Règle optionnelle : sa valeur par défaut (et le `when` de son action) sont typées par son `kind`.
  const isOptionalRule = categoryKey === 'reglesOptionnelles';
  // Table de Corruption : ses `entries` (plages de son dé → réf mutation) ont leur éditeur dédié.
  const isMutationTable = categoryKey === 'mutationTables';
  // Météo : ses `entries` (plages de son dé → type de météo) ont leur éditeur dédié.
  const isWeather = categoryKey === 'weather';
  // Table d'effets : ses `entries` (plages de son dé → opérations) ont leur éditeur dédié (#1667).
  const isEffectTable = categoryKey === 'effectTables';
  const deDeLEntree = typeof entry.die === 'string' ? parseDice(entry.die) : null;
  // Arme DÉRIVÉE (WeaponField) : portée par une Mutation (Tentacule…) OU une Possession (prothèse-arme).
  const hasDerivedWeapon = categoryKey === 'mutations' || categoryKey === 'trappings';
  const hasConsumable = categoryKey === 'trappings';
  // Maladie : ses `symptoms` (DiseaseSymptom[]) ont un éditeur dédié (type + sévérité + difficulté).
  const isDisease = categoryKey === 'maladies';
  // Talent : sa capacité de combat `combat` (CombatFeature : drapeaux + castingKind/attackModes/offHand).
  const hasCombat = categoryKey === 'talents';
  // Variantes réglées par règle optionnelle (`variants`, #563) — VariantsField, dont les sous-
  // éditeurs DÉRIVENT de la liste blanche du dataset (`VARIANT_FIELDS_BY_CATEGORY`).
  const variantFields = VARIANT_FIELDS_BY_CATEGORY[categoryKey];
  // Emplacement(s) secondaire(s) d'une entrée réimprimée ailleurs (`alsoIn`, #563) — AlsoInField.
  const hasAlsoIn = porteAlsoIn(categoryKey);
  // Compétence/Talent : `specs` = SpecEntry[] ({id,label}).
  const hasSpecs = categoryKey === 'skills' || categoryKey === 'talents';
  // Avancement (espèce / niveau de carrière) : `skills`/`talents` = AdvancementRef[] (réf/joker/choix/aléatoire).
  const hasAdvancement = categoryKey === 'races' || categoryKey === 'careerLevels';
  // Possessions (classe / niveau de carrière / créature) : `trappings` = TrappingRef[] (id catalogue + quantité, ou texte).
  const hasTrappings = categoryKey === 'classes' || categoryKey === 'careerLevels' || categoryKey === 'creatures' || categoryKey === 'pregens';
  // Niveau de carrière : `characteristics` = CharKey[] (vocab fermé) → multi-sélection (pas de saisie libre).
  const hasCharKeys = categoryKey === 'careerLevels';
  // Étoile : `sub` = la fourchette du sous-tirage (`starSubDie`, ADE II 03 l.63) → `PlageField`.
  const hasStarSub = categoryKey === 'stars';
  // Domaine de magie : `castBonus`/`missile`/`casterOps` = attributs de domaine (éditeur dédié).
  const hasDomainEffects = categoryKey === 'domains';
  // Créature : `traits`/`optionals` = TraitPose[] (réutilise `TraitListField` du StatblockEditor),
  // `harvest` = objet { rareté, dangerosité, usages } (HarvestField) → sortis du repli JSON.
  const isCreature = categoryKey === 'creatures';
  // Détails de création (objet unique `details.json`) : `texts` (5 entrées { all, bySpecies }) a son
  // éditeur dédié ; les 4 records Âge/Taille restent au formulaire générique (`recordNumber`).
  const isDetails = categoryKey === 'details';
  // Trait : SCHÉMA de son argument (indice/range/specsSource/specsOpen) → éditeur dédié
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
  // #422 : fiches de règle navales UNIQUES (mode 'single', patron `waterExposure`) — leurs
  // tableaux top-level NICHÉS (`forcerLeRythme`/`hazards`/…/`roseDesVents`) ont un éditeur GÉNÉRIQUE
  // commun (`GenericArrayField`, réutilise `inferFields`+`Field` — pas de forme dédiée par champ).
  const isSeaNavigation = categoryKey === 'seaNavigation';
  const isSeaPerils = categoryKey === 'seaPerils';
  const isSeaWeather = categoryKey === 'seaWeather';
  // #422 (suite) : Disponibilité & Troc (`disponibilite`, mode 'single') — `dispoPct`/`barterRatios`
  // (tableaux top-level) au MÊME éditeur générique commun que les fiches navales ci-dessus.
  const isDisponibilite = categoryKey === 'disponibilite';
  const hasHullLength = categoryKey === 'shipHullSizes'; // `lengthM` : [minM,maxM]
  // #168 : Activité (`activities`) — Test « posté » (contexts/tests « au choix »/difficulty) +
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
  // NŒUD de l'entrée éditée — UNE source pour le formulaire inféré et les éditeurs dédiés : la RANGÉE
  // de son dataset, lue sur sa route déclarée (`noeudDeLEntree`). Une rangée refusée par son élément
  // (`RangeeSansNoeud`) est une faute de SCHÉMA de l'entrée, dite par `rapportDeFautes` au nom COURANT
  // de l'entrée (`libelle`) : elle bloque Enregistrer ; ses champs restent inférés de l'échantillon (#1830).
  const rangee = useMemo((): { noeud?: unknown; faute?: string } => {
    try { return { noeud: noeudDeLEntree(src.dataset, entry) }; }
    catch (e) {
      if (e instanceof RangeeSansNoeud) return { faute: rapportDeFautes(libelle, e.fautes) };
      throw e;
    }
  }, [src.dataset, entry, libelle]);
  const noeudEntree = rangee.noeud;
  // Les LIBELLÉS de premier niveau sont ceux du nœud de la rangée (`nommerChamps`) : la méta du fichier
  // nomme la racine du document, qui n'est l'entrée éditée que pour un dataset de racine.
  const metaDeLEntree = useMemo(() => ouverts([noeudEntree]).map(metaDesChamps).find((m) => m !== undefined) ?? metaPourFichier(src.file), [noeudEntree, src.file]);
  const allFields = useMemo(() => inferFields(src.entries as Record<string, unknown>[], { meta: metaDeLEntree, noeud: noeudEntree }), [src.entries, metaDeLEntree, noeudEntree]);
  // Un éditeur DÉDIÉ de tableau d'objets reçoit le NŒUD de SON champ, comme le chemin générique
  // (`Field` → `GenericArrayField`, `field.noeud`) : c'est le nœud qui porte le libellé des VALEURS
  // (`enumNomme`, #1694), donc le `select` nommé à toute profondeur du sous-formulaire.
  const noeudDe = (champ: string): unknown => enfantsDe(noeudEntree).find((e) => e.cle === champ)?.noeud;
  // Un document DISCRIMINÉ (`espace.discriminant` de sa racine, `partitionDeCharge`) présente la charge du CAS de l'entrée — jamais
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
  // Une saisie que l'enregistrement ne poserait pas (source incomplète, rangée `alsoIn`, clé de record en conflit) le bloque.
  const saisies = useSuiviDesSaisies();
  const canSave = dirty && errors.length === 0 && !saisies.enCours && rangee.faute === undefined;
  // IDENTITÉ de l'entrée éditée : racine des `chemin` de ses champs.
  const porteurEntree = identiteDEntree(categoryKey, id, isNew);
  const chemin = (champ: string): string => `${porteurEntree}/${champ}`;

  const save = async () => {
    // Transaction d'enregistrement de la donnée (`enregistrerEntree`) ; l'écriture disque reste ici.
    const issue = enregistrerEntree(categoryKey, entry, src.index, deSaisi === deImprime ? [] : [{ ancetre: ancetreDuDeDeLaTable!, champ: 'die', valeur: deSaisi }]);
    if (!issue.ok) { setSchemaError(issue.erreurs.join('\n')); setMsg(''); return; }
    setSchemaError(null);
    const text = issue.texte;
    try {
      if (fsApi && dir && !needsGrant) { await fs.writeFile(dir, src.file, text); setMsg(`Enregistré ${src.file} — Vite recharge…`); }
      else { fs.downloadFallback(src.file, text); setMsg(`Téléchargé ${src.file} — reposez-le dans src/data/`); }
      setDirty(false);
    } catch (e) { setMsg(`Échec : ${String(e)}`); }
  };

  return (
    <div className="codex-edit">
      <div className="codex-edit-bar">
        {!fsApi && <span className="de-warn">FS Access indisponible — sauvegarde par téléchargement</span>}
        {fsApi && !dir && <button className="btn small" onClick={() => fs.connectDataDir().then(
          (h) => { if (h) setConnexion((c) => ({ ...c, dir: h, needsGrant: false })); },
          (e) => setMsg(`Échec de la connexion à src/data : ${String(e)}`),
        )}><Icon id="fichier/dossier" size="sm" /> Connecter src/data…</button>}
        {fsApi && dir && needsGrant && <button className="btn small" onClick={() => fs.grantPermission(dir).then(
          (ok) => { if (ok) setConnexion((c) => ({ ...c, needsGrant: false })); },
          (e) => setMsg(`Échec de l’autorisation d’écriture dans src/data : ${String(e)}`),
        )}>Autoriser l'écriture</button>}
        {fsApi && dir && !needsGrant && <span className="de-ok"><Icon id="fichier/dossier" size="sm" /> connecté</span>}
        <span className="de-spacer" />
        {(msg || connexion.echec) && <span className="de-msg">{msg || connexion.echec}</span>}
        <button className="btn small" onClick={onClose}>Fermer</button>
        <button className="btn small btn-primary" disabled={!canSave} onClick={save}>Enregistrer{dirty ? ' •' : ''}</button>
      </div>
      {((dirty && errors.length > 0) || saisies.enCours || rangee.faute) && (
        <ul className="codex-edit-errors">
          {rangee.faute?.split('\n').map((line, i) => <li key={`rangee-${i}`}>{line}</li>)}
          {dirty && errors.map((e) => <li key={e}>{e}</li>)}
          {saisies.enCours && <li>Une saisie en cours n'est pas retenue : Enregistrer attend qu'elle soit complétée ou retirée (voir le champ signalé).</li>}
        </ul>
      )}
      {schemaError && (
        <ul className="codex-edit-errors">
          {schemaError.split('\n').map((line, i) => <li key={i}>{line}</li>)}
        </ul>
      )}
      <SuiviDesSaisies signaler={saisies.signaler}>
      <div className="codex-edit-form">
        {deSaisi !== undefined && (
          <div className="ed-field">
            <span>dé de tirage de la table — commun à toutes ses rangées</span>
            <DeDeTirageField value={deSaisi} onChange={(d) => { setDeSaisi(d); setDirty(true); setSchemaError(null); }} />
          </div>
        )}
        {hasAppearance && <AppearanceField traits={entry.traits as TraitPose[]} value={entry.appearance as EntityAppearance | undefined} onChange={(v) => edit('appearance', v)} />}
        {isSpell && <SpellEffectsField value={entry.effects as Flow | undefined} onChange={(v) => edit('effects', v)} />}
        {CRITICAL_CATEGORIES.includes(categoryKey) && (
          <NoeudTestField
            racine="critique"
            desc="jet de la rangée (Difficulté, compétence, conséquences des deux branches)"
            value={entry.test as NoeudTest | undefined}
            onChange={(v) => edit('test', v)}
          />
        )}
        {isPassive && (
          <div className="ed-field">
            <span>modificateurs PASSIFS continus (mêmes ops que les sorts — sans déclencheur)</span>
            <GameOpEditor noeud={noeudDe('passive')} ops={(entry.passive as GameOp[] | undefined) ?? []} onChange={(ops) => edit('passive', ops)} />
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
            <EnsembleDeCases nom="Localisations visibles" options={LOCALISATIONS_DE_COUP.map((loc) => [loc, HIT_LOCATION_LABELS[loc]] as const)}
              value={entry.visibleLocations as string[] | undefined} facultatif={admetLAbsence(noeudDe('visibleLocations')) ?? true}
              onChange={(next) => edit('visibleLocations', next)} />
          </div>
        )}
        {isSymptom && <SymptomTickField value={entry.onTick as import('./StructFields').SymptomTick | undefined} onChange={(v) => edit('onTick', v)} />}
        {isTriggered && <TriggeredEffectsField noeud={noeudDe('effects')} value={entry.effects as TriggeredEffect[] | undefined} onChange={(v) => edit('effects', v)} />}
        {hasConsumable && <TriggeredEffectsField noeud={noeudDe('onHitEffects')} label="effets à la touche de l’arme (onHit → Flow d’ops, ADE II)" value={entry.onHitEffects as TriggeredEffect[] | undefined} onChange={(v) => edit('onHitEffects', v.length ? v : undefined)} />}
        {isManeuver && <ManeuverDefField entry={entry} edit={edit} />}
        {isMutationTable && <MutationTableField domaine={domaineDuDe(deDeLEntree)} value={entry.entries as MutationRange[] | undefined} onChange={(v) => edit('entries', v)} />}
        {isEffectTable && <EffectTableRowsField domaine={domaineDuDe(deDeLEntree)} value={entry.entries as EffectTableRow[] | undefined} onChange={(v) => edit('entries', v)} />}
        {isWeather && <WeatherRangesField domaine={domaineDuDe(deDeLEntree)} value={entry.entries as { min: number; max: number; weather: string }[] | undefined} onChange={(v) => edit('entries', v)} />}
        {hasDerivedWeapon && <WeaponField value={entry.derivedWeapon as ArmeDerivee | undefined} onChange={(v) => edit('derivedWeapon', v)} />}
        {hasConsumable && (
          <div className="ed-field">
            <span>effet d’un CONSOMMABLE (potion/drogue/bandage) — Flow appliqué au buveur (ops, branches, Tests « au boire »)</span>
            <FlowEditor flow={(entry.consumable as Flow | undefined) ?? EMPTY_FLOW} ctx={ctxDeCatalogue('consommable')}
              onChange={(f) => edit('consumable', f.kind === 'sequence' && f.etapes.length === 0 ? undefined : f)} />
          </div>
        )}
        {EVENEMENTS_DE_MER.includes(categoryKey) && (
          <div className="ed-field">
            <span>conséquence de l’événement — Flow joué à bord ou à l’escale (ops du groupe, d’un héros ou du navire, branches, Tests, choix)</span>
            <FlowEditor flow={(entry.consequence as Flow | undefined) ?? EMPTY_FLOW} ctx={ctxDeCatalogue('evenementDeMer')}
              onChange={(f) => edit('consequence', f.kind === 'sequence' && f.etapes.length === 0 ? undefined : f)} />
          </div>
        )}
        {hasConsumable && <ConsumableDurationField value={entry.consumableDuration as ConsumableDuration | undefined} onChange={(v) => edit('consumableDuration', v)} />}
        {isDisease && <SymptomsField value={entry.symptoms as DiseaseSymptom[] | undefined} onChange={(v) => edit('symptoms', v)} />}
        {isDisease && <DiseaseDailyTestField value={entry.dailyTest as DiseaseDailyTest | undefined} onChange={(v) => edit('dailyTest', v)} />}
        {hasCombat && <TalentTestField value={entry.test as TalentTest | undefined} onChange={(v) => edit('test', v)} />}
        {hasCombat && <CombatField value={entry.combat as Partial<CombatFeature> | undefined} allFeatures={src.entries.map((e) => e.combat as Partial<CombatFeature> | undefined)} onChange={(v) => edit('combat', v)} />}
        {variantFields && <VariantsField chemin={chemin('variants')} value={entry.variants as Variant[] | undefined} resolved={variantFields} entryFields={allFields} allFeatures={src.entries.map((e) => e.combat as Partial<CombatFeature> | undefined)} onChange={(v) => edit('variants', v.length ? v : undefined)} />}
        {hasAlsoIn && <AlsoInField chemin={chemin('alsoIn')} value={entry.alsoIn as SecondaryRef[] | undefined} onChange={(v) => edit('alsoIn', v.length ? v : undefined)} />}
        {hasSpecs && <SpecsField value={entry.specs as SpecEntry[] | undefined} onChange={(v) => edit('specs', v)} />}
        {hasAdvancement && <AdvancementRefField ds="skills" label="Compétences" value={entry.skills as AdvancementRef[] | undefined} onChange={(v) => edit('skills', v)} />}
        {hasAdvancement && <AdvancementRefField ds="talents" label="Talents" value={entry.talents as AdvancementRef[] | undefined} onChange={(v) => edit('talents', v)} />}
        {hasTrappings && <TrappingRefField value={entry.trappings as TrappingRef[] | undefined} onChange={(v) => edit('trappings', v)} />}
        {hasCharKeys && <CharKeysField value={entry.characteristics as CharKey[] | undefined} onChange={(v) => edit('characteristics', v)} />}
        {hasStarSub && (
          <PlageField
            label="Sous-tirage"
            domaine={domaineDuDe(starSubDie())}
            optionnelle
            activation="sous-tirage"
            value={entry.sub as PlageValue | undefined}
            onChange={(v) => edit('sub', v)}
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
        {hasDomainEffects && <GenericArrayField chemin={chemin('windModifiers')} noeud={noeudDe('windModifiers')} label="windModifiers (rubrique de Vent — DR par circonstance)" value={entry.windModifiers as Record<string, unknown>[] | undefined} onChange={(v) => edit('windModifiers', v)} />}
        {/* DÉPENSES d'une ressource (`characteristics.options` — Résilience, #1117 geste 5) : tableau
            top-level d'objets homogènes → MÊME éditeur générique que la rubrique de Vent. */}
        {categoryKey === 'characteristics' && <GenericArrayField chemin={chemin('options')} noeud={noeudDe('options')} label="options (dépenses de la ressource — verbatim du Source)" value={entry.options as Record<string, unknown>[] | undefined} onChange={(v) => edit('options', v)} />}
        {/* NADJ 16 l.119 ; NADJ 16 l.111 ; NADJ 16 l.25 ; NADJ 16 l.82 */}
        {categoryKey === 'tavernGames' && (['options', 'table', 'sides', 'specials'] as const).map((champ) => (
          <GenericArrayField key={champ} chemin={chemin(champ)} noeud={noeudDe(champ)} label={metaDeLEntree?.[champ]?.label ?? champ} value={entry[champ] as Record<string, unknown>[] | undefined} onChange={(v) => edit(champ, v.length ? v : undefined)} />
        ))}
        {/* Ornements d'identité d'un bâtiment (#1715) : `{id, anchor}[]` — le nœud porte les libellés des ancrages. */}
        {categoryKey === 'buildings' && <GenericArrayField chemin={chemin('features')} noeud={noeudDe('features')} label="ornements d’identité (décor posé et son ancrage)" value={entry.features as Record<string, unknown>[] | undefined} onChange={(v) => edit('features', v.length ? v : undefined)} />}
        {isCreature && (
          <>
            <TraitListField chemin={chemin('traits')} label="Traits" hint="(LDB 85 — armement « Arme (Épée) +7 », Psychologie « Peur 3 »…)" value={entry.traits as TraitPose[] | undefined} onChange={(v) => edit('traits', v)} />
            <OptionalsListField chemin={chemin('optionals')} label="Traits optionnels" hint="(LDB 76 — proposés au spawn ; notes composées « swap »/« tous les traits » en lecture seule)" value={entry.optionals as OptionalEntry[] | undefined} onChange={(v) => edit('optionals', v)} />
            <HarvestField value={entry.harvest as { rarity: import('../../../data').HarvestRarity; danger: import('../../../data').HarvestDanger; uses: string } | undefined} onChange={(v) => edit('harvest', v)} />
            <LignesFormatLivreField
              label="Compétences"
              hint="(une par ligne, format livre « Compétence (Spéc) Valeur » : « Langue (Magick) 63 », « Savoir (Au choix) 65 », « Métier (Armurier ou Forgeron) 50 », « Esquive 48 » — la valeur est le Test FINAL)"
              value={entry.skills as SkillRef[] | undefined} libelle={skillRefLabel} parse={parseSkillRef}
              onChange={(v) => edit('skills', v)}
            />
          </>
        )}
        {(isCreature || categoryKey === 'pregens') && (
          <LignesFormatLivreField
            label="Talents"
            hint="(un par ligne, format livre « Talent (Spéc) Niveau » : « Magie des Arcanes (Bête) », « Maîtrise du combat 3 », « Lire/Écrire »)"
            value={entry.talents as TalentRef[] | undefined} libelle={talentRefLabel} parse={parseTalentRef}
            onChange={(v) => edit('talents', v)}
          />
        )}
        {isDetails && <DetailsTextsField value={entry.texts as DetailsTexts | undefined} onChange={(v) => edit('texts', v)} />}
        {isTrait && <TraitSchemaField entry={entry} edit={edit} />}
        {isRace && <TraitListField chemin={chemin('traits')} label="Trait racial" hint="(Ogre : encombrance/consommation ×2 ; Taille = talent Massif/Petit)" value={entry.traits as TraitPose[] | undefined} onChange={(v) => edit('traits', v)} />}
        {hasCrewSkills && <SkillSpecListField value={entry.skills as RefDesignee[] | undefined} onChange={(v) => edit('skills', v)} />}
        {hasAxes && <SkillSpecListField hint="compétences contribuant à l'axe (facultatif)" value={entry.skills as RefDesignee[] | undefined} onChange={(v) => edit('skills', v)} />}
        {hasAxes && <TalentSpecListField value={entry.talents as RefDesignee[] | undefined} onChange={(v) => edit('talents', v)} />}
        {hasConsumable && <GenericArrayField chemin={chemin('prosthesisTraining')} noeud={noeudDe('prosthesisTraining')} label="prosthesisTraining (paliers d’entraînement — PX, libellé joueur, tranche rachetée, aspect levé)" value={entry.prosthesisTraining as Record<string, unknown>[] | undefined} onChange={(v) => edit('prosthesisTraining', v.length ? v : undefined)} />}
        {hasProsthesis && <ProsthesisField value={entry.prosthesis as Trauma['prosthesis']} onChange={(v) => edit('prosthesis', v.length ? v : undefined)} />}
        {hasTraumaList && <TraumaListField value={entry.traumas as string[] | undefined} onChange={(v) => edit('traumas', v.length ? v : undefined)} />}
        {hasRestartTest && <RestartTestField value={entry.restart as RestartTest[] | undefined} onChange={(v) => edit('restart', v.length ? v : undefined)} />}
        {hasPonts && <PontsField value={entry.ponts as Ponts | undefined} onChange={(v) => edit('ponts', v)} />}
        {isShipCrit && <ShipCrewHitField value={entry.crewHit as ShipCrewHitValue | undefined} onChange={(v) => edit('crewHit', v)} />}
        {isWaterExposure && <WaterTestField value={entry.test as WaterTest | undefined} onChange={(v) => edit('test', v)} />}
        {isWaterExposure && <WaterModifiersField value={entry.modifiers as WaterExposureModifier[] | undefined} onChange={(v) => edit('modifiers', v)} />}
        {isWaterExposure && <WaterDiseasesField value={entry.diseases as WaterExposureData['diseases']} onChange={(v) => edit('diseases', v)} />}
        {isSeaNavigation && <GenericArrayField chemin={chemin('forcerLeRythme')} noeud={noeudDe('forcerLeRythme')} label="forcerLeRythme (bonus M → difficulté Voile/Rames)" value={entry.forcerLeRythme as Record<string, unknown>[] | undefined} onChange={(v) => edit('forcerLeRythme', v)} />}
        {isSeaPerils && <GenericArrayField chemin={chemin('hazards')} noeud={noeudDe('hazards')} label="hazards (dangers flottants)" value={entry.hazards as Record<string, unknown>[] | undefined} onChange={(v) => edit('hazards', v)} />}
        {isSeaPerils && <GenericArrayField chemin={chemin('detroits')} noeud={noeudDe('detroits')} label="detroits" value={entry.detroits as Record<string, unknown>[] | undefined} onChange={(v) => edit('detroits', v)} />}
        {isSeaPerils && <GenericArrayField chemin={chemin('tourbillons')} noeud={noeudDe('tourbillons')} label="tourbillons" value={entry.tourbillons as Record<string, unknown>[] | undefined} onChange={(v) => edit('tourbillons', v)} />}
        {isSeaPerils && <GenericArrayField chemin={chemin('gestionDesPerils')} noeud={noeudDe('gestionDesPerils')} label="gestionDesPerils" value={entry.gestionDesPerils as Record<string, unknown>[] | undefined} onChange={(v) => edit('gestionDesPerils', v)} />}
        {isSeaWeather && <GenericArrayField chemin={chemin('precipitations')} noeud={noeudDe('precipitations')} label="precipitations" value={entry.precipitations as Record<string, unknown>[] | undefined} onChange={(v) => edit('precipitations', v)} />}
        {isSeaWeather && <GenericArrayField chemin={chemin('temperatures')} noeud={noeudDe('temperatures')} label="temperatures" value={entry.temperatures as Record<string, unknown>[] | undefined} onChange={(v) => edit('temperatures', v)} />}
        {isSeaWeather && <GenericArrayField chemin={chemin('visibilites')} noeud={noeudDe('visibilites')} label="visibilites" value={entry.visibilites as Record<string, unknown>[] | undefined} onChange={(v) => edit('visibilites', v)} />}
        {isSeaWeather && <GenericArrayField chemin={chemin('vents')} noeud={noeudDe('vents')} label="vents" value={entry.vents as Record<string, unknown>[] | undefined} onChange={(v) => edit('vents', v)} />}
        {isDisponibilite && <GenericArrayField chemin={chemin('dispoPct')} noeud={noeudDe('dispoPct')} label="dispoPct (% de Disponibilité par taille de colonie)" value={entry.dispoPct as Record<string, unknown>[] | undefined} onChange={(v) => edit('dispoPct', v)} />}
        {isDisponibilite && <GenericArrayField chemin={chemin('barterRatios')} noeud={noeudDe('barterRatios')} label="barterRatios (Ratios de Troc)" value={entry.barterRatios as Record<string, unknown>[] | undefined} onChange={(v) => edit('barterRatios', v)} />}
        {isArcanePhenomena && <GenericArrayField chemin={chemin('saturationLevels')} noeud={noeudDe('saturationLevels')} label="saturationLevels (Paliers de Saturation)" value={entry.saturationLevels as Record<string, unknown>[] | undefined} onChange={(v) => edit('saturationLevels', v)} />}
        {isArcanePhenomena && <GenericArrayField chemin={chemin('windSaturationEffects')} noeud={noeudDe('windSaturationEffects')} label="windSaturationEffects (Effets de Saturation par Vent)" value={entry.windSaturationEffects as Record<string, unknown>[] | undefined} onChange={(v) => edit('windSaturationEffects', v)} />}
        {isArcanePhenomena && <GenericArrayField chemin={chemin('phenomena')} noeud={noeudDe('phenomena')} label="phenomena (Phénomènes arcaniques)" value={entry.phenomena as Record<string, unknown>[] | undefined} onChange={(v) => edit('phenomena', v)} />}
        {isArcanePhenomena && <GenericArrayField chemin={chemin('tables')} noeud={noeudDe('tables')} label="tables (Tables du chapitre)" value={entry.tables as Record<string, unknown>[] | undefined} onChange={(v) => edit('tables', v)} />}
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
        {isActivity && <GenericArrayField chemin={chemin('testMods')} noeud={noeudDe('testMods')} label="testMods (modificateurs de situation du Test)" value={entry.testMods as Record<string, unknown>[] | undefined} onChange={(v) => edit('testMods', v.length ? v : undefined)} />}
        {isActivity && <GenericArrayField chemin={chemin('worldRolls')} noeud={noeudDe('worldRolls')} label="worldRolls (tirages d’environnement après le Test)" value={entry.worldRolls as Record<string, unknown>[] | undefined} onChange={(v) => edit('worldRolls', v.length ? v : undefined)} />}
        {opsFields.map((fieldKey) => (
          <div className="ed-field" key={fieldKey}>
            <span>{fieldKey} — effet (GameOp[], même éditeur que les modificateurs passifs)</span>
            <GameOpEditor noeud={noeudDe(fieldKey)} ops={(entry[fieldKey] as GameOp[] | undefined) ?? []} onChange={(ops) => edit(fieldKey, ops)} />
          </div>
        ))}
        {fields.map((f) => {
          const cfg = refFieldCfg(categoryKey, f.key);
          return cfg
            ? <RefField key={f.key} cfg={cfg} categoryKey={categoryKey} fieldKey={f.key} label={f.label} nullable={f.nullable} noeud={f.noeud} value={entry[f.key]} onChange={(v) => edit(f.key, v)} />
            : <Field key={f.key} chemin={chemin(f.key)} field={f} value={entry[f.key]} onChange={(v) => edit(f.key, v)} />;
        })}
      </div>
      </SuiviDesSaisies>
    </div>
  );
}

/** Apparence par défaut d'une créature (bloc `appearance`, #1897). */
function AppearanceField({ value, onChange, traits }: { traits?: readonly TraitPose[]; value: EntityAppearance | undefined; onChange: (v: EntityAppearance) => void }) {
  const a = value ?? {};
  return (
    <>
      <div className="ed-field">
        <span>Apparence</span>
        <ReglagesApparence appearance={a} onChange={onChange} reglages={['species', 'sex']} />
        <label className="dr">
          <input type="checkbox" checked={!!a.armurePortee} onChange={(e) => onChange(apparenceSuivante(a, { armurePortee: e.target.checked || undefined }))} />
          {' '}Porter l’armure du profil
        </label>
      </div>
      <ApparencesObjetsField appearance={a} onChange={onChange} weapons={armesDEntite(findTrappingById, undefined, { traits })} />
    </>
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
 *  record `traits.json`/`qualities.json` au save → `noyau/triggeredEffects` les applique en jeu. */
function TriggeredEffectsField({ value, onChange, noeud, label = 'effets déclenchés (déclencheur → Flow d’ops, comme un sort)' }: { value: TriggeredEffect[] | undefined; onChange: (v: TriggeredEffect[]) => void; noeud?: unknown; label?: string }) {
  const ctx = useMemo(() => ({ ...ctxDeCatalogue('declenche'), famille: familleDesEffets(noeud) }), [noeud]);
  const list = value ?? [];
  const set = (i: number, patch: Partial<TriggeredEffect>) => onChange(list.map((e, j) => (j === i ? { ...e, ...patch } : e)));
  const add = () => onChange([...list, { trigger: 'onHit', on: 'victime', flow: EMPTY_FLOW }]);
  const cles = useClesDeRangees(value);
  return (
    <div className="ed-field">
      <span>{label}</span>
      {list.map((eff, i) => (
        <div className="ed-subfield trait-effect" key={cles[i]}>
          <div className="tf-row">
            <label className="dr">Déclencheur
              <select value={eff.trigger} onChange={(e) => set(i, { trigger: e.target.value as EffectTrigger })}>
                {optionsDuNoeud(effectTriggerSchema).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </label>
            <label className="dr">Cible
              <select value={typeof eff.on === 'object' ? ('pick' in eff.on ? 'pick' : 'near') : eff.on}
                onChange={(e) => set(i, { on:
                  e.target.value === 'near' ? { near: 'victime', radiusMeters: 2 }
                  : e.target.value === 'pick' ? { pick: 'engages', sizeAtMost: 'soi', max: 1 }
                  : e.target.value as TriggeredEffect['on'] })}>
                {optionsDuNoeud(effectOnSchema).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                <option value="near">les cibles à portée (zone)</option>
                <option value="pick">un adversaire engagé (sélection)</option>
              </select>
            </label>
            {typeof eff.on === 'object' && 'near' in eff.on && (
              <label className="dr">à ≤ <NumberField variant="nu" label="Rayon de la zone (m)" min={1} width="3.4em" value={eff.on.radiusMeters} onChange={(radiusMeters) => set(i, { on: { near: (eff.on as ZoneDEffet).near, radiusMeters } })} /> m de
              <select value={eff.on.near} onChange={(e) => set(i, { on: { near: e.target.value as ZoneDEffet['near'], radiusMeters: (eff.on as { radiusMeters: number }).radiusMeters } })}>
                <option value="victime">la victime</option>
                <option value="soi">soi</option>
              </select></label>
            )}
            {typeof eff.on === 'object' && 'pick' in eff.on && (
              <label className="dr">max <NumberField variant="nu" label="Nombre maximum de cibles" min={1} width="3.4em" value={eff.on.max} onChange={(max) => set(i, { on: { pick: 'engages', ...((eff.on as SelectionDEffet).sizeAtMost ? { sizeAtMost: 'soi' as const } : {}), max } })} />
              <input type="checkbox" checked={(eff.on as SelectionDEffet).sizeAtMost === 'soi'} onChange={(e) => set(i, { on: { pick: 'engages', ...(e.target.checked ? { sizeAtMost: 'soi' as const } : {}), max: (eff.on as { max: number }).max } })} /> Taille ≤ la sienne</label>
            )}
            <label className="dr" title="RAW « Vous pouvez… » (Contrôle de la Frénésie) : le héros CHOISIT de déclencher (étape de choix en fin de Round) ; l’IA ne l’exerce jamais">
              <input type="checkbox" checked={!!eff.optional} onChange={(e) => set(i, { optional: e.target.checked || undefined })} /> optionnel
            </label>
            <button className="btn small danger" title="Supprimer l’effet" onClick={() => onChange(list.filter((_, j) => j !== i))}>✕</button>
          </div>
          <FlowEditor flow={eff.flow ?? EMPTY_FLOW} ctx={ctx} onChange={(flow) => set(i, { flow })} />
        </div>
      ))}
      <button className="btn small" onClick={add}>+ Effet de trait</button>
    </div>
  );
}

/** Options d'un champ ÉNUMÉRÉ d'un document, lues SUR SON NŒUD (`enumNomme`, #1694) :
 *  l'éditeur dédié d'une manœuvre tire ses `<option>` de la MÊME déclaration que le formulaire
 *  générique et que le Codex — plus aucune table de libellés par valeur ici. */
const optionsDe = (fichier: string, champ: string): [string, string][] => optionsDuNoeud(noeudDuChamp(fichier, champ));

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
        <label className="dr">Coût d’Avantage<NumberField variant="nu" label="Coût d’Avantage" min={0} value={m.coutEnAvantage ?? 0} onChange={(n) => edit('coutEnAvantage', n)} /></label>
        <label className="dr">Avantage
          <select value={m.modeDAvantage ?? 'fixe'} onChange={(e) => edit('modeDAvantage', e.target.value === 'fixe' ? undefined : (e.target.value as ManeuverDef['modeDAvantage']))}>
            {optionsDe('maneuvers.json', 'modeDAvantage').map(([v, l]) => <option key={v} value={v}>{l}</option>)}
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
          <select value={m.ciblage ?? 'melee'} onChange={(e) => edit('ciblage', e.target.value as ManeuverDef['ciblage'])}>
            {optionsDe('maneuvers.json', 'ciblage').map(([v, l]) => <option key={v} value={v}>{l}</option>)}
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
 *  (arg = texte libre). Réutilise les motifs existants (select comme `ManeuverDefField`, checkbox
 *  `.dr`, input `.dr`). Gate `traits` uniquement. */
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
      </div>
    </div>
  );
}

/** Compétences d'un Rôle d'équipage (`crewRoles.skills`, MDG 14, #157) OU d'un axe de forces
 *  (`axes.skills`, #409) : `{id,spec?}[]` — plusieurs Compétences candidates possibles (`hint`
 *  précise la sémantique par appelant : « la meilleure retenue » pour un rôle, dérivation pour un axe). */
function SkillSpecListField({ value, onChange, hint = 'compétences du rôle (au moins une ; « au choix » si plusieurs — la meilleure est retenue)' }: { value: RefDesignee[] | undefined; onChange: (v: RefDesignee[]) => void; hint?: string }) {
  const list = value ?? [];
  const skillOpts = datasetArray('skills') as { id: string; label: string }[];
  const set = (next: typeof list) => onChange(next);
  return (
    <div className="ed-field">
      <span>{hint}</span>
      {list.map((s, i) => (
        <div className="tf-row" key={i}>
          <select value={s.id} onChange={(e) => set(list.map((x, j) => (j === i ? reposerLId(x, e.target.value) : x)))}>
            {!s.id && <option value="">— (choisir une compétence) —</option>}
            {skillOpts.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
          </select>
          <ChoixDeSpec type="skill" id={s.id} value={s.spec} ariaLabel={`Spécialisation — compétence ${i + 1}`} onChange={(spec) => set(list.map((x, j) => (j === i ? { ...x, spec } : x)))} />
          <button className="btn small danger" title="Retirer" onClick={() => set(list.filter((_, j) => j !== i))}>✕</button>
        </div>
      ))}
      <button className="btn small" onClick={() => set([...list, { id: '' }])}>+ Compétence</button>
    </div>
  );
}

/** Talents contribuant à un axe de forces (`axes.talents`, #409) : `{id,spec?}[]` — MÊME patron
 *  que `SkillSpecListField` (Compétences), sur le dataset `talents`. */
function TalentSpecListField({ value, onChange }: { value: RefDesignee[] | undefined; onChange: (v: RefDesignee[]) => void }) {
  const list = value ?? [];
  const talentOpts = datasetArray('talents') as { id: string; label: string }[];
  const set = (next: typeof list) => onChange(next);
  return (
    <div className="ed-field">
      <span>talents contribuant à l'axe (facultatif)</span>
      {list.map((s, i) => (
        <div className="tf-row" key={i}>
          <select value={s.id} onChange={(e) => set(list.map((x, j) => (j === i ? reposerLId(x, e.target.value) : x)))}>
            {!s.id && <option value="">— (choisir un talent) —</option>}
            {talentOpts.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
          </select>
          <ChoixDeSpec type="talent" id={s.id} value={s.spec} ariaLabel={`Spécialisation — talent ${i + 1}`} onChange={(spec) => set(list.map((x, j) => (j === i ? { ...x, spec } : x)))} />
          <button className="btn small danger" title="Retirer" onClick={() => set(list.filter((_, j) => j !== i))}>✕</button>
        </div>
      ))}
      <button className="btn small" onClick={() => set([...list, { id: '' }])}>+ Talent</button>
    </div>
  );
}

/** Prothèses ANNULATRICES d'un Traumatisme (`traumas.prosthesis`, LDB 73, #157) : `{id,cancels}[]`
 *  — un objet porté (jambe de bois, crochet…) qui annule tout ou partie de la séquelle. */
function ProsthesisField({ value, onChange }: { value: Trauma['prosthesis']; onChange: (v: NonNullable<Trauma['prosthesis']>) => void }) {
  const list = value ?? [];
  const trappingOpts = datasetArray('trappings') as { id: string; label: string }[];
  const set = (next: typeof list) => onChange(next);
  return (
    <div className="ed-field">
      <span>prothèses annulatrices (LDB 73) — objet porté qui annule cette séquelle</span>
      {list.map((p, i) => (
        <div className="tf-row" key={i}>
          <select value={p.id} onChange={(e) => set(list.map((x, j) => (j === i ? { ...x, id: e.target.value } : x)))}>
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
      <button className="btn small" onClick={() => set([...list, { id: '', cancels: 'all' }])}>+ Prothèse</button>
    </div>
  );
}

type Ponts = NonNullable<VehicleData['ponts']>;

/** PONTS d'un navire (`vehicles.ponts`, #3686) : une carte box-drawing par pont, du plus bas au plus haut, puis la hauteur
 *  de chaque glyphe de case que les cartes portent (`grilleDesPonts`) — la grille des hauteurs suit les cartes. */
function PontsField({ value, onChange }: { value: Ponts | undefined; onChange: (v: Ponts | undefined) => void }) {
  const [cartes, hauteurs] = value ?? [[], {}];
  const glyphes = [...new Set(grilleDesPonts(cartes).cases.map((c) => c.glyphe))];
  const poser = (suivantes: string[]) => {
    const enUsage = new Set(grilleDesPonts(suivantes).cases.map((c) => c.glyphe));
    onChange(suivantes.length ? [suivantes, Object.fromEntries(Object.entries(hauteurs).filter(([g]) => enUsage.has(g)))] : undefined);
  };
  return (
    <div className="ed-field">
      <span>Ponts — une carte box-drawing par pont, du plus bas au plus haut</span>
      {cartes.map((carte, i) => (
        <div className="tf-row" key={i}>
          <textarea className="json-editor" aria-label={`Pont ${i + 1}`} value={carte} onChange={(e) => poser(cartes.map((c, j) => (j === i ? e.target.value : c)))} />
          <button className="btn small danger" title="Retirer" onClick={() => poser(cartes.filter((_, j) => j !== i))}>✕</button>
        </div>
      ))}
      <button className="btn small" onClick={() => poser([...cartes, ''])}>+ Pont</button>
      {glyphes.length > 0 && (
        <div className="de-grid">
          {glyphes.map((g) => (
            <label key={g} className="de-cell"><span>{g}</span><NumberField variant="nu" label={`Hauteur du glyphe ${g} (m)`} vide value={hauteurs[g] ?? null} onChange={(n) => onChange([cartes, Object.fromEntries(Object.entries({ ...hauteurs, [g]: n }).filter((e): e is [string, number] => e[1] !== null))])} /></label>
          ))}
        </div>
      )}
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

function VariantsField({ chemin, value, resolved, entryFields, allFeatures, onChange }: { chemin: string; value: Variant[] | undefined; resolved: readonly string[]; entryFields: FieldDesc[]; allFeatures: (Partial<CombatFeature> | undefined)[]; onChange: (v: Variant[]) => void }) {
  const list = value ?? [];
  const set = (next: Variant[]) => onChange(next);
  const patch = (i: number, key: string, v: unknown) => set(list.map((x, j) => (j === i ? { ...x, [key]: v } : x)));
  // Champs republiables SANS éditeur bespoke ci-dessous : rendus par le gabarit de l'entrée de base.
  const generic = entryFields.filter((f) => resolved.includes(f.key) && !['desc', 'source', 'combat', 'effects'].includes(f.key));
  const cles = useClesDeRangees(value);
  return (
    <div className="ed-field">
      <span>Variantes selon une règle optionnelle — chacune s'applique quand sa règle est activée</span>
      {list.map((v, i) => (
        <div className="ed-subfield" key={cles[i]}>
          <div className="tf-row">
            <label className="dr">Règle
              <select aria-label={`Règle de la variante ${i + 1}`} value={v.when.rule} onChange={(e) => set(list.map((x, j) => (j === i ? { ...x, when: { ...x.when, rule: OPTIONAL_RULES[e.target.selectedIndex].id } } : x)))}>
                {OPTIONAL_RULES.map((r) => <option key={r.id} value={r.id}>{r.label} — {r.id}</option>)}
              </select>
            </label>
            <label className="dr">Valeur attendue
              <input aria-label={`Valeur attendue de la variante ${i + 1}`} placeholder="défaut : true" value={v.when.equals == null ? '' : String(v.when.equals)}
                onChange={(e) => set(list.map((x, j) => (j === i ? { ...x, when: { ...x.when, equals: coerceRuleValue(e.target.value, OPTIONAL_RULES.find((r) => r.id === x.when.rule)?.kind) } } : x)))} />
            </label>
            <button className="btn small danger" aria-label={`Retirer la variante ${i + 1}`} title={`Retirer la variante ${i + 1}`} onClick={() => set(list.filter((_, j) => j !== i))}>✕</button>
          </div>
          {resolved.includes('desc') && (
            <ProseField label="description (facultatif — sinon celle de l'ancre)" ariaLabel={`Description de la variante ${i + 1}`} value={v.desc ?? ''} onChange={(d) => patch(i, 'desc', d || undefined)} />
          )}
          {resolved.includes('source') && (
            <SourceRefField identite={`${chemin}/${cles[i]}/source`} label="source (facultatif)" facultative sujet={`de la variante ${i + 1}`} value={v.source} onChange={(s) => patch(i, 'source', s)} />
          )}
          {generic.map((f) => <Field key={f.key} chemin={`${chemin}/${cles[i]}/${f.key}`} sujet={`de la variante ${i + 1}`} field={f} value={v[f.key]} onChange={(nv) => patch(i, f.key, nv)} />)}
          {resolved.includes('effects') && <SpellEffectsField value={v.effects as Flow | undefined} onChange={(fl) => patch(i, 'effects', fl)} />}
          {resolved.includes('combat') && <CombatField value={v.combat as Partial<CombatFeature> | undefined} allFeatures={allFeatures} onChange={(c) => patch(i, 'combat', c)} />}
        </div>
      ))}
      <button className="btn small" onClick={() => set([...list, { when: { rule: OPTIONAL_RULES[0].id } }])}>+ Variante</button>
    </div>
  );
}

const DIFFICULTIES = Object.keys(DIFFICULTY_LABELS) as Difficulty[];

type RestartTest = NonNullable<SteamBreakdownEntry['restart']>[number];
type WaterTest = WaterExposureData['test'];
/** Le Test d'une ligne d'éditeur (`flowTestSchema`) : ce qu'il teste et sa Difficulté. */
type TestEdite = Pick<FlowTest, 'skill' | 'characteristic' | 'difficulty'>;

/** Champs d'un Test de donnée (`flowTestSchema`) sur une ligne d'éditeur : Compétence (et Spécialisation)
 *  OU Caractéristique, puis Difficulté — que `difficulteFacultative` laisse vide quand le porteur ne
 *  l'exige pas. */
function ChampsDuTest({ test, index, onChange, difficulteFacultative = false }: { test: TestEdite; index: number; onChange: (patch: Partial<TestEdite>) => void; difficulteFacultative?: boolean }) {
  const skillOpts = datasetArray('skills') as { id: string; label: string }[];
  return (
    <>
      <select value={test.skill?.id ?? ''} onChange={(e) => onChange(e.target.value ? { skill: reposerLId(test.skill ?? { id: '' }, e.target.value), characteristic: undefined } : { skill: undefined })}>
        <option value="">— (Caractéristique) —</option>
        {skillOpts.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
      </select>
      {test.skill
        ? <ChoixDeSpec type="skill" id={test.skill.id} value={test.skill.spec} ariaLabel={`Spécialisation — Test ${index + 1}`} onChange={(spec) => onChange({ skill: { id: test.skill!.id, spec } })} />
        : (
          <select value={test.characteristic ?? ''} onChange={(e) => onChange({ characteristic: (e.target.value || undefined) as CharKey | undefined })}>
            <option value="">— (choisir une Caractéristique) —</option>
            {CHAR_KEYS.map((c) => <option key={c} value={c}>{CHAR_LABELS[c]}</option>)}
          </select>
        )}
      <select value={test.difficulty ?? ''} onChange={(e) => onChange({ difficulty: (e.target.value || undefined) as Difficulty | undefined })}>
        {difficulteFacultative && <option value="">— (aucune) —</option>}
        {DIFFICULTIES.map((d) => <option key={d} value={d}>{DIFFICULTY_LABELS[d]}</option>)}
      </select>
    </>
  );
}

/** Test de REDÉMARRAGE d'un moteur à vapeur (`steamBreakdowns.restart`, MDG 12, #157) :
 *  `{test:{skill?,characteristic?,difficulty},drCible?}[]` — Compétence OU Caractéristique + Difficulté
 *  (+ DR cumulés si Test étendu). */
function RestartTestField({ value, onChange }: { value: RestartTest[] | undefined; onChange: (v: RestartTest[]) => void }) {
  const list = value ?? [];
  const set = (next: typeof list) => onChange(next);
  return (
    <div className="ed-field">
      <span>Test de redémarrage du moteur — Compétence OU Caractéristique + Difficulté (DR cumulés si Test étendu)</span>
      {list.map((r, i) => (
        <div className="tf-row" key={i}>
          <ChampsDuTest test={r.test} index={i} onChange={(patch) => set(list.map((x, j) => (j === i ? { ...x, test: { ...x.test, ...patch, difficulty: patch.difficulty ?? x.test.difficulty } } : x)))} />
          <NumberField variant="nu" label="DR cumulés (étendu)" min={1} placeholder="DR cumulés (étendu)" width={64} vide value={r.drCible} onChange={(n) => set(list.map((x, j) => (j === i ? { ...x, drCible: n ?? undefined } : x)))} />
          <button className="btn small danger" title="Retirer" onClick={() => set(list.filter((_, j) => j !== i))}>✕</button>
        </div>
      ))}
      <button className="btn small" onClick={() => set([...list, { test: { skill: { id: '' }, difficulty: DIFFICULTIES[0] } }])}>+ Test</button>
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
        <select value={v.skill.id} onChange={(e) => onChange({ ...v, skill: reposerLId(v.skill, e.target.value) })}>
          {!v.skill.id && <option value="">— (choisir une compétence) —</option>}
          {skillOpts.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
        </select>
        <ChoixDeSpec type="skill" id={v.skill.id} value={v.skill.spec} ariaLabel="Spécialisation — Test de Résistance" onChange={(spec) => onChange({ ...v, skill: spec ? { id: v.skill.id, spec } : { id: v.skill.id } })} />
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
  const cles = useClesDeRangees(value);
  return (
    <div className="ed-field">
      <span>modificateurs du Test de Résistance (MSRC 16 l.23-47) — cumulables</span>
      {list.map((m, i) => (
        <div className="ed-subfield" key={cles[i]}>
          <div className="tf-row">
            <input placeholder="id" style={{ width: 140 }} value={m.id} onChange={(e) => set(i, { id: e.target.value })} />
            <input placeholder="libellé" value={m.label} onChange={(e) => set(i, { label: e.target.value })} />
            <NumberField variant="nu" label={`Modificateur — ${m.label || m.id || 'sans libellé'}`} width={64} value={m.mod} onChange={(mod) => set(i, { mod })} />
            <select value={m.table} onChange={(e) => set(i, { table: e.target.value as WaterExposureModifier['table'] })}>
              {WATER_TABLE_OPTS.map(([id, l]) => <option key={id} value={id}>{l}</option>)}
            </select>
            <button className="btn small danger" title="Retirer" onClick={() => onChange(list.filter((_, j) => j !== i))}>✕</button>
          </div>
          <EnsembleDeCases nom={`Contextes du modificateur ${i + 1}`} options={WATER_APPLIES_TO_OPTS} value={m.appliesTo}
            facultatif={false} onChange={(appliesTo) => set(i, { appliesTo: appliesTo ?? [] })} />
          <JsonField label="condition automatique (auto — facultatif, dérivée du Combatant)" value={m.auto} onChange={(v) => set(i, { auto: v as WaterExposureModifier['auto'] })} />
        </div>
      ))}
      <button className="btn small" onClick={() => onChange([...list, { id: '', label: '', mod: 0, appliesTo: [], table: 'source-d-eau' }])}>+ Modificateur</button>
    </div>
  );
}

/** Maladies contractées sur Exposition hydrique (`waterExposure.diseases`, MSRC 16 l.49-61) : le dé de la
 *  table (`die`, jet APRÈS échec du Test) et ses plages → maladie référencée par ID (sélecteur, comme
 *  `SkillSpecListField`/`ProsthesisField`/`MutationTableField` — la donnée est un id, jamais un label). */
function WaterDiseasesField({ value, onChange }: { value: WaterExposureData['diseases']; onChange: (v: WaterExposureData['diseases']) => void }) {
  const { die, entries: list } = value;
  const de = deDeLaTableTiree(value);
  const [bas, haut] = [totalDuDe(de, de.n), facesDuDe(de)];
  const libelleDe = formatDice(de);
  const maladieOpts = datasetArray('maladies') as { id: string; label: string }[];
  const poser = (entries: WaterExposureData['diseases']['entries']) => onChange({ die, entries });
  const set = (i: number, patch: Partial<WaterExposureData['diseases']['entries'][number]>) => poser(list.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  return (
    <div className="ed-field">
      <span>maladies contractées — jet {libelleDe} après échec du Test de Résistance (MSRC 16 l.49-61)</span>
      <DeDeTirageField value={die} onChange={(d) => onChange({ die: d, entries: list })} />
      {list.map((r, i) => (
        <div className="tf-row" key={i}>
          <label className="dr">{libelleDe}&nbsp;<NumberField variant="nu" label={`Plage ${libelleDe} — borne basse`} min={bas} max={haut} value={r.min} onChange={(min) => set(i, { min })} />–<NumberField variant="nu" label={`Plage ${libelleDe} — borne haute`} min={bas} max={haut} value={r.max} onChange={(max) => set(i, { max })} /></label>
          <select value={r.disease} onChange={(e) => set(i, { disease: e.target.value })}>
            <option value="">— (choisir une maladie) —</option>
            {maladieOpts.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
          </select>
          <label className="dr"><input type="checkbox" checked={!!r.rerollUnlessWounded} onChange={(e) => set(i, { rerollUnlessWounded: e.target.checked || undefined })} /> relance si indemne</label>
          <button className="btn small danger" title="Retirer" onClick={() => poser(list.filter((_, j) => j !== i))}>✕</button>
        </div>
      ))}
      <button className="btn small" onClick={() => poser([...list, { min: bas, max: bas, disease: '' }])}>+ Maladie</button>
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
const BATTLE_SIDE_OPTIONS = optionsDuNoeud(equipeSchema);

const LIBRE = metaPourFichier('activities.json')!.freeSkill;

/** Tests AU CHOIX d'une Activité (`tests`, LDB 23 l.209 ; AA 12 l.49) : chacun sa Compétence OU
 *  sa Caractéristique, et sa Difficulté. */
function TestsAuChoixField({ value, onChange }: { value: TestEdite[] | undefined; onChange: (v: TestEdite[]) => void }) {
  const list = value ?? [];
  return (
    <div className="ed-subfield">
      {list.map((o, i) => (
        <div className="tf-row" key={i}>
          <ChampsDuTest test={o} index={i} difficulteFacultative onChange={(patch) => onChange(list.map((x, j) => (j === i ? { ...x, ...patch } : x)))} />
          <button className="btn small danger" title="Retirer" onClick={() => onChange(list.filter((_, j) => j !== i))}>✕</button>
        </div>
      ))}
      <button className="btn small" onClick={() => onChange([...list, { skill: { id: '' } }])}>+ Test</button>
    </div>
  );
}

/** Test « posté » d'une Activité : contextes de proposition + Tests « au choix » (le meilleur de l'acteur
 *  est retenu) + compétence libre (`freeSkill`, EDOC 8 l.172) et Difficulté du Test dont la donnée ne
 *  nomme pas le sujet. Vide = Activité SANS Test. */
function ActivityTestField({ entry, edit }: { entry: Entry; edit: (key: string, v: unknown) => void }) {
  return (
    <div className="ed-field">
      <span>contextes où l’Activité est proposable (au moins un)</span>
      <EnsembleDeCases nom="Contextes de l’Activité" options={ACTIVITY_CONTEXTS} value={entry.contexts as ActivityContext[] | undefined}
        facultatif={admetLAbsence(noeudDuChamp('activities.json', 'contexts')) ?? false} onChange={(next) => edit('contexts', next)} />
      <span>Test « posté » — Tests « au choix », chacun avec sa Difficulté (laisser vide = Activité SANS Test)</span>
      <TestsAuChoixField value={entry.tests as TestEdite[] | undefined} onChange={(v) => edit('tests', v.length ? v : undefined)} />
      <SkillSpecListField hint={[LIBRE.label, LIBRE.hint].filter(Boolean).join(' — ')} value={entry.freeSkill as RefDesignee[] | undefined} onChange={(v) => edit('freeSkill', v.length ? v : undefined)} />
      <div className="tf-row">
        <label className="dr">Difficulté (compétence libre ou dérivée)
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
          <select value={o.side ?? ''} onChange={(e) => set(i, { side: (e.target.value || undefined) as Equipe | undefined })}>
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
        <div className="fieldrow" key={i}>
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
 *  ses issues de bataille et ses enchaînements. Maladresse (`on:'maladresse'`) REMPLACE toute autre issue. */
function OutcomeBandsField({ value, onChange }: { value: OutcomeBand[] | undefined; onChange: (v: OutcomeBand[]) => void }) {
  const list = value ?? [];
  const set = (i: number, patch: Partial<OutcomeBand>) => onChange(list.map((b, j) => (j === i ? { ...b, ...patch } : b)));
  const cles = useClesDeRangees(value);
  return (
    <div className="ed-field">
      <span>issues par Degrés de Réussite (bandes DR → résultat) — Maladresse remplace toute autre issue ; sans « issue » la bande matche par DR seul (ACE Annexe I)</span>
      {list.map((b, i) => (
        <div className="ed-subfield" key={cles[i]}>
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
          <ProseField label="note (texte de résultat VERBATIM de la source)" value={b.note ?? ''} onChange={(t) => set(i, { note: t || undefined })} />
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

/** Une plage d'une Table de Corruption : [min,max] → mutation référencée PAR ID (`mutations.ts` :
 *  `BY_ID.get(range.mutation)`). */
interface MutationRange { min: number; max: number; mutation: string; }

/** DOMAINE d'une plage tirée au dé de sa table (`die`) : son nom et ses bornes de saisie — aucun tant
 *  que la chaîne en cours d'édition ne se lit pas (le schéma la refuse à l'enregistrement). */
/** Saisie du DÉ DE TIRAGE d'une table (`deDeTirageSchema`) : une expression illisible n'est pas retenue. */
function DeDeTirageField({ value, onChange }: { value: string; onChange: (die: string) => void }) {
  return (
    <label className="dr">Dé
      <SaisieEnBrouillon
        ariaLabel="Dé de tirage" placeholder="ex. d10, 2d10" value={value} afficher={(d) => d}
        relire={(texte, avant) => (deDeTirageSchema.safeParse(texte.trim()).success ? texte.trim() : avant)}
        onChange={onChange} />
    </label>
  );
}

function domaineDuDe(spec: DiceSpec | null): PlageDomaine {
  return spec ? { nom: formatDice(spec), min: totalDuDe(spec, spec.n), max: totalDuDe(spec, spec.n * spec.sides) } : {};
}

/** Éditeur des PLAGES de Météo d'une saison (`weather.json`) : chaque rangée = un intervalle du dé
 *  `{min, max}` bornes incluses → une Météo (parmi les types connus). La table renvoie la météo dont
 *  l'intervalle CONTIENT le jet (`findTableEntry`) — les deux bornes s'éditent, comme la source les
 *  imprime (EDOC 08 l.52-59), et l'ordre des rangées ne décide plus du tirage. */
function WeatherRangesField({ domaine, value, onChange }: { domaine: PlageDomaine; value: { min: number; max: number; weather: string }[] | undefined; onChange: (v: { min: number; max: number; weather: string }[]) => void }) {
  const list = value ?? [];
  const set = (i: number, patch: Partial<{ min: number; max: number; weather: string }>) => onChange(list.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  return (
    <div className="ed-field">
      <span>plages {domaine.nom ?? 'du dé'} → météo (bornes incluses ; la table renvoie la météo dont l'intervalle contient le jet)</span>
      {list.map((r, i) => (
        <div className="ed-subfield" key={i}>
          <div className="tf-row">
            <label className="dr">{domaine.nom}&nbsp;<NumberField variant="nu" label="Plage — borne basse" min={domaine.min} max={domaine.max} value={r.min} onChange={(min) => set(i, { min })} />–<NumberField variant="nu" label="Plage — borne haute" min={domaine.min} max={domaine.max} value={r.max} onChange={(max) => set(i, { max })} /></label>
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
      <button className="btn small" onClick={() => onChange([...list, { min: domaine.min ?? 1, max: domaine.max ?? 1, weather: 'beau' }])}>+ Plage</button>
    </div>
  );
}

/** Éditeur des PLAGES d'une Table de Corruption (`mutationTables.json`) : chaque rangée = un intervalle du dé
 *  → une mutation (sélecteur id→label, #173 — PAS le datalist par label : la donnée est un id). La table
 *  renvoie la mutation dont l'intervalle contient le jet (`findTableEntry`). DÉCOUPLÉ de la mutation :
 *  plusieurs tables (une par dieu du Chaos, Compagnon T1) peuvent pointer la même mutation à des plages
 *  différentes. */
function MutationTableField({ domaine, value, onChange }: { domaine: PlageDomaine; value: MutationRange[] | undefined; onChange: (v: MutationRange[]) => void }) {
  const list = value ?? [];
  const mutationOpts = datasetArray('mutations') as { id: string; label: string }[];
  const set = (i: number, patch: Partial<MutationRange>) => onChange(list.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  return (
    <div className="ed-field">
      <span>plages {domaine.nom ?? 'du dé'} → mutation (la table renvoie la mutation dont l'intervalle contient le jet)</span>
      {list.map((r, i) => (
        <div className="ed-subfield" key={i}>
          <div className="tf-row">
            <label className="dr">{domaine.nom}&nbsp;<NumberField variant="nu" label="Plage — borne basse" min={domaine.min} max={domaine.max} value={r.min} onChange={(min) => set(i, { min })} />–<NumberField variant="nu" label="Plage — borne haute" min={domaine.min} max={domaine.max} value={r.max} onChange={(max) => set(i, { max })} /></label>
            <select value={r.mutation} onChange={(e) => set(i, { mutation: e.target.value })}>
              <option value="">— (choisir une mutation) —</option>
              {mutationOpts.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
            </select>
            <button className="btn small danger" title="Supprimer la plage" onClick={() => onChange(list.filter((_, j) => j !== i))}>✕</button>
          </div>
        </div>
      ))}
      <button className="btn small" onClick={() => onChange([...list, { min: domaine.min ?? 1, max: domaine.min ?? 1, mutation: '' }])}>+ Plage</button>
    </div>
  );
}

/** Éditeur des RANGÉES d'une table d'effets (`tables.json`) : chaque rangée = un intervalle du dé, la bande
 *  finale ouvrable (`plageOuverteSchema`) → son libellé RAW et ses opérations (`GameOpEditor` commun). La
 *  table applique les opérations de la rangée dont l'intervalle contient le jet (`findTableEntry`). */
function EffectTableRowsField({ domaine, value, onChange }: { domaine: PlageDomaine; value: EffectTableRow[] | undefined; onChange: (v: EffectTableRow[]) => void }) {
  const list = value ?? [];
  const set = (i: number, patch: Partial<EffectTableRow>) => onChange(list.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const cles = useClesDeRangees(value);
  return (
    <div className="ed-field">
      <span>plages {domaine.nom ?? 'du dé'} → opérations (la table applique la rangée dont l'intervalle contient le jet)</span>
      {list.map((r, i) => (
        <div className="ed-subfield" key={cles[i]}>
          <div className="tf-row">
            <PlageField label={`Rangée ${i + 1}`} domaine={domaine} ouvrable value={{ min: r.min ?? domaine.min ?? 1, max: r.max }} onChange={(p) => p && set(i, p)} />
            <label className="dr">Libellé<input aria-label={`Libellé de la rangée ${i + 1}`} value={r.label ?? ''} onChange={(e) => set(i, { label: e.target.value || undefined })} /></label>
            <button className="btn small danger" aria-label={`Retirer la rangée ${i + 1}`} onClick={() => onChange(list.filter((_, j) => j !== i))}>✕</button>
          </div>
          <GameOpEditor ops={r.ops} onChange={(ops) => set(i, { ops })} />
        </div>
      ))}
      <button className="btn small" onClick={() => onChange([...list, { min: domaine.min ?? 1, max: domaine.min ?? 1, ops: [] }])}>+ Plage</button>
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
 *  LoreText au Codex). Réutilise le motif `fieldrow` (rangée + ✕ + « + »). Sort `texts` du repli JSON. */
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
            <ProseField label="global" value={t.all} onChange={(all) => setText(key, { all })} />
            <span className="ed-hint">par espèce</span>
            <Grid min="md" stackBelow={700}>
              {Object.keys(t.bySpecies ?? {}).map((sp) => (
                <div className="ed-field" key={sp}>
                  <div className="fieldrow">
                    <select aria-label={`Espèce de la surcharge — ${DETAIL_TEXT_LABEL[key] ?? key}`} value={sp} onChange={(e) => renameSpecies(key, sp, e.target.value)}>
                      {clesLibres(key, sp).map((k) => <option key={k} value={k}>{k}</option>)}
                    </select>
                    <div className="de-spacer" />
                    <button className="btn small danger" title="Retirer l'espèce" onClick={() => removeSpecies(key, sp)}>✕</button>
                  </div>
                  <ProseField nu label={`Surcharge de l'espèce ${sp} — ${DETAIL_TEXT_LABEL[key] ?? key}`} value={t.bySpecies[sp]} onChange={(txt) => setSpecies(key, sp, txt)} />
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

/** Rendu d'un champ ; une liste de références passe par le mode liste de `RefField` (`cfgDeLaListe`). `sujet` = sa
 *  POSITION dans un conteneur (« de la rangée 2 de windModifiers »), qui complète ses noms accessibles :
 *  deux champs de même libellé, dans deux rangées, ne se confondent pas. */
function Field({ chemin, sujet, field, value, onChange }: { chemin: string; sujet?: string; field: FieldDesc; value: unknown; onChange: (v: unknown) => void }) {
  const { kind, label } = field;
  const nom = sujet ? `${label} ${sujet}` : label;
  const nomPositionne = sujet ? nom : undefined;
  const cfgListe = kind === 'stringList' ? cfgDeLaListe(field.noeud) : undefined;

  const cfgType = cfgDuNoeudType(field.noeud);
  if (cfgType) return <RefField cfg={cfgType} label={label} ariaLabel={nomPositionne} nullable={field.nullable} noeud={field.noeud} value={value} onChange={onChange} />;
  const cfgDId = kind === 'text' ? cfgDeLaFeuille(field.noeud) : undefined;
  if (cfgDId) return <RefField cfg={cfgDId} label={label} ariaLabel={nomPositionne} nullable={field.nullable} noeud={field.noeud} value={value} onChange={onChange} />;
  if (cfgListe) return <RefField cfg={cfgListe} label={label} sujet={sujet} noeud={field.noeud} value={value} onChange={onChange} />;
  if (kind === 'stringList') {
    const list = (value as string[]) ?? [];
    const set = (next: string[]) => onChange(next);
    return (
      <div className="ed-field">
        <span>{label}</span>
        {list.map((item, i) => (
          <div key={i} className="fieldrow">
            <SaisieSuggeree ariaLabel={`${nom} — valeur ${i + 1}`} value={item}
              onChange={(v) => set(list.map((x, j) => (j === i ? v : x)))} />
            <button className="btn small danger" aria-label={`Retirer ${nom} — valeur ${i + 1}`} title={`Retirer ${nom} — valeur ${i + 1}`} onClick={() => set(list.filter((_, j) => j !== i))}>✕</button>
          </div>
        ))}
        <button className="btn small" aria-label={`Ajouter à ${nom}`} onClick={() => set([...list, ''])}>+ Ajouter</button>
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
          <div key={i} className="fieldrow">
            <NumberField variant="nu" label={`${nom} — valeur ${i + 1}`} value={item} onChange={(n) => set(list.map((x, j) => (j === i ? n : x)))} />
            <button className="btn small danger" aria-label={`Retirer ${nom} — valeur ${i + 1}`} title={`Retirer ${nom} — valeur ${i + 1}`} onClick={() => set(list.filter((_, j) => j !== i))}>✕</button>
          </div>
        ))}
        <button className="btn small" aria-label={`Ajouter à ${nom}`} onClick={() => set([...list, 0])}>+ Ajouter</button>
      </div>
    );
  }
  if (kind === 'select' && field.valeurs) {
    // Choix BORNÉ d'un champ énuméré : options ET libellés viennent de son nœud (`enumNomme`) —
    // même `<select>` que les autres choix bornés de l'atelier (`ManeuverDefField` ci-dessus).
    const valeurs = field.valeurs;
    return (
      <label className="ed-field"><span>{label}</span>
        <select aria-label={nomPositionne} value={(value as string) ?? ''} onChange={(e) => onChange(e.target.value || (field.nullable ? videDuNoeud(field.noeud) : e.target.value))}>
          {field.nullable && <option value="">— (aucun)</option>}
          {Object.keys(valeurs).map((v) => <option key={v} value={v}>{valeurs[v]}</option>)}
        </select>
      </label>
    );
  }
  if (kind === 'selectList' && field.valeurs) {
    return (
      <div className="ed-field">
        <span>{label}</span>
        <EnsembleDeCases nom={nom} options={Object.entries(field.valeurs)} value={value as string[] | undefined}
          facultatif={field.nullable} onChange={onChange} />
      </div>
    );
  }
  if (kind === 'textarea')
    return <ProseField label={label} ariaLabel={nomPositionne} value={(value as string) ?? ''} onChange={onChange} />;
  if (kind === 'number')
    return <label className="ed-field"><span>{label}</span><NumberField variant="nu" label={nom} vide value={value as number | null} onChange={(n) => onChange(n ?? (field.nullable ? videDuNoeud(field.noeud) : 0))} /></label>;
  if (kind === 'checkbox')
    return <label className="ed-check"><input type="checkbox" aria-label={nomPositionne} checked={!!value} onChange={(e) => onChange(e.target.checked)} /><span>{label}</span></label>;
  if (kind === 'source') return <SourceRefField identite={chemin} label={label} sujet={sujet} facultative={field.nullable} value={value as SourceRef | undefined} onChange={onChange} />;
  if (kind === 'descRef') {
    return <DescRefField label={label} sujet={sujet} value={value as DescRef | undefined} onChange={onChange as (v: DescRef | undefined) => void} />;
  }
  if (kind === 'recordNumber') {
    const rec = (value as Record<string, number | null>) ?? {};
    const keys = Object.keys(rec);
    return <div className="ed-field"><span>{label}</span>{keys.length === 0 ? <em className="ed-hint">vide</em> : <div className="de-grid">{keys.map((k) => <label key={k} className="de-cell"><span>{k}</span><NumberField variant="nu" label={`${nom} — ${k}`} vide value={rec[k]} onChange={(n) => onChange({ ...rec, [k]: n })} /></label>)}</div>}</div>;
  }
  if (kind === 'recordText') return <RecordTextField label={label} nom={nom} value={value as Record<string, string> | undefined} onChange={onChange} />;
  if (kind === 'object') return <ObjectField chemin={chemin} sujet={sujet} label={label} value={value as Record<string, unknown> | undefined} noeud={field.noeud} onChange={onChange} />;
  if (kind === 'json') {
    // Un tableau d'objets PLATS niché (`vitesseMax.table`, `hazards[].entanglePenalties`… sous un
    // `ObjectField`/`GenericArrayField` récursif, hors du périmètre TOP-LEVEL du garde
    // `no-json-fields.test`) retombe sur le MÊME éditeur générique que les tableaux top-level
    // (`GenericArrayField`) plutôt que `JsonField` — y compris quand CETTE instance vaut `null`/absent
    // (champ optionnel non renseigné sur cette entrée : `GenericArrayField` démarre vide, « + Ajouter »
    // fonctionnel) quand son nœud admet une liste. `JsonField` reste le filet d'une forme hors gabarit
    // (tableau de tableaux, nœud sans contrôle typé).
    if (offreDesRangees(field, value))
      return <GenericArrayField chemin={chemin} sujet={sujet} label={label} value={value as Record<string, unknown>[] | undefined} noeud={field.noeud} onChange={onChange as (v: Record<string, unknown>[]) => void} />;
    return <JsonField label={label} sujet={sujet} value={value} onChange={onChange} />;
  }
  // `fige` : valeur POSÉE par le def — affichée, jamais saisie (un champ ouvert à la frappe dont une
  // seule valeur parse est une affordance qui ment).
  if (field.fige) return <label className="ed-field"><span>{label}</span><input aria-label={nomPositionne} value={(value as string) ?? ''} readOnly /></label>;
  return <label className="ed-field"><span>{label}</span><input aria-label={nomPositionne} value={(value as string) ?? ''} onChange={(e) => onChange(field.nullable && e.target.value === '' ? videDuNoeud(field.noeud) : e.target.value)} /></label>;
}

/** ENSEMBLE de valeurs d'un enum : une case par option, cochée quand la valeur est portée. Une valeur
 *  portée hors des options reste montrée, décochable. Vidé, l'ensemble d'un champ `facultatif` émet
 *  `undefined`. Chaque case est nommée par son option ET par `nom` (qui porte la position). */
function EnsembleDeCases<V extends string>({ nom, options, value, facultatif, onChange }: {
  nom: string;
  options: readonly (readonly [V, string])[];
  value: readonly V[] | undefined;
  facultatif: boolean;
  onChange: (next: V[] | undefined) => void;
}) {
  const cur = value ?? [];
  const connues = new Set(options.map(([v]) => v));
  const toutes = [...options, ...cur.filter((v) => !connues.has(v)).map((v) => [v, `${v} (inconnu)`] as const)];
  const basculer = (v: V) => {
    const next = cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v];
    onChange(next.length || !facultatif ? next : undefined);
  };
  return (
    <div className="tf-row" role="group" aria-label={nom}>
      {toutes.map(([v, l]) => (
        <label className="dr" key={v}><input type="checkbox" aria-label={`${l} — ${nom}`} checked={cur.includes(v)} onChange={() => basculer(v)} /> {l}</label>
      ))}
    </div>
  );
}

/** Record homogène clé→chaîne (couleur par espèce des yeux/cheveux, palette de couleurs d'apparence) :
 *  une rangée par clé (clé renommable + valeur), + ajout/retrait. Clés OUVERTES → un nouveau membre
 *  s'ajoute sans toucher le code. */
function RecordTextField({ label, nom, value, onChange }: { label: string; nom: string; value: Record<string, string> | undefined; onChange: (v: Record<string, string>) => void }) {
  // Les rangées sont tenues ICI : une clé tapée en conflit reste à l'écran telle quelle, sans entrer
  // dans le record. La valeur externe ne les réinitialise que si elle diffère de ce qu'elles retiennent.
  const [etat, setEtat] = useState(() => ({ rangees: versRangees(value ?? {}), value }));
  let rangees = etat.rangees;
  if (etat.value !== value) {
    rangees = memeRecord(value ?? {}, recordDe(etat.rangees)) ? etat.rangees : versRangees(value ?? {});
    setEtat({ rangees, value });
  }
  const poser = (suivantes: readonly RangeeDeRecord[]) => {
    const retenues = retenirLesCles(suivantes);
    const rec = recordDe(retenues);
    const change = !memeRecord(rec, recordDe(rangees));
    setEtat({ rangees: retenues, value: change ? rec : value });
    if (change) onChange(rec);
  };
  const conflits = rangees.map((_, i) => conflitDeCle(rangees, i));
  useSaisieEnCours(conflits.some((c) => c !== null));
  // La rangée est keyed sur son identité STABLE, pas sur la clé qu'elle renomme : frappée lettre à
  // lettre, la clé ne remonte pas sa rangée (le champ garde la main).
  const cles = useClesDeRangees(rangees);
  const base = useId();
  const sansCle = rangees.findIndex((r) => r.saisie === '');
  return (
    <div className="ed-field">
      <span>{label}</span>
      {rangees.map((r, i) => {
        const conflit = conflits[i];
        const message = `${base}-conflit-${i}`;
        return (
          <Fragment key={cles[i]}>
            <div className="fieldrow">
              <input
                aria-label={`${nom} — clé ${i + 1}`} style={{ width: 140 }} value={r.saisie}
                aria-invalid={conflit ? true : undefined} aria-describedby={conflit ? message : undefined}
                onChange={(e) => poser(rangees.map((x, j) => (j === i ? { ...x, saisie: e.target.value } : x)))}
              />
              <input aria-label={`${nom} — valeur ${i + 1}`} value={r.valeur} onChange={(e) => poser(rangees.map((x, j) => (j === i ? { ...x, valeur: e.target.value } : x)))} />
              <button className="btn small danger" aria-label={`Retirer ${nom} — entrée ${i + 1}`} title={`Retirer ${nom} — entrée ${i + 1}`} onClick={() => poser(rangees.filter((_, j) => j !== i))}>✕</button>
            </div>
            {conflit && (
              <span id={message} className="hint" role="status">
                {conflit.vide ? `Clé vide : l'entrée ${i + 1} n'est pas retenue.` : `Clé « ${r.saisie} » déjà portée par l'entrée ${conflit.doublon + 1} : non retenue.`}
                {r.retenue !== null && ` La clé retenue reste « ${r.retenue} ».`}
              </span>
            )}
          </Fragment>
        );
      })}
      <GatedAction
        id={`${base}-ajout`} label="+ Entrée" ariaLabel={`Ajouter une entrée à ${nom}`} primary={false} btnClassName="small"
        enabled={sansCle < 0} reason={`L'entrée ${sansCle + 1} attend sa clé.`}
        onClick={() => poser([...rangees, { saisie: '', retenue: null, valeur: '' }])}
      />
    </div>
  );
}

/** Rangée d'un record de textes : la clé TAPÉE, la clé RETENUE dans le record (`null` = rangée neuve
 *  jamais retenue), et sa valeur. */
type RangeeDeRecord = { saisie: string; retenue: string | null; valeur: string };

const versRangees = (rec: Record<string, string>): RangeeDeRecord[] =>
  Object.entries(rec).map(([k, v]) => ({ saisie: k, retenue: k, valeur: v }));

/** Le record émis : les rangées retenues, dans leur ordre. */
function recordDe(rangees: readonly RangeeDeRecord[]): Record<string, string> {
  const rec: Record<string, string> = {};
  for (const r of rangees) if (r.retenue !== null) rec[r.retenue] = r.valeur;
  return rec;
}

const memeRecord = (a: Record<string, string>, b: Record<string, string>): boolean =>
  JSON.stringify(Object.entries(a)) === JSON.stringify(Object.entries(b));

/** Pourquoi la clé tapée d'une rangée n'est pas retenue : vide, ou déjà retenue par une autre rangée. */
function conflitDeCle(rangees: readonly RangeeDeRecord[], i: number): { vide: true } | { vide?: never; doublon: number } | null {
  const cle = rangees[i].saisie;
  if (cle === '') return { vide: true };
  const doublon = rangees.findIndex((r, j) => j !== i && r.retenue === cle);
  return doublon >= 0 ? { doublon } : null;
}

/** Chaque clé tapée devenue libre est retenue, jusqu'à stabilité (une clé libérée peut en libérer une autre). */
function retenirLesCles(rangees: readonly RangeeDeRecord[]): RangeeDeRecord[] {
  const out = [...rangees];
  for (let change = true; change;) {
    change = false;
    out.forEach((r, i) => {
      if (r.saisie === r.retenue || conflitDeCle(out, i) !== null) return;
      out[i] = { ...r, retenue: r.saisie };
      change = true;
    });
  }
  return out;
}

/** Les champs d'une rangée ou d'un objet que la référence à spécialisation de son nœud (`cfgDuNoeudASpec`)
 *  ne saisit pas déjà : son `id` et sa `spec` passent par `RefField`, ses autres clés par `Field`. */
const horsDeLaRef = (champs: readonly FieldDesc[], aSpec: boolean): readonly FieldDesc[] =>
  aSpec ? champs.filter((f) => f.key !== 'id' && f.key !== 'spec') : champs;

/** Objet de config hétérogène (`interludeEvents.fx`) : SOUS-FORMULAIRE inféré
 *  (récursif) — chaque sous-champ retrouve son kind structuré (number/checkbox/stringList/recordText/…)
 *  via le MÊME `inferFields` + `Field`, sans repli JSON pour les objets plats. Une référence à
 *  spécialisation se choisit par `RefField` (`spec`). */
function ObjectField({ chemin, sujet, label, value, noeud, onChange }: { chemin: string; sujet?: string; label: string; value: Record<string, unknown> | undefined; noeud?: unknown; onChange: (v: Record<string, unknown>) => void }) {
  const obj = value ?? {};
  const objet = useMemo(() => noeudObjet(noeud), [noeud]);
  const cfgSpec = cfgDuNoeudASpec(objet);
  const aSpec = cfgSpec !== undefined;
  // Régime PROFONDEUR (`libelleDuChamp`) : un sous-champ se nomme par la méta de SON nœud objet, jamais
  // par l'enveloppe ; le nœud porte aussi les libellés de VALEURS de ses enums nommés (#1694).
  const subFields = useMemo(() => horsDeLaRef(inferFields([obj], { niveau: 'profondeur', noeud: objet }), aSpec), [obj, objet, aSpec]);
  const laRef = cfgSpec && <RefField cfg={cfgSpec} label={label} sujet={sujet} value={obj} onChange={(v) => onChange(v as Record<string, unknown>)} />;
  if (laRef && !subFields.length) return laRef;
  return (
    <div className="ed-field ed-subform">
      <span>{label}</span>
      <Grid className="ed-champs" min="sm" gap="sm">
        {laRef}
        {subFields.map((f) => (
          <Field key={f.key} chemin={`${chemin}/${f.key}`} sujet={`de ${label}${sujet ? ` ${sujet}` : ''}`} field={f} value={obj[f.key]} onChange={(v) => onChange({ ...obj, [f.key]: v })} />
        ))}
      </Grid>
    </div>
  );
}

/** Tableau de lignes HÉTÉROGÈNES (#422) — une entrée par rangée, colonnes DÉRIVÉES par
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
function GenericArrayField({ chemin, sujet, label, value, noeud, onChange, columns }: { chemin: string; sujet?: string; label: string; value: Record<string, unknown>[] | undefined; noeud?: unknown; onChange: (v: Record<string, unknown>[]) => void; columns?: FieldDesc[] }) {
  const list = value ?? [];
  // Colonnes de PROFONDEUR : même régime que `ObjectField`, nommées par le nœud de rangée.
  const objet = useMemo(() => noeudObjet(noeud), [noeud]);
  const cfgSpec = cfgDuNoeudASpec(objet);
  const selfCols = useMemo(() => inferFields(list, { niveau: 'profondeur', noeud: objet }), [list, objet]);
  const cols = horsDeLaRef(columns ?? selfCols, cfgSpec !== undefined);
  const nestedCols = useMemo(() => {
    const map = new Map<string, FieldDesc[]>();
    for (const f of cols) {
      if (f.kind !== 'json') continue;
      const pool = list.flatMap((r) => (Array.isArray(r[f.key]) ? (r[f.key] as Record<string, unknown>[]) : []));
      if (pool.length && pool.every(estObjet)) map.set(f.key, inferFields(pool, { niveau: 'profondeur', noeud: noeudObjet(f.noeud) }));
    }
    return map;
  }, [list, cols]);
  const setRow = (i: number, key: string, v: unknown) => onChange(list.map((r, j) => (j === i ? { ...r, [key]: v } : r)));
  const cles = useClesDeRangees(value);
  const rangee = (i: number) => `de la rangée ${i + 1} de ${label}${sujet ? ` ${sujet}` : ''}`;
  return (
    <div className="ed-field ed-subform">
      <span>{label}</span>
      {list.map((row, i) => (
        <Grid className="ed-champs" min="sm" gap="sm" key={cles[i]}>
          {cfgSpec && <RefField cfg={cfgSpec} label={label} sujet={`de la rangée ${i + 1}${sujet ? ` ${sujet}` : ''}`} value={row} onChange={(v) => onChange(list.map((r, j) => (j === i ? (v as Record<string, unknown>) : r)))} />}
          {cols.map((f) => nestedCols.has(f.key)
            ? <GenericArrayField key={f.key} chemin={`${chemin}/${cles[i]}/${f.key}`} sujet={rangee(i)} label={f.label} value={(row[f.key] as Record<string, unknown>[] | undefined) ?? []} noeud={f.noeud} columns={nestedCols.get(f.key)} onChange={(v) => setRow(i, f.key, v)} />
            : <Field key={f.key} chemin={`${chemin}/${cles[i]}/${f.key}`} sujet={rangee(i)} field={f} value={row[f.key]} onChange={(v) => setRow(i, f.key, v)} />)}
          <button className="btn small danger" aria-label={`Retirer la rangée ${i + 1} de ${label}${sujet ? ` ${sujet}` : ''}`} onClick={() => onChange(list.filter((_, j) => j !== i))}>✕ Retirer la rangée</button>
        </Grid>
      ))}
      <button className="btn small" aria-label={`Ajouter une rangée à ${label}${sujet ? ` ${sujet}` : ''}`} onClick={() => onChange([...list, {}])}>+ Ajouter</button>
    </div>
  );
}


