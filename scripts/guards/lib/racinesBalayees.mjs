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
//     dans ses étalements, l'argument absent prend le défaut de son paramètre. L'appel de la primitive du
//     dossier git (`DOSSIER_GIT`) vaut `<racine>/.git`, sans évaluer ses retours.
//   · Une liaison RÉAFFECTÉE vaut sa valeur initiale et le membre droit de chaque `=` (`??=`, `||=`, `&&=`)
//     qui la vise ; une réaffectation illisible rend `<nom> réaffectée`, un membre droit qui revient à la
//     liaison `<nom> réaffectée en récurrence`.
// L'arbre syntaxique se lit une fois par module (`lectureDeModule`, sérialisable, mémoïsable) ;
// l'évaluation attend la résolution des imports (`evaluateurDuDepot`), et `tracer` rend les REQUÊTES dont
// elle dépend (`requeteDe`). Ce qui ne se lit pas ainsi n'est pas deviné : il rend `{ non: raison }`, et
// son site sort au rapport de l'appelant.
import { posix } from 'node:path'
import { types } from 'node:util'
import { typescript } from './dialecte.mjs'
import { gelerLaConstante } from '../../../src/lib/gelerProfond.ts'
import { clesCanoniques } from './clesCanoniques.mjs'

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

/** La primitive canonique du DOSSIER GIT d'une racine (`<module>#<fonction>`) : le modèle la pose en `<x>/.git`, la
 *  valeur réelle d'un worktree lié est `<commun>/worktrees/<nom>` ; dans les deux cas une racine exacte que rien
 *  de suivi n'habite, `git help gitrepository-layout`. */
const DOSSIER_GIT = 'scripts/hooks/barriere-outil.mjs#gitDirDe'

/** Préfiltre textuel : un module sans appel nommé d'une lecture n'a aucun site de base. */
export const APPEL_DE_LECTURE = new RegExp(`\\bCONTRATS_DE_DERIVATION\\b|\\b(?:${[...PRIMITIVES, ...Object.keys(PORTES_GIT)].join('|')})\\s*\\(`)

