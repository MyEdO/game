// LE REGISTRE DES STOCKS — un stock est DÉCLARÉ, la porte lit la déclaration.
//
// Un STOCK est une DETTE nominative qui va vers zéro (loi : `stock.mjs`). Le COMPTAGE est 100 %
// DÉCLARÉ : `scripts/hooks/stocks.json` dit quelles LIAISONS sont des stocks et COMMENT les
// compter. Deviner un stock par sa FORME — un littéral de module dont un jeton nomme un fichier —
// rend 69 % de faux positifs sur les morsures et laisse 368 entrées de vrais stocks hors de vue
// (mesure #1679 L3b, grounding C, sections A et C) : la forme ne compte donc RIEN. Elle sert la
// seule COMPLÉTUDE, où son rôle est de NOMMER ce qui doit être déclaré (`candidatsDuFichier`, joué
// par `stocksRegistre.test.mjs`).
//
// UNE ENTRÉE DU REGISTRE = { fichier, liaison, forme, role, cible, raison } :
//   · `fichier` — chemin POSIX depuis la racine du dépôt ;
//   · `liaison` — le NOM de la liaison de module (`STRUCTURES_ORPHELINES`) ; pour un JSON, `$` (le
//     document) ou un chemin de propriété (`$.ecrans`) ;
//   · `forme` — COMMENT compter : `liste` = les éléments du tableau (les enveloppes d'IDENTITÉ
//     `Object.freeze`, `new Set`, `new Map`, `Array.from`/`of` et les IIFE sont traversées),
//     `objet` = les propriétés directes (clé QUELCONQUE : plus aucune n'a besoin de nommer un
//     fichier), `plafond` = la VALEUR, qui grandit quand elle MONTE ;
//   · `role` — `stock` (compté ; sa croissance exige `CLIQUET:`), `descripteur` (une table de
//     racines, une fixture, un prédicat, un en-tête de garde : porte la FORME d'un stock sans en
//     être un — jamais compté) ou `derive` (une valeur CALCULÉE depuis un autre porteur :
//     `= X.length`, `= SOURCES.reduce(…)` — la compter doublerait une croissance déjà comptée) ;
//   · `cible` — la valeur visée (`0` pour une dette qui doit s'éteindre), ou `null` ;
//   · `raison` — pourquoi cette liaison porte ce rôle.
//
// LE REGISTRE N'EST PAS UN STOCK. Il n'est pas compté par lui-même, et ajouter ou retirer une
// entrée n'exige AUCUNE ligne `CLIQUET:` : une déclaration dit ce qui EXISTE. Le `CLIQUET:` porte
// sur la CROISSANCE du stock déclaré, jamais sur sa déclaration — sans quoi sortir un stock de
// l'ombre coûterait le même prix que le faire grossir, et personne ne le sortirait.
//
// FRONTIÈRE : cette lib LIT (le registre, les images de fichiers) et CONFRONTE ; elle ne refuse
// rien. `stocksNominatifs.mjs` compte la croissance d'un diff, et le VERDICT appartient au garde de
// solde, au pre-push et à la mesure a posteriori.
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { z } from 'zod'
import { scriptKindDe } from './dialecte.mjs'
import { listerArbre, parUnitesDeCode } from './lister.mjs'
import { MOTIF_MIN } from './stock.mjs'

const RACINE_DEPOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')

/** Où vit le registre — à côté d'`ecrans-ui.json`, l'autre registre d'outillage lu par un garde. */
export const CHEMIN_REGISTRE = 'scripts/hooks/stocks.json'

// ── LE SCHÉMA ────────────────────────────────────────────────────────────────────────────────────

export const FORMES = ['liste', 'objet', 'plafond']
export const ROLES = ['stock', 'descripteur', 'derive']

const ENTREE = z.object({
  fichier: z.string().regex(/^(?:src|scripts|docs)\/[^\s]+$/, 'chemin POSIX depuis la racine du dépôt'),
  liaison: z.string().regex(/^(?:\$(?:\.[^\s.]+)*|[A-Za-z_$][\w$]*)$/, 'nom de liaison, ou `$`/`$.chemin` pour un JSON'),
  forme: z.enum(FORMES),
  role: z.enum(ROLES),
  cible: z.number().int().nonnegative().nullable(),
  raison: z.string().min(MOTIF_MIN),
}).strict()

