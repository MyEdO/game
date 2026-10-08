// Contrat du lecteur de RACINES BALAYÉES (#2400) : lectures de base, relais dérivés, valeurs de retour,
// et ce qu'il ne devine pas. Un dépôt EN MÉMOIRE par cas : `modules` (chemin → texte).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { posix } from 'node:path'
import { writeFileSync, rmSync } from 'node:fs'
import { instanceDeDepot } from './depotGabarit.mjs'
import { balayagesNonResolus, perimetreDuDepot } from '../../test/perimetre.mjs'
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
const couvert = (origine, raison) => ({ chemin: '', sous: `couverture corpus entier : ${origine} — ${raison}` })
const couvertureTemporaire = couvert('node:os#tmpdir', 'répertoire temporaire dépendant de l’environnement')

test('contrats de source : référence locale, alias importé, homonyme opaque et résumé corpus', () => {
  const modules = {
    'canon.mjs': "export function opaque() { return inconnu() }\nexport function lit() { readFileSync(inconnu()) }\nexport const CONTRATS_DE_DERIVATION = [{fonction:opaque,namespace:'/host'}, {fonction:lit,lectures:'corpus'}]",
    'autre.mjs': 'export function opaque() { return inconnu() }',
    'banc.mjs': "import {opaque as vrai, lit} from './canon.mjs'\nimport {opaque as faux} from './autre.mjs'\nreadFileSync(vrai())\nreadFileSync(faux())\nlit('../arbitraire')",
  }
  assert.deepEqual(racinesDe(modules, 'banc.mjs'), [[{ hors: true }], [{ non: 'appel inconnu' }], [couvert('canon.mjs#lit', 'résumé de lecture déclaré à la source')]])
  assert.deepEqual(racinesDe(modules, 'canon.mjs'), [[couvert('canon.mjs#lit', 'résumé de lecture déclaré à la source')]])
})

test('namespace borné : fragments recomposés, parent et sortie couvrent le corpus, cible readlink opaque', () => {
  const texte = "import {join,dirname} from 'node:path'\nexport function base() {return opaque()}\nexport const CONTRATS_DE_DERIVATION=[{fonction:base,namespace:'/proc'}]\nconst b=base()\nfor(const nom of readdirSync(b)) {readFileSync(join(b,nom,'stat'));readFileSync(nom)}\nreadFileSync(dirname(b))\nreadFileSync(join(b,'..','src'))\nreadFileSync(readlinkSync(join(b,'1/cwd')))"
  const rendu = racinesDe({ 'banc.mjs': texte }, 'banc.mjs')
  assert.deepEqual(rendu, [[{ hors: true }], [couvert('banc.mjs#base:/proc', 'descente par fragment de namespace susceptible de lien')], [{ non: 'fragment de répertoire sans sa base' }], [couvert('banc.mjs#base:/proc', 'parent du namespace externe')], [couvert('banc.mjs#base:/proc', 'sortie du namespace externe')], [{ non: 'appel readlinkSync' }]])
  for (const fichier of ['src/a.ts', 'scripts/x.mjs', 'Source/livre.md'])
    for (const indice of [3, 4]) assert.ok(fichier.startsWith(rendu[indice][0].chemin))
})

test('fragment direct de namespace : lecture descendante couvre le consommateur réel', () => {
  const source = "import {join} from 'node:path';import {readdirSync,readFileSync} from 'node:fs';function base(){return opaque()};export const CONTRATS_DE_DERIVATION=[{fonction:base,namespace:'.git'}];const b=base();for(const nom of readdirSync(b)){readFileSync(join(b,nom))}"
  const racines = racinesDe({ 'scripts/banc.test.mjs': source }, 'scripts/banc.test.mjs')
  const { racine, sha } = instanceDeDepot({ fichiers: { 'scripts/banc.test.mjs': source, 'src/a.md': 'initial', '.gitignore': 'node_modules/' } })
  try {
    writeFileSync(posix.join(racine, 'src/a.md'), 'touché')
    assert.ok(perimetreDuDepot(racine, { base: sha }).retenus.has('scripts/banc.test.mjs'))
    assert.deepEqual(racines[1], [couvert('scripts/banc.test.mjs#base:.git', 'descente par fragment de namespace susceptible de lien')])
  } finally { rmSync(racine, { recursive: true, force: true }) }
})

