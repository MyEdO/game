import * as importe9_0 from './classerPush.mjs'
export const bancclasserPushtestmjs = (() => {
const DOCUMENTAIRE = importe9_0.DOCUMENTAIRE
const JETONS = Object.keys(DOCUMENTAIRE).map((p) => p.replace(/\/$/, ''))
function jetonNomme(ligne) {
  return JETONS.find((jeton) => {
    const echappe = jeton.replace(/\./g, '\\.')
    return new RegExp(`(?:['"\`]|new URL\\(\\s*['"\`])[^'"\`\\n]*(?<![\\w-])${echappe}(?![\\w-])`).test(ligne)
  })
}
return { JETONS, jetonNomme }
})()
