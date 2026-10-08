// Banc du périmètre de tests (#2400) : un dépôt git FORGÉ par classe de lien, sous mkdtempSync.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { gitDe } from './gitDeBanc.mjs'
import { apprendre, dossierDesMesures, ecrireLesMesures, estimationsDe, exportsTouches, facteursCi, lintDesTouches, lireArguments, memosDe, mesuresDe, paliersDe, perimetreDuDepot, planDExecution, planDuPerimetre, rapportDuLancement, signalDe, surcoutObserve, texteDeLEstimation, texteDuMur, versionDesMemos } from './perimetre.mjs'
import { memoCiDe } from './dureesCi.mjs'
import DureesVitest from './dureesVitest.mjs'
import { tableTotale } from '../../src/lib/tableTotale.ts'

const TEMOIN = { 'scripts/temoin.test.mjs': "import './seul.mjs'\n", 'scripts/seul.mjs': 'export const seul = 1\n' }

/** Un dépôt jetable : `base` commité, puis `apres` (texte, `null` = supprimé, `{ de }` = renommé) commité
 *  si `commiter`, laissé dans l'arbre de travail sinon. */
function forger(t, base, apres, { commiter = true } = {}) {
  const racine = mkdtempSync(join(tmpdir(), 'perimetre-'))
  t.after(() => rmSync(racine, { recursive: true, force: true }))
  const git = gitDe(racine)
  git('init', '-q', '-b', 'main')
  git('config', 'user.email', 'perimetre@example.test')
  git('config', 'user.name', 'Perimetre fixture')
  const ecrire = (rel, texte) => {
    mkdirSync(dirname(join(racine, rel)), { recursive: true })
    writeFileSync(join(racine, rel), texte)
  }
  for (const [rel, texte] of Object.entries({ ...TEMOIN, ...base })) ecrire(rel, texte)
  git('add', '-A')
  git('commit', '-q', '-m', 'base')
  for (const [rel, texte] of Object.entries(apres)) {
    if (texte === null) git('rm', '-q', '--', rel)
    else if (typeof texte === 'object') {
      mkdirSync(dirname(join(racine, rel)), { recursive: true })
      git('mv', '--', texte.de, rel)
    } else ecrire(rel, texte)
  }
  if (commiter) {
    git('add', '-A')
    git('commit', '-q', '-m', 'apres')
  }
  return racine
}

const deriver = (racine, bornes = { base: 'HEAD~1', tete: 'HEAD' }) =>
  perimetreDuDepot(racine, bornes, { dossierDesMemos: join(racine, '.git', 'perimetre') })

const lienDe = (perimetre, test) => {
  const lien = perimetre.retenus.get(test)
  assert.ok(lien, `${test} non retenu ; retenus : ${[...perimetre.retenus.keys()].join(', ')}`)
  assert.equal(perimetre.retenus.has('scripts/temoin.test.mjs'), false, 'le témoin sans lien est retenu')
  return lien
}

test('import direct : le test qui importe le fichier touché est retenu, distance 1', (t) => {
  const racine = forger(t, { 'scripts/a.test.mjs': "import './lib.mjs'\n", 'scripts/lib.mjs': 'export const a = 1\n' },
    { 'scripts/lib.mjs': 'export const a = 2\n' })
  const lien = lienDe(deriver(racine), 'scripts/a.test.mjs')
  assert.deepEqual([lien.nature, lien.distance, lien.chaine], ['import', 1, ['scripts/a.test.mjs', 'scripts/lib.mjs']])
})

test('import transitif : la chaîne la plus courte et sa distance', (t) => {
  const racine = forger(t, {
    'scripts/b.test.mjs': "import './mid.mjs'\n",
    'scripts/mid.mjs': "export { f } from './feuille.mjs'\n",
    'scripts/feuille.mjs': 'export const f = 1\n',
  }, { 'scripts/feuille.mjs': 'export const f = 2\n' })
  const lien = lienDe(deriver(racine), 'scripts/b.test.mjs')
  assert.deepEqual([lien.nature, lien.distance, lien.chaine], ['import', 2, ['scripts/b.test.mjs', 'scripts/mid.mjs', 'scripts/feuille.mjs']])
})

test('importeur pendu vers un fichier SUPPRIMÉ : la résolution contre la base garde l’arc', (t) => {
  const racine = forger(t, {
    'scripts/c.test.mjs': "import './importeur.mjs'\n",
    'scripts/importeur.mjs': "import './parti.mjs'\n",
    'scripts/parti.mjs': 'export const p = 1\n',
  }, { 'scripts/parti.mjs': null })
  const lien = lienDe(deriver(racine), 'scripts/c.test.mjs')
  assert.deepEqual([lien.nature, lien.distance, lien.touche], ['import', 2, 'scripts/parti.mjs'])
})

test('fichier AJOUTÉ, non suivi, sous une racine balayée littérale', (t) => {
  const racine = forger(t, { 'scripts/d.test.mjs': "import { readdirSync } from 'node:fs'\nreaddirSync('donnees')\n", 'donnees/un.json': '{}' },
    { 'donnees/deux.json': '{}' }, { commiter: false })
  const lien = lienDe(deriver(racine, { base: 'HEAD' }), 'scripts/d.test.mjs')
  assert.deepEqual([lien.nature, lien.racine, lien.site, lien.touche], ['racine balayée', 'donnees', 'scripts/d.test.mjs:2 readdirSync', 'donnees/deux.json'])
})

test('racine portée par une constante IMPORTÉE', (t) => {
  const racine = forger(t, {
    'scripts/e.test.mjs': "import { RACINES_SCAN } from './scan.mjs'\nimport { readdirSync } from 'node:fs'\nreaddirSync(RACINES_SCAN)\n",
    'scripts/scan.mjs': "export const RACINES_SCAN = ['corpus']\n",
    'corpus/x.ts': 'export const x = 1\n',
  }, { 'corpus/x.ts': 'export const x = 2\n' })
  const lien = lienDe(deriver(racine), 'scripts/e.test.mjs')
  assert.deepEqual([lien.nature, lien.racine, lien.site], ['racine balayée', 'corpus', 'scripts/e.test.mjs:3 readdirSync'])
})

test('import.meta.glob à motif littéral : arc vers chaque fichier visé', (t) => {
  const racine = forger(t, {
    'src/f.test.ts': "const jeux = import.meta.glob('./jeux/*.json', { eager: true })\nexport default jeux\n",
    'src/jeux/a.json': '{}',
  }, { 'src/jeux/a.json': '{"a":1}' })
  const lien = lienDe(deriver(racine), 'src/f.test.ts')
  assert.deepEqual([lien.nature, lien.distance, lien.chaine], ['import', 1, ['src/f.test.ts', 'src/jeux/a.json']])
})

