/**
 * REJEU DES MIGRATIONS SUR UN EXPORT DE LA TÊTE (#1613) — `npm run migrations:replay:head [<sha>]`.
 *
 * `npm run migrations:replay` rejoue EN PLACE : sur l'arbre de travail partagé (sessions parallèles,
 * WIP permanent) il réécrit `src/data` et `src/scenes`, donc personne ne le joue, donc son rouge
 * n'est vu qu'APRÈS le push, dans la CI. Cette porte-ci joue le MÊME rejeu sur une COPIE JETABLE de
 * l'arbre du sha, et laisse le dépôt intact.
 *
 * Quatre pas, chacun chronométré et dit :
 *   1. EXPORT — index temporaire (`GIT_INDEX_FILE`) + `git read-tree <sha>` + `git ls-files -z` +
 *      `git checkout-index --stdin -z --prefix` : l'arbre du SHA, jamais l'index du dépôt ni le
 *      working tree. Sous `os.tmpdir()/wr/<sha8>/`, un préfixe COURT : `core.longpaths` est absent de
 *      ce dépôt et 40 fichiers dépassent MAX_PATH sous un préfixe de 113 caractères (mesuré).
 *   2. REJEU — `rejouer({ racine: <export> })` de `replay.mjs`, la même fonction que la porte en place.
 *   3. EMPREINTE — `comparer(blobsDe(dépôt, sha), empreinteDe(export))` sur le `PERIMETRE` de
 *      `replay.mjs`. C'est la SEULE mesure valable ici : hors dépôt, `git diff --exit-code -- <a>
 *      <b> …` bascule en `--no-index` et rend 0, soit « rien n'a bougé » sur un arbre réécrit.
 *   4. EFFACEMENT de l'export, y compris sur rouge ou sur exception.
 *
 * Coût mesuré (worktree réel, 88 migrations) : export 3,1 s / rejeu 10,3 s / empreinte 0,2 s ≈ 14 s —
 * le budget « ~10-15 s » du ticket.
 *
 * Voie d'export ÉCARTÉE et pourquoi : `git archive … | tar -x` rend le même export à l'octet (528
 * fichiers du périmètre, 0 divergence) en 3,9 s, mais passe par un tarball intermédiaire de 121 Mo,
 * exige `tar` et son `--force-local` (GNU tar lit `C:\…` comme un HÔTE distant : « Cannot connect to
 * C »). `checkout-index -a` sans pathspec est aussi bon (3,8 s) mais copie l'arbre ENTIER (216 Mo
 * contre 116).
 *
 * ENTRÉES : l'arbre git du sha demandé (aucune lecture du working tree).
 */
import { spawnSync } from 'node:child_process'
import { mkdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve, sep } from 'node:path'
import { PERIMETRE, rejouer } from './replay.mjs'
import { blobsDe, comparer, empreinteDe, rapportDEcart } from './lib/empreinteRejeu.mjs'
import { listerDossier } from '../guards/lib/lister.mjs'

/** Racine de TOUS les exports — PARTAGÉE entre processus. Le préfixe est court (MAX_PATH) et
 *  l'effacement ne s'autorise QUE sous lui : un `rmSync` récursif ne se pointe pas sur un chemin
 *  calculé sans garde-fou. */
export const RACINE_DES_EXPORTS = join(tmpdir(), 'wr')

/** Exports laissés sous la racine par le processus `pid` — le nom d'un export EMBARQUE son PID
 *  (`<sha8>-<pid>`, cf. `rejeuSurExport`). La racine est PARTAGÉE : un `pre-push` voisin, un
 *  `migrations:replay:head` à la main, un autre worktree ou un autre fichier de test y écrivent EN
 *  MÊME TEMPS. Qui lirait le dossier ENTIER jugerait le voisin — mesuré sur `test:hooks` : l'export
 *  étranger `94fa18f3-13272` faisait rougir trois tests qui n'avaient rien fabriqué. Ordre total
 *  (`listerDossier`) : le résultat se compare par égalité sans dépendre de l'OS.
 *  @param {number} [pid] @returns {string[]} */