export const SCHEMA_REGISTRE = z.object({
  _entete: z.array(z.string()).min(1),
  entrees: z.array(ENTREE).min(1),
}).strict().superRefine((registre, ctx) => {
  const vues = new Map()
  for (const [i, e] of registre.entrees.entries()) {
    const cle = cleDeStock(e)
    if (vues.has(cle)) {
      ctx.addIssue({ code: 'custom', path: ['entrees', i], message: `${cle} : déclarée deux fois (déjà à l'entrée ${vues.get(cle)})` })
    }
    vues.set(cle, i)
    if (e.role !== 'stock' && e.cible !== null) {
      ctx.addIssue({ code: 'custom', path: ['entrees', i], message: `${cle} : un \`${e.role}\` n'est jamais compté — sa \`cible\` est \`null\`` })
    }
  }
})

/** La clé d'un stock, telle qu'elle s'écrit dans un `CLIQUET:` — `<fichier>#<LIAISON>`. */
export function cleDeStock({ fichier, liaison }) {
  return `${fichier}#${liaison}`
}

/**
 * Le registre PARSÉ, ou une levée NOMINATIVE. Ne confronte pas le code : `verifierRegistre` le fait
 * (le garde PreToolUse ne peut pas payer un parse de l'arbre à chaque commande).
 * @param {string} brut le JSON du registre @param {string} [ou] d'où il vient, pour le message
 */
export function parserRegistre(brut, ou = CHEMIN_REGISTRE) {
  let json
  try { json = JSON.parse(brut) } catch (err) { throw new Error(`${ou} : JSON illisible — ${err.message}`, { cause: err }) }
  const vu = SCHEMA_REGISTRE.safeParse(json)
  if (!vu.success) {
    const lignes = vu.error.issues.map((i) => `  · ${i.path.join('.') || '<racine>'} : ${i.message}`)
    throw new Error(`${ou} : registre des stocks REFUSÉ au schéma —\n${lignes.join('\n')}`)
  }
  return vu.data
}

let cache = null

/**
 * Le registre du dépôt, mémoïsé.
 * @param {{ racine?: string, fresh?: boolean }} [options]
 */
export function chargerRegistre({ racine = RACINE_DEPOT, fresh = false } = {}) {
  if (cache && !fresh && cache.racine === racine) return cache.registre
  const chemin = join(racine, CHEMIN_REGISTRE)
  const registre = parserRegistre(readFileSync(chemin, 'utf8'), CHEMIN_REGISTRE)
  cache = { racine, registre }
  return registre
}

/**
 * Déclarations par fichier — la vue dont la porte a besoin.
 * @param {{ entrees: any[] }} [registre]
 * @returns {Map<string, any[]>}
 */
export function declarationsParFichier(registre = chargerRegistre()) {
  const par = new Map()
  for (const e of registre.entrees) {
    if (!par.has(e.fichier)) par.set(e.fichier, [])
    par.get(e.fichier).push(e)
  }
  return par
}

/** Les fichiers qui portent au moins un `role: 'stock'` — le périmètre que la porte lit. */
export function fichiersDeclares(registre = chargerRegistre()) {
  return new Set(registre.entrees.filter((e) => e.role === 'stock').map((e) => e.fichier))
}

// ── CE QU'UN FICHIER PORTE : les liaisons de module, par l'AST ────────────────────────────────────

/** Le compilateur du dépôt, chargé À LA DEMANDE (cette lib est atteinte par le garde PreToolUse). */
let compilateur = null
const typescript = () => (compilateur ??= createRequire(import.meta.url)('typescript'))

/** Image parsée d'un fichier, ou `null` si son extension n'a pas de dialecte (`dialecte.mjs`). */
function imageParsee(source, chemin) {
  const kind = scriptKindDe(chemin, { inconnu: 'refus' })
  if (kind === null) return null
  const texte = String(source ?? '')
  const ts = typescript()
  return { ts, sf: ts.createSourceFile(String(chemin), texte, ts.ScriptTarget.Latest, true, kind), texte }
}

