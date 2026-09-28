/**
 * Valeur ABSTRAITE des expressions d'une source parmi les globales et modules intégrés de Node que lisent
 * les gardes de #1801 (`pointDEntree.mjs`, `graphiesDHote.mjs`), sur l'AST TypeScript : un commentaire
 * n'est pas du code, une chaîne non plus.
 *
 * Valeurs CONTENEURS, transmises par une liaison à un nom (déclaration, paramètre, affectation `=`,
 * déstructuration d'objet ou de tableau, import) et par alias d'alias :
 *   `process`, `globalThis` (`globalThis`, `global`), `module` (le `module` CommonJS), `module:module`
 *   (le module intégré `node:module`), `require`, `createRequire`, `getBuiltinModule`, `import.meta`,
 *   `argv:<k>` (le tableau `argv` privé de ses `k` premiers éléments, `k` saturé à `SATURATION`).
 * Valeurs TERMINALES, lues au site qui les produit, jamais transmises par une liaison :
 *   `element:<i>` (l'élément `i` d'`argv`, `i` saturé à `SATURATION`), `identite` (`import.meta.url`,
 *   `import.meta.filename`, `__filename`), `hote` (`import.meta.dirname`, `import.meta.filename`,
 *   `__dirname`, `__filename` : le chargeur CJS les pose, `.cjs`/`.cts` compris),
 *   `import.meta.main`, `require.main`, `process.mainModule`, `module.parent`, `module:<M>` (le module
 *   intégré `M`, sans préfixe `node:`, acquis par un appel de `require` ou de `getBuiltinModule`).
 *
 * Formes lues : accès `.`, `?.`, crochets à clé littérale ; appels `f(…)`, `f?.(…)` ; parenthèses,
 * `!`, `as`, `satisfies`, `<T>` ; `await` ; `a ? b : c`, `a ?? b`, `a || b` (l'une ou l'autre) ;
 * identifiants, clés et spécificateurs écrits avec des séquences d'échappement (TypeScript les décode).
 * Sur `argv:<k>` : `[i]` (clé entière), `.at(i)`, `.shift()`, `.slice(s[, fin])`, où `i`, `s` est absent
 * ou un littéral (nombre ou chaîne) tronqué comme ToIntegerOrInfinity, retenu s'il est >= 0.
 * Reste de déstructuration d'objet (`{ ...r } = base`) : lié à la valeur de la base, qu'il porte.
 * Espaces de noms : `default` d'un espace de noms de `node:process` ou `node:module` vaut le module.
 * Acquisitions : `require`, `module.require`, `createRequire(…)`, `getBuiltinModule` (nu ou membre
 * de `process`), `import('…')` pour `process` et `module` seulement. `createRequire` se lit nu, comme
 * membre de `node:module` (import, `require('module')`, `getBuiltinModule('module')`,
 * `import('node:module')`) ou comme membre du nom `module`, qui est aussi l'import usuel de
 * `node:module` (l'objet CommonJS n'a pas de `createRequire`).
 *
 * HORS DE PORTÉE : la portée lexicale (un nom est lié pour tout le fichier, et les noms de `GLOBALES` —
 * `process`, `globalThis`, `global`, `module`, `require`, `createRequire`, `getBuiltinModule`,
 * `__filename`, `__dirname` — valent leur globale quel que soit leur masquage) ; une clé calculée non
 * littérale (`process[cle]`) ; `.at(-i)`, `.pop()` ; la copie (`[...argv]`, `Array.from(argv)`) ;
 * `&&` ; une valeur terminale liée puis relue par son nom ; `import x = require(…)`.
 */
import typescript from 'typescript'
// Liaison LOCALE : sous Vitest, l'import transformé relit `.default` à chaque accès — mesuré sur le
// balayage de `src/point-d-entree-guard.test.ts`, 4,7 s par l'import nu, 2,4 s par la liaison.
const ts = typescript
import { scriptKindDe } from './dialecte.mjs'

/**
 * Borne des décalages et indices d'`argv` : aucune règle ne lit au-delà de l'élément 1, et
 * `min(min(k, S) + s, S) = min(k + s, S)` — la saturation ne perd rien et rend le domaine FINI.
 */
