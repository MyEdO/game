import { text } from 'node:stream/consumers'
import { Bone, Matrix4, Skeleton, Vector3 } from 'three'
import { chargerAssets } from '../../../hotes/godot/asset/charger.mjs'

const entree = JSON.parse(await text(process.stdin))
const { preparerGabarit, domaineDuGabarit, FACTEURS_NEUTRES, poidsDuGabarit, poidsDeSilhouettes, CLES_DU_GABARIT, BUILD_NEUTRE, tableTotale } = await chargerAssets([
  "export { preparerGabarit } from '/scripts/personnage-3d/base/gabarit.ts';",
  "export { domaineDuGabarit } from '/scripts/personnage-3d/base/domaineDuGabarit.ts';",
  "export { FACTEURS_NEUTRES, poidsDuGabarit, poidsDeSilhouettes } from '/hotes/godot/asset/gabarit.ts';",
  "export { CLES_DU_GABARIT } from '/hotes/godot/asset/manifesteDeBase.ts';",
  "export { BUILD_NEUTRE } from '/src/lib/corpulence.ts';",
  "export { tableTotale } from '/src/lib/tableTotale.ts';",
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
  const bornes = []
  for (const cle of CLES_DU_GABARIT) for (const sens of ['moins', 'plus']) {
    const f = table.bornes[cle][sens === 'moins' ? 'min' : 'max']
    if (f === 1) continue
    bornes.push({ nom: `${cle}_${sens}`, cle, f })
    for (const silhouette of [undefined, ...silhouettes]) {
      const cuit = solveur.cuire(cle, sens, silhouette)
      sorties.push({ nom: cuit.nom, deltas: cuit.deltas.map((p) => p.toArray()) })
    }
  }
  const neutre = { sex: 'M', build: BUILD_NEUTRE, st: 1 }
  const choix = [
    { nom: 'neutre', ...neutre },
    { nom: 'feminin', ...neutre, sex: 'F' },
    { nom: 'corpulence', ...neutre, build: 1 },
    { nom: 'carrure_moins', ...neutre, st: table.st.min },
    { nom: 'carrure_plus', ...neutre, st: table.st.max },
  ].filter((s) => s.nom === 'neutre' || silhouettes.some((c) => c.nom === s.nom))
  const etats = []
  for (const b of bornes) {
    for (const s of choix) etats.push({ nom: `${b.nom}__${s.nom}`, facteurs: { ...FACTEURS_NEUTRES, [b.cle]: b.f }, silhouette: s })
    etats.push({ nom: `${b.nom}__milieu`, facteurs: { ...FACTEURS_NEUTRES, [b.cle]: (1 + b.f) / 2 }, silhouette: neutre })
  }
  etats.push({ nom: 'combinaison', facteurs: { ...FACTEURS_NEUTRES, ...tableTotale(CLES_DU_GABARIT, (k) => (1 + table.bornes[k].max) / 2) }, silhouette: { sex: 'F', build: 0.8, st: (1 + table.st.max) / 2 } })
  const mesures = etats.map((etat) => {
    const tous = poidsDeSilhouettes(etat.silhouette, table)
    const poidsSilhouettes = Object.fromEntries(silhouettes.map((s) => [s.nom, tous[s.nom]]))
    const poids = { ...poidsSilhouettes, ...poidsDuGabarit(etat.facteurs, table.bornes, poidsSilhouettes) }
    const repos = positions.map((p, i) => silhouettes.reduce((somme, s) => somme.addScaledVector(s.deltas[i], poidsSilhouettes[s.nom]), p.clone()))
    return { nom: etat.nom, facteurs: etat.facteurs, poids, positions: solveur.resoudre(etat.facteurs, repos).map((p) => p.toArray()) }
  })
  process.stdout.write(JSON.stringify({ cles: sorties, etats: mesures, ancres: solveur.ancres.filter(Boolean).length }))
}
