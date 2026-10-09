import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import fs from 'node:fs'
import { syncBuiltinESMExports } from 'node:module'
import path from 'node:path'
import { instanceDeDepot } from '../../guards/lib/depotGabarit.mjs'
import { gitDe, lancerGit } from '../../test/gitDeBanc.mjs'
import { depotDe, relireRequeteMesuree } from '../../guards/lib/gitPorte.mjs'
import { ciblesPures, ciblesSurDisque, estCiblePure, executer, generateurDe, SOURCES_LUES } from '../build-all.mjs'
import { CACHE_FRAICHEUR } from './cache-fraicheur.mjs'
import { avantGenerateur, certifierGenerateur, chargerPreuve, copierDocsFrais, enregistrerPreuve, preparerPreuves, preuveValide } from './fraicheur-docs.mjs'

const doc = (nom) => ['docs', `${nom}.md`].join('/')
const code = ['src', 'banc.generated.ts'].join('/')
const options = {
  generateurs: [
    { runner: 'node', script: 'g/a.mjs', targets: [doc('a')] },
    { runner: 'node', script: 'g/b.mjs', targets: [doc('b')] },
    { runner: 'node', script: 'g/code.mjs', targets: [code] },
  ],
  verificateurs: [],
  ciblesPures, ciblesSurDisque, estCiblePure, generateurDe, sourcesLues: SOURCES_LUES,
}
const poser = (racine, rel, bytes) => {
  mkdirSync(path.dirname(path.join(racine, rel)), { recursive: true })
  writeFileSync(path.join(racine, rel), bytes)
}

for (const [fichier, champ] of [['package.json', 'outils'], ['.gitignore', 'perimetre']]) test(`contexte initial autoritaire : mutation de ${fichier} avant rang suivant`, () => {
  const { racine } = instanceDeDepot({ fichiers: { '.gitignore': 'docs/\n', 'package.json': '{"name":"banc"}', 'data/source.txt': 'source', 'g/a.mjs': 'export const a = 1\n' } })
  const g = { runner: 'node', script: 'g/a.mjs', targets: [doc('a')] }
  const opts = { ...options, generateurs: [g] }
  try {
    const preparation = preparerPreuves(racine, opts)
    poser(racine, fichier, fichier === 'package.json' ? '{"name":"muté"}' : 'docs/\n*.tmp\n')
    assert.throws(() => avantGenerateur(racine, g, opts, preparation), new RegExp(`contexte modifié depuis préparation : ${champ}`))
    assert.equal(chargerPreuve(racine), null)
  } finally { rmSync(racine, { recursive: true, force: true }) }
})

for (const present of [true, false]) test(`baseline conservée entre passes : source connue ${present ? 'présente' : 'absente'} mutée avant rejeu`, () => {
  const { racine } = instanceDeDepot({ fichiers: { '.gitignore': 'docs/\n', 'data/source.txt': 'source', 'g/a.mjs': 'export const a = 1\n' } })
  const g = { runner: 'node', script: 'g/a.mjs', targets: [doc('a')] }
  const opts = { ...options, generateurs: [g] }
  const entree = { fichiers: [g.script, 'data/source.txt', 'data/connue.txt'], dossiers: ['data'], cibles: [], git: [], sondes: [], incomplet: [] }
  try {
    if (present) poser(racine, 'data/connue.txt', 'capture initiale')
    poser(racine, SOURCES_LUES, JSON.stringify({ [g.script]: entree }))
    const preparation = preparerPreuves(racine, opts)
    const capture = preparation.fichiers.get('data/connue.txt')
    assert.equal(capture === null, !present)
    poser(racine, 'data/connue.txt', 'mutation avant le rang suivant')
    const avant = avantGenerateur(racine, g, opts, preparation)
    poser(racine, doc('a'), 'sortie')
    const vu = certifierGenerateur(racine, g, entree, opts, avant)
    assert.equal(vu.ok, false)
    assert.match(vu.raison, /source modifiée ou non capturée : data\/connue\.txt/)
    assert.equal(preparation.fichiers.get('data/connue.txt'), capture)
  } finally { rmSync(racine, { recursive: true, force: true }) }
})

test('inventaire Git : lien inutilisé capturé par son parent ; lien effectivement lu reste refusé', () => {
  const { racine } = instanceDeDepot({ fichiers: { '.gitignore': 'docs/\n', 'data/source.txt': 'source', 'g/a.mjs': 'export const a = 1\n' } })
  const g = { runner: 'node', script: 'g/a.mjs', targets: [doc('a')] }
  const opts = { ...options, generateurs: [g] }
  const entree = { fichiers: [g.script, 'data/source.txt'], dossiers: ['data'], cibles: [], git: [], sondes: [], incomplet: [] }
  const externe = fs.mkdtempSync(path.join(racine, '..', 'fraicheur-lien-externe-'))
  try {
    poser(externe, 'source.txt', 'externe')
    symlinkSync(externe, path.join(racine, 'data/lien'), process.platform === 'win32' ? 'junction' : 'dir')
    const preparation = preparerPreuves(racine, opts)
    for (const captures of [preparation.fichiers, preparation.dossiers]) {
      assert.equal([...captures.keys()].some((rel) => rel === 'data/lien' || rel.startsWith('data/lien/')), false)
    }
    assert.deepEqual(preparation.dossiers.get('data').entrees.find((e) => e.nom === 'lien'), { nom: 'lien', nature: 'link' })
    const avant = avantGenerateur(racine, g, opts, preparation)
    poser(racine, doc('a'), 'sortie')
    assert.equal(certifierGenerateur(racine, g, entree, opts, avant).ok, true)
    const refuse = certifierGenerateur(racine, g, { ...entree, fichiers: [...entree.fichiers, 'data/lien/source.txt'] }, opts, avant)
    assert.equal(refuse.ok, false)
    assert.match(refuse.raison, /hors racine/)
  } finally {
    rmSync(racine, { recursive: true, force: true })
    rmSync(externe, { recursive: true, force: true })
  }
})