test('setupFiles : chaque test Vitest est retenu au rang `setup`, sans distance propagée par eux', (t) => {
  const racine = forger(t, {
    'vite.config.ts': "import { fileURLToPath } from 'node:url'\nexport default { test: { setupFiles: [fileURLToPath(new URL('./src/setup.ts', import.meta.url))] } }\n",
    'src/setup.ts': "import './store'\n",
    'src/store.ts': 'export const s = 1\n',
    'src/g.test.ts': 'export const g = 1\n',
    'src/h.test.ts': "import './store'\n",
  }, { 'src/store.ts': 'export const s = 2\n' })
  const perimetre = deriver(racine)
  const g = lienDe(perimetre, 'src/g.test.ts')
  assert.deepEqual([g.nature, g.touche], ['setup', 'src/store.ts'])
  const h = lienDe(perimetre, 'src/h.test.ts')
  assert.deepEqual([h.nature, h.distance, h.chaine], ['import', 1, ['src/h.test.ts', 'src/store.ts']])
  const estimations = new Map([['src/h.test.ts', { ms: 1000 }], ['src/g.test.ts', { ms: 1000 }]])
  assert.deepEqual(planDExecution(perimetre.retenus, { budget: 1, estimations }).aLaCI, ['src/g.test.ts'])
  assert.deepEqual(paliersDe(perimetre.retenus), { 'touché': 0, 'racine balayée': 0, 'import d=1': 1, 'import d=2': 0, 'import d=3': 0, 'import d≥4': 0, 'setup seul': 1, 'toolchain seule': 0 })
})

test('racine balayée dont le site n’est atteint que par les setupFiles : rang `setup`', (t) => {
  const racine = forger(t, {
    'vite.config.ts': "export default { test: { setupFiles: ['src/setup.ts'] } }\n",
    'src/setup.ts': "import { readdirSync } from 'node:fs'\nreaddirSync('donnees')\n",
    'donnees/x.json': '{}',
    'src/g.test.ts': 'export const g = 1\n',
  }, { 'donnees/x.json': '{"x":1}' })
  const g = lienDe(deriver(racine), 'src/g.test.ts')
  assert.deepEqual([g.nature, g.racine, g.site, g.touche], ['setup', 'donnees', 'src/setup.ts:2 readdirSync', 'donnees/x.json'])
})

test('relais de la clôture des setupFiles appelé par un test : la racine s’attribue au site où elle devient concrète, rang racine balayée', (t) => {
  const racine = forger(t, {
    'vite.config.ts': "export default { test: { setupFiles: ['src/setup.ts'] } }\n",
    'src/setup.ts': "import '../scripts/lib/corpus.mjs'\n",
    'scripts/lib/corpus.mjs': "import { readdirSync } from 'node:fs'\nimport { join } from 'node:path'\n" +
      "export function lireCorpus(dirs) {\n  const bases = dirs.map((d) => join('.', d))\n  return bases.flatMap((b) => readdirSync(b))\n}\n",
    'src/n.test.ts': "import { lireCorpus } from '../scripts/lib/corpus.mjs'\nlireCorpus(['donnees'])\n",
    'src/g.test.ts': 'export const g = 1\n',
    'donnees/x.json': '{}',
  }, { 'donnees/x.json': '{"x":1}' })
  const perimetre = deriver(racine)
  const n = lienDe(perimetre, 'src/n.test.ts')
  assert.deepEqual([n.nature, n.rang, n.racine, n.site], ['racine balayée', 1, 'donnees', 'src/n.test.ts:2 lireCorpus'])
  assert.equal(perimetre.retenus.has('src/g.test.ts'), false)
})

test('mémo d’évaluation par module : un module CONSULTÉ qui change invalide l’évaluation de son appelant, mémos internes compris', (t) => {
  const depot = (corps) => forger(t, {
    'scripts/lib/r.mjs': "import { readdirSync } from 'node:fs'\nimport { base } from './q.mjs'\nexport function lister(d) { return readdirSync(base(d)) }\n",
    'scripts/lib/q.mjs': `import { join } from 'node:path'\nexport const base = (d) => ${corps}\n`,
    'scripts/a.test.mjs': "import { lister } from './lib/r.mjs'\nlister('donnees')\n",
    'scripts/b.test.mjs': "import { lister } from './lib/r.mjs'\nlister('donnees')\n",
    'autre/donnees/x.json': '{}',
  }, { 'autre/donnees/x.json': '{"x":1}' })
  const memos = mkdtempSync(join(tmpdir(), 'perimetre-memos-'))
  t.after(() => rmSync(memos, { recursive: true, force: true }))
  const avecMemos = (racine) => perimetreDuDepot(racine, { base: 'HEAD~1', tete: 'HEAD' }, { dossierDesMemos: memos })
  const premier = avecMemos(depot('d')).retenus
  assert.deepEqual(['scripts/a.test.mjs', 'scripts/b.test.mjs'].map((f) => premier.has(f)), [false, false])
  const { retenus } = avecMemos(depot("join('autre', d)"))
  assert.deepEqual(['scripts/a.test.mjs', 'scripts/b.test.mjs'].map((f) => [retenus.get(f)?.nature, retenus.get(f)?.racine]),
    [['racine balayée', 'autre/donnees'], ['racine balayée', 'autre/donnees']])
})

test('toolchain touchée (lectures des dépendances comprises) ⇒ suite entière', (t) => {
  const racine = forger(t, { 'tsconfig.json': '{}', 'server/package.json': '{}', 'src/h.test.ts': 'export const h = 1\n' },
    { 'tsconfig.json': '{ "compilerOptions": {} }', 'server/package.json': '{ "private": true }' })
  const perimetre = deriver(racine)
  assert.deepEqual(perimetre.toolchain, ['server/package.json', 'tsconfig.json'])
  assert.deepEqual([...perimetre.retenus.keys()].sort(), ['scripts/temoin.test.mjs', 'src/h.test.ts'])
  assert.equal(perimetre.retenus.get('src/h.test.ts').nature, 'toolchain')
})

test('renommage : le chemin QUITTÉ reste touché sous la racine qui le balayait', (t) => {
  const racine = forger(t, { 'scripts/i.test.mjs': "import { readdirSync } from 'node:fs'\nreaddirSync('anciens')\n", 'anciens/a.md': 'a\n', 'anciens/b.md': 'b\n' },
    { 'nouveaux/a.md': { de: 'anciens/a.md' } })
  const lien = lienDe(deriver(racine), 'scripts/i.test.mjs')
  assert.deepEqual([lien.nature, lien.racine, lien.touche], ['racine balayée', 'anciens', 'anciens/a.md'])
})

