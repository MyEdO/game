// LES PAQUETS D'OUTILLAGE D'UNE ZONE QUI SURVIT (#2972, `paquetsDOutillage`, `couches.mjs`) : sur l'oracle de
// `paquetFerme` puis sur le mur réel (`murs/purete-imports`, `couchesLint.mjs`), un paquet de l'hôte web déclaré pour un
// dossier d'outillage passe sous ce dossier seul ; hors de lui, dans la même zone, il reste refusé. Le banc complet des
// murs : `src/eslint-ordre-total-et-purete.test.ts`.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync, statSync } from 'node:fs'
import { COUCHES, PAQUETS_DE_L_HOTE_WEB, paquetFerme, zoneDe } from './couches.mjs'
import { lintFixtures, selectionnerMessages } from './lint.testkit.mjs'

const RACINE = new URL('../../../', import.meta.url)
const EVALUATEUR = 'hotes/godot/asset/evaluateur/'

test('CONTRAT : chaque dossier d’outillage existe, finit par `/`, est à sa zone, qui survit, et n’ouvre que des paquets de l’hôte web dépendances du dépôt', () => {
  const { dependencies = {}, devDependencies = {} } = JSON.parse(readFileSync(new URL('package.json', RACINE), 'utf8'))
  const declarations = Object.entries(COUCHES).flatMap(([zone, ligne]) => Object.entries(ligne.paquetsDOutillage ?? {}).map(([dossier, paquets]) => ({ zone, dossier, paquets })))
  assert.ok(declarations.some((d) => d.dossier === EVALUATEUR), 'la déclaration de l’évaluateur est absente : le banc ne mesure rien')
  for (const { zone, dossier, paquets } of declarations) {
    assert.ok(dossier.endsWith('/'), dossier)
    assert.ok(existsSync(new URL(dossier, RACINE)) && statSync(new URL(dossier, RACINE)).isDirectory(), dossier)
    assert.equal(zoneDe(`${dossier}x.ts`), zone, dossier)
    assert.equal(COUCHES[zone].survit, true, zone)
    for (const p of paquets) {
      assert.ok(PAQUETS_DE_L_HOTE_WEB.includes(p), `${dossier} : ${p} n’est pas un paquet de l’hôte web`)
      assert.ok(p in dependencies || p in devDependencies, `${dossier} : ${p} n’est pas une dépendance`)
    }
  }
})

test('ORACLE : `paquetFerme` ouvre `three` sous le dossier de l’évaluateur seul', () => {
  const cas = [
    ['hotes', 'three', `${EVALUATEUR}chargement.ts`, false],
    ['hotes', 'react', `${EVALUATEUR}chargement.ts`, true],
    ['hotes', 'three', 'hotes/godot/asset/glb.ts', true],
    ['hotes', 'three', 'hotes/godot/asset/evaluateur.ts', true],
    ['hotes', 'three', 'hotes/godot/construire.mjs', true],
    ['hotes', 'three', undefined, true],
    ['noyau', 'three', `${EVALUATEUR}chargement.ts`, true],
  ]
  assert.deepEqual(cas.map(([de, p, imp]) => paquetFerme(de, p, imp)), cas.map(([, , , v]) => v))
})

test('MUR : un `import \'three\'` passe sous le dossier de l’évaluateur, et reste refusé ailleurs dans `hotes/`', () => {
  const code = "import { Mesh } from 'three';\nexport const m = Mesh;\n"
  const fixtures = [
    { filePath: `${EVALUATEUR}zz-couche-0.ts`, code },
    { filePath: `${EVALUATEUR}gardes/zz-couche-1.ts`, code },
    { filePath: 'hotes/godot/asset/zz-couche-2.ts', code },
    { filePath: 'hotes/godot/zz-couche-3.ts', code },
  ]
  const verdicts = lintFixtures(fixtures).map((r) => selectionnerMessages(r, (m) => m.message.includes('Paquet d’hôte')).map((m) => m.ruleId).join('+') || 'passe')
  assert.deepEqual(verdicts, ['passe', 'passe', 'murs/purete-imports', 'murs/purete-imports'])
})
