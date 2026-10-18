import { test, mock } from 'node:test'
import { createHash } from 'node:crypto'
import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, statSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { bornerIR, depuisDTO, deriverPerimetre, enDTO, FICHIERS_DE_CONTEXTE, FORMAT_DTO, lireDuDisque, memosDeDerivation, versionDesMemosDeDerivation } from './perimetreDerivation.mjs'
import { derivationBornee } from './perimetre.mjs'
import { fermetureSurDisque } from '../guards/lib/porteDEre.mjs'
import { spawnBorne } from '../guards/lib/processusBorne.mjs'
import { decoderLecture, encoderLecture } from '../guards/lib/racinesBalayees.mjs'
import { analyserCorpus } from '../guards/lib/dialecte.mjs'
import { LOT_D_ANALYSE, estModule } from '../guards/lib/importGraph.mjs'

const dossierDe = (t) => {
  const d = mkdtempSync(join(tmpdir(), 'derivation-contrat-'))
  t.after(() => rmSync(d, { recursive: true, force: true }))
  return d
}
const fichiersMemos = (d, nom) => readdirSync(d).filter((f) => f.startsWith(nom + '.') && f.endsWith('.json')).map((f) => join(d, f))
const dernierMemo = (d, nom) => fichiersMemos(d, nom).sort((a, b) => statSync(a).mtimeMs - statSync(b).mtimeMs).at(-1)
const images = { base: 'sha', tete: null, touches: [], post: [], avant: [] }
/** Une dérivation qui retient le seul test touché `fichier`. */
const deriveDe = (fichier) => ({ retenus: new Map([[fichier, { nature: 'touché', distance: 0, rang: 0, touche: fichier }]]), signaux: new Map(), toolchain: [], vitest: [], node: [fichier], nonResolus: [], setup: [], modules: 1 })

test('signature native : EOF, JSDoc, tokens complets, LF et texte JSX', async () => {
  const url = new URL('./perimetreDerivation.mjs?signature-native', import.meta.url).href
  const hook = registerHooks({ load(spec, ctx, suivant) {
    const r = suivant(spec, ctx)
    return spec === url ? { ...r, source: `${Buffer.from(r.source).toString('utf8')}\nexport { signatureDeProducteur }\n` } : r
  } })
  let signature
  try { ({ signatureDeProducteur: signature } = await import(url)) } finally { hook.deregister() }
  const indices = Array.from({ length: 257 }, (_, i) => String(i))
  const cas = [
    ['vide.ts', ''], ['commentaire.ts', '/** @type {number} */'],
    ['fin.ts', 'const a=1;'], ['lf.ts', 'const a=1;\n'],
    ['doc.ts', '/** @type {number} */ const a=1;'],
    ['docs.ts', '/** tête */ const a=1; /** @type {number} */ const b=2; /** fin */'],
    ['doc-adjacent.ts', '/**doc*/const a=1;'],
    ['doc-expression.ts', 'const a=1;/**doc*/+a'],
    ['doc-final-lf.ts', 'const a=1;/**doc*/\n'],
    ['doc-final-commentaire.ts', 'const a=1;/**doc*//* fin */'],
    ['elements.ts', `const a=[${indices.join(',')}];`],
    ['proprietes.ts', `const a={${indices.map((i) => `p${i}:${i}`).join(',')}};`],
    ['instructions.ts', indices.map((i) => `const a${i}=${i};`).join('')],
    ['adjacent.ts', 'let a=1;a+++a;a--;-a;+a;!a;~a;'],
    ['trivia.ts', 'const /* autre */ a = 1;'],
    ['asi.ts', 'function f(){return\n/* commentaire */1}'],
    ['asi-commentaire.ts', 'function f(){return/*\n commentaire */1}'],
    ['retour.ts', 'function f(){return/* commentaire */1}'],
    ['throw.ts', 'function f(){throw /*\n*/ new Error()}'],
    ['throw-sans-lf.ts', 'function f(){throw /* */ new Error()}'],
    ['increment.ts', 'let a=1,b=2;a\n/* doc */++b'],
    ['increment-commentaire.ts', 'let a=1,b=2;a/*\n*/++b'],
    ['operateurs.js', 'const a=/x+/g; const b=6/2; const c=`a${1+`${2}`}b`; a?.test(c) && b!==0;'],
    ['operateurs-trivia.js', 'const a = /x+/g; const b = 6 / 2; const c = `a${1 + `${2}`}b`; a ?. test(c) && b !== 0;'],
    ['ponctuation.ts', 'const a=[1,2]; a[0]+=2;'],
    ['ponctuation-autre.ts', 'const a=[1,2]; a[0]-=2;'],
    ['directive.ts', '// @ts-nocheck\nconst a=1;'],
    ['reference.ts', '/// <reference path="a.ts" />\nconst a=1;'],
    ['shebang.js', '#!/usr/bin/env node\nconst a=1;'],
    ['jsx.jsx', 'const a=<div> a</div>;'], ['jsx-autre.jsx', 'const a=<div>a</div>;'],
    ['jsx-blanc.tsx', 'const a=<div> </div>;'], ['jsx-vide.tsx', 'const a=<div></div>;'],
  ]
  const resultats = new Map()
  for (const analyse of analyserCorpus(cas.map(([rel, text]) => ({ rel, text })))) {
    const resultat = signature(analyse.fichier.text, analyse)
    assert.equal(resultat.persistable, true, analyse.fichier.rel)
    resultats.set(analyse.fichier.rel, JSON.parse(resultat.signature))
  }
  const lexemes = (f) => resultats.get(f)[1].map(([, texte]) => texte)
  assert.deepEqual(lexemes('fin.ts'), ['const', 'a', '=', '1', ';'])
  assert.deepEqual(resultats.get('doc-adjacent.ts'), resultats.get('fin.ts'))
  assert.deepEqual(lexemes('doc-expression.ts'), ['const', 'a', '=', '1', ';', '+', 'a'])
  assert.deepEqual(resultats.get('doc-final-lf.ts'), resultats.get('lf.ts'))
  assert.deepEqual(resultats.get('doc-final-commentaire.ts'), resultats.get('fin.ts'))
  assert.deepEqual(lexemes('elements.ts'), ['const', 'a', '=', '[', ...indices.flatMap((i, n) => n ? [',', i] : [i]), ']', ';'])
  assert.deepEqual(lexemes('proprietes.ts'), ['const', 'a', '=', '{', ...indices.flatMap((i, n) => [...(n ? [','] : []), `p${i}`, ':', i]), '}', ';'])
  assert.deepEqual(lexemes('instructions.ts'), indices.flatMap((i) => ['const', `a${i}`, '=', i, ';']))
  assert.deepEqual(lexemes('adjacent.ts'), ['let', 'a', '=', '1', ';', 'a', '++', '+', 'a', ';', 'a', '--', ';', '-', 'a', ';', '+', 'a', ';', '!', 'a', ';', '~', 'a', ';'])
  assert.deepEqual(resultats.get('doc.ts'), resultats.get('fin.ts'))
  assert.deepEqual(resultats.get('trivia.ts'), resultats.get('fin.ts'))
  assert.deepEqual(lexemes('docs.ts'), ['const', 'a', '=', '1', ';', 'const', 'b', '=', '2', ';'])
  assert.deepEqual(resultats.get('vide.ts'), [[], [], false])
  assert.deepEqual(resultats.get('commentaire.ts'), [[], [], false])
  assert.notDeepEqual(resultats.get('lf.ts'), resultats.get('fin.ts'))
  assert.deepEqual(resultats.get('asi.ts'), resultats.get('asi-commentaire.ts'))
  assert.notDeepEqual(resultats.get('asi.ts'), resultats.get('retour.ts'))
  assert.notDeepEqual(resultats.get('throw.ts'), resultats.get('throw-sans-lf.ts'))
  assert.deepEqual(resultats.get('increment.ts'), resultats.get('increment-commentaire.ts'))
  assert.deepEqual(resultats.get('operateurs.js'), resultats.get('operateurs-trivia.js'))
  assert.deepEqual(lexemes('operateurs.js'), ['const', 'a', '=', '/x+/g', ';', 'const', 'b', '=', '6', '/', '2', ';', 'const', 'c', '=', '`a${', '1', '+', '`${', '2', '}`', '}b`', ';', 'a', '?.', 'test', '(', 'c', ')', '&&', 'b', '!==', '0', ';'])
  assert.notDeepEqual(resultats.get('ponctuation.ts'), resultats.get('ponctuation-autre.ts'))
  for (const f of ['directive.ts', 'reference.ts', 'shebang.js']) assert.equal(resultats.get(f)[0].length, 1, f)
  assert.notDeepEqual(resultats.get('jsx.jsx'), resultats.get('jsx-autre.jsx'))
  assert.ok(lexemes('jsx.jsx').includes(' a'))
  assert.notDeepEqual(resultats.get('jsx-blanc.tsx'), resultats.get('jsx-vide.tsx'))
  assert.ok(lexemes('jsx-blanc.tsx').includes(' '))
  for (const analyse of analyserCorpus([{ rel: 'invalide.ts', text: 'const =' }])) {
    assert.ok(analyse.diagnostics.length > 0)
    assert.deepEqual(signature(analyse.fichier.text, analyse), { signature: 'const =', persistable: false })
  }
})

