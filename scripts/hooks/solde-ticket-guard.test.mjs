// Test du hook `solde-ticket-guard` (node --test) : la fermeture de ticket au commit exige un
// SOLDE écrit conforme, avec sa propre réfutation adversariale, et respecte le palier de revue
// adversariale (demande 2026-07-14). Lancé par `npm run test:hooks`.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Buffer } from 'node:buffer'
import { resolve, join } from 'node:path'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync, existsSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import {
  extractClosedIssues,
  validateSolde,
  validateRevuePalier,
  evaluate,
  extractRefIssues,
  validateRefFile,
  evaluateAntiEsquive,
  evaluatePorteDuTicket,
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
  diffDuCommit,
  repoRoot,
  readSoldeFile,
  readRefFile,
  restesItems,
  restesRoutants,
  sectionDe,
  compteSections,
  lignesDeHunks,
  verifierCapture,
  estFichierEcran,
  estArbrePrincipal,
  cheminDEcriture,
  evaluateFermetureHorsCommit,
  evaluateArbrePrincipal,
  evaluateHunksEmportes,
  fichiersDuCommitGit,
  diffDunSha,
  problemesDeRevueNeuve,
  jugerOuNommerLIndisponible,
  revuesDuCommit,
  cibleDeLaCommande,
  avecCibleIgnoree,
  gesteJuge,
  evaluateBudgetContexte,
  listeurDImage,
} from './solde-ticket-guard.mjs'
import { tombalesDansSource, evaluateTombale, EXEMPTIONS_TOMBALE } from './solde-tombale.mjs'
import { GitIndisponible, estDansHead } from '../guards/lib/gitPorte.mjs'
import {
  archivesDe, derniereRevueArchivee, fenetreDeRevue, mesureDuPalier, nomDArchiveDeRevue, nomsDArchiveAcceptes,
  revuesNeuves,
} from '../guards/lib/revuePalier.mjs'
import { envDeDepotForge, instanceDeDepot } from '../guards/lib/depotGabarit.mjs'

const TODAY = '2026-07-14'
const VERIFIE_OK = 'VERIFIE: relu le diff complet, lancé npm test et vérifié les 3 fichiers touchés à la main.'
const REFUTATION_OK = 'Un juge adversarial a rejoué le diff contre le DoD du ticket, tenté 2 contournements, aucun ne passe.'

const solde = ({ restes = 'RAS', verdict = 'CONFIRMÉ', date = TODAY } = {}) =>
  `${VERIFIE_OK}\n\n## Restes\n${restes}\n\n## Réfutation\nverdict: ${verdict}\n${REFUTATION_OK}\n\n(${date})\n`

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

// ── validateRevuePalier ──────────────────────────────────────────────────────────────────────────
// Une revue conforme porte sa date en 1re ligne et la fenêtre qu'elle juge : ce sont les deux champs
// dont l'archiveur d'après commit fait le NOM de l'archive.
const revuePalier = ({ verdict = 'CONFIRMÉ', date = TODAY, synth = 'A'.repeat(90), fenetre = '0139bd89c..7692b631c' } = {}) =>
  `# PALIER (${date})\n\nverdict: ${verdict}\n${synth}\n\n\`${fenetre}\`\n`

test('validateRevuePalier : conforme', () => {
  const r = validateRevuePalier(revuePalier(), TODAY)
  assert.equal(r.ok, true, r.problems.join(' ; '))
})

test('validateRevuePalier : fichier absent', () => {
  assert.equal(validateRevuePalier(null, TODAY).ok, false)
})

test('validateRevuePalier : synthèse trop maigre', () => {
  const r = validateRevuePalier(revuePalier({ synth: 'trop court' }), TODAY)
  assert.equal(r.ok, false)
  assert.match(r.problems.join(' ; '), /trop maigre/)
})

test('validateRevuePalier : date absente', () => {
  const r = validateRevuePalier(`verdict: CONFIRMÉ\n${'A'.repeat(90)}\n`, TODAY)
  assert.equal(r.ok, false)
  assert.match(r.problems.join(' ; '), /date du jour/)
})

test('validateRevuePalier : une revue que l’archiveur ne saurait NOMMER est refusée au commit', () => {
  const sansFenetre = validateRevuePalier(revuePalier({ fenetre: 'sans la moindre fenêtre' }), TODAY)
  assert.equal(sansFenetre.ok, false)
  assert.match(sansFenetre.problems.join(' ; '), /fenêtre `<base>\.\.<tête>`/)

  const dateHorsPremiereLigne = validateRevuePalier(
    `# Revue adversariale de PALIER\n\nverdict: CONFIRMÉ\n${'A'.repeat(90)}\n\nLe ${TODAY}, fenêtre \`0139bd89c..7692b631c\`.\n`,
    TODAY,
  )
  assert.equal(dateHorsPremiereLigne.ok, false)
  assert.match(dateHorsPremiereLigne.problems.join(' ; '), /date AAAA-MM-JJ en 1re ligne/)
})

test('fenetreDeRevue : la DERNIÈRE date de la 1re ligne, la PREMIÈRE fenêtre du corps', () => {
  // Un titre porte ses numéros de tickets AVANT sa date, et le corps cite d'autres plages que la
  // sienne : c'est cette lecture-là que l'archiveur et la porte partagent.
  assert.deepEqual(
    fenetreDeRevue('# PALIER — 10 fermetures (#1541 → #1616), 2026-09-01\n\n`0139bd89c..7692b631c` puis `aaaaaaa..bbbbbbb`\n'),
    { date: '2026-09-01', base: '0139bd89c', tete: '7692b631c' },
  )
  assert.deepEqual(fenetreDeRevue(''), { date: null, base: null, tete: null })
  assert.deepEqual(
    fenetreDeRevue('# PALIER\n\nle 2026-09-01 en 2e ligne ne nomme rien\n'),
    { date: null, base: null, tete: null },
  )
})

/** Date de la 1re ligne — `null` quand elle n'en porte pas (la porte la refusera à ce titre). */
const dateDe = (texte) => /\d{4}-\d{2}-\d{2}/.exec(texte.split('\n', 1)[0])?.[0] ?? null

