// RACINES BALAYÉES d'un dépôt (#2400) : les fichiers et dossiers que LISENT ses modules, par évaluation
// INTERPROCÉDURALE des appels.
//   · Cas de base, les LECTURES : les primitives du système de fichiers (`PRIMITIVES`) et les portes git
//     qui listent ou lisent une image (`PORTES_GIT`). Un fichier lu est une racine exacte, un dossier
//     listé une racine sélectionnée par ancêtre.
//   · RELAIS : une fonction de premier niveau dont un PARAMÈTRE alimente la racine d'une lecture. Chacun
//     de ses sites d'appel, dans n'importe quel module, est évalué avec ses arguments (`lecturesDe`).
//   · VALEUR DE RETOUR : l'appel d'une fonction du dépôt s'évalue sur ses `return`, paramètres liés ; un
//     objet rendu s'évalue champ par champ (déstructuration, accès de propriété, défaut d'un champ
//     absent) ; `map`/`flatMap` rendent les valeurs de leur rappel (`PROJECTIONS`) ; une boucle `for…of`,
//     déstructurée ou non, parcourt les valeurs de son tableau ; le champ absent d'un objet étalé se lit
//     dans ses étalements, l'argument absent prend le défaut de son paramètre.
//   · Une liaison RÉAFFECTÉE vaut sa valeur initiale et le membre droit de chaque `=` (`??=`, `||=`, `&&=`)
//     qui la vise ; une réaffectation illisible rend `<nom> réaffectée`, un membre droit qui revient à la
//     liaison `<nom> réaffectée en récurrence`.
// L'arbre syntaxique se lit une fois par module (`lectureDeModule`, sérialisable, mémoïsable) ;
// l'évaluation attend la résolution des imports (`evaluateurDuDepot`), et `tracer` rend les REQUÊTES dont
// elle dépend (`requeteDe`). Ce qui ne se lit pas ainsi n'est pas deviné : il rend `{ non: raison }`, et
// son site sort au rapport de l'appelant.
import { posix } from 'node:path'
import { typescript } from './dialecte.mjs'

/** Les primitives de LECTURE et de LISTAGE du système de fichiers : l'argument 0 est la racine. Une
 *  sonde d'absence (`existsSync`, `statSync`) est une lecture : un fichier qui apparaît change son verdict. */
const PRIMITIVES = Object.freeze(['readFileSync', 'readFile', 'readdirSync', 'readdir', 'opendirSync', 'existsSync', 'statSync', 'globSync', 'glob'])
const GLOBS = new Set(['globSync', 'glob'])

/** Les portes de `gitPorte.mjs` qui passent leurs pathspecs à git, seul listeur d'image : le processus
 *  enfant est opaque à l'arbre syntaxique, la porte DÉCLARE donc ce qu'elle lit (`depot` : index du
 *  dépôt ; `depuis` : premier chemin, `reste` ou un tableau en `argument`). */
const PORTES_GIT = Object.freeze({
  listerImage: Object.freeze({ depot: 0, depuis: 2, chemins: 'reste' }),
  lireEnLot: Object.freeze({ depot: 0, depuis: 2, chemins: 'argument' }),
})

/** Préfiltre textuel : un module sans appel nommé d'une lecture n'a aucun site de base. */
export const APPEL_DE_LECTURE = new RegExp(`\\b(?:${[...PRIMITIVES, ...Object.keys(PORTES_GIT)].join('|')})\\s*\\(`)

const CHEMINS = new Set(['join', 'resolve'])
/** Les receveurs d'un `join`/`resolve` de chemin : le module `node:path` et ses variantes. */
const MODULES_DE_CHEMIN = new Set(['path', 'posix', 'win32'])
const ITERATEURS = new Set(['map', 'flatMap', 'forEach', 'filter', 'some', 'every', 'find'])
/** Ce qui rend une PARTIE de son receveur : la valeur du receveur la couvre. */
const SOUS_ENSEMBLES = new Set(['filter', 'sort', 'toSorted', 'slice', 'find'])
/** Ce qui rend les valeurs rendues par son rappel, élément du receveur lié à son premier paramètre. */
const PROJECTIONS = new Set(['map', 'flatMap'])
const PROFONDEUR = 24
/** La profondeur d'appels imbriqués d'une évaluation ; au-delà, `non` nommé. */
const PROFONDEUR_D_APPELS = 16
/** Les ré-entrées d'une fonction déjà en cours, à d'autres arguments (`sousPile`) : une enveloppe qui se rappelle
 *  sans son option (`fraicheur-docs.mjs`, `cheminSous`) s'évalue ; une récursion qui creuse est un cycle nommé. */
const REENTREES = 1
/** Les raisons d'une lecture COUPÉE par les bornes de `sousPile` : sans elles, la lecture aurait pu continuer. */
const COUPE = /^(cycle|profondeur) d'appels/
/** Les passes d'un appel récursif aux mêmes arguments vers son point fixe (`sousPile`) ; au-delà, `non` nommé. */
const ITERATIONS = 8

