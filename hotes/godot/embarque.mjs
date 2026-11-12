/**
 * @contrat Transport
 * - Dans l'exécutable de bureau (#3951), le pont du processus est `noyau/vivant.mjs`, à côté de l'exécutable :
 *   `hotes/godot/embarque.mjs` empaqueté en un fichier (`empaqueterLeProcessus`, `construire.mjs`). Il lit le bundle bâti
 *   à l'export, `noyau/wfrp-pont.js`, et son serveur ne sert que `modeles/`, le dossier déposé à côté de l'exécutable
 *   comme à côté de la page.
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { PONT, tenirLeTuyau } from './processus.mjs'
import { ecouter, rendre } from './statique.mjs'

const MODELES = 'modeles'
const noyau = dirname(fileURLToPath(import.meta.url))
const modeles = join(noyau, '..', MODELES)

await tenirLeTuyau(
  readFileSync(join(noyau, PONT), 'utf8'),
  await ecouter((_req, res, rel) => rendre(res, rel.startsWith(`${MODELES}/`) ? modeles : null, rel.slice(MODELES.length + 1))),
)
