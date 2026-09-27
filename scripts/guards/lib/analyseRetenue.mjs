// Garde de classe #1801 — une structure d'ANALYSE (`ts.Program`, `ts.SourceFile`, ce qui en dérive) ou
// un DÉRIVÉ de corpus rangé dans une liaison de portée de COLLECTION. Invariant et prix : en-tête de
// `tsProgram.mjs`. Consommateur : `src/analyse-retention-guard.test.ts`, qui fixe le PÉRIMÈTRE (les
// modules que la suite charge).
//
// FABRIQUE : `FABRIQUES_D_ANALYSE` (appel nu ou membre, `ts.createProgram`) ; toute fonction NOMMÉE du
// fichier (déclaration, `const f = () => …`, ou fonction ou méthode d'objet LITTÉRAL, nommée par sa
// clé : `{ P: () => …, Q() { … } }`) dont un `return` ou le corps d'expression rend une valeur
// TEINTE ; une liaison initialisée par un appel teint qui reçoit une fonction (mémo) ; le LECTEUR de
// la primitive de détention dont la fabrique rend une valeur teinte (`P()` est teint, la liaison `P`
// ne l'est pas) ; un nom INITIALISÉ ou AFFECTÉ d'une fabrique (`const lire = P`, `let lire; lire = P`)
// ou une propriété d'objet LITTÉRAL qui en reçoit une (`{ P: detenteur(…) }` : `K.P()` est teint) ;
// toute fonction ou `const` EXPORTÉE de ce genre, jugée sur SA déclaration (ou sa place dans les
// listes de base), que le fichier importe par son nom (`fabriquesDuCorpus`, point fixe sur le corpus
// entier).
// CORPUS : l'appel d'une source (`SOURCES_DE_CORPUS`), un nom qui en reçoit un, une fonction nommée
// dont le corps d'expression en rend un. Le corpus lui-même est l'exception documentée
// (`sourceCorpus.mjs`, PRIX) : il n'est pas teint.
// TEINTE : l'appel d'une fabrique ; `map`, `flatMap`, `filter`, `join` appliqué à un corpus ; l'appel
// de toute fonction à qui l'on passe une fonction qui rend une valeur teinte, ou une fabrique par son
// nom (mémo, rappel de `flatMap`), SAUF la primitive de détention appelée à la collecte ; une fonction
// immédiatement appelée qui en rend une ; l'accès ou l'appel de membre sur une racine teinte
// (`p.getTypeChecker()`, `...p.getSourceFiles()`) ; un `new` dont un argument l'est ; un nom local
// initialisé ou affecté par une valeur teinte ; un littéral objet/tableau qui en contient une ; `??`,
// `||`, `&&`, un ternaire ou une affectation composée dont une branche l'est ; parenthèses, `await`,
// `as`, `satisfies`, `!`, `...` traversés.
// RÉTENTION — liaison d'une portée de COLLECTION (`estCollection` : le module, le rappel d'un
// `describe(`, une IIFE dont l'appel initialise une liaison de collection — tous survivent au fichier
// sous `isolate: false`, mesuré #1801) :
//   1. initialisée par une valeur teinte (champ `static` compris) ;
//   2. affectée d'une valeur teinte (`=`, `??=`, `||=`, `&&=`) ;
//   3. remplie d'une valeur teinte par `.set(`, `.add(`, `.push(`, `.unshift(` ;
//   4. dont une propriété (`X.p =`, `X[k] =`) reçoit une valeur teinte ;
//   5. liée à un mémo et nourrie d'une valeur teinte, d'un corpus ou d'une fonction qui rend une
//      valeur teinte (`mémo nourri`).
// LIBÉRATION : la primitive `detenteur` (`PRIMITIVE_DE_DETENTION`), importée PAR SON MODULE dans un
// fichier de test et appelée en portée de COLLECTION, enregistre son `afterAll` : son appel n'est pas
// teint. Un homonyme local, importé d'ailleurs, appelé hors fichier de test ou dans un `it`/hook (son
// `afterAll` n'y court pas) n'est pas elle. Les formes 2 à 5 sont LICITES quand un rappel
// d'`afterAll(`/`afterEach(` remet la liaison à `undefined`/`null` ou la vide par `.clear()`. La forme
// 1 n'a pas de libération : une `const` de collection vit autant que le worker.
// PORTÉE : un nom se résout à la fonction (ou au module) qui le déclare ; un homonyme de BLOC dans la
// même fonction y est confondu.
// HORS DE PORTÉE : une valeur qui passe par un paramètre, un rappel qui ne la REND pas (`forEach`),
// une déstructuration, une méthode de classe, un accesseur `get` ou une clé calculée d'objet littéral,
// `globalThis`, un import d'espace de noms ou un ré-export perd sa teinte ; une fabrique rangée par
// AFFECTATION de propriété (`K.lire = P`), dans une collection (`new Map([['p', P]])`), choisie par un
// ternaire (`const lire = c ? P : Q`), liée par `.bind`, ou désignée par un alias de membre
// (`const creer = ts.createSourceFile`) perd sa qualité de fabrique ; une propriété de fabrique et un
// nom homonymes du fichier sont confondus (la qualité se tient par NOM) ; deux exports homonymes du
// corpus sont confondus (le point fixe est par NOM exporté) ; un index DÉRIVÉ d'un AST par une boucle
// (liste de constats, table de noms remplie hors des formes 3 et 4) n'est pas teint.
import { posix } from 'node:path'
import ts from 'typescript'
import { estSuiteVitest } from './fichierVitest.mjs'

