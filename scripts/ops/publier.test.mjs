// Contrat du TRAIN de publication — tout ce qui se juge sans git, sans gh et sans réseau.
//   node --test scripts/ops/publier.test.mjs   (chaîné dans `npm run test:ops`)
//
// Rien ici ne touche l'arbre : le moteur reçoit des étapes FACTICES et un journal EN MÉMOIRE, les
// verdicts reçoivent des listes de courses littérales. Ce que ce fichier ne couvre pas est dit :
// les `jouer` réels (build-all, push, gh) ne sont jugés que par le train joué.
import { tableTotale } from '../../src/lib/tableTotale.ts'
import test, { after, describe } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync, utimesSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { codeSeul } from '../guards/lib/commentPoison.mjs'
import { manquementsDeFeuilles } from '../guards/lib/modulesFeuilles.mjs'
import { numerosCites } from '../guards/lib/fermetures.mjs'
import { refusDeSujet, sujetDuMessage } from '../guards/lib/sujetDeCommit.mjs'
import { GitIndisponible, MARQUE_FEINTE, depotDe } from '../guards/lib/gitPorte.mjs'
import { DEPOT } from '../guards/lib/ticketsGh.mjs'
import { COMPTEURS, messageDeCollision } from '../guards/lib/compteursDeVersion.mjs'
import { refusDesCompteurs } from '../guards/lib/compteursDuDepot.mjs'
import { envDeDepotForge, envGitFeint, instanceDeDepot, sousLEnvDeLUtilisatrice } from '../guards/lib/depotGabarit.mjs'
import { GENERATORS } from '../docs/build-all.mjs'
import {
  FILE_TIMEOUT_MIN,
  RACINE,
  citerArgv,
  contexteDe,
  corpsDeFusion,
  etatDeLEtape,
  filetDuTrainEnfant,
  fusionDe,
  jouerLeTrain,
  journalInitial,
  journalVide,
  lancementNpm,
  lancerDetache,
  ligneDeDetachement,
  modeDuLog,
  motifDeRotation,
  nomDeJournal,
  nomDeRotation,
  optionsDe,
  planDeReprise,
  questionsDuTrain,
  reponseHttp,
  rotationnerLog,
} from './publier.mjs'
import {
  BORNE_EJECTIONS,
  ETAPES,
  MOTIF_EJECTION,
  MOTIF_POST_REWRITE,
  MOTIF_REGENERATION,
  PLAGE_DE_CITATIONS,
  corpsDePilotage,
  courseDeFile,
  estDocDerive,
  etatDeLaPr,
  finDeSortie,
  issueDeFusion,
  marquePublication,
  messageDuTrain,
  partitionSales,
  prDeLaBranche,
  prDeRest,
  refusDeBranche,
  refusDeGit,
  sortieDe,
  synchroniserAgents,
  titreDeCommit,
  titreDePr,
  verdictDesRuns,
} from './etapesDuTrain.mjs'
import { refusDuCommitDeFile } from './compteurs-de-file.mjs'

const NOMS = ETAPES.map((e) => e.nom)

// ── optionsDe ──────────────────────────────────────────────────────────────────────────

test('optionsDe : les drapeaux et l’option à valeur, sans grammaire empruntée', () => {
  assert.deepEqual(optionsDe([]), {
    detache: false,
    reprendre: false,
    etapes: false,
    fileTimeoutMin: FILE_TIMEOUT_MIN,
    inconnus: [],
  })
  assert.equal(optionsDe(['--detache']).detache, true)
  assert.equal(optionsDe(['--reprendre']).reprendre, true)
  assert.equal(optionsDe(['--etapes']).etapes, true)
  assert.equal(optionsDe(['--file-timeout-min', '12']).fileTimeoutMin, 12)
  // La valeur d'une option n'est JAMAIS lue comme un drapeau inconnu.
  assert.deepEqual(optionsDe(['--file-timeout-min', '12']).inconnus, [])
  // Une valeur absurde ne DÉGRADE pas la borne : le défaut tient.
  assert.equal(optionsDe(['--file-timeout-min', 'zero']).fileTimeoutMin, FILE_TIMEOUT_MIN)
  assert.deepEqual(optionsDe(['--ci-timeout-min', '12']).inconnus, ['--ci-timeout-min', '12'])
  assert.deepEqual(optionsDe(['--force']).inconnus, ['--force'])
})

// ── nomDeJournal ───────────────────────────────────────────────────────────────────────

test('nomDeJournal : une branche devient un NOM DE FICHIER légal', () => {
  assert.equal(nomDeJournal('chantier/1736-publier'), 'chantier_1736-publier')
  assert.equal(nomDeJournal('main'), 'main')
  // `\w` est ASCII : un accent tombe avec le reste — le nom de fichier reste ASCII, par construction.
  assert.equal(nomDeJournal('feat/ét é:x'), 'feat_t_x')
  assert.equal(nomDeJournal(undefined), 'sans-branche')
})

// ── planDeReprise / etatDeLEtape ───────────────────────────────────────────────────────

test('planDeReprise : journal vide → la première étape', () => {
  assert.equal(planDeReprise(journalVide('b'), NOMS, 'aaa'), NOMS[0])
  assert.equal(planDeReprise(undefined, NOMS, 'aaa'), NOMS[0])
})

test('planDeReprise : la première étape NON verte', () => {
  const journal = {
    tete: 'aaa',
    etapes: { preflight: { etat: 'vert', tete: 'aaa' }, derives: { etat: 'vert', tete: 'aaa' }, docs: { etat: 'rouge', tete: 'aaa' } },
  }
  assert.equal(planDeReprise(journal, NOMS, 'aaa'), 'docs')
})

test('planDeReprise : tout vert POUR CETTE TÊTE → rien à jouer', () => {
  const journal = { tete: 'aaa', etapes: tableTotale(NOMS, () => ({ etat: 'vert', tete: 'aaa' })) }
  assert.equal(planDeReprise(journal, NOMS, 'aaa'), null)
})

test('planDeReprise : une étape verte pour une AUTRE tête est À FAIRE (2ᵉ lot sur la même branche)', () => {
  const journal = { tete: 'bbb', etapes: tableTotale(NOMS, () => ({ etat: 'vert', tete: 'aaa' })) }
  assert.equal(planDeReprise(journal, NOMS, 'bbb'), NOMS[0])
  assert.equal(etatDeLEtape(journal, 'file', 'bbb'), 'à faire (verte pour une autre tête)')
  assert.equal(etatDeLEtape({ tete: 'aaa', etapes: {} }, 'file', 'aaa'), 'à faire')
})

test('planDeReprise : la règle de tête porte sur la tête VIVANTE, et une étape SANS estampille est à faire', () => {
  // La tête PUBLIÉE du journal ne décide de rien : seule la tête vivante est comparée.
  const publie = { tete: 'aaa', etapes: tableTotale(NOMS, () => ({ etat: 'vert', tete: 'aaa' })) }
  assert.equal(planDeReprise(publie, NOMS, 'bbb'), NOMS[0])
  assert.equal(planDeReprise(publie, NOMS, 'aaa'), null)
  // Une étape estampillée `null` (journal d'avant la règle) N'est PAS verte pour toute tête.
  const sansEstampille = {
    tete: 'aaa',
    etapes: tableTotale(NOMS, (n) => ({ etat: 'vert', tete: n === 'preflight' ? null : 'aaa' })),
  }
  assert.equal(planDeReprise(sansEstampille, NOMS, 'aaa'), 'preflight')
  assert.equal(etatDeLEtape(sansEstampille, 'preflight', 'aaa'), 'à faire (verte pour une autre tête)')
  assert.equal(etatDeLEtape(publie, 'file', 'aaa'), 'vert')
})

test('planDeReprise / etatDeLEtape : une étape SANS estampille est à faire, MÊME sans tête vivante', () => {
  // L'échappatoire fermée : `null !== null` est FAUX — une étape estampillée `null` jugée alors que
  // la tête vivante n'a pas pu être mesurée se déclarait verte. L'ABSENCE d'estampille décide seule.
  const sansEstampille = {
    tete: 'aaa',
    etapes: tableTotale(NOMS, (n) => ({ etat: 'vert', tete: n === 'preflight' ? null : 'aaa' })),
  }
  assert.equal(planDeReprise(sansEstampille, NOMS, null), 'preflight')
  assert.equal(etatDeLEtape(sansEstampille, 'preflight', null), 'à faire (verte pour une autre tête)')
  // Et avec une tête vivante NOMMÉE, le verdict est le même.
  assert.equal(planDeReprise(sansEstampille, NOMS, 'aaa'), 'preflight')
  assert.equal(etatDeLEtape(sansEstampille, 'preflight', 'aaa'), 'à faire (verte pour une autre tête)')
})

// ── jouerLeTrain (étapes factices) ─────────────────────────────────────────────────────

/** Étape factice : `jouer` rend ce qu'on lui dit, et NOTE son passage. */
const factice = (nom, verdict, { deja = false, joues } = {}) => ({
  nom,
  dejaFaite: () => deja,
  jouer: () => {
    joues?.push(nom)
    return typeof verdict === 'function' ? verdict() : verdict
  },
})

test('jouerLeTrain : joue dans l’ordre et rend vert', () => {
  const joues = []
  const journal = journalVide('b')
  const vu = jouerLeTrain({}, [factice('un', { ok: true }, { joues }), factice('deux', { ok: true }, { joues })], journal)
  assert.deepEqual(vu, { etat: 'vert' })
  assert.deepEqual(joues, ['un', 'deux'])
  assert.equal(journal.etapes.deux.etat, 'vert')
})

test('jouerLeTrain : ARRÊTE à la première rouge', () => {
  const joues = []
  const journal = journalVide('b')
  const vu = jouerLeTrain({}, [
    factice('un', { ok: true }, { joues }),
    factice('deux', { ok: false, raison: 'cassé' }, { joues }),
    factice('trois', { ok: true }, { joues }),
  ], journal)
  assert.deepEqual(vu, { etat: 'rouge', etape: 'deux', raison: 'cassé' })
  assert.deepEqual(joues, ['un', 'deux'])
  assert.equal(journal.etapes.trois, undefined)
})

test('jouerLeTrain : saute ce que dejaFaite déclare', () => {
  const joues = []
  const journal = journalVide('b')
  jouerLeTrain({}, [factice('un', { ok: true }, { joues, deja: true }), factice('deux', { ok: true }, { joues })], journal)
  assert.deepEqual(joues, ['deux'])
})

test('jouerLeTrain : une étape DÉJÀ FAITE s’ENREGISTRE, estampillée à la tête VIVANTE du ctx', () => {
  const sauves = []
  const journal = journalVide('b')
  jouerLeTrain({ tete: 'vivante' }, [factice('un', { ok: true }, { deja: true }), factice('deux', { ok: true })], journal, {
    sauver: (j) => sauves.push(Object.keys(j.etapes).join('+')),
  })
  const vue = journal.etapes.un
  assert.equal(vue.etat, 'vert')
  assert.equal(vue.detail.dejaFaite, true)
  assert.equal(vue.tete, 'vivante')
  assert.ok(vue.debut && vue.fin, 'une étape enregistrée porte ses bornes de temps')
  // Elle est SAUVÉE comme une étape jouée — le journal du disque la porte.
  assert.deepEqual(sauves, ['un', 'un+deux'])
  // Une étape JOUÉE s’estampille à la même tête vivante, jamais à la tête publiée du journal.
  assert.equal(journal.etapes.deux.tete, 'vivante')
  // Le détail PRÉCÉDENT survit : `file.dejaFaite` relit `detail.fusion`, l’écraser referait attendre la file.
  const repris = { ...journalVide('b'), etapes: { file: { etat: 'vert', tete: 'vivante', detail: { fusion: 'f' } } } }
  jouerLeTrain({ tete: 'vivante' }, [factice('file', { ok: true }, { deja: true })], repris)
  assert.deepEqual(repris.etapes.file.detail, { fusion: 'f', dejaFaite: true })
})

