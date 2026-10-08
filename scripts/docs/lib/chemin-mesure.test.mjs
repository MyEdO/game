// `canoniser` d'un chemin ABSENT du disque : l'ancêtre EXISTANT le plus proche est canonisé (jonction
// suivie), le reste recollé tel quel (#1973). Fixtures sous `os.tmpdir()`, `rmSync` en finally.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { mkdirSync, mkdtempSync, realpathSync, renameSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { ancetreExistant, canoniser, dansLaMesure, perimetreDeMesure, relatifSousRacine } from './chemin-mesure.mjs'
import { envDeDepotForge, instanceDeDepot } from '../../guards/lib/depotGabarit.mjs'
import { depotDe, politiqueExclusionsDe } from '../../guards/lib/gitPorte.mjs'
import { lancerGit, resultatDeGit } from '../../test/gitDeBanc.mjs'
import { tableTotale } from '../../../src/lib/tableTotale.ts'

// #2475 / #2477
function bancAdresses(run) {
  const owner = mkdtempSync(join(tmpdir(), 'politique-adresses-'))
  const initial = instanceDeDepot({ fichiers: { 'a.txt': 'a' } }).racine
  const racine = join(owner, 'depot')
  renameSync(initial, racine)
  const sub = join(racine, 'sub')
  const lexical = join(owner, 'lexical')
  const alias = join(lexical, 'alias')
  mkdirSync(sub)
  mkdirSync(lexical)
  symlinkSync(sub, alias, 'junction')
  const avant = tableTotale(['HOME', 'XDG_CONFIG_HOME', 'GIT_CONFIG_GLOBAL', 'GIT_CONFIG_SYSTEM', 'GIT_CONFIG_NOSYSTEM'], k => process.env[k])
  const env = envDeDepotForge()
  for (const k of Object.keys(avant)) { if (env[k] === undefined) delete process.env[k]; else process.env[k] = env[k] }
  try {
    for (const nom of ['root.tmp', 'sub.tmp', 'parent.tmp', 'lexical.tmp']) writeFileSync(join(sub, nom), nom)
    const inventaire = cwd => {
      const vu = resultatDeGit(['ls-files', '--others', '--ignored', '--exclude-standard', '-z'], { cwd, env: process.env })
      assert.equal(vu.status, 0, vu.stderr)
      assert.equal(vu.stderr, '')
      return vu.stdout.split('\0').filter(Boolean)
    }
    run({ owner, racine, sub, lexical, alias, inventaire })
  } finally {
    for (const [k, v] of Object.entries(avant)) { if (v === undefined) delete process.env[k]; else process.env[k] = v }
    rmSync(owner, { recursive: true, force: true })
  }
}

for (const valeur of ['global', '../global']) {
  // #2475 / #2477
  test(`adresse effective : ${valeur} depuis root, sub et alias signe le fichier lu par Git`, () => bancAdresses(({ owner, racine, sub, lexical, alias, inventaire }) => {
    lancerGit(['config', 'core.excludesFile', valeur], { cwd: racine })
    const effectif = valeur === 'global' ? join(racine, 'global') : join(owner, 'global')
    const motif = valeur === 'global' ? 'root.tmp' : 'parent.tmp'
    for (const present of [true, false]) {
      for (const [chemin, contenu] of [[join(racine, 'global'), 'root.tmp\n'], [join(sub, 'global'), 'sub.tmp\n'], [join(owner, 'global'), 'parent.tmp\n'], [join(lexical, 'global'), 'lexical.tmp\n']]) writeFileSync(chemin, contenu)
      if (!present) fs.unlinkSync(effectif)
      for (const cwd of [racine, sub, alias]) {
        const vus = inventaire(cwd)
        assert.deepEqual(vus, present ? [cwd === racine ? `sub/${motif}` : motif] : [])
        const global = perimetreDeMesure(cwd).signature.global
        assert.equal(global.chemin, effectif)
        assert.equal(global.hash, present ? createHash('sha256').update(fs.readFileSync(effectif)).digest('hex') : null)
        const avant = global.hash
        writeFileSync(join(sub, 'global'), 'autre.tmp\n')
        assert.equal(perimetreDeMesure(cwd).signature.global.hash, avant)
      }
    }
  }))
}

