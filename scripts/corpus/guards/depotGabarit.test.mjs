import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { extname, join } from 'node:path'
import { TRAVAIL, depotDe, listerImage } from '../../guards/lib/gitPorte.mjs'
import { analyserCorpus, ast, EXTENSIONS_DE_SCRIPT, typescript } from '../../guards/lib/dialecte.mjs'
import { positionsDesAncres } from '../../guards/lib/stock.mjs'

// La SURCHARGE de `PATH` d'un banc : le moyen de caler un binaire, quel que soit le nom du fichier
// calé. win32 ne lance pas une cale (#2114) ; la panne de git passe par `envGitFeint` (#2225).
/** Les noms de la variable, dans la casse de chaque plateforme. */
const NOMS_PATH = new Set(['PATH', 'Path'])

/** Les appels qui posent une propriété par son nom en second argument. */
const POSEURS = new Set(['Reflect.set', 'Reflect.defineProperty', 'Object.defineProperty'])

/**
 * Les surcharges de PATH d'une source, lues sur son AST (`ast`, `scripts/guards/lib/dialecte.mjs`) :
 * clé d'un littéral objet (nommée, en chaîne, calculée, abrégée `{ PATH }`), affectation d'un membre
 * (`x.PATH =`, `x['PATH'] =`, `x[cle] =`), pose par `Reflect.set` / `defineProperty`. Une clé calculée
 * se résout par une `const` du fichier liée au littéral. PUR.
 * @param {string} rel @param {string} texte @param {object | null} [racine] son AST déjà analysé, lu sinon @returns {{ ligne: number, texte: string }[]}
 */
function surchargesDe(rel, texte, racine = null) {
  if (![...NOMS_PATH].some((nom) => texte.includes(nom))) return []
  racine ??= ast({ rel, text: texte })
  if (!racine) return []
  const ts = typescript()
  const litteral = (n) => !!n && (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) && NOMS_PATH.has(n.text)
  const alias = new Set()
  const lierAlias = (n) => {
    if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && litteral(n.initializer)) alias.add(n.name.text)
    n.forEachChild(lierAlias)
  }
  lierAlias(racine)
  const designe = (n) => litteral(n) || (!!n && ts.isIdentifier(n) && alias.has(n.text))
  const cle = (nom) => (ts.isIdentifier(nom) && NOMS_PATH.has(nom.text)) || litteral(nom) || (ts.isComputedPropertyName(nom) && designe(nom.expression))
  const cible = (n) =>
    (ts.isPropertyAccessExpression(n) && NOMS_PATH.has(n.name.text)) || (ts.isElementAccessExpression(n) && designe(n.argumentExpression))
  const lignes = texte.split('\n')
  const sites = []
  const visiter = (n) => {
    const surcharge =
      (ts.isPropertyAssignment(n) && ts.isObjectLiteralExpression(n.parent) && cle(n.name))
      || (ts.isShorthandPropertyAssignment(n) && NOMS_PATH.has(n.name.text))
      || (ts.isBinaryExpression(n) && n.operatorToken.kind === ts.SyntaxKind.EqualsToken && cible(n.left))
      || (ts.isCallExpression(n) && POSEURS.has(n.expression.getText(racine)) && designe(n.arguments[1]))
    if (surcharge) {
      const ligne = racine.getLineAndCharacterOfPosition(n.getStart(racine)).line + 1
      sites.push({ ligne, texte: lignes[ligne - 1].trim() })
    }
    n.forEachChild(visiter)
  }
  visiter(racine)
  return sites
}

/** Les surcharges qui ne calent AUCUN binaire. `ancre` désigne une ligne unique, et `sites` borne
 *  exactement le nombre de surcharges qu'elle couvre. */
