// Le pre-commit LÉGER (#2327) : il ne REFUSE qu'au nom de l'intégrité (A8) — arbre imbriqué, lock npm
// amputé, fins de ligne, lecture de l'index en panne —, AVERTIT des gardes de forme en sortant en 0, ne lance AUCUNE étape lourde, ne juge
// que l'apport d'une fusion (#2328 A7) et journalise son exécution (#2194).
//   node --test scripts/git-hooks/pre-commit.test.mjs   (chaîné dans `npm run test:hooks`)
// Chaque cas joue le HOOK réel dans un dépôt FORGÉ (`instanceDeDepot`, sous os.tmpdir(), `rmSync` en
// finally) : l'arbre du dépôt n'est jamais écrit.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { envDeDepotForge, envGitFeint, instanceDeDepot } from '../guards/lib/depotGabarit.mjs'
import { CHEMIN_DU_JOURNAL } from './journal.mjs'
import { lancerGit } from '../test/gitDeBanc.mjs'
import { tableTotale } from '../../src/lib/tableTotale.ts'

const HOOK = fileURLToPath(new URL('./pre-commit.mjs', import.meta.url))

/** Le module ESM qui dépose le TÉMOIN `nom` dans le cwd quand il est lancé. */
const temoin = (nom) => `import { writeFileSync } from 'node:fs'\nwriteFileSync('temoin-${nom}', '')\n`
/** Les étapes LOURDES de #2327 §0, chacune remplacée par son témoin : les scripts npm, et les scripts
 *  joués par leur chemin. */
const SCRIPTS_NPM = ['agents:check', 'test:raw', 'test:recette']
const SCRIPTS_PAR_CHEMIN = [
  'scripts/docs/check-doc-refs.mjs',
  'scripts/docs/check-plans-anchors.mjs',
  'scripts/raw/build-implemente.mjs',
  'scripts/docs/build-doctrines.mjs',
  'scripts/guards/validate-data.mts',
  'scripts/rig/compile-dessin-quad.mts',
]
/** Un chemin stagé par déclencheur d'étape lourde (#2327 §0). */
const DECLENCHEURS = {
  'docs/architecture.md': '# a\n',
  'docs/raw/4e/talents.md': '# t\n',
  '.claude/memory/user-x.md': '---\nname: user-x\ndescription: "d"\n---\n\nrègle\n',
  'src/data/etats.json': '{}\n',
  'src/gameIso/rig/quadruped/atelier/boeuf-profile.dessin.mts': 'export const DESSIN = []\n',
  'scripts/recette/x.mjs': 'export const x = 1\n',
  'scripts/raw/x.mjs': 'export const x = 1\n',
  '.codex/hooks.json': '{}\n',
}

/** Un dépôt forgé dont les étapes lourdes sont des TÉMOINS ; `stages` (chemin → texte) posés dans
 *  l'INDEX seul (`update-index --cacheinfo`, sous `core.protectNTFS=false` : un nom que NTFS refuse
 *  s'y stage aussi) ; `jouer(env)` lance le HOOK réel dans ce dépôt. */
function depotDuHook(stages) {
  const env = envDeDepotForge()
  const scripts = tableTotale(SCRIPTS_NPM, (s) => `node -e "require('fs').writeFileSync('temoin-${s.replace(':', '-')}', '')"`)
  const { racine } = instanceDeDepot({
    fichiers: {
      '.gitattributes': '* text=auto eol=lf\n',
      'package.json': JSON.stringify({ scripts }),
      ...tableTotale(SCRIPTS_PAR_CHEMIN, (c) => temoin(c.split('/').pop())),
    },
    message: 'socle',
  })
  lancerGit(['config', '--local', 'core.protectNTFS', 'false'], { cwd: racine, env })
  for (const [nom, texte] of Object.entries(stages)) {
    const blob = lancerGit(['hash-object', '-w', '--stdin'], { cwd: racine, env, input: texte, net: true })
    lancerGit(['update-index', '--add', '--cacheinfo', `100644,${blob},${nom}`], { cwd: racine, env })
  }
  const jouer = (envDuHook = env) => spawnSync(process.execPath, [HOOK], { cwd: racine, env: envDuHook, encoding: 'utf8', timeout: 120_000 })
  return { racine, env, jouer }
}

