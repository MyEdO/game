// LES POSES DES OBJETS RANGÉS D'UNE TENUE (#4351) : le jeu range un objet sur l'emplacement que lui offre la base ou une
// pièce (`MontageDeComposition._ranger`, `pont/CONTRAT.md`, « Atelier 3D »), et cette règle ne vit que dans Godot. Ce
// pont la lui demande pour l'évaluateur (`evaluer.mjs --preset`) et pour le rendu de contrôle
// (`scripts/personnage-3d/rendu.py --preset`) : la tenue se compose comme le pont la compose (`modelesDeLAtelier`,
// `porteeDeComposition`, `composerSurLaBase`) sur les manifestes voisins des GLB donnés, hors dépôt compris, puis
// l'éditeur épinglé la monte et rend la transformation de chaque mesh rangé à chaque instant demandé
// (`poserLesRanges`, `construire.mjs` ; `projet/outils/poses_des_ranges.gd`).
// La tenue d'un preset se résout aussi en GLB (`tenueDesGlb`, #4338), pour `evaluer.mjs --tenue` et `rendu.py --tenue`.
// En ligne de commande, l'entrée standard porte
// `{ base, manifeste, elements?, preset, tenue?, locales?, facteurs?, silhouettes?, clip?, t? }` (`tenue` : la tenue du
// preset avant les `elements`, `locales` les paires de `--local` ; `facteurs` : ceux du gabarit, les autres aux
// `FACTEURS_NEUTRES` ; `silhouettes` : celles de `--silhouettes`) et la sortie standard
// `{ elements, sans, silhouettes, palette, glbs }` pour ce seul instant (`posesALInstant`), le repos sans `clip`,
// `silhouettes` étant celles que l'instant pose (`silhouettesSousLePreset`), `palette` la couleur `#rrggbb` de chaque
// emplacement que le preset colore (`paletteDesCouleurs` de sa portée) et `glbs` les GLB posés, dans l'ordre
// d'`elements` ; sans élément, aucun mesh rangé ne se pose :
//   node hotes/godot/asset/posesDesRanges.mjs < demande.json
import { existsSync, readFileSync } from 'node:fs'
import { basename, dirname, join, resolve } from 'node:path'
import { text } from 'node:stream/consumers'
import { tableTotale } from '../../../src/lib/tableTotale.ts'
import { listage } from '../listage.mjs'
import { chargerAssets } from './charger.mjs'

/** Le manifeste d'élément voisin du GLB `glb` (`<id>.element.json` d'un dossier de production, `<id>.manifeste.json`
 *  d'un import), ou `undefined`. */
export const manifesteVoisin = (glb) => [glb.replace(/\.glb$/, '.element.json'), glb.replace(/\.glb$/, '.manifeste.json')].find(existsSync)

let assetsCharges = null
const assets = () => (assetsCharges ??= chargerAssets([
  "export { modelesDeLAtelier } from '/hotes/godot/pont/atelier.ts';",
  "export { composerSurLaBase, paletteDesCouleurs } from '/hotes/godot/pont/composition.ts';",
  "export { porteeDuPreset, tenueDuPreset } from '/hotes/godot/asset/tenue.ts';",
  "export { fichiersDuModele } from '/hotes/godot/asset/modeles.ts';",
  "export { osDesRigides } from '/hotes/godot/asset/release.ts';",
  "export { poseDuGabarit } from '/hotes/godot/asset/gabarit.ts';",
  "export { FACTEURS_NEUTRES } from '/hotes/godot/asset/facteursDuGabarit.ts';",
]))

/** La portée du preset de personnage `preset` (`porteeDuPreset`, `tenue.ts`). */
const porteeDuPreset = async (preset) => (await assets()).porteeDuPreset(preset)

/** Les GLB locaux de `--local <id>=<glb>` (répétable, la syntaxe de `element/construire.py --local`) : `{ id: chemin }`,
 *  chaque id une fois, chaque GLB nommé `<id>.glb` à côté de son manifeste d'élément (`manifesteVoisin`). Lève sinon. */
export function lireLocales(paires = []) {
  const locales = {}
  for (const paire of paires) {
    const [id, glb, ...reste] = paire.split('=')
    if (!id || !glb || reste.length || Object.hasOwn(locales, id)) throw new Error(`--local « ${paire} » : attendu <id>=<glb>, une fois par id`)
    if (basename(glb, '.glb') !== id || !existsSync(glb) || !manifesteVoisin(glb)) throw new Error(`--local « ${paire} » : attendu ${id}.glb à côté de ${id}.element.json ou ${id}.manifeste.json`)
    locales[id] = resolve(glb)
  }
  return locales
}

