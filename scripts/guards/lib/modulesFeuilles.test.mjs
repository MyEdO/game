// CLIQUET de la garde des MODULES FEUILLES (node --test, sans réseau) : l'arbre est fabriqué sous
// `os.tmpdir()`, et les cas portent les graphies qu'un prédicat écrit à la main rate.
// Lancé par `npm run test:hooks`.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { FEUILLES, importsResolus, manquementsDeFeuilles, sourcesSuivies } from './modulesFeuilles.mjs'

const FEUILLE = 'scripts/ops/geste.mjs'
const FEUILLES_FIXTURE = [{ module: FEUILLE, bancs: ['scripts/ops/geste.test.mjs'], pourquoi: 'porte LE geste' }]

/** Un arbre jetable : la feuille, son banc, et les sources que le cas veut éprouver. */
function arbre(fichiers) {
  const racine = mkdtempSync(join(tmpdir(), 'wfrp-feuilles-'))
  const tout = { [FEUILLE]: 'export const geste = () => {}\n', 'scripts/ops/geste.test.mjs': '', ...fichiers }
  for (const [rel, contenu] of Object.entries(tout)) {
    mkdirSync(dirname(join(racine, rel)), { recursive: true })
    writeFileSync(join(racine, rel), contenu)
  }
  return { racine, sources: Object.keys(tout).sort() }
}

const mesurer = (fichiers) => {
  const { racine, sources } = arbre(fichiers)
  try {
    return manquementsDeFeuilles({ racine, sources, feuilles: FEUILLES_FIXTURE })
  } finally {
    rmSync(racine, { recursive: true, force: true })
  }
}

// Les graphies d'ACQUISITION qui atteignent une feuille. Un prédicat écrit à la main ne voit que
// celles qu'il a imaginées : mesuré, une regex `import … from '…'` mono-ligne rend `true` sur le
// premier cas et `false` sur tous les autres, alors que le dépôt écrit ses imports en multi-ligne
// partout. La table est donc la MESURE, et elle s'étend d'une ligne.
const GRAPHIES = [
  ['mono-ligne', "import { geste } from './geste.mjs'\n"],
  ['multi-ligne', "import {\n  geste,\n} from './geste.mjs'\n"],
  ['dynamique', "const m = await import('./geste.mjs')\n"],
  ['ré-export', "export { geste } from './geste.mjs'\n"],
  ['sans extension', "import { geste } from './geste'\n"],
  ['chemin écrit autrement', "import { geste } from '../ops/./geste.mjs'\n"],
  ['effet de bord', "import './geste.mjs'\n"],
  ['import de type', "import type { geste } from './geste.mjs'\n"],
  // `require` (#1813) : `createRequire` est une graphie VIVANTE de ce dépôt (`dialecte.mjs`).
  ['require nu', "const { geste } = require('./geste.mjs')\n"],
  ['createRequire chaîné', "const { geste } = createRequire(import.meta.url)('./geste.mjs')\n"],
  ['createRequire lié à `require`', "const require = createRequire(import.meta.url)\nconst m = require('./geste')\n"],
  ['import x = require', "import geste = require('./geste.mjs')\n"],
  ['module.require', "const { geste } = module.require('./geste.mjs')\n"],
]

for (const [graphie, code] of GRAPHIES) {
  test(`une acquisition en ${graphie} atteint la FEUILLE, et la garde la NOMME`, () => {
    const vu = mesurer({ 'scripts/ops/tiers.mjs': code })
    assert.equal(vu.manquements.length, 1, `graphie « ${graphie} » : ${JSON.stringify(vu.manquements)}`)
    assert.match(vu.manquements[0], /scripts\/ops\/tiers\.mjs importe la FEUILLE scripts\/ops\/geste\.mjs/)
    assert.match(vu.manquements[0], /porte LE geste/, 'le manquement dit l’invariant que la feuille sert')
  })
}

