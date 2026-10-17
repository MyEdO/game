// La LECTURE des images CSS (`cssImages.mjs`, #1806) : le côté d'un arbre se résout contre les SEULS
// fichiers de cet arbre. Source en mémoire, racine = ce dépôt, dont le disque porte le composant cité.
import { test, mock } from 'node:test'
import { API } from 'typescript/unstable/sync'
import assert from 'node:assert/strict'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { CHEMIN_MANIFESTE } from './cssCouches.mjs'
import { COLLECTIONS_VENTILEES, coteCss, importsDansLArbre, stockCssDe } from './cssImages.mjs'
import { DOSSIER_DES_MEMOS, memosDAnalyse, versionDesMemos } from './memosDAnalyse.mjs'
import { instanceDeDepot } from './depotGabarit.mjs'
import { depotDe } from './gitPorte.mjs'
import { tableTotale } from '../../../src/lib/tableTotale.ts'

const RACINE = fileURLToPath(new URL('../../..', import.meta.url))
const COMPOSANT = 'src/ui/RollShell.tsx'
const IMPORTEURS = ['A', 'B'].map((n) => `src/ui/Ecran${n}.tsx`)
const MODULE = 'src/ui/styles/rs.css'
const PRIMITIVE = { id: 'rs', fichier: COMPOSANT, css: MODULE }

/** Un arbre en mémoire : `textes` = `{ chemin: texte }` hors manifeste ; `citants` rend TOUT chemin de
 *  `src/` dont une ligne porte le motif, sans filtre de module : c'est `coteCss` qui les écarte. */
const sourceDe = (textes, fichiers = [...IMPORTEURS, COMPOSANT]) => {
  const lire = (rel) => (rel === CHEMIN_MANIFESTE ? JSON.stringify([PRIMITIVE]) : textes[rel] ?? null)
  return {
    lire,
    lireTout: (rels) => new Map(rels.map((rel) => [rel, lire(rel)])),
    citants: (motif) => {
      const re = new RegExp(motif)
      return Object.entries(textes).filter(([f, t]) => f.startsWith('src/') && t.split('\n').some((l) => re.test(l))).map(([f]) => f)
    },
    lister: () => fichiers,
  }
}
const importeursDe = (...textes) => tableTotale(IMPORTEURS, (_f, i) => textes[i])
const reutilises = (source) => [...coteCss(source, { racine: RACINE }).reutilises]

test('importsDansLArbre : un batch conserve ordre, doublons, chemins absents et non-modules', () => {
  const close = API.prototype.close
  const spy = mock.method(API.prototype, 'close', function () { return close.call(this) })
  try {
    const source = sourceDe({
      ...importeursDe("import { RollShell } from './RollShell'\n", "import './RollShell'\n"),
      'src/ui/NOTES.md': "import './RollShell'\n",
    })
    const rels = [IMPORTEURS[0], 'src/ui/absent.ts', IMPORTEURS[0], 'src/ui/NOTES.md', IMPORTEURS[1]]
    assert.deepEqual(importsDansLArbre(source, rels, { racine: RACINE }), [
      [IMPORTEURS[0], [COMPOSANT]], ['src/ui/absent.ts', []], [IMPORTEURS[0], [COMPOSANT]], ['src/ui/NOTES.md', []], [IMPORTEURS[1], [COMPOSANT]],
    ])
    assert.equal(spy.mock.callCount(), 1)
    assert.deepEqual(importsDansLArbre(source, ['src/ui/NOTES.md'], { racine: RACINE }), [['src/ui/NOTES.md', []]])
    assert.equal(spy.mock.callCount(), 1)
    assert.throws(() => importsDansLArbre(sourceDe(importeursDe('const x = ;', "import './RollShell'")), IMPORTEURS, { racine: RACINE }), /ne se parse pas/)
    assert.equal(spy.mock.callCount(), 2)
  } finally { spy.mock.restore() }
})

test('coteCss : un composant présent sur le DISQUE mais absent de l’arbre jugé n’est pas réutilisé', () => {
  assert.ok(existsSync(`${RACINE}/${COMPOSANT}`), `${COMPOSANT} doit exister sur le disque pour que le cas morde`)
  const textes = importeursDe("import { RollShell } from './RollShell'\n", "import { RollShell } from './RollShell'\n")
  assert.deepEqual(reutilises(sourceDe(textes)), [COMPOSANT], 'témoin : dans l’arbre, il est réutilisé')
  assert.deepEqual(reutilises(sourceDe(textes, IMPORTEURS)), [])
})

