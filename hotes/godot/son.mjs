#!/usr/bin/env node
// L'ÉPINGLAGE D'UN SON (#3805) : la commande d'`epinglerUnSon` (`asset/son.ts`). Elle convertit le fichier audio, le
// dépose sous `projet/sons/`, l'inscrit à la provenance, puis dit son entrée ; ou le refus, et sort alors en 1 sans
// rien écrire.
import { resolve } from 'node:path'
import { chargerAssets } from './asset/charger.mjs'

const USAGE = `Usage : node hotes/godot/son.mjs <fichier audio> <nom>.ogg --source "<page (archive : fichier), auteur>" --licence CC0-1.0 [--filtre <filtres ffmpeg>] [--debut <s>] [--duree <s>]
  <fichier audio>  le fichier téléchargé, tout format que ffmpeg lit
  <nom>.ogg        le nom du son au projet, en minuscules et tirets ; une variante se numérote (souffle-1.ogg, souffle-2.ogg)
  --source         la page d'où il vient, l'archive et le fichier pris, l'auteur
  --licence        CC0-1.0, suivie au besoin d'une précision
  --filtre         les filtres audio de ffmpeg (-af) appliqués avant la mise au format
  --debut, --duree l'extrait gardé, en secondes`

/** Les arguments de la ligne de commande, ou l'erreur qui les refuse. */
function lireArguments(argv) {
  const positionnels = []
  const demande = {}
  const nombres = new Set(['--debut', '--duree'])
  for (let i = 0; i < argv.length; i++) {
    const option = argv[i]
    if (['--source', '--licence', '--filtre', '--debut', '--duree'].includes(option) && argv[i + 1] !== undefined) {
      const valeur = argv[++i]
      if (nombres.has(option) && !Number.isFinite(Number(valeur))) return { erreur: `${option} : un nombre de secondes attendu, reçu « ${valeur} »` }
      demande[option.slice(2)] = nombres.has(option) ? Number(valeur) : valeur
    } else if (option.startsWith('--')) return { erreur: `option inconnue ou incomplète : ${option}` }
    else positionnels.push(option)
  }
  if (positionnels.length !== 2) return { erreur: 'un fichier audio et un nom de son attendus' }
  if (demande.source === undefined || demande.licence === undefined) return { erreur: '--source et --licence attendues' }
  return { entree: resolve(positionnels[0]), nom: positionnels[1], demande }
}

const args = lireArguments(process.argv.slice(2))
if (args.erreur) {
  console.error(`${args.erreur}\n${USAGE}`)
  process.exit(2)
}
const { epinglerUnSon } = await chargerAssets(["export { epinglerUnSon } from '/hotes/godot/asset/son.ts';"])
try {
  const entree = epinglerUnSon(args.entree, args.nom, args.demande)
  console.log(`[son] ${args.nom} épinglé : ${JSON.stringify(entree)}`)
  console.log('[son] ensuite : sa définition sous src/data/sons/defs/, `npm run gen`, puis son versement par une branche transfert/<x> (skill ajouter-un-effet)')
} catch (e) {
  console.error(`[son] ${e.message}`)
  process.exit(1)
}