// Deux sessions ont archivé le 2026-09-05 une revue de MÊME base (f0f9436f5) : même nom, conflit AA
// au rebase, la seconde ne pouvait pas entrer dans l'histoire. La fenêtre a pourtant DEUX bornes.
test('nomDArchiveDeRevue : même date et même base, têtes DIFFÉRENTES → deux noms', () => {
  const revue = (tete) => `# PALIER — 2026-09-05\n\nfenêtre \`f0f9436f5..${tete}\`\n`
  assert.equal(nomDArchiveDeRevue(revue('714df53da')), 'revue-palier-2026-09-05-f0f9436f5-714df53da.md')
  assert.equal(nomDArchiveDeRevue(revue('226a764b6')), 'revue-palier-2026-09-05-f0f9436f5-226a764b6.md')
  assert.notEqual(nomDArchiveDeRevue(revue('714df53da')), nomDArchiveDeRevue(revue('226a764b6')))
})

test('nomsDArchiveAcceptes : les graphies ANTÉRIEURES restent reconnues, la courante est la 1re', () => {
  const texte = '# PALIER — 2026-09-05\n\nfenêtre `f0f9436f5..226a764b6`\n'
  assert.deepEqual(nomsDArchiveAcceptes(texte), [
    'revue-palier-2026-09-05-f0f9436f5-226a764b6.md',
    'revue-palier-2026-09-05-f0f9436f5.md',
    'revue-palier-2026-09-05.md',
  ])
  // Sans fenêtre lisible, la date seule nomme — et c'est le seul nom accepté.
  assert.deepEqual(nomsDArchiveAcceptes('# PALIER — 2026-09-05\n\nrien\n'), ['revue-palier-2026-09-05.md'])
  assert.deepEqual(nomsDArchiveAcceptes('# PALIER\n\nrien\n'), [])
})

test('toute revue ACCEPTÉE par la porte est NOMMABLE par l’archiveur (variantes fabriquées)', () => {
  const variantes = [
    revuePalier(),
    revuePalier({ verdict: 'RÉFUTÉ' }),
    revuePalier({ fenetre: 'f0f9436f5..714df53da' }),
    revuePalier({ fenetre: 'sans la moindre fenêtre' }),
    `# Revue de PALIER\n\nverdict: CONFIRMÉ\n${'A'.repeat(90)}\n\nLe ${TODAY}, fenêtre \`0139bd89c..7692b631c\`.\n`,
    revuePalier({ synth: 'trop court' }),
  ]
  let acceptees = 0
  for (const texte of variantes) {
    if (!validateRevuePalier(texte, dateDe(texte) ?? TODAY).ok) continue
    acceptees += 1
    assert.ok(
      nomDArchiveDeRevue(texte),
      `revue acceptée au commit que l’archiveur ne sait pas nommer — le palier gelait :\n${texte}`,
    )
  }
  assert.ok(acceptees > 0, 'aucune variante acceptée : la propriété ne jugerait rien')
})

// ── evaluate (intégration pure, readSolde/readRevuePalier injectés) ────────────────────────────────
test('evaluate : sans mot-clef de fermeture → silence total', () => {
  const d = evaluate({ command: 'git commit -m "wip"', today: TODAY, readSolde: () => { throw new Error('ne doit pas être appelé') } })
  assert.equal(d, null)
})

test('evaluate : solde conforme, palier <10 → silence (commit passe)', () => {
  const d = evaluate({ command: 'git commit -m "corrige #99"', today: TODAY, readSolde: () => solde(), counter: 4 })
  assert.equal(d, null)
})

