// Les mémos d'analyse (`memosDAnalyse.mjs`, #2400, #2603) : signés par version, un fichier par version, de
// MEILLEUR EFFORT (sauvegarde impossible avertie, forme fausse ignorée). Dossiers sous mkdtempSync.
import { test, mock } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { memosDe, specificateursMemoises, versionDesMemos } from './memosDAnalyse.mjs'

/** Un dossier jetable, retiré après le test. */
const jetable = (t, prefixe) => {
  const dossier = mkdtempSync(join(tmpdir(), prefixe))
  t.after(() => rmSync(dossier, { recursive: true, force: true }))
  return dossier
}

test('mémos signés par le tsconfig : le même blob sous deux tsconfig ne partage pas son mémo (T3)', (t) => {
  const [a, b, c] = ['{}', '{ "compilerOptions": { "verbatimModuleSyntax": true } }', '{}'].map((tsconfig) => {
    const racine = jetable(t, 'memos-tsconfig-')
    writeFileSync(join(racine, 'tsconfig.json'), tsconfig)
    return racine
  })
  const dossier = jetable(t, 'memos-')
  const ecrits = memosDe(dossier, versionDesMemos(a))
  ecrits.ecrire('specificateurs', '.ts:blob', [])
  ecrits.sauver()
  assert.equal(memosDe(dossier, versionDesMemos(b)).lire('specificateurs', '.ts:blob'), undefined)
  assert.deepEqual(memosDe(dossier, versionDesMemos(c)).lire('specificateurs', '.ts:blob'), [])
})

test('mémos signés par le texte de `perimetre.mjs`, qui calcule les mémos `declarations` et `liaisons` (C2)', (t) => {
  const racine = jetable(t, 'memos-versionnant-')
  const meme = () => 'texte'
  const autre = (f) => f === 'scripts/test/perimetre.mjs' ? 'autre texte' : 'texte'
  assert.equal(versionDesMemos(racine, meme), versionDesMemos(racine, meme))
  assert.notEqual(versionDesMemos(racine, autre), versionDesMemos(racine, meme))
})

test('#2603 — deux versions sous un même dossier ne s’évincent pas : chacune relit les siens', (t) => {
  const dossier = jetable(t, 'memos-versions-')
  const [v1, v2] = ['1', '2'].map((c) => c.repeat(40))
  for (const v of [v1, v2]) {
    const m = memosDe(dossier, v)
    m.ecrire('specificateurs', '.ts:blob', [{ spec: `./${v[0]}`, nature: 'statique' }])
    m.sauver()
  }
  assert.deepEqual([v1, v2].map((v) => memosDe(dossier, v).lire('specificateurs', '.ts:blob')[0].spec), ['./1', './2'])
})

test('#2603 — sauvegarde impossible : rien ne lève, une ligne d’avertissement le dit', (t) => {
  const dossier = join(jetable(t, 'memos-bloque-'), 'memos')
  writeFileSync(dossier, 'un fichier, pas un dossier')
  const m = memosDe(dossier, '1'.repeat(40))
  specificateursMemoises(m, { typesEffaces: false }).ecrire('a.ts', 'T', [{ spec: './y', nature: 'statique', ligne: 1 }])
  const ecrit = mock.method(process.stderr, 'write', () => true)
  try { assert.doesNotThrow(() => m.sauver()) } finally { ecrit.mock.restore() }
  assert.equal(ecrit.mock.callCount(), 1)
  assert.match(String(ecrit.mock.calls[0].arguments[0]), /mémos d'analyse non sauvés/)
})

test('#2603 — mémo de la bonne version mais de forme fausse : ignoré, comme absent', (t) => {
  const dossier = jetable(t, 'memos-forme-')
  const version = '1'.repeat(40)
  const m = memosDe(dossier, version)
  const specs = specificateursMemoises(m, { typesEffaces: false })
  specs.ecrire('a.ts', 'T', [{ spec: './y', nature: 'statique', ligne: 1 }])
  m.sauver()
  const fichier = join(dossier, `specificateurs-typage.${version}.json`)
  const [cle] = Object.keys(JSON.parse(readFileSync(fichier, 'utf8')).memos)
  for (const faux of [42, [42], [{ spec: 1, nature: 'statique' }], [{ spec: './y' }]]) {
    writeFileSync(fichier, JSON.stringify({ version, memos: { [cle]: faux } }))
    assert.equal(specificateursMemoises(memosDe(dossier, version), { typesEffaces: false }).lire('a.ts', 'T'), undefined, JSON.stringify(faux))
  }
  for (const faux of [[], 42, null]) {
    writeFileSync(fichier, JSON.stringify({ version, memos: faux }))
    assert.equal(specificateursMemoises(memosDe(dossier, version), { typesEffaces: false }).lire('a.ts', 'T'), undefined, JSON.stringify(faux))
  }
})
