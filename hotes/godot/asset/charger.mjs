import { fileURLToPath } from 'node:url'
import { runnerImport } from 'vite'
import { entreeDHote } from '../../../scripts/entree-d-hote.mjs'

/** Les assets de Godot dans le graphe de l’hôte : catalogue gelé, noyau et sources de prose. */
export async function chargerAssets() {
  const entree = entreeDHote('godot-assets', [
    "export { importerPersonnage } from '/hotes/godot/asset/importer.ts';",
    "export { DOSSIER_DES_MODELES, enCacheOuTire, recupererModeles, verifierSomme, publierAssets, TAG } from '/hotes/godot/asset/release.ts';",
  ])
  const { module } = await runnerImport(entree.id, {
    root: fileURLToPath(new URL('../../..', import.meta.url)),
    configFile: false,
    logLevel: 'silent',
    plugins: entree.greffons,
    server: { fs: { strict: false } },
  })
  return module
}
