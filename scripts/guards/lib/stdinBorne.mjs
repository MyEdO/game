// LECTURE BORNÉE du stdin d'un hook (#2112) — l'UNIQUE lecteur de stdin des `scripts/hooks/*.mjs`
// (garde de classe `stdinHorsBorne.test.mjs`).
// Lit le stdin jusqu'à `end`. Un minuteur `unref()`, armé à l'appel, sort en exit 0 si le stdin n'est
// toujours pas fermé au délai (issue d'un stdin illisible : l'appel passe) ; il est désarmé à `end` et
// à `error`, et ne borne donc que la LECTURE : le verdict d'un hook qui a lu son entrée garde son code.

/** Délai de lecture du stdin d'un hook, sous le `timeout` (s) que `.claude/settings.json` déclare à
 *  CHAQUE hook qui lit son stdin — `stdinBorne.test.mjs` le vérifie sur le fichier réel. */
export const DELAI_STDIN_MS = 8000

/**
 * Le stdin entier, en UTF-8 ; `''` sur une erreur de flux. Sort en exit 0 si `end` n'arrive pas avant
 * `delaiMs`.
 * @param {number} [delaiMs] injectable pour le test seulement
 * @returns {Promise<string>}
 */
export function lireStdinBorne(delaiMs = DELAI_STDIN_MS) {
  const minuteur = setTimeout(() => process.exit(0), delaiMs).unref()
  return new Promise((resoudre) => {
    let brut = ''
    const finir = (texte) => {
      clearTimeout(minuteur)
      resoudre(texte)
    }
    process.stdin.setEncoding('utf8')
    process.stdin.on('data', (morceau) => {
      brut += morceau
    })
    process.stdin.on('end', () => finir(brut))
    process.stdin.on('error', () => finir(''))
  })
}