/**
 * La tenue du preset de personnage `preset` sur la base de manifeste `manifeste` : les GLB de ce que le jeu monte
 * (`tenueDuPreset`, `tenue.ts`), dans l'ordre de ses lignes, pris au dossier de ce manifeste (`listage`), chaque élément
 * de `locales` (`lireLocales`) lu à son GLB local ; un élément local que le preset ne monte pas vient à la fin. Lève si
 * le listage du dossier a une erreur (un GLB non récupéré : `node hotes/godot/asset/recuperer-modeles.mjs`).
 */
export async function tenueDesGlb({ manifeste, preset, locales = {} }) {
  const a = await assets()
  const dossier = dirname(resolve(manifeste))
  const { manifestes, osDesRigides, erreurs } = await listage(dossier)
  if (erreurs.length) throw new Error(`tenue du preset ${preset} : listage de ${dossier} :\n  ${erreurs.join('\n  ')}`)
  for (const [id, glb] of Object.entries(locales)) {
    manifestes[id] = JSON.parse(readFileSync(manifesteVoisin(glb), 'utf8'))
    osDesRigides[id] = a.osDesRigides(readFileSync(glb))
  }
  const ids = a.tenueDuPreset(preset, basename(manifeste, a.fichiersDuModele('').manifeste), manifestes, osDesRigides)
  const glbDe = (id) => locales[id] ?? join(dossier, a.fichiersDuModele(id).glb)
  return [...ids.map(glbDe), ...Object.keys(locales).filter((id) => !ids.includes(id)).map(glbDe)]
}

/** Les poids de `--silhouettes` sous le preset de personnage `preset` : les formes de la tête que le jeu pose au preset
 *  (`formesDeTete` de sa portée, versées dans les `morphes` de `composerSurLaBase`), chacune remplacée par le poids que
 *  `silhouettes` lui donne. */
export const silhouettesSousLePreset = async (preset, silhouettes = {}) => ({ ...(await porteeDuPreset(preset)).formesDeTete, ...silhouettes })

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
  const portee = await porteeDuPreset(preset)
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
  const { montes } = a.composerSurLaBase(modeles.bases.find((b) => b.id === brut.base), manifestes, portee)
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

/** Les poses des objets que le preset `preset` range parmi les `elements` (`posesDesRanges`) à un seul instant : au repos
 *  sans `clip`, sinon à l'instant `t` de ce clip, sous les `facteurs` du gabarit (les autres aux `FACTEURS_NEUTRES`) et
 *  les poids `silhouettes` sous le preset (`silhouettesSousLePreset`) ; `elements` porte, par GLB, `null` ou
 *  `{ ligne, meshes }`, chaque mesh à sa seule transformation ; `silhouettes`, les poids que l'instant pose. */
export async function posesALInstant({ base, manifeste, elements, preset, facteurs = {}, silhouettes: explicites, clip = '', t = 0 }) {
  const a = await assets()
  const silhouettes = await silhouettesSousLePreset(preset, explicites)
  if (!elements.length) return { elements: [], sans: [], silhouettes }
  const brut = JSON.parse(readFileSync(manifeste, 'utf8'))
  const morphes = { ...tableTotale(brut.silhouettes ?? [], () => 0), ...silhouettes }
  const gabarit = brut.gabarit ? { gabarit: a.poseDuGabarit(brut, { ...a.FACTEURS_NEUTRES, ...facteurs }, morphes) } : {}
  const poses = await posesDesRanges({ base, manifeste, elements, preset, instants: [{ ...gabarit, morphes, clip, t }] })
  return {
    elements: poses.elements.map((e) => e && { ligne: e.ligne, meshes: Object.fromEntries(Object.entries(e.meshes).map(([nom, [pose]]) => [nom, pose])) }),
    sans: poses.sans,
    silhouettes,
  }
}

if (import.meta.main) {
  console.log = console.error
  const { tenue = false, locales, elements = [], ...demande } = JSON.parse(await text(process.stdin))
  const glbs = tenue ? [...await tenueDesGlb({ manifeste: demande.manifeste, preset: demande.preset, locales: lireLocales(locales) }), ...elements] : elements
  const palette = (await assets()).paletteDesCouleurs((await porteeDuPreset(demande.preset)).couleurs)
  process.stdout.write(JSON.stringify({ ...await posesALInstant({ ...demande, elements: glbs }), palette, glbs }))
}
