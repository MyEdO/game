// node --test scripts/hooks/barriere-outil.test.mjs
// La barrière des hooks d'appel d'outil (#2187) : le git-dir lu sans git, puis `franchir` sur un verrou
// d'outillage absent, orphelin, tenu, et sur un chargement qui lève.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { ATTENTE_BARRIERE, franchir, gitDirDe, verrouOutillageDe } from './barriere-outil.mjs'

/** Un principal, un worktree lié (LF et CRLF), un sous-module, un dossier hors dépôt et un `.git` illisible. */
function arbres() {
  const base = mkdtempSync(join(tmpdir(), 'barriere-outil-'))
  const principal = join(base, 'p')
  const gitDirWt = join(principal, '.git', 'worktrees', 'w')
  mkdirSync(gitDirWt, { recursive: true })
  const worktree = join(base, 'w')
  mkdirSync(worktree)
  writeFileSync(join(worktree, '.git'), `gitdir: ${gitDirWt}\n`)
  const worktreeCrlf = join(base, 'wcrlf')
  mkdirSync(worktreeCrlf)
  writeFileSync(join(worktreeCrlf, '.git'), `gitdir: ${gitDirWt}\r\n`)
  const sousModule = join(principal, 'sub')
  mkdirSync(sousModule)
  mkdirSync(join(principal, '.git', 'modules', 'sub'), { recursive: true })
  writeFileSync(join(sousModule, '.git'), 'gitdir: ../.git/modules/sub\n')
  const absent = join(base, 'a')
  mkdirSync(absent)
  const illisible = join(base, 'f')
  mkdirSync(illisible)
  writeFileSync(join(illisible, '.git'), 'nimporte\n')
  return { base, principal, gitDirWt, worktree, worktreeCrlf, sousModule, absent, illisible, jeter: () => rmSync(base, { recursive: true, force: true }) }
}

/** `franchir` sur `racine` : le geste joué ou le texte du refus, et la durée. */
async function essai(racine, { charger = async () => () => 'joué', attente = ATTENTE_BARRIERE } = {}) {
  let refus = null
  const t0 = Date.now()
  const rendu = await franchir(charger, { racine, attente, refuser: (texte) => { refus = texte } })
  return { rendu, refus, ms: Date.now() - t0 }
}

test('gitDirDe : dossier `.git`, fichier `gitdir:` (LF, CRLF, relatif), hors dépôt et illisible → null', () => {
  const a = arbres()
  try {
    assert.equal(gitDirDe(a.principal), join(a.principal, '.git'))
    assert.equal(gitDirDe(a.worktree), a.gitDirWt)
    assert.equal(gitDirDe(a.worktreeCrlf), a.gitDirWt)
    assert.equal(gitDirDe(a.sousModule), join(a.principal, '.git', 'modules', 'sub'))
    assert.equal(gitDirDe(a.absent), null)
    assert.equal(gitDirDe(a.illisible), null)
    assert.equal(verrouOutillageDe(a.worktree), join(a.gitDirWt, 'outillage.verrou'))
    assert.equal(verrouOutillageDe(a.absent), null)
  } finally {
    a.jeter()
  }
})

test('franchir : verrou absent, orphelin (PID mort) ou illisible → le geste est joué sans attendre', async () => {
  const a = arbres()
  const chemin = verrouOutillageDe(a.principal)
  try {
    for (const [quoi, contenu] of [['absent', null], ['orphelin', JSON.stringify({ pid: 999999, commande: 'npm ci' })], ['illisible', '{pas json']]) {
      if (contenu === null) rmSync(chemin, { force: true })
      else writeFileSync(chemin, contenu)
      const vu = await essai(a.principal)
      assert.deepEqual([vu.rendu, vu.refus], ['joué', null], quoi)
      assert.ok(vu.ms < ATTENTE_BARRIERE.echeanceMs, `${quoi} : ${vu.ms} ms`)
    }
    assert.deepEqual([(await essai(a.absent)).rendu], ['joué'], 'hors dépôt')
  } finally {
    a.jeter()
  }
})

test('franchir : verrou tenu par un PID vivant → refus à l’échéance, qui nomme le PID, la commande et le chemin à supprimer', async () => {
  const a = arbres()
  const chemin = verrouOutillageDe(a.principal)
  try {
    writeFileSync(chemin, JSON.stringify({ pid: process.pid, commande: 'npm ci' }))
    let charge = false
    const vu = await essai(a.principal, { charger: async () => { charge = true; return () => 'joué' } })
    assert.equal(charge, false, 'rien n’est chargé derrière un verrou tenu')
    assert.equal(vu.rendu, undefined)
    assert.ok(vu.ms >= ATTENTE_BARRIERE.echeanceMs, `${vu.ms} ms`)
    assert.equal(vu.refus, `outillage de ${a.principal} en mise à jour : verrou ${chemin} tenu par le PID ${process.pid} (npm ci) — relancer l'appel une fois la mise à jour finie ; si le PID ${process.pid} n'exécute pas npm ci, supprimer ${chemin}`)
  } finally {
    a.jeter()
  }
})

test('franchir : un chargement qui lève → refus nommé, le geste n’est pas joué', async () => {
  const a = arbres()
  try {
    const vu = await essai(a.principal, { charger: async () => { throw new Error('module à moitié écrit') } })
    assert.equal(vu.rendu, undefined)
    assert.equal(vu.refus, `outillage de ${a.principal} en mise à jour : chargement des gardes impossible — module à moitié écrit`)
  } finally {
    a.jeter()
  }
})
