#!/usr/bin/env node
// L'IMPORT D'UN PERSONNAGE 3D MODULAIRE (#2948) : la commande de `importerPersonnage` (`asset/importer.ts`). Elle verse
// le GLB et sa source dans la Release des modèles (`asset/release.ts`, par `gh`), sauf `--sans-publier`, puis dit les
// fichiers écrits ; ou chaque refus, et sort alors en 1 sans rien publier ni écrire.
import { resolve } from 'node:path'
import { importerPersonnage } from './asset/importer.ts'
import { DOSSIER_DES_MODELES, publierAssets, TAG } from './asset/release.ts'

const USAGE = `Usage : node hotes/godot/importer.mjs <dossier de production> <id de modèle> [--destination <dossier>] [--sans-publier]
  <dossier de production>  animated.glb, manifest.json et report.json ; au plus un *.blend ; des LICENSE*.txt
  <id de modèle>           le nom des fichiers déposés : <id>.manifeste.json, <id>.provenance.json (et <id>.glb tiré de la Release)
  --destination <dossier>  où les déposer (défaut : ${DOSSIER_DES_MODELES})
  --sans-publier           ne verse rien dans la Release ${TAG} (tests et sondes)`

/** Les arguments de la ligne de commande, ou l'erreur qui les refuse. */
function lireArguments(argv) {
  const positionnels = []
  let destination = DOSSIER_DES_MODELES
  let publier = true
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--destination' && argv[i + 1]) destination = resolve(argv[++i])
    else if (argv[i] === '--sans-publier') publier = false
    else if (argv[i].startsWith('--')) return { erreur: `option inconnue ou incomplète : ${argv[i]}` }
    else positionnels.push(argv[i])
  }
  if (positionnels.length !== 2) return { erreur: 'un dossier de production et un id de modèle attendus' }
  return { dossier: resolve(positionnels[0]), id: positionnels[1], destination, publier: publier ? publierAssets : null }
}

const args = lireArguments(process.argv.slice(2))
if (args.erreur) {
  console.error(`${args.erreur}\n${USAGE}`)
  process.exit(2)
}
const resultat = importerPersonnage({ ...args, date: new Date().toISOString().slice(0, 10) })
if (resultat.ok) {
  console.log(`Publié dans la Release ${TAG} : ${resultat.publies.join(', ') || (args.publier ? 'rien, tout y était' : 'rien (--sans-publier)')}`)
  console.log(`Importé : ${resultat.ecrits.join(', ')}`)
  console.log(JSON.stringify(resultat.provenance, null, 2))
} else {
  console.error(`Import refusé, rien n'est publié ni écrit :\n${resultat.refus.map((r) => `  ${r}`).join('\n')}`)
  process.exitCode = 1
}
