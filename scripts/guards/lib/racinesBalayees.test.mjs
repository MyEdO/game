// Contrat du lecteur de RACINES BALAYÉES (#2400) : lectures de base, relais dérivés, valeurs de retour,
// et ce qu'il ne devine pas. Un dépôt EN MÉMOIRE par cas : `modules` (chemin → texte).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { posix, join } from 'node:path'
import { tmpdir } from 'node:os'
import { runInNewContext } from 'node:vm'
import { fileURLToPath } from 'node:url'
import { spawnBorne } from './processusBorne.mjs'
import { readFileSync, writeFileSync, renameSync, rmSync, mkdtempSync } from 'node:fs'
import { instanceDeDepot } from './depotGabarit.mjs'
import { parUnitesDeCode } from './lister.mjs'
import { balayagesNonResolus, perimetreDuDepot } from '../../test/perimetre.mjs'
import { analyserTexte } from './dialecte.mjs'
import { certifierLecture, evaluateurDuDepot, evaluerLotDuDepot, evaluer, lecteurDExpressions, lectureDeModule, encoderLecture, decoderLecture, mesureLecture } from './racinesBalayees.mjs'
import { clesCanoniques } from './clesCanoniques.mjs'
import { gelerLaConstante, gelerProfond } from '../../../src/lib/gelerProfond.ts'
import { tableTotale } from '../../../src/lib/tableTotale.ts'

const tableauCreux = () => Object.assign(Array(2), { 1: 1 })

/** Le lot `entree`, ses IR (`encoderLecture`) certifiées, évalué par le noyau fermé ; `stade` observe son budget. */
const evaluerLot = (entree, stade) =>
  evaluerLotDuDepot({ ...entree, lectures: entree.lectures.map(([f, pool]) => [f, certifierLecture(f, pool)]) }, stade)



const lire = (rel, text) => lectureDeModule(rel, analyserTexte({ rel, text }).sourceFile)

/** Un module lecteur : `readdirSync`, `existsSync`, `join` et `dirname` importés. */
const ENTETE = "import { readdirSync, existsSync } from 'node:fs'\nimport { join, dirname } from 'node:path'\n"

/** Les sites de `f` par les trois régimes atteignables, égaux résultats et requêtes : le noyau fermé d'un lot
 *  (`evaluerLotDuDepot`), `evaluateurDuDepot` aux clés structurelles sans mémo des booléens (`perimetreDerivation.mjs`)
 *  et à ses défauts (`evaluer`). Rend `[appel, valeurs]` par site non relais. */
