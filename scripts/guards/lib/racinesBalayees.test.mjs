// Contrat du lecteur de RACINES BALAYÉES (#2400) : ce que déclare un appel de helper, et ce qu'il ne
// devine pas.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { analyserTexte } from './dialecte.mjs'
import { evaluer, lectureDeModule } from './racinesBalayees.mjs'

const lire = (rel, text) => lectureDeModule(rel, analyserTexte({ rel, text }).sourceFile)
const SANS_IMPORT = { importe: () => [{ non: 'aucun import' }] }
const racinesDe = (rel, text, contexte = SANS_IMPORT) => lire(rel, text).sites.map((s) => evaluer(s.racines, contexte))

test('littéral, tableau, join depuis la racine du module, boucle sur un tableau littéral', () => {
  const texte = [
    "import { join } from 'node:path'",
    "import { fileURLToPath } from 'node:url'",
    "const ROOT = fileURLToPath(new URL('../..', import.meta.url))",
    "readCorpus(['src/ui', 'src/state'])",
    "listerArbre(join(ROOT, 'docs', 'plans'))",
    "for (const d of ['a', 'b']) listerDossier(d)",
    "listerImage(depotDe(process.cwd()), TRAVAIL, 'scripts')",
    'listerTests()',
    "listerDossier(join(dirname(fileURLToPath(import.meta.url)), 'fixtures'))",
  ].join('\n')
  assert.deepEqual(racinesDe('scripts/x/garde.test.mjs', texte), [
    [{ chemin: 'src/ui' }, { chemin: 'src/state' }],
    [{ chemin: 'docs/plans' }],
    [{ chemin: 'a' }, { chemin: 'b' }],
    [{ chemin: 'scripts' }],
    [{ chemin: 'scripts' }],
    [{ chemin: 'scripts/x/fixtures' }],
  ])
})

test('constante IMPORTÉE : l’expression attend la résolution, le contexte la rend', () => {
  const [site] = lire('src/garde.test.ts', "import { SCAN } from './scan.mjs'\nreadCorpus(SCAN)\n").sites
  assert.deepEqual(site.racines, { k: 'importe', spec: './scan.mjs', nom: 'SCAN' })
  const exports = lire('src/scan.mjs', "export const SCAN = ['src/state', 'src/lib']\n").exports
  assert.deepEqual(evaluer(site.racines, { importe: (_spec, nom) => evaluer(exports[nom], SANS_IMPORT) }), [{ chemin: 'src/state' }, { chemin: 'src/lib' }])
})

test('rien n’est deviné : paramètre, appel inconnu ; un dossier temporaire est HORS du dépôt', () => {
  const texte = "export function f(dir) { return listerDossier(dir) }\nlisterArbre(calculer())\nlisterArbre(mkdtempSync('x'))\n"
  assert.deepEqual(racinesDe('scripts/lib.mjs', texte), [[{ non: 'paramètre dir' }], [{ non: 'appel calculer' }], [{ hors: true }]])
})

test('un FOYER relaie ses paramètres : son site est un relais, pas une déclaration', () => {
  const texte = 'export function readCorpus(dirs) { return dirs.map((d) => listerArbre(d)) }\n'
  assert.deepEqual(lire('scripts/guards/lib/sourceCorpus.mjs', texte).sites.map((s) => s.relais), [true])
  assert.deepEqual(lire('scripts/guards/lib/autre.mjs', texte).sites.map((s) => s.relais), [false])
})
