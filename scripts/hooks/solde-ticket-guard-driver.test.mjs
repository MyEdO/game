// Tests du DRIVER de `solde-ticket-guard` (le bloc `isMain`, non importable : il se teste en
// lançant le script réel avec un payload de hook sur stdin). Lancé par `npm run test:hooks`.
//
// Le driver est la couture où le message de commit est REJOINT à son répertoire d'exécution : un
// message packé dans un fichier (`-F`) doit être lu là où le `git commit` s'exécute, sinon une
// fermeture de ticket devient invisible au contrôle de solde (fail-open mesuré 2026-08-03, #1052).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { spawnSync, execFileSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const GUARD = join(REPO, 'scripts', 'hooks', 'solde-ticket-guard.mjs')

/** Décision rendue par le driver pour un payload `ctx_shell` donné (`null` si le hook se tait). */
function decisionOf(command, cwd) {
  const payload = JSON.stringify({
    session_id: 'test', hook_event_name: 'PreToolUse',
    tool_name: 'mcp__lean-ctx__ctx_shell', tool_input: { command, cwd },
  })
  const run = spawnSync(process.execPath, [GUARD], { input: payload, encoding: 'utf8', cwd: REPO })
  assert.equal(run.status, 0, `le hook a quitté en ${run.status} : ${run.stderr}`)
  if (!run.stdout.trim()) return null
  const { permissionDecision, permissionDecisionReason } = JSON.parse(run.stdout).hookSpecificOutput
  return { decision: permissionDecision, reason: permissionDecisionReason }
}

test('DRIVER : un message -F est lu dans le répertoire où le commit S\'EXÉCUTE (cd/worktree)', () => {
  const base = mkdtempSync(join(tmpdir(), 'solde-guard-'))
  try {
    mkdirSync(join(base, 'wt'))
    // Deux DÉPÔTS réels : hors dépôt, `git diff --cached` bascule en mode `--no-index` et la porte
    // refuse (à juste titre) pour ascendance indisponible — ce qui masquerait ce que ce test mesure.
    for (const d of [base, join(base, 'wt')])
      execFileSync('git', ['init', '-q', '-b', 'main'], { cwd: d, encoding: 'utf8' })
    // Homonyme ANODIN à la racine : c'est lui qu'un driver résolvant contre le cwd de départ
    // lirait — la fermeture portée par le vrai fichier resterait alors invisible.
    writeFileSync(join(base, 'm2.txt'), 'chore: rien a signaler\n', 'utf8')
    writeFileSync(join(base, 'wt', 'm2.txt'), 'feat: bidule (corrige #999999)\n', 'utf8')

    const out = decisionOf('cd wt && git commit -F m2.txt', base)
    assert.ok(out, 'aucune décision : la fermeture #999999 portée par wt/m2.txt est passée inaperçue')
    assert.equal(out.decision, 'deny')
    assert.match(out.reason, /999999|PALIER|Palier/)
  } finally {
    rmSync(base, { recursive: true, force: true })
  }
})

test('DRIVER : un -F introuvable est fail-CLOSED (jamais un silence)', () => {
  const base = mkdtempSync(join(tmpdir(), 'solde-guard-'))
  try {
    const out = decisionOf('git commit -F absent.txt', base)
    assert.ok(out, 'aucune décision sur un -F illisible')
    assert.equal(out.decision, 'deny')
    assert.match(out.reason, /illisible/)
  } finally {
    rmSync(base, { recursive: true, force: true })
  }
})