export const exportsDuProcessus = (pid = process.pid) =>
  listerDossier(RACINE_DES_EXPORTS, { absent: 'vide' }).filter((nom) => nom.endsWith(`-${pid}`))

/**
 * Ce que l'export porte, et POURQUOI — le rejeu lit bien au-delà du périmètre qu'il écrit.
 * Liste unique : personne d'autre ne la recopie.
 * @type {Record<string, string>}
 */
export const CHEMINS_EXPORTES = {
  src: 'les deux racines de documents (`src/data`, `src/scenes`) ET le reste de `src/` : `scripts/guards/lib/propArtLabels.mjs` lit `src/gameIso/catalog/…`',
  scripts: 'les migrations elles-mêmes, leurs libs (`scripts/guards/lib`, `scripts/data/lib`, `scripts/raw`) et les générateurs d’authoring du périmètre',
  'docs/raw': 'l’Atlas RAW, lu par `scripts/raw/_lib.mjs` et par `scripts/raw/build-implemente.mjs`',
  Source: 'les livres, lus de façon non bornée : `scripts/raw/_lib.mjs` dérive les dossiers de `books.json`',
  'package.json': 'racine de projet (`type: module`) — sans lui, node refuse les `.mjs` relatifs du lot',
  'package-lock.json': 'lu par les gardes de dépendances que certaines migrations importent',
  'tsconfig.json': 'lu par les libs qui résolvent des chemins de source',
  '.gitattributes':
    'l’export se relit à la main comme le dépôt (mêmes pilotes de fusion, même `eol`). Il n’entre PAS ' +
    'dans la conversion de fins de ligne : `checkout-index` lit les attributs du DÉPÔT source, pas ceux ' +
    'de la destination — un export privé de ce fichier rend le même LF, mesuré sous `core.autocrlf=true`',
}

/** `git <args>` dans `cwd`, avec un environnement optionnel. */
const git = (args, { cwd, env }) => spawnSync('git', args, { cwd, env, encoding: 'utf8', maxBuffer: 1 << 28 })

/**
 * Écrit l'arbre de `sha` dans `dossier`, restreint à `CHEMINS_EXPORTES`. Passe par un index
 * TEMPORAIRE : l'index du dépôt n'est jamais touché (un rejeu ne doit rien pouvoir casser d'une
 * session en cours).
 * @param {{ depot: string, sha: string, dossier: string }} params
 * @returns {{ fichiers: number }}
 */
export function exporter({ depot, sha, dossier }) {
  mkdirSync(dossier, { recursive: true })
  const index = `${dossier}.index`
  const env = { ...process.env, GIT_INDEX_FILE: index }
  try {
    const lu = git(['read-tree', sha], { cwd: depot, env })
    if (lu.status !== 0) throw new Error(`git read-tree ${sha} a rendu ${lu.status} : ${(lu.stderr || '').trim()}`)
    // `ls-files` sur l'index temporaire : il ne rend QUE des chemins de l'arbre du sha, et un chemin
    // demandé qui n'y existe pas rend simplement rien (`git archive`, lui, fait une erreur fatale).
    const listes = git(['ls-files', '-z', '--', ...Object.keys(CHEMINS_EXPORTES)], { cwd: depot, env })
    if (listes.status !== 0) throw new Error(`git ls-files a rendu ${listes.status} : ${(listes.stderr || '').trim()}`)
    const fichiers = listes.stdout.split('\0').filter(Boolean).length
    if (fichiers === 0) return { fichiers: 0 }
    const ecrit = spawnSync('git', ['checkout-index', '--stdin', '-z', '--force', `--prefix=${dossier.replace(/\\/g, '/')}/`], {
      cwd: depot,
      env,
      input: listes.stdout,
      encoding: 'utf8',
      maxBuffer: 1 << 28,
    })
    if (ecrit.status !== 0) throw new Error(`git checkout-index a rendu ${ecrit.status} : ${(ecrit.stderr || '').trim()}`)
    return { fichiers }
  } finally {
    rmSync(index, { force: true })
  }
}