// #2475 / #2477
test('adresse effective : HOME et XDG relatifs suivent la racine Git physique', () => bancAdresses(({ owner, racine, sub, lexical, alias, inventaire }) => {
  for (const type of ['HOME', 'XDG']) {
    process.env.HOME = type === 'HOME' ? 'home' : join(owner, 'home-absolu')
    if (type === 'XDG') process.env.XDG_CONFIG_HOME = 'cfg'
    else delete process.env.XDG_CONFIG_HOME
    const suffixe = type === 'XDG' ? 'cfg/git/ignore' : 'home/.config/git/ignore'
    for (const [base, motif] of [[racine, 'root.tmp'], [sub, 'sub.tmp'], [lexical, 'lexical.tmp']]) {
      const chemin = join(base, suffixe)
      mkdirSync(join(chemin, '..'), { recursive: true })
      writeFileSync(chemin, motif + '\n')
    }
    for (const cwd of [racine, sub, alias]) {
      assert.deepEqual(inventaire(cwd), [cwd === racine ? 'sub/root.tmp' : 'root.tmp'])
      assert.equal(politiqueExclusionsDe(depotDe(cwd)).global.chemin, join(racine, suffixe))
    }
  }
}))

test('canonisation stricte : absence normale, ancêtre et cible physique illisibles', () => {
  const base = mkdtempSync(join(tmpdir(), 'wfrp-canon-strict-'))
  const stat = fs.statSync
  const realpath = fs.realpathSync.native
  try {
    assert.equal(canoniser(join(base, 'absent/x'), { strict: true }), join(realpath(base), 'absent/x'))
    for (const code of ['EACCES', 'EPERM']) {
      fs.statSync = () => { throw Object.assign(new Error('banc'), { code }) }
      assert.throws(() => ancetreExistant(base, { strict: true }), new RegExp(`ancêtre illisible.*${code}`))
      fs.statSync = stat
      fs.realpathSync.native = () => { throw Object.assign(new Error('banc'), { code }) }
      assert.throws(() => canoniser(base, { strict: true }), new RegExp(`canonisation physique illisible.*${code}`))
      assert.equal(canoniser(base), base)
      fs.realpathSync.native = realpath
    }
    fs.realpathSync.native = (chemin) => {
      if (chemin === base) throw Object.assign(new Error('disparu'), { code: 'ENOENT' })
      return realpath(chemin)
    }
    assert.equal(canoniser(base, { strict: true }), join(realpath(join(base, '..')), base.split(/[\\/]/).at(-1)))
  } finally {
    fs.statSync = stat
    fs.realpathSync.native = realpath
    rmSync(base, { recursive: true, force: true })
  }
})

test('canoniser : un chemin absent SOUS une jonction rend la cible réelle + le reste', () => {
  const base = mkdtempSync(join(tmpdir(), 'wfrp-canon-'))
  try {
    const cible = join(base, 'cible')
    mkdirSync(cible)
    const jonction = join(base, 'lien')
    symlinkSync(cible, jonction, 'junction')
    assert.equal(canoniser(join(jonction, 'absent', 'x.md')), join(realpathSync.native(cible), 'absent', 'x.md'))
  } finally {
    rmSync(base, { recursive: true, force: true })
  }
})

