// Bancs de la porte du commit (`scripts/git-hooks/porte-du-commit.mjs`) : la fermeture de ticket au
// commit exige un SOLDE écrit conforme, avec sa propre réfutation adversariale (demande 2026-07-14). Les
// évaluateurs lisent le MESSAGE que git enregistre (`lectureDuMessage`) ; les bancs de bout en bout,
// `git commit` réel compris, vivent dans `scripts/git-hooks/commit-msg.test.mjs`.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Buffer } from 'node:buffer'
import { join } from 'node:path'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import {
  validateSolde,
  evaluate,
  validateRefFile,
  evaluateAntiEsquive,
  evaluatePorteDuTicket,
  analyzeDiffDuCommit,
  ticketsDuRegistre,
  evaluateRegistresPorteurs,
  validateJugeFile,
  validateJugeVisionFile,
  evaluateJuge,
  diffDuCommit,
  readSoldeFile,
  readRefFile,
  restesItems,
  restesRoutants,
  compteSections,
  lignesDeHunks,
  verifierCapture,
  verifierCaptures,
  soldesEmportes,
  histoireDesCitations,
  jugerOuConfier,
  refusDesPannes,
  evaluateBudgetContexte,
  evaluateReclassementsCss,
  fichiersCitantTickets,
  listeurDuBudget,
  jugerLeCommit,
  shasCitesDuSolde,
} from './porte-du-commit.mjs'
import { estFichierEcran, sectionDe } from '../guards/lib/livraison.mjs'
import { tombalesDansSource, evaluateTombale, EXEMPTIONS_TOMBALE } from './solde-tombale.mjs'
import { GitIndisponible, INDEX, ceQueFaitLeCommit, depotDe, histoireDeHead } from '../guards/lib/gitPorte.mjs'
import { depotReel, envDeDepotForge, envGitFeint, ENV_GIT_FEINT, instanceDeDepot, sousGitFeint } from '../guards/lib/depotGabarit.mjs'
import { gitDe, gitDeLArbreReel, lancerGit, lancesDeGit, resultatDeGit, sousCommande } from '../test/gitDeBanc.mjs'

const TODAY = '2026-07-14'
/** La racine du dépôt, ancrée sur l'emplacement de ce banc. */
const RACINE = fileURLToPath(new URL('../../', import.meta.url))
const VERIFIE_OK = 'VERIFIE: relu le diff complet, lancé npm test et vérifié les 3 fichiers touchés à la main.'
const REFUTATION_OK = 'Un juge adversarial a rejoué le diff contre le DoD du ticket, tenté 2 contournements, aucun ne passe.'

const solde = ({ restes = 'RAS', verdict = 'CONFIRMÉ', date = TODAY } = {}) =>
  `${VERIFIE_OK}\n\n## Restes\n${restes}\n\n## Réfutation\nverdict: ${verdict}\n${REFUTATION_OK}\n\n(${date})\n`

/** Le lecteur de soldes d'`evaluate` (`readSoldes`) qui lit chacun par `lire(n)`. */
const parTicket = (lire) => (ns) => ns.map(lire)

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
  const d = evaluate({ message: 'wip', today: TODAY, readSoldes: () => { throw new Error('ne doit pas être appelé') } })
  assert.equal(d, null)
})

test('evaluate : solde conforme → silence (commit passe)', () => {
  const d = evaluate({ message: 'corrige #99', today: TODAY, readSoldes: parTicket(() => solde()) })
  assert.equal(d, null)
})

