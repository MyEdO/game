// Garde des types en lecture seule (#2537) : la garde RÉELLE, sur un échantillon FIXE tiré du rejeu des commandes
// shell de lecteur, juge et verif-mecanique (14 jours au 2026-10-12), chemins ramenés au scratchpad forgé de la session
// du banc, jouée sous win32 ET linux sur tout hôte : la plateforme de l'hôte par le répartiteur (`repartir`), l'autre par
// `garde.evaluer` sur une racine et un répertoire temporaire forgés, son disque lu sur celui de l'hôte. Rien ne s'exécute.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import * as FS from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { repartir } from './repartition.mjs'
import { BUDGET_ANALYSE_MS, COUT_SCRIPT_MS, COUT_SESSION_MS, DEBIT_ANALYSE_JS, MARGE_BUDGET, choisieParVitest, garde, scratchpadDeSession } from './lecture-seule-guard.mjs'
import { ATTENTE_BARRIERE } from './barriere-outil.mjs'
import { SURFACE_CLAUDE, aplatirHooks } from '../agents/compat-core.mjs'
import { REGISTRE } from './registre.mjs'
import { cheminsDe } from '../guards/lib/commandeShell.mjs'
import { estSuiteVitest } from '../guards/lib/fichierVitest.mjs'

const RACINE = fileURLToPath(new URL('../../', import.meta.url))
const SLUG = 'banc-lecture-seule'
const SESSION = `banc-2537-${process.pid}`
const TRANSCRIPT = join(RACINE, '.claude', 'projects', SLUG, `${SESSION}.jsonl`)
/** Le dossier de Claude Code sous le répertoire temporaire, pour `platform` (`scratchpadDeSession`). */
const dossierClaude = (platform) => (platform === 'win32' ? 'claude' : `claude-${process.getuid?.()}`)
const DOSSIER_CLAUDE = dossierClaude(process.platform)
const SP = join(tmpdir(), DOSSIER_CLAUDE, SLUG, SESSION, 'scratchpad')
/** `texte` en motif littéral d'une regex. */
const echapper = (texte) => texte.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
/** La suite du banc que `vitest run --dir` lance et qui écrit hors du scratchpad. */
const SUITE_ECRIT = 'x.test.mjs'
/** Lecture et listage, sur l'hôte, du chemin `relatif` sous une racine de l'hôte (`RACINE` ou `tmpdir()`). */
const lireSous = (base, relatif) => FS.readFileSync(join(base, relatif), 'utf8')
const listerSous = (base, relatif) => FS.readdirSync(join(base, relatif), { recursive: true, withFileTypes: true })

test('#2537 — le scratchpad se dérive de `transcript_path` (segment après `.claude/projects/`) et de `session_id`, jamais du `cwd`', () => {
  assert.equal(scratchpadDeSession({ transcript_path: TRANSCRIPT, session_id: SESSION }), SP)
  assert.equal(scratchpadDeSession({ transcript_path: join(RACINE, '.claude/projects/s/p/subagents/agent-a.jsonl'), session_id: 'p' }, 'T'), join('T', DOSSIER_CLAUDE, 's', 'p', 'scratchpad'))
  assert.equal(scratchpadDeSession({ transcript_path: '/r/.claude/projects/s/p.jsonl', session_id: 'p' }, '/tmp', 'linux', 0), '/tmp/claude-0/s/p/scratchpad')
  assert.equal(scratchpadDeSession({ transcript_path: 'C:\\r\\.claude\\projects\\s\\p.jsonl', session_id: 'p' }, 'C:\\T', 'win32'), 'C:\\T\\claude\\s\\p\\scratchpad')
  assert.equal(scratchpadDeSession({ transcript_path: join(RACINE, 'projets/s.jsonl'), session_id: 'p' }), null)
  assert.equal(scratchpadDeSession({ transcript_path: TRANSCRIPT, session_id: '..' }), null)
  assert.equal(scratchpadDeSession({ transcript_path: TRANSCRIPT, session_id: 'a/b' }), null)
  assert.equal(scratchpadDeSession({ session_id: SESSION }), null)
})

