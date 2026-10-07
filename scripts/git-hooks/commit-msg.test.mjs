// Porte au MESSAGE (#1728 train B) et porte du COMMIT (#2071) — la règle PURE
// (`scripts/guards/lib/sujetDeCommit.mjs`), le driver appelé comme git l'appelle (fichier du message en
// `$1`), et des `git commit` RÉELS dans des dépôts jetables, `core.hooksPath` pointé sur un dossier de
// hooks qui n'appelle que celui-ci.
//
// POURQUOI UN DOSSIER DE HOOKS À PART, et non `scripts/git-hooks` en entier : un dépôt jetable n'est
// pas ce dépôt — y jouer le `pre-commit` de ce projet mesurerait ses gardes sur un arbre étranger, et
// le refus lu ne serait plus celui qu'on teste. Le relais posé pointe le commit-msg.mjs RÉEL, par son
// chemin absolu : c'est bien ce code-ci que git exécute.
//
// Les bancs de la porte (#2071) lancent le commit par la FORME que la porte du PreToolUse ne lit pas
// (tableau du corps de #2071, tests « #2071 NON COUVERT » de scripts/hooks/solde-ticket-guard.test.mjs) :
// git le juge quand même. Chaque classe a son témoin (le commit passe) et son contre-témoin (refus, HEAD
// inchangé, stderr qui nomme le manque).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { chmodSync, copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { envDeDepotForge, instanceDeDepot } from '../guards/lib/depotGabarit.mjs'
import { commitDe, depotDe, fusionner, reussi } from '../guards/lib/gitPorte.mjs'
import { SUJET_MAX, lectureDuMessage, refusDeSujet, sujetDuMessage } from '../guards/lib/sujetDeCommit.mjs'
import { dateLocale } from '../hooks/repartition.mjs'
import { MOTIF_EJECTION, MOTIF_REGENERATION, messageDuTrain } from '../ops/etapesDuTrain.mjs'
import { refusDeVersion } from '../node-requis.mjs'
import { jugerFichierDeMessage } from './commit-msg.mjs'
import { CHEMIN_DU_JOURNAL } from './journal.mjs'
import { lancerGit, resultatDeGit } from '../test/gitDeBanc.mjs'

const ICI = dirname(fileURLToPath(import.meta.url))

/** Le shell des formes de commit : un bash réel sur toute plateforme (le `sh` de git sous win32 en est un,
 *  `sh` est dash sous Linux), car des formes jugées (`<(…)`) ne sont pas POSIX. */
const BASH = process.platform === 'win32' ? 'sh' : 'bash'
/** `script` lancé par `BASH -c` dans `cwd` sous `env`. */
const lancerBash = (script, { cwd, env }) => spawnSync(BASH, ['-c', script], { cwd, env, encoding: 'utf8' })
const DRIVER = join(ICI, 'commit-msg.mjs')

const SUJET_LONG = `fix(x): refs #1728 — ${'a'.repeat(130)}`

/** Un chemin en barres obliques : la graphie que lisent `sh` et git sur toute plateforme. */
const posix = (chemin) => chemin.replace(/\\/g, '/')

test('sujetDuMessage = première ligne non vide, les lignes de commentaire # ignorées', () => {
  assert.equal(sujetDuMessage('\n# gabarit de git\n\n  fix(x): sujet  \n\ncorps'), 'fix(x): sujet')
  assert.equal(sujetDuMessage('# tout en commentaire\n'), '')
  assert.equal(sujetDuMessage(''), '')
})