test('readFileSync d’un fichier EXACT : retenu quand ce fichier change, pas quand son voisin change', (t) => {
  const base = { 'scripts/j.test.mjs': "import { readFileSync } from 'node:fs'\nreadFileSync('donnees/lu.json', 'utf8')\n", 'donnees/lu.json': '{}', 'donnees/voisin.json': '{}' }
  const lien = lienDe(deriver(forger(t, base, { 'donnees/lu.json': '{"a":1}' })), 'scripts/j.test.mjs')
  assert.deepEqual([lien.nature, lien.racine, lien.touche], ['racine balayée', 'donnees/lu.json', 'donnees/lu.json'])
  assert.equal(deriver(forger(t, base, { 'donnees/voisin.json': '{"a":1}' })).retenus.has('scripts/j.test.mjs'), false)
})

test('existsSync d’un fichier qui APPARAÎT : la sonde d’absence est une lecture', (t) => {
  const racine = forger(t, { 'scripts/k.test.mjs': "import { existsSync } from 'node:fs'\nexistsSync('donnees/drapeau.json')\n" },
    { 'donnees/drapeau.json': '{}' })
  const lien = lienDe(deriver(racine), 'scripts/k.test.mjs')
  assert.deepEqual([lien.nature, lien.racine, lien.site], ['racine balayée', 'donnees/drapeau.json', 'scripts/k.test.mjs:2 existsSync'])
})

test('RELAIS inter-module : le site d’appel, ses arguments liés, déclare la racine', (t) => {
  const racine = forger(t, {
    'scripts/lib/lister.mjs': "import { readdirSync } from 'node:fs'\nexport function listerTests(racine = process.cwd()) {\n  return readdirSync(racine)\n}\n",
    'scripts/l.test.mjs': "import { listerTests } from './lib/lister.mjs'\nlisterTests('donnees')\n",
    'donnees/a.json': '{}',
  }, { 'donnees/a.json': '{"a":1}' })
  const lien = lienDe(deriver(racine), 'scripts/l.test.mjs')
  assert.deepEqual([lien.nature, lien.racine, lien.site, lien.specificite], ['racine balayée', 'donnees', 'scripts/l.test.mjs:2 listerTests', 1])
})

test('deux racines balayées couvrent le fichier touché : la plus SPÉCIFIQUE est retenue', (t) => {
  const racine = forger(t, {
    'scripts/s.test.mjs': "import { readdirSync } from 'node:fs'\nreaddirSync('.')\nreaddirSync('donnees')\n",
    'donnees/a.json': '{}',
  }, { 'donnees/a.json': '{"a":1}' })
  const lien = lienDe(deriver(racine), 'scripts/s.test.mjs')
  assert.deepEqual([lien.racine, lien.site, lien.specificite], ['donnees', 'scripts/s.test.mjs:3 readdirSync', 1])
})

/** Rangs : touché 0, racine balayée 1, import d=1 2, import d=2 3. */
const RETENUS = new Map([['t.test.mjs', { rang: 0 }], ['r.test.mjs', { rang: 1 }], ['b.test.mjs', { rang: 2 }], ['a.test.mjs', { rang: 2 }], ['z.test.mjs', { rang: 3 }]])

/** Estimations : 10 s chacun, sauf `b` (2 s). */
const ESTIMATIONS = new Map([...RETENUS.keys()].map((t) => [t, { ms: t === 'b.test.mjs' ? 2000 : 10_000 }]))

test('planDExecution : sous budget, tout est lancé ; seul le touché est hors budget', () => {
  const plan = planDExecution(RETENUS, { budget: 32, estimations: ESTIMATIONS })
  assert.deepEqual([plan.lances, plan.aLaCI, plan.murMs, plan.murBudgeteMs], [['t.test.mjs', 'r.test.mjs', 'b.test.mjs', 'a.test.mjs', 'z.test.mjs'], [], 42_000, 32_000])
  assert.deepEqual(planDExecution(RETENUS, { budget: 31, estimations: ESTIMATIONS }).aLaCI, ['z.test.mjs'], 'la racine balayée compte au budget')
})

test('planDExecution : la coupe passe À L’INTÉRIEUR d’un rang, le moins cher d’abord ; ce qui ne tient plus part à la CI', () => {
  const plan = planDExecution(RETENUS, { budget: 12, estimations: ESTIMATIONS })
  assert.deepEqual([plan.lances, plan.aLaCI], [['t.test.mjs', 'r.test.mjs', 'b.test.mjs'], ['a.test.mjs', 'z.test.mjs']])
  assert.deepEqual(plan.rangs.map((r) => [r.rang, r.murMs, r.lances, r.aLaCI]),
    [['touché', 10_000, 1, 0], ['racine balayée', 10_000, 1, 0], ['import d=1', 2000, 1, 1], ['import d=2', 0, 0, 1]])
})

test('planDExecution : budget 0 = touché seul, hors budget ; la racine balayée part à la CI', () => {
  assert.deepEqual(planDExecution(RETENUS, { budget: 0, estimations: ESTIMATIONS }).lances, ['t.test.mjs'])
  assert.deepEqual(planDExecution(RETENUS, { budget: 0 }).lances, ['t.test.mjs'])
  assert.deepEqual(planDExecution(RETENUS, { budget: 5, estimations: ESTIMATIONS }).aLaCI, ['r.test.mjs', 'a.test.mjs', 'z.test.mjs'])
})

test('planDExecution : le SAC se remplit — A tient, B déborde et part à la CI, C tient dans le reste et est lancé (#2474)', () => {
  const retenus = new Map([['a.test.mjs', { rang: 1, specificite: 1 }], ['b.test.mjs', { rang: 1, specificite: 2 }], ['c.test.mjs', { rang: 1, specificite: 3 }]])
  const estimations = new Map([['a.test.mjs', { ms: 4000 }], ['b.test.mjs', { ms: 9000 }], ['c.test.mjs', { ms: 2000 }]])
  const plan = planDExecution(retenus, { budget: 10, estimations, workers: { node: 1 } })
  assert.deepEqual([plan.lances, plan.aLaCI], [['a.test.mjs', 'c.test.mjs'], ['b.test.mjs']])
})

test('planDExecution : dans un rang, le SIGNAL passe avant le prix', () => {
  const signaux = new Map([['a.test.mjs', { signal: 'symbole' }], ['b.test.mjs', { signal: 'module' }]])
  const plan = planDExecution(RETENUS, { budget: 20, estimations: ESTIMATIONS, signaux })
  assert.deepEqual([plan.lances, plan.aLaCI], [['t.test.mjs', 'r.test.mjs', 'a.test.mjs'], ['b.test.mjs', 'z.test.mjs']])
})

