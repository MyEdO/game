// Les `setupFiles` de la config Vitest, lus sans la dérivation du périmètre : `perimetreDerivation.mjs` et la sélection
// de zone (`selectionDeZone.mjs`, que `npm test` charge) les partagent (#5037).
import { typescript } from '../guards/lib/dialecte.mjs'
import { evaluer, lecteurDExpressions } from '../guards/lib/racinesBalayees.mjs'

/** La config Vitest, relative à la racine du dépôt. */
export const CONFIG_VITEST = 'vitest.config.ts'

/** Les `setupFiles` de la config Vitest (`CONFIG_VITEST`), lus sur son arbre syntaxique (`analyser`). */
export function setupFilesDe(texte, analyser) {
  if (texte === null) return []
  const ts = typescript()
  const [{ sourceFile }] = [...analyser([{ rel: CONFIG_VITEST, text: texte }])]
  const { expr, lambdas } = lecteurDExpressions(CONFIG_VITEST, sourceFile)
  const vus = []
  const visiter = (n) => {
    if (ts.isPropertyAssignment(n) && ts.isIdentifier(n.name) && n.name.text === 'setupFiles') vus.push(...evaluer(expr(n.initializer), { lambdas }))
    n.forEachChild(visiter)
  }
  visiter(sourceFile)
  const non = vus.find((v) => !('chemin' in v))
  if (non) throw new Error(`perimetre : setupFiles de ${CONFIG_VITEST} illisible (${non.non ?? 'hors du dépôt'})`)
  return vus.map((v) => v.chemin)
}