test('#2537 — échantillon du rejeu : un type en lecture seule n’écrit que dans le scratchpad de sa session', async () => {
  FS.mkdirSync(SP, { recursive: true })
  FS.writeFileSync(join(SP, 'ecrit-hors.mjs'), "import fs from 'node:fs'\nfs.writeFileSync('../hors.txt', 'x')\n")
  FS.writeFileSync(join(SP, 'ecrit-tmp.mts'), "import { mkdtempSync } from 'node:fs'\nimport { join } from 'node:path'\nimport { tmpdir } from 'node:os'\nconst d: string = mkdtempSync(join(tmpdir(), 'x'))\n")
  for (const platform of ['win32', 'linux']) FS.writeFileSync(join(SP, `ecrit-sp-${platform}.mjs`), `import fs from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
fs.writeFileSync(join(tmpdir(), '${dossierClaude(platform)}', '${SLUG}', '${SESSION}', 'scratchpad', 'r.txt'), 'x')
`)
  FS.writeFileSync(join(SP, 'lit.mts'), "import { readFileSync } from 'node:fs'\nconst n: number = readFileSync('package.json', 'utf8').length\nconsole.log(n)\n")
  FS.mkdirSync(join(SP, 'dir-ecrit'), { recursive: true })
  FS.mkdirSync(join(SP, 'dir-lit'), { recursive: true })
  FS.writeFileSync(join(SP, 'dir-ecrit', SUITE_ECRIT), "import fs from 'node:fs'\nfs.writeFileSync('../hors.txt', 'x')\n")
  FS.writeFileSync(join(SP, 'dir-lit', 'y.test.mjs'), "import fs from 'node:fs'\nfs.readFileSync('package.json')\n")
  FS.writeFileSync(join(SP, 'vitest.config.mjs'), "export default { root: 'dir-ecrit' }\n")
  FS.writeFileSync(join(SP, 'vitest.dir.config.mjs'), "export default { root: 'dir-lit', test: { dir: 'dir-abs' } }\n")
  FS.writeFileSync(join(SP, 'vitest.calc.config.mjs'), "export default { root: process.env.RACINE }\n")
  FS.writeFileSync(join(SP, 'k.mjs'), "import fs from 'node:fs'\nfs.writeFileSync('/hors-banc-2537/k.txt', 'x')\n")
  FS.mkdirSync(join(SP, 'dir-abs'), { recursive: true })
  FS.writeFileSync(join(SP, 'dir-abs', 'z.test.mjs'), "import fs from 'node:fs'\nfs.writeFileSync('/hors-banc-2537/r.txt', 'x')\n")
  FS.mkdirSync(join(SP, 'fx', 'sous'), { recursive: true })
  FS.writeFileSync(join(SP, 'fx', 'sous', 'a-sonde.test.mjs'), "import { writeFileSync } from 'node:fs'\nwriteFileSync('/hors-banc-2537/a.txt', 'a')\n")
  FS.writeFileSync(join(SP, 'fx', 'sous', 'b-autre.test.mjs'), "import { writeFileSync } from 'node:fs'\nwriteFileSync('/hors-banc-2537/b.txt', 'a')\n")
  FS.mkdirSync(join(SP, 'nm', 'node_modules', 'pkg'), { recursive: true })
  FS.writeFileSync(join(SP, 'nm', 'node_modules', 'pkg', 'w.test.mjs'), "import fs from 'node:fs'\nfs.writeFileSync('/hors-banc-2537/w.txt', 'x')\n")
  FS.writeFileSync(join(SP, 'fx', 'sous', 'c-lit.test.mjs'), "import { readFileSync } from 'node:fs'\nreadFileSync('package.json')\n")
  /** Le monde du banc sous `platform` : celui de l'hôte, ou une racine et un répertoire temporaire forgés pour la
   *  plateforme étrangère, son disque (`lire`, `lister`) ramené à celui de l'hôte. */
  const mondeDe = (platform) => {
    const chemins = cheminsDe(platform), hote = (platform === 'win32') === (process.platform === 'win32')
    const volume = platform === 'win32' ? 'C:' : '/'
    const racine = hote ? RACINE : chemins.join(volume, '/banc/depot'), tmp = hote ? tmpdir() : chemins.join(volume, '/banc/tmp')
    const oblique = (chemin) => chemin.split('\\').join('/')
    const sous = (chemin, base) => { const o = oblique(chemin), b = oblique(base).replace(/\/$/, ''); return o.startsWith(b) ? `.${o.slice(b.length)}` : null }
    const vers = (relatif, base) => relatif === null ? null : oblique(base).replace(/\/$/, '') + relatif.slice(1)
    const claude = (relatif, de, vers) => relatif?.replace(`./${dossierClaude(de)}/`, `./${dossierClaude(vers)}/`) ?? null
    const versMonde = (chemin) => chemins.normalize(vers(claude(sous(chemin, tmpdir()), process.platform, platform), tmp) ?? vers(sous(chemin, RACINE), racine) ?? chemin)
    const hors = () => { throw Object.assign(new Error('hors du monde forgé'), { code: 'ENOENT' }) }
    const enHote = (chemin, ouvrir) => { const t = claude(sous(chemin, tmp), platform, process.platform), r = sous(chemin, racine); return t !== null ? ouvrir(tmpdir(), t) : r !== null ? ouvrir(RACINE, r) : hors() }
    const sp = chemins.join(tmp, dossierClaude(platform), SLUG, SESSION, 'scratchpad')
    return {
      platform, hote, racine, tmp, transcript: chemins.join(racine, '.claude', 'projects', SLUG, `${SESSION}.jsonl`), SP: sp, P: oblique(sp),
      HORS: oblique(chemins.resolve(racine, '..', 'hors-banc-2537')), R: oblique(racine).replace(/\/$/, ''), TMP: { TEMP: tmp, TMP: tmp, TMPDIR: tmp },
      lire: (chemin) => { try { return { texte: enHote(chemin, lireSous) } } catch (e) { return { raison: `illisible (${e?.code})` } } },
      lister: (dossier) => { try { const entrees = enHote(dossier, listerSous); return { suites: entrees.filter((e) => e.isFile() && estSuiteVitest(e.name) && !/[\\/]node_modules(?:[\\/]|$)/.test(e.parentPath)).map((e) => versMonde(join(e.parentPath, e.name))), parcourues: entrees.length } } catch { return { suites: [], parcourues: 0 } } },
    }
  }
  /** Chaque cas : l'outil, la commande, le type, la décision attendue, un motif de la raison, et les plateformes
   *  où il se joue (les deux par défaut), forgées par le monde de la plateforme (`mondeDe`). */
  const casDe = ({ platform, P, HORS, R, SP, TMP, tmp }) => [
    ['Bash', 'gh api repos/MyEdO/game/issues/comments/1 --jq .body > "$TMP/plan.md" 2>&1', 'juge', 'deny', /redirection hors du scratchpad/, { env: TMP }],
    ['Bash', 'gh api repos/MyEdO/game/issues/comments/1 --jq .body > "$INCONNUE/plan.md"', 'juge', null],
    ['Bash', 'git grep -nE "x" origin/main -- src > ../.wt-tmp.txt', 'juge', 'deny', /redirection hors du scratchpad/],
    ['Bash', 'echo x > /tmp/mut.json', 'lecteur', 'deny', /redirection hors du scratchpad/],
    ['Bash', "python3 - <<'EOF'\nprint(1)\nEOF", 'juge', null],
    ['Bash', 'python -c "print(1)"', 'juge', null],
    ['Bash', `cd "${P}" && node ecrit-hors.mjs`, 'lecteur', 'deny', /ecrit-hors\.mjs : writeFileSync hors du scratchpad \(\.\.\/hors\.txt\)/],
    ['Bash', `npx tsx "${P}/ecrit-tmp.mts"`, 'juge', null, undefined, { platforms: ['win32'] }],
    ['Bash', `npx tsx "${P}/ecrit-tmp.mts"`, 'juge', 'deny', /ecrit-tmp\.mts : mkdtempSync hors du scratchpad \(\/tmp\/x\)/, { platforms: ['linux'] }],
    ['Bash', `npx tsx "${P}/ecrit-tmp.mts"`, 'juge', 'deny', /mkdtempSync hors du scratchpad .* — canal : amorce le répertoire temporaire de la commande sous le scratchpad/, { env: TMP }],
    ['Bash', `TMPDIR="${P}/tmp" TEMP="${P}/tmp" npx tsx "${P}/ecrit-tmp.mts"`, 'juge', null, undefined, { env: TMP }],
    ['Bash', `export TMPDIR="${P}/tmp" TEMP="${P}/tmp"; npx tsx "${P}/ecrit-tmp.mts"`, 'juge', null, undefined, { env: TMP }],
    ['Bash', `TMPDIR="$INCONNUE" TEMP="$INCONNUE" npx tsx "${P}/ecrit-tmp.mts"`, 'juge', null, undefined, { env: TMP }],
    ['Bash', `npx vitest run --dir "${P}/nm"`, 'juge', null],
    ['Bash', `node -e "const fs = require('node:fs'); fs.writeFileSync('../hors.txt', 'x')" && node -e "1"`, 'lecteur', 'deny', /\(code en ligne\) : writeFileSync hors du scratchpad \(\.\.\/hors\.txt\)/],
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
    ['Bash', `node "${P}/ecrit-sp-${platform}.mjs"`, 'lecteur', null, undefined, { env: TMP }],
    ['Bash', `node "${P}/ecrit-sp-${platform}.mjs"`, 'lecteur', null, undefined, { env: {}, platforms: ['win32'] }],
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
    ['Bash', 'npx tsc -p .', 'juge', null],
    ['Bash', 'npx tsc -p . --outDir sortie', 'juge', 'deny', /npx tsc -p \. --outDir sortie : écrivain .* — canal : un outil de la table de lecture de `npx`/],
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
    ['Bash', 'tsc', 'juge', null],
    ['Bash', 'tsc -b', 'juge', 'deny', /tsc -b : écrivain .* — canal : un outil de la table de lecture de `npx`/],
    ['Bash', 'npm run build', 'juge', 'deny', /vite build : écrivain/],
    ['Bash', 'node scripts/lancer-local.mjs vite -- vite build', 'juge', 'deny', /vite build : écrivain/],
    ['Bash', 'split --help', 'juge', null],
    ['Bash', 'exec rm -f ../x', 'lecteur', 'deny', /rm hors du scratchpad/],
    ['Bash', 'gh pr merge --help', 'juge', null],
    ['Bash', 'echo x > ~/x.txt', 'juge', 'deny', /redirection hors du scratchpad/, { env: { HOME: HORS, USERPROFILE: HORS } }],
    ['PowerShell', 'iwr https://x -OutFile o.txt', 'juge', 'deny', /iwr hors du scratchpad/],
    ['PowerShell', `Expand-Archive a.zip -DestinationPath "${P}/d"`, 'juge', null],
    ['Bash', `cd "${P}" && npx vitest run dir-ecrit`, 'juge', 'deny', /writeFileSync hors du scratchpad/],
    ['Bash', `npx vitest run "${P}/dir-ecrit"`, 'juge', null],
    ['Bash', `cd "${P}/fx" && npx vitest run a-sonde`, 'juge', 'deny', 'a-sonde.test.mjs : writeFileSync hors du scratchpad (/hors-banc-2537/a.txt) — canal'],
    ['Bash', `cd "${P}/fx" && npx vitest run A-SONDE`, 'juge', 'deny', 'a-sonde.test.mjs : writeFileSync'],
    // `--config` absent : vite échoue au chargement ; `dir`, `root` d'un config relatifs au cwd (`node_modules/vite/dist/node/chunks/node.js:37371`,
    // `node_modules/vitest/dist/chunks/index.DpLw24bj.js:9447`, `:12204`).
    ['Bash', `cd "${P}/fx" && npx vitest run --config autre.config.mts a-sonde`, 'juge', null],
    ['Bash', `cd "${P}/fx" && npx vitest run lit`, 'juge', null],
    ['Bash', `cd "${P}/fx" && npx vitest run "$INCONNUE"`, 'juge', null],
    ['Bash', `cd "${P}" && npx vitest run "${P}/fx/sous/b-"`, 'juge', 'deny', 'b-autre.test.mjs : writeFileSync hors du scratchpad (/hors-banc-2537/b.txt) — canal'],
    ['PowerShell', `$S="$env:LOCALAPPDATA\\${dossierClaude(platform)}\\${SLUG}\\${SESSION}\\scratchpad"; Get-Process | Export-Csv -NoTypeInformation -Encoding utf8 "$S\\durees.csv"`, 'juge', null, undefined, { env: { LOCALAPPDATA: tmp } }],
    ['PowerShell', `$S="$env:LOCALAPPDATA\\${dossierClaude(platform)}\\${SLUG}\\${SESSION}\\scratchpad"; Get-Process | Export-Csv -NoTypeInformation -Encoding utf8 "$S\\durees.csv"`, 'juge', 'deny', /export-csv : écrivain à cible non résolue/],
    ['Bash', 'echo x > "$APPDATA/x.txt"', 'lecteur', 'deny', /redirection hors du scratchpad/, { env: { APPDATA: HORS } }],
    ['Bash', `cd "${P}/dir-abs" && npx vitest run`, 'juge', 'deny', /z.test.mjs : writeFileSync hors du scratchpad/],
    ['Bash', `npx vitest run --config "${P}/vitest.config.mjs"`, 'juge', null],
    ['Bash', `cd "${P}" && npx vitest run --config vitest.config.mjs`, 'juge', 'deny', /x.test.mjs : writeFileSync hors du scratchpad/],
    ['Bash', `cd "${P}" && npx vitest run --config vitest.dir.config.mjs`, 'juge', 'deny', /z.test.mjs : writeFileSync hors du scratchpad/],
    ['Bash', `cd "${P}" && npx vitest run --config vitest.calc.config.mjs`, 'juge', null],
    // `--dir`/`--root` de la ligne l'emportent sur ceux du config ; `--config` relatif se lit contre `--root` (`index.DpLw24bj.js:9530`, `:14825`).
    ['Bash', `cd "${P}" && npx vitest run --config vitest.config.mjs --dir dir-lit`, 'juge', null],
    ['Bash', `npx vitest run --root "${P}" --dir "${P}/dir-lit" --config ecrit-hors.mjs`, 'juge', 'deny', /ecrit-hors\.mjs : writeFileSync hors du scratchpad/],
    ['Bash', `node "${P}/k.mjs"`, 'juge', 'deny', /k\.mjs : writeFileSync hors du scratchpad/],
    ['Bash', `node -e "require('node:fs').writeFileSync('${P}/k.mjs', '1')" && node "${P}/k.mjs"`, 'juge', null],
    ['Bash', `cd "${P}/.." && npx vitest run dir-ecrit`, 'juge', 'deny', /x.test.mjs : writeFileSync hors du scratchpad/],
    ['Bash', `cd "${P}/.." && npx vitest run dir-lit`, 'juge', null],
    ['Bash', `source "${P}/lit.mts"`, 'juge', null],
    ['Bash', 'find .. -name x -exec rm {} \\;', 'lecteur', 'deny', /rm hors du scratchpad/],
    ['Bash', `find "${P}" -name x -exec rm {} +`, 'lecteur', null],
    ['Bash', 'rm -f "$INCONNUE/x"', 'lecteur', 'deny', /rm : écrivain à cible non résolue .* — canal : une cible littérale sous `/],
    ['PowerShell', `cd "${P}"\\; echo x > out.txt`, 'juge', null],
    ['Bash', `cd "${P}"\\; echo x > out.txt`, 'juge', 'deny', /redirection hors du scratchpad/],
    ['Bash', `f(){ echo {; }; rm ${HORS}/x`, 'lecteur', 'deny', /rm hors du scratchpad/],
    ['Bash', `f(){ echo } > ${HORS}/r; }; f`, 'lecteur', 'deny', /redirection hors du scratchpad/],
    ['Bash', `f(){ echo; } > ${HORS}/r; f`, 'lecteur', 'deny', /redirection hors du scratchpad/],
    ['Bash', `f(){ cat a > "$1"; }; f ${HORS}/x`, 'lecteur', 'deny', /redirection hors du scratchpad/],
    ['Bash', `f(){ cat a > "$1"; }; f "${P}/x"`, 'lecteur', null],
    ['Bash', 'f(){ rm "$1"; }; f "$INCONNUE"', 'lecteur', 'deny', /rm : écrivain à cible non résolue/],
    ['Bash', `f(){ shift; rm "$1"; }; f "${P}/ok" ${HORS}/x`, 'lecteur', 'deny', new RegExp(`rm hors du scratchpad \\(${echapper(HORS)}/x\\)`)],
    ['Bash', `f(){ shift; rm "$1"; }; f ${HORS}/x "${P}/ok"`, 'lecteur', null],
    ['PowerShell', `npx tsx "${P}/ecrit-tmp.mts"`, 'juge', 'deny', /mkdtempSync hors du scratchpad .* — canal : amorce le répertoire temporaire/, { env: TMP }],
    ['PowerShell', `$env:TMPDIR = "${P}/tmp"; $env:TEMP = "${P}/tmp"; npx tsx "${P}/ecrit-tmp.mts"`, 'juge', null, undefined, { env: TMP }],
    ['Bash', `npx vitest run --root "${P}/dir-ecrit" --dir "${P}/dir-lit"`, 'juge', null],
    ['Bash', `npx vitest run --root "${P}/dir-lit" --dir "${P}/dir-ecrit"`, 'juge', 'deny', /writeFileSync hors du scratchpad/],
    ['Bash', `case x in a) rm ${HORS}/y;; esac`, 'lecteur', 'deny', /rm hors du scratchpad/],
    ['Bash', `case x in a) rm "${P}/y";; esac`, 'lecteur', null],
    ['Bash', `f(){ rm ${HORS}/z; }; export -f f; bash -c f`, 'lecteur', 'deny', /rm hors du scratchpad/],
    ['Bash', `f(){ rm "${P}/z"; }; export -f f; bash -c f`, 'lecteur', null],
    ['PowerShell', `function f { Remove-Item $args[0] }; f ${HORS}/x`, 'lecteur', 'deny', /remove-item hors du scratchpad/i],
    ['PowerShell', `function f { Remove-Item $args[0] }; f "${P}/x"`, 'lecteur', null],
    ['Bash', 'cd "$INCONNUE"; find . -exec rm y \\;', 'lecteur', 'deny', /rm : écrivain à cible non résolue/],
    ['Bash', `cd "${P}"; find . -exec rm y \\;`, 'lecteur', null],
    ['Bash', `case x in $(rm ${HORS}/y)) :;; esac`, 'lecteur', 'deny', /rm hors du scratchpad/],
    ['Bash', `case x in $(rm "${P}/y")) :;; esac`, 'lecteur', null],
    ['PowerShell', `function f { Remove-Item @args }; f ${HORS}/x`, 'lecteur', 'deny', /remove-item hors du scratchpad/i],
    ['PowerShell', `function f { Remove-Item @args }; f "${P}/x"`, 'lecteur', null],
    ['PowerShell', 'Remove-Item @cibles', 'lecteur', 'deny', /remove-item : écrivain à cible non résolue/i],
    ['PowerShell', `if (Test-Path x) { Remove-Item "${P}/x" }`, 'lecteur', null],
    ['PowerShell', `if (Remove-Item ${HORS}/x) { 1 }`, 'lecteur', 'deny', /remove-item hors du scratchpad/i],
  ]
  try {
    for (const platform of ['win32', 'linux']) {
      const monde = mondeDe(platform)
      for (const [tool_name, command, agent_type, attendu, motif, { env = {}, platforms = ['win32', 'linux'] } = {}] of casDe(monde)) {
        if (!platforms.includes(platform)) continue
        const entree = { hook_event_name: 'PreToolUse', tool_name, tool_input: { command }, session_id: SESSION, transcript_path: monde.transcript, agent_id: 'a1', agent_type }
        const { decision, raison } = monde.hote
          ? await repartir({ PreToolUse: REGISTRE.PreToolUse.filter((g) => g === garde) }, JSON.stringify(entree), { env, cwd: RACINE, platform })
            .then(({ sortie }) => ({ decision: sortie?.hookSpecificOutput?.permissionDecision ?? null, raison: sortie?.hookSpecificOutput?.permissionDecisionReason }))
          : garde.evaluer(entree, { baseDeLAppel: monde.racine, platform, env, tmp: monde.tmp, lire: monde.lire, lister: monde.lister }) ?? { decision: null }
        const quoi = `${platform} ${monde.hote ? 'hôte' : 'forgé'} ${agent_type} ${tool_name} ${command}`
        assert.equal(decision, attendu, quoi)
        const raisonLue = raison?.split('\\').join('/')
        if (typeof motif === 'string') assert.ok(raisonLue.includes(motif), `${quoi} — ${raisonLue}`)
        else if (motif) assert.match(raisonLue, motif, quoi)
      }
    }
    const sansTranscript = await repartir({ PreToolUse: REGISTRE.PreToolUse.filter((g) => g === garde) }, JSON.stringify({
      hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: `echo x > "${mondeDe(process.platform).P}/x.txt"` }, session_id: SESSION, agent_type: 'lecteur',
    }), { env: {}, cwd: RACINE })
    assert.match(sansTranscript.sortie.hookSpecificOutput.permissionDecisionReason, /scratchpad de session non dérivable/)
  } finally {
    FS.rmSync(join(tmpdir(), DOSSIER_CLAUDE, SLUG, SESSION), { recursive: true, force: true })
  }
})

test('#2537 — le budget d’analyse est le `timeout` du répartiteur, barrière déduite, sous une marge (machine deux fois plus lente, gardes en série)', () => {
  const declares = aplatirHooks(JSON.parse(FS.readFileSync(join(RACINE, SURFACE_CLAUDE), 'utf8')), SURFACE_CLAUDE).filter((h) => h.script === 'repartiteur.mjs')
  assert.ok(declares.length > 0, 'le répartiteur n’est pas déclaré : la déclaration est illisible')
  for (const { timeout } of declares) {
    assert.equal(BUDGET_ANALYSE_MS, (timeout * 1000 - ATTENTE_BARRIERE.echeanceMs) / MARGE_BUDGET, `timeout ${timeout} s`)
    assert.ok(MARGE_BUDGET >= 2 * 2, `marge ${MARGE_BUDGET}`)
  }
})

test('#2537 — au-delà de la borne, une suite n’est PAS jugée, donc admise, et se nomme en contexte ; en deçà, elle se juge', () => {
  const sp = join(tmpdir(), DOSSIER_CLAUDE, SLUG, SESSION, 'scratchpad'), dossier = join(sp, 'gros')
  const ecrit = "import fs from 'node:fs'\nfs.writeFileSync('/hors-banc-2537/r.txt', 'x')\n"
  const disque = new Map([[join(dossier, 'g.test.mjs'), ecrit + `// ${'x'.repeat(BUDGET_ANALYSE_MS * DEBIT_ANALYSE_JS)}\n`], [join(dossier, 'p.test.mjs'), ecrit]])
  const entree = { hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: `npx vitest run --dir "${dossier}"` }, session_id: SESSION, transcript_path: TRANSCRIPT, agent_type: 'juge' }
  const juger = (suites) => garde.evaluer(entree, { baseDeLAppel: RACINE, horloge: () => 0, lire: (chemin) => ({ texte: disque.get(chemin) }), lister: () => ({ suites, parcourues: suites.length }) })
  const gros = juger([join(dossier, 'g.test.mjs')])
  assert.equal(gros.decision, undefined)
  assert.match(gros.contexte, /NON JUGÉS, au-delà du budget d'analyse de \d+ ms par appel .* : /)
  assert.ok(gros.contexte.endsWith(`${dossier} (1/1 suites).`), gros.contexte)
  const mixte = juger([join(dossier, 'g.test.mjs'), join(dossier, 'p.test.mjs')])
  assert.equal(mixte.decision, 'deny')
  assert.ok(mixte.raison.includes('p.test.mjs : writeFileSync hors du scratchpad'), mixte.raison)
  assert.ok(!mixte.raison.includes('g.test.mjs'), mixte.raison)
  assert.ok(mixte.contexte.endsWith(`${dossier} (1/2 suites).`), mixte.contexte)
  const vaste = garde.evaluer(entree, { baseDeLAppel: RACINE, horloge: () => 0, lire: (chemin) => ({ texte: disque.get(chemin) }), lister: () => null })
  assert.equal(vaste.decision, undefined)
  assert.ok(vaste.contexte.endsWith(`${dossier} (entrées).`), vaste.contexte)
})