test('source mesurée : lien POSIX pendant ne devient jamais une absence connue', { skip: process.platform === 'win32' }, () => {
  const { racine } = instanceDeDepot({ fichiers: { '.gitignore': 'docs/\n', 'data/source.txt': 'source', 'g/a.mjs': 'export const a = 1\n' } })
  const g = { runner: 'node', script: 'g/a.mjs', targets: [doc('a')] }
  const opts = { ...options, generateurs: [g] }
  try {
    symlinkSync('absente.txt', path.join(racine, 'data/pendant'), 'file')
    const entree = { fichiers: [g.script, 'data/pendant'], dossiers: ['data'], cibles: [], git: [], sondes: [], incomplet: [] }
    poser(racine, SOURCES_LUES, JSON.stringify({ [g.script]: entree }))
    assert.throws(() => preparerPreuves(racine, opts), /fichier attendu : data\/pendant/)
  } finally { rmSync(racine, { recursive: true, force: true }) }
})

test('préparation : une capture physique commune, null conservé, clés absentes lues et DTO privés', (t) => {
  const { racine } = instanceDeDepot({ fichiers: { '.gitignore': 'data/lien\n', 'data/source.txt': 'source', 'data/non-capture.txt': 'autre', 'data/sousdir/enfant.txt': 'enfant', 'g/froid.mjs': 'export const froid = 1\n' } })
  const g = { runner: 'node', script: 'g/froid.mjs', targets: [doc('froid')] }
  const opts = { ...options, generateurs: [g] }
  const entree = { fichiers: [g.script, 'data/source.txt', 'data/absent.txt'], dossiers: ['data'], cibles: [], git: [], sondes: [], incomplet: [] }
  const compter = (espion, rel, types = false) => espion.mock.calls.filter(({ arguments: args }) => args[0] === path.join(racine, rel) && (!types || args[1]?.withFileTypes === true)).length
  try {
    poser(racine, SOURCES_LUES, JSON.stringify({ [g.script]: entree }))
    symlinkSync(path.join(racine, 'data/sousdir'), path.join(racine, 'data/lien'), process.platform === 'win32' ? 'junction' : 'dir')
    const lectures = t.mock.method(fs, 'readFileSync')
    const listages = t.mock.method(fs, 'readdirSync')
    const presences = t.mock.method(fs, 'existsSync')
    syncBuiltinESMExports()
    const preparation = preparerPreuves(racine, opts)
    assert.equal(compter(lectures, 'data/source.txt'), 1)
    assert.equal(compter(listages, 'data', true), 1)
    assert.equal(compter(presences, 'data/absent.txt'), 1)
    assert.equal(preparation.vue.hashes.get('data/absent.txt'), null)
    assert.equal(preparation.fichiers.get('data/absent.txt'), null)
    assert.equal(preparation.vue.hashes.has('data/non-capture.txt'), false)
    assert.equal(compter(lectures, 'data/non-capture.txt'), 1)
    assert.equal(typeof preparation.fichiers.get('data/non-capture.txt'), 'string')
    assert.equal(preparation.vue.listings.has('data/sousdir'), false)
    assert.equal(compter(listages, 'data/sousdir', true), 1)
    const courant = preparation.vue.listings.get('data')
    const prive = preparation.dossiers.get('data')
    assert.deepEqual(Object.fromEntries(prive.entrees.map(({ nom, nature }) => [nom, nature])), { lien: 'link', 'non-capture.txt': 'file', 'source.txt': 'file', sousdir: 'directory' })
    assert.notStrictEqual(prive, courant)
    assert.notStrictEqual(prive.entrees, courant.entrees)
    for (let i = 0; i < prive.entrees.length; i++) assert.notStrictEqual(prive.entrees[i], courant.entrees[i])
    const capturePrivee = JSON.stringify(prive)
    courant.entrees[0].nature = 'mutation'
    courant.entrees.push({ nom: 'faux', nature: 'file' })
    assert.equal(JSON.stringify(prive), capturePrivee)
    const ancienHash = preparation.fichiers.get('data/source.txt')
    poser(racine, 'data/source.txt', 'source suivante')
    poser(racine, 'data/absent.txt', 'désormais présente')
    const suivante = preparerPreuves(racine, opts)
    assert.equal(compter(lectures, 'data/source.txt'), 2)
    assert.equal(compter(listages, 'data', true), 2)
    assert.notEqual(suivante.fichiers.get('data/source.txt'), ancienHash)
    assert.equal(typeof suivante.fichiers.get('data/absent.txt'), 'string')
  } finally {
    t.mock.restoreAll()
    syncBuiltinESMExports()
    rmSync(racine, { recursive: true, force: true })
  }
})

test('baseline privée : modifier la préparation ne blanchit pas une source nouvelle', () => {
  const { racine } = instanceDeDepot({ fichiers: { '.gitignore': '*.generated.ts\n', 'data/source.txt': 'source', 'g/froid.mjs': 'export const froid = 1\n' } })
  const g = { runner: 'node', script: 'g/froid.mjs', targets: ['data/*.generated.ts'] }
  const opts = { ...options, generateurs: [g] }
  const entree = { fichiers: [g.script, 'data/source.txt'], dossiers: ['data'], cibles: [], git: [], sondes: [], incomplet: [] }
  try {
    const preparation = preparerPreuves(racine, opts)
    const avant = avantGenerateur(racine, g, opts, preparation)
    preparation.dossiers.get('data').entrees.push({ nom: 'nouvelle.txt', nature: 'file' })
    preparation.dossiers.get('data').entrees.sort((a, b) => a.nom < b.nom ? -1 : a.nom > b.nom ? 1 : 0)
    poser(racine, 'data/nouvelle.txt', 'source clandestine')
    poser(racine, 'data/propre.generated.ts', 'sortie propre')
    assert.equal(certifierGenerateur(racine, g, entree, opts, avant).ok, false)
  } finally { rmSync(racine, { recursive: true, force: true }) }
})

