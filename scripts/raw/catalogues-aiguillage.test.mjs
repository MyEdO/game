// GARDE DE L'AIGUILLAGE DES CATALOGUES DE L'ATLAS (#1825) — `npm run test:raw`.
//
// Un catalogue est un dérivé : sa fraîcheur se confronte par une gate MUTANTE (régénérer, puis
// `git diff --exit-code` sur un PATHSPEC), et sa fusion passe par un pilote dédié
// (`.gitattributes`, famille `docs-catalogue`). Les deux passent par un MOTIF de chemin — et un
// motif qui n'atteint plus rien ne rougit pas : `git diff --exit-code` sur un ensemble vide rend 0,
// et un fichier sans famille de fusion se fusionne textuellement, en silence. C'est exactement ce
// que la partition de l'Atlas par cœur a produit : `docs/raw/catalogue-*.md` n'atteint plus un seul
// des six catalogues, qui vivent tous sous un dossier de cœur.
//
// CONTRAT POSITIF, jamais un littéral recopié : la population vient de la couture
// (`pagesDeLAtlas`, classe `catalogue`), le motif de la constante UNIQUE
// (`scripts/raw/gate-catalogues.mjs`), et le verdict de git lui-même — `git ls-files` pour le
// pathspec, `git check-attr` pour l'aiguillage. Les deux YAML ne peuvent rien importer : ils sont
// CONFRONTÉS à la constante, texte contre texte.
import { tableTotale } from '../../src/lib/tableTotale.ts'
import test from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { pagesDeLAtlas } from './_lib.mjs'
import { envDeDepotForge, instanceDeDepot } from '../guards/lib/depotGabarit.mjs'
import { correspondGlob } from '../guards/lib/lister.mjs'
import { COMMANDE_GATE_CATALOGUES, MOTIF_CATALOGUES, PATHSPEC_CATALOGUES, pathspecDe } from './gate-catalogues.mjs'

const ROOT = fileURLToPath(new URL('../..', import.meta.url))

/** Les catalogues que la couture énumère, en chemins de dépôt. */
const catalogues = () =>
  pagesDeLAtlas(join(ROOT, 'docs', 'raw'), { classes: ['catalogue'] }).map((p) => `docs/raw/${p.relatif}`)

/** Ce que le PATHSPEC atteint réellement — le verdict de git, pas une ré-implémentation du glob. */
const atteintsParLePathspec = () =>
  execFileSync('git', ['ls-files', '--', PATHSPEC_CATALOGUES], { cwd: ROOT, encoding: 'utf8' })
    .split('\n')
    .filter(Boolean)

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

test('tout catalogue de la couture est ATTEINT par le pathspec de la gate', () => {
  const vus = catalogues()
  assert.ok(vus.length > 0, 'la couture n’énumère aucun catalogue — la garde serait verte à vide')
  const atteints = new Set(atteintsParLePathspec())
  assert.deepEqual(vus.filter((c) => !atteints.has(c)), [], `pathspec « ${PATHSPEC_CATALOGUES} »`)
})

test('le pathspec de la gate n’atteint RIEN d’autre que les catalogues de la couture', () => {
  const vus = new Set(catalogues())
  assert.deepEqual(atteintsParLePathspec().filter((p) => !vus.has(p)), [])
})

test('tout catalogue de la couture est aiguillé en famille de fusion `docs-catalogue`', () => {
  const vus = catalogues()
  const fam = famillesDe(vus)
  assert.deepEqual(vus.filter((c) => fam.get(c) !== 'docs-catalogue'), [])
})

test('les DEUX lecteurs du motif s’accordent sur l’arbre RÉEL — `correspondGlob` ⇔ le pathspec dérivé', () => {
  // Deux grammaires lisent ce motif : `motifDeGlob` (`.gitattributes`, cibles de générateur) et git
  // (la gate). Elles ne coïncident QUE parce que le pathspec porte la magie `:(glob)` — le pathspec
  // nu est un `fnmatch` sans `FNM_PATHNAME`. Le désaccord se mesure ici sur tout fichier SUIVI de
  // l'Atlas, dans les deux sens, jamais sur une fixture.
  const suivis = execFileSync('git', ['ls-files', '--', 'docs/raw'], { cwd: ROOT, encoding: 'utf8' })
    .split('\n').filter(Boolean)
  assert.ok(suivis.length > 0, 'aucun fichier suivi sous docs/raw — la garde serait verte à vide')
  const parGit = new Set(atteintsParLePathspec())
  const desaccords = suivis.filter((f) => correspondGlob(f, MOTIF_CATALOGUES) !== parGit.has(f))
  assert.deepEqual(desaccords, [], `motif « ${MOTIF_CATALOGUES} » vs pathspec « ${PATHSPEC_CATALOGUES} »`)
})

test('la magie `glob` PORTE l’accord : sur un arbre foré où les grammaires divergent, le pathspec NU rate la page de racine', () => {
  // L'arbre du dépôt ne peut pas discriminer les deux grammaires : la couture INTERDIT la page de
  // règles à la racine de l'Atlas. C'est donc sur un arbre FORÉ — motif et noms inventés — que se
  // mesure ce qui rend `pathspecDe` nécessaire : sans la magie, `**` suivi d'un `/` exige un dossier
  // réel et la page posée à la racine échappe au pathspec, alors que `motifDeGlob` la vise.
  const motif = 'aire/**/cible-*.md'
  const pages = ['aire/cible-a.md', 'aire/sous/cible-b.md', 'aire/sous/autre.md']
  const { racine: depot } = instanceDeDepot({ fichiers: tableTotale(pages, () => '') })
  try {
    const gitLa = (...args) =>
      execFileSync('git', args, { cwd: depot, env: envDeDepotForge(), encoding: 'utf8' }).split('\n').filter(Boolean)

    const attendus = pages.filter((p) => correspondGlob(p, motif))
    assert.deepEqual(attendus, ['aire/cible-a.md', 'aire/sous/cible-b.md'])
    assert.deepEqual(gitLa('ls-files', '--', pathspecDe(motif)), attendus, 'le pathspec DÉRIVÉ s’accorde à `motifDeGlob`')
    assert.deepEqual(gitLa('ls-files', '--', motif), ['aire/sous/cible-b.md'], 'le pathspec NU rate la page de racine — c’est la morsure')
  } finally { rmSync(depot, { recursive: true, force: true }) }
})

test('les deux workflows écrivent la commande de gate MOT POUR MOT', () => {
  const sites = ['.github/workflows/ci.yml', '.github/workflows/canari.yml']
  const sans = sites.filter((s) => !readFileSync(join(ROOT, s), 'utf8').includes(COMMANDE_GATE_CATALOGUES))
  assert.deepEqual(sans, [], `commande attendue : ${COMMANDE_GATE_CATALOGUES}`)
})
