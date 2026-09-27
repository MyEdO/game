// SONDE des structures OBSERVÉES dans la donnée — moteur de mesure partagé par le générateur
// `scripts/docs/build-structures.mts` et la garde `src/data/structures-contrat.test.ts`.
// Aucun rendu ici : uniquement des mesures (l'affichage vit dans le générateur, le stock dans
// `scripts/guards/lib/structuresStock.mjs`).
//
// Deux RACINES de documents, déclarées UNE fois dans `RACINES` (consommée par `listerDocuments`).
// Les JSON sont lus UNE fois par run ; toutes les passes ci-dessous travaillent en mémoire.
//
// LE CŒUR EST L'INDEX DES IDS, SCOPÉ PAR DATASET (`id → Set<dataset>`) : la résolution se mesure
// PAR SITE `(dataset, champ, clé)`, jamais par chaîne globale. Cinq passes, dans cet ordre
// (l'ordre est un angle mort déclaré) :
//   1. INDEX RACINE   — l'identité de chaque entrée de racine (`id`/`key`/`nom`, ou la clé du
//      record) : `id → Set<dataset>`.
//   2. SITES          — pour chaque site `(dataset, champ, clé)`, combien de ses valeurs résolvent
//      et vers QUELS datasets. Cible(s) MAJORITAIRE(S) = celles qui couvrent ≥ 50 % des valeurs
//      résolvantes du site ; une valeur qui ne résout que hors d'elles est AMBIGUË.
//   3. DOCUMENTS EMBARQUÉS — objet à clé d'identité, sans `op`, sans `kind` de Condition, qui ne
//      porte pas les TELLS d'un document et dont le SITE porte majoritairement des références.
//      Leurs ids complètent l'index. C'est le SITE qui tranche, jamais la seule valeur : un id de
//      spécialisation qui collisionne avec l'id d'une carrière ne fait pas d'un `{id,label}` une
//      référence — et les tells (`label` + `source`, ou `label` + charge utile) passent avant lui.
//   4. SITES, RE-MESURÉS sur l'index complété par la passe 3 (les pions de scène sont indexés
//      AVANT que `members {entityId}` ne soit résolu).
//   5. MESURE — occurrences de référence, formes de valeur, ops, enveloppe, orphelines, ambiguës.
import { readFileSync, statSync } from 'node:fs';
import { basename, join, relative } from 'node:path';
import { parUnitesDeCode, listerArbre, listerDossier } from '../../guards/lib/lister.mjs';
import { PROJETS_LIVRES } from '../../guards/lib/projetsLivres.mjs';
import { defsDeDocument } from './slots-registre.mjs';
import { choixDeclares, introspecterDefs } from './zod-introspect.mjs';
import ts from 'typescript';
import {
  CLES_DE_SPECIALISATION,
  CLES_IDENTITE,
  CLES_PROSE_SANS_REFERENCE,
  CLES_REFERENCE_SCOPEE,
  CLES_RESERVEES,
  CONCEPTS,
  CONCEPT_REFERENCE,
  GRAPHIE_REFERENCE,
  GRAPHIES_ENVELOPPANTES,
  ROLES_ENVELOPPE,
  RX_CLE_REFERENCE,
  CLES_DE_VALEUR,
  signature,
  type Concept,
  type Strate,
} from './structures-lexique.mjs';

export type Racine = {
  id: string;
  dir: string;
  motif: string;
  suffixe: string;
  recursif: boolean;
};

export const RACINES: readonly Racine[] = [
  { id: 'src/data', dir: 'src/data', motif: '*.json', suffixe: '.json', recursif: false },
  { id: PROJETS_LIVRES.dossier, dir: PROJETS_LIVRES.dossier, motif: `*${PROJETS_LIVRES.suffixe}`, suffixe: PROJETS_LIVRES.suffixe, recursif: PROJETS_LIVRES.recursif },
];

export type Document = { racine: string; chemin: string; nom: string };

/**
 * NOM d'un document tel que le scan le key : son BASENAME. Les defs de `src/scenes` déclarent un
 * CHEMIN RELATIF à leur racine (`arene/arene-projet.json`) là où `listerDocuments` rend un basename
 * (`arene-projet.json`) : toute jointure DÉCLARÉ × OBSERVÉ passe par ici, jamais par `file` brut.
 */
export const nomDeDocument = (file: string): string => file.split(/[\\/]/).pop() ?? file;

/**
 * Bornes de la table EXHAUSTIVE des signatures hors strate dans `docs/structures-donnees.md`.
 * Le doc est la LISTE DE RÉFÉRENCE du cliquet de `src/data/structures-contrat.test.ts` : le
 * générateur pose les bornes, la garde lit entre elles.
 */
export const MARQUE_HORS_STRATE = {
  debut: '<!-- HORS-STRATE:DEBUT -->',
  fin: '<!-- HORS-STRATE:FIN -->',
} as const;

/** Classe de type d'une valeur JSON (jamais `typeof` nu : `null` et les tableaux comptent à part). */
const classeDeType = (v: unknown): string =>
  v === null ? 'null' : Array.isArray(v) ? 'array' : typeof v === 'object' ? 'object' : typeof v;

/**
 * RÉGIME D'ENTRÉES d'un document : d'où viennent ses entrées, donc de qui sont les « clés de
 * premier niveau ». La famille DÉCLARÉE (introspection zod, `zod-introspect.mts`) tranche :
 *   `liste`  → `elements` : une entrée par élément du tableau racine ;
 *   `record` → `valeurs`  : une entrée par valeur de l'objet racine ;
 *   sinon    → `racine`   : le document EST son entrée (famille `config`), ses clés de premier
 *                           niveau sont celles de sa racine.
 * Hors registre (les documents de scène), la racine JSON tranche seule, même règle.
 */
/**
 * CHARGE d'un document de famille `record` : depuis #1467 L1b V-FLIP-RECORD, un record porte son
 * ENVELOPPE (`id`/`type`/`label`) et sa carte clé→valeur sous `entries`. Le régime `valeurs` descend
 * donc dans `entries` quand elle est présente — sans quoi il prendrait `id`/`type`/`label`/`entries`
 * pour les clés de premier niveau du record, et les VRAIES clés sortiraient de l'index des ids.
 * Un record NU (racine plate, sans `entries`) est rendu tel quel.
 */
const chargeRecord = (brut: unknown): unknown => {
  const entries = estObjet(brut) ? (brut as Record<string, unknown>).entries : undefined;
  return estObjet(entries) ? entries : brut;
};

const regimeEntrees = (racineJson: string, familleDeclaree?: string): 'elements' | 'valeurs' | 'racine' => {
  if (familleDeclaree?.startsWith('liste')) return 'elements';
  if (familleDeclaree?.startsWith('record')) return 'valeurs';
  if (familleDeclaree) return 'racine';
  return racineJson === 'array' ? 'elements' : 'racine';
};

/** Liste les documents des deux `RACINES`, chemins POSIX relatifs à la racine du dépôt. */
export function listerDocuments(root: string): Document[] {
  const out: Document[] = [];
  for (const racine of RACINES) {
    const base = join(root, racine.dir);
    if (!statSync(base).isDirectory()) continue;
    for (const rel of listerArbre(base, {
      descendre: () => racine.recursif,
      filtre: (r) => r.endsWith(racine.suffixe) && !basename(r).startsWith('_'),
    })) {
      const p = join(base, rel);
      out.push({ racine: racine.id, chemin: relative(root, p).split('\\').join('/'), nom: basename(rel) });
    }
  }
  return out.filter((d, i, xs) => xs.findIndex((x) => x.chemin === d.chemin) === i);
}

const inc = <K,>(m: Map<K, number>, k: K, n = 1) => m.set(k, (m.get(k) ?? 0) + n);

/** Régime d'une valeur de `price` (la colonne Prix du RAW n'a pas UNE forme, elle en a plusieurs). */
const regimePrix = (v: unknown): string =>
  v === null
    ? 'absent (null)'
    : Array.isArray(v)
      ? 'tableau'
      : typeof v === 'object'
        ? `objet {${signature(Object.keys(v as object))}}`
        : typeof v === 'string'
          ? v === 'ND'
            ? "littéral « ND »"
            : 'chaîne libre'
          : typeof v === 'number'
            ? 'nombre'
            : typeof v === 'boolean'
              ? 'booléen'
              : 'autre';

/**
 * Texte normalisé pour la résolution d'un `{text}` vers un libellé d'entité : casse, accents,
 * PONCTUATION (repliée en espace) et espaces multiples.
 */
const normaliserLibelle = (s: string): string =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

/** NATURE devinée d'une valeur d'`arg` — dénominateur A11 de #1466 (motif, jamais un verdict). */
const natureParametre = (v: string): string => {
  if (/^-?\d+(\.\d+)?$/.test(v)) return 'nombre';
  if (/^\d+\+$/.test(v)) return 'seuil `N+`';
  if (/^(tres-petit|petit|moyen|grand|enorme|monstrueux)$/i.test(v)) return 'taille';
  if (/^[a-z][a-z0-9]*(-[a-z0-9]+)*$/.test(v)) return 'id d’entité';
  if (/\s/.test(v.trim()) && v.trim().split(/\s+/).length > 3) return 'prose';
  return 'enum-libellé';
};

