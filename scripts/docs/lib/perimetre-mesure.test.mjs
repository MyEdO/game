// #2603 — reprise du périmètre de mesure validée par empreinte : un témoin sans mutation, puis une
// mutation par entrée de l'empreinte, chacune jugée contre `ls-files` lancé à neuf.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs, { cpSync, existsSync, mkdirSync, mkdtempSync, renameSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { perimetreDeMesure } from './perimetre-mesure.mjs'
import { EXCLUSIONS_FIXES } from './chemin-mesure.mjs'
import { ENV_GIT_FEINT, envDeDepotForge, instanceDeDepot } from '../../guards/lib/depotGabarit.mjs'
import { lancerGit, lancesDeGit } from '../../test/gitDeBanc.mjs'

const estEmpreinte = (args) => args.includes('config') && args.includes('--list')

const verite = (cwd) => new Set([
  ...lancerGit(['ls-files', '--others', '--ignored', '--exclude-standard', '--directory', '-z'], { cwd, env: process.env }).split('\0').filter(Boolean).map((p) => p.replace(/\/$/, '')),
  ...EXCLUSIONS_FIXES,
])

/** Deux mesures, puis une troisième qui doit se reprendre : un seul spawn, celui de l'empreinte. */
function amorcer(cwd) {
  perimetreDeMesure(cwd)
  perimetreDeMesure(cwd)
  const { valeur, lances } = lancesDeGit(() => perimetreDeMesure(cwd))
  assert.deepEqual(lances.filter((args) => !estEmpreinte(args)), [], 'reprise sans spawn de mesure')
  assert.equal(lances.length, 1)
  assert.deepEqual(valeur.ignores, verite(cwd))
  return valeur.ignores
}

/** `process.env` d'un dépôt forgé, `XDG_CONFIG_HOME` vide, rendu à l'identique en sortie. */
async function sousEnvForge(fn) {
  const sauve = { ...process.env }
  const proprio = mkdtempSync(join(tmpdir(), 'perimetre-env-'))
  const forge = envDeDepotForge()
  for (const k of Object.keys(process.env)) if (!(k in forge)) delete process.env[k]
  Object.assign(process.env, forge, { XDG_CONFIG_HOME: join(proprio, 'xdg') })
  try { return await fn(proprio) } finally {
    for (const k of Object.keys(process.env)) if (!(k in sauve)) delete process.env[k]
    Object.assign(process.env, sauve)
    rmSync(proprio, { recursive: true, force: true })
  }
}

const ecrire = (r, rel, contenu = 'x') => writeFileSync(join(r, rel), contenu)

const CAS = [
  ['non suivi neuf', { '.gitignore': '*.log\n' }, () => {}, (r) => ecrire(r, 'neuf.log')],
  ['fichier non ignoré dans un dossier replié', { '.gitignore': '*.log\n' }, (r) => {
    mkdirSync(join(r, 'rep'))
    ecrire(r, 'rep/a.log')
    assert.equal(verite(r).has('rep'), true, 'rep replié par --directory')
  }, (r) => ecrire(r, 'rep/b.txt')],
  ['index', { '.gitignore': '*.log\n' }, (r) => {
    ecrire(r, 'suivi.log')
    lancerGit(['add', '-f', 'suivi.log'], { cwd: r })
  }, (r) => lancerGit(['rm', '-q', '--cached', 'suivi.log'], { cwd: r })],
  ['.gitignore', { '.gitignore': '*.log\n' }, (r) => ecrire(r, 'x.tmp'), (r) => ecrire(r, '.gitignore', '*.log\n*.tmp\n')],
  ['info/exclude', { '.gitignore': '' }, (r) => ecrire(r, 'x.tmp'), (r) => ecrire(r, '.git/info/exclude', '*.tmp\n')],
  ['fichier global', { '.gitignore': '' }, (r, proprio) => {
    ecrire(r, 'x.tmp')
    writeFileSync(join(proprio, 'global'), '')
    lancerGit(['config', 'core.excludesFile', join(proprio, 'global')], { cwd: r })
  }, (_r, proprio) => writeFileSync(join(proprio, 'global'), '*.tmp\n')],
  ['core.ignoreCase', { '.gitignore': 'A.txt\n' }, (r) => {
    ecrire(r, 'a.txt')
    lancerGit(['config', 'core.ignoreCase', 'false'], { cwd: r })
  }, (r) => lancerGit(['config', 'core.ignoreCase', 'true'], { cwd: r })],
  ['env', { '.gitignore': '' }, (r) => ecrire(r, 'x.tmp'), (_r, proprio) => {
    mkdirSync(join(proprio, 'autre', 'git'), { recursive: true })
    writeFileSync(join(proprio, 'autre', 'git', 'ignore'), '*.tmp\n')
    process.env.XDG_CONFIG_HOME = join(proprio, 'autre')
  }],
]