// Le contexte de solde du driver n'est pas qu'un branchement : « corrigé par <sha> <fichier>:<ligne> »
// se juge contre l'HISTOIRE GIT du répertoire où le commit s'exécute. On monte un dépôt réel, on y
// pose un commit qui touche UN fichier, et on fait citer par le solde un fichier qu'il ne touche pas.
test('DRIVER : « corrigé par <sha> » est confronté à l\'histoire git RÉELLE du dépôt cible', () => {
  const repo = mkdtempSync(join(tmpdir(), 'solde-histoire-'))
  try {
    const git = (...args) => execFileSync('git', args, { cwd: repo, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
    git('init', '-q')
    git('config', 'user.email', 'sonde@test')
    git('config', 'user.name', 'sonde')
    git('config', 'commit.gpgsign', 'false')
    mkdirSync(join(repo, 'src'), { recursive: true })
    writeFileSync(join(repo, 'src', 'touche.ts'), 'export const a = 1\n', 'utf8')
    git('add', 'src/touche.ts')
    git('commit', '-q', '--no-verify', '-m', 'socle')
    const sha = git('rev-parse', '--short=8', 'HEAD').trim()

    const aujourdhui = new Date()
    const jour = `${aujourdhui.getFullYear()}-${String(aujourdhui.getMonth() + 1).padStart(2, '0')}-${String(aujourdhui.getDate()).padStart(2, '0')}`
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
    const faux = decisionOf('git commit -m "corrige #4242"', repo)
    assert.ok(faux, 'aucune décision : le site cité n\'a pas été confronté au commit')
    assert.match(faux.reason, /que ce commit ne touche PAS/)

    ecrireEtStager(solde('src/touche.ts:1'))
    const juste = decisionOf('git commit -m "corrige #4242"', repo)
    // Le dépôt de test est un arbre PRINCIPAL (son .git est un dossier) : le `ask` de worktree est
    // attendu et distinct — ce qui doit disparaître, c'est le refus portant sur le SITE cité.
    assert.doesNotMatch(juste?.reason ?? '', /ne touche PAS|ANCÊTRE|SOLDE conforme/, 'site conforme refusé')
  } finally {
    rmSync(repo, { recursive: true, force: true })
  }
})


/** Registre des stocks d'un dépôt JETABLE : le garde lit celui du dépôt qu'il juge, jamais celui de
 *  ce dépôt-ci. Sans cette déclaration, la porte ne compte RIEN — c'est tout le sujet. */
function declarerStock(repo, fichier, liaison = 'STOCK', forme = 'liste') {
  mkdirSync(join(repo, 'scripts', 'hooks'), { recursive: true })
  writeFileSync(join(repo, 'scripts', 'hooks', 'stocks.json'), `${JSON.stringify({
    _entete: ['registre du dépôt jetable de ce test'],
    entrees: [{ fichier, liaison, forme, role: 'stock', cible: 0, raison: 'porteur de fixture du driver du garde de solde.' }],
  }, null, 2)}
`, 'utf8')
}

// Stock nominatif qui grandit : la règle vit dans `scripts/guards/lib/stocksNominatifs.mjs`, mais
// c'est le DRIVER qui lui apporte l'index du dépôt cible et le message — ce câblage-là se teste ici.
test('DRIVER : un stock nominatif qui GRANDIT dans l\'index est refusé, sauf CLIQUET au message', () => {
  const repo = mkdtempSync(join(tmpdir(), 'solde-stock-'))
  try {
    const git = (...args) => execFileSync('git', args, { cwd: repo, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
    git('init', '-q')
    git('config', 'user.email', 'sonde@test')
    git('config', 'user.name', 'sonde')
    git('config', 'commit.gpgsign', 'false')
    mkdirSync(join(repo, 'src', 'state'), { recursive: true })
    const stock = join(repo, 'src', 'state', 'exemptions.test.ts')
    writeFileSync(stock, 'export const STOCK = [\n]\n', 'utf8')
    declarerStock(repo, 'src/state/exemptions.test.ts')
    git('add', '-A')
    git('commit', '-q', '--no-verify', '-m', 'socle')

    writeFileSync(stock, ["export const STOCK = [", "  'src/state/combatFlow.ts',", "  'src/ui/RollShell.tsx',", ']', ''].join('\n'), 'utf8')
    git('add', 'src/state/exemptions.test.ts')

    const refus = decisionOf('git commit -m "feat: deux exemptions de plus"', repo)
    assert.ok(refus, 'aucune décision : le stock a grossi sans que rien ne le dise')
    assert.equal(refus.decision, 'deny')
    assert.match(refus.reason, /STOCK NOMINATIF qui NAÎT ou GRANDIT/)
    assert.match(refus.reason, /src\/state\/exemptions\.test\.ts#STOCK : \+2/)

    const avecCliquet = decisionOf(
      'git commit -m "feat: deux exemptions de plus' +
      '\n\nCLIQUET: src/state/exemptions.test.ts#STOCK +2 — deux sites mesurés ce jour, extinction sous #9999"',
      repo,
    )
    assert.doesNotMatch(avecCliquet?.reason ?? '', /STOCK NOMINATIF/, 'un CLIQUET nommé et compté doit passer')
  } finally {
    rmSync(repo, { recursive: true, force: true })
  }
})

// Le diff jugé suit la FORME de la commande, pas l'index. `git commit -- <chemins>` et
// `git commit <chemins>` commitent l'ARBRE DE TRAVAIL de ces chemins, `git commit -a` tout le
// modifié suivi : sans `git add`, le garde ne lisait qu'un index VIDE et se taisait. C'est par là
// que la croissance de stock de `429b9a1a2` est passée (cause prouvée par sonde le 2026-09-03).
test('DRIVER : les TROIS formes de commit sont jugées sur ce qu\'elles emportent, sans `git add`', () => {
  const repo = mkdtempSync(join(tmpdir(), 'solde-forme-'))
  try {
    const git = (...args) => execFileSync('git', args, { cwd: repo, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
    git('init', '-q')
    git('config', 'user.email', 'sonde@test')
    git('config', 'user.name', 'sonde')
    git('config', 'commit.gpgsign', 'false')
    mkdirSync(join(repo, 'scripts', 'guards', 'lib'), { recursive: true })
    const chemin = 'scripts/guards/lib/xStock.mjs'
    const stock = join(repo, chemin)
    writeFileSync(stock, 'export const STOCK = [\n]\n', 'utf8')
    declarerStock(repo, chemin)
    git('add', '-A')
    git('commit', '-q', '--no-verify', '-m', 'socle')

    // La croissance vit dans l'ARBRE DE TRAVAIL et NULLE PART dans l'index.
    writeFileSync(stock, ["export const STOCK = [", "  'src/state/combatFlow.ts',", "  'src/ui/RollShell.tsx',", ']', ''].join('\n'), 'utf8')
    assert.equal(git('diff', '--cached', '--numstat').trim(), '', 'l’index doit rester VIDE : c’est tout le sujet')

    for (const forme of [
      `git commit -m "deux exemptions de plus" -- ${chemin}`,
      `git commit -m "deux exemptions de plus" ${chemin}`,
      'git commit -a -m "deux exemptions de plus"',
    ]) {
      const refus = decisionOf(forme, repo)
      assert.ok(refus, `aucune décision pour « ${forme} » : le garde a lu l’index vide`)
      assert.equal(refus.decision, 'deny')
      assert.match(refus.reason, /STOCK NOMINATIF qui NAÎT ou GRANDIT/)
      assert.match(refus.reason, /scripts\/guards\/lib\/xStock\.mjs#STOCK : \+2/)
    }

    // Forme INDEX : rien n'est stagé, donc le commit n'emporte rien — le garde se tait sur les stocks.
    const index = decisionOf('git commit -m "deux exemptions de plus"', repo)
    assert.doesNotMatch(index?.reason ?? '', /STOCK NOMINATIF/, 'un index vide n’emporte aucune croissance')
  } finally {
    rmSync(repo, { recursive: true, force: true })
  }
})

/** Dépôt jetable portant un stock VIDE commité, et de quoi le faire grandir. */
function depotAStock() {
  const repo = mkdtempSync(join(tmpdir(), 'solde-forme-'))
  const git = (...args) => execFileSync('git', args, { cwd: repo, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
  git('init', '-q')
  git('config', 'user.email', 'sonde@test')
  git('config', 'user.name', 'sonde')
  git('config', 'commit.gpgsign', 'false')
  mkdirSync(join(repo, 'scripts', 'guards', 'lib'), { recursive: true })
  const chemin = 'scripts/guards/lib/xStock.mjs'
  const vide = 'export const STOCK = [\n]\n'
  const plein = ["export const STOCK = [", "  'src/state/combatFlow.ts',", "  'src/ui/RollShell.tsx',", ']', ''].join('\n')
  writeFileSync(join(repo, chemin), vide, 'utf8')
  declarerStock(repo, chemin)
  git('add', '-A')
  git('commit', '-q', '--no-verify', '-m', 'socle')
  return { repo, git, chemin, vide, plein }
}

// Un dépôt qui PORTE la porte de stock mais PAS son registre : la porte serait AVEUGLE sur tous les
// stocks. Elle le DIT (worktree non rebasé, `git checkout` partiel), au lieu de compter zéro.
test('DRIVER : la porte de stock SANS son registre est un ARRÊT nommé, jamais un silence', () => {
  const { repo, chemin, plein } = depotAStock()
  try {
    writeFileSync(join(repo, chemin), plein, 'utf8')
    // Le dépôt porte déjà `scripts/guards/lib/xStock.mjs` ; on lui pose la LIB de la porte, et on
    // lui RETIRE son registre — exactement l'état d'un worktree qui n'a pas rebasé le train.
    writeFileSync(join(repo, 'scripts', 'guards', 'lib', 'stocksNominatifs.mjs'), '// la porte\n', 'utf8')
    rmSync(join(repo, 'scripts', 'hooks', 'stocks.json'))
    const refus = decisionOf('git commit -m "deux exemptions de plus"', repo)
    assert.ok(refus, 'aucune décision : la porte s’est taue sur un registre MANQUANT')
    assert.match(refus.reason, /porte la porte de stock .* mais PAS son registre/s)
  } finally {
    rmSync(repo, { recursive: true, force: true })
  }
})

// Un dépôt ÉTRANGER (ni la lib de la porte, ni le registre) : la règle de stock ne s'y applique pas.
test('DRIVER : un dépôt ÉTRANGER — ni porte ni registre — ne déclare aucun stock, et rien ne rougit', () => {
  const { repo, chemin, plein } = depotAStock()
  try {
    writeFileSync(join(repo, chemin), plein, 'utf8')
    rmSync(join(repo, 'scripts', 'hooks', 'stocks.json'))
    const vu = decisionOf('git commit -m "deux exemptions de plus"', repo)
    assert.doesNotMatch(vu?.reason ?? '', /STOCK NOMINATIF|registre/, 'un dépôt étranger n’est pas jugé')
  } finally {
    rmSync(repo, { recursive: true, force: true })
  }
})

// Un pathspec à JOKER : `extractCommitPathspecs` ne le résout pas, mais git, lui, commite l'ARBRE DE
// TRAVAIL de ce qu'il désigne. Le prendre pour « aucun chemin » faisait lire l'INDEX — vide — et la
// croissance partait en silence (sonde 2026-09-04, le commit l'emporte réellement).
test('DRIVER : un pathspec à JOKER ne rend pas le garde MUET', () => {
  const { repo, chemin, plein } = depotAStock()
  try {
    writeFileSync(join(repo, chemin), plein, 'utf8')
    const refus = decisionOf(`git commit -m "deux de plus" -- 'scripts/guards/lib/*.mjs'`, repo)
    assert.ok(refus, 'aucune décision : le joker a fait lire l’index vide')
    assert.equal(refus.decision, 'deny')
    assert.match(refus.reason, /STOCK NOMINATIF qui NAÎT ou GRANDIT/)
  } finally {
    rmSync(repo, { recursive: true, force: true })
  }
})

// `-m"ajoute…"` : la valeur GLUÉE du flag court contient un `a`, et la lecture des options la prenait
// pour un `-a` — le commit passait alors pour un `commit -a` et l'index STAGÉ n'était plus lu.
test('DRIVER : `-m"ajoute…"` collé ne se lit pas comme un `-a` — l\'index stagé reste jugé', () => {
  const { repo, git, chemin, vide, plein } = depotAStock()
  try {
    writeFileSync(join(repo, chemin), plein, 'utf8')
    git('add', chemin)
    writeFileSync(join(repo, chemin), vide, 'utf8') // arbre revenu en arrière : seul l'index porte la croissance
    assert.equal(git('diff', 'HEAD', '--numstat').trim(), '', 'le suivi non stagé doit être VIDE : c’est le sujet')
    for (const cmd of ['git commit -m"ajoute deux entrees"', 'git commit -m "ajoute deux entrees"']) {
      const refus = decisionOf(cmd, repo)
      assert.ok(refus, `aucune décision pour ${cmd}`)
      assert.match(refus.reason, /STOCK NOMINATIF qui NAÎT ou GRANDIT/, `${cmd} : l’index n’a pas été lu`)
    }
  } finally {
    rmSync(repo, { recursive: true, force: true })
  }
})

// Le SOLDE lu doit être celui que le commit EMPORTE : sous un commit par pathspec, un solde stagé
// hors pathspec ne part PAS (git y prend HEAD). Lire l'index validait une preuve absente du commit.
test('DRIVER : un solde stagé HORS pathspec ne vaut pas preuve — le refus dit pourquoi', () => {
  const repo = mkdtempSync(join(tmpdir(), 'solde-emporte-'))
  try {
    const git = (...args) => execFileSync('git', args, { cwd: repo, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
    git('init', '-q')
    git('config', 'user.email', 'sonde@test')
    git('config', 'user.name', 'sonde')
    git('config', 'commit.gpgsign', 'false')
    mkdirSync(join(repo, '.claude', 'soldes'), { recursive: true })
    mkdirSync(join(repo, 'src'), { recursive: true })
    writeFileSync(join(repo, 'src', 'x.ts'), 'export const a = 1\n', 'utf8')
    git('add', '-A')
    git('commit', '-q', '--no-verify', '-m', 'socle')
    writeFileSync(
      join(repo, '.claude', 'soldes', '4242.md'),
      ['# solde #4242', 'VERIFIE: la sonde a rejoué le geste et lu la sortie du garde de bout en bout',
        '## Restes', 'RAS', '## Réfutation', 'verdict: CONFIRMÉ',
        'la sonde a attaqué le diff et le DoD sans trouver de contre-exemple ce jour', '2026-09-04', ''].join('\n'),
      'utf8',
    )
    writeFileSync(join(repo, 'src', 'x.ts'), 'export const a = 2\n', 'utf8')
    git('add', '.claude/soldes/4242.md')

    const refus = decisionOf('git commit -m "feat: x (corrige #4242)" -- src/x.ts', repo)
    assert.ok(refus, 'le solde n’est pas dans le commit : le garde devait parler')
    assert.equal(refus.decision, 'deny')
    assert.match(refus.reason, /NON EMPORTÉ par ce commit/)
    assert.match(refus.reason, /pathspec n'emporte QUE ces chemins/)

    // Le MÊME solde, dans le pathspec : il part, et le garde ne bloque plus sur son absence.
    const avec = decisionOf('git commit -m "feat: x (corrige #4242)" -- src/x.ts .claude/soldes', repo)
    assert.doesNotMatch(avec?.reason ?? '', /NON EMPORTÉ/, 'un solde emporté ne se refuse pas')
  } finally {
    rmSync(repo, { recursive: true, force: true })
  }
})

// Volet ANCÊTRE de la même disposition : un sha qui n'est dans AUCUNE histoire de ce dépôt.
test('DRIVER : « corrigé par <sha> » dont le commit n\'existe pas dans le dépôt cible → refus', () => {
  const repo = mkdtempSync(join(tmpdir(), 'solde-ancetre-'))
  try {
    const git = (...args) => execFileSync('git', args, { cwd: repo, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
    git('init', '-q')
    git('config', 'user.email', 'sonde@test')
    git('config', 'user.name', 'sonde')
    git('config', 'commit.gpgsign', 'false')
    mkdirSync(join(repo, 'src'), { recursive: true })
    writeFileSync(join(repo, 'src', 'touche.ts'), 'export const a = 1\n', 'utf8')
    git('add', 'src/touche.ts')
    git('commit', '-q', '--no-verify', '-m', 'socle')

    const d = new Date()
    const jour = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    mkdirSync(join(repo, '.claude', 'soldes'), { recursive: true })
    writeFileSync(join(repo, '.claude', 'soldes', '4243.md'), [
      'VERIFIE: histoire git du dépôt cible relue commit par commit, fichiers touchés recoupés au numstat.',
      '', '## Restes', '- chemin mort cité -> corrigé par deadbeef1 src/touche.ts:1',
      '', '## Réfutation', 'verdict: CONFIRMÉ',
      'Un juge a rejoué le diff contre le DoD, tenté deux contournements, aucun ne passe sur ce lot.',
      '', `(${jour})`, '',
    ].join('\n'), 'utf8')
    git('add', '--force', '.claude/soldes/4243.md')

    const out = decisionOf('git commit -m "corrige #4243"', repo)
    assert.ok(out, 'aucune décision : un sha absent de l\'histoire est passé')
    assert.match(out.reason, /n'est pas un ANCÊTRE de HEAD/)
  } finally {
    rmSync(repo, { recursive: true, force: true })
  }
})
