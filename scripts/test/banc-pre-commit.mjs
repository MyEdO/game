#!/usr/bin/env node
// BANC DU PRE-COMMIT (#2327 §5) — mesure, jamais une gate :
//   npm run banc:pre-commit [-- --fois <N>] [--cas C1,C2]
// Le hook de CET arbre (`scripts/git-hooks/pre-commit.mjs`) est joué sur un index JETABLE
// (`GIT_INDEX_FILE` sous os.tmpdir(), `read-tree HEAD`) où chaque cas stage ses chemins par
// `hash-object -w` + `update-index --cacheinfo` : l'index réel et l'arbre de travail restent intacts.
// Les blobs posés sont des objets libres du dépôt (ramassés par `git gc`). Le journal des hooks
// (`scripts/git-hooks/journal.mjs`) reçoit une ligne par lancement.
import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { gitDeLArbreReel, lancerGit } from './gitDeBanc.mjs'
import { estFichierVitest } from '../guards/lib/fichierVitest.mjs'

const RACINE = fileURLToPath(new URL('../..', import.meta.url))
const HOOK = join(RACINE, 'scripts', 'git-hooks', 'pre-commit.mjs')
const git = gitDeLArbreReel(RACINE)

/** Les cas du §5 : chacun choisit ses chemins suivis, dans l'ordre de `git ls-files`. */
const CAS = {
  C1: () => git('ls-files', 'src').split('\n').filter((c) => /\.ts$/.test(c) && !/\.d\.ts$/.test(c) && !estFichierVitest(c)).slice(0, 10),
  C2: () => git('ls-files', 'docs/raw/4e').split('\n').filter((c) => /^docs\/raw\/4e\/[^/]+\.md$/.test(c) && !c.endsWith('/00-index.md')).slice(0, 4),
}

/** @param {number[]} xs */
const mediane = (xs) => {
  const tri = [...xs].sort((a, b) => a - b)
  const m = Math.floor(tri.length / 2)
  return tri.length % 2 ? tri[m] : (tri[m - 1] + tri[m]) / 2
}

/** Un lancement du hook sur un index jetable où `chemins` portent leur texte de HEAD suivi d'une ligne vide. */
function unLancement(chemins) {
  const dossier = mkdtempSync(join(tmpdir(), 'banc-pre-commit-'))
  const env = { ...process.env, GIT_INDEX_FILE: join(dossier, 'index') }
  try {
    lancerGit(['read-tree', 'HEAD'], { cwd: RACINE, env })
    for (const c of chemins) {
      const texte = lancerGit(['show', `HEAD:${c}`], { cwd: RACINE, env })
      const blob = lancerGit(['hash-object', '-w', '--stdin'], { cwd: RACINE, env, input: `${texte}\n`, net: true })
      lancerGit(['update-index', '--cacheinfo', `100644,${blob},${c}`], { cwd: RACINE, env })
    }
    const debut = performance.now()
    const r = spawnSync(process.execPath, [HOOK], { cwd: RACINE, env, encoding: 'utf8', maxBuffer: 1 << 28 })
    return { s: (performance.now() - debut) / 1000, code: r.status ?? r.signal, fin: String(r.stderr).trim().split('\n').filter((l) => l.startsWith('[pre-commit]')).pop() ?? '' }
  } finally {
    rmSync(dossier, { recursive: true, force: true })
  }
}

const arg = (nom) => {
  const i = process.argv.indexOf(nom)
  return i === -1 ? undefined : process.argv[i + 1]
}
const FOIS = Number(arg('--fois') ?? 5)
const CHOISIS = (arg('--cas') ?? Object.keys(CAS).join(',')).split(',')
const inconnus = CHOISIS.filter((c) => !CAS[c])
if (!Number.isInteger(FOIS) || FOIS < 1 || inconnus.length) {
  console.error(`[banc] usage : npm run banc:pre-commit [-- --fois <N≥1>] [--cas ${Object.keys(CAS).join(',')}]${inconnus.length ? ` — cas inconnu(s) : ${inconnus.join(', ')}` : ''}`)
  process.exit(2)
}

const tete = git('rev-parse', '--short', 'HEAD').trim()
for (const nom of CHOISIS) {
  const chemins = CAS[nom]()
  const tours = Array.from({ length: FOIS }, () => unLancement(chemins))
  const durees = tours.map((t) => t.s)
  console.log(`[banc] ${nom} (${chemins.length} chemins, HEAD ${tete}, ${FOIS} tour(s)) : médiane ${mediane(durees).toFixed(1)} s · min ${Math.min(...durees).toFixed(1)} · max ${Math.max(...durees).toFixed(1)} · codes ${tours.map((t) => t.code).join(',')}`)
  console.log(`[banc]   dernier tour : ${tours.at(-1).fin}`)
}
