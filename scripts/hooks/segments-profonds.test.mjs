// Tests du SOCLE de reconnaissance de commande partagé par les gardes PreToolUse (#1679 L1a T1) :
// `segmentsProfonds` (sous-shells + enrobeurs de tête), `extractTargetDir` (répertoire cible réel),
// le refus de PALIER (mesuré sur l'histoire), et le contrat de sortie du driver.
//
// Les formes couvertes ici viennent de sondes jouées contre les évaluateurs RÉELS avant écriture :
// onze formes que le tokenizer voyait déjà par accident, dix-sept qu'il laissait passer (flags avant
// `-c`, `/k`, abréviation `-com`, `-EncodedCommand`, `timeout -k`, `winpty`, `npx` et `npx -c`,
// `time`, `stdbuf`, `nice`, `sudo`, `setsid`), et cinq qui restent HORS PORTÉE — nommées.
//
// Cross-OS : `test:hooks` tourne aussi sur `ubuntu-latest` (.github/workflows/ci.yml). Tout attendu
// de chemin s'ancre donc sur la base FOURNIE à la fonction, jamais sur le cwd du process — un
// `resolve('C:/…')` est absolu sur win32 et RELATIF au cwd sur POSIX (classe payée en 13c9a4bd7).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Buffer } from 'node:buffer'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { execFileSync, spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { dirname, join, posix, resolve, win32 } from 'node:path'
import { instanceDeDepot } from '../guards/lib/depotGabarit.mjs'
import {
  segmentsProfonds,
  pipelinesProfonds,
  isGitCommitCommand,
  extractClosedIssues,
  extractTargetDir,
  versCheminNatif,
  decisionCumulee,
  scriptsNpm,
  ancrerScriptsNpm,
  evaluate as evaluateSolde,
} from './solde-ticket-guard.mjs'
import { evaluate as evaluateLabel } from './issue-label-guard.mjs'

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
// Lecteurs Windows et racines de profil ASSEMBLÉS à l'exécution : ce fichier ne porte aucun chemin
// absolu littéral, il reste donc soumis à `src/portable-paths-guard.test.ts` comme `scripts/**`.
const BS = String.fromCharCode(92)
const LECTEUR_C = 'C' + ':'
const LECTEUR_D = 'D' + ':'
const PROFIL_WIN = ['/c/Users', 'x'].join('/')
const PROFIL_NATIF = [LECTEUR_C + '/Users', 'x'].join('/')
const PROFIL_RUNNER = ['/home', 'runner/work/game/game'].join('/')

// ── Les DEUX évaluateurs réels doivent voir la même commande derrière le même enrobage ────────────
// Un garde qui verrait `sh -c "git commit …"` mais pas `sh -c "gh issue create …"` (ou l'inverse)
// signerait un socle dédoublé : les deux portes se mesurent sur les MÊMES formes.
/** Argument d'un `-EncodedCommand` PowerShell tel que l'hôte l'attend : base64 d'UTF-16LE. */
const encodePourPowerShell = (commande) => Buffer.from(commande, 'utf16le').toString('base64')

/** Une forme d'enrobage : `git` = le patron portant un `git commit`, `gh` = celui d'un
 *  `gh issue create` SANS label. `{ nom, git, gh }`. */
