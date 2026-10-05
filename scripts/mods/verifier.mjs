// GARDE `mods:check` (#2278) : chaque mod Claude Code du dépôt (`racinesDeMods`, scripts/mods/racines.mjs)
// exige au moins un banc `*.test.ts`, puis passe, sur une COPIE temporaire filtrée des artefacts du moteur
// (`.claude-plugin/types`, `tsconfig.json`), la validation stricte du moteur, la pose de ses types à la
// version épinglée, `tsc` sur ces types et ses bancs. Le CLI tourne sous un env en liste BLANCHE et un
// HOME temporaire. Sondes S3, S5, S6 : https://github.com/MyEdO/game/issues/2278#issuecomment-5983827521 ;
// design jugé : issuecomment-5983917564, amendement n° 2 : issuecomment-5984597607.
//
// Usage : `node scripts/mods/verifier.mjs [<dossier de mod>…]` — sans argument, les mods de
// `.claude/skills/`. Le CLI ne lit ni n'écrit l'arbre : la source est copiée sous `os.tmpdir()`, et le
// temporaire est effacé en fin de course.
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { basename, dirname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { listerArbre } from '../guards/lib/lister.mjs'
import { tableTotale } from '../../src/lib/tableTotale.ts'
import { execFileResilient } from '../guards/lib/spawnResilient.mjs'
import { MANIFESTE, racinesDeMods } from './racines.mjs'

/** Version ÉPINGLÉE du CLI Claude Code : l'API des mods est « EARLY ACCESS », elle se monte à la main. */
export const VERSION_CLAUDE = '2.1.289'

/** Le paquet npm du CLI épinglé, lancé par `npx` quand le `claude` du PATH n'est pas à la version. */
export const PAQUET_CLAUDE = `@anthropic-ai/claude-code@${VERSION_CLAUDE}`

/**
 * Les SEULES variables héritées par un processus de la gate, chacune pour sa raison ; HOME et les
 * profils Windows sont redirigés vers le temporaire (`envBlanc`), le cache npm est posé à part.
 */
export const ENV_HERITE = Object.freeze({
  PATH: 'trouver `claude`, `node` et ce que lance `npx` (win32 et Linux)',
  Path: 'graphie win32 de PATH, telle que la rend `process.env` énuméré',
  PATHEXT: 'win32 : les extensions exécutables que `npx` résout pour un bin de paquet',
  SystemRoot: 'win32 : sans elle, le réseau et la cryptographie de node échouent (`npx` télécharge le CLI)',
  SYSTEMROOT: 'graphie majuscule de SystemRoot',
  windir: 'win32 : dossier système lu par les processus fils de `npx`',
  ComSpec: 'win32 : l’interpréteur que `npm` lance pour un script de cycle de vie',
  TEMP: 'win32 : le dossier temporaire du processus',
  TMP: 'win32 : le dossier temporaire du processus',
  TMPDIR: 'Linux : le dossier temporaire du processus',
})

/** Les profils redirigés vers le HOME temporaire : aucune config ni identifiant de l'hôte n'est lu. */
export const PROFILS = Object.freeze(['HOME', 'USERPROFILE', 'APPDATA', 'LOCALAPPDATA'])

/** Les étapes d'un mod, dans l'ordre. */
export const ETAPES = Object.freeze(['bancs', 'copie', 'validate', 'types', 'tsc', 'test'])

const RACINE = fileURLToPath(new URL('../../', import.meta.url))
const TSC = join(RACINE, 'node_modules', 'typescript', 'bin', 'tsc')
/** Borne d'un processus fils : l'installation `npx` du CLI compte dedans. Valeur maison. */
const BORNE_MS = 10 * 60 * 1000

/** La première ligne attendue des types posés par le moteur. */
export const ENTETE_TYPES = `// Written by Claude Code ${VERSION_CLAUDE}.`
/** Les types posés par `--plugin-dir`, relatifs à la racine du mod. */
export const TYPES = join('.claude-plugin', 'types', 'claude-code', 'index.d.ts')
/** Les artefacts que le moteur pose dans un mod au chargement : jamais copiés depuis la source. */
export const ARTEFACTS = Object.freeze([join('.claude-plugin', 'types'), 'tsconfig.json'])

/**
 * L'env d'un processus de la gate : `ENV_HERITE` seul, profils vers `home`, cache npm gardé (sans lui,
 * `npx` réinstallerait le CLI sous `home`).
 * @param {NodeJS.ProcessEnv} base
 * @param {string} home
 * @returns {NodeJS.ProcessEnv}
 */
export function envBlanc(base, home) {
  const cacheNpm = base.npm_config_cache
    ?? (process.platform === 'win32' && base.LOCALAPPDATA ? join(base.LOCALAPPDATA, 'npm-cache') : join(homedir(), '.npm'))
  const herite = Object.fromEntries(Object.entries(base).filter(([cle]) => Object.hasOwn(ENV_HERITE, cle)))
  return { ...herite, ...tableTotale(PROFILS, () => home), npm_config_cache: cacheNpm }
}

/**
 * Lance `argv` sans shell par l'hôte de processus (`execFileResilient`, scripts/guards/lib/spawnResilient.mjs,
 * #2073) : un argument à espace passe tel quel. Un code non nul est un résultat, pas une exception.
 * @param {string[]} argv
 * @param {{ cwd: string, env: NodeJS.ProcessEnv }} options
 * @returns {{ status: number | null, sortie: string }}
 */
export function lancer(argv, { cwd, env }) {
  try {
    const sortie = execFileResilient(argv[0], argv.slice(1), {
      cwd, env, encoding: 'utf8', timeout: BORNE_MS, maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'],
    }, { site: 'mods:check' })
    return { status: 0, sortie }
  } catch (e) {
    const status = typeof e.status === 'number' ? e.status : null
    return { status, sortie: `${e.stdout ?? ''}${e.stderr ?? ''}${status === null ? `\n${e.message}` : ''}` }
  }
}

/**
 * Le `npx-cli.js` de la distribution de node qui exécute ce script, lancé par `node` : ni `.cmd` ni shell
 * sous win32. Dossier de `node` sous win32 (`node_modules/npm`), `../lib/node_modules/npm` sous Linux.
 * @param {string} [node]
 * @returns {string | null}
 */
export function npxCli(node = process.execPath) {
  const dossier = dirname(node)
  return [join(dossier, 'node_modules', 'npm', 'bin', 'npx-cli.js'), join(dossier, '..', 'lib', 'node_modules', 'npm', 'bin', 'npx-cli.js')]
    .find((chemin) => existsSync(chemin)) ?? null
}

/**
 * Le préfixe d'argv du CLI épinglé : le `claude` du PATH s'il rend EXACTEMENT `VERSION_CLAUDE`, sinon
 * `npx` de la même version, sinon `null`.
 * @param {typeof lancer} lanceur
 * @param {{ cwd: string, env: NodeJS.ProcessEnv }} options
 * @param {string | null} npx
 * @returns {string[] | null}
 */
export function resoudreClaude(lanceur, options, npx) {
  const r = lanceur(['claude', '--version'], options)
  if (r.status === 0 && r.sortie.trim().split(/\s+/)[0] === VERSION_CLAUDE) return ['claude']
  return npx ? [process.execPath, npx, '-y', PAQUET_CLAUDE] : null
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

/** `true` si `chemin`, sous `source`, est un artefact du moteur (`ARTEFACTS`) ou sous l'un d'eux. */
const estArtefact = (source, chemin) => {
  const rel = relative(source, chemin)
  return ARTEFACTS.some((a) => rel === a || rel.startsWith(`${a}${sep}`))
}

/**
 * Vérifie UN mod, étape par étape ; la première étape rouge arrête ce mod.
 * @param {string} source racine du mod
 * @param {{ lanceur: typeof lancer, claude: string[], racineTemp: string, env: NodeJS.ProcessEnv }} contexte
 * @returns {{ mod: string, etape: string, sortie: string } | null} le rouge NOMMÉ, ou `null`
 */
export function verifierMod(source, { lanceur, claude, racineTemp, env }) {
  const mod = basename(source)
  const rouge = (etape, sortie) => ({ mod, etape, sortie: sortie.trim() })
  const bancs = listerArbre(source, { filtre: (rel) => rel.endsWith('.test.ts'), absent: 'vide' })
  if (bancs.length === 0) return rouge('bancs', `aucun banc \`*.test.ts\` sous ${source} : un mod se livre avec ses bancs, joués par \`claude plugin test\``)
  const temp = mkdtempSync(join(racineTemp, 'mod-'))
  const copie = join(temp, mod)
  const home = join(temp, 'home')
  const options = { cwd: home, env: envBlanc(env, home) }
  try {
    try {
      cpSync(source, copie, { recursive: true, filter: (chemin) => !estArtefact(source, chemin) })
      mkdirSync(home)
    } catch (e) {
      return rouge('copie', e.message)
    }
    let r = lanceur([...claude, 'plugin', 'validate', '--strict', copie], options)
    if (r.status !== 0) return rouge('validate', r.sortie)
    r = lanceur([...claude, '-p', 'OK', '--max-turns', '1', '--plugin-dir', copie], options)
    const manque = preuveDesTypes(copie)
    if (manque) return rouge('types', `${manque}\n${r.sortie}`)
    r = lanceur([process.execPath, TSC, '--project', copie], { ...options, cwd: RACINE })
    if (r.status !== 0) return rouge('tsc', r.sortie)
    r = lanceur([...claude, 'plugin', 'test', copie], options)
    if (r.status !== 0) return rouge('test', r.sortie)
    return null
  } finally {
    rmSync(temp, { recursive: true, force: true })
  }
}

/**
 * Vérifie des mods ; le CLI n'est résolu que s'il y en a un.
 * @param {string[]} mods racines de mod
 * @param {{ lanceur?: typeof lancer, racineTemp?: string, env?: NodeJS.ProcessEnv, npx?: string | null }} [contexte]
 * @returns {{ mod: string, etape: string, sortie: string }[]} les rouges
 */
export function verifier(mods, { lanceur = lancer, racineTemp = tmpdir(), env = process.env, npx = npxCli() } = {}) {
  if (mods.length === 0) return []
  const temp = mkdtempSync(join(racineTemp, 'claude-'))
  try {
    const claude = resoudreClaude(lanceur, { cwd: temp, env: envBlanc(env, temp) }, npx)
    if (!claude) return mods.map((source) => ({ mod: basename(source), etape: 'cli', sortie: `ni \`claude\` ${VERSION_CLAUDE} au PATH, ni \`npx-cli.js\` près de ${process.execPath}` }))
    return mods.flatMap((source) => verifierMod(source, { lanceur, claude, racineTemp, env }) ?? [])
  } finally {
    rmSync(temp, { recursive: true, force: true })
  }
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
