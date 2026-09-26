// Tests du garde `git-destructive-guard` : `ask` sur un git destructif RÉELLEMENT exécuté, silence
// sur la même chaîne simplement CITÉE. Lancé par `npm run test:hooks`.
//
// Les cas de RÉPERTOIRE PROUVÉ (dernier bloc) montent un vrai dépôt et un vrai worktree lié sous
// `os.tmpdir()` : la distinction arbre principal / worktree se lit sur le `.git` (dossier vs
// fichier), elle ne se simule pas.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { evaluate } from './git-destructive-guard.mjs'
import { instanceDeDepot } from '../guards/lib/depotGabarit.mjs'

const asks = (cmd) => evaluate(cmd) !== null
const silent = (cmd) => evaluate(cmd) === null
/** Silence pour une commande jugée avec le `cwd` que le canal transmet. */
const silent2 = (cmd, cwd) => evaluate(cmd, { cwd }) === null

test('ASK : les commandes destructives réellement exécutées', () => {
  assert.ok(asks('git reset --hard origin/main'))
  assert.ok(asks('git checkout -- src/engine/combat.ts'))
  assert.ok(asks('git checkout .'))
  assert.ok(asks('git restore src/ui/RollShell.tsx'))
  assert.ok(asks('git clean -fd'))
  assert.ok(asks('git clean -fdx'))
  assert.ok(asks('git stash'))
  assert.ok(asks('git stash pop'))
  assert.ok(asks('git push --force origin main'))
  assert.ok(asks('git push -f'))
  assert.ok(asks('git push --force-with-lease'))
})

test('ASK : destructif en 2e maillon d\'un enchaînement, ou via un chemin/call-operator', () => {
  assert.ok(asks('npm test && git reset --hard'))
  assert.ok(asks('& "C:\\Program Files\\Git\\git.exe" stash'))
})

test('SILENCE : opérations git non destructives', () => {
  assert.ok(silent('git status'))
  assert.ok(silent('git stash list'))
  assert.ok(silent('git stash show -p'))
  assert.ok(silent('git restore --staged src/data/qualities.json'))
  assert.ok(silent('git reset HEAD~1'))          // reset sans --hard (index seulement)
  assert.ok(silent('git checkout -b chantier'))  // création de branche
  assert.ok(silent('git push origin main'))
  assert.ok(silent('git clean -n'))              // dry-run
})

test('SILENCE : la commande destructive CITÉE dans une chaîne n\'exécute rien', () => {
  // Faux positif mesuré 2026-08-03 sur l'ancien grep de sous-chaîne : ces 4 commandes étaient
  // bloquées alors qu'aucune n'exécute git.
  assert.ok(silent('Write-Output "git stash"'))
  assert.ok(silent('echo "git reset --hard"'))
  assert.ok(silent('git commit -m "doc: ne jamais faire git reset --hard sur un arbre partagé"'))
  assert.ok(silent('gh issue create --title X --label bug --body "éviter git clean -fd ici"'))
})

// ── Liens sur node_modules (#1679 L1c) ─────────────────────────────────────────────────────

const refuse = (cmd) => evaluate(cmd)?.decision === 'deny'
const BS = String.fromCharCode(92) // antislash Windows, sans échappement à relire
const WT = 'C:' + BS + 'w' + BS + '.wt-1679' + BS + 'node_modules'
const PRINCIPAL = 'C:' + BS + 'w' + BS + 'Game' + BS + 'node_modules'

test('DENY : les quatre graphies de lien vers un node_modules', () => {
  assert.ok(refuse(`New-Item -ItemType Junction -Path "${WT}" -Target "${PRINCIPAL}"`))
  assert.ok(refuse('New-Item -ItemType SymbolicLink -Path .wt-1679/node_modules -Target ../node_modules'))
  assert.ok(refuse(`mklink /J "${WT}" "${PRINCIPAL}"`))
  assert.ok(refuse('ln -s ../Game/node_modules ./node_modules'))
})

test('DENY : le refus dit POURQUOI et ce qu\'il faut faire à la place', () => {
  const d = evaluate('ln -s ../Game/node_modules ./node_modules')
  assert.equal(d.decision, 'deny')
  assert.match(d.reason, /node_modules/)
  assert.match(d.reason, /npm ci/)
})