const FORMES_VUES = [
  // Onze formes déjà couvertes par le tokenizer de surface — non-régression.
  { nom: 'direct (témoin)', git: 'git commit -m "corrige #42"', gh: 'gh issue create --title x' },
  { nom: 'env VAR=1', git: 'env FOO=1 git commit -m "corrige #42"', gh: 'env FOO=1 gh issue create --title x' },
  { nom: 'affectation nue VAR=1', git: 'FOO=1 git commit -m "corrige #42"', gh: 'FOO=1 gh issue create --title x' },
  { nom: 'nohup', git: 'nohup git commit -m "corrige #42"', gh: 'nohup gh issue create --title x' },
  { nom: 'timeout <durée>', git: 'timeout 60 git commit -m "corrige #42"', gh: 'timeout 30 gh issue create --title x' },
  { nom: 'PowerShell & { … }', git: '& { git commit -m "corrige #42" }', gh: '& { gh issue create --title x }' },
  { nom: 'command', git: 'command git commit -m "corrige #42"', gh: 'command gh issue create --title x' },
  { nom: 'eval "…"', git: 'eval "git commit -m \'corrige #42\'"', gh: 'eval "gh issue create --title x"' },
  { nom: 'Invoke-Expression "…"', git: 'Invoke-Expression "git commit -m \'corrige #42\'"', gh: 'Invoke-Expression "gh issue create --title x"' },
  { nom: 'xargs -I{}', git: 'echo x | xargs -I{} git commit -m "corrige #42"', gh: 'echo x | xargs -I{} gh issue create --title {}' },
  { nom: 'sh -c "…"', git: 'sh -c "git commit -m \'corrige #42\'"', gh: 'sh -c "gh issue create --title x"' },
  { nom: 'cmd /c "…"', git: 'cmd /c "git commit -m \'corrige #42\'"', gh: 'cmd /c "gh issue create --title x"' },
  // Douze formes que la sonde v2 mesurait PASSANTES : flags de tête avant le porteur, graphies
  // alternatives du porteur, enrobeurs de tête non couverts.
  { nom: 'bash -euo pipefail -c', git: 'bash -euo pipefail -c "git commit -m \'corrige #42\'"', gh: 'bash -euo pipefail -c "gh issue create --title x"' },
  { nom: 'bash --login -c', git: 'bash --login -c "git commit -m \'corrige #42\'"', gh: 'bash --login -c "gh issue create --title x"' },
  { nom: 'sh -ex -c', git: 'sh -ex -c "git commit -m \'corrige #42\'"', gh: 'sh -ex -c "gh issue create --title x"' },
  { nom: 'powershell -NoProfile -Command', git: 'powershell -NoProfile -Command "git commit -m \'corrige #42\'"', gh: 'powershell -NoProfile -Command "gh issue create --title x"' },
  { nom: 'cmd /k', git: 'cmd /k "git commit -m \'corrige #42\'"', gh: 'cmd /k "gh issue create --title x"' },
  { nom: 'powershell -com (abréviation)', git: 'powershell -com "git commit -m \'corrige #42\'"', gh: 'powershell -com "gh issue create --title x"' },
  { nom: 'timeout -k 5 30', git: 'timeout -k 5 30 git commit -m "corrige #42"', gh: 'timeout -k 5 30 gh issue create --title x' },
  { nom: 'winpty', git: 'winpty git commit -m "corrige #42"', gh: 'winpty gh issue create --title x' },
  { nom: 'npx', git: 'npx git commit -m "corrige #42"', gh: 'npx gh issue create --title x' },
  { nom: 'time', git: 'time git commit -m "corrige #42"', gh: 'time gh issue create --title x' },
  { nom: 'stdbuf -oL', git: 'stdbuf -oL git commit -m "corrige #42"', gh: 'stdbuf -oL gh issue create --title x' },
  { nom: 'nice -n 10', git: 'nice -n 10 git commit -m "corrige #42"', gh: 'nice -n 10 gh issue create --title x' },
  // Trouvées par le juge de diff : `npx -c` AVALAIT sa chaîne (flag à valeur) au lieu de la
  // déployer ; `sudo`/`setsid` manquaient (la CI est Linux) ; `-EncodedCommand` porte la commande
  // en base64 d'UTF-16LE, le contrat de l'hôte PowerShell.
  { nom: 'npx -c "…"', git: 'npx -c "git commit -m \'corrige #42\'"', gh: 'npx -c "gh issue create --title x"' },
  { nom: 'npx --call "…"', git: 'npx --call "git commit -m \'corrige #42\'"', gh: 'npx --call "gh issue create --title x"' },
  { nom: 'sudo', git: 'sudo git commit -m "corrige #42"', gh: 'sudo gh issue create --title x' },
  { nom: 'sudo -u alice', git: 'sudo -u alice git commit -m "corrige #42"', gh: 'sudo -u alice gh issue create --title x' },
  { nom: 'setsid', git: 'setsid git commit -m "corrige #42"', gh: 'setsid gh issue create --title x' },
  {
    nom: 'powershell -EncodedCommand (base64 UTF-16LE)',
    git: `powershell -EncodedCommand ${encodePourPowerShell('git commit -m "corrige #42"')}`,
    gh: `powershell -EncodedCommand ${encodePourPowerShell('gh issue create --title x')}`,
  },
]

