// Les déclarations `import` et `export { … }` / `export * …` de premier niveau d'un module, lues par l'arbre
// syntaxique (`dialecte.mjs`) : leur clé, leurs liaisons et leur impression. Consommé par le pilote de fusion
// `scripts/git-hooks/merge-imports.mjs`.
import { analyserTexte, typescript } from './dialecte.mjs'

/** Une déclaration à accolades imprimée à un nom par ligne : `tete` finit par `{`, `queue` commence par `}`. */
export const unNomParLigne = ({ tete, noms, queue, indentation }) =>
  [tete, ...noms.map((nom) => `${indentation}  ${nom},`), `${indentation}${queue}`].join('\n')

/** La déclaration ne peut pas porter ces liaisons, ou son texte ne se réimprime pas à l'identique. */
class NonImprimable extends Error {}

const DEFAUT = 'defaut '
const ESPACE = 'espace '
const NOM = 'nom '
const EFFET = 'effet'
const ETOILE = 'etoile'
const VIDE = 'vide'

const sansBlancs = (texte) => texte.replace(/\s+/g, '').replaceAll(',}', '}')

/**
 * Le texte d'une déclaration de `genre` qui porte `liaisons`, entre `tete` et `queue`. Deux noms ou plus : un nom
 * par ligne (`unNomParLigne`).
 * @throws {NonImprimable} forme que la grammaire refuse.
 */
function imprimer({ genre, type, tete, queue, indentation }, liaisons) {
  const de = (prefixe) => liaisons.filter((l) => l.startsWith(prefixe)).map((l) => l.slice(prefixe.length))
  const [defauts, espaces, noms] = [DEFAUT, ESPACE, NOM].map(de)
  if (defauts.length + espaces.length + noms.length !== liaisons.length || !liaisons.length) throw new NonImprimable()
  if (defauts.length > 1 || espaces.length > 1 || (espaces.length && noms.length)) throw new NonImprimable()
  if (genre === 'export' && defauts.length) throw new NonImprimable()
  if (type && defauts.length && (espaces.length || noms.length)) throw new NonImprimable()
  const avant = [...defauts, ...espaces.map((e) => `* as ${e}`)].join(', ')
  if (!noms.length) return `${tete}${avant}${queue}`
  const ouvre = `${tete}${avant ? `${avant}, ` : ''}{`
  if (noms.length === 1) return `${ouvre} ${noms[0]} }${queue}`
  return unNomParLigne({ tete: ouvre, noms, queue: `}${queue}`, indentation })
}

/** Les noms que lie `instruction`, de premier niveau, hors déclaration d'import ou d'export. */
function nomsLies(ts, instruction) {
  const de = (nom) => (ts.isIdentifier(nom) ? [nom.text] : (nom.elements ?? []).flatMap((e) => (ts.isBindingElement(e) ? de(e.name) : [])))
  if (ts.isVariableStatement(instruction)) return instruction.declarationList.declarations.flatMap((d) => de(d.name))
  return instruction.name ? de(instruction.name) : []
}

/**
 * @typedef {object} DeclarationDImport
 * @property {number} debut @property {number} fin positions dans le texte lu
 * @property {string} texte
 * @property {string} cle genre, `type` de la déclaration, module et attributs : deux déclarations de même clé se fondent
 * @property {Map<string, string | null>} liaisons chaque liaison et le nom qu'elle lie dans le module (`null` : aucun)
 * @property {boolean} effet import qui ne lie aucun nom : le module n'est chargé que pour son effet, à son rang
 * @property {(liaisons: string[]) => string} imprimer le texte de cette déclaration portant `liaisons` (`NonImprimable`)
 */

/**
 * Les déclarations d'import et d'export de premier niveau de `texte`, dans l'ordre ; `seules` : le module ne porte
 * aucune autre instruction ; `locaux` et `exportes` : les noms que ces autres instructions lient dans le module et
 * ceux qu'elles exportent. `null` si le texte ne se parse pas.
 * @param {string} chemin son extension choisit le dialecte @param {string} texte
 * @returns {{ declarations: DeclarationDImport[], seules: boolean, locaux: string[], exportes: string[] } | null}
 */
export function declarationsDImport(chemin, texte) {
  const ts = typescript()
  const { sourceFile: arbre, diagnostics } = analyserTexte({ rel: chemin, text: texte })
  if (diagnostics.length) return null
  const declarations = []
  const [locaux, exportes] = [[], []]
  for (const instruction of arbre.statements) {
    const estImport = ts.isImportDeclaration(instruction)
    if (!estImport && !ts.isExportDeclaration(instruction)) {
      const noms = nomsLies(ts, instruction)
      const modificateurs = (instruction.modifiers ?? []).map((m) => m.kind)
      locaux.push(...noms)
      if (modificateurs.includes(ts.SyntaxKind.DefaultKeyword) || (ts.isExportAssignment(instruction) && !instruction.isExportEquals)) exportes.push('default')
      else if (modificateurs.includes(ts.SyntaxKind.ExportKeyword)) exportes.push(...noms)
      continue
    }
    const debut = instruction.getStart(arbre)
    const fin = instruction.getEnd()
    const clause = estImport ? instruction.importClause : instruction.exportClause
    const type = Boolean(estImport ? clause?.isTypeOnly : instruction.isTypeOnly)
    const genre = estImport ? 'import' : 'export'
    const module = instruction.moduleSpecifier
    const liaisons = new Map()
    const nommes = estImport ? clause?.namedBindings : clause
    if (estImport && clause?.name) liaisons.set(`${DEFAUT}${clause.name.text}`, clause.name.text)
    if (nommes && (ts.isNamespaceImport(nommes) || ts.isNamespaceExport(nommes))) liaisons.set(`${ESPACE}${nommes.name.getText(arbre)}`, nommes.name.text)
    for (const element of nommes?.elements ?? []) {
      const nom = `${element.isTypeOnly ? 'type ' : ''}${element.propertyName ? `${element.propertyName.getText(arbre)} as ` : ''}${element.name.getText(arbre)}`
      liaisons.set(`${NOM}${nom}`, element.name.text)
    }
    if (!clause) liaisons.set(estImport ? EFFET : ETOILE, null)
    if (!liaisons.size) liaisons.set(VIDE, null)
    const gabarit = clause && {
      genre, type,
      tete: `${genre} ${type ? 'type ' : ''}`,
      queue: texte.slice(clause.getEnd(), fin),
      indentation: texte.slice(texte.lastIndexOf('\n', debut - 1) + 1, debut),
    }
    const declaration = {
      debut, fin, texte: texte.slice(debut, fin), liaisons,
      effet: estImport && [...liaisons.values()].every((nom) => nom === null),
      cle: [genre, type ? 'type' : '', module?.text ?? '', instruction.attributes?.getText(arbre) ?? ''].join('|'),
      imprimer(voulues) {
        if (!gabarit || sansBlancs(imprimer(gabarit, [...liaisons.keys()])) !== sansBlancs(declaration.texte)) throw new NonImprimable()
        return imprimer(gabarit, voulues)
      },
    }
    declarations.push(declaration)
  }
  return { declarations, seules: declarations.length === arbre.statements.length, locaux, exportes }
}