test('#2537 — chaque script coûte `COUT_SCRIPT_MS` AVANT sa lecture : N suites minuscules débordent le budget, nommées par leur compte', () => {
  const dossier = join(SP, 'petits'), n = Math.ceil(BUDGET_ANALYSE_MS / COUT_SCRIPT_MS) + 1
  const suites = [...Array.from({ length: n }, (_, k) => join(dossier, `a${k}.test.mjs`)), join(dossier, 'zzzz.test.mjs')]
  const entree = { hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: `npx vitest run --dir "${dossier}"` }, session_id: SESSION, transcript_path: TRANSCRIPT, agent_type: 'juge' }
  const lues = []
  const juger = (liste) => garde.evaluer(entree, {
    baseDeLAppel: RACINE, horloge: () => 0, lister: () => ({ suites: liste, parcourues: liste.length }),
    lire: (chemin) => (lues.push(chemin), { texte: chemin.endsWith('zzzz.test.mjs') ? "import fs from 'node:fs'\nfs.writeFileSync('/hors-banc-2537/r.txt', 'x')\n" : 'let a = 1\n' }),
  })
  const verdict = juger(suites)
  const [, horsBudget, choisies] = /\((\d+)\/(\d+) suites\)\.$/.exec(verdict.contexte ?? '') ?? []
  assert.equal(verdict.decision, undefined, verdict.raison)
  assert.ok(verdict.contexte.includes(`NON JUGÉS, au-delà du budget d'analyse de ${BUDGET_ANALYSE_MS} ms par appel (#2537) : ${dossier} (`), verdict.contexte)
  assert.equal(Number(choisies), n + 1)
  assert.equal(Number(horsBudget), n + 1 - lues.length)
  assert.ok(lues.length * COUT_SCRIPT_MS <= BUDGET_ANALYSE_MS, `${lues.length} suites lues`)
  const temoin = juger([...suites.slice(0, 10), suites.at(-1)])
  assert.equal(temoin.decision, 'deny')
  assert.ok(temoin.raison.includes('zzzz.test.mjs : writeFileSync hors du scratchpad'), temoin.raison)
  assert.equal(temoin.contexte, undefined)
})