export const FABRIQUES_D_ANALYSE = Object.freeze([
  'repoProgram',
  'virtualProgram',
  'createProgram',
  'createIncrementalProgram',
  'createWatchProgram',
  'createLanguageService',
  'createSourceFile',
])

/** Sources de CORPUS : leur rendu est l'exception documentée (`sourceCorpus.mjs`, PRIX), un DÉRIVÉ
 *  (`DERIVATIONS`) ne l'est pas. */
export const SOURCES_DE_CORPUS = Object.freeze(['readCorpus'])

const DERIVATIONS = new Set(['map', 'flatMap', 'filter', 'join'])
const MEMOS = new Set(['memoByRef', 'memoByRefDeps'])

/** La primitive de DÉTENTION d'un fichier de test : module (chemin sans extension depuis la racine)
 *  et nom exporté. Son appel, importé de ce module dans un fichier de test, rend un lecteur libéré. */
export const PRIMITIVE_DE_DETENTION = Object.freeze({ module: 'src/detenteur.testkit', nom: 'detenteur' })
const LIBERATIONS = new Set(['afterAll', 'afterEach'])
const REMPLISSAGES = new Set(['set', 'add', 'push', 'unshift'])
const AFFECTATIONS = new Set([
  ts.SyntaxKind.EqualsToken,
  ts.SyntaxKind.QuestionQuestionEqualsToken,
  ts.SyntaxKind.BarBarEqualsToken,
  ts.SyntaxKind.AmpersandAmpersandEqualsToken,
])
const BRANCHES = new Set([
  ts.SyntaxKind.QuestionQuestionToken,
  ts.SyntaxKind.BarBarToken,
  ts.SyntaxKind.AmpersandAmpersandToken,
  ts.SyntaxKind.CommaToken,
])

const sourceDe = (rel, texte) => ts.createSourceFile(rel, texte, ts.ScriptTarget.Latest, true)

const sansEnveloppe = (e) => {
  while (
    e &&
    (ts.isParenthesizedExpression(e) ||
      ts.isAwaitExpression(e) ||
      ts.isAsExpression(e) ||
      ts.isSatisfiesExpression(e) ||
      ts.isNonNullExpression(e) ||
      ts.isTypeAssertionExpression(e) ||
      ts.isSpreadElement(e))
  )
    e = e.expression
  return e
}

const nomAppele = (appel) => {
  const c = sansEnveloppe(appel.expression)
  if (ts.isIdentifier(c)) return c.text
  if (ts.isPropertyAccessExpression(c)) return c.name.text
  return undefined
}

const estFonction = (e) => !!e && (ts.isArrowFunction(e) || ts.isFunctionExpression(e))

/** Valeur de CORPUS : l'appel d'une source, ou un nom qui en a reçu une. */
function corpusDe(e, ctx) {
  e = sansEnveloppe(e)
  if (!e) return false
  if (ts.isCallExpression(e)) return ctx.corpus.has(nomAppele(e))
  if (ts.isIdentifier(e)) return ctx.portees.corpus(e)
  return false
}

