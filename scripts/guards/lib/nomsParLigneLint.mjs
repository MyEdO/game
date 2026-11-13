// `murs/noms-par-ligne` (#3821) : un import ou un export nommé tenu sur une ligne de plus de `SEUIL_NOMS_PAR_LIGNE`
// caractères passe à un nom par ligne. Le correctif récrit la déclaration seule (`unNomParLigne`) ; un commentaire
// sur la ligne de la déclaration, ou une directive de la ligne précédente (`DIRECTIVE`), se signale sans correctif.

/** La longueur de ligne au-delà de laquelle une déclaration d'une ligne est refusée. */
export const SEUIL_NOMS_PAR_LIGNE = 160

/** La commande qui corrige un fichier. */
export const COMMANDE_NOMS_PAR_LIGNE = 'npm run lint:noms-par-ligne -- <fichier>'

/** Un commentaire qui vise la ligne suivante. */
const DIRECTIVE = /@ts-|(?:eslint|oxlint)-disable-next-line/

/** La déclaration à un nom par ligne : `tete` finit par `{`, `queue` commence par `}`, `noms` sont les spécificateurs
 *  dans leur ordre, `indentation` celle de la ligne de la déclaration. PUR. */
export const unNomParLigne = ({ tete, noms, queue, indentation }) =>
  [tete, ...noms.map((nom) => `${indentation}  ${nom},`), `${indentation}${queue}`].join('\n')

export default {
  meta: { type: 'layout', fixable: 'code' },
  create(context) {
    const source = context.sourceCode
    const juger = (node, noms) => {
      const ligne = node.loc.start.line
      if (noms.length === 0 || node.loc.end.line !== ligne) return
      const texteDeLigne = source.lines[ligne - 1]
      if (texteDeLigne.length <= SEUIL_NOMS_PAR_LIGNE) return
      const message = `Déclaration de ${texteDeLigne.length} caractères sur une ligne (#3821) : un nom par ligne — \`${COMMANDE_NOMS_PAR_LIGNE}\`.`
      const commente = source.getAllComments().some((c) => (c.loc.start.line <= ligne && c.loc.end.line >= ligne) || (c.loc.end.line === ligne - 1 && DIRECTIVE.test(c.value)))
      if (commente) {
        context.report({ node, message: `${message} Un commentaire est sur la ligne ou la vise : à la main.` })
        return
      }
      const texte = source.getText(node)
      const debut = node.range[0]
      const accolade = texte.indexOf('}', noms.at(-1).range[1] - debut)
      context.report({
        node,
        message,
        fix: (fixer) => fixer.replaceText(node, unNomParLigne({
          tete: texte.slice(0, texte.indexOf('{') + 1),
          noms: noms.map((n) => source.getText(n)),
          queue: texte.slice(accolade),
          indentation: /^\s*/.exec(texteDeLigne)[0],
        })),
      })
    }
    return {
      ImportDeclaration: (node) => juger(node, node.specifiers.filter((s) => s.type === 'ImportSpecifier')),
      ExportNamedDeclaration: (node) => juger(node, node.specifiers),
    }
  },
}
