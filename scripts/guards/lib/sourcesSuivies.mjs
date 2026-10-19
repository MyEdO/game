// SOURCES SUIVIES — le corpus des gardes qui lisent toute source du dépôt susceptible de porter un
// import (#1813) : git, jamais le disque, car ce que la CI joue, c'est ce qui est suivi.
import { fileURLToPath } from 'node:url'
import { INDEX, depotDe, listerImage } from './gitPorte.mjs'

/** L'arbre lu par défaut : celui où VIT ce module. */
export const RACINE = fileURLToPath(new URL('../../..', import.meta.url))

/** Extensions de MODULE que ce dépôt écrit : ce sont les fichiers qui peuvent porter un import. */
const EXTS_SOURCE = /\.(?:mjs|cjs|mts|cts|ts|tsx|js|jsx)$/

/** Sources SUIVIES par git susceptibles de porter un import, chemins POSIX relatifs, triés. */
export function sourcesSuivies(racine = RACINE) {
  return listerImage(depotDe(racine), INDEX)
    .filter((f) => EXTS_SOURCE.test(f))
    .sort()
}