/** Argument qui TEINT l'appel qui le reçoit : une fonction qui rend une valeur teinte, ou une
 *  fabrique passée par son nom. */
const argumentTeignant = (a, ctx) =>
  (estFonction(a) && rendTeinte(a, ctx)) || (ts.isIdentifier(a) && ctx.fabriques.has(a.text))

/** Appel de la PRIMITIVE DE DÉTENTION importée (`detentionsDe`, nom non ombré) en portée de
 *  COLLECTE : hors d'elle, son `afterAll` ne s'exécute pas et l'appel suit la règle commune. */
const estDetention = (appel, ctx) => {
  const c = sansEnveloppe(appel.expression)
  return ts.isIdentifier(c) && ctx.detentions.has(c.text) && !ctx.portees.resoudre(c) && estCollection(porteeDe(appel))
}

/** La fonction rend-elle une valeur teinte (corps d'expression, ou un `return` qui lui est propre) ? */
function rendTeinte(fn, ctx) {
  if (!fn.body) return false
  if (!ts.isBlock(fn.body)) return teinte(fn.body, ctx)
  let vu = false
  const v = (n) => {
    if (vu || ts.isFunctionLike(n)) return
    if (ts.isReturnStatement(n) && n.expression && teinte(n.expression, ctx)) vu = true
    else ts.forEachChild(n, v)
  }
  ts.forEachChild(fn.body, v)
  return vu
}

function teinte(e, ctx) {
  e = sansEnveloppe(e)
  if (!e) return false
  if (ts.isCallExpression(e)) {
    const nom = nomAppele(e)
    if (ctx.fabriques.has(nom)) return true
    const appele = sansEnveloppe(e.expression)
    if (estDetention(e, ctx)) return false
    if (e.arguments.some((a) => argumentTeignant(a, ctx))) return true
    if (estFonction(appele)) return rendTeinte(appele, ctx)
    if (ts.isPropertyAccessExpression(appele))
      return (DERIVATIONS.has(appele.name.text) && corpusDe(appele.expression, ctx)) || teinte(appele.expression, ctx)
    return false
  }
  if (ts.isPropertyAccessExpression(e) || ts.isElementAccessExpression(e)) return teinte(e.expression, ctx)
  if (ts.isNewExpression(e)) return (e.arguments ?? []).some((a) => teinte(a, ctx))
  if (ts.isIdentifier(e)) return ctx.portees.teint(e)
  if (ts.isObjectLiteralExpression(e))
    return e.properties.some((p) =>
      ts.isPropertyAssignment(p)
        ? teinte(p.initializer, ctx)
        : ts.isShorthandPropertyAssignment(p)
          ? ctx.portees.teint(p.name)
          : ts.isSpreadAssignment(p) && teinte(p.expression, ctx),
    )
  if (ts.isArrayLiteralExpression(e)) return e.elements.some((x) => teinte(x, ctx))
  if (ts.isConditionalExpression(e)) return teinte(e.whenTrue, ctx) || teinte(e.whenFalse, ctx)
  if (ts.isBinaryExpression(e)) {
    if (BRANCHES.has(e.operatorToken.kind)) return teinte(e.left, ctx) || teinte(e.right, ctx)
    if (AFFECTATIONS.has(e.operatorToken.kind)) return teinte(e.right, ctx)
  }
  return false
}

const marcher = (sf, visite) => {
  const v = (n) => {
    visite(n)
    ts.forEachChild(n, v)
  }
  ts.forEachChild(sf, v)
}

const porteeDe = (n) => {
  for (let p = n.parent; p; p = p.parent) if (ts.isFunctionLike(p) || ts.isSourceFile(p)) return p
  return undefined
}

/** Contexte d'un fichier : fabriques et sources de corpus VISIBLES, et ses portées (fonction ou
 *  module) — noms DÉCLARÉS, noms TEINTS, noms de CORPUS, par point fixe sur les déclarations et les
 *  affectations de noms nus. `resoudre(id)` rend la portée qui déclare le nom (`undefined` : global). */
