// Garde d'écriture du suivi de vague (#2460) : la garde RÉELLE par le répartiteur (`repartir`), sur le
// `.git/suivi` d'un dépôt forgé. Rien n'est écrit : la garde juge l'entrée de l'outil.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import * as FS from 'node:fs'
import { join } from 'node:path'
import { instanceDeDepot } from '../guards/lib/depotGabarit.mjs'
import { repartir } from './repartition.mjs'
import { garde } from './suivi-ecriture-guard.mjs'

const SCRIPTS = JSON.parse(FS.readFileSync(new URL('../../package.json', import.meta.url), 'utf8')).scripts

/** La décision de la garde pour `tool_input` sous `tool_name`, dans le dépôt `racine` : `deny` ou `null`. */
async function decision(racine, tool_name, tool_input) {
  const { sortie } = await repartir({ PreToolUse: [garde] }, JSON.stringify({
    hook_event_name: 'PreToolUse', tool_name, tool_input, session_id: 's',
  }), { env: {}, cwd: racine })
  return sortie?.hookSpecificOutput?.permissionDecision ?? null
}

test('#2460 — `.git/suivi/665.json` : Write, Edit, ctx_patch et l’écriture shell REFUSÉS ; la lecture et l’outil passent', async () => {
  const { racine } = instanceDeDepot({ commit: false, fichiers: { 'package.json': JSON.stringify({ scripts: SCRIPTS }) } })
  const suivi = join(racine, '.git', 'suivi', '665.json')
  const P = '.git/suivi/665.json'
  try {
    for (const [outil, entree] of [
      ['Write', { file_path: suivi, content: '{}' }],
      ['Edit', { file_path: suivi, old_string: 'a', new_string: 'b' }],
      ['mcp__lean-ctx__ctx_patch', { op: 'replace_unique', path: suivi, old_text: 'a', new_text: 'b' }],
      ['Write', { file_path: join(racine, '.git', 'suivi', '665.mesure.json'), content: '{}' }],
      ['Write', { file_path: join(racine, '.git', 'suivi', '665.md'), content: '# x' }],
    ]) assert.equal(await decision(racine, outil, entree), 'deny', `${outil} ${JSON.stringify(entree)}`)
    for (const command of [
      `echo x > ${P}`, `echo x >> ${P}`, `sed -i s/a/b/ ${P}`, `echo x | tee ${P}`, `cp autre.json ${P}`,
      `node -e "require('fs').writeFileSync('${P}', '{}')"`,
      `npm run ops:suivi -- 665 && sed -i s/a/b/ ${P}`,
      `npm run ops:suivi -- 665 --rendu > ${P}`,
    ]) assert.equal(await decision(racine, 'Bash', { command }), 'deny', command)
    for (const command of [
      `cat ${P}`, `grep juge ${P}`,
      `npm run ops:suivi -- 665 --lot '{"epique": 665, "mutations": [{"geste": "cocher", "ticket": 2400, "n": 4}]}'`,
      'npm run ops:suivi -- 665 --ajouter-etape 2400 "tour 10 publié"',
      `cat .git/suivi/2437-query.json > copie.json`, 'echo x > .git/suivi/consignes/2460.md',
    ]) assert.equal(await decision(racine, 'Bash', { command }), null, command)
    for (const chemin of [join(racine, '.git', 'suivi', '2437-query.json'), join(racine, '.git', 'suivi', 'consignes', '665.md')]) {
      assert.equal(await decision(racine, 'Write', { file_path: chemin, content: 'x' }), null, chemin)
    }
  } finally {
    FS.rmSync(racine, { recursive: true, force: true })
  }
})