test('lots privés : frontière supérieure à un lot, nouveaux lecteurs et variantes chaudes conservent les tests', async (t) => {
  const url = new URL('./perimetreDerivation.mjs?lots-prives', import.meta.url).href
  const key = '2586.constructions.lots'
  globalThis[key] = []
  const tours = '2586.lecteurs.tours'
  globalThis[tours] = []
  const adaptations = '2586.adaptations'
  globalThis[adaptations] = []
  const hook = registerHooks({ load(spec, contexte, suivant) {
    const r = suivant(spec, contexte)
    if (spec !== url) return r
    const source = Buffer.from(r.source).toString('utf8')
    const debut = 'const evaluateurDe = () => evaluateur ??= evaluateurDuDepot({'
    const fin = 'memoiserBooleens: false })'
    assert.equal(source.split(debut).length, 2)
    assert.equal(source.split(fin).length, 2)
    return { ...r, source: source.replace(debut, `const evaluateurDe = () => evaluateur ??= (globalThis['${key}'].push([nature,debut]), evaluateurDuDepot({`)
      .replace(fin, 'memoiserBooleens: false }))')
      .replace('const lecturesDecodees = new Map()', `const lecturesDecodees = new Map(); globalThis['${adaptations}'].push({cache:lecturesDecodees,lectures:[],decodes:[]})`)
      .replace('const lu = decoderLecture(pool)\n          gelerLaConstante(lu)', `const lu = decoderLecture(pool); globalThis['${adaptations}'].at(-1).decodes.push(f)\n          gelerLaConstante(lu)`)
      .replace('return lecturesDecodees.get(f)', `const lu = lecturesDecodees.get(f); globalThis['${adaptations}'].at(-1).lectures.push({pool:f,lu}); return lu`)
      .replace('for (let frontiere = [...lecteurs]; ;) {', `for (let frontiere = [...lecteurs]; ;) { globalThis['${tours}'].push([]);`)
      .replace('stade(nature, f)', `stade(nature, f); if(nature==='relaisExportes')globalThis['${tours}'].at(-1).push([...lecteurs].sort())`) }
  } })
  let deriver
  try { deriver = (await import(url)).deriverPerimetre } finally { hook.deregister() }
  t.after(() => delete globalThis[key])
  t.after(() => delete globalThis[tours])
  t.after(() => delete globalThis[adaptations])
  const racine = dossierDe(t)
  const textes = new Map([
    ...Array.from({ length: LOT_D_ANALYSE + 1 }, (_, i) => [`scripts/lecteur${i}.mjs`, "import {readFileSync} from 'node:fs'; export function scanner(p){return readFileSync(p)}"]),
    ['scripts/relais.mjs', "import {scanner} from './lecteur0.mjs'; export function passer(p){return scanner(p)}"],
    ['scripts/a.test.mjs', Array.from({ length: LOT_D_ANALYSE + 1 }, (_, i) => `import './lecteur${i}.mjs'`).join(';') + ";import {passer} from './relais.mjs'; passer('src/a.txt')"],
    ['src/a.txt', 'a'],
  ])
  const memos = memosDeDerivation(racine, 'test')
  const entree = { racine, touches: ['src/a.txt'], post: [...textes.keys()], avant: [],
    lire: (fs) => new Map(fs.map((f) => [f, textes.get(f) ?? null])), memos }
  const froid = deriver(entree)
  t.diagnostic(JSON.stringify(globalThis[key]))
  assert.equal(globalThis[key].length, 6)
  assert.ok(globalThis[tours].length > 1)
  for (const tour of globalThis[tours]) for (const snapshot of tour) assert.deepEqual(snapshot, tour[0])
  const chaud = deriver(entree)
  assert.equal(globalThis[key].length, 6)
  assert.equal(froid.retenus.get('scripts/a.test.mjs')?.nature, 'racine balayée')
  assert.deepEqual([...chaud.retenus], [...froid.retenus])
  assert.deepEqual(chaud.nonResolus, froid.nonResolus)
  const requetes = (memos.lire('evaluations', 'relaisExportes:scripts/relais.mjs') ?? []).flatMap((v) => v.requetes)
  assert.ok(requetes.some(([q, r]) => q === '["peutLire","scripts/lecteur0.mjs"]' && r === true))
  assert.equal(new Set(globalThis[adaptations].map((a) => a.cache)).size, globalThis[adaptations].length)
  assert.ok(globalThis[adaptations].some((a) => a.lectures.length > a.decodes.length))
  for (const a of globalThis[adaptations]) {
    assert.ok(a.cache instanceof Map)
    assert.equal(new Set(a.decodes).size, a.decodes.length)
    const identites = new Map()
    for (const {pool, lu} of a.lectures) {
      assert.ok(Object.isFrozen(lu))
      if (identites.has(pool)) assert.equal(lu, identites.get(pool))
      identites.set(pool, lu)
    }
  }
})