for (const producteur of ['propre', 'autre']) for (const nature of ['directory', 'link']) test(`admission réelle : glob ignoré ${producteur} FILE→${nature}`, () => {
  const { racine } = instanceDeDepot({ fichiers: { '.gitignore': '*.generated.ts\n', 'data/source.txt': 'source', 'g/froid.mjs': 'export const froid = 1\n', 'g/autre.mjs': 'export const autre = 1\n' } })
  const cible = 'data/propre.generated.ts'
  const endpoint = `data/${producteur}.generated.ts`
  const g = { runner: 'node', script: 'g/froid.mjs', targets: ['data/propre*.generated.ts'] }
  const opts = { ...options, generateurs: [g, { runner: 'node', script: 'g/autre.mjs', targets: ['data/autre*.generated.ts'] }] }
  const entree = { fichiers: [g.script, 'data/source.txt'], dossiers: ['data'], cibles: [], git: [], sondes: [], incomplet: [] }
  try {
    poser(racine, endpoint, 'ancien endpoint')
    const preparation = preparerPreuves(racine, opts)
    const avant = avantGenerateur(racine, g, opts, preparation)
    const snapshot = JSON.stringify(avant.baseline.dossiers.get('data'))
    preparation.dossiers.get('data').entrees[0].nom = 'mutation privée'
    assert.equal(JSON.stringify(avant.baseline.dossiers.get('data')), snapshot)
    rmSync(path.join(racine, endpoint))
    if (nature === 'directory') mkdirSync(path.join(racine, endpoint))
    else symlinkSync(path.join(racine, 'data'), path.join(racine, endpoint), process.platform === 'win32' ? 'junction' : 'dir')
    if (producteur === 'autre') poser(racine, cible, 'sortie propre')
    assert.equal(certifierGenerateur(racine, g, entree, opts, avant).ok, false)
  } finally { rmSync(racine, { recursive: true, force: true }) }
})

for (const glob of [false, true]) test(`certification froide : fichier propre ${glob ? 'sous glob' : 'littéral'} dans le dossier source listé`, () => {
  const { racine } = instanceDeDepot({ fichiers: { '.gitignore': '*.generated.ts\n', 'data/source.txt': 'source', 'g/froid.mjs': 'export const froid = 1\n' } })
  const cible = 'data/froid.generated.ts'
  const g = { runner: 'node', script: 'g/froid.mjs', targets: [glob ? 'data/*.generated.ts' : cible] }
  const opts = { ...options, generateurs: [g] }
  const entree = { fichiers: [g.script, 'data/source.txt'], dossiers: ['data'], cibles: [], git: [], sondes: [], incomplet: [] }
  try {
    assert.equal(existsSync(path.join(racine, cible)), false)
    const preparation = preparerPreuves(racine, opts)
    const avant = avantGenerateur(racine, g, opts, preparation)
    poser(racine, cible, 'export const produit = 1\n')
    const vu = certifierGenerateur(racine, g, entree, opts, avant)
    assert.equal(vu.ok, true, vu.raison)
    enregistrerPreuve(racine, opts, preparation, new Map([[g.script, vu.record]]))
    assert.equal(preuveValide(racine, opts).ok, true)
    const ancien = JSON.parse(JSON.stringify(chargerPreuve(racine)))
    ancien.generateurs[g.script].sources.dossiers = ancien.generateurs[g.script].sources.dossiers.map(([rel, snapshot]) => [rel, snapshot.entrees.map(e => e.nom)])
    assert.equal(preuveValide(racine, opts, ancien).ok, false)
    poser(racine, 'data/soeur.txt', 'nouvelle source')
    assert.equal(preuveValide(racine, opts).ok, false)
  } finally { rmSync(racine, { recursive: true, force: true }) }
})

for (const cas of ['propre', 'source', 'ignore', 'vide', 'lien', 'observe', 'sonde', 'contenu', 'lecture']) test(`structure froide : ${cas}`, () => {
  const { racine } = instanceDeDepot({ fichiers: { '.gitignore': '*.generated.ts\nsecret.tmp\n', 'data/source.txt': 'source', 'data/temoin.txt': 'temoin', 'g/froid.mjs': 'export const froid = 1\n', 'g/lecteur.mjs': 'export const lecteur = 1\n' } })
  const cible = 'data/neuf/sortie.generated.ts'
  const g = { runner: 'node', script: 'g/froid.mjs', targets: ['data/neuf/*.generated.ts'] }
  const lecteur = { runner: 'node', script: 'g/lecteur.mjs', targets: ['data/neuf/lecteur.generated.ts'] }
  const opts = { ...options, generateurs: [g, lecteur] }
  const entree = { fichiers: [g.script, 'data/temoin.txt'], dossiers: cas === 'observe' ? ['data/neuf'] : [], cibles: [], git: [], sondes: cas === 'sonde' ? [{ chemin: 'data/neuf', type: 'exists', existe: false, nature: null }] : [], incomplet: [] }
  try {
    const preparation = preparerPreuves(racine, opts)
    const avant = avantGenerateur(racine, g, opts, preparation)
    const socle = JSON.stringify({ fichiers: [...preparation.fichiers], dossiers: [...preparation.dossiers] })
    poser(racine, cible, 'export const produit = 1\n')
    if (cas === 'source') poser(racine, 'data/neuf/etranger.txt', 'source clandestine')
    if (cas === 'ignore') poser(racine, 'data/neuf/secret.tmp', 'ignoré clandestin')
    if (cas === 'vide') mkdirSync(path.join(racine, 'data/neuf/vide'))
    if (cas === 'lien') symlinkSync(path.join(racine, 'data'), path.join(racine, 'data/neuf/lien'), process.platform === 'win32' ? 'junction' : 'dir')
    if (cas === 'contenu') poser(racine, 'data/source.txt', 'source modifiée sans lecture')
    if (cas === 'lecture') { rmSync(path.join(racine, 'data/source.txt')); mkdirSync(path.join(racine, 'data/source.txt')) }
    const vu = certifierGenerateur(racine, g, entree, opts, avant)
    assert.equal(vu.ok, cas === 'propre', vu.raison)
    if (cas !== 'propre') assert.equal(JSON.stringify({ fichiers: [...preparation.fichiers], dossiers: [...preparation.dossiers] }), socle)
    else {
      const prochain = avantGenerateur(racine, lecteur, opts, preparation)
      poser(racine, lecteur.targets[0], 'export const lecteur = 2\n')
      const suivant = certifierGenerateur(racine, lecteur, { ...entree, fichiers: [lecteur.script, cible], dossiers: ['data/neuf'] }, opts, prochain)
      assert.equal(suivant.ok, true, suivant.raison)
    }
  } finally { rmSync(racine, { recursive: true, force: true }) }
})