test('#2537 — l’échéance murale borne l’analyse à côté du modèle : le temps écoulé se déduit du budget, le reste n’est pas jugé, nommé', () => {
  const dossier = join(SP, 'lents')
  const suites = [join(dossier, 'a.test.mjs'), join(dossier, 'zzzz.test.mjs')]
  const entree = { hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: `npx vitest run --dir "${dossier}"` }, session_id: SESSION, transcript_path: TRANSCRIPT, agent_type: 'juge' }
  const juger = (horloge) => garde.evaluer(entree, {
    baseDeLAppel: RACINE, horloge, lister: () => ({ suites, parcourues: suites.length }),
    lire: (chemin) => ({ texte: chemin.endsWith('zzzz.test.mjs') ? "import fs from 'node:fs'\nfs.writeFileSync('/hors-banc-2537/r.txt', 'x')\n" : 'let a = 1\n' }),
  })
  const arretee = juger(() => 0)
  assert.equal(arretee.decision, 'deny')
  assert.equal(arretee.contexte, undefined)
  let appels = 0
  const froide = juger(() => (appels++ === 0 ? 0 : BUDGET_ANALYSE_MS - COUT_SCRIPT_MS / 2))
  assert.equal(froide.decision, undefined, froide.raison)
  assert.ok(froide.contexte.endsWith(`${dossier} (2/2 suites).`), froide.contexte)
})

