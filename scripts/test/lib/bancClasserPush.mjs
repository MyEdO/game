import { DOCUMENTAIRE } from '../../gates/classerPush.mjs'
/** Les jetons de `DOCUMENTAIRE` tels qu'une ligne de code les NOMME (sans le `/` final). */
const JETONS = Object.keys(DOCUMENTAIRE).map((p) => p.replace(/\/$/, ''))
/** Le premier jeton documentaire NOMMÉ par cette ligne, dans une chaîne ou un `new URL(`, comme
 *  SEGMENT de chemin entier : ni précédé ni suivi d'un caractère d'identifiant (`[\w-]`) — un
 *  sélecteur CSS (`.codex-search`, `.screen.codex`) n'est pas le dossier `.codex`. */
function jetonNomme(ligne) {
  return JETONS.find((jeton) => {
    const echappe = jeton.replace(/\./g, '\\.')
    return new RegExp(`(?:['"\`]|new URL\\(\\s*['"\`])[^'"\`\\n]*(?<![\\w-])${echappe}(?![\\w-])`).test(ligne)
  })
}

export { jetonNomme }
