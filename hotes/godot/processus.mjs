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
export const API_DU_NAVIGATEUR = ['structuredClone', 'console', 'performance', 'URL', 'atob', 'btoa', 'setTimeout', 'clearTimeout', 'queueMicrotask', 'localStorage',
  'WebSocket', 'fetch', 'CompressionStream', 'DecompressionStream', 'Blob', 'Response', 'TextEncoder', 'TextDecoder', 'URLSearchParams', 'sessionStorage']

/** Les noms de navigateur que le bundle lit en identifiant libre sans que le processus les porte : par nom, le nombre de
 *  ses lectures (`lecturesDuBundle`, `construire.mjs`) et ce qui les garde. */
export const HORS_DU_PROCESSUS = {
  document: { lectures: 2, garde: '`choisirUnFichier` (`pont/fichier.ts`), que le processus n’appelle pas' },
  FileReader: { lectures: 1, garde: '`choisirUnFichier` (`pont/fichier.ts`), que le processus n’appelle pas' },
  self: { lectures: 5, garde: '`typeof self`, l’enveloppe de Vite de `pile.worker?worker&inline` (`pont/pileEnFond.ts`)' },
  Worker: { lectures: 2, garde: '`typeof Worker`, l’enveloppe de Vite de `pile.worker?worker&inline` (`pont/pileEnFond.ts`)' },
  navigator: { lectures: 1, garde: '`typeof navigator`, une sonde de zod' },
}

/** Les écarts des lectures `lectures` du bundle (par nom, leur nombre) à ce que le processus porte : un nom de `api`
 *  passe ; un nom de `horsDuProcessus` passe si le bundle le lit exactement le nombre de fois que la table déclare ;
 *  tout autre nom lu est un écart. PURE. */
export function ecartsDesLectures(lectures, api, horsDuProcessus) {
  const noms = new Set([...Object.keys(lectures), ...Object.keys(horsDuProcessus)])
  return [...noms].flatMap((nom) => {
    if (api.includes(nom)) return []
    const lu = lectures[nom] ?? 0
    if (!Object.hasOwn(horsDuProcessus, nom)) return [`${nom} : lu ${lu}, ni porté par le processus ni dans la table`]
    return lu === horsDuProcessus[nom].lectures ? [] : [`${nom} : lu ${lu}, table ${horsDuProcessus[nom].lectures}`]
  })
}

/** Le pont du bundle `code` évalué comme dans la page de Godot : dans un contexte qui ne porte que `API_DU_NAVIGATEUR`,
 *  chacune prise au global de Node sauf `console` et `localStorage`, ceux donnés (`stockage` : `stockageDuProcessus`,
 *  `stockage.mjs`), et `sessionStorage`, un stockage en mémoire neuf (`stockageDuProcessus(null)`). Lève si
 *  l'évaluation lève. */
export function pontDuBundle(code, console, stockage) {
  const donnees = { console, localStorage: stockage, sessionStorage: stockageDuProcessus(null) }
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
 *   `stockage.mjs`), relu à l'ouverture et réécrit à chaque changement ; sans elle, il ne dure que le processus. Son
 *   `sessionStorage`, où le salon range son jeton de reprise, ne dure que le processus, jamais dans ce fichier : un
 *   processus vaut un onglet.
 * - `resoudreLaPile` va à `pont.resoudreLaPile`, qui rend sur-le-champ sans `Worker` (`pont/pileEnFond.ts`) : les réponses
 *   sortent dans l'ordre des requêtes.
 * - Toute autre requête va à `pont.appelerEnOctets`. Une réponse sans octets sort en sa ligne JSON.
 * - Une réponse avec octets sort en trois temps : la ligne `octets <n>` (n en décimal), la ligne JSON, puis les `n`
 *   octets de `pont.octets()`, sans fin de ligne.
 * - Une ligne illisible sur son entrée le tue ; la fin de son entrée ferme le serveur, et il sort en 0 : aussitôt si rien ne
 *   le retient, sinon (une socket, un `fetch`, une connexion du serveur) `BORNE_DE_SORTIE_MS` après que sa sortie
 *   standard est vidée, sans geste de salon.
 */

/** Le délai après lequel un processus dont l'entrée a fini sort, quoi que le retienne. */
export const BORNE_DE_SORTIE_MS = 1_000

/** Tient le tuyau du pont du bundle `code` : l'annonce de l'adresse `url` du serveur du jeu, puis une réponse par ligne
 *  de requête de l'entrée standard, jusqu'à la fin de l'entrée, où `fermer` ferme le serveur ; au rappel de sa dernière
 *  écriture, la sortie standard vidée, une minuterie qui ne le retient pas le fait sortir en 0 à `BORNE_DE_SORTIE_MS`. */
export async function tenirLeTuyau(code, { url, fermer }) {
  const { values: options } = parseArgs({ options: { stockage: { type: 'string' } } })
  const pont = pontDuBundle(code, new Console(process.stderr), stockageDuProcessus(options.stockage ?? null))
  process.stdout.write(`${JSON.stringify({ url })}\n`)
  // L'entrée découpée aux seuls `\n`, jamais aux U+2028 et U+2029 que le `JSON.stringify` de Godot laisse bruts.
  let reste = ''
  for await (const morceau of process.stdin.setEncoding('utf8')) {
    const lignes = `${reste}${morceau}`.split('\n')
    reste = lignes.pop()
    for (const ligne of lignes) {
      const [methode, json] = JSON.parse(ligne)
      if (methode === 'resoudreLaPile') pont.resoudreLaPile(json, (reponse) => process.stdout.write(`${reponse}\n`))
      else {
        const reponse = pont.appelerEnOctets(methode, json)
        const octets = pont.octets()
        if (octets === null) process.stdout.write(`${reponse}\n`)
        else {
          process.stdout.write(`octets ${octets.byteLength}\n${reponse}\n`)
          process.stdout.write(Buffer.from(octets))
        }
      }
    }
  }
  fermer()
  process.stdout.write('', () => setTimeout(() => process.exit(0), BORNE_DE_SORTIE_MS).unref())
}