test('planDExecution : la racine balayée s’ordonne par SPÉCIFICITÉ (fichier exact, `src/ui`, `src`, `.`), puis par coût', () => {
  const retenus = new Map([['racine.test.ts', { rang: 1, specificite: 9000 }], ['src.test.ts', { rang: 1, specificite: 800 }],
    ['exact.test.ts', { rang: 1, specificite: 1 }], ['ui.test.ts', { rang: 1, specificite: 60 }], ['ui-bis.test.ts', { rang: 1, specificite: 60 }]])
  const estimations = new Map([['racine.test.ts', { ms: 1000 }], ['src.test.ts', { ms: 1000 }], ['exact.test.ts', { ms: 5000 }], ['ui.test.ts', { ms: 3000 }], ['ui-bis.test.ts', { ms: 1000 }]])
  const plan = planDExecution(retenus, { budget: 10, estimations })
  assert.deepEqual([plan.lances, plan.aLaCI], [['exact.test.ts', 'ui-bis.test.ts', 'ui.test.ts', 'src.test.ts'], ['racine.test.ts']])
})

test('planDExecution : le budget porte sur le MUR, la somme répartie sur les workers', () => {
  const retenus = new Map(['a', 'b', 'c', 'd'].map((n) => [`src/${n}.test.ts`, { rang: 2 }]))
  const estimations = new Map([...retenus.keys()].map((t) => [t, { ms: 4000 }]))
  assert.deepEqual(planDExecution(retenus, { budget: 5, estimations, workers: { vitest: 4 } }).aLaCI, [])
  assert.deepEqual(planDExecution(retenus, { budget: 5, estimations, workers: { vitest: 1 } }).lances, ['src/a.test.ts'])
  assert.deepEqual(planDExecution(retenus, { budget: 5, estimations, workers: { vitest: 4 }, surcouts: { vitest: 2000 } }).lances, [],
    'le surcoût de lancement compte au mur')
})

test('mur du plan : ordonnancement simulé sur les workers effectifs + surcoût, par famille lancée ; les familles s’additionnent', () => {
  const estimations = new Map([['src/a.test.ts', { ms: 4000 }], ['src/b.test.ts', { ms: 2000 }], ['scripts/n.test.mjs', { ms: 3000 }]])
  const workers = { vitest: 4, node: 8 }
  const plan = (tests, options) => planDExecution(new Map(tests.map((t) => [t, { rang: 0 }])), { estimations, ...options })
  assert.equal(plan(['src/a.test.ts', 'src/b.test.ts'], { workers }).murMs, 4000, 'le plus long fichier borne le mur')
  assert.equal(plan(['src/a.test.ts', 'src/b.test.ts'], { workers: { vitest: 1 } }).murMs, 6000)
  const deux = plan(['src/a.test.ts', 'src/b.test.ts', 'scripts/n.test.mjs'], { workers, surcouts: { vitest: 500, node: 700 } })
  assert.deepEqual([deux.murMs, deux.murParFamille], [4000 + 500 + 3000 + 700, { vitest: 4500, node: 3700 }])
  assert.deepEqual(plan(['scripts/n.test.mjs'], { workers, surcouts: { vitest: 500, node: 700 } }).murParFamille, { vitest: 0, node: 3700 }, 'une famille non lancée ne paie pas son surcoût')
  assert.equal(plan([], { workers, surcouts: { vitest: 500 } }).murMs, 0)
})

/** Le mur du plan de `durees` (`{ [test]: ms }`), tous au rang touché, sur `workers`. */
const murDuPlan = (durees, workers) => planDExecution(new Map(Object.keys(durees).map((t) => [t, { rang: 0 }])),
  { estimations: new Map(Object.entries(durees).map(([t, ms]) => [t, { ms }])), workers }).murMs

test('mur simulé (sonde 1 #2474) : node démarre ses fichiers dans l’ordre LEXICAL — a, b à 1 s puis c à 3 s sur 2 workers : 4 s ; Vitest par durée décroissante : 3 s', () => {
  assert.equal(murDuPlan({ 'scripts/c.test.mjs': 3000, 'scripts/b.test.mjs': 1000, 'scripts/a.test.mjs': 1000 }, { node: 2 }), 4000)
  assert.equal(murDuPlan({ 'src/a.test.ts': 1000, 'src/b.test.ts': 1000, 'src/c.test.ts': 3000 }, { vitest: 2 }), 3000)
})

/** 30 fichiers de 10 s, puis le plus long (100 s) en FIN de lexique, sur 15 workers (sonde 3 #2474, durées synthétiques). */
const LONG_EN_FIN = { ...Object.fromEntries(Array.from({ length: 30 }, (_, i) => [`scripts/a${String(i).padStart(2, '0')}.test.mjs`, 10_000])), 'scripts/z.test.mjs': 100_000 }

test('mur simulé (sonde 3 #2474) : le plus long en fin de lexique démarre après les précédents — Σ(précédents)/W + max, pas max', () => {
  assert.equal(murDuPlan(LONG_EN_FIN, { node: 15 }), 30 * 10_000 / 15 + 100_000)
})

test('surcoutObserve : mur réel − mur simulé sur les workers effectifs, plancher 0 ; le démarrage tardif du plus long n’est pas du surcoût', () => {
  assert.equal(surcoutObserve('node', 120_300, LONG_EN_FIN, { node: 15 }), 300)
  assert.equal(surcoutObserve('node', 52_500, { 'scripts/a.test.mjs': 50_000, 'scripts/b.test.mjs': 500, 'scripts/c.test.mjs': 500 }, { node: 15 }), 2500, 'le plus long fichier n’est pas du surcoût')
  assert.equal(surcoutObserve('node', 10_000, { 'scripts/a.test.mjs': 4000, 'scripts/b.test.mjs': 4000 }, { node: 4 }), 6000)
  assert.equal(surcoutObserve('vitest', 10_000, { 'src/a.test.ts': 4000, 'src/b.test.ts': 4000 }, { vitest: 1, node: 4 }), 2000)
  assert.equal(surcoutObserve('vitest', 1000, { 'src/a.test.ts': 4000, 'src/b.test.ts': 4000 }, { vitest: 1 }), 0)
})

/** Les durées d'une course CI (`memoCiDe`) et l'environnement Vitest de chaque test (`null` : illisible). */
const CI = { run: 37724465833, vitest: { 'src/n.test.ts': 1000, 'src/j.test.tsx': 1000, 'src/l.test.ts': 9999, 'src/illisible.test.ts': 100 }, node: { 'scripts/c.test.mjs': 2000, 'scripts/l.test.mjs': 1 } }
const environnementDuTest = (t) => ({ 'src/n.test.ts': 'node', 'src/j.test.tsx': 'jsdom', 'src/l.test.ts': 'node' })[t] ?? null

