#!/usr/bin/env node
// LE VERSEMENT DES DOSSIERS ÉPINGLÉS (#3476) : verse dans la Release des modèles (`asset/release.ts`, par `gh`) chaque
// fichier que la provenance commitée d'un dossier épinglé du projet Godot (textures du sol, kit des arêtes :
// `asset/epingles.ts`) épingle et que la Release ne porte pas encore, puis dit les noms versés.
//
//   node hotes/godot/epingles.mjs
import { chargerAssets } from './asset/charger.mjs'

const { publierAssets, epinglesAPublier, TAG } = await chargerAssets(["export { epinglesAPublier } from '/hotes/godot/asset/epingles.ts';"])

const verses = publierAssets(epinglesAPublier())
console.log(verses.length ? `[épinglés] versés dans la Release ${TAG} : ${verses.join(', ')}` : `[épinglés] la Release ${TAG} les porte tous`)