test('jouerLeTrain : le journal est écrit APRÈS CHAQUE étape', () => {
  const sauves = []
  const journal = journalVide('b')
  jouerLeTrain({}, [factice('un', { ok: true }), factice('deux', { ok: false, raison: 'x' })], journal, {
    sauver: (j) => sauves.push(Object.keys(j.etapes).join('+')),
  })
  assert.deepEqual(sauves, ['un', 'un+deux'])
})

test('jouerLeTrain : une étape INDÉTERMINÉE arrête le train sans le rougir', () => {
  const journal = journalVide('b')
  const vu = jouerLeTrain({}, [factice('ci', { indetermine: true, raison: 'pas de verdict' })], journal)
  assert.deepEqual(vu, { etat: 'indeterminee', etape: 'ci', raison: 'pas de verdict' })
  assert.equal(journal.etapes.ci.etat, 'indéterminée')
})

test('jouerLeTrain : une RELANCE remet les étapes nommées à faire et reprend du début', () => {
  const joues = []
  const journal = journalVide('b')
  let bouge = true
  const etapes = [
    factice('rebase', { ok: true }, { joues }),
    {
      nom: 'push',
      dejaFaite: () => false,
      jouer: () => {
        joues.push('push')
        if (bouge) {
          bouge = false
          return { ok: true, relancer: ['rebase'] }
        }
        return { ok: true }
      },
    },
  ]
  const vu = jouerLeTrain({}, etapes, journal)
  assert.deepEqual(vu, { etat: 'vert' })
  assert.deepEqual(joues, ['rebase', 'push', 'rebase', 'push'])
})

// ── verdictDesRuns ─────────────────────────────────────────────────────────────────────

const course = (o) => ({ headSha: 'aaa', status: 'completed', workflowName: 'CI', databaseId: 1, createdAt: '2026-09-14T00:00:00Z', ...o })

test('verdictDesRuns : absente, en vol, verte, rouges, annulée', () => {
  assert.equal(verdictDesRuns([], 'aaa').etat, 'absente')
  assert.equal(verdictDesRuns([course({ status: 'in_progress' })], 'aaa').etat, 'en-vol')
  assert.equal(verdictDesRuns([course({ conclusion: 'success' })], 'aaa').etat, 'verte')
  assert.equal(verdictDesRuns([course({ conclusion: 'failure' })], 'aaa').etat, 'rouge')
  assert.equal(verdictDesRuns([course({ conclusion: 'timed_out' })], 'aaa').etat, 'rouge')
  assert.equal(verdictDesRuns([course({ conclusion: 'startup_failure' })], 'aaa').etat, 'rouge')
  assert.equal(verdictDesRuns([course({ conclusion: 'cancelled' })], 'aaa').etat, 'annulee')
})

test('verdictDesRuns : un sha ABSENT de la liste, et une course d’un AUTRE workflow, ne disent rien', () => {
  assert.equal(verdictDesRuns([course({ conclusion: 'success' })], 'bbb').etat, 'absente')
  assert.equal(verdictDesRuns([course({ conclusion: 'success', workflowName: 'Déploiement prod' })], 'aaa').etat, 'absente')
})

test('verdictDesRuns : une conclusion INCONNUE n’est pas verte, et se dit inattendue', () => {
  const vu = verdictDesRuns([course({ conclusion: 'neutral' })], 'aaa')
  assert.equal(vu.etat, 'rouge')
  assert.equal(vu.inattendue, true)
})

test('verdictDesRuns : la PREMIÈRE course de la liste triée gouverne', () => {
  const vu = verdictDesRuns([course({ conclusion: 'success', databaseId: 2 }), course({ conclusion: 'failure', databaseId: 1 })], 'aaa')
  assert.equal(vu.etat, 'verte')
  assert.equal(vu.course.databaseId, 2)
})

// ── estDocDerive ───────────────────────────────────────────────────────────────────────

// La fixture des générateurs vit DANS le corps du `describe(…)` : c'est une donnée LOCALE au sens de
// `scripts/guards/lib/stocksNominatifs.mjs` (§ PORTÉE DE MODULE), pas un stock nominatif de module.
describe('estDocDerive', () => {
  const GEN = [
    { script: 'a.mjs', targets: ['docs/systemes.md'] },
    { script: 'b.mjs', targets: ['docs/raw/**/catalogue-*.md'] },
    { script: 'c.mjs', targets: [], injecte: ['CLAUDE.md'] },
    { script: 'd.mjs', targets: [], injecte: ['docs/raw/*.md'] },
  ]

  test('estDocDerive : les cibles, les injections et les globs sont DÉRIVÉS', () => {
    assert.equal(estDocDerive('docs/systemes.md', GEN), true)
    assert.equal(estDocDerive('docs/raw/4e/catalogue-divers.md', GEN), true)
    assert.equal(estDocDerive('CLAUDE.md', GEN), true)
    assert.equal(estDocDerive('docs/raw/00-index.md', GEN), true)
  })

  test('estDocDerive : la mesure `.sources-lues.json` et les sorties d’agents:sync sont DÉRIVÉES', () => {
    assert.equal(estDocDerive('docs/.sources-lues.json', GEN), true)
    assert.equal(estDocDerive('AGENTS.md', GEN), true)
    assert.equal(estDocDerive('.agents/skills/ajouter-une-donnee/SKILL.md', GEN), true)
    assert.equal(estDocDerive('.codex/credo.md', GEN), true)
  })

  test('estDocDerive : un MANUSCRIT n’est pas dérivé', () => {
    assert.equal(estDocDerive('docs/architecture.md', GEN), false)
    assert.equal(estDocDerive('src/state/cascade.ts', GEN), false)
    assert.equal(estDocDerive('', GEN), false)
  })

  // Le cas MESURÉ (2026-09-14) : le hook `post-rewrite` d'un rebase manuel laisse des dérivés sales.
  // La préflight doit les distinguer d'un manuscrit — l'étape `docs` sait committer les premiers.
  test('partitionSales : des DÉRIVÉS seuls — aucun manuscrit à refuser', () => {
    const vu = partitionSales(['docs/systemes.md', 'docs/raw/00-index.md'], GEN)
    assert.deepEqual(vu.derives, ['docs/systemes.md', 'docs/raw/00-index.md'])
    assert.deepEqual(vu.manuscrits, [])
  })

  test('partitionSales : des MANUSCRITS seuls', () => {
    const vu = partitionSales(['src/state/cascade.ts', 'docs/architecture.md'], GEN)
    assert.deepEqual(vu.derives, [])
    assert.deepEqual(vu.manuscrits, ['src/state/cascade.ts', 'docs/architecture.md'])
  })

  test('partitionSales : MIXTE — chaque chemin dans son tas, l’ordre conservé', () => {
    const vu = partitionSales(['docs/systemes.md', 'src/state/cascade.ts', 'CLAUDE.md', 'docs/architecture.md'], GEN)
    assert.deepEqual(vu.derives, ['docs/systemes.md', 'CLAUDE.md'])
    assert.deepEqual(vu.manuscrits, ['src/state/cascade.ts', 'docs/architecture.md'])
  })

  test('partitionSales : rien de sale — deux tas vides (et `undefined` ne jette pas)', () => {
    assert.deepEqual(partitionSales([], GEN), { derives: [], manuscrits: [] })
    assert.deepEqual(partitionSales(undefined, GEN), { derives: [], manuscrits: [] })
  })
})

// ── Les gestes du train : des écrivains NOMMÉS, jamais une commande git libre ──────────────────

test('le contexte du train ne porte que des QUESTIONS et des gestes NOMMÉS aux arguments validés : ni poignée du dépôt, ni commande libre', () => {
  const ctx = contexteDe({ racine: '/nulle-part', branche: 'chantier/x', options: {}, journaliser: () => {}, fdLog: 'ignore' })
  const cles = Object.getOwnPropertyNames(ctx).sort()
  assert.deepEqual(cles, ['abandonnerFusion', 'branche', 'commenter', 'commit', 'coursesCi', 'coursesDeFile', 'demanderFusion', 'docs', 'fdLog', 'filtresDePush', 'fusionner', 'generators', 'jobsDesDerives', 'jobsRouges', 'journaliser', 'lireFusion', 'lirePr', 'lireTicket', 'npm', 'options', 'ouvrirPr', 'parentsDe', 'pousser', 'questions', 'racine', 'tete', 'tronc'])
  assert.deepEqual(Object.keys(ctx.questions).sort(), ['baseAuTronc', 'brancheDe', 'ceQuiChange', 'cheminsEnConflit', 'cheminsSales', 'combienDe', 'commitsDeLaPlage', 'estAncetre', 'origineDe', 'rebaseEntame', 'refusDesCompteurs', 'shaDe'])
  assert.equal(Object.isFrozen(ctx.questions), true)
  assert.equal(ctx.generators, GENERATORS)
  for (const script of ['x; git add -A', 'x && git commit -m libre', 'a b', '$(git add -A)', '', 7])
    assert.throws(() => ctx.npm(script), /ctx\.npm : un NOM de script/, JSON.stringify(script))
  for (const mode of ['--check; git add -A', '--write', undefined])
    assert.throws(() => ctx.docs(mode), /ctx\.docs : mode de build-all inconnu/, JSON.stringify(mode))
  for (const sha of ['HEAD', 'a'.repeat(39), `${'a'.repeat(40)}\n`, ['a'.repeat(40)], undefined])
  {
    assert.throws(() => ctx.coursesCi(sha), /ctx\.coursesCi : un sha COMPLET/, JSON.stringify(sha))
    assert.throws(() => ctx.demanderFusion({ numero: 7, sha }), /ctx\.demanderFusion : un sha COMPLET/, JSON.stringify(sha))
    assert.throws(() => ctx.parentsDe(sha), /ctx\.parentsDe : un sha COMPLET/, JSON.stringify(sha))
  }
  for (const numero of ['0', '7a', undefined])
    assert.throws(() => ctx.demanderFusion({ numero, sha: 'a'.repeat(40) }), /ctx\.demanderFusion : un NUMÉRO/, JSON.stringify(numero))
  for (const uuid of ['x', '630b9d5e-3f2a-4f7e-8b0c-2d5f9a8c1e42/../..', undefined])
    assert.throws(() => ctx.lireFusion({ numero: 7, uuid }), /ctx\.lireFusion : un UUID de demande/, JSON.stringify(uuid))
  for (const id of ['1', 0, -3, 1.5, undefined])
    assert.throws(() => ctx.jobsRouges(id), /ctx\.jobsRouges : un id de course/, JSON.stringify(id))
  for (const message of ['', '  ', undefined, ['m']])
    assert.throws(() => ctx.fusionner({ message }), /ctx\.fusionner : un MESSAGE/, JSON.stringify(message))
  for (const titre of ['', undefined])
    assert.throws(() => ctx.ouvrirPr({ titre, corps: 'c' }), /ctx\.ouvrirPr : un TITRE et un corps/, JSON.stringify(titre))
  for (const numero of ['0', '12a', '-1', ' 12', 'api', 1.5, [12], undefined]) {
    assert.throws(() => ctx.lireTicket(numero), /ctx\.lireTicket : un NUMÉRO de ticket/, JSON.stringify(numero))
    assert.throws(() => ctx.commenter(numero, 'corps'), /ctx\.commenter : un NUMÉRO de ticket/, JSON.stringify(numero))
  }
  for (const corps of ['', '  ', undefined, ['x']])
    assert.throws(() => ctx.commenter('1806', corps), /ctx\.commenter : un CORPS de commentaire/, JSON.stringify(corps))
})

test('lancementNpm : `npm run <script>` sans shell hors win32 ; `npm.cmd` sous shell sous win32', () => {
  assert.deepEqual(lancementNpm('agents:check', 'linux'), { executable: 'npm', args: ['run', 'agents:check'], shell: false })
  assert.deepEqual(lancementNpm('agents:check', 'darwin'), { executable: 'npm', args: ['run', 'agents:check'], shell: false })
  assert.deepEqual(lancementNpm('agents:check', 'win32'), { executable: 'npm.cmd', args: ['run', 'agents:check'], shell: true })
})

test('git INDISPONIBLE : le train LÈVE `GitIndisponible` — ni tête `null`, ni arbre lu propre', () => {
  const ctx = contexteDe({ racine: '/nulle-part', branche: 'chantier/x', options: {}, journaliser: () => {}, fdLog: 'ignore' })
  assert.throws(() => ctx.tete, GitIndisponible)
  assert.throws(() => ctx.questions.cheminsSales(), GitIndisponible)
  assert.throws(() => ctx.questions.rebaseEntame(), GitIndisponible)
})

