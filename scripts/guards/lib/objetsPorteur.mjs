// GARDE du PLACEMENT et de l'ENTRÉE d'un objet chez un porteur (#1473, #1985), sur le vérificateur de
// types (`tsProgram.mjs`). Deux angles :
//   - placement : `inside` et `equipped` d'un objet ne s'écrivent que dans `stowIn`, `unstow` et
//     `toggleWorn` (`src/engine/items.ts`) — affectation, affectation composée, `delete`, ou
//     `Object.assign` d'un patch qui porte l'un de ces champs ;
//   - entrée : la liste `items` d'un porteur ne s'étend que dans `receiveItems` (`src/engine/items.ts`)
//     — `push`, `unshift`, `splice` avec insertion (sur la liste ou sur un alias `const l = c.items`),
//     affectation d'un tableau qui étale l'ancienne liste et y ajoute, `concat` affecté, et propriété
//     `items` d'un littéral d'objet bâtie de même. Un retrait (`filter`) n'est pas une entrée.
//
// Les PORTEURS se dérivent du type `Carrier` (`src/engine/carrier.ts`) : chaque membre de l'union
// porte une liste `items`, et l'objet est le type de ses éléments. Une propriété `items` ou `inside`
// d'un autre type (groupes de `MultiRollList`, bandes de `rollSeam`) n'est pas vue : la garde
// compare les DÉCLARATIONS de la propriété accédée, jamais son nom seul. Aucune exemption par site.
//
// ANGLES MORTS DÉCLARÉS :
//   - un objet construit par littéral (`{ ...it, equipped: true }`) avant d'entrer chez un porteur :
//     c'est une construction, pas une mutation d'un objet porté ;
//   - une affectation d'un tableau construit ailleurs (`c.items = nouvelleListe`), qui est une
//     construction et non une entrée ;
//   - une liste atteinte par le retour d'une fonction ou par un paramètre (seul l'alias local
//     `const l = c.items` est suivi) ; `carrierItems` rend une liste `readonly` pour cette raison.
import path from 'node:path'
import ts from 'typescript'
import { repoProgram } from './tsProgram.mjs'

const COUTURE = 'src/engine/items.ts'
const CARRIER = 'src/engine/carrier.ts'
const PLACEMENT = new Set(['stowIn', 'unstow', 'toggleWorn'])
const ENTREE = new Set(['receiveItems'])
const CHAMPS_PLACEMENT = ['inside', 'equipped']
const INSERTIONS = { push: 1, unshift: 1, splice: 3 }

const norm = (p) => p.replace(/\\/g, '/')
const estTest = (rel) => /\.test\.tsx?$/.test(rel)

/** Racines du Program du dépôt : `src/` hors tests. */
export function racinesSrc(fileNames, root) {
  return fileNames.filter((f) => {
    const rel = norm(path.relative(root, f))
    return rel.startsWith('src/') && !estTest(rel)
  })
}

/** Program du dépôt pour cette garde ; la fabrique ne retient rien, l'appelant non plus. */
export function programmeObjetsPorteur(root) {
  return repoProgram(root, racinesSrc)
}

const deballer = (e) => {
  let n = e
  for (;;) {
    if (ts.isParenthesizedExpression(n) || ts.isNonNullExpression(n) || ts.isAsExpression(n)) n = n.expression
    else if (
      ts.isBinaryExpression(n) &&
      [ts.SyntaxKind.QuestionQuestionToken, ts.SyntaxKind.QuestionQuestionEqualsToken, ts.SyntaxKind.BarBarEqualsToken, ts.SyntaxKind.BarBarToken].includes(
        n.operatorToken.kind
      )
    )
      n = n.left
    else return n
  }
}

const deballerParentheses = (e) => {
  let n = e
  while (ts.isParenthesizedExpression(n) || ts.isNonNullExpression(n)) n = n.expression
  return n
}

const nomAccede = (n) =>
  ts.isPropertyAccessExpression(n)
    ? n.name.text
    : ts.isElementAccessExpression(n) && n.argumentExpression && ts.isStringLiteralLike(n.argumentExpression)
      ? n.argumentExpression.text
      : undefined

/** Déclarations d'une propriété d'un type, membres d'union compris. */
function declarationsDe(checker, type, nom) {
  const out = new Set()
  const types = type.isUnion() ? type.types : [type]
  for (const t of types) for (const d of checker.getPropertyOfType(t, nom)?.declarations ?? []) out.add(d)
  return out
}

/** Déclarations des propriétés surveillées, dérivées du type `Carrier`. */
function cibles(program, root) {
  const checker = program.getTypeChecker()
  const want = norm(path.resolve(root, CARRIER))
  const sf = program.getSourceFiles().find((f) => norm(f.fileName) === want)
  const alias = sf?.statements.find((s) => ts.isTypeAliasDeclaration(s) && s.name.text === 'Carrier')
  if (!alias) throw new Error(`objetsPorteur : type \`Carrier\` introuvable dans ${CARRIER}`)
  const carrier = checker.getTypeAtLocation(alias.name)
  const items = new Set()
  const placement = new Set()
  for (const membre of carrier.isUnion() ? carrier.types : [carrier]) {
    for (const p of checker.getPropertiesOfType(membre)) {
      if (p.name === 'kind') continue
      const porteur = checker.getNonNullableType(checker.getTypeOfSymbol(p))
      const itemsSym = checker.getPropertyOfType(porteur, 'items')
      if (!itemsSym) continue
      for (const d of declarationsDe(checker, porteur, 'items')) items.add(d)
      const liste = checker.getNonNullableType(checker.getTypeOfSymbol(itemsSym))
      const objet = checker.getIndexTypeOfType(liste, ts.IndexKind.Number)
      if (objet) for (const champ of CHAMPS_PLACEMENT) for (const d of declarationsDe(checker, objet, champ)) placement.add(d)
    }
  }
  if (!items.size || !placement.size) throw new Error('objetsPorteur : `Carrier` ne porte aucune liste `items` d’objets')
  return { checker, items, placement }
}

