#!/usr/bin/env node
// L'ASSEMBLAGE DU KIT DES ARÊTES (#3476, lot C) : depuis l'archive extraite du pack du kit (`asset/kit.ts`, `PACK`),
// écrit le kit au projet Godot (`projet/kit/kit.glb`) et l'épingle dans sa provenance ; `npm run godot:epingles` le
// verse ensuite dans la Release.
//
//   node hotes/godot/kit.mjs <dossier de l'archive extraite>
import { chargerAssets } from './asset/charger.mjs'

const [pack] = process.argv.slice(2)
if (!pack) {
  console.error('usage : node hotes/godot/kit.mjs <dossier de l’archive extraite du pack>')
  process.exit(1)
}
const { ecrireLeKit } = await chargerAssets(["export { ecrireLeKit } from '/hotes/godot/asset/kit.ts';"])
console.log(`[kit] écrit et épinglé : ${ecrireLeKit(pack)}`)
