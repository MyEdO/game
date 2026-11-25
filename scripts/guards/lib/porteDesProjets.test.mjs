// La porte des projets (#5037) : les passerelles (`lister.mjs`, `sourceCorpus.mjs`, `clotureDImports`, `repoProgram`)
// refusent `projets/` de ce dépôt sans une passe que frappe la porte, avant leur mémo ; une passe forgée ou d'un autre
// projet ne l'ouvre pas.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { listerArbre, listerDossier, listerEntrees } from './lister.mjs'
import { readCorpus } from './sourceCorpus.mjs'
import { clotureDImports } from './importGraph.mjs'
import { repoProgram } from './tsProgram.mjs'
import { porteDeTousLesProjets, porteDuProjet } from './porteDesProjets.mjs'
import { sceauDeLaPorte } from './serrureDesProjets.mjs'

const DEPOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
const PROJETS = join(DEPOT, 'projets')
const SOURCES_DU_ROGUELITE = 'projets/roguelite/src'
const REFUS = /couvre projets\/ sans passe qui l'admette/
const MODULE_DU_ROGUELITE = 'projets/roguelite/src/figures.ts'

test('sans passe, chaque passerelle refuse un chemin sous projets/', () => {
  assert.throws(() => listerDossier(PROJETS), REFUS)
  assert.throws(() => listerEntrees(join(PROJETS, 'roguelite')), REFUS)
  assert.throws(() => listerArbre(join(DEPOT, SOURCES_DU_ROGUELITE)), REFUS)
  assert.throws(() => readCorpus([SOURCES_DU_ROGUELITE]), REFUS)
})

test('une racine qui contient projets/ est refusée par la lecture récursive qui y descendrait', () => {
  assert.throws(() => readCorpus([DEPOT]), REFUS)
  assert.throws(() => listerArbre(DEPOT, { descendre: (rel) => rel === 'projets' }), REFUS)
  assert.ok(listerArbre(DEPOT, { descendre: () => false }).includes('package.json'), 'une marche qui ne descend pas dans projets/ passe')
  assert.ok(listerDossier(DEPOT).includes('projets'), 'nommer le dossier des projets n\'est pas le lire')
})

test('le refus précède le mémo : un corpus déjà lu par la porte reste refusé sans elle', () => {
  const lu = readCorpus([SOURCES_DU_ROGUELITE], { porte: porteDuProjet('roguelite') })
  assert.ok(lu.length > 0)
  assert.equal(readCorpus([SOURCES_DU_ROGUELITE], { porte: porteDeTousLesProjets }), lu, 'même clé, même tableau')
  assert.throws(() => readCorpus([SOURCES_DU_ROGUELITE]), REFUS)
})

test('chaque passe n\'admet que ce qu\'elle dit lire', () => {
  assert.ok(listerArbre(join(DEPOT, SOURCES_DU_ROGUELITE), { porte: porteDuProjet('roguelite') }).length > 0)
  assert.throws(() => listerDossier(join(PROJETS, 'jeu-de-role'), { porte: porteDuProjet('roguelite') }), REFUS)
  assert.throws(() => readCorpus([DEPOT], { porte: porteDuProjet('roguelite') }), REFUS)
  assert.throws(() => listerDossier(PROJETS, { porte: porteDuProjet('roguelite') }), REFUS)
  assert.ok(listerDossier(PROJETS, { porte: porteDeTousLesProjets }).includes('roguelite'))
})

test('une passe se frappe par la seule porte : la copie de sa forme et le sceau d\'un autre module sont refusés', () => {
  assert.throws(() => listerDossier(PROJETS, { porte: { lit: 'tous' } }), REFUS)
  assert.throws(() => listerDossier(PROJETS, { porte: Object.freeze({ ...porteDeTousLesProjets }) }), REFUS)
  assert.throws(() => sceauDeLaPorte(import.meta.url), /ne se remet qu'à/)
})

test('un dossier « projets » hors de ce dépôt n\'est pas celui des projets', () => {
  const ailleurs = join(tmpdir(), 'porte-des-projets-hors-du-depot', 'projets')
  assert.deepEqual(listerDossier(ailleurs, { absent: 'vide' }), [])
  assert.equal(listerEntrees(join(ailleurs, 'p'), { absent: 'vide' }).nature, 'absent')
})

test('clotureDImports refuse, avant son mémo, une racine sous projets/ et un module qu\'elle y atteint', () => {
  const cache = new Map()
  assert.ok(clotureDImports([MODULE_DU_ROGUELITE], { racine: DEPOT, cache, porte: porteDuProjet('roguelite') }).has(MODULE_DU_ROGUELITE))
  assert.throws(() => clotureDImports([MODULE_DU_ROGUELITE], { racine: DEPOT, cache }), REFUS)
  const importeur = join(DEPOT, 'scripts', 'importeur-du-roguelite.mjs').split('\\').join('/')
  const cible = join(DEPOT, MODULE_DU_ROGUELITE).split('\\').join('/')
  const arbre = {
    existe: (abs) => abs === importeur || abs === cible,
    lire: (abss) => new Map(abss.map((abs) => [abs, { [importeur]: "import '../projets/roguelite/src/figures.ts'\n", [cible]: 'export const f = 1\n' }[abs] ?? null])),
  }
  assert.throws(() => clotureDImports(['scripts/importeur-du-roguelite.mjs'], { racine: DEPOT, arbre }), REFUS)
  assert.ok(clotureDImports(['scripts/importeur-du-roguelite.mjs'], { racine: DEPOT, arbre, porte: porteDeTousLesProjets }).has(MODULE_DU_ROGUELITE))
})

test('repoProgram refuse une racine sous projets/ et un module du programme qui y mène', () => {
  const racine = (rel) => () => [join(DEPOT, rel)]
  assert.throws(() => repoProgram(DEPOT, racine(MODULE_DU_ROGUELITE)), REFUS)
  const sonde = { 'scripts/sonde-de-la-porte.ts': "import '../projets/roguelite/src/figures';\n" }
  assert.throws(() => repoProgram(DEPOT, racine('scripts/sonde-de-la-porte.ts'), sonde), REFUS)
  const session = repoProgram(DEPOT, racine('scripts/sonde-de-la-porte.ts'), sonde, {}, { porte: porteDuProjet('roguelite') })
  try {
    assert.ok(session.program.getSourceFileNames().some((f) => f.endsWith(MODULE_DU_ROGUELITE)))
  } finally {
    session.dispose()
  }
})
