// `apply-livre.mjs` : appliquer deux fois l'intégration d'un livre à une fiche = l'appliquer une fois,
// pour TOUT sigle extrait du registre (sentinel `marqueurIntegration`, `_lib.mjs`).
import test from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { REGISTRE_LIVRES, estLivreExtrait, marqueurIntegration } from './_lib.mjs'

const SCRIPT = fileURLToPath(new URL('./apply-livre.mjs', import.meta.url))
const SIGLES = REGISTRE_LIVRES.filter(estLivreExtrait).map((b) => b.abbr)
const FICHE = ['# Fiche fixture', '', '## Sommaire', '', '- un topic', '', '---', '', '## Un topic', '', 'corps', ''].join('\n')

/** Rejoue `apply-livre.mjs <abbr> <sortie>` ; rend le texte de la fiche après ce passage. */
function appliquer(abbr, sortie, fiche) {
  const r = spawnSync(process.execPath, [SCRIPT, abbr, sortie], { encoding: 'utf8' })
  assert.equal(r.status, 0, `${abbr} : ${r.stderr}`)
  return readFileSync(fiche, 'utf8')
}

test('idempotence : pour CHAQUE livre extrait du registre, deux passages écrivent la fiche d’un seul', () => {
  assert.ok(SIGLES.length > 0, 'registre sans livre extrait — la garde serait verte à vide')
  const dir = mkdtempSync(join(tmpdir(), 'apply-livre-'))
  try {
    const rates = []
    for (const abbr of SIGLES) {
      const fiche = join(dir, 'fiche.md')
      const sortie = join(dir, 'sortie.json')
      writeFileSync(fiche, FICHE, 'utf8')
      writeFileSync(sortie, JSON.stringify({
        result: [{ fiche, domain: 'fixture', sommaire: '  - topic intégré', ficheTopics: '## Topic intégré\n\ncorps intégré' }],
      }), 'utf8')
      const une = appliquer(abbr, sortie, fiche)
      const deux = appliquer(abbr, sortie, fiche)
      if (!une.includes(marqueurIntegration(abbr)) || !une.includes('corps intégré') || deux !== une) rates.push(abbr)
    }
    assert.deepEqual(rates, [], `intégration non idempotente : ${rates.join(', ')}`)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('estLivreExtrait : un livre sans `dir` est refusé par le même prédicat que le périmètre', () => {
  const sansDir = REGISTRE_LIVRES.filter((b) => b.abbr && !estLivreExtrait(b))
  assert.ok(sansDir.length > 0, 'le registre ne porte aucun livre sans extraction — le cas n’est pas mesuré')
  assert.deepEqual(sansDir.filter(estLivreExtrait), [])
})
