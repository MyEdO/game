// La porte des projets (#5037) : les passerelles (`lister.mjs`, `sourceCorpus.mjs`, `clotureDImports`, `repoProgram`,
// `listerImage` et `lireEnLot` de `gitPorte.mjs`)
// refusent `projets/` de ce dépôt sans une passe que frappe la porte, avant leur mémo ; une passe forgée ou d'un autre
// projet ne l'ouvre pas.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { listerArbre, listerDossier, listerEntrees } from './lister.mjs'
import { entreeDe, readCorpus } from './sourceCorpus.mjs'
import { INDEX, depotDe, lireEnLot, listerImage } from './gitPorte.mjs'
import { envDeDepotForge, instanceDeDepot } from './depotGabarit.mjs'
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

test('entreeDe refuse, avant son mémo, un fichier sous projets/ sans passe qui l\'admette', () => {
  const abs = join(DEPOT, MODULE_DU_ROGUELITE)
  assert.match(entreeDe(abs, { porte: porteDuProjet('roguelite') }).text, /\S/)
  assert.throws(() => entreeDe(abs), REFUS)
  assert.throws(() => entreeDe(abs, { porte: porteDuProjet('jeu-de-role') }), REFUS)
})

test('listerImage refuse une image qui couvre projets/ sans la passe du dépôt', () => {
  const nu = depotDe(DEPOT)
  assert.throws(() => listerImage(nu, INDEX), REFUS, 'sans dossier : tout l\'arbre')
  assert.throws(() => listerImage(nu, INDEX, 'projets/roguelite'), REFUS)
  assert.throws(() => listerImage(nu, INDEX, '*.json'), REFUS, 'un joker de tête traverse projets/')
  assert.throws(() => listerImage(nu, INDEX, ':(glob)src/**'), REFUS, 'un pathspec magique couvre la racine')
  assert.throws(() => listerImage(depotDe(join(DEPOT, 'src')), INDEX, '../projets'), REFUS, 'un pathspec se lit depuis le cwd du dépôt')
  assert.ok(listerImage(nu, INDEX, 'scripts/guards/lib').includes('scripts/guards/lib/porteDesProjets.mjs'), 'hors de projets/ : aucune passe')
  assert.ok(listerImage(depotDe(DEPOT, { porte: porteDuProjet('roguelite') }), INDEX, 'projets/roguelite').includes(MODULE_DU_ROGUELITE))
  assert.throws(() => listerImage(depotDe(DEPOT, { porte: porteDuProjet('roguelite') }), INDEX), REFUS, 'la passe d\'un projet n\'ouvre pas l\'arbre')
  assert.ok(listerImage(depotDe(DEPOT, { porte: porteDeTousLesProjets }), INDEX).includes(MODULE_DU_ROGUELITE))
})

test('lireEnLot refuse un chemin sous projets/ sans la passe du dépôt', () => {
  assert.throws(() => lireEnLot(depotDe(DEPOT), INDEX, ['package.json', MODULE_DU_ROGUELITE]), REFUS)
  assert.throws(() => lireEnLot(depotDe(DEPOT, { porte: porteDuProjet('jeu-de-role') }), INDEX, [MODULE_DU_ROGUELITE]), REFUS)
  assert.match(lireEnLot(depotDe(DEPOT, { porte: porteDuProjet('roguelite') }), INDEX, [MODULE_DU_ROGUELITE]).get(MODULE_DU_ROGUELITE), /\S/)
})

test('un dépôt d\'une autre racine n\'a pas de projets à garder', () => {
  const { racine } = instanceDeDepot({ fichiers: { 'projets/p/a.txt': 'a\n' } })
  try {
    const fixture = depotDe(racine, { env: envDeDepotForge() })
    assert.deepEqual(listerImage(fixture, 'HEAD'), ['projets/p/a.txt'])
    assert.equal(lireEnLot(fixture, 'HEAD', ['projets/p/a.txt']).get('projets/p/a.txt'), 'a\n')
  } finally {
    rmSync(racine, { recursive: true, force: true })
  }
})
