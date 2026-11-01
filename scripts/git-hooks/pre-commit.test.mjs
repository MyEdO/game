// Le pre-commit LÉGER (#2327) : il ne REFUSE qu'au nom de l'intégrité (A8) — arbre imbriqué, lock npm
// amputé, fins de ligne, lecture de l'index en panne —, AVERTIT des gardes de forme en sortant en 0, ne lance AUCUNE étape lourde, ne juge
// que l'apport d'une fusion (#2328 A7) et journalise son exécution (#2194).
//   node --test scripts/git-hooks/pre-commit.test.mjs   (chaîné dans `npm run test:hooks`)
// Chaque cas joue le HOOK réel dans un dépôt FORGÉ (`instanceDeDepot`, sous os.tmpdir(), `rmSync` en
// finally) : l'arbre du dépôt n'est jamais écrit.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, sep } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { envDeDepotForge, envGitFeint, instanceDeDepot } from '../guards/lib/depotGabarit.mjs'
import { journalDe } from './journal.mjs'
import { lancerGit, resultatDeGit } from '../test/gitDeBanc.mjs'
import { tableTotale } from '../../src/lib/tableTotale.ts'
import { transformSkillTree } from '../agents/compat-core.mjs'
import { clotureDImports } from '../guards/lib/importGraph.mjs'