const CHEMINS = new Set(['join', 'resolve'])
/** Les receveurs d'un `join`/`resolve` de chemin : le module `node:path` et ses variantes. */
const MODULES_DE_CHEMIN = new Set(['path', 'posix', 'win32'])
const ITERATEURS = new Set(['map', 'flatMap', 'forEach', 'filter', 'some', 'every', 'find'])
/** Ce qui rend une PARTIE de son receveur : la valeur du receveur la couvre. */
/** La raison d'une VALEUR NULLE (`null`, l'identifiant global `undefined`) : elle ne désigne aucun chemin. */
export const VALEUR_NULLE = 'valeur nulle'
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
  const nomAppele = (appel) => ts.isIdentifier(appel.expression) ? nomExporte(appel.expression)
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
    if (!ts.isBlock(n.body)) return [{ expression: n.body, gardes: [] }]
    const retours = []
    const visiter = (x, gardes = []) => {
      if (estFonction(x)) return
      if (ts.isReturnStatement(x)) {
        if (x.expression) retours.push({ expression: x.expression, gardes })
        return true
      }
      if (ts.isBlock(x)) {
        let suite = gardes
        for (const s of x.statements) {
          const termine = visiter(s, suite)
          if (termine === true) return true
          if (Array.isArray(termine)) suite = [...suite, ...termine]
        }
        return false
      }
      if (ts.isIfStatement(x)) {
        const oui = visiter(x.thenStatement, [...gardes, { condition: x.expression, attendu: true }])
        const non = x.elseStatement && visiter(x.elseStatement, [...gardes, { condition: x.expression, attendu: false }])
        if (oui === true && non === true) return true
        if (oui === true) return [{ condition: x.expression, attendu: false }]
        if (non === true) return [{ condition: x.expression, attendu: true }]
        return false
      }
      x.forEachChild((e) => { visiter(e, gardes) })
      return false
    }
    visiter(n.body)
    return retours
  }
  const retoursLus = (n, profondeur = 0) => retoursDe(n).map(({ expression, gardes }) => gardes.reduceRight((de, g) =>
    ({ k: 'garde', de, condition: expr(g.condition, profondeur), attendu: g.attendu }), expr(expression, profondeur)))

  /** Le chemin de champs qui mène à `texte` dans un motif de liaison : `null` s'il n'y est pas, `false`
   *  s'il passe par un reste. */
  const champsVers = (nom, texte) => {
    if (!nom) return null
    if (ts.isIdentifier(nom)) return nom.text === texte ? [] : null
    if (ts.isArrayBindingPattern(nom)) {
      for (const [index, e] of nom.elements.entries()) {
        if (!ts.isBindingElement(e)) continue
        const sous = champsVers(e.name, texte)
        if (sous !== null) return e.dotDotDotToken || sous === false ? false : [index, ...sous]
      }
      return null
    }
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
      if (!ts.isBindingElement(e) || !e.name) continue
      if (ts.isIdentifier(e.name) && e.name.text === texte) return e.initializer
      const sous = defautVers(e.name, texte)
      if (sous) return sous
    }
    return undefined
  }
  const parChamps = (base, champs, texte, motif, profondeur = 0) => {
    if (champs === false) return non(`déstructuration de tableau ${texte}`)
    const defaut = motif && defautVers(motif, texte)
    return champs.reduce((de, nom, i) => ({ k: typeof nom === 'number' ? 'indice' : 'champ', de, nom, texte,
      ...(defaut && i === champs.length - 1 ? { defaut: expr(defaut, profondeur) } : {}) }), base)
  }

  const elementItere = (de) => ({ k: 'elementItere', de })

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
        const builtin = ['node:os', 'os', 'node:fs', 'fs'].includes(s.moduleSpecifier.text)
        if (s.importClause.name) poser(s.importClause.name.text, builtin ? { importe: s.moduleSpecifier.text, nom: 'default' } : { horsNom: true })
        if (liaisons && ts.isNamespaceImport(liaisons)) poser(liaisons.name.text, builtin ? { importe: s.moduleSpecifier.text, nom: '*' } : { horsNom: true })
      }
    }
    blocs.set(instructions, index)
    return index
  }

  /** Le nœud qui LIE l'identifiant `id` : la fonction dont il est paramètre (`parametre`), la boucle qui le
   *  déclare (`boucle`), ou la liste d'instructions qui le déclare (`decl`) ; `null` s'il est introuvable. */
  /** Le nom d'un identifiant appelé : celui que son module EXPORTE s'il est importé sous un autre nom
   *  (`join as joinPath`), sinon le sien. */
  const nomExporte = (id) => liaisonDe(id)?.decl?.nom ?? id.text
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
  const ficheDe = (n, nom) => {
    const noms = affectations.get(n) ?? affectations.set(n, new Map()).get(n)
    return noms.get(nom) ?? noms.set(nom, { droits: [], opaque: false, champs: new Set() }).get(nom)
  }
  /** Le champ STATIQUE de l'accès `acces` (`x.a`, `x['a']`), `null` s'il est calculé. */
  const champStatique = (acces) => ts.isPropertyAccessExpression(acces) ? acces.name.text
    : ts.isElementAccessExpression(acces) && ts.isStringLiteralLikeNode(acces.argumentExpression) ? acces.argumentExpression.text : null
  /** La lecture `id` est-elle souillée par `fiche` : liaison opaque, ou champ écrit (`champs`) que `id` lit, ou
   *  que `id` lu nu peut atteindre. */
  const souillee = (fiche, id) => {
    if (fiche.opaque) return true
    if (!fiche.champs.size) return false
    const acces = parents.get(id)
    const champ = acces && (ts.isPropertyAccessExpression(acces) || ts.isElementAccessExpression(acces)) && acces.expression === id ? champStatique(acces) : null
    return champ === null || fiche.champs.has(champ)
  }
  const affectationsDe = () => {
    if (affectations) return affectations
    affectations = new Map()
    const poser = (cible, droit, champ = null) => {
      if (!cible) return
      if (ts.isParenthesizedExpression(cible) || ts.isSpreadElement(cible) || ts.isSpreadAssignment(cible)) return poser(cible.expression, null)
      if (ts.isIdentifier(cible)) {
        const liaison = liaisonDe(cible)
        if (!liaison) return
        const fiche = ficheDe(liaison.n, cible.text)
        if (champ !== null) fiche.champs.add(champ)
        else if (droit) fiche.droits.push(droit)
        else fiche.opaque = true
        return
      }
      if (ts.isPropertyAccessExpression(cible) || ts.isElementAccessExpression(cible))
        return ts.isIdentifier(cible.expression) && champStatique(cible) !== null ? poser(cible.expression, null, champStatique(cible)) : poser(cible.expression, null)
      if (ts.isArrayLiteralExpression(cible)) for (const e of cible.elements) poser(e, null)
      if (ts.isObjectLiteralExpression(cible))
        for (const p of cible.properties) poser(ts.isShorthandPropertyAssignment(p) ? p.name : ts.isPropertyAssignment(p) ? p.initializer : p, null)
    }
    const exposer = (id) => {
      const liaison = liaisonDe(id)
      if (!liaison?.parametre) return
      let x = id, parent = parents.get(x)
      if ((parent.kind === ts.SyntaxKind.Parameter || ts.isVariableDeclaration(parent) || ts.isBindingElement(parent) ||
        ts.isFunctionDeclaration(parent) || ts.isFunctionExpression(parent)) && parent.name === x) return
      if ((ts.isPropertyAccessExpression(parent) || ts.isPropertyAssignment(parent) ||
        ts.isMethodDeclaration(parent) || ts.isGetAccessorDeclaration(parent) || ts.isSetAccessorDeclaration(parent)) && parent.name === x) return
      let capture = false
      for (let n = parent; n && n !== liaison.n; n = parents.get(n)) if (estFonction(n)) capture = true
      while (parent && (((ts.isPropertyAccessExpression(parent) || ts.isElementAccessExpression(parent)) && parent.expression === x) ||
        ts.isParenthesizedExpression(parent) || ts.isAsExpression(parent) || ts.isNonNullExpression(parent) || ts.isSatisfiesExpression(parent) ||
        (ts.isBinaryExpression(parent) && [ts.SyntaxKind.AmpersandAmpersandToken, ts.SyntaxKind.BarBarToken, ts.SyntaxKind.QuestionQuestionToken].includes(parent.operatorToken.kind)) ||
        (ts.isConditionalExpression(parent) && parent.condition !== x))) {
        x = parent
        parent = parents.get(x)
      }
      const lecture = parent && (((ts.isIfStatement(parent) || ts.isWhileStatement(parent) ||
        ts.isDoStatement(parent) || ts.isForStatement(parent)) && parent.expression === x) ||
        (ts.isConditionalExpression(parent) && parent.condition === x) ||
        (ts.isPrefixUnaryExpression(parent) && parent.operator === ts.SyntaxKind.ExclamationToken))
      if (!capture && lecture) return
      ficheDe(liaison.n, id.text).echappe = true
    }
    const visiter = (x) => {
      if (ts.isIdentifier(x)) exposer(x)
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
        return parChamps(elementItere(expr(appel.expression.expression, profondeur)), champsVers(n.parameters[0].name, texte), texte, n.parameters[0].name, profondeur)
      const fiche = affectationsDe().get(n)?.get(texte)
      const mute = !!fiche && (souillee(fiche, id) || !!fiche.echappe)
      if (!idDe.has(n)) return { k: 'paramLambda', fn: `lambda:${n.pos}`, index, nom: texte, mute }
      const motif = n.parameters[index].name
      return parChamps({ k: 'param', fn: idDe.get(n), index, nom: texte, mute }, champsVers(motif, texte), texte, motif, profondeur)
    }
    if (boucle) {
      const [d] = n.initializer.declarations
      return ts.isForOfStatement(n) ? parChamps(elementItere(expr(n.expression, profondeur)), champsVers(d.name, texte), texte, d.name, profondeur)
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
    if (!liaison) return id.text === 'String' ? { k: 'native', nom: 'String' } : non(id.text === 'undefined' ? VALEUR_NULLE : `${id.text} introuvable`)
    const fiche = affectationsDe().get(liaison.n)?.get(id.text)
    const opaque = !!fiche && souillee(fiche, id)
    if (!fiche || (!opaque && !fiche.droits.length)) return valeurDeLiaison(id, liaison, profondeur)
    if (enLecture.some(([n, texte]) => n === liaison.n && texte === id.text)) return non(`${id.text} réaffectée en récurrence`)
    enLecture.push([liaison.n, id.text])
    try {
      const sansInitiale = liaison.decl?.variable && !liaison.decl.variable.initializer && fiche.droits.length
      return { k: 'union', v: [
        ...(sansInitiale ? [] : [valeurDeLiaison(id, liaison, profondeur)]),
        ...fiche.droits.map((droit) => expr(droit, profondeur)),
        ...(opaque ? [non(`${id.text} réaffectée`)] : []),
      ] }
    } finally { enLecture.pop() }
  }

  /** Les fonctions anonymes lues (`expr`), une fois par nœud ; `null` pendant leur lecture : une fonction qui se
   *  nomme elle-même dans ses retours est récursive. */
  const lambdas = new Map()
  const lexique = {}
  const expr = (n, profondeur = 0) => {
    if (profondeur > PROFONDEUR) return non('expression trop profonde')
    const p = profondeur + 1
    if (ts.isStringLiteralLikeNode(n)) return { k: 'lit', v: n.text }
    if (n.kind === ts.SyntaxKind.TrueKeyword || n.kind === ts.SyntaxKind.FalseKeyword) return { k: 'booleen', v: n.kind === ts.SyntaxKind.TrueKeyword }
    if (ts.isNumericLiteral(n)) return { k: 'scalaire', v: n.text }
    if (ts.isPrefixUnaryExpression(n) && n.operator === ts.SyntaxKind.ExclamationToken) return { k: 'negation', de: expr(n.operand, p) }
    if (n.kind === ts.SyntaxKind.NullKeyword) return non(VALEUR_NULLE)
    if (ts.isSpreadElement(n)) return { k: 'etale', de: expr(n.expression, p) }
    if (ts.isParenthesizedExpression(n) || ts.isAsExpression(n) || ts.isSatisfiesExpression(n) || ts.isNonNullExpression(n) ||
      ts.isAwaitExpression(n))
      return expr(n.expression, p)
    if (ts.isArrayLiteralExpression(n)) return { k: 'liste', v: n.elements.map((e) => expr(e, p)) }
    if (ts.isIdentifier(n)) return lier(n, p)
    if (idDe.has(n)) return { k: 'fn', id: idDe.get(n) }
    if (ts.isArrowFunction(n) || ts.isFunctionExpression(n)) {
      if (lambdas.has(n)) return lambdas.get(n) ?? non('fonction anonyme récursive')
      lambdas.set(n, null)
      const lue = { k: 'lambda', id: `lambda:${n.pos}`, params: n.parameters.map((prm) => ({ reste: !!prm.dotDotDotToken, ...(prm.initializer ? { defaut: expr(prm.initializer, p) } : {}) })), retours: retoursLus(n, p), sites: [] }
      const visiter = (x) => {
        if (estFonction(x) && x !== n) return
        if (ts.isCallExpression(x)) {
          const nom = nomAppele(x)
          const lecture = PRIMITIVES.includes(nom) || Object.hasOwn(PORTES_GIT, nom)
          const cible = !lecture && ts.isIdentifier(x.expression) ? lier(x.expression, p) : null
          if (lecture || cible) lue.sites.push({ appel: nom, args: [...x.arguments].map((a) => expr(a, p)), ...(lecture ? { lecture: nom } : { cible }) })
        }
        x.forEachChild(visiter)
      }
      if (n.body && n.parameters.length) visiter(n.body)
      Object.defineProperty(lexique, lue.id, { value: lue, enumerable: true, configurable: true, writable: true })
      const reference = { k: 'lambda', id: lue.id }
      lambdas.set(n, reference)
      return reference
    }
    if (ts.isTemplateExpression(n))
      return { k: 'concat', v: [{ k: 'lit', v: n.head.text }, ...n.templateSpans.flatMap((s) => [expr(s.expression, p), { k: 'lit', v: s.literal.text }])] }
    if (ts.isConditionalExpression(n)) return { k: 'union', v: [
      { k: 'garde', condition: expr(n.condition, p), attendu: true, de: expr(n.whenTrue, p) },
      { k: 'garde', condition: expr(n.condition, p), attendu: false, de: expr(n.whenFalse, p) },
    ] }
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
        if (ts.isPropertyAssignment(prop) && (ts.isIdentifier(prop.name) || ts.isStringLiteralLikeNode(prop.name))) {
          if (prop.name.text === '__proto__') etales.push(non(`prototype explicite ${texteDe(prop)}`))
          else Object.defineProperty(v, prop.name.text, { value: expr(prop.initializer, p), enumerable: true, configurable: true, writable: true })
        }
        else if (ts.isShorthandPropertyAssignment(prop)) Object.defineProperty(v, prop.name.text, { value: lier(prop.name, p), enumerable: true, configurable: true, writable: true })
        else if ((ts.isGetAccessorDeclaration(prop) || ts.isSetAccessorDeclaration(prop) || ts.isMethodDeclaration(prop)) && (ts.isIdentifier(prop.name) || ts.isStringLiteralLikeNode(prop.name))) Object.defineProperty(v, prop.name.text, { value: non(`membre opaque ${prop.name.text}`), enumerable: true, configurable: true, writable: true })
        else if (ts.isSpreadAssignment(prop)) etales.push(expr(prop.expression, p))
        else etales.push(non(`membre opaque ${texteDe(prop)}`))
      }
      const parent = parents.get(n)
      const objetDirect = (ts.isCallExpression(parent) && parent.arguments.includes(n)) || (parent?.kind === ts.SyntaxKind.Parameter && parent.initializer === n)
      return { k: 'objet', v, objetDirect, ...(etales.length ? { etales } : {}) }
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
        return { k: nom, v: args.map((a) => expr(a, p)) }
      if (nom === 'join' && receveur && ts.isCallExpression(receveur) && nomAppele(receveur) === 'split' && ts.isPropertyAccessExpression(receveur.expression))
        return expr(receveur.expression.expression, p)
      if (nom === 'dirname' && args[0]) return { k: 'dir', v: expr(args[0], p) }
      if (nom === 'cwd' && ts.isPropertyAccessExpression(n.expression) && texteDe(n.expression.expression) === 'process') return { k: 'chemin', v: '' }
      const receveurLie = receveur && ts.isIdentifier(receveur) ? lier(receveur, p) : null
      const lie = ts.isIdentifier(n.expression) ? lier(n.expression, p)
        : receveurLie?.k === 'importe' && ['*', 'default'].includes(receveurLie.nom) ? { ...receveurLie, nom } : null
      if (lie?.k === 'native' && args[0]) return { k: 'chaine', de: expr(args[0], p) }
      if (lie?.k === 'importe' && ['node:os', 'os'].includes(lie.spec) && lie.nom === 'tmpdir') return { k: 'couverture', origine: 'node:os#tmpdir', raison: 'répertoire temporaire dépendant de l’environnement' }
      if (lie?.k === 'importe' && ['node:fs', 'fs'].includes(lie.spec) && lie.nom === 'mkdtempSync' && args[0]) return { k: 'temporaire', prefixe: expr(args[0], p) }
      if (lie?.k === 'importe' && ['node:fs', 'fs'].includes(lie.spec) && lie.nom === 'readdirSync' && args[0]) return { k: 'repertoire', de: expr(args[0], p), options: args[1] ? expr(args[1], p) : null }
      if (['fileURLToPath', 'freeze'].includes(nom) && args[0]) return expr(args[0], p)
      if (nom === 'flat' && receveur) return { k: 'aplatir', de: expr(receveur, p), profondeur: args[0] ? expr(args[0], p) : { k: 'scalaire', v: '1' } }
      if ((nom === 'replace' || nom === 'replaceAll') && ts.isPropertyAccessExpression(n.expression)) return expr(n.expression.expression, p)
      if (SOUS_ENSEMBLES.has(nom) && ts.isPropertyAccessExpression(n.expression)) return expr(n.expression.expression, p)
      const rendus = PROJECTIONS.has(nom) && args[0] && (ts.isArrowFunction(args[0]) || ts.isFunctionExpression(args[0])) ? retoursLus(args[0], p) : []
      if (rendus.length && ts.isPropertyAccessExpression(n.expression)) return { k: 'projection', de: expr(n.expression.expression, p), aplatie: nom === 'flatMap', v: rendus }
      if (PROJECTIONS.has(nom) && args[0] && receveur) return { k: 'projectionRappel', de: expr(receveur, p), cible: expr(args[0], p), texte: texteDe(args[0]), aplatie: nom === 'flatMap' }
      if (ITERATEURS.has(nom) && ts.isPropertyAccessExpression(n.expression))
        return { k: 'transforme', raison: `appel ${texteDe(n.expression)}`, v: expr(n.expression.expression, p) }
      if (ts.isIdentifier(n.expression)) return { k: 'appel', cible: lier(n.expression, p), args: args.map((a) => expr(a, p)), texte: texteDe(n.expression) }
      return non(`appel ${texteDe(n.expression)}`)
    }
    return non(`forme ${ts.SyntaxKind[n.kind]}`)
  }

  /** Paramètres (reste, défaut) et expressions rendues de chaque fonction de premier niveau. */
  const fonctions = Object.fromEntries([...idDe].map(([n, id]) => [id, {
    params: n.parameters.map((prm) => ({ reste: !!prm.dotDotDotToken, ...(prm.initializer ? { defaut: expr(prm.initializer) } : {}) })),
    retours: retoursLus(n),
  }]))

  /** La fonction de premier niveau qui contient `n`, ou `null`. */
  const dansDe = (n) => {
    for (let x = parents.get(n); x; x = parents.get(x)) if (idDe.has(x)) return idDe.get(x)
    return null
  }

  const objetDeclare = (n, vus = new Set()) => {
    if (!n || vus.has(n)) return null
    vus.add(n)
    if (ts.isObjectLiteralExpression(n)) return n
    if (ts.isParenthesizedExpression(n) || ts.isAsExpression(n) || ts.isSatisfiesExpression(n)) return objetDeclare(n.expression, vus)
    if (ts.isCallExpression(n) && nomAppele(n) === 'freeze') return objetDeclare(n.arguments[0], vus)
    if (!ts.isIdentifier(n)) return null
    const liaison = liaisonDe(n)
    if (liaison?.decl?.variable) return objetDeclare(liaison.decl.variable.initializer, vus)
    if (liaison?.parametre) {
      const index = parametresDe(liaison.n).findIndex((noms) => noms.has(n.text))
      return objetDeclare(liaison.n.parameters[index].initializer, vus)
    }
    return null
  }
  const cibleAppele = (n) => {
    if (ts.isIdentifier(n.expression)) return lier(n.expression, 0)
    if (!ts.isPropertyAccessExpression(n.expression) || !objetDeclare(n.expression.expression)) return null
    return expr(n.expression)
  }
  return { expr, lambdas: lexique, lier, nomAppele, fonctions, dansDe, ligneDe, cibleAppele }
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
  const { expr, lambdas, lier, nomAppele, fonctions, dansDe, ligneDe, cibleAppele } = lecteurDExpressions(rel, arbre)
  const sites = []
  const estMembreCallable = (cible) => {
    if (cible?.k !== 'champ') return false
    const de = cible.de.k === 'param' ? (Object.hasOwn(fonctions, cible.de.fn) ? fonctions[cible.de.fn]?.params[cible.de.index]?.defaut : null) : cible.de
    return de?.k === 'objet' && Object.hasOwn(de.v, cible.nom) && ['fn', 'lambda'].includes(de.v[cible.nom]?.k)
  }
  const dansUnRappel = (n) => {
    for (let a = n.parent; a; a = a.parent) {
      if (!ts.isArrowFunction(a) && !ts.isFunctionExpression(a)) continue
      if (!a.parameters.length) return false
      const appel = a.parent
      if (!ts.isCallExpression(appel) || !appel.arguments.includes(a) || !ts.isIdentifier(appel.expression)) return false
      const cible = lier(appel.expression, 0)
      return cible.k === 'fn' || (cible.k === 'importe' && cible.spec.startsWith('.'))
    }
    return false
  }
  const visiter = (n) => {
    if (ts.isCallExpression(n) && !dansUnRappel(n)) {
      const nom = nomAppele(n)
      const lecture = PRIMITIVES.includes(nom) || Object.hasOwn(PORTES_GIT, nom)
      const cible = !lecture ? cibleAppele(n) : null
      if (lecture || (cible && (cible.k === 'fn' || cible.k === 'param' || estMembreCallable(cible) || (cible.k === 'importe' && !cible.spec.startsWith('node:')))))
        sites.push({ appel: nom, ligne: ligneDe(n), dans: dansDe(n), args: [...n.arguments].map((a) => expr(a)), ...(lecture ? { lecture: nom } : { cible }) })
    }
    n.forEachChild(visiter)
  }
  visiter(arbre)

  const exportsLus = new Map()
  const etoiles = []
  for (const s of arbre.statements) {
    const exporte = s.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)
    if (exporte && ts.isFunctionDeclaration(s) && s.name) exportsLus.set(s.name.text, { k: 'fn', id: s.name.text })
    if (exporte && ts.isVariableStatement(s))
      for (const d of s.declarationList.declarations)
        if (ts.isIdentifier(d.name)) exportsLus.set(d.name.text, d.initializer ? expr(d.initializer) : { k: 'non', raison: `${d.name.text} sans valeur initiale` })
    if (ts.isExportDeclaration(s)) {
      const spec = s.moduleSpecifier && ts.isStringLiteralLikeNode(s.moduleSpecifier) ? s.moduleSpecifier.text : null
      if (!s.exportClause) { if (spec) etoiles.push(spec); continue }
      if (!ts.isNamedExports(s.exportClause)) continue
      for (const e of s.exportClause.elements) {
        const origine = (e.propertyName ?? e.name).text
        exportsLus.set(e.name.text, spec ? { k: 'importe', spec, nom: origine } : lier(e.propertyName ?? e.name, 0))
      }
    }
  }
  const exports = Object.fromEntries(exportsLus)
  const declaration = Object.hasOwn(exports, 'CONTRATS_DE_DERIVATION') ? exports.CONTRATS_DE_DERIVATION : null
  const resumeDeRetour = (e, origine, fn) => {
    if (e?.k === 'lit' && e.v === 'corpus') return { k: 'couverture', origine, raison: 'résumé de retour déclaré à la source' }
    if (e?.k !== 'objet' || e.etales?.length || !Object.keys(e.v).length) return null
    const type = e.v.type?.v
    const argument = e.v.argument?.k === 'scalaire' ? Number(e.v.argument.v) : null
    const param = argument === null ? null : { k: 'param', fn, index: argument, nom: 'provenance' }
    if (type === 'argument' && param) {
      const champs = e.v.champs?.k === 'liste' ? e.v.champs.v : []
      if (champs.some((x) => x.k !== 'lit')) return null
      return champs.reduce((de, x) => ({ k: 'champ', de, nom: x.v, texte: `${origine}.${x.v}` }), param)
    }
    if (type === 'reste' && param) return { k: 'reste', fn, index: argument }
    if (type === 'scalaire') return { k: 'non', raison: `scalaire indéterminé : ${origine}` }
    if (type === 'chaine') return { k: 'couverture', origine, raison: 'chaîne sans borne déclarée à la source' }
    if (type === 'null') return { k: 'non', raison: VALEUR_NULLE }
    if (type === 'poignee' && param) return { k: 'poignee', de: param, origine }
    if (type === 'racineGit' && param) return { k: 'racineGit', de: param, origine }
    if (type === 'imageGit' && e.v.porte?.k === 'lit' && Object.hasOwn(PORTES_GIT, e.v.porte.v))
      return { k: 'imageGit', porte: PORTES_GIT[e.v.porte.v], fn, origine }
    if (type === 'collection') {
      const element = resumeDeRetour(e.v.element, `${origine}[]`, fn)
      return element ? { k: 'collection', element } : null
    }
    if (type === 'union' && e.v.variantes?.k === 'liste') {
      const v = e.v.variantes.v.map((x) => resumeDeRetour(x, origine, fn))
      return v.every(Boolean) ? { k: 'union', v } : null
    }
    if (type === 'objetPartiel' && e.v.champs?.k === 'objet') {
      const v = Object.fromEntries(Object.entries(e.v.champs.v).map(([nom, champ]) => [nom, resumeDeRetour(champ, `${origine}.${nom}`, fn)]))
      return Object.values(v).every(Boolean) ? { k: 'objet', v, partiel: true } : null
    }
    const v = Object.fromEntries(Object.entries(e.v).map(([nom, champ]) => [nom, resumeDeRetour(champ, `${origine}.${nom}`, fn)]))
    return Object.values(v).every(Boolean) ? { k: 'objet', v, ferme: true } : null
  }
  if (declaration?.k === 'liste') for (const descriptor of declaration.v) {
    if (descriptor.k !== 'objet') continue
    const { fonction, namespace, champ, lectures, retour } = descriptor.v
    if (fonction?.k !== 'fn' || !Object.hasOwn(fonctions, fonction.id)) continue
    if (namespace?.k === 'lit' && typeof namespace.v === 'string' && namespace.v && !namespace.v.split('/').includes('..'))
      fonctions[fonction.id].contrat = { namespace: namespace.v, ...(champ?.k === 'lit' ? { champ: champ.v } : {}) }
    if (lectures?.k === 'lit' && lectures.v === 'corpus') fonctions[fonction.id].contrat = { ...fonctions[fonction.id].contrat, lectures: 'corpus' }
    const resume = resumeDeRetour(retour, `${rel}#${fonction.id}:retour`, fonction.id)
    if (resume) fonctions[fonction.id].contrat = { ...fonctions[fonction.id].contrat, retour: resume }
  }
  const retenues = {}
  const vus = new Set()
  const retenir = (x) => {
    if (!x || typeof x !== 'object' || vus.has(x)) return
    vus.add(x)
    if (x.k === 'lambda' && !Object.hasOwn(retenues, x.id) && Object.hasOwn(lambdas, x.id)) {
      Object.defineProperty(retenues, x.id, { value: lambdas[x.id], enumerable: true, configurable: true, writable: true })
      retenir(lambdas[x.id])
    }
    for (const v of Object.values(x)) retenir(v)
  }
  retenir({ sites, fonctions, exports })
  return { sites, fonctions, exports, etoiles, lambdas: retenues }
}

