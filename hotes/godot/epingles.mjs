#!/usr/bin/env node
// LE VERSEMENT DES FICHIERS ÉPINGLÉS (#3476, #2987) : verse dans la Release des modèles (`asset/release.ts`, par `gh`)
// chaque fichier que la provenance commitée épingle et que la Release ne porte pas encore, puis dit les noms versés :
// ceux des dossiers épinglés du projet Godot (textures, kit des arêtes : `asset/epingles.ts`) et le GLB de chaque modèle
// épinglé (`modelesAPublier`). Le workflow `transfert.yml` le joue au push d'une branche `transfert/<x>`.
//
//   node hotes/godot/epingles.mjs
import { chargerAssets } from './asset/charger.mjs'

const { publierAssets, epinglesAPublier, modelesAPublier, TAG } = await chargerAssets([
  "export { epinglesAPublier } from '/hotes/godot/asset/epingles.ts';",
  "export { modelesAPublier } from '/hotes/godot/asset/release.ts';",
])

const verses = publierAssets([...epinglesAPublier(), ...modelesAPublier()])
console.log(verses.length ? `[épinglés] versés dans la Release ${TAG} : ${verses.join(', ')}` : `[épinglés] la Release ${TAG} les porte tous`)