test('#2537 — l’échéance murale borne l’ANALYSE par lots : les scripts au-delà ne sont pas jugés, nommés', () => {
  const scripts = Array.from({ length: 40 }, (_, k) => join(SP, `e${k}.mjs`))
  const entree = { hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: scripts.map((s) => `node "${s}"`).join(' && ') }, session_id: SESSION, transcript_path: TRANSCRIPT, agent_type: 'juge' }
  const ecrit = "import fs from 'node:fs'\nfs.writeFileSync('/hors-banc-2537/r.txt', 'x')\n"
  const juger = (horloge, lu = () => {}) => garde.evaluer(entree, {
    baseDeLAppel: RACINE, horloge, lister: () => ({ suites: [], parcourues: 0 }),
    lire: (chemin) => (lu(chemin), { texte: chemin === scripts.at(-1) ? ecrit : 'let a = 1\n' }),
  })
  const jugee = juger(() => 0)
  assert.equal(jugee.decision, 'deny')
  assert.equal(jugee.contexte, undefined)
  let maintenant = 0, lente = false
  const tardive = juger(() => (lente ? (maintenant += 50) : maintenant), (chemin) => {
    if (chemin === scripts.at(-1)) [maintenant, lente] = [BUDGET_ANALYSE_MS - 4 * COUT_SESSION_MS, true]
  })
  assert.equal(tardive.decision, undefined, tardive.raison)
  assert.ok(tardive.contexte.endsWith(`${scripts.at(-1)}.`), tardive.contexte)
  const nommes = scripts.filter((s) => tardive.contexte.includes(`${s},`) || tardive.contexte.endsWith(`${s}.`))
  assert.ok(nommes.length > 0 && nommes.length < scripts.length, `${nommes.length} nommés`)
})