const SATURATION = 2
const tranche = (k) => `argv:${Math.min(k, SATURATION)}`
const elementDArgv = (i) => `element:${Math.min(i, SATURATION)}`

const CONTENEUR = /^(?:process|globalThis|module|module:module|require|createRequire|getBuiltinModule|import\.meta|argv:\d+)$/

const GLOBALES = new Map([
  ['process', ['process']],
  ['globalThis', ['globalThis']],
  ['global', ['globalThis']],
  ['module', ['module']],
  ['require', ['require']],
  ['createRequire', ['createRequire']],
  ['getBuiltinModule', ['getBuiltinModule']],
  ['__filename', ['identite', 'hote']],
  ['__dirname', ['hote']],
])

/** Résultat vide partagé : jamais muté. */
const VIDE = new Set()

const MEMBRES = {
  globalThis: { process: ['process'], globalThis: ['globalThis'], global: ['globalThis'] },
  process: { argv: ['argv:0'], mainModule: ['process.mainModule'], getBuiltinModule: ['getBuiltinModule'], default: ['process'] },
  module: { require: ['require'], parent: ['module.parent'], createRequire: ['createRequire'] },
  'module:module': { createRequire: ['createRequire'], default: ['module:module'] },
  require: { main: ['require.main'] },
  'import.meta': { url: ['identite'], filename: ['identite', 'hote'], dirname: ['hote'], main: ['import.meta.main'] },
}

/** Modules dont un espace de noms (`import`, `import()`) porte une valeur conteneur. */
const ESPACES_DE_NOMS = new Set(['process', 'module'])

/**
 * Sans antislash, le texte décodé d'un littéral ou d'un identifiant EST son texte brut : une source
 * sans antislash se lit donc entière dans ses termes, et une source qui en porte un est parsée.
 */
const ANTISLASH = '\\'

/** Expression débarrassée de ce qui ne change pas sa valeur. */
const nu = (e) => {
  while (
    ts.isParenthesizedExpression(e) ||
    ts.isNonNullExpression(e) ||
    ts.isAsExpression(e) ||
    ts.isSatisfiesExpression(e) ||
    ts.isTypeAssertionExpression(e)
  )
    e = e.expression
  return e
}

/** Clé littérale d'un accès ou d'une propriété : identifiant, chaîne, nombre, `[littéral]`. `null` sinon. */
function cleDe(n) {
  if (!n) return null
  if (ts.isComputedPropertyName(n)) return cleDe(n.expression)
  n = nu(n)
  if (ts.isIdentifier(n) || ts.isPrivateIdentifier(n) || ts.isStringLiteralLike(n)) return n.text
  if (ts.isNumericLiteral(n)) return String(Number(n.text))
  return null
}

/**
 * Argument entier d'`at`/`slice` : absent vaut 0 ; un littéral (nombre, `-` nombre, chaîne) est tronqué
 * comme ToIntegerOrInfinity (NaN vaut 0, −0 vaut 0). `null` s'il n'est pas littéral, ou < 0.
 * @param {ts.Expression | undefined} argument
 */
function entierDe(argument) {
  if (!argument) return 0
  const n = nu(argument)
  let v = null
  if (ts.isNumericLiteral(n) || ts.isStringLiteralLike(n)) v = Number(n.text)
  else if (ts.isPrefixUnaryExpression(n) && n.operator === ts.SyntaxKind.MinusToken && ts.isNumericLiteral(n.operand)) v = -Number(n.operand.text)
  if (v === null) return null
  const entier = Number.isNaN(v) ? 0 : Math.trunc(v) + 0
  return entier >= 0 ? entier : null
}

/** Nom de module intégré, sans préfixe `node:`, d'un premier argument littéral. `null` sinon. */
function moduleDe(argument) {
  const n = argument && nu(argument)
  return n && ts.isStringLiteralLike(n) ? n.text.replace(/^node:/, '') : null
}

/**
 * Objet et nom de la méthode appelée (`o.m(…)`, `o?.m(…)`, `o['m'](…)`) ; `null` pour un appel qui
 * n'est pas une méthode ou dont le nom n'est pas littéral.
 * @param {ts.CallExpression} appel
 * @returns {{ objet: ts.Expression, methode: string } | null}
 */
