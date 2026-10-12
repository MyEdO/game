import { basename, dirname, isAbsolute, join, resolve } from 'node:path'
import { analyserCorpus, typescript } from './dialecte.mjs'
import { creerProvenanceFs } from './provenanceFs.mjs'
import { OPERATIONS_FS, ouvreEnEcriture } from './operationsFs.mjs'
export { OPERATIONS_FS, ouvreEnEcriture } from './operationsFs.mjs'

/** Les fonctions de `node:child_process` qui lancent une commande : `exec*` la reçoivent en une chaîne,
 *  `spawn*`/`execFile*` en un exécutable et un tableau d'arguments ; `fork` lance un module. */
const LANCEURS = { exec: 'chaine', execSync: 'chaine', spawn: 'tableau', spawnSync: 'tableau', execFile: 'tableau', execFileSync: 'tableau', fork: 'module' }
/** Les modules dont un `import()` dynamique rend des écritures que la provenance ne suit pas. */
const MODULES_QUI_ECRIVENT = /^(?:node:)?(?:fs|fs\/promises|child_process)$/
const PLIS_DE_CHEMIN = { join, resolve: (...p) => (p.some(isAbsolute) ? resolve(...p) : join(...p)), dirname, basename }

/** Les variables d'environnement que le hook connaît du processus qu'il juge : le répertoire temporaire. */
export const VARIABLES_AMORCEES = ['TEMP', 'TMP', 'TMPDIR']

/** `os.tmpdir()` du processus d'environnement `env` sous `platform` (Node, `lib/os.js`, `tmpdir`) ; `null` si
 *  `env` ne le porte pas. PURE. */
export function repertoireTemporaire(env, platform) {
  const valeur = platform === 'win32' ? env.TEMP || env.TMP : env.TMPDIR || env.TMP || env.TEMP || '/tmp'
  if (typeof valeur !== 'string' || valeur === '') return null
  return valeur.length > 1 && /[\\/]$/.test(valeur) && !/:[\\/]$/.test(valeur) ? valeur.slice(0, -1) : valeur
}

/**
 * Les écritures de fichier que DÉCLARE un texte JS/TS, parsé au dialecte de `rel` ; `[]` s'il ne se parse pas.
 * Un chemin se REPLIE quand il est constant : littéral, `const` chaîne, `+`, gabarit, `join`/`resolve`/
 * `dirname`/`basename` de `node:path`, `import.meta.dirname`/`filename`, `fileURLToPath(import.meta.url)`
 * (`fichier` = le chemin du script), `process.argv[k]` (`argv` = le `process.argv` du lancement), `tmpdir()` et
 * `process.env.<VARIABLES_AMORCEES>` (lus à `env`, `platform`). Un lancement `node:child_process` rend
 * `{ operation, commande }` (la commande littérale, que l'appelant juge) ou une cible inconnue ; un `import()`
 * dynamique de `fs`/`child_process` se lit comme l'import statique quand il est attendu (`await import('…')`),
 * sinon il rend une cible inconnue, comme un `import()` à spécificateur non constant.
 * @param {string} texte
 * @param {{ rel?: string, fichier?: string, argv?: (string | null)[], env?: Record<string, string | undefined>, platform?: NodeJS.Platform }} [contexte]
 * @returns {{ chemin: string | null, inconnue: boolean, operation: string, commande?: string }[]}
 */
export function ciblesDEcritureJS(texte, { rel = 'inline.mjs', fichier, argv = [], env = {}, platform = process.platform } = {}) {
  const ts = typescript()
  const sorties = []
  for (const { sourceFile, diagnostics, checker } of analyserCorpus([{ rel, text: texte }])) {
    if (diagnostics.length || !sourceFile) return []
    const provenance = creerProvenanceFs({ sourceFile, checker, ts })
    const importeChildProcess = /['"](?:node:)?child_process['"]/.test(texte)
    const enCours = new Set()
    const nomAppele = (n) => (ts.isIdentifier(n.expression) ? n.expression.text : ts.isPropertyAccessExpression(n.expression) ? n.expression.name.text : null)
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
        return n.name.text === 'dirname' ? dirname(fichier) : n.name.text === 'filename' ? fichier : null
      }
      if (ts.isElementAccessExpression(n) && n.expression.getText(sourceFile) === 'process.argv' && ts.isNumericLiteral(n.argumentExpression)) {
        return argv[Number(n.argumentExpression.text)] ?? null
      }
      if ((ts.isPropertyAccessExpression(n) || ts.isElementAccessExpression(n)) && n.expression.getText(sourceFile) === 'process.env') {
        const nom = ts.isPropertyAccessExpression(n) ? n.name.text : plier(n.argumentExpression)
        return VARIABLES_AMORCEES.includes(nom) && typeof env[nom] === 'string' ? env[nom] : null
      }
      if (ts.isCallExpression(n)) {
        const nom = nomAppele(n)
        if (nom === 'fileURLToPath' && n.arguments[0]?.getText(sourceFile) === 'import.meta.url') return fichier ?? null
        if (nom === 'tmpdir' && n.arguments.length === 0) return repertoireTemporaire(env, platform)
        if (nom !== null && Object.hasOwn(PLIS_DE_CHEMIN, nom)) {
          const valeurs = n.arguments.map(plier)
          return valeurs.length && valeurs.every((v) => v !== null) ? PLIS_DE_CHEMIN[nom](...valeurs) : null
        }
      }
      return null
    }
    const parcours = (n, fn) => { fn(n); n.forEachChild((c) => parcours(c, fn)) }
    parcours(sourceFile, (n) => {
      if (!ts.isCallExpression(n)) return
      if (n.expression.kind === ts.SyntaxKind.ImportKeyword) {
        const module = plier(n.arguments[0])
        let haut = n.parent
        while (ts.isParenthesizedExpression(haut)) haut = haut.parent
        if (module === null || (MODULES_QUI_ECRIVENT.test(module) && !ts.isAwaitExpression(haut))) sorties.push({ chemin: null, inconnue: true, operation: 'import-dynamique' })
        return
      }
      const nom = nomAppele(n)
      if (importeChildProcess && nom !== null && Object.hasOwn(LANCEURS, nom)) {
        const forme = LANCEURS[nom]
        const commande = forme === 'chaine' ? plier(n.arguments[0])
          : forme === 'tableau' ? commandeDeTableau(plier(n.arguments[0]), n.arguments[1], plier, ts)
            : null
        sorties.push(commande === null ? { chemin: null, inconnue: true, operation: nom } : { chemin: null, inconnue: false, operation: nom, commande })
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
  }
  return sorties
}

/** `spawn(fichier, [args])` rendu en une commande shell aux arguments sous quote simple ; `null` si un
 *  morceau n'est pas constant. */
function commandeDeTableau(fichier, args, plier, ts) {
  if (fichier === null) return null
  const valeurs = args === undefined ? [] : ts.isArrayLiteralExpression(args) ? args.elements.map(plier) : [null]
  if (valeurs.some((v) => v === null)) return null
  return [fichier, ...valeurs].map((v) => `'${v.split("'").join("'\\''")}'`).join(' ')
}