export type Contexte = {
  /**
   * Dataset PORTEUR de l'objet (`''` = aucun — un littéral de schéma n'a pas de dataset). Avec le
   * `champ`, il forme le SITE que `statutDe` consulte : une signature SITE-QUALIFIÉE du lexique ne
   * peut répondre à un classement de valeur que si l'appelant dit d'où il parle.
   */
  dataset: string;
  /** Nom de la clé sous laquelle l'objet pend (`''` = racine du document). */
  champ: string;
  /** Concepts dont le SITE d'appel a mesuré la candidature structurelle (cf. `plage`). */
  candidats?: readonly string[];
  /**
   * Lève la clause `horsDesignation` du lexique le temps d'un appel : le classement rend alors le
   * concept qui AURAIT revendiqué l'objet sans elle. Sert à MESURER ce que la clause écarte (§1 du
   * doc), jamais à classer — le scan ne pose jamais de forme sur ce retour.
   */
  malgreDesignation?: boolean;
};

export type Classement = {
  concept: string;
  strate: Strate;
  statut: 'cible' | 'historique' | 'declaree' | 'divergente';
  note: string;
  signature: string;
};

/**
 * Concepts CLASSABLES par leur forme propre : tous ceux que l'index des ids ne décide pas (ni
 * référence, ni liste d'ids nus). Le filtre porte sur la RÉSOLUTION, jamais sur la STRATE — un
 * concept d'ENVELOPPE (strate `Document`) se classe par son noyau exactement comme une valeur, en UNE
 * entrée de tableau au lexique. À ne pas confondre avec `CLES_DE_VALEUR` (`structures-lexique.mts`),
 * qui dérive de la STRATE parce qu'elle sert un autre usage (la charge utile de `tellsDeDocument`).
 */
const CONCEPTS_CLASSABLES = CONCEPTS.filter((c) => !c.resolvables && !c.listeIdsNus);

/** Concepts que seul le SITE peut proposer (`exigeCandidatureStructurelle`) — la liste se DÉDUIT du
 *  lexique, elle ne se nomme pas au call-site : ajouter un concept structurel au lexique suffit. */
const CONCEPTS_STRUCTURELS = CONCEPTS_CLASSABLES.filter((c) => c.exigeCandidatureStructurelle && c.noyau?.length);

/**
 * Ids des concepts structurels dont l'objet `o` porte TOUT le noyau en NUMÉRIQUE. `dansTableau` dit
 * la POSITION du porteur : un concept qui déclare `candidatureHorsTableau` est candidat des deux
 * côtés, les autres restent bornés à l'élément de tableau. La liste vient du LEXIQUE (#842) — aucun
 * concept n'est nommé ici.
 */
const candidatsStructurels = (o: Record<string, unknown>, dansTableau: boolean): string[] =>
  CONCEPTS_STRUCTURELS.filter(
    (c) => (dansTableau || c.candidatureHorsTableau) && c.noyau!.every((k) => typeof o[k] === 'number'),
  ).map((c) => c.id);

/**
 * Statut d'une signature AU SITE : une entrée SITE-QUALIFIée du lexique gagne sur l'entrée nue de la
 * même graphie (`site` absent = repli universel). Sans site fourni par l'appelant, seules les entrées
 * nues répondent — un littéral de schéma n'a pas de dataset.
 */
const statutDe = (c: Concept, sig: string, site?: { dataset: string; champ: string }): Classement => {
  const candidates = c.signatures.filter((s) => s.sig === sig);
  const hit =
    (site && candidates.find((s) => s.site && (s.site.datasets?.includes(site.dataset) ?? true) && s.site.champs.includes(site.champ)))
    ?? candidates.find((s) => !s.site);
  return { concept: c.id, strate: c.strate, statut: hit?.statut ?? 'divergente', note: hit?.note ?? '', signature: sig };
};

/** L'objet DÉSIGNE une entité : il porte une clé d'IDENTITÉ, ou une clé dont le NOM annonce une
 *  référence. Source unique de la clause `horsDesignation` et de sa mesure. */
export const designeUneEntite = (cles: readonly string[]): boolean =>
  cles.some((k) => (CLES_IDENTITE as readonly string[]).includes(k) || RX_CLE_REFERENCE.test(k));

/**
 * Classement d'un objet dans un concept de VALEUR — par le NOM de la clé qui le porte quand le
 * concept en déclare un (`price` → `prix`), sinon par son NOYAU de clés. Aucun seuil, aucun
 * vocabulaire : un concept de valeur est reconnu à ses clés propres, pas à la fréquence de ses
 * voisins. `null` = ce n'est pas une valeur du lexique.
 */
export function classerValeur(sig: string, cles: readonly string[], contexte: Contexte = { dataset: '', champ: '' }): Classement | null {
  const set = new Set(cles);
  const site = { dataset: contexte.dataset, champ: contexte.champ };
  for (const c of CONCEPTS_CLASSABLES) {
    if (c.exigeCandidatureStructurelle && !contexte.candidats?.includes(c.id)) continue;
    const parChamp = c.champs?.includes(contexte.champ) ?? false;
    const parNoyau = c.noyau ? c.noyau.filter((k) => set.has(k)).length >= (c.noyauMin ?? c.noyau.length) : false;
    // `coPresence` DÉCLARÉE : le concept n'est retenu que si l'objet porte au moins une de ces clés,
    // sinon on continue vers le concept suivant (`bornes` avant `plage`, même noyau).
    if (c.coPresence && !c.coPresence.some((k) => set.has(k))) continue;
    // `horsDesignation` DÉCLARÉE : un objet qui DÉSIGNE une entité n'est pas la valeur du concept
    // (`test` cède ainsi les 66 objets qui portent `difficulty` en champ d'une entité ou d'une
    // référence, mesuré au lexique). Le concept suivant, puis la résolution vers l'index, en décident.
    if (c.horsDesignation && !contexte.malgreDesignation && designeUneEntite(cles)) continue;
    if (parChamp || parNoyau) return statutDe(c, projeteValeur(c.id, cles) || sig, site);
  }
  return null;
}

/**
 * SIGNATURE PROJETÉE d'un objet de référence : on garde les clés de la GRAPHIE du lexique et les
 * clés qui RÉSOLVENT, la charge utile est repliée en `+…`. Sans cette projection, une même graphie
 * produirait autant de lignes de stock que le porteur a de variantes de charge utile.
 */
const signatureProjetee = (cles: readonly string[], resolvantes: ReadonlySet<string>): string => {
  const projete = cles.filter((k) => resolvantes.has(k) || GRAPHIE_REFERENCE.has(k));
  return signature(projete) + (cles.length > projete.length ? '+…' : '');
};

/** Vocabulaire propre d'un concept de VALEUR : les clés que ses signatures et son noyau nomment. */
const VOCABULAIRE_VALEUR = new Map(
  CONCEPTS.map((c) => [c.id, new Set([...c.signatures.flatMap((s) => s.sig.split(',')), ...(c.noyau ?? [])])]),
);

/**
 * Une valeur mesurée AILLEURS que sous sa forme propre (une plage aplatie dans une rangée de table)
 * est enregistrée sous sa PROJECTION sur le vocabulaire du concept : sans quoi une même divergence
 * produirait autant de lignes de stock que la table a de variantes de charge utile.
 */
const projeteValeur = (concept: string, cles: readonly string[]): string => {
  const vocab = VOCABULAIRE_VALEUR.get(concept)!;
  const projete = cles.filter((k) => vocab.has(k));
  return signature(projete) + (cles.length > projete.length ? '+…' : '');
};

export type CleNiveau1 = { cle: string; n: number; parClasse: Array<{ classe: string; n: number }> };
export type GroupeEnveloppe = {
  document: string;
  chemin: string;
  /** `racine` = les entrées du document ; `embarqué` = un document plus bas dans l'arbre. */
  portee: 'racine' | 'embarqué';
  /** Famille du document porteur (`entité`, `table`, `config`, `record`). */
  famille: string;
  /** Record : l'identité est portée par la CLÉ de l'entrée, pas par une clé de l'objet. */
  identiteParCle?: boolean;
  nbEntrees: number;
  cles: CleNiveau1[];
};
export type DivergenceEnveloppe = {
  role: string;
  cle: string;
  motif: 'clé divergente' | 'type divergent' | 'clé absente' | 'cible partielle';
  detail: string;
  document: string;
  chemin: string;
  entrees: number;
};
export type FormeObservee = {
  concept: string;
  strate: Strate;
  famille: string;
  dataset: string;
  champ: string;
  signature: string;
  statut: 'cible' | 'historique' | 'declaree' | 'divergente';
  note: string;
  occurrences: number;
  /** Occurrences dont un `{text}` narratif résout vers le `label` d'une entité (références seules). */
  resolvables: number;
  /** Datasets vers lesquels les valeurs de cette forme résolvent (références seulement). */
  cibles: string[];
};
/**
 * UNE occurrence de référence comptée par le scan, avec le COUPLE `(dataset, champ)` qu'il lui
 * attribue — une instance par occurrence, l'unité du champ `occurrences` des formes de la strate
 * `Référence` (#1473).
 */
export type OccurrenceDeReference = { readonly dataset: string; readonly champ: string };
/**
 * Occurrences de référence keyées par leur PORTEUR (l'objet ou la liste PARSÉS du document, par
 * identité) puis par la CLÉ ou l'INDICE qui y pose la valeur : c'est la case où une valeur lue à un
 * path déclaré tombe (#1473).
 */
