/**
 * Atelier du Codex, moitié DONNÉE : routes d'édition d'une catégorie, validation d'une entrée éditée, ce qui la
 * désigne, et ses TRANSACTIONS d'enregistrement et de suppression (#3059, #4020). Tout hôte les appelle ; l'écriture
 * disque reste à l'hôte.
 */
import {
  entreesDuDataset,
  setDataset,
  datasetObject,
  datasetObjectSerializeRoot,
  setObjectDataset,
  datasetFile,
  datasetSerializeRoot,
  datasetObjectFile,
  champDEnTete,
  setEnTete,
  type DatasetKey,
  type EcritureDEnTete,
  type ObjectDatasetKey,
} from './overrides';
import { CATEGORY_DATASET_DERIVE, OBJECT_CATEGORY_DERIVE } from './schemas/exposition-derivee';
import { cheminLisible, lieuDe, schemaForFile, validateDataset } from './schemas/validate';
import { RACINES_VIVANTES } from './schemas/_racines-vivantes.generated';
import { DATASET_DE_LA_CATEGORIE, DATASET_DE_L_ESPACE } from './schemas/_cles-de-dataset.generated';
import { suivreLeChemin } from './schemas/grammaire/cle-d-espace';
import { reperesDuParse, TYPES, type CibleDeReference } from './schemas/grammaire/ref';
import { projetSchema } from './schemas/defs-scenes/projet';
import { versDisque } from './schemas/grammaire/prose';
import { versionDesDatasets } from './versionDataset';
import { serializeDataset } from './serialize';
import { entryKey } from './index';
import { opsMissingRefs } from './refsDOp';
import { ecartsDeLaRegle } from './schemas/defs/reglesOptionnelles';
import { estObjet } from '../lib/objet.mjs';

type Entry = Record<string, unknown>;

/** Catégorie Codex → dataset-LISTE éditable, et catégorie Codex → dataset-OBJET : DÉRIVÉS des
 *  déclarations `exposition` des defs de schéma (`src/data/schemas/exposition-derivee.ts`, #1472).
 *  Le cast aux clés d'`overrides` est tenu par `exposition-contrats.test.ts` (routes ⊆ bindings). */
const CATEGORY_DATASET = CATEGORY_DATASET_DERIVE as Record<string, DatasetKey>;
const OBJECT_CATEGORY = OBJECT_CATEGORY_DERIVE as Record<string, { ds: ObjectDatasetKey }>;
export const editableObjectDataset = (categoryKey: string): { ds: ObjectDatasetKey } | undefined => OBJECT_CATEGORY[categoryKey];
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
    const known = new Set(entreesDuDataset(ds).map((e) => e.id).filter(Boolean));
    for (const id of get(entry)) {
      if (id == null) continue;
      if (id === '') errors.push(`${key} : réf à choisir (${ds})`);
      else if (!known.has(id)) errors.push(`${key} : réf « ${id} » introuvable (${ds})`);
    }
  }
  // Ops MÉCANIQUES portées par l'entrée (`passive`, `effects`, `ops`, rangées de table…) : une réf de
  // registre REQUISE non élue rend l'op inapplicable — source unique `OP_REF_FIELDS`.
  errors.push(...opsMissingRefs(entry));
  if (categoryKey === 'reglesOptionnelles') errors.push(...ecartsDeLaRegle(entry));
  return errors;
}


/** Échantillons pour `inferFields` d'une catégorie éditable (tableau d'entités, ou objet unique). SOURCE UNIQUE des champs inférés — utilisée par `CodexEdit` ET le
 *  garde-fou no-json-fields.test (pas de duplication de la logique de projection). */
export function editableEntries(categoryKey: string): Entry[] {
  const obj = editableObjectDataset(categoryKey);
  if (obj) return [datasetObject(obj.ds)].filter(estObjet);
  return entreesDuDataset(editableDataset(categoryKey)!);
}

/** Issue d'un enregistrement : le fichier du dataset, sa source entière sérialisée après lui et avant lui, et la reprise
 *  qui remet la donnée en mémoire telle qu'avant lui (l'écriture au disque refusée) ; ou les refus. */
export type Enregistrement = { ok: true; fichier: string; texte: string; avant: string; reprendre: () => void } | { ok: false; erreurs: string[] };

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
    const texteAvant = serializeDataset(datasetObjectSerializeRoot(obj.ds));
    setObjectDataset(obj.ds, entry as never);
    const root = datasetObjectSerializeRoot(obj.ds);
    return racineValidee(datasetObjectFile(obj.ds), root, texteAvant, () => setObjectDataset(obj.ds, avant as never));
  }
  const ds = editableDataset(categoryKey)!;
  const entries = entreesDuDataset(ds);
  const erreurs = validateEntry(categoryKey, entry, entries, index);
  if (erreurs.length) return { ok: false, erreurs };
  const avant = entries.slice();
  const texteAvant = serializeDataset(datasetSerializeRoot(ds));
  const enTeteAvant = enTete.map((e) => ({ ...e, valeur: champDEnTete(ds, e.ancetre, e.champ) }));
  setEnTete(ds, enTete);
  setDataset(ds, (index < 0 ? [...entries, entry] : entries.map((x, i) => (i === index ? entry : x))) as never);
  return racineValidee(datasetFile(ds), datasetSerializeRoot(ds), texteAvant, () => {
    setDataset(ds, avant as never);
    setEnTete(ds, enTeteAvant);
  });
}