/**
 * Lignes (1-based) qui ne vivent PAS au niveau du module. Est LOCAL ce qui vit dans une fonction
 * passée en ARGUMENT d'un appel — le corps d'un `test(…)`, d'un `it(…)`, d'un `describe(…)`, d'un
 * `map(…)` : ce qu'on y écrit meurt avec l'appel. Est de MODULE tout le reste, y compris ce qu'une
 * enveloppe pourrait sembler cacher : une IIFE, une fonction ou une flèche déclarée puis exportée.
 * Marquer toute FunctionLike rendait la règle contournable par trois enveloppes d'une ligne
 * (mesuré 2026-09-04) : un stock reste un stock, quelle que soit la façade qui le sert.
 *
 * BORNE MESURÉE, et c'est une DETTE : un `const` écrit dans un corps de `describe(…)` est LOCAL,
 * donc invisible au registre comme à la porte — six cliquets réels de l'arbre s'y trouvaient
 * (`refs-migrated.test.ts` ×4, `label-logic-guard.test.ts`, `tables.test.ts`), tous hissés en portée
 * de module par #1679 L3b C1. Rien n'EMPÊCHE d'en réécrire un dans un `describe` : le détecteur ne
 * descend pas dans les corps, et cette descente (avec la clé qu'elle exige — deux `BASELINE` dans un
 * même fichier ne peuvent pas partager `<fichier>#BASELINE`) est le train suivant.
 */
function lignesLocales({ ts, sf, texte }) {
  const locales = new Set()
  const marquer = (node) => {
    const debut = sf.getLineAndCharacterOfPosition(node.getStart(sf)).line
    const fin = sf.getLineAndCharacterOfPosition(Math.min(node.end, texte.length)).line
    for (let l = debut; l <= fin; l++) locales.add(l + 1)
  }
  const visiter = (node) => {
    if (ts.isCallExpression(node) || ts.isNewExpression(node)) {
      visiter(node.expression)
      for (const arg of node.arguments ?? []) {
        // Une fonction imbriquée est déjà couverte par l'englobante : la descente s'arrête là.
        if (ts.isFunctionLike(arg)) marquer(arg)
        else visiter(arg)
      }
      return
    }
    ts.forEachChild(node, visiter)
  }
  ts.forEachChild(sf, visiter)
  return locales
}

/** Chemin de dépôt : une racine suivie, puis tout sauf des espaces. */
export const CHEMIN = String.raw`(?:src|scripts|docs)\/[^'"\`\s]+`
/** Nom de fichier NU, extension de code ou de donnée (`'criticals.json'`). */
export const NOM_NU = String.raw`[\w.-]+\.(?:ts|tsx|mjs|mts|json|md|css)`
/** Un littéral de chaîne, déjà déquoté par l'AST, qui NOMME un fichier. */
const NOMME = new RegExp(String.raw`^(?:${CHEMIN}|${NOM_NU})(?::[\w.|:-]+)?(?:\s+\/\/\s*[^'"\`]*)?$`)

/** Le sous-arbre porte-t-il un littéral de chaîne qui NOMME un fichier ? La CLÉ d'une propriété en
 *  fait partie. Sert la seule COMPLÉTUDE : c'est l'inférence qui NOMME un candidat, jamais celle
 *  qui compte. */
function nommeUnFichier(ts, node) {
  let vu = false
  const visiter = (n) => {
    if (vu) return
    if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) {
      if (NOMME.test(n.text)) vu = true
      return
    }
    if (ts.isTemplateExpression(n)) {
      const nu = [n.head.text, ...n.templateSpans.map((s) => s.literal.text)].join('')
      if (NOMME.test(n.head.text) || NOMME.test(nu)) vu = true
      return
    }
    ts.forEachChild(n, visiter)
  }
  visiter(node)
  return vu
}

/** Les enveloppes d'IDENTITÉ : elles ne changent RIEN aux membres, on les traverse. */
const IDENTITES = new Set(['Object.freeze', 'Set', 'Map', 'Array.from', 'Array.of', 'new Set', 'new Map'])

const nomAppele = (ts, expr) => {
  if (ts.isIdentifier(expr)) return expr.text
  if (ts.isPropertyAccessExpression(expr) && ts.isIdentifier(expr.expression)) return `${expr.expression.text}.${expr.name.text}`
  return null
}

/** Le seul `return` d'une fonction, ou son corps d'expression — `null` si elle en porte plusieurs. */
function corpsDeRetour(ts, fn) {
  const corps = fn.body
  if (!corps) return null
  if (!ts.isBlock(corps)) return corps
  const retours = corps.statements.filter((s) => ts.isReturnStatement(s))
  return retours.length === 1 ? retours[0].expression ?? null : null
}

