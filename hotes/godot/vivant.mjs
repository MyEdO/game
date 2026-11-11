#!/usr/bin/env node
/**
 * @contrat Transport
 * - Le pont du processus, `hotes/godot/vivant.mjs` (#3945), bâtit le bundle en mémoire et en tire le pont comme la page
 *   (`empaqueter`, `pontDuBundle`, `construire.mjs`), sa `console` sur la sortie d'erreur : sa sortie standard ne porte
 *   que les lignes du protocole. Son serveur (`servir.mjs`, sans export) ne sert que `modeles/` et `depot/`.
 * - Une ligne illisible sur son entrée le tue ; la fin de son entrée ferme le serveur, et il sort en 0.
 */
import { Console } from 'node:console'
import { fileURLToPath } from 'node:url'
import { empaqueter, pontDuBundle } from './construire.mjs'
import { servir } from './servir.mjs'

const pont = pontDuBundle(await empaqueter(null), new Console(process.stderr))
const { url, fermer } = await servir({ depot: fileURLToPath(new URL('../..', import.meta.url)) })
process.stdout.write(`${JSON.stringify({ url })}\n`)
// L'entrée découpée aux seuls `\n`, jamais aux U+2028 et U+2029 que le `JSON.stringify` de Godot laisse bruts.
let reste = ''
for await (const morceau of process.stdin.setEncoding('utf8')) {
  const lignes = `${reste}${morceau}`.split('\n')
  reste = lignes.pop()
  for (const ligne of lignes) {
    const [methode, json] = JSON.parse(ligne)
    process.stdout.write(`${pont.appeler(methode, json)}\n`)
  }
}
fermer()
