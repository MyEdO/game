// Détecteur de consommateurs PAR CHAMP (#903 — « qui lit le champ `spec` sur une référence de
// dotation ? »). Distinct de `entityConsumers.mjs` (qui répond « qui cite cet ID d'entité »,
// consommé par `build-entity-orphans.mjs`) : ici, la question porte sur un CHAMP d'un TYPE de
// donnée structuré (`TrappingRef.spec`), pas sur un id de catalogue.
//
// Le détecteur travaille au VÉRIFICATEUR DE TYPES (`ts.Program`/`TypeChecker`, #1620) — pas au
// texte des annotations. IDENTITÉ PAR SYMBOLE de bout en bout, AUCUN nom n'entre dans un crédit :
// la cible est la DÉCLARATION de type `T` trouvée dans son `home` (`fieldConsumerTargets.mjs`), et
// un homonyme d'un autre module n'est jamais la même déclaration.
//
// DÉFINITION D'UNE LECTURE — un champ `F` du type `T` est LU en un site (`a.F`, `a['F']`, ou un
// élément `{ F }` d'une déstructuration) si les DEUX conditions tiennent :
//   (1) le symbole de propriété résolu au site déclare la MÊME propriété que `T.F` — la déclaration
//       du symbole (unions/intersections/arguments d'alias traversés) est
//       l'une de celles que porte le type déclaré de `T`. Un type ANONYME de même forme
//       (`{ id: string; hidden?: boolean }`) porte SES propres déclarations : il ne crédite rien ;
//   (2) ET la propriété est PROPRE à `T` — déclarée dans le SOUS-ARBRE de la déclaration de `T`, ou
//       dans le shape d'un schéma dont `T` INFÈRE son corps (`type SourceRef =
//       z.infer<typeof sourceRefSchema>` : le `typeof` de la déclaration donne le SYMBOLE du
//       schéma, comparé au SYMBOLE du `const` qui porte le shape — deux symboles, jamais deux noms)
//       — OU le PORTEUR est un `T` : son type DÉCLARÉ (celui de son symbole à SA déclaration, le
//       narrowing du site ignoré) porte la déclaration de `T`, ou l'annotation de sa déclaration
//       RÉFÉRENCE `T` (`Extract<T, …>`, `T[]`, `Record<string, T>` — références résolues par
//       symbole, alias d'import traversés).
// La condition (2) sépare un champ HÉRITÉ de son déclarant : `TrappingRef` compose `Ref`, donc
// `TrappingRef.spec` ne compte QUE les porteurs déclarés `TrappingRef` (2 sites), tandis que
// `Ref.spec` compte toute lecture de la propriété qu'il DÉCLARE (18 sites — c'est ce que casserait
// son renommage). Corollaire : un « 0 » sur un champ HÉRITÉ est tautologique et ne se lit pas comme
// une absence de lecteur — d'où `fieldOwnership` (plus bas), qui donne l'ÉTAT du champ.
//
// ANGLES MORTS, MESURÉS sur le corpus (1 952 fichiers de `src/`, 2026-09-01) :
//   - REDÉCLARATION STRUCTURELLE du type cible à un site : un paramètre annoté d'un littéral de
//     même forme que `T` (`(r: { id: string; spec?: string }) => r.spec` face à un `Ref` de même
//     forme) porte SES déclarations de propriété et ne crédite RIEN — condition (1). C'est un défaut
//     de la SOURCE (le site n'annonce pas le type qu'il consomme), pas du détecteur, et c'est aussi
//     ce qui interdit tout faux positif de forme : les deux versants sont mordus sur fixtures dans
//     `src/data/field-consumers.test.ts` ;
//   - population de cette classe, avec sa DÉFINITION : sur 93 185 accès de propriété du code de
//     production, 22 046 sont CANDIDATS (nom ∈ les 126 champs des 23 cibles) et 5 205 d'entre eux
//     ont un porteur dont le type AU SITE est un littéral anonyme (`symbol.name === '__type'`) —
//     ceux dont la forme ne vient d'aucun type nommé n'entrent dans aucune ligne du rapport ;
//   - champ du SCHÉMA ABSENT du type TS (`AdvancementRef.table`, 6 champs de `PropData`) : il n'y a
//     rien à lire, et ce n'est pas une mesure de lecture — état `absent` de `fieldOwnership`,
//     jamais un « 0 lecteur » ;
//   - un spread (`{ ...ref }`) ne cite aucun champ nommé et ne compte AUCUNE lecture — correct pour
//     ce détecteur, mais un tel site peut légitimement consommer tous les champs en aval ;
//   - un accès par clé DYNAMIQUE (`ref[k]`, `Object.entries(ref)`) n'a pas de symbole de propriété
//     et ne crédite rien.
import * as ts from 'typescript/unstable/ast'
import { SymbolFlags } from 'typescript/unstable/sync'
import { join, relative, resolve, sep } from 'node:path'
import { listerArbre, parUnitesDeCode } from './lister.mjs'
import { estFichierVitest } from './fichierVitest.mjs'
import { repoProgram, libererSessions } from './tsProgram.mjs'