for (const { nom, git, gh } of FORMES_VUES) {
  test(`forme VUE — ${nom} : le git commit est reconnu ET la création sans label refusée`, () => {
    assert.equal(isGitCommitCommand(git), true, `git commit invisible derrière « ${nom} »`)
    assert.deepEqual(extractClosedIssues(git), [42])
    assert.ok(evaluateLabel(gh), `gh issue create sans label invisible derrière « ${nom} »`)
  })
}

// ── Hors portée : ce que le socle ne prétend PAS voir ─────────────────────────────────────────────
// L'exécutable réel n'est pas dans la commande (fichier, variable d'environnement, substitution) :
// aucune analyse STRUCTURELLE ne peut le rendre, et un grep de sous-chaîne serait le retour du
// faux positif #591. Ces formes PASSENT, et c'est le contrat.
const FORMES_HORS_PORTEE = [
  ['node script.mjs (la commande vit dans un fichier)', 'node scripts/tmp-open.mjs'],
  ['npm run x INCONNU du package.json (aucun corps à lire)', 'npm run open-ticket'],
  ['$VAR en exécutable (vient de l\'environnement)', '$GH issue create --title x'],
  ['pwsh -File (script)', 'pwsh -File ./ouvre.ps1'],
  ['bash -c "$(cat …)" (substitution)', 'bash -c "$(cat script.sh)"'],
]

for (const [nom, cmd] of FORMES_HORS_PORTEE) {
  test(`forme HORS PORTÉE — ${nom} : passe, dit`, () => {
    assert.equal(isGitCommitCommand(cmd), false)
    assert.equal(evaluateLabel(cmd), null)
  })
}

// ── `npm run <x>` : le corps du script est LU dans package.json (abstention D6/b1 levée) ─────────
const SCRIPTS_FIXTURE = {
  'open-ticket': 'gh issue create --title "reste" --body-file corps.md',
  typecheck: 'node scripts/lancer-local.mjs typescript -- tsc --noEmit',
  test: 'node scripts/test/run.mjs',
}

test('npm run <x> : le script résolu est re-tokenisé, sa création sans label est VUE', () => {
  const options = { scripts: SCRIPTS_FIXTURE }
  assert.deepEqual(
    segmentsProfonds('npm run open-ticket', 0, options)[0].slice(0, 3),
    ['gh', 'issue', 'create'],
  )
  assert.ok(evaluateLabel('npm run open-ticket', options), 'création sans label invisible derrière npm run')
  assert.equal(evaluateLabel('npm run open-ticket'), null, 'script ABSENT du package.json réel : silence')
})

test('npm run <x> : les trois graphies, les arguments de la ligne, et un script inconnu', () => {
  const options = { scripts: SCRIPTS_FIXTURE }
  for (const cmd of ['npm run open-ticket', 'npm run-script open-ticket', 'npm run --silent open-ticket']) {
    assert.ok(evaluateLabel(cmd, options), cmd)
  }
  assert.deepEqual(
    segmentsProfonds('npm test -- --reporter=dot', 0, options)[0],
    ['node', 'scripts/test/run.mjs', '--reporter=dot'],
  )
  assert.deepEqual(segmentsProfonds('npm run inconnu', 0, options), [['npm', 'run', 'inconnu']])
})