/** Un paquet de campagne que le jeu embarque, en forme disque (`projetSchema`), sous le nom de son fichier. La
 *  couche donnée ne lit pas `src/scenes` (`COUCHES`) : l'hôte les lui passe. */
export interface PaquetLu {
  readonly fichier: string;
  readonly projet: unknown;
}

/** Une occurrence d'un id dans un document : le document qui la porte, son schéma et son chemin. */
interface Designation {
  readonly fichier: string;
  readonly schema: unknown;
  readonly document: unknown;
  readonly chemin: readonly (string | number)[];
}

/** Les occurrences d'ids de `src/data` et des paquets : les références typées, par `cleDeReference`, et toute autre
 *  chaîne, par sa valeur. */
interface IndexDesReferences {
  readonly typees: ReadonlyMap<string, readonly Designation[]>;
  readonly chaines: ReadonlyMap<string, readonly Designation[]>;
}

/** Le dernier index des références (`indexDesReferences`), avec la version des datasets et les paquets qu'il a lus. */
let dernierIndex: { generation: number; paquets: readonly PaquetLu[]; index: IndexDesReferences } | undefined;

/** La clé d'index d'une référence : sa cible et l'id désigné. */
const cleDeReference = (type: CibleDeReference, id: string): string => `${type}|${id}`;

/** `occurrence` rangée sous `cle` dans `index`. */
function ranger(index: Map<string, Designation[]>, cle: string, occurrence: Designation): void {
  const deja = index.get(cle);
  if (deja) deja.push(occurrence);
  else index.set(cle, [occurrence]);
}

/** Les entrées vivantes de chaque collection de dataset (`DATASET_DE_LA_CATEGORIE`) : leur `id` est leur clé
 *  d'identité, jamais une occurrence. */
function entreesDesCollections(): ReadonlySet<unknown> {
  const entrees = new Set<unknown>();
  for (const d of Object.values(DATASET_DE_LA_CATEGORIE)) {
    const collection = suivreLeChemin(RACINES_VIVANTES[d.fichier], d.chemin);
    if (Array.isArray(collection)) for (const e of collection) entrees.add(e);
  }
  return entrees;
}

/**
 * Les occurrences d'ids de chaque racine vivante (`RACINES_VIVANTES`) et de chaque paquet `paquets`, sur leur forme
 * disque (`versDisque`) : chaque référence typée mesurée au parse (`reperesDuParse`), par `cleDeReference` (la valeur
 * au chemin du repère, ou la clé de record qui la porte, `parCle`) ; et toute autre chaîne, par sa valeur (#4020,
 * `.claude/rules/donnees.md`), hors de la clé d'identité d'une entrée de collection (`entreesDesCollections`) et des
 * chemins qu'une référence typée attribue à son espace. Relu après toute écriture au seam (`versionDesDatasets`) ou
 * d'autres paquets.
 */
function indexDesReferences(paquets: readonly PaquetLu[]): IndexDesReferences {
  const version = versionDesDatasets();
  if (dernierIndex?.generation === version && dernierIndex.paquets === paquets) return dernierIndex.index;
  const typees = new Map<string, Designation[]>();
  const chaines = new Map<string, Designation[]>();
  const identites = entreesDesCollections();
  const lire = (fichier: string, schema: unknown, document: unknown) => {
    const cheminsTypes = new Set<string>();
    for (const r of reperesDuParse(schema as Parameters<typeof reperesDuParse>[0], versDisque(document))) {
      const chemin = r.path as readonly (string | number)[];
      const id = r.parCle ? chemin[chemin.length - 1] : chemin.reduce<unknown>((o, pas) => (o as Record<string | number, unknown>)[pas], document);
      if (!r.parCle) cheminsTypes.add(JSON.stringify(chemin));
      if (typeof id === 'string') ranger(typees, cleDeReference(r.type, id), { fichier, schema, document, chemin });
    }
    const parcourir = (valeur: unknown, chemin: (string | number)[]): void => {
      if (typeof valeur === 'string') {
        if (!cheminsTypes.has(JSON.stringify(chemin))) ranger(chaines, valeur, { fichier, schema, document, chemin });
      } else if (Array.isArray(valeur)) valeur.forEach((v, i) => parcourir(v, [...chemin, i]));
      else if (estObjet(valeur)) {
        for (const [cle, v] of Object.entries(valeur)) {
          if ((cle === 'desc' && 'descRef' in valeur) || (cle === 'id' && identites.has(valeur))) continue;
          parcourir(v, [...chemin, cle]);
        }
      }
    };
    parcourir(document, []);
  };
  for (const [fichier, racine] of Object.entries(RACINES_VIVANTES)) lire(fichier, schemaForFile(fichier), racine);
  for (const { fichier, projet } of paquets) lire(fichier, projetSchema, projet);
  const index = { typees, chaines };
  dernierIndex = { generation: version, paquets, index };
  return index;
}