/** La valeur AU REPOS d'une liaison : parenthèses, assertions de type, enveloppes d'identité et
 *  façades de fonction ôtées. Une règle contournable par trois enveloppes d'une ligne ne garde rien. */
function valeurAuRepos(ts, node) {
  let n = node
  for (let garde = 0; n && garde < 12; garde++) {
    if (ts.isParenthesizedExpression(n)) { n = n.expression; continue }
    if (ts.isAsExpression(n) || ts.isTypeAssertionExpression(n) || (ts.isSatisfiesExpression?.(n) ?? false)) { n = n.expression; continue }
    if (ts.isNewExpression(n) && IDENTITES.has(`new ${nomAppele(ts, n.expression)}`) && (n.arguments?.length ?? 0) >= 1) { n = n.arguments[0]; continue }
    if (ts.isCallExpression(n)) {
      if (IDENTITES.has(nomAppele(ts, n.expression)) && n.arguments.length >= 1) { n = n.arguments[0]; continue }
      const appele = ts.isParenthesizedExpression(n.expression) ? n.expression.expression : n.expression
      if (ts.isFunctionLike(appele) && n.arguments.length === 0) {
        const corps = corpsDeRetour(ts, appele)
        if (corps) { n = corps; continue }
      }
    }
    if (ts.isFunctionLike(n)) {
      const corps = corpsDeRetour(ts, n)
      if (corps) { n = corps; continue }
    }
    break
  }
  return n
}

/** La valeur NUMÉRIQUE littérale d'un nœud (`12`, `-3`), ou `null` : une valeur CALCULÉE n'en a pas. */
function valeurNumerique(ts, node) {
  if (!node) return null
  if (ts.isNumericLiteral(node)) return Number(node.text)
  if (ts.isPrefixUnaryExpression(node) && node.operator === ts.SyntaxKind.MinusToken && ts.isNumericLiteral(node.operand)) {
    return -Number(node.operand.text)
  }
  return null
}

/** La CLÉ d'une propriété, telle qu'écrite, ou `null` si elle est calculée. */
function cleDe(ts, prop) {
  const nom = prop.name
  if (!nom) return null
  if (ts.isStringLiteral(nom) || ts.isNoSubstitutionTemplateLiteral(nom) || ts.isIdentifier(nom)) return nom.text
  return null
}

/**
 * Membres d'un littéral, avec leur ligne — c'est ce que `liste` et `objet` comptent.
 * `liste` = les ÉLÉMENTS, sans descente (un élément-objet est UNE entrée : c'est la ligne d'un
 * tuple ou d'une fiche). `objet` = les PROPRIÉTÉS, sauf celles dont la valeur est un TABLEAU : une
 * propriété à valeur de tableau est une RUBRIQUE — un titre au-dessus d'une liste (`'test:hooks':
 * [ … ]`) —, on y descend et on ne la compte pas. Une propriété à valeur d'OBJET reste UNE entrée
 * (`spells: { entrees, lot, date, motif }` de `PROSE_INLINE_TOLEREE` : la fiche est l'entrée, ses
 * quatre champs sont du pilotage).
 */
function membresDe(ts, sf, node) {
  const ligneDe = (n) => sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1
  if (ts.isArrayLiteralExpression(node)) return node.elements.map((e) => ({ ligne: ligneDe(e), noeud: e }))
  if (!ts.isObjectLiteralExpression(node)) return []
  const out = []
  for (const prop of node.properties) {
    const rubrique = prop.initializer && ts.isArrayLiteralExpression(prop.initializer)
    if (rubrique) out.push(...membresDe(ts, sf, prop.initializer))
    else out.push({ ligne: ligneDe(prop), noeud: prop })
  }
  return out
}

/** Toutes les lignes d'un sous-arbre qui portent un membre NOMMANT un fichier, rubriques comprises
 *  (l'INFÉRENCE d'avant ce train, conservée pour la seule complétude). */
