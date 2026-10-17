// LECTEUR du journal des hooks git (#2603) : par hook, n, p50, p90 et max du mur et HORS VEILLE, et les
// runs tués (`debut` sans `fin`, processus disparu). Écrivain : `scripts/git-hooks/journal.mjs`.
// Veille : fenêtres Kernel-Power 506→507 du journal System, sous win32 seulement.
//   npm run ops:journal-hooks [-- --arbre <racine>] [--depuis <ISO>] [--json]
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { parseArgs } from 'node:util'
import { RACINE } from '../hooks/barriere-outil.mjs'
import { journalDe } from '../git-hooks/journal.mjs'
import { par, quantile } from './cachePromptAnalyses.mjs'

/** @typedef {{ de: number, a: number }} Fenetre bornes en ms epoch, `de` = -Infinity si l'entrée en veille précède la lecture */
/** @typedef {{ hook: string, pid: number, debut: string, fin: string, ms: number }} RunTermine */

/**
 * Les fenêtres de veille, appariées 506→507 dans l'ordre du temps. Un 507 sans 506 ouvre depuis la fin de
 * la fenêtre précédente (-Infinity s'il n'y en a pas) ; un 506 sans 507 court jusqu'à `maintenant`. PURE.
 * @param {{ id: number, t: number }[]} evenements @param {number} maintenant @returns {Fenetre[]}
 */
export function fenetresDeVeille(evenements, maintenant) {
  const fenetres = []
  let ouverte = null
  for (const { id, t } of [...evenements].sort((x, y) => x.t - y.t)) {
    if (id === 506) ouverte ??= t
    else if (id === 507) {
      fenetres.push({ de: ouverte ?? fenetres.at(-1)?.a ?? -Infinity, a: t })
      ouverte = null
    }
  }
  if (ouverte !== null) fenetres.push({ de: ouverte, a: maintenant })
  return fenetres
}

/** Le chevauchement, en ms, de l'intervalle `[de, a]` avec les fenêtres. PURE. @param {Fenetre} run @param {Fenetre[]} fenetres */
export const chevauchement = ({ de, a }, fenetres) =>
  fenetres.reduce((somme, f) => somme + Math.max(0, Math.min(a, f.a) - Math.max(de, f.de)), 0)

/**
 * Les runs du journal : terminés (`fin`) et ouverts (`debut` sans `fin`), depuis `depuis` (ms epoch). PURE.
 * @param {Record<string, unknown>[]} entrees @param {number} [depuis]
 * @returns {{ termines: RunTermine[], ouverts: { hook: string, pid: number, debut: string }[] }}
 */
export function runsDuJournal(entrees, depuis = -Infinity) {
  const cle = (e) => `${e.hook}|${e.pid}|${e.debut}`
  const retenues = entrees.filter((e) => typeof e.debut === 'string' && Date.parse(e.debut) >= depuis)
  const termines = retenues.filter((e) => e.evenement === 'fin')
  const finis = new Set(termines.map(cle))
  const ouverts = retenues.filter((e) => e.evenement === 'debut' && !finis.has(cle(e)))
  return { termines, ouverts }
}

/** p50, p90, max d'une série. PURE. @param {number[]} xs */
const resume = (xs) => ({ p50: quantile(xs, 0.5), p90: quantile(xs, 0.9), max: xs.length ? Math.max(...xs) : null })

/**
 * Par hook : n, mur et hors veille (p50, p90, max, ms), tués (ouverts dont le processus n'est pas `vivant`). PURE.
 * @param {ReturnType<typeof runsDuJournal>} runs @param {Fenetre[]} fenetres @param {(pid: number) => boolean} vivant
 */
export function statistiques({ termines, ouverts }, fenetres, vivant) {
  const parHook = par(termines, (r) => r.hook)
  const tues = par(ouverts.filter((r) => !vivant(r.pid)), (r) => r.hook)
  return [...new Set([...parHook.keys(), ...tues.keys()])].sort().map((hook) => {
    const runs = parHook.get(hook) ?? []
    return {
      hook,
      n: runs.length,
      mur: resume(runs.map((r) => r.ms)),
      horsVeille: resume(runs.map((r) => r.ms - chevauchement({ de: Date.parse(r.debut), a: Date.parse(r.fin) }, fenetres))),
      tues: tues.get(hook)?.length ?? 0,
    }
  })
}

/** Le processus `pid` existe-t-il ? */
function processusVivant(pid) {
  try {
    process.kill(pid, 0)
    return true
  } catch (e) {
    return e.code === 'EPERM'
  }
}