test('PASSE : un lien qui ne touche AUCUN node_modules', () => {
  assert.ok(silent(`New-Item -ItemType Junction -Path .${BS}Source -Target ..${BS}Source`))
  assert.ok(silent('ln -s ../Game/src/data/qualities.json ./qualities.json'))
})

test('PASSE : New-Item ordinaire, et la commande simplement CITÉE', () => {
  assert.ok(silent('New-Item -ItemType Directory -Force node_modules'))
  assert.ok(silent('git commit -m "doc: jamais de junction sur node_modules (ln -s ../node_modules)"'))
})

test('un git destructif reste un ASK, jamais un DENY', () => {
  assert.equal(evaluate('git reset --hard').decision, 'ask')
})

// Deux trous MESURÉS du deny (juge #1679 L1c) : PowerShell accepte tout préfixe NON AMBIGU d'un
// nom de paramètre, et `mklink` est un builtin de `cmd` — l'exécutable lu était alors `cmd`.

test('DENY : `-ItemType` abrégé en préfixe non ambigu (PowerShell l\'accepte)', () => {
  for (const p of ['-it', '-item', '-itemt', '-ItemTy', '-ITEMTYPE']) {
    const d = evaluate(`New-Item ${p} Junction -Path .wt-1679${BS}node_modules -Target ..${BS}node_modules`)
    assert.equal(d?.decision, 'deny', p)
    assert.match(d.reason, /node_modules/)
    assert.match(d.reason, /npm ci/)
  }
})

test('DENY : `mklink` lancé DERRIÈRE cmd /c (builtin, l\'exe lu est `cmd`)', () => {
  const cmds = [
    `cmd /c mklink /J .wt-1679${BS}node_modules ..${BS}node_modules`,
    `cmd.exe /C mklink /D .wt-1679${BS}node_modules ..${BS}node_modules`,
    `cmd /c "cd .wt-1679 & mklink /J node_modules ..${BS}node_modules"`,
    `cmd /c cd .wt-1679 & mklink /J node_modules ..${BS}node_modules`,
  ]
  for (const c of cmds) {
    const d = evaluate(c)
    assert.equal(d?.decision, 'deny', c)
    assert.match(d.reason, /node_modules/)
    assert.match(d.reason, /npm ci/)
  }
})

test('PASSE : le préfixe abrégé ne vise QUE les liens, et cmd sans mklink ne dit rien', () => {
  assert.ok(silent('New-Item -it Directory node_modules'))
  assert.ok(silent(`cmd /c rmdir .wt-1679${BS}node_modules`))
  assert.equal(evaluate('git reset --hard').decision, 'ask')
})

// ── `git show` dont le commit passe APRÈS `--` : une MESURE fausse, silencieuse ────────────────────
test('DENY : le commit placé après `--` devient un pathspec (mesuré 2026-08-26)', () => {
  const d = evaluate('git show --stat --format= -- src/data src/scenes 951d6b1fd')
  assert.equal(d?.decision, 'deny')
  assert.match(d.reason, /951d6b1fd/)
  assert.match(d.reason, /pathspec/i)
  assert.match(d.reason, /git show <commit> -- <paths>/)
  assert.equal(evaluate('git show --stat -- 21d0153b7')?.decision, 'deny')
})

test('PASSE : la forme correcte, et un `git show` sans séparateur', () => {
  assert.ok(silent('git show --stat --format= 951d6b1fd -- src/data src/scenes'))
  assert.ok(silent('git show 951d6b1fd'))
  assert.ok(silent('git show HEAD -- src/ui'))
  assert.ok(silent('git show --stat -- src/data'), 'un pathspec ordinaire ne ressemble pas à un sha')
})

// ── Suppression RÉCURSIVE : arbitrage humain hors des cibles jetables ─────────────────────────────
test('ASK : rm -rf / Remove-Item -Recurse sur une cible qui peut porter du WIP', () => {
  for (const cmd of ['rm -rf src/ui', 'rm -r .wt-1679-L1a', 'rm -rf docs/plans .claude/soldes',
    'Remove-Item -Recurse -Force src/gameIso', 'Remove-Item -Recurse -Path .claude/memory']) {
    const d = evaluate(cmd)
    assert.equal(d?.decision, 'ask', cmd)
    assert.match(d.reason, /RÉCURSIVE/)
  }
})

