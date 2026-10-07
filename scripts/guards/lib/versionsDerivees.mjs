// VERSION DÉRIVÉE D'UNE FORME PERSISTÉE (#2226, #2404). Aucun numéro de version n'est écrit à la main :
// une forme persistée porte le FORMAT de son type, généré (`scripts/gen-formats.mjs`). Module PUR :
// les fichiers lus arrivent en paramètre, le verdict appartient à l'appelant.
//
// CHAMP DE VERSION : `version` et `schema` partout ; `v` quand son littéral objet ou sa classe porte
// aussi `kind`, `version` ou `schema`. Un champ s'initialise par une propriété (clé calculée littérale
// comprise), une propriété de classe ou une affectation `x.champ = …`.
// P1 — aucun champ de version n'est initialisé par un nombre littéral, signé ou non.
// P2 — aucune `const` (de module ou locale) initialisée par un nombre littéral n'initialise un champ de
//      version ; `v` y est couvert sans condition.
// P3 — un champ `version` (ou `v` étiqueté) STAMPÉ par un nom ou une chaîne prend un identifiant importé
//      du module des formats généré (`FORMATS`). Une copie (`s.version`) ou un calcul n'est pas un
//      stampage.
//
// PORTÉE, par l'arbre syntaxique et sans vérificateur de types : un nom se résout à sa `const`
// visible (locale, de module, ou importée d'un module RELATIF du corpus). HORS PORTÉE : une valeur
// construite à l'exécution, un alias réexporté, un `let`.
import { posix } from 'node:path'
import { analyserCorpus, typescript } from './dialecte.mjs'
import { libererSessions } from './tsProgram.mjs'
import { estFichierVitest } from './fichierVitest.mjs'

/** Les champs qui portent une version de document. */
const CHAMPS = new Set(['version', 'schema'])
/** Les étiquettes d'une forme persistée, qui font de `v` un champ de version. */
const ETIQUETTES_DE_FORME = new Set(['kind', 'version', 'schema'])
/** Le module des formats généré (`scripts/gen-formats.mjs`), par la fin de son spécificateur. */
const FORMATS = /(^|\/)formats\.generated(\.[cm]?[jt]s)?$/

/** Le fichier relève-t-il de la garde : `src/**` en `.ts`/`.tsx`, hors instruments et doublures. */
export const relevePerimetre = (rel) =>
  rel.startsWith('src/') && /\.tsx?$/.test(rel) && !/\.d\.ts$/.test(rel) && !estFichierVitest(rel) && !/\.testkit\.tsx?$/.test(rel)

/**
 * Les sites fautifs des trois prédicats, par prédicat : `chemin:ligne — motif`.
 * @param {readonly { rel: string, text: string }[]} fichiers
 * @returns {{ P1: string[], P2: string[], P3: string[] }}
 */
