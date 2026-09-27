// Contrat du TRAIN de publication — tout ce qui se juge sans git, sans gh et sans réseau.
//   node --test scripts/ops/publier.test.mjs   (chaîné dans `npm run test:ops`)
//
// Rien ici ne touche l'arbre : le moteur reçoit des étapes FACTICES et un journal EN MÉMOIRE, les
// verdicts reçoivent des listes de courses littérales. Ce que ce fichier ne couvre pas est dit :
// les `jouer` réels (rebase, build-all, push, gh) ne sont jugés que par le train joué.
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
import { GitIndisponible, depotDe } from '../guards/lib/gitPorte.mjs'
import { envDeDepotForge, instanceDeDepot, sousLEnvDeLUtilisatrice } from '../guards/lib/depotGabarit.mjs'
import {
  RACINE,
  attenteCiSecondes,
  citerArgv,
  contexteDe,
  etatDeLEtape,
  filetDuTrainEnfant,
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
  relationAuTronc,
  rotationnerLog,
} from './publier.mjs'
import {
  ETAPES,
  MOTIF_APRES_REBASE,
  MOTIF_POST_REWRITE,
  REFUS_DEUX_FOIS,
  REFUS_TRAIN_DE_FUSION,
  corpsDePilotage,
  decisionDeRebase,
  estDocDerive,
  finDeSortie,
  marquePublication,
  messageDeDerives,
  partitionSales,
  plageDeCitations,
  refusDeGit,
  sortieDe,
  synchroniserAgents,
  titreDeCommit,
  verdictDuTronc,
  verdictDesRuns,
} from './etapesDuTrain.mjs'

const NOMS = ETAPES.map((e) => e.nom)

// ── optionsDe ──────────────────────────────────────────────────────────────────────────

test('optionsDe : les drapeaux et l’option à valeur, sans grammaire empruntée', () => {
  assert.deepEqual(optionsDe([]), {
    detache: false,
    reprendre: false,
    etapes: false,
    ciTimeoutMin: 30,
    inconnus: [],
  })
  assert.equal(optionsDe(['--detache']).detache, true)
  assert.equal(optionsDe(['--reprendre']).reprendre, true)
  assert.equal(optionsDe(['--etapes']).etapes, true)
  assert.equal(optionsDe(['--ci-timeout-min', '12']).ciTimeoutMin, 12)
  // La valeur d'une option n'est JAMAIS lue comme un drapeau inconnu.
  assert.deepEqual(optionsDe(['--ci-timeout-min', '12']).inconnus, [])
  // Une valeur absurde ne DÉGRADE pas la borne : le défaut tient.
  assert.equal(optionsDe(['--ci-timeout-min', 'zero']).ciTimeoutMin, 30)
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
    etapes: { preflight: { etat: 'vert', tete: 'aaa' }, derives: { etat: 'vert', tete: 'aaa' }, rebase: { etat: 'rouge', tete: 'aaa' } },
  }
  assert.equal(planDeReprise(journal, NOMS, 'aaa'), 'rebase')
})

test('planDeReprise : tout vert POUR CETTE TÊTE → rien à jouer', () => {
  const journal = { tete: 'aaa', etapes: Object.fromEntries(NOMS.map((n) => [n, { etat: 'vert', tete: 'aaa' }])) }
  assert.equal(planDeReprise(journal, NOMS, 'aaa'), null)
})

test('planDeReprise : une étape verte pour une AUTRE tête est À FAIRE (2ᵉ lot sur la même branche)', () => {
  const journal = { tete: 'bbb', etapes: Object.fromEntries(NOMS.map((n) => [n, { etat: 'vert', tete: 'aaa' }])) }
  assert.equal(planDeReprise(journal, NOMS, 'bbb'), NOMS[0])
  assert.equal(etatDeLEtape(journal, 'ci', 'bbb'), 'à faire (verte pour une autre tête)')
  assert.equal(etatDeLEtape({ tete: 'aaa', etapes: {} }, 'ci', 'aaa'), 'à faire')
})

