// Mécanique de scan du garde-fou « lien mort dans la mémoire persistante ».
//
// PORTÉE DÉCLARÉE — l'INDEX VIVANT, c'est-à-dire les `.md` à plat de `.claude/memory/`. Deux
// vérifications déterministes, chacune rendant `{ file, line, kind, tok }` :
//   1. WIKI     — tout `[[nom]]` (formes `[[nom|alias]]`, `[[nom#ancre]]`, `[[nom.md]]` comprises)
//                 désigne une fiche de l'index vivant.
//   2. MARKDOWN — tout lien `[libellé](cible.md)` de `MEMORY.md` désigne un fichier présent, résolu
//                 relativement à `.claude/memory/`.
//
// ANGLES MORTS DÉCLARÉS (ce que ce garde NE mesure PAS) :
//   - l'index vivant, ce sont les `.md` à PLAT : un SOUS-DOSSIER de `.claude/memory/` n'est ni
//     scanné ni admis comme cible, et un `[[…]]` qui vise une fiche rangée là est DÉTECTÉ mort.
//   - la PERTINENCE d'une cible (le lien pointe-t-il la bonne fiche ?) n'est pas mesurable ici.
//   - les liens SORTANTS hors mémoire (`docs/…`, `src/…`) relèvent de `scripts/docs/check-doc-refs.mjs`.
//   - les blocs de code clôturés (```…```) sont retirés avant scan : un `[[…]]` y est un EXEMPLE.
//   - les liens markdown hors `MEMORY.md` (prose de fiche) ne sont pas vérifiés.
//
// PORTÉE 2 — le RESTE du dépôt (`scanRepoMemoryLinks`) : un `[[nom]]` de fiche écrit dans un JSDoc,
// un commentaire ou un doc vivant est un lien au MÊME titre que celui d'une fiche, et une fiche
// supprimée le laisse mort sans que personne ne le voie. Racines scannées : `RACINES_HORS_MEMOIRE`.
// TROIS formes, un seul verdict : le `[[slug]]` ; le CHEMIN `.claude/memory/<nom>.md` sous toutes ses
// écritures (lien markdown `](…)`, chemin nu, ancre `#…`, ligne `:<n>`) ; et la MENTION NUE du nom
// d'une fiche DISPARUE, quelle que soit sa décoration (backtics, prose « cf. slug », `name: slug`,
// suffixe `.md:<n>`) — ce sont ces deux dernières qui portaient les 29 liens morts laissés par la
// refonte de mémoire de #1728, toutes invisibles à la forme `[[…]]`.
//
// ANGLES MORTS DÉCLARÉS DE LA PORTÉE 2 :
//   - un fichier IGNORÉ par git (`.gitignore`) n'est pas vu : l'énumération est
//     `git ls-files --cached --others --exclude-standard` (suivi OU non suivi mais versionnable).
//   - un `[[…]]` dont la cible n'a pas la FORME d'un nom de fiche (kebab minuscule, ≥ 5 caractères)
//     n'est pas vu. Mesuré le 2026-09-13 : sans ce filtre, 200+ faux positifs de littéraux
//     JS `[[a, b]]` (tableaux de paires) et de classes de regex `[[^\]]` noient le rapport.
//   - la MENTION NUE n'est cherchée que pour les noms du VOCABULAIRE (fiches de l'arbre + fiches de
//     HEAD, `nomsDeFichesConnues`) : la forme générique « kebab ≥ 5 caractères backtiqué » est
//     MESURÉE inutilisable — 23 321 occurrences sur l'arbre du 2026-09-13, dont 23 309 hors fiche
//     (`` `label` `` ×706, `` `undefined` `` ×343, `` `capabilities` `` ×118…), soit 99,95 % de faux
//     positifs, un slug de fiche n'étant pas distinguable d'un identifiant de code. Conséquence
//     assumée : la fenêtre de détection d'une MENTION est le GESTE qui supprime la fiche (elle est
//     encore à HEAD) ; une mention restée morte après un commit de suppression déjà passé redevient
//     invisible. Le CHEMIN et le `[[…]]`, eux, sont vus toujours, fiche connue ou non.
//   - hors racines et exclusions : `HORS_SCAN`, chacune motivée à son entrée.
//
// Module ESM pur — consommé par `src/memory-links-guard.test.ts`.
import { readFileSync, existsSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { parUnitesDeCode, listerDossier } from './lister.mjs';
import { extname, join } from 'node:path';

/** Dossier de la mémoire persistante, relatif à la racine du dépôt. */
export const MEMORY_DIR = '.claude/memory';
/** Index de l'index : la fiche qui référence toutes les autres en markdown. */
export const MEMORY_INDEX = 'MEMORY.md';

/** Les `.md` à plat de `.claude/memory/` — l'INDEX VIVANT (jamais `_archive/`). @returns {string[]} */
export function liveNotes(root) {
  const dir = join(root, MEMORY_DIR);
  return listerDossier(dir).filter((nom) => nom.endsWith('.md') && statSync(join(dir, nom)).isFile());
}

/** Retire les blocs de code clôturés en PRÉSERVANT le compte de lignes. @returns {string} */
function stripFences(text) {
  let fenced = false;
  return text
    .split('\n')
    .map((line) => {
      if (/^\s*```/.test(line)) { fenced = !fenced; return ''; }
      return fenced ? '' : line;
    })
    .join('\n');
}

/**
 * Scanne l'index vivant. @returns {{file: string, line: number, kind: string, tok: string}[]}
 * `file` est relatif à la racine du dépôt, `line` 1-basée.
 */
export function scanMemoryLinks(root) {
  const notes = liveNotes(root);
  const known = new Set(notes.map((f) => f.replace(/\.md$/, '')));
  const problems = [];

  for (const file of notes) {
    const rel = `${MEMORY_DIR}/${file}`;
    const lines = stripFences(readFileSync(join(root, MEMORY_DIR, file), 'utf8')).split('\n');

    lines.forEach((line, i) => {
      // 1. WIKI — [[nom]], [[nom|alias]], [[nom#ancre]], [[nom.md]]
      for (const m of line.matchAll(/\[\[([^\]]+)\]\]/g)) {
        const target = m[1].split(/[|#]/)[0].trim().replace(/\.md$/, '');
        if (!known.has(target)) problems.push({ file: rel, line: i + 1, kind: 'fiche inexistante', tok: `[[${target}]]` });
      }

      // 2. MARKDOWN — uniquement dans l'index, où les liens sont des chemins de fichier
      if (file !== MEMORY_INDEX) return;
      for (const m of line.matchAll(/\]\(([^)\s]+\.md)(?:#[^)\s]*)?\)/g)) {
        const tok = m[1];
        if (/^[a-z]+:\/\//i.test(tok)) continue;
        if (!existsSync(join(root, MEMORY_DIR, tok))) problems.push({ file: rel, line: i + 1, kind: 'fichier absent', tok });
      }
    });
  }

  return problems.sort((a, b) => parUnitesDeCode(a.file, b.file) || a.line - b.line || parUnitesDeCode(a.tok, b.tok));
}

/** Racines du dépôt scannées par la PORTÉE 2 (hors `.claude/memory/`, tenu par `scanMemoryLinks`). */
export const RACINES_HORS_MEMOIRE = ['src', 'scripts', 'docs'];

/** Extensions LUES par la portée 2 — tout le reste (binaire, image, verrou) n'a pas de prose. */
const EXTENSIONS_LUES = new Set(['.ts', '.tsx', '.mts', '.mjs', '.js', '.jsx', '.md', '.json', '.css']);

/**
 * Chemins EXCLUS de la portée 2, chacun avec sa raison. Ce ne sont pas des offenseurs tolérés :
 * aucun n'est une RÉFÉRENCE VIVANTE vers la mémoire.
 *   - `docs/plans/`, `docs/superpowers/` : artefacts DATÉS (politique `docs/` de `docs/architecture.md`) — leur
 *     texte fige l'état d'un jour, il ne se recâble pas.
 *   - `docs/decisions/issues.json` : MIROIR du texte des tickets GitHub ; un `[[…]]` y est une
 *     CITATION de ce qu'une issue disait, pas un lien du dépôt — le corriger falsifierait l'archive.
 *   - `src/memory-links-guard.test.ts` : le banc du garde FORGE des fiches qui n'existent pas
 *     (cibles `fiche-jamais-ecrite`, `fiche-close`…) ; un garde ne se scanne pas lui-même.
 *   - `scripts/ops/sondes/audit-2026-09-01/` : sondes d'un audit DATÉ ; les noms de fiches qu'elles
 *     énumèrent sont la MESURE d'un jour (leur donnée d'entrée), pas des liens à recâbler.
 */
export const HORS_SCAN = [
  'docs/plans/',
  'docs/superpowers/',
  'docs/decisions/issues.json',
  'src/memory-links-guard.test.ts',
  'scripts/ops/sondes/audit-2026-09-01/',
];

/** `[[slug]]`, `[[slug|alias]]`, `[[slug#ancre]]`, `[[slug.md]]` — FORME d'un nom de fiche. */
const JETON_FICHE = /\[\[([a-z0-9][a-z0-9-]{4,})(?:\.md)?(?:[|#][^\]\n]*)?\]\]/g;
/**
 * CHEMIN de fiche, sous TOUTES ses écritures : lien markdown `](.claude/memory/<nom>.md)`, chemin nu
 * dans un commentaire, ancre `#…` ou ligne `:<n>` suffixée. Un sous-dossier ne matche pas (ni `/` ni
 * `_` dans la classe) : il est hors index vivant et se cite par chemin sans être jugé ici.
 */
const JETON_CHEMIN = /\.claude\/memory\/([a-z0-9][a-z0-9-]*\.md)(?:[#:][^)\s]*)?/g;
/**
 * MENTION NUE d'un nom de fiche DISPARUE, quelle que soit sa décoration : backtics (`` `slug` ``),
 * prose (`cf. slug`), suffixe `.md` ou `.md:<n>`, valeur YAML (`name: slug`). Le nom n'est cherché
 * que parmi les fiches DISPARUES (vocabulaire moins arbre) : c'est ce qui rend la forme décidable
 * (cf. angles morts en tête). Bornes sans `\b` : un slug ne doit pas matcher DANS un slug plus long.
 * @returns {RegExp|null} `null` s'il n'y a rien à chercher.
 */
function jetonDisparues(disparues) {
  if (disparues.length === 0) return null;
  const alternatives = [...disparues].sort((a, b) => b.length - a.length).join('|');
  return new RegExp(`(?<![a-z0-9-])(${alternatives})(?![a-z0-9-])`, 'g');
}

/**
 * VOCABULAIRE des noms de fiche connus du dépôt : celles de l'arbre de travail ET celles de HEAD.
 * C'est ce qui rend le slug BACKTIQUÉ décidable — hors de ce vocabulaire, un kebab backtiqué est un
 * identifiant de code (mesure : 99,95 % de faux positifs, cf. en-tête). Si git ne répond pas, le
 * vocabulaire se réduit à l'arbre : la portée rétrécit, elle ne ment pas.
 * @returns {Set<string>}
 */
export function nomsDeFichesConnues(root) {
  const noms = new Set(liveNotes(root).map((f) => f.replace(/\.md$/, '')));
  try {
    const sortie = execFileSync('git', ['ls-tree', '--name-only', 'HEAD', `${MEMORY_DIR}/`], {
      cwd: root, encoding: 'utf8', maxBuffer: 1 << 26, stdio: ['ignore', 'pipe', 'ignore'],
    });
    for (const ligne of sortie.split('\n')) {
      if (!ligne.endsWith('.md')) continue;
      noms.add(ligne.slice(`${MEMORY_DIR}/`.length, -'.md'.length));
    }
  } catch { /* dépôt sans HEAD (banc forgé) : vocabulaire = arbre seul */ }
  return noms;
}

/**
 * Fichiers de la portée 2, chemins relatifs POSIX, triés. Énumération par git (suivis ET non suivis
 * non ignorés) : un fichier temporaire posé dans le périmètre est donc VU. @returns {string[]}
 */
export function fichiersHorsMemoire(root) {
  const sortie = execFileSync(
    'git',
    ['ls-files', '--cached', '--others', '--exclude-standard', '--', ...RACINES_HORS_MEMOIRE],
    { cwd: root, encoding: 'utf8', maxBuffer: 1 << 28 },
  );
  return [...new Set(sortie.split('\n').filter(Boolean))]
    .filter((rel) => EXTENSIONS_LUES.has(extname(rel)))
    .filter((rel) => !HORS_SCAN.some((p) => rel === p || rel.startsWith(p)))
    .sort(parUnitesDeCode);
}

/**
 * Scanne le dépôt HORS `.claude/memory/`. Même forme de verdict que `scanMemoryLinks`.
 * @param {string} root
 * @param {{ fichiers?: string[], vocabulaire?: Iterable<string> }} [options] `fichiers` remplace
 * l'énumération git, `vocabulaire` remplace `nomsDeFichesConnues` (bancs forgés, sans HEAD).
 * @returns {{file: string, line: number, kind: string, tok: string}[]}
 */
export function scanRepoMemoryLinks(root, { fichiers, vocabulaire } = {}) {
  const known = new Set(liveNotes(root).map((f) => f.replace(/\.md$/, '')));
  const connues = new Set(vocabulaire ?? nomsDeFichesConnues(root));
  const jetonMention = jetonDisparues([...connues].filter((nom) => !known.has(nom)));
  const problems = [];

  // Pré-filtre de COÛT (jamais de portée) : un fichier où ne figure aucun préfixe de nom de fiche
  // disparue, aucun `[[` et aucun chemin de mémoire ne peut porter aucune des trois formes.
  const prefixes = [...new Set([...connues].filter((n) => !known.has(n)).map((n) => `${n.split('-')[0]}-`))];
  for (const rel of fichiers ?? fichiersHorsMemoire(root)) {
    let texte;
    try { texte = readFileSync(join(root, rel), 'utf8'); } catch { continue; }
    if (!texte.includes('[[') && !texte.includes(`${MEMORY_DIR}/`) && !prefixes.some((p) => texte.includes(p))) continue;
    // Les fences ne sont retirées que du markdown : dans un `.ts`, ``` vit dans une chaîne.
    const lignes = (rel.endsWith('.md') ? stripFences(texte) : texte).replace(/\r\n/g, '\n').split('\n');

    lignes.forEach((ligne, i) => {
      for (const m of ligne.matchAll(JETON_FICHE)) {
        if (!known.has(m[1])) problems.push({ file: rel, line: i + 1, kind: 'fiche inexistante', tok: `[[${m[1]}]]` });
      }
      for (const m of ligne.matchAll(JETON_CHEMIN)) {
        const nom = m[1].replace(/\.md$/, '');
        // Un nom que le dépôt n'a JAMAIS connu n'est pas un lien mort : c'est une fixture de banc.
        if (connues.has(nom) && !known.has(nom)) {
          problems.push({ file: rel, line: i + 1, kind: 'fichier absent', tok: `${MEMORY_DIR}/${m[1]}` });
        }
      }
      if (!jetonMention) return;
      // Les chemins sont déjà jugés ci-dessus : on les retire pour ne pas compter deux fois le site.
      for (const m of ligne.replace(JETON_CHEMIN, ' ').matchAll(jetonMention)) {
        problems.push({ file: rel, line: i + 1, kind: 'fiche inexistante', tok: m[1] });
      }
    });
  }

  return problems.sort((a, b) => parUnitesDeCode(a.file, b.file) || a.line - b.line || parUnitesDeCode(a.tok, b.tok));
}

/** Rapport `fichier:ligne  [nature]  jeton`, une ligne par lien fautif. @returns {string} */
export function formatMemoryLinkProblems(problems) {
  return problems.map((p) => `  ${p.file}:${p.line}  [${p.kind}]  ${p.tok}`).join('\n');
}