/** Le format de l'IR de lecture, vérifié au décodage. */
const FORMAT_LECTURE = 'lecture-ir-1'
const LIMITE_LECTURE = 64 * 1024 * 1024

/**
 * L'IR JSON de `racine` (une lecture de `lectureDeModule`, ou toute valeur du domaine JSON) : un `pool` de nœuds
 * partagés par forme (`[0, primitive]`, `[1, références]`, `[2, [clé, référence][]]`), chaque référence vers un nœud
 * antérieur. Lève `IR_DOMAINE_JSON` hors du domaine (accesseur, proxy, prototype, `toJSON`), `IR_CYCLE` sur un cycle.
 * @param {unknown} racine @returns {string}
 */
export function encoderLecture(racine) {
  if (Object.hasOwn(Object.prototype, 'toJSON') || Object.hasOwn(Array.prototype, 'toJSON')) throw new Error('IR_DOMAINE_JSON')
  const pool = []
  const primitives = new Map()
  const formes = new Map()
  const identites = new WeakMap()
  const actifs = new WeakSet()
  const indexer = (cle, noeud, table) => {
    let reference = table.get(cle)
    if (reference === undefined) { reference = pool.length; table.set(cle, reference); pool.push(noeud) }
    return reference
  }
  const primitive = (v) => {
    if (v !== null && typeof v !== 'string' && typeof v !== 'number' && typeof v !== 'boolean' && v !== undefined) throw new Error('IR_DOMAINE_JSON')
    const p = v === undefined || (typeof v === 'number' && !Number.isFinite(v)) ? null : v
    return indexer(p, [0, p], primitives)
  }
  /** Le cadre d'un objet du domaine JSON : ses valeurs à encoder, dans l'ordre de ses entrées. */
  const ouvrir = (v) => {
    if (types.isProxy(v)) throw new Error('IR_DOMAINE_JSON')
    if (actifs.has(v)) throw new Error('IR_CYCLE')
    const tableau = Array.isArray(v)
    if (!tableau) { const prototype = Object.getPrototypeOf(v); if (prototype !== Object.prototype && prototype !== null) throw new Error('IR_DOMAINE_JSON') }
    const proprietes = Object.getOwnPropertyDescriptors(v)
    for (const p of Object.values(proprietes)) if (!Object.hasOwn(p, 'value')) throw new Error('IR_DOMAINE_JSON')
    if (Object.hasOwn(proprietes, 'toJSON') && (tableau || !proprietes.toJSON.enumerable)) throw new Error('IR_DOMAINE_JSON')
    const cles = []
    const valeurs = []
    if (tableau) for (let i = 0; i < v.length; i++) valeurs.push(proprietes[i]?.value)
    else for (const k of Object.keys(v)) { const x = proprietes[k].value; if (x !== undefined) { cles.push(k); valeurs.push(x) } }
    actifs.add(v)
    return { v, tableau, cles, valeurs, references: [] }
  }
  const fermer = (cadre) => {
    const { v, tableau, cles, references } = cadre
    let reference
    if (tableau) reference = indexer(`a${references.join(',')}`, [1, references], formes)
    else {
      let cle = 'o'
      for (let i = 0; i < cles.length; i++) cle += `${i ? ',' : ''}${JSON.stringify(cles[i])}:${references[i]}`
      reference = indexer(cle, [2, cles.map((k, i) => [k, references[i]])], formes)
    }
    identites.set(v, reference)
    actifs.delete(v)
    return reference
  }
  if (racine === null || typeof racine !== 'object') return JSON.stringify({ format: FORMAT_LECTURE, racine: primitive(racine), pool })
  const pile = [ouvrir(racine)]
  let resultat
  while (pile.length) {
    const cadre = pile[pile.length - 1]
    if (cadre.references.length < cadre.valeurs.length) {
      const x = cadre.valeurs[cadre.references.length]
      if (x === null || typeof x !== 'object') cadre.references.push(primitive(x))
      else if (identites.has(x)) cadre.references.push(identites.get(x))
      else pile.push(ouvrir(x))
      continue
    }
    pile.pop()
    const reference = fermer(cadre)
    if (pile.length) pile[pile.length - 1].references.push(reference)
    else resultat = reference
  }
  return JSON.stringify({ format: FORMAT_LECTURE, racine: resultat, pool })
}

function analyserLecture(texte, limite) {
  if (typeof texte !== 'string') throw new Error('IR_TEXTE_ATTENDU')
  if (Buffer.byteLength(texte) > limite) throw new Error(`IR_POOL_HORS_BORNE:${limite}`)
  let lecture
  try { lecture = JSON.parse(texte) } catch (e) { throw new Error('IR_JSON_INVALIDE', { cause: e }) }
  if (!lecture || lecture.format !== FORMAT_LECTURE || !Array.isArray(lecture.pool) ||
    !Number.isSafeInteger(lecture.racine) || lecture.racine < 0 || lecture.racine >= lecture.pool.length) throw new Error('IR_FORMAT_INVALIDE')
  const tailles = []
  const addition = (a, b) => Math.min(limite + 1, a + b)
  for (const [i, noeud] of lecture.pool.entries()) {
    if (!Array.isArray(noeud) || noeud.length !== 2) throw new Error(`IR_NOEUD_INVALIDE:${i}`)
    const [type, contenu] = noeud
    const reference = (r) => {
      if (!Number.isSafeInteger(r) || r < 0 || r >= i) throw new Error(`IR_REFERENCE_INVALIDE:${i}:${r}`)
      return tailles[r]
    }
    let taille = 2
    if (type === 0) {
      if (contenu !== null && !['string', 'number', 'boolean'].includes(typeof contenu) || typeof contenu === 'number' && !Number.isFinite(contenu)) throw new Error(`IR_PRIMITIVE_INVALIDE:${i}`)
      taille = Buffer.byteLength(JSON.stringify(contenu))
    } else if (type === 1 && Array.isArray(contenu)) {
      for (const [j, r] of contenu.entries()) taille = addition(taille, reference(r) + (j ? 1 : 0))
    } else if (type === 2 && Array.isArray(contenu)) {
      const cles = new Set()
      for (const [j, paire] of contenu.entries()) {
        if (!Array.isArray(paire) || paire.length !== 2 || typeof paire[0] !== 'string' || cles.has(paire[0])) throw new Error(`IR_PROPRIETE_INVALIDE:${i}`)
        cles.add(paire[0])
        taille = addition(taille, Buffer.byteLength(JSON.stringify(paire[0])) + 1 + reference(paire[1]) + (j ? 1 : 0))
      }
    } else throw new Error(`IR_NOEUD_INVALIDE:${i}`)
    tailles.push(Math.min(limite + 1, taille))
  }
  return { lecture, taille: tailles[lecture.racine] }
}