function lignesNommantUnFichier(ts, sf, racine, locales) {
  const ligneDe = (n) => sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1
  const lignes = new Set()
  const litteral = (n) => n && (ts.isArrayLiteralExpression(n) || ts.isObjectLiteralExpression(n))
  const parcourir = (node) => {
    if (!litteral(node) || locales.has(ligneDe(node))) return
    if (ts.isArrayLiteralExpression(node)) {
      for (const el of node.elements) if (nommeUnFichier(ts, el)) lignes.add(ligneDe(el))
      return
    }
    for (const prop of node.properties) {
      const cle = cleDe(ts, prop)
      if (cle !== null && NOMME.test(cle)) { lignes.add(ligneDe(prop)); continue }
      if (litteral(prop.initializer)) { parcourir(prop.initializer); continue }
      if (nommeUnFichier(ts, prop)) lignes.add(ligneDe(prop))
    }
  }
  parcourir(racine)
  return [...lignes].sort((a, b) => a - b)
}

/** La forme d'une valeur au repos, ou `null` : une valeur CALCULÉE n'en a aucune. */
function formeDe(ts, valeur) {
  if (!valeur) return null
  if (ts.isArrayLiteralExpression(valeur)) return 'liste'
  if (ts.isObjectLiteralExpression(valeur)) return 'objet'
  if (valeurNumerique(ts, valeur) !== null) return 'plafond'
  return null
}

/** Une liaison, telle que l'AST la rend. */
function liaisonDe(ts, sf, locales, liaison, ligne, initialiseur) {
  const valeur = initialiseur ? valeurAuRepos(ts, initialiseur) : null
  const forme = formeDe(ts, valeur)
  const membres = valeur ? membresDe(ts, sf, valeur) : []
  return {
    liaison,
    ligne,
    forme,
    entrees: membres.map((m) => m.ligne),
    nommantUnFichier: valeur && forme !== 'plafond' ? lignesNommantUnFichier(ts, sf, valeur, locales) : [],
    valeur: valeurNumerique(ts, valeur),
    litteralNumerique: initialiseur ? valeurNumerique(ts, valeurAuRepos(ts, initialiseur)) !== null : false,
  }
}

/** Chemin d'une propriété JSON depuis la racine (`$`, `$.ecrans`). */
const cheminJson = (prefixe, cle) => `${prefixe}.${cle}`

/**
 * Les LIAISONS de module d'un fichier, avec leur forme et leurs membres — ou `null` si le dialecte
 * n'a pas d'AST ici. En JSON, les liaisons sont le document (`$`) et ses propriétés directes.
 * @param {string} source @param {string} chemin
 * @returns {{ liaison: string, ligne: number, forme: string|null, entrees: number[],
 *   nommantUnFichier: number[], valeur: number|null, litteralNumerique: boolean }[] | null}
 */
export function liaisonsDuFichier(source, chemin) {
  const img = imageParsee(source, chemin)
  if (!img) return null
  const { ts, sf } = img
  const locales = lignesLocales(img)
  const ligneDe = (n) => sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1
  const out = []
  if (/\.json$/i.test(String(chemin))) {
    const racine = sf.statements.find((s) => ts.isExpressionStatement(s))?.expression
    if (!racine) return []
    out.push(liaisonDe(ts, sf, locales, '$', ligneDe(racine), racine))
    if (ts.isObjectLiteralExpression(racine)) {
      for (const prop of racine.properties) {
        const cle = cleDe(ts, prop)
        if (cle === null || !prop.initializer) continue
        out.push(liaisonDe(ts, sf, locales, cheminJson('$', cle), ligneDe(prop), prop.initializer))
      }
    }
    return out
  }
  for (const stmt of sf.statements) {
    if (ts.isVariableStatement(stmt)) {
      for (const decl of stmt.declarationList.declarations) {
        if (!ts.isIdentifier(decl.name)) continue
        out.push(liaisonDe(ts, sf, locales, decl.name.text, ligneDe(decl), decl.initializer ?? null))
      }
      continue
    }
    if (ts.isFunctionDeclaration(stmt) && stmt.name) {
      out.push(liaisonDe(ts, sf, locales, stmt.name.text, ligneDe(stmt), corpsDeRetour(ts, stmt)))
    }
  }
  return out
}

/** La liaison nommée `liaison` du fichier, ou `null`. */
export function liaisonNommee(source, chemin, liaison) {
  return (liaisonsDuFichier(source, chemin) ?? []).find((l) => l.liaison === liaison) ?? null
}

// ── LA COMPLÉTUDE : trois détecteurs, un verdict ──────────────────────────────────────────────────