test('estimationsDe : la durée apprise ICI prime, puis la durée CI × le facteur de sa population, sinon INCONNUE', () => {
  const locales = { 'src/l.test.ts': 500, 'scripts/l.test.mjs': 700 }
  const facteurs = facteursCi({ locales, ci: CI, environnementDe: environnementDuTest })
  const tests = ['src/l.test.ts', 'scripts/l.test.mjs', 'src/n.test.ts', 'src/j.test.tsx', 'scripts/c.test.mjs', 'src/illisible.test.ts', 'scripts/z.test.mjs']
  const estimations = estimationsDe(tests, { locales, ci: CI, facteurs, environnementDe: environnementDuTest })
  assert.deepEqual([...estimations].map(([t, { ms, source, population }]) => [t, ms, source, population ?? null]), [
    ['src/l.test.ts', 500, 'locale', null],
    ['scripts/l.test.mjs', 700, 'locale', null],
    ['src/n.test.ts', 900, 'ci', 'vitest-node'],
    ['src/j.test.tsx', 3500, 'ci', 'vitest-jsdom'],
    ['scripts/c.test.mjs', 2000, 'ci', 'node'],
    ['src/illisible.test.ts', null, 'inconnue', null],
    ['scripts/z.test.mjs', null, 'inconnue', null],
  ])
  assert.deepEqual([estimations.get('src/n.test.ts').run, estimations.get('src/n.test.ts').ciMs], [37724465833, 1000])
  assert.deepEqual([...estimationsDe(tests, { locales })].map(([, { source }]) => source), ['locale', 'locale', 'inconnue', 'inconnue', 'inconnue', 'inconnue', 'inconnue'], 'sans CI : apprise ou inconnue')
})

test('facteursCi : Σlocal/ΣCI des paires dès 10 ; dessous, le repli de banc ; node sans repli : 1, non calibré', () => {
  const noms = (n, prefixe, ext) => Array.from({ length: n }, (_, i) => `${prefixe}${i}.test.${ext}`)
  const [vitestNode, jsdom, node] = [noms(10, 'src/n', 'ts'), noms(9, 'src/j', 'tsx'), noms(3, 'scripts/m', 'mjs')]
  const ci = { vitest: tableTotale([...vitestNode, ...jsdom], () => 100), node: tableTotale(node, () => 100) }
  const locales = Object.fromEntries([...vitestNode.map((t, i) => [t, i < 5 ? 100 : 300]), ...jsdom.map((t) => [t, 1000]), ...node.map((t) => [t, 50])])
  const environnementDe = (t) => t.endsWith('.tsx') ? 'jsdom' : 'node'
  assert.deepEqual(facteursCi({ locales, ci, environnementDe }), {
    'vitest-node': { valeur: 2, paires: 10, origine: 'paires' },
    'vitest-jsdom': { valeur: 3.5, paires: 9, origine: 'repli' },
    node: { valeur: 1, paires: 3, origine: 'non calibré' },
  })
  const node10 = noms(10, 'scripts/p', 'mjs')
  assert.deepEqual(facteursCi({ locales: tableTotale(node10, () => 50), ci: { node: tableTotale(node10, () => 100) }, environnementDe }).node,
    { valeur: 0.5, paires: 10, origine: 'paires' }, 'node se calibre dès 10 paires')
})

test('texte d’une estimation et d’un mur : apprise ici, CI calibrée ou non, inconnue ; un mur qui ignore des tests sans durée est un MINORANT', () => {
  assert.equal(texteDeLEstimation({ ms: 2500, source: 'locale' }), ' ~2.5 s (apprise ici)')
  assert.equal(texteDeLEstimation({ ms: 900, source: 'ci', run: 37724465833, population: 'vitest-node', facteur: { valeur: 0.9, paires: 3, origine: 'repli' } }),
    ' ~0.9 s (CI 37724465833 × 0.90 repli de banc, vitest-node)')
  assert.equal(texteDeLEstimation({ ms: 2100, source: 'ci', run: 1, population: 'vitest-jsdom', facteur: { valeur: 2.1, paires: 40, origine: 'paires' } }), ' ~2.1 s (CI 1 × 2.10, vitest-jsdom)')
  assert.equal(texteDeLEstimation({ ms: 2000, source: 'ci', run: 1, population: 'node', facteur: { valeur: 1, paires: 0, origine: 'non calibré' } }), ' ~2.0 s (CI 1, non calibrée, node)')
  assert.equal(texteDeLEstimation({ ms: null, source: 'inconnue' }), ' durée inconnue')
  assert.equal(texteDuMur(3000), '3.0 s')
  assert.equal(texteDuMur(1000, { sansDuree: 2 }), '≥ 1.0 s (minorant : 2 test(s) sans durée)')
})

test('mur : la part estimée depuis la CI se nomme — ABSORBÉE par le plus long quand il est appris ici (DoD 3 #2497)', () => {
  const retenus = new Map(['long', 'x1', 'x2'].map((n) => [`scripts/${n}.test.mjs`, { rang: 1 }]))
  const estimations = new Map([['scripts/long.test.mjs', { ms: 150_000, source: 'locale' }], ['scripts/x1.test.mjs', { ms: 1000, source: 'ci' }], ['scripts/x2.test.mjs', { ms: 1000, source: 'ci' }]])
  const plan = planDExecution(retenus, { budget: 300, estimations, workers: { node: 15 } })
  assert.deepEqual([plan.lances.length, plan.murMs, plan.murCiMs, plan.nCi], [3, 150_000, 0, 2])
  assert.equal(texteDuMur(plan.murMs, plan), '150.0 s, dont 0.0 s estimées depuis la CI (2 test(s), absorbées par le plus long)')
  assert.equal(texteDuMur(plan.rangs[0].murMs, plan.rangs[0]), '150.0 s, dont 0.0 s estimées depuis la CI (2 test(s), absorbées par le plus long)')
})

test('mur : quand les durées CI font le mur, toute sa part se dit estimée depuis la CI (DoD 3 #2497, cas opposé)', () => {
  const retenus = new Map(['long', 'x1', 'x2'].map((n) => [`scripts/${n}.test.mjs`, { rang: 1 }]))
  const estimations = new Map([['scripts/long.test.mjs', { ms: 150_000, source: 'ci' }], ['scripts/x1.test.mjs', { ms: 1000, source: 'ci' }], ['scripts/x2.test.mjs', { ms: 1000, source: 'ci' }]])
  const plan = planDExecution(retenus, { budget: 300, estimations, workers: { node: 15 } })
  assert.equal(texteDuMur(plan.murMs, plan), '150.0 s, dont 150.0 s estimées depuis la CI (3 test(s))')
})