test('production fermée : clôture exacte par lot, lecteurs figés, deux lots et un reste de questions, hits sans noyau', async (t) => {
  const url = new URL('./perimetreDerivation.mjs?production-fermee', import.meta.url).href
  const key = '2586.snapshots.fermes'
  globalThis[key] = []
  t.after(() => delete globalThis[key])
  const hook = registerHooks({ load(spec, ctx, suivant) {
    const r = suivant(spec, ctx)
    if (spec !== url) return r
    const source = Buffer.from(r.source).toString('utf8')
    const appel = 'JSON.parse(evaluerLotDuDepot(JSON.stringify({ lectures:'
    assert.equal(source.split(appel).length, 2)
    return { ...r, source: source.replace(appel, `JSON.parse(((json)=>{globalThis['${key}'].push({nature,manquants,lecturesDuLot,resolutions,lecteurs:[...lecteurs],transport:JSON.parse(json)});return evaluerLotDuDepot(json)})(JSON.stringify({ lectures:`)
      .replace('prelire(file.slice(i, finPrelue))', `globalThis['${key}'].push({prelecture:true,i,finPrelue,file:[...file],tranche:file.slice(i,finPrelue)}); prelire(file.slice(i, finPrelue))`)
      .replace('const vus = new WeakSet()', 'let travail = 0; const vus = new WeakSet()')
      .replace('const visiter = (v) => {', 'const visiter = (v) => { travail++')
      .replace('visiter(lu)', `visiter(lu); globalThis['${key}'].push({f,pool,travail})`) + '\nexport const deriverFermePourTest = (entree) => deriver(entree,true)\n' }
  } })
  let module
  try { module = await import(url) } finally { hook.deregister() }
  const textes = new Map([
    ...Array.from({ length: 2 * LOT_D_ANALYSE + 1 }, (_, i) => [`scripts/lecteur${i}.mjs`, `import {readFileSync} from 'node:fs'; import {base} from './dep${i}.mjs'; import './autre${i}.mjs'; export function scanner(p){return readFileSync(base+'/'+p)}`]),
    ...Array.from({ length: 2 * LOT_D_ANALYSE + 1 }, (_, i) => [`scripts/dep${i}.mjs`, "export * from './reexport.mjs'; export * from './reexport.mjs'"]),
    ...Array.from({ length: 2 * LOT_D_ANALYSE + 1 }, (_, i) => [`scripts/autre${i}.mjs`, "import './reexport.mjs'; export const autre=1"]),
    ['scripts/reexport.mjs', "export * from './constantes.mjs'; export * from './absent.mjs'"],
    ['scripts/constantes.mjs', "export const base='src'"],
    ['scripts/relais.mjs', "import {scanner} from './lecteur0.mjs'; export function passer(p){return scanner(p)}"],
    ['scripts/a.test.mjs', Array.from({ length: 2 * LOT_D_ANALYSE + 1 }, (_, i) => `import './lecteur${i}.mjs'`).join(';') + ";import {passer} from './relais.mjs'; passer('a.txt')"],
    ['src/a.txt', 'a'],
  ])
  const entree = { racine: dossierDe(t), touches: ['src/a.txt'], post: [...textes.keys()], avant: [], lire: (fs) => new Map(fs.map((f) => [f, textes.get(f) ?? null])) }
  const memoire = () => {
    const entries = new Map()
    return { entries, lire: (famille, cle) => entries.get(`${famille}:${cle}`), ecrire: (famille, cle, v) => entries.set(`${famille}:${cle}`, v) }
  }
  const publicMemos = memoire()
  const fermeMemos = memoire()
  const attendu = module.deriverPerimetre({ ...entree, memos: publicMemos })
  const froid = module.deriverFermePourTest({ ...entree, memos: fermeMemos })
  assert.deepEqual(froid, attendu)
  for (const memos of [publicMemos, fermeMemos]) for (const [cle, valeur] of memos.entries)
    if (cle.startsWith('lectures:')) assert.equal(typeof valeur, 'string')
  for (const [cle, variantes] of fermeMemos.entries) if (cle.startsWith('evaluations:')) {
    const publiques = publicMemos.entries.get(cle)
    assert.ok(publiques, cle)
    assert.deepEqual(variantes.map((v) => ({ ...v, requetes: v.requetes.toSorted(([a], [b]) => a.localeCompare(b)) })), publiques.map((v) => ({ ...v, requetes: v.requetes.toSorted(([a], [b]) => a.localeCompare(b)) })), cle)
  }
  const visites = globalThis[key].filter((s) => Object.hasOwn(s, 'travail'))
  assert.ok(visites.length > 0)
  assert.equal(new Set(visites.map((v) => v.f)).size, visites.length, 'une lecture se visite une fois par dérivation, pas une fois par lot')
  for (const { pool, travail } of visites) {
    let attendu = 1
    const vus = new WeakSet(), pile = [pool === null ? null : decoderLecture(pool)]
    while (pile.length) {
      const v = pile.pop()
      if (!v || typeof v !== 'object' || vus.has(v)) continue
      vus.add(v)
      const enfants = Object.values(v)
      attendu += enfants.length
      pile.push(...enfants)
    }
    assert.equal(travail, attendu)
  }
  const prelectures = globalThis[key].filter((s) => s.prelecture)
  assert.ok(prelectures.some((s) => s.i >= 2 * LOT_D_ANALYSE))
  let fin = 0
  for (const s of prelectures) {
    if (s.i === 0) fin = 0
    assert.ok(s.i >= fin)
    assert.equal(s.finPrelue, Math.min(s.file.length, s.i + LOT_D_ANALYSE))
    assert.deepEqual(s.tranche, s.file.slice(s.i, s.finPrelue))
    fin = s.finPrelue
  }
  assert.deepEqual(prelectures.slice(0, 3).map((s) => s.tranche.length), Array(3).fill(LOT_D_ANALYSE))
  const snapshots = globalThis[key].filter((s) => !Object.hasOwn(s, 'travail') && !s.prelecture)
  assert.ok(snapshots.some((s) => s.manquants.length === LOT_D_ANALYSE))
  assert.ok(snapshots.some((s) => s.manquants.length < LOT_D_ANALYSE))
  for (const snapshot of snapshots) {
    assert.ok(snapshot.manquants.length <= LOT_D_ANALYSE)
    assert.ok(snapshot.lecturesDuLot.has('scripts/constantes.mjs'))
    assert.ok([...snapshot.resolutions.values()].some(([, spec, cible]) => spec === './absent.mjs' && cible === null))
    for (const f of snapshot.manquants) assert.ok(snapshot.lecturesDuLot.has(f))
    assert.deepEqual(snapshot.transport.lectures.map(([f]) => f), [...snapshot.lecturesDuLot.keys()])
    assert.deepEqual(snapshot.transport.resolutions, [...snapshot.resolutions.values()])
    assert.deepEqual(snapshot.transport.lecteurs, snapshot.lecteurs)
    assert.deepEqual(snapshot.transport.questions, snapshot.manquants.map((f) => ({ nature: snapshot.nature, f })))
    for (const [f, pool] of snapshot.lecturesDuLot) {
      assert.deepEqual(snapshot.transport.lectures.find(([g]) => g === f)[1], pool)
      if (pool !== null) {
        assert.equal(typeof pool, 'string')
        assert.equal(JSON.parse(pool).format, 'lecture-ir-1')
      }
    }
    const fermeture = new Set(snapshot.manquants)
    for (const f of fermeture) for (const [module, , cible] of snapshot.resolutions.values())
      if (module === f && cible !== null) fermeture.add(cible)
    assert.deepEqual([...snapshot.lecturesDuLot.keys()].sort(), [...fermeture].sort())
  }
  const nombre = globalThis[key].length
  for (const [cle, valeur] of fermeMemos.entries) if (cle.startsWith('lectures:')) assert.equal(typeof valeur, 'string')
  assert.deepEqual(module.deriverFermePourTest({ ...entree, memos: fermeMemos }), froid)
  assert.equal(globalThis[key].length, nombre)
})

