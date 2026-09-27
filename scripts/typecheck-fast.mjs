// Typecheck INCRÉMENTAL des agents : réutilise le cache `node_modules/.cache/typecheck.tsbuildinfo`
// (mesuré 2026-08-30 : ~7 s à chaud contre ~42-51 s pour un `tsc --noEmit` nu). La sortie complète
// part en fichier ; le résumé imprimé liste TOUTES les erreurs, jamais un extrait.
// La porte de vérité reste `npm run typecheck` (full, `--incremental false`).
import { spawnSync } from 'node:child_process'
import { closeSync, mkdirSync, openSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { refusOutillageLocal } from './outillage-local.mjs'

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..')
const TSC = join(REPO, 'node_modules', 'typescript', 'bin', 'tsc')

// Outillage LOCAL exigé AVANT tout lancement (#1679 L1c) : sans `node_modules/typescript` dans CET
// arbre, la remontée de Node servirait le tsc d'un AUTRE arbre au lieu d'échouer.
const refusTypescript = refusOutillageLocal(REPO, 'tsc', TSC)
if (refusTypescript) {
  console.error(refusTypescript)
  process.exit(2)
}

const CACHE = join(REPO, 'node_modules', '.cache')
const TSBUILDINFO = join(CACHE, 'typecheck.tsbuildinfo')
const SORTIE = join(CACHE, 'typecheck-last.txt')

const full = process.argv.slice(2).includes('--full')

const args = [
  TSC,
  '--noEmit',
  '--incremental',
  '--tsBuildInfoFile',
  TSBUILDINFO,
  '--pretty',
  'false',
]
// `--full` AJOUTE la désactivation de l'incrémental : le tsbuildinfo est un cache PARTAGÉ entre
// sessions, le supprimer serait une course.
if (full) args.push('--incremental', 'false')

mkdirSync(CACHE, { recursive: true })

// tsc écrit DIRECTEMENT dans le fichier de capture (`stdio` sur un descripteur de FICHIER), jamais
// dans un tube : les écritures d'un processus Node vers un fichier régulier sont synchrones sur
// Windows comme sur POSIX, alors que vers un tube elles sont asynchrones sur POSIX — le
// `process.exit()` de tsc en abandonne la queue et le résumé sous-compterait les erreurs.
// Le fichier n'est lu qu'APRÈS la fin du processus : spawnSync ne rend la main qu'à l'exit.
const fd = openSync(SORTIE, 'w')
let run
try {
  run = spawnSync(process.execPath, args, { cwd: REPO, stdio: ['ignore', fd, fd] })
} finally {
  closeSync(fd)
}
const sortie = readFileSync(SORTIE, 'utf8')

const lignes = sortie.split(/\r?\n/)
const erreurs = lignes.filter((ligne) => /error TS\d+/.test(ligne))
const statut = run.status ?? 1

// Un échec SANS erreur TS (tsc introuvable, plantage du processus) ne se résume jamais en
// « 0 erreur(s) » : la cause brute est imprimée telle quelle.
const rendu = []
if (run.error) {
  rendu.push(`typecheck:fast — ÉCHEC de lancement : ${run.error.message}`)
} else if (statut !== 0 && erreurs.length === 0) {
  rendu.push(`typecheck:fast — ÉCHEC (code ${statut}) sans erreur TS reconnue`)
  rendu.push(...lignes.filter((ligne) => ligne.trim() !== '').slice(-20))
} else {
  rendu.push(`typecheck:fast — ${erreurs.length} erreur(s)`)
  rendu.push(...erreurs)
}
rendu.push(`sortie complète : ${SORTIE}`)
rendu.push(
  full ? 'mode full (--incremental false)' : 'mode incrémental — au doute : npm run typecheck (full)',
)

// Même contrainte pour NOTRE propre sortie, qui part dans un tube (npm, CI) : `process.exit()`
// l'amputerait sur POSIX. Le code de sortie se pose, la fin naturelle du processus vide le flux.
// Le statut suit le COMPTE : une erreur TS lue sort en échec, même si tsc a rendu 0 (#1801).
process.stdout.write(`${rendu.join('\n')}\n`)
process.exitCode = erreurs.length > 0 && statut === 0 ? 1 : statut
