// Les mémos d'analyse (`memosDAnalyse.mjs`, #2400, #2603) : signés par version, un fichier par version, de
// MEILLEUR EFFORT (sauvegarde impossible avertie, forme fausse ignorée). Dossiers sous mkdtempSync.
import { test, mock } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, utimesSync, rmSync, writeFileSync } from 'node:fs'
import { listerDossier } from './lister.mjs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { memosDe, specificateursMemoises, texteSiPresent, versionDesMemos } from './memosDAnalyse.mjs'

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

test('mémos signés par le texte d’un versionnant, `importGraph.mjs` (C2)', (t) => {
  const racine = jetable(t, 'memos-versionnant-')
  const meme = () => 'texte'
  const autre = (f) => f === 'scripts/guards/lib/importGraph.mjs' ? 'autre texte' : 'texte'
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

test('canon checkpoints : seules les familles salies se sérialisent, parcours et suppression composables', (t) => {
  const dossier = jetable(t, 'memos-checkpoints-')
  const version = 'a'.repeat(64)
  const m = memosDe(dossier, version)
  m.ecrire('lectures', 'a', 1)
  m.ecrire('evaluations', 'b', 2)
  const serialiser = mock.method(JSON, 'stringify')
  try {
    m.sauver()
    assert.equal(serialiser.mock.callCount(), 2)
    m.sauver()
    assert.equal(serialiser.mock.callCount(), 2)
    m.parcourir((nom, cle) => { if (nom === 'lectures') m.supprimer(nom, cle) })
    m.supprimer('inconnue', 'a')
    m.sauver()
    assert.equal(serialiser.mock.callCount(), 3)
  } finally { serialiser.mock.restore() }
  assert.equal(memosDe(dossier, version).lire('lectures', 'a'), undefined)
  assert.equal(memosDe(dossier, version).lire('evaluations', 'b'), 2)
  assert.equal(memosDe(dossier, 'b'.repeat(64)).lire('evaluations', 'b'), undefined)
})

test('canon checkpoints : purge 40 ou 64 hex, lecture seule sans écriture ni purge', (t) => {
  const dossier = jetable(t, 'memos-purge-')
  const anciens = [40, 41, 63, 64].map((n) => join(dossier, 'ancienne.' + 'a'.repeat(n) + '.json'))
  for (const f of anciens) { writeFileSync(f, '{}'); utimesSync(f, 0, 0) }
  const version = 'b'.repeat(64)
  const ro = memosDe(dossier, version, { lectureSeule: true })
  ro.ecrire('neuve', 'cle', 1)
  ro.sauver()
  assert.equal(listerDossier(dossier).length, 4)
  const m = memosDe(dossier, version)
  m.ecrire('neuve', 'cle', 1)
  m.sauver()
  assert.deepEqual(listerDossier(dossier), [anciens[1], anciens[2], join(dossier, 'neuve.' + version + '.json')].map((f) => f.slice(dossier.length + 1)).sort())
})

test('canon checkpoints : écriture échouée reste sale et réessaie', (t) => {
  const dossier = join(jetable(t, 'memos-reessai-'), 'cache')
  writeFileSync(dossier, 'bloque')
  const m = memosDe(dossier, 'a'.repeat(40))
  m.ecrire('lectures', 'a', 1)
  const avertir = mock.method(process.stderr, 'write', () => true)
  try { m.sauver() } finally { avertir.mock.restore() }
  rmSync(dossier)
  m.sauver()
  assert.equal(memosDe(dossier, 'a'.repeat(40)).lire('lectures', 'a'), 1)
})

test('texte d’un versionnant : absent se lit vide, une autre panne de lecture lève avec sa cause (#2586)', (t) => {
  const dossier = jetable(t, 'memos-texte-')
  assert.equal(texteSiPresent(join(dossier, 'absent.mjs')), '')
  assert.throws(() => texteSiPresent(dossier), (e) => /illisible/.test(e.message) && e.cause?.code === 'EISDIR')
})