export function methodeAppelee(appel) {
  const callee = nu(appel.expression)
  if (ts.isPropertyAccessExpression(callee)) return { objet: callee.expression, methode: callee.name.text }
  if (ts.isElementAccessExpression(callee)) {
    const methode = cleDe(callee.argumentExpression)
    return methode === null ? null : { objet: callee.expression, methode }
  }
  return null
}

const decalage = (v) => (v.startsWith('argv:') ? Number(v.slice(5)) : null)

/** Valeurs de la clé `cle` lue sur des valeurs de base. */
function membre(bases, cle) {
  const out = new Set()
  if (cle === null) return out
  for (const b of bases) {
    const k = decalage(b)
    if (k !== null && /^\d+$/.test(cle)) out.add(elementDArgv(k + Number(cle)))
    const table = Object.hasOwn(MEMBRES, b) ? MEMBRES[b] : {}
    for (const v of Object.hasOwn(table, cle) ? table[cle] : []) out.add(v)
  }
  return out
}

/** Valeurs de l'élément `j` (ou du reste à partir de `j`) d'une déstructuration de tableau. */
function element(bases, j, reste) {
  const out = new Set()
  for (const b of bases) {
    const k = decalage(b)
    if (k !== null) out.add(reste ? tranche(k + j) : elementDArgv(k + j))
  }
  return out
}

/** Valeurs d'une acquisition de module intégré. */
const acquis = (module) => new Set(module === null ? [] : module === 'process' ? ['process'] : [`module:${module}`])

/**
 * Évaluateur des valeurs d'un fichier, pour une table de liaisons donnée.
 * @param {Map<string, Set<string>>} liaisons nom → valeurs conteneurs
 */
function evaluateur(liaisons) {
  const memo = new Map()
  const valeurs = (e) => {
    const n = nu(e)
    let v = memo.get(n)
    if (!v) {
      memo.set(n, VIDE)
      v = calculer(n)
      memo.set(n, v)
    }
    return v
  }
  const calculer = (n) => {
    if (ts.isIdentifier(n)) {
      const liees = liaisons.get(n.text)
      const globale = GLOBALES.get(n.text)
      if (!globale) return liees ?? VIDE
      return new Set([...(liees ?? []), ...globale])
    }
    if (ts.isMetaProperty(n) && n.keywordToken === ts.SyntaxKind.ImportKeyword && n.name.text === 'meta') return new Set(['import.meta'])
    if (ts.isPropertyAccessExpression(n)) return membre(valeurs(n.expression), n.name.text)
    if (ts.isElementAccessExpression(n)) return membre(valeurs(n.expression), cleDe(n.argumentExpression))
    if (ts.isAwaitExpression(n)) return valeurs(n.expression)
    if (ts.isConditionalExpression(n)) return new Set([...valeurs(n.whenTrue), ...valeurs(n.whenFalse)])
    if (
      ts.isBinaryExpression(n) &&
      (n.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken || n.operatorToken.kind === ts.SyntaxKind.BarBarToken)
    )
      return new Set([...valeurs(n.left), ...valeurs(n.right)])
    if (ts.isCallExpression(n)) return appel(n)
    return VIDE
  }
  const appel = (n) => {
    if (n.expression.kind === ts.SyntaxKind.ImportKeyword) {
      const module = moduleDe(n.arguments[0])
      return ESPACES_DE_NOMS.has(module) ? acquis(module) : VIDE
    }
    const out = new Set()
    const appele = valeurs(n.expression)
    if (appele.has('require') || appele.has('getBuiltinModule')) for (const v of acquis(moduleDe(n.arguments[0]))) out.add(v)
    if (appele.has('createRequire')) out.add('require')
    const methode = methodeAppelee(n)
    if (!methode) return out
    for (const b of valeurs(methode.objet)) {
      const k = decalage(b)
      if (k === null) continue
      const i = entierDe(n.arguments[0])
      if (methode.methode === 'at' && i !== null) out.add(elementDArgv(k + i))
      if (methode.methode === 'shift') out.add(elementDArgv(k))
      if (methode.methode === 'slice' && i !== null) out.add(tranche(k + i))
    }
    return out
  }
  return valeurs
}