test('planDExecution : une durée INCONNUE part à la CI hors du rang touché, sans couper les suivants ; touchée, elle est lancée et son mur se dit MINORANT', () => {
  const retenus = new Map([['scripts/t.test.mjs', { rang: 0 }], ['src/u.test.ts', { rang: 0 }], ['scripts/a.test.mjs', { rang: 1 }], ['src/i.test.ts', { rang: 1 }], ['scripts/b.test.mjs', { rang: 2 }]])
  const estimations = estimationsDe([...retenus.keys()], { locales: { 'scripts/t.test.mjs': 1000, 'scripts/a.test.mjs': 2000, 'scripts/b.test.mjs': 3000 } })
  const plan = planDExecution(retenus, { budget: 10, estimations })
  assert.deepEqual([plan.lances, plan.aLaCI], [['src/u.test.ts', 'scripts/t.test.mjs', 'scripts/a.test.mjs', 'scripts/b.test.mjs'], ['src/i.test.ts']])
  assert.deepEqual(plan.rangs.map((r) => [r.rang, r.lances, r.aLaCI, r.inconnues, r.sansDuree]),
    [['touché', 2, 0, 1, 1], ['racine balayée', 1, 1, 1, 0], ['import d=1', 1, 0, 0, 0]])
  assert.equal(plan.sansDuree, 1)
})


test('exportsTouches : modifié, ajouté, supprimé, renommé ; inchangé exclu ; module neuf = tout', () => {
  const avant = 'export const a = 1\nexport function b() { return 1 }\nexport const c = 3\nexport const d = 4\nconst e = 5\nexport { e }\n'
  const apres = 'export const a = 2\nexport function b() { return 1 }\nexport const f = 6\nexport const d2 = 4\nconst e = 5\nexport { e }\n'
  assert.deepEqual([...exportsTouches('m.ts', avant, apres)].sort(), ['a', 'c', 'd', 'd2', 'f'])
  assert.deepEqual([...exportsTouches('m.ts', null, 'export const x = 1\nexport default 2\n')].sort(), ['default', 'x'])
})

test('signalDe : symbole touché importé par nom, module sinon ; espace de noms = module ; d≥2 module ou reste', () => {
  const nommee = (nom) => ({ forme: 'nommee', importe: { nom } })
  const touches = new Set(['a'])
  assert.deepEqual(signalDe({ distance: 1 }, [nommee('a'), nommee('b')], touches), { signal: 'symbole', noms: ['a'] })
  assert.deepEqual(signalDe({ distance: 1 }, [nommee('b')], touches), { signal: 'module', noms: [] })
  assert.deepEqual(signalDe({ distance: 1 }, [{ forme: 'espace', importe: { nom: '*' } }], touches), { signal: 'module', noms: [] })
  assert.deepEqual(signalDe({ distance: 2 }, [nommee('a')], touches), { signal: 'module', noms: ['a'] })
  assert.deepEqual(signalDe({ distance: 2 }, [{ forme: 'espace', importe: { nom: '*' } }], touches), { signal: 'reste', noms: [] })
})

test('signal dérivé sur un dépôt : l’import par nom d’un export modifié est un SYMBOLE', (t) => {
  const racine = forger(t, {
    'scripts/lib.mjs': 'export const a = 1\nexport const b = 1\n',
    'scripts/s.test.mjs': "import { a } from './lib.mjs'\n",
    'scripts/m.test.mjs': "import { b } from './lib.mjs'\n",
    'scripts/e.test.mjs': "import * as lib from './lib.mjs'\nexport default lib\n",
  }, { 'scripts/lib.mjs': 'export const a = 2\nexport const b = 1\n' })
  const { signaux } = deriver(racine)
  assert.deepEqual(['scripts/s.test.mjs', 'scripts/m.test.mjs', 'scripts/e.test.mjs'].map((f) => signaux.get(f)),
    [{ signal: 'symbole', noms: ['a'] }, { signal: 'module', noms: [] }, { signal: 'module', noms: [] }])
})

test('mémos signés par le tsconfig : le même blob sous deux tsconfig ne partage pas son mémo (T3)', (t) => {
  const [a, b, c] = ['{}', '{ "compilerOptions": { "verbatimModuleSyntax": true } }', '{}'].map((tsconfig) => {
    const racine = mkdtempSync(join(tmpdir(), 'perimetre-tsconfig-'))
    t.after(() => rmSync(racine, { recursive: true, force: true }))
    writeFileSync(join(racine, 'tsconfig.json'), tsconfig)
    return racine
  })
  const dossier = mkdtempSync(join(tmpdir(), 'perimetre-memos-'))
  t.after(() => rmSync(dossier, { recursive: true, force: true }))
  const ecrits = memosDe(dossier, versionDesMemos(a))
  ecrits.ecrire('specificateurs', '.ts:blob', [])
  ecrits.sauver()
  assert.equal(memosDe(dossier, versionDesMemos(b)).lire('specificateurs', '.ts:blob'), undefined)
  assert.deepEqual(memosDe(dossier, versionDesMemos(c)).lire('specificateurs', '.ts:blob'), [])
})

test('mémos signés par le texte de `perimetre.mjs`, qui calcule les mémos `declarations` et `liaisons` (C2)', (t) => {
  const racine = mkdtempSync(join(tmpdir(), 'perimetre-versionnant-'))
  t.after(() => rmSync(racine, { recursive: true, force: true }))
  const meme = () => 'texte'
  const autre = (f) => f === 'scripts/test/perimetre.mjs' ? 'autre texte' : 'texte'
  assert.equal(versionDesMemos(racine, meme), versionDesMemos(racine, meme))
  assert.notEqual(versionDesMemos(racine, autre), versionDesMemos(racine, meme))
})

test('lint : lancé sur les fichiers touchés PRÉSENTS à extension lintée, son code de sortie compte', () => {
  const appels = []
  const lancer = (racine, fichiers, { cwd }) => { appels.push([racine, fichiers, cwd]); return { defauts: [], codeSortie: 1 } }
  const lint = lintDesTouches('/r', ['a.ts', 'b.json', 'parti.mjs', 'c.mjs'], ['a.ts', 'b.json', 'c.mjs'], lancer)
  assert.deepEqual([appels, lint.code], [[['/r', ['a.ts', 'c.mjs'], '/r']], 1])
  assert.deepEqual(lintDesTouches('/r', ['b.json'], ['b.json'], lancer), { fichiers: [], defauts: [], code: 0 })
})

