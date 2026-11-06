#!/usr/bin/env node
// LE VERSEMENT DES TEXTURES DU SOL (#3476, lot E) : verse dans la Release des modèles (`asset/release.ts`, par `gh`)
// chaque texture que la provenance commitée du dossier des textures épingle (`asset/textures.ts`) et que la Release ne
// porte pas encore, puis dit les noms versés.
//
//   node hotes/godot/textures.mjs
import { chargerAssets } from './asset/charger.mjs'

const { publierAssets, texturesAPublier, TAG } = await chargerAssets(["export { texturesAPublier } from '/hotes/godot/asset/textures.ts';"])

const verses = publierAssets(texturesAPublier())
console.log(verses.length ? `[textures] versées dans la Release ${TAG} : ${verses.join(', ')}` : `[textures] la Release ${TAG} les porte toutes`)