test('npm run <x> : la résolution suit le dépôt ANCRÉ, pas celui du hook', () => {
  const base = mkdtempSync(join(tmpdir(), 'npm-ancre-'))
  try {
    writeFileSync(join(base, 'package.json'), JSON.stringify({ scripts: { ferme: 'gh issue close 1679' } }), 'utf8')
    assert.deepEqual(scriptsNpm(base), { ferme: 'gh issue close 1679' })
    // Sans ancrage : le dépôt du hook, qui ne porte aucun script `ferme`.
    assert.deepEqual(segmentsProfonds('npm run ferme'), [['npm', 'run', 'ferme']])
    ancrerScriptsNpm(base)
    try {
      assert.deepEqual(
        segmentsProfonds('npm run ferme'),
        [['gh', 'issue', 'close', '1679'], ['npm', 'run', 'ferme']],
      )
    } finally {
      ancrerScriptsNpm(null)
    }
    assert.deepEqual(segmentsProfonds('npm run ferme'), [['npm', 'run', 'ferme']], 'l’ancrage n’a pas été rendu')
  } finally {
    rmSync(base, { recursive: true, force: true })
  }
})

test('$\'…\' (ANSI-C quoting) est un span QUOTÉ : l\'exécutable de tête reste lisible', () => {
  assert.deepEqual(segmentsProfonds("bash -c $'gh issue create --title x'")[0].slice(0, 3), ['gh', 'issue', 'create'])
  assert.ok(evaluateLabel("bash -c $'gh issue create --title x'"))
  assert.equal(isGitCommitCommand("bash -c $'git commit -m x'"), true)
})

test('imbrication à DEUX niveaux : sh -c "bash -lc \'…\'"', () => {
  assert.equal(isGitCommitCommand('sh -c "bash -lc \'git commit -m x\'"'), true)
  assert.ok(evaluateLabel('sh -c "bash -lc \'gh issue create --title x\'"'))
})

test('borne DITE de la récursion : au-delà de PROFONDEUR_MAX_ENROBEURS l\'analyse s\'arrête', () => {
  // La borne se mesure sur le paramètre de profondeur, pas sur une chaîne imbriquée à la main :
  // au-delà de deux niveaux, les quotes d'un vrai shell s'épuisent et la chaîne n'imbrique plus
  // rien — un tel cas passerait pour la RAISON D'À CÔTÉ.
  const cmd = 'sh -c "git commit -m x"'
  assert.equal(isGitCommitCommand(cmd), true)
  assert.ok(segmentsProfonds(cmd, 4).length > 0, 'la borne mord trop tôt')
  assert.deepEqual(segmentsProfonds(cmd, 5), [], 'au-delà de la borne, aucun segment n\'est rendu : la commande PASSE')
})

test('#591 : un `git commit` CITÉ dans le corps d\'un gh issue create reste une citation', () => {
  const cmd = 'gh issue create --label sev:mineur --title "x" --body "reproduire avec git commit -m corrige #42"'
  assert.equal(isGitCommitCommand(cmd), false)
  assert.deepEqual(extractClosedIssues(cmd), [])
  assert.equal(evaluateLabel(cmd), null)
})

test('un label présent DANS le sous-shell suffit (le refus porte sur le manque, pas sur l\'enrobage)', () => {
  assert.equal(evaluateLabel('sh -c "gh issue create --title x --label sev:mineur"'), null)
})

test('`command -v git` ne lance rien : aucun flag n\'est épluché derrière `command`', () => {
  assert.equal(isGitCommitCommand('command -v git commit'), false)
})

test('le segment ENROBANT est rendu lui aussi (l\'invocation `cmd /c mklink …` vit sur ses arguments)', () => {
  const segments = segmentsProfonds('cmd /c mklink /J node_modules cible')
  assert.ok(segments.some((s) => s[0] === 'cmd'), 'le segment cmd a disparu : la règle des liens devient aveugle')
})