test('lectureDuMessage : les exigences lisent les lignes #, les satisfactions non ; les ciseaux coupent sur demande', () => {
  const message = 'fix(x): refs #7\n# corrige #5\nJUGE: vu\n# ------------------------ >8 ------------------------\n+corrige #9\n'
  const entier = lectureDuMessage(message)
  assert.match(entier.exigences, /# corrige #5/)
  assert.match(entier.exigences, /\+corrige #9/)
  assert.doesNotMatch(entier.satisfactions, /corrige #5/)
  assert.match(entier.satisfactions, /JUGE: vu/)
  const coupe = lectureDuMessage(message, { ciseaux: true })
  assert.doesNotMatch(coupe.texte, /corrige #9/)
  assert.match(coupe.exigences, /# corrige #5/)
})

test('un sujet de plus de 100 caractères est REFUSÉ, sa longueur nommée ; un CORPS long passe', () => {
  const refus = refusDeSujet(SUJET_LONG)
  assert.match(refus, new RegExp(`SUJET de commit de ${SUJET_LONG.length} caractères`))
  assert.match(refus, /le solde et les preuves dans le CORPS/)
  assert.equal(refusDeSujet(`fix(x): refs #1728 — porte de budget\n\n${'preuve '.repeat(400)}`), null)
  assert.equal(refusDeSujet('a'.repeat(SUJET_MAX)), null)
  assert.equal(refusDeSujet('a'.repeat(SUJET_MAX + 1)).length > 0, true)
})

test('AUCUNE exemption : un « Merge branch » automatique passe par sa LONGUEUR, pas par une règle à part', () => {
  assert.equal(refusDeSujet("Merge branch 'wt-1728-L2' into main\n"), null)
  assert.ok(refusDeSujet(`Merge branch '${'x'.repeat(120)}'`), 'une fusion au sujet trop long est refusée comme les autres')
})

test('sans fichier de message lisible, le driver REFUSE : un message non lu n’est pas jugé', async () => {
  const juger = () => assert.fail('la porte ne juge pas un message absent')
  assert.match((await jugerFichierDeMessage(undefined, { dir: '.', today: 'x', juger }))?.reason ?? '', /aucun fichier de message/)
  const illisible = await jugerFichierDeMessage('/absent/COMMIT_EDITMSG', { lire: () => { throw new Error('ENOENT') }, dir: '.', today: 'x', juger })
  assert.match(illisible?.reason ?? '', /message illisible \(\/absent\/COMMIT_EDITMSG\).*ENOENT/)
})

test('le driver appelé comme git l’appelle : exit 1 sur un sujet long, exit 0 sur un sujet court', () => {
  const { racine } = instanceDeDepot({ fichiers: { 'a.txt': 'v1\n' }, message: 'socle' })
  try {
    const fichier = join(racine, '.git', 'COMMIT_EDITMSG')
    const env = { ...envDeDepotForge(), GIT_EDITOR: ':' }
    writeFileSync(fichier, `${SUJET_LONG}\n\n# Please enter the commit message\n`, 'utf8')
    const rouge = spawnSync(process.execPath, [DRIVER, fichier], { cwd: racine, env, encoding: 'utf8' })
    assert.equal(rouge.status, 1)
    assert.match(rouge.stderr, /SUJET de commit de \d+ caractères/)

    writeFileSync(fichier, 'fix(x): refs #1728 — porte au message\n\ncorps très long ' + 'x'.repeat(500) + '\n', 'utf8')
    const vert = spawnSync(process.execPath, [DRIVER, fichier], { cwd: racine, env, encoding: 'utf8' })
    assert.equal(vert.status, 0, vert.stderr)
  } finally {
    rmSync(racine, { recursive: true, force: true })
  }
})

function dossierDeHooks() {
  const dir = mkdtempSync(join(tmpdir(), 'hooks-'))
  const relais = join(dir, 'commit-msg')
  const hook = readFileSync(join(ICI, 'commit-msg'), 'utf8')
  const cible = '"$(dirname "$0")/commit-msg.mjs"'
  assert.ok(hook.includes(cible))
  writeFileSync(relais, hook.replace(cible, `"${posix(DRIVER)}"`), 'utf8')
  chmodSync(relais, 0o755)
  return dir
}

for (const runtimeExplicite of [false, true]) test(`git commit réel : runtime ${runtimeExplicite ? 'npm explicite avec espaces' : 'node sans variable npm'}`, () => {
  const { racine } = instanceDeDepot({ fichiers: { 'a.txt': 'v1\n' }, message: 'socle' })
  const hooks = dossierDeHooks()
  try {
    const env = envDeDepotForge()
    const traceRuntime = join(hooks, 'runtime.json')
    delete env.npm_node_execpath
    if (runtimeExplicite) {
      const executable = join(hooks, process.platform === 'win32' ? 'node conforme.exe' : 'node conforme')
      copyFileSync(process.execPath, executable)
      chmodSync(executable, 0o755)
      env.npm_node_execpath = posix(executable)
      const sonde = join(hooks, 'runtime.cjs')
      writeFileSync(sonde, `require('node:fs').writeFileSync(${JSON.stringify(traceRuntime)}, JSON.stringify(process.execPath))`, 'utf8')
      env.NODE_OPTIONS = `${env.NODE_OPTIONS ?? ''} --require="${posix(sonde)}"`.trim()
    }
    const git = (...args) => resultatDeGit(args, { cwd: racine, env })
    lancerGit(['config', 'core.hooksPath', posix(hooks)], { cwd: racine, env })
    writeFileSync(join(racine, 'a.txt'), 'v2\n', 'utf8')
    lancerGit(['add', 'a.txt'], { cwd: racine, env })

    if (!runtimeExplicite) {
      const sonde = lancerBash('node -p process.versions.node', { cwd: racine, env })
      assert.equal(sonde.status, 0, sonde.stderr)
      const { engines } = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8'))
      const refus = refusDeVersion(engines.node, sonde.stdout.trim())
      if (refus) {
        const commit = git('commit', '-m', 'fix(a): refs #2258 — runtime requis')
        assert.notEqual(commit.status, 0)
        assert.ok(commit.stderr.includes(refus), commit.stderr)
        assert.equal(git('log', '--oneline').stdout.trim().split('\n').length, 1)
        return
      }
    }

    const refuse = git('commit', '-m', SUJET_LONG)
    assert.notEqual(refuse.status, 0, 'git a accepté un sujet trop long')
    if (runtimeExplicite) assert.equal(posix(JSON.parse(readFileSync(traceRuntime, 'utf8'))), env.npm_node_execpath)
    assert.match(refuse.stderr, /SUJET de commit de \d+ caractères/)
    assert.equal(git('log', '--oneline').stdout.trim().split('\n').length, 1, 'aucun commit n’a été posé')

    const passe = git('commit', '-m', 'fix(a): refs #1728 — un sujet court, les preuves au corps')
    assert.equal(passe.status, 0, passe.stderr)
    assert.equal(git('log', '--oneline').stdout.trim().split('\n').length, 2)
  } finally {
    rmSync(hooks, { recursive: true, force: true })
    rmSync(racine, { recursive: true, force: true })
  }
})

// ── La porte du COMMIT (#2071) ─────────────────────────────────────────────────────────────────

/** Le dépôt jeté de chaque banc : du `src/` (substance), la liste des registres porteurs que lit une
 *  fermeture (`evaluateRegistresPorteurs`), et une note (hors substance). */
const SOCLE = {
  'src/a.ts': 'export const a = 1\n',
  'src/b.ts': 'export const b = 1\n',
  'notes/x.md': 'x\n',
  'scripts/hooks/registres-porteurs.json': '[]\n',
}

/** Un message que la porte laisse passer sur un petit diff de `src/`, et un message sans ticket. */
const TEMOIN = 'fix(a): refs #7 — témoin'
const SANS_TICKET = 'chore: sans ticket'
const MANQUE_DE_TICKET = /Commit de SUBSTANCE sans ticket/
const MANQUE_DE_SOLDE = /Fermeture de ticket au commit sans SOLDE conforme/

/** Un solde conforme (`validateSolde`) daté du jour du hook. */
const soldeDuJour = () =>
  'VERIFIE: relu le diff complet, lancé npm test et vérifié les 3 fichiers touchés à la main.\n\n'
  + '## Restes\nRAS\n\n## Réfutation\nverdict: CONFIRMÉ\n'
  + 'Un juge adversarial a rejoué le diff contre le DoD du ticket, tenté 2 contournements, aucun ne passe.\n\n'
  + `(${dateLocale(new Date())})\n`

/** Un dépôt jetable dont `commit-msg` est le vrai hook, et ses gestes. `jeter()` en `finally`. */
function banc(fichiers = SOCLE) {
  const { racine } = instanceDeDepot({ fichiers, message: 'socle' })
  const hooks = dossierDeHooks()
  const env = { ...envDeDepotForge(), TEMP: hooks, TMP: hooks }
  lancerGit(['config', 'core.hooksPath', posix(hooks)], { cwd: racine, env })
  const git = (...args) => resultatDeGit(args, { cwd: racine, env })
  return {
    racine,
    hooks,
    env,
    git,
    /** `script` lancé par `lancerBash` dans `cwd` (la racine par défaut). */
    sh: (script, extra = {}, cwd = racine) => lancerBash(script, { cwd, env: { ...env, ...extra } }),
    head: (cwd = racine) => lancerGit(['rev-parse', 'HEAD'], { cwd, env }).trim(),
    ecrire: (rel, texte, base = racine) => {
      mkdirSync(dirname(join(base, rel)), { recursive: true })
      writeFileSync(join(base, rel), texte, 'utf8')
    },
    /** Le message d'un fichier hors du dépôt, son chemin en barres obliques. */
    message: (nom, texte) => {
      writeFileSync(join(hooks, nom), texte, 'utf8')
      return posix(join(hooks, nom))
    },
    /** Les verdicts que `commit-msg` a journalisés (`journaliserLeHook`), dans l'ordre. */
    verdicts: (base = racine) => {
      const chemin = join(base, CHEMIN_DU_JOURNAL)
      if (!existsSync(chemin)) return []
      return readFileSync(chemin, 'utf8').trim().split('\n').map((l) => JSON.parse(l)).filter((l) => l.hook === 'commit-msg').map((l) => l.verdict)
    },
    jeter: () => {
      rmSync(hooks, { recursive: true, force: true })
      rmSync(racine, { recursive: true, force: true })
    },
  }
}

/** Le commit est passé : statut 0 (sauf `statutLibre`) et HEAD déplacé. */
function passe(b, vu, avant, { statutLibre = false } = {}) {
  if (!statutLibre) assert.equal(vu.status, 0, `${vu.stdout}\n${vu.stderr}`)
  assert.notEqual(b.head(), avant, `le commit n'a pas été posé : ${vu.stderr}`)
}

/** Le commit est refusé : HEAD inchangé, et stderr nomme le manque. */
function refuse(b, vu, avant, manque) {
  assert.equal(b.head(), avant, `le commit a été posé : ${vu.stderr}`)
  assert.match(`${vu.stderr}`, manque)
}

/**
 * Les classes de commit que la porte du PreToolUse ne voit pas, chacune par son script `sh` : le
 * message vient de `$M` (témoin, puis sans ticket), le fichier de message de `$MF`. Un `src/` modifié et
 * NON stagé attend le commit (`-a`, ou le script stage lui-même) ; sous `propre`, le script modifie
 * lui-même un arbre propre. `saut` : la raison de ne pas jouer.
 */
const CLASSES = [
  { classe: 'substitution `$(…)`', script: 'out=$(git commit -a -m "$M" 2>&1); s=$?; printf "%s\\n" "$out" >&2; exit $s' },
  { classe: 'substitution par backquotes', script: 'out=`git commit -a -m "$M" 2>&1`; s=$?; printf "%s\\n" "$out" >&2; exit $s' },
  { classe: 'substitution de processus `<(…)`', script: 'cat <(git commit -a -m "$M" 2>&1) >&2' },
  { classe: 'git qui exécute : alias `!`', script: 'git -c alias.ci=\'!git commit -a -m "$M"\' ci' },
  { classe: 'git qui exécute : `rebase --exec`', propre: true, script: 'git rebase --exec=\'echo "// x" >> src/a.ts && git commit -a -m "$M"\' HEAD~1', statutLibre: true },
  { classe: 'valeur collée : `env --split-string=`', script: 'env --split-string="git commit -a -F ${MF}"' },
  { classe: 'stdin d’un shell : heredoc', script: 'sh <<\'EOF\'\ngit commit -a -m "$M"\nEOF' },
  { classe: 'stdin d’un shell : pipe', script: 'echo \'git commit -a -m "$M"\' | sh' },
  { classe: 'arguments venus de stdin : `xargs git`', script: 'printf "%s\\0" commit -a -m "$M" | xargs -0 git' },
  { classe: 'exécutable par variable', script: 'G=git; $G commit -a -m "$M"' },
  { classe: 'commit dans un fichier de script', script: 'printf \'git commit -a -m "$M"\\n\' > "$TEMP/x.sh"; sh "$TEMP/x.sh"' },
  { classe: 'alias git défini hors de la ligne', script: 'git config alias.ci commit && git ci -a -m "$M"' },
  { classe: 'variable de tête consommée par git (`GIT_EDITOR` d’un `git tag -a`)', script: 'GIT_EDITOR=\'git commit -a -m "$M" #\' git tag -a v9', statutLibre: true },
  { classe: 'interpréteur non shell (`node -e`)', script: 'G=git node -e "require(\'node:child_process\').execFileSync(process.env.G, [\'commit\', \'-a\', \'-m\', process.env.M], { stdio: \'inherit\' })"' },
  {
    classe: 'tête citeuse qui exécute (`gh alias set --shell`)',
    script: 'export GH_CONFIG_DIR="$TEMP/gh"; gh alias set --shell ci \'git commit -a -m "$M"\' >/dev/null && gh ci',
    saut: spawnSync('gh', ['--version'], { encoding: 'utf8' }).status === 0 ? false : '`gh` absent',
  },
]

for (const { classe, script, statutLibre = false, saut = false, propre = false } of CLASSES) {
  test(`#2071 porte au commit-msg — ${classe} : témoin passe, sans ticket refusé`, { skip: saut }, () => {
    for (const [message, attendu] of [[TEMOIN, 'passe'], [SANS_TICKET, 'refuse']]) {
      const b = banc()
      try {
        if (propre) {
          b.ecrire('notes/x.md', 'y\n')
          assert.equal(b.git('commit', '-a', '-m', 'docs: refs #7 — un second commit').status, 0)
        } else b.ecrire('src/a.ts', 'export const a = 2\n')
        const avant = b.head()
        const vu = b.sh(script, { M: message, MF: b.message('m.txt', `${message}\n`) })
        if (attendu === 'passe') passe(b, vu, avant, { statutLibre })
        else refuse(b, vu, avant, MANQUE_DE_TICKET)
      } finally {
        b.jeter()
      }
    }
  })
}

test('#2071 porte au commit-msg — porcelaine `git pull` : fusion propre passe, sa fermeture sans solde refusée', () => {
  const amont = banc()
  const b = banc()
  try {
    amont.ecrire('src/b.ts', 'export const b = 2\n')
    assert.equal(amont.git('commit', '-a', '-m', TEMOIN).status, 0)
    b.ecrire('src/a.ts', 'export const a = 2\n')
    assert.equal(b.git('commit', '-a', '-m', TEMOIN).status, 0)
    const avant = b.head()
    const editeur = b.message('editeur.sh', 'printf "Merge: corrige #5\\n" > "$1"\n')
    const ferme = b.sh(`git pull --no-rebase --edit "${posix(amont.racine)}" main`, { GIT_EDITOR: `sh "${editeur}"` })
    refuse(b, ferme, avant, MANQUE_DE_SOLDE)
    lancerGit(['merge', '--abort'], { cwd: b.racine, env: b.env })
    passe(b, b.sh(`git pull --no-rebase --no-edit "${posix(amont.racine)}" main`), avant)
  } finally {
    amont.jeter()
    b.jeter()
  }
})

test('#2071 porte au commit-msg — `-F` sous cinq formes (#2282) : jugé UNE fois, même verdict qu’un chemin littéral', () => {
  const MSYS = process.platform === 'win32'
  const formes = [
    { forme: 'chemin littéral', script: (mf) => `git commit -a -F "${mf}"` },
    { forme: 'chemin MSYS /c/…', script: (mf) => `git commit -a -F "${mf.replace(/^([A-Za-z]):/, (_, d) => `/${d.toLowerCase()}`)}"`, saut: !MSYS },
    { forme: 'heredoc dans la même commande', script: (_mf, texte) => `cat > "$TEMP/h.txt" <<'MSG'\n${texte}\nMSG\ngit commit -a -F "$TEMP/h.txt"` },
    { forme: '"$F"', script: (mf) => `F="${mf}"; git commit -a -F "$F"` },
    { forme: '"$TEMP/…"', script: () => 'git commit -a -F "$TEMP/m.txt"' },
    { forme: 'heredoc + add + commit', script: (_mf, texte) => `cat > "$TEMP/h.txt" <<'MSG'\n${texte}\nMSG\ngit add src/a.ts && git commit -F "$TEMP/h.txt"` },
  ]
  for (const { forme, script, saut } of formes) {
    if (saut) continue
    for (const [texte, attendu] of [[TEMOIN, 'franchi'], ['fix(a): corrige #5 — sans solde', 'refusé']]) {
      const b = banc()
      try {
        b.ecrire('src/a.ts', 'export const a = 2\n')
        const avant = b.head()
        const vu = b.sh(script(b.message('m.txt', `${texte}\n`), texte))
        if (attendu === 'franchi') passe(b, vu, avant)
        else refuse(b, vu, avant, MANQUE_DE_SOLDE)
        assert.deepEqual(b.verdicts(), [attendu], `${forme} : ${vu.stderr}`)
      } finally {
        b.jeter()
      }
    }
  }
})

test('#2071 porte au commit-msg — `-a` : le modifié suivi non stagé est jugé', () => {
  const b = banc()
  try {
    b.ecrire('src/a.ts', 'export const a = 2\n')
    const avant = b.head()
    refuse(b, b.git('commit', '-a', '-m', SANS_TICKET), avant, MANQUE_DE_TICKET)
    passe(b, b.git('commit', '-a', '-m', TEMOIN), avant)
  } finally {
    b.jeter()
  }
})

test('#2071 porte au commit-msg — `-- <chemins>` : un solde stagé hors pathspec n’est pas emporté', () => {
  const b = banc()
  try {
    b.ecrire('src/a.ts', 'export const a = 2\n')
    b.ecrire('.claude/soldes/5.md', soldeDuJour())
    assert.equal(b.git('add', '.claude/soldes/5.md').status, 0)
    const avant = b.head()
    const hors = b.git('commit', '-m', 'fix(a): corrige #5 — par pathspec', '--', 'src/a.ts')
    refuse(b, hors, avant, /NON EMPORTÉ par ce commit/)
    passe(b, b.git('commit', '-m', 'fix(a): corrige #5 — par pathspec', '--', 'src/a.ts', '.claude/soldes/5.md'), avant)
  } finally {
    b.jeter()
  }
})

test('#2071 porte au commit-msg — `-i` : l’arbre des chemins nommés ET l’index sont jugés', () => {
  const b = banc()
  try {
    b.ecrire('src/a.ts', 'export const a = 2\n')
    b.ecrire('notes/x.md', 'y\n')
    assert.equal(b.git('add', 'notes/x.md').status, 0)
    const avant = b.head()
    refuse(b, b.git('commit', '-i', '-m', SANS_TICKET, '--', 'src/a.ts'), avant, MANQUE_DE_TICKET)
    passe(b, b.git('commit', '-i', '-m', TEMOIN, '--', 'src/a.ts'), avant)
  } finally {
    b.jeter()
  }
})

test('#2071 porte au commit-msg — `--amend --no-edit` et `-C HEAD` : le message hérité est jugé', () => {
  for (const geste of [['--amend', '--no-edit'], ['-C', 'HEAD']]) {
    for (const [herite, attendu] of [['docs: refs #7 — hérité', 'passe'], ['docs: hérité sans ticket', 'refuse']]) {
      const b = banc()
      try {
        b.ecrire('notes/x.md', 'y\n')
        assert.equal(b.git('commit', '-a', '-m', herite).status, 0, 'un commit sans substance passe')
        b.ecrire('src/a.ts', 'export const a = 2\n')
        assert.equal(b.git('add', 'src/a.ts').status, 0)
        const avant = b.head()
        const vu = b.git('commit', ...geste)
        if (attendu === 'passe') passe(b, vu, avant)
        else refuse(b, vu, avant, MANQUE_DE_TICKET)
      } finally {
        b.jeter()
      }
    }
  }
})

test('#2071 porte au commit-msg — fusion propre (apport vide) passe ; résolution `src` sans ticket refusée', () => {
  const b = banc()
  try {
    assert.equal(b.git('checkout', '-q', '-b', 'br').status, 0)
    b.ecrire('src/b.ts', 'export const b = 2\n')
    assert.equal(b.git('commit', '-a', '-m', TEMOIN).status, 0)
    assert.equal(b.git('checkout', '-q', 'main').status, 0)
    b.ecrire('src/a.ts', 'export const a = 2\n')
    assert.equal(b.git('commit', '-a', '-m', TEMOIN).status, 0)
    const avantPropre = b.head()
    passe(b, b.git('merge', '--no-ff', '-m', 'chore: fusion propre sans ticket', 'br'), avantPropre)

    assert.equal(b.git('checkout', '-q', '-b', 'conflit', 'br').status, 0)
    b.ecrire('src/a.ts', 'export const a = 3\n')
    assert.equal(b.git('commit', '-a', '-m', TEMOIN).status, 0)
    assert.equal(b.git('checkout', '-q', 'main').status, 0)
    const avant = b.head()
    assert.notEqual(b.git('merge', '--no-edit', 'conflit').status, 0, 'la fusion entre en conflit')
    b.ecrire('src/a.ts', 'export const a = 4\n')
    assert.equal(b.git('add', 'src/a.ts').status, 0)
    refuse(b, b.git('commit', '--no-edit'), avant, MANQUE_DE_TICKET)
    passe(b, b.git('commit', '-m', 'Merge: refs #7 — résolution'), avant)
  } finally {
    b.jeter()
  }
})

test('#2071 porte au commit-msg — worktree lié, et commit lancé d’un sous-dossier', () => {
  const b = banc()
  const lie = join(mkdtempSync(join(tmpdir(), 'lie-')), 'wt')
  try {
    assert.equal(b.git('worktree', 'add', '-q', '-b', 'wtb', posix(lie)).status, 0)
    b.ecrire('src/a.ts', 'export const a = 2\n', lie)
    const avantLie = b.head(lie)
    const gitLie = (...args) => resultatDeGit(args, { cwd: lie, env: b.env })
    refuse({ head: () => b.head(lie) }, gitLie('commit', '-a', '-m', SANS_TICKET), avantLie, MANQUE_DE_TICKET)
    passe({ head: () => b.head(lie) }, gitLie('commit', '-a', '-m', TEMOIN), avantLie)

    b.ecrire('src/b.ts', 'export const b = 2\n')
    const avant = b.head()
    refuse(b, b.sh(`git commit -a -m "${SANS_TICKET}"`, {}, join(b.racine, 'src')), avant, MANQUE_DE_TICKET)
    passe(b, b.sh(`git commit -a -m "${TEMOIN}"`, {}, join(b.racine, 'src')), avant)
  } finally {
    rmSync(dirname(lie), { recursive: true, force: true })
    b.jeter()
  }
})

test('#2071 porte au commit-msg — `-v` : le diff après les ciseaux n’est pas lu ; `# corrige #5` sous `-m` est exigé', () => {
  const b = banc()
  try {
    b.ecrire('src/a.ts', 'export const a = 2 // corrige #9\n')
    const avant = b.head()
    const editeur = b.message('editeur.sh', `{ printf '${TEMOIN}\\n\\n'; cat "$1"; } > "$1.tmp" && mv "$1.tmp" "$1"\n`)
    const v = b.sh('git commit -a -v', { GIT_EDITOR: `sh "${editeur}"` })
    passe(b, v, avant)
    assert.match(b.git('log', '-1', '--format=%B').stdout, /refs #7/)

    b.ecrire('src/b.ts', 'export const b = 2\n')
    const apres = b.head()
    refuse(b, b.git('commit', '-a', '-m', TEMOIN, '-m', '# corrige #5'), apres, MANQUE_DE_SOLDE)
  } finally {
    b.jeter()
  }
})

test('#2071 porte au commit-msg — les commits scriptés du train (`commitDe`, `fusionner`) la franchissent', () => {
  const b = banc()
  try {
    const depot = depotDe(b.racine, { env: b.env })
    assert.equal(b.git('checkout', '-q', '-b', 'br').status, 0)
    b.ecrire('notes/x.md', 'y\n')
    b.ecrire('src/b.ts', 'export const b = 2\n')
    const docs = commitDe(depot, { message: messageDuTrain({ portee: 'chore(docs)', titre: 'docs dérivés', numeros: ['7'], motif: MOTIF_REGENERATION }), chemins: ['notes/x.md', 'src/b.ts'] })
    assert.ok(reussi(docs), JSON.stringify(docs))
    assert.equal(b.git('checkout', '-q', 'main').status, 0)
    b.ecrire('src/a.ts', 'export const a = 2\n')
    assert.equal(b.git('commit', '-a', '-m', TEMOIN).status, 0)
    const avant = b.head()
    const fusion = fusionner(depot, { de: 'br', message: messageDuTrain({ portee: 'chore(merge)', titre: 'fusion de br dans main', numeros: ['7'], motif: MOTIF_EJECTION }) })
    assert.ok(reussi(fusion), JSON.stringify(fusion))
    assert.notEqual(b.head(), avant)
    assert.deepEqual(b.verdicts(), ['franchi', 'franchi', 'franchi'])
  } finally {
    b.jeter()
  }
})
