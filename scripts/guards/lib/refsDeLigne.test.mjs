// Banc de la GARDE `refsDeLigne.mjs` (#1993) : chaque forme refusée est vue, chaque forme permise
// passe, puis le balayage réel de `scripts/docs/` et `scripts/gates/`.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ECRIT_LU } from '../../gates/toutes.mjs'
import { RACINES_BALAYEES, fichiersBalayes, sitesFautifs } from './refsDeLigne.mjs'

const RACINE = fileURLToPath(new URL('../../..', import.meta.url))

test('sitesFautifs : une réf `fichier.ext:NN` vers un AUTRE fichier est vue, en commentaire comme en chaîne', () => {
  const cas = [
    ['// patron : scripts/gen-registry.mjs:370', 'scripts/gen-registry.mjs:370'],
    ["  'typage jugé avant (ci.yml:52) ; ' +", 'ci.yml:52'],
    ['out += `  du registre (\\`src/engine/policy.ts:88\\`)`', 'src/engine/policy.ts:88'],
    ['// GITIGNORÉ (.gitignore:41)', '.gitignore:41'],
    ['// voir `compat.test.mjs:160,161`', 'compat.test.mjs:160'],
    ['// plage `state/merchantFlow.ts:194-201`', 'state/merchantFlow.ts:194'],
  ]
  for (const [ligne, ref] of cas) {
    assert.deepEqual(sitesFautifs(`a\n${ligne}\nb`, 'scripts/docs/build-x.mjs'), [{ ligne: 2, ref }], ligne)
  }
})

test('sitesFautifs : un `l.NN` hors citation RAW est vu, derrière un fichier, un symbole ou seul', () => {
  const cas = [
    ['// voir `pre-commit.mjs` l.272', ['pre-commit.mjs l.272']],
    ['// une réf coupée (src/a.mjs l.2-3) plus loin', ['src/a.mjs l.2-3']],
    ["  'gardé par `main()`, l.121 ; ' +", ['l.121']],
    ['// La morsure de `lanesAJouer` (l.139) ne mesure que', ['l.139']],
  ]
  for (const [ligne, refs] of cas) {
    assert.deepEqual(sitesFautifs(`a\n${ligne}\nb`, 'scripts/docs/build-x.mjs'), refs.map((ref) => ({ ligne: 2, ref })), ligne)
  }
})

test('sitesFautifs : un `/l.NN` derrière une citation RAW n’est pas une forme de `refReDe` — il est vu', () => {
  assert.deepEqual(sitesFautifs('// par palier — LDB 20 l.157/l.170', 'scripts/docs/build-x.mjs'), [{ ligne: 1, ref: 'l.170' }])
})

test('sitesFautifs : une réf `l.NN` coupée en fin de ligne est vue, à la ligne du numéro', () => {
  const texte = '// le motif de scripts/docs/reanchor.mjs\n  // l.343 puis l.354+, donc'
  assert.deepEqual(sitesFautifs(texte, 'scripts/docs/build-all.mjs'), [
    { ligne: 2, ref: 'scripts/docs/reanchor.mjs l.343' },
    { ligne: 2, ref: 'l.354' },
  ])
})

test('sitesFautifs : ancre stable, réf à soi-même, regex, heure, URL, citation RAW et étiquette de ligne passent', () => {
  const permises = [
    '// patron : `if (changed)` de `genOne` (scripts/gen-registry.mjs)',
    '// `docs/raw/4e/avancement.md` § Vue d’ensemble',
    '// plus haut, build-x.mjs:12 le dit',
    '// plus haut, `build-x.mjs` l.12 le dit',
    "assert.match(sortie, /docs\\/plans\\/x\\.md:1\\s+\\[plan\\]/)",
    '// modified: 2026-07-29T10:56:20Z',
    "const url = 'http://localhost:5173'",
    '// LDB 60 l.54, ADE II 8 l.309',
    '// (`EDO 09 l.556-570`, folio 114), LDB 40 l.58/62/63, AA 07 l.113 / LDB 18 l.88',
    '// par palier — LDB 20 l.157/170',
    '// réf multi-chapitres LDB 18 l.298/20 l.72/20 l.32-49',
    '// « … » (`frenchy.bzh 01 l.19`)',
    "      'l.2\\n  committé : \"X\"\\n' +",
    "copier(path.join(sortie, 'l.1.json'), '{}')",
    '// verbatim citable `l.<ligne>`',
  ]
  for (const p of permises) assert.deepEqual(sitesFautifs(p, 'scripts/docs/build-x.mjs'), [], p)
})

test('GARDE : aucun numéro de ligne (`fichier.ext:NN`, `l.NN`) vers un autre fichier sous scripts/docs/ ni scripts/gates/', () => {
  const fichiers = fichiersBalayes()
  assert.ok(fichiers.length > 50, `balayage suspect : ${fichiers.length} fichier(s)`)
  assert.ok(fichiers.every((f) => RACINES_BALAYEES.some((r) => f.startsWith(r))), 'fichier hors des racines balayées')
  const fautes = fichiers.flatMap((f) =>
    sitesFautifs(readFileSync(join(RACINE, f), 'utf8'), f).map((s) => `${f}:${s.ligne} ${s.ref}`))
  assert.deepEqual(fautes, [], 'numéro de ligne vers un autre fichier : le remplacer par une ANCRE STABLE (symbole, nom de test, titre)')
})

test('LIT déclaré : chaque racine balayée est couverte par `ECRIT_LU[\'test:hooks\'].lit`', () => {
  const lit = ECRIT_LU['test:hooks'].lit
  assert.deepEqual(RACINES_BALAYEES.filter((r) => !lit.some((l) => r.startsWith(l))), [])
})
