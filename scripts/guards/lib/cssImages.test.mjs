// La LECTURE des images CSS (`cssImages.mjs`, #1806) : le côté d'un arbre se résout contre les SEULS
// fichiers de cet arbre. Source en mémoire, racine = ce dépôt, dont le disque porte le composant cité.
import { test, mock } from 'node:test'
import { API } from 'typescript/unstable/sync'
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { CHEMIN_MANIFESTE } from './cssCouches.mjs'
import { COLLECTIONS_VENTILEES, coteCss, importsDansLArbre, stockCssDe } from './cssImages.mjs'
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
