// `versionsNonDerivees` (#2226) : les quatre prédicats sur des fichiers fabriqués, puis sur `src/` ;
// la collision de deux migrations de même clé, au compilateur.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { resolve } from 'node:path'
import { readCorpus } from './sourceCorpus.mjs'
import { repoProgram } from './tsProgram.mjs'
import { relevePerimetre, versionsNonDerivees } from './versionsDerivees.mjs'

const PRIMITIVE = { rel: 'src/lib/versionCourante.ts', text: 'export function versionCourante(t) { return 0 }\n' }
const IDB = { rel: 'src/lib/indexedDb.ts', text: `import { versionCourante } from './versionCourante';
export function accesBase(base) { return versionCourante(base.migrations) }` }
const juge = (fichiers) => versionsNonDerivees([PRIMITIVE, ...fichiers])
const f = (rel, text) => ({ rel, text })

test('P1 : `z.literal` d’un champ de version prend une version dérivée — contrat positif', () => {
  const derive = f('src/a.ts', `import { versionCourante } from './lib/versionCourante';
const T = { 1: 'a', 2: 'b' } as const;
export const S = versionCourante(T);
export const d = { schema: z.literal(S) };`)
  assert.deepEqual(juge([derive]).P1, [])
  const importe = f('src/b.ts', `import { S } from './a';\nexport const d = { version: z.literal(S) };`)
  assert.deepEqual(juge([derive, importe]).P1, [])
  const litteral = f('src/c.ts', 'const S = 17;\nexport const d = { schema: z.literal(S) };')
  assert.deepEqual(juge([litteral]).P1, ['src/c.ts:2 — `schema: z.literal(S)` ne prend pas une version dérivée par `versionCourante`'])
  assert.equal(juge([f('src/d.ts', 'export const d = { schema: z.literal(17) };')]).P1.length, 1)
  assert.deepEqual(juge([f('src/e.ts', "export const d = { kind: 'export', v: z.literal(7) };")]).P1, ['src/e.ts:1 — `v: z.literal(7)` ne prend pas une version dérivée par `versionCourante`'])
  assert.deepEqual(juge([f('src/g.ts', 'export const d = { v: z.literal(7) };')]).P1, [], '`v` sans étiquette de forme persistée n’est pas un champ de version')
})

test('P2 : aucun champ de version initialisé par un nombre littéral, quelle que soit sa syntaxe', () => {
  const r = juge([f('src/a.ts', `export const a = { version: 3, schema: 4 as const, versionContenu: 1 };
export const g = { ['version']: 5 };
export class H { readonly version = 6; }
export const i = { version: +7, schema: -1 };
export function l(d: { version: number }) { d.version = 8; d['schema'] = 9; }
export const k = { kind: 'export', v: 2 };`)])
  assert.deepEqual(r.P2, [
    'src/a.ts:1 — `schema: 4`', 'src/a.ts:1 — `version: 3`',
    'src/a.ts:2 — `version: 5`',
    'src/a.ts:3 — `version: 6`',
    'src/a.ts:4 — `schema: -1`', 'src/a.ts:4 — `version: +7`',
    'src/a.ts:5 — `schema: 9`', 'src/a.ts:5 — `version: 8`',
    'src/a.ts:6 — `v: 2`',
  ].sort())
  assert.deepEqual(juge([f('src/b.ts', 'export const p = { u: 1, v: 0 };\nexport class C { v = 0; }\nexport function m(o) { o.v = 1; }')]).P2, [], '`v` d’un vecteur ou d’une cellule')
})

test('P3 : aucune `const` numérique littérale n’initialise `version`, `v` ou `schema`, de module, importée, locale ou abrégée', () => {
  const a = f('src/a.ts', 'export const FORMAT = 5;')
  const b = f('src/b.ts', `import { FORMAT } from './a';
export const x = { v: FORMAT };
const version = 2;
export const y = { version };
export const z = { autre: FORMAT };
export function k() { const VERSION = -3; return { version: VERSION }; }`)
  assert.deepEqual(juge([a, b]).P3, [
    'src/b.ts:2 — `v` initialisé par `FORMAT = 5`',
    'src/b.ts:4 — `version` initialisé par `version = 2`',
    'src/b.ts:6 — `version` initialisé par `VERSION = -3`',
  ])
})

