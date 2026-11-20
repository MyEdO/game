#!/usr/bin/env node
// Stock des exports sans importeur (knip, mode exports/types), recensé par nom dans
// `knip-exports-baseline.json` (fichier → noms), toute APPARITION échoue, toute entrée assainie
// doit être RETIRÉE de la baseline (`--sync` ne sait que retirer, jamais ajouter).
//
import { readFileSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

export const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
export const BASELINE = join(REPO, 'knip-exports-baseline.json')

/** Aplatit le rapport JSON de knip en `{ fichier: [noms triés] }`. */
export function flatten(issues) {
  const per = {}
  for (const f of issues ?? []) {
    const names = [...(f.exports ?? []), ...(f.types ?? []), ...(f.nsExports ?? []), ...(f.nsTypes ?? [])].map(
      (x) => x.name,
    )
    if (names.length) per[f.file] = [...names].sort()
  }
  return per
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
  // Binaire knip lancé par `node` directement (pas `npx`) : sur Windows un `spawnSync('npx.cmd')`
  // sans `shell` rend un statut nul et une sortie VIDE — un faux vert silencieux.
  const r = spawnSync(
    process.execPath,
    [
      join(REPO, 'node_modules', 'knip', 'bin', 'knip.js'),
      '--include',
      'exports,types,nsExports,nsTypes',
      '--no-progress',
      '--reporter',
      'json',
    ],
    { cwd: REPO, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
  )
  const stdout = (r.stdout ?? '').trim()
  const start = stdout.indexOf('{')
  if (start === -1) {
    console.error('knip n’a produit aucun rapport JSON :\n' + (r.stderr ?? '').trim())
    process.exit(1)
  }
  const counts = flatten(JSON.parse(stdout.slice(start)).issues)
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

if (import.meta.main) main()
