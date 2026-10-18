// CLÔTURE des ÉTAPES du train (#1806), gardée contre une retouche de bonne foi : une étape n'atteint
// aucun LANCEMENT de processus hors de son contexte.
//   node --test scripts/ops/etapesDuTrain.test.mjs   (chaîné dans `npm run test:ops`)
//
// La frontière est une CAPACITÉ, pas un nom. Sur la clôture d'imports de `etapesDuTrain.mjs`
// (`clotureDImports`, `importGraph.mjs`), un point fixe INTER-MODULES calcule les liaisons qui
// atteignent un lancement. Les SOURCES de capacité d'un module, chacune avec sa règle (une source
// neuve = une ligne) :
//   | source                          | règle                                                        |
//   | import d'un module intégré      | lanceur hors de la liste blanche `INERTES` (module, nom)     |
//   | import d'un paquet              | lanceur : sa source n'est pas lue                            |
//   | import d'un module du dépôt     | lanceur si le module l'exporte lanceur (point fixe) ;        |
//   |                                 | lanceur s'il n'est pas lu (JSON, `.cjs`, `.cts`)             |
//   | import dynamique, `require`     | déclaration RACINE                                           |
//   | `createRequire`, `getBuiltinModule`, `binding` | déclaration RACINE (`MENTIONS`)               |
//   | accès ambiant (global lu)       | déclaration RACINE hors de la liste blanche `AMBIANTS_INERTES` |
//   | évaluation (`eval`, `Function`) | accès ambiant, jamais inerte                                 |
//   | `import.meta`                   | inerte (`url`, `resolve`, `dirname`, `filename`)             |
// Une déclaration de tête qui référence une liaison lanceuse l'est à son tour, et tout export qui en
// porte une. Le module des étapes n'en acquiert aucune et ne lit aucun accès ambiant. Résidu que ce
// test ne garde pas : évaluation par `.constructor`, état mutable posé par un autre module, effet au
// chargement d'un module de la clôture (#2073).
import test from 'node:test'
import assert from 'node:assert/strict'
import { resolve } from 'node:path'
import { posix, lanceursDeLaCloture } from '../test/lib/bancEtapesDuTrain.mjs'

test('le point fixe suit le RANGEMENT, le ré-export, l’espace de noms et le défaut, d’un module à l’autre ; une liaison intégrée hors de `INERTES` lance, un global lu hors de `AMBIANTS_INERTES` aussi', () => {
  const sources = new Map()
  const ecrire = (nom, texte) => { sources.set(posix(resolve('/banc', nom)), texte); return resolve('/banc', nom) }
  const disque = { lire: (chemin) => sources.get(posix(chemin)), existe: (chemin) => sources.has(posix(chemin)) }
  const a = ecrire('a.mjs', [
    "import { spawnSync } from 'node:child_process'",
    'const REGISTRE = []',
    'export function enregistrer() { REGISTRE.push(spawnSync) }',
    'export const premier = () => REGISTRE[0]',
    'export const pur = (x) => x + 1',
    'export { REGISTRE as alias }',
    'export default function () { return spawnSync }',
  ].join('\n'))
  const b = ecrire('b.mjs', "export * from './a.mjs'\nexport { default as defaut } from './a.mjs'\nexport const inerte = 1\n")
  const c = ecrire('c.mjs', "import * as tout from './b.mjs'\nimport { pur } from './b.mjs'\nexport const viaEspace = () => tout\nexport const viaPur = () => pur(1)\n")
  const d = ecrire('d.mjs', [
    "import { readFileSync, writeFileSync } from 'node:fs'",
    "import fs from 'fs'",
    "import * as chemin from 'node:path'",
    "import { execve } from 'node:process'",
    'export const lit = (f) => readFileSync(f)',
    "export const ecrit = (f) => writeFileSync(f, '')",
    'export const parDefaut = () => fs',
    'export const joint = (x) => chemin.join(x)',
    "export const remplace = () => execve('/bin/true')",
  ].join('\n'))
  const e = ecrire('e.mjs', "export * from 'node:path'\n")
  const f = ecrire('f.mjs', "export * from 'node:fs'\n")
  const g = ecrire('g.mjs', [
    'export const env = () => process',
    'export const appel = (u) => fetch(u)',
    'export const evalue = (t) => globalThis[t]',
    'export const masque = (fetch) => fetch(1)',
    'export const cle = () => ({ process: 1 }).process',
    'export const inerte = (x) => JSON.stringify(new Map([[x, Date.now()]]))',
    'export { masque as fetch }',
    'export const etiq = () => { process: for (;;) break process; return 1 }',
    'export const pris = () => { try { return 1 } catch (fetch) { return fetch } }',
    'export const nommee = class fetch { m() { return fetch } }',
  ].join('\n'))
  const { exportsLanceurs } = lanceursDeLaCloture([a, b, c, d, e, f, g], disque)
  const de = (m) => [...exportsLanceurs.get(posix(m))].sort()
  assert.deepEqual(de(a), ['alias', 'default', 'enregistrer', 'premier'])
  assert.deepEqual(de(b), ['alias', 'defaut', 'enregistrer', 'premier'])
  assert.deepEqual(de(c), ['viaEspace'])
  assert.deepEqual(de(d), ['ecrit', 'parDefaut', 'remplace'])
  assert.deepEqual(de(e), [])
  assert.deepEqual(de(f), ['*'])
  assert.deepEqual(de(g), ['appel', 'env', 'evalue'])
})
