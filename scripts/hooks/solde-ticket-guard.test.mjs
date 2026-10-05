// Test du hook `solde-ticket-guard` (node --test) : la fermeture de ticket au commit exige un
// SOLDE écrit conforme, avec sa propre réfutation adversariale (demande 2026-07-14). Lancé par
// `npm run test:hooks`.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { DEPOT } from '../guards/lib/ticketsGh.mjs'
import { Buffer } from 'node:buffer'
import { resolve, join } from 'node:path'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import {
  extractClosedIssues,
  validateSolde,
  evaluate,
  extractRefIssues,
  validateRefFile,
  evaluateAntiEsquive,
  evaluatePorteDuTicket,
  valeurParametre,
  argumentChaine,
  messagesDesCommits,
  analyzeDiffDuCommit,
  extractMessageSources,
  evaluateAmendInvisible,
  ticketsDuRegistre,
  evaluateRegistresPorteurs,
  extractTargetDir,
  validateJugeFile,
  validateJugeVisionFile,
  evaluateJuge,
  isGitCommitCommand,
  extractCommitPathspecs,
  pathspecsDuCommit,
  formeDuCommit,
  readChangedNames,
  diffDuCommit,
  segmentsProfonds,
  pipelinesProfonds,
  motifDuCommitPresume,
  repoRoot,
  readSoldeFile,
  readRefFile,
  restesItems,
  restesRoutants,
  compteSections,
  lignesDeHunks,
  verifierCapture,
  verifierCaptures,
  soldesEmportes,
  natureDeLArbre,
  cheminDEcriture,
  evaluateFermetureHorsCommit,
  evaluateHunksEmportes,
  histoireDesCitations,
  jugerOuConfier,
  refusDesPannes,
  cibleDeLaCommande,
  avecCibleIgnoree,
  gesteJuge,
  evaluateBudgetContexte,
  evaluateReclassementsCss,
  fichiersCitantTickets,
  listeurDuBudget,
  garde,
  shasCitesDuSolde,
} from './solde-ticket-guard.mjs'
import { sousRacineNpm } from '../guards/lib/racineNpm.mjs'
import { estFichierEcran, sectionDe } from '../guards/lib/livraison.mjs'
import { tombalesDansSource, evaluateTombale, EXEMPTIONS_TOMBALE } from './solde-tombale.mjs'
import { GitIndisponible, INDEX, ceQueFaitLeCommit, depotDe, histoireDeHead } from '../guards/lib/gitPorte.mjs'
import { depotReel, envDeDepotForge, instanceDeDepot } from '../guards/lib/depotGabarit.mjs'
import { gitDe, gitDeLArbreReel, lancerGit, lancesDeGit, resultatDeGit, sousCommande } from '../test/gitDeBanc.mjs'

const TODAY = '2026-07-14'
const VERIFIE_OK = 'VERIFIE: relu le diff complet, lancé npm test et vérifié les 3 fichiers touchés à la main.'
const REFUTATION_OK = 'Un juge adversarial a rejoué le diff contre le DoD du ticket, tenté 2 contournements, aucun ne passe.'

const solde = ({ restes = 'RAS', verdict = 'CONFIRMÉ', date = TODAY } = {}) =>
  `${VERIFIE_OK}\n\n## Restes\n${restes}\n\n## Réfutation\nverdict: ${verdict}\n${REFUTATION_OK}\n\n(${date})\n`

/** Le lecteur de soldes d'`evaluate` (`readSoldes`) qui lit chacun par `lire(n)`. */
const parTicket = (lire) => (ns) => ns.map(lire)

// ── extractClosedIssues ──────────────────────────────────────────────────────────────────────────
test('extractClosedIssues : mono-fermeture', () => {
  assert.deepEqual(extractClosedIssues('git commit -m "corrige #42"'), [42])
})

test('extractClosedIssues : multi-fermeture dédupliquée/triée', () => {
  assert.deepEqual(extractClosedIssues('git commit -m "fixes #10 and closes #3, ferme #10"'), [3, 10])
})

test('extractClosedIssues : here-string / heredoc PowerShell/bash', () => {
  const cmd = 'git commit -m @\'\nfeat: truc\n\ncorrige #7\n\'@'
  assert.deepEqual(extractClosedIssues(cmd), [7])
})

test('extractClosedIssues : aucun mot-clef → vide', () => {
  assert.deepEqual(extractClosedIssues('git commit -m "wip sur #7"'), [])
})

test('extractClosedIssues : pas un commit → vide même avec mot-clef', () => {
  assert.deepEqual(extractClosedIssues('git log --grep "corrige #7"'), [])
})

// ── validateSolde ─────────────────────────────────────────────────────────────────────────────────
test('validateSolde : conforme (RAS, verdict CONFIRMÉ)', () => {
  const r = validateSolde(solde(), TODAY)
  assert.equal(r.ok, true, r.problems.join(' ; '))
  assert.equal(r.refuted, false)
})

test('validateSolde : conforme (items avec dispositions variées, verdict PARTIEL)', () => {
  const restes = [
    '- perf du picker signalée par l\'agent -> #512',
    '- typo doc trouvée en route -> corrigé dans ce commit (src/ui/RollShell.tsx:12)',
    '- flakiness test réseau -> RAS : reproduit hors périmètre, déjà connu (#490)',
  ].join('\n')
  const r = validateSolde(solde({ restes, verdict: 'PARTIEL' }), TODAY)
  assert.equal(r.ok, true, r.problems.join(' ; '))
})

test('validateSolde : verdict sans accent accepté (CONFIRME/REFUTE)', () => {
  assert.equal(validateSolde(solde({ verdict: 'CONFIRME' }), TODAY).ok, true)
})

test('validateSolde : fichier absent', () => {
  const r = validateSolde(null, TODAY)
  assert.equal(r.ok, false)
  assert.deepEqual(r.problems, ['fichier absent'])
})

test('validateSolde : ligne VERIFIE absente', () => {
  const content = solde().replace(`${VERIFIE_OK}\n\n`, '')
  const r = validateSolde(content, TODAY)
  assert.equal(r.ok, false)
  assert.match(r.problems.join(' ; '), /VERIFIE.*absente/)
})

test('validateSolde : VERIFIE trop court', () => {
  const content = solde().replace(VERIFIE_OK, 'VERIFIE: relu vite fait.')
  const r = validateSolde(content, TODAY)
  assert.equal(r.ok, false)
  assert.match(r.problems.join(' ; '), /trop court/)
})

test('validateSolde : section Restes absente', () => {
  const content = `${VERIFIE_OK}\n\n## Réfutation\nverdict: CONFIRMÉ\n${REFUTATION_OK}\n\n(${TODAY})\n`
  const r = validateSolde(content, TODAY)
  assert.equal(r.ok, false)
  assert.match(r.problems.join(' ; '), /"## Restes" absente/)
})

test('validateSolde : item sans disposition', () => {
  const content = solde({ restes: '- un souci vu par l\'agent, sans suite précisée' })
  const r = validateSolde(content, TODAY)
  assert.equal(r.ok, false)
  assert.match(r.problems.join(' ; '), /sans disposition valide/)
})

// ── Borne de la section « ## Restes » : une ligne VIDE n'y termine rien (sonde D1/P1.1) ──────────
// Bornée à la première ligne blanche, la section rendait 1 reste vu pour 5 réels dès qu'une liste
// était aérée — le PLAFOND (seul seuil doctrinal du garde) et la grammaire s'évaporaient ensemble.
test('section Restes : 5 restes routants AÉRÉS comptent 5, comme la même liste compacte', () => {
  const compacte = '- a -> #1\n- b -> #2\n- c -> #3\n- d -> #4\n- e -> #5'
  const aeree = '- a -> #1\n\n- b -> #2\n\n- c -> #3\n\n- d -> #4\n\n- e -> #5'
  for (const restes of [compacte, aeree]) {
    assert.equal(restesRoutants(solde({ restes })).length, 5, restes)
    const r = validateSolde(solde({ restes }), TODAY)
    assert.equal(r.ok, false)
    assert.match(r.problems.join(' ; '), /5 restes ROUTÉS vers un ticket neuf \(plafond 1\)/)
  }
})

test('section Restes : une disposition INVALIDE derrière une ligne blanche est toujours vue', () => {
  const restes = '- a -> RAS : rien à router, tout est traité dans le lot.\n\n- b -> on verra plus tard\n- c -> #7'
  const r = validateSolde(solde({ restes }), TODAY)
  assert.equal(r.ok, false)
  assert.match(r.problems.join(' ; '), /sans disposition valide.*on verra plus tard/s)
})

test('section Restes : un SOUS-TITRE structure la section — ses items comptent, lui non', () => {
  const restes = '- a -> #1\n\n### Restes secondaires\n- b -> #2\n- c -> #3\n- d -> #4\n- e -> #5'
  const contenu = solde({ restes })
  assert.equal(restesItems(contenu).length, 5)
  assert.equal(restesRoutants(contenu).length, 5)
  const r = validateSolde(contenu, TODAY)
  assert.equal(r.ok, false)
  assert.match(r.problems.join(' ; '), /5 restes ROUTÉS/)
  assert.doesNotMatch(r.problems.join(' ; '), /Restes secondaires/)
})

test('section Restes : la borne reste le PROCHAIN titre de niveau 2', () => {
  const contenu = solde({ restes: '- a -> #1' })
  assert.deepEqual(restesItems(contenu), ['- a -> #1'])
  assert.equal(sectionDe(contenu, 'Restes').includes('verdict'), false)
  assert.equal(sectionDe(contenu, 'Absente'), null)
})

test('section Restes : un titre DUPLIQUÉ est refusé (la seconde section échapperait au plafond)', () => {
  const contenu = solde({ restes: '- a -> #1\n\n## Restes\n- b -> #2\n- c -> #3\n- d -> #4\n- e -> #5' })
  assert.equal(compteSections(contenu, 'Restes'), 2)
  const r = validateSolde(contenu, TODAY)
  assert.equal(r.ok, false)
  assert.match(r.problems.join(' ; '), /"## Restes" DUPLIQUÉE \(2 fois\)/)
  assert.equal(compteSections(solde({ restes: '- a -> #1' }), 'Restes'), 1)
})

test('section Restes : « RAS » pour le tout reste conforme, même suivi d\'un pied de fichier', () => {
  const r = validateSolde(solde({ restes: 'RAS' }), TODAY)
  assert.equal(r.ok, true, r.problems.join(' ; '))
  assert.deepEqual(restesItems(solde({ restes: 'RAS' })), [])
})

test('validateSolde : section Réfutation absente', () => {
  const content = `${VERIFIE_OK}\n\n## Restes\nRAS\n\n(${TODAY})\n`
  const r = validateSolde(content, TODAY)
  assert.equal(r.ok, false)
  assert.match(r.problems.join(' ; '), /"## Réfutation" absente/)
})

test('validateSolde : verdict RÉFUTÉ → refused=true, deny explicite', () => {
  const r = validateSolde(solde({ verdict: 'RÉFUTÉ' }), TODAY)
  assert.equal(r.ok, false)
  assert.equal(r.refuted, true)
  assert.match(r.problems.join(' ; '), /un ticket réfuté ne se ferme pas/)
})

test('validateSolde : verdict REFUTE sans accent → refused=true', () => {
  assert.equal(validateSolde(solde({ verdict: 'REFUTE' }), TODAY).refuted, true)
})