/**
 * Le LECTEUR d'expressions de chemin d'un module : `expr(noeud)` rend son `Expr`, constantes locales et
 * importées comprises (`lier`), paramètres des fonctions de premier niveau (`fonctions`) compris.
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
  /** Le texte source de `n`, ses blancs (retours à la ligne compris) repliés en une espace : une raison tient sur une ligne. */
  const texteDe = (n) => n.getText(arbre).replace(/\s+/g, ' ')
  const estFonction = (n) => ts.isArrowFunction(n) || ts.isFunctionExpression(n) || ts.isFunctionDeclaration(n) || ts.isMethodDeclaration(n)
  const ligneDe = (n) => arbre.getLineAndCharacterOfPosition(n.getStart(arbre)).line + 1
  /** Les expressions RENDUES par la fonction `n` : son corps d'expression, ou ses `return` hors fonctions imbriquées. */
  const retoursDe = (n) => {
    if (!n.body) return []
    if (!ts.isBlock(n.body)) return [n.body]
    const retours = []
    const visiter = (x) => {
      if (estFonction(x)) return
      if (ts.isReturnStatement(x) && x.expression) retours.push(x.expression)
      x.forEachChild(visiter)
    }
    n.body.forEachChild(visiter)
    return retours
  }

  /** Le chemin de champs qui mène à `texte` dans un motif de liaison : `null` s'il n'y est pas, `false`
   *  s'il passe par un tableau ou un reste. */
  const champsVers = (nom, texte) => {
    if (!nom) return null
    if (ts.isIdentifier(nom)) return nom.text === texte ? [] : null
    if (ts.isArrayBindingPattern(nom)) return nom.elements.some((e) => ts.isBindingElement(e) && champsVers(e.name, texte) !== null) ? false : null
    for (const e of nom.elements) {
      const sous = champsVers(e.name, texte)
      if (sous === null) continue
      if (sous === false || e.dotDotDotToken) return false
      const cle = e.propertyName ?? e.name
      if (!ts.isIdentifier(cle) && !ts.isStringLiteralLikeNode(cle)) return false
      return [cle.text, ...sous]
    }
    return null
  }
  const lie = (nom, texte) => champsVers(nom, texte) !== null
  /** La valeur par défaut de l'élément de liaison qui lie `texte` dans le motif `nom`, ou `undefined`. */
  const defautVers = (nom, texte) => {
    if (!nom || ts.isIdentifier(nom)) return undefined
    for (const e of nom.elements) {
      if (!ts.isBindingElement(e)) continue
      if (ts.isIdentifier(e.name) && e.name.text === texte) return e.initializer
      const sous = defautVers(e.name, texte)
      if (sous) return sous
    }
    return undefined
  }
  const parChamps = (base, champs, texte, motif, profondeur = 0) => {
    if (champs === false) return non(`déstructuration de tableau ${texte}`)
    const defaut = motif && defautVers(motif, texte)
    return champs.reduce((de, nom, i) => ({ k: 'champ', de, nom, texte,
      ...(defaut && i === champs.length - 1 ? { defaut: expr(defaut, profondeur) } : {}) }), base)
  }

  /** Les fonctions de PREMIER NIVEAU : déclarations et `const f = () => …` du module. */
  const idDe = new Map()
  for (const s of arbre.statements) {
    if (ts.isFunctionDeclaration(s) && s.name) idDe.set(s, s.name.text)
    if (ts.isVariableStatement(s))
      for (const d of s.declarationList.declarations) {
        let init = d.initializer
        while (init && (ts.isParenthesizedExpression(init) || ts.isAsExpression(init) || ts.isSatisfiesExpression(init))) init = init.expression
        if (init && ts.isIdentifier(d.name) && (ts.isArrowFunction(init) || ts.isFunctionExpression(init))) idDe.set(init, d.name.text)
      }
  }

  /** Les noms qu'un motif de liaison lie. */
  const nomsLies = (nom, vus = []) => {
    if (!nom) return vus
    if (ts.isIdentifier(nom)) vus.push(nom.text)
    else for (const e of nom.elements) if (ts.isBindingElement(e)) nomsLies(e.name, vus)
    return vus
  }
  /** Les noms liés par chaque paramètre d'une fonction, une fois par fonction. */
  const parametres = new Map()
  const parametresDe = (n) => parametres.get(n) ?? parametres.set(n, n.parameters.map((p) => new Set(nomsLies(p.name)))).get(n)
  /** Les DÉCLARATIONS d'un bloc d'instructions, nom → première déclaration, une fois par bloc. */
  const blocs = new Map()
  const declarationsDuBloc = (instructions) => {
    if (blocs.has(instructions)) return blocs.get(instructions)
    const index = new Map()
    const poser = (nom, decl) => { if (!index.has(nom)) index.set(nom, decl) }
    for (const s of instructions) {
      if (ts.isFunctionDeclaration(s) && s.name) poser(s.name.text, { fonction: s })
      if (ts.isVariableStatement(s))
        for (const d of s.declarationList.declarations) for (const nom of nomsLies(d.name)) poser(nom, { variable: d })
      if (ts.isImportDeclaration(s) && ts.isStringLiteralLikeNode(s.moduleSpecifier) && s.importClause) {
        const liaisons = s.importClause.namedBindings
        if (liaisons && ts.isNamedImports(liaisons))
          for (const e of liaisons.elements) poser(e.name.text, { importe: s.moduleSpecifier.text, nom: (e.propertyName ?? e.name).text })
        if (s.importClause.name) poser(s.importClause.name.text, { horsNom: true })
        if (liaisons && ts.isNamespaceImport(liaisons)) poser(liaisons.name.text, { horsNom: true })
      }
    }
    blocs.set(instructions, index)
    return index
  }

  /** Le nœud qui LIE l'identifiant `id` : la fonction dont il est paramètre (`parametre`), la boucle qui le
   *  déclare (`boucle`), ou la liste d'instructions qui le déclare (`decl`) ; `null` s'il est introuvable. */
  const liaisonDe = (id) => {
    const texte = id.text
    for (let n = parents.get(id), enfant = id; n; enfant = n, n = parents.get(n)) {
      if (estFonction(n) && parametresDe(n).some((noms) => noms.has(texte))) return { n, parametre: true }
      if ((ts.isForOfStatement(n) || ts.isForInStatement(n)) && enfant !== n.initializer && ts.isVariableDeclarationList(n.initializer) &&
        n.initializer.declarations.some((d) => lie(d.name, texte))) return { n, boucle: true }
      const instructions = ts.isSourceFile(n) || ts.isBlock(n) || ts.isModuleBlock(n) || ts.isCaseClause(n) || ts.isDefaultClause(n) ? n.statements : null
      const decl = instructions && declarationsDuBloc(instructions).get(texte)
      if (decl) return { n, decl }
    }
    return null
  }

  /** Les AFFECTATIONS de chaque nœud liant (`liaisonDe`), nom par nom : `droits`, les membres droits qui se lisent
   *  (`=`, `??=`, `||=`, `&&=` : la valeur devient l'ancienne ou le membre droit) ; `opaque`, une cible qui ne se
   *  lit pas (affectation arithmétique, `++`/`--`, motif d'affectation, boucle `for…of`/`for…in` sans
   *  déclaration). Calculées une fois par module. */
  let affectations = null
  const LISIBLES = new Set([ts.SyntaxKind.EqualsToken, ts.SyntaxKind.QuestionQuestionEqualsToken, ts.SyntaxKind.BarBarEqualsToken, ts.SyntaxKind.AmpersandAmpersandEqualsToken])
  const affectationsDe = () => {
    if (affectations) return affectations
    affectations = new Map()
    const poser = (cible, droit) => {
      if (!cible) return
      if (ts.isParenthesizedExpression(cible) || ts.isSpreadElement(cible) || ts.isSpreadAssignment(cible)) return poser(cible.expression, null)
      if (ts.isIdentifier(cible)) {
        const liaison = liaisonDe(cible)
        if (!liaison) return
        const noms = affectations.get(liaison.n) ?? affectations.set(liaison.n, new Map()).get(liaison.n)
        const fiche = noms.get(cible.text) ?? noms.set(cible.text, { droits: [], opaque: false }).get(cible.text)
        if (droit) fiche.droits.push(droit)
        else fiche.opaque = true
        return
      }
      if (ts.isArrayLiteralExpression(cible)) for (const e of cible.elements) poser(e, null)
      if (ts.isObjectLiteralExpression(cible))
        for (const p of cible.properties) poser(ts.isShorthandPropertyAssignment(p) ? p.name : ts.isPropertyAssignment(p) ? p.initializer : p, null)
    }
    const visiter = (x) => {
      if (ts.isBinaryExpression(x) && x.operatorToken.kind >= ts.SyntaxKind.FirstAssignment && x.operatorToken.kind <= ts.SyntaxKind.LastAssignment)
        poser(x.left, LISIBLES.has(x.operatorToken.kind) && ts.isIdentifier(x.left) ? x.right : null)
      if ((ts.isPrefixUnaryExpression(x) || ts.isPostfixUnaryExpression(x)) &&
        (x.operator === ts.SyntaxKind.PlusPlusToken || x.operator === ts.SyntaxKind.MinusMinusToken)) poser(x.operand, null)
      if ((ts.isForOfStatement(x) || ts.isForInStatement(x)) && !ts.isVariableDeclarationList(x.initializer)) poser(x.initializer, null)
      x.forEachChild(visiter)
    }
    visiter(arbre)
    return affectations
  }

  /** La valeur de l'identifiant `id`, lié par `liaison` (`liaisonDe`), à sa liaison seule. */
  const valeurDeLiaison = (id, { n, parametre, boucle, decl }, profondeur) => {
    const texte = id.text
    if (parametre) {
      const index = parametresDe(n).findIndex((noms) => noms.has(texte))
      const appel = parents.get(n)
      if (appel && ts.isCallExpression(appel) && appel.arguments[0] === n && ts.isPropertyAccessExpression(appel.expression) &&
        ITERATEURS.has(appel.expression.name.text) && index === 0)
        return parChamps(expr(appel.expression.expression, profondeur), champsVers(n.parameters[0].name, texte), texte, n.parameters[0].name, profondeur)
      if (!idDe.has(n)) return non(`paramètre ${texte}`)
      const motif = n.parameters[index].name
      return parChamps({ k: 'param', fn: idDe.get(n), index, nom: texte }, champsVers(motif, texte), texte, motif, profondeur)
    }
    if (boucle) {
      const [d] = n.initializer.declarations
      return ts.isForOfStatement(n) ? parChamps(expr(n.expression, profondeur), champsVers(d.name, texte), texte, d.name, profondeur)
        : non(`variable de boucle ${texte}`)
    }
    if (decl.fonction) return idDe.has(decl.fonction) ? { k: 'fn', id: texte } : non(`fonction locale ${texte}`)
    if (decl.variable) {
      const d = decl.variable
      return !d.initializer ? non(`${texte} sans valeur initiale`)
        : parChamps(expr(d.initializer, profondeur), champsVers(d.name, texte), texte, d.name, profondeur)
    }
    if (decl.importe) return { k: 'importe', spec: decl.importe, nom: decl.nom }
    return non(`import par défaut ou espace ${texte}`)
  }

  /** Les liaisons réaffectées dont la lecture est EN COURS : un membre droit qui y revient est une récurrence. */
  const enLecture = []
  /** La valeur de l'identifiant `id` : celle de sa liaison et, s'il est RÉAFFECTÉ (`affectationsDe`), celle de
   *  chaque membre droit qui le vise ; ce qui ne se lit pas rend `<nom> réaffectée`, le membre droit qui
   *  dépend de la liaison elle-même `<nom> réaffectée en récurrence`. */
  const lier = (id, profondeur) => {
    if (id.text === '__dirname') return { k: 'chemin', v: dossier }
    const liaison = liaisonDe(id)
    if (!liaison) return non(`${id.text} introuvable`)
    const fiche = affectationsDe().get(liaison.n)?.get(id.text)
    if (!fiche) return valeurDeLiaison(id, liaison, profondeur)
    if (enLecture.some(([n, texte]) => n === liaison.n && texte === id.text)) return non(`${id.text} réaffectée en récurrence`)
    enLecture.push([liaison.n, id.text])
    try {
      const sansInitiale = liaison.decl?.variable && !liaison.decl.variable.initializer && fiche.droits.length
      return { k: 'union', v: [
        ...(sansInitiale ? [] : [valeurDeLiaison(id, liaison, profondeur)]),
        ...fiche.droits.map((droit) => expr(droit, profondeur)),
        ...(fiche.opaque ? [non(`${id.text} réaffectée`)] : []),
      ] }
    } finally { enLecture.pop() }
  }

  /** Les fonctions anonymes lues (`expr`), une fois par nœud ; `null` pendant leur lecture : une fonction qui se
   *  nomme elle-même dans ses retours est récursive. */
  const lambdas = new Map()
  const expr = (n, profondeur = 0) => {
    if (profondeur > PROFONDEUR) return non('expression trop profonde')
    const p = profondeur + 1
    if (ts.isStringLiteralLikeNode(n)) return { k: 'lit', v: n.text }
    if (ts.isParenthesizedExpression(n) || ts.isAsExpression(n) || ts.isSatisfiesExpression(n) || ts.isNonNullExpression(n) || ts.isSpreadElement(n))
      return expr(n.expression, p)
    if (ts.isArrayLiteralExpression(n)) return { k: 'liste', v: n.elements.map((e) => expr(e, p)) }
    if (ts.isIdentifier(n)) return lier(n, p)
    if (idDe.has(n)) return { k: 'fn', id: idDe.get(n) }
    if (ts.isArrowFunction(n) || ts.isFunctionExpression(n)) {
      if (lambdas.has(n)) return lambdas.get(n) ?? non('fonction anonyme récursive')
      lambdas.set(n, null)
      const lue = { k: 'lambda', retours: retoursDe(n).map((x) => expr(x, p)) }
      lambdas.set(n, lue)
      return lue
    }
    if (ts.isTemplateExpression(n))
      return { k: 'concat', v: [{ k: 'lit', v: n.head.text }, ...n.templateSpans.flatMap((s) => [expr(s.expression, p), { k: 'lit', v: s.literal.text }])] }
    if (ts.isConditionalExpression(n)) return { k: 'union', v: [expr(n.whenTrue, p), expr(n.whenFalse, p)] }
    if (ts.isBinaryExpression(n)) {
      const op = n.operatorToken.kind
      if (op === ts.SyntaxKind.BarBarToken || op === ts.SyntaxKind.QuestionQuestionToken) return { k: 'union', v: [expr(n.left, p), expr(n.right, p)] }
      if (op === ts.SyntaxKind.PlusToken) return { k: 'concat', v: [expr(n.left, p), expr(n.right, p)] }
      return non(`forme ${ts.SyntaxKind[n.kind]}`)
    }
    if (ts.isObjectLiteralExpression(n)) {
      const v = {}
      const etales = []
      for (const prop of n.properties) {
        if (ts.isPropertyAssignment(prop) && (ts.isIdentifier(prop.name) || ts.isStringLiteralLikeNode(prop.name))) v[prop.name.text] = expr(prop.initializer, p)
        else if (ts.isShorthandPropertyAssignment(prop)) v[prop.name.text] = lier(prop.name, p)
        else if (ts.isSpreadAssignment(prop)) etales.push(expr(prop.expression, p))
        else if (ts.isPropertyAssignment(prop)) etales.push(non(`propriété calculée ${texteDe(prop.name)}`))
      }
      return { k: 'objet', v, ...(etales.length ? { etales } : {}) }
    }
    if (ts.isPropertyAccessExpression(n)) {
      if (estImportMeta(n.expression) && n.name.text === 'dirname') return { k: 'chemin', v: dossier }
      if (estImportMeta(n.expression) && (n.name.text === 'url' || n.name.text === 'filename')) return { k: 'chemin', v: rel }
      if (n.name.text === 'pathname') return expr(n.expression, p)
      return { k: 'champ', de: expr(n.expression, p), nom: n.name.text, texte: texteDe(n) }
    }
    if (ts.isNewExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === 'URL') {
      const [cible, depuis] = n.arguments ?? []
      if (cible && ts.isStringLiteralLikeNode(cible) && depuis && ts.isPropertyAccessExpression(depuis) && estImportMeta(depuis.expression) && depuis.name.text === 'url')
        return { k: 'chemin', v: posix.join(dossier, cible.text) }
      return non(`URL ${texteDe(n)}`)
    }
    if (ts.isCallExpression(n)) {
      const nom = nomAppele(n)
      const args = [...n.arguments]
      const receveur = ts.isPropertyAccessExpression(n.expression) ? n.expression.expression : null
      if (CHEMINS.has(nom) && (!receveur || (ts.isIdentifier(receveur) && MODULES_DE_CHEMIN.has(receveur.text)) ||
        (ts.isPropertyAccessExpression(receveur) && MODULES_DE_CHEMIN.has(receveur.name.text))))
        return { k: 'join', v: args.map((a) => expr(a, p)) }
      if (nom === 'join' && receveur && ts.isCallExpression(receveur) && nomAppele(receveur) === 'split' && ts.isPropertyAccessExpression(receveur.expression))
        return expr(receveur.expression.expression, p)
      if (nom === 'dirname' && args[0]) return { k: 'dir', v: expr(args[0], p) }
      if (nom === 'cwd' && ts.isPropertyAccessExpression(n.expression) && texteDe(n.expression.expression) === 'process') return { k: 'chemin', v: '' }
      if (nom === 'tmpdir' || nom === 'mkdtempSync') return { k: 'hors' }
      if (['fileURLToPath', 'depotDe', 'depotReel', 'freeze'].includes(nom) && args[0]) return expr(args[0], p)
      if ((nom === 'replace' || nom === 'replaceAll') && ts.isPropertyAccessExpression(n.expression)) return expr(n.expression.expression, p)
      if (SOUS_ENSEMBLES.has(nom) && ts.isPropertyAccessExpression(n.expression)) return expr(n.expression.expression, p)
      const rendus = PROJECTIONS.has(nom) && args[0] && (ts.isArrowFunction(args[0]) || ts.isFunctionExpression(args[0])) ? retoursDe(args[0]) : []
      if (rendus.length && ts.isPropertyAccessExpression(n.expression)) return { k: 'union', v: rendus.map((r) => expr(r, p)) }
      if (ITERATEURS.has(nom) && ts.isPropertyAccessExpression(n.expression))
        return { k: 'transforme', raison: `appel ${texteDe(n.expression)}`, v: expr(n.expression.expression, p) }
      if (ts.isIdentifier(n.expression)) return { k: 'appel', cible: lier(n.expression, p), args: args.map((a) => expr(a, p)), texte: texteDe(n.expression) }
      return non(`appel ${texteDe(n.expression)}`)
    }
    return non(`forme ${ts.SyntaxKind[n.kind]}`)
  }

  /** Paramètres (reste, défaut) et expressions rendues de chaque fonction de premier niveau. */
  const fonctions = {}
  for (const [n, id] of idDe)
    fonctions[id] = {
      params: n.parameters.map((prm) => ({ reste: !!prm.dotDotDotToken, ...(prm.initializer ? { defaut: expr(prm.initializer) } : {}) })),
      retours: retoursDe(n).map((r) => expr(r)),
    }

  /** La fonction de premier niveau qui contient `n`, ou `null`. */
  const dansDe = (n) => {
    for (let x = parents.get(n); x; x = parents.get(x)) if (idDe.has(x)) return idDe.get(x)
    return null
  }

  return { expr, lier, nomAppele, fonctions, dansDe, ligneDe }
}

