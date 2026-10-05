// Garde de classe #1801 — une structure d'ANALYSE (`ts.Program`, `ts.SourceFile`, ce qui en dérive) ou
// un DÉRIVÉ de corpus rangé dans une liaison de portée de COLLECTION. Sessions libérées par
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
// teint pour un AST détaché. Une session native ou API exige un libérateur direct `dispose`/`close`.
// Un homonyme local, importé d'ailleurs, appelé hors fichier de test ou dans un `it`/hook n'est pas
// elle. Les AST détachés des formes 2 à 5 se libèrent par remise à néant ou `.clear()` ; une ressource
// native exige une fermeture directe dans un hook importé de Vitest. Les conteneurs possédés exigent
// `libererSessions` importé de `tsProgram.mjs`, puis leur vidage. Les appels conditionnels, fonctions
// différées et opérations après un retour ne prouvent pas une fermeture. Les ressources exportées
// se qualifient par module et nom exporté ; cette couche ne modélise pas le flot JavaScript général.
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
import { posix, resolve } from 'node:path'
import * as ts from 'typescript/unstable/ast'
import { ast, analyserCorpus } from './dialecte.mjs'
import { estSuiteVitest } from './fichierVitest.mjs'
import { origineImportee } from './canonUnique.mjs'

const FABRIQUES_DE_PROGRAMME = Object.freeze(['repoProgram', 'virtualProgram', 'syntaxProgram'])
export const FABRIQUES_D_ANALYSE = Object.freeze([
  ...FABRIQUES_DE_PROGRAMME,
  'analyserTexte',
  'analyserCorpus',
  'updateSnapshot',
  'getProjects',
  'getProject',
  'getDefaultProjectForFile',
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

const sourceDe = (rel, texte) => ast({ rel, text: texte })

const sansEnveloppe = (e) => {
  while (
    e &&
    (ts.isParenthesizedExpression(e) ||
      ts.isAwaitExpression(e) ||
      ts.isAsExpression(e) ||
      ts.isSatisfiesExpression(e) ||
      ts.isNonNullExpression(e) ||
      ts.isTypeAssertion(e) ||
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
  if (!(ts.isIdentifier(c) && ctx.detentions.has(c.text) && !ctx.portees.resoudre(c) && estCollection(porteeDe(appel)))) return false
  const fabrique = appel.arguments[0]
  const methode = ressourceDeFabrique(fabrique, ctx)
  if (!methode) return true
  if (methode === 'mixte') return false
  const liberateur = appel.arguments[1]
  const parametre = estFonction(liberateur) && liberateur.parameters[0]?.name
  return !!parametre && ts.isIdentifier(parametre) && fermeturesDirectes(liberateur).some(c =>
    ts.isPropertyAccessExpression(c.expression) && ts.isIdentifier(c.expression.expression)
    && c.expression.expression.text === parametre.text && c.expression.name.text === methode)
}

const moduleProgramme = 'scripts/guards/lib/tsProgram.mjs'
const cleRessource = (module, nom) => `${module}#${nom}`

function ressourceRendue(fn, ctx) {
  if (!fn.body) return undefined
  if (!ts.isBlock(fn.body)) return ressourceDe(fn.body, ctx)
  const qualites = new Set()
  const visiter = n => {
    if (ts.isFunctionLikeDeclaration(n)) return
    if (ts.isReturnStatement(n) && n.expression) {
      const qualite = ressourceDe(n.expression, ctx)
      if (qualite) qualites.add(qualite)
    } else n.forEachChild(visiter)
  }
  fn.body.forEachChild(visiter)
  return qualites.size > 1 ? 'mixte' : [...qualites][0]
}

function ressourceDeFabrique(expression, ctx) {
  const e = sansEnveloppe(expression)
  if (!e) return undefined
  if (estFonction(e) || ts.isFunctionDeclaration(e)) return ressourceRendue(e, ctx)
  const origine = origineImportee(e, ctx.sf)
  if (origine?.module === 'typescript/unstable/sync' && origine.nom === 'API') return 'close'
  if (origine?.module === moduleProgramme && FABRIQUES_DE_PROGRAMME.includes(origine.nom)) return 'dispose'
  if (origine) return ctx.exportees?.ressources?.get(cleRessource(origine.module, origine.nom))
  if (!ts.isIdentifier(e)) return undefined
  if (!ctx.portees.resoudre(e) && ctx.importees.has(e.text)) return ctx.importees.get(e.text)
  const fn = ctx.fonctions?.get(ctx.portees.resoudre(e))?.get(e.text)
  if (!fn || ctx.enCours.has(fn)) return undefined
  ctx.enCours.add(fn)
  try { return ressourceDeFabrique(fn, ctx) }
  finally { ctx.enCours.delete(fn) }
}

function ressourceDe(expression, ctx) {
  const e = sansEnveloppe(expression)
  if (!e) return undefined
  if (ts.isIdentifier(e)) return ctx.portees.ressource?.(e)
  if (ts.isCallExpression(e) || ts.isNewExpression(e)) {
    const fabrique = ressourceDeFabrique(e.expression, ctx)
    if (fabrique) return fabrique
    if (ts.isPropertyAccessExpression(e.expression) && e.expression.name.text === 'updateSnapshot' && ressourceDe(e.expression.expression, ctx) === 'close') return 'dispose'
  }
  if (ts.isArrayLiteralExpression(e)) return e.elements.map(x => ressourceDe(x, ctx)).find(Boolean)
  if (ts.isConditionalExpression(e)) {
    const a = ressourceDe(e.whenTrue, ctx), b = ressourceDe(e.whenFalse, ctx)
    return a && b && a !== b ? 'mixte' : a || b
  }
  if (ts.isNewExpression(e)) return e.arguments?.map(x => ressourceDe(x, ctx)).find(Boolean)
  if (ts.isBinaryExpression(e) && AFFECTATIONS.has(e.operatorToken.kind)) return ressourceDe(e.right, ctx)
  if (ts.isBinaryExpression(e) && BRANCHES.has(e.operatorToken.kind)) {
    const a = ressourceDe(e.left, ctx), b = ressourceDe(e.right, ctx)
    return a && b && a !== b ? 'mixte' : a || b
  }
  return undefined
}

function operationsDirectes(fn) {
  if (!estFonction(fn)) return []
  const out = []
  const visiter = st => {
    if (ts.isExpressionStatement(st)) { out.push(sansEnveloppe(st.expression)); return true }
    if (ts.isTryStatement(st)) {
      let suite = true
      for (const s of st.tryBlock.statements) if (!visiter(s)) { suite = false; break }
      if (st.finallyBlock) for (const s of st.finallyBlock.statements) if (!visiter(s)) { suite = false; break }
      return suite
    }
    if (ts.isVariableStatement(st) || ts.isEmptyStatement(st)) return true
    return false
  }
  if (!ts.isBlock(fn.body)) out.push(sansEnveloppe(fn.body))
  else for (const st of fn.body.statements) { if (!visiter(st)) break }
  return out
}
const fermeturesDirectes = fn => operationsDirectes(fn).filter(ts.isCallExpression)

/** La fonction rend-elle une valeur teinte (corps d'expression, ou un `return` qui lui est propre) ? */
function rendTeinte(fn, ctx) {
  if (!fn.body) return false
  if (!ts.isBlock(fn.body)) return teinte(fn.body, ctx)
  let vu = false
  const v = (n) => {
    if (vu || ts.isFunctionLikeDeclaration(n)) return
    if (ts.isReturnStatement(n) && n.expression && teinte(n.expression, ctx)) vu = true
    else n.forEachChild(v)
  }
  fn.body.forEachChild(v)
  return vu
}

function teinte(e, ctx) {
  e = sansEnveloppe(e)
  if (!e) return false
  if (ts.isCallExpression(e)) {
    const nom = nomAppele(e)
    if (ctx.fabriques.has(nom) || ressourceDe(e, ctx)) return true
    const appele = sansEnveloppe(e.expression)
    if (estDetention(e, ctx)) return false
    if (e.arguments.some((a) => argumentTeignant(a, ctx))) return true
    if (estFonction(appele)) return rendTeinte(appele, ctx)
    if (ts.isPropertyAccessExpression(appele))
      return (DERIVATIONS.has(appele.name.text) && corpusDe(appele.expression, ctx)) || teinte(appele.expression, ctx)
    return false
  }
  if (ts.isPropertyAccessExpression(e) || ts.isElementAccessExpression(e)) return teinte(e.expression, ctx)
  if (ts.isNewExpression(e)) return !!ressourceDe(e, ctx) || ctx.fabriques.has(nomAppele(e)) || (e.arguments ?? []).some((a) => teinte(a, ctx))
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
    n.forEachChild(v)
  }
  sf.forEachChild(v)
}

const porteeDe = (n) => {
  for (let p = n.parent; p; p = p.parent) if (ts.isFunctionLikeDeclaration(p) || ts.isSourceFile(p)) return p
  return undefined
}

/** Contexte d'un fichier : fabriques et sources de corpus VISIBLES, et ses portées (fonction ou
 *  module) — noms DÉCLARÉS, noms TEINTS, noms de CORPUS, par point fixe sur les déclarations et les
 *  affectations de noms nus. `resoudre(id)` rend la portée qui déclare le nom (`undefined` : global). */
function contexteDu(sf, fabriques, corpus, detentions, exportees) {
  const declares = new Map()
  const teints = new Map()
  const deCorpus = new Map()
  const ressources = new Map()
  const conteneurs = new Map()
  const fonctions = new Map()
  const importees = new Map()
  for (const st of sf.statements) {
    const liens = ts.isImportDeclaration(st) && st.importClause?.namedBindings
    if (!liens || !ts.isNamedImports(liens) || !ts.isStringLiteral(st.moduleSpecifier)) continue
    const module = posix.relative(resolve('.').replaceAll('\\', '/'), posix.resolve(posix.dirname(sf.fileName), st.moduleSpecifier.text))
    for (const el of liens.elements) {
      const nom = (el.propertyName ?? el.name).text
      for (const chemin of [module, `${module}.mjs`, `${module}.ts`, `${module}.mts`, `${module}.tsx`]) {
        const qualite = exportees?.ressources?.get(cleRessource(chemin, nom))
        if (qualite) importees.set(el.name.text, qualite)
      }
    }
  }
  const ajouterFonction = (n, nom, fn) => {
    const p = porteeDe(n)
    if (!fonctions.has(p)) fonctions.set(p, new Map())
    fonctions.get(p).set(nom, fn)
  }
  const ajouter = (m, portee, nom) => {
    let s = m.get(portee)
    if (!s) m.set(portee, (s = new Set()))
    if (s.has(nom)) return false
    s.add(nom)
    return true
  }
  marcher(sf, (n) => {
    if (ts.isFunctionDeclaration(n) && n.name) ajouterFonction(n, n.name.text, n)
    if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.initializer) ajouterFonction(n, n.name.text, n.initializer)
    if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name)) ajouter(declares, porteeDe(n), n.name.text)
    else if (ts.isParameterDeclaration(n) && ts.isIdentifier(n.name)) ajouter(declares, n.parent, n.name.text)
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
    ressource: id => ressources.get(resoudre(id))?.get(id.text),
    conteneur: id => !!conteneurs.get(resoudre(id))?.has(id.text),
  }
  const ctx = { sf, fabriques, corpus, detentions, portees, exportees, fonctions, importees, enCours: new Set() }
  for (let change = true; change; ) {
    change = false
    marcher(sf, (n) => {
      let id
      let valeur
      if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.initializer) [id, valeur] = [n.name, n.initializer]
      else if (ts.isBinaryExpression(n) && AFFECTATIONS.has(n.operatorToken.kind) && ts.isIdentifier(n.left)) [id, valeur] = [n.left, n.right]
      const portee = id && resoudre(id)
      if (!portee) return
      const qualite = ressourceDe(valeur, ctx)
      if (qualite) {
        if (!ressources.has(portee)) ressources.set(portee, new Map())
        if (!ressources.get(portee).has(id.text)) { ressources.get(portee).set(id.text, qualite); change = true }
        const v = sansEnveloppe(valeur)
        if (ts.isArrayLiteralExpression(v) || (ts.isNewExpression(v) && !origineImportee(v.expression, sf))) ajouter(conteneurs, portee, id.text)
      }
      if (teinte(valeur, ctx)) change = ajouter(teints, portee, id.text) || change
      else if (corpusDe(valeur, ctx)) change = ajouter(deCorpus, portee, id.text) || change
    })
    marcher(sf, n => {
      if (!ts.isCallExpression(n) || !ts.isPropertyAccessExpression(n.expression) || !REMPLISSAGES.has(n.expression.name.text)) return
      const id = racineDe(n.expression.expression)
      const qualite = n.arguments.map(a => ressourceDe(a, ctx)).find(Boolean)
      const portee = id && resoudre(id)
      if (!qualite || !portee) return
      ajouter(conteneurs, portee, id.text)
      if (!ressources.has(portee)) ressources.set(portee, new Map())
      if (!ressources.get(portee).has(id.text)) { ressources.get(portee).set(id.text, qualite); change = true }
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
    if (ts.isFunctionLikeDeclaration(n) && n.body) {
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
  (n.modifiers ?? []).some((m) => m.kind === ts.SyntaxKind.ExportKeyword)

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
    if (cible !== resolve(PRIMITIVE_DE_DETENTION.module).replaceAll('\\', '/')) continue
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
      if (fabriques.has(importe) || exportees.fabriques.has(importe)) fabriques.add(el.name.text)
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
  'API',
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
  const exportees = { fabriques: new Set(), corpus: new Set(), ressources: new Map() }
  const asts = new Map(Array.from(analyserCorpus(fichiers), ({ fichier, sourceFile }) => [fichier.rel, sourceFile]))
  const taille = () => exportees.fabriques.size + exportees.corpus.size + exportees.ressources.size
  for (let avant = -1; avant !== taille(); ) {
    avant = taille()
    for (const { rel, text } of fichiers) {
      if (!mentionne(text, termesDe(exportees))) continue
      const sf = asts.get(rel)
      const vus = visiblesDansLeFichier(sf, exportees)
      const ctx = contexteDu(sf, vus.fabriques, vus.corpus, detentionsDe(sf), exportees)
      for (const [nom, qualite] of exportes(sf, ctx)) if (qualite) exportees[qualite].add(nom)
      for (const st of sf.statements) if (estExporte(st) && ts.isFunctionDeclaration(st) && st.name) {
        const qualite = ressourceRendue(st, ctx)
        if (qualite) exportees.ressources.set(cleRessource(rel, st.name.text), qualite)
      }
      for (const st of sf.statements) if (estExporte(st) && ts.isVariableStatement(st)) for (const d of st.declarationList.declarations) {
        if (!ts.isIdentifier(d.name) || !estFonction(d.initializer)) continue
        const qualite = ressourceRendue(d.initializer, ctx)
        if (qualite) exportees.ressources.set(cleRessource(rel, d.name.text), qualite)
      }
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
        x.forEachChild(v)
      }
      v(arg)
    }
  })
  return out
}

const estStatique = (n) =>
  (n.modifiers ?? []).some((m) => m.kind === ts.SyntaxKind.StaticKeyword)

/**
 * Rétentions d'analyse d'un fichier.
 * @param {string} rel chemin POSIX depuis la racine
 * @param {string} texte
 * @param {{ fabriques: Set<string>, corpus: Set<string> }} [exportees] `fabriquesDuCorpus` du corpus scanné
 * @returns {{ rel: string, line: number, liaison: string, forme: string }[]}
 */
export function retentionsDAnalyse(rel, texte, exportees = { fabriques: new Set(), corpus: new Set() }, sourceFile) {
  if (!mentionne(texte, termesDe(exportees))) return []
  const sf = sourceFile ?? sourceDe(rel, texte)
  const { fabriques, corpus } = visiblesDansLeFichier(sf, exportees)
  const ctx = contexteDu(sf, fabriques, corpus, detentionsDe(sf), exportees)
  const { portees } = ctx
  const libres = liberees(sf, portees)
  const fermees = new Map()
  const videes = new Map()
  const hooks = new Set()
  for (const st of sf.statements) {
    if (!ts.isImportDeclaration(st) || st.moduleSpecifier.text !== 'vitest' || !ts.isNamedImports(st.importClause?.namedBindings ?? sf)) continue
    for (const el of st.importClause.namedBindings.elements) if (LIBERATIONS.has((el.propertyName ?? el.name).text)) hooks.add(el.name.text)
  }
  marcher(sf, n => {
    if (!ts.isCallExpression(n) || !ts.isIdentifier(n.expression) || !hooks.has(n.expression.text) || portees.resoudre(n.expression)) return
    for (const fn of n.arguments) for (const appel of operationsDirectes(fn)) {
      if (ts.isBinaryExpression(appel) && appel.operatorToken.kind === ts.SyntaxKind.EqualsToken && ts.isPropertyAccessExpression(appel.left)
        && appel.left.name.text === 'length' && ts.isIdentifier(appel.left.expression) && ts.isNumericLiteral(appel.right) && appel.right.text === '0') {
        const id = appel.left.expression
        const p = portees.resoudre(id)
        if (portees.conteneur(id)) {
          if (!videes.has(p)) videes.set(p, new Set())
          videes.get(p).add(id.text)
        }
      }
      if (!ts.isCallExpression(appel)) continue
      const e = appel.expression
      let id, methode
      if (ts.isPropertyAccessExpression(e) && ts.isIdentifier(e.expression)) {
        id = e.expression; methode = e.name.text
        if (methode === 'clear' && portees.conteneur(id)) {
          const p = portees.resoudre(id)
          if (!videes.has(p)) videes.set(p, new Set())
          videes.get(p).add(id.text)
        }
        if (portees.conteneur(id)) continue
      }
      else {
        const origine = origineImportee(e, sf)
        if (origine?.module === moduleProgramme && origine.nom === 'libererSessions') {
          const arg = appel.arguments[0]
          id = arg && racineDe(ts.isCallExpression(arg) && ts.isPropertyAccessExpression(arg.expression) && arg.expression.name.text === 'values' ? arg.expression.expression : arg)
          methode = 'dispose'
        }
      }
      if (!id || methode === 'mixte' || portees.ressource(id) !== methode) continue
      const p = portees.resoudre(id)
      if (!fermees.has(p)) fermees.set(p, new Set())
      fermees.get(p).add(id.text)
    }
  })
  const out = []
  const poser = (n, liaison, forme) =>
    out.push({ rel, line: sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1, liaison, forme })
  /** L'identifiant désigne-t-il une liaison de COLLECTION non libérée ? */
  const retenue = (id) => {
    const p = portees.resoudre(id)
    const ferme = fermees.get(p)?.has(id.text) && (!portees.conteneur(id) || videes.get(p)?.has(id.text))
    return estCollection(p) && !(portees.ressource(id) ? ferme : libres.get(p)?.has(id.text))
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
    if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.initializer && estCollection(porteeDe(n)) && teinte(n.initializer, ctx) && !(portees.ressource(n.name) && !retenue(n.name)))
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