for (const [nom, fichiers, preparer, muter] of CAS) {
  test(`reprise du périmètre : ${nom} muté → mesure fraîche`, () => sousEnvForge((proprio) => {
    const { racine } = instanceDeDepot({ fichiers })
    try {
      preparer(racine, proprio)
      const avant = amorcer(racine)
      muter(racine, proprio)
      assert.notDeepEqual(verite(racine), avant, 'la mutation change ce que git ignore')
      assert.deepEqual(perimetreDeMesure(racine).ignores, verite(racine))
    } finally { rmSync(racine, { recursive: true, force: true }) }
  }))
}

test('reprise du périmètre : .gitignore parent muté → mesure fraîche', () => sousEnvForge(() => {
  const { racine: depot } = instanceDeDepot({ fichiers: { '.gitignore': '', 'sous/a.txt': 'a' } })
  const racine = join(depot, 'sous')
  try {
    ecrire(racine, 'x.tmp')
    const avant = amorcer(racine)
    ecrire(depot, '.gitignore', '*.tmp\n')
    assert.notDeepEqual(verite(racine), avant)
    assert.deepEqual(perimetreDeMesure(racine).ignores, verite(racine))
  } finally { rmSync(depot, { recursive: true, force: true }) }
}))

test('reprise du périmètre : pointeur .git muté → mesure fraîche', () => sousEnvForge((proprio) => {
  const { racine: depot } = instanceDeDepot({ fichiers: { '.gitignore': '*.log\n', 'a.txt': 'a' } })
  const [w1, w2] = [join(proprio, 'w1'), join(proprio, 'w2')]
  try {
    lancerGit(['worktree', 'add', '-q', '-b', 'w1', w1, 'HEAD'], { cwd: depot })
    lancerGit(['worktree', 'add', '-q', '-b', 'w2', w2, 'HEAD'], { cwd: depot })
    writeFileSync(join(w2, 'x.log'), 'x')
    lancerGit(['add', '-f', 'x.log'], { cwd: w2 })
    writeFileSync(join(w1, 'x.log'), 'x')
    const avant = amorcer(w1)
    const pointeurW2 = lancerGit(['rev-parse', '--absolute-git-dir'], { cwd: w2, net: true })
    renameSync(join(w1, '.git'), join(proprio, 'pointeur-w1'))
    writeFileSync(join(w1, '.git'), `gitdir: ${pointeurW2}\n`)
    assert.notDeepEqual(verite(w1), avant)
    assert.deepEqual(perimetreDeMesure(w1).ignores, verite(w1))
  } finally { rmSync(depot, { recursive: true, force: true }) }
}))

test('reprise du périmètre : sans mutation, la reprise rend la mesure fraîche sans spawn de mesure', () => sousEnvForge(() => {
  const { racine } = instanceDeDepot({ fichiers: { '.gitignore': '*.log\n' } })
  try {
    ecrire(racine, 'b.log')
    const repris = amorcer(racine)
    const { valeur, lances } = lancesDeGit(() => perimetreDeMesure(racine))
    assert.deepEqual(lances.filter((args) => !estEmpreinte(args)), [])
    assert.deepEqual(valeur.ignores, repris)
    valeur.ignores.add('mutation')
    valeur.signature.fichiers.push(['mutation', null])
    const suivant = perimetreDeMesure(racine)
    assert.equal(suivant.ignores.has('mutation'), false)
    assert.equal(suivant.signature.fichiers.some(([rel]) => rel === 'mutation'), false)
  } finally { rmSync(racine, { recursive: true, force: true }) }
}))