/** Efface un export — et REFUSE tout chemin qui ne vit pas DANS `RACINE_DES_EXPORTS`. Le séparateur
 *  final n'est pas décoratif : sans lui, `…/wr-sauvegarde` et `…/wrangler-cache` passaient la garde
 *  (mesuré) — un préfixe de CHAÎNE n'est pas un préfixe de CHEMIN. */
export function effacerExport(dossier) {
  if (!resolve(dossier).startsWith(resolve(RACINE_DES_EXPORTS) + sep))
    throw new Error(`refus d’effacer ${dossier} : hors de ${RACINE_DES_EXPORTS}`)
  rmSync(dossier, { recursive: true, force: true })
}

/**
 * Rejoue les migrations de `sha` sur un export jetable et rend le verdict.
 * @param {{ cwd?: string, sha?: string, ecrire?: (ligne: string) => void }} params
 * @returns {{ rouges: string[], lignes: string[], sha: string, dossier: string, chronos: Record<string, number> }}
 */
export function rejeuSurExport({ cwd = process.cwd(), sha = 'HEAD', ecrire = console.log } = {}) {
  const vu = git(['rev-parse', sha], { cwd })
  if (vu.status !== 0) throw new Error(`git rev-parse ${sha} a rendu ${vu.status} : ${(vu.stderr || '').trim()}`)
  const resolu = vu.stdout.trim()
  // Le dossier porte le sha ET le PID : deux rejeux du MÊME sha coexistent (un `pre-push` pendant un
  // `migrations:replay:head` à la main, deux worktrees au même commit). Sous le seul sha8, mesuré :
  // le second process mourait en `EBUSY rmdir` sur le dossier du premier, et l'ordre inverse rendait
  // un faux rouge « DOCUMENT DISPARU » — le voisin ayant effacé l'export sous les pieds du rejeu.
  const dossier = join(RACINE_DES_EXPORTS, `${resolu.slice(0, 8)}-${process.pid}`)
  /** @type {string[]} */
  const rouges = []
  /** @type {string[]} */
  const lignes = []
  const chronos = {}
  const debutTotal = Date.now()
  const chrono = (nom, faire) => {
    const debut = Date.now()
    const rendu = faire()
    chronos[nom] = (Date.now() - debut) / 1000
    return rendu
  }

  try {
    const { fichiers } = chrono('export', () => exporter({ depot: cwd, sha: resolu, dossier }))
    lignes.push(`export de ${resolu.slice(0, 7)} : ${fichiers} fichier(s) sous ${dossier} (${chronos.export}s)`)

    const joue = chrono('rejeu', () => rejouer({ racine: dossier, ecrire }))
    rouges.push(...joue.rouges)

    const ecart = chrono('empreinte', () => {
      const avant = blobsDe(cwd, resolu, PERIMETRE)
      const apres = empreinteDe(dossier, PERIMETRE)
      return { ecart: comparer(avant, apres), total: avant.size }
    })
    const rapport = rapportDEcart(ecart.ecart, ecart.total)
    rouges.push(...rapport.rouges)
    lignes.push(...rapport.lignes)
  } finally {
    effacerExport(dossier)
  }

  chronos.total = (Date.now() - debutTotal) / 1000
  return { rouges, lignes, sha: resolu, dossier, chronos }
}

function main() {
  const cwd = process.cwd()
  const sha = process.argv[2] ?? 'HEAD'
  const { rouges, lignes, sha: resolu, chronos } = rejeuSurExport({ cwd, sha })
  for (const ligne of lignes) console.log(ligne)
  console.log(
    `chronos : export ${chronos.export}s · rejeu ${chronos.rejeu}s · empreinte ${chronos.empreinte}s · total ${chronos.total.toFixed(1)}s`,
  )
  if (rouges.length) {
    console.error(`\nmigrations:replay:head ROUGE sur ${resolu.slice(0, 7)} (${rouges.length}) :\n  - ${rouges.join('\n  - ')}`)
    process.exit(1)
  }
  console.log(`migrations:replay:head — OK sur ${resolu.slice(0, 7)}`)
}

// Importable par le hook `pre-push` : le rejeu ne part que si ce fichier est le point d'entrée.
if (import.meta.main) main()
