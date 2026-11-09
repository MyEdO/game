// LE DOSSIER DES MODÈLES ET SON LISTAGE (#2987, `pont/CONTRAT.md`, section « Atelier 3D ») : ce que `GET modeles/listage.json`
// de `servir.mjs` rend, ce que la sonde de `construire.mjs` fige pour la recette du véhicule, et le dossier `modeles/` que
// son export Web dépose à côté de la page (#3778). Sans écrivain : la gate `pont:godot` l'atteint par `construire.mjs`.
import { cpSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { chargerAssets } from './asset/charger.mjs'

const { DOSSIER_DES_MODELES, fichiersDuModele, lireGlb, manifestesDesModeles, verdictsDesModeles } = await chargerAssets([
  "export { lireGlb } from '/hotes/godot/asset/glb.ts';",
  "export { manifestesDesModeles } from '/hotes/godot/asset/release.ts';",
  "export { fichiersDuModele, verdictsDesModeles } from '/hotes/godot/asset/modeles.ts';",
])

export { DOSSIER_DES_MODELES }

/**
 * @contrat Atelier 3D
 * L'atelier dessine les bases et leurs éléments d'après la réponse de `modeles`, jamais en relisant les manifestes
 * lui-même. Le pck exporté est figé et ne porte pas `modeles/` (`exclude_filter` de `export_presets.cfg`) : l'atelier
 * tire les modèles par HTTP, à côté de `index.html`, et un GLB réexporté se recharge à chaud. L'export
 * (`construire.mjs --export`) dépose à côté de la page le dossier des modèles et son listage (`deposerLesModeles`,
 * `hotes/godot/listage.mjs`), un site statique que `deploy.yml` publie ; le serveur de l'export
 * (`hotes/godot/servir.mjs`) sert les mêmes adresses depuis le dossier vivant :
 *
 * - `GET modeles/listage.json` : le listage,
 *   `{ manifestes: Record<id, manifeste>, osDesRigides: Record<id, string[]>, erreurs: string[] }`, relu à chaque
 *   appel par le serveur, en `Cache-Control: no-store`. `manifestes` ne porte que les manifestes que
 *   `verdictsDesModeles` (`asset/modeles.ts`, la validation de `recupererModeles`) accepte contre leur GLB.
 *   `osDesRigides` porte, pour chaque manifeste de `manifestes`, les os qui portent ses meshes rigides : les `os`
 *   sans doublon des `meshes` sans skin (`lireGlb`, `asset/glb.ts`), le nom de l'articulation dont chacun pend, liste
 *   vide pour un modèle dont aucun mesh non skinné ne pend à une articulation d'un skin. `lireGlb` tient pour
 *   illisible un GLB dont un tableau ou une entrée est mal formé (un mesh sans `primitives`, un skin sans `joints`
 *   compris), dont un indice sort de sa liste, dont un nœud à mesh n'a pas de nom, dont deux nœuds portent le même
 *   nom, dont un nœud a plusieurs parents, dont la parenté boucle ou dont une racine de scène a un parent. `erreurs`
 *   porte, une ligne chacun, le manifeste illisible, le GLB illisible, le refus d'un manifeste et le dossier des
 *   modèles illisible. Godot passe `manifestes` et `osDesRigides` tels quels à `modeles`, qui ne les revalide pas :
 *   la validation et la lecture des os lisent le GLB, côté Node : au serveur à chaque appel, à l'export une fois.
 * - `GET modeles/<fichier>` : chaque fichier du dossier des modèles (manifeste, GLB), servi en
 *   `Cache-Control: no-store`. Un chemin hors du dossier ou qui ne s'ouvre pas en fichier reçoit 404.
 * - Une URI malformée reçoit 400. Le serveur continue après toute requête défaillante.
 */

/** Le fichier du listage, sous `modeles/` à côté de la page. */
export const LISTAGE = 'listage.json'

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

/** Le dossier des modèles `dossier` copié sous `modeles/` de `sortie`, avec son listage (`LISTAGE`) : ce que `servir.mjs` sert
 *  sous `modeles/`, en fichiers statiques. */
export function deposerLesModeles(dossier, sortie) {
  const cible = join(sortie, 'modeles')
  cpSync(dossier, cible, { recursive: true })
  writeFileSync(join(cible, LISTAGE), JSON.stringify(listage(dossier)))
}