/** Fichiers de PRODUCTION `.ts(x)` sous `dir`, hors `*.test.ts(x)`, en ORDRE TOTAL (`listerArbre`).
 *  L'ordre des RACINES décide de celui de `program.getSourceFileNames().map((file) => program.getSourceFile(file))`, donc de l'index des accès,
 *  donc du site cité en exemple par le rapport : sans ordre total, le même dépôt rend deux `.md`
 *  différents selon la machine. */
export function listProdFiles(dir) {
  return listerArbre(dir, { filtre: (rel) => /\.tsx?$/.test(rel) && !estFichierVitest(rel) })
    .map((rel) => join(dir, rel))
}

/** Chemin en séparateurs `/`. La CASSE n'est pas repliée : les deux côtés de toute comparaison
 *  viennent du MÊME Program (racines `resolve`ées depuis la même racine que le `home` visé), et une
 *  divergence de casse ne se perdrait pas en silence — `cibleDe` ne trouverait pas le fichier du
 *  `home` et lèverait « cible non résoluble » (mordu sur fixtures). */
const norm = (p) => p.replace(/\\/g, '/')

/** Constituants d'un type : lui-même, les membres d'une union/intersection, les arguments d'alias. */
function constituants(type, out = new Set()) {
  if (!type || out.has(type)) return out
  out.add(type)
  if (type.isUnionType() || type.isIntersectionType()) for (const t of type.getTypes()) constituants(t, out)
  for (const a of type.getAliasTypeArguments()) constituants(a, out)
  return out
}

/** Déclarations de la propriété `nom` sur `type` (constituants déroulés). */
function declarationsDeProp(checker, type, nom, out = new Set()) {
  for (const part of constituants(type)) for (const d of checker.getPropertyOfType(part, nom)?.declarations ?? []) out.add(d.resolve())
  return out
}

const dansSousArbre = (node, racine) => {
  for (let n = node; n; n = n.parent) if (n === racine) return true
  return false
}

/** SYMBOLE du `const` dont le shape porte cette déclaration de propriété (`z.strictObject({ … })`) —
 *  chaînes `.optional()`/`.array()`/`.extend()` et spreads traversés. Un `const` d'un autre module
 *  n'est pas le même symbole : c'est ce qui remplace toute comparaison de nom. */
function constDuShape(checker, decl) {
  const shape = decl.parent
  if (!shape || !ts.isObjectLiteralExpression(shape)) return undefined
  let n = shape.parent
  while (n && (ts.isCallExpression(n) || ts.isPropertyAccessExpression(n) || ts.isSpreadAssignment(n) || ts.isObjectLiteralExpression(n))) n = n.parent
  if (!n || !ts.isVariableDeclaration(n) || !ts.isIdentifier(n.name)) return undefined
  return checker.getSymbolAtLocation(n.name)
}

