// Le tirage des packs sources de la Release (#3248) : `tirerSources`, sur des archives fabriquées.
import { spawn, spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { sha256 } from '../../../hotes/godot/asset/empreinte.ts'
import { empreinteDeSource } from './production.ts'
import { tirerSources } from './sources.ts'

const RACINES: string[] = []
afterAll(() => { for (const r of RACINES) rmSync(r, { recursive: true, force: true }) })

const FICHIERS = { ual1: 'ual1.glb', ual2: 'ual2.glb', corps: 'corps.gltf', 'corps-feminin': 'feminin.gltf', mpfb: 'data' }

/** Sous un `mkdtempSync` d'os.tmpdir(), retiré après la suite : une archive des cinq packs, dont `cibles` fichiers sous
 *  `data`, ses octets, l'index qui la décrit et la provenance de ses empreintes. */
function fabriquer(cibles = 1) {
  const racine = mkdtempSync(join(tmpdir(), 'sources-3d-')), contenu = join(racine, 'contenu')
  RACINES.push(racine)
  mkdirSync(join(contenu, 'data', 'cibles'), { recursive: true })
  for (const [pack, fichier] of Object.entries(FICHIERS)) if (pack !== 'mpfb') writeFileSync(join(contenu, fichier), `octets de ${pack}`)
  for (let i = 0; i < cibles; i++) writeFileSync(join(contenu, 'data', 'cibles', `${i}.target`), `cible ${i}`)
  writeFileSync(join(contenu, 'License.txt'), 'License: CC0')
  const archive = join(racine, 'archive.tar.gz')
  expect(spawnSync('tar', ['-czf', archive, '-C', contenu, '.']).status).toBe(0)
  const octets = readFileSync(archive)
  const archives = { [sha256(octets)]: Object.fromEntries(Object.entries(FICHIERS).map(([pack, source]) => [pack, { source, licence: 'License.txt' }])) }
  const provenance = { packs_sources: Object.entries(FICHIERS).map(([pack, f]) => ({ pack, sha256: empreinteDeSource(pack as keyof typeof FICHIERS, join(contenu, f)) })) }
  return { racine, octets, archives, provenance }
}

/** Un `fetch` qui rend `octets` et compte ses appels. */
function telechargement(octets: Uint8Array) {
  const appels: string[] = []
  const telecharger = async (url: string) => { appels.push(url); return { ok: true, status: 200, arrayBuffer: async () => Uint8Array.from(octets).buffer } }
  return { appels, telecharger }
}

const silence = () => {}

/** Le code de sortie d'un processus Node qui charge `sources.ts` comme `sources.mjs` et lance `tirerSources` sur
 *  `options`, sans téléchargement. */
function tirageDansUnProcessus(options: object): Promise<{ code: number | null; stderr: string }> {
  const charger = new URL('../../../hotes/godot/asset/charger.mjs', import.meta.url).href
  const code = `const { chargerEvaluateur } = await import(${JSON.stringify(charger)})
const { tirerSources } = await chargerEvaluateur('../../../../scripts/personnage-3d/base/sources.ts')
await tirerSources({ ...JSON.parse(process.argv[1]), telecharger: () => { throw new Error('téléchargement inattendu') }, journal: () => {} })`
  return new Promise((fini) => {
    const processus = spawn(process.execPath, ['--input-type=module', '-e', code, JSON.stringify(options)], { stdio: ['ignore', 'ignore', 'pipe'] })
    let stderr = ''
    processus.stderr.on('data', (d: Buffer) => { stderr += d.toString() })
    processus.on('close', (code) => fini({ code, stderr }))
  })
}

describe('tirerSources', { timeout: 120_000 }, () => {
  it('tire, vérifie et rend chaque pack ; un second tirage ne télécharge rien', async () => {
    const { racine, octets, archives, provenance } = fabriquer(), cache = join(racine, 'cache')
    const { appels, telecharger } = telechargement(octets)
    const chemins = await tirerSources({ archives, cache, provenance, telecharger, journal: silence })
    expect(readFileSync(chemins.ual1.source, 'utf8')).toBe('octets de ual1')
    expect(readFileSync(chemins.mpfb.licence, 'utf8')).toBe('License: CC0')
    await tirerSources({ archives, cache, provenance, telecharger, journal: silence })
    expect(appels.length).toBe(1)
  })

  it('ROUGE : des tirages menés de front par plusieurs processus sur un cache sans extraction réussissent tous', async () => {
    const { racine, octets, archives, provenance } = fabriquer(10000), cache = join(racine, 'cache')
    mkdirSync(cache)
    const [somme] = Object.keys(archives)
    writeFileSync(join(cache, `${somme}.tar.gz`), octets)
    const tirages = await Promise.all(Array.from({ length: 4 }, () => tirageDansUnProcessus({ archives, cache, provenance })))
    expect(tirages.filter((t) => t.code !== 0).map((t) => t.stderr)).toEqual([])
    const chemins = await tirerSources({ archives, cache, provenance, telecharger: telechargement(octets).telecharger, journal: silence })
    expect(readFileSync(join(chemins.mpfb.source, 'cibles', '9999.target'), 'utf8')).toBe('cible 9999')
  })

  it('ROUGE : une archive dont la somme diffère est refusée', async () => {
    const { racine, octets, archives, provenance } = fabriquer()
    const { telecharger } = telechargement(Uint8Array.from([...octets, 0]))
    await expect(tirerSources({ archives, cache: join(racine, 'cache'), provenance, telecharger, journal: silence })).rejects.toThrow(/SHA-256/)
  })

  it('ROUGE : une source dont l’empreinte diffère de la provenance est refusée', async () => {
    const { racine, octets, archives, provenance } = fabriquer()
    const { telecharger } = telechargement(octets)
    const fausse = { packs_sources: provenance.packs_sources.map((p) => (p.pack === 'mpfb' ? { ...p, sha256: '0'.repeat(64) } : p)) }
    await expect(tirerSources({ archives, cache: join(racine, 'cache'), provenance: fausse, telecharger, journal: silence })).rejects.toThrow(/^\[source-fausse\] mpfb /)
  })

  it('ROUGE : un pack sans empreinte dans la provenance est refusé avant tout tirage', async () => {
    const { racine, octets, archives, provenance } = fabriquer()
    const { appels, telecharger } = telechargement(octets)
    const incomplete = { packs_sources: provenance.packs_sources.filter((p) => p.pack !== 'ual2') }
    await expect(tirerSources({ archives, cache: join(racine, 'cache'), provenance: incomplete, telecharger, journal: silence })).rejects.toThrow(/\[source-sans-empreinte\] ual2 /)
    expect(appels.length).toBe(0)
  })
})
