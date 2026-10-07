// `versionsNonDerivees` (#2226, #2404) : les prédicats sur des fichiers fabriqués, puis sur `src/`.
import { test, mock } from 'node:test'
import assert from 'node:assert/strict'
import { API, Snapshot } from 'typescript/unstable/sync'
import { readCorpus } from './sourceCorpus.mjs'
import { relevePerimetre, versionsNonDerivees } from './versionsDerivees.mjs'

const juge = versionsNonDerivees
const f = (rel, text) => ({ rel, text })

test('P3 : un champ `version` stampé prend un format importé du module généré — contrat positif', () => {
  const sain = f('src/state/saves.ts', `import { FORMAT_SAVE } from './formats.generated';
export const a = { version: FORMAT_SAVE };
export const b = { kind: 'x', v: FORMAT_SAVE };
export function copie(s: { version: string }) { return { version: s.version }; }
export const c = { version: calcul() };`)
  assert.deepEqual(juge([sain]).P3, [])
  const fautif = f('src/b.ts', `import { FORMAT_SAVE } from './formats.generated';
import { AUTRE } from './ailleurs';
const LOCALE = 'w4-dev';
export const a = { version: 'w4-dev' };
export const b = { version: LOCALE };
export const c = { version: AUTRE };
export const d = { kind: 'x', v: \`\${FORMAT_SAVE}-2\` };
export function e(FORMAT_SAVE: string) { return { version: FORMAT_SAVE }; }
export const g = { v: 'libre' }; export const h = { schema: 'pas une version' };`)
  assert.deepEqual(juge([fautif]).P3, [
    "src/b.ts:4 — `version: 'w4-dev'` n'est pas un format importé du module généré",
    "src/b.ts:5 — `version: LOCALE` n'est pas un format importé du module généré",
    "src/b.ts:6 — `version: AUTRE` n'est pas un format importé du module généré",
    "src/b.ts:7 — `v: `${FORMAT_SAVE}-2`` n'est pas un format importé du module généré",
    "src/b.ts:8 — `version: FORMAT_SAVE` n'est pas un format importé du module généré",
  ])
})

test('P1 : aucun champ de version initialisé par un nombre littéral, quelle que soit sa syntaxe', () => {
  const r = juge([f('src/a.ts', `export const a = { version: 3, schema: 4 as const, versionContenu: 1 };
export const g = { ['version']: 5 };
export class H { readonly version = 6; }
export const i = { version: +7, schema: -1 };
export function l(d: { version: number }) { d.version = 8; d['schema'] = 9; }
export const k = { kind: 'export', v: 2 };`)])
  assert.deepEqual(r.P1, [
    'src/a.ts:1 — `schema: 4`', 'src/a.ts:1 — `version: 3`',
    'src/a.ts:2 — `version: 5`',
    'src/a.ts:3 — `version: 6`',
    'src/a.ts:4 — `schema: -1`', 'src/a.ts:4 — `version: +7`',
    'src/a.ts:5 — `schema: 9`', 'src/a.ts:5 — `version: 8`',
    'src/a.ts:6 — `v: 2`',
  ].sort())
  assert.deepEqual(juge([f('src/b.ts', 'export const p = { u: 1, v: 0 };\nexport class C { v = 0; }\nexport function m(o) { o.v = 1; }')]).P1, [], '`v` d’un vecteur ou d’une cellule')
})

test('P2 : aucune `const` numérique littérale n’initialise `version`, `v` ou `schema`, de module, importée, locale ou abrégée', () => {
  const a = f('src/a.ts', 'export const FORMAT = 5;')
  const b = f('src/b.ts', `import { FORMAT } from './a';
export const x = { v: FORMAT };
const version = 2;
export const y = { version };
export const z = { autre: FORMAT };
export function k() { const VERSION = -3; return { version: VERSION }; }`)
  assert.deepEqual(juge([a, b]).P2, [
    'src/b.ts:2 — `v` initialisé par `FORMAT = 5`',
    'src/b.ts:4 — `version` initialisé par `version = 2`',
    'src/b.ts:6 — `version` initialisé par `VERSION = -3`',
  ])
})

test('P2 : une liaison proche masque la const externe, et la vraie const locale reste jugée', () => {
  for (const corps of [
    'function f(V) { return { version: V } }',
    'function f({ V }) { return { version: V } }',
    'type F = (V = { version: V }) => void;',
    'interface I { f(V = { version: V }): void; }',
    'function f() { let V; return { version: V } }',
    'function f() { if (true) { var V; } return { version: V } }',
    'try {} catch (V) { const x = { version: V }; }',
    'for (let V of []) { const x = { version: V }; }',
    '{ class V {} const x = { version: V }; }',
  ]) assert.deepEqual(juge([f('src/a.ts', `const V = 2;\n${corps}`)]).P2, [], corps)
  assert.deepEqual(juge([f('src/a.ts', 'const V = 2;\nfunction f(V) { { const V = 3; return { version: V }; } }')]).P2,
    ['src/a.ts:2 — `version` initialisé par `V = 3`'])
})

