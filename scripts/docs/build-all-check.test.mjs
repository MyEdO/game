// Contrat de `docs:check` (#1679 L2 T1d, #1801, #1775, #2203) :
//   · `--check` rejoue chaque générateur et compare son rendu au DISQUE, sans rien écrire ;
//   · en `--check`, `executer` va au bout : chaque rouge est nommé avec sa nature, sortie 1 ;
// #2193, #2475
//   node --test scripts/docs/build-all-check.test.mjs  (chaîné dans `npm run test:docs`)
//
// Les cas de bout en bout jouent `executer` pour de vrai, `generateurs` injectés, sur un DÉPÔT
// JETABLE et des générateurs RÉELS qui passent par `ecrireOuVerifier`.
import test from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { listerDossier } from '../guards/lib/lister.mjs'
import { instanceDeDepot } from '../guards/lib/depotGabarit.mjs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { genererCode, issueDe, natureDuRouge, perimetreDesMixtes } from './build-all.mjs'
import { gitDe } from '../test/gitDeBanc.mjs'
import { CACHE_FRAICHEUR } from './lib/cache-fraicheur.mjs'
import { chargerPreuve, preuveValide } from './lib/fraicheur-docs.mjs'
import { ciblesPures, ciblesSurDisque, SOURCES_LUES } from './build-all.mjs'
import { clotureDImports } from '../guards/lib/importGraph.mjs'

const ICI = path.dirname(fileURLToPath(import.meta.url))

// Chemin de doc ASSEMBLÉ : un littéral `docs/<nom>.md` qui ne désigne AUCUN doc réel est lu par
// `scripts/docs/check-doc-refs.mjs` comme une référence vivante — qu'il déclare morte. Patron :
// `scripts/docs/lib/ecriture-derives.test.mjs`.
const doc = (nom) => ['docs', `${nom}.md`].join('/')
const DOC_A = doc('a')
const DOC_B = doc('b')

test('natureDuRouge : un code de sortie se nomme tel quel', () => {
  for (const status of [1, 2, 3, 13, 6, 7, 3221225794]) assert.equal(natureDuRouge({ status }), `sortie ${status}`)
  assert.equal(natureDuRouge({}), 'sans code de sortie')
})

test('natureDuRouge : un processus tué ou coupé se nomme par son signal ou son errno, jamais « non démarré »', () => {
  assert.equal(natureDuRouge(issueDe({ status: null, signal: 'SIGKILL' })), 'tué par SIGKILL')
  assert.equal(natureDuRouge(issueDe({ status: null, signal: 'SIGTERM', code: 'ENOBUFS', message: 'spawnSync node ENOBUFS' })), 'ENOBUFS (tué par SIGTERM)')
  assert.equal(natureDuRouge(issueDe({ code: 'ENOENT', message: 'spawnSync x ENOENT' })), 'ENOENT')
})

// ── De bout en bout : `executer`, `generateurs` injectés, sur des générateurs RÉELS ─────────────

const PRIMITIVE = pathToFileURL(path.join(ICI, 'lib', 'ecriture-derives.mjs')).href
const BUILD_ALL = pathToFileURL(path.join(ICI, 'build-all.mjs')).href

function copierOutillage(racine) {
  const origine = path.resolve(ICI, '../..')
  const copie = path.join(racine, 'outillage')
  const racines = ['scripts/docs/build-all.mjs', 'scripts/docs/lib/enregistreur-lectures.mjs', 'scripts/docs/lib/enregistreur-hooks.mjs']
  for (const rel of clotureDImports(racines, { racine: origine })) {
    mkdirSync(path.dirname(path.join(copie, rel)), { recursive: true })
    copyFileSync(path.join(origine, rel), path.join(copie, rel))
  }
  symlinkSync(path.join(origine, 'node_modules'), path.join(copie, 'node_modules'), process.platform === 'win32' ? 'junction' : 'dir')
  return { copie, outil: pathToFileURL(path.join(copie, racines[0])).href }
}

function depotFermeture({ mutation = false, cycle = false, injections = false } = {}) {
  const generateurs = ['a', 'b'].map((nom) => ({ runner: 'node', script: `g/${nom}.mjs`, targets: [`data/${nom}*.generated.ts`], ...(injections ? { injecte: ['notes/mixte.md'] } : {}) }))
  const scripts = Object.fromEntries(['a', 'b'].map((nom) => {
    const cible = cycle ? `\`data/${nom}-\${noms.length}.generated.ts\`` : JSON.stringify(`data/${nom}.generated.ts`)
    return [`g/${nom}.mjs`, [
      "import { readFileSync, readdirSync, writeFileSync } from 'node:fs'",
      `import { ecrireOuVerifier } from ${JSON.stringify(PRIMITIVE)}`,
      `const lu = readFileSync('inputs/${nom}.txt', 'utf8')`,
      ...(nom === 'a' || cycle ? [`const noms = readdirSync('data').filter((n) => !n.startsWith('${nom}') || !n.endsWith('.generated.ts')).sort()`] : []),
      `ecrireOuVerifier({ path: ${cible}, out: ${nom === 'a' || cycle ? 'JSON.stringify(noms)' : 'lu'}, check: process.argv.includes('--check'), staleMsg: 'froid périmé', rerunMsg: 'relancer' })`,
      ...(!cycle && nom === 'b' ? ["if (lu === 'suivante') ecrireOuVerifier({ path: 'data/b-suivante.generated.ts', out: lu, check: process.argv.includes('--check'), staleMsg: 'glob périmé', rerunMsg: 'relancer' })"] : []),
      ...(injections ? ["ecrireOuVerifier({ path: 'notes/mixte.md', out: lu, check: process.argv.includes('--check'), staleMsg: 'mixte périmé', rerunMsg: 'relancer' })"] : []),
      ...(mutation && nom === 'b' ? ["if (!process.argv.includes('--check')) writeFileSync('inputs/a.txt', 'mutation externe')"] : []),
    ].join('\n')]
  }))
  const { racine } = instanceDeDepot({ fichiers: { '.gitignore': '*.generated.ts\ndocs/\n', 'data/source.txt': 'source', 'inputs/a.txt': 'a', 'inputs/b.txt': 'b', ...(injections ? { 'notes/mixte.md': 'initial' } : {}), ...scripts } })
  return { racine, generateurs, options: { generateurs, ciblesSurDisque, sourcesLues: SOURCES_LUES } }
}

