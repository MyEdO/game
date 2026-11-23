// LES TOITS DE LA REVUE D'UN KIT DE TOIT (#4471) : par toit de `TOITS`, une croupe d'école (pans de pente 1), une croupe
// en L et une croupe en croix couvertes de la couverture `<couverture>`, ce que le noyau en sert à un hôte : ses pans
// et leurs soffites (`pansDesNappes`, `src/noyau/monde/volume/toits.ts`), des polygones `{ x, y, h }` (cases centrées,
// mètres), et ses pièces de toit posées (`piecesDeToitDeLaScene`, `src/noyau/monde/piecesDeToit.ts`), que
// `toit/revue.py` pose comme l'hôte. Écrit sur la sortie standard `{ metresParCase, toits: { <toit>: { pans, pieces } } }`.
//   node scripts/personnage-3d/toit/poses.mjs <couverture>
import { chargerAssets } from '../../../hotes/godot/asset/charger.mjs'

/** Par toit de la revue, l'emprise de sa masse, en cases, et la pente de ses pans, en degrés. */
const TOITS = {
  'croupe-d-ecole': { footprint: [{ x: 2, y: 2, w: 6, h: 4 }], pitchDeg: 45 },
  'croupe-en-l': { footprint: [{ x: 2, y: 5, w: 8, h: 3 }, { x: 2, y: 2, w: 4, h: 3 }], pitchDeg: 30 },
  'croupe-en-croix': { footprint: [{ x: 5, y: 2, w: 3, h: 9 }, { x: 2, y: 5, w: 9, h: 3 }], pitchDeg: 30 },
}
const COTE = 13

const [couverture] = process.argv.slice(2)
if (!couverture) {
  console.error('usage : node scripts/personnage-3d/toit/poses.mjs <couverture>')
  process.exit(2)
}
const { emptyScene, sceneMetresPerTile, pansDesNappes, piecesDeToitDeLaScene } = await chargerAssets([
  "export { emptyScene, sceneMetresPerTile } from '/src/noyau/monde/scene.ts';",
  "export { pansDesNappes } from '/src/noyau/monde/volume/toits.ts';",
  "export { piecesDeToitDeLaScene } from '/src/noyau/monde/piecesDeToit.ts';",
])
let metresParCase
const toits = Object.fromEntries(Object.entries(TOITS).map(([nom, { footprint, pitchDeg }]) => {
  const scene = emptyScene(`revue-${nom}`, COTE, COTE)
  scene.architecture = [{ id: 'corps', label: 'Corps', style: { id: 'maison' }, storeys: [], facades: [],
    masses: [{ id: 'masse', z: 0, footprint, levels: 1, profile: 'hip', pitchDeg, material: { id: couverture } }] }]
  metresParCase = sceneMetresPerTile(scene)
  const pans = [...pansDesNappes(scene).values()].flat()
    .flatMap((p) => [p.face, ...p.faces.filter((f) => f.material.part === 'soffite')].map((f) => f.poly.map(({ x, y, h }) => ({ x, y, h }))))
  return [nom, { pans, pieces: piecesDeToitDeLaScene(scene) }]
}))
process.stdout.write(JSON.stringify({ metresParCase, toits }))