test('PASSE : les cibles JETABLES (dépendances, artefacts, scratchpad) et une suppression non récursive', () => {
  const BS2 = String.fromCharCode(92)
  assert.ok(silent('rm -rf node_modules'))
  assert.ok(silent('rm -rf .wt-1679-L1a/node_modules'))
  assert.ok(silent('rm -rf node_modules/.cache dist'))
  assert.ok(silent('rm -rf public/qc'))
  assert.ok(silent('rm -rf ' + ['/c/Users', 'x/AppData/Local/Temp/claude/session/scratchpad/t3'].join('/')))
  assert.ok(silent('Remove-Item -Recurse -Force C:' + BS2 + 'Users' + BS2 + 'x' + BS2 + 'AppData' + BS2 + 'Local' + BS2 + 'Temp' + BS2 + 'claude' + BS2 + 'sess' + BS2 + 'out'))
  assert.ok(silent('rm src/ui/A.tsx'), 'sans -r, ce garde ne dit rien (un fichier nommé se relit en diff)')
  assert.ok(silent('Remove-Item src/ui/A.tsx'))
})

test('la suppression récursive est vue DERRIÈRE un sous-shell et un enrobeur de tête', () => {
  assert.equal(evaluate('sh -c "rm -rf src/state"')?.decision, 'ask')
  assert.equal(evaluate('nohup rm -rf src/state')?.decision, 'ask')
  assert.ok(silent('sh -c "rm -rf node_modules"'))
})

test('PÉRIMÈTRE DIT : une cible venue de stdin ou d\'un autre programme n\'est pas sur la ligne', () => {
  // Le silence est ici un FAIT du périmètre (docstring en tête du garde), pas un oubli : la ligne de
  // commande ne porte aucun chemin, et le garde décide sur les chemins qu'il LIT.
  assert.ok(silent('echo src/engine | xargs rm -rf'))
  assert.ok(silent('find . -name "*.tmp" -exec rm -rf {} ;'))
  // Le même geste, cible ÉCRITE sur la ligne, reste arbitré.
  assert.equal(evaluate('xargs rm -rf src/engine')?.decision, 'ask')
})

// ── Répertoire PROUVÉ : le worktree lié est libre, l'arbre principal ne l'est pas ─────────────────
// Question utilisateur 2026-09-03 : « Pour les git destructif, on devrait pouvoir les faire sur les
// worktree, tu ne pense pas ? ». Gestes mesurés en dépôt jetable (sonde du juge, rejouée ici) :
// une branche extraite ailleurs est refusée par git lui-même, un `reset --hard` dans un worktree
// n'atteint pas le WIP de l'arbre principal (index privé), et `git clean -fdx` retire le point de
// reparse d'une jonction `node_modules` sans suivre la jonction.

/** Un dépôt PRINCIPAL (`.git` dossier) et son worktree LIÉ (`.git` fichier) posé dans `<principal>/wt`,
 *  sous `os.tmpdir()`. Le `.gitignore` y tient le rôle de l'entrée `.wt-` du dépôt (.gitignore:54) :
 *  un arbre principal qui héberge un worktree reste PROPRE. */
function deuxArbres() {
  const { racine: principal } = instanceDeDepot({ fichiers: { 'a.txt': 'v1\n', '.gitignore': '/wt/\n' }, message: 'socle' })
  const lie = join(principal, 'wt')
  const git = (cwd, ...args) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
  git(principal, 'worktree', 'add', '-q', lie, '-b', 'chantier')
  return { base: principal, principal, lie }
}

test('D : dans un WORKTREE prouvé par la commande, checkout/restore/reset/clean passent en SILENCE', () => {
  const { base, principal, lie } = deuxArbres()
  try {
    for (const geste of ['reset --hard', 'clean -fdx', 'checkout -- .', 'restore src/a.txt']) {
      assert.ok(silent(`cd ${lie} && git ${geste}`), `cd <worktree> && git ${geste} : le hook parle encore`)
      assert.ok(silent(`git -C ${lie} ${geste}`), `git -C <worktree> ${geste} : le hook parle encore`)
      assert.equal(evaluate(`cd ${principal} && git ${geste}`)?.decision, 'ask', `arbre PRINCIPAL : ${geste}`)
    }
  } finally {
    rmSync(base, { recursive: true, force: true })
  }
})