test('ancetreExistant : racine existante, lecteur absent et préfixes UNC', () => {
  const base = mkdtempSync(join(tmpdir(), 'wfrp-racines-'))
  try {
    const script = join(base, 'racines.mjs')
    writeFileSync(script, [
      "import assert from 'node:assert/strict'",
      "import fs from 'node:fs'",
      "import path from 'node:path'",
      "import { tmpdir } from 'node:os'",
      `import { ancetreExistant } from ${JSON.stringify(new URL('./chemin-mesure.mjs', import.meta.url).href)}`,
      'const racine = path.resolve(tmpdir(), path.sep)',
      'assert.equal(ancetreExistant(racine), racine)',
      "assert.equal(ancetreExistant(path.join(racine, 'wfrp-absent-' + process.pid, 'a', 'b')), racine)",
      "if (process.platform === 'win32') {",
      "  const absent = ['Z:\\\\', 'Y:\\\\', 'X:\\\\'].find((r) => !fs.existsSync(r))",
      '  assert.ok(absent)',
      '  assert.equal(ancetreExistant(absent), null)',
      "  assert.equal(ancetreExistant(path.join(absent, 'wfrp', 'absent')), null)",
      "  const probes = []; const original = fs.existsSync",
      "  fs.existsSync = (p) => { probes.push(p); return p === '\\\\\\\\serveur\\\\partage\\\\' }",
      "  try { assert.equal(ancetreExistant('\\\\\\\\serveur\\\\partage\\\\a\\\\b'), '\\\\\\\\serveur\\\\partage\\\\') } finally { fs.existsSync = original }",
      "  assert.deepEqual(probes, ['\\\\\\\\serveur\\\\partage\\\\a\\\\b', '\\\\\\\\serveur\\\\partage\\\\a', '\\\\\\\\serveur\\\\partage\\\\'])",
      '}',
    ].join('\n'))
    const vu = spawnSync(process.execPath, [script], { encoding: 'utf8' })
    assert.equal(vu.status, 0, `${vu.stdout}${vu.stderr}`)
  } finally { rmSync(base, { recursive: true, force: true }) }
})

test('ancetreExistant : le chemin lui-même s’il existe, son ancêtre sinon', () => {
  const base = mkdtempSync(join(tmpdir(), 'wfrp-canon-'))
  try {
    assert.equal(ancetreExistant(base), base)
    assert.equal(ancetreExistant(join(base, 'a', 'b.md')), base)
  } finally {
    rmSync(base, { recursive: true, force: true })
  }
})

test('politique : sorties ignorées stables, règles imbriquées et exclude attestés', () => {
  const { racine } = instanceDeDepot({ fichiers: { '.gitignore': 'cache/\n*.md\n', 'data/source.txt': 'source' } })
  try {
    const signature = () => perimetreDeMesure(racine).signature
    const initiale = signature()
    mkdirSync(join(racine, 'cache'))
    writeFileSync(join(racine, 'cache', 'sortie.md'), 'sortie')
    writeFileSync(join(racine, 'doc.md'), 'doc')
    assert.deepEqual(signature(), initiale)
    writeFileSync(join(racine, 'data', '.gitignore'), '*.txt\n!source.txt\n')
    const imbriquee = signature()
    assert.notDeepEqual(imbriquee, initiale)
    writeFileSync(join(racine, 'data', '.gitignore'), '*.txt\n')
    assert.notDeepEqual(signature(), imbriquee)
    const avantExclude = signature()
    writeFileSync(join(racine, '.git', 'info', 'exclude'), 'autre/\n')
    assert.notDeepEqual(signature(), avantExclude)
    assert.equal(dansLaMesure('node_modules/paquet.mjs', new Set(), new Set(['node_modules/paquet.mjs'])), false)
    assert.equal(dansLaMesure('cache/code.ts', new Set(['cache']), new Set(['cache/code.ts'])), true)
    assert.equal(dansLaMesure('cache', new Set(['cache']), new Set(['cache/code.ts'])), true)
  } finally { rmSync(racine, { recursive: true, force: true }) }
})