for (const injections of [false, true]) test(`fermeture froide : producteur amont rejoué réellement après sortie étrangère${injections ? ', derniers injecteurs dans ordre réel' : ''}`, () => {
  const { racine, generateurs, options } = depotFermeture({ injections })
  try {
    assert.equal(existsSync(path.join(racine, 'data/a.generated.ts')), false)
    assert.equal(existsSync(path.join(racine, 'data/b.generated.ts')), false)
    const vu = executer(racine, [], {}, [], generateurs)
    assert.equal(vu.status, 0, vu.sortie)
    assert.equal((vu.sortie.match(/g\/a\.mjs — début/g) ?? []).length, 2, vu.sortie)
    assert.equal((vu.sortie.match(/g\/b\.mjs — début/g) ?? []).length, 1, vu.sortie)
    assert.match(vu.sortie, /fermeture 1 : g\/a\.mjs périmé : sources différentes : dossiers : data/)
    assert.deepEqual(JSON.parse(readFileSync(path.join(racine, 'data/a.generated.ts'), 'utf8')), ['b.generated.ts', 'source.txt'])
    assert.equal(preuveValide(racine, options).ok, true, vu.sortie)
    if (injections) {
      assert.equal(readFileSync(path.join(racine, 'notes/mixte.md'), 'utf8'), 'a')
      const preuve = chargerPreuve(racine)
      assert.deepEqual(preuve.generateurs['g/a.mjs'].sorties.find(([rel]) => rel === 'notes/mixte.md'), preuve.generateurs['g/b.mjs'].sorties.find(([rel]) => rel === 'notes/mixte.md'))
    }
  } finally { rmSync(racine, { recursive: true, force: true }) }
})

test('--perimes : éligible frais sauté puis repris après nouvelle sortie glob aval', () => {
  const { racine, generateurs, options } = depotFermeture()
  try {
    const initial = executer(racine, [], {}, [], generateurs)
    assert.equal(initial.status, 0, initial.sortie)
    writeFileSync(path.join(racine, 'inputs/b.txt'), 'suivante')
    const vu = executer(racine, ['--perimes'], {}, [], generateurs)
    assert.equal(vu.status, 0, vu.sortie)
    assert.equal((vu.sortie.match(/g\/a\.mjs — début/g) ?? []).length, 1, vu.sortie)
    assert.equal((vu.sortie.match(/g\/b\.mjs — début/g) ?? []).length, 1, vu.sortie)
    assert.match(vu.sortie, /fermeture 1 : g\/a\.mjs périmé/)
    assert.equal(existsSync(path.join(racine, 'data/b-suivante.generated.ts')), true)
    assert.equal(preuveValide(racine, options).ok, true, vu.sortie)
  } finally { rmSync(racine, { recursive: true, force: true }) }
})

test('--perimes : injecteur frais sauté conservé puis normalisé après dernier écrivain rejoué', () => {
  const { racine, generateurs, options } = depotFermeture({ injections: true })
  try {
    const initial = executer(racine, [], {}, [], generateurs)
    assert.equal(initial.status, 0, initial.sortie)
    assert.equal(readFileSync(path.join(racine, 'notes/mixte.md'), 'utf8'), 'a')
    writeFileSync(path.join(racine, 'inputs/b.txt'), 'b-modifiée')
    const vu = executer(racine, ['--perimes'], {}, [], generateurs)
    assert.equal(vu.status, 0, vu.sortie)
    assert.equal((vu.sortie.match(/g\/a\.mjs — début/g) ?? []).length, 0, vu.sortie)
    assert.equal((vu.sortie.match(/g\/b\.mjs — début/g) ?? []).length, 1, vu.sortie)
    assert.equal(existsSync(path.join(racine, 'data/b-suivante.generated.ts')), false)
    assert.equal(readFileSync(path.join(racine, 'notes/mixte.md'), 'utf8'), 'b-modifiée')
    const preuve = chargerPreuve(racine)
    assert.equal(preuveValide(racine, options, preuve).ok, true, vu.sortie)
    assert.deepEqual(preuve.generateurs['g/a.mjs'].sorties.find(([rel]) => rel === 'notes/mixte.md'), preuve.generateurs['g/b.mjs'].sorties.find(([rel]) => rel === 'notes/mixte.md'))
  } finally { rmSync(racine, { recursive: true, force: true }) }
})

test('fermeture respecte --only ; --check ne génère ni ne publie de certificat', () => {
  const { racine, generateurs } = depotFermeture()
  try {
    const seul = executer(racine, ['--only', 'g/a.mjs'], {}, [], generateurs)
    assert.equal(seul.status, 0, seul.sortie)
    assert.doesNotMatch(seul.sortie, /g\/b\.mjs — début|fermeture/)
    assert.equal(existsSync(path.join(racine, 'data/b.generated.ts')), false)
    assert.equal(chargerPreuve(racine).generateurs['g/b.mjs'], undefined)
    const cache = readFileSync(path.join(racine, CACHE_FRAICHEUR))
    const mesure = readFileSync(path.join(racine, SOURCES_LUES))
    const cible = readFileSync(path.join(racine, 'data/a.generated.ts'))
    const check = executer(racine, ['--check'], {}, [], generateurs)
    assert.equal(check.status, 1, check.sortie)
    assert.doesNotMatch(check.sortie, /fermeture/)
    assert.equal(existsSync(path.join(racine, 'data/b.generated.ts')), false)
    assert.deepEqual(readFileSync(path.join(racine, CACHE_FRAICHEUR)), cache)
    assert.deepEqual(readFileSync(path.join(racine, SOURCES_LUES)), mesure)
    assert.deepEqual(readFileSync(path.join(racine, 'data/a.generated.ts')), cible)
  } finally { rmSync(racine, { recursive: true, force: true }) }
})

test('fermeture : une mutation de source connue entre passes reste fatale', () => {
  const { racine, generateurs, options } = depotFermeture({ mutation: true })
  try {
    const vu = executer(racine, [], {}, [], generateurs)
    assert.equal(vu.status, 1, vu.sortie)
    assert.match(vu.sortie, /source modifiée ou non capturée : inputs\/a\.txt/)
    assert.equal(preuveValide(racine, options).ok, false)
  } finally { rmSync(racine, { recursive: true, force: true }) }
})

