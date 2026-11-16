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

let assetsDeLHoteCharges = null
/** Les assets que lisent le listage des modèles (`listage.mjs`) et les modes de `construire.mjs` (`chargerAssets`) :
 *  un seul chargement par processus, qu'ils partagent. */
export const assetsDeLHote = () => (assetsDeLHoteCharges ??= chargerAssets([
  "export { fichiersDuModele } from '/hotes/godot/asset/modeles.ts';",
  "export { verdictsDuDossier } from '/hotes/godot/asset/release.ts';",
  "export { figerLesDessins } from '/hotes/godot/asset/dessins.ts';",
  "export { figerVuesDeLEcran, figerLesPlanches } from '/hotes/godot/recettes/ecran.ts';",
  "export { figerLeVehicule } from '/hotes/godot/recettes/vehicule.ts';",
  "export { figerLeRepos } from '/hotes/godot/recettes/atelier.ts';",
  "export { figerLeDecor } from '/hotes/godot/recettes/decor.ts';",
  "export { figerLeChemin } from '/hotes/godot/recettes/chemin.ts';",
  "export { figerLEditeurDuNavire } from '/hotes/godot/recettes/editeur.ts';",
  "export { figerLeDegagement } from '/hotes/godot/recettes/degagement.ts';",
  "export { recupererEpingles } from '/hotes/godot/asset/epingles.ts';",
]))

/** Le module `module` de l’évaluateur d’assets (`evaluateur/`, par défaut `evaluer.ts`), hors du graphe de l’hôte : il
 *  ne lit ni le catalogue ni le noyau. */
export const chargerEvaluateur = (module = 'evaluer.ts') => importer(fileURLToPath(new URL(`./evaluateur/${module}`, import.meta.url)), [])
