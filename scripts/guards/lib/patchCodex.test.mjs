import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, rmSync, symlinkSync, unlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { lirePatchCodex, normaliserPatchCodex, resoudreCheminPatchCodex as resoudreFeuille } from './patchCodex.mjs'

const base = resolve('fixture')
const enveloppe = (corps) => `*** Begin Patch\n${corps}\n*** End Patch`
const normaliser = (corps, fichiers = {}, phase = 'PreToolUse', lire) => normaliserPatchCodex({ hook_event_name: phase, tool_name: 'apply_patch', tool_input: { command: enveloppe(corps) } }, {
  base,
  lire: lire ?? ((path) => fichiers[path.slice(base.length + 1)] ?? null),
})

test('patch natif : Add, Update, Delete, Move portent les images complètes et des chemins absolus', () => {
  const n = normaliser('*** Add File: neuf\n+neuf\n*** Update File: source\n*** Move to: cible\n@@\n-avant\n+après\n*** Delete File: supprime', { source: 'avant\n', supprime: 'ancien\n' })
  assert.equal(n.nonJugeable, undefined)
  assert.deepEqual(n.ecritures, [
    { path: resolve(base, 'neuf'), old_string: '', content: 'neuf\n', existeAvant: false },
    { path: resolve(base, 'source'), old_string: 'avant\n', content: '', existeAvant: true },
    { path: resolve(base, 'cible'), old_string: '', content: 'après\n', existeAvant: false },
    { path: resolve(base, 'supprime'), old_string: 'ancien\n', content: '', existeAvant: true },
  ])
})

test('patch natif : hunks séparés, contexte @@, EOF et terminaisons exactes', () => {
  for (const fin of ['\n', '\r\n', '\r']) {
    const avant = ['début', 'a', 'milieu', 'b', 'fin'].join(fin)
    const n = normaliser('*** Update File: fichier\n@@ début\n-a\n+A\n@@\n-b\n+B\n fin\n*** End of File', { fichier: avant })
    assert.equal(n.nonJugeable, undefined)
    assert.equal(n.ecritures[0].old_string, avant)
    assert.equal(n.ecritures[0].content, ['début', 'A', 'milieu', 'B', 'fin', ''].join(fin))
  }
  assert.equal(normaliser('*** Update File: fichier\n@@\n+c', { fichier: 'a\nb\n' }).ecritures[0].content, 'a\nb\nc\n')
  assert.equal(normaliser('*** Update File: fichier\n@@\n a\n-b\n+B\n c', { fichier: 'a\r\nb\nc\r\n' }).ecritures[0].content, 'a\r\nB\r\nc\r\n')
})

test('patch natif : une préimage lue une fois ; erreur de lecture refusée avec ctx_patch', () => {
  let lectures = 0
  const n = normaliser('*** Update File: f\n@@\n-a\n+A\n@@\n-b\n+B', {}, 'PreToolUse', () => { lectures++; return 'a\nb\n' })
  assert.equal(lectures, 1)
  assert.equal(n.ecritures[0].content, 'A\nB\n')
  const casse = normaliser('*** Update File: f\n@@\n-a\n+A', {}, 'PreToolUse', () => { throw new Error('EACCES') })
  assert.match(casse.nonJugeable.raison, /EACCES/)
  assert.match(casse.nonJugeable.canal, /ctx_patch/)
  let compte = 0
  const sequence = normaliser('*** Update File: f\n@@\n-a\n+A\n*** Update File: f\n@@\n-A\n+AA', {}, 'PreToolUse', () => { compte++; return 'a\nb\n' })
  assert.equal(compte, 1)
  assert.equal(sequence.ecritures[1].old_string, 'A\nb\n')
  assert.equal(sequence.ecritures[1].content, 'AA\nb\n')
  const recreation = normaliser('*** Delete File: f\n*** Add File: f\n+x', { f: 'a\n' })
  assert.equal(recreation.ecritures[0].existeAvant, true)
  assert.equal(recreation.ecritures[1].existeAvant, false)
  const vide = normaliser('*** Update File: f\n@@\n+x', { f: '' })
  assert.equal(vide.ecritures[0].existeAvant, true)
})

