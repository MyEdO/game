// Contrat du lecteur de RACINES BALAYÉES (#2400) : lectures de base, relais dérivés, valeurs de retour,
// et ce qu'il ne devine pas. Un dépôt EN MÉMOIRE par cas : `modules` (chemin → texte).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { posix, join } from 'node:path'
import { tmpdir } from 'node:os'
import { runInNewContext } from 'node:vm'
import { fileURLToPath } from 'node:url'
import { spawnBorne } from './processusBorne.mjs'
import { registerHooks } from 'node:module'
import { readFileSync, writeFileSync, renameSync, rmSync, mkdtempSync } from 'node:fs'
import { instanceDeDepot } from './depotGabarit.mjs'
import { parUnitesDeCode } from './lister.mjs'
import { balayagesNonResolus, perimetreDuDepot } from '../../test/perimetre.mjs'
import { analyserTexte } from './dialecte.mjs'
import { certifierLecture, evaluateurDuDepot, evaluerLotDuDepot, evaluer, lecteurDExpressions, lectureDeModule, encoderLecture, decoderLecture, mesureLecture } from './racinesBalayees.mjs'
import { gelerLaConstante, gelerProfond } from '../../../src/lib/gelerProfond.ts'
import { tableTotale } from '../../../src/lib/tableTotale.ts'

const tableauCreux = () => Object.assign(Array(2), { 1: 1 })

/** Le lot `entree`, ses IR (`encoderLecture`) certifiées par `module`, évalué par le noyau fermé de `module`. */
const evaluerLot = (entree, module = { certifierLecture, evaluerLotDuDepot }) =>
  module.evaluerLotDuDepot({ ...entree, lectures: entree.lectures.map(([f, pool]) => [f, module.certifierLecture(f, pool)]) })

// #2586
const construireSondeDePile = async () => {
  const url = new URL('./racinesBalayees.mjs?pile-differee', import.meta.url).href
  const hook = registerHooks({ load(spec, ctx, suivant) {
    const r = suivant(spec, ctx)
    if (spec !== url) return r
    let source = Buffer.from(r.source).toString('utf8')
    source = source.replace('  const cleDesArgs = (args) => {', '  let appelsDeCle = 0\n  const cleDesArgs = (args) => { appelsDeCle++')
    source = source.replace('    valeurs,', '    sonde: { sousPile, memoisable, lecture, formesDesArguments, appelsDeCle: () => appelsDeCle },\n    valeurs,')
    return { ...r, source: source + '\nexport const pilePourTest = (ferme, memoiserBooleens) => construireEvaluateur({ lecture: () => null, cible: () => null, clesStructurelles: true, memoiserBooleens }, ferme)\n' }
  } })
  try { return (await import(url)).pilePourTest } finally { hook.deregister() }
}

test('pile fermée : aucun encodage sans homonyme ; contrats publics et BOOL actifs avides', async () => {
  const construire = await construireSondeDePile()
  for (const [ferme, bool, attendu] of [[true, false, 0], [true, true, 16], [false, false, 16], [false, true, 16]]) {
    const { sonde: p } = construire(ferme, bool)
    const args = gelerLaConstante([[{ texte: 'src/a' }]])
    const avant = JSON.stringify(args)
    const descendre = (i) => i === 16 ? [{ chemin: 'src/a' }] : p.sousPile('fonction' + i, args, 'f' + i, () => descendre(i + 1))
    assert.deepEqual(descendre(0), [{ chemin: 'src/a' }])
    assert.equal(p.appelsDeCle(), attendu)
    assert.equal(JSON.stringify(args), avant)
    assert.equal(p.sousPile('apres', args, 'apres', () => 'libre'), 'libre')
  }
})

test('pile fermée : cycles exacts, indices, réentrées, profondeur, dépendance et ordre des requêtes', async () => {
  const construire = await construireSondeDePile()
  const args = (texte = 'src/a') => gelerLaConstante([[{ texte }]])
  for (const bool of [false, true]) {
    const ev = construire(true, bool), p = ev.sonde
    const appel = (f, a, faire) => p.sousPile(f, a, f, faire)
    assert.deepEqual(appel('direct', args(), () => appel('direct', args(), () => assert.fail())), [{ non: "cycle d'appels direct" }])
    assert.deepEqual(appel('z', args(), () => appel('a', args(), () => appel('z', args(), () => assert.fail()))), [{ non: "cycle d'appels a, z" }])
    assert.deepEqual(appel('hors', args(), () => appel('z', args(), () => appel('a', args(), () => appel('z', args(), () => assert.fail())))), [{ non: "cycle d'appels a, z" }])
    assert.deepEqual(appel('f', args('a'), () => appel('f', args('b'), () => appel('f', args('c'), () => assert.fail()))), [{ non: "cycle d'appels f" }])
    assert.equal(appel('f', args('a'), () => appel('f', args('b'), () => 'deux')), 'deux')
    assert.deepEqual(appel('f', args('a'), () => appel('x', args(), () => appel('f', args('b'), () => appel('y', args(), () => appel('f', args('b'), () => assert.fail()))))), [{ non: "cycle d'appels f, y" }])
    const fermer = (i) => i === 16 ? appel('f0', args(), () => assert.fail()) : appel('f' + i, args(), () => fermer(i + 1))
    assert.deepEqual(fermer(0), [{ non: "cycle d'appels f0, f1, f10, f11, f12, f13, f14, f15, f2, f3, f4, f5, f6, f7, f8, f9" }])
    const descendre = (i) => appel('f' + i, args(), () => descendre(i + 1))
    assert.deepEqual(descendre(0), [{ non: "profondeur d'appels > 16 (f16)" }])
    assert.deepEqual(p.memoisable(() => appel('f', args(), () => p.memoisable(() => appel('f', args(), () => assert.fail())))), {
      resultat: { resultat: [{ non: "cycle d'appels f" }], stable: false }, stable: true,
    })
    assert.throws(() => appel('erreur', args(), () => { throw new Error('attendue') }), /attendue/)
    assert.equal(appel('erreur', args(), () => 'sortie'), 'sortie')
    const observe = ev.tracer(() => appel('z', args(), () => {
      p.lecture('avant'); const r = appel('a', args(), () => { p.lecture('pendant'); return appel('z', args(), () => assert.fail()) }); p.lecture('apres'); return r
    }))
    assert.deepEqual([...observe.requetes], ['["lecture","avant"]', '["lecture","pendant"]', '["lecture","apres"]'])
    assert.deepEqual(observe.resultat, [{ non: "cycle d'appels a, z" }])
    const groupe = args(), forme = { e: { k: 'lit', v: 'src/a' }, ctx: { f: 'a.mjs', env: null } }
    p.formesDesArguments.set(groupe[0], forme)
    const avant = JSON.stringify({ groupe, forme })
    appel('forme', groupe, () => appel('forme', groupe, () => assert.fail()))
    assert.equal(p.formesDesArguments.get(groupe[0]), forme)
    assert.equal(JSON.stringify({ groupe, forme }), avant)
  }
})


const lire = (rel, text) => lectureDeModule(rel, analyserTexte({ rel, text }).sourceFile)

