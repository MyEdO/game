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

test('CYCLE de relais : un appel en cours aux MÊMES arguments ne s’ajoute rien ; une ré-entrée à d’autres arguments s’évalue, la suivante est un cycle nommé', () => {
  const modules = {
    'scripts/lib/cycle.mjs': "import { readdirSync } from 'node:fs'\nimport { join } from 'node:path'\nexport function a(d, n) { return n ? a(d, n - 1) : readdirSync(d) }\n" +
      "export function b(d) { return readdirSync(d) || b(join(d, 'x')) }\n",
    'scripts/t.test.mjs': "import { a, b } from './lib/cycle.mjs'\na('src', 3)\nb('docs')\n",
  }
  const [deA, deB] = racinesDe(modules, 'scripts/t.test.mjs')
  assert.deepEqual(deA, [{ chemin: 'src' }])
  assert.deepEqual(deB, [{ chemin: 'docs' }, { chemin: 'docs/x' }, { non: 'cycle d’appels b'.replace('’', "'") }])
})

test('rien n’est deviné : paramètre d’une fonction locale, appel inconnu', () => {
  const texte = "import { readdirSync } from 'node:fs'\ntest('x', (dir) => readdirSync(dir))\nreaddirSync(calculer())\n"
  assert.deepEqual(racinesDe({ 'scripts/t.test.mjs': texte }, 'scripts/t.test.mjs'), [[{ non: 'paramètre dir' }], [{ non: 'appel calculer' }]])
})

test('evaluer : une expression sans module', () => {
  assert.deepEqual(evaluer({ k: 'join', v: [{ k: 'chemin', v: '' }, { k: 'lit', v: 'src' }] }), [{ chemin: 'src' }])
})

test('INVARIANT : aucune branche perdue — un site non littéralement `null` ne rend jamais pour seules valeurs des formes nulles (folioLineAlign.mjs, `makeChapterReader`)', () => {
  const modules = {
    'scripts/raw/lib.mjs': "import { join } from 'node:path'\nlet sourcePrincipale = null\nexport function sourceDe() {\n  if (sourcePrincipale) return sourcePrincipale\n" +
      "  sourcePrincipale = join(calculer(), 'Source')\n  return sourcePrincipale\n}\nexport const livreDuSigle = (abbr, registre) => registre.find((b) => b.abbr === abbr) ?? null\n",
    'scripts/guards/folio.mjs': "import { readdirSync, readFileSync } from 'node:fs'\nimport { join } from 'node:path'\nimport { livreDuSigle, sourceDe } from '../raw/lib.mjs'\n" +
      "export function lecteurDeChapitres(books) {\n  return (abbr) => {\n    const dir = livreDuSigle(abbr, books)?.dir\n    return dir ? readdirSync(dir) : null\n  }\n}\n" +
      "readFileSync(join(sourceDe(), 'livre.txt'))\nconst env = () => ({ ...process.env, AUTRE: 'x' })\nreadFileSync(env().CONFIG)\n" +
      "function lireSous(dir = 'docs') { return readdirSync(dir) }\nlireSous({}.dir)\n",
    'scripts/guards/folio.test.mjs': "import { readFileSync } from 'node:fs'\nimport { lecteurDeChapitres } from './folio.mjs'\n" +
      "lecteurDeChapitres(JSON.parse(readFileSync('src/data/books.json', 'utf8')))\n",
  }
  const evaluateur = evaluateurDe(modules)
  const sites = Object.keys(modules).flatMap((f) => evaluateur.sitesDe(f).map((s) => ({ ...s, f })))
  const nul = (v) => v.non === 'forme NullKeyword'
  assert.deepEqual(sites.filter((s) => !s.relais && s.valeurs.every(nul)).map((s) => `${s.f}:${s.ligne}`), [])
  assert.deepEqual(sites.map((s) => [`${s.f}:${s.ligne} ${s.appel}`, s.relais, s.valeurs]), [
    ['scripts/guards/folio.mjs:7 readdirSync', true, [{ non: 'forme NullKeyword' }]],
    ['scripts/guards/folio.mjs:10 readFileSync', false, [{ non: 'forme NullKeyword' }, { non: 'appel calculer' }]],
    ['scripts/guards/folio.mjs:12 readFileSync', false, [{ non: 'process introuvable' }]],
    ['scripts/guards/folio.mjs:13 readdirSync', true, []],
    ['scripts/guards/folio.mjs:14 lireSous', false, [{ chemin: 'docs' }]],
    ['scripts/guards/folio.test.mjs:3 lecteurDeChapitres', false, [{ non: 'appel JSON.parse' }, { non: 'forme NullKeyword' }]],
    ['scripts/guards/folio.test.mjs:3 readFileSync', false, [{ chemin: 'src/data/books.json' }]],
  ])
})

