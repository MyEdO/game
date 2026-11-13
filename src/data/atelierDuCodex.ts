/**
 * Atelier du Codex, moitié DONNÉE : routes d'édition d'une catégorie, validation d'une entrée éditée
 * et sa TRANSACTION d'enregistrement (#3059). Tout hôte les appelle ; l'écriture disque reste à l'hôte.
 */
import { datasetArray, setDataset, datasetObject, datasetObjectSerializeRoot, setObjectDataset, datasetFile, datasetSerializeRoot, datasetObjectFile, champDEnTete, setEnTete, type DatasetKey, type EcritureDEnTete, type ObjectDatasetKey } from './overrides';
import { CATEGORY_DATASET_DERIVE, OBJECT_CATEGORY_DERIVE } from './schemas/exposition-derivee';
import { validateDataset } from './schemas/validate';
import { serializeDataset } from './serialize';
import { entryKey } from './index';
import { opsMissingRefs } from './refsDOp';

type Entry = Record<string, unknown>;

/** Catégorie Codex → dataset-LISTE éditable, et catégorie Codex → dataset-OBJET : DÉRIVÉS des
 *  déclarations `exposition` des defs de schéma (`src/data/schemas/exposition-derivee.ts`, #1472).
 *  Le cast aux clés d'`overrides` est tenu par `exposition-contrats.test.ts` (routes ⊆ bindings). */
const CATEGORY_DATASET = CATEGORY_DATASET_DERIVE as Record<string, DatasetKey>;
const OBJECT_CATEGORY = OBJECT_CATEGORY_DERIVE as Record<string, { ds: ObjectDatasetKey; mode: 'unique' | 'parCle' }>;
export const editableObjectDataset = (categoryKey: string): { ds: ObjectDatasetKey; mode: 'unique' | 'parCle' } | undefined => OBJECT_CATEGORY[categoryKey];
/** Une catégorie est éditable au Codex ssi elle a un dataset tableau OU un dataset-objet. */
export const editableDataset = (categoryKey: string): DatasetKey | undefined => CATEGORY_DATASET[categoryKey];
export const isEditableCategory = (categoryKey: string): boolean => !!CATEGORY_DATASET[categoryKey] || !!OBJECT_CATEGORY[categoryKey];

/** Champs-réf NICHÉS (une valeur ou une liste, sous un sous-objet/sous-tableau) : garantie de
 *  résolvabilité, décrite par un accesseur PUR `entry → (id|undefined)[]`. #173 : `mutationTables.
 *  entries[].mutation` et `domains.castBonus.perCondition` en sont les 2 sites CONFIRMÉS (un éditeur par
 *  datalist-de-labels y écrivait un libellé, cassant `mutations.ts::rollMutation`/`noyau/combatFlow.ts::
 *  domainCastBonus` au runtime) — ajouter une réf nichée = ajouter SON accesseur ici. `weather.json`
 *  partage la forme `entries[]` mais sa clé est `.weather` (union fermée, pas une réf de dataset) :
 *  l'accesseur `mutation` y est simplement `undefined`, filtré plus bas — aucun faux positif. */
const NESTED_REF_FIELDS: { key: string; ds: DatasetKey; get: (entry: Entry) => (string | undefined)[] }[] = [
  { key: 'entries[].mutation', ds: 'mutations', get: (e) => ((e.entries as { mutation?: string }[] | undefined) ?? []).map((r) => r.mutation) },
  { key: 'castBonus.perCondition', ds: 'etats', get: (e) => [(e.castBonus as { perCondition?: string } | undefined)?.perCondition] },
  { key: 'prosthesis[].id', ds: 'trappings', get: (e) => ((e.prosthesis as { id?: string }[] | undefined) ?? []).map((p) => p.id) },
];