/** Les événements 506/507 du journal System depuis `depuis` (ms epoch), une lecture ; hors win32, aucun. */
function evenementsDeVeille(depuis) {
  if (process.platform !== 'win32') return []
  const script = `$e = Get-WinEvent -FilterHashtable @{LogName='System';ProviderName='Microsoft-Windows-Kernel-Power';StartTime=[datetime]'${new Date(depuis).toISOString()}'} -ErrorAction SilentlyContinue | ? Id -in 506,507; `
    + `ConvertTo-Json -Compress -InputObject @($e | % { @{ id = $_.Id; t = $_.TimeCreated.ToUniversalTime().ToString('o') } })`
  const vu = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], { encoding: 'utf8', timeout: 60_000 })
  if (vu.error || vu.status !== 0) throw new Error(`veille illisible (Get-WinEvent) : ${vu.error?.message ?? vu.stderr.trim()}`)
  return JSON.parse(vu.stdout.trim() || '[]').map(({ id, t }) => ({ id, t: Date.parse(t) }))
}

/** Le texte du journal `chemin`, `''` absent. */
const lireSurDisque = (chemin) => (existsSync(chemin) ? readFileSync(chemin, 'utf8') : '')

/** Les entrées JSON d'un texte de journal, lignes illisibles écartées. PURE. @param {string} texte */
export const entreesDe = (texte) => texte.split('\n').flatMap((l) => {
  try {
    return l.trim() ? [JSON.parse(l)] : []
  } catch {
    return []
  }
})

const secondes = (ms) => (ms === null ? '-' : (ms / 1000).toFixed(1))
const triplet = ({ p50, p90, max }) => `${secondes(p50)} / ${secondes(p90)} / ${secondes(max)}`
const OPTIONS = { arbre: { type: 'string', default: RACINE }, depuis: { type: 'string' }, json: { type: 'boolean', default: false } }
const USAGE = 'usage : npm run ops:journal-hooks [-- --arbre <racine>] [--depuis <ISO>] [--json]'

/**
 * Le geste entier de la ligne de commande, ses lectures injectables. Rend le code de sortie.
 * @param {{ argv: string[], ecrire?: (texte: string) => void, erreur?: (texte: string) => void, journal?: typeof journalDe,
 *   lire?: (chemin: string) => string, veille?: (depuis: number) => { id: number, t: number }[], vivant?: (pid: number) => boolean,
 *   maintenant?: () => number }} p
 */
export function executer({
  argv, ecrire = (texte) => process.stdout.write(texte), erreur = (texte) => process.stderr.write(texte), journal = journalDe,
  lire = lireSurDisque, veille = evenementsDeVeille, vivant = processusVivant, maintenant = Date.now,
}) {
  let values
  try {
    ({ values } = parseArgs({ args: argv, options: OPTIONS }))
  } catch (e) {
    erreur(`${e.message}\n${USAGE}\n`)
    return 1
  }
  const depuis = values.depuis === undefined ? -Infinity : Date.parse(values.depuis)
  if (Number.isNaN(depuis)) {
    erreur(`--depuis illisible : ${values.depuis}\n${USAGE}\n`)
    return 1
  }
  const chemin = journal(values.arbre)
  if (chemin === null) {
    erreur(`${values.arbre} hors dépôt : aucun journal des hooks git\n`)
    return 1
  }
  const runs = runsDuJournal(entreesDe(lire(chemin)), depuis)
  const debuts = [...runs.termines, ...runs.ouverts].map((r) => Date.parse(r.debut))
  const fenetres = fenetresDeVeille(debuts.length ? veille(Math.min(...debuts)) : [], maintenant())
  const stats = statistiques(runs, fenetres, vivant)
  if (values.json) {
    const bornes = fenetres.map(({ de, a }) => ({ de: Number.isFinite(de) ? new Date(de).toISOString() : null, a: new Date(a).toISOString() }))
    ecrire(`${JSON.stringify({ journal: chemin, fenetres: bornes, hooks: stats })}\n`)
  } else if (!stats.length) ecrire(`journal ${chemin} : aucun run${values.depuis ? ` depuis ${values.depuis}` : ''}\n`)
  else {
    const lignes = [['hook', 'n', 'mur p50 / p90 / max (s)', 'hors veille p50 / p90 / max (s)', 'tués'],
      ...stats.map((s) => [s.hook, String(s.n), triplet(s.mur), triplet(s.horsVeille), String(s.tues)])]
    const largeurs = lignes[0].map((_, i) => Math.max(...lignes.map((l) => l[i].length)))
    ecrire(`journal ${chemin} — fenêtres de veille : ${fenetres.length}\n`
      + lignes.map((l) => l.map((c, i) => c.padEnd(largeurs[i])).join('  ').trimEnd()).join('\n') + '\n')
  }
  return 0
}

if (import.meta.main) process.exitCode = executer({ argv: process.argv.slice(2) })
