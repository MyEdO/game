// Contrats du répartiteur (#2125) : cumul, panne, court-circuit, projection par surface, contexte, et
// câblage du registre. Les gardes factices ne servent qu'au moteur ; les gardes réelles jouent leur rôle.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import {
  construireContexte, cumuler, evaluerGardes, projeter, repartir, surfaceDe,
} from './repartiteur.mjs'
import { REGISTRE } from './registre.mjs'
import { REGISTRE_SOLDE } from './solde-ticket-hook.mjs'
import { garde as commandePiege } from './commande-piege-guard.mjs'
import { garde as runnerCapture } from './runner-capture-guard.mjs'
import { garde as codeurGates } from './codeur-gates-guard.mjs'
import { garde as issueLabel } from './issue-label-guard.mjs'
import { ENTREES_OUTIL, SURFACE_CLAUDE, SURFACE_CODEX, aplatirHooks, compilerMatcher } from '../agents/compat-core.mjs'
import { envDeDepotForge, instanceDeDepot } from '../guards/lib/depotGabarit.mjs'

const HOOKS = fileURLToPath(new URL('.', import.meta.url))
const REPO = fileURLToPath(new URL('../..', import.meta.url))
const CLAUDE = { CLAUDE_PROJECT_DIR: REPO }
const CODEX = {}
const shell = (command, extra = {}) => ({ hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command }, ...extra })
const factice = (nom, evaluer) => ({ nom, outils: ['Bash'], evaluer })

test('une garde qui LÈVE ne fait pas perdre le `deny` d’une autre : sa panne part en contexte, jamais en refus', async () => {
  const verdicts = await evaluerGardes([
    factice('casse', () => { throw new Error('boum') }),
    factice('refus', () => ({ decision: 'deny', raison: 'non' })),
  ], shell('ls'), construireContexte(shell('ls')))
  const cumul = cumuler(verdicts)
  assert.deepEqual(cumul.decision, { decision: 'deny', reason: 'non' })
  assert.equal(cumul.contexte, 'garde casse en panne : boum')
})

test('un `deny` court-circuite les gardes suivantes', async () => {
  let appelee = false
  await evaluerGardes([
    factice('refus', () => ({ decision: 'deny', raison: 'non' })),
    factice('suivante', () => { appelee = true; return null }),
  ], shell('ls'), construireContexte(shell('ls')))
  assert.equal(appelee, false)
})

test('cumul : les raisons des refus jointes ; les contextes toujours joints', () => {
  const cumul = cumuler([
    { decision: 'deny', raison: 'a', garde: 'g1' },
    { contexte: 'c1', garde: 'g2' },
    { decision: 'deny', raison: 'd', garde: 'g3' },
    { contexte: 'c2', garde: 'g4' },
  ])
  assert.deepEqual(cumul.decision, { decision: 'deny', reason: 'a || d' })
  assert.equal(cumul.contexte, 'c1\n\nc2')
})

test('un refus sans raison en porte une qui nomme sa garde', () => {
  assert.match(cumuler([{ decision: 'deny', raison: '  ', garde: 'muette' }]).decision.reason, /muette/)
})

test('projection : Claude porte décision et contexte dans la même sortie ; Codex sans `suppressOutput`', () => {
  const cumul = { decision: { decision: 'deny', reason: 'r' }, contexte: 'c' }
  assert.deepEqual(projeter(cumul, 'PreToolUse', 'claude'), {
    suppressOutput: true,
    hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: 'r', additionalContext: 'c' },
  })
  assert.deepEqual(projeter(cumul, 'PreToolUse', 'codex'), {
    hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: 'r', additionalContext: 'c' },
  })
  assert.equal(projeter({ decision: null, contexte: null }, 'PreToolUse', 'claude'), null)
})

test('surface : `CLAUDE_PROJECT_DIR` présent = Claude Code, absent = Codex', () => {
  assert.equal(surfaceDe(CLAUDE), 'claude')
  assert.equal(surfaceDe(CODEX), 'codex')
})

