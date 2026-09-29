// UN SEUL LECTEUR DE CLAVIER GLOBAL (#1687 lot 0) — tout écouteur clavier posé sur `window` ou
// `document` est le LECTEUR du registre (`state/keybindings.ts`) ou une couche déclarée hors registre
// par nature, dans l'EN-TÊTE de son fichier. Consommateur et contrat : `src/ui/raccourcis-registre.test.ts`.
// Module ESM pur.
//
// PORTÉE, par l'arbre syntaxique : le type d'événement d'un `window|document.addEventListener(type, …)`
// se résout depuis un littéral, un gabarit sans trou, une table (clés et valeurs d'un objet, éléments
// d'un tableau), une constante du fichier ou importée d'un module du dépôt passé en `fichiers`, la
// variable d'une boucle `for…of` ou d'un rappel `forEach` sur une table. Tout autre type est NON RÉSOLU.
// Les arbres d'une passe vivent dans l'appel (`tsProgram.mjs`, en-tête).

import { posix } from 'node:path'
import { ast, typescript } from './dialecte.mjs'

/** Types d'événement d'un CLAVIER. */
const TYPE_CLAVIER = /^key(?:down|up)$/
/** Cibles GLOBALES : la fenêtre ou le document, jamais un nœud du rendu. */
const CIBLES_GLOBALES = new Set(['window', 'document'])
/** Extensions essayées pour résoudre un import relatif du dépôt. */
const SUFFIXES = ['', '.ts', '.tsx', '.mjs', '.js', '/index.ts', '/index.tsx']
/** Profondeur de résolution au-delà de laquelle un type est NON RÉSOLU. */
const PROFONDEUR = 8
/** Déclaration, DANS le fichier, qu'il porte une couche clavier hors registre par nature. */
const MARQUE_HORS_REGISTRE = /@clavier-hors-registre\s+\S/
/** Signal du LECTEUR du registre : il en IMPORTE la table (une mention en commentaire n'est rien). */
const IMPORTE_LE_REGISTRE = /import\s*(?:type\s*)?\{[^}]*\bKEYBINDINGS\b[^}]*\}\s*from\s*['"][^'"]*keybindings['"]/
/** EN-TÊTE d'un fichier : ce qu'on lit en l'ouvrant. L'exemption s'y ancre, ou elle n'existe pas. */
export const LIGNES_ENTETE = 40
const enTete = (text) => text.split('\n').slice(0, LIGNES_ENTETE).join('\n')