const lignes = (r) => r.stderr.split('\n').map((l) => l.trim())
/** Les témoins déposés dans `racine`. */
const temoinsDe = (racine) => [...SCRIPTS_NPM.map((s) => s.replace(':', '-')), ...SCRIPTS_PAR_CHEMIN.map((c) => c.split('/').pop())]
  .filter((nom) => existsSync(join(racine, `temoin-${nom}`)))

test('CONTRÔLE POSITIF des témoins : chaque étape lourde LANCÉE dépose le sien', () => {
  const { racine, env } = depotDuHook({})
  try {
    for (const s of SCRIPTS_NPM) {
      const r = spawnSync('npm', ['run', s], { cwd: racine, env, encoding: 'utf8', shell: process.platform === 'win32', timeout: 60_000 })
      assert.equal(r.status, 0, r.stdout + r.stderr)
    }
    for (const c of SCRIPTS_PAR_CHEMIN) {
      const r = spawnSync(process.execPath, [join(racine, c)], { cwd: racine, env, encoding: 'utf8', timeout: 60_000 })
      assert.equal(r.status, 0, r.stdout + r.stderr)
    }
    assert.deepEqual(temoinsDe(racine), [...SCRIPTS_NPM.map((s) => s.replace(':', '-')), ...SCRIPTS_PAR_CHEMIN.map((c) => c.split('/').pop())])
  } finally {
    rmSync(racine, { recursive: true, force: true })
  }
})

test('AUCUNE étape lourde : chaque déclencheur de #2327 §0 stagé, aucun témoin déposé, exit 0', () => {
  const { racine, jouer } = depotDuHook(DECLENCHEURS)
  try {
    const r = jouer()
    assert.equal(r.status, 0, r.stderr)
    assert.ok(r.stderr.includes(`[pre-commit] ${Object.keys(DECLENCHEURS).length} fichier(s) stagé(s)`), r.stderr)
    assert.deepEqual(temoinsDe(racine), [], r.stdout + r.stderr)
  } finally {
    rmSync(racine, { recursive: true, force: true })
  }
})

test('FORME — une pierre tombale stagée est AVERTIE (site, geste, step de CI), et le commit passe', () => {
  const { racine, jouer } = depotDuHook({ 'scripts/a.mjs': `// ${'ancienne'}ment x\nexport const x = 1\n` })
  try {
    const r = jouer()
    assert.equal(r.status, 0, r.stderr)
    assert.ok(lignes(r).some((l) => l.startsWith('pre-commit — AVERTISSEMENT [pierre tombale] : corriger avant de pousser, la CI refuse — suite (`npm test`)')), r.stderr)
    assert.ok(lignes(r).some((l) => l.startsWith('scripts/a.mjs:1 ')), r.stderr)
    assert.ok(!r.stderr.includes('REFUSÉ'), r.stderr)
  } finally {
    rmSync(racine, { recursive: true, force: true })
  }
})

test('FORME — le lint d’un fichier stagé est AVERTI, et le commit passe (sa cause nommée : eslint absent du dépôt forgé)', () => {
  const { racine, jouer } = depotDuHook({ 'src/a.ts': 'export const a = 1\n' })
  try {
    const r = jouer()
    assert.equal(r.status, 0, r.stderr)
    assert.ok(lignes(r).some((l) => l.startsWith('pre-commit — AVERTISSEMENT [lint] : corriger avant de pousser, la CI refuse — types (`npm run lint`)')), r.stderr)
    assert.ok(lignes(r).some((l) => l.startsWith('(lint) [erreur] (outillage)')), r.stderr)
    assert.ok(r.stderr.includes("eslint n'est pas installé dans cet arbre"), r.stderr)
  } finally {
    rmSync(racine, { recursive: true, force: true })
  }
})

