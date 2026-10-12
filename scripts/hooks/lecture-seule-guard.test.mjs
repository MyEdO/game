// Garde des types en lecture seule (#2537) : la garde RÉELLE par le répartiteur (`repartir`), sur un
// échantillon FIXE tiré du rejeu des commandes shell de lecteur, juge et verif-mecanique (14 jours au
// 2026-10-12), chemins ramenés au scratchpad forgé de la session du banc. Rien ne s'exécute.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import * as FS from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { repartir } from './repartition.mjs'
import { garde, scratchpadDeSession } from './lecture-seule-guard.mjs'
import { REGISTRE } from './registre.mjs'

const RACINE = fileURLToPath(new URL('../../', import.meta.url))
const SLUG = 'banc-lecture-seule'
const SESSION = `banc-2537-${process.pid}`
const TRANSCRIPT = join(RACINE, '.claude', 'projects', SLUG, `${SESSION}.jsonl`)
const SP = join(tmpdir(), 'claude', SLUG, SESSION, 'scratchpad')
const P = SP.split('\\').join('/')
const HORS = resolve(RACINE, '..', 'hors-banc-2537').split('\\').join('/')

test('#2537 — le scratchpad se dérive de `transcript_path` (segment après `.claude/projects/`) et de `session_id`, jamais du `cwd`', () => {
  assert.equal(scratchpadDeSession({ transcript_path: TRANSCRIPT, session_id: SESSION }), SP)
  assert.equal(scratchpadDeSession({ transcript_path: join(RACINE, '.claude/projects/s/p/subagents/agent-a.jsonl'), session_id: 'p' }, 'T'), join('T', 'claude', 's', 'p', 'scratchpad'))
  assert.equal(scratchpadDeSession({ transcript_path: join(RACINE, 'projets/s.jsonl'), session_id: 'p' }), null)
  assert.equal(scratchpadDeSession({ transcript_path: TRANSCRIPT, session_id: '..' }), null)
  assert.equal(scratchpadDeSession({ transcript_path: TRANSCRIPT, session_id: 'a/b' }), null)
  assert.equal(scratchpadDeSession({ session_id: SESSION }), null)
})