/**
 * Sites d'appel, fonctions de premier niveau et exports d'un module, en expressions sérialisables
 * (`Expr`) : la mémoïsation par texte reste possible, l'évaluation attend la résolution des imports.
 * Un site est une LECTURE (`lecture` : primitive ou porte git) ou l'appel d'une fonction nommée du
 * dépôt (`cible`), qui peut être un relais.
 * @param {string} rel chemin POSIX du module, relatif au dépôt
 * @param {import('typescript/unstable/ast').SourceFile} arbre
 */
export function lectureDeModule(rel, arbre) {
  const ts = typescript()
  const { expr, lier, nomAppele, fonctions, dansDe, ligneDe } = lecteurDExpressions(rel, arbre)
  const sites = []
  const visiter = (n) => {
    if (ts.isCallExpression(n)) {
      const nom = nomAppele(n)
      const lecture = PRIMITIVES.includes(nom) || Object.hasOwn(PORTES_GIT, nom)
      const cible = !lecture && ts.isIdentifier(n.expression) ? lier(n.expression, 0) : null
      if (lecture || (cible && (cible.k === 'fn' || (cible.k === 'importe' && !cible.spec.startsWith('node:')))))
        sites.push({ appel: nom, ligne: ligneDe(n), dans: dansDe(n), args: [...n.arguments].map((a) => expr(a)), ...(lecture ? { lecture: nom } : { cible }) })
    }
    n.forEachChild(visiter)
  }
  visiter(arbre)

  const exports = {}
  const etoiles = []
  for (const s of arbre.statements) {
    const exporte = s.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)
    if (exporte && ts.isFunctionDeclaration(s) && s.name) exports[s.name.text] = { k: 'fn', id: s.name.text }
    if (exporte && ts.isVariableStatement(s))
      for (const d of s.declarationList.declarations)
        if (ts.isIdentifier(d.name)) exports[d.name.text] = d.initializer ? expr(d.initializer) : { k: 'non', raison: `${d.name.text} sans valeur initiale` }
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
  return { sites, fonctions, exports, etoiles }
}

