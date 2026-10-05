// Contrat de la porte de lint du pre-commit. Les deux morsures qui comptent sont jouées avec le VRAI
// eslint et la VRAIE `eslint.config.js` du dépôt (jamais un rapport forgé) : c'est la configuration
// réelle qui décide si un fichier est jugé ou ignoré.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defautsDeRapport, fichiersALinter, lancerLint, lotsDeLigne } from './lintStage.mjs'
import { gitDeLArbreReel } from '../../test/gitDeBanc.mjs'

const RACINE = fileURLToPath(new URL('../../..', import.meta.url))
const NBSP = String.fromCharCode(0x00a0)

/** Les fixtures vivent en dossier temporaire : `lancerLint` y envoie eslint par `--cwd`, avec la
 *  config du dépôt passée en argument. L'arbre reste intact pendant que les autres lanes le lisent
 *  (`eslint .` de la gate `lint` voit tout fichier posé sous la racine : mesuré, status=1). */
const dossierDeFixtures = () => mkdtempSync(join(tmpdir(), 'lint-fixtures-'))

test('sélection : extensions jugées seulement, et JAMAIS un chemin absent du disque', () => {
  const choisis = fichiersALinter(
    [
      'src/state/rollSeam.ts',
      'scripts/guards/lib/lintStage.mjs',
      'src/data/etats.json',
      'docs/architecture.md',
      'src/ui/CeFichierNExistePas.tsx',
      'scripts\\guards\\lib\\importGraph.mjs',
    ],
    RACINE,
  )
  assert.deepEqual(choisis, [
    'src/state/rollSeam.ts',
    'scripts/guards/lib/lintStage.mjs',
    'scripts/guards/lib/importGraph.mjs',
  ])
})

test('un chemin SUPPRIMÉ par le commit ne part pas à eslint (il rendrait exit 2)', () => {
  assert.deepEqual(fichiersALinter(['src/ui/SupprimeParCeCommit.tsx'], RACINE), [])
})

test('rapport : chaque message devient un site `fichier:ligne:colonne` relatif à la racine', () => {
  const json = JSON.stringify([
    {
      filePath: join(RACINE, 'src', 'ui', 'A.tsx').replace(/\\/g, '/'),
      messages: [{ line: 12, column: 3, severity: 2, ruleId: 'no-unused-vars', message: "'x' is defined but never used." }],
    },
    { filePath: join(RACINE, 'src', 'ui', 'B.tsx'), messages: [] },
  ])
  assert.deepEqual(defautsDeRapport(json, RACINE), [
    { site: 'src/ui/A.tsx:12:3', gravite: 'erreur', regle: 'no-unused-vars', message: "'x' is defined but never used." },
  ])
})

test('FAIL-CLOSED — un rapport pollué par stderr rend un défaut NOMMÉ, jamais un lot vide', () => {
  // Le chemin d'échec est le SEUL qui compte : c'est là que le hook décide de refuser. Un octet
  // étranger collé au JSON (avertissement du moteur node, message du lanceur local) cassait le
  // parse, un `catch { return [] }` rendait « aucun défaut » et le commit passait avec un lint ROUGE.
  const json = JSON.stringify([
    {
      filePath: join(RACINE, 'src', 'x.ts'),
      messages: [{ line: 3, column: 1, severity: 2, ruleId: 'no-irregular-whitespace', message: 'Irregular whitespace not allowed' }],
    },
  ])
  const AVERTISSEMENT = '(node:8124) ExperimentalWarning: Type Stripping is an experimental feature'
  const LANCEUR = 'outillage local: eslint resolu depuis node_modules'

  assert.equal(defautsDeRapport(json, RACINE).length, 1, 'stdout pur : le défaut du fichier')
  for (const [nom, bruit] of [['avertissement node', AVERTISSEMENT], ['message du lanceur local', LANCEUR]]) {
    const defauts = defautsDeRapport(`${json}\n${bruit}\n`, RACINE)
    assert.equal(defauts.length, 1, `${nom} : le rapport pollué doit rendre UN défaut, pas un lot vide`)
    assert.equal(defauts[0].site, '(lint)')
    assert.match(defauts[0].message, /rapport illisible/)
  }
  // Une sortie VIDE reste un lot vide : rien à lire n'est pas une erreur (aucun fichier à juger).
  assert.deepEqual(defautsDeRapport('   ', RACINE), [])
})

