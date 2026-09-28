// GARDE DE L'AIGUILLAGE DES CATALOGUES DE L'ATLAS (#1825) — `npm run test:raw`.
//
// Un catalogue est un dérivé : il est la cible de son générateur (`GENERATORS`,
// scripts/docs/build-all.mjs, qui le vérifie en `--check`), et sa fusion passe par un pilote dédié
// (`.gitattributes`, famille `docs-catalogue`). Les deux passent par un MOTIF de chemin — et un motif
// qui n'atteint plus rien ne rougit pas : une cible de générateur vide n'est vérifiée par rien, et un
// fichier sans famille de fusion se fusionne textuellement, en silence. C'est exactement ce que la
// partition de l'Atlas par cœur a produit : `docs/raw/catalogue-*.md` n'atteint plus un seul des six
// catalogues, qui vivent tous sous un dossier de cœur.
//
// CONTRAT POSITIF, jamais un littéral recopié : la population vient de la couture
// (`pagesDeLAtlas`, classe `catalogue`), le motif de la constante UNIQUE
// (`scripts/raw/motif-catalogues.mjs`), et le verdict de git lui-même — `git ls-files` pour l'arbre
// suivi, `git check-attr` pour l'aiguillage.
import test from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { pagesDeLAtlas } from './_lib.mjs'
import { correspondGlob } from '../guards/lib/lister.mjs'
import { MOTIF_CATALOGUES } from './motif-catalogues.mjs'

const ROOT = fileURLToPath(new URL('../..', import.meta.url))

/** Les catalogues que la couture énumère, en chemins de dépôt. */
const catalogues = () =>
  pagesDeLAtlas(join(ROOT, 'docs', 'raw'), { classes: ['catalogue'] }).map((p) => `docs/raw/${p.relatif}`)

/** Les fichiers SUIVIS de l'Atlas que le motif atteint, lu par la grammaire unique du dépôt. */
const atteintsParLeMotif = () =>
  execFileSync('git', ['ls-files', '--', 'docs/raw'], { cwd: ROOT, encoding: 'utf8' })
    .split('\n')
    .filter((f) => f && correspondGlob(f, MOTIF_CATALOGUES))

/** `git check-attr merge` pour un lot de chemins → Map(chemin → famille). */
function famillesDe(paths) {
  const out = execFileSync('git', ['check-attr', 'merge', '--stdin'], { cwd: ROOT, input: paths.join('\n'), encoding: 'utf8' })
  const map = new Map()
  for (const ln of out.split('\n').filter(Boolean)) {
    const m = /^(.*): merge: (.*)$/.exec(ln)
    if (m) map.set(m[1], m[2])
  }
  return map
}

test('tout catalogue de la couture est ATTEINT par le motif, cible du générateur', () => {
  const vus = catalogues()
  assert.ok(vus.length > 0, 'la couture n’énumère aucun catalogue — la garde serait verte à vide')
  const atteints = new Set(atteintsParLeMotif())
  assert.deepEqual(vus.filter((c) => !atteints.has(c)), [], `motif « ${MOTIF_CATALOGUES} »`)
})

test('le motif n’atteint RIEN d’autre que les catalogues de la couture', () => {
  const vus = new Set(catalogues())
  assert.deepEqual(atteintsParLeMotif().filter((p) => !vus.has(p)), [])
})

test('tout catalogue de la couture est aiguillé en famille de fusion `docs-catalogue`', () => {
  const vus = catalogues()
  const fam = famillesDe(vus)
  assert.deepEqual(vus.filter((c) => fam.get(c) !== 'docs-catalogue'), [])
})