test('aucune garde ne demande : exception-add AVERTIT sans décider, memoire-tombale REFUSE, pareil sous Claude et sous Codex', async () => {
  const { racine } = instanceDeDepot()
  try {
    const garde = join(racine, 'run-guard.test.mjs')
    writeFileSync(garde, "export const W = ['a.ts:1']\n")
    const cas = [
      ['exception-add', { tool_name: 'Write', tool_input: { file_path: garde, content: "export const W = ['a.ts:1', 'b.ts:2']\n" } }, undefined],
      ['memoire-tombale', { tool_name: 'Write', tool_input: { file_path: join(racine, '.claude', 'memory', 'fiche.md'), content: 'SUPERSÉDÉ par la fiche X.\ncorps\n' } }, 'deny'],
    ]
    for (const [nom, charge, attendue] of cas) {
      const brut = JSON.stringify({ hook_event_name: 'PreToolUse', ...charge })
      const claude = (await repartir(REGISTRE, brut, { env: CLAUDE })).sortie?.hookSpecificOutput
      const codex = (await repartir(REGISTRE, brut, { env: CODEX })).sortie?.hookSpecificOutput
      assert.ok(claude, nom)
      assert.equal(claude.permissionDecision, attendue, `${nom} : ${JSON.stringify(claude)}`)
      assert.deepEqual(codex, claude, nom)
    }
  } finally {
    rmSync(racine, { recursive: true, force: true })
  }
})

test('contexte : la cible PROUVÉE par la commande, sinon le `cwd` de l’entrée de hook, sinon le processus', () => {
  const base = mkdtempSync(join(tmpdir(), 'repartiteur-cwd-'))
  try {
    assert.equal(construireContexte(shell('ls', { cwd: base }), { cwd: REPO }).dir, base)
    const cible = join(REPO, 'scripts')
    const cdCible = `cd "${cible.replace(/\\/g, '/')}" && ls`
    assert.equal(construireContexte(shell(cdCible, { cwd: base }), { cwd: REPO }).dir, cible)
    assert.equal(construireContexte(shell('ls'), { cwd: REPO }).dir, REPO)
    const absent = construireContexte(shell('cd /nulle/part && ls', { cwd: base }), { cwd: REPO })
    assert.equal(absent.dir, base, 'un répertoire absent n’est pas retenu')
    assert.ok(absent.cibleIgnoree)
  } finally {
    rmSync(base, { recursive: true, force: true })
  }
})

/** Un dépôt jetable dont `package.json` porte `scripts`, et l'appel `ctx_shell` de `npm run x` depuis lui. */
async function viaCtxShell(corps, fn) {
  const { racine: base } = instanceDeDepot({ fichiers: { 'package.json': JSON.stringify({ scripts: { x: corps } }) } })
  try {
    return await fn({ hook_event_name: 'PreToolUse', cwd: base, tool_name: 'mcp__lean-ctx__ctx_shell', tool_input: { command: 'npm run x', cwd: base } })
  } finally {
    rmSync(base, { recursive: true, force: true })
  }
}
const verdictDe = async (garde, entree) => (await evaluerGardes([garde], entree, construireContexte(entree, { cwd: REPO }))).find((v) => v.decision)

test('`npm run <x>` se lit dans le `cwd` de `ctx_shell`, garde par garde (commande-piege, runner-capture, codeur-gates, issue-label)', async () => {
  const cas = [
    [commandePiege, 'git show -- 0123456789abcdef0123456789abcdef01234567', {}],
    [runnerCapture, 'vitest run | tail -5', {}],
    [codeurGates, 'vitest run', { agent_type: 'codeur' }],
    [issueLabel, 'gh issue create --title t --body b', {}],
  ]
  for (const [garde, corps, extra] of cas) {
    const refus = await viaCtxShell(corps, (entree) => verdictDe(garde, { ...entree, ...extra }))
    assert.equal(refus?.decision, 'deny', `${garde.nom} : \`npm run x\` = « ${corps} » dans le cwd de ctx_shell`)
    const hors = await verdictDe(garde, { hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: 'npm run x' }, ...extra })
    assert.equal(hors, undefined, `${garde.nom} : sans ce cwd, \`npm run x\` ne se résout pas`)
  }
})

