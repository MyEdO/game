#!/usr/bin/env node
// Stock des exports sans importeur (knip, mode exports/types), recensé par nom dans
// `knip-exports-baseline.json` (fichier → noms), toute APPARITION échoue, toute entrée assainie
// doit être RETIRÉE de la baseline (`--sync` ne sait que retirer, jamais ajouter).
//
import { readFileSync, realpathSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, extname, join, relative } from 'node:path'
import { correspondGlob } from '../guards/lib/lister.mjs'

const SCRIPT = fileURLToPath(import.meta.url)
export const REPO = join(dirname(SCRIPT), '..', '..')
export const BASELINE = join(REPO, 'knip-exports-baseline.json')

const MESURER = '--mesurer'
const TYPES_D_EXPORT = ['exports', 'types', 'nsExports', 'nsTypes']
const MODULES_TYPESCRIPT = new Set(['.ts', '.tsx', '.mts', '.cts'])

/** Aplatit les types d'alerte export de Knip par fichier relatif. */
function flatten(issues, racine) {
  const parFichier = {}
  for (const type of TYPES_D_EXPORT) {
    for (const issuesDuFichier of Object.values(issues[type])) {
      for (const { filePath, symbol } of Object.values(issuesDuFichier)) {
        const fichier = cheminRelatif(racine, filePath)
        const noms = parFichier[fichier] ??= []
        noms.push(symbol)
      }
    }
  }
  for (const noms of Object.values(parFichier)) noms.sort()
  return parFichier
}

const cheminRelatif = (racine, fichier) => relative(racine, fichier).replaceAll('\\', '/')
const retenu = (fichier, motifs) =>
  motifs.some(m => !m.startsWith('!') && correspondGlob(fichier, m)) &&
  !motifs.some(m => m.startsWith('!') && correspondGlob(fichier, m.slice(1)))

/** Une seule analyse pour le rapport d'exports et ses modules TypeScript promus par une arête d'entrée. */
export function mesurerExports(racine = REPO) {
  const { error, status, signal, stdout, stderr } = spawnSync(process.execPath, [SCRIPT, MESURER], {
    cwd: racine, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024,
  })
  if (error) throw error
  if (status !== 0) throw new Error(`Knip : ${stderr.trim() || signal || status}`)
  return JSON.parse(stdout.trimEnd().split('\n').at(-1))
}

async function lireGrapheKnip() {
  const { createOptions } = await import('knip/session')
  // La façade knip/session ne livre ni les arêtes d'entrée ni leur ensemble résolu.
  const { run } = await import(new URL('./run.js', import.meta.resolve('knip')).href)
  const options = await createOptions({
    cwd: realpathSync(process.cwd()),
    includedIssueTypes: TYPES_D_EXPORT,
    isSession: true,
    isShowProgress: false,
  })
  const { results, session } = await run(options)
  if (results.hasConfigLoadErrors) throw new Error('Knip : chargement de configuration en échec')
  const { entry = [], project = [] } = options.parsedConfig
  const entrees = session.getEntryPaths()
  const aretes = []
  for (const [fichier, { imports }] of session.getGraph()) {
    for (const cible of imports.entryFiles) {
      if (!entrees.has(cible) || !MODULES_TYPESCRIPT.has(extname(cible))) continue
      const rel = cheminRelatif(options.cwd, cible)
      if (retenu(rel, project) && !retenu(rel, entry)) aretes.push(`${cheminRelatif(options.cwd, fichier)} → ${rel}`)
    }
  }
  return { counts: flatten(results.issues, options.cwd), entreesImplicites: aretes.sort() }
}

/** Compare mesure et baseline. `nouveaux` = régression (échec), `assainis` = baseline à abaisser. */
export function compare(counts, baseline) {
  const nouveaux = []
  const assainis = []
  for (const [f, names] of Object.entries(counts)) {
    const gelés = new Set(baseline[f] ?? [])
    for (const n of names) if (!gelés.has(n)) nouveaux.push(`${f} : ${n}`)
  }
  for (const [f, names] of Object.entries(baseline)) {
    const réels = new Set(counts[f] ?? [])
    for (const n of names) if (!réels.has(n)) assainis.push(`${f} : ${n}`)
  }
  return { nouveaux, assainis }
}

/** Retire de la baseline les entrées assainies — jamais d'ajout (un cliquet ne monte pas). */
export function syncBaseline(counts, baseline) {
  const out = {}
  for (const f of Object.keys(baseline).sort()) {
    const réels = new Set(counts[f] ?? [])
    const restants = baseline[f].filter((n) => réels.has(n))
    if (restants.length) out[f] = restants
  }
  return out
}

function main() {
  const { counts, entreesImplicites } = mesurerExports()
  if (entreesImplicites.length) {
    console.error('MODULES TYPESCRIPT SOUSTRAITS À LA MESURE DES EXPORTS :\n  ' + entreesImplicites.join('\n  '))
    process.exitCode = 1
    return
  }
  const baseline = JSON.parse(readFileSync(BASELINE, 'utf8'))

  if (process.argv.includes('--sync')) {
    const next = syncBaseline(counts, baseline)
    writeFileSync(BASELINE, JSON.stringify(next, null, 2) + '\n')
    const avant = Object.values(baseline).flat().length
    const après = Object.values(next).flat().length
    console.log(`baseline abaissée : ${avant} → ${après} export(s) mort(s) gelé(s)`)
    process.exit(0)
  }

  const { nouveaux, assainis } = compare(counts, baseline)
  if (nouveaux.length) {
    console.error(
      `EXPORT(S) MORT(S) NOUVEAU(X) — supprimer l’export, ou le consommer :\n  ${nouveaux.join('\n  ')}`,
    )
  }
  if (assainis.length) {
    console.error(
      `Baseline PÉRIMÉE (${assainis.length}) — lancer \`node scripts/ops/knip-exports-ratchet.mjs --sync\` :\n  ${assainis
        .slice(0, 20)
        .join('\n  ')}${assainis.length > 20 ? '\n  …' : ''}`,
    )
  }
  const total = Object.values(counts).flat().length
  if (nouveaux.length || assainis.length) process.exit(1)
  console.log(`exports morts : ${total} (gelés, ${Object.keys(counts).length} fichiers) — aucun nouveau`)
}

if (import.meta.main) {
  if (process.argv[2] === MESURER) {
    process.env.JITI_FS_CACHE = 'false'
    console.log(JSON.stringify(await lireGrapheKnip()))
  } else main()
}
