// LES POSES DES OBJETS RANGÉS D'UNE TENUE (#4351) : le jeu range un objet sur l'emplacement que lui offre la base ou une
// pièce (`MontageDeComposition._ranger`, `pont/CONTRAT.md`, « Atelier 3D »), et cette règle ne vit que dans Godot. Ce
// pont la lui demande pour l'évaluateur (`evaluer.mjs --preset`) et pour le rendu de contrôle
// (`scripts/personnage-3d/rendu.py --preset`) : la tenue se compose comme le pont la compose (`modelesDeLAtelier`,
// `porteeDeComposition`, `composerSurLaBase`) sur les manifestes voisins des GLB donnés, hors dépôt compris, puis
// l'éditeur épinglé la monte et rend la transformation de chaque mesh rangé à chaque instant demandé
// (`poserLesRanges`, `construire.mjs` ; `projet/outils/poses_des_ranges.gd`).
// En ligne de commande, l'entrée standard porte `{ base, manifeste, elements, preset, facteurs?, silhouettes?, clip?, t? }`
// (`facteurs` : ceux du gabarit, les autres aux `FACTEURS_NEUTRES`) et la sortie standard `{ elements, sans }` pour ce
// seul instant, le repos sans `clip` :
//   node hotes/godot/asset/posesDesRanges.mjs < demande.json
import { existsSync, readFileSync } from 'node:fs'
import { basename, resolve } from 'node:path'
import { text } from 'node:stream/consumers'
import { tableTotale } from '../../../src/lib/tableTotale.ts'
import { chargerAssets } from './charger.mjs'

/** Le manifeste d'élément voisin du GLB `glb` (`<id>.element.json` d'un dossier de production, `<id>.manifeste.json`
 *  d'un import), ou `undefined`. */
export const manifesteVoisin = (glb) => [glb.replace(/\.glb$/, '.element.json'), glb.replace(/\.glb$/, '.manifeste.json')].find(existsSync)

const assets = () => chargerAssets([
  "export { modelesDeLAtelier } from '/hotes/godot/pont/atelier.ts';",
  "export { composerSurLaBase } from '/hotes/godot/pont/composition.ts';",
  "export { porteeDeComposition } from '/src/noyau/index.ts';",
  "export { findPresetDePersonnageById } from '/src/data/index.ts';",
  "export { osDesRigides } from '/hotes/godot/asset/release.ts';",
  "export { poseDuGabarit } from '/hotes/godot/asset/gabarit.ts';",
  "export { FACTEURS_NEUTRES } from '/hotes/godot/asset/facteursDuGabarit.ts';",
])

/**
 * Les poses des objets que le preset de personnage `preset` range, sur la base `base` (son GLB) de manifeste
 * `manifeste`, parmi les `elements` (leurs GLB, chacun à côté de son manifeste), à chacun des `instants`
 * (`{ gabarit?, morphes, clip, t }` : `gabarit` et `morphes` de `composer`, `clip` vide au repos).
 * La tenue montée est celle du preset réduite aux éléments donnés. Un élément répété monte, à son k-ième GLB, la k-ième
 * ligne du preset qui le monte.
 * @returns `elements`, par GLB de `elements`, `null` s'il n'a aucun mesh rangé, sinon `{ ligne, meshes, offrants, os }` : sa
 *   ligne de montage ; par nom de nœud, la transformation du mesh dans le repère de la base à chaque instant, en 16
 *   nombres colonne par colonne, `null` quand le jeu ne le montre pas rangé ; les rangs dans `elements` de l'élément
 *   qui offre son emplacement, aucun si la base l'offre, et l'os de cet emplacement ; `sans`, les lignes que le jeu monte d'un élément
 *   donné moins de fois que le preset ne le porte.
 */
export async function posesDesRanges({ base, manifeste, elements, preset, instants }) {
  const a = await assets()
  const composition = a.findPresetDePersonnageById(preset)
  if (!composition) throw new Error(`poses des objets rangés : « ${preset} » n’est aucun preset de personnage`)
  const brut = JSON.parse(readFileSync(manifeste, 'utf8'))
  const ids = elements.map((glb) => basename(glb, '.glb'))
  const chemins = new Map([[brut.base, base]])
  const manifestes = { [brut.base]: brut }
  for (const [k, glb] of elements.entries()) {
    if (chemins.has(ids[k]) && chemins.get(ids[k]) !== glb) throw new Error(`poses des objets rangés : ${ids[k]} donné par deux GLB, ${chemins.get(ids[k])} et ${glb}`)
    chemins.set(ids[k], glb)
    manifestes[ids[k]] = JSON.parse(readFileSync(manifesteVoisin(glb), 'utf8'))
  }
  const modeles = a.modelesDeLAtelier(manifestes, Object.fromEntries([...chemins].map(([id, glb]) => [id, a.osDesRigides(readFileSync(glb))])))
  if (modeles.refus.length) throw new Error(`poses des objets rangés : ${modeles.refus.join(' ; ')}`)
  const { montes } = a.composerSurLaBase(modeles.bases.find((b) => b.id === brut.base), manifestes, a.porteeDeComposition(composition))
  const { poserLesRanges } = await import('../construire.mjs')
  const { pieces, poses } = await poserLesRanges({
    modeles, base: brut.base, montes, instants,
    fichiers: Object.fromEntries([...chemins].map(([id, glb]) => [modeles.fichiers[id].glb, resolve(glb)])),
  })
  const lignes = new Map()
  for (const { ligne, element } of montes) if (element !== null) lignes.set(element, [...(lignes.get(element) ?? []), ligne])
  const donnes = new Map()
  return {
    elements: ids.map((id) => {
      const rang = donnes.get(id) ?? 0
      donnes.set(id, rang + 1)
      const ligne = lignes.get(id)?.[rang]
      const meshes = Object.fromEntries(pieces.flatMap((p, k) => (p.ligne === ligne ? [[p.mesh, poses.map((instant) => instant[k])]] : [])))
      const { offrant, os } = pieces.find((p) => p.ligne === ligne) ?? {}
      return Object.keys(meshes).length ? { ligne, meshes, offrants: ids.flatMap((autre, k) => (autre === offrant ? [k] : [])), os } : null
    }),
    sans: [...lignes].flatMap(([id, montees]) => montees.slice(donnes.get(id) ?? 0)),
  }
}

if (import.meta.main) {
  console.log = console.error
  const { facteurs = {}, silhouettes = {}, clip = '', t = 0, ...demande } = JSON.parse(await text(process.stdin))
  const a = await assets()
  const brut = JSON.parse(readFileSync(demande.manifeste, 'utf8'))
  const morphes = { ...tableTotale(brut.silhouettes ?? [], () => 0), ...silhouettes }
  const gabarit = brut.gabarit ? { gabarit: a.poseDuGabarit(brut, { ...a.FACTEURS_NEUTRES, ...facteurs }, morphes) } : {}
  const { elements, sans } = await posesDesRanges({ ...demande, instants: [{ ...gabarit, morphes, clip, t }] })
  process.stdout.write(JSON.stringify({ elements: elements.map((e) => e && { ligne: e.ligne, meshes: Object.fromEntries(Object.entries(e.meshes).map(([nom, poses]) => [nom, poses[0]])) }), sans }))
}
