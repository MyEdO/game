// Garde de l'outil `Workflow` (#2537) : la garde RÉELLE par le répartiteur (`repartir`), sur un dépôt
// forgé qui porte `.claude/workflows/`. Rien ne s'exécute : la garde juge le script désigné.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import * as FS from 'node:fs'
import { join } from 'node:path'
import { instanceDeDepot } from '../guards/lib/depotGabarit.mjs'
import { repartir } from './repartition.mjs'
import { garde } from './workflow-type-guard.mjs'
import { REGISTRE } from './registre.mjs'

const BON = "export const meta = { name: 'b', description: 'd', phases: [] }\nawait agent('p', { agentType: 'lecteur' })\n"
const SANS_TYPE = "export const meta = { name: 's', description: 'd', phases: [] }\nawait agent('p', { label: 'x' })\n"
const TYPE_INCONNU = "await agent('p', { agentType: 'general-purpose' })\n"

test('#2537 — `Workflow` : script, scriptPath, name (résolu contre `CLAUDE_PROJECT_DIR`, jamais le cwd) et resumeFromRunId jugés par la couche UNIVERSELLE', async () => {
  const { racine } = instanceDeDepot({ commit: false, fichiers: { '.claude/workflows/bon.js': BON, '.claude/workflows/sans-type.js': SANS_TYPE, 'ailleurs/w.js': TYPE_INCONNU } })
  const ailleurs = join(racine, 'ailleurs')
  /** Chaque cas : l'entrée de l'outil, la décision attendue (`deny` ou `null`), un motif de la raison, le
   *  contexte du hook (`cwd`, `env`) s'il diffère de la racine du projet. */
  const cas = [
    [{ script: BON }, null],
    [{ script: SANS_TYPE }, 'deny', /script : l\.2 — `agentType` absent/],
    [{ script: TYPE_INCONNU }, 'deny', /`general-purpose` : aucun type de ce nom déclaré/],
    [{ script: "await agent('p', { agentType: T })" }, 'deny', /`agentType` non littéral/],
    [{ script: 'await agent(' }, 'deny', /script non jugeable : script ne parse pas/],
    [{ script: "const go = agent; await go('p', { agentType: 'lecteur' })" }, 'deny', /`agent` non appelé directement/],
    [{ script: "await (agent)('p', { agentType: 'lecteur' })" }, 'deny', /`agent` non appelé directement/],
    [{ script: "await agent.call(null, 'p', { agentType: 'lecteur' })" }, 'deny', /`agent` non appelé directement/],
    [{ scriptPath: join(racine, '.claude', 'workflows', 'bon.js') }, null],
    [{ scriptPath: 'ailleurs/w.js' }, 'deny', /ailleurs.w\.js : l\.1 — `agentType` `general-purpose`/],
    [{ scriptPath: 'absent.js' }, 'deny', /script non jugeable : `scriptPath` illisible/],
    [{ name: 'bon' }, null],
    [{ name: 'sans-type' }, 'deny', /sans-type\.js : l\.2 — `agentType` absent/],
    [{ name: 'hors-depot' }, 'deny', /nom « hors-depot » non résolu dans .* — un script hors du dépôt ne se juge pas/],
    [{ name: 'bon' }, null, undefined, { cwd: ailleurs }],
    [{ name: 'sans-type' }, 'deny', /sans-type.js : l.2/, { cwd: ailleurs }],
    [{ name: 'bon' }, 'deny', /nom « bon » sans `CLAUDE_PROJECT_DIR`/, { env: {} }],
    [{ name: 'bon', resumeFromRunId: 'r1' }, null],
    [{ name: 'sans-type', resumeFromRunId: 'r1' }, 'deny', /`agentType` absent/],
    [{ resumeFromRunId: 'r1' }, 'deny', /`resumeFromRunId` sans `scriptPath` ni `name` : aucun script à juger/],
    [{}, 'deny', /ni `script`, ni `scriptPath`, ni `name`/],
  ]
  const msys = join(racine, '.claude', 'workflows', 'sans-type.js').replace(/^([A-Za-z]):/, (_, d) => `/${d.toLowerCase()}`).split('\\').join('/')
  if (process.platform === 'win32') cas.push(
    [{ scriptPath: msys }, 'deny', /sans-type\.js : l\.2 — `agentType` absent/, { platform: 'win32' }],
    [{ scriptPath: msys }, 'deny', /script non jugeable : `scriptPath` illisible/, { platform: 'linux' }],
  )
  try {
    for (const [tool_input, attendu, motif, hook] of cas) {
      const { sortie } = await repartir({ PreToolUse: REGISTRE.PreToolUse.filter((g) => g === garde) }, JSON.stringify({
        hook_event_name: 'PreToolUse', tool_name: 'Workflow', tool_input, session_id: 's',
      }), { env: { CLAUDE_PROJECT_DIR: racine }, cwd: racine, ...hook })
      const quoi = JSON.stringify({ tool_input, hook })
      assert.equal(sortie?.hookSpecificOutput?.permissionDecision ?? null, attendu, quoi)
      if (motif) assert.match(sortie.hookSpecificOutput.permissionDecisionReason, motif, quoi)
    }
  } finally {
    FS.rmSync(racine, { recursive: true, force: true })
  }
})

// #2712, `.claude/skills/orchestrer-des-agents/SKILL.md`.
test('#2712 — `Agent` : un `model` passé à un type qui épingle le sien est refusé ; sans `model`, ou type sans épingle, l’appel passe', () => {
  const agent = (tool_input) => garde.evaluer({ hook_event_name: 'PreToolUse', tool_name: 'Agent', tool_input }, {})
  const refus = agent({ subagent_type: 'verif-mecanique', model: 'haiku', prompt: 'p' })
  assert.equal(refus?.decision, 'deny')
  assert.match(refus.raison, /`verif-mecanique` épingle `model: claude-haiku-5-5`[^]*relancer le même appel sans `model`/)
  assert.equal(agent({ subagent_type: 'verif-mecanique', prompt: 'p' }), null)
  assert.equal(agent({ subagent_type: 'general-purpose', model: 'sonnet', prompt: 'p' }), null)
  assert.ok(garde.outils.includes('Agent') && garde.outils.includes('Task'))
})
