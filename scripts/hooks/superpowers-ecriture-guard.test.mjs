import test from 'node:test'
import assert from 'node:assert/strict'
import { garde } from './superpowers-ecriture-guard.mjs'
import { REGISTRE } from './registre.mjs'
import { fileURLToPath } from 'node:url'
import * as FS from 'node:fs'
import { join } from 'node:path'
import { instanceDeDepot } from '../guards/lib/depotGabarit.mjs'
import { repartir } from './repartition.mjs'

const dir = fileURLToPath(new URL('../..', import.meta.url))
const verdict = (outil, input) => garde.evaluer({ tool_name: outil, tool_input: input }, { dir, baseDeLAppel: dir })
test('câblage et éditions : ignoré compris', () => {
  assert.ok(REGISTRE.PreToolUse.includes(garde))
  for (const outil of ['Write', 'Edit', 'mcp__lean-ctx__ctx_patch']) {
    const vu = verdict(outil, { path: '.superpowers/x.md', file_path: '.superpowers/x.md', content: 'a', op: 'create', new_text: 'a' })
    assert.equal(vu[0].decision, 'deny')
    assert.match(vu[0].raison, /ticket.*archives/)
  }
  assert.deepEqual(verdict('Write', { file_path: '.git/suivi/archives/2494/x.md', content: 'a' }), [null])
  for (const chemin of ['autre .superpowers/x.md', 'autre.superpowers/x.md', '.superpowers-autre/x.md']) {
    assert.deepEqual(verdict('Write', { file_path: chemin, content: 'a' }), [null], chemin)
    assert.equal(verdict('Bash', { command: `echo x > "${chemin}"` }), null, chemin)
  }
  for (const chemin of ['.superpowers/x.md', 'autre/.superpowers/x.md']) {
    assert.equal(verdict('Write', { file_path: chemin, content: 'a' })[0].decision, 'deny', chemin)
    assert.equal(verdict('Bash', { command: `echo x > "${chemin}"` }).decision, 'deny', chemin)
  }
})
test('REGISTRE : cibles AST, copie et chemins canonisés, sans refus des lectures', async () => {
  const { racine } = instanceDeDepot({ commit: false })
  FS.mkdirSync(join(racine, '.superpowers'))
  FS.symlinkSync(join(racine, '.superpowers'), join(racine, 'alias'), 'junction')
  const cas = [
    ["node -e \"require('fs').readFileSync('.superpowers/x')\"", null],
    ['node .superpowers/script.mjs', null],
    ["node -e \"const fs=require('fs'); fs.readFileSync('.superpowers/x'); fs.writeFileSync('ailleurs','a')\"", null],
    ["node -e \"const fs=require('fs'); fs.writeFileSync('.superpowers/x','a')\"", 'deny'],
    ["node -e \"require('fs/promises').unlink('.superpowers/x')\"", 'deny'],
    ["node -e \"require('fs/promises').rm('.superpowers/x')\"", 'deny'],
    ["node -e \"require('fs/promises').copyFile('.superpowers/source','ailleurs')\"", null],
    ["node -e \"require('fs/promises').copyFile('source','.superpowers/dest')\"", 'deny'],
    ["node -e \"require('fs/promises').link('.superpowers/source','ailleurs')\"", null],
    ["node -e \"require('fs/promises').symlink('source','.superpowers/dest')\"", 'deny'],
    ["node -e \"const fs={writeFileSync(){}}; fs.writeFileSync('.superpowers/x','a')\"", null],
    ["node -e \"const fs=require('fs'); function f(fs){fs.writeFileSync('.superpowers/x','a')}\"", null],
    ['cp .superpowers/source ailleurs', null], ['cp source .superpowers/dest', 'deny'],
    ['cp -f source .superpowers/dest', 'deny'], ['rm -f .superpowers/x', 'deny'], ['mv -f .superpowers/x ailleurs', 'deny'],
    ['echo x > alias/x; cd ailleurs', 'deny'], ['cd alias; echo x > x; cd ailleurs', 'deny'],
    ['Set-Content -LiteralPath alias/x -Value x', 'deny'],
    ['P=.superpowers; echo x > $P/x', 'deny'], ['P=.superpowers echo x > $P/x', null],
    ["P=.superpowers; echo x > '$P/x'", null],
    ['P=.superpowers echo ok; echo x > "$P/x"', null],
    [`node -e 'require("fs").writeFileSync(".superpowers/$X", "a")'`, 'deny'],
    [`P=.superpowers; node -e 'require("fs").writeFileSync("$P/x", "a")'`, null],
    [`P=.superpowers; node -e "require('fs').writeFileSync('$P/x', 'a')"`, 'deny'],
    ['(cd alias; cat x); echo x > ailleurs', null],
    ['gh issue comment 2498 --body "voir .superpowers/x"', null],
  ]
  try {
    for (const [command, attendu] of cas) {
      const { sortie } = await repartir({ PreToolUse: REGISTRE.PreToolUse.filter(g => g.nom === 'superpowers-ecriture') }, JSON.stringify({ hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command } }), { env: {}, cwd: racine })
      assert.equal(sortie?.hookSpecificOutput?.permissionDecision ?? null, attendu, command)
    }
  } finally { FS.rmSync(racine, { recursive: true, force: true }) }
})
test('shell : écritures refusées, lectures et citations permises', () => {
  for (const commande of [
    'echo x > .superpowers/x.md', 'cp x .superpowers/x.md', 'Set-Content -LiteralPath ".superpowers/x.md" -Value x',
    'node -e "require(\'fs\').writeFileSync(\'.superpowers/x.md\',\'x\')"',
    'sed -i s/a/b/ .superpowers/x.md',
  ]) assert.equal(verdict('Bash', { command: commande })?.decision, 'deny', commande)
  for (const commande of ['cat .superpowers/x.md', 'Get-Content .superpowers/x.md', 'gh issue comment 2494 --body "voir .superpowers/x.md"']) {
    assert.equal(verdict('Bash', { command: commande }), null, commande)
  }
})