test('périmètre : `src/**` en `.ts`/`.tsx`, hors instruments, doublures et déclarations', () => {
  assert.deepEqual(
    ['src/a.ts', 'src/a.tsx', 'src/a.test.ts', 'src/a.testkit.ts', 'src/a.d.ts', 'scripts/migrations/x.mjs', 'scripts/a.ts'].map(relevePerimetre),
    [true, true, false, false, false, false, false],
  )
})

const observerParcours = (t, visite) => {
  const choisir = Snapshot.prototype.getDefaultProjectForFile
  t.mock.method(Snapshot.prototype, 'getDefaultProjectForFile', function (...args) {
    const projet = choisir.apply(this, args)
    const lire = projet.program.getSourceFile
    t.mock.method(projet.program, 'getSourceFile', function (...noms) {
      const sf = lire.apply(this, noms)
      if (sf) {
        const parcourir = sf.forEachChild
        t.mock.method(sf, 'forEachChild', function (...visiteurs) { return visite(() => parcourir.apply(this, visiteurs)) })
      }
      return sf
    })
    return projet
  })
}

test('corpus : une session native unique, fermée après les relevés de tous les fichiers', (t) => {
  const update = API.prototype.updateSnapshot
  const close = API.prototype.close
  let ferme = false
  const ouvertures = mock.method(API.prototype, 'updateSnapshot', function (...args) { return update.apply(this, args) })
  const fermetures = mock.method(API.prototype, 'close', function () { ferme = true; return close.call(this) })
  let parcours = 0
  observerParcours(t, parcourir => { assert.equal(ferme, false); parcours++; return parcourir() })
  try {
    assert.deepEqual(versionsNonDerivees([
      f('src/a.ts', 'export const a = { version: 1 };'),
      f('src/b.ts', 'export const b = { schema: 2 };'),
    ]), { P1: ['src/a.ts:1 — `version: 1`', 'src/b.ts:1 — `schema: 2`'], P2: [], P3: [] })
    assert.equal(ouvertures.mock.callCount(), 1)
    assert.equal(fermetures.mock.callCount(), 1)
    assert.ok(parcours > 0)
    assert.equal(ferme, true)
  } finally { fermetures.mock.restore(); ouvertures.mock.restore() }
})

test('corpus : vide ou intégralement exclu n’ouvre aucune session', () => {
  const ouvertures = mock.method(API.prototype, 'updateSnapshot', () => { assert.fail('session native inattendue') })
  try {
    for (const corpus of [[], [f('src/a.test.ts', 'const a = { version: 1 };'), f('src/a.d.ts', 'declare const a: number;'), f('scripts/a.ts', 'const a = { schema: 1 };')]]) {
      assert.deepEqual(versionsNonDerivees(corpus), { P1: [], P2: [], P3: [] })
    }
    assert.equal(ouvertures.mock.callCount(), 0)
  } finally { ouvertures.mock.restore() }
})

test('corpus : basenames identiques, les imports gardent leurs chemins relatifs exacts', () => {
  const corpus = [
    f('src/gauche/base.ts', 'export const V = 3;'),
    f('src/droite/base.ts', 'export const V = 4;'),
    f('src/gauche/app.ts', "import { V } from './base'; export const d = { version: V };"),
    f('src/droite/app.ts', "import { V } from './base'; export const d = { schema: V };"),
  ]
  assert.deepEqual(juge(corpus), {
    P1: [],
    P2: ['src/droite/app.ts:1 — `schema` initialisé par `V = 4`', 'src/gauche/app.ts:1 — `version` initialisé par `V = 3`'],
    P3: ["src/gauche/app.ts:1 — `version: V` n'est pas un format importé du module généré"],
  })
})

test('corpus : fautes d’analyse et de fermeture conservent leurs identités, session fermée une fois', (t) => {
  const analyse = { phase: 'analyse' }
  const fermeture = { phase: 'fermeture' }
  observerParcours(t, () => { throw analyse })
  const close = API.prototype.close
  const fermetures = mock.method(API.prototype, 'close', function () { close.call(this); throw fermeture })
  try {
    assert.throws(() => versionsNonDerivees([f('src/a.ts', 'export const a = { version: 1 };')]), erreur => {
      assert.ok(erreur instanceof AggregateError)
      assert.equal(erreur.errors.length, 2)
      assert.equal(erreur.errors[0], analyse)
      assert.equal(erreur.errors[1], fermeture)
      assert.equal(erreur.cause, analyse)
      return true
    })
    assert.equal(fermetures.mock.callCount(), 1)
  } finally { fermetures.mock.restore() }
})

test('src/ : aucune version de forme persistée écrite à la main', () => {
  assert.deepEqual(versionsNonDerivees(readCorpus(['src'])), { P1: [], P2: [], P3: [] })
})
