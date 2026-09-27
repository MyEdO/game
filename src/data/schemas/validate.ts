/**
 * Validation d'un document authoré contre son schéma zod — SOURCE UNIQUE, DEUX portes :
 *  - `validateDataset(file, value)` : porte par FICHIER, pour qui connaît le nom du document —
 *    contrat CI (`schema-contract.test.ts`), sauvegarde éditeur/Compendium (`CodexEdit.save`),
 *    chargement DEV (`dev-validate.ts`), garde de pré-commit (`scripts/guards/validate-data.mts`).
 *    Le registre couvre les DEUX racines (`src/data` par basename, `src/scenes` par chemin relatif).
 *  - `validateDocument(schema, value)` : porte par SCHÉMA, pour un seam qui n'a PAS de nom de
 *    fichier — `parseProject` sert du JSON committé, du localStorage et de l'import utilisateur.
 * Le format d'une faute a UNE source (`rapportDeFautes`) : `validateDataset` en dérive pour la porte
 * par fichier, `validateDocument` rend les fautes elles-mêmes (`Faute`). credo.md:7, 2ᵉ phrase.
 * Le LIEU d'une faute a UNE source aussi (`fautesDe`) : un élément d'une LISTE à clé (`grammaire/collection-cle.ts`) s'y
 * nomme par sa clé, lue sur la valeur ; aucun message de schéma ne nomme son propre emplacement.
 */
import type { z } from 'zod';
import { SCHEMA_DEFS } from './_registry.generated';
import { SCHEMA_DEFS_SCENES } from './_registry-scenes.generated';
import type { SchemaDef } from './types';
import { coDescendre, descendre, enfantsDe } from './grammaire/descente';
import { collectionDe } from './grammaire/collection-cle';
import { valeursDe, type MetaChamp } from './grammaire/meta';

/** Le registre des DEUX racines de documents (`src/data` + `src/scenes`). */
export const DEFS_DE_DOCUMENT: readonly SchemaDef[] = [...SCHEMA_DEFS, ...SCHEMA_DEFS_SCENES];

/** Un ÉLÉMENT de liste à clé, nommé par la valeur de sa clé (`cle`) et, s'il en porte un, par son
 *  `label` (`libelle`) ; `liste` = le champ qui porte la liste (`''` pour une liste racine). */
export type ElementDeLieu = { readonly liste: string; readonly cle: string; readonly libelle?: string };
/** Un segment du LIEU d'une faute : un champ, un rang de liste sans clé, ou un élément à clé. */
export type SegmentDeLieu = string | number | ElementDeLieu;

/** Une FAUTE d'un document refusé, telle que zod la trouve : son chemin BRUT (pour les machines), son
 *  LIEU (pour l'auteur), son message (jamais reformulé) et son code. Type SANS zod : une surface lit
 *  les fautes sans importer le validateur. */
export type Faute = {
  readonly chemin: readonly (string | number)[];
  readonly lieu: readonly SegmentDeLieu[];
  readonly message: string;
  readonly code: string;
};

const estObjet = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object';

/** Le LIEU d'un chemin, par la CO-DESCENTE du schéma et de la valeur (`coDescendre`), élaguée hors du
 *  chemin : un rang dans une liste à clé devient l'élément nommé par sa clé (lue sur la valeur), le
 *  champ qui porte la liste s'y fond ; au-delà du dernier point atteint, les segments restent bruts. */
function lieuDe(schema: unknown, valeur: unknown, chemin: readonly (string | number)[]): SegmentDeLieu[] {
  const lieu: SegmentDeLieu[] = [];
  let atteint = 0;
  coDescendre(schema, valeur, (p) => {
    const n = p.chemin.length;
    if (n === 0) return chemin.length === 0 ? 'arreter' : undefined;
    const segment = chemin[n - 1];
    if (n > chemin.length || p.chemin[n - 1] !== segment) return 'elaguer';
    const marque = typeof segment === 'number' ? p.parent!.noeuds.map(collectionDe).find((m) => m !== undefined) : undefined;
    const cle = marque?.forme === 'liste' ? marque.de(p.valeur) : undefined;
    if (cle === undefined) lieu.push(segment);
    else {
      const precedent = lieu[lieu.length - 1];
      const liste = typeof precedent === 'string' ? precedent : '';
      if (typeof precedent === 'string') lieu.pop();
      const libelle = estObjet(p.valeur) && typeof p.valeur.label === 'string' ? p.valeur.label : undefined;
      lieu.push(libelle === undefined ? { liste, cle } : { liste, cle, libelle });
    }
    atteint = n;
    return n === chemin.length ? 'arreter' : undefined;
  });
  lieu.push(...chemin.slice(atteint));
  return lieu;
}