test('lireArguments : --tete exige --base, --budget exige un entier de secondes', () => {
  assert.deepEqual(lireArguments(['--liste', '--base', 'b', '--tete', 't', '--budget', '40', '--docs']), { liste: true, base: 'b', tete: 't', budget: 40, docs: true })
  assert.throws(() => lireArguments(['--tete', 't']), /--tete exige --base/)
  assert.throws(() => lireArguments(['--budget', 'beaucoup']), /--budget attend un entier/)
})

/** Un module Vitest de durée `ms` (`TestModule.diagnostic()`), pour `DureesVitest`. */
const moduleVitest = (moduleId, ms) => ({ moduleId, diagnostic: () => ({ environmentSetupDuration: 0, prepareDuration: 0, collectDuration: 0, setupDuration: 0, duration: ms }) })

/** Le reporter Vitest réel d'un lancement : il écrit le rapport `sortie` des modules `modules`. */
const lancerVitest = (sortie, modules) => {
  const reporter = new DureesVitest()
  reporter.onInit({ config: { outputFile: { durees: sortie } } })
  reporter.onTestRunEnd(modules)
}

test('apprendre : le rapport d’UN lancement (arrondi) se fusionne dans les mesures, chemins relatifs, puis s’efface ; celui d’un autre lancement reste', (t) => {
  const racine = mkdtempSync(join(tmpdir(), 'perimetre-apprendre-'))
  t.after(() => rmSync(racine, { recursive: true, force: true }))
  const cache = join(racine, 'cache')
  const commun = join(racine, 'commun')
  mkdirSync(cache)
  const rapport = rapportDuLancement(cache, 1)
  mesuresDe(commun).ecrire('durees.json', { 'src/ancien.test.ts': 7, 'src/v.test.ts': 1 })
  writeFileSync(rapport('vitest', 0), JSON.stringify({ [join(racine, 'src', 'v.test.ts')]: 250.2 }))
  writeFileSync(rapport('node', 1), JSON.stringify({ [join(racine, 'scripts', 'n.test.mjs')]: 41.6 }))
  assert.deepEqual(apprendre(racine, rapport('vitest', 0), mesuresDe(commun)), { 'src/v.test.ts': 250 })
  assert.deepEqual([existsSync(rapport('vitest', 0)), existsSync(rapport('node', 1))], [false, true])
  assert.deepEqual(apprendre(racine, rapport('node', 1), mesuresDe(commun)), { 'scripts/n.test.mjs': 42 })
  assert.deepEqual(mesuresDe(commun).lire('durees.json'), { 'src/ancien.test.ts': 7, 'src/v.test.ts': 250, 'scripts/n.test.mjs': 42 })
  assert.equal(existsSync(rapport('node', 1)), false)
})

test('apprendre : le rapport du paquet 1 n’est JAMAIS attribué au paquet 2, même après un échec d’écriture (sonde C3 du juge, inversée)', (t) => {
  const racine = mkdtempSync(join(tmpdir(), 'perimetre-apprendre-c3-'))
  t.after(() => rmSync(racine, { recursive: true, force: true }))
  t.mock.method(console, 'log', () => {})
  const rapport = rapportDuLancement(racine, 4242)
  assert.notEqual(rapport('vitest', 0), rapport('vitest', 1), 'un rapport par lancement')
  let echecs = 1
  const ecrits = []
  const mesures = { lire: () => ({}), ecrire: (nom, e) => { if (echecs-- > 0) throw new Error('verrou tenu'); ecrits.push([nom, e]) } }
  lancerVitest(rapport('vitest', 0), [moduleVitest(join(racine, 'src', 'a.test.ts'), 60000)])
  assert.deepEqual(apprendre(racine, rapport('vitest', 0), mesures), { 'src/a.test.ts': 60000 })
  lancerVitest(rapport('vitest', 1), [moduleVitest(join(racine, 'src', 'b.test.ts'), 1000)])
  assert.deepEqual(apprendre(racine, rapport('vitest', 1), mesures), { 'src/b.test.ts': 1000 })
  assert.deepEqual(ecrits, [['durees.json', { 'src/b.test.ts': 1000 }]])
})

test('apprendre : un paquet SANS rapport apprend {} — le rapport du paquet précédent, écriture échouée, est effacé (sonde C3-bis du juge, inversée)', (t) => {
  const racine = mkdtempSync(join(tmpdir(), 'perimetre-apprendre-c3b-'))
  t.after(() => rmSync(racine, { recursive: true, force: true }))
  t.mock.method(console, 'log', () => {})
  const rapport = rapportDuLancement(racine, 4242)
  const mesures = { lire: () => ({}), ecrire: () => { throw new Error('verrou tenu') } }
  lancerVitest(rapport('vitest', 0), [moduleVitest(join(racine, 'src', 'a.test.ts'), 60000)])
  assert.deepEqual(apprendre(racine, rapport('vitest', 0), mesures), { 'src/a.test.ts': 60000 })
  assert.equal(existsSync(rapport('vitest', 0)), false, 'le rapport ne survit pas à son lancement')
  assert.deepEqual(apprendre(racine, rapport('vitest', 1), mesures), {})
})

test('mesures : sous le répertoire git COMMUN, le même depuis un worktree lié', (t) => {
  const racine = forger(t, {}, {}, { commiter: false })
  const lie = mkdtempSync(join(tmpdir(), 'perimetre-lie-'))
  rmSync(lie, { recursive: true, force: true })
  t.after(() => rmSync(lie, { recursive: true, force: true }))
  gitDe(racine)('worktree', 'add', '-q', lie)
  assert.equal(dossierDesMesures(lie), dossierDesMesures(racine))
  assert.equal(dossierDesMesures(racine).split(/[\\/]/).slice(-2).join('/'), '.git/perimetre')
})

test('mesures : une durée qui n’est pas un nombre fini ≥ 0 ne se lit pas — le budget coupe toujours (sonde NaN du juge)', (t) => {
  const commun = mkdtempSync(join(tmpdir(), 'perimetre-memo-valeurs-'))
  t.after(() => rmSync(commun, { recursive: true, force: true }))
  writeFileSync(join(commun, 'durees.json'), JSON.stringify({ 'scripts/a.test.mjs': 'lent', 'scripts/b.test.mjs': 500000, 'scripts/c.test.mjs': 1000, 'scripts/d.test.mjs': -1, 'scripts/e.test.mjs': null }))
  const durees = mesuresDe(commun).lire('durees.json')
  assert.deepEqual(durees, { 'scripts/b.test.mjs': 500000, 'scripts/c.test.mjs': 1000 })
  const retenus = new Map([['scripts/a.test.mjs', { rang: 2 }], ['scripts/b.test.mjs', { rang: 2 }], ['scripts/c.test.mjs', { rang: 2 }]])
  const plan = planDExecution(retenus, { budget: 180, estimations: estimationsDe([...retenus.keys()], { locales: durees }), workers: { node: 1, vitest: 1 }, surcouts: { node: 0, vitest: 0 } })
  assert.deepEqual([plan.lances, plan.aLaCI, plan.murMs], [['scripts/c.test.mjs'], ['scripts/a.test.mjs', 'scripts/b.test.mjs'], 1000])
})