/** Combien de membres NOMMANT UN FICHIER font d'une liaison un candidat par sa FORME. */
export const SEUIL_FORME = 3

/** Un nom de liaison qui ANNONCE une dette. Les deux derniers jetons du lexique — l'anglicisme
 *  d'héritage et le mot d'étalon — y sont parce qu'ils nomment 5 stocks réels que ni la FORME ni les
 *  deux autres détecteurs ne voyaient : `jambes-gabarit-ratchet.test.ts` (97 gabarits à migrer) et
 *  `ui-ratchets.test.ts` (33 sélecteurs de classe), dont les deux frères d'étalon du même fichier
 *  étaient, eux, déclarés par la FORME. `ATTENDU` et `_MAX` en sont absents à dessein : le premier
 *  nomme surtout des tables de contrôle, le second 43 bornes de moteur (`ZOOM_MAX`, `PARTY_MAX`,
 *  `WS_MAX`) — la FORME et le CLIQUET SCALAIRE les rattrapent quand ils sont des stocks (juge C1). */
export const NOM_DE_STOCK = /^[A-Z_]*(?:STOCK|EXEMPT|DETTE|TOLER|GEL[ÉE]E?S?|RATCHET|ORPHELIN|RECOUVR|LEGACY|BASELINE)/

/** Un scalaire CONFRONTÉ à une mesure : `toBeLessThanOrEqual(MAX)`, `x <= MAX`, `assert.ok(n < MAX)`,
 *  `if (taille > SEUIL)`. Le sens de la comparaison ne sépare pas un cliquet d'une tolérance —
 *  `size > SEUIL_OCTETS` COLLECTE ce qui dépasse et `n <= MAX` ASSERTE, les deux sont des cliquets —,
 *  alors le détecteur retient TOUTE confrontation et le REGISTRE tranche par le rôle. */
const confronteAUneMesure = (texte, nom) => new RegExp(
  String.raw`(?:toBeLessThanOrEqual|toBeLessThan|toBeGreaterThanOrEqual|toBeGreaterThan)\s*\(\s*${nom}\b`
  + String.raw`|[<>]=?\s*${nom}\b`,
).test(texte)

/** Les fichiers où un candidat peut vivre : tout le code du dépôt, et les tables JSON d'outillage. */
export const RACINES_CANDIDATES = ['src', 'scripts']
const EXTENSION_DE_CODE = /\.(?:ts|tsx|mjs|mts|js|jsx)$/
const JSON_DOUTILLAGE = /^scripts\/(?:hooks|ops)\/[^/]+\.json$/
const HORS_PERIMETRE = /(?:\.d\.mts|\.d\.ts)$/

/** Le fichier peut-il porter un candidat ? */
export function estFichierCandidat(rel) {
  const p = String(rel ?? '').replace(/\\/g, '/')
  if (HORS_PERIMETRE.test(p)) return false
  if (JSON_DOUTILLAGE.test(p)) return true
  if (!EXTENSION_DE_CODE.test(p)) return false
  return RACINES_CANDIDATES.some((r) => p.startsWith(`${r}/`))
}

/**
 * Les fichiers du dépôt susceptibles de porter un candidat, triés.
 * @param {string} [racine]
 */
export function listerFichiersCandidats(racine = RACINE_DEPOT) {
  const out = []
  for (const r of RACINES_CANDIDATES) {
    for (const rel of listerArbre(join(racine, r), { descendre: (d) => !/(?:^|\/)node_modules$/.test(d), absent: 'vide' })) {
      const chemin = `${r}/${rel}`
      if (estFichierCandidat(chemin)) out.push(chemin)
    }
  }
  return out.sort(parUnitesDeCode)
}

/**
 * Les CANDIDATS d'un fichier : ce qui DOIT être déclaré au registre, avec le détecteur qui l'a
 * nommé. Trois détecteurs, une union — aucun ne juge, ils NOMMENT.
 *   · `forme` — une liaison dont au moins `SEUIL_FORME` membres nomment un fichier ;
 *   · `nom` — une liaison dont le NOM annonce une dette ;
 *   · `cliquet` — dans un fichier de test, un scalaire COMPARÉ à une mesure.
 * @param {string} source @param {string} chemin
 * @returns {{ liaison: string, ligne: number, forme: string|null, detecteurs: string[] }[]}
 */