test('evaluate : solde absent → deny actionnable', () => {
  const d = evaluate({ message: 'corrige #99', today: TODAY, readSoldes: parTicket(() => null) })
  assert.ok(d && typeof d.reason === 'string')
  assert.match(d.reason, /#99/)
  assert.match(d.reason, /\.claude\/soldes\/99\.md/)
  assert.match(d.reason, /fichier absent/)
})

test('evaluate : `#N` nus énumérés après une clause de fermeture → refus qui les NOMME (92f57ea33)', () => {
  const d = evaluate({
    message: 'fix(tests): corrige #2225 #2114 + #2151/#2191 — lot',
    today: TODAY,
    readSoldes: parTicket(() => solde()),
  })
  assert.ok(d && typeof d.reason === 'string')
  assert.match(d.reason, /#2114, #2151, #2191 suit une clause de fermeture/)
  assert.match(d.reason, /`corrige #2114`, `corrige #2151`, `corrige #2191`/)
  assert.match(d.reason, /`refs #2114 #2151 #2191`/)
  assert.equal(evaluate({ message: 'corrige #99, refs #1 #2', today: TODAY, readSoldes: parTicket(() => solde()) }), null)
})

test('evaluate : multi-fermeture — un seul solde manquant listé nommément', () => {
  const d = evaluate({
    message: 'corrige #1, ferme #2',
    today: TODAY,
    readSoldes: parTicket((n) => (n === 1 ? solde() : null)),
  })
  assert.ok(d)
  assert.doesNotMatch(d.reason, /#1 \(/)
  assert.match(d.reason, /#2 \(/)
})

test('evaluate : verdict RÉFUTÉ → deny même si le reste du solde est conforme', () => {
  const d = evaluate({ message: 'corrige #5', today: TODAY, readSoldes: parTicket(() => solde({ verdict: 'RÉFUTÉ' })) })
  assert.ok(d)
  assert.match(d.reason, /réfuté ne se ferme pas/)
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

// ── Le lot est celui de l'index que git a préparé (#591 défaut 1) ─────────────────────────────────
test('analyzeDiffDuCommit : lit le numstat TEL QUEL, sans second filtrage de chemins', () => {
  const raw = [
    entree(50, 20, 'src/ui/RollShell.tsx'),
    entree(3, 1, 'scripts/git-hooks/porte-du-commit.mjs'),
    entree(1, 0, '.claude/settings.json'),
  ]
  const r = analyzeDiffDuCommit(raw)
  assert.deepEqual(
    [r.touchesUi, r.touchesSrc, r.totalLines, r.fichiers.length], [true, true, 75, 3],
    'le numstat que git a rendu EST la portée : rien ne s’y retranche après coup',
  )
})

// ── evaluatePorteDuTicket (porte du ticket, option retenue le 2026-09-11) ───────────────────
const porte = (message, ...fichiersEmportes) => evaluatePorteDuTicket({ message, fichiersEmportes })

test('porte du ticket : un commit qui touche src/ sans aucun ticket est REFUSÉ, fichier nommé', () => {
  const d = porte('chore: une ligne de rien', 'src/state/combatFlow.ts')
  assert.ok(d, 'un commit de substance sans ticket doit être refusé')
  assert.match(d.reason, /src\/state\/combatFlow\.ts/)
  assert.match(d.reason, /refs #N/)
  assert.match(d.reason, /2026-09-11/, 'le refus porte le verbatim daté du régime')
})

test('porte du ticket : `scripts/` est de la substance au même titre que `src/`', () => {
  assert.ok(porte('chore: outillage', 'scripts/guards/lib/lister.mjs'))
})

test('porte du ticket : `refs #N` suffit, `corrige #N` aussi', () => {
  assert.equal(porte('feat: x (refs #1709)', 'src/x.ts'), null)
  assert.equal(porte('feat: x (corrige #1709)', 'src/x.ts'), null)
})

test('porte du ticket : docs/ et .claude/ seuls passent sans ticket (docs dérivés, mémoire)', () => {
  assert.equal(porte('chore(docs): régénéré', 'docs/architecture.md'), null)
  assert.equal(porte('chore: fiche', '.claude/memory/feedback-x.md', 'public/qc/a.png'), null)
})

test('porte du ticket : un fichier GÉNÉRÉ de src/ reste de la substance', () => {
  const d = porte('chore: regen', 'src/data/schemas/_registry.generated.ts')
  assert.ok(d, 'un dérivé committé sous src/ est du contenu de src/ : il cite son ticket')
  assert.match(d.reason, /_registry\.generated\.ts/)
})

// ── evaluateAntiEsquive ──────────────────────────────────────────────────────────────────────────
const REFUTATION_LINE_OK = 'REFUTATION: un juge adversarial a rejoué le diff et tenté 2 contournements, aucun ne passe.'

test('evaluateAntiEsquive : diff ne touche pas src → silence', () => {
  const d = evaluateAntiEsquive({ message: 'ref #371 doc', stagedTouchesSrc: false, stagedTotalLines: 100 })
  assert.equal(d, null)
})

test('evaluateAntiEsquive : diff < 10 lignes → silence (one-liner sur la suite verte)', () => {
  const d = evaluateAntiEsquive({ message: 'fix: typo, ref #371', stagedTouchesSrc: true, stagedTotalLines: 9 })
  assert.equal(d, null)
})

test('evaluateAntiEsquive : fermeture déjà couverte par evaluate() → silence', () => {
  const d = evaluateAntiEsquive({ message: 'corrige #9', stagedTouchesSrc: true, stagedTotalLines: 100 })
  assert.equal(d, null)
})

test('evaluateAntiEsquive : "ref #N" src touché sans réfutation → deny', () => {
  const d = evaluateAntiEsquive({
    message: 'feat: truc, ref #371',
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
    message: `feat: truc, ref #371\n\n${REFUTATION_LINE_OK}`,
    stagedTouchesSrc: true,
    stagedTotalLines: 100,
  })
  assert.equal(d, null)
})

test('evaluateAntiEsquive : "ref #N" avec ligne REFUTATION: trop courte → deny', () => {
  const d = evaluateAntiEsquive({
    message: 'feat: truc, ref #371\n\nREFUTATION: vu.',
    stagedTouchesSrc: true,
    stagedTotalLines: 100,
    readRefFile: () => null,
  })
  assert.ok(d)
})

test('evaluateAntiEsquive : "ref #N" avec fichier ref-N.md conforme → pass', () => {
  const d = evaluateAntiEsquive({
    message: 'feat: truc, ref #371',
    stagedTouchesSrc: true,
    stagedTotalLines: 100,
    readRefFile: (n) => (n === 371 ? refFile() : null),
  })
  assert.equal(d, null)
})

test('evaluateAntiEsquive : "ref #N" avec fichier ref-N.md non conforme → deny', () => {
  const d = evaluateAntiEsquive({
    message: 'feat: truc, ref #371',
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
    message: 'feat: refonte truc',
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

test('evaluateJuge : diff ne touche pas src → silence', () => {
  assert.equal(evaluateJuge({ message: 'ref #371 doc', stagedTouchesSrc: false, stagedTotalLines: 100 }), null)
})

test('evaluateJuge : diff < 10 lignes → silence', () => {
  assert.equal(evaluateJuge({ message: 'fix: typo', stagedTouchesSrc: true, stagedTotalLines: 9 }), null)
})

test('evaluateJuge : fermeture de ticket → silence (déjà couverte par le solde)', () => {
  assert.equal(evaluateJuge({ message: 'corrige #9', stagedTouchesSrc: true, stagedTotalLines: 100 }), null)
})

// Scope tranché #591 : évaluateJuge partage EXACTEMENT le déclencheur d'evaluateAntiEsquive — un
// `ref #N` rattaché, jamais un commit sans ticket du tout.
test('evaluateJuge : aucun ticket rattaché, src touché → silence (#591)', () => {
  const d = evaluateJuge({
    message: 'feat: refonte truc',
    stagedTouchesSrc: true,
    stagedTotalLines: 100,
    stagedTouchesUi: false,
    readRefFile: () => { throw new Error('ne doit pas être appelé — aucun ticket rattaché') },
  })
  assert.equal(d, null)
})

test('evaluateJuge : "ref #N" src touché sans ligne JUGE → deny', () => {
  const d = evaluateJuge({ message: 'feat: refonte truc, ref #501', stagedTouchesSrc: true, stagedTotalLines: 100, stagedTouchesUi: false })
  assert.ok(d)
  assert.match(d.reason, /JUGE:/)
})

test('evaluateJuge : "ref #N" src touché avec ligne JUGE: valide, hors UI → pass', () => {
  const d = evaluateJuge({
    message: `feat: refonte truc, ref #501\n\n${JUGE_LINE_OK}`,
    stagedTouchesSrc: true,
    stagedTotalLines: 100,
    stagedTouchesUi: false,
  })
  assert.equal(d, null)
})

test('evaluateJuge : "ref #N" ligne JUGE: trop courte → deny', () => {
  const d = evaluateJuge({ message: 'feat: truc, ref #501\n\nJUGE: vu.', stagedTouchesSrc: true, stagedTotalLines: 100 })
  assert.ok(d)
})

test('evaluateJuge : "ref #N" src/ui touché avec JUGE: seul (sans JUGE-VISION) → deny', () => {
  const d = evaluateJuge({
    message: `feat: bouton, ref #501\n\n${JUGE_LINE_OK}`,
    stagedTouchesSrc: true,
    stagedTotalLines: 100,
    stagedTouchesUi: true,
  })
  assert.ok(d)
  assert.match(d.reason, /JUGE-VISION/)
})

test('evaluateJuge : "ref #N" src/ui touché avec JUGE: et JUGE-VISION: → pass', () => {
  const d = evaluateJuge({
    message: `feat: bouton, ref #501\n\n${JUGE_LINE_OK}\n${JUGE_VISION_LINE_OK}`,
    stagedTouchesSrc: true,
    stagedTotalLines: 100,
    stagedTouchesUi: true,
  })
  assert.equal(d, null)
})

test('evaluateJuge : "ref #N" avec fichier ref-N.md portant "## Juge" conforme, hors UI → pass', () => {
  const d = evaluateJuge({
    message: 'feat: truc, ref #371',
    stagedTouchesSrc: true,
    stagedTotalLines: 100,
    stagedTouchesUi: false,
    readRefFile: (n) => (n === 371 ? jugeFile() : null),
  })
  assert.equal(d, null)
})

test('evaluateJuge : "ref #N" UI touchée, fichier ref-N.md sans "## Juge-Vision" → deny', () => {
  const d = evaluateJuge({
    message: 'feat: truc, ref #371',
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
    message: 'feat: truc, ref #371',
    stagedTouchesSrc: true,
    stagedTotalLines: 100,
    stagedTouchesUi: true,
    readRefFile: (n) => (n === 371 ? `${jugeFile()}\n${jugeVisionFile()}` : null),
  })
  assert.equal(d, null)
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
    message: 'corrige #508',
    lireRegistreEmporte: lecteurDe({ 'fixture/premier-registre.json': registreAvec(508) }),
  })
  assert.ok(d)
  assert.match(d.reason, /#508/)
  assert.match(d.reason, /fixture\/premier-registre\.json/)
  assert.match(d.reason, /npm run regenere-la-fixture/)
})

test('evaluateRegistresPorteurs : TOUT registre de la liste mord, pas seulement le premier', () => {
  const d = evaluateRegistresPorteurs({
    message: 'corrige #508',
    lireRegistreEmporte: lecteurDe({ 'fixture/second-registre.json': registreAvec(508) }),
  })
  assert.ok(d)
  assert.match(d.reason, /fixture\/second-registre\.json/)
  // Aucune commande de régénération déclarée pour celui-ci : le refus n'en invente pas.
  assert.doesNotMatch(d.reason, /npm run/)
})

test('evaluateRegistresPorteurs : marque retirée dans le MÊME commit (contenu emporté sans #N) → passe', () => {
  const d = evaluateRegistresPorteurs({
    message: 'corrige #508',
    lireRegistreEmporte: lecteurDe({ 'fixture/premier-registre.json': registreAvec(490) }), // #508 retiré
  })
  assert.equal(d, null)
})

// Un registre ABSENT du lot se lit quand même : `commit.contenu` rend alors le contenu de l'index, celui
// de HEAD. La porte ne se tait donc pas parce qu'un registre n'est pas dans le lot — c'est exactement
// ce qui laisserait fermer un ticket que HEAD porte encore.
test('evaluateRegistresPorteurs : registre hors du lot — le contenu lu (HEAD) mord comme avant', () => {
  const d = evaluateRegistresPorteurs({
    message: 'git commit -m "corrige #508" -- src/ailleurs.ts',
    lireRegistreEmporte: lecteurDe({ 'fixture/premier-registre.json': registreAvec(508) }),
  })
  assert.ok(d)
  assert.match(d.reason, /fixture\/premier-registre\.json/)
})

test('evaluateRegistresPorteurs : commit sans fermeture → intact (silence)', () => {
  const d = evaluateRegistresPorteurs({
    message: 'wip sur #508',
    lireRegistreEmporte: lecteurDe({ 'fixture/premier-registre.json': registreAvec(508) }),
  })
  assert.equal(d, null)
})

test('evaluateRegistresPorteurs : #N porté par aucun registre → intact (silence)', () => {
  const d = evaluateRegistresPorteurs({
    message: 'corrige #999',
    lireRegistreEmporte: lecteurDe({ 'fixture/premier-registre.json': registreAvec(508) }),
  })
  assert.equal(d, null)
})

test('evaluateRegistresPorteurs : multi-fermeture — seuls les tickets encore portés listés', () => {
  const d = evaluateRegistresPorteurs({
    message: 'corrige #508, ferme #999',
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
    message: 'corrige #508',
    lireRegistreEmporte: lecteurDe({ 'fixture/premier-registre.json': registreAvec(508) }, null),
  })
  assert.ok(d, 'une liste absente ne doit pas laisser fermer en silence')
  assert.match(d.reason, /#508/)
  assert.match(d.reason, new RegExp(CHEMIN_DE_LA_LISTE.replace(/[./]/g, '\\$&')))
  assert.match(d.reason, /absente du contenu emporté/)
})

test('evaluateRegistresPorteurs : liste au JSON CASSÉ → refus de fermeture, jamais une levée', () => {
  const d = evaluateRegistresPorteurs({
    message: 'corrige #508',
    lireRegistreEmporte: lecteurDe({}, '[ { "chemin": '),
  })
  assert.ok(d)
  assert.match(d.reason, /JSON illisible/)
  // Une liste qui n'est pas un tableau est la même classe de panne, et se dit pareil.
  assert.match(
    evaluateRegistresPorteurs({ message: 'corrige #508', lireRegistreEmporte: lecteurDe({}, '{}') }).reason,
    /n’est pas un tableau/,
  )
  // Et un commit qui ne FERME rien reste intact : la liste ne le concerne pas.
  assert.equal(
    evaluateRegistresPorteurs({ message: 'wip sur #508', lireRegistreEmporte: lecteurDe({}, null) }),
    null,
  )
})

test('evaluateRegistresPorteurs : la liste NEUVE du commit jugé fait foi — pas celle d’un autre arbre', () => {
  // Le commit AJOUTE un registre porteur que la liste d'à côté ne connaît pas : c'est la sienne qui
  // juge. Lue hors du commit, cette entrée n'existerait pas et la fermeture passerait.
  const d = evaluateRegistresPorteurs({
    message: 'corrige #508',
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
  const liste = JSON.parse(readFileSync(join(RACINE, 'scripts', 'hooks', 'registres-porteurs.json'), 'utf8'))
  assert.ok(Array.isArray(liste) && liste.length, 'la liste des registres porteurs est vide')
  const fautes = liste
    .filter((r) => !r || typeof r.chemin !== 'string' || !r.chemin || !existsSync(join(RACINE, r.chemin)))
    .map((r) => JSON.stringify(r))
  assert.deepEqual(fautes, [], `registre porteur introuvable :\n${fautes.join('\n')}`)
  const enTrop = liste.flatMap((r) => Object.keys(r).filter((k) => !['chemin', 'apres'].includes(k)))
  assert.deepEqual(enTrop, [], 'jeu de clés fermé : `chemin` (obligatoire), `apres` (facultatif)')
})

// TOUT ce que la porte lit se lit dans le RÉPERTOIRE où le commit s'exécute, jamais dans le dépôt du
// script : depuis un worktree, un solde ou une réfutation écrits là où l'on committe sont invisibles au
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
// part pas dans le commit laisse une citation morte. La porte lit donc l'INDEX, et nomme le cas
// « écrit mais non stagé » séparément de « jamais écrit ».
test('evaluate : solde STAGÉ conforme → silence (le commit passe)', () => {
  const d = evaluate({
    message: 'corrige #77',
    today: TODAY,
    readSoldes: parTicket(() => solde()),
    soldeOnDisk: () => solde(),
  })
  assert.equal(d, null)
})

test('evaluate : solde conforme sur le DISQUE mais absent de l\'index → deny actionnable (git add)', () => {
  const d = evaluate({
    message: 'corrige #77',
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
    message: 'corrige #77',
    today: TODAY,
    readSoldes: parTicket(() => null),
    soldeOnDisk: () => null,
  })
  assert.ok(d)
  assert.match(d.reason, /fichier absent/)
  assert.doesNotMatch(d.reason, /NON STAGÉ/)
})

test('diffDuCommit : `diff()` rend en UN diff ce que l’INDEX emporte, et `images` lit par lot ce qui part et ce qui était', () => {
  const { racine: repo } = instanceDeDepot({ fichiers: { 'src/a.ts': 'export const a = 1\n', 'src/b.ts': 'export const b = 1\n' }, message: 'socle' })
  try {
    const git = gitDe(repo)
    writeFileSync(join(repo, 'src', 'a.ts'), 'export const a = 3\n', 'utf8')
    writeFileSync(join(repo, 'src', 'b.ts'), 'export const b = 2\n', 'utf8')
    git('add', 'src/a.ts', 'src/b.ts')
    writeFileSync(join(repo, 'src', 'a.ts'), 'export const a = 2\n', 'utf8')
    const ajouts = (d) => d.split('\n').filter((l) => /^\+[^+]/.test(l)).sort()

    const commit = diffDuCommit(repo)
    assert.deepEqual(ajouts(commit.diff()), ['+export const a = 3', '+export const b = 2'], 'l’index, jamais l’arbre de travail')
    assert.deepEqual(ajouts(commit.diff(['src/a.ts'])), ['+export const a = 3'])
    assert.equal(commit.diff([]), '')
    const images = commit.images(['src/a.ts', 'src/b.ts', 'src/absent.ts'])
    assert.deepEqual(['src/a.ts', 'src/b.ts', 'src/absent.ts'].map(images.lirePostImage), ['export const a = 3\n', 'export const b = 2\n', null])
    assert.deepEqual(['src/a.ts', 'src/b.ts', 'src/absent.ts'].map(images.lirePreImage), ['export const a = 1\n', 'export const b = 1\n', null])
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
    gitDeLArbreReel(RACINE, { net: true })('rev-parse', '--is-shallow-repository'),
    'false',
    'dépôt SUPERFICIEL : ce test lit l\'HISTOIRE — poser `fetch-depth: 0` sur le `actions/checkout` du job qui joue `test:hooks`.',
  )
  const histoire = histoireDesCitations(depotDe(RACINE), ['4d6e1ff78', '0000000000000000000000000000000000000000'])
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
    gitDeLArbreReel(RACINE, { net: true })('rev-parse', '--is-shallow-repository'),
    'false',
    'dépôt SUPERFICIEL : ce test lit l\'HISTOIRE — poser `fetch-depth: 0` sur le `actions/checkout` du job qui joue `test:hooks`.',
  )
  const contenu = readFileSync(join(RACINE, '.claude', 'soldes', '584.md'), 'utf8')
  assert.ok(shasCitesDuSolde(contenu).length > 0, 'témoin : le solde #584 cite par « corrigé par »')
  const r = validateSolde(contenu, '2026-09-02', histoireDesCitations(depotDe(RACINE), shasCitesDuSolde(contenu)))
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
    const fermer = { message: 'corrige #1', today: TODAY }

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
    message: 'corrige #1 ; corrige #2 ; corrige #3',
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
    message: 'corrige #1 ; corrige #2 ; corrige #3',
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
    const lire = (lecture) => lancesDeGit(() => lecture(diffDuCommit(repo, { depot: depotReel(repo) })))
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
  const pannes = ['mesure (status ?) — fatal: feinte cat-file']
  assert.equal(jugerOuConfier(() => { throw new GitIndisponible('fatal: feinte cat-file') }, pannes), null)
  assert.equal(jugerOuConfier(() => { throw new GitIndisponible('not a git repository') }, pannes), null)
  const vu = refusDesPannes(pannes)
  assert.deepEqual(Object.keys(vu), ['reason'])
  assert.equal(vu.reason, "⛔ lecture git indisponible : mesure (status ?) — fatal: feinte cat-file ; mesure (status ?) — not a git repository — la porte ne juge pas ce que git n'a pas lu. Geste : rejouer le commit depuis un arbre où git répond.",
    'une cause vue deux fois est nommée une fois, en UN refus')
  assert.equal(refusDesPannes([]), null)
  assert.deepEqual(jugerOuConfier(() => ({ reason: 'r' }), []), { reason: 'r' })
  assert.throws(() => jugerOuConfier(() => { throw new TypeError('un vrai bug') }, []), TypeError)

  const hors = refusDesPannes(['error: unknown option `cached\''], { cwd: '/base/scratchpad', horsDepot: true })
  assert.match(hors.reason, /hors dépôt : \/base\/scratchpad/)
  assert.match(hors.reason, /unknown option/)
  assert.doesNotMatch(hors.reason, /où git répond/)
})

// ── Diagnostic git intégral (#2285) ───────────────────────────────────────────────────────────
const stderr2285 = `${'ligne diagnostique longue\n'.repeat(45)}CAUSE TARDIVE 2285`
const detail2285 = `refus (status 37) — raison distincte\n${stderr2285}\nstdout distinct 2285`
test('#2285 solde catch : diagnostic Git intégral et identité programme', () => {
  const pannes = []
  const erreur = new GitIndisponible({ disponible: false, issue: 'refus', raison: 'raison distincte', diagnostic: { status: 37, stdout: 'stdout distinct 2285', stderr: stderr2285 } })
  assert.equal(jugerOuConfier(() => { throw erreur }, pannes), null)
  assert.deepEqual(pannes, [detail2285])
  const programme = new TypeError('programme distinct')
  assert.throws(() => jugerOuConfier(() => { throw programme }, []), (e) => e === programme)
})
test('#2285 solde hors dépôt : contexte et causes dédupliquées', () => {
  const vu = refusDesPannes([detail2285, detail2285], { cwd: '/destination/publique', horsDepot: true })
  assert.equal(vu.reason, `⛔ lecture git indisponible : hors dépôt : /destination/publique ; ${detail2285} — la porte ne juge pas ce que git n'a pas lu. Geste : rejouer depuis un arbre git (ce répertoire n’est gouverné par aucun dépôt).`)
})
test('#2285 solde callback : diagnostic Git intégral', () => {
  const pannes = []
  const { racine } = instanceDeDepot({ fichiers: { 'notes/a.md': 'a\n' } })
  try {
    sousGitFeint([{ si: ['diff-index'], status: 37, stdout: 'stdout distinct 2285', stderr: stderr2285 }], () => diffDuCommit(racine, { pannes }).numstat())
    assert.ok(pannes.some((p) => p.includes(`refus (status 37) — ${stderr2285}\nstdout distinct 2285`)), JSON.stringify(pannes))
  } finally { rmSync(racine, { recursive: true, force: true }) }
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

test('le budget qui grandit sans CLIQUET est refusé, avec CLIQUET il passe', () => {
  const reference = { postes: [{ nom: 'CLAUDE.md', octets: 9127 }], total: 9127 }
  const mesure = { postes: [{ nom: 'CLAUDE.md', octets: 10151 }], total: 10151 }
  const sans = evaluateBudgetContexte({ message: 'docs: une ligne', mesure, reference })
  assert.equal(sans.decision, 'deny')
  assert.match(sans.reason, /CLAUDE\.md \+1024 octets/)
  const avec = 'docs: une ligne\n\nCLIQUET: scripts/guards/budget-contexte.mjs +1024 — une règle de routage neuve'
  assert.equal(evaluateBudgetContexte({ message: avec, mesure, reference }), null)
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
  const sans = evaluateReclassementsCss({ message: 'feat: second écran', deplace: () => true, cotes: franchit })
  assert.deepEqual(Object.keys(sans), ['reason'])
  assert.ok(sans.reason.includes(`${module} : franchi au prix 2, aucune ligne`), sans.reason)
  const ligne = `RECLASSEMENT: ${module} +2 — la console devient une primitive, refs #1806`
  assert.equal(evaluateReclassementsCss({ message: `feat\n\n${ligne}`, deplace: () => true, cotes: franchit }), null)
  const jamaisLu = () => { throw new Error('côtés lus hors frontière') }
  assert.equal(evaluateReclassementsCss({ message: 'x', deplace: () => false, cotes: jamaisLu }), null)
  const orpheline = evaluateReclassementsCss({
    message: `docs\n\n${ligne}`,
    deplace: () => false,
    cotes: () => ({ base: cote(true), commit: cote(true) }),
  })
  assert.ok(orpheline?.reason.includes(`${module} : ligne \`+2\` sans franchissement`), 'une ligne sans franchissement est refusée, même hors frontière')
  const injugeable = evaluateReclassementsCss({
    message: 'x',
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

// Câblage des pannes sans cale git (#2114) : les `pannes` de l'appel atteignent le verdict.
test('jugerLeCommit : une panne de lecture git portée par `pannes` est un refus NOMMÉ', async () => {
  const { racine } = instanceDeDepot({ fichiers: { 'notes/a.md': '# a\n' }, message: 'socle' })
  try {
    const entree = { message: 'docs: a', dir: racine, today: '2026-09-28' }
    assert.equal(await jugerLeCommit({ ...entree, pannes: [] }), null, 'témoin : sans panne, silence')
    const refus = await jugerLeCommit({ ...entree, pannes: ['fatal: panne simulée'] })
    assert.match(refus?.reason ?? '', /⛔ lecture git indisponible : fatal: panne simulée/)
  } finally {
    rmSync(racine, { recursive: true, force: true })
  }
})

// ── #2328 : une FUSION EN COURS se juge sur son APPORT PROPRE, sans trailers de livraison ──────────
/** Un écran de `lignes` lignes numérotées. */
const ecranDe = (lignes, marque = 'l') => `${Array.from({ length: lignes }, (_, i) => `export const ${marque}${i} = ${i}`).join('\n')}\n`

/**
 * Un dépôt forgé arrêté EN FUSION de main dans le chantier : `socle` commité, `main` sur la branche
 * `amont`, `chantier` sur la branche courante (HEAD), puis `git merge --no-commit --no-ff amont` ; un
 * conflit est laissé à l'appelant, qui résout et stage. Rend `{ racine, git, evaluer(message) }`.
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
  const evaluer = (message) => jugerLeCommit({ message, dir: racine, today: TODAY })
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
    const commande = 'merge: refs #42 — intègre main'
    const lu = analyzeDiffDuCommit(diffDuCommit(racine).numstat())
    assert.ok(lu.touchesUi && lu.totalLines >= 10, `témoin : la résolution est de la substance d'écran — ${JSON.stringify(lu)}`)
    assert.equal(await evaluer(commande), null, 'sauver une fusion n’est pas une livraison')

    const { racine: ordinaire } = instanceDeDepot({ fichiers: { [ecran]: ecranDe(3) }, message: 'socle' })
    try {
      writeFileSync(join(ordinaire, ecran), resolu); gitDe(ordinaire)('add', ecran)
      const refus = await jugerLeCommit({ message: 'feat: refs #42 — écran', dir: ordinaire, today: TODAY })
      assert.ok(refus, 'test opposé : hors fusion, le même diff exige ses trailers')
      assert.match(refus.reason, /JUGE: /)
      assert.match(refus.reason, /JUGE-VISION: /)
      assert.match(refus.reason, /sans réfutation/)
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
    const refus = await evaluer('merge: corrige #42 — intègre main')
    assert.match(refus?.reason ?? '', /Réfutation/)
  } finally { rmSync(racine, { recursive: true, force: true }) }
})

test('#2328 A5 — une fusion PROPRE n’apporte rien : la porte du ticket se tait, même quand main apporte `src/` et `scripts/`', async () => {
  const { racine, evaluer } = depotEnFusion({
    socle: { 'notes/a.md': 'a\n' },
    chantier: { 'notes/c.md': 'c\n' },
    main: { 'src/ui/Main.tsx': ecranDe(20), 'scripts/m.mjs': ecranDe(20) },
  })
  try {
    const commande = 'merge: intègre main'
    const c = diffDuCommit(racine)
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
  const contexte = (n) => `# contexte\n${'x'.repeat(n)}\n`
  const { racine, git, evaluer } = depotEnFusion({
    socle: { 'CLAUDE.md': contexte(50) },
    chantier: { 'notes/c.md': 'c\n' },
    main: { 'CLAUDE.md': contexte(400) },
  })
  try {
    assert.equal(await evaluer('merge: refs #42 — intègre main'), null, 'fusion propre : rien à mesurer')
    writeFileSync(join(racine, 'CLAUDE.md'), contexte(390)); git('add', 'CLAUDE.md')
    assert.equal(await evaluer('merge: refs #42 — intègre main'), null, 'la résolution rétrécit le contexte sous le plafond de main')
    writeFileSync(join(racine, 'CLAUDE.md'), contexte(600)); git('add', 'CLAUDE.md')
    assert.match((await evaluer('merge: refs #42 — intègre main'))?.reason ?? '', /CLIQUET/, 'témoin : la résolution qui dépasse le plafond de main est refusée')
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
    const c = diffDuCommit(racine)
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
    const commande = 'merge: corrige #42 — intègre main'
    const raisonPour = async (resolu) => {
      writeFileSync(join(racine, ecran), resolu); git('add', '-A')
      return (await evaluer(commande))?.reason ?? ''
    }
    assert.doesNotMatch(await raisonPour(ecranDe(6).replace('= 0', '= 100')), /Recette visuelle/, 'la résolution ne fait que retirer : aucun écran écrit')
    assert.match(await raisonPour(ecranDe(6).replace('= 0', '= 300')), /Recette visuelle/, 'témoin : la résolution écrit une ligne d’écran')
  } finally { rmSync(racine, { recursive: true, force: true }) }
})

test('#2285 jugerLeCommit : refus structurel de fusion intégral', async () => {
  const { racine, evaluer } = depotEnFusion({ socle: { 'notes/a.md': 'a\n' }, chantier: { 'notes/c.md': 'c\n' }, main: { 'notes/m.md': 'm\n' } })
  const stderr = `${'diagnostic structurel\n'.repeat(45)}fatal: cause tardive du merge-tree\n`
  const stdout = 'stdout structurel distinct\n'
  const ancienneFeinte = process.env[ENV_GIT_FEINT]
  try {
    Object.assign(process.env, envGitFeint([{ si: ['merge-tree'], status: 37, stdout, stderr }]))
    const verdict = await evaluer('merge')
    assert.deepEqual(verdict, {
      reason: `⛔ lecture git indisponible : refus (status 37) — fusion automatique de fusion en cours illisible : ${stderr} — ${stdout}\n${stderr}\n${stdout} — la porte ne juge pas ce que git n'a pas lu. Geste : rejouer le commit depuis un arbre où git répond.`,
    })
  } finally {
    if (ancienneFeinte === undefined) delete process.env[ENV_GIT_FEINT]
    else process.env[ENV_GIT_FEINT] = ancienneFeinte
    rmSync(racine, { recursive: true, force: true })
  }
})

test('#2285 solde fusion catch : diagnostic Git intégral', () => {
  const { racine } = depotEnFusion({ socle: { 'notes/a.md': 'a\n' }, chantier: { 'notes/c.md': 'c\n' }, main: { 'notes/m.md': 'm\n' } })
  try {
    const pannes = []
    const resultat = sousGitFeint([{ si: ['merge-tree'], status: 37, stdout: 'stdout distinct 2285', stderr: stderr2285 }], () => diffDuCommit(racine, { pannes }).fusion())
    assert.equal(resultat, null)
    assert.ok(pannes.some((p) => p.includes('status 37') && p.includes(stderr2285) && p.includes('stdout distinct 2285')), JSON.stringify(pannes))
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
    const refus = await evaluer('merge: intègre main')
    assert.match(refus?.reason ?? '', /⛔ lecture git indisponible : mesure \(status \?\) — fusion en cours à 3 parents/)
  } finally { rmSync(racine, { recursive: true, force: true }) }
})

// ── NATURE de la fermeture (`scripts/guards/lib/nature.mjs`) : sa preuve au solde (#2561) ──────────
const SHA_SONDE = 'abc1234def'
const SONDE_OK = `\n## Sonde\nNon reproduit à ${SHA_SONDE}.\n\n\`\`\`\nnode scripts/sonde.mjs\n\`\`\`\n\n\`\`\`\n0 trouvaille\n\`\`\`\n`
const DECISION_OK = '\n## Décision\n« On abandonne cette piste. » (utilisateur, 2026-10-09)\n'
/** Un solde conforme qui porte `nature` (ligne `NATURE:` omise si `null`) et `sections` avant « ## Réfutation ». */
const soldeDeNature = (nature, sections = '') =>
  `${VERIFIE_OK}\n${nature === null ? '' : `NATURE: ${nature}\n`}\n## Restes\nRAS\n${sections}\n## Réfutation\nverdict: CONFIRMÉ\n${REFUTATION_OK}\n\n(${TODAY})\n`
const problemesDe = (contenu, ctx) => validateSolde(contenu, TODAY, ctx).problems.join(' ; ')

test('NATURE caduc : sans « ## Sonde » → refus', () => {
  assert.match(problemesDe(soldeDeNature('caduc'), { numero: 10 }), /"NATURE: caduc" sans section "## Sonde"/)
})

test('NATURE caduc : une « ## Sonde » à UN seul bloc de code → refus (la commande PUIS sa sortie)', () => {
  const unBloc = `\n## Sonde\nNon reproduit à ${SHA_SONDE}.\n\n\`\`\`\nnode scripts/sonde.mjs\n\`\`\`\n`
  assert.match(problemesDe(soldeDeNature('caduc', unBloc), { numero: 10 }), /porte 1 bloc\(s\) de code/)
})

test('NATURE caduc : « ## Sonde » dont aucun sha n’est un ANCÊTRE de HEAD → refus', () => {
  const vus = []
  const r = problemesDe(soldeDeNature('caduc', SONDE_OK), { numero: 10, commitEstAncetre: (sha) => { vus.push(sha); return false } })
  assert.match(r, /ne nomme aucun commit ANCÊTRE de HEAD \(abc1234def\)/)
  assert.deepEqual(vus, [SHA_SONDE])
})

test('NATURE caduc : sonde complète, sha ancêtre → conforme ; le sha est ANNONCÉ à l’histoire (`shasCitesDuSolde`)', () => {
  const contenu = soldeDeNature('caduc', SONDE_OK)
  assert.deepEqual(shasCitesDuSolde(contenu), [SHA_SONDE])
  assert.deepEqual(shasCitesDuSolde(soldeDeNature(null, SONDE_OK)), [], 'hors `caduc`, la sonde n’est pas une citation')
  const annonces = []
  const vu = evaluate({
    message: 'corrige #10', today: TODAY, readSoldes: parTicket(() => contenu),
    contexteSolde: { histoireDe: (shas) => { annonces.push(shas); return { commitEstAncetre: (sha) => sha === SHA_SONDE } } },
  })
  assert.equal(vu, null, JSON.stringify(vu))
  assert.deepEqual(annonces, [[SHA_SONDE]])
})

test('NATURE doublon : sans `#M` → refus, et le refus énonce la ligne `NATURE:` et ses sections', () => {
  const vu = evaluate({ message: 'corrige #10', today: TODAY, readSoldes: parTicket(() => soldeDeNature('doublon')) })
  assert.match(vu?.reason ?? '', /#10 \(\.claude\/soldes\/10\.md\) — "NATURE: doublon" sans "#M"/)
  assert.match(vu.reason, /"NATURE: corrigé \| doublon #M \| caduc \| décidé" en tête de ligne/)
  assert.match(vu.reason, /"## Sonde"/)
  assert.match(vu.reason, /"## Décision"/)
})

test('NATURE doublon : `#M` qui nomme le ticket fermé lui-même → refus (le numéro vient d’`evaluate`)', () => {
  const vu = evaluate({ message: 'corrige #12', today: TODAY, readSoldes: parTicket(() => soldeDeNature('doublon #12')) })
  assert.match(vu?.reason ?? '', /"NATURE: doublon #12" nomme le ticket fermé lui-même/)
})

test('NATURE décidé : sans « ## Décision », ou sans date SUR la ligne du verbatim → refus ; complète → conforme', () => {
  assert.match(problemesDe(soldeDeNature('décidé'), { numero: 10 }), /"NATURE: décidé" sans section "## Décision"/)
  const dateAilleurs = '\n## Décision\n« On abandonne cette piste. » (utilisateur)\nle 2026-10-09\n'
  assert.match(problemesDe(soldeDeNature('décidé', dateAilleurs), { numero: 10 }), /sans ligne qui cite la décision « … » ET porte sa date/)
  assert.equal(problemesDe(soldeDeNature('décidé', DECISION_OK), { numero: 10 }), '')
})

test('NATURE : un commit ferme #10 (corrigé) et #12 (doublon #10) — chaque ticket porte la sienne', () => {
  const soldes = { 10: soldeDeNature(null), 12: soldeDeNature('doublon #10') }
  const vu = evaluate({ message: 'corrige #10 ; corrige #12', today: TODAY, readSoldes: parTicket((n) => soldes[n]) })
  assert.equal(vu, null, JSON.stringify(vu))
})
