// LE PROCESSUS DU PONT (#3945, #3951) : ce que partagent ses deux points d'entrée, `vivant.mjs` (le projet en place, son
// bundle bâti au lancement) et `embarque.mjs` (l'exécutable de bureau, son bundle bâti à l'export). Sans dépendance hors
// de Node, de `tableTotale` et de `stockage.mjs` : `embarque.mjs` s'empaquette en un fichier.
import { Console } from 'node:console'
import { parseArgs } from 'node:util'
import { createContext, runInContext } from 'node:vm'
import { tableTotale } from '../../src/lib/tableTotale.ts'
import { stockageDuProcessus } from './stockage.mjs'

/** Le fichier du bundle du pont. */
export const PONT = 'wfrp-pont.js'

/** Les API de navigateur que le bundle lit, et que la page de Godot porte : chacune prise au global de Node, rien de plus. */
export const API_DU_NAVIGATEUR = ['structuredClone', 'console', 'performance', 'URL', 'atob', 'btoa', 'setTimeout', 'clearTimeout', 'queueMicrotask', 'localStorage']

/** Le pont du bundle `code` évalué comme dans la page de Godot : dans un contexte qui ne porte que `API_DU_NAVIGATEUR`,
 *  chacune prise au global de Node sauf `console` et `localStorage`, ceux donnés (`stockage` : `stockageDuProcessus`,
 *  `stockage.mjs`). Lève si l'évaluation lève. */
export function pontDuBundle(code, console, stockage) {
  const donnees = { console, localStorage: stockage }
  const page = createContext(tableTotale(API_DU_NAVIGATEUR, (nom) => (nom in donnees ? donnees[nom] : globalThis[nom])))
  runInContext(code, page, { filename: PONT })
  return page.wfrpPont
}

/**
 * @contrat Transport
 * - Le processus du pont (`tenirLeTuyau`, `hotes/godot/processus.mjs`) tire le pont de son bundle comme la page
 *   (`pontDuBundle`), sa `console` sur la sortie d'erreur : sa sortie standard ne porte que le protocole, lignes et
 *   octets.
 * - Son stockage, où vivent les sauvegardes, est le fichier de son option `--stockage=<fichier>` (`stockageDuProcessus`,
 *   `stockage.mjs`), relu à l'ouverture et réécrit à chaque changement ; sans elle, il ne dure que le processus.
 * - `resoudreLaPile` va à `pont.resoudreLaPile`, qui rend sur-le-champ sans `Worker` (`pont/pileEnFond.ts`) : les réponses
 *   sortent dans l'ordre des requêtes.
 * - Toute autre requête va à `pont.appelerEnOctets`. Une réponse sans octets sort en sa ligne JSON.
 * - Une réponse avec octets sort en trois temps : la ligne `octets <n>` (n en décimal), la ligne JSON, puis les `n`
 *   octets de `pont.octets()`, sans fin de ligne.
 * - La requête `["publier", json]`, `json` le tableau `[nom, valeur]`, porte ce que Godot publie pour qui pilote le lieu
 *   (`Transport.publier`) : sa réponse est la ligne `null`. Le processus du jeu n'en retient rien ; celui d'une recette
 *   le pose en global (`hotes/godot/pilotage/natif.mjs`).
 * - Une ligne illisible sur son entrée le tue ; la fin de son entrée ferme le serveur, et il sort en 0.
 */

/** Tient le tuyau du pont du bundle `code` sur l'entrée et la sortie standard du processus (`servirLeCanal`), sa
 *  `console` sur la sortie d'erreur, son stockage au fichier de son option `--stockage=<fichier>`. */
export function tenirLeTuyau(code, serveur) {
  const { values: options } = parseArgs({ options: { stockage: { type: 'string' } } })
  return servirLeCanal(pontDuBundle(code, new Console(process.stderr), stockageDuProcessus(options.stockage ?? null)), serveur, { entree: process.stdin, sortie: process.stdout })
}

/** Sert le protocole du pont `pont` sur un canal : l'annonce de l'adresse `url` du serveur du jeu sur `sortie`, puis une
 *  réponse par ligne de requête d'`entree`, jusqu'à la fin de l'entrée, où `fermer` ferme le serveur. Une méthode de
 *  `methodes` (`{ nom: (json) => ligne de réponse }`) est servie par elle, avant le pont ; `publier`, sans elle, par
 *  rien. */
export async function servirLeCanal(pont, { url, fermer }, { entree, sortie }, methodes = {}) {
  const servies = { publier: () => 'null', ...methodes }
  sortie.write(`${JSON.stringify({ url })}\n`)
  // L'entrée découpée aux seuls `\n`, jamais aux U+2028 et U+2029 que le `JSON.stringify` de Godot laisse bruts.
  let reste = ''
  for await (const morceau of entree.setEncoding('utf8')) {
    const lignes = `${reste}${morceau}`.split('\n')
    reste = lignes.pop()
    for (const ligne of lignes) {
      const [methode, json] = JSON.parse(ligne)
      if (methode === 'resoudreLaPile') pont.resoudreLaPile(json, (reponse) => sortie.write(`${reponse}\n`))
      else if (Object.hasOwn(servies, methode)) sortie.write(`${servies[methode](json)}\n`)
      else {
        const reponse = pont.appelerEnOctets(methode, json)
        const octets = pont.octets()
        if (octets === null) sortie.write(`${reponse}\n`)
        else {
          sortie.write(`octets ${octets.byteLength}\n${reponse}\n`)
          sortie.write(Buffer.from(octets))
        }
      }
    }
  }
  fermer()
}
