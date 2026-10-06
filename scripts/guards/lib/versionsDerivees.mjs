// VERSION DÉRIVÉE D'UNE FORME PERSISTÉE (#2226). Une version persistée se dérive par `versionCourante`
// (`src/lib/versionCourante.ts`) d'un littéral objet de migrations keyé par version de DÉPART : deux
// branches qui ajoutent la même migration ajoutent la même clé, et l'arbre fusionné le dit (conflit, ou
// TS1117). Module PUR : les fichiers lus arrivent en paramètre, le verdict appartient à l'appelant.
//
// CHAMP DE VERSION : `version` et `schema` partout ; `v` quand son littéral objet ou sa classe porte
// aussi `kind`, `version` ou `schema`. Un champ s'initialise par une propriété (clé calculée littérale
// comprise), une propriété de classe ou une affectation `x.champ = …`.
// P1 — un `z.literal(…)` posé sur un champ de version prend un identifiant lié à `versionCourante(…)`.
// P2 — aucun champ de version n'est initialisé par un nombre littéral, signé ou non.
// P3 — aucune `const` (de module ou locale) initialisée par un nombre littéral n'initialise un champ de
//      version ; `v` y est couvert sans condition.
// P4 — toute table qui atteint `versionCourante`, directement ou par le paramètre d'une fonction qui l'y
//      transmet, est un littéral objet non vide à clés numériques littérales CONTIGUËS, sans spread ni
//      clé calculée ; une table de migrations à valeurs chaîne a des valeurs uniques.
//
// PORTÉE, par l'arbre syntaxique et sans vérificateur de types : un nom se résout à sa `const`
// visible (locale, de module, ou importée d'un module RELATIF du corpus) ; une fonction appelée se
// résout par son nom, un import nommé, un import d'espace de noms ou un alias `const`. Un paramètre
// se suit à travers les fonctions qui le transmettent (point fixe), par position et par chemin de
// propriétés, y compris logé dans un littéral objet. Le point fixe est BORNÉ : un chemin ne dépasse
// jamais le plus long chemin simple du graphe de littéraux objets du corpus, références comprises,
// au-delà duquel aucune table
// n'est vérifiable ; l'ensemble (fonction, position, chemin) est donc fini, et un chemin plus profond
// est une faute P4 à son site. HORS PORTÉE : une table construite à l'exécution, un alias réexporté,
// un `let`.
import { posix } from 'node:path'
import { analyserCorpus, typescript } from './dialecte.mjs'
import { libererSessions } from './tsProgram.mjs'
import { estFichierVitest } from './fichierVitest.mjs'

/** La primitive de dérivation. */
const PRIMITIVE = 'versionCourante'
/** Les champs qui portent une version de document. */
const CHAMPS = new Set(['version', 'schema'])
/** Les étiquettes d'une forme persistée, qui font de `v` un champ de version. */
const ETIQUETTES_DE_FORME = new Set(['kind', 'version', 'schema'])

/** Le fichier relève-t-il de la garde : `src/**` en `.ts`/`.tsx`, hors instruments et doublures. */
export const relevePerimetre = (rel) =>
  rel.startsWith('src/') && /\.tsx?$/.test(rel) && !/\.d\.ts$/.test(rel) && !estFichierVitest(rel) && !/\.testkit\.tsx?$/.test(rel)

/**
 * Les sites fautifs des quatre prédicats, par prédicat : `chemin:ligne — motif`.
 * @param {readonly { rel: string, text: string }[]} fichiers
 * @returns {{ P1: string[], P2: string[], P3: string[], P4: string[] }}
 */