const HOOK = fileURLToPath(new URL('./pre-commit.mjs', import.meta.url))
/** Le script `lint` du dépôt : le lint du hook en lit l'appel (`appelDuLint`). */
const SCRIPT_LINT = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8')).scripts.lint

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
]
/** Un chemin stagé par déclencheur d'étape lourde (#2327 §0). */
const DECLENCHEURS = {
  'docs/architecture.md': '# a\n',
  'docs/raw/4e/talents.md': '# t\n',
  '.claude/memory/user-x.md': '---\nname: user-x\ndescription: "d"\n---\n\nrègle\n',
  'src/data/etats.json': '{}\n',
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
      'package.json': JSON.stringify({ scripts: { ...scripts, lint: SCRIPT_LINT } }),
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

test('FORME — le lint d’un fichier stagé est AVERTI, et le commit passe (sa cause nommée : oxlint absent du dépôt forgé)', () => {
  const { racine, jouer } = depotDuHook({ 'src/a.ts': 'export const a = 1\n' })
  try {
    const r = jouer()
    assert.equal(r.status, 0, r.stderr)
    assert.ok(lignes(r).some((l) => l.startsWith('pre-commit — AVERTISSEMENT [lint] : corriger avant de pousser, la CI refuse — types (`npm run lint`)')), r.stderr)
    assert.ok(lignes(r).some((l) => l.startsWith('(lint) [erreur] (outillage)')), r.stderr)
    assert.ok(r.stderr.includes('oxlint a échoué sans rapport'), r.stderr)
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

test('journal : un début et une fin par exécution sous le git-dir du dépôt, refus nommés compris', () => {
  const nom = 'src/x\t.ts'
  const { racine, jouer } = depotDuHook({ [nom]: 'export const x = 1\n' })
  try {
    assert.equal(jouer().status, 1)
    const entrees = readFileSync(journalDe(racine), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l))
    assert.deepEqual(entrees.map((e) => e.evenement), ['debut', 'fin'])
    const [, { hook, code, verdict, refus }] = entrees
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

// ── #2578 : le pre-commit PRODUIT les miroirs d'agents, lus dans l'index ──────────────────────────────
const SOURCE = '.claude/skills/x/SKILL.md'
const MIROIR = '.agents/skills/x/SKILL.md'
const REGISTRE = 'scripts/hooks/registre.mjs'
const NOYAU = 'scripts/agents/compat-core.mjs'
const skill = (corps) => `---\nname: x\ndescription: "d"\n---\n\n${corps}\n`
/** Le miroir que `runCompat` dérive du texte `source` de SOURCE (`transformSkillTree`, son producteur). */
const derive = (source) => transformSkillTree(new Map([[SOURCE, Buffer.from(source)]])).get(MIROIR).toString('utf8')
/** Un registre forgé (`ENTREES_OUTIL`, `registre.mjs` → `REGISTRE`) dont les gardes portent `outils`. */
const registre = (...outils) => `export const REGISTRE = { PreToolUse: [${outils.map((o) => `{ outils: ['${o}'] }`).join(', ')}] }\n`
/** Une donnée JSON de la clôture du producteur : les `outils` que lit le registre `REGISTRE_LECTEUR`. */
const DONNEE = 'scripts/hooks/outils.json'
const REGISTRE_LECTEUR = "import outils from './outils.json' with { type: 'json' }\nexport const REGISTRE = { PreToolUse: [{ outils }] }\n"

const RACINE = fileURLToPath(new URL('../..', import.meta.url))
/** Le dossier des hooks RÉELS (`core.hooksPath` du dépôt). */
const CROCHETS = fileURLToPath(new URL('.', import.meta.url))
/** Le point d'entrée des post-hooks forgés : les miroirs d'agents seuls (`jouerLesMiroirs`), sans les cibles ni les
 *  docs de `docs-rebuild.mjs`, hors de ce dépôt. */
const MIROIRS_SEULS = 'miroirs-seuls.mjs'
/** Les hooks RÉELS que #2578 câble, posés dans le dossier `crochets` d'un dépôt forgé : leur texte,
 *  `docs-rebuild.mjs` remplacé par `MIROIRS_SEULS` de `crochets`, le reste de `$(dirname "$0")` résolu vers `CROCHETS`. */
const HOOKS_DES_MIROIRS = ['pre-commit', 'post-commit', 'post-merge', 'post-rewrite']
const hookForge = (nom, crochets) => readFileSync(join(CROCHETS, nom), 'utf8')
  .replaceAll('"$(dirname "$0")/docs-rebuild.mjs"', `"${join(crochets, MIROIRS_SEULS).replaceAll(sep, '/')}"`)
  .replaceAll('"$(dirname "$0")/', `"${CROCHETS.replaceAll(sep, '/')}`)
/** Le producteur (clôture d'imports de `compat-cli.mjs`), commis dans chaque dépôt forgé : le hook charge
 *  celui du dépôt qui commet. */
const PRODUCTEUR = tableTotale([...clotureDImports(['scripts/agents/compat-cli.mjs'], { racine: RACINE })], (rel) => readFileSync(join(RACINE, rel), 'utf8'))

/** Un dépôt forgé qui porte le producteur (`PRODUCTEUR`) et `fichiers`, dont les hooks réels de #2578
 *  (`hookForge`) sont posés (`core.hooksPath` hors de l'arbre), le skill `x` commis à travers eux ;
 *  `git(...)` y joue git. */
function depotAuSkill(fichiers = {}) {
  const env = envDeDepotForge()
  const { racine } = instanceDeDepot({ fichiers: { '.gitattributes': '* text=auto eol=lf\n', '.gitignore': 'node_modules/\n', 'notes.txt': 'n\n', ...PRODUCTEUR, ...fichiers }, message: 'socle' })
  const crochets = mkdtempSync(join(tmpdir(), 'crochets-'))
  writeFileSync(join(crochets, MIROIRS_SEULS), `import { jouerLesMiroirs } from ${JSON.stringify(pathToFileURL(join(CROCHETS, 'miroirs-d-agents.mjs')).href)}\nawait jouerLesMiroirs(process.argv[2])\n`)
  for (const nom of HOOKS_DES_MIROIRS) {
    writeFileSync(join(crochets, nom), hookForge(nom, crochets))
    chmodSync(join(crochets, nom), 0o755)
  }
  const git = (...args) => lancerGit(args, { cwd: racine, env })
  git('config', '--local', 'core.hooksPath', crochets.replaceAll(sep, '/'))
  mkdirSync(join(racine, '.claude', 'skills', 'x'), { recursive: true })
  writeFileSync(join(racine, SOURCE), skill('v1'))
  git('add', '--', SOURCE); git('commit', '-q', '-m', 'skill')
  const ecrire = (rel, texte) => { mkdirSync(join(racine, rel, '..'), { recursive: true }); writeFileSync(join(racine, rel), texte) }
  const fin = () => { rmSync(racine, { recursive: true, force: true }); rmSync(crochets, { recursive: true, force: true }) }
  const jouer = (...args) => resultatDeGit(args, { cwd: racine, env })
  return { racine, git, ecrire, jouer, fin, lire: (rel) => readFileSync(join(racine, rel), 'utf8'), statut: () => git('status', '--porcelain', '--untracked-files=all') }
}

test('#2578 (a) — un commit qui modifie un skill commet son miroir dérivé de la source de HEAD, statut vide', () => {
  const d = depotAuSkill()
  try {
    assert.equal(d.git('show', `HEAD:${MIROIR}`), derive(skill('v1')), 'socle : le miroir naît avec le skill')
    d.ecrire(SOURCE, skill('v2')); d.git('add', '--', SOURCE); d.git('commit', '-q', '-m', 'v2')
    assert.equal(d.git('show', `HEAD:${MIROIR}`), derive(d.git('show', `HEAD:${SOURCE}`)))
    assert.ok(d.git('show', `HEAD:${MIROIR}`).includes('v2'))
    assert.equal(d.statut(), '')
  } finally {
    d.fin()
  }
})

test('#2578 (b) — sous un staging PARTIEL, le miroir commis dérive de la version STAGÉE, pas du disque', () => {
  const d = depotAuSkill()
  try {
    d.ecrire(SOURCE, skill('stagee')); d.git('add', '--', SOURCE)
    d.ecrire(SOURCE, skill('disque'))
    d.git('commit', '-q', '-m', 'partiel')
    assert.equal(d.git('show', `HEAD:${SOURCE}`), skill('stagee'))
    assert.equal(d.git('show', `HEAD:${MIROIR}`), derive(skill('stagee')))
    assert.equal(d.statut(), ` M ${SOURCE}\n`)
  } finally {
    d.fin()
  }
})

test('#2578 (c) — `git commit -- <chemin>` : le miroir de HEAD dérive de la source commise, et l’index réel égale HEAD', () => {
  const d = depotAuSkill()
  try {
    d.ecrire(SOURCE, skill('seul'))
    d.git('commit', '-q', '-m', 'seul', '--', SOURCE)
    assert.equal(d.git('show', `HEAD:${MIROIR}`), derive(skill('seul')))
    assert.equal(d.git('diff', '--cached', '--name-only'), '')
    assert.equal(d.statut(), '')
  } finally {
    d.fin()
  }
})

test('#2578 (c-i) — miroir déjà stagé à une version INTERMÉDIAIRE, puis `commit -- <source>` : le post-commit le reproduit, index réel = HEAD', () => {
  const d = depotAuSkill()
  try {
    d.ecrire(SOURCE, skill('v2')); d.ecrire(MIROIR, derive(skill('v2'))); d.git('add', '--', SOURCE, MIROIR)
    d.ecrire(SOURCE, skill('v3'))
    d.git('commit', '-q', '-m', 'v3', '--', SOURCE)
    assert.equal(d.git('show', `HEAD:${MIROIR}`), derive(skill('v3')))
    assert.equal(d.git('diff', '--cached', '--name-only'), '')
    assert.equal(d.statut(), '')
  } finally {
    d.fin()
  }
})

test('#2578 (c-ii) — `commit -- .claude/settings.json` : clé `hooks` dérivée du registre de l’index, `permissions` préservées, index réel = HEAD', () => {
  const d = depotAuSkill({ [REGISTRE]: registre('Bash') })
  try {
    const avant = JSON.parse(d.git('show', 'HEAD:.claude/settings.json'))
    d.ecrire('.claude/settings.json', `${JSON.stringify({ permissions: { allow: ['X'] }, hooks: {} }, null, 2)}\n`)
    d.git('commit', '-q', '-m', 'permissions', '--', '.claude/settings.json')
    const tete = JSON.parse(d.git('show', 'HEAD:.claude/settings.json'))
    assert.deepEqual(tete.permissions, { allow: ['X'] })
    assert.deepEqual(tete.hooks, avant.hooks)
    assert.equal(d.git('diff', '--cached', '--name-only'), '')
    assert.equal(d.statut(), '')
  } finally {
    d.fin()
  }
})

test('#2578 (c-iii) — `commit --amend` qui ramène un skill au parent : le miroir revient au parent, index réel = HEAD', () => {
  const d = depotAuSkill()
  try {
    d.ecrire(SOURCE, skill('v2')); d.git('add', '--', SOURCE); d.git('commit', '-q', '-m', 'v2')
    d.ecrire(SOURCE, skill('v1')); d.git('add', '--', SOURCE)
    d.git('commit', '-q', '--amend', '--allow-empty', '-m', 'retour')
    assert.equal(d.git('show', `HEAD:${MIROIR}`), derive(skill('v1')))
    assert.equal(d.git('diff', '--cached', '--name-only'), '')
    assert.equal(d.statut(), '')
  } finally {
    d.fin()
  }
})

test('#2578 (d) — un miroir édité à la main est AVERTI, le commit passe (sortie 0) et le miroir n’est pas écrasé', () => {
  const d = depotAuSkill()
  try {
    const main = '---\nname: x\ndescription: "d"\n---\n\nà la main\n'
    d.ecrire(MIROIR, main); d.ecrire(SOURCE, skill('v3')); d.git('add', '--', MIROIR, SOURCE)
    const r = d.jouer('commit', '-q', '-m', 'main')
    assert.equal(r.status, 0, r.stderr)
    assert.ok(lignes(r).some((l) => l.startsWith("pre-commit — AVERTISSEMENT [miroir d'agents édité à la main]")), r.stderr)
    assert.ok(lignes(r).includes(`skill:unsafe-overwrite:${MIROIR}: contenu divergent`), r.stderr)
    assert.equal(d.git('show', `HEAD:${MIROIR}`), main)
  } finally {
    d.fin()
  }
})

test('#2578 (D2) — un travail NON STAGÉ sur une sortie reste sur le disque ; l’index reçoit la sortie produite', () => {
  const d = depotAuSkill()
  try {
    const travail = `${derive(skill('v1'))}travail en cours\n`
    d.ecrire(MIROIR, travail)
    d.ecrire(SOURCE, skill('v2')); d.git('add', '--', SOURCE); d.git('commit', '-q', '-m', 'v2')
    assert.equal(d.git('show', `HEAD:${MIROIR}`), derive(skill('v2')))
    assert.equal(d.lire(MIROIR), travail)
  } finally {
    d.fin()
  }
})

test('#2578 (D2) — famille `hook` : `.claude/settings.json` mixte, le registre forgé de l’index fait la clé `hooks`, les `permissions` restent', () => {
  const d = depotAuSkill({ [REGISTRE]: registre('Bash'), '.claude/settings.json': `${JSON.stringify({ permissions: { allow: ['Y'] } }, null, 2)}\n` })
  try {
    d.ecrire(REGISTRE, registre('Bash', 'Read')); d.git('add', '--', REGISTRE); d.git('commit', '-q', '-m', 'Read')
    const claude = JSON.parse(d.git('show', 'HEAD:.claude/settings.json'))
    assert.deepEqual(claude.permissions, { allow: ['Y'] })
    assert.equal(claude.hooks.PreToolUse[0].matcher, 'Bash|Read')
    assert.ok(JSON.parse(d.git('show', 'HEAD:.codex/hooks.json')).hooks.PreToolUse[0].matcher.includes('Read'))
    assert.equal(d.statut(), '')
  } finally {
    d.fin()
  }
})

test('#2578 (D1) — producteur SALE (compat-core) : aucune famille produite, avertissement nommé', () => {
  const d = depotAuSkill({ [REGISTRE]: registre('Bash') })
  try {
    d.ecrire(NOYAU, `${PRODUCTEUR[NOYAU]}// sale\n`)
    d.ecrire(SOURCE, skill('v2')); d.git('add', '--', SOURCE)
    const r = d.jouer('commit', '-q', '-m', 'v2')
    assert.equal(r.status, 0, r.stderr)
    assert.ok(lignes(r).some((l) => l.startsWith("pre-commit — miroirs d'agents NON produits : le producteur (compat-cli, compat-core)") && l.includes(NOYAU)), r.stderr)
    assert.equal(d.git('show', `HEAD:${MIROIR}`), derive(skill('v1')))
  } finally {
    d.fin()
  }
})

test('#2578 (D1) — registre SALE : la famille `hook` saute, nommée ; les skills sont produits', () => {
  const d = depotAuSkill({ [REGISTRE]: registre('Bash') })
  try {
    d.ecrire(REGISTRE, registre('Bash', 'Read'))
    d.ecrire(SOURCE, skill('v2')); d.git('add', '--', SOURCE)
    const r = d.jouer('commit', '-q', '-m', 'v2')
    assert.equal(r.status, 0, r.stderr)
    assert.ok(lignes(r).some((l) => l.startsWith('pre-commit — famille `hook` NON produite') && l.includes(REGISTRE)), r.stderr)
    assert.equal(d.git('show', `HEAD:${MIROIR}`), derive(skill('v2')))
    assert.equal(JSON.parse(d.git('show', 'HEAD:.claude/settings.json')).hooks.PreToolUse[0].matcher, 'Bash')
  } finally {
    d.fin()
  }
})

test('#2578 (D1) — donnée JSON du registre SALE : la famille `hook` saute, nommée ; les skills sont produits', () => {
  const d = depotAuSkill({ [REGISTRE]: REGISTRE_LECTEUR, [DONNEE]: '["Bash"]\n' })
  try {
    d.ecrire(DONNEE, '["Bash", "Read"]\n')
    d.ecrire(SOURCE, skill('v2')); d.git('add', '--', SOURCE)
    const r = d.jouer('commit', '-q', '-m', 'v2')
    assert.equal(r.status, 0, r.stderr)
    assert.ok(lignes(r).some((l) => l.startsWith('pre-commit — famille `hook` NON produite') && l.includes(DONNEE)), r.stderr)
    assert.equal(d.git('show', `HEAD:${MIROIR}`), derive(skill('v2')))
    assert.equal(JSON.parse(d.git('show', 'HEAD:.claude/settings.json')).hooks.PreToolUse[0].matcher, 'Bash')
  } finally {
    d.fin()
  }
})

test('#2578 (D3) — import des registres en ÉCHEC : seule la famille `hook` saute, les skills sont produits', () => {
  const d = depotAuSkill({ [REGISTRE]: "throw new Error('registre cassé')\n" })
  try {
    d.ecrire(SOURCE, skill('v2')); d.git('add', '--', SOURCE)
    const r = d.jouer('commit', '-q', '-m', 'v2')
    assert.equal(r.status, 0, r.stderr)
    assert.ok(lignes(r).some((l) => l.startsWith('pre-commit — famille `hook` NON produite : import des registres') && l.includes('registre cassé')), r.stderr)
    assert.equal(d.git('show', `HEAD:${MIROIR}`), derive(skill('v2')))
  } finally {
    d.fin()
  }
})

test('#2578 (e) — une fusion SANS conflit qui touche un skill laisse HEAD cohérent', () => {
  const d = depotAuSkill()
  try {
    d.ecrire(SOURCE, skill('l1\n\nl2\n\nl3')); d.git('add', '--', SOURCE); d.git('commit', '-q', '-m', 'trois')
    const courante = d.git('rev-parse', '--abbrev-ref', 'HEAD').trim()
    d.git('checkout', '-q', '-b', 'amont')
    d.ecrire(SOURCE, skill('L1\n\nl2\n\nl3')); d.git('add', '--', SOURCE); d.git('commit', '-q', '-m', 'amont')
    d.git('checkout', '-q', courante)
    d.ecrire(SOURCE, skill('l1\n\nl2\n\nL3')); d.git('add', '--', SOURCE); d.git('commit', '-q', '-m', 'chantier')
    d.git('merge', '-q', '--no-edit', 'amont')
    assert.equal(d.git('show', `HEAD:${SOURCE}`), skill('L1\n\nl2\n\nL3'))
    assert.equal(d.git('show', `HEAD:${MIROIR}`), derive(d.git('show', `HEAD:${SOURCE}`)))
    assert.equal(d.statut(), '')
  } finally {
    d.fin()
  }
})

test('#2578 (e\') — fusion NON LOCALE sans conflit : le générateur change d’un côté, un skill de l’autre ; le post-merge produit le miroir du générateur fusionné dans l’index et le SIGNALE À COMMETTRE', () => {
  const d = depotAuSkill()
  try {
    const courante = d.git('rev-parse', '--abbrev-ref', 'HEAD').trim()
    d.git('checkout', '-q', '-b', 'amont')
    const noyau = PRODUCTEUR[NOYAU].replace('function adapt(text) {\n', "function adapt(text) {\n  text = text.replaceAll('ZZ', 'YY');\n")
    assert.notEqual(noyau, PRODUCTEUR[NOYAU], 'témoin : le générateur forgé change')
    d.ecrire(NOYAU, noyau); d.git('add', '--', NOYAU); d.git('commit', '-q', '-m', 'générateur')
    d.git('checkout', '-q', courante)
    d.ecrire(SOURCE, skill('v1\n\nZZ')); d.git('add', '--', SOURCE); d.git('commit', '-q', '-m', 'skill')
    assert.ok(d.git('show', `HEAD:${MIROIR}`).includes('ZZ'), 'témoin : le miroir du chantier dérive de l’ancien générateur')
    const fusion = d.jouer('merge', '--no-edit', 'amont')
    assert.equal(fusion.status, 0, fusion.stderr)
    assert.ok(d.git('rev-parse', '--verify', 'HEAD^2'), 'témoin : un commit de fusion')
    assert.ok(d.git('show', `HEAD:${MIROIR}`).includes('ZZ'), 'témoin : la fusion commise ne joue pas le pre-commit')
    assert.ok(lignes(fusion).some((l) => l.startsWith("[post-merge] miroirs d'agents produits dans l'index, HEAD ne les porte pas — À COMMETTRE : ") && l.includes(MIROIR)), fusion.stderr)
    const produit = d.git('show', `:${MIROIR}`)
    assert.ok(produit.includes('YY') && !produit.includes('ZZ'), produit)
    assert.equal(d.lire(MIROIR), produit)
    assert.equal(d.statut(), `M  ${MIROIR}\n`)
    d.git('commit', '-q', '-m', 'miroirs')
    assert.equal(d.git('show', `HEAD:${MIROIR}`), produit)
    assert.equal(d.statut(), '')
  } finally {
    d.fin()
  }
})

test('#2578 (f) — `rebase --continue` sur un conflit de skill ne joue pas le pre-commit : le post-rewrite produit dans l’index et le SIGNALE', () => {
  const d = depotAuSkill()
  try {
    const courante = d.git('rev-parse', '--abbrev-ref', 'HEAD').trim()
    d.git('checkout', '-q', '-b', 'sujet')
    d.ecrire(SOURCE, skill('sujet')); d.git('add', '--', SOURCE); d.git('commit', '-q', '-m', 'sujet')
    d.git('checkout', '-q', courante)
    d.ecrire(SOURCE, skill('tronc')); d.git('add', '--', SOURCE); d.git('commit', '-q', '-m', 'tronc')
    d.git('checkout', '-q', 'sujet')
    assert.notEqual(d.jouer('rebase', courante).status, 0, 'témoin : conflit')
    d.ecrire(SOURCE, skill('resolu')); d.ecrire(MIROIR, derive(skill('sujet'))); d.git('add', '--', SOURCE, MIROIR)
    const r = resultatDeGit(['-c', 'core.editor=true', 'rebase', '--continue'], { cwd: d.racine, env: { ...envDeDepotForge(), GIT_EDITOR: 'true' } })
    assert.equal(r.status, 0, r.stderr)
    assert.equal(d.git('show', `HEAD:${MIROIR}`), derive(skill('sujet')), 'le pre-commit n’a pas produit')
    assert.ok(lignes(r).some((l) => l.startsWith("[post-rewrite] miroirs d'agents produits dans l'index, HEAD ne les porte pas — À COMMETTRE") && l.includes(MIROIR)), r.stderr)
    assert.equal(d.git('show', `:${MIROIR}`), derive(skill('resolu')))
    assert.equal(d.lire(MIROIR), derive(skill('resolu')))
  } finally {
    d.fin()
  }
})

test('#2578 (g) — une source RETIRÉE sans le pre-commit : le post-commit retire le miroir ORPHELIN de l’index et le SIGNALE À COMMETTRE', () => {
  const d = depotAuSkill()
  try {
    assert.ok(d.git('ls-tree', '-r', '--name-only', 'HEAD').split('\n').includes(MIROIR), 'témoin : le miroir est né')
    d.git('rm', '-q', '--', SOURCE)
    const r = d.jouer('commit', '--no-verify', '-q', '-m', 'retrait sans hook')
    assert.equal(r.status, 0, r.stderr)
    assert.ok(lignes(r).some((l) => l.startsWith("[post-commit] miroirs d'agents produits dans l'index, HEAD ne les porte pas — À COMMETTRE : ") && l.includes(MIROIR)), r.stderr)
    assert.equal(d.git('diff', '--cached', '--name-status').trim(), `D\t${MIROIR}`)
  } finally {
    d.fin()
  }
})

test('#2578 (h) — un miroir retouché à la main et commis sans le pre-commit : le post-commit le reproduit dans l’index et le SIGNALE À COMMETTRE', () => {
  const d = depotAuSkill()
  try {
    const edite = d.lire(MIROIR).replace('v1', 'v1 retouché')
    d.ecrire(MIROIR, edite); d.git('add', '--', MIROIR)
    const r = d.jouer('commit', '--no-verify', '-q', '-m', 'miroir retouché sans hook')
    assert.equal(r.status, 0, r.stderr)
    assert.ok(lignes(r).some((l) => l.startsWith("[post-commit] miroirs d'agents produits dans l'index, HEAD ne les porte pas — À COMMETTRE : ") && l.includes(MIROIR)), r.stderr)
    assert.equal(d.git('show', `HEAD:${MIROIR}`), edite)
    assert.equal(d.git('show', `:${MIROIR}`), derive(skill('v1')))
  } finally {
    d.fin()
  }
})

test('#2578 (h\') — miroir PÉRIMÉ dans HEAD et l’index : un commit qui ne touche ni destination ni membre du producteur (`notes.txt`, `scripts/autre.mjs` hors de la clôture) ne produit pas, le miroir reste périmé', () => {
  const d = depotAuSkill()
  try {
    const perime = d.lire(MIROIR).replace('v1', 'v1 périmé')
    d.ecrire(MIROIR, perime); d.git('add', '--', MIROIR)
    d.git('-c', 'core.hooksPath=', 'commit', '-q', '-m', 'miroir périmé, hooks coupés')
    for (const [rel, texte] of [['notes.txt', 'n2\n'], ['scripts/autre.mjs', 'export const autre = 1\n']]) {
      d.ecrire(rel, texte); d.git('add', '--', rel)
      const r = d.jouer('commit', '--no-verify', '-q', '-m', rel)
      assert.equal(r.status, 0, r.stderr)
      assert.deepEqual(lignes(r).filter((l) => l.startsWith('[post-commit]')), [], `${rel} : ${r.stderr}`)
      assert.equal(d.git('show', `HEAD:${MIROIR}`), perime, rel)
      assert.equal(d.git('show', `:${MIROIR}`), perime, rel)
    }
  } finally {
    d.fin()
  }
})

test('#2578 (h\'\'\') — une donnée JSON de la clôture du producteur (importée par le registre) commise sans le pre-commit : le post-commit produit la famille `hook` et la SIGNALE À COMMETTRE', () => {
  const d = depotAuSkill({ [REGISTRE]: REGISTRE_LECTEUR, [DONNEE]: '["Bash"]\n' })
  try {
    assert.ok(JSON.parse(d.git('show', 'HEAD:.claude/settings.json')).hooks.PreToolUse[0].matcher.includes('Bash'), 'témoin : le registre lit la donnée')
    d.ecrire(DONNEE, '["Bash", "Zed"]\n'); d.git('add', '--', DONNEE)
    const r = d.jouer('commit', '--no-verify', '-q', '-m', 'donnée sans hook')
    assert.equal(r.status, 0, r.stderr)
    assert.ok(lignes(r).some((l) => l.startsWith("[post-commit] miroirs d'agents produits dans l'index, HEAD ne les porte pas — À COMMETTRE : ") && l.includes('.claude/settings.json')), r.stderr)
    assert.ok(JSON.parse(d.git('show', ':.claude/settings.json')).hooks.PreToolUse[0].matcher.includes('Zed'))
  } finally {
    d.fin()
  }
})

test('#2578 (h\'\') — une DÉPENDANCE du producteur hors de `scripts/agents` (`contratGarde.mjs`) commise sans le pre-commit : le post-commit produit la famille `hook` et la SIGNALE À COMMETTRE', () => {
  const CONTRAT = 'scripts/guards/lib/contratGarde.mjs'
  const tete = "export function matcherDOutils(outils, { lookaround, listeExacte, surface = 'claude' }) {\n"
  const d = depotAuSkill({ [REGISTRE]: registre('Bash') })
  try {
    assert.ok(PRODUCTEUR[CONTRAT].includes(tete), 'témoin : la dépendance forgée porte `matcherDOutils`')
    d.ecrire(CONTRAT, PRODUCTEUR[CONTRAT].replace(tete, `${tete}  outils = [...outils, 'Zed']\n`)); d.git('add', '--', CONTRAT)
    const r = d.jouer('commit', '--no-verify', '-q', '-m', 'dépendance sans hook')
    assert.equal(r.status, 0, r.stderr)
    assert.ok(lignes(r).some((l) => l.startsWith("[post-commit] miroirs d'agents produits dans l'index, HEAD ne les porte pas — À COMMETTRE : ") && l.includes('.claude/settings.json')), r.stderr)
    assert.ok(JSON.parse(d.git('show', ':.claude/settings.json')).hooks.PreToolUse[0].matcher.includes('Zed'))
  } finally {
    d.fin()
  }
})
