// Contrats du répartiteur (#2125) : cumul, panne, court-circuit, projection par surface, contexte, et
// câblage du registre. Les gardes factices ne servent qu'au moteur ; les gardes réelles jouent leur rôle.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
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
import { instanceDeDepot } from '../guards/lib/depotGabarit.mjs'

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

test('contexte : la cible PROUVÉE par la commande, sinon le `cwd` de `ctx_shell`, sinon le processus', () => {
  const base = mkdtempSync(join(tmpdir(), 'repartiteur-cwd-'))
  try {
    assert.equal(construireContexte(shell('ls', { tool_input: { command: 'ls', cwd: base } }), { cwd: REPO }).dir, base)
    const cible = join(REPO, 'scripts')
    const cdCible = `cd "${cible.replace(/\\/g, '/')}" && ls`
    assert.equal(construireContexte(shell(cdCible, { tool_input: { command: cdCible, cwd: base } }), { cwd: REPO }).dir, cible)
    assert.equal(construireContexte(shell('ls'), { cwd: REPO }).dir, REPO)
    const absent = construireContexte(shell('cd /nulle/part && ls', { tool_input: { command: 'cd /nulle/part && ls', cwd: base } }), { cwd: REPO })
    assert.equal(absent.dir, base, 'un répertoire absent n’est pas retenu')
    assert.ok(absent.cibleIgnoree)
  } finally {
    rmSync(base, { recursive: true, force: true })
  }
})

/** Un dépôt jetable dont `package.json` porte `scripts`, et l'appel `ctx_shell` de `npm run x` depuis lui. */
function viaCtxShell(corps, fn) {
  const base = mkdtempSync(join(tmpdir(), 'repartiteur-npm-'))
  try {
    writeFileSync(join(base, 'package.json'), JSON.stringify({ scripts: { x: corps } }))
    return fn({ hook_event_name: 'PreToolUse', tool_name: 'mcp__lean-ctx__ctx_shell', tool_input: { command: 'npm run x', cwd: base } })
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
