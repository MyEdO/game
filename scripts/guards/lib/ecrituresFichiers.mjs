import { cheminsDe } from './commandeShell.mjs'
import { analyserCorpus, typescript } from './dialecte.mjs'
import { creerProvenanceFs } from './provenanceFs.mjs'
import { OPERATIONS_FS, ouvreEnEcriture } from './operationsFs.mjs'
export { OPERATIONS_FS, ouvreEnEcriture } from './operationsFs.mjs'

/** Les fonctions de `node:child_process` qui lancent une commande, par export (`exportAppele`) : `exec*` la
 *  reçoivent en une chaîne, `spawn*`/`execFile*` en un exécutable, un tableau d'arguments facultatif et des options
 *  (`shell: true` : la commande et ses arguments joints par une espace, lus par le shell) ; `fork` lance un module. */
const LANCEURS = {
  'child_process#exec': 'chaine', 'child_process#execSync': 'chaine', 'child_process#spawn': 'tableau', 'child_process#spawnSync': 'tableau',
  'child_process#execFile': 'tableau', 'child_process#execFileSync': 'tableau', 'child_process#fork': 'module',
}
/** Le mot qu'un argument non constant d'un lancement devient : une variable que le juge shell ne connaît pas
 *  (`ciblesDEcritureDeCommande`), comme l'argument qu'alimente `xargs`. */
export const MOT_INCONNU = '$argument_non_constant'
/** Les modules dont un `import()` dynamique rend des écritures que la provenance ne suit pas. */
const MODULES_QUI_ECRIVENT = /^(?:node:)?(?:fs|fs\/promises|child_process)$/
/** Les plis de `node:path` sous le `node:path` `P` de la plateforme jugée. */
const plisDeChemin = (P) => ({ 'path#join': P.join, 'path#resolve': (...p) => (p.some(P.isAbsolute) ? P.resolve(...p) : P.join(...p)), 'path#dirname': P.dirname, 'path#basename': P.basename })

/** Les variables d'environnement que le hook connaît du processus qu'il juge. Critère d'appartenance : variables du
 *  profil utilisateur que les shells d'outil héritent inchangées (#2537 ; `PROGRAMDATA`, de la machine, s'écrit
 *  `ProgramData` sous bash). */
export const VARIABLES_AMORCEES = ['TEMP', 'TMP', 'TMPDIR', 'HOME', 'USERPROFILE', 'LOCALAPPDATA', 'APPDATA', 'HOMEDRIVE', 'HOMEPATH']

/** `os.tmpdir()` du processus d'environnement `env` sous `platform` (Node, `lib/os.js`, `tmpdir`) ; `null` si
 *  `env` ne le porte pas. PURE. */
export function repertoireTemporaire(env, platform) {
  const valeur = platform === 'win32' ? env.TEMP || env.TMP : env.TMPDIR || env.TMP || env.TEMP || '/tmp'
  if (typeof valeur !== 'string' || valeur === '') return null
  return valeur.length > 1 && /[\\/]$/.test(valeur) && !/:[\\/]$/.test(valeur) ? valeur.slice(0, -1) : valeur
}

/**
 * Les écritures de fichier que DÉCLARE chaque script JS/TS de `scripts`, dans leur ordre, parsés en UNE session, chacun
 * en portée de module (`syntaxProgram`) au dialecte de son `rel` ; `[]` pour un script qui ne se parse pas.
 * Un chemin se REPLIE quand il est constant : littéral, `const` chaîne, `+`, gabarit, `join`/`resolve`/
 * `dirname`/`basename` de `node:path`, `[…].join(sep)`, `import.meta.dirname`/`filename`, `fileURLToPath(import.meta.url)`
 * de `node:url` (`fichier` = le chemin du script), `process.argv[k]` (`argv` = le `process.argv` du lancement),
 * `tmpdir()` de `node:os` et `process.env.<VARIABLES_AMORCEES>` (lus à `env`, `platform`) ; une fonction se
 * reconnaît à l'import qui la lie (`exportAppele`), jamais à son nom ; `process.execPath` se plie en `node`. Un
 * lancement `node:child_process` rend `{ operation, commande }` (la commande, que l'appelant juge, un argument non
 * constant y valant `MOT_INCONNU`) ou, à exécutable non constant, une cible inconnue ; un `import()`
 * dynamique de `fs`/`child_process` se lit comme l'import statique quand il est attendu (`await import('…')`),
 * sinon il rend une cible inconnue, comme un `import()` à spécificateur non constant.
 * @param {{ texte: string, rel?: string, fichier?: string, argv?: (string | null)[] }[]} scripts
 * @param {{ env?: Record<string, string | undefined>, platform?: NodeJS.Platform }} [contexte]
 * @returns {{ chemin: string | null, inconnue: boolean, operation: string, commande?: string }[][]}
 */