/** Une passe sur les `fichiers` du dépôt : chaque arbre n'y est parsé qu'une fois. */
function passe(fichiers) {
  const ts = typescript()
  const depot = new Map(fichiers.map((f) => [f.rel, f]))
  const arbres = new Map()
  const arbreDe = (f) => {
    const cle = `${f.rel}\0${f.text}`
    if (!arbres.has(cle)) arbres.set(cle, ast(f))
    return arbres.get(cle)
  }

  /** Nom lié par une déclaration de variable ou un motif de déstructuration. */
  const lie = (nom, b) =>
    ts.isIdentifier(b) ? b.text === nom : b.elements.some((e) => !ts.isOmittedExpression(e) && lie(nom, e.name))

  /** Les chaînes que peut valoir une expression de type d'événement ; `null` : non résolue. */
  function valeurs(expr, sf, f, prof = 0) {
    if (prof > PROFONDEUR) return null
    const suite = (n) => valeurs(n, sf, f, prof + 1)
    if (ts.isParenthesizedExpression(expr) || ts.isAsExpression(expr) || ts.isSatisfiesExpression(expr)
      || ts.isTypeAssertionExpression(expr) || ts.isNonNullExpression(expr)) return suite(expr.expression)
    if (ts.isStringLiteral(expr) || ts.isNoSubstitutionTemplateLiteral(expr)) return [expr.text]
    if (ts.isArrayLiteralExpression(expr)) {
      const vs = expr.elements.map((e) => suite(ts.isSpreadElement(e) ? e.expression : e))
      return vs.some((v) => v === null) ? null : vs.flat()
    }
    if (ts.isObjectLiteralExpression(expr)) {
      const vs = []
      for (const p of expr.properties) {
        if (p.name && (ts.isIdentifier(p.name) || ts.isStringLiteral(p.name))) vs.push(p.name.text)
        if (ts.isPropertyAssignment(p)) vs.push(...(suite(p.initializer) ?? []))
      }
      return vs
    }
    if (ts.isCallExpression(expr) && ts.isPropertyAccessExpression(expr.expression) && ts.isIdentifier(expr.expression.expression)
      && expr.expression.expression.text === 'Object' && expr.arguments.length === 1) return suite(expr.arguments[0])
    if (ts.isIdentifier(expr)) return resoudre(expr.text, expr, sf, f, prof)
    return null
  }

  function resoudre(nom, depuis, sf, f, prof) {
    const suite = (n) => valeurs(n, sf, f, prof + 1)
    for (let n = depuis; n; n = n.parent) {
      if (ts.isForOfStatement(n) && ts.isVariableDeclarationList(n.initializer)
        && n.initializer.declarations.some((d) => lie(nom, d.name))) return suite(n.expression)
      if (ts.isFunctionLike(n) && n.parameters.some((p) => lie(nom, p.name))) {
        const appel = n.parent
        return appel && ts.isCallExpression(appel) && ts.isPropertyAccessExpression(appel.expression)
          && appel.expression.name.text === 'forEach' ? suite(appel.expression.expression) : null
      }
      if (ts.isBlock(n) || ts.isSourceFile(n)) {
        for (const st of n.statements) {
          if (ts.isVariableStatement(st)) {
            const d = st.declarationList.declarations.find((x) => ts.isIdentifier(x.name) && x.name.text === nom)
            if (d?.initializer) return suite(d.initializer)
          }
          if (ts.isImportDeclaration(st) && ts.isStringLiteral(st.moduleSpecifier) && st.importClause?.namedBindings
            && ts.isNamedImports(st.importClause.namedBindings)) {
            const spec = st.importClause.namedBindings.elements.find((e) => e.name.text === nom)
            if (!spec) continue
            const chemin = st.moduleSpecifier.text
            const cible = chemin.startsWith('.')
              ? SUFFIXES.map((x) => posix.join(posix.dirname(f.rel), chemin.replace(/\.m?js$/, '')) + x)
                .map((c) => depot.get(c)).find(Boolean)
              : undefined
            const sfCible = cible ? arbreDe(cible) : null
            if (!cible || !sfCible) return null
            return resoudre((spec.propertyName ?? spec.name).text, sfCible, sfCible, cible, prof + 1)
          }
        }
      }
    }
    return null
  }

  /** `'clavier'` : le fichier pose un écouteur clavier global ; `'non résolu'` : un type d'écouteur
   *  global ne se résout pas ; `null` : aucun. */
  const ecouteurGlobal = (f) => {
    const sf = arbreDe(f)
    if (!sf) return null
    let verdict = null
    const visite = (n) => {
      if (verdict === 'clavier') return
      if (ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression) && n.expression.name.text === 'addEventListener'
        && ts.isIdentifier(n.expression.expression) && CIBLES_GLOBALES.has(n.expression.expression.text) && n.arguments.length > 0) {
        const types = valeurs(n.arguments[0], sf, f)
        if (types === null) verdict = 'non résolu'
        else if (types.some((t) => TYPE_CLAVIER.test(t))) verdict = 'clavier'
      }
      ts.forEachChild(n, visite)
    }
    visite(sf)
    return verdict
  }

  /** Le fichier est-il en règle ? `null` = oui, sinon la RAISON du refus. */
  const verdict = (f) => {
    const ecouteur = ecouteurGlobal(f)
    if (!ecouteur) return null
    if (IMPORTE_LE_REGISTRE.test(f.text)) return null
    if (MARQUE_HORS_REGISTRE.test(enTete(f.text))) return null
    if (MARQUE_HORS_REGISTRE.test(f.text)) {
      return `marque « @clavier-hors-registre » hors de l'EN-TÊTE (${LIGNES_ENTETE} premières lignes) — `
        + "l'exemption se lit d'emblée, au SITE, ou elle n'exempte rien"
    }
    return ecouteur === 'non résolu'
      ? "écouteur global au type d'événement NON RÉSOLU (ni littéral, ni constante, ni table du dépôt) — "
        + 'nomme le type par un littéral ou une table, ou déclare la couche « @clavier-hors-registre <raison> »'
      : 'écouteur clavier global hors du registre — pose le raccourci dans `state/keybindings.ts` '
        + "(le hook `useGameKeyboard` le jouera), ou déclare la couche dans l'en-tête du fichier par "
        + '« @clavier-hors-registre <raison> »'
  }

  return { ecouteurGlobal, verdict }
}

/**
 * Verdict d'UN fichier, ses imports résolus parmi `depot`. `null` = en règle, sinon la raison.
 * @param {{ rel: string, text: string }} fichier
 * @param {readonly { rel: string, text: string }[]} [depot]
 * @returns {string | null}
 */
export const verdictClavier = (fichier, depot = []) => passe(depot).verdict(fichier)

/**
 * Fichiers de `fichiers` hors de la règle, imports résolus parmi eux.
 * @param {readonly { rel: string, text: string }[]} fichiers
 * @returns {string[]} `chemin : raison`
 */
export function fautesClavier(fichiers) {
  const { verdict } = passe(fichiers)
  return fichiers.flatMap((f) => {
    const raison = verdict(f)
    return raison === null ? [] : [`${f.rel} : ${raison}`]
  })
}

/**
 * Fichiers qui portent la marque `@clavier-hors-registre`, et ceux d'entre eux qui ne posent aucun
 * écouteur clavier global (marque MORTE).
 * @param {readonly { rel: string, text: string }[]} fichiers
 * @returns {{ marques: string[], mortes: string[] }}
 */
export function marquesHorsRegistre(fichiers) {
  const { ecouteurGlobal } = passe(fichiers)
  const marques = fichiers.filter(({ text }) => MARQUE_HORS_REGISTRE.test(text))
  return {
    marques: marques.map(({ rel }) => rel),
    mortes: marques.filter((f) => ecouteurGlobal(f) !== 'clavier').map(({ rel }) => rel),
  }
}