test('composition : mkdtemp couvre son suffixe aléatoire, join et resolve diffèrent, extérieur ne masque pas inconnu', () => {
  const texte = "import {join,resolve} from 'node:path'\nimport {tmpdir} from 'node:os'\nimport {mkdtempSync} from 'node:fs'\nreadFileSync(mkdtempSync(join(process.cwd(),'fixture-')))\nreadFileSync(join('src','/data'))\nreadFileSync(resolve('src','/data'))\nreadFileSync(join(tmpdir(),inconnu()))\nreadFileSync(join(tmpdir(),'..','x'))\nreadFileSync(choix ? tmpdir() : inconnu())\nreadFileSync('/absolu/arbitraire')"
  assert.deepEqual(racinesDe({ 'banc.mjs': texte }, 'banc.mjs'), [
    [couvert('corpus:fixture-', 'suffixe aléatoire mkdtempSync')], [{ chemin: 'src/data' }], [{ non: 'chemin absolu /data' }],
    [couvertureTemporaire], [couvertureTemporaire],
    [couvertureTemporaire, { non: 'appel inconnu' }], [{ non: 'chemin absolu /absolu/arbitraire' }],
  ])
})

test('tmpdir et mkdtemp : identité builtin aliasée, homonymes locaux et étrangers', () => {
  assert.deepEqual(racinesDe({ 'banc.mjs': "import {tmpdir as lieu} from 'node:os';import {mkdtempSync as creer} from 'node:fs';readFileSync(creer(lieu()+'x-'))" }, 'banc.mjs'), [[couvertureTemporaire]])
  assert.deepEqual(racinesDe({ 'banc.mjs': "import * as os from 'node:os';import fsReel from 'node:fs';readFileSync(fsReel.mkdtempSync(os.tmpdir()+'x-'))" }, 'banc.mjs'), [[couvertureTemporaire]])
  assert.deepEqual(racinesDe({ 'banc.mjs': "function tmpdir(){return 'src'};function mkdtempSync(x){return 'Source'};readFileSync(tmpdir());readFileSync(mkdtempSync('x'))" }, 'banc.mjs'), [[{ chemin: 'src' }], [{ chemin: 'Source' }]])
  const modules = { 'autre.mjs': "export function tmpdir(){return 'src'};export function mkdtempSync(){return 'Source'}", 'banc.mjs': "import {tmpdir,mkdtempSync} from './autre.mjs';readFileSync(tmpdir());readFileSync(mkdtempSync())" }
  assert.deepEqual(racinesDe(modules, 'banc.mjs'), [[{ chemin: 'src' }], [{ chemin: 'Source' }]])
})

test('mkdtemp : le consommateur réel retient une lecture sous suffixe aléatoire', () => {
  const { racine, sha } = instanceDeDepot({ fichiers: {
    'scripts/banc.test.mjs': "import {join} from 'node:path';import {mkdtempSync,readFileSync} from 'node:fs';const dir=mkdtempSync(join(process.cwd(),'fixture-'));readFileSync(join(dir,'x.md'))",
    'fixture-ABC/x.md': 'initial', '.gitignore': 'node_modules/',
  } })
  try {
    assert.deepEqual(balayagesNonResolus(racine), [])
    writeFileSync(posix.join(racine, 'fixture-ABC/x.md'), 'touché')
    assert.ok(perimetreDuDepot(racine, { base: sha }).retenus.has('scripts/banc.test.mjs'))
  } finally { rmSync(racine, { recursive: true, force: true }) }
})

