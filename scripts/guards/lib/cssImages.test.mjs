// La LECTURE des images CSS (`cssImages.mjs`, #1806) : le côté d'un arbre se résout contre les SEULS
// fichiers de cet arbre. Source en mémoire, racine = ce dépôt, dont le disque porte le composant cité.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { CHEMIN_MANIFESTE } from './cssCouches.mjs'
import { COLLECTIONS_VENTILEES, coteCss, sourceMelee, stockCssDe } from './cssImages.mjs'
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

test('coteCss : un composant présent sur le DISQUE mais absent de l’arbre jugé n’est pas réutilisé', () => {
  assert.ok(existsSync(`${RACINE}/${COMPOSANT}`), `${COMPOSANT} doit exister sur le disque pour que le cas morde`)
  const textes = importeursDe("import { RollShell } from './RollShell'\n", "import { RollShell } from './RollShell'\n")
  assert.deepEqual(reutilises(sourceDe(textes)), [COMPOSANT], 'témoin : dans l’arbre, il est réutilisé')
  assert.deepEqual(reutilises(sourceDe(textes, IMPORTEURS)), [])
})

test('coteCss : les arcs sont ceux d’`IMPORT_RE` sur le fichier ENTIER — plusieurs lignes, commentaire, `/` final, `import(` puis `.then(` ; un littéral ne compte pas', () => {
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

test('sourceMelee : chaque chemin vient de SON côté — `lister` et `citants` sans doublon, un chemin du pathspec absent de l’arbre ne part pas', () => {
  const faux = (fichiers) => ({
    lister: (dossier) => Object.keys(fichiers).filter((f) => f.startsWith(`${dossier}/`)),
    lire: (rel) => fichiers[rel] ?? null,
    lireTout: (rels) => new Map(rels.map((rel) => [rel, fichiers[rel] ?? null])),
    citants: (motif) => Object.keys(fichiers).filter((f) => fichiers[f].includes(motif)),
  })
  const dedans = faux({ 'src/a.ts': 'a arbre motif', 'src/b.ts': 'b arbre motif' })
  const dehors = faux({ 'src/a.ts': 'a head motif', 'src/b.ts': 'b head motif', 'src/c.ts': 'c head motif', 'src/d.ts': 'd head motif' })
  const melee = sourceMelee({ dans: (f) => f === 'src/a.ts' || f === 'src/d.ts', dedans, dehors })
  assert.deepEqual(melee.lister('src').sort(), ['src/a.ts', 'src/b.ts', 'src/c.ts'])
  assert.deepEqual(melee.citants('motif').sort(), ['src/a.ts', 'src/b.ts', 'src/c.ts'])
  assert.equal(melee.lire('src/a.ts'), 'a arbre motif')
  assert.equal(melee.lire('src/b.ts'), 'b head motif')
  assert.deepEqual([...melee.lireTout(['src/a.ts', 'src/b.ts', 'src/d.ts'])], [['src/a.ts', 'a arbre motif'], ['src/b.ts', 'b head motif'], ['src/d.ts', null]])
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
