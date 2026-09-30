// Corpus SOURCE d'un jeu de dossiers : la marche de dossiers + la lecture, en UN seul endroit —
// la marche de `listerArbre` + le `readFileSync` des gardes qui balaient l'arbre réel de `src/**`.
// Consommateurs : TOUTE garde qui balaie l'arbre réel de `src/**` — aucun compte n'est écrit ici, il
// périmerait au premier import suivant ; la liste se CALCULE (`grep -rl sourceCorpus.mjs src scripts`).
//
// SOURCE : un `.d.ts` n'en est pas une (aucun corps) — il est hors corpus SANS option (`EST_DECLARATION`).
// Ni un INSTRUMENT Vitest : la suite `.test.` comme le banc `.bench.`, dans TOUS les dialectes lus
// ici (`.ts`/`.tsx` de `src`, `.mts`/`.mjs` de `scripts/qc`). Le prédicat vit en UN exemplaire,
// `fichierVitest.mjs` — ce corpus le CONSOMME, il n'en tient pas une seconde copie.
//
// FRONTIÈRE : cette lib LIT, MÉMOÏSE sa lecture et dit si une déclaration gardée s'applique à un
// fichier (`sAppliqueA`) ; elle n'interprète pas un texte (aucun AST, aucun verdict).
// Un chemin est lu UNE fois par worker, quelle que soit la clé (`ENTREES`) ; la liste d'une clé est
// marchée une fois — la clé est le CONTENU des paramètres (dossiers normalisés en chemin POSIX depuis
// la racine, extensions, `tests`). Les deux mémos vivent aussi longtemps que le graphe de modules :
// sous `isolate: false` (`vite.config.ts`), le worker Vitest entier, partagé par tous les fichiers de
// test qu'il joue.
//
// CONDITION DE LICÉITÉ : l'arbre scanné est STATIQUE pendant un run. Sous vitest, l'unique écrivain
// de `src/**` est `genAll()` du plugin `registryGen` (`vite.config.ts`, hook `buildStart`) : il
// écrit `src/**/_registry.generated.ts`, `src/data/schemas/_art.generated.ts` et les sorties de sa
// phase 2 (`scripts/gen-espaces.mts`) dans le processus vite-node PRINCIPAL, avant le démarrage des
// workers, et seulement quand le contenu diffère (`ecrireDoc`, scripts/docs/lib/ecriture-derives.mjs).
// Aucune gate n'écrit dans l'arbre (`photoArbre`, `scripts/gates/toutes.mjs`). Une clé NEUVE ne relit
// pas un chemin déjà lu : après une écriture, elle rendrait l'ancien texte des chemins connus et le
// texte frais des chemins nouveaux. Un appelant qui écrirait dans un dossier scanné entre deux
// lectures a sa porte : `viderCorpus()`.
//
// PRIX : le corpus est RETENU par le worker jusqu'à sa fin — ses TEXTES, rien de dérivé. Un AST, un
// index, une liste `map`/`flatMap`/`filter`, un texte `join`, un mémo sur l'identité du corpus vivent
// chez l'appelant, le temps de l'appel ou du fichier de test qui les a demandés (`tsProgram.mjs`,
// en-tête ; garde `analyseRetenue.mjs`). Un chemin n'a qu'UNE entrée, donc qu'UN texte, quelle que
// soit la clé qui le lit (`ENTREES`) : les clés qui se recouvrent (`src` dans `['src']`,
// `['src','scripts']`, `SCAN_DIRS` de `registryIdBranch.mjs`) ne paient qu'une fois le texte commun.
// Mesure #1801 (2026-09-27), trois clés co-résidentes (`src` + tests ; `src`+`scripts` × 4
// extensions + tests ; `SCAN_DIRS` × 5 extensions + tests) : 81 Mo, contre 222 Mo quand chaque clé
// tient ses propres textes.
//
// IMMUABLE : tableau et entrées gelés ; deux appels de même clé rendent le MÊME tableau, et deux clés
// qui lisent le même chemin rendent la MÊME entrée.
// Une déclaration gardée s'applique à un fichier par `sAppliqueA` : ni dans son `foyer`, ni hors de
// son `domaine`. Les autres filtres de périmètre (dossiers, extensions, exclusions qui sont une DETTE
// mesurée) restent chez l'appelant : ils font partie de ce que la garde mesure (#2018, #2019).
//
// REFUS DU VIDE : une BASE qui rend 0 fichier LÈVE, en la nommant (dossier POSIX, extensions,
// `tests`). PAR BASE et non sur le total : les clés multi-dossiers sont la norme
// (`['src','scripts']`) — sur un total agrégé, une moitié de
// corpus qui s'évapore reste MUETTE derrière l'autre. Un corpus vide rend toute garde de corpus
// verte par vacuité — son assertion `offenders == []` est satisfaite sans que rien n'ait été lu, et
// le rouge est MUET. `listerArbre` lève déjà sur un dossier ABSENT (`listerDossier`, `lister.mjs`) ; ce refus
// ferme l'autre moitié : dossier présent, zéro fichier pour les extensions demandées.
// Aucune exemption : les clés de TOUS les appelants ont été journalisées avec leur cardinal
// (2026-09-07, #1709), aucune ne rend 0 — un appelant qui lit un dossier temporaire qu'il
// fabrique y écrit AVANT de lire.
import { readFileSync } from 'node:fs';
import { isAbsolute, join, relative } from 'node:path';
import { listerArbre } from './lister.mjs';
import { estFichierVitest } from './fichierVitest.mjs';
import { fileURLToPath } from 'node:url';