test('pool physique : la limite paramétrée borne aussi le transport compact', () => {
  const pool = encoderLecture('x')
  const taille = Buffer.byteLength(pool)
  assert.equal(bornerIR('a.mjs', pool, taille), pool)
  assert.throws(() => bornerIR('a.mjs', pool, taille - 1), /pool IR.*limite/)
})

function producteursDe(t) {
  const dossier = dossierDe(t)
  const pilote = join(dossier, 'pilote.mjs')
  const url = new URL('./perimetreDerivation.mjs', import.meta.url).href
  const extracteur = new URL('../guards/lib/importGraph.mjs', import.meta.url).href
  const dialecte = new URL('../guards/lib/dialecte.mjs', import.meta.url).href
  const racine = fileURLToPath(new URL('../..', import.meta.url))
  const corpus = join(dossier, 'corpus')
  for (const [f, texte] of fermetureSurDisque('scripts/test/perimetreDerivation.mjs', racine)) {
    if (texte === null) continue
    mkdirSync(dirname(join(corpus, f)), { recursive: true })
    writeFileSync(join(corpus, f), texte)
  }
  writeFileSync(join(corpus, 'package.json'), readFileSync(join(racine, 'package.json')))
  for (const f of FICHIERS_DE_CONTEXTE) {
    mkdirSync(dirname(join(corpus, f)), { recursive: true })
    writeFileSync(join(corpus, f), readFileSync(join(racine, f)))
  }
  writeFileSync(pilote, `import {registerHooks} from 'node:module';
import {readFileSync} from 'node:fs';
const options=JSON.parse(process.argv[2]);let appels=0,normalisations=0,fermetures=0;
globalThis.echec=options.echec;
registerHooks({load(url,ctx,suivant){const r=suivant(url,ctx);if(![${JSON.stringify(url)},${JSON.stringify(extracteur)},${JSON.stringify(dialecte)}].includes(url))return r;const source=Buffer.from(r.source).toString('utf8');
if(url===${JSON.stringify(url)})return {...r,source:source.replace("const RACINE = fileURLToPath(new URL('../..', import.meta.url))",'const RACINE = '+${JSON.stringify(JSON.stringify(corpus))})
.replace('function signatureDeProducteur(texte, { sourceFile, diagnostics }) {','function signatureDeProducteur(texte, { sourceFile, diagnostics }) { globalThis.normaliser();')
.replace('if (!sourceFile || diagnostics.length)',"if(globalThis.echec==='normalisation')throw new Error('normalisation injectee');if (!sourceFile || diagnostics.length)")
.replace('const textes = fermeture(', 'globalThis.fermer();const textes = fermeture(')};
if(url===${JSON.stringify(extracteur)})return {...r,source:source.replace('export function sitesDeModule(fichier, source, diagnostics) {','export function sitesDeModule(fichier, source, diagnostics) { globalThis.compter();')};
return {...r,source:source.replace('finally { libererSessions(session ? [session] : [], erreurs); }',"finally { libererSessions(session ? [session] : [], erreurs); if(globalThis.dansVersion&&globalThis.echec==='liberation')throw new Error('liberation injectee'); }")};}});
globalThis.compter=()=>appels++;
globalThis.normaliser=()=>{normalisations++;globalThis.dansVersion=true};globalThis.fermer=()=>fermetures++;
const {versionDesMemosDeDerivation}=await import(${JSON.stringify(url)});
const {fermetureSurDisque}=await import(${JSON.stringify(new URL('../guards/lib/porteDEre.mjs', import.meta.url).href)});
const version=versionDesMemosDeDerivation(${JSON.stringify(corpus)},{dossierDesMemos:${JSON.stringify(dossier)},lectureSeule:options.mode==='lectureSeule',...(options.format?{format:options.format}:{}),...(options.injecter==='lire'?{lire:(...args)=>readFileSync(...args)}:{}),...(options.injecter==='fermeture'?{fermeture:(...args)=>fermetureSurDisque(...args)}:{})});
console.log(JSON.stringify({version,appels,normalisations,fermetures}));`)
  const lancer = async (mode = 'ecriture', options = {}) => {
    const r = await spawnBorne({ argv: [pilote, JSON.stringify({ mode, ...options })], cwd: racine, fichier: join(dossier, 'log'), limiteMs: 10000, fluxDistincts: true })
    assert.equal(r.code, 0, `${r.expiree ? 'pilote expiré, ' : ''}code ${r.code} : ${r.sortie}`)
    try { return JSON.parse(r.stdout.trim()) }
    catch (e) { throw new Error(`pilote : stdout hors contrat JSON (${e.message})\nstdout : ${r.stdout}\nstderr : ${r.stderr}`, { cause: e }) }
  }
  return { dossier, corpus, lancer }
}

test('extraction producteurs : hit interprocessus, bootstrap brut et lecture seule', async (t) => {
  const { dossier, corpus, lancer } = producteursDe(t)
  const froid = await lancer('ecriture')
  const fichier = dernierMemo(dossier, 'extractionProducteurs')
  const brut = readFileSync(fichier, 'utf8')
  assert.match(JSON.parse(brut).version, /^[a-f0-9]{64}$/)
  const chaud = await lancer('ecriture')
  assert.equal(chaud.version, froid.version)
  assert.ok(froid.appels > chaud.appels, JSON.stringify({ froid, chaud }))
  assert.ok(chaud.appels > 0)
  assert.deepEqual(await lancer('lectureSeule'), chaud)
  assert.equal(readFileSync(fichier, 'utf8'), brut)
  const transitif = join(corpus, 'scripts/guards/lib/tsProgram.mjs')
  const avant = readFileSync(transitif, 'utf8')
  writeFileSync(transitif, `${avant}\nexport const revisionExtracteur = 2586\n`)
  const modifie = await lancer('ecriture')
  const extractionModifiee = readFileSync(dernierMemo(dossier, 'extractionProducteurs'), 'utf8')
  assert.notEqual(JSON.parse(extractionModifiee).version, JSON.parse(brut).version)
  assert.ok(modifie.appels > chaud.appels, JSON.stringify({ modifie, chaud }))
  assert.notEqual(modifie.version, froid.version)
  const nouveauChaud = await lancer('ecriture')
  assert.equal(nouveauChaud.version, modifie.version)
  assert.ok(nouveauChaud.appels < modifie.appels)
})