function contexteDu(sf, fabriques, corpus, detentions) {
  const declares = new Map()
  const teints = new Map()
  const deCorpus = new Map()
  const ajouter = (m, portee, nom) => {
    let s = m.get(portee)
    if (!s) m.set(portee, (s = new Set()))
    if (s.has(nom)) return false
    s.add(nom)
    return true
  }
  marcher(sf, (n) => {
    if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name)) ajouter(declares, porteeDe(n), n.name.text)
    else if (ts.isParameter(n) && ts.isIdentifier(n.name)) ajouter(declares, n.parent, n.name.text)
    else if ((ts.isFunctionDeclaration(n) || ts.isClassDeclaration(n)) && n.name) ajouter(declares, porteeDe(n), n.name.text)
  })
  const resoudre = (id) => {
    for (let s = porteeDe(id); s; s = porteeDe(s)) if (declares.get(s)?.has(id.text)) return s
    return undefined
  }
  const portees = {
    resoudre,
    teint: (id) => !!teints.get(resoudre(id))?.has(id.text),
    corpus: (id) => !!deCorpus.get(resoudre(id))?.has(id.text),
  }
  const ctx = { fabriques, corpus, detentions, portees }
  for (let change = true; change; ) {
    change = false
    marcher(sf, (n) => {
      let id
      let valeur
      if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.initializer) [id, valeur] = [n.name, n.initializer]
      else if (ts.isBinaryExpression(n) && AFFECTATIONS.has(n.operatorToken.kind) && ts.isIdentifier(n.left)) [id, valeur] = [n.left, n.right]
      const portee = id && resoudre(id)
      if (!portee) return
      if (teinte(valeur, ctx)) change = ajouter(teints, portee, id.text) || change
      else if (corpusDe(valeur, ctx)) change = ajouter(deCorpus, portee, id.text) || change
    })
  }
  return ctx
}

const cleDe = (nom) => (ts.isIdentifier(nom) || ts.isStringLiteral(nom) ? nom.text : undefined)

/** Nom d'une fonction : le sien, celui de la liaison qu'elle initialise, ou la clé qui la porte dans
 *  un objet LITTÉRAL (propriété ou méthode). */
const nomDeFonction = (fn) => {
  if (ts.isMethodDeclaration(fn)) return ts.isObjectLiteralExpression(fn.parent) ? cleDe(fn.name) : undefined
  if ((ts.isFunctionDeclaration(fn) || ts.isFunctionExpression(fn)) && fn.name) return fn.name.text
  const p = fn.parent
  if (p && ts.isVariableDeclaration(p) && ts.isIdentifier(p.name)) return p.name.text
  if (p && ts.isPropertyAssignment(p) && ts.isObjectLiteralExpression(p.parent)) return cleDe(p.name)
  return undefined
}

/** Ce que rend l'appel d'une fonction : une valeur teinte (`fabriques`), un corpus par son corps
 *  d'expression (`corpus`), ou rien de suivi. */
const qualiteDeFonction = (fn, ctx) =>
  rendTeinte(fn, ctx) ? 'fabriques' : !ts.isBlock(fn.body) && corpusDe(fn.body, ctx) ? 'corpus' : undefined

/** Fonctions NOMMÉES du fichier qui rendent une valeur teinte (`fabriques`) ou un corpus (`corpus`),
 *  liaisons et propriétés d'objet littéral qui reçoivent une fabrique (`rendUneFabrique`) : leur
 *  appel en rend une (la liaison du lecteur, elle, n'est pas teinte). */
function derivesDuFichier(sf, fabriques, corpus) {
  const ctx = contexteDu(sf, fabriques, corpus, detentionsDe(sf))
  const out = { fabriques: new Set(), corpus: new Set() }
  marcher(sf, (n) => {
    if (ts.isFunctionLike(n) && n.body) {
      const nom = nomDeFonction(n)
      const qualite = nom && qualiteDeFonction(n, ctx)
      if (qualite) out[qualite].add(nom)
    } else if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.initializer) {
      if (rendUneFabrique(n.initializer, ctx)) out.fabriques.add(n.name.text)
    } else if (ts.isBinaryExpression(n) && AFFECTATIONS.has(n.operatorToken.kind) && ts.isIdentifier(n.left)) {
      if (rendUneFabrique(n.right, ctx)) out.fabriques.add(n.left.text)
    } else if (ts.isPropertyAssignment(n) && ts.isObjectLiteralExpression(n.parent) && rendUneFabrique(n.initializer, ctx)) {
      const cle = cleDe(n.name)
      if (cle) out.fabriques.add(cle)
    }
  })
  return out
}

