import { text } from 'node:stream/consumers'
import { Bone, Matrix4, Skeleton, Vector3 } from 'three'
import { chargerAssets } from '../../../hotes/godot/asset/charger.mjs'

const entree = JSON.parse(await text(process.stdin))
const { preparerGabarit, domaineDuGabarit, FACTEURS_NEUTRES, FEMININ, CORPULENCE, CARRURE_MOINS, CARRURE_PLUS, poidsDuGabarit, poidsDeSilhouettes, sensCuitsDuGabarit, CLES_DU_GABARIT, BUILD_NEUTRE } = await chargerAssets([
  "export { preparerGabarit } from '/scripts/personnage-3d/base/gabarit.ts';",
  "export { domaineDuGabarit } from '/scripts/personnage-3d/base/domaineDuGabarit.ts';",
  "export { FACTEURS_NEUTRES, FEMININ, CORPULENCE, CARRURE_MOINS, CARRURE_PLUS, poidsDuGabarit, poidsDeSilhouettes, sensCuitsDuGabarit } from '/hotes/godot/asset/gabarit.ts';",
  "export { CLES_DU_GABARIT } from '/hotes/godot/asset/manifesteDeBase.ts';",
  "export { BUILD_NEUTRE } from '/src/lib/corpulence.ts';",
])
if (entree.operation === 'bornes') {
  process.stdout.write(JSON.stringify(domaineDuGabarit()))
} else {
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
  const positions = corps.positions.map((p) => new Vector3(...p))
  const solveur = preparerGabarit({ positions, aretes: corps.aretes, poids: corps.poids, squelette, table })
  const silhouettes = corps.silhouettes.map((s) => ({ nom: s.nom, deltas: s.deltas.map((p) => new Vector3(...p)) }))
  const sorties = []
  const sensCuits = sensCuitsDuGabarit(table.bornes)
  for (const { cle, sens } of sensCuits) {
    for (const silhouette of [undefined, ...silhouettes]) {
      const cuit = solveur.cuire(cle, sens, silhouette)
      sorties.push({ nom: cuit.nom, deltas: cuit.deltas.map((p) => p.toArray()) })
    }
  }
  const neutre = { sex: 'M', build: BUILD_NEUTRE, st: FACTEURS_NEUTRES.st }
  const choix = [
    { nom: 'neutre', ...neutre },
    { nom: FEMININ, ...neutre, sex: 'F' },
    { nom: CORPULENCE, ...neutre, build: 1 },
    { nom: CARRURE_MOINS, ...neutre, st: table.st.min },
    { nom: CARRURE_PLUS, ...neutre, st: table.st.max },
  ].filter((s) => s.nom === 'neutre' || silhouettes.some((c) => c.nom === s.nom))
  const etats = []
  for (const b of sensCuits) {
    const nom = `${b.cle}_${b.sens}`
    for (const s of choix) etats.push({ nom: `${nom}__${s.nom}`, pointCuisson: s.nom === 'neutre', facteurs: { ...FACTEURS_NEUTRES, [b.cle]: b.extremite }, silhouette: s })
    etats.push({ nom: `${nom}__milieu`, pointCuisson: false, facteurs: { ...FACTEURS_NEUTRES, [b.cle]: (FACTEURS_NEUTRES[b.cle] + b.extremite) / 2 }, silhouette: neutre })
  }
  const combinaisons = CLES_DU_GABARIT.reduce((etats, cle) => etats.flatMap((etat) =>
    sensCuits.filter((b) => b.cle === cle).map((b) => ({
      nom: `${etat.nom}_${cle}_${b.sens}`,
      facteurs: { ...etat.facteurs, [cle]: (FACTEURS_NEUTRES[cle] + b.extremite) / 2 },
    }))), [{ nom: 'combinaison', facteurs: FACTEURS_NEUTRES }])
  for (const combinaison of combinaisons) etats.push({ ...combinaison, pointCuisson: false,
    silhouette: { sex: 'F', build: (BUILD_NEUTRE + 1) / 2, st: (FACTEURS_NEUTRES.st + table.st.max) / 2 } })
  const mesures = etats.map((etat) => {
    const tous = poidsDeSilhouettes(etat.silhouette, table)
    const poidsSilhouettes = Object.fromEntries(silhouettes.map((s) => [s.nom, tous[s.nom]]))
    const poidsGabarit = poidsDuGabarit(etat.facteurs, table.bornes, poidsSilhouettes)
    const repos = positions.map((p, i) => silhouettes.reduce((somme, s) => somme.addScaledVector(s.deltas[i], poidsSilhouettes[s.nom]), p.clone()))
    return { nom: etat.nom, pointCuisson: etat.pointCuisson, facteurs: etat.facteurs, poidsSilhouettes, poidsGabarit, positions: solveur.resoudre(etat.facteurs, repos).map((p) => p.toArray()) }
  })
  process.stdout.write(JSON.stringify({ cles: sorties, etats: mesures, sensCuits: sensCuits.length, ancres: solveur.ancres.filter(Boolean).length }))
}