test('FAIL-CLOSED — eslint qui échoue SANS rapport (outil absent) est un refus nommé', () => {
  // Arbre COMPLET du lanceur (ses quatre modules) mais sans `node_modules/eslint` : le refus vient de
  // la décision d'outillage, jamais d'un import manquant — c'est le refus que la porte doit NOMMER.
  const racine = mkdtempSync(join(tmpdir(), 'lint-sans-outil-'))
  try {
    mkdirSync(join(racine, 'scripts', 'guards', 'lib'), { recursive: true })
    mkdirSync(join(racine, 'scripts', 'test'), { recursive: true })
    for (const rel of [
      ['scripts', 'lancer-local.mjs'],
      ['scripts', 'outillage-local.mjs'],
      ['scripts', 'test', 'partition.mjs'],
      ['scripts', 'guards', 'lib', 'invocation.mjs'],
    ])
      copyFileSync(join(RACINE, ...rel), join(racine, ...rel))
    writeFileSync(join(racine, 'a.ts'), 'export const a = 1\n')
    const { defauts } = lancerLint(racine, ['a.ts'])
    assert.equal(defauts.length, 1)
    assert.equal(defauts[0].site, '(lint)')
    assert.match(defauts[0].message, /eslint a échoué sans rapport/)
    assert.match(defauts[0].message, /n'est pas installé dans cet arbre/)
  } finally {
    rmSync(racine, { recursive: true, force: true })
  }
})

test('MORSURE — un fichier fautif est refusé, un fichier IGNORÉ par la config ne l’est pas', () => {
  const dossier = dossierDeFixtures()
  const relIgnore = 'lint-fixture.config.ts'
  try {
    // Espace insécable dans le code : `no-irregular-whitespace` (eslint:recommended) le refuse.
    writeFileSync(join(dossier, 'fautif.ts'), `export const a =${NBSP}1\n`)
    writeFileSync(join(dossier, 'sain.ts'), 'export const b = 1\n')
    // `eslint.config.js` ignore `*.config.*` : cité EXPLICITEMENT, ce fichier rendrait un
    // avertissement — donc un échec sous `--max-warnings 0` — sans `--no-warn-ignored`.
    writeFileSync(join(dossier, relIgnore), `export const c =${NBSP}1\n`)

    const { defauts, brut } = lancerLint(RACINE, ['fautif.ts', 'sain.ts', relIgnore], { cwd: dossier })
    assert.ok(defauts.length >= 1, `aucun défaut rendu — sortie brute : ${brut.slice(0, 400)}`)
    assert.deepEqual(
      defauts.filter((d) => d.site.startsWith('fautif.ts:')).map((d) => d.regle),
      ['no-irregular-whitespace'],
    )
    assert.deepEqual(defauts.filter((d) => d.site.includes('sain.ts')), [])
    assert.deepEqual(defauts.filter((d) => d.site.includes('lint-fixture')), [])

    // NOMINATIVE : la morsure ne dépose RIEN dans l'arbre que les autres lanes lisent au même moment.
    // Seuls les chemins de fixture sont regardés — un écrivain d'une autre gate ne rougit pas ce test.
    const statut = gitDeLArbreReel(RACINE)('status', '--porcelain')
    assert.deepEqual(statut.split('\n').filter((l) => l.includes('lint-fixture')), [])
  } finally {
    rmSync(dossier, { recursive: true, force: true })
  }
})

test('LIGNE DE PROD (`cwd` = racine) : la config du dépôt juge un fichier réel, et le site lui est relatif', () => {
  // Ce que joue le pre-commit, mot pour mot : `lancerLint(RACINE, …)` sans `cwd`. Le fichier est jugé
  // (il est dans le rapport) et ne porte aucun défaut — le couple qu'une config PASSÉE doit rendre
  // à l'identique d'une config découverte.
  const rel = 'src/state/rollSeam.ts'
  const { defauts, stdout } = lancerLint(RACINE, [rel])
  assert.deepEqual(defauts, [], `défauts inattendus : ${JSON.stringify(defauts)}`)
  const juges = JSON.parse(stdout).map((f) => String(f.filePath).replace(/\\/g, '/'))
  assert.deepEqual(juges, [join(RACINE, rel).replace(/\\/g, '/')], 'eslint a bien jugé ce fichier, et lui seul')
})

test('lots de ligne : ordre gardé, chaque lot tient dans le budget, un chemin trop long part seul', () => {
  const chemins = ['aaaa', 'bb', 'cccccc', 'd', 'eeeeeeeeeeee', 'ff']
  const lots = lotsDeLigne(chemins, 8)
  assert.deepEqual(lots, [['aaaa', 'bb'], ['cccccc'], ['d'], ['eeeeeeeeeeee'], ['ff']])
  assert.deepEqual(lots.flat(), chemins)
  for (const lot of lots.filter((l) => l.length > 1)) assert.ok(lot.reduce((n, f) => n + f.length + 1, 0) <= 8)
})

test('MORSURE EN PLUSIEURS LANCEMENTS : les défauts de chaque lot s’additionnent, aucun fichier ne se perd', () => {
  const dossier = dossierDeFixtures()
  try {
    writeFileSync(join(dossier, 'fautif-a.ts'), `export const a =${NBSP}1\n`)
    writeFileSync(join(dossier, 'sain.ts'), 'export const b = 1\n')
    writeFileSync(join(dossier, 'fautif-c.ts'), `export const c =${NBSP}1\n`)
    // Budget 1 : chaque fichier part dans SON lancement.
    const { defauts, stdout } = lancerLint(RACINE, ['fautif-a.ts', 'sain.ts', 'fautif-c.ts'], { cwd: dossier, budget: 1 })
    assert.deepEqual(defauts.map((d) => `${d.site.split(':')[0]} ${d.regle}`), ['fautif-a.ts no-irregular-whitespace', 'fautif-c.ts no-irregular-whitespace'])
    assert.deepEqual(JSON.parse(stdout).map((f) => String(f.filePath).replace(/\\/g, '/').split('/').pop()), ['fautif-a.ts', 'sain.ts', 'fautif-c.ts'])
  } finally {
    rmSync(dossier, { recursive: true, force: true })
  }
})

test('LIGNE DE PROD au-delà de 32 767 caractères de chemins : le lot est JUGÉ, jamais refusé sans rapport', () => {
  const rel = 'src/state/rollSeam.ts'
  const fichiers = Array.from({ length: 2000 }, () => rel)
  assert.ok(fichiers.join(' ').length > 32767, 'le lot dépasse la ligne de commande que Windows sait créer')
  const { defauts, stdout } = lancerLint(RACINE, fichiers)
  assert.deepEqual(defauts, [], `défauts inattendus : ${JSON.stringify(defauts)}`)
  const juges = new Set(JSON.parse(stdout).map((f) => String(f.filePath).replace(/\\/g, '/')))
  assert.deepEqual([...juges], [join(RACINE, rel).replace(/\\/g, '/')])
})

test('lot vide : aucun processus lancé, aucun défaut', () => {
  assert.deepEqual(lancerLint(RACINE, []), { defauts: [], brut: '', stdout: '' })
})