const SURCHARGES_HORS_CLASSE = [
  { fichier: 'scripts/lancer-local.test.mjs', ancre: "const env = envIsole({ Path: '/arbres/Game/node_modules/.bin:/usr/bin', HOME: '/h' }, '/a/node_modules/.bin', ':')", sites: 1, raison: 'mesure `envIsole`, qui recompose le PATH d’un enfant', date: '2026-10-12' },
  { fichier: 'scripts/lancer-local.test.mjs', ancre: "const r = lancer(racine, ['sonde', '--', 'sonde', '3', 'suite'], { PATH: etranger, Path: etranger })", sites: 2, raison: 'mesure que le lanceur local ignore un PATH étranger', date: '2026-10-12' },
  { fichier: 'scripts/test/run.test.mjs', ancre: "const env = envEnfant({ PATH: '/bin', FORCE_COLOR: '3' })", sites: 1, raison: 'mesure `envEnfant`, qui transmet le PATH', date: '2026-10-12' },
  { fichier: 'scripts/guards/lib/superviserProcessus.test.mjs', ancre: "const vu = await superviserProcessus({ commande: process.execPath, args: [cible, ...args], env: { PATH: chemin, SECRET_2626: 'secret sans argv' } })", sites: 1, raison: 'mesure la transmission exacte du PATH arbitraire au processus Node réel désigné par `process.execPath` absolu', date: '2026-10-18' },
  { fichier: 'scripts/guards/lib/superviserProcessus.test.mjs', ancre: "const absent = await superviserProcessus({ commande: 'absent-2626-impossible', env: { PATH: '' } })", sites: 1, raison: 'mesure ENOENT avec un PATH vide, sans installer de faux exécutable', date: '2026-10-18' },
  { fichier: 'scripts/mods/verifier.mjs', ancre: "PATH: 'trouver `claude`, `node` et ce que lance `npx` (win32 et Linux)',", sites: 1, raison: 'clé de la liste blanche `ENV_HERITE` (#2278), qui transmet le PATH hérité', date: '2026-10-12' },
  { fichier: 'scripts/mods/verifier.mjs', ancre: "Path: 'graphie win32 de PATH, telle que la rend `process.env` énuméré',", sites: 1, raison: 'clé de la liste blanche `ENV_HERITE` (#2278), qui transmet le Path hérité sous win32', date: '2026-10-12' },
  { fichier: 'scripts/mods/verifier.test.mjs', ancre: "PATH: '/bin', GARDEE_NON: 'x', XDG_CONFIG_HOME: '/x', CLAUDE_CONFIG_DIR: '/vrai/.claude', CLAUDECODE: '1',", sites: 1, raison: 'env de base du banc de `envBlanc` (#2278), qui mesure que le PATH passe', date: '2026-10-12' },
  { fichier: 'scripts/mods/verifier.test.mjs', ancre: "const base = { ANTHROPIC_API_KEY: 'k', npm_config_cache: '/cache', PATH: '/bin' }", sites: 1, raison: 'env de base du banc de `envBlanc` (#2278), jamais passé à un processus', date: '2026-10-12' },
]

function surchargesHorsExemptions(rel, texte, sourceFile) {
  const exemptions = SURCHARGES_HORS_CLASSE.filter((e) => e.fichier === rel)
  const parAncre = new Map(exemptions.map((e) => [e.ancre, e]))
  const ancres = positionsDesAncres(rel, texte, parAncre.keys())
  const vus = new Map()
  const restants = surchargesDe(rel, texte, sourceFile).filter((site) => {
    const exemption = parAncre.get(ancres.get(site.ligne))
    if (!exemption) return true
    const nombre = (vus.get(exemption) ?? 0) + 1
    vus.set(exemption, nombre)
    return nombre > exemption.sites
  })
  return { restants, vus }
}