test('lecture tardive : nouveau endpoint glob aval absent au dépliage initial refusé par déclaration', () => {
  const { racine, generateurs } = depotFermeture()
  try {
    const premier = { runner: 'node', script: 'g/premier.mjs', targets: ['data/premier.generated.ts'], injecte: ['data/b-nouvelle.generated.ts'] }
    writeFileSync(path.join(racine, premier.script), [
      "import { readFileSync } from 'node:fs'",
      `import { ecrireOuVerifier } from ${JSON.stringify(PRIMITIVE)}`,
      "const lu = readFileSync('inputs/a.txt', 'utf8')",
      "for (const cible of ['data/premier.generated.ts', 'data/b-nouvelle.generated.ts']) ecrireOuVerifier({ path: cible, out: lu, check: process.argv.includes('--check'), staleMsg: 'premier périmé', rerunMsg: 'relancer' })",
    ].join('\n'))
    const script = path.join(racine, 'g/a.mjs')
    writeFileSync(script, readFileSync(script, 'utf8') + "\nreadFileSync('data/b-nouvelle.generated.ts', 'utf8')\n")
    assert.equal(existsSync(path.join(racine, 'data/b-nouvelle.generated.ts')), false)
    assert.deepEqual(ciblesSurDisque(generateurs[1].targets, racine), [])
    const vu = executer(racine, [], {}, [], [premier, ...generateurs])
    assert.equal(vu.status, 1, vu.sortie)
    assert.match(vu.sortie, /g\/premier\.mjs — début/)
    assert.equal(existsSync(path.join(racine, 'data/b-nouvelle.generated.ts')), true)
    assert.match(vu.sortie, /lit « data\/b-nouvelle\.generated\.ts », que g\/b\.mjs écrit au même rang ou plus tard/)
    assert.doesNotMatch(vu.sortie, /g\/b\.mjs — début/)
    assert.equal(chargerPreuve(racine)?.generateurs['g/a.mjs'], undefined)
  } finally { rmSync(racine, { recursive: true, force: true }) }
})

test('contexte initial : outillage copié muté entre préparation et rang suivant refusé', async () => {
  const { racine, generateurs, options } = depotFermeture()
  try {
    const { copie } = copierOutillage(racine)
    const { avantGenerateur, preparerPreuves } = await import(pathToFileURL(path.join(copie, 'scripts/docs/lib/fraicheur-docs.mjs')).href)
    const preparation = preparerPreuves(racine, options)
    const cible = path.join(copie, 'scripts/guards/lib/ecritureJsonAtomique.mjs')
    writeFileSync(cible, readFileSync(cible, 'utf8') + '\n')
    assert.throws(() => avantGenerateur(racine, generateurs[0], options, preparation), /contexte modifié depuis préparation : outillage/)
    assert.equal(chargerPreuve(racine), null)
  } finally { rmSync(racine, { recursive: true, force: true }) }
})

test('fermeture : cycle de listings et sorties globs refusé après borne explicite', () => {
  const { racine, generateurs, options } = depotFermeture({ cycle: true })
  try {
    const vu = executer(racine, [], {}, [], generateurs)
    assert.equal(vu.status, 1, vu.sortie)
    assert.match(vu.sortie, /fermeture non convergente après 3 passes : g\/a\.mjs/)
    assert.equal((vu.sortie.match(/g\/a\.mjs — début/g) ?? []).length, 2, vu.sortie)
    assert.equal((vu.sortie.match(/g\/b\.mjs — début/g) ?? []).length, 2, vu.sortie)
    assert.equal(preuveValide(racine, options).ok, false)
  } finally { rmSync(racine, { recursive: true, force: true }) }
})

for (const glob of [false, true]) test(`build froid réel : listing propre ${glob ? 'glob' : 'littéral'} et sonde future`, () => {
  const cible = 'data/froid.generated.ts'
  const script = [
    "import { existsSync, readFileSync } from 'node:fs'",
    `import { listerDossier } from ${JSON.stringify(pathToFileURL(path.join(ICI, '../guards/lib/lister.mjs')).href)}`,
    `import { ecrireOuVerifier } from ${JSON.stringify(PRIMITIVE)}`,
    `existsSync(${JSON.stringify(cible)})`,
    ...(glob ? ["existsSync('data/futur.generated.ts')"] : []),
    "const sources = listerDossier('data').filter(n => n.endsWith('.txt')).map(n => readFileSync('data/' + n, 'utf8')).join('')",
    `ecrireOuVerifier({ path: ${JSON.stringify(cible)}, out: 'export const froid = ' + JSON.stringify(sources) + '\\n', check: process.argv.includes('--check'), staleMsg: 'froid périmé', rerunMsg: 'relancer' })`,
  ].join('\n')
  const { racine } = instanceDeDepot({ fichiers: { '.gitignore': '*.generated.ts\ndocs/\n', 'data/source.txt': 'source', 'g/froid.mjs': script } })
  const generateurs = [{ runner: 'node', script: 'g/froid.mjs', targets: [glob ? 'data/*.generated.ts' : cible] }]
  try {
    assert.equal(existsSync(path.join(racine, cible)), false)
    const froid = executer(racine, ['--code'], {}, [], generateurs)
    assert.equal(froid.status, 0, froid.sortie)
    const preuve = chargerPreuve(racine)
    assert.equal(preuveValide(racine, { generateurs, ciblesSurDisque, sourcesLues: SOURCES_LUES }).ok, true)
    assert.equal(preuve.generateurs['g/froid.mjs'].mesure.sondes.some(q => q.chemin.endsWith('.generated.ts')), false)
    const bytes = readFileSync(path.join(racine, cible))
    assert.equal(executer(racine, ['--check', '--code'], {}, [], generateurs).status, 0)
    assert.deepEqual(readFileSync(path.join(racine, cible)), bytes)
  } finally { rmSync(racine, { recursive: true, force: true }) }
})

test('export physique vide : sélection code vide sans écriture ni certification', () => {
  const racine = mkdtempSync(path.join(tmpdir(), 'export-code-vide-'))
  try {
    assert.equal(genererCode({ cwd: racine, quiet: true, generateurs: [] }), 0)
    assert.deepEqual(listerDossier(racine), [])
  } finally { rmSync(racine, { recursive: true, force: true }) }
})

