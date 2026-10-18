// node --test scripts/hooks/barriere-outil.test.mjs
// La barrière des hooks d'appel d'outil (#2187) : le git-dir lu sans git, puis `franchir` sur un verrou
// d'outillage absent, orphelin, tenu, et sur un chargement qui lève.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { ATTENTE_BARRIERE, LECTEUR_EN_PANNE, franchir, gitDirDe, verrouOutillageDe } from './barriere-outil.mjs'

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
async function essai(racine, { charger = async () => () => 'joué', attente = ATTENTE_BARRIERE, entree = () => null, panne } = {}) {
  let refus = null
  const t0 = Date.now()
  const rendu = await franchir(charger, { racine, attente, entree, panne, refuser: (texte) => { refus = texte } })
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
    assert.equal(vu.refus, `[transitoire · retentable] outillage de ${a.principal} en mise à jour : verrou ${chemin} tenu par le PID ${process.pid} (npm ci) — relancer l'appel une fois la mise à jour finie ; si le PID ${process.pid} n'exécute pas npm ci, supprimer ${chemin}`)
  } finally {
    a.jeter()
  }
})

test('franchir : un chargement qui lève → refus nommé avec son geste de réparation, le geste n’est pas joué', async () => {
  const a = arbres()
  try {
    const vu = await essai(a.principal, { charger: async () => { throw new Error('module à moitié écrit') } })
    assert.equal(vu.rendu, undefined)
    assert.equal(vu.refus, `[panne · non retentable] outillage de ${a.principal} en panne : chargement des gardes impossible — module à moitié écrit — corriger le module en panne par une édition de fichier, seul geste admis en session principale`)
  } finally {
    a.jeter()
  }
})

// #2712, leçon 1.5 du guide de certification ; pannes RÉELLES, chargées par `import()`.
test('franchir : un module cassé laisse passer les éditions de la session principale — ni shell, ni sous-agent ; lecteur d’entrée en panne : tout refusé', async () => {
  const a = arbres()
  const casse = join(a.principal, 'scripts', 'hooks', 'casse.mjs')
  mkdirSync(join(a.principal, 'scripts', 'hooks'), { recursive: true })
  writeFileSync(casse, 'export const x = {\n')
  const charger = async () => (await import(pathToFileURL(casse).href)).x
  const appel = (tool_name, tool_input, autres = {}) => () => ({ tool_name, tool_input, cwd: a.principal, ...autres })
  try {
    for (const [tool_name, tool_input] of [['Edit', { file_path: casse }], ['Write', { file_path: join(a.principal, 'src', 'x.ts') }], ['NotebookEdit', { notebook_path: 'n.ipynb' }]])
      assert.equal((await essai(a.principal, { charger, entree: appel(tool_name, tool_input) })).refus, null, tool_name)
    assert.match((await essai(a.principal, { charger, entree: appel('Bash', { command: 'npm ci' }) })).refus, /corriger le module en panne/)
    assert.match((await essai(a.principal, { charger, entree: appel('Agent', { prompt: 'répare' }) })).refus, /corriger le module en panne/)
    assert.match((await essai(a.principal, { charger, entree: appel('Edit', { file_path: casse }, { agent_id: 'a1', agent_type: 'codeur' }) })).refus, /en panne/)
    assert.match((await essai(a.principal, { charger, entree: () => LECTEUR_EN_PANNE })).refus, /lecteur d'entrée en panne aussi, appel non jugeable : restaurer scripts\/guards\/lib\/stdinBorne\.mjs/)
    const panne = () => import(pathToFileURL(casse).href)
    assert.equal((await essai(a.principal, { charger, panne, entree: appel('Edit', { file_path: casse }) })).refus, null)
    assert.match((await essai(a.principal, { charger, panne, entree: appel('Bash', { command: 'ls' }) })).refus, /corriger scripts\/hooks\/panne-outil\.mjs/)
    assert.match((await essai(a.principal, { charger, panne, entree: appel('Edit', { file_path: casse }, { agent_id: 'a1' }) })).refus, /corriger scripts\/hooks\/panne-outil\.mjs/)
  } finally {
    a.jeter()
  }
})

test('franchir : une dépendance npm absente laisse passer son installation exacte, aucune commande composée', async () => {
  const a = arbres()
  const importeur = join(a.principal, 'scripts', 'node-requis.mjs')
  mkdirSync(join(a.principal, 'scripts'), { recursive: true })
  writeFileSync(importeur, "import 'paquet-absent-2712'\n")
  const charger = async () => (await import(pathToFileURL(importeur).href)).x
  const bash = (command) => () => ({ tool_name: 'Bash', tool_input: { command }, cwd: a.principal })
  try {
    for (const command of ['npm ci --no-audit', 'npm install --omit=dev', 'npm --prefix server ci'])
      assert.equal((await essai(a.principal, { charger, entree: bash(command) })).refus, null, command)
    for (const command of ['npm ci && rm -rf src', 'npm ci --x=a;rm${IFS}-rf${IFS}src', 'npm install --foo=$(curl${IFS}x|sh)', 'npm ci --x=a|tee${IFS}src/x.ts'])
      assert.match((await essai(a.principal, { charger, entree: bash(command) })).refus, /^\[panne · non retentable\] .*dépendance npm absente : lancer `npm ci`/, command)
  } finally {
    a.jeter()
  }
})