test('planDeReprise : la règle de tête porte sur la tête VIVANTE, et une étape SANS estampille est à faire', () => {
  // La tête PUBLIÉE du journal ne décide de rien : seule la tête vivante est comparée.
  const publie = { tete: 'aaa', etapes: Object.fromEntries(NOMS.map((n) => [n, { etat: 'vert', tete: 'aaa' }])) }
  assert.equal(planDeReprise(publie, NOMS, 'bbb'), NOMS[0])
  assert.equal(planDeReprise(publie, NOMS, 'aaa'), null)
  // Une étape estampillée `null` (journal d'avant la règle) N'est PAS verte pour toute tête.
  const sansEstampille = {
    tete: 'aaa',
    etapes: Object.fromEntries(NOMS.map((n) => [n, { etat: 'vert', tete: n === 'preflight' ? null : 'aaa' }])),
  }
  assert.equal(planDeReprise(sansEstampille, NOMS, 'aaa'), 'preflight')
  assert.equal(etatDeLEtape(sansEstampille, 'preflight', 'aaa'), 'à faire (verte pour une autre tête)')
  assert.equal(etatDeLEtape(publie, 'ci', 'aaa'), 'vert')
})

test('planDeReprise / etatDeLEtape : une étape SANS estampille est à faire, MÊME sans tête vivante', () => {
  // L'échappatoire fermée : `null !== null` est FAUX — une étape estampillée `null` jugée alors que
  // la tête vivante n'a pas pu être mesurée se déclarait verte. L'ABSENCE d'estampille décide seule.
  const sansEstampille = {
    tete: 'aaa',
    etapes: Object.fromEntries(NOMS.map((n) => [n, { etat: 'vert', tete: n === 'preflight' ? null : 'aaa' }])),
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
  // Le détail PRÉCÉDENT survit : `ci.dejaFaite` relit `detail.etat`, l’écraser resonderait la course.
  const repris = { ...journalVide('b'), etapes: { ci: { etat: 'vert', tete: 'vivante', detail: { etat: 'verte' } } } }
  jouerLeTrain({ tete: 'vivante' }, [factice('ci', { ok: true }, { deja: true })], repris)
  assert.deepEqual(repris.etapes.ci.detail, { etat: 'verte', dejaFaite: true })
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
  assert.deepEqual(cles, ['abandonnerRebase', 'branche', 'commenter', 'commit', 'coursesCi', 'docs', 'fdLog', 'journaliser', 'lireTicket', 'npm', 'options', 'pousser', 'questions', 'racine', 'rebaser', 'tete', 'tronc'])
  assert.deepEqual(Object.keys(ctx.questions).sort(), ['brancheDe', 'ceQuiChange', 'cheminGit', 'cheminsEnConflit', 'cheminsSales', 'combienDe', 'commitsDeLaPlage', 'estAncetre', 'origineDe', 'relationAuTronc', 'shaDe'])
  assert.equal(Object.isFrozen(ctx.questions), true)
  for (const script of ['x; git add -A', 'x && git commit -m libre', 'a b', '$(git add -A)', '', 7])
    assert.throws(() => ctx.npm(script), /ctx\.npm : un NOM de script/, JSON.stringify(script))
  for (const mode of ['--check; git add -A', '--write', undefined])
    assert.throws(() => ctx.docs(mode), /ctx\.docs : mode de build-all inconnu/, JSON.stringify(mode))
  for (const sha of ['HEAD', 'a'.repeat(39), `${'a'.repeat(40)}\n`, ['a'.repeat(40)], undefined])
    assert.throws(() => ctx.coursesCi(sha), /ctx\.coursesCi : un sha COMPLET/, JSON.stringify(sha))
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
  assert.throws(() => ctx.questions.cheminGit('rebase-merge'), GitIndisponible)
})

test('git INDISPONIBLE avant le train (racine, branche, tête) : une ligne finale `PUBLICATION: rouge` NOMMÉE, jamais une pile brute', () => {
  const cale = mkdtempSync(join(tmpdir(), 'git-en-panne-'))
  try {
    writeFileSync(join(cale, 'git'), "#!/bin/sh\necho 'fatal: panne simulée' >&2\nexit 128\n", { mode: 0o755 })
    const vu = spawnSync(process.execPath, [fileURLToPath(new URL('./publier.mjs', import.meta.url)), '--etapes'], {
      encoding: 'utf8', env: { ...process.env, PATH: `${cale}:${process.env.PATH}`, WFRP_PUBLIER_ENFANT: '' },
    })
    assert.equal(vu.status, 1, vu.stderr)
    assert.equal(vu.stderr, 'PUBLICATION: rouge lecture — git indisponible : fatal: panne simulée\n')
  } finally {
    rmSync(cale, { recursive: true, force: true })
  }
})

test('`ctx.commit` sans chemins, ou à chemins vides, LÈVE avant tout spawn : ni `git add -A`, ni commit de tout l’index', () => {
  const ctx = contexteDe({ racine: '/nulle-part', branche: 'chantier/x', options: {}, journaliser: () => {}, fdLog: 'ignore' })
  for (const p of [{ message: 'm' }, { message: 'm', chemins: [] }, { message: 'm', chemins: null }]) {
    assert.throws(() => ctx.commit(p), /commitDe : un commit porte des `chemins` explicites/, JSON.stringify(p))
  }
})

test('`pousser` refuse `--force-with-lease` vers `main`, sous ses deux noms, AVANT tout spawn', () => {
  const ctx = contexteDe({ racine: '/nulle-part', branche: 'chantier/x', options: {}, journaliser: () => {}, fdLog: 'ignore' })
  for (const vers of ['main', 'refs/heads/main']) {
    assert.throws(() => ctx.pousser({ vers, bail: true }), /main n’entre qu’en fast-forward/, vers)
  }
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

test('la SOURCE du train : `gh api` en GET ou POST — aucune route GraphQL, aucun geste de FERMETURE', () => {
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
    for (const nom of ['-X', '--method']) {
      const i = argv.indexOf(nom)
      if (i !== -1) assert.equal(argv[i + 1], 'POST', `méthode interdite au train : ${dit}`)
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

test('la table des ÉTAPES nomme les neuf étapes, dans l’ordre du régime', () => {
  // `derives` vient AVANT `rebase` : mesuré le 2026-09-14, `git rebase origin/main` refuse de
  // démarrer sur un arbre sale, donc les dérivés laissés par le hook `post-rewrite` se commettent
  // avant lui — les tolérer à la préflight ne suffisait pas.
  // `push-branche` → `ci` → `ff-main` : le push de la branche DÉCLENCHE la CI, la CI JUGE, et `main`
  // ne reçoit qu'un fast-forward d'une tête verte (#1776).
  assert.deepEqual(NOMS, ['preflight', 'derives', 'rebase', 'docs', 'push-branche', 'ci', 'ff-main', 'pilotage', 'fin'])
})

// ── messageDeDerives / plageDeCitations ──────────────────────────────────────────

test('messageDeDerives : un SUJET que la règle du dépôt accepte, le motif au CORPS, pour les deux étapes', () => {
  const douze = Array.from({ length: 12 }, (_, i) => String(1700 + i))
  for (const motif of [MOTIF_POST_REWRITE, MOTIF_APRES_REBASE])
    for (const numeros of [['1751'], ['1736', '1384'], douze]) {
      const message = messageDeDerives(numeros, motif)
      const dit = `${numeros.length} numéro(s), motif « ${motif} »`
      assert.equal(refusDeSujet(message), null, dit)
      assert.ok(sujetDuMessage(message).startsWith('chore(docs):'), dit)
      assert.ok(message.split(/\r?\n/).slice(1).join('\n').includes(motif), `le motif est au CORPS — ${dit}`)
      for (const n of numeros) assert.match(message, new RegExp(`#${n}\\b`), `#${n} cité — ${dit}`)
    }
  // Les `#N` descendus au corps restent CITÉS : `numerosCites` lit le message entier.
  assert.deepEqual(numerosCites(messageDeDerives(douze, MOTIF_POST_REWRITE)), douze)
})

test('finDeSortie : la FIN de la sortie — les lignes `⛔` si la sortie en porte', () => {
  assert.equal(finDeSortie(`${'docs:check — OK\n'.repeat(40)}⛔ refus`), '⛔ refus')
  const mille = 'a'.repeat(1000)
  assert.equal(finDeSortie(mille), 'a'.repeat(400))
  assert.equal(finDeSortie(`${'b'.repeat(900)}${'c'.repeat(100)}`).endsWith('c'.repeat(100)), true)
  assert.equal(finDeSortie(''), '')
  assert.equal(finDeSortie(null), '')
})

test('plageDeCitations : le journal quand il PORTE la plage, `origin/main..HEAD` avant le rebase', () => {
  assert.equal(plageDeCitations({ base: 'b'.repeat(40), tete: 'a'.repeat(40) }), `${'b'.repeat(40)}..${'a'.repeat(40)}`)
  // L'étape `derives` joue AVANT `rebase` : le journal n'a encore ni base ni tête.
  assert.equal(plageDeCitations(journalVide('c')), 'origin/main..HEAD')
  assert.equal(plageDeCitations({ base: 'b'.repeat(40), tete: null }), 'origin/main..HEAD')
  assert.equal(plageDeCitations(undefined), 'origin/main..HEAD')
})

// ── journalInitial / gatesRejouees ───────────────────────────────────────────────

test('journalInitial : sans --reprendre, un lot NEUF ignore le journal du disque', () => {
  const lu = { branche: 'chantier/1736', base: 'b', tete: 't', reprises: 1, etapes: { push: { etat: 'vert' } } }
  const vu = journalInitial({ reprendre: false, lu, branche: 'chantier/1736' })
  assert.deepEqual(vu.journal, journalVide('chantier/1736'))
  assert.equal(vu.repris, false)
  // Le cas qui coûtait : `reprises` survivait, et le 2ᵉ lot refusait « origin/main a bougé DEUX fois ».
  assert.equal(vu.journal.reprises, 0)
})

test('journalInitial : avec --reprendre, le journal LU est repris et ses vertes comptées', () => {
  const lu = { branche: 'c', base: 'b', tete: 't', reprises: 1, etapes: { rebase: { etat: 'vert' }, docs: { etat: 'vert' }, gates: { etat: 'rouge' } } }
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

test('attenteCiSecondes : le temps d’ATTENTE de la CI vit sur l’étape `ci`, séparé du temps local', () => {
  assert.equal(attenteCiSecondes({ etapes: { ci: { etat: 'vert', detail: { attenteCiSecondes: 312.5 } } } }), 312.5)
  assert.equal(attenteCiSecondes({ etapes: { ci: { etat: 'vert', detail: {} } } }), null)
  assert.equal(attenteCiSecondes(journalVide('c')), null)
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
  // `journal.tete` est réécrit par le `rebase` du lot SUIVANT : un `docs` vert du lot PRÉCÉDENT
  // ne doit pas passer pour fait sur la tête courante.
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
    args: ['--ci-timeout-min', '30', 'arg avec espace'],
    plateforme: 'win32',
    executerSync: (_exe, args) => {
      commande = args[3]
      return { stdout: '7', stderr: '' }
    },
  })
  assert.ok(
    commande.includes(`-ArgumentList '"/dep/dossier avec espace/publier.mjs"','"--ci-timeout-min"','"30"','"arg avec espace"'`),
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
  commits: [{ sha: 'c'.repeat(40), message: 'feat(ops): corrige #1736 — le train\n\ncorps' }],
  ci: { etat: 'verte', course: { databaseId: 42 }, attenteCiSecondes: 312.5 },
  ferme: true,
}

test('corpsDePilotage : un ticket FERMÉ par la plage l’annonce, la marque est la DERNIÈRE ligne', () => {
  const corps = corpsDePilotage(PILOTAGE)
  assert.match(corps, /Ce commit FERME #1736/)
  assert.match(corps, /course `42`/)
  assert.equal(corps.trimEnd().split('\n').at(-1), marquePublication(PILOTAGE.tete))
})

test('corpsDePilotage : un ticket RATTACHÉ le dit, sans promettre de fermeture', () => {
  const corps = corpsDePilotage({ ...PILOTAGE, ferme: false })
  assert.match(corps, /rattaché \(`refs`\)/)
  assert.doesNotMatch(corps, /FERME #1736/)
})

test('corpsDePilotage : fermé par la CI avant le rendu de l’étape `ci`, et fermé par un AUTRE geste', () => {
  assert.match(corpsDePilotage({ ...PILOTAGE, fermeParCi: true }), /FERMÉ par la CI \(job `fermetures`\)/)
  assert.match(corpsDePilotage({ ...PILOTAGE, fermeAutrement: true }), /déjà FERMÉ par un autre geste/)
})

test('corpsDePilotage : le temps d’ATTENTE de la CI est dit COMME TEL, jamais comme du temps machine', () => {
  assert.match(corpsDePilotage(PILOTAGE), /attente du verdict CI : 5\.2 min \(temps d’attente, pas de machine locale\)/)
  // Une course jamais lue n'invente pas de durée.
  assert.doesNotMatch(corpsDePilotage({ ...PILOTAGE, ci: { etat: 'non lue' } }), /attente du verdict CI/)
})

test('titreDeCommit : première ligne, bornée à 120 caractères', () => {
  assert.equal(titreDeCommit('un titre\n\ncorps'), 'un titre')
  assert.equal(titreDeCommit(`${'x'.repeat(200)}`).length, 120)
})

test('verdictDuTronc : inchangé, bougé (relance), bougé une SECONDE fois (rouge)', () => {
  assert.equal(verdictDuTronc({ distant: 'aaa', base: 'aaa', reprises: 0 }), 'inchangé')
  assert.equal(verdictDuTronc({ distant: 'aaa', base: 'aaa', reprises: 1 }), 'inchangé')
  assert.equal(verdictDuTronc({ distant: 'bbb', base: 'aaa', reprises: 0 }), 'relancer')
  assert.equal(verdictDuTronc({ distant: 'bbb', base: 'aaa' }), 'relancer')
  assert.equal(verdictDuTronc({ distant: 'bbb', base: 'aaa', reprises: 1 }), 'rouge-deux-fois')
  assert.equal(verdictDuTronc({ distant: 'bbb', base: 'aaa', reprises: 2 }), 'rouge-deux-fois')
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

/** L'étape `ff-main`, jouée avec un `ctx` FACTICE : `tronc()` et `pousser()` sont ses deux seules portes. */
const etapePush = ETAPES.find((e) => e.nom === 'ff-main')
const ctxPush = ({ sha, push }) => ({
  racine: RACINE,
  branche: 'chantier/1776',
  tete: 'ttttttttt',
  journaliser: () => {},
  tronc: () => ({ disponible: true, sha }),
  pousser: () => push,
})
const REFUS_PUSH = { disponible: true, valeur: { status: 1, stderr: '! [rejected] main -> main (non-fast-forward)', stdout: '' } }
const journalPush = (reprises) => ({ ...journalVide('b'), base: 'aaa', tete: 'ttttttttt', reprises })

test('ff-main : un refus de git sur un tronc qui a BOUGÉ rend la relance, pas une panne', () => {
  const journal = journalPush(0)
  // Le tronc est mesuré DEUX fois : intact avant le push, bougé après (origin/main a reçu des commits).
  let tour = 0
  const ctx = { ...ctxPush({ sha: 'aaa', push: REFUS_PUSH }), tronc: () => ({ disponible: true, sha: tour++ === 0 ? 'aaa' : 'bbbbbbbbb' }) }
  const vu = etapePush.jouer(ctx, journal)
  assert.equal(vu.ok, true)
  // La relance repasse par le PUSH DE BRANCHE et par la CI : la tête rebasée est un contenu NEUF,
  // et c'est son PROPRE run que le fast-forward exigera vert (#1776, patron #1751).
  assert.deepEqual(vu.relancer, ['rebase', 'docs', 'push-branche', 'ci'])
  assert.equal(vu.dit, 'origin/main a bougé pendant le push (bbbbbbbbb) : le train reprend au rebase')
  assert.equal(journal.reprises, 1)
})

test('ff-main : un refus de git sur un tronc INCHANGÉ est rouge, et DIT ce que git a imprimé', () => {
  const journal = journalPush(0)
  const vu = etapePush.jouer(ctxPush({ sha: 'aaa', push: REFUS_PUSH }), journal)
  assert.equal(vu.ok, false)
  assert.match(vu.raison, /non-fast-forward/)
  assert.equal(journal.reprises, 0)
})

test('ff-main : un refus SANS sortie nomme le code de sortie', () => {
  const journal = journalPush(0)
  const vu = etapePush.jouer(ctxPush({ sha: 'aaa', push: { disponible: true, valeur: { status: 1, stderr: '', stdout: '' } } }), journal)
  assert.equal(vu.ok, false)
  assert.match(vu.raison, /status 1/)
})

test('ff-main : un tronc bougé une SECONDE fois est rouge — avant comme après le push', () => {
  const avant = journalPush(1)
  assert.deepEqual(etapePush.jouer(ctxPush({ sha: 'bbb', push: REFUS_PUSH }), avant), { ok: false, raison: REFUS_DEUX_FOIS })
  const apres = journalPush(1)
  let tour = 0
  const ctx = { ...ctxPush({ sha: 'aaa', push: REFUS_PUSH }), tronc: () => ({ disponible: true, sha: tour++ === 0 ? 'aaa' : 'bbb' }) }
  assert.deepEqual(etapePush.jouer(ctx, apres), { ok: false, raison: REFUS_DEUX_FOIS })
  assert.equal(apres.reprises, 1)
})

test('ff-main : tronc intact et fast-forward accepté → vert', () => {
  const vu = etapePush.jouer(ctxPush({ sha: 'aaa', push: { disponible: true, valeur: { status: 0, stdout: '', stderr: '' } } }), journalPush(0))
  assert.deepEqual(vu, { ok: true, dit: 'ttttttttt entré dans main en fast-forward' })
})

// ── étapes `push-branche` et `ci` ───────────────────────────────────────────────

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
  const vu = etapeBranche.jouer(ctx, journalPush(0))
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
  const vu = etapeBranche.jouer(ctx, journalPush(0))
  assert.equal(vu.ok, false)
  assert.match(vu.raison, /push de la branche REFUSÉ/)
  assert.match(vu.raison, /stale info/)
})

const etapeCi = ETAPES.find((e) => e.nom === 'ci')

/** Les courses servies à l'étape `ci` par le geste `ctx.coursesCi`, qui note le sha demandé. */
function avecCourses(courses, jouer) {
  const demandes = []
  const vu = jouer({ ...ctxCi(), coursesCi: (sha) => { demandes.push(sha); return { disponible: true, valeur: courses } } })
  assert.deepEqual([...new Set(demandes)], [journalPush(0).tete], 'l’étape lit les courses de la TÊTE du journal')
  return vu
}

const ctxCi = () => ({
  racine: RACINE,
  branche: 'chantier/1776',
  tete: 'ttttttttt',
  options: { ciTimeoutMin: 30 },
  journaliser: () => {},
})

test('ci : un run VERT sur la tête rend vert, et le journal porte le temps d’ATTENTE', () => {
  const vu = avecCourses(
    [{ headSha: 'ttttttttt', status: 'completed', conclusion: 'success', databaseId: 7, workflowName: 'CI' }],
    (ctx) => etapeCi.jouer(ctx, journalPush(0)),
  )
  assert.equal(vu.ok, true)
  assert.equal(vu.detail.etat, 'verte')
  assert.equal(typeof vu.detail.attenteCiSecondes, 'number',
    'le temps d’attente de GitHub se compte à part du temps machine locale (#1776)')
})

test('ci : un run ROUGE rend le job et l’URL du run — et RIEN n’est entré dans main', () => {
  const vu = avecCourses(
    [{ headSha: 'ttttttttt', status: 'completed', conclusion: 'failure', databaseId: 33691303703, workflowName: 'CI' }],
    (ctx) => etapeCi.jouer(ctx, journalPush(0)),
  )
  assert.equal(vu.ok, false)
  assert.match(vu.raison, /course CI rouge \(33691303703\)/)
  assert.match(vu.raison, /RIEN n'est entré dans main/)
  assert.match(vu.raison, /https:\/\/github\.com\/cgauche\/game\/actions\/runs\/33691303703/)
  assert.equal(typeof vu.detail.attenteCiSecondes, 'number')
})

test('ci : une course ANNULÉE n’est pas un vert — elle rougit, en se nommant', () => {
  const vu = avecCourses(
    [{ headSha: 'ttttttttt', status: 'completed', conclusion: 'cancelled', databaseId: 9, workflowName: 'CI' }],
    (ctx) => etapeCi.jouer(ctx, journalPush(0)),
  )
  assert.equal(vu.ok, false)
  assert.match(vu.raison, /course CI annulee \(9\)/)
})

test('ci : la borne ÉCOULÉE rend INDÉTERMINÉ, jamais un vert — et le dit', () => {
  const vu = etapeCi.jouer({ ...ctxCi(), options: { ciTimeoutMin: 0 }, coursesCi: () => assert.fail('borne écoulée : aucune lecture') }, journalPush(0))
  assert.equal(vu.indetermine, true)
  assert.match(vu.raison, /aucun verdict de la CI en 0 min sur ttttttttt/)
  assert.match(vu.raison, /rien n'est entré dans main/)
})

// ── étape `rebase` : la relation d'origin/main à HEAD (#1998) ─────────────────────────

test('decisionDeRebase : tronc contenu → aucun rebase ; fusions hors tronc → refus ; sinon rebase', () => {
  assert.equal(decisionDeRebase({ contenu: true, fusions: true }), 'contenu')
  assert.equal(decisionDeRebase({ contenu: true, fusions: false }), 'contenu')
  assert.equal(decisionDeRebase({ contenu: false, fusions: true }), 'fusions')
  assert.equal(decisionDeRebase({ contenu: false, fusions: false }), 'rebase')
})

describe('étape `rebase` sur un VRAI dépôt : train de fusion, puis tronc qui avance', () => {
  const etapeRebase = ETAPES.find((e) => e.nom === 'rebase')
  const { racine } = instanceDeDepot({ fichiers: { 'a.txt': 'a\n' } })
  after(() => rmSync(racine, { recursive: true, force: true }))
  const g = (...args) => execFileSync('git', args, { cwd: racine, env: envDeDepotForge(), encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()
  const commit = (fichier) => { writeFileSync(join(racine, fichier), `${fichier}\n`); g('add', '--', fichier); g('commit', '-q', '-m', fichier) }
  const avancerLeTronc = (fichier) => {
    g('checkout', '-q', 'main')
    commit(fichier)
    g('update-ref', 'refs/remotes/origin/main', 'main')
    g('checkout', '-q', 'train')
  }
  // Le ctx de l'étape : ses écrivains JETTENT — l'étape ne doit lancer aucun rebase dans ces deux cas.
  const depot = depotDe(racine, { env: envDeDepotForge() })
  const ctx = {
    racine,
    questions: questionsDuTrain(depot),
    get tete() { return g('rev-parse', 'HEAD') },
    rebaser: () => { throw new Error('git rebase lancé') },
    abandonnerRebase: () => { throw new Error('git rebase --abort lancé') },
  }
  g('checkout', '-q', '-b', 'train')
  commit('b.txt')
  g('checkout', '-q', 'main')
  commit('c.txt')
  g('update-ref', 'refs/remotes/origin/main', 'main')
  g('checkout', '-q', 'train')
  g('merge', '-q', '--no-ff', '-m', 'fusion du tronc', 'main')
  commit('d.txt')

  test('tronc CONTENU : relation « contenu », aucun rebase, journal posé, « tronc déjà contenu »', () => {
    assert.deepEqual(relationAuTronc(depot), { disponible: true, contenu: true, fusions: false })
    const journal = journalVide('train')
    const vu = etapeRebase.jouer(ctx, journal)
    const base = g('rev-parse', 'origin/main')
    const tete = g('rev-parse', 'HEAD')
    assert.equal(vu.ok, true)
    assert.equal(vu.dit, `tronc déjà contenu — base ${base.slice(0, 9)} → tête ${tete.slice(0, 9)}`)
    assert.deepEqual([journal.base, journal.tete, vu.detail.reecrit], [base, tete, false])
    assert.equal(etapeRebase.dejaFaite(ctx, journal), true)
  })

  test('le tronc AVANCE : relation « non contenu + fusions », refus NOMMÉ, aucun rebase, histoire intacte', () => {
    avancerLeTronc('e.txt')
    assert.deepEqual(relationAuTronc(depot), { disponible: true, contenu: false, fusions: true })
    const tete = g('rev-parse', 'HEAD')
    const journal = journalVide('train')
    assert.deepEqual(etapeRebase.jouer(ctx, journal), { ok: false, raison: REFUS_TRAIN_DE_FUSION })
    assert.equal(g('rev-parse', 'HEAD'), tete)
    assert.equal(journal.base, null)
    assert.equal(etapeRebase.dejaFaite(ctx, journal), false)
  })

  test('branche LINÉAIRE non contenue : un VRAI `git rebase origin/main` sous le contexte RÉEL, histoire linéaire', () => {
    g('checkout', '-q', '-b', 'lineaire', 'main~1')
    commit('f.txt')
    assert.deepEqual(relationAuTronc(depot), { disponible: true, contenu: false, fusions: false })
    const teteAvant = g('rev-parse', 'HEAD')
    const ctxReel = contexteDe({ racine, branche: 'lineaire', options: {}, journaliser: () => {}, fdLog: 'ignore' })
    const journal = journalVide('lineaire')
    const vu = etapeRebase.jouer(ctxReel, journal)
    const base = g('rev-parse', 'origin/main')
    const tete = g('rev-parse', 'HEAD')
    assert.equal(vu.ok, true)
    assert.equal(vu.dit, `base ${base.slice(0, 9)} → tête ${tete.slice(0, 9)}`)
    assert.notEqual(tete, teteAvant)
    assert.deepEqual([journal.base, journal.tete, journal.teteAvant, vu.detail.reecrit], [base, tete, teteAvant, true])
    assert.equal(g('rev-parse', 'HEAD~1'), base)
    assert.equal(g('rev-list', '--merges', `${base}..HEAD`), '')
    assert.equal(etapeRebase.dejaFaite(ctxReel, journal), true)
  })
})
