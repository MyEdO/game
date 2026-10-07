/**
 * Validation d'un document authoré contre son schéma zod — SOURCE UNIQUE, DEUX portes :
 *  - `validateDataset(file, value)` : porte par FICHIER, pour qui connaît le nom du document —
 *    contrat CI (`schema-contract.test.ts`), sauvegarde éditeur/Compendium (`CodexEdit.save`),
 *    chargement DEV (`dev-validate.ts`).
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
import { defDe, descendre, enfantsDe, ouverts, pasDeDonnee } from './grammaire/descente';
import { atteindre, collectionDe, noeudsDeLElement } from './grammaire/collection-cle';
import { DATASET_FICHIER_DERIVE, DATASET_SUITE_DERIVE, OBJECT_CATEGORY_DERIVE } from './exposition-derivee';
import { valeursDe, metaDesChamps, nomDeNoeud, type MetaChamp } from './grammaire/meta';
import { proseNonMaterialisee, versDisque } from './grammaire/prose';
import { mecaniqueDe, regimesDuNoeud, type Regimes } from './grammaire/mecanique';

/** Le registre des DEUX racines de documents (`src/data` + `src/scenes`). */
export const DEFS_DE_DOCUMENT: readonly SchemaDef[] = [...SCHEMA_DEFS, ...SCHEMA_DEFS_SCENES];

/** Un ÉLÉMENT de liste à clé, nommé par la valeur de sa clé (`cle`) et, s'il en porte un, par son
 *  `label` (`libelle`) ; `liste` = le champ qui porte la liste (`''` pour une liste racine). */
export type ElementDeLieu = { readonly genre: 'element'; readonly liste: string; readonly cle: string; readonly nom: string; readonly libelle?: string };
/** Un segment du LIEU d'une faute : un champ, un rang de liste sans clé, ou un élément à clé. */
export type SegmentDeLieu = { readonly genre: 'champ'; readonly cle: string; readonly nom: string; readonly transparent?: boolean } | { readonly genre: 'rang'; readonly rang: number; readonly nom: string } | ElementDeLieu;

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

/** #2432 */
export function lieuDe(schema: unknown, valeur: unknown, chemin: readonly (string | number)[]): SegmentDeLieu[] {
  const lieu: SegmentDeLieu[] = [];
  let noeuds = ouverts([schema], valeur);
  for (const segment of chemin) {
    const enfant = estObjet(valeur) ? valeur[segment] : undefined;
    const suivants = ouverts(pasDeDonnee(noeuds, segment), enfant);
    const precedent = lieu[lieu.length - 1];
    if (typeof segment === 'number') {
      const marque = noeuds.map(collectionDe).find(m => m !== undefined);
      const cle = marque?.forme === 'liste' ? marque.de(enfant) : undefined;
      const noms = suivants.map(nomDeNoeud).map(n => n?.element).filter((n): n is string => !!n);
      const nom = noms.length && new Set(noms).size === 1 ? noms[0] : precedent?.nom ?? 'élément';
      const liste = precedent?.genre === 'champ' ? precedent.cle : '';
      if (precedent?.genre === 'champ') lieu.pop();
      if (cle === undefined) lieu.push({ genre: 'rang', rang: segment + 1, nom });
      else lieu.push({ genre: 'element', liste, cle, nom, ...(estObjet(enfant) && typeof enfant.label === 'string' ? { libelle: enfant.label } : {}) });
    } else {
      const metas = noeuds.map(n => metaDesChamps(n)?.[segment]).filter((m): m is MetaChamp => !!m);
      const declares = noeuds.filter(n => enfantsDe(n).some(e => e.cle === segment));
      if (declares.length && !metas.length) throw new Error(`champ connu sans nom : ${segment}`);
      const noms = [...new Set(metas.map(m => m.label))];
      const parents = [...new Set(noeuds.map(nomDeNoeud).map(n => n?.nom).filter((n): n is string => !!n))];
      const commun = parents.length === 1 ? parents[0] : undefined;
      if (noms.length > 1 && !commun) throw new Error(`noms divergents sans parent commun : ${segment}`);
      const variantes = [...new Set(suivants.map(nomDeNoeud).map(n => n?.nom).filter((n): n is string => !!n))];
      const nom = variantes.length === 1 ? variantes[0] : noms.length === 1 ? noms[0] : commun ?? `champ inconnu « ${segment} »`;
      lieu.push({ genre: 'champ', cle: segment, nom, transparent: declares.length > 0 && declares.every(n => metaDesChamps(n)?.[segment]?.transparent === true) });
    }
    noeuds = suivants;
    valeur = enfant;
  }
  return lieu;
}

