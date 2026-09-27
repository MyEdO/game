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
// FRONTIÈRE : cette lib LIT et MÉMOÏSE sa lecture, elle n'interprète pas (aucun AST, aucun verdict).
// Un corpus est lu UNE fois par clé — la clé est le CONTENU des paramètres (dossiers normalisés en
// chemin POSIX depuis la racine, extensions, `tests`) — et le mémo vit aussi longtemps que le graphe
// de modules : sous `isolate: false` (`vite.config.ts`), le worker Vitest entier, partagé par tous
// les fichiers de test qu'il joue.
//
// CONDITION DE LICÉITÉ : l'arbre scanné est STATIQUE pendant un run. Sous vitest, l'unique écrivain
// de `src/**` est `genAll()` du plugin `registryGen` (`vite.config.ts`, hook `buildStart`) : il
// écrit `src/**/_registry.generated.ts` et `src/data/schemas/_art.generated.ts` dans le processus
// vite-node PRINCIPAL, avant le démarrage des workers, et seulement quand le contenu diffère (`genOne`,
// `genArt` de `scripts/gen-registry.mjs`). Les autres écrivains de l'arbre sont des gates, jouées EN
// SÉRIE avant les lanes de lecture (`AVANT_LES_LANES`, `scripts/gates/toutes.mjs`). Un appelant qui
// écrirait dans un dossier scanné entre deux lectures a sa porte : `viderCorpus()`.
//
// PRIX : le corpus est RETENU par le worker jusqu'à sa fin. Mesuré 2026-09-07 sur cet arbre, toutes
// les clés des appelants co-résidentes : 132,1 Mo de texte pour 8 clés (dont 35,9 Mo pour
// `['src','scripts']` × 5 extensions × `tests`, 4 314 fichiers).
//
// IMMUABLE : tableau et entrées gelés, et deux appels de même clé rendent le MÊME tableau avec les
// MÊMES entrées — c'est cette identité qui porte les mémos par identité des appelants (la `WeakMap`
// d'AST de `canonUnique.mjs`), d'un fichier de test à l'autre du même worker.
// Les FILTRES de périmètre (exclusions nominatives, dossiers de whitelist) restent chez l'appelant :
// ils font partie de ce que la garde MESURE.
//
// REFUS DU VIDE : une BASE qui rend 0 fichier LÈVE, en la nommant (dossier POSIX, extensions,
// `tests`). PAR BASE et non sur le total : les clés multi-dossiers sont la norme (`STRICT_DIRS` /
// `RATCHET_DIRS` de `labelLogic.mjs`, `['src','scripts']`) — sur un total agrégé, une moitié de
// corpus qui s'évapore reste MUETTE derrière l'autre. Un corpus vide rend toute garde de corpus
// verte par vacuité — son assertion `offenders == []` est satisfaite sans que rien n'ait été lu, et
// le rouge est MUET. `listerArbre` lève déjà sur un dossier ABSENT (`lister.mjs:41-48`) ; ce refus
// ferme l'autre moitié : dossier présent, zéro fichier pour les extensions demandées.
// Aucune exemption : les clés de TOUS les appelants ont été journalisées avec leur cardinal
// (2026-09-07, #1709 C3s), aucune ne rend 0 — un appelant qui lit un dossier temporaire qu'il
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

/** Chemin POSIX depuis la racine du dépôt (`src/state`, `../Temp/xyz` pour une racine hors dépôt). */
const posixDepuisRacine = (p) => relative(ROOT, p).split('\\').join('/');

/** Corpus par CLÉ de contenu des paramètres. Vit aussi longtemps que ce module — soit, sous
 *  `isolate: false`, le worker Vitest entier. @type {Map<string, ReadonlyArray<Readonly<{ abs: string, rel: string, text: string }>>>} */
const CORPUS = new Map();

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
  const garde = (nom) =>
    exts.some((e) => nom.endsWith(e)) &&
    (tests || !estFichierVitest(nom)) &&
    !EST_DECLARATION.test(nom);
  const parBase = bases.map((base) => listerArbre(base, { filtre: garde }));
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
      parBase[i].map((rel) => {
        const p = join(base, rel);
        return Object.freeze({ abs: p, rel: posixDepuisRacine(p), text: readFileSync(p, 'utf8') });
      }),
    ),
  );
  CORPUS.set(cle, lu);
  return lu;
}

/** Relâche tous les corpus mémoïsés : la lecture suivante retourne au disque. C'est la PORTE de la
 *  condition de licéité du mémo (voir l'en-tête) — un appelant qui ÉCRIT dans un dossier scanné
 *  entre deux lectures la franchit. Aucune garde ne l'appelle : `genAll()` écrit avant les workers,
 *  les gates écrivantes tournent avant les lanes. Les tests de cette lib l'appellent.
 *  PRIX : le relâchement est TOTAL (toutes les clés du worker, pas la sienne) et l'IDENTITÉ des
 *  tableaux et des entrées est perdue — les mémos par identité des appelants (`canonUnique.mjs`)
 *  repartent de zéro, et les corpus réels se relisent au disque. Une fixture `mkdtemp` supprimée ne
 *  la justifie pas : sa clé est unique à chaque run, elle ne peut répondre pour aucun corpus réel. */
export function viderCorpus() {
  CORPUS.clear();
}