/** Cible d'un élément de motif d'affectation, débarrassée de sa valeur par défaut. */
const cibleDe = (e) =>
  ts.isBinaryExpression(e) && e.operatorToken.kind === ts.SyntaxKind.EqualsToken ? e.left : e

/**
 * Lie une cible (nom, motif de déclaration ou d'affectation) à des valeurs ; note les sites `motif`
 * (élément de déstructuration) et `nom` (nom lié).
 */
function lier(cible, vals, liaisons, sites) {
  cible = nu(cible)
  if (ts.isIdentifier(cible)) {
    sites.push({ noeud: cible, sorte: 'nom', valeurs: vals })
    const conteneurs = [...vals].filter((v) => CONTENEUR.test(v))
    if (!conteneurs.length) return
    const deja = liaisons.get(cible.text) ?? new Set()
    for (const v of conteneurs) deja.add(v)
    liaisons.set(cible.text, deja)
    return
  }
  const sous = (noeud, cibleSuivante, v) => {
    sites.push({ noeud, sorte: 'motif', valeurs: v })
    lier(cibleSuivante, v, liaisons, sites)
  }
  if (ts.isObjectBindingPattern(cible)) {
    for (const el of cible.elements) {
      sous(el, el.name, el.dotDotDotToken ? vals : membre(vals, cleDe(el.propertyName ?? el.name)))
    }
  } else if (ts.isArrayBindingPattern(cible)) {
    cible.elements.forEach((el, j) => {
      if (ts.isBindingElement(el)) sous(el, el.name, element(vals, j, Boolean(el.dotDotDotToken)))
    })
  } else if (ts.isObjectLiteralExpression(cible)) {
    for (const p of cible.properties) {
      if (ts.isPropertyAssignment(p)) sous(p, cibleDe(p.initializer), membre(vals, cleDe(p.name)))
      else if (ts.isShorthandPropertyAssignment(p)) sous(p, p.name, membre(vals, p.name.text))
      else if (ts.isSpreadAssignment(p)) sous(p, p.expression, vals)
    }
  } else if (ts.isArrayLiteralExpression(cible)) {
    cible.elements.forEach((el, j) => {
      if (ts.isOmittedExpression(el)) return
      if (ts.isSpreadElement(el)) sous(el, el.expression, element(vals, j, true))
      else sous(el, cibleDe(el), element(vals, j, false))
    })
  }
}

/** Valeurs qu'un import lie à chacun de ses noms. */
function lierImport(decl, liaisons, sites) {
  const module = moduleDe(decl.moduleSpecifier)
  const clause = decl.importClause
  if (!clause || module === null) return
  const base = ESPACES_DE_NOMS.has(module) ? acquis(module) : VIDE
  if (clause.name) lier(clause.name, base, liaisons, sites)
  const liens = clause.namedBindings
  if (liens && ts.isNamespaceImport(liens)) lier(liens.name, base, liaisons, sites)
  if (liens && ts.isNamedImports(liens)) {
    for (const s of liens.elements) lier(s.name, membre(base, (s.propertyName ?? s.name).text), liaisons, sites)
  }
}

/** Globales de `GLOBALES` qui SONT une valeur terminale, lues par leur seul nom. */
const GLOBALES_TERMINALES = new Set([...GLOBALES].filter(([, v]) => !v.some((x) => CONTENEUR.test(x))).map(([nom]) => nom))

/**
 * Le nœud peut-il PRODUIRE une valeur terminale ? Accès, appel, et une globale de
 * `GLOBALES_TERMINALES` lue comme valeur ; les autres formes ne font que relayer celle d'un nœud
 * enfant, déjà site.
 */
const produitTerminal = (n) =>
  ts.isPropertyAccessExpression(n) ||
  ts.isElementAccessExpression(n) ||
  ts.isCallExpression(n) ||
  (ts.isIdentifier(n) && GLOBALES_TERMINALES.has(n.text) && n.parent.name !== n && n.parent.propertyName !== n)

