import { fileURLToPath } from 'node:url'
import { runnerImport } from 'vite'
import { entreeDHote } from '../../../scripts/entree-d-hote.mjs'

/** Le module `id` chargé par le module runner de Vite à la racine du dépôt, servi par `greffons`. */
async function importer(id, greffons) {
  const { module } = await runnerImport(id, {
    root: fileURLToPath(new URL('../../..', import.meta.url)),
    configFile: false,
    logLevel: 'silent',
    plugins: greffons,
    server: { fs: { strict: false } },
  })
  return module
}

/** Les assets de Godot dans le graphe de l’hôte : catalogue gelé, noyau et sources de prose. */
export async function chargerAssets(exportsSupplementaires = []) {
  const entree = entreeDHote('godot-assets', [
    "export { importerPersonnage } from '/hotes/godot/asset/importer.ts';",
    "export { DOSSIER_DES_MODELES, enCacheOuTire, recupererModeles, verifierSomme, publierAssets, TAG } from '/hotes/godot/asset/release.ts';",
    ...exportsSupplementaires,
  ])
  return importer(entree.id, entree.greffons)
}

/** Le module `module` de l’évaluateur d’assets (`evaluateur/`, par défaut `evaluer.ts`), hors du graphe de l’hôte : il
 *  ne lit ni le catalogue ni le noyau. */
export const chargerEvaluateur = (module = 'evaluer.ts') => importer(fileURLToPath(new URL(`./evaluateur/${module}`, import.meta.url)), [])