// ── extractTargetDir : le répertoire où le commit s'exécute VRAIMENT ──────────────────────────────
// Ces attendus mesurent la RÉSOLUTION de chemin (graphies, pliage des `cd`, priorité du `-C`) sur des
// chemins FABRIQUÉS : la sonde d'existence du disque y est donc injectée à vrai. Qu'un chemin
// INEXISTANT ne serve pas de cwd est un AUTRE contrat, mesuré dans `solde-ticket-guard.test.mjs`.
const TOUT_EXISTE = { existe: () => true }

test('extractTargetDir : un chemin POSIX de disque (`/c/…`) devient natif sur win32, inchangé ailleurs', () => {
  const cmd = 'cd ' + PROFIL_WIN + '/dépôt && git commit -m "corrige #42"'
  const base = resolve('/base')
  assert.equal(extractTargetDir(cmd, base, 'win32', TOUT_EXISTE), resolve(base, PROFIL_NATIF + '/dépôt'))
  assert.equal(extractTargetDir(cmd, base, 'linux', TOUT_EXISTE), resolve(base, PROFIL_WIN + '/dépôt'))
  assert.notEqual(extractTargetDir(cmd, base, 'linux', TOUT_EXISTE), extractTargetDir(cmd, base, 'win32', TOUT_EXISTE))
})

test('extractTargetDir : l\'attendu s\'ancre sur la base FOURNIE, jamais sur le cwd du process', () => {
  // `extractTargetDir` résout contre la base qu'on lui passe. Un attendu écrit `resolve(NATIF)`
  // s'ancre, lui, sur le cwd du PROCESS : les deux ne coïncident que là où `C:/…` est ABSOLU,
  // c'est-à-dire sur win32. Rejoué ici sur les DEUX moteurs de `node:path`, la divergence mord sans
  // dépendre de l'hôte : sur POSIX (la CI) l'ancrage fautif décalait l'attendu sous le cwd du runner.
  const NATIF = PROFIL_NATIF + '/dépôt'
  const cwdWin = LECTEUR_C + BS + 'ailleurs'
  const baseWin = win32.resolve(cwdWin, '/base')
  assert.equal(win32.resolve(baseWin, NATIF), win32.resolve(cwdWin, NATIF), 'sur win32 les deux ancrages coïncident : la faute y est INVISIBLE')

  const cwdPosix = PROFIL_RUNNER
  const basePosix = posix.resolve(cwdPosix, '/base')
  assert.equal(posix.resolve(basePosix, NATIF), '/base/' + NATIF)
  assert.notEqual(posix.resolve(basePosix, NATIF), posix.resolve(cwdPosix, NATIF), 'sur POSIX un attendu ancré sur le cwd du process diverge — vert local, ROUGE en CI')
})

test('versCheminNatif : ne convertit QUE la graphie `/<lettre>/…`', () => {
  assert.equal(versCheminNatif('/usr/local/bin', 'win32'), '/usr/local/bin')
  assert.equal(versCheminNatif('/c/Users', 'linux'), '/c/Users')
  assert.equal(versCheminNatif('/d/wt', 'win32'), LECTEUR_D + '/wt')
})

test('extractTargetDir : un `cd` ou un `git -C` DANS un sous-shell désigne le même répertoire réel', () => {
  const base = resolve('/base')
  assert.equal(extractTargetDir('sh -c "cd wt && git commit -m x"', base, 'linux', TOUT_EXISTE), resolve(base, 'wt'))
  assert.equal(extractTargetDir('sh -c "git -C wt commit -m x"', base, 'linux', TOUT_EXISTE), resolve(base, 'wt'))
})

test('extractTargetDir : `git -C` prime sur `cd`, et sans ni l\'un ni l\'autre le cwd est inchangé', () => {
  const base = resolve('/base')
  assert.equal(extractTargetDir('cd a && git -C b commit -m x', base, 'linux', TOUT_EXISTE), resolve(base, 'b'))
  assert.equal(extractTargetDir('git commit -m x', base, 'linux', TOUT_EXISTE), base)
})

