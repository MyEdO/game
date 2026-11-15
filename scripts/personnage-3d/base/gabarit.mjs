import { text } from 'node:stream/consumers'
import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { Bone, Matrix4, Skeleton, Vector3 } from 'three'
import { chargerAssets, chargerEvaluateur } from '../../../hotes/godot/asset/charger.mjs'

const entree = JSON.parse(await text(process.stdin))
if (['etatsAuxFacteursNeutres', 'etatsDuGabarit', 'appuis'].includes(entree.operation) && !Array.isArray(entree.silhouettes)) {
  throw new Error('silhouettes-absentes : liste des silhouettes requise')
}
if (entree.operation === 'silhouettes') {
  const { FEMININ, CORPULENCE, CARRURE_MOINS, CARRURE_PLUS, NOMS_DES_SILHOUETTES } = await chargerEvaluateur('../silhouettes.ts')
  process.stdout.write(JSON.stringify({ FEMININ, CORPULENCE, CARRURE_MOINS, CARRURE_PLUS, NOMS_DES_SILHOUETTES }))
} else if (entree.operation === 'clipsPlantes') {
  const { clipsPlantes } = await chargerEvaluateur('../gabarit.ts')
  process.stdout.write(JSON.stringify(clipsPlantes(entree)))
} else if (entree.operation === 'bornes') {
  const { domaineDuGabarit } = await chargerAssets(["export { domaineDuGabarit } from '/scripts/personnage-3d/base/domaineDuGabarit.ts';"])
  process.stdout.write(JSON.stringify(domaineDuGabarit()))
} else {
  const { etatsAuxFacteursNeutres, etatsDuGabarit } = await chargerEvaluateur('../etatsDuGabarit.ts')
  const { poidsDuGabarit, sensCuitsDuGabarit, cellulesDeSilhouettesAtteignables } = await chargerEvaluateur('../gabarit.ts')
  if (['etatsAuxFacteursNeutres', 'etatsDuGabarit'].includes(entree.operation)) {
    const etats = (entree.operation === 'etatsDuGabarit' ? etatsDuGabarit : etatsAuxFacteursNeutres)(entree.table, entree.silhouettes)
    process.stdout.write(JSON.stringify({ etats, cellulesSilhouettes: cellulesDeSilhouettesAtteignables(entree.table, entree.silhouettes) }))
  } else if (entree.operation === 'appuis') {
    const { grilleDesAppuis } = await chargerEvaluateur('grilleDesAppuis.ts')
    const etats = grilleDesAppuis({ gabarit: entree.table, silhouettes: entree.silhouettes }).map(({ facteurs, silhouettes }, i) => ({
      nom: `appuis_${i}`, facteurs, poidsSilhouettes: silhouettes,
      poidsGabarit: poidsDuGabarit(facteurs, entree.table.bornes, silhouettes),
    }))
    process.stdout.write(JSON.stringify({ etats }))
  } else {
    const { preparerGabarit, matricesDePeauDuGabarit } = await chargerEvaluateur('../../../../scripts/personnage-3d/base/gabarit.ts')
    const { table, corps } = entree
    const bones = corps.squelette.map((b) => {
      const os = new Bone()
      os.name = b.nom
      new Matrix4().fromArray(b.repos).decompose(os.position, os.quaternion, os.scale)
      return os
    })
    corps.squelette.forEach((b, i) => { if (b.parent !== null) bones[b.parent].add(bones[i]) })
    for (const b of bones) b.updateWorldMatrix(true, false)
    const squelette = new Skeleton(bones, corps.squelette.map((b) => new Matrix4().fromArray(b.boneInverse)))
    if (entree.operation === 'matrices') {
      const octets = await readFile(entree.poses)
      const poses = new Float32Array(octets.buffer, octets.byteOffset, octets.byteLength / 4)
      const plantes = [false, ...entree.clips.flatMap(([nom, instants]) => Array(instants).fill(entree.plantes.includes(nom)))]
      const groupes = [], jeux = new Map()
      for (const etat of entree.etats) {
        const aOs = Object.fromEntries(Object.entries(etat.poidsSilhouettes).filter(([nom, w]) => w !== 0 && Object.keys(table.osDesSilhouettes[nom] ?? {}).length).sort(([a], [b]) => (a < b ? -1 : 1)))
        const cle = JSON.stringify([etat.facteurs, aOs])
        let fichier = jeux.get(cle)
        if (!fichier) {
          fichier = join(entree.sortie, `jeu-${jeux.size}.bin`)
          const matrices = matricesDePeauDuGabarit(squelette, table, etat.facteurs, aOs, poses, plantes)
          await writeFile(fichier, new Uint8Array(matrices.buffer))
          jeux.set(cle, fichier)
        }
        let groupe = groupes.find((g) => JSON.stringify(g.facteurs) === JSON.stringify(etat.facteurs))
        if (!groupe) {
          groupe = { facteurs: etat.facteurs, etats: [], fichiers: [], jeux: [] }
          groupes.push(groupe)
        }
        if (!groupe.fichiers.includes(fichier)) groupe.fichiers.push(fichier)
        groupe.etats.push(etat)
        groupe.jeux.push(groupe.fichiers.indexOf(fichier))
      }
      process.stdout.write(JSON.stringify({ groupes }))
    } else {
      const positions = corps.positions.map((p) => new Vector3(...p))
      const solveur = preparerGabarit({ positions, aretes: corps.aretes, poids: corps.poids, squelette, table })
      const silhouettes = corps.silhouettes.map((s) => ({ nom: s.nom, deltas: s.deltas.map((p) => new Vector3(...p)), portage: s.portage.map((p) => new Vector3(...p)) }))
      const sorties = [], deQui = []
      const sensCuits = sensCuitsDuGabarit(table.bornes)
      for (const { cle, sens } of sensCuits) {
        for (const silhouette of [undefined, ...silhouettes]) {
          const cuit = solveur.cuire(cle, sens, silhouette)
          sorties.push({ nom: cuit.nom, deltas: cuit.deltas.map((p) => p.toArray()) })
          deQui.push(silhouette?.nom ?? null)
        }
      }
      if (entree.operation === 'cles') {
        process.stdout.write(JSON.stringify({ cles: sorties, silhouettes: deQui }))
      } else {
        const mesures = etatsDuGabarit(table, silhouettes.map((s) => s.nom)).map((etat) => {
          const repos = positions.map((p, i) => silhouettes.reduce((somme, s) => somme.addScaledVector(s.deltas[i], etat.poidsSilhouettes[s.nom]), p.clone()))
          return { ...etat, positions: solveur.resoudre(etat.facteurs, repos).map((p, i) => silhouettes.reduce((somme, s) => somme.addScaledVector(s.portage[i], etat.poidsSilhouettes[s.nom]), p).toArray()) }
        })
        process.stdout.write(JSON.stringify({ cles: sorties, etats: mesures, cellulesSilhouettes: cellulesDeSilhouettesAtteignables(table, silhouettes.map((s) => s.nom)), sensCuits: sensCuits.length, ancres: solveur.ancres.filter(Boolean).length }))
      }
    }
  }
}
