/**
 * LES PACKS SOURCES D'UNE BASE EN RELEASE (#3248) : les packs de `SOURCES` (`production.ts`) vivent dans la Release
 * `TAG`, en archives `tar.gz` nommées par leur SHA-256 (`ARCHIVES`). `tirerSources` tire chaque archive absente du cache,
 * la vérifie par sa somme, l'extrait dans son dossier du cache, puis vérifie chaque source par son empreinte
 * (`empreinteDeSource`) contre `packs_sources` de la provenance de la base : tout écart est un refus. La commande est
 * `sources.mjs`.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEPOT, enCacheOuTire } from '../../../hotes/godot/asset/release.ts';
import { empreinteDeSource, SOURCES, type SourcesDeBase } from './production.ts';

type Pack = keyof SourcesDeBase;
/** La source et le texte de licence d'un pack, chemins relatifs à son archive ou absolus une fois tirés. */
interface CheminsDuPack { readonly source: string; readonly licence: string }
type Archives = Readonly<Record<string, Partial<Record<Pack, CheminsDuPack>>>>;
interface Provenance { readonly packs_sources: readonly { readonly pack: string; readonly sha256: string }[] }
type Telecharger = (url: string) => Promise<{ readonly ok: boolean; readonly status: number; arrayBuffer(): Promise<ArrayBuffer> }>;

/** La Release des packs sources. */
const TAG = 'sources-3d'

/** Le cache des archives et de leurs extractions, hors de l'arbre. */
const CACHE_DES_SOURCES = join(homedir(), '.cache', 'wfrp-sources-3d')

/** La provenance de la base, dont `packs_sources` porte l'empreinte attendue de chaque source. */
const PROVENANCE = fileURLToPath(new URL('../../../hotes/godot/projet/modeles/humanoide.provenance.json', import.meta.url))

/** Chaque archive de la Release, par sa somme : pour chaque pack qu'elle porte, le chemin de sa source et de son texte
 *  de licence dans l'archive. Index publié sur #3104 (commentaire 6586093072). */
const ARCHIVES: Archives = {
  '744446656da49183a2f2872d94582a1b7c0782dd4448e61ee0f7d26db13c1a0a': { ual1: { source: 'UAL1_Standard.glb', licence: 'License.txt' } },
  'e839cddcf945b84edd4817e9ddbdf4c3f604288b7cdd5d970458fbd81dc77649': { ual2: { source: 'UAL2_Standard.glb', licence: 'License.txt' } },
  '23c47645030c85d5747e1de3f4ca6658404e73538c9c774fa87675b067911301': {
    corps: { source: 'Superhero_Male_FullBody.gltf', licence: 'License_Standard.txt' },
    'corps-feminin': { source: 'Superhero_Female_FullBody.gltf', licence: 'License_Standard.txt' },
  },
  '0df44b9d7f4403ab0b480e97e0faeddeba23e959c4f2060d0e81d7289a9776cd': { mpfb: { source: 'data', licence: 'LICENSE.ASSETS.md' } },
}

/** L'empreinte attendue de chaque pack de `SOURCES`, lue dans `packs_sources` de la provenance `provenance`. */
function empreintesAttendues(provenance: Provenance): Map<string, string> {
  const parPack = new Map(provenance.packs_sources.map((p) => [p.pack, p.sha256]))
  const absents = SOURCES.filter((s) => !parPack.has(s))
  if (absents.length) throw new Error(`[source-sans-empreinte] ${absents.join(', ')} : absent(s) de packs_sources de la provenance`)
  return parPack
}

/** Extrait l'archive `archive` dans le dossier `dossier`. */
function extraireTar(archive: string, dossier: string): void {
  const r = spawnSync('tar', ['-xzf', archive, '-C', dossier], { encoding: 'utf8' })
  if (r.status !== 0) throw new Error(`tar -xzf ${archive} : code ${String(r.status)}\n${r.error?.message ?? r.stderr}`)
}

/** Les chemins de la source et du texte de licence de chaque pack de `SOURCES`, tirés des `archives` de la Release dans `cache` et
 *  vérifiés : chaque archive par sa somme, chaque source par son empreinte attendue (`empreintesAttendues`). Une archive
 *  dont une source manque ou s'écarte est retirée puis réextraite ; un écart qui reste lève. */
export async function tirerSources({ archives = ARCHIVES, cache = CACHE_DES_SOURCES, provenance = JSON.parse(readFileSync(PROVENANCE, 'utf8')) as Provenance, telecharger = fetch as Telecharger, extraire = extraireTar, journal = (l: string) => console.error(l) }: {
  archives?: Archives; cache?: string; provenance?: Provenance; telecharger?: Telecharger; extraire?: (archive: string, dossier: string) => void; journal?: (ligne: string) => void;
} = {}): Promise<Record<Pack, CheminsDuPack>> {
  const attendues = empreintesAttendues(provenance)
  const chemins: Partial<Record<Pack, CheminsDuPack>> = {}
  for (const [somme, packs] of Object.entries(archives)) {
    const archive = join(cache, `${somme}.tar.gz`), dossier = join(cache, somme)
    const entrees = Object.entries(packs) as [Pack, CheminsDuPack][]
    const ecarts = () => entrees.filter(([pack, { source }]) => !existsSync(join(dossier, source)) || empreinteDeSource(pack, join(dossier, source)) !== attendues.get(pack)).map(([pack]) => pack)
    if (existsSync(dossier) && !ecarts().length) journal(`[sources] ${Object.keys(packs).join(', ')} : déjà extraits et vérifiés`)
    else {
      mkdirSync(cache, { recursive: true })
      await enCacheOuTire(archive, somme, `${somme}.tar.gz`, async () => {
        const url = `https://github.com/${DEPOT}/releases/download/${TAG}/${somme}.tar.gz`
        journal(`[sources] téléchargement de ${url}`)
        const reponse = await telecharger(url)
        if (!reponse.ok) throw new Error(`${url} : HTTP ${reponse.status}`)
        return new Uint8Array(await reponse.arrayBuffer())
      })
      rmSync(dossier, { recursive: true, force: true })
      mkdirSync(dossier)
      extraire(archive, dossier)
      const fausses = ecarts()
      if (fausses.length) throw new Error(`[source-fausse] ${fausses.join(', ')} : empreinte différente de packs_sources de la provenance (archive ${somme})`)
      journal(`[sources] ${Object.keys(packs).join(', ')} : extraits et vérifiés`)
    }
    for (const [pack, { source, licence }] of entrees) chemins[pack] = { source: join(dossier, source), licence: join(dossier, licence) }
  }
  const manquants = SOURCES.filter((s) => !chemins[s])
  if (manquants.length) throw new Error(`[source-sans-archive] ${manquants.join(', ')} : aucune archive ne les porte`)
  return chemins as Record<Pack, CheminsDuPack>
}

