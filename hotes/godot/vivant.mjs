#!/usr/bin/env node
/**
 * @contrat Transport
 * - Le pont du processus, `hotes/godot/vivant.mjs` (#3945), bâtit le bundle en mémoire et en tire le pont comme la page
 *   (`empaqueter`, `pontDuBundle`, `construire.mjs`), sa `console` sur la sortie d'erreur : sa sortie standard ne porte
 *   que le protocole, lignes et octets. Son serveur (`servir.mjs`, sans export) ne sert que `modeles/` et `depot/`.
 * - Son stockage, où vivent les sauvegardes, est le fichier de son option `--stockage=<fichier>` (`stockageDuProcessus`,
 *   `stockage.mjs`), relu à l'ouverture et réécrit à chaque changement ; sans elle, il ne dure que le processus.
 * - `resoudreLaPile` va à `pont.resoudreLaPile`, qui rend sur-le-champ sans `Worker` (`pont/pileEnFond.ts`) : les réponses
 *   sortent dans l'ordre des requêtes.
 * - Toute autre requête va à `pont.appelerEnOctets`. Une réponse sans octets sort en sa ligne JSON.
 * - Une réponse avec octets sort en trois temps : la ligne `octets <n>` (n en décimal), la ligne JSON, puis les `n`
 *   octets de `pont.octets()`, sans fin de ligne.
 * - Une ligne illisible sur son entrée le tue ; la fin de son entrée ferme le serveur, et il sort en 0.
 */
import { Console } from 'node:console'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'
import { empaqueter, pontDuBundle } from './construire.mjs'
import { servir } from './servir.mjs'
import { stockageDuProcessus } from './stockage.mjs'

const { values: options } = parseArgs({ options: { stockage: { type: 'string' } } })
const pont = pontDuBundle(await empaqueter(null), new Console(process.stderr), stockageDuProcessus(options.stockage ?? null))
const { url, fermer } = await servir({ depot: fileURLToPath(new URL('../..', import.meta.url)) })
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