export function ciblesDEcritureJS(scripts, { env = {}, platform = process.platform } = {}) {
  const ts = typescript()
  const P = cheminsDe(platform), plis = plisDeChemin(P)
  const corpus = scripts.map((script, k) => ({ rel: `${k}/${script.rel ?? 'inline.mjs'}`, text: script.texte, script }))
  return Array.from(analyserCorpus(corpus), ({ fichier: { script: { fichier, argv = [] } }, sourceFile, diagnostics, checker }) => {
    if (diagnostics.length || !sourceFile) return []
    const sorties = []
    const provenance = creerProvenanceFs({ sourceFile, checker, ts })
    const enCours = new Set()
    const moduleDe = (specificateur) => (specificateur && (ts.isStringLiteral(specificateur) || ts.isNoSubstitutionTemplateLiteral(specificateur)) ? specificateur.text.replace(/^node:/, '') : null)
    /** Le module que charge `init` : `require('<m>')` du global, `await import('<m>')` ; `null` sinon. */
    const moduleCharge = (init) => {
      if (init && ts.isAwaitExpression(init)) init = init.expression
      if (!init || !ts.isCallExpression(init)) return null
      if (init.expression.kind === ts.SyntaxKind.ImportKeyword) return moduleDe(init.arguments[0])
      const local = checker.getSymbolAtLocation(init.expression)?.declarations?.some((d) => !d.resolve().getSourceFile().isDeclarationFile)
      return ts.isIdentifier(init.expression) && init.expression.text === 'require' && !local ? moduleDe(init.arguments[0]) : null
    }
    /** La liaison de `id` à un module : `{ module, nom }`, `nom` = l'export lié (`membre` d'un espace de noms
     *  ou d'un défaut) ; `null` pour une déclaration locale. */
    const liaison = (id, membre) => {
      const d = checker.getSymbolAtLocation(id)?.declarations?.[0]?.resolve()
      if (!d) return null
      if (ts.isImportSpecifier(d) || ts.isNamespaceImport(d) || ts.isImportClause(d)) {
        let p = d
        while (p && !ts.isImportDeclaration(p)) p = p.parent
        const module = p ? moduleDe(p.moduleSpecifier) : null
        if (ts.isImportSpecifier(d)) return membre === null && module ? { module, nom: (d.propertyName ?? d.name).text } : null
        return membre !== null && module ? { module, nom: membre } : null
      }
      if (ts.isBindingElement(d) && ts.isVariableDeclaration(d.parent.parent) && /^const\b/.test(d.parent.parent.parent.getText(sourceFile))) {
        const module = moduleCharge(d.parent.parent.initializer)
        return membre === null && module && !d.dotDotDotToken ? { module, nom: (d.propertyName ?? d.name).text } : null
      }
      if (ts.isVariableDeclaration(d) && /^const\b/.test(d.parent.getText(sourceFile))) {
        const module = moduleCharge(d.initializer)
        return membre !== null && module ? { module, nom: membre } : null
      }
      return null
    }
    /** L'export appelé par `n` : `<module>#<nom>` (`path#join`), lu à l'import qui lie l'appelé ; `null` sinon. */
    const exportAppele = (n) => {
      const appele = ts.isIdentifier(n.expression) ? liaison(n.expression, null)
        : ts.isPropertyAccessExpression(n.expression) && ts.isIdentifier(n.expression.expression) ? liaison(n.expression.expression, n.expression.name.text)
          : null
      return appele && `${appele.module}#${appele.nom}`
    }
    const plier = (n) => {
      if (!n) return null
      if (ts.isParenthesizedExpression(n) || ts.isAsExpression(n) || ts.isNonNullExpression(n)) return plier(n.expression)
      if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) return n.text
      if (ts.isTemplateExpression(n)) {
        let rendu = n.head.text
        for (const span of n.templateSpans) {
          const valeur = plier(span.expression)
          if (valeur === null) return null
          rendu += valeur + span.literal.text
        }
        return rendu
      }
      if (ts.isBinaryExpression(n) && n.operatorToken.kind === ts.SyntaxKind.PlusToken) {
        const [a, b] = [plier(n.left), plier(n.right)]
        return a === null || b === null ? null : a + b
      }
      if (ts.isIdentifier(n)) {
        const declaration = checker.getSymbolAtLocation(n)?.declarations?.[0]?.resolve()
        if (!declaration || declaration.getSourceFile() !== sourceFile || !ts.isVariableDeclaration(declaration) || !declaration.initializer) return null
        if (!/^const\b/.test(declaration.parent.getText(sourceFile)) || enCours.has(declaration.pos)) return null
        enCours.add(declaration.pos)
        const valeur = plier(declaration.initializer)
        enCours.delete(declaration.pos)
        return valeur
      }
      if (ts.isPropertyAccessExpression(n) && ts.isMetaProperty(n.expression)) {
        if (!fichier) return null
        return n.name.text === 'dirname' ? P.dirname(fichier) : n.name.text === 'filename' ? fichier : null
      }
      if (ts.isPropertyAccessExpression(n) && n.getText(sourceFile) === 'process.execPath') return 'node'
      if (ts.isElementAccessExpression(n) && n.expression.getText(sourceFile) === 'process.argv' && ts.isNumericLiteral(n.argumentExpression)) {
        return argv[Number(n.argumentExpression.text)] ?? null
      }
      if ((ts.isPropertyAccessExpression(n) || ts.isElementAccessExpression(n)) && n.expression.getText(sourceFile) === 'process.env') {
        const nom = ts.isPropertyAccessExpression(n) ? n.name.text : plier(n.argumentExpression)
        return VARIABLES_AMORCEES.includes(nom) && typeof env[nom] === 'string' ? env[nom] : null
      }
      if (ts.isCallExpression(n)) {
        if (ts.isPropertyAccessExpression(n.expression) && n.expression.name.text === 'join' && ts.isArrayLiteralExpression(n.expression.expression)) {
          const morceaux = n.expression.expression.elements.map(plier)
          const separateur = n.arguments.length ? plier(n.arguments[0]) : ','
          return separateur !== null && morceaux.every((v) => v !== null) ? morceaux.join(separateur) : null
        }
        const appele = exportAppele(n)
        if (appele === 'url#fileURLToPath' && n.arguments[0]?.getText(sourceFile) === 'import.meta.url') return fichier ?? null
        if (appele === 'os#tmpdir' && n.arguments.length === 0) return repertoireTemporaire(env, platform)
        if (appele !== null && Object.hasOwn(plis, appele)) {
          const valeurs = n.arguments.map(plier)
          return valeurs.length && valeurs.every((v) => v !== null) ? plis[appele](...valeurs) : null
        }
      }
      return null
    }
    const parcours = (n, fn) => { fn(n); n.forEachChild((c) => parcours(c, fn)) }
    /** Les éléments de la liste d'arguments `n` d'un lancement : un tableau littéral, ou l'identifiant d'un `const`
     *  tableau littéral que le texte ne fait que passer en argument d'appel ; `[]` sans liste, `null` sinon. */
    const elementsDe = (n) => {
      if (n === undefined) return []
      if (ts.isArrayLiteralExpression(n)) return n.elements
      const declarationDe = (id) => checker.getSymbolAtLocation(id)?.declarations?.[0]?.resolve()
      const declaration = ts.isIdentifier(n) ? declarationDe(n) : undefined
      if (!declaration || !ts.isVariableDeclaration(declaration) || !/^const\b/.test(declaration.parent.getText(sourceFile))) return null
      if (!declaration.initializer || !ts.isArrayLiteralExpression(declaration.initializer)) return null
      let passe = true
      parcours(sourceFile, (id) => {
        if (passe && ts.isIdentifier(id) && id.pos !== declaration.name.pos && declarationDe(id)?.pos === declaration.pos) passe = ts.isCallExpression(id.parent) && id.parent.arguments.includes(id)
      })
      return passe ? declaration.initializer.elements : null
    }
    parcours(sourceFile, (n) => {
      if (!ts.isCallExpression(n)) return
      if (n.expression.kind === ts.SyntaxKind.ImportKeyword) {
        const module = plier(n.arguments[0])
        let haut = n.parent
        while (ts.isParenthesizedExpression(haut)) haut = haut.parent
        if (module === null || (MODULES_QUI_ECRIVENT.test(module) && !ts.isAwaitExpression(haut))) sorties.push({ chemin: null, inconnue: true, operation: 'import-dynamique' })
        return
      }
      const lanceur = exportAppele(n)
      if (lanceur !== null && Object.hasOwn(LANCEURS, lanceur)) {
        const forme = LANCEURS[lanceur], operation = lanceur.slice(lanceur.indexOf('#') + 1)
        const [, second, troisieme] = n.arguments
        const sansOptions = second === undefined || !ts.isObjectLiteralExpression(second)
        const options = sansOptions ? troisieme : second
        const shell = options !== undefined && ts.isObjectLiteralExpression(options) && options.properties.some((p) =>
          ts.isPropertyAssignment(p) && p.name.getText(sourceFile) === 'shell' && p.initializer.kind === ts.SyntaxKind.TrueKeyword)
        const commande = forme === 'chaine' ? plier(n.arguments[0])
          : forme === 'tableau' ? commandeDeTableau(plier(n.arguments[0]), elementsDe(sansOptions ? second : undefined), plier, ts, shell)
            : null
        sorties.push(commande === null ? { chemin: null, inconnue: true, operation } : { chemin: null, inconnue: false, operation, commande })
        return
      }
      const operation = provenance(n.expression)?.operation
      const definition = OPERATIONS_FS[operation]
      if (definition?.drapeaux !== undefined) {
        const argument = n.arguments[definition.drapeaux]
        const drapeaux = argument && ts.isNumericLiteral(argument) ? Number(argument.text) : plier(argument)
        if ((!argument || drapeaux !== null) && !ouvreEnEcriture(drapeaux ?? undefined)) return
      }
      for (const indice of Object.hasOwn(OPERATIONS_FS, operation) ? OPERATIONS_FS[operation].chemins : []) {
        const chemin = plier(n.arguments[indice])
        sorties.push({ chemin, inconnue: chemin === null, operation })
      }
    })
    return sorties
  })
}

/** `spawn(fichier, [args])` rendu en une commande shell, `elements` = les nœuds de ses arguments (`null` : une liste non
 *  lue) : sous quote simple, ou nus avec `shell` ; un argument non constant (ou une liste non lue) vaut `MOT_INCONNU` ;
 *  `null` si l'exécutable n'est pas constant. */
function commandeDeTableau(fichier, elements, plier, ts, shell) {
  if (fichier === null) return null
  const valeurs = elements === null ? [null] : elements.map((e) => (ts.isSpreadElement(e) ? null : plier(e)))
  return [fichier, ...valeurs].map((v) => (v === null ? MOT_INCONNU : shell ? v : `'${v.split("'").join("'\\''")}'`)).join(' ')
}
