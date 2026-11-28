import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { isAbsolute, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

/** Dans un module du dépôt, `import.meta.url` vaut l'URL de son fichier source, pas celle du paquet. */
const urlDuFichierSource = {
  name: 'godot-assets-url-source',
  enforce: 'pre',
  transform: (code, id) => (id.startsWith('\0') || !code.includes('import.meta.url')
    ? null
    : code.replaceAll('import.meta.url', JSON.stringify(pathToFileURL(id.split('?')[0]).href))),
}

/** Une dépendance hors du dépôt (`node_modules`, module de Node) reste externe, à l'URL que Node lui résout. */
const dependancesExternes = {
  name: 'godot-assets-externes',
  enforce: 'pre',
  resolveId: (cible) => (/^[./\0]/.test(cible) || isAbsolute(cible) || cible.startsWith('virtual:') ? null : { id: import.meta.resolve(cible), external: true }),
}

/** Le module de l'entrée `{ entree, greffons }` bâtie en un seul paquet par `vite build` (SSR) à la racine du dépôt, puis
 *  importé depuis un dossier temporaire, retiré après l'import ; sous un segment `node_modules`, qu'un module runner de
 *  Vite (Vitest) laisse à l'import natif de Node au lieu de le transformer. Les sources du dépôt et les modules virtuels
 *  sont paquetés, le reste externe (`dependancesExternes`). Mode `development`, `NODE_ENV` hérité, `development` s'il
 *  est absent ou vide, posé dans le processus comme le fait le serveur de Vite : `import.meta.env.DEV` est vrai hors de
 *  `NODE_ENV=production`. */
async function importer(entree) {
  const { batirLEntree } = await import('../../../scripts/entree-d-hote.mjs')
  process.env.NODE_ENV ||= 'development'
  const { code } = await batirLEntree({ ...entree, greffons: [...entree.greffons, urlDuFichierSource, dependancesExternes] }, {
    envDir: false,
    logLevel: 'silent',
    mode: 'development',
    build: { ssr: true, write: false, target: 'esnext', rolldownOptions: { output: { codeSplitting: false } } },
  })
  const dossier = await mkdtemp(join(tmpdir(), 'wfrp-godot-assets-'))
  try {
    await mkdir(join(dossier, 'node_modules'))
    const paquet = join(dossier, 'node_modules', 'paquet.mjs')
    await writeFile(paquet, code)
    return await import(pathToFileURL(paquet).href)
  } finally {
    await rm(dossier, { recursive: true, force: true })
  }
}

async function importerDHote(nom, exports) {
  const { entreeDHote } = await import('../../../scripts/entree-d-hote.mjs')
  return importer(entreeDHote(nom, exports))
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
  '../couches.ts',
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

/** Charge une entrée déclarée de l'évaluateur d'assets (`importer`), sans entrée virtuelle de l'hôte. */
export async function chargerEvaluateur(module = MODULE_PAR_DEFAUT) {
  if (!MODULES_DE_L_EVALUATEUR.has(module)) {
    const selecteur = typeof module === 'string' ? module : typeof module
    throw new TypeError(`[godot-assets] sélecteur d'évaluateur inconnu : ${selecteur}`)
  }
  return importer({ entree: fileURLToPath(new URL(`./evaluateur/${module}`, import.meta.url)), greffons: [] })
}