test('version producteurs : froid canonique puis hit interprocessus et fermeture relue', async (t) => {
  const { dossier, corpus, lancer } = producteursDe(t)
  const froid = await lancer()
  const chaud = await lancer()
  t.diagnostic(JSON.stringify({ froid, chaud }))
  const racine = fileURLToPath(new URL('../..', import.meta.url))
  assert.equal(froid.normalisations, fermetureSurDisque('scripts/test/perimetreDerivation.mjs', racine).filter(([f, texte]) => texte !== null && estModule(f)).length)
  assert.equal(chaud.normalisations, 0)
  assert.equal(chaud.fermetures, 1)
  assert.equal(chaud.version, froid.version)
  const fichier = dernierMemo(dossier, 'versionProducteurs')
  const memo = JSON.parse(readFileSync(fichier, 'utf8'))
  assert.deepEqual(Object.keys(memo.memos), ['version'])
  assert.equal(memo.memos.version, froid.version)
  assert.match(memo.version, /^[a-f0-9]{64}$/)
  const transitif = join(corpus, 'scripts/guards/lib/tsProgram.mjs')
  writeFileSync(transitif, readFileSync(transitif, 'utf8').replace('import ', '/* trivia */ import '))
  const trivia = await lancer()
  assert.ok(trivia.normalisations > 0)
  assert.equal(trivia.version, froid.version)
  assert.notEqual(JSON.parse(readFileSync(dernierMemo(dossier, 'versionProducteurs'), 'utf8')).version, memo.version)
  assert.equal((await lancer()).normalisations, 0)
})

test('version producteurs : corruption, entête et lecture seule physiques', async (t) => {
  const { dossier, lancer } = producteursDe(t)
  const froid = await lancer('lectureSeule')
  assert.equal(Boolean(dernierMemo(dossier, 'versionProducteurs')), false)
  await lancer()
  const fichier = dernierMemo(dossier, 'versionProducteurs')
  const brut = readFileSync(fichier, 'utf8')
  for (const mauvais of [JSON.stringify({ ...JSON.parse(brut), version: 'autre' }), JSON.stringify({ ...JSON.parse(brut), memos: { version: 'invalide' } }), '{']) {
    writeFileSync(fichier, mauvais)
    const ro = await lancer('lectureSeule')
    assert.ok(ro.normalisations > 0)
    assert.equal(ro.version, froid.version)
    assert.equal(readFileSync(fichier, 'utf8'), mauvais)
  }
  const repare = await lancer()
  assert.equal(repare.version, froid.version)
  assert.equal(readFileSync(fichier, 'utf8'), brut)
})

for (const echec of ['normalisation', 'liberation']) test(`version producteurs : échec ${echec} non persisté puis reprise`, async (t) => {
  const { dossier, lancer } = producteursDe(t)
  const rate = await lancer('ecriture', { echec })
  assert.ok(rate.normalisations > 0)
  assert.equal(Boolean(dernierMemo(dossier, 'versionProducteurs')), false)
  const repris = await lancer()
  assert.ok(repris.normalisations > 0)
  assert.equal((await lancer()).normalisations, 0)
})

test('version producteurs : dépendances brutes, normaliseur, config, paquet, format et nouveau producteur', async (t) => {
  const { dossier, corpus, lancer } = producteursDe(t)
  let precedent = await lancer()
  const fichier = dernierMemo(dossier, 'versionProducteurs')
  let entete = JSON.parse(readFileSync(fichier, 'utf8')).version
  for (const [f, transformer, options] of [
    ['scripts/test/perimetreDerivation.mjs', (s) => s.replace('const signatures = new Map()', 'const signatures = new Map(); void 2586')],
    ['tsconfig.json', (s) => `${s}\n `],
    ['node_modules/rolldown/package.json', (s) => JSON.stringify({ ...JSON.parse(s), version: '2586' })],
    [null, null, { format: '2586' }],
    ['scripts/test/perimetreDerivation.mjs', (s) => `${s}\nimport './nouveau.mjs'\n`],
  ]) {
    if (f) writeFileSync(join(corpus, f), transformer(readFileSync(join(corpus, f), 'utf8')))
    if (f?.endsWith('perimetreDerivation.mjs')) writeFileSync(join(corpus, 'scripts/test/nouveau.mjs'), 'export const nouveau = 2586')
    const courant = await lancer('ecriture', options)
    assert.ok(courant.normalisations > 0, f ?? 'format')
    assert.notEqual(courant.version, precedent.version, f ?? 'format')
    const memo = JSON.parse(readFileSync(dernierMemo(dossier, 'versionProducteurs'), 'utf8'))
    assert.notEqual(memo.version, entete)
    assert.deepEqual(Object.keys(memo.memos), ['version'])
    precedent = courant
    entete = memo.version
  }
})

for (const injecter of ['lire', 'fermeture']) test(`version producteurs : injection ${injecter} non persistante`, async (t) => {
  const { dossier, lancer } = producteursDe(t)
  const froid = await lancer('ecriture', { injecter })
  assert.equal(Boolean(dernierMemo(dossier, 'versionProducteurs')), false)
  const canonique = await lancer()
  assert.equal(canonique.version, froid.version)
  const brut = readFileSync(dernierMemo(dossier, 'versionProducteurs'), 'utf8')
  const injecte = await lancer('ecriture', { injecter })
  assert.ok(injecte.normalisations > 0)
  assert.equal(readFileSync(dernierMemo(dossier, 'versionProducteurs'), 'utf8'), brut)
})

test('DTO versionné : transport conserve maps et images, refuse version et troncature', () => {
  const derive = deriveDe('scripts/a.test.mjs')
  const dto = JSON.parse(JSON.stringify(enDTO(images, derive)))
  assert.equal(dto.format, FORMAT_DTO)
  assert.deepEqual(depuisDTO(dto), { ...images, ...derive })
  for (const mauvais of [null, {}, { ...dto, format: -1 }, { ...dto, retenus: [null] }, { ...dto, images: {} }, { ...dto, retenus: [['a', {}]] }, { ...dto, signaux: [['a', {}]] }, { ...dto, nonResolus: [{}] }, { ...dto, images: { ...dto.images, base: 1 } }])
    assert.throws(() => depuisDTO(mauvais), /DTO/)
})