for (const cas of ['creation', 'suppression', 'contenu', 'propre-dossier', 'source-dossier', 'dossier-absent', 'regles']) test(`contre-témoin froid : ${cas}`, () => {
  const { racine } = instanceDeDepot({ fichiers: { '.gitignore': '*.generated.ts\n', 'data/source.txt': 'source', 'g/froid.mjs': 'export const froid = 1\n', 'g/autre.mjs': 'export const autre = 1\n' } })
  const cible = 'data/froid.generated.ts'
  const autre = 'data/autre.generated.ts'
  const g = { runner: 'node', script: 'g/froid.mjs', targets: [cible] }
  const opts = { ...options, generateurs: [g, { runner: 'node', script: 'g/autre.mjs', targets: ['data/autre*.generated.ts'] }] }
  const entree = { fichiers: [g.script, 'data/source.txt'], dossiers: ['data'], cibles: [], git: [], sondes: [], incomplet: [] }
  try {
    if (cas !== 'creation') poser(racine, autre, 'autre producteur')
    const preparation = preparerPreuves(racine, opts)
    const avant = avantGenerateur(racine, g, opts, preparation)
    poser(racine, cible, 'export const propre = 1\n')
    if (cas === 'creation') poser(racine, autre, 'autre producteur')
    if (cas === 'suppression') rmSync(path.join(racine, autre))
    if (cas === 'contenu') poser(racine, autre, 'autre producteur modifié')
    if (cas === 'propre-dossier') { rmSync(path.join(racine, cible)); mkdirSync(path.join(racine, cible)) }
    if (cas === 'source-dossier') { rmSync(path.join(racine, 'data/source.txt')); mkdirSync(path.join(racine, 'data/source.txt')) }
    if (cas === 'dossier-absent') rmSync(path.join(racine, 'data'), { recursive: true })
    if (cas === 'regles') poser(racine, '.gitignore', '*.generated.ts\nsource.txt\n')
    assert.equal(certifierGenerateur(racine, g, entree, opts, avant).ok, false, cas)
  } finally { rmSync(racine, { recursive: true, force: true }) }
})

function certifier(racine, mesure, opts = options) {
  const preparation = preparerPreuves(racine, opts)
  const records = new Map()
  for (const g of opts.generateurs) {
    const vu = certifierGenerateur(racine, g, mesure[g.script], opts, avantGenerateur(racine, g, opts, preparation))
    assert.equal(vu.ok, true, vu.raison)
    records.set(g.script, vu.record)
  }
  enregistrerPreuve(racine, opts, preparation, records)
}

function banc() {
  const { racine } = instanceDeDepot({ fichiers: {
    '.gitignore': 'node_modules/\ndocs/\n*.generated.ts\n.wt-banc/\n',
    'data/a/source.txt': 'a',
    'data/b/source.txt': 'b',
    'data/code/source.txt': 'code',
    'g/a.mjs': 'export const a = 1\n',
    'g/b.mjs': 'export const b = 1\n',
    'g/code.mjs': 'export const code = 1\n',
  } })
  const mesure = Object.fromEntries(options.generateurs.map((g) => {
    const nom = path.posix.basename(g.script, '.mjs')
    return [g.script, { fichiers: [g.script, `data/${nom}/source.txt`], dossiers: [`data/${nom}`], cibles: g.targets.filter((r) => r.endsWith('.md')), git: [], sondes: [], incomplet: [] }]
  }))
  poser(racine, SOURCES_LUES, JSON.stringify(mesure))
  poser(racine, doc('a'), '# A\n')
  poser(racine, doc('b'), '# B\n')
  poser(racine, code, 'export const genere = 1\n')
  certifier(racine, mesure)
  const cible = path.join(racine, '.wt-banc')
  lancerGit(['worktree', 'add', '-q', '-b', 'chantier/banc', cible, 'HEAD'], { cwd: racine })
  poser(cible, code, readFileSync(path.join(racine, code)))
  return { racine, cible, mesure, jeter: () => rmSync(racine, { recursive: true, force: true }) }
}

const copier = (b, extra = {}) => copierDocsFrais({ principal: b.racine, cible: b.cible, ...options, ...extra })

const docFroid = (nom) => ['docs', 'raw', `${nom}.md`].join('/')

function bancFroid() {
  const b = banc()
  for (const nom of ['a', 'b']) rmSync(path.join(b.racine, ['docs', nom + '.md'].join('/')))
  poser(b.racine, docFroid('a'), '# A\n')
  poser(b.racine, docFroid('b'), '# B\n')
  const injecteur = { runner: 'node', script: 'g/injecte.mjs', targets: [], injecte: ['docs/raw/**/*.md', 'notes/raw.md'] }
  const lecteur = { runner: 'node', script: 'g/lecteur.mjs', targets: [docFroid('lecteur')] }
  for (const racine of [b.racine, b.cible]) {
    poser(racine, injecteur.script, 'export const injecte = 1\n')
    poser(racine, lecteur.script, 'export const lecteur = 1\n')
    poser(racine, 'notes/raw.md', '# RAW\n')
  }
  poser(b.racine, docFroid('lecteur'), '# lecteur\n')
  const opts = { ...options, generateurs: [...options.generateurs.map((g) => ['g/a.mjs', 'g/b.mjs'].includes(g.script) ? { ...g, targets: [docFroid(path.posix.basename(g.script, '.mjs'))] } : g), injecteur, lecteur] }
  for (const nom of ['a', 'b']) b.mesure['g/' + nom + '.mjs'].cibles = [docFroid(nom)]
  b.mesure[injecteur.script] = { fichiers: [injecteur.script, 'notes/raw.md'], dossiers: ['docs/raw'], cibles: [], git: [], sondes: [], incomplet: [] }
  b.mesure[lecteur.script] = {
    fichiers: [lecteur.script, docFroid('a'), 'notes/raw.md'], dossiers: [], cibles: [docFroid('lecteur')], git: [],
    sondes: [{ chemin: docFroid('b'), type: 'exists', existe: true, nature: null }, { chemin: docFroid('b'), type: 'stat', existe: true, nature: 'file' }], incomplet: [],
  }
  poser(b.racine, SOURCES_LUES, JSON.stringify(b.mesure))
  certifier(b.racine, b.mesure, opts)
  return { ...b, opts }
}