for (const gitDefectueux of [false, true]) test(`export physique code réel : ${gitDefectueux ? 'marqueur git défectueux refusé' : 'dépendances liées et certificat local'}`, () => {
  const racine = mkdtempSync(path.join(tmpdir(), 'export-code-reel-'))
  const dependances = mkdtempSync(path.join(tmpdir(), 'export-dependances-'))
  const cible = ['src', 'export.generated.ts'].join('/')
  const generateurs = [{ runner: 'node', script: 'g/a.mjs', targets: [cible] }]
  try {
    for (const dossier of ['src', 'g', 'docs']) mkdirSync(path.join(racine, dossier))
    writeFileSync(path.join(racine, 'src/a.ts'), 'export const a = 1\n')
    writeFileSync(path.join(racine, 'src/commun.ts'), 'export const commun = 1\n')
    writeFileSync(path.join(racine, 'g/a.mjs'), generateurReel('a').replaceAll(DOC_A, cible))
    symlinkSync(dependances, path.join(racine, 'node_modules'), 'junction')
    if (gitDefectueux) writeFileSync(path.join(racine, '.git'), 'gitdir: inexistant\n')
    const avantDependances = listerDossier(dependances)
    const vu = executer(racine, ['--code'], {}, [], generateurs)
    if (gitDefectueux) {
      assert.equal(vu.status, 1, vu.sortie)
      assert.equal(existsSync(path.join(racine, cible)), false)
      assert.equal(chargerPreuve(racine), null)
    } else {
      assert.equal(vu.status, 0, vu.sortie)
      assert.equal(existsSync(path.join(racine, cible)), true)
      const options = { generateurs, ciblesSurDisque, sourcesLues: SOURCES_LUES }
      const preuve = chargerPreuve(racine)
      assert.equal(preuveValide(racine, options).ok, true)
      assert.equal(preuve.generateurs['g/a.mjs'].sources.contexte.perimetre.nature, 'physique')
      assert.equal(existsSync(path.join(racine, 'docs/.cache/docs-fraicheur.json')), true)
      writeFileSync(path.join(racine, 'src/a.ts'), 'source modifiée après certificat')
      assert.equal(preuveValide(racine, options).ok, false)
    }
    assert.deepEqual(listerDossier(dependances), avantDependances)
  } finally {
    rmSync(racine, { recursive: true, force: true })
    rmSync(dependances, { recursive: true, force: true })
  }
})

function modesReels(racine) {
  const code = ['src', 'a.generated.ts'].join('/')
  writeFileSync(path.join(racine, 'g/a.mjs'), generateurReel('a').replaceAll(DOC_A, code))
  return [{ ...GENERATEURS_REELS[0], targets: [code] }, { ...GENERATEURS_REELS[1], targets: [], injecte: [DOC_B] }]
}

for (const mode of ['--code', '--mixtes']) test(`${mode} certifie ses écritures ; check ne modifie ni sorties ni preuve`, () => {
  const { racine } = depotReel({ docsIgnores: true })
  try {
    const generateurs = modesReels(racine)
    const initial = executer(racine, [], {}, [], generateurs)
    assert.equal(initial.status, 0, initial.sortie)
    const preuveAvant = readFileSync(path.join(racine, CACHE_FRAICHEUR))
    const source = path.join(racine, 'src/a.ts')
    writeFileSync(source, 'export const a = 999999\n')
    const cible = path.join(racine, generateurs[0].targets[0])
    const avant = readFileSync(cible)
    const check = executer(racine, ['--check', mode], {}, [], generateurs)
    assert.equal(check.status, 1, check.sortie)
    assert.deepEqual(readFileSync(cible), avant)
    assert.deepEqual(readFileSync(path.join(racine, CACHE_FRAICHEUR)), preuveAvant)
    const vu = executer(racine, [mode], {}, [], generateurs)
    assert.equal(vu.status, 0, vu.sortie)
    const preuve = chargerPreuve(racine)
    assert.ok(preuve.generateurs[generateurs[0].script], vu.sortie)
    assert.equal(preuveValide(racine, { generateurs, ciblesSurDisque, sourcesLues: SOURCES_LUES }).ok, true)
  } finally { rmSync(racine, { recursive: true, force: true }) }
})

test('préparation illisible : arrêt avant tout générateur', () => {
  const { racine } = depotReel({ docsIgnores: true })
  try {
    writeFileSync(path.join(racine, SOURCES_LUES), '{')
    const avant = readFileSync(path.join(racine, DOC_A))
    const vu = executer(racine, [])
    assert.equal(vu.status, 1, vu.sortie)
    assert.doesNotMatch(vu.sortie, /g\/a\.mjs — début|g\/b\.mjs — début/)
    assert.deepEqual(readFileSync(path.join(racine, DOC_A)), avant)
  } finally { rmSync(racine, { recursive: true, force: true }) }
})

test('certification refusée : arrêt avant générateur aval', () => {
  const { racine } = depotReel({ docsIgnores: true })
  try {
    mkdirSync(path.join(racine, 'references-vides'))
    const source = generateurReel('a').replace("import { readFileSync }", "import { readFileSync, readdirSync }")
      + "\nreaddirSync('references-vides')\n"
    writeFileSync(path.join(racine, 'g/a.mjs'), source)
    const aval = readFileSync(path.join(racine, DOC_B))
    const vu = executer(racine, [])
    assert.equal(vu.status, 1, vu.sortie)
    assert.match(vu.sortie, /listing modifié ou non capturé/)
    assert.doesNotMatch(vu.sortie, /g\/b\.mjs — début/)
    assert.deepEqual(readFileSync(path.join(racine, DOC_B)), aval)
    assert.equal(chargerPreuve(racine)?.generateurs['g/a.mjs'], undefined)
  } finally { rmSync(racine, { recursive: true, force: true }) }
})

for (const argv of [[], ['--perimes']]) test(`preuve finale refusée : sortie rouge ${argv.join(' ') || 'complète'}`, () => {
  const { racine } = depotReel({ docsIgnores: true })
  try {
    mkdirSync(path.join(racine, 'v'))
    writeFileSync(path.join(racine, 'v/course.mjs'), "import { writeFileSync } from 'node:fs'\nwriteFileSync('src/a.ts', 'course finale')\n")
    writeFileSync(path.join(racine, 'src/a.ts'), 'source nouvelle')
    const vu = executer(racine, argv, {}, ['v/course.mjs'])
    assert.equal(vu.status, 1, vu.sortie)
    assert.equal(chargerPreuve(racine)?.generateurs['g/a.mjs'], undefined)
  } finally { rmSync(racine, { recursive: true, force: true }) }
})

test('--perimes sans écriture ne lance aucun générateur ni vérificateur', () => {
  const { racine } = depotReel({ docsIgnores: true })
  try {
    mkdirSync(path.join(racine, 'v'))
    writeFileSync(path.join(racine, 'v/refus.mjs'), "throw new Error('NE DOIT PAS TOURNE')")
    const avant = statSync(path.join(racine, DOC_A)).mtimeMs
    const vu = executer(racine, ['--perimes'], {}, ['v/refus.mjs'])
    assert.equal(vu.status, 0, vu.sortie)
    assert.doesNotMatch(vu.sortie, /g\/a\.mjs — début|g\/b\.mjs — début|NE DOIT PAS TOURNE/)
    assert.equal(statSync(path.join(racine, DOC_A)).mtimeMs, avant)
  } finally { rmSync(racine, { recursive: true, force: true }) }
})