/**
 * Liaisons du fichier jouées jusqu'au point fixe (un alias d'alias se lie au tour suivant) : rend
 * l'évaluateur des liaisons stables et les sites `motif`/`nom` du dernier tour. TERMINE : chaque tour
 * copie les liaisons du précédent puis y ajoute, et le domaine est fini (noms du fichier × valeurs
 * conteneurs, décalages d'`argv` saturés) ; le tour qui n'ajoute rien est le point fixe.
 */
function pointFixe(imports, liens) {
  let liaisons = new Map()
  for (let taille = -1; ; ) {
    const valeursDe = evaluateur(liaisons)
    const suivantes = new Map([...liaisons].map(([nom, v]) => [nom, new Set(v)]))
    const sites = []
    for (const d of imports) lierImport(d, suivantes, sites)
    for (const [cible, valeur] of liens) lier(cible, valeursDe(valeur), suivantes, sites)
    const nouvelle = [...suivantes.values()].reduce((s, v) => s + v.size, 0)
    if (nouvelle === taille) return { valeursDe, sites }
    taille = nouvelle
    liaisons = suivantes
  }
}

/**
 * Préfiltre textuel UNIQUE des gardes : une source est parsée si elle porte un antislash (`ANTISLASH`)
 * ou un des `termes` (une entrée tableau exige tous ses motifs). Les `termes` d'une garde sont ceux
 * sans lesquels aucune de ses règles ne conclut ; hors antislash, ils se lisent dans le texte brut.
 * @param {string} source
 * @param {ReadonlyArray<RegExp | readonly RegExp[]>} termes
 */
const aParser = (source, termes) =>
  source.includes(ANTISLASH) || termes.some((t) => (Array.isArray(t) ? t.every((m) => m.test(source)) : t.test(source)))

/**
 * Sites d'une source retenus par `retenir`, rendus en `{ ligne, extrait }` : `ligne` 1-based de la
 * source d'origine au découpage de TypeScript (`\r\n`, `\n`, `\r`, U+2028, U+2029), `extrait` cette
 * ligne rognée ; une ligne par site, sans doublon, triées.
 * @param {string} source texte du fichier
 * @param {string} chemin nom du fichier, qui fixe le dialecte (`scriptKindDe`)
 * @param {{ termes: ReadonlyArray<RegExp | readonly RegExp[]>,
 *   retenir: (site: { noeud: ts.Node, sorte: 'expression' | 'motif' | 'nom', valeurs: Set<string>,
 *   valeursDe: (e: ts.Expression) => Set<string> }) => boolean }} garde `termes` sans lesquels aucune
 *   règle de la garde ne conclut (préfiltre `aParser`), et le prédicat des sites retenus
 * @returns {{ ligne: number, extrait: string }[]}
 */
export function sitesDeGlobalesNode(source, chemin, { termes, retenir }) {
  if (!aParser(source, termes)) return []
  const sf = ts.createSourceFile(chemin, source, ts.ScriptTarget.Latest, true, scriptKindDe(chemin))
  const liens = []
  const imports = []
  const expressions = []
  const parcourir = (n) => {
    if (ts.isImportDeclaration(n)) imports.push(n)
    else if ((ts.isVariableDeclaration(n) || ts.isParameter(n)) && n.initializer) liens.push([n.name, n.initializer])
    else if (ts.isBinaryExpression(n) && n.operatorToken.kind === ts.SyntaxKind.EqualsToken) liens.push([n.left, n.right])
    if (produitTerminal(n)) expressions.push(n)
    ts.forEachChild(n, parcourir)
  }
  parcourir(sf)

  const { valeursDe, sites } = pointFixe(imports, liens)
  const trouvees = new Set()
  const candidats = [...expressions.map((noeud) => ({ noeud, sorte: 'expression', valeurs: valeursDe(noeud) })), ...sites]
  for (const site of candidats) {
    if (site.valeurs.size && retenir({ ...site, valeursDe })) {
      trouvees.add(sf.getLineAndCharacterOfPosition(site.noeud.getStart(sf)).line)
    }
  }
  const debuts = sf.getLineStarts()
  return [...trouvees]
    .sort((a, b) => a - b)
    .map((l) => ({ ligne: l + 1, extrait: source.slice(debuts[l], debuts[l + 1] ?? source.length).trim() }))
}