test('#2537 — après un `cd` inconnu, un script se lance d’un répertoire inconnu : ses écritures relatives ne se jugent pas, les absolues si', () => {
  const script = join(SP, 'cwd-inconnu.mjs')
  const juger = (ecrit, avant = 'cd "$DOSSIER_INCONNU" && ') => garde.evaluer({ hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: `${avant}node "${script}"` }, session_id: SESSION, transcript_path: TRANSCRIPT, agent_type: 'juge' }, {
    baseDeLAppel: RACINE, horloge: () => 0, lister: () => ({ suites: [], parcourues: 0 }),
    lire: () => ({ texte: `import fs from 'node:fs'\nfs.writeFileSync('${ecrit}', 'x')\n` }),
  })
  assert.equal(juger('r.txt', '').decision, 'deny')
  assert.equal(juger('r.txt'), null)
  assert.equal(juger('/hors-banc-2537/r.txt').decision, 'deny')
  assert.equal(choisieParVitest(join(SP, 'a', 'x.test.mjs'), ['a/x'], SP, null, process.platform), true)
  assert.equal(choisieParVitest(join(SP, 'a', 'x.test.mjs'), ['./a/x'], SP, null, process.platform), false)
  assert.equal(choisieParVitest(join(SP, 'a', 'x.test.mjs'), ['./a/x'], SP, SP, process.platform), true)
})

