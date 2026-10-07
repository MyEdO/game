// Contrat du lecteur de RACINES BALAYÉES (#2400) : lectures de base, relais dérivés, valeurs de retour,
// et ce qu'il ne devine pas. Un dépôt EN MÉMOIRE par cas : `modules` (chemin → texte).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { posix } from 'node:path'
import { analyserTexte } from './dialecte.mjs'
import { evaluateurDuDepot, evaluer, lectureDeModule } from './racinesBalayees.mjs'

const lire = (rel, text) => lectureDeModule(rel, analyserTexte({ rel, text }).sourceFile)

/** L'évaluateur d'un dépôt en mémoire : les spécificateurs relatifs se résolvent par chemin. */
const evaluateurDe = (modules) => {
  const lectures = new Map()
  return evaluateurDuDepot({
    lecture: (f) => Object.hasOwn(modules, f) ? (lectures.get(f) ?? lectures.set(f, lire(f, modules[f])).get(f)) : null,
    cible: (f, spec) => {
      const g = posix.join(posix.dirname(f), spec)
      return spec.startsWith('.') && Object.hasOwn(modules, g) ? g : null
    },
  })
}

/** Les racines de chaque site NON relais de `f`. */
const racinesDe = (modules, f) => evaluateurDe(modules).sitesDe(f).filter((s) => !s.relais).map((s) => s.valeurs)

const ROOT = "import { join } from 'node:path'\nimport { fileURLToPath } from 'node:url'\nimport { readdirSync, readFileSync, existsSync, mkdtempSync } from 'node:fs'\nconst ROOT = fileURLToPath(new URL('../..', import.meta.url))\n"

test('lectures de base : littéral, join depuis la racine du module, boucle, fichier exact, sonde d’absence, porte git', () => {
  const texte = ROOT + [
    "readdirSync(join(ROOT, 'docs', 'plans'))",
    "for (const d of ['a', 'b']) readdirSync(d)",
    "readFileSync(join(ROOT, 'src/data/x.json'), 'utf8')",
    "existsSync(new URL('./fixtures/neuf.json', import.meta.url))",
    "listerImage(depotDe(process.cwd()), TRAVAIL, 'scripts')",
  ].join('\n')
  assert.deepEqual(racinesDe({ 'scripts/x/garde.test.mjs': texte }, 'scripts/x/garde.test.mjs'), [
    [{ chemin: 'docs/plans' }],
    [{ chemin: 'a' }, { chemin: 'b' }],
    [{ chemin: 'src/data/x.json' }],
    [{ chemin: 'scripts/x/fixtures/neuf.json' }],
    [{ chemin: 'scripts' }],
  ])
})

test('RELAIS dérivé : un paramètre qui alimente une lecture, à un puis deux niveaux, d’un module à l’autre', () => {
  const modules = {
    'scripts/lib/lister.mjs': "import { readdirSync } from 'node:fs'\nimport { join } from 'node:path'\n" +
      "export function listerArbre(dir) {\n  const marcher = (rel) => readdirSync(rel ? join(dir, rel) : dir)\n  return marcher('')\n}\n",
    'scripts/lib/corpus.mjs': "import { listerArbre } from './lister.mjs'\nimport { join } from 'node:path'\nexport const corpus = (racines) => racines.map((r) => listerArbre(join(r, 'sous')))\n",
    'scripts/garde.test.mjs': "import { listerArbre } from './lib/lister.mjs'\nimport { corpus } from './lib/corpus.mjs'\nlisterArbre('src/ui')\ncorpus(['src/a', 'src/b'])\n",
  }
  const evaluateur = evaluateurDe(modules)
  assert.deepEqual(evaluateur.sitesDe('scripts/lib/lister.mjs').map((s) => s.relais), [true])
  assert.deepEqual(evaluateur.sitesDe('scripts/lib/corpus.mjs').map((s) => s.relais), [true])
  assert.deepEqual(evaluateur.relaisExportes('scripts/lib/corpus.mjs'), ['corpus'])
  assert.deepEqual(racinesDe(modules, 'scripts/garde.test.mjs'), [
    [{ chemin: 'src/ui', sous: 'paramètre rel' }, { chemin: 'src/ui' }],
    [{ chemin: 'src/a/sous', sous: 'paramètre rel' }, { chemin: 'src/b/sous', sous: 'paramètre rel' }, { chemin: 'src/a/sous' }, { chemin: 'src/b/sous' }],
  ])
})

test('VALEUR DE RETOUR d’une fonction importée, paramètre par défaut compris', () => {
  const modules = {
    'scripts/lib/projets.mjs': ROOT + "export function dossierDesProjets(racine = ROOT) {\n  return join(racine, 'docs/projets')\n}\n",
    'scripts/garde.test.mjs': "import { readdirSync } from 'node:fs'\nimport { dossierDesProjets } from './lib/projets.mjs'\nreaddirSync(dossierDesProjets())\n",
  }
  assert.deepEqual(racinesDe(modules, 'scripts/garde.test.mjs'), [[{ chemin: 'docs/projets' }]])
})

