// LES OUTILLAGES D'UNE ZONE QUI SURVIT (#2972, `outillage` et `paquetsDOutillage`, `couches.mjs`) : sur les oracles de
// `couvre`, `paquetFerme` et `outillageAtteint` puis sur le mur réel (`murs/purete-imports`, `couchesLint.mjs`), un
// paquet de l'hôte web déclaré pour un outillage passe sous lui seul ; hors de lui, dans la même zone, il reste refusé,
// et aucun module de la zone hors de lui ne l'importe. Le banc complet des murs : `src/eslint-ordre-total-et-purete.test.ts`.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync, statSync } from 'node:fs'
import { COUCHES, PAQUETS_DE_L_HOTE_WEB, couvre, outillageAtteint, paquetFerme, zoneDe } from './couches.mjs'
import { lintFixtures, selectionnerMessages } from './lint.testkit.mjs'

const RACINE = new URL('../../../', import.meta.url)
const EVALUATEUR = 'hotes/godot/asset/evaluateur/'

test('CONTRAT : chaque clé d’outillage existe à sa forme (dossier si finie par `/`, fichier sinon), est à sa zone, qui survit, et les paquets d’outillage sont des paquets de l’hôte web dépendances du dépôt', () => {
  const { dependencies = {}, devDependencies = {} } = JSON.parse(readFileSync(new URL('package.json', RACINE), 'utf8'))
  const declarations = Object.entries(COUCHES).flatMap(([zone, ligne]) => ['outillage', 'paquetsDOutillage'].flatMap((table) => Object.entries(ligne[table] ?? {}).map(([cle, valeurs]) => ({ zone, table, cle, valeurs }))))
  assert.ok(declarations.some((d) => d.table === 'paquetsDOutillage' && d.cle === EVALUATEUR), 'la déclaration de l’évaluateur est absente : le banc ne mesure rien')
  assert.ok(declarations.some((d) => d.table === 'outillage'), 'aucun `outillage` : le banc ne mesure rien')
  for (const { zone, table, cle, valeurs } of declarations) {
    const dossier = cle.endsWith('/')
    assert.ok(existsSync(new URL(cle, RACINE)) && statSync(new URL(cle, RACINE)).isDirectory() === dossier, `${table} ${cle}`)
    assert.equal(zoneDe(dossier ? `${cle}x.ts` : cle), zone, cle)
    assert.equal(COUCHES[zone].survit, true, zone)
    if (table !== 'paquetsDOutillage') continue
    for (const p of valeurs) {
      assert.ok(PAQUETS_DE_L_HOTE_WEB.includes(p), `${cle} : ${p} n’est pas un paquet de l’hôte web`)
      assert.ok(p in dependencies || p in devDependencies, `${cle} : ${p} n’est pas une dépendance`)
    }
  }
})

test('ORACLE : `couvre` lit une clé finie par `/` comme un dossier, sinon comme un fichier exact', () => {
  const cas = [
    [EVALUATEUR, `${EVALUATEUR}evaluer.ts`, true],
    [EVALUATEUR, `${EVALUATEUR}gardes/poids.ts`, true],
    [EVALUATEUR, 'hotes/godot/asset/evaluateur.ts', false],
    [EVALUATEUR, 'hotes/godot/asset/evaluateur', false],
    ['hotes/godot/asset/charger.mjs', 'hotes/godot/asset/charger.mjs', true],
    ['hotes/godot/asset/charger.mjs', 'hotes/godot/asset/charger.mjs.bak', false],
    ['hotes/godot/asset/charger', 'hotes/godot/asset/charger/x.mjs', false],
  ]
  assert.deepEqual(cas.map(([cle, rel]) => couvre(cle, rel)), cas.map(([, , v]) => v))
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

test('ORACLE : `outillageAtteint` nomme l’outillage qu’un module de la zone hors de lui importe, `null` sinon', () => {
  const cas = [
    ['hotes', 'hotes/godot/asset/importer.ts', `${EVALUATEUR}evaluer`, EVALUATEUR],
    ['hotes', 'hotes/godot/asset/evaluateur.ts', `${EVALUATEUR}gardes/poids.ts`, EVALUATEUR],
    ['hotes', `${EVALUATEUR}evaluer.ts`, `${EVALUATEUR}gardes/poids`, null],
    ['hotes', `${EVALUATEUR}gardes/poids.ts`, `${EVALUATEUR}ecart`, null],
    ['hotes', `${EVALUATEUR}evaluer.ts`, 'hotes/godot/asset/glb', null],
    ['hotes', 'hotes/godot/asset/importer.ts', 'hotes/godot/asset/glb', null],
    ['noyau', 'hotes/godot/asset/importer.ts', `${EVALUATEUR}evaluer`, null],
  ]
  assert.deepEqual(cas.map(([de, imp, cible]) => outillageAtteint(de, imp, cible)), cas.map(([, , , v]) => v))
})

/** Le verdict de chaque fixture pour les messages qui contiennent `marque` : la règle, ou `passe`. */
const verdicts = (fixtures, marque) => lintFixtures(fixtures).map((r) => selectionnerMessages(r, (m) => m.message.includes(marque)).map((m) => m.ruleId).join('+') || 'passe')

test('MUR : un `import \'three\'` passe sous le dossier de l’évaluateur, et reste refusé ailleurs dans `hotes/`', () => {
  const code = "import { Mesh } from 'three';\nexport const m = Mesh;\n"
  const fixtures = [
    { filePath: `${EVALUATEUR}zz-couche-0.ts`, code },
    { filePath: `${EVALUATEUR}gardes/zz-couche-1.ts`, code },
    { filePath: 'hotes/godot/asset/zz-couche-2.ts', code },
    { filePath: 'hotes/godot/zz-couche-3.ts', code },
  ]
  assert.deepEqual(verdicts(fixtures, 'Paquet d’hôte'), ['passe', 'passe', 'murs/purete-imports', 'murs/purete-imports'])
})

test('MUR : un module de `hotes/` hors du dossier de l’évaluateur ne l’importe pas, en valeur comme en type ; sous le dossier, un voisin passe', () => {
  const fixtures = [
    { filePath: 'hotes/godot/asset/zz-inverse-0.ts', code: "import { evaluer } from './evaluateur/evaluer';\nexport const e = evaluer;\n" },
    { filePath: 'hotes/godot/asset/zz-inverse-1.ts', code: "import type { Ecart } from './evaluateur/ecart';\nexport type E = Ecart;\n" },
    { filePath: `${EVALUATEUR}zz-inverse-2.ts`, code: "import { evaluer } from './evaluer';\nimport type { Ecart } from './ecart';\nexport const e = evaluer;\nexport type E = Ecart;\n" },
    { filePath: `${EVALUATEUR}gardes/zz-inverse-3.ts`, code: "import { evaluer } from '../evaluer';\nexport const e = evaluer;\n" },
  ]
  assert.deepEqual(verdicts(fixtures, 'Outillage atteint'), ['murs/purete-imports', 'murs/purete-imports', 'passe', 'passe'])
})