/**
 * La taille en octets du JSON DÉVELOPPÉ de l'IR `lecture` (`encoderLecture`), plafonnée à `limite + 1`, sans le développer.
 * Lève `IR_POOL_HORS_BORNE` si l'IR dépasse `limite`, et un `IR_*` nommé sur une IR mal formée.
 * @param {string} lecture @param {number} [limite] @returns {number}
 */
export function mesureLecture(lecture, limite = LIMITE_LECTURE) {
  return analyserLecture(lecture, limite).taille
}

/**
 * La valeur de l'IR `lecture` (`encoderLecture`), nœuds partagés rendus par identité. Lève comme `mesureLecture`, et
 * `IR_JSON_DEVELOPPE_HORS_BORNE` si le JSON développé dépasse `limite`.
 * @param {string} lecture @param {number} [limite] @returns {unknown}
 */
export function decoderLecture(lecture, limite = LIMITE_LECTURE) {
  const analyse = analyserLecture(lecture, limite)
  if (analyse.taille > limite) throw new Error(`IR_JSON_DEVELOPPE_HORS_BORNE:${limite}`)
  const valeurs = []
  for (const [type, contenu] of analyse.lecture.pool) {
    if (type === 0) valeurs.push(contenu)
    else if (type === 1) valeurs.push(contenu.map((r) => valeurs[r]))
    else {
      const objet = {}
      for (const [k, r] of contenu) Object.defineProperty(objet, k, { value: valeurs[r], enumerable: true, writable: true, configurable: true })
      valeurs.push(objet)
    }
  }
  return valeurs[analyse.lecture.racine]
}

/** @typedef {Record<string, unknown> & { k: string }} Expr */
/** @typedef {{ chemin: string, sous?: string } | { hors: true } | { non: string }} Valeur */
/** @typedef {ReturnType<typeof lectureDeModule>} Lecture */

/** @typedef {Readonly<Record<string, never>>} LectureIllisible */

/** Les lectures CERTIFIÉES par `certifierLecture`, chacune liée au module certifié : les seules qu'accepte le noyau
 *  fermé d'`evaluerLotDuDepot`, et sous ce module seulement. */
const lecturesCertifiees = new WeakMap()

/** Les TÉMOINS d'illisibilité que rend `certifierLecture` pour un module illisible : certifiés comme toute lecture,
 *  lus `null` par le noyau fermé. */
const lecturesIllisibles = new WeakSet()

/** Un module du lot : une chaîne non vide. @param {unknown} v @returns {v is string} */
const estModuleDuLot = (v) => typeof v === 'string' && v !== ''

/** `lu`, ou `null` si c'est un témoin d'illisibilité (`certifierLecture`). @param {unknown} lu */
const lectureOuNull = (lu) => lecturesIllisibles.has(/** @type {object} */ (lu)) ? null : /** @type {Lecture | null} */ (lu)

/**
 * La lecture CERTIFIÉE du module `module` depuis son IR `pool` (`encoderLecture`) : décodée (`decoderLecture`), sans
 * nœud `lie`, gelée en profondeur. Pour un module illisible (`pool` = `null`), un TÉMOIN gelé sans clé, certifié et lié
 * à `module` comme une lecture, que le noyau fermé d'`evaluerLotDuDepot` lit `null`. Lève comme
 * `decoderLecture`, `SNAPSHOT_IR_NON_PRODUCTEUR:<module>` sur un nœud `lie` et `SNAPSHOT_LECTURE_NON_OBJET:<module>` sur
 * une racine qui n'est pas un objet ; un `module` hors domaine (`estModuleDuLot`) lève
 * `SNAPSHOT_CERTIFICATION_MODULE_HORS_DOMAINE`. `stade('décodage', module)` observe chaque décodage.
 * @param {string} module @param {string | null} pool @param {(nom: string, module: string | null) => void} [stade]
 * @returns {Lecture | LectureIllisible}
 */
export function certifierLecture(module, pool, stade = () => {}) {
  if (!estModuleDuLot(module)) throw new Error('SNAPSHOT_CERTIFICATION_MODULE_HORS_DOMAINE')
  if (pool === null) {
    const temoin = /** @type {LectureIllisible} */ (Object.freeze(Object.create(null)))
    lecturesIllisibles.add(temoin)
    lecturesCertifiees.set(temoin, module)
    return temoin
  }
  stade('décodage', module)
  const lu = decoderLecture(pool)
  if (!lu || typeof lu !== 'object') throw new Error(`SNAPSHOT_LECTURE_NON_OBJET:${module}`)
  const vus = new WeakSet()
  const visiter = (v) => {
    if (!v || typeof v !== 'object' || vus.has(v)) return
    vus.add(v)
    if (v.k === 'lie') throw new Error(`SNAPSHOT_IR_NON_PRODUCTEUR:${module}`)
    for (const enfant of Object.values(v)) visiter(enfant)
  }
  visiter(lu)
  gelerLaConstante(lu)
  lecturesCertifiees.set(lu, module)
  return /** @type {Lecture} */ (lu)
}

/** `v` est-il un tableau NU : un `Array` dont les seules clés propres sont `length` et ses indices (ni méthode, ni
 *  itérateur, ni clé symbole propres) ? @param {unknown} v @returns {v is unknown[]} */
const estTableauNu = (v) => Array.isArray(v) && Reflect.ownKeys(v).every((cle) => cle === 'length' ||
  typeof cle === 'string' && Number.isInteger(Number(cle)) && String(Number(cle)) === cle && Number(cle) >= 0 && Number(cle) < v.length)

/**
 * La valeur PROPRE `objet[cle]`, lue une seule fois par son descripteur (`undefined` si absente) ; un accesseur lève
 * `SNAPSHOT_ACCESSEUR:<chemin>`.
 * @param {object} objet @param {PropertyKey} cle @param {string} chemin @returns {unknown}
 */
const valeurPropre = (objet, cle, chemin) => {
  const descripteur = Reflect.getOwnPropertyDescriptor(objet, cle)
  if (descripteur && !('value' in descripteur)) throw new Error(`SNAPSHOT_ACCESSEUR:${chemin}`)
  return descripteur?.value
}

/** La nature `v` dans un message : sa valeur pour une primitive (`String`, qui ne lève sur aucune), son `typeof` pour
 *  un objet, dont aucune méthode n'est appelée. @param {unknown} v */
const natureAffichee = (v) => v !== null && (typeof v === 'object' || typeof v === 'function') ? typeof v : String(v)

/**
 * La COPIE validée du DOMAINE d'un lot hors lectures, seule chose que consomme le noyau fermé : chaque élément lu une
 * fois par son descripteur propre (`valeurPropre`, un accesseur lève `SNAPSHOT_ACCESSEUR:<chemin>`), jamais par une
 * méthode ni un itérateur des entrées ; chaque tableau est NU (`estTableauNu`), sinon il lève l'erreur `*_NON_TABLEAU`
 * ou `*_NON_TRIPLET` de sa place. Refus par forme : `resolutions` (`SNAPSHOT_RESOLUTIONS_NON_TABLEAU`,
 * `SNAPSHOT_RESOLUTION_NON_TRIPLET:<i>`, `SNAPSHOT_RESOLUTION_HORS_DOMAINE:<i>`, `SNAPSHOT_RESOLUTION_DUPLIQUEE:<[f, spec]>`),
 * `lecteurs` (`SNAPSHOT_LECTEURS_NON_TABLEAU`, `SNAPSHOT_LECTEUR_HORS_DOMAINE:<i>`, `SNAPSHOT_LECTEUR_DUPLIQUE:<f>`),
 * `questions` (`SNAPSHOT_QUESTIONS_NON_TABLEAU`, `SNAPSHOT_QUESTION_NON_OBJET:<i>`, `SNAPSHOT_QUESTION_CLES:<i>` dont
 * toute clé symbole, `SNAPSHOT_NATURE_INVALIDE:<nature>` (`natureAffichee`), `SNAPSHOT_QUESTION_F_HORS_DOMAINE:<i>`).
 * Un module est une chaîne non vide (`estModuleDuLot`).
 * @param {unknown} resolutions @param {unknown} lecteurs @param {unknown} questions
 * @returns {{ resolutions: [string, string, string | null][], lecteurs: string[], questions: { nature: 'sitesDe' | 'relaisExportes', f: string }[] }}
 */
function validerDomaineDuLot(resolutions, lecteurs, questions) {
  if (!estTableauNu(resolutions)) throw new Error('SNAPSHOT_RESOLUTIONS_NON_TABLEAU')
  /** @type {[string, string, string | null][]} */
  const copieResolutions = []
  const specs = new Set()
  for (let i = 0, n = resolutions.length; i < n; i++) {
    const resolution = valeurPropre(resolutions, i, `resolutions[${i}]`)
    if (!estTableauNu(resolution) || resolution.length !== 3) throw new Error(`SNAPSHOT_RESOLUTION_NON_TRIPLET:${i}`)
    const [f, spec, cible] = [0, 1, 2].map((j) => valeurPropre(resolution, j, `resolutions[${i}][${j}]`))
    if (!estModuleDuLot(f) || !estModuleDuLot(spec) || !(cible === null || estModuleDuLot(cible))) throw new Error(`SNAPSHOT_RESOLUTION_HORS_DOMAINE:${i}`)
    const cle = JSON.stringify([f, spec])
    if (specs.has(cle)) throw new Error(`SNAPSHOT_RESOLUTION_DUPLIQUEE:${cle}`)
    specs.add(cle)
    copieResolutions.push([/** @type {string} */ (f), /** @type {string} */ (spec), /** @type {string | null} */ (cible)])
  }
  if (!estTableauNu(lecteurs)) throw new Error('SNAPSHOT_LECTEURS_NON_TABLEAU')
  /** @type {string[]} */
  const copieLecteurs = []
  const vus = new Set()
  for (let i = 0, n = lecteurs.length; i < n; i++) {
    const lecteur = valeurPropre(lecteurs, i, `lecteurs[${i}]`)
    if (!estModuleDuLot(lecteur)) throw new Error(`SNAPSHOT_LECTEUR_HORS_DOMAINE:${i}`)
    if (vus.has(lecteur)) throw new Error(`SNAPSHOT_LECTEUR_DUPLIQUE:${lecteur}`)
    vus.add(lecteur)
    copieLecteurs.push(/** @type {string} */ (lecteur))
  }
  if (!estTableauNu(questions)) throw new Error('SNAPSHOT_QUESTIONS_NON_TABLEAU')
  /** @type {{ nature: 'sitesDe' | 'relaisExportes', f: string }[]} */
  const copieQuestions = []
  for (let i = 0, n = questions.length; i < n; i++) {
    const question = valeurPropre(questions, i, `questions[${i}]`)
    if (!question || typeof question !== 'object' || Array.isArray(question)) throw new Error(`SNAPSHOT_QUESTION_NON_OBJET:${i}`)
    const cles = Reflect.ownKeys(question)
    if (cles.some((cle) => typeof cle !== 'string') || cles.sort().join() !== 'f,nature') throw new Error(`SNAPSHOT_QUESTION_CLES:${i}`)
    const nature = valeurPropre(question, 'nature', `questions[${i}].nature`)
    const f = valeurPropre(question, 'f', `questions[${i}].f`)
    if (nature !== 'sitesDe' && nature !== 'relaisExportes') throw new Error(`SNAPSHOT_NATURE_INVALIDE:${natureAffichee(nature)}`)
    if (!estModuleDuLot(f)) throw new Error(`SNAPSHOT_QUESTION_F_HORS_DOMAINE:${i}`)
    copieQuestions.push({ nature, f: /** @type {string} */ (f) })
  }
  return { resolutions: copieResolutions, lecteurs: copieLecteurs, questions: copieQuestions }
}

