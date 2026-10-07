// RACINES BALAYÉES d'un module (#2400) : les dossiers et fichiers que DÉCLARENT ses appels aux helpers
// canoniques de listage et de lecture en lot (`HELPERS_DE_BALAYAGE`). L'argument se lit sur l'arbre
// syntaxique : un littéral, un tableau, un `join`/`resolve`, une URL relative au module, ou une constante,
// locale ou IMPORTÉE (`lectureDeModule`, puis `evaluer`). Ce qui ne se lit pas ainsi n'est pas deviné :
// il rend `non` avec sa raison, et son site sort au rapport de l'appelant.
// Les FOYERS (modules qui définissent un helper) relaient leurs paramètres : un site de foyer dont la
// racine dépend d'un paramètre est un relais, pas une déclaration (`relais`).
import { posix } from 'node:path'
import { typescript } from './dialecte.mjs'

/** Les helpers dont un appel déclare des racines, avec le module qui les définit et la lecture de
 *  leurs arguments (`argument` : index de la racine ; `depot` : index du dépôt, racines sous lui). */
const HELPERS_DE_BALAYAGE = Object.freeze({
  readCorpus: Object.freeze({ foyer: 'scripts/guards/lib/sourceCorpus.mjs', argument: 0 }),
  listerArbre: Object.freeze({ foyer: 'scripts/guards/lib/lister.mjs', argument: 0 }),
  listerDossier: Object.freeze({ foyer: 'scripts/guards/lib/lister.mjs', argument: 0 }),
  listerImage: Object.freeze({ foyer: 'scripts/guards/lib/gitPorte.mjs', depot: 0, chemins: 'reste', depuis: 2 }),
  lireEnLot: Object.freeze({ foyer: 'scripts/guards/lib/gitPorte.mjs', depot: 0, chemins: 'argument', depuis: 2 }),
  listerTests: Object.freeze({ foyer: 'scripts/gates/testsParGate.mjs', depot: 0, sous: 'scripts' }),
})

/** Préfiltre textuel : un module sans appel nommé d'un helper n'a aucun site. */
export const APPEL_DE_BALAYAGE = new RegExp(`\\b(?:${Object.keys(HELPERS_DE_BALAYAGE).join('|')})\\s*\\(`)

const FOYERS = new Set(Object.values(HELPERS_DE_BALAYAGE).map((h) => h.foyer))
const CHEMINS = new Set(['join', 'resolve'])
const ITERATEURS = new Set(['map', 'flatMap', 'forEach', 'filter', 'some', 'every', 'find'])
/** Ce qui rend une PARTIE de son receveur : la valeur du receveur la couvre. */
const SOUS_ENSEMBLES = new Set(['filter', 'sort', 'toSorted', 'slice'])
const PROFONDEUR = 24

/**
 * Le LECTEUR d'expressions de chemin d'un module : `expr(noeud)` rend son `Expr`, constantes locales et
 * importées comprises (`lier`).
 * @param {string} rel chemin POSIX du module, relatif au dépôt
 * @param {import('typescript/unstable/ast').SourceFile} arbre
 */