test('#2537 — `vitest` lancé d’un PARENT du scratchpad se juge à la part du scratchpad, sauf à traverser un dossier qu’il exclut', () => {
  const P = cheminsDe('linux')
  const juger = (tmp) => {
    const sp = P.join(tmp, dossierClaude('linux'), SLUG, SESSION, 'scratchpad'), suite = P.join(sp, 'w.test.mjs')
    const entree = { hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: 'cd /banc && npx vitest run' }, session_id: SESSION, transcript_path: P.join('/banc/depot/.claude/projects', SLUG, `${SESSION}.jsonl`), agent_type: 'juge' }
    return garde.evaluer(entree, {
      baseDeLAppel: '/banc/depot', platform: 'linux', tmp, horloge: () => 0, lister: (dossier) => ({ suites: dossier === sp ? [suite] : [], parcourues: 1 }),
      lire: (chemin) => (chemin === suite ? { texte: "import fs from 'node:fs'\nfs.writeFileSync('/hors-banc-2537/w.txt', 'x')\n" } : { raison: 'absent' }),
    })
  }
  const parent = juger('/banc/tmp')
  assert.equal(parent?.decision, 'deny')
  assert.ok(parent.raison.includes('w.test.mjs : writeFileSync hors du scratchpad'), parent.raison)
  assert.equal(juger('/banc/node_modules/tmp'), null)
})