test('DÉSTRUCTURATION d’un objet rendu, champ par champ ; accès de propriété d’une constante', () => {
  const modules = {
    'scripts/lib/lieux.mjs': "export function lieux() { return { donnees: 'src/data', autre: 'x' } }\nexport const PERIMETRE = { racines: ['src/state'] }\n",
    'scripts/garde.test.mjs': "import { readdirSync } from 'node:fs'\nimport { lieux, PERIMETRE } from './lib/lieux.mjs'\nconst { donnees } = lieux()\nreaddirSync(donnees)\nreaddirSync(PERIMETRE.racines)\n",
  }
  assert.deepEqual(racinesDe(modules, 'scripts/garde.test.mjs'), [[{ chemin: 'src/data' }], [{ chemin: 'src/state' }]])
})

test('PROJECTION : `map` et `flatMap` rendent les valeurs de leur rappel, élément du receveur lié', () => {
  const modules = {
    'scripts/lib/lister.mjs': "import { readdirSync } from 'node:fs'\nexport function listerArbre(dir) { return readdirSync(dir) }\n",
    'scripts/lib/corpus.mjs': ROOT + "import { listerArbre } from './lister.mjs'\nexport function lireCorpus(dirs) {\n  const bases = dirs.map((d) => join(ROOT, d))\n  return bases.flatMap((b) => listerArbre(b))\n}\n",
    'scripts/garde.test.mjs': "import { lireCorpus } from './lib/corpus.mjs'\nlireCorpus(['src/ui', 'src/lib'])\n",
  }
  assert.deepEqual(racinesDe(modules, 'scripts/garde.test.mjs'), [[{ chemin: 'src/ui' }, { chemin: 'src/lib' }]])
})

test('BOUCLE déstructurée sur un tableau évaluable ; CHAMP absent d’un objet passé en argument : défaut du paramètre déstructuré', () => {
  const modules = {
    'scripts/lib/ci.mjs': "import { readFileSync } from 'node:fs'\nimport { join } from 'node:path'\n" +
      "export function lireCi({ cwd = process.cwd(), fichier } = {}) {\n  return readFileSync(fichier ?? join(cwd, 'ci.yml'))\n}\n",
    'scripts/garde.test.mjs': "import { readdirSync } from 'node:fs'\nimport { lireCi } from './lib/ci.mjs'\n" +
      "const RACINES = [{ dir: 'src/a' }, { dir: 'src/b' }]\nfor (const { dir } of RACINES) readdirSync(dir)\nlireCi({ cwd: 'sous' })\nlireCi()\n",
  }
  assert.deepEqual(racinesDe(modules, 'scripts/garde.test.mjs'), [[{ chemin: 'src/a' }, { chemin: 'src/b' }], [{ chemin: 'sous/ci.yml' }], [{ chemin: 'ci.yml' }]])
})

test('`join` de TABLEAU : `split(…).join(…)` rend son texte, seul le `join` du module de chemin joint', () => {
  const texte = ROOT + "import path, { sep } from 'node:path'\nreaddirSync(join(ROOT, 'docs').split(sep).join('/'))\nreaddirSync(path.posix.join('src', 'ui'))\nreaddirSync(['a', 'b'].join('/'))\n"
  assert.deepEqual(racinesDe({ 'scripts/x/t.test.mjs': texte }, 'scripts/x/t.test.mjs'), [[{ chemin: 'docs' }], [{ chemin: 'src/ui' }], [{ non: 'appel [\'a\', \'b\'].join' }]])
})

test('un dossier temporaire est HORS du dépôt, jamais un non résolu', () => {
  const texte = ROOT + "const d = mkdtempSync(join(tmpdir(), 'x-'))\nreaddirSync(d)\nreadFileSync(join(d, 'a.json'))\n"
  assert.deepEqual(racinesDe({ 'scripts/t.test.mjs': texte }, 'scripts/t.test.mjs'), [[{ hors: true }], [{ hors: true }]])
})

test('CYCLE de relais : borné, rendu avec sa raison nommée', () => {
  const modules = {
    'scripts/lib/cycle.mjs': "import { readdirSync } from 'node:fs'\nexport function a(d, n) { return n ? a(d, n - 1) : readdirSync(d) }\n",
    'scripts/t.test.mjs': "import { a } from './lib/cycle.mjs'\na('src', 3)\n",
  }
  assert.deepEqual(racinesDe(modules, 'scripts/t.test.mjs'), [[{ non: 'cycle d’appels a'.replace('’', "'") }, { chemin: 'src' }]])
})

test('rien n’est deviné : paramètre d’une fonction locale, appel inconnu', () => {
  const texte = "import { readdirSync } from 'node:fs'\ntest('x', (dir) => readdirSync(dir))\nreaddirSync(calculer())\n"
  assert.deepEqual(racinesDe({ 'scripts/t.test.mjs': texte }, 'scripts/t.test.mjs'), [[{ non: 'paramètre dir' }], [{ non: 'appel calculer' }]])
})

test('evaluer : une expression sans module', () => {
  assert.deepEqual(evaluer({ k: 'join', v: [{ k: 'chemin', v: '' }, { k: 'lit', v: 'src' }] }), [{ chemin: 'src' }])
})
