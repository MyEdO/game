#!/usr/bin/env node
// L'IMPORT D'UN PERSONNAGE 3D MODULAIRE (#2948) : la commande de `importerPersonnage` (`asset/importer.ts`). Elle verse
// le GLB et sa source dans la Release des modèles (`asset/release.ts`, par `gh`), sauf `--sans-publier`, puis dit les
// fichiers écrits ; ou chaque refus, et sort alors en 1 sans rien publier ni écrire.
import { resolve } from 'node:path'
import { chargerAssets } from './asset/charger.mjs'

const { importerPersonnage, DOSSIER_DES_MODELES, publierAssets, TAG } = await chargerAssets()

const USAGE = `Usage : node hotes/godot/importer.mjs <dossier de production> <id de modèle> [--destination <dossier>] [--sans-publier] [--remplacer]
  <dossier de production>  manifest.json : model, model_sha256, manifeste (base ou élément schéma 3) ; au plus un *.blend ; des LICENSE*.txt
  <id de modèle>           le nom des fichiers déposés : <id>.manifeste.json, <id>.provenance.json, les LICENSE-*.txt ;
                           schéma 3 : <id>.glb écrit aussi ; schéma 2 : <id>.glb tiré de la Release à la construction (construire.mjs)
  --destination <dossier>  où les déposer (défaut : ${DOSSIER_DES_MODELES})
  --sans-publier           ne verse rien dans la Release ${TAG} (tests, sondes, et toute production dont manifest.json porte hors_release)
  --remplacer              remplace le modèle schéma 3 déjà importé sous <id> ; une base, si chaque élément qui la référence
                           passe contre elle, sinon rien n'est écrit`

/** Les arguments de la ligne de commande, ou l'erreur qui les refuse. */
function lireArguments(argv) {
  const positionnels = []
  let destination = DOSSIER_DES_MODELES
  let publier = true
  let remplacer = false
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--destination' && argv[i + 1]) destination = resolve(argv[++i])
    else if (argv[i] === '--sans-publier') publier = false
    else if (argv[i] === '--remplacer') remplacer = true
    else if (argv[i].startsWith('--')) return { erreur: `option inconnue ou incomplète : ${argv[i]}` }
    else positionnels.push(argv[i])
  }
  if (positionnels.length !== 2) return { erreur: 'un dossier de production et un id de modèle attendus' }
  return { dossier: resolve(positionnels[0]), id: positionnels[1], destination, publier: publier ? publierAssets : null, remplacer }
}

const args = lireArguments(process.argv.slice(2))
if (args.erreur) {
  console.error(`${args.erreur}\n${USAGE}`)
  process.exit(2)
}
let resultat
try {
  resultat = importerPersonnage({ ...args, date: new Date().toISOString().slice(0, 10) })
} catch (erreur) {
  console.error(`[lecture-ou-import] ${erreur instanceof Error ? erreur.message : String(erreur)}`)
  process.exit(1)
}
if (resultat.ok) {
  console.log(`Publié dans la Release ${TAG} : ${resultat.publies.join(', ') || (args.publier ? 'rien, tout y était' : 'rien (--sans-publier)')}`)
  console.log(`Importé : ${resultat.ecrits.join(', ')}`)
  if (resultat.retires.length) console.log(`Retiré : ${resultat.retires.join(', ')}`)
  console.log(JSON.stringify(resultat.provenance, null, 2))
} else {
  console.error(`Import refusé, rien n'est publié ni écrit :\n${resultat.refus.map((r) => `  ${r}`).join('\n')}`)
  process.exitCode = 1
}
