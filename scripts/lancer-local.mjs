#!/usr/bin/env node
// Lanceur d'un outil INSTALLÉ DANS CET ARBRE (#1679 L1c) : `node scripts/lancer-local.mjs <paquet>
// [--cwd <dossier>] -- <bin> [args…]`. npm empile les `node_modules/.bin` de TOUS les dossiers ANCÊTRES sur le PATH du
// script : depuis un worktree sans `typescript`, `npm run typecheck` jouait le tsc de l'arbre
// principal et rendait 0 (mesuré 2026-09-02, `npm run typecheck -- --version` → 5.9.3 depuis
// `.claude/worktrees/agent-ecran`). Deux verrous ici :
//   · l'outil ABSENT de cet arbre est refusé par `refusOutillageLocal`, qui nomme l'arbre et la cause ;
//   · l'enfant reçoit un PATH dont le SEUL `node_modules/.bin` est celui de cet arbre — les `.bin`
//     des ancêtres en sont retirés, donc un sous-processus de l'outil ne peut pas les servir non plus.
// `--cwd <dossier>` déplace le BASE PATH de l'outil (le dossier depuis lequel il résout ses chemins
// relatifs et décide de sa portée), quand l'appelant juge un dossier qui n'est pas l'arbre : l'outil,
// son env isolé et son `.bin` restent, eux, résolus depuis la racine de cet arbre. Sans l'option,
// l'enfant tourne à la racine.
// L'exécutable joué est le FICHIER JS déclaré par le champ `bin` du paquet, lancé par `process.execPath`
// (`shell: false`) : aucun `.cmd` de `node_modules/.bin` n'est traversé, donc aucune règle de citation
// de cmd.exe sur les arguments, et le même chemin de code sur win32 et sur posix.
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync, spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { separerInvocation } from './guards/lib/invocation.mjs'
import { refusOutillageLocal } from './outillage-local.mjs'
import { codeEnfant } from './test/partition.mjs'

const EST_BIN_NPM = /(^|[\\/])node_modules[\\/]\.bin[\\/]?$/

/**
 * PATH de l'enfant : `binLocal` en tête, et AUCUN autre `node_modules/.bin` — un outil résolu par le
 * PATH ne peut donc venir que de cet arbre. Les autres segments gardent leur ordre.
 */
export function pathIsole(pathActuel, binLocal, delimiteur = path.delimiter) {
  const segments = String(pathActuel ?? '')
    .split(delimiteur)
    .filter((s) => s && !EST_BIN_NPM.test(s))
  return [binLocal, ...segments].join(delimiteur)
}

/** Env de l'enfant, avec le PATH isolé posé sur la clé EXISTANTE (win32 écrit `Path`). */
export function envIsole(env, binLocal, delimiteur = path.delimiter) {
  const cle = Object.keys(env).find((k) => k.toUpperCase() === 'PATH') ?? 'PATH'
  return { ...env, [cle]: pathIsole(env[cle], binLocal, delimiteur) }
}

/** Chemin RELATIF du fichier JS déclaré par le champ `bin` du paquet, ou `null` si `bin` l'ignore. */
export function entreeBin(manifeste, nom) {
  const declare = manifeste?.bin
  if (typeof declare === 'string') return manifeste.name === nom ? declare : null
  return typeof declare?.[nom] === 'string' ? declare[nom] : null
}

/**
 * Fichier JS de l'exécutable `<bin>` du paquet installé DANS `racine`. REND `{ entree }`, ou
 * `{ refus }` — le message qui nomme l'arbre, l'outil et la cause. SOCLE des deux appelants : la
 * ligne de commande ci-dessous, et tout script qui spawnerait un outil (`scripts/docs/build-all.mjs`).
 */
export function resoudreOutilLocal(racine, paquet, bin) {
  const manifesteChemin = path.join(racine, 'node_modules', paquet, 'package.json')
  const refusPaquet = refusOutillageLocal(racine, paquet, manifesteChemin)
  if (refusPaquet) return { refus: refusPaquet }
  const relatif = entreeBin(JSON.parse(fs.readFileSync(manifesteChemin, 'utf8')), bin)
  if (!relatif)
    return { refus: `[outillage] le paquet ${paquet} de cet arbre ne déclare aucun exécutable « ${bin} » : ${manifesteChemin}` }
  const entree = path.join(racine, 'node_modules', paquet, relatif)
  const refusEntree = refusOutillageLocal(racine, `${paquet}/${bin}`, entree)
  return refusEntree ? { refus: refusEntree } : { entree }
}

/**
 * STDOUT d'un outil de CET ARBRE joué sur un script (`tsx <dumper>`). `npx` est proscrit : il remonte
 * aux arbres ancêtres, et son enfant perd le `cwd`/l'env que l'appelant vient de poser — un
 * enregistreur de lectures ne verrait rien du dumper (#1679 L1b).
 * L'enfant tourne à la RACINE : `--cwd` est une option de la ligne de commande, et les appelants d'ici
 * (`docs/build-codex-relations.mjs`, `docs/build-donnees.mjs`) jugent l'arbre lui-même.
 */
export function sortieOutilLocal(racine, paquet, bin, args) {
  const { entree, refus } = resoudreOutilLocal(racine, paquet, bin)
  if (refus) throw new Error(refus)
  return execFileSync(process.execPath, [entree, ...args], {
    cwd: racine,
    encoding: 'utf8',
    env: envIsole(process.env, binLocal(racine)),
    maxBuffer: 1 << 28,
  })
}

/** Dossier des binaires de l'arbre — le SEUL `node_modules/.bin` que voit l'enfant. */
export const binLocal = (racine) => path.join(racine, 'node_modules', '.bin')

if (import.meta.main) {
  const RACINE = fileURLToPath(new URL('..', import.meta.url))
  const invocation = separerInvocation(process.argv.slice(2), { options: ['--cwd'] })
  if (!invocation) {
    console.error('[outillage] usage : node scripts/lancer-local.mjs <paquet> [--cwd <dossier>] -- <bin> [args…]')
    process.exit(2)
  }
  const { positionnel: paquet, options, reste: [bin, ...args] } = invocation
  const { entree, refus } = resoudreOutilLocal(RACINE, paquet, bin)
  if (refus) {
    console.error(refus)
    process.exit(2)
  }
  const enfant = spawn(process.execPath, [entree, ...args], {
    cwd: options.cwd ?? RACINE,
    env: envIsole(process.env, binLocal(RACINE)),
    stdio: 'inherit',
    shell: false,
  })
  const relais = (s) => enfant.kill(s)
  process.on('SIGINT', relais)
  process.on('SIGTERM', relais)
  enfant.on('error', (e) => {
    console.error(`[outillage] lancement de ${bin} impossible : ${e.message}`)
    process.exit(1)
  })
  enfant.on('close', (code, signal) => process.exit(codeEnfant(code, signal)))
}