export function versionsNonDerivees(fichiers) {
  const ts = typescript()
  const retenus = fichiers.filter((f) => relevePerimetre(f.rel))
  const arbres = new Map()
  const relatifs = new Map()
  const sortie = { P1: [], P2: [], P3: [] }
  const site = (sf, noeud, motif) => `${relatifs.get(sf)}:${sf.getLineAndCharacterOfPosition(noeud.getStart(sf)).line + 1} — ${motif}`
  const analyser = () => {

    const deballe = (e) => {
      while (e && (ts.isAsExpression(e) || ts.isSatisfiesExpression(e) || ts.isParenthesizedExpression(e) || ts.isTypeAssertion(e) || ts.isNonNullExpression(e))) e = e.expression
      return e
    }
    const estLitteralDeCle = (n) => ts.isIdentifier(n) || ts.isStringLiteral(n) || ts.isNumericLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)
    /** Le nom d'une clé, calculée à littéral comprise (`['version']`). */
    const nomDe = (n) => {
      if (n && ts.isComputedPropertyName(n)) {
        const e = deballe(n.expression)
        return e && !ts.isIdentifier(e) && estLitteralDeCle(e) ? e.text : undefined
      }
      return n && estLitteralDeCle(n) ? n.text : undefined
    }
    /** Le texte d'un nombre littéral, signé ou non, ou rien. */
    const nombreLitteral = (expr) => {
      const e = deballe(expr)
      if (e && ts.isNumericLiteral(e)) return e.text
      if (e && ts.isPrefixUnaryExpression(e) && (e.operator === ts.SyntaxKind.PlusToken || e.operator === ts.SyntaxKind.MinusToken)) {
        const o = deballe(e.operand)
        if (o && ts.isNumericLiteral(o)) return `${e.operator === ts.SyntaxKind.MinusToken ? '-' : '+'}${o.text}`
      }
      return undefined
    }

    /** Le module ciblé par un import relatif de `rel`, dans le corpus. */
    const moduleDe = (rel, spec) => {
      if (!spec.startsWith('.')) return undefined
      const base = posix.normalize(posix.join(posix.dirname(rel), spec)).replace(/\.(m?js|tsx?)$/, '')
      return [`${base}.ts`, `${base}.tsx`, `${base}/index.ts`].find((c) => arbres.has(c))
    }
    const lieNom = (n, nom) => n && (ts.isIdentifier(n) ? n.text === nom :
      (ts.isObjectBindingPattern(n) || ts.isArrayBindingPattern(n)) && n.elements.some((e) => ts.isBindingElement(e) && lieNom(e.name, nom)))
    const liaisonDesInstructions = (statements, nom) => {
      for (const st of statements) {
        if (ts.isVariableStatement(st)) {
          for (const d of st.declarationList.declarations) if (lieNom(d.name, nom)) return d
        } else if ((ts.isFunctionDeclaration(st) || ts.isClassDeclaration(st) || ts.isEnumDeclaration(st)) && lieNom(st.name, nom)) return st
      }
      return undefined
    }
    const commeConst = (sf, d) => d && ts.isVariableDeclaration(d) && ts.isIdentifier(d.name) &&
      ts.isVariableDeclarationList(d.parent) && (d.parent.flags & ts.NodeFlags.Const) ? { sf, decl: d } : undefined
    const varsDe = new Map()
    const lieVar = (scope, nom) => {
      if (!varsDe.has(scope)) {
        const declarations = []
        const visite = (n) => {
          if (n !== scope && ts.isSignatureDeclaration(n)) return
          if (ts.isVariableDeclarationList(n) && !(n.flags & ts.NodeFlags.BlockScoped)) declarations.push(...n.declarations)
          n.forEachChild(visite)
        }
        visite(scope)
        varsDe.set(scope, declarations)
      }
      return varsDe.get(scope).some((d) => lieNom(d.name, nom))
    }
    /** Les imports de `sf`, par nom local : nommé `{ rel, nom, spec }`, d'espace de noms `{ rel, espace }` ; `rel` absent hors corpus. */
    const imports = new Map()
    const importDe = (sf, nom) => {
      if (!imports.has(sf)) {
        const table = new Map()
        for (const st of sf.statements) {
          const liaisons = ts.isImportDeclaration(st) && st.importClause?.namedBindings
          if (!liaisons) continue
          const cible = moduleDe(relatifs.get(sf), st.moduleSpecifier.text)
          if (ts.isNamespaceImport(liaisons)) table.set(liaisons.name.text, { rel: cible, espace: true })
          else for (const el of liaisons.elements) table.set(el.name.text, { rel: cible, nom: (el.propertyName ?? el.name).text, spec: st.moduleSpecifier.text })
        }
        imports.set(sf, table)
      }
      return imports.get(sf).get(nom)
    }
    /** La déclaration `const` de niveau module nommée `nom` dans `rel` (importée comprise), ou rien. */
    const constDe = (rel, nom, vus = new Set()) => {
      const sf = arbres.get(rel)
      if (!sf || vus.has(`${rel}#${nom}`)) return undefined
      vus.add(`${rel}#${nom}`)
      const d = liaisonDesInstructions(sf.statements, nom)
      if (d) return commeConst(sf, d)
      if (lieVar(sf, nom)) return undefined
      const imp = importDe(sf, nom)
      return imp?.rel && !imp.espace ? constDe(imp.rel, imp.nom, vus) : undefined
    }
    /** La `const` nommée `nom` VISIBLE depuis `noeud` : locale à un bloc englobant, puis de module. */
    const constVisible = (sf, noeud, nom) => {
      for (let p = noeud.parent; p && !ts.isSourceFile(p); p = p.parent) {
        const instructions = p.statements ?? (ts.isCaseBlock(p) ? p.clauses.flatMap((c) => c.statements) : undefined)
        const d = instructions && liaisonDesInstructions(instructions, nom)
        if (d) return commeConst(sf, d)
        if (ts.isSignatureDeclaration(p) && (p.parameters.some((q) => lieNom(q.name, nom)) || lieNom(p.name, nom) || lieVar(p, nom))) return undefined
        if (ts.isCatchClause(p) && lieNom(p.variableDeclaration?.name, nom)) return undefined
        if ((ts.isForStatement(p) || ts.isForOfStatement(p) || ts.isForInStatement(p)) && p.initializer && ts.isVariableDeclarationList(p.initializer)) {
          const d = p.initializer.declarations.find((q) => lieNom(q.name, nom))
          if (d) return commeConst(sf, d)
        }
      }
      return constDe(relatifs.get(sf), nom)
    }

    /** `nom` est-il lié dans `sf` ailleurs que par un import (déclaration, paramètre, `catch`, boucle) au-dessus de `noeud` ? */
    const lieLocalement = (sf, noeud, nom) => {
      for (let p = noeud.parent; p; p = p.parent) {
        const instructions = p.statements ?? (ts.isCaseBlock(p) ? p.clauses.flatMap((c) => c.statements) : undefined)
        if (instructions && liaisonDesInstructions(instructions, nom)) return true
        if (ts.isSignatureDeclaration(p) && (p.parameters.some((q) => lieNom(q.name, nom)) || lieVar(p, nom))) return true
        if (ts.isCatchClause(p) && lieNom(p.variableDeclaration?.name, nom)) return true
        if ((ts.isForStatement(p) || ts.isForOfStatement(p) || ts.isForInStatement(p)) && p.initializer && ts.isVariableDeclarationList(p.initializer)
          && p.initializer.declarations.some((q) => lieNom(q.name, nom))) return true
      }
      return lieVar(sf, nom)
    }
    const tousLesNoeuds = (sf, f) => { const visite = (n) => { f(n); n.forEachChild(visite) }; visite(sf) }

    /** Les noms des membres du conteneur d'un champ : littéral objet ou classe. */
    const nomsDuConteneur = (conteneur) =>
      (ts.isObjectLiteralExpression(conteneur) ? conteneur.properties : conteneur.members).map((m) => m.name && nomDe(m.name)).filter(Boolean)
    /** Le champ porte-t-il une version : `version`/`schema`, ou `v` voisin d'une étiquette de forme persistée. */
    const estChampDeVersion = (champ, conteneur) =>
      CHAMPS.has(champ) || (champ === 'v' && !!conteneur && nomsDuConteneur(conteneur).some((x) => ETIQUETTES_DE_FORME.has(x)))

    /** Juge le champ `champ`, initialisé par `expr` au site `n`, dans `conteneur` (littéral objet, classe, ou rien). */
    const jugeChamp = (sf, n, champ, expr, conteneur) => {
      const init = deballe(expr)
      if (!init) return
      const deVersion = estChampDeVersion(champ, conteneur)
      if (deVersion && champ !== 'schema' && (ts.isIdentifier(init) || ts.isStringLiteral(init) || ts.isNoSubstitutionTemplateLiteral(init) || ts.isTemplateExpression(init))) {
        const imp = ts.isIdentifier(init) && !lieLocalement(sf, init, init.text) ? importDe(sf, init.text) : undefined
        if (!(imp && !imp.espace && FORMATS.test(imp.spec)))
          sortie.P3.push(site(sf, n, `\`${champ}: ${init.getText(sf)}\` n'est pas un format importé du module généré`))
      }
      const nombre = deVersion ? nombreLitteral(init) : undefined
      if (nombre !== undefined) sortie.P1.push(site(sf, n, `\`${champ}: ${nombre}\``))
      if ((deVersion || champ === 'v') && ts.isIdentifier(init)) {
        const c = constVisible(sf, init, init.text)
        const valeur = c?.decl.initializer ? nombreLitteral(c.decl.initializer) : undefined
        if (valeur !== undefined) sortie.P2.push(site(sf, n, `\`${champ}\` initialisé par \`${init.text} = ${valeur}\``))
      }
    }

    for (const sf of arbres.values()) {
      tousLesNoeuds(sf, (n) => {
        if (ts.isPropertyAssignment(n) || (ts.isPropertyDeclaration(n) && n.initializer)) {
          const champ = nomDe(n.name)
          if (champ) jugeChamp(sf, n, champ, n.initializer, n.parent)
        } else if (ts.isShorthandPropertyAssignment(n)) jugeChamp(sf, n, n.name.text, n.name, n.parent)
        else if (ts.isBinaryExpression(n) && n.operatorToken.kind === ts.SyntaxKind.EqualsToken) {
          const g = deballe(n.left)
          const champ = g && ts.isPropertyAccessExpression(g) ? g.name.text : g && ts.isElementAccessExpression(g) ? nomDe(deballe(g.argumentExpression)) : undefined
          if (champ) jugeChamp(sf, n, champ, n.right, undefined)
        }
      })
    }
    for (const k of Object.keys(sortie)) sortie[k] = [...new Set(sortie[k])].sort()
  }
  const erreurs = []
  let recus = 0
  try {
    for (const { fichier, sourceFile } of analyserCorpus(retenus)) {
      arbres.set(fichier.rel, sourceFile)
      relatifs.set(sourceFile, fichier.rel)
      if (++recus === retenus.length) {
        try { analyser() }
        catch (erreur) { erreurs.push(erreur) }
      }
    }
  } catch (erreur) { erreurs.push(erreur) }
  libererSessions([], erreurs)
  return sortie
}