test('cible froide : glob injecte recoupant les docs purs, listing, fichiers et sondes restent identiques', () => {
  const b = bancFroid()
  try {
    const vu = copier(b, b.opts)
    assert.equal(vu.ok, true, vu.raison)
    assert.deepEqual(vu.scriptsARegenerer, [])
    assert.equal(vu.copies, 3)
    assert.equal(preuveValide(b.cible, b.opts).ok, true)
    assert.equal(readFileSync(path.join(b.cible, 'notes/raw.md'), 'utf8'), '# RAW\n')
  } finally { b.jeter() }
})

test('cible froide : source RAW différente conserve les producteurs frais et copie leurs docs', () => {
  const b = bancFroid()
  try {
    poser(b.racine, 'notes/raw.md', '# RAW changé\n')
    const vu = copier(b, b.opts)
    assert.equal(vu.ok, true, vu.raison)
    assert.ok(vu.scriptsARegenerer.includes('g/injecte.mjs'))
    assert.ok(vu.scriptsARegenerer.includes('g/lecteur.mjs'))
    assert.deepEqual(vu.scriptsARegenerer, ['g/injecte.mjs', 'g/lecteur.mjs'])
    assert.equal(vu.copies, 2)
    assert.equal(existsSync(path.join(b.cible, docFroid('a'))), true)
    assert.equal(existsSync(path.join(b.cible, docFroid('b'))), true)
    assert.equal(existsSync(path.join(b.cible, docFroid('lecteur'))), false)
    assert.equal(readFileSync(path.join(b.cible, 'notes/raw.md'), 'utf8'), '# RAW\n')
  } finally { b.jeter() }
})

test('cible froide : doc existant d’un producteur sélectionné reste sur disque', () => {
  const b = bancFroid()
  try {
    poser(b.cible, docFroid('a'), 'WIP cible')
    const vu = copier(b, b.opts)
    assert.equal(vu.ok, true, vu.raison)
    assert.ok(vu.scriptsARegenerer.includes('g/a.mjs'))
    assert.equal(readFileSync(path.join(b.cible, docFroid('a')), 'utf8'), 'WIP cible')
  } finally { b.jeter() }
})

test('cible froide : doc principal altéré jamais préparé dans la cible', () => {
  const b = bancFroid()
  try {
    poser(b.racine, docFroid('a'), 'doc altéré')
    let absentPendantPreparation
    const vu = copier(b, { ...b.opts, apresPreparation: () => { absentPendantPreparation = !existsSync(path.join(b.cible, docFroid('a'))) } })
    assert.equal(vu.ok, true, vu.raison)
    assert.equal(absentPendantPreparation, true)
    assert.ok(vu.scriptsARegenerer.includes('g/a.mjs'))
    assert.equal(existsSync(path.join(b.cible, docFroid('a'))), false)
  } finally { b.jeter() }
})

test('cible froide : CODE absent jamais préparé dans la cible', () => {
  const b = bancFroid()
  try {
    rmSync(path.join(b.cible, code))
    let absentPendantPreparation
    const vu = copier(b, { ...b.opts, apresPreparation: () => { absentPendantPreparation = !existsSync(path.join(b.cible, code)) } })
    assert.equal(vu.ok, true, vu.raison)
    assert.equal(absentPendantPreparation, true)
    assert.ok(vu.scriptsARegenerer.includes('g/code.mjs'))
    assert.equal(existsSync(path.join(b.cible, code)), false)
  } finally { b.jeter() }
})

test('cible froide : provisoire modifié avant retrait conservé, repli sans certificat', () => {
  const b = bancFroid()
  try {
    const vu = copier(b, { ...b.opts, apresPreparation: () => {
      poser(b.cible, docFroid('a'), 'écriture concurrente')
      poser(b.racine, 'data/a/source.txt', 'source concurrente')
    } })
    assert.equal(vu.complete, true)
    assert.match(vu.raison, /provisoire modifié avant retrait/)
    assert.equal(readFileSync(path.join(b.cible, docFroid('a')), 'utf8'), 'écriture concurrente')
    assert.equal(chargerPreuve(b.cible), null)
  } finally { b.jeter() }
})

for (const [nom, changer] of [
  ['source', (b) => poser(b.racine, 'data/a/source.txt', 'course')],
  ['cache', (b) => poser(b.racine, CACHE_FRAICHEUR, '{}')],
]) {
  test(`cible froide : ${nom} change après préparation, repli sans certificat`, () => {
    const b = bancFroid()
    try {
      const vu = copier(b, { ...b.opts, apresPreparation: () => changer(b) })
      assert.equal(vu.complete, true)
      assert.match(vu.raison, /modifiée? pendant copie/)
      assert.equal(chargerPreuve(b.cible), null)
    } finally { b.jeter() }
  })
}

test('vues de copie : expansion partagée une fois par racine et passe, contexte propre à chaque générateur', () => {
  const b = banc()
  try {
    const appels = new Map()
    const motifsCommuns = JSON.stringify(options.generateurs.flatMap((g) => g.targets))
    const vu = copier(b, { ciblesSurDisque: (motifs, racine) => {
      const cle = JSON.stringify([racine, JSON.stringify(motifs)])
      appels.set(cle, (appels.get(cle) ?? 0) + 1)
      return ciblesSurDisque(motifs, racine)
    } })
    assert.equal(vu.ok, true, vu.raison)
    assert.deepEqual(vu.scriptsARegenerer, [])
    for (const racine of [b.racine, b.cible]) assert.equal(appels.get(JSON.stringify([racine, motifsCommuns])), 2)
    const cache = chargerPreuve(b.cible)
    for (const g of options.generateurs) assert.deepEqual(cache.generateurs[g.script].sources.contexte.generateur, g)
    assert.equal(preuveValide(b.cible, options).ok, true)
  } finally { b.jeter() }
})

