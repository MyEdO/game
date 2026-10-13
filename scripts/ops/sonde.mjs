// #2596 A2 ; commentaire 6142833266.
// LA SONDE D'UNE COMMANDE DE FOND. Une commande longue part en fond, son code de sortie écrit dans un
// fichier `<base>.code`, sa sortie dans `<base>.log` ; la sonde attend ce code sous une borne, et rend DÈS que la
// commande finit, sinon à la borne. Un appel de sonde reste sous `BORNE_D_APPEL_MS` de
// `scripts/hooks/appel-borne-guard.mjs`.
//
// Usage : node scripts/ops/sonde.mjs <base>.code [--borne <secondes>]
// Sortie : terminée → le code de la commande, la fin de `<base>.log` ; en cours à la borne → `CODE_EN_COURS`.
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { attendreSync } from '../guards/lib/spawnResilient.mjs'

/** La borne d'un appel de sonde, en secondes : défaut et maximum. */
export const BORNE_DE_SONDE_S = 240

/** Le délai entre deux lectures du fichier de code. */
const PERIODE_DE_SONDE_MS = 1000

/** Le code de sortie d'une sonde qui atteint sa borne, la commande en cours (celui de `timeout(1)`). */
export const CODE_EN_COURS = 124

/** Le code de sortie d'un usage refusé. */
export const CODE_USAGE = 2

/** Les dernières lignes du journal rendues à la fin de la commande. */
const LIGNES_DE_JOURNAL = 40

/** Le code de sortie lu dans le contenu d'un fichier de code, `null` s'il n'en porte pas (encore). PURE. */
export function codeDe(contenu) {
  const nu = String(contenu ?? '').replace(/^\uFEFF/, '').trim()
  return /^-?\d+$/.test(nu) ? Number(nu) : null
}

/** Les options de la ligne de commande, `null` si refusées. PURE. */
export function optionsDe(argv) {
  const [fichier, drapeau, valeur, ...reste] = argv
  if (!fichier || fichier.startsWith('--') || reste.length > 0) return null
  if (drapeau === undefined) return { fichier, borneS: BORNE_DE_SONDE_S }
  const borneS = Number(valeur)
  if (drapeau !== '--borne' || !Number.isInteger(borneS) || borneS < 0 || borneS > BORNE_DE_SONDE_S) return null
  return { fichier, borneS }
}

/**
 * Attend le code de `fichier` sous `borneMs`, ses lectures injectables. Rend `{ etat: 'terminee', code }` dès
 * qu'il porte un code, sinon `{ etat: 'en-cours', attenduMs }` à la borne.
 */
export function sonder({ fichier, borneMs, lire = lireCode, dormir = attendreSync, horloge = Date.now, periodeMs = PERIODE_DE_SONDE_MS }) {
  const debut = horloge()
  for (;;) {
    const code = lire(fichier)
    if (code !== null) return { etat: 'terminee', code }
    const reste = borneMs - (horloge() - debut)
    if (reste <= 0) return { etat: 'en-cours', attenduMs: horloge() - debut }
    dormir(Math.min(periodeMs, reste))
  }
}

/** Le code du fichier sur disque, `null` absent ou incomplet. */
const lireCode = (fichier) => (existsSync(fichier) ? codeDe(readFileSync(fichier, 'utf8')) : null)

/** Le journal frère d'un fichier de code : `<base>.log`. PURE. */
const journalDe = (fichier) => fichier.replace(/\.code$/, '') + '.log'

/** La commande de sonde à copier pour `fichier`. PURE. */
export const commandeDeSonde = (fichier) => `node scripts/ops/sonde.mjs ${JSON.stringify(fichier)}`

/**
 * Le geste entier de la ligne de commande, ses lectures injectables. Rend le code de sortie.
 * @param {{argv:string[], ecrire:(ligne:string) => void, sonde?:Function, lireJournal?:(chemin:string) => string|null}} p
 */
export function executer({
  argv, ecrire = (ligne) => process.stdout.write(ligne + '\n'), sonde = sonder,
  lireJournal = (chemin) => (existsSync(chemin) ? readFileSync(chemin, 'utf8') : null),
}) {
  const options = optionsDe(argv)
  if (!options) {
    ecrire(`[sonde] usage : node scripts/ops/sonde.mjs <base>.code [--borne <secondes ≤ ${BORNE_DE_SONDE_S}>]`)
    return CODE_USAGE
  }
  const vu = sonde({ fichier: options.fichier, borneMs: options.borneS * 1000 })
  if (vu.etat === 'en-cours') {
    ecrire(`[sonde] EN COURS après ${Math.round(vu.attenduMs / 1000)} s — relance la même sonde : ${commandeDeSonde(options.fichier)}`)
    return CODE_EN_COURS
  }
  const journal = lireJournal(journalDe(options.fichier))
  if (journal !== null) {
    ecrire(`[sonde] fin de ${journalDe(options.fichier)} :`)
    for (const ligne of journal.replace(/\s+$/, '').split(/\r?\n/).slice(-LIGNES_DE_JOURNAL)) ecrire(ligne)
  }
  ecrire(`[sonde] TERMINÉE — code ${vu.code}`)
  return vu.code
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  process.exitCode = executer({ argv: process.argv.slice(2) })
}
