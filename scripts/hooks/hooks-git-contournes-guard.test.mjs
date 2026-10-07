// Bancs de la garde `hooks-git-contournes` (`scripts/hooks/hooks-git-contournes-guard.mjs`), sur le
// répartiteur réel (`lancerHook`) : les TÉMOINS passent ; les CONTRE-TÉMOINS, qui sautent `commit-msg`,
// sont refusés. #2071.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { lancerHook } from '../guards/lib/lancerHook.mjs'
import { evaluate } from './hooks-git-contournes-guard.mjs'

/** La sortie du répartiteur pour une commande `Bash` : `null` s'il se tait. */
const sortie = (command) => lancerHook('repartiteur.mjs', { hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command } }).specifique

const MSYS = '/c/tmp/claude/msg.txt'
const TEMOINS = [
  `node -e "console.log('git commit -a -F ${MSYS}')"`,
  `node scripts/ops/suivi.mjs 2071 --ajouter-etape "C2 : git commit -q -F ${MSYS} rejoué"`,
  'S=/c/tmp/scratch; cd "$S/x/depot" && git commit -m "fix(a): refs #7 — témoin"',
  `F=${MSYS}; sed -i "s/a/b/" "$F" && git commit -q -F "$F"`,
  `git commit -a -F "${MSYS}"`,
  `cat > "$TEMP/h.txt" <<'MSG'\nfix(a): refs #7 — témoin\nMSG\ngit commit -a -F "$TEMP/h.txt"`,
  `F="${MSYS}"; git commit -a -F "$F"`,
  'git commit -a -F "$TEMP/m.txt"',
  `cat > "$TEMP/h.txt" <<'MSG'\nfix(a): refs #7 — témoin\nMSG\ngit add src/a.ts && git commit -F "$TEMP/h.txt"`,
]

const CONTRE_TEMOINS = [
  'git commit --no-verify -m x',
  'git commit -nm x',
  "bash -c 'git commit --no-verify -m x'",
  'git merge --no-verify x',
  'git config core.hooksPath /dev/null',
  'git config --unset core.hooksPath',
  'git pull --no-verify',
  'git pull --no-rebase --no-edit --no-verify origin main',
  'git config --remove-section core',
  'git config --rename-section core x',
  'git config remove-section CORE',
  'git config -e',
  'git config --edit',
  'git config --global edit',
  'git config alias.ci "commit --no-verify"',
  'git config alias.ci "commit -anm"',
  'git config --global alias.ci "!git commit -n -m x"',
  'git config set alias.p "pull --no-verify"',
]

test('répartiteur : les témoins du 2026-10-07 passent, aucune garde ne reconstruit plus le commit', () => {
  for (const command of TEMOINS) assert.equal(sortie(command), null, command)
})

test('répartiteur : `--no-verify` (`pull` compris), `-n` groupé, l’écriture de `core.hooksPath`, de la section `core`, l’éditeur et l’alias qui saute sont refusés, `push` renvoyé à #2184', () => {
  for (const command of CONTRE_TEMOINS) {
    const vu = sortie(command)
    assert.equal(vu?.permissionDecision, 'deny', command)
    assert.match(vu.permissionDecisionReason, /commit-msg/, command)
  }
  assert.match(sortie('git commit --no-verify -m x').permissionDecisionReason, /`git push --no-verify` reste à #2184/)
})

test('evaluate : abréviation de `--no-verify` refusée ; lecture de `core.hooksPath`, `--amend`, `--no-edit` et `push` passent', () => {
  for (const command of ['git commit --no-veri -m x', 'git -C wt commit -anm x', 'git config set core.hooksPath x', 'git config --global core.HOOKSPATH x']) {
    assert.ok(evaluate(command), command)
  }
  for (const command of ['git commit --amend --no-edit', 'git commit -am x', 'git config --get core.hooksPath', 'git config get core.hooksPath', 'git push --no-verify', 'git log -n 3']) {
    assert.equal(evaluate(command), null, command)
  }
})

test('evaluate : `-n` de `merge`/`pull` est `--no-stat` ; lire `core.hooksPath`, un alias inoffensif ou une autre section passe', () => {
  for (const command of [
    'git merge -n x', 'git merge -nq x', 'git pull -n origin main', 'git config core.hooksPath', 'git config --global core.hooksPath',
    'git config alias.ci "commit -v"', 'git config alias.lg "log -n 3"', 'git config alias.ci', 'git config --remove-section alias',
    'git config --get alias.ci', 'git config --list',
  ]) {
    assert.equal(evaluate(command), null, command)
  }
})