test('P4 : une table atteint `versionCourante` directement ou par le paramètre d’une fonction qui la transmet', () => {
  const porte = f('src/porte.ts', `import { versionCourante } from './lib/versionCourante';
function ouvrir(base) { return versionCourante(base.migrations) }
function relais(base) { return ouvrir(base) }
export function acces(base) { return { lire: () => relais(base) } }
export function migre(doc, table) { return versionCourante(table) }`)
  const saine = f('src/saine.ts', `import { acces, migre } from './porte';
const M = { 0: (db) => db, 1: (db) => db } satisfies X;
acces({ nom: 'b', migrations: M });
const T = { 32: '#1 a', 33: '#2 b' } as const;
migre(null, T);`)
  assert.deepEqual(juge([porte, saine]).P4, [])
  const fautive = f('src/fautive.ts', `import { acces, migre } from './porte';
import { versionCourante } from './lib/versionCourante';
const TROU = { 1: 'a', 3: 'b' };
acces({ nom: 'b', migrations: TROU });
const DOUBLE = { 1: '#1 a', 2: '#1 a' } as const;
migre(null, DOUBLE);
const BASE = { 1: 'x' };
const SPREAD = { ...BASE, 2: 'y' };
versionCourante(SPREAD);
const CALC = { [1]: 'x' };
versionCourante(CALC);
versionCourante({});
const CHAINE = { '1': 'x' };
versionCourante(CHAINE);`)
  assert.deepEqual(juge([porte, fautive]).P4, [
    'src/fautive.ts:12 — table vide',
    'src/fautive.ts:13 — clé non numérique « \'1\' »',
    'src/fautive.ts:3 — clés non contiguës (1, 3)',
    'src/fautive.ts:5 — valeurs de migration en double',
    'src/fautive.ts:8 — spread',
    'src/fautive.ts:10 — clé calculée',
  ].sort())
})

test('P4 : un paramètre logé dans un littéral objet se suit, sans faux positif', () => {
  const enveloppe = f('src/enveloppe.ts', `import { accesBase } from './lib/indexedDb';
export function maBase(migrations) { return accesBase({ nom: 'x', migrations }) }`)
  assert.deepEqual(juge([IDB, enveloppe, f('src/saine.ts', "import { maBase } from './enveloppe';\nconst SAINE = { 0: () => {} };\nmaBase(SAINE);")]).P4, [])
  assert.deepEqual(juge([IDB, enveloppe, f('src/trou.ts', "import { maBase } from './enveloppe';\nconst TROU = { 0: () => {}, 2: () => {} };\nmaBase(TROU);")]).P4,
    ['src/trou.ts:2 — clés non contiguës (0, 2)'])
})

test('P4 : un alias `const` et un import d’espace de noms atteignent la fonction qu’ils nomment', () => {
  const alias = f('src/alias.ts', `import { accesBase } from './lib/indexedDb';
const ouvrir = accesBase;
const TROU = { 0: () => {}, 2: () => {} };
ouvrir({ nom: 'x', migrations: TROU });`)
  const espace = f('src/espace.ts', `import * as idb from './lib/indexedDb';
const TROU = { 0: () => {}, 2: () => {} };
idb.accesBase({ nom: 'x', migrations: TROU });`)
  const primitive = f('src/vc.ts', `import { versionCourante as vc } from './lib/versionCourante';
const TROU = { 0: 'a', 2: 'b' };
export const V = vc(TROU);`)
  assert.deepEqual(juge([IDB, alias, espace, primitive]).P4, [
    'src/alias.ts:3 — clés non contiguës (0, 2)',
    'src/espace.ts:2 — clés non contiguës (0, 2)',
    'src/vc.ts:2 — clés non contiguës (0, 2)',
  ])
})

test('P4 : le point fixe termine sur une fonction récursive, et le chemin hors borne est une faute à son site', () => {
  const rec = f('src/rec.ts', `import { versionCourante } from './lib/versionCourante';
export function f(x) { if (x.suite) f(x.suite); return versionCourante(x.m); }
const T = { 0: 'a', 1: 'b' };
f({ m: T });`)
  assert.deepEqual(juge([rec]).P4, [
    'src/rec.ts:2 — chemin vers `versionCourante` plus profond que tout littéral objet du corpus (2) : sa table n\'est pas vérifiable',
    'src/rec.ts:4 — aucun littéral objet ne porte `suite.m`',
  ])
})