/** Symboles des schémas dont la déclaration de la cible INFÈRE son corps : les `typeof S` que porte
 *  le nœud de type d'un alias (`type SourceRef = z.infer<typeof sourceRefSchema>`), alias d'import
 *  traversés. Vide pour une `interface`/`class` — leurs membres sont dans leur propre sous-arbre. */
function schemasInferes(checker, decl) {
  const out = new Set()
  if (!ts.isTypeAliasDeclaration(decl) || !decl.type) return out
  const visit = (n) => {
    if (ts.isTypeQueryNode(n) && ts.isIdentifier(n.exprName)) {
      let s = checker.getSymbolAtLocation(n.exprName)
      if (s && s.flags & SymbolFlags.Alias) {
        try {
          s = checker.getAliasedSymbol(s)
        } catch {
          s = undefined
        }
      }
      if (s) out.add(s)
    }
    n.forEachChild(visit)
  }
  visit(decl.type)
  return out
}

/** ORDRE TOTAL sur un ensemble de déclarations : le MINIMUM de (fichier en unités de code, position
 *  dans le fichier). L'ordre d'un `Set` peuplé depuis le `TypeChecker` suit le parcours du Program,
 *  donc celui du système de fichiers — un `[0]` pris dessus ferait varier la sortie d'une machine à
 *  l'autre (le nom du déclarant IMPRIMÉ par `fieldOwnership` en dépend). */
function premiereDeclaration(declarations) {
  let min
  let cleMin
  for (const d of declarations) {
    const cle = [norm(d.getSourceFile().fileName), d.getStart()]
    if (!min || cle[0] < cleMin[0] || (cle[0] === cleMin[0] && cle[1] < cleMin[1])) {
      min = d
      cleMin = cle
    }
  }
  return min
}

/** Nom du DÉCLARANT d'une propriété, pour l'AFFICHAGE seul (jamais pour créditer) : le type ou le
 *  schéma qui la porte. */
function nomDuDeclarant(decl) {
  for (let n = decl.parent; n; n = n.parent) {
    if (ts.isInterfaceDeclaration(n) || ts.isTypeAliasDeclaration(n) || ts.isClassDeclaration(n)) return n.name?.text
    if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name)) return n.name.text
  }
  return undefined
}

/** Déclaration du type nommé `nom` dans `sf` (interface, alias, classe). */
function declarationDeType(sf, nom) {
  let trouvee
  const visit = (n) => {
    if ((ts.isInterfaceDeclaration(n) || ts.isTypeAliasDeclaration(n) || ts.isClassDeclaration(n)) && n.name?.text === nom) trouvee ??= n
    n.forEachChild(visit)
  }
  visit(sf)
  return trouvee
}

/**
 * CONTEXTE de scan (Program, checker, index des accès par nom de champ) porté par la MAP fournie
 * par l'APPELANT — patron de `closureOf`/`importGraph.mjs` : il naît et meurt avec son appel, rien
 * n'est retenu par le module. Un rapport complet mesure 23 types sur le MÊME corpus : le Program
 * (~6 s, ~1,3 Go) et l'index des accès (~0,4 s) sont donc bâtis UNE fois pour les 23, et libérés au
 * retour de l'appelant.
 */