/** @typedef {Record<string, unknown> & { k: string }} Expr */
/** @typedef {{ chemin: string, sous?: string } | { hors: true } | { non: string }} Valeur */
/** @typedef {ReturnType<typeof lectureDeModule>} Lecture */

/**
 * L'ÉVALUATEUR du dépôt : les racines lues par chaque site, relais et valeurs de retour résolus d'un
 * module à l'autre.
 * Chaque question posée à `acces` est une REQUÊTE (`requeteDe`) : `tracer` rend celles d'une évaluation,
 * mémos internes compris — son résultat ne dépend que de leurs réponses.
 * @param {{ lecture: (f: string) => Lecture | null, cible: (f: string, spec: string) => string | null, peutLire?: (f: string) => boolean }} acces
 *   `lecture` : la lecture d'un module (null s'il est illisible) ; `cible` : le module qu'un spécificateur désigne ;
 *   `peutLire` : le module peut-il porter un relais (un module sans lecture ni relais appelé n'en porte aucun).
 */
export function evaluateurDuDepot({ lecture: lectureDe, cible: cibleDe, peutLire: peutLireDe = () => true }) {
  /** Les requêtes de chaque évaluation tracée en cours, la plus interne au sommet. */
  const traces = []
  const noter = (requete) => { if (traces.length) traces[traces.length - 1].add(requete) }
  const fusionner = (requetes) => { if (traces.length) for (const r of requetes) traces[traces.length - 1].add(r) }
  const tracer = (faire) => {
    const requetes = new Set()
    traces.push(requetes)
    try { return { resultat: faire(), requetes } } finally {
      traces.pop()
      fusionner(requetes)
    }
  }
  const requetesDeLecture = new Map()
  const lecture = (f) => {
    noter(requetesDeLecture.get(f) ?? requetesDeLecture.set(f, requeteDe('lecture', f)).get(f))
    return lectureDe(f)
  }
  const cible = (f, spec) => { noter(requeteDe('cible', f, spec)); return cibleDe(f, spec) }
  const peutLire = (f) => { noter(requeteDe('peutLire', f)); return peutLireDe(f) }
  const pile = []
  const libres = new Map()
  const lies = new Map()
  /** Les relais en cours d'évaluation (`estRelais`). */
  const enCours = new Set()
  /** Les PORTÉES de mémoïsation ouvertes (`memoisable`) : `hauteur` = la pile à l'ouverture ; `dependante` =
   *  le calcul a lu un appel EN COURS sous cette hauteur, son résultat dépend donc de qui l'appelle. */
  const portees = []
  /** Le calcul en cours a lu l'appel de la pile à l'indice `i` : toute portée ouverte au-dessus en dépend. */
  const dependre = (i) => { for (const p of portees) if (p.hauteur > i) p.dependante = true }
  /** `faire()`, et s'il se mémoïse : aucun résultat calculé pendant un cycle ouvert sous lui ne se garde. */
  const memoisable = (faire) => {
    const portee = { hauteur: pile.length, dependante: false }
    portees.push(portee)
    try { return { resultat: faire(), stable: !portee.dependante } } finally { portees.pop() }
  }
  const identites = new WeakMap()
  let objets = 0
  /** La clé d'une valeur : un objet rendu vaut par identité. */
  const cleDe = (v) => {
    if ('chemin' in v) return `c${v.sous === undefined ? '' : '*'}${v.chemin}`
    if ('texte' in v) return `t${v.texte}`
    if ('non' in v) return `n${v.non}`
    if ('relais' in v) return `r${v.relais}`
    if ('fn' in v) return `f${v.fn.f}#${v.fn.id}`
    if ('hors' in v) return 'h'
    if ('absent' in v) return 'a'
    if ('lambda' in v) return `l${identiteDe(v.lambda)}@${v.ctx.f}#${v.ctx.env?.fn ?? ''}(${v.ctx.env?.args ? cleDesArgs(v.ctx.env.args) : '*'})`
    return identiteDe(v)
  }
  /** L'identité d'une valeur sans clé de contenu (objet rendu, fonction anonyme) : une par objet. */
  const identiteDe = (v) => {
    if (!identites.has(v)) identites.set(v, `objet ${objets += 1}`)
    return identites.get(v)
  }
  const uniques = (vals) => [...new Map(vals.map((v) => [cleDe(v), v])).values()]
  const relais = new Map()

  const importe = (f, spec, nom, vus = new Set()) => {
    const g = cible(f, spec)
    if (!g) return [{ non: `import ${spec} non résolu` }]
    const cle = `${g}#${nom}`
    if (vus.has(cle)) return [{ non: `cycle de constantes ${cle}` }]
    vus.add(cle)
    const lu = lecture(g)
    if (!lu) return [{ non: `module ${g} illisible` }]
    if (Object.hasOwn(lu.exports, nom)) return valeurs(lu.exports[nom], { f: g, env: null })
    for (const s of lu.etoiles) {
      const h = cible(g, s)
      const vu = h && lecture(h)
      if (vu && (Object.hasOwn(vu.exports, nom) || vu.etoiles.length)) return importe(g, s, nom, vus)
    }
    return [{ non: `${nom} non exporté par ${g}` }]
  }

  /** Évalue `e` dans le module `ctx.f`, paramètres de `ctx.env.fn` liés à `ctx.env.args` (null : relais). */
  function valeurs(e, ctx) {
    switch (e.k) {
      case 'lit': return [{ texte: e.v }]
      case 'chemin': return [borne(posix.normalize(e.v || '.'))]
      case 'hors': return [{ hors: true }]
      case 'non': return [{ non: e.raison }]
      case 'transforme': return [{ non: e.raison }]
      case 'liste': case 'union': return uniques(e.v.flatMap((x) => valeurs(x, ctx)))
      case 'importe': return importe(ctx.f, e.spec, e.nom)
      case 'fn': return [{ fn: { f: ctx.f, id: e.id } }]
      case 'lambda': return [{ lambda: e, ctx }]
      case 'objet': return [{ objet: e.v, ctx, ...(e.etales ? { etales: e.etales } : {}) }]
      case 'param': {
        if (ctx.env?.fn !== e.fn) return [{ non: `paramètre ${e.nom}` }]
        if (!ctx.env.args) return [{ relais: `${ctx.f}#${e.fn}` }]
        const decl = lecture(ctx.f)?.fonctions[e.fn]?.params[e.index]
        if (decl?.reste) return ctx.env.args.slice(e.index).flat()
        const defaut = () => decl?.defaut ? valeurs(decl.defaut, ctx) : [{ absent: true }]
        const arg = ctx.env.args[e.index]
        return arg ? uniques(arg.flatMap((v) => 'absent' in v ? defaut() : [v])) : defaut()
      }
      case 'champ': return valeurs(e.de, ctx).flatMap((o) => 'objet' in o && Object.hasOwn(o.objet, e.nom) ? valeurs(o.objet[e.nom], o.ctx)
        : 'objet' in o && o.etales ? uniques(o.etales.flatMap((x) => valeurs({ k: 'champ', de: x, nom: e.nom, texte: e.texte }, o.ctx))
          .flatMap((v) => 'absent' in v && e.defaut ? valeurs(e.defaut, ctx) : [v]))
        : 'objet' in o || 'absent' in o ? (e.defaut ? valeurs(e.defaut, ctx) : [{ absent: true }])
        : 'non' in o || 'relais' in o || 'hors' in o ? [o] : [{ non: `propriété ${e.texte}` }])
      case 'appel': {
        const args = e.args.map((a) => valeurs(a, ctx))
        return valeurs(e.cible, ctx).flatMap((c) => 'fn' in c ? retour(c.fn, args) : 'lambda' in c ? rendusDeLambda(c, e.texte)
          : 'relais' in c ? [c] : [{ non: `appel ${e.texte}` }])
      }
      case 'dir': return valeurs(e.v, ctx).map((v) => 'chemin' in v ? borne(posix.dirname(v.chemin || '.')) : 'texte' in v ? { texte: posix.dirname(v.texte) } : v)
      case 'join': case 'concat': {
        const lier = e.k === 'join' ? joindre : concatener
        let acc = [{ texte: '' }]
        for (const partie of e.v) {
          const suite = valeurs(partie, ctx)
          const absente = suite.find((x) => 'absent' in x)
          const presente = suite.some((x) => !('absent' in x))
          const vus = new Map()
          for (const a of acc) {
            if (FINALES.some((k) => k in a)) {
              if (presente) vus.set(cleDe(a), a)
              if (absente) vus.set(cleDe(absente), absente)
              continue
            }
            for (const x of suite) {
              const v = lier(a, x)
              vus.set(cleDe(v), v)
            }
          }
          acc = [...vus.values()]
        }
        return acc
      }
      default: return [{ non: `expression ${e.k}` }]
    }
  }

  /** Les valeurs rendues par une fonction ANONYME (`lambda`), évaluées dans le contexte qui l'a définie : ses
   *  variables capturées s'y lient ; ses propres paramètres restent non liés. */
  const rendusDeLambda = ({ lambda, ctx }, texte) => lambda.retours.length
    ? uniques(lambda.retours.flatMap((x) => valeurs(x, ctx))) : [{ non: `appel ${texte} sans retour` }]

  /** La clé des arguments d'un appel (`cleDe`) : deux appels de mêmes valeurs ont la même. */
  const cleDesArgs = (args) => args ? args.map((a) => a.map(cleDe).join(',')).join('|') : ''

  /** Borne la pile d'appels de la fonction `fonction` (`<nature> <module>#<nom>`) aux arguments `args`. Un appel
   *  déjà en cours AUX MÊMES arguments rend l'approximation courante de cet appel, qui se recalcule jusqu'au POINT
   *  FIXE (ensemble de valeurs stable) en au plus `ITERATIONS` passes, au-delà `cycle d'appels … sans point fixe` ;
   *  une `REENTREES`+1-ième ré-entrée à d'autres arguments et la profondeur rendent un `non` nommé. Chacun dépend
   *  de la pile qui l'a vu (`dependre`). Un cycle se nomme par ses fonctions, triées : il porte le même nom quel
   *  que soit l'appel par lequel on y entre. */
  const sousPile = (fonction, args, nom, faire) => {
    const cle = `${fonction}(${cleDesArgs(args)})`
    const enCoursAuxMemes = pile.findIndex((p) => p.cle === cle)
    const cycle = (depuis) => {
      dependre(depuis)
      return [{ non: `cycle d'appels ${[...new Set(pile.slice(depuis).map((p) => p.nom))].sort().join(', ')}` }]
    }
    if (enCoursAuxMemes >= 0) {
      dependre(enCoursAuxMemes)
      pile[enCoursAuxMemes].reentre = true
      return pile[enCoursAuxMemes].approximation
    }
    if (pile.filter((p) => p.fonction === fonction).length > REENTREES) return cycle(pile.findIndex((p) => p.fonction === fonction))
    if (pile.length >= PROFONDEUR_D_APPELS) {
      dependre(0)
      return [{ non: `profondeur d'appels > ${PROFONDEUR_D_APPELS} (${nom})` }]
    }
    const appel = { fonction, cle, nom, approximation: [], reentre: false }
    pile.push(appel)
    try {
      for (let passe = 1; ; passe += 1) {
        appel.reentre = false
        const rendu = uniques([...appel.approximation, ...faire()])
        if (!appel.reentre || rendu.length === appel.approximation.length) return rendu
        if (passe === ITERATIONS) return [...rendu, { non: `cycle d'appels ${nom} sans point fixe` }]
        appel.approximation = rendu
      }
    } finally { pile.pop() }
  }

  const retour = (fn, args) => sousPile(`retour ${fn.f}#${fn.id}`, args, fn.id, () => {
    const decl = lecture(fn.f)?.fonctions[fn.id]
    if (!decl) return [{ non: `fonction ${fn.id} illisible` }]
    if (!decl.retours.length) return [{ non: `${fn.id} sans retour` }]
    return decl.retours.flatMap((r) => valeurs(r, { f: fn.f, env: { fn: fn.id, args } }))
  })

  /** Les racines lues par la fonction `fn`, paramètres liés à `args` ; `args` null : marqueurs `relais`. */
  const lecturesDe = (fn, args) => {
    const memo = args ? lies : libres
    const cle = `${fn.f}#${fn.id}${cleDesArgs(args)}`
    const deja = memo.get(cle)
    if (deja) {
      fusionner(deja.requetes)
      return deja.rendu
    }
    const { resultat: { resultat: rendu, stable }, requetes } = tracer(() => memoisable(() => sousPile(`lectures ${fn.f}#${fn.id}`, args, fn.id, () => {
      const lu = lecture(fn.f)
      if (!lu) return [{ non: `module ${fn.f} illisible` }]
      return uniques(lu.sites.filter((s) => s.dans === fn.id).flatMap((s) => lecturesDuSite(fn.f, s, { fn: fn.id, args })))
    })))
    if (stable) memo.set(cle, { rendu, requetes })
    return rendu
  }

  /** La fonction est-elle un RELAIS : un de ses paramètres alimente-t-il une lecture ? Une fonction déjà en
   *  cours d'évaluation est supposée relais : ses lectures liées s'évaluent, et une boucle s'y nomme (`sousPile`).
   *  Une lecture COUPÉE (`COUPE`) ne tranche pas : supposée relais, la coupe se nomme au site qui l'appelle. */
  const estRelais = (fn) => {
    const cle = `${fn.f}#${fn.id}`
    const deja = relais.get(cle)
    if (deja) {
      fusionner(deja.requetes)
      return deja.oui
    }
    if (enCours.has(cle)) return true
    if (!peutLire(fn.f)) return false
    enCours.add(cle)
    try {
      const { resultat: { resultat: oui, stable }, requetes } = tracer(() => memoisable(() => lecturesDe(fn, null).some((v) => 'relais' in v || ('non' in v && COUPE.test(v.non)))))
      if (stable) relais.set(cle, { oui, requetes })
      return oui
    } finally { enCours.delete(cle) }
  }

  /** Les racines d'un site : la lecture elle-même, ou celles du relais appelé avec ses arguments. */
  function lecturesDuSite(f, site, env) {
    const ctx = { f, env }
    const arg = (i) => site.args[i] ? valeurs(site.args[i], ctx) : [{ chemin: '' }]
    if (site.lecture) {
      const porte = PORTES_GIT[site.lecture]
      if (porte) {
        const chemins = porte.chemins === 'reste'
          ? (site.args.length > porte.depuis ? site.args.slice(porte.depuis).flatMap((a) => valeurs(a, ctx)) : [{ texte: '' }])
          : (site.args[porte.depuis] ? valeurs(site.args[porte.depuis], ctx) : [{ non: 'chemins absents' }])
        const depots = arg(porte.depot).map((v) => 'texte' in v ? ancrer(v.texte) : v)
        return finir(depots.flatMap((d) => 'chemin' in d ? chemins.map((c) => joindre(d, c)) : [d]))
      }
      if (!site.args[0]) return [{ non: 'argument absent' }]
      if (!GLOBS.has(site.lecture)) return finir(arg(0))
      const cwd = site.args[1]
        ? valeurs({ k: 'champ', de: site.args[1], nom: 'cwd', texte: 'cwd' }, ctx).map((v) => 'absent' in v ? { chemin: '' } : v)
        : [{ chemin: '' }]
      return finir(cwd.flatMap((c) => arg(0).map((m) => 'texte' in m ? joindre(c, { texte: prefixeDeMotif(m.texte) }) : m)))
    }
    const cibles = valeurs(site.cible, ctx).filter((c) => 'fn' in c)
    return cibles.flatMap((c) => estRelais(c.fn) ? finir(lecturesDe(c.fn, site.args.map((a) => valeurs(a, ctx)))) : [])
  }

  const finir = (vals) => uniques(vals).filter((v) => !('absent' in v))
    .map((v) => 'texte' in v ? ancrer(v.texte) : 'fn' in v || 'objet' in v || 'lambda' in v ? { non: 'racine non chemin' } : v)

  return {
    /** Les sites de lecture d'un module et leurs racines ; un site RELAIS (racine liée à un paramètre de
     *  sa fonction) rend `relais: true`, ses racines se lisent chez ses appelants. */
    sitesDe(f) {
      const lu = lecture(f)
      if (!lu) return []
      const rendus = []
      for (const site of lu.sites) {
        const vals = lecturesDuSite(f, site, site.dans ? { fn: site.dans, args: null } : null)
        if (!vals.length) continue
        rendus.push({ ligne: site.ligne, appel: site.appel, relais: vals.some((v) => 'relais' in v), valeurs: vals.filter((v) => !('relais' in v)) })
      }
      return rendus
    },
    /** Les noms exportés de `f` qui désignent un relais. */
    relaisExportes(f) {
      const lu = lecture(f)
      if (!lu) return []
      return Object.entries(lu.exports).filter(([, e]) => (e.k === 'fn' || e.k === 'importe') &&
        valeurs(e, { f, env: null }).some((v) => 'fn' in v && estRelais(v.fn))).map(([nom]) => nom)
    },
    valeurs,
    /** `faire()` et les requêtes qu'il a posées (`requeteDe`). */
    tracer,
  }
}

