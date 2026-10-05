// GARDE DE L'AIGUILLAGE DES CATALOGUES DE L'ATLAS (#1825) — `npm run test:raw`.
//
// Un catalogue est un dérivé PUR : il est la cible de son générateur (`GENERATORS`,
// scripts/docs/build-all.mjs) par un MOTIF de chemin, et n'est pas commité (#2203). Un motif qui
// n'atteint plus rien ne rougit pas : une cible de générateur vide n'est produite par rien. C'est
// exactement ce que la partition de l'Atlas par cœur a produit : `docs/raw/catalogue-*.md` n'atteint
// plus un seul des six catalogues, qui vivent tous sous un dossier de cœur.
//
// CONTRAT POSITIF, jamais un littéral recopié : la population vient du RENDU du générateur (`rendre`
// de scripts/raw/build-catalogs.mjs), le motif de la constante UNIQUE (`scripts/raw/motif-catalogues.mjs`),
// et l'arbre suivi du verdict de git lui-même (`git ls-files`).
import test from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { rendre } from './build-catalogs.mjs'
import { correspondGlob } from '../guards/lib/lister.mjs'
import { MOTIF_CATALOGUES } from './motif-catalogues.mjs'

const ROOT = fileURLToPath(new URL('../..', import.meta.url))

test('tout catalogue RENDU est ATTEINT par le motif, cible du générateur', () => {
  const vus = [...rendre().keys()]
  assert.ok(vus.length > 0, 'le générateur ne rend aucun catalogue — la garde serait verte à vide')
  assert.deepEqual(vus.filter((c) => !correspondGlob(c, MOTIF_CATALOGUES)), [], `motif « ${MOTIF_CATALOGUES} »`)
})

test('le motif n’atteint aucun fichier SUIVI : un manuscrit qu’il toucherait serait réécrit par le générateur', () => {
  const suivis = execFileSync('git', ['ls-files', '--', 'docs/raw'], { cwd: ROOT, encoding: 'utf8' }).split('\n').filter(Boolean)
  assert.deepEqual(suivis.filter((f) => correspondGlob(f, MOTIF_CATALOGUES)), [])
})
