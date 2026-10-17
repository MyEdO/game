// Garde d'écriture du suivi de vague (#2460) : la garde RÉELLE par le répartiteur (`repartir`), sur le
// `.git/suivi` d'un dépôt forgé. Rien n'est écrit : la garde juge l'entrée de l'outil.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import * as FS from 'node:fs'
import { join } from 'node:path'
import { instanceDeDepot } from '../guards/lib/depotGabarit.mjs'
import { repartir } from './repartition.mjs'
import { garde } from './suivi-ecriture-guard.mjs'
import { REGISTRE } from './registre.mjs'

const SCRIPTS = JSON.parse(FS.readFileSync(new URL('../../package.json', import.meta.url), 'utf8')).scripts

test('#2460 — `.git/suivi/665.json` : Write, Edit, ctx_patch et l’écriture shell REFUSÉS ; la lecture et l’outil passent', async () => {
  const { racine } = instanceDeDepot({ commit: false, fichiers: { 'package.json': JSON.stringify({ scripts: SCRIPTS }) } })
  const suivi = join(racine, '.git', 'suivi', '665.json')
  const P = '.git/suivi/665.json'
  /** Chaque cas : l'outil, son entrée, la décision attendue (`deny` ou `null`). */
  const cas = [
    ['Write', { file_path: suivi, content: '{}' }, 'deny'],
    ['Edit', { file_path: suivi, old_string: 'a', new_string: 'b' }, 'deny'],
    ['mcp__lean-ctx__ctx_patch', { op: 'replace_unique', path: suivi, old_text: 'a', new_text: 'b' }, 'deny'],
    ['Write', { file_path: join(racine, '.git', 'suivi', '665.mesure.json'), content: '{}' }, 'deny'],
    ['Write', { file_path: join(racine, '.git', 'suivi', '665.md'), content: '# x' }, 'deny'],
    ...[
      `echo x > ${P}`, `echo x >> ${P}`, `sed -i s/a/b/ ${P}`, `echo x | tee ${P}`, `cp autre.json ${P}`,
      `node -e "require('fs').writeFileSync('${P}', '{}')"`,
      `npm run ops:suivi -- 665 && sed -i s/a/b/ ${P}`,
      `npm run ops:suivi -- 665 --rendu > ${P}`,
      'cd .git/suivi; echo x > 665.json',
    ].map((command) => ['Bash', { command }, 'deny']),
    ...[
      `cat ${P}`, `grep juge ${P}`,
      `cp ${P} ailleurs.json`, `node ${P}`,
      `node -e "require('fs').readFileSync('${P}')"`,
      `npm run ops:suivi -- 665 --lot '{"epique": 665, "mutations": [{"geste": "cocher", "ticket": 2400, "n": 4}]}'`,
      'npm run ops:suivi -- 665 --ajouter-etape 2400 "tour 10 publié"',
      `cat .git/suivi/2437-query.json > copie.json`, 'echo x > .git/suivi/consignes/2460.md',
      `gh issue comment 2460 --body "voir ${P}"`, `npm run ops:suivi -- 665 --signaler "> voir ${P}"`,
    ].map((command) => ['Bash', { command }, null]),
    ...[`Get-Content ${P}`, `gc ${P}`, `Select-String juge ${P}`, `Test-Path ${P}`].map((command) => ['PowerShell', { command }, null]),
    ...[`Set-Content -Path ${P} -Value x`, `'x' | Out-File ${P}`, `Copy-Item autre.json ${P}`].map((command) => ['PowerShell', { command }, 'deny']),
    ...[join(racine, '.git', 'suivi', '2437-query.json'), join(racine, '.git', 'suivi', 'consignes', '665.md')]
      .map((file_path) => ['Write', { file_path, content: 'x' }, null]),
  ]
  try {
    for (const [tool_name, tool_input, attendu] of cas) {
      const { sortie } = await repartir({ PreToolUse: REGISTRE.PreToolUse.filter(g => g === garde) }, JSON.stringify({
        hook_event_name: 'PreToolUse', tool_name, tool_input, session_id: 's',
      }), { env: {}, cwd: racine })
      const quoi = `${tool_name} ${JSON.stringify(tool_input)}`
      assert.equal(sortie?.hookSpecificOutput?.permissionDecision ?? null, attendu, quoi)
      if (attendu === 'deny') assert.match(sortie.hookSpecificOutput.permissionDecisionReason, /Pour le LIRE : `npm run ops:suivi -- <N> --rendu`/, quoi)
    }
  } finally {
    FS.rmSync(racine, { recursive: true, force: true })
  }
})