/** Les valeurs qui absorbent ce qui les suit dans un `join` ou un gabarit (`joindre`). */
const FINALES = Object.freeze(['relais', 'hors', 'non', 'absent'])

/** Une REQUÊTE de l'évaluateur, en texte : `lecture` d'un module, `cible` d'un spécificateur, `peutLire`. */
export const requeteDe = (...parties) => JSON.stringify(parties)

/** Les parties d'une requête (`requeteDe`). */
export const partiesDeRequete = (requete) => JSON.parse(requete)

/** Le préfixe sans métacaractère d'un motif de glob. */
const prefixeDeMotif = (motif) => {
  const segments = motif.split('/')
  const i = segments.findIndex((s) => /[*?[{]/.test(s))
  return (i < 0 ? segments : segments.slice(0, i)).join('/')
}

const ancrer = (texte) => /^([a-zA-Z]:)?[\\/]/.test(texte) ? { non: `chemin absolu ${texte}` } : borne(posix.normalize(texte.replace(/\\/g, '/')))
const borne = (chemin) => {
  const net = chemin.replace(/\/+$/, '').replace(/^\.$/, '')
  return net === '..' || net.startsWith('../') ? { hors: true } : { chemin: net }
}

/** `join` : une partie non résolue APRÈS un préfixe résolu non vide rend le préfixe, lu comme dossier
 *  (`sous`) ; un relais absorbe ce qui le suit. */
function joindre(a, s) {
  if ('absent' in s) return s
  if ('relais' in a || 'hors' in a || 'non' in a || 'absent' in a) return a
  if ('relais' in s || 'hors' in s) return s
  if ('non' in s) {
    const prefixe = 'chemin' in a ? a : a.texte ? ancrer(a.texte) : null
    return prefixe && 'chemin' in prefixe && prefixe.chemin ? { chemin: prefixe.chemin, sous: s.non } : s
  }
  if ('fn' in s || 'objet' in s || 'lambda' in s) return { non: 'racine non chemin' }
  if ('chemin' in s) return s
  if ('chemin' in a) return /^([a-zA-Z]:)?[\\/]/.test(s.texte) ? { non: `chemin absolu ${s.texte}` } : borne(posix.join(a.chemin || '.', s.texte.replace(/\\/g, '/')))
  return { texte: a.texte ? posix.join(a.texte, s.texte) : s.texte }
}

/** Concaténation de gabarit : un chemin suivi d'un texte s'y joint, séparateur de tête retiré. */
function concatener(a, s) {
  if ('chemin' in a && 'texte' in s) return joindre(a, { texte: s.texte.replace(/^[\\/]+/, '') })
  if ('texte' in a && 'texte' in s) return { texte: a.texte + s.texte }
  if ('texte' in a && !a.texte) return s
  return joindre(a, s)
}

/**
 * La valeur d'une racine (`Expr`) sans module ni import : chemins POSIX relatifs au dépôt, lieu HORS du
 * dépôt (`{ hors: true }`), ou `{ non: raison }`. Une chaîne nue est relative à la racine du dépôt.
 * @param {Expr} e @returns {Valeur[]}
 */
export function evaluer(e) {
  return evaluateurDuDepot({ lecture: () => null, cible: () => null }).valeurs(e, { f: '', env: null })
    .filter((v) => !('absent' in v)).map((v) => 'texte' in v ? ancrer(v.texte) : v)
}