export function versionsNonDerivees(fichiers) {
  const ts = typescript()
  const retenus = fichiers.filter((f) => relevePerimetre(f.rel))
  const arbres = new Map()
  const relatifs = new Map()
  const sortie = { P1: [], P2: [], P3: [], P4: [] }
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
    /** Les imports de `sf`, par nom local : nommé `{ rel, nom }`, d'espace de noms `{ rel, espace }` ; `rel` absent hors corpus. */
    const imports = new Map()
    const importDe = (sf, nom) => {
      if (!imports.has(sf)) {
        const table = new Map()
        for (const st of sf.statements) {
          const liaisons = ts.isImportDeclaration(st) && st.importClause?.namedBindings
          if (!liaisons) continue
          const cible = moduleDe(relatifs.get(sf), st.moduleSpecifier.text)
          if (ts.isNamespaceImport(liaisons)) table.set(liaisons.name.text, { rel: cible, espace: true })
          else for (const el of liaisons.elements) table.set(el.name.text, { rel: cible, nom: (el.propertyName ?? el.name).text })
        }
        imports.set(sf, table)
      }
      return imports.get(sf).get(nom)
    }
    /** Les noms des `const` de `sf`, à toute profondeur, initialisées par un nom : les alias possibles. */
    const alias = new Map()
    const estAliasPossible = (sf, nom) => {
      if (!alias.has(sf)) {
        const noms = new Set()
        const visite = (n) => {
          if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.initializer) {
            const i = deballe(n.initializer)
            if (ts.isIdentifier(i) || ts.isPropertyAccessExpression(i)) noms.add(n.name.text)
          }
          n.forEachChild(visite)
        }
        visite(sf)
        alias.set(sf, noms)
      }
      return alias.get(sf).has(nom)
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

    /** La fonction appelée par `expr` : `{ rel, nom }` de sa déclaration, par nom, import, espace de noms ou alias `const`. */
    const appeleDe = (sf, expr, vus = new Set()) => {
      const e = deballe(expr)
      if (!e || vus.has(e)) return undefined
      vus.add(e)
      if (ts.isPropertyAccessExpression(e) && ts.isIdentifier(e.expression)) {
        const imp = importDe(sf, e.expression.text)
        return imp?.espace ? { rel: imp.rel, nom: e.name.text } : undefined
      }
      if (!ts.isIdentifier(e)) return undefined
      const lie = estAliasPossible(sf, e.text) ? constVisible(sf, e, e.text) : undefined
      if (lie?.decl.initializer) {
        const init = deballe(lie.decl.initializer)
        if (ts.isIdentifier(init) || ts.isPropertyAccessExpression(init)) return appeleDe(lie.sf, init, vus)
      }
      const imp = importDe(sf, e.text)
      if (imp && !imp.espace) return { rel: imp.rel, nom: imp.nom }
      return { rel: relatifs.get(sf), nom: e.text }
    }
    /** L'appel est-il `versionCourante(…)`, sous quelque nom qu'il l'atteigne ? */
    const estPrimitive = (sf, n) => !!n && ts.isCallExpression(n) && appeleDe(sf, n.expression)?.nom === PRIMITIVE

    /** La fonction (déclaration ou `const f = (…) =>`) qui englobe `n`, avec son nom. */
    const fonctionDe = (n) => {
      for (let p = n.parent; p; p = p.parent) {
        if (ts.isFunctionDeclaration(p) && p.name) return { nom: p.name.text, fn: p }
        if ((ts.isArrowFunction(p) || ts.isFunctionExpression(p)) && ts.isVariableDeclaration(p.parent) && ts.isIdentifier(p.parent.name))
          return { nom: p.parent.name.text, fn: p }
      }
      return undefined
    }

    /** `(param, chemin)` d'une expression qui lit un paramètre d'une fonction englobante, ou rien. */
    const parametreLu = (expr) => {
      const chemin = []
      let e = deballe(expr)
      while (e && ts.isPropertyAccessExpression(e)) { chemin.unshift(e.name.text); e = deballe(e.expression) }
      if (!e || !ts.isIdentifier(e)) return undefined
      for (let p = expr.parent; p; p = p.parent) {
        if (!ts.isSignatureDeclaration(p)) continue
        const i = p.parameters.findIndex((q) => ts.isIdentifier(q.name) && q.name.text === e.text)
        if (i < 0) continue
        const englobante = fonctionDe(p.parameters[i])
        return englobante && englobante.fn === p ? { fonction: englobante.nom, index: i, chemin } : undefined
      }
      return undefined
    }

    /** Un pas de chemin sous `expr` : la propriété `k` du littéral objet qu'elle désigne, `const` visible suivie. */
    const pas = (sf, expr, k) => {
      let e = deballe(expr)
      let ici = sf
      if (e && ts.isIdentifier(e)) {
        const c = constVisible(sf, e, e.text)
        if (!c?.decl.initializer) return undefined
        ici = c.sf
        e = deballe(c.decl.initializer)
      }
      if (!e || !ts.isObjectLiteralExpression(e)) return undefined
      const pr = e.properties.find((x) => (ts.isPropertyAssignment(x) || ts.isShorthandPropertyAssignment(x)) && nomDe(x.name) === k)
      if (!pr) return undefined
      return { sf: ici, expr: ts.isPropertyAssignment(pr) ? pr.initializer : pr.name }
    }
    /** Le paramètre lu sous `chemin` depuis `arg`, directement ou logé dans un littéral objet, et le reste du chemin. */
    const parametreSous = (sf, arg, chemin) => {
      let ici = { sf, expr: arg }
      for (let i = 0; ; i++) {
        const p = ici.sf === sf ? parametreLu(ici.expr) : undefined
        if (p) return { p, reste: chemin.slice(i) }
        if (i === chemin.length) return undefined
        ici = pas(ici.sf, ici.expr, chemin[i])
        if (!ici) return undefined
      }
    }

    const tousLesNoeuds = (sf, f) => { const visite = (n) => { f(n); n.forEachChild(visite) }; visite(sf) }

    const profondeurDe = (sf, expr, enCours = new Set()) => {
      const e = deballe(expr)
      if (!e || enCours.has(e)) return 0
      enCours.add(e)
      let profondeur = 0
      if (ts.isIdentifier(e)) {
        const c = constVisible(sf, e, e.text)
        if (c?.decl.initializer) profondeur = profondeurDe(c.sf, c.decl.initializer, enCours)
      } else if (ts.isObjectLiteralExpression(e)) {
        profondeur = 1
        for (const pr of e.properties) {
          if (!ts.isPropertyAssignment(pr) && !ts.isShorthandPropertyAssignment(pr)) continue
          const enfant = pas(sf, e, nomDe(pr.name))
          if (enfant) profondeur = Math.max(profondeur, 1 + profondeurDe(enfant.sf, enfant.expr, enCours))
        }
      }
      enCours.delete(e)
      return profondeur
    }
    let profondeur = 0
    for (const sf of arbres.values()) {
      tousLesNoeuds(sf, (n) => {
        if (ts.isObjectLiteralExpression(n)) profondeur = Math.max(profondeur, profondeurDe(sf, n))
      })
    }

    // PORTES : `rel#fonction#index` → chemins de propriété sous lesquels le paramètre atteint la primitive.
    /** @type {Map<string, Set<string>>} */
    const portes = new Map()
    /** Les sites dont le chemin excède la borne : `rel:pos` → site P4. */
    const tropProfonds = new Map()
    const ajoutePorte = (sf, arg, p, chemin) => {
      const complet = [...p.chemin, ...chemin]
      if (complet.length > profondeur) {
        tropProfonds.set(`${relatifs.get(sf)}:${arg.pos}`, site(sf, arg, `chemin vers \`${PRIMITIVE}\` plus profond que tout littéral objet du corpus (${profondeur}) : sa table n'est pas vérifiable`))
        return false
      }
      const cle = `${relatifs.get(sf)}#${p.fonction}#${p.index}`
      const c = complet.join('.')
      if (!portes.has(cle)) portes.set(cle, new Set())
      if (portes.get(cle).has(c)) return false
      portes.get(cle).add(c)
      return true
    }
    // APPELS du corpus, chacun résolu une fois : la primitive, ou la fonction appelée.
    const appels = []
    for (const sf of arbres.values()) {
      tousLesNoeuds(sf, (n) => {
        if (!ts.isCallExpression(n) || !n.arguments.length) return
        const appele = appeleDe(sf, n.expression)
        if (appele?.nom === PRIMITIVE) appels.push({ sf, n, primitive: true })
        else if (appele?.rel) appels.push({ sf, n, cle: `${appele.rel}#${appele.nom}#` })
      })
    }
    // TABLES : les expressions qui atteignent la primitive hors de tout paramètre.
    const tables = new Map()
    for (let change = true; change;) {
      change = false
      for (const { sf, n, primitive, cle: appele } of appels) {
        const cibles = []
        if (primitive) cibles.push({ arg: n.arguments[0], chemins: new Set(['']) })
        else n.arguments.forEach((arg, i) => {
          const chemins = portes.get(`${appele}${i}`)
          if (chemins) cibles.push({ arg, chemins })
        })
        for (const { arg, chemins } of cibles) for (const c of chemins) {
          const chemin = c ? c.split('.') : []
          const lu = parametreSous(sf, arg, chemin)
          if (lu) { if (ajoutePorte(sf, arg, lu.p, lu.reste)) change = true; continue }
          const cle = `${relatifs.get(sf)}:${arg.pos}:${c}`
          if (!tables.has(cle)) { tables.set(cle, { sf, arg, chemin }); change = true }
        }
      }
    }
    sortie.P4.push(...tropProfonds.values())

    // P4 — chaque table qui atteint la primitive.
    const jugeTable = (sf, arg, chemin) => {
      let ici = { sf, expr: arg }
      for (const k of chemin) {
        ici = pas(ici.sf, ici.expr, k)
        if (!ici) return sortie.P4.push(site(sf, arg, `aucun littéral objet ne porte \`${chemin.join('.')}\``))
      }
      let e = deballe(ici.expr)
      let ou = { sf: ici.sf, n: ici.expr }
      if (e && ts.isIdentifier(e)) {
        const c = constVisible(ici.sf, e, e.text)
        if (!c) return sortie.P4.push(site(ici.sf, ici.expr, `\`${e.text}\` n'est pas une \`const\` du corpus`))
        ou = { sf: c.sf, n: c.decl }
        e = deballe(c.decl.initializer)
      }
      const fautes = []
      if (!e || !ts.isObjectLiteralExpression(e)) fautes.push('pas un littéral objet')
      else {
        if (e.properties.length === 0) fautes.push('table vide')
        const cles = []
        const valeurs = []
        for (const pr of e.properties) {
          if (!ts.isPropertyAssignment(pr)) { fautes.push(ts.isSpreadAssignment(pr) ? 'spread' : 'entrée qui n’est pas `clé: valeur`'); continue }
          if (!ts.isNumericLiteral(pr.name)) { fautes.push(ts.isComputedPropertyName(pr.name) ? 'clé calculée' : `clé non numérique « ${pr.name.getText(ou.sf)} »`); continue }
          cles.push(Number(pr.name.text))
          const v = deballe(pr.initializer)
          valeurs.push(v && (ts.isStringLiteral(v) || ts.isNoSubstitutionTemplateLiteral(v)) ? v.text : null)
        }
        const tri = [...cles].sort((a, b) => a - b)
        if (tri.some((k, i) => !Number.isInteger(k) || (i > 0 && k !== tri[i - 1] + 1))) fautes.push(`clés non contiguës (${tri.join(', ')})`)
        if (valeurs.length && valeurs.every((v) => v !== null) && new Set(valeurs).size !== valeurs.length) fautes.push('valeurs de migration en double')
      }
      for (const f of fautes) sortie.P4.push(site(ou.sf, ou.n, f))
    }
    for (const t of tables.values()) jugeTable(t.sf, t.arg, t.chemin)

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
      if (deVersion && ts.isCallExpression(init) && ts.isPropertyAccessExpression(init.expression) && init.expression.name.text === 'literal') {
        const a = init.arguments[0] && deballe(init.arguments[0])
        const c = a && ts.isIdentifier(a) ? constVisible(sf, a, a.text) : undefined
        if (!(c?.decl.initializer && estPrimitive(c.sf, deballe(c.decl.initializer))))
          sortie.P1.push(site(sf, n, `\`${champ}: ${init.getText(sf)}\` ne prend pas une version dérivée par \`${PRIMITIVE}\``))
      }
      const nombre = deVersion ? nombreLitteral(init) : undefined
      if (nombre !== undefined) sortie.P2.push(site(sf, n, `\`${champ}: ${nombre}\``))
      if ((deVersion || champ === 'v') && ts.isIdentifier(init)) {
        const c = constVisible(sf, init, init.text)
        const valeur = c?.decl.initializer ? nombreLitteral(c.decl.initializer) : undefined
        if (valeur !== undefined) sortie.P3.push(site(sf, n, `\`${champ}\` initialisé par \`${init.text} = ${valeur}\``))
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