test('coteCss : les arcs sont ceux de `specificateursDe` sur le fichier ENTIER — plusieurs lignes, commentaire, `/` final, `import(` puis `.then(` ; un littéral ne compte pas', () => {
  const formes = [
    "import {\n  RollShell,\n} from\n  './RollShell'\n",
    "import {\n  RollShell,\n} from\n  './RollShell' // primitive\n",
    "import X from './RollShell/'\n",
    "const M = await import(\n  './RollShell').then((m) => m.RollShell)\n",
  ]
  for (const f of formes) assert.deepEqual(reutilises(sourceDe(importeursDe(f, formes[0]))), [COMPOSANT], f)
  assert.deepEqual(reutilises(sourceDe(importeursDe(formes[0], "const p = './RollShell'\n"))), [],
    'un seul importeur réel : le littéral ne compte pas')
})

test('coteCss : l’alias se lit dans le `tsconfig.json` de l’arbre JUGÉ, cibles sous `racine`', () => {
  const tsconfig = (cle) => JSON.stringify({ compilerOptions: { baseUrl: '.', paths: { [`${cle}/*`]: ['src/*'] } } })
  const par = (spec) => importeursDe(`import { R } from '${spec}'\n`, `import { R } from '${spec}'\n`)
  assert.deepEqual(reutilises(sourceDe({ ...par('~/ui/RollShell'), 'tsconfig.json': tsconfig('~') })), [COMPOSANT],
    'un alias que seul l’arbre jugé déclare')
  assert.deepEqual(reutilises(sourceDe(par('@/ui/RollShell'))), [], 'l’arbre jugé sans `tsconfig.json` n’a aucun alias, quoi qu’en dise le disque')
})

test('coteCss : un fichier qui n’est pas un MODULE de code (`.md`, `.json`, `.css`, `.snap`) n’importe jamais', () => {
  const reel = "import { RollShell } from './RollShell'\n"
  for (const [f, t] of [
    ['src/ui/NOTES.md', "```ts\nimport { RollShell } from './RollShell'\n```\n"],
    ['src/ui/__snapshots__/x.test.tsx.snap', "exports[`a`] = `\"import { RollShell } from './RollShell'\"`;\n"],
    ['src/ui/data.json', '{ "exemple": "import X from \'./RollShell\'" }\n'],
    ['src/ui/b.css', "@import './RollShell.tsx';\n"],
  ]) assert.deepEqual(reutilises(sourceDe({ [IMPORTEURS[0]]: reel, [f]: t })), [], f)
})

test('stockCssDe : les deux volets ventilés du stock écrit ; une collection absente ou hors forme LÈVE en se nommant', () => {
  const E = { fichier: 'src/ui/a.css', ref: '.a :: color', occurrence: 1 }
  const texte = (identite, espacement) => `export const ${COLLECTIONS_VENTILEES.identite} = ${identite}\nexport const ${COLLECTIONS_VENTILEES.espacement} = ${espacement}\n`
  assert.deepEqual(stockCssDe(texte(`[\n  { fichier: '${E.fichier}', ref: '${E.ref}', occurrence: 1 },\n]`, '[]'), 'à HEAD'), { identite: [E], espacement: [] })
  assert.throws(() => stockCssDe(`export const ${COLLECTIONS_VENTILEES.identite} = []\n`, 'à HEAD'),
    new RegExp(`illisible à HEAD : collection\\(s\\) ${COLLECTIONS_VENTILEES.espacement} introuvable`))
  assert.throws(() => stockCssDe(texte('[{ fichier: 1 }]', '[]'), 'à v1'),
    new RegExp(`illisible à v1 : collection\\(s\\) ${COLLECTIONS_VENTILEES.identite} introuvable`))
})

/** Les mémos d'analyse (`memosDAnalyse`) d'un dépôt neuf, résolus contre ce dépôt-ci (`RACINE`). */
const memosNeufs = (racine) => memosDAnalyse(depotDe(racine), { racine: RACINE })
const fichierDesMemos = (racine) => join(racine, '.git', DOSSIER_DES_MEMOS, `specificateurs-typage.${versionDesMemos(RACINE)}.json`)
const IMPORTE = importeursDe("import { RollShell } from './RollShell'\n", "import './RollShell'\n")

/** Le côté `coteCss` de `source` sous `memos`, et le nombre d'analyses (`API.close`) qu'il a coûtées. */
function coteMesure(source, memos) {
  const close = API.prototype.close
  const spy = mock.method(API.prototype, 'close', function () { return close.call(this) })
  try {
    const reutilisesVus = [...coteCss(source, { racine: RACINE, specificateurs: memos.specificateurs }).reutilises]
    memos.sauver()
    return { reutilises: reutilisesVus, analyses: spy.mock.callCount() }
  } finally { spy.mock.restore() }
}

