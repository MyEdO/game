// La garde « git hors de l'hôte » (`gitHorsHote.mjs`, #1806) : l'arbre RÉEL n'a aucun site, et chaque
// forme qu'un module de porte peut écrire est vue. Lancé par `npm run test:hooks`.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { estFichierVitest } from './fichierVitest.mjs'
import { BANC, DOSSIERS_DES_PORTES, HOTE, IMPORT_DE_L_HOTE, RACINE, sitesDuDepot, sitesHorsHote, sourcesDesPortes, testsDeScripts } from './gitHorsHote.mjs'

test('l’arbre : aucun module de porte ne lit git hors de l’hôte, aucun test de `scripts/` ne lance git hors du banc', () => {
  const sites = sitesDuDepot()
  assert.deepEqual(sites.map((s) => `${s.chemin}:${s.ligne} [${s.forme}] ${s.extrait}`), [])
})

test('le périmètre : les sources suivies des dossiers de portes et les importeurs de l’hôte, hors instruments Vitest et hors l’hôte', () => {
  const sources = sourcesDesPortes()
  assert.ok(sources.includes('scripts/hooks/solde-ticket-guard.mjs'))
  assert.ok(sources.includes('scripts/git-hooks/pre-commit.mjs'))
  assert.ok(sources.includes('scripts/guards/lib/plageStock.mjs'))
  assert.ok(!sources.includes(HOTE), 'l’hôte est la définition, pas un site')
  assert.ok(!sources.some(estFichierVitest), 'un instrument Vitest n’est pas une porte')
  const horsDossiers = sources.filter((f) => !DOSSIERS_DES_PORTES.some((d) => f.startsWith(`${d}/`)))
  assert.ok(horsDossiers.includes('scripts/ops/publier.mjs'), 'le train importe l’hôte')
  assert.ok(horsDossiers.every((f) => new RegExp(IMPORT_DE_L_HOTE.replace('[[:space:]]', '\\s')).test(readFileSync(join(RACINE, f), 'utf8'))),
    'hors des dossiers, seul un importeur de l’hôte est dans le périmètre')
})

test('les tests de `scripts/` : suivis, instruments seulement, et le banc hors d’eux comme hors des portes (#2155)', () => {
  const tests = testsDeScripts()
  assert.ok(tests.includes('scripts/hooks/solde-ticket-guard-driver.test.mjs'))
  assert.ok(tests.includes('scripts/test/run.test.mjs'))
  assert.ok(tests.every((f) => f.startsWith('scripts/') && estFichierVitest(f)))
  assert.ok(existsSync(join(RACINE, BANC)), `le module de banc ${BANC} est absent`)
  assert.ok(!tests.includes(BANC) && !sourcesDesPortes().includes(BANC), 'le banc est le lanceur, pas un site')
})

test('dans un test de `scripts/`, le `lanceur` seul est un site ; une porte garde ses trois formes', () => {
  const texte = `${'execFileSync'}('git', ['ls-files', '-z'])\n`
  const lire = () => texte
  assert.deepEqual(sitesDuDepot(RACINE, { lister: () => [], listerTests: () => ['scripts/x.test.mjs'], lire }).map((s) => s.forme), ['lanceur'])
  assert.deepEqual(sitesDuDepot(RACINE, { lister: () => ['scripts/hooks/x.mjs'], listerTests: () => [], lire }).map((s) => s.forme), ['lanceur', 'forme', 'forme'])
})

const formes = (texte) => sitesHorsHote('x.mjs', texte).map((s) => [s.ligne, s.forme])

// Le lanceur des échantillons s'écrit en DEUX morceaux : ce test est lui-même au périmètre (tests de `scripts/`).
test('lanceur : git passé comme exécutable, ou en tête d’une ligne de commande shell', () => {
  assert.deepEqual(formes(`${'execFileSync'}('git', ['status'])`), [[1, 'lanceur']])
  assert.deepEqual(formes(`${'spawnSync'}("git", args)`), [[1, 'lanceur']])
  assert.deepEqual(formes(`const x = 1\n${'run'}('git', ['fetch'], { budget })`), [[2, 'lanceur']])
  assert.deepEqual(formes(`${'execSync'}('git status --porcelain')`), [[1, 'lanceur']])
  assert.deepEqual(formes('throw new Error(`git ${args.join(" ")} refusé`)'), [], 'un message qui commence par git n’en lance pas')
  assert.deepEqual(formes("// execFileSync('git', args)\n/* spawnSync('git') */"), [], 'un commentaire ne lance rien')
})

test('découpe : un split sur NUL hors de l’hôte', () => {
  assert.deepEqual(formes("sortie.split('\\0')"), [[1, 'decoupe']])
  assert.deepEqual(formes('sortie.split("\\u0000").filter(Boolean)'), [[1, 'decoupe']])
  assert.deepEqual(formes("sortie.split('\\n')"), [])
})

test('forme : une option qui produit des chemins, où qu’elle soit écrite hors de l’hôte', () => {
  assert.deepEqual(formes("lire(['diff', '--cached', '--name-only']).split('\\n')"), [[1, 'forme']])
  assert.deepEqual(formes("const args = ['ls-files', '-z']"), [[1, 'forme'], [1, 'forme']])
  assert.deepEqual(formes("git(['show', '--numstat', sha])"), [[1, 'forme']])
  assert.deepEqual(formes("eolsDe(git, ['ls-files', '--eol', '--cached'])"), [[1, 'forme']], 'une question qui fixe sa commande ne reçoit pas de forme')
})