test('aucun banc ne SURCHARGE `PATH` pour caler un binaire — win32 ne lance pas une cale (#2114) : la panne de git passe par `envGitFeint` (#2225)', () => {
  for (const [forme, cale] of [
    ['clé', "spawnSync('x', [], { env: { ...process.env, PATH: `${cale}:${process.env.PATH}` } })"],
    ['clé seule sur sa ligne', "spawnSync('x', [], {\n  env: {\n    ...process.env,\n    PATH: cale,\n  },\n})"],
    ['clé en chaîne', "const env = { ...process.env, 'Path': cale }"],
    ['clé abrégée', "const PATH = `${cale}:${process.env.PATH}`\nspawnSync('x', [], { env: { ...process.env, PATH } })"],
    ['clé calculée', "const cle = 'PATH'\nspawnSync('x', [], { env: { ...process.env, [cle]: cale } })"],
    ['membre', 'process.env.PATH = `${cale}:${chemin}`'],
    ['indice', "process.env['PATH'] = cale"],
    ['indice calculé', "const cle = 'Path'\nenv[cle] = cale"],
    ['Reflect.set', "Reflect.set(process.env, 'PATH', cale)"],
    ['defineProperty', "Object.defineProperty(process.env, 'PATH', { value: cale })"],
    ['Object.assign', "Object.assign(env, { PATH: resolve(cale, 'git') })"],
  ]) assert.equal(surchargesDe('banc.test.mjs', cale).length, 1, `témoin (${forme}) : la surcharge est reconnue dans ${cale}`)
  for (const lecture of ['if (env.PATH === x) f()', 'const p = process.env.PATH', 'assert.equal(env.PATH, undefined)', "const { PATH } = process.env", "const t = 'PATH: x'"]) {
    assert.deepEqual(surchargesDe('banc.test.mjs', lecture), [], `témoin : une LECTURE de PATH n'est pas une surcharge — ${lecture}`)
  }
  const racine = fileURLToPath(new URL('../../..', import.meta.url))
  const candidats = listerImage(depotDe(racine), TRAVAIL, 'scripts')
    .filter((f) => EXTENSIONS_DE_SCRIPT.includes(extname(f)))
    .map((rel) => ({ rel, text: readFileSync(join(racine, rel), 'utf8') }))
    .filter(({ text }) => [...NOMS_PATH].some((nom) => text.includes(nom)))
  const restants = []
  const vus = new Map()
  for (const { fichier: { rel, text }, sourceFile } of analyserCorpus(candidats)) {
    const mesure = surchargesHorsExemptions(rel, text, sourceFile)
    restants.push(...mesure.restants.map((s) => ({ fichier: rel, ...s })))
    for (const [exemption, nombre] of mesure.vus) vus.set(exemption, nombre)
  }
  assert.deepEqual(restants.map((s) => `${s.fichier}:${s.ligne} ${s.texte}`), [])
  for (const e of SURCHARGES_HORS_CLASSE) {
    const nombre = vus.get(e) ?? 0
    assert.equal(nombre, e.sites, `exemption ${e.fichier} « ${e.ancre} » : ${nombre} surcharge(s), ${e.sites} déclarée(s)`)
  }
})

test('une exemption PATH suit son ancre, refuse sa réécriture et son doublon', () => {
  const e = SURCHARGES_HORS_CLASSE.find((entree) => entree.sites === 2)
  const texte = readFileSync(e.fichier, 'utf8')
  const lignes = (source) => surchargesHorsExemptions(e.fichier, source)
  const debut = lignes(texte)
  const deplace = lignes(`// insertion sans rapport\n${texte}`)
  assert.deepEqual(deplace.restants, debut.restants)
  assert.equal(deplace.vus.get(e), 2)
  const recrit = lignes(texte.replace(e.ancre, e.ancre.replaceAll('etranger', 'autre')))
  assert.equal(recrit.vus.has(e), false)
  assert.equal(recrit.restants.length - debut.restants.length, 2)
  const duplique = lignes(`${texte}\n${e.ancre}\n`)
  assert.equal(duplique.vus.has(e), false)
  assert.equal(duplique.restants.length - debut.restants.length, 4)
})
