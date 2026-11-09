// LE DOSSIER DES MODÈLES ET SON LISTAGE (#2987, `pont/CONTRAT.md`, section « Atelier 3D ») : ce que `GET /modeles/` de
// `servir.mjs` rend, et ce que la sonde de `construire.mjs` fige pour la recette du véhicule. Sans écrivain : la gate
// `pont:godot` l'atteint par `construire.mjs`.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { chargerAssets } from './asset/charger.mjs'

const { DOSSIER_DES_MODELES, fichiersDuModele, lireGlb, manifestesDesModeles, verdictsDesModeles } = await chargerAssets([
  "export { lireGlb } from '/hotes/godot/asset/glb.ts';",
  "export { manifestesDesModeles } from '/hotes/godot/asset/release.ts';",
  "export { fichiersDuModele, verdictsDesModeles } from '/hotes/godot/asset/modeles.ts';",
])

export { DOSSIER_DES_MODELES }

/** Le listage de `dossier` : les manifestes que `verdictsDesModeles` accepte contre leur GLB, de chacun les os qui portent
 *  ses meshes rigides (`os` des `meshes` sans skin de `lireGlb`), et les erreurs (manifeste illisible, GLB illisible, refus,
 *  dossier illisible). */
export function listage(dossier) {
  try {
    const lus = manifestesDesModeles(dossier)
    const erreurs = [...lus.erreurs]
    const octets = new Map()
    for (const { id } of lus.entrees) {
      const { glb } = fichiersDuModele(id)
      try {
        octets.set(id, readFileSync(join(dossier, glb)))
      } catch (e) {
        erreurs.push(`${glb} : ${e.code ?? e.message}`)
      }
    }
    const manifestes = {}
    const osDesRigides = {}
    for (const { id, brut, verdict } of verdictsDesModeles(lus.entrees, octets)) {
      if (verdict.ok) {
        manifestes[id] = brut
        osDesRigides[id] = [...new Set(lireGlb(octets.get(id)).meshes.flatMap(m => (m.skinne || m.os === null ? [] : [m.os])))]
      } else erreurs.push(`${fichiersDuModele(id).manifeste} : ${verdict.refus.join(' ; ')}`)
    }
    return { manifestes, osDesRigides, erreurs }
  } catch (e) {
    return { manifestes: {}, osDesRigides: {}, erreurs: [`${dossier} : ${e.code ?? e.message}`] }
  }
}