test('contrat sérialisé : la source est une dépendance des réponses mises en cache', () => {
  const source = "export function lit(){readFileSync(inconnu())}\nexport const CONTRATS_DE_DERIVATION=[{fonction:lit,lectures:'corpus'}]"
  const modules = { 'canon.mjs': source, 'banc.mjs': "import {lit} from './canon.mjs'\nlit('x')" }
  const evaluateur = evaluateurDe(modules)
  const premier = evaluateur.tracer(() => evaluateur.sitesDe('banc.mjs'))
  const second = evaluateur.tracer(() => evaluateur.sitesDe('banc.mjs'))
  assert.ok(second.requetes.has(JSON.stringify(['lecture', 'canon.mjs'])))
  assert.deepEqual([...second.requetes].sort(), [...premier.requetes].sort())
  assert.equal(JSON.parse(JSON.stringify(lire('canon.mjs', source))).fonctions.lit.contrat.lectures, 'corpus')
  modules['canon.mjs'] = source.replace("lectures:'corpus'", "lectures:'invalide'")
  assert.notDeepEqual(evaluateurDe(modules).sitesDe('banc.mjs'), premier.resultat)
})

test('consommateur canonique : couverture de tous fichiers et changement de contrat après cache chaud', () => {
  const source = "export function lit(){readFileSync(inconnu())}\nexport const CONTRATS_DE_DERIVATION=[{fonction:lit,lectures:'corpus'}]"
  const { racine, sha } = instanceDeDepot({ fichiers: {
    'scripts/canon.mjs': source,
    'scripts/banc.test.mjs': "import {lit} from './canon.mjs'\nlit('../inconnu')",
    'src/a.md': 'initial', 'Source/b.md': 'initial',
    '.gitignore': 'node_modules/',
  } })
  try {
    assert.deepEqual(balayagesNonResolus(racine), [])
    assert.deepEqual(balayagesNonResolus(racine), [])
    for (const fichier of ['src/a.md', 'Source/b.md']) {
      writeFileSync(posix.join(racine, fichier), 'touché')
      assert.ok(perimetreDuDepot(racine, { base: sha }).retenus.has('scripts/banc.test.mjs'), fichier)
      writeFileSync(posix.join(racine, fichier), 'initial')
    }
    writeFileSync(posix.join(racine, 'scripts/canon.mjs'), source.replace("lectures:'corpus'", "lectures:'invalide'"))
    const froid = balayagesNonResolus(racine)
    assert.ok(froid.some((s) => s.fichier === 'scripts/canon.mjs' && s.raison === 'appel inconnu'))
    assert.deepEqual(balayagesNonResolus(racine), froid)
  } finally { rmSync(racine, { recursive: true, force: true }) }
})

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
    [couvert('corpus:src/ui', 'paramètre rel'), { chemin: 'src/ui' }],
    [couvert('corpus:src/a/sous', 'paramètre rel'), couvert('corpus:src/b/sous', 'paramètre rel'), { chemin: 'src/a/sous' }, { chemin: 'src/b/sous' }],
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

test('un dossier temporaire dépendant de l’environnement couvre le corpus', () => {
  const texte = ROOT + "import {tmpdir} from 'node:os'\nconst d = mkdtempSync(join(tmpdir(), 'x-'))\nreaddirSync(d)\nreadFileSync(join(d, 'a.json'))\n"
  assert.deepEqual(racinesDe({ 'scripts/t.test.mjs': texte }, 'scripts/t.test.mjs'), [[couvertureTemporaire], [couvertureTemporaire]])
})