test('git INDISPONIBLE avant le train (racine, branche, tête) : une ligne finale `PUBLICATION: rouge` NOMMÉE, jamais une pile brute', () => {
  const vu = spawnSync(process.execPath, [fileURLToPath(new URL('./publier.mjs', import.meta.url)), '--etapes'], {
    encoding: 'utf8', env: { ...process.env, ...envGitFeint([{ si: [], status: 128, stderr: 'fatal: panne simulée\n' }]), WFRP_PUBLIER_ENFANT: '' },
  })
  assert.equal(vu.status, 1, vu.stderr)
  const lignes = vu.stderr.split('\n')
  assert.equal(lignes.at(-2), 'PUBLICATION: rouge lecture — git indisponible : fatal: panne simulée', vu.stderr)
  assert.deepEqual(lignes.slice(0, -2).filter((l) => !l.startsWith(MARQUE_FEINTE)), [], `hors marques de feinte, la ligne finale seule : ${vu.stderr}`)
  assert.ok(lignes.length > 2, `la panne est FEINTE, et se marque : ${vu.stderr}`)
})

test('`ctx.commit` sans chemins, ou à chemins vides, LÈVE avant tout spawn : ni `git add -A`, ni commit de tout l’index', () => {
  const ctx = contexteDe({ racine: '/nulle-part', branche: 'chantier/x', options: {}, journaliser: () => {}, fdLog: 'ignore' })
  for (const p of [{ message: 'm' }, { message: 'm', chemins: [] }, { message: 'm', chemins: null }]) {
    assert.throws(() => ctx.commit(p), /commitDe : un commit porte des `chemins` explicites/, JSON.stringify(p))
  }
})

test('`pousser` refuse tout push vers `main`, sous ses deux noms, bail ou non, AVANT tout spawn', () => {
  const ctx = contexteDe({ racine: '/nulle-part', branche: 'chantier/x', options: {}, journaliser: () => {}, fdLog: 'ignore' })
  for (const vers of ['main', 'refs/heads/main'])
    for (const bail of [true, false])
      assert.throws(() => ctx.pousser({ vers, bail }), /main n’avance que par la file de fusion/, vers)
})