test('INTÉGRITÉ — un chemin stagé sous un arbre git IMBRIQUÉ est REFUSÉ, nommé', () => {
  const { racine, jouer } = depotDuHook({ 'sous/a.txt': 'a\n' })
  try {
    mkdirSync(join(racine, 'sous'))
    writeFileSync(join(racine, 'sous', '.git'), 'gitdir: ailleurs\n')
    const r = jouer()
    assert.equal(r.status, 1, r.stderr)
    assert.ok(lignes(r).some((l) => l.startsWith('worktree/clone imbriqué stagé : sous ')), r.stderr)
  } finally {
    rmSync(racine, { recursive: true, force: true })
  }
})

test('la baseline nominative se lit dans l’INDEX : stagée, elle juge ; posée sur le disque seul, elle ne compte pas', () => {
  const baseline = 'scripts/guards/lib/decisions-baseline.json'
  const texte = `${JSON.stringify({ sites: [{ fichier: 'scripts/a.mjs', motif: 'motif-de-banc', ancre: 'zzz', raison: 'r', date: '2026-01-01' }] })}\n`
  const perimee = "baseline périmée — purger l'entrée : scripts/a.mjs — motif-de-banc"
  const stagee = depotDuHook({ 'scripts/a.mjs': 'export const a = 1\n', [baseline]: texte })
  try {
    const r = stagee.jouer()
    assert.equal(r.status, 0, r.stderr)
    assert.ok(lignes(r).some((l) => l.startsWith(perimee)), r.stderr)
  } finally {
    rmSync(stagee.racine, { recursive: true, force: true })
  }
  const surDisque = depotDuHook({ 'scripts/a.mjs': 'export const a = 1\n' })
  try {
    mkdirSync(join(surDisque.racine, 'scripts', 'guards', 'lib'), { recursive: true })
    writeFileSync(join(surDisque.racine, baseline), texte)
    const r = surDisque.jouer()
    assert.equal(r.status, 0, r.stderr)
    assert.ok(!r.stderr.includes(perimee), r.stderr)
  } finally {
    rmSync(surDisque.racine, { recursive: true, force: true })
  }
})

/** Un `package-lock.json` qui référence `@napi-rs/wasm-runtime`, avec ou sans ses entrées hoistées. */
const lock = (complet) => `${JSON.stringify({
  lockfileVersion: 3,
  packages: {
    '': {},
    'node_modules/@napi-rs/wasm-runtime': { version: '1.1.6' },
    ...(complet ? { 'node_modules/@emnapi/core': { version: '1.0.0' }, 'node_modules/@emnapi/runtime': { version: '1.0.0' } } : {}),
  },
}, null, 2)}\n`

test('INTÉGRITÉ — un lock npm AMPUTÉ des entrées hoistées est REFUSÉ, nommé ; complet, il passe', () => {
  for (const [complet, code] of [[false, 1], [true, 0]]) {
    const { racine, jouer } = depotDuHook({ 'package-lock.json': lock(complet) })
    try {
      const r = jouer()
      assert.equal(r.status, code, r.stderr)
      assert.equal(lignes(r).some((l) => l.startsWith('package-lock.json:') && l.includes('[lock npm amputé]')), !complet, r.stderr)
    } finally {
      rmSync(racine, { recursive: true, force: true })
    }
  }
})

test('INTÉGRITÉ — un blob stagé en CRLF sous `eol=lf` est REFUSÉ, nommé ; en LF, il passe', () => {
  for (const [texte, code] of [['a\r\nb\r\n', 1], ['a\nb\n', 0]]) {
    const { racine, jouer } = depotDuHook({ 'notes/fin.txt': texte })
    try {
      const r = jouer()
      assert.equal(r.status, code, r.stderr)
      assert.equal(r.stderr.includes('notes/fin.txt (i/crlf)'), code === 1, r.stderr)
    } finally {
      rmSync(racine, { recursive: true, force: true })
    }
  }
})