function contexteDe(cache, files, rootDir, programme = null) {
  // CLÉ = le Program lui-même quand il est INJECTÉ (fixtures de `virtualProgram`) : deux Programs
  // qui partagent un `cache` sont deux contextes, et le second n'obtient jamais l'index du premier.
  // Sans injection, le Program est bâti sur `files` et le contexte est unique par cache — un
  // rapport, un corpus (les 23 cibles le partagent, c'est son objet).
  const cle = programme ?? '#contexte'
  let ctx = cache.get(cle)
  if (ctx) return ctx
  const racines = files.map((f) => resolve(f))
  const session = programme ?? repoProgram(rootDir, () => racines)
  try {
    const { program, checker } = session
    const retenus = new Set(racines.map(norm))
    // Index des accès CANDIDATS par nom de champ — un seul parcours d'AST pour tous les types.
    const index = new Map()
    const poser = (nom, sf, node) => {
      if (!nom) return
      let a = index.get(nom)
      if (!a) index.set(nom, (a = []))
      a.push({ sf, node })
    }
    for (const sf of program.getSourceFileNames().map((file) => program.getSourceFile(file))) {
      if (sf.isDeclarationFile || !retenus.has(norm(sf.fileName))) continue
      const visit = (n) => {
        if (ts.isPropertyAccessExpression(n)) poser(n.name.text, sf, n)
        else if (ts.isElementAccessExpression(n) && n.argumentExpression && ts.isStringLiteralLikeNode(n.argumentExpression)) poser(n.argumentExpression.text, sf, n)
        else if (ts.isBindingElement(n) && ts.isObjectBindingPattern(n.parent) && !n.dotDotDotToken) {
          poser(n.propertyName ? n.propertyName.getText(sf) : (ts.isIdentifier(n.name) ? n.name.text : ''), sf, n)
        }
        n.forEachChild(visit)
      }
      visit(sf)
    }
    ctx = { program, checker, index, sites: new Map(), cibles: new Map(), rootDir, sessionPropre: programme ? null : session }
    cache.set(cle, ctx)
    return ctx
  } catch (erreur) {
    libererSessions(programme ? [] : [session], [erreur])
  }
}

/** Sites candidats d'un nom de champ, avec leur symbole de propriété résolu (mémoïsé par nom). */
function sitesDe(ctx, nom) {
  let sites = ctx.sites.get(nom)
  if (sites) return sites
  const { checker } = ctx
  sites = (ctx.index.get(nom) ?? []).map(({ sf, node }) => {
    const props = new Set()
    if (ts.isBindingElement(node)) {
      declarationsDeProp(checker, checker.getTypeAtLocation(node.parent), nom, props)
    } else {
      const cible = ts.isPropertyAccessExpression(node) ? node.name : node.argumentExpression
      const sym = checker.getSymbolAtLocation(cible)
      if (sym) {
        for (const d of sym.declarations) props.add(d.resolve())
      }
    }
    const { line } = sf.getLineAndCharacterOfPosition(node.getStart(sf))
    return {
      node,
      props,
      file: relative(ctx.rootDir, sf.fileName).split(sep).join('/'),
      line: line + 1,
      porteur: null,
    }
  })
  ctx.sites.set(nom, sites)
  return sites
}

/** Déclarations de type que le PORTEUR d'un accès désigne : celle de son type DÉCLARÉ (narrowing du
 *  site ignoré) et celles que RÉFÉRENCE l'annotation de sa déclaration. Calculé À LA DEMANDE — un
 *  site dont la propriété n'appartient à aucune cible ne le paie jamais. */
function porteurDe(ctx, site) {
  if (site.porteur) return site.porteur
  const { checker } = ctx
  const out = new Set()
  const expr = ts.isBindingElement(site.node) ? site.node.parent : site.node.expression
  const sym = checker.getSymbolAtLocation(expr)
  const decl = (sym?.valueDeclaration ?? sym?.declarations?.[0])?.resolve()
  let type
  if (sym && decl) {
    try {
      type = checker.getTypeOfSymbolAtLocation(sym, decl)
    } catch {
      type = undefined
    }
  }
  type ??= checker.getTypeAtLocation(expr)
  for (const t of [type, type && checker.getNonNullableType(type)]) {
    for (const part of constituants(t)) for (const s of [part.getAliasSymbol(), part.getSymbol()]) for (const d of s?.declarations ?? []) out.add(d.resolve())
  }
  const hote = ts.isBindingElement(site.node) ? site.node.parent.parent : decl
  const annotation = hote && (ts.isVariableDeclaration(hote) || ts.isParameterDeclaration(hote) || ts.isPropertySignatureDeclaration(hote) || ts.isPropertyDeclaration(hote)) ? hote.type : undefined
  if (annotation) {
    const visit = (n) => {
      if (ts.isTypeReferenceNode(n) && ts.isIdentifier(n.typeName)) {
        let s = checker.getSymbolAtLocation(n.typeName)
         if (s && s.flags & SymbolFlags.Alias) {
          try {
            s = checker.getAliasedSymbol(s)
          } catch {
            s = undefined
          }
        }
        for (const d of s?.declarations ?? []) out.add(d.resolve())
      }
      n.forEachChild(visit)
    }
    visit(annotation)
  }
  site.porteur = out
  return out
}

