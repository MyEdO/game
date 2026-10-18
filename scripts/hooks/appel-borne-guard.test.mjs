// Garde `appel-borne` (#2596 A2) : la garde RÉELLE par le répartiteur (`repartir`), sur l'entrée de hook d'un
// sous-agent (`agent_id`) et du fil principal.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { repartir } from './repartition.mjs'
import { REGISTRE } from './registre.mjs'
import { spawnSync } from 'node:child_process'
import { readdirSync, readFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { BORNE_D_APPEL_MS, garde } from './appel-borne-guard.mjs'
import { codeDe } from '../ops/sonde.mjs'
import { REGLES_COMMUNES } from './contexte-sous-agent.mjs'

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

test('#2596 — définitions d’agents : aucune n’interdit le fond ; la règle des 270 s et la sonde vivent dans les règles communes injectées à tout sous-agent à shell et dans les profils Codex codeur et artiste', () => {
  const racine = fileURLToPath(new URL('../..', import.meta.url))
  const porteRegle = (texte, ou) => {
    assert.match(texte, /aucun appel d'outil ne dure plus de 270 s/i, ou)
    assert.match(texte, /node scripts\/ops\/sonde\.mjs <base>\.code/, ou)
  }
  porteRegle(readFileSync(join(racine, REGLES_COMMUNES), 'utf8'), REGLES_COMMUNES)
  for (const dossier of ['.claude/agents', '.codex/agents']) {
    for (const nom of readdirSync(join(racine, dossier))) {
      const texte = readFileSync(join(racine, dossier, nom), 'utf8')
      assert.doesNotMatch(texte, /Jamais de `run_in_background`/, `${dossier}/${nom}`)
      if (dossier === '.codex/agents' && /^(codeur|artiste)\./.test(nom)) porteRegle(texte, `${dossier}/${nom}`)
    }
  }
})

test('#2596 — câblage : la garde est au registre PreToolUse, sur Bash et PowerShell', () => {
  assert.ok(REGISTRE.PreToolUse.includes(garde))
  assert.deepEqual(garde.outils, ['Bash', 'PowerShell'])
})

test('#2596 — une chaîne numérique se juge comme un nombre ; une chaîne non numérique prend la borne par défaut', async () => {
  assert.equal((await decision(SOUS_AGENT, 'Bash', { command: 'npm test', timeout: '600000' }))?.permissionDecision, 'deny')
  assert.equal((await decision(SOUS_AGENT, 'PowerShell', { command: 'npm test', timeout: ' 270001 ' }))?.permissionDecision, 'deny')
  assert.equal(await decision(SOUS_AGENT, 'Bash', { command: 'npm test', timeout: '270000' }), null)
  assert.equal(await decision(SOUS_AGENT, 'Bash', { command: 'npm test', timeout: 'beaucoup' }), null)
  assert.equal(await decision(SOUS_AGENT, 'Bash', { command: 'npm test', timeout: '' }), null)
})

/** La base `.code`/`.log` prescrite à `appelant` pour `npm run test:perimetre`. */
async function baseDuRemede(appelant, outil = 'Bash') {
  const raison = (await decision(appelant, outil, { command: 'npm run test:perimetre', timeout: 600000 })).permissionDecisionReason
  return raison.match(/sonde\.mjs "([^"]+)\.code"/)[1]
}

test('#2596 — la base est UNIQUE par appelant : agent, répertoire, session ; stable pour le même appelant', async () => {
  const base = await baseDuRemede({ ...SOUS_AGENT, cwd: '/depot/.wt-1' })
  assert.equal(await baseDuRemede({ ...SOUS_AGENT, cwd: '/depot/.wt-1' }), base)
  assert.notEqual(await baseDuRemede({ ...SOUS_AGENT, cwd: '/depot/.wt-2' }), base)
  assert.notEqual(await baseDuRemede({ ...SOUS_AGENT, agent_id: 'a2', cwd: '/depot/.wt-1' }), base)
  assert.notEqual(await baseDuRemede({ ...SOUS_AGENT, session_id: 's2', cwd: '/depot/.wt-1' }), base)
})

/** Le pwsh de la machine, `null` absent. */
function pwsh() {
  const candidats = ['pwsh', process.env.ProgramFiles && join(process.env.ProgramFiles, 'PowerShell', '7', 'pwsh.exe')].filter(Boolean)
  return candidats.find((c) => spawnSync(c, ['-NoProfile', '-Command', 'exit 0'], { timeout: 60000 }).status === 0) ?? null
}
const PWSH = pwsh()

test('#2596 — forme PowerShell jouée EN VRAI : `.code` porte toujours un entier', { skip: PWSH ? false : 'pwsh absent' }, async () => {
  const cas = [
    ['Get-ChildItem ./nexistepas-2596', (c) => c !== 0],
    ['Get-Date|Out-Null', (c) => c === 0],
    ['throw "boom"', (c) => c !== 0],
    ['node -e "process.exit(3)"', (c) => c === 3],
    ['node -e "process.exit(0)"', (c) => c === 0],
  ]
  for (const [commande, attendu] of cas) {
    const appelant = { ...SOUS_AGENT, agent_id: `banc-${process.pid}`, cwd: commande }
    const raison = (await decision(appelant, 'PowerShell', { command: commande, timeout: 600000 })).permissionDecisionReason
    const forme = raison.split('sous cette forme :\n')[1].split('\n')[0]
    const base = raison.match(/sonde\.mjs "([^"]+)\.code"/)[1]
    try {
      const joue = spawnSync(PWSH, ['-NoProfile', '-Command', forme], { encoding: 'utf8', timeout: 60000 })
      assert.equal(joue.status, 0, `${commande} : ${joue.stderr}`)
      const code = codeDe(readFileSync(`${base}.code`, 'utf8'))
      assert.ok(Number.isInteger(code) && attendu(code), `${commande} → .code ${code}`)
    } finally {
      for (const suffixe of ['.code', '.log']) rmSync(`${base}${suffixe}`, { force: true })
    }
  }
})

