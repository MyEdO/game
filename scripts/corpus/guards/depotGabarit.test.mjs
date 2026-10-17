import { test } from 'node:test'

import assert from 'node:assert/strict'

import { readFileSync } from 'node:fs'

import { fileURLToPath } from 'node:url'

import { join } from 'node:path'

import { TRAVAIL, depotDe, listerImage } from '../../guards/lib/gitPorte.mjs'

import { analyserCorpus, ast, typescript } from '../../guards/lib/dialecte.mjs'

const NOMS_PATH = new Set(['PATH', 'Path'])

const POSEURS = new Set(['Reflect.set', 'Reflect.defineProperty', 'Object.defineProperty'])

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

const SURCHARGES_HORS_CLASSE = [
  { fichier: 'scripts/lancer-local.test.mjs', ancre: 'const env = envIsole(', sites: 1, raison: 'mesure `envIsole`, qui recompose le PATH d’un enfant' },
  { fichier: 'scripts/lancer-local.test.mjs', ancre: "['sonde', '--', 'sonde', '3', 'suite']", sites: 2, raison: 'mesure que le lanceur local ignore un PATH étranger' },
  { fichier: 'scripts/test/run.test.mjs', ancre: 'const env = envEnfant(', sites: 1, raison: 'mesure `envEnfant`, qui transmet le PATH' },
  { fichier: 'scripts/mods/verifier.mjs', ancre: "PATH: 'trouver `claude`", sites: 1, raison: 'clé de la liste blanche `ENV_HERITE` (#2278), qui transmet le PATH hérité' },
  { fichier: 'scripts/mods/verifier.mjs', ancre: "Path: 'graphie win32 de PATH", sites: 1, raison: 'clé de la liste blanche `ENV_HERITE` (#2278), qui transmet le Path hérité sous win32' },
  { fichier: 'scripts/mods/verifier.test.mjs', ancre: "PATH: '/bin', GARDEE_NON", sites: 1, raison: 'env de base du banc de `envBlanc` (#2278), qui mesure que le PATH passe' },
  { fichier: 'scripts/mods/verifier.test.mjs', ancre: "npm_config_cache: '/cache', PATH: '/bin'", sites: 1, raison: 'env de base du banc de `envBlanc` (#2278), jamais passé à un processus' },
]

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
    .filter((f) => /\.[cm]?[jt]sx?$/.test(f))
    .map((rel) => ({ rel, text: readFileSync(join(racine, rel), 'utf8') }))
    .filter(({ text }) => [...NOMS_PATH].some((nom) => text.includes(nom)))
  const sites = []
  for (const { fichier: { rel, text }, sourceFile } of analyserCorpus(candidats))
    sites.push(...surchargesDe(rel, text, sourceFile).map((s) => ({ fichier: rel, ...s })))
  const restants = sites.filter((s) => !SURCHARGES_HORS_CLASSE.some((e) => e.fichier === s.fichier && s.texte.includes(e.ancre)))
  assert.deepEqual(restants.map((s) => `${s.fichier}:${s.ligne} ${s.texte}`), [])
  for (const e of SURCHARGES_HORS_CLASSE) {
    const vus = sites.filter((s) => s.fichier === e.fichier && s.texte.includes(e.ancre)).length
    assert.equal(vus, e.sites, `exemption ${e.fichier} « ${e.ancre} » : ${vus} surcharge(s), ${e.sites} déclarée(s)`)
  }
})