test('ÉCRIVAIN sous config HOSTILE : le commit du train est signé par l’identité de l’UTILISATRICE', () => {
  const { racine } = instanceDeDepot({ fichiers: { 'a.txt': 'a\n' }, message: 'socle' })
  const mesure = mkdtempSync(join(tmpdir(), 'train-hostile-'))
  const g = (...a) => execFileSync('git', a, { cwd: racine, env: envDeDepotForge(), encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()
  try {
    g('config', '--local', '--unset', 'user.name')
    g('config', '--local', '--unset', 'user.email')
    const globale = join(mesure, 'globale.gitconfig')
    writeFileSync(globale, '[user]\n\tname = Utilisatrice Hostile\n\temail = hostile@example.invalid\n[commit]\n\tgpgsign = false\n\tverbose = true\n[core]\n\tquotePath = true\n')
    writeFileSync(join(racine, 'a.txt'), 'a2\n')
    const vu = sousLEnvDeLUtilisatrice(globale, () => {
      const ctx = contexteDe({ racine, branche: 'main', options: {}, journaliser: () => {}, fdLog: 'ignore' })
      return ctx.commit({ message: 'docs: dérivés\n', chemins: ['a.txt'] })
    })
    assert.equal(vu.disponible && vu.valeur.status, 0, JSON.stringify(vu))
    assert.equal(g('log', '-1', '--format=%an <%ae>|%cn|%s'), 'Utilisatrice Hostile <hostile@example.invalid>|Utilisatrice Hostile|docs: dérivés')
  } finally {
    rmSync(racine, { recursive: true, force: true })
    rmSync(mesure, { recursive: true, force: true })
  }
})

/** Les argv LITTÉRAUX passés à `gh`/`appel` dans une source, quelle que soit la graphie de quote. */
function argvDesAppelsGh(code) {
  return [...code.matchAll(/\b(?:gh|appel)\(\s*\[([^\]]*)\]/g)]
    .map((m) => [...m[1].matchAll(/['"`]([^'"`]*)['"`]/g)].map((t) => t[1]))
}

// La SOURCE `gh` du train : le train, ses étapes (#1806) et la couture REST qu'il partage avec les
// autres `ops` (#1813). En lire une partie seulement rendrait le cliquet aveugle.
const SOURCES_GH_DU_TRAIN = ['./publier.mjs', './etapesDuTrain.mjs', '../guards/lib/ticketsGh.mjs']

test('la SOURCE du train : `gh api` en GET, POST, ou PUT sur `merge-async` — aucune route GraphQL, aucun geste de FERMETURE', () => {
  const code = SOURCES_GH_DU_TRAIN
    .map((f) => codeSeul(readFileSync(new URL(f, import.meta.url), 'utf8')))
    .join('\n')
  const argvs = argvDesAppelsGh(code)
  // Sans cette borne, un extracteur cassé rendrait le cliquet VERT en ne lisant plus rien.
  assert.ok(argvs.length >= 3, `le cliquet ne lit plus les appels du train (${argvs.length})`)
  for (const argv of argvs) {
    const dit = `gh ${argv.join(' ')}`
    // Contrat POSITIF : toute sous-commande CLI (`issue`, `pr`, `label`, `project`…) et `api graphql`
    // sont servis par GraphQL, refusé HTTP 403 aux sessions Claude Code où le train tourne (#1804).
    assert.equal(argv[0], 'api', `route hors REST : ${dit}`)
    assert.notEqual(argv[1], 'graphql', `route GraphQL : ${dit}`)
    // La CI ferme (job `fermetures`), jamais le train — ni `gh issue close`, ni son équivalent REST
    // `-X PATCH -f state=closed`, que l'ancienne rédaction de ce cliquet ne voyait pas.
    // `PUT …/pulls/{n}/merge-async` : la demande de fusion REST (#2178), seule route PUT du train.
    for (const nom of ['-X', '--method']) {
      const i = argv.indexOf(nom)
      if (i === -1) continue
      const permise = argv[i + 1] === 'POST' || (argv[i + 1] === 'PUT' && argv.some((a) => /\/pulls\/\$\{[^}]+\}\/merge-async$/.test(a)))
      assert.ok(permise, `méthode interdite au train : ${dit}`)
    }
    assert.equal(argv.some((a) => /state=closed/.test(a)), false, `geste de fermeture : ${dit}`)
  }
  assert.equal(/issue\s+close|state=closed/.test(code), false, 'aucun geste de fermeture dans le train')
})

test('le train n’IMPORTE pas le module qui FERME — l’invariant tient sur les imports, pas sur les argv', () => {
  // Un cliquet d'argv est AVEUGLE à un appel indirect : tant que `publier.mjs` importait
  // `fermer-depuis-main.mjs` pour `DEPOT`/`commitsDeLaPlage`/`marqueDe`, un `fermerLeTicket(…)`
  // glissé dans l'étape `pilotage` laissait ce fichier vert. La mesure est GÉNÉRALE
  // (`scripts/guards/lib/modulesFeuilles.mjs`) et couvre toutes les graphies d'import ; le train lit
  // le vocabulaire d'une plage fermante dans `plageFermante.mjs`, qui ne ferme rien.
  assert.deepEqual(manquementsDeFeuilles().manquements, [])
  const etapes = readFileSync(new URL('./etapesDuTrain.mjs', import.meta.url), 'utf8')
  assert.match(etapes, /from '\.\.\/guards\/lib\/plageFermante\.mjs'/)
})

test('la table des ÉTAPES nomme les huit étapes, dans l’ordre du régime — ni rebase, ni attente de CI, ni fast-forward', () => {
  // `push-branche` → `pr` → `file` : le push de la branche DÉCLENCHE la CI de la tête, la PR armée
  // entre dans la file, et le SERVEUR sérialise et fusionne (#2178).
  assert.deepEqual(NOMS, ['preflight', 'derives', 'docs', 'push-branche', 'pr', 'file', 'pilotage', 'fin'])
})

// ── messageDuTrain / PLAGE_DE_CITATIONS ──────────────────────────────────────────

test('messageDuTrain : un SUJET que la règle du dépôt accepte, le motif au CORPS, pour les trois commits du train', () => {
  const douze = Array.from({ length: 12 }, (_, i) => String(1700 + i))
  const formes = [
    { portee: 'chore(docs)', titre: 'docs dérivés', motif: MOTIF_POST_REWRITE },
    { portee: 'chore(docs)', titre: 'docs dérivés', motif: MOTIF_REGENERATION },
    { portee: 'chore(merge)', titre: 'fusion de origin/main dans chantier/2178', motif: MOTIF_EJECTION },
  ]
  for (const forme of formes)
    for (const numeros of [['1751'], ['1736', '1384'], douze]) {
      const message = messageDuTrain({ ...forme, numeros })
      const dit = `${numeros.length} numéro(s), motif « ${forme.motif} »`
      assert.equal(refusDeSujet(message), null, dit)
      assert.ok(sujetDuMessage(message).startsWith(`${forme.portee}:`), dit)
      assert.ok(message.split(/\r?\n/).slice(1).join('\n').includes(forme.motif), `le motif est au CORPS — ${dit}`)
      for (const n of numeros) assert.match(message, new RegExp(`#${n}\\b`), `#${n} cité — ${dit}`)
    }
  // Les `#N` descendus au corps restent CITÉS : `numerosCites` lit le message entier.
  assert.deepEqual(numerosCites(messageDuTrain({ ...formes[0], numeros: douze })), douze)
})

test('finDeSortie : la FIN de la sortie — les lignes `⛔` si la sortie en porte', () => {
  assert.equal(finDeSortie(`${'docs:check — OK\n'.repeat(40)}⛔ refus`), '⛔ refus')
  const mille = 'a'.repeat(1000)
  assert.equal(finDeSortie(mille), 'a'.repeat(400))
  assert.equal(finDeSortie(`${'b'.repeat(900)}${'c'.repeat(100)}`).endsWith('c'.repeat(100)), true)
  assert.equal(finDeSortie(''), '')
  assert.equal(finDeSortie(null), '')
})

test('PLAGE_DE_CITATIONS : les commits de la branche absents du tronc', () => {
  assert.equal(PLAGE_DE_CITATIONS, 'origin/main..HEAD')
})

// ── journalInitial / gatesRejouees ───────────────────────────────────────────────

test('journalInitial : sans --reprendre, un lot NEUF ignore le journal du disque', () => {
  const lu = { branche: 'chantier/1736', base: 'b', tete: 't', ejections: 1, etapes: { push: { etat: 'vert' } } }
  const vu = journalInitial({ reprendre: false, lu, branche: 'chantier/1736' })
  assert.deepEqual(vu.journal, journalVide('chantier/1736'))
  assert.equal(vu.repris, false)
  // Le cas qui coûtait : le compteur survivait, et le 2ᵉ lot refusait sa première relance.
  assert.equal(vu.journal.ejections, 0)
})

test('journalInitial : avec --reprendre, le journal LU est repris et ses vertes comptées', () => {
  const lu = { branche: 'c', base: 'b', tete: 't', ejections: 1, etapes: { derives: { etat: 'vert' }, docs: { etat: 'vert' }, file: { etat: 'rouge' } } }
  const vu = journalInitial({ reprendre: true, lu, branche: 'c' })
  assert.equal(vu.journal, lu)
  assert.equal(vu.repris, true)
  assert.equal(vu.vertes, 2)
})

test('journalInitial : --reprendre sans journal sur disque part d’un journal NEUF', () => {
  const vu = journalInitial({ reprendre: true, lu: null, branche: 'c' })
  assert.deepEqual(vu.journal, journalVide('c'))
  assert.equal(vu.repris, false)
  assert.equal(vu.vertes, 0)
})

// ── modeDuLog ─────────────────────────────────────────────────────────────────────

test('modeDuLog : le log suit le journal — lot NEUF tronque, `--reprendre` ajoute', () => {
  // Le cas mesuré (2026-09-14) : ouvert en `'a'` sans condition, un run neuf gardait la ligne
  // `PUBLICATION:` du run précédent, et la veille `until grep -q "^PUBLICATION:"` rendait aussitôt.
  assert.equal(modeDuLog({ reprendre: false }), 'w')
  assert.equal(modeDuLog({ reprendre: true }), 'a')
})

test('modeDuLog : l’ENFANT de `--detache` n’ouvre JAMAIS en troncature — le parent a déjà tronqué', () => {
  assert.equal(modeDuLog({ reprendre: false, enfant: true }), 'a')
  assert.equal(modeDuLog({ reprendre: true, enfant: true }), 'a')
  assert.equal(modeDuLog(), 'w')
})

// ── sonde du verrou ───────────────────────────────────────────────────────────────────

// ── rotation du log ───────────────────────────────────────────────────────────────────

test('nomDeRotation : `<nom>.log` devient `<nom>.<AAAAMMJJ-HHMMSS>.log`', () => {
  const date = new Date(2026, 8, 14, 3, 7, 9) // 14 septembre 2026, 03:07:09 — heure LOCALE
  assert.equal(
    nomDeRotation('/c/cache/publication/chantier_1751-ops-partout.log', date),
    '/c/cache/publication/chantier_1751-ops-partout.20260914-030709.log',
  )
  assert.equal(nomDeRotation('main.log', new Date(2026, 11, 1, 23, 59, 59)), 'main.20261201-235959.log')
})

describe('rotationnerLog', () => {
  // Fixture LOCALE : un dossier de cache jetable, jamais `node_modules/.cache` de l'arbre.
  const dossier = mkdtempSync(join(tmpdir(), 'publier-rotation-'))
  const log = join(dossier, 'chantier_1751.log')
  after(() => rmSync(dossier, { recursive: true, force: true }))

  test('un log NON VIDE est tourné ; le log courant libéré ; un log vide ou absent ne l’est pas', () => {
    assert.equal(rotationnerLog(log, new Date(2026, 8, 14, 3, 7, 9)), null, 'log absent : rien à tourner')
    writeFileSync(log, '')
    assert.equal(rotationnerLog(log, new Date(2026, 8, 14, 3, 7, 9)), null, 'log vide : rien à tourner')
    writeFileSync(log, 'PUBLICATION: vert abc\n')
    const tourne = rotationnerLog(log, new Date(2026, 8, 14, 3, 7, 9))
    assert.equal(tourne, join(dossier, 'chantier_1751.20260914-030709.log'))
    assert.equal(readFileSync(tourne, 'utf8'), 'PUBLICATION: vert abc\n')
    assert.equal(existsSync(log), false, 'le log courant est libéré — le run neuf le recrée vide')
  })

  test('le bornage est par PÉREMPTION d’ÂGE, et il ne touche QUE les logs tournés', () => {
    const vieux = join(dossier, 'chantier_1751.20250101-000000.log')
    const recent = join(dossier, 'chantier_1751.20260914-030710.log')
    const voisin = join(dossier, 'chantier_1751.json.31448.tmp')
    const autre = join(dossier, 'chantier_1751.log')
    for (const f of [vieux, recent, voisin, autre]) writeFileSync(f, 'x')
    const perime = Date.now() / 1000 - 8 * 24 * 60 * 60
    utimesSync(vieux, perime, perime)
    utimesSync(voisin, perime, perime)
    rotationnerLog(autre, new Date(2026, 8, 14, 4, 0, 0))
    assert.equal(existsSync(vieux), false, 'un log tourné de plus de 7 jours part')
    assert.equal(existsSync(recent), true, 'un log tourné récent reste')
    assert.equal(existsSync(voisin), true, 'le tmp du JOURNAL n’est pas un log tourné')
  })
})

test('motifDeRotation : il ne prend QUE les logs tournés — ni le log courant, ni le tmp du journal', () => {
  const motif = motifDeRotation('/c/cache/publication/chantier_1751.log')
  assert.equal(motif.test('chantier_1751.20260914-030709.log'), true)
  assert.equal(motif.test('chantier_1751.log'), false)
  assert.equal(motif.test('chantier_1751.json.31448.tmp'), false)
  // Le point du nom de branche est un POINT, jamais un joker : un autre log ne tombe pas dedans.
  assert.equal(motifDeRotation('a.b.log').test('axb.20260914-030709.log'), false)
})

// ── dejaFaite de l'étape `docs` ──────────────────────────────────────────────

test('étape `docs` : déjà faite sur la tête ENREGISTRÉE, pas sur `journal.tete`', () => {
  const docs = ETAPES.find((e) => e.nom === 'docs')
  const ctx = { tete: 'a'.repeat(40) }
  assert.equal(docs.dejaFaite(ctx, { tete: ctx.tete, etapes: { docs: { etat: 'vert', tete: ctx.tete } } }), true)
  // `journal.tete` avance à la fusion d'une reprise : un `docs` vert d'AVANT ne doit pas passer pour
  // fait sur la tête courante.
  assert.equal(docs.dejaFaite(ctx, { tete: ctx.tete, etapes: { docs: { etat: 'vert', tete: 'b'.repeat(40) } } }), false)
  assert.equal(docs.dejaFaite(ctx, { tete: ctx.tete, etapes: { docs: { etat: 'rouge', tete: ctx.tete } } }), false)
  assert.equal(docs.dejaFaite(ctx, journalVide('c')), false)
})

// ── synchroniserAgents ─────────────────────────────────────────────────────────────────
// La décision passe par la porte `ctx.npm` du contexte : ce qui est joué, et dans quel ordre, se
// mesure sans lancer npm.

describe('synchroniserAgents', () => {
  const ctxFactice = (codes) => {
    const joues = []
    const dits = []
    return {
      joues,
      dits,
      npm(script) {
        joues.push(script)
        return { status: codes[script] ?? 0 }
      },
      journaliser: (t) => dits.push(t),
    }
  }

  test('`agents:check` VERT : `agents:check` est le seul script joué, et l’étape continue', () => {
    const ctx = ctxFactice({})
    assert.deepEqual(synchroniserAgents(ctx), { ok: true })
    assert.deepEqual(ctx.joues, ['agents:check'])
    assert.deepEqual(ctx.dits, [])
  })

  test('`agents:check` ROUGE : `agents:sync` est joué APRÈS lui, et l’étape continue', () => {
    const ctx = ctxFactice({ 'agents:check': 1 })
    assert.deepEqual(synchroniserAgents(ctx), { ok: true })
    assert.deepEqual(ctx.joues, ['agents:check', 'agents:sync'])
    assert.match(ctx.dits.join(''), /agents:check` rendu 1 : `npm run agents:sync`/)
  })

  test('`agents:sync` ROUGE : refus qui NOMME le script, son code et ce que le pre-commit ferait', () => {
    const ctx = ctxFactice({ 'agents:check': 1, 'agents:sync': 7 })
    const vu = synchroniserAgents(ctx)
    assert.equal(vu.ok, false)
    assert.equal(vu.raison, '`npm run agents:sync` a rendu 7 : le pre-commit jouerait `agents:check` et refuserait le commit')
    assert.deepEqual(ctx.joues, ['agents:check', 'agents:sync'])
  })
})

// ── ligneDeDetachement ─────────────────────────────────────────────────────────────────

test('ligneDeDetachement : la trace MACHINE que le parent laisse dans le log', () => {
  assert.equal(
    ligneDeDetachement({ pid: 4242, log: '/c/.cache/publication/chantier_1736-publier.log', args: ['--reprendre'] }),
    '[publier] détaché — pid=4242 log=/c/.cache/publication/chantier_1736-publier.log args=--reprendre\n',
  )
  assert.equal(ligneDeDetachement({ pid: 7, log: 'x.log', args: [] }), '[publier] détaché — pid=7 log=x.log args=\n')
})

// ── citerArgv ──────────────────────────────────────────────────────────────────────────

test('citerArgv : un token que `CommandLineToArgvW` relit comme UN argument', () => {
  // Contrat : TOUJOURS entouré de guillemets — un token unique, quelles que soient ses espaces.
  assert.equal(citerArgv('--reprendre'), '"--reprendre"')
  assert.equal(citerArgv('arg avec espace'), '"arg avec espace"')
  assert.equal(citerArgv('/dossier avec espace/publier.mjs'), '"/dossier avec espace/publier.mjs"')
  // Guillemet interne : échappé par un backslash.
  assert.equal(citerArgv('dit "oui"'), '"dit \\"oui\\""')
  // Backslashes AVANT un guillemet : doublés, sinon ils échapperaient le guillemet.
  assert.equal(citerArgv('a\\\\"b'), '"a\\\\\\\\\\"b"')
  // Backslash FINAL : doublé, sinon il échapperait le guillemet fermant du token.
  assert.equal(citerArgv('dep\\'), '"dep\\\\"')
  // L'apostrophe n'est PAS l'affaire de Win32 : elle traverse (c'est la citation PowerShell qui la double).
  assert.equal(citerArgv("d'ops"), '"d\'ops"')
})

// ── lancerDetache ──────────────────────────────────────────────────────────────────────

const LANCEMENT = { script: '/dep/scripts/ops/publier.mjs', args: ['--reprendre'], cwd: '/dep', fdLog: 9, node: '/bin/node' }

test('lancerDetache : sous win32, le train reçoit une console CACHÉE (dont ses enfants héritent)', () => {
  const appels = []
  const pid = lancerDetache({
    ...LANCEMENT,
    plateforme: 'win32',
    envSupplementaire: { WFRP_PUBLIER_ENFANT: '1' },
    executerSync: (exe, args, options) => {
      appels.push({ exe, args, options })
      return { status: 0, stdout: '4242\r\n', stderr: '' }
    },
    detacher: () => assert.fail('aucun spawn direct sous win32 : il donnerait au train un DETACHED_PROCESS sans console'),
  })
  assert.equal(pid, 4242)
  assert.equal(appels.length, 1)
  assert.equal(appels[0].exe, 'powershell.exe')
  assert.deepEqual(appels[0].args.slice(0, 3), ['-NoProfile', '-NonInteractive', '-Command'])
  // FRAGMENTS, pas une chaîne figée : ce qui est SOUS CONTRAT est la console cachée, le pid rendu,
  // l'exécutable et la citation de CHAQUE argument.
  const commande = appels[0].args[3]
  assert.ok(commande.includes(' -WindowStyle Hidden'), commande)
  assert.ok(commande.includes(' -PassThru'), commande)
  assert.ok(commande.includes("-FilePath '/bin/node'"), commande)
  assert.ok(commande.includes(`-ArgumentList '"/dep/scripts/ops/publier.mjs"','"--reprendre"'`), commande)
  assert.equal(appels[0].options.cwd, '/dep')
  assert.equal(appels[0].options.windowsHide, true)
  assert.equal(appels[0].options.env.WFRP_PUBLIER_ENFANT, '1')
})

test('lancerDetache : sous win32, une apostrophe du chemin est CITÉE, jamais interpolée', () => {
  let commande = ''
  lancerDetache({
    ...LANCEMENT,
    script: "/dep d'ops/publier.mjs",
    plateforme: 'win32',
    executerSync: (_exe, args) => {
      commande = args[3]
      return { stdout: '7', stderr: '' }
    },
  })
  assert.match(commande, /-ArgumentList '"\/dep d''ops\/publier\.mjs"','"--reprendre"'/)
})

test('lancerDetache : sous win32, un chemin de script à ESPACE reste UN argument du train', () => {
  // `Start-Process -ArgumentList` joint ses éléments par des espaces SANS les re-citer : mesuré le
  // 2026-09-17, un script sous `dossier avec espace/` rendait un pid et un journal VIDE.
  let commande = ''
  lancerDetache({
    ...LANCEMENT,
    script: '/dep/dossier avec espace/publier.mjs',
    args: ['--file-timeout-min', '30', 'arg avec espace'],
    plateforme: 'win32',
    executerSync: (_exe, args) => {
      commande = args[3]
      return { stdout: '7', stderr: '' }
    },
  })
  assert.ok(
    commande.includes(`-ArgumentList '"/dep/dossier avec espace/publier.mjs"','"--file-timeout-min"','"30"','"arg avec espace"'`),
    commande,
  )
})

test('lancerDetache : sous win32, un pid illisible ARRÊTE le lancement au lieu d’annoncer un train fantôme', () => {
  assert.throws(
    () => lancerDetache({ ...LANCEMENT, plateforme: 'win32', executerSync: () => ({ stdout: '', stderr: 'Start-Process : refus' }) }),
    /détachement manqué.*Start-Process : refus/s,
  )
})

test('lancerDetache : hors win32, le détachement reste `detached` + le fd du journal en stdio', () => {
  const appels = []
  const pid = lancerDetache({
    ...LANCEMENT,
    plateforme: 'linux',
    envSupplementaire: { WFRP_PUBLIER_ENFANT: '1' },
    detacher: (exe, args, options) => {
      appels.push({ exe, args, options })
      return { pid: 31, unref: () => appels.push('unref') }
    },
    executerSync: () => assert.fail('hors win32, aucun intermédiaire : le détachement est celui de libuv'),
  })
  assert.equal(pid, 31)
  assert.equal(appels[0].exe, '/bin/node')
  assert.deepEqual(appels[0].args, ['/dep/scripts/ops/publier.mjs', '--reprendre'])
  assert.equal(appels[0].options.detached, true)
  assert.deepEqual(appels[0].options.stdio, ['ignore', 9, 9])
  assert.equal(appels[0].options.env.WFRP_PUBLIER_ENFANT, '1')
  assert.equal(appels[1], 'unref')
})

// ── filetDuTrainEnfant ───────────────────────────────────────────────────────

const processusFactice = () => {
  const branches = {}
  const sorties = []
  return { branches, sorties, on: (nom, f) => { branches[nom] = f }, exit: (code) => sorties.push(code) }
}

test('filetDuTrainEnfant : la chute d’un train détaché va DANS son journal, avec sa ligne PUBLICATION', () => {
  const processus = processusFactice()
  const ecrits = []
  filetDuTrainEnfant({ chemin: '/c/.cache/publication/chantier_1784.log', processus, ecrire: (chemin, texte) => ecrits.push({ chemin, texte }) })
  assert.deepEqual(Object.keys(processus.branches).sort(), ['uncaughtException', 'unhandledRejection'])

  const boum = new Error('ENOENT: dossier de journal introuvable')
  boum.stack = 'Error: ENOENT: dossier de journal introuvable\n    at main (publier.mjs:1)'
  processus.branches.uncaughtException(boum)
  assert.equal(ecrits.length, 1)
  assert.equal(ecrits[0].chemin, '/c/.cache/publication/chantier_1784.log')
  assert.match(ecrits[0].texte, /^\[publier\] ARRÊT INATTENDU hors train : Error: ENOENT/)
  assert.match(ecrits[0].texte, /at main \(publier\.mjs:1\)/)
  // La veille d'un train détaché attend `PUBLICATION:` : une chute la relâche, en ROUGE.
  assert.match(ecrits[0].texte, /\nPUBLICATION: rouge moteur — Error: ENOENT: dossier de journal introuvable\n$/)
  assert.deepEqual(processus.sorties, [1])
})

test('filetDuTrainEnfant : une promesse rompue tombe par le MÊME filet', () => {
  const processus = processusFactice()
  const ecrits = []
  filetDuTrainEnfant({ chemin: 'x.log', processus, ecrire: (chemin, texte) => ecrits.push({ chemin, texte }) })
  processus.branches.unhandledRejection('rupture nue')
  assert.equal(ecrits[0].chemin, 'x.log')
  assert.match(ecrits[0].texte, /ARRÊT INATTENDU hors train : rupture nue\nPUBLICATION: rouge moteur — rupture nue\n/)
  assert.deepEqual(processus.sorties, [1])
})

// ── corpsDePilotage ────────────────────────────────────────────────────────────────────

const PILOTAGE = {
  numero: '1736',
  base: 'b'.repeat(40),
  tete: 'a'.repeat(40),
  fusion: 'f'.repeat(40),
  commits: [{ sha: 'c'.repeat(40), message: 'feat(ops): corrige #1736 — le train\n\ncorps' }],
  file: { pr: 42, fusion: 'f'.repeat(40), attenteSecondes: 312.5 },
  ferme: true,
}

test('corpsDePilotage : un ticket FERMÉ par la plage l’annonce, la marque porte le commit de FUSION et est la DERNIÈRE ligne', () => {
  const corps = corpsDePilotage(PILOTAGE)
  assert.match(corps, /Ce commit FERME #1736/)
  assert.match(corps, /## Publication fffffffff/)
  assert.ok(corps.includes(`- PR #42 : https://github.com/${DEPOT}/pull/42`), corps)
  assert.equal(corps.trimEnd().split('\n').at(-1), marquePublication(PILOTAGE.fusion))
})

test('corpsDePilotage : un ticket RATTACHÉ le dit, sans promettre de fermeture', () => {
  const corps = corpsDePilotage({ ...PILOTAGE, ferme: false })
  assert.match(corps, /rattaché \(`refs`\)/)
  assert.doesNotMatch(corps, /FERME #1736/)
})

test('corpsDePilotage : fermé par la CI avant le pilotage, et fermé par un AUTRE geste', () => {
  assert.match(corpsDePilotage({ ...PILOTAGE, fermeParCi: true }), /FERMÉ par la CI \(job `fermetures`\)/)
  assert.match(corpsDePilotage({ ...PILOTAGE, fermeAutrement: true }), /déjà FERMÉ par un autre geste/)
})

test('corpsDePilotage : le temps d’ATTENTE de la file est dit COMME TEL, jamais comme du temps machine', () => {
  assert.match(corpsDePilotage(PILOTAGE), /attente de la file : 5\.2 min \(temps d’attente, pas de machine locale\)/)
  assert.doesNotMatch(corpsDePilotage({ ...PILOTAGE, file: { pr: 42 } }), /attente de la file/)
})

test('titreDeCommit : première ligne, coupée AU MOT sous 120 caractères', () => {
  assert.equal(titreDeCommit('un titre\n\ncorps'), 'un titre')
  const titre = titreDeCommit('abcdefgh '.repeat(20).trimEnd())
  assert.ok(titre.length <= 120, titre)
  assert.equal(titre, `${'abcdefgh '.repeat(12)}abcdefgh…`, 'la coupe tombe entre deux mots, jamais dans un mot')
  const tient = `${'mot '.repeat(29)}motx`
  assert.equal(tient.length, 120)
  assert.equal(titreDeCommit(tient), tient, 'un titre de 120 caractères se rend entier')
})

test('sortieDe / refusDeGit : la sortie d’un git en échec, jamais vide', () => {
  // `stderr` VIDE n'est pas nullish : il ne peut pas servir de repli à `??` — `stdout` est lu.
  assert.equal(sortieDe({ disponible: true, valeur: { status: 1, stderr: '', stdout: 'tout sur stdout' } }), 'tout sur stdout')
  // Les deux portent quelque chose : les deux sont dits.
  assert.equal(sortieDe({ disponible: true, valeur: { status: 1, stderr: 'err', stdout: 'out' } }), 'err\nout')
  assert.equal(sortieDe({ disponible: false, raison: 'git absent' }), 'git absent')
  // Rien d'imprimé : `sortieDe` rend '', et `refusDeGit` NOMME le code de sortie.
  assert.equal(sortieDe({ disponible: true, valeur: { status: 1, stderr: '', stdout: '' } }), '')
  assert.match(refusDeGit({ disponible: true, valeur: { status: 1, stderr: '', stdout: '' } }), /status 1/)
  assert.match(refusDeGit({ disponible: true, absent: true }), /status \?/)
})

const journalPush = () => ({ ...journalVide('b'), base: 'aaa', tete: 'ttttttttt' })

// ── étapes `push-branche`, `pr` et `file` ───────────────────────────────────────────────

const etapeBranche = ETAPES.find((e) => e.nom === 'push-branche')

test('push-branche : pousse la TÊTE sur SA branche, par un bail — c’est lui qui déclenche la CI', () => {
  let vus = null
  const ctx = {
    racine: RACINE,
    branche: 'chantier/1776',
    tete: 'ttttttttt',
    journaliser: () => {},
    pousser: (geste) => { vus = geste; return { disponible: true, valeur: { status: 0, stdout: '', stderr: '' } } },
  }
  const vu = etapeBranche.jouer(ctx, journalPush())
  assert.deepEqual(vus, { vers: 'refs/heads/chantier/1776', bail: true })
  assert.equal(vu.ok, true)
  assert.match(vu.dit, /poussé sur chantier\/1776 — la CI de la branche juge/)
})

test('push-branche : un refus de git est ROUGE et porte ce que git a imprimé', () => {
  const ctx = {
    racine: RACINE,
    branche: 'chantier/1776',
    tete: 'ttttttttt',
    journaliser: () => {},
    pousser: () => ({ disponible: true, valeur: { status: 1, stderr: '! [rejected] stale info', stdout: '' } }),
  }
  const vu = etapeBranche.jouer(ctx, journalPush())
  assert.equal(vu.ok, false)
  assert.match(vu.raison, /push de la branche REFUSÉ/)
  assert.match(vu.raison, /stale info/)
})

// ── PR : lecture REST réduite, choix de la PR, état ──────────────────────────────────────────

const REST = (plus = {}) => ({ number: 7, state: 'open', merged_at: null, merge_commit_sha: null, head: { sha: 'ttttttttt' }, mergeable_state: 'clean', ...plus })

test('prDeRest : ouverte, fusionnée (sha de fusion), fermée ; conflit par `mergeable_state: dirty`', () => {
  assert.deepEqual(prDeRest(REST()), { numero: 7, etat: 'ouverte', tete: 'ttttttttt', fusion: null, conflit: false })
  assert.deepEqual(prDeRest(REST({ state: 'closed', merged_at: 'x', merge_commit_sha: 'f'.repeat(40) })).etat, 'fusionnee')
  assert.equal(prDeRest(REST({ state: 'closed', merged_at: 'x', merge_commit_sha: 'f'.repeat(40) })).fusion, 'f'.repeat(40))
  assert.equal(prDeRest(REST({ state: 'closed' })).etat, 'fermee')
  assert.equal(prDeRest(REST({ mergeable_state: 'dirty' })).conflit, true)
})

test('prDeLaBranche / etatDeLaPr : l’OUVERTE d’abord, sinon la FUSIONNÉE de la tête ; une fermée n’est pas la PR', () => {
  const ouverte = prDeRest(REST())
  const fusionnee = prDeRest(REST({ number: 6, state: 'closed', merged_at: 'x', merge_commit_sha: 'f'.repeat(40) }))
  const fermee = prDeRest(REST({ number: 5, state: 'closed' }))
  assert.equal(prDeLaBranche([fusionnee, ouverte], 'ttttttttt'), ouverte)
  assert.equal(prDeLaBranche([fermee, fusionnee], 'ttttttttt'), fusionnee)
  assert.equal(prDeLaBranche([fusionnee], 'autre'), null)
  assert.equal(prDeLaBranche([fermee], 'ttttttttt'), null)
  assert.equal(etatDeLaPr(null, 't'), 'absente')
  assert.equal(etatDeLaPr(fusionnee, 'ttttttttt'), 'fusionnee')
  assert.equal(etatDeLaPr(ouverte, 'autre'), 'tete-changee')
  assert.equal(etatDeLaPr(ouverte, 'ttttttttt'), 'ouverte')
})

test('courseDeFile : la course de la ref d’entrée `gh-readonly-queue/main/pr-<N>-` dont le commit de file a la TÊTE pour parent — jamais celle d’une autre PR, ni d’une entrée antérieure éjectée', () => {
  const parents = { q3: ['m', 'tete'], q2: ['m', 'tete'], q1: ['m', 'ancienne'] }
  const parentsDe = (sha) => (parents[sha] ? { ok: true, parents: parents[sha] } : { ok: false, raison: 'illisible' })
  const courses = [
    { headBranch: 'gh-readonly-queue/main/pr-71-abc', headSha: 'q3', databaseId: 3 },
    { headBranch: 'gh-readonly-queue/main/pr-7-abc', headSha: 'q2', databaseId: 2 },
    { headBranch: 'gh-readonly-queue/main/pr-7-old', headSha: 'q1', databaseId: 1 },
  ]
  assert.equal(courseDeFile(courses, 7, { tete: 'tete', parentsDe }).databaseId, 2)
  assert.equal(courseDeFile(courses, 8, { tete: 'tete', parentsDe }), null)
  assert.equal(courseDeFile(courses.slice(2), 7, { tete: 'tete', parentsDe }), null, 'la course rouge d’une entrée ÉJECTÉE ne juge pas la tête suivante')
  assert.equal(courseDeFile([{ headBranch: 'gh-readonly-queue/main/pr-7-x', headSha: 'q9', databaseId: 9 }], 7, { tete: 'tete', parentsDe }), null, 'parents illisibles : pas la course de la tête')
})

test('titreDePr : aucun mot fermant — la fermeture appartient à `fermetures.yml`', () => {
  assert.equal(titreDePr('chantier/2178'), 'publication chantier/2178')
  assert.deepEqual(numerosCites(titreDePr('chantier/2178')), [])
})

// ── Demande de fusion REST : `PUT …/pulls/{n}/merge-async`, `GET …/merge-async/{uuid}` ──────────────

test('corpsDeFusion : la TÊTE JUGÉE en `sha`, `merge_action: default`, aucun `merge_method` (« Only supported for direct merges »)', () => {
  assert.deepEqual(JSON.parse(corpsDeFusion('a'.repeat(40))), { sha: 'a'.repeat(40), merge_action: 'default' })
})

/** Une sortie de `gh api --include`, en-têtes CRLF (mesuré 2026-09-30). */
const HTTP = (code, corps) => `HTTP/2.0 ${code} X\r\nContent-Type: application/json\r\n\r\n${JSON.stringify(corps)}`

test('reponseHttp : code de la ligne d’état et corps JSON après la ligne vide ; sans ligne d’état, refus nommé', () => {
  assert.deepEqual(reponseHttp(HTTP(409, { status: 'pending' })), { ok: true, code: 409, corps: { status: 'pending' } })
  assert.deepEqual(reponseHttp('HTTP/2.0 204 No Content\r\n\r\n'), { ok: true, code: 204, corps: null })
  assert.match(reponseHttp('{"status":"merged"}').raison, /sans ligne d’état HTTP/)
  assert.match(reponseHttp('HTTP/2.0 200 OK\r\n\r\n{').raison, /HTTP 200, corps illisible/)
})

test('issueDeFusion : 202/409 pendante (uuid), 200 merged/enqueued, 400 failed ; tout autre code se NOMME', () => {
  const pendante = { status: 'pending', details: { message: 'm', uuid: 'u-1', merge_method: 'merge', merge_action: 'default', expected_head_sha: 'ttt' } }
  assert.deepEqual(issueDeFusion({ code: 202, corps: pendante }), { ok: true, statut: 'pending', uuid: 'u-1', attendue: 'ttt', deja: false })
  assert.deepEqual(issueDeFusion({ code: 409, corps: pendante }), { ok: true, statut: 'pending', uuid: 'u-1', attendue: 'ttt', deja: true })
  assert.deepEqual(issueDeFusion({ code: 200, corps: { status: 'merged', details: { message: 'm', sha: 'f'.repeat(40) } } }), { ok: true, statut: 'merged', fusion: 'f'.repeat(40) })
  assert.deepEqual(issueDeFusion({ code: 200, corps: { status: 'enqueued', details: { message: 'm' } } }), { ok: true, statut: 'enqueued' })
  assert.deepEqual(issueDeFusion({ code: 400, corps: { status: 'failed', details: { message: 'Pull request is closed.' } } }), { ok: true, statut: 'failed', message: 'Pull request is closed.' })
  assert.deepEqual(issueDeFusion({ code: 403, corps: { message: 'Resource not accessible' } }), { ok: false, raison: 'HTTP 403 : Resource not accessible' })
  assert.match(issueDeFusion({ code: 202, corps: { status: 'pending', details: {} } }).raison, /HTTP 202 hors schéma/)
})

test('fusionDe : un 4xx de `gh` (exit 1) est LU dans son corps ; une panne sans sortie reste la panne', () => {
  const conflit = { ok: false, raison: 'gh a rendu 1 : (HTTP 409)', stdout: HTTP(409, { status: 'pending', details: { message: 'm', uuid: 'u-2', merge_method: 'merge', merge_action: 'default', expected_head_sha: 't' } }) }
  assert.deepEqual(fusionDe(conflit), { ok: true, statut: 'pending', uuid: 'u-2', attendue: 't', deja: true })
  assert.deepEqual(fusionDe({ ok: false, raison: 'spawn gh ENOENT' }), { ok: false, raison: 'spawn gh ENOENT' })
  assert.match(fusionDe({ ok: false, raison: 'gh a rendu 1 : x', stdout: '' }).raison, /^gh a rendu 1 : x — réponse sans ligne d’état HTTP/)
})

// ── étape `pr` ───────────────────────────────────────────────────────────────────────────────

const etapePr = ETAPES.find((e) => e.nom === 'pr')

test('pr : une PR ABSENTE est créée — aucune demande de fusion ici, elle appartient à l’étape `file`', () => {
  const gestes = []
  let lectures = 0
  const ctx = {
    branche: 'chantier/2178',
    lirePr: () => ({ ok: true, prs: lectures++ === 0 ? [] : [prDeRest(REST())] }),
    ouvrirPr: (p) => { gestes.push(['ouvrir', p.titre]); return { ok: true } },
    demanderFusion: () => assert.fail('la demande de fusion attend la course verte de la branche'),
  }
  const vu = etapePr.jouer(ctx, journalPush())
  assert.deepEqual(gestes, [['ouvrir', 'publication chantier/2178']])
  assert.deepEqual([vu.ok, vu.detail], [true, { pr: 7 }])
})

test('pr : une PR OUVERTE n’est pas recréée ; un refus de création est ROUGE et nommé', () => {
  const ouverte = {
    branche: 'chantier/2178',
    lirePr: () => ({ ok: true, prs: [prDeRest(REST())] }),
    ouvrirPr: () => assert.fail('PR déjà ouverte'),
  }
  assert.deepEqual(etapePr.jouer(ouverte, journalPush()).detail, { pr: 7 })
  const refusee = { branche: 'chantier/2178', lirePr: () => ({ ok: true, prs: [] }), ouvrirPr: () => ({ ok: false, raison: 'gh a rendu 1 : HTTP 422' }) }
  assert.match(etapePr.jouer(refusee, journalPush()).raison, /REFUSÉ : gh a rendu 1 : HTTP 422/)
})

test('pr : déjà faite sur une PR OUVERTE ou FUSIONNÉE de la tête, jamais sur une autre tête', () => {
  const avec = (plus) => ({ lirePr: () => ({ ok: true, prs: [prDeRest(REST(plus))] }) })
  assert.equal(etapePr.dejaFaite(avec({}), journalPush()), true)
  assert.equal(etapePr.dejaFaite(avec({ state: 'closed', merged_at: 'x', merge_commit_sha: 'f'.repeat(40) }), journalPush()), true)
  assert.equal(etapePr.dejaFaite(avec({ head: { sha: 'autre' } }), journalPush()), false)
  assert.equal(etapePr.dejaFaite({ lirePr: () => ({ ok: false, raison: 'x' }) }, journalPush()), false)
})

// ── étape `file` ─────────────────────────────────────────────────────────────────────────────

const etapeFile = ETAPES.find((e) => e.nom === 'file')

const courseDeBrancheVerte = { headSha: 'ttttttttt', status: 'completed', conclusion: 'success', databaseId: 40, workflowName: 'CI' }

/** Le contexte de l'étape `file` : la PR lue, les courses de branche et de file, les jobs rouges, et
 *  les réponses de la demande de fusion (`demande` au PUT, `suivis` aux GET successifs). */
const ctxFile = ({ pr, branche = [courseDeBrancheVerte], file = [], jobs = [], fusion = { disponible: true, valeur: { status: 0, stdout: '', stderr: '' } }, conflits = [], demande = { ok: true, statut: 'enqueued' }, suivis = [], parents = ['m'.repeat(40), 'ttttttttt'], ancetres = [], fileTimeoutMin = 30 } = {}) => {
  const gestes = []
  let suivi = 0
  const ctx = {
    racine: RACINE,
    branche: 'chantier/2178',
    options: { fileTimeoutMin },
    journaliser: () => {},
    tete: 'nnnnnnnnn',
    jobsDesDerives: ['docs'],
    lirePr: () => ({ ok: true, prs: pr ? [prDeRest(pr)] : [] }),
    coursesCi: () => ({ disponible: true, valeur: branche }),
    coursesDeFile: () => ({ disponible: true, valeur: file }),
    parentsDe: () => ({ ok: true, parents }),
    jobsRouges: (id) => { gestes.push(['jobs', id]); return { disponible: true, valeur: jobs } },
    demanderFusion: (p) => { gestes.push(['demander', p]); return demande },
    lireFusion: (p) => { gestes.push(['suivre', p]); return suivis[Math.min(suivi++, suivis.length - 1)] },
    tronc: () => { gestes.push(['tronc']); return { disponible: true, sha: 'm'.repeat(40) } },
    fusionner: ({ message }) => { gestes.push(['fusionner', message]); return fusion },
    abandonnerFusion: () => { gestes.push(['abandonner']); return fusion },
    questions: {
      commitsDeLaPlage: () => [{ sha: 'c'.repeat(40), message: 'feat(ops): refs #2178 — x' }],
      cheminsEnConflit: () => conflits,
      estAncetre: (a, d) => ({ disponible: true, valeur: a === d || ancetres.some(([x, y]) => x === a && y === d) }),
    },
  }
  return { ctx, gestes }
}
const courseDeFileRouge = { headBranch: 'gh-readonly-queue/main/pr-7-abc', headSha: 'g'.repeat(40), status: 'completed', conclusion: 'failure', databaseId: 99, workflowName: 'CI' }

test('file : une PR FUSIONNÉE rend vert, avec le commit de fusion et le temps d’ATTENTE', () => {
  const { ctx } = ctxFile({ pr: REST({ state: 'closed', merged_at: 'x', merge_commit_sha: 'f'.repeat(40) }) })
  const vu = etapeFile.jouer(ctx, journalPush())
  assert.equal(vu.ok, true)
  assert.deepEqual([vu.detail.pr, vu.detail.fusion], [7, 'f'.repeat(40)])
  assert.equal(typeof vu.detail.attenteSecondes, 'number', 'le temps d’attente de GitHub se compte à part du temps machine locale')
})

test('file : une course de BRANCHE rouge — aucune demande de fusion, et le train le NOMME', () => {
  const { ctx, gestes } = ctxFile({ pr: REST(), branche: [{ headSha: 'ttttttttt', status: 'completed', conclusion: 'failure', databaseId: 41, workflowName: 'CI' }] })
  const vu = etapeFile.jouer(ctx, journalPush())
  assert.equal(vu.ok, false)
  assert.ok(vu.raison.includes(`course CI rouge de la branche sur ttttttttt — la PR #7 n’entre pas dans la file : https://github.com/${DEPOT}/actions/runs/41`), vu.raison)
  assert.deepEqual(gestes, [])
})

test('file : course de branche VERTE → `merge-async` sur la TÊTE JUGÉE ; `merged` rend vert avec le commit de fusion', () => {
  const { ctx, gestes } = ctxFile({ pr: REST(), demande: { ok: true, statut: 'merged', fusion: 'f'.repeat(40) } })
  const vu = etapeFile.jouer(ctx, journalPush())
  assert.deepEqual([vu.ok, vu.detail.pr, vu.detail.fusion], [true, 7, 'f'.repeat(40)])
  assert.deepEqual(gestes, [['demander', { numero: 7, sha: 'ttttttttt' }]])
})

test('file : une demande PENDANTE (202, ou 409 déjà pendante) se SUIT par son uuid jusqu’à `merged`', () => {
  for (const deja of [false, true]) {
    const { ctx, gestes } = ctxFile({
      pr: REST(),
      demande: { ok: true, statut: 'pending', uuid: 'u-1', attendue: 'ttttttttt', deja },
      suivis: [{ ok: true, statut: 'merged', fusion: 'f'.repeat(40) }],
    })
    const vu = etapeFile.jouer(ctx, journalPush())
    assert.deepEqual([vu.ok, vu.detail.fusion], [true, 'f'.repeat(40)], `deja=${deja}`)
    assert.deepEqual(gestes.map((g) => g[0]), ['demander', 'suivre'])
    assert.deepEqual(gestes[1][1], { numero: 7, uuid: 'u-1' })
  }
})

test('file : une demande en ÉCHEC (`failed`, 400) ou REFUSÉE est ROUGE et nommée', () => {
  const echec = ctxFile({ pr: REST(), demande: { ok: true, statut: 'failed', message: 'Pull request is closed.' } })
  assert.equal(etapeFile.jouer(echec.ctx, journalPush()).raison, 'demande de fusion de la PR #7 en ÉCHEC : Pull request is closed.')
  const refus = ctxFile({ pr: REST(), demande: { ok: false, raison: 'HTTP 403 : Resource not accessible' } })
  assert.equal(etapeFile.jouer(refus.ctx, journalPush()).raison, '`PUT …/pulls/7/merge-async` REFUSÉ : HTTP 403 : Resource not accessible')
})

test('file : un 409 « déjà pendante » sur une AUTRE tête est REFUSÉ d’emblée, nommé, sans suivi (« the merge will be cancelled »)', () => {
  const { ctx, gestes } = ctxFile({
    pr: REST(),
    demande: { ok: true, statut: 'pending', uuid: 'u-old', attendue: 'ooooooooo', deja: true },
    suivis: [{ ok: true, statut: 'failed', message: 'Head branch was modified.' }],
  })
  const debut = Date.now()
  const vu = etapeFile.jouer(ctx, journalPush())
  assert.equal(vu.ok, false)
  assert.equal(vu.raison, 'une demande de fusion de la PR #7 est DÉJÀ pendante (409, u-old) sur ooooooooo, pas la tête publiée ttttttttt : GitHub l’annule (schéma de `merge-async`, `sha`) — `--reprendre` après son échec')
  assert.deepEqual(gestes.map((g) => g[0]), ['demander'], 'aucun suivi de la demande d’une autre tête')
  assert.ok(Date.now() - debut < 5000, 'aucune attente')
})

test('file : une course de file rouge sur un GROUPE (G^1 hors d’origin/main) n’est PAS une éjection de la PR — ni rouge, ni reprise : on attend dans la borne', () => {
  for (const jobs of [['suite'], ['docs']]) {
    const { ctx, gestes } = ctxFile({ pr: REST(), file: [courseDeFileRouge], jobs, parents: ['p'.repeat(40), 'ttttttttt'], fileTimeoutMin: 0.002 })
    const vu = etapeFile.jouer(ctx, journalPush())
    assert.equal(vu.indetermine, true, `jobs=${jobs}`)
    assert.ok(!gestes.some((g) => ['jobs', 'fusionner'].includes(g[0])), `jobs=${jobs} : ${JSON.stringify(gestes)}`)
  }
})

test('file : une course de file rouge dont G^1 est ANCÊTRE d’origin/main est attribuée à la PR', () => {
  const { ctx, gestes } = ctxFile({ pr: REST(), file: [courseDeFileRouge], jobs: ['suite'], parents: ['p'.repeat(40), 'ttttttttt'], ancetres: [['p'.repeat(40), 'm'.repeat(40)]] })
  const vu = etapeFile.jouer(ctx, journalPush())
  assert.equal(vu.raison, `PR #7 éjectée par la course https://github.com/${DEPOT}/actions/runs/99 — jobs rouges : suite`)
  assert.deepEqual(gestes.map((g) => g[0]), ['demander', 'tronc', 'jobs'])
})

test('file : une PR relue sur un ANCÊTRE de la tête publiée (push pas encore vu) attend dans la borne ; sur une autre histoire, « push hors du train »', () => {
  const pr = REST({ head: { sha: 'aaaaaaaaa' } })
  const vue = ctxFile({ pr, ancetres: [['aaaaaaaaa', 'ttttttttt']], fileTimeoutMin: 0.002 })
  const attente = etapeFile.jouer(vue.ctx, journalPush())
  assert.equal(attente.indetermine, true)
  assert.deepEqual(vue.gestes, [], 'aucune demande de fusion tant que GitHub n’a pas vu la tête')
  const autre = ctxFile({ pr })
  assert.match(etapeFile.jouer(autre.ctx, journalPush()).raison, /un push hors du train/)
})

test('refusDeBranche : une branche qu’aucun filtre `push.branches` de `ci.yml` ne nomme est refusée, filtres nommés', () => {
  assert.equal(refusDeBranche('chantier/2178', ['chantier/**', 'feat/**']), null)
  assert.equal(refusDeBranche('feat/a/b', ['chantier/**', 'feat/**']), null)
  assert.equal(refusDeBranche('claude/x', null), null, 'un `push` sans filtre déclenche toute branche')
  assert.equal(refusDeBranche('claude/x', ['chantier/**', 'feat/**']), 'la branche claude/x ne déclenche pas `ci.yml` (push.branches : chantier/**, feat/**) : aucune course de branche, la file ne l’accepterait pas — publier depuis une branche qu’un de ces filtres nomme')
  assert.match(refusDeBranche('chantier/1', []), /aucun `push`/)
})

test('preflight : une branche hors des filtres `push.branches` est ROUGE avant tout geste ; un `ci.yml` illisible aussi', () => {
  const preflight = ETAPES.find((e) => e.nom === 'preflight')
  const ctxDe = (filtres) => ({
    branche: 'claude/x',
    get filtresDePush() { if (filtres instanceof Error) throw filtres; return filtres },
    questions: { rebaseEntame: () => null, brancheDe: () => 'claude/x', cheminsSales: () => assert.fail('aucune lecture après le refus') },
  })
  assert.match(preflight.jouer(ctxDe(['chantier/**']), journalVide('claude/x')).raison, /^la branche claude.x ne déclenche pas/)
  assert.equal(preflight.jouer(ctxDe(new Error('ci.yml : filtre illisible')), journalVide('claude/x')).raison, 'ci.yml : filtre illisible')
})

test('file : ÉJECTÉE par une course de file rouge HORS des dérivés — rouge NOMMÉ (course, jobs), aucune fusion', () => {
  const { ctx, gestes } = ctxFile({ pr: REST(), file: [courseDeFileRouge], jobs: ['suite'] })
  const vu = etapeFile.jouer(ctx, journalPush())
  assert.equal(vu.ok, false)
  assert.equal(vu.raison, `PR #7 éjectée par la course https://github.com/${DEPOT}/actions/runs/99 — jobs rouges : suite`)
  assert.deepEqual(gestes.map((g) => g[0]), ['demander', 'tronc', 'jobs'], 'aucune reprise sur un rouge que le tronc n’explique pas')
})

test('file : ÉJECTÉE par un CONFLIT — reprise BORNÉE : FUSION d’origin/main (jamais rebase), relance docs → push → pr → file', () => {
  const { ctx, gestes } = ctxFile({ pr: REST({ mergeable_state: 'dirty' }) })
  const journal = journalPush()
  const vu = etapeFile.jouer(ctx, journal)
  assert.equal(vu.ok, true)
  assert.deepEqual(vu.relancer, ['docs', 'push-branche', 'pr', 'file'])
  assert.deepEqual(gestes.map((g) => g[0]), ['demander', 'tronc', 'fusionner'])
  assert.match(gestes[2][1], /^chore\(merge\): refs #2178 — fusion de origin\/main dans chantier\/2178\n/)
  assert.deepEqual([journal.ejections, journal.tete], [1, 'nnnnnnnnn'])
})

test('file : ÉJECTÉE par une course de file rouge sur les seuls jobs des DÉRIVÉS — reprise', () => {
  const { ctx } = ctxFile({ pr: REST(), file: [courseDeFileRouge], jobs: ['docs'] })
  const vu = etapeFile.jouer(ctx, journalPush())
  assert.deepEqual([vu.ok, vu.relancer], [true, ['docs', 'push-branche', 'pr', 'file']])
})

test(`file : une ÉJECTION au-delà de la borne (${BORNE_EJECTIONS}) est rouge, sans fusion`, () => {
  const { ctx, gestes } = ctxFile({ pr: REST({ mergeable_state: 'dirty' }) })
  const vu = etapeFile.jouer(ctx, { ...journalPush(), ejections: BORNE_EJECTIONS })
  assert.equal(vu.ok, false)
  assert.match(vu.raison, /en CONFLIT avec la base de la file — éjectée une 2ᵉ fois, au-delà de la borne \(1\)/)
  assert.deepEqual(gestes.map((g) => g[0]), ['demander'])
})

test('file : une fusion en CONFLIT est ABANDONNÉE et nomme ses fichiers — la main à l’humain, puis `--reprendre`', () => {
  const refus = { disponible: true, valeur: { status: 1, stdout: 'CONFLICT (content)', stderr: '' } }
  const { ctx, gestes } = ctxFile({ pr: REST({ mergeable_state: 'dirty' }), fusion: refus, conflits: ['src/a.ts'] })
  const journal = journalPush()
  const vu = etapeFile.jouer(ctx, journal)
  assert.equal(vu.ok, false)
  assert.match(vu.raison, /fusion de origin\/main REFUSÉE \(CONFLIT, abandonnée\) — fichiers :\n {4}src\/a\.ts/)
  assert.deepEqual(gestes.map((g) => g[0]), ['demander', 'tronc', 'fusionner', 'abandonner'])
  assert.equal(journal.ejections, 0)
})

test('file : la tête de la PR a CHANGÉ hors du train — rouge nommé', () => {
  const { ctx } = ctxFile({ pr: REST({ head: { sha: 'autre' } }) })
  assert.match(etapeFile.jouer(ctx, journalPush()).raison, /la PR #7 porte autre, pas la tête publiée ttttttttt/)
})

test('file : la borne ÉCOULÉE rend INDÉTERMINÉ, jamais un vert — et le dit', () => {
  const { ctx } = ctxFile({ pr: REST() })
  const vu = etapeFile.jouer({ ...ctx, options: { fileTimeoutMin: 0 }, lirePr: () => assert.fail('borne écoulée : aucune lecture') }, journalPush())
  assert.equal(vu.indetermine, true)
  assert.match(vu.raison, /aucune fusion en 0 min pour ttttttttt/)
})

// ── étape `pilotage` ─────────────────────────────────────────────────────────────────────────

test('pilotage : la plage est `fusion^1..fusion^2` (la branche), la marque le commit de FUSION', () => {
  const plages = []
  const poses = []
  const fusion = 'f'.repeat(40)
  const ctx = {
    tete: 'ttttttttt',
    journaliser: () => {},
    tronc: () => ({ disponible: true, sha: fusion }),
    questions: {
      shaDe: (ref) => ({ [`${fusion}^1`]: 'b'.repeat(40), [`${fusion}^2`]: 'a'.repeat(40) })[ref] ?? null,
      commitsDeLaPlage: (plage) => { plages.push(plage); return [{ sha: 'c'.repeat(40), message: 'feat(ops): refs #2178 — x' }] },
    },
    lireTicket: () => ({ ok: true, etat: 'OPEN', corps: [] }),
    commenter: (numero, corps) => { poses.push([numero, corps]); return { ok: true } },
  }
  const journal = { ...journalPush(), etapes: { file: { etat: 'vert', detail: { pr: 7, fusion } } } }
  const vu = ETAPES.find((e) => e.nom === 'pilotage').jouer(ctx, journal)
  assert.equal(vu.ok, true)
  assert.deepEqual(plages, [`${'b'.repeat(40)}..${'a'.repeat(40)}`])
  assert.equal(poses[0][0], '2178')
  assert.equal(poses[0][1].trimEnd().split('\n').at(-1), marquePublication(fusion))
})

test('pilotage : sans commit de fusion au journal, rouge — jamais une plage devinée', () => {
  const vu = ETAPES.find((e) => e.nom === 'pilotage').jouer({ tronc: () => assert.fail('aucune lecture') }, journalPush())
  assert.deepEqual(vu, { ok: false, raison: 'aucun commit de fusion au journal de l’étape `file`' })
})

/** Les fichiers de `COMPTEURS` d'un dépôt jetable, chaque compteur à `valeur`. */
const fichiersDeCompteurs = (valeur) => Object.fromEntries(COMPTEURS.map((c) => [c.fichier, `export const ${c.symbole} = ${valeur};\n`]))

describe('compteurs de version : la valeur que la tête publie est-elle déjà PRISE par le tronc ? (#2222)', () => {
  const saves = COMPTEURS.find((c) => c.symbole === 'SAVE_VERSION')
  const racines = []
  after(() => { for (const racine of racines) rmSync(racine, { recursive: true, force: true }) })

  /** Un dépôt jetable où tout compteur vaut `base`, `train` et `main` écrits par `script`, `origin/main`
   *  posé sur `main`, HEAD sur `train` ; rend le dépôt et `g`. */
  const forger = (script, base = 60) => {
    const { racine } = instanceDeDepot({ fichiers: { 'a.txt': 'a\n', ...fichiersDeCompteurs(base) } })
    racines.push(racine)
    const g = (...args) => execFileSync('git', args, { cwd: racine, env: envDeDepotForge(), encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()
    const ecrire = (texte) => { writeFileSync(join(racine, saves.fichier), texte); g('add', '--', saves.fichier) }
    const outils = {
      g,
      ecrire,
      save: (v, message = `save ${v} sur ${g('rev-parse', '--abbrev-ref', 'HEAD')}`) => { ecrire(`export const SAVE_VERSION = ${v};\n`); g('commit', '-q', '-m', message) },
      autre: (nom) => { writeFileSync(join(racine, nom), `${nom}\n`); g('add', '--', nom); g('commit', '-q', '-m', nom) },
      sur: (branche) => g('checkout', '-q', branche),
      fusionner: () => g('merge', '-q', '--no-ff', '-m', 'fusion du tronc', 'main'),
    }
    g('branch', 'train')
    script(outils)
    g('update-ref', 'refs/remotes/origin/main', 'main')
    outils.sur('train')
    return { racine, g }
  }
  const juger = (script, base) => questionsDuTrain(depotDe(forger(script, base).racine, { env: envDeDepotForge() })).refusDesCompteurs()
  const prise = (publiee, tronc) => [messageDeCollision({ symbole: 'SAVE_VERSION', publiee, tronc })]

  test('(a) la branche et le tronc montent à 61 : refus qui nomme la valeur publiée, celle de main et la prochaine libre', () => {
    assert.deepEqual(juger(({ sur, save }) => { sur('train'); save(61); sur('main'); save(61) }), [
      '`SAVE_VERSION` : la branche publie 61, déjà prise par main (à 61) — prochaine libre : 62, à renuméroter avec sa migration/son golden',
    ])
  })

  test('(b) la branche vise 62, le tronc 61 : 62 est libre, aucun refus', () => {
    assert.deepEqual(juger(({ sur, save }) => { sur('train'); save(62); sur('main'); save(61) }), [])
  })

  test('(c) la branche à 61 fusionne le tronc à 61 sans renuméroter : refus', () => {
    assert.deepEqual(juger(({ sur, save, fusionner }) => { sur('train'); save(61); sur('main'); save(61); sur('train'); fusionner() }), prise(61, 61))
  })

  test('(c2) la même fusion, puis un commit renumérote à 62 : aucun refus', () => {
    assert.deepEqual(juger(({ sur, save, fusionner }) => { sur('train'); save(61); sur('main'); save(61); sur('train'); fusionner(); save(62, 'renumérote') }), [])
  })

  test('(c3) la fusion elle-même résout à 62 : aucun refus', () => {
    assert.deepEqual(juger(({ g, sur, save, ecrire }) => {
      sur('train'); save(61); sur('main'); save(61); sur('train')
      g('merge', '-q', '--no-ff', '--no-commit', 'main')
      ecrire('export const SAVE_VERSION = 62;\n')
      g('commit', '-q', '-m', 'fusion résolue à 62')
    }), [])
  })

  test('(d) seul le tronc monte : aucun refus — (d2) la branche le fusionne : aucun — (d3) puis monte à 62 : aucun', () => {
    assert.deepEqual(juger(({ sur, save, autre }) => { sur('train'); autre('b1'); sur('main'); save(61) }), [])
    assert.deepEqual(juger(({ sur, save, autre, fusionner }) => { sur('train'); autre('b1'); sur('main'); save(61); sur('train'); fusionner() }), [])
    assert.deepEqual(juger(({ sur, save, autre, fusionner }) => { sur('train'); autre('b1'); sur('main'); save(61); sur('train'); fusionner(); save(62) }), [])
  })

  test('(e) la branche monte à 61 puis redescend à 60, le tronc à 61 : refus, FAUX POSITIF ASSUMÉ (JSDoc de `refusDesCompteurs`)', () => {
    assert.deepEqual(juger(({ sur, save }) => { sur('train'); save(61); save(60, 'redescend'); sur('main'); save(61) }), prise(60, 61))
  })

  test('(S8) la branche à 61, le tronc passé à 62, la fusion résolue CÔTÉ TRONC : refus, 62 est prise', () => {
    assert.deepEqual(juger(({ g, sur, save, ecrire }) => {
      sur('train'); save(61); sur('main'); save(61); save(62); sur('train')
      try { g('merge', '-q', '--no-ff', 'main') } catch { /* conflit sur le compteur */ }
      ecrire('export const SAVE_VERSION = 62;\n')
      g('commit', '-q', '-m', 'fusion résolue côté tronc')
    }), prise(62, 62))
  })

  test('(S8b) la même valeur écrite autrement par le tronc, la fusion résolue côté tronc : refus', () => {
    assert.deepEqual(juger(({ g, sur, save, ecrire }) => {
      sur('train'); save(61); sur('main'); ecrire('export const SAVE_VERSION = 61\n'); g('commit', '-q', '-m', 'le tronc à 61'); sur('train')
      try { g('merge', '-q', '--no-ff', 'main') } catch { /* conflit sur le compteur */ }
      ecrire('export const SAVE_VERSION = 61\n')
      g('commit', '-q', '-m', 'fusion résolue côté tronc')
    }), prise(61, 61))
  })

  test('(S13) la branche fusionne le tronc à 61 puis REFORMATE la ligne sans changer la valeur : aucun refus', () => {
    assert.deepEqual(juger(({ g, sur, save, autre, ecrire, fusionner }) => {
      sur('train'); autre('b1'); sur('main'); save(61); sur('train'); fusionner()
      ecrire('export const SAVE_VERSION = 61 ;\n')
      g('commit', '-q', '-m', 'reformate')
    }), [])
  })

  test('(f) compteur déplacé, symbole renommé, forme typée au tronc : refus NOMMÉ, jamais le silence', () => {
    const illisible = (raison) => [`\`SAVE_VERSION\` illisible à la révision origin/main (${saves.fichier}) : ${raison}`]
    assert.deepEqual(juger(({ g, sur, autre }) => { sur('train'); autre('b1'); sur('main'); g('mv', saves.fichier, 'src/state/versions.ts'); g('commit', '-q', '-m', 'déplacé') }), illisible('fichier absent'))
    const uneLigne = illisible('0 ligne(s) `export const SAVE_VERSION = <entier>`, une seule attendue')
    assert.deepEqual(juger(({ g, sur, autre, ecrire }) => { sur('train'); autre('b1'); sur('main'); ecrire('export const VERSION_SAUVEGARDE = 61;\n'); g('commit', '-q', '-m', 'renommé') }), uneLigne)
    assert.deepEqual(juger(({ g, sur, autre, ecrire }) => { sur('train'); autre('b1'); sur('main'); ecrire('export const SAVE_VERSION = 61 as const;\n'); g('commit', '-q', '-m', 'typé') }), uneLigne)
  })

  test('(g) la branche monte à 61, fusionne un tronc inchangé, puis le tronc monte à 61 : refus', () => {
    assert.deepEqual(juger(({ sur, save, autre, fusionner }) => { sur('train'); save(61); sur('main'); autre('m1'); sur('train'); fusionner(); sur('main'); save(61) }), prise(61, 61))
  })

  test('(h) une ligne en CRLF se lit', () => {
    assert.deepEqual(juger(({ g, sur, save, ecrire }) => { sur('train'); ecrire('export const SAVE_VERSION = 61;\r\n'); g('commit', '-q', '-m', 'crlf'); sur('main'); save(61) }), prise(61, 61))
  })

  test('(i) base 58, la branche publie 59, le tronc est passé à 61 par 59 : refus, 59 est prise', () => {
    assert.deepEqual(juger(({ sur, save }) => { sur('train'); save(59); sur('main'); save(59); save(60); save(61) }, 58), prise(59, 61))
  })

  test('git en panne à la lecture des compteurs : refus qui NOMME la panne, jamais « fichier absent »', () => {
    const { racine } = forger(({ sur, save }) => { sur('train'); save(61); sur('main'); save(61) })
    const enPanne = depotDe(racine, {
      env: envDeDepotForge(),
      spawn: (git, args, opts) => (args.includes('cat-file') && args.includes('--batch') ? { status: 1, stdout: '', stderr: '' } : spawnSync(git, args, opts)),
    })
    assert.deepEqual(questionsDuTrain(enPanne).refusDesCompteurs(), ['compteurs de version non jugés, git en panne : `git cat-file --batch` sans lot (status 1)'])
  })

  test('file de fusion : la PR se juge `G^2` contre `G^1` (refus) ; contre `origin/main`, deux PR en vol à 61 passent (silence)', () => {
    let groupe
    const { racine } = forger(({ g, sur, save }) => {
      g('branch', 'A')
      sur('A'); save(61); sur('train'); save(61)
      g('checkout', '-q', '--detach', 'main')
      g('merge', '-q', '--no-ff', '-m', 'groupe A', 'A')
      g('merge', '-q', '--no-ff', '-m', 'groupe train', 'train')
      groupe = g('rev-parse', 'HEAD')
    })
    const depot = depotDe(racine, { env: envDeDepotForge() })
    assert.deepEqual(refusDesCompteurs(depot, { tete: 'train', tronc: 'origin/main' }), [], 'mauvais appel : A pas encore sur main, la PR passe')
    assert.deepEqual(refusDesCompteurs(depot, { tete: 'A', tronc: 'origin/main' }), [], 'mauvais appel : l’autre PR passe aussi')
    assert.deepEqual(refusDesCompteurs(depot, { tete: `${groupe}^2`, tronc: `${groupe}^1` }), prise(61, 61))
  })

  test('file de fusion : `refusDuCommitDeFile` juge `G^2` contre `G^1` sur le commit de file', () => {
    let groupe
    const { racine } = forger(({ g, sur, save }) => {
      g('branch', 'A')
      sur('A'); save(61); sur('train'); save(61)
      g('checkout', '-q', '--detach', 'main')
      g('merge', '-q', '--no-ff', '-m', 'groupe A', 'A')
      g('merge', '-q', '--no-ff', '-m', 'groupe train', 'train')
      groupe = g('rev-parse', 'HEAD')
    })
    assert.deepEqual(refusDuCommitDeFile(depotDe(racine, { env: envDeDepotForge() }), groupe), prise(61, 61))
  })

  test('file de fusion : un commit qui n’a pas DEUX parents est REFUSÉ et nommé, jamais jugé sur une autre paire', () => {
    const { racine, g } = forger(({ sur, save }) => { sur('train'); save(61) })
    const tete = g('rev-parse', 'HEAD')
    assert.deepEqual(refusDuCommitDeFile(depotDe(racine, { env: envDeDepotForge() }), tete), [
      `compteurs de version : ${tete.slice(0, 9)} porte 1 parent(s), un commit de file MERGE en porte deux (G^1 = base du groupe, G^2 = tête de la PR)`,
    ])
    assert.deepEqual(refusDuCommitDeFile(depotDe(racine, { env: envDeDepotForge() }), 'f'.repeat(40)), [`compteurs de version : parents de ${'f'.repeat(40)} illisibles`])
  })
})