test('aucune garde n’a d’effet à l’import : les registres ENTIERS, importés dans un seul processus, rendent la main sans rien écrire', () => {
  const code = ['registre.mjs', 'solde-ticket-hook.mjs'].map((m) => `await import(${JSON.stringify(pathToFileURL(join(HOOKS, m)).href)})`).join(';') + ";console.log('ok')"
  const r = spawnSync(process.execPath, ['--input-type=module', '-e', code], { encoding: 'utf8', timeout: 30_000, stdio: ['pipe', 'pipe', 'pipe'] })
  assert.equal(r.signal, null, 'le processus a été tué par la coupe : un import attend son stdin')
  assert.equal(r.status, 0, r.stderr)
  assert.equal(r.stdout.trim(), 'ok')
})

test('câblage : chaque module de scripts/hooks/ qui exporte une `garde` est au registre d’un point d’entrée', async () => {
  const inscrites = new Set([...Object.values(REGISTRE), ...Object.values(REGISTRE_SOLDE)].flat())
  const modules = readdirSync(HOOKS).filter((f) => f.endsWith('.mjs') && !f.endsWith('.test.mjs'))
  const absentes = []
  for (const m of modules) {
    const { garde } = await import(pathToFileURL(join(HOOKS, m)).href)
    if (garde && !inscrites.has(garde)) absentes.push(`${m} (${garde.nom})`)
  }
  assert.deepEqual(absentes, [], 'une garde hors registre n’est jamais évaluée')
})

test('câblage : le matcher déclaré de chaque point d’entrée couvre les `outils` de ses gardes, sur les deux surfaces', () => {
  const registres = new Map([['repartiteur.mjs', REGISTRE], ['solde-ticket-hook.mjs', REGISTRE_SOLDE]])
  for (const surface of [SURFACE_CLAUDE, SURFACE_CODEX]) {
    const declares = aplatirHooks(JSON.parse(readFileSync(join(REPO, surface), 'utf8')), surface)
    for (const { script } of ENTREES_OUTIL) {
      for (const [phase, gardes] of Object.entries(registres.get(script))) {
        const declare = declares.find((h) => h.script === script && h.phase === phase)
        assert.ok(declare, `${surface} ${phase} ${script} : aucun hook`)
        const couvre = compilerMatcher(declare.matcher, surface)
        for (const g of gardes) for (const outil of g.outils) {
          const exemple = outil.endsWith('.*') ? `${outil.slice(0, -2)}ctx_outil_inconnu` : outil
          assert.ok(couvre(exemple), `${surface} ${phase} ${script} : ${g.nom} / ${outil}`)
        }
      }
    }
  }
})

test('cumuler : un contexte ENTIER déjà rendu par la même garde ne se répète pas ; une ligne commune à deux contextes distincts survit', async () => {
  const { cumuler } = await import('./repartiteur.mjs')
  const a = 'POINTEUR DÉRÉFÉRENCÉ (1 ligne(s) écrite(s) dans .claude/memory/a.md) : recoller le TITRE.\n  voir #1234'
  const b = 'POINTEUR DÉRÉFÉRENCÉ (1 ligne(s) écrite(s) dans .claude/memory/b.md) : recoller le TITRE.\n  voir #1234'
  assert.equal(cumuler([{ garde: 'poison-postcheck', contexte: a }, { garde: 'poison-postcheck', contexte: b }]).contexte, `${a}\n\n${b}`)
  assert.equal(cumuler([{ garde: 'data-edit', contexte: a }, { garde: 'data-edit', contexte: a }]).contexte, a)
  assert.equal(cumuler([{ garde: 'data-edit', contexte: a }, { garde: 'poison-postcheck', contexte: a }]).contexte, `${a}\n\n${a}`, 'deux gardes, deux contextes')
})

// ── #2224 : la commande jugée est celle qui s'exécute, là où elle s'exécute ──────────────────────
const LC = 'mcp__lean-ctx__'
const GATES = JSON.stringify({ scripts: { gates: 'node scripts/gates/toutes.mjs' } })

/** Un dépôt forgé dont la racine porte le `package.json` des gates et un `src/ui/` sans `package.json`. */
async function dansUnDepot(fn) {
  const { racine } = instanceDeDepot({ fichiers: { 'package.json': GATES, 'src/ui/a.ts': 'export const a = 1\n' } })
  try {
    return await fn(racine)
  } finally {
    rmSync(racine, { recursive: true, force: true })
  }
}

