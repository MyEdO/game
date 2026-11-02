// Le tirage des packs sources de la Release (#3248) : `tirerSources`, sur des archives fabriquées.
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, it } from 'node:test'
import { sha256 } from '../../../hotes/godot/asset/empreinte.ts'
import { empreinteDeSource } from './production.ts'
import { tirerSources } from './sources.mjs'

const FICHIERS = { ual1: 'ual1.glb', ual2: 'ual2.glb', corps: 'corps.gltf', 'corps-feminin': 'feminin.gltf', mpfb: 'data' }

/** Une archive des cinq packs, ses octets, l'index qui la décrit et la provenance de ses empreintes. */
function fabriquer() {
  const racine = mkdtempSync(join(tmpdir(), 'sources-3d-')), contenu = join(racine, 'contenu')
  mkdirSync(join(contenu, 'data', 'cibles'), { recursive: true })
  for (const [pack, fichier] of Object.entries(FICHIERS)) if (pack !== 'mpfb') writeFileSync(join(contenu, fichier), `octets de ${pack}`)
  writeFileSync(join(contenu, 'data', 'cibles', 'a.target'), 'cible')
  writeFileSync(join(contenu, 'License.txt'), 'License: CC0')
  const archive = join(racine, 'archive.tar.gz')
  assert.equal(spawnSync('tar', ['-czf', archive, '-C', contenu, '.']).status, 0)
  const octets = readFileSync(archive)
  const archives = { [sha256(octets)]: Object.fromEntries(Object.entries(FICHIERS).map(([pack, source]) => [pack, { source, licence: 'License.txt' }])) }
  const provenance = { packs_sources: Object.entries(FICHIERS).map(([pack, f]) => ({ pack, sha256: empreinteDeSource(pack, join(contenu, f)) })) }
  return { racine, octets, archives, provenance }
}

/** Un `fetch` qui rend `octets` et compte ses appels. */
function telechargement(octets) {
  const appels = []
  const telecharger = async (url) => { appels.push(url); return { ok: true, status: 200, arrayBuffer: async () => octets.buffer.slice(octets.byteOffset, octets.byteOffset + octets.byteLength) } }
  return { appels, telecharger }
}

const silence = () => {}

describe('tirerSources', () => {
  it('tire, vérifie et rend chaque pack ; un second tirage ne télécharge rien', async () => {
    const { racine, octets, archives, provenance } = fabriquer(), cache = join(racine, 'cache')
    const { appels, telecharger } = telechargement(octets)
    const chemins = await tirerSources({ archives, cache, provenance, telecharger, journal: silence })
    assert.equal(readFileSync(chemins.ual1.source, 'utf8'), 'octets de ual1')
    assert.equal(readFileSync(chemins.mpfb.licence, 'utf8'), 'License: CC0')
    await tirerSources({ archives, cache, provenance, telecharger, journal: silence })
    assert.equal(appels.length, 1)
  })

  it('ROUGE : une archive dont la somme diffère est refusée', async () => {
    const { racine, octets, archives, provenance } = fabriquer()
    const { telecharger } = telechargement(Uint8Array.from([...octets, 0]))
    await assert.rejects(tirerSources({ archives, cache: join(racine, 'cache'), provenance, telecharger, journal: silence }), /SHA-256/)
  })

  it('ROUGE : une source dont l’empreinte diffère de la provenance est refusée', async () => {
    const { racine, octets, archives, provenance } = fabriquer()
    const { telecharger } = telechargement(octets)
    const fausse = { packs_sources: provenance.packs_sources.map((p) => (p.pack === 'mpfb' ? { ...p, sha256: '0'.repeat(64) } : p)) }
    await assert.rejects(tirerSources({ archives, cache: join(racine, 'cache'), provenance: fausse, telecharger, journal: silence }), /^Error: \[source-fausse\] mpfb /)
  })

  it('ROUGE : un pack sans empreinte dans la provenance est refusé avant tout tirage', async () => {
    const { racine, octets, archives, provenance } = fabriquer()
    const { appels, telecharger } = telechargement(octets)
    const incomplete = { packs_sources: provenance.packs_sources.filter((p) => p.pack !== 'ual2') }
    await assert.rejects(tirerSources({ archives, cache: join(racine, 'cache'), provenance: incomplete, telecharger, journal: silence }), /\[source-sans-empreinte\] ual2 /)
    assert.equal(appels.length, 0)
  })
})
