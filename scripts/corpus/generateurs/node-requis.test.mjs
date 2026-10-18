// Porte de version de Node (#1801), câblage des modules Node de `scripts/node-requis.test.mjs` :
//     sa clôture STATIQUE lue ne porte ni module TypeScript ni attribut d'import (Node < 22.18, < 20.10) ;
//     son AST pose la porte en PREMIÈRE requête de module, donc avant toute autre évaluation.
import { ast } from '../../guards/lib/dialecte.mjs'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { typescript } from '../../guards/lib/dialecte.mjs'
import { clotureDImports, estModule } from '../../guards/lib/importGraph.mjs'
import { RACINE, SCRIPTS, PILOTES, MODULES_LANCES } from '../../test/lib/bancNodeRequis.mjs'

/** Le point d'entrée commun des hooks d'outil (#2187) : il charge la porte par `import()`, après le verrou d'outillage. */
const BARRIERE = 'scripts/hooks/barriere-outil.mjs'

test('clôture STATIQUE de `npm run gates`, des `.mjs` des hooks shell, des pilotes de fusion et des hooks d’agent : aucun module TypeScript, aucun attribut d’import', () => {
  const ts = typescript()
  const cache = new Map()
  const fautes = []
  for (const module of MODULES_LANCES) {
    for (const rel of clotureDImports([module], { racine: RACINE, cache, dynamiques: false })) {
      if (/\.[cm]?tsx?$/.test(rel)) {
        fautes.push(`${module} > ${rel} : module TypeScript`)
        continue
      }
      if (!estModule(rel)) continue
      const chemin = join(RACINE, rel)
      const source = ast({ rel: chemin, text: readFileSync(chemin, 'utf8') })
      for (const s of source.statements) {
        if ((ts.isImportDeclaration(s) || ts.isExportDeclaration(s)) && s.attributes) {
          fautes.push(`${module} > ${rel}:${source.getLineAndCharacterOfPosition(s.getStart()).line + 1} : attribut d’import`)
        }
      }
    }
  }
  assert.deepEqual(fautes, [])
})

test('câblage de `npm run gates`, des `.mjs` des hooks shell, des pilotes de fusion et des hooks d’agent : la PREMIÈRE requête de module de chacun est la porte', () => {
  assert.ok(PILOTES.length, `aucun pilote de fusion lu dans postinstall : ${SCRIPTS.postinstall}`)
  const ts = typescript()
  for (const module of MODULES_LANCES) {
    const chemin = join(RACINE, module)
    const source = ast({ rel: chemin, text: readFileSync(chemin, 'utf8') })
    const premiere = source.statements.find((s) => (ts.isImportDeclaration(s) || ts.isExportDeclaration(s)) && s.moduleSpecifier)
    const versDepuis = (de, cible) => {
      const rel = relative(dirname(join(RACINE, de)), join(RACINE, cible)).replaceAll('\\', '/')
      return rel.startsWith('.') ? rel : `./${rel}`
    }
    if (premiere?.moduleSpecifier.text === versDepuis(module, BARRIERE)) {
      const statiques = ast({ rel: join(RACINE, BARRIERE), text: readFileSync(join(RACINE, BARRIERE), 'utf8') }).statements
        .filter((s) => ts.isImportDeclaration(s)).map((s) => s.moduleSpecifier.text)
      assert.deepEqual(statiques.filter((m) => !m.startsWith('node:')), [], `${BARRIERE} : des modules intégrés seulement`)
      const dynamiques = [...readFileSync(join(RACINE, BARRIERE), 'utf8').matchAll(/await import\('([^']+)'\)/g)].map((m) => m[1])
      assert.equal(dynamiques[1], versDepuis(BARRIERE, 'scripts/node-requis.mjs'), `${BARRIERE} : la porte, premier chargement après le verrou d'outillage`)
      continue
    }
    assert.equal(premiere?.moduleSpecifier.text, versDepuis(module, 'scripts/node-requis.mjs'), module)
    assert.equal(premiere.importClause, undefined, `${module} : la porte s’importe pour son seul effet d’évaluation`)
  }
})