test('patch natif : aucune forme improuvable ne devient un lot silencieux', () => {
  const cas = [
    ['*** Update File: absent\n@@\n-a\n+A', {}],
    ['*** Add File: f\n+x', { f: 'existe\n' }],
    ['*** Update File: f\n*** Move to: cible\n@@\n-a\n+A', { f: 'a\n', cible: 'existe\n' }],
    ['*** Update File: f\n*** Move to: ./f\n@@\n-a\n+A', { f: 'a\n' }],
    ['*** Update File: f\n@@\n-a\n+A', { f: 'a\na\n' }],
    ['*** Update File: f\n@@\n-a\n+A', { f: ' a \n' }],
    ['*** Update File: f\n@@ manquant\n-a\n+A', { f: 'a\n' }],
    ['*** Update File: f\n@@\n-a\n+A\n*** End of File', { f: 'a\nb\n' }],
    ['*** Add File: f\n+x\n*** Add File: ./f\n+y', {}],
    ...(process.platform === 'win32' ? [['*** Add File: f\n+x\n*** Add File: F\n+y', {}]] : []),
    ['*** Update File: f\n@@\n-a\n+A\n???', { f: 'a\n' }],
    ['*** Update File: f', { f: 'a\n' }],
    ['*** Delete File: f\n+x', { f: 'a\n' }],
    ['*** Add File: f\nx', {}],
  ]
  for (const [corps, fichiers] of cas) {
    const n = normaliser(corps, fichiers)
    assert.ok(n.nonJugeable, corps)
    assert.deepEqual(n.ecritures, [], corps)
  }
  for (const texte of [null, '', '*** Begin Patch\n*** End Patch', '*** Begin Patch\n???\n*** End Patch']) assert.throws(() => lirePatchCodex(texte))
  for (const corps of ['*** Add File:   \n+x', '*** Update File: f\n*** Move to: \n@@\n-a\n+A']) assert.ok(normaliser(corps, { f: 'a\n' }).nonJugeable)
  const inconnue = normaliserPatchCodex({ tool_input: { command: enveloppe('*** Add File: f\n+x'), option: true } }, { base, lire: () => null })
  assert.match(inconnue.nonJugeable.raison, /clé de patch inconnue/)
})

test('patch natif Post : chemins parsés, lecture du résultat réel, aucune reconstruction du patch', () => {
  const n = normaliser('*** Update File: f\n@@\n-ancien impossible\n+neuf', { f: 'résultat réel\n' }, 'PostToolUse')
  assert.deepEqual(n.ecritures, [{ path: resolve(base, 'f'), content: 'résultat réel\n' }])
  assert.equal(n.nonJugeable, undefined)
  const move = normaliser('*** Update File: f\n*** Move to: cible\n@@\n-a\n+b', { cible: 'b\n' }, 'PostToolUse')
  assert.deepEqual(move.ecritures, [{ path: resolve(base, 'f'), content: '' }, { path: resolve(base, 'cible'), content: 'b\n' }])
})

test('Post terminal : fichiers transitoires, déplacements et recréation donnent une image finale par chemin', () => {
  const corps = '*** Add File: f\n+x\n*** Delete File: f\n*** Update File: g\n@@\n-a\n+b'
  const n = normaliser(corps, { g: 'poison réel\n' }, 'PostToolUse')
  assert.deepEqual(n.ecritures, [{ path: resolve(base, 'f'), content: '' }, { path: resolve(base, 'g'), content: 'poison réel\n' }])
  assert.equal(n.nonJugeable, undefined)
  const move = normaliser('*** Update File: f\n@@\n-a\n+b\n*** Update File: f\n*** Move to: g\n@@\n-b\n+c\n*** Delete File: g\n*** Add File: g\n+d', { g: 'd\n' }, 'PostToolUse')
  assert.deepEqual(move.ecritures, [{ path: resolve(base, 'f'), content: '' }, { path: resolve(base, 'g'), content: 'd\n' }])
  let lectures = 0
  const alias = normaliserPatchCodex({ hook_event_name: 'PostToolUse', tool_input: { command: enveloppe('*** Add File: f\n+x\n*** Delete File: F\n*** Add File: f\n+y') } }, { base, platform: 'win32', lire: () => { lectures++; return 'y\n' } })
  assert.equal(lectures, 1)
  assert.deepEqual(alias.ecritures, [{ path: resolve(base, 'f'), content: 'y\n' }])
})