/** Racine du dépôt : `scripts/guards/lib/` → `../../../`. */
const ROOT = fileURLToPath(new URL('../../../', import.meta.url)).replace(/[\\/]$/, '');

/** Fichier de DÉCLARATION `.d.ts` : aucun corps, il ne peut porter aucun des motifs que les gardes
 *  cherchent, et sa présence rend faux tout compte de « modules de production ». Hors corpus SANS
 *  option, quelles que soient les `exts` demandées. Le filtre ne vise QUE `.d.ts` : les déclarations
 *  d'autres extensions (`.d.mts` de `scripts/`, `.d.cts`) restent dans les corpus qui les demandent. */
const EST_DECLARATION = /\.d\.ts$/;

/**
 * Le fichier est-il retenu par un corpus de ces options ? Le prédicat que `readCorpus` applique dans
 * sa marche : une extension de `exts`, un INSTRUMENT Vitest seulement sous `tests`, jamais un `.d.ts`.
 * @param {string} nom nom ou chemin du fichier
 * @param {{ exts?: readonly string[], tests?: boolean }} [opts] mêmes défauts que `readCorpus`
 * @returns {boolean}
 */
export function estRetenu(nom, { exts = ['.ts', '.tsx'], tests = false } = {}) {
  return exts.some((e) => nom.endsWith(e)) && (tests || !estFichierVitest(nom)) && !EST_DECLARATION.test(nom);
}

/**
 * Une déclaration gardée (construction réservée, recopie d'un canon, famille d'un garde-fou)
 * s'applique-t-elle à ce fichier ? Son FOYER est le fichier où ce qu'elle garde est légitime parce
 * qu'il le DÉCLARE ou le fixe par contrat (ni le foyer d'une lampe ni celui d'une règle) ; son
 * DOMAINE, le prédicat du chemin des fichiers où elle s'applique. Vraie hors du foyer et dans le
 * domaine ; `foyer` absent : aucun, `domaine` absent : tous.
 * @param {{ rel: string }} fichier
 * @param {{ readonly foyer?: string | readonly string[], readonly domaine?: (rel: string) => boolean }} declaration
 * @returns {boolean}
 */
export function sAppliqueA(fichier, declaration) {
  return ![declaration.foyer ?? []].flat().includes(fichier.rel) && (declaration.domaine?.(fichier.rel) ?? true);
}

/** Chemin POSIX depuis la racine du dépôt (`src/state`, `../Temp/xyz` pour une racine hors dépôt). */
const posixDepuisRacine = (p) => relative(ROOT, p).split('\\').join('/');

/** Corpus par CLÉ de contenu des paramètres. Vit aussi longtemps que ce module — soit, sous
 *  `isolate: false`, le worker Vitest entier. @type {Map<string, ReadonlyArray<Readonly<{ abs: string, rel: string, text: string }>>>} */
const CORPUS = new Map();

/** Entrée gelée par chemin ABSOLU, partagée par toutes les clés : un chemin n'a qu'un texte.
 *  @type {Map<string, Readonly<{ abs: string, rel: string, text: string }>>} */