export type ReferencesParPorteur = ReadonlyMap<object, ReadonlyMap<string | number, OccurrenceDeReference>>;
export type SignatureOrpheline = {
  dataset: string;
  champ: string;
  signature: string;
  motif: 'clé de référence non résolue' | 'clé réservée' | 'identité non résolue';
  occurrences: number;
};
export type OpObservee = { op: string; signature: string; dataset: string; occurrences: number };
/** Valeur qui résout, mais SEULEMENT vers un dataset hors des cibles majoritaires de son site. */
export type ResolutionAmbigue = {
  dataset: string;
  champ: string;
  cle: string;
  valeur: string;
  parasites: string[];
  majoritaires: string[];
  occurrences: number;
};
export type DocumentObserve = Document & {
  racineJson: string;
  familleDeclaree: string;
  famille: string;
  regime: 'elements' | 'valeurs' | 'racine';
  nbEntrees: number;
  clesNiveau1: CleNiveau1[];
};
export type Homonyme = {
  cle: string;
  classes: string[];
  total: number;
  parClasse: Array<{ classe: string; datasets: string[] }>;
};
export type Parametre = { valeur: string; occurrences: number; racines: string[]; datasets: string[]; nature: string };
export type Collision = { id: string; datasets: string[] };

const ajouteCle = (cles: Map<string, CleNiveau1>, k: string, v: unknown) => {
  if (!cles.has(k)) cles.set(k, { cle: k, n: 0, parClasse: [] });
  const e = cles.get(k)!;
  e.n += 1;
  const classe = classeDeType(v);
  const vue = e.parClasse.find((c) => c.classe === classe);
  if (vue) vue.n += 1;
  else e.parClasse.push({ classe, n: 1 });
};
const trieCles = (cles: Map<string, CleNiveau1>): CleNiveau1[] =>
  [...cles.values()]
    .sort((a, b) => parUnitesDeCode(a.cle, b.cle))
    .map((c) => ({ ...c, parClasse: [...c.parClasse].sort((a, b) => parUnitesDeCode(a.classe, b.classe)) }));

/**
 * Graphies dont la valeur n'est PAS un id (objet enveloppé, texte narratif) : un objet dont la
 * signature n'est faite QUE de celles-là est une forme de référence même quand rien ne résout —
 * `{wildcard:{…}}`, `{choice:[…]}`, `{text:"…"}` (#1463, arbitrage de design L0, point 4).
 */
const GRAPHIES_SANS_ID: ReadonlySet<string> = new Set<string>([...GRAPHIES_ENVELOPPANTES, 'text']);

/** Clés d'ENVELOPPE d'un document : elles ne comptent pas comme charge utile dans les tells. */
const CLES_HORS_CHARGE: ReadonlySet<string> = new Set<string>([
  ...CLES_IDENTITE,
  ...CLES_PROSE_SANS_REFERENCE,
  'desc',
  'source',
  'text',
]);

type Obj = Record<string, unknown>;
const estObjet = (v: unknown): v is Obj => !!v && typeof v === 'object' && !Array.isArray(v);

/** Valeur d'identité d'un objet (première clé d'identité portant une chaîne non vide). */
const identiteDe = (o: Obj): { cle: string; valeur: string } | null => {
  for (const k of CLES_IDENTITE) {
    const v = o[k];
    if (typeof v === 'string' && v.trim()) return { cle: k, valeur: v };
  }
  return null;
};

/** Parcours de tout objet du document, avec le CHAMP porteur (clé du parent) et son chemin. */
function parcourir(racine: unknown, visite: (o: Obj, champ: string, chemin: string, dansTableau: boolean) => void) {
  const marche = (n: unknown, champ: string, chemin: string, dansTableau: boolean): void => {
    if (Array.isArray(n)) return void n.forEach((x) => marche(x, champ, chemin, true));
    if (!estObjet(n)) return;
    visite(n, champ, chemin, dansTableau);
    for (const [k, v] of Object.entries(n)) marche(v, k, chemin ? `${chemin}.${k}` : k, false);
  };
  marche(racine, '', '', false);
}

/**
 * Mesure OBSERVÉE sur les deux racines.
 * @param root racine absolue du dépôt
 * @param famillesDeclarees nom de document → famille déclarée par son schéma zod
 *   (`introspecterDefs`), qui donne le RÉGIME D'ENTRÉES. Absente = régime déduit de la racine JSON
 *   seule — repli sans population depuis #1466 L1a : les DEUX racines sont au registre.
 * @param choixDeclares nom de document → clé → littéraux d'enum déclarés par son schéma zod
 *   (`choixDeclares`) : une clé dont la valeur est l'un d'eux est un DISCRIMINANT, jamais une
 *   référence. Absente = aucune fermeture d'enum — repli sans population depuis #1466 L1a.
 */
