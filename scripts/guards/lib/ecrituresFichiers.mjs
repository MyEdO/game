import { analyserCorpus, typescript } from './dialecte.mjs'
import { creerProvenanceFs } from './provenanceFs.mjs'
import { OPERATIONS_FS, ouvreEnEcriture } from './operationsFs.mjs'
export { OPERATIONS_FS, ouvreEnEcriture } from './operationsFs.mjs'

export function ciblesDEcritureJS(texte) {
  const ts = typescript()
  const sorties = []
  for (const { sourceFile, diagnostics, checker } of analyserCorpus([{ rel: 'inline.mjs', text: texte }])) {
    if (diagnostics.length || !sourceFile) return []
    const provenance = creerProvenanceFs({ sourceFile, checker, ts })
    const litteral = (n) => n && (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) ? n.text : null
    const parcours = (n, fn) => { fn(n); n.forEachChild((c) => parcours(c, fn)) }
    parcours(sourceFile, (n) => {
      if (!ts.isCallExpression(n)) return
      const operation = provenance(n.expression)?.operation
      const definition = OPERATIONS_FS[operation]
      if (definition?.drapeaux !== undefined) {
        const argument = n.arguments[definition.drapeaux]
        const drapeaux = argument && ts.isNumericLiteral(argument) ? Number(argument.text) : litteral(argument)
        if ((!argument || drapeaux !== null) && !ouvreEnEcriture(drapeaux ?? undefined)) return
      }
      for (const indice of Object.hasOwn(OPERATIONS_FS, operation) ? OPERATIONS_FS[operation].chemins : []) {
        const chemin = litteral(n.arguments[indice])
        sorties.push({ chemin, inconnue: chemin === null, operation })
      }
    })
  }
  return sorties
}