export function lecteurDExpressions(rel, arbre) {
  const ts = typescript()
  const parents = new Map()
  const marquer = (n) => n.forEachChild((e) => { parents.set(e, n); marquer(e) })
  marquer(arbre)
  const dossier = posix.dirname(rel)
  const nomAppele = (appel) => ts.isIdentifier(appel.expression) ? appel.expression.text
    : ts.isPropertyAccessExpression(appel.expression) ? appel.expression.name.text : null
  const estImportMeta = (n) => ts.isMetaProperty(n) && n.keywordToken === ts.SyntaxKind.ImportKeyword
  const non = (raison) => ({ k: 'non', raison })
  const lie = (nom, texte) => ts.isIdentifier(nom) ? nom.text === texte
    : !!nom && (ts.isObjectBindingPattern(nom) || ts.isArrayBindingPattern(nom)) && nom.elements.some((e) => ts.isBindingElement(e) && !!e.name && lie(e.name, texte))
  const estFonction = (n) => ts.isArrowFunction(n) || ts.isFunctionExpression(n) || ts.isFunctionDeclaration(n) || ts.isMethodDeclaration(n)

  const lier = (id, profondeur) => {
    if (id.text === '__dirname') return { k: 'chemin', v: dossier }
    for (let n = parents.get(id), enfant = id; n; enfant = n, n = parents.get(n)) {
      if (estFonction(n) && n.parameters.some((p) => lie(p.name, id.text))) {
        const appel = parents.get(n)
        if (appel && ts.isCallExpression(appel) && appel.arguments[0] === n && ts.isPropertyAccessExpression(appel.expression) &&
          ITERATEURS.has(appel.expression.name.text) && n.parameters[0] && ts.isIdentifier(n.parameters[0].name) && n.parameters[0].name.text === id.text)
          return expr(appel.expression.expression, profondeur)
        return { k: 'param', nom: id.text }
      }
      if ((ts.isForOfStatement(n) || ts.isForInStatement(n)) && enfant !== n.initializer && ts.isVariableDeclarationList(n.initializer) &&
        n.initializer.declarations.some((d) => lie(d.name, id.text))) {
        const [d] = n.initializer.declarations
        return ts.isForOfStatement(n) && ts.isIdentifier(d.name) ? expr(n.expression, profondeur) : non(`variable de boucle ${id.text}`)
      }
      const instructions = ts.isSourceFile(n) || ts.isBlock(n) || ts.isModuleBlock(n) || ts.isCaseClause(n) || ts.isDefaultClause(n) ? n.statements : null
      if (!instructions) continue
      for (const s of instructions) {
        if (ts.isVariableStatement(s))
          for (const d of s.declarationList.declarations)
            if (lie(d.name, id.text))
              return !ts.isIdentifier(d.name) ? non(`déstructuration ${id.text}`) : d.initializer ? expr(d.initializer, profondeur) : non(`${id.text} sans valeur initiale`)
        if (ts.isImportDeclaration(s) && ts.isStringLiteralLikeNode(s.moduleSpecifier) && s.importClause) {
          const liaisons = s.importClause.namedBindings
          if (liaisons && ts.isNamedImports(liaisons))
            for (const e of liaisons.elements)
              if (e.name.text === id.text) return { k: 'importe', spec: s.moduleSpecifier.text, nom: (e.propertyName ?? e.name).text }
          if (s.importClause.name?.text === id.text || (liaisons && ts.isNamespaceImport(liaisons) && liaisons.name.text === id.text))
            return non(`import par défaut ou espace ${id.text}`)
        }
      }
    }
    return non(`${id.text} introuvable`)
  }

  const expr = (n, profondeur = 0) => {
    if (profondeur > PROFONDEUR) return non('expression trop profonde')
    const p = profondeur + 1
    if (ts.isStringLiteralLikeNode(n)) return { k: 'lit', v: n.text }
    if (ts.isParenthesizedExpression(n) || ts.isAsExpression(n) || ts.isSatisfiesExpression(n) || ts.isNonNullExpression(n) || ts.isSpreadElement(n))
      return expr(n.expression, p)
    if (ts.isArrayLiteralExpression(n)) return { k: 'liste', v: n.elements.map((e) => expr(e, p)) }
    if (ts.isIdentifier(n)) return lier(n, p)
    if (ts.isPropertyAccessExpression(n)) {
      if (estImportMeta(n.expression) && n.name.text === 'dirname') return { k: 'chemin', v: dossier }
      if (estImportMeta(n.expression) && (n.name.text === 'url' || n.name.text === 'filename')) return { k: 'chemin', v: rel }
      if (n.name.text === 'pathname') return expr(n.expression, p)
      return non(`propriété ${n.getText(arbre)}`)
    }
    if (ts.isNewExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === 'URL') {
      const [cible, depuis] = n.arguments ?? []
      if (cible && ts.isStringLiteralLikeNode(cible) && depuis && ts.isPropertyAccessExpression(depuis) && estImportMeta(depuis.expression) && depuis.name.text === 'url')
        return { k: 'chemin', v: posix.join(dossier, cible.text) }
      return non(`URL ${n.getText(arbre)}`)
    }
    if (ts.isCallExpression(n)) {
      const nom = nomAppele(n)
      const args = [...n.arguments]
      if (CHEMINS.has(nom)) return { k: 'join', v: args.map((a) => expr(a, p)) }
      if (nom === 'dirname' && args[0]) return { k: 'dir', v: expr(args[0], p) }
      if (nom === 'cwd' && ts.isPropertyAccessExpression(n.expression) && n.expression.expression.getText(arbre) === 'process') return { k: 'chemin', v: '' }
      if (nom === 'tmpdir' || nom === 'mkdtempSync') return { k: 'hors' }
      if (['fileURLToPath', 'depotDe', 'depotReel', 'freeze'].includes(nom) && args[0]) return expr(args[0], p)
      if ((nom === 'replace' || nom === 'replaceAll') && ts.isPropertyAccessExpression(n.expression)) return expr(n.expression.expression, p)
      if (SOUS_ENSEMBLES.has(nom) && ts.isPropertyAccessExpression(n.expression)) return expr(n.expression.expression, p)
      if (ITERATEURS.has(nom) && ts.isPropertyAccessExpression(n.expression))
        return { k: 'transforme', raison: `appel ${n.expression.getText(arbre)}`, v: expr(n.expression.expression, p) }
      return non(`appel ${n.expression.getText(arbre)}`)
    }
    return non(`forme ${ts.SyntaxKind[n.kind]}`)
  }

  return { expr, lier, nomAppele }
}