test('politique : global configuré avec espaces, valeur vide et standard XDG attestés', () => {
  const { racine } = instanceDeDepot({ fichiers: { '.gitignore': '', 'source.txt': 'source' } })
  const ancienXdg = process.env.XDG_CONFIG_HOME
  try {
    const xdg = join(racine, 'standard avec espaces')
    process.env.XDG_CONFIG_HOME = xdg
    mkdirSync(join(xdg, 'git'), { recursive: true })
    const signature = () => perimetreDeMesure(racine).signature
    const absente = signature()
    writeFileSync(join(xdg, 'git', 'ignore'), '*.tmp\n')
    assert.notDeepEqual(signature(), absente)
    const global = join(racine, 'global avec espaces')
    writeFileSync(global, '*.cache\n')
    lancerGit(['config', 'core.excludesFile', global], { cwd: racine })
    const configuree = signature()
    writeFileSync(global, '*.autre\n')
    assert.notDeepEqual(signature(), configuree)
    lancerGit(['config', 'core.excludesFile', ''], { cwd: racine })
    const vide = signature()
    assert.deepEqual(vide.global.configuration, [''])
    lancerGit(['config', '--unset', 'core.excludesFile'], { cwd: racine })
    assert.notDeepEqual(signature(), vide)
  } finally {
    if (ancienXdg === undefined) delete process.env.XDG_CONFIG_HOME
    else process.env.XDG_CONFIG_HOME = ancienXdg
    rmSync(racine, { recursive: true, force: true })
  }
})

test('politique : .gitignore ignoré dans un dossier admissible reste attesté', () => {
  const { racine } = instanceDeDepot({ fichiers: { '.gitignore': '**/.gitignore\n!/.gitignore\n', 'source.txt': 'source' } })
  try {
    mkdirSync(join(racine, 'neuf'))
    writeFileSync(join(racine, 'neuf', '.gitignore'), '*.txt\n')
    const avant = perimetreDeMesure(racine).signature
    writeFileSync(join(racine, 'neuf', '.gitignore'), '*.md\n')
    assert.notDeepEqual(perimetreDeMesure(racine).signature, avant)
  } finally { rmSync(racine, { recursive: true, force: true }) }
})

test('politique : racine imbriquée signe tous les .gitignore ancêtres, jonction entrante identique', () => {
  const { racine } = instanceDeDepot({ fichiers: { '.gitignore': '*.tmp\n', 'a/.gitignore': '*.cache\n', 'a/b/source.txt': 'source' } })
  const alias = mkdtempSync(join(tmpdir(), 'politique-alias-'))
  try {
    const imbriquee = join(racine, 'a', 'b')
    const signature = perimetreDeMesure(imbriquee).signature
    assert.deepEqual(signature.fichiers.map(([rel]) => rel), ['.gitignore', 'a/.gitignore', 'a/b/.gitignore'])
    symlinkSync(imbriquee, join(alias, 'entrant'), 'junction')
    assert.deepEqual(perimetreDeMesure(join(alias, 'entrant')).signature, signature)
    writeFileSync(join(racine, '.gitignore'), '*.autre\n')
    assert.notDeepEqual(perimetreDeMesure(imbriquee).signature, signature)
  } finally { rmSync(alias, { recursive: true, force: true }); rmSync(racine, { recursive: true, force: true }) }
})

test('politique : worktree lié partage le chemin effectif info/exclude et son hash', () => {
  const { racine } = instanceDeDepot({ fichiers: { '.gitignore': '.wt-banc/\n', 'source.txt': 'source' } })
  try {
    const cible = join(racine, '.wt-banc')
    lancerGit(['worktree', 'add', '-q', '-b', 'chantier/politique', cible, 'HEAD'], { cwd: racine })
    const avant = perimetreDeMesure(racine).signature
    assert.deepEqual(perimetreDeMesure(cible).signature, avant)
    writeFileSync(join(racine, '.git', 'info', 'exclude'), '*.cache\n')
    const apres = perimetreDeMesure(cible).signature
    assert.notDeepEqual(apres, avant)
    assert.deepEqual(apres, perimetreDeMesure(racine).signature)
  } finally { rmSync(racine, { recursive: true, force: true }) }
})