test('version : fermeture des producteurs transitifs, paquet, config et format ; CLI hors fermeture', (t) => {
  const racine = dossierDe(t)
  const fermeture = fermetureSurDisque('scripts/test/perimetreDerivation.mjs')
  assert.ok(fermeture.some(([f]) => f === 'scripts/guards/lib/tsProgram.mjs'))
  assert.equal(fermeture.some(([f]) => f === 'scripts/test/perimetre.mjs'), false)
  const textes = [['producteur.mjs', 'a'], ['transitif.mjs', 'b']]
  const options = { fermeture: () => textes, lire: (f) => f.endsWith('package.json') ? '{"version":"1"}' : '{}' }
  const v = versionDesMemosDeDerivation(racine, options)
  assert.equal(versionDesMemosDeDerivation(racine, options), v)
  assert.notEqual(versionDesMemosDeDerivation(racine, { ...options, fermeture: () => [['producteur.mjs', 'a'], ['transitif.mjs', 'c']] }), v)
  assert.notEqual(versionDesMemosDeDerivation(racine, { ...options, format: 'nouveau' }), v)
  assert.notEqual(versionDesMemosDeDerivation(racine, { ...options, lire: (f) => f.endsWith('package.json') ? '{"version":"2"}' : '{}' }), v)
  assert.notEqual(versionDesMemosDeDerivation(racine, { ...options, lire: (f) => f.endsWith('package.json') ? '{"version":"1"}' : '{"compilerOptions":{}}' }), v)
})

test('version : tokens du parseur, trivia, littéraux, ASI et directives', (t) => {
  const racine = dossierDe(t)
  const version = (texte) => versionDesMemosDeDerivation(racine, { fermeture: () => [['producteur.mjs', texte]], lire: () => '{}' })
  const initial = 'export function f() { return /a\\/b/.test(`x${1 + 2}`) && "a // b"; }'
  assert.equal(version(initial), version(initial.replace('return ', 'return /* ordinaire */ ')))
  assert.equal(version(initial), version(initial.replace('1 + 2', '1  +  2')))
  for (const [avant, apres] of [
    [initial, initial.replace('/a\\/b/', '/a\\/c/')],
    [initial, initial.replace('`x${', '`y${')],
    [initial, initial.replace('"a // b"', '"a // c"')],
    [initial, initial.replace('1 + 2', '1 - 2')],
    ['function f() { return 1 }', 'function f() { return\n1 }'],
    ['/// <reference path="a.ts" />\nexport const a = 1', '/// <reference path="b.ts" />\nexport const a = 1'],
    ['#!/usr/bin/node\nexport const a = 1', '#!/usr/bin/env node\nexport const a = 1'],
    ['// @ts-check\nexport const a = 1', '// @ts-nocheck\nexport const a = 1'],
    ['export const =', 'export  const ='],
  ]) assert.notEqual(version(avant), version(apres))
})

test('mémos : entête rejetée avant corps, compatible physiquement borné, compact atomique', (t) => {
  const d = dossierDe(t), f = join(d, 'lectures.v.json'), raisons = []
  for (const texte of ['{"memos":{"a":1},"version":"v"}', '{"version":"autre","memos":' + 'x'.repeat(10000), '{"version":'])
    {
      writeFileSync(f, texte)
      const m = memosDeDerivation(d, 'v', { limiteFamille: 100, diagnostic: (nom, raison) => raisons.push([nom, raison]) })
      assert.equal(m.lire('lectures', 'a'), undefined)
    }
  assert.equal(raisons.length, 3)
  writeFileSync(f, '{"version":"v","memos":{"a":"' + 'x'.repeat(10000) + '"}}')
  assert.throws(() => memosDeDerivation(d, 'v', { limiteFamille: 100 }).lire('lectures', 'a'), /famille.*limite 100/)
  const m = memosDeDerivation(d, 'v')
  rmSync(f)
  m.ecrire('lectures', 'a', { a: 1 })
  m.sauver()
  assert.equal(readFileSync(f, 'utf8'), '{"version":"v","memos":{"a":{"a":1}}}\n')
  const pool = encoderLecture({ texte: 'é"\\\n' })
  const rendu = JSON.stringify({ version: 'v', memos: { a: pool } }) + '\n'
  const borne = Buffer.byteLength(rendu)
  const exact = memosDeDerivation(d, 'v', { limiteFamille: borne })
  exact.ecrire('lectures', 'a', pool)
  exact.sauver()
  assert.equal(readFileSync(f, 'utf8'), rendu)
  assert.equal(memosDeDerivation(d, 'v', { limiteFamille: borne }).lire('lectures', 'a'), pool)
  rmSync(f)
  const trop = memosDeDerivation(d, 'v', { limiteFamille: borne - 1 })
  trop.ecrire('lectures', 'a', pool)
  assert.throws(() => trop.sauver(), /famille lectures.*limite/)
})

test('prune : HEAD et travail gardés, trois blobs devenus deux même famille non sale et chemin avec colon', (t) => {
  const d = dossierDe(t), rel = 'scripts/a:b.mjs'
  const travail = 'export const a = 2'
  const bytes = Buffer.from(travail)
  const sha = createHash('sha1').update('blob ' + bytes.length + '\0').update(bytes).digest('hex')
  for (const nom of ['lectures', 'declarations', 'liaisons']) {
    const f = join(d, nom + '.v.json')
    writeFileSync(f, JSON.stringify({ version: 'v', memos: { [rel + ':head']: [], [rel + ':' + sha]: [], [rel + ':ancien']: [] } }))
    const m = memosDeDerivation(d, 'v', { imagesVivantes: new Map([[rel, new Set(['head', sha])]]) })
    assert.deepEqual(m.lire(nom, rel + ':head'), [])
    m.elaguer()
    m.sauver()
    assert.deepEqual(Object.keys(JSON.parse(readFileSync(f)).memos), [rel + ':head', rel + ':' + sha])
    const fige = memosDeDerivation(d, 'v', { imagesVivantes: new Map([[rel, new Set(['head'])]]) })
    fige.lire(nom, rel + ':head')
    fige.elaguer()
    fige.sauver()
    assert.deepEqual(Object.keys(JSON.parse(readFileSync(f)).memos), [rel + ':head'])
  }
})

test('lecture seule : hit, miss et prune ne créent ni ne changent aucun fichier', (t) => {
  const d = dossierDe(t), f = join(d, 'lectures.v.json')
  const texte = '{"version":"v","memos":{"a:ancien":[]}}'
  writeFileSync(f, texte)
  const m = memosDeDerivation(d, 'v', { lectureSeule: true, imagesVivantes: new Map() })
  m.lire('lectures', 'a:ancien')
  m.ecrire('liaisons', 'a:neuf', [])
  m.elaguer()
  m.sauver()
  assert.equal(readFileSync(f, 'utf8'), texte)
  assert.equal(existsSync(join(d, 'liaisons.v.json')), false)
})