test('Post terminal : panne d’une image préserve les autres et porte un diagnostic nommé', () => {
  const corps = '*** Add File: absent\n+x\n*** Update File: cassé\n@@\n-a\n+b\n*** Update File: bon\n@@\n-a\n+b'
  const n = normaliser(corps, {}, 'PostToolUse', (path) => { if (path.endsWith('absent')) return null; if (path.endsWith('cassé')) throw new Error('EACCES'); return 'poison réel\n' })
  assert.deepEqual(n.ecritures, [{ path: resolve(base, 'bon'), content: 'poison réel\n' }])
  assert.equal(n.nonJugeable, undefined)
  assert.match(n.diagnosticPost, /PostToolUse.*absent/)
  assert.match(n.diagnosticPost, /cassé.*EACCES/)
  const syntaxe = normaliser('???', {}, 'PostToolUse')
  assert.match(syntaxe.diagnosticPost, /PostToolUse/)
})

test('feuille Pre : lien symbolique vivant ou cassé refusé avant canonisation', () => {
  for (const casse of [false, true]) {
    let canonisee = false
    assert.throws(() => resoudreFeuille(resolve(base, casse ? 'casse' : 'lien'), { evenement: 'PreToolUse', lstat: () => ({ isSymbolicLink: () => true }), canoniser: () => { canonisee = true } }), /feuille symbolique.*(?:lien|casse)/)
    assert.equal(canonisee, false)
  }
})

test('feuille Pre : ENOENT seul autorise création et canonisation stricte', () => {
  const path = resolve(base, 'neuf')
  const appels = []
  assert.equal(resoudreFeuille(path, { evenement: 'PreToolUse', lstat: () => { throw Object.assign(new Error('absent'), { code: 'ENOENT' }) }, canoniser: (p, options) => { appels.push([p, options]); return p } }), path)
  assert.deepEqual(appels, [[path, { strict: true }]])
})

test('feuille Pre : erreurs lstat EACCES et ENOTDIR restent explicites', () => {
  for (const code of ['EACCES', 'ENOTDIR']) assert.throws(() => resoudreFeuille(resolve(base, 'f'), { evenement: 'PreToolUse', lstat: () => { throw Object.assign(new Error(code), { code }) }, canoniser: () => assert.fail('canonisation après erreur') }), new RegExp(`feuille illisible.*f.*${code}`))
})

test('feuille Pre : jonction ancêtre réelle acceptée et canonisée', () => {
  const dir = mkdtempSync(resolve(tmpdir(), 'wfrp-feuille-'))
  const real = resolve(dir, 'real'), alias = resolve(dir, 'alias')
  mkdirSync(real)
  symlinkSync(real, alias, 'junction')
  writeFileSync(resolve(real, 'f'), 'avant\n')
  try { assert.equal(resoudreFeuille(resolve(alias, 'f'), { evenement: 'PreToolUse' }), resolve(real, 'f')) }
  finally { unlinkSync(alias); rmSync(dir, { recursive: true }) }
})

test('feuille Post : observation sans inspection Pre ni canonisation stricte', () => {
  const path = resolve(base, 'lien')
  const appels = []
  assert.equal(resoudreFeuille(path, { evenement: 'PostToolUse', lstat: () => assert.fail('lstat Post'), canoniser: (p, options) => { appels.push([p, options]); return p } }), path)
  assert.deepEqual(appels, [[path, { strict: false }]])
})