test('#2537 — échantillon du rejeu : un type en lecture seule n’écrit que dans le scratchpad de sa session', async () => {
  FS.mkdirSync(SP, { recursive: true })
  FS.writeFileSync(join(SP, 'ecrit-hors.mjs'), "import fs from 'node:fs'\nfs.writeFileSync('../hors.txt', 'x')\n")
  FS.writeFileSync(join(SP, 'ecrit-tmp.mts'), "import { mkdtempSync } from 'node:fs'\nimport { join } from 'node:path'\nimport { tmpdir } from 'node:os'\nconst d: string = mkdtempSync(join(tmpdir(), 'x'))\n")
  FS.writeFileSync(join(SP, 'ecrit-sp.mjs'), `import fs from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
fs.writeFileSync(join(tmpdir(), 'claude', '${SLUG}', '${SESSION}', 'scratchpad', 'r.txt'), 'x')
`)
  FS.writeFileSync(join(SP, 'lit.mts'), "import { readFileSync } from 'node:fs'\nconst n: number = readFileSync('package.json', 'utf8').length\nconsole.log(n)\n")
  const TMP = { TEMP: tmpdir(), TMPDIR: tmpdir() }
  /** Chaque cas : l'outil, la commande, le type, la décision attendue, un motif de la raison, et les plateformes
   *  jouées (les deux par défaut : les chemins du banc sont forgés par `resolve`/`tmpdir`, natifs de l'hôte). */
  const cas = [
    ['Bash', 'gh api repos/MyEdO/game/issues/comments/1 --jq .body > "$TMP/plan.md" 2>&1', 'juge', 'deny', /cible d'écriture non résolue \(redirection/],
    ['Bash', 'git grep -nE "x" origin/main -- src > ../.wt-tmp.txt', 'juge', 'deny', /redirection hors du scratchpad/],
    ['Bash', 'echo x > /tmp/mut.json', 'lecteur', 'deny', /redirection hors du scratchpad/],
    ['Bash', "python3 - <<'EOF'\nprint(1)\nEOF", 'juge', 'deny', /cible d'écriture non résolue \(python3/],
    ['Bash', `cd "${P}" && node ecrit-hors.mjs`, 'lecteur', 'deny', /ecrit-hors\.mjs : writeFileSync hors du scratchpad \(\.\.\/hors\.txt\)/],
    ['Bash', `npx tsx "${P}/ecrit-tmp.mts"`, 'juge', 'deny', /ecrit-tmp\.mts : écriture mkdtempSync à chemin non littéral/, { platforms: ['win32'] }],
    ['Bash', `npx tsx "${P}/ecrit-tmp.mts"`, 'juge', 'deny', /ecrit-tmp\.mts : mkdtempSync hors du scratchpad \(\/tmp\/x\)/, { platforms: ['linux'] }],
    ['Bash', `sed -i s/a/b/ "${P}/lit.mts" && npx tsx "${P}/lit.mts"`, 'juge', 'deny', /non résolue \(script .*lit\.mts écrit par la commande qui le lance, hors d'un heredoc/],
    ['Bash', `node ${HORS}/compo.mjs`, 'verif-mecanique', 'deny', /compo\.mjs ni dans le scratchpad, ni suivi par le dépôt/],
    ['PowerShell', `Get-Content README.md | Out-File ${HORS}/x.txt`, 'lecteur', 'deny', /out-file hors du scratchpad/],
    ['Bash', 'git status > /dev/null 2>&1', 'lecteur', null],
    ['Bash', 'ls 2>NUL', 'juge', null, undefined, { platforms: ['win32'] }],
    ['PowerShell', 'Get-ChildItem 2>$null', 'juge', null],
    ['Bash', `mkdir -p "${P}" && cd "${P}" && echo x > sortie.txt`, 'juge', null],
    ['Bash', `cat > "${P}/a.mjs" <<'EOF'\nimport fs from 'node:fs'\nfs.writeFileSync('${P}/r.txt', 'x')\nEOF\nnode "${P}/a.mjs"`, 'lecteur', null],
    ['Bash', `cat > "${P}/b.mjs" <<'EOF'\nimport fs from 'node:fs'\nfs.writeFileSync('${HORS}/r.txt', 'x')\nEOF\nnode "${P}/b.mjs"`, 'lecteur', 'deny', /b\.mjs : writeFileSync hors du scratchpad \(.*hors-banc-2537\/r\.txt\)/],
    ['Bash', `cat > "${P}/c.mjs" <<EOF\nimport fs from 'node:fs'\nfs.writeFileSync('${HORS}/r.txt', 'x')\nEOF\nnode "${P}/c.mjs"`, 'lecteur', 'deny', /c\.mjs : writeFileSync hors du scratchpad/],
    ['Bash', 'git commit -m x', 'lecteur', 'deny', /non résolue \(git commit/],
    ['Bash', 'npm run build', 'juge', 'deny', /non résolue \(npm run build/],
    ['Bash', 'npm test -- scripts/a.test.mjs', 'juge', null],
    ['Bash', 'python --version', 'juge', null],
    ['Bash', `for f in a b; do echo x > "${P}/$f.txt"; done`, 'lecteur', null],
    ['Bash', 'for f in a b; do echo x > ../$f.txt; done', 'lecteur', 'deny', /redirection hors du scratchpad/],
    ['PowerShell', `$p='${HORS}/x.txt'; Set-Content -Path $p -Value 1`, 'lecteur', 'deny', /set-content hors du scratchpad/i],
    ['Bash', 'echo x > /dev/stderr', 'lecteur', null],
    ['Bash', 'echo x > "$TEMP/x.txt"', 'lecteur', 'deny', /non résolue \(redirection/],
    ['Bash', 'echo x > "$TEMP/x.txt"', 'lecteur', null, undefined, { env: { TEMP: SP } }],
    ['Bash', 'ls 2>NUL', 'juge', 'deny', /redirection hors du scratchpad/, { platforms: ['linux'] }],
    ['Bash', `npx tsx "${P}/lit.mts"`, 'juge', null],
    ['Bash', 'node scripts/agents/compat-cli.mjs check', 'verif-mecanique', null],
    ['Bash', 'echo x > ../hors.txt', 'codeur', null],
    ['Bash', 'echo x > ../hors.txt', 'lecteur', 'deny', /hors du scratchpad.* — canal : écrire sous le scratchpad de la session [(].*banc-lecture-seule.*scratchpad[)], par la commande ou par un script JS, que la garde lit[.]/],
    ['Bash', 'git hash-object scripts/hooks/registre.mjs', 'juge', null],
    ['Bash', 'git hash-object -w scripts/hooks/registre.mjs', 'juge', 'deny', /non résolue [(]git hash-object/],
    ['Bash', 'git merge-tree --write-tree main HEAD', 'juge', 'deny', /non résolue [(]git merge-tree/],
    ['Bash', `node "${P}/ecrit-sp.mjs"`, 'lecteur', null, undefined, { env: TMP }],
    ['Bash', `node "${P}/ecrit-sp.mjs"`, 'lecteur', 'deny', /ecrit-sp[.]mjs : écriture writeFileSync à chemin non littéral/, { env: {}, platforms: ['win32'] }],
    ['Bash', 'echo x > ../hors.txt', undefined, null],
    ['Bash', 'F="$TEMP"/x.txt; echo x > "$F"', 'lecteur', null, undefined, { env: { TEMP: SP } }],
    ['Bash', 'export F="$TEMP/x.txt" && echo x > "$F"', 'lecteur', null, undefined, { env: { TEMP: SP } }],
    ['Bash', 'F="$TEMP"/x.txt; echo x > "$F"', 'lecteur', 'deny', /non résolue \(redirection/],
    ['Bash', `D="${HORS}"; cat > "${P}/d.mjs" <<EOF\nimport fs from 'node:fs'\nfs.writeFileSync('$D/r.txt', 'x')\nEOF\nnode "${P}/d.mjs"`, 'lecteur', 'deny', /d\.mjs : writeFileSync hors du scratchpad \(.*hors-banc-2537\/r\.txt\)/],
    ['Bash', `D="${P}"; cat > "${P}/e.mjs" <<EOF\nimport fs from 'node:fs'\nfs.writeFileSync('$D/r.txt', 'x')\nEOF\nnode "${P}/e.mjs"`, 'lecteur', null],
    ['Bash', `cat > "${P}/f.mjs" <<EOF\nimport fs from 'node:fs'\nfs.writeFileSync('$INCONNUE/r.txt', 'x')\nEOF\nnode "${P}/f.mjs"`, 'lecteur', 'deny', /non résolue \(script .*f\.mjs écrit par la commande qui le lance/],
    ['Bash', 'git config user.name', 'juge', null],
    ['Bash', 'git config get user.name', 'juge', null],
    ['Bash', 'git config user.name x', 'juge', 'deny', /non résolue [(]git config/],
    ['Bash', 'git config list --global x', 'juge', 'deny', /non résolue [(]git config/],
    ['Bash', 'git symbolic-ref --short HEAD', 'juge', null],
    ['Bash', 'git symbolic-ref HEAD refs/heads/x', 'juge', 'deny', /non résolue [(]git symbolic-ref/],
    ['Bash', 'git remote -v show origin', 'juge', null],
    ['Bash', 'git remote add o https://x', 'juge', 'deny', /non résolue [(]git remote/],
    ['Bash', 'git branch --contains HEAD', 'juge', null],
    ['Bash', 'git branch -D x', 'juge', 'deny', /non résolue [(]git branch/],
    ['Bash', 'git tag -l', 'juge', null],
    ['Bash', 'git tag -d v1', 'juge', 'deny', /non résolue [(]git tag/],
    ['Bash', 'npm test -- -u', 'juge', 'deny', /non résolue [(]npm test/],
    ['Bash', 'npx vitest run --update', 'juge', 'deny', /non résolue [(]vitest run --update dans/],
    ['Bash', 'curl -sofichier https://x', 'juge', 'deny', /curl hors du scratchpad/],
    ['Bash', `curl -so "${P}/f.txt" https://x`, 'juge', null],
    ['Bash', 'git archive -o../a.zip HEAD', 'juge', 'deny', /hors du scratchpad/],
    ['Bash', `npx vitest run --config "${P}/ecrit-hors.mjs"`, 'juge', 'deny', /ecrit-hors\.mjs : writeFileSync hors du scratchpad/],
    ['Bash', `node -r "${P}/ecrit-hors.mjs" -e 1`, 'juge', 'deny', /ecrit-hors\.mjs : writeFileSync hors du scratchpad/],
    ['Bash', `node --import=file:///${P.replace(/^\//, '')}/ecrit-hors.mjs -e 1`, 'juge', 'deny', /ecrit-hors\.mjs : writeFileSync hors du scratchpad/],
    ['Bash', 'node --test', 'juge', 'deny', /non résolue \(js \(code non lu\) dans « node --test »\)/],
    ['Bash', `source "${P}/lit.mts"`, 'juge', 'deny', /lit\.mts : langage sh non lu/],
    ['Bash', 'find .. -name x -exec rm {} \\;', 'lecteur', 'deny', /rm hors du scratchpad/],
    ['Bash', `find "${P}" -name x -exec rm {} +`, 'lecteur', null],
  ]
  try {
    for (const [tool_name, command, agent_type, attendu, motif, { env = {}, platforms = ['win32', 'linux'] } = {}] of cas) for (const platform of platforms) {
      const { sortie } = await repartir({ PreToolUse: REGISTRE.PreToolUse.filter((g) => g === garde) }, JSON.stringify({
        hook_event_name: 'PreToolUse', tool_name, tool_input: { command }, session_id: SESSION, transcript_path: TRANSCRIPT, agent_id: 'a1', agent_type,
      }), { env, cwd: RACINE, platform })
      const quoi = `${platform} ${agent_type} ${tool_name} ${command}`
      assert.equal(sortie?.hookSpecificOutput?.permissionDecision ?? null, attendu, quoi)
      if (motif) assert.match(sortie.hookSpecificOutput.permissionDecisionReason.split('\\').join('/'), motif, quoi)
    }
    const sansTranscript = await repartir({ PreToolUse: REGISTRE.PreToolUse.filter((g) => g === garde) }, JSON.stringify({
      hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: `echo x > "${P}/x.txt"` }, session_id: SESSION, agent_type: 'lecteur',
    }), { env: {}, cwd: RACINE })
    assert.match(sansTranscript.sortie.hookSpecificOutput.permissionDecisionReason, /scratchpad de session non dérivable/)
  } finally {
    FS.rmSync(join(tmpdir(), 'claude', SLUG, SESSION), { recursive: true, force: true })
  }
})