/**
 * Sites de balayage et constantes EXPORTÉES d'un module, en expressions sérialisables (`Expr`) : la
 * mémoïsation par texte reste possible, l'évaluation attend la résolution des imports.
 * @param {string} rel chemin POSIX du module, relatif au dépôt
 * @param {import('typescript/unstable/ast').SourceFile} arbre
 * @returns {{ sites: { helper: string, ligne: number, racines: Expr, relais: boolean }[], exports: Record<string, Expr>, etoiles: string[] }}
 */
export function lectureDeModule(rel, arbre) {
  const ts = typescript()
  const non = (raison) => ({ k: 'non', raison })
  const { expr, lier, nomAppele } = lecteurDExpressions(rel, arbre)
  const contientParam = (e) => e && typeof e === 'object' && (e.k === 'param' || Object.values(e).some((v) =>
    Array.isArray(v) ? v.some(contientParam) : contientParam(v)))

  const sites = []
  const visiter = (n) => {
    if (ts.isCallExpression(n)) {
      const helper = nomAppele(n)
      const decl = Object.hasOwn(HELPERS_DE_BALAYAGE, helper) ? HELPERS_DE_BALAYAGE[helper] : null
      if (decl) {
        const args = [...n.arguments]
        const de = (i) => (args[i] ? expr(args[i]) : { k: 'chemin', v: '' })
        const racines = decl.argument !== undefined ? (args[decl.argument] ? expr(args[decl.argument]) : non('argument absent'))
          : decl.sous ? { k: 'join', v: [de(decl.depot), { k: 'lit', v: decl.sous }] }
            : { k: 'sous', depot: de(decl.depot), v: decl.chemins === 'reste'
              ? (args.length > decl.depuis ? { k: 'liste', v: args.slice(decl.depuis).map((a) => expr(a)) } : { k: 'lit', v: '' })
              : (args[decl.depuis] ? expr(args[decl.depuis]) : non('chemins absents')) }
        sites.push({ helper, ligne: arbre.getLineAndCharacterOfPosition(n.getStart(arbre)).line + 1, racines, relais: FOYERS.has(rel) && contientParam(racines) })
      }
    }
    n.forEachChild(visiter)
  }
  visiter(arbre)

  const exports = {}
  const etoiles = []
  for (const s of arbre.statements) {
    if (ts.isVariableStatement(s) && s.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword))
      for (const d of s.declarationList.declarations)
        if (ts.isIdentifier(d.name)) exports[d.name.text] = d.initializer ? expr(d.initializer) : non(`${d.name.text} sans valeur initiale`)
    if (ts.isExportDeclaration(s)) {
      const spec = s.moduleSpecifier && ts.isStringLiteralLikeNode(s.moduleSpecifier) ? s.moduleSpecifier.text : null
      if (!s.exportClause) { if (spec) etoiles.push(spec); continue }
      if (!ts.isNamedExports(s.exportClause)) continue
      for (const e of s.exportClause.elements) {
        const origine = (e.propertyName ?? e.name).text
        exports[e.name.text] = spec ? { k: 'importe', spec, nom: origine } : lier(e.propertyName ?? e.name, 0)
      }
    }
  }
  return { sites, exports, etoiles }
}