/**
 * L'évaluation d'un LOT, sans accès au disque, par un noyau fermé NEUF : `lectures` = les `[module, lecture]`
 * (`certifierLecture`), `resolutions` = les `[module, spécificateur, cible]`, `lecteurs` = les modules qui peuvent porter
 * un relais, `questions` = les `{ nature: 'sitesDe' | 'relaisExportes', f }`. Rend `{ nature, f, resultat, requetes }` par
 * question, détachés du noyau par leur JSON : le résultat sort du noyau sérialisé, et le rendu le reparse. `lectures`
 * se valide comme le reste du domaine (`validerDomaineDuLot`) : tableau NU, sinon `SNAPSHOT_LECTURES_NON_TABLEAU`, lu
 * entrée par entrée à son indice d'entrée `<i>` par son descripteur propre (`valeurPropre`) ; chaque entrée est une
 * paire NUE, sinon `SNAPSHOT_LECTURE_NON_PAIRE:<i>`, dont le module est du domaine (`estModuleDuLot`), sinon
 * `SNAPSHOT_LECTURE_MODULE_HORS_DOMAINE:<i>`, et la lecture, témoin d'illisibilité compris, certifiée
 * (`certifierLecture`), sinon `SNAPSHOT_LECTURE_NON_CERTIFIEE:<module>`, pour son module, sinon
 * `SNAPSHOT_LECTURE_D_UN_AUTRE_MODULE:<module>:<certifié>` ; un module déjà lu lève `SNAPSHOT_LECTURE_DUPLIQUEE:<module>`.
 * Le noyau lit un témoin `null`. Il ne consomme du lot que ces lectures validées et la copie validée de
 * `validerDomaineDuLot`. Une lecture, une cible ou un `peutLire` absent du lot lève `SNAPSHOT_QUESTION_ABSENTE`,
 * enveloppé en `QUESTION_DU_LOT:<nature>:<f>`. `stade(nom, module)` observe le budget du lot : son noyau (`'noyau'`,
 * un par lot, partagé par ses questions), chaque prédicat booléen (`'prédicat'`) et chaque calcul de retour (`'retour'`).
 * @param {{ lectures: [string, Lecture | LectureIllisible][], resolutions: [string, string, string | null][], lecteurs: string[], questions: { nature: string, f: string }[] }} lot
 * @param {(nom: string, module: string | null) => void} [stade]
 * @returns {{ nature: string, f: string, resultat: unknown, requetes: string[] }[]}
 */
export function evaluerLotDuDepot({ lectures, resolutions: resolutionsDuLot, lecteurs: lecteursDuLot, questions: questionsDuLot }, stade = () => {}) {
  /** @type {Map<string, Lecture | null>} */
  const lus = new Map()
  if (!estTableauNu(lectures)) throw new Error('SNAPSHOT_LECTURES_NON_TABLEAU')
  for (let i = 0, n = lectures.length; i < n; i++) {
    const entree = valeurPropre(lectures, i, `lectures[${i}]`)
    if (!estTableauNu(entree) || entree.length !== 2) throw new Error(`SNAPSHOT_LECTURE_NON_PAIRE:${i}`)
    const [module, lu] = [0, 1].map((j) => valeurPropre(entree, j, `lectures[${i}][${j}]`))
    if (!estModuleDuLot(module)) throw new Error(`SNAPSHOT_LECTURE_MODULE_HORS_DOMAINE:${i}`)
    if (!lecturesCertifiees.has(/** @type {object} */ (lu))) throw new Error(`SNAPSHOT_LECTURE_NON_CERTIFIEE:${module}`)
    const certifie = lecturesCertifiees.get(/** @type {object} */ (lu))
    if (certifie !== module) throw new Error(`SNAPSHOT_LECTURE_D_UN_AUTRE_MODULE:${module}:${certifie}`)
    if (lus.has(module)) throw new Error(`SNAPSHOT_LECTURE_DUPLIQUEE:${module}`)
    lus.set(module, lectureOuNull(lu))
  }
  const { resolutions, lecteurs, questions } = validerDomaineDuLot(resolutionsDuLot, lecteursDuLot, questionsDuLot)
  const cibles = new Map(resolutions.map(([f, spec, cible]) => [JSON.stringify([f, spec]), cible]))
  const lisibles = new Set(lecteurs)
  const exiger = (table, cle, nature) => {
    if (!table.has(cle)) throw new Error(`SNAPSHOT_QUESTION_ABSENTE:${nature}:${cle}`)
    return table.get(cle)
  }
  const rendus = []
  const lire = (module) => exiger(lus, module, 'lecture')
  const evaluateur = construireEvaluateur({
    lecture: lire,
    cible: (module, spec) => exiger(cibles, JSON.stringify([module, spec]), 'cible'),
    peutLire: (module) => { exiger(lus, module, 'peutLire'); return lisibles.has(module) },
    stade,
  }, true)
  for (const { nature, f } of questions) {
    try {
      const calculer = (index) => {
        const { resultat, requetes } = evaluateur.tracer(() => index === undefined ? evaluateur[nature](f) : evaluateur.siteDe(f, index))
        return { resultat: JSON.stringify(resultat), requetes: [...requetes] }
      }
      const lu = nature === 'sitesDe' ? lire(f) : null
      const requetes = new Set()
      const sites = []
      let resultat
      if (lu?.sites.length) {
        for (let index = 0; index < lu.sites.length; index++) {
          const rendu = calculer(index)
          if (rendu.resultat !== 'null') sites.push(rendu.resultat)
          for (const requete of rendu.requetes) requetes.add(requete)
        }
        resultat = `[${sites.join(',')}]`
      } else {
        const rendu = calculer()
        resultat = rendu.resultat
        for (const requete of rendu.requetes) requetes.add(requete)
      }
      rendus.push({ nature, f, resultat: JSON.parse(resultat), requetes: [...requetes] })
    } catch (erreur) { throw new Error(`QUESTION_DU_LOT:${nature}:${f}:${erreur.message}`, { cause: erreur }) }
  }
  return rendus
}

/**
 * L'ÉVALUATEUR OUVERT du dépôt, celui d'`evaluer` : les racines lues par chaque site, relais et valeurs de retour
 * résolus d'un module à l'autre, clés textuelles, preuves booléennes mémoïsées.
 * Chaque question posée à `acces` est une REQUÊTE (`requeteDe`) : `tracer` rend celles d'une évaluation,
 * mémos internes compris — son résultat ne dépend que de leurs réponses.
 * @param {{ lecture: (f: string) => Lecture | null, cible: (f: string, spec: string) => string | null, peutLire?: (f: string) => boolean }} acces
 *   `lecture` : la lecture d'un module (null s'il est illisible) ; `cible` : le module qu'un spécificateur désigne ;
 *   `peutLire` : le module peut-il porter un relais (un module sans lecture ni relais appelé n'en porte aucun).
 */
export function evaluateurDuDepot({ lecture, cible, peutLire = () => true }) {
  return construireEvaluateur({ lecture, cible, peutLire }, false)
}

/** L'évaluateur du régime `ferme` : noyau fermé d'un lot (`evaluerLotDuDepot`), clés structurelles, preuves booléennes
 *  recalculées ; sinon l'évaluateur ouvert (`evaluateurDuDepot`). */
