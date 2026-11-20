import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { realpathSync } from 'node:fs'
import { tmpdir } from 'node:os'
import test from 'node:test'
import { listerDossier } from '../guards/lib/lister.mjs'
import { cheminDuDepot } from '../source/adresses.mjs'
import { avecAtlasFixture } from './atlasFixture.mjs'

function lancer(args, cwd) {
  const resultat = spawnSync(process.execPath, args, { cwd, encoding: 'utf8', timeout: 15_000 })
  assert.ifError(resultat.error)
  return resultat
}

function exigerRefus(cwd, script) {
  const resultat = lancer([cheminDuDepot(script)], cwd)
  assert.equal(resultat.status, 2, resultat.stdout + resultat.stderr)
  assert.equal(resultat.stdout, '')
  assert.equal(resultat.stderr.trim(), 'Lancez cet outil Atlas depuis la racine du dépôt : ' + cheminDuDepot('.'))
}

test('le contrôle des folios refuse les répertoires où le listage donnerait zéro candidat', () => {
  const script = 'scripts/raw/lib/empty-folios-stock.mjs'
  exigerRefus(cheminDuDepot('scripts'), script)
  avecAtlasFixture({}, (cwd) => exigerRefus(cwd, script), { coeur: 'coeur-de-banc' })
})

test('la génération de catalogues refuse le cwd étranger avant de produire un fichier', () => {
  avecAtlasFixture({}, (cwd, coeur) => {
    exigerRefus(cwd, 'scripts/raw/build-catalogs.mjs')
    assert.deepEqual(listerDossier(cwd), [coeur])
  }, { coeur: 'coeur-de-banc' })
})

test('importer la bibliothèque ou un outil Atlas préserve le cwd de l’appelant', () => {
  const cwd = tmpdir()
  const lib = new URL('./_lib.mjs', import.meta.url).href
  const outil = new URL('./audit-refs-chapitre.mjs', import.meta.url).href
  const sonde = 'await import(' + JSON.stringify(lib) + '); await import(' +
    JSON.stringify(outil) + '); console.log(process.cwd())'
  const resultat = lancer(['--input-type=module', '-e', sonde], cwd)
  assert.equal(resultat.status, 0, resultat.stderr)
  assert.equal(realpathSync(resultat.stdout.trim()), realpathSync(cwd))
})