// Les graphies PowerShell du changement de répertoire (#1729) : même source que `cd`
// (`repertoireNommeParLaCommande`), donc MÊME surface de permission ici — dite, et mesurée.
test('D : `Set-Location <worktree>` prouve l’arbre comme `cd` ; vers l’arbre PRINCIPAL, ASK tenu', () => {
  const { base, principal, lie } = deuxArbres()
  try {
    for (const mot of ['Set-Location', 'sl', 'chdir', 'pushd']) {
      assert.ok(silent(`${mot} ${lie}; git reset --hard`), `${mot} <worktree> : le hook parle encore`)
      assert.equal(evaluate(`${mot} ${principal}; git reset --hard`)?.decision, 'ask', `${mot} <arbre principal>`)
    }
  } finally {
    rmSync(base, { recursive: true, force: true })
  }
})

test('D : sans preuve de répertoire, ASK inchangé — et le refus dit le geste qui le lèverait', () => {
  const nu = evaluate('git reset --hard')
  assert.equal(nu?.decision, 'ask', 'un reset --hard NU ne prouve aucun arbre : il reste arbitré')
  assert.match(nu.reason, /git -C <worktree>/)
  assert.match(nu.reason, /cd <worktree>/)
})

// Le silence exige une preuve POSITIVE de worktree lié. « Pas l'arbre principal » répondait pareil
// pour un chemin qui ne mène à AUCUN dépôt : la permission se donnait à une faute de frappe.
test('D : un chemin qui ne prouve AUCUN worktree lié reste ASK', () => {
  const dehors = mkdtempSync(join(tmpdir(), 'sans-depot-'))
  try {
    assert.equal(evaluate(`git -C ${dehors}/.wt-inexistant reset --hard`)?.decision, 'ask')
    assert.equal(evaluate(`cd ${dehors} && git reset --hard`)?.decision, 'ask')
    // Un chemin RELATIF se résout contre le cwd : sous un worktree, `./.wt-inexistant` désigne un
    // sous-dossier de CE worktree, et le silence y est juste — ce que la porte lit, c'est l'arbre
    // qui gouverne le chemin, jamais son existence.
    const { base, lie } = deuxArbres()
    try {
      assert.equal(evaluate(`git -C ${lie}/pas-encore-cree reset --hard`), null)
    } finally {
      rmSync(base, { recursive: true, force: true })
    }
  } finally {
    rmSync(dehors, { recursive: true, force: true })
  }
})

// Les `cd` se PLIENT : le DERNIER dit où la commande s'exécute. Retenir le premier accordait le
// silence à un geste qui avait quitté le worktree.
test('D : `cd <wt> && cd .. && git reset --hard` n\'est plus dans le worktree — ASK', () => {
  const { base, lie } = deuxArbres()
  try {
    assert.equal(evaluate(`cd ${lie} && git reset --hard`), null, 'le cas simple doit rester silencieux')
    assert.equal(evaluate(`cd ${lie} && cd .. && git reset --hard`)?.decision, 'ask')
    // Et l'inverse : partir d'ailleurs pour ENTRER dans le worktree se lit aussi.
    assert.equal(evaluate(`cd ${base} && cd wt && git reset --hard`), null)
  } finally {
    rmSync(base, { recursive: true, force: true })
  }
})

test('D : le canal ctx_shell PROUVE le répertoire par tool_input.cwd', () => {
  const { base, principal, lie } = deuxArbres()
  try {
    assert.ok(silent2('git reset --hard', lie), 'cwd = worktree lié : silence')
    assert.equal(evaluate('git reset --hard', { cwd: principal })?.decision, 'ask', 'cwd = arbre principal : ask')
  } finally {
    rmSync(base, { recursive: true, force: true })
  }
})