/** L'accès `n` désigne-t-il une propriété dont une déclaration est dans `decls` ? */
function accesDe(checker, n, decls) {
  if (!nomAccede(n)) return false
  const sym = checker.getSymbolAtLocation(ts.isPropertyAccessExpression(n) ? n.name : n.argumentExpression)
  return (sym?.declarations ?? []).some((d) => decls.has(d))
}

/** Fonction déclarée qui enveloppe `n`, si elle est l'une des `noms` de la couture. */
function dansCouture(n, root, noms) {
  for (let p = n.parent; p; p = p.parent) {
    if (ts.isFunctionDeclaration(p) && p.name && noms.has(p.name.text)) {
      return norm(path.relative(root, p.getSourceFile().fileName)) === COUTURE
    }
  }
  return false
}

/**
 * Écarts du dépôt (ou du Program injecté), `src/` hors tests.
 * @returns {{ angle: 'placement' | 'entree', forme: string, at: string }[]}
 */
export function auditObjetsPorteur(root, programme = null) {
  const program = programme ?? programmeObjetsPorteur(root)
  const { checker, items, placement } = cibles(program, root)
  const estItems = (e) => {
    const n = deballer(e)
    if (accesDe(checker, n, items)) return true
    if (!ts.isIdentifier(n)) return false
    const decl = checker.getSymbolAtLocation(n)?.valueDeclaration
    return !!decl && ts.isVariableDeclaration(decl) && !!decl.initializer && accesDe(checker, deballer(decl.initializer), items)
  }
  const etend = (e) => {
    const n = deballer(e)
    if (ts.isArrayLiteralExpression(n)) {
      return n.elements.length >= 2 && n.elements.some((el) => ts.isSpreadElement(el) && estItems(el.expression))
    }
    return (
      ts.isCallExpression(n) &&
      ts.isPropertyAccessExpression(n.expression) &&
      n.expression.name.text === 'concat' &&
      n.arguments.length > 0 &&
      estItems(n.expression.expression)
    )
  }
  const ecarts = []
  for (const sf of program.getSourceFiles()) {
    const rel = norm(path.relative(root, sf.fileName))
    if (sf.isDeclarationFile || !rel.startsWith('src/') || estTest(rel)) continue
    const poser = (angle, forme, n) =>
      ecarts.push({ angle, forme, at: `${rel}:${sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1}` })
    const visit = (n) => {
      if (ts.isBinaryExpression(n) && n.operatorToken.kind >= ts.SyntaxKind.FirstAssignment && n.operatorToken.kind <= ts.SyntaxKind.LastAssignment) {
        const gauche = deballerParentheses(n.left)
        if (accesDe(checker, gauche, placement) && !dansCouture(n, root, PLACEMENT)) poser('placement', 'affectation', n)
        if (n.operatorToken.kind === ts.SyntaxKind.EqualsToken && accesDe(checker, gauche, items) && etend(n.right) && !dansCouture(n, root, ENTREE)) {
          poser('entree', 'affectation étendue', n)
        }
      } else if (ts.isDeleteExpression(n)) {
        if (accesDe(checker, deballerParentheses(n.expression), placement) && !dansCouture(n, root, PLACEMENT)) poser('placement', 'delete', n)
      } else if (ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression)) {
        const methode = n.expression.name.text
        const cible = n.expression.expression
        if (methode in INSERTIONS && n.arguments.length >= INSERTIONS[methode] && estItems(cible) && !dansCouture(n, root, ENTREE)) {
          poser('entree', methode, n)
        }
        if (methode === 'assign' && ts.isIdentifier(cible) && cible.text === 'Object' && n.arguments.length >= 2) {
          const [dest, ...sources] = n.arguments
          const destPorte = CHAMPS_PLACEMENT.some((c) => [...declarationsDe(checker, checker.getTypeAtLocation(dest), c)].some((d) => placement.has(d)))
          const patchPorte = sources.some((s) => CHAMPS_PLACEMENT.some((c) => checker.getPropertyOfType(checker.getTypeAtLocation(s), c)))
          if (destPorte && patchPorte && !dansCouture(n, root, PLACEMENT)) poser('placement', 'Object.assign', n)
        }
      } else if (ts.isPropertyAssignment(n) && ts.isIdentifier(n.name) && n.name.text === 'items') {
        if (etend(n.initializer) && !dansCouture(n, root, ENTREE)) poser('entree', 'littéral d’objet', n)
      }
      ts.forEachChild(n, visit)
    }
    visit(sf)
  }
  return ecarts
}
