// Garde `appel-borne` (#2596 A2) : la garde RÉELLE par le répartiteur (`repartir`), sur l'entrée de hook d'un
// sous-agent (`agent_id`) et du fil principal.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { repartir } from './repartition.mjs'
import { REGISTRE } from './registre.mjs'
import { BORNE_D_APPEL_MS, garde } from './appel-borne-guard.mjs'

const SOUS_AGENT = { session_id: 's', agent_id: 'a1', agent_type: 'codeur' }
const PRINCIPAL = { session_id: 's' }

/** La décision du répartiteur sur l'appel `tool_name`/`tool_input` de `appelant`. */
async function decision(appelant, tool_name, tool_input) {
  const { sortie } = await repartir({ PreToolUse: REGISTRE.PreToolUse.filter((g) => g === garde) }, JSON.stringify({
    hook_event_name: 'PreToolUse', tool_name, tool_input, ...appelant,
  }), { env: {}, cwd: process.cwd() })
  return sortie?.hookSpecificOutput ?? null
}

test('#2596 — sous-agent : un appel au premier plan borné au-delà de BORNE_D_APPEL_MS est REFUSÉ, remède à copier', async () => {
  const commande = 'npm run test:perimetre'
  for (const outil of ['Bash', 'PowerShell']) {
    const vu = await decision(SOUS_AGENT, outil, { command: commande, timeout: 600000 })
    assert.equal(vu?.permissionDecision, 'deny', outil)
    const raison = vu.permissionDecisionReason
    assert.match(raison, /run_in_background: true/, outil)
    assert.ok(raison.includes(commande), `${outil} : la commande refusée est dans le remède`)
    assert.match(raison, /node scripts\/ops\/sonde\.mjs "[^"]+\.code"/, outil)
  }
  const bash = (await decision(SOUS_AGENT, 'Bash', { command: commande, timeout: BORNE_D_APPEL_MS + 1 })).permissionDecisionReason
  assert.match(bash, /rm -f "[^"]+\.code"; \( npm run test:perimetre \) > "[^"]+\.log" 2>&1; echo \$\? > "[^"]+\.code"/)
})

test('#2596 — acceptés : sous-agent borné à BORNE_D_APPEL_MS ou sans timeout, sous-agent en fond, fil principal à 600000', async () => {
  const cas = [
    [SOUS_AGENT, 'Bash', { command: 'npm run test:perimetre', timeout: BORNE_D_APPEL_MS }],
    [SOUS_AGENT, 'PowerShell', { command: 'npm run test:perimetre', timeout: 270000 }],
    [SOUS_AGENT, 'Bash', { command: 'npm run test:perimetre' }],
    [SOUS_AGENT, 'Bash', { command: 'npm run test:perimetre', timeout: 600000, run_in_background: true }],
    [PRINCIPAL, 'Bash', { command: 'npm run test:perimetre', timeout: 600000 }],
    [PRINCIPAL, 'PowerShell', { command: 'npm run test:perimetre', timeout: 600000 }],
    [PRINCIPAL, 'Bash', { command: 'sleep 3300', run_in_background: true }],
  ]
  for (const [appelant, outil, input] of cas) {
    assert.equal(await decision(appelant, outil, input), null, `${outil} ${JSON.stringify(input)} ${JSON.stringify(appelant)}`)
  }
})

test('#2596 — câblage : la garde est au registre PreToolUse, sur Bash et PowerShell', () => {
  assert.ok(REGISTRE.PreToolUse.includes(garde))
  assert.deepEqual(garde.outils, ['Bash', 'PowerShell'])
})