test('D : `stash` reste ASK dans un worktree — sa pile est PARTAGÉE par tous les arbres', () => {
  const { base, principal, lie } = deuxArbres()
  try {
    // Le dossier git COMMUN est ce qui porte `refs/stash` : deux arbres qui le partagent partagent
    // la pile. Comparé en ABSOLU des deux côtés — un worktree délié rendrait le sien.
    const communDe = (cwd) => execFileSync('git', ['-C', cwd, 'rev-parse', '--path-format=absolute', '--git-common-dir'], {
      encoding: 'utf8', cwd: base,
    }).trim().replace(/\\/g, '/')
    assert.equal(
      communDe(lie),
      communDe(principal),
      'la pile de stash devrait être partagée : sans cela, le `ask` de stash n’aurait plus de raison',
    )
    for (const geste of ['stash pop', 'stash drop', 'stash clear', 'stash apply', 'stash push -m wip']) {
      const d = evaluate(`cd ${lie} && git ${geste}`)
      assert.equal(d?.decision, 'ask', `git ${geste} en worktree : le hook s’est tu`)
      assert.match(d.reason, /pile de stash est PARTAG/)
    }
  } finally {
    rmSync(base, { recursive: true, force: true })
  }
})

// La PERMISSION accordée en worktree repose sur trois faits de git. Ils se mesurent, ils ne se
// supposent pas : le jour où l'un d'eux change, c'est ici que ça rougit, pas en production.
test('D : FONDEMENT — un `reset --hard` en worktree n’atteint pas le WIP de l’arbre principal', () => {
  const { base, principal, lie } = deuxArbres()
  try {
    writeFileSync(join(principal, 'a.txt'), 'WIP-PRINCIPAL\n')
    writeFileSync(join(lie, 'a.txt'), 'WIP-WORKTREE\n')
    execFileSync('git', ['-C', lie, 'reset', '--hard'], { stdio: 'ignore' })
    assert.equal(readFileSync(join(principal, 'a.txt'), 'utf8'), 'WIP-PRINCIPAL\n', 'le WIP du principal a bougé')
    assert.deepEqual(
      execFileSync('git', ['-C', principal, 'status', '--porcelain'], { encoding: 'utf8' })
        .split('\n').map((l) => l.trim()).filter(Boolean),
      ['M a.txt'],
      'l’arbre principal ne porte que SA modification : le worktree hébergé y est ignoré',
    )
  } finally {
    rmSync(base, { recursive: true, force: true })
  }
})

test('D : FONDEMENT — git REFUSE lui-même d’extraire ailleurs la branche que le worktree tient', () => {
  const { base, principal } = deuxArbres()
  try {
    const vu = spawnSync('git', ['-C', principal, 'checkout', 'chantier'], { encoding: 'utf8' })
    assert.notEqual(vu.status, 0)
    assert.match(vu.stderr, /is already used by worktree/)
  } finally {
    rmSync(base, { recursive: true, force: true })
  }
})

test(
  'D : FONDEMENT — `git clean -fdx` retire le point de reparse d’une jonction, pas sa CIBLE',
  { skip: process.platform === 'win32' ? false : 'la jonction est un objet NTFS : hors win32, il n’y a rien à mesurer' },
  () => {
    const { base, lie } = deuxArbres()
    try {
      const partage = join(base, 'node_modules_partage')
      mkdirSync(partage)
      writeFileSync(join(partage, 'tresor.txt'), 'NE PAS PERDRE\n')
      symlinkSync(partage, join(lie, 'node_modules'), 'junction')
      execFileSync('git', ['-C', lie, 'clean', '-fdx'], { stdio: 'ignore' })
      assert.equal(existsSync(join(lie, 'node_modules')), false, 'le point de reparse devrait avoir disparu')
      assert.deepEqual(readdirSync(partage), ['tresor.txt'], 'la CIBLE partagée a été suivie et vidée')
    } finally {
      rmSync(base, { recursive: true, force: true })
    }
  },
)

test('D : la jonction node_modules reste DENY, et `push --force` reste ASK, même en worktree prouvé', () => {
  const { base, lie } = deuxArbres()
  try {
    assert.equal(evaluate(`cd ${lie} && ln -s /ailleurs/node_modules node_modules`)?.decision, 'deny')
    assert.equal(evaluate(`cd ${lie} && git push --force origin main`)?.decision, 'ask')
  } finally {
    rmSync(base, { recursive: true, force: true })
  }
})