/** Les fautes de `valeur` refusée par `schema` (son `ZodError`), dans l'ordre de ses `issues`. */
function fautesDe(schema: unknown, valeur: unknown, error: z.ZodError): readonly Faute[] {
  return error.issues.map((iss) => {
    const chemin = iss.path.map((k) => (typeof k === 'number' ? k : String(k)));
    return { chemin, lieu: lieuDe(schema, valeur, chemin), message: iss.message, code: iss.code };
  });
}

export function cheminLisible(
  lieu: readonly SegmentDeLieu[],
  nom: (element: ElementDeLieu) => string = (element) => element.cle,
): string {
  const parties: string[] = [];
  for (const [i, segment] of lieu.entries()) {
    if (segment.genre === 'champ') {
      if (!segment.transparent || i === lieu.length - 1) parties.push(segment.nom);
    } else if (segment.genre === 'rang') parties.push(`${segment.nom} ${segment.rang}`);
    else parties.push(`${segment.nom} « ${nom(segment)} »`);
  }
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
 * NŒUD OBJET sous un nœud quelconque — le premier nœud objet que `accepte` retient (tous par défaut),
 * atteint par la descente (`descendre`, `grammaire/descente.ts`, largeur d'abord, visite unique par
 * identité : le plus PROCHE) à travers l'emballage de famille, le sceau et les enveloppes (`z.array`,
 * `.pipe`, refines, `optional`, `lazy`). C'est le seul chemin schéma→atelier vers les NŒUDS d'un
 * document scellé, à TOUTE profondeur : la méta publiée ne porte que le libellé du CHAMP, celui de ses
 * VALEURS vit sur le nœud (`enumNomme`, #1694). `accepte` reçoit le NŒUD objet visité, dont il lit les
 * enfants par `enfantsDe` ; un nœud refusé est traversé.
 */
export function noeudObjet(schema: unknown, accepte: (noeud: unknown) => boolean = () => true): unknown {
  let trouve: unknown;
  descendre([schema], ({ noeud, def }) => {
    if (def.type !== 'object') return;
    if (!accepte(noeud)) return;
    trouve = noeud;
    return 'arreter';
  });
  return trouve;
}

/**
 * PAYLOAD de l'op `op` dans la FAMILLE mécanique (`mecaniqueDe`) qui a construit la liste `liste` — ses
 * champs réservés y figurent au régime du porteur (`charMod.min`). La famille est le premier nœud marqué
 * (`regimesDuNoeud`) au-dessus de tout nœud objet ; `undefined` hors famille, ou pour une op encore loose
 * (`OPS_NON_TYPEES`).
 */
export function payloadDeFamille(liste: unknown, op: string): unknown {
  let regimes: Regimes | undefined;
  descendre([liste], ({ noeud, def }) => {
    regimes = regimesDuNoeud(noeud);
    if (regimes) return 'arreter';
    if (def.type === 'object') return 'elaguer';
  });
  return regimes && mecaniqueDe(regimes).opDefs[op];
}

/**
 * NŒUD OBJET de la RANGÉE `entree` du dataset `dataset`, lu sur sa route DÉCLARÉE (`exposition.edit`,
 * `exposition-derivee.ts`) : l'élément de la collection au bout de sa suite (`DATASET_SUITE_DERIVE`,
 * `''` : la collection de racine), la valeur de la collection de racine d'un dataset-OBJET `record`, la
 * racine elle-même d'un dataset-OBJET `single`. Une union DISCRIMINÉE s'y ouvre par la valeur de son
 * discriminant dans `entree` (`ouverts`). LÈVE, en nommant fichier, dataset et suite, sur un dataset
 * sans route, une suite qui ne mène à aucune collection à clé, ou une rangée qui n'a pas UN nœud objet
 * (en nommant en plus la valeur des discriminants) — `RangeeSansNoeud` quand sa forme disque est
 * refusée par chacun des nœuds de son élément, qui en portent les FAUTES.
 */
export function noeudDeLEntree(dataset: string, entree: object): unknown {
  const fichier = DATASET_FICHIER_DERIVE[dataset];
  const objet = OBJECT_CATEGORY_DERIVE[dataset];
  const suite = objet ? '' : DATASET_SUITE_DERIVE[dataset];
  const schema = fichier === undefined ? undefined : schemaForFile(fichier);
  const lieu = `noeudDeLEntree : dataset « ${dataset} » (${fichier ?? 'aucun fichier'}, suite « ${suite ?? '(aucune)'} »)`;
  if (!schema || suite === undefined) throw new Error(`${lieu} — aucune route d'édition déclarée (\`exposition.edit\`).`);
  let noeuds: readonly unknown[];
  if (objet?.mode === 'single') noeuds = [schema];
  else {
    const collection = atteindre(schema, undefined, suite);
    if (!collection) throw new Error(`${lieu} — la suite ne mène à aucune collection à clé du schéma.`);
    noeuds = noeudsDeLElement(collection.noeuds, collection.marque);
  }
  const objets = ouverts(noeuds, entree).filter((n) => defDe(n)?.type === 'object');
  if (objets.length !== 1) {
    const discriminants = [...new Set(ouverts(noeuds).map((n) => defDe(n)?.discriminator).filter((d): d is string => d !== undefined))];
    const valeurs = discriminants.map((d) => `« ${d} » = ${String(JSON.stringify((entree as Record<string, unknown>)[d]))}`).join(', ');
    const message = `${lieu} — la rangée porte ${objets.length} nœuds objets, pas un${valeurs ? ` (discriminant ${valeurs})` : ''}.`;
    const refus = noeuds.map((n) => validerFormeVivante(n as z.ZodType, entree)?.fautes ?? null);
    if (refus.length > 0 && refus.every((f): f is readonly Faute[] => f !== null)) throw new RangeeSansNoeud(message, refus.flat());
    throw new Error(message);
  }
  return objets[0];
}

/** Refus de `noeudDeLEntree` porté par la VALEUR de la rangée, et non par sa route : ses `fautes`, au
 *  LIEU relatif à la rangée, sont ce que l'atelier en dit à sa surface (`CodexEdit`, `rapportDeFautes`). */
export class RangeeSansNoeud extends Error {
  constructor(message: string, readonly fautes: readonly Faute[]) {
    super(message);
    this.name = 'RangeeSansNoeud';
  }
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

/** Refus d'une forme VIVANTE (`validerFormeVivante`) : la cause dit laquelle des deux portes refuse. */
export type RefusDeFormeVivante = { readonly cause: 'schema' | 'prose-non-materialisee'; readonly fautes: readonly Faute[] };

/**
 * Porte d'une forme VIVANTE (prose adressée matérialisée) : le schéma sur `versDisque(value)`, puis
 * la complétude (`proseNonMaterialisee`) sur `value` reçue. Sites : `parseProject` et
 * `parseSceneDeProjet` (`state/worldMap.ts`), `validateScene` (`state/validateScene.ts`).
 */
export function validerFormeVivante(schema: z.ZodType, value: unknown): RefusDeFormeVivante | null {
  const fautes = validateDocument(schema, versDisque(value));
  if (fautes) return { cause: 'schema', fautes };
  const nus = proseNonMaterialisee(value);
  if (nus.length === 0) return null;
  const cause = 'prose-non-materialisee';
  return {
    cause,
    fautes: nus.map((chemin) => ({ chemin, lieu: lieuDe(schema, value, chemin), message: 'passage adressé sans son texte.', code: cause })),
  };
}