/**
 * La valeur d'une racine (`Expr`) : chemins POSIX relatifs au dépôt (`{ chemin }`), lieu HORS du dépôt
 * (`{ hors: true }`, un dossier temporaire), ou `{ non: raison }`. Une chaîne nue est relative à la
 * racine du dépôt : c'est là que les helpers et les suites lisent.
 * `importe(spec, nom)` rend les valeurs de la constante `nom` du module que `spec` désigne.
 * @param {Expr} e @param {{ importe: (spec: string, nom: string) => Valeur[] }} contexte
 * @returns {Valeur[]}
 */
export function evaluer(e, contexte) {
  const brutes = valeurs(e, contexte)
  return brutes.map((v) => 'texte' in v ? ancrer(v.texte) : v)
}

/** @typedef {{ chemin: string } | { hors: true } | { non: string }} Valeur */
/** @typedef {Record<string, unknown> & { k: string }} Expr */

const ancrer = (texte) => /^([a-zA-Z]:)?[\\/]/.test(texte) ? { non: `chemin absolu ${texte}` } : borne(posix.normalize(texte.replace(/\\/g, '/')))
const borne = (chemin) => {
  const net = chemin.replace(/\/+$/, '').replace(/^\.$/, '')
  return net === '..' || net.startsWith('../') ? { hors: true } : { chemin: net }
}

function valeurs(e, contexte) {
  switch (e.k) {
    case 'lit': return [{ texte: e.v }]
    case 'chemin': return [borne(posix.normalize(e.v || '.'))]
    case 'hors': return [{ hors: true }]
    case 'non': return [{ non: e.raison }]
    case 'param': return [{ non: `paramètre ${e.nom}` }]
    case 'transforme': return [{ non: e.raison }]
    case 'liste': return e.v.flatMap((x) => valeurs(x, contexte))
    case 'importe': return contexte.importe(e.spec, e.nom)
    case 'dir': return valeurs(e.v, contexte).map((v) => 'chemin' in v ? borne(posix.dirname(v.chemin || '.')) : 'texte' in v ? { texte: posix.dirname(v.texte) } : v)
    case 'join': {
      let acc = [{ texte: '' }]
      for (const partie of e.v) {
        const suite = valeurs(partie, contexte)
        acc = acc.flatMap((a) => suite.map((s) => joindre(a, s)))
      }
      return acc
    }
    case 'sous': {
      const depots = valeurs(e.depot, contexte).map((v) => 'texte' in v ? ancrer(v.texte) : v)
      const chemins = valeurs(e.v, contexte)
      return depots.flatMap((d) => 'chemin' in d ? chemins.map((c) => joindre(d, c)) : [d])
    }
    default: return [{ non: `expression ${e.k}` }]
  }
}

function joindre(a, s) {
  if ('non' in a || 'hors' in a) return a
  if ('non' in s || 'hors' in s) return s
  if ('chemin' in s) return s
  if ('chemin' in a) return /^([a-zA-Z]:)?[\\/]/.test(s.texte) ? { non: `chemin absolu ${s.texte}` } : borne(posix.join(a.chemin || '.', s.texte.replace(/\\/g, '/')))
  return { texte: a.texte ? posix.join(a.texte, s.texte) : s.texte }
}