/** La sortie projetée de `repartir` réel (registre ENTIER) pour l'appel `tool_name` lancé depuis `racine`. */
async function sortie(racine, tool_name, tool_input, extra = {}) {
  const brut = JSON.stringify({ hook_event_name: 'PreToolUse', cwd: racine, tool_name, tool_input, ...extra })
  return (await repartir(REGISTRE, brut, { env: CLAUDE, cwd: racine })).sortie?.hookSpecificOutput ?? null
}
const decision = async (...a) => (await sortie(...a))?.permissionDecision ?? null
const raison = async (...a) => (await sortie(...a))?.permissionDecisionReason ?? ''
const CODEUR = { agent_type: 'codeur' }

test('#2224 racine npm : `npm run gates` lancé dans un sous-dossier sans `package.json` se lit à la racine npm, ctx_shell comme Bash + cd', async () => {
  await dansUnDepot(async (racine) => {
    const ui = join(racine, 'src', 'ui')
    assert.equal(await decision(racine, `${LC}ctx_shell`, { command: 'npm run gates', cwd: ui }, CODEUR), 'deny', 'sonde du juge : ctx_shell, cwd src/ui')
    assert.equal(await decision(racine, 'Bash', { command: 'cd src/ui && npm run gates' }, CODEUR), 'deny')
    assert.equal(await decision(racine, 'Bash', { command: 'npm run gates' }, CODEUR), 'deny')
    assert.equal(construireContexte({ tool_name: 'Bash', cwd: racine, tool_input: { command: 'cd src/ui && ls' } }).racineNpm, resolve(racine))
  })
})

test('#2224 cwd d’un shell lean-ctx : absent, relatif, inexistant ou hors de l’arbre principal → refus nommé, canal « cwd ABSOLU »', async () => {
  await dansUnDepot(async (racine) => {
    const ailleurs = mkdtempSync(join(tmpdir(), 'repartiteur-ailleurs-'))
    try {
      const cas = [
        ['absent', { command: 'git status' }, /`cwd` absent/],
        ['vide', { command: 'git status', cwd: ' ' }, /`cwd` absent/],
        ['relatif', { command: 'git status', cwd: 'src/ui' }, /`cwd` relatif/],
        ['inexistant', { command: 'git status', cwd: join(racine, 'nulle-part') }, /`cwd` inexistant/],
        ['hors de l’arbre principal', { command: 'git status', cwd: ailleurs }, /`cwd` hors de l’arbre principal/],
      ]
      for (const outil of [`${LC}ctx_shell`, `${LC}shell`]) {
        for (const [nom, entree, motif] of cas) {
          const r = await raison(racine, outil, entree)
          assert.match(r, motif, `${outil} ${nom} : ${r}`)
          assert.match(r, /canal prescrit : passer `cwd` ABSOLU/, `${outil} ${nom}`)
        }
      }
      assert.equal(await decision(racine, `${LC}ctx_shell`, { command: 'git status', cwd: racine }), null, 'cwd absolu dans l’arbre : jugé, rien à dire')
    } finally {
      rmSync(ailleurs, { recursive: true, force: true })
    }
  })
})

test('#2224 cwd d’un shell lean-ctx dans un worktree de l’arbre principal : jugé là', async () => {
  await dansUnDepot(async (racine) => {
    const wt = join(racine, '.wt-1')
    execFileSync('git', ['worktree', 'add', '-q', '--detach', wt], { cwd: racine, env: envDeDepotForge(), stdio: 'ignore' })
    const contexte = construireContexte({ tool_name: `${LC}ctx_shell`, cwd: racine, tool_input: { command: 'ls', cwd: wt } })
    assert.equal(contexte.nonJugeable, null)
    assert.equal(contexte.dir, resolve(wt))
  })
})

