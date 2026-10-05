// Tests de bout en bout de la garde `solde-ticket-guard` : le point d'entrée réel
// (`scripts/hooks/solde-ticket-hook.mjs`) lancé avec un payload de hook sur stdin. Lancé par `npm run test:hooks`.
//
// La garde est la couture où le message de commit est REJOINT à son répertoire d'exécution : un
// message packé dans un fichier (`-F`) doit être lu là où le `git commit` s'exécute, sinon une
// fermeture de ticket devient invisible au contrôle de solde (fail-open mesuré 2026-08-03, #1052).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { chmodSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { envGitFeint, instanceDeDepot } from '../guards/lib/depotGabarit.mjs'
import { lancerHook } from '../guards/lib/lancerHook.mjs'
import { gitDe, lancerGit } from '../test/gitDeBanc.mjs'


/** Dépôt jetable dont on juge un WORKTREE lié (`.git` fichier), l'arbre où vivent les chantiers.
 *  `depot` se jette. */
function depotDeChantier(params) {
  const { racine: depot } = instanceDeDepot(params)
  const racine = join(depot, '.wt-chantier')
  lancerGit(['worktree', 'add', '-q', '--detach', racine], { cwd: depot })
  return { racine, depot }
}

/** Décision rendue par le point d'entrée réel de la porte pour un payload `ctx_shell` donné (`null`
 *  si le hook se tait) ; `Bash` sous `outil: 'Bash'`, jugé au `cwd` de l'entrée de hook — le canal d'un
 *  répertoire HORS de tout arbre, où un `cwd` de `ctx_shell` n'est pas jugeable (#2224). */
function decisionOf(command, cwd, env = process.env, { outil = 'ctx_shell' } = {}) {
  const payload = JSON.stringify(outil === 'Bash'
    ? { session_id: 'test', hook_event_name: 'PreToolUse', cwd, tool_name: 'Bash', tool_input: { command } }
    : { session_id: 'test', hook_event_name: 'PreToolUse', cwd, tool_name: 'mcp__lean-ctx__ctx_shell', tool_input: { command, cwd } })
  const run = lancerHook('solde-ticket-hook.mjs', payload, { env })
  assert.equal(run.code, 0, `le hook a quitté en ${run.code} : ${run.err}`)
  if (!run.specifique) return null
  const { permissionDecision, permissionDecisionReason } = run.specifique
  return { decision: permissionDecision, reason: permissionDecisionReason }
}

