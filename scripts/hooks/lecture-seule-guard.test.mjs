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
/** `texte` en motif littéral d'une regex. */
const echapper = (texte) => texte.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
/** La suite du banc que `vitest run --dir` lance et qui écrit hors du scratchpad. */
const SUITE_ECRIT = 'x.test.mjs'

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
  FS.mkdirSync(join(SP, 'dir-ecrit'), { recursive: true })
  FS.mkdirSync(join(SP, 'dir-lit'), { recursive: true })
  FS.writeFileSync(join(SP, 'dir-ecrit', SUITE_ECRIT), "import fs from 'node:fs'\nfs.writeFileSync('../hors.txt', 'x')\n")
  FS.writeFileSync(join(SP, 'dir-lit', 'y.test.mjs'), "import fs from 'node:fs'\nfs.readFileSync('package.json')\n")
  FS.writeFileSync(join(SP, 'vitest.config.mjs'), "export default { root: 'dir-ecrit' }\n")
  FS.mkdirSync(join(SP, 'dir-abs'), { recursive: true })
  FS.writeFileSync(join(SP, 'dir-abs', 'z.test.mjs'), `import fs from 'node:fs'\nfs.writeFileSync('${HORS}/r.txt', 'x')\n`)
  const TMP = { TEMP: tmpdir(), TMP: tmpdir(), TMPDIR: tmpdir() }
  const R = RACINE.split('\\').join('/').replace(/\/$/, '')
  /** Chaque cas : l'outil, la commande, le type, la décision attendue, un motif de la raison, et les plateformes
   *  où il se joue (les deux par défaut), jouées sur l'HÔTE seulement : les chemins du banc sont forgés par
   *  `resolve`/`tmpdir`, natifs de l'hôte, et la garde résout par le `node:path` de sa `platform`. */
  const cas = [
    ['Bash', 'gh api repos/MyEdO/game/issues/comments/1 --jq .body > "$TMP/plan.md" 2>&1', 'juge', 'deny', /redirection hors du scratchpad/, { env: TMP }],
    ['Bash', 'gh api repos/MyEdO/game/issues/comments/1 --jq .body > "$INCONNUE/plan.md"', 'juge', null],
    ['Bash', 'git grep -nE "x" origin/main -- src > ../.wt-tmp.txt', 'juge', 'deny', /redirection hors du scratchpad/],
    ['Bash', 'echo x > /tmp/mut.json', 'lecteur', 'deny', /redirection hors du scratchpad/],
    ['Bash', "python3 - <<'EOF'\nprint(1)\nEOF", 'juge', null],
    ['Bash', 'python -c "print(1)"', 'juge', null],
    ['Bash', `cd "${P}" && node ecrit-hors.mjs`, 'lecteur', 'deny', /ecrit-hors\.mjs : writeFileSync hors du scratchpad \(\.\.\/hors\.txt\)/],
    ['Bash', `npx tsx "${P}/ecrit-tmp.mts"`, 'juge', null, undefined, { platforms: ['win32'] }],
    ['Bash', `npx tsx "${P}/ecrit-tmp.mts"`, 'juge', 'deny', /ecrit-tmp\.mts : mkdtempSync hors du scratchpad \(\/tmp\/x\)/, { platforms: ['linux'] }],
    ['Bash', `sed -i s/a/b/ "${P}/lit.mts" && npx tsx "${P}/lit.mts"`, 'juge', null],
    ['Bash', `node ${HORS}/compo.mjs`, 'verif-mecanique', null],
    ['PowerShell', `Get-Content README.md | Out-File ${HORS}/x.txt`, 'lecteur', 'deny', /out-file hors du scratchpad/],
    ['Bash', 'git status > /dev/null 2>&1', 'lecteur', null],
    ['Bash', 'ls 2>NUL', 'juge', null, undefined, { platforms: ['win32'] }],
    ['PowerShell', 'Get-ChildItem 2>$null', 'juge', null],
    ['Bash', `mkdir -p "${P}" && cd "${P}" && echo x > sortie.txt`, 'juge', null],
    ['Bash', `cat > "${P}/a.mjs" <<'EOF'\nimport fs from 'node:fs'\nfs.writeFileSync('${P}/r.txt', 'x')\nEOF\nnode "${P}/a.mjs"`, 'lecteur', null],
    ['Bash', `cat > "${P}/b.mjs" <<'EOF'\nimport fs from 'node:fs'\nfs.writeFileSync('${HORS}/r.txt', 'x')\nEOF\nnode "${P}/b.mjs"`, 'lecteur', 'deny', /b\.mjs : writeFileSync hors du scratchpad \(.*hors-banc-2537\/r\.txt\)/],
    ['Bash', `cat > "${P}/c.mjs" <<EOF\nimport fs from 'node:fs'\nfs.writeFileSync('${HORS}/r.txt', 'x')\nEOF\nnode "${P}/c.mjs"`, 'lecteur', 'deny', /c\.mjs : writeFileSync hors du scratchpad/],
    ['Bash', `cat > "${P}/g.mjs" <<'EOF'\nimport { spawnSync } from 'node:child_process'\nspawnSync('cat', ['-n', process.argv[2]])\nspawnSync(process.execPath, ['--test', 'a.test.mjs'])\nEOF\nnode "${P}/g.mjs" HEAD`, 'juge', null],
    ['Bash', `cat > "${P}/h.mjs" <<'EOF'\nimport { spawnSync } from 'node:child_process'\nconst f = process.env.X\nspawnSync('rm', ['-f', f])\nEOF\nnode "${P}/h.mjs"`, 'juge', 'deny', /h\.mjs : spawnSync « 'rm' '-f' \$argument_non_constant » : rm : écrivain à cible non résolue/],
    ['Bash', `cat > "${P}/i.mjs" <<'EOF'\nimport { join } from 'node:path'\nimport { pathToFileURL } from 'node:url'\nawait import(pathToFileURL(join(process.argv[2], 'x.mjs')).href)\nEOF\nnode "${P}/i.mjs" "${R}"`, 'juge', null],
    ['Bash', `cat > "${P}/j.mjs" <<'EOF'\nimport { execFileSync, spawnSync } from 'node:child_process'\nconst a = process.argv.slice(2)\nexecFileSync('npm.cmd', a)\nspawnSync('npx', a)\nspawnSync('gh', a)\nEOF\nnode "${P}/j.mjs" ci`, 'juge', null],
    ['Bash', 'git "$SOUS" -1', 'juge', null],
    ['Bash', 'git commit -m x', 'lecteur', 'deny', /git commit : écrivain à cible non résolue .* — canal : la sous-commande de lecture de git/],
    ['Bash', 'npm ci', 'juge', 'deny', /npm ci : écrivain à cible non résolue .* — canal : `npx tsc --noEmit`, `npx vitest run <fichiers>` ou `npm test -- <fichiers>`[.]$/],
    ['Bash', `cd "${R}" && npm run typecheck > "${P}/tc.txt" 2>&1; echo $?`, 'lecteur', null],
    ['Bash', 'npm test -- scripts/a.test.mjs', 'juge', null],
    ['Bash', 'python --version', 'juge', null],
    ['Bash', `for f in a b; do echo x > "${P}/$f.txt"; done`, 'lecteur', null],
    ['Bash', 'for f in a b; do echo x > ../$f.txt; done', 'lecteur', 'deny', /redirection hors du scratchpad/],
    ['PowerShell', `$p='${HORS}/x.txt'; Set-Content -Path $p -Value 1`, 'lecteur', 'deny', /set-content hors du scratchpad/i],
    ['Bash', 'echo x > /dev/stderr', 'lecteur', null],
    ['Bash', 'echo x > "$TEMP/x.txt"', 'lecteur', 'deny', /redirection hors du scratchpad/, { env: TMP }],
    ['Bash', 'echo x > "$TEMP/x.txt"', 'lecteur', null, undefined, { env: { TEMP: SP } }],
    ['Bash', 'ls 2>NUL', 'juge', 'deny', /redirection hors du scratchpad/, { platforms: ['linux'] }],
    ['Bash', `npx tsx "${P}/lit.mts"`, 'juge', null],
    ['Bash', 'node scripts/agents/compat-cli.mjs check', 'verif-mecanique', null],
    ['Bash', 'echo x > ../hors.txt', 'codeur', null],
    ['Bash', 'echo x > ../hors.txt', 'lecteur', 'deny', /hors du scratchpad.* — canal : écris sous `.*banc-lecture-seule.*scratchpad`[.]$/],
    ['Bash', 'git hash-object scripts/hooks/registre.mjs', 'juge', null],
    ['Bash', 'git hash-object -w scripts/hooks/registre.mjs', 'juge', 'deny', /git hash-object : écrivain/],
    ['Bash', 'git merge-tree --write-tree main HEAD', 'juge', 'deny', /git merge-tree : écrivain/],
    ['Bash', 'git fetch -q origin', 'juge', 'deny', /git fetch : écrivain/],
    ['Bash', 'git reflog HEAD -5', 'juge', null],
    ['Bash', 'git reflog exists HEAD', 'juge', null],
    ['Bash', 'git reflog expire --all', 'juge', 'deny', /git reflog : écrivain/],
    ['Bash', `node "${P}/ecrit-sp.mjs"`, 'lecteur', null, undefined, { env: TMP }],
    ['Bash', `node "${P}/ecrit-sp.mjs"`, 'lecteur', null, undefined, { env: {}, platforms: ['win32'] }],
    ['Bash', 'echo x > ../hors.txt', undefined, null],
    ['Bash', 'F="$TEMP"/x.txt; echo x > "$F"', 'lecteur', null, undefined, { env: { TEMP: SP } }],
    ['Bash', 'export F="$TEMP/x.txt" && echo x > "$F"', 'lecteur', null, undefined, { env: { TEMP: SP } }],
    ['Bash', 'F="$TEMP"/x.txt; echo x > "$F"', 'lecteur', 'deny', /redirection hors du scratchpad/, { env: TMP }],
    ['Bash', `D="${HORS}"; cat > "${P}/d.mjs" <<EOF\nimport fs from 'node:fs'\nfs.writeFileSync('$D/r.txt', 'x')\nEOF\nnode "${P}/d.mjs"`, 'lecteur', 'deny', /d\.mjs : writeFileSync hors du scratchpad \(.*hors-banc-2537\/r\.txt\)/],
    ['Bash', `D="${P}"; cat > "${P}/e.mjs" <<EOF\nimport fs from 'node:fs'\nfs.writeFileSync('$D/r.txt', 'x')\nEOF\nnode "${P}/e.mjs"`, 'lecteur', null],
    ['Bash', `cat > "${P}/f.mjs" <<EOF\nimport fs from 'node:fs'\nfs.writeFileSync('$INCONNUE/r.txt', 'x')\nEOF\nnode "${P}/f.mjs"`, 'lecteur', null],
    ['Bash', 'git config user.name', 'juge', null],
    ['Bash', 'git config get user.name', 'juge', null],
    ['Bash', 'git config user.name x', 'juge', 'deny', /git config : écrivain/],
    ['Bash', 'git config list --global x', 'juge', 'deny', /git config : écrivain/],
    ['Bash', 'git symbolic-ref --short HEAD', 'juge', null],
    ['Bash', 'git symbolic-ref HEAD refs/heads/x', 'juge', 'deny', /git symbolic-ref : écrivain/],
    ['Bash', 'git remote -v show origin', 'juge', null],
    ['Bash', 'git remote add o https://x', 'juge', 'deny', /git remote : écrivain/],
    ['Bash', 'git branch --contains HEAD', 'juge', null],
    ['Bash', 'git branch -D x', 'juge', 'deny', /git branch : écrivain/],
    ['Bash', 'git tag -l', 'juge', null],
    ['Bash', 'git tag -d v1', 'juge', 'deny', /git tag : écrivain/],
    ['Bash', 'npm test -- -u', 'juge', 'deny', /npm test -- -u : écrivain/],
    ['Bash', 'npx vitest run --update', 'juge', 'deny', /npx vitest run --update : écrivain/],
    ['Bash', 'npx tsc -p .', 'juge', 'deny', /npx tsc -p \. : écrivain .* — canal : un outil de la table de lecture de `npx`/],
    ['Bash', 'npx tsc --noEmit', 'juge', null],
    ['Bash', 'npx eslint src/engine', 'juge', null],
    ['Bash', 'npx eslint --fix src/engine', 'juge', 'deny', /npx eslint --fix src\/engine : écrivain/],
    ['Bash', 'npx -y cowsay hi', 'juge', 'deny', /npx cowsay hi : écrivain/],
    ['Bash', 'npx vitest run src/engine --reporter=json --outputFile=results.json', 'juge', 'deny', /vitest hors du scratchpad \(.*\/results\.json\)/],
    ['Bash', 'npx vitest run src/engine --reporter json --outputFile results.json', 'juge', 'deny', /vitest hors du scratchpad \(.*\/results\.json\)/],
    ['Bash', `npx vitest run src/engine --outputFile="${P}/r.json"`, 'juge', null],
    ['Bash', 'npm test -- src/engine --coverage', 'juge', 'deny', /npm hors du scratchpad \(.*\/coverage\)/],
    ['Bash', 'node --test --test-reporter=tap --test-reporter-destination=out.tap x.test.mjs', 'juge', 'deny', /node hors du scratchpad \(.*\/out\.tap\)/],
    ['Bash', 'node --test --test-reporter-destination stdout x.test.mjs', 'juge', null],
    ['Bash', `npx vitest run --dir "${P}/dir-ecrit"`, 'juge', 'deny', new RegExp(`${echapper(SUITE_ECRIT)} : writeFileSync hors du scratchpad ${echapper('(../hors.txt)')}`)],
    ['Bash', `npx vitest run --dir "${P}/dir-lit"`, 'juge', null],
    ['Bash', 'gh issue view 1 --json body --jq .body', 'juge', null],
    ['Bash', 'gh api repos/x/y/issues/1 --jq .body', 'juge', null],
    ['Bash', 'gh api repos/x/y/issues -X GET -f state=open', 'juge', null],
    ['Bash', 'gh api repos/x/y/issues -X POST -f title=x', 'juge', 'deny', /gh api .* : écrivain/],
    ['Bash', 'gh pr checkout 2583', 'juge', 'deny', /gh pr checkout 2583 : écrivain .* — canal : la sous-commande de lecture de `gh` [(]`issue view`, `pr view`, `run view`, `api` en GET[)][.]$/],
    ['Bash', 'gh run download 1', 'juge', 'deny', /gh run download 1 : écrivain/],
    ['Bash', 'wget https://example.com/x.json', 'juge', 'deny', new RegExp(`wget hors du scratchpad \\(${echapper(R)}\\)`)],
    ['Bash', `wget -O "${P}/x.json" https://example.com/x.json`, 'juge', null],
    ['Bash', 'curl -sofichier https://x', 'juge', 'deny', new RegExp(`curl hors du scratchpad \\(${echapper(R)}/fichier\\)`)],
    ['Bash', 'curl -sO https://x/y.json', 'juge', 'deny', new RegExp(`curl hors du scratchpad \\(${echapper(R)}\\)`)],
    ['Bash', `curl -sO --output-dir "${P}" https://x/y.json`, 'juge', null],
    ['Bash', `curl -so "${P}/f.txt" https://x`, 'juge', null],
    ['Bash', 'git archive -o../a.zip HEAD', 'juge', 'deny', /hors du scratchpad/],
    ['Bash', `npx vitest run --config "${P}/ecrit-hors.mjs"`, 'juge', 'deny', /ecrit-hors\.mjs : writeFileSync hors du scratchpad/],
    ['Bash', `node -r "${P}/ecrit-hors.mjs" -e 1`, 'juge', 'deny', /ecrit-hors\.mjs : writeFileSync hors du scratchpad/],
    ['Bash', `node --import=file:///${P.replace(/^\//, '')}/ecrit-hors.mjs -e 1`, 'juge', 'deny', /ecrit-hors\.mjs : writeFileSync hors du scratchpad/],
    ['Bash', 'node --test', 'juge', null],
    ['Bash', `cp src/gameIso/stage/GameStage3D.tsx "${P}/GameStage3D.bak" && perl -i -pe 's/x/y/' src/gameIso/stage/GameStage3D.tsx`, 'juge', 'deny', /perl hors du scratchpad/],
    ['Bash', `perl -i -pe 's/x/y/' "${P}/a.txt"`, 'juge', null],
    ['Bash', 'tsc', 'juge', 'deny', /tsc : écrivain .* — canal : un outil de la table de lecture de `npx`/],
    ['Bash', 'gh pr merge --help', 'juge', null],
    ['Bash', 'echo x > ~/x.txt', 'juge', 'deny', /redirection hors du scratchpad/, { env: { HOME: HORS, USERPROFILE: HORS } }],
    ['PowerShell', 'iwr https://x -OutFile o.txt', 'juge', 'deny', /iwr hors du scratchpad/],
    ['PowerShell', `Expand-Archive a.zip -DestinationPath "${P}/d"`, 'juge', null],
    ['Bash', `cd "${P}" && npx vitest run dir-ecrit`, 'juge', 'deny', /writeFileSync hors du scratchpad/],
    ['Bash', `npx vitest run "${P}/dir-ecrit"`, 'juge', 'deny', /writeFileSync hors du scratchpad/],
    ['Bash', `cd "${P}/dir-abs" && npx vitest run`, 'juge', 'deny', /z.test.mjs : writeFileSync hors du scratchpad/],
    ['Bash', `npx vitest run --config "${P}/vitest.config.mjs"`, 'juge', 'deny', /writeFileSync hors du scratchpad/],
    ['Bash', `source "${P}/lit.mts"`, 'juge', null],
    ['Bash', 'find .. -name x -exec rm {} \\;', 'lecteur', 'deny', /rm hors du scratchpad/],
    ['Bash', `find "${P}" -name x -exec rm {} +`, 'lecteur', null],
    ['Bash', 'rm -f "$INCONNUE/x"', 'lecteur', 'deny', /rm : écrivain à cible non résolue .* — canal : une cible littérale sous `/],
    ['PowerShell', `cd "${P}"\\; echo x > out.txt`, 'juge', null],
    ['Bash', `cd "${P}"\\; echo x > out.txt`, 'juge', 'deny', /redirection hors du scratchpad/],
  ]
  try {
    for (const [tool_name, command, agent_type, attendu, motif, { env = {}, platforms = ['win32', 'linux'] } = {}] of cas) for (const platform of platforms.filter((p) => (p === 'win32') === (process.platform === 'win32'))) {
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