/** Une valeur qui EST une fabrique : un nom de fabrique (alias `const lire = P`), le lecteur de la
 *  primitive de détention dont la fabrique rend une valeur teinte, ou un appel teint qui reçoit une
 *  fonction (mémo). */
function rendUneFabrique(valeur, ctx) {
  const v = sansEnveloppe(valeur)
  if (ts.isIdentifier(v)) return ctx.fabriques.has(v.text)
  if (!ts.isCallExpression(v)) return false
  const lecteur = estDetention(v, ctx) ? v.arguments.some((a) => argumentTeignant(a, ctx)) : teinte(v, ctx)
  return lecteur && v.arguments.some((a) => estFonction(a) || ts.isIdentifier(a))
}

const mentionne = (texte, noms) => [...noms].some((nom) => texte.includes(nom))

const estExporte = (n) =>
  ts.canHaveModifiers(n) && (ts.getModifiers(n) ?? []).some((m) => m.kind === ts.SyntaxKind.ExportKeyword)

/** Qualité de base d'une déclaration qui DÉFINIT une fabrique ou une source de la liste. */
const qualiteDeBase = (nom) =>
  FABRIQUES_D_ANALYSE.includes(nom) ? 'fabriques' : SOURCES_DE_CORPUS.includes(nom) ? 'corpus' : undefined

/** Qualité de chaque déclaration EXPORTÉE du module (fonction, ou `const` de tête), jugée sur SON
 *  nœud : un homonyme du fichier ne la lui prête pas. */
function exportes(sf, ctx) {
  const out = new Map()
  const qualifier = (nom, qualite) => out.set(nom, qualiteDeBase(nom) ?? qualite)
  for (const st of sf.statements) {
    if (!estExporte(st)) continue
    if (ts.isFunctionDeclaration(st) && st.name && st.body) qualifier(st.name.text, qualiteDeFonction(st, ctx))
    if (ts.isVariableStatement(st))
      for (const d of st.declarationList.declarations) {
        if (!ts.isIdentifier(d.name) || !d.initializer) continue
        const qualite = estFonction(d.initializer)
          ? qualiteDeFonction(d.initializer, ctx)
          : rendUneFabrique(d.initializer, ctx) && 'fabriques'
        qualifier(d.name.text, qualite)
      }
  }
  return out
}

/** Noms locaux de la PRIMITIVE DE DÉTENTION importée par nom depuis son module, dans un fichier de
 *  test seulement : ailleurs, aucun `afterAll` ne la libère. */
function detentionsDe(sf) {
  const out = new Set()
  if (!estSuiteVitest(sf.fileName)) return out
  for (const st of sf.statements) {
    const liens = ts.isImportDeclaration(st) ? st.importClause?.namedBindings : undefined
    if (!liens || !ts.isNamedImports(liens) || !ts.isStringLiteral(st.moduleSpecifier)) continue
    const cible = posix.join(posix.dirname(sf.fileName), st.moduleSpecifier.text).replace(/\.[cm]?[jt]sx?$/, '')
    if (cible !== PRIMITIVE_DE_DETENTION.module) continue
    for (const el of liens.elements) if ((el.propertyName ?? el.name).text === PRIMITIVE_DE_DETENTION.nom) out.add(el.name.text)
  }
  return out
}

/** Fabriques et sources de corpus VISIBLES dans le fichier : celles de base, les EXPORTÉES du corpus
 *  que le fichier IMPORTE (sous leur nom local), puis ses propres fonctions, par point fixe. */
function visiblesDansLeFichier(sf, exportees) {
  const fabriques = new Set(FABRIQUES_D_ANALYSE)
  const corpus = new Set(SOURCES_DE_CORPUS)
  for (const st of sf.statements) {
    const liens = st.importClause?.namedBindings
    if (!ts.isImportDeclaration(st) || !liens || !ts.isNamedImports(liens)) continue
    for (const el of liens.elements) {
      const importe = (el.propertyName ?? el.name).text
      if (exportees.fabriques.has(importe)) fabriques.add(el.name.text)
      if (exportees.corpus.has(importe)) corpus.add(el.name.text)
    }
  }
  for (let avant = -1; avant !== fabriques.size + corpus.size; ) {
    avant = fabriques.size + corpus.size
    const d = derivesDuFichier(sf, fabriques, corpus)
    for (const nom of d.fabriques) fabriques.add(nom)
    for (const nom of d.corpus) if (!fabriques.has(nom)) corpus.add(nom)
  }
  return { fabriques, corpus }
}