test('#2537 — le disque balayé élague les dossiers du `defaultExclude` de `vitest/config` (`.git`, `node_modules`), à toute profondeur', () => {
  const dossier = join(SP, 'elague')
  const ecrit = "import fs from 'node:fs'\nfs.writeFileSync('/hors-banc-2537/e.txt', 'x')\n"
  try {
    for (const exclu of ['.git', 'node_modules']) {
      FS.mkdirSync(join(dossier, 'sous', exclu), { recursive: true })
      FS.writeFileSync(join(dossier, 'sous', exclu, 'w.test.mjs'), ecrit)
    }
    FS.writeFileSync(join(dossier, 'sous', 'lit.test.mjs'), "import fs from 'node:fs'\nfs.readFileSync('package.json')\n")
    const entree = { hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: `npx vitest run --dir "${dossier}"` }, session_id: SESSION, transcript_path: TRANSCRIPT, agent_type: 'juge' }
    assert.equal(garde.evaluer(entree, { baseDeLAppel: RACINE }), null)
    FS.writeFileSync(join(dossier, 'sous', 'e.test.mjs'), ecrit)
    const temoin = garde.evaluer(entree, { baseDeLAppel: RACINE })
    assert.equal(temoin.decision, 'deny')
    assert.ok(temoin.raison.includes('e.test.mjs : writeFileSync hors du scratchpad') && !temoin.raison.includes('w.test.mjs'), temoin.raison)
  } finally {
    FS.rmSync(dossier, { recursive: true, force: true })
  }
})

test('#2537 — le tsconfig de `tsc -p` se lit sous le plafond et le budget : au-delà, non jugé, nommé ; en deçà, jugé', () => {
  const tsconfig = join(SP, 'tsconfig.emet.json'), emet = '{ "compilerOptions": { "strict": true } }\n'
  const entree = { hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: `npx tsc -p "${tsconfig}"` }, session_id: SESSION, transcript_path: TRANSCRIPT, agent_type: 'juge' }
  const juger = (texte) => garde.evaluer(entree, {
    baseDeLAppel: RACINE, horloge: () => 0, lister: () => ({ suites: [], parcourues: 0 }),
    lire: (chemin, plafond) => (chemin === tsconfig && Buffer.byteLength(texte) > plafond ? { raison: 'au-delà du budget', trop: true } : { texte }),
  })
  const petit = juger(emet)
  assert.equal(petit.decision, 'deny')
  assert.equal(petit.contexte, undefined)
  const geant = juger(emet + ' '.repeat(BUDGET_ANALYSE_MS * DEBIT_ANALYSE_JS))
  assert.equal(geant.decision, undefined, geant.raison)
  assert.ok(geant.contexte.endsWith(`${tsconfig}.`), geant.contexte)
})

test('#2537 — les scripts d’une commande s’analysent en un corpus, une session au modèle : 121 lancements tiennent le budget, le dernier se juge', () => {
  const sp = join(tmpdir(), DOSSIER_CLAUDE, SLUG, SESSION, 'scratchpad')
  const lit = "import fs from 'node:fs'\nfs.readFileSync('package.json')\n// " + 'x'.repeat(2000) + '\n'
  const scripts = Array.from({ length: 121 }, (_, k) => join(sp, `s${k}.mjs`))
  const disque = new Map(scripts.map((s, k) => [s, k === 120 ? "import fs from 'node:fs'\nfs.writeFileSync('/hors-banc-2537/r.txt', 'x')\n" : lit]))
  const entree = { hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: scripts.map((s) => `node "${s}"`).join(' && ') }, session_id: SESSION, transcript_path: TRANSCRIPT, agent_type: 'juge' }
  const verdict = garde.evaluer(entree, { baseDeLAppel: RACINE, horloge: () => 0, lire: (chemin) => ({ texte: disque.get(chemin) }), lister: () => ({ suites: [], parcourues: 0 }) })
  assert.equal(verdict.decision, 'deny')
  assert.ok(verdict.raison.includes('s120.mjs : writeFileSync hors du scratchpad'), verdict.raison)
  assert.equal(verdict.contexte, undefined)
  const enLigne = { ...entree, tool_input: { command: [...Array(120).fill('node -e "1"'), "node -e \"require('node:fs').writeFileSync('/hors-banc-2537/e.txt', 'x')\""].join(' && ') } }
  const verdictEnLigne = garde.evaluer(enLigne, { baseDeLAppel: RACINE, horloge: () => 0, lire: () => ({ raison: 'hors disque' }), lister: () => ({ suites: [], parcourues: 0 }) })
  assert.equal(verdictEnLigne.decision, 'deny')
  assert.ok(verdictEnLigne.raison.includes('(code en ligne) : writeFileSync hors du scratchpad'), verdictEnLigne.raison)
})

test('#2537 — `choisieParVitest` : prédicat de `filterFiles` de vitest (sous-chaîne sans casse du relatif, préfixe absolu)', () => {
  for (const platform of ['win32', 'linux']) {
    const P = cheminsDe(platform), racine = platform === 'win32' ? P.join('C:', '/r') : '/r', suite = P.join(racine, 'fx', 'sous', 'A-Sonde.test.mjs')
    const choisie = (filtres, depuis = racine) => choisieParVitest(suite, filtres, racine, depuis, platform)
    assert.equal(choisie([]), true, platform)
    assert.equal(choisie(['a-sonde']), true, platform)
    assert.equal(choisie(['sous/a-']), true, platform)
    assert.equal(choisie(['autre']), false, platform)
    assert.equal(choisie([null]), false, platform)
    assert.equal(choisie([null, 'sonde']), true, platform)
    assert.equal(choisie(['a-sonde'], P.join(racine, 'ailleurs')), true, platform)
    assert.equal(choisie([P.join(racine, 'fx')]), true, platform)
    assert.equal(choisie([P.join(racine, 'gx')]), false, platform)
  }
  const W = cheminsDe('win32'), racineW = W.join('C:', '/r')
  assert.equal(choisieParVitest(W.join(racineW, 'fx', 'a.test.mjs'), ['fx\\a'], racineW, racineW, 'win32'), true)
})