/** Les types de référence (`TYPES`) dont l'espace est porté par le dataset-liste de la catégorie `categoryKey`
 *  (`DATASET_DE_L_ESPACE`). */
function typesDeLaCategorie(categoryKey: string): readonly CibleDeReference[] {
  const ds = editableDataset(categoryKey);
  const espaces = Object.keys(DATASET_DE_L_ESPACE).filter((e) => DATASET_DE_L_ESPACE[e].cle === ds);
  return (Object.keys(TYPES) as (keyof typeof TYPES)[]).filter((t) => espaces.includes(TYPES[t].espace));
}

/** Le chemin `chemin` du document `document` traverse-t-il l'objet `entree` ? */
const traverse = (document: unknown, chemin: readonly (string | number)[], entree: unknown): boolean => {
  let noeud = document;
  for (const pas of chemin) {
    if (noeud === entree) return true;
    noeud = estObjet(noeud) || Array.isArray(noeud) ? (noeud as Record<string | number, unknown>)[pas] : undefined;
  }
  return noeud === entree;
};

/** Qui désigne l'entrée `id` de la catégorie `categoryKey` dans `src/data` et dans les paquets `paquets`
 *  (`indexDesReferences`) : une référence typée de son espace, ou une chaîne égale à `id` qu'aucune référence typée
 *  n'attribue à un autre espace, hors de l'entrée elle-même ; chaque désignation dite « fichier › chemin »
 *  (`cheminLisible`). Une collision d'ids entre espaces non typés désigne : la suppression se refuse. Aucune pour un
 *  dataset-objet, qu'aucune référence ne vise. */
export function designations(categoryKey: string, id: string, paquets: readonly PaquetLu[]): string[] {
  const ds = editableDataset(categoryKey);
  if (!ds) return [];
  const entree = entreesDuDataset(ds).find((e) => e.id === id);
  const { typees, chaines } = indexDesReferences(paquets);
  return [...typesDeLaCategorie(categoryKey).flatMap((type) => typees.get(cleDeReference(type, id)) ?? []), ...(chaines.get(id) ?? [])]
    .filter((d) => entree === undefined || !traverse(d.document, d.chemin, entree))
    .map((d) => `${d.fichier} › ${cheminLisible(lieuDe(d.schema, d.document, d.chemin))}`);
}

/**
 * Retire l'entrée au rang `index` du dataset-liste de `categoryKey` (#4020), même transaction qu'`enregistrerEntree` :
 * refuse sans rien poser une entrée que d'autres désignent (`designations`, sur les paquets `paquets`), ou une
 * catégorie qui n'est pas un dataset-liste ; sinon la retire, valide la racine sérialisée contre son schéma et, au
 * refus, REPREND l'état d'avant. Le texte rendu est la forme disque de la source entière.
 */
export function supprimerEntree(categoryKey: string, index: number, paquets: readonly PaquetLu[]): Enregistrement {
  const ds = editableDataset(categoryKey);
  if (!ds) return { ok: false, erreurs: [`« ${categoryKey} » n’est pas une liste d’entrées : rien ne s’y supprime`] };
  const entries = entreesDuDataset(ds);
  const entree = entries[index];
  if (!entree) return { ok: false, erreurs: [`aucune entrée au rang ${index}`] };
  const designee = typeof entree.id === 'string' ? designations(categoryKey, entree.id, paquets) : [];
  if (designee.length) return { ok: false, erreurs: designee.map((d) => `désignée par ${d}`) };
  const avant = entries.slice();
  const texteAvant = serializeDataset(datasetSerializeRoot(ds));
  setDataset(ds, entries.filter((_, i) => i !== index) as never);
  return racineValidee(datasetFile(ds), datasetSerializeRoot(ds), texteAvant, () => setDataset(ds, avant as never));
}

/** La racine posée, validée contre le schéma de `fichier`, le texte de sa source d'avant `avant` ; `reprendre` restaure
 *  l'état d'avant, au refus, et se rend avec l'issue acceptée. */
function racineValidee(fichier: string, root: unknown, avant: string, reprendre: () => void): Enregistrement {
  const refus = validateDataset(fichier, root);
  if (refus) { reprendre(); return { ok: false, erreurs: refus.split('\n') }; }
  return { ok: true, fichier, texte: serializeDataset(root), avant, reprendre };
}