test('apprendre : une écriture des mesures qui échoue s’imprime avec sa cause, ne lève pas, et EFFACE le rapport de son lancement', (t) => {
  const racine = mkdtempSync(join(tmpdir(), 'perimetre-apprendre-echec-'))
  t.after(() => rmSync(racine, { recursive: true, force: true }))
  const rapport = rapportDuLancement(racine, 1)
  writeFileSync(rapport('node', 0), JSON.stringify({ [join(racine, 'scripts', 'n.test.mjs')]: 41.6 }))
  const imprime = []
  t.mock.method(console, 'log', (texte) => { imprime.push(texte) })
  const enPanne = { lire: () => ({}), ecrire: () => { throw new Error('verrou tenu') } }
  assert.deepEqual(apprendre(racine, rapport('node', 0), enPanne), { 'scripts/n.test.mjs': 42 })
  assert.deepEqual(imprime, ['[perimetre] mesures non écrites — verrou tenu'])
  assert.equal(existsSync(rapport('node', 0)), false, 'le rapport ne survit pas à son lancement')
  assert.equal(ecrireLesMesures(enPanne, 'surcouts.json', { node: 1 }), false)
})

test('mesures : un mémo JSON valide qui n’est pas un objet (null, tableau, nombre) se lit vide et se fusionne sans lever', (t) => {
  const commun = mkdtempSync(join(tmpdir(), 'perimetre-memo-forme-'))
  t.after(() => rmSync(commun, { recursive: true, force: true }))
  for (const texte of ['null', '[1, 2]', '42']) {
    writeFileSync(join(commun, 'durees.json'), texte)
    assert.deepEqual(mesuresDe(commun).lire('durees.json'), {}, texte)
    mesuresDe(commun).ecrire('durees.json', { 'src/v.test.ts': 250 })
    assert.deepEqual(mesuresDe(commun).lire('durees.json'), { 'src/v.test.ts': 250 }, texte)
  }
})

test('mesures : des écrivains CONCURRENTS ne perdent aucune écriture', async (t) => {
  const commun = mkdtempSync(join(tmpdir(), 'perimetre-concurrents-'))
  t.after(() => rmSync(commun, { recursive: true, force: true }))
  const module = new URL('./perimetre.mjs', import.meta.url).href
  const ecrivain = (i) => `const { mesuresDe } = await import(${JSON.stringify(module)})
const m = mesuresDe(${JSON.stringify(commun)})
for (let k = 0; k < 15; k += 1) m.ecrire('durees.json', { ['e${i}-' + k]: k })`
  const { spawn } = await import('node:child_process')
  const codes = await Promise.all([0, 1, 2, 3, 4, 5].map((i) => new Promise((fini) =>
    spawn(process.execPath, ['--input-type=module', '-e', ecrivain(i)], { stdio: 'inherit' }).on('exit', fini))))
  assert.deepEqual(codes, [0, 0, 0, 0, 0, 0])
  assert.equal(Object.keys(mesuresDe(commun).lire('durees.json')).length, 6 * 15)
})

test('mesures : remplacer écrit la valeur ENTIÈRE, sans fusion ; le mémo CI se lit par son lecteur validé', (t) => {
  const commun = mkdtempSync(join(tmpdir(), 'perimetre-remplacer-'))
  t.after(() => rmSync(commun, { recursive: true, force: true }))
  const mesures = mesuresDe(commun)
  mesures.remplacer('durees-ci.json', { run: 1, attempt: 1, sha: 'a', date: 'd1', vitest: { 'src/a.test.ts': 5, 'src/x.test.ts': 6 }, node: {} })
  mesures.remplacer('durees-ci.json', { run: 2, attempt: null, sha: 'b', date: 'd2', vitest: { 'src/b.test.ts': 7 }, node: { 'scripts/n.test.mjs': 8 } })
  assert.deepEqual(mesures.lire('durees-ci.json', memoCiDe), { run: 2, attempt: null, sha: 'b', date: 'd2', vitest: { 'src/b.test.ts': 7 }, node: { 'scripts/n.test.mjs': 8 } })
  mesures.ecrire('durees.json', { 'src/a.test.ts': 1, 'src/b.test.ts': 2 })
  mesures.remplacer('durees.json', { 'src/b.test.ts': 3 })
  assert.deepEqual(mesures.lire('durees.json'), { 'src/b.test.ts': 3 }, 'l’entrée absente de la valeur sort du mémo')
})

test('planDuPerimetre : sur des mesures d’un dossier temporaire, la durée CI estime le test sans durée apprise, calibrée par l’environnement lu', (t) => {
  const commun = mkdtempSync(join(tmpdir(), 'perimetre-plan-'))
  t.after(() => rmSync(commun, { recursive: true, force: true }))
  mesuresDe(commun).ecrire('durees.json', { 'src/a.test.ts': 100 })
  mesuresDe(commun).remplacer('durees-ci.json', { run: 5, attempt: 1, sha: 'abc', date: 'd', vitest: { 'src/a.test.ts': 50, 'src/j.test.tsx': 1000 }, node: {} })
  const lus = []
  const lire = (rels) => { lus.push(...rels); return new Map(rels.map((r) => [r, r.endsWith('.tsx') ? '/** @vitest-environment jsdom */\n' : 'export {}\n'])) }
  const retenus = new Map([['src/a.test.ts', { rang: 1 }], ['src/j.test.tsx', { rang: 1 }]])
  const { ci, facteurs, estimations, plan } = planDuPerimetre(retenus, { mesures: mesuresDe(commun), lire, budget: 180, workers: { vitest: 1 } })
  assert.deepEqual([ci.run, [...lus].sort()], [5, ['src/a.test.ts', 'src/j.test.tsx']])
  assert.deepEqual([estimations.get('src/a.test.ts').source, estimations.get('src/j.test.tsx').ms, estimations.get('src/j.test.tsx').population], ['locale', 3500, 'vitest-jsdom'])
  assert.deepEqual([facteurs['vitest-node'].origine, facteurs['vitest-node'].paires], ['repli', 1])
  assert.deepEqual([plan.nCi, plan.murCiMs], [1, 3500])
})