for (const cote of ['principal', 'cible']) {
  for (const nature of ['fichier', 'listing', 'sonde', 'git']) {
    test(`vue finale neuve : ${nature} ${cote} modifié après copie, repli sans certificat`, () => {
      const b = banc()
      try {
        if (nature === 'sonde') {
          for (const racine of [b.racine, b.cible]) poser(racine, 'references/a.md', 'référence')
          b.mesure['g/a.mjs'].sondes = [{ chemin: 'references/a.md', type: 'exists', existe: true, nature: null }]
        }
        if (nature === 'git') {
          for (const [nom, motif] of [['a', 'user-a*.md'], ['b', 'user-b*.md']]) {
            const requete = { args: ['ls-files', '--cached', '--', '.claude/memory/' + motif], cwd: '', canal: 'stdout', status: 0, stdout: '', stderr: '' }
            b.mesure['g/' + nom + '.mjs'].git = [relireRequeteMesuree(depotDe(b.racine), requete)]
          }
        }
        poser(b.racine, SOURCES_LUES, JSON.stringify(b.mesure))
        certifier(b.racine, b.mesure)
        const racine = cote === 'principal' ? b.racine : b.cible
        const vu = copier(b, { apresCopie: () => {
          if (nature === 'fichier') poser(racine, 'data/a/source.txt', 'course finale')
          if (nature === 'listing') poser(racine, 'data/a/nouveau.txt', 'course finale')
          if (nature === 'sonde') rmSync(path.join(racine, 'references/a.md'))
          if (nature === 'git') {
            poser(racine, '.claude/memory/user-b-cours.md', 'doctrine')
            gitDe(racine)('add', '.claude/memory/user-b-cours.md')
          }
        } })
        assert.equal(vu.complete, true, vu.raison)
        assert.match(vu.raison, /modifiées? pendant copie/)
        assert.equal(chargerPreuve(b.cible), null)
      } finally { b.jeter() }
    })
  }
}

test('sources identiques : copie des deux docs et ledger cible complet ; code conservé', () => {
  const b = banc()
  try {
    const codeAvant = readFileSync(path.join(b.cible, code))
    const vu = copier(b)
    assert.equal(vu.ok, true, vu.raison)
    assert.equal(vu.copies, 2)
    assert.deepEqual(vu.scriptsARegenerer, [])
    assert.deepEqual(readFileSync(path.join(b.cible, code)), codeAvant)
    assert.equal(preuveValide(b.cible, options).ok, true)
  } finally { b.jeter() }
})

test('hors sources : out.txt, output, scratchpad, mémoire non lue ne modifient aucun certificat', () => {
  const b = banc()
  try {
    for (const rel of ['out.txt', 'output/log', 'scratchpad/note', '.claude/memory/env-banc.md']) poser(b.racine, rel, 'WIP')
    const vu = copier(b)
    assert.equal(vu.ok, true, vu.raison)
    assert.deepEqual(vu.scriptsARegenerer, [])
    assert.equal(vu.copies, 2)
  } finally { b.jeter() }
})

for (const [nom, changer] of [
  ['source principal', (b) => poser(b.racine, 'data/a/source.txt', 'WIP source')],
  ['source cible', (b) => poser(b.cible, 'data/a/source.txt', 'source cible')],
  ['listing réellement lu', (b) => poser(b.racine, 'data/a/neuf.txt', 'neuf')],
  ['doc altéré', (b) => poser(b.racine, doc('a'), 'altéré')],
]) {
  test(`régénération ciblée : ${nom}, b reste copié`, () => {
    const b = banc()
    try {
      changer(b)
      const vu = copier(b)
      assert.equal(vu.ok, true, vu.raison)
      assert.deepEqual(vu.scriptsARegenerer, ['g/a.mjs'])
      assert.equal(vu.copies, 1)
      assert.equal(existsSync(path.join(b.cible, doc('a'))), false)
      assert.equal(readFileSync(path.join(b.cible, doc('b')), 'utf8'), '# B\n')
    } finally { b.jeter() }
  })
}

for (const [nom, changer] of [
  ['cache absent', (b) => rmSync(path.join(b.racine, CACHE_FRAICHEUR))],
  ['mesure absente', (b) => rmSync(path.join(b.racine, SOURCES_LUES))],
  ['HEAD différent', (b) => { poser(b.cible, 'data/a/source.txt', 'commit'); gitDe(b.cible)('add', 'data/a/source.txt'); gitDe(b.cible)('commit', '-q', '-m', 'autre HEAD') }],
]) {
  test(`repli complet : ${nom}`, () => {
    const b = banc()
    try { changer(b); assert.equal(copier(b).complete, true) }
    finally { b.jeter() }
  })
}

test('certificat local divergent : doc local conservé et autre producteur copié', () => {
  const primitive = new URL('./ecriture-derives.mjs', import.meta.url).href
  const generateurs = ['a', 'b'].map(nom => ({ runner: 'node', script: `g/${nom}.mjs`, targets: [doc(nom)] }))
  const { racine } = instanceDeDepot({ fichiers: {
    '.gitignore': 'docs/\n.wt-local/\n',
    ...Object.fromEntries(['a', 'b'].flatMap(nom => [
      [`data/${nom}.txt`, nom],
      [`g/${nom}.mjs`, `import { readFileSync } from 'node:fs'\nimport { ecrireOuVerifier } from ${JSON.stringify(primitive)}\necrireOuVerifier({ out: readFileSync('data/${nom}.txt', 'utf8'), path: ${JSON.stringify(doc(nom))}, check: process.argv.includes('--check'), staleMsg: 'périmé', rerunMsg: 'relancer' })\n`],
    ])),
  } })
  const cible = path.join(racine, '.wt-local')
  lancerGit(['worktree', 'add', '-q', '-b', 'chantier/local', cible, 'HEAD'], { cwd: racine })
  const opts = { ...options, generateurs }
  try {
    for (const arbre of [racine, cible]) mkdirSync(path.join(arbre, 'docs'))
    assert.equal(executer({ cwd: racine, argv: ['--quiet'], generateurs, verificateurs: [] }), 0)
    poser(cible, 'data/a.txt', 'source locale')
    assert.equal(executer({ cwd: cible, argv: ['--quiet', '--only', 'g/a.mjs'], generateurs, verificateurs: [] }), 0)
    const local = chargerPreuve(cible).generateurs['g/a.mjs']
    const vu = copierDocsFrais({ principal: racine, cible, ...opts })
    assert.equal(vu.ok, true, vu.raison)
    assert.equal(vu.copies, 1)
    assert.deepEqual(vu.scriptsARegenerer, [])
    assert.equal(readFileSync(path.join(cible, doc('a')), 'utf8'), 'source locale')
    assert.equal(readFileSync(path.join(cible, doc('b')), 'utf8'), 'b')
    assert.deepEqual(chargerPreuve(cible).generateurs['g/a.mjs'], local)
    assert.equal(preuveValide(cible, opts).ok, true)
  } finally { rmSync(racine, { recursive: true, force: true }) }
})

