// LES ENTRÉES DES PROCESSUS ENFANTS (#3337, #5037 L2) : le module qu'un lancement Node d'un module (`child_process`,
// `sortieOutilLocal` de `scripts/lancer-local.mjs`) fait exécuter, lu sur son arbre syntaxique. Deux lecteurs : le mur
// de clôture des zones qui survivent (`scripts/corpus/guards/clotureDesZonesQuiSurvivent.test.mjs`), qui suit la clôture
// de chaque enfant, et la suite d'une zone (`selectionDeLaZone`, scripts/test/selectionDeZone.mjs), qui classe un lanceur
// par ses enfants quand chacun de ses lancements se PROUVE (`enfantsProuves`).
import { readFileSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { paquetDe } from './arcsDImport.mjs'
import { analyserTexte, typescript } from './dialecte.mjs'
import { ciblesDEcritureDeCommande, lancementDInterpreteur } from './ecrituresShell.mjs'
import { CHEMIN_TSCONFIG, aliasDe, arbreDuDisque, estModule, resolveImport } from './importGraph.mjs'
import { evaluer, lecteurDExpressions, valeursDAcquisition } from './racinesBalayees.mjs'

const EXTERIEURS_JS = new Set(['node', 'node.exe', 'tsx', 'npx'])
const LANCEURS_NODE = new Set(['fork', 'spawn', 'spawnSync', 'execFile', 'execFileSync'])
const LANCEURS_SHELL = new Set(['exec', 'execSync'])
const MOT_OPAQUE = '\0'

/** Les spécificateurs du module des processus enfants. */
export const MODULES_ENFANTS = Object.freeze(['node:child_process', 'child_process'])
const estModuleEnfant = (spec) => MODULES_ENFANTS.includes(spec)

/**
 * Le DÉPÔT que lisent `entreesDesEnfants` et `valeursDAcquisition` sur l'ensemble `image` (chemins relatifs à `racine`) :
 * `arbre` (`arbreDuDisque` de l'ensemble), `cibleDe` (le chemin relatif que résout un spécificateur, alias du
 * `tsconfig.json` de l'ensemble compris, `null` hors du disque) et `depot` (`arbreDe`, arbres mémoïsés, et `cible`,
 * restreinte à l'ensemble).
 * @param {string} racine @param {ReadonlySet<string>} image
 */
export function lecteurDuDepot(racine, image) {
  const abs = (rel) => join(racine, rel).split('\\').join('/')
  const relDe = (a) => relative(racine, a).split('\\').join('/')
  const arbre = arbreDuDisque([...image].map(abs))
  const alias = aliasDe(image.has(CHEMIN_TSCONFIG) ? readFileSync(abs(CHEMIN_TSCONFIG), 'utf8') : null, racine)
  const cibleDe = (rel, spec) => {
    const c = resolveImport(abs(rel), spec, arbre.existe, alias, 'dynamique', racine)
    return c === null ? null : relDe(c)
  }
  const arbres = new Map()
  const depot = {
    arbreDe: (rel) => {
      if (!image.has(rel) || !estModule(rel)) return null
      if (!arbres.has(rel)) arbres.set(rel, analyserTexte({ rel, text: readFileSync(abs(rel), 'utf8') }).sourceFile)
      return arbres.get(rel)
    },
    cible: (rel, spec) => { const c = cibleDe(rel, spec); return c !== null && image.has(c) ? c : null },
  }
  return { arbre, cibleDe, depot }
}

/** Les entrées d'enfants bornées par leur lancement Node, depuis leur cwd. Le code en ligne, les
 *  options d'environnement, les relais et les argv indéterminés demandent une mesure distincte.
 *  `prouve` : le lancement est un `node` de `LANCEURS_NODE` dont chaque script est un littéral résolu en module de
 *  `image`, sans code en ligne ni environnement qui pose `NODE_OPTIONS` (`envSansPrechargement`) ; `noeud` : son appel. */
export function entreesDesEnfants(rel, sourceFile, sites, depot, racine, image) {
  const estOutilLocal = (spec) => spec?.endsWith('/lancer-local.mjs') && depot.cible(rel, spec) === 'scripts/lancer-local.mjs'
  if (!sites.some(({ spec }) => estModuleEnfant(spec) || estOutilLocal(spec))) return []

  const ts = typescript()
  const lire = lecteurDExpressions(rel, sourceFile)
  const litteraux = new Set()
  const motDExpression = (e) => {
    if (e.k === 'lit' && typeof e.v === 'string') return e.v
    const valeurs = evaluer(e, { lambdas: lire.lambdas })
    return valeurs.length === 1 && 'chemin' in valeurs[0] ? resolve(racine, valeurs[0].chemin) : MOT_OPAQUE
  }
  const mot = (n) => {
    if (!n) return MOT_OPAQUE
    if (ts.isStringLiteralLikeNode(n)) {
      litteraux.add(n.text)
      return n.text
    }
    const valeurs = valeursDAcquisition(rel, sourceFile, n, depot)
    if (valeurs.length === 1) {
      if ('specificateur' in valeurs[0]) return valeurs[0].specificateur
      if ('fichier' in valeurs[0]) return resolve(racine, valeurs[0].fichier)
    }
    return motDExpression(lire.expr(n))
  }
  const argvDe = (n) => {
    if (!n) return []
    if (!ts.isArrayLiteralExpression(n)) {
      const e = lire.expr(n)
      return e.k === 'liste' ? e.v.map(motDExpression) : [MOT_OPAQUE]
    }
    const args = []
    for (const e of n.elements) {
      if (ts.isSpreadElement(e)) return [...args, MOT_OPAQUE]
      args.push(mot(e))
    }
    return args
  }
  const option = (options, nom) => {
    if (!options) return undefined
    if (!ts.isObjectLiteralExpression(options)) return null
    for (const p of [...options.properties].reverse()) {
      if (ts.isSpreadAssignment(p) || ts.isComputedPropertyName(p.name)) return null
      if (p.name.text !== nom) continue
      if (ts.isShorthandPropertyAssignment(p)) return p.name
      return ts.isPropertyAssignment(p) ? p.initializer : null
    }
  }
  const estProcess = (n, nom) => n && ts.isPropertyAccessExpression(n) && ts.isIdentifier(n.expression)
    && n.expression.text === 'process' && n.name.text === nom
  const estNode = (n) => estProcess(n, 'execPath')
  /** L'option `env` absente, ou un objet littéral dont chaque étalement est `process.env` et aucune clé `NODE_OPTIONS`. */
  const envSansPrechargement = (opt) => {
    const env = option(opt, 'env')
    if (env === undefined) return true
    return !!env && ts.isObjectLiteralExpression(env) && env.properties.every((p) => (ts.isSpreadAssignment(p)
      ? estProcess(p.expression, 'env')
      : (ts.isPropertyAssignment(p) || ts.isShorthandPropertyAssignment(p)) && !ts.isComputedPropertyName(p.name) && p.name.text !== 'NODE_OPTIONS'))
  }
  const lancements = []
  const relever = (n, scripts, cwd, opaque, paquets = [], prouvable = false) => {
    const cibles = scripts.flatMap((script) => {
      if (!script || script.includes(MOT_OPAQUE) || cwd === MOT_OPAQUE) return []
      const cible = relative(racine, resolve(racine, cwd, script)).split('\\').join('/')
      return image.has(cible) && estModule(cible) ? [cible] : []
    })
    const ferme = opaque || cibles.length < scripts.length
    lancements.push({
      site: rel + ':' + lire.ligneDe(n),
      noeud: n,
      cibles,
      paquets,
      opaque: ferme,
      prouve: prouvable && !ferme && scripts.every((s) => litteraux.has(s)),
    })
  }
  const interpreter = (n, commande, argv, cwd, prouvable = false) => {
    const lancement = lancementDInterpreteur([commande, ...argv])
    const scripts = lancement?.scripts ?? []
    const paquets = (lancement?.prechargements ?? []).map(paquetDe).filter((p) => p !== null)
    relever(n, scripts, cwd, !scripts.length || lancement.enLigne !== undefined, paquets, prouvable)
  }
  const visiter = (n) => {
    if (ts.isCallExpression(n)) {
      const cible = lire.cibleAppele(n)
      const [premier, args, options, quatrieme] = n.arguments
      if (cible?.k === 'importe' && estOutilLocal(cible.spec) && cible.nom === 'sortieOutilLocal'
        && mot(args) === 'tsx' && mot(options) === 'tsx') {
        interpreter(n, 'tsx', argvDe(quatrieme), mot(premier))
      } else if (cible?.k === 'importe' && estModuleEnfant(cible.spec) && LANCEURS_SHELL.has(cible.nom)) {
        const commande = mot(premier)
        const optionCwd = option(args, 'cwd')
        const cwd = optionCwd === undefined ? racine : mot(optionCwd)
        if (commande !== MOT_OPAQUE && cwd !== MOT_OPAQUE) {
          const scripts = ciblesDEcritureDeCommande(commande, { scripts: true, base: resolve(racine, cwd), lireTexte: () => null })
            .filter(({ operation }) => operation === 'script')
          if (scripts.length) relever(n, scripts.map(({ chemin }) => chemin), racine, false)
        }
      } else if (cible?.k === 'importe' && estModuleEnfant(cible.spec) && LANCEURS_NODE.has(cible.nom)) {
        const opt = args && ts.isObjectLiteralExpression(args) ? args : options
        const optionCwd = option(opt, 'cwd')
        const cwd = optionCwd === undefined ? racine : mot(optionCwd)
        const sansPrechargement = envSansPrechargement(opt)
        if (cible.nom === 'fork') {
          const execPath = option(opt, 'execPath')
          const execArgv = option(opt, 'execArgv')
          if (execPath === undefined || estNode(execPath) || mot(execPath) === 'node') {
            interpreter(n, 'node', [...(execArgv === null ? [MOT_OPAQUE] : argvDe(execArgv)), mot(premier)], cwd, sansPrechargement)
          }
        } else {
          const commande = estNode(premier) ? 'node' : mot(premier)
          const shell = option(opt, 'shell')
          if (EXTERIEURS_JS.has(commande)) {
            const argv = shell === undefined || shell?.kind === ts.SyntaxKind.FalseKeyword
              ? argvDe(opt === args ? undefined : args) : [MOT_OPAQUE]
            interpreter(n, commande, argv, cwd, sansPrechargement && (commande === 'node' || commande === 'node.exe'))
          }
        }
      }
    }
    n.forEachChild(visiter)
  }
  visiter(sourceFile)
  return lancements
}

/**
 * Les ENTRÉES des enfants de `rel` quand chacun de ses lancements se PROUVE (#5037 L2), `null` sinon : son module des
 * processus enfants n'entre que par des `import` statiques (`MODULES_ENFANTS`), et chaque référence à leurs liaisons est
 * l'appelé, nu ou par membre, d'un lancement `prouve` d'`entreesDesEnfants`. Une référence d'une autre forme (relais,
 * `promisify`, appel de `git`) ou un lancement non prouvé rendent `null`.
 * @param {string} rel @param {import('typescript/unstable/ast').SourceFile} sourceFile
 * @param {{ acquisition?: boolean, spec: string | null }[]} sites `sitesDeModule`
 * @param {{ arbreDe: Function, cible: Function }} depot `lecteurDuDepot` @param {string} racine @param {ReadonlySet<string>} image
 * @returns {string[] | null}
 */
export function enfantsProuves(rel, sourceFile, sites, depot, racine, image) {
  const ts = typescript()
  const imports = sourceFile.statements.filter((s) => ts.isImportDeclaration(s) && estModuleEnfant(s.moduleSpecifier.text))
  if (sites.filter(({ acquisition, spec }) => acquisition && estModuleEnfant(spec)).length !== imports.length) return null
  const liaisons = new Set()
  for (const { importClause: c } of imports) {
    if (c?.name) liaisons.add(c.name.text)
    if (c?.namedBindings && ts.isNamespaceImport(c.namedBindings)) liaisons.add(c.namedBindings.name.text)
    else for (const e of c?.namedBindings?.elements ?? []) liaisons.add(e.name.text)
  }
  const lancements = entreesDesEnfants(rel, sourceFile, sites, depot, racine, image)
  const prouves = new Set(lancements.filter((l) => l.prouve).map((l) => l.noeud))
  const declarations = new Set(imports)
  let prouve = true
  const visiter = (n) => {
    if (!prouve || declarations.has(n)) return
    if (ts.isIdentifier(n) && liaisons.has(n.text)) {
      const p = n.parent
      const nomDeMembre = (ts.isPropertyAccessExpression(p) && p.name === n) || (ts.isPropertyAssignment(p) && p.name === n)
      const appel = ts.isCallExpression(p) && p.expression === n ? p
        : ts.isPropertyAccessExpression(p) && p.expression === n && ts.isCallExpression(p.parent) && p.parent.expression === p ? p.parent : null
      if (!nomDeMembre && !prouves.has(appel)) prouve = false
    }
    n.forEachChild(visiter)
  }
  visiter(sourceFile)
  return prouve ? [...new Set(lancements.flatMap((l) => l.cibles))] : null
}
