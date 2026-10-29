// LES ANNEAUX ARTICULAIRES DU CORPS EN CONSTRUCTION (#2972, #3101) : `anneauxArticulaires` et `sectionsDeRepos` de la
// garde (`hotes/godot/asset/evaluateur/gardes/silhouettes.ts`) appelés sur le maillage que la construction Blender
// (`silhouettes.py`) lit sur l'entrée standard, en JSON :
// - `os` : par os, `nom`, `parent` (nom, ou null) et `matrice`, sa matrice monde de repos (16 nombres, par colonnes) ;
// - `corps` : par corps, `nom`, `positions` (x, y, z monde de repos à plat), `indices` et `poids`
//   (`INFLUENCES_MAX` influences par sommet, `gardes/poids.ts`, à plat).
// Écrit sur la sortie standard `anneaux` (os, sommets, centre, rayon, axe de chaque anneau, au repos) et `lePlusEpais`
// (`anneauLePlusEpais`, son indice dans `anneaux`).
//   node scripts/personnage-3d/base/anneaux.mjs < <maillage.json>
import { text } from 'node:stream/consumers'
import { Bone, BufferGeometry, Float32BufferAttribute, Matrix4, Skeleton, SkinnedMesh, Uint16BufferAttribute } from 'three'
import { chargerEvaluateur } from '../../../hotes/godot/asset/charger.mjs'

/** Le squelette du vidage `os`, os par nom, hiérarchie posée. */
function squelette(os) {
  const parNom = new Map(os.map(({ nom }) => [nom, Object.assign(new Bone(), { name: nom })]))
  for (const { nom, parent } of os) {
    if (parent === null) continue
    const p = parNom.get(parent)
    if (!p) throw new Error(`anneaux : parent ${parent} de ${nom} absent du vidage`)
    p.add(parNom.get(nom))
  }
  return new Skeleton([...parNom.values()])
}

/** Le `SkinnedMesh` du corps `corps` sur `skeleton`, `influences` par sommet. */
function maillage(corps, skeleton, influences) {
  const n = corps.positions.length / 3
  if (corps.indices.length !== n * influences || corps.poids.length !== n * influences) throw new Error(`anneaux : ${corps.nom}, ${influences} influences par sommet attendues`)
  const geometrie = new BufferGeometry()
  geometrie.setAttribute('position', new Float32BufferAttribute(corps.positions, 3))
  geometrie.setAttribute('skinIndex', new Uint16BufferAttribute(corps.indices, influences))
  geometrie.setAttribute('skinWeight', new Float32BufferAttribute(corps.poids, influences))
  const mesh = Object.assign(new SkinnedMesh(geometrie), { name: corps.nom })
  mesh.skeleton = skeleton
  return mesh
}

async function main() {
  const { os, corps } = JSON.parse(await text(process.stdin))
  const [{ anneauxArticulaires, sectionsDeRepos, anneauLePlusEpais }, { INFLUENCES_MAX }] = await Promise.all([
    chargerEvaluateur('gardes/silhouettes.ts'), chargerEvaluateur('gardes/poids.ts')])
  const skeleton = squelette(os)
  const anneaux = anneauxArticulaires(corps.map((c) => maillage(c, skeleton, INFLUENCES_MAX)))
  const repos = {
    positions: new Map(corps.map((c) => [c.nom, Float32Array.from(c.positions)])),
    os: new Map(os.map(({ nom, matrice }) => [nom, new Matrix4().fromArray(matrice)])),
  }
  const sections = sectionsDeRepos(anneaux, repos)
  process.stdout.write(JSON.stringify({
    anneaux: anneaux.map((a, i) => ({ ...a, ...sections[i] })),
    lePlusEpais: anneaux.length ? anneauLePlusEpais(sections) : null,
  }))
}

main().catch((erreur) => {
  console.error(erreur instanceof Error ? erreur.message : String(erreur))
  process.exit(1)
})
