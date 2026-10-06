import { ast } from '../../guards/lib/dialecte.mjs';
// Scanner AST des USAGES de la coquille de jet `RollShell` (#1078 LOT C2) — le pendant CÔTÉ
// AFFICHAGE du registre des producteurs (`docs/registre-jets.md`, qui mesure d'où PARTENT les jets).
// Ici on mesure, par consommateur, QUELLES ZONES de la coquille il remplit.
//
// Deux populations, toutes deux dérivées du code (aucune liste de fichiers en dur) :
//   (J) un site JSX `<RollShell …>` en fichier de production ;
//   (H) une fonction dont le TYPE DE RETOUR mentionne `ComponentProps<typeof RollShell>` (les hooks
//       `src/ui/jetProps/use*JetProps` : ils ne rendent pas la coquille, ils la PARAMÈTRENT).
//
// Les ZONES elles-mêmes sont lues à la source : les props de `RollShell` (zones de coquille) et les
// membres de `RollRowProps` (zones de rangée). Une prop ajoutée à la primitive apparaît donc au
// prochain build ; aucune colonne n'est écrite à la main.
import * as ts from 'typescript/unstable/ast'
import { jsdocBody } from './jsdocUnion.mjs'

/** Source TypeScript parsée, JSX activé pour les `.tsx`. */
export function parseSource(rel, text) {
  return ast({ rel, text })
}

const lineOf = (sf, node) => sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1

/** Id de zone du contrat d'affichage (`Zn`) déclaré par le JSDoc de la prop, `null` s'il n'y en a pas.
 *  Les ids sont DÉFINIS par la charte (`docs/charte-ui.md`) ; ici on ne fait que les relever. */
function zoneIdOf(doc) {
  const m = doc && doc.match(/\bZ(\d+)\b/)
  return m ? `Z${m[1]}` : null
}

/** Membres d'un conteneur de propriétés (type literal ou interface), avec JSDoc + id de zone. */
function membersOf(text, sf, container, tool, what) {
  if (!container) {
    console.error(`${tool} — ${what} introuvable : la primitive de jet a changé de forme, le scan ne mesure plus rien.`)
    process.exit(1)
  }
  const out = []
  let prevEnd = container.members.pos
  for (const m of container.members) {
    if (ts.isPropertySignatureDeclaration(m)) {
      const doc = jsdocBody(text.slice(prevEnd, m.getStart(sf)))
      out.push({ name: m.name.getText(sf), optional: m.postfixToken?.kind === ts.SyntaxKind.QuestionToken, zone: zoneIdOf(doc) })
    }
    prevEnd = m.getEnd()
  }
  return out
}

/** Zones de COQUILLE = les props du paramètre unique de `RollShell` (src/ui/RollShell.tsx). */
export function shellZones(text, tool) {
  const sf = parseSource('RollShell.tsx', text)
  let fn = null
  sf.forEachChild((n) => { if (ts.isFunctionDeclaration(n) && n.name?.text === 'RollShell') fn = n })
  const type = fn?.parameters?.[0]?.type
  return membersOf(text, sf, type && ts.isTypeLiteralNode(type) ? type : null, tool, 'le littéral de props de `RollShell`')
}

/** Zones de RANGÉE = les membres de `RollRowProps` (src/ui/RollRow.tsx). */
export function rowZones(text, tool) {
  const sf = parseSource('RollRow.tsx', text)
  let itf = null
  sf.forEachChild((n) => { if (ts.isInterfaceDeclaration(n) && n.name.text === 'RollRowProps') itf = n })
  return membersOf(text, sf, itf, tool, "l'interface `RollRowProps`")
}

/** Nature de la valeur passée à une prop JSX — ce que l'AST voit sans suivre la liaison. */
function attrShape(sf, attr) {
  const init = attr.initializer
  if (!init) return 'drapeau'
  if (ts.isStringLiteral(init)) return 'littéral'
  const e = ts.isJsxExpression(init) ? init.expression : init
  if (!e) return 'vide'
  if (ts.isArrayLiteralExpression(e)) return 'tableau'
  if (ts.isObjectLiteralExpression(e)) return 'objet'
  if (ts.isJsxElement(e) || ts.isJsxSelfClosingElement(e) || ts.isJsxFragment(e)) return 'JSX'
  if (ts.isIdentifier(e) || ts.isPropertyAccessExpression(e)) return 'variable'
  if (ts.isCallExpression(e)) return 'appel'
  return 'expression'
}

/** Cardinalité des rangées telle qu'elle est LISIBLE au site : un tableau littéral se compte,
 *  une variable/un appel ne se compte pas (angle mort déclaré). */
function rowsCardinality(sf, node) {
  const attr = node.attributes.properties.find((p) => ts.isJsxAttribute(p) && p.name.getText(sf) === 'rows')
  if (!attr) return null
  const init = attr.initializer
  const e = init && ts.isJsxExpression(init) ? init.expression : null
  if (e && ts.isArrayLiteralExpression(e)) {
    const spread = e.elements.some((el) => ts.isSpreadElement(el))
    return { kind: spread ? 'littéral+spread' : 'littéral', n: e.elements.length }
  }
  return { kind: e && ts.isCallExpression(e) ? 'appel' : 'variable', n: null }
}

