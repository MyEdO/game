#!/usr/bin/env node
// LE TRANSFERT DE FICHIERS ÉPINGLÉS (#4746) : la commande de `fabriquerTransfert` (`asset/transfert.ts`). Elle
// fabrique, sans toucher l'index ni l'arbre de travail, le commit fils de HEAD qui ajoute de force les fichiers nommés
// (GLB d'un modèle, texture ou son d'un dossier épinglé) et leur provenance, puis imprime la commande qui le pousse en
// `transfert/<nom>` (`.github/workflows/transfert.yml`), sans la lancer.
//
//   node hotes/godot/transfert.mjs <nom> <fichier>...
import { existsSync } from 'node:fs'
import { relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chargerAssets } from './asset/charger.mjs'

const USAGE = 'Usage : node hotes/godot/transfert.mjs <nom> <fichier>...'
const RACINE = fileURLToPath(new URL('../..', import.meta.url))
const [nom, ...nommes] = process.argv.slice(2)
const absents = nommes.filter((f) => !existsSync(resolve(f)))
if (!nom || !nommes.length || absents.length) {
  if (absents.length) console.error(`fichiers introuvables : ${absents.join(', ')}`)
  console.error(USAGE)
  process.exit(2)
}
const { fabriquerTransfert, commandeDEnvoi } = await chargerAssets(["export { fabriquerTransfert, commandeDEnvoi } from '/hotes/godot/asset/transfert.ts';"])
try {
  const fichiers = nommes.map((f) => relative(RACINE, resolve(f)).split('\\').join('/'))
  console.log(commandeDEnvoi(fabriquerTransfert({ fichiers, nom }), nom))
} catch (erreur) {
  console.error(`ÉCHEC transfert : ${erreur.message}`)
  process.exit(1)
}
