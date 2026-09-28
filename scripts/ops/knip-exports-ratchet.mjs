#!/usr/bin/env node
// Cliquet des EXPORTS MORTS (knip, mode exports/types) — même patron que les cliquets de
// `src/ui/ui-ratchets.test.ts` : le stock recensé est GELÉ NOMINATIVEMENT dans
// `knip-exports-baseline.json` (fichier → noms), toute APPARITION échoue, toute entrée assainie
// doit être RETIRÉE de la baseline (`--sync` ne sait que retirer, jamais ajouter).
//
// Périmètre du gel (2026-08-16) : `src/gameIso/**` est EXCLU de la baseline — chantier de rendu en
// cours (backends WebGL, rig/anim), son stock d'exports bouge d'heure en heure et gèlerait un
// cliquet en faux rouge permanent. Il reste dans le GRAPHE knip (ses imports comptent, sinon un
// export consommé par le seul `gameIso` passerait pour mort) : seule sa colonne de dette est hors gel.
//
// STOCK RÉSIDUEL (2026-08-17, #1318 E2 — 173 → 11) : chaque survivant est justifié NOMINATIVEMENT.
//  - `src/i18n/index.ts : setLocale` — commutateur du seam i18n (plan évacué → #320), la seule
//    entrée publique qui change de locale ; trois modules de moteur (`engine/mountTravel.ts`:40,
//    `engine/shipCritical.ts`:28, `engine/spellRangeFormat.ts`:49) et un test
//    (`state/player-text-ratchet.test.ts`:33) motivent leur forme (fonction plutôt que carte figée)
//    par son existence. Sans consommateur tant que le catalogue est mono-FR.
//  - `portFlow.PortState`, `landMarketFlow.LandMarketState`, `seaActivities.PendingSeaActivities`
//    (`src/state/`) — ANGLE MORT de knip, pas des morts : `store.ts` les lit en import de type INLINE
//    (`import('./portFlow').PortState`), forme que knip ne compte pas comme consommation.
//  - `src/ui/editor/**` (7) — hors périmètre de la passe E2 (chantier éditeur voisin).
import { readFileSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

export const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
export const BASELINE = join(REPO, 'knip-exports-baseline.json')
export const HORS_GEL = ['src/gameIso/']

/** Aplatit le rapport JSON de knip en `{ fichier: [noms triés] }`, hors périmètre non gelé. */
export function flatten(issues) {
  const per = {}
  for (const f of issues ?? []) {
    if (HORS_GEL.some((p) => f.file.startsWith(p))) continue
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
