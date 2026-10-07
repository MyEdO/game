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
// Les bancs de la porte (#2071) lancent le commit sous chacune des formes du tableau du corps de #2071 :
// git le juge quand même. Chaque classe a son témoin (le commit passe) et son contre-témoin (refus, HEAD
// inchangé, stderr qui nomme le manque).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { chmodSync, copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { envDeDepotForge, envGitFeint, instanceDeDepot } from '../guards/lib/depotGabarit.mjs'
import { MARQUE_FEINTE, commitDe, depotDe, fusionner, reussi } from '../guards/lib/gitPorte.mjs'
import { SUJET_MAX, lectureDuMessage, refusDeSujet, sujetDuMessage } from '../guards/lib/sujetDeCommit.mjs'
import { dateLocale } from '../guards/lib/dateLocale.mjs'
import { MOTIF_EJECTION, MOTIF_REGENERATION, messageDuTrain } from '../ops/etapesDuTrain.mjs'
import { refusDeVersion } from '../node-requis.mjs'
import { jugerFichierDeMessage } from './commit-msg.mjs'
import { CHEMIN_DU_JOURNAL } from './journal.mjs'
import { gitDe, lancerGit, resultatDeGit } from '../test/gitDeBanc.mjs'

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

test('lectureDuMessage : les exigences lisent les lignes #, les satisfactions non ; sous les ciseaux, la suite est exigée, jamais satisfaisante', () => {
  const message = 'fix(x): refs #7\n# corrige #5\nJUGE: vu\n# ------------------------ >8 ------------------------\n+corrige #9\n'
  const entier = lectureDuMessage(message)
  assert.match(entier.exigences, /# corrige #5/)
  assert.match(entier.exigences, /\+corrige #9/)
  assert.doesNotMatch(entier.satisfactions, /corrige #5/)
  assert.match(entier.satisfactions, /JUGE: vu/)
  const coupe = lectureDuMessage(`${message}JUGE: sous les ciseaux\n`, { ciseaux: true })
  assert.match(coupe.exigences, /corrige #9/)
  assert.doesNotMatch(coupe.satisfactions, /corrige #9|sous les ciseaux/)
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
 * Les classes de commit du corps de #2071, chacune par son script `sh` : le
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

test('#2071 porte au commit-msg — un heredoc qui porte `JUGE:` dans la COMMANDE ne satisfait pas la porte : elle juge le message', () => {
  const b = banc()
  try {
    b.ecrire('src/a.ts', Array.from({ length: 30 }, (_, i) => `export const v${i} = 1\n`).join(''))
    const avant = b.head()
    const vu = b.sh('cat > /dev/null <<\'EOF\' && git commit -a -m "feat(a): refs #7 — x"\n'
      + 'JUGE: juge adversarial opus a refuté le lot entier, verdict NON-REFUTE, preuves au ticket\nEOF')
    refuse(b, vu, avant, /sans juge/)
    assert.deepEqual(b.verdicts(), ['refusé'], vu.stderr)
  } finally {
    b.jeter()
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

test('#2071 porte au commit-msg — `-a`, `-- <chemin>`, `-i` : un stage écrasé par l’arbre est refusé ; sans stage, ou tout stagé, passe (P4)', () => {
  const HUNKS = /stage par hunk/
  for (const geste of [['-a'], ['--', 'src/a.ts'], ['-i', '--', 'src/a.ts']]) {
    for (const etat of ['mi-stagé', 'sans stage', 'tout stagé']) {
      const b = banc()
      try {
        b.ecrire('src/a.ts', 'export const a = 2\n')
        if (etat !== 'sans stage') assert.equal(b.git('add', 'src/a.ts').status, 0)
        if (etat === 'mi-stagé') b.ecrire('src/a.ts', 'export const a = 3\n')
        const avant = b.head()
        const vu = b.git('commit', '-m', TEMOIN, ...geste)
        if (etat === 'mi-stagé') {
          refuse(b, vu, avant, HUNKS)
          assert.match(vu.stderr, /src\/a\.ts/, `${geste.join(' ')} : ${vu.stderr}`)
        } else {
          passe(b, vu, avant)
          assert.doesNotMatch(vu.stderr, HUNKS, `${geste.join(' ')} ${etat}`)
        }
      } finally {
        b.jeter()
      }
    }
  }
})

test('#2071 porte au commit-msg — renommage d’un NON-porteur VERS un porteur : stock qui naît, refusé sans `CLIQUET:`', () => {
  const LISTE = `${JSON.stringify(['src/ui/A.tsx', 'src/ui/B.tsx', 'src/ui/C.tsx', 'src/ui/D.tsx'], null, 2)}\n`
  const b = banc({ ...SOCLE, 'docs/liste.json': LISTE })
  try {
    mkdirSync(join(b.racine, 'scripts', 'guards'), { recursive: true })
    assert.equal(b.git('mv', 'docs/liste.json', 'scripts/guards/liste.json').status, 0)
    const avant = b.head()
    refuse(b, b.git('commit', '-m', TEMOIN), avant, /STOCK NOMINATIF qui NAÎT ou GRANDIT : scripts\/guards\/liste\.json : \+4/)
    passe(b, b.git('commit', '-m', TEMOIN, '-m', 'CLIQUET: scripts/guards/liste.json +4 — la liste quitte docs/ pour les gardes'), avant)
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

test('#2071 porte au commit-msg — ciseaux sous `-e` sans `-v` (P3bis) : git enregistre la suite, la porte l’exige', () => {
  const b = banc()
  try {
    const ciseaux = b.message('ciseaux.txt', 'docs: refs #3 — note\n\n# ------------------------ >8 ------------------------\ncorrige #12\n')
    b.ecrire('src/a.ts', 'export const a = 4\n')
    const avant = b.head()
    const p3bis = b.sh(`git commit -a -e -F "${ciseaux}"`, { GIT_EDITOR: 'true' })
    refuse(b, p3bis, avant, MANQUE_DE_SOLDE)
    assert.match(p3bis.stderr, /#12/)
  } finally {
    b.jeter()
  }
})

test('#2071 porte au commit-msg — ciseaux : la suite est exigée sous `-v` ; `# corrige #5` sous `-m` est exigé', () => {
  const b = banc()
  try {
    const editeur = b.message('editeur.sh', `{ printf '${TEMOIN}\\n\\n'; cat "$1"; } > "$1.tmp" && mv "$1.tmp" "$1"\n`)
    b.ecrire('src/a.ts', 'export const a = 2\n')
    const avant = b.head()
    passe(b, b.sh('git commit -a -v', { GIT_EDITOR: `sh "${editeur}"` }), avant)
    assert.match(b.git('log', '-1', '--format=%B').stdout, /refs #7/)

    b.ecrire('src/a.ts', 'export const a = 3 // corrige #9\n')
    const avantV = b.head()
    refuse(b, b.sh('git commit -a -v', { GIT_EDITOR: `sh "${editeur}"` }), avantV, MANQUE_DE_SOLDE)

    b.ecrire('src/b.ts', 'export const b = 2\n')
    const apres = b.head()
    refuse(b, b.git('commit', '-a', '-m', TEMOIN, '-m', '# corrige #5'), apres, MANQUE_DE_SOLDE)
  } finally {
    b.jeter()
  }
})

test('lectureDuMessage : le caractère de commentaire est un paramètre — satisfactions et ciseaux le suivent', () => {
  const message = 'fix(x): sujet\n; refs #7\n# refs #8\n; ------------------------ >8 ------------------------\n+corrige #9\n'
  const lu = lectureDuMessage(message, { ciseaux: true, commentaire: ';' })
  assert.doesNotMatch(lu.satisfactions, /refs #7/)
  assert.match(lu.satisfactions, /refs #8/)
  assert.doesNotMatch(lu.satisfactions, /corrige #9/)
  assert.match(lu.exigences, /corrige #9/)
  assert.equal(sujetDuMessage('; gabarit\nfix(x): sujet', { commentaire: ';' }), 'fix(x): sujet')
})

test('#2071 porte au commit-msg — `core.commentChar`/`core.commentString` : la porte lit les commentaires du dépôt, la dernière valeur l’emporte ; `auto` est refusé', () => {
  const MESSAGE = `${SANS_TICKET}\n\n# refs #7`
  const CAS = [
    [[], 'refuse'],
    [[['core.commentChar', ';']], 'passe'],
    [[['core.commentString', ';']], 'passe'],
    [[['core.commentChar', ';'], ['core.commentString', '#']], 'refuse'],
    [[['core.commentString', '#'], ['core.commentChar', ';']], 'passe'],
  ]
  for (const [reglages, attendu] of CAS) {
    const b = banc()
    try {
      for (const [cle, valeur] of reglages) lancerGit(['config', cle, valeur], { cwd: b.racine, env: b.env })
      b.ecrire('src/a.ts', 'export const a = 2\n')
      const avant = b.head()
      const vu = b.git('commit', '-a', '-m', MESSAGE)
      if (attendu === 'passe') passe(b, vu, avant)
      else refuse(b, vu, avant, MANQUE_DE_TICKET)
    } finally {
      b.jeter()
    }
  }
  const b = banc()
  try {
    lancerGit(['config', 'core.commentChar', 'auto'], { cwd: b.racine, env: b.env })
    b.ecrire('src/a.ts', 'export const a = 2\n')
    const avant = b.head()
    refuse(b, b.git('commit', '-a', '-m', TEMOIN), avant, /caractère de commentaire `auto`/)
  } finally {
    b.jeter()
  }
})

test('#2071 porte au commit-msg — `core.commentString=;` sous `--cleanup=strip` : les `; JUGE:`/`; REFUTATION:` que git retire ne satisfont pas la porte (P2bis)', () => {
  const b = banc()
  try {
    lancerGit(['config', 'core.commentString', ';'], { cwd: b.racine, env: b.env })
    b.ecrire('src/a.ts', Array.from({ length: 30 }, (_, i) => `export const v${i} = 1\n`).join(''))
    const avant = b.head()
    const vu = b.git('commit', '-a', '--cleanup=strip', '-m', 'feat(a): refs #7 — trailers en commentaire',
      '-m', '; JUGE: juge adversarial opus a refuté le lot entier, verdict NON-REFUTE, preuves au ticket',
      '-m', '; REFUTATION: juge adversarial opus a attaqué le diff entier, verdict CONFIRMÉ, preuves au ticket')
    refuse(b, vu, avant, /sans réfutation/)
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

// ── La porte du commit sur un dépôt réel : le VRAI `commit-msg`, appelé comme git l'appelle ───────────

/** Dépôt jetable dont on juge un WORKTREE lié (`.git` fichier), l'arbre où vivent les chantiers.
 *  `depot` se jette. */
function depotDeChantier(params) {
  const { racine: depot } = instanceDeDepot(params)
  const racine = join(depot, '.wt-chantier')
  lancerGit(['worktree', 'add', '-q', '--detach', racine], { cwd: depot })
  return { racine, depot }
}

/** Le verdict du VRAI `commit-msg` (`DRIVER`) sur `message`, lancé à la racine `cwd` (githooks(5)) sous
 *  `env` (une git feinte, `envGitFeint`) : `null` s'il laisse passer, `{ decision: 'deny', reason }` (son
 *  stderr, sans les traces de la feinte, `MARQUE_FEINTE`) s'il refuse. */
function decisionOf(message, cwd, env = process.env) {
  const dossier = mkdtempSync(join(tmpdir(), 'msg-'))
  try {
    const fichier = join(dossier, 'COMMIT_EDITMSG')
    writeFileSync(fichier, `${message}\n`, 'utf8')
    const r = spawnSync(process.execPath, [DRIVER, fichier], { cwd, env: { ...env, GIT_EDITOR: ':' }, encoding: 'utf8' })
    if (r.status === 0) return null
    assert.equal(r.status, 1, `commit-msg a quitté en ${r.status} : ${r.stderr}`)
    return { decision: 'deny', reason: r.stderr.split('\n').filter((l) => !l.startsWith(MARQUE_FEINTE)).join('\n').trim() }
  } finally {
    rmSync(dossier, { recursive: true, force: true })
  }
}

// Le contexte de solde de la porte n'est pas qu'un branchement : « corrigé par <sha> <fichier>:<ligne> »
// se juge contre l'HISTOIRE GIT du répertoire où le commit s'exécute. On monte un dépôt réel, on y
// pose un commit qui touche UN fichier, et on fait citer par le solde un fichier qu'il ne touche pas.
test('commit-msg, dépôt réel : « corrigé par <sha> » est confronté à l\'histoire git RÉELLE du dépôt cible', () => {
  const { racine: repo } = instanceDeDepot({ fichiers: { 'src/touche.ts': 'export const a = 1\n' }, message: 'socle' })
  try {
    const git = gitDe(repo)
    const sha = git('rev-parse', '--short=8', 'HEAD').trim()

    const aujourdhui = new Date()
    const jour = dateLocale(aujourdhui)
    const solde = (site) => [
      'VERIFIE: histoire git du dépôt cible relue commit par commit, fichiers touchés recoupés au numstat.',
      '', '## Restes', `- chemin mort cité -> corrigé par ${sha} ${site}`,
      '', '## Réfutation', 'verdict: CONFIRMÉ',
      'Un juge a rejoué le diff contre le DoD, tenté deux contournements, aucun ne passe sur ce lot.',
      '', `(${jour})`, '',
    ].join('\n')

    mkdirSync(join(repo, '.claude', 'soldes'), { recursive: true })
    const ecrireEtStager = (contenu) => {
      writeFileSync(join(repo, '.claude', 'soldes', '4242.md'), contenu, 'utf8')
      git('add', '--force', '.claude/soldes/4242.md')
    }

    ecrireEtStager(solde('src/jamais-touche.ts:12'))
    const faux = decisionOf('corrige #4242', repo)
    assert.ok(faux, 'aucune décision : le site cité n\'a pas été confronté au commit')
    assert.match(faux.reason, /que ce commit ne touche PAS/)

    ecrireEtStager(solde('src/touche.ts:1'))
    const juste = decisionOf('corrige #4242', repo)
    assert.doesNotMatch(juste?.reason ?? '', /ne touche PAS|ANCÊTRE|SOLDE conforme/, 'site conforme refusé')
  } finally {
    rmSync(repo, { recursive: true, force: true })
  }
})

// Une PANNE de git sur la lecture de la citation n'est pas un « non » : sous `depotAuxPannes`, le patch en
// panne se lisait vide, et le refus disait « ce commit ne touche PAS » — un motif faux (#2294).
test('commit-msg, dépôt réel : une PANNE de git sur « corrigé par <sha> » se NOMME — jamais « ce commit ne touche PAS »', () => {
  const { racine: repo } = instanceDeDepot({ fichiers: { 'src/touche.ts': 'export const a = 1\n' }, message: 'socle' })
  try {
    const git = gitDe(repo)
    const sha = git('rev-parse', '--short=9', 'HEAD').trim()
    const aujourdhui = new Date()
    const jour = dateLocale(aujourdhui)
    mkdirSync(join(repo, '.claude', 'soldes'), { recursive: true })
    writeFileSync(join(repo, '.claude', 'soldes', '4242.md'), [
      'VERIFIE: histoire git du dépôt cible relue commit par commit, fichiers touchés recoupés au numstat.',
      '', '## Restes', `- chemin mort cité -> corrigé par ${sha} src/touche.ts:1`,
      '', '## Réfutation', 'verdict: CONFIRMÉ',
      'Un juge a rejoué le diff contre le DoD, tenté deux contournements, aucun ne passe sur ce lot.',
      '', `(${jour})`, '',
    ].join('\n'), 'utf8')
    git('add', '--force', '.claude/soldes/4242.md')
    const commande = 'corrige #4242'
    assert.doesNotMatch(decisionOf(commande, repo)?.reason ?? '', /ne touche PAS|SOLDE conforme|indisponible/, 'témoin : sans panne, la citation est conforme')
    for (const sousCommande of ['diff-tree', 'rev-list']) {
      const env = { ...process.env, ...envGitFeint([{ si: [sousCommande], status: 128, stderr: `fatal: panne simulée ${sousCommande}\n` }]) }
      const vu = decisionOf(commande, repo, env)
      assert.equal(vu?.decision, 'deny', sousCommande)
      assert.match(vu.reason, new RegExp(`⛔ lecture git indisponible : .*fatal: panne simulée ${sousCommande}`), sousCommande)
      assert.equal(vu.reason.split('lecture git indisponible').length, 2, `${sousCommande} : une panne, UN refus`)
      assert.doesNotMatch(vu.reason, /ne touche PAS/, `${sousCommande} : une panne n'est pas un motif`)
    }
  } finally {
    rmSync(repo, { recursive: true, force: true })
  }
})

// Une base que git ne rend pas (ni HEAD ni l'arbre vide) devenait une révision VIDE passée à git : la
// porte tombait « en panne » et le commit PASSAIT, solde non conforme compris (#2294, C6).
test('commit-msg, dépôt réel : une base ILLISIBLE (`rev-parse` et `hash-object` en panne, ou git absent) est un `deny` NOMMÉ, jamais un passage', () => {
  const { racine: repo } = instanceDeDepot({ fichiers: { 'src/x.ts': 'export const x = 1\n' }, message: 'socle' })
  try {
    mkdirSync(join(repo, '.claude', 'soldes'), { recursive: true })
    writeFileSync(join(repo, '.claude', 'soldes', '1.md'), 'solde non conforme\n', 'utf8')
    gitDe(repo)('add', '-A')
    const commande = 'corrige #1'
    assert.match(decisionOf(commande, repo, process.env)?.reason ?? '', /SOLDE conforme/, 'témoin : sans panne, le solde non conforme est refusé')
    const pannes = {
      'rev-parse et hash-object': [{ si: ['rev-parse'], status: 128, stderr: 'fatal: panne simulée rev-parse\n' }, { si: ['hash-object'], status: 128, stderr: 'fatal: panne simulée hash-object\n' }],
      'git absent': [{ si: [], absent: true }],
    }
    for (const [quoi, regles] of Object.entries(pannes)) {
      const vu = decisionOf(commande, repo, { ...process.env, ...envGitFeint(regles) })
      assert.equal(vu?.decision, 'deny', `${quoi} : ${JSON.stringify(vu)}`)
      assert.match(vu.reason, /⛔ lecture git indisponible : /, quoi)
      assert.match(vu.reason, quoi === 'git absent' ? /git|introuvable|ENOENT/i : /fatal: panne simulée rev-parse/, quoi)
      assert.equal(vu.reason.split('lecture git indisponible').length, 2, `${quoi} : une panne, UN refus`)
    }
  } finally {
    rmSync(repo, { recursive: true, force: true })
  }
})

// Stock nominatif qui grandit : la règle vit dans `scripts/guards/lib/stocksNominatifs.mjs`, mais
// c'est la PORTE qui lui apporte l'index du dépôt cible et le message — ce câblage-là se teste ici.
test('commit-msg, dépôt réel : un stock nominatif qui GRANDIT dans l\'index est refusé, sauf CLIQUET au message', () => {
  const { racine: repo, depot } = depotDeChantier({ fichiers: { 'src/state/exemptions.test.ts': 'export const STOCK = [\n]\n' }, message: 'socle' })
  try {
    const git = gitDe(repo)
    const stock = join(repo, 'src', 'state', 'exemptions.test.ts')

    writeFileSync(stock, ["export const STOCK = [", "  'src/state/combatFlow.ts',", "  'src/ui/RollShell.tsx',", ']', ''].join('\n'), 'utf8')
    git('add', 'src/state/exemptions.test.ts')

    const refus = decisionOf('feat: deux exemptions de plus (refs #1806)', repo)
    assert.ok(refus, 'aucune décision : le stock a grossi sans que rien ne le dise')
    assert.equal(refus.decision, 'deny')
    assert.match(refus.reason, /STOCK NOMINATIF qui NAÎT ou GRANDIT/)
    assert.ok(refus.reason.includes('src/state/exemptions.test.ts : +2'), refus.reason)

    const avecCliquet = decisionOf(
      'feat: deux exemptions de plus (refs #1806)' +
      '\n\nCLIQUET: src/state/exemptions.test.ts +2 — deux sites mesurés ce jour, extinction sous #9999',
      repo,
    )
    assert.doesNotMatch(avecCliquet?.reason ?? '', /STOCK NOMINATIF/, 'un CLIQUET nommé et compté doit passer')
  } finally {
    rmSync(depot, { recursive: true, force: true })
  }
})

// La revue se fait PAR TICKET (décision utilisateur du 2026-10-05, #2365) : aucun cumul de commits
// depuis la dernière archive `revue-palier-*` ne conditionne une fermeture.
test('commit-msg, dépôt réel : 12 commits de substance depuis la dernière archive `revue-palier-*`, sans revue neuve, ne bloquent AUCUNE fermeture', () => {
  const registres = readFileSync(new URL('../hooks/registres-porteurs.json', import.meta.url), 'utf8')
  const { racine: repo, sha: socle } = instanceDeDepot({ fichiers: { 'scripts/a.txt': 'a\n', 'notes/d.md': 'd\n', 'scripts/hooks/registres-porteurs.json': registres }, message: 'socle' })
  try {
    const git = gitDe(repo)
    const aujourdhui = new Date()
    const jour = dateLocale(aujourdhui)
    const revue = `# PALIER (${jour})\n\nverdict: CONFIRMÉ\n${'A'.repeat(90)}\n\n\`0000000..${socle}\`\n`
    mkdirSync(join(repo, '.claude', 'soldes'), { recursive: true })
    writeFileSync(join(repo, '.claude', 'soldes', `revue-palier-${jour}-0000000-${socle}.md`), revue)
    git('add', '-A'); git('commit', '-q', '-m', 'revue')
    for (let i = 0; i < 12; i += 1) {
      writeFileSync(join(repo, 'scripts', `s${i}.txt`), `${i}\n`); git('add', '-A'); git('commit', '-q', '-m', `s${i} (refs #7)`)
    }
    assert.equal(git('rev-list', '--count', `${socle}..HEAD`).trim(), '13', 'témoin : 12 commits de substance après la revue archivée')
    writeFileSync(join(repo, 'notes', 'd.md'), 'd2\n')
    writeFileSync(join(repo, '.claude', 'soldes', '7.md'), [
      'VERIFIE: relu le diff complet, rejoué les tests du périmètre et vérifié le fichier touché à la main.',
      '', '## Restes', 'RAS', '', '## Réfutation', 'verdict: CONFIRMÉ',
      'Un juge a rejoué le diff contre le DoD, tenté deux contournements, aucun ne passe sur ce lot.',
      '', `(${jour})`, '',
    ].join('\n'))
    git('add', '-A')
    const commande = 'docs: d (corrige #7)'
    assert.equal(decisionOf(commande, repo), null, 'la fermeture à solde conforme passe, quel que soit le cumul depuis l’archive')
    git('rm', '-q', '--cached', '.claude/soldes/7.md')
    assert.match(decisionOf(commande, repo)?.reason ?? '', /SOLDE conforme.*#7/, 'témoin : la fermeture se juge sur SON solde')
  } finally {
    rmSync(repo, { recursive: true, force: true })
  }
})

// #1720 — DÉPLACEMENT : `git mv` d'un porteur ne fait grandir aucun stock, et la croissance qui
// accompagne le renommage reste vue, au compte près et sur le NOUVEAU chemin. Deux coutures se
// mesurent ici d'un coup : la lecture des porteurs par les DEUX bouts du renommage, et
// l'appariement des entrées parties d'un porteur disparu.
test('commit-msg, dépôt réel : un `git mv` de porteur ne grandit pas ; renommé PLUS une entrée vaut +1', () => {
  const entrees = ["  'src/state/combatFlow.ts',", "  'src/ui/RollShell.tsx',", "  'src/ui/Tabs.tsx',"]
  const source = (lignes) => `export const STOCK = [\n${lignes.join('\n')}\n]\n`
  const ancien = 'scripts/guards/lib/ancienStock.mjs'
  const nouveau = 'scripts/guards/lib/nouveauStock.mjs'
  for (const [nom, ajout] of [['renommage pur', []], ['renommage + 1 entrée', ["  'src/ui/Band.tsx',"]]]) {
    const { racine: repo, depot } = depotDeChantier({ fichiers: { [ancien]: source(entrees) }, message: 'socle' })
    try {
      const git = gitDe(repo)
      git('mv', ancien, nouveau)
      if (ajout.length) writeFileSync(join(repo, nouveau), source([...entrees, ...ajout]), 'utf8')
      git('add', '-A')
      const vu = decisionOf('refactor: le porteur change de nom (refs #1806)', repo)
      if (ajout.length === 0) {
        assert.doesNotMatch(
          vu?.reason ?? '', /STOCK NOMINATIF/,
          `${nom} : trois entrées déménagent, le stock n'a pas grandi d'une seule`,
        )
      } else {
        assert.match(vu?.reason ?? '', /STOCK NOMINATIF qui NAÎT ou GRANDIT/, `${nom} : la croissance reste vue`)
        assert.match(vu.reason, /nouveauStock\.mjs : \+1 entrée\(s\) nette\(s\)/, `${nom} : compte et chemin`)
        assert.match(vu.reason, /src\/ui\/Band\.tsx/, `${nom} : l'exemple est l'entrée AJOUTÉE`)
      }
    } finally {
      rmSync(depot, { recursive: true, force: true })
    }
  }
})

test('commit-msg, dépôt réel : un porteur SCINDÉ en deux ne grandit pas ; renommé MOINS une entrée non plus', () => {
  const entrees = ["  'src/state/combatFlow.ts',", "  'src/ui/RollShell.tsx',", "  'src/ui/Tabs.tsx',"]
  const source = (lignes) => `export const STOCK = [\n${lignes.join('\n')}\n]\n`
  const ancien = 'scripts/guards/lib/ancienStock.mjs'
  const cas = {
    'scission en deux porteurs neufs': {
      'scripts/guards/lib/gaucheStock.mjs': entrees.slice(0, 2),
      'scripts/guards/lib/droiteStock.mjs': entrees.slice(2),
    },
    // Une DÉCROISSANCE ne se crédite nulle part : elle ne rend aucun droit d'ajouter ailleurs.
    'renommage moins une entrée': { 'scripts/guards/lib/nouveauStock.mjs': entrees.slice(0, 2) },
  }
  for (const [nom, porteurs] of Object.entries(cas)) {
    const { racine: repo } = instanceDeDepot({ fichiers: { [ancien]: source(entrees) }, message: 'socle' })
    try {
      const git = gitDe(repo)
      rmSync(join(repo, ancien))
      for (const [chemin, lignes] of Object.entries(porteurs)) writeFileSync(join(repo, chemin), source(lignes), 'utf8')
      git('add', '-A')
      const vu = decisionOf('refactor: le porteur se redistribue (refs #1806)', repo)
      assert.doesNotMatch(vu?.reason ?? '', /STOCK NOMINATIF/, `${nom} : aucune entrée de plus`)
    } finally {
      rmSync(repo, { recursive: true, force: true })
    }
  }
})

// #1720 — le lot d'un commit de RENOMMAGE est ses DEUX chemins, pour TOUTES les portes de la garde :
// un solde prouve sa correction au NOUVEAU chemin, et un `.tsx` de `src/ui/**` renommé reste un
// ÉCRAN. Le chemin replié `src/ui/{Ancien.tsx => Nouveau.tsx}` du `--numstat`, lui, ne nomme aucun
// fichier : aucune porte ne le cite.
test('commit-msg, dépôt réel : sur un renommage, le lot porte les DEUX chemins (solde au site, écran)', () => {
  const { racine: repo } = instanceDeDepot({
    fichiers: { 'src/ui/Ancien.tsx': 'export const A = 1\n' }, message: 'socle',
  })
  try {
    const git = gitDe(repo)
    git('mv', 'src/ui/Ancien.tsx', 'src/ui/Nouveau.tsx')
    const aujourdhui = new Date()
    const jour = dateLocale(aujourdhui)
    mkdirSync(join(repo, '.claude', 'soldes'), { recursive: true })
    writeFileSync(join(repo, '.claude', 'soldes', '1720.md'), [
      'VERIFIE: histoire git du dépôt cible relue commit par commit, fichiers touchés recoupés au numstat.',
      '', '## Restes', '- le composant changeait de nom -> corrigé dans ce commit src/ui/Nouveau.tsx:1',
      '', '## Réfutation', 'verdict: CONFIRMÉ',
      'Un juge a rejoué le diff contre le DoD, tenté deux contournements, aucun ne passe sur ce lot.',
      '', `(${jour})`, '',
    ].join('\n'), 'utf8')
    git('add', '--force', '-A')

    const vu = decisionOf('refactor: le composant change de nom (corrige #1720)', repo)
    assert.doesNotMatch(
      vu?.reason ?? '', /ABSENT de ce que ce commit emporte/,
      'le site cité est le NOUVEAU chemin : il EST dans le lot',
    )
    assert.doesNotMatch(vu?.reason ?? '', /\{Ancien\.tsx => Nouveau\.tsx\}/, 'aucune porte ne cite un chemin replié')
    // Un `.tsx` de `src/ui/**` renommé reste un ÉCRAN : la preuve visuelle est réclamée.
    assert.match(vu?.reason ?? '', /JUGE-VISION|[Rr]ecette visuelle|capture/, 'la porte d’écran doit voir le renommage')
  } finally {
    rmSync(repo, { recursive: true, force: true })
  }
})

// #1806 D1 — un porteur au chemin NON-ASCII : l'en-tête `+++ b/<chemin>` du patch `-U0` n'a pas de
// `-z`, et git l'y CITE (`core.quotePath`) hors de l'hôte des lectures git (`gitPorte.mjs`).
test('commit-msg, dépôt réel : un stock au chemin NON-ASCII qui grandit est refusé — le patch le nomme en clair', () => {
  const porteur = 'src/ui/Écran.test.ts'
  const { racine: repo, depot } = depotDeChantier({ fichiers: { [porteur]: "export const STOCK = [\n  'src/a.ts',\n]\n" }, message: 'socle' })
  try {
    writeFileSync(join(repo, porteur), "export const STOCK = [\n  'src/a.ts',\n  'src/b.ts',\n]\n", 'utf8')
    lancerGit(['add', '--', porteur], { cwd: repo })
    const refus = decisionOf('feat: une exemption de plus (refs #1806)', repo)
    assert.equal(refus?.decision, 'deny', 'aucune décision : le porteur cité a échappé à la porte')
    assert.ok(refus.reason.includes(`${porteur} : +1`), refus.reason)
  } finally {
    rmSync(depot, { recursive: true, force: true })
  }
})

// Volet ANCÊTRE de la même disposition : un sha qui n'est dans AUCUNE histoire de ce dépôt.
test('commit-msg, dépôt réel : « corrigé par <sha> » dont le commit n\'existe pas dans le dépôt cible → refus', () => {
  const { racine: repo } = instanceDeDepot({ fichiers: { 'src/touche.ts': 'export const a = 1\n' }, message: 'socle' })
  try {
    const git = gitDe(repo)
    const d = new Date()
    const jour = dateLocale(d)
    mkdirSync(join(repo, '.claude', 'soldes'), { recursive: true })
    writeFileSync(join(repo, '.claude', 'soldes', '4243.md'), [
      'VERIFIE: histoire git du dépôt cible relue commit par commit, fichiers touchés recoupés au numstat.',
      '', '## Restes', '- chemin mort cité -> corrigé par deadbeef1 src/touche.ts:1',
      '', '## Réfutation', 'verdict: CONFIRMÉ',
      'Un juge a rejoué le diff contre le DoD, tenté deux contournements, aucun ne passe sur ce lot.',
      '', `(${jour})`, '',
    ].join('\n'), 'utf8')
    git('add', '--force', '.claude/soldes/4243.md')

    const out = decisionOf('corrige #4243', repo)
    assert.ok(out, 'aucune décision : un sha absent de l\'histoire est passé')
    assert.match(out.reason, /n'est pas un ANCÊTRE de HEAD/)
  } finally {
    rmSync(repo, { recursive: true, force: true })
  }
})

// Porte du TICKET (option retenue par l'utilisateur le 2026-09-11) : la garde apporte à la porte le
// lot que le commit EMPORTE. Sur un dépôt réel, un commit de substance sans ticket est refusé, et le
// même geste avec `refs #N` ne l'est plus.
test('commit-msg, dépôt réel : un commit de substance sans ticket est refusé ; avec `refs #N`, il passe', () => {
  const { racine: repo } = instanceDeDepot({ fichiers: { 'src/x.ts': 'export const a = 1\n' }, message: 'socle' })
  try {
    const git = gitDe(repo)
    writeFileSync(join(repo, 'src', 'x.ts'), 'export const a = 2\n', 'utf8')
    git('add', 'src/x.ts')

    const refus = decisionOf('chore: une ligne de rien', repo)
    assert.ok(refus, 'aucune décision : un commit de substance sans ticket est passé')
    assert.equal(refus.decision, 'deny')
    assert.match(refus.reason, /Commit de SUBSTANCE sans ticket/)
    assert.match(refus.reason, /src\/x\.ts/)

    const avec = decisionOf('chore: une ligne de rien (refs #1709)', repo)
    assert.doesNotMatch(avec?.reason ?? '', /SUBSTANCE sans ticket/, 'un commit qui cite son ticket passe la porte')
  } finally {
    rmSync(repo, { recursive: true, force: true })
  }
})

test('commit-msg, dépôt réel : un commit hors src/ et scripts/ passe sans ticket', () => {
  const { racine: repo } = instanceDeDepot({ fichiers: { 'docs/architecture.md': '# carte\n' }, message: 'socle' })
  try {
    const git = gitDe(repo)
    writeFileSync(join(repo, 'docs', 'architecture.md'), '# carte\n\nune ligne de plus\n', 'utf8')
    git('add', 'docs/architecture.md')

    const out = decisionOf('chore(docs): régénéré', repo)
    assert.doesNotMatch(out?.reason ?? '', /SUBSTANCE sans ticket/, 'un commit de docs n’a aucun ticket à citer')
  } finally {
    rmSync(repo, { recursive: true, force: true })
  }
})

// #1806 : une PANNE de lecture du contenu emporté n'est pas « rien n'est emporté ». La feinte ne vise
// que cette lecture (`diff-index --numstat -M`, `ceQuiChange`) : l'ascendance reste lisible, et le
// seul refus est `refusDesPannes`.
test('commit-msg, dépôt réel : une PANNE de lecture du contenu emporté (objet de base CORROMPU, ou `diff-index` en panne) est un `deny` NOMMÉ', () => {
  const { racine: repo } = instanceDeDepot({ fichiers: { 'src/x.ts': 'export const x = 1\n' }, message: 'socle' })
  try {
    const git = gitDe(repo, { net: true })
    writeFileSync(join(repo, 'src', 'x.ts'), 'export const x = 2\nexport const y = 3\n', 'utf8')
    git('add', 'src/x.ts')
    const commande = 'feat(x): y (refs #1806)'
    assert.doesNotMatch(decisionOf(commande, repo)?.reason ?? '', /lecture git indisponible/, 'témoin : git répond, aucune panne')

    const parCale = decisionOf(commande, repo, { ...process.env, ...envGitFeint([{ si: ['diff-index', '--numstat', '-M'], status: 128, stderr: 'fatal: panne simulée\n' }]) })
    assert.equal(parCale?.decision, 'deny')
    assert.match(parCale.reason, /^⛔ lecture git indisponible : refus \(status 128\) — fatal: panne simulée/)
    assert.equal(parCale.reason.split('lecture git indisponible').length, 2, 'une panne, UN refus')

    const blob = git('rev-parse', 'HEAD:src/x.ts')
    const objet = join(repo, '.git', 'objects', blob.slice(0, 2), blob.slice(2))
    chmodSync(objet, 0o644)
    writeFileSync(objet, 'x')
    const corrompu = decisionOf(commande, repo)
    assert.equal(corrompu?.decision, 'deny')
    assert.match(corrompu.reason, /⛔ lecture git indisponible : .*too long/)
  } finally {
    rmSync(repo, { recursive: true, force: true })
  }
})

test('#2285 commit-msg, dépôt réel : diagnostic Git complet dans la décision publique', () => {
  const { racine: repo } = instanceDeDepot({ fichiers: { 'src/x.ts': 'export const x = 1\n' } })
  try {
    const stderr = `${'ligne diagnostique longue\n'.repeat(45)}CAUSE TARDIVE 2285`
    const vu = decisionOf('refs #1806', repo, { ...process.env, ...envGitFeint([{ si: ['diff-index', '--numstat', '-M'], status: 37, stdout: 'stdout distinct 2285', stderr }]) })
    assert.equal(vu?.decision, 'deny')
    assert.ok(vu.reason.includes(`refus (status 37) — ${stderr}\nstdout distinct 2285`), vu.reason)
  } finally { rmSync(repo, { recursive: true, force: true }) }
})

test('commit-msg, dépôt réel : un dépôt SANS premier commit et un commit qui touche `CLAUDE.md` — la base est l’arbre vide, le hook ne tombe pas', () => {
  const { racine: repo } = instanceDeDepot({ fichiers: { 'CLAUDE.md': '# x\n', '.claude/skills/a/SKILL.md': 's\n' }, commit: false })
  try {
    lancerGit(['add', 'CLAUDE.md', '.claude/skills/a/SKILL.md'], { cwd: repo })
    const out = decisionOf('chore: socle', repo)
    assert.doesNotMatch(out?.reason ?? '', /BorneAbsente|lecture git indisponible/)
  } finally {
    rmSync(repo, { recursive: true, force: true })
  }
})