test('INTÉGRITÉ — un nom stagé que `lireEnLot` refuse (tabulation) est un fautif NOMMÉ, et le commit est refusé', () => {
  const nom = 'src/x\t.ts'
  const { racine, jouer } = depotDuHook({ [nom]: 'export const x = 1\n' })
  try {
    const r = jouer()
    assert.equal(r.status, 1, r.stderr)
    assert.ok(lignes(r).some((l) => l.startsWith(`${nom} : illisible dans l'index — lireEnLot :`)), r.stderr)
  } finally {
    rmSync(racine, { recursive: true, force: true })
  }
})

test('INTÉGRITÉ — une PANNE de git sur le diff du lot est un fautif NOMMÉ, et le commit est refusé', () => {
  const { racine, env, jouer } = depotDuHook({ 'notes.txt': 'n\n' })
  try {
    const r = jouer({ ...env, ...envGitFeint([{ si: ['diff-index', '-p'], status: 128, stderr: 'fatal: panne simulée\n' }]) })
    assert.equal(r.status, 1, r.stderr)
    assert.ok(lignes(r).some((l) => l.startsWith('diff du lot illisible — ') && l.includes('panne simulée')), r.stderr)
  } finally {
    rmSync(racine, { recursive: true, force: true })
  }
})

test('journal : une ligne par exécution, refus nommés compris', () => {
  const nom = 'src/x\t.ts'
  const { racine, jouer } = depotDuHook({ [nom]: 'export const x = 1\n' })
  try {
    assert.equal(jouer().status, 1)
    const entrees = readFileSync(join(racine, CHEMIN_DU_JOURNAL), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l))
    assert.equal(entrees.length, 1)
    const [{ hook, code, verdict, refus }] = entrees
    assert.deepEqual({ hook, code, verdict }, { hook: 'pre-commit', code: 1, verdict: 'refusé' })
    assert.ok(refus.some((x) => x.startsWith(`${nom} : illisible dans l'index`)), refus.join('\n'))
  } finally {
    rmSync(racine, { recursive: true, force: true })
  }
})

test('#2328 A7 — sous une fusion en cours, le hook ne juge que l’APPORT : le poison que main apporte seul n’est pas rapporté, le même poison dans la résolution l’est', () => {
  const env = envDeDepotForge()
  const { racine } = instanceDeDepot({ fichiers: { 'package.json': '{}\n', 'notes/a.md': 'a\n' }, message: 'socle' })
  const git = (...args) => lancerGit(args, { cwd: racine, env })
  const poison = (nom) => `// ${'ancienne'}ment ${nom}\nexport const x = 1\n`
  try {
    const courante = git('rev-parse', '--abbrev-ref', 'HEAD').trim()
    git('checkout', '-q', '-b', 'amont')
    mkdirSync(join(racine, 'scripts'))
    writeFileSync(join(racine, 'scripts', 'main.mjs'), poison('main')); git('add', '-A'); git('commit', '-q', '-m', 'main')
    git('checkout', '-q', courante)
    writeFileSync(join(racine, 'notes', 'c.md'), 'c\n'); git('add', '-A'); git('commit', '-q', '-m', 'chantier')
    git('merge', '--no-commit', '--no-ff', 'amont')
    assert.ok(existsSync(join(racine, '.git', 'MERGE_HEAD')), 'témoin : fusion en cours')
    writeFileSync(join(racine, 'scripts', 'resolu.mjs'), poison('resolu')); git('add', '-A')
    const r = spawnSync(process.execPath, [HOOK], { cwd: racine, env, encoding: 'utf8', timeout: 120_000 })
    assert.equal(r.status, 0, r.stderr)
    assert.ok(lignes(r).some((l) => l.startsWith('scripts/resolu.mjs:1 ')), r.stderr)
    assert.ok(!r.stderr.includes('scripts/main.mjs'), r.stderr)
  } finally {
    rmSync(racine, { recursive: true, force: true })
  }
})
