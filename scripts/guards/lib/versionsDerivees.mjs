// COMPTEURS DE VERSION DÉRIVÉS DE LEUR TABLE (#2226). Une version persistée se dérive par
// `versionCourante` (`src/lib/versionCourante.ts`) d'un littéral objet keyé par version de DÉPART :
// deux branches qui montent le même compteur ajoutent la même clé, et l'arbre fusionné le dit (conflit,
// ou TS1117). Module PUR : les fichiers lus arrivent en paramètre, le verdict appartient à l'appelant.
//
// P1 — un `z.literal(…)` posé sur un champ `schema` ou `version` prend un identifiant lié à
//      `versionCourante(…)`.
// P2 — aucune propriété `version` ou `schema` d'un littéral objet n'est initialisée par un nombre
//      littéral.
// P3 — aucun `const X = <nombre littéral>` dont `X` initialise une propriété `version`, `v` ou `schema`.
// P4 — toute table qui atteint `versionCourante`, directement ou par le paramètre d'une fonction qui l'y
//      transmet, est un littéral objet non vide à clés numériques littérales CONTIGUËS, sans spread ni
//      clé calculée ; une table de MONTÉES (valeurs chaîne) a des valeurs uniques.
//
// PORTÉE, par l'arbre syntaxique et sans vérificateur de types : un nom se résout à sa `const` de
// niveau module, dans le fichier ou par un import RELATIF du corpus ; un paramètre se suit à travers les
// fonctions qui le transmettent (fixpoint), par position et par accès de propriété. HORS PORTÉE : une
// table construite à l'exécution, un alias réexporté, un `let`.
import { posix } from 'node:path'
import { ast, typescript } from './dialecte.mjs'
import { estFichierVitest } from './fichierVitest.mjs'