test('validateSolde : ligne verdict absente dans Réfutation', () => {
  const content = solde().replace('verdict: CONFIRMÉ\n', '')
  const r = validateSolde(content, TODAY)
  assert.equal(r.ok, false)
  assert.match(r.problems.join(' ; '), /ligne "verdict/)
})

test('validateSolde : Réfutation trop maigre', () => {
  const content = solde().replace(REFUTATION_OK, 'ok.')
  const r = validateSolde(content, TODAY)
  assert.equal(r.ok, false)
  assert.match(r.problems.join(' ; '), /"## Réfutation" trop maigre/)
})

test('validateSolde : date du jour absente', () => {
  const content = solde().replace(`(${TODAY})\n`, '')
  const r = validateSolde(content, TODAY)
  assert.equal(r.ok, false)
  assert.match(r.problems.join(' ; '), /date du jour/)
})

test('validateSolde : date d\'un autre jour ne compte pas (anti-réchauffé)', () => {
  const content = solde({ date: '2026-06-01' })
  const r = validateSolde(content, TODAY)
  assert.equal(r.ok, false)
  assert.match(r.problems.join(' ; '), /date du jour/)
})

// ── evaluate (intégration pure, readSoldes injecté) ────────────────────────────────
test('evaluate : sans mot-clef de fermeture → silence total', () => {
  const d = evaluate({ command: 'git commit -m "wip"', today: TODAY, readSoldes: () => { throw new Error('ne doit pas être appelé') } })
  assert.equal(d, null)
})

test('evaluate : solde conforme → silence (commit passe)', () => {
  const d = evaluate({ command: 'git commit -m "corrige #99"', today: TODAY, readSoldes: parTicket(() => solde()) })
  assert.equal(d, null)
})

test('evaluate : solde absent → deny actionnable', () => {
  const d = evaluate({ command: 'git commit -m "corrige #99"', today: TODAY, readSoldes: parTicket(() => null) })
  assert.ok(d && typeof d.reason === 'string')
  assert.match(d.reason, /#99/)
  assert.match(d.reason, /\.claude\/soldes\/99\.md/)
  assert.match(d.reason, /fichier absent/)
})

test('evaluate : `#N` nus énumérés après une clause de fermeture → refus qui les NOMME (92f57ea33)', () => {
  const d = evaluate({
    command: 'git commit -m "fix(tests): corrige #2225 #2114 + #2151/#2191 — lot"',
    today: TODAY,
    readSoldes: parTicket(() => solde()),
  })
  assert.ok(d && typeof d.reason === 'string')
  assert.match(d.reason, /#2114, #2151, #2191 suit une clause de fermeture/)
  assert.match(d.reason, /`corrige #2114`, `corrige #2151`, `corrige #2191`/)
  assert.match(d.reason, /`refs #2114 #2151 #2191`/)
  assert.equal(evaluate({ command: 'git commit -m "corrige #99, refs #1 #2"', today: TODAY, readSoldes: parTicket(() => solde()) }), null)
})

test('evaluate : multi-fermeture — un seul solde manquant listé nommément', () => {
  const d = evaluate({
    command: 'git commit -m "corrige #1, ferme #2"',
    today: TODAY,
    readSoldes: parTicket((n) => (n === 1 ? solde() : null)),
  })
  assert.ok(d)
  assert.doesNotMatch(d.reason, /#1 \(/)
  assert.match(d.reason, /#2 \(/)
})

test('evaluate : verdict RÉFUTÉ → deny même si le reste du solde est conforme', () => {
  const d = evaluate({ command: 'git commit -m "corrige #5"', today: TODAY, readSoldes: parTicket(() => solde({ verdict: 'RÉFUTÉ' })) })
  assert.ok(d)
  assert.match(d.reason, /réfuté ne se ferme pas/)
})

// ── extractRefIssues (anti-esquive, extension 2026-07-14) ──────────────────────────────────────────
test('extractRefIssues : "ref #N" et "refs #N" reconnus, dédupliqués/triés', () => {
  assert.deepEqual(extractRefIssues('git commit -m "feat: truc, ref #371 refs #371 ref #393"'), [371, 393])
})

test('extractRefIssues : la CHAÎNE `refs #A #B #C` rend TOUS ses numéros, en nombres triés', () => {
  assert.deepEqual(extractRefIssues('git commit -m "fix(guards): refs #1699 #1388 — le banc"'), [1388, 1699])
  assert.deepEqual(extractRefIssues('git commit -m "chore: refs #12, #13"'), [12, 13])
  // Le ticket rattaché par une chaîne exige son solde comme un `refs #N` seul : sans cela, #1388
  // passait sous la porte dès qu'il était cité en 2ᵉ position.
  assert.deepEqual(extractRefIssues('git commit -m "corrige #7 — refs #8 #9"'), [8, 9])
})

test('extractRefIssues : aucun mot-clef → vide', () => {
  assert.deepEqual(extractRefIssues('git commit -m "feat: truc"'), [])
})

test('extractRefIssues : pas un commit → vide même avec mot-clef', () => {
  assert.deepEqual(extractRefIssues('git log --grep "ref #371"'), [])
})

// ── validateRefFile ──────────────────────────────────────────────────────────────────────────────
const refFile = ({ verdict = 'CONFIRMÉ', desc = REFUTATION_OK } = {}) => `## Réfutation\nverdict: ${verdict}\n${desc}\n`

test('validateRefFile : conforme', () => {
  const r = validateRefFile(refFile())
  assert.equal(r.ok, true, r.problems.join(' ; '))
})

test('validateRefFile : fichier absent', () => {
  assert.equal(validateRefFile(null).ok, false)
})

test('validateRefFile : section Réfutation trop maigre', () => {
  const r = validateRefFile(refFile({ desc: 'ok.' }))
  assert.equal(r.ok, false)
  assert.match(r.problems.join(' ; '), /trop maigre/)
})

// ── analyzeDiffDuCommit ────────────────────────────────────────────────────────────────────────────
const entree = (plus, moins, chemin) => ({ plus, moins, chemins: [chemin] })
test('analyzeDiffDuCommit : touche src/**, compte les lignes', () => {
  const raw = [entree(5, 2, 'src/engine/character.ts'), entree(1, 0, 'docs/plans/truc.md')]
  const r = analyzeDiffDuCommit(raw)
  assert.equal(r.touchesSrc, true)
  assert.equal(r.totalLines, 8)
})

test('analyzeDiffDuCommit : docs-only ne touche pas src', () => {
  const raw = [entree(10, 3, 'docs/architecture.md')]
  const r = analyzeDiffDuCommit(raw)
  assert.equal(r.touchesSrc, false)
})

test('analyzeDiffDuCommit : vide/absent → aucune touche, 0 ligne', () => {
  assert.deepEqual(analyzeDiffDuCommit([]), { touchesSrc: false, touchesUi: false, totalLines: 0, fichiers: [] })
  assert.deepEqual(analyzeDiffDuCommit(undefined), { touchesSrc: false, touchesUi: false, totalLines: 0, fichiers: [] })
})

test('analyzeDiffDuCommit : touche src/ui/** → touchesUi', () => {
  const raw = [entree(3, 1, 'src/ui/RollShell.tsx')]
  const r = analyzeDiffDuCommit(raw)
  assert.equal(r.touchesSrc, true)
  assert.equal(r.touchesUi, true)
})

test('analyzeDiffDuCommit : src/** hors src/ui/** → touchesUi false', () => {
  const raw = [entree(3, 1, 'src/engine/combat.ts')]
  const r = analyzeDiffDuCommit(raw)
  assert.equal(r.touchesSrc, true)
  assert.equal(r.touchesUi, false)
})

// ── La restriction au lot de CETTE commande appartient à git (#591 défaut 1, arbre PARTAGÉ) ───────
// `diffDuCommit` borne déjà le `--numstat` par `-- <pathspecs>`. Refaire ce filtrage ICI avec un
// matcheur de chemins MAISON aveuglait la garde sur `git commit -- .` (sonde 2026-09-04) : `.`
// n'égale aucun chemin et n'en préfixe aucun, donc tout le lot était jeté — stock, `touchesSrc` et
// compte de lignes à zéro sur la forme la plus courante.
test('analyzeDiffDuCommit : lit le numstat TEL QUEL, sans second filtrage de chemins', () => {
  const raw = [
    entree(50, 20, 'src/ui/RollShell.tsx'),
    entree(3, 1, 'scripts/hooks/solde-ticket-guard.mjs'),
    entree(1, 0, '.claude/settings.json'),
  ]
  const r = analyzeDiffDuCommit(raw)
  assert.deepEqual(
    [r.touchesUi, r.touchesSrc, r.totalLines, r.fichiers.length], [true, true, 75, 3],
    'le numstat que git a rendu EST la portée : rien ne s’y retranche après coup',
  )
})

test('analyzeDiffDuCommit : `git commit -- .` — le lot borné par git est vu ENTIER', () => {
  const { racine: repo } = instanceDeDepot({ fichiers: { 'src/a.ts': 'export const a = 1\n' }, message: 'socle' })
  try {
    writeFileSync(join(repo, 'src', 'a.ts'), 'export const a = 2\n', 'utf8')
    for (const ps of ['.', './', 'src', ':/']) {
      const r = analyzeDiffDuCommit(diffDuCommit(`git commit -m "x" -- ${ps}`, repo).numstat())
      assert.deepEqual([r.fichiers, r.touchesSrc], [['src/a.ts'], true], `pathspec ${ps} : lot perdu`)
    }
  } finally {
    rmSync(repo, { recursive: true, force: true })
  }
})

// ── isGitCommitCommand / extractCommitPathspecs (#591 défauts 1 et 3 — parsing STRUCTUREL) ─────────
test('isGitCommitCommand : git commit simple → true', () => {
  assert.equal(isGitCommitCommand('git commit -m "corrige #7"'), true)
})

test('isGitCommitCommand : git -C <path> commit → true (flag global sauté)', () => {
  assert.equal(isGitCommitCommand('git -C ../autre-repo commit -m "x"'), true)
})

test('isGitCommitCommand : enchaînement cmd1 && git commit → true', () => {
  assert.equal(isGitCommitCommand('npm test && git commit -m "x"'), true)
})

test('isGitCommitCommand : gh issue create citant "git commit" dans le corps → false (jamais un grep de sous-chaîne, #591 défaut 3)', () => {
  const cmd = 'gh issue create --title "bug" --body "le hook a refusé un git commit légitime"'
  assert.equal(isGitCommitCommand(cmd), false)
})

test('isGitCommitCommand : git log --grep "git commit" → false (sous-commande ≠ commit)', () => {
  assert.equal(isGitCommitCommand('git log --grep "git commit"'), false)
})

test('isGitCommitCommand : here-string PowerShell git commit -m @\'...\'@ → true', () => {
  assert.equal(isGitCommitCommand('git commit -m @\'\nfeat: truc\n\'@'), true)
})

// git 2.43 : `git commit --dry-run -- a -m x` → « pathspec '-m' did not match » — après `--`, tout est chemin.
test('extractCommitPathspecs : "git commit -- <paths> -m <msg>" → `-m` et le message sont des chemins, comme dans git', () => {
  const cmd = 'git commit -- scripts/hooks/x.mjs .claude/settings.json -m "corrige #591"'
  assert.deepEqual(extractCommitPathspecs(cmd), ['scripts/hooks/x.mjs', '.claude/settings.json', '-m', 'corrige #591'])
})

test('extractCommitPathspecs : pas de pathspec (commit -m seul) → []', () => {
  assert.deepEqual(extractCommitPathspecs('git commit -m "corrige #7"'), [])
})

test('extractCommitPathspecs : pas un commit → []', () => {
  assert.deepEqual(extractCommitPathspecs('gh issue create --body "git commit -- foo"'), [])
})

// Mesuré 2026-09-04 sur un vrai commit de fermeture depuis un worktree : `2>&1` passait pour un
// pathspec, `analyzeDiffDuCommit` filtrait sur un chemin inexistant, et le garde déclarait « ABSENT
// de ce que ce commit emporte » chaque fichier cité par le solde. Une redirection n'est pas un chemin.
test('extractCommitPathspecs : une REDIRECTION, un PIPE ou un `&` n\'est jamais un pathspec', () => {
  const wt = '.wt-1679-L2'
  assert.deepEqual(extractCommitPathspecs(`git -C "${wt}" commit -q -F "${wt}/msg.txt" 2>&1 | tail -3`), [])
  assert.deepEqual(extractCommitPathspecs('git commit --file=msg.txt > sortie.log'), [])
  assert.deepEqual(extractCommitPathspecs('git commit -m x'), [])
  // Les six formes, chacune après un pathspec RÉEL : lui seul survit à la borne.
  for (const suffixe of ['2>&1', '> log.txt', '>> log.txt', '< in.txt', '2>/dev/null', '&']) {
    assert.deepEqual(
      extractCommitPathspecs(`git commit -m x -- scripts/a.mjs ${suffixe}`), ['scripts/a.mjs'],
      `suffixe ${suffixe} pris pour un chemin`,
    )
  }
  // Un chemin QUOTÉ qui contient `>` reste un chemin : la borne lit des JETONS, pas des caractères.
  assert.deepEqual(extractCommitPathspecs('git commit -m x -- "a>b.txt"'), ['a>b.txt'])
})

// La forme décide le diff, et deux jetons la faisaient basculer à tort (sondes 2026-09-04).
test('shorts groupés : le PREMIER `m`/`F` décide, comme dans git', () => {
  // `-mF` est un MESSAGE valant « F » : lu comme « -m booléen puis -F fichier », le garde consommait
  // le token suivant en pathspec et jugeait un commit sur un fichier qui n'y est pas.
  assert.deepEqual(extractCommitPathspecs('git commit -mF src/ui/RollShell.tsx'), ['src/ui/RollShell.tsx'])
  assert.equal(formeDuCommit('git commit -mF').forme, 'index', 'aucun token à consommer après `-mF`')
  assert.deepEqual(extractCommitPathspecs('git commit -am "corrige #7"'), [])
  assert.equal(formeDuCommit('git commit -am "corrige #7"').forme, 'tout', '`-am` porte le `-a`')
  assert.deepEqual(extractCommitPathspecs('git commit -aF msg.txt -- scripts/a.mjs'), ['scripts/a.mjs'])
})

test('formeDuCommit : un pathspec à JOKER rend `tout` — jamais `index`, qui serait MUET', () => {
  for (const joker of ['scripts/guards/lib/*.mjs', ':(glob)scripts/**', 'src/?.ts', 'src/[ab].ts']) {
    const f = formeDuCommit(`git commit -m "x" -- ${joker}`)
    assert.deepEqual([f.forme, f.pathspecs], ['tout', []], `joker ${joker}`)
    assert.equal(pathspecsDuCommit(`git commit -m "x" -- ${joker}`).nonResolus, true)
  }
  assert.equal(pathspecsDuCommit('git commit -m "x"').nonResolus, false, 'aucun chemin n’est pas un joker')
  assert.equal(formeDuCommit('git commit -m "x"').forme, 'index')
})

test('pathspecsDuCommit : une SUBSTITUTION ou une EXPANSION shell est non résolue, quel que soit le fragment', () => {
  for (const commande of [
    'git commit -q -F /tmp/m.txt -- $(cat /tmp/liste.txt) > /tmp/log 2>&1',
    "git commit -q -F /tmp/m.txt -- $(git status --porcelain | awk '{print $NF}')",
    'git commit -F m.txt -- $FICHIERS',
    'git commit -F m.txt -- `cat l`',
    'git commit -F m.txt -- ${FICHIERS}',
    'git commit -F m.txt -- src/{a,b}.ts',
    'git commit -F m.txt -- ~/src/a.ts',
    // Chemins fournis HORS du texte : l'enrobeur `xargs` et `--pathspec-from-file` (#1801, H-1).
    'git ls-files -m | xargs git commit -F m --',
    'git commit -F m --pathspec-from-file=l',
    'git commit -F m --pathspec-from-file l',
    'git commit -F m --pathspec-from-file=l --pathspec-file-nul',
    // Sous quote double, `$` et le backtick restent vus par le shell.
    'git commit -F m -- "$x"',
    'git commit -F m -- "`cat l`"',
    // Joker et magie de pathspec : git les interprète, quelle que soit la quote.
    "git commit -F m -- 'src/*.ts'",
    "git commit -F m -- ':(top)src/a.ts'",
  ]) {
    assert.deepEqual(pathspecsDuCommit(commande), { chemins: [], nonResolus: true }, commande)
    assert.deepEqual(formeDuCommit(commande), { forme: 'tout', pathspecs: [] }, commande)
  }
  const litteraux = 'git commit -F m.txt -- src/a.ts scripts/b.mjs 2>&1 | tail -3'
  assert.deepEqual(pathspecsDuCommit(litteraux), { chemins: ['src/a.ts', 'scripts/b.mjs'], nonResolus: false })
  assert.equal(formeDuCommit(litteraux).forme, 'pathspec')
})

// La provenance quotée d'un jeton décide ce que le shell en change (#1801, H-2) : un chemin suivi de
// `Source/` porte des parenthèses, et le lire comme une substitution faisait mesurer le WIP partagé.
test('pathspecsDuCommit : un jeton sous quote simple est littéral, sous quote double seuls `$` et le backtick comptent', () => {
  const chemin = 'Source/Middenheim - City of the White Wolf/14 - Humans (Middenheimer).md'
  for (const quote of ["'", '"']) {
    const commande = `git commit -F m -- ${quote}${chemin}${quote}`
    assert.deepEqual(pathspecsDuCommit(commande), { chemins: [chemin], nonResolus: false }, commande)
    assert.deepEqual(formeDuCommit(commande), { forme: 'pathspec', pathspecs: [chemin] }, commande)
  }
  assert.deepEqual(pathspecsDuCommit("git commit -F m -- '$x'"), { chemins: ['$x'], nonResolus: false })
  assert.deepEqual(pathspecsDuCommit('git commit -F m -- "$x"'), { chemins: [], nonResolus: true })
  // Un mot qui mêle nu et quoté n'est pas ENTIÈREMENT sous quote : lu comme nu.
  assert.equal(pathspecsDuCommit('git commit -F m -- Source/a"(b)".md').nonResolus, true)
})

// #1801 H-3, #1806 A6
test('formeDuCommit : `-i`/`--include`, groupé compris, rend `inclus` avec ses chemins', () => {
  for (const commande of [
    'git commit -F m -i src/a.ts',
    'git commit -F m -qi src/a.ts',
    'git commit -F m --include src/a.ts',
    'git commit -im "x" src/a.ts',
  ]) {
    assert.deepEqual(formeDuCommit(commande), { forme: 'inclus', pathspecs: ['src/a.ts'] }, commande)
  }
  assert.equal(formeDuCommit('git commit -mi src/a.ts').forme, 'pathspec', 'la valeur « i » d\'un `-m` n\'est pas `-i`')
  assert.equal(formeDuCommit('git commit -F m src/a.ts').forme, 'pathspec')
})

// Toutes les options à valeur de `git commit` (`--help-all`, git 2.43) : leur valeur n'est jamais un
// pathspec. `-C HEAD` passait pour `pathspec ["HEAD"]` — un diff vide sur un commit d'index (#1801).
test('jetonsDuCommit : la valeur d\'une option n\'est jamais un pathspec — `-C`, `-c`, `-t`, `--cleanup`, `-S`', () => {
  for (const commande of ['git commit -C HEAD', 'git commit -c HEAD', 'git commit -t tpl.txt', 'git commit --reuse-message HEAD']) {
    assert.deepEqual(formeDuCommit(commande), { forme: 'index', pathspecs: [] }, commande)
  }
  for (const commande of [
    'git commit -CHEAD src/a.ts',
    'git commit --cleanup strip src/a.ts',
    'git commit --cleanup=strip src/a.ts',
    'git commit --author "A <a@b>" src/a.ts',
    // Valeur OPTIONNELLE : collée seulement — le mot suivant reste un chemin.
    'git commit -S src/a.ts',
    'git commit -Skey src/a.ts',
    'git commit --gpg-sign src/a.ts',
    'git commit -uno src/a.ts',
  ]) {
    assert.deepEqual(pathspecsDuCommit(commande), { chemins: ['src/a.ts'], nonResolus: false }, commande)
  }
})

// parse-options accepte le préfixe UNIQUE d'une option longue ; ambigu ou inconnu, git refuse la
// commande et la garde retombe sur le sur-ensemble (#1801).
test('jetonsDuCommit : une option longue ABRÉGÉE se résout ; ambiguë ou inconnue, elle est non résolue', () => {
  assert.deepEqual(formeDuCommit('git commit --incl src/a.ts'), { forme: 'inclus', pathspecs: ['src/a.ts'] })
  assert.deepEqual(pathspecsDuCommit('git commit --mess x src/a.ts'), { chemins: ['src/a.ts'], nonResolus: false })
  assert.deepEqual(pathspecsDuCommit('git commit --no-verif -m x src/a.ts'), { chemins: ['src/a.ts'], nonResolus: false })
  for (const commande of [
    'git commit -F m --pathspec-fr=l',
    'git commit --al -m x',
    'git commit --no-ver -m x src/a.ts',
    'git commit -x -m y src/a.ts',
  ]) {
    assert.deepEqual(pathspecsDuCommit(commande), { chemins: [], nonResolus: true }, commande)
    assert.equal(formeDuCommit(commande).forme, 'tout', commande)
  }
  assert.equal(formeDuCommit('git commit -a --no-all -m x').forme, 'index', 'la négation qui suit l\'emporte')
  assert.ok(evaluateAmendInvisible({ command: 'git commit --amen', stagedTouchesSrc: true }), '`--amen` est `--amend`')
  assert.equal(evaluateAmendInvisible({ command: 'git commit --amen --mess x', stagedTouchesSrc: true }), null)
})

// Une tête INCONNUE qui porte `git commit` dans ses arguments l'exécute peut-être, et lui ajoute des
// chemins hors du texte (#1801) : la garde voit le commit, sur le sur-ensemble.
test('isGitCommitCommand : `find -exec`, `parallel` — un commit EMBARQUÉ est vu, non résolu', () => {
  for (const commande of [
    "find src -name '*.ts' -exec git commit -F m -- {} +",
    "find . -execdir git commit -F m {} ';'",
    'parallel git commit -F m -- ::: a b',
  ]) {
    assert.equal(isGitCommitCommand(commande), true, commande)
    assert.deepEqual(pathspecsDuCommit(commande), { chemins: [], nonResolus: true }, commande)
    assert.deepEqual(formeDuCommit(commande), { forme: 'tout', pathspecs: [] }, commande)
  }
  assert.equal(isGitCommitCommand('git log --grep x'), false)
})

// CITER se reconnaît (table fermée des CITEURS), EXÉCUTER se présume : une citation reste une
// citation, quotée ou non (contrat #591) ; toute autre tête qui porte `git commit` l'embarque (#1801).
test('isGitCommitCommand : une tête CITEUSE ne commite pas ; toute autre tête EMBARQUE le commit', () => {
  for (const commande of [
    'echo git commit',
    'man git commit',
    'which git commit',
    'type git commit',
    'tldr git commit',
    'ls git commit',
    'grep -rn git commit x',
    "printf '%s\\n' git commit | head",
    "bash -c 'echo git commit'",
    'gh issue comment 5 --body x git commit',
    'command -v git commit',
    'git log --grep "git commit"',
    "watch 'echo git commit'",
    "watch -x sh -c 'echo git commit'",
  ]) {
    assert.equal(isGitCommitCommand(commande), false, commande)
  }
  // `parallel` n'est pas un citeur : la garde ne sait pas qu'`echo` y est la commande, elle présume.
  for (const commande of [
    'parallel -k echo git commit ::: a',
    'find . -name x -exec git commit -F m \\;',
    'find . -okdir git commit -F m {} +',
    'parallel git commit ::: a b',
    'parallel -j 4 git commit -F m ::: a',
    'watch -n 2 git commit -F m',
    "git rebase -x 'git commit --amend --no-edit' HEAD~2",
  ]) {
    assert.equal(isGitCommitCommand(commande), true, commande)
    assert.deepEqual(pathspecsDuCommit(commande), { chemins: [], nonResolus: true }, commande)
  }
})

// Un argument qui contient une espace est une chaîne de commande possible : `watch` hors `-x` la passe
// à `sh -c` (`watch --help`, procps-ng), `parallel` aussi, en y remplaçant `{}` (#1801).
test('isGitCommitCommand : la CHAÎNE portée en argument par une tête non citeuse est ré-analysée', () => {
  for (const commande of [
    "watch 'git commit -F m'",
    'watch -n 2 "git commit -F m -- src/a.ts"',
    'watch -tn 2 git commit -F m',
    'watch --interval=2 -- git commit -F m',
    'watch -x git commit -F m',
    "parallel 'git commit -F {}' ::: a",
  ]) {
    assert.equal(isGitCommitCommand(commande), true, commande)
    assert.deepEqual(pathspecsDuCommit(commande), { chemins: [], nonResolus: true }, commande)
  }
  assert.deepEqual(segmentsProfonds("watch -n 2 'git status && git commit -F m'"),
    [['watch', '-n', '2', 'git status && git commit -F m']], 'la ré-analyse ne crée pas de segment pour les autres gardes')
})

// 3e juge, EXEC-ARGV-1 : la commande qu'un exécuteur lance en argv peut elle-même être enrobée.
test('isGitCommitCommand : un exécuteur en argv qui ENROBE le commit l\'embarque', () => {
  for (const commande of [
    'find . -maxdepth 0 -exec env git commit -a -m "chore: x" \\;',
    'find . -maxdepth 0 -exec sh -c \'git commit -a -m "chore: x"\' \\;',
    'watch -x env git commit -a -m "chore: x"',
    'find . -exec timeout 30 git commit -m x \\;',
    "watch -x sh -c 'git commit -m x'",
  ]) {
    assert.equal(isGitCommitCommand(commande), true, commande)
    assert.deepEqual(formeDuCommit(commande), { forme: 'tout', pathspecs: [] }, commande)
  }
})

// 3e juge, SOUS-SHELL-1 : un sous-shell ou un mot réservé hors du tout début de segment.
test('isGitCommitCommand : sous-shell après `time`/`{`/`(`/`!`, et mots réservés POSIX en tête', () => {
  for (const commande of [
    'time (git commit -a -m "chore: x")',
    '{ (git commit -a -m "chore: x"); }',
    'if git commit -a -m "chore: x"; then echo ok; fi',
    'for f in a; do git commit -a -m "chore: x"; done',
    '( (git commit -m x) )',
    '! (git commit -m x)',
  ]) {
    assert.equal(isGitCommitCommand(commande), true, commande)
  }
  assert.deepEqual(formeDuCommit('time (git commit -F m -- src/a.ts)'), { forme: 'pathspec', pathspecs: ['src/a.ts'] })
})

// 3e juge, MULTI-COMMIT-1 : la forme d'un seul commit ne couvre pas ce qu'un second emporte.
test('formeDuCommit : deux commits ou plus rendent `tout` ; le message de CHAQUE commit est lu', () => {
  for (const commande of [
    'find . -maxdepth 0 -exec git commit -a -m "chore: x" \\; ; git commit -m "chore: y" -- notes/a.md',
    'parallel git commit -a -m "chore: x" ::: -q && git commit -m "chore: y" -- notes/a.md',
    'git commit -m y -- notes/a.md && git commit -a -m x',
  ]) {
    assert.deepEqual(formeDuCommit(commande), { forme: 'tout', pathspecs: [] }, commande)
  }
  const lire = () => 'fix: corrige #12'
  const deux = 'find . -exec git commit -F autre.txt {} + ; git commit -F msg.txt -- src/a.ts'
  assert.equal(extractMessageSources(deux, { readFile: (p) => (p.endsWith('msg.txt') ? lire() : 'autre') }).text,
    `${deux}\nautre\nfix: corrige #12`, 'les -F de tous les commits sont lus, dans l\'ordre')
  const cite = 'echo git commit && git commit -F msg.txt -- src/a.ts'
  assert.equal(extractMessageSources(cite, { readFile: lire }).text, `${cite}\nfix: corrige #12`)
  assert.deepEqual(formeDuCommit(cite), { forme: 'pathspec', pathspecs: ['src/a.ts'] }, 'une citation n\'est pas un commit')
  assert.equal(formeDuCommit('echo avant git commit ; git commit -F msg.txt').forme, 'index')
})

// 4e juge, MULTI-MESSAGE-1 : le message d'un second commit `-F` n'était jamais lu.
test('extractMessageSources : le -F de CHAQUE commit est lu ; le premier illisible est fail-closed', () => {
  const fichiers = {
    'm1.txt': 'chore: refs #1801\n',
    'm2.txt': 'fix: corrige #99999 — y\n',
    'm3.txt': 'fix: y sans ticket\n',
  }
  const readFile = (p) => {
    const nom = p.split(/[/\\]/).pop()
    if (!(nom in fichiers)) throw new Error('ENOENT')
    return fichiers[nom]
  }
  const m12 = 'git commit -F m1.txt -- notes.txt && git commit -F m2.txt -- src/engine/activeFlags.ts'
  const lu12 = extractMessageSources(m12, { readFile })
  assert.equal(lu12.fileError, null)
  assert.deepEqual(extractClosedIssues(lu12.text), [99999], 'la fermeture du second commit est vue')
  const m13 = 'git commit -F m1.txt -- notes.txt && git commit -F m3.txt -- src/engine/activeFlags.ts'
  const lu13 = extractMessageSources(m13, { readFile })
  assert.deepEqual(lu13.messages.map((m) => m.texte), [fichiers['m1.txt'], fichiers['m3.txt']])
  const refus = evaluatePorteDuTicket({ command: lu13.text, fichiersEmportes: ['src/engine/activeFlags.ts'], messages: lu13.messages })
  assert.match(refus?.reason ?? '', /Commit de SUBSTANCE sans ticket/, 'le second commit ne cite aucun ticket')
  assert.doesNotMatch(refus.reason, /ÉDITEUR/)
  assert.equal(evaluatePorteDuTicket({ command: lu12.text, fichiersEmportes: ['src/engine/activeFlags.ts'], messages: lu12.messages }), null)
  assert.equal(extractMessageSources('git commit -F m1.txt && git commit -F absent.txt && git commit -F aussi.txt', { readFile }).fileError,
    'absent.txt')
  assert.deepEqual(extractMessageSources('git commit -m "a refs #1" -m b && git commit -a', { readFile }).messages,
    [{ texte: 'a refs #1\n\nb', fichier: false, direct: true, tete: 'git', herite: false },
      { texte: null, fichier: false, direct: true, tete: 'git', herite: false }])
})

// 4e juge, FAUX-REFUS-1 : un commit PRÉSUMÉ ne se dit pas comme un vrai commit.
test('motifDuCommitPresume : la tête, l\'extrait et la sortie ; rien quand un commit direct existe', () => {
  const motif = motifDuCommitPresume("sed -i 's/git commit -a/x/' f")
  assert.match(motif, /PRÉSUMÉ/)
  assert.match(motif, /`sed`/)
  assert.match(motif, /s\/git commit -a\/x\//)
  assert.match(motifDuCommitPresume('find . -exec env git commit -a \\;'), /`find` porte `git commit` en argument \(`git commit`\)/)
  assert.match(motifDuCommitPresume(`x "${'echo a ; '.repeat(2100)}"`), /dépasse ses bornes/)
  assert.equal(motifDuCommitPresume('echo git commit && git commit -a -m x'), null)
  assert.equal(motifDuCommitPresume('echo git commit'), null)
  const refus = evaluatePorteDuTicket({ command: "sed -i 's/git commit -a/x/' f", fichiersEmportes: ['src/a.ts'] })
  assert.doesNotMatch(refus.reason, /ÉDITEUR/, 'un commit sans jetons ne part pas à l\'éditeur')
})

// 3e et 4e juges, COUT-PARALLEL-1 et QUADRATIQUE-1 : coût linéaire, bornes, retombée sans exception.
test('isGitCommitCommand : coût linéaire ; au-delà des bornes, un commit EMBARQUÉ présumé, sans exception', () => {
  for (const [nom, commande] of [
    ['parallel -j ×50', `parallel ${'-j '.repeat(50)}git commit -F m ::: a`],
    ['parallel -j ×100', `parallel ${'-j '.repeat(100)}git commit -F m ::: a`],
    ['git ×50 000', `x ${'git '.repeat(50000)}; git commit -a -m y`],
  ]) {
    assert.equal(isGitCommitCommand(commande), true, nom)
    assert.deepEqual(formeDuCommit(commande), { forme: 'tout', pathspecs: [] }, nom)
  }
  // 7e juge, FLAKY-200MS ; 8e juge, COUT-MARGE-1 : la linéarité se mesure par RAPPORT (médiane de 5,
  // chaîne neuve à chaque mesure : le mémo ne sert pas) — N ×20 : linéaire ≈ 20, quadratique ≈ 400.
  let essai = 0
  const cout = (n) => {
    const temps = []
    for (let i = 0; i < 5; i++) {
      const commande = `x ${'git '.repeat(n)}; git commit -a -m y${essai++}`
      const t0 = performance.now()
      isGitCommitCommand(commande)
      formeDuCommit(commande)
      temps.push(performance.now() - t0)
    }
    return temps.sort((a, b) => a - b)[2]
  }
  cout(5000)
  const rapport = cout(100000) / cout(5000)
  assert.ok(rapport < 80, `N ×20 coûte ×${rapport.toFixed(1)} : la lecture n'est plus linéaire`)
  const reanalysee = `x "${'echo a ; '.repeat(2100)}"`
  assert.equal(isGitCommitCommand(reanalysee), true, 'au-delà du budget de la ré-analyse, un commit est présumé')
  assert.deepEqual(formeDuCommit(reanalysee), { forme: 'tout', pathspecs: [] })
  assert.equal(isGitCommitCommand('true ; '.repeat(2100) + 'echo fin'), false, 'le premier niveau n\'est pas borné')
  let imbriquee = 'echo x'
  for (let i = 0; i < 6; i++) imbriquee = `sh -c ${JSON.stringify(imbriquee)}`
  assert.equal(isGitCommitCommand(imbriquee), true, 'au-delà de la profondeur, un commit est présumé')
})

// 4e juge, TETE-A-ESPACE-1 : une chaîne de commande portée en tête, collée à son flag, ou échappée.
test('isGitCommitCommand : `env -S`, valeur collée `--opt=<commande>`, antislash d\'un mot nu', () => {
  for (const commande of [
    "env -S 'git commit -a -m chore:x'",
    'env -S "git commit -a -m chore:x"',
    "env --split-string='git commit -a -m x'",
    "su --command='git commit -a -m x' root",
    "script --command='git commit -a -m x' /dev/null",
    "git rebase --exec='git commit -a -m \"chore: x\"' HEAD~1",
    'g\\it commit -a -m x',
    "env -S'git commit -a -m x'",
    "env -iS 'git commit -a -m x'",
    "env -u HOME -S 'git commit -a -m x'",
  ]) {
    assert.equal(isGitCommitCommand(commande), true, commande)
  }
  assert.deepEqual(formeDuCommit("env -S 'git commit -F m -- src/a.ts'"), { forme: 'pathspec', pathspecs: ['src/a.ts'] },
    'la chaîne de `env -S` est exécutée : son commit est direct')
})

// 7e juge, ENV-S-SUITE-1 et PORTEURS-RESTE-1 : ce que l'hôte lit APRÈS l'argument porteur (#1801).
test('argumentChaine : `env -S` suivi de ses arguments ; `cmd /c`, `-Command`, `eval` prennent le reste', () => {
  for (const commande of [
    "env -S 'git' commit -a -m x", 'env -S git commit -a -m x', "env --split-string='git' commit -a -m x",
    "env -S'git' commit -a -m x",
  ]) {
    assert.equal(isGitCommitCommand(commande), true, commande)
  }
  const { messages } = messagesDesCommits(`env -S 'git' commit -a -m "c'est refs #1801"`)
  assert.equal(messages[0]?.texte, 'c\'est refs #1801', 'les arguments suivants gardent leur valeur exacte, quote simple comprise')
  // 8e juge, ENV-PROVENANCE-1 : les arguments suivants gardent leur PROVENANCE — un jeton nu non
  // résolu reste non résolu (#1801).
  for (const commande of ['env -S git commit -m x -- $F', 'env -S git commit -m "refs #1801" -- $(git diff --name-only)', 'env -S git commit -m x -- ~/a.ts']) {
    assert.deepEqual(formeDuCommit(commande), { forme: 'tout', pathspecs: [] }, commande)
  }
  assert.deepEqual(formeDuCommit('env -S git commit -m x -- "src/a b.ts"'), { forme: 'pathspec', pathspecs: ['src/a b.ts'] })
  for (const commande of [
    'cmd /c git commit -a -m x', 'cmd /C git commit -a -m x', 'cmd.exe /c git commit -a -m x',
    'powershell -Command git commit -a -m x', 'pwsh -c git commit -a -m x', 'powershell -NoProfile -Command git commit -a -m x',
    'eval git commit -a -m x', 'eval -- git commit -a -m x',
  ]) {
    assert.equal(isGitCommitCommand(commande), true, commande)
  }
  assert.equal(argumentChaine(['Invoke-Expression', 'echo a', 'b']), 'echo a', '`Invoke-Expression` lit son premier argument')
  assert.equal(argumentChaine(['sh', '-c', 'echo "$1"', '_', 'x']), 'echo "$1"', 'les arguments suivants de `sh -c` sont ses positionnels')
})

// #2173 : `//c`/`//k` est la graphie Git Bash (MSYS) de `/c`/`/k`.
test('argumentChaine : `cmd //c` et `//k` portent leur chaîne comme `/c` et `/k` ; un chemin UNC n’est pas un porteur', () => {
  assert.equal(argumentChaine(['cmd', '//c', 'taskkill', '//im', 'node.exe']), 'taskkill //im node.exe')
  assert.equal(argumentChaine(['cmd', '//C', 'echo', 'x']), 'echo x')
  assert.equal(argumentChaine(['cmd', '//q', '//k', 'echo']), 'echo')
  assert.equal(argumentChaine(['cmd', '//serveur/partage']), null)
  assert.equal(isGitCommitCommand('cmd //c git commit -a -m x'), true)
})

// 7e juge, GIT-H-1 : l'aide de git ne committe pas (#1801).
test('isGitCommitCommand : `git commit -h`/`--help` rend l\'aide, aucun commit', () => {
  for (const commande of ['git commit -h', 'git commit --help', 'git commit -ah', 'git --version; git commit -h 2>&1 | head -60']) {
    assert.equal(isGitCommitCommand(commande), false, commande)
  }
  assert.equal(isGitCommitCommand('git commit -m -h'), true, '`-h` valeur de `-m` n\'est pas l\'aide')
  assert.equal(isGitCommitCommand('git commit -a -x'), true, 'une lettre inconnue reste un commit présumé')
  assert.deepEqual(formeDuCommit('git commit -a -x'), { forme: 'tout', pathspecs: [] })
})

test('un commit dans une substitution `$(…)`, backtick, de processus `<(…)` ou de here-string double est vu : la substitution se déplie', () => {
  for (const commande of [
    'out=$(git commit -a -m "chore: x" 2>&1); echo "$out"',
    'echo "$(git commit -a -m x)"',
    'echo `git commit -a -m x`',
    'cat <(git commit -a -m x)',
    '$t = @"\nfoo $(git commit -a)\n"@',
  ]) {
    assert.equal(isGitCommitCommand(commande), true, commande)
  }
})

// #2173 (juge de diff, 3e passe, `cas-hs-commit.json`) : l'affectation PowerShell d'une valeur citée n'exécute rien ;
// une valeur nue est une commande.
test('une affectation PowerShell `$nom = ` d’une valeur citée n’est pas un commit ; d’une valeur nue, si', () => {
  for (const commande of ["$t = @'\nfoo `git commit -a`\n'@", "$t = 'foo git commit -a'", '$t = "foo git commit -a"', "$t = @'\nfoo git commit -a\n'@\nSet-Content x $t"]) {
    assert.equal(isGitCommitCommand(commande), false, commande)
  }
  assert.equal(isGitCommitCommand('$x = git commit -a -m y'), true)
})

// NON COUVERT (en-tête du garde) : ces formes se TAISENT aujourd'hui. #2071 les juge dans le hook git
// `commit-msg`, qui voit le vrai commit ; il retourne ces bancs.
test('#2071 NON COUVERT — une sous-commande git lue comme citeuse qui exécute (alias `!`, filter-branch, `-c core.pager`)', () => {
  for (const commande of [
    "git -c alias.ci='!git commit -a -m x' ci",
    "git filter-branch --tree-filter 'git commit -a -m x' HEAD",
    "git -c core.pager='git commit -a -m x' log -1",
    "git difftool --extcmd='git commit -a -m x' HEAD",
    "git -c core.editor='git commit -a -m x' tag -a v9",
  ]) {
    assert.equal(isGitCommitCommand(commande), false, commande)
  }
  for (const commande of [
    "git rebase -x 'git commit --amend --no-edit' HEAD~2",
    "git rebase --exec='git commit --amend --no-edit' HEAD~2",
    'git bisect run git commit -a -m x',
    "git submodule foreach 'git commit -a -m x'",
    "git -c sequence.editor='sh -c \"git commit -a -m x\"' rebase -i HEAD~2",
    "git -c core.editor='git commit -a -m x' rebase -i HEAD~2",
  ]) {
    assert.equal(isGitCommitCommand(commande), true, `vu par SOUS_COMMANDES_GIT_EXECUTANTES : ${commande}`)
  }
})

test('#2071 NON COUVERT — le corps lu sur stdin par un shell ou un exécuteur n\'est pas vu', () => {
  for (const commande of [
    "bash <<'EOF'\ngit commit -a -m x\nEOF",
    "sh -s <<'EOF'\ncd . && git commit -a -m x\nEOF",
    "echo 'git commit -a -m x' | sh",
    "echo 'git commit -a -m x' | bash -s",
    "echo 'git commit -a -m x' | at now",
  ]) {
    assert.equal(isGitCommitCommand(commande), false, commande)
  }
  assert.equal(isGitCommitCommand("cat > f.md <<'EOF'\ngit commit -a -m x\nEOF"), false, 'un heredoc de donnée reste une donnée')
})

test('#2071 NON COUVERT — des arguments venus de stdin (`xargs git`) ne sont pas vus', () => {
  assert.equal(isGitCommitCommand("printf 'commit -a -m x' | xargs git"), false)
})

test('#2071 NON COUVERT — un exécutable ou une sous-commande par variable n\'est pas vu', () => {
  for (const commande of ['G=git; $G commit -a -m x', 'C=commit; git $C -a -m x', 'eval "$CMD"']) {
    assert.equal(isGitCommitCommand(commande), false, commande)
  }
})

test('#2071 NON COUVERT — un commit dans un fichier de script n\'est pas vu', () => {
  for (const commande of [
    'bash ./x.sh', 'source ./x.sh', '. ./x.sh', 'node x.mjs', 'pwsh -File x.ps1', 'make release',
    'npm --prefix ../autre run c', 'node --run c', 'yarn c',
  ]) {
    assert.equal(isGitCommitCommand(commande), false, commande)
  }
})

test('#2071 NON COUVERT — une porcelaine qui crée un commit sans `git commit` n\'est pas vue', () => {
  for (const commande of [
    'git merge --no-ff -m "sans ticket" autre', 'git cherry-pick abc123', 'git revert --no-edit HEAD',
    'git am 0001.patch', 'git pull --no-rebase', 'git commit-tree HEAD^{tree} -m x',
  ]) {
    assert.equal(isGitCommitCommand(commande), false, commande)
  }
})

test('#2071 NON COUVERT — un alias git défini hors de la ligne n\'est pas vu', () => {
  assert.equal(isGitCommitCommand('git ci -a -m x'), false)
  const alias = "alias gc='git commit'; gc -a -m x"
  assert.equal(isGitCommitCommand(alias), true, '`alias` porte `git commit` : commit PRÉSUMÉ')
  assert.match(motifDuCommitPresume(alias) ?? '', /PRÉSUMÉ : `alias`/, 'présumé par sa tête, pas un alias développé')
})

test('#2071 NON COUVERT — une variable de tête consommée comme commande par git n\'est pas vue', () => {
  for (const commande of [
    `GIT_SEQUENCE_EDITOR="sh -c 'git commit -a -m x'" git rebase -i HEAD~1`,
    `GIT_PAGER="sh -c 'git commit -a -m x'" git log -1`,
    'GIT_EDITOR="git commit -a -m x #" git tag -a v9',
    'env GIT_EDITOR="git commit -a -m x #" git tag -a v9',
  ]) {
    assert.equal(isGitCommitCommand(commande), false, commande)
  }
})

test('#2071 NON COUVERT — une tête citeuse qui exécute (`gh alias set --shell`) n\'est pas vue', () => {
  assert.equal(isGitCommitCommand("gh alias set --shell ci 'git commit -a -m x' && gh ci"), false)
})

// 6e juge, KV-FAUX-REFUS-1 : une affectation par builtin CITE sa valeur, elle ne l'exécute pas (#1801).
test('isGitCommitCommand : les builtins d\'affectation citent (`export`, `declare`, `local`, `readonly`, `typeset`)', () => {
  for (const tete of ['export', 'declare', 'local', 'readonly', 'typeset']) {
    const commande = `${tete} MSG="git commit -a -m x"`
    assert.equal(isGitCommitCommand(commande), false, commande)
  }
})

test('#2071 NON COUVERT — un commit dans le code d\'un interpréteur non shell n\'est pas vu', () => {
  for (const commande of [
    `python3 -c "import os; os.system('git commit -a -m x')"`,
    `node -e "require('child_process').execSync('git commit -a -m x')"`,
    "Start-Process git -ArgumentList 'commit -a'",
  ]) {
    assert.equal(isGitCommitCommand(commande), false, commande)
  }
})

// 5e juge, PORTE-MULTI-1 ; 6e juge, HERITE-C-1 et EMBARQUE-MSG-1 : chaque message lisible cite un
// ticket ; un `--amend` sans message ni `-C`/`-c` hérite du commit direct qui le précède ; un embarqué
// sans message est un commit PRÉSUMÉ sans ticket (#1801).
test('evaluatePorteDuTicket : plusieurs commits — directs jugés, amend hérité, présumé nommé', () => {
  const juger = (command) => {
    const { text, messages } = extractMessageSources(command, { readFile: () => { throw new Error('ENOENT') } })
    return evaluatePorteDuTicket({ command: text, fichiersEmportes: ['src/engine/activeFlags.ts'], messages })
  }
  assert.equal(juger('git commit -a -m "chore: refs #1801" && git commit --amend --no-edit'), null,
    'l\'amend hérite du message du commit direct qui le précède')
  for (const [command, tete] of [
    ['git commit -a -m "chore: refs #1801" && sed -i \'s/git commit -a/x/\' notes.txt', 'sed'],
    ['git commit -a -m "chore: refs #1801" && node scripts/x.mjs --titre "git commit -a oublie"', 'node'],
  ]) {
    const refus = juger(command)
    assert.match(refus?.reason ?? '', new RegExp(`Commit de SUBSTANCE sans ticket \\(commit n°2 de la commande, \`${tete}\`\\)`), command)
    assert.doesNotMatch(refus.reason, /ÉDITEUR/, command)
    assert.match(motifDuCommitPresume(command) ?? '', new RegExp(`PRÉSUMÉ : \`${tete}\``), command)
  }
  assert.match(juger('git commit -a -m "chore: refs #1801" && find . -exec git commit -a -m "chore sans ticket" \\;')?.reason ?? '',
    /commit n°2 de la commande, `find`/, 'un embarqué à message lisible sans ticket est fautif comme l\'embarqué sans message')
  assert.equal(juger('git commit -a -m "chore: refs #1801" && find . -exec git commit -a -m "chore: refs #1801" \\;'), null,
    'un embarqué dont le message lisible cite un ticket passe')
  assert.match(juger('git commit -a -m "chore: refs #1801" && git commit --amend -C HEAD~3')?.reason ?? '',
    /commit n°2 de la commande, `git`/, 'un `--amend -C` prend le message de HEAD~3 : rien n\'est hérité de la commande')
  assert.match(juger('git commit -a -m "chore: refs #1801" && git commit --amend -c HEAD~3')?.reason ?? '',
    /commit n°2 de la commande, `git`/, 'idem sous `-c`')
  const sansTicket = juger('git commit -a -m "chore: refs #1801" && git commit -m "fix: rien"')
  assert.match(sansTicket.reason, /commit n°2 de la commande, `git`/)
  assert.match(juger('git commit -a -m "chore: refs #1801" && git commit -a').reason, /ÉDITEUR/, 'un direct sans message part à l\'éditeur')
  assert.equal(juger('git commit --amend --no-edit && git commit -m "chore: refs #1801"').reason.includes('commit n°1'), true,
    'un amend sans commit direct AVANT lui hérite de HEAD, invisible ici')
  // 7e juge, ECART-NON-FIGE : un direct au message invisible compte les tickets cités HORS des
  // messages lisibles de la ligne — l'écart accepté, figé des deux côtés.
  assert.equal(juger('git commit -a -m "refs #1801" && git commit -a && echo "refs #1802"'), null,
    'un ticket cité hors des messages lisibles vaut pour le commit invisible')
  assert.match(juger('git commit -a -m "refs #1801" && git commit -a && echo "refs #1801"')?.reason ?? '',
    /commit n°2 de la commande, `git`/, 'le ticket d\'un autre commit n\'est pas le sien')
})

// 5e juge, MEMO-ANCRE-1 : la lecture d'un `npm run` dépend du dépôt ancré, le mémo aussi.
test('isGitCommitCommand : le mémo suit la racine npm de la portée', () => {
  const base = mkdtempSync(join(tmpdir(), 'memo-ancre-'))
  try {
    for (const [d, c] of [['pa', 'git commit -a -m x'], ['pb', 'echo rien']]) {
      mkdirSync(join(base, d))
      writeFileSync(join(base, d, 'package.json'), JSON.stringify({ scripts: { c } }))
    }
    assert.equal(sousRacineNpm(join(base, 'pa'), () => isGitCommitCommand('npm run c')), true)
    assert.equal(sousRacineNpm(join(base, 'pb'), () => isGitCommitCommand('npm run c')), false, 'le résultat lu sous pa ne vaut pas pour pb')
  } finally {
    rmSync(base, { recursive: true, force: true })
  }
})

// Le shell retire l'antislash d'un mot nu avant git : `src/a\ b.ts` est UN chemin que la garde ne
// lit pas tel quel (#1801, H2-3).
test('pathspecsDuCommit : un antislash dans un mot nu le rend non résolu', () => {
  for (const commande of ['git commit -F m -- src/a\\ b.ts', 'git commit -F m -- src\\a.ts']) {
    assert.deepEqual(pathspecsDuCommit(commande), { chemins: [], nonResolus: true }, commande)
    assert.deepEqual(formeDuCommit(commande), { forme: 'tout', pathspecs: [] }, commande)
  }
  assert.deepEqual(pathspecsDuCommit("git commit -F m -- 'src/a\\ b.ts'"), { chemins: ['src/a\\ b.ts'], nonResolus: false },
    'sous quote simple, l\'antislash est littéral')
})

// `( … )` en tête de segment est un SOUS-SHELL : sa parenthèse fermante n'appartient pas au dernier
// chemin ; `$( … )` reste une substitution (#1801, H2-4).
test('pathspecsDuCommit : un sous-shell parenthésé rend ses chemins ; une substitution reste non résolue', () => {
  for (const commande of [
    '(cd x && git commit -F m -- src/a.ts)',
    '(cd x && git commit -F m -- src/a.ts) && git push',
    '( git commit -F m -- src/a.ts ) | tail -3',
  ]) {
    assert.deepEqual(pathspecsDuCommit(commande), { chemins: ['src/a.ts'], nonResolus: false }, commande)
    assert.deepEqual(formeDuCommit(commande), { forme: 'pathspec', pathspecs: ['src/a.ts'] }, commande)
  }
  for (const commande of [
    'git commit -F m -- $(cat l)',
    '(git commit -F m -- $(cat l))',
    '(cd x && git commit -F m -- $( cat l ))',
  ]) {
    assert.deepEqual(pathspecsDuCommit(commande), { chemins: [], nonResolus: true }, commande)
  }
  assert.deepEqual(segmentsProfonds('(cd x && git push) | tail -3'), [['cd', 'x'], ['git', 'push'], ['tail', '-3']])
  assert.deepEqual(pipelinesProfonds('(cd x && git push) | tail -3'), [[['cd', 'x']], [['git', 'push'], ['tail', '-3']]],
    'la parenthèse fermante ne rompt pas le pipeline')
})

// Sous `-i`, git stage l'arbre des chemins PAR-DESSUS l'index puis commite l'index entier : le texte
// « ignore l'index » y était faux (#1801).
test('evaluateHunksEmportes : sous `-i`/`--include`, le texte dit que l\'index ENTIER part', () => {
  for (const command of ['git commit -F m -i src/a.ts', 'git commit -F m --incl src/a.ts']) {
    const refus = evaluateHunksEmportes({ command, fichiersModifies: ['src/a.ts'], fichiersStages: ['src/a.ts'] })
    assert.deepEqual(Object.keys(refus), ['reason'], command)
    assert.match(refus.reason, /git commit -i <paths>.*index ENTIER/, command)
    assert.doesNotMatch(refus.reason, /ignore l'index/, command)
    const note = evaluateHunksEmportes({ command, fichiersModifies: ['src/a.ts'], fichiersStages: [] })
    assert.match(note.contexte, /git commit -i <paths>.*index entier/, command)
  }
  const nu = evaluateHunksEmportes({ command: 'git commit -F m -- src/a.ts', fichiersModifies: ['src/a.ts'], fichiersStages: ['src/a.ts'] })
  assert.match(nu.reason, /ignore l'index/)
})

test('formeDuCommit : la VALEUR d\'un `-m` collé n\'est pas une liste d\'options courtes', () => {
  assert.equal(formeDuCommit('git commit -m"ajoute deux entrees"').forme, 'index')
  assert.equal(formeDuCommit('git commit -m"Refonte du stock"').forme, 'index')
  assert.equal(formeDuCommit('git commit -m "ajoute deux entrees"').forme, 'index')
  // Les vraies formes de `-a` restent vues, collées ou non.
  assert.equal(formeDuCommit('git commit -am "x"').forme, 'tout')
  assert.equal(formeDuCommit('git commit -a -m "x"').forme, 'tout')
  assert.equal(formeDuCommit('git commit --all -m "x"').forme, 'tout')
  assert.equal(formeDuCommit('git commit -sam "x"').forme, 'tout')
})

test('extractCommitPathspecs : --file=<path> ne devient pas un pathspec', () => {
  assert.deepEqual(extractCommitPathspecs('git commit --file=commit-415.txt -- src/ui/Foo.tsx'), ['src/ui/Foo.tsx'])
})

// ── juge adversarial : -am contourne tout (défaut le plus grave, réfuté) ────────────────────────────
test('extractCommitPathspecs : "-am" (shorts groupés) → le message n\'est PAS un pathspec, [] (index entier)', () => {
  assert.deepEqual(extractCommitPathspecs('git commit -am "feat: refonte truc"'), [])
})

// Après `--`, git lit TOUT jeton comme un chemin : `-am` et le message sont des pathspecs (#1801).
test('extractCommitPathspecs : "-am" APRÈS -- est un chemin, comme le message qui le suit', () => {
  const cmd = 'git commit -- src/ui/Foo.tsx -am "feat: refonte truc"'
  assert.deepEqual(extractCommitPathspecs(cmd), ['src/ui/Foo.tsx', '-am', 'feat: refonte truc'])
  assert.equal(formeDuCommit(cmd).forme, 'pathspec', '`-a` après `--` n\'est pas une option')
})

// `-c` est `--reedit-message <commit>` (`git commit --help-all`, git 2.43) : il prend le RÉSIDU `am`, et
// le mot suivant est un chemin positionnel.
test('extractCommitPathspecs : "-cam" est `-c am` — le mot suivant est un chemin, comme dans git', () => {
  assert.deepEqual(extractCommitPathspecs('git commit -cam "feat: refonte truc"'), ['feat: refonte truc'])
  assert.deepEqual(extractCommitPathspecs('git commit -sam "feat: refonte truc"'), [])
})

test('formeDuCommit : `-C`, `-c`, `-t` portent une VALEUR, jamais un pathspec ; `-u<mode>` et `-S<clé>` ne sont pas `-a`', () => {
  for (const [commande, attendu] of [
    ['git commit --amend -C HEAD', { forme: 'index', pathspecs: [] }],
    ['git commit -C HEAD -m x -- src/a.ts', { forme: 'pathspec', pathspecs: ['src/a.ts'] }],
    ['git commit -c HEAD~1', { forme: 'index', pathspecs: [] }],
    ['git commit -aC HEAD', { forme: 'tout', pathspecs: [] }],
    ['git commit -t tmpl.txt', { forme: 'index', pathspecs: [] }],
    ['git commit -tmpl.txt', { forme: 'index', pathspecs: [] }],
    ['git commit --cleanup strip -m x', { forme: 'index', pathspecs: [] }],
    ['git commit -uall -m x', { forme: 'index', pathspecs: [] }],
    ['git commit -u -m x src/a.ts', { forme: 'pathspec', pathspecs: ['src/a.ts'] }],
    ['git commit -Salice -m x', { forme: 'index', pathspecs: [] }],
  ]) assert.deepEqual(formeDuCommit(commande), attendu, commande)
})

test('extractMessageSources : `-C <commit>` et `-t <modèle>` ne sont pas un fichier de message ; `-F` qui les suit l’est', () => {
  const lus = []
  const readFile = (p) => { lus.push(p); return 'corps' }
  assert.equal(extractMessageSources('git commit -C HEAD', { readFile, cwd: '/r' }).fileError ?? null, null)
  assert.equal(extractMessageSources('git commit -t modele.txt', { readFile, cwd: '/r' }).fileError ?? null, null)
  assert.deepEqual(lus, [])
  extractMessageSources('git commit -t modele.txt -F msg.txt', { readFile, cwd: '/r' })
  assert.equal(lus.length, 1)
  assert.match(lus[0], /msg\.txt$/)
})

test('formeDuCommit : "-am" est un `-a`, et son MESSAGE n\'est pas un pathspec', () => {
  const f = formeDuCommit('git commit -am "feat: refonte truc"')
  assert.deepEqual([f.forme, f.pathspecs], ['tout', []])
  const r = analyzeDiffDuCommit([entree(50, 20, 'src/ui/RollShell.tsx')])
  assert.deepEqual([r.touchesUi, r.totalLines], [true, 70])
})

// ── glob non résolu : jamais un scoping résolu à tort en "aucun fichier" ────────────────────────────
test('extractCommitPathspecs : pathspec avec glob ("src/**/*.tsx") → [] (index entier, jamais silencé)', () => {
  assert.deepEqual(extractCommitPathspecs('git commit -- "src/**/*.tsx" -m "x"'), [])
})

test('extractCommitPathspecs : un seul pathspec glob parmi plusieurs invalide TOUT le scoping', () => {
  const cmd = 'git commit -- src/ui/Foo.tsx "src/**/*.tsx" -m "x"'
  assert.deepEqual(extractCommitPathspecs(cmd), [])
})

// ── call-operator PowerShell (`& "C:\Program Files\Git\git.exe" commit ...`) ────────────────────────
test('isGitCommitCommand : call-operator PowerShell avec chemin absolu vers git.exe → true', () => {
  const cmd = '& "C:\\Program Files\\Git\\git.exe" commit -m "corrige #7"'
  assert.equal(isGitCommitCommand(cmd), true)
})

test('extractClosedIssues : call-operator PowerShell reconnu → ferme le ticket', () => {
  const cmd = '& "C:\\Program Files\\Git\\git.exe" commit -m "corrige #7"'
  assert.deepEqual(extractClosedIssues(cmd), [7])
})

test('isGitCommitCommand : call-operator sur un exécutable non-git → false', () => {
  const cmd = '& "C:\\Program Files\\gh\\gh.exe" issue create --body "git commit"'
  assert.equal(isGitCommitCommand(cmd), false)
})

// ── résiduel #591 : quote en MILIEU de bareword (`--message="..."`, `-m"..."` collé) ────────────────
test('tokenizeCommand (via extractCommitPathspecs) : "--message=" multi-mots ne fuit PAS en pathspecs', () => {
  const cmd = 'git commit --message="feat refonte ref #501"'
  assert.deepEqual(extractCommitPathspecs(cmd), [])
})

test('tokenizeCommand (via extractCommitPathspecs) : "-m" valeur COLLÉE (sans espace) ne fuit PAS en pathspecs', () => {
  const cmd = 'git commit -m"feat refonte ref #501"'
  assert.deepEqual(extractCommitPathspecs(cmd), [])
})

test('extractCommitPathspecs : "--message=solo" (mono-mot, déjà vert) reste []', () => {
  assert.deepEqual(extractCommitPathspecs('git commit --message=solo'), [])
})

test('extractCommitPathspecs : "--message=" APRÈS -- est un chemin, jamais un message', () => {
  const cmd = 'git commit -- src/ui/Foo.tsx --message="feat refonte ref #501"'
  assert.deepEqual(extractCommitPathspecs(cmd), ['src/ui/Foo.tsx', '--message=feat refonte ref #501'])
  assert.equal(evaluateAmendInvisible({ command: 'git commit --amend -- src/a.ts -m x', stagedTouchesSrc: true }) !== null, true,
    '`-m` après `--` ne porte aucun message')
})

test('extractCommitPathspecs : "-cam" groupé + valeur COLLÉE ("-cam\\"a b c\\"") reste []', () => {
  const cmd = 'git commit -cam"a b c"'
  assert.deepEqual(extractCommitPathspecs(cmd), [])
})

test('extractClosedIssues : "--message=" multi-mots reconnaît toujours le mot-clef de fermeture', () => {
  assert.deepEqual(extractClosedIssues('git commit --message="corrige #501 pour de bon"'), [501])
})

// ── evaluatePorteDuTicket (porte du ticket, option retenue le 2026-09-11) ───────────────────
const porte = (command, ...fichiersEmportes) => evaluatePorteDuTicket({ command, fichiersEmportes })

test('porte du ticket : un commit qui touche src/ sans aucun ticket est REFUSÉ, fichier nommé', () => {
  const d = porte('git commit -m "chore: une ligne de rien"', 'src/state/combatFlow.ts')
  assert.ok(d, 'un commit de substance sans ticket doit être refusé')
  assert.match(d.reason, /src\/state\/combatFlow\.ts/)
  assert.match(d.reason, /refs #N/)
  assert.match(d.reason, /2026-09-11/, 'le refus porte le verbatim daté du régime')
})

test('porte du ticket : `scripts/` est de la substance au même titre que `src/`', () => {
  assert.ok(porte('git commit -m "chore: outillage"', 'scripts/guards/lib/lister.mjs'))
})

test('porte du ticket : `refs #N` suffit, `corrige #N` aussi', () => {
  assert.equal(porte('git commit -m "feat: x (refs #1709)"', 'src/x.ts'), null)
  assert.equal(porte('git commit -m "feat: x (corrige #1709)"', 'src/x.ts'), null)
})

test('porte du ticket : docs/ et .claude/ seuls passent sans ticket (docs dérivés, mémoire)', () => {
  assert.equal(porte('git commit -m "chore(docs): régénéré"', 'docs/architecture.md'), null)
  assert.equal(porte('git commit -m "chore: fiche"', '.claude/memory/feedback-x.md', 'public/qc/a.png'), null)
})

test('porte du ticket : un fichier GÉNÉRÉ de src/ reste de la substance', () => {
  const d = porte('git commit -m "chore: regen"', 'src/data/schemas/_registry.generated.ts')
  assert.ok(d, 'un dérivé committé sous src/ est du contenu de src/ : il cite son ticket')
  assert.match(d.reason, /_registry\.generated\.ts/)
})

test('porte du ticket : un message que la commande NE PORTE PAS (éditeur, --amend) est dit comme tel', () => {
  for (const cmd of ['git commit', 'git commit -v', 'git commit -e', 'git commit --amend']) {
    const d = porte(cmd, 'src/x.ts')
    assert.ok(d, `${cmd} : refus attendu`)
    assert.match(d.reason, /part à l’ÉDITEUR \(ou est hérité par `--amend`\)/, cmd)
  }
  // Message LISIBLE et sans ticket : le refus ne parle plus d'éditeur, il manque un ticket, point.
  const lisible = porte('git commit -m "chore: une ligne de rien"', 'src/x.ts')
  assert.doesNotMatch(lisible.reason, /ÉDITEUR/)
  assert.equal(porte('git commit --amend -m "feat: x (refs #1709)"', 'src/x.ts'), null)
})

test('porte du ticket : ce qui n’est pas un `git commit` ne déclenche rien', () => {
  assert.equal(porte('gh issue create --body "touche src/x.ts sans ticket"', 'src/x.ts'), null)
  assert.equal(porte('git commit -m "chore: rien"'), null)
})

// ── evaluateAntiEsquive ──────────────────────────────────────────────────────────────────────────
const REFUTATION_LINE_OK = 'REFUTATION: un juge adversarial a rejoué le diff et tenté 2 contournements, aucun ne passe.'

test('evaluateAntiEsquive : pas un commit → silence', () => {
  assert.equal(evaluateAntiEsquive({ command: 'git status', stagedTouchesSrc: true, stagedTotalLines: 100 }), null)
})

test('evaluateAntiEsquive : diff ne touche pas src → silence', () => {
  const d = evaluateAntiEsquive({ command: 'git commit -m "ref #371 doc"', stagedTouchesSrc: false, stagedTotalLines: 100 })
  assert.equal(d, null)
})

test('evaluateAntiEsquive : diff < 10 lignes → silence (one-liner sur la suite verte)', () => {
  const d = evaluateAntiEsquive({ command: 'git commit -m "fix: typo, ref #371"', stagedTouchesSrc: true, stagedTotalLines: 9 })
  assert.equal(d, null)
})

test('evaluateAntiEsquive : fermeture déjà couverte par evaluate() → silence', () => {
  const d = evaluateAntiEsquive({ command: 'git commit -m "corrige #9"', stagedTouchesSrc: true, stagedTotalLines: 100 })
  assert.equal(d, null)
})

test('evaluateAntiEsquive : "ref #N" src touché sans réfutation → deny', () => {
  const d = evaluateAntiEsquive({
    command: 'git commit -m "feat: truc, ref #371"',
    stagedTouchesSrc: true,
    stagedTotalLines: 100,
    readRefFile: () => null,
  })
  assert.ok(d)
  assert.match(d.reason, /#371/)
  assert.match(d.reason, /ref-371\.md/)
})

test('evaluateAntiEsquive : "ref #N" avec ligne REFUTATION: inline valide → pass', () => {
  const d = evaluateAntiEsquive({
    command: `git commit -m "feat: truc, ref #371\n\n${REFUTATION_LINE_OK}"`,
    stagedTouchesSrc: true,
    stagedTotalLines: 100,
  })
  assert.equal(d, null)
})

test('evaluateAntiEsquive : "ref #N" avec ligne REFUTATION: trop courte → deny', () => {
  const d = evaluateAntiEsquive({
    command: 'git commit -m "feat: truc, ref #371\n\nREFUTATION: vu."',
    stagedTouchesSrc: true,
    stagedTotalLines: 100,
    readRefFile: () => null,
  })
  assert.ok(d)
})

test('evaluateAntiEsquive : "ref #N" avec fichier ref-N.md conforme → pass', () => {
  const d = evaluateAntiEsquive({
    command: 'git commit -m "feat: truc, ref #371"',
    stagedTouchesSrc: true,
    stagedTotalLines: 100,
    readRefFile: (n) => (n === 371 ? refFile() : null),
  })
  assert.equal(d, null)
})

test('evaluateAntiEsquive : "ref #N" avec fichier ref-N.md non conforme → deny', () => {
  const d = evaluateAntiEsquive({
    command: 'git commit -m "feat: truc, ref #371"',
    stagedTouchesSrc: true,
    stagedTotalLines: 100,
    readRefFile: (n) => (n === 371 ? refFile({ desc: 'ok.' }) : null),
  })
  assert.ok(d)
  assert.match(d.reason, /trop maigre/)
})

// Scope tranché #591 (2026-07-17) : le déclencheur REFUTATION ne porte QUE sur le ticket
// explicitement rattaché (fermeture ou `ref #N`) — un commit sans AUCUN ticket, même src/**
// substantiel, reste hors du mécanisme (ce n'était PAS le déclencheur d'origine, cf. en-tête).
test('evaluateAntiEsquive : aucun ticket rattaché (ni fermeture, ni ref #N), src touché → silence (#591)', () => {
  const d = evaluateAntiEsquive({
    command: 'git commit -m "feat: refonte truc"',
    stagedTouchesSrc: true,
    stagedTotalLines: 100,
    readRefFile: () => { throw new Error('ne doit pas être appelé — aucun ticket rattaché') },
  })
  assert.equal(d, null)
})

// ── validateJugeFile / validateJugeVisionFile ───────────────────────────────────────────────────────
const JUGE_OK = 'Un agent juge adversarial a rejoué le diff contre le DoD, tenté 2 contournements, aucun ne passe.'
const jugeFile = ({ desc = JUGE_OK } = {}) => `## Juge\n${desc}\n`
const jugeVisionFile = ({ desc = JUGE_OK } = {}) => `## Juge-Vision\n${desc}\n`

test('validateJugeFile : conforme', () => {
  const r = validateJugeFile(jugeFile())
  assert.equal(r.ok, true, r.problems.join(' ; '))
})

test('validateJugeFile : fichier absent', () => {
  assert.equal(validateJugeFile(null).ok, false)
})

test('validateJugeFile : section absente', () => {
  const r = validateJugeFile('## Réfutation\nverdict: CONFIRMÉ\nblabla suffisamment long pour passer.\n')
  assert.equal(r.ok, false)
  assert.match(r.problems.join(' ; '), /"## Juge" absente/)
})

test('validateJugeFile : section trop maigre', () => {
  const r = validateJugeFile(jugeFile({ desc: 'ok.' }))
  assert.equal(r.ok, false)
  assert.match(r.problems.join(' ; '), /trop maigre/)
})

test('validateJugeVisionFile : conforme', () => {
  const r = validateJugeVisionFile(jugeVisionFile())
  assert.equal(r.ok, true, r.problems.join(' ; '))
})

test('validateJugeVisionFile : section absente', () => {
  const r = validateJugeVisionFile(jugeFile())
  assert.equal(r.ok, false)
  assert.match(r.problems.join(' ; '), /"## Juge-Vision" absente/)
})

// ── evaluateJuge (extension REFUTATION → JUGE adversarial, générale à tout domaine) ────────────────
const JUGE_LINE_OK = 'JUGE: un agent juge adversarial a rejoué le diff contre le DoD, aucun contournement ne passe.'
const JUGE_VISION_LINE_OK = 'JUGE-VISION: captures fraîches jugées contre l\'attendu, mécanisme et pixels vérifiés.'

test('evaluateJuge : pas un commit → silence', () => {
  assert.equal(evaluateJuge({ command: 'git status', stagedTouchesSrc: true, stagedTotalLines: 100 }), null)
})

test('evaluateJuge : diff ne touche pas src → silence', () => {
  assert.equal(evaluateJuge({ command: 'git commit -m "ref #371 doc"', stagedTouchesSrc: false, stagedTotalLines: 100 }), null)
})

test('evaluateJuge : diff < 10 lignes → silence', () => {
  assert.equal(evaluateJuge({ command: 'git commit -m "fix: typo"', stagedTouchesSrc: true, stagedTotalLines: 9 }), null)
})

test('evaluateJuge : fermeture de ticket → silence (déjà couverte par le solde)', () => {
  assert.equal(evaluateJuge({ command: 'git commit -m "corrige #9"', stagedTouchesSrc: true, stagedTotalLines: 100 }), null)
})

// Scope tranché #591 : évaluateJuge partage EXACTEMENT le déclencheur d'evaluateAntiEsquive — un
// `ref #N` rattaché, jamais un commit sans ticket du tout.
test('evaluateJuge : aucun ticket rattaché, src touché → silence (#591)', () => {
  const d = evaluateJuge({
    command: 'git commit -m "feat: refonte truc"',
    stagedTouchesSrc: true,
    stagedTotalLines: 100,
    stagedTouchesUi: false,
    readRefFile: () => { throw new Error('ne doit pas être appelé — aucun ticket rattaché') },
  })
  assert.equal(d, null)
})

test('evaluateJuge : "ref #N" src touché sans ligne JUGE → deny', () => {
  const d = evaluateJuge({ command: 'git commit -m "feat: refonte truc, ref #501"', stagedTouchesSrc: true, stagedTotalLines: 100, stagedTouchesUi: false })
  assert.ok(d)
  assert.match(d.reason, /JUGE:/)
})

test('evaluateJuge : "ref #N" src touché avec ligne JUGE: valide, hors UI → pass', () => {
  const d = evaluateJuge({
    command: `git commit -m "feat: refonte truc, ref #501\n\n${JUGE_LINE_OK}"`,
    stagedTouchesSrc: true,
    stagedTotalLines: 100,
    stagedTouchesUi: false,
  })
  assert.equal(d, null)
})

test('evaluateJuge : "ref #N" ligne JUGE: trop courte → deny', () => {
  const d = evaluateJuge({ command: 'git commit -m "feat: truc, ref #501\n\nJUGE: vu."', stagedTouchesSrc: true, stagedTotalLines: 100 })
  assert.ok(d)
})

test('evaluateJuge : "ref #N" src/ui touché avec JUGE: seul (sans JUGE-VISION) → deny', () => {
  const d = evaluateJuge({
    command: `git commit -m "feat: bouton, ref #501\n\n${JUGE_LINE_OK}"`,
    stagedTouchesSrc: true,
    stagedTotalLines: 100,
    stagedTouchesUi: true,
  })
  assert.ok(d)
  assert.match(d.reason, /JUGE-VISION/)
})

test('evaluateJuge : "ref #N" src/ui touché avec JUGE: et JUGE-VISION: → pass', () => {
  const d = evaluateJuge({
    command: `git commit -m "feat: bouton, ref #501\n\n${JUGE_LINE_OK}\n${JUGE_VISION_LINE_OK}"`,
    stagedTouchesSrc: true,
    stagedTotalLines: 100,
    stagedTouchesUi: true,
  })
  assert.equal(d, null)
})

test('evaluateJuge : "ref #N" avec fichier ref-N.md portant "## Juge" conforme, hors UI → pass', () => {
  const d = evaluateJuge({
    command: 'git commit -m "feat: truc, ref #371"',
    stagedTouchesSrc: true,
    stagedTotalLines: 100,
    stagedTouchesUi: false,
    readRefFile: (n) => (n === 371 ? jugeFile() : null),
  })
  assert.equal(d, null)
})

test('evaluateJuge : "ref #N" UI touchée, fichier ref-N.md sans "## Juge-Vision" → deny', () => {
  const d = evaluateJuge({
    command: 'git commit -m "feat: truc, ref #371"',
    stagedTouchesSrc: true,
    stagedTotalLines: 100,
    stagedTouchesUi: true,
    readRefFile: (n) => (n === 371 ? jugeFile() : null),
  })
  assert.ok(d)
  assert.match(d.reason, /Juge-Vision/)
})

test('evaluateJuge : "ref #N" UI touchée, fichier ref-N.md avec "## Juge" ET "## Juge-Vision" → pass', () => {
  const d = evaluateJuge({
    command: 'git commit -m "feat: truc, ref #371"',
    stagedTouchesSrc: true,
    stagedTotalLines: 100,
    stagedTouchesUi: true,
    readRefFile: (n) => (n === 371 ? `${jugeFile()}\n${jugeVisionFile()}` : null),
  })
  assert.equal(d, null)
})

// ── extractMessageSources (message par fichier -F/--file, fix production 2026-07-14) ──────────────
test('extractMessageSources : pas de -F → texte = commande telle quelle', () => {
  const r = extractMessageSources('git commit -m "corrige #42"')
  assert.equal(r.text, 'git commit -m "corrige #42"')
  assert.equal(r.fileError, null)
})

test('extractMessageSources : -F <path> lu et concaténé', () => {
  const r = extractMessageSources('git commit -F commit-415.txt', {
    readFile: (p) => { assert.match(p, /commit-415\.txt$/); return 'corrige #415\n\ndétail' },
  })
  assert.equal(r.fileError, null)
  assert.match(r.text, /corrige #415/)
  assert.match(r.text, /git commit -F commit-415\.txt/)
})

test('extractMessageSources : --file=<path> (forme =) lu', () => {
  const r = extractMessageSources('git commit --file=commit-415.txt', {
    readFile: () => 'corrige #415',
  })
  assert.match(r.text, /corrige #415/)
})

test('extractMessageSources : --file <path> (forme espace) lu', () => {
  const r = extractMessageSources('git commit --file commit-415.txt', {
    readFile: () => 'corrige #415',
  })
  assert.match(r.text, /corrige #415/)
})

test('extractMessageSources : chemin quoté (doubles/simples) dépouillé avant lecture', () => {
  const seen = []
  extractMessageSources('git commit -F "commit 415.txt"', { readFile: (p) => { seen.push(p); return 'x' } })
  assert.match(seen[0], /commit 415\.txt$/)
  const seen2 = []
  extractMessageSources("git commit -F 'commit-415.txt'", { readFile: (p) => { seen2.push(p); return 'x' } })
  assert.match(seen2[0], /commit-415\.txt$/)
})

test('extractMessageSources : ligne REFUTATION: dans le fichier -F visible dans le texte', () => {
  const r = extractMessageSources('git commit -F commit-x.txt', {
    readFile: () => `feat: truc\n\n${REFUTATION_LINE_OK}`,
  })
  assert.match(r.text, /REFUTATION:/)
})

test('extractMessageSources : -F présent mais fichier illisible → fileError renseigné, texte = commande seule', () => {
  const r = extractMessageSources('git commit -F absent.txt', {
    readFile: () => { throw new Error('ENOENT') },
  })
  assert.equal(r.fileError, 'absent.txt')
  assert.equal(r.text, 'git commit -F absent.txt')
})

test('extractMessageSources : commande vide → texte vide, pas d\'erreur', () => {
  assert.deepEqual(extractMessageSources(''), { text: '', fileError: null, messages: [] })
})

// ── evaluate/evaluateAntiEsquive sur le texte étendu (-F) — intégration bout en bout ───────────────
test('intégration -F : fermeture via -F sans solde → deny', () => {
  const { text } = extractMessageSources('git commit -F commit-415.txt', { readFile: () => 'corrige #415' })
  const d = evaluate({ command: text, today: TODAY, readSoldes: parTicket(() => null) })
  assert.ok(d)
  assert.match(d.reason, /#415/)
})

test('intégration -F : fermeture via -F avec solde conforme → pass', () => {
  const { text } = extractMessageSources('git commit -F commit-415.txt', { readFile: () => 'corrige #415' })
  const d = evaluate({ command: text, today: TODAY, readSoldes: parTicket(() => solde()) })
  assert.equal(d, null)
})

test('intégration -F : REFUTATION: dans le fichier -F accepte l\'anti-esquive', () => {
  const { text } = extractMessageSources('git commit -F commit-x.txt', {
    readFile: () => `feat: refonte\n\n${REFUTATION_LINE_OK}`,
  })
  const d = evaluateAntiEsquive({ command: text, stagedTouchesSrc: true, stagedTotalLines: 100 })
  assert.equal(d, null)
})

// ── evaluateAmendInvisible (--amend sans -m/-F, message hérité invisible) ──────────────────────────
test('evaluateAmendInvisible : pas un commit → silence', () => {
  assert.equal(evaluateAmendInvisible({ command: 'git status', stagedTouchesSrc: true }), null)
})

test('evaluateAmendInvisible : pas --amend → silence', () => {
  assert.equal(evaluateAmendInvisible({ command: 'git commit -m "x"', stagedTouchesSrc: true }), null)
})

test('evaluateAmendInvisible : --amend avec -m → silence (message visible)', () => {
  assert.equal(evaluateAmendInvisible({ command: 'git commit --amend -m "corrige #9"', stagedTouchesSrc: true }), null)
})

test('evaluateAmendInvisible : --amend avec -F → silence (message visible via -F)', () => {
  assert.equal(evaluateAmendInvisible({ command: 'git commit --amend -F msg.txt', stagedTouchesSrc: true }), null)
})

test('evaluateAmendInvisible : --amend sans -m/-F, diff staged touche src → deny', () => {
  const d = evaluateAmendInvisible({ command: 'git commit --amend', stagedTouchesSrc: true })
  assert.ok(d)
  assert.match(d.reason, /--amend/)
})

// `-C`/`-c <commit>` reprennent le message d'un autre commit : invisible comme sous `--amend` (#1801).
test('evaluateAmendInvisible : `-C`/`-c <commit>`, graphies longues et abrégées comprises → deny', () => {
  for (const command of [
    'git commit -C HEAD', 'git commit -c HEAD', 'git commit --reuse-message=HEAD',
    'git commit --reedit-message HEAD', 'git commit --reus HEAD', 'git commit -qCHEAD',
  ]) {
    const d = evaluateAmendInvisible({ command, stagedTouchesSrc: true })
    assert.ok(d, command)
    assert.match(d.reason, /-C\/-c <commit>/, command)
  }
  assert.equal(evaluateAmendInvisible({ command: 'git commit -C HEAD --no-reuse-message -m x', stagedTouchesSrc: true }), null)
  assert.equal(evaluateAmendInvisible({ command: 'git commit -C HEAD', stagedTouchesSrc: false }), null)
})

// `--fixup`/`--squash <commit>` : le sujet du commit nommé reste en tête, même sous `-m`
// (`squash! <sujet>` puis le `-m`, sonde git 2.43) — échec fermé (#1801).
test('evaluateAmendInvisible : `--fixup`/`--squash <commit>` → deny, avec ou sans -m/-F', () => {
  for (const command of [
    'git commit --fixup HEAD', 'git commit --fixup=amend:HEAD', 'git commit --squash=HEAD', 'git commit --fix HEAD',
    'git commit --squash HEAD -m x', 'git commit --fixup HEAD -F msg.txt',
  ]) {
    assert.ok(evaluateAmendInvisible({ command, stagedTouchesSrc: true }), command)
  }
  assert.equal(evaluateAmendInvisible({ command: 'git commit --squash HEAD -m x', stagedTouchesSrc: false }), null)
})

test('evaluateAmendInvisible : --amend sans -m/-F, diff staged ne touche pas src → silence', () => {
  assert.equal(evaluateAmendInvisible({ command: 'git commit --amend', stagedTouchesSrc: false }), null)
})

// ── registres PORTEURS de ticket (prévention #434/#487, généralisée #1825) ────────────────────────
// Les chemins de registre sont INVENTÉS ici : recopier un chemin réel ferait de ce banc un second
// porteur de la liste, alors que la liste est de la DONNÉE (`registres-porteurs.json`, dont le banc
// de forme plus bas mesure qu'elle désigne des fichiers existants).
const REGISTRES_DE_FIXTURE = [
  { chemin: 'fixture/premier-registre.json', apres: 'npm run regenere-la-fixture' },
  { chemin: 'fixture/second-registre.json' },
]
const registreAvec = (...tickets) =>
  JSON.stringify(tickets.map((n) => ({ id: `dom#t${n}`, ticket: `#${n}` })), null, 2)
/** Le chemin de la LISTE elle-même : elle se lit par la MÊME couture que les registres qu'elle
 *  désigne — dans le contenu que le commit EMPORTE, pas sur le disque du script. */
const CHEMIN_DE_LA_LISTE = 'scripts/hooks/registres-porteurs.json'
/** Lit la fixture : la LISTE d'abord, puis `contenus[chemin]`, sinon `null` (aucun contenu emporté).
 *  `liste` accepte un TEXTE brut (pour jouer une liste cassée) ou `null` (liste absente du commit). */
const lecteurDe = (contenus, liste = REGISTRES_DE_FIXTURE) => (chemin) => {
  if (chemin === CHEMIN_DE_LA_LISTE) return typeof liste === 'string' || liste === null ? liste : JSON.stringify(liste, null, 2)
  return contenus[chemin] ?? null
}

test('ticketsDuRegistre : extrait les #N (ticket et bloque), dédupliqués', () => {
  const content = JSON.stringify([
    { id: 'a', ticket: '#508' },
    { id: 'b', ticket: '#508' },
    { id: 'c', bloque: 'attend #490 avant câblage' },
  ])
  assert.deepEqual([...ticketsDuRegistre(content)].sort((a, b) => a - b), [490, 508])
})

test('ticketsDuRegistre : null/vide → ensemble vide', () => {
  assert.equal(ticketsDuRegistre(null).size, 0)
  assert.equal(ticketsDuRegistre('').size, 0)
})

test('evaluateRegistresPorteurs : fermeture avec entrée encore présente → bloqué, et le refus NOMME le fichier', () => {
  const d = evaluateRegistresPorteurs({
    command: 'git commit -m "corrige #508"',
    lireRegistreEmporte: lecteurDe({ 'fixture/premier-registre.json': registreAvec(508) }),
  })
  assert.ok(d)
  assert.match(d.reason, /#508/)
  assert.match(d.reason, /fixture\/premier-registre\.json/)
  assert.match(d.reason, /npm run regenere-la-fixture/)
})

test('evaluateRegistresPorteurs : TOUT registre de la liste mord, pas seulement le premier', () => {
  const d = evaluateRegistresPorteurs({
    command: 'git commit -m "corrige #508"',
    lireRegistreEmporte: lecteurDe({ 'fixture/second-registre.json': registreAvec(508) }),
  })
  assert.ok(d)
  assert.match(d.reason, /fixture\/second-registre\.json/)
  // Aucune commande de régénération déclarée pour celui-ci : le refus n'en invente pas.
  assert.doesNotMatch(d.reason, /npm run/)
})

test('evaluateRegistresPorteurs : marque retirée dans le MÊME commit (contenu emporté sans #N) → passe', () => {
  const d = evaluateRegistresPorteurs({
    command: 'git commit -m "corrige #508"',
    lireRegistreEmporte: lecteurDe({ 'fixture/premier-registre.json': registreAvec(490) }), // #508 retiré
  })
  assert.equal(d, null)
})

// Un registre ABSENT du lot se lit quand même : `commit.contenu` rend alors le contenu de HEAD
// (forme `pathspec`) ou celui de l'index. Le garde ne se tait donc pas parce qu'un registre n'est
// pas dans le lot — c'est exactement ce qui laisserait fermer un ticket que HEAD porte encore.
test('evaluateRegistresPorteurs : registre hors du lot — le contenu lu (HEAD) mord comme avant', () => {
  const d = evaluateRegistresPorteurs({
    command: 'git commit -m "corrige #508" -- src/ailleurs.ts',
    lireRegistreEmporte: lecteurDe({ 'fixture/premier-registre.json': registreAvec(508) }),
  })
  assert.ok(d)
  assert.match(d.reason, /fixture\/premier-registre\.json/)
})

test('evaluateRegistresPorteurs : commit sans fermeture → intact (silence)', () => {
  const d = evaluateRegistresPorteurs({
    command: 'git commit -m "wip sur #508"',
    lireRegistreEmporte: lecteurDe({ 'fixture/premier-registre.json': registreAvec(508) }),
  })
  assert.equal(d, null)
})

test('evaluateRegistresPorteurs : #N porté par aucun registre → intact (silence)', () => {
  const d = evaluateRegistresPorteurs({
    command: 'git commit -m "corrige #999"',
    lireRegistreEmporte: lecteurDe({ 'fixture/premier-registre.json': registreAvec(508) }),
  })
  assert.equal(d, null)
})

test('evaluateRegistresPorteurs : multi-fermeture — seuls les tickets encore portés listés', () => {
  const d = evaluateRegistresPorteurs({
    command: 'git commit -m "corrige #508, ferme #999"',
    lireRegistreEmporte: lecteurDe({ 'fixture/premier-registre.json': registreAvec(508) }),
  })
  assert.ok(d)
  assert.match(d.reason, /#508/)
  assert.doesNotMatch(d.reason, /#999/)
})

// LA LISTE SE LIT DANS LE COMMIT, AU MOMENT DE L'ÉVALUATION. Lue à l'import et sans garde, une
// liste absente ou cassée faisait LEVER le module — le garde ENTIER muet, `exit 1`, stdout vide ;
// lue sous la racine du script, un commit de worktree était jugé avec la liste d'un autre arbre.
test('evaluateRegistresPorteurs : liste ABSENTE du commit → la FERMETURE refuse en nommant la cause', () => {
  const d = evaluateRegistresPorteurs({
    command: 'git commit -m "corrige #508"',
    lireRegistreEmporte: lecteurDe({ 'fixture/premier-registre.json': registreAvec(508) }, null),
  })
  assert.ok(d, 'une liste absente ne doit pas laisser fermer en silence')
  assert.match(d.reason, /#508/)
  assert.match(d.reason, new RegExp(CHEMIN_DE_LA_LISTE.replace(/[./]/g, '\\$&')))
  assert.match(d.reason, /absente du contenu emporté/)
})

test('evaluateRegistresPorteurs : liste au JSON CASSÉ → refus de fermeture, jamais une levée', () => {
  const d = evaluateRegistresPorteurs({
    command: 'git commit -m "corrige #508"',
    lireRegistreEmporte: lecteurDe({}, '[ { "chemin": '),
  })
  assert.ok(d)
  assert.match(d.reason, /JSON illisible/)
  // Une liste qui n'est pas un tableau est la même classe de panne, et se dit pareil.
  assert.match(
    evaluateRegistresPorteurs({ command: 'git commit -m "corrige #508"', lireRegistreEmporte: lecteurDe({}, '{}') }).reason,
    /n’est pas un tableau/,
  )
  // Et un commit qui ne FERME rien reste intact : la liste ne le concerne pas.
  assert.equal(
    evaluateRegistresPorteurs({ command: 'git commit -m "wip sur #508"', lireRegistreEmporte: lecteurDe({}, null) }),
    null,
  )
})

test('evaluateRegistresPorteurs : la liste NEUVE du commit jugé fait foi — pas celle d’un autre arbre', () => {
  // Le commit AJOUTE un registre porteur que la liste d'à côté ne connaît pas : c'est la sienne qui
  // juge. Lue hors du commit, cette entrée n'existerait pas et la fermeture passerait.
  const d = evaluateRegistresPorteurs({
    command: 'git commit -m "corrige #508"',
    lireRegistreEmporte: lecteurDe(
      { 'fixture/registre-tout-neuf.json': registreAvec(508) },
      [...REGISTRES_DE_FIXTURE, { chemin: 'fixture/registre-tout-neuf.json' }],
    ),
  })
  assert.ok(d)
  assert.match(d.reason, /fixture\/registre-tout-neuf\.json/)
})

// FORME de la liste elle-même : un chemin qui ne désigne rien rendrait la garde muette sur ce
// registre, en silence. CE QUE CE BANC NE PROUVE PAS, et que rien hors réseau ne peut prouver :
// qu'un `#N` porté par un registre désigne une issue OUVERTE — un numéro inventé passe la garde.
test('#1825 : chaque chemin de `registres-porteurs.json` désigne un fichier qui EXISTE', () => {
  const liste = JSON.parse(readFileSync(join(repoRoot(), 'scripts', 'hooks', 'registres-porteurs.json'), 'utf8'))
  assert.ok(Array.isArray(liste) && liste.length, 'la liste des registres porteurs est vide')
  const fautes = liste
    .filter((r) => !r || typeof r.chemin !== 'string' || !r.chemin || !existsSync(join(repoRoot(), r.chemin)))
    .map((r) => JSON.stringify(r))
  assert.deepEqual(fautes, [], `registre porteur introuvable :\n${fautes.join('\n')}`)
  const enTrop = liste.flatMap((r) => Object.keys(r).filter((k) => !['chemin', 'apres'].includes(k)))
  assert.deepEqual(enTrop, [], 'jeu de clés fermé : `chemin` (obligatoire), `apres` (facultatif)')
})

// ── extractTargetDir (répertoire cible du commit, fix #587) ───────────────────────────────────────
// Ces attendus mesurent la RÉSOLUTION du chemin sur des répertoires FABRIQUÉS : la sonde d'existence
// y est injectée à vrai. Qu'un chemin INEXISTANT ne serve pas de cwd est le contrat voisin
// (`cibleDeLaCommande`, #1729), mesuré plus bas sur un disque réel.
const TOUT_EXISTE = { existe: () => true }

test('extractTargetDir : "cd <path> && git commit" → résolu contre cwd, pas le cwd de la session', () => {
  const cwd = resolve('/repo/session')
  const dir = extractTargetDir('cd ../autre-worktree && git commit -m "corrige #5"', cwd, process.platform, TOUT_EXISTE)
  assert.equal(dir, resolve(cwd, '../autre-worktree'))
  assert.notEqual(dir, cwd)
})

test('extractTargetDir : pas de cd → cwd inchangé (comportement d\'origine hors worktree)', () => {
  const cwd = resolve('/repo/session')
  assert.equal(extractTargetDir('git commit -m "corrige #5"', cwd), cwd)
})

test('extractTargetDir : commande vide → cwd inchangé', () => {
  const cwd = resolve('/repo/session')
  assert.equal(extractTargetDir('', cwd), cwd)
  assert.equal(extractTargetDir(null, cwd), cwd)
})

test('extractTargetDir : chemin quoté avec espaces (doubles/simples) dépouillé avant résolution', () => {
  const cwd = resolve('/repo/session')
  const d1 = extractTargetDir('cd "../autre worktree" && git commit -m "corrige #5"', cwd, process.platform, TOUT_EXISTE)
  assert.equal(d1, resolve(cwd, '../autre worktree'))
  const d2 = extractTargetDir("cd '../autre worktree' && git commit -m \"corrige #5\"", cwd, process.platform, TOUT_EXISTE)
  assert.equal(d2, resolve(cwd, '../autre worktree'))
})

test('extractTargetDir : "git -C <path> commit" reconnu même sans cd', () => {
  const cwd = resolve('/repo/session')
  const dir = extractTargetDir('git -C ../autre-worktree commit -m "corrige #5"', cwd, process.platform, TOUT_EXISTE)
  assert.equal(dir, resolve(cwd, '../autre-worktree'))
})

test('extractTargetDir : chemin absolu résolu tel quel', () => {
  const cwd = resolve('/repo/session')
  const abs = resolve('/repo/autre-worktree')
  const dir = extractTargetDir(`cd ${abs} && git commit -m "corrige #5"`, cwd, process.platform, TOUT_EXISTE)
  assert.equal(dir, abs)
  assert.notEqual(abs, cwd)
})

test('extractMessageSources : « -F » en PROSE d un message -m n est pas un flag fichier (git refuse -m+-F — faux positif vécu 2026-07-14)', () => {
  const cmd = 'git commit -m "fix(hooks): les fermetures via -F et, pire, laissant passer — utiliser -m ou un chemin lisible"'
  const r = extractMessageSources(cmd, { readFile: () => { throw new Error('ne doit jamais être appelé') } })
  assert.equal(r.fileError, null)
  assert.equal(r.text, cmd)
})

// Le drapeau `-F` ne vaut QUE dans le segment qui exécute `git commit` (mesuré 2026-09-04 : deux
// refus « message de commit en fichier illisible » sur des commandes qui ne committent rien).
test('extractMessageSources : le -F de « gh api -X PATCH … -F corps=@fichier » n est PAS un message de commit', () => {
  const cmd = `gh api -X PATCH repos/${DEPOT}/issues/comments/42 -F body=@rapport.md`
  const r = extractMessageSources(cmd, { readFile: () => { throw new Error('ne doit jamais être appelé') } })
  assert.equal(r.fileError, null)
  assert.equal(r.text, cmd)
})

test('extractMessageSources : une ligne de todo qui CITE le drapeau ne cherche aucun fichier', () => {
  const cmd = 'echo "TODO : relire le message passé par -F avant de committer" >> notes.txt'
  const r = extractMessageSources(cmd, { readFile: () => { throw new Error('ne doit jamais être appelé') } })
  assert.equal(r.fileError, null)
})

test('extractMessageSources : « gh issue comment --body-file » n est pas un flag fichier de commit', () => {
  const cmd = `gh issue comment 1614 --repo ${DEPOT} --body-file rapport.md`
  const r = extractMessageSources(cmd, { readFile: () => { throw new Error('ne doit jamais être appelé') } })
  assert.equal(r.fileError, null)
})

test('extractMessageSources : un VRAI git commit -F sur un fichier absent reste REFUSÉ (fail-closed)', () => {
  const r = extractMessageSources('git commit -F absent.txt', {
    readFile: () => { throw new Error('ENOENT') },
  })
  assert.equal(r.fileError, 'absent.txt')
})

test('extractMessageSources : le -F d un `git commit` ENCHAÎNÉ derrière un `gh` est bien lu', () => {
  const r = extractMessageSources('gh issue view 1 --json body && git commit -F msg.txt', {
    readFile: () => 'corrige #1',
  })
  assert.match(r.text, /corrige #1/)
  assert.equal(r.fileError, null)
})

// ── repoRoot / read*File : ancrage à l'emplacement du script, pas au cwd du process ────────────────
// Constat de production : les hooks tournent avec `cwd` = celui de la commande qui les invoque
// (jamais garanti = racine du dépôt) — `resolve('.claude/soldes', ...)` (relatif à `cwd`) cherchait
// au mauvais endroit et le garde affirmait un solde "absent" alors qu'il existait.
test('repoRoot : résolu depuis l\'emplacement du script, retrouve la racine du dépôt même hors cwd', () => {
  const cwd = process.cwd()
  try {
    process.chdir(tmpdir())
    const root = repoRoot(import.meta.url)
    // scripts/hooks/solde-ticket-guard.test.mjs → ../.. = racine du dépôt (package.json y vit).
    // La preuve se LIT : une sonde par écriture pose un fichier NON SUIVI à la racine RÉELLE,
    // que `git status` de l'arbre principal montrerait — un test ne salit jamais l'arbre du dépôt.
    assert.equal(resolve(root), resolve(new URL('../../', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')))
    assert.equal(JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).name, 'warhammer-v4-rpg')
    assert.notEqual(resolve(root), resolve(process.cwd()), 'le cwd est tmpdir : la racine ne vient donc PAS de lui')
  } finally {
    process.chdir(cwd)
  }
})

// TOUT ce que le garde lit se lit dans le RÉPERTOIRE où le commit s'exécute, jamais dans le dépôt du
// HOOK : depuis un worktree, un solde ou une réfutation écrits là où l'on committe sont invisibles au
// dépôt qui porte le script, et la porte refuse à tort (mesuré 2026-09-04).
test('readSoldeFile/readRefFile : lisent le RÉPERTOIRE du commit, pas le dépôt du hook', () => {
  const fakeRepo = mkdtempSync(join(tmpdir(), 'solde-guard-fakerepo-'))
  const soldesDir = join(fakeRepo, '.claude', 'soldes')
  mkdirSync(soldesDir, { recursive: true })
  writeFileSync(join(soldesDir, '999.md'), 'solde-999')
  writeFileSync(join(soldesDir, 'ref-999.md'), 'ref-999')

  const elsewhere = mkdtempSync(join(tmpdir(), 'solde-guard-elsewhere-'))
  const cwd = process.cwd()
  try {
    process.chdir(elsewhere)
    assert.equal(readSoldeFile(999, fakeRepo), 'solde-999')
    assert.equal(readRefFile(999, fakeRepo), 'ref-999')
    // Ailleurs, rien : aucun de ces lecteurs ne retombe sur le dépôt qui porte le script.
    assert.deepEqual(
      [readSoldeFile(999, elsewhere), readRefFile(999, elsewhere)],
      [null, null],
    )
  } finally {
    process.chdir(cwd)
    rmSync(fakeRepo, { recursive: true, force: true })
    rmSync(elsewhere, { recursive: true, force: true })
  }
})

// ── Solde STAGÉ : la preuve citée par le message de commit doit entrer dans git ────────────────────
// Les messages de commit citent les soldes par chemin (`.claude/soldes/<N>.md`) ; un solde qui ne
// part pas dans le commit laisse une citation morte. Le garde lit donc l'INDEX, et nomme le cas
// « écrit mais non stagé » séparément de « jamais écrit ».
test('evaluate : solde STAGÉ conforme → silence (le commit passe)', () => {
  const d = evaluate({
    command: 'git commit -m "corrige #77"',
    today: TODAY,
    readSoldes: parTicket(() => solde()),
    soldeOnDisk: () => solde(),
  })
  assert.equal(d, null)
})

test('evaluate : solde conforme sur le DISQUE mais absent de l\'index → deny actionnable (git add)', () => {
  const d = evaluate({
    command: 'git commit -m "corrige #77"',
    today: TODAY,
    readSoldes: parTicket(() => null),
    soldeOnDisk: () => solde(),
  })
  assert.ok(d, 'un solde non emporté disparaîtrait après consommation : la citation du commit mourrait')
  assert.match(d.reason, /#77/)
  assert.match(d.reason, /NON EMPORTÉ par ce commit/)
  assert.match(d.reason, /git add \.claude\/soldes\/77\.md/)
  assert.match(d.reason, /pathspec n'emporte QUE ces chemins/, 'le geste du commit par pathspec est dit')
})

test('evaluate : ni index ni disque → "fichier absent" (jamais le message de staging)', () => {
  const d = evaluate({
    command: 'git commit -m "corrige #77"',
    today: TODAY,
    readSoldes: parTicket(() => null),
    soldeOnDisk: () => null,
  })
  assert.ok(d)
  assert.match(d.reason, /fichier absent/)
  assert.doesNotMatch(d.reason, /NON STAGÉ/)
})

// Le solde LU est celui que le commit EMPORTE, et cela dépend de la FORME de la commande : un solde
// stagé est emporté par un commit d'index, PAS par un commit qui nomme d'autres chemins (git y prend
// HEAD). Lire l'index dans tous les cas validait une preuve qui ne partait pas (sonde 2026-09-04).
test('diffDuCommit.contenu : le solde EMPORTÉ suit la forme — index oui, hors pathspec non', () => {
  const { racine: repo } = instanceDeDepot({ fichiers: { 'src/x.ts': 'export const a = 1\n' }, message: 'socle' })
  try {
    const git = gitDe(repo)
    mkdirSync(join(repo, '.claude', 'soldes'), { recursive: true })
    writeFileSync(join(repo, '.claude', 'soldes', '77.md'), 'solde-77-stage', 'utf8')
    writeFileSync(join(repo, '.claude', 'soldes', '78.md'), 'solde-78-disque', 'utf8')
    git('add', '--force', '.claude/soldes/77.md')

    const index = diffDuCommit('git commit -m "x"', repo)
    assert.equal(index.contenu('.claude/soldes/77.md'), 'solde-77-stage')
    assert.equal(index.contenu('.claude/soldes/78.md'), null)

    const parPathspec = diffDuCommit('git commit -m "x" -- src/x.ts', repo)
    assert.equal(
      parPathspec.contenu('.claude/soldes/77.md'), null,
      'stagé mais HORS pathspec : le commit ne l\'emporte pas, il garde la version de HEAD (absente)',
    )
    assert.equal(parPathspec.contenu('src/x.ts'), 'export const a = 1\n')

    writeFileSync(join(repo, '.claude', 'soldes', '77.md'), 'solde-77-arbre', 'utf8')
    const dansLePathspec = diffDuCommit('git commit -m "x" -- .claude/soldes', repo)
    assert.equal(
      dansLePathspec.contenu('.claude/soldes/77.md'), 'solde-77-arbre',
      'DANS le pathspec : c\'est l\'ARBRE DE TRAVAIL qui part, pas l\'index',
    )
  } finally {
    rmSync(repo, { recursive: true, force: true })
  }
})

test('diffDuCommit : sous `-i`/`--include`, l’INDEX hors pathspec part aussi — contenu et diff, pas HEAD', () => {
  const { racine: repo } = instanceDeDepot({ fichiers: { 'src/a.ts': 'export const a = 1\n', 'src/b.ts': 'export const b = 1\n' }, message: 'socle' })
  try {
    const git = gitDe(repo)
    writeFileSync(join(repo, 'src', 'b.ts'), 'export const b = 2\n', 'utf8')
    git('add', 'src/b.ts')
    writeFileSync(join(repo, 'src', 'a.ts'), 'export const a = 2\n', 'utf8')
    const lot = (c) => analyzeDiffDuCommit(c.numstat()).fichiers.sort()

    for (const commande of ['git commit -i -m "x" -- src/a.ts', 'git commit --include -m "x" src/a.ts']) {
      const inclus = diffDuCommit(commande, repo)
      assert.equal(inclus.forme, 'inclus', commande)
      assert.equal(inclus.contenu('src/b.ts'), 'export const b = 2\n', `${commande} : l’index hors pathspec part`)
      assert.equal(inclus.contenu('src/a.ts'), 'export const a = 2\n', `${commande} : l’arbre du pathspec part`)
      assert.deepEqual(lot(inclus), ['src/a.ts', 'src/b.ts'], commande)
      assert.match(inclus.diff(['src/b.ts']), /^\+export const b = 2$/m, commande)
    }

    const seul = diffDuCommit('git commit -o -m "x" -- src/a.ts', repo)
    assert.equal(seul.forme, 'pathspec')
    assert.equal(seul.contenu('src/b.ts'), 'export const b = 1\n', '`--only` : HEAD hors pathspec')
    assert.deepEqual(lot(seul), ['src/a.ts'])
  } finally {
    rmSync(repo, { recursive: true, force: true })
  }
})

test('diffDuCommit : sous `-i`, un renommage stagé qui TRAVERSE le pathspec garde ses deux bouts — comme `git show --numstat` après le commit', () => {
  const { racine: repo } = instanceDeDepot({ fichiers: { 'a.txt': 'un contenu assez long\npour être vu comme un renommage\n' }, message: 'socle' })
  try {
    const git = gitDe(repo)
    git('mv', 'a.txt', 'b.txt')
    const commande = 'git commit -i -m "x" -- b.txt'
    const c = diffDuCommit(commande, repo)
    assert.deepEqual(c.numstat(), [{ plus: 0, moins: 0, chemins: ['a.txt', 'b.txt'] }])
    assert.deepEqual([...c.renommages()], [['a.txt', 'b.txt']])
    git('commit', '-q', '-i', '-m', 'x', '--', 'b.txt')
    assert.equal(git('show', '--numstat', '--format=', 'HEAD'), '0\t0\ta.txt => b.txt\n', 'ce que git a emporté')
  } finally {
    rmSync(repo, { recursive: true, force: true })
  }
})

test('diffDuCommit : sous `diff.renames=copies`, une COPIE stagée se lit comme sans cette configuration — sous `-i`, son source reste l’INDEX, comme `git show --numstat --no-renames` après le commit', () => {
  const lignes = Array.from({ length: 20 }, (_, i) => `ligne ${i} du fichier a\n`).join('')
  const { racine: repo } = instanceDeDepot({ fichiers: { a: lignes }, message: 'socle' })
  try {
    const git = gitDe(repo)
    git('config', 'diff.renames', 'copies')
    writeFileSync(join(repo, 'c'), lignes)
    writeFileSync(join(repo, 'a'), `${lignes}x\n`)
    git('add', 'a', 'c')
    writeFileSync(join(repo, 'a'), `${lignes}x\ny\n`)
    const commande = 'git commit -i -m m -- c'
    const lu = diffDuCommit(commande, repo)
    assert.deepEqual(lu.numstat(), [{ plus: 20, moins: 0, chemins: ['c'] }, { plus: 1, moins: 0, chemins: ['a'] }])
    assert.doesNotMatch(lu.diff(['a']), /^\+y$/m, 'le `y` du disque ne part pas')
    assert.match(diffDuCommit('git commit -m m', repo).diff(['a', 'c']), /^\+ligne 0 du fichier a$/m, 'une copie se lit comme une naissance, ses lignes comprises')
    git('commit', '-q', '-i', '-m', 'm', '--', 'c')
    assert.equal(git('show', '--numstat', '--no-renames', '--format=', 'HEAD'), '1\t0\ta\n20\t0\tc\n', 'ce que git a emporté')
  } finally {
    rmSync(repo, { recursive: true, force: true })
  }
})

test('diffDuCommit : `diff()` rend en UN diff par côté tout ce que le commit emporte, et `images` lit par lot ce qui part et ce qui était', () => {
  const { racine: repo } = instanceDeDepot({ fichiers: { 'src/a.ts': 'export const a = 1\n', 'src/b.ts': 'export const b = 1\n' }, message: 'socle' })
  try {
    const git = gitDe(repo)
    writeFileSync(join(repo, 'src', 'a.ts'), 'export const a = 3\n', 'utf8')
    writeFileSync(join(repo, 'src', 'b.ts'), 'export const b = 2\n', 'utf8')
    git('add', 'src/a.ts', 'src/b.ts')
    writeFileSync(join(repo, 'src', 'a.ts'), 'export const a = 2\n', 'utf8')
    const ajouts = (d) => d.split('\n').filter((l) => /^\+[^+]/.test(l)).sort()

    const inclus = diffDuCommit('git commit -i -m "x" -- src/a.ts', repo)
    assert.deepEqual(ajouts(inclus.diff()), ['+export const a = 2', '+export const b = 2'], 'l’arbre du pathspec, l’index des autres, jamais l’index du pathspec')
    assert.deepEqual(ajouts(inclus.diff(['src/a.ts'])), ['+export const a = 2'])
    assert.equal(inclus.diff([]), '')
    const images = inclus.images(['src/a.ts', 'src/b.ts', 'src/absent.ts'])
    assert.deepEqual(['src/a.ts', 'src/b.ts', 'src/absent.ts'].map(images.lirePostImage), ['export const a = 2\n', 'export const b = 2\n', null])
    assert.deepEqual(['src/a.ts', 'src/b.ts', 'src/absent.ts'].map(images.lirePreImage), ['export const a = 1\n', 'export const b = 1\n', null])

    assert.deepEqual(ajouts(diffDuCommit('git commit -m "x"', repo).diff()), ['+export const a = 3', '+export const b = 2'], 'index')
    assert.deepEqual(ajouts(diffDuCommit('git commit -m "x" -- src/a.ts', repo).diff()), ['+export const a = 2'], 'pathspec')
    assert.deepEqual(ajouts(diffDuCommit('git commit -a -m "x"', repo).diff()), ['+export const a = 2', '+export const b = 2'], 'tout')
  } finally {
    rmSync(repo, { recursive: true, force: true })
  }
})

test('readChangedNames : le modifié NON stagé, et `diffDuCommit(…).stages()` le stagé — chemin non-ASCII et espace en clair', () => {
  const E = 'src/ui/Écran.ts'
  const B = 'src/mon module.ts'
  const { racine: repo } = instanceDeDepot({ fichiers: { [E]: 'export const e = 1\n', [B]: 'export const b = 1\n', 'src/x.ts': 'export const x = 1\n' }, message: 'socle' })
  try {
    const git = gitDe(repo)
    writeFileSync(join(repo, B), 'export const b = 2\n', 'utf8')
    git('add', B)
    writeFileSync(join(repo, E), 'export const e = 2\n', 'utf8')
    assert.deepEqual(readChangedNames(repo), [E])
    assert.deepEqual(diffDuCommit('git commit -m x', repo).stages(), [B])
  } finally {
    rmSync(repo, { recursive: true, force: true })
  }
})

// ── Plafond de restes ROUTÉS (skill orchestrer § Fermeture) ───────────────────────────────────────
// « une fermeture qui émettrait PLUS D'UN ticket de reste n'est PAS fermable : soit le lot GROSSIT
// pour absorber le reste, soit le ticket RESTE OUVERT ».
test('validateSolde : UN reste routé passe', () => {
  const r = validateSolde(solde({ restes: '- perf du picker -> #512' }), TODAY)
  assert.equal(r.ok, true, r.problems.join(' ; '))
})

test('validateSolde : DEUX restes routés → le ticket reste ouvert sur ce reste', () => {
  const restes = ['- perf du picker -> #512', '- flakiness réseau -> #513'].join('\n')
  const r = validateSolde(solde({ restes }), TODAY)
  assert.equal(r.ok, false)
  assert.match(r.problems.join(' ; '), /2 restes ROUTÉS/)
  assert.match(r.problems.join(' ; '), /le ticket reste ouvert sur ce reste/)
})

test('restesItems / restesRoutants : « RAS » global ne compte aucun item', () => {
  assert.deepEqual(restesItems(solde()), [])
  assert.deepEqual(
    restesRoutants(solde({ restes: '- a -> #1\n- b -> RAS : rien à faire ici, mesuré au grep' })),
    ['- a -> #1'],
  )
})

// ── « corrigé dans ce commit » : la correction se prouve à son SITE ───────────────────────────────
// Cas fondateur : le solde #584 déclarait « corrigé » un site (src/data/schemas/defs/teintesJeu.ts:88)
// réparé par un AUTRE commit (4d6e1ff78) que celui qui portait le solde (8a2807134) — le fichier
// n'était pas dans son diff.
test('validateSolde : « corrigé dans ce commit » sans fichier:ligne → refus', () => {
  const r = validateSolde(solde({ restes: '- typo doc -> corrigé dans ce commit' }), TODAY)
  assert.equal(r.ok, false)
  assert.match(r.problems.join(' ; '), /sans référence <fichier>:<ligne>/)
})

test('validateSolde : « corrigé dans ce commit » citant un fichier HORS du diff stagé → refus (cas #584)', () => {
  const restes = '- chemin mort cité -> corrigé dans ce commit (src/data/schemas/defs/teintesJeu.ts:88)'
  const r = validateSolde(solde({ restes }), TODAY, { fichiersEmportes: ['.claude/soldes/584.md'] })
  assert.equal(r.ok, false)
  assert.match(r.problems.join(' ; '), /teintesJeu\.ts, ABSENT de ce que ce commit emporte/)
})

test('validateSolde : « corrigé dans ce commit » citant une ligne HORS des hunks → refus', () => {
  const restes = '- chemin mort cité -> corrigé dans ce commit (src/data/schemas/defs/teintesJeu.ts:88)'
  const ctx = {
    fichiersEmportes: ['src/data/schemas/defs/teintesJeu.ts'],
    lignesEmportees: () => [12, 13],
  }
  const r = validateSolde(solde({ restes }), TODAY, ctx)
  assert.equal(r.ok, false)
  assert.match(r.problems.join(' ; '), /teintesJeu\.ts:88, hors des lignes que ce commit modifie/)
})

test('validateSolde : site cité présent dans le diff ET dans un hunk → passe', () => {
  const restes = '- chemin mort cité -> corrigé dans ce commit (src/data/schemas/defs/teintesJeu.ts:88)'
  const ctx = {
    fichiersEmportes: ['src/data/schemas/defs/teintesJeu.ts'],
    lignesEmportees: () => [87, 88, 89],
  }
  const r = validateSolde(solde({ restes }), TODAY, ctx)
  assert.equal(r.ok, true, r.problems.join(' ; '))
})

test('lignesDeHunks : les deux côtés du @@ sont recevables (une correction peut SUPPRIMER)', () => {
  const diff = [
    'diff --git a/x.ts b/x.ts',
    '@@ -10,0 +11,2 @@',
    '+une',
    '+deux',
    '@@ -40 +42 @@',
    '+trois',
  ].join('\n')
  // `-10,0` = ZÉRO ligne retirée (insertion APRÈS la 10) : le côté source n'apporte rien ici.
  assert.deepEqual(lignesDeHunks(diff), [11, 12, 40, 42])
  assert.deepEqual(lignesDeHunks(''), [])
})

test('lignesDeHunks : une SUPPRESSION pure rend les lignes DISPARUES (le chemin mort retiré se prouve)', () => {
  // `@@ -10,5 +9,0 @@` : cinq lignes retirées à partir de la 10, rien d'ajouté. Sans le côté source,
  // « corrigé dans ce commit (f:12) » sur ce geste était impossible à prouver.
  assert.deepEqual(lignesDeHunks('@@ -10,5 +9,0 @@\n-mort\n'), [10, 11, 12, 13, 14])
})

// ── Inventaire gaté ───────────────────────────────────────────────────────────────────────────────
test('validateSolde : « inventaire #<épic> » ne compte PAS comme un reste routé', () => {
  const restes = [
    '- classe hors périmètre -> inventaire #1679 : écart mesuré sur 4 sites, converti par classe',
    '- autre classe hors périmètre -> inventaire #1679 : écart mesuré sur 2 sites, converti par classe',
    '- vrai reste -> #512',
  ].join('\n')
  const r = validateSolde(solde({ restes }), TODAY)
  assert.equal(r.ok, true, r.problems.join(' ; '))
})

test('validateSolde : « inventaire » sans état lisible → refus', () => {
  const r = validateSolde(solde({ restes: '- classe -> inventaire #1679 : vu' }), TODAY)
  assert.equal(r.ok, false)
  assert.match(r.problems.join(' ; '), /sans état lisible/)
})

test('validateSolde : écart porté à un épic que CE COMMIT ferme → convertir en ticket par classe', () => {
  const restes = '- classe hors périmètre -> inventaire #1679 : écart mesuré sur 4 sites, à convertir'
  const r = validateSolde(solde({ restes }), TODAY, { issuesFermees: [1679] })
  assert.equal(r.ok, false)
  assert.match(r.problems.join(' ; '), /convertir en ticket par CLASSE avant la clôture/)
})

// ── Anti-tombale : le SCAN porte sur les COMMENTAIRES, jamais sur les chaînes ─────────────────────
const SRC_COMMENTAIRE = ['// Dette : le cas B reste à traiter (#4242)', 'export const x = 1', ''].join('\n')
const SRC_CHAINE = ["export const fixture = ['- dette : #4242']", ''].join('\n')
const SRC_PROVENANCE = ['// Contrat posé par #4242 : la table est ordonnée par identité.', 'export const y = 2', ''].join('\n')

test('tombalesDansSource : un commentaire de dette citant le ticket fermé est TROUVÉ', () => {
  const t = tombalesDansSource([4242], { fichiers: ['src/a.ts'], lire: () => SRC_COMMENTAIRE })
  assert.equal(t.length, 1)
  assert.equal(t[0].fichier, 'src/a.ts')
  assert.equal(t[0].ligne, 1)
})

test('tombalesDansSource : le MÊME motif dans une CHAÎNE n\'est pas un commentaire', () => {
  assert.deepEqual(tombalesDansSource([4242], { fichiers: ['src/b.ts'], lire: () => SRC_CHAINE }), [])
})

test('tombalesDansSource : citer la PROVENANCE d\'un choix (sans motif de dette) est toléré', () => {
  assert.deepEqual(tombalesDansSource([4242], { fichiers: ['src/c.ts'], lire: () => SRC_PROVENANCE }), [])
})

test('tombalesDansSource : hors périmètre de fichier (racine ou extension) → rien', () => {
  assert.deepEqual(tombalesDansSource([4242], { fichiers: ['server/relay.ts'], lire: () => SRC_COMMENTAIRE }), [])
  assert.deepEqual(tombalesDansSource([4242], { fichiers: ['src/data/spells.json'], lire: () => SRC_COMMENTAIRE }), [])
})

test('evaluateTombale : deny NOMMÉ fichier:ligne ; silence sans fermeture', () => {
  const d = evaluateTombale({ issuesFermees: [4242], fichiers: ['src/a.ts'], lire: () => SRC_COMMENTAIRE })
  assert.ok(d)
  assert.equal(d.decision, 'deny')
  assert.match(d.reason, /src\/a\.ts:1/)
  assert.equal(evaluateTombale({ issuesFermees: [], fichiers: ['src/a.ts'], lire: () => SRC_COMMENTAIRE }), null)
})

// ── Fermeture HORS commit ─────────────────────────────────────────────────────────────────────────
test('evaluateFermetureHorsCommit : `gh issue close` refusé, y compris derrière un sous-shell', () => {
  for (const cmd of [
    'gh issue close 1636 --comment "fait"',
    'bash -lc "gh issue close 1636"',
    'gh issue edit 1636 --state closed',
    `gh api repos/${DEPOT}/issues/1636 -X PATCH -f state=closed`,
    `gh api repos/${DEPOT}/issues/1636 --method PATCH --field state=closed`,
  ]) {
    const d = evaluateFermetureHorsCommit(cmd)
    assert.ok(d, `passé en silence : ${cmd}`)
    assert.deepEqual(Object.keys(d), ['reason'])
    assert.match(d.reason, /la fermeture passe par un commit/)
  }
})

test('evaluateFermetureHorsCommit : silence sur ce qui ne ferme pas', () => {
  for (const cmd of [
    'gh issue create --title "x" --body-file b.md',
    'gh issue view 1636 --json state',
    'gh issue edit 1636 --add-label bug',
    'git commit -m "corrige #1636"',
  ]) {
    assert.equal(evaluateFermetureHorsCommit(cmd), null, `mordu à tort : ${cmd}`)
  }
})

// ── `gh api --input <fichier>` : le corps de la requête est LU (abstention D6/a levée) ───────────
test('evaluateFermetureHorsCommit : un corps `--input` porteur de "state": "closed" est refusé', () => {
  const lire = () => JSON.stringify({ state: 'closed', state_reason: 'completed' })
  for (const cmd of [
    `gh api -X PATCH /repos/${DEPOT}/issues/1679 --input corps.json`,
    'gh api --method PATCH /repos/o/r/issues/1 --input=corps.json',
    'bash -lc "gh api -X PATCH /repos/o/r/issues/1 --input corps.json"',
  ]) {
    const d = evaluateFermetureHorsCommit(cmd, { lire })
    assert.ok(d, `passé en silence : ${cmd}`)
    assert.deepEqual(Object.keys(d), ['reason'])
    assert.match(d.reason, /la fermeture passe par un commit/)
  }
})

test('evaluateFermetureHorsCommit : les gestes `--input` qui ne peuvent pas FERMER passent en silence', () => {
  // Au PreToolUse le corps est souvent écrit APRÈS (par la commande elle-même) : refuser sur un
  // fichier absent mordrait 4 gestes routiniers (sonde J4). Le corps n'est lu que sur l'endpoint
  // d'UN ticket et une méthode qui ÉCRIT.
  const absent = () => { throw new Error('ENOENT') }
  for (const cmd of [
    `gh api repos/${DEPOT}/issues --input body.json`,
    'gh api graphql --input query.json',
    'gh api repos/o/r/issues --input filtre.json -X GET',
    'echo \'{"title":"x"}\' > body.json && gh api repos/o/r/issues --input body.json',
    'gh api repos/o/r/issues/1636 --input corps.json',
  ]) {
    assert.equal(evaluateFermetureHorsCommit(cmd, { lire: absent }), null, `mordu à tort : ${cmd}`)
  }
})

test('evaluateFermetureHorsCommit : un corps `--input` qui ne ferme pas passe ; `--input -` est HORS PORTÉE', () => {
  const ouvert = () => JSON.stringify({ body: 'commentaire' })
  assert.equal(evaluateFermetureHorsCommit('gh api -X PATCH /repos/o/r/issues/1 --input corps.json', { lire: ouvert }), null)
  // stdin : le corps n'existe nulle part avant l'exécution — silence DIT, jamais un refus muet.
  assert.equal(evaluateFermetureHorsCommit('gh api -X PATCH /repos/o/r/issues/1 --input -', {
    lire: () => { throw new Error('jamais lu') },
  }), null)
})

test('evaluateFermetureHorsCommit : sur l\'endpoint d\'UN ticket, un corps ILLISIBLE est refusé (fail-closed)', () => {
  const d = evaluateFermetureHorsCommit('gh api -X PATCH /repos/o/r/issues/1 --input absent.json', {
    lire: () => { throw new Error('ENOENT') },
  })
  assert.deepEqual(Object.keys(d ?? {}), ['reason'])
  assert.match(d.reason, /illisible ou non-JSON/)
  assert.match(d.reason, /absent\.json/)
})

// ── Nature de l'arbre ─────────────────────────────────────────────────────────────────────────────
test('natureDeLArbre : `.git` DOSSIER = principal, `.git` FICHIER = worktree lié', () => {
  const base = mkdtempSync(join(tmpdir(), 'solde-arbre-'))
  try {
    mkdirSync(join(base, 'principal', '.git'), { recursive: true })
    mkdirSync(join(base, 'principal', 'src'), { recursive: true })
    mkdirSync(join(base, 'lie'), { recursive: true })
    writeFileSync(join(base, 'lie', '.git'), 'gitdir: ../principal/.git/worktrees/lie\n', 'utf8')

    assert.equal(natureDeLArbre(join(base, 'principal')), 'dossier')
    assert.equal(natureDeLArbre(join(base, 'principal', 'src')), 'dossier', 'un sous-dossier remonte à son arbre')
    assert.equal(natureDeLArbre(join(base, 'lie')), 'fichier')
  } finally {
    rmSync(base, { recursive: true, force: true })
  }
})

// ── Chemin d'écriture résolu UNE fois ; hors du contenu versionné sur preuve positive seulement (#1973) ────
/** Graphie MSYS (`/c/Users/…`) d'un chemin win32 absolu. */
const versMsys = (p) => '/' + p[0].toLowerCase() + p.slice(2).replace(/\\/g, '/')
const ecriture = (file_path, opts) => cheminDEcriture({ file_path }, { base: tmpdir(), ...opts })

test('cheminDEcriture : dans un dépôt, racine + relatif, contenu versionné — graphie native ou MSYS', () => {
  const { racine } = instanceDeDepot()
  try {
    const cible = join(racine, 'src', 'data', 'x.json')
    const natif = ecriture(cible)
    assert.equal(natif.horsContenu, false)
    assert.equal(natif.relatif, 'src/data/x.json')
    assert.notEqual(natif.racine, null)
    if (process.platform === 'win32') assert.deepEqual(ecriture(versMsys(cible)), natif, 'MSYS = natif')
    assert.equal(cheminDEcriture({ path: cible }, { base: racine }).horsContenu, false, '`path` quand `file_path` manque')
  } finally {
    rmSync(racine, { recursive: true, force: true })
  }
})

test('cheminDEcriture : hors de tout arbre → `horsContenu`, graphie native, MSYS, ou relatif résolu contre `base`', () => {
  const scratch = mkdtempSync(join(tmpdir(), 'wfrp-scratch-'))
  const { racine } = instanceDeDepot()
  try {
    const vu = ecriture(join(scratch, 'note.md'))
    assert.equal(vu.horsContenu, true)
    assert.equal(vu.racine, null)
    if (process.platform === 'win32') assert.equal(ecriture(versMsys(join(scratch, 'note.md'))).horsContenu, true, 'MSYS')
    assert.equal(ecriture('note.md', { base: scratch }).horsContenu, true, 'relatif, base hors dépôt')
    assert.equal(ecriture('src/data/x.json', { base: racine }).horsContenu, false, 'relatif, base dans un dépôt')
  } finally {
    rmSync(scratch, { recursive: true, force: true })
    rmSync(racine, { recursive: true, force: true })
  }
})

test('cheminDEcriture : IGNORÉ par git → `horsContenu` ; un fichier SUIVI qu’un motif couvre reste du contenu', () => {
  const { racine } = instanceDeDepot({ fichiers: { 'public/suivi.json': '{}\n', '.gitignore': '.claude/*\n!.claude/memory/\n' } })
  try {
    // Le motif posé APRÈS le commit couvre un fichier déjà suivi : `git check-ignore` sans `--no-index`
    // ne le compte pas ignoré.
    writeFileSync(join(racine, '.gitignore'), '.claude/*\n!.claude/memory/\npublic/\n')
    const vu = ecriture(join(racine, '.claude', 'worktrees', 'agent-x', 'src', 'a.ts'))
    assert.equal(vu.horsContenu, true, 'worktree mort sous `.claude/`')
    assert.notEqual(vu.racine, null, 'dans un dépôt : le verdict vient de git, pas de la racine')
    assert.equal(ecriture(join(racine, '.claude', 'memory', 'x.md')).horsContenu, false, '`!.claude/memory/`')
    assert.equal(ecriture(join(racine, 'public', 'suivi.json')).horsContenu, false, 'suivi sous un motif')
    assert.equal(ecriture(join(racine, 'public', 'neuf.json')).horsContenu, true, 'neuf sous un motif')
    if (process.platform === 'win32') {
      assert.equal(ecriture(versMsys(join(racine, '.claude', 'worktrees', 'x.md'))).horsContenu, true, 'MSYS')
    }
  } finally {
    rmSync(racine, { recursive: true, force: true })
  }
})

test('cheminDEcriture : sans preuve positive, le hook garde — aucun chemin, lecteur absent', () => {
  assert.equal(cheminDEcriture({}, { base: tmpdir() }), null)
  assert.equal(ecriture(''), null)
  const absent = process.platform === 'win32'
    ? [...'ZYXWVUTSRQPONMLKJIHGFE'].find((l) => !existsSync(`${l}:\\`))
    : null
  if (absent) assert.equal(ecriture(`${absent}:\\nope\\x.json`).horsContenu, false, `lecteur ${absent}: absent`)
})

// ── `git commit -- <paths>` : l'ARBRE, pas l'index ────────────────────────────────────────────────
test('evaluateHunksEmportes : chemin nommé stagé ET modifié → deny', () => {
  const d = evaluateHunksEmportes({
    command: 'git commit -m "x" -- src/a.ts',
    fichiersModifies: ['src/a.ts', 'src/b.ts'],
    fichiersStages: ['src/a.ts'],
  })
  assert.ok(d)
  assert.deepEqual(Object.keys(d), ['reason'])
  assert.match(d.reason, /prend le contenu de l'ARBRE et ignore l'index/)
})

test('evaluateHunksEmportes : chemin nommé modifié SEULEMENT → contexte, jamais un refus', () => {
  const d = evaluateHunksEmportes({
    command: 'git commit -m "x" -- src/a.ts',
    fichiersModifies: ['src/a.ts'],
    fichiersStages: ['src/b.ts'],
  })
  assert.ok(d)
  assert.equal(d.reason, undefined)
  assert.match(d.contexte, /src\/a\.ts/)
})

test('evaluateHunksEmportes : commit NU (sans pathspec) → silence', () => {
  assert.equal(evaluateHunksEmportes({
    command: 'git commit -m "x"',
    fichiersModifies: ['src/a.ts'],
    fichiersStages: ['src/a.ts'],
  }), null)
})

// ── Écran touché : capture de recette visuelle (E1) ───────────────────────────────────────────────
test('estFichierEcran : src/ui et src/gameIso, jamais leurs tests', () => {
  assert.equal(estFichierEcran('src/ui/RollShell.tsx'), true)
  assert.equal(estFichierEcran('src/gameIso/stage/GameStage3D.tsx'), true)
  assert.equal(estFichierEcran('src/ui/RollShell.test.tsx'), false)
  assert.equal(estFichierEcran('src/engine/combat.ts'), false)
})

test('analyzeDiffDuCommit : src/gameIso/** compte comme écran', () => {
  const r = analyzeDiffDuCommit([entree(40, 5, 'src/gameIso/stage/GameStage3D.tsx')])
  assert.equal(r.touchesUi, true)
  assert.deepEqual(r.fichiers, ['src/gameIso/stage/GameStage3D.tsx'])
})

/** PNG plausible : signature + en-tête IHDR aux dimensions données, rembourré au poids voulu. */
function pngDe(largeur, hauteur, taille) {
  const buf = Buffer.alloc(Math.max(taille, 24))
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(buf, 0)
  buf.writeUInt32BE(13, 8)
  buf.write('IHDR', 12, 'ascii')
  buf.writeUInt32BE(largeur, 16)
  buf.writeUInt32BE(hauteur, 20)
  return buf
}

test('verifierCapture : une capture PLAUSIBLE passe ; les six défauts sont NOMMÉS', () => {
  const base = mkdtempSync(join(tmpdir(), 'solde-capture-'))
  try {
    mkdirSync(join(base, 'public', 'qc'), { recursive: true })
    writeFileSync(join(base, 'public', 'qc', 'ok.png'), pngDe(1280, 720, 4096))
    writeFileSync(join(base, 'public', 'qc', 'entete-seul.png'), pngDe(1280, 720, 24))
    writeFileSync(join(base, 'public', 'qc', 'vignette.png'), pngDe(64, 48, 4096))
    writeFileSync(join(base, 'public', 'qc', 'vide.png'), Buffer.alloc(0))
    writeFileSync(join(base, 'public', 'qc', 'faux.png'), 'ceci est du texte', 'utf8')

    assert.equal(verifierCapture('public/qc/ok.png', { racine: base }).ok, true)
    assert.match(verifierCapture('docs/ok.png', { racine: base }).problemes[0], /hors de public\/qc\//)
    assert.match(verifierCapture('public/qc/absente.png', { racine: base }).problemes[0], /introuvable/)
    assert.match(verifierCapture('public/qc/vide.png', { racine: base }).problemes[0], /ni un PNG ni un JPEG/)
    assert.match(verifierCapture('public/qc/faux.png', { racine: base }).problemes[0], /ni un PNG ni un JPEG/)
    // Le défaut qui passait AVANT le juge : un en-tête PNG de 8 octets était accepté.
    assert.match(verifierCapture('public/qc/entete-seul.png', { racine: base }).problemes.join(' ; '), /trop légère/)
    assert.match(verifierCapture('public/qc/vignette.png', { racine: base }).problemes.join(' ; '), /trop petite \(64×48 px/)
    const futur = Date.now() + 60_000
    assert.match(verifierCapture('public/qc/ok.png', { racine: base, mtimeMin: futur }).problemes[0], /plus ANCIENNE/)
  } finally {
    rmSync(base, { recursive: true, force: true })
  }
})

test('verifierCapture : une capture IGNORÉE par git est refusée, la même sous public/qc/soldes/ passe', () => {
  const base = mkdtempSync(join(tmpdir(), 'solde-capture-ignore-'))
  try {
    lancerGit(['init', '-q', '-b', 'main'], { cwd: base })
    writeFileSync(join(base, '.gitignore'), 'public/qc/*\n!public/qc/soldes/\n', 'utf8')
    mkdirSync(join(base, 'public', 'qc', 'soldes'), { recursive: true })
    writeFileSync(join(base, 'public', 'qc', 'ignoree.png'), pngDe(1280, 720, 4096))
    writeFileSync(join(base, 'public', 'qc', 'soldes', 'ok.png'), pngDe(1280, 720, 4096))

    // Le fichier EXISTE, est un PNG plausible et vient d'être écrit : seul son sort au commit le refuse.
    assert.match(
      verifierCapture('public/qc/ignoree.png', { racine: base }).problemes[0],
      /IGNORÉE par git/,
    )
    assert.equal(verifierCapture('public/qc/soldes/ok.png', { racine: base }).ok, true)
  } finally {
    rmSync(base, { recursive: true, force: true })
  }
})

test('validateSolde : un commit qui touche un ÉCRAN exige « ## Recette visuelle » et sa capture', () => {
  const sansSection = validateSolde(solde(), TODAY, { touchesUi: true })
  assert.equal(sansSection.ok, false)
  assert.match(sansSection.problems.join(' ; '), /"## Recette visuelle" absente/)

  const avecCapture = `${VERIFIE_OK}\n\n## Restes\nRAS\n\n## Recette visuelle\ncapture: public/qc/console.png\n\n## Réfutation\nverdict: CONFIRMÉ\n${REFUTATION_OK}\n\n(${TODAY})\n`
  const sansCapture = `${VERIFIE_OK}\n\n## Restes\nRAS\n\n## Recette visuelle\nj'ai regardé l'écran\n\n## Réfutation\nverdict: CONFIRMÉ\n${REFUTATION_OK}\n\n(${TODAY})\n`
  assert.match(
    validateSolde(sansCapture, TODAY, { touchesUi: true }).problems.join(' ; '),
    /sans ligne "capture: /,
  )
  const refuse = validateSolde(avecCapture, TODAY, {
    touchesUi: true,
    verifierCaptureDe: () => ({ ok: false, problemes: ['capture "public/qc/console.png" introuvable sur le disque'] }),
  })
  assert.equal(refuse.ok, false)
  assert.match(refuse.problems.join(' ; '), /introuvable/)
  assert.equal(validateSolde(avecCapture, TODAY, { touchesUi: true }).ok, true)
  assert.equal(validateSolde(solde(), TODAY, { touchesUi: false }).ok, true, 'aucun écran touché : rien n\'est exigé')
})

// Un en-tête de fichier énonce couramment une dette D'UN sujet et cite AILLEURS le ticket d'un
// AUTRE : les juger au BLOC rapprochait 206 paires dans l'arbre (mesuré 2026-09-02), à la LIGNE 57.
const SRC_ENTETE_MIXTE = [
  '/**',
  ' * Rapport GÉNÉRÉ. Le volet B reste non implémenté (#4242).',
  ' * Le classement par identité est celui posé par #4243.',
  ' */',
  'export const z = 3',
  '',
].join('\n')

test('tombalesDansSource : la dette et le ticket doivent tenir sur la MÊME ligne de commentaire', () => {
  const t = tombalesDansSource([4242, 4243], { fichiers: ['src/d.ts'], lire: () => SRC_ENTETE_MIXTE })
  assert.deepEqual(t.map((x) => `#${x.n}@${x.ligne}`), ['#4242@2'])
})

// ── « corrigé par <sha> <fichier>:<ligne> » : la correction est DÉJÀ dans l'histoire ──────────────
// Cas fondateur : `.claude/soldes/584.md:7` — le fix vit dans 4d6e1ff78, le solde a été écrit dans
// 8a2807134 ; « corrigé dans ce commit » y serait faux, « RAS » tairait une correction réelle.
const CORRIGE_PAR = '- chemin mort cité -> corrigé par 4d6e1ff78 src/data/schemas/defs/teintesJeu.ts:88'
const HISTOIRE_OK = {
  commitEstAncetre: () => true,
  fichiersDuCommit: () => ['src/data/schemas/defs/teintesJeu.ts', '.claude/soldes/revue-palier-2205fde51.md'],
  lignesDuCommit: () => [88],
}

test('validateSolde : « corrigé par <sha> » conforme (ancêtre de HEAD, touche le fichier cité)', () => {
  const r = validateSolde(solde({ restes: CORRIGE_PAR }), TODAY, HISTOIRE_OK)
  assert.equal(r.ok, true, r.problems.join(' ; '))
})

test('validateSolde : « corrigé par <sha> » ne compte PAS comme un reste routé', () => {
  assert.deepEqual(restesRoutants(solde({ restes: CORRIGE_PAR })), [])
})

test('validateSolde : « corrigé par <sha> » dont le sha n\'est PAS un ancêtre de HEAD → refus', () => {
  const r = validateSolde(solde({ restes: CORRIGE_PAR }), TODAY, { ...HISTOIRE_OK, commitEstAncetre: () => false })
  assert.equal(r.ok, false)
  assert.match(r.problems.join(' ; '), /n'est pas un ANCÊTRE de HEAD/)
})

test('validateSolde : « corrigé par <sha> » citant un fichier que le commit ne touche PAS → refus', () => {
  const r = validateSolde(solde({ restes: CORRIGE_PAR }), TODAY, { ...HISTOIRE_OK, fichiersDuCommit: () => ['docs/architecture.md'] })
  assert.equal(r.ok, false)
  assert.match(r.problems.join(' ; '), /teintesJeu\.ts:88, que ce commit ne touche PAS/)
})

test('validateSolde : « corrigé par <sha> » citant une LIGNE hors des hunks du commit → refus', () => {
  // La ligne se prouvait sur parole : « :999999 » passait tant que le FICHIER était touché (sonde
  // D1/P1.3), là où « corrigé dans ce commit » exigeait déjà le site exact.
  const restes = '- chemin mort cité -> corrigé par 4d6e1ff78 src/data/schemas/defs/teintesJeu.ts:999999'
  const r = validateSolde(solde({ restes }), TODAY, HISTOIRE_OK)
  assert.equal(r.ok, false)
  assert.match(r.problems.join(' ; '), /teintesJeu\.ts:999999, hors des lignes que ce commit y modifie/)
})

test('validateSolde : « corrigé par <sha> » dont le diff du fichier est VIDE ne tranche pas la ligne', () => {
  const r = validateSolde(solde({ restes: CORRIGE_PAR }), TODAY, { ...HISTOIRE_OK, lignesDuCommit: () => [] })
  assert.equal(r.ok, true, r.problems.join(' ; '))
})

test('validateSolde : « corrigé par » sans sha ni site reste hors grammaire', () => {
  const r = validateSolde(solde({ restes: '- chemin mort -> corrigé par 4d6e1ff78' }), TODAY, HISTOIRE_OK)
  assert.equal(r.ok, false)
  assert.match(r.problems.join(' ; '), /item sans disposition valide/)
})

test('validateSolde : « corrigé par <fusion> <fichier>:<ligne> » d’un travail AMENÉ par la fusion → refus (git réel)', () => {
  // Cas b780a99e7 : lue contre son premier parent, la fusion « touchait » 556 fichiers venus de main,
  // et la preuve d’un autre commit passait sous son sha.
  const { racine: depot } = instanceDeDepot({ fichiers: { 'src/a.ts': 'export const a = 1\n' }, message: 'socle' })
  const git = gitDe(depot)
  try {
    git('checkout', '-q', '-b', 'cote')
    writeFileSync(join(depot, 'src/a.ts'), 'export const a = 1\nexport const b = 2\n')
    git('commit', '-q', '-am', 'cote : b')
    const auteur = git('rev-parse', 'HEAD').trim()
    git('checkout', '-q', 'main')
    writeFileSync(join(depot, 'x.txt'), 'x\n')
    git('add', 'x.txt')
    git('commit', '-q', '-m', 'main : x')
    git('merge', '-q', '--no-ff', '-m', 'fusion', 'cote')
    const fusion = git('rev-parse', 'HEAD').trim()
    const histoire = { ...histoireDesCitations(depotDe(depot), [fusion.slice(0, 9), auteur.slice(0, 9)]), commitEstAncetre: () => true }
    const par = (sha) => validateSolde(solde({ restes: `- export b manquant -> corrigé par ${sha.slice(0, 9)} src/a.ts:2` }), TODAY, histoire)
    const refus = par(fusion)
    assert.equal(refus.ok, false)
    assert.match(refus.problems.join(' ; '), /src\/a\.ts:2, que ce commit ne touche PAS/)
    assert.equal(par(auteur).ok, true, 'le commit d’ORIGINE, lui, prouve la ligne')
    assert.equal(ceQueFaitLeCommit(depotDe(depot), fusion).diff(['src/a.ts']), '', 'la fusion n’a aucun hunk propre dans src/a.ts')
  } finally {
    rmSync(depot, { recursive: true, force: true })
  }
})

test('histoireDesCitations : le cas fondateur #584 tient contre git RÉEL', () => {
  // Un clone SUPERFICIEL (CI sans `fetch-depth: 0`) ne porte pas 4d6e1ff78 : le test doit dire QUOI
  // corriger, jamais verdir sur une histoire qu'il n'a pas lue.
  assert.equal(
    gitDeLArbreReel(repoRoot(), { net: true })('rev-parse', '--is-shallow-repository'),
    'false',
    'dépôt SUPERFICIEL : ce test lit l\'HISTOIRE — poser `fetch-depth: 0` sur le `actions/checkout` du job qui joue `test:hooks`.',
  )
  const histoire = histoireDesCitations(depotDe(repoRoot()), ['4d6e1ff78', '0000000000000000000000000000000000000000'])
  assert.equal(histoire.commitEstAncetre('4d6e1ff78'), true)
  assert.ok(
    histoire.fichiersDuCommit('4d6e1ff78').includes('src/data/schemas/defs/teintesJeu.ts'),
    '4d6e1ff78 ne touche pas le fichier que le solde #584 lui attribue',
  )
  assert.equal(histoire.commitEstAncetre('0000000000000000000000000000000000000000'), false)
  // La LIGNE que le solde #584 cite est bien dans un hunk de ce commit — lue au diff, pas sur parole.
  const lignes = histoire.lignesDuCommit('4d6e1ff78', 'src/data/schemas/defs/teintesJeu.ts')
  assert.ok(lignes.includes(88), `lignes vues : ${lignes.join(',')}`)
  assert.deepEqual(histoire.lignesDuCommit('4d6e1ff78', 'docs/architecture.md'), [])
})

test('le solde #584 de l\'arbre est CONFORME à sa propre grammaire', () => {
  // Même fail-loud que ci-dessus : sur un clone superficiel, ce solde serait déclaré FAUX alors que
  // c'est l'histoire qui manque.
  assert.equal(
    gitDeLArbreReel(repoRoot(), { net: true })('rev-parse', '--is-shallow-repository'),
    'false',
    'dépôt SUPERFICIEL : ce test lit l\'HISTOIRE — poser `fetch-depth: 0` sur le `actions/checkout` du job qui joue `test:hooks`.',
  )
  const contenu = readFileSync(join(repoRoot(), '.claude', 'soldes', '584.md'), 'utf8')
  assert.ok(shasCitesDuSolde(contenu).length > 0, 'témoin : le solde #584 cite par « corrigé par »')
  const r = validateSolde(contenu, '2026-09-02', histoireDesCitations(depotDe(repoRoot()), shasCitesDuSolde(contenu)))
  assert.equal(r.ok, true, r.problems.join(' ; '))
})

// ── C2/C3/C4/C5 : les règles resserrées après le juge de diff ─────────────────────────────────────
test('histoireDesCitations : un RENOMMAGE rend les deux chemins NUS, jamais « {ancien => nouveau} »', () => {
  // Mesuré sur 26be12347 : `.claude/soldes/revue-palier.md` renommée en `revue-palier-2205fde51.md`.
  // Sans `--no-renames`, `git show --name-only` ne rend que le nouveau chemin — un solde JUSTE au
  // chemin d'origine est refusé.
  const { racine: repo } = instanceDeDepot({ fichiers: { 'src/ancien.ts': 'export const a = 1\n'.repeat(20) }, message: 'socle' })
  try {
    const git = gitDe(repo)
    lancerGit(['mv', 'src/ancien.ts', 'src/nouveau.ts'], { cwd: repo })
    git('commit', '-q', '--no-verify', '-am', 'renomme')
    const sha = git('rev-parse', 'HEAD').trim()

    const touches = histoireDesCitations(depotDe(repo), [sha]).fichiersDuCommit(sha)
    assert.ok(touches.includes('src/nouveau.ts'), `chemins rendus : ${JSON.stringify(touches)}`)
    assert.ok(touches.includes('src/ancien.ts'), `chemins rendus : ${JSON.stringify(touches)}`)
    assert.deepEqual(touches.filter((f) => f.includes('=>')), [], 'un chemin agrégé « {a => b} » reste illisible pour un solde')
  } finally {
    rmSync(repo, { recursive: true, force: true })
  }
})

test('histoireDesCitations : une FUSION propre ne touche rien — le correctif appartient au commit de la branche', () => {
  const { racine: repo } = instanceDeDepot({ fichiers: { 'src/branche.ts': 'export const b = 1\n', 'src/principal.ts': 'export const p = 1\n' }, message: 'socle' })
  try {
    const git = gitDe(repo)
    git('checkout', '-q', '-b', 'chantier')
    writeFileSync(join(repo, 'src', 'branche.ts'), 'export const b = 2\n')
    git('commit', '-q', '--no-verify', '-am', 'le correctif')
    git('checkout', '-q', 'main')
    writeFileSync(join(repo, 'src', 'principal.ts'), 'export const p = 2\n')
    git('commit', '-q', '--no-verify', '-am', 'la ligne principale avance')
    git('merge', '-q', '--no-ff', '--no-verify', '-m', 'fusion du chantier', 'chantier')
    const fusion = git('rev-parse', 'HEAD').trim()

    const histoire = histoireDesCitations(depotDe(repo), [fusion, `${fusion}^2`])
    assert.deepEqual(histoire.fichiersDuCommit(fusion), [])
    assert.deepEqual(histoire.fichiersDuCommit(`${fusion}^2`), ['src/branche.ts'])
  } finally {
    rmSync(repo, { recursive: true, force: true })
  }
})

test('histoireDesCitations : le commit cité se lit UNE fois, pour ses chemins ET ses lignes (#2294)', () => {
  const { racine: repo } = instanceDeDepot({ fichiers: { 'src/a.ts': 'export const a = 1\n' }, message: 'socle' })
  try {
    writeFileSync(join(repo, 'src', 'a.ts'), 'export const a = 2\n')
    const git = gitDe(repo, { net: true })
    git('commit', '-q', '--no-verify', '-am', 'le correctif')
    const sha = git('rev-parse', 'HEAD')
    const { lances } = lancesDeGit(() => {
      const histoire = histoireDesCitations(depotReel(repo), [sha])
      assert.deepEqual(histoire.fichiersDuCommit(sha), ['src/a.ts'])
      assert.ok(histoire.lignesDuCommit(sha, 'src/a.ts').includes(1))
      assert.throws(() => histoire.fichiersDuCommit('deadbee'), /n'est aucun des shas annoncés/)
    })
    assert.equal(lances.filter((args) => args.includes('rev-list')).length, 1, `lancements : ${JSON.stringify(lances)}`)
  } finally {
    rmSync(repo, { recursive: true, force: true })
  }
})

test('GARDE DE CLASSE : histoireDesCitations lit K = 1 ou 8 shas DISTINCTS cités, chacun cité 1 ou 3 fois, en autant de processus git (#2294)', () => {
  const { racine: repo } = instanceDeDepot({ fichiers: { 'src/socle.ts': 'export const s = 1\n' }, message: 'socle' })
  try {
    const git = gitDe(repo, { net: true })
    const shas = Array.from({ length: 8 }, (_, i) => {
      writeFileSync(join(repo, 'src', `f${i}.ts`), `export const a${i} = 1\n`)
      git('add', '-A')
      git('commit', '-q', '--no-verify', '-m', `f${i}`)
      return git('rev-parse', 'HEAD')
    })
    const lectures = (k, fois) => {
      const cites = shas.slice(0, k)
      const { lances } = lancesDeGit(() => {
        const histoire = histoireDesCitations(depotReel(repo), cites.flatMap((sha) => Array(fois).fill(sha)))
        for (let n = 0; n < fois; n += 1) {
          cites.forEach((sha, i) => {
            assert.equal(histoire.commitEstAncetre(sha), true)
            assert.deepEqual(histoire.fichiersDuCommit(sha), [`src/f${i}.ts`])
            assert.deepEqual(histoire.lignesDuCommit(sha, `src/f${i}.ts`), [1], 'témoin : la ligne 1 du fichier est ajoutée')
          })
        }
      })
      assert.ok(lances.length > 0, 'témoin : le compte voit les processus de la lecture')
      return lances.map(sousCommande)
    }
    const un = lectures(1, 1)
    for (const [k, fois] of [[8, 1], [1, 3], [8, 3]]) assert.deepEqual(lectures(k, fois), un, `K = ${k}, cité ${fois} fois`)
  } finally {
    rmSync(repo, { recursive: true, force: true })
  }
})

test('verifierCaptures : le sort au commit de 1 ou 3 captures se lit en UN processus git (#2294)', () => {
  const { racine: repo } = instanceDeDepot({ fichiers: { '.gitignore': 'public/qc/*\n!public/qc/soldes/\n' }, message: 'socle' })
  try {
    mkdirSync(join(repo, 'public', 'qc', 'soldes'), { recursive: true })
    const captures = ['public/qc/soldes/a.png', 'public/qc/ignoree.png', 'public/qc/soldes/b.png']
    for (const c of captures) writeFileSync(join(repo, c), pngDe(1280, 720, 4096))
    const juger = (chemins) => {
      const { valeur: vus, lances } = lancesDeGit(() => verifierCaptures(chemins, { racine: repo, depot: depotReel(repo) }))
      return { lances, verdicts: chemins.map((c) => vus.get(c).ok) }
    }
    const une = juger(captures.slice(0, 1))
    const trois = juger(captures)
    assert.deepEqual(une.verdicts, [true])
    assert.deepEqual(trois.verdicts, [true, false, true], 'témoin : la capture ignorée est refusée, les deux autres passent')
    assert.equal(trois.lances.length, 1, `lancements : ${JSON.stringify(trois.lances)}`)
    assert.deepEqual(trois.lances, une.lances)
  } finally {
    rmSync(repo, { recursive: true, force: true })
  }
})

test('une FUSION ILLISIBLE (le blob d’un côté manque) : la citation la NOMME, jamais « sans apport » (#2294)', () => {
  const lignes = (n, i, l) => Array.from({ length: n }, (_, k) => (k === i ? l : `l${k}`)).join('\n') + '\n'
  const { racine: repo } = instanceDeDepot({ fichiers: { 'src/m.txt': lignes(9, -1), 'scripts/racine.txt': 'r\n' }, message: 'socle' })
  try {
    const git = gitDe(repo, { net: true })
    const ecrire = (rel, texte) => { mkdirSync(join(repo, rel, '..'), { recursive: true }); writeFileSync(join(repo, rel), texte) }
    const commit = (m) => { git('add', '-A'); git('commit', '-q', '--no-verify', '-m', m); return git('rev-parse', 'HEAD') }
    // Une fusion SAINE retouchée, puis la fusion MUTILÉE : les deux côtés changent src/m.txt, et le
    // blob du côté `b` manque — git ne sait plus la rejouer.
    git('checkout', '-q', '-b', 'a'); ecrire('notes/a.md', 'a\n'); commit('a')
    git('checkout', '-q', 'main'); ecrire('notes/a2.md', 'a\n'); commit('a2')
    git('merge', '-q', '--no-ff', '--no-commit', 'a'); ecrire('src/retouche.txt', 'r\n'); commit('fusion saine')
    git('checkout', '-q', '-b', 'b'); ecrire('src/m.txt', lignes(9, 0, 'b0')); commit('b')
    const blob = git('rev-parse', 'HEAD:src/m.txt')
    git('checkout', '-q', 'main'); ecrire('src/m.txt', lignes(9, 8, 'm8')); commit('m')
    git('merge', '-q', '--no-ff', '--no-commit', 'b'); ecrire('src/r.txt', 'r\n')
    const mutilee = commit('fusion mutilée')
    rmSync(join(repo, '.git', 'objects', blob.slice(0, 2), blob.slice(2)))
    const illisible = new RegExp(`fusion automatique de fusion [0-9a-f]{9}(?:, fusion [0-9a-f]{9})* illisible : .*unable to read blob object ${blob}`)
    const fermer = { command: 'git commit -m "corrige #1"', today: TODAY }

    const pannes = []
    const depot = depotDe(repo, { env: envDeDepotForge(), enPanne: (r) => pannes.push(r) })
    const pannesDeCitation = []
    const jugee = jugerOuConfier(() => evaluate({
      ...fermer,
      readSoldes: parTicket(() => solde({ restes: `- reste -> corrigé par ${mutilee.slice(0, 9)} src/r.txt:1` })),
      contexteSolde: { histoireDe: (shas) => histoireDesCitations(depot, shas) },
    }), pannesDeCitation)
    assert.equal(jugee, null, 'une lecture illisible ne juge rien : elle va aux pannes')
    const parCitation = refusDesPannes(pannesDeCitation)
    assert.match(parCitation?.reason ?? '', /^⛔ lecture git indisponible : /, JSON.stringify(parCitation))
    assert.match(parCitation.reason, illisible)
  } finally {
    rmSync(repo, { recursive: true, force: true })
  }
})

test('evaluate : les captures et les shas cités de TOUS les soldes se demandent en UNE question (#2294)', () => {
  const captureDe = (n) => `${VERIFIE_OK}\n\n## Restes\nRAS\n\n## Recette visuelle\ncapture: public/qc/soldes/${n}.png\n\n## Réfutation\nverdict: CONFIRMÉ\n${REFUTATION_OK}\n\n(${TODAY})\n`
  const lots = []
  const avecCaptures = evaluate({
    command: 'git commit -m "corrige #1 ; corrige #2 ; corrige #3"',
    today: TODAY,
    readSoldes: parTicket(captureDe),
    contexteSolde: {
      touchesUi: true,
      verifierCapturesDe: (chemins) => { lots.push(chemins); return new Map(chemins.map((c) => [c, { ok: true, problemes: [] }])) },
    },
  })
  assert.equal(avecCaptures, null, 'témoin : les trois soldes sont conformes')
  assert.deepEqual(lots, [[1, 2, 3].map((n) => `public/qc/soldes/${n}.png`)])

  const citesPar = (n) => [`aaaaaaa${n}1`, `aaaaaaa${n}2`]
  const citations = []
  const avecCitations = evaluate({
    command: 'git commit -m "corrige #1 ; corrige #2 ; corrige #3"',
    today: TODAY,
    readSoldes: parTicket((n) => solde({ restes: citesPar(n).map((sha) => `- reste ${sha} -> corrigé par ${sha} src/a.ts:2`).join('\n') })),
    contexteSolde: {
      histoireDe: (shas) => {
        citations.push(shas)
        return { commitEstAncetre: () => true, fichiersDuCommit: () => ['src/a.ts'], lignesDuCommit: () => [2] }
      },
    },
  })
  assert.equal(avecCitations, null, 'témoin : les trois soldes sont conformes')
  assert.deepEqual(citations, [[1, 2, 3].flatMap(citesPar)])
})

test('soldesEmportes : 1 ou 3 soldes se lisent en autant de processus git (#2294)', () => {
  const { racine: repo } = instanceDeDepot({ fichiers: { 'README.md': 'r\n' }, message: 'socle' })
  try {
    mkdirSync(join(repo, '.claude', 'soldes'), { recursive: true })
    for (const n of [1, 2, 3]) writeFileSync(join(repo, '.claude', 'soldes', `${n}.md`), `solde ${n}\n`)
    lancerGit(['add', '-A'], { cwd: repo })
    const lire = (lecture) => lancesDeGit(() => lecture(diffDuCommit('git commit -m "corrige #1"', repo, { depot: depotReel(repo) })))
    const unSolde = lire((c) => soldesEmportes(c, [1]))
    const troisSoldes = lire((c) => soldesEmportes(c, [1, 2, 4]))
    assert.deepEqual(unSolde.valeur, ['solde 1\n'])
    assert.deepEqual(troisSoldes.valeur, ['solde 1\n', 'solde 2\n', null], 'témoin : un solde absent du commit est null')
    assert.ok(unSolde.lances.length > 0, 'témoin : le compte voit les processus de la lecture des soldes')
    assert.deepEqual(troisSoldes.lances, unSolde.lances, `1 solde : ${unSolde.lances.length} processus ; 3 : ${troisSoldes.lances.length}`)
  } finally {
    rmSync(repo, { recursive: true, force: true })
  }
})

test('EXEMPTIONS_TOMBALE : stock NOMINATIF au site, borné, chaque entrée justifiée', () => {
  assert.ok(EXEMPTIONS_TOMBALE.length <= 5, `stock d'exemption à ${EXEMPTIONS_TOMBALE.length} — il DÉCROÎT`)
  for (const { site, raison } of EXEMPTIONS_TOMBALE) {
    assert.match(site, /^[\w./-]+:\d+$/, `exemption non ancrée à un SITE : "${site}" (jamais un fichier entier)`)
    assert.ok(raison.length >= 30, `exemption "${site}" sans raison lisible`)
  }
  assert.equal(new Set(EXEMPTIONS_TOMBALE.map((e) => e.site)).size, EXEMPTIONS_TOMBALE.length)
})

test('tombalesDansSource : un mot d\'ÉTAT du domaine n\'est pas une dette', () => {
  const etat = ['/** Ouverture cérémonielle EN ATTENTE (#4242) — posée par loadProject. */', 'const x = 1', ''].join('\n')
  const regle = ['/** Départ BLOQUÉ par la porte d\'heure maison (#4242) ? */', 'const y = 2', ''].join('\n')
  assert.deepEqual(tombalesDansSource([4242], { fichiers: ['src/a.ts'], lire: () => etat }), [])
  assert.deepEqual(tombalesDansSource([4242], { fichiers: ['src/b.ts'], lire: () => regle }), [])
})

test('tombalesDansSource : une dette DÉCLARÉE ÉTEINTE sur la ligne n\'en est plus une', () => {
  const eteinte = ['// dette #4242, résorbée par le renommage du champ', 'const x = 1', ''].join('\n')
  const vivante = ['// dette #4242 : le cas B reste à traiter', 'const y = 2', ''].join('\n')
  assert.deepEqual(tombalesDansSource([4242], { fichiers: ['src/a.ts'], lire: () => eteinte }), [])
  assert.equal(tombalesDansSource([4242], { fichiers: ['src/b.ts'], lire: () => vivante }).length, 1)
})

test('estFichierEcran : borné au RENDU — un module de calcul sous src/ui n\'est pas un écran', () => {
  assert.equal(estFichierEcran('src/ui/breakdown.ts'), false)
  assert.equal(estFichierEcran('src/gameIso/builders/walls.ts'), false)
  assert.equal(estFichierEcran('src/ui/styles/tabs.css'), true)
  assert.equal(estFichierEcran('src/engine/tables.ts'), false)
})

test('evaluateHunksEmportes : `git commit -a` emporte TOUT le modifié suivi → contexte nommé', () => {
  const d = evaluateHunksEmportes({
    command: 'git commit -am "x"',
    fichiersModifies: ['src/a.ts', 'src/b.ts'],
    fichiersStages: ['src/a.ts'],
  })
  assert.ok(d, '`-a` passé en silence')
  assert.equal(d.reason, undefined, 'jamais un refus : `-a` est un geste légitime')
  assert.match(d.contexte, /src\/b\.ts/)
  assert.doesNotMatch(d.contexte, /src\/a\.ts/, 'ce que l\'index porte déjà n\'est pas une surprise')
  assert.equal(evaluateHunksEmportes({ command: 'git commit -a -m "x"', fichiersModifies: [], fichiersStages: [] }), null)
})

// ── L'ASCENDANCE INDISPONIBLE n'est pas un « non » (#1679 L3 T2) ─────────────────────────────────
// `histoireDeHead(depot).commits` rend `null` pour un sha INCONNU, jamais pour une lecture qui n'a
// pas eu lieu : sans cela, hors dépôt ou git absent, le refus dirait « ce commit n'est pas dans cette
// histoire » — un motif faux.
test('histoireDeHead(…).commits HORS dépôt : JETTE une indisponibilité nommée, ne rend pas null', () => {
  const hors = mkdtempSync(join(tmpdir(), 'hors-depot-'))
  try {
    assert.throws(() => histoireDeHead(depotDe(hors)).commits(['4d6e1ff78']), (e) => {
      assert.ok(e instanceof GitIndisponible)
      assert.match(e.raison, /not a git repository/i)
      return true
    })
  } finally {
    rmSync(hors, { recursive: true, force: true })
  }
})

test('jugerOuConfier / refusDesPannes : une lecture indisponible va aux pannes, qui font UN refus NOMMÉ ; toute autre erreur remonte', () => {
  const pannes = ['fatal: feinte cat-file']
  assert.equal(jugerOuConfier(() => { throw new GitIndisponible('fatal: feinte cat-file') }, pannes), null)
  assert.equal(jugerOuConfier(() => { throw new GitIndisponible('not a git repository') }, pannes), null)
  const vu = refusDesPannes(pannes)
  assert.deepEqual(Object.keys(vu), ['reason'])
  assert.equal(vu.reason, "⛔ lecture git indisponible : fatal: feinte cat-file ; not a git repository — la porte ne juge pas ce que git n'a pas lu. Geste : rejouer le commit depuis un arbre où git répond.",
    'une cause vue deux fois est nommée une fois, en UN refus')
  assert.equal(refusDesPannes([]), null)
  assert.deepEqual(jugerOuConfier(() => ({ reason: 'r' }), []), { reason: 'r' })
  assert.throws(() => jugerOuConfier(() => { throw new TypeError('un vrai bug') }, []), TypeError)

  // La CAUSE VRAIE prime sur ce que git a bredouillé : un répertoire hors dépôt n'est ni un git
  // absent ni un cwd manquant, et « unknown option `cached' » ne désignait aucune correction.
  const hors = refusDesPannes(['error: unknown option `cached\''], { cwd: '/base/scratchpad', horsDepot: true })
  assert.match(hors.reason, /hors dépôt : \/base\/scratchpad/)
  assert.doesNotMatch(hors.reason, /unknown option/)
  assert.doesNotMatch(hors.reason, /où git répond/)
})

// ── Le garde ne juge que DEUX gestes — hors d'eux, il ne lit rien (#1729 sonde 3) ────────────
test('gesteJuge : commit et fermeture `gh` ; toute autre commande est hors sujet', () => {
  assert.equal(gesteJuge('git commit -m "x"'), 'commit')
  assert.equal(gesteJuge('cd wt && git commit -F msg.txt'), 'commit')
  assert.equal(gesteJuge('gh issue close 42'), 'fermeture')
  assert.equal(gesteJuge('gh api -X PATCH repos/o/r/issues/42 --input corps.json'), 'fermeture')
  assert.equal(gesteJuge('ls -la'), null)
  assert.equal(gesteJuge('wc -c fichier.txt'), null)
  assert.equal(gesteJuge('git status'), null)
  assert.equal(gesteJuge('gh issue list --state open'), null)
  assert.equal(gesteJuge(''), null)
})

// ── Continuation de ligne : la commande CONTINUE, le saut n'est pas une fin (#1729) ───────────
test('tokenizeCommand : `\\` POSIX et backtick PowerShell en fin de ligne ne coupent pas la commande', () => {
  const LF = '\n'
  const BS = String.fromCharCode(92)
  const BT = String.fromCharCode(96)
  const contenu = `fix(hooks): refs #1729${LF}${LF}Closes #1728${LF}`
  const src = extractMessageSources(`git commit --amend ${BS}${LF}  -F msg.txt`, { readFile: () => contenu })
  assert.equal(src.fileError, null, 'le `-F` de la ligne suivante est perdu : le message n’est jamais lu')
  assert.deepEqual(extractClosedIssues(src.text), [1728])
  assert.deepEqual(extractRefIssues(src.text), [1729])
  // Le marqueur lui-même ne devient pas un pathspec parasite (`["`"]` mesuré avant correction).
  assert.deepEqual(
    extractCommitPathspecs(`git commit -m "fix: refs #1729" ${BT}${LF}  -- scripts/hooks/x.mjs`),
    ['scripts/hooks/x.mjs'],
  )
})

// ── Répertoire CIBLE : ce que la commande nomme n'est un cwd que s'il EXISTE (#1729) ─────────────
// Un cwd inexistant et un git absent rendent le MÊME ENOENT de spawn : retenir un chemin non prouvé
// refuserait pour une lecture git indisponible un geste que git exécute (sondes 1-2 du ticket).
test('cibleDeLaCommande : un chemin INEXISTANT ou NON EXPANSÉ n’est pas un cwd, et la raison est dite', () => {
  const base = mkdtempSync(join(tmpdir(), 'cible-'))
  try {
    mkdirSync(join(base, 'wt'))
    assert.deepEqual(
      cibleDeLaCommande('cd wt && git commit -m x', base),
      { dir: join(base, 'wt'), ignore: null },
      'un répertoire RÉEL reste la cible',
    )

    const absent = cibleDeLaCommande('cd .wt-1728-L1 && git commit -m x', base)
    assert.equal(absent.dir, null, 'la cible d’un worktree absente du disque servait de cwd → ENOENT du spawn')
    assert.match(absent.ignore.raison, /inexistant/)
    assert.equal(absent.ignore.chemin, join(base, '.wt-1728-L1'))

    const variable = cibleDeLaCommande('M=/c/x; git -C "$M" merge --ff-only x', base)
    assert.equal(variable.dir, null)
    assert.equal(variable.ignore.chemin, '$M')
    assert.match(variable.ignore.raison, /non expansée/)

    assert.deepEqual(
      cibleDeLaCommande('git worktree add -b wt-1728-L1 .wt-1728-L1 HEAD', base),
      { dir: null, ignore: null },
      'la CIBLE d’un `git worktree add` n’est jamais un cwd : la commande ne nomme aucun répertoire',
    )
    assert.equal(extractTargetDir('git worktree add -b w .wt-x HEAD', base), base)

    // #2173 (juge de diff, 5e passe) : `popd`/`Pop-Location` dépilent un lieu que la commande ne nomme pas.
    for (const cmd of ['Pop-Location -StackName x; git commit -m y', 'popd +1; git commit -m y']) {
      assert.deepEqual(cibleDeLaCommande(cmd, base), { dir: null, ignore: null }, cmd)
    }
    assert.deepEqual(cibleDeLaCommande('Push-Location wt; git commit -m y', base), { dir: join(base, 'wt'), ignore: null })
  } finally {
    rmSync(base, { recursive: true, force: true })
  }
})

test('extractTargetDir : `Set-Location`/`sl`/`chdir`/`pushd` déplacent le commit comme `cd`', () => {
  const base = mkdtempSync(join(tmpdir(), 'cible-ps-'))
  try {
    mkdirSync(join(base, 'wt'))
    for (const mot of ['cd', 'Set-Location', 'sl', 'chdir', 'pushd']) {
      assert.equal(
        extractTargetDir(`${mot} wt; git commit -m x`, base),
        join(base, 'wt'),
        `\`${mot}\` non lu : le commit du worktree est jugé contre l’arbre de départ`,
      )
    }
  } finally {
    rmSync(base, { recursive: true, force: true })
  }
})

test('avecCibleIgnoree : le refus DIT le répertoire écarté ; sans écart, il n’est pas touché', () => {
  const refus = { reason: '⛔ solde absent' }
  const dit = avecCibleIgnoree(refus, { chemin: '/base/.wt-x', raison: 'répertoire inexistant au moment du contrôle' })
  assert.deepEqual(Object.keys(dit), ['reason'])
  assert.match(dit.reason, /\.wt-x/)
  assert.match(dit.reason, /inexistant/)
  assert.equal(avecCibleIgnoree(refus, null), refus)
  assert.equal(avecCibleIgnoree(null, { chemin: 'x', raison: 'y' }), null)
})

// ── Le CORPS d’un heredoc est une DONNÉE, pas des commandes (#1729 sonde 6) ───────────────────
test('isGitCommitCommand : un heredoc qui ÉCRIT un texte citant « git commit » n’est pas un commit', () => {
  const ecriture = [
    "cat > note.md <<'EOF'",
    'Geste joué : `Set-Location .wt-1728-L1; git commit -m \'fix\'` — du texte, pas une commande.',
    'EOF',
  ].join('\n')
  assert.equal(isGitCommitCommand(ecriture), false)
  assert.equal(isGitCommitCommand(ecriture.replace("<<'EOF'", '<<-"FIN"').replace(/\nEOF$/, '\nFIN')), false, 'graphies `<<-` et mot entre guillemets doubles')
  // Le `git commit` HORS du corps reste vu, message packé en heredoc compris.
  assert.equal(isGitCommitCommand('git commit -m "$(cat <<EOF\nfix(x): refs #1729\nEOF\n)"'), true)
  assert.equal(isGitCommitCommand(`${ecriture}\ngit commit -m "fix(x): refs #1729"`), true, 'la commande qui SUIT le corps est rendue à la lumière')
  // Fidélité au shell : seule la ligne du mot SEUL ferme un `<<MOT` — une ligne de prose INDENTÉE
  // qui cite le mot ne rouvre pas le texte en commandes (sans quoi la prose suivante redevient un
  // commit). Après `<<-`, seules les TABULATIONS de tête sont retirées.
  const indente = ['cat > note.md <<EOF', '  EOF', "git commit -m 'du texte, pas un geste'", 'EOF', 'echo fin'].join('\n')
  assert.equal(isGitCommitCommand(indente), false)
  assert.equal(isGitCommitCommand(['cat > note.md <<-EOF', '\tEOF', 'git commit -m "vrai"'].join('\n')), true, '`<<-` ferme sur une tabulation')
})

// ── LISTAGE PAR IMAGE des postes du budget (#1728) ──────────────────────────────────────────────

test('un poste SUPPRIMÉ par le commit sort de la mesure et reste dans la RÉFÉRENCE', () => {
  const { racine } = instanceDeDepot({
    fichiers: {
      '.claude/skills/a/SKILL.md': '---\nname: a\ndescription: aaa\n---\n',
      '.claude/skills/b/SKILL.md': '---\nname: b\ndescription: bbb\n---\n',
      '.claude/agents/c.md': '---\nname: c\ndescription: ccc\n---\n',
    },
    message: 'socle',
  })
  try {
    lancerGit(['rm', '-q', '-r', '--cached', '.claude/skills/b'], { cwd: racine })
    const image = listeurDuBudget(INDEX, racine)
    const preImage = listeurDuBudget('HEAD', racine)
    assert.deepEqual(image('.claude/skills'), ['a'], 'la skill retirée de l’index sort de la MESURE')
    assert.deepEqual(preImage('.claude/skills'), ['a', 'b'], 'la pré-image la porte encore — sans quoi « aucun poste ne grossit »')
    assert.deepEqual(image('.claude/agents'), ['c.md'])
    assert.deepEqual(image('.claude/absent'), [])
  } finally {
    rmSync(racine, { recursive: true, force: true })
  }
})

test('hors dépôt, le listeur d’image rend [] — comme le listeur de disque devant un dossier absent', () => {
  const vide = mkdtempSync(join(tmpdir(), 'hors-depot-'))
  try {
    assert.deepEqual(listeurDuBudget(INDEX, vide)('.claude/skills'), [])
  } finally {
    rmSync(vide, { recursive: true, force: true })
  }
})

// ── BUDGET du contexte permanent (#1728) ────────────────────────────────────────────────────────

test('le budget qui grandit sans CLIQUET est refusé, avec CLIQUET il passe, et hors commit il se tait', () => {
  const reference = { postes: [{ nom: 'CLAUDE.md', octets: 9127 }], total: 9127 }
  const mesure = { postes: [{ nom: 'CLAUDE.md', octets: 10151 }], total: 10151 }
  const sans = evaluateBudgetContexte({ command: 'git commit -m "docs: une ligne"', mesure, reference, plafond: 9127 })
  assert.equal(sans.decision, 'deny')
  assert.match(sans.reason, /CLAUDE\.md \+1024 octets/)
  const avec = 'git commit -m "docs: une ligne\n\nCLIQUET: scripts/guards/budget-contexte.mjs +1024 — une règle de routage neuve"'
  assert.equal(evaluateBudgetContexte({ command: avec, mesure, reference, plafond: 9127 }), null)
  assert.equal(evaluateBudgetContexte({ command: 'git status', mesure, reference, plafond: 9127 }), null)
})

// ── RECLASSEMENT CSS (#1806) ────────────────────────────────────────────────────────────────────

test('reclassement CSS (#1806 D2″) : jugé sur un commit qui touche la frontière ou porte une ligne, module par module', () => {
  const module = 'src/ui/styles/console.css'
  const css = '.c { color: red; gap: 3px }'
  const cote = (reutilisee) => ({
    manifeste: [{ id: 'c', fichier: 'src/ui/Console.tsx', css: module }],
    partagees: [],
    reutilises: new Set(reutilisee ? ['src/ui/Console.tsx'] : []),
    lire: (f) => (f === module ? css : null),
  })
  const franchit = () => ({ base: cote(false), commit: cote(true) })
  const sans = evaluateReclassementsCss({ command: 'git commit -m "feat: second écran"', deplace: () => true, cotes: franchit })
  assert.deepEqual(Object.keys(sans), ['reason'])
  assert.ok(sans.reason.includes(`${module} : franchi au prix 2, aucune ligne`), sans.reason)
  const ligne = `RECLASSEMENT: ${module} +2 — la console devient une primitive, refs #1806`
  assert.equal(evaluateReclassementsCss({ command: `git commit -m "feat\n\n${ligne}"`, deplace: () => true, cotes: franchit }), null)
  const jamaisLu = () => { throw new Error('côtés lus hors frontière') }
  assert.equal(evaluateReclassementsCss({ command: 'git commit -m "x"', deplace: () => false, cotes: jamaisLu }), null)
  const orpheline = evaluateReclassementsCss({
    command: `git commit -m "docs\n\n${ligne}"`,
    deplace: () => false,
    cotes: () => ({ base: cote(true), commit: cote(true) }),
  })
  assert.ok(orpheline?.reason.includes(`${module} : ligne \`+2\` sans franchissement`), 'une ligne sans franchissement est refusée, même hors frontière')
  assert.equal(evaluateReclassementsCss({ command: 'git status', deplace: () => true, cotes: jamaisLu }), null)
  const injugeable = evaluateReclassementsCss({
    command: 'git commit -m "x"',
    deplace: () => true,
    cotes: () => { throw new Error('src/data/primitives.manifest.json illisible : x') },
  })
  assert.deepEqual(Object.keys(injugeable ?? {}), ['reason'], 'manifeste illisible : refus nommé, jamais un passage muet')
  assert.match(injugeable.reason, /injugeable : src\/data\/primitives\.manifest\.json illisible/)
})

test('fichiersCitantTickets : les fichiers de l’INDEX sous `src/` et `scripts/` qui citent le ticket, par l’unique `fichiersDuGrep`', () => {
  const { racine } = instanceDeDepot({
    fichiers: {
      'src/a.ts': '// #1806\nexport const a = 1\n',
      'scripts/b.mjs': '// voir #18060 puis #1806.\n',
      'notes/c.txt': '#1806\n',
      'src/d.ts': '// #18061\n',
    },
    message: 'socle',
  })
  try {
    assert.deepEqual(fichiersCitantTickets([1806], racine).sort(), ['scripts/b.mjs', 'src/a.ts'])
    assert.deepEqual(fichiersCitantTickets([4242], racine), [], 'aucun match : `git grep` sort en 1, la liste est vide')
    assert.deepEqual(fichiersCitantTickets([], racine), [])
  } finally {
    rmSync(racine, { recursive: true, force: true })
  }
})

// Câblage des pannes sans cale git (#2114) : les `pannes` du contexte du répartiteur atteignent la
// décision de la garde.
test('garde.evaluer : une panne de lecture git portée par `contexte.pannes` est un `deny` NOMMÉ', async () => {
  const { racine } = instanceDeDepot({ fichiers: { 'notes/a.md': '# a\n' }, message: 'socle' })
  try {
    const entree = { hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: 'git commit -m "docs: a"' } }
    const contexte = { dir: racine, cibleIgnoree: null, today: '2026-09-28' }
    assert.equal(await garde.evaluer(entree, { ...contexte, pannes: [] }), null, 'témoin : sans panne, silence')
    const refus = await garde.evaluer(entree, { ...contexte, pannes: ['fatal: panne simulée'] })
    assert.equal(refus?.decision, 'deny')
    assert.match(refus.raison, /⛔ lecture git indisponible : fatal: panne simulée/)
  } finally {
    rmSync(racine, { recursive: true, force: true })
  }
})

test('valeurParametre : le nom EXACT gagne, un préfixe strict ambigu est refusé, la casse est libre', () => {
  const noms = ['Query', 'QueryDialect', 'Filter']
  const args = (p) => [p, 'v']
  assert.equal(valeurParametre(args('-Query'), 'Query', noms), 'v')
  assert.equal(valeurParametre(args('-QUERY'), 'Query', noms), 'v')
  assert.equal(valeurParametre(args('-query'), 'Query', noms), 'v')
  assert.equal(valeurParametre(args('-Quer'), 'Query', noms), '')
  assert.equal(valeurParametre(args('-Quer'), 'QueryDialect', noms), '')
  assert.equal(valeurParametre(args('-QueryD'), 'QueryDialect', noms), 'v')
  assert.equal(valeurParametre(args('-QueryD'), 'Query', noms), '')
  assert.equal(valeurParametre(args('-querydialect'), 'QueryDialect', noms), 'v')
  assert.equal(valeurParametre(args('-Fil'), 'Filter', noms), 'v')
})

// ── #2328 : une FUSION EN COURS se juge sur son APPORT PROPRE, sans trailers de livraison ──────────
/** Un écran de `lignes` lignes numérotées. */
const ecranDe = (lignes, marque = 'l') => `${Array.from({ length: lignes }, (_, i) => `export const ${marque}${i} = ${i}`).join('\n')}\n`

/**
 * Un dépôt forgé arrêté EN FUSION de main dans le chantier : `socle` commité, `main` sur la branche
 * `amont`, `chantier` sur la branche courante (HEAD), puis `git merge --no-commit --no-ff amont` ; un
 * conflit est laissé à l'appelant, qui résout et stage. Rend `{ racine, git, evaluer(commande) }`.
 */
function depotEnFusion({ socle, chantier, main }) {
  const { racine } = instanceDeDepot({ fichiers: socle, message: 'socle' })
  const git = gitDe(racine)
  const courante = git('rev-parse', '--abbrev-ref', 'HEAD').trim()
  const poser = (fichiers, message) => {
    for (const [chemin, texte] of Object.entries(fichiers)) {
      mkdirSync(join(racine, chemin, '..'), { recursive: true })
      writeFileSync(join(racine, chemin), texte)
    }
    git('add', '-A'); git('commit', '-q', '-m', message)
  }
  git('checkout', '-q', '-b', 'amont'); poser(main, 'main')
  git('checkout', '-q', courante); poser(chantier, 'chantier')
  const fusion = resultatDeGit(['merge', '--no-commit', '--no-ff', 'amont'], { cwd: racine })
  assert.ok(existsSync(join(racine, '.git', 'MERGE_HEAD')), `témoin : fusion en cours — ${fusion.stdout}${fusion.stderr}`)
  const evaluer = (command) => garde.evaluer(
    { hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command } },
    { dir: racine, cibleIgnoree: null, today: TODAY, pannes: [] },
  )
  return { racine, git, evaluer }
}

test('#2328 DoD 1 — une fusion en cours dont la RÉSOLUTION insère >10 lignes dans un écran passe en `refs #N` sans JUGE, REFUTATION ni JUGE-VISION ; le même diff en commit ordinaire est refusé', async () => {
  const ecran = 'src/ui/Ecran.tsx'
  const { racine, git, evaluer } = depotEnFusion({
    socle: { [ecran]: ecranDe(3) },
    chantier: { [ecran]: ecranDe(3).replace('= 0', '= 100') },
    main: { [ecran]: ecranDe(3).replace('= 0', '= 200') },
  })
  try {
    const resolu = `${ecranDe(3).replace('= 0', '= 300')}${ecranDe(12, 'r')}`
    writeFileSync(join(racine, ecran), resolu); git('add', ecran)
    const commande = 'git commit -m "merge: refs #42 — intègre main"'
    const lu = analyzeDiffDuCommit(diffDuCommit(commande, racine).numstat())
    assert.ok(lu.touchesUi && lu.totalLines >= 10, `témoin : la résolution est de la substance d'écran — ${JSON.stringify(lu)}`)
    assert.equal(await evaluer(commande), null, 'sauver une fusion n’est pas une livraison')

    const { racine: ordinaire } = instanceDeDepot({ fichiers: { [ecran]: ecranDe(3) }, message: 'socle' })
    try {
      writeFileSync(join(ordinaire, ecran), resolu); gitDe(ordinaire)('add', ecran)
      const refus = await garde.evaluer(
        { hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: 'git commit -m "feat: refs #42 — écran"' } },
        { dir: ordinaire, cibleIgnoree: null, today: TODAY, pannes: [] },
      )
      assert.equal(refus?.decision, 'deny', 'test opposé : hors fusion, le même diff exige ses trailers')
      assert.match(refus.raison, /JUGE: /)
      assert.match(refus.raison, /JUGE-VISION: /)
      assert.match(refus.raison, /sans réfutation/)
    } finally { rmSync(ordinaire, { recursive: true, force: true }) }
  } finally { rmSync(racine, { recursive: true, force: true }) }
})

test('#2328 — sous une fusion en cours, un commit de SOLDE reste soumis à sa section Réfutation', async () => {
  const { racine, git, evaluer } = depotEnFusion({
    socle: { 'src/a.ts': ecranDe(2) },
    chantier: { 'src/b.ts': ecranDe(2) },
    main: { 'notes/m.md': 'm\n' },
  })
  try {
    mkdirSync(join(racine, '.claude', 'soldes'), { recursive: true })
    writeFileSync(join(racine, '.claude', 'soldes', '42.md'), solde().replace(/## Réfutation[\s\S]*$/, ''))
    git('add', '-A')
    const refus = await evaluer('git commit -m "merge: corrige #42 — intègre main"')
    assert.equal(refus?.decision, 'deny')
    assert.match(refus.raison, /Réfutation/)
  } finally { rmSync(racine, { recursive: true, force: true }) }
})

test('#2328 A5 — une fusion PROPRE n’apporte rien : la porte du ticket se tait, même quand main apporte `src/` et `scripts/`', async () => {
  const { racine, evaluer } = depotEnFusion({
    socle: { 'notes/a.md': 'a\n' },
    chantier: { 'notes/c.md': 'c\n' },
    main: { 'src/ui/Main.tsx': ecranDe(20), 'scripts/m.mjs': ecranDe(20) },
  })
  try {
    const commande = 'git commit -m "merge: intègre main"'
    const c = diffDuCommit(commande, racine)
    assert.equal(c.enFusion(), true)
    assert.deepEqual(analyzeDiffDuCommit(c.numstat()).fichiers, [], 'l’apport d’une fusion propre est vide')
    assert.equal(await evaluer(commande), null)
  } finally { rmSync(racine, { recursive: true, force: true }) }
})

test('#2328 A5 — sous fusion, un écran ne compte que s’il GAGNE des lignes dans l’apport', () => {
  const entree = (plus, moins) => [{ plus, moins, chemins: ['src/ui/E.tsx'] }]
  assert.equal(analyzeDiffDuCommit(entree(0, 12)).touchesUi, true, 'hors fusion : toute touche compte')
  assert.equal(analyzeDiffDuCommit(entree(0, 12), { ecranParInsertion: true }).touchesUi, false)
  assert.equal(analyzeDiffDuCommit(entree(1, 12), { ecranParInsertion: true }).touchesUi, true)
})

test('#2328 A6 — un CLAUDE.md agrandi par main seul ne demande aucun CLIQUET ; la résolution qui le touche se mesure contre la fusion automatique', async () => {
  const porteur = (plafond) => `export const PLAFOND_OCTETS = ${plafond}\n`
  const contexte = (n) => `# contexte\n${'x'.repeat(n)}\n`
  const { racine, git, evaluer } = depotEnFusion({
    socle: { 'CLAUDE.md': contexte(50), 'scripts/guards/budget-contexte.mjs': porteur(100) },
    chantier: { 'notes/c.md': 'c\n' },
    main: { 'CLAUDE.md': contexte(400), 'scripts/guards/budget-contexte.mjs': porteur(500) },
  })
  try {
    assert.equal(await evaluer('git commit -m "merge: refs #42 — intègre main"'), null, 'fusion propre : rien à mesurer')
    writeFileSync(join(racine, 'CLAUDE.md'), contexte(390)); git('add', 'CLAUDE.md')
    assert.equal(await evaluer('git commit -m "merge: refs #42 — intègre main"'), null, 'la résolution rétrécit le contexte sous le plafond de main')
    writeFileSync(join(racine, 'CLAUDE.md'), contexte(600)); git('add', 'CLAUDE.md')
    assert.match((await evaluer('git commit -m "merge: refs #42 — intègre main"'))?.raison ?? '', /CLIQUET/, 'témoin : la résolution qui dépasse le plafond de main est refusée')
  } finally { rmSync(racine, { recursive: true, force: true }) }
})

test('#2328 A2 — l’apport d’une fusion en cours se mesure depuis sa FUSION AUTOMATIQUE : ni HEAD, ni la base commune', () => {
  const ecran = 'src/ui/E.tsx'
  const { racine, git } = depotEnFusion({
    socle: { [ecran]: ecranDe(10) },
    chantier: { [ecran]: ecranDe(10).replace('= 0', '= 100') },
    main: { [ecran]: ecranDe(10).replace('= 9', '= 900') },
  })
  try {
    writeFileSync(join(racine, ecran), `${ecranDe(10).replace('= 0', '= 100').replace('= 9', '= 900')}export const resolu = 1\n`); git('add', ecran)
    const c = diffDuCommit('git commit -m "merge: refs #42"', racine)
    assert.deepEqual(c.numstat(), [{ plus: 1, moins: 0, chemins: [ecran] }], 'la seule ligne de la résolution')
    assert.equal(c.apport().parents.length, 2)
    assert.deepEqual(c.apport().change.numstat(), c.numstat(), 'une lecture : l’apport exposé est celui que la garde mesure')
  } finally { rmSync(racine, { recursive: true, force: true }) }
})

test('#2328 A5 — sous fusion, la Recette visuelle du solde suit l’écran que la RÉSOLUTION écrit, pas celui qu’elle ne fait que trancher', async () => {
  const ecran = 'src/ui/Ecran.tsx'
  const { racine, git, evaluer } = depotEnFusion({
    socle: { [ecran]: ecranDe(6) },
    chantier: { [ecran]: ecranDe(6).replace('= 0', '= 100') },
    main: { [ecran]: ecranDe(6).replace('= 0', '= 200') },
  })
  try {
    mkdirSync(join(racine, '.claude', 'soldes'), { recursive: true })
    writeFileSync(join(racine, '.claude', 'soldes', '42.md'), solde())
    const commande = 'git commit -m "merge: corrige #42 — intègre main"'
    const raisonPour = async (resolu) => {
      writeFileSync(join(racine, ecran), resolu); git('add', '-A')
      return (await evaluer(commande))?.raison ?? ''
    }
    assert.doesNotMatch(await raisonPour(ecranDe(6).replace('= 0', '= 100')), /Recette visuelle/, 'la résolution ne fait que retirer : aucun écran écrit')
    assert.match(await raisonPour(ecranDe(6).replace('= 0', '= 300')), /Recette visuelle/, 'témoin : la résolution écrit une ligne d’écran')
  } finally { rmSync(racine, { recursive: true, force: true }) }
})

test('#2328 D2 — une fusion en cours qu’aucune fusion automatique ne rejoue est un refus NOMMÉ, jamais le diff contre HEAD', async () => {
  const { racine, git, evaluer } = depotEnFusion({
    socle: { 'notes/a.md': 'a\n' },
    chantier: { 'notes/c.md': 'c\n' },
    main: { 'src/m.ts': ecranDe(20) },
  })
  try {
    const mergeHead = join(racine, '.git', 'MERGE_HEAD')
    writeFileSync(mergeHead, `${readFileSync(mergeHead, 'utf8')}${git('rev-parse', 'HEAD~1').trim()}\n`)
    const refus = await evaluer('git commit -m "merge: intègre main"')
    assert.equal(refus?.decision, 'deny')
    assert.match(refus.raison, /⛔ lecture git indisponible : fusion en cours à 3 parents/)
  } finally { rmSync(racine, { recursive: true, force: true }) }
})

test('#2328 — sous fusion, `evaluateHunksEmportes` lit le STAGÉ de l’apport : le fichier que main apporte seul n’est pas nommé, celui de la résolution l’est', async () => {
  const { racine, git, evaluer } = depotEnFusion({
    socle: { 'notes/a.md': 'a\n' },
    chantier: { 'notes/c.md': 'c\n' },
    main: { 'src/m.ts': 'export const m = 1\n' },
  })
  try {
    writeFileSync(join(racine, 'src', 'r.ts'), 'export const r = 1\n'); git('add', 'src/r.ts')
    writeFileSync(join(racine, 'src', 'm.ts'), 'export const m = 2\n')
    writeFileSync(join(racine, 'src', 'r.ts'), 'export const r = 2\n')
    const raison = (await evaluer('git commit -i -m "merge: refs #42" -- src/m.ts src/r.ts'))?.raison ?? ''
    const hunks = raison.slice(raison.indexOf('⛔ `git commit -i <paths>`'))
    assert.match(hunks, /^⛔ `git commit -i <paths>` .*src\/r\.ts porte\(nt\) À LA FOIS/, raison)
    assert.doesNotMatch(hunks, /src\/m\.ts/, 'main l’a apporté : aucun hunk stagé par le geste')
  } finally { rmSync(racine, { recursive: true, force: true }) }
})