export function scannerDonnees(
  root: string,
  famillesDeclarees: ReadonlyMap<string, string> = new Map(),
  choixDeclares: ReadonlyMap<string, ReadonlyMap<string, ReadonlySet<string>>> = new Map(),
) {
  const docs = listerDocuments(root);
  const brutParDocument = new Map<string, unknown>(
    docs.map((d) => [d.chemin, JSON.parse(readFileSync(join(root, d.chemin), 'utf8')) as unknown]),
  );

  // --- passe 1 : régime, entrées de racine, INDEX DES IDS -------------------
  type Prepare = Document & {
    brut: unknown;
    racineJson: string;
    familleDeclaree: string;
    regime: 'elements' | 'valeurs' | 'racine';
    entrees: Obj[];
    racineEntrees: Set<Obj>;
    famille: string;
  };
  const index = new Map<string, Set<string>>();
  const ajouteIndex = (id: string, dataset: string) => {
    if (!index.has(id)) index.set(id, new Set());
    index.get(id)!.add(dataset);
  };
  const prepares: Prepare[] = docs.map((doc) => {
    const brut = brutParDocument.get(doc.chemin);
    const racineJson = Array.isArray(brut) ? 'array' : estObjet(brut) ? 'object' : classeDeType(brut);
    const familleDeclaree = famillesDeclarees.get(doc.nom) ?? '';
    const regime = regimeEntrees(racineJson, familleDeclaree || undefined);
    /** En régime `valeurs`, la carte clé→valeur vit sous `entries` dès que le record est enveloppé. */
    const charge = regime === 'valeurs' ? chargeRecord(brut) : brut;
    const brutes: unknown[] =
      regime === 'elements'
        ? Array.isArray(brut)
          ? brut
          : []
        : regime === 'valeurs'
          ? Object.values((charge ?? {}) as object)
          : estObjet(brut)
            ? [brut]
            : [];
    const entrees = brutes.filter(estObjet);
    if (regime === 'valeurs') for (const k of Object.keys((charge ?? {}) as object)) ajouteIndex(k, doc.nom);
    else for (const e of entrees) { const ident = identiteDe(e); if (ident) ajouteIndex(ident.valeur, doc.nom); }
    const portePlage = entrees.filter((e) => {
      const r = e.range;
      return (estObjet(r) && typeof r.min === 'number' && typeof r.max === 'number') || (typeof e.min === 'number' && typeof e.max === 'number');
    }).length;
    const famille =
      regime === 'valeurs' ? 'record' : regime === 'racine' ? 'config' : portePlage * 2 >= entrees.length && entrees.length ? 'table' : 'entité';
    return { ...doc, brut, racineJson, familleDeclaree, regime, entrees, racineEntrees: new Set(entrees), famille };
  });

  /**
   * Libellés d'entité, normalisés, SCOPÉS PAR DATASET (`libellé → Set<dataset>`) : c'est ce qui
   * permet de dire vers QUEL dataset un `{text}` résout, donc de le confronter aux cibles
   * majoritaires de son site (#1463 L0, forme `text (résolvable)`).
   */
  const libelles = new Map<string, Set<string>>();
  for (const p of prepares)
    parcourir(p.brut, (o) => {
      if (typeof o.label !== 'string' || !o.label.trim()) return;
      const k = normaliserLibelle(o.label);
      if (!libelles.has(k)) libelles.set(k, new Set());
      libelles.get(k)!.add(p.nom);
    });

  const kindsCondition = kindsDeCondition(root);
  /** Un objet dont le `kind` est un kind de Condition n'est pas un document : son `id` est un
   *  paramètre de comparaison, il n'entre pas à l'index (même exclusion que les objets à `op`). */
  const estCondition = (o: Obj) => typeof o.kind === 'string' && kindsCondition.has(o.kind);

  /**
   * La clé OUVRE-T-ELLE une référence ? Non pour une clé de PROSE, non quand la valeur est un
   * LITTÉRAL D'ENUM du schéma du document (un discriminant `kind`/`type`/`op`… n'est pas une FK).
   */
  const ouvreReference = (dataset: string, k: string, v: string): boolean =>
    !(CLES_PROSE_SANS_REFERENCE as readonly string[]).includes(k) &&
    !(k in CLES_REFERENCE_SCOPEE) &&
    !choixDeclares.get(dataset)?.get(k)?.has(v);

  /** Résolution BRUTE (l'id est indexé quelque part, ou le `{text}` égale un libellé). */
  const resoutIndex = (dataset: string, k: string, v: unknown): boolean =>
    typeof v === 'string' &&
    ouvreReference(dataset, k, v) &&
    (index.has(v) || (k === 'text' && libelles.has(normaliserLibelle(v))));

  // --- passe 2 : SITES ------------------------------------------------------
  // `sitesDeCle` mesure, pour chaque SITE (dataset, champ, clé), la part des valeurs qui résolvent
  // ET vers quels datasets : c'est ce qui distingue une RÉFÉRENCE CASSÉE d'un DOCUMENT embarqué, et
  // c'est ce qui scope la résolution. Sous `creatures.json|skills`, la clé `id` résout partout vers
  // `skills.json` — un `{id:"zzz", value:10}` y est une référence orpheline, jamais un document, et
  // un `id` qui ne résout QUE vers `careers.json` y est AMBIGU. Sous `arene-projet.json|entities`,
  // c'est `ref` qui résout et jamais `id` — un pion de scène EST un document.
  type Site = { resolvent: number; total: number; cibles: Map<string, number> };
  /** Le champ sous lequel un objet est MESURÉ : `(racine)` pour une entrée de racine. */
  const champDeSite = (p: Prepare, o: Obj, champ: string) => (p.racineEntrees.has(o) ? '(racine)' : champ);
  const mesurerSites = (embarque: ReadonlySet<Obj>): Map<string, Site> => {
    const sites = new Map<string, Site>();
    for (const p of prepares)
      parcourir(p.brut, (o, champ) => {
        const champSite = champDeSite(p, o, champ);
        if (!champSite) return;
        // La clé d'IDENTITÉ d'un document ne se résout pas elle-même : sans cette exclusion, un
        // document embarqué indexé en passe 3 ferait de son propre site un site de RÉFÉRENCE.
        const identite = p.racineEntrees.has(o) || embarque.has(o) ? identiteDe(o)?.cle : undefined;
        for (const [k, v] of Object.entries(o)) {
          if (typeof v !== 'string' || k === identite) continue;
          const k2 = `${p.nom}|${champSite}|${k}`;
          if (!sites.has(k2)) sites.set(k2, { resolvent: 0, total: 0, cibles: new Map() });
          const s = sites.get(k2)!;
          s.total += 1;
          if (!resoutIndex(p.nom, k, v)) continue;
          s.resolvent += 1;
          for (const d of index.get(v) ?? []) inc(s.cibles, d);
        }
      });
    return sites;
  };
  let sitesDeCle = mesurerSites(new Set<Obj>());
  /** Cibles MAJORITAIRES d'un site : les datasets qui couvrent ≥ 50 % de ses valeurs résolvantes. */
  const ciblesMajoritaires = (s: Site | undefined): string[] =>
    s && s.resolvent ? [...s.cibles].filter(([, n]) => n * 2 >= s.resolvent).map(([d]) => d).sort() : [];

  /**
   * Un SITE porte-t-il des références ? Mesuré : la MAJORITÉ STRICTE de ses valeurs y résout
   * (l'égalité tranche pour le DOCUMENT). Un site à UNE seule valeur ne tranche rien : c'est un
   * document, sauf si le NOM de la clé annonce une FK (`…Id`/`…Ids`/`…Ref`).
   */
  const siteDeReference = (dataset: string, champ: string, cle: string) => {
    const s = sitesDeCle.get(`${dataset}|${champ}|${cle}`);
    if (!s || s.resolvent === 0) return false;
    if (s.total === 1) return RX_CLE_REFERENCE.test(cle);
    return s.resolvent * 2 > s.total;
  };

  /**
   * TELLS d'un DOCUMENT, qui passent AVANT le ratio du site : un `label` ET (une `source` OU au
   * moins deux clés de CHARGE UTILE — hors graphie de référence, hors vocabulaire de valeur, hors
   * enveloppe). Un `{id,label,price,crew,…,source}` de `mass-battle.json` est un document RAW, même
   * quand ses ids collisionnent avec ceux de `trappings.json`.
   */
  const tellsDeDocument = (o: Obj): boolean => {
    if (typeof o.label !== 'string' || !o.label.trim()) return false;
    if ('source' in o) return true;
    return (
      Object.keys(o).filter((k) => !GRAPHIE_REFERENCE.has(k) && !CLES_DE_VALEUR.has(k) && !CLES_HORS_CHARGE.has(k)).length >= 2
    );
  };

  // --- passe 3 : DOCUMENTS EMBARQUÉS ---------------------------------------
  const documentsEmbarques = new Set<Obj>();
  for (const p of prepares)
    parcourir(p.brut, (o, champ) => {
      if (p.racineEntrees.has(o)) return;
      if (typeof o.op === 'string' || estCondition(o)) return;
      const ident = identiteDe(o);
      if (!ident) return;
      if (!tellsDeDocument(o) && siteDeReference(p.nom, champ, ident.cle)) return;
      documentsEmbarques.add(o);
      ajouteIndex(ident.valeur, p.nom);
    });

  // --- passe 4 : SITES RE-MESURÉS sur l'index complété ----------------------
  sitesDeCle = mesurerSites(documentsEmbarques);

  /**
   * Résolution SCOPÉE au SITE. La valeur résout comme avant ; ce qui est nouveau, c'est qu'une
   * valeur qui ne résout QUE vers un dataset HORS des cibles majoritaires de son site est COMPTÉE
   * ambiguë (§1bis) : c'est le seul endroit où une collision d'ids se voit ligne à ligne, et c'est
   * ce compte qui bouge quand un id collisionné meurt dans l'un de ses datasets.
   */
  const ambigues = new Map<string, ResolutionAmbigue>();

  /**
   * Cibles majoritaires d'un SITE, TOUTES CLÉS DE RÉFÉRENCE CONFONDUES (#1463 L-ref-0) : c'est le
   * site — `careerLevels.json | trappings` — qui a un référent, pas la clé `text`. La clé `text` est
   * exclue de l'agrégat : elle est l'objet MESURÉ, et elle ne résout que vers des LIBELLÉS, jamais
   * vers l'index des ids — son `resolvent` n'apporte aucune cible et ne peut donc pas fonder la
   * sienne. Mesurer sur la seule clé `text` rendait un agrégat SANS cible, donc « n'importe quel
   * dataset » : `Assistant`→`careerLevels`, `Bureau`→`props`, `Munitions`→`weaponGroups`.
   */
  const ciblesDuSite = new Map<string, string[]>();
  const ciblesMajoritairesDuSite = (dataset: string, champ: string): string[] => {
    const memo = ciblesDuSite.get(`${dataset}|${champ}`);
    if (memo) return memo;
    const cumul: Site = { resolvent: 0, total: 0, cibles: new Map() };
    for (const [k2, s] of sitesDeCle) {
      const [d, c, k] = k2.split('|');
      if (d !== dataset || c !== champ || k === 'text' || !siteDeReference(d, c, k)) continue;
      cumul.resolvent += s.resolvent;
      cumul.total += s.total;
      for (const [cible, n] of s.cibles) inc(cumul.cibles, cible, n);
    }
    const majoritaires = ciblesMajoritaires(cumul.resolvent ? cumul : undefined);
    ciblesDuSite.set(`${dataset}|${champ}`, majoritaires);
    return majoritaires;
  };

  /**
   * Datasets vers lesquels un `{text}` RÉSOUT : ceux où son texte normalisé est le `label` d'une
   * entité, RESTREINTS aux cibles majoritaires du site quand le site en a une. Un site sans cible
   * (aucune de ses valeurs ne résout vers un id indexé) accepte n'importe quel dataset. Liste vide
   * = le texte est du narratif irréductible, forme `text` `declaree` (#1463 L0, #624).
   */
  const datasetsDuTexte = (p: Prepare, o: Obj, champ: string, v: string): string[] => {
    const trouves = libelles.get(normaliserLibelle(v));
    if (!trouves) return [];
    const maj = ciblesMajoritairesDuSite(p.nom, champDeSite(p, o, champ));
    return (maj.length ? [...trouves].filter((d) => maj.includes(d)) : [...trouves]).sort();
  };

  const resoutSite = (p: Prepare, o: Obj, champ: string, k: string, v: unknown): boolean => {
    if (!resoutIndex(p.nom, k, v)) return false;
    const datasets = index.get(v as string);
    // `{text}` résolu vers un LIBELLÉ : la résolution est scopée aux cibles majoritaires du site.
    if (!datasets) return k === 'text' && datasetsDuTexte(p, o, champ, v as string).length > 0;
    const champSite = champDeSite(p, o, champ);
    const maj = ciblesMajoritaires(sitesDeCle.get(`${p.nom}|${champSite}|${k}`));
    if (maj.length && !maj.some((d) => datasets.has(d))) {
      const cle = `${p.nom} | ${champSite} | ${k} | ${v as string}`;
      if (!ambigues.has(cle))
        ambigues.set(cle, {
          dataset: p.nom,
          champ: champSite,
          cle: k,
          valeur: v as string,
          parasites: [...datasets].sort(),
          majoritaires: maj,
          occurrences: 0,
        });
      ambigues.get(cle)!.occurrences += 1;
    }
    return true;
  };

  // --- passe 5 : MESURE -----------------------------------------------------
  /** CHAMPS PORTEURS de référence, MESURÉS : les clés de parent dont au moins un site (quel que
   *  soit le dataset) porte majoritairement des références. C'est sous eux qu'une GRAPHIE compte
   *  comme forme même sans résoudre — ailleurs, un `{text}` est de la prose. */
  const champsPorteurs = new Set<string>();
  for (const [k2] of sitesDeCle) {
    const [dataset, champ, cle] = k2.split('|');
    if (champ !== '(racine)' && siteDeReference(dataset, champ, cle)) champsPorteurs.add(champ);
  }
  /** clé `concept | dataset | champ | signature` → ligne de forme observée. */
  const formes = new Map<string, FormeObservee & { ciblesSet: Set<string> }>();
  const orphelines = new Map<string, SignatureOrpheline>();
  const reservees = new Map(CLES_RESERVEES.map((k) => [k as string, new Map<string, Map<string, number>>()]));
  const clesEnveloppe = new Map<string, number>();
  const groupes = new Map<string, { groupe: GroupeEnveloppe; cles: Map<string, CleNiveau1> }>();
  const ops = new Map<string, number>();
  /** Documents portant au moins une clé `source` à une profondeur quelconque (T3, lot L1d #1469). */
  const docsAvecSource = new Set<string>();
  const conditionsAvecOp = new Map<string, number>();
  const conditionsSansOp = new Map<string, number>();
  const opsComparateurs = new Map<string, number>();
  const parametres = new Map<string, { occurrences: number; racines: Set<string>; datasets: Set<string> }>();
  const regimesPrix = new Map<string, number>();
  const clesParDocument = new Map<string, string[]>();
  /** signature d'objet à `text` → { occurrences, resolvables } (T6 : 622 purs + 33 {count,text}). */
  const textes = new Map<string, { occurrences: number; resolvables: number }>();
  const documents: DocumentObserve[] = [];
  let totalOps = 0;
  let objetsVus = 0;
  let objetsClasses = 0;
  /** Objets qu'AUCUNE strate ne porte : ni document, ni forme mesurée, ni orpheline recensée. */
  let objetsInvisibles = 0;
  /** Entrées de RACINE qu'aucun concept de valeur du lexique ne reconnaît — imprimé à la synthèse du
   *  doc (§1) : un document n'entre ni aux orphelines ni au hors-strate, rien d'autre ne les compterait. */
  let racinesSansValeur = 0;
  /** Document → entrées de racine qu’un concept de valeur revendiquerait SANS la clause `horsDesignation`. */
  const racinesDisqualifiees = new Map<string, number>();
  const invisibles = new Map<string, number>();
  /** Clé-graphie enveloppante → occurrences BRUTES de la clé dans la donnée (tout classement confondu). */
  const graphiesBrutes = new Map<string, number>();

  /**
   * Classement d'une occurrence de référence : la signature PROJETÉE telle quelle, sauf sous une
   * graphie ENVELOPPANTE (`ref`, `wildcard`, `choice`, `random`), où l'intérieur porte le CHEMIN
   * de graphie (`ref>id`, `wildcard>id`) et HÉRITE du statut de l'enveloppe : `{ref:{id}}` se lit
   * `ref>id / historique`, jamais `id / cible`.
   */
  const classementDeGraphie = (dataset: string, champ: string, sig: string) =>
    (GRAPHIES_ENVELOPPANTES as readonly string[]).includes(champ)
      ? { ...statutDe(CONCEPT_REFERENCE, champ, { dataset, champ }), signature: `${champ}>${sig}` }
      : statutDe(CONCEPT_REFERENCE, sig, { dataset, champ });

  /**
   * Une signature dont le `text` RÉSOUT porte le suffixe ` (résolvable)` : le lexique ne la connaît
   * pas, elle sort donc `divergente` — la forme `text` `declaree` ne couvre QUE l'irréductible
   * narratif (#1463 design v2, #624).
   */
  const resolvableTexte = (cl: Classement, resolvantes: ReadonlySet<string>): Classement =>
    resolvantes.has('text') ? statutDe(CONCEPT_REFERENCE, `${cl.signature} (résolvable)`) : cl;

  const ligneForme = (
    concept: Concept,
    p: Prepare,
    champ: string,
    cl: { statut: FormeObservee['statut']; note: string; signature: string },
  ) => {
    const k = [concept.id, p.nom, champ || '(racine)', cl.signature].join(' | ');
    if (!formes.has(k))
      formes.set(k, {
        concept: concept.id,
        strate: concept.strate,
        famille: p.famille,
        dataset: p.nom,
        champ: champ || '(racine)',
        signature: cl.signature,
        statut: cl.statut,
        note: cl.note,
        occurrences: 0,
        resolvables: 0,
        cibles: [],
        ciblesSet: new Set<string>(),
      });
    return formes.get(k)!;
  };

  const referencesParPorteur = new Map<object, Map<string | number, OccurrenceDeReference>>();
  const occurrencesDeReference: OccurrenceDeReference[] = [];
  /**
   * Compte UNE occurrence de référence à sa forme ET l'inscrit à ses cases `(porteur, clé)` : l'unique
   * site où la strate `Référence` compte, pour que le couple attribué soit celui de la forme (#1473).
   * Ses cases sont ses cases de RÉFÉRENCE : une clé de `CLES_DE_SPECIALISATION` n'en est pas une.
   */
  const inscrireReference = (
    concept: Concept,
    p: Prepare,
    champ: string,
    cl: { statut: FormeObservee['statut']; note: string; signature: string },
    porteur: object,
    cles: Iterable<string | number>,
  ) => {
    const ligne = ligneForme(concept, p, champ, cl);
    ligne.occurrences += 1;
    const occurrence: OccurrenceDeReference = { dataset: ligne.dataset, champ: ligne.champ };
    occurrencesDeReference.push(occurrence);
    if (!referencesParPorteur.has(porteur)) referencesParPorteur.set(porteur, new Map());
    for (const k of cles) if (!CLES_DE_SPECIALISATION.has(String(k))) referencesParPorteur.get(porteur)!.set(k, occurrence);
    return ligne;
  };

  for (const p of prepares) {
    const clesNiveau1 = new Map<string, CleNiveau1>();
    for (const e of p.entrees) {
      for (const [k, v] of Object.entries(e)) ajouteCle(clesNiveau1, k, v);
      inc(clesEnveloppe, signature(Object.keys(e)));
    }

    const noteGroupe = (chemin: string, o: Obj) => {
      const k = `${p.nom} | ${chemin}`;
      if (!groupes.has(k))
        groupes.set(k, {
          groupe: { document: p.nom, chemin, portee: 'embarqué', famille: p.famille, nbEntrees: 0, cles: [] },
          cles: new Map(),
        });
      const g = groupes.get(k)!;
      g.groupe.nbEntrees += 1;
      for (const [ck, cv] of Object.entries(o)) ajouteCle(g.cles, ck, cv);
    };

    parcourir(p.brut, (o, champ, chemin, dansTableau) => {
      objetsVus += 1;
      const cles = Object.keys(o);
      // Compte BRUT des clés-graphies enveloppantes, indépendant de tout classement : il borne par
      // le haut ce que les formes du concept `reference` en portent.
      for (const g of GRAPHIES_ENVELOPPANTES) if (g in o) inc(graphiesBrutes, g);
      const sig = signature(cles);
      const estRacine = p.racineEntrees.has(o);
      const estEmbarque = documentsEmbarques.has(o);
      const estDocument = estRacine || estEmbarque;

      // ---- Ops et Conditions
      const kind = typeof o.kind === 'string' ? o.kind : '';
      const condition = estCondition(o);
      if (typeof o.op === 'string') {
        if (condition) inc(conditionsAvecOp, kind);
        else {
          totalOps += 1;
          inc(ops, `${o.op} | ${sig} | ${p.nom}`);
          if (!/^[A-Za-z]/.test(o.op)) inc(opsComparateurs, `${o.op} | ${kind || '—'} | ${p.nom}`);
        }
      } else if (condition) inc(conditionsSansOp, kind);

      // ---- Résolution vers l'index
      const identite = estDocument ? identiteDe(o)?.cle : undefined;
      const resolvantes = new Set<string>();
      const cibles = new Set<string>();
      for (const [k, v] of Object.entries(o)) {
        if (k === identite || !resoutSite(p, o, champ, k, v)) continue;
        resolvantes.add(k);
        if (typeof v !== 'string') continue;
        for (const d of index.get(v) ?? []) cibles.add(d);
        if (k === 'text') for (const d of datasetsDuTexte(p, o, champ, v)) cibles.add(d);
      }

      // ---- `{text}` : mesuré même quand il ne résout pas (T6)
      if (typeof o.text === 'string') {
        if (!textes.has(sig)) textes.set(sig, { occurrences: 0, resolvables: 0 });
        const t = textes.get(sig)!;
        t.occurrences += 1;
        if (datasetsDuTexte(p, o, champ, o.text).length) t.resolvables += 1;
      }

      // ---- VALEUR d'abord (noyau propre), RÉFÉRENCE ensuite (index des ids)
      const candidats = candidatsStructurels(o, dansTableau);
      const valeur = classerValeur(sig, cles, { dataset: p.nom, champ, candidats });
      // Une ENTRÉE DE RACINE qu'aucun concept de valeur ne reconnaît ne peut être ni orpheline ni hors
      // strate (un document n'est sommé de rien, cf. la garde plus bas) : sans ce compte, elle sortirait
      // du dénominateur sans un mot le jour où un concept cesse de la revendiquer (#1657).
      if (estRacine && !valeur) {
        racinesSansValeur += 1;
        // Ce qu’AURAIT classé le lexique sans la clause : le compte brut ci-dessus noie 50 entrées
        // déclassées dans les 98 % de documents normaux — celui-ci les NOMME par document.
        if (designeUneEntite(cles) && classerValeur(sig, cles, { dataset: p.nom, champ, candidats, malgreDesignation: true }))
          inc(racinesDisqualifiees, p.nom);
      }
      let classe = false;
      if (valeur) {
        const c = CONCEPTS.find((x) => x.id === valeur.concept)!;
        ligneForme(c, p, champ, valeur).occurrences += 1;
        classe = true;
      } else if (resolvantes.size && !estDocument) {
        // Un `{text}` qui RÉSOUT est une forme à part entière : `text (résolvable)`, divergente, à
        // migrer en `{id}` (#624). Seul le `{text}` NON résolvable reste la forme `declaree`.
        const ligne = inscrireReference(CONCEPT_REFERENCE, p, champ, resolvableTexte(classementDeGraphie(p.nom, champ, signatureProjetee(cles, resolvantes)), resolvantes), o, resolvantes);
        for (const d of cibles) ligne.ciblesSet.add(d);
        if (resolvantes.has('text')) ligne.resolvables += 1;
        classe = true;
      } else if (!estDocument && cles.length && cles.every((k) => GRAPHIES_SANS_ID.has(k)) && champsPorteurs.has(champ)) {
        // GRAPHIE de référence sous un champ porteur MESURÉ, qu'elle résolve ou non : l'enveloppe
        // `{ref:{…}}` et la dotation `{text:"…"}` sont des FORMES, pas des objets hors strate.
        inscrireReference(CONCEPT_REFERENCE, p, champ, classementDeGraphie(p.nom, champ, sig), o, cles);
        classe = true;
      } else if (resolvantes.size && estDocument) {
        // Référence portée par un CHAMP SCALAIRE d'un document (`species: "humain"`).
        for (const k of resolvantes) {
          const ligne = inscrireReference(CONCEPT_REFERENCE, p, k, statutDe(CONCEPT_REFERENCE, 'id-nu'), o, [k]);
          for (const d of index.get(String(o[k])) ?? []) ligne.ciblesSet.add(d);
        }
        classe = true;
      }

      // ---- Listes d'ids nus (concept `refs`)
      const conceptRefs = CONCEPTS.find((c) => c.listeIdsNus)!;
      for (const [k, v] of Object.entries(o)) {
        if (!Array.isArray(v) || !v.length || !v.every((x) => typeof x === 'string')) continue;
        // Une clé de la GRAPHIE de référence n'ouvre pas un champ porteur À ELLE SEULE : elle fait
        // PARTIE du nœud de référence déjà classé ci-dessus. `choix: [ids]` énumère des
        // SPÉCIALISATIONS, bornées par le catalogue de l'entrée VISÉE (`noeudASpecialisation`,
        // `grammaire/ref.ts`) — pas une FK vers un dataset (DESIGN v2 S2 : la spéc est « déclarée au
        // registre du type, JAMAIS une FK »). Sans ce filtre, un id de spéc qui COLLISIONNE avec un
        // document indexé ouvrirait un couple (dataset, champ) fantôme au registre des slots.
        if (GRAPHIE_REFERENCE.has(k)) continue;
        if (!(v as string[]).some((x) => index.has(x) && ouvreReference(p.nom, k, x))) continue;
        const ligne = inscrireReference(conceptRefs, p, k, statutDe(conceptRefs, 'ids-nus'), v, v.keys());
        for (const x of v as string[]) for (const d of index.get(x) ?? []) ligne.ciblesSet.add(d);
        classe = true;
      }

      if (classe) objetsClasses += 1;

      // ---- ORPHELINES : ce qui annonce une référence et ne résout pas
      let orpheline = false;
      if (!estDocument && !classe && typeof o.op !== 'string') {
        const cleRef = cles.find((k) => RX_CLE_REFERENCE.test(k));
        const cleReservee = cles.find((k) => (CLES_RESERVEES as readonly string[]).includes(k));
        const cleIdentite = cles.find((k) => (CLES_IDENTITE as readonly string[]).includes(k));
        const motif: SignatureOrpheline['motif'] | null = cleRef
          ? 'clé de référence non résolue'
          : cleIdentite
            ? 'identité non résolue'
            : cleReservee
              ? 'clé réservée'
              : null;
        if (motif) {
          const k = [p.nom, champ || '(racine)', sig].join(' | ');
          if (!orphelines.has(k))
            orphelines.set(k, { dataset: p.nom, champ: champ || '(racine)', signature: sig, motif, occurrences: 0 });
          orphelines.get(k)!.occurrences += 1;
          orpheline = true;
        }
      }
      if (!estDocument && !classe && !orpheline) {
        objetsInvisibles += 1;
        inc(invisibles, `${p.nom} | ${champ || '(racine)'} | ${sig}`);
      }

      if (estEmbarque) noteGroupe(chemin || '(racine)', o);

      if ('arg' in o && 'id' in o) {
        const v = String(o.arg);
        if (!parametres.has(v)) parametres.set(v, { occurrences: 0, racines: new Set(), datasets: new Set() });
        const par = parametres.get(v)!;
        par.occurrences += 1;
        par.racines.add(p.racine);
        par.datasets.add(p.nom);
      }
      if ('price' in o) inc(regimesPrix, regimePrix(o.price));
      if ('source' in o) docsAvecSource.add(p.nom);
      for (const k of CLES_RESERVEES) {
        if (!(k in o)) continue;
        const classes = reservees.get(k)!;
        const cls = classeDeType(o[k]);
        if (!classes.has(cls)) classes.set(cls, new Map());
        inc(classes.get(cls)!, p.nom);
      }
    });

    const clesTriees = trieCles(clesNiveau1);
    for (const k of clesTriees) {
      if (!clesParDocument.has(k.cle)) clesParDocument.set(k.cle, []);
      clesParDocument.get(k.cle)!.push(`${p.nom}(${k.n})`);
    }
    documents.push({
      racine: p.racine,
      chemin: p.chemin,
      nom: p.nom,
      racineJson: p.racineJson,
      familleDeclaree: p.familleDeclaree,
      famille: p.famille,
      regime: p.regime,
      nbEntrees: p.entrees.length,
      clesNiveau1: clesTriees,
    });
  }

  const groupesEnveloppe: GroupeEnveloppe[] = [
    ...prepares.map((p): GroupeEnveloppe => ({
      document: p.nom,
      chemin: '(entrées)',
      portee: 'racine',
      famille: p.famille,
      identiteParCle: p.regime === 'valeurs',
      nbEntrees: p.entrees.length,
      cles: documents.find((d) => d.chemin === p.chemin)!.clesNiveau1,
    })),
    ...[...groupes.values()].map(({ groupe, cles }) => ({ ...groupe, cles: trieCles(cles) })),
  ].sort((a, b) => parUnitesDeCode(a.document, b.document) || parUnitesDeCode(a.chemin, b.chemin));

  const homonymes: Homonyme[] = CLES_RESERVEES.map((cle) => {
    const classes = reservees.get(cle)!;
    return {
      cle,
      classes: [...classes.keys()].sort(),
      total: [...classes.values()].reduce((a, m) => a + [...m.values()].reduce((x, y) => x + y, 0), 0),
      parClasse: [...classes]
        .sort((a, b) => parUnitesDeCode(a[0], b[0]))
        .map(([c, m]) => ({ classe: c, datasets: [...m].sort((a, b) => b[1] - a[1]).map(([d, n]) => `${d}:${n}`) })),
    };
  }).filter((h) => h.classes.length >= 2);

  const enveloppe = mesurerEnveloppe(groupesEnveloppe);
  const enveloppeParMotif = new Map<string, number>();
  for (const e of enveloppe) inc(enveloppeParMotif, `${e.role} | ${e.motif}`);

  const collisions: Collision[] = [...index]
    .filter(([, ds]) => ds.size >= 2)
    .map(([id, ds]) => ({ id, datasets: [...ds].sort() }))
    .sort((a, b) => b.datasets.length - a.datasets.length || parUnitesDeCode(a.id, b.id));

  /** Angle mort MESURÉ : un `label` qui est aussi un id indexé rend la résolution `{text}` ambiguë. */
  const labelsQuiSontDesIds = [...index.keys()].filter((id) => libelles.has(normaliserLibelle(id))).sort();

  return {
    documents,
    /** Le JSON PARSÉ de chaque document, keyé par nom : celui dont les objets portent les
     *  occurrences de `referencesParPorteur` (#1473). */
    brutParNom: new Map(prepares.map((p) => [p.nom, p.brut])) as ReadonlyMap<string, unknown>,
    referencesParPorteur: referencesParPorteur as ReferencesParPorteur,
    /** TOUTES les occurrences de la strate `Référence`, y compris celles sans case de référence (#1473). */
    occurrencesDeReference: occurrencesDeReference as readonly OccurrenceDeReference[],
    index: { ids: index.size, libelles: libelles.size, collisions, labelsQuiSontDesIds },
    /** Valeurs qui ne résolvent QUE vers un dataset hors des cibles majoritaires de leur site. */
    ambigues: [...ambigues.values()].sort(
      (a, b) => b.occurrences - a.occurrences || parUnitesDeCode(a.dataset, b.dataset) || parUnitesDeCode(a.valeur, b.valeur),
    ),
    groupesEnveloppe,
    enveloppe,
    enveloppeParMotif: [...enveloppeParMotif].sort().map(([k, n]) => ({ role: k.split(' | ')[0], motif: k.split(' | ')[1], documents: n })),
    clesParDocument: [...clesParDocument].sort((a, b) => parUnitesDeCode(a[0], b[0])),
    formes: [...formes.values()]
      .map(({ ciblesSet, ...f }) => ({ ...f, cibles: [...ciblesSet].sort() }))
      .sort(
        (a, b) =>
          parUnitesDeCode(a.concept, b.concept) ||
          parUnitesDeCode(a.dataset, b.dataset) ||
          parUnitesDeCode(a.champ, b.champ) ||
          parUnitesDeCode(a.signature, b.signature),
      ),
    /** Champs porteurs de référence MESURÉS : les clés de parent dont au moins un SITE porte
     *  majoritairement des références — jamais une déclaration du lexique, jamais un seuil. */
    champsDeReference: [...champsPorteurs].sort(),
    orphelines: [...orphelines.values()].sort(
      (a, b) => b.occurrences - a.occurrences || parUnitesDeCode(a.dataset, b.dataset) || parUnitesDeCode(a.signature, b.signature),
    ),
    homonymes,
    clesEnveloppe: [...clesEnveloppe].sort((a, b) => b[1] - a[1]),
    ops: [...ops]
      .map(([k, occurrences]): OpObservee => {
        const [op, sig, dataset] = k.split(' | ');
        return { op, signature: sig, dataset, occurrences };
      })
      .sort(
        (a, b) =>
          parUnitesDeCode(a.op, b.op) || b.occurrences - a.occurrences || parUnitesDeCode(a.signature, b.signature) || parUnitesDeCode(a.dataset, b.dataset),
      ),
    documentsSansSource: documents.filter((d) => !docsAvecSource.has(d.nom)).map((d) => d.nom).sort(),
    totalOps,
    conditions: [...new Set([...conditionsAvecOp.keys(), ...conditionsSansOp.keys()])]
      .map((kind) => ({ kind, avecOp: conditionsAvecOp.get(kind) ?? 0, sansOp: conditionsSansOp.get(kind) ?? 0 }))
      .sort((a, b) => b.avecOp + b.sansOp - (a.avecOp + a.sansOp) || parUnitesDeCode(a.kind, b.kind)),
    totalConditionsAvecOp: [...conditionsAvecOp.values()].reduce((a, b) => a + b, 0),
    totalConditionsSansOp: [...conditionsSansOp.values()].reduce((a, b) => a + b, 0),
    opsComparateurs: [...opsComparateurs]
      .map(([k, occurrences]) => {
        const [op, kind, dataset] = k.split(' | ');
        return { op, kind, dataset, occurrences };
      })
      .sort((a, b) => b.occurrences - a.occurrences || parUnitesDeCode(a.op, b.op)),
    textes: [...textes]
      .map(([sig, t]) => ({ signature: sig, ...t }))
      .sort((a, b) => b.occurrences - a.occurrences || parUnitesDeCode(a.signature, b.signature)),
    parametres: [...parametres]
      .map(([valeur, p]): Parametre => ({
        valeur,
        occurrences: p.occurrences,
        racines: [...p.racines].sort(),
        datasets: [...p.datasets].sort(),
        nature: natureParametre(valeur),
      }))
      .sort((a, b) => b.occurrences - a.occurrences || parUnitesDeCode(a.valeur, b.valeur)),
    regimesPrix: [...regimesPrix].sort((a, b) => b[1] - a[1]),
    objets: {
      vus: objetsVus,
      classes: objetsClasses,
      invisibles: objetsInvisibles,
      racinesSansValeur,
      racinesDisqualifiees: [...racinesDisqualifiees].map(([dataset, entrees]) => ({ dataset, entrees })).sort((a, b) => b.entrees - a.entrees || parUnitesDeCode(a.dataset, b.dataset)),
      documentsEmbarques: documentsEmbarques.size,
      entreesDeRacine: prepares.reduce((a, p) => a + p.entrees.length, 0),
    },
    graphiesBrutes: Object.fromEntries(graphiesBrutes),
    invisibles: [...invisibles]
      .map(([k, occurrences]) => {
        const [dataset, champ, sig] = k.split(' | ');
        return { dataset, champ, signature: sig, occurrences };
      })
      .sort((a, b) => b.occurrences - a.occurrences || parUnitesDeCode(a.dataset, b.dataset)),
  };
}