test('cache partiel : copie les docs frais et conserve le code certifié localement', () => {
  const b = banc()
  try {
    for (const nom of ['a', 'b']) poser(b.cible, doc(nom), readFileSync(path.join(b.racine, doc(nom))))
    poser(b.cible, SOURCES_LUES, JSON.stringify(b.mesure))
    certifier(b.cible, b.mesure)
    const local = chargerPreuve(b.cible).generateurs['g/code.mjs']
    const cache = chargerPreuve(b.racine)
    delete cache.generateurs['g/a.mjs']
    delete cache.generateurs['g/code.mjs']
    poser(b.racine, CACHE_FRAICHEUR, JSON.stringify(cache))
    rmSync(path.join(b.cible, doc('a')))
    rmSync(path.join(b.cible, doc('b')))
    const vu = copier(b)
    assert.equal(vu.ok, true, vu.raison)
    assert.equal(vu.copies, 1)
    assert.equal(readFileSync(path.join(b.cible, doc('b')), 'utf8'), '# B\n')
    assert.deepEqual(vu.scriptsARegenerer, ['g/a.mjs'])
    assert.deepEqual(chargerPreuve(b.cible).generateurs['g/code.mjs'], local)
  } finally { b.jeter() }
})

test('mixte édité : sélection du producteur, jamais copie du fichier injecté', () => {
  const b = banc()
  try {
    const mixte = ['notes', 'mixte.md'].join('/')
    poser(b.racine, mixte, '# mixte')
    poser(b.cible, mixte, '# cible')
    const opts = { ...options, generateurs: options.generateurs.map((g) => g.script === 'g/a.mjs' ? { ...g, injecte: [mixte] } : g) }
    certifier(b.racine, b.mesure, opts)
    const vu = copier(b, opts)
    assert.equal(vu.ok, true, vu.raison)
    assert.ok(vu.scriptsARegenerer.includes('g/a.mjs'))
    assert.equal(readFileSync(path.join(b.cible, mixte), 'utf8'), '# cible')
  } finally { b.jeter() }
})

test('mixte déclaré par glob : jamais copié, même si ses octets concordent', () => {
  const b = banc()
  try {
    const mixte = ['notes', 'mixte.md'].join('/')
    poser(b.racine, mixte, '# mixte')
    poser(b.cible, mixte, '# mixte')
    const opts = { ...options, generateurs: options.generateurs.map((g) => g.script === 'g/a.mjs' ? { ...g, injecte: ['notes/*.md'] } : g) }
    certifier(b.racine, b.mesure, opts)
    const vu = copier(b, opts)
    assert.equal(vu.ok, true, vu.raison)
    assert.equal(vu.copies, 2)
    assert.deepEqual(vu.scriptsARegenerer, [])
  } finally { b.jeter() }
})

test('code cible altéré : producteur et consommateur dans fermeture canonique', () => {
  const b = banc()
  try {
    b.mesure['g/a.mjs'].fichiers.push(code)
    poser(b.racine, SOURCES_LUES, JSON.stringify(b.mesure))
    certifier(b.racine, b.mesure)
    poser(b.cible, code, 'altéré')
    const vu = copier(b)
    assert.equal(vu.ok, true, vu.raison)
    assert.ok(vu.scriptsARegenerer.includes('g/code.mjs'))
    assert.ok(vu.scriptsARegenerer.includes('g/a.mjs'))
    assert.ok(!vu.scriptsARegenerer.includes('g/b.mjs'))
  } finally { b.jeter() }
})

test('source modifiée pendant génération : certificat refusé', () => {
  const b = banc()
  try {
    const preparation = preparerPreuves(b.racine, options)
    const g = options.generateurs[0]
    const avant = avantGenerateur(b.racine, g, options, preparation)
    poser(b.racine, 'data/a/source.txt', 'course')
    assert.equal(certifierGenerateur(b.racine, g, b.mesure[g.script], options, avant).ok, false)
  } finally { b.jeter() }
})

test('politique modifiée pendant génération : certificat refusé', () => {
  const b = banc()
  try {
    const preparation = preparerPreuves(b.racine, options)
    const g = options.generateurs[0]
    const avant = avantGenerateur(b.racine, g, options, preparation)
    poser(b.racine, '.gitignore', readFileSync(path.join(b.racine, '.gitignore'), 'utf8') + '*.cache\n')
    const vu = certifierGenerateur(b.racine, g, b.mesure[g.script], options, avant)
    assert.equal(vu.ok, false)
    assert.match(vu.raison, /modifié pendant génération/)
  } finally { b.jeter() }
})

test('certificat : nature seule refusée', () => {
  const b = banc()
  try {
    const cache = chargerPreuve(b.racine)
    cache.generateurs['g/a.mjs'].sources.contexte.perimetre = { nature: 'git' }
    poser(b.racine, CACHE_FRAICHEUR, JSON.stringify(cache))
    assert.equal(preuveValide(b.racine, options).ok, false)
  } finally { b.jeter() }
})

test('certificat : nouveau fichier ignoré exclu des observations finales', () => {
  const b = banc()
  try {
    const g = options.generateurs[0]
    const preparation = preparerPreuves(b.racine, options)
    const avant = avantGenerateur(b.racine, g, options, preparation)
    poser(b.racine, 'docs/inedit.txt', 'cache lu après création')
    const entree = { ...b.mesure[g.script], fichiers: [...b.mesure[g.script].fichiers, 'docs/inedit.txt'],
      sondes: [{ chemin: 'docs/inedit.txt', type: 'exists', existe: true, nature: null }] }
    const vu = certifierGenerateur(b.racine, g, entree, options, avant)
    assert.equal(vu.ok, true, vu.raison)
    assert.ok(!vu.record.sources.fichiers.some(([rel]) => rel === 'docs/inedit.txt'))
    assert.deepEqual(vu.record.sources.sondes, [])
  } finally { b.jeter() }
})