const sitesDesTroisRegimes = (modules, f) => {
  const lectures = Object.fromEntries(Object.entries(modules).map(([g, texte]) => [g, lire(g, texte)]))
  const cibleDe = (g, spec) => {
    const h = posix.join(posix.dirname(g), spec)
    return spec.startsWith('.') && Object.hasOwn(modules, h) ? h : null
  }
  const resolutions = Object.entries(modules).flatMap(([g, texte]) => [...texte.matchAll(/from '([^']+)'/g)].map(([, spec]) => [g, spec, cibleDe(g, spec)]))
  const [ferme] = evaluerLot({ lectures: Object.entries(lectures).map(([g, lu]) => [g, encoderLecture(lu)]), resolutions,
    lecteurs: Object.keys(modules), questions: [{ nature: 'sitesDe', f }] })
  const attendu = { resultat: ferme.resultat, requetes: [...ferme.requetes].sort() }
  for (const acces of [{ clesStructurelles: true, memoiserBooleens: false }, {}]) {
    const ev = evaluateurDuDepot({ ...acces, lecture: (g) => Object.hasOwn(lectures, g) ? lectures[g] : null, cible: cibleDe, peutLire: (g) => Object.hasOwn(modules, g) })
    const { resultat, requetes } = ev.tracer(() => ev.sitesDe(f))
    assert.deepEqual({ resultat, requetes: [...requetes].sort() }, attendu, JSON.stringify(acces))
  }
  return ferme.resultat.filter((s) => !s.relais).map((s) => [s.appel, s.valeurs])
}

// #2586
test('pile et retours : cycles nommés, réentrées, profondeur, arguments capturés et ordre, égaux dans les trois régimes', () => {
  const pile = (corps, usage) => sitesDesTroisRegimes({ 'p.mjs': ENTETE + corps, 't.mjs': usage }, 't.mjs')
  const cycle = (noms) => ({ non: `cycle d'appels ${noms}` })
  assert.deepEqual(pile('export function direct(d) { readdirSync(d); return direct(d) }\n',
    "import { readdirSync } from 'node:fs'\nimport { direct } from './p.mjs'\nreaddirSync(direct('src'))\n"),
  [['readdirSync', [cycle('direct')]], ['direct', [{ chemin: 'src' }, cycle('direct')]]])
  const mutuel = 'export function z(d) { readdirSync(d); return a(d) }\nexport function a(d) { return z(d) }\nexport function hors(d) { return z(d) }\n'
  for (const entree of ['z', 'hors'])
    assert.deepEqual(pile(mutuel, `import { ${entree} } from './p.mjs'\n${entree}('src')\n`), [[entree, [{ chemin: 'src' }, cycle('a, z')]]], entree)
  assert.deepEqual(pile("export function f(d) { readdirSync(d); return f(join(d, 'x')) }\n", "import { f } from './p.mjs'\nf('src')\n"),
    [['f', [{ chemin: 'src' }, { chemin: 'src/x' }, cycle('f')]]])
  assert.deepEqual(pile("export function g(d, n) { readdirSync(d); return n ? x(join(d, 'b')) : y(d) }\nexport function x(d) { return g(d, false) }\nexport function y(d) { return g(d, false) }\n",
    "import { g } from './p.mjs'\ng('a', true)\n"), [['g', [{ chemin: 'a' }, { chemin: 'a/b' }, cycle('g, x'), cycle('g, y'), cycle('g, x, y')]]])
  const anneau = Array.from({ length: 16 }, (_, i) => `export function c${i}(d) { readdirSync(d); return c${(i + 1) % 16}(d) }\n`).join('')
  assert.deepEqual(pile(anneau, "import { c0 } from './p.mjs'\nc0('src')\n"),
    [['c0', [{ chemin: 'src' }, cycle(Array.from({ length: 16 }, (_, i) => 'c' + i).sort().join(', '))]]])
  const chaine = Array.from({ length: 17 }, (_, i) => `export function n${i}(d) { return n${i + 1}(d) }\n`).join('') + 'export function n17(d) { readdirSync(d) }\n'
  assert.deepEqual(pile(chaine, "import { n0 } from './p.mjs'\nn0('src')\n"), [['n0', [{ non: "profondeur d'appels > 16 (n16)" }]]])
  const profond = Array.from({ length: 15 }, (_, i) => `export function m${i}(d) { return ${i === 14 ? 'feuille' : 'm' + (i + 1)}(d) }\n`).join('') +
    'export function feuille(d) { return id(d) }\nexport function id(x) { return x }\n'
  assert.deepEqual(pile(profond, "import { readdirSync } from 'node:fs'\nimport { feuille, m0 } from './p.mjs'\nreaddirSync(feuille('src'))\nreaddirSync(m0('src'))\n"),
    [['readdirSync', [{ chemin: 'src' }]], ['readdirSync', [{ non: "profondeur d'appels > 16 (id)" }]]])
  assert.deepEqual(pile('export function id(x) { return x }\nexport function parent(d) { readdirSync(id(d)); readdirSync(id(d)) }\n',
    "import { readdirSync } from 'node:fs'\nimport { id, parent } from './p.mjs'\nreaddirSync(id('src'))\nparent('docs')\nparent('docs')\nreaddirSync(id('src'))\n"),
  [['readdirSync', [{ chemin: 'src' }]], ['parent', [{ chemin: 'docs' }]], ['parent', [{ chemin: 'docs' }]], ['readdirSync', [{ chemin: 'src' }]]])
  assert.deepEqual(pile("export function fab(base) { return (n) => join(base, n) }\nexport function premier(a, b) { return a }\nexport function r(d) { return r(d) }\n",
    "import { readdirSync } from 'node:fs'\nimport { fab, premier, r } from './p.mjs'\nconst a = fab('src')\nconst b = fab('docs')\nreaddirSync(a('x'))\nreaddirSync(b('x'))\n" +
    "readdirSync(premier('src', 'docs'))\nreaddirSync(premier('docs', 'src'))\nreaddirSync(r('src'))\nreaddirSync(r('src'))\n"),
  [['readdirSync', [{ chemin: 'src/x' }]], ['readdirSync', [{ chemin: 'docs/x' }]], ['readdirSync', [{ chemin: 'src' }]],
    ['readdirSync', [{ chemin: 'docs' }]], ['readdirSync', [cycle('r')]], ['readdirSync', [cycle('r')]]])
})

// #2586
test('pile : une lecture qui lève sous un appel remonte, et l’évaluateur reste utilisable aux mêmes appels', () => {
  const modules = { 'p.mjs': "import { b } from './q.mjs'\nexport function a(d) { return b(d) }\n", 'q.mjs': 'export function b(d) { return d }\n',
    't.mjs': "import { readdirSync } from 'node:fs'\nimport { a } from './p.mjs'\nreaddirSync(a('src'))\n" }
  const lectures = Object.fromEntries(Object.entries(modules).map(([g, texte]) => [g, lire(g, texte)]))
  for (const acces of [{ clesStructurelles: true, memoiserBooleens: false }, {}]) {
    let lever = true
    const ev = evaluateurDuDepot({ ...acces, cible: (g, spec) => posix.join(posix.dirname(g), spec), lecture: (g) => {
      if (g === 'q.mjs' && lever) { lever = false; throw new Error('attendue') }
      return lectures[g] ?? null
    } })
    assert.throws(() => ev.sitesDe('t.mjs'), /attendue/)
    assert.deepEqual(ev.sitesDe('t.mjs').map((s) => s.valeurs), [[{ chemin: 'src' }]], JSON.stringify(acces))
  }
})

test('IR compacte : projection JSON, postordre, partage structurel et borne développée', () => {
  const brut = { b: [{ x: 'é\n' }, { x: 'é\n' }], a: undefined, n: [undefined, NaN, -0], z: null }
  Object.defineProperty(brut, '__proto__', { value: { propre: true }, enumerable: true })
  const pool = encoderLecture(brut)
  assert.equal(typeof pool, 'string')
  const lu = decoderLecture(JSON.parse(JSON.stringify(pool)))
  assert.equal(JSON.stringify(lu), JSON.stringify(brut))
  assert.deepEqual(Object.keys(lu), Object.keys(JSON.parse(JSON.stringify(brut))))
  assert.equal(lu.b[0], lu.b[1])
  assert.equal(Object.getPrototypeOf(lu), Object.prototype)
  assert.equal(Object.hasOwn(lu, '__proto__'), true)
  assert.equal(mesureLecture(pool), Buffer.byteLength(JSON.stringify(brut)))
  const taille = Buffer.byteLength(pool)
  assert.equal(mesureLecture(pool, taille), Buffer.byteLength(JSON.stringify(brut)))
  assert.throws(() => mesureLecture(pool, taille - 1), /IR_POOL_HORS_BORNE/)
  assert.throws(() => decoderLecture(pool, taille - 1), /IR_POOL_HORS_BORNE/)
  let dag = { k: 'lit', v: 'src' }
  for (let i = 0; i < 26; i++) dag = [dag, dag]
  const compact = encoderLecture(dag)
  assert.ok(JSON.stringify(compact).length < 2000)
  assert.equal(mesureLecture(compact), 64 * 1024 * 1024 + 1)
  assert.throws(() => decoderLecture(compact), /IR_JSON_DEVELOPPE_HORS_BORNE/)
  const faux = (pool, racine = pool.length - 1) => JSON.stringify({ format: 'lecture-ir-1', pool, racine })
  for (const ref of [-1, 1, 2, 0.5, null]) assert.throws(() => decoderLecture(faux([[1, [ref]]], 0)), /IR_REFERENCE_INVALIDE/)
  for (const valeur of [{}, JSON.parse(pool), null, 1]) {
    assert.throws(() => decoderLecture(valeur), /IR_TEXTE_ATTENDU/)
    assert.throws(() => mesureLecture(valeur), /IR_TEXTE_ATTENDU/)
  }
  assert.throws(() => decoderLecture('{'), /IR_JSON_INVALIDE/)
  assert.throws(() => mesureLecture('{'), /IR_JSON_INVALIDE/)
  assert.throws(() => decoderLecture('{é', 2), /IR_POOL_HORS_BORNE/)
  assert.throws(() => mesureLecture('{é', 2), /IR_POOL_HORS_BORNE/)
  assert.throws(() => decoderLecture('{}'), /IR_FORMAT_INVALIDE/)
  assert.throws(() => decoderLecture(faux([[8, []]])), /IR_NOEUD_INVALIDE/)
  assert.throws(() => decoderLecture(faux([[0, 'x'], [2, [['x', 0], ['x', 0]]]])), /IR_PROPRIETE_INVALIDE/)
  const cycle = {}; cycle.soi = cycle
  assert.throws(() => encoderLecture(cycle), /IR_CYCLE/)
  let hooks = 0
  assert.throws(() => encoderLecture({ get x() { hooks++; return 1 } }), /IR_DOMAINE_JSON/)
  assert.throws(() => encoderLecture({ toJSON() { hooks++; return 1 } }), /IR_DOMAINE_JSON/)
  assert.equal(hooks, 0)
  for (const prototype of [Object.prototype, Array.prototype]) {
    for (const descripteur of [{ get() { hooks++; throw new Error('hook') } }, { value() { hooks++; return [] } }]) {
      const avant = Object.getOwnPropertyDescriptor(prototype, 'toJSON')
      try {
        Object.defineProperty(prototype, 'toJSON', { configurable: true, ...descripteur })
        for (const racine of [null, 1, {}, []]) assert.throws(() => encoderLecture(racine), /IR_DOMAINE_JSON/)
        assert.equal(hooks, 0)
      } finally {
        if (avant) Object.defineProperty(prototype, 'toJSON', avant)
        else delete prototype.toJSON
      }
    }
  }
})

// #2586
test('IR compacte : clés propres inertes et membre toJSON opaque auto-ingéré', () => {
  const brut = tableTotale(['__proto__', 'constructor', 'toString', 'toJSON'], (nom) => ({ k: 'lit', v: nom }))
  assert.deepEqual(Object.keys(brut), ['__proto__', 'constructor', 'toString', 'toJSON'])
  assert.equal(Object.getPrototypeOf(brut), Object.prototype)
  const lu = decoderLecture(encoderLecture(brut))
  assert.deepEqual(lu, brut)
  assert.equal(Object.getPrototypeOf(lu), Object.prototype)
  for (const nom of Object.keys(brut)) assert.equal(Object.hasOwn(lu, nom), true)
  assert.deepEqual(decoderLecture(encoderLecture({ toJSON: undefined })), {})
  const texte = "readFileSync({toJSON(){throw new Error('jamais')}, chemin:'src/a'}.chemin)"
  const { sourceFile } = analyserTexte({ rel: 'banc.mjs', text: texte })
  const lecteur = lecteurDExpressions('banc.mjs', sourceFile)
  const expression = lecteur.expr(sourceFile.statements[0].expression.arguments[0])
  assert.deepEqual(expression.de.v.toJSON, { k: 'non', raison: 'membre opaque toJSON' })
  assert.deepEqual(decoderLecture(encoderLecture(expression)), expression)
  for (const [rel, source] of [['banc.mjs', texte], ['scripts/guards/lib/racinesBalayees.test.mjs', readFileSync(fileURLToPath(import.meta.url), 'utf8')]]) {
    const lecture = lire(rel, source)
    const decodee = decoderLecture(encoderLecture(lecture))
    assert.deepEqual(decodee, lecture)
    const sites = (valeur) => evaluateurDuDepot({ lecture: () => valeur, cible: () => null }).sitesDe(rel)
    assert.deepEqual(sites(decodee), sites(lecture))
  }
  assert.equal(Object.hasOwn(Object.prototype, 'chemin'), false)
})

// #2586
test('IR compacte : frontière toJSON parcourue et omise sans effets', () => {
  let effets = 0
  const piege = () => { effets++; throw new Error('effet interdit') }
  const cycle = {}; cycle.soi = cycle
  const proxy = new Proxy({}, { get: piege, ownKeys: piege, getOwnPropertyDescriptor: piege, getPrototypeOf: piege })
  for (const valeur of [piege, proxy, Object.create({ externe: true }), cycle, 1n, Symbol('hostile')]) {
    for (const [cible, enumerable] of [[{}, true], [{}, false], [[], true], [[], false]]) {
      Object.defineProperty(cible, 'toJSON', { value: valeur, enumerable })
      assert.throws(() => encoderLecture(cible), /IR_DOMAINE_JSON|IR_CYCLE/)
      assert.equal(effets, 0)
    }
  }
  for (const valeur of [null, undefined, 1, { k: 'lit', v: 'inerte' }]) {
    for (const [cible, enumerable] of [[{}, false], [[], true], [[], false]]) {
      Object.defineProperty(cible, 'toJSON', { value: valeur, enumerable })
      assert.throws(() => encoderLecture(cible), /IR_DOMAINE_JSON/)
    }
  }
  for (const cible of [{}, []]) for (const enumerable of [true, false]) {
    Object.defineProperty(cible, 'toJSON', { configurable: true, enumerable, get: piege })
    assert.throws(() => encoderLecture(cible), /IR_DOMAINE_JSON/)
  }
  assert.equal(effets, 0)
})

test('API publique : le champ format additionnel reste sans effet', () => {
  const brut = lire('a.mjs', "readFileSync('src/a')")
  const attendu = evaluateurDuDepot({ lecture: () => brut, cible: () => null }).sitesDe('a.mjs')
  let consultations = 0
  for (const lu of [Object.defineProperty({ ...brut }, 'format', { get() { consultations++; throw new Error('format') } }),
    new Proxy(brut, { get(cible, nom, receveur) { if (nom === 'format') { consultations++; throw new Error('format') } return Reflect.get(cible, nom, receveur) } }),
    { ...brut, format: 'lecture-ir-1' }]) {
    assert.deepEqual(evaluateurDuDepot({ lecture: () => lu, cible: () => null }).sitesDe('a.mjs'), attendu)
  }
  assert.equal(consultations, 0)
})

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

// #2586
test('lectures certifiées : un décodage par certification, un noyau par lot que ses questions partagent, le reste refusé nommé', async () => {
  const stades = []
  const stade = (nom, module) => { stades.push([nom, module]) }
  let dag = { k: 'importe', spec: './x.mjs', nom: 'x' }
  for (let i = 0; i < 17; i++) dag = [dag, dag]
  const pool = encoderLecture({ sites: [], fonctions: {}, exports: {}, etoiles: [], lambdas: {}, dag })
  const a = certifierLecture('a.mjs', pool, stade)
  const illisible = certifierLecture('nul.mjs', null, stade)
  assert.equal(Object.isFrozen(illisible), true)
  assert.deepEqual(Reflect.ownKeys(illisible), [])
  assert.deepEqual(stades, [['décodage', 'a.mjs']])
  assert.equal(Object.isFrozen(a), true)
  assert.equal(Object.isFrozen(a.dag), true)
  assert.equal(a.dag[0], a.dag[1])
  const lot = (lectures) => evaluerLotDuDepot({ lectures, resolutions: [], lecteurs: [], questions: Array.from({ length: 3 }, () => ({ nature: 'sitesDe', f: 'a.mjs' })) }, stade)
  const premier = lot([['a.mjs', a]])
  assert.deepEqual(premier.map((r) => r.resultat), [[], [], []])
  premier[0].resultat.push('altéré')
  assert.deepEqual(lot([['a.mjs', a]]).map((r) => r.resultat), [[], [], []])
  assert.deepEqual(stades, [['décodage', 'a.mjs'], ['noyau', null], ['noyau', null]])
  const autreInstance = await import(new URL('./racinesBalayees.mjs?autre-instance', import.meta.url).href)
  for (const [nom, etrangere] of [['décodée gelée', gelerLaConstante(decoderLecture(pool))], ['clone', structuredClone(a)],
    ['certifiée par une autre instance', autreInstance.certifierLecture('a.mjs', pool)]])
    assert.throws(() => lot([['a.mjs', etrangere]]), /^Error: SNAPSHOT_LECTURE_NON_CERTIFIEE:a\.mjs$/, nom)
  assert.throws(() => lot([['a.mjs', a], ['b.mjs', 'texte']]), /^Error: SNAPSHOT_LECTURE_NON_CERTIFIEE:b\.mjs$/)
  assert.throws(() => certifierLecture('x.mjs', encoderLecture('x')), /SNAPSHOT_LECTURE_NON_OBJET:x\.mjs/)
})

// #2586
test('lot fermé : une lecture certifiée n’entre que sous son module, et le domaine hors lectures se refuse nommé par forme', async (t) => {
  const c = certifierLecture('c.mjs', encoderLecture(lire('c.mjs', "import {readFileSync} from 'node:fs'; readFileSync('src')")))
  const question = { nature: 'sitesDe', f: 'c.mjs' }
  const lot = (entree) => evaluerLotDuDepot({ lectures: [['c.mjs', c]], resolutions: [['c.mjs', 'node:fs', null]], lecteurs: ['c.mjs'], questions: [question], ...entree })
  const avec = (tableau, propres) => Object.assign(tableau, propres)
  const iterant = (...valeurs) => ({ * [Symbol.iterator]() { yield* valeurs } })
  const natureAlternee = (seconde) => { let lue = 0; return { get nature() { return lue++ === 0 ? 'sitesDe' : seconde }, f: 'c.mjs' } }
  await t.test('nominal', () => assert.deepEqual(lot({}).map((r) => r.resultat.map((s) => s.valeurs)), [[[{ chemin: 'src' }]]]))
  await t.test('témoin d’illisibilité lu null sous son module', () => {
    const nul = certifierLecture('nul.mjs', null)
    assert.deepEqual(lot({ lectures: [['c.mjs', c], ['nul.mjs', nul]], questions: [{ nature: 'sitesDe', f: 'nul.mjs' }] }).map((r) => r.resultat), [[]])
    const ouvert = (lecture) => { const ev = evaluateurDuDepot({ lecture, cible: () => null, clesStructurelles: true }); return ev.tracer(() => ev.sitesDe('nul.mjs')) }
    assert.deepEqual(ouvert(() => nul), ouvert(() => null))
  })
  for (const [nom, entree, erreur] of [
    ['c.mjs présentée b.mjs', () => ({ lectures: [['b.mjs', c]], questions: [{ nature: 'sitesDe', f: 'b.mjs' }] }), /^Error: SNAPSHOT_LECTURE_D_UN_AUTRE_MODULE:b\.mjs:c\.mjs$/],
    ['c.mjs aussi sous b.mjs', () => ({ lectures: [['c.mjs', c], ['b.mjs', c]] }), /^Error: SNAPSHOT_LECTURE_D_UN_AUTRE_MODULE:b\.mjs:c\.mjs$/],
    ['c.mjs présentée illisible (null)', () => ({ lectures: [['c.mjs', null]] }), /^Error: SNAPSHOT_LECTURE_NON_CERTIFIEE:c\.mjs$/],
    ['témoin d’illisibilité de nul.mjs présenté c.mjs', () => ({ lectures: [['c.mjs', certifierLecture('nul.mjs', null)]] }), /^Error: SNAPSHOT_LECTURE_D_UN_AUTRE_MODULE:c\.mjs:nul\.mjs$/],
    ['clé de lecture non chaîne', () => ({ lectures: [['c.mjs', c], [42, null]] }), /^Error: SNAPSHOT_LECTURE_MODULE_HORS_DOMAINE:1$/],
    ['D1 [c.mjs, null] avant [c.mjs, c]', () => ({ lectures: [['c.mjs', null], ['c.mjs', c]] }), /^Error: SNAPSHOT_LECTURE_NON_CERTIFIEE:c\.mjs$/],
    ['D2 [c.mjs, {}] avant [c.mjs, c]', () => ({ lectures: [['c.mjs', {}], ['c.mjs', c]] }), /^Error: SNAPSHOT_LECTURE_NON_CERTIFIEE:c\.mjs$/],
    ['D3 doublon avant une clé 42', () => ({ lectures: [['c.mjs', c], ['c.mjs', c], [42, c]] }), /^Error: SNAPSHOT_LECTURE_DUPLIQUEE:c\.mjs$/],
    ['lectures hors tableau', () => ({ lectures: new Map([['c.mjs', c]]) }), /^Error: SNAPSHOT_LECTURES_NON_TABLEAU$/],
    ['lecture à trois termes', () => ({ lectures: [['c.mjs', c, c]] }), /^Error: SNAPSHOT_LECTURE_NON_PAIRE:0$/],
    ['lecture en accesseur', () => ({ lectures: Object.defineProperty([], 0, { get: () => ['c.mjs', c], enumerable: true }) }), /^Error: SNAPSHOT_ACCESSEUR:lectures\[0\]$/],
    ['résolutions hors tableau', () => ({ resolutions: new Map() }), /^Error: SNAPSHOT_RESOLUTIONS_NON_TABLEAU$/],
    ['résolution à deux termes', () => ({ resolutions: [['c.mjs', 'node:fs']] }), /^Error: SNAPSHOT_RESOLUTION_NON_TRIPLET:0$/],
    ['résolution creuse', () => ({ resolutions: tableauCreux() }), /^Error: SNAPSHOT_RESOLUTION_NON_TRIPLET:0$/],
    ['module vide', () => ({ resolutions: [['', 'node:fs', null]] }), /^Error: SNAPSHOT_RESOLUTION_HORS_DOMAINE:0$/],
    ['spécificateur non chaîne', () => ({ resolutions: [['c.mjs', 1, null]] }), /^Error: SNAPSHOT_RESOLUTION_HORS_DOMAINE:0$/],
    ['cible non chaîne', () => ({ resolutions: [['c.mjs', 'node:fs', undefined]] }), /^Error: SNAPSHOT_RESOLUTION_HORS_DOMAINE:0$/],
    ['résolution dupliquée', () => ({ resolutions: [['c.mjs', 'node:fs', null], ['c.mjs', 'node:fs', 'fs.mjs']] }), /^Error: SNAPSHOT_RESOLUTION_DUPLIQUEE:\["c\.mjs","node:fs"\]$/],
    ['A3 résolutions à map propre', () => ({ resolutions: avec([['c.mjs', 'node:fs', null]], { map: () => [[JSON.stringify(['c.mjs', 'node:fs']), { pas: 'une chaîne' }]] }) }), /^Error: SNAPSHOT_RESOLUTIONS_NON_TABLEAU$/],
    ['résolution en accesseur', () => ({ resolutions: Object.defineProperty([], 0, { get: () => ['c.mjs', 'node:fs', null], enumerable: true }) }), /^Error: SNAPSHOT_ACCESSEUR:resolutions\[0\]$/],
    ['lecteurs hors tableau', () => ({ lecteurs: new Set(['c.mjs']) }), /^Error: SNAPSHOT_LECTEURS_NON_TABLEAU$/],
    ['lecteur non chaîne', () => ({ lecteurs: ['c.mjs', null] }), /^Error: SNAPSHOT_LECTEUR_HORS_DOMAINE:1$/],
    ['lecteur dupliqué', () => ({ lecteurs: ['c.mjs', 'c.mjs'] }), /^Error: SNAPSHOT_LECTEUR_DUPLIQUE:c\.mjs$/],
    ['A4 lecteurs à itérateur propre', () => ({ lecteurs: avec(['c.mjs'], { [Symbol.iterator]: iterant(42, 'c.mjs')[Symbol.iterator] }) }), /^Error: SNAPSHOT_LECTEURS_NON_TABLEAU$/],
    ['questions hors tableau', () => ({ questions: question }), /^Error: SNAPSHOT_QUESTIONS_NON_TABLEAU$/],
    ['A1 questions à itérateur propre', () => ({ questions: avec([question], { [Symbol.iterator]: iterant({ nature: 'tracer', f: 'c.mjs' })[Symbol.iterator] }) }), /^Error: SNAPSHOT_QUESTIONS_NON_TABLEAU$/],
    ['question nulle', () => ({ questions: [question, null] }), /^Error: SNAPSHOT_QUESTION_NON_OBJET:1$/],
    ['question en tableau', () => ({ questions: [['sitesDe', 'c.mjs']] }), /^Error: SNAPSHOT_QUESTION_NON_OBJET:0$/],
    ['question à clé de plus', () => ({ questions: [{ ...question, index: 0 }] }), /^Error: SNAPSHOT_QUESTION_CLES:0$/],
    ['question sans f', () => ({ questions: [{ nature: 'sitesDe' }] }), /^Error: SNAPSHOT_QUESTION_CLES:0$/],
    ['A5 question à clé symbole', () => ({ questions: [{ ...question, [Symbol('x')]: 1 }] }), /^Error: SNAPSHOT_QUESTION_CLES:0$/],
    ['nature inconnue', () => ({ questions: [question, { nature: 'siteDe', f: 'c.mjs' }] }), /^Error: SNAPSHOT_NATURE_INVALIDE:siteDe$/],
    ['nature 42', () => ({ questions: [{ nature: 42, f: 'c.mjs' }] }), /^Error: SNAPSHOT_NATURE_INVALIDE:42$/],
    ['A2 nature en accesseur', () => ({ questions: [natureAlternee('siteDe')] }), /^Error: SNAPSHOT_ACCESSEUR:questions\[0\]\.nature$/],
    ['nature hasOwnProperty en accesseur', () => ({ questions: [natureAlternee('hasOwnProperty')] }), /^Error: SNAPSHOT_ACCESSEUR:questions\[0\]\.nature$/],
    ['nature hasOwnProperty par itérateur propre', () => ({ questions: avec([question], { [Symbol.iterator]: iterant({ nature: 'hasOwnProperty', f: 'sitesDe' })[Symbol.iterator] }) }), /^Error: SNAPSHOT_QUESTIONS_NON_TABLEAU$/],
    ['f non chaîne', () => ({ questions: [{ nature: 'sitesDe', f: ['c.mjs'] }] }), /^Error: SNAPSHOT_QUESTION_F_HORS_DOMAINE:0$/],
  ]) await t.test(nom, () => assert.throws(() => lot(entree()), erreur))
  const pool = encoderLecture(lire('c.mjs', "import {readFileSync} from 'node:fs'; readFileSync('src')"))
  for (const [nom, module] of [['Symbol', Symbol('c.mjs')], ['nombre', 42], ['chaîne vide', '']])
    await t.test(`module de certifierLecture non chaîne (${nom})`, () => {
      for (const ir of [pool, null]) assert.throws(() => certifierLecture(module, ir), /^Error: SNAPSHOT_CERTIFICATION_MODULE_HORS_DOMAINE$/)
    })
})

// #2586
test('lot fermé : chaque question d’un lot rend le résultat de la question seule et au moins ses requêtes, sous-graphe partagé compris', () => {
  const sources = {
    'a.mjs': "import {base,f,boucle,lire} from './b.mjs'; import {autre} from './c.mjs'; readFileSync(base); readFileSync(f('x')); readFileSync(f('x')); readFileSync(autre); opaque(); readFileSync(null); ['src/a'].forEach(x=>readFileSync(x)); readFileSync(f()); readFileSync(boucle('src')); lire('docs/relais'); lire('docs/relais')",
    'b.mjs': "export const base='src'; export function f(x='d',...reste){return base+'/'+x} export function boucle(x){return boucle(x)} export function lire(x){readFileSync(x)}",
    'c.mjs': "export {fin as autre} from './d.mjs'",
    'd.mjs': "export const fin='docs/fin'",
    'e.mjs': "import {f,boucle,lire} from './b.mjs'; readFileSync(f('x')); readFileSync(boucle('docs')); lire('docs/relais'); lire('src/autre')",
    'vide.mjs': '', 'nul.mjs': null,
    'p.mjs': "import {racine} from './q.mjs'; readFileSync(racine())",
    'r.mjs': "import {racine} from './q.mjs'; readFileSync(racine())",
    'q.mjs': "import {base} from './s.mjs'; export function racine(){return base+'/partage'}",
    's.mjs': "export const base='src'",
  }
  const lectures = new Map(Object.entries(sources).map(([f, texte]) => [f, texte === null ? null : lire(f, texte)]))
  const resolutions = [['a.mjs', './b.mjs', 'b.mjs'], ['a.mjs', './c.mjs', 'c.mjs'], ['c.mjs', './d.mjs', 'd.mjs'], ['e.mjs', './b.mjs', 'b.mjs'],
    ['p.mjs', './q.mjs', 'q.mjs'], ['r.mjs', './q.mjs', 'q.mjs'], ['q.mjs', './s.mjs', 's.mjs']]
  const entree = { lectures: [...lectures].map(([f, lu]) => [f, certifierLecture(f, lu === null ? null : encoderLecture(lu))]), resolutions, lecteurs: [...lectures.keys()] }
  const questions = [{ nature: 'sitesDe', f: 'a.mjs' }, { nature: 'sitesDe', f: 'vide.mjs' }, { nature: 'sitesDe', f: 'nul.mjs' }, { nature: 'relaisExportes', f: 'b.mjs' },
    { nature: 'sitesDe', f: 'e.mjs' }, { nature: 'sitesDe', f: 'a.mjs' }, { nature: 'relaisExportes', f: 'a.mjs' }, { nature: 'relaisExportes', f: 'e.mjs' },
    { nature: 'sitesDe', f: 'p.mjs' }, { nature: 'sitesDe', f: 'r.mjs' }]
  const seule = (question) => evaluerLotDuDepot({ ...entree, questions: [question] })[0]
  const attendu = questions.map(seule)
  assert.ok(attendu[0].resultat.length > 1 && attendu[4].resultat.length > 1)
  for (const i of [8, 9]) {
    assert.deepEqual(attendu[i].resultat.filter((s) => !s.relais).map((s) => s.valeurs), [[{ chemin: 'src/partage' }]])
    for (const requete of [['lecture', 's.mjs'], ['cible', 'q.mjs', './s.mjs']]) assert.ok(attendu[i].requetes.includes(JSON.stringify(requete)), JSON.stringify(requete))
  }
  const couvre = (rendu, seul, contexte) => {
    assert.deepEqual({ nature: rendu.nature, f: rendu.f, resultat: rendu.resultat }, { nature: seul.nature, f: seul.f, resultat: seul.resultat }, contexte)
    const duLot = new Set(rendu.requetes)
    assert.deepEqual(seul.requetes.filter((r) => !duLot.has(r)), [], `requêtes perdues : ${contexte}`)
  }
  for (const ordre of [questions.map((_, i) => i), questions.map((_, i) => questions.length - 1 - i), [4, 0, 7, 3, 9, 5, 6, 1, 2, 8]]) {
    const rendus = evaluerLotDuDepot({ ...entree, questions: ordre.map((i) => questions[i]) })
    assert.equal(rendus.length, ordre.length)
    ordre.forEach((i, k) => couvre(rendus[k], attendu[i], `${JSON.stringify(ordre)} ${questions[i].nature}:${questions[i].f}`))
  }
  const augmente = structuredClone(lectures.get('a.mjs'))
  augmente.sites.push(structuredClone(augmente.sites[1]))
  const [renduPlusUn] = evaluerLotDuDepot({ ...entree, lectures: entree.lectures.map(([f, lu]) => [f, f === 'a.mjs' ? certifierLecture(f, encoderLecture(augmente)) : lu]), questions: [questions[0]] })
  couvre({ ...renduPlusUn, resultat: renduPlusUn.resultat.slice(0, -1) }, attendu[0], 'site dupliqué')
  assert.deepEqual(renduPlusUn.resultat.at(-1), attendu[0].resultat[1])
  assert.throws(() => evaluerLotDuDepot({ ...entree, questions: [{ nature: 'sitesDe', f: 'absent.mjs' }] }), /QUESTION_DU_LOT:sitesDe:absent.mjs:SNAPSHOT_QUESTION_ABSENTE:lecture/)
})

test('lot fermé : résultats et requêtes, imports transitifs, étoiles, options, captures et récursions', () => {
  const sources = {
    'a.mjs': "import {readFileSync,readdirSync} from 'node:fs'; import {choisir,base,boucle} from './b.mjs'; import {absent} from './absent.mjs'; const f=(x='a',...suite)=>base+'/'+x; if(choisir(true)) readFileSync(f()); if(choisir(false)) readFileSync(f('b')); readdirSync('src',{withFileTypes:true}).map(x=>readFileSync('src/'+x.name)); readFileSync(absent); readFileSync(boucle('src'))",
    'b.mjs': "export * from './c.mjs'; export * from './vide.mjs'",
    'c.mjs': "export function choisir(x){return x} export const base='src'; export function boucle(x){return boucle(x)}",
    'vide.mjs': 'export const autre=1',
    'absent.mjs': null,
  }
  const lectures = Object.entries(sources).map(([f, t]) => [f, t === null ? null : lire(f, t)])
  const resolutions = []
  for (const [f, lu] of lectures) {
    const specs = new Set(lu?.etoiles ?? [])
    const visiter = (v) => {
      if (!v || typeof v !== 'object') return
      if (v.k === 'importe') specs.add(v.spec)
      for (const e of Object.values(v)) visiter(e)
    }
    visiter(lu)
    for (const spec of specs) resolutions.push([f, spec, spec.startsWith('.') ? posix.join(posix.dirname(f), spec) : null])
  }
  for (const lecteurs of [Object.keys(sources), ['a.mjs'], []]) {
    const questions = Object.keys(sources).flatMap((f) => ['sitesDe', 'relaisExportes'].map((nature) => ({ nature, f })))
    const entree = { lectures: lectures.map(([f, lu]) => [f, lu === null ? null : encoderLecture(lu)]), resolutions, lecteurs, questions }
    const attendu = questions.map(({ nature, f }) => {
      const ev = evaluateurDuDepot({ lecture: (g) => new Map(lectures).get(g) ?? null,
        cible: (g, s) => resolutions.find(([h, spec]) => h === g && spec === s)?.[2] ?? null,
        peutLire: (g) => lecteurs.includes(g), clesStructurelles: true })
      const { resultat, requetes } = ev.tracer(() => ev[nature](f))
      return { nature, f, resultat, requetes: [...requetes].sort() }
    })
    const certifiee = { ...entree, lectures: entree.lectures.map(([f, pool]) => [f, certifierLecture(f, pool)]) }
    const resultat = evaluerLotDuDepot(certifiee)
    assert.deepEqual(resultat.map((r) => ({ ...r, requetes: r.requetes.sort() })), attendu)
    assert.match(JSON.stringify(resultat), /cycle d'appels/)
    resultat[0].resultat.length = 0
    resultat[0].requetes.length = 0
    assert.deepEqual(evaluerLotDuDepot(certifiee).map((r) => ({ ...r, requetes: r.requetes.sort() })), attendu)
  }
  const incomplet = { lectures: [['a.mjs', encoderLecture(lire('a.mjs', "import {x} from './b.mjs'; readFileSync(x)"))]], resolutions: [], lecteurs: ['a.mjs'], questions: [{ nature: 'sitesDe', f: 'a.mjs' }] }
  assert.throws(() => evaluerLot(incomplet), /QUESTION_DU_LOT:sitesDe:a.mjs:SNAPSHOT_QUESTION_ABSENTE:cible/)
  incomplet.resolutions.push(['a.mjs', './b.mjs', 'b.mjs'])
  assert.throws(() => evaluerLot(incomplet), /SNAPSHOT_QUESTION_ABSENTE:lecture:b.mjs/)
  incomplet.lectures.push(['b.mjs', null])
  assert.doesNotThrow(() => evaluerLot(incomplet))
  const forge = decoderLecture(incomplet.lectures[0][1])
  forge.exports.forge = { k: 'lie', de: { k: 'lit', v: 'src' }, ctx: { f: 'exterieur.mjs' } }
  assert.throws(() => certifierLecture('a.mjs', encoderLecture(forge)), /SNAPSHOT_IR_NON_PRODUCTEUR:a\.mjs/)
  gelerLaConstante(forge)
  assert.throws(() => evaluerLotDuDepot({ ...incomplet, lectures: [['a.mjs', forge], ['b.mjs', null]] }), /^Error: SNAPSHOT_LECTURE_NON_CERTIFIEE:a\.mjs$/)
})

test('clés privées : partitions, références locales numériques, trois rôles, DAG et association avant clé', () => {
  const c = clesCanoniques({ ferme: true, clesStructurelles: true })
  const vide = []
  assert.deepEqual(c.uniques(vide), [])
  assert.notEqual(c.uniques(vide), vide)
  assert.notEqual(c.uniques(vide), c.uniques(vide))
  const feuille = { texte: 'src/partage' }
  const composite = { gauche: [feuille], droite: [feuille] }
  const singleton = [composite]
  const seul = c.uniques(singleton)
  assert.equal(seul.length, 1)
  assert.equal(seul[0], composite)
  assert.notEqual(seul, singleton)
  assert.notEqual(seul, c.uniques(singleton))
  assert.doesNotThrow(() => c.formesDesArguments.set(composite, {}))
  assert.doesNotThrow(() => c.formesDesArguments.set(feuille, {}))
  const premier = { objet: { a: [{ texte: 'src/a' }] } }
  const dernier = { objet: { a: [{ texte: 'src/a' }] } }
  const autre = { objet: { a: [{ texte: 'src/b' }] } }
  const plusieurs = c.uniques([premier, autre, dernier])
  assert.equal(plusieurs.length, 2)
  assert.equal(plusieurs[0], dernier)
  assert.equal(plusieurs[1], autre)
  const sentinelle = new Error('singleton-ouvert-sentinelle')
  const piege = { objet: { get enfant() { throw sentinelle } } }
  const ouvert = clesCanoniques({ ferme: false, clesStructurelles: false })
  assert.throws(() => ouvert.uniques([piege]), (erreur) => erreur === sentinelle)
  const cle = (v, options) => c.cleCanonique(({ referenceDe }) => referenceDe(v), v, null, options)
  const partage = { x: 'a' }
  for (const strict of [true, false, true]) for (const formesCompletes of [true, false, true]) {
    const options = { strict, formesCompletes, cellules: true }
    assert.equal(cle([partage, partage], options), cle([{ x: 'a' }, { x: 'a' }], options))
    assert.notEqual(cle([partage], options), cle([{ x: 'b' }], options))
  }
  const options = { strict: true, cellules: false }
  assert.equal(cle([partage], options), cle([{ x: 'a' }], options))
  assert.equal(cle([{ avant: 1 }, partage], options), cle([{ avant: 1 }, { x: 'a' }], options))
  const args = [[{ texte: 'src' }]]
  const groupe = c.cleDesArgs(args)
  assert.notEqual(cle(args, { strict: true, cellules: true, formesCompletes: false }), groupe)
  assert.equal(c.cleDesArgs([[{ texte: 'src' }]]), groupe)
  assert.equal(c.cleDesArgs([args]), c.cleDesArgs([[[{ texte: 'src' }]]]))
  const avecForme = [{ texte: 'src' }]
  c.formesDesArguments.set(avecForme, { e: { k: 'lit', v: 'src' }, ctx: { f: 'a.mjs', env: null } })
  const complet = cle(avecForme, { strict: true, cellules: true, formesCompletes: true })
  const projete = cle(avecForme, { strict: true, cellules: true, formesCompletes: false })
  assert.notEqual(complet, projete)
  assert.equal(cle(avecForme, { strict: true, cellules: true, formesCompletes: true }), complet)
  assert.equal(cle(avecForme, { strict: true, cellules: true, formesCompletes: false }), projete)
  const tardif = []
  cle(tardif, { strict: true, cellules: true })
  assert.throws(() => c.formesDesArguments.set(tardif, {}), /FORME_PRIVEE_ASSOCIEE_APRES_CLE/)
  const argumentTardif = [{ texte: 'src/tardif' }]
  const groupeTardif = [argumentTardif]
  c.cleDesArgs(groupeTardif)
  assert.throws(() => c.formesDesArguments.set(argumentTardif, {}), /FORME_PRIVEE_ASSOCIEE_APRES_CLE/)
  assert.throws(() => c.formesDesArguments.set(groupeTardif, {}), /FORME_PRIVEE_ASSOCIEE_APRES_CLE/)
  const cycle = {}; cycle.soi = cycle
  assert.throws(() => cle(cycle, { strict: true, cellules: true }), /DAG_PRIVE_CYCLIQUE/)
  const sources = { 'a.mjs': "import {scanner} from './b.mjs'; scanner('src')",
    'b.mjs': "import {readFileSync} from 'node:fs'; export function scanner(p){return readFileSync(p)}" }
  const question = { nature: 'sitesDe', f: 'a.mjs' }
  const [froid, chaud] = evaluerLot({ lectures: Object.entries(sources).map(([f, texte]) => [f, encoderLecture(lire(f, texte))]),
    resolutions: [['a.mjs', './b.mjs', 'b.mjs']], lecteurs: Object.keys(sources), questions: [question, question] })
  assert.deepEqual(froid.resultat.map((s) => s.valeurs), [[{ chemin: 'src' }]])
  assert.ok(froid.requetes.includes('["lecture","b.mjs"]'))
  assert.deepEqual({ ...chaud, requetes: [...chaud.requetes].sort() }, { ...froid, requetes: [...froid.requetes].sort() })
})

test('construction privée : publication après descripteur et unique association dans argumentDe', () => {
  const lireModule = (nom) => readFileSync(fileURLToPath(new URL(nom, import.meta.url)), 'utf8')
  const source = lireModule('./racinesBalayees.mjs')
  const cles = lireModule('./clesCanoniques.mjs')
  const debut = cles.indexOf('      pile.set(v, pile.size)')
  const reference = cles.slice(debut, cles.indexOf('      return reference\n', debut))
  assert.match(reference, /const descriptor =[^]*?const reference = interner\(descriptor\)\s+references.set\(v, reference\)/)
  assert.equal(reference.slice(0, reference.indexOf('const reference = interner')).includes('references.set('), false)
  assert.doesNotMatch(cles, /references\.set\(v,[^\r\n]*\)\s+pile\.set\(v, pile\.size\)/)
  assert.equal((cles + source).split('formesDesArguments.set(').length, 2)
  assert.match(source, /const argumentDe = \(e, ctx\) => \{\s+const vs = valeurs\(e, ctx\).map\([^]*?formesDesArguments.set\(vs,[^]*?\n {4}return vs/)
})

test('politique BOOL : IR sérialisé gelé, captures, défauts, rest et cycles gardent résultats et dépendances', () => {
  const sources = {
    'a.mjs': "import {readFileSync} from 'node:fs'; import {choisir} from './b.mjs'; const base='src'; const f=(x='a',...suite)=>base+'/'+x; if(choisir(true)) readFileSync(f()); if(choisir(false)) readFileSync(f('b')); readFileSync(f('c',1))",
    'b.mjs': 'export function choisir(x) { return x } export const cycle=cycle',
  }
  const ir = Object.fromEntries(Object.entries(sources).map(([f, t]) => {
    const lu = JSON.parse(JSON.stringify(lire(f, t)))
    gelerProfond(lu)
    return [f, lu]
  }))
  const rendus = []
  for (const memoiserBooleens of [true, false]) {
    const ev = evaluateurDuDepot({ clesStructurelles: true, memoiserBooleens, lecture: (f) => ir[f] ?? null,
      cible: (f, spec) => posix.join(posix.dirname(f), spec), peutLire: () => true })
    assert.deepEqual(ev.valeurs({ k: 'garde', condition: { k: 'booleen', v: false }, attendu: true,
      de: { k: 'lit', v: 'src/interdit' } }, { f: 'a.mjs', env: null }), [])
    assert.ok(ev.valeurs({ k: 'importe', spec: './b.mjs', nom: 'cycle' }, { f: 'a.mjs', env: null }).every((v) => 'non' in v))
    const vues = new Map()
    for (const f of ['a.mjs', 'b.mjs', 'b.mjs', 'a.mjs']) {
      const { resultat, requetes } = ev.tracer(() => ev.sitesDe(f))
      if (vues.has(f)) assert.deepEqual(resultat, vues.get(f).resultat)
      vues.set(f, { resultat, requetes: [...requetes].sort() })
    }
    rendus.push([...vues])
  }
  assert.deepEqual(...rendus)
  assert.ok(rendus[0][0][1].resultat.length > 0)
})

// #2586
test('politique BOOL du driver : branches, captures ultimes et dépendances transitives', () => {
  const sources = {
    'a.mjs': "import {choisir,liste,fabrique,boucle} from './b.mjs'; readFileSync(choisir()); readFileSync(choisir(true)); readFileSync(choisir(inconnu())); readFileSync(liste(true,'docs/rest').map(String)); const oui=fabrique(true); const non=fabrique(false); readFileSync(oui()); readFileSync(non()); readFileSync(boucle(false))",
    'b.mjs': "export * from './c.mjs'",
    'c.mjs': "import {positif,negatif} from './d.mjs'; export function choisir(flag=false){if(flag)return positif;return negatif}; export function liste(flag=false,...xs){if(flag)return xs;return ['src/defaut']}; export function fabrique(flag){return (nom='a')=>flag?'docs/capture':'src/capture'}; export function boucle(flag){return boucle(!flag)}",
    'd.mjs': "export const positif='docs/vrai';export const negatif='src/faux'",
  }
  const lectures = new Map(Object.entries(sources).map(([f, texte]) => [f, lire(f, texte)]))
  const resolutions = [['a.mjs', './b.mjs', 'b.mjs'], ['b.mjs', './c.mjs', 'c.mjs'], ['c.mjs', './d.mjs', 'd.mjs']]
  const acces = { lecture: (f) => lectures.get(f) ?? null, cible: (f, spec) => resolutions.find(([g, s]) => f === g && spec === s)?.[2] ?? null,
    peutLire: (f) => lectures.has(f), clesStructurelles: true }
  const questions = [{ nature: 'sitesDe', f: 'a.mjs' }]
  const entree = { lectures: [...lectures].map(([f, lu]) => [f, encoderLecture(lu)]), resolutions, lecteurs: [...lectures.keys()], questions }
  const [ferme] = evaluerLot(entree)
  const ev = evaluateurDuDepot(acces)
  const publicVu = ev.tracer(() => ev.sitesDe('a.mjs'))
  assert.deepEqual(ferme.resultat, publicVu.resultat)
  assert.deepEqual([...ferme.requetes].sort(), [...publicVu.requetes].sort())
  const racines = ferme.resultat.filter((s) => !s.relais).map((s) => s.valeurs)
  assert.deepEqual(racines.slice(0, 6), [[{ chemin: 'src/faux' }], [{ chemin: 'docs/vrai' }],
    [{ chemin: 'docs/vrai' }, { chemin: 'src/faux' }], [{ chemin: 'docs/rest' }],
    [{ chemin: 'docs/capture' }], [{ chemin: 'src/capture' }]])
  assert.match(JSON.stringify(racines.at(-1)), /cycle d'appels/)
  for (const f of ['b.mjs', 'c.mjs', 'd.mjs']) assert.ok(ferme.requetes.includes(JSON.stringify(['lecture', f])), f)
  for (const nom of ['positif', 'negatif']) {
    const variante = { ...entree, lectures: entree.lectures.map(([f, pool]) => [f, f === 'd.mjs'
      ? encoderLecture(lire(f, sources[f].replace(nom === 'positif' ? 'docs/vrai' : 'src/faux', 'docs/neuf'))) : pool]) }
    const [rendu] = evaluerLot(variante)
    assert.ok(rendu.resultat.some((s) => s.valeurs.some((v) => v.chemin === 'docs/neuf')), nom)
    assert.notDeepEqual(rendu.resultat, ferme.resultat)
  }
})

// #2586
test('politique BOOL du driver : un prédicat par garde d’une condition partagée, un calcul de retour par fonction et par lot', () => {
  const lu = lire('a.mjs', "import {base} from './c.mjs'; readFileSync('src'); readFileSync(base()); readFileSync(base())")
  const condition = { k: 'importe', spec: './b.mjs', nom: 'oui' }
  lu.sites[0].args[0] = { k: 'union', v: Array.from({ length: 16 }, (_, i) => ({ k: 'garde', condition,
    attendu: true, de: { k: 'lit', v: `src/${i}` } })) }
  const entree = { lectures: [['a.mjs', encoderLecture(lu)], ['b.mjs', encoderLecture(lire('b.mjs', 'export const oui=true'))],
    ['c.mjs', encoderLecture(lire('c.mjs', "export function base(){return 'docs'}"))]],
  resolutions: [['a.mjs', './b.mjs', 'b.mjs'], ['a.mjs', './c.mjs', 'c.mjs']], lecteurs: ['a.mjs', 'b.mjs', 'c.mjs'], questions: [{ nature: 'sitesDe', f: 'a.mjs' }] }
  const stades = []
  const [rendu] = evaluerLot(entree, (nom, module) => { stades.push([nom, module]) })
  assert.deepEqual(rendu.resultat.map((s) => s.valeurs), [Array.from({ length: 16 }, (_, i) => ({ chemin: `src/${i}` })), [{ chemin: 'docs' }], [{ chemin: 'docs' }]])
  assert.ok(rendu.requetes.includes(JSON.stringify(['lecture', 'b.mjs'])))
  assert.deepEqual(stades, [['noyau', null], ...Array.from({ length: 16 }, () => ['prédicat', 'a.mjs']), ['retour', 'c.mjs']])
})

// #2586
test('clés P : texte des clés structurelles égal à la clé textuelle, restitution, formes, coupes et références opaques', () => {
  const textuel = clesCanoniques({ ferme: false, clesStructurelles: false })
  const structurel = clesCanoniques({ ferme: false, clesStructurelles: true })
  const textes = new Map()
  const cellules = new Map()
  const verifier = (v, args = false) => {
    const avant = args ? textuel.cleDesArgs(v) : textuel.cleDe(v)
    const apres = args ? structurel.cleDesArgs(v) : structurel.cleDe(v)
    assert.equal(structurel.texteDeCle(apres), avant)
    if (textes.has(avant)) assert.equal(apres, textes.get(avant))
    if (cellules.has(apres)) assert.equal(avant, cellules.get(apres))
    textes.set(avant, apres)
    cellules.set(apres, avant)
    return apres
  }
  for (const v of [{ texte: 'a' }, { scalaire: '1' }, { booleen: false }, { non: 'a' }, { fragment: { texte: 'a' } }]) verifier(v)
  let seed = 2586
  const nombre = (n) => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed % n }
  for (let i = 0; i < 2000; i++) {
    const objets = Array.from({ length: 1 + nombre(6) }, () => nombre(2) ? {} : [])
    for (const objet of objets) for (let j = 0, n = nombre(4); j < n; j++) {
      const v = nombre(3) ? objets[nombre(objets.length)] : nombre(7)
      if (Array.isArray(objet)) objet.push(v)
      else objet[`champ${j}`] = v
    }
    verifier({ objet: objets[0], ctx: { f: 'banc.mjs', env: null } })
  }
  const forme = (as, e, ctx) => {
    textuel.formesDesArguments.set(as, { e, ctx })
    structurel.formesDesArguments.set(as, { e, ctx })
  }
  const a = [{ texte: 'src/a' }]
  const args = [a]
  const e = { k: 'lit', v: 'src/a' }
  const ctx = { f: 'banc.mjs', env: { fn: 'f', args } }
  forme(a, e, ctx)
  verifier({ poignee: a })
  const cyclique = verifier(args, true)
  assert.equal(verifier(args, true), cyclique)
  const b = [{ texte: 'src/a' }]
  const autres = [b]
  forme(b, { k: 'lit', v: 'src/a' }, { f: 'banc.mjs', env: { fn: 'f', args: autres } })
  assert.equal(verifier(autres, true), cyclique)
  e.v = 'src/b'
  assert.notEqual(verifier(args, true), cyclique)
  e.v = 'src/a'
  assert.equal(verifier(args, true), cyclique)
  forme(a, { k: 'lit', v: 'src/c' }, ctx)
  assert.notEqual(verifier(args, true), cyclique)
  const capture = verifier({ objet: { nom: { k: 'lit', v: 'src/a' } }, ctx: { f: 'banc.mjs', env: null } })
  const opaque = structurel.cleCanonique(({ referenceDe }) => referenceDe({ pile: [capture] }), null, null, { strict: true, cellules: true })
  assert.notEqual(opaque, null)
  const compose = structurel.composerCle('retour banc.mjs#f(', capture, ')')
  assert.equal(structurel.texteDeCle(compose), `retour banc.mjs#f(${structurel.texteDeCle(capture)})`)
  assert.notEqual(structurel.composerCle('retour banc.mjs#g(', capture, ')'), compose)
  const source = { objet: { v: { k: 'lit', v: 'src/a' } }, ctx: { f: 'banc.mjs', env: null } }
  const instantane = structurel.cleDe(source)
  const octets = structurel.texteDeCle(instantane)
  Object.defineProperty(source.objet, 'v', { get() { throw new Error('SOURCE_RELECTURE') } })
  assert.equal(structurel.texteDeCle(instantane), octets)
  let effets = 0
  for (const inadmissible of [new Proxy([], { ownKeys() { effets++; throw new Error('Proxy') } }),
    Object.defineProperty([], 'x', { get() { effets++; return 1 } }), Object.assign([], { toJSON() { effets++; return [] } })])
    assert.throws(() => structurel.cleDesArgs(inadmissible), /CLE_STRUCTURELLE_SOURCE_INADMISSIBLE/)
  assert.equal(effets, 0)
  const propre = Object.fromEntries([['toJSON', { k: 'lit', v: 'inoffensif' }], ['__proto__', { k: 'lit', v: 'src/a' }]])
  verifier({ objet: propre, ctx: { f: 'banc.mjs', env: null } })
})

// #2586
test('dictionnaires Source : noms propres froids et JSON chauds, prototype explicite conservateur', () => {
  for (const nom of ['__proto__', 'constructor', 'toString', 'toJSON']) {
    const texte = `export function ${nom}(x){readFileSync(x);return x};const base='src/a';readFileSync({${nom}:base}.${nom});${nom}('src/b')`
    const lu = lire('banc.mjs', texte)
    assert.equal(Object.hasOwn(lu.fonctions, nom), true)
    assert.equal(Object.hasOwn(lu.exports, nom), true)
    for (const lecture of [lu, JSON.parse(JSON.stringify(lu))]) {
      const ev = evaluateurDuDepot({ lecture: () => lecture, cible: () => null })
      const champ = lecture.sites.find((s) => s.args[0]?.k === 'champ').args[0]
      assert.equal(Object.hasOwn(champ.de.v, nom), nom !== '__proto__')
      const champLu = ev.valeurs(champ, { f: 'banc.mjs', env: null })
      if (nom === '__proto__') assert.match(champLu[0].non, /prototype explicite/)
      else assert.deepEqual(champLu, [{ texte: 'src/a' }])
      for (const absent of ['constructor', 'toString', 'toJSON', '__proto__'])
        assert.deepEqual(ev.valeurs({ k: 'champ', de: { k: 'objet', v: {} }, nom: absent, texte: absent }, { f: 'banc.mjs', env: null }), [{ absent: true }])
      assert.deepEqual(ev.valeurs({ k: 'appel', cible: { k: 'fn', id: nom }, args: [{ k: 'lit', v: 'src/a' }] }, { f: 'banc.mjs', env: null }), [{ texte: 'src/a' }])
      for (const absent of ['constructor', 'toString', 'toJSON', '__proto__'].filter((x) => x !== nom))
        assert.deepEqual(ev.valeurs({ k: 'appel', cible: { k: 'fn', id: absent }, args: [] }, { f: 'banc.mjs', env: null }), [{ non: `fonction ${absent} illisible` }])
    }
  }
  const shorthand = lire('banc.mjs', "const __proto__='src/a';readFileSync({__proto__}.__proto__)")
  assert.equal(Object.hasOwn(shorthand.sites[0].args[0].de.v, '__proto__'), true)
  for (const lecture of [shorthand, JSON.parse(JSON.stringify(shorthand))]) {
    const ev = evaluateurDuDepot({ lecture: () => lecture, cible: () => null })
    assert.deepEqual(ev.sitesDe('banc.mjs')[0].valeurs, [{ chemin: 'src/a' }])
  }
  const prototype = lire('banc.mjs', "readFileSync({__proto__:{fichier:'src/a'}}.fichier)")
  for (const lecture of [prototype, JSON.parse(JSON.stringify(prototype))]) {
    const ev = evaluateurDuDepot({ lecture: () => lecture, cible: () => null })
    assert.match(ev.sitesDe('banc.mjs')[0].valeurs[0].non, /prototype explicite/)
  }
})

/** Les clés du régime d'`evaluateurDuDepot` à ses défauts, et `cle(x, options, memo)` : la clé de `x` sous `options`. */
const clesDuDepot = () => {
  const cles = clesCanoniques({ ferme: false, clesStructurelles: false })
  return { ...cles, cle: (x, options, memo = null) => cles.cleCanonique(({ referenceDe }) => referenceDe(x), x, memo, options) }
}

/** L'ORACLE d'une clé mémoïsée : le texte de la clé de `x` par une instance NEUVE, sans mémo, aux `formes` associées. */
const cleFroide = (x, options, formes = []) => {
  const neuves = clesDuDepot()
  for (const [objet, forme] of formes) neuves.formesDesArguments.set(objet, forme)
  return neuves.texteDeCle(neuves.cle(x, options))
}

/** Le booléen que l'évaluateur prouve pour `e` : sa négation publique, renversée ; `null` si indécidable. */
const booleenDe = (ev, e, ctx) => {
  const [rendu] = ev.valeurs({ k: 'negation', de: e }, ctx)
  return 'booleen' in rendu ? !rendu.booleen : null
}

// #2586
test('clés strictes textuelles : formes indépendantes, dépendances négatives et mémo égal à la clé froide', () => {
  const p = clesDuDepot()
  const cache = new WeakMap()
  const options = { strict: true }
  const cle = (x) => p.cle(x, options, cache)
  const feuille = Object.freeze([])
  const racine = Object.freeze({ feuille })
  const original = cle(racine)
  assert.equal(original, cleFroide(racine, options))
  for (let i = 0; i < 200; i++) {
    p.formesDesArguments.set([], { e: { k: 'lit', v: i }, ctx: { f: 'banc.mjs', env: { args: [] } } })
    assert.equal(cle(racine), original)
  }
  const forme = { e: { k: 'lit', v: 'a' }, ctx: { f: 'banc.mjs', env: { args: [] } } }
  p.formesDesArguments.set(feuille, forme)
  const avecForme = cle(racine)
  assert.notEqual(avecForme, original)
  assert.equal(avecForme, cleFroide(racine, options, [[feuille, forme]]))
  forme.e.v = 'b'
  p.formesDesArguments.set(feuille, forme)
  assert.notEqual(cle(racine), avecForme)
  assert.equal(cle(racine), cleFroide(racine, options, [[feuille, forme]]))
  p.formesDesArguments.delete(feuille)
  assert.equal(cle(racine), original)
  const enfant = { v: 'a' }
  const parent = Object.freeze({ enfant })
  const avant = cle(parent)
  enfant.v = 'b'
  assert.notEqual(cle(parent), avant)
  assert.equal(cle(parent), cleFroide(parent, options))
})

// #2586
test('clés P : projections isolées, invalidation des ancêtres et copies gelées égales', () => {
  const p = clesDuDepot()
  const cache = new WeakMap()
  const options = (formesCompletes) => ({ strict: true, cellules: true, formesCompletes })
  const cle = (x, formesCompletes = false, memo = cache) => p.cle(x, options(formesCompletes), memo)
  const texte = (x, formesCompletes = false) => p.texteDeCle(cle(x, formesCompletes))
  const feuille = Object.freeze([Object.freeze({ texte: 'src/a' })])
  const racine = Object.freeze({ feuille })
  const original = cle(racine)
  assert.equal(cle(racine), original)
  assert.equal(p.texteDeCle(original), cleFroide(racine, options(false)))
  const opaque = cle(racine)
  assert.equal(cle(opaque, false, null), opaque)
  const forme = { e: { k: 'lit', v: 'src/a' }, ctx: { f: 'banc.mjs', env: null } }
  p.formesDesArguments.set(feuille, forme)
  const historique = cle(racine)
  const complet = cle(racine, true)
  assert.notEqual(historique, complet)
  for (const projection of [false, true, false, true]) {
    assert.equal(cle(racine, projection), projection ? complet : historique)
    assert.equal(texte(racine, projection), cleFroide(racine, options(projection), [[feuille, forme]]))
  }
  forme.ctx.f = 'autre.mjs'
  assert.notEqual(cle(racine), historique)
  assert.equal(texte(racine), cleFroide(racine, options(false), [[feuille, forme]]))
  const formeGelee = gelerLaConstante({ e: { k: 'lit', v: 'src/a' }, ctx: { f: 'banc.mjs', env: null } })
  p.formesDesArguments.set(feuille, formeGelee)
  for (const projection of [false, true, false, true, true, false])
    assert.equal(texte(racine, projection), cleFroide(racine, options(projection), [[feuille, formeGelee]]), String(projection))
  p.formesDesArguments.delete(feuille)
  assert.equal(cle(racine), original)
  for (let i = 0; i < 100; i++) assert.equal(cle(gelerLaConstante(structuredClone(racine)), false, null), original)
  const distinctes = new Set(Array.from({ length: 10 }, (_, i) => cle(gelerLaConstante({ feuille: [{ texte: `src/${i}` }] }), false, null)))
  assert.equal(distinctes.size, 10)
  assert.equal(distinctes.has(original), false)
})

// #2586
test('clés P : sorties et requêtes froides-chaudes, imports, coupes, lambdas et provenance', () => {
  const cas = [
    { 'a.mjs': "export function lire(x='src/a',...suite){readFileSync(x);for(const y of suite)readFileSync(y);return x}", 'b.mjs': "import {lire} from './a.mjs';lire();lire('docs/a','src/b');readFileSync(lire('src/c'))" },
    { 'a.mjs': "export function lire(base,{active=true}={}){if(active)readFileSync(join(base,'a'));else readFileSync(join(base,'b'));return active?'src/x':'docs/x'}", 'b.mjs': "import {lire} from './a.mjs';lire('src',{active:false,toJSON:'inoffensif'});readFileSync(lire('docs',{active:true}))" },
    { 'a.mjs': "export function fabriquer(base){return (nom='a',...reste)=>{readFileSync(join(base,nom));return (fin)=>join(base,nom,fin)}}", 'b.mjs': "import {fabriquer} from './a.mjs';const rappel=fabriquer('src');const enfant=rappel();readFileSync(enfant('fin'));const autre=fabriquer('docs');autre('b')" },
    { 'a.mjs': "export function lire(base,rappel){return rappel(base)}", 'b.mjs': "import {lire} from './a.mjs';lire('src/a',(x)=>{readFileSync(x);return x});readFileSync(['src/a','src/b'].map(String));readFileSync(['src/c'].map((x)=>x))" },
    { 'a.mjs': "import {b} from './b.mjs';export function a(x){readFileSync(x);return b(x)}", 'b.mjs': "import {a} from './a.mjs';export function b(x){readFileSync(join(x,'b'));return a(x)};a('src')" },
    { 'a.mjs': "export function a(x){return a(join(x,'a'))};a('src');readFileSync(a('docs'))" },
    { 'a.mjs': "export function __proto__(x){readFileSync(x);return x};export {__proto__ as constructor}", 'b.mjs': "import {constructor} from './a.mjs';const __proto__='src/a';constructor({__proto__}.__proto__);readFileSync({__proto__:{fichier:'src/b'}}.fichier)" },
    { 'a.mjs': "function racine(x){return x};export const CONTRATS_DE_DERIVATION=[{fonction:racine,retour:{type:'racineGit',argument:0}}];readFileSync(racine({nom:'src/a',toJSON:'inoffensif'}))" },
  ]
  for (const modules of cas) for (const chaud of [false, true]) {
    const lectures = Object.fromEntries(Object.entries(modules).map(([f, texte]) => {
      const lecture = lire(f, texte)
      return [f, gelerLaConstante(chaud ? JSON.parse(JSON.stringify(lecture)) : lecture)]
    }))
    const construire = (clesStructurelles) => evaluateurDuDepot({
      clesStructurelles,
      lecture: (f) => Object.hasOwn(lectures, f) ? lectures[f] : null,
      cible: (f, spec) => { const g = posix.join(posix.dirname(f), spec); return Object.hasOwn(lectures, g) ? g : null },
    })
    const avant = construire(false)
    const apres = construire(true)
    for (let tour = 0; tour < 3; tour++) for (const f of Object.keys(modules).sort((a, b) => tour % 2 ? parUnitesDeCode(b, a) : parUnitesDeCode(a, b)))
      for (const nature of ['relaisExportes', 'sitesDe']) {
        const a = avant.tracer(() => avant[nature](f))
        const b = apres.tracer(() => apres[nature](f))
        assert.deepEqual(b.resultat, a.resultat, `${chaud}:${tour}:${f}:${nature}`)
        assert.deepEqual([...b.requetes].sort(), [...a.requetes].sort(), `${chaud}:${tour}:${f}:${nature}:requêtes`)
      }
  }
  const lectures = { 'a.mjs': lire('a.mjs', "export function fabriquer(){return (x)=>join('src',x)}") }
  for (const clesStructurelles of [false, true]) {
    const ev = evaluateurDuDepot({ clesStructurelles, lecture: (f) => lectures[f] ?? null, cible: () => 'a.mjs' })
    const ancien = ev.valeurs({ k: 'appel', cible: { k: 'importe', spec: './a.mjs', nom: 'fabriquer' }, args: [] }, { f: 'b.mjs', env: null })[0]
    const id = ancien.lambda.id
    lectures['a.mjs'] = lire('a.mjs', "export function fabriquer(){return (x)=>join('doc',x)}")
    assert.equal(Object.hasOwn(lectures['a.mjs'].lambdas, id), true)
    assert.deepEqual(ev.valeurs({ k: 'appel', cible: { k: 'paramLambda', fn: 'f', index: 0, nom: 'c' }, args: [{ k: 'lit', v: 'a' }], texte: 'c' },
      { f: 'b.mjs', env: { fn: 'f', args: [
        [ancien],
      ] } }), [{ texte: 'src/a' }])
    lectures['a.mjs'] = lire('a.mjs', "export function fabriquer(){return (x)=>join('src',x)}")
  }
})

// #2586
test('lexique lambda : définition unique, clôture transitive et JSON réalloué', (t) => {
  const texte = "export function fabriquer(base){const rappel=(nom='a',...reste)=>{const enfant=(fin)=>join(base,nom,fin);return enfant};return {premier:rappel,second:rappel}};{const ignore=(x)=>x;ignore('docs/ignore')};const a=fabriquer('src').premier;const aa=a();readFileSync(aa('fin'));const b=fabriquer('docs').second;const bb=b('b');readFileSync(bb('fin'))"
  const lu = lire('banc.mjs', texte)
  assert.equal(Object.keys(lu.lambdas).length, 2)
  const vus = new Set()
  const references = []
  const visiter = (x) => {
    if (!x || typeof x !== 'object' || vus.has(x)) return
    vus.add(x)
    if (x.k === 'lambda') references.push(x)
    for (const v of Object.values(x)) visiter(v)
  }
  visiter({ sites: lu.sites, fonctions: lu.fonctions, exports: lu.exports })
  assert.ok(references.length >= 1)
  for (const reference of references) assert.deepEqual(Object.keys(reference).sort(), ['id', 'k'])
  for (const definition of Object.values(lu.lambdas)) assert.ok(definition.params && definition.retours && definition.sites)
  const rendu = (lecture) => evaluateurDuDepot({ lecture: () => lecture, cible: () => null }).sitesDe('banc.mjs')
  const attendu = [[{ chemin: 'src/a/fin' }], [{ chemin: 'docs/b/fin' }]]
  const racines = rendu(lu).filter((s) => !s.relais && s.appel === 'readFileSync').map((s) => s.valeurs)
  assert.deepEqual(racines, attendu)
  assert.deepEqual(rendu(JSON.parse(JSON.stringify(lu))), rendu(lu))
  const inline = (x) => !x || typeof x !== 'object' ? x : x.k === 'lambda' && !x.retours
    ? inline(lu.lambdas[x.id]) : Array.isArray(x) ? x.map(inline) : Object.fromEntries(Object.entries(x).map(([k, v]) => [k, inline(v)]))
  const racinesIR = { sites: lu.sites, fonctions: lu.fonctions, exports: lu.exports }
  const compacte = Buffer.byteLength(JSON.stringify(lu))
  const developpee = Buffer.byteLength(JSON.stringify({ ...inline(racinesIR), etoiles: lu.etoiles }))
  assert.ok(compacte < developpee)
  t.diagnostic(`IR compact=${compacte}, inline=${developpee}, définitions=${Object.keys(lu.lambdas).length}`)
})

// #2586
test('lexique lambda : origine importée, capture, défauts, restes et rappel lecteur', () => {
  const modules = {
    'a.mjs': "export function fabrique(base){return (nom='a')=>join(base,nom)};export function lecteur(base){return (nom)=>readFileSync(join(base,nom))}",
    'b.mjs': "export function fabrique(base){return (nom='b',...reste)=>join(base,nom,...reste)};export function lecteur(base){return (nom)=>readFileSync(join(base,nom))}",
    'usage.mjs': "import {fabrique as a} from './a.mjs';import {fabrique as b} from './b.mjs';const ra=a('src');const rb=b('docs');readFileSync(ra());readFileSync(rb('nom','fin'));function appliquer(cb){cb('lu')};appliquer((nom)=>readFileSync(join('src',nom)));for(const nom of ['un','deux'].map(ra))readFileSync(nom)",
  }
  assert.equal(Object.keys(lire('a.mjs', modules['a.mjs']).lambdas)[0], Object.keys(lire('b.mjs', modules['b.mjs']).lambdas)[0])
  const racines = racinesDe(modules, 'usage.mjs')
  assert.ok(racines.some((vs) => vs.some((v) => v.chemin === 'src/a')), JSON.stringify(racines))
  assert.ok(racines.some((vs) => vs.some((v) => v.chemin === 'docs/nom/fin')))
  assert.ok(racines.some((vs) => vs.some((v) => v.chemin === 'src/lu')))
  assert.ok(racines.some((vs) => vs.some((v) => v.chemin === 'src/un') && vs.some((v) => v.chemin === 'src/deux')))
})

// #2586
test('lexique lambda : requête canonique et mutation sous le même id', () => {
  let lu = lire('origine.mjs', "export function produire(){return (flag)=>flag}")
  const id = Object.keys(lu.lambdas)[0]
  const e = evaluateurDuDepot({ lecture: (f) => f === 'origine.mjs' ? lu : null, cible: () => null })
  const expression = { k: 'appel', cible: { k: 'lambda', id }, args: [{ k: 'booleen', v: true }], texte: 'rappel' }
  const ctx = { f: 'origine.mjs', env: null }
  const froid = e.tracer(() => booleenDe(e, expression, ctx))
  const chaud = e.tracer(() => booleenDe(e, expression, ctx))
  assert.equal(froid.resultat, true)
  assert.deepEqual(chaud, froid)
  assert.ok(froid.requetes.has(JSON.stringify(['lecture', 'origine.mjs'])))
  lu = JSON.parse(JSON.stringify(lu))
  lu.lambdas[id].retours = [{ k: 'booleen', v: false }]
  const change = e.tracer(() => booleenDe(e, expression, ctx))
  assert.equal(change.resultat, false)
  assert.ok(change.requetes.has(JSON.stringify(['lecture', 'origine.mjs'])))
})

// #2586
test('lexique lambda autonome : expression, racine, ref absente et fonction nommée opaque', () => {
  const texte = "const holder={rappel:(nom='src/a')=>nom};const rappel=holder.rappel;const resultat=rappel();"
  const { sourceFile } = analyserTexte({ rel: 'banc.mjs', text: texte })
  const lecteur = lecteurDExpressions('banc.mjs', sourceFile)
  const expression = lecteur.expr(sourceFile.statements[2].declarationList.declarations[0].initializer)
  assert.deepEqual(evaluer(expression, { lambdas: lecteur.lambdas }), [{ chemin: 'src/a' }])
  const id = Object.keys(lecteur.lambdas)[0]
  assert.deepEqual(evaluer({ k: 'lambda', id }, { lambdas: lecteur.lambdas }), [{ non: 'racine non chemin' }])
  assert.deepEqual(evaluer({ k: 'lambda', id: 'lambda:absente' }, { lambdas: lecteur.lambdas }), [{ non: 'fonction anonyme lambda:absente absente' }])
  assert.deepEqual(evaluer({ k: 'lambda', id }), [{ non: `fonction anonyme ${id} absente` }])
  for (const nom of ['constructor', '__proto__'])
    assert.deepEqual(evaluer({ k: 'lambda', id: nom }, { lambdas: lecteur.lambdas }), [{ non: `fonction anonyme ${nom} absente` }])
  const fn = { k: 'appel', cible: { k: 'fn', id: 'opaque' }, args: [], texte: 'opaque' }
  assert.deepEqual(evaluer(fn, { lambdas: lecteur.lambdas }), evaluer(fn))
})

// #2586
test('lexique lambda : première profondeur et placeholder de récursion conservés', () => {
  const texte = "const holder={rappel:(x)=>join('src',x)}"
  const { sourceFile } = analyserTexte({ rel: 'banc.mjs', text: texte })
  const noeud = sourceFile.statements[0].declarationList.declarations[0].initializer.properties[0].initializer
  const profond = lecteurDExpressions('banc.mjs', sourceFile)
  const reference = profond.expr(noeud, 24)
  assert.deepEqual(profond.lambdas[reference.id].retours, [{ k: 'non', raison: 'expression trop profonde' }])
  assert.strictEqual(profond.expr(noeud), reference)
  assert.deepEqual(profond.lambdas[reference.id].retours, [{ k: 'non', raison: 'expression trop profonde' }])
  const normal = lecteurDExpressions('banc.mjs', sourceFile)
  const autre = normal.expr(noeud)
  assert.equal(autre.id, reference.id)
  assert.equal(normal.lambdas[autre.id].retours[0].k, 'join')
  assert.deepEqual(profond.expr(noeud, 25), { k: 'non', raison: 'expression trop profonde' })
  const recursive = lire('banc.mjs', "export function fabriquer(){const rappel=(x)=>rappel(x);return rappel}")
  const definition = Object.values(recursive.lambdas)[0]
  assert.deepEqual(definition.retours[0].cible, { k: 'non', raison: 'fonction anonyme récursive' })
  const evaluerModule = (lu) => evaluateurDuDepot({ lecture: () => lu, cible: () => null }).valeurs(
    { k: 'appel', cible: { k: 'lambda', id: definition.id }, args: [{ k: 'lit', v: 'src/a' }], texte: 'rappel' }, { f: 'banc.mjs', env: null })
  assert.deepEqual(evaluerModule(recursive), [{ non: 'appel rappel' }])
  assert.deepEqual(evaluerModule(JSON.parse(JSON.stringify(recursive))), evaluerModule(recursive))
})

// #2586
test('sous-graphes revalidés : enveloppes fraîches, mutations profondes et qualification, égales à la clé froide', () => {
  const p = clesDuDepot()
  const options = { strict: true, cellules: true }
  const verifier = (x, formes = []) => {
    const a = p.cle(x, options)
    assert.equal(p.texteDeCle(a), cleFroide(x, options, formes))
    return a
  }
  const branche = { enfant: { liste: [{ v: true }] } }
  const enveloppe = () => ({ gauche: branche, droite: branche, pile: ['a', 'b'] })
  const froid = verifier(enveloppe())
  assert.equal(verifier(enveloppe()), froid)
  branche.enfant.liste[0].v = false
  assert.notEqual(verifier(enveloppe()), froid)
  assert.equal(verifier(structuredClone(enveloppe())), verifier(enveloppe()))
  assert.notEqual(verifier({ ...enveloppe(), pile: ['b', 'a'] }), verifier(enveloppe()))
  Object.defineProperty(branche.enfant.liste[0], 'v', { enumerable: false })
  assert.equal(verifier(enveloppe()), null)
  Object.defineProperty(branche.enfant.liste[0], 'v', { enumerable: true, get: () => true })
  assert.equal(verifier(enveloppe()), null)
  branche.enfant.liste[0] = { v: true }
  Object.setPrototypeOf(branche.enfant.liste[0], { autre: true })
  assert.equal(verifier(enveloppe()), null)
  branche.enfant.liste[0] = new Proxy({ v: true }, {})
  assert.equal(verifier(enveloppe()), null)
  branche.enfant.liste[0] = { v: true }
  branche.enfant.liste[0].symbole = Symbol()
  assert.equal(verifier(enveloppe()), null)
  delete branche.enfant.liste[0].symbole
  const cycle = { branche }
  branche.retour = cycle
  verifier({ cycle, branche, pile: [] })
  verifier({ branche, cycle, pile: ['a'] })
  delete branche.retour
  verifier(enveloppe())
  const args = [{ v: true }]
  const racine = { args }
  const forme = { e: { k: 'booleen', v: true }, ctx: { f: 'a', env: { args: [] } } }
  const sansForme = verifier(racine)
  p.formesDesArguments.set(args, forme)
  const avecForme = verifier(racine, [[args, forme]])
  assert.notEqual(avecForme, sansForme)
  forme.e.v = false
  assert.notEqual(verifier(racine, [[args, forme]]), avecForme)
  const ailleurs = { ...forme, ctx: { f: 'b', env: { args: [] } } }
  p.formesDesArguments.set(args, ailleurs)
  verifier(racine, [[args, ailleurs]])
  p.formesDesArguments.delete(args)
  assert.equal(verifier(racine), sansForme)
  p.formesDesArguments.set(args, undefined)
  verifier(racine, [[args, undefined]])
  verifier(racine, [[args, undefined]])
  const source = lire('bool.mjs', 'export function choisi(flag) { return flag }')
  const acces = { lecture: () => source, cible: () => 'bool.mjs' }
  const ev = evaluateurDuDepot(acces)
  const e = { k: 'appel', cible: { k: 'importe', spec: './bool.mjs', nom: 'choisi' }, args: [{ k: 'booleen', v: true }] }
  const ctx = { f: 'banc.mjs', env: null }
  const observer = (expression = e, contexte = ctx) => {
    const chaud = ev.tracer(() => booleenDe(ev, expression, contexte))
    const neuf = evaluateurDuDepot(acces)
    assert.deepEqual(chaud, neuf.tracer(() => booleenDe(neuf, expression, contexte)))
    return chaud
  }
  const premier = observer()
  assert.deepEqual(observer(), premier)
  assert.deepEqual(observer(structuredClone(e), structuredClone(ctx)), premier)
  assert.equal(premier.resultat, true)
  assert.ok(premier.requetes.has(JSON.stringify(['lecture', 'bool.mjs'])))
  e.args[0].v = false
  assert.equal(observer().resultat, false)
  source.fonctions.choisi.retours[0] = { k: 'booleen', v: true }
  assert.equal(observer().resultat, true)
})

// #2586
test('sous-graphes gelés : fermeture, mêmes cellules, modes et formes, égaux à la clé froide', () => {
  const p = clesDuDepot()
  const cle = (x, cellules = true, strict = true) => p.cle(x, { strict, cellules })
  const enfant = gelerLaConstante({ e: { k: 'booleen', v: true }, ctx: { f: 'a', env: { fn: 'f', args: [] } }, pile: ['a', 'b'] })
  const racine = gelerLaConstante({ gauche: enfant, droite: enfant })
  const froid = cle(racine)
  assert.equal(cle(racine), froid)
  assert.equal(p.texteDeCle(froid), cleFroide(racine, { strict: true, cellules: true }))
  assert.equal(cle(structuredClone(racine)), froid)
  for (let i = 0; i < 20; i++) {
    assert.equal(cle(racine), froid)
    assert.equal(cle(gelerLaConstante(structuredClone(racine))), froid)
  }
  for (const cellules of [false, true]) for (const strict of [false, true])
    assert.equal(p.texteDeCle(cle(racine, cellules, strict)), cleFroide(racine, { strict, cellules }))
  const mutable = { v: true }
  const parent = Object.freeze({ enfant: mutable })
  const a = cle(parent)
  mutable.v = false
  assert.notEqual(cle(parent), a)
  assert.equal(p.texteDeCle(cle(parent)), cleFroide(parent, { strict: true, cellules: true }))
  const argumentsFormes = gelerLaConstante([{ v: true }])
  const forme = gelerLaConstante({ e: { k: 'booleen', v: true }, ctx: { f: 'a', env: { args: [] } } })
  p.formesDesArguments.set(argumentsFormes, forme)
  const avecForme = Object.freeze({ argumentsFormes })
  assert.equal(p.texteDeCle(cle(avecForme)), cleFroide(avecForme, { strict: true, cellules: true }, [[argumentsFormes, forme]]))
  assert.notEqual(p.texteDeCle(cle(avecForme)), cleFroide(avecForme, { strict: true, cellules: true }))
})

// #2586
test('sous-graphes gelés : cycles, alias, pile et mémo d’un encodage égaux à la clé froide', () => {
  const p = clesDuDepot()
  const options = { strict: true, cellules: true }
  const cycle = { v: true }
  cycle.soi = cycle
  Object.freeze(cycle)
  const parent = Object.freeze({ cycle })
  const a = p.cle(parent, options)
  assert.notEqual(a, null)
  assert.equal(p.texteDeCle(a), cleFroide(parent, options))
  const imbrique = Object.freeze({ parent })
  const avecPile = p.cle(imbrique, options)
  assert.notEqual(avecPile, null)
  assert.equal(p.texteDeCle(avecPile), cleFroide(imbrique, options))
  const args = gelerLaConstante([{ v: true }])
  const encoder = (cles) => {
    const ancienne = cles.cle(args, options)
    const faire = ({ referenceDe, interner, tuple }) => {
      const premier = referenceDe(args)
      cles.formesDesArguments.set(args, gelerLaConstante({ e: { k: 'booleen', v: false }, ctx: { f: 'a', env: { args: [] } } }))
      const second = referenceDe(args)
      assert.equal(premier, ancienne)
      assert.equal(second, premier)
      return interner(tuple(premier, second))
    }
    return cles.texteDeCle(cles.cleCanonique(faire, args, null, options))
  }
  assert.equal(encoder(p), encoder(clesDuDepot()))
})

// #2586
test('sous-graphes gelés : révisions des formes avant et pendant l’encodage, égales à la clé froide', () => {
  const p = clesDuDepot()
  const cache = new WeakMap()
  const options = { strict: true, cellules: true }
  const enfant = gelerLaConstante([{ v: true }])
  const racine = Object.freeze({ enfant })
  const cle = (memo = cache) => p.cle(racine, options, memo)
  const forme = (v) => gelerLaConstante({ e: { k: 'booleen', v }, ctx: { f: 'a', env: { args: [] } } })
  const ancienne = cle(null)
  assert.equal(cle(), ancienne)
  const fausse = forme(false)
  p.formesDesArguments.set(enfant, fausse)
  const nouvelle = cle()
  assert.notEqual(nouvelle, ancienne)
  assert.equal(cle(null), nouvelle)
  assert.equal(p.texteDeCle(nouvelle), cleFroide(racine, options, [[enfant, fausse]]))
  p.formesDesArguments.delete(enfant)
  assert.equal(cle(null), ancienne)
  assert.equal(cle(), ancienne)
  p.formesDesArguments.set(enfant, undefined)
  assert.equal(p.texteDeCle(cle()), cleFroide(racine, options, [[enfant, undefined]]))
  p.formesDesArguments.delete(enfant)
  const pendant = forme(false)
  p.cleCanonique(({ referenceDe }) => {
    const reference = referenceDe(racine)
    p.formesDesArguments.set(enfant, pendant)
    return reference
  }, racine, new WeakMap(), options)
  const apresEncodage = cle()
  assert.notEqual(apresEncodage, ancienne)
  assert.equal(cle(null), apresEncodage)
  assert.equal(p.texteDeCle(apresEncodage), cleFroide(racine, options, [[enfant, pendant]]))
})

// #2586
test('sous-graphes gelés : associations étrangères, ancêtres partagés et associations rendues', () => {
  const p = clesDuDepot()
  const options = { strict: true, cellules: true }
  const cle = (x) => p.cle(x, options)
  const enfant = gelerLaConstante([{ v: true }])
  const gauche = Object.freeze({ enfant })
  const droite = Object.freeze({ enfant })
  const racine = Object.freeze({ gauche, droite })
  const cellule = cle(racine)
  assert.equal(p.texteDeCle(cellule), cleFroide(racine, options))
  for (let i = 0; i < 5; i++) p.formesDesArguments.set([], { i })
  assert.equal(cle(racine), cellule)
  p.formesDesArguments.set(enfant, undefined)
  assert.equal(cle(racine), cellule)
  assert.equal(p.formesDesArguments.has(enfant), true)
  p.formesDesArguments.set(enfant, undefined)
  p.formesDesArguments.delete(enfant)
  assert.equal(cle(racine), cellule)
  const externe = []
  const forme = {}
  p.formesDesArguments.set(externe, forme)
  p.formesDesArguments.set(externe, forme)
  p.formesDesArguments.delete(externe)
  assert.equal(cle(racine), cellule)
})

// #2586
test('sous-graphes gelés : les sources et les parents clés sont collectés', async (t) => {
  if (!globalThis.gc) {
    const dossier = mkdtempSync(join(tmpdir(), 'racines-gc-'))
    try {
      const r = await spawnBorne({ argv: ['--expose-gc', '--test', '--test-reporter', 'spec',
        '--test-name-pattern', 'les sources et les parents clés sont collectés', fileURLToPath(import.meta.url)],
      fichier: join(dossier, 'rapport.log'), limiteMs: 10000, cwd: process.cwd(),
      env: Object.fromEntries(Object.entries(process.env).filter(([nom]) => nom !== 'NODE_TEST_CONTEXT')) })
      t.diagnostic(r.sortie)
      assert.equal(r.expiree, false)
      assert.equal(r.code, 0)
    } finally { rmSync(dossier, { recursive: true, force: true }) }
    return
  }
  const collecter = async (refs) => {
    for (let i = 0; i < 8; i++) {
      await new Promise((r) => setImmediate(r))
      const collecte = globalThis.gc({ type: 'major', execution: 'async' })
      assert.ok(collecte instanceof Promise)
      await collecte
      await new Promise((r) => setImmediate(r))
      if (refs.every((r) => r.deref() === undefined)) return
    }
    assert.fail(`sources retenues après huit tâches de GC : ${refs.filter((r) => r.deref() !== undefined).length} sur ${refs.length}`)
  }
  for (const formesCompletes of [false, true]) {
    const p = clesDuDepot()
    const options = { strict: true, cellules: true, formesCompletes }
    const enfant = Object.freeze({ v: true })
    const cle = p.cle(enfant, options)
    const creer = (n) => Array.from({ length: n }, () => {
      const parent = Object.freeze({ enfant, alias: enfant })
      p.cle(parent, options)
      return new WeakRef(parent)
    })
    const jeterSource = () => {
      const source = Object.freeze({ v: false })
      p.cle(source, options)
      return new WeakRef(source)
    }
    await collecter([jeterSource(), ...creer(128)])
    for (let lot = 0; lot < 4; lot++) await collecter(creer(256))
    assert.equal(p.cle(enfant, options), cle)
  }
})

// #2586
test('cellules BOOL : construction sans appel supplémentaire au map global', () => {
  const map = Object.getOwnPropertyDescriptor(Array.prototype, 'map')
  let appels = 0
  try {
    Object.defineProperty(Array.prototype, 'map', { ...map, value: function (...args) {
      appels++
      return Reflect.apply(map.value, this, args)
    } })
    evaluateurDuDepot({ lecture: () => null, cible: () => null })
  } finally { Object.defineProperty(Array.prototype, 'map', map) }
  assert.equal(appels, 0)
})

// #2586
test('cellules BOOL : équivalence canonique dans chaque historique et modes des deux hits', () => {
  const p = clesDuDepot()
  const cache = new WeakMap()
  const cle = (x, cellules, memo = null) => p.cle(x, { strict: true, cellules }, memo)
  const descriptor = (v) => p.cleCanonique(({ interner, tuple }) => interner(tuple('scalaire', v)), null, null, { strict: true, cellules: true })
  assert.notEqual(descriptor(1), descriptor('1'))
  assert.notEqual(descriptor(true), descriptor(1))
  const cycle = () => { const x = { v: true }; x.soi = x; return x }
  const alias = { v: true }
  const cas = [null, undefined, true, false, 0, 1, '1', 'true', [], {}, [0], ['0'],
    { a: 0, b: 1 }, { b: 1, a: 0 }, [0, 1], [1, 0], { enfant: { v: 0 } },
    { enfant: { v: 1 } }, cycle(), cycle(), [alias, alias], [{ v: true }, { v: true }],
    { e: { k: 'booleen', v: true }, ctx: { f: 'a', env: { fn: 'f', args: [], parent: null } }, pile: [] },
    { e: { k: 'booleen', v: true }, ctx: { f: 'a', env: { fn: 'g', args: [], parent: null } }, pile: [] },
    { e: { k: 'booleen', v: true }, ctx: { f: 'a', env: { fn: 'f', args: [], parent: {} } }, pile: [] },
    { e: { k: 'booleen', v: true }, ctx: { f: 'a', env: { fn: 'f', args: [] } }, pile: ['a', 'b'] },
    { e: { k: 'booleen', v: true }, ctx: { f: 'a', env: { fn: 'f', args: [] } }, pile: ['b', 'a'] }]
  for (const historique of [cas, [...cas].reverse(), [...cas.slice(8), ...cas.slice(0, 8)]]) {
    const cles = historique.map((x) => [cle(x, false), cle(x, true)])
    for (const a of cles) for (const b of cles) assert.equal(a[0] === b[0], a[1] === b[1])
  }
  for (const gele of [false, true]) for (const modes of [[false, true], [true, false]]) {
    const racine = { enfant: { v: true } }
    if (gele) gelerProfond(racine)
    for (let tour = 0; tour < 3; tour++) for (const mode of modes) assert.equal(cle(racine, mode, cache), cle(racine, mode))
  }
  const forme = { e: { k: 'booleen', v: true }, ctx: { f: 'a', env: { args: [], fn: 'f' } } }
  const args = [{ booleen: true }]
  p.formesDesArguments.set(args, forme)
  const avant = [cle(args, false), cle(args, true)]
  forme.ctx.env.fn = 'g'
  const apres = [cle(args, false), cle(args, true)]
  assert.notEqual(avant[0], apres[0])
  assert.notEqual(avant[1], apres[1])
  assert.notEqual(cle(args, true), cle([{ booleen: true }], true))
})

// #2586
test('cellules BOOL : copies égales, valeurs distinctes et source refusée', () => {
  const p = clesDuDepot()
  const options = { strict: true, cellules: true }
  const racine = { enfant: [{ booleen: true }], ctx: { f: 'a', env: null }, pile: [] }
  const exacte = p.cle(racine, options)
  for (let i = 0; i < 100; i++) assert.equal(p.cle(structuredClone(racine), options), exacte)
  const distinctes = new Set(Array.from({ length: 10 }, (_, i) => p.cle({ enfant: [{ booleen: true }], ctx: { f: String(i), env: null }, pile: [] }, options)))
  assert.equal(distinctes.size, 10)
  racine.enfant[0].booleen = false
  assert.notEqual(p.cle(racine, options), exacte)
  assert.equal(p.texteDeCle(p.cle(racine, options)), cleFroide(racine, options))
  assert.equal(p.cle(Object.freeze({ get v() { throw new Error('getter') } }), options), null)
})

// #2586
test('slots gelés : descendants, formes fraîches, admission locale et prototypes', () => {
  const p = clesDuDepot()
  const cache = new WeakMap()
  const cle = (x, memo = cache, strict = true) => p.cle(x, { strict }, memo)
  const enfant = { v: true }
  const parent = Object.freeze({ enfant })
  const avant = cle(parent)
  assert.equal(cle(parent), avant)
  enfant.v = false
  assert.notEqual(cle(parent), avant)
  assert.equal(cle({ enfant: { v: false } }, null), cle(parent))
  const tableau = Object.freeze([Object.freeze({ texte: 'src/a' })])
  const forme = (v) => ({ e: { k: 'lit', v }, ctx: { f: 'banc.mjs', env: null } })
  p.formesDesArguments.set(tableau, forme('src/a'))
  const a = cle(tableau)
  p.formesDesArguments.set(tableau, forme('src/b'))
  assert.notEqual(cle(tableau), a)
  const b = cle(tableau)
  p.formesDesArguments.get(tableau).e.v = 'src/c'
  assert.notEqual(cle(tableau), b)
  let getters = 0
  const refuses = [Object.freeze({ get v() { getters++; return true } }),
    Object.freeze({ [Symbol('propre')]: 1 }), Object.freeze({ v: Symbol('valeur') }), Object.freeze({ v: 1n }), Object.freeze({ v: -0 }),
    Object.freeze(Object.defineProperty({}, 'v', { value: 1 })),
    Object.freeze(Object.create({ v: 1 })), Object.freeze(tableauCreux()),
    Object.freeze(Object.assign([1], { map: Array.prototype.map })),
    Object.freeze(Object.assign([1], { autre: 1 })), Object.freeze({ toJSON() {} }), Object.freeze({ v() {} })]
  for (const x of refuses) for (let tour = 0; tour < 2; tour++) assert.equal(cle(x), null)
  assert.equal(getters, 0)
  let pieges = 0
  const proxy = new Proxy({}, { ownKeys() { pieges++; throw new Error('proxy') }, getPrototypeOf() { pieges++; throw new Error('proxy') } })
  assert.equal(cle(proxy), null)
  assert.equal(pieges, 0)
  assert.notEqual(cle(Object.freeze({ toJSON: 1 })), null)
  const source = Object.freeze({ k: 'booleen', v: true })
  const exacte = cle(source)
  assert.equal(exacte, cle({ v: true, k: 'booleen' }, null))
  const descriptor = Object.getOwnPropertyDescriptor(Object.prototype, 'k')
  try {
    Object.defineProperty(Object.prototype, 'k', { configurable: true, get() { return 'booleen' } })
    assert.equal(cle(source), null)
  } finally {
    if (descriptor) Object.defineProperty(Object.prototype, 'k', descriptor)
    else delete Object.prototype.k
  }
  assert.equal(cle(source), exacte)
  const ordinaire = { z: undefined, a: -0, v: [null, 1] }
  assert.equal(cle(ordinaire, null, false), p.cleCanonique(({ referenceDe }) => referenceDe(ordinaire), ordinaire, null))
})

// #2586
test('certificat du graphe gelé : clé exacte, associations étrangères et révisions des formes', () => {
  const p = clesDuDepot()
  const cache = new WeakMap()
  const cle = (x, memo = cache, strict = true) => p.cle(x, { strict }, memo)
  const geler = (x) => { gelerProfond(x); return x }
  const forme = (v) => geler({ e: { k: 'lit', v }, ctx: { f: 'banc.mjs', env: { args: [] } } })
  const enfant = geler([{ texte: 'src/a' }])
  const racine = geler({ enfant, autre: [true, null] })
  const exacte = cle(racine)
  assert.equal(exacte, cle({ autre: [true, null], enfant: [{ texte: 'src/a' }] }, null))
  assert.equal(cle(racine), exacte)
  const exterieur = {}
  p.formesDesArguments.set(exterieur, forme('src/exterieur'))
  assert.equal(cle(racine), exacte)
  p.formesDesArguments.set(enfant, undefined)
  assert.equal(cle(racine), exacte)
  assert.equal(p.formesDesArguments.set(enfant, forme('src/a')), p.formesDesArguments)
  const avecForme = cle(racine)
  assert.notEqual(avecForme, exacte)
  assert.equal(avecForme, cle(racine, null))
  p.formesDesArguments.set(enfant, p.formesDesArguments.get(enfant))
  assert.equal(p.formesDesArguments.delete({}), false)
  assert.equal(cle(racine), avecForme)
  p.formesDesArguments.set(enfant, forme('src/b'))
  assert.notEqual(cle(racine), avecForme)
  assert.equal(p.formesDesArguments.delete(enfant), true)
  assert.equal(cle(racine), exacte)
  const mutable = { v: true }
  const parent = Object.freeze({ mutable })
  const avant = cle(parent)
  mutable.v = false
  assert.notEqual(cle(parent), avant)
  const expression = { k: 'lit', v: 'src/c' }
  const tableau = geler([{ texte: 'src/c' }])
  p.formesDesArguments.set(tableau, Object.freeze({ e: expression, ctx: geler({ f: 'banc.mjs', env: null }) }))
  const avantExpression = cle(tableau)
  expression.v = 'src/d'
  assert.notEqual(cle(tableau), avantExpression)
  const env = { args: [], fn: 'f' }
  const tableauEnv = geler([{ texte: 'src/e' }])
  p.formesDesArguments.set(tableauEnv, Object.freeze({ e: geler({ k: 'lit', v: 'src/e' }), ctx: Object.freeze({ f: 'banc.mjs', env }) }))
  const avantEnv = cle(tableauEnv)
  env.fn = 'g'
  assert.notEqual(cle(tableauEnv), avantEnv)
  const pendantEncodage = geler([{ texte: 'src/f' }])
  const avantEncodage = cle(pendantEncodage, null)
  p.cleCanonique(({ referenceDe }) => {
    const reference = referenceDe(pendantEncodage)
    p.formesDesArguments.set(pendantEncodage, forme('src/f'))
    return reference
  }, pendantEncodage, cache, { strict: true })
  assert.notEqual(cle(pendantEncodage), avantEncodage)
  assert.equal(cle(pendantEncodage), cle(pendantEncodage, null))
  const nonStrict = geler({ v: [true] })
  assert.equal(cle(nonStrict, cache, false), cle(nonStrict, null, false))
  const prototype = Object.getOwnPropertyDescriptor(Object.prototype, 'certificat2586')
  const toJSON = Object.getOwnPropertyDescriptor(Array.prototype, 'toJSON')
  try {
    Object.defineProperty(Object.prototype, 'certificat2586', { configurable: true, value: true })
    assert.equal(cle(racine), null)
    delete Object.prototype.certificat2586
    Object.defineProperty(Array.prototype, 'toJSON', { configurable: true, value: () => { throw new Error('toJSON exécuté') } })
    assert.equal(cle(racine), null)
  } finally {
    if (prototype) Object.defineProperty(Object.prototype, 'certificat2586', prototype)
    else delete Object.prototype.certificat2586
    if (toJSON) Object.defineProperty(Array.prototype, 'toJSON', toJSON)
    else delete Array.prototype.toJSON
  }
  assert.equal(cle(racine), exacte)
})

// #2586
test('façade des formes : contrat natif, absence, undefined, chaîne et contournement refusé', () => {
  const p = clesDuDepot()
  const table = p.formesDesArguments
  assert.equal(Object.isFrozen(table), true)
  const a = Object.freeze({ v: true })
  const b = {}
  assert.equal(table.has(a), false)
  assert.equal(table.get(a), undefined)
  assert.equal(table.set(a, undefined).set(b, a), table)
  assert.equal(table.has(a), true)
  assert.equal(table.get(a), undefined)
  assert.equal(table.get(b), a)
  assert.equal(table.delete(a), true)
  assert.equal(table.has(a), false)
  assert.equal(table.delete(a), false)
  const native = new WeakMap()
  for (const invalide of [null, undefined, 0, 'a', true, Symbol.for('2586')]) {
    assert.equal(table.get(invalide), native.get(invalide))
    assert.equal(table.has(invalide), native.has(invalide))
    assert.equal(table.delete(invalide), native.delete(invalide))
    assert.throws(() => table.set(invalide, b), TypeError)
  }
  const symbole = Symbol('2586')
  assert.equal(table.set(symbole, b), table)
  assert.equal(table.get(symbole), b)
  for (const methode of ['get', 'has', 'set', 'delete'])
    assert.throws(() => WeakMap.prototype[methode].call(table, b, a), TypeError)
  const cache = new WeakMap()
  const cle = () => p.cle(a, { strict: true }, cache)
  const avant = cle()
  assert.throws(() => table.set(0, b), TypeError)
  assert.equal(cle(), avant)
})

/** `booleenDe` par l'évaluateur `ev`, sous `tracer`, et l'ORACLE : le même calcul par un évaluateur NEUF sur `acces`. */
const booleenEtOracle = (ev, acces, e, ctx) => {
  const chaud = ev.tracer(() => booleenDe(ev, e, ctx))
  const neuf = evaluateurDuDepot(acces)
  assert.deepEqual(chaud, neuf.tracer(() => booleenDe(neuf, e, ctx)))
  return chaud
}

// #2586
test('entrée BOOL : sorties froides, chaudes et réallouées égales à l’évaluation neuve', () => {
  const source = lire('inédit.mjs', 'export function choisi(flag) { return flag }')
  const acces = { lecture: () => source, cible: () => 'inédit.mjs' }
  const ev = evaluateurDuDepot(acces)
  const expression = () => ({ k: 'appel', cible: { k: 'importe', spec: './inédit.mjs', nom: 'choisi' }, args: [{ k: 'booleen', v: true }] })
  const e = expression(), ctx = { f: 'banc.mjs', env: null }
  const sorties = [[e, ctx], [e, ctx], [expression(), { ...ctx }]].map(([entree, contexte]) => booleenEtOracle(ev, acces, entree, contexte))
  assert.equal(sorties[0].resultat, true)
  assert.deepEqual(sorties[1], sorties[0])
  assert.deepEqual(sorties[2], sorties[0])
})

// #2586
test('entrée BOOL : mutations pendant calcul et validation Source requalifiées', () => {
  const cas = [
    (e) => { e.args[0].v = false },
    (_, ctx) => { ctx.env.args[0][0].booleen = false },
    (e) => { e.cible.nom = 'autre' },
    (e) => { e.args.push({ k: 'booleen', v: false }) },
    (e) => { Object.setPrototypeOf(e.args[0], { supplement: true }) },
    (e) => { e.alias = e.args[0]; e.cycle = e },
    (e, ctx, observer) => { Object.defineProperty(e.args[0], 'extra', { enumerable: true, get() { observer(); return false } }) },
  ]
  for (const phase of ['calcul', 'validation']) for (const muter of cas) {
    let action, getters = 0
    const source = lire('inédit.mjs', 'export function choisi(flag) { return flag }; export function autre(flag) { return false }')
    const acces = { lecture: () => { action?.(); return source }, cible: () => 'inédit.mjs' }
    const ev = evaluateurDuDepot(acces)
    const e = { k: 'appel', cible: { k: 'importe', spec: './inédit.mjs', nom: 'choisi' }, args: [{ k: 'booleen', v: true }] }
    const ctx = { f: 'banc.mjs', env: { fn: 'f', args: [[{ booleen: true }]] } }
    if (phase === 'validation') ev.tracer(() => booleenDe(ev, e, ctx))
    action = () => { action = null; muter(e, ctx, () => {}); getters++ }
    const pendant = ev.tracer(() => booleenDe(ev, e, ctx))
    assert.equal(getters, 1)
    booleenEtOracle(ev, acces, e, ctx)
    assert.deepEqual(booleenEtOracle(ev, acces, e, ctx).requetes, pendant.requetes)
  }
})

test('preuves scalaires : N+1 importé, requêtes, mutations de source et arguments réalloués', () => {
  let source = lire('nouveau.mjs', 'export function inédit(flag = false) { return flag }')
  const acces = { lecture: () => source, cible: () => 'nouveau.mjs' }
  const ev = evaluateurDuDepot(acces)
  const expression = (flag) => ({ k: 'appel', cible: { k: 'importe', spec: './nouveau.mjs', nom: 'inédit' }, args: [{ k: 'booleen', v: flag }] })
  const ctx = { f: 'banc.mjs', env: null }
  const froid = booleenEtOracle(ev, acces, expression(true), ctx)
  const chaud = booleenEtOracle(ev, acces, expression(true), { ...ctx })
  assert.equal(froid.resultat, true)
  assert.deepEqual(chaud, froid)
  assert.ok(froid.requetes.has(JSON.stringify(['lecture', 'nouveau.mjs'])))
  assert.ok(froid.requetes.has(JSON.stringify(['cible', 'banc.mjs', './nouveau.mjs'])))
  assert.equal(booleenDe(ev, expression(false), ctx), false)
  const e = expression(true)
  assert.equal(booleenDe(ev, e, ctx), true)
  e.args[0].v = false
  assert.equal(booleenDe(ev, e, ctx), false)
  source.fonctions.inédit.retours[0] = { k: 'booleen', v: true }
  assert.equal(booleenDe(ev, e, ctx), true)
  source = lire('nouveau.mjs', 'export function inédit(flag = false) { return false }')
  assert.equal(booleenDe(ev, e, ctx), false)
})

test('preuves scalaires : graphes refusés sans effet technique, sources à getter et consensus public', () => {
  let getters = 0
  let valeur = true
  const source = { exports: { flag: { k: 'booleen', get v() { getters++; return valeur } } }, etoiles: [], fonctions: {}, sites: [] }
  const ev = evaluateurDuDepot({ lecture: () => source, cible: () => 'flag.mjs' })
  const ctx = { f: 'banc.mjs', env: null }
  const condition = { k: 'importe', spec: './flag.mjs', nom: 'flag' }
  assert.equal(booleenDe(ev, condition, ctx), true)
  assert.equal(getters, 1)
  assert.equal(booleenDe(ev, condition, ctx), true)
  assert.equal(getters, 2)
  valeur = false
  assert.equal(booleenDe(ev, condition, ctx), false)
  assert.equal(getters, 3)
  for (const v of [true, false]) {
    const e = Object.create(null, { k: { value: 'booleen', enumerable: true }, v: { value: v } })
    assert.equal(booleenDe(ev, e, ctx), v)
  }
  const composite = { vrai: true }
  assert.equal(booleenDe(ev, { k: 'booleen', v: composite }, ctx), true)
  composite.vrai = false
  assert.equal(booleenDe(ev, { k: 'booleen', v: composite }, ctx), true)
  for (const [e, attendu] of [[{ k: 'liste', v: [] }, null], [{ k: 'non', raison: 'opaque' }, null],
    [{ k: 'booleen', v: false }, false], [{ k: 'union', v: [{ k: 'booleen', v: false }, { k: 'booleen', v: true }] }, null]])
    for (let tour = 0; tour < 2; tour++) assert.equal(booleenDe(ev, e, ctx), attendu)
  let pieges = 0
  const proxy = new Proxy({ k: 'booleen', v: true }, {
    get(cible, nom) { pieges++; return cible[nom] },
    ownKeys() { throw new Error('ownKeys technique') },
    getOwnPropertyDescriptor() { throw new Error('descriptor technique') },
  })
  assert.equal(booleenDe(ev, proxy, ctx), true)
  assert.equal(pieges, 2)
  let json = 0
  const e = { k: 'booleen', v: true, toJSON() { json++; return false } }
  assert.equal(booleenDe(ev, e, ctx), true)
  assert.equal(json, 0)
  let lecturesCtx = 0
  const ctxGetter = { f: 'banc.mjs', get env() { lecturesCtx++; return null } }
  for (let i = 0; i < 2; i++) assert.equal(booleenDe(ev, { k: 'booleen', v: true }, ctxGetter), true)
  assert.equal(lecturesCtx, 2)
  const cles = clesDuDepot()
  for (const x of [tableauCreux(), Object.assign([1], { map: Array.prototype.map }), Object.assign([1], { extra: 1 }),
    Object.assign({}, { [Symbol('x')]: 1 }), Object.create({ x: 1 }), { enfant: { get v() { throw new Error('getter technique') } } }])
    assert.equal(cles.cle(x, { strict: true }), null)
  for (const [nom, e, contexte, rendu] of [
    ['v', { k: 'booleen' }, ctx, true],
    ['k', { v: true }, ctx, 'booleen'],
    ['f', condition, { env: null }, 'banc.mjs'],
    ['env', { k: 'paramLambda', fn: 'f', index: 0, nom: 'flag' }, { f: 'banc.mjs' }, { fn: 'f', args: [[{ booleen: true }]] }],
  ]) {
    const precedent = Object.getOwnPropertyDescriptor(Object.prototype, nom)
    let herites = 0
    try {
      Object.defineProperty(Object.prototype, nom, { configurable: true, get() { herites++; return rendu } })
      const a = booleenDe(ev, e, contexte)
      const froid = herites
      assert.ok(froid > 0, nom)
      assert.equal(booleenDe(ev, e, contexte), a)
      assert.equal(herites, 2 * froid, nom)
    } finally {
      if (precedent) Object.defineProperty(Object.prototype, nom, precedent)
      else delete Object.prototype[nom]
    }
  }
  const precedent = Object.getOwnPropertyDescriptor(Object.prototype, 'toJSON')
  try {
    Object.defineProperty(Object.prototype, 'toJSON', { configurable: true, value() { json++; return {} } })
    assert.equal(booleenDe(ev, { k: 'booleen', v: true }, ctx), true)
    assert.equal(json, 0)
  } finally {
    if (precedent) Object.defineProperty(Object.prototype, 'toJSON', precedent)
    else delete Object.prototype.toJSON
  }
})

test('preuves scalaires : alias du getter canonique avant import frais gardent leurs effets', async (t) => {
  const programme = (nom) => `
    const prototype = Object.getOwnPropertyDescriptor(Object.prototype, '__proto__')
    let appels = 0
    let valeur = ${nom === 'v' ? 'true' : "'booleen'"}
    const getter = function () { appels++; return valeur }
    Object.defineProperty(Object.prototype, '__proto__', { ...prototype, get: getter })
    Object.defineProperty(Object.prototype, ${JSON.stringify(nom)}, { configurable: true, get: getter })
    const { evaluateurDuDepot } = await import(${JSON.stringify(new URL('./racinesBalayees.mjs', import.meta.url).href)})
    const ev = evaluateurDuDepot({ lecture: () => null, cible: () => null })
    const ctx = { f: 'banc.mjs', env: null }
    const booleen = () => { const [r] = ev.valeurs({ k: 'negation', de: ${nom === 'v' ? "{ k: 'booleen' }" : '{ v: true }'} }, ctx); return 'booleen' in r ? !r.booleen : null }
    appels = 0
    const rendu = { froid: booleen() }
    rendu.appelsFroids = appels
    rendu.chaud = booleen()
    rendu.appelsChauds = appels
    valeur = ${nom === 'v' ? 'false' : "'non'"}
    rendu.change = booleen()
    rendu.appelsFinaux = appels
    process.stdout.write(JSON.stringify(rendu))`
  const dossier = mkdtempSync(join(tmpdir(), 'racines-alias-'))
  try {
    for (const nom of ['v', 'k']) {
      const r = await spawnBorne({ argv: ['--input-type=module', '-e', programme(nom)], fichier: join(dossier, `${nom}.log`), limiteMs: 10000,
        cwd: process.cwd(), fluxDistincts: true })
      assert.equal(r.code, 0, r.sortie)
      const rendu = JSON.parse(r.stdout)
      t.diagnostic(`${nom} : ${r.stdout}`)
      assert.equal(rendu.froid, true, nom)
      assert.ok(rendu.appelsFroids > 0, nom)
      assert.equal(rendu.chaud, true, nom)
      assert.equal(rendu.appelsChauds, 2 * rendu.appelsFroids, nom)
      assert.equal(rendu.change, nom === 'v' ? false : null, nom)
      assert.ok(rendu.appelsFinaux > rendu.appelsChauds, nom)
    }
  } finally { rmSync(dossier, { recursive: true, force: true }) }
})

test('preuves scalaires : tableaux sans prototype standard et qualification profonde gardent le calcul public', () => {
  const ev = evaluateurDuDepot({ lecture: () => null, cible: () => null })
  const ctx = { f: 'banc.mjs', env: null }
  const negation = (v) => ev.valeurs({ k: 'negation', de: { k: 'booleen', v } }, ctx)
  for (const prototype of [null, Object.prototype]) assert.deepEqual(negation(Object.setPrototypeOf([], prototype)), [{ booleen: false }])
  let composite = {}
  for (let i = 0; i < 10000; i++) composite = { enfant: composite }
  assert.deepEqual(negation(composite), [{ booleen: false }])
})

test('preuves scalaires : formes complètes, parents, paramètres, modes et cycles de contexte', () => {
  const p = clesDuDepot()
  const ev = evaluateurDuDepot({ lecture: () => null, cible: () => null })
  const cle = (x) => p.cle(x, { strict: true })
  const forme = (env) => {
    const a = [{ booleen: true }]
    p.formesDesArguments.set(a, { e: { k: 'paramLambda', fn: 'outer', index: 0, nom: 'flag' }, ctx: { f: 'banc.mjs', env } })
    return a
  }
  const base = { fn: 'inner', args: [], params: [], parent: { fn: 'outer', args: [[{ booleen: true }]], params: [] } }
  const a = forme(base)
  const b = forme({ ...base, parent: { ...base.parent, args: [[{ booleen: false }]] } })
  assert.notEqual(cle(a), cle(b))
  assert.notEqual(cle(a), cle(forme({ ...base, fn: 'autre' })))
  assert.notEqual(cle(a), cle(forme({ ...base, params: [{ defaut: { k: 'booleen', v: true } }] })))
  assert.equal(cle(a), cle(forme(structuredClone(base))))
  const e = { k: 'paramLambda', fn: 'outer', index: 0, nom: 'flag' }
  for (const v of [true, false, true]) {
    const env = { fn: 'inner', args: [], parent: { fn: 'outer', args: [[{ booleen: v }]], params: [] } }
    assert.equal(booleenDe(ev, e, { f: 'banc.mjs', env }), v)
  }
  const defaut = { k: 'paramLambda', fn: 'inner', index: 0, nom: 'flag' }
  for (const v of [false, true]) assert.equal(booleenDe(ev, defaut, { f: 'banc.mjs',
    env: { fn: 'inner', args: [], params: [{ defaut: { k: 'booleen', v } }] } }), v)
  const expr = { k: 'champ', de: { k: 'objet', objetDirect: true, v: {}, etales: [{ k: 'objet', objetDirect: true, v: { flag: { k: 'booleen', v: false } } }] }, nom: 'flag', texte: 'flag', defaut: { k: 'booleen', v: true } }
  for (const preuveBooleenne of [false, true]) assert.equal(booleenDe(ev, expr, { f: 'banc.mjs', env: null, preuveBooleenne }), null)
  delete expr.de.etales
  expr.de.v.flag = { k: 'booleen', v: false }
  assert.equal(booleenDe(ev, expr, { f: 'banc.mjs', env: null }), false)
  expr.de.objetDirect = false
  assert.equal(booleenDe(ev, expr, { f: 'banc.mjs', env: null }), null)
  const cyclique = { fn: 'inner', args: [], params: [] }
  cyclique.parent = cyclique
  const c = forme(cyclique)
  assert.equal(typeof cle(c), 'string')
  assert.equal(cle(c), cle(c))
})

test('preuves scalaires : pile exacte, profondeur et réentrées dans les deux ordres', () => {
  const source = { exports: {}, etoiles: [], sites: [], fonctions: {
    decision: { params: [], retours: [{ k: 'garde', condition: { k: 'appel', cible: { k: 'fn', id: 'feuille' }, args: [] },
      attendu: true, de: { k: 'lit', v: 'src/autorisé' } }] },
    feuille: { params: [], retours: [{ k: 'booleen', v: false }] },
  } }
  for (let i = 0; i < 15; i++) source.fonctions['niveau' + i] = { params: [], retours: [
    { k: 'appel', cible: { k: 'fn', id: i === 14 ? 'decision' : 'niveau' + (i + 1) }, args: [] },
  ] }
  source.fonctions.boucle = { params: [{ nom: 'flag' }], retours: [{ k: 'garde',
    condition: { k: 'appel', cible: { k: 'fn', id: 'boucle' }, args: [{ k: 'negation', de: { k: 'param', fn: 'boucle', index: 0, nom: 'flag' } }] },
    attendu: true, de: { k: 'booleen', v: false } }] }
  const appel = (id) => ({ k: 'appel', cible: { k: 'fn', id }, args: [] })
  for (const ordre of [['decision', 'niveau0'], ['niveau0', 'decision']]) {
    const ev = evaluateurDuDepot({ lecture: () => source, cible: () => null })
    const resultats = tableTotale(ordre, (id) => ev.valeurs(appel(id), { f: 'banc.mjs', env: null }))
    assert.deepEqual(resultats.decision, [])
    assert.deepEqual(resultats.niveau0, [{ texte: 'src/autorisé' }])
    for (const v of [true, false, true]) {
      const e = { k: 'appel', cible: { k: 'fn', id: 'boucle' }, args: [{ k: 'booleen', v }] }
      assert.deepEqual(ev.valeurs(e, { f: 'banc.mjs', env: null }), [])
    }
  }
})

// #2586
test('observation des clés : le contexte Proxy public ne déclenche aucun piège', () => {
  const cible = { f: 'banc.mjs', env: null }
  let traps = 0
  const ctx = new Proxy(cible, { getOwnPropertyDescriptor(objet, nom) {
    traps++
    if (nom === 'env') objet.f = 'autre.mjs'
    return Reflect.getOwnPropertyDescriptor(objet, nom)
  } })
  const e = evaluateurDuDepot({ lecture: () => ({ fonctions: { f: { retours: [{ k: 'lit', v: 'src/a' }] } } }), cible: () => null })
  assert.deepEqual(e.valeurs({ k: 'appel', cible: { k: 'fn', id: 'f' }, args: [{ k: 'lit', v: 'src/a' }] }, ctx), [{ texte: 'src/a' }])
  assert.equal(traps, 0)
  assert.equal(cible.f, 'banc.mjs')
})

// #2586
test('clés canoniques : partition du JSON sur DAG partagé, réallocation, ordre, formes, provenance et cycles', async (t) => {
  const regimes = [{ ferme: false, clesStructurelles: false }, { ferme: false, clesStructurelles: true }, { ferme: true, clesStructurelles: true }]
  const partition = (observations, nom) => {
    const oracles = new Set(observations.map((o) => o.oracle))
    assert.ok(oracles.size > 1 && oracles.size < observations.length, `${nom} : la matrice porte des paires égales et distinctes`)
    for (let i = 0; i < observations.length; i++) for (let j = i + 1; j < observations.length; j++) {
      const [a, b] = [observations[i], observations[j]]
      if ((a.cle === b.cle) !== (a.oracle === b.oracle)) assert.fail(`${nom} : ${a.nom} / ${b.nom}, clés ${a.cle === b.cle ? 'égales' : 'distinctes'}`)
    }
  }
  const vueDe = (c, v, pile = []) => {
    if (v === null || typeof v !== 'object') return [typeof v, v]
    const forme = c.formesDesArguments.get(v)
    const depuis = pile.indexOf(v)
    if (depuis >= 0) return forme ? ['coupe', v.map((x) => vueDe(c, x, pile))] : ['cycle', pile.length - depuis]
    pile.push(v)
    const vue = forme ? ['argument', v.map((x) => vueDe(c, x, pile)), vueDe(c, forme.e, pile), forme.ctx.f, forme.ctx.env?.args ? vueDe(c, forme.ctx.env.args, pile) : null]
      : Array.isArray(v) ? ['liste', v.map((x) => vueDe(c, x, pile))]
      : ['objet', Object.keys(v).sort().map((nom) => [nom, vueDe(c, v[nom], pile)])]
    pile.pop()
    return vue
  }
  const vueDesArgs = (c, as, vus = []) => ['arguments', as.map((a) => {
    if (vus.includes(a)) return ['coupe', a.map((x) => vueDe(c, x))]
    const forme = c.formesDesArguments.get(a)
    vus.push(a)
    const vue = ['argument', a.map((x) => vueDe(c, x)), vueDe(c, forme?.e), forme?.ctx.f, forme?.ctx.env?.args ? vueDesArgs(c, forme.ctx.env.args, vus) : null]
    vus.pop()
    return vue
  })]
  const observerArgs = (c, nom, args) => ({ nom, cle: c.cleDesArgs(args), oracle: JSON.stringify(vueDesArgs(c, args)) })
  const observerValeur = (c, nom, v) => ({ nom, cle: c.cleDe(v), oracle: JSON.stringify(vueDe(c, v)) })
  const dag = (c, profondeur, variante = {}) => {
    let args = null
    for (let niveau = 0; niveau <= profondeur; niveau++) {
      const enfant = args
      args = Array.from({ length: 2 }, () => {
        const a = [{ texte: 'src/a' }]
        const expression = variante.forme && niveau === profondeur ? { k: 'liste', v: [{ k: 'lit', v: 'src/a' }] } : { k: 'lit', v: 'src/a' }
        c.formesDesArguments.set(a, { e: variante.lie ? { k: 'lie', de: expression, ctx: { f: 'banc.mjs', env: enfant ? { fn: 'f', args: enfant } : null } } : expression,
          ctx: { f: variante.module && niveau === profondeur ? 'autre.mjs' : 'banc.mjs', env: enfant ? { fn: 'f', args: enfant } : null } })
        return a
      })
    }
    return args
  }
  const arbre = (c, profondeur) => Array.from({ length: 2 }, () => {
    const a = [{ texte: 'src/a' }]
    c.formesDesArguments.set(a, { e: { k: 'lit', v: 'src/a' }, ctx: { f: 'banc.mjs', env: profondeur ? { fn: 'f', args: arbre(c, profondeur - 1) } : null } })
    return a
  })
  const lie = (c, forme, texte = 'src/a') => {
    const a = [{ texte }]
    c.formesDesArguments.set(a, { e: forme, ctx: { f: 'banc.mjs', env: null } })
    return [a]
  }
  const cycle = (c, texte) => {
    const a = [{ texte }]
    const args = [a]
    c.formesDesArguments.set(a, { e: { k: 'lit', v: texte }, ctx: { f: 'banc.mjs', env: { fn: 'f', args } } })
    return args
  }
  const lambda = (args) => ({ lambda: { id: 'lambda:1', sites: [], retours: [] }, ctx: { f: 'banc.mjs', env: { fn: 'f', args } } })
  for (const regime of regimes) {
    const nomDuRegime = JSON.stringify(regime)
    const c = clesCanoniques(regime)
    const args = []
    for (const profondeur of [0, 3, 6]) for (const variante of [{}, { forme: true }, { module: true }, { lie: true }]) for (const copie of [1, 2])
      args.push(observerArgs(c, `dag ${profondeur} ${JSON.stringify(variante)} #${copie}`, dag(c, profondeur, variante)))
    for (const profondeur of [0, 3, 6]) args.push(observerArgs(c, `arbre ${profondeur}`, arbre(c, profondeur)))
    const ordre = () => [[{ texte: 'src/a' }], [{ texte: 'docs/b' }]]
    args.push(observerArgs(c, 'ordre', ordre()), observerArgs(c, 'ordre #2', ordre()), observerArgs(c, 'ordre inverse', ordre().reverse()))
    for (const [nom, forme] of [['scalaire', { k: 'lit', v: 'src/a' }], ['liste', { k: 'liste', v: [{ k: 'lit', v: 'src/a' }] }], ['scalaire #2', { k: 'lit', v: 'src/a' }]])
      args.push(observerArgs(c, `forme ${nom}`, lie(c, forme)))
    for (const [nom, texte] of [['cycle', 'src/a'], ['cycle #2', 'src/a'], ['cycle docs', 'docs/b']]) args.push(observerArgs(c, nom, cycle(c, texte)))
    partition(args, `arguments ${nomDuRegime}`)
    const valeurs = [
      observerValeur(c, 'objet', { objet: { fichier: { k: 'lit', v: 'src/a' } }, ctx: { f: 'banc.mjs', env: null } }),
      observerValeur(c, 'objet #2', structuredClone({ objet: { fichier: { k: 'lit', v: 'src/a' } }, ctx: { f: 'banc.mjs', env: null } })),
      observerValeur(c, 'objet docs', { objet: { fichier: { k: 'lit', v: 'docs/a' } }, ctx: { f: 'banc.mjs', env: null } }),
      observerValeur(c, 'champs b,a', { objet: { b: 'x', a: 'y' }, ctx: { f: 'banc.mjs', env: null } }),
      observerValeur(c, 'champs a,b', { objet: { a: 'y', b: 'x' }, ctx: { f: 'banc.mjs', env: null } }),
      observerValeur(c, 'lambda scalaire', lambda(lie(c, { k: 'lit', v: 'src/a' }))),
      observerValeur(c, 'lambda liste', lambda(lie(c, { k: 'liste', v: [{ k: 'lit', v: 'src/a' }] }))),
      observerValeur(c, 'lambda scalaire #2', lambda(lie(c, { k: 'lit', v: 'src/a' }))),
    ]
    if (!regime.ferme) for (const [nom, fabriquer] of [['boucle grand-parent', () => { const o = {}; o.a = { b: o }; return o }],
      ['boucle parent', () => { const o = {}; const a = {}; a.b = a; o.a = a; return o }], ['boucle grand-parent #2', () => { const o = {}; o.a = { b: o }; return o }]])
      valeurs.push(observerValeur(c, nom, { objet: fabriquer(), ctx: { f: 'banc.mjs', env: null } }))
    partition(valeurs, `valeurs ${nomDuRegime}`)
    const profond = c.texteDeCle(c.cleDesArgs(dag(c, 32)))
    assert.equal(c.texteDeCle(c.cleDesArgs(dag(c, 32))), profond)
    assert.notEqual(c.texteDeCle(c.cleDesArgs(dag(c, 32, { forme: true }))), profond)
    assert.ok(profond.length < 5 * c.texteDeCle(c.cleDesArgs(dag(c, 8))).length, nomDuRegime)
    if (regime.ferme) continue
    const repetes = dag(c, 4)
    const enfant = c.formesDesArguments.get(repetes[0]).ctx.env.args
    const formeEnfant = c.formesDesArguments.get(enfant[0])
    const etats = []
    const noter = (nom) => etats.push(observerArgs(c, nom, repetes))
    noter('initial')
    const forme = c.formesDesArguments.get(repetes[0])
    forme.e.v = 'docs/mutation'
    noter('expression mutée')
    forme.e.v = 'src/a'
    noter('expression rétablie')
    forme.ctx.f = 'autre.mjs'
    noter('module muté')
    forme.ctx.f = 'banc.mjs'
    c.formesDesArguments.set(enfant[0], { ...formeEnfant, e: { k: 'liste', v: [formeEnfant.e] } })
    noter('forme d’enfant réallouée')
    c.formesDesArguments.set(enfant[0], formeEnfant)
    noter('forme d’enfant rétablie')
    enfant[0][0].texte = 'docs/enfant'
    noter('valeur d’enfant mutée')
    enfant[0][0].texte = 'src/a'
    noter('valeur d’enfant rétablie')
    partition(etats, `mutations ${nomDuRegime}`)
    if (regime.clesStructurelles) continue
    let provenance = 'banc.mjs'
    const dynamique = () => {}
    dynamique.toJSON = () => provenance
    const fournisseurs = []
    for (const [nom, f] of [['fonction', dynamique], ['objet', { toJSON: () => provenance }]]) {
      const a = [{ texte: 'src/a' }]
      c.formesDesArguments.set(a, { e: { k: 'lit', v: 'src/a' }, ctx: { f, env: null } })
      for (const valeur of ['banc.mjs', 'autre.mjs', 'banc.mjs']) {
        provenance = valeur
        fournisseurs.push(observerArgs(c, `${nom} ${valeur}`, [a]))
      }
    }
    let contenu = 'src/a'
    const accesseur = { objet: { get texte() { return contenu } } }
    for (const valeur of ['src/a', 'docs/mutation', 'src/a']) {
      contenu = valeur
      fournisseurs.push(observerValeur(c, `accesseur ${valeur}`, accesseur))
    }
    partition(fournisseurs.slice(0, 6), 'provenance toJSON')
    partition(fournisseurs.slice(6), 'accesseur')
  }
  const fonction = () => {}
  const avecJSON = () => {}
  avecJSON.toJSON = () => 'fonction'
  const creux = tableauCreux()
  assert.equal(creux.length, 2)
  assert.equal(Object.hasOwn(creux, 0), false)
  const descripteurs = [-0, 0, NaN, Infinity, null, undefined, fonction, Symbol('s'), avecJSON, 'fonction', { b: 2, a: 1 }, { a: 1, b: 2 },
    { a: undefined, b: fonction, c: null }, { c: null }, creux, [null, 1], [1, null], '\\u0000"[]{}', { toJSON: () => ({ b: 2, a: 1 }) },
    'S3:L;', 'L;', 'N7;', '7', 7, [7], { a: 7 }, [['a', 7]], [8], [], {}, true, 'B1;', new Proxy(['enfant', 7], {}), ['enfant', 7]]
  const projection = (c, ds) => c.cleCanonique(({ interner }) => ds.map(interner), null, null)
  const paires = (c) => descripteurs.flatMap((x, i) => descripteurs.map((y, j) => ({ nom: `${i},${j}`, cle: projection(c, [['d', x], ['d', y]]), oracle: JSON.stringify([['d', x], ['d', y]]) })))
  for (const regime of regimes) partition(paires(clesCanoniques(regime)), `projection ${JSON.stringify(regime)}`)
  const circulaire = {}
  circulaire.a = circulaire
  const tableauCirculaire = []
  tableauCirculaire.push(tableauCirculaire)
  for (const regime of regimes) for (const d of [1n, circulaire, tableauCirculaire]) {
    assert.throws(() => JSON.stringify([['d', d]]), TypeError)
    assert.throws(() => projection(clesCanoniques(regime), [['d', d]]), TypeError)
  }
  t.diagnostic('Partition des clés = partition du JSON : arguments, valeurs, mutations, provenance, accesseur et projections, dans chaque régime atteignable')
})


// #2586
test('image Git déclarée : nouveau producteur, alias et même sélecteur canonique', () => {
  const modules = { 'porte.mjs': "export function nouveau(){return opaque()};export function listerImage(){return opaque()};export const CONTRATS_DE_DERIVATION=[{fonction:nouveau,retour:{type:'collection',element:{type:'imageGit',porte:'listerImage'}}},{fonction:listerImage,retour:{type:'collection',element:{type:'imageGit',porte:'listerImage'}}}]",
    'b.mjs': "import {nouveau as autre,listerImage as canon} from './porte.mjs';readFileSync(autre('','HEAD','src/a','docs/b'));readFileSync(canon('','HEAD','src/a','docs/b'));readFileSync(autre('','HEAD',opaque()))" }
  const e = evaluateurDe(modules)
  const trace = e.tracer(() => e.sitesDe('b.mjs'))
  assert.deepEqual(e.tracer(() => e.sitesDe('b.mjs')), trace)
  const racines = trace.resultat.filter((s) => !s.relais && s.appel === 'readFileSync').map((s) => s.valeurs)
  assert.deepEqual(racines[0], [{ chemin: 'src/a', sous: 'image Git : tHEAD' }, { chemin: 'docs/b', sous: 'image Git : tHEAD' }])
  assert.deepEqual(racines[1], racines[0])
  assert.match(racines[2][0].sous, /couverture corpus entier.*porte.mjs#nouveau/)
  const lot = { 'porte.mjs': "export function nouveau(){return opaque()};export const CONTRATS_DE_DERIVATION=[{fonction:nouveau,retour:{type:'collection',element:{type:'imageGit',porte:'lireEnLot'}}}]",
    'b.mjs': "import {nouveau as lire} from './porte.mjs';readFileSync(lire('','HEAD',['src/a','docs/b'],opaque()))" }
  assert.deepEqual(racinesDe(lot, 'b.mjs'), [[{ chemin: 'src/a', sous: 'image Git : tHEAD' }, { chemin: 'docs/b', sous: 'image Git : tHEAD' }]])
})

// #2586
test('hôte Git : lectures et retours gardent les options directes et aliasées', () => {
  const source = readFileSync(new URL('./gitPorte.mjs', import.meta.url), 'utf8')
  for (const options of ['', ',{}', ",{env:{GIT_DIR:'hors'}}", ',opaque()']) {
    const modules = { 'git.mjs': source,
      'b.mjs': `import {depotDe,listerImage as liste} from './git.mjs';const h=depotDe(''${options});const alias=h;const a=liste(h,'HEAD','src/a');const b=liste(alias,'HEAD','src/a');readFileSync(a);readFileSync(b)` }
    const e = evaluateurDe(modules)
    const trace = e.tracer(() => e.sitesDe('b.mjs'))
    assert.deepEqual(e.tracer(() => e.sitesDe('b.mjs')), trace)
    const sites = trace.resultat.filter((s) => !s.relais)
    const lectures = sites.filter((s) => s.appel === 'listerImage').map((s) => s.valeurs)
    const retours = sites.filter((s) => s.appel === 'readFileSync').map((s) => s.valeurs)
    assert.equal(lectures.length, 2)
    assert.equal(retours.length, 2)
    for (const xs of [...lectures, ...retours]) {
      if (options) {
        assert.equal(xs.some((x) => x.chemin === 'src/a'), false)
        assert.match(xs[0].sous, /couverture corpus entier.*options de poignée sans hôte prouvé/)
      } else assert.equal(xs[0].chemin, 'src/a')
    }
  }
})
// #2586
test('formes liées : deux ordres, cache, alias et requêtes rejouées', () => {
  for (const ordre of [['scalaire', 'collection'], ['collection', 'scalaire']]) {
    const modules = { 'p.mjs': 'export function lire(x){readFileSync(String(x))}',
      'b.mjs': "import {lire as relai} from './p.mjs';" + ordre.map((x) => `relai(${x === 'scalaire' ? "'src/a'" : "['src/a']"})`).join(';') }
    const e = evaluateurDe(modules)
    const a = e.tracer(() => e.sitesDe('b.mjs'))
    assert.deepEqual(a, e.tracer(() => e.sitesDe('b.mjs')))
    assert.deepEqual(a.resultat.filter((s) => !s.relais).map((s) => s.valeurs),
      ordre.map((x) => x === 'scalaire' ? [{ chemin: 'src/a' }] : [{ non: 'conversion String non scalaire' }]))
    assert.ok(a.requetes.has(JSON.stringify(['lecture', 'p.mjs'])))
    const local = { 'b.mjs': 'function relai(x){readFileSync(String(x))};' + ordre.map((x) => `relai(${x === 'scalaire' ? "'src/a'" : "['src/a']"})`).join(';') }
    assert.deepEqual(racinesDe(local, 'b.mjs'), ordre.map((x) => x === 'scalaire' ? [{ chemin: 'src/a' }] : [{ non: 'conversion String non scalaire' }]))
  }
})

// #2586
test('retour de paramètres : tuples, colonnes et String sans cellules parasites', () => {
  const modules = { 'p.mjs': 'export function identite(x){return x}',
    'b.mjs': "import {identite as rendre} from './p.mjs';const t=[['src/a','docs/b'],['src/c','docs/d']];readFileSync(rendre(t).map(String));for(const [p,q] of rendre(t)){readFileSync(p);readFileSync(q)}" }
  assert.deepEqual(racinesDe(modules, 'b.mjs'), [[{ non: 'conversion String non scalaire' }],
    [{ chemin: 'src/a' }, { chemin: 'src/c' }], [{ chemin: 'docs/b' }, { chemin: 'docs/d' }]])
})

// #2586
test('preuve de branche : mutation, défaut, getter et étalement', () => {
  for (const [fonction, argument] of [
    ["function choisir(o){o.types=true;if(o.types)return 'docs/b';return 'src/a'}", '{types:false}'],
    ["function choisir(o={types:false}){o.types=true;if(o.types)return 'docs/b';return 'src/a'}", ''],
    ["function choisir({types=false}){if(types)return 'docs/b';return 'src/a'}", '{get types(){return true}}'],
    ["function choisir(o){if(o.types)return 'docs/b';return 'src/a'}", '{...opaque(),types:false}'],
  ]) {
    const r = racinesDe({ 'b.mjs': fonction + `;readFileSync(choisir(${argument}))` }, 'b.mjs')[0]
    assert.ok(r.some((x) => x.chemin === 'docs/b'), JSON.stringify(r))
    assert.ok(r.some((x) => x.chemin === 'src/a'), JSON.stringify(r))
  }
})

// #2586
test('souillure par champ statique : une écriture de x.a ne souille pas la lecture de x.b', () => {
  assert.deepEqual(racinesDe({ 'b.mjs': "const p={snapshot:'src/a',installe:false};p.installe=true;readFileSync(p.snapshot)" }, 'b.mjs'), [[{ chemin: 'src/a' }]])
})

// #2586
test('souillure par champ : un champ calculé ou le champ lu lui-même gardent la liaison opaque', () => {
  for (const ecriture of ['p[process.argv[2]]=true', "p.snapshot='docs/b'"]) {
    const r = racinesDe({ 'b.mjs': "const p={snapshot:'src/a',installe:false};" + ecriture + ";readFileSync(p.snapshot)" }, 'b.mjs')[0]
    assert.ok(r.some((x) => x.non === 'p réaffectée'), JSON.stringify(r))
  }
})

// #2586
const casDeProvenance = (a = 'a.mjs', b = 'b.mjs') => [
  ['opaque', {
    [a]: "export const ROOTS=['src/a']; export function scan(roots){return roots.flatMap(root=>[root])}",
    [b]: "import {ROOTS,scan} from './a.mjs'; function run({roots=ROOTS}={}){const inventory=()=>scan(roots);return inventory()};for(const p of run())readFileSync(p)",
  }],
  ['descendre', {
    [a]: "export const ROOT='src/a'; export function scan(rows){return rows.flat()}",
    [b]: "import {ROOT,scan} from './a.mjs';for(const p of scan([[ROOT]]))readFileSync(p)",
  }],
  ['niveau', {
    [a]: "export const ROOT='src/a'; export function scan(row){return [row].flat()}",
    [b]: "import {ROOT,scan} from './a.mjs';readFileSync(scan([ROOT]))",
  }],
]
for (const [frontiere, sources] of casDeProvenance()) test(`provenance entre modules : ${frontiere}`, () => {
  const lectures = Object.entries(sources).map(([f, texte]) => [f, lire(f, texte)])
  const resolutions = [['b.mjs', './a.mjs', 'a.mjs']]
  const questions = [{ nature: 'sitesDe', f: 'b.mjs' }]
  const entree = { lectures: lectures.map(([f, lu]) => [f, encoderLecture(lu)]), resolutions, lecteurs: Object.keys(sources), questions }
  let attendu
  for (let allocation = 0; allocation < 2; allocation++) {
    const modules = new Map(allocation ? JSON.parse(JSON.stringify(lectures)) : lectures)
    const ev = evaluateurDuDepot({ lecture: (f) => modules.get(f) ?? null,
      cible: (f, spec) => {
        assert.deepEqual([f, spec], ['b.mjs', './a.mjs'])
        return 'a.mjs'
      }, peutLire: (f) => modules.has(f), clesStructurelles: true })
    for (let tour = 0; tour < 2; tour++) {
      const { resultat, requetes } = ev.tracer(() => ev.sitesDe('b.mjs'))
      assert.deepEqual(resultat.filter((s) => !s.relais).map((s) => s.valeurs), [[{ chemin: 'src/a' }]])
      const publicVu = [{ ...questions[0], resultat, requetes: [...requetes].sort() }]
      attendu ??= publicVu
      assert.deepEqual(publicVu, attendu)
      const fermeVu = evaluerLot(entree)
      assert.deepEqual(fermeVu.map((r) => ({ ...r, requetes: r.requetes.sort() })), attendu)
    }
  }
})

// #2586
test('flat natif : niveau unique, paramètre, vide, opaque et méthode remplacée', () => {
  const modules = { 'b.mjs': "function identite(x){return x};readFileSync([[['src/a','docs/b']]].flat().map(String));readFileSync([identite(['src/a'])].flat().map(String));readFileSync([].flat().map(String));readFileSync([['src/a'],opaque()].flat().map(String));readFileSync([['src/a']].flat(inconnu()).map(String));const a=['src/a'];a.flat=()=>['docs/b'];readFileSync(a.flat().map(String))" }
  assert.deepEqual(racinesDe(modules, 'b.mjs'), [[{ non: 'conversion String non scalaire' }], [{ chemin: 'src/a' }],
    [{ chemin: 'src/a' }, { non: 'appel opaque' }], [{ non: 'profondeur flat non prouvée' }], [{ non: 'méthode flat mutée' }]])
})

// #2586
test('readdir : noms, Dirent, Buffer, options inconnues et homonyme', () => {
  const prefixe = "import {readdirSync as liste} from 'node:fs';import {join} from 'node:path';"
  const modules = { 'b.mjs': prefixe + "for(const n of liste('src')){readFileSync(n);readFileSync(join('src',n));readFileSync(join('docs',n));readFileSync(n.name)};for(const d of liste('src',{withFileTypes:true})){readFileSync(join('src',d.name));readFileSync(d.extra)};for(const b of liste('src',{encoding:'buffer'}))readFileSync(b);for(const u of liste('src',opaque()))readFileSync(u);function readdirSync(){return opaque()};for(const n of readdirSync('src'))readFileSync(n)" }
  const r = racinesDe(modules, 'b.mjs').filter((xs) => !xs.some((x) => x.chemin === 'src' && !x.sous))
  assert.deepEqual(r[0], [{ non: 'fragment de répertoire sans sa base' }])
  assert.ok(r[1][0].sous.includes('corpus:src'))
  assert.deepEqual(r[2], [{ non: 'fragment de répertoire hors de sa base' }])
  assert.ok(r[3][0].non)
  assert.ok(r[4][0].sous.includes('corpus:src'))
  assert.ok(r[5][0].non)
  assert.ok(r[6][0].non.includes('Buffer'))
  assert.ok(r[7][0].non.includes('indéterminées'))
  assert.ok(r.at(-1)[0].non)
})

// #2586
test('contrat Source N+1 : collection abstraite et objet partiel', () => {
  const contrat = "export const CONTRATS_DE_DERIVATION=[{fonction:nouveau,retour:{type:'collection',element:{type:'objetPartiel',champs:{fichier:{type:'chaine'}}}}}]"
  const modules = { 'n.mjs': 'export function nouveau(){return opaque()};' + contrat,
    'b.mjs': "import {nouveau as lire} from './n.mjs';for(const x of lire()){readFileSync(x.fichier);readFileSync(x.extra)};readFileSync(lire().map(String))" }
  const r = racinesDe(modules, 'b.mjs')
  assert.deepEqual(r[0], [couvert('n.mjs#nouveau:retour[].fichier', 'chaîne sans borne déclarée à la source')])
  assert.match(r[1][0].non, /propriété/)
  assert.deepEqual(r[2], [{ non: 'conversion String non scalaire' }])
})

// #2586
test('sélection réelle : tuple de paramètre importé', async () => {
  const colonne = posix.join('docs', 'b.md')
  const { racine, sha } = instanceDeDepot({ fichiers: {
    'p.mjs': 'export function identite(x){return x}',
    'scripts/banc.test.mjs': `import {readFileSync} from 'node:fs';import {identite} from '../p.mjs';for(const [p] of identite([['src/a.md',${JSON.stringify(colonne)}]]))readFileSync(p)`,
    'src/a.md': 'avant', [colonne]: 'colonne',
  } })
  try {
    writeFileSync(posix.join(racine, 'src/a.md'), 'après')
    assert.ok((await perimetreDuDepot(racine, { base: sha })).retenus.has('scripts/banc.test.mjs'))
  } finally { rmSync(racine, { recursive: true, force: true }) }
})

// #2586
test('Git Source : poignée opaque, enfant, images, pathspecs et racine nullable', () => {
  const source = readFileSync(new URL('./gitPorte.mjs', import.meta.url), 'utf8')
  const modules = { 'git.mjs': source, 'b.mjs': "import {depotDe,listerImage,racineDe} from './git.mjs';export const a=listerImage(depotDe('.'),'HEAD','src');export const b=listerImage(depotDe('.'),'INDEX','docs');export const c=listerImage(depotDe('sous'),'HEAD','src');export const d=listerImage(opaque(),'HEAD','src');export const e=listerImage(depotDe('.'),opaque(),'src');export const f=listerImage(depotDe('.'),'HEAD',opaque());export const g=listerImage(depotDe('.'),'HEAD','../hors');export const r=racineDe(depotDe('sous'));export const p=depotDe('.',{env:opaque()})" }
  const e = evaluateurDe(modules)
  const lu = lire('b.mjs', modules['b.mjs'])
  const valeur = (nom) => e.valeurs(lu.exports[nom], { f: 'b.mjs', env: null })
  assert.equal(valeur('a')[0].chemin, 'src')
  assert.equal(valeur('b')[0].chemin, 'docs')
  assert.notEqual(valeur('a')[0].sous, valeur('b')[0].sous)
  for (const nom of ['c','d','e','f','g']) assert.ok(valeur(nom)[0].couvertureCorpusEntier, nom)
  const r = valeur('r')
  assert.ok(r.some((x) => x.couvertureCorpusEntier))
  assert.ok(r.some((x) => x.non === 'valeur nulle'))
  assert.equal(r.some((x) => x.chemin === 'sous'), false)
  assert.ok(valeur('p')[0].poignee)
  assert.ok(valeur('p')[0].options.length)
  const trace = e.tracer(() => valeur('r'))
  assert.deepEqual(trace, e.tracer(() => valeur('r')))
})

// #2586
test('descripteurs Source : argument, champ et arguments restants', () => {
  const modules = { 'p.mjs': "export function champ(x){return opaque()};export function reste(...x){return opaque()};export const CONTRATS_DE_DERIVATION=[{fonction:champ,retour:{type:'argument',argument:0,champs:['fichier']}},{fonction:reste,retour:{type:'collection',element:{type:'reste',argument:0}}}]",
    'b.mjs': "import {champ,reste} from './p.mjs';readFileSync(champ({fichier:'src/a'}));readFileSync(reste('src/a','docs/b').map(String))" }
  assert.deepEqual(racinesDe(modules, 'b.mjs'), [[{ chemin: 'src/a' }], [{ chemin: 'src/a' }, { chemin: 'docs/b' }]])
})

// #2586
test('paramètre rest : forme de liste et tuples préservés', () => {
  const modules = { 'b.mjs': "function liste(...xs){return xs};readFileSync(liste('src/a','docs/b').map(String));readFileSync(liste(['src/a','docs/b']).map(String));readFileSync(liste().map(String))" }
  assert.deepEqual(racinesDe(modules, 'b.mjs'), [[{ chemin: 'src/a' }, { chemin: 'docs/b' }], [{ non: 'conversion String non scalaire' }]])
})

// #2586
test('noms de répertoire : String préserve la provenance du fragment', () => {
  const modules = { 'b.mjs': "import {readdirSync} from 'node:fs';import {join} from 'node:path';for(const n of readdirSync('src').map(String))readFileSync(join('src',n))" }
  assert.deepEqual(racinesDe(modules, 'b.mjs'), [[{ chemin: 'src' }], [couvert('corpus:src', 'descente par fragment de namespace susceptible de lien')]])
})

const ROOT = "import { join } from 'node:path'\nimport { fileURLToPath } from 'node:url'\nimport { readdirSync, readFileSync, existsSync, mkdtempSync } from 'node:fs'\nconst ROOT = fileURLToPath(new URL('../..', import.meta.url))\n"
const couvert = (origine, raison) => ({ chemin: '', sous: `couverture corpus entier : ${origine} — ${raison}` })
const couvertureTemporaire = couvert('node:os#tmpdir', 'répertoire temporaire dépendant de l’environnement')

// #2586
test('retours gardés : options directes, défauts, objets et domaine indécidable', () => {
  const choisir = "export function choisir({types=false}={}) { if(!types) return ['src/a']; return {entrees:['docs/b']} }"
  const modules = (corps) => ({ 'options.mjs': choisir, 'banc.mjs': "import {choisir} from './options.mjs'; " + corps })
  for (const argument of ['', '{}', '{autre:true}', '{types:false}'])
    assert.deepEqual(racinesDe(modules(`readFileSync(choisir(${argument}))`), 'banc.mjs'), [[{ chemin: 'src/a' }]], argument)
  assert.deepEqual(racinesDe(modules('readFileSync(choisir({types:true})); readFileSync(choisir({types:true}).entrees)'), 'banc.mjs'), [[{ non: 'racine non chemin' }], [{ chemin: 'docs/b' }]])
  for (const argument of ['{types:inconnu()}', '{...opaque()}', 'o']) {
    const source = argument === 'o' ? 'const o={types:false}; o.types=true; ' : ''
    assert.deepEqual(racinesDe(modules(source + `readFileSync(choisir(${argument}))`), 'banc.mjs'), [[{ chemin: 'src/a' }, { non: 'racine non chemin' }]], argument)
  }
  assert.deepEqual(racinesDe(modules('const o={types:false}; modifier(o); readFileSync(choisir(o))'), 'banc.mjs'), [[{ chemin: 'src/a' }, { non: 'racine non chemin' }]])
})

// #2586
test('preuve d’objet : usages exposés conservent les branches sur sites et valeurs', () => {
  const concrete = []
  runInNewContext("function muter(o){o.flag=false};function choisir(o){muter(o);if(o.flag)return 'src/a';return 'docs/b'};readFileSync(choisir({flag:true}))", { readFileSync: (p) => concrete.push(p) })
  assert.deepEqual(concrete, ['docs/b'])
  const cas = [
    ['appel local', 'function muter(o){o.flag=false}', 'muter(o);'],
    ['appel importé', "import {muter} from './muter.mjs';", 'muter(o);'],
    ['appel inconnu', '', 'inconnu(o);'],
    ['récepteur', '', 'o.muter();'],
    ['alias appelé', 'function muter(o){o.flag=false}', 'const alias=o;muter(alias);'],
    ['alias écrit', '', 'const alias=o;alias.flag=false;'],
    ['stockage', '', 'const boite={o};boite.o.flag=false;'],
    ['capture', '', 'const changer=()=>{o.flag=false};changer();'],
    ['référence imbriquée', '', 'const alias=o.enfant;alias.flag=false;'],
    ['alias logique', '', 'const alias=o || {};alias.flag=false;'],
    ['alias conditionnel', '', 'const alias=inconnu()?o:{};alias.flag=false;'],
    ['alias virgule', '', 'const alias=(0,o);alias.flag=false;'],
    ['argument logique', '', 'inconnu(o && o);'],
  ]
  for (const [nom, avant, usage] of cas) {
    const source = `${avant};export function choisir(o){${usage}if(o.flag)return 'src/a';return 'docs/b'};readFileSync(choisir({flag:true}))`
    const modules = { 'banc.mjs': source, 'muter.mjs': 'export function muter(o){o.flag=false}' }
    const e = evaluateurDe(modules)
    const site = lire('banc.mjs', source).sites.find((s) => s.lecture === 'readFileSync')
    assert.deepEqual(e.sitesDe('banc.mjs').filter((s) => !s.relais).map((s) => s.valeurs), [[{ chemin: 'src/a' }, { chemin: 'docs/b' }]], nom)
    assert.deepEqual(e.valeurs(site.args[0], { f: 'banc.mjs', env: null }), [{ texte: 'src/a' }, { texte: 'docs/b' }], nom)
  }
})

// #2586
test('preuve d’objet : membres opaques présents ne deviennent pas absents', () => {
  const concrete = []
  runInNewContext("function choisir({flag=false}={}){if(flag)return 'src/a';return 'docs/b'};readFileSync(choisir({flag(){}}))", { readFileSync: (p) => concrete.push(p) })
  assert.deepEqual(concrete, ['src/a'])
  for (const membre of ['flag(){}', 'set flag(v){}', '[inconnu()](){}', 'get [inconnu()](){}']) {
    const modules = { 'banc.mjs': `function choisir({flag=false}={}){if(flag)return 'src/a';return 'docs/b'};readFileSync(choisir({${membre}}))` }
    assert.deepEqual(racinesDe(modules, 'banc.mjs'), [[{ chemin: 'src/a' }, { chemin: 'docs/b' }]], membre)
    const e = evaluateurDe(modules), site = lire('banc.mjs', modules['banc.mjs']).sites.find((s) => s.lecture === 'readFileSync')
    assert.deepEqual(e.valeurs(site.args[0], { f: 'banc.mjs', env: null }), [{ texte: 'src/a' }, { texte: 'docs/b' }], membre)
  }
})

// #2586
test('preuve d’objet : lectures seules, homonymes et scalaires restent spécialisés', () => {
  const source = "function autre(o){inconnu(o)};function choisir(o){if(o.flag)return 'src/a';return 'docs/b'};function scalaire(flag){inconnu(flag);const alias=flag;if(flag)return 'src/a';return 'docs/b'};readFileSync(choisir({flag:true}));readFileSync(scalaire(true));readFileSync(scalaire(false));const lambda=(o)=>{inconnu(o);if(o.flag)return 'src/a';return 'docs/b'};readFileSync(lambda({flag:true}));function defaut(o={flag:true}){inconnu(o);if(o.flag)return 'src/a';return 'docs/b'};readFileSync(defaut())"
  assert.deepEqual(racinesDe({ 'banc.mjs': source }, 'banc.mjs'), [[{ chemin: 'src/a' }], [{ chemin: 'src/a' }], [{ chemin: 'docs/b' }], [{ chemin: 'src/a' }, { chemin: 'docs/b' }], [{ chemin: 'src/a' }, { chemin: 'docs/b' }]])
})

// #2586
test('retours gardés : continuation certaine seulement, ternaires et lambdas', () => {
  const modules = { 'banc.mjs': "function choisir(flag) { if(flag){if(inconnu()) return 'src/a'} return 'src/b' } readFileSync(choisir(true)); const autre=(flag=false)=>flag?'docs/vrai':'src/faux'; readFileSync(autre()); readFileSync(autre(true)); function appliquer(callback,flag){return callback(flag)} readFileSync(appliquer((flag=false)=>{if(!flag) return 'src/lambda'; return 'docs/lambda'},false)); readFileSync(appliquer((flag=false)=>{if(!flag) return 'src/lambda'; return 'docs/lambda'},true))" }
  assert.deepEqual(racinesDe(modules, 'banc.mjs'), [[{ chemin: 'src/a' }, { chemin: 'src/b' }], [{ chemin: 'src/faux' }], [{ chemin: 'docs/vrai' }], [{ chemin: 'src/lambda' }], [{ chemin: 'docs/lambda' }]])
  assert.deepEqual(racinesDe({ 'banc.mjs': "function choisir(flag){if(flag){return 'src/a'}else{return 'src/b'} return 'docs/impossible'} readFileSync(choisir(true)); readFileSync(choisir(false)); readFileSync(choisir(inconnu()))" }, 'banc.mjs'), [[{ chemin: 'src/a' }], [{ chemin: 'src/b' }], [{ chemin: 'src/a' }, { chemin: 'src/b' }]])
})

// #2586
test('projection String : liaison native, rappels résolus et homonymes opaques', () => {
  const modules = { 'banc.mjs': "readFileSync(['src/a'].map(String)); readFileSync(['src/b'].map(x=>String(x))); function nomme(x){return 'docs/nomme'} readFileSync(['src/a'].map(nomme)); function masque(String){return ['src/a'].map(String)} readFileSync(masque(inconnu())); {const String=opaque(); readFileSync(['src/a'].map(String))}" }
  assert.deepEqual(racinesDe(modules, 'banc.mjs'), [[{ chemin: 'src/a' }], [{ chemin: 'src/b' }], [{ chemin: 'docs/nomme' }], [{ non: 'rappel String non résolu' }], [{ non: 'rappel String non résolu' }]])
  assert.deepEqual(racinesDe({ 'autre.mjs': 'export const String = opaque()', 'banc.mjs': "import {String} from './autre.mjs'; readFileSync(['src/a'].map(String))" }, 'banc.mjs'), [[{ non: 'rappel String non résolu' }]])
  assert.deepEqual(racinesDe({ 'autre.mjs': "export function rappel(){return 'docs/importe'}", 'banc.mjs': "import {rappel} from './autre.mjs'; readFileSync(['src/a'].map(rappel))" }, 'banc.mjs'), [[{ chemin: 'docs/importe' }]])
})

// #2586
test('projection String : opacité conservée, vide, tuples, objets et null converti', () => {
  const modules = { 'banc.mjs': "const c=choix?['src/a']:opaque(); readFileSync(c.map(String)); readFileSync([].map(String)); readFileSync([['src/a','colonne/b']].map(String)); readFileSync([['src/a','colonne/b']].map(x=>String(x))); readFileSync([{p:'src/a'}].map(String)); readFileSync([null].map(String)); readFileSync([false,42].map(String))" }
  assert.deepEqual(racinesDe(modules, 'banc.mjs'), [[{ chemin: 'src/a' }, { non: 'appel opaque' }], [{ non: 'conversion String non scalaire' }], [{ non: 'conversion String non scalaire' }], [{ non: 'conversion String non scalaire' }], [{ non: 'conversion String de valeur nulle' }], [{ chemin: 'false' }, { chemin: '42' }]])
  const intermodule = { 'table.mjs': "export function table(flag=false){if(flag)return opaque();return [['src/a','colonne/b']]}", 'banc.mjs': "import {table} from './table.mjs'; readFileSync(table().map(String)); readFileSync(table(true).map(String)); function identite(x){return x} readFileSync(table().map(identite))" }
  assert.deepEqual(racinesDe(intermodule, 'banc.mjs'), [[{ non: 'conversion String non scalaire' }], [{ non: 'appel opaque' }], [{ non: 'élément de rappel non scalaire' }]])
  const champs = { 'table.mjs': "export function table(){return [['src/a','colonne/b']]}", 'banc.mjs': "import {table} from './table.mjs'; const o={entrees:[['src/a','colonne/b']]}; readFileSync(o.entrees.map(String)); readFileSync(o.entrees.map(x=>String(x))); readFileSync(String(table())); function convertir(x){return String(x)} readFileSync(convertir(['src/a','colonne/b'])); readFileSync(String(o.entrees)); readFileSync({entrees:['src/a']}.entrees.map(String))" }
  assert.deepEqual(racinesDe(champs, 'banc.mjs'), [...Array.from({ length: 5 }, () => [{ non: 'conversion String non scalaire' }]), [{ chemin: 'src/a' }]])
  assert.deepEqual(racinesDe({ 'banc.mjs': "readFileSync(false); readFileSync(42); readFileSync(String); readFileSync(join('src',false)); readFileSync(join('src',42)); readFileSync(join('src',String))" }, 'banc.mjs'), Array.from({ length: 6 }, () => [{ non: 'racine non chemin' }]))
})

// #2586
test('retours gardés : arguments booléens distincts, traçage répété et source renouvelée', () => {
  const modules = { 'options.mjs': "export function choisir(flag=false){if(flag)return 'docs/vrai';return 'src/faux'}", 'banc.mjs': "import {choisir} from './options.mjs'; readFileSync(choisir(false)); readFileSync(choisir(true)); readFileSync(choisir(false))" }
  const e = evaluateurDe(modules)
  const a = e.tracer(() => e.sitesDe('banc.mjs'))
  const b = e.tracer(() => e.sitesDe('banc.mjs'))
  assert.deepEqual(a.resultat, b.resultat)
  assert.deepEqual([...a.requetes].sort(), [...b.requetes].sort())
  assert.ok(a.requetes.has(JSON.stringify(['lecture', 'options.mjs'])))
  assert.deepEqual(racinesDe(modules, 'banc.mjs'), [[{ chemin: 'src/faux' }], [{ chemin: 'docs/vrai' }], [{ chemin: 'src/faux' }]])
  modules['options.mjs'] = "export function choisir(flag=false){if(flag)return 'docs/neuf';return 'src/neuf'}"
  assert.deepEqual(racinesDe(modules, 'banc.mjs'), [[{ chemin: 'src/neuf' }], [{ chemin: 'docs/neuf' }], [{ chemin: 'src/neuf' }]])
  assert.match(racinesDe({ 'banc.mjs': 'function boucle(flag){return boucle(!flag)} readFileSync(boucle(false))' }, 'banc.mjs')[0][0].non, /^cycle d’appels|^cycle d'appels/)
})

test('arguments de rappel : lecture liée au dir fourni, lecture de propriété fournie et paramètre non lié conservé', () => {
  const modules = {
    'helpers.mjs': "import {readFileSync} from 'node:fs'; export function dans(corps) { return corps('donnees') }; const lire = (chemin) => readFileSync(chemin); const DISQUE = {lire}; export function lirePar(chemin, disque = DISQUE) { return disque.lire(chemin) }",
    'banc.mjs': "import {readFileSync} from 'node:fs'; import {dans,lirePar} from './helpers.mjs'; dans((dir) => readFileSync(dir + '/a.json')); lirePar('donnees/b.json'); test((dir) => readFileSync(dir + '/sans.json'));",
  }
  assert.deepEqual(racinesDe(modules, 'banc.mjs'), [
    [{ chemin: 'donnees/a.json' }], [{ chemin: 'donnees/b.json' }], [{ non: 'paramètre dir' }],
  ])
})

test('tuple littéral conditionnel : indice connu résolu, tableau opaque reste non résolu', () => {
  const modules = { 'banc.mjs': "import {readFileSync} from 'node:fs'; const [racine] = choix ? ['donnees/une',[]] : choix2 ? ['donnees/deux',[]] : [null,[]]; readFileSync(racine + '/memory.stat'); const [inconnu] = opaque(); readFileSync(inconnu); const [,,indice = 'donnees/trois'] = [0,0]; readFileSync(indice)" }
  assert.deepEqual(racinesDe(modules, 'banc.mjs'), [[{ chemin: 'donnees/une/memory.stat' }, { chemin: 'donnees/deux/memory.stat' }, { non: 'valeur nulle' }], [{ non: 'déstructuration de tableau inconnu' }], [{ chemin: 'donnees/trois' }]])
})

test('éléments itérés : colonnes exactes, branches, projections, étalements et opacité', () => {
  const chemins = (xs) => xs.map((chemin) => ({ chemin }))
  const table = "[['src/a.ts','colonne/a.md'],['src/b.ts','colonne/b.md'],['src/é.ts','colonne/c.md']]"
  const source = (corps) => ({ 'banc.mjs': "import {readFileSync} from 'node:fs'; " + corps })
  const src = chemins(['src/a.ts', 'src/b.ts', 'src/é.ts'])
  const docs = chemins(['colonne/a.md', 'colonne/b.md', 'colonne/c.md'])
  assert.deepEqual(racinesDe(source(`for (const [p,q] of ${table}) { readFileSync(p); readFileSync(q) }`), 'banc.mjs'), [src, docs])
  for (const methode of ['map', 'flatMap', 'forEach', 'filter', 'some', 'every', 'find'])
    assert.deepEqual(racinesDe(source(`${table}.${methode}(([p,q]) => { readFileSync(p); readFileSync(q) })`), 'banc.mjs'), [src, docs], methode)
  assert.deepEqual(racinesDe(source(`const t = choix ? ${table} : [['src/d.ts','colonne/d.md']]; for (const [p,q] of t) { readFileSync(p); readFileSync(q) }`), 'banc.mjs'), [[...src, { chemin: 'src/d.ts' }], [...docs, { chemin: 'colonne/d.md' }]])
  assert.deepEqual(racinesDe(source("['src/a.ts','src/b.ts','src/é.ts'].forEach(p => readFileSync(p))"), 'banc.mjs'), [src])
  assert.deepEqual(racinesDe(source("for (const {p} of [{p:'src/a.ts'},{p:'src/b.ts'},{p:'src/é.ts'}]) readFileSync(p)"), 'banc.mjs'), [src])
  assert.deepEqual(racinesDe(source("const t = choix ? [['src/a.ts']] : opaque(); for (const [p] of t) readFileSync(p)"), 'banc.mjs'), [[{ chemin: 'src/a.ts' }, { non: 'déstructuration de tableau p' }]])
  assert.deepEqual(racinesDe(source("const t = choix ? ['src/a.ts'] : opaque(); t.forEach(p => readFileSync(p))"), 'banc.mjs'), [[{ chemin: 'src/a.ts' }, { non: 'appel opaque' }]])
  assert.deepEqual(racinesDe(source("for (const [p] of opaque()) readFileSync(p)"), 'banc.mjs'), [[{ non: 'déstructuration de tableau p' }]])
  assert.deepEqual(racinesDe(source("for (const p of []) readFileSync(p)"), 'banc.mjs'), [])
  assert.deepEqual(racinesDe(source("for (const [,p = 'src/defaut.ts'] of [['colonne/a.md','src/a.ts'],['colonne/b.md'],['colonne/c.md','src/é.ts']]) readFileSync(p)"), 'banc.mjs'), [chemins(['src/a.ts', 'src/defaut.ts', 'src/é.ts'])])
  assert.deepEqual(racinesDe(source("const [,p = 'src/defaut.ts'] = ['colonne/a.md']; readFileSync(p)"), 'banc.mjs'), [[{ chemin: 'src/defaut.ts' }]])
  assert.deepEqual(racinesDe(source("const t = ['src/a.ts','src/b.ts','src/é.ts'].map(p => [p,'colonne/x.md']); for (const [p,q] of t) { readFileSync(p); readFileSync(q) }"), 'banc.mjs'), [src, [{ chemin: 'colonne/x.md' }]])
  assert.deepEqual(racinesDe(source("const t = ['src/a.ts','src/b.ts','src/é.ts'].flatMap(p => [[p,'colonne/x.md']]); for (const [p,q] of t) { readFileSync(p); readFileSync(q) }"), 'banc.mjs'), [src, [{ chemin: 'colonne/x.md' }]])
  assert.deepEqual(racinesDe(source(`const t = ${table}; for (const [p,q] of [...t]) { readFileSync(p); readFileSync(q) }`), 'banc.mjs'), [src, docs])
  assert.deepEqual(racinesDe(source("const t = [['src/a.ts'],...opaque()]; for (const [p] of t) readFileSync(p)"), 'banc.mjs'), [[{ chemin: 'src/a.ts' }, { non: 'déstructuration de tableau p' }]])
  assert.deepEqual(racinesDe(source("const t = choix ? ['src/a.ts'] : opaque(); const u = t.map(p => ['src/fixe.ts']); for (const [p] of u) readFileSync(p)"), 'banc.mjs'), [[{ chemin: 'src/fixe.ts' }, { non: 'déstructuration de tableau p' }]])
  assert.deepEqual(racinesDe(source("for (const [p] of [].map(p => ['src/fixe.ts'])) readFileSync(p)"), 'banc.mjs'), [])
  assert.deepEqual(racinesDe(source("for (const [,p = 'src/defaut.ts'] of [['colonne/a.md',],['colonne/b.md',,'colonne/c.md']]) readFileSync(p)"), 'banc.mjs'), [[{ chemin: 'src/defaut.ts' }]])
  assert.deepEqual(racinesDe(source("const [p = 'src/defaut.ts',,q] = [,'colonne/a.md','src/é.ts']; readFileSync(p); readFileSync(q)"), 'banc.mjs'), [[{ chemin: 'src/defaut.ts' }], [{ chemin: 'src/é.ts' }]])
})

test('contrats de source : référence locale, alias importé, homonyme opaque et résumé corpus', () => {
  const modules = {
    'canon.mjs': "export function opaque() { return inconnu() }\nexport function lit() { readFileSync(inconnu()) }\nexport const CONTRATS_DE_DERIVATION = [{fonction:opaque,namespace:'/host'}, {fonction:lit,lectures:'corpus'}]",
    'autre.mjs': 'export function opaque() { return inconnu() }',
    'banc.mjs': "import {opaque as vrai, lit} from './canon.mjs'\nimport {opaque as faux} from './autre.mjs'\nreadFileSync(vrai())\nreadFileSync(faux())\nlit('../arbitraire')",
  }
  assert.deepEqual(racinesDe(modules, 'banc.mjs'), [[{ hors: true }], [{ non: 'appel inconnu' }], [couvert('canon.mjs#lit', 'résumé de lecture déclaré à la source')]])
  assert.deepEqual(racinesDe(modules, 'canon.mjs'), [[couvert('canon.mjs#lit', 'résumé de lecture déclaré à la source')]])
})

// #2475 / #2477
test('contrat de retour : seules les feuilles déclarées couvrent le corpus, composition et cache réel', () => {
  const source = "export function politique() { return opaque() }\nexport function inventaire() { return opaque() }\n" +
    "export function seulementLit() { readFileSync(inconnu()); return opaque() }\n" +
    "export const CONTRATS_DE_DERIVATION = [\n" +
    "{fonction:politique,lectures:'corpus',retour:{exclude:{chemin:'corpus'},global:{chemin:'corpus'}}},\n" +
    "{fonction:inventaire,lectures:'corpus',retour:'corpus'},\n{fonction:seulementLit,lectures:'corpus'}]\n"
  const modules = {
    'canon.mjs': source,
    'public.mjs': "export {politique as policy, inventaire} from './canon.mjs'\n",
    'autre.mjs': 'export function politique() { return opaque() }\n',
    'banc.mjs': "import {join,dirname} from 'node:path'\nimport {policy,inventaire} from './public.mjs'\n" +
      "import {politique as fausse} from './autre.mjs'\nimport {seulementLit} from './canon.mjs'\n" +
      "const p = policy()\nreadFileSync(join(p.exclude.chemin,'.gitignore'))\nreadFileSync(dirname(p.global.chemin)+'/suite')\n" +
      "readFileSync(join(inventaire(),'.gitignore'))\nreadFileSync(p.global.configuration)\nreadFileSync(p.exclude.chemin.inconnue)\n" +
      "readFileSync(fausse().exclude.chemin)\nreadFileSync(seulementLit().inconnue)\n" +
      "readFileSync(join(p.exclude.chemin,inconnu()))\nreadFileSync(join(inconnu(),p.exclude.chemin))\n" +
      "readFileSync(choix ? p.exclude.chemin : inconnu())\n",
  }
  const retour = (champ) => couvert(`canon.mjs#politique:retour.${champ}`, 'résumé de retour déclaré à la source')
  assert.deepEqual(evaluateurDe(modules).sitesDe('banc.mjs').filter((s) => s.appel === 'readFileSync' && !s.relais).map((s) => s.valeurs), [
    [retour('exclude.chemin')], [retour('global.chemin')],
    [couvert('canon.mjs#inventaire:retour', 'résumé de retour déclaré à la source')],
    [{ non: 'propriété p.global.configuration' }], [{ non: 'propriété p.exclude.chemin.inconnue' }],
    [{ non: 'appel opaque' }], [{ non: 'appel opaque' }],
    [retour('exclude.chemin'), { non: 'appel inconnu' }],
    [{ non: 'appel inconnu' }, retour('exclude.chemin')],
    [retour('exclude.chemin'), { non: 'appel inconnu' }],
  ])
  const evaluateur = evaluateurDe(modules)
  const premier = evaluateur.tracer(() => evaluateur.sitesDe('banc.mjs'))
  const repete = evaluateur.tracer(() => evaluateur.sitesDe('banc.mjs'))
  assert.ok(repete.requetes.has(JSON.stringify(['lecture', 'canon.mjs'])))
  assert.deepEqual([...repete.requetes].sort(), [...premier.requetes].sort())
  assert.equal(JSON.parse(JSON.stringify(lire('canon.mjs', source))).fonctions.politique.contrat.retour.v.exclude.v.chemin.k, 'couverture')
})

/** Le corpus d'une instance du consommateur réel, que le banc doit couvrir. */
const CORPUS_SRC = 'src/a.md'
const CORPUS_SOURCE = 'Source/b.md'
/** Le banc et le module canonique d'une instance du consommateur réel. */
const BANC = 'scripts/banc.test.mjs'
const CANON = 'scripts/canon.mjs'

/** Les fichiers d'une instance du consommateur réel : `canon` en `CANON`, `banc` en `BANC`, le corpus à l'état initial. */
const depotDuConsommateur = (canon, banc) => ({
  [CANON]: canon, [BANC]: banc, [CORPUS_SRC]: 'initial', [CORPUS_SOURCE]: 'initial', '.gitignore': 'node_modules/',
})

/** Le consommateur RÉEL sur une instance de `fichiers` : `corps(racine, sha)`, l'instance retirée ensuite. */
async function surInstance(fichiers, corps) {
  const { racine, sha } = instanceDeDepot({ fichiers })
  try { await corps(racine, sha) } finally { rmSync(racine, { recursive: true, force: true }) }
}

/** Chaque touche de `CORPUS_SRC`, puis de `CORPUS_SOURCE`, retient `BANC` (`perimetreDuDepot`). */
async function retenuParChaqueTouche(racine, sha) {
  for (const fichier of [CORPUS_SRC, CORPUS_SOURCE]) {
    writeFileSync(posix.join(racine, fichier), 'touché')
    assert.ok((await perimetreDuDepot(racine, { base: sha })).retenus.has(BANC), fichier)
    writeFileSync(posix.join(racine, fichier), 'initial')
  }
}

/** `CANON` réécrit en `invalide` APRÈS un cache chaud : le balayage froid nomme `attendu`, le chaud le rend à l'identique. */
async function contratInvalideApresCacheChaud(racine, invalide, attendu) {
  assert.deepEqual((await balayagesNonResolus(racine)), [])
  writeFileSync(posix.join(racine, CANON), invalide)
  const froid = (await balayagesNonResolus(racine))
  assert.ok(froid.some((s) => s.fichier === attendu.fichier && s.raison === attendu.raison), JSON.stringify(froid))
  assert.deepEqual((await balayagesNonResolus(racine)), froid)
}

/** Le dépôt du contrat de retour SANS lecture : `canon` et les fichiers de l'instance. */
const depotDuContratDeRetour = () => {
  const canon = "export function politique() { return opaque() }\n" +
    "export const CONTRATS_DE_DERIVATION = [{fonction:politique,retour:{exclude:{chemin:'corpus'}}}]\n"
  return { canon, fichiers: depotDuConsommateur(canon,
    "import {readFileSync} from 'node:fs';import {join} from 'node:path';import {politique} from './canon.mjs';readFileSync(join(politique().exclude.chemin,'.gitignore'))") }
}

// #2586
test('contrat de retour : le consommateur réel retient le banc à chaque touche du corpus', () =>
  surInstance(depotDuContratDeRetour().fichiers, retenuParChaqueTouche))

// #2586
test('contrat de retour : un contrat invalidé après cache chaud se voit, froid puis chaud', () => {
  const { canon, fichiers } = depotDuContratDeRetour()
  return surInstance(fichiers, (racine) => contratInvalideApresCacheChaud(racine, canon.replace("chemin:'corpus'", "chemin:'invalide'"),
    { fichier: BANC, raison: 'appel opaque' }))
})

// #2586
test('confier Source : retour normal nul, alias et requêtes froides-chaudes', () => {
  const chemin = 'scripts/guards/lib/gitPorte.mjs'
  const source = readFileSync(new URL('./gitPorte.mjs', import.meta.url), 'utf8')
  const banc = 'scripts/confier.test.mjs'
  const modules = {
    [chemin]: source + '\nexport {confier as confierPublic}\n',
    'scripts/facade.mjs': "export {confierPublic as confierAlias} from './guards/lib/gitPorte.mjs'",
    [banc]: "import {depotDe} from './guards/lib/gitPorte.mjs'; import {confierAlias as transmettre} from './facade.mjs'; transmettre(depotDe('/depot', {enPanne:()=>readFileSync('src/rappel.md')}), 'src/cause.md'); export const retour=transmettre(depotDe('/depot', {enPanne:()=>{}}), 'src/cause.md'); readFileSync(retour)",
  }
  const e = evaluateurDe(modules)
  const froid = e.tracer(() => e.valeurs(lire(banc, modules[banc]).exports.retour, { f: banc, env: null }))
  const chaud = e.tracer(() => e.valeurs(lire(banc, modules[banc]).exports.retour, { f: banc, env: null }))
  assert.deepEqual(froid.resultat, [{ non: 'valeur nulle' }])
  assert.deepEqual(chaud.resultat, froid.resultat)
  assert.ok(chaud.requetes.has(JSON.stringify(['lecture', chemin])))
  assert.ok(chaud.requetes.has(JSON.stringify(['lecture', 'scripts/facade.mjs'])))
  assert.deepEqual([...chaud.requetes].sort(), [...froid.requetes].sort())
  const effets = e.tracer(() => e.sitesDe(banc))
  assert.deepEqual(effets.resultat.filter((s) => s.appel === 'readFileSync' && !s.relais).map((s) => s.valeurs), [[{ chemin: 'src/rappel.md' }], [{ non: 'valeur nulle' }]])
  assert.deepEqual(e.tracer(() => e.sitesDe(banc)), effets)
})

// #2586
test('retour normal nul : producteur supplémentaire et effets du rappel liés à son argument', () => {
  const modules = {
    'scripts/producteur.mjs': "function transmettre(chemin,rappel){rappel(chemin);return null}\nexport {transmettre as publicNull}\nexport const CONTRATS_DE_DERIVATION=[{fonction:transmettre,retour:{type:'null'}}]",
    'scripts/facade.mjs': "export {publicNull as aliasNull} from './producteur.mjs'",
    'scripts/banc.test.mjs': "import {aliasNull as transmettre} from './facade.mjs'; import {readFileSync} from 'node:fs'; transmettre('src/lecture.md', p=>readFileSync(p)); export const retour=transmettre('src/lecture.md', ()=>{}); readFileSync(retour)",
  }
  const banc = 'scripts/banc.test.mjs'
  const e = evaluateurDe(modules)
  const froid = e.tracer(() => e.sitesDe(banc))
  const chaud = e.tracer(() => e.sitesDe(banc))
  assert.deepEqual(froid.resultat.filter((s) => !s.relais).map((s) => s.valeurs), [[{ chemin: 'src/lecture.md' }], [{ non: 'valeur nulle' }]])
  assert.deepEqual(e.valeurs(lire(banc, modules[banc]).exports.retour, { f: banc, env: null }), [{ non: 'valeur nulle' }])
  assert.deepEqual(chaud.resultat, froid.resultat)
  assert.ok(chaud.requetes.has(JSON.stringify(['lecture', 'scripts/producteur.mjs'])))
  assert.deepEqual([...chaud.requetes].sort(), [...froid.requetes].sort())
})

// #2586
test('plage réelle : contrat Source, cwd non borné, retours et requêtes froides-chaudes', () => {
  const chemin = 'scripts/guards/lib/plageStock.mjs'
  const source = readFileSync(new URL('./plageStock.mjs', import.meta.url), 'utf8')
  const modules = { [chemin]: source }
  for (const fonction of ['lectureDeLaPlage', 'croissancesDeLaPlage']) {
    for (const cwd of ['RACINE', "'/depot/exterieur'", 'inconnu()']) {
      const banc = `import {${fonction}} from './guards/lib/plageStock.mjs'\n` +
        `const RACINE = new URL('..',import.meta.url).pathname\n${fonction}({cwd:${cwd},debut:'avant',fin:'apres'})`
      modules['scripts/banc.test.mjs'] = banc
      const evaluateur = evaluateurDe(modules)
      const froid = evaluateur.tracer(() => evaluateur.sitesDe('scripts/banc.test.mjs'))
      const chaud = evaluateur.tracer(() => evaluateur.sitesDe('scripts/banc.test.mjs'))
      const sites = froid.resultat.filter((site) => site.appel === fonction && !site.relais)
      assert.deepEqual(sites.flatMap((site) => site.valeurs), [couvert(`${chemin}#${fonction}`, 'résumé de lecture déclaré à la source')], `${fonction} ${cwd}`)
      assert.deepEqual(chaud.resultat, froid.resultat)
      assert.ok(chaud.requetes.has(JSON.stringify(['lecture', chemin])))
      assert.deepEqual([...chaud.requetes].sort(), [...froid.requetes].sort())
    }
  }
  const sansContrats = source.replace(/export const CONTRATS_DE_DERIVATION = \[[\s\S]*?\n\]\n/, '')
  const declare = lire(chemin, source)
  const naturel = lire(chemin, sansContrats)
  for (const fonction of ['lectureDeLaPlage', 'croissancesDeLaPlage']) {
    assert.deepEqual(declare.fonctions[fonction].retours, naturel.fonctions[fonction].retours)
  }
  assert.equal(Object.hasOwn(declare.fonctions.lectureDeLaPlage.contrat, 'retour'), false)
  modules['scripts/banc.test.mjs'] = "import {lectureDeLaPlage} from './guards/lib/plageStock.mjs'\n" +
    "import {readFileSync} from 'node:fs'\nconst lu=lectureDeLaPlage({cwd:inconnu(),debut:'avant',fin:'apres'})\nreadFileSync(lu.depot)\nreadFileSync(lu.commits)\nreadFileSync(lu.cumul)"
  const lectures = evaluateurDe(modules).sitesDe('scripts/banc.test.mjs').filter((site) => site.appel === 'readFileSync' && !site.relais)
  assert.equal(lectures.length, 3)
  for (const site of lectures) {
    assert.ok(site.valeurs.length > 0)
    assert.ok(site.valeurs.every((valeur) => Object.hasOwn(valeur, 'non') && !Object.hasOwn(valeur, 'hors') && !Object.hasOwn(valeur, 'chemin')))
  }
})

// #2586
test('croissances Source : DTO public partiel, collections et propriétés historiques opaques', () => {
  const chemin = 'scripts/guards/lib/plageStock.mjs'
  const source = readFileSync(new URL('./plageStock.mjs', import.meta.url), 'utf8')
  const contrats = source.slice(source.indexOf('export const CONTRATS_DE_DERIVATION = [')).split('\n]\n')[0] + '\n]\n'
  const nouveau = 'export function producteur(){return opaque()}\n' + contrats
    .replace("  { fonction: lectureDeLaPlage, lectures: 'corpus' },\n", '')
    .replace('fonction: croissancesDeLaPlage', 'fonction: producteur')
  for (const [module, fonction, texte] of [[chemin, 'croissancesDeLaPlage', source], ['scripts/autre.mjs', 'producteur', nouveau]]) {
    const banc = 'scripts/dto.test.mjs'
    const modules = { [module]: texte, [banc]: `import {${fonction}} from './${posix.relative('scripts', module)}'\n` +
      `export const dto=${fonction}({cwd:inconnu(),debut:'avant',fin:'apres'})\n` +
      "for(const x of dto.refus){readFileSync(x.ere);readFileSync(x.fichier);readFileSync(x.sha);readFileSync(x.net);readFileSync(x.declare);readFileSync(x.exemples);readFileSync(x.fusion);readFileSync(x.extra)}\n" +
      "for(const x of dto.reclassements){readFileSync(x.ere);readFileSync(x.module);readFileSync(x.ecarts);readFileSync(x.illisible);readFileSync(x.extra)}\n" +
      "for(const note of dto.notes)readFileSync(note)\nreadFileSync(dto.plage)\nreadFileSync(dto.indisponible)\n" +
      "readFileSync(dto.eres)\nreadFileSync(dto.commits)\nreadFileSync(dto.extra)\nreadFileSync(dto.refus.map(String))\nreadFileSync(dto.reclassements.map(String))" }
    const evaluateur = evaluateurDe(modules)
    const dto = evaluateur.valeurs(lire(banc, modules[banc]).exports.dto, { f: banc, env: null })
    assert.equal(dto.length, 1, module)
    assert.equal(dto[0].partiel, true, module)
    for (const nom of ['refus', 'reclassements']) {
      assert.equal(dto[0].objet[nom].k, 'collection', `${module} ${nom}`)
      const elements = evaluateur.valeurs(dto[0].objet[nom], dto[0].ctx)
      assert.equal(elements.length, 1)
      assert.equal(elements[0].partiel, true)
      assert.deepEqual(Object.keys(elements[0].objet), ['ere'])
    }
    const lectures = evaluateur.sitesDe(banc).filter((site) => site.appel === 'readFileSync' && !site.relais).map((site) => site.valeurs)
    const chaine = (champ) => couvert(`${module}#${fonction}:retour.${champ}`, 'chaîne sans borne déclarée à la source')
    const nullable = (champ) => [chaine(champ), { non: 'valeur nulle' }]
    assert.deepEqual(lectures[0], nullable('refus[].ere'))
    for (const index of [1, 2, 3, 4, 5, 6, 7, 9, 10, 11, 12, 16, 17, 18]) {
      assert.equal(lectures[index].length, 1, `${module} ${index}`)
      assert.match(lectures[index][0].non, /^propriété /, `${module} ${index}`)
    }
    assert.deepEqual(lectures[8], nullable('reclassements[].ere'))
    assert.deepEqual(lectures[13], [chaine('notes[]')])
    assert.deepEqual(lectures[14], [chaine('plage')])
    assert.deepEqual(lectures[15], nullable('indisponible'))
    assert.deepEqual(lectures.slice(19), [[{ non: 'conversion String non scalaire' }], [{ non: 'conversion String non scalaire' }]])
  }
})

// #2586
/** Les touches de la plage hors corpus : une image, une suppression, les deux bouts d'un renommage. */
const IMAGE = 'images/pion.svg'
const SUPPRIME = posix.join('docs', 'supprime.md')
const ANCIEN = posix.join('docs', 'ancien.md')
const NOUVEAU = posix.join('docs', 'nouveau.md')

/** Le dépôt de la plage RÉELLE (`plageStock.mjs`) et de ses six bancs : chaque fonction sous chaque `cwd`. */
const depotDeLaPlage = () => {
  const chemin = 'scripts/guards/lib/plageStock.mjs'
  const source = readFileSync(new URL('./plageStock.mjs', import.meta.url), 'utf8')
  const bancs = Object.fromEntries(['lectureDeLaPlage', 'croissancesDeLaPlage'].flatMap((fonction) =>
    ['RACINE', "'/depot/exterieur'", 'inconnu()'].map((cwd, index) => [`scripts/${fonction}-${index}.test.mjs`,
      `import {${fonction}} from './guards/lib/plageStock.mjs'\nconst RACINE=new URL('..',import.meta.url).pathname\n${fonction}({cwd:${cwd},debut:'avant',fin:'apres'})`])))
  return { chemin, source, bancs, fichiers: {
    [chemin]: source, ...bancs, [CORPUS_SRC]: 'initial', [CORPUS_SOURCE]: 'initial',
    [IMAGE]: '<svg/>', [SUPPRIME]: 'initial', [ANCIEN]: 'initial', '.gitignore': 'node_modules/',
  } }
}

/** La sélection publique, froide puis chaude, à l'identique ; chaque banc retenu par la racine balayée `.`. */
async function selectionDeLaPlage(racine, sha, bancs) {
  const froid = (await perimetreDuDepot(racine, { base: sha }))
  const chaud = (await perimetreDuDepot(racine, { base: sha }))
  assert.deepEqual([...chaud.retenus], [...froid.retenus])
  for (const banc of Object.keys(bancs)) {
    const lien = froid.retenus.get(banc)
    assert.ok(lien, banc)
    assert.equal(lien.nature, 'racine balayée', banc)
    assert.equal(lien.racine, '.', banc)
  }
  return froid
}

// #2586
test('plage réelle : chaque banc lit une racine qui couvre touches, suppressions, renommages et images', () => {
  const { chemin, source, bancs } = depotDeLaPlage()
  for (const banc of Object.keys(bancs)) {
    const lectures = racinesDe({ [chemin]: source, ...bancs }, banc).flat()
    for (const touche of [CORPUS_SRC, CORPUS_SOURCE, IMAGE, SUPPRIME, NOUVEAU])
      assert.ok(lectures.some((lecture) => Object.hasOwn(lecture, 'chemin') && touche.startsWith(lecture.chemin)), `${banc} ${touche}`)
  }
})

/** Les touches de la sélection publique de la plage : un fichier réécrit, une image, une suppression, un renommage. */
const touchesDeLaPlage = () => [
  ...[CORPUS_SRC, CORPUS_SOURCE, IMAGE].map((fichier) => ({ nom: fichier, toucher: (racine) => writeFileSync(posix.join(racine, fichier), 'touché'), touches: [fichier] })),
  { nom: 'suppression', toucher: (racine) => rmSync(posix.join(racine, SUPPRIME)), touches: [SUPPRIME] },
  { nom: 'renommage', toucher: (racine) => renameSync(posix.join(racine, ANCIEN), posix.join(racine, NOUVEAU)), touches: [ANCIEN, NOUVEAU] },
]

// #2586
for (const { nom, toucher, touches } of touchesDeLaPlage()) test(`plage réelle : la sélection publique conserve la touche ${nom}`, () => {
  const { bancs, fichiers } = depotDeLaPlage()
  return surInstance(fichiers, async (racine, sha) => {
    toucher(racine)
    const selection = await selectionDeLaPlage(racine, sha, bancs)
    for (const touche of touches) assert.ok(selection.touches.includes(touche), touche)
  })
})

test('namespace borné : fragments recomposés, parent et sortie couvrent le corpus, cible readlink opaque', () => {
  const texte = "import {readdirSync} from 'node:fs';import {join,dirname} from 'node:path'\nexport function base() {return opaque()}\nexport const CONTRATS_DE_DERIVATION=[{fonction:base,namespace:'/proc'}]\nconst b=base()\nfor(const nom of readdirSync(b)) {readFileSync(join(b,nom,'stat'));readFileSync(nom)}\nreadFileSync(dirname(b))\nreadFileSync(join(b,'..','src'))\nreadFileSync(readlinkSync(join(b,'1/cwd')))"
  const rendu = racinesDe({ 'banc.mjs': texte }, 'banc.mjs')
  assert.deepEqual(rendu, [[{ hors: true }], [couvert('banc.mjs#base:/proc', 'descente par fragment de namespace susceptible de lien')], [{ non: 'fragment de répertoire sans sa base' }], [couvert('banc.mjs#base:/proc', 'parent du namespace externe')], [couvert('banc.mjs#base:/proc', 'sortie du namespace externe')], [{ non: 'appel readlinkSync' }]])
  for (const fichier of ['src/a.ts', 'scripts/x.mjs', 'Source/livre.md'])
    for (const indice of [3, 4]) assert.ok(fichier.startsWith(rendu[indice][0].chemin))
})

test('fragment direct de namespace : lecture descendante couvre le consommateur réel', async () => {
  const source = "import {join} from 'node:path';import {readdirSync,readFileSync} from 'node:fs';function base(){return opaque()};export const CONTRATS_DE_DERIVATION=[{fonction:base,namespace:'.git'}];const b=base();for(const nom of readdirSync(b)){readFileSync(join(b,nom))}"
  const racines = racinesDe({ 'scripts/banc.test.mjs': source }, 'scripts/banc.test.mjs')
  const { racine, sha } = instanceDeDepot({ fichiers: { 'scripts/banc.test.mjs': source, 'src/a.md': 'initial', '.gitignore': 'node_modules/' } })
  try {
    writeFileSync(posix.join(racine, 'src/a.md'), 'touché')
    assert.ok((await perimetreDuDepot(racine, { base: sha })).retenus.has('scripts/banc.test.mjs'))
    assert.deepEqual(racines[1], [couvert('scripts/banc.test.mjs#base:.git', 'descente par fragment de namespace susceptible de lien')])
  } finally { rmSync(racine, { recursive: true, force: true }) }
})

test('composition : mkdtemp couvre son suffixe aléatoire, join et resolve diffèrent, extérieur ne masque pas inconnu', () => {
  const texte = "import {join,resolve} from 'node:path'\nimport {tmpdir} from 'node:os'\nimport {mkdtempSync} from 'node:fs'\nreadFileSync(mkdtempSync(join(process.cwd(),'fixture-')))\nreadFileSync(join('src','/data'))\nreadFileSync(resolve('src','/data'))\nreadFileSync(join(tmpdir(),inconnu()))\nreadFileSync(join(tmpdir(),'..','x'))\nreadFileSync(choix ? tmpdir() : inconnu())\nreadFileSync('/absolu/arbitraire')"
  assert.deepEqual(racinesDe({ 'banc.mjs': texte }, 'banc.mjs'), [
    [couvert('corpus:fixture-', 'suffixe aléatoire mkdtempSync')], [{ chemin: 'src/data' }], [{ non: 'chemin absolu /data' }],
    [couvertureTemporaire, { non: 'appel inconnu' }], [couvertureTemporaire],
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

test('mkdtemp : le consommateur réel retient une lecture sous suffixe aléatoire', async () => {
  const { racine, sha } = instanceDeDepot({ fichiers: {
    'scripts/banc.test.mjs': "import {join} from 'node:path';import {mkdtempSync,readFileSync} from 'node:fs';const dir=mkdtempSync(join(process.cwd(),'fixture-'));readFileSync(join(dir,'x.md'))",
    'fixture-ABC/x.md': 'initial', '.gitignore': 'node_modules/',
  } })
  try {
    assert.deepEqual((await balayagesNonResolus(racine)), [])
    writeFileSync(posix.join(racine, 'fixture-ABC/x.md'), 'touché')
    assert.ok((await perimetreDuDepot(racine, { base: sha })).retenus.has('scripts/banc.test.mjs'))
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

/** Le dépôt du consommateur canonique : `canon` (lecture déclarée `corpus`) et les fichiers de l'instance. */
const depotDuConsommateurCanonique = () => {
  const canon = "export function lit(){readFileSync(inconnu())}\nexport const CONTRATS_DE_DERIVATION=[{fonction:lit,lectures:'corpus'}]"
  return { canon, fichiers: depotDuConsommateur(canon, "import {lit} from './canon.mjs'\nlit('../inconnu')") }
}

// #2586
test('consommateur canonique : couverture de tous fichiers', () =>
  surInstance(depotDuConsommateurCanonique().fichiers, retenuParChaqueTouche))

// #2586
test('consommateur canonique : changement de contrat après cache chaud', () => {
  const { canon, fichiers } = depotDuConsommateurCanonique()
  return surInstance(fichiers, (racine) => contratInvalideApresCacheChaud(racine, canon.replace("lectures:'corpus'", "lectures:'invalide'"),
    { fichier: CANON, raison: 'appel inconnu' }))
})

test('lectures de base : littéral, join depuis la racine du module, boucle, fichier exact, sonde d’absence, porte git', () => {
  const texte = ROOT + "function depotDe(cwd){return opaque()};export const CONTRATS_DE_DERIVATION=[{fonction:depotDe,retour:{type:'poignee',argument:0}}];\n" + [
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

// #2603
test('DOSSIER GIT : `gitDirDe(x)` vaut `<x>/.git` ; son homonyme hors `barriere-outil.mjs` s’évalue sur ses retours', () => {
  const gitDirDe = "export function gitDirDe(racine) {\n  const point = join(racine, '.git')\n  const lu = /gitdir: (.+)/.exec(readFileSync(point, 'utf8'))\n  return lu ? resolve(racine, lu[1]) : null\n}\n"
  const modules = {
    'scripts/hooks/barriere-outil.mjs': "import { readFileSync } from 'node:fs'\nimport { join, resolve } from 'node:path'\n" + gitDirDe,
    'scripts/autre.mjs': "import { readFileSync } from 'node:fs'\nimport { join, resolve } from 'node:path'\n" + gitDirDe,
    'scripts/garde.mjs': "import { readFileSync } from 'node:fs'\nimport { join } from 'node:path'\nimport { gitDirDe } from './hooks/barriere-outil.mjs'\n" +
      "import { gitDirDe as homonyme } from './autre.mjs'\nreadFileSync(join(gitDirDe('docs'), 'epoque'))\nreadFileSync(join(homonyme('docs'), 'epoque'))\n",
  }
  assert.deepEqual(racinesDe(modules, 'scripts/garde.mjs'), [
    [{ chemin: 'docs/.git/epoque' }], [{ chemin: 'docs/.git' }],
    [couvert('corpus:docs', 'forme ElementAccessExpression'), { non: 'valeur nulle' }], [{ chemin: 'docs/.git' }],
  ])
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