test('#2224 cwd MSYS dans l’arbre : jugé comme son chemin natif', { skip: process.platform !== 'win32' && 'graphie MSYS : win32 seulement' }, async () => {
  await dansUnDepot(async (racine) => {
    const ui = join(racine, 'src', 'ui')
    const msys = ui.replace(/^([A-Za-z]):[\\/]/, (_, d) => `/${d.toLowerCase()}/`).replace(/\\/g, '/')
    assert.equal(construireContexte({ tool_name: `${LC}ctx_shell`, cwd: racine, tool_input: { command: 'ls', cwd: msys } }).dir, resolve(ui))
    for (const command of ['npm run gates', 'git status']) {
      assert.deepEqual(
        await sortie(racine, `${LC}ctx_shell`, { command, cwd: msys }, CODEUR),
        await sortie(racine, `${LC}ctx_shell`, { command, cwd: ui }, CODEUR),
        command,
      )
    }
  })
})

test('#2224 schéma fermé du shell lean-ctx : `env` et toute clé inconnue → refus', async () => {
  await dansUnDepot(async (racine) => {
    for (const [nom, entree, cle] of [
      ['env', { command: 'git status', cwd: racine, env: { GIT_INDEX_FILE: 'x' } }, 'env'],
      ['clé inconnue', { command: 'git status', cwd: racine, shell: 'pwsh' }, 'shell'],
    ]) {
      const r = await raison(racine, `${LC}ctx_shell`, entree)
      assert.match(r, new RegExp(`clé hors du schéma admis du shell \\(${LC}ctx_shell : ${cle}\\)`), `${nom} : ${r}`)
    }
    const admises = { command: 'git status', cwd: racine, raw: true, inline: true, timeout_ms: 1000, run_in_background: false }
    assert.equal(await decision(racine, `${LC}ctx_shell`, admises), null)
  })
})

test('#2224 écriture lean-ctx à `path` relatif → refus, canal « `path` absolu » ; absolu : rien du canal', async () => {
  await dansUnDepot(async (racine) => {
    const r = await raison(racine, `${LC}ctx_patch`, { op: 'create', path: 'notes/x.md', new_text: 'x' })
    assert.match(r, /`path` relatif \(notes\/x\.md\)/)
    assert.match(r, /canal prescrit : un `path` absolu/)
    const lot = await raison(racine, `${LC}ctx_patch`, { path: 'notes/x.md', ops: [{ op: 'set_line', line: 1, hash: '00', new_text: 'b' }] })
    assert.match(lot, /`path` relatif/)
    assert.equal(await decision(racine, `${LC}ctx_patch`, { op: 'create', path: join(racine, 'docs', 'x.md'), new_text: 'x' }), null)
  })
})

test('#2224 affectation d’environnement en tête qui change le programme ou l’index → refus, Bash comme ctx_shell ; les autres passent', async () => {
  await dansUnDepot(async (racine) => {
    const refusees = [
      ['GIT_INDEX_FILE=x git commit -m "feat: y"', /GIT_INDEX_FILE/],
      ['env GIT_DIR=../autre/.git git commit -m "feat: y"', /GIT_DIR/],
      ['GIT_WORK_TREE=/tmp git status', /GIT_WORK_TREE/],
      ['NODE_OPTIONS=--require=./x.cjs node a.mjs', /NODE_OPTIONS/],
      ['npm_config_script_shell=./x.sh npm run gates', /npm_config_script_shell/],
      ['git status && NPM_CONFIG_PREFIX=.. npm test', /NPM_CONFIG_PREFIX/],
    ]
    for (const [command, motif] of refusees) {
      for (const [outil, entree] of [['Bash', { command }], [`${LC}ctx_shell`, { command, cwd: racine }]]) {
        const r = await raison(racine, outil, entree)
        assert.match(r, motif, `${outil} « ${command} » : ${r}`)
        assert.match(r, /canal prescrit : la même commande sans cette affectation/, `${outil} « ${command} »`)
      }
    }
    for (const command of ['WFRP_TEST_COEURS=4 git status', 'echo GIT_INDEX_FILE=x']) {
      assert.equal(await decision(racine, 'Bash', { command }), null, command)
      assert.equal(await decision(racine, `${LC}ctx_shell`, { command, cwd: racine }), null, command)
    }
  })
})