/** Trois mesures (reprise permise ou non), une mutation qui change ce que git ignore, puis la mesure suivante contre la vérité fraîche. */
function juger(racine, muter) {
  for (let i = 0; i < 3; i++) perimetreDeMesure(racine)
  const avant = verite(racine)
  assert.deepEqual(perimetreDeMesure(racine).ignores, avant)
  muter()
  assert.notDeepEqual(verite(racine), avant, 'la mutation change ce que git ignore')
  assert.deepEqual(perimetreDeMesure(racine).ignores, verite(racine))
}

const IDENTITE = ['-c', 'user.name=banc', '-c', 'user.email=banc@banc']
/** Un dépôt imbriqué `sub` au commit `a.txt`, `sub/x.log` non suivi ; `gitdir` externe s'il est donné. */
function imbriquer(racine, gitdir) {
  mkdirSync(join(racine, 'sub'))
  lancerGit(['init', '-q', ...(gitdir ? [`--separate-git-dir=${gitdir}`] : []), join(racine, 'sub')], { cwd: racine })
  ecrire(racine, 'sub/a.txt')
  lancerGit(['add', 'a.txt'], { cwd: join(racine, 'sub') })
  lancerGit([...IDENTITE, 'commit', '-qm', 'a'], { cwd: join(racine, 'sub') })
  ecrire(racine, 'sub/x.log')
}

test('reprise du périmètre : gitdir externe d’un dépôt imbriqué disparu → mesure fraîche', () => sousEnvForge((proprio) => {
  const { racine } = instanceDeDepot({ fichiers: { '.gitignore': '*.log\n' } })
  try {
    const externe = join(proprio, 'externe.git')
    imbriquer(racine, externe)
    juger(racine, () => renameSync(externe, join(proprio, 'parti.git')))
  } finally { rmSync(racine, { recursive: true, force: true }) }
}))

test('reprise du périmètre : HEAD d’un dépôt imbriqué corrompu → mesure fraîche', () => sousEnvForge(() => {
  const { racine } = instanceDeDepot({ fichiers: { '.gitignore': '*.log\n' } })
  try {
    imbriquer(racine)
    juger(racine, () => ecrire(racine, 'sub/.git/HEAD', 'pas une ref\n'))
  } finally { rmSync(racine, { recursive: true, force: true }) }
}))

test('reprise du périmètre : jonction vers un dossier externe dont le contenu change → mesure fraîche', { skip: process.platform !== 'win32' && 'git ne descend dans une jonction que sous Windows' }, () => sousEnvForge((proprio) => {
  const { racine } = instanceDeDepot({ fichiers: { '.gitignore': '*.log\n' } })
  try {
    const externe = join(proprio, 'externe')
    mkdirSync(externe)
    ecrire(externe, 'x.log')
    symlinkSync(externe, join(racine, 'j'), 'junction')
    juger(racine, () => ecrire(externe, 'y.log'))
  } finally { rmSync(racine, { recursive: true, force: true }) }
}))

const casseIgnoree = (dossier) => {
  ecrire(dossier, 'sonde-casse')
  return existsSync(join(dossier, 'SONDE-CASSE'))
}

test('reprise du périmètre : .GITIGNORE en capitales muté → mesure fraîche', (t) => sousEnvForge((proprio) => {
  if (!casseIgnoree(proprio)) return t.skip('système de fichiers sensible à la casse')
  const { racine } = instanceDeDepot({ fichiers: { 'sub/.GITIGNORE': '*.tmp\n' } })
  try {
    ecrire(racine, 'sub/x.tmp')
    juger(racine, () => ecrire(racine, 'sub/.GITIGNORE', '\n'))
  } finally { rmSync(racine, { recursive: true, force: true }) }
}))