/** Dépôt jetable avec un worktree LIÉ, posé DANS l'instance : le driver s'y joue comme dans un arbre
 *  réel — `.gitignore` compris, qui y tient le rôle de l'entrée `.wt-` du dépôt (.gitignore:54) et
 *  garde l'arbre principal PROPRE. */
function depotAvecWorktree() {
  const { racine: principal } = instanceDeDepot({ fichiers: { 'a.txt': 'a', '.gitignore': '/wt/\n' }, message: 'racine' })
  const worktree = join(principal, 'wt')
  const git = (cwd, ...args) => execFileSync('git', args, { cwd, stdio: ['ignore', 'pipe', 'ignore'] })
  git(principal, 'worktree', 'add', '-q', worktree)
  return { base: principal, principal, worktree }
}

// ── Driver : le JSON rendu au hook ────────────────────────────────────────────────────────────────
/** Sortie BRUTE du driver d'un garde pour un payload de hook. */
function sortieDriver(garde, command, cwd) {
  const payload = JSON.stringify({
    session_id: 'test', hook_event_name: 'PreToolUse',
    tool_name: 'mcp__lean-ctx__ctx_shell', tool_input: { command, cwd },
  })
  const run = spawnSync(process.execPath, [join(REPO, 'scripts', 'hooks', garde)], {
    input: payload, encoding: 'utf8', cwd: REPO,
  })
  assert.equal(run.status, 0, `le hook a quitté en ${run.status} : ${run.stderr}`)
  return run.stdout
}

test('DRIVER : un refus rend le JSON exact attendu par le hook (deny + raison)', () => {
  const out = sortieDriver('issue-label-guard.mjs', 'sh -c "gh issue create --title x"')
  const { hookSpecificOutput } = JSON.parse(out)
  assert.equal(hookSpecificOutput.hookEventName, 'PreToolUse')
  assert.equal(hookSpecificOutput.permissionDecision, 'deny')
  assert.match(hookSpecificOutput.permissionDecisionReason, /label/i)
  assert.deepEqual(Object.keys(hookSpecificOutput).sort(), ['hookEventName', 'permissionDecision', 'permissionDecisionReason'])
})

test('DRIVER : une décision NULLE ne produit AUCUNE sortie (silence, jamais un JSON vide)', () => {
  assert.equal(sortieDriver('issue-label-guard.mjs', 'gh issue list --state open').trim(), '')
  assert.equal(sortieDriver('solde-ticket-guard.mjs', 'ls -la').trim(), '')
})

test('DRIVER solde : une fermeture sans solde est refusée, et le refus dit l\'ordre stage-puis-commit', () => {
  const { base, principal } = depotAvecWorktree()
  try {
    // Aucune revue dans l'histoire de ce dépôt : le palier n'a pas d'origine, et c'est le SOLDE qui refuse.
    const out = sortieDriver('solde-ticket-guard.mjs', 'git commit -m "feat: x (corrige #424242)"', principal)
    const { hookSpecificOutput } = JSON.parse(out)
    assert.equal(hookSpecificOutput.permissionDecision, 'deny')
    assert.match(hookSpecificOutput.permissionDecisionReason, /424242/)
    assert.match(hookSpecificOutput.permissionDecisionReason, /L'index est lu AVANT l'exécution/)
  } finally {
    rmSync(base, { recursive: true, force: true })
  }
})

test('refus de PALIER : le message NOMME la MESURE (compte, tête, archive) — elle se re-vérifie en une commande', () => {
  const d = evaluateSolde({
    command: 'git commit -m "feat: x (corrige #77)"',
    today: '2026-09-02',
    readSolde: () => null,
    palier: { compte: 11, tete: '2c11fdd9a', chemin: '.claude/soldes/revue-palier-82e95be10.md' },
  })
  assert.ok(d, 'palier atteint sans revue : le refus manque')
  assert.equal(d.decision, 'deny')
  assert.match(d.reason, /11 commits de substance depuis 2c11fdd9a/)
  assert.match(d.reason, /revue-palier-82e95be10\.md/)
  assert.match(d.reason, /2c11fdd9a\.\.<tête>/, 'le refus doit dire la fenêtre attendue de la revue à écrire')
  assert.match(d.reason, /revue-palier-2026-09-02-2c11fdd9a\.md/, 'et le NOM du fichier à écrire')
})