const ENTREES = new Map();

/** L'entrée de `p`, lue au disque la première fois qu'une clé la demande. @param {string} p */
function entreeDe(p) {
  let e = ENTREES.get(p);
  if (!e) ENTREES.set(p, (e = Object.freeze({ abs: p, rel: posixDepuisRacine(p), text: readFileSync(p, 'utf8') })));
  return e;
}

/**
 * Fichiers source de `dirs` (absolus, ou relatifs à la racine du dépôt), parcourus RÉCURSIVEMENT
 * en ORDRE TOTAL (`listerArbre`), avec leur texte. Lus UNE fois par clé (dossiers + extensions +
 * `tests`) : un second appel de même clé rend le MÊME tableau, sans toucher le disque.
 * @param {string[]} dirs l'ORDRE compte — il décide de l'ordre du résultat, donc de la clé. Chaque
 *   dossier est normalisé en chemin POSIX depuis la racine AVANT d'entrer dans la clé : absolu et
 *   relatif désignent le même corpus, `src/x/` comme `src/x`. La CASSE n'est pas normalisée — sur
 *   Windows `SRC/x` est une clé distincte, donc un mémo manqué, jamais un corpus faux.
 * @param {{ exts?: string[], tests?: boolean }} [opts] `exts` = extensions retenues
 *   (défaut `.ts`/`.tsx`) ; `tests` = garder les INSTRUMENTS Vitest — suites `.test.` ET bancs
 *   `.bench.`, tous dialectes (`estFichierVitest`, `fichierVitest.mjs`) — (défaut : non). L'option
 *   INCLUT exactement ce que le filtre exclut : un seul prédicat décide des deux côtés. Les `*.d.ts`
 *   sont hors corpus, sans option (cf. `EST_DECLARATION`).
 * @returns {ReadonlyArray<Readonly<{ abs: string, rel: string, text: string }>>} gelé, `rel` =
 *   chemin POSIX depuis la racine.
 * @throws {Error} si l'une des bases rend 0 fichier (voir REFUS DU VIDE, en-tête).
 */
export function readCorpus(dirs, { exts = ['.ts', '.tsx'], tests = false } = {}) {
  const bases = dirs.map((d) => (isAbsolute(d) ? d : join(ROOT, d)));
  const cle = JSON.stringify([bases.map(posixDepuisRacine), [...exts].sort(), tests]);
  const memo = CORPUS.get(cle);
  if (memo) return memo;
  const parBase = bases.map((base) => listerArbre(base, { filtre: (nom) => estRetenu(nom, { exts, tests }) }));
  const vide = parBase.findIndex((noms) => noms.length === 0);
  if (vide >= 0) {
    throw new Error(
      `readCorpus : CORPUS VIDE — 0 fichier sous [${posixDepuisRacine(bases[vide])}] ` +
        `pour les extensions [${exts.join(', ')}] (tests: ${tests}) ` +
        `— clé demandée [${bases.map(posixDepuisRacine).join(', ')}]. ` +
        `Un corpus vide rendrait toute garde verte par vacuité.`,
    );
  }
  const lu = Object.freeze(
    bases.flatMap((base, i) =>
      parBase[i].map((rel) => entreeDe(join(base, rel))),
    ),
  );
  CORPUS.set(cle, lu);
  return lu;
}

/** Relâche tous les corpus mémoïsés : la lecture suivante retourne au disque. C'est la PORTE de la
 *  condition de licéité du mémo (voir l'en-tête) — un appelant qui ÉCRIT dans un dossier scanné
 *  entre deux lectures la franchit. Aucune garde ne l'appelle : `genAll()` écrit avant les workers,
 *  et aucune gate de la CI n'écrit dans l'arbre. Les tests de cette lib l'appellent.
 *  PRIX : le relâchement est TOTAL (toutes les clés et toutes les entrées du worker, pas la sienne) :
 *  l'IDENTITÉ des tableaux et des entrées est perdue, et les corpus réels se relisent au disque. Une fixture `mkdtemp` supprimée ne
 *  la justifie pas : sa clé est unique à chaque run, elle ne peut répondre pour aucun corpus réel. */
export function viderCorpus() {
  CORPUS.clear();
  ENTREES.clear();
}