// Ce que la garde ne DOIT pas compter — et, pour les deux derniers, ce qu'aucune lecture statique ne
// peut compter : le spécificateur n'est pas un littéral, ou le callee n'est plus un jeton connu.
const NEGATIFS = [
  ['un require d’un AUTRE module', "const { autre } = require('./autre.mjs')\n"],
  ['un require de PAQUET npm', "const ts = createRequire(import.meta.url)('typescript')\n"],
  ['un spécificateur passé par VARIABLE', "const m = require(chemin)\nconst d = await import(chemin)\n"],
  ['un require lié sous un AUTRE nom', "const req = createRequire(import.meta.url)\nconst m = req('./geste.mjs')\n"],
]

for (const [cas, code] of NEGATIFS) {
  test(`${cas} n’atteint PAS la feuille, et la garde ne crie pas`, () => {
    const vu = mesurer({ 'scripts/ops/tiers.mjs': code, 'scripts/ops/autre.mjs': 'module.exports = 1\n' })
    assert.deepEqual(vu.manquements, [], `cas « ${cas} »`)
  })
}

test('le BANC déclaré de la feuille l’importe sans manquement — sinon le geste serait intestable', () => {
  const vu = mesurer({ 'scripts/ops/geste.test.mjs': "import { geste } from './geste.mjs'\n" })
  assert.deepEqual(vu.manquements, [])
})

test('une source qui ne l’importe PAS ne rend rien, et une simple MENTION n’est pas un import', () => {
  const vu = mesurer({
    'scripts/ops/tiers.mjs': "import { autre } from './autre.mjs'\n",
    'scripts/ops/autre.mjs': 'export const autre = 1\n',
    // Un commentaire qui NOMME la feuille est de la doc : `scripts/ops/geste.mjs`.
    'scripts/ops/doc.mjs': '// voir scripts/ops/geste.mjs, qui porte le geste\nexport const x = 1\n',
  })
  assert.deepEqual(vu.manquements, [])
})

test('une feuille dont le MODULE est introuvable est un MANQUEMENT : une garde à vide est verte pour rien', () => {
  const racine = mkdtempSync(join(tmpdir(), 'wfrp-feuilles-'))
  try {
    const vu = manquementsDeFeuilles({
      racine, sources: ['scripts/ops/tiers.mjs'], feuilles: [{ module: 'scripts/ops/parti.mjs', bancs: [], pourquoi: 'p' }],
    })
    assert.equal(vu.manquements.length, 1)
    assert.match(vu.manquements[0], /feuille déclarée introuvable/)
  } finally {
    rmSync(racine, { recursive: true, force: true })
  }
})

test('importsResolus : l’extraction vient de la primitive, jamais d’une regex de plus', () => {
  const { racine } = arbre({})
  try {
    const abs = join(racine, 'scripts/ops/tiers.mjs').split('\\').join('/')
    const vus = importsResolus(abs, "import {\n  geste,\n} from './geste.mjs'\nconst d = import('./geste')\n")
    assert.deepEqual(vus.map((v) => v.spec), ['./geste.mjs', './geste'])
    // Deux graphies, UN seul fichier : c'est la résolution qui le dit.
    assert.equal(new Set(vus.map((v) => v.cible)).size, 1)
  } finally {
    rmSync(racine, { recursive: true, force: true })
  }
})

// ── l'arbre RÉEL ──────────────────────────────────────────────────────────────

test('le dépôt n’a AUCUN importeur de feuille, et la garde lit bien ses sources', () => {
  const vu = manquementsDeFeuilles()
  assert.deepEqual(vu.manquements, [])
  // Sans cette borne, une lecture cassée rendrait la garde verte en ne lisant plus rien.
  assert.ok(vu.sourcesLues > 1000, `la garde ne lit plus les sources du dépôt (${vu.sourcesLues})`)
})

test('les feuilles DÉCLARÉES sont une donnée, et chacune dit son invariant', () => {
  assert.ok(FEUILLES.length >= 1)
  const suivies = sourcesSuivies()
  for (const f of FEUILLES) {
    assert.ok(suivies.includes(f.module), `${f.module} n’est pas une source suivie`)
    assert.ok(f.pourquoi.trim(), `${f.module} sans invariant dit`)
    for (const banc of f.bancs) assert.ok(suivies.includes(banc), `${banc} n’est pas une source suivie`)
  }
})
