// PORTE `mods:check` (#2278) : chaque mod Claude Code du dépôt (`racinesDeMods`,
// scripts/guards/lib/modSansRegle.mjs) passe, sur une COPIE temporaire, la validation stricte du
// moteur, la pose de ses types, `tsc` sur ces types et ses bancs. Sondes S3, S5, S6 :
// https://github.com/MyEdO/game/issues/2278#issuecomment-5983827521 ; design jugé :
// https://github.com/MyEdO/game/issues/2278#issuecomment-5983917564
//
// Usage : `node scripts/mods/verifier.mjs [<dossier de mod>…]` — sans argument, les mods de
// `.claude/skills/`. Rien n'est écrit dans l'arbre : tout vit sous `os.tmpdir()`, effacé en fin de course.
import { spawnSync } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { basename, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { MANIFESTE, racinesDeMods } from '../guards/lib/modSansRegle.mjs'

/** Version ÉPINGLÉE du CLI Claude Code : l'API des mods est « EARLY ACCESS », elle se monte à la main. */
export const VERSION_CLAUDE = '2.1.289'

/** Variables d'identifiants RETIRÉES de l'env de `claude -p` : sans elles, aucun tour de modèle ne part. */
export const CLES_RETIREES = Object.freeze([
  'ANTHROPIC_API_KEY',
  'ANTHROPIC_AUTH_TOKEN',
  'CLAUDE_CODE_OAUTH_TOKEN',
  'CLAUDE_CODE_USE_BEDROCK',
  'CLAUDE_CODE_USE_VERTEX',
])

/** Les étapes d'un mod, dans l'ordre. */
export const ETAPES = Object.freeze(['validate', 'copie', 'types', 'tsc', 'test'])

const RACINE = fileURLToPath(new URL('../../', import.meta.url))
const TSC = join(RACINE, 'node_modules', 'typescript', 'bin', 'tsc')
/** Borne d'un processus fils : l'installation `npx` du CLI compte dedans. */
const BORNE_MS = 10 * 60 * 1000

/** La première ligne attendue des types posés par le moteur. */
export const ENTETE_TYPES = `// Written by Claude Code ${VERSION_CLAUDE}.`
/** Les types posés par `--plugin-dir`, relatifs à la racine du mod. */
export const TYPES = join('.claude-plugin', 'types', 'claude-code', 'index.d.ts')

/**
 * Lanceur par défaut : `argv` sans shell, sauf `npx` sous win32 (un `.cmd`).
 * @param {string[]} argv
 * @param {{ cwd?: string, env?: NodeJS.ProcessEnv }} [options]
 * @returns {{ status: number | null, sortie: string }}
 */
export function lancerParDefaut(argv, { cwd = RACINE, env = process.env } = {}) {
  const r = spawnSync(argv[0], argv.slice(1), {
    cwd, env, encoding: 'utf8', timeout: BORNE_MS, maxBuffer: 64 * 1024 * 1024,
    shell: process.platform === 'win32' && argv[0] === 'npx',
  })
  return { status: r.status, sortie: `${r.stdout ?? ''}${r.stderr ?? ''}${r.error ? `\n${r.error.message}` : ''}` }
}

/**
 * Le préfixe d'argv du CLI épinglé : le `claude` du PATH s'il est à `VERSION_CLAUDE`, sinon `npx`
 * de la même version.
 * @param {typeof lancerParDefaut} lancer
 * @returns {string[]}
 */
export function resoudreClaude(lancer) {
  const r = lancer(['claude', '--version'])
  return r.status === 0 && r.sortie.startsWith(VERSION_CLAUDE)
    ? ['claude']
    : ['npx', '-y', `@anthropic-ai/claude-code@${VERSION_CLAUDE}`]
}

/**
 * L'env de `claude -p` : identifiants retirés, HOME et profils Windows vers `home`, cache npm gardé
 * (sans lui, `npx` réinstallerait le CLI sous `home`).
 * @param {NodeJS.ProcessEnv} base
 * @param {string} home
 * @returns {NodeJS.ProcessEnv}
 */
export function envNettoye(base, home) {
  const cacheNpm = base.npm_config_cache
    ?? (process.platform === 'win32' && base.LOCALAPPDATA ? join(base.LOCALAPPDATA, 'npm-cache') : join(homedir(), '.npm'))
  const env = Object.fromEntries(Object.entries(base).filter(([cle]) => !CLES_RETIREES.includes(cle)))
  return { ...env, HOME: home, USERPROFILE: home, APPDATA: home, LOCALAPPDATA: home, npm_config_cache: cacheNpm }
}

/**
 * La preuve POSITIVE de l'étape `types` : `null` si le moteur a posé ses types à la version épinglée,
 * sinon ce qui manque.
 * @param {string} copie
 * @returns {string | null}
 */
export function preuveDesTypes(copie) {
  const fichier = join(copie, TYPES)
  if (!existsSync(fichier)) return `${TYPES} absent : le moteur n’a pas posé ses types`
  const entete = readFileSync(fichier, 'utf8').split('\n', 1)[0].trimEnd()
  return entete === ENTETE_TYPES ? null : `${TYPES} : 1re ligne « ${entete} », attendu « ${ENTETE_TYPES} »`
}

/**
 * Vérifie UN mod, étape par étape ; la première étape rouge arrête ce mod.
 * @param {string} source racine du mod
 * @param {{ lancer: typeof lancerParDefaut, claude: string[], racineTemp?: string, env?: NodeJS.ProcessEnv }} contexte
 * @returns {{ mod: string, etape: string, sortie: string } | null} le rouge NOMMÉ, ou `null`
 */
export function verifierMod(source, { lancer, claude, racineTemp = tmpdir(), env = process.env }) {
  const mod = basename(source)
  const temp = mkdtempSync(join(racineTemp, 'mod-'))
  const copie = join(temp, mod)
  const home = join(temp, 'home')
  const rouge = (etape, sortie) => ({ mod, etape, sortie: sortie.trim() })
  const echoue = (r) => r.status !== 0
  try {
    let r = lancer([...claude, 'plugin', 'validate', '--strict', source], { cwd: RACINE, env })
    if (echoue(r)) return rouge('validate', r.sortie)
    try {
      cpSync(source, copie, { recursive: true })
      mkdirSync(home)
    } catch (e) {
      return rouge('copie', e.message)
    }
    r = lancer([...claude, '-p', 'OK', '--max-turns', '1', '--plugin-dir', copie], { cwd: home, env: envNettoye(env, home) })
    const manque = preuveDesTypes(copie)
    if (manque) return rouge('types', `${manque}\n${r.sortie}`)
    r = lancer([process.execPath, TSC, '--project', copie], { cwd: RACINE, env })
    if (echoue(r)) return rouge('tsc', r.sortie)
    r = lancer([...claude, 'plugin', 'test', copie], { cwd: RACINE, env })
    if (echoue(r)) return rouge('test', r.sortie)
    return null
  } finally {
    rmSync(temp, { recursive: true, force: true })
  }
}

/**
 * Vérifie des mods ; le CLI n'est résolu que s'il y en a un.
 * @param {string[]} mods racines de mod
 * @param {{ lancer?: typeof lancerParDefaut, racineTemp?: string, env?: NodeJS.ProcessEnv }} [contexte]
 * @returns {{ mod: string, etape: string, sortie: string }[]} les rouges
 */
export function verifier(mods, { lancer = lancerParDefaut, racineTemp, env } = {}) {
  if (mods.length === 0) return []
  const claude = resoudreClaude(lancer)
  return mods.flatMap((source) => verifierMod(source, { lancer, claude, racineTemp, env }) ?? [])
}

if (import.meta.main) {
  const arguments_ = process.argv.slice(2).map((a) => resolve(a))
  const sansManifeste = arguments_.filter((a) => !existsSync(join(a, MANIFESTE)))
  if (sansManifeste.length > 0) {
    process.stderr.write(`[mods:check] pas un mod (${MANIFESTE} absent) : ${sansManifeste.join(', ')}\n`)
    process.exit(2)
  }
  const mods = arguments_.length > 0 ? arguments_ : racinesDeMods(join(RACINE, '.claude', 'skills'))
  if (mods.length === 0) {
    process.stdout.write('[mods:check] aucun mod\n')
    process.exit(0)
  }
  const rouges = verifier(mods)
  for (const { mod, etape, sortie } of rouges) process.stderr.write(`[mods:check] ROUGE ${mod} — étape ${etape}\n${sortie}\n`)
  process.stdout.write(`[mods:check] ${mods.length - rouges.length}/${mods.length} mod(s) vert(s)\n`)
  process.exit(rouges.length > 0 ? 1 : 0)
}