test('#2224 affectation HORS préfixe qui change l’environnement des segments suivants → refus, Bash/PowerShell comme ctx_shell ; les autres passent', async () => {
  await dansUnDepot(async (racine) => {
    const refusees = [
      ['Bash', 'export GIT_INDEX_FILE=x; git commit -m "feat: y"', /GIT_INDEX_FILE/],
      ['Bash', 'export NODE_OPTIONS=--require=./x.cjs && npm test', /NODE_OPTIONS/],
      ['Bash', 'declare -x GIT_DIR=../autre/.git; git status', /GIT_DIR/],
      ['Bash', 'set -a; GIT_WORK_TREE=/tmp; git status', /GIT_WORK_TREE/],
      ['Bash', 'sh -c "export npm_config_prefix=..; npm test"', /npm_config_prefix/],
      ['PowerShell', "$env:GIT_INDEX_FILE = 'x'; git commit -m y", /GIT_INDEX_FILE/],
      ['PowerShell', "$env:GIT_INDEX_FILE='x'; git commit -m y", /GIT_INDEX_FILE/],
      ['PowerShell', "${env:NODE_OPTIONS} = '--require=x'; npm test", /NODE_OPTIONS/],
      ['PowerShell', 'Set-Item env:GIT_DIR ../autre/.git; git status', /GIT_DIR/],
      ['PowerShell', 'Set-Item -Path Env:GIT_DIR -Value x; git status', /GIT_DIR/],
    ]
    for (const [shell, command, motif] of refusees) {
      for (const [outil, entree] of [[shell, { command }], [`${LC}ctx_shell`, { command, cwd: racine }]]) {
        const r = await raison(racine, outil, entree)
        assert.match(r, motif, `${outil} « ${command} » : ${r}`)
        assert.match(r, /canal prescrit : la même commande sans cette affectation/, `${outil} « ${command} »`)
      }
    }
    for (const [shell, command] of [
      ['Bash', 'export WFRP_TEST_COEURS=4; git status'], ['Bash', 'echo export GIT_DIR=x'], ['Bash', 'declare GIT_DIR=x; echo $GIT_DIR'],
      ['Bash', 'export -n GIT_DIR; git status'], ['PowerShell', 'echo $env:GIT_DIR'], ['PowerShell', "$env:WFRP_TEST_COEURS = '4'; git status"],
    ]) {
      assert.equal(await decision(racine, shell, { command }), null, `${shell} « ${command} »`)
      assert.equal(await decision(racine, `${LC}ctx_shell`, { command, cwd: racine }), null, `ctx_shell « ${command} »`)
    }
  })
})

test('#2224 shell lean-ctx SANS `command` (`job_id`, `background_action`) : rien ne s’exécute, aucun `cwd` exigé', async () => {
  await dansUnDepot(async (racine) => {
    for (const entree of [{ background_action: 'status', job_id: 'shell_1' }, { background_action: 'cancel', job_id: 'shell_1' }, { job_id: 'shell_1' }, { command: '  ', background_action: 'status' }]) {
      assert.equal(await decision(racine, `${LC}ctx_shell`, entree), null, JSON.stringify(entree))
      assert.equal(construireContexte({ tool_name: `${LC}ctx_shell`, cwd: racine, tool_input: entree }).dir, resolve(racine), JSON.stringify(entree))
    }
    assert.match(await raison(racine, `${LC}ctx_shell`, { command: 'git status', job_id: 'shell_1' }), /`cwd` absent/, 'une commande exige toujours son `cwd`')
  })
})

test('#2224 contrat positif : Bash sans `cd` jugé à son `cwd` ; ctx_shell à `cwd` absolu jugé comme Bash + `cd`', async () => {
  await dansUnDepot(async (racine) => {
    const ui = join(racine, 'src', 'ui')
    for (const command of ['npm run gates', 'gh issue create --title t --body b', 'git status', 'npx vitest run | tail -5']) {
      const viaLeanCtx = await sortie(racine, `${LC}ctx_shell`, { command, cwd: ui }, CODEUR)
      assert.deepEqual(await sortie(ui, 'Bash', { command }, CODEUR), viaLeanCtx, `Bash au cwd src/ui : ${command}`)
      assert.equal(await decision(racine, 'Bash', { command: `cd src/ui && ${command}` }, CODEUR), viaLeanCtx?.permissionDecision ?? null, `Bash + cd : ${command}`)
    }
    assert.equal(construireContexte({ tool_name: 'Bash', cwd: racine, tool_input: { command: 'ls' } }).dir, resolve(racine))
  })
})