test('RÉAFFECTATION : la liaison vaut sa valeur initiale et chaque membre droit qui la vise ; la récurrence se nomme', () => {
  const modules = {
    // `scripts/raw/_lib.mjs`, `chapterFile` : `let res` sans valeur initiale, posé par branches.
    'scripts/raw/lib.mjs': "import { join } from 'node:path'\nconst cache = new Map()\nexport function chapitre(abbr) {\n  let res\n" +
      "  if (cache.has(abbr)) {\n    res = cache.get(abbr)\n  } else {\n    const dir = 'Source/livre'\n    res = null\n" +
      "    if (dir) res = { path: join(dir, 'ch.md') }\n  }\n  return res\n}\n",
    // `src/data/prop-art-labels-failfast.test.ts`, `beforeAll` : `let racine` posé dans `beforeAll`.
    // `scripts/docs/lib/chemin-mesure.mjs`, `ancetreExistant` : `ancetre = parent`, parent = `dirname(ancetre)`.
    'scripts/x/garde.test.mjs': "import { existsSync, mkdtempSync, readdirSync, readFileSync } from 'node:fs'\nimport { tmpdir } from 'node:os'\n" +
      "import path, { join } from 'node:path'\nimport { chapitre } from '../raw/lib.mjs'\nreadFileSync(chapitre('LDB').path)\n" +
      "let racine\nbeforeAll(() => { racine = mkdtempSync(join(tmpdir(), 'x-')) })\nit('lit', () => readdirSync(join(racine, 'defs')))\n" +
      "export function ancetreExistant(abs) {\n  let ancetre = abs\n  while (!existsSync(ancetre)) {\n    const parent = path.dirname(ancetre)\n" +
      "    if (parent === ancetre) return null\n    ancetre = parent\n  }\n  return ancetre\n}\nlet n = 'a.json'\nn += '.bak'\nreadFileSync(n)\n",
  }
  const sites = evaluateurDe(modules).sitesDe('scripts/x/garde.test.mjs')
  assert.deepEqual(sites.map((s) => [`${s.ligne} ${s.appel}`, s.relais, s.valeurs]), [
    ['5 readFileSync', false, [{ non: 'appel cache.get' }, { non: 'forme NullKeyword' }, { chemin: 'Source/livre/ch.md' }]],
    ['8 readdirSync', false, [{ hors: true }]],
    ['11 existsSync', true, [{ non: 'ancetre réaffectée en récurrence' }]],
    ['20 readFileSync', false, [{ chemin: 'a.json' }, { non: 'n réaffectée' }]],
  ])
})

test('FONCTION ANONYME passée en argument : appelée, elle rend ses retours dans le contexte qui l’a définie (fraicheur-docs.mjs, `dansVue`)', () => {
  const modules = {
    'scripts/x/vue.mjs': "import { readFileSync } from 'node:fs'\nimport { join } from 'node:path'\n" +
      "function dansVue(vue, mesurer) { if (!vue) return mesurer()\n  return vue.get('x') }\n" +
      "function cheminSous(racine, rel, vue) {\n  if (vue) return dansVue(vue, () => cheminSous(racine, rel))\n  return join(racine, rel)\n}\n" +
      "export function lire(racine, rel, vue) { return readFileSync(cheminSous(racine, rel, vue)) }\nlire('donnees', 'a.json')\n",
  }
  const sites = evaluateurDe(modules).sitesDe('scripts/x/vue.mjs').filter((s) => !s.relais)
  assert.deepEqual(sites.map((s) => [`${s.ligne} ${s.appel}`, s.valeurs]), [['10 lire', [{ non: 'appel vue.get' }, { chemin: 'donnees/a.json' }]]])
})

test('une raison qui embarque du TEXTE SOURCE tient sur une ligne : ses blancs, retours à la ligne compris, se replient en une espace', () => {
  const texte = "import { readdirSync } from 'node:fs'\nimport { outils } from 'ailleurs'\n" +
    "readdirSync(fabrique(\n  'x',\n)('y'))\nreaddirSync(outils\n    .calculer())\n"
  assert.deepEqual(racinesDe({ 'scripts/t.test.mjs': texte }, 'scripts/t.test.mjs'),
    [[{ non: "appel fabrique( 'x', )" }], [{ non: 'appel outils .calculer' }]])
})