test('DRIVER : un message -F est lu dans le répertoire où le commit S\'EXÉCUTE (cd/worktree)', () => {
  const base = mkdtempSync(join(tmpdir(), 'solde-guard-'))
  try {
    mkdirSync(join(base, 'wt'))
    // Deux DÉPÔTS réels : hors dépôt, `git diff --cached` bascule en mode `--no-index` et la porte
    // refuse (à juste titre) pour une lecture git indisponible — ce qui masquerait ce que ce test mesure.
    for (const d of [base, join(base, 'wt')])
      lancerGit(['init', '-q', '-b', 'main'], { cwd: d })
    // Homonyme ANODIN à la racine : c'est lui qu'une garde résolvant contre le cwd de départ
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

// #1729 sonde 3 : une commande de LECTURE lancée dans un répertoire hors dépôt se faisait refuser
// par l'ascendance d'un commit qu'elle ne portait pas. Le garde ne lit rien hors de ses gestes ; et
// quand il juge, il nomme la cause VRAIE.
test('DRIVER : hors des gestes jugés, silence même hors dépôt ; un commit hors dépôt nomme « hors dépôt »', () => {
  const base = mkdtempSync(join(tmpdir(), 'hors-depot-'))
  try {
    const bash = { outil: 'Bash' }
    assert.equal(decisionOf('ls -la', base, process.env, bash), null, 'une commande de lecture n’a rien à faire juger')
    assert.equal(decisionOf('wc -c note.md', base, process.env, bash), null)
    const out = decisionOf('git commit -m "fix(x): refs #1729"', base, process.env, bash)
    assert.ok(out, 'un commit, lui, se juge — et git n’a rien pu lire ici')
    assert.equal(out.decision, 'deny')
    assert.match(out.reason, /hors dépôt/)
  } finally {
    rmSync(base, { recursive: true, force: true })
  }
})

// #2125, sonde E4 du juge : payload `Bash`, le hook lui-même lancé HORS dépôt (`tmpdir()`).
test('DRIVER : Bash lancé hors dépôt — `mv` et `git diff --cached` se taisent, un vrai commit nomme « hors dépôt »', () => {
  const hors = tmpdir()
  const decisionBash = (command) => {
    const run = lancerHook('solde-ticket-hook.mjs', {
      session_id: 'test', hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command }, cwd: hors,
    }, { cwd: hors })
    assert.equal(run.code, 0, `le hook a quitté en ${run.code} : ${run.err}`)
    return run.specifique ?? null
  }
  assert.equal(decisionBash('mv a.txt b.txt'), null, 'un déplacement de fichier n’a rien à faire juger')
  assert.equal(decisionBash('git diff --cached --stat'), null, 'une lecture git n’a rien à faire juger')
  const out = decisionBash('git commit -m "fix(x): closes #999999"')
  assert.ok(out, 'un commit, lui, se juge — et git n’a rien pu lire ici')
  assert.equal(out.permissionDecision, 'deny')
  assert.match(out.permissionDecisionReason, /lecture git indisponible : hors dépôt/)
})

test('DRIVER : un -F introuvable est fail-CLOSED (jamais un silence)', () => {
  const base = mkdtempSync(join(tmpdir(), 'solde-guard-'))
  try {
    const out = decisionOf('git commit -F absent.txt', base, process.env, { outil: 'Bash' })
    assert.ok(out, 'aucune décision sur un -F illisible')
    assert.equal(out.decision, 'deny')
    assert.match(out.reason, /illisible/)
  } finally {
    rmSync(base, { recursive: true, force: true })
  }
})

// HÔTE UNIQUE de sortie (#1729) : le refus `-F illisible` a résolu le fichier contre le cwd de
// SESSION parce que la cible nommée a été écartée — il doit le DIRE comme tous les autres refus.
test('DRIVER : tout refus porte la cible écartée, le `-F illisible` compris', () => {
  const base = mkdtempSync(join(tmpdir(), 'solde-guard-'))
  try {
    const out = decisionOf('cd .wt-jamais-cree && git commit -F absent.txt', base, process.env, { outil: 'Bash' })
    assert.ok(out, 'aucune décision sur un -F illisible')
    assert.equal(out.decision, 'deny')
    assert.match(out.reason, /illisible/)
    assert.match(out.reason, /n'a pas servi de répertoire cible/)
    assert.match(out.reason, /\.wt-jamais-cree/)
  } finally {
    rmSync(base, { recursive: true, force: true })
  }
})

// Le contexte de solde de la garde n'est pas qu'un branchement : « corrigé par <sha> <fichier>:<ligne> »
// se juge contre l'HISTOIRE GIT du répertoire où le commit s'exécute. On monte un dépôt réel, on y
// pose un commit qui touche UN fichier, et on fait citer par le solde un fichier qu'il ne touche pas.
test('DRIVER : « corrigé par <sha> » est confronté à l\'histoire git RÉELLE du dépôt cible', () => {
  const { racine: repo } = instanceDeDepot({ fichiers: { 'src/touche.ts': 'export const a = 1\n' }, message: 'socle' })
  try {
    const git = gitDe(repo)
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
    assert.doesNotMatch(juste?.reason ?? '', /ne touche PAS|ANCÊTRE|SOLDE conforme/, 'site conforme refusé')
  } finally {
    rmSync(repo, { recursive: true, force: true })
  }
})

// Une PANNE de git sur la lecture de la citation n'est pas un « non » : sous `depotDuHook`, le patch en
// panne se lisait vide, et le refus disait « ce commit ne touche PAS » — un motif faux (#2294).
test('DRIVER : une PANNE de git sur « corrigé par <sha> » se NOMME — jamais « ce commit ne touche PAS »', () => {
  const { racine: repo } = instanceDeDepot({ fichiers: { 'src/touche.ts': 'export const a = 1\n' }, message: 'socle' })
  try {
    const git = gitDe(repo)
    const sha = git('rev-parse', '--short=9', 'HEAD').trim()
    const aujourdhui = new Date()
    const jour = `${aujourdhui.getFullYear()}-${String(aujourdhui.getMonth() + 1).padStart(2, '0')}-${String(aujourdhui.getDate()).padStart(2, '0')}`
    mkdirSync(join(repo, '.claude', 'soldes'), { recursive: true })
    writeFileSync(join(repo, '.claude', 'soldes', '4242.md'), [
      'VERIFIE: histoire git du dépôt cible relue commit par commit, fichiers touchés recoupés au numstat.',
      '', '## Restes', `- chemin mort cité -> corrigé par ${sha} src/touche.ts:1`,
      '', '## Réfutation', 'verdict: CONFIRMÉ',
      'Un juge a rejoué le diff contre le DoD, tenté deux contournements, aucun ne passe sur ce lot.',
      '', `(${jour})`, '',
    ].join('\n'), 'utf8')
    git('add', '--force', '.claude/soldes/4242.md')
    const commande = 'git commit -m "corrige #4242"'
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
// garde tombait « en panne » et le commit PASSAIT, solde non conforme compris (#2294, C6).
test('DRIVER : une base ILLISIBLE (`rev-parse` et `hash-object` en panne, ou git absent) est un `deny` NOMMÉ, jamais un passage', () => {
  const { racine: repo } = instanceDeDepot({ fichiers: { 'src/x.ts': 'export const x = 1\n' }, message: 'socle' })
  try {
    mkdirSync(join(repo, '.claude', 'soldes'), { recursive: true })
    writeFileSync(join(repo, '.claude', 'soldes', '1.md'), 'solde non conforme\n', 'utf8')
    gitDe(repo)('add', '-A')
    const commande = 'git commit -m "corrige #1"'
    assert.match(decisionOf(commande, repo, process.env, { outil: 'Bash' })?.reason ?? '', /SOLDE conforme/, 'témoin : sans panne, le solde non conforme est refusé')
    const pannes = {
      'rev-parse et hash-object': [{ si: ['rev-parse'], status: 128, stderr: 'fatal: panne simulée rev-parse\n' }, { si: ['hash-object'], status: 128, stderr: 'fatal: panne simulée hash-object\n' }],
      'git absent': [{ si: [], absent: true }],
    }
    for (const [quoi, regles] of Object.entries(pannes)) {
      const vu = decisionOf(commande, repo, { ...process.env, ...envGitFeint(regles) }, { outil: 'Bash' })
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
// c'est la GARDE qui lui apporte l'index du dépôt cible et le message — ce câblage-là se teste ici.
test('DRIVER : un stock nominatif qui GRANDIT dans l\'index est refusé, sauf CLIQUET au message', () => {
  const { racine: repo, depot } = depotDeChantier({ fichiers: { 'src/state/exemptions.test.ts': 'export const STOCK = [\n]\n' }, message: 'socle' })
  try {
    const git = gitDe(repo)
    const stock = join(repo, 'src', 'state', 'exemptions.test.ts')

    writeFileSync(stock, ["export const STOCK = [", "  'src/state/combatFlow.ts',", "  'src/ui/RollShell.tsx',", ']', ''].join('\n'), 'utf8')
    git('add', 'src/state/exemptions.test.ts')

    const refus = decisionOf('git commit -m "feat: deux exemptions de plus (refs #1806)"', repo)
    assert.ok(refus, 'aucune décision : le stock a grossi sans que rien ne le dise')
    assert.equal(refus.decision, 'deny')
    assert.match(refus.reason, /STOCK NOMINATIF qui NAÎT ou GRANDIT/)
    assert.ok(refus.reason.includes('src/state/exemptions.test.ts : +2'), refus.reason)

    const avecCliquet = decisionOf(
      'git commit -m "feat: deux exemptions de plus (refs #1806)' +
      '\n\nCLIQUET: src/state/exemptions.test.ts +2 — deux sites mesurés ce jour, extinction sous #9999"',
      repo,
    )
    assert.doesNotMatch(avecCliquet?.reason ?? '', /STOCK NOMINATIF/, 'un CLIQUET nommé et compté doit passer')
  } finally {
    rmSync(depot, { recursive: true, force: true })
  }
})

// Le palier compte le commit en cours par ce qu'il EMPORTE : la GARDE lui passe la liste de la porte
// du ticket (`revuePalier.mjs`, `DOSSIERS_DE_SUBSTANCE`).
test('DRIVER : le palier compte le commit en cours par ce qu’il emporte -- `-a` non indexé le franchit, `-- <note>` non', () => {
  const { racine: repo, sha: socle } = instanceDeDepot({ fichiers: { 'scripts/a.txt': 'a\n', 'notes/d.md': 'd\n' }, message: 'socle' })
  try {
    const git = gitDe(repo)
    const revue = `# PALIER (2026-09-24)\n\nverdict: CONFIRMÉ\n${'A'.repeat(90)}\n\n\`0000000..${socle}\`\n`
    mkdirSync(join(repo, '.claude', 'soldes'), { recursive: true })
    writeFileSync(join(repo, '.claude', 'soldes', `revue-palier-2026-09-24-0000000-${socle}.md`), revue)
    git('add', '-A'); git('commit', '-q', '-m', 'revue')
    for (let i = 0; i < 9; i += 1) {
      writeFileSync(join(repo, 'scripts', `s${i}.txt`), `${i}\n`); git('add', '-A'); git('commit', '-q', '-m', `s${i}`)
    }
    writeFileSync(join(repo, 'scripts', 'a.txt'), 'a modifié\n')
    const tout = decisionOf('git commit -a -m "feat: x (corrige #7)"', repo)
    assert.match(tout?.reason ?? '', /Palier atteint : au moins 10 commits de substance/, '9 publiés + le -a qui emporte scripts/a.txt')

    writeFileSync(join(repo, 'scripts', 'a.txt'), 'a\n')
    writeFileSync(join(repo, 'scripts', 'indexe.txt'), 'i\n'); git('add', 'scripts/indexe.txt')
    writeFileSync(join(repo, 'notes', 'd.md'), 'd2\n')
    const parChemin = decisionOf('git commit -m "notes (corrige #7)" -- notes/d.md', repo)
    assert.ok(parChemin, 'la fermeture sans solde se refuse')
    assert.doesNotMatch(parChemin.reason, /Palier atteint/, 'le src indexé hors pathspec ne part pas : 9 au palier')
  } finally {
    rmSync(repo, { recursive: true, force: true })
  }
})

// COÛT (en-tête de `solde-ticket-guard.mjs`) : un refus que le pre-push ne rejuge pas sort à l'étage 1,
// sans payer l'étage 2 — celui qu'un `timeout` peut couper.
test('DRIVER : un refus d’étage 1 sort SANS jouer l’étage 2 (stocks, reclassements)', () => {
  const { racine: repo } = instanceDeDepot({ fichiers: { 'src/state/exemptions.test.ts': 'export const STOCK = [\n]\n' }, message: 'socle' })
  try {
    writeFileSync(join(repo, 'src', 'state', 'exemptions.test.ts'), "export const STOCK = [\n  'src/a.ts',\n]\n", 'utf8')
    lancerGit(['add', '-A'], { cwd: repo })
    const refus = decisionOf('git commit -m "feat: une exemption de plus"', repo)
    assert.equal(refus?.decision, 'deny', 'le refus d’étage 1 doit sortir')
    assert.match(refus.reason, /Commit de SUBSTANCE sans ticket/)
    assert.doesNotMatch(refus.reason, /STOCK NOMINATIF/, 'l’étage 2 a été joué après un refus d’étage 1')
  } finally {
    rmSync(repo, { recursive: true, force: true })
  }
})

// #1720 — DÉPLACEMENT : `git mv` d'un porteur ne fait grandir aucun stock, et la croissance qui
// accompagne le renommage reste vue, au compte près et sur le NOUVEAU chemin. Deux coutures se
// mesurent ici d'un coup : la lecture des porteurs par les DEUX bouts du renommage, et
// l'appariement des entrées parties d'un porteur disparu.
test('DRIVER : un `git mv` de porteur ne grandit pas ; renommé PLUS une entrée vaut +1', () => {
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
      const vu = decisionOf('git commit -m "refactor: le porteur change de nom (refs #1806)"', repo)
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

test('DRIVER : un porteur SCINDÉ en deux ne grandit pas ; renommé MOINS une entrée non plus', () => {
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
      const vu = decisionOf('git commit -m "refactor: le porteur se redistribue"', repo)
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
test('DRIVER : sur un renommage, le lot porte les DEUX chemins (solde au site, écran)', () => {
  const { racine: repo } = instanceDeDepot({
    fichiers: { 'src/ui/Ancien.tsx': 'export const A = 1\n' }, message: 'socle',
  })
  try {
    const git = gitDe(repo)
    git('mv', 'src/ui/Ancien.tsx', 'src/ui/Nouveau.tsx')
    const aujourdhui = new Date()
    const jour = `${aujourdhui.getFullYear()}-${String(aujourdhui.getMonth() + 1).padStart(2, '0')}-${String(aujourdhui.getDate()).padStart(2, '0')}`
    mkdirSync(join(repo, '.claude', 'soldes'), { recursive: true })
    writeFileSync(join(repo, '.claude', 'soldes', '1720.md'), [
      'VERIFIE: histoire git du dépôt cible relue commit par commit, fichiers touchés recoupés au numstat.',
      '', '## Restes', '- le composant changeait de nom -> corrigé dans ce commit src/ui/Nouveau.tsx:1',
      '', '## Réfutation', 'verdict: CONFIRMÉ',
      'Un juge a rejoué le diff contre le DoD, tenté deux contournements, aucun ne passe sur ce lot.',
      '', `(${jour})`, '',
    ].join('\n'), 'utf8')
    git('add', '--force', '-A')

    const vu = decisionOf('git commit -m "refactor: le composant change de nom (corrige #1720)"', repo)
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

// Le diff jugé suit la FORME de la commande, pas l'index. `git commit -- <chemins>` et
// `git commit <chemins>` commitent l'ARBRE DE TRAVAIL de ces chemins, `git commit -a` tout le
// modifié suivi : sans `git add`, le garde ne lisait qu'un index VIDE et se taisait. C'est par là
// que la croissance de stock de `429b9a1a2` est passée (cause prouvée par sonde le 2026-09-03).
test('DRIVER : les TROIS formes de commit sont jugées sur ce qu\'elles emportent, sans `git add`', () => {
  const chemin = 'scripts/guards/lib/xStock.mjs'
  const { racine: repo, depot } = depotDeChantier({ fichiers: { [chemin]: 'export const STOCK = [\n]\n' }, message: 'socle' })
  try {
    const git = gitDe(repo)
    const stock = join(repo, chemin)

    // La croissance vit dans l'ARBRE DE TRAVAIL et NULLE PART dans l'index.
    writeFileSync(stock, ["export const STOCK = [", "  'src/state/combatFlow.ts',", "  'src/ui/RollShell.tsx',", ']', ''].join('\n'), 'utf8')
    assert.equal(git('diff', '--cached', '--numstat').trim(), '', 'l’index doit rester VIDE : c’est tout le sujet')

    for (const forme of [
      `git commit -m "deux exemptions de plus (refs #1806)" -- ${chemin}`,
      `git commit -m "deux exemptions de plus (refs #1806)" ${chemin}`,
      'git commit -a -m "deux exemptions de plus (refs #1806)"',
    ]) {
      const refus = decisionOf(forme, repo)
      assert.ok(refus, `aucune décision pour « ${forme} » : le garde a lu l’index vide`)
      assert.equal(refus.decision, 'deny')
      assert.match(refus.reason, /STOCK NOMINATIF qui NAÎT ou GRANDIT/)
      assert.match(refus.reason, /scripts\/guards\/lib\/xStock\.mjs : \+2/)
    }

    // Forme INDEX : rien n'est stagé, donc le commit n'emporte rien — le garde se tait sur les stocks.
    const index = decisionOf('git commit -m "deux exemptions de plus (refs #1806)"', repo)
    assert.doesNotMatch(index?.reason ?? '', /STOCK NOMINATIF/, 'un index vide n’emporte aucune croissance')
  } finally {
    rmSync(depot, { recursive: true, force: true })
  }
})

// #1806 D1 — un porteur au chemin NON-ASCII : l'en-tête `+++ b/<chemin>` du patch `-U0` n'a pas de
// `-z`, et git l'y CITE (`core.quotePath`) hors de l'hôte des lectures git (`gitPorte.mjs`).
test('DRIVER : un stock au chemin NON-ASCII qui grandit est refusé — le patch le nomme en clair', () => {
  const porteur = 'src/ui/Écran.test.ts'
  const { racine: repo, depot } = depotDeChantier({ fichiers: { [porteur]: "export const STOCK = [\n  'src/a.ts',\n]\n" }, message: 'socle' })
  try {
    writeFileSync(join(repo, porteur), "export const STOCK = [\n  'src/a.ts',\n  'src/b.ts',\n]\n", 'utf8')
    lancerGit(['add', '--', porteur], { cwd: repo })
    const refus = decisionOf('git commit -m "feat: une exemption de plus (refs #1806)"', repo)
    assert.equal(refus?.decision, 'deny', 'aucune décision : le porteur cité a échappé à la porte')
    assert.ok(refus.reason.includes(`${porteur} : +1`), refus.reason)
  } finally {
    rmSync(depot, { recursive: true, force: true })
  }
})

/** Dépôt jetable portant un stock VIDE commité, et de quoi le faire grandir. */
function depotAStock() {
  const chemin = 'scripts/guards/lib/xStock.mjs'
  const vide = 'export const STOCK = [\n]\n'
  const plein = ["export const STOCK = [", "  'src/state/combatFlow.ts',", "  'src/ui/RollShell.tsx',", ']', ''].join('\n')
  const { racine: repo, depot } = depotDeChantier({ fichiers: { [chemin]: vide }, message: 'socle' })
  const git = gitDe(repo)
  return { repo, depot, git, chemin, vide, plein }
}

// Un pathspec à JOKER : `extractCommitPathspecs` ne le résout pas, mais git, lui, commite l'ARBRE DE
// TRAVAIL de ce qu'il désigne. Le prendre pour « aucun chemin » faisait lire l'INDEX — vide — et la
// croissance partait en silence (sonde 2026-09-04, le commit l'emporte réellement).
test('DRIVER : un pathspec à JOKER ne rend pas le garde MUET', () => {
  const { repo, depot, chemin, plein } = depotAStock()
  try {
    writeFileSync(join(repo, chemin), plein, 'utf8')
    const refus = decisionOf(`git commit -m "deux de plus (refs #1806)" -- 'scripts/guards/lib/*.mjs'`, repo)
    assert.ok(refus, 'aucune décision : le joker a fait lire l’index vide')
    assert.equal(refus.decision, 'deny')
    assert.match(refus.reason, /STOCK NOMINATIF qui NAÎT ou GRANDIT/)
  } finally {
    rmSync(depot, { recursive: true, force: true })
  }
})

// Un pathspec par SUBSTITUTION : git commite l'arbre de travail de ce que le shell rend, la garde n'en
// voit que les fragments. Pris pour des chemins résolus, ils bornaient le diff à rien, et `JUGE:` se
// taisait sur un `src/` de plusieurs centaines de lignes (revue de palier du 2026-09-27, #1801).
test('DRIVER : un pathspec par SUBSTITUTION ne rend pas la porte du juge MUETTE', () => {
  const chemin = 'src/state/xFlux.ts'
  const { racine: repo } = instanceDeDepot({ fichiers: { [chemin]: 'export const X = 0\n' }, message: 'socle' })
  try {
    const lignes = Array.from({ length: 12 }, (_, i) => `export const X${i} = ${i}`)
    writeFileSync(join(repo, chemin), lignes.join('\n') + '\n', 'utf8')
    writeFileSync(join(repo, 'liste.txt'), `${chemin}\n`, 'utf8')
    writeFileSync(join(repo, 'msg.txt'), 'feat(flux): refs #7 — douze exports\n', 'utf8')
    const refus = decisionOf('git commit -F msg.txt -- $(cat liste.txt)', repo)
    assert.ok(refus, 'aucune décision : les fragments de la substitution ont borné le diff à rien')
    assert.equal(refus.decision, 'deny')
    assert.match(refus.reason, /sans juge\s+adversarial/)
  } finally {
    rmSync(repo, { recursive: true, force: true })
  }
})

// `xargs` ajoute les chemins HORS du texte de la commande : la garde lisait un commit d'index — vide —
// pendant que git emportait l'arbre des chemins listés (revue de palier du 2026-09-27, #1801, H-1).
test('DRIVER : un commit sous `xargs` ne rend pas la porte du juge MUETTE', () => {
  const chemin = 'src/state/xFlux.ts'
  const { racine: repo } = instanceDeDepot({ fichiers: { [chemin]: 'export const X = 0\n' }, message: 'socle' })
  try {
    const lignes = Array.from({ length: 12 }, (_, i) => `export const X${i} = ${i}`)
    writeFileSync(join(repo, chemin), lignes.join('\n') + '\n', 'utf8')
    writeFileSync(join(repo, 'msg.txt'), 'feat(flux): refs #7 — douze exports\n', 'utf8')
    const refus = decisionOf('git ls-files -m | xargs git commit -F msg.txt --', repo)
    assert.ok(refus, 'aucune décision : le commit sous xargs a été lu comme un commit d\'index vide')
    assert.equal(refus.decision, 'deny')
    assert.match(refus.reason, /sans juge\s+adversarial/)
  } finally {
    rmSync(repo, { recursive: true, force: true })
  }
})

// `find … -exec` porte `git commit` en ARGUMENTS et lui ajoute les chemins trouvés : la garde ne
// reconnaissait aucun commit, et la porte du juge se taisait (#1801).
test('DRIVER : un commit sous `find -exec` ne rend pas la porte du juge MUETTE', () => {
  const chemin = 'src/state/xFlux.ts'
  const { racine: repo } = instanceDeDepot({ fichiers: { [chemin]: 'export const X = 0\n' }, message: 'socle' })
  try {
    const lignes = Array.from({ length: 12 }, (_, i) => `export const X${i} = ${i}`)
    writeFileSync(join(repo, chemin), lignes.join('\n') + '\n', 'utf8')
    writeFileSync(join(repo, 'msg.txt'), 'feat(flux): refs #7 — douze exports\n', 'utf8')
    const refus = decisionOf("find src -name '*.ts' -exec git commit -F msg.txt -- {} +", repo)
    assert.ok(refus, 'aucune décision : le commit sous find -exec n\'a pas été vu')
    assert.equal(refus.decision, 'deny')
    assert.match(refus.reason, /sans juge\s+adversarial/)
  } finally {
    rmSync(repo, { recursive: true, force: true })
  }
})

// Une tête qui CITE `git commit` sans l'exécuter ne fait juger aucun commit : le vrai hook refusait
// `echo git commit` au nom de la substance non stagée de l'arbre (#1801, H2-1).
test('DRIVER : `echo git commit` sur un arbre à `src/` non stagé se tait', () => {
  const chemin = 'src/state/xFlux.ts'
  const { racine: repo } = instanceDeDepot({ fichiers: { [chemin]: 'export const X = 0\n' }, message: 'socle' })
  try {
    writeFileSync(join(repo, chemin), 'export const X = 1\n', 'utf8')
    for (const commande of ['echo git commit', 'man git commit', 'grep -rn git commit src']) {
      assert.equal(decisionOf(commande, repo), null, commande)
    }
    assert.ok(decisionOf('git commit -a -m "chore: x"', repo), 'le même arbre, sous un vrai commit, se juge')
  } finally {
    rmSync(repo, { recursive: true, force: true })
  }
})

// Deux commits dans une commande : la forme d'un seul ne couvre pas ce que l'autre emporte. Le
// commit `-a` embarqué emporte la substance de `src/`, le commit direct ne nomme que `notes/` (#1801,
// 3e juge MULTI-COMMIT-1).
test('DRIVER : deux commits dont un embarqué `-a` — la substance de l\'arbre est jugée', () => {
  const chemin = 'src/state/xFlux.ts'
  const { racine: repo } = instanceDeDepot({ fichiers: { [chemin]: 'export const X = 0\n', 'notes/a.md': '# a\n' }, message: 'socle' })
  try {
    writeFileSync(join(repo, chemin), 'export const X = 1\n', 'utf8')
    writeFileSync(join(repo, 'notes', 'a.md'), '# a\n\nb\n', 'utf8')
    const refus = decisionOf('find . -maxdepth 0 -exec git commit -a -m "chore: x" \\; ; git commit -m "chore: y" -- notes/a.md', repo)
    assert.ok(refus, 'aucune décision : seul le commit direct a été mesuré')
    assert.equal(refus.decision, 'deny')
    assert.match(refus.reason, /Commit de SUBSTANCE sans ticket/)
    assert.match(refus.reason, /src\/state\/xFlux\.ts/)
  } finally {
    rmSync(repo, { recursive: true, force: true })
  }
})

// 4e juge, MULTI-MESSAGE-1 : le -F d'un second commit était ignoré ; un commit de substance passait
// sans ticket derrière un premier commit qui en citait un (#1801).
test('DRIVER : deux commits `-F` — le message du SECOND est lu, sa substance sans ticket est refusée', () => {
  const chemin = 'src/state/xFlux.ts'
  const { racine: repo } = instanceDeDepot({ fichiers: { [chemin]: 'export const X = 0\n', 'notes.txt': 'a\n' }, message: 'socle' })
  try {
    writeFileSync(join(repo, chemin), 'export const X = 1\n', 'utf8')
    writeFileSync(join(repo, 'notes.txt'), 'b\n', 'utf8')
    writeFileSync(join(repo, 'm1.txt'), 'chore: refs #7\n', 'utf8')
    writeFileSync(join(repo, 'm3.txt'), 'fix: y sans ticket\n', 'utf8')
    const refus = decisionOf(`git commit -F m1.txt -- notes.txt && git commit -F m3.txt -- ${chemin}`, repo)
    assert.ok(refus, 'aucune décision : le message du second commit n\'a pas été lu')
    assert.equal(refus.decision, 'deny')
    assert.match(refus.reason, /Commit de SUBSTANCE sans ticket/)
    assert.doesNotMatch(refus.reason, /PRÉSUMÉ/, 'deux commits directs ne sont pas présumés')
  } finally {
    rmSync(repo, { recursive: true, force: true })
  }
})

// 4e juge, FAUX-REFUS-1 : un commit présumé se refusait avec le motif d'un vrai commit (« part à
// l'ÉDITEUR »), que l'agent ne pouvait pas diagnostiquer (#1801).
test('DRIVER : un commit PRÉSUMÉ (`sed` qui cite `git commit`) porte son propre motif', () => {
  const chemin = 'src/state/xFlux.ts'
  const { racine: repo } = instanceDeDepot({ fichiers: { [chemin]: 'export const X = 0\n', 'f': 'git commit -a\n' }, message: 'socle' })
  try {
    writeFileSync(join(repo, chemin), 'export const X = 1\n', 'utf8')
    const refus = decisionOf("sed -i 's/git commit -a/x/' f", repo)
    assert.ok(refus, 'aucune décision : la présomption n\'a pas eu lieu')
    assert.match(refus.reason, /^⚠ Commit PRÉSUMÉ/)
    assert.match(refus.reason, /`sed`/)
    assert.doesNotMatch(refus.reason, /ÉDITEUR/)
  } finally {
    rmSync(repo, { recursive: true, force: true })
  }
})

// 5e juge, FAUX-REFUS-1 : la branche « fichier illisible » sortait avant le motif PRÉSUMÉ (#1801).
test('DRIVER : un commit PRÉSUMÉ au `-F` illisible porte le motif PRÉSUMÉ en tête', () => {
  const { racine: repo } = instanceDeDepot({ fichiers: { 'f': 'x\n' }, message: 'socle' })
  try {
    const refus = decisionOf("sed -i 's/git commit -F absent.txt/x/' f", repo)
    assert.ok(refus, 'aucune décision')
    assert.match(refus.reason, /^⚠ Commit PRÉSUMÉ : `sed`/)
    assert.match(refus.reason, /fichier illisible/)
  } finally {
    rmSync(repo, { recursive: true, force: true })
  }
})

// 6e juge, PORTE-TEXTE-1 : le ticket se lit dans le message LISIBLE du commit, jamais ailleurs dans la
// ligne (#1801).
test('DRIVER : un message lisible sans ticket est refusé même si la ligne cite un ticket ailleurs', () => {
  const chemin = 'src/state/xFlux.ts'
  const { racine: repo } = instanceDeDepot({ fichiers: { [chemin]: 'export const X = 0\n' }, message: 'socle' })
  try {
    writeFileSync(join(repo, chemin), 'export const X = 1\n', 'utf8')
    for (const suite of ['echo "refs #1801"', 'gh issue comment 1801 --body "refs #1801 publie"']) {
      const commande = `git commit -m "chore sans ticket" -- ${chemin} && ${suite}`
      const refus = decisionOf(commande, repo)
      assert.ok(refus, `aucune décision : ${commande}`)
      assert.equal(refus.decision, 'deny', commande)
      assert.match(refus.reason, /Commit de SUBSTANCE sans ticket/, commande)
    }
  } finally {
    rmSync(repo, { recursive: true, force: true })
  }
})

// 7e juge, ENV-S-SUITE-1 : les arguments qui suivent la chaîne de `env -S` sont exécutés avec elle (#1801).
test('DRIVER : `env -S \'git\' commit …` est un commit, jugé par la porte', () => {
  const chemin = 'src/state/xFlux.ts'
  const { racine: repo } = instanceDeDepot({ fichiers: { [chemin]: 'export const X = 0\n' }, message: 'socle' })
  try {
    writeFileSync(join(repo, chemin), 'export const X = 1\n', 'utf8')
    const refus = decisionOf("env -S 'git' commit -a -m 'chore sans ticket'", repo)
    assert.ok(refus, 'aucune décision : le commit porté par `env -S` n\'a pas été vu')
    assert.equal(refus.decision, 'deny')
    assert.match(refus.reason, /Commit de SUBSTANCE sans ticket/)
  } finally {
    rmSync(repo, { recursive: true, force: true })
  }
})

// `-m"ajoute…"` : la valeur GLUÉE du flag court contient un `a`, et la lecture des options la prenait
// pour un `-a` — le commit passait alors pour un `commit -a` et l'index STAGÉ n'était plus lu.
test('DRIVER : `-m"ajoute…"` collé ne se lit pas comme un `-a` — l\'index stagé reste jugé', () => {
  const { repo, depot, git, chemin, vide, plein } = depotAStock()
  try {
    writeFileSync(join(repo, chemin), plein, 'utf8')
    git('add', chemin)
    writeFileSync(join(repo, chemin), vide, 'utf8') // arbre revenu en arrière : seul l'index porte la croissance
    assert.equal(git('diff', 'HEAD', '--numstat').trim(), '', 'le suivi non stagé doit être VIDE : c’est le sujet')
    for (const cmd of ['git commit -m"ajoute deux entrees (refs #1806)"', 'git commit -m "ajoute deux entrees (refs #1806)"']) {
      const refus = decisionOf(cmd, repo)
      assert.ok(refus, `aucune décision pour ${cmd}`)
      assert.match(refus.reason, /STOCK NOMINATIF qui NAÎT ou GRANDIT/, `${cmd} : l’index n’a pas été lu`)
    }
  } finally {
    rmSync(depot, { recursive: true, force: true })
  }
})

// Le SOLDE lu doit être celui que le commit EMPORTE : sous un commit par pathspec, un solde stagé
// hors pathspec ne part PAS (git y prend HEAD). Lire l'index validait une preuve absente du commit.
test('DRIVER : un solde stagé HORS pathspec ne vaut pas preuve — le refus dit pourquoi', () => {
  const { racine: repo } = instanceDeDepot({ fichiers: { 'src/x.ts': 'export const a = 1\n' }, message: 'socle' })
  try {
    const git = gitDe(repo)
    mkdirSync(join(repo, '.claude', 'soldes'), { recursive: true })
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
  const { racine: repo } = instanceDeDepot({ fichiers: { 'src/touche.ts': 'export const a = 1\n' }, message: 'socle' })
  try {
    const git = gitDe(repo)
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

// Porte du TICKET (option retenue par l'utilisateur le 2026-09-11) : la garde apporte à la porte le
// lot que le commit EMPORTE. Sur un dépôt réel, un commit de substance sans ticket est refusé, et le
// même geste avec `refs #N` ne l'est plus.
test('DRIVER : un commit de substance sans ticket est refusé ; avec `refs #N`, il passe', () => {
  const { racine: repo } = instanceDeDepot({ fichiers: { 'src/x.ts': 'export const a = 1\n' }, message: 'socle' })
  try {
    const git = gitDe(repo)
    writeFileSync(join(repo, 'src', 'x.ts'), 'export const a = 2\n', 'utf8')
    git('add', 'src/x.ts')

    const refus = decisionOf('git commit -m "chore: une ligne de rien"', repo)
    assert.ok(refus, 'aucune décision : un commit de substance sans ticket est passé')
    assert.equal(refus.decision, 'deny')
    assert.match(refus.reason, /Commit de SUBSTANCE sans ticket/)
    assert.match(refus.reason, /src\/x\.ts/)

    const avec = decisionOf('git commit -m "chore: une ligne de rien (refs #1709)"', repo)
    assert.doesNotMatch(avec?.reason ?? '', /SUBSTANCE sans ticket/, 'un commit qui cite son ticket passe la porte')
  } finally {
    rmSync(repo, { recursive: true, force: true })
  }
})

// Le pendant : un commit qui ne touche NI `src` NI `scripts` (docs dérivés, mémoire) n'a pas de
// ticket à citer — la porte n'y voit pas de substance.
test('DRIVER : `evaluateHunksEmportes` refuse pareil dans l’arbre PRINCIPAL et dans un WORKTREE lié', () => {
  const fichiers = { 'notes/a.md': '# a\n' }
  const { racine: principal } = instanceDeDepot({ fichiers, message: 'socle' })
  const { racine: lie, depot } = depotDeChantier({ fichiers, message: 'socle' })
  try {
    for (const [arbre, nom] of [[principal, 'principal'], [lie, 'worktree lié']]) {
      const git = gitDe(arbre)
      writeFileSync(join(arbre, 'notes', 'a.md'), '# a\nstagé\n', 'utf8')
      git('add', 'notes/a.md')
      writeFileSync(join(arbre, 'notes', 'a.md'), '# a\nstagé\nnon stagé\n', 'utf8')
      const refus = decisionOf('git commit -m "docs: a" -- notes/a.md', arbre)
      assert.equal(refus?.decision, 'deny', nom)
      assert.match(refus.reason, /À LA FOIS des modifications stagées et non stagées/, nom)
    }
  } finally {
    rmSync(principal, { recursive: true, force: true })
    rmSync(depot, { recursive: true, force: true })
  }
})

test('DRIVER : un commit hors src/ et scripts/ passe sans ticket', () => {
  const { racine: repo } = instanceDeDepot({ fichiers: { 'docs/architecture.md': '# carte\n' }, message: 'socle' })
  try {
    const git = gitDe(repo)
    writeFileSync(join(repo, 'docs', 'architecture.md'), '# carte\n\nune ligne de plus\n', 'utf8')
    git('add', 'docs/architecture.md')

    const out = decisionOf('git commit -m "chore(docs): régénéré"', repo)
    assert.doesNotMatch(out?.reason ?? '', /SUBSTANCE sans ticket/, 'un commit de docs n’a aucun ticket à citer')
  } finally {
    rmSync(repo, { recursive: true, force: true })
  }
})

// #1806 : une PANNE de lecture du contenu emporté n'est pas « rien n'est emporté ». La feinte ne vise
// que cette lecture (`diff-index --numstat -M`, `ceQuiChange`) : l'ascendance reste lisible, et le
// seul refus est `refusDesPannes`.
test('DRIVER : une PANNE de lecture du contenu emporté (objet de base CORROMPU, ou `diff-index` en panne) est un `deny` NOMMÉ', () => {
  const { racine: repo } = instanceDeDepot({ fichiers: { 'src/x.ts': 'export const x = 1\n' }, message: 'socle' })
  try {
    const git = gitDe(repo, { net: true })
    writeFileSync(join(repo, 'src', 'x.ts'), 'export const x = 2\nexport const y = 3\n', 'utf8')
    git('add', 'src/x.ts')
    const commande = 'git commit -m "feat(x): y (refs #1806)"'
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

test('#2285 DRIVER : diagnostic Git complet dans la décision publique', () => {
  const { racine: repo } = instanceDeDepot({ fichiers: { 'src/x.ts': 'export const x = 1\n' } })
  try {
    const stderr = `${'ligne diagnostique longue\n'.repeat(45)}CAUSE TARDIVE 2285`
    const vu = decisionOf('git commit -m "refs #1806"', repo, { ...process.env, ...envGitFeint([{ si: ['diff-index', '--numstat', '-M'], status: 37, stdout: 'stdout distinct 2285', stderr }]) })
    assert.equal(vu?.decision, 'deny')
    assert.ok(vu.reason.includes(`refus (status 37) — ${stderr}\nstdout distinct 2285`), vu.reason)
  } finally { rmSync(repo, { recursive: true, force: true }) }
})

test('DRIVER : un dépôt SANS premier commit et un commit qui touche `CLAUDE.md` — la base est l’arbre vide, le hook ne tombe pas', () => {
  const { racine: repo } = instanceDeDepot({ fichiers: { 'CLAUDE.md': '# x\n', '.claude/skills/a/SKILL.md': 's\n' }, commit: false })
  try {
    lancerGit(['add', 'CLAUDE.md', '.claude/skills/a/SKILL.md'], { cwd: repo })
    const out = decisionOf('git commit -m "chore: socle"', repo)
    assert.doesNotMatch(out?.reason ?? '', /BorneAbsente|lecture git indisponible/)
  } finally {
    rmSync(repo, { recursive: true, force: true })
  }
})
