// Banc de la gate `noyau:chargement` (#3058), sur un paquet ESM forgé sous os.tmpdir() : le module chargé en premier
// dont le cycle appelle une fonction avant que ses imports soient évalués est rouge sous Vite, un module sain passe, un
// module qui pend est nommé ; le champ exclut les tests par nature.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chargerEnPremier, erreurDe, estModuleACharger, modulesDeZone, rapportDe } from './chargement-en-premier.mjs'

/** Un paquet `{"type":"module"}` sous os.tmpdir(), effacé après le test. */
function paquet(t, fichiers) {
  const racine = mkdtempSync(join(tmpdir(), 'chargement-en-premier-banc-'))
  t.after(() => rmSync(racine, { recursive: true, force: true }))
  writeFileSync(join(racine, 'package.json'), '{"type":"module"}\n')
  for (const [nom, texte] of Object.entries(fichiers)) writeFileSync(join(racine, nom), texte)
  return racine
}

const CYCLES = {
  // a ⇄ b : `a` chargé en premier, `b` appelle `f` d'`a` pendant qu'`a` attend ses imports.
  'a.ts': "import { B } from './b';\nimport { D } from './d';\nexport function f(): number { return D; }\nexport const VIA_B: number = B;\n",
  'b.ts': "import { f } from './a';\nimport { D } from './d';\nexport const B: number = f() + D;\n",
  'd.ts': 'export const D: number = 42;\n',
  'sain.ts': 'export const SAIN: number = 1;\n',
}

test('le module chargé en premier dont le cycle appelle une fonction avant ses imports échoue ; d et sain passent ; le rapport nomme erreur et pile', async (t) => {
  const racine = paquet(t, CYCLES)
  const echecs = await chargerEnPremier(racine, ['a.ts', 'd.ts', 'sain.ts'], { parallele: 2, tailleDeLot: 2 })
  assert.deepEqual(echecs.map(({ module, erreur }) => [module, erreur]), [
    ['a.ts', "ReferenceError: Cannot access '__vite_ssr_import_1__' before initialization"],
  ])
  assert.deepEqual(echecs[0].pile.slice(0, 2), ['at f (a.ts:3:31)', 'at eval (b.ts:3:26)'])
  assert.match(rapportDe(echecs[0]), /^ {2}a\.ts : ReferenceError: .*\n {6}at f \(a\.ts:3:31\)\n/)
})

test('un module qui pend est nommé à l’échéance de son lot, et le reste du lot repart et rend son propre échec', async (t) => {
  const racine = paquet(t, { ...CYCLES, 'pend.ts': 'await new Promise(() => {});\nexport const X = 1;\n' })
  const echecs = await chargerEnPremier(racine, ['pend.ts', 'a.ts'], { parallele: 1, tailleDeLot: 2, borne: () => 20_000 })
  assert.deepEqual(echecs.map(({ module, erreur }) => [module, erreur]), [
    ['pend.ts', 'ne rend pas son verdict en 20000 ms (lot de 2)'],
    ['a.ts', "ReferenceError: Cannot access '__vite_ssr_import_1__' before initialization"],
  ])
})

test('un travailleur qui tombe APRÈS le dernier verdict de son lot fait échouer le lot', async (t) => {
  const racine = paquet(t, { 'tardif.ts': "setTimeout(() => { throw new Error('panne tardive'); }, 0);\nexport const X = 1;\n" })
  const echecs = await chargerEnPremier(racine, ['tardif.ts'], { parallele: 1, tailleDeLot: 1, borne: () => 30_000 })
  assert.deepEqual(echecs.map((e) => e.module), ['tardif.ts'])
  assert.match(echecs[0].erreur, /^travailleur en panne après le dernier verdict de son lot de 1 \(code 1\) : Error: panne tardive$/)
})

test('le champ : les sources TypeScript, hors tests, testkits et déclarations', () => {
  assert.deepEqual(
    ['a.ts', 'b.test.ts', 'c.testkit.ts', 'd.d.ts', 'e.json', 'f.tsx', 'g.mts', 'h.hors-store.test.ts', 'noyau.testkit.test.ts'].filter(estModuleACharger),
    ['a.ts', 'f.tsx', 'g.mts'],
  )
})

test('le dépôt réel : la zone `noyau` énumère ses modules, sans aucun test', () => {
  const modules = modulesDeZone(fileURLToPath(new URL('../../', import.meta.url)), 'noyau')
  assert.ok(modules.includes('src/noyau/rollFlowFactory.ts'), `rollFlowFactory hors du champ (${modules.length} modules)`)
  assert.ok(modules.every((m) => m.startsWith('src/noyau/') && estModuleACharger(m)))
})

test("la panne d'un travailleur : la ligne qui COMMENCE par une erreur nommée, jamais une ligne de code ni un chemin `…Error.ts`", () => {
  const sortie = [
    'file:///x/src/noyau/ReferenceError.ts:3',
    "  const e = new TypeError('x');",
    '            ^',
    'TypeError: __name is not a function',
    '    at y (file:///x/src/a.ts:1:1)',
  ].join('\n')
  assert.equal(erreurDe(sortie), 'TypeError: __name is not a function')
  assert.equal(erreurDe('rien\nfin\n\n'), 'fin')
  assert.equal(erreurDe('panne\n@@chargement {"module":"x.ts","echec":{"erreur":"TypeError: autre module","pile":[]}}\n'), 'panne')
  assert.equal(erreurDe(''), '(aucune sortie)')
})
