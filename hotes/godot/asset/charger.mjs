import { fileURLToPath } from 'node:url'

/** Le module `id` chargé par le module runner de Vite à la racine du dépôt, servi par `greffons`. */
async function importer(id, greffons) {
  const { runnerImport } = await import('vite')
  const { module } = await runnerImport(id, {
    root: fileURLToPath(new URL('../../..', import.meta.url)),
    configFile: false,
    logLevel: 'silent',
    plugins: greffons,
    server: { fs: { strict: false } },
  })
  return module
}

async function importerDHote(nom, exports) {
  const { entreeDHote } = await import('../../../scripts/entree-d-hote.mjs')
  const { id, greffons } = entreeDHote(nom, exports)
  return importer(id, greffons)
}

/** Les assets de Godot dans le graphe de l’hôte : catalogue gelé, noyau et sources de prose. */
export function chargerAssets(exportsSupplementaires = []) {
  return importerDHote('godot-assets', [
    "export { importerPersonnage } from '/hotes/godot/asset/importer.ts';",
    "export { DOSSIER_DES_MODELES, enCacheOuTire, recupererModeles, verifierSomme, publierAssets, PREFIXE_DES_RELEASES } from '/hotes/godot/asset/release.ts';",
    ...exportsSupplementaires,
  ])
}

const EXPORTS_DU_LISTAGE = [
  "export { fichiersDuModele } from '/hotes/godot/asset/modeles.ts';",
  "export { verdictsDuDossier } from '/hotes/godot/asset/release.ts';",
]

let assetsDeLHoteCharges = null
/** Les assets préparés par les modes de `construire.mjs`. */
export const assetsDeLHote = () => (assetsDeLHoteCharges ??= chargerAssets([
  ...EXPORTS_DU_LISTAGE,
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

let assetsDuListageCharges = null
/** Les fonctions de validation du listage, reprises du chargement du mode s'il a déjà commencé. */
export const assetsDuListage = () => (assetsDuListageCharges ??= assetsDeLHoteCharges ?? importerDHote('godot-listage', EXPORTS_DU_LISTAGE))

const MODULE_PAR_DEFAUT = 'evaluer.ts'
const MODULES_DE_L_EVALUATEUR = new Set([
  MODULE_PAR_DEFAUT,
  'candidatsDAppui.ts',
  'chargement.ts',
  'echantillonnage.ts',
  'gabarit.ts',
  'gardes/etirement.ts',
  'gardes/poids.ts',
  'gardes/silhouettes.ts',
  'glbFabrique.testkit.ts',
  'grilleDesAppuis.ts',
  'temoin.ts',
  '../element.ts',
  '../etatsDuGabarit.ts',
  '../gabarit.ts',
  '../manifesteDeBase.ts',
  '../silhouettes.ts',
  '../../../../scripts/personnage-3d/base/gabarit.ts',
  '../../../../scripts/personnage-3d/base/sources.ts',
  '../../../../src/data/schemas/props.types.ts',
  '../../../../src/lib/formesDeTete.ts',
  '../../../../src/lib/tableTotale.ts',
  '../../../../src/noyau/monde/piecesDArete.ts',
  '../../../../src/noyau/monde/relief.ts',
])

/** Charge une entrée déclarée de l'évaluateur d'assets dans un module runner Vite sans entrée virtuelle de l'hôte. */
export async function chargerEvaluateur(module = MODULE_PAR_DEFAUT) {
  if (!MODULES_DE_L_EVALUATEUR.has(module)) {
    const selecteur = typeof module === 'string' ? module : typeof module
    throw new TypeError(`[godot-assets] sélecteur d'évaluateur inconnu : ${selecteur}`)
  }
  return importer(fileURLToPath(new URL(`./evaluateur/${module}`, import.meta.url)), [])
}
