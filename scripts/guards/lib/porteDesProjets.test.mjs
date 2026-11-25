// La porte des projets (#5037) : les passerelles (`lister.mjs`, `sourceCorpus.mjs`) refusent `projets/` de ce dépôt sans
// une passe que frappe la porte, avant leur mémo ; une passe forgée ou d'un autre projet ne l'ouvre pas.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { listerArbre, listerDossier, listerEntrees } from './lister.mjs'
import { readCorpus } from './sourceCorpus.mjs'
import { porteDeTousLesProjets, porteDuProjet, porteDuSuffixe } from './porteDesProjets.mjs'
import { sceauDeLaPorte } from './serrureDesProjets.mjs'

const DEPOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
const PROJETS = join(DEPOT, 'projets')
const SOURCES_DU_ROGUELITE = 'projets/roguelite/src'
const REFUS = /couvre projets\/ sans passe qui l'admette/

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
  assert.ok(listerDossier(PROJETS, { porte: porteDuSuffixe('-projet.json') }).includes('roguelite'))
  assert.throws(() => readCorpus([DEPOT], { porte: porteDuSuffixe('-projet.json') }), REFUS)
  assert.ok(listerDossier(PROJETS, { porte: porteDeTousLesProjets }).includes('roguelite'))
})

test('une passe se frappe par la seule porte : la copie de sa forme et le sceau d\'un autre module sont refusés', () => {
  assert.throws(() => listerDossier(PROJETS, { porte: { lit: 'tous' } }), REFUS)
  assert.throws(() => listerDossier(PROJETS, { porte: Object.freeze({ ...porteDeTousLesProjets }) }), REFUS)
  assert.throws(() => sceauDeLaPorte(import.meta.url), /ne se remet qu'à/)
})

test('un dossier « projets » hors de ce dépôt n\'est pas celui des projets', () => {
  const racine = mkdtempSync(join(tmpdir(), 'porte-des-projets-'))
  try {
    mkdirSync(join(racine, 'projets', 'p'), { recursive: true })
    writeFileSync(join(racine, 'projets', 'p', 'a.ts'), 'export const a = 1\n')
    assert.deepEqual(listerArbre(racine), ['projets/p/a.ts'])
  } finally {
    rmSync(racine, { recursive: true, force: true })
  }
})