/** Les fautes de `valeur` refusée par `schema` (son `ZodError`), dans l'ordre de ses `issues`. */
function fautesDe(schema: unknown, valeur: unknown, error: z.ZodError): readonly Faute[] {
  return error.issues.map((iss) => {
    const chemin = iss.path.map((k) => (typeof k === 'number' ? k : String(k)));
    return { chemin, lieu: lieuDe(schema, valeur, chemin), message: iss.message, code: iss.code };
  });
}

/** Le LIEU d'une faute tel que l'auteur le lit : les champs joints par `.`, un élément à clé écrit
 *  `liste « clé »`, les deux séparés par ` › ` — `scenes « arene » › entities « p-1 » › ref`,
 *  `(racine)` si vide. `nom` choisit ce qui nomme l'élément (la clé par défaut, stable). */
export function cheminLisible(
  lieu: readonly SegmentDeLieu[],
  nom: (element: ElementDeLieu) => string = (element) => element.cle,
): string {
  const parties: string[] = [];
  let champs: (string | number)[] = [];
  for (const segment of lieu) {
    if (typeof segment !== 'object') {
      champs.push(segment);
      continue;
    }
    if (champs.length) parties.push(champs.join('.'));
    champs = [];
    parties.push(segment.liste ? `${segment.liste} « ${nom(segment)} »` : `« ${nom(segment)} »`);
  }
  if (champs.length) parties.push(champs.join('.'));
  return parties.join(' › ') || '(racine)';
}

/** Rapport ACTIONNABLE d'une liste de fautes : `<sujet> — …` puis une puce `<lieu>: <message>` par faute. */
export function rapportDeFautes(sujet: string, fautes: readonly Faute[]): string {
  const lines = fautes.map((f) => `  - ${cheminLisible(f.lieu)}: ${f.message}`);
  return `${sujet} — JSON invalide contre son schéma :\n${lines.join('\n')}`;
}

/** Schéma zod d'un document par nom de fichier (`characteristics.json`, `arene/arene-projet.json`),
 *  ou undefined s'il n'est pas registré. */
export function schemaForFile(file: string): z.ZodType | undefined {
  return DEFS_DE_DOCUMENT.find((d) => d.file === file)?.schema;
}

/** Méta d'ÉDITION d'un document par nom de fichier — le canal registre est le SEUL chemin
 *  schéma→atelier (`src/ui/compendium/editFields.ts`). `undefined` pour un def qui ne passe pas par
 *  `document()` ; adoption par def : lot L1b #1467. */
export function metaPourFichier(file: string): Readonly<Record<string, MetaChamp>> | undefined {
  return DEFS_DE_DOCUMENT.find((d) => d.file === file)?.meta;
}

/**
 * NŒUD OBJET sous un nœud quelconque — le premier nœud à `shape` atteint par la descente
 * (`descendre`, `grammaire/descente.ts`, largeur d'abord, visite unique par identité : le plus PROCHE) à travers
 * l'emballage de famille, le sceau et les enveloppes (`z.array`, `.pipe`, refines, `optional`, `lazy`).
 * C'est le seul chemin schéma→atelier vers les NŒUDS d'un document scellé, à TOUTE profondeur : la
 * méta publiée ne porte que le libellé du CHAMP, celui de ses VALEURS vit sur le nœud (`enumNomme`,
 * #1694).
 */
export function noeudObjet(schema: unknown): unknown {
  let trouve: unknown;
  descendre([schema], ({ noeud, def }) => {
    if (def.type !== 'object') return;
    trouve = noeud;
    return 'arreter';
  });
  return trouve;
}

/** NŒUD zod d'un champ de PREMIER NIVEAU d'un document (`undefined` hors registre, ou si le document
 *  ne porte pas ce champ) — porte de lecture des libellés de valeurs (`valeursDe`/`libelleDeValeur`). */
export function noeudDuChamp(file: string, champ: string): unknown {
  const entree = noeudObjet(schemaForFile(file));
  return entree ? enfantsDe(entree).find((e) => e.cle === champ)?.noeud : undefined;
}

/** CHARGE d'une entrée d'un document DISCRIMINÉ : le champ discriminant, les clés que porte le CAS de
 *  cette entrée, et l'union de toutes les clés discriminées du document. */
export interface ChargeDiscriminee {
  readonly champ: string;
  readonly duCas: readonly string[];
  readonly toutes: readonly string[];
}

/** Champ DISCRIMINANT d'un document et sa CHARGE par valeur : les paramètres `discriminant` et
 *  `chargeParDiscriminant` de l'`espace` de la marque de sa racine (`grammaire/collection-cle.ts`),
 *  `undefined` sans eux. */