/**
 * LE scan du corpus : l'UNIQUE composition `defs du registre → familles + enums DÉCLARÉS →
 * `scannerDonnees``. Ses trois consommateurs — la garde `src/data/structures-contrat.test.ts`, le
 * générateur `scripts/docs/build-structures.mts` et l'audit `scripts/guards/lib/horsStrateAudit.ts`
 * — la lisent ICI : une composition recopiée ferait mesurer à l'un ce que l'autre ne mesure pas
 * (sans `familles`, le régime d'entrées se déduit de la racine JSON ; sans `choix`, aucun enum n'est
 * fermé et des discriminants comptent comme références), et aucune garde ne verrait la divergence.
 * Tout est rendu — `defs`, `declares`, `familles`, `choix`, `scan` — parce que chaque consommateur
 * en lit une part différente et qu'aucun ne doit refabriquer la sienne.
 */
export function scanDuCorpus(root: string) {
  const defs = defsDeDocument();
  const declares = introspecterDefs(defs);
  const familles = new Map(declares.map((d) => [d.file, d.famille]));
  const choix = choixDeclares(defs);
  return { defs, declares, familles, choix, scan: scannerDonnees(root, familles, choix) };
}

/**
 * Divergences d'ENVELOPPE, une ligne par (rôle, clé, motif, document, chemin) — le dénominateur du
 * lot L1b (#1467). Quatre motifs :
 *   `clé divergente`  — le rôle est porté sous un autre nom que sa cible (`key`/`nom` pour l'identité) ;
 *   `type divergent`  — la clé cible est là, sa classe de type ne l'est pas (`source` en chaîne) ;
 *   `clé absente`     — une ENTRÉE DE RACINE ne porte nulle part la clé cible d'un rôle requis
 *                       (`id`, `type` et `source` partout, `label` sur les familles `entité`/`table`),
 *                       ni l'`alternative` déclarée par le rôle (`maison` pour `source`) ;
 *   `cible partielle` — un rôle `entiere` (le `type` du document) est porté par une PARTIE des
 *                       entrées du groupe, de racine ou EMBARQUÉ.
 * Hors rôle `entiere`, un document EMBARQUÉ ne compte que ses clés DIVERGENTES : il n'est jamais
 * sommé de porter un `id`.
 */