test('checkpoints bornés : purger avant écriture garde base, HEAD, travail et lectures encore non visitées', (t) => {
  const d = dossierDe(t), rel = 'scripts/a:b.mjs', futur = 'scripts/futur.mjs'
  const imagesVivantes = new Map([[rel, new Set(['base', 'head', 'travail'])], [futur, new Set(['courant'])]])
  const conserves = { [rel + ':base']: 'b'.repeat(100), [rel + ':head']: 'h'.repeat(100), [futur + ':courant']: 'f'.repeat(100) }
  const obsoletes = { ...conserves, [rel + ':obsolete']: 'x'.repeat(600) }
  const neuf = 't'.repeat(600)
  const octets = (memos) => Buffer.byteLength(JSON.stringify({ version: 'v', memos }) + '\n')
  const limiteFamille = Math.max(octets(obsoletes), octets({ ...conserves, [rel + ':travail']: neuf }))
  assert.ok(octets({ ...obsoletes, [rel + ':travail']: neuf }) > limiteFamille)
  for (const nom of ['lectures', 'declarations', 'liaisons']) {
    const f = join(d, nom + '.v.json')
    writeFileSync(f, JSON.stringify({ version: 'v', memos: obsoletes }) + '\n')
    const m = memosDeDerivation(d, 'v', { imagesVivantes, limiteFamille })
    m.ecrire(nom, rel + ':travail', neuf)
    m.sauver()
    assert.ok(statSync(f).size <= limiteFamille)
    const repris = memosDeDerivation(d, 'v', { imagesVivantes, limiteFamille })
    assert.equal(repris.lire(nom, rel + ':obsolete'), undefined)
    for (const [cle, valeur] of Object.entries({ ...conserves, [rel + ':travail']: neuf })) assert.equal(repris.lire(nom, cle), valeur)
    repris.elaguer()
    repris.sauver()
    assert.deepEqual(JSON.parse(readFileSync(f)).memos, { ...conserves, [rel + ':travail']: neuf })
    const avant = readFileSync(f, 'utf8')
    const seul = memosDeDerivation(d, 'v', { imagesVivantes: new Map(), limiteFamille, lectureSeule: true })
    assert.equal(seul.lire(nom, rel + ':base'), conserves[rel + ':base'])
    seul.ecrire(nom, rel + ':autre', neuf)
    seul.sauver()
    assert.equal(readFileSync(f, 'utf8'), avant)
  }
})

test('IR : erreur nomme module et limite', () => {
  let dag = { chaine: 'x'.repeat(100) }
  for (let i = 0; i < 10; i++) dag = [dag, dag]
  assert.throws(() => bornerIR('scripts/a.mjs', encoderLecture(dag), 1000), /IR de scripts\/a.mjs.*limite 1000/)
  assert.throws(() => bornerIR('scripts/a.mjs', {}), /IR_TEXTE_ATTENDU/)
})

test('IR sur lectures directe et prélue, hit et miss : même borne nommée', async () => {
  const urls = ['directe', 'prelue'].map((mode) => new URL('./perimetreDerivation.mjs?borne-' + mode, import.meta.url).href)
  const hook = registerHooks({ load(specifier, contexte, suivant) {
    const rendu = suivant(specifier, contexte)
    if (!urls.includes(specifier)) return rendu
    let source = Buffer.from(rendu.source).toString('utf8').replace('64 * 1024 * 1024', '32')
    if (specifier === urls[0]) source = source.replace('    prelire(new Set(', '    if (false) prelire(new Set(')
    return { ...rendu, source }
  } })
  try {
    for (const url of urls) {
      const { deriverPerimetre: executer } = await import(url)
      const f = 'scripts/a.test.mjs', texte = "import { readFileSync } from 'node:fs';readFileSync('src/a.json')"
      const entree = { racine: fileURLToPath(new URL('../..', import.meta.url)), touches: ['src/a.json'], post: [f, 'src/a.json'], avant: [], lire: (rels) => new Map(rels.map((r) => [r, r === f ? texte : null])) }
      assert.throws(() => executer(entree), /IR de scripts\/a.test.mjs.*limite 32/)
      assert.throws(() => executer({ ...entree, memos: { lire: (nom) => nom === 'lectures' ? encoderLecture({ enorme: 'x'.repeat(100) }) : undefined, ecrire: () => {} } }), /IR de scripts\/a.test.mjs.*limite 32/)
    }
  } finally { hook.deregister() }
})

test('enfant : nettoyage seulement sous preuve de mort, diagnostics conservés sans clôture confirmée', async (t) => {
  const d = dossierDe(t)
  const mort = { etat: 'mort', erreurs: [] }
  const derive = deriveDe('scripts/a.test.mjs')
  for (const [code, expiree, arret, dto] of [[1, false, mort, enDTO(images, derive)], [0, true, mort, enDTO(images, derive)], [0, false, { etat: 'indetermine' }, enDTO(images, derive)], [0, false, null, enDTO(images, derive)], [0, false, mort, null], [0, false, mort, {}]]) {
    let temp
    const lancer = async ({ argv, fichier, limiteMs }) => {
      assert.equal(limiteMs, 180000)
      temp = dirname(fichier)
      writeFileSync(fichier, 'diagnostic')
      writeFileSync(argv.at(-1), '{"stade":"lecture","module":"scripts/feuille.mjs"}')
      if (dto) writeFileSync(argv.at(-2), JSON.stringify(dto))
      return { code, expiree, annulee: false, arret }
    }
    await assert.rejects(() => derivationBornee({ racine: d }, { lancer }), /perimetre :/)
    assert.equal(existsSync(temp), arret?.etat !== 'mort')
    rmSync(temp, { recursive: true, force: true })
  }
})

test('enfant : marqueur ou DTO illisible lève avec sa cause, marqueur absent garde le stade de lancement (#2586)', async (t) => {
  const d = dossierDe(t)
  const lancerAvec = (marqueur, sortie) => async ({ argv }) => {
    if (marqueur !== null) writeFileSync(argv.at(-1), marqueur)
    writeFileSync(argv.at(-2), sortie)
    return { code: 0, expiree: false, annulee: false, arret: { etat: 'mort', erreurs: [] } }
  }
  await assert.rejects(() => derivationBornee({ racine: d }, { lancer: lancerAvec('{', JSON.stringify(enDTO(images, deriveDe('scripts/a.test.mjs')))) }),
    (e) => /marqueur de stade .* illisible/.test(e.message) && e.cause instanceof SyntaxError)
  await assert.rejects(() => derivationBornee({ racine: d }, { lancer: lancerAvec(null, '{"tronqu') }),
    (e) => /DTO absent ou tronqué au stade lancement/.test(e.message) && e.cause instanceof SyntaxError)
})

test('enfant : lancement canonique positif et résultat reconstruit nettoient Temp', async (t) => {
  const d = dossierDe(t)
  const derive = deriveDe('scripts/a.test.mjs')
  let temp
  const lancer = async ({ argv, fichier }) => {
    temp = dirname(fichier)
    assert.ok(argv.includes('--max-old-space-size=640'))
    writeFileSync(argv.at(-2), JSON.stringify(enDTO(images, derive)))
    return { code: 0, expiree: false, annulee: false, arret: { etat: 'mort', erreurs: [] } }
  }
  assert.deepEqual(await derivationBornee({ racine: d }, { lancer }), { ...images, ...derive })
  assert.equal(existsSync(temp), false)
})

