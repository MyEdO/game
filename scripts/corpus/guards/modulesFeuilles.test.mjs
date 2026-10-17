import { test } from 'node:test'
import assert from 'node:assert/strict'
import { FEUILLES, manquementsDeFeuilles, sourcesSuivies } from '../../guards/lib/modulesFeuilles.mjs'

// ── l'arbre RÉEL ──────────────────────────────────────────────────────────────

test('le dépôt n’a AUCUN importeur de feuille, et la garde lit bien ses sources', () => {
  const vu = manquementsDeFeuilles()
  assert.deepEqual(vu.manquements, [])
  // Sans cette borne, une lecture cassée rendrait la garde verte en ne lisant plus rien.
  assert.ok(vu.sourcesLues > 1000, `la garde ne lit plus les sources du dépôt (${vu.sourcesLues})`)
})

test('les feuilles DÉCLARÉES sont une donnée, et chacune dit son invariant', () => {
  assert.ok(FEUILLES.length >= 1)
  const suivies = sourcesSuivies()
  for (const f of FEUILLES) {
    assert.ok(suivies.includes(f.module), `${f.module} n’est pas une source suivie`)
    assert.ok(f.pourquoi.trim(), `${f.module} sans invariant dit`)
    for (const banc of f.bancs) assert.ok(suivies.includes(banc), `${banc} n’est pas une source suivie`)
  }
})
