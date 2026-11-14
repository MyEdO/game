// LE DOSSIER DES MODÈLES ET SON LISTAGE (#2987, `pont/CONTRAT.md`, section « Atelier 3D ») : ce que `GET modeles/listage.json`
// de `servir.mjs` rend, ce que la sonde de `construire.mjs` fige pour la recette du véhicule, et le dossier `modeles/` que
// son export Web dépose à côté de la page (#3778), chaque modèle en scène fabriquée de son GLB (#3946). Sans écrivain :
// la gate `pont:godot` l'atteint par `construire.mjs`.
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
 * (`hotes/godot/servir.mjs`) sert les mêmes adresses depuis le dossier vivant, ou, lancé avec `--statique`, l'export
 * tel que le site le publie :
 *
 * - `GET modeles/listage.json` : le listage,
 *   `{ manifestes: Record<id, manifeste>, osDesRigides: Record<id, string[]>, erreurs: string[], forme }`, que le
 *   serveur du dossier vivant calcule à son lancement puis à nouveau quand un fichier du dossier change, en
 *   `Cache-Control: no-store`. `forme` nomme le fichier de
 *   `fichiers` (réponse de `modeles`) que Godot demande pour chaque modèle : `glb` au dossier vivant, que Godot lit à
 *   l'exécution ; `scene` au dossier déposé par l'export, qui ne porte aucun GLB mais, pour chaque modèle du listage,
 *   la scène que Godot en a fabriquée à l'export (`projet/outils/fabrique_de_modeles.gd`) : la scène lue comme à
 *   l'exécution, ses textures compressées (S3TC, RGTC pour les normales) avec leurs mipmaps, enregistrée telle que
 *   Godot la charge (#3946). `manifestes` ne porte que les manifestes que
 *   `verdictsDesModeles` (`asset/modeles.ts`, la validation de `recupererModeles`) accepte contre leur GLB.
 *   `osDesRigides` porte, pour chaque manifeste de `manifestes`, les os qui portent ses meshes rigides : les `os`
 *   sans doublon des `meshes` sans skin (`lireGlb`, `asset/glb.ts`), le nom de l'articulation dont chacun pend, liste
 *   vide pour un modèle dont aucun mesh non skinné ne pend à une articulation d'un skin. `lireGlb` tient pour
 *   illisible un GLB dont un tableau ou une entrée est mal formé (un mesh sans `primitives`, un skin sans `joints`
 *   compris), dont un indice sort de sa liste, dont un nœud à mesh n'a pas de nom, dont deux nœuds portent le même
 *   nom, dont un nœud a plusieurs parents, dont la parenté boucle ou dont une racine de scène a un parent. `erreurs`
 *   porte, une ligne chacun, le manifeste illisible, le GLB illisible, le refus d'un manifeste et le dossier des
 *   modèles illisible. Godot passe `manifestes` et `osDesRigides` tels quels à `modeles`, qui ne les revalide pas :
 *   la validation et la lecture des os lisent le GLB, côté Node : au serveur à chaque changement du dossier, à l'export une fois.
 * - `GET modeles/<fichier>` : chaque fichier du dossier des modèles (manifeste, GLB ou scène fabriquée), servi en
 *   `Cache-Control: no-store` par le serveur du dossier vivant. Un chemin hors du dossier ou qui ne s'ouvre pas en
 *   fichier reçoit 404.
 * - Une URI malformée reçoit 400. Le serveur continue après toute requête défaillante.
 */

/** Le fichier du listage, sous `modeles/` à côté de la page. */
export const LISTAGE = 'listage.json'

/** Le listage de `dossier`, servi en GLB : les manifestes que `verdictsDesModeles` accepte contre leur GLB, de chacun les
 *  os qui portent ses meshes rigides (`os` des `meshes` sans skin de `lireGlb`), et les erreurs (manifeste illisible, GLB
 *  illisible, refus, dossier illisible). */
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
    return { manifestes, osDesRigides, erreurs, forme: 'glb' }
  } catch (e) {
    return { manifestes: {}, osDesRigides: {}, erreurs: [`${dossier} : ${e.code ?? e.message}`], forme: 'glb' }
  }
}

/** Le dossier des modèles `dossier` déposé sous `modeles/` de `sortie`, en fichiers statiques : ses fichiers sans ses GLB
 *  ni leur fiche d'import par Godot (`<glb>.import`), son listage (`LISTAGE`) en forme `scene`, et la scène de chaque modèle du listage, que `fabriquer` reçoit à
 *  fabriquer (`{ id, glb, scene }` : le GLB à lire, la scène à écrire). Rend ce que `fabriquer` rend. */
export function deposerLesModeles(dossier, sortie, fabriquer) {
  const cible = join(sortie, 'modeles')
  const glb = fichiersDuModele('').glb
  cpSync(dossier, cible, { recursive: true, filter: (source) => !source.endsWith(glb) && !source.endsWith(`${glb}.import`) })
  const servi = listage(dossier)
  writeFileSync(join(cible, LISTAGE), JSON.stringify({ ...servi, forme: 'scene' }))
  return fabriquer(Object.keys(servi.manifestes).map((id) => {
    const { glb, scene } = fichiersDuModele(id)
    return { id, glb: join(dossier, glb), scene: join(cible, scene) }
  }))
}
