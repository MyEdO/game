import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { instanceDeDepot } from '../../guards/lib/depotGabarit.mjs'
import { gitDe, lancerGit } from '../../test/gitDeBanc.mjs'
import { depotDe, relireRequeteMesuree } from '../../guards/lib/gitPorte.mjs'
import { ciblesPures, ciblesSurDisque, SOURCES_LUES } from '../build-all.mjs'
import { selectionDesGenerateurs } from '../../git-hooks/docs-rebuild.mjs'
import { CACHE_FRAICHEUR, avantGenerateur, certifierGenerateur, chargerPreuve, copierDocsFrais, enregistrerPreuve, preparerPreuves, preuveValide } from './fraicheur-docs.mjs'

const doc = (nom) => ['docs', `${nom}.md`].join('/')
const code = ['src', 'banc.generated.ts'].join('/')
const options = {
  generateurs: [
    { runner: 'node', script: 'g/a.mjs', targets: [doc('a')] },
    { runner: 'node', script: 'g/b.mjs', targets: [doc('b')] },
    { runner: 'node', script: 'g/code.mjs', targets: [code] },
  ],
  verificateurs: [],
  ciblesPures, ciblesSurDisque, sourcesLues: SOURCES_LUES,
}
const poser = (racine, rel, bytes) => {
  mkdirSync(path.dirname(path.join(racine, rel)), { recursive: true })
  writeFileSync(path.join(racine, rel), bytes)
}

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

const copier = (b, extra = {}) => copierDocsFrais({ principal: b.racine, cible: b.cible, selecteur: selectionDesGenerateurs, ...options, ...extra })

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
  ['doc absent', (b) => rmSync(path.join(b.racine, doc('a')))],
  ['mesure absente', (b) => rmSync(path.join(b.racine, SOURCES_LUES))],
  ['cache incomplet', (b) => { const p = chargerPreuve(b.racine); delete p.generateurs['g/a.mjs']; poser(b.racine, CACHE_FRAICHEUR, JSON.stringify(p)) }],
  ['HEAD différent', (b) => { poser(b.cible, 'data/a/source.txt', 'commit'); gitDe(b.cible)('add', 'data/a/source.txt'); gitDe(b.cible)('commit', '-q', '-m', 'autre HEAD') }],
]) {
  test(`repli complet : ${nom}`, () => {
    const b = banc()
    try { changer(b); assert.equal(copier(b).complete, true) }
    finally { b.jeter() }
  })
}

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
