// Contrat du corpus des projets livrés (`projetsLivres.mjs`), sur un dépôt de fixture : les paquets au suffixe du
// descripteur, à toute profondeur, et un dossier absent LÈVE — un corpus vide rendrait verts, en silence, tous les tests
// qui le parcourent.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { cheminsDesProjetsLivres, listerProjetsLivres, PROJETS_LIVRES } from './projetsLivres.mjs'
import { CORPUS_DU_COMMUN, paquetsDuCommun } from './paquetsDuCommun.mjs'

/** Un dépôt de fixture : deux paquets au suffixe du descripteur, dont un en sous-dossier, et un JSON qui n'en est pas un ;
 *  sous le dossier du commun, deux paquets, un `.json` en sous-dossier et un fichier d'un autre suffixe. */
function depotDeFixture() {
  const racine = mkdtempSync(path.join(tmpdir(), 'projets-livres-'))
  const poser = (dossier, rel) => {
    const fichier = path.join(racine, dossier, rel)
    mkdirSync(path.dirname(fichier), { recursive: true })
    writeFileSync(fichier, '{}')
  }
  poser(PROJETS_LIVRES.dossier, `b/b${PROJETS_LIVRES.suffixe}`)
  poser(PROJETS_LIVRES.dossier, `a/sous/a${PROJETS_LIVRES.suffixe}`)
  poser(PROJETS_LIVRES.dossier, 'a/autre.json')
  poser(CORPUS_DU_COMMUN.dossier, 'second.json')
  poser(CORPUS_DU_COMMUN.dossier, 'premier.json')
  poser(CORPUS_DU_COMMUN.dossier, 'sous/profond.json')
  poser(CORPUS_DU_COMMUN.dossier, 'module.ts')
  return racine
}

test('le corpus d’un dépôt : ses paquets au suffixe du descripteur, à toute profondeur, en ordre total', () => {
  const racine = depotDeFixture()
  try {
    const attendus = [`a/sous/a${PROJETS_LIVRES.suffixe}`, `b/b${PROJETS_LIVRES.suffixe}`]
    assert.deepEqual(listerProjetsLivres(racine), attendus)
    assert.deepEqual(cheminsDesProjetsLivres(racine), attendus.map((rel) => `${PROJETS_LIVRES.dossier}/${rel}`))
  } finally {
    rmSync(racine, { recursive: true, force: true })
  }
})

test('le contenu du commun d’un dépôt : chaque `.json` à plat de son dossier, trouvé par son emplacement, en ordre total', () => {
  const racine = depotDeFixture()
  try {
    assert.deepEqual(paquetsDuCommun(racine), [`${CORPUS_DU_COMMUN.dossier}/premier.json`, `${CORPUS_DU_COMMUN.dossier}/second.json`])
  } finally {
    rmSync(racine, { recursive: true, force: true })
  }
})

test('une racine SANS le dossier du corpus LÈVE, jamais un corpus vide', () => {
  const racine = fileURLToPath(new URL('./racine-sans-corpus-absente/', import.meta.url))
  assert.equal(existsSync(racine), false, 'la racine du contrat doit être ABSENTE')
  assert.throws(() => listerProjetsLivres(racine))
  assert.throws(() => paquetsDuCommun(racine))
})