test('--perimes recertifie un certificat absent avec une mesure déjà présente', () => {
  const { racine } = depotReel({ docsIgnores: true })
  try {
    rmSync(path.join(racine, CACHE_FRAICHEUR))
    const vu = executer(racine, ['--perimes'])
    assert.equal(vu.status, 0, vu.sortie)
    assert.equal(preuveValide(racine, { generateurs: GENERATEURS_REELS, ciblesSurDisque, sourcesLues: SOURCES_LUES }).ok, true, vu.sortie)
  } finally { rmSync(racine, { recursive: true, force: true }) }
})

for (const identique of [true, false]) test(`--perimes mesure le lecteur au rang après producteur, sortie ${identique ? 'identique' : 'différente'}`, () => {
  const { racine } = depotReel({ docsIgnores: true })
  try {
    writeFileSync(path.join(racine, 'g/b.mjs'), generateurReel('b').replace("readFileSync('src/b.ts', 'utf8')", `readFileSync('${DOC_A}', 'utf8')`).replace('${lu.length}', '${lu}'))
    const initial = executer(racine, [])
    assert.equal(initial.status, 0, initial.sortie)
    const ancien = readFileSync(path.join(racine, DOC_B))
    writeFileSync(path.join(racine, 'src/a.ts'), identique ? 'export const a = 2\n' : 'export const a = 222222\n')
    const vu = executer(racine, ['--perimes'])
    assert.equal(vu.status, 0, vu.sortie)
    assert.match(vu.sortie, /g\/a\.mjs — début/)
    if (identique) {
      assert.doesNotMatch(vu.sortie, /g\/b\.mjs — début/)
      assert.deepEqual(readFileSync(path.join(racine, DOC_B)), ancien)
    } else {
      assert.match(vu.sortie, /g\/b\.mjs — début/)
      assert.notDeepEqual(readFileSync(path.join(racine, DOC_B)), ancien)
    }
    assert.equal(preuveValide(racine, { generateurs: GENERATEURS_REELS, ciblesSurDisque, sourcesLues: SOURCES_LUES }).ok, true)
  } finally { rmSync(racine, { recursive: true, force: true }) }
})

/** Un générateur RÉEL : lit ses DEUX sources (`SEUIL_SOURCES`), rend un doc qui CITE un chemin, et
 *  passe par la primitive. `cliquet` : sous `BANC_SORTIE=<code>`, il pose ce code AVANT la
 *  primitive, comme `reconcile.mjs` — les deux rouges doivent alors se dire. */
const generateurReel = (nom, { cliquet = false } = {}) => [
  "import { readFileSync } from 'node:fs'",
  `import { ecrireOuVerifier } from ${JSON.stringify(PRIMITIVE)}`,
  `const lu = readFileSync('src/${nom}.ts', 'utf8') + readFileSync('src/commun.ts', 'utf8')`,
  cliquet ? "if (process.env.BANC_SORTIE) { console.log('CLIQUET ROUGE'); process.exitCode = Number(process.env.BANC_SORTIE) }" : '',
  'ecrireOuVerifier({',
  `  out: \`# ${nom}\\n\\nSource : \\\`src/${nom}.ts\\\` (\${lu.length} octets)\\n\`,`,
  `  path: 'docs/${nom}.md',`,
  "  check: process.argv.includes('--check'),",
  `  staleMsg: 'docs/${nom}.md PÉRIMÉ', rerunMsg: 'relancer',`,
  '})',
].join('\n')

const GENERATEURS_REELS = [
  { runner: 'node', script: 'g/a.mjs', targets: [DOC_A] },
  { runner: 'node', script: 'g/b.mjs', targets: [DOC_B] },
]

/** Joue `executer` dans un processus À PART (il imprime sur stderr, que le banc lit), par un HARNAIS
 *  posé sous le `node_modules/` ignoré du dépôt jetable : un module qui en importe un autre par
 *  `file://` absolu, lancé comme tout script. */
function executer(racine, argv, env = {}, verificateurs = [], generateurs = GENERATEURS_REELS, outil = BUILD_ALL) {
  const harnais = path.join(racine, 'docs', '.cache', 'harnais-executer.mjs')
  mkdirSync(path.dirname(harnais), { recursive: true })
  writeFileSync(harnais, [
    `import { executer } from ${JSON.stringify(outil)}`,
    `process.exitCode = await executer({ cwd: ${JSON.stringify(racine)}, argv: ${JSON.stringify(['--quiet', ...argv])}, generateurs: ${JSON.stringify(generateurs)}, verificateurs: ${JSON.stringify(verificateurs)} })`,
  ].join('\n'))
  const r = spawnSync(process.execPath, [harnais], { cwd: racine, encoding: 'utf8', env: { ...process.env, ...env } })
  return { status: r.status, sortie: `${r.stdout}${r.stderr}` }
}

/** Dépôt jetable RÉGÉNÉRÉ par `executer` lui-même (docs, `.sources-lues.json`), puis stagé. */
function depotReel({ docsIgnores = false } = {}) {
  const { racine } = instanceDeDepot({
    commit: false,
    fichiers: {
      '.gitignore': 'node_modules/\n' + (docsIgnores ? 'docs/\n' : ''),
      'src/a.ts': 'export const a = 1\n',
      'src/b.ts': 'export const b = 1\n',
      'src/commun.ts': 'export const commun = 1\n',
      'g/a.mjs': generateurReel('a'),
      'g/b.mjs': generateurReel('b', { cliquet: true }),
    },
  })
  mkdirSync(path.join(racine, 'docs'), { recursive: true })
  const git = gitDe(racine)
  const build = executer(racine, [])
  assert.equal(build.status, 0, `docs:build du banc : ${build.sortie}`)
  git('add', '-A')
  return { racine, git }
}