test('politique : standard HOME sans XDG et .gitignore symbolique non suivi', () => {
  const { racine } = instanceDeDepot({ fichiers: { '.gitignore': '', 'source.txt': 'source' } })
  const maison = mkdtempSync(join(tmpdir(), 'politique-home-'))
  const ancienHome = process.env.HOME
  const ancienXdg = process.env.XDG_CONFIG_HOME
  try {
    process.env.HOME = maison
    delete process.env.XDG_CONFIG_HOME
    mkdirSync(join(maison, '.config', 'git'), { recursive: true })
    writeFileSync(join(maison, '.config', 'git', 'ignore'), '*.tmp\n')
    const avant = perimetreDeMesure(racine).signature
    assert.equal(avant.global.chemin, join(maison, '.config', 'git', 'ignore'))
    writeFileSync(join(maison, '.config', 'git', 'ignore'), '*.cache\n')
    assert.notDeepEqual(perimetreDeMesure(racine).signature, avant)
    mkdirSync(join(racine, 'symbolique'))
    symlinkSync(maison, join(racine, 'symbolique', '.gitignore'), 'junction')
    const symbolique = perimetreDeMesure(racine).signature
    assert.deepEqual(symbolique.fichiers.find(([rel]) => rel === 'symbolique/.gitignore')[1], { lien: fs.readlinkSync(join(racine, 'symbolique', '.gitignore')) })
    writeFileSync(join(maison, 'cible.txt'), 'changement externe')
    assert.deepEqual(perimetreDeMesure(racine).signature, symbolique)
  } finally {
    if (ancienHome === undefined) delete process.env.HOME; else process.env.HOME = ancienHome
    if (ancienXdg === undefined) delete process.env.XDG_CONFIG_HOME; else process.env.XDG_CONFIG_HOME = ancienXdg
    rmSync(racine, { recursive: true, force: true }); rmSync(maison, { recursive: true, force: true })
  }
})

test('politique : lecture et configuration refusées ne deviennent pas des absences', () => {
  const { racine } = instanceDeDepot({ fichiers: { '.gitignore': '', 'source.txt': 'source' } })
  const lire = fs.readFileSync
  try {
    fs.readFileSync = function (p, ...args) {
      if (String(p) === join(racine, '.gitignore')) throw Object.assign(new Error('témoin EACCES'), { code: 'EACCES' })
      return lire.call(this, p, ...args)
    }
    assert.throws(() => perimetreDeMesure(racine), /témoin EACCES/)
    fs.readFileSync = lire
    writeFileSync(join(racine, '.git', 'config'), '[configuration invalide\n')
    assert.throws(() => perimetreDeMesure(racine))
  } finally { fs.readFileSync = lire; rmSync(racine, { recursive: true, force: true }) }
})

test('confinement : jonction sortante rejetée et ses règles jamais lues', () => {
  const { racine } = instanceDeDepot({ fichiers: { '.gitignore': '', 'source.txt': 'source' } })
  const dehors = mkdtempSync(join(tmpdir(), 'politique-dehors-'))
  try {
    writeFileSync(join(dehors, '.gitignore'), '*.cache\n')
    symlinkSync(dehors, join(racine, 'sortant'), 'junction')
    assert.equal(relatifSousRacine(canoniser(racine), join(racine, 'sortant', '.gitignore')), null)
    const avant = perimetreDeMesure(racine).signature
    writeFileSync(join(dehors, '.gitignore'), '*.autre\n')
    assert.deepEqual(perimetreDeMesure(racine).signature, avant)
    assert.ok(!avant.fichiers.some(([rel]) => rel === 'sortant/.gitignore'))
  } finally { rmSync(racine, { recursive: true, force: true }); rmSync(dehors, { recursive: true, force: true }) }
})