/** La cible résolue : déclaration du type à son `home`, et par champ ses déclarations de propriété
 *  (toutes, héritage compris) et celles qui lui sont PROPRES — sous-arbre de la déclaration, ou
 *  shape d'un schéma dont la cible infère son corps (identité par SYMBOLE des deux côtés). */
function cibleDe(ctx, type, home, fields) {
  const cle = `${home}#${type}`
  let cible = ctx.cibles.get(cle)
  if (cible) return cible
  const { program, checker } = ctx
  const vise = norm(resolve(ctx.rootDir, home))
  const sf = program.getSourceFileNames().map((file) => program.getSourceFile(file)).find((s) => norm(s.fileName) === vise)
  const decl = sf && declarationDeType(sf, type)
  if (!decl) throw new Error(`fieldConsumers : type \`${type}\` introuvable dans ${home} — cible non résoluble`)
  const declare = checker.getDeclaredTypeOfSymbol(checker.getSymbolAtLocation(decl.name))
  const schemas = schemasInferes(checker, decl)
  const toutes = new Map()
  const propres = new Map()
  for (const f of fields) {
    const a = declarationsDeProp(checker, declare, f)
    toutes.set(f, a)
    propres.set(f, new Set([...a].filter((d) => dansSousArbre(d, decl) || schemas.has(constDuShape(checker, d)))))
  }
  cible = { decl, toutes, propres }
  ctx.cibles.set(cle, cible)
  return cible
}

/**
 * Nom du symbole PORTEUR d'un site : la première déclaration NOMMÉE qui l'englobe (fonction, méthode,
 * classe, variable, propriété), `'(module)'` à défaut. C'est l'ancre STABLE d'un site : une ligne
 * insérée plus haut dans le fichier déplace le `line`, jamais le symbole qui LIT le champ.
 * @returns {string}
 */
function symboleEnglobant(node) {
  for (let n = node; n; n = n.parent) {
    if (ts.isFunctionDeclaration(n) || ts.isClassDeclaration(n) || ts.isMethodDeclaration(n)
      || ts.isVariableDeclaration(n) || ts.isPropertyDeclaration(n) || ts.isPropertyAssignment(n)) {
      if (n.name && ts.isIdentifier(n.name)) return n.name.text
    }
  }
  return '(module)'
}

/**
 * Sites de lecture de `fields` sur la cible `{ type, home }` (`fieldConsumerTargets.mjs`), à travers
 * `files` (chemins absolus, `listProdFiles`). Rend `[{ field, file, line, symbole }]` — `file` relatif à
 * `rootDir`. Le `cache` porte le Program et l'index : le fournir une fois pour toutes les cibles
 * d'un rapport, et le laisser mourir avec l'appel. `programme` INJECTE le Program (fixtures en
 * mémoire de `virtualProgram`) — absent, il est bâti sur `files`.
 */