function construireEvaluateur({ lecture: lectureDe, cible: cibleDe, peutLire: peutLireDe, stade = () => {} }, ferme) {
  stade('noyau', null)
  const { cleCanonique, cleDesArgs, cleDe, texteDeCle, composerCle, uniques, formesDesArguments } = clesCanoniques({ ferme })
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
  const observationsDePreuve = []
  const clesDesReponses = new WeakMap()
  const cleDeReponse = (reponse) => cleCanonique(({ referenceDe }) => referenceDe(reponse), reponse,
    reponse && typeof reponse === 'object' ? clesDesReponses : null, 'strict')
  const observerReponse = (nature, args, reponse) => {
    if (!observationsDePreuve.length) return reponse
    const cle = cleDeReponse(reponse)
    for (const observation of observationsDePreuve) {
      if (cle === null) observation.inerte = false
      observation.reponses.push({ nature, args, cle })
    }
    return reponse
  }
  const lecture = (f) => {
    noter(requetesDeLecture.get(f) ?? requetesDeLecture.set(f, requeteDe('lecture', f)).get(f))
    const lu = lectureDe(f)
    return observerReponse('lecture', [f], lu)
  }
  const cible = (f, spec) => { noter(requeteDe('cible', f, spec)); return observerReponse('cible', [f, spec], cibleDe(f, spec)) }
  const peutLire = (f) => { noter(requeteDe('peutLire', f)); return observerReponse('peutLire', [f], peutLireDe(f)) }
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
  const relais = new Map()
  const atteintes = new Map()

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

  const preuvesBooleennes = new Map()
  const clesDesEntreesBooleennes = new WeakMap()
  const booleenDe = (e, ctx) => {
    const calculer = () => {
      stade('prédicat', ctx.f)
      const vs = valeurs(e, { ...ctx, preuveBooleenne: true })
      return vs.length && vs.every((v) => 'booleen' in v && v.booleen === vs[0].booleen) ? vs[0].booleen : null
    }
    if (ferme) return calculer()
    const entree = { e, ctx, pile: [...pile] }
    const cle = cleCanonique(({ referenceDe }) => referenceDe(entree), entree, clesDesEntreesBooleennes, 'cellules')
    if (cle === null) return calculer()
    const deja = preuvesBooleennes.get(cle)
    if (deja && deja.reponses.every(({ nature, args, cle: avant }) => {
      const reponse = nature === 'lecture' ? lecture(...args) : nature === 'cible' ? cible(...args) : peutLire(...args)
      return cleDeReponse(reponse) === avant
    }) && cleCanonique(({ referenceDe }) => referenceDe(entree), entree, clesDesEntreesBooleennes, 'cellules') === cle) {
      fusionner(deja.requetes)
      return deja.resultat
    }
    const observation = { inerte: true, reponses: [] }
    observationsDePreuve.push(observation)
    let preuve
    try { preuve = tracer(() => memoisable(calculer)) } finally { observationsDePreuve.pop() }
    const { resultat: { resultat, stable }, requetes } = preuve
    if (stable && observation.inerte && (typeof resultat === 'boolean' || resultat === null) &&
      cleCanonique(({ referenceDe }) => referenceDe(entree), entree, clesDesEntreesBooleennes, 'cellules') === cle)
      preuvesBooleennes.set(cle, { resultat, requetes, reponses: observation.reponses })
    return resultat
  }
  const gardePossible = (e, ctx) => {
    const b = booleenDe(e.condition, ctx)
    return b === null || b === e.attendu
  }
  const expressionsLiees = (selectionner, e, ctx) => selectionner(e, ctx).map((de) => ({ k: 'lie', de, ctx }))
  const collectionsDAppel = (e, ctx, selectionner) => {
    const args = e.args.map((a) => argumentDe(a, ctx))
    const selection = (r, contexte) => expressionsLiees(selectionner, r, contexte)
    return valeurs(e.cible, ctx).flatMap((c) => {
      const rendus = 'fn' in c ? retour(c.fn, args, selection) : 'lambda' in c ? rendusDeLambda(c, e.texte, args, selection) : [e]
      return rendus.map((r) => 'non' in r ? { k: 'non', raison: r.non } : r)
    })
  }
  const collectionsDeChamp = (e, ctx, selectionner) => valeurs(e.de, ctx).flatMap((o) => {
    if ('objet' in o && Object.hasOwn(o.objet, e.nom)) return expressionsLiees(selectionner, o.objet[e.nom], o.ctx)
    if ('objet' in o && o.etales) return o.etales.flatMap((de) => collectionsDeChamp({ ...e, de }, o.ctx, selectionner))
    if (('objet' in o || 'absent' in o) && e.defaut) return selectionner(e.defaut, ctx)
    return [{ k: 'non', raison: 'non' in o ? o.non : `collection propriété ${e.texte}` }]
  })
  const formeLiee = (e, ctx) => {
    if (e.k !== 'param' && e.k !== 'paramLambda') return null
    let env = ctx.env
    while (env && env.fn !== e.fn) env = env.parent
    if (!env?.args) return null
    const fonctions = e.k === 'paramLambda' ? null : lecture(ctx.f)?.fonctions
    const decl = e.k === 'paramLambda' ? env.params?.[e.index] : fonctions && Object.hasOwn(fonctions, e.fn) ? fonctions[e.fn]?.params[e.index] : null
    if (decl?.reste) return { e: { k: 'liste', v: env.args.slice(e.index).map((a) => {
      const forme = formesDesArguments.get(a)
      return forme ? { k: 'lie', de: forme.e, ctx: forme.ctx } : { k: 'non', raison: 'forme d’argument restant indéterminée' }
    }) }, ctx }
    const forme = formesDesArguments.get(env.args[e.index])
    if (forme) return forme
    return decl?.defaut ? { e: decl.defaut, ctx: { ...ctx, env } } : null
  }
  const collectionsOpaquesDe = (de, ctx) => {
    const forme = formeLiee(de, ctx)
    return forme ? expressionsLiees(collectionsOpaquesDe, forme.e, forme.ctx)
    : de.k === 'collection' || de.k === 'repertoire' ? []
    : de.k === 'aplatir' ? []
    : de.k === 'liste' ? de.v.flatMap((x) => x.k === 'etale' ? collectionsOpaquesDe(x.de, ctx) : [])
    : de.k === 'lie' ? expressionsLiees(collectionsOpaquesDe, de.de, de.ctx)
    : de.k === 'appel' ? collectionsDAppel(de, ctx, collectionsOpaquesDe)
    : de.k === 'champ' ? collectionsDeChamp(de, ctx, collectionsOpaquesDe)
    : de.k === 'garde' ? (gardePossible(de, ctx) ? collectionsOpaquesDe(de.de, ctx) : [])
    : de.k === 'union' ? de.v.flatMap((x) => collectionsOpaquesDe(x, ctx))
    : de.k === 'projection' ? collectionsOpaquesDe(de.de, ctx)
    : [de]
  }
  const elementsDe = (de, ctx) => {
    const forme = formeLiee(de, ctx)
    return forme ? expressionsLiees(elementsDe, forme.e, forme.ctx)
    : de.k === 'collection' ? [de.element]
    : de.k === 'repertoire' ? elementsDe(repertoireDe(de, ctx), ctx)
    : de.k === 'aplatir' ? aplatirDe(de, ctx)
    : de.k === 'liste' ? de.v.flatMap((x) => x.k === 'etale' ? elementsDe(x.de, ctx) : [x])
    : de.k === 'lie' ? expressionsLiees(elementsDe, de.de, de.ctx)
    : de.k === 'appel' ? collectionsDAppel(de, ctx, elementsDe)
    : de.k === 'champ' ? collectionsDeChamp(de, ctx, elementsDe)
    : de.k === 'garde' ? (gardePossible(de, ctx) ? elementsDe(de.de, ctx) : [])
    : de.k === 'union' ? de.v.flatMap((x) => elementsDe(x, ctx))
    : de.k === 'projection' ? (elementsDe(de.de, ctx).length ? [...(de.aplatie ? de.v.flatMap((x) => elementsDe(x, ctx)) : de.v), ...collectionsOpaquesDe(de.de, ctx)] : [])
    : [de]
  }
  const aplatirDe = (e, ctx) => {
    const profondeur = valeurs(e.profondeur, ctx)
    if (profondeur.length !== 1 || profondeur[0].scalaire !== '1') return [{ k: 'non', raison: 'profondeur flat non prouvée' }]
    const descendre = (de, c) => {
      const forme = formeLiee(de, c)
      if (forme) return expressionsLiees(descendre, forme.e, forme.ctx)
      if (de.k === 'lie') return expressionsLiees(descendre, de.de, de.ctx)
      if (de.k === 'union') return de.v.some((x) => x.k === 'non' && /réaffectée/.test(x.raison)) ? [{ k: 'non', raison: 'méthode flat mutée' }] : de.v.flatMap((x) => descendre(x, c))
      if (de.k === 'appel') return collectionsDAppel(de, c, (x, contexte) => descendre(x, contexte))
      if (de.k === 'liste' || de.k === 'collection') return elementsDe(de, c).flatMap((x) => niveau(x, c))
      return [{ k: 'non', raison: 'receveur flat non prouvé' }]
    }
    const niveau = (de, c) => {
      const forme = formeLiee(de, c)
      if (forme) return expressionsLiees(niveau, forme.e, forme.ctx)
      if (de.k === 'lie') return expressionsLiees(niveau, de.de, de.ctx)
      if (de.k === 'union') return de.v.flatMap((x) => niveau(x, c))
      if (de.k === 'appel') return collectionsDAppel(de, c, niveau)
      return de.k === 'liste' || de.k === 'collection' ? elementsDe(de, c) : [de]
    }
    return descendre(e.de, ctx)
  }
  const repertoireDe = (e, ctx) => {
    let types = false
    if (e.options) {
      const vs = valeurs(e.options, ctx)
      if (vs.length !== 1) return { k: 'non', raison: 'options readdirSync indéterminées' }
      const o = vs[0]
      if ('texte' in o) {
        if (o.texte === 'buffer') return { k: 'non', raison: 'noms readdirSync Buffer' }
      } else if ('objet' in o) {
        const lire = (nom) => Object.hasOwn(o.objet, nom) ? valeurs(o.objet[nom], o.ctx) : [{ absent: true }]
        const enc = lire('encoding')
        if (enc.some((x) => x.texte === 'buffer')) return { k: 'non', raison: 'noms readdirSync Buffer' }
        if (enc.some((x) => !('texte' in x) && !('absent' in x))) return { k: 'non', raison: 'encodage readdirSync indéterminé' }
        const wt = lire('withFileTypes')
        if (wt.some((x) => !('booleen' in x) && !('absent' in x)) || o.etales?.length) return { k: 'non', raison: 'options readdirSync indéterminées' }
        types = wt.some((x) => x.booleen === true)
      } else return { k: 'non', raison: 'options readdirSync indéterminées' }
    }
    const nom = { k: 'fragment', de: e.de }
    return { k: 'collection', element: types ? { k: 'objet', v: { name: nom }, partiel: true } : nom }
  }
  const basesDuDepot = (depots, origine) => depots.flatMap((d) => {
    if ('poignee' in d && d.options.length) return [couverture(origine, 'options de poignée sans hôte prouvé')]
    return ('poignee' in d ? d.poignee : [d]).map((base) => {
      const b = 'texte' in base ? ancrer(base.texte) : base
      return 'chemin' in b && !b.chemin ? b : couverture(origine, 'dépôt sans racine prouvée')
    })
  })
  const argumentDe = (e, ctx) => {
    const vs = valeurs(e, ctx).map((v) => 'objet' in v ? { ...v, preuveDirecte: e.objetDirect === true && e.k === 'objet' && !e.etales?.length } : v)
    formesDesArguments.set(vs, formeLiee(e, ctx) ?? { e, ctx })
    return vs
  }
  const argumentDElement = (e, ctx) => e.k === 'lie' ? argumentDElement(e.de, e.ctx)
    : e.k === 'liste' ? [{ non: 'élément de rappel non scalaire' }] : argumentDe(e, ctx)
  const chaineDe = (e, ctx) => {
    const forme = formeLiee(e, ctx)
    if (forme) return chaineDe(forme.e, forme.ctx)
    if (e.k === 'appel') return valeurs(e.cible, ctx).flatMap((c) => 'fn' in c ? retour(c.fn, e.args.map((a) => argumentDe(a, ctx)), chaineDe)
      : 'lambda' in c ? rendusDeLambda(c, e.texte, e.args.map((a) => argumentDe(a, ctx)), chaineDe) : [{ non: `appel ${e.texte}` }])
    if (e.k === 'champ') return collectionsDeChamp(e, ctx, (de) => [de]).flatMap((de) => chaineDe(de, ctx))
    return e.k === 'liste' || e.k === 'objet' ? [{ non: 'conversion String non scalaire' }]
    : e.k === 'lie' ? chaineDe(e.de, e.ctx)
    : e.k === 'garde' ? (gardePossible(e, ctx) ? chaineDe(e.de, ctx) : [])
    : e.k === 'union' ? uniques(e.v.flatMap((x) => chaineDe(x, ctx)))
    : e.k === 'elementItere' ? uniques(elementsDe(e.de, ctx).flatMap((x) => chaineDe(x, ctx)))
    : valeurs(e, ctx).map((v) => 'texte' in v || 'chemin' in v || 'espace' in v || 'fragment' in v || 'couvertureCorpusEntier' in v ? v
      : 'booleen' in v ? { texte: String(v.booleen) } : 'scalaire' in v ? { texte: v.scalaire }
        : 'non' in v ? v.non === VALEUR_NULLE ? { non: 'conversion String de valeur nulle' } : v
          : 'relais' in v ? v : { non: 'conversion String non scalaire' })
  }

  /** Évalue `e` dans le module `ctx.f`, paramètres de `ctx.env.fn` liés à `ctx.env.args` (null : relais). */
  function valeurs(e, ctx) {
    switch (e.k) {
      case 'lie': return valeurs(e.de, e.ctx)
      case 'booleen': return [{ booleen: e.v }]
      case 'scalaire': return [{ scalaire: e.v }]
      case 'native': return [{ native: e.nom }]
      case 'negation': {
        const b = booleenDe(e.de, ctx)
        return b === null ? [{ non: 'booléen indécidable' }] : [{ booleen: !b }]
      }
      case 'garde': return gardePossible(e, ctx) ? valeurs(e.de, ctx) : []
      case 'chaine': return chaineDe(e.de, ctx)
      case 'lit': return [{ texte: e.v }]
      case 'chemin': return [borne(posix.normalize(e.v || '.'))]
      case 'hors': return [{ hors: true }]
      case 'espace': return [{ espace: e.racine, cheminExterne: e.chemin }]
      case 'couverture': return [couverture(e.origine, e.raison)]
      case 'temporaire': return valeurs(e.prefixe, ctx).map((v) => {
        if ('espace' in v) return { ...v, cheminExterne: posix.dirname(v.cheminExterne || '.') }
        const prefixe = 'texte' in v ? ancrer(v.texte) : v
        return 'chemin' in prefixe ? couverture(`corpus:${prefixe.chemin || '.'}`, 'suffixe aléatoire mkdtempSync') : prefixe
      })
      case 'fragment': return valeurs(e.de, ctx).map((base) => ({ fragment: 'texte' in base ? ancrer(base.texte) : base }))
      case 'collection': return valeurs(e.element, ctx)
      case 'reste': return ctx.env?.args?.slice(e.index).flat() ?? [{ non: 'arguments restants inconnus' }]
      case 'repertoire': return valeurs(repertoireDe(e, ctx), ctx)
      case 'aplatir': return uniques(aplatirDe(e, ctx).flatMap((de) => valeurs(de, ctx)))
      case 'poignee': return [{ poignee: argumentDe(e.de, ctx), options: ctx.env?.args?.slice(1) ?? [], origine: e.origine }]
      case 'racineGit': return valeurs(e.de, ctx).map((v) => couverture(e.origine, `racine contenant le dépôt : ${texteDeCle(cleDe(v))}`))
      case 'imageGit': {
        const args = ctx.env?.args
        const depots = args?.[e.porte.depot] ?? [{ non: 'dépôt inconnu' }]
        const image = args?.[1] ?? [{ non: 'image inconnue' }]
        const chemins = e.porte.chemins === 'reste' ? args?.slice(e.porte.depuis).flat() ?? [] : args?.[e.porte.depuis] ?? []
        return basesDuDepot(depots, e.origine).flatMap((b) => {
          if (!('chemin' in b)) return [b]
          if (image.some((x) => !('texte' in x))) return [couverture(e.origine, 'image indéterminée')]
          const cs = chemins.length ? chemins : [{ texte: '' }]
          return cs.map((c) => 'texte' in c && 'chemin' in ancrer(c.texte) && !/[*?[:]/.test(c.texte) ? { chemin: prefixeDeMotif(c.texte), sous: `image Git : ${image.map((v) => texteDeCle(cleDe(v))).join(',')}` } : couverture(e.origine, `pathspec indéterminé : ${texteDeCle(cleDe(c))}`))
        })
      }
      case 'non': return [{ non: e.raison }]
      case 'transforme': return [{ non: e.raison }]
      case 'liste': case 'union': return uniques(e.v.flatMap((x) => valeurs(x, ctx)))
      case 'projection': return uniques(e.v.flatMap((x) => valeurs(x, ctx)))
      case 'etale': return valeurs(e.de, ctx)
      case 'elementItere': return uniques(elementsDe(e.de, ctx).flatMap((x) => valeurs(x, ctx)))
      case 'projectionRappel': {
        const rappels = valeurs(e.cible, ctx)
        const rendu = elementsDe(e.de, ctx).flatMap((x) => rappels.flatMap((c) => 'native' in c && c.native === 'String' ? chaineDe(x, ctx)
          : 'fn' in c ? retour(c.fn, [argumentDElement(x, ctx)])
            : 'lambda' in c ? rendusDeLambda(c, e.texte, [argumentDElement(x, ctx)]) : [{ non: `rappel ${e.texte} non résolu` }]))
        return uniques([...rendu, ...collectionsOpaquesDe(e.de, ctx).flatMap((x) => valeurs(x, ctx))])
      }
      case 'importe': return importe(ctx.f, e.spec, e.nom)
      case 'fn': return [{ fn: { f: ctx.f, id: e.id } }]
      case 'lambda': {
        const lexique = lecture(ctx.f)?.lambdas
        const definition = lexique && Object.hasOwn(lexique, e.id) ? lexique[e.id] : null
        return definition ? [{ lambda: definition, ctx }] : [{ non: `fonction anonyme ${e.id} absente` }]
      }
      case 'objet': return [{ objet: e.v, ctx, preuveDirecte: e.objetDirect === true && !e.etales?.length, ...(e.etales ? { etales: e.etales } : {}), ...(e.ferme ? { ferme: true } : {}), ...(e.partiel ? { partiel: true } : {}) }]
      case 'paramLambda': {
        let env = ctx.env
        while (env && env.fn !== e.fn) env = env.parent
        if (!env?.args) return [{ non: `paramètre ${e.nom}` }]
        const arg = env.args[e.index]
        const decl = env.params?.[e.index]
        if (decl?.reste) return env.args.slice(e.index).flat()
        return (arg ?? (decl?.defaut ? valeurs(decl.defaut, { ...ctx, env }) : [{ non: `paramètre ${e.nom}` }])).map((v) => e.mute && 'objet' in v ? { ...v, preuveDirecte: false } : v)
      }
      case 'param': {
        let env = ctx.env
        while (env && env.fn !== e.fn) env = env.parent
        if (!env) return [{ non: `paramètre ${e.nom}` }]
        if (env !== ctx.env) return valeurs(e, { ...ctx, env })
        if (!ctx.env.args) return [{ relais: `${ctx.f}#${e.fn}` }]
        const fonctions = lecture(ctx.f)?.fonctions
        const decl = fonctions && Object.hasOwn(fonctions, e.fn) ? fonctions[e.fn]?.params[e.index] : null
        if (decl?.reste) return ctx.env.args.slice(e.index).flat()
        const defaut = () => decl?.defaut ? valeurs(decl.defaut, ctx) : [{ absent: true }]
        const arg = ctx.env.args[e.index]
        return uniques((arg ? arg.flatMap((v) => 'absent' in v ? defaut() : [v]) : defaut()).map((v) => e.mute && 'objet' in v ? { ...v, preuveDirecte: false } : v))
      }
      case 'indice': {
        const selectionner = (de, contexte = ctx) => formeLiee(de, contexte) ? selectionner(formeLiee(de, contexte).e, formeLiee(de, contexte).ctx)
          : de.k === 'appel' ? valeurs(de.cible, contexte).flatMap((c) => 'fn' in c ? retour(c.fn, de.args.map((a) => argumentDe(a, contexte)), selectionner) : [{ non: `déstructuration de tableau ${e.texte}` }])
          : de.k === 'liste' ? (de.v[e.nom] && !(de.v[e.nom].k === 'non' && de.v[e.nom].raison === 'forme OmittedExpression') ? valeurs(de.v[e.nom], contexte) : e.defaut ? valeurs(e.defaut, contexte) : [{ absent: true }])
          : de.k === 'lie' ? selectionner(de.de, de.ctx)
          : de.k === 'union' ? uniques(de.v.flatMap((x) => selectionner(x, contexte)))
          : de.k === 'garde' ? (gardePossible(de, contexte) ? selectionner(de.de, contexte) : [])
          : de.k === 'elementItere' ? uniques(elementsDe(de.de, contexte).flatMap((x) => selectionner(x, contexte)))
          : [{ non: `déstructuration de tableau ${e.texte}` }]
        return selectionner(e.de)
      }
      case 'champ': return valeurs(e.de, ctx).flatMap((o) => ctx.preuveBooleenne && 'objet' in o && !o.preuveDirecte ? [{ non: `option ${e.texte} indécidable` }]
        : 'objet' in o && Object.hasOwn(o.objet, e.nom) ? valeurs(o.objet[e.nom], o.ctx)
        : 'objet' in o && o.etales ? uniques(o.etales.flatMap((x) => valeurs({ k: 'champ', de: x, nom: e.nom, texte: e.texte }, o.ctx))
          .flatMap((v) => 'absent' in v && e.defaut ? valeurs(e.defaut, ctx) : [v]))
        : 'objet' in o && (o.ferme || o.partiel) ? [{ non: `propriété ${e.texte}` }]
        : 'objet' in o || 'absent' in o ? (e.defaut ? valeurs(e.defaut, ctx) : [{ absent: true }])
        : 'non' in o || 'relais' in o || 'hors' in o ? [o] : [{ non: `propriété ${e.texte}` }])
      case 'appel': {
        const args = e.args.map((a) => argumentDe(a, ctx))
        return valeurs(e.cible, ctx).flatMap((c) => 'fn' in c && `${c.fn.f}#${c.fn.id}` === DOSSIER_GIT
          ? (e.args[0] ? valeurs({ k: 'join', v: [e.args[0], { k: 'lit', v: '.git' }] }, ctx) : [{ non: 'argument absent' }])
          : 'fn' in c ? retour(c.fn, args) : 'lambda' in c ? rendusDeLambda(c, e.texte, args)
          : 'relais' in c ? [c] : [{ non: `appel ${e.texte}` }])
      }
      case 'dir': return valeurs(e.v, ctx).map((v) => 'espace' in v ? parentExterne(v) : 'chemin' in v ? borne(posix.dirname(v.chemin || '.')) : 'texte' in v ? { texte: posix.dirname(v.texte) } : v)
      case 'join': case 'resolve': case 'concat': {
        const lier = e.k === 'concat' ? concatener : (a, s) => joindre(a, s, e.k === 'resolve')
        let acc = [{ texte: '' }]
        for (const partie of e.v) {
          const suite = valeurs(partie, ctx)
          const absente = suite.find((x) => 'absent' in x)
          const presente = suite.some((x) => !('absent' in x))
          const vus = new Map()
          for (const a of acc) {
            if ('couvertureCorpusEntier' in a || suite.some((x) => 'couvertureCorpusEntier' in x)) {
              for (const x of suite) for (const v of [a, x])
                if (['couvertureCorpusEntier', 'non', 'relais', 'absent'].some((k) => k in v)) vus.set(cleDe(v), v)
              continue
            }
            if (['relais', 'non', 'absent'].some((k) => k in a)) {
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

  const contexteDeLambda = ({ lambda, ctx }, args) => ({ f: ctx.f, env: { fn: lambda.id, args, params: lambda.params, parent: ctx.env } })
  /** Les valeurs rendues par une fonction ANONYME (`lambda`), évaluées dans le contexte qui l'a définie : ses
   *  variables capturées s'y lient ; ses propres paramètres se lient à `args`. */
  const rendusDeLambda = (c, texte, args, transformer = valeurs) => sousPile(`retour ${c.ctx.f}#${c.lambda.id}`, args, c.ctx.env?.fn ?? c.lambda.id, () => c.lambda.retours.length
    ? uniques(c.lambda.retours.flatMap((x) => transformer(x, contexteDeLambda(c, args)))) : [{ non: `appel ${texte} sans retour` }])
  const lecturesDeLambda = (c, args) => sousPile(`lambda ${c.ctx.f}#${c.lambda.id}`, args, c.lambda.id, () => uniques(c.lambda.sites.flatMap((site) => lecturesDuSite(c.ctx.f, site, contexteDeLambda(c, args).env))))

  /** Borne la pile d'appels de la fonction `fonction` (`<nature> <module>#<nom>`) aux arguments `args`. Un appel
   *  déjà en cours AUX MÊMES arguments, une `REENTREES`+1-ième ré-entrée à d'autres arguments et la profondeur
   *  rendent un `non` nommé. Chacun dépend de la pile qui l'a vu (`dependre`). Un cycle se nomme par ses fonctions, triées : il porte le même nom quel
   *  que soit l'appel par lequel on y entre. */
  const sousPile = (fonction, args, nom, faire) => {
    let cle = ferme ? undefined : composerCle(fonction, '(', cleDesArgs(args), ')')
    const enCoursAuxMemes = pile.findIndex((p) => {
      if (!ferme) return p.cle === cle
      if (p.fonction !== fonction) return false
      cle ??= composerCle(fonction, '(', cleDesArgs(args), ')')
      p.cle ??= composerCle(p.fonction, '(', cleDesArgs(p.args), ')')
      return p.cle === cle
    })
    const cycle = (depuis) => {
      dependre(depuis)
      return [{ non: `cycle d'appels ${[...new Set(pile.slice(depuis).map((p) => p.nom))].sort().join(', ')}` }]
    }
    if (enCoursAuxMemes >= 0) return cycle(enCoursAuxMemes)
    if (pile.filter((p) => p.fonction === fonction).length > REENTREES) return cycle(pile.findIndex((p) => p.fonction === fonction))
    if (pile.length >= PROFONDEUR_D_APPELS) {
      dependre(0)
      return [{ non: `profondeur d'appels > ${PROFONDEUR_D_APPELS} (${nom})` }]
    }
    pile.push(ferme ? { fonction, cle, nom, args } : { fonction, cle, nom })
    try { return faire() } finally { pile.pop() }
  }

  const retoursRacines = new Map()
  const retoursSousCadre = new WeakMap()
  const retour = (fn, args, transformer = valeurs) => sousPile(`retour ${fn.f}#${fn.id}`, args, fn.id, () => {
    if (!ferme) return calculerRetour(fn, args, transformer)
    const parent = pile.at(-2)
    let magasin = retoursRacines
    if (parent) {
      if (!retoursSousCadre.has(parent)) retoursSousCadre.set(parent, new Map())
      magasin = retoursSousCadre.get(parent)
    }
    const fonction = `${fn.f}#${fn.id}`
    if (!magasin.has(fonction)) magasin.set(fonction, new WeakMap())
    const transformeurs = magasin.get(fonction)
    if (!transformeurs.has(transformer)) transformeurs.set(transformer, new Map())
    const memo = transformeurs.get(transformer)
    const cle = cleDesArgs(args)
    const dejaRetour = memo.get(cle)
    if (dejaRetour) {
      fusionner(dejaRetour.requetes)
      return dejaRetour.rendu
    }
    const { resultat: { resultat: rendu, stable }, requetes } = tracer(() => memoisable(() => calculerRetour(fn, args, transformer)))
    if (stable) memo.set(cle, { rendu, requetes })
    return rendu
  })
  const calculerRetour = (fn, args, transformer) => {
    stade('retour', fn.f)
    const fonctions = lecture(fn.f)?.fonctions
    const decl = fonctions && Object.hasOwn(fonctions, fn.id) ? fonctions[fn.id] : null
    if (!decl) return [{ non: `fonction ${fn.id} illisible` }]
    if (decl.contrat?.retour) return transformer(decl.contrat.retour, { f: fn.f, env: { fn: fn.id, args } })
    if (decl.contrat?.namespace) {
      const rendu = { k: 'espace', racine: `${fn.f}#${fn.id}:${decl.contrat.namespace}`, chemin: '' }
      return decl.contrat.champ ? transformer({ k: 'objet', v: { [decl.contrat.champ]: rendu } }, { f: fn.f, env: null }) : transformer(rendu, { f: fn.f, env: null })
    }
    if (!decl.retours.length) return [{ non: `${fn.id} sans retour` }]
    return decl.retours.flatMap((r) => transformer(r, { f: fn.f, env: { fn: fn.id, args } }))
  }

  /** Les racines lues par la fonction `fn`, paramètres liés à `args` ; `args` null : marqueurs `relais`. */
  const lecturesDe = (fn, args) => {
    const memo = args ? lies : libres
    const cle = composerCle(`${fn.f}#${fn.id}`, cleDesArgs(args))
    const deja = memo.get(cle)
    if (deja) {
      fusionner(deja.requetes)
      return deja.rendu
    }
    const { resultat: { resultat: rendu, stable }, requetes } = tracer(() => memoisable(() => sousPile(`lectures ${fn.f}#${fn.id}`, args, fn.id, () => {
      const lu = lecture(fn.f)
      if (!lu) return [{ non: `module ${fn.f} illisible` }]
      if (Object.hasOwn(lu.fonctions, fn.id) && lu.fonctions[fn.id]?.contrat?.lectures === 'corpus') return [couverture(`${fn.f}#${fn.id}`, 'résumé de lecture déclaré à la source')]
      return uniques(lu.sites.filter((s) => s.dans === fn.id).flatMap((s) => lecturesDuSite(fn.f, s, { fn: fn.id, args })))
    })))
    if (stable) memo.set(cle, { rendu, requetes })
    return rendu
  }

  // #2001
  const atteintLecture = (fn) => {
    const cle = `${fn.f}#${fn.id}`
    const deja = atteintes.get(cle)
    if (deja) {
      fusionner(deja.requetes)
      return deja.oui
    }
    const { resultat: graphe, requetes } = tracer(() => {
      const sommets = new Map()
      const aLire = []
      const sommetDe = (cible) => {
        const identite = `${cible.f}#${cible.id}`
        if (!sommets.has(identite)) {
          sommets.set(identite, { fn: cible, parents: new Set(), oui: false })
          aLire.push(identite)
        }
        return identite
      }
      sommetDe(fn)
      for (let i = 0; i < aLire.length; i++) {
        const identite = aLire[i]
        const sommet = sommets.get(identite)
        if (!peutLire(sommet.fn.f)) continue
        const lu = lecture(sommet.fn.f)
        if (!lu || !Object.hasOwn(lu.fonctions, sommet.fn.id) || !lu.fonctions[sommet.fn.id]) { sommet.oui = true; continue }
        if (lu.fonctions[sommet.fn.id].contrat?.lectures === 'corpus') { sommet.oui = true; continue }
        for (const site of lu.sites.filter((s) => s.dans === sommet.fn.id)) {
          if (site.lecture) { sommet.oui = true; continue }
          const cibles = valeurs(site.cible, { f: sommet.fn.f, env: null })
          if (site.cible.k !== 'param' && (!cibles.length || cibles.some((c) => !('fn' in c)))) sommet.oui = true
          for (const cible of cibles.filter((c) => 'fn' in c)) sommets.get(sommetDe(cible.fn)).parents.add(identite)
        }
      }
      const positives = [...sommets].filter(([, sommet]) => sommet.oui).map(([identite]) => identite)
      for (let i = 0; i < positives.length; i++) {
        for (const parent of sommets.get(positives[i]).parents) {
          const sommet = sommets.get(parent)
          if (sommet.oui) continue
          sommet.oui = true
          positives.push(parent)
        }
      }
      return sommets
    })
    for (const [identite, sommet] of graphe) atteintes.set(identite, { oui: sommet.oui, requetes })
    return atteintes.get(cle).oui
  }

  /** La fonction est-elle un RELAIS : un de ses paramètres alimente-t-il une lecture ? Une fonction déjà en
   *  cours d'évaluation est supposée relais : ses lectures liées s'évaluent, et une boucle s'y nomme (`sousPile`).
   *  Une lecture COUPÉE (`COUPE`) ne tranche pas : supposée relais, la coupe se nomme au site qui l'appelle. Toute
   *  coupe répute relais : un « non » n'est jamais l'effet de la pile qui l'a vu, et la réponse se mémoïse. */
  const estRelais = (fn) => {
    const cle = `${fn.f}#${fn.id}`
    const fonctions = lecture(fn.f)?.fonctions
    if (fonctions && Object.hasOwn(fonctions, fn.id) && fonctions[fn.id]?.contrat?.lectures === 'corpus') return true
    if (!atteintLecture(fn)) return false
    const deja = relais.get(cle)
    if (deja) {
      fusionner(deja.requetes)
      return deja.oui
    }
    if (enCours.has(cle)) return true
    enCours.add(cle)
    try {
      const { resultat: oui, requetes } = tracer(() => lecturesDe(fn, null).some((v) => 'relais' in v || ('non' in v && COUPE.test(v.non))))
      relais.set(cle, { oui, requetes })
      return oui
    } finally { enCours.delete(cle) }
  }

  /** Les racines d'un site : la lecture elle-même, ou celles du relais appelé avec ses arguments. */
  function lecturesDuSite(f, site, env) {
    const fonctions = env && lecture(f)?.fonctions
    if (fonctions && Object.hasOwn(fonctions, env.fn) && fonctions[env.fn]?.contrat?.lectures === 'corpus') return [couverture(`${f}#${env.fn}`, 'résumé de lecture déclaré à la source')]
    const ctx = { f, env }
    const arg = (i) => site.args[i] ? valeurs(site.args[i], ctx) : [{ chemin: '' }]
    if (site.lecture) {
      const porte = PORTES_GIT[site.lecture]
      if (porte) {
        const chemins = porte.chemins === 'reste'
          ? (site.args.length > porte.depuis ? site.args.slice(porte.depuis).flatMap((a) => valeurs(a, ctx)) : [{ texte: '' }])
          : (site.args[porte.depuis] ? valeurs(site.args[porte.depuis], ctx) : [{ non: 'chemins absents' }])
        const depots = basesDuDepot(arg(porte.depot), `${f}#${site.lecture}`)
        return finir(depots.flatMap((d) => 'chemin' in d ? chemins.map((c) => 'texte' in c && !('chemin' in ancrer(c.texte)) ? couverture(`${f}#${site.lecture}`, 'pathspec hors borne') : joindre(d, c)) : [d]))
      }
      if (!site.args[0]) return [{ non: 'argument absent' }]
      if (!GLOBS.has(site.lecture)) return finir(arg(0))
      const cwd = site.args[1]
        ? valeurs({ k: 'champ', de: site.args[1], nom: 'cwd', texte: 'cwd' }, ctx).map((v) => 'absent' in v ? { chemin: '' } : v)
        : [{ chemin: '' }]
      return finir(cwd.flatMap((c) => arg(0).map((m) => 'texte' in m ? joindre(c, { texte: prefixeDeMotif(m.texte) }) : m)))
    }
    const cibles = valeurs(site.cible, ctx)
    if (site.cible.k === 'param' && !cibles.some((c) => 'lambda' in c)) return []
    const relaisNomme = cibles.some((c) => 'fn' in c && estRelais(c.fn))
    if (!relaisNomme && !cibles.some((c) => 'lambda' in c || 'relais' in c) && !site.args.some((a) => ['lambda', 'param', 'paramLambda'].includes(a.k))) return []
    const args = site.args.map((a) => argumentDe(a, ctx))
    const callbackLecteur = args.flat().some((c) => 'lambda' in c && c.lambda.sites.some((s) => s.lecture || valeurs(s.cible, c.ctx).some((v) => 'fn' in v && atteintLecture(v.fn))))
    return cibles.flatMap((c) => 'fn' in c ? (estRelais(c.fn) || callbackLecteur ? finir(lecturesDe(c.fn, args)) : [])
      : 'lambda' in c ? finir(lecturesDeLambda(c, args)) : 'relais' in c ? [c] : [])
  }

  const finir = (vals) => uniques(vals).filter((v) => !('absent' in v))
    .map(racineFinale)

  const evaluerSite = (f, site) => {
    const vals = finir(lecturesDuSite(f, site, site.dans ? { fn: site.dans, args: null } : null))
    if (!vals.length) return null
    return { ligne: site.ligne, appel: site.appel, relais: vals.some((v) => 'relais' in v), valeurs: vals.filter((v) => !('relais' in v)) }
  }

  return {
    ...(ferme ? { siteDe: (f, index) => evaluerSite(f, lecture(f).sites[index]) } : {}),
    /** Les sites de lecture d'un module et leurs racines ; un site RELAIS (racine liée à un paramètre de
     *  sa fonction) rend `relais: true`, ses racines se lisent chez ses appelants. */
    sitesDe(f) {
      const lu = lecture(f)
      if (!lu) return []
      const rendus = []
      for (const site of lu.sites) {
        const rendu = evaluerSite(f, site)
        if (rendu) rendus.push(rendu)
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

function joindre(a, s, absoluRemplace = false) {
  if ('couvertureCorpusEntier' in a || 'couvertureCorpusEntier' in s) return 'couvertureCorpusEntier' in a ? a : s
  if ('poignee' in a || 'poignee' in s) return { non: 'poignée de dépôt non chemin' }
  if ('relais' in a || 'relais' in s) return 'relais' in a ? a : s
  if ('non' in a && 'espace' in s) return couverture(s.espace, a.non)
  if ('non' in s && 'espace' in a) return couverture(a.espace, s.non)
  if ('non' in a) return a
  if ('absent' in a || 'absent' in s) return 'absent' in a ? a : s
  if ('fragment' in s) {
    const base = 'texte' in a ? ancrer(a.texte) : a
    return JSON.stringify(s.fragment) === JSON.stringify(base) ? couverture('espace' in base ? base.espace : `corpus:${base.chemin || '.'}`, 'descente par fragment de namespace susceptible de lien') : { non: 'fragment de répertoire hors de sa base' }
  }
  if ('espace' in a) {
    if (!('texte' in s)) return couverture(a.espace, 'suffixe externe indéterminé')
    if (/^([a-zA-Z]:)?[\\/]/.test(s.texte)) return couverture(a.espace, `chemin absolu ${s.texte}`)
    const cheminExterne = posix.join(a.cheminExterne || '.', s.texte.replace(/\\/g, '/'))
    return cheminExterne === '..' || cheminExterne.startsWith('../') ? couverture(a.espace, 'sortie du namespace externe') : { ...a, cheminExterne }
  }
  if ('espace' in s) return 'texte' in a && !a.texte ? s : couverture(s.espace, 'namespace externe recomposé')
  if ('hors' in a || 'hors' in s) return { non: 'origine extérieure sans borne' }
  if ('non' in s) {
    const prefixe = 'chemin' in a ? a : a.texte ? ancrer(a.texte) : null
    return prefixe && 'chemin' in prefixe ? couverture(`corpus:${prefixe.chemin || '.'}`, s.non) : s
  }
  if (['fn', 'objet', 'lambda', 'booleen', 'scalaire', 'native'].some((k) => k in s)) return { non: 'racine non chemin' }
  if ('chemin' in s) return s
  if ('chemin' in a) return /^([a-zA-Z]:)?[\\/]/.test(s.texte) && absoluRemplace ? { non: `chemin absolu ${s.texte}` } : borne(posix.join(a.chemin || '.', s.texte.replace(/\\/g, '/')))
  return { texte: a.texte ? absoluRemplace && /^([a-zA-Z]:)?[\\/]/.test(s.texte) ? s.texte : posix.join(a.texte, s.texte) : s.texte }
}

const parentExterne = (v) => v.cheminExterne && v.cheminExterne !== '.'
  ? { ...v, cheminExterne: posix.dirname(v.cheminExterne) } : couverture(v.espace, 'parent du namespace externe')

const couverture = (origine, raison) => ({ couvertureCorpusEntier: { origine, raison } })

const racineFinale = (v) => 'poignee' in v ? { non: 'poignée de dépôt non chemin' } : 'couvertureCorpusEntier' in v
  ? { chemin: '', sous: `couverture corpus entier : ${v.couvertureCorpusEntier.origine} — ${v.couvertureCorpusEntier.raison}` }
  : 'espace' in v ? v.cheminExterne && v.cheminExterne !== '.' ? racineFinale(couverture(v.espace, 'descente dans namespace susceptible de lien')) : { hors: true }
    : 'fragment' in v ? { non: 'fragment de répertoire sans sa base' }
      : 'texte' in v ? ancrer(v.texte)
        : ['fn', 'objet', 'lambda', 'booleen', 'scalaire', 'native'].some((k) => k in v) ? { non: 'racine non chemin' } : v

/** Concaténation de gabarit : un chemin suivi d'un texte s'y joint, séparateur de tête retiré. */
function concatener(a, s) {
  if (('chemin' in a || 'espace' in a) && 'texte' in s) return joindre(a, { texte: s.texte.replace(/^[\\/]+/, '') })
  if ('texte' in a && 'texte' in s) return { texte: a.texte + s.texte }
  if ('texte' in a && !a.texte) return s
  return joindre(a, s)
}

/**
 * La valeur d'une racine (`Expr`) sans module ni import : chemins POSIX relatifs au dépôt, lieu HORS du
 * dépôt (`{ hors: true }`), ou `{ non: raison }`. Une chaîne nue est relative à la racine du dépôt.
 * @param {Expr} e
 * @param {{ lambdas?: Lecture['lambdas'] }} [options]
 * @returns {Valeur[]}
 */
export function evaluer(e, { lambdas } = {}) {
  const lu = lambdas ? { lambdas, fonctions: {}, exports: {}, sites: [], etoiles: [] } : null
  return evaluateurDuDepot({ lecture: () => lu, cible: () => null }).valeurs(e, { f: '', env: null })
    .filter((v) => !('absent' in v)).map(racineFinale)
}
