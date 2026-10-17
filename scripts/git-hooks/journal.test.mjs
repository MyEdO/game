// Journal des hooks git (#2194, #2603) : début à l'armement, étapes, fin à la SORTIE du processus,
// étapes héritées par les sous-processus, et un journal en panne ou hors dépôt qui ne change rien au hook.
//   node --test scripts/git-hooks/journal.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { etapeHeritee, journalDe, journaliserLeHook, VARIABLE_DU_JOURNAL, verdictDe } from './journal.mjs'

const lue = (ligne) => {
  assert.ok(ligne.endsWith('\n'), 'une ligne par événement')
  assert.equal(ligne.indexOf('\n'), ligne.length - 1, 'une seule ligne')
  return JSON.parse(ligne)
}

/** Un arbre jetable dont `.git` est un dossier ; rend sa racine et un `jeter`. */
function arbreJetable() {
  const racine = mkdtempSync(join(tmpdir(), 'journal-hooks-'))
  mkdirSync(join(racine, '.git'))
  return { racine, jeter: () => rmSync(racine, { recursive: true, force: true }) }
}

/** Un processus factice : `pid` et l'événement `exit`. */
const processusFactice = (pid = 4242) => Object.assign(new EventEmitter(), { pid })

test('journalDe : sous le git-dir de l’arbre, dossier comme fichier `gitdir:` ; null hors dépôt', () => {
  const { racine, jeter } = arbreJetable()
  const lie = mkdtempSync(join(tmpdir(), 'journal-hooks-lie-'))
  try {
    assert.equal(journalDe(racine), join(racine, '.git', 'hooks-git', 'journal.jsonl'))
    writeFileSync(join(lie, '.git'), `gitdir: ${join(racine, '.git', 'worktrees', 'w')}\n`)
    assert.equal(journalDe(lie), join(racine, '.git', 'worktrees', 'w', 'hooks-git', 'journal.jsonl'))
    assert.equal(journalDe(join(racine, 'absent')), null)
  } finally {
    jeter()
    rmSync(lie, { recursive: true, force: true })
  }
})

test('verdict : 0 franchit, un refus nommé refuse, un code non nul sans refus est une panne', () => {
  assert.equal(verdictDe(0, []), 'franchi')
  assert.equal(verdictDe(1, ['x']), 'refusé')
  assert.equal(verdictDe(1, []), 'panne')
})

test('début écrit à l’armement, étape à la demande, fin à la sortie avec code, verdict et refus nommés', () => {
  const { racine, jeter } = arbreJetable()
  try {
    const processus = processusFactice()
    const env = {}
    const ecrites = []
    const origine = Date.parse('2026-10-12T07:00:00.000Z')
    const journal = journaliserLeHook('pre-push', {
      racine, processus, env, origine, horloge: () => origine + 1234.6, ecrire: (chemin, ligne) => ecrites.push({ chemin, ligne }),
    })
    assert.deepEqual(ecrites.map(({ chemin, ligne }) => ({ chemin, ...lue(ligne) })), [
      { chemin: journalDe(racine), evenement: 'debut', hook: 'pre-push', pid: 4242, debut: '2026-10-12T07:00:00.000Z' },
    ])
    journal.etape({ nom: '[pre-push] docs', debut: '2026-10-12T07:00:00.100Z', fin: '2026-10-12T07:00:00.400Z', ms: 299.7 })
    journal.refuser('push vers main REFUSÉ', 'origin hors dépôt')
    processus.emit('exit', 1)
    assert.deepEqual(ecrites.slice(1).map(({ ligne }) => lue(ligne)), [
      { evenement: 'etape', hook: 'pre-push', pid: 4242, nom: '[pre-push] docs', debut: '2026-10-12T07:00:00.100Z', fin: '2026-10-12T07:00:00.400Z', ms: 300 },
      {
        evenement: 'fin', hook: 'pre-push', pid: 4242, debut: '2026-10-12T07:00:00.000Z', fin: '2026-10-12T07:00:01.234Z', ms: 1235,
        code: 1, verdict: 'refusé', refus: ['push vers main REFUSÉ', 'origin hors dépôt'],
      },
    ])
  } finally {
    jeter()
  }
})

test('hérité : un sous-processus du MÊME arbre écrit ses étapes dans le journal du hook armé, un autre arbre rien', () => {
  const { racine, jeter } = arbreJetable()
  try {
    const env = {}
    journaliserLeHook('post-merge', { racine, processus: processusFactice(77), env })
    assert.deepEqual(JSON.parse(env[VARIABLE_DU_JOURNAL]), { chemin: journalDe(racine), hook: 'post-merge', pid: 77 })
    etapeHeritee(racine, env)({ nom: '[docs:build] gen.mjs', debut: 'a', fin: 'b', ms: 12.4 })
    const autre = arbreJetable()
    try { etapeHeritee(autre.racine, env)({ nom: '[docs:build] banc.mjs', debut: 'a', fin: 'b', ms: 1 }) } finally { autre.jeter() }
    const lignes = readFileSync(journalDe(racine), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l))
    assert.deepEqual(lignes.map((l) => l.evenement), ['debut', 'etape'])
    assert.deepEqual(lignes[1], { evenement: 'etape', hook: 'post-merge', pid: 77, nom: '[docs:build] gen.mjs', debut: 'a', fin: 'b', ms: 12 })
  } finally {
    jeter()
  }
})

test('hérité : variable absente ou illisible, un écrivain vide', () => {
  for (const env of [{}, { [VARIABLE_DU_JOURNAL]: '{' }, { [VARIABLE_DU_JOURNAL]: '{"chemin":1}' }])
    assert.doesNotThrow(() => etapeHeritee(tmpdir(), env)({ nom: 'x', debut: 'a', fin: 'b', ms: 1 }))
})

test('journal en panne : armement, étape et sortie se déroulent sans exception', () => {
  const { racine, jeter } = arbreJetable()
  try {
    const processus = processusFactice()
    const journal = journaliserLeHook('commit-msg', { racine, processus, env: {}, ecrire: () => { throw new Error('EACCES') } })
    assert.doesNotThrow(() => journal.etape({ nom: 'x', debut: 'a', fin: 'b', ms: 1 }))
    assert.doesNotThrow(() => processus.emit('exit', 0))
    const env = { [VARIABLE_DU_JOURNAL]: JSON.stringify({ chemin: join(racine, '.git', 'HEAD', 'journal.jsonl'), hook: 'h', pid: 1 }) }
    writeFileSync(join(racine, '.git', 'HEAD'), 'ref\n')
    assert.doesNotThrow(() => etapeHeritee(racine, env)({ nom: 'x', debut: 'a', fin: 'b', ms: 1 }))
  } finally {
    jeter()
  }
})

test('hors dépôt : rien n’est écrit ni posé dans l’env', () => {
  const dossier = mkdtempSync(join(tmpdir(), 'journal-hors-depot-'))
  try {
    const processus = processusFactice()
    const env = {}
    const ecrites = []
    const journal = journaliserLeHook('pre-commit', { racine: dossier, processus, env, ecrire: (...a) => ecrites.push(a) })
    journal.etape({ nom: 'x', debut: 'a', fin: 'b', ms: 1 })
    processus.emit('exit', 0)
    assert.deepEqual({ ecrites, env, ecouteurs: processus.listenerCount('exit') }, { ecrites: [], env: {}, ecouteurs: 0 })
  } finally {
    rmSync(dossier, { recursive: true, force: true })
  }
})