const termesDe = (exportees) => [
  ...FABRIQUES_D_ANALYSE,
  ...SOURCES_DE_CORPUS,
  ...MEMOS,
  ...exportees.fabriques,
  ...exportees.corpus,
]

/**
 * Fabriques et sources de corpus EXPORTÉES du corpus scanné, par point fixe à travers les imports.
 * Les AST vivent le temps de l'appel.
 * @param {readonly { rel: string, text: string }[]} fichiers
 * @returns {{ fabriques: Set<string>, corpus: Set<string> }}
 */
export function fabriquesDuCorpus(fichiers) {
  const exportees = { fabriques: new Set(), corpus: new Set() }
  const asts = new Map()
  const taille = () => exportees.fabriques.size + exportees.corpus.size
  for (let avant = -1; avant !== taille(); ) {
    avant = taille()
    for (const { rel, text } of fichiers) {
      if (!mentionne(text, termesDe(exportees))) continue
      let sf = asts.get(rel)
      if (!sf) asts.set(rel, (sf = sourceDe(rel, text)))
      const vus = visiblesDansLeFichier(sf, exportees)
      const ctx = contexteDu(sf, vus.fabriques, vus.corpus, detentionsDe(sf))
      for (const [nom, qualite] of exportes(sf, ctx)) if (qualite) exportees[qualite].add(nom)
    }
  }
  return exportees
}

const SUITES = new Set(['describe', 'suite'])

const appelDe = (fn) => {
  let p = fn.parent
  while (p && ts.isParenthesizedExpression(p)) p = p.parent
  return p && ts.isCallExpression(p) ? p : undefined
}

/** Portée de COLLECTION : le module ; le rappel d'un `describe(`/`suite(` (`.each`, `.skip`…
 *  compris) ; une fonction immédiatement appelée (IIFE) dont l'appel initialise une liaison de
 *  collection — sous Vitest `isolate: false`, toutes vivent autant que le worker. */
function estCollection(portee) {
  if (!portee) return false
  if (ts.isSourceFile(portee)) return true
  if (!estFonction(portee)) return false
  const appel = appelDe(portee)
  if (!appel) return false
  if (sansEnveloppe(appel.expression) === portee) {
    let p = appel.parent
    while (p && (ts.isParenthesizedExpression(p) || ts.isAsExpression(p) || ts.isSatisfiesExpression(p))) p = p.parent
    return !!p && ts.isVariableDeclaration(p) && estCollection(porteeDe(p))
  }
  if (!appel.arguments.includes(portee)) return false
  let c = sansEnveloppe(appel.expression)
  while (c && (ts.isCallExpression(c) || ts.isPropertyAccessExpression(c))) c = sansEnveloppe(c.expression)
  return !!c && ts.isIdentifier(c) && SUITES.has(c.text)
}

const racineDe = (e) => {
  e = sansEnveloppe(e)
  while (e && (ts.isPropertyAccessExpression(e) || ts.isElementAccessExpression(e))) e = sansEnveloppe(e.expression)
  return e && ts.isIdentifier(e) ? e : undefined
}

const estNeant = (e) => {
  e = sansEnveloppe(e)
  return (
    !!e &&
    ((ts.isIdentifier(e) && e.text === 'undefined') ||
      e.kind === ts.SyntaxKind.NullKeyword ||
      ts.isVoidExpression(e))
  )
}

/** Liaisons LIBÉRÉES dans un rappel d'`afterAll(`/`afterEach(` (remise à néant ou `.clear()`) :
 *  portée → noms, résolus par `portees`. */
function liberees(sf, portees) {
  const out = new Map()
  const liberer = (id) => {
    const p = portees.resoudre(id)
    if (!p) return
    if (!out.has(p)) out.set(p, new Set())
    out.get(p).add(id.text)
  }
  marcher(sf, (n) => {
    if (!ts.isCallExpression(n) || !LIBERATIONS.has(nomAppele(n)) || !ts.isIdentifier(sansEnveloppe(n.expression))) return
    for (const arg of n.arguments) {
      const v = (x) => {
        if (ts.isBinaryExpression(x) && x.operatorToken.kind === ts.SyntaxKind.EqualsToken && ts.isIdentifier(x.left) && estNeant(x.right))
          liberer(x.left)
        if (ts.isCallExpression(x) && ts.isPropertyAccessExpression(x.expression) && x.expression.name.text === 'clear') {
          const r = racineDe(x.expression.expression)
          if (r) liberer(r)
        }
        ts.forEachChild(x, v)
      }
      v(arg)
    }
  })
  return out
}

