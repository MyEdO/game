// LES POLYGONES DES PRIMITIVES D'UNE RECETTE DE DÉCOR (#4335) : `polygonesDePrimitive` de `src/data/schemas/props.types.ts`, la
// seule géométrie du catalogue, appliqué à chaque primitive que `decor/gabarit.py` passe sur l'entrée standard, en JSON
// (`volume.primitives` d'une fiche de `src/data/props.json`). Écrit sur la sortie standard, par primitive, ses faces,
// chacune une liste de points `[xM, yM, hM]`.
//   node scripts/personnage-3d/decor/polygones.mjs < <primitives.json>
import { text } from 'node:stream/consumers'
import { chargerEvaluateur } from '../../../hotes/godot/asset/charger.mjs'

const primitives = JSON.parse(await text(process.stdin))
const { polygonesDePrimitive } = await chargerEvaluateur('../../../../src/data/schemas/props.types.ts')
process.stdout.write(JSON.stringify(primitives.map((p) => polygonesDePrimitive(p).map((face) => face.map(({ xM, yM, hM }) => [xM, yM, hM])))))