export function scanFieldReads(cibleVisee, fields, files, rootDir, cache, programme = null) {
  if (!cache) {
    const local = new Map()
    const erreurs = []
    try { return scanFieldReads(cibleVisee, fields, files, rootDir, local, programme) }
    catch (erreur) { erreurs.push(erreur) }
    finally { libererCache(local, erreurs) }
  }
  const ctx = contexteDe(cache, files, rootDir, programme)
  const { toutes, propres, decl } = cibleDe(ctx, cibleVisee.type, cibleVisee.home, fields)
  const hits = []
  for (const field of fields) {
    const attendues = toutes.get(field)
    if (!attendues?.size) continue
    const propre = propres.get(field)
    for (const site of sitesDe(ctx, field)) {
      // Un champ peut avoir PLUSIEURS déclarations attendues (branches d'union, interface fusionnée).
      // Le verdict porte sur l'EXISTENCE d'une déclaration PROPRE parmi celles résolues au site —
      // jamais sur celle qu'un `Set` d'ordre TS rendrait la première.
      let resolue = false
      let propreAuSite = false
      for (const d of attendues) {
        if (!site.props.has(d)) continue
        resolue = true
        if (propre.has(d)) {
          propreAuSite = true
          break
        }
      }
      if (!resolue) continue
      if (!propreAuSite && !porteurDe(ctx, site).has(decl)) continue
      hits.push({ field, file: site.file, line: site.line, symbole: symboleEnglobant(site.node) })
    }
  }
  // ORDRE TOTAL du résultat : (fichier en unités de code, ligne NUMÉRIQUE). L'ordre de récolte est
  // celui de `program.getSourceFileNames().map((file) => program.getSourceFile(file))` — racines puis dépendances, donc dépendant du parcours du
  // système de fichiers ET du graphe d'imports. Trier ICI rend le « premier site » d'un champ
  // (l'exemple publié par le rapport) égal au MINIMUM de cet ordre, sur toute machine.
  hits.sort((a, b) => parUnitesDeCode(a.file, b.file) || a.line - b.line)
  return hits
}

/**
 * ÉTAT de chaque champ VIS-À-VIS DU TYPE, indépendamment de toute lecture — un « 0 » ne dit pas la
 * même chose selon l'état, et deux d'entre eux ne sont pas des mesures de lecture :
 *   - `absent` : le champ du SCHÉMA n'existe pas sur le type TS (divergence schéma↔type — ni lu ni
 *     lisible ; `AdvancementRef.table`, les 6 champs de `PropData` que `props.types.ts` ne déclare
 *     pas) ;
 *   - `herite` : la propriété est déclarée par un ANCÊTRE (`declarant`), pas par la cible — un « 0 »
 *     y est TAUTOLOGIQUE (aucun porteur déclaré de la cible), le champ vit sous son déclarant ;
 *   - `propre` : la cible la déclare — un « 0 » y est une vraie absence de lecteur.
 * Même `cache` (donc même Program) que `scanFieldReads`.
 */
export function fieldOwnership(cibleVisee, fields, files, rootDir, cache, programme = null) {
  if (!cache) {
    const local = new Map()
    const erreurs = []
    try { return fieldOwnership(cibleVisee, fields, files, rootDir, local, programme) }
    catch (erreur) { erreurs.push(erreur) }
    finally { libererCache(local, erreurs) }
  }
  const ctx = contexteDe(cache, files, rootDir, programme)
  const { toutes, propres } = cibleDe(ctx, cibleVisee.type, cibleVisee.home, fields)
  const etats = new Map()
  for (const field of fields) {
    const attendues = toutes.get(field)
    if (!attendues?.size) {
      etats.set(field, { etat: 'absent' })
      continue
    }
    if (propres.get(field).size) {
      etats.set(field, { etat: 'propre' })
      continue
    }
    etats.set(field, { etat: 'herite', declarant: nomDuDeclarant(premiereDeclaration(attendues)) })
  }
  return etats
}

/** Regroupe des hits `[{field,file,line}]` en `Map<field, hit[]>`, ordre stable = `fields`. */
export function groupByField(fields, hits) {
  const byField = new Map(fields.map((f) => [f, []]))
  for (const h of hits) byField.get(h.field)?.push(h)
  return byField
}

export function libererCache(cache, erreursInitiales = []) {
  try {
    libererSessions([...cache.values()].map((ctx) => ctx.sessionPropre).filter(Boolean), erreursInitiales)
  } finally {
    cache.clear()
  }
}