test('refus de PALIER : un palier INMESURABLE refuse aussi — jamais un silence', () => {
  const d = evaluateSolde({
    command: 'git commit -m "feat: x (corrige #77)"',
    today: '2026-09-02',
    readSolde: () => null,
    palier: { compte: 0, tete: null, chemin: null, erreur: 'toutes les archives sont orphelines' },
  })
  assert.ok(d)
  assert.match(d.reason, /Palier INMESURABLE/)
  assert.match(d.reason, /toutes les archives sont orphelines/)
})

// ── Cumul de refus : la décision la plus stricte l'emporte ──────────────────────────────────
// Aucun évaluateur de ce fichier ne produit encore d'`ask` (le premier arrive avec la porte de
// l'arbre principal) : la branche se teste ICI, sur la fonction pure, pour qu'elle ne soit jamais
// livrée non mesurée.
test('decisionCumulee : un seul `deny` fait basculer tout le cumul', () => {
  const d = decisionCumulee([{ decision: 'ask', reason: 'a' }, { decision: 'deny', reason: 'b' }])
  assert.equal(d.decision, 'deny')
  assert.equal(d.reason, 'a || b')
})

test('decisionCumulee : `ask` seul reste `ask` ; un refus sans champ vaut `deny` ; aucun refus = null', () => {
  assert.equal(decisionCumulee([{ decision: 'ask', reason: 'a' }, null]).decision, 'ask')
  assert.equal(decisionCumulee([{ reason: 'a' }]).decision, 'deny')
  assert.equal(decisionCumulee([null, undefined]), null)
  assert.equal(decisionCumulee([]), null)
})

// ── PIPELINES : ce qu'un `|` chaîne réellement (#1679 L1a T3) ─────────────────────────────────────
// `segmentsProfonds` aplatit ; une garde qui décide sur la SORTIE d'une commande (runner tronqué par
// un filtre) a besoin du groupement, sans quoi deux commandes sans rapport enchaînées par `;`
// passent pour un tube — 3 faux positifs mesurés.
test('pipelinesProfonds : un pipeline par enchaînement, les segments d’un `|` restant groupés', () => {
  assert.deepEqual(
    pipelinesProfonds('npx eslint . ; git log | head -5'),
    [[['eslint', '.']], [['git', 'log'], ['head', '-5']]],
  )
  assert.deepEqual(
    pipelinesProfonds('npx vitest run | cat | tail -5'),
    [[['vitest', 'run'], ['cat'], ['tail', '-5']]],
  )
  assert.deepEqual(
    pipelinesProfonds('tsc --noEmit && tail -f log.txt'),
    [[['tsc', '--noEmit']], [['tail', '-f', 'log.txt']]],
  )
})

test('pipelinesProfonds : un pipeline IMBRIQUÉ est rendu à part, avant son enrobeur', () => {
  assert.deepEqual(
    pipelinesProfonds('sh -c "npx vitest run | tail -5" && git status'),
    [
      [['vitest', 'run'], ['tail', '-5']],
      [['sh', '-c', 'npx vitest run | tail -5']],
      [['git', 'status']],
    ],
  )
})

test('segmentsProfonds EST l’aplati de pipelinesProfonds (une seule traversée)', () => {
  for (const cmd of [
    'npx eslint . ; git log | head -5',
    'sh -c "npx vitest run | tail -5" && git status',
    'nohup env FOO=1 git commit -m x | tee f.txt',
    '',
  ]) {
    assert.deepEqual(segmentsProfonds(cmd), pipelinesProfonds(cmd).flat(), cmd)
  }
})