export function candidatsDuFichier(source, chemin) {
  const liaisons = liaisonsDuFichier(source, chemin)
  if (!liaisons) return []
  const estTest = /\.(?:test|spec)\./.test(String(chemin).replace(/\\/g, '/').split('/').pop() ?? '')
  const texte = String(source ?? '')
  const out = []
  for (const l of liaisons) {
    // Une liaison SANS forme comptable — une regex, une chaîne, une fonction, une valeur CALCULÉE —
    // ne peut pas être un stock : la nommer candidate ferait entrer au registre 3 regex et 14
    // constantes de pilotage que le seul NOM attrape (mesure du juge de design, #1679 L3b C1).
    if (l.forme === null) continue
    // En JSON, le DOCUMENT (`$`) est le seul candidat : ses rubriques sont déjà dans son compte, et
    // les nommer candidates ferait déclarer deux fois la même croissance. Une rubrique se DÉCLARE
    // quand c'est elle le stock (`$.ecrans`) — la déclaration est alors plus fine que le détecteur.
    if (l.liaison.startsWith('$.')) continue
    const detecteurs = []
    if (l.nommantUnFichier.length >= SEUIL_FORME) detecteurs.push('forme')
    if (l.liaison !== '$' && NOM_DE_STOCK.test(l.liaison)) detecteurs.push('nom')
    if (estTest && l.forme === 'plafond' && confronteAUneMesure(texte, l.liaison)) detecteurs.push('cliquet')
    if (detecteurs.length) out.push({ liaison: l.liaison, ligne: l.ligne, forme: l.forme, detecteurs })
  }
  return out
}

/**
 * Confrontation du registre au CODE : une déclaration dont la liaison n'existe pas, ou dont la
 * forme ne correspond pas à ce que le code porte, est un écart NOMMÉ. `plafond` exige une valeur
 * LITTÉRALE numérique — une valeur calculée se déclare `role: 'derive'`, jamais comptée.
 * @param {{ entrees: any[] }} registre
 * @param {(fichier: string) => string | null} lire
 * @returns {string[]} écarts, vides si le registre dit vrai
 */
export function verifierRegistre(registre, lire) {
  const ecarts = []
  for (const e of registre.entrees) {
    const cle = cleDeStock(e)
    let source
    try { source = lire(e.fichier) } catch { source = null }
    if (typeof source !== 'string') { ecarts.push(`${cle} : le fichier déclaré n'existe pas`); continue }
    const l = liaisonNommee(source, e.fichier, e.liaison)
    if (!l) { ecarts.push(`${cle} : la liaison déclarée n'existe pas en portée de module`); continue }
    if (e.role === 'derive') continue
    if (e.forme === 'plafond') {
      if (!l.litteralNumerique) {
        ecarts.push(`${cle} : \`plafond\` sans valeur LITTÉRALE numérique — une valeur calculée se déclare \`role: 'derive'\``)
      }
      continue
    }
    if (l.forme !== e.forme) {
      ecarts.push(`${cle} : déclarée \`${e.forme}\`, le code porte \`${l.forme ?? 'une valeur calculée'}\``)
    }
  }
  return ecarts
}

/**
 * Les CANDIDATS de l'arbre qui ne sont DÉCLARÉS nulle part — le second sens de la complétude.
 * @param {{ entrees: any[] }} registre
 * @param {{ racine?: string, fichiers?: string[], lire?: (f: string) => string }} [options]
 * @returns {{ cle: string, ligne: number, detecteurs: string[] }[]}
 */
export function candidatsNonDeclares(registre, { racine = RACINE_DEPOT, fichiers = null, lire = null } = {}) {
  const declares = new Set(registre.entrees.map(cleDeStock))
  const lecteur = lire ?? ((f) => readFileSync(join(racine, f), 'utf8'))
  const out = []
  for (const fichier of fichiers ?? listerFichiersCandidats(racine)) {
    if (fichier === CHEMIN_REGISTRE) continue
    let source
    try { source = lecteur(fichier) } catch { source = null }
    if (source === null) continue
    for (const c of candidatsDuFichier(source, fichier)) {
      const cle = cleDeStock({ fichier, liaison: c.liaison })
      if (!declares.has(cle)) out.push({ cle, ligne: c.ligne, detecteurs: c.detecteurs })
    }
  }
  return out.sort((a, b) => parUnitesDeCode(a.cle, b.cle))
}