test('P4 : la profondeur du graphe est la même pour des objets inline, factorisés, abrégés ou importés', () => {
  const porte = "import { versionCourante } from './lib/versionCourante';\nfunction f(x) { return versionCourante(x.suite.m) }\n"
  for (const corps of [
    "f({ suite: { m: { 0: 'a' } } });",
    "const T = { 0: 'a' }; const B = { m: T }; const A = { suite: B }; f(A);",
    "const m = { 0: 'a' }; const suite = { m }; const A = { suite }; f(A);",
    "import { A } from './objets'; f(A);",
  ]) {
    assert.deepEqual(juge([f('src/a.ts', porte + corps), f('src/objets.ts', "const T = { 0: 'a' }; const B = { m: T }; export const A = { suite: B };")]).P4, [], corps)
  }
})

test('P4 : un cycle de références de littéraux termine sans masquer une table accessible', () => {
  const cycle = f('src/a.ts', `import { versionCourante } from './lib/versionCourante';
const A = { suite: B };
const B = { suite: A, m: { 0: 'a' } };
function f(x) { return versionCourante(x.suite.m) }
f(A);`)
  assert.deepEqual(juge([cycle]).P4, [])
})

test('P3 : une liaison proche masque la const externe, et la vraie const locale reste jugée', () => {
  for (const corps of [
    'function f(V) { return { version: V } }',
    'function f({ V }) { return { version: V } }',
    'function f() { let V; return { version: V } }',
    'function f() { if (true) { var V; } return { version: V } }',
    'try {} catch (V) { const x = { version: V }; }',
    'for (let V of []) { const x = { version: V }; }',
    '{ class V {} const x = { version: V }; }',
  ]) assert.deepEqual(juge([f('src/a.ts', `const V = 2;\n${corps}`)]).P3, [], corps)
  assert.deepEqual(juge([f('src/a.ts', 'const V = 2;\nfunction f(V) { { const V = 3; return { version: V }; } }')]).P3,
    ['src/a.ts:2 — `version` initialisé par `V = 3`'])
})

test('collision : deux migrations de même clé dans une table réelle sont un TS1117, sous chacune des trois formes', () => {
  const racine = resolve(import.meta.dirname, '../../..')
  const virtuel = resolve(racine, 'src/__collision__.ts').replace(/\\/g, '/')
  const texte = `import { versionCourante } from './lib/versionCourante';
import type { MigrationMap } from './state/migrateDoc';
import type { MigrationsIdb } from './lib/indexedDb';
const SAVES = {
  58: '#1 a',
  59: '#2 b',
  59: '#3 c',
} as const;
export const S = versionCourante(SAVES);
const ROSTER = {
  6: (doc) => ({ ...doc }),
  6: (doc) => ({ ...doc, b: 2 }),
} satisfies MigrationMap;
export const R = versionCourante(ROSTER);
const IDB = { 0: () => {}, 1: (db) => db.close(), 1: (db) => db.close() } satisfies MigrationsIdb;
export const I = versionCourante(IDB);
`
  const programme = repoProgram(racine, () => [virtuel], { 'src/__collision__.ts': texte })
  const sf = programme.getSourceFile(virtuel)
  const lignes = programme.getSemanticDiagnostics(sf).filter((d) => d.code === 1117).map((d) => sf.getLineAndCharacterOfPosition(d.start).line + 1)
  assert.deepEqual(lignes, [7, 12, 15])
})

test('périmètre : `src/**` en `.ts`/`.tsx`, hors instruments, doublures et déclarations', () => {
  assert.deepEqual(
    ['src/a.ts', 'src/a.tsx', 'src/a.test.ts', 'src/a.testkit.ts', 'src/a.d.ts', 'scripts/migrations/x.mjs', 'scripts/a.ts'].map(relevePerimetre),
    [true, true, false, false, false, false, false],
  )
})

test('src/ : aucune version de forme persistée qui ne dérive pas de sa table', () => {
  assert.deepEqual(versionsNonDerivees(readCorpus(['src'])), { P1: [], P2: [], P3: [], P4: [] })
})
