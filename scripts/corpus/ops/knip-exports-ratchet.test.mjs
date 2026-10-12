import { test } from 'node:test'

import assert from 'node:assert/strict'

import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs'

import { join, dirname, resolve, relative } from 'node:path'

import { BASELINE, REPO } from '../../ops/knip-exports-ratchet.mjs'

function usageParNom() {
  const src = join(REPO, 'src')
  const files = []
  const walk = (d) => {
    for (const e of readdirSync(d)) {
      const p = join(d, e)
      if (statSync(p).isDirectory()) walk(p)
      else if (/\.tsx?$/.test(e)) files.push(p)
    }
  }
  walk(src)
  const rel = (p) => relative(REPO, p).split('\\').join('/')
  const resoudre = (from, spec) => {
    if (!spec.startsWith('.')) return null
    const base = resolve(dirname(from), spec)
    for (const c of [base, base + '.ts', base + '.tsx', join(base, 'index.ts'), join(base, 'index.tsx')])
      if (existsSync(c) && statSync(c).isFile()) return rel(c)
    return null
  }
  const usage = new Map()
  for (const f of files) {
    for (const m of readFileSync(f, 'utf8').matchAll(/import\s+(?:type\s+)?\{([^}]*)\}\s*from\s*['"]([^'"]+)['"]/g)) {
      const cible = resoudre(f, m[2])
      if (!cible) continue
      if (!usage.has(cible)) usage.set(cible, new Map())
      const parNom = usage.get(cible)
      for (const brut of m[1].split(',')) {
        const nom = brut.trim().split(/\s+as\s+/)[0].replace(/^type\s+/, '').trim()
        if (!nom) continue
        if (!parNom.has(nom)) parNom.set(nom, new Set())
        parNom.get(nom).add(rel(f))
      }
    }
  }
  return usage
}

test('aucune entrée gelée n’est en réalité importée par gameIso (le filtre ne coupe pas le graphe)', () => {
  const usage = usageParNom()
  const baseline = JSON.parse(readFileSync(BASELINE, 'utf8'))
  const faux = []
  for (const [f, noms] of Object.entries(baseline))
    for (const n of noms) {
      const imp = usage.get(f)?.get(n)
      if (imp && [...imp].some((x) => x.startsWith('src/gameIso/'))) faux.push(`${f}#${n} ← ${[...imp].join(', ')}`)
    }
  assert.deepEqual(faux, [], 'entrée(s) gelée(s) comme mortes alors que gameIso les consomme')

  // Contre-épreuve : la mesure ne serait pas concluante si AUCUN export n'était consommé par le seul
  // gameIso — c'est précisément la population à risque (32 relevés le 2026-08-16, hors imports par
  // défaut/namespace que ce scan ne lit pas).
  let seulGameIso = 0
  for (const [cible, parNom] of usage)
    if (/^src\/(state|engine)\//.test(cible))
      for (const [, imps] of parNom) if ([...imps].every((x) => x.startsWith('src/gameIso/'))) seulGameIso++
  assert.ok(seulGameIso >= 10, `population à risque trop faible (${seulGameIso}) : le contrat ne prouverait rien`)
})

test('la baseline committée est nominative, triée, et sans entrée gameIso', () => {
  const baseline = JSON.parse(readFileSync(BASELINE, 'utf8'))
  const fichiers = Object.keys(baseline)
  assert.ok(fichiers.length > 0)
  assert.deepEqual(fichiers, [...fichiers].sort(), 'baseline : fichiers non triés (diffs illisibles)')
  for (const [f, noms] of Object.entries(baseline)) {
    assert.ok(!f.startsWith('src/gameIso/'), `${f} : gameIso est hors gel`)
    assert.ok(Array.isArray(noms) && noms.length > 0, `${f} : entrée vide`)
    assert.deepEqual(noms, [...noms].sort(), `${f} : noms non triés`)
  }
})