export function mesurerEnveloppe(groupes: readonly GroupeEnveloppe[]): DivergenceEnveloppe[] {
  const out: DivergenceEnveloppe[] = [];
  for (const g of groupes) {
    const parCle = new Map(g.cles.map((k) => [k.cle, k]));
    for (const [role, def] of Object.entries(ROLES_ENVELOPPE)) {
      for (const cle of def.divergentes) {
        const vue = parCle.get(cle);
        if (vue)
          out.push({ role, cle, motif: 'clé divergente', detail: '', document: g.document, chemin: g.chemin, entrees: vue.n });
      }
      if (!def.cible) continue;
      const cible = parCle.get(def.cible);
      if (!cible) {
        const requise = def.requise || (def.requiseSurFamilles?.includes(g.famille) ?? false);
        const porteeParCle = role === 'identité' && g.identiteParCle;
        const satisfaitAutrement = def.alternative !== undefined && parCle.has(def.alternative);
        if (requise && !porteeParCle && !satisfaitAutrement && g.portee === 'racine' && g.nbEntrees > 0)
          out.push({ role, cle: def.cible, motif: 'clé absente', detail: '', document: g.document, chemin: g.chemin, entrees: g.nbEntrees });
        continue;
      }
      if (def.entiere && cible.n < g.nbEntrees)
        out.push({
          role,
          cle: def.cible,
          motif: 'cible partielle',
          detail: `${cible.n}/${g.nbEntrees}`,
          document: g.document,
          chemin: g.chemin,
          entrees: g.nbEntrees - cible.n,
        });
      if (!def.typeAttendu) continue;
      for (const { classe, n } of cible.parClasse)
        if (classe !== def.typeAttendu)
          out.push({ role, cle: def.cible, motif: 'type divergent', detail: classe, document: g.document, chemin: g.chemin, entrees: n });
    }
  }
  return out.sort(
    (a, b) =>
      parUnitesDeCode(a.role, b.role) ||
      parUnitesDeCode(a.cle, b.cle) ||
      parUnitesDeCode(a.motif, b.motif) ||
      parUnitesDeCode(a.detail, b.detail) ||
      parUnitesDeCode(a.document, b.document) ||
      parUnitesDeCode(a.chemin, b.chemin),
  );
}

