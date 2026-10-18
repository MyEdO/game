import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { BASELINE, REPO } from '../../ops/knip-exports-ratchet.mjs'
import { listerArbre } from '../../guards/lib/lister.mjs'
import { liaisonsDe, resolveImport } from '../../guards/lib/importGraph.mjs'

/** Graphe d'imports NOMMÉS de `src/**` : cible relative → { nom → Set(importateurs) }. */
function usageParNom() {
  const src = join(REPO, 'src')
  const files = listerArbre(src, { filtre: (rel) => /\.tsx?$/.test(rel) }).map((rel) => join(src, rel))
  const rel = (p) => relative(REPO, p).split('\\').join('/')
  const usage = new Map()
  for (const f of files) {
    for (const liaison of liaisonsDe(f, readFileSync(f, 'utf8'))) {
      if (liaison.genre !== 'import' || liaison.forme !== 'nommee') continue
      const absolu = resolveImport(f, liaison.spec)
      if (!absolu) continue
      const cible = rel(absolu)
      if (!usage.has(cible)) usage.set(cible, new Map())
      const parNom = usage.get(cible)
      const nom = liaison.importe.nom
      if (!parNom.has(nom)) parNom.set(nom, new Set())
      parNom.get(nom).add(rel(f))
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
