// #2726 B1 : chaque refus d'appel d'outil porte `[catégorie · retentable]`.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { CATEGORIES_DE_REFUS, prefixeDeRefus } from './categorieDeRefus.mjs'
import { PREFIXES_DE_REFUS } from '../../hooks/barriere-outil.mjs'
import { REGISTRE } from '../../hooks/registre.mjs'
import { PROJECTION } from './contratGarde.mjs'
import { listerDossier } from './lister.mjs'

test('seul un refus transitoire est retentable', () => {
  assert.deepEqual(Object.keys(CATEGORIES_DE_REFUS).map(prefixeDeRefus), [
    '[transitoire · retentable]', '[validation · non retentable]', '[métier · non retentable]', '[permission · non retentable]', '[panne · non retentable]',
  ])
  assert.throws(() => prefixeDeRefus('inconnue'), /catégorie de refus inconnue : inconnue/)
})

test('la barrière préfixe ses refus comme `prefixeDeRefus`', () => {
  for (const [categorie, prefixe] of Object.entries(PREFIXES_DE_REFUS)) assert.equal(prefixe, prefixeDeRefus(categorie))
})

const HOOKS = fileURLToPath(new URL('../../hooks/', import.meta.url))
const SOURCES = new Map(listerDossier(HOOKS).filter((f) => f.endsWith('.mjs') && !f.endsWith('.test.mjs')).map((f) => [f.replace(/(-guard)?\.mjs$/, ''), readFileSync(join(HOOKS, f), 'utf8')]))

test('une garde du registre déclare une catégorie connue si et seulement si son module peut refuser', () => {
  for (const garde of Object.values(REGISTRE).flat().filter((g) => g.role !== PROJECTION)) {
    const source = SOURCES.get(garde.nom)
    assert.ok(source, `${garde.nom} : aucun module scripts/hooks/${garde.nom}[-guard].mjs`)
    const refuse = /decision: 'deny'|verdictDe\(/.test(source)
    if (refuse) assert.ok(Object.hasOwn(CATEGORIES_DE_REFUS, garde.categorie), `${garde.nom} refuse sans catégorie connue (${garde.categorie})`)
    else assert.equal(garde.categorie, undefined, `${garde.nom} ne refuse jamais : aucune catégorie`)
  }
})