test('evaluate : solde absent → deny actionnable', () => {
  const d = evaluate({ command: 'git commit -m "corrige #99"', today: TODAY, readSolde: () => null })
  assert.ok(d && typeof d.reason === 'string')
  assert.match(d.reason, /#99/)
  assert.match(d.reason, /\.claude\/soldes\/99\.md/)
  assert.match(d.reason, /fichier absent/)
})

test('evaluate : multi-fermeture — un seul solde manquant listé nommément', () => {
  const d = evaluate({
    command: 'git commit -m "corrige #1, ferme #2"',
    today: TODAY,
    readSolde: (n) => (n === 1 ? solde() : null),
  })
  assert.ok(d)
  assert.doesNotMatch(d.reason, /#1 \(/)
  assert.match(d.reason, /#2 \(/)
})

test('evaluate : verdict RÉFUTÉ → deny même si le reste du solde est conforme', () => {
  const d = evaluate({ command: 'git commit -m "corrige #5"', today: TODAY, readSolde: () => solde({ verdict: 'RÉFUTÉ' }) })
  assert.ok(d)
  assert.match(d.reason, /réfuté ne se ferme pas/)
})

// Le palier est une MESURE d'histoire : `compte` commits de substance depuis `tete`, la tete de
// fenetre de la derniere revue de HEAD (`chemin`). La revue qui le franchit est un fichier AJOUTE par
// le commit, sous son nom d'archive : c'est `neuves()` qui la rend.
const PALIER_MESURE = { compte: 12, tete: '2c11fdd9a', chemin: '.claude/soldes/revue-palier-82e95be10.md' }
const revueEnchainee = (o = {}) => revuePalier({ fenetre: `${PALIER_MESURE.tete}..aaaaaaaaa`, ...o })
/** Une revue NEUVE stagee, nommee par son contenu (c'est ce que la porte exige). */
const neuve = (contenu, nom = nomDArchiveDeRevue(contenu)) => [{
  chemin: `.claude/soldes/${nom}`, nom, contenu,
}]

test('evaluate : palier <10 sans revue neuve -> solde seul suffit (silence)', () => {
  const d = evaluate({
    command: 'git commit -m "corrige #9"',
    today: TODAY,
    readSolde: () => solde(),
    palier: { ...PALIER_MESURE, compte: 9 },
  })
  assert.equal(d, null)
})

test('evaluate : palier >=10 sans revue neuve -> deny palier, quel que soit le solde', () => {
  const d = evaluate({
    command: 'git commit -m "corrige #9"',
    today: TODAY,
    readSolde: () => solde(),
    palier: { ...PALIER_MESURE, compte: 10 },
  })
  assert.ok(d)
  assert.match(d.reason, /[Pp]alier/)
  // Le refus rend la mesure VERIFIABLE : combien, depuis quoi, d'apres quelle revue -- et il NOMME le
  // fichier a ecrire, nom compris : c'est le nom qui porte la fenetre.
  assert.match(d.reason, /10 commits de substance depuis 2c11fdd9a/)
  assert.match(d.reason, /revue-palier-82e95be10\.md/)
  assert.match(d.reason, new RegExp(`revue-palier-${TODAY}-2c11fdd9a\\.md`))
  assert.ok(!/[^-]revue-palier\.md/.test(d.reason), 'aucun fichier « vivant » : la revue nait archivee')
})

test('evaluate : palier >=10 + revue neuve ENCHAINEE et conforme -> pass (solde encore requis)', () => {
  const d = evaluate({
    command: 'git commit -m "corrige #9"',
    today: TODAY,
    readSolde: () => solde(),
    palier: PALIER_MESURE,
    neuves: () => neuve(revueEnchainee()),
    dansHead: () => true,
  })
  assert.equal(d, null)
})

test('evaluate : revue neuve dont le CONTENU est trop maigre -> deny nomme', () => {
  const d = evaluate({
    command: 'git commit -m "corrige #9"',
    today: TODAY,
    readSolde: () => solde(),
    palier: { ...PALIER_MESURE, compte: 10 },
    neuves: () => neuve(revueEnchainee({ synth: 'court' })),
  })
  assert.ok(d)
  assert.match(d.reason, /Revue de palier NON CONFORME/)
  assert.match(d.reason, /trop maigre/)
})

test('evaluate : revue neuve dont le NOM ne repond pas au CONTENU -> deny qui dit les deux', () => {
  const contenu = revueEnchainee()
  const d = evaluate({
    command: 'git commit -m "corrige #9"',
    today: TODAY,
    readSolde: () => solde(),
    palier: PALIER_MESURE,
    neuves: () => neuve(contenu, 'revue-palier-2026-01-01-deadbee.md'),
  })
  assert.ok(d, 'un nom libre rendrait la suite des revues illisible')
  assert.match(d.reason, /la revue s'appelle revue-palier-2026-01-01-deadbee\.md/)
  assert.match(d.reason, new RegExp(`son contenu la nomme ${nomDArchiveDeRevue(contenu)}`))
})

test('evaluate : revue neuve dont la fenetre NE S’ENCHAINE PAS -> deny, base attendue NOMMEE', () => {
  const d = evaluate({
    command: 'git commit -m "corrige #9"',
    today: TODAY,
    readSolde: () => solde(),
    palier: PALIER_MESURE,
    neuves: () => neuve(revuePalier({ fenetre: '0139bd89c..aaaaaaaaa' })),
  })
  assert.ok(d, 'une revue qui saute une tranche d’histoire franchit le palier sans l’avoir jugee')
  assert.match(d.reason, /sa fenêtre part de 0139bd89c/)
  assert.match(d.reason, /base attendue : 2c11fdd9a/)
})

test('evaluate : revue neuve dont la TETE est hors de l’histoire de HEAD -> deny', () => {
  const d = evaluate({
    command: 'git commit -m "corrige #9"',
    today: TODAY,
    readSolde: () => solde(),
    palier: PALIER_MESURE,
    neuves: () => neuve(revueEnchainee()),
    dansHead: () => false,
  })
  assert.ok(d)
  assert.match(d.reason, /sa tête de fenêtre aaaaaaaaa n'est pas dans l'histoire de HEAD/)
})

test('evaluate : une revue neuve FAUSSE refuse le commit MEME hors palier et SANS fermeture', () => {
  // Une revue fausse entree dans l'histoire fausse toutes les mesures suivantes : elle se refuse la
  // ou elle nait, pas au palier d'apres.
  const d = evaluate({
    command: 'git commit -m "chore: pose la revue"',
    today: TODAY,
    readSolde: () => null,
    palier: { ...PALIER_MESURE, compte: 1 },
    neuves: () => neuve(revuePalier({ fenetre: '0139bd89c..aaaaaaaaa' })),
  })
  assert.ok(d)
  assert.match(d.reason, /Revue de palier NON CONFORME/)
})

test('evaluate : revue neuve conforme HORS palier -> acceptee (aucune fermeture, silence)', () => {
  const d = evaluate({
    command: 'git commit -m "chore: pose la revue"',
    today: TODAY,
    readSolde: () => null,
    palier: { ...PALIER_MESURE, compte: 1 },
    neuves: () => neuve(revueEnchainee()),
    dansHead: () => true,
  })
  assert.equal(d, null)
})

test('evaluate : la revue abregee autrement que la precedente reste ENCHAINEE (prefixe de sha)', () => {
  const d = evaluate({
    command: 'git commit -m "corrige #9"',
    today: TODAY,
    readSolde: () => solde(),
    palier: { ...PALIER_MESURE, tete: '2c11fdd9a3f4b6c7d8e9f0a1b2c3d4e5f6a7b8c9' },
    neuves: () => neuve(revueEnchainee()),
    dansHead: () => true,
  })
  assert.equal(d, null)
})

test('evaluate : palier INMESURABLE -> deny nomme, jamais un silence qui laisse fermer', () => {
  const d = evaluate({
    command: 'git commit -m "corrige #9"',
    today: TODAY,
    readSolde: () => solde(),
    palier: { compte: 0, tete: null, chemin: null, erreur: 'aucune des 3 revues archivees ne juge l’histoire de HEAD' },
  })
  assert.ok(d)
  assert.match(d.reason, /Palier INMESURABLE/)
  assert.match(d.reason, /aucune des 3 revues archivees/)
})

// -- La MESURE, sur un depot JETABLE ---------------------------------------------------------------
/** Depot jetable : la revue s'y ecrit DIRECTEMENT sous son nom d'archive, comme dans le dispositif. */
function depotAvecRevues() {
  const { racine: depot, sha: racine } = instanceDeDepot({ fichiers: { 'scripts/racine.txt': 'racine' }, message: 'racine' })
  const git = (...args) => execFileSync('git', args, { cwd: depot, env: envDeDepotForge(), encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
  mkdirSync(join(depot, '.claude', 'soldes'), { recursive: true })
  const commit = (marque, dossier = 'scripts') => {
    mkdirSync(join(depot, dossier), { recursive: true })
    writeFileSync(join(depot, dossier, `${marque}.txt`), marque)
    git('add', '-A')
    git('commit', '-q', '-m', marque)
    return git('rev-parse', 'HEAD').trim()
  }
  /** Ecrit la revue sous SON nom d'archive (elle nait archivee) et rend son chemin relatif. */
  const poser = (base, tete) => {
    const contenu = `# PALIER (${TODAY})\n\nverdict: CONFIRMÉ\n${'A'.repeat(90)}\n\n\`${base}..${tete}\`\n`
    const nom = nomDArchiveDeRevue(contenu)
    writeFileSync(join(depot, '.claude', 'soldes', nom), contenu)
    return { nom, chemin: `.claude/soldes/${nom}`, contenu }
  }
  return { depot, git, commit, racine, poser }
}

test('mesureDuPalier : compte les commits de substance depuis la derniere revue de HEAD', () => {
  const { depot, git, commit, racine, poser } = depotAvecRevues()
  try {
    poser('0000000', racine)
    git('add', '-A'); git('commit', '-q', '-m', 'revue de palier')
    assert.equal(mesureDuPalier(depot).compte, 0, 'un commit hors src/scripts n’est pas de la substance')
    commit('a'); commit('b')
    const m = mesureDuPalier(depot)
    assert.equal(m.compte, 2)
    assert.equal(m.tete, racine)
    assert.equal(m.chemin, `.claude/soldes/revue-palier-${TODAY}-0000000-${racine}.md`)
    // Le commit que l'index s'apprete a faire compte AUSSI : c'est lui qui franchit le palier.
    writeFileSync(join(depot, 'scripts', 'c.txt'), 'c')
    git('add', '-A')
    assert.equal(mesureDuPalier(depot).compte, 3)
  } finally { rmSync(depot, { recursive: true, force: true }) }
})

test('MORSURE : la revue neuve du commit REMET le palier a zero — elle est dans HEAD tout de suite', () => {
  // Ce que ce test verrouille : la revue entre dans HEAD AVEC le commit qui la porte, donc la mesure
  // qui suit part de SA tete. Une revue qui ne deviendrait ARCHIVE qu'apres coup laisserait le palier
  // a 11 des deux cotes du commit, sur la meme tete -- palier franchi, mesure inchangee.
  const { depot, git, commit, racine, poser } = depotAvecRevues()
  try {
    poser('0000000', racine)
    git('add', '-A'); git('commit', '-q', '-m', 'revue fondatrice')
    for (let i = 0; i < 11; i += 1) commit(`substance-${i}`)
    const avant = mesureDuPalier(depot)
    assert.equal(avant.compte, 11, 'palier atteint')

    const tete = git('rev-parse', 'HEAD').trim()
    const revue = poser(racine, tete)
    git('add', '-A')
    // Vue depuis l'index, la revue est NEUVE : c'est elle que la porte valide.
    const vues = revuesNeuves(depot)
    assert.deepEqual(vues.map((r) => r.chemin), [revue.chemin])
    assert.deepEqual(
      problemesDeRevueNeuve(vues[0], { today: TODAY, palier: avant, dansHead: (sha) => estDansHead(sha, { cwd: depot }) }),
      [],
    )

    git('commit', '-q', '-m', 'chore: revue de palier')
    const apres = mesureDuPalier(depot)
    assert.equal(apres.compte, 0, 'le palier REPART : la revue est dans HEAD des son commit')
    assert.equal(apres.tete, tete)
    assert.equal(apres.chemin, revue.chemin)
  } finally { rmSync(depot, { recursive: true, force: true }) }
})

test('mesureDuPalier : une revue dont la TETE de fenetre est ORPHELINE ne juge rien -- et le DIT', () => {
  const { depot, git, poser } = depotAvecRevues()
  try {
    poser('0000000', '82e95be10')
    git('add', '-A'); git('commit', '-q', '-m', 'revue orpheline')
    const m = mesureDuPalier(depot)
    assert.match(m.erreur, /aucune des 1 revues archivées ne juge l'histoire de HEAD/)
    assert.match(m.erreur, new RegExp(`revue-palier-${TODAY}-0000000-82e95be10\\.md`))
  } finally { rmSync(depot, { recursive: true, force: true }) }
})

test('mesureDuPalier : entre deux revues, la plus PROCHE de HEAD fait reference', () => {
  const { depot, git, commit, racine, poser } = depotAvecRevues()
  try {
    const suivant = commit('a')
    poser('0000000', racine)
    poser('1111111', suivant)
    poser('2222222', '82e95be10')
    git('add', '-A'); git('commit', '-q', '-m', 'revues')
    const m = mesureDuPalier(depot)
    assert.equal(m.chemin, `.claude/soldes/revue-palier-${TODAY}-1111111-${suivant}.md`)
    assert.equal(m.compte, 0, 'aucun commit de substance depuis la plus recente')
  } finally { rmSync(depot, { recursive: true, force: true }) }
})

test('FORME du commit : une revue stagee HORS des pathspecs ne franchit RIEN, et le refus la NOMME', () => {
  // La forme par pathspec est celle que recommande le regime d'arbre partage : elle n'emporte QUE
  // les chemins nommes. Une revue laissee dans l'index n'entre alors pas dans l'histoire -- le palier
  // ne repart pas -- alors que la fermeture, elle, passerait. C'est la porte du COMMIT qui decide de
  // ce qui compte, jamais l'index nu : meme regle que pour le solde.
  const { depot, git, commit, racine, poser } = depotAvecRevues()
  try {
    poser('0000000', racine)
    git('add', '-A'); git('commit', '-q', '-m', 'revue fondatrice')
    for (let i = 0; i < 11; i += 1) commit(`substance-${i}`)
    const palier = mesureDuPalier(depot)
    assert.equal(palier.compte, 11, 'palier atteint')

    const tete = git('rev-parse', 'HEAD').trim()
    const revue = poser(racine, tete)
    mkdirSync(join(depot, '.claude', 'soldes'), { recursive: true })
    writeFileSync(join(depot, '.claude', 'soldes', '1.md'), solde())
    writeFileSync(join(depot, 'scripts', 'b.mjs'), '// b\n')
    git('add', '-A')

    /** La MEME chaine que le hook : forme du commit -> fichiers emportes -> revues emportees. */
    const juger = (command) => {
      const c = diffDuCommit(command, depot)
      const { fichiers } = analyzeDiffDuCommit(c.numstat())
      const { emportees, omises } = revuesDuCommit(revuesNeuves(depot), fichiers)
      return evaluate({
        command,
        today: TODAY,
        readSolde: (n) => c.contenu(`.claude/soldes/${n}.md`),
        palier,
        neuves: () => emportees.map((r) => ({ ...r, contenu: c.contenu(r.chemin) ?? r.contenu })),
        omises: () => omises,
        dansHead: (sha) => estDansHead(sha, { cwd: depot }),
      })
    }

    const omettant = 'git commit -m "corrige #1 : truc" -- scripts/b.mjs .claude/soldes/1.md'
    const refus = juger(omettant)
    assert.ok(refus, 'fermeture AUTORISEE alors que la revue ne part pas : le palier ne repartirait pas')
    assert.match(refus.reason, /Palier atteint/)
    assert.match(refus.reason, new RegExp(`${revue.chemin.replace(/[.]/g, '\\.')} est écrite et stagée mais NON EMPORTÉE`))
    assert.match(refus.reason, /par pathspec n'emporte QUE les chemins nommés/)

    assert.equal(juger(`${omettant} ${revue.chemin}`), null, 'la revue nommee dans les pathspecs franchit le palier')
    assert.equal(juger('git commit -m "corrige #1 : truc"'), null, 'forme INDEX : tout le stage part')
    assert.equal(juger('git commit -am "corrige #1 : truc"'), null, 'forme -a : tout le suivi modifie part')
  } finally { rmSync(depot, { recursive: true, force: true }) }
})

test('revuesDuCommit : le partage stagees/emportees se lit sur les chemins du commit', () => {
  const stagees = [{ chemin: '.claude/soldes/revue-palier-2026-09-04-abcdef1.md', nom: 'x.md', contenu: 'x' }]
  assert.deepEqual(revuesDuCommit(stagees, ['.claude/soldes/revue-palier-2026-09-04-abcdef1.md']).omises, [])
  assert.deepEqual(revuesDuCommit(stagees, ['src/a.ts']).emportees, [])
  assert.deepEqual(revuesDuCommit(stagees, ['src/a.ts']).omises, [stagees[0].chemin])
  // Les chemins que git rend sous Windows peuvent porter des antislashs : un seul sens de barre.
  assert.equal(revuesDuCommit(stagees, ['.claude\\soldes\\revue-palier-2026-09-04-abcdef1.md']).emportees.length, 1)
  assert.deepEqual(revuesDuCommit(undefined, undefined), { emportees: [], omises: [] })
})

test('CAS REEL : la CHAINE des revues de HEAD est continue, et chaque tete est dans l’histoire', () => {
  // Controle POSITIF sur l'arbre reel, lu dans HEAD SEULEMENT (cette gate tourne en lane parallele :
  // l'index et le disque appartiennent a qui commite). La chaine se remonte de la plus recente vers
  // sa base ; elle compte 1 maillon tant que la revue du palier courant n'est pas committee, 2 des
  // qu'elle l'est.
  const racine = repoRoot()
  const lireDeHead = (chemin) =>
    execFileSync('git', ['show', `HEAD:${chemin}`], { cwd: racine, encoding: 'utf8', maxBuffer: 1 << 26 })
  const archives = archivesDe(racine)
  assert.ok(archives.length >= 10, `corpus de ${archives.length} revues dans HEAD`)
  const derniere = derniereRevueArchivee(racine)
  assert.equal(derniere.etat, 'trouvee', JSON.stringify(derniere))

  const parTete = new Map(archives.filter((a) => a.tete).map((a) => [a.tete, a]))
  const chaine = [derniere]
  while (chaine.at(-1).base && parTete.has(chaine.at(-1).base)) chaine.push(parTete.get(chaine.at(-1).base))
  assert.ok(
    chaine.length >= 1,
    `chaine de ${chaine.length} maillon(s) — attendu au moins la derniere revue (${derniere.chemin})`,
  )
  for (const maillon of chaine) {
    assert.ok(
      estDansHead(maillon.tete, { cwd: racine }),
      `${maillon.chemin} : sa tete ${maillon.tete} n’est pas dans l’histoire de HEAD`,
    )
  }
  // Les revues ecrites sous la regle en vigueur portent une DATE dans leur nom : pour celles-la, le
  // nom repond au contenu. Les plus anciennes portent le sha de leur commit consommateur — git a
  // leur histoire, et c'est leur FENETRE, jamais leur nom, que la mesure lit. Le nom courant porte
  // les DEUX bornes (#1679 L3b) ; les graphies anterieures restent acceptees telles quelles — une
  // archive committee ne se renomme pas.
  const nommeesParLeurFenetre = archives.filter((a) => /revue-palier-\d{4}-\d{2}-\d{2}-/.test(a.chemin))
  for (const a of nommeesParLeurFenetre) {
    const acceptes = nomsDArchiveAcceptes(lireDeHead(a.chemin)).map((n) => `.claude/soldes/${n}`)
    assert.ok(
      acceptes.includes(a.chemin),
      `${a.chemin} : son nom ne repond pas a son contenu (accepte : ${acceptes.join(', ')})`,
    )
  }
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
test('analyzeDiffDuCommit : touche src/**, compte les lignes', () => {
  const raw = '5\t2\tsrc/engine/character.ts\n1\t0\tdocs/plans/truc.md\n'
  const r = analyzeDiffDuCommit(raw)
  assert.equal(r.touchesSrc, true)
  assert.equal(r.totalLines, 8)
})

test('analyzeDiffDuCommit : docs-only ne touche pas src', () => {
  const raw = '10\t3\tdocs/architecture.md\n'
  const r = analyzeDiffDuCommit(raw)
  assert.equal(r.touchesSrc, false)
})

test('analyzeDiffDuCommit : vide/absent → aucune touche, 0 ligne', () => {
  assert.deepEqual(analyzeDiffDuCommit(''), { touchesSrc: false, touchesUi: false, totalLines: 0, fichiers: [] })
  assert.deepEqual(analyzeDiffDuCommit(undefined), { touchesSrc: false, touchesUi: false, totalLines: 0, fichiers: [] })
})

test('analyzeDiffDuCommit : touche src/ui/** → touchesUi', () => {
  const raw = '3\t1\tsrc/ui/RollShell.tsx\n'
  const r = analyzeDiffDuCommit(raw)
  assert.equal(r.touchesSrc, true)
  assert.equal(r.touchesUi, true)
})

test('analyzeDiffDuCommit : src/** hors src/ui/** → touchesUi false', () => {
  const raw = '3\t1\tsrc/engine/combat.ts\n'
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
    '50\t20\tsrc/ui/RollShell.tsx',
    '3\t1\tscripts/hooks/solde-ticket-guard.mjs',
    '1\t0\t.claude/settings.json',
  ].join('\n')
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

test('extractCommitPathspecs : "git commit -- <paths> -m <msg>" → les 2 chemins, message exclu', () => {
  const cmd = 'git commit -- scripts/hooks/x.mjs .claude/settings.json -m "corrige #591"'
  assert.deepEqual(extractCommitPathspecs(cmd), ['scripts/hooks/x.mjs', '.claude/settings.json'])
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

test('extractCommitPathspecs : "-am" + pathspec après -- → le pathspec seul, message exclu', () => {
  const cmd = 'git commit -- src/ui/Foo.tsx -am "feat: refonte truc"'
  assert.deepEqual(extractCommitPathspecs(cmd), ['src/ui/Foo.tsx'])
})

test('extractCommitPathspecs : "-cam" (short groupé à 3 lettres) → message exclu, [] (index entier)', () => {
  assert.deepEqual(extractCommitPathspecs('git commit -cam "feat: refonte truc"'), [])
})

test('formeDuCommit : "-am" est un `-a`, et son MESSAGE n\'est pas un pathspec', () => {
  const f = formeDuCommit('git commit -am "feat: refonte truc"')
  assert.deepEqual([f.forme, f.pathspecs], ['tout', []])
  const r = analyzeDiffDuCommit('50\t20\tsrc/ui/RollShell.tsx\n')
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

test('extractCommitPathspecs : "--message=" multi-mots + pathspec réel après -- → seul le pathspec', () => {
  const cmd = 'git commit -- src/ui/Foo.tsx --message="feat refonte ref #501"'
  assert.deepEqual(extractCommitPathspecs(cmd), ['src/ui/Foo.tsx'])
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
  assert.deepEqual(extractMessageSources(''), { text: '', fileError: null })
})

// ── evaluate/evaluateAntiEsquive sur le texte étendu (-F) — intégration bout en bout ───────────────
test('intégration -F : fermeture via -F sans solde → deny (invisible avec l\'ancien driver, visible maintenant)', () => {
  const { text } = extractMessageSources('git commit -F commit-415.txt', { readFile: () => 'corrige #415' })
  const d = evaluate({ command: text, today: TODAY, readSolde: () => null })
  assert.ok(d)
  assert.match(d.reason, /#415/)
})

test('intégration -F : fermeture via -F avec solde conforme → pass', () => {
  const { text } = extractMessageSources('git commit -F commit-415.txt', { readFile: () => 'corrige #415' })
  const d = evaluate({ command: text, today: TODAY, readSolde: () => solde() })
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
  const cmd = 'gh api -X PATCH repos/cgauche/game/issues/comments/42 -F body=@rapport.md'
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
  const cmd = 'gh issue comment 1614 --repo cgauche/game --body-file rapport.md'
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
    readSolde: () => solde(),
    soldeOnDisk: () => solde(),
  })
  assert.equal(d, null)
})

test('evaluate : solde conforme sur le DISQUE mais absent de l\'index → deny actionnable (git add)', () => {
  const d = evaluate({
    command: 'git commit -m "corrige #77"',
    today: TODAY,
    readSolde: () => null,
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
    readSolde: () => null,
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
    const git = (...args) => execFileSync('git', args, { cwd: repo, env: envDeDepotForge(), stdio: ['ignore', 'pipe', 'ignore'] })
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
    'gh api repos/cgauche/game/issues/1636 -X PATCH -f state=closed',
    'gh api repos/cgauche/game/issues/1636 --method PATCH --field state=closed',
  ]) {
    const d = evaluateFermetureHorsCommit(cmd)
    assert.ok(d, `passé en silence : ${cmd}`)
    assert.equal(d.decision, 'deny')
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
    'gh api -X PATCH /repos/cgauche/game/issues/1679 --input corps.json',
    'gh api --method PATCH /repos/o/r/issues/1 --input=corps.json',
    'bash -lc "gh api -X PATCH /repos/o/r/issues/1 --input corps.json"',
  ]) {
    const d = evaluateFermetureHorsCommit(cmd, { lire })
    assert.ok(d, `passé en silence : ${cmd}`)
    assert.equal(d.decision, 'deny')
    assert.match(d.reason, /la fermeture passe par un commit/)
  }
})

test('evaluateFermetureHorsCommit : les gestes `--input` qui ne peuvent pas FERMER passent en silence', () => {
  // Au PreToolUse le corps est souvent écrit APRÈS (par la commande elle-même) : refuser sur un
  // fichier absent mordrait 4 gestes routiniers (sonde J4). Le corps n'est lu que sur l'endpoint
  // d'UN ticket et une méthode qui ÉCRIT.
  const absent = () => { throw new Error('ENOENT') }
  for (const cmd of [
    'gh api repos/cgauche/game/issues --input body.json',
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
  assert.equal(d?.decision, 'deny')
  assert.match(d.reason, /illisible ou non-JSON/)
  assert.match(d.reason, /absent\.json/)
})

// ── Arbre PRINCIPAL vs worktree ───────────────────────────────────────────────────────────────────
test('estArbrePrincipal : `.git` DOSSIER = principal, `.git` FICHIER = worktree lié', () => {
  const base = mkdtempSync(join(tmpdir(), 'solde-arbre-'))
  try {
    mkdirSync(join(base, 'principal', '.git'), { recursive: true })
    mkdirSync(join(base, 'principal', 'src'), { recursive: true })
    mkdirSync(join(base, 'lie'), { recursive: true })
    writeFileSync(join(base, 'lie', '.git'), 'gitdir: ../principal/.git/worktrees/lie\n', 'utf8')

    assert.equal(estArbrePrincipal(join(base, 'principal')), true)
    assert.equal(estArbrePrincipal(join(base, 'principal', 'src')), true, 'un sous-dossier remonte à son arbre')
    assert.equal(estArbrePrincipal(join(base, 'lie')), false)
  } finally {
    rmSync(base, { recursive: true, force: true })
  }
})

// ── Chemin d'écriture résolu UNE fois ; hors du contenu versionné sur preuve positive seulement (#1973) ────
/** Graphie MSYS (`/c/Users/…`) d'un chemin win32 absolu. */
const versMsys = (p) => '/' + p[0].toLowerCase() + p.slice(2).replace(/\\/g, '/')
const ecriture = (file_path, opts) => cheminDEcriture({ file_path }, opts)

test('cheminDEcriture : dans un dépôt, racine + relatif, contenu versionné — graphie native ou MSYS', () => {
  const { racine } = instanceDeDepot()
  try {
    const cible = join(racine, 'src', 'data', 'x.json')
    const natif = ecriture(cible)
    assert.equal(natif.horsContenu, false)
    assert.equal(natif.relatif, 'src/data/x.json')
    assert.notEqual(natif.racine, null)
    if (process.platform === 'win32') assert.deepEqual(ecriture(versMsys(cible)), natif, 'MSYS = natif')
    assert.equal(cheminDEcriture({ path: cible }).horsContenu, false, '`path` quand `file_path` manque')
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
  assert.equal(cheminDEcriture({}), null)
  assert.equal(ecriture(''), null)
  const absent = process.platform === 'win32'
    ? [...'ZYXWVUTSRQPONMLKJIHGFE'].find((l) => !existsSync(`${l}:\\`))
    : null
  if (absent) assert.equal(ecriture(`${absent}:\\nope\\x.json`).horsContenu, false, `lecteur ${absent}: absent`)
})

test('evaluateArbrePrincipal : `ask` (jamais deny) dans l\'arbre principal, silence en worktree', () => {
  const d = evaluateArbrePrincipal({ command: 'git commit -m "x"', principal: true, fichiersEmportes: ['src/a.ts'] })
  assert.ok(d)
  assert.equal(d.decision, 'ask')
  assert.match(d.reason, /src\/a\.ts/)
  assert.match(d.reason, /\.wt-<ticket>-L<n>/)
  assert.equal(evaluateArbrePrincipal({ command: 'git commit -m "x"', principal: false }), null)
  assert.equal(evaluateArbrePrincipal({ command: 'git status', principal: true }), null)
})

// ── `git commit -- <paths>` : l'ARBRE, pas l'index ────────────────────────────────────────────────
test('evaluateHunksEmportes : chemin nommé stagé ET modifié → deny', () => {
  const d = evaluateHunksEmportes({
    command: 'git commit -m "x" -- src/a.ts',
    fichiersModifies: ['src/a.ts', 'src/b.ts'],
    fichiersStages: ['src/a.ts'],
  })
  assert.ok(d)
  assert.equal(d.decision, 'deny')
  assert.match(d.reason, /prend le contenu de l'ARBRE et ignore l'index/)
})

test('evaluateHunksEmportes : chemin nommé modifié SEULEMENT → contexte, jamais un refus', () => {
  const d = evaluateHunksEmportes({
    command: 'git commit -m "x" -- src/a.ts',
    fichiersModifies: ['src/a.ts'],
    fichiersStages: ['src/b.ts'],
  })
  assert.ok(d)
  assert.equal(d.decision, undefined)
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
  const r = analyzeDiffDuCommit('40\t5\tsrc/gameIso/stage/GameStage3D.tsx\n')
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
    execFileSync('git', ['init', '-q', '-b', 'main'], { cwd: base, env: envDeDepotForge(), encoding: 'utf8' })
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

test('estDansHead / fichiersDuCommitGit : le cas fondateur #584 tient contre git RÉEL', () => {
  // Un clone SUPERFICIEL (CI sans `fetch-depth: 0`) ne porte pas 4d6e1ff78 : le test doit dire QUOI
  // corriger, jamais verdir sur une histoire qu'il n'a pas lue.
  assert.equal(
    execFileSync('git', ['rev-parse', '--is-shallow-repository'], { cwd: repoRoot(), encoding: 'utf8' }).trim(),
    'false',
    'dépôt SUPERFICIEL : ce test lit l\'HISTOIRE — poser `fetch-depth: 0` sur le `actions/checkout` du job qui joue `test:hooks`.',
  )
  assert.equal(estDansHead('4d6e1ff78', { cwd: repoRoot() }), true)
  assert.ok(
    fichiersDuCommitGit('4d6e1ff78', repoRoot()).includes('src/data/schemas/defs/teintesJeu.ts'),
    '4d6e1ff78 ne touche pas le fichier que le solde #584 lui attribue',
  )
  assert.equal(estDansHead('0000000000000000000000000000000000000000', { cwd: repoRoot() }), false)
  // La LIGNE que le solde #584 cite est bien dans un hunk de ce commit — lue au diff, pas sur parole.
  const lignes = lignesDeHunks(diffDunSha('4d6e1ff78', 'src/data/schemas/defs/teintesJeu.ts', repoRoot()))
  assert.ok(lignes.includes(88), `lignes vues : ${lignes.join(',')}`)
  assert.deepEqual(lignesDeHunks(diffDunSha('4d6e1ff78', 'docs/architecture.md', repoRoot())), [])
})

test('le solde #584 de l\'arbre est CONFORME à sa propre grammaire', () => {
  // Même fail-loud que ci-dessus : sur un clone superficiel, ce solde serait déclaré FAUX alors que
  // c'est l'histoire qui manque.
  assert.equal(
    execFileSync('git', ['rev-parse', '--is-shallow-repository'], { cwd: repoRoot(), encoding: 'utf8' }).trim(),
    'false',
    'dépôt SUPERFICIEL : ce test lit l\'HISTOIRE — poser `fetch-depth: 0` sur le `actions/checkout` du job qui joue `test:hooks`.',
  )
  const contenu = readFileSync(join(repoRoot(), '.claude', 'soldes', '584.md'), 'utf8')
  const r = validateSolde(contenu, '2026-09-02', {
    commitEstAncetre: (sha) => estDansHead(sha, { cwd: repoRoot() }),
    fichiersDuCommit: (sha) => fichiersDuCommitGit(sha, repoRoot()),
    lignesDuCommit: (sha, fichier) => lignesDeHunks(diffDunSha(sha, fichier, repoRoot())),
  })
  assert.equal(r.ok, true, r.problems.join(' ; '))
})

// ── C2/C3/C4/C5 : les règles resserrées après le juge de diff ─────────────────────────────────────
test('fichiersDuCommitGit : un RENOMMAGE rend les deux chemins NUS, jamais « {ancien => nouveau} »', () => {
  // Mesuré sur 26be12347 : `.claude/soldes/revue-palier.md` renommée en `revue-palier-2205fde51.md`.
  // Sans `--no-renames`, `git show --numstat` rend UNE ligne agrégée qu'aucun chemin cité n'égale —
  // un solde JUSTE était refusé.
  const { racine: repo } = instanceDeDepot({ fichiers: { 'src/ancien.ts': 'export const a = 1\n'.repeat(20) }, message: 'socle' })
  try {
    const git = (...args) => execFileSync('git', args, { cwd: repo, env: envDeDepotForge(), encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
    execFileSync('git', ['mv', 'src/ancien.ts', 'src/nouveau.ts'], { cwd: repo, env: envDeDepotForge(), stdio: 'ignore' })
    git('commit', '-q', '--no-verify', '-am', 'renomme')
    const sha = git('rev-parse', 'HEAD').trim()

    const touches = fichiersDuCommitGit(sha, repo)
    assert.ok(touches.includes('src/nouveau.ts'), `chemins rendus : ${JSON.stringify(touches)}`)
    assert.ok(touches.includes('src/ancien.ts'), `chemins rendus : ${JSON.stringify(touches)}`)
    assert.deepEqual(touches.filter((f) => f.includes('=>')), [], 'un chemin agrégé « {a => b} » reste illisible pour un solde')
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
  assert.equal(d.decision, undefined, 'jamais un refus : `-a` est un geste légitime')
  assert.match(d.contexte, /src\/b\.ts/)
  assert.doesNotMatch(d.contexte, /src\/a\.ts/, 'ce que l\'index porte déjà n\'est pas une surprise')
  assert.equal(evaluateHunksEmportes({ command: 'git commit -a -m "x"', fichiersModifies: [], fichiersStages: [] }), null)
})

// ── L'ASCENDANCE INDISPONIBLE n'est pas un « non » (#1679 L3 T2) ─────────────────────────────────
// `estDansHead` rend `false` pour un sha INCONNU, jamais pour une lecture qui n'a pas eu lieu : sans
// cela, hors dépôt ou git absent, le refus dirait « ce commit n'est pas dans cette histoire » — un
// motif faux.
test('estDansHead HORS dépôt : JETTE une indisponibilité nommée, ne rend pas false', () => {
  const hors = mkdtempSync(join(tmpdir(), 'hors-depot-'))
  try {
    assert.throws(() => estDansHead('4d6e1ff78', { cwd: hors }), (e) => {
      assert.ok(e instanceof GitIndisponible)
      assert.match(e.raison, /not a git repository/i)
      return true
    })
  } finally {
    rmSync(hors, { recursive: true, force: true })
  }
})

test('jugerOuNommerLIndisponible : le refus NOMME ce que git n’a pas lu ; toute autre erreur remonte', () => {
  const vu = jugerOuNommerLIndisponible(() => { throw new GitIndisponible('not a git repository') })
  assert.equal(vu.decision, 'deny')
  assert.match(vu.reason, /ascendance indisponible : not a git repository/)
  assert.equal(jugerOuNommerLIndisponible(() => null), null)
  assert.throws(() => jugerOuNommerLIndisponible(() => { throw new TypeError('un vrai bug') }), TypeError)

  // La CAUSE VRAIE prime sur ce que git a bredouillé : un répertoire hors dépôt n'est ni un git
  // absent ni un cwd manquant, et « unknown option `cached' » ne désignait aucune correction.
  const hors = jugerOuNommerLIndisponible(
    () => { throw new GitIndisponible('error: unknown option `cached\'') },
    { cwd: '/base/scratchpad', horsDepot: true },
  )
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
// faisait refuser « ascendance indisponible » un geste que git exécutait (sondes 1-2 du ticket).
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

test('evaluateArbrePrincipal derrière un `Set-Location` : silence en worktree LIÉ, `ask` vers l’arbre PRINCIPAL', () => {
  const base = mkdtempSync(join(tmpdir(), 'arbres-'))
  try {
    mkdirSync(join(base, 'principal', '.git'), { recursive: true })
    mkdirSync(join(base, 'lie'), { recursive: true })
    writeFileSync(join(base, 'lie', '.git'), 'gitdir: ../principal/.git/worktrees/lie\n', 'utf8')
    const commit = (mot, ou) => `${mot} ${ou}; git commit -m "fix(x): refs #1729"`
    const jugement = (cmd) => evaluateArbrePrincipal({
      command: cmd,
      principal: estArbrePrincipal(extractTargetDir(cmd, join(base, 'principal'))),
    })
    assert.equal(jugement(commit('Set-Location', '../lie')), null, 'un commit en worktree lié ne demande rien')
    const versPrincipal = jugement(commit('Set-Location', join(base, 'principal')))
    assert.equal(versPrincipal?.decision, 'ask', 'le faux négatif inverse : un commit dans l’arbre principal reste demandé')
  } finally {
    rmSync(base, { recursive: true, force: true })
  }
})

test('avecCibleIgnoree : le refus DIT le répertoire écarté ; sans écart, il n’est pas touché', () => {
  const refus = { decision: 'ask', reason: '⚠ Commit dans l’ARBRE PRINCIPAL' }
  const dit = avecCibleIgnoree(refus, { chemin: '/base/.wt-x', raison: 'répertoire inexistant au moment du contrôle' })
  assert.equal(dit.decision, 'ask')
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

test('problemesDeRevueNeuve SANS lecteur d’ascendance : le contrôle est DIT non joué, jamais présumé vrai', () => {
  const contenu = revueEnchainee()
  const [revue] = neuve(contenu)
  const problemes = problemesDeRevueNeuve(revue, { today: TODAY, palier: PALIER_MESURE })
  assert.equal(problemes.length, 1)
  assert.match(problemes[0], /n'a pas pu être vérifiée : aucun lecteur d'ascendance/)
  assert.deepEqual(
    problemesDeRevueNeuve(revue, { today: TODAY, palier: PALIER_MESURE, dansHead: () => true }),
    [],
  )
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
    execFileSync('git', ['rm', '-q', '-r', '--cached', '.claude/skills/b'], { cwd: racine, env: envDeDepotForge(), stdio: ['ignore', 'pipe', 'ignore'] })
    const image = listeurDImage(['ls-files', '--cached'], racine)
    const preImage = listeurDImage(['ls-tree', '--name-only', 'HEAD'], racine)
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
    assert.deepEqual(listeurDImage(['ls-files', '--cached'], vide)('.claude/skills'), [])
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