// ---------------------------------------------------------------------------
// Redéclarations LOCALES : AST des `defs/*.ts`, littéraux d'objet passés à z.object/strictObject/
// looseObject dont la signature recoupe le lexique ou un schéma de la grammaire partagée.
// ---------------------------------------------------------------------------

/** Un `createSourceFile` par fichier et par run (T9). */
const CACHE_SOURCE = new Map<string, ts.SourceFile>();
const sourceDe = (fichier: string, texte: () => string) => {
  const vu = CACHE_SOURCE.get(fichier);
  if (vu) return vu;
  const sf = ts.createSourceFile(fichier, texte(), ts.ScriptTarget.Latest, true);
  CACHE_SOURCE.set(fichier, sf);
  return sf;
};
/** Les fichiers de la GRAMMAIRE partagée (`src/data/schemas/grammaire/`) — un schéma commun y vit,
 *  jamais dans un def. LUS AU DOSSIER : un module de grammaire ajouté est couvert sans liste à tenir. */
const fichiersGrammaire = (root: string) =>
  listerDossier(join(root, 'src/data/schemas/grammaire')).filter((f) => f.endsWith('.ts') && !f.includes('.test.'));
const sourcesGrammaire = (root: string) =>
  fichiersGrammaire(root).map((nom) => {
    const fichier = join(root, 'src/data/schemas/grammaire', nom);
    return sourceDe(fichier, () => readFileSync(fichier, 'utf8'));
  });