// #2586
test('retours fermés : transformeurs, arguments capturés, cadres, bornes et requêtes', async () => {
  const url = new URL('./racinesBalayees.mjs?retours-fermes', import.meta.url).href
  const hook = registerHooks({ load(spec, ctx, suivant) {
    const r = suivant(spec, ctx)
    if (spec !== url) return r
    const source = Buffer.from(r.source).toString('utf8').replace('    valeurs,',
      '    sonde: { retour, sousPile, formesDesArguments },\n    valeurs,')
    return { ...r, source: source + '\nexport const retoursPourTest = (lecture, ferme) => construireEvaluateur({ lecture, cible: () => null, peutLire: () => true, clesStructurelles: true, memoiserBooleens: false }, ferme)\n' }
  } })
  let construire
  try { construire = (await import(url)).retoursPourTest } finally { hook.deregister() }
  const lu = gelerLaConstante(JSON.parse(JSON.stringify(lire('a.mjs', 'export function f(x) { return x }'))))
  const fn = { f: 'a.mjs', id: 'f' }
  for (const ferme of [false, true]) {
    let lectures = 0, appels = 0
    const ev = construire(() => { lectures++; return lu }, ferme)
    const p = ev.sonde
    const args = [[{ texte: 'src/a' }]]
    const transformer = (e, ctx) => { appels++; return ev.valeurs(e, ctx) }
    const faire = () => ev.tracer(() => p.retour(fn, args, transformer))
    const premier = faire(), lecturesDuPremier = lectures, second = faire()
    assert.deepEqual(second, premier)
    assert.deepEqual([...second.requetes], ['["lecture","a.mjs"]'])
    assert.equal(appels, ferme ? 1 : 2)
    assert.equal(lectures, lecturesDuPremier * (ferme ? 1 : 2))
    assert.deepEqual(p.retour(fn, [[{ texte: 'src/b' }]], transformer), [{ texte: 'src/b' }])
    assert.deepEqual(p.retour(fn, args, () => [{ texte: 'autre' }]), [{ texte: 'autre' }])
    const avantCadre = appels
    const cadre = () => p.sousPile('parent', args, 'parent', () => { faire(); faire() })
    cadre(); cadre()
    assert.equal(appels - avantCadre, ferme ? 2 : 4)
    const descendre = (i) => i === 16 ? p.retour(fn, args, transformer)
      : p.sousPile('parent' + i, args, 'parent' + i, () => descendre(i + 1))
    assert.deepEqual(descendre(0), [{ non: "profondeur d'appels > 16 (f)" }])
    assert.deepEqual(p.sousPile('retour a.mjs#f', args, 'f', () => p.retour(fn, args, transformer)), [{ non: "cycle d'appels f" }])
    assert.deepEqual(faire(), premier)
    const formeA = [[{ texte: 'identique' }]], formeB = [[{ texte: 'identique' }]]
    const forme = (v) => ({ e: { k: 'lit', v: 'capture' }, ctx: { f: 'a.mjs', env: { fn: 'f', args: [[{ texte: v }]] } } })
    p.formesDesArguments.set(formeA[0], forme('a'))
    p.formesDesArguments.set(formeB[0], forme('b'))
    const capture = (e, ctx) => [{ texte: p.formesDesArguments.get(ctx.env.args[0]).ctx.env.args[0][0].texte }]
    assert.deepEqual(p.retour(fn, formeA, capture), [{ texte: 'a' }])
    assert.deepEqual(p.retour(fn, formeB, capture), [{ texte: 'b' }])
    const ordre = (e, ctx) => ctx.env.args.flat()
    assert.deepEqual(p.retour(fn, [[{ texte: 'a' }], [{ texte: 'b' }]], ordre), [{ texte: 'a' }, { texte: 'b' }])
    assert.deepEqual(p.retour(fn, [[{ texte: 'b' }], [{ texte: 'a' }]], ordre), [{ texte: 'b' }, { texte: 'a' }])
    let cycles = 0
    const cyclique = () => { cycles++; return p.sousPile('retour a.mjs#f', args, 'f', () => assert.fail()) }
    assert.deepEqual(p.retour(fn, args, cyclique), [{ non: "cycle d'appels f" }])
    assert.deepEqual(p.retour(fn, args, cyclique), [{ non: "cycle d'appels f" }])
    assert.equal(cycles, 2)
    assert.equal(Object.isFrozen(args), false)
    assert.equal(Object.isFrozen(args[0]), false)
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
test('lectures certifiées : une certification par lecture, des lots à noyau neuf qui la partagent, le reste refusé nommé', async (t) => {
  const url = new URL('./racinesBalayees.mjs?codec-travail', import.meta.url).href
  const key = '2586.codec.travail'
  globalThis[key] = { visites: 0, decodes: 0, noyaux: [] }
  t.after(() => delete globalThis[key])
  const hook = registerHooks({ load(spec, ctx, suivant) {
    const r = suivant(spec, ctx)
    if (spec !== url) return r
    const source = Buffer.from(r.source).toString('utf8')
      .replace('const visiter = (v) => {', `const visiter = (v) => { globalThis['${key}'].visites++;`)
      .replace('export function decoderLecture(lecture, limite = LIMITE_LECTURE) {', `export function decoderLecture(lecture, limite = LIMITE_LECTURE) { globalThis['${key}'].decodes++;`)
      .replace('const { resultat, requetes } = evaluateur.tracer', `globalThis['${key}'].noyaux.push(evaluateur); const { resultat, requetes } = evaluateur.tracer`)
      .replace('    valeurs,', '    lecturePourTest: lecture,\n    valeurs,')
    return { ...r, source }
  } })
  let module
  try { module = await import(url) } finally { hook.deregister() }
  let dag = { k: 'importe', spec: './x.mjs', nom: 'x' }
  for (let i = 0; i < 17; i++) dag = [dag, dag]
  const pool = encoderLecture({ sites: [], fonctions: {}, exports: {}, etoiles: [], lambdas: {}, dag })
  const a = module.certifierLecture('a.mjs', pool)
  const illisible = module.certifierLecture('nul.mjs', null)
  assert.equal(Object.isFrozen(illisible), true)
  assert.deepEqual(Reflect.ownKeys(illisible), [])
  assert.equal(globalThis[key].decodes, 1)
  assert.ok(globalThis[key].visites < 100, String(globalThis[key].visites))
  assert.equal(Object.isFrozen(a), true)
  assert.equal(Object.isFrozen(a.dag), true)
  assert.equal(a.dag[0], a.dag[1])
  const lot = (lectures) => module.evaluerLotDuDepot({ lectures, resolutions: [], lecteurs: [], questions: Array.from({ length: 3 }, () => ({ nature: 'sitesDe', f: 'a.mjs' })) })
  const premier = lot([['a.mjs', a]])
  assert.deepEqual(premier.map((r) => r.resultat), [[], [], []])
  premier[0].resultat.push('altéré')
  assert.deepEqual(lot([['a.mjs', a]]).map((r) => r.resultat), [[], [], []])
  assert.equal(globalThis[key].decodes, 1)
  const noyaux = globalThis[key].noyaux
  assert.equal(noyaux.length, 6)
  assert.equal(new Set(noyaux.slice(0, 3)).size, 1)
  assert.equal(new Set(noyaux.slice(3)).size, 1)
  assert.notEqual(noyaux[0], noyaux[3])
  for (const noyau of [noyaux[0], noyaux[3]]) assert.equal(noyau.lecturePourTest('a.mjs'), a)
  for (const [nom, etrangere] of [['décodée gelée', gelerLaConstante(decoderLecture(pool))], ['clone', structuredClone(a)],
    ['certifiée par une autre instance', certifierLecture('a.mjs', pool)]])
    assert.throws(() => lot([['a.mjs', etrangere]]), /^Error: SNAPSHOT_LECTURE_NON_CERTIFIEE:a\.mjs$/, nom)
  assert.throws(() => lot([['a.mjs', a], ['b.mjs', 'texte']]), /^Error: SNAPSHOT_LECTURE_NON_CERTIFIEE:b\.mjs$/)
  assert.throws(() => module.certifierLecture('x.mjs', encoderLecture('x')), /SNAPSHOT_LECTURE_NON_OBJET:x\.mjs/)
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
    ['A2 nature en accesseur', () => ({ questions: [natureAlternee('siteDe')] }), /^Error: SNAPSHOT_ACCESSEUR:questions\[0\]\.nature$/],
    ['nature hasOwnProperty en accesseur', () => ({ questions: [natureAlternee('hasOwnProperty')] }), /^Error: SNAPSHOT_ACCESSEUR:questions\[0\]\.nature$/],
    ['nature hasOwnProperty par itérateur propre', () => ({ questions: avec([question], { [Symbol.iterator]: iterant({ nature: 'hasOwnProperty', f: 'sitesDe' })[Symbol.iterator] }) }), /^Error: SNAPSHOT_QUESTIONS_NON_TABLEAU$/],
    ['f non chaîne', () => ({ questions: [{ nature: 'sitesDe', f: ['c.mjs'] }] }), /^Error: SNAPSHOT_QUESTION_F_HORS_DOMAINE:0$/],
  ]) await t.test(nom, () => assert.throws(() => lot(entree()), erreur))
})

// #2586
test('lot fermé : chaque question d’un lot rend le résultat de la question seule et au moins ses requêtes, sous-graphe partagé compris', async () => {
  const url = new URL('./racinesBalayees.mjs?propriete-lot', import.meta.url).href
  const hook = registerHooks({ load(spec, ctx, suivant) {
    const r = suivant(spec, ctx)
    return spec === url ? { ...r, source: Buffer.from(r.source).toString('utf8').replace('function construireEvaluateur(', 'export function construireEvaluateur(') } : r
  } })
  let module
  try { module = await import(url) } finally { hook.deregister() }
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
  const entree = { lectures: [...lectures].map(([f, lu]) => [f, module.certifierLecture(f, lu === null ? null : encoderLecture(lu))]), resolutions, lecteurs: [...lectures.keys()] }
  const questions = [{ nature: 'sitesDe', f: 'a.mjs' }, { nature: 'sitesDe', f: 'vide.mjs' }, { nature: 'sitesDe', f: 'nul.mjs' }, { nature: 'relaisExportes', f: 'b.mjs' },
    { nature: 'sitesDe', f: 'e.mjs' }, { nature: 'sitesDe', f: 'a.mjs' }, { nature: 'relaisExportes', f: 'a.mjs' }, { nature: 'relaisExportes', f: 'e.mjs' },
    { nature: 'sitesDe', f: 'p.mjs' }, { nature: 'sitesDe', f: 'r.mjs' }]
  const seule = (question) => module.evaluerLotDuDepot({ ...entree, questions: [question] })[0]
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
    const rendus = module.evaluerLotDuDepot({ ...entree, questions: ordre.map((i) => questions[i]) })
    assert.equal(rendus.length, ordre.length)
    ordre.forEach((i, k) => couvre(rendus[k], attendu[i], `${JSON.stringify(ordre)} ${questions[i].nature}:${questions[i].f}`))
  }
  const augmente = structuredClone(lectures.get('a.mjs'))
  augmente.sites.push(structuredClone(augmente.sites[1]))
  const [renduPlusUn] = module.evaluerLotDuDepot({ ...entree, lectures: entree.lectures.map(([f, lu]) => [f, f === 'a.mjs' ? module.certifierLecture(f, encoderLecture(augmente)) : lu]), questions: [questions[0]] })
  couvre({ ...renduPlusUn, resultat: renduPlusUn.resultat.slice(0, -1) }, attendu[0], 'site dupliqué')
  assert.deepEqual(renduPlusUn.resultat.at(-1), attendu[0].resultat[1])
  const ferme = module.construireEvaluateur({ lecture: (f) => lectures.get(f), cible: (f, spec) => resolutions.find(([g, s]) => g === f && s === spec)?.[2] ?? null,
    peutLire: () => true, clesStructurelles: true }, true)
  for (const index of [-1, 0.5, NaN, undefined, null, lectures.get('a.mjs').sites.length]) {
    assert.throws(() => ferme.siteDe('a.mjs', index), /SNAPSHOT_INDEX_SITE_INVALIDE/)
  }
  assert.throws(() => ferme.siteDe('nul.mjs', 0), /SNAPSHOT_INDEX_SITE_INVALIDE/)
  assert.throws(() => ferme.siteDe('vide.mjs', 0), /SNAPSHOT_INDEX_SITE_INVALIDE/)
  assert.throws(() => module.evaluerLotDuDepot({ ...entree, questions: [{ nature: 'sitesDe', f: 'absent.mjs' }] }), /QUESTION_DU_LOT:sitesDe:absent.mjs:SNAPSHOT_QUESTION_ABSENTE:lecture/)
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

test('clés privées : partitions, références locales numériques, trois rôles, DAG et association avant clé', async () => {
  const url = new URL('./racinesBalayees.mjs?cles-fermees', import.meta.url).href
  const hook = registerHooks({ load(spec, ctx, suivant) {
    const r = suivant(spec, ctx)
    if (spec !== url) return r
    const source = Buffer.from(r.source).toString('utf8')
    return { ...r, source: source.replace('    valeurs,', '    cles: { cleCanonique, cleDe, cleDesArgs, texteDeCle, formesDesArguments, tracer, lecturesDe, uniques },\n    valeurs,') + '\nexport const construirePourTest = (lecture=()=>null,cible=()=>null,ferme=true) => construireEvaluateur({lecture,cible,peutLire:()=>true,clesStructurelles:ferme,memoiserBooleens:true},ferme).cles\n' }
  } })
  let construire
  try { construire = (await import(url)).construirePourTest } finally { hook.deregister() }
  const c = construire()
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
  const ouvert = construire(undefined, undefined, false)
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
  const lus = new Map([
    ['a.mjs', lire('a.mjs', "import {scanner} from './b.mjs'; export function appel(p){return scanner(p)}")],
    ['b.mjs', lire('b.mjs', "import {readFileSync} from 'node:fs'; export function scanner(p){return readFileSync(p)}")],
  ])
  const ev = construire((f) => lus.get(f) ?? null, () => 'b.mjs')
  const evaluer = () => ev.tracer(() => ev.lecturesDe({ f: 'a.mjs', id: 'appel' }, [[{ texte: 'src' }]]))
  const froid = evaluer()
  const chaud = evaluer()
  assert.deepEqual(chaud.resultat, froid.resultat)
  assert.ok(froid.requetes.has('["lecture","b.mjs"]'))
  assert.deepEqual([...chaud.requetes].sort(), [...froid.requetes].sort())
})

test('construction privée : publication après descripteur et unique association dans argumentDe', () => {
  const source = readFileSync(fileURLToPath(new URL('./racinesBalayees.mjs', import.meta.url)), 'utf8')
  const debut = source.indexOf('      pile.set(v, pile.size)')
  const reference = source.slice(debut, source.indexOf('      return reference\n', debut))
  assert.match(reference, /const descriptor =[^]*?const reference = interner\(descriptor\)\s+references.set\(v, reference\)/)
  assert.equal(reference.slice(0, reference.indexOf('const reference = interner')).includes('references.set('), false)
  assert.doesNotMatch(source, /references\.set\(v,[^\r\n]*\)\s+pile\.set\(v, pile\.size\)/)
  assert.equal(source.split('formesDesArguments.set(').length, 2)
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
test('politique BOOL du driver : prédicat DAG partagé et coûts comparés', async (t) => {
  const key = '2586.politique.dag'
  globalThis[key] = { predicats: 0, calculs: 0, cles: 0 }
  t.after(() => delete globalThis[key])
  const charger = async (cache) => {
    const url = new URL(`./racinesBalayees.mjs?politique-dag-${cache}`, import.meta.url).href
    const hook = registerHooks({ load(spec, ctx, suivant) {
      const r = suivant(spec, ctx)
      if (spec !== url) return r
      let source = Buffer.from(r.source).toString('utf8')
        .replace('  const booleenDe = (e, ctx) => {', `  const booleenDe = (e, ctx) => { globalThis['${key}'].predicats++;`)
        .replace('      const vs = valeurs(e, { ...ctx, preuveBooleenne: true })', `      globalThis['${key}'].calculs++; const vs = valeurs(e, { ...ctx, preuveBooleenne: true })`)
        .replace('    const entree = { e, ctx, pile: [...pile] }', `    globalThis['${key}'].cles++; const entree = { e, ctx, pile: [...pile] }`)
      if (cache) source = source.replace('clesStructurelles: true, memoiserBooleens: false,', 'clesStructurelles: true, memoiserBooleens: true,')
      return { ...r, source }
    } })
    try { return await import(url) } finally { hook.deregister() }
  }
  const lu = lire('a.mjs', "readFileSync('src')")
  const condition = { k: 'importe', spec: './b.mjs', nom: 'oui' }
  lu.sites[0].args[0] = { k: 'union', v: Array.from({ length: 16 }, (_, i) => ({ k: 'garde', condition,
    attendu: true, de: { k: 'lit', v: `src/${i}` } })) }
  const entree = { lectures: [['a.mjs', encoderLecture(lu)], ['b.mjs', encoderLecture(lire('b.mjs', 'export const oui=true'))]],
    resolutions: [['a.mjs', './b.mjs', 'b.mjs']], lecteurs: ['a.mjs', 'b.mjs'], questions: [{ nature: 'sitesDe', f: 'a.mjs' }] }
  const rendus = [], couts = []
  for (const cache of [false, true]) {
    const module = await charger(cache)
    globalThis[key] = { predicats: 0, calculs: 0, cles: 0 }
    rendus.push(evaluerLot(entree, module))
    couts.push({ ...globalThis[key] })
  }
  assert.deepEqual(rendus[0], rendus[1])
  assert.deepEqual(rendus[0][0].resultat[0].valeurs, Array.from({ length: 16 }, (_, i) => ({ chemin: `src/${i}` })))
  assert.ok(rendus[0][0].requetes.includes(JSON.stringify(['lecture', 'b.mjs'])))
  assert.equal(couts[0].cles, 0)
  assert.ok(couts[1].cles > 0)
  assert.ok(couts[0].calculs > couts[1].calculs, JSON.stringify(couts))
  t.diagnostic(`DAG partagé : sans cache ${JSON.stringify(couts[0])} ; avec cache ${JSON.stringify(couts[1])}`)
})

// #2586
const evaluateurDeCles = async (clesStructurelles) => {
  const url = new URL(`./racinesBalayees.mjs?cles-p-${clesStructurelles}`, import.meta.url).href
  const hook = registerHooks({ load(specifier, contexte, suivant) {
    const rendu = suivant(specifier, contexte)
    if (specifier !== url) return rendu
    const texte = Buffer.from(rendu.source).toString('utf8')
    assert.equal(texte.split('    valeurs,').length, 2)
    return { ...rendu, source: texte.replace('    valeurs,', '    cles: { cleCanonique, cleDe, cleDesArgs, texteDeCle, composerCle, formesDesArguments },\n    valeurs,') }
  } })
  let construire
  try { construire = (await import(url)).evaluateurDuDepot } finally { hook.deregister() }
  return construire({ lecture: () => null, cible: () => null, clesStructurelles }).cles
}

// #2586
test('clés P : relation historique, restitution, formes, coupes et références opaques', async () => {
  const ancien = await evaluateurDeCles(false)
  const neuf = await evaluateurDeCles(true)
  const textes = new Map()
  const cellules = new Map()
  const verifier = (v, args = false) => {
    const avant = args ? ancien.cleDesArgs(v) : ancien.cleDe(v)
    const apres = args ? neuf.cleDesArgs(v) : neuf.cleDe(v)
    assert.equal(neuf.texteDeCle(apres), avant)
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
    ancien.formesDesArguments.set(as, { e, ctx })
    neuf.formesDesArguments.set(as, { e, ctx })
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
  const opaque = neuf.cleCanonique(({ referenceDe }) => referenceDe({ pile: [capture] }), null, null, { strict: true, cellules: true })
  assert.notEqual(opaque, null)
  const compose = neuf.composerCle('retour banc.mjs#f(', capture, ')')
  assert.equal(neuf.texteDeCle(compose), `retour banc.mjs#f(${neuf.texteDeCle(capture)})`)
  assert.notEqual(neuf.composerCle('retour banc.mjs#g(', capture, ')'), compose)
  const source = { objet: { v: { k: 'lit', v: 'src/a' } }, ctx: { f: 'banc.mjs', env: null } }
  const instantane = neuf.cleDe(source)
  const octets = neuf.texteDeCle(instantane)
  Object.defineProperty(source.objet, 'v', { get() { throw new Error('SOURCE_RELECTURE') } })
  assert.equal(neuf.texteDeCle(instantane), octets)
  let effets = 0
  for (const inadmissible of [new Proxy([], { ownKeys() { effets++; throw new Error('Proxy') } }),
    Object.defineProperty([], 'x', { get() { effets++; return 1 } }), Object.assign([], { toJSON() { effets++; return [] } })])
    assert.throws(() => neuf.cleDesArgs(inadmissible), /CLE_STRUCTURELLE_SOURCE_INADMISSIBLE/)
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

// #2586
test('clés strictes textuelles : preuve locale, formes indépendantes et dépendances négatives', async () => {
  const p = (await evaluateurDePreuves({ lecture: () => null, cible: () => null })).preuves
  const cache = new WeakMap()
  const cle = (x) => p.cleCanonique(({ referenceDe }) => referenceDe(x), x, cache, { strict: true })
  const feuille = Object.freeze([])
  const racine = Object.freeze({ feuille })
  const original = cle(racine)
  const certificat = cache.get(racine).certificat
  const records = p.compteur.records
  for (let i = 0; i < 200; i++) {
    p.formesDesArguments.set([], { e: { k: 'lit', v: i }, ctx: { f: 'banc.mjs', env: { args: [] } } })
    assert.equal(cle(racine), original)
  }
  assert.equal(p.compteur.records, records)
  assert.equal(cache.get(racine).certificat, certificat)
  const forme = { e: { k: 'lit', v: 'a' }, ctx: { f: 'banc.mjs', env: { args: [] } } }
  p.formesDesArguments.set(feuille, forme)
  const avecForme = cle(racine)
  assert.notEqual(avecForme, original)
  forme.e.v = 'b'
  p.formesDesArguments.set(feuille, forme)
  assert.notEqual(cle(racine), avecForme)
  p.formesDesArguments.delete(feuille)
  assert.equal(cle(racine), original)
  const enfant = { v: 'a' }
  const parent = Object.freeze({ enfant })
  const avant = cle(parent)
  enfant.v = 'b'
  assert.notEqual(cle(parent), avant)
})

// #2586
test('clés P : projections isolées, invalidation des ancêtres et plateau du trie', async (t) => {
  const p = (await evaluateurDePreuves({ lecture: () => null, cible: () => null })).preuves
  const cache = new WeakMap()
  const cle = (x, formesCompletes = false, memo = cache) => p.cleCanonique(({ referenceDe }) => referenceDe(x), x, memo, { strict: true, cellules: true, formesCompletes })
  const feuille = Object.freeze([Object.freeze({ texte: 'src/a' })])
  const racine = Object.freeze({ feuille })
  const original = cle(racine)
  assert.equal(p.sousGraphesDesValeurs.has(racine), true)
  assert.equal(p.sousGraphesGeles.has(racine), false)
  const opaque = cle(racine)
  const avantOpaque = { ...p.compteur }
  assert.equal(cle(opaque, false, null), opaque)
  assert.equal(p.compteur.observations - avantOpaque.observations, 1)
  assert.equal(p.compteur.references - avantOpaque.references, 1)
  assert.equal(p.compteur.tokens - avantOpaque.tokens, 0)
  const generation = p.sousGraphesDesValeurs.get(racine).preuve
  const forme = { e: { k: 'lit', v: 'src/a' }, ctx: { f: 'banc.mjs', env: null } }
  p.formesDesArguments.set(feuille, forme)
  assert.equal(generation.valide, false)
  const historique = cle(racine)
  const complet = cle(racine, true)
  assert.notEqual(historique, complet)
  for (const projection of [false, true, false, true]) {
    assert.equal(cle(racine, projection), projection ? complet : historique)
    assert.equal(cache.get(racine).formesCompletes, projection)
  }
  forme.ctx.f = 'autre.mjs'
  assert.notEqual(cle(racine), historique)
  p.formesDesArguments.delete(feuille)
  assert.equal(cle(racine), original)
  const compter = (branche = p.cellulesBooleennes) => 1 + [...branche.values()].reduce((n, valeur) => n + (valeur instanceof Map ? compter(valeur) : 1), 0)
  const avant = compter()
  for (let i = 0; i < 100; i++) assert.equal(cle(gelerLaConstante(structuredClone(racine)), false, null), original)
  assert.equal(compter(), avant)
  for (let i = 0; i < 10; i++) cle(gelerLaConstante({ feuille: [{ texte: `src/${i}` }] }), false, null)
  const apres = compter()
  assert.ok(apres > avant)
  const mesures = { avant, apres, cellulesRacine: p.cellulesBooleennes.size }
  t.diagnostic(JSON.stringify(mesures))
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
test('lexique lambda : requête canonique et mutation sous le même id', async () => {
  let lu = lire('origine.mjs', "export function produire(){return (flag)=>flag}")
  const id = Object.keys(lu.lambdas)[0]
  const e = await evaluateurDePreuves({ lecture: (f) => f === 'origine.mjs' ? lu : null, cible: () => null })
  const expression = { k: 'appel', cible: { k: 'lambda', id }, args: [{ k: 'booleen', v: true }], texte: 'rappel' }
  const ctx = { f: 'origine.mjs', env: null }
  const froid = e.tracer(() => e.preuves.booleenDe(expression, ctx))
  const chaud = e.tracer(() => e.preuves.booleenDe(expression, ctx))
  assert.equal(froid.resultat, true)
  assert.deepEqual(chaud, froid)
  assert.ok(froid.requetes.has(JSON.stringify(['lecture', 'origine.mjs'])))
  lu = JSON.parse(JSON.stringify(lu))
  lu.lambdas[id].retours = [{ k: 'booleen', v: false }]
  const change = e.tracer(() => e.preuves.booleenDe(expression, ctx))
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
let numeroDePreuve = 0
const evaluateurDePreuves = async (acces, { sansCacheEntree = false, sansSousGraphes = false, sansRevalidation = false } = {}) => {
  const url = new URL(`./racinesBalayees.mjs?preuves-scalaires-${++numeroDePreuve}`, import.meta.url).href
  const hook = registerHooks({ load(specifier, contexte, suivant) {
    const rendu = suivant(specifier, contexte)
    if (specifier !== url) return rendu
    let texte = Buffer.from(rendu.source).toString('utf8')
    for (const ancre of ['  const traces = []', '  function valeurs(e, ctx) {', '    valeurs,'])
      assert.equal(texte.split(ancre).length, 2, ancre)
    texte = texte.replace('  const traces = []', '  const compteur = { valeurs: 0, records: 0, encodagesEntree: 0, clesEntree: [] }\n  const traces = []')
      .replace('deja.objets.every(({ objet, noms, proprietes, forme, prototype, slotsGeles, preuve }) => {', 'deja.objets.every(({ objet, noms, proprietes, forme, prototype, slotsGeles, preuve }) => {\n      compteur.records++; compteur.avantRecord?.()')
      .replace('  function valeurs(e, ctx) {', '  function valeurs(e, ctx) {\n    compteur.valeurs++')
      .replace('    valeurs,', '    preuves: { booleenDe, cleCanonique, texteDeCle, formesDesArguments, compteur, preuvesBooleennes, slotsGeles, cellulesBooleennes, sousGraphesGeles, sousGraphesDesValeurs, sousGraphesRevalides },\n    valeurs,')
    for (const [ancre, nom] of [['  const inscrireParent = (preuve, parent) => {', 'inscriptions'],
      ['    const suivant = preuve.nettoyage.iterateur.next()', 'liensExamines']]) {
      assert.equal(texte.split(ancre).length, 2)
      texte = texte.replace(ancre, `${ancre}\n    compteur.${nom} = (compteur.${nom} ?? 0) + 1`)
    }
    const ancreSousGraphes = '      if (!strict || !cellules) return undefined'
    assert.equal(texte.split(ancreSousGraphes).length, 2)
    texte = texte.replace(ancreSousGraphes, `${ancreSousGraphes}\n      if (!compteur.sousGraphesActifs) return undefined`)
    const ancrePublication = '      if (strict && cellules && stable && fermetures.get(v)?.eligible && revisionAvant === revisionDesFormes)'
    assert.equal(texte.split(ancrePublication).length, 2)
    texte = texte.replace(ancrePublication, ancrePublication.replace('if (', 'if (compteur.sousGraphesActifs && '))
    const ancreRevalidation = 'strict && cellules && sousGraphesRevalides.get(objet)'
    assert.equal(texte.split(ancreRevalidation).length, 2)
    texte = texte.replace(ancreRevalidation, `${sansRevalidation ? 'false' : 'true'} && ${ancreRevalidation}`)
    for (const [ancre, nom] of [['    const observer = (objet) => {', 'observations'],
      ['    const referenceDe = (v) => {', 'references'], ['    const tokensDe = (v, tokens, projection = false) => {', 'tokens']]) {
      assert.equal(texte.split(ancre).length, 2)
      texte = texte.replace(ancre, `${ancre}\n      compteur.${nom}++`)
    }
    const appelsBool = /cleCanonique\(\(\{ referenceDe \}\) => referenceDe\(entree\), entree, (null|clesDesEntreesBooleennes), \{ strict: true, cellules: true \}\)/g
    assert.equal([...texte.matchAll(appelsBool)].length, 3)
    texte = texte.replaceAll(appelsBool,
      (_, cache) => `(() => { const cle = cleCanonique(({ referenceDe }) => { compteur.encodagesEntree++; return referenceDe(entree) }, entree, ${sansCacheEntree ? 'null' : cache}, { strict: true, cellules: true }); compteur.clesEntree.push(cle); return cle })()`)
    return { ...rendu, source: texte }
  } })
  try {
    const ev = (await import(url)).evaluateurDuDepot(acces)
    Object.assign(ev.preuves.compteur, { sousGraphesActifs: !sansSousGraphes, observations: 0, references: 0, tokens: 0 })
    return ev
  } finally { hook.deregister() }
}

// #2586
test('sous-graphes revalidés : enveloppes fraîches, mutations profondes et qualification', async (t) => {
  const acces = { lecture: () => null, cible: () => null }
  const actif = (await evaluateurDePreuves(acces)).preuves
  const temoin = (await evaluateurDePreuves(acces, { sansRevalidation: true })).preuves
  const cle = (p, x) => p.cleCanonique(({ referenceDe }) => referenceDe(x), x, null, { strict: true, cellules: true })
  const branche = { enfant: { liste: [{ v: true }] } }
  const enveloppe = () => ({ gauche: branche, droite: branche, pile: ['a', 'b'] })
  const verifier = (x) => {
    const a = cle(actif, x)
    const b = cle(temoin, x)
    assert.equal(actif.texteDeCle(a), temoin.texteDeCle(b))
    return a
  }
  const froid = verifier(enveloppe())
  const avant = actif.compteur.tokens
  assert.equal(verifier(enveloppe()), froid)
  const chaud = actif.compteur.tokens - avant
  const avantTemoin = temoin.compteur.tokens
  verifier(enveloppe())
  assert.ok(temoin.compteur.tokens - avantTemoin > chaud)
  assert.equal(actif.sousGraphesRevalides.has(branche), true)
  assert.equal(actif.sousGraphesGeles.has(branche), false)
  assert.equal(actif.slotsGeles.has(branche), false)
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
  assert.equal(actif.sousGraphesRevalides.has(cycle), false)
  verifier({ branche, cycle, pile: ['a'] })
  delete branche.retour
  verifier(enveloppe())
  const args = [{ v: true }]
  const racine = { args }
  const forme = { e: { k: 'booleen', v: true }, ctx: { f: 'a', env: { args: [] } } }
  const associer = (valeur) => { actif.formesDesArguments.set(args, valeur); temoin.formesDesArguments.set(args, valeur) }
  const sansForme = verifier(racine)
  associer(forme)
  const avecForme = verifier(racine)
  assert.notEqual(avecForme, sansForme)
  forme.e.v = false
  assert.notEqual(verifier(racine), avecForme)
  associer({ ...forme, ctx: { f: 'b', env: { args: [] } } })
  verifier(racine)
  actif.formesDesArguments.delete(args); temoin.formesDesArguments.delete(args)
  assert.equal(verifier(racine), sansForme)
  associer(undefined)
  verifier(racine)
  const avantUndefined = actif.compteur.tokens
  verifier(racine)
  assert.ok(actif.compteur.tokens > avantUndefined)
  const runs = []
  for (const sansRevalidation of [false, true]) {
    const source = lire('bool.mjs', 'export function choisi(flag) { return flag }')
    const ev = await evaluateurDePreuves({ lecture: () => source, cible: () => 'bool.mjs' }, { sansRevalidation })
    const e = { k: 'appel', cible: { k: 'importe', spec: './bool.mjs', nom: 'choisi' }, args: [{ k: 'booleen', v: true }] }
    const ctx = { f: 'banc.mjs', env: null }
    const sorties = []
    const observer = (expression = e, contexte = ctx) => sorties.push(ev.tracer(() => ev.preuves.booleenDe(expression, contexte)))
    observer(); observer(); observer(structuredClone(e), structuredClone(ctx))
    assert.deepEqual(sorties[0], sorties[1])
    assert.deepEqual(sorties[0], sorties[2])
    assert.equal(sorties[0].resultat, true)
    assert.ok(sorties[0].requetes.has(JSON.stringify(['lecture', 'bool.mjs'])))
    e.args[0].v = false
    observer()
    assert.equal(sorties.at(-1).resultat, false)
    source.fonctions.choisi.retours[0] = { k: 'booleen', v: true }
    observer()
    assert.equal(sorties.at(-1).resultat, true)
    runs.push({ sorties, cles: ev.preuves.compteur.clesEntree.map(ev.preuves.texteDeCle) })
  }
  assert.deepEqual(runs[0], runs[1])
  t.diagnostic(JSON.stringify({ tokensEnveloppeChaude: chaud }))
})

// #2586
test('sous-graphes gelés : fermeture, mêmes cellules, modes historiques et visites', async (t) => {
  const p = (await evaluateurDePreuves({ lecture: () => null, cible: () => null })).preuves
  const cle = (x, cellules = true, strict = true, cache = null) => p.cleCanonique(({ referenceDe }) => referenceDe(x), x, cache, { strict, cellules })
  const enfant = gelerLaConstante({ e: { k: 'booleen', v: true }, ctx: { f: 'a', env: { fn: 'f', args: [] } }, pile: ['a', 'b'] })
  const racine = gelerLaConstante({ gauche: enfant, droite: enfant })
  const sources = [racine, enfant, enfant.e, enfant.ctx, enfant.ctx.env, enfant.ctx.env.args, enfant.pile]
  const froid = cle(racine)
  for (const x of sources) {
    const preuve = p.sousGraphesGeles.get(x)
    assert.deepEqual(Object.keys(preuve).sort(), ['cellule', 'preuve'])
    assert.equal(preuve.preuve.valide, true)
    assert.equal(sources.includes(preuve.cellule), false)
  }
  const avant = { ...p.compteur }
  assert.equal(cle(racine), froid)
  const chaud = { ...p.compteur }
  p.compteur.sousGraphesActifs = false
  assert.equal(cle(racine), froid)
  assert.ok(p.compteur.observations - chaud.observations > chaud.observations - avant.observations)
  assert.ok(p.compteur.references - chaud.references > chaud.references - avant.references)
  assert.ok(p.compteur.tokens - chaud.tokens > chaud.tokens - avant.tokens)
  t.diagnostic(JSON.stringify({ visites: tableTotale(['observations', 'references', 'tokens'], (nom) =>
    ({ actif: chaud[nom] - avant[nom], desactive: p.compteur[nom] - chaud[nom] })) }))
  assert.equal(cle(structuredClone(racine)), froid)
  const compter = (branche = p.cellulesBooleennes) => 1 + [...branche.values()].reduce((n, x) => n + (x instanceof Map ? compter(x) : 1), 0)
  const plateau = compter()
  p.compteur.sousGraphesActifs = true
  for (let i = 0; i < 20; i++) {
    assert.equal(cle(racine), froid)
    assert.equal(cle(gelerLaConstante(structuredClone(racine))), froid)
  }
  assert.equal(compter(), plateau)
  const visiter = (v, vus = new Set()) => {
    assert.equal(sources.includes(v), false)
    if (!v || typeof v !== 'object' || vus.has(v)) return
    vus.add(v)
    if (v instanceof Map) for (const [k, x] of v) { visiter(k, vus); visiter(x, vus) }
    else if (v instanceof Set) for (const x of v) visiter(x, vus)
    else if (v instanceof WeakRef) visiter(v.deref(), vus)
    else for (const nom of Reflect.ownKeys(v)) {
      const p = Object.getOwnPropertyDescriptor(v, nom)
      if (Object.hasOwn(p, 'value')) visiter(p.value, vus)
    }
  }
  visiter(p.cellulesBooleennes)
  for (const x of sources) visiter(p.sousGraphesGeles.get(x))
  for (const cellules of [false, true]) for (const strict of [false, true]) {
    const actif = cle(racine, cellules, strict)
    p.compteur.sousGraphesActifs = false
    assert.equal(cle(racine, cellules, strict), actif)
    p.compteur.sousGraphesActifs = true
  }
  const mutable = { v: true }
  const parent = Object.freeze({ enfant: mutable })
  const a = cle(parent)
  assert.equal(p.sousGraphesGeles.has(parent), false)
  mutable.v = false
  assert.notEqual(cle(parent), a)
  assert.equal(p.sousGraphesGeles.has(parent), false)
  const absent = Object.freeze({ v: true })
  p.formesDesArguments.set(absent, undefined)
  cle(absent)
  assert.equal(p.sousGraphesGeles.has(absent), false)
  const argumentsFormes = gelerLaConstante([{ v: true }])
  p.formesDesArguments.set(argumentsFormes, gelerLaConstante({ e: { k: 'booleen', v: true }, ctx: { f: 'a', env: { args: [] } } }))
  const avecForme = Object.freeze({ argumentsFormes })
  const avantForme = cle(avecForme)
  assert.equal(p.sousGraphesGeles.has(avecForme), false)
  assert.equal(p.sousGraphesGeles.has(argumentsFormes), false)
  p.compteur.sousGraphesActifs = false
  assert.equal(cle(avecForme), avantForme)
})

// #2586
test('sous-graphes gelés : cycles exclus, alias, pile et memo avant preuve', async () => {
  const p = (await evaluateurDePreuves({ lecture: () => null, cible: () => null })).preuves
  const cle = (x) => p.cleCanonique(({ referenceDe }) => referenceDe(x), x, null, { strict: true, cellules: true })
  const cycle = { v: true }
  cycle.soi = cycle
  Object.freeze(cycle)
  const parent = Object.freeze({ cycle })
  const a = cle(parent)
  assert.notEqual(a, null)
  assert.equal(p.sousGraphesGeles.has(cycle), false)
  assert.equal(p.sousGraphesGeles.has(parent), false)
  const imbrique = Object.freeze({ parent })
  const avecPile = cle(imbrique)
  assert.notEqual(avecPile, null)
  assert.equal(p.sousGraphesGeles.has(imbrique), false)
  p.compteur.sousGraphesActifs = false
  assert.equal(cle(parent), a)
  assert.equal(cle(imbrique), avecPile)
  p.compteur.sousGraphesActifs = true
  const args = gelerLaConstante([{ v: true }])
  const ancienne = cle(args)
  const faire = ({ referenceDe, interner, tuple }) => {
    const premier = referenceDe(args)
    p.formesDesArguments.set(args, gelerLaConstante({ e: { k: 'booleen', v: false }, ctx: { f: 'a', env: { args: [] } } }))
    const second = referenceDe(args)
    assert.equal(premier, ancienne)
    assert.equal(second, premier)
    return interner(tuple(premier, second))
  }
  const avecMemo = p.cleCanonique(faire, args, null, { strict: true, cellules: true })
  p.formesDesArguments.delete(args)
  p.compteur.sousGraphesActifs = false
  assert.equal(p.cleCanonique(faire, args, null, { strict: true, cellules: true }), avecMemo)
})

// #2586
test('sous-graphes gelés : records abrégés et révisions pendant encodage ou validation', async () => {
  const p = (await evaluateurDePreuves({ lecture: () => null, cible: () => null })).preuves
  const cache = new WeakMap()
  const enfant = gelerLaConstante([{ v: true }])
  const racine = Object.freeze({ enfant })
  const cle = (x = racine, memo = cache) => p.cleCanonique(({ referenceDe }) => referenceDe(x), x, memo, { strict: true, cellules: true })
  const forme = (v) => gelerLaConstante({ e: { k: 'booleen', v }, ctx: { f: 'a', env: { args: [] } } })
  const ancienne = cle(racine, null)
  assert.equal(cle(), ancienne)
  const court = cache.get(racine)
  assert.equal(court.objets.length, 1)
  assert.equal(court.objets[0].preuve.valide, true)
  p.formesDesArguments.set(enfant, forme(false))
  const nouvelle = cle()
  assert.notEqual(nouvelle, ancienne)
  p.compteur.sousGraphesActifs = false
  assert.equal(cle(racine, null), nouvelle)
  p.compteur.sousGraphesActifs = true
  p.formesDesArguments.delete(enfant)
  assert.equal(cle(racine, null), ancienne)
  assert.equal(cle(), ancienne)
  assert.equal(cache.get(racine).objets.length, 1)
  p.formesDesArguments.set(enfant, undefined)
  let pendantValidation = false
  p.compteur.avantRecord = () => {
    if (pendantValidation) return
    pendantValidation = true
    p.formesDesArguments.set(enfant, forme(true))
  }
  const validee = cle()
  delete p.compteur.avantRecord
  assert.equal(pendantValidation, true)
  assert.notEqual(validee, ancienne)
  p.compteur.sousGraphesActifs = false
  assert.equal(cle(racine, null), validee)
  p.compteur.sousGraphesActifs = true
  p.formesDesArguments.delete(enfant)
  const generation = p.sousGraphesGeles.get(racine).preuve
  p.cleCanonique(({ referenceDe }) => {
    const reference = referenceDe(racine)
    p.formesDesArguments.set(enfant, forme(false))
    return reference
  }, racine, cache, { strict: true, cellules: true })
  assert.equal(cache.get(racine).certificat, null)
  assert.equal(generation.valide, false)
  const apresEncodage = cle()
  assert.notEqual(apresEncodage, ancienne)
  p.compteur.sousGraphesActifs = false
  assert.equal(cle(racine, null), apresEncodage)
})
// #2586
test('sous-graphes gelés : associations étrangères, ancêtres partagés et générations', async (t) => {
  const p = (await evaluateurDePreuves({ lecture: () => null, cible: () => null })).preuves
  const cle = (x) => p.cleCanonique(({ referenceDe }) => referenceDe(x), x, null, { strict: true, cellules: true })
  const enfant = gelerLaConstante([{ v: true }])
  const gauche = Object.freeze({ enfant })
  const droite = Object.freeze({ enfant })
  const racine = Object.freeze({ gauche, droite })
  const cellule = cle(racine)
  const generations = [enfant, gauche, droite, racine].map((x) => p.sousGraphesGeles.get(x).preuve)
  const visites = () => {
    const avant = { ...p.compteur }
    assert.equal(cle(racine), cellule)
    return tableTotale(['observations', 'references', 'tokens'], (nom) => p.compteur[nom] - avant[nom])
  }
  const chaud = visites()
  for (let i = 0; i < 5; i++) p.formesDesArguments.set([], { i })
  assert.deepEqual(visites(), chaud)
  p.formesDesArguments.set(enfant, undefined)
  assert.ok(generations.every((x) => !x.valide))
  assert.equal(cle(racine), cellule)
  assert.equal(p.formesDesArguments.has(enfant), true)
  assert.equal(p.sousGraphesGeles.get(racine).preuve, generations[3])
  p.formesDesArguments.set(enfant, undefined)
  p.formesDesArguments.delete(enfant)
  assert.equal(cle(racine), cellule)
  const nouvelle = p.sousGraphesGeles.get(racine).preuve
  assert.notEqual(nouvelle, generations[3])
  assert.equal(nouvelle.valide, true)
  assert.ok(generations.every((x) => !x.valide))
  const externe = []
  const forme = {}
  p.formesDesArguments.set(externe, forme)
  p.formesDesArguments.set(externe, forme)
  p.formesDesArguments.delete(externe)
  assert.equal(p.sousGraphesGeles.get(racine).preuve, nouvelle)
  assert.deepEqual(visites(), chaud)
  t.diagnostic(JSON.stringify({ chaud, apresAssociationsEtrangeres: visites() }))
})

// #2586
test('sous-graphes gelés : GC des sources et parents, nettoyage amorti du fan-in', async (t) => {
  if (!globalThis.gc) {
    const dossier = mkdtempSync(join(tmpdir(), 'racines-gc-'))
    try {
      const r = await spawnBorne({ argv: ['--expose-gc', '--test', '--test-reporter', 'spec',
        '--test-name-pattern', 'GC des sources et parents', fileURLToPath(import.meta.url)],
      fichier: join(dossier, 'rapport.log'), limiteMs: 10000, cwd: process.cwd(),
      env: Object.fromEntries(Object.entries(process.env).filter(([nom]) => nom !== 'NODE_TEST_CONTEXT')) })
      t.diagnostic(r.sortie)
      assert.equal(r.expiree, false)
      assert.equal(r.code, 0)
    } finally { rmSync(dossier, { recursive: true, force: true }) }
    return
  }
  for (const formesCompletes of [false, true]) {
  const p = (await evaluateurDePreuves({ lecture: () => null, cible: () => null })).preuves
  const cle = (x) => p.cleCanonique(({ referenceDe }) => referenceDe(x), x, null, { strict: true, cellules: true, formesCompletes })
  const sousGraphes = formesCompletes ? p.sousGraphesGeles : p.sousGraphesDesValeurs
  const enfant = Object.freeze({ v: true })
  cle(enfant)
  const preuve = sousGraphes.get(enfant).preuve
  const creer = (n) => Array.from({ length: n }, () => {
    const parent = Object.freeze({ enfant, alias: enfant })
    cle(parent)
    return [new WeakRef(parent), new WeakRef(sousGraphes.get(parent).preuve)]
  })
  const jeterSources = () => {
    const source = Object.freeze({ v: false })
    cle(source)
    return new WeakRef(source)
  }
  const source = jeterSources()
  const anciens = creer(128)
  assert.equal(preuve.parents.size, 128)
  assert.ok(p.compteur.liensExamines <= p.compteur.inscriptions)
  const collecter = async (refs) => {
    for (let i = 0; i < 8; i++) {
      await new Promise((r) => setImmediate(r))
      const collecte = globalThis.gc({ type: 'major', execution: 'async' })
      assert.ok(collecte instanceof Promise)
      await collecte
      await new Promise((r) => setImmediate(r))
      if (refs.every((r) => r.deref() === undefined)) return
    }
    assert.fail('générations ou sources retenues après huit tâches de GC : ' + JSON.stringify(refs.flatMap((r, i) => {
      const vivant = r.deref()
      return vivant ? [{ indice: i, nature: Object.hasOwn(vivant, 'valide') ? 'preuve' : 'source', propres: Reflect.ownKeys(vivant).map(String) }] : []
    })))
  }
  await collecter([source, ...anciens.flat()])
  const tailles = []
  for (let lot = 0; lot < 4; lot++) {
    const avant = { ...p.compteur }
    const nouveaux = creer(256)
    assert.equal(p.compteur.liensExamines - avant.liensExamines, p.compteur.inscriptions - avant.inscriptions)
    assert.ok(preuve.parents.size <= 256)
    tailles.push(preuve.parents.size)
    await collecter(nouveaux.flat())
  }
  assert.ok(tailles.every((n) => n <= 256))
  t.diagnostic(JSON.stringify({ formesCompletes, parents: tailles, inscriptions: p.compteur.inscriptions, liensExamines: p.compteur.liensExamines }))
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
test('cellules BOOL : équivalence canonique dans chaque historique et modes des deux hits', async () => {
  const p = (await evaluateurDePreuves({ lecture: () => null, cible: () => null })).preuves
  const cache = new WeakMap()
  const cle = (x, cellules, memo = null) => p.cleCanonique(({ referenceDe }) => referenceDe(x), x, memo, { strict: true, cellules })
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
    for (let tour = 0; tour < 3; tour++) for (const mode of modes) {
      assert.equal(cle(racine, mode, cache), cle(racine, mode))
      assert.equal(cache.get(racine).cellules, mode)
    }
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
test('cellules BOOL : plateau, croissance distincte et registre sans objets Source', async () => {
  const p = (await evaluateurDePreuves({ lecture: () => null, cible: () => null })).preuves
  const compter = (branche = p.cellulesBooleennes) => 1 + [...branche.values()].reduce(
    (n, valeur) => n + (valeur instanceof Map ? compter(valeur) : 1), 0)
  const cle = (x) => p.cleCanonique(({ referenceDe }) => referenceDe(x), x, null, { strict: true, cellules: true })
  const racine = { enfant: [{ booleen: true }], ctx: { f: 'a', env: null }, pile: [] }
  const sources = new Set([racine, racine.enfant, racine.enfant[0], racine.ctx, racine.pile])
  const exacte = cle(racine)
  const debut = compter()
  for (let i = 0; i < 100; i++) assert.equal(cle(structuredClone(racine)), exacte)
  assert.equal(compter(), debut)
  for (let i = 0; i < 10; i++) cle({ enfant: [{ booleen: true }], ctx: { f: String(i), env: null }, pile: [] })
  const distincts = compter()
  assert.ok(distincts > debut)
  racine.enfant[0].booleen = false
  assert.notEqual(cle(racine), exacte)
  assert.ok(compter() > distincts)
  const visiter = (v, vus = new Set()) => {
    assert.equal(sources.has(v), false)
    if (!v || typeof v !== 'object' || vus.has(v)) return
    vus.add(v)
    if (v instanceof Map) for (const [k, x] of v) { visiter(k, vus); visiter(x, vus) }
    else for (const x of Object.values(v)) visiter(x, vus)
  }
  visiter(p.cellulesBooleennes)
  const refuse = Object.freeze({ get v() { throw new Error('getter') } })
  const avantRefus = compter()
  assert.equal(cle(refuse), null)
  assert.equal(compter(), avantRefus)
  const autre = (await evaluateurDePreuves({ lecture: () => null, cible: () => null })).preuves
  assert.notEqual(autre.cellulesBooleennes, p.cellulesBooleennes)
  assert.equal(autre.cellulesBooleennes.size, 0)
})

// #2586
test('slots gelés : descendants, formes fraîches, admission locale et prototypes', async () => {
  const ev = await evaluateurDePreuves({ lecture: () => null, cible: () => null })
  const p = ev.preuves
  const cache = new WeakMap()
  const cle = (x, memo = cache, strict = true) => p.cleCanonique(({ referenceDe }) => referenceDe(x), x, memo, { strict })
  const enfant = { v: true }
  const parent = Object.freeze({ enfant })
  const avant = cle(parent)
  assert.equal(cle(parent), avant)
  assert.ok(p.slotsGeles.has(parent))
  assert.equal(p.slotsGeles.has(enfant), false)
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
  for (const x of refuses) for (let tour = 0; tour < 2; tour++) {
    assert.equal(cle(x), null)
    assert.equal(p.slotsGeles.has(x), false)
  }
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
test('certificat du graphe gelé : clé exacte, hit sans records et révisions des formes', async () => {
  const p = (await evaluateurDePreuves({ lecture: () => null, cible: () => null })).preuves
  const cache = new WeakMap()
  let encodages = 0
  const cle = (x, memo = cache, strict = true) => p.cleCanonique(({ referenceDe }) => {
    encodages++
    return referenceDe(x)
  }, x, memo, { strict })
  const geler = (x) => { gelerProfond(x); return x }
  const forme = (v) => geler({ e: { k: 'lit', v }, ctx: { f: 'banc.mjs', env: { args: [] } } })
  const enfant = geler([{ texte: 'src/a' }])
  const racine = geler({ enfant, autre: [true, null] })
  const exacte = cle(racine)
  assert.equal(exacte, cle({ autre: [true, null], enfant: [{ texte: 'src/a' }] }, null))
  assert.ok(cache.get(racine).certificat)
  const froid = encodages
  const records = p.compteur.records
  assert.equal(cle(racine), exacte)
  assert.equal(encodages, froid)
  assert.equal(p.compteur.records, records)
  const premier = cache.get(racine)
  const exterieur = {}
  p.formesDesArguments.set(exterieur, forme('src/exterieur'))
  assert.equal(cle(racine), exacte)
  assert.equal(cache.get(racine), premier)
  assert.equal(encodages, froid)
  assert.equal(p.compteur.records - records, 0)
  const revalides = p.compteur.records
  assert.equal(cle(racine), exacte)
  assert.equal(p.compteur.records, revalides)
  assert.equal(encodages, froid)
  p.formesDesArguments.set(enfant, undefined)
  let modifiePendantRevalidation = false
  p.compteur.avantRecord = () => {
    if (modifiePendantRevalidation) return
    modifiePendantRevalidation = true
    p.formesDesArguments.set(exterieur, forme('src/exterieur-3'))
  }
  assert.equal(cle(racine), exacte)
  delete p.compteur.avantRecord
  assert.equal(modifiePendantRevalidation, true)
  assert.equal(cache.get(racine).certificat, null)
  assert.equal(encodages, froid)
  const avantRecertification = p.compteur.records
  assert.equal(cle(racine), exacte)
  assert.equal(p.compteur.records - avantRecertification, premier.objets.length)
  assert.ok(cache.get(racine).certificat)
  const apresRecertification = p.compteur.records
  assert.equal(cle(racine), exacte)
  assert.equal(p.compteur.records, apresRecertification)
  assert.equal(encodages, froid)
  assert.equal(p.formesDesArguments.set(enfant, forme('src/a')), p.formesDesArguments)
  const avecForme = cle(racine)
  assert.notEqual(avecForme, exacte)
  assert.notEqual(cache.get(racine), premier)
  assert.ok(cache.get(racine).certificat)
  assert.equal(avecForme, cle(racine, null))
  const association = p.formesDesArguments.get(enfant)
  const memo = cache.get(racine)
  const avantSansMutation = encodages
  p.formesDesArguments.set(enfant, association)
  assert.equal(p.formesDesArguments.delete({}), false)
  assert.equal(cle(racine), avecForme)
  assert.equal(cache.get(racine), memo)
  assert.equal(encodages, avantSansMutation)
  p.formesDesArguments.set(enfant, forme('src/b'))
  assert.notEqual(cle(racine), avecForme)
  assert.equal(p.formesDesArguments.delete(enfant), true)
  assert.equal(cle(racine), exacte)
  const mutable = { v: true }
  const parent = Object.freeze({ mutable })
  const avant = cle(parent)
  assert.equal(cache.get(parent).certificat, null)
  mutable.v = false
  assert.notEqual(cle(parent), avant)
  const expression = { k: 'lit', v: 'src/c' }
  const tableau = geler([{ texte: 'src/c' }])
  p.formesDesArguments.set(tableau, Object.freeze({ e: expression, ctx: geler({ f: 'banc.mjs', env: null }) }))
  const avantExpression = cle(tableau)
  assert.equal(cache.get(tableau).certificat, null)
  expression.v = 'src/d'
  assert.notEqual(cle(tableau), avantExpression)
  const env = { args: [], fn: 'f' }
  const tableauEnv = geler([{ texte: 'src/e' }])
  p.formesDesArguments.set(tableauEnv, Object.freeze({ e: geler({ k: 'lit', v: 'src/e' }), ctx: Object.freeze({ f: 'banc.mjs', env }) }))
  const avantEnv = cle(tableauEnv)
  assert.equal(cache.get(tableauEnv).certificat, null)
  env.fn = 'g'
  assert.notEqual(cle(tableauEnv), avantEnv)
  const pendantEncodage = geler([{ texte: 'src/f' }])
  p.cleCanonique(({ referenceDe }) => {
    const reference = referenceDe(pendantEncodage)
    p.formesDesArguments.set(pendantEncodage, forme('src/f'))
    return reference
  }, pendantEncodage, cache, { strict: true })
  assert.equal(cache.get(pendantEncodage).certificat, null)
  const nonStrict = geler({ v: [true] })
  cle(nonStrict, cache, false)
  assert.equal(cache.get(nonStrict).certificat, null)
  const sansCache = encodages
  cle(racine, null)
  cle(racine, null)
  assert.equal(encodages, sansCache + 2)
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
test('façade des formes : contrat natif, absence, undefined, chaîne et contournement refusé', async () => {
  const p = (await evaluateurDePreuves({ lecture: () => null, cible: () => null })).preuves
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
  const cle = () => p.cleCanonique(({ referenceDe }) => referenceDe(a), a, cache, { strict: true })
  const avant = cle()
  const memo = cache.get(a)
  assert.throws(() => table.set(0, b), TypeError)
  assert.equal(cle(), avant)
  assert.equal(cache.get(a), memo)
})

// #2586
test('entrée BOOL : clés exactes froides, chaudes et réallouées sans réencodage postérieur', async () => {
  const source = lire('inédit.mjs', 'export function choisi(flag) { return flag }')
  const runs = []
  for (const sansCacheEntree of [false, true]) {
    const ev = await evaluateurDePreuves({ lecture: () => source, cible: () => 'inédit.mjs' }, { sansCacheEntree })
    const p = ev.preuves
    const expression = () => ({ k: 'appel', cible: { k: 'importe', spec: './inédit.mjs', nom: 'choisi' }, args: [{ k: 'booleen', v: true }] })
    const e = expression(), ctx = { f: 'banc.mjs', env: null }
    const sorties = []
    for (const [entree, contexte] of [[e, ctx], [e, ctx], [expression(), { ...ctx }]]) {
      const avant = p.compteur.encodagesEntree
      const debut = p.compteur.clesEntree.length
      sorties.push(ev.tracer(() => p.booleenDe(entree, contexte)))
      const cles = p.compteur.clesEntree.slice(debut)
      assert.equal(cles.length, 2)
      assert.equal(cles[0], cles[1])
      assert.equal(p.compteur.encodagesEntree - avant, sansCacheEntree ? 2 : 1)
    }
    assert.deepEqual(sorties[1], sorties[0])
    assert.deepEqual(sorties[2], sorties[0])
    runs.push({ sorties, cles: p.compteur.clesEntree })
  }
  assert.deepEqual(runs[0], runs[1])
})

// #2586
test('entrée BOOL : mutations pendant calcul et validation Source requalifiées', async () => {
  const cas = [
    (e) => { e.args[0].v = false },
    (_, ctx) => { ctx.env.args[0][0].booleen = false },
    (e) => { e.cible.nom = 'autre' },
    (e) => { e.args.push({ k: 'booleen', v: false }) },
    (e) => { Object.setPrototypeOf(e.args[0], { supplement: true }) },
    (e) => { e.alias = e.args[0]; e.cycle = e },
    (e, ctx, p) => { p.formesDesArguments.set(e.args, { e: { k: 'booleen', v: false }, ctx }) },
    (e, ctx, p, observer) => { Object.defineProperty(e.args[0], 'extra', { enumerable: true, get() { observer(); return false } }) },
  ]
  for (const phase of ['calcul', 'validation']) for (const muter of cas) {
    const runs = []
    for (const sansCacheEntree of [false, true]) {
      let action, getters = 0, lecturesGetter = 0
      const source = lire('inédit.mjs', 'export function choisi(flag) { return flag }; export function autre(flag) { return false }')
      const ev = await evaluateurDePreuves({ lecture: () => { action?.(); return source }, cible: () => 'inédit.mjs' }, { sansCacheEntree })
      const e = { k: 'appel', cible: { k: 'importe', spec: './inédit.mjs', nom: 'choisi' }, args: [{ k: 'booleen', v: true }] }
      const ctx = { f: 'banc.mjs', env: { fn: 'f', args: [[{ booleen: true }]] } }
      const sorties = []
      if (phase === 'validation') sorties.push(ev.tracer(() => ev.preuves.booleenDe(e, ctx)))
      action = () => { action = null; muter(e, ctx, ev.preuves, () => { lecturesGetter++ }); getters++ }
      sorties.push(ev.tracer(() => ev.preuves.booleenDe(e, ctx)))
      sorties.push(ev.tracer(() => ev.preuves.booleenDe(e, ctx)))
      runs.push({ sorties, getters, lecturesGetter, preuves: ev.preuves.preuvesBooleennes.size, cles: ev.preuves.compteur.clesEntree })
      assert.equal(getters, 1)
      assert.notEqual(ev.preuves.compteur.clesEntree.at(-1), ev.preuves.compteur.clesEntree[0])
    }
    assert.deepEqual(runs[0], runs[1])
  }
})

test('preuves scalaires : N+1 importé, requêtes, mutations de source et arguments réalloués', async (t) => {
  let source = lire('nouveau.mjs', 'export function inédit(flag = false) { return flag }')
  const ev = await evaluateurDePreuves({ lecture: () => source, cible: () => 'nouveau.mjs' })
  const expression = (flag) => ({ k: 'appel', cible: { k: 'importe', spec: './nouveau.mjs', nom: 'inédit' }, args: [{ k: 'booleen', v: flag }] })
  const ctx = { f: 'banc.mjs', env: null }
  const froid = ev.tracer(() => ev.preuves.booleenDe(expression(true), ctx))
  const avant = ev.preuves.compteur.valeurs
  const chaud = ev.tracer(() => ev.preuves.booleenDe(expression(true), { ...ctx }))
  assert.equal(froid.resultat, true)
  assert.deepEqual(chaud, froid)
  assert.equal(ev.preuves.compteur.valeurs, avant)
  assert.ok(froid.requetes.has(JSON.stringify(['lecture', 'nouveau.mjs'])))
  assert.ok(froid.requetes.has(JSON.stringify(['cible', 'banc.mjs', './nouveau.mjs'])))
  t.diagnostic(`évaluations froid=${avant}, chaud=${ev.preuves.compteur.valeurs - avant}, requêtes=${froid.requetes.size}`)
  assert.equal(ev.preuves.booleenDe(expression(false), ctx), false)
  const e = expression(true)
  assert.equal(ev.preuves.booleenDe(e, ctx), true)
  e.args[0].v = false
  assert.equal(ev.preuves.booleenDe(e, ctx), false)
  source.fonctions.inédit.retours[0] = { k: 'booleen', v: true }
  assert.equal(ev.preuves.booleenDe(e, ctx), true)
  source = lire('nouveau.mjs', 'export function inédit(flag = false) { return false }')
  assert.equal(ev.preuves.booleenDe(e, ctx), false)
})

test('preuves scalaires : graphes refusés sans effet technique, sources à getter et consensus public', async () => {
  let getters = 0
  let valeur = true
  const source = { exports: { flag: { k: 'booleen', get v() { getters++; return valeur } } }, etoiles: [], fonctions: {}, sites: [] }
  const ev = await evaluateurDePreuves({ lecture: () => source, cible: () => 'flag.mjs' })
  const ctx = { f: 'banc.mjs', env: null }
  const condition = { k: 'importe', spec: './flag.mjs', nom: 'flag' }
  assert.equal(ev.preuves.booleenDe(condition, ctx), true)
  assert.equal(getters, 1)
  assert.equal(ev.preuves.booleenDe(condition, ctx), true)
  assert.equal(getters, 2)
  valeur = false
  assert.equal(ev.preuves.booleenDe(condition, ctx), false)
  assert.equal(getters, 3)
  assert.equal(ev.preuves.preuvesBooleennes.size, 0)
  for (const v of [true, false]) {
    const e = Object.create(null, { k: { value: 'booleen', enumerable: true }, v: { value: v } })
    assert.equal(ev.preuves.booleenDe(e, ctx), v)
  }
  const composite = { vrai: true }
  assert.equal(ev.preuves.booleenDe({ k: 'booleen', v: composite }, ctx), composite)
  composite.vrai = false
  assert.equal(ev.preuves.booleenDe({ k: 'booleen', v: composite }, ctx), composite)
  assert.equal(ev.preuves.preuvesBooleennes.size, 0)
  for (const [e, attendu] of [[{ k: 'liste', v: [] }, null], [{ k: 'non', raison: 'opaque' }, null],
    [{ k: 'booleen', v: false }, false], [{ k: 'union', v: [{ k: 'booleen', v: false }, { k: 'booleen', v: true }] }, null]])
    for (let tour = 0; tour < 2; tour++) assert.equal(ev.preuves.booleenDe(e, ctx), attendu)
  let pieges = 0
  const proxy = new Proxy({ k: 'booleen', v: true }, {
    get(cible, nom) { pieges++; return cible[nom] },
    ownKeys() { throw new Error('ownKeys technique') },
    getOwnPropertyDescriptor() { throw new Error('descriptor technique') },
  })
  assert.equal(ev.preuves.booleenDe(proxy, ctx), true)
  assert.equal(pieges, 2)
  let json = 0
  const e = { k: 'booleen', v: true, toJSON() { json++; return false } }
  assert.equal(ev.preuves.booleenDe(e, ctx), true)
  assert.equal(json, 0)
  let lecturesCtx = 0
  const ctxGetter = { f: 'banc.mjs', get env() { lecturesCtx++; return null } }
  for (let i = 0; i < 2; i++) assert.equal(ev.preuves.booleenDe({ k: 'booleen', v: true }, ctxGetter), true)
  assert.equal(lecturesCtx, 2)
  const cle = (x) => ev.preuves.cleCanonique(({ referenceDe }) => referenceDe(x), x, null, { strict: true })
  for (const x of [tableauCreux(), Object.assign([1], { map: Array.prototype.map }), Object.assign([1], { extra: 1 }),
    Object.assign({}, { [Symbol('x')]: 1 }), Object.create({ x: 1 }), { enfant: { get v() { throw new Error('getter technique') } } }])
    assert.equal(cle(x), null)
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
      const a = ev.preuves.booleenDe(e, contexte)
      const froid = herites
      assert.ok(froid > 0, nom)
      assert.equal(ev.preuves.booleenDe(e, contexte), a)
      assert.equal(herites, 2 * froid, nom)
    } finally {
      if (precedent) Object.defineProperty(Object.prototype, nom, precedent)
      else delete Object.prototype[nom]
    }
  }
  const precedent = Object.getOwnPropertyDescriptor(Object.prototype, 'toJSON')
  try {
    Object.defineProperty(Object.prototype, 'toJSON', { configurable: true, value() { json++; return {} } })
    assert.equal(ev.preuves.booleenDe({ k: 'booleen', v: true }, ctx), true)
    assert.equal(json, 0)
  } finally {
    if (precedent) Object.defineProperty(Object.prototype, 'toJSON', precedent)
    else delete Object.prototype.toJSON
  }
})

test('preuves scalaires : alias du getter canonique avant import frais gardent leurs effets', async () => {
  for (const nom of ['v', 'k']) {
    const prototype = Object.getOwnPropertyDescriptor(Object.prototype, '__proto__')
    const precedent = Object.getOwnPropertyDescriptor(Object.prototype, nom)
    const url = new URL(`./racinesBalayees.mjs?alias-prototype-${nom}`, import.meta.url).href
    let appels = 0
    let valeur = nom === 'v' ? true : 'booleen'
    const getter = function () { appels++; return valeur }
    let hook
    try {
      Object.defineProperty(Object.prototype, '__proto__', { ...prototype, get: getter })
      Object.defineProperty(Object.prototype, nom, { configurable: true, get: getter })
      hook = registerHooks({ load(specifier, contexte, suivant) {
        const rendu = suivant(specifier, contexte)
        if (specifier !== url) return rendu
        const texte = Buffer.from(rendu.source).toString('utf8')
        assert.equal(texte.split('    valeurs,').length, 2)
        return { ...rendu, source: texte.replace('    valeurs,', '    preuves: { booleenDe },\n    valeurs,') }
      } })
      const ev = (await import(url)).evaluateurDuDepot({ lecture: () => null, cible: () => null })
      const expression = nom === 'v' ? { k: 'booleen' } : { v: true }
      const ctx = { f: 'banc.mjs', env: null }
      assert.equal(Object.hasOwn(expression, nom), false)
      appels = 0
      assert.equal(ev.preuves.booleenDe(expression, ctx), true, nom)
      const froid = appels
      assert.ok(froid > 0, nom)
      assert.equal(ev.preuves.booleenDe(expression, ctx), true, nom)
      assert.equal(appels, 2 * froid, nom)
      valeur = nom === 'v' ? false : 'non'
      assert.equal(ev.preuves.booleenDe(expression, ctx), nom === 'v' ? false : null, nom)
      assert.ok(appels > 2 * froid, nom)
    } finally {
      hook?.deregister()
      Object.defineProperty(Object.prototype, '__proto__', prototype)
      if (precedent) Object.defineProperty(Object.prototype, nom, precedent)
      else delete Object.prototype[nom]
    }
  }
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

test('preuves scalaires : formes complètes, parents, paramètres, modes et cycles de contexte', async () => {
  const ev = await evaluateurDePreuves({ lecture: () => null, cible: () => null })
  const p = ev.preuves
  const cle = (x) => p.cleCanonique(({ referenceDe }) => referenceDe(x), x, null, { strict: true })
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
    assert.equal(p.booleenDe(e, { f: 'banc.mjs', env }), v)
  }
  const defaut = { k: 'paramLambda', fn: 'inner', index: 0, nom: 'flag' }
  for (const v of [false, true]) assert.equal(p.booleenDe(defaut, { f: 'banc.mjs',
    env: { fn: 'inner', args: [], params: [{ defaut: { k: 'booleen', v } }] } }), v)
  const expr = { k: 'champ', de: { k: 'objet', objetDirect: true, v: {}, etales: [{ k: 'objet', objetDirect: true, v: { flag: { k: 'booleen', v: false } } }] }, nom: 'flag', texte: 'flag', defaut: { k: 'booleen', v: true } }
  for (const preuveBooleenne of [false, true]) assert.equal(p.booleenDe(expr, { f: 'banc.mjs', env: null, preuveBooleenne }), null)
  delete expr.de.etales
  expr.de.v.flag = { k: 'booleen', v: false }
  assert.equal(p.booleenDe(expr, { f: 'banc.mjs', env: null }), false)
  expr.de.objetDirect = false
  assert.equal(p.booleenDe(expr, { f: 'banc.mjs', env: null }), null)
  const cyclique = { fn: 'inner', args: [], params: [] }
  cyclique.parent = cyclique
  const c = forme(cyclique)
  assert.equal(typeof cle(c), 'string')
  assert.equal(cle(c), cle(c))
})

test('preuves scalaires : pile exacte, profondeur et réentrées dans les deux ordres', async () => {
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
    const ev = await evaluateurDePreuves({ lecture: () => source, cible: () => null })
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
test('clés canoniques : DAG partagé, réallocation, ordre, formes, provenance et cycles', async (t) => {
  const url = new URL('./racinesBalayees.mjs?cles-canoniques', import.meta.url).href
  const urlAvant = new URL('./racinesBalayees.mjs?cles-canoniques-cc684', import.meta.url).href
  const hook = registerHooks({ load(specifier, contexte, suivant) {
    const rendu = suivant(specifier, contexte)
    if (specifier !== url && specifier !== urlAvant) return rendu
    let texte = Buffer.from(rendu.source).toString('utf8')
    if (specifier === urlAvant) {
      const debut = texte.indexOf('    const descripteurs = new Map()')
      const fin = texte.indexOf('    const memo = new WeakMap()', debut)
      assert.ok(debut > 0 && fin > debut)
      const bloc = texte.slice(debut, fin)
      assert.equal(texte.split(bloc).length, 2)
      const gabarit = `    const descripteurs = new Map()
    const table = []
    const tuple = (...valeurs) => valeurs
    const interner = (descriptor) => {
      const cle = JSON.stringify(descriptor)
      if (!descripteurs.has(cle)) {
        descripteurs.set(cle, table.length)
        table.push(descriptor)
      }
      return descripteurs.get(cle)
    }
`
      texte = texte.replace(bloc, () => gabarit)
    }
    const ancre = '    valeurs,'
    assert.equal(texte.split(ancre).length, 2)
    if (specifier === url) {
      const debut = texte.indexOf('    const tokensDe =')
      const fin = texte.indexOf('    const interner =', debut)
      assert.ok(debut > 0 && fin > debut)
      let tokens = texte.slice(debut, fin)
      for (const [nom, appel] of [['proxy', 'types.isProxy(v)'], ['tableau', 'Array.isArray(v)'],
        ['prototype', 'Object.getPrototypeOf(v)'], ['jsonPropre', "Object.hasOwn(v, 'toJSON')"],
        ['cellule', 'Object.getOwnPropertyDescriptor(v, i)']])
        tokens = tokens.replaceAll(appel, `(compact.inspections.${nom}++, ${appel})`)
      tokens = tokens.replace('if (lectureDirecte) {', 'if (lectureDirecte) { compact.inspections.directes++;')
      texte = texte.slice(0, debut) + tokens + texte.slice(fin)
    }
    return { ...rendu, source: texte.replace('  const clesDesValeurs =', '  let encodages = 0\n  let serialisations = 0\n  const compact = { signatures: 0, tokens: 0, sousDescripteurs: 0 }\n  const clesDesValeurs =')
      .replace('sousDescripteurs: 0 }', 'sousDescripteurs: 0, inspections: { proxy: 0, tableau: 0, prototype: 0, jsonPropre: 0, cellule: 0, directes: 0 } }')
      .replace('    const interner = (descriptor) => {', '    const interner = (descriptor) => {\n      encodages++')
      .replace("      let signature = ''", "      compact.signatures++\n      compact.tokens += tokens.length\n      let signature = ''")
      .replace('if (!sousDescripteurs.has(signature)) sousDescripteurs.set(signature, sousDescripteurs.size)', 'if (!sousDescripteurs.has(signature)) { compact.sousDescripteurs++; sousDescripteurs.set(signature, sousDescripteurs.size) }')
      .replace('const cle = JSON.stringify(descriptor)', 'const cle = (serialisations++, JSON.stringify(descriptor))')
      .replace('const cle = JSON.stringify([reference, table])', 'const cle = (serialisations++, JSON.stringify([reference, table]))')
      .replace(ancre, '    cles: { cleCanonique, cleDesArgs, formesDesArguments, cleDe, compact, encodages: () => encodages, serialisations: () => serialisations },\n    valeurs,') }
  } })
  let construire
  let construireAvant
  try {
    construire = (await import(url)).evaluateurDuDepot
    construireAvant = (await import(urlAvant)).evaluateurDuDepot
  } finally { hook.deregister() }
  const neuf = () => construire({ lecture: () => null, cible: () => null }).cles
  const ancien = () => construireAvant({ lecture: () => null, cible: () => null }).cles
  const p = neuf()
  const o = ancien()
  const dag = (sonde, profondeur, variante = {}) => {
    let args = null
    for (let niveau = 0; niveau <= profondeur; niveau++) {
      const enfant = args
      args = Array.from({ length: 2 }, () => {
        const a = [{ texte: 'src/a' }]
        const expression = variante.forme && niveau === profondeur ? { k: 'liste', v: [{ k: 'lit', v: 'src/a' }] } : { k: 'lit', v: 'src/a' }
        sonde.formesDesArguments.set(a, { e: variante.lie ? { k: 'lie', de: expression, ctx: { f: 'banc.mjs', env: enfant ? { fn: 'f', args: enfant } : null } } : expression,
          ctx: { f: variante.module && niveau === profondeur ? 'autre.mjs' : 'banc.mjs', env: enfant ? { fn: 'f', args: enfant } : null } })
        return a
      })
    }
    return args
  }
  const projection = (sonde, descriptors) => sonde.cleCanonique(({ interner }) => descriptors.map(interner), null, null)
  await t.test('tuples privés : inspections évitées, tableaux externes et gardes JSON conservés', () => {
    const prive = neuf()
    const externe = neuf()
    const temoin = ancien()
    const faire = ({ tuple, interner }) => [interner(tuple('parent', tuple('enfant', 7))), interner(tuple('parent', tuple('enfant', 7)))]
    const descriptors = [['parent', ['enfant', 7]], ['parent', ['enfant', 7]]]
    assert.equal(prive.cleCanonique(faire, null, null), projection(temoin, descriptors))
    assert.equal(projection(externe, descriptors), projection(temoin, descriptors))
    assert.deepEqual(prive.compact.inspections, { proxy: 0, tableau: 0, prototype: 0, jsonPropre: 0, cellule: 0, directes: 8 })
    assert.deepEqual(externe.compact.inspections, { proxy: 4, tableau: 8, prototype: 4, jsonPropre: 4, cellule: 8, directes: 0 })
    t.diagnostic(`Inspections privé ${JSON.stringify(prive.compact.inspections)} ; externe ${JSON.stringify(externe.compact.inspections)}`)
    for (const prototype of [Array.prototype, Object.prototype]) {
      const precedent = Object.getOwnPropertyDescriptor(prototype, 'toJSON')
      let appels = 0
      const json = function () { appels++; return ['json', this.length] }
      try {
        Object.defineProperty(prototype, 'toJSON', { configurable: true, value: json })
        const sonde = neuf()
        const cle = sonde.cleCanonique(faire, null, null)
        const observes = appels
        appels = 0
        assert.equal(cle, temoin.cleCanonique(faire, null, null))
        assert.equal(observes, appels)
        assert.equal(sonde.compact.inspections.directes, 0)
        assert.equal(sonde.serialisations(), 3)
      } finally {
        if (precedent) Object.defineProperty(prototype, 'toJSON', precedent)
        else delete prototype.toJSON
      }
    }
    let pieges = 0
    const proxy = new Proxy(['enfant', 7], { get(cible, nom, receveur) { pieges++; return Reflect.get(cible, nom, receveur) } })
    const sonde = neuf()
    const cleProxy = projection(sonde, [['parent', proxy]])
    const observes = pieges
    pieges = 0
    assert.equal(cleProxy, projection(temoin, [['parent', proxy]]))
    assert.equal(observes, pieges)
    assert.equal(sonde.compact.inspections.directes, 0)
  })
  await t.test('internage structurel local : parents emboîtés, marqueurs et table originale', () => {
    const sonde = neuf()
    const temoin = ancien()
    const partage = ['S3:L;', 7, null, true]
    const emboite = [partage, partage, [partage, ['E;', 0]], { a: partage, b: 7 }]
    const descriptors = Array.from({ length: 80 }, (_, i) => ['parent', i, emboite])
    descriptors.push(['parent', 0, structuredClone(emboite)], ['parent', 0, [7]], ['parent', 0, 7],
      ['parent', 0, { a: 7 }], ['parent', 0, [['a', 7]]], ['parent', 0, [8]])
    descriptors.push(['parent', 0, []], ['parent', 0, {}], ['parent', 0, { toJSON: () => ['json', 7] }])
    const cle = projection(sonde, descriptors)
    assert.equal(cle, projection(temoin, descriptors))
    const [references, table] = JSON.parse(cle)
    assert.equal(references[80], references[0])
    assert.equal(new Set(references.slice(81)).size, 8)
    assert.deepEqual(table[references[0]], descriptors[0])
    const tokensPlats = (v) => v && typeof v === 'object' ? Array.isArray(v)
      ? 2 + v.reduce((n, enfant) => n + tokensPlats(enfant), 0)
      : 2 + Object.values(v).reduce((n, enfant) => n + 1 + tokensPlats(enfant), 0) : 1
    const volumePlat = descriptors.reduce((n, descriptor) => n + tokensPlats(descriptor), 0)
    assert.ok(sonde.compact.sousDescripteurs < volumePlat / 4)
    assert.ok(sonde.compact.signatures > sonde.compact.sousDescripteurs)
    t.diagnostic(`Compact : ${sonde.compact.sousDescripteurs} sous-descripteurs uniques, ${sonde.compact.signatures} signatures locales, ${volumePlat} tokens plats témoins`)
  })
  const fonction = () => {}
  const avecJSON = () => {}
  avecJSON.toJSON = () => 'fonction'
  const creux = tableauCreux()
  assert.equal(creux.length, 2)
  assert.equal(Object.hasOwn(creux, 0), false)
  assert.equal(Object.hasOwn(creux, 1), true)
  assert.equal(creux[1], 1)
  const cas = [
    [['nombre', -0], ['nombre', 0], ['nombre', NaN], ['nombre', Infinity], ['nombre', null]],
    [['absence', undefined], ['absence', fonction], ['absence', Symbol('s')], ['absence', null]],
    [['fonction', avecJSON], ['fonction', 'fonction']],
    [['objet', { b: 2, a: 1 }], ['objet', { a: 1, b: 2 }]],
    [['objet', { a: undefined, b: fonction, c: null }], ['objet', { c: null }]],
    [['liste', creux], ['liste', [null, 1]], ['liste', [1, null]], ['texte', '\\u0000"[]{}']],
    [['json', { toJSON: () => ({ b: 2, a: 1 }) }], ['json', { b: 2, a: 1 }]],
  ]
  for (const descriptors of cas) assert.equal(projection(p, descriptors), projection(o, descriptors))
  assert.throws(() => projection(p, [['bigint', 1n]]), TypeError)
  assert.throws(() => projection(o, [['bigint', 1n]]), TypeError)
  const circulaire = {}
  circulaire.a = circulaire
  assert.throws(() => projection(p, [['json', circulaire]]), TypeError)
  assert.throws(() => projection(o, [['json', circulaire]]), TypeError)
  const tableauCirculaire = []
  tableauCirculaire.push(tableauCirculaire)
  assert.throws(() => projection(p, [['json', tableauCirculaire]]), TypeError)
  assert.throws(() => projection(o, [['json', tableauCirculaire]]), TypeError)
  const descriptorVide = []
  descriptorVide.toJSON = () => undefined
  assert.equal(projection(p, [descriptorVide, descriptorVide]), projection(o, [descriptorVide, descriptorVide]))
  const avantProjection = p.serialisations()
  projection(p, [['a', 1, [2, true, null]], ['a', 1, [2, true, null]], ['a', 2]])
  assert.equal(p.serialisations() - avantProjection, 1)
  let provenance = 'banc.mjs'
  const dynamique = () => {}
  dynamique.toJSON = () => provenance
  for (const f of [dynamique, { toJSON: () => provenance }]) {
    const a = [{ texte: 'src/a' }]
    const args = [a]
    p.formesDesArguments.set(a, { e: { k: 'lit', v: 'src/a' }, ctx: { f, env: null } })
    const premiere = p.cleDesArgs(args)
    provenance = 'autre.mjs'
    assert.notEqual(p.cleDesArgs(args), premiere)
    provenance = 'banc.mjs'
    assert.equal(p.cleDesArgs(args), premiere)
  }
  t.diagnostic('Projection JSON : collisions null/undefined/fonction/symbole, -0/0, non-finis, ordre objet, trous, toJSON et erreurs identiques ; toJSON mutable fonction et objet : clé invalidée')
  const longueurs = []
  for (const profondeur of [0, 4, 8, 16, 32]) {
    const args = dag(p, profondeur)
    const cle = p.cleDesArgs(args)
    assert.equal(cle, o.cleDesArgs(dag(o, profondeur)))
    for (const variante of [{ forme: true }, { module: true }, { lie: true }])
      assert.equal(p.cleDesArgs(dag(p, profondeur, variante)), o.cleDesArgs(dag(o, profondeur, variante)))
    longueurs.push(cle.length)
    assert.equal(p.cleDesArgs(args), cle)
    assert.equal(p.cleDesArgs(dag(p, profondeur)), cle)
    assert.notEqual(p.cleDesArgs(dag(p, profondeur, { forme: true })), cle)
    assert.notEqual(p.cleDesArgs(dag(p, profondeur, { module: true })), cle)
    const q = neuf()
    q.cleDesArgs([[{ texte: 'préambule' }]])
    assert.equal(q.cleDesArgs(dag(q, profondeur)), cle)
    assert.ok(cle.length < 600 * (profondeur + 1))
  }
  assert.ok(longueurs.at(-1) < 5 * longueurs[2])
  const repetes = dag(p, 16)
  const avantDag = p.encodages()
  const avantSerialisations = p.serialisations()
  const repetee = p.cleDesArgs(repetes)
  assert.equal(p.serialisations() - avantSerialisations, 1)
  const avant = p.encodages()
  for (let i = 0; i < 20; i++) assert.equal(p.cleDesArgs(repetes), repetee)
  assert.equal(p.encodages(), avant)
  t.diagnostic(`DAG partagé : ${avant - avantDag} encodages initiaux, ${p.encodages() - avant} pour 20 répétitions`)
  const formeRepetee = p.formesDesArguments.get(repetes[0])
  formeRepetee.e.v = 'docs/mutation'
  assert.notEqual(p.cleDesArgs(repetes), repetee)
  assert.ok(p.encodages() > avant)
  formeRepetee.e.v = 'src/a'
  assert.equal(p.cleDesArgs(repetes), repetee)
  formeRepetee.ctx.f = 'autre.mjs'
  assert.notEqual(p.cleDesArgs(repetes), repetee)
  formeRepetee.ctx.f = 'banc.mjs'
  const enfantRepete = formeRepetee.ctx.env.args
  const ancienneForme = p.formesDesArguments.get(enfantRepete[0])
  p.formesDesArguments.set(enfantRepete[0], { ...ancienneForme, e: { k: 'liste', v: [ancienneForme.e] } })
  assert.notEqual(p.cleDesArgs(repetes), repetee)
  p.formesDesArguments.set(enfantRepete[0], ancienneForme)
  assert.equal(p.cleDesArgs(repetes), repetee)
  enfantRepete[0][0].texte = 'docs/enfant'
  assert.notEqual(p.cleDesArgs(repetes), repetee)
  enfantRepete[0][0].texte = 'src/a'
  assert.equal(p.cleDesArgs(repetes), repetee)
  const objetRepete = { objet: { fichier: { k: 'lit', v: 'src/a' } }, ctx: { f: 'banc.mjs', env: null } }
  const cleObjet = p.cleDe(objetRepete)
  const avantObjet = p.encodages()
  for (let i = 0; i < 20; i++) assert.equal(p.cleDe(objetRepete), cleObjet)
  assert.equal(p.encodages(), avantObjet)
  objetRepete.objet.fichier.v = 'docs/mutation'
  assert.notEqual(p.cleDe(objetRepete), cleObjet)
  let contenu = 'src/a'
  const accesseur = { get texte() { return contenu } }
  const objetAccesseur = { objet: accesseur }
  const cleAccesseur = p.cleDe(objetAccesseur)
  contenu = 'docs/mutation'
  assert.notEqual(p.cleDe(objetAccesseur), cleAccesseur)
  const mapPersonnalisee = [[{ texte: 'src/a' }]]
  let suffixe = 'src/a'
  Object.defineProperty(mapPersonnalisee, 'map', { value: (faire) => [[{ texte: suffixe }]].map(faire) })
  const cleMap = p.cleDesArgs(mapPersonnalisee)
  suffixe = 'docs/mutation'
  assert.notEqual(p.cleDesArgs(mapPersonnalisee), cleMap)
  const lie8 = p.cleDesArgs(dag(p, 8, { lie: true }))
  const lie32 = p.cleDesArgs(dag(p, 32, { lie: true }))
  assert.equal(lie32, p.cleDesArgs(dag(p, 32, { lie: true })))
  assert.ok(lie32.length < 5 * lie8.length)
  assert.notEqual(p.cleDesArgs(dag(p, 8)), p.cleDesArgs(dag(p, 16)))
  const ordre = [[{ texte: 'src/a' }], [{ texte: 'docs/b' }]]
  assert.notEqual(p.cleDesArgs(ordre), p.cleDesArgs([...ordre].reverse()))
  assert.equal(p.cleDesArgs(ordre), o.cleDesArgs(ordre))
  assert.equal(p.cleDesArgs([...ordre].reverse()), o.cleDesArgs([...ordre].reverse()))
  const lie = (forme) => {
    const a = [{ texte: 'src/a' }]
    p.formesDesArguments.set(a, { e: forme, ctx: { f: 'banc.mjs', env: null } })
    return [a]
  }
  const scalaire = lie({ k: 'lit', v: 'src/a' })
  const liste = lie({ k: 'liste', v: [{ k: 'lit', v: 'src/a' }] })
  const lambda = (args) => ({ lambda: { id: 'lambda:1', sites: [], retours: [] }, ctx: { f: 'banc.mjs', env: { fn: 'f', args } } })
  assert.notEqual(p.cleDe(lambda(scalaire)), p.cleDe(lambda(liste)))
  assert.equal(p.cleDe(lambda(scalaire)), p.cleDe(lambda(lie({ k: 'lit', v: 'src/a' }))))
  const objet = { objet: { fichier: { k: 'lit', v: 'src/a' } }, ctx: { f: 'banc.mjs', env: null } }
  assert.equal(p.cleDe(objet), p.cleDe(structuredClone(objet)))
  assert.equal(p.cleDe(objet), o.cleDe(objet))
  const cycle = () => {
    const a = [{ texte: 'src/a' }]
    const args = [a]
    p.formesDesArguments.set(a, { e: { k: 'lit', v: 'src/a' }, ctx: { f: 'banc.mjs', env: { fn: 'f', args } } })
    return args
  }
  const cyclique = cycle()
  const cleCycle = p.cleDesArgs(cyclique)
  const avantCycle = p.encodages()
  assert.equal(p.cleDesArgs(cyclique), cleCycle)
  assert.equal(p.encodages(), avantCycle)
  assert.equal(cleCycle, p.cleDesArgs(cycle()))
  const cycleAncien = cycle()
  o.formesDesArguments.set(cycleAncien[0], p.formesDesArguments.get(cycleAncien[0]))
  assert.equal(cleCycle, o.cleDesArgs(cycleAncien))
  assert.notEqual(p.cleDesArgs(cycle()), p.cleDesArgs(scalaire))
  for (const largeur of [10, 20, 40]) {
    const enfant = Array.from({ length: largeur }, () => [{ texte: 'src/a' }])
    for (const a of enfant) p.formesDesArguments.set(a, { e: { k: 'lit', v: 'src/a' }, ctx: { f: 'banc.mjs', env: null } })
    let appels = 0
    let visites = 0
    Object.defineProperty(enfant, 'map', { configurable: true, value: function (faire, receveur) {
      appels++
      return Array.prototype.map.call(this, (valeur, index) => {
        visites++
        return faire.call(receveur, valeur, index, this)
      })
    } })
    const parents = Array.from({ length: largeur }, () => {
      const a = [{ texte: 'src/a' }]
      p.formesDesArguments.set(a, { e: { k: 'lit', v: 'src/a' }, ctx: { f: 'banc.mjs', env: { fn: 'f', args: enfant } } })
      return a
    })
    const cle = p.cleDesArgs(parents)
    assert.equal(appels, 1)
    assert.equal(visites, largeur)
    delete enfant.map
    assert.equal(p.cleDesArgs(parents), cle)
  }
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