/** Valide une entrée AVANT persist (bouton Enregistrer bloqué tant que non vide) : identité
 *  (id non vide + unique, libellé non vide) + refs NICHÉES résolvables (`NESTED_REF_FIELDS`) ; une référence
 *  d'un champ typé par la grammaire (`idDe`, `refs`) se juge au parse de la racine (`racineValidee`). PUR. `selfIndex` = position de l'entrée éditée dans `entries` (−1 pour une création). */
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
      if (typeof v !== 'string') out.push(`${champ} : un choix (kind « mode ») vaut une des valeurs proposées`);
      else if (options.length > 0 && !options.includes(v)) out.push(`${champ} : « ${v} » n'est pas une des valeurs proposées (${options.join(', ')})`);
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

/** Échantillons pour `inferFields` d'une catégorie éditable (tableau d'entités, objet unique, ou
 *  valeurs d'un Record keyé). SOURCE UNIQUE des champs inférés — utilisée par `CodexEdit` ET le
 *  garde-fou no-json-fields.test (pas de duplication de la logique de projection). */
export function editableEntries(categoryKey: string): Entry[] {
  const obj = editableObjectDataset(categoryKey);
  if (obj) {
    const data = datasetObject(obj.ds) as Record<string, unknown>;
    if (obj.mode === 'unique') return [data as Entry];
    const entries = Object.values(data) as Entry[];
    return entries.length ? entries : [{}];
  }
  return datasetArray(editableDataset(categoryKey)!) as Entry[];
}

/** Issue d'un enregistrement : le fichier du dataset et sa source entière sérialisée, ou les refus. */
export type Enregistrement = { ok: true; fichier: string; texte: string } | { ok: false; erreurs: string[] };

/**
 * Enregistre `entry` dans le dataset de `categoryKey` (#176, #1530) : à la position `index` d'un
 * dataset-liste (`-1` l'ajoute), en fusion d'un dataset-objet ; `enTete`, posé, écrit des champs de
 * l'EN-TÊTE de sa collection (`setEnTete`, #1667) dans la MÊME transaction. Refuse sans rien poser une
 * entrée que `validateEntry` refuse ; sinon la pose, valide la racine sérialisée contre son schéma et, au
 * refus, REPREND l'état d'avant, entrée et en-tête. Le texte rendu est la forme disque de la source entière.
 */
export function enregistrerEntree(categoryKey: string, entry: Entry, index: number, enTete: readonly EcritureDEnTete[] = []): Enregistrement {
  const obj = editableObjectDataset(categoryKey);
  if (obj) {
    const avant = structuredClone(datasetObject(obj.ds));
    setObjectDataset(obj.ds, entry as never);
    const root = datasetObjectSerializeRoot(obj.ds);
    return racineValidee(datasetObjectFile(obj.ds), root, () => setObjectDataset(obj.ds, avant as never));
  }
  const ds = editableDataset(categoryKey)!;
  const entries = datasetArray(ds) as Entry[];
  const erreurs = validateEntry(categoryKey, entry, entries, index);
  if (erreurs.length) return { ok: false, erreurs };
  const avant = entries.slice();
  const enTeteAvant = enTete.map((e) => ({ ...e, valeur: champDEnTete(ds, e.ancetre, e.champ) }));
  setEnTete(ds, enTete);
  setDataset(ds, (index < 0 ? [...entries, entry] : entries.map((x, i) => (i === index ? entry : x))) as never);
  return racineValidee(datasetFile(ds), datasetSerializeRoot(ds), () => {
    setDataset(ds, avant as never);
    setEnTete(ds, enTeteAvant);
  });
}

/** La racine posée, validée contre le schéma de `fichier` ; `reprendre` restaure l'état d'avant au refus. */
function racineValidee(fichier: string, root: unknown, reprendre: () => void): Enregistrement {
  const refus = validateDataset(fichier, root);
  if (refus) { reprendre(); return { ok: false, erreurs: refus.split('\n') }; }
  return { ok: true, fichier, texte: serializeDataset(root) };
}