test('#2603 — un serveur vite sans borne de vie est REFUSÉ à tout appelant, en fond comme au premier plan', async () => {
  const cas = [
    ['Bash', { command: 'npm run dev', run_in_background: true }],
    ['Bash', { command: 'npm run dev' }],
    ['Bash', { command: 'npm run dev -- --port 5180', run_in_background: true }],
    ['Bash', { command: 'npm run preview', run_in_background: true }],
    ['Bash', { command: 'npx vite preview', run_in_background: true }],
    ['Bash', { command: 'timeout 0 npm run dev', run_in_background: true }],
    ['Bash', { command: '(npm run dev &)', run_in_background: true }],
    ['Bash', { command: 'nohup npm run dev &', run_in_background: true }],
    ['Bash', { command: 'timeout 60 bash -c "(npm run dev &)"', run_in_background: true }],
    ['PowerShell', { command: 'timeout 3000 npm run dev', run_in_background: true }],
  ]
  for (const appelant of [PRINCIPAL, SOUS_AGENT]) {
    for (const [outil, input] of cas) {
      const vu = await decision(appelant, outil, input)
      assert.equal(vu?.permissionDecision, 'deny', `${outil} ${JSON.stringify(input)} ${JSON.stringify(appelant)}`)
      assert.match(vu.permissionDecisionReason, /SANS BORNE DE VIE .*#2603.*timeout <N> npm run dev.*VITE_RELAY_URL=… timeout <N> npm run dev/s)
    }
  }
})

test('#2603 — acceptés : serveur vite borné par un `timeout` de coreutils, vite qui ne sert rien, texte qui le CITE', async () => {
  const cas = [
    { command: 'timeout 3000 npm run dev', run_in_background: true },
    { command: 'timeout -k 5 2h npm run dev', run_in_background: true },
    { command: 'VITE_RELAY_URL=http://localhost:8787 timeout 3000 npm run dev', run_in_background: true },
    { command: 'timeout 60 bash -c "npm run dev"', run_in_background: true },
    { command: 'timeout 3000 npm run dev &', run_in_background: true },
    { command: 'npm run build' },
    { command: 'npx vite --version' },
    { command: 'grep vite package.json' },
    { command: 'git commit -m "npm run dev"' },
  ]
  for (const appelant of [PRINCIPAL, SOUS_AGENT]) {
    for (const input of cas) assert.equal(await decision(appelant, 'Bash', input), null, `${JSON.stringify(input)} ${JSON.stringify(appelant)}`)
  }
})