/** Composants (PascalCase) rendus DANS le sous-arbre d'un nœud — ce que les slots hébergent. */
function companionsIn(sf, node, self) {
  const out = new Set()
  const walk = (n) => {
    if (ts.isJsxOpeningElement(n) || ts.isJsxSelfClosingElement(n)) {
      const tag = n.tagName.getText(sf)
      if (/^[A-Z]/.test(tag) && tag !== self) out.add(tag)
    }
    n.forEachChild(walk)
  }
  walk(node)
  return [...out].sort()
}

/** Fonction dont le TYPE DE RETOUR mentionne `ComponentProps<typeof RollShell>` (paramétreur de coquille). */
function isShellPropsProducer(sf, node) {
  const t = node.type
  return !!t && /ComponentProps<\s*typeof\s+RollShell\s*>/.test(t.getText(sf))
}

/** Propriétés du/des littéraux d'objet RENVOYÉS par une fonction (le paramétrage produit). */
function returnedObjectProps(sf, fn) {
  const props = []
  const spreads = []
  const consider = (e) => {
    if (!e) return
    const x = ts.isParenthesizedExpression(e) ? e.expression : e
    if (ts.isConditionalExpression(x)) { consider(x.whenTrue); consider(x.whenFalse); return }
    if (!ts.isObjectLiteralExpression(x)) return
    for (const p of x.properties) {
      if (ts.isSpreadAssignment(p)) spreads.push(p.expression.getText(sf))
      else if (p.name) props.push({ name: p.name.getText(sf), shape: 'objet' })
    }
  }
  const walk = (n) => {
    if (ts.isReturnStatement(n)) consider(n.expression)
    // Une fonction imbriquée a ses propres retours : on ne descend pas dedans.
    if (n !== fn && (ts.isFunctionDeclaration(n) || ts.isFunctionExpression(n) || ts.isArrowFunction(n))) return
    n.forEachChild(walk)
  }
  walk(fn)
  return { props, spreads }
}

/**
 * Symbole ENGLOBANT d'un nœud : la fonction/le composant nommé qui le contient (déclaration de
 * fonction, const fléchée, méthode, propriété d'objet). C'est l'ancre STABLE d'un site — un numéro
 * de ligne bouge à la moindre édition au-dessus et ferait churner la doc générée.
 */
function enclosingSymbol(sf, node) {
  for (let n = node.parent; n; n = n.parent) {
    if (ts.isFunctionDeclaration(n) && n.name) return n.name.text
    if ((ts.isArrowFunction(n) || ts.isFunctionExpression(n) || ts.isClassExpression(n)) && ts.isVariableDeclaration(n.parent) && ts.isIdentifier(n.parent.name))
      return n.parent.name.text
    if ((ts.isArrowFunction(n) || ts.isFunctionExpression(n)) && (ts.isPropertyAssignment(n.parent) || ts.isMethodDeclaration(n.parent)) && n.parent.name)
      return n.parent.name.getText(sf)
    if (ts.isMethodDeclaration(n) && n.name) return n.name.getText(sf)
    if (ts.isClassDeclaration(n) && n.name) return n.name.text
  }
  return '(module)'
}

/**
 * Usages de `RollShell` d'UN fichier de production.
 * Rend `{ sites, rowKeys }` — `sites` = un par site JSX (J) ou par producteur de props (H), ancré sur
 * son SYMBOLE englobant (`line` reste disponible pour un diagnostic, jamais pour la doc comparée) ;
 * `rowKeys` = les clés de zone de RANGÉE vues dans le fichier (littéraux d'objet ou props de `RollRow`).
 */
export function scanRollShellUsage(rel, text, rowZoneNames, sourceFile) {
  const sf = sourceFile ?? parseSource(rel, text)
  const sites = []
  const rowKeys = new Set()

  const walk = (node) => {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const tag = node.tagName.getText(sf)
      if (tag === 'RollShell') {
        const props = []
        const spreads = []
        for (const a of node.attributes.properties) {
          if (ts.isJsxAttribute(a)) props.push({ name: a.name.getText(sf), shape: attrShape(sf, a) })
          else spreads.push(a.expression ? a.expression.getText(sf) : '…')
        }
        const host = ts.isJsxOpeningElement(node) && node.parent ? node.parent : node
        sites.push({
          kind: 'J', symbol: enclosingSymbol(sf, node), line: lineOf(sf, node), props, spreads,
          rows: rowsCardinality(sf, node), companions: companionsIn(sf, host, 'RollShell'),
        })
      }
      if (tag === 'RollRow') {
        for (const a of node.attributes.properties)
          if (ts.isJsxAttribute(a) && rowZoneNames.has(a.name.getText(sf))) rowKeys.add(a.name.getText(sf))
      }
    }
    if ((ts.isPropertyAssignment(node) || ts.isShorthandPropertyAssignment(node)) && node.name && rowZoneNames.has(node.name.getText(sf)))
      rowKeys.add(node.name.getText(sf))
    if ((ts.isFunctionDeclaration(node) || ts.isArrowFunction(node) || ts.isFunctionExpression(node)) && isShellPropsProducer(sf, node)) {
      const { props, spreads } = returnedObjectProps(sf, node)
      const name = ts.isFunctionDeclaration(node) ? node.name?.text : null
      sites.push({
        kind: 'H', symbol: name ?? enclosingSymbol(sf, node), line: lineOf(sf, node), props, spreads,
        rows: null, companions: companionsIn(sf, node, 'RollShell'),
      })
    }
    node.forEachChild(walk)
  }
  walk(sf)
  return { sites, rowKeys: [...rowKeys].sort() }
}