/** La primitive de dérivation. */
const PRIMITIVE = 'versionCourante'
/** Les champs qui portent une version de document. */
const CHAMPS_P2 = new Set(['version', 'schema'])
const CHAMPS_P3 = new Set(['version', 'v', 'schema'])

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
  /** @type {Map<string, import('typescript').SourceFile>} */
  const arbres = new Map(retenus.map((f) => [f.rel, ast(f)]))
  const sortie = { P1: [], P2: [], P3: [], P4: [] }
  const site = (sf, noeud, motif) => `${sf.fileName}:${sf.getLineAndCharacterOfPosition(noeud.getStart(sf)).line + 1} — ${motif}`

  const nomDe = (n) => (n && (ts.isIdentifier(n) || ts.isStringLiteral(n) || ts.isNumericLiteral(n)) ? n.text : undefined)
  const deballe = (e) => {
    while (e && (ts.isAsExpression(e) || ts.isSatisfiesExpression(e) || ts.isParenthesizedExpression(e) || ts.isTypeAssertionExpression(e))) e = e.expression
    return e
  }

  /** Le module ciblé par un import relatif de `rel`, dans le corpus. */
  const moduleDe = (rel, spec) => {
    if (!spec.startsWith('.')) return undefined
    const base = posix.normalize(posix.join(posix.dirname(rel), spec)).replace(/\.(m?js|tsx?)$/, '')
    return [`${base}.ts`, `${base}.tsx`, `${base}/index.ts`].find((c) => arbres.has(c))
  }

  /** La déclaration `const` de niveau module nommée `nom` dans `rel` (importée comprise), ou rien. */
  const constDe = (rel, nom, vus = new Set()) => {
    const sf = arbres.get(rel)
    if (!sf || vus.has(`${rel}#${nom}`)) return undefined
    vus.add(`${rel}#${nom}`)
    for (const st of sf.statements) {
      if (ts.isVariableStatement(st) && st.declarationList.flags & ts.NodeFlags.Const) {
        for (const d of st.declarationList.declarations) if (ts.isIdentifier(d.name) && d.name.text === nom) return { sf, decl: d }
      }
      if (ts.isImportDeclaration(st) && st.importClause?.namedBindings && ts.isNamedImports(st.importClause.namedBindings)) {
        for (const el of st.importClause.namedBindings.elements) {
          if (el.name.text !== nom) continue
          const cible = moduleDe(rel, st.moduleSpecifier.text)
          return cible ? constDe(cible, (el.propertyName ?? el.name).text, vus) : undefined
        }
      }
    }
    return undefined
  }

  /** L'appel est-il `versionCourante(…)` ? */
  const estPrimitive = (n) => ts.isCallExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === PRIMITIVE

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
      if (!ts.isFunctionLike(p)) continue
      const i = p.parameters.findIndex((q) => ts.isIdentifier(q.name) && q.name.text === e.text)
      if (i < 0) continue
      const englobante = fonctionDe(p.parameters[i])
      return englobante && englobante.fn === p ? { fonction: englobante.nom, index: i, chemin } : undefined
    }
    return undefined
  }

  /** La fonction appelée : `{ rel, nom }` de sa déclaration, locale ou importée. */
  const appeleDe = (rel, appel) => {
    if (!ts.isIdentifier(appel.expression)) return undefined
    const nom = appel.expression.text
    const sf = arbres.get(rel)
    for (const st of sf.statements) {
      if (ts.isImportDeclaration(st) && st.importClause?.namedBindings && ts.isNamedImports(st.importClause.namedBindings)) {
        const el = st.importClause.namedBindings.elements.find((x) => x.name.text === nom)
        if (el) {
          const cible = moduleDe(rel, st.moduleSpecifier.text)
          return cible ? { rel: cible, nom: (el.propertyName ?? el.name).text } : undefined
        }
      }
    }
    return { rel, nom }
  }

  const tousLesNoeuds = (sf, f) => { const visite = (n) => { f(n); ts.forEachChild(n, visite) }; visite(sf) }

  // PORTES : `rel#fonction#index` → chemins de propriété sous lesquels le paramètre atteint la primitive.
  /** @type {Map<string, Set<string>>} */
  const portes = new Map()
  const ajoutePorte = (rel, p, chemin) => {
    const cle = `${rel}#${p.fonction}#${p.index}`
    const c = [...p.chemin, ...chemin].join('.')
    if (!portes.has(cle)) portes.set(cle, new Set())
    if (portes.get(cle).has(c)) return false
    portes.get(cle).add(c)
    return true
  }
  // TABLES : les expressions qui atteignent la primitive hors de tout paramètre.
  const tables = []
  const descend = (expr, chemin) => {
    let e = deballe(expr)
    for (const k of chemin) {
      if (!e || !ts.isObjectLiteralExpression(e)) return undefined
      const pr = e.properties.find((x) => (ts.isPropertyAssignment(x) || ts.isShorthandPropertyAssignment(x)) && nomDe(x.name) === k)
      if (!pr) return undefined
      e = deballe(ts.isPropertyAssignment(pr) ? pr.initializer : pr.name)
    }
    return e
  }
  for (let change = true; change;) {
    change = false
    for (const [rel, sf] of arbres) {
      tousLesNoeuds(sf, (n) => {
        if (!ts.isCallExpression(n)) return
        const cibles = []
        if (estPrimitive(n) && n.arguments[0]) cibles.push({ arg: n.arguments[0], chemins: new Set(['']) })
        else {
          const appele = appeleDe(rel, n)
          if (appele) n.arguments.forEach((arg, i) => {
            const chemins = portes.get(`${appele.rel}#${appele.nom}#${i}`)
            if (chemins) cibles.push({ arg, chemins })
          })
        }
        for (const { arg, chemins } of cibles) for (const c of chemins) {
          const chemin = c ? c.split('.') : []
          const p = parametreLu(arg)
          if (p) { if (ajoutePorte(rel, p, chemin)) change = true; continue }
          const cle = `${rel}:${arg.pos}:${c}`
          if (!tables.some((t) => t.cle === cle)) { tables.push({ cle, sf, rel, arg, chemin }); change = true }
        }
      })
    }
  }

  // P4 — chaque table qui atteint la primitive.
  const jugeTable = (sf, rel, arg, chemin) => {
    let e = descend(arg, chemin)
    let ou = { sf, n: arg }
    if (e && ts.isIdentifier(e)) {
      const c = constDe(rel, e.text)
      if (!c) return sortie.P4.push(site(sf, arg, `\`${e.text}\` n'est pas une \`const\` de niveau module du corpus`))
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
      if (valeurs.length && valeurs.every((v) => v !== null) && new Set(valeurs).size !== valeurs.length) fautes.push('valeurs de montée en double')
    }
    for (const f of fautes) sortie.P4.push(site(ou.sf, ou.n, f))
  }
  for (const t of tables) jugeTable(t.sf, t.rel, t.arg, t.chemin)

  // Une `const` est-elle liée à `versionCourante(…)` ?
  const deriveeDe = (rel, nom) => {
    const c = constDe(rel, nom)
    return !!c && !!c.decl.initializer && estPrimitive(deballe(c.decl.initializer))
  }

  for (const [rel, sf] of arbres) {
    tousLesNoeuds(sf, (n) => {
      if (ts.isPropertyAssignment(n)) {
        const champ = nomDe(n.name)
        const init = deballe(n.initializer)
        // P1
        if (CHAMPS_P2.has(champ) && ts.isCallExpression(init) && ts.isPropertyAccessExpression(init.expression) && init.expression.name.text === 'literal') {
          const a = init.arguments[0] && deballe(init.arguments[0])
          if (!a || !ts.isIdentifier(a) || !deriveeDe(rel, a.text)) sortie.P1.push(site(sf, n, `\`${champ}: ${init.getText(sf)}\` ne prend pas un compteur dérivé par \`${PRIMITIVE}\``))
        }
        // P2
        if (CHAMPS_P2.has(champ) && init && ts.isNumericLiteral(init)) sortie.P2.push(site(sf, n, `\`${champ}: ${init.text}\``))
        // P3
        if (CHAMPS_P3.has(champ) && init && ts.isIdentifier(init)) jugeConstNumerique(rel, sf, n, champ, init.text)
      }
      if (ts.isShorthandPropertyAssignment(n) && CHAMPS_P3.has(n.name.text)) jugeConstNumerique(rel, sf, n, n.name.text, n.name.text)
    })
  }
  function jugeConstNumerique(rel, sf, n, champ, nom) {
    const c = constDe(rel, nom)
    const init = c?.decl.initializer && deballe(c.decl.initializer)
    if (init && ts.isNumericLiteral(init)) sortie.P3.push(site(sf, n, `\`${champ}\` initialisé par \`${nom} = ${init.text}\``))
  }
  for (const k of Object.keys(sortie)) sortie[k] = [...new Set(sortie[k])].sort()
  return sortie
}