test('#2603 — memosDAnalyse : verdict identique avec et sans mémo ; un texte mémoïsé ne se reparse pas, d’un processus à l’autre (git-common-dir)', () => {
  const { racine } = instanceDeDepot({ fichiers: { 'a.txt': 'a\n' } })
  try {
    const sans = reutilises(sourceDe(IMPORTE))
    const premier = coteMesure(sourceDe(IMPORTE), memosNeufs(racine))
    assert.deepEqual(premier.reutilises, sans)
    assert.equal(premier.analyses, 1)
    assert.ok(existsSync(fichierDesMemos(racine)), 'le mémo vit sous le répertoire git commun')
    const second = coteMesure(sourceDe(IMPORTE), memosNeufs(racine))
    assert.deepEqual(second, { reutilises: sans, analyses: 0 })
  } finally { rmSync(racine, { recursive: true, force: true }) }
})

test('#2603 — memosDAnalyse : un texte changé, ou un analyseur changé (version), se recalcule', () => {
  const { racine } = instanceDeDepot({ fichiers: { 'a.txt': 'a\n' } })
  try {
    coteMesure(sourceDe(IMPORTE), memosNeufs(racine))
    const change = importeursDe("import { RollShell } from './RollShell'\n", "const p = './RollShell'\n")
    assert.deepEqual(coteMesure(sourceDe(change), memosNeufs(racine)), { reutilises: [], analyses: 1 }, 'texte changé : recalcul')
    const lu = JSON.parse(readFileSync(fichierDesMemos(racine), 'utf8'))
    writeFileSync(fichierDesMemos(racine), JSON.stringify({ ...lu, version: 'un-autre-analyseur' }))
    assert.deepEqual(coteMesure(sourceDe(IMPORTE), memosNeufs(racine)), { reutilises: [COMPOSANT], analyses: 1 }, 'analyseur changé : recalcul')
  } finally { rmSync(racine, { recursive: true, force: true }) }
})

test('#2603 — memosDAnalyse : un mémo corrompu est ignoré, le verdict reste celui de l’analyse', () => {
  const { racine } = instanceDeDepot({ fichiers: { 'a.txt': 'a\n' } })
  try {
    mkdirSync(dirname(fichierDesMemos(racine)), { recursive: true })
    writeFileSync(fichierDesMemos(racine), '{ tronqué')
    assert.deepEqual(coteMesure(sourceDe(IMPORTE), memosNeufs(racine)), { reutilises: [COMPOSANT], analyses: 1 })
    assert.deepEqual(coteMesure(sourceDe(IMPORTE), memosNeufs(racine)), { reutilises: [COMPOSANT], analyses: 0 }, 'réécrit, il resert')
  } finally { rmSync(racine, { recursive: true, force: true }) }
})

test('#2603 — memosDAnalyse : mémo de la bonne version mais de forme fausse ⇒ même verdict que sans mémo', () => {
  const { racine } = instanceDeDepot({ fichiers: { 'a.txt': 'a\n' } })
  try {
    const sans = reutilises(sourceDe(IMPORTE))
    coteMesure(sourceDe(IMPORTE), memosNeufs(racine))
    const lu = JSON.parse(readFileSync(fichierDesMemos(racine), 'utf8'))
    writeFileSync(fichierDesMemos(racine), JSON.stringify({ ...lu, memos: tableTotale(Object.keys(lu.memos), () => 42) }))
    assert.deepEqual(coteMesure(sourceDe(IMPORTE), memosNeufs(racine)), { reutilises: sans, analyses: 1 })
  } finally { rmSync(racine, { recursive: true, force: true }) }
})

test('#2603 — memosDAnalyse : écriture des mémos impossible ⇒ même verdict que sans mémo, rien ne lève', () => {
  const { racine } = instanceDeDepot({ fichiers: { 'a.txt': 'a\n' } })
  const avertir = mock.method(process.stderr, 'write', () => true)
  try {
    const sans = reutilises(sourceDe(IMPORTE))
    mkdirSync(join(racine, '.git', 'hooks-git'), { recursive: true })
    writeFileSync(join(racine, '.git', DOSSIER_DES_MEMOS), 'un fichier, pas un dossier')
    assert.deepEqual(coteMesure(sourceDe(IMPORTE), memosNeufs(racine)), { reutilises: sans, analyses: 1 })
    assert.equal(avertir.mock.callCount(), 1)
  } finally {
    avertir.mock.restore()
    rmSync(racine, { recursive: true, force: true })
  }
})