test('`--check` rejoue chaque générateur : un corps divergent posé sur le disque est NOMMÉ, sortie 1, rien d’écrit', () => {
  const { racine } = depotReel()
  try {
    const cible = path.join(racine, DOC_A)
    const rendu = readFileSync(cible, 'utf8')
    const divergent = rendu.replaceAll('src/a.ts', 'src\\a.ts')
    assert.notEqual(divergent, rendu, 'la fixture n’a substitué aucun séparateur')
    writeFileSync(cible, divergent)
    const rouge = executer(racine, ['--check'])
    assert.equal(rouge.status, 1, rouge.sortie)
    assert.match(rouge.sortie, /docs:check — ROUGE \(1\) :\n {2}docs:check — g\/a\.mjs — sortie 1\n/)
    assert.match(rouge.sortie, /disque : "Source : `src\\\\a\.ts`/, 'la divergence nomme la graphie du disque')
    assert.equal(readFileSync(cible, 'utf8'), divergent, '`--check` n’écrit jamais')
  } finally {
    rmSync(racine, { recursive: true, force: true })
  }
})

test('attestation : source app hors mesure reste fraîche ; outil transitif et hook URL invalident', () => {
  const { racine } = depotReel({ docsIgnores: true })
  try {
    const { copie, outil } = copierOutillage(racine)
    const jouer = (argv) => executer(racine, argv, {}, [], GENERATEURS_REELS, outil)
    const initial = jouer([])
    assert.equal(initial.status, 0, initial.sortie)
    writeFileSync(path.join(racine, 'src/inconnu.ts'), 'export const inconnu = 1\n')
    const frais = jouer(['--perimes'])
    assert.equal(frais.status, 0, frais.sortie)
    assert.doesNotMatch(frais.sortie, /g\/a\.mjs — début|g\/b\.mjs — début/)
    for (const rel of ['scripts/docs/lib/enregistreur-hooks.mjs', 'scripts/guards/lib/ecritureJsonAtomique.mjs']) {
      const cible = path.join(copie, rel)
      writeFileSync(cible, readFileSync(cible, 'utf8') + '\n')
      const perime = jouer(['--perimes'])
      assert.equal(perime.status, 0, perime.sortie)
      assert.match(perime.sortie, /g\/a\.mjs — début/)
      assert.match(perime.sortie, /g\/b\.mjs — début/)
    }
  } finally { rmSync(racine, { recursive: true, force: true }) }
})

test('`--check` va AU BOUT : un corps divergent ET un cliquet rouge dans le même run, nommés chacun', () => {
  const { racine, git } = depotReel()
  try {
    const cible = path.join(racine, DOC_A)
    writeFileSync(cible, readFileSync(cible, 'utf8').replace('# a\n', '# a édité à la main\n'))
    git('add', DOC_A)
    const rouge = executer(racine, ['--check'], { BANC_SORTIE: '1' })
    assert.equal(rouge.status, 1, rouge.sortie)
    // `g/a.mjs` est rouge le PREMIER : `g/b.mjs`, qui le suit, doit rendre son verdict quand même.
    assert.match(rouge.sortie, /docs:check — ROUGE \(2\) :\n {2}docs:check — g\/a\.mjs — sortie 1\n {2}docs:check — g\/b\.mjs — sortie 1\n/)
    assert.match(rouge.sortie, /CLIQUET ROUGE/)

    // Tout re-rendu : vert.
    assert.equal(executer(racine, []).status, 0)
    git('add', '-A')
    const vert = executer(racine, ['--check'])
    assert.equal(vert.status, 0, vert.sortie)
    assert.match(vert.sortie, /docs:check — OK/)
  } finally {
    rmSync(racine, { recursive: true, force: true })
  }
})

test('`executer` purge son cache de lectures à chaque sortie, verte, rouge ou en ARRÊT', () => {
  const { racine, git } = depotReel()
  const cache = path.join(racine, 'node_modules', '.cache', 'lectures-docs')
  const restes = () => listerDossier(cache, { absent: 'vide' })
  try {
    assert.deepEqual(restes(), [], 'après `docs:build` vert')
    const cible = path.join(racine, DOC_A)
    writeFileSync(cible, readFileSync(cible, 'utf8').replace('# a\n', '# a édité à la main\n'))
    git('add', DOC_A)
    assert.equal(executer(racine, ['--check']).status, 1)
    assert.deepEqual(restes(), [], 'après `--check` rouge')
    assert.equal(executer(racine, [], { BANC_SORTIE: '1' }).status, 1)
    assert.deepEqual(restes(), [], 'après un ARRÊT de `docs:build`')
  } finally {
    rmSync(racine, { recursive: true, force: true })
  }
})

test('`--check` : un VÉRIFICATEUR rouge est nommé, et sort à 1 (aucune régénération ne le guérit)', () => {
  const { racine } = depotReel()
  try {
    mkdirSync(path.join(racine, 'v'))
    writeFileSync(path.join(racine, 'v', 'rouge.mjs'), "console.error('VÉRIFICATEUR ROUGE'); process.exitCode = 1\n")
    const rouge = executer(racine, ['--check'], {}, ['v/rouge.mjs'])
    assert.equal(rouge.status, 1, rouge.sortie)
    assert.match(rouge.sortie, /VÉRIFICATEUR ROUGE/)
    assert.match(rouge.sortie, /docs:check — ROUGE \(1\) :\n {2}docs:check — v\/rouge\.mjs — sortie 1\n/)
  } finally {
    rmSync(racine, { recursive: true, force: true })
  }
})

test('une cible LITTÉRALE déclarée que le rendu ne produit pas est REFUSÉE, nommément, en écriture comme en `--check`', () => {
  const { racine } = depotReel()
  const fantome = doc('fantome')
  const generateurs = [{ ...GENERATEURS_REELS[0], targets: [DOC_A, fantome] }, GENERATEURS_REELS[1]]
  const refus = `ARRÊT sur g/a.mjs : cible(s) LITTÉRALE(S) déclarée(s) que son rendu ne produit pas : ${fantome}.`
  try {
    const build = executer(racine, [], {}, [], generateurs)
    assert.equal(build.status, 1, build.sortie)
    assert.ok(build.sortie.includes(refus), build.sortie)
    const check = executer(racine, ['--check'], {}, [], generateurs)
    assert.equal(check.status, 1, check.sortie)
    assert.ok(check.sortie.includes(refus), check.sortie)
  } finally {
    rmSync(racine, { recursive: true, force: true })
  }
})

// ── `--mixtes` (#2193) : l'étape `docs` du train ne régénère que ce qu'elle commet ─────────────────

test('perimetreDesMixtes se DÉRIVE de la table : un générateur qui gagne un `injecte` y entre, sans liste de noms', () => {
  const code = { runner: 'node', script: 'g/code.mjs', targets: ['src/x.gen.ts'] }
  const pur = { runner: 'node', script: 'g/pur.mjs', targets: [DOC_A] }
  const mixte = { runner: 'node', script: 'g/mixte.mjs', targets: [], injecte: [DOC_B] }
  assert.deepEqual(perimetreDesMixtes([pur, mixte, code]), [mixte, code], 'l’ordre est celui de la table')
  const devenuMixte = { ...pur, injecte: [doc('c')] }
  assert.deepEqual(perimetreDesMixtes([code, devenuMixte, mixte]), [code, devenuMixte, mixte])
})

test('`--mixtes` réécrit sa mesure et conserve celle des générateurs hors périmètre', () => {
  const { racine } = depotReel()
  try {
    const sourcesLues = path.join(racine, 'docs', '.sources-lues.json')
    const mesureAvant = JSON.parse(readFileSync(sourcesLues, 'utf8'))
    const docB = readFileSync(path.join(racine, DOC_B), 'utf8')
    writeFileSync(path.join(racine, 'src/a.ts'), 'export const a = 22222\n')
    writeFileSync(path.join(racine, 'src/b.ts'), 'export const b = 22222\n')
    const generateurs = [{ ...GENERATEURS_REELS[0], targets: [], injecte: [DOC_A] }, GENERATEURS_REELS[1]]
    const vu = executer(racine, ['--mixtes'], {}, [], generateurs)
    assert.equal(vu.status, 0, vu.sortie)
    assert.match(readFileSync(path.join(racine, DOC_A), 'utf8'), /\(47 octets\)/, 'le mixte est régénéré')
    assert.equal(readFileSync(path.join(racine, DOC_B), 'utf8'), docB, 'un générateur hors périmètre ne joue pas')
    const mesureApres = JSON.parse(readFileSync(sourcesLues, 'utf8'))
    assert.deepEqual(mesureApres['g/b.mjs'], mesureAvant['g/b.mjs'])
    assert.deepEqual(mesureApres['g/a.mjs'].cibles, [])
  } finally {
    rmSync(racine, { recursive: true, force: true })
  }
})

test('`--only` écrit sa sélection, conserve les autres mesures, purge les anciens et garde les vérificateurs', () => {
  const { racine } = depotReel()
  try {
    const fichier = path.join(racine, 'docs', '.sources-lues.json')
    const ancienne = JSON.parse(readFileSync(fichier, 'utf8'))
    ancienne['g/supprime.mjs'] = ancienne['g/b.mjs']
    writeFileSync(fichier, JSON.stringify(ancienne))
    const b = readFileSync(path.join(racine, DOC_B), 'utf8')
    writeFileSync(path.join(racine, 'src/a.ts'), 'export const a = 222222\n')
    writeFileSync(path.join(racine, 'src/b.ts'), 'export const b = 222222\n')
    mkdirSync(path.join(racine, 'v'))
    writeFileSync(path.join(racine, 'v', 'rouge.mjs'), "console.error('VÉRIFICATEUR CONSERVÉ'); process.exitCode = 1\n")
    const vu = executer(racine, ['--only', 'g/a.mjs'], {}, ['v/rouge.mjs'])
    assert.equal(vu.status, 1, vu.sortie)
    assert.match(vu.sortie, /VÉRIFICATEUR CONSERVÉ/)
    assert.match(readFileSync(path.join(racine, DOC_A), 'utf8'), /48 octets/)
    assert.equal(readFileSync(path.join(racine, DOC_B), 'utf8'), b)
    const apres = JSON.parse(readFileSync(fichier, 'utf8'))
    assert.deepEqual(apres['g/b.mjs'], ancienne['g/b.mjs'])
    assert.equal(Object.hasOwn(apres, 'g/supprime.mjs'), false)
  } finally {
    rmSync(racine, { recursive: true, force: true })
  }
})

for (const vide of [false, true]) test(`--only refuse ${vide ? 'une sélection vide' : 'un nom inconnu'} avant toute écriture ou préparation de cache`, () => {
  const { racine } = depotReel()
  const cache = path.join(racine, 'node_modules/.cache/lectures-docs')
  const sources = path.join(racine, 'docs/.sources-lues.json')
  try {
    const avant = [DOC_A, DOC_B].map((f) => readFileSync(path.join(racine, f), 'utf8'))
    const mesure = readFileSync(sources, 'utf8')
    writeFileSync(path.join(racine, 'src/a.ts'), 'export const a = 999999\n')
    rmSync(cache, { recursive: true, force: true })
    const selection = vide ? ['--only'] : ['--only', 'g/a.mjs', 'g/typo.mjs']
    for (const mode of [[], ['--check'], ['--code'], ['--mixtes']]) {
      const vu = executer(racine, [...mode, ...selection])
      assert.equal(vu.status, 1, vu.sortie)
      assert.match(vu.sortie, vide ? /--only sélection vide/ : /--only nom\(s\) inconnu\(s\) : g\/typo\.mjs/)
      assert.deepEqual([DOC_A, DOC_B].map((f) => readFileSync(path.join(racine, f), 'utf8')), avant)
      assert.equal(readFileSync(sources, 'utf8'), mesure)
      assert.deepEqual(listerDossier(cache, { absent: 'vide' }), [])
      assert.throws(() => statSync(cache), { code: 'ENOENT' })
    }
  } finally {
    rmSync(racine, { recursive: true, force: true })
  }
})

test('--only reconnaît les vérificateurs canoniques et conserve tous leurs verdicts', () => {
  const { racine } = depotReel()
  try {
    mkdirSync(path.join(racine, 'v'))
    writeFileSync(path.join(racine, 'v/a.mjs'), "Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 15); console.error('VERIFICATEUR_A'); process.exitCode = 1")
    writeFileSync(path.join(racine, 'v/b.mjs'), "console.error('VERIFICATEUR_B'); process.exitCode = 1")
    const vu = executer(racine, ['--only', 'v/a.mjs'], {}, ['v/a.mjs', 'v/b.mjs'])
    assert.equal(vu.status, 1, vu.sortie)
    assert.match(vu.sortie, /VERIFICATEUR_A/)
    assert.match(vu.sortie, /VERIFICATEUR_B/)
    for (const nom of ['a', 'b']) {
      const debut = `[docs:build] v/${nom}.mjs — début`
      assert.ok(vu.sortie.includes(debut), vu.sortie)
      assert.ok(vu.sortie.indexOf(debut) < vu.sortie.indexOf(`VERIFICATEUR_${nom.toUpperCase()}`), vu.sortie)
      assert.match(vu.sortie, new RegExp(`v/${nom}\\.mjs — fin \\(\\d+ ms\\)`))
    }
  } finally {
    rmSync(racine, { recursive: true, force: true })
  }
})

test('`--verifier-code` mesure le code identique sans écrire ; code absent ou périmé arrête les docs', () => {
  const { racine } = depotReel()
  const code = 'src/a.gen.ts'
  const generateurs = [{ ...GENERATEURS_REELS[0], targets: [code] }, GENERATEURS_REELS[1]]
  writeFileSync(path.join(racine, 'g/a.mjs'), generateurReel('a').replaceAll(DOC_A, code))
  try {
    assert.equal(executer(racine, [], {}, [], generateurs).status, 0)
    const codeEnPlace = readFileSync(path.join(racine, code), 'utf8')
    const modification = statSync(path.join(racine, code)).mtimeMs
    const mesureAvant = JSON.parse(readFileSync(path.join(racine, 'docs/.sources-lues.json'), 'utf8'))
    const vert = executer(racine, ['--verifier-code'], {}, [], generateurs)
    assert.equal(vert.status, 0, vert.sortie)
    assert.equal(statSync(path.join(racine, code)).mtimeMs, modification)
    assert.deepEqual(JSON.parse(readFileSync(path.join(racine, 'docs/.sources-lues.json'), 'utf8')), mesureAvant)
    const b = readFileSync(path.join(racine, DOC_B), 'utf8')
    for (const absent of [false, true]) {
      if (absent) rmSync(path.join(racine, code))
      else writeFileSync(path.join(racine, code), 'périmé')
      writeFileSync(path.join(racine, 'src/b.ts'), 'export const b = 999999\n')
      const rouge = executer(racine, ['--verifier-code'], {}, [], generateurs)
      assert.equal(rouge.status, 1, rouge.sortie)
      assert.equal(readFileSync(path.join(racine, DOC_B), 'utf8'), b)
      assert.deepEqual(JSON.parse(readFileSync(path.join(racine, 'docs/.sources-lues.json'), 'utf8')), mesureAvant)
    }
    writeFileSync(path.join(racine, code), codeEnPlace)
    assert.equal(executer(racine, ['--verifier-code', '--only', 'g/a.mjs'], {}, [], generateurs).status, 0)
  } finally {
    rmSync(racine, { recursive: true, force: true })
  }
})

test('premier baseline : CODE généré lu, requête Git et sonde stat sont réellement certifiés', () => {
  const code = ['src', 'banc.generated.mjs'].join('/')
  const generateurs = [{ runner: 'node', script: 'g/code.mjs', targets: [code] }, ...GENERATEURS_REELS]
  const a = generateurReel('a') + '\n' + [
    `import { lancerGit } from ${JSON.stringify(pathToFileURL(path.join(ICI, '../test/gitDeBanc.mjs')).href)}`,
    "import { statSync } from 'node:fs'",
    `import { depotDe, listerImage, INDEX } from ${JSON.stringify(pathToFileURL(path.join(ICI, '../guards/lib/gitPorte.mjs')).href)}`,
    "listerImage(depotDe(process.cwd()), INDEX)",
    `import { valeur } from '../${code}'`,
    "const noms = lancerGit(['ls-files', '--cached', '--', 'src/*.ts'], { env: process.env })",
    "statSync('src/absent.txt', { throwIfNoEntry: false })",
    "if (valeur !== 1 || !noms.includes('src/a.ts')) throw new Error('fixture')",
  ].join('\n')
  const { racine } = instanceDeDepot({ fichiers: {
    '.gitignore': `node_modules/\ndocs/\n${code}\n`,
    'src/a.ts': 'a', 'src/b.ts': 'b', 'src/commun.ts': 'commun',
    'g/a.mjs': a, 'g/b.mjs': generateurReel('b'),
    'g/code.mjs': [
      "import { readFileSync } from 'node:fs'",
      `import { ecrireOuVerifier } from ${JSON.stringify(PRIMITIVE)}`,
      "readFileSync('src/a.ts'); readFileSync('src/commun.ts')",
      `ecrireOuVerifier({ out: 'export const valeur = 1\\n', path: ${JSON.stringify(code)}, check: process.argv.includes('--check') })`,
    ].join('\n'),
  } })
  try {
    mkdirSync(path.join(racine, 'docs'))
    const build = executer(racine, [], {}, [], generateurs)
    assert.equal(build.status, 0, build.sortie)
    const cache = chargerPreuve(racine)
    assert.deepEqual(Object.keys(cache.generateurs).sort(), generateurs.map((g) => g.script).sort(), build.sortie)
    const mesure = cache.generateurs['g/a.mjs'].mesure
    assert.ok(mesure.fichiers.includes(code))
    assert.ok(mesure.git.some((q) => q.args[0] === 'ls-files'))
    assert.ok(mesure.sondes.some((q) => q.chemin === 'src/absent.txt' && q.existe === false && !q.code))
    assert.equal(preuveValide(racine, { generateurs, ciblesPures, ciblesSurDisque, sourcesLues: SOURCES_LUES }).ok, true)
  } finally { rmSync(racine, { recursive: true, force: true }) }
})

test('fraîcheur : ledger par générateur, partial conserve les autres ; check ne touche aucun certificat', () => {
  const { racine, git } = depotReel({ docsIgnores: true })
  try {
    git('commit', '-q', '-m', 'sources')
    const complet = executer(racine, [])
    assert.equal(complet.status, 0, complet.sortie)
    const initial = chargerPreuve(racine)
    assert.ok(initial?.generateurs['g/a.mjs'], complet.sortie)
    assert.ok(initial?.generateurs['g/b.mjs'], complet.sortie)
    const cache = path.join(racine, CACHE_FRAICHEUR)
    const bytes = readFileSync(cache)
    assert.equal(executer(racine, ['--check']).status, 0)
    assert.deepEqual(readFileSync(cache), bytes)
    writeFileSync(path.join(racine, 'src/a.ts'), 'export const a = 999999\n')
    const partiel = executer(racine, ['--only', 'g/a.mjs'])
    assert.equal(partiel.status, 0, partiel.sortie)
    const apres = chargerPreuve(racine)
    assert.notDeepEqual(apres.generateurs['g/a.mjs'], initial.generateurs['g/a.mjs'])
    assert.deepEqual(apres.generateurs['g/b.mjs'], initial.generateurs['g/b.mjs'])
    for (const argv of [['--code'], ['--mixtes']]) {
      assert.equal(executer(racine, argv).status, 0)
      assert.deepEqual(chargerPreuve(racine), apres)
    }
    assert.equal(executer(racine, ['--only', 'g/b.mjs'], { BANC_SORTIE: '1' }).status, 1)
    const rouge = chargerPreuve(racine)
    assert.ok(rouge.generateurs['g/a.mjs'])
    assert.equal(rouge.generateurs['g/b.mjs'], undefined)
    const bytesRouges = readFileSync(cache)
    assert.equal(executer(racine, ['--check']).status, 0)
    assert.deepEqual(readFileSync(cache), bytesRouges)
  } finally { rmSync(racine, { recursive: true, force: true }) }
})