for (const [nom, changer] of [
  ['source', (b) => poser(b.racine, 'data/a/source.txt', 'course')],
  ['doc cible', (b) => poser(b.cible, doc('a'), 'course')],
]) {
  test(`course pendant copie : ${nom}, pas de certificat cible`, () => {
    const b = banc()
    try {
      assert.equal(copier(b, { apresCopie: () => changer(b) }).complete, true)
      assert.equal(chargerPreuve(b.cible), null)
    } finally { b.jeter() }
  })
}

test('requête Git lue : ajout user-md stagé sélectionne seulement son consommateur', () => {
  const b = banc()
  try {
    const requete = { args: ['ls-files', '--cached', '--', '.claude/memory/user-*.md'], cwd: '', canal: 'stdout', status: 0, stdout: '', stderr: '' }
    b.mesure['g/a.mjs'].git = [relireRequeteMesuree(depotDe(b.racine), requete)]
    poser(b.racine, SOURCES_LUES, JSON.stringify(b.mesure))
    certifier(b.racine, b.mesure)
    poser(b.racine, '.claude/memory/user-banc.md', 'doctrine')
    gitDe(b.racine)('add', '.claude/memory/user-banc.md')
    const vu = copier(b)
    assert.equal(vu.ok, true, vu.raison)
    assert.deepEqual(vu.scriptsARegenerer, ['g/a.mjs'])
    assert.equal(vu.copies, 1)
  } finally { b.jeter() }
})

test('chemin hostile du cache : repli sans copie hors racine', () => {
  const b = banc()
  try {
    const cache = chargerPreuve(b.racine)
    cache.generateurs['g/a.mjs'].mesure.fichiers.push('../hors.txt')
    poser(b.racine, CACHE_FRAICHEUR, JSON.stringify(cache))
    assert.equal(copier(b).complete, true)
    assert.equal(existsSync(path.join(b.cible, doc('a'))), false)
  } finally { b.jeter() }
})

test('source modifiée après génération avant preuve finale : certificat retiré', () => {
  const b = banc()
  try {
    const preparation = preparerPreuves(b.racine, options)
    const g = options.generateurs[0]
    const vu = certifierGenerateur(b.racine, g, b.mesure[g.script], options, avantGenerateur(b.racine, g, options, preparation))
    assert.equal(vu.ok, true, vu.raison)
    poser(b.racine, 'data/a/source.txt', 'course tardive')
    enregistrerPreuve(b.racine, options, preparation, new Map([[g.script, vu.record]]))
    assert.equal(chargerPreuve(b.racine).generateurs[g.script], undefined)
  } finally { b.jeter() }
})

test('sortie mixte finale : dernier écrivain attesté conserve les injections ordonnées', () => {
  const b = banc()
  try {
    const mixte = ['notes', 'mixte.md'].join('/')
    poser(b.racine, mixte, '# A')
    const opts = { ...options, generateurs: options.generateurs.map((g) => g.script !== 'g/code.mjs' ? { ...g, injecte: [mixte] } : g) }
    const preparation = preparerPreuves(b.racine, opts)
    const records = new Map()
    for (const g of opts.generateurs) {
      if (g.script === 'g/b.mjs') poser(b.racine, mixte, '# A et B')
      const vu = certifierGenerateur(b.racine, g, b.mesure[g.script], opts, avantGenerateur(b.racine, g, opts, preparation))
      assert.equal(vu.ok, true, vu.raison)
      records.set(g.script, vu.record)
    }
    enregistrerPreuve(b.racine, opts, preparation, records)
    assert.equal(preuveValide(b.racine, opts).ok, true)
    assert.deepEqual(chargerPreuve(b.racine).generateurs['g/a.mjs'].sorties.find(([rel]) => rel === mixte), chargerPreuve(b.racine).generateurs['g/b.mjs'].sorties.find(([rel]) => rel === mixte))
  } finally { b.jeter() }
})

for (const corruption of ['après certification', 'écrivain non certifié']) {
  test(`sortie mixte finale refusée : ${corruption}`, () => {
    const b = banc()
    try {
      const mixte = ['notes', 'mixte.md'].join('/')
      poser(b.racine, mixte, '# A')
      const opts = { ...options, generateurs: options.generateurs.map((g) => g.script !== 'g/code.mjs' ? { ...g, injecte: [mixte] } : g) }
      const preparation = preparerPreuves(b.racine, opts)
      const records = new Map()
      for (const g of opts.generateurs) {
        const vu = certifierGenerateur(b.racine, g, b.mesure[g.script], opts, avantGenerateur(b.racine, g, opts, preparation))
        assert.equal(vu.ok, true, vu.raison)
        records.set(g.script, vu.record)
      }
      if (corruption === 'après certification') poser(b.racine, mixte, 'corrompu')
      else records.set('g/b.mjs', null)
      enregistrerPreuve(b.racine, opts, preparation, records)
      assert.equal(chargerPreuve(b.racine).generateurs['g/a.mjs'], undefined)
      assert.equal(chargerPreuve(b.racine).generateurs['g/b.mjs'], undefined)
      assert.ok(chargerPreuve(b.racine).generateurs['g/code.mjs'])
    } finally { b.jeter() }
  })
}

test('sonde exists seule : disparition d’une référence sélectionne le doc', () => {
  const b = banc()
  try {
    poser(b.racine, 'data/reference.txt', 'référence')
    poser(b.cible, 'data/reference.txt', 'référence')
    b.mesure['g/a.mjs'].sondes.push({ chemin: 'data/reference.txt', type: 'exists', existe: true, nature: null })
    poser(b.racine, SOURCES_LUES, JSON.stringify(b.mesure))
    certifier(b.racine, b.mesure)
    rmSync(path.join(b.racine, 'data/reference.txt'))
    const vu = copier(b)
    assert.equal(vu.ok, true, vu.raison)
    assert.deepEqual(vu.scriptsARegenerer, ['g/a.mjs'])
  } finally { b.jeter() }
})