function partitionDeCharge(def: SchemaDef | undefined): { champ: string; table: Readonly<Record<string, readonly string[]>> } | undefined {
  const espace = def && collectionDe(def.schema)?.espace;
  return espace?.discriminant && espace.chargeParDiscriminant ? { champ: espace.discriminant, table: espace.chargeParDiscriminant } : undefined;
}

/**
 * Charge DISCRIMINÉE d'une entrée — `undefined` si le document ne déclare pas de discriminant, ou si
 * l'entrée n'en porte pas une valeur connue (entrée en cours de saisie). C'est ce que l'atelier
 * PRÉSENTE d'une entrée (`src/ui/compendium/CodexEdit.tsx`) : sans elle, un document dont les cas ne
 * partagent aucune clé ferait éditer à chacun l'union des clés de tous les autres.
 */
export function chargeDiscriminee(file: string, entree: Record<string, unknown>): ChargeDiscriminee | undefined {
  const partition = partitionDeCharge(DEFS_DE_DOCUMENT.find((d) => d.file === file));
  if (!partition) return undefined;
  const { champ, table } = partition;
  const valeur = entree[champ];
  const duCas = typeof valeur === 'string' ? table[valeur] : undefined;
  if (!duCas) return undefined;
  return { champ, duCas, toutes: [...new Set(Object.values(table).flat())] };
}

/**
 * BROUILLON d'une entrée NEUVE d'un document — ce que le DEF DÉTERMINE déjà, posé avant la première
 * frappe. Deux canaux, tous deux portés par le def, aucun nommant un dataset :
 *  - le `type` d'ENVELOPPE : la fabrique le pose en `z.literal` (`grammaire/document.ts`, `enveloppe()`),
 *    il ne se SAISIT pas. Il se lit sur les entrées du document, qui l'ont toutes parsé contre ce
 *    littéral, et SEULEMENT pour un document à méta (donc bâti par `document()`) — sur un document
 *    sans handle, `type` est un discriminant de CHARGE utile, pas le type du document (même frontière
 *    que `libelleDuChamp`, `src/ui/compendium/editFields.ts`).
 *  - la PREMIÈRE valeur du champ DISCRIMINANT, celle que le `select` de l'atelier affiche en tête
 *    (ordre de l'enum NOMMÉ du nœud, dont les options SONT les clés de ses libellés) : un `select` qui
 *    affiche « Décor » sur un brouillon sans domaine ment à l'écran, refuse au save, et fait présenter
 *    l'UNION des cas (`chargeDiscriminee` ne reconnaît aucune valeur).
 */
export function brouillonNeuf(file: string, entrees: readonly Record<string, unknown>[] = []): Record<string, unknown> {
  const def = DEFS_DE_DOCUMENT.find((d) => d.file === file);
  if (!def) return {};
  const brouillon: Record<string, unknown> = {};
  const type = def.meta && entrees.find((e) => typeof e?.type === 'string')?.type;
  if (typeof type === 'string') brouillon.type = type;
  const partition = partitionDeCharge(def);
  if (partition) {
    const premiere = Object.keys(valeursDe(noeudDuChamp(file, partition.champ)) ?? partition.table)[0];
    if (premiere !== undefined) brouillon[partition.champ] = premiere;
  }
  return brouillon;
}

/** Valide `value` contre le schéma du fichier `file` : `null` si valide, message actionnable
 *  (champ-par-champ) si invalide. Un fichier NON REGISTRÉ est une ERREUR NOMMÉE, jamais un
 *  laissez-passer : tout document des deux racines a son def (`defs/`, `defs-scenes/`). */
export function validateDataset(file: string, value: unknown): string | null {
  const schema = schemaForFile(file);
  if (!schema) {
    return `${file} — aucun schéma registré : déposer son def dans src/data/schemas/defs/ (racine src/data) ou defs-scenes/ (racine src/scenes), puis \`npm run gen\`.`;
  }
  const fautes = validateDocument(schema, value);
  return fautes ? rapportDeFautes(file, fautes) : null;
}

/** Valide `value` contre `schema` — porte du seam SANS nom de fichier (chargement d'un projet depuis
 *  le localStorage ou un import utilisateur). Rend les FAUTES (`null` si valide) : l'appelant en
 *  tire son rapport (`rapportDeFautes`) et sa surface les lit sans re-parser de texte. */
export function validateDocument(schema: z.ZodType, value: unknown): readonly Faute[] | null {
  const result = schema.safeParse(value);
  return result.success ? null : fautesDe(schema, value, result.error);
}