test('CYCLE de relais : une ré-entrée aux MÊMES arguments est un cycle nommé ; à d’autres arguments elle s’évalue, la suivante est un cycle nommé', () => {
  const modules = {
    'scripts/lib/cycle.mjs': "import { readdirSync } from 'node:fs'\nimport { join } from 'node:path'\nexport function a(d, n) { return n ? a(d, n - 1) : readdirSync(d) }\n" +
      "export function b(d) { return readdirSync(d) || b(join(d, 'x')) }\n",
    'scripts/t.test.mjs': "import { a, b } from './lib/cycle.mjs'\na('src', 3)\nb('docs')\n",
  }
  const [deA, deB] = racinesDe(modules, 'scripts/t.test.mjs')
  assert.deepEqual(deA, [{ non: "cycle d'appels a" }, { chemin: 'src' }])
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
  const nul = (v) => v.non === 'valeur nulle'
  assert.deepEqual(sites.filter((s) => !s.relais && s.valeurs.every(nul)).map((s) => `${s.f}:${s.ligne}`), [])
  assert.deepEqual(sites.map((s) => [`${s.f}:${s.ligne} ${s.appel}`, s.relais, s.valeurs]), [
    ['scripts/guards/folio.mjs:7 readdirSync', true, [{ non: 'valeur nulle' }]],
    ['scripts/guards/folio.mjs:10 readFileSync', false, [{ non: 'valeur nulle' }, { non: 'appel calculer' }]],
    ['scripts/guards/folio.mjs:12 readFileSync', false, [{ non: 'process introuvable' }]],
    ['scripts/guards/folio.mjs:13 readdirSync', true, []],
    ['scripts/guards/folio.mjs:14 lireSous', false, [{ chemin: 'docs' }]],
    ['scripts/guards/folio.test.mjs:3 lecteurDeChapitres', false, [{ non: 'appel JSON.parse' }, { non: 'valeur nulle' }]],
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
    ['5 readFileSync', false, [{ non: 'appel cache.get' }, { non: 'valeur nulle' }, { chemin: 'Source/livre/ch.md' }]],
    ['8 readdirSync', false, [couvertureTemporaire]],
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
  assert.deepEqual(sites.map((s) => [`${s.ligne} ${s.appel}`, s.valeurs]), [
    ['10 lire', [{ non: "cycle d'appels cheminSous, dansVue" }, { non: 'appel vue.get' }, { chemin: 'donnees/a.json' }]],
  ])
})

test('une raison qui embarque du TEXTE SOURCE tient sur une ligne : ses blancs, retours à la ligne compris, se replient en une espace', () => {
  const texte = "import { readdirSync } from 'node:fs'\nimport { outils } from 'ailleurs'\n" +
    "readdirSync(fabrique(\n  'x',\n)('y'))\nreaddirSync(outils\n    .calculer())\n"
  assert.deepEqual(racinesDe({ 'scripts/t.test.mjs': texte }, 'scripts/t.test.mjs'),
    [[{ non: "appel fabrique( 'x', )" }], [{ non: 'appel outils .calculer' }]])
})

/** Les racines de chaque site de `fichiers`, lues dans CET ordre par UN évaluateur, valeurs triées. */
const sitesDansLOrdre = (modules, fichiers) => {
  const evaluateur = evaluateurDe(modules)
  return fichiers.flatMap((f) => evaluateur.sitesDe(f).map((s) => [`${f}:${s.ligne} ${s.appel}`, s.relais,
    s.valeurs.map((v) => JSON.stringify(v)).sort()]))
}
const ENTETE = "import { readdirSync, existsSync } from 'node:fs'\nimport { join, dirname } from 'node:path'\n"

test('CYCLE ouvert aux mêmes arguments : un relais MUTUEL garde ses deux sites et nomme le cycle, quel que soit le module lu d’abord (CAS 1)', () => {
  const modules = {
    'scripts/lib/m.mjs': ENTETE + "export function a(d) { readdirSync(d); return b(d) }\nexport function b(d) { return a(d) }\n",
    'scripts/t.test.mjs': "import { a, b } from './lib/m.mjs'\na('src')\nb('docs')\n",
  }
  const attendu = [
    ['scripts/t.test.mjs:2 a', false, ['{"chemin":"src"}', '{"non":"cycle d\'appels a, b"}']],
    ['scripts/t.test.mjs:3 b', false, ['{"chemin":"docs"}', '{"non":"cycle d\'appels a, b"}']],
  ]
  assert.deepEqual(sitesDansLOrdre(modules, ['scripts/t.test.mjs']), attendu)
  assert.deepEqual(sitesDansLOrdre(modules, ['scripts/lib/m.mjs', 'scripts/t.test.mjs']).filter(([s]) => s.startsWith('scripts/t.')), attendu)
})

test('CYCLE ouvert aux mêmes arguments : la valeur rendue par la récursion est un cycle nommé, aucun ancêtre inventé, jamais la racine du dépôt (CAS 2, I1, I2)', () => {
  const haut = {
    'scripts/lib/r.mjs': ENTETE + "export function haut(d) { return existsSync(d) ? d : dirname(haut(d)) }\n",
    'scripts/t.test.mjs': "import { readdirSync } from 'node:fs'\nimport { haut } from './lib/r.mjs'\nreaddirSync(haut('src/ui/x'))\n",
  }
  assert.deepEqual(sitesDansLOrdre(haut, ['scripts/t.test.mjs']), [
    ['scripts/t.test.mjs:3 readdirSync', false, ['{"chemin":"src/ui/x"}', '{"non":"cycle d\'appels haut"}']],
    ['scripts/t.test.mjs:3 haut', false, ['{"chemin":"src/ui/x"}', '{"non":"cycle d\'appels haut"}']],
  ])
  const mutuel = {
    'scripts/lib/r.mjs': ENTETE + "export function a(d) { return existsSync(d) ? d : dirname(b(d)) }\nexport function b(d) { return a(d) }\n",
    'scripts/t.test.mjs': "import { readdirSync } from 'node:fs'\nimport { a } from './lib/r.mjs'\nreaddirSync(a('src/ui/x/y/z'))\n",
  }
  assert.deepEqual(sitesDansLOrdre(mutuel, ['scripts/t.test.mjs']), [
    ['scripts/t.test.mjs:3 readdirSync', false, ['{"chemin":"src/ui/x/y/z"}', '{"non":"cycle d\'appels a, b"}']],
    ['scripts/t.test.mjs:3 a', false, ['{"chemin":"src/ui/x/y/z"}', '{"non":"cycle d\'appels a, b"}']],
  ])
})

test('CYCLE ouvert : un résultat calculé pendant un cycle ouvert ne se mémoïse pas — l’ordre des tests lus ne change rien (CAS 3)', () => {
  const modules = {
    'scripts/lib/p.mjs': ENTETE + "export function a(d) { readdirSync(d); b(d) }\nexport function b(d) { existsSync(join(d, 'x')); a(d) }\n",
    'scripts/t1.test.mjs': "import { a } from './lib/p.mjs'\na('alpha')\n",
    'scripts/t2.test.mjs': "import { b } from './lib/p.mjs'\nb('alpha')\n",
  }
  const valeurs = ['{"chemin":"alpha"}', '{"chemin":"alpha/x"}', '{"non":"cycle d\'appels a, b"}']
  const attendu = { 'scripts/t1.test.mjs:2 a': valeurs, 'scripts/t2.test.mjs:2 b': valeurs }
  for (const ordre of [['scripts/t1.test.mjs', 'scripts/t2.test.mjs'], ['scripts/t2.test.mjs', 'scripts/t1.test.mjs']]) {
    assert.deepEqual(Object.fromEntries(sitesDansLOrdre(modules, ordre).map(([s, , v]) => [s, v])), attendu, ordre.join(' puis '))
  }
})

test('une récursion qui CREUSE : aux mêmes arguments, cycle nommé dès la ré-entrée ; à d’autres arguments, après `REENTREES` (CAS 4)', () => {
  const modules = {
    'scripts/lib/q.mjs': ENTETE + "export function f(d) { readdirSync(d); return f(join(d, '..')) }\n" +
      "export function g(d) { return existsSync(d) ? d : join(g(d), 'x') }\n",
    'scripts/t.test.mjs': "import { readdirSync } from 'node:fs'\nimport { f, g } from './lib/q.mjs'\nf('src/ui/a/b')\nreaddirSync(g('src'))\n",
  }
  const [deF, deG] = sitesDansLOrdre(modules, ['scripts/t.test.mjs'])
  assert.deepEqual(deF, ['scripts/t.test.mjs:3 f', false, ['{"chemin":"src/ui/a"}', '{"chemin":"src/ui/a/b"}', '{"non":"cycle d\'appels f"}']])
  assert.deepEqual(deG, ['scripts/t.test.mjs:4 readdirSync', false, ['{"chemin":"src"}', '{"non":"cycle d\'appels g"}']])
})

test('une lecture COUPÉE (profondeur) ne tranche pas le relais : le site qui l’appelle porte la coupe nommée, jamais disparu ; non mémoïsée, le relais appelé plus haut garde ses racines, quel que soit l’ordre', () => {
  const chaine = Array.from({ length: 17 }, (_, i) => `export function f${i + 1}(d) { f${i + 2}(d) }\n`).join('')
  const modules = {
    'scripts/lib/m.mjs': "import { readdirSync } from 'node:fs'\n" + chaine + 'export function f18(d) { readdirSync(d) }\n',
    'scripts/t1.test.mjs': "import { f1 } from './lib/m.mjs'\nf1('a')\n",
    'scripts/t5.test.mjs': "import { f5 } from './lib/m.mjs'\nf5('b')\n",
  }
  for (const ordre of [['scripts/t1.test.mjs', 'scripts/t5.test.mjs'], ['scripts/t5.test.mjs', 'scripts/t1.test.mjs']]) {
    assert.deepEqual(Object.fromEntries(sitesDansLOrdre(modules, ordre).map(([s, , v]) => [s, v])), {
      'scripts/t1.test.mjs:2 f1': ['{"non":"profondeur d\'appels > 16 (f17)"}'],
      'scripts/t5.test.mjs:2 f5': ['{"chemin":"b"}'],
    }, ordre.join(' puis '))
  }
})

test('un walker AST récursif sans lecture ne constitue aucun relais', () => {
  const modules = {
    'scripts/guards/lib/analyseRetenue.mjs':
    "function rendTeinte(fn, ctx) {\n" +
    "  if (!ts.isBlock(fn.body)) return teinte(fn.body, ctx)\n" +
    "}\n" +
    "function teinte(e, ctx) {\n" +
    "  e = sansEnveloppe(e)\n" +
    "  if (ts.isCallExpression(e)) {\n" +
    "      return (DERIVATIONS.has(appele.name.text) && corpusDe(appele.expression, ctx)) || teinte(appele.expression, ctx)\n" +
    "  }\n" +
    "  if (ts.isConditionalExpression(e)) return teinte(e.whenTrue, ctx) || teinte(e.whenFalse, ctx)\n" +
    "}\n",
  }
  assert.deepEqual(sitesDansLOrdre(modules, ['scripts/guards/lib/analyseRetenue.mjs']), [])
})

// #2001
test('les cycles purs restent purs dans un module qui porte aussi un lecteur, quel que soit l’ordre', () => {
  const modules = {
    'scripts/lib/m.mjs': ENTETE + 'export function a(d) { return b(d) }\nexport function b(d) { return a(d) }\nexport function lire(d) { return readdirSync(d) }\n',
    'scripts/t.test.mjs': "import { a, b, lire } from './lib/m.mjs'\na('src')\nb('docs')\nlire('donnees')\n",
  }
  const attendu = [['scripts/t.test.mjs:4 lire', false, ['{"chemin":"donnees"}']]]
  for (const ordre of [['scripts/t.test.mjs', 'scripts/lib/m.mjs'], ['scripts/lib/m.mjs', 'scripts/t.test.mjs']])
    assert.deepEqual(sitesDansLOrdre(modules, ordre).filter(([s]) => s.startsWith('scripts/t.')), attendu)
  assert.deepEqual(evaluateurDe(modules).relaisExportes('scripts/lib/m.mjs'), ['lire'])
})

// #2001
test('un cycle pur entre modules et réexports ne constitue aucun relais', () => {
  const modules = {
    'scripts/lib/a.mjs': "import { b } from './b.mjs'\nexport function a(d) { return b(d) }\n",
    'scripts/lib/b.mjs': "import { a } from './a.mjs'\nexport function b(d) { return a(d) }\n",
    'scripts/lib/public.mjs': "export { a as marcher } from './a.mjs'\n",
    'scripts/t.test.mjs': "import { marcher as parcourir } from './lib/public.mjs'\nparcourir('src')\n",
  }
  for (const ordre of [['scripts/t.test.mjs', 'scripts/lib/a.mjs', 'scripts/lib/b.mjs'], ['scripts/lib/b.mjs', 'scripts/lib/a.mjs', 'scripts/t.test.mjs']])
    assert.deepEqual(sitesDansLOrdre(modules, ordre), [])
})

// #2001
test('un walker récursif atteignant une vraie lecture conserve sa racine et sa coupe', () => {
  const modules = {
    'scripts/lib/m.mjs': ENTETE + 'export function parcourir(d) { readdirSync(d); return parcourir(d) }\n',
    'scripts/t.test.mjs': "import { parcourir } from './lib/m.mjs'\nparcourir('src')\n",
  }
  assert.deepEqual(racinesDe(modules, 'scripts/t.test.mjs'), [[{ chemin: 'src' }, { non: "cycle d'appels parcourir" }]])
})

// #2001
test('une fonction pure récursive calculant la racine garde sa coupe au seul site de lecture', () => {
  const modules = {
    'scripts/t.test.mjs': ENTETE + "function chemin(d) { return chemin(d) }\nreaddirSync(chemin('src'))\n",
  }
  const sites = evaluateurDe(modules).sitesDe('scripts/t.test.mjs')
  assert.deepEqual(sites.map((s) => [s.appel, s.valeurs]), [['readdirSync', [{ non: "cycle d'appels chemin" }]]])
})

// #2001
test('les preuves négatives et positives mémorisées conservent leurs requêtes de dépendance', () => {
  for (const lecteur of [false, true]) {
    const modules = {
      'scripts/lib/a.mjs': "import { b } from './b.mjs'\nexport function a(d) { return b(d) }\n",
      'scripts/lib/b.mjs': ENTETE + `export function b(d) { ${lecteur ? 'return readdirSync(d)' : 'return d'} }\n`,
    }
    const evaluateur = evaluateurDe(modules)
    const premiere = evaluateur.tracer(() => evaluateur.relaisExportes('scripts/lib/a.mjs'))
    const repetee = evaluateur.tracer(() => evaluateur.relaisExportes('scripts/lib/a.mjs'))
    assert.deepEqual(premiere.resultat, lecteur ? ['a'] : [])
    assert.deepEqual(repetee.resultat, premiere.resultat)
    assert.deepEqual([...repetee.requetes].sort(), [...premiere.requetes].sort())
    for (const requete of [['lecture', 'scripts/lib/b.mjs'], ['cible', 'scripts/lib/a.mjs', './b.mjs'], ['peutLire', 'scripts/lib/b.mjs']])
      assert.ok(repetee.requetes.has(JSON.stringify(requete)), JSON.stringify(requete))
  }
})

// #2001
test('une arête importée opaque ne prouve pas la pureté d’un cycle', () => {
  const modules = {
    'scripts/lib/m.mjs': "import { inconnu } from './absent.mjs'\nexport function parcourir(d) { inconnu(d); return parcourir(d) }\n",
    'scripts/t.test.mjs': "import { parcourir } from './lib/m.mjs'\nparcourir('src')\n",
  }
  assert.deepEqual(racinesDe(modules, 'scripts/t.test.mjs'), [[{ non: "cycle d'appels parcourir" }]])
})

test('lectures de la refusion de main : `undefined` est une VALEUR NULLE, `await x` vaut `x`, un import RENOMMÉ du module de chemin se lit sous son nom exporté (recette/lib.test.mjs, ops/session.mjs)', () => {
  const texte = "import { existsSync, readFileSync } from 'node:fs'\nimport { join as joinPath } from 'node:path'\n" +
    "async function shot() { return 'captures/a.png' }\nexistsSync(joinPath('donnees', 'b.json'))\nexistsSync(await shot())\nreadFileSync(undefined)\n"
  assert.deepEqual(racinesDe({ 'scripts/t.test.mjs': texte }, 'scripts/t.test.mjs'),
    [[{ chemin: 'donnees/b.json' }], [{ chemin: 'captures/a.png' }], [{ non: 'valeur nulle' }]])
})