const estStatique = (n) =>
  ts.canHaveModifiers(n) && (ts.getModifiers(n) ?? []).some((m) => m.kind === ts.SyntaxKind.StaticKeyword)

/**
 * Rétentions d'analyse d'un fichier.
 * @param {string} rel chemin POSIX depuis la racine
 * @param {string} texte
 * @param {{ fabriques: Set<string>, corpus: Set<string> }} [exportees] `fabriquesDuCorpus` du corpus scanné
 * @returns {{ rel: string, line: number, liaison: string, forme: string }[]}
 */
export function retentionsDAnalyse(rel, texte, exportees = { fabriques: new Set(), corpus: new Set() }) {
  if (!mentionne(texte, termesDe(exportees))) return []
  const sf = sourceDe(rel, texte)
  const { fabriques, corpus } = visiblesDansLeFichier(sf, exportees)
  const ctx = contexteDu(sf, fabriques, corpus, detentionsDe(sf))
  const { portees } = ctx
  const libres = liberees(sf, portees)
  const out = []
  const poser = (n, liaison, forme) =>
    out.push({ rel, line: sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1, liaison, forme })
  /** L'identifiant désigne-t-il une liaison de COLLECTION non libérée ? */
  const retenue = (id) => {
    const p = portees.resoudre(id)
    return estCollection(p) && !libres.get(p)?.has(id.text)
  }
  /** Liaisons (portée + nom) qui reçoivent un MÉMO (`MEMOS`). */
  const memos = new Map()
  const estMemo = (id) => !!memos.get(portees.resoudre(id))?.has(id.text)

  marcher(sf, (n) => {
    let id
    let valeur
    if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.initializer) [id, valeur] = [n.name, n.initializer]
    else if (ts.isBinaryExpression(n) && AFFECTATIONS.has(n.operatorToken.kind) && ts.isIdentifier(n.left)) [id, valeur] = [n.left, n.right]
    const v = valeur && sansEnveloppe(valeur)
    if (!v || !ts.isCallExpression(v) || !MEMOS.has(nomAppele(v))) return
    const p = portees.resoudre(id)
    if (!memos.has(p)) memos.set(p, new Set())
    memos.get(p).add(id.text)
  })

  marcher(sf, (n) => {
    if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.initializer && estCollection(porteeDe(n)) && teinte(n.initializer, ctx))
      poser(n, n.name.text, 'initialisée')
    else if (ts.isPropertyDeclaration(n) && estStatique(n) && n.initializer && teinte(n.initializer, ctx) && estCollection(porteeDe(n.parent)))
      poser(n, `${n.parent.name?.text ?? 'classe'}.${n.name.getText(sf)}`, 'initialisée')
    else if (ts.isBinaryExpression(n) && AFFECTATIONS.has(n.operatorToken.kind) && teinte(n.right, ctx)) {
      const gauche = sansEnveloppe(n.left)
      const racine = racineDe(gauche)
      if (racine && retenue(racine)) poser(n, racine.text, ts.isIdentifier(gauche) ? 'affectée' : 'propriété affectée')
    } else if (ts.isCallExpression(n)) {
      const appele = sansEnveloppe(n.expression)
      if (ts.isPropertyAccessExpression(appele) && REMPLISSAGES.has(appele.name.text)) {
        const racine = racineDe(appele.expression)
        if (racine && retenue(racine) && n.arguments.some((a) => teinte(a, ctx))) poser(n, racine.text, `.${appele.name.text}(`)
      } else if (ts.isIdentifier(appele) && estMemo(appele) && retenue(appele)) {
        const nourri = n.arguments.some((a) => teinte(a, ctx) || corpusDe(a, ctx) || (estFonction(a) && rendTeinte(a, ctx)))
        if (nourri) poser(n, appele.text, 'mémo nourri')
      }
    }
  })
  return out
}
