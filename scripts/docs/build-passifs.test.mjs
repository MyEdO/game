import test from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { existsSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { instanceDeDepot, envDeDepotForge } from '../guards/lib/depotGabarit.mjs'
import ts from 'typescript'
import { contexteImports } from '../guards/lib/canonUnique.mjs'
import { loadSource } from './lib/jsdocUnion.mjs'
import { canoniser, relatifSousRacine } from './lib/chemin-mesure.mjs'

const RACINE = resolve(import.meta.dirname, '../..')
const BUILDER = fileURLToPath(new URL('build-passifs.mjs', import.meta.url))
const RENDRE = fileURLToPath(new URL('lib/rendre-seul.mjs', import.meta.url))
const OPS = [
  'export type PassiveKind =',
  "  | 'talent' // Talents.",
  "  | 'trait' // Traits.",
  "  | 'item' // Objets.",
].join('\n')
const PRODUCTEUR = [
  '/** Produit la source canonique. Deuxième phrase. */',
  'export function produire() { return []; }',
  '/** Source imbriquée indésirable. */',
  'function voisin() { function produire() { return []; } }',
].join('\n')

function trauma({ importee = "import { produire } from './source';", appel = 'produire', local = '', masque = false } = {}) {
  return [
    importee,
    local,
    "const PASSIVE_CANCELLERS = { talent: [], trait: [], item: [] };",
    "function isAdditiveKind(kind) { return kind === 'talent'; }",
    'function traumaOpKind(op: GameOp): PassiveKind {',
    "  if (op.op === 'skillMod') return 'talent';",
    "  return 'trait'; // Profil de défaut.",
    '}',
    'function passiveMods(c) {',
    '  const out = [];',
    masque ? `  if (c) { const ${appel} = () => []; out.push(...${appel}()); }` : `  out.push(...${appel} ());`,
    "  out.push({ kind: 'talent' });",
    "  out.push({ kind: 'trait' });",
    "  out.push({ kind: 'item' });",
    `  if (c) out.push(...${appel}());`,
    '  return out;',
    '}',
  ].join('\n')
}

function fichiers(tr = trauma(), sources = { 'src/engine/source.ts': PRODUCTEUR }) {
  return {
    '.gitignore': 'node_modules/\n',
    'src/engine/ops.ts': OPS,
    'src/engine/trauma.ts': tr,
    ...sources,
    ...Object.fromEntries(['a', 'b', 'c'].flatMap((nom) => [
      [`src/data/schemas/defs/${nom}.ts`, `export const file = '${nom}.json';\nconst d = document('${nom}', 'entite', { passive: list }, {}, {});`],
      [`src/data/${nom}.json`, JSON.stringify([{ id: nom, passive: [{ op: 'skillMod' }] }])],
    ])),
    'src/data/mutations.json': JSON.stringify([{ id: 'mutation', kind: 'mental' }]),
    'src/data/mutationTables.json': JSON.stringify([{ entries: [{ mutation: 'mutation' }] }]),
  }
}

function jouer(contenu, verifier) {
  const racineCanonique = canoniser(RACINE)
  assert.equal(relatifSousRacine(racineCanonique, tmpdir()), null, 'os.tmpdir() doit être hors RACINE avant instanceDeDepot')
  const { racine } = instanceDeDepot({ fichiers: contenu, commit: false })
  try {
    assert.equal(relatifSousRacine(racineCanonique, racine), null, racine)
    const sortie = spawnSync(process.execPath, [RENDRE, BUILDER], {
      cwd: racine, env: envDeDepotForge(), encoding: 'utf8', timeout: 15000, maxBuffer: 1024 * 1024,
    })
    verifier(sortie, racine)
    assert.equal(existsSync(join(racine, 'docs')), false, 'rendre() ne crée aucun artefact')
  } finally {
    rmSync(racine, { recursive: true, force: true })
    assert.equal(existsSync(racine), false, racine)
  }
}

function documentDe(sortie) {
  assert.equal(sortie.status, 0, sortie.stderr)
  const rendu = JSON.parse(sortie.stdout)
  assert.equal(rendu.length, 1)
  assert.equal(rendu[0][0], ['docs', 'systeme-passifs.md'].join('/'))
  return rendu[0][1]
}

for (const [famille, chemin, entete] of [
  ['direct ts', 'src/engine/source.ts', "import { produire } from './source';"],
  ['alias ts', 'src/engine/source.ts', "import { produire as emettre } from './source';"],
  ['alias js', 'src/engine/source.js', "import { produire as emettre } from './source.js';"],
  ['alias index', 'src/engine/source/index.ts', "import { produire as emettre } from './source';"],
  ['import type', 'src/engine/source.ts', "import type { produire as emettre } from './source';"],
]) {
  test(`producteur ${famille} : déclaration de module, JSDoc et citation réels`, () => {
    const alias = famille !== 'direct ts'
    const tr = trauma({ importee: entete, appel: alias ? 'emettre' : 'produire' })
    jouer(fichiers(tr, { [chemin]: PRODUCTEUR }), (sortie) => {
      const doc = documentDe(sortie)
      const nom = alias ? '`produire` (appelé `emettre`)' : '`produire`'
      assert.ok(doc.includes(`| ${nom} | \`${chemin}:2\` | Produit la source canonique. |`))
      assert.ok(!doc.includes('Source imbriquée indésirable.'))
      const ligne = tr.split('\n').findIndex((l) => l.includes(`...${alias ? 'emettre' : 'produire'} (`)) + 1
      assert.ok(doc.includes(`| \`src/engine/trauma.ts:${ligne}\` | — | \`${alias ? 'emettre' : 'produire'}\` |`))
      assert.match(doc, /3 membres/)
      assert.match(doc, /5 branches/)
      for (const n of ['a', 'b', 'c']) assert.ok(doc.includes(`src/data/${n}.json`))
    })
  })
}

test('producteur local : une déclaration imbriquée homonyme ne remplace pas celle du module', () => {
  const tr = trauma({ importee: '', local: PRODUCTEUR })
  jouer(fichiers(tr, {}), (sortie) => {
    const doc = documentDe(sortie)
    const ligne = tr.split('\n').findIndex((l) => l.startsWith('export function produire')) + 1
    assert.ok(doc.includes(`| \`produire\` | \`src/engine/trauma.ts:${ligne}\` | Produit la source canonique. |`))
  })
})

test('producteur variable nommé : citation de la déclaration de module', () => {
  const source = '/** Produit une variable canonique. */\nexport const produire = () => [];\n'
  jouer(fichiers(trauma(), { 'src/engine/source.ts': source }), (sortie) => {
    assert.ok(documentDe(sortie).includes('| `produire` | `src/engine/source.ts:2` | Produit une variable canonique. |'))
  })
})

test('producteur non exporté : le privé homonyme ne satisfait pas l’import', () => {
  jouer(fichiers(trauma(), { 'src/engine/source.ts': '/** Privé. */\nfunction produire() { return []; }\nexport function voisin() {}' }), (sortie) => {
    assert.equal(sortie.status, 1, sortie.stderr)
    assert.match(sortie.stderr, /déclaration du producteur `produire`.*introuvable/)
    assert.equal(sortie.stdout, '')
  })
})

for (const prive of [false, true]) {
  test(`producteur export local renommé${prive ? ' avec privé homonyme' : ''} : déclaration et JSDoc du symbole exporté`, () => {
    const source = '/** Source interne canonique. Deuxième phrase. */\nfunction interne() { return []; }\nexport { interne as produire };'
      + (prive ? '\n/** Privé homonyme indésirable. */\nfunction produire() { return []; }' : '')
    const tr = prive ? trauma({ importee: "import { produire as emettre } from './source';", appel: 'emettre' }) : trauma()
    jouer(fichiers(tr, { 'src/engine/source.ts': source }), (sortie, racine) => {
      const { sf } = loadSource(join(racine, 'src/engine/source.ts'))
      const contexte = contexteImports(sf)
      assert.equal(contexte.source, sf)
      const checker = contexte.checker()
      assert.equal(contexte.checker(), checker)
      const symbole = checker.getExportsOfModule(checker.getSymbolAtLocation(sf)).find((s) => s.name === 'produire')
      assert.ok(symbole.flags & ts.SymbolFlags.Alias)
      assert.equal(checker.getAliasedSymbol(symbole).declarations[0], sf.statements[0])
      const doc = documentDe(sortie)
      assert.ok(doc.includes(`| \`interne\` (appelé \`produire\`${prive ? ', `emettre`' : ''}) | \`src/engine/source.ts:2\` | Source interne canonique. |`))
      assert.ok(!doc.includes('Privé homonyme indésirable.'))
    })
  })
}

for (const [nom, contenu, refus] of [
  ['import absent', fichiers(trauma({ importee: "import { produire } from './absent';" })), /import du producteur `produire` : `.\/absent` introuvable/],
  ['déclaration absente', fichiers(trauma(), { 'src/engine/source.ts': 'export function voisin() {}' }), /déclaration du producteur `produire`.*introuvable/],
  ['déclaration seulement imbriquée', fichiers(trauma(), { 'src/engine/source.ts': 'function voisin() { function produire() {} }' }), /déclaration du producteur `produire`.*introuvable/],
  ['import masqué', fichiers(trauma({ masque: true })), /producteur `produire` : occurrence masquée/],
  ['local masqué', fichiers(trauma({ importee: '', local: PRODUCTEUR, masque: true }), {}), /producteur `produire` : occurrence masquée/],
]) {
  test(`producteur ${nom} : erreur nommée, aucun artefact`, () => {
    jouer(contenu, (sortie) => {
      assert.equal(sortie.status, 1, sortie.stderr)
      assert.match(sortie.stderr, refus)
      assert.equal(sortie.stdout, '')
    })
  })
}
