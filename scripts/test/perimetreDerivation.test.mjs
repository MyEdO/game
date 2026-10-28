import { test, mock } from 'node:test'
import { createHash } from 'node:crypto'
import { spawn } from 'node:child_process'
import assert from 'node:assert/strict'
import { closeSync, existsSync, mkdirSync, mkdtempSync, openSync, readFileSync, readdirSync, statSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { bornerIR, depuisDTO, deriverDansLEnfant, deriverPerimetre, enDTO, FICHIERS_DE_CONTEXTE, FORMAT_DTO, LIMITE_IR, lireDuDisque, marqueurDeStade, memosDeDerivation, produireDTO, signatureDeProducteur, versionDesMemosDeDerivation } from './perimetreDerivation.mjs'
import { derivationBornee, TAS_DERIVATION_MO } from './perimetre.mjs'
import { fermetureSurDisque } from '../guards/lib/porteDEre.mjs'
import { spawnBorne } from '../guards/lib/processusBorne.mjs'
import { BACKOFFS_MS, attendreSync } from '../guards/lib/spawnResilient.mjs'
import { instanceDeDepot } from '../guards/lib/depotGabarit.mjs'
import { lireTextePublie } from '../guards/lib/ecritureJsonAtomique.mjs'
import { encoderLecture, evaluerLotDuDepot } from '../guards/lib/racinesBalayees.mjs'
import { analyserCorpus } from '../guards/lib/dialecte.mjs'
import { LOT_D_ANALYSE, analyserEnLots } from '../guards/lib/importGraph.mjs'
import { tableTotale } from '../../src/lib/tableTotale.ts'

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
/** La taille de lot des bancs de lots : un lot plein et un reste se forment sur une fixture de quelques modules. */
const LOT = 2

test('signature native : EOF, JSDoc, tokens complets, LF et texte JSX', () => {
  const signature = signatureDeProducteur
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

test('lots privés : frontière supérieure à un lot, nouveaux lecteurs et variantes chaudes conservent les tests', (t) => {
  const racine = dossierDe(t)
  const lecteurs = Array.from({ length: LOT + 1 }, (_, i) => `scripts/lecteur${i}.mjs`)
  const textes = new Map([
    ...lecteurs.map((f) => [f, "import {readFileSync} from 'node:fs'; export function scanner(p){return readFileSync(p)}"]),
    ['scripts/relais.mjs', "import {scanner} from './lecteur0.mjs'; export function passer(p){return scanner(p)}"],
    ['scripts/a.test.mjs', lecteurs.map((f) => `import './${f.slice('scripts/'.length)}'`).join(';') + ";import {passer} from './relais.mjs'; passer('src/a.txt')"],
    ['src/a.txt', 'a'],
  ])
  const memos = memosDeDerivation(racine, 'test')
  const ecrits = []
  const evalues = []
  const entree = { racine, touches: ['src/a.txt'], post: [...textes.keys()], avant: [], tailleLot: LOT,
    lire: (fs) => new Map(fs.map((f) => [f, textes.get(f) ?? null])),
    memos: { ...memos, ecrire: (nom, cle, valeur) => { ecrits.push(nom); memos.ecrire(nom, cle, valeur) } },
    evaluerLot: (lot, stade) => {
      evalues.push(...lot.questions.filter(({ nature }) => nature === 'relaisExportes').map(({ f }) => f))
      return evaluerLotDuDepot(lot, stade)
    } }
  const froid = deriverPerimetre(entree)
  assert.equal(froid.retenus.get('scripts/a.test.mjs')?.nature, 'racine balayée')
  assert.deepEqual([...new Set(evalues)].sort(), [...lecteurs, 'scripts/relais.mjs', 'scripts/a.test.mjs'].sort(), 'chaque lecteur, au-delà d\'un lot, puis chaque relais devenu lecteur, tour après tour')
  const requetes = (memos.lire('evaluations', 'relaisExportes:scripts/relais.mjs') ?? []).flatMap((v) => v.requetes)
  assert.ok(requetes.some(([q, r]) => q === '["peutLire","scripts/lecteur0.mjs"]' && r === true))
  ecrits.length = 0
  const chaud = deriverPerimetre(entree)
  assert.deepEqual([...chaud.retenus], [...froid.retenus])
  assert.deepEqual(chaud.nonResolus, froid.nonResolus)
  assert.deepEqual(ecrits.filter((nom) => nom === 'evaluations' || nom === 'lectures'), [], 'variantes chaudes : ni lecture ni évaluation recalculée')
})

test('production fermée : clôture exacte par lot, lecteurs figés, deux lots et un reste de questions, hits sans noyau', (t) => {
  const N = 2 * LOT + 1
  const premiers = Array.from({ length: N }, (_, i) => `scripts/lecteur${i}.mjs`)
  const textes = new Map([
    ...premiers.map((f, i) => [f, `import {readFileSync} from 'node:fs'; import {base} from './dep${i}.mjs'; import './autre${i}.mjs'; export function scanner(p){return readFileSync(base+'/'+p)}`]),
    ...Array.from({ length: N }, (_, i) => [`scripts/dep${i}.mjs`, "export * from './reexport.mjs'; export * from './reexport.mjs'"]),
    ...Array.from({ length: N }, (_, i) => [`scripts/autre${i}.mjs`, "import './reexport.mjs'; export const autre=1"]),
    ['scripts/reexport.mjs', "export * from './constantes.mjs'; export * from './absent.mjs'"],
    ['scripts/constantes.mjs', "export const base='src'"],
    ['scripts/relais.mjs', "import {scanner} from './lecteur0.mjs'; export function passer(p){return scanner(p)}"],
    ['scripts/a.test.mjs', premiers.map((f) => `import './${f.slice('scripts/'.length)}'`).join(';') + ";import {passer} from './relais.mjs'; passer('a.txt')"],
    ['src/a.txt', 'a'],
  ])
  const lots = []
  const analyses = []
  const entree = { racine: dossierDe(t), touches: ['src/a.txt'], post: [...textes.keys()], avant: [], tailleLot: LOT,
    lire: (fs) => new Map(fs.map((f) => [f, textes.get(f) ?? null])) }
  const observee = {
    evaluerLot: (lot) => { lots.push({ lot, lecteurs: [...lot.lecteurs] }); return evaluerLotDuDepot(lot) },
    analyser: (entrees) => { const lus = [...entrees]; analyses.push(lus.map((e) => e.rel)); return analyserEnLots(lus) } }
  const memoire = () => {
    const entries = new Map()
    return { entries, lire: (famille, cle) => entries.get(`${famille}:${cle}`), ecrire: (famille, cle, v) => entries.set(`${famille}:${cle}`, v) }
  }
  const memosDuBanc = memoire()
  const visites = []
  const froid = deriverPerimetre({ ...entree, ...observee, memos: memosDuBanc, stade: (nom, f) => { if (nom === 'visite') visites.push(f) } })
  assert.ok(visites.includes('scripts/constantes.mjs'))
  assert.equal(new Set(visites).size, visites.length, 'une lecture se visite une fois par dérivation, pas une fois par lot')
  const tours = [premiers, ['scripts/relais.mjs'], ['scripts/a.test.mjs']]
  const tourDe = ({ nature, f }) => nature === 'sitesDe' ? tours.length - 1 : tours.findIndex((tour) => tour.includes(f))
  const vus = new Set()
  for (const { lot, lecteurs } of lots) {
    assert.deepEqual(lot.lecteurs, lecteurs, 'le lot garde les lecteurs reçus')
    const tour = Math.max(...lot.questions.map(tourDe))
    vus.add(tour)
    assert.deepEqual([...lot.lecteurs].sort(), tours.slice(0, tour + 1).flat().sort(), 'les lecteurs d\'un tour sont figés à son début')
  }
  assert.deepEqual([...vus].sort(), [0, 1, 2])
  assert.ok(lots.some(({ lot }) => lot.questions.length === LOT))
  assert.ok(lots.some(({ lot }) => lot.questions.length < LOT))
  const certifiees = new Map()
  for (const { lot } of lots) {
    assert.ok(lot.questions.length <= LOT)
    const lus = new Map(lot.lectures)
    assert.ok(lus.has('scripts/constantes.mjs'))
    assert.ok(lot.resolutions.some(([, spec, cible]) => spec === './absent.mjs' && cible === null))
    const fermeture = new Set(lot.questions.map(({ f }) => f))
    for (const f of fermeture) for (const [module, , cible] of lot.resolutions) if (module === f && cible !== null) fermeture.add(cible)
    assert.deepEqual([...lus.keys()].sort(), [...fermeture].sort(), 'clôture exacte du lot')
    for (const [f, lu] of lus) {
      assert.ok(lu === null || Object.isFrozen(lu), f)
      if (certifiees.has(f)) assert.equal(lu, certifiees.get(f), `une lecture certifiée une fois par dérivation : ${f}`)
      certifiees.set(f, lu)
    }
  }
  const prelus = analyses.flat()
  assert.equal(new Set(prelus).size, prelus.length, 'un module s\'analyse une fois par dérivation')
  assert.ok(analyses.some((vague) => vague.length > LOT), 'une vague se prélit entière, en lots pleins')
  for (const [cle, valeur] of memosDuBanc.entries) if (cle.startsWith('lectures:')) assert.equal(typeof valeur, 'string')
  const nombre = lots.length
  analyses.length = 0
  assert.deepEqual(deriverPerimetre({ ...entree, ...observee, memos: memosDuBanc }), froid)
  assert.equal(lots.length, nombre, 'hits sans noyau')
  assert.deepEqual(analyses.flat(), [], 'hits sans analyse')
})

test('pool physique : la limite paramétrée borne aussi le transport compact', () => {
  const pool = encoderLecture('x')
  const taille = Buffer.byteLength(pool)
  assert.equal(bornerIR('a.mjs', pool, taille), pool)
  assert.throws(() => bornerIR('a.mjs', pool, taille - 1), /pool IR.*limite/)
})

/** La fermeture de producteurs de FIXTURE : le producteur importe l'extracteur, qui importe le programme. */
const PRODUCTEURS = Object.freeze({
  'scripts/test/perimetreDerivation.mjs': "import { extracteur } from '../guards/lib/importGraph.mjs'\nconst signatures = new Map()\nexport const producteur = () => signatures.size + extracteur\n",
  'scripts/guards/lib/importGraph.mjs': "import { programme } from './tsProgram.mjs'\nexport const extracteur = programme.length\n",
  'scripts/guards/lib/tsProgram.mjs': "import { readFileSync } from 'node:fs'\nexport const programme = readFileSync.name\n",
})
const NOMBRE_DE_PRODUCTEURS = Object.keys(PRODUCTEURS).length

/** Le banc des producteurs : la fixture `PRODUCTEURS` et ses `FICHIERS_DE_CONTEXTE` sous un dossier jetable, posés comme
 *  racine du code (`racineDuCode`) ; `lancer` en calcule la version dans ce processus, `lancerAilleurs` dans un neuf. Une
 *  version compte ses producteurs normalisés ; `echec` fait échouer la normalisation du dernier, `analyser` remplace la
 *  couture d'analyse. */
function producteursDe(t) {
  const dossier = dossierDe(t)
  const corpus = join(dossier, 'corpus')
  const contexte = FICHIERS_DE_CONTEXTE.map((f) => [f, f.endsWith('package.json') ? '{"version":"1.0.0"}\n' : '{"compilerOptions":{}}\n'])
  for (const [f, texte] of [...Object.entries(PRODUCTEURS), ...contexte]) {
    mkdirSync(dirname(join(corpus, f)), { recursive: true })
    writeFileSync(join(corpus, f), texte)
  }
  const lancer = (mode = 'ecriture', { echec, injecter, format, analyser } = {}) => {
    let normalisations = 0
    const version = versionDesMemosDeDerivation(corpus, {
      racineDuCode: corpus, dossierDesMemos: dossier, lectureSeule: mode === 'lectureSeule',
      ...(format ? { format } : {}),
      ...(analyser ? { analyser } : {}),
      ...(injecter === 'lire' ? { lire: (...args) => readFileSync(...args) } : {}),
      ...(injecter === 'fermeture' ? { fermeture: (...args) => fermetureSurDisque(...args) } : {}),
      stade: (etape) => {
        if (etape === 'normalisation' && ++normalisations === NOMBRE_DE_PRODUCTEURS && echec) throw new Error('normalisation injectée')
      },
    })
    return { version, normalisations }
  }
  const lancerAilleurs = async () => {
    const pilote = join(dossier, 'pilote.mjs')
    writeFileSync(pilote, `import { versionDesMemosDeDerivation } from ${JSON.stringify(new URL('./perimetreDerivation.mjs', import.meta.url).href)}
let normalisations = 0
const version = versionDesMemosDeDerivation(${JSON.stringify(corpus)}, { racineDuCode: ${JSON.stringify(corpus)}, dossierDesMemos: ${JSON.stringify(dossier)}, stade: (etape) => { if (etape === 'normalisation') normalisations++ } })
console.log(JSON.stringify({ version, normalisations }))
`)
    const r = await spawnBorne({ argv: [pilote], cwd: dossier, fichier: join(dossier, 'log'), limiteMs: 10000, fluxDistincts: true })
    assert.equal(r.code, 0, `${r.expiree ? 'pilote expiré, ' : ''}code ${r.code} : ${r.sortie}`)
    try { return JSON.parse(r.stdout.trim()) }
    catch (e) { throw new Error(`pilote : stdout hors contrat JSON (${e.message})\nstdout : ${r.stdout}\nstderr : ${r.stderr}`, { cause: e }) }
  }
  return { dossier, corpus, lancer, lancerAilleurs }
}

test('extraction producteurs : hit, bootstrap brut et lecture seule', (t) => {
  const { dossier, corpus, lancer } = producteursDe(t)
  const froid = lancer('ecriture')
  const fichier = dernierMemo(dossier, 'extractionProducteurs')
  const brut = readFileSync(fichier, 'utf8')
  const ecrit = JSON.parse(brut)
  assert.match(ecrit.version, /^[a-f0-9]{64}$/)
  assert.equal(Object.keys(ecrit.memos).length, NOMBRE_DE_PRODUCTEURS)
  const chaud = lancer('ecriture')
  assert.equal(chaud.version, froid.version)
  assert.deepEqual(lancer('lectureSeule'), chaud)
  assert.equal(readFileSync(fichier, 'utf8'), brut)
  writeFileSync(fichier, JSON.stringify({ version: ecrit.version, memos: tableTotale(Object.keys(ecrit.memos), () => []) }) + '\n')
  assert.notEqual(lancer('lectureSeule').version, froid.version, 'la fermeture lit l\'extraction mémoïsée')
  writeFileSync(fichier, brut)
  const transitif = join(corpus, 'scripts/guards/lib/tsProgram.mjs')
  writeFileSync(transitif, `${readFileSync(transitif, 'utf8')}\nexport const revisionExtracteur = 2586\n`)
  const modifie = lancer('ecriture')
  const extraction = JSON.parse(readFileSync(dernierMemo(dossier, 'extractionProducteurs'), 'utf8'))
  assert.notEqual(extraction.version, ecrit.version)
  assert.equal(Object.keys(extraction.memos).length, NOMBRE_DE_PRODUCTEURS)
  assert.notEqual(modifie.version, froid.version)
  assert.equal(lancer('ecriture').version, modifie.version)
})

test('extraction producteurs : l\'entête suit l\'état de la fermeture d\'amorçage, jamais l\'histoire du processus (#2586)', (t) => {
  const entete = (corpus) => {
    const dossier = dossierDe(t)
    versionDesMemosDeDerivation(corpus, { racineDuCode: corpus, dossierDesMemos: dossier, fermeture: (...args) => (fermetureSurDisque(...args), []) })
    const fichiers = fichiersMemos(dossier, 'extractionProducteurs')
    assert.equal(fichiers.length, 1)
    return /extractionProducteurs\.([a-f0-9]{64})\.json$/.exec(fichiers[0])[1]
  }
  const poser = (corpus, fichiers) => {
    for (const [f, texte] of Object.entries(fichiers)) {
      if (texte === null) { rmSync(join(corpus, f)); continue }
      mkdirSync(dirname(join(corpus, f)), { recursive: true })
      writeFileSync(join(corpus, f), texte)
    }
  }
  const lib = 'scripts/guards/lib'
  const { corpus } = producteursDe(t)
  const cumul = {}
  const vus = []
  for (const [etat, fichiers] of [
    ['spécificateur sans candidat', { [`${lib}/importGraph.mjs`]: `${PRODUCTEURS[`${lib}/importGraph.mjs`]}import './outil'\n` }],
    ['module ajouté', { [`${lib}/outil/index.mjs`]: 'export const outil = 1\n' }],
    ['candidat de résolution apparu', { [`${lib}/outil.mjs`]: 'export const outil = 2\n' }],
    ['contenu changé', { [`${lib}/autre.mjs`]: 'export const autre = 3\n', [`${lib}/outil.mjs`]: "import './autre.mjs'\nexport const outil = 2\n" }],
    ['module retiré', { [`${lib}/outil.mjs`]: null }],
  ]) {
    poser(corpus, fichiers)
    Object.assign(cumul, fichiers)
    const neuf = producteursDe(t).corpus
    poser(neuf, Object.fromEntries(Object.entries(cumul).filter(([, texte]) => texte !== null)))
    const courant = entete(corpus)
    assert.equal(courant, entete(neuf), etat)
    assert.notEqual(courant, vus.at(-1), etat)
    vus.push(courant)
  }
  assert.equal(vus.at(-1), vus[1], 'module retiré : la fermeture du module ajouté')
})

test('version producteurs : froid canonique puis hit interprocessus et fermeture relue', async (t) => {
  const { dossier, corpus, lancer, lancerAilleurs } = producteursDe(t)
  const froid = lancer()
  const chaud = await lancerAilleurs()
  t.diagnostic(JSON.stringify({ froid, chaud }))
  assert.equal(froid.normalisations, NOMBRE_DE_PRODUCTEURS)
  assert.deepEqual(chaud, { version: froid.version, normalisations: 0 })
  const fichier = dernierMemo(dossier, 'versionProducteurs')
  const memo = JSON.parse(readFileSync(fichier, 'utf8'))
  assert.deepEqual(Object.keys(memo.memos), ['version'])
  assert.equal(memo.memos.version, froid.version)
  assert.match(memo.version, /^[a-f0-9]{64}$/)
  for (const f of Object.keys(PRODUCTEURS)) {
    const chemin = join(corpus, f)
    writeFileSync(chemin, readFileSync(chemin, 'utf8').replace('import ', '/* trivia */ import '))
  }
  const trivia = lancer()
  assert.equal(trivia.normalisations, NOMBRE_DE_PRODUCTEURS)
  assert.equal(trivia.version, froid.version, 'trivia sur chaque producteur')
  assert.notEqual(JSON.parse(readFileSync(dernierMemo(dossier, 'versionProducteurs'), 'utf8')).version, memo.version)
  assert.equal(lancer().normalisations, 0)
})

test('version producteurs : corruption, entête et lecture seule physiques', (t) => {
  const { dossier, lancer } = producteursDe(t)
  const froid = lancer('lectureSeule')
  assert.equal(Boolean(dernierMemo(dossier, 'versionProducteurs')), false)
  lancer()
  const fichier = dernierMemo(dossier, 'versionProducteurs')
  const brut = readFileSync(fichier, 'utf8')
  for (const mauvais of [JSON.stringify({ ...JSON.parse(brut), version: 'autre' }), JSON.stringify({ ...JSON.parse(brut), memos: { version: 'invalide' } }), '{']) {
    writeFileSync(fichier, mauvais)
    const ro = lancer('lectureSeule')
    assert.ok(ro.normalisations > 0)
    assert.equal(ro.version, froid.version)
    assert.equal(readFileSync(fichier, 'utf8'), mauvais)
  }
  const repare = lancer()
  assert.equal(repare.version, froid.version)
  assert.equal(readFileSync(fichier, 'utf8'), brut)
})

/** Une couture d'analyse qui rend chaque producteur puis lève à la libération, dans le `finally` de son générateur. */
function* analyseQuiLeveALaLiberation(modules) {
  const liberer = () => { throw new Error('libération injectée') }
  try { yield* analyserCorpus(modules) } finally { liberer() }
}
const PANNES_DE_VERSION = [['à la normalisation du dernier producteur', { echec: true }], ['au finally du générateur d’analyse (libération)', { analyser: analyseQuiLeveALaLiberation }]]
for (const [titre, panne] of PANNES_DE_VERSION) test(`version producteurs : échec ${titre} non persisté puis reprise`, (t) => {
  const { dossier, lancer } = producteursDe(t)
  const rate = lancer('ecriture', panne)
  assert.equal(rate.normalisations, NOMBRE_DE_PRODUCTEURS)
  assert.equal(Boolean(dernierMemo(dossier, 'versionProducteurs')), false)
  const canonique = lancer()
  assert.equal(canonique.normalisations, NOMBRE_DE_PRODUCTEURS)
  assert.notEqual(rate.version, canonique.version)
  assert.deepEqual(lancer(), { version: canonique.version, normalisations: 0 })
})

test('version producteurs : dépendances brutes, normaliseur, config, paquet, format et nouveau producteur', (t) => {
  const { dossier, corpus, lancer } = producteursDe(t)
  let precedent = lancer()
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
    const courant = lancer('ecriture', options)
    assert.ok(courant.normalisations > 0, f ?? 'format')
    assert.notEqual(courant.version, precedent.version, f ?? 'format')
    const memo = JSON.parse(readFileSync(dernierMemo(dossier, 'versionProducteurs'), 'utf8'))
    assert.notEqual(memo.version, entete)
    assert.deepEqual(Object.keys(memo.memos), ['version'])
    precedent = courant
    entete = memo.version
  }
})

for (const injecter of ['lire', 'fermeture']) test(`version producteurs : injection ${injecter} non persistante`, (t) => {
  const { dossier, lancer } = producteursDe(t)
  const froid = lancer('ecriture', { injecter })
  assert.equal(Boolean(dernierMemo(dossier, 'versionProducteurs')), false)
  const canonique = lancer()
  assert.equal(canonique.version, froid.version)
  const brut = readFileSync(dernierMemo(dossier, 'versionProducteurs'), 'utf8')
  const injecte = lancer('ecriture', { injecter })
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

test('version : la vraie fermeture des producteurs est versionnée, CLI hors fermeture', (t) => {
  const appels = []
  versionDesMemosDeDerivation(dossierDe(t), { fermeture: (...args) => (appels.push(args.slice(0, 2)), [['producteur.mjs', 'a']]), lire: () => '{}' })
  assert.deepEqual(appels, [['scripts/test/perimetreDerivation.mjs', fileURLToPath(new URL('../..', import.meta.url))]])
  const fermeture = fermetureSurDisque(...appels[0])
  assert.ok(fermeture.some(([f]) => f === 'scripts/guards/lib/tsProgram.mjs'))
  assert.equal(fermeture.some(([f]) => f === 'scripts/test/perimetre.mjs'), false)
})

test('version : fermeture des producteurs transitifs, paquet, config et format', (t) => {
  const { corpus } = producteursDe(t)
  const versionDe = (options) => versionDesMemosDeDerivation(corpus, { racineDuCode: corpus, ...options })
  const textes = [['producteur.mjs', 'a'], ['transitif.mjs', 'b']]
  const options = { fermeture: () => textes, lire: (f) => f.endsWith('package.json') ? '{"version":"1"}' : '{}' }
  const v = versionDe(options)
  assert.equal(versionDe(options), v)
  assert.notEqual(versionDe({ ...options, fermeture: () => [['producteur.mjs', 'a'], ['transitif.mjs', 'c']] }), v)
  assert.notEqual(versionDe({ ...options, format: 'nouveau' }), v)
  assert.notEqual(versionDe({ ...options, lire: (f) => f.endsWith('package.json') ? '{"version":"2"}' : '{}' }), v)
  assert.notEqual(versionDe({ ...options, lire: (f) => f.endsWith('package.json') ? '{"version":"1"}' : '{"compilerOptions":{}}' }), v)
})

test('version : tokens du parseur, trivia, littéraux, ASI et directives', () => {
  const signatures = (textes) => [...analyserCorpus(textes.map((text, i) => ({ rel: `producteur${i}.mjs`, text })))].map((analyse) => signatureDeProducteur(analyse.fichier.text, analyse).signature)
  const initial = 'export function f() { return /a\\/b/.test(`x${1 + 2}`) && "a // b"; }'
  const ordinaires = [initial.replace('return ', 'return /* ordinaire */ '), initial.replace('1 + 2', '1  +  2')]
  const paires = [
    [initial, initial.replace('/a\\/b/', '/a\\/c/')],
    [initial, initial.replace('`x${', '`y${')],
    [initial, initial.replace('"a // b"', '"a // c"')],
    [initial, initial.replace('1 + 2', '1 - 2')],
    ['function f() { return 1 }', 'function f() { return\n1 }'],
    ['/// <reference path="a.ts" />\nexport const a = 1', '/// <reference path="b.ts" />\nexport const a = 1'],
    ['#!/usr/bin/node\nexport const a = 1', '#!/usr/bin/env node\nexport const a = 1'],
    ['// @ts-check\nexport const a = 1', '// @ts-nocheck\nexport const a = 1'],
    ['export const =', 'export  const ='],
  ]
  const [canonique, ...autres] = signatures([initial, ...ordinaires, ...paires.flat()])
  for (const ordinaire of autres.slice(0, ordinaires.length)) assert.equal(ordinaire, canonique)
  const sigs = autres.slice(ordinaires.length)
  for (const [i, [, apres]] of paires.entries()) assert.notEqual(sigs[2 * i + 1], sigs[2 * i], apres)
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

test('IR sur lectures prélues, dépendance et lecteur, hit et miss : même borne nommée', (t) => {
  const limiteIR = 50_000
  const textes = new Map([
    ['scripts/a.test.mjs', "import { base } from './relais.mjs'; import { readFileSync } from 'node:fs'; readFileSync(base)"],
    ['scripts/relais.mjs', "export { base } from './profond.mjs'"],
    ['scripts/profond.mjs', `export const base = '${'x'.repeat(2 * limiteIR)}'`],
    ['src/a.json', '{}'],
  ])
  const entree = { racine: dossierDe(t), touches: ['src/a.json'], post: [...textes.keys()], avant: [], limiteIR,
    lire: (rels) => new Map(rels.map((r) => [r, textes.get(r) ?? null])) }
  const enorme = encoderLecture({ enorme: 'x'.repeat(2 * limiteIR) })
  const hitSur = (module) => ({ lire: (nom, cle) => nom === 'lectures' && cle.startsWith(`${module}:`) ? enorme : undefined, ecrire: () => {} })
  const lourd = new Map([...textes, ['scripts/a.test.mjs', `${textes.get('scripts/a.test.mjs')}; export const grand = '${'x'.repeat(2 * limiteIR)}'`], ['scripts/profond.mjs', "export const base = 'src'"]])
  for (const [mode, module, variante, dernierStade] of [
    ['dépendance, miss', 'scripts/profond.mjs', {}, ['prélire', 'scripts/profond.mjs']],
    ['dépendance, hit', 'scripts/profond.mjs', { memos: hitSur('scripts/profond.mjs') }],
    ['lecteur, miss', 'scripts/a.test.mjs', { lire: (rels) => new Map(rels.map((r) => [r, lourd.get(r) ?? null])) }, ['prélire', 'scripts/a.test.mjs']],
    ['lecteur, hit', 'scripts/a.test.mjs', { memos: hitSur('scripts/a.test.mjs') }],
  ]) {
    const stades = []
    assert.throws(() => deriverPerimetre({ ...entree, ...variante, stade: (nom, f) => stades.push([nom, f]) }), new RegExp(`IR de ${module.replaceAll('/', '\\/')}.*limite ${limiteIR}`), mode)
    if (dernierStade) assert.deepEqual(stades.at(-1), dernierStade, mode)
  }
})

test('défauts de production : LOT_D_ANALYSE questions par lot d\'évaluation, IR bornée à LIMITE_IR', (t) => {
  const lecteurs = Array.from({ length: LOT_D_ANALYSE + 1 }, (_, i) => `scripts/lecteur${i}.mjs`)
  const textes = new Map([
    ...lecteurs.map((f) => [f, "import {readFileSync} from 'node:fs'; readFileSync('src/a.txt')"]),
    ['scripts/a.test.mjs', lecteurs.map((f) => `import './${f.slice('scripts/'.length)}'`).join(';')],
    ['src/a.txt', 'a'],
  ])
  const entree = { racine: dossierDe(t), touches: ['src/a.txt'], post: [...textes.keys()], avant: [], lire: (fs) => new Map(fs.map((f) => [f, textes.get(f) ?? null])) }
  const specificateurs = new Map()
  const lots = []
  deriverPerimetre({ ...entree,
    memos: { lire: (nom, cle) => nom === 'specificateurs' ? specificateurs.get(cle) : undefined, ecrire: (nom, cle, v) => { if (nom === 'specificateurs') specificateurs.set(cle, v) } },
    evaluerLot: (lot) => {
      lots.push(lot.questions.length)
      return lot.questions.map(({ f }) => ({ f, resultat: [], requetes: [] }))
    } })
  assert.deepEqual(lots, [LOT_D_ANALYSE, 1, LOT_D_ANALYSE, 1], 'relaisExportes puis sitesDe, chacun en un lot plein et un reste')
  const pool = 'x'.repeat(LIMITE_IR + 1)
  assert.throws(() => deriverPerimetre({ ...entree, memos: { lire: (nom, cle) => nom === 'lectures' ? pool : nom === 'specificateurs' ? specificateurs.get(cle) : undefined, ecrire: () => {} } }),
    new RegExp(`perimetre : pool IR de scripts/lecteur\\d+\\.mjs > limite ${LIMITE_IR}$`))
})

test('dérivation : lecteur et dépendance prélus, mémos passés par JSON froids puis chauds, blob changé relu', (t) => {
  const temoin = 'scripts/nouveau.test.mjs'
  const prelu = 'scripts/nouveau.mjs'
  const direct = 'scripts/profond.mjs'
  const modules = new Map([
    [temoin, "import { inédit } from './nouveau.mjs'; inédit(true)"],
    [prelu, "import { readFileSync } from 'node:fs'; import { chemin } from './relais.mjs'; export function inédit(flag) { if (flag) readFileSync(chemin) }"],
    ['scripts/relais.mjs', "export { chemin } from './profond.mjs'"],
    [direct, "export const chemin = 'src/a.json'"],
  ])
  const json = new Map()
  let hits = 0
  const memos = {
    lire(nature, cle) { if (nature === 'evaluations') return undefined; const bytes = json.get(nature + ':' + cle); if (bytes === undefined) return undefined; if (nature === 'lectures') hits++; return JSON.parse(bytes) },
    ecrire(nature, cle, lu) { json.set(nature + ':' + cle, JSON.stringify(lu)) },
  }
  const stades = []
  const analyses = []
  const lectures = () => tableTotale([prelu, direct], (m) => ({
    stades: stades.filter(([nom, f]) => f === m && nom === 'prélire').map(([nom]) => nom),
    analyses: analyses.filter((f) => f === m).length,
  }))
  const entree = { racine: dossierDe(t), touches: ['src/a.json'], post: [...modules.keys(), 'src/a.json'], avant: [], memos,
    lire: (rels) => new Map(rels.map((f) => [f, modules.get(f) ?? null])), stade: (nom, f) => { stades.push([nom, f]) },
    analyser: (entrees) => { const lus = [...entrees]; analyses.push(...lus.map((e) => e.rel)); return analyserEnLots(lus) } }
  const deriver = () => {
    stades.length = 0
    analyses.length = 0
    return deriverPerimetre(entree)
  }
  const relues = { [prelu]: { stades: ['prélire'], analyses: 1 }, [direct]: { stades: ['prélire'], analyses: 1 } }
  const froid = deriver()
  assert.ok(froid.retenus.has(temoin))
  assert.deepEqual(lectures(), relues, 'froid : chaque lecture analysée une fois, par la couture d\'analyse')
  const chaud = deriver()
  assert.deepEqual(chaud, froid)
  assert.ok(hits > 0, 'chaud : lectures servies par le mémo JSON')
  assert.deepEqual(lectures(), { [prelu]: { stades: [], analyses: 0 }, [direct]: { stades: [], analyses: 0 } }, 'chaud : aucune analyse')
  modules.set(prelu, `${modules.get(prelu)}; export const revision = 2`)
  modules.set(direct, modules.get(direct).replace('src/a.json', 'src/b.json'))
  const change = deriver()
  assert.deepEqual(lectures(), relues, 'blob changé : relu')
  assert.equal(change.retenus.has(temoin), false)
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

test('enfant : le marqueur, diagnostic seul, ne masque ni ne fabrique l’échec de la dérivation (#2586)', async (t) => {
  const d = dossierDe(t)
  const reussi = { code: 0, expiree: false, annulee: false, arret: { etat: 'mort', erreurs: [] } }
  const lancerAvec = (marqueur, sortie, vu = reussi) => async ({ argv }) => {
    if (marqueur !== null) writeFileSync(argv.at(-1), marqueur)
    if (sortie !== null) writeFileSync(argv.at(-2), sortie)
    return vu
  }
  const derive = deriveDe('scripts/a.test.mjs')
  assert.deepEqual(await derivationBornee({ racine: d }, { lancer: lancerAvec('{', JSON.stringify(enDTO(images, derive))) }), { ...images, ...derive }, 'enfant réussi : marqueur invalide sans effet')
  await assert.rejects(() => derivationBornee({ racine: d }, { lancer: lancerAvec('{"stade":"lec', null, { ...reussi, code: 1, sortie: 'TRACE-ENFANT' }) }),
    (e) => /^perimetre : dérivation échouée au stade illisible \(marqueur .*stade\.json : .+\), module —, durée \d+ ms, limite 180000 ms, code 1, arrêt mort\nTRACE-ENFANT$/.test(e.message) && e.cause instanceof SyntaxError)
  await assert.rejects(() => derivationBornee({ racine: d }, { lancer: lancerAvec('{', '{"tronqu') }),
    (e) => /^perimetre : DTO absent ou tronqué au stade illisible \(marqueur .*stade\.json : .+\), module —, durée/.test(e.message) && e.cause instanceof SyntaxError)
  await assert.rejects(() => derivationBornee({ racine: d }, { lancer: lancerAvec(null, '{"tronqu') }),
    (e) => /^perimetre : DTO absent ou tronqué au stade lancement, module —, durée/.test(e.message) && e.cause instanceof SyntaxError)
})

/** Un tiers qui tient `chemin` SANS PARTAGE (`FileShare None`, PowerShell) dès `<chemin>.pret`, jusqu'à `liberer`, au plus
 *  20 s ; le test `t` le libère et l'attend à sa fin, rouge compris. */
async function tenirSansPartage(t, chemin) {
  const [pret, libere, relache] = ['pret', 'libere', 'relache'].map((s) => `${chemin}.${s}`)
  const tiers = spawn('powershell', ['-NoProfile', '-NonInteractive', '-Command',
    `$f = [System.IO.File]::Open('${chemin}', 'Open', 'Read', 'None'); [System.IO.File]::WriteAllText('${pret}', '1'); $fin = (Get-Date).AddSeconds(20); while (-not (Test-Path -LiteralPath '${libere}') -and (Get-Date) -lt $fin) { Start-Sleep -Milliseconds 20 }; $f.Close(); [System.IO.File]::WriteAllText('${relache}', '1')`], { stdio: 'ignore' })
  const fin = new Promise((r) => tiers.on('exit', r))
  let libre = false
  const liberer = () => {
    if (libre) return
    libre = true
    writeFileSync(libere, '1')
    for (const echeance = Date.now() + 25_000; !existsSync(relache) && tiers.exitCode === null && Date.now() < echeance;) attendreSync(20)
  }
  t.after(async () => {
    liberer()
    await fin
  })
  for (const echeance = Date.now() + 15_000; !existsSync(pret); await new Promise((r) => setTimeout(r, 20)))
    if (Date.now() > echeance) throw new Error(`tiers non prêt sur ${chemin}`)
  return { liberer }
}

test('enfant : un marqueur tenu par un tiers se relit sous les paliers, tenu au-delà il est dit illisible, jamais « lancement » (#2586)', { skip: process.platform !== 'win32' && 'violation de partage propre à win32' }, async (t) => {
  const d = dossierDe(t)
  for (const [tenu, attendu] of [[false, /^perimetre : dérivation échouée au stade lecture, module scripts\/feuille\.mjs, durée/],
    [true, /^perimetre : dérivation échouée au stade illisible \(marqueur .*stade\.json : tenu par un tiers au-delà de 2000 \+ 5000 ms\), module —, durée/]]) {
    let tiers, temp
    const attentes = []
    const lancer = async ({ argv }) => {
      temp = dirname(argv.at(-1))
      writeFileSync(argv.at(-1), '{"stade":"lecture","module":"scripts/feuille.mjs"}\n')
      tiers = await tenirSansPartage(t, argv.at(-1))
      return { code: 1, expiree: false, annulee: false, arret: { etat: 'indetermine' }, sortie: 'TRACE-ENFANT' }
    }
    const attendre = (ms) => {
      attentes.push(ms)
      if (!tenu) tiers.liberer()
    }
    await assert.rejects(() => derivationBornee({ racine: d }, { lancer, attendre }), (e) => attendu.test(e.message) && e.message.endsWith('\nTRACE-ENFANT'))
    assert.deepEqual(attentes, tenu ? BACKOFFS_MS : BACKOFFS_MS.slice(0, 1))
    tiers.liberer()
    rmSync(temp, { recursive: true, force: true })
  }
})

test('enfant : le code de sortie est celui de la dérivation, la panne du marqueur s’imprime sans le changer (#2586)', (t) => {
  const d = dossierDe(t)
  const [entree, sortie, bloquant] = ['entree.json', 'sortie.json', 'bloquant'].map((f) => join(d, f))
  writeFileSync(entree, '{"racine":"r"}')
  writeFileSync(bloquant, '')
  const journal = []
  t.mock.method(console, 'error', (texte) => { journal.push(String(texte)) })
  const argv = [entree, sortie, join(bloquant, 'stade.json')]
  assert.equal(deriverDansLEnfant(argv, { produire: (e, stade) => { stade('images', null); return { lu: e } } }), 0)
  assert.deepEqual(JSON.parse(readFileSync(sortie, 'utf8')), { lu: { racine: 'r' } })
  assert.match(journal.join('\n'), /guetteur du marqueur de stade .* mort/)
  journal.length = 0
  assert.equal(deriverDansLEnfant(argv, { produire: (e, stade) => { stade('graphe', null); throw new Error('dérivation en échec') } }), 1)
  assert.match(journal.join('\n'), /dérivation en échec[^]*guetteur du marqueur de stade .* mort/)
})

test('enfant : lancement canonique positif et résultat reconstruit nettoient Temp', async (t) => {
  const d = dossierDe(t)
  const derive = deriveDe('scripts/a.test.mjs')
  let temp
  const lancer = async ({ argv, fichier }) => {
    temp = dirname(fichier)
    assert.ok(argv.includes(`--max-old-space-size=${TAS_DERIVATION_MO}`))
    writeFileSync(argv.at(-2), JSON.stringify(enDTO(images, derive)))
    return { code: 0, expiree: false, annulee: false, arret: { etat: 'mort', erreurs: [] } }
  }
  assert.deepEqual(await derivationBornee({ racine: d }, { lancer }), { ...images, ...derive })
  assert.equal(existsSync(temp), false)
})

test('checkpoints : interruption après lot entier conserve un lot de sites et versions coexistantes', (t) => {
  const racine = dossierDe(t)
  const chiffres = String(LOT).length
  const textes = new Map([
    ...Array.from({ length: LOT + 1 }, (_, i) => ['scripts/lecteur' + String(i).padStart(chiffres, '0') + '.mjs', "import {readFileSync} from 'node:fs'; readFileSync('src/a.txt')"]),
    ['scripts/a.test.mjs', Array.from({ length: LOT + 1 }, (_, i) => "import './lecteur" + String(i).padStart(chiffres, '0') + ".mjs'").join(';')],
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
  const entree = { racine, tailleLot: LOT, touches: ['src/a.txt'], post: [...textes.keys()], avant: [],
    lire: (fs) => new Map(fs.map((f) => [f, textes.get(f) ?? null])), memos,
    stade: (nature) => { if (nature === 'sitesDe' && ++sites === 2) throw new Error('interruption injectée après lot') } }
  try { assert.throws(() => deriverPerimetre(entree), /interruption injectée/) } finally { serialiser.mock.restore() }
  const fichier = join(racine, 'evaluations.' + version + '.json')
  const avant = readFileSync(fichier, 'utf8')
  const ecrits = Object.keys(JSON.parse(avant).memos)
  assert.equal(ecrits.filter((cle) => cle.startsWith('sitesDe:')).length, LOT)
  assert.equal(ecrits.filter((cle) => cle.startsWith('relaisExportes:')).length, LOT + 1)
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
  assert.equal(Object.keys(JSON.parse(readFileSync(fichier, 'utf8')).memos).filter((cle) => cle.startsWith('sitesDe:')).length, LOT + 1)
  t.diagnostic(JSON.stringify({ checkpoints: cout }))
})

test('checkpoints : un par lot d\'évaluation, quel que soit le nombre de programmes d\'analyse (#2586)', (t) => {
  const deps = 2
  const textes = new Map([
    ['scripts/lecteur.mjs', "import {readFileSync} from 'node:fs'; " + Array.from({ length: deps }, (_, i) => `import './dep${i}.mjs'`).join(';') + "; readFileSync('src/a.txt')"],
    ...Array.from({ length: deps }, (_, i) => [`scripts/dep${i}.mjs`, 'export const d = 1']),
    ['scripts/a.test.mjs', "import './lecteur.mjs'"],
    ['src/a.txt', 'a'],
  ])
  const specificateurs = new Map()
  const sauvegardes = (tailleDAnalyse) => {
    const entrees = new Map(specificateurs)
    let n = 0
    const programmes = []
    const memos = { lire: (famille, cle) => entrees.get(`${famille}:${cle}`), ecrire: (famille, cle, v) => entrees.set(`${famille}:${cle}`, v), sauver: () => { n++ } }
    deriverPerimetre({ racine: dossierDe(t), touches: ['src/a.txt'], post: [...textes.keys()], avant: [], memos,
      analyser: (lus) => { const tous = [...lus]; programmes.push(Math.ceil(tous.length / tailleDAnalyse)); return analyserEnLots(tous, tailleDAnalyse) },
      lire: (fs) => new Map(fs.map((f) => [f, textes.get(f) ?? null])) })
    for (const [cle, v] of entrees) if (cle.startsWith('specificateurs:')) specificateurs.set(cle, v)
    return { sauvegardes: n, programmes: programmes.reduce((a, b) => a + b, 0) }
  }
  const parDeux = sauvegardes(2)
  const unParAppel = sauvegardes(LOT_D_ANALYSE)
  assert.ok(parDeux.programmes > unParAppel.programmes, JSON.stringify({ parDeux, unParAppel }))
  assert.equal(parDeux.sauvegardes, unParAppel.sauvegardes)
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

test('couture analyser : la clôture d\'imports de la dérivation analyse par l\'analyseur injecté (#2586)', (t) => {
  const textes = new Map([['scripts/a.test.mjs', "import './feuille.mjs'"], ['scripts/feuille.mjs', 'export const f = 1'], ['src/a.txt', 'a']])
  const racine = dossierDe(t)
  const vus = []
  deriverPerimetre({ racine, touches: ['src/a.txt'], post: [...textes.keys()], avant: [], lire: (fs) => new Map(fs.map((f) => [f, textes.get(f) ?? null])),
    analyser: (entrees) => { const lus = [...entrees]; vus.push(...lus.map((e) => relative(racine, e.rel).split(sep).join('/'))); return analyserEnLots(lus) } })
  assert.deepEqual(vus.sort(), ['scripts/a.test.mjs', 'scripts/feuille.mjs'])
})

test('couture stade : la dérivation fermée observe chaque certification et le budget de chaque lot évalué (#2586)', (t) => {
  const textes = new Map([
    ['scripts/lecteur.mjs', "import {readFileSync} from 'node:fs'; import {chemin} from './chemin.mjs'; readFileSync(chemin)"],
    ['scripts/chemin.mjs', "export const chemin = 'src/a.txt'"],
    ['scripts/a.test.mjs', "import './lecteur.mjs'"],
    ['src/a.txt', 'a'],
  ])
  const stades = []
  const { retenus } = deriverPerimetre({ racine: dossierDe(t), touches: ['src/a.txt'], post: [...textes.keys()], avant: [],
    lire: (fs) => new Map(fs.map((f) => [f, textes.get(f) ?? null])), stade: (nom, module) => stades.push([nom, module]) })
  assert.equal(retenus.get('scripts/a.test.mjs')?.nature, 'racine balayée')
  assert.deepEqual(stades.filter(([nom]) => nom === 'décodage').map(([, m]) => m).sort(), ['scripts/chemin.mjs', 'scripts/lecteur.mjs'], 'certifierLecture : un décodage par module certifié')
  assert.deepEqual(stades.filter(([nom]) => ['relaisExportes', 'sitesDe', 'noyau'].includes(nom)),
    [['relaisExportes', 'scripts/lecteur.mjs'], ['noyau', null], ['sitesDe', 'scripts/lecteur.mjs'], ['noyau', null]], 'evaluerLot : un noyau par lot évalué')
})

test('couture stade : produireDTO transmet son stade à la version des producteurs, chacun analysé puis normalisé (#2586)', (t) => {
  const { racine } = instanceDeDepot({ fichiers: { 'scripts/a.test.mjs': 'export const a = 1\n' } })
  t.after(() => rmSync(racine, { recursive: true, force: true }))
  const stades = []
  produireDTO({ racine, dossierDesMemos: join(dossierDe(t), 'memos'), mode: 'balayages' }, (nom, module) => stades.push([nom, module]))
  const [version, graphe] = ['version', 'graphe'].map((nom) => stades.findIndex(([n]) => n === nom))
  const modulesAu = (nom) => stades.slice(version, graphe).filter(([n]) => n === nom).map(([, m]) => m).sort()
  assert.ok(modulesAu('analyse').includes('scripts/test/perimetreDerivation.mjs'), JSON.stringify(stades.slice(0, graphe + 1)))
  assert.deepEqual(modulesAu('normalisation'), modulesAu('analyse'), 'chaque producteur analysé est normalisé, entre la version et le graphe')
})

test('marqueur de stade : publié pendant que le thread principal bloque, le dernier publié à la fermeture (#2586)', (t) => {
  const chemin = join(dossierDe(t), 'stade.json')
  const marqueur = marqueurDeStade(chemin, { pas: 10 })
  const publie = () => { const texte = lireTextePublie(chemin); return texte === undefined ? null : JSON.parse(texte) }
  try {
    marqueur.stade('prélire', 'scripts/a.mjs')
    marqueur.stade('lecture', 'scripts/bloque.mjs')
    const echeance = performance.now() + 20_000
    while (performance.now() < echeance && publie()?.module !== 'scripts/bloque.mjs');
    assert.deepEqual(publie(), { stade: 'lecture', module: 'scripts/bloque.mjs' }, 'publié sans rendre la main')
    marqueur.stade('sauvegarde', null)
  } finally { marqueur.fermer() }
  assert.deepEqual(publie(), { stade: 'sauvegarde', module: null })
})

test('marqueur de stade : fermer publie le dernier stade posé, même avant tout pas écoulé (#2586)', (t) => {
  const chemin = join(dossierDe(t), 'stade.json')
  const marqueur = marqueurDeStade(chemin, { pas: 600_000 })
  marqueur.stade('sauvegarde', null)
  marqueur.fermer()
  assert.equal(lireTextePublie(chemin), '{"stade":"sauvegarde","module":null}\n')
})

test('marqueur de stade : un renommage refusé par un lecteur qui tient la cible se rejoue au pas du guetteur, qui survit (#2586)', (t) => {
  const chemin = join(dossierDe(t), 'stade.json')
  const marqueur = marqueurDeStade(chemin, { pas: 10, delaiDArretMs: 1000 })
  const publie = () => { const texte = lireTextePublie(chemin); return texte === undefined ? null : JSON.parse(texte) }
  try {
    marqueur.stade('prélire', 'scripts/a.mjs')
    const echeance = performance.now() + 20_000
    while (performance.now() < echeance && publie()?.module !== 'scripts/a.mjs');
    const lecteur = openSync(chemin, 'r')
    try {
      marqueur.stade('lecture', 'scripts/tenu.mjs')
      attendreSync(300)
    } finally { closeSync(lecteur) }
    marqueur.stade('sauvegarde', null)
  } finally { marqueur.fermer() }
  assert.deepEqual(publie(), { stade: 'sauvegarde', module: null })
})

test('marqueur de stade : un guetteur mort lève sa panne à la fermeture, sans attendre le délai (#2586)', (t) => {
  const bloquant = join(dossierDe(t), 'bloquant')
  writeFileSync(bloquant, '')
  const marqueur = marqueurDeStade(join(bloquant, 'stade.json'), { pas: 10, delaiDArretMs: 5000 })
  marqueur.stade('images', null)
  assert.throws(() => marqueur.fermer(), /^Error: perimetre : guetteur du marqueur de stade .*stade\.json mort : Error: E[A-Z]+/)
})