test('reprise du périmètre : variable d’environnement hors git (WFRP_GIT_FEINT) → mesure fraîche', async () => {
  const sauve = process.env[ENV_GIT_FEINT]
  const { racine } = instanceDeDepot({ fichiers: { '.gitignore': '*.log\n' } })
  try {
    ecrire(racine, 'x.log')
    amorcer(racine)
    process.env[ENV_GIT_FEINT] = JSON.stringify([{ si: ['ls-files'], status: 0, stdout: '' }])
    const repris = perimetreDeMesure(racine).ignores
    const frais = (await import(`${import.meta.resolve('./perimetre-mesure.mjs')}?frais`)).perimetreDeMesure(racine).ignores
    assert.notDeepEqual(frais, verite(racine), 'la feinte change ce que la mesure voit')
    assert.deepEqual(repris, frais)
  } finally {
    if (sauve === undefined) delete process.env[ENV_GIT_FEINT]
    else process.env[ENV_GIT_FEINT] = sauve
    rmSync(racine, { recursive: true, force: true })
  }
})

test('reprise du périmètre : ignoré transitoire pendant une mesure → jamais figé', () => sousEnvForge(() => {
  const { racine } = instanceDeDepot({ fichiers: { '.gitignore': '*.log\n' } })
  const transitoire = join(racine, 'transitoire.log')
  const { native } = fs.realpathSync
  const { lstatSync } = fs
  let arme = true
  try {
    ecrire(racine, 'a.log')
    perimetreDeMesure(racine)
    fs.realpathSync.native = function (chemin, ...options) {
      if (arme && new Error().stack.includes('at mesurer (') && !existsSync(transitoire)) writeFileSync(transitoire, 'x')
      return native.call(this, chemin, ...options)
    }
    fs.lstatSync = function (chemin, ...options) {
      const stat = lstatSync.call(this, chemin, ...options)
      if (arme && chemin === transitoire) {
        arme = false
        rmSync(transitoire)
      }
      return stat
    }
    try { perimetreDeMesure(racine) } finally { fs.lstatSync = lstatSync; fs.realpathSync.native = native }
    assert.equal(arme, false, 'le transitoire a été vu puis retiré pendant la mesure')
    assert.deepEqual(perimetreDeMesure(racine).ignores, verite(racine))
  } finally { rmSync(racine, { recursive: true, force: true }) }
}))

test('reprise du périmètre : commondir d’un worktree réécrit → mesure fraîche', () => sousEnvForge((proprio) => {
  const { racine: depot } = instanceDeDepot({ fichiers: { '.gitignore': '' } })
  const w1 = join(proprio, 'w1')
  try {
    lancerGit(['worktree', 'add', '-q', '-b', 'w1', w1, 'HEAD'], { cwd: depot })
    ecrire(w1, 'x.tmp')
    const autre = join(proprio, 'autre.git')
    cpSync(join(depot, '.git'), autre, { recursive: true })
    writeFileSync(join(autre, 'info', 'exclude'), '*.tmp\n')
    const gitdir = lancerGit(['rev-parse', '--absolute-git-dir'], { cwd: w1, net: true })
    juger(w1, () => writeFileSync(join(gitdir, 'commondir'), `${autre}\n`))
  } finally { rmSync(depot, { recursive: true, force: true }) }
}))

test('reprise du périmètre : racine devenue jonction vers son grand-parent → mesure fraîche', { skip: process.platform !== 'win32' && 'jonction' }, () => sousEnvForge(async (proprio) => {
  const w = join(proprio, 'w')
  const l = join(w, 'x', 'l')
  for (const d of [w, l]) {
    mkdirSync(join(d, 'x'), { recursive: true })
    lancerGit(['init', '-q'], { cwd: d })
    ecrire(d, '.gitignore', 'x/\n')
  }
  ecrire(l, 'x/f')
  for (let i = 0; i < 3; i++) perimetreDeMesure(l)
  const avant = perimetreDeMesure(l).signature
  rmSync(l, { recursive: true, force: true })
  symlinkSync(w, l, 'junction')
  const frais = (await import(`${import.meta.resolve('./perimetre-mesure.mjs')}?frais`)).perimetreDeMesure(l)
  assert.notDeepEqual(frais.signature, avant, 'la canonisation de la racine change la signature')
  assert.deepEqual(perimetreDeMesure(l).signature, frais.signature)
}))