/** `kind` reconnus par `conditionSchema` (`src/data/schemas/grammaire/mecanique.ts`) — lus par AST,
 *  jamais listés à la main : une Condition en donnée porte un `op` (comparateur) qui n'est PAS une
 *  op de jeu. */
function kindsDeCondition(root: string): Set<string> {
  const out = new Set<string>();
  const collecte = (n: ts.Node) => {
    if (
      ts.isPropertyAssignment(n) &&
      ts.isIdentifier(n.name) &&
      n.name.text === 'kind' &&
      ts.isCallExpression(n.initializer) &&
      ts.isPropertyAccessExpression(n.initializer.expression) &&
      n.initializer.expression.name.text === 'literal' &&
      n.initializer.arguments.length &&
      ts.isStringLiteral(n.initializer.arguments[0])
    )
      out.add((n.initializer.arguments[0] as ts.StringLiteral).text);
    ts.forEachChild(n, collecte);
  };
  const visite = (n: ts.Node) => {
    if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.name.text === 'conditionSchema' && n.initializer)
      collecte(n.initializer);
    ts.forEachChild(n, visite);
  };
  for (const sf of sourcesGrammaire(root)) visite(sf);
  return out;
}

/**
 * Schémas COMMUNS candidats, par signature de clés (lus dans la grammaire par AST). Le schéma dont la
 * signature est celle de son littéral RACINE l'emporte sur celui qui ne la porte qu'en sous-objet
 * (`refSchema` plutôt que le `hasSkill` niché de `flowTestSchema`) — sinon le gagnant dépendrait de
 * l'ordre de lecture des fichiers de la grammaire.
 */
function schemasCommuns(root: string): Map<string, string> {
  const racines = new Map<string, string>();
  const niches = new Map<string, string>();
  const visite = (node: ts.Node, sf: ts.SourceFile) => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) {
      for (const lit of litterauxZod(node.initializer, sf)) {
        const sig = signature(lit.cles);
        if (!sig) continue;
        const cible = lit.champ === '' ? racines : niches;
        if (!cible.has(sig)) cible.set(sig, node.name.text);
      }
    }
    ts.forEachChild(node, (n) => visite(n, sf));
  };
  for (const sf of sourcesGrammaire(root)) visite(sf, sf);
  for (const [sig, nom] of niches) if (!racines.has(sig)) racines.set(sig, nom);
  return racines;
}

/** Nom de la propriété qui PORTE ce littéral (le champ, quand il y en a un). */
const champDuLitteral = (lit: ts.Node): string => {
  for (let n: ts.Node | undefined = lit.parent; n; n = n.parent) {
    if (ts.isPropertyAssignment(n) && (ts.isIdentifier(n.name) || ts.isStringLiteral(n.name))) return n.name.text;
    if (ts.isVariableDeclaration(n)) return '';
  }
  return '';
};

/**
 * Tous les littéraux d'objet argument d'un `z.object|strictObject|looseObject` sous `node`, PLUS
 * l'argument `champs` (3ᵉ) de la fabrique `document()` (#1467) — même plan de forme, sans fabrique
 * zod autour. Sans cette porte, l'adoption de la fabrique par un def FAISAIT DISPARAÎTRE ses
 * redéclarations du relevé : une perte de COUVERTURE que le cliquet décroissant lisait comme un
 * solde (`interludeEvents` min/max, toujours déclarés, donnée inchangée).
 * Les deux graphies de `champs` sont admises : littéral INLINE et const NOMMÉE référencée.
 */
function litterauxZod(node: ts.Node, sf: ts.SourceFile) {
  const out: Array<{ ligne: number; champ: string; cles: string[] }> = [];
  const constsObjet = new Map<string, ts.ObjectLiteralExpression>();
  const releve = (n: ts.Node) => {
    if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.initializer && ts.isObjectLiteralExpression(n.initializer)) {
      constsObjet.set(n.name.text, n.initializer);
    }
    ts.forEachChild(n, releve);
  };
  releve(node);
  const pousse = (lit: ts.ObjectLiteralExpression, champ: string) => {
    out.push({
      ligne: sf.getLineAndCharacterOfPosition(lit.getStart(sf)).line + 1,
      champ,
      cles: lit.properties.flatMap((p) => (p.name && (ts.isIdentifier(p.name) || ts.isStringLiteral(p.name)) ? [p.name.text] : [])),
    });
  };
  const visite = (n: ts.Node) => {
    if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === 'document') {
      const arg = n.arguments[2];
      const lit =
        arg && ts.isObjectLiteralExpression(arg) ? arg : arg && ts.isIdentifier(arg) ? constsObjet.get(arg.text) : undefined;
      if (lit) pousse(lit, champDuLitteral(n));
    }
    if (
      ts.isCallExpression(n) &&
      ts.isPropertyAccessExpression(n.expression) &&
      ['object', 'strictObject', 'looseObject'].includes(n.expression.name.text) &&
      n.arguments.length &&
      ts.isObjectLiteralExpression(n.arguments[0])
    ) {
      const lit = n.arguments[0] as ts.ObjectLiteralExpression;
      out.push({
        ligne: sf.getLineAndCharacterOfPosition(lit.getStart(sf)).line + 1,
        champ: champDuLitteral(n),
        cles: lit.properties.flatMap((p) =>
          p.name && (ts.isIdentifier(p.name) || ts.isStringLiteral(p.name)) ? [p.name.text] : [],
        ),
      });
    }
    ts.forEachChild(n, visite);
  };
  visite(node);
  return out;
}

type LitteralDef = { def: string; ligne: number; champ: string; cles: string[] };

/** Cache par racine : les `defs/*.ts` ne sont parsés qu'UNE fois par run. */
const CACHE_LITTERAUX = new Map<string, LitteralDef[]>();

/** Tous les littéraux d'objet zod des `defs/*.ts`, avec leur `def:ligne`, leur champ et leurs clés. */
function litterauxDefs(root: string): LitteralDef[] {
  const cache = CACHE_LITTERAUX.get(root);
  if (cache) return cache;
  const dir = join(root, 'src/data/schemas/defs');
  const out: LitteralDef[] = [];
  for (const f of listerDossier(dir).filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts'))) {
    const chemin = join(dir, f);
    const sf = sourceDe(chemin, () => readFileSync(chemin, 'utf8'));
    for (const lit of litterauxZod(sf, sf)) out.push({ def: f, ...lit });
  }
  CACHE_LITTERAUX.set(root, out);
  return out;
}

/**
 * Empreinte d'un concept dans les defs par critère SUPERSET de clés — indépendante du classement
 * ordonné : un littéral qui porte à la fois `min`/`max` et `book` compte dans les deux.
 */
export function empreintesDefs(root: string) {
  const lits = litterauxDefs(root);
  return CONCEPTS.filter((c) => c.noyau?.length).map((c) => {
    const hits = lits.filter((l) => c.noyau!.filter((k) => l.cles.includes(k)).length >= (c.noyauMin ?? c.noyau!.length));
    return {
      concept: c.id,
      noyau: c.noyau!.join(','),
      noyauMin: c.noyauMin ?? c.noyau!.length,
      litteraux: hits.length,
      defs: [...new Set(hits.map((h) => h.def))].sort(),
      /** Site NOMINATIF de chaque littéral : `def:ligne`, champ porteur, clés PRÉSENTES du noyau. */
      sites: hits
        .map((h) => ({
          site: `${h.def}:${h.ligne}`,
          champ: h.champ,
          cles: c.noyau!.filter((k) => h.cles.includes(k)),
        }))
        .sort((a, b) => parUnitesDeCode(a.site, b.site)),
    };
  });
}

export type Redeclaration = {
  def: string;
  ligne: number;
  champ: string;
  signature: string;
  concept: string;
  statut: string;
  commun: string;
};

/**
 * Classement d'un LITTÉRAL de schéma : aucune donnée à résoudre ici, donc une valeur par son noyau,
 * une référence par sa GRAPHIE exacte au lexique — jamais par projection (un schéma déclare ses
 * clés, il n'a pas de charge utile à replier).
 */
const classerLitteral = (sig: string, cles: readonly string[], champ: string): Classement | null => {
  // `dataset: ''` : un littéral de schéma n'a pas de dataset porteur — seules les entrées NUES du
  // lexique lui répondent, comme `statutDe` le documente.
  const valeur = classerValeur(sig, cles, { dataset: '', champ, candidats: CONCEPTS_STRUCTURELS.map((c) => c.id) });
  if (valeur) return valeur;
  const hit = CONCEPT_REFERENCE.signatures.find((s) => s.sig === sig);
  return hit ? statutDe(CONCEPT_REFERENCE, sig) : null;
};

/** Redéclarations locales dans `src/data/schemas/defs/*.ts` (un seul walk des defs). */
export function scannerRedeclarations(root: string): { redeclarations: Redeclaration[]; totalLitteraux: number } {
  const communs = schemasCommuns(root);
  const lits = litterauxDefs(root);
  const out: Redeclaration[] = [];
  for (const lit of lits) {
    const sig = signature(lit.cles);
    if (!sig) continue;
    const cl = classerLitteral(sig, lit.cles, lit.champ);
    const commun = communs.get(sig);
    if (!cl && !commun) continue;
    out.push({
      def: lit.def,
      ligne: lit.ligne,
      champ: lit.champ,
      signature: cl?.signature ?? sig,
      concept: cl?.concept ?? '',
      statut: cl?.statut ?? 'hors lexique',
      commun: commun ?? '',
    });
  }
  return { redeclarations: out, totalLitteraux: lits.length };
}
