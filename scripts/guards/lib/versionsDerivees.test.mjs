// `versionsNonDerivees` (#2226) : les quatre prédicats sur des fichiers fabriqués, puis sur `src/`.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readCorpus } from './sourceCorpus.mjs'
import { relevePerimetre, versionsNonDerivees } from './versionsDerivees.mjs'

const PRIMITIVE = { rel: 'src/lib/versionCourante.ts', text: 'export function versionCourante(t) { return 0 }\n' }
const juge = (fichiers) => versionsNonDerivees([PRIMITIVE, ...fichiers])
const f = (rel, text) => ({ rel, text })

test('P1 : `z.literal` d’un champ `schema` ou `version` prend un compteur dérivé — contrat positif', () => {
  const derive = f('src/a.ts', `import { versionCourante } from './lib/versionCourante';
const T = { 1: 'a', 2: 'b' } as const;
export const S = versionCourante(T);
export const d = { schema: z.literal(S) };`)
  assert.deepEqual(juge([derive]).P1, [])
  const importe = f('src/b.ts', `import { S } from './a';\nexport const d = { version: z.literal(S) };`)
  assert.deepEqual(juge([derive, importe]).P1, [])
  const litteral = f('src/c.ts', 'const S = 17;\nexport const d = { schema: z.literal(S) };')
  assert.deepEqual(juge([litteral]).P1, ['src/c.ts:2 — `schema: z.literal(S)` ne prend pas un compteur dérivé par `versionCourante`'])
  assert.equal(juge([f('src/d.ts', 'export const d = { schema: z.literal(17) };')]).P1.length, 1)
})

test('P2 : aucune propriété `version`/`schema` initialisée par un nombre littéral ; `v` et les autres champs passent', () => {
  const r = juge([f('src/a.ts', 'export const a = { version: 3, schema: 4 as const, v: 2, versionContenu: 1 };')])
  assert.deepEqual(r.P2, ['src/a.ts:1 — `schema: 4`', 'src/a.ts:1 — `version: 3`'])
})

test('P3 : aucune `const` numérique littérale n’initialise `version`, `v` ou `schema`, même importée ou abrégée', () => {
  const a = f('src/a.ts', 'export const FORMAT = 5;')
  const b = f('src/b.ts', `import { FORMAT } from './a';
export const x = { v: FORMAT };
const version = 2;
export const y = { version };
export const z = { autre: FORMAT };`)
  assert.deepEqual(juge([a, b]).P3, ['src/b.ts:2 — `v` initialisé par `FORMAT = 5`', 'src/b.ts:4 — `version` initialisé par `version = 2`'])
})

test('P4 : une table atteint `versionCourante` directement ou par le paramètre d’une fonction qui la transmet', () => {
  const porte = f('src/porte.ts', `import { versionCourante } from './lib/versionCourante';
function ouvrir(base) { return versionCourante(base.montees) }
function relais(base) { return ouvrir(base) }
export function acces(base) { return { lire: () => relais(base) } }
export function migre(doc, table) { return versionCourante(table) }`)
  const saine = f('src/saine.ts', `import { acces, migre } from './porte';
const M = { 0: (db) => db, 1: (db) => db } satisfies X;
acces({ nom: 'b', montees: M });
const T = { 32: '#1 a', 33: '#2 b' } as const;
migre(null, T);`)
  assert.deepEqual(juge([porte, saine]).P4, [])
  const fautive = f('src/fautive.ts', `import { acces, migre } from './porte';
import { versionCourante } from './lib/versionCourante';
const TROU = { 1: 'a', 3: 'b' };
acces({ nom: 'b', montees: TROU });
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
    'src/fautive.ts:5 — valeurs de montée en double',
    'src/fautive.ts:8 — spread',
    'src/fautive.ts:10 — clé calculée',
  ].sort())
})

test('périmètre : `src/**` en `.ts`/`.tsx`, hors instruments, doublures et déclarations', () => {
  assert.deepEqual(
    ['src/a.ts', 'src/a.tsx', 'src/a.test.ts', 'src/a.testkit.ts', 'src/a.d.ts', 'scripts/migrations/x.mjs', 'scripts/a.ts'].map(relevePerimetre),
    [true, true, false, false, false, false, false],
  )
})

test('src/ : aucun compteur de version qui ne dérive pas de sa table', () => {
  assert.deepEqual(versionsNonDerivees(readCorpus(['src'])), { P1: [], P2: [], P3: [], P4: [] })
})