test('checkpoints : interruption après lot entier conserve un lot de sites et versions coexistantes', async (t) => {
  const url = new URL('./perimetreDerivation.mjs?checkpoints-fermes', import.meta.url).href
  const hook = registerHooks({ load(spec, ctx, suivant) {
    const rendu = suivant(spec, ctx)
    return spec === url ? { ...rendu, source: Buffer.from(rendu.source).toString('utf8') + '\nexport const deriverFerme = (entree) => deriver(entree, true)\n' } : rendu
  } })
  let module
  try { module = await import(url) } finally { hook.deregister() }
  for (const ferme of [false, true]) {
    const deriverPerimetre = ferme ? module.deriverFerme : module.deriverPerimetre
    const racine = dossierDe(t)
    const chiffres = String(LOT_D_ANALYSE).length
    const textes = new Map([
      ...Array.from({ length: LOT_D_ANALYSE + 1 }, (_, i) => ['scripts/lecteur' + String(i).padStart(chiffres, '0') + '.mjs', "import {readFileSync} from 'node:fs'; readFileSync('src/a.txt')"]),
      ['scripts/a.test.mjs', Array.from({ length: LOT_D_ANALYSE + 1 }, (_, i) => "import './lecteur" + String(i).padStart(chiffres, '0') + ".mjs'").join(';')],
      ['src/a.txt', 'a'],
    ])
    const version = 'a'.repeat(64)
    const memos = memosDeDerivation(racine, version)
    let sites = 0
    const cout = { ecritures: 0, octets: 0, jsonMs: 0 }
    const stringify = JSON.stringify
    const serialiser = mock.method(JSON, 'stringify', function (valeur, ...args) {
      const debut = performance.now()
      const texte = stringify.call(this, valeur, ...args)
      if (valeur?.version === version && valeur.memos) {
        cout.ecritures++
        cout.octets += Buffer.byteLength(texte)
        cout.jsonMs += performance.now() - debut
      }
      return texte
    })
    const entree = { racine, touches: ['src/a.txt'], post: [...textes.keys()], avant: [],
      lire: (fs) => new Map(fs.map((f) => [f, textes.get(f) ?? null])), memos,
      stade: (nature) => { if (nature === 'sitesDe' && ++sites === (ferme ? 2 : LOT_D_ANALYSE + 1)) throw new Error('interruption injectée après lot') } }
    try { assert.throws(() => deriverPerimetre(entree), /interruption injectée/) } finally { serialiser.mock.restore() }
    const fichier = join(racine, 'evaluations.' + version + '.json')
    const avant = readFileSync(fichier, 'utf8')
    const ecrits = Object.keys(JSON.parse(avant).memos)
    assert.equal(ecrits.filter((cle) => cle.startsWith('sitesDe:')).length, LOT_D_ANALYSE)
    assert.equal(ecrits.filter((cle) => cle.startsWith('relaisExportes:')).length, LOT_D_ANALYSE + 1)
    assert.ok(fichiersMemos(racine, 'specificateurs').length > 0)
    assert.ok(fichiersMemos(racine, 'lectures').length > 0)
    const autre = memosDeDerivation(racine, 'b'.repeat(64))
    autre.ecrire('evaluations', 'autre', [])
    autre.sauver()
    assert.equal(readFileSync(fichier, 'utf8'), avant)
    const repris = memosDeDerivation(racine, version)
    assert.ok(repris.lire('evaluations', `sitesDe:scripts/lecteur${'0'.repeat(chiffres)}.mjs`))
    const resultat = deriverPerimetre({ ...entree, memos: repris, stade: () => {} })
    assert.equal(resultat.retenus.get('scripts/a.test.mjs').nature, 'racine balayée')
    repris.sauver()
    assert.equal(Object.keys(JSON.parse(readFileSync(fichier, 'utf8')).memos).filter((cle) => cle.startsWith('sitesDe:')).length, LOT_D_ANALYSE + 1)
    t.diagnostic(JSON.stringify({ ferme, checkpoints: cout }))
  }
})

test('checkpoints : un par lot d\'évaluation, quel que soit le nombre de programmes d\'analyse (#2586)', (t) => {
  const sauvegardes = (deps) => {
    const textes = new Map([
      ['scripts/lecteur.mjs', "import {readFileSync} from 'node:fs'; " + Array.from({ length: deps }, (_, i) => `import './dep${i}.mjs'`).join(';') + "; readFileSync('src/a.txt')"],
      ...Array.from({ length: deps }, (_, i) => [`scripts/dep${i}.mjs`, 'export const d = 1']),
      ['scripts/a.test.mjs', "import './lecteur.mjs'"],
      ['src/a.txt', 'a'],
    ])
    const entrees = new Map()
    let n = 0
    const memos = { lire: (famille, cle) => entrees.get(`${famille}:${cle}`), ecrire: (famille, cle, v) => entrees.set(`${famille}:${cle}`, v), sauver: () => { n++ } }
    deriverPerimetre({ racine: dossierDe(t), touches: ['src/a.txt'], post: [...textes.keys()], avant: [], memos,
      lire: (fs) => new Map(fs.map((f) => [f, textes.get(f) ?? null])) })
    return n
  }
  assert.equal(sauvegardes(130), sauvegardes(2))
})

test('lecteur du disque : un absent se lit null, une autre panne de lecture lève avec sa cause (#2586)', (t) => {
  const racine = mkdtempSync(join(tmpdir(), 'perimetre-disque-'))
  t.after(() => rmSync(racine, { recursive: true, force: true }))
  mkdirSync(join(racine, 'dossier'))
  writeFileSync(join(racine, 'a.mjs'), 'export const a = 1\n')
  assert.deepEqual([...lireDuDisque(racine)(['a.mjs', 'absent.mjs'])], [['a.mjs', 'export const a = 1\n'], ['absent.mjs', null]])
  assert.throws(() => lireDuDisque(racine)(['dossier']), (e) => /illisible/.test(e.message) && e.cause?.code === 'EISDIR')
})

test('module qui balaie le dépôt : la fermeture d\'imports du balayeur porte l\'exemption, pas un module hors d\'elle (#2586)', (t) => {
  const textes = new Map([
    ['scripts/balayeur.mjs', "import {readdirSync} from 'node:fs'; export const tout = () => readdirSync('.')"],
    ['scripts/relais.mjs', "import {tout} from './balayeur.mjs'; export const passer = () => tout()"],
    ['scripts/a.test.mjs', "import {passer} from './relais.mjs'; import {readFileSync} from 'node:fs'; passer(); readFileSync(process.env.X)"],
    ['scripts/b.test.mjs', "import {readFileSync} from 'node:fs'; readFileSync(process.env.X)"],
    ['src/a.txt', 'a'],
  ])
  const { nonResolus } = deriverPerimetre({ racine: dossierDe(t), touches: ['src/a.txt'], post: [...textes.keys()], avant: [],
    lire: (fs) => new Map(fs.map((f) => [f, textes.get(f) ?? null])) })
  assert.deepEqual(nonResolus.map((n) => [n.fichier, n.moduleBalaieLeDepot]), [['scripts/a.test.mjs', true], ['scripts/b.test.mjs', false]])
})
