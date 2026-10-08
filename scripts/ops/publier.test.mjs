// Contrat du TRAIN de publication — tout ce qui se juge sans git, sans gh et sans réseau.
//   node --test scripts/ops/publier.test.mjs   (chaîné dans `npm run test:ops`)
//
// Rien ici ne touche l'arbre : le moteur reçoit des étapes FACTICES et un journal EN MÉMOIRE, les
// verdicts reçoivent des listes de courses littérales. Ce que ce fichier ne couvre pas est dit :
// les `jouer` réels (build-all, push, gh) ne sont jugés que par le train joué. Exceptions nommées : les
// CLI réelles sous git feint (#2285), le constat d'une `fin` tuée sur le journal CAPTURÉ du témoin 6 et la
// veille composite tuée sous bash (#2493, `.git/suivi/2493-design-verdict-2026-10-08.md`, §4 T2 et T3).
import { corpsDeFusion, fusionDe, issueDeFusion, refusDEnfileur, reponseHttp } from '../guards/lib/fusionPr.mjs'
import { PLAFOND_RELANCES } from '../guards/lib/coursesCi.mjs'
import { REFUS_DE_FILE } from './fixtures/github-refus-file.mjs'
import { ENTREE_2495, JEUNE_2495, PR_2495 } from './fixtures/github-2495-file.mjs'
import { tableTotale } from '../../src/lib/tableTotale.ts'
import test, { after, describe, mock } from 'node:test'
import childProcess from 'node:child_process'
import { syncBuiltinESMExports } from 'node:module'
import assert from 'node:assert/strict'
import { spawn, spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { copyFileSync, cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, utimesSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { codeSeul } from '../guards/lib/commentPoison.mjs'
import { ast, typescript } from '../guards/lib/dialecte.mjs'
import { manquementsDeFeuilles } from '../guards/lib/modulesFeuilles.mjs'
import { numerosCites } from '../guards/lib/fermetures.mjs'
import { clotureDImports } from '../guards/lib/importGraph.mjs'
import { refusDeSujet, sujetDuMessage } from '../guards/lib/sujetDeCommit.mjs'
import { GitIndisponible, MARQUE_FEINTE, ajouterOrigine, classer, commitDe, depotDe, pousser, refusDeGit, reussi, shaDe, sortieDe } from '../guards/lib/gitPorte.mjs'
import { DEPOT } from '../guards/lib/ticketsGh.mjs'
import { envDeDepotForge, envGitFeint, instanceDeDepot, sousGitFeint, sousLEnvDeLUtilisatrice } from '../guards/lib/depotGabarit.mjs'
import { citerArgv, lancerDetache } from '../guards/lib/lancerDetache.mjs'
import { ecrireJsonAtomique } from '../guards/lib/ecritureJsonAtomique.mjs'
import { estPidVivant, sousEcheanceAsync } from '../test/verrou.mjs'
import { mesurerPrincipal, synchroniserPrincipal } from './synchroniser.mjs'
import { GENERATORS, perimetreDesMixtes } from '../docs/build-all.mjs'
import {
  CODE_ARRET_MOTEUR,
  CODE_BORNE_DEPASSEE,
  CODE_INDETERMINEE,
  ENV_LANCEMENT,
  FILE_TIMEOUT_MIN,
  RACINE,
  borneDeVeilleMin,
  codeDeVerdict,
  commandeDeVeille,
  cheminsDeJournal,
  entameDuRun,
  envDeLancement,
  idDeRun,
  lancementDe,
  ligneDePublication,
  pidDeRun,
  runDe,
  transitionsDuRun,
  veillerLeTrain,
  constaterLaMort,
  contexteDe,
  etatDeLEtape,
  etatDuTrain,
  filetDuTrainEnfant,
  jouerLeTrain,
  journalInitial,
  journalVide,
  lancementNpm,
  ligneDeDetachement,
  lireJournal,
  mortDuRun,
  modeDuLog,
  motifDeRotation,
  nomDeJournal,
  nomDeRotation,
  optionsDe,
  planDeReprise,
  rotationnerLog,
  transitionDuRun,
  vivant,
} from './publier.mjs'
import {
  BORNE_EJECTIONS,
  ETAPES,
  MOTIF_EJECTION,
  MOTIF_REGENERATION,
  MOTIF_STOCKS,
  PLAGE_DE_CITATIONS,
  corpsDePilotage,
  courseDeFile,
  estDocDerive,
  etatDeLaPr,
  finDeSortie,
  marquePublication,
  messageDuTrain,
  partitionSales,
  prDeLaBranche,
  prDeRest,
  refusDeBranche,
  synchroniserAgents,
  titreDeCommit,
  titreDePr,
} from './etapesDuTrain.mjs'
import { gitDe } from '../test/gitDeBanc.mjs'

const NOMS = ETAPES.map((e) => e.nom)

// ── optionsDe ──────────────────────────────────────────────────────────────────────────

test('optionsDe : les drapeaux et l’option à valeur, sans grammaire empruntée', () => {
  assert.deepEqual(optionsDe([]), {
    detache: false,
    reprendre: false,
    etapes: false,
    fileTimeoutMin: FILE_TIMEOUT_MIN,
    veiller: null,
    depuis: 0,
    constat: false,
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
  assert.equal(optionsDe(['--veiller', '4242-1790000000000']).veiller, '4242-1790000000000')
  assert.deepEqual(optionsDe(['--veiller', '4242-1790000000000']).inconnus, [])
  // Un run illisible n'est jamais veillé : il se rend inconnu, et la commande refuse.
  assert.deepEqual(optionsDe(['--veiller', 'dernier']).inconnus, ['--veiller dernier'])
  assert.deepEqual(optionsDe(['--veiller']).inconnus, ['--veiller'])
  // `--constat` (#2493) : seulement avec `--veiller`.
  assert.deepEqual([optionsDe(['--veiller', '4242-1790000000000', '--constat']).constat, optionsDe(['--veiller', '4242-1790000000000', '--constat']).inconnus], [true, []])
  assert.deepEqual([optionsDe(['--constat']).constat, optionsDe(['--constat']).inconnus], [false, ['--constat']])
})

// ── nomDeJournal ───────────────────────────────────────────────────────────────────────

test('nomDeJournal : une branche devient un NOM DE FICHIER légal', () => {
  assert.equal(nomDeJournal('chantier/1736-publier'), 'chantier_1736-publier')
  assert.equal(nomDeJournal('main'), 'main')
  // `\w` est ASCII : un accent tombe avec le reste — le nom de fichier reste ASCII, par construction.
  assert.equal(nomDeJournal('feat/ét é:x'), 'feat_t_x')
  assert.equal(nomDeJournal(undefined), 'sans-branche')
})

// ── etatDuTrain : l'unique lecteur du journal (#2280, V2) ─────────────────────────────────────

/** Un journal du run `r` (pid 7) dont les étapes `faites` sont vertes pour `tete`, la suivante `en` à l'état donné. */
function journalDuRun({ faites = 2, en = 'en-vol', verdict = null, tete = 'aaa' } = {}) {
  const etapes = {}
  NOMS.slice(0, faites).forEach((nom, i) => { etapes[nom] = { etat: 'vert', tete, run: '7-1', seq: i + 1 } })
  if (en) etapes[NOMS[faites]] = { etat: en, tete, run: '7-1', seq: faites + 1 }
  return { ...journalVide('b'), tete, run: '7-1', pid: 7, seq: faites + (en ? 1 : 0), verdict, etapes }
}

test('etatDuTrain : aucun run au journal → `aucun`, rang 0 ; la reprise et les étapes suivent la règle de tête', () => {
  for (const journal of [null, journalVide('b')]) {
    const vu = etatDuTrain(journal, { teteVivante: 'aaa', vivant: () => assert.fail('aucun pid à sonder') })
    assert.deepEqual({ etat: vu.etat, etape: vu.etape, rang: vu.rang, total: vu.total, run: vu.run, seq: vu.seq, reprise: vu.reprise },
      { etat: 'aucun', etape: null, rang: 0, total: NOMS.length, run: null, seq: 0, reprise: NOMS[0] })
    assert.deepEqual(vu.etapes, NOMS.map((nom) => ({ nom, etat: 'à faire' })))
  }
})

test('etatDuTrain : sans verdict, le pid VIVANT dit `en-vol` et le pid MORT dit `mort`, à l’étape de la dernière transition', () => {
  const journal = journalDuRun({ faites: 2 })
  const enVol = etatDuTrain(journal, { teteVivante: 'aaa', vivant: (pid) => pid === 7 })
  assert.deepEqual([enVol.etat, enVol.etape, enVol.rang, enVol.seq], ['en-vol', NOMS[2], 3, 3])
  assert.equal(etatDuTrain(journal, { teteVivante: 'aaa', vivant: () => false }).etat, 'mort')
  assert.equal(etatDuTrain({ ...journal, pid: undefined }, { teteVivante: 'aaa' }).etat, 'mort', 'un run sans pid au journal ne vit pas')
  const autreRun = { ...journal, etapes: { ...journal.etapes, [NOMS[5]]: { etat: 'vert', tete: 'aaa', run: '3-0', seq: 99 } } }
  assert.equal(etatDuTrain(autreRun, { teteVivante: 'aaa', vivant: () => true }).etape, NOMS[2], 'une transition d’un AUTRE run ne compte pas')
})

test('etatDuTrain : le VERDICT pour la tête vivante — vert, rouge, indéterminée ; rouge moteur reste rouge', () => {
  const total = NOMS.length
  const vert = etatDuTrain(journalDuRun({ faites: total, en: null, verdict: { etat: 'vert' } }), { teteVivante: 'aaa', vivant: () => assert.fail('un verdict ne sonde pas le pid') })
  assert.deepEqual([vert.etat, vert.etape, vert.rang, vert.reprise], ['vert', NOMS.at(-1), total, null])
  assert.equal(etatDuTrain(journalDuRun({ en: 'rouge', verdict: { etat: 'rouge', etape: NOMS[2] } }), { teteVivante: 'aaa' }).etat, 'rouge')
  assert.equal(etatDuTrain(journalDuRun({ en: 'indéterminée', verdict: { etat: 'indeterminee' } }), { teteVivante: 'aaa' }).etat, 'indéterminée')
  assert.equal(etatDuTrain(journalDuRun({ verdict: { etat: 'rouge', etape: 'moteur' } }), { teteVivante: 'aaa' }).etat, 'rouge')
})

test('etatDuTrain : un train MORT sur une tête qui n’est plus HEAD est `périmé`, jamais `mort` à vie', () => {
  const journal = journalDuRun({ faites: 2 })
  assert.equal(etatDuTrain(journal, { teteVivante: 'bbb', vivant: () => false }).etat, 'périmé')
  assert.equal(etatDuTrain(journal, { teteVivante: 'aaa', vivant: () => false }).etat, 'mort', 'témoin : sur la tête vivante, il reste mort')
})

test('etatDuTrain : un verdict posé pour une AUTRE tête que HEAD est `périmé` ; en vol, la tête ne périme rien', () => {
  const perime = etatDuTrain(journalDuRun({ faites: NOMS.length, en: null, verdict: { etat: 'vert' } }), { teteVivante: 'bbb' })
  assert.deepEqual([perime.etat, perime.reprise], ['périmé', NOMS[0]])
  assert.equal(etatDuTrain(journalDuRun({ en: 'rouge', verdict: { etat: 'rouge', etape: 'x' } }), { teteVivante: 'bbb' }).etat, 'périmé')
  assert.equal(etatDuTrain(journalDuRun(), { teteVivante: 'bbb', vivant: () => true }).etat, 'en-vol', 'le train commite ses dérivés : HEAD bouge pendant le vol')
})

test('vivant : le processus courant vit ; un pid qui n’est pas un entier positif ne vit pas, sans sonde', () => {
  assert.equal(vivant(process.pid), true)
  for (const pid of [undefined, null, 0, -1, 1.5, '7']) assert.equal(vivant(pid), false, String(pid))
})

// ── planDeReprise / etatDeLEtape ───────────────────────────────────────────────────────

test('planDeReprise : journal vide → la première étape', () => {
  assert.equal(planDeReprise(journalVide('b'), NOMS, 'aaa'), NOMS[0])
  assert.equal(planDeReprise(undefined, NOMS, 'aaa'), NOMS[0])
})

test('planDeReprise : la première étape NON verte', () => {
  const journal = {
    tete: 'aaa',
    etapes: { preflight: { etat: 'vert', tete: 'aaa' }, docs: { etat: 'rouge', tete: 'aaa' } },
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
  // Elle est SAUVÉE comme une étape jouée — le journal du disque la porte ; `deux`, jouée, l'est à
  // son entrée (`en-vol`) puis à son verdict.
  assert.deepEqual(sauves, ['un', 'un+deux', 'un+deux'])
  // Une étape JOUÉE s’estampille à la même tête vivante, jamais à la tête publiée du journal.
  assert.equal(journal.etapes.deux.tete, 'vivante')
  // Le détail PRÉCÉDENT survit : `file.dejaFaite` relit `detail.fusion`, l’écraser referait attendre la file.
  const repris = { ...journalVide('b'), etapes: { file: { etat: 'vert', tete: 'vivante', detail: { fusion: 'f' } } } }
  jouerLeTrain({ tete: 'vivante' }, [factice('file', { ok: true }, { deja: true })], repris)
  assert.deepEqual(repris.etapes.file.detail, { fusion: 'f', dejaFaite: true })
})

test('jouerLeTrain : le journal est écrit à l’ENTRÉE (`en-vol`) et au VERDICT de chaque étape jouée', () => {
  const sauves = []
  const journal = entameDuRun(journalVide('b'), { run: '7-1', pid: 7, fileTimeoutMin: 1 })
  jouerLeTrain({}, [factice('un', { ok: true, dit: 'fait' }), factice('deux', { ok: false, raison: 'x' })], journal, {
    sauver: (j) => sauves.push(`${Object.entries(j.etapes).map(([n, e]) => `${n}:${e.etat}`).join('+')}`),
  })
  assert.deepEqual(sauves, ['un:en-vol', 'un:vert', 'un:vert+deux:en-vol', 'un:vert+deux:rouge'])
  // Chaque étape porte le run qui l'a écrite et son `dit` : le `dit` d'un vert, la `raison` d'un rouge.
  assert.deepEqual([journal.etapes.un.run, journal.etapes.un.dit], ['7-1', 'fait'])
  assert.deepEqual([journal.etapes.deux.run, journal.etapes.deux.dit], ['7-1', 'x'])
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

// ── estDocDerive ───────────────────────────────────────────────────────────────────────

// Les générateurs RÉELS (`GENERATORS`) : un motif `injecte` large (`docs/raw/**/*.md`) atteint aussi des
// cibles PURES, que seule la table réelle porte.
describe('estDocDerive', () => {
  const GEN = GENERATORS

  test('estDocDerive : les fiches MIXTES de l’Atlas sont DÉRIVÉES', () => {
    assert.equal(estDocDerive('docs/raw/4e/activites.md', GEN), true)
    assert.equal(estDocDerive('docs/raw/4e/00-index.md', GEN), true)
  })

  test('estDocDerive : une cible PURE ne se commite pas (#2203), même sous un motif `injecte`', () => {
    for (const pure of ['docs/systemes.md', 'docs/raw/coverage.md', 'docs/raw/4e/catalogue-sorts.md', 'docs/.sources-lues.json', 'src/audio/_registry.generated.ts'])
      assert.equal(estDocDerive(pure, GEN), false, pure)
  })

  test('estDocDerive : les sorties d’agents:sync sont DÉRIVÉES', () => {
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
    const vu = partitionSales(['docs/raw/4e/activites.md', 'docs/raw/4e/00-index.md'], GEN)
    assert.deepEqual(vu.derives, ['docs/raw/4e/activites.md', 'docs/raw/4e/00-index.md'])
    assert.deepEqual(vu.manuscrits, [])
  })

  test('partitionSales : des MANUSCRITS seuls', () => {
    const vu = partitionSales(['src/state/cascade.ts', 'docs/architecture.md'], GEN)
    assert.deepEqual(vu.derives, [])
    assert.deepEqual(vu.manuscrits, ['src/state/cascade.ts', 'docs/architecture.md'])
  })

  test('partitionSales : MIXTE — chaque chemin dans son tas, l’ordre conservé', () => {
    const vu = partitionSales(['docs/raw/4e/00-index.md', 'src/state/cascade.ts', 'AGENTS.md', 'docs/raw/coverage.md', 'docs/architecture.md'], GEN)
    assert.deepEqual(vu.derives, ['docs/raw/4e/00-index.md', 'AGENTS.md'])
    assert.deepEqual(vu.manuscrits, ['src/state/cascade.ts', 'docs/raw/coverage.md', 'docs/architecture.md'])
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
  assert.deepEqual(cles, ['abandonnerFusion', 'branche', 'commenter', 'commit', 'conclureFusionSansCiblesPures', 'coursesCi', 'coursesDeFile', 'demanderFusion', 'docs', 'etatFileDePr', 'fdLog', 'filtresDePush', 'fusionner', 'generators', 'jobsEnEchec', 'journaliser', 'lireFusion', 'lirePr', 'lireTicket', 'npm', 'options', 'ouvrirPr', 'parentsDe', 'pousser', 'questions', 'racine', 'synchroniserPrincipal', 'tete', 'tronc'])
  assert.deepEqual(Object.keys(ctx.questions).sort(), ['attributsDeFusion', 'baseAuTronc', 'brancheDe', 'ceQuiChange', 'cheminsEnConflit', 'cheminsSales', 'combienDe', 'commitsDeLaPlage', 'estAncetre', 'origineDe', 'rebaseEntame', 'shaDe', 'verdictDesFusions'])
  assert.equal(Object.isFrozen(ctx.questions), true)
  assert.equal(ctx.generators, GENERATORS)
  for (const script of ['x; git add -A', 'x && git commit -m libre', 'a b', '$(git add -A)', '', 7])
    assert.throws(() => ctx.npm(script), /ctx\.npm : un NOM de script/, JSON.stringify(script))
  for (const mode of ['--check; git add -A', '--check', '--write', '--quiet', undefined])
    assert.throws(() => ctx.docs(mode), /ctx\.docs : mode de build-all inconnu/, JSON.stringify(mode))
  for (const sha of ['HEAD', 'a'.repeat(39), `${'a'.repeat(40)}\n`, ['a'.repeat(40)], undefined])
  {
    assert.throws(() => ctx.coursesCi(sha), /ctx\.coursesCi : un sha COMPLET/, JSON.stringify(sha))
    assert.throws(() => ctx.demanderFusion({ numero: 7, sha }), /ctx\.demanderFusion : un sha COMPLET/, JSON.stringify(sha))
    assert.throws(() => ctx.etatFileDePr({ numero: 7, sha }), /ctx\.etatFileDePr : un sha COMPLET/, JSON.stringify(sha))
    assert.throws(() => ctx.lireFusion({ numero: 7, sha, uuid: '12345678-1234-1234-1234-123456789abc' }), /ctx\.lireFusion : un sha COMPLET/, JSON.stringify(sha))
    assert.throws(() => ctx.parentsDe(sha), /ctx\.parentsDe : un sha COMPLET/, JSON.stringify(sha))
  }
  for (const numero of ['0', '7a', undefined])
    assert.throws(() => ctx.demanderFusion({ numero, sha: 'a'.repeat(40) }), /ctx\.demanderFusion : un NUMÉRO/, JSON.stringify(numero))
  for (const uuid of ['x', '630b9d5e-3f2a-4f7e-8b0c-2d5f9a8c1e42/../..', undefined])
    assert.throws(() => ctx.lireFusion({ numero: 7, uuid }), /ctx\.lireFusion : un UUID de demande/, JSON.stringify(uuid))
  for (const id of ['1', 0, -3, 1.5, undefined])
    assert.throws(() => ctx.jobsEnEchec(id), /ctx\.jobsEnEchec : un id de course/, JSON.stringify(id))
  for (const essai of [0, -1, 1.5, '2']) assert.throws(() => ctx.jobsEnEchec(1, essai), /ctx\.jobsEnEchec : un essai de course/, String(essai))
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
  assert.equal(vu.status, CODE_ARRET_MOTEUR, vu.stderr)
  const lignes = vu.stderr.split('\n').filter(Boolean)
  assert.equal(lignes.at(-1), 'PUBLICATION: rouge moteur — refus (status 128) — fatal: panne simulée', vu.stderr)
  assert.deepEqual(lignes.filter((l) => !l.startsWith(MARQUE_FEINTE)), [
    'refus (status 128) — fatal: panne simulée',
    'PUBLICATION: rouge moteur — refus (status 128) — fatal: panne simulée',
  ])
  assert.ok(lignes.length > 2, `la panne est FEINTE, et se marque : ${vu.stderr}`)
})

test('#2285 avant train : processus réel, diagnostic complet puis ligne finale de présentation', () => {
  const stderr = `${'notes avant train\n'.repeat(40)}cause concrète tardive`
  const stdout = 'notes stdout distinctes'
  const vu = spawnSync(process.execPath, [fileURLToPath(new URL('./publier.mjs', import.meta.url)), '--etapes'], {
    encoding: 'utf8', env: { ...process.env, ...envGitFeint([{ si: [], status: 19, stdout, stderr }]), WFRP_PUBLIER_ENFANT: '' },
  })
  assert.equal(vu.status, CODE_ARRET_MOTEUR)
  assert.ok(vu.stderr.includes(stderr), vu.stderr)
  assert.ok(vu.stderr.includes(stdout), vu.stderr)
  assert.match(vu.stderr, /refus \(status 19\)/)
  assert.equal(vu.stderr.trimEnd().split('\n').at(-1), 'PUBLICATION: rouge moteur — refus (status 19) — notes avant train')
})

function implantationDuCli() {
  const depot = instanceDeDepot()
  const { racine } = depot
  try {
    cpSync(join(RACINE, 'node_modules/semver'), join(racine, 'node_modules/semver'), { recursive: true })
    copyFileSync(join(RACINE, 'package.json'), join(racine, 'package.json'))
    for (const rel of clotureDImports(['scripts/ops/publier.mjs'], { racine: RACINE, typesEffaces: true })) {
      const cible = join(racine, rel)
      mkdirSync(dirname(cible), { recursive: true })
      copyFileSync(join(RACINE, rel), cible)
    }
    return depot
  } catch (e) {
    rmSync(racine, { recursive: true, force: true })
    throw e
  }
}

test('#2285 consommateurs moteur : vrai CLI, journal et log autonomes', () => {
  const { racine } = implantationDuCli()
  try {
    const branche = 'chantier/2285-consommateurs-' + process.pid + '-' + Date.now()
    const chemins = cheminsDeJournal(racine, branche)
    assert.equal(existsSync(chemins.json), false)
    assert.equal(existsSync(chemins.log), false)
    const stderr = 'note moteur\n'.repeat(45) + 'cause moteur tardive\n'
    const stdout = 'stdout moteur distinct'
    assert.ok(stderr.indexOf('cause moteur tardive') > 400)
    assert.ok(stderr.endsWith('\n'))
    const vu = spawnSync(process.execPath, [join(racine, 'scripts/ops/publier.mjs')], {
      cwd: racine, encoding: 'utf8', env: { ...envDeDepotForge(), ...envGitFeint([
        { si: ['--show-toplevel'], stdout: racine, status: 0 },
        { si: ['symbolic-ref', '--quiet', '--short', 'HEAD'], stdout: branche, status: 0 },
        { si: ['HEAD^{commit}'], stdout: 'a'.repeat(40), status: 0 },
        { si: ['rev-parse', '--git-path', 'rebase-merge'], stdout, stderr, status: 29 },
        { si: [], status: 97, stderr: 'GARDE consommateurs : commande interdite\n' },
      ]), WFRP_PUBLIER_ENFANT: '', WFRP_PUBLIER_LOG: '' },
    })
    assert.equal(vu.status, CODE_ARRET_MOTEUR, vu.stderr)
    const journal = JSON.parse(readFileSync(chemins.json, 'utf8'))
    const log = readFileSync(chemins.log, 'utf8')
    for (const texte of [journal.verdict.raison, log]) {
      assert.ok(texte.includes(stderr), texte)
      assert.ok(texte.includes(stdout), texte)
      assert.match(texte, /refus \(status 29\)/)
      assert.equal(texte.includes('GARDE consommateurs'), false, texte)
    }
    assert.equal(log.trimEnd().split('\n').at(-1), 'PUBLICATION: rouge moteur — refus (status 29) — note moteur')
  } finally {
    rmSync(racine, { recursive: true, force: true })
  }
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
  const g = gitDe(racine, { net: true })
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
const SOURCES_GH_DU_TRAIN = ['./publier.mjs', './etapesDuTrain.mjs', './reprendre-file.mjs', '../guards/lib/ticketsGh.mjs', '../guards/lib/fusionPr.mjs']

const DOCUMENTS_GRAPHQL_DU_TRAIN = new Set([
  'query IdentiteDeFusion($owner: String!, $name: String!, $number: Int!) { repository(owner: $owner, name: $name) { pullRequest(number: $number) { id headRefOid state merged mergeCommit { oid } isInMergeQueue mergeQueueEntry { id state enqueuedAt enqueuer { login } headCommit { oid } } } } viewer { login } }',
  'mutation EnfilerFusion($input: EnqueuePullRequestInput!) { enqueuePullRequest(input: $input) { mergeQueueEntry { id headCommit { oid } } } }',
])

function verifierGraphqlDuTrain(code) {
  const ts = typescript()
  const sf = ast({ rel: fileURLToPath(import.meta.url), text: code })
  const nue = (n) => {
    while (n && ts.isParenthesizedExpression(n)) n = n.expression
    return n
  }
  const texteLitteral = (n) => {
    const lu = nue(n)
    return lu && (ts.isStringLiteral(lu) || ts.isNoSubstitutionTemplateLiteral(lu)) ? lu.text : null
  }
  const propriete = (objet, nom) => ts.isObjectLiteralExpression(objet)
    ? objet.properties.find((p) => ts.isPropertyAssignment(p) && p.name.getText(sf) === nom)?.initializer : undefined
  let lus = 0
  function visiter(n) {
    if (ts.isCallExpression(n) && ['gh', 'appel'].includes(nue(n.expression).getText(sf))
      && n.arguments[0] && ts.isArrayLiteralExpression(nue(n.arguments[0]))) {
      const args = nue(n.arguments[0]).elements
      if (args.some((a) => texteLitteral(a) === 'graphql')) {
        assert.ok(args.every((a) => ts.isStringLiteral(a)), 'argv GraphQL canonique')
        assert.deepEqual(args.map((a) => ts.isStringLiteral(a) ? a.text : null), ['api', 'graphql', '--input', '-'])
        const input = propriete(n.arguments[1], 'input')
        assert.ok(input && ts.isCallExpression(input) && input.expression.getText(sf) === 'JSON.stringify', 'GraphQL stdin structuré')
        const query = propriete(input.arguments[0], 'query')
        assert.ok(query && ts.isStringLiteral(query) && DOCUMENTS_GRAPHQL_DU_TRAIN.has(query.text), 'document GraphQL interdit')
        assert.ok(propriete(input.arguments[0], 'variables'), 'GraphQL variables structurées')
        lus++
      }
    }
    n.forEachChild(visiter)
  }
  visiter(sf)
  return lus
}

test('la SOURCE du train : REST et deux documents GraphQL fixes, aucun geste de FERMETURE', () => {
  const code = SOURCES_GH_DU_TRAIN
    .map((f) => codeSeul(readFileSync(new URL(f, import.meta.url), 'utf8')))
    .join('\n')
  const argvs = argvDesAppelsGh(code)
  // Sans cette borne, un extracteur cassé rendrait le cliquet VERT en ne lisant plus rien.
  assert.ok(argvs.length >= 3, `le cliquet ne lit plus les appels du train (${argvs.length})`)
  for (const argv of argvs) {
    const dit = `gh ${argv.join(' ')}`
    // #1804 ; #2437
    assert.equal(argv[0], 'api', `route hors REST : ${dit}`)
    if (argv[1] === 'graphql') continue
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
  assert.equal(verifierGraphqlDuTrain(code), 2)
})

test('#2437 garde AST refuse une mutation étrangère et un document dynamique', () => {
  const source = readFileSync(new URL('../guards/lib/fusionPr.mjs', import.meta.url), 'utf8')
  assert.equal(verifierGraphqlDuTrain(source), 2)
  assert.throws(() => verifierGraphqlDuTrain(source.replace('enqueuePullRequest(input: $input)', 'closePullRequest(input: $input)')), /document GraphQL interdit/)
  assert.throws(() => verifierGraphqlDuTrain("appel(['api', 'graphql', '--input', '-'], { input: JSON.stringify({ query: libre, variables: {} }) })"), /document GraphQL interdit/)
})

test('#2437 garde AST détecte les routes template et parenthésées et refuse les queries non canoniques', () => {
  const source = readFileSync(new URL('../guards/lib/fusionPr.mjs', import.meta.url), 'utf8')
  const etranger = "{ input: JSON.stringify({ query: 'mutation Foreign { closePullRequest(input: $input) { clientMutationId } }', variables: {} }) }"
  for (const route of ['`graphql`', "('graphql')", '((`graphql`))'])
    assert.throws(() => verifierGraphqlDuTrain(source + `\nappel(['api', ${route}, '--input', '-'], ${etranger})`), /argv GraphQL canonique/)
  for (const appel of ["(appel)(['api', 'graphql', '--input', '-']", "appel((['api', 'graphql', '--input', '-'])"])
    assert.throws(() => verifierGraphqlDuTrain(source + `\n${appel}, ${etranger})`), /document GraphQL interdit/)
  const query = [...DOCUMENTS_GRAPHQL_DU_TRAIN][0]
  for (const document of ['`' + query + '`', '(' + JSON.stringify(query) + ')', '`query ${libre}`'])
    assert.throws(() => verifierGraphqlDuTrain(source + `\nappel(['api', 'graphql', '--input', '-'], { input: JSON.stringify({ query: ${document}, variables: {} }) })`), /document GraphQL interdit/)
})

for (const suivi of [false, true]) test(`#2437 contexte du train repli ${suivi ? 'failed GET' : 'refus PUT'} conserve la tête`, () => {
  const sha = 'a'.repeat(40)
  const uuid = '12345678-1234-1234-1234-123456789abc'
  const appels = []
  const entree = ENTREE_2495
  let enfilee = false
  const feinte = mock.method(childProcess, 'spawnSync', (executable, args, options) => {
    assert.equal(executable, 'gh')
    appels.push({ args, options })
    if (args.includes('graphql')) {
      const payload = JSON.parse(options.input)
      let data
      if (payload.query.startsWith('mutation')) {
        enfilee = true
        data = { enqueuePullRequest: { mergeQueueEntry: { id: entree.id, headCommit: entree.headCommit } } }
      } else data = { repository: { pullRequest: { id: 'PR7', headRefOid: sha, state: 'OPEN', merged: false,
        isInMergeQueue: enfilee, mergeQueueEntry: enfilee ? entree : null } }, viewer: { login: 'cgauche' } }
      return { status: 0, stdout: JSON.stringify({ data }), stderr: '' }
    }
    return { status: 1, stdout: `HTTP/2.0 400\r\n\r\n${JSON.stringify({ status: 'failed', details: { message: REFUS_DE_FILE.prefixe } })}`, stderr: 'refus Enqueuer' }
  })
  syncBuiltinESMExports()
  try {
    const ctx = contexteDe({ racine: RACINE, branche: 'chantier/2437', options: {}, journaliser: () => {}, fdLog: 'ignore', maintenant: () => JEUNE_2495 })
    const vu = suivi ? ctx.lireFusion({ numero: 7, sha, uuid }) : ctx.demanderFusion({ numero: 7, sha })
    assert.deepEqual(vu, { ok: true, statut: 'enqueued', deja: true, compte: 'cgauche', entree })
    const mutation = appels.find((a) => a.args.includes('graphql') && JSON.parse(a.options.input).query.startsWith('mutation'))
    assert.deepEqual(JSON.parse(mutation.options.input).variables, { input: { pullRequestId: 'PR7', expectedHeadOid: sha } })
    assert.equal(appels.filter((a) => a.args.includes('PUT')).length, suivi ? 0 : 1)
    if (suivi) assert.ok(appels.some((a) => a.args.some((arg) => arg.endsWith(uuid))))
  } finally { feinte.mock.restore(); syncBuiltinESMExports() }
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

test('la table des ÉTAPES nomme les sept étapes, dans l’ordre du régime — ni rebase, ni attente de CI, ni fast-forward', () => {
  // `push-branche` → `pr` → `file` : le push de la branche DÉCLENCHE la CI de la tête, la PR armée
  // entre dans la file, et le SERVEUR sérialise et fusionne (#2178).
  assert.deepEqual(NOMS, ['preflight', 'docs', 'push-branche', 'pr', 'file', 'pilotage', 'fin'])
})

test('#2187 #2493 `fin` : le principal synchronisé sur la FUSION, sa ligne au `dit` ; sans état, la cause et la re-mesure ; jamais un train rouge', () => {
  const fin = ETAPES.find((e) => e.nom === 'fin')
  const journal = { tete: 'a'.repeat(40), etapes: { file: { detail: { fusion: 'b'.repeat(40) } } } }
  const visees = []
  const jouer = (rendu) => fin.jouer({ synchroniserPrincipal: ({ visee }) => { visees.push(visee); return rendu } }, journal)
  const avance = { ok: true, vu: { etat: 'avance' }, ligne: 'avancé de ccccccccc à bbbbbbbbb ; post-merge ccccccccc..bbbbbbbbb en fond : PID 7 depuis d (1 s), issue : /l' }
  assert.deepEqual(jouer(avance), { ok: true, detail: { principal: avance }, dit: `publication complète de aaaaaaaaa en bbbbbbbbb ; principal ${avance.ligne}` })
  const illisible = { ok: false, raison: 'spawnSync node ETIMEDOUT', ligne: 'synchroniseur sorti sans état (spawnSync node ETIMEDOUT) ; re-mesure : interrompu : …' }
  assert.equal(jouer(illisible).ok, true)
  assert.equal(jouer(illisible).dit, `publication complète de aaaaaaaaa en bbbbbbbbb ; principal ${illisible.ligne}`)
  assert.deepEqual(visees, ['b'.repeat(40), 'b'.repeat(40), 'b'.repeat(40)])
  const ctx = contexteDe({ racine: mkdtempSync(join(tmpdir(), 'sans-synchro-')), branche: 'chantier/x', options: {}, journaliser: () => {}, fdLog: 'ignore' })
  assert.throws(() => ctx.synchroniserPrincipal({ visee: 'court' }), /ctx\.synchroniserPrincipal : un sha COMPLET/)
  const vu = ctx.synchroniserPrincipal()
  assert.equal(vu.ok, false, 'aucun synchroniseur sous cette racine : aucun état, et aucune exception')
  assert.equal(vu.raison, 'code 1')
  assert.equal(vu.mesure.etat, 'git-indisponible')
  assert.match(vu.ligne, /^synchroniseur sorti sans état \(code 1\) ; re-mesure : refusé \(git-indisponible\) : /)
})

// ── messageDuTrain / PLAGE_DE_CITATIONS ──────────────────────────────────────────

test('messageDuTrain : un SUJET que la règle du dépôt accepte, le motif au CORPS, pour les deux commits du train', () => {
  const douze = Array.from({ length: 12 }, (_, i) => String(1700 + i))
  const formes = [
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
  const lu = { branche: 'c', base: 'b', tete: 't', ejections: 1, etapes: { preflight: { etat: 'vert' }, docs: { etat: 'vert' }, file: { etat: 'rouge' } } }
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
  const ctx = { tete: 'a'.repeat(40), generators: GENERATORS, questions: { cheminsSales: () => [] } }
  assert.equal(docs.dejaFaite(ctx, { tete: ctx.tete, etapes: { docs: { etat: 'vert', tete: ctx.tete } } }), true)
  // `journal.tete` avance à la fusion d'une reprise : un `docs` vert d'AVANT ne doit pas passer pour
  // fait sur la tête courante.
  assert.equal(docs.dejaFaite(ctx, { tete: ctx.tete, etapes: { docs: { etat: 'vert', tete: 'b'.repeat(40) } } }), false)
  assert.equal(docs.dejaFaite(ctx, { tete: ctx.tete, etapes: { docs: { etat: 'rouge', tete: ctx.tete } } }), false)
  assert.equal(docs.dejaFaite(ctx, journalVide('c')), false)
})

test('étape `docs` : un dérivé MIXTE sali depuis la rejoue, même verte sur la tête', () => {
  const docs = ETAPES.find((e) => e.nom === 'docs')
  const vert = (sales) => docs.dejaFaite(
    { tete: 'a'.repeat(40), generators: GENERATORS, questions: { cheminsSales: () => sales } },
    { tete: 'a'.repeat(40), etapes: { docs: { etat: 'vert', tete: 'a'.repeat(40) } } },
  )
  assert.equal(vert(['docs/raw/00-index.md']), false)
  assert.equal(vert(['src/state/cascade.ts']), true, 'un manuscrit sale n’est pas l’affaire de l’étape')
})

test('étape `docs` : `build-all --mixtes` ROUGE est un refus nommé par la fin de sa sortie — rien de commité', () => {
  const docs = ETAPES.find((e) => e.nom === 'docs')
  const gestes = []
  const racine = mkdtempSync(join(tmpdir(), 'etape-docs-'))
  try {
    const ctx = {
      racine,
      generators: GENERATORS,
      journaliser: () => {},
      docs: (mode) => { gestes.push(['docs', mode]); return { status: 1, stderr: 'docs:mixtes — ARRÊT sur g/a.mjs (sortie 1)' } },
      npm: (script) => { gestes.push(['npm', script]); return { status: 0 } },
      commit: () => assert.fail('aucun commit sur un `--mixtes` rouge'),
      questions: {
        ceQuiChange: () => ({ chemins: () => ['src/data/careers.json'] }),
        cheminsSales: () => [],
        baseAuTronc: () => 'b'.repeat(40),
      },
    }
    const vu = docs.jouer(ctx, { base: 'b'.repeat(40), tete: 'a'.repeat(40) })
    assert.equal(vu.ok, false)
    assert.equal(vu.raison, "`build-all --mixtes` a rendu 1 : dérivés possiblement incohérents (rien n'a été staged ni commité)\ndocs:mixtes — ARRÊT sur g/a.mjs (sortie 1)")
    assert.deepEqual(gestes, [['docs', '--mixtes']])
  } finally {
    rmSync(racine, { recursive: true, force: true })
  }
})

test('étape `docs` : la sélection se restreint à `perimetreDesMixtes` — la source d’un AUTRE générateur ne régénère rien', () => {
  const docs = ETAPES.find((e) => e.nom === 'docs')
  const membres = perimetreDesMixtes(GENERATORS)
  const autre = GENERATORS.find((g) => !membres.includes(g))
  const entree = (fichiers) => ({ cibles: [], fichiers, dossiers: [] })
  const mesure = {
    ...Object.fromEntries(membres.map((g) => [g.script, entree(['src/mixte.ts', g.script])])),
    [autre.script]: entree(['notes/autre.md', autre.script]),
  }
  const racine = mkdtempSync(join(tmpdir(), 'etape-docs-'))
  try {
    mkdirSync(join(racine, 'docs'))
    writeFileSync(join(racine, 'docs', '.sources-lues.json'), JSON.stringify(mesure))
    const jouer = (chemins) => {
      const gestes = []
      const vu = docs.jouer({
        racine,
        generators: GENERATORS,
        journaliser: () => {},
        docs: (mode) => { gestes.push(['docs', mode]); return { status: 1, stderr: '' } },
        npm: (script) => { gestes.push(['npm', script]); return { status: 0 } },
        commit: () => assert.fail('aucun commit'),
        questions: { ceQuiChange: () => ({ chemins: () => chemins }), cheminsSales: () => [], baseAuTronc: () => 'b'.repeat(40) },
      }, { base: 'b'.repeat(40), tete: 'a'.repeat(40) })
      return { vu, gestes }
    }
    const horsPerimetre = jouer(['notes/autre.md'])
    assert.deepEqual([horsPerimetre.vu.ok, horsPerimetre.vu.dit, horsPerimetre.gestes], [true, 'aucune source de mixte dans la plage, arbre propre : docs inchangés', []])
    assert.deepEqual(jouer(['src/mixte.ts']).gestes, [['docs', '--mixtes']])
  } finally {
    rmSync(racine, { recursive: true, force: true })
  }
})

// #2525
describe('étape `docs` : stocks de sites régénérés après une fusion du tronc', () => {
  const docs = ETAPES.find((e) => e.nom === 'docs')
  const STOCK = 'scripts/guards/balayages-non-resolus-stock.json'
  const VERT = { disponible: true, valeur: { status: 0, stdout: '', stderr: '' } }
  const racine = mkdtempSync(join(tmpdir(), 'etape-docs-stocks-'))
  after(() => rmSync(racine, { recursive: true, force: true }))
  mkdirSync(join(racine, 'docs'))
  writeFileSync(join(racine, 'docs', '.sources-lues.json'), JSON.stringify(Object.fromEntries(perimetreDesMixtes(GENERATORS).map((g) => [g.script, { cibles: [], fichiers: [], dossiers: [] }]))))
  const journal = () => ({ base: 'b'.repeat(40), tete: 'a'.repeat(40) })

  /** `stocks:regen` salit `ecrits` ; `commit` retire ses chemins de la saleté et avance la tête. */
  const ctxStocks = ({ base = 'm'.repeat(40), codes = {}, ecrits = [STOCK], commit = VERT } = {}) => {
    const gestes = []
    const lignes = []
    let sales = []
    let tete = 'a'.repeat(40)
    const ctx = {
      racine,
      generators: GENERATORS,
      get tete() { return tete },
      journaliser: (l) => { lignes.push(l) },
      docs: () => assert.fail('aucune source de mixte dans la plage'),
      npm: (script) => {
        gestes.push(['npm', script])
        if (script === 'stocks:regen') sales = [...ecrits]
        return { status: codes[script] ?? 0 }
      },
      commit: (p) => {
        gestes.push(['commit', p])
        if (reussi(commit)) { sales = sales.filter((c) => !p.chemins.includes(c)); tete = 'c'.repeat(40) }
        return commit
      },
      questions: {
        ceQuiChange: () => ({ chemins: () => [] }),
        cheminsSales: () => sales,
        baseAuTronc: () => base,
        attributsDeFusion: (chemins) => new Map(chemins.map((c) => [c, c === STOCK ? 'stocks' : 'unspecified'])),
        commitsDeLaPlage: () => [{ sha: 'd'.repeat(40), message: 'feat(ops): refs #2525 — x' }],
      },
    }
    return { ctx, gestes, lignes }
  }

  test('base AU TRONC changée pendant le lot : `stocks:regen` après `agents:check`, puis commit `chore(stocks)` des seuls stocks écrits', () => {
    const { ctx, gestes, lignes } = ctxStocks()
    const j = journal()
    const vu = docs.jouer(ctx, j)
    assert.equal(vu.ok, true, vu.raison)
    assert.deepEqual(gestes.map((g) => g[0] === 'npm' ? g[1] : g[0]), ['agents:check', 'stocks:regen', 'commit'])
    const { message, chemins } = gestes[2][1]
    assert.deepEqual(chemins, [STOCK])
    assert.ok(message.startsWith('chore(stocks): refs #2525 — stocks de sites\n'), message)
    assert.ok(message.includes(MOTIF_STOCKS))
    assert.ok(!message.includes('CLIQUET:'), 'le train n’écrit jamais de motif de cliquet')
    assert.equal(j.tete, 'c'.repeat(40))
    assert.ok(lignes.includes('[publier] docs — 1 stock(s) de sites régénéré(s) commis — tête ccccccccc\n'), lignes.join(''))
  })

  test('base au tronc INCHANGÉE : aucune régénération de stocks', () => {
    const { ctx, gestes } = ctxStocks({ base: 'b'.repeat(40) })
    const vu = docs.jouer(ctx, journal())
    assert.deepEqual([vu.ok, vu.dit], [true, 'aucune source de mixte dans la plage, arbre propre : docs inchangés'])
    assert.deepEqual(gestes, [])
  })

  test('`stocks:regen` ROUGE : refus nommé, rien de commis', () => {
    const { ctx, gestes } = ctxStocks({ codes: { 'stocks:regen': 1 } })
    const vu = docs.jouer(ctx, journal())
    assert.equal(vu.ok, false)
    assert.equal(vu.raison, '`npm run stocks:regen` a rendu 1 après la fusion du tronc : stocks de sites non régénérés (sortie au journal du train)')
    assert.ok(!gestes.some((g) => g[0] === 'commit'))
  })

  test('une CROISSANCE refusée par la porte du commit reste ROUGE et nommée : le `CLIQUET:` s’écrit à la main', () => {
    const refus = classer({ status: 1, stdout: '', stderr: '⛔ croissance du stock balayages-non-resolus : CLIQUET: exigé\n' })
    const { ctx } = ctxStocks({ commit: refus })
    const vu = docs.jouer(ctx, journal())
    assert.equal(vu.ok, false)
    assert.ok(vu.raison.startsWith(`commit des stocks de sites régénérés REFUSÉ par la porte du commit (une croissance née de la fusion du tronc : \`CLIQUET:\` à écrire à la main) :\n    ${STOCK}\n`), vu.raison)
    assert.ok(vu.raison.includes('⛔ croissance du stock balayages-non-resolus'))
  })

  test('un MANUSCRIT hors stock sali par la régénération : rien n’est commis, le contrôle des manuscrits les nomme tous', () => {
    const { ctx, gestes } = ctxStocks({ ecrits: [STOCK, 'src/a.ts'] })
    const vu = docs.jouer(ctx, journal())
    assert.equal(vu.ok, false)
    assert.equal(vu.raison, `fichier MANUSCRIT sale après la régénération :\n    ${STOCK}\n    src/a.ts`)
    assert.ok(!gestes.some((g) => g[0] === 'commit'))
  })
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

  test('`agents:sync` ROUGE : refus qui NOMME le script, son code et ce que la CI ferait', () => {
    const ctx = ctxFactice({ 'agents:check': 1, 'agents:sync': 7 })
    const vu = synchroniserAgents(ctx)
    assert.equal(vu.ok, false)
    assert.equal(vu.raison, '`npm run agents:sync` a rendu 7 : la gate `agents:check` de la CI refuserait la plage')
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
    { message: '[détachement] /dep/scripts/ops/publier.mjs : détachement manqué, powershell a rendu «  » Start-Process : refus' },
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
  assert.deepEqual(processus.sorties, [CODE_ARRET_MOTEUR])
})

test('filetDuTrainEnfant : une promesse rompue tombe par le MÊME filet', () => {
  const processus = processusFactice()
  const ecrits = []
  filetDuTrainEnfant({ chemin: 'x.log', processus, ecrire: (chemin, texte) => ecrits.push({ chemin, texte }) })
  processus.branches.unhandledRejection('rupture nue')
  assert.equal(ecrits[0].chemin, 'x.log')
  assert.match(ecrits[0].texte, /ARRÊT INATTENDU hors train : rupture nue\nPUBLICATION: rouge moteur — rupture nue\n/)
  assert.deepEqual(processus.sorties, [CODE_ARRET_MOTEUR])
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

test('#2285 push-branche : écrivain injecté, diagnostic complet après classification', () => {
  const stderr = `${'note pré-push\n'.repeat(60)}cause concrète sans marque de verdict`
  const stdout = 'stdout distinct\nseconde note'
  const commandes = []
  const depot = depotDe(tmpdir(), { spawn: (_git, args) => {
    commandes.push(args)
    return { status: 17, stdout, stderr }
  } })
  const ctx = {
    racine: RACINE,
    branche: 'chantier/1776',
    tete: 'ttttttttt',
    journaliser: () => {},
    pousser: (geste) => pousser(depot, geste),
  }
  const vu = etapeBranche.jouer(ctx, journalPush())
  assert.equal(vu.ok, false)
  assert.match(vu.raison, /push de la branche REFUSÉ/)
  assert.ok(vu.raison.includes(stderr), vu.raison)
  assert.ok(vu.raison.includes(stdout), vu.raison)
  assert.match(vu.raison, /status 17/)
  assert.deepEqual(commandes, [['push', '--force-with-lease', 'origin', 'HEAD:refs/heads/chantier/1776']])
})

test('#2285 rendu : conserve toutes les notes, les deux flux et la distinction des échecs', () => {
  const stderr = `première note\n${'suite\n'.repeat(120)}cause finale`
  const stdout = 'notes stdout'
  const refus = classer({ status: 9, stdout, stderr })
  assert.equal(sortieDe(refus), `${stderr}\n${stdout}`)
  assert.match(refusDeGit(refus), /refus.*status 9/)
  assert.ok(refusDeGit(refus).includes(stderr))
  const tue = classer({ status: null, signal: 'SIGTERM', stdout: 'avant', stderr: '' })
  assert.match(refusDeGit(tue), /interruption.*SIGTERM/)
  const lancement = classer({ status: null, error: new Error('ENOENT'), stdout: '', stderr: '' })
  assert.match(refusDeGit(lancement), /lancement.*ENOENT/)
})

test('#2285 tronc : le fetch conserve le diagnostic classé sans lecture supplémentaire', () => {
  const stderr = `${'note fetch\n'.repeat(65)}cause distante`
  const stdout = 'sortie distante'
  const vu = sousGitFeint([{ si: ['fetch'], status: 23, stdout, stderr }], () => {
    const ctx = contexteDe({ racine: tmpdir(), branche: 'chantier/2285', options: {}, journaliser: () => {}, fdLog: 'ignore' })
    return ctx.tronc()
  })
  assert.equal(vu.disponible, false)
  assert.equal(vu.issue, 'refus')
  assert.equal(vu.raison, stderr)
  assert.deepEqual(vu.diagnostic, { status: 23, stdout, stderr })
})

test('#2285 tronc : fetch muet nonzero refuse avant le SHA, succès avec warning le lit', () => {
  const contexte = () => contexteDe({ racine: tmpdir(), branche: 'chantier/2285', options: {}, journaliser: () => {}, fdLog: 'ignore' })
  const refuse = sousGitFeint([
    { si: ['fetch'], status: 31, stdout: '', stderr: '' },
    { si: [], status: 128, stderr: 'lecture SHA interdite après fetch refusé' },
  ], () => contexte().tronc())
  assert.equal(refuse.disponible, false)
  assert.equal(refuse.issue, 'refus')
  assert.deepEqual(refuse.diagnostic, { status: 31, stdout: '', stderr: '' })
  assert.match(refuse.raison, /status 31/)
  const sha = 'a'.repeat(40)
  const accepte = sousGitFeint([
    { si: ['fetch'], status: 0, stdout: '', stderr: 'warning' },
    { si: ['rev-parse'], status: 0, stdout: `${sha}\n` },
  ], () => contexte().tronc())
  assert.deepEqual(accepte, { disponible: true, sha })
})

// ── PR : lecture REST réduite, choix de la PR, état ──────────────────────────────────────────

const REST = (plus = {}) => ({ number: 7, state: 'open', merged_at: null, merge_commit_sha: null, head: { sha: 'ttttttttt' }, mergeable_state: 'clean', ...plus })

test('prDeRest : ouverte, fusionnée (sha de fusion), fermée ; conflit à trois états par `mergeable_state`', () => {
  assert.deepEqual(prDeRest(REST()), { numero: 7, etat: 'ouverte', tete: 'ttttttttt', fusion: null, conflit: false })
  assert.deepEqual(prDeRest(REST({ state: 'closed', merged_at: 'x', merge_commit_sha: 'f'.repeat(40) })).etat, 'fusionnee')
  assert.equal(prDeRest(REST({ state: 'closed', merged_at: 'x', merge_commit_sha: 'f'.repeat(40) })).fusion, 'f'.repeat(40))
  assert.equal(prDeRest(REST({ state: 'closed' })).etat, 'fermee')
  assert.equal(prDeRest(REST({ mergeable_state: 'dirty' })).conflit, true)
  assert.equal(prDeRest(REST({ mergeable_state: 'unknown' })).conflit, null)
  assert.equal(prDeRest(REST({ mergeable_state: undefined })).conflit, null)
  for (const etat of ['clean', 'blocked', 'behind', 'unstable', 'has_hooks']) assert.equal(prDeRest(REST({ mergeable_state: etat })).conflit, false, etat)
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

/** Le contexte de l'étape `file` : la PR lue (`prs` : ses lectures successives), les courses de branche et de file, les jobs rouges, et
 *  les réponses de la demande de fusion (`demande` au PUT, `suivis` aux GET successifs). */
const ctxFile = ({ pr, prs = [pr], branche = [courseDeBrancheVerte], branches = [branche], file = [], fileAvant = [], files = [fileAvant, file], jobs = [], annules = [], motif = null, fusion = { disponible: true, valeur: { status: 0, stdout: '', stderr: '' } }, conflits = [], conclusion = { disponible: true, valeur: { status: 0, stdout: '', stderr: '' } }, demande = { ok: true, statut: 'enqueued' }, suivis = [], parents = ['m'.repeat(40), 'ttttttttt'], ancetres = [], fileTimeoutMin = 30 } = {}) => {
  const gestes = []
  const lignes = []
  let suivi = 0
  let lectureDeBranche = 0
  let lectureDeFile = 0
  let lectureDePr = 0
  const ctx = {
    racine: RACINE,
    branche: 'chantier/2178',
    options: { fileTimeoutMin },
    journaliser: (ligne) => { lignes.push(ligne) },
    tete: 'nnnnnnnnn',
    lirePr: () => {
      const lue = prs[Math.min(lectureDePr++, prs.length - 1)]
      return { ok: true, prs: lue ? [prDeRest(lue)] : [] }
    },
    coursesCi: () => ({ disponible: true, valeur: branches[Math.min(lectureDeBranche++, branches.length - 1)] }),
    coursesDeFile: () => ({ disponible: true, valeur: files[Math.min(lectureDeFile++, files.length - 1)] }),
    parentsDe: () => ({ ok: true, parents }),
    jobsEnEchec: (id) => { gestes.push(['jobs', id]); return { disponible: true, valeur: { rouges: jobs, annules, motif } } },
    demanderFusion: (p) => { gestes.push(['demander', p]); return demande },
    etatFileDePr: () => ({ ok: true, statut: 'enqueued' }),
    lireFusion: (p) => { gestes.push(['suivre', p]); return suivis[Math.min(suivi++, suivis.length - 1)] },
    tronc: () => { gestes.push(['tronc']); return { disponible: true, sha: 'm'.repeat(40) } },
    fusionner: ({ message }) => { gestes.push(['fusionner', message]); return fusion },
    abandonnerFusion: () => { gestes.push(['abandonner']); return fusion },
    conclureFusionSansCiblesPures: (p) => { gestes.push(['conclure', p]); return conclusion },
    docs: (mode) => { gestes.push(['docs', mode]); return { status: 0, stderr: '' } },
    generators: GENERATORS,
    questions: {
      commitsDeLaPlage: () => [{ sha: 'c'.repeat(40), message: 'feat(ops): refs #2178 — x' }],
      cheminsEnConflit: () => conflits,
      estAncetre: (a, d) => ({ disponible: true, valeur: a === d || ancetres.some(([x, y]) => x === a && y === d) }),
    },
  }
  return { ctx, gestes, lignes }
}
const courseDeFileRouge = { headBranch: 'gh-readonly-queue/main/pr-7-abc', headSha: 'g'.repeat(40), status: 'completed', conclusion: 'failure', databaseId: 99, workflowName: 'CI' }

for (const variante of ['redemande', 'plafond', 'courses illisibles']) test(`#2499 sortie de file sans course rouge : ${variante}`, () => {
  const { ctx, lignes } = ctxFile({ pr: REST(), fileTimeoutMin: 0.001 })
  let demandes = 0, tick = 0
  const montre = mock.method(Date, 'now', () => JEUNE_2495 + tick++)
  const sommeil = mock.method(Atomics, 'wait', () => 'timed-out')
  ctx.demanderFusion = () => (++demandes === 2 && variante === 'redemande')
    ? { ok: true, statut: 'merged', fusion: 'f'.repeat(40) }
    : { ok: true, statut: 'enqueued', compte: 'cgauche', entree: ENTREE_2495 }
  ctx.etatFileDePr = () => ({ ok: true, id: 'PR7', compte: 'cgauche' })
  if (variante === 'courses illisibles') ctx.coursesDeFile = () => ({ disponible: false, raison: 'HTTP 403' })
  try {
    const journal = journalPush()
    const vu = etapeFile.jouer(ctx, journal)
    if (variante === 'redemande') {
      assert.equal(vu.ok, true)
      assert.equal(vu.detail.fusion, 'f'.repeat(40))
      assert.equal(demandes, 2)
      assert.equal(journal.ejections, 1)
      assert.ok(lignes.some((l) => /PR #7 sortie de la file sans course en échec.*nouvelle demande/.test(l)))
    } else if (variante === 'plafond') {
      assert.equal(vu.ok, false)
      assert.match(vu.raison, /sortie de la file sans course en échec.*au-delà de la borne/)
      assert.equal(demandes, BORNE_EJECTIONS + 1)
    } else {
      assert.equal(vu.indetermine, true)
      assert.equal(demandes, 1)
      assert.ok(lignes.some((l) => l.includes('courses de file illisibles : HTTP 403')))
      assert.ok(lignes.includes('[publier] file — PR #7 : courses de file illisibles : HTTP 403\n'))
    }
  } finally { montre.mock.restore(); sommeil.mock.restore() }
})

test('#2499 train composé : entrée jeune puis absence de groupe nommée sans nouvelle demande', () => {
  const sha = PR_2495.headRefOid
  let horloge = JEUNE_2495, lectures = 0, demandes = 0
  const api = mock.method(childProcess, 'spawnSync', (executable, args, options) => {
    assert.equal(executable, 'gh')
    if (args.includes('graphql')) {
      const payload = JSON.parse(options.input)
      assert.ok(!payload.query.startsWith('mutation'))
      const data = { repository: { pullRequest: { ...PR_2495, id: 'PR7', merged: false,
        mergeCommit: null, mergeQueueEntry: ENTREE_2495 } }, viewer: { login: 'cgauche' } }
      if (lectures++ === 2) horloge += 10 * 60_000
      return { status: 0, stdout: JSON.stringify({ data }), stderr: '' }
    }
    assert.ok(!args.includes('PUT'))
    assert.ok(args.some((a) => a.includes(`head_sha=${ENTREE_2495.headCommit.oid}`)))
    return { status: 0, stdout: readFileSync(new URL('./fixtures/github-2495-absence.json', import.meta.url), 'utf8'), stderr: '' }
  })
  const sommeil = mock.method(Atomics, 'wait', () => 'timed-out')
  let tick = 0
  const montre = mock.method(Date, 'now', () => JEUNE_2495 + tick++)
  syncBuiltinESMExports()
  try {
    const reel = contexteDe({ racine: RACINE, branche: 'chantier/2499', options: {}, journaliser: () => {}, fdLog: 'ignore', maintenant: () => horloge })
    const { ctx } = ctxFile({ pr: REST({ head: { sha } }), branche: [{ ...courseDeBrancheVerte, headSha: sha }], fileTimeoutMin: 0.001 })
    ctx.demanderFusion = (p) => { demandes++; return reel.demanderFusion(p) }
    ctx.etatFileDePr = reel.etatFileDePr
    const vu = etapeFile.jouer(ctx, { ...journalPush(), tete: sha })
    assert.equal(vu.ok, false)
    assert.match(vu.raison, /PR #7.*REFUSÉE.*cgauche.*aucun run CI merge_group/)
    assert.match(vu.raison, /retirer cette entrée/)
    assert.equal(vu.detail.compte, 'cgauche')
    assert.equal(demandes, 1)
    assert.ok(lectures >= 4)
  } finally { api.mock.restore(); sommeil.mock.restore(); montre.mock.restore(); syncBuiltinESMExports() }
})

test('file : une PR FUSIONNÉE rend vert, avec le commit de fusion et le temps d’ATTENTE', () => {
  const { ctx } = ctxFile({ pr: REST({ state: 'closed', merged_at: 'x', merge_commit_sha: 'f'.repeat(40) }) })
  const vu = etapeFile.jouer(ctx, journalPush())
  assert.equal(vu.ok, true)
  assert.deepEqual([vu.detail.pr, vu.detail.fusion], [7, 'f'.repeat(40)])
  assert.equal(typeof vu.detail.attenteSecondes, 'number', 'le temps d’attente de GitHub se compte à part du temps machine locale')
})

test('file : une course de BRANCHE rouge — aucune demande de fusion, et le train la NOMME par ses jobs rouges', () => {
  const { ctx, gestes } = ctxFile({ pr: REST(), jobs: ['suite'], branche: [{ headSha: 'ttttttttt', status: 'completed', conclusion: 'failure', databaseId: 41, workflowName: 'CI' }] })
  const vu = etapeFile.jouer(ctx, journalPush())
  assert.equal(vu.ok, false)
  assert.ok(vu.raison.includes(`course CI rouge de la branche sur ttttttttt (jobs rouges : suite) — la PR #7 n’entre pas dans la file : https://github.com/${DEPOT}/actions/runs/41`), vu.raison)
  assert.deepEqual(gestes, [['jobs', 41]], 'aucune demande de fusion')
})

const courseDeBrancheAnnulee = (attempt) => ({ headSha: 'ttttttttt', status: 'completed', conclusion: 'failure', databaseId: 41, attempt, workflowName: 'CI' })
const MOTIF_RUNNER = 'The job was not acquired by Runner of type hosted even after multiple attempts'

test('#2392 file : une course de BRANCHE ANNULÉE (aucun job rouge) sous le plafond VEILLE, la dit, puis sa relance VERTE se demande', () => {
  const { ctx, gestes, lignes } = ctxFile({
    pr: REST(), annules: ['docs', 'suite 1/3'], motif: MOTIF_RUNNER,
    branches: [[courseDeBrancheAnnulee(1)], [{ ...courseDeBrancheVerte, databaseId: 41, attempt: 2 }]],
    demande: { ok: true, statut: 'merged', fusion: 'f'.repeat(40) },
  })
  const vu = etapeFile.jouer(ctx, journalPush())
  assert.deepEqual([vu.ok, vu.detail.fusion], [true, 'f'.repeat(40)])
  assert.ok(lignes.includes(`[publier] file — course CI annulee de la branche sur ttttttttt (jobs annulés : docs, suite 1/3 ; motif : ${MOTIF_RUNNER}), essai 1/${PLAFOND_RELANCES} : https://github.com/${DEPOT}/actions/runs/41\n`), lignes.join(''))
  assert.deepEqual(gestes.map((g) => g[0]), ['jobs', 'demander'])
})

test(`#2392 file : une course de BRANCHE ANNULÉE à son ${PLAFOND_RELANCES}ᵉ essai est ROUGE, avec le geste humain`, () => {
  const { ctx, gestes } = ctxFile({ pr: REST(), annules: ['docs'], branche: [courseDeBrancheAnnulee(PLAFOND_RELANCES)] })
  const vu = etapeFile.jouer(ctx, journalPush())
  assert.equal(vu.ok, false)
  assert.equal(vu.raison, `course CI annulee de la branche sur ttttttttt (jobs annulés : docs), essai ${PLAFOND_RELANCES}/${PLAFOND_RELANCES} — \`gh run rerun 41 --failed\` puis \`npm run ops:publier -- --reprendre\` — la PR #7 n’entre pas dans la file : https://github.com/${DEPOT}/actions/runs/41`)
  assert.deepEqual(gestes.map((g) => g[0]), ['jobs'], 'aucune demande de fusion')
})

test('#2392 file : la demande journalise le COMPTE qui la porte, une fois ; une PR déjà en file le dit « constaté »', () => {
  for (const [demande, ligne] of [
    [{ ok: true, statut: 'merged', fusion: 'f'.repeat(40), compte: 'cgauche' }, '[publier] file — demande de fusion sous le compte « cgauche »\n'],
    [{ ok: true, statut: 'enqueued', deja: true, compte: 'cgauche' }, '[publier] file — déjà en file, constaté sous le compte « cgauche »\n'],
  ]) {
    const { ctx, lignes } = ctxFile({ pr: REST(), demande })
    ctx.etatFileDePr = () => ({ ok: true, statut: 'merged', fusion: 'f'.repeat(40) })
    const vu = etapeFile.jouer(ctx, journalPush())
    assert.deepEqual(lignes.filter((l) => l.includes('compte')), [ligne])
    assert.equal(vu.detail.compte, 'cgauche', 'l’issue de l’étape porte le compte')
  }
})

test('#2392 file : un refus d’enfileur nomme le COMPTE et le geste humain sur sa PREMIÈRE ligne', () => {
  const raison = `${refusDEnfileur({ depot: DEPOT, numero: 7, compte: 'gaucheclement', message: REFUS_DE_FILE.concatene })} (repli GraphQL : HTTP 403)`
  const { ctx } = ctxFile({ pr: REST(), demande: { ok: false, raison, compte: 'gaucheclement' } })
  const vu = etapeFile.jouer(ctx, journalPush())
  assert.equal(vu.raison, `demande de fusion de la PR #7 REFUSÉE sous le compte « gaucheclement » : ${raison}`)
  assert.deepEqual(vu.detail.pr, 7)
  assert.equal(vu.detail.compte, 'gaucheclement')
  assert.equal(ligneDePublication({ etat: 'rouge', etape: 'file', raison: vu.raison }, 't'), `PUBLICATION: rouge file — ${vu.raison}`)
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
    assert.deepEqual(gestes[1][1], { numero: 7, sha: 'ttttttttt', uuid: 'u-1' })
  }
})

test('file : une demande en ÉCHEC (`failed`, 400) ou REFUSÉE, sur une PR relue SANS conflit, est ROUGE et nommée, sans nouvelle demande', () => {
  const echec = ctxFile({ pr: REST(), demande: { ok: true, statut: 'failed', message: 'Pull request is closed.' } })
  assert.equal(etapeFile.jouer(echec.ctx, journalPush()).raison, 'demande de fusion de la PR #7 en ÉCHEC : Pull request is closed.')
  assert.deepEqual(echec.gestes.map((g) => g[0]), ['demander'])
  const refus = ctxFile({ pr: REST(), demande: { ok: false, raison: 'HTTP 403 : Resource not accessible' } })
  assert.equal(etapeFile.jouer(refus.ctx, journalPush()).raison, 'demande de fusion de la PR #7 REFUSÉE : HTTP 403 : Resource not accessible')
  assert.deepEqual(refus.gestes.map((g) => g[0]), ['demander'])
})

// #2525
const REFUS_POUR_CONFLIT = { ok: false, raison: REFUS_DE_FILE.concatene }
const ECHEC_POUR_CONFLIT = { ok: true, statut: 'failed', message: 'Pull request has merge conflicts' }

test('file #2525 : une demande REFUSÉE ou en ÉCHEC, sur une PR relue en CONFLIT, se REPREND : fusion d’origin/main, relance, aucune nouvelle demande', () => {
  for (const demande of [REFUS_POUR_CONFLIT, ECHEC_POUR_CONFLIT]) {
    const { ctx, gestes } = ctxFile({ prs: [REST(), REST({ mergeable_state: 'dirty' })], demande })
    const journal = journalPush()
    const vu = etapeFile.jouer(ctx, journal)
    assert.deepEqual([vu.ok, vu.relancer], [true, ['docs', 'push-branche', 'pr', 'file']], vu.raison)
    assert.deepEqual(gestes.map((g) => g[0]), ['demander', 'tronc', 'fusionner'])
    assert.match(vu.dit, /^PR #7 en CONFLIT avec la base — origin\/main fusionné/)
    assert.equal(journal.ejections, 1)
  }
})

test('file #2525 : après un refus, une PR dont le conflit n’est pas jugé (`unknown`) s’ATTEND, puis son verdict tranche', () => {
  const sommeil = mock.method(Atomics, 'wait', () => 'timed-out')
  try {
    const inconnue = REST({ mergeable_state: 'unknown' })
    const reprise = ctxFile({ prs: [REST(), inconnue, inconnue, REST({ mergeable_state: 'dirty' })], demande: REFUS_POUR_CONFLIT })
    const vu = etapeFile.jouer(reprise.ctx, journalPush())
    assert.deepEqual([vu.ok, vu.relancer], [true, ['docs', 'push-branche', 'pr', 'file']], vu.raison)
    assert.deepEqual(reprise.gestes.map((g) => g[0]), ['demander', 'tronc', 'fusionner'])
    assert.equal(reprise.lignes.filter((l) => l.includes('demande refusée, conflit avec la base pas encore jugé')).length, 2)
    const propre = ctxFile({ prs: [REST(), inconnue, REST()], demande: REFUS_POUR_CONFLIT })
    assert.equal(etapeFile.jouer(propre.ctx, journalPush()).raison, `demande de fusion de la PR #7 REFUSÉE : ${REFUS_DE_FILE.concatene}`)
    assert.deepEqual(propre.gestes.map((g) => g[0]), ['demander'])
    const borne = ctxFile({ prs: [REST(), inconnue], demande: REFUS_POUR_CONFLIT, fileTimeoutMin: 0.002 })
    const fin = etapeFile.jouer(borne.ctx, journalPush())
    assert.deepEqual([fin.ok, fin.raison], [false, `demande de fusion de la PR #7 REFUSÉE : ${REFUS_DE_FILE.concatene}`])
    assert.deepEqual(borne.gestes.map((g) => g[0]), ['demander'], 'jamais de nouvelle demande tant que le refus est posé')
  } finally { sommeil.mock.restore() }
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

test('file #2525 : une course de file rouge dont G^1 est ANCÊTRE d’origin/main est attribuée à la PR et se REPREND, quels que soient ses jobs', () => {
  for (const jobs of [['suite'], ['docs']]) {
    const { ctx, gestes } = ctxFile({ pr: REST(), file: [courseDeFileRouge], jobs, parents: ['p'.repeat(40), 'ttttttttt'], ancetres: [['p'.repeat(40), 'm'.repeat(40)]] })
    const vu = etapeFile.jouer(ctx, journalPush())
    assert.deepEqual([vu.ok, vu.relancer], [true, ['docs', 'push-branche', 'pr', 'file']], `jobs=${jobs}`)
    assert.ok(vu.dit.startsWith(`PR #7 éjectée par la course https://github.com/${DEPOT}/actions/runs/99 — jobs rouges : ${jobs[0]} — origin/main fusionné`), vu.dit)
    assert.deepEqual(gestes.map((g) => g[0]), ['demander', 'tronc', 'jobs', 'tronc', 'fusionner'])
  }
})

test('file : une course de file rouge attribuée dont les jobs sont ILLISIBLES est un rouge NOMMÉ, sans fusion', () => {
  const { ctx, gestes } = ctxFile({ pr: REST(), file: [courseDeFileRouge], parents: ['p'.repeat(40), 'ttttttttt'], ancetres: [['p'.repeat(40), 'm'.repeat(40)]] })
  ctx.jobsEnEchec = (id) => { gestes.push(['jobs', id]); return { disponible: false, raison: 'HTTP 502' } }
  const vu = etapeFile.jouer(ctx, journalPush())
  assert.equal(vu.ok, false)
  assert.equal(vu.raison, `PR #7 éjectée par la course https://github.com/${DEPOT}/actions/runs/99 ; jobs illisibles : HTTP 502`)
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


test('preflight #2285 fc1 : fetch refusé conserve le diagnostic et interdit le verdict', () => {
  const preflight = ETAPES.find((e) => e.nom === 'preflight')
  const stderr = `${'note fetch\n'.repeat(50)}fatal: cause tardive fetch\n`
  const stdout = 'stdout fetch distinct\n'
  const vuFetch = classer({ status: 128, stdout, stderr })
  const ctx = {
    branche: 'chantier/x',
    filtresDePush: ['chantier/**'],
    generators: GENERATORS,
    tronc: () => vuFetch,
    questions: {
      rebaseEntame: () => null,
      brancheDe: () => 'chantier/x',
      cheminsSales: () => [],
      origineDe: () => `https://github.com/${DEPOT}.git`,
      verdictDesFusions: () => assert.fail('aucun verdict après fetch refusé'),
      combienDe: () => assert.fail('aucune lecture après fetch refusé'),
    },
  }
  assert.deepEqual(preflight.jouer(ctx, journalVide('chantier/x')), {
    ok: false,
    raison: `origin non consultable : refus (status 128) — ${stderr}\n${stdout}`,
  })
})

test('preflight #2285 fc1 : fetch et verdict verts poursuivent les lectures', () => {
  const preflight = ETAPES.find((e) => e.nom === 'preflight')
  const appels = []
  const base = 'b'.repeat(40)
  const ctx = {
    racine: RACINE,
    branche: 'chantier/x',
    tete: 'a'.repeat(40),
    filtresDePush: ['chantier/**'],
    generators: GENERATORS,
    tronc: () => { appels.push('fetch'); return { disponible: true } },
    questions: {
      rebaseEntame: () => null,
      brancheDe: () => 'chantier/x',
      cheminsSales: () => [],
      origineDe: () => `https://github.com/${DEPOT}.git`,
      verdictDesFusions: () => { appels.push('verdict'); return { ok: true } },
      combienDe: () => { appels.push('combien'); return 1 },
      baseAuTronc: () => { appels.push('base'); return base },
    },
  }
  const journal = journalVide('chantier/x')
  const vu = preflight.jouer(ctx, journal)
  assert.equal(vu.ok, true)
  assert.deepEqual(vu.detail, { derivesSales: [], base })
  assert.equal(journal.base, base)
  assert.equal(journal.tete, ctx.tete)
  assert.deepEqual(appels, ['fetch', 'verdict', 'combien', 'base'])
})

test('preflight : une fusion dont la résolution n’est pas JUGÉE est ROUGE, avec le refus de la porte de publication (#2328)', () => {
  const preflight = ETAPES.find((e) => e.nom === 'preflight')
  const ctx = {
    branche: 'chantier/x',
    filtresDePush: ['chantier/**'],
    generators: GENERATORS,
    tronc: () => ({ disponible: true }),
    questions: {
      rebaseEntame: () => null,
      brancheDe: () => 'chantier/x',
      cheminsSales: () => [],
      origineDe: () => `https://github.com/${DEPOT}.git`,
      verdictDesFusions: () => ({ ok: false, texte: '⛔ origin/main (base 0123456789 du 2026-10-05T10:00:00+02:00)..HEAD : 1 fusion(s) dont la RÉSOLUTION porte ≥10 lignes changées sous src/ sans juge qui la nomme' }),
      combienDe: () => assert.fail('aucune lecture après le refus'),
    },
  }
  const vu = preflight.jouer(ctx, journalVide('chantier/x'))
  assert.equal(vu.ok, false)
  assert.match(vu.raison, /^⛔ origin\/main \(base 0123456789 du .+\)\.\.HEAD : 1 fusion\(s\) dont la RÉSOLUTION/)
})

test('#2392 file : une course de file ANNULÉE se REDEMANDE sur la même tête, sans fusion d’origin/main ; la vieille course, écartée, n’éjecte plus', () => {
  const { ctx, gestes, lignes } = ctxFile({ pr: REST(), files: [[], [courseDeFileRouge]], annules: ['docs', 'suite 1/3'], parents: ['p'.repeat(40), 'ttttttttt'], ancetres: [['p'.repeat(40), 'm'.repeat(40)]], fileTimeoutMin: 0.002 })
  const journal = journalPush()
  const vu = etapeFile.jouer(ctx, journal)
  assert.equal(vu.indetermine, true, 'la nouvelle demande attend sa course dans la borne')
  assert.deepEqual(gestes.map((g) => g[0]), ['demander', 'tronc', 'jobs', 'demander'])
  assert.equal(journal.ejections, 1)
  assert.ok(lignes.includes(`[publier] file — PR #7 éjectée par la course https://github.com/${DEPOT}/actions/runs/99 ANNULÉE — jobs annulés : docs, suite 1/3 : nouvelle demande de fusion sur ttttttttt\n`), lignes.join(''))
  assert.ok(lignes.includes('[publier] file — PR #7 : course de file absente\n'), 'la course 99, terminée avant la 2ᵉ demande, ne la juge pas')
})

test(`#2392 file : une course de file ANNULÉE au-delà de la borne (${BORNE_EJECTIONS}) est ROUGE et nommée`, () => {
  const neuve = { ...courseDeFileRouge, databaseId: 100 }
  const { ctx, gestes } = ctxFile({ pr: REST(), files: [[], [courseDeFileRouge], [courseDeFileRouge], [neuve, courseDeFileRouge]], annules: ['docs'], parents: ['p'.repeat(40), 'ttttttttt'], ancetres: [['p'.repeat(40), 'm'.repeat(40)]] })
  const vu = etapeFile.jouer(ctx, journalPush())
  assert.equal(vu.ok, false)
  assert.equal(vu.raison, `PR #7 éjectée par la course https://github.com/${DEPOT}/actions/runs/100 ANNULÉE — jobs annulés : docs — reprise une 2ᵉ fois, au-delà de la borne (${BORNE_EJECTIONS})`)
  assert.deepEqual(gestes.map((g) => g[0]), ['demander', 'tronc', 'jobs', 'demander', 'tronc', 'jobs'], 'aucune fusion')
})

test('file #2525 : une PR en CONFLIT avant la demande — reprise BORNÉE sans demande, même course de branche en vol : FUSION d’origin/main (jamais rebase), relance docs → push → pr → file', () => {
  const enVol = { headSha: 'ttttttttt', status: 'in_progress', conclusion: null, databaseId: 40, workflowName: 'CI' }
  for (const branche of [[courseDeBrancheVerte], [enVol]]) {
    const { ctx, gestes } = ctxFile({ pr: REST({ mergeable_state: 'dirty' }), branche, fileTimeoutMin: 0.002 })
    const journal = journalPush()
    const vu = etapeFile.jouer(ctx, journal)
    assert.equal(vu.ok, true, vu.raison)
    assert.deepEqual(vu.relancer, ['docs', 'push-branche', 'pr', 'file'])
    assert.deepEqual(gestes.map((g) => g[0]), ['tronc', 'fusionner'], 'aucune demande de fusion')
    assert.match(gestes[1][1], /^chore\(merge\): refs #2178 — fusion de origin\/main dans chantier\/2178\n/)
    assert.ok(gestes[1][1].includes(MOTIF_EJECTION))
    assert.deepEqual([journal.ejections, journal.tete], [1, 'nnnnnnnnn'])
  }
})

test(`file : une reprise au-delà de la borne (${BORNE_EJECTIONS}) est rouge, sans fusion ni demande`, () => {
  const { ctx, gestes } = ctxFile({ pr: REST({ mergeable_state: 'dirty' }), fileTimeoutMin: 0.002 })
  const vu = etapeFile.jouer(ctx, { ...journalPush(), ejections: BORNE_EJECTIONS })
  assert.equal(vu.ok, false)
  assert.equal(vu.raison, 'PR #7 en CONFLIT avec la base — reprise une 2ᵉ fois, au-delà de la borne (1) : la cause n’est pas le tronc')
  assert.deepEqual(gestes, [])
})

test('file : une fusion en CONFLIT résiduel, un STOCK sous pilote compris, est ABANDONNÉE et nomme ses fichiers — la main à l’humain, puis `--reprendre`', () => {
  const stdout = `${'note stdout\n'.repeat(50)}cause stdout tardive\n`
  const stderr = `${'note stderr\n'.repeat(50)}cause stderr tardive\n`
  const refus = classer({ status: 17, stdout, stderr })
  const stock = 'scripts/guards/balayages-non-resolus-stock.json'
  const { ctx, gestes } = ctxFile({ pr: REST({ mergeable_state: 'dirty' }), fusion: refus, conflits: [stock] })
  const journal = journalPush()
  const vu = etapeFile.jouer(ctx, journal)
  assert.equal(vu.ok, false)
  assert.ok(vu.raison.includes(`fusion de origin/main REFUSÉE (CONFLIT, abandonnée) — fichiers :\n    ${stock}\n`), vu.raison)
  assert.ok(vu.raison.includes(stdout))
  assert.ok(vu.raison.includes(stderr))
  assert.match(vu.raison, /refus \(status 17\)/)
  assert.deepEqual(gestes.map((g) => g[0]), ['tronc', 'fusionner', 'abandonner'])
  assert.equal(journal.ejections, 0)
})

// #2203
test('file : une fusion dont TOUS les conflits sont des cibles PURES se CONCLUT en les retirant de l’index, puis reprend à `docs`', () => {
  const refus = { disponible: true, valeur: { status: 1, stdout: 'CONFLICT (content)', stderr: '' } }
  const conflits = ['docs/systemes.md', 'src/audio/_registry.generated.ts']
  const { ctx, gestes } = ctxFile({ pr: REST({ mergeable_state: 'dirty' }), fusion: refus, conflits })
  const journal = journalPush()
  const vu = etapeFile.jouer(ctx, journal)
  assert.deepEqual([vu.ok, vu.relancer], [true, ['docs', 'push-branche', 'pr', 'file']], vu.raison)
  assert.deepEqual(gestes.map((g) => g[0]), ['tronc', 'fusionner', 'conclure', 'docs'])
  assert.equal(gestes[3][1], '--code', 'post-merge ne joue pas sur un `git commit` : les cibles de code se produisent ici')
  assert.deepEqual(gestes[2][1], { chemins: conflits, message: gestes[1][1] })
  assert.equal(journal.ejections, 1)
})

// #2203
test('file : un conflit MIXTE (une cible pure ET un manuscrit) n’est jamais conclu — la fusion est abandonnée', () => {
  const stdout = `${'note stdout\n'.repeat(50)}cause stdout mixte tardive\n`
  const stderr = `${'note stderr\n'.repeat(50)}cause stderr mixte tardive\n`
  const refus = classer({ status: 17, stdout, stderr })
  const { ctx, gestes } = ctxFile({ pr: REST({ mergeable_state: 'dirty' }), fusion: refus, conflits: ['docs/systemes.md', 'src/a.ts'] })
  const vu = etapeFile.jouer(ctx, journalPush())
  assert.equal(vu.ok, false)
  assert.ok(vu.raison.includes(stdout))
  assert.ok(vu.raison.includes(stderr))
  assert.match(vu.raison, /refus \(status 17\)/)
  assert.ok(vu.raison.includes('docs/systemes.md'))
  assert.ok(vu.raison.includes('src/a.ts'))
  assert.match(vu.raison, /CONFLIT, abandonnée/)
  assert.deepEqual(gestes.map((g) => g[0]), ['tronc', 'fusionner', 'abandonner'])
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

// ── veillerLeTrain : la veille d'un run (#2227) ──────────────────────────────────────────

const LANCEMENT_DU_RUN = 1790000000000
const RUN = `4242-${LANCEMENT_DU_RUN}`
const AVANT = '4100-1780000000000'

/** Les journaux que le disque porte, sauvegarde après sauvegarde, pendant qu'un run joue `etapes` —
 *  écrits par le MOTEUR réel (`jouerLeTrain`), puis le verdict tel que `main` le pose. */
function journauxDuRun(etapes, { run = RUN, journal = journalVide('b') } = {}) {
  const vus = []
  entameDuRun(journal, { run, pid: pidDeRun(run), fileTimeoutMin: 10 })
  vus.push(structuredClone(journal))
  let verdict
  try {
    verdict = jouerLeTrain({ tete: 't' }, etapes, journal, { sauver: (j) => vus.push(structuredClone(j)) })
  } catch (e) {
    verdict = { etat: 'rouge', etape: 'moteur', raison: `ARRÊT INATTENDU : ${e.message}` }
  }
  journal.verdict = verdict
  vus.push(structuredClone(journal))
  return vus
}

/** La veille sur une suite de lectures (la dernière se répète), horloge et sommeil injectés ; l'horloge
 *  part du LANCEMENT_DU_RUN du run, sauf `depart`. Sa première ligne (#2493) est vérifiée, puis retirée. */
function veille(lectures, { depart = LANCEMENT_DU_RUN, ...o } = {}) {
  const lignes = []
  let i = 0
  let horloge = depart
  const code = veillerLeTrain({
    run: RUN,
    fileTimeoutMin: 10,
    lire: () => lectures[Math.min(i++, lectures.length - 1)],
    ecrire: (l) => lignes.push(l),
    journal: 'j.json',
    pid: 99,
    vivant: () => true,
    maintenant: () => horloge,
    dormir: (ms) => {
      horloge += ms
    },
    ...o,
  })
  assert.equal(lignes[0], `[veille] PID 99 veille le run ${RUN} (journal j.json)`)
  return { code, lignes: lignes.slice(1), lectures: i, horloge }
}

test('veillerLeTrain : un run VERT — une ligne par transition, numérotée, la ligne PUBLICATION:, code 0', () => {
  const vus = journauxDuRun([factice('un', { ok: true, dit: 'arbre propre' }), factice('deux', { ok: true, dit: 'poussé' })])
  const { code, lignes } = veille(vus)
  assert.equal(code, 0)
  assert.deepEqual(lignes, ['#1 un — en-vol', '#2 un — vert — arbre propre', '#3 deux — en-vol', '#4 deux — vert — poussé', 'PUBLICATION: vert null'])
})

test('veillerLeTrain : un run ROUGE — la raison en UNE ligne, code 1', () => {
  const vus = journauxDuRun([factice('un', { ok: true }), factice('deux', { ok: false, raison: 'arbre NON COMMITÉ (2) :\n    a.ts\n    b.ts' })])
  const { code, lignes } = veille(vus)
  assert.equal(code, 1)
  assert.deepEqual(lignes.slice(-2), ['#4 deux — rouge — arbre NON COMMITÉ (2) : · a.ts · b.ts', 'PUBLICATION: rouge deux — arbre NON COMMITÉ (2) :'])
})

test('veillerLeTrain : un run INDÉTERMINÉ sort sur le code du train', () => {
  const vus = journauxDuRun([factice('un', { indetermine: true, raison: 'aucune fusion en 10 min' })])
  const { code, lignes } = veille(vus)
  assert.equal(code, CODE_INDETERMINEE)
  assert.equal(lignes.at(-1), 'PUBLICATION: indéterminée file null')
})

test('veillerLeTrain : ARRÊT MOTEUR — verdict `rouge moteur`, ou train mort sans verdict', () => {
  const vus = journauxDuRun([
    factice('un', () => {
      throw new Error('boum')
    }),
  ])
  const vu = veille(vus)
  assert.equal(vu.code, CODE_ARRET_MOTEUR)
  assert.deepEqual(vu.lignes, ['#1 un — en-vol', 'PUBLICATION: rouge moteur — ARRÊT INATTENDU : boum'])

  // Mort en vol (#2493) : le journal reste `en-vol`, sans verdict. La mort est CONSTATÉE au journal
  // (`constaterLaMort`), relue, émise, puis la veille sort sur le verdict constaté.
  const enVol = journauxDuRun([factice('un', { ok: true })]).slice(0, 2)
  const dossier = mkdtempSync(join(tmpdir(), 'constat-'))
  try {
    const chemins = { dossier, json: join(dossier, 'b.json'), log: join(dossier, 'b.log') }
    ecrireJsonAtomique(chemins.json, enVol[1])
    writeFileSync(chemins.log, '')
    const a = new Date(LANCEMENT_DU_RUN).toISOString()
    const mort = veille([], {
      lire: () => lireJournal(chemins.json, 'b'), vivant: () => false,
      constater: () => constaterLaMort({ chemins, par: 'veille 99', vivant: () => false, maintenant: () => LANCEMENT_DU_RUN, mesurer: () => assert.fail('aucune mesure hors de `fin`') }),
    })
    const raison = `train 4242 mort pendant un (constat : veille 99, ${a})`
    assert.equal(mort.code, CODE_ARRET_MOTEUR)
    assert.deepEqual(mort.lignes, ['#1 un — en-vol', `#2 un — rouge — INTERROMPUE : ${raison}`, `PUBLICATION: rouge moteur — ${raison}`])
    assert.deepEqual(JSON.parse(readFileSync(chemins.json, 'utf8')).verdict, { etat: 'rouge', etape: 'moteur', raison, constat: { par: 'veille 99', a } })
    assert.equal(readFileSync(chemins.log, 'utf8'), `[publier] un — INTERROMPUE : ${raison}\nPUBLICATION: rouge moteur — ${raison}\n`)
  } finally {
    rmSync(dossier, { recursive: true, force: true })
  }
  // Le verdict écrit juste avant la mort gagne : la veille, sans constat, le lit à la relecture.
  const tardif = veille([enVol[1], journauxDuRun([factice('un', { ok: true })]).at(-1)], { vivant: () => false })
  assert.equal(tardif.code, 0)
  // Un train mort avant d'écrire son run au journal : relu une fois, puis `rouge moteur`.
  const avant = journauxDuRun([factice('un', { ok: true })], { run: AVANT }).at(-1)
  const sansJournal = veille([avant], { vivant: () => false })
  assert.equal(sansJournal.code, CODE_ARRET_MOTEUR)
  assert.equal(sansJournal.lectures, 2)
  assert.deepEqual(sansJournal.lignes, ['PUBLICATION: rouge moteur — train 4242 mort avant d\'écrire son run au journal'])
})

test('mortDuRun : pid mort, ou `fin` en vol au-delà de la borne du synchroniseur ; rien pour un run jugé ou vivant', () => {
  const debut = Date.parse('2026-10-08T11:29:54.094Z')
  const journal = { run: RUN, pid: 4242, verdict: null, etapes: { file: { etat: 'vert', run: RUN, seq: 9 }, fin: { etat: 'en-vol', debut: new Date(debut).toISOString(), run: RUN, seq: 12 } } }
  assert.equal(mortDuRun(journal, { vivant: () => true, maintenant: () => debut + 360_000 }), null)
  assert.deepEqual(mortDuRun(journal, { vivant: () => true, maintenant: () => debut + 360_001 }), { pid: 4242, nom: 'fin' })
  assert.deepEqual(mortDuRun(journal, { vivant: () => false, maintenant: () => debut }), { pid: 4242, nom: 'fin' })
  assert.equal(mortDuRun({ ...journal, verdict: { etat: 'vert' } }, { vivant: () => false }), null)
  assert.equal(mortDuRun(null, { vivant: () => false }), null)
  const j = { run: RUN, etapes: {} }
  transitionDuRun(j, 'un', { etat: 'en-vol' })
  transitionDuRun(j, 'un', { etat: 'vert' })
  assert.deepEqual(j, { run: RUN, seq: 2, etapes: { un: { etat: 'vert', run: RUN, seq: 2 } } })
})

test('veillerLeTrain : la borne DÉRIVÉE de la borne de file du run, comptée depuis le LANCEMENT', () => {
  const enVol = journauxDuRun([factice('un', { ok: true })]).slice(0, 2)
  const vu = veille(enVol, { periodeMs: 60_000, fileTimeoutMin: 999 })
  assert.equal(vu.code, CODE_BORNE_DEPASSEE)
  // Le `fileTimeoutMin` du RUN (10, posé par `entameDuRun`) fait la borne, pas celui de la veille.
  assert.equal(vu.horloge - LANCEMENT_DU_RUN, borneDeVeilleMin(10) * 60_000)
  assert.equal(borneDeVeilleMin(10), (BORNE_EJECTIONS + 2) * 10)
  assert.match(vu.lignes.at(-1), /^\[veille\] borne de 30 min dépassée sans verdict du run 4242-1790000000000/)
  assert.deepEqual(vu.lignes.slice(0, -1), ['#1 un — en-vol'])
  // Une veille démarrée (ou ré-armée) TARD sort à la borne RESTANTE, jamais une borne pleine de plus.
  const tard = veille(enVol, { periodeMs: 60_000, depart: LANCEMENT_DU_RUN + (borneDeVeilleMin(10) - 2) * 60_000 })
  assert.equal(tard.code, CODE_BORNE_DEPASSEE)
  assert.equal(tard.horloge - LANCEMENT_DU_RUN, borneDeVeilleMin(10) * 60_000)
  assert.equal(tard.lectures, 3)
})

test('veillerLeTrain : aucune ligne RÉPÉTÉE tant qu’une étape reste en vol', () => {
  const [entame, enVol, ...fin] = journauxDuRun([factice('un', { ok: true, dit: 'fusionnée' })])
  const { code, lignes } = veille([entame, ...Array(12).fill(enVol), ...fin])
  assert.equal(code, 0)
  assert.deepEqual(lignes, ['#1 un — en-vol', '#2 un — vert — fusionnée', 'PUBLICATION: vert null'])
})

test('veillerLeTrain : RÉ-ARMÉE avec `depuis` = le dernier `#seq` lu, elle ne ré-émet aucune ligne périmée', () => {
  const vus = journauxDuRun([factice('un', { ok: true, dit: 'a' }), factice('deux', { ok: true, dit: 'b' })])
  // La première veille s'arrête sans verdict (le Monitor qui la portait plafonne) après `#3`.
  const premiere = veille(vus.slice(0, 4))
  assert.equal(premiere.code, CODE_BORNE_DEPASSEE)
  const dernier = Number(/^#(\d+) /.exec(premiere.lignes.filter((l) => l.startsWith('#')).at(-1))[1])
  assert.equal(dernier, 3)
  // Le ré-armement relit le journal depuis le DÉBUT du run : rien d'avant `#dernier` ne ressort.
  const rearmee = veille(vus, { depuis: dernier })
  assert.equal(rearmee.code, 0)
  assert.deepEqual([...premiere.lignes.slice(0, 3), ...rearmee.lignes], [
    '#1 un — en-vol', '#2 un — vert — a', '#3 deux — en-vol', '#4 deux — vert — b', 'PUBLICATION: vert null',
  ])
})

test('veillerLeTrain : le journal du run PRÉCÉDENT au démarrage ne dit rien, verdict compris', () => {
  const precedent = journauxDuRun([factice('un', { ok: false, raison: 'vieux rouge' })], { run: AVANT }).at(-1)
  const courant = journauxDuRun([factice('un', { ok: true, dit: 'neuf' })])
  const { code, lignes } = veille([precedent, precedent, precedent, ...courant])
  assert.equal(code, 0)
  assert.deepEqual(lignes, ['#1 un — en-vol', '#2 un — vert — neuf', 'PUBLICATION: vert null'])
})

test('veillerLeTrain : un run REPRIS (`--reprendre`) ne rejoue aucune transition déjà émise', () => {
  const premier = journauxDuRun(
    [factice('un', { ok: true, dit: 'a' }), factice('deux', { ok: true, dit: 'b' }), factice('trois', { ok: false, raison: 'file' })],
    { run: AVANT },
  ).at(-1)
  const { journal } = journalInitial({ reprendre: true, lu: structuredClone(premier), branche: 'b' })
  const repris = journauxDuRun(
    [factice('un', { ok: true }, { deja: true }), factice('deux', { ok: true }, { deja: true }), factice('trois', { ok: true, dit: 'fusionnée' })],
    { journal },
  )
  // Le verdict rouge du run d'avant s'efface à l'entame : la veille ne sort pas dessus.
  assert.equal(repris[0].verdict, null)
  const { code, lignes } = veille([premier, ...repris])
  assert.equal(code, 0)
  assert.deepEqual(lignes, ['#1 trois — en-vol', '#2 trois — vert — fusionnée', 'PUBLICATION: vert null'])
})

test('veillerLeTrain : une RELANCE du moteur réel ne ré-émet pas l’étape verte « déjà faite », rejoue le reste', () => {
  let bouge = true
  const vus = journauxDuRun([
    factice('un', { ok: true, dit: 'garde' }),
    { nom: 'deux', dejaFaite: (_ctx, j) => j.etapes.deux?.etat === 'vert', jouer: () => ({ ok: true, dit: 'commis' }) },
    {
      nom: 'trois',
      dejaFaite: () => false,
      jouer: () => {
        if (!bouge) return { ok: true, dit: 'fusionnée' }
        bouge = false
        return { ok: true, dit: 'éjectée', relancer: ['trois'] }
      },
    },
  ])
  const { code, lignes } = veille(vus)
  assert.equal(code, 0)
  assert.deepEqual(lignes, [
    '#1 un — en-vol', '#2 un — vert — garde',
    '#3 deux — en-vol', '#4 deux — vert — commis',
    '#5 trois — en-vol', '#6 trois — vert — éjectée',
    '#7 trois — à faire — relance depuis trois',
    '#8 un — en-vol', '#9 un — vert — garde',
    '#10 trois — en-vol', '#11 trois — vert — fusionnée',
    'PUBLICATION: vert null',
  ])
  // Aucune ligne n'est émise deux fois sous le même numéro.
  assert.equal(new Set(lignes).size, lignes.length)
})

test('transitionsDuRun : l’ordre des `seq`, au-delà de `depuis`, du seul run courant', () => {
  const j = { run: RUN, verdict: null, etapes: { b: { etat: 'vert', run: RUN, seq: 3 }, a: { etat: 'rouge', run: RUN, seq: 2 }, c: { etat: 'vert', run: AVANT, seq: 9 } } }
  assert.deepEqual(transitionsDuRun(j, RUN, 0), { courant: true, lignes: ['#2 a — rouge', '#3 b — vert'], seq: 3, verdict: null })
  assert.deepEqual(transitionsDuRun(j, RUN, 2).lignes, ['#3 b — vert'])
  assert.deepEqual(transitionsDuRun(j, RUN, 3).seq, 3)
  assert.equal(transitionsDuRun(null, RUN, 0).courant, false)
})

test('ligneDePublication / codeDeVerdict : une seule forme pour le train et sa veille', () => {
  assert.equal(ligneDePublication({ etat: 'vert' }, 'abc'), 'PUBLICATION: vert abc')
  assert.equal(ligneDePublication({ etat: 'rouge', etape: 'docs', raison: 'x\ny' }, 'abc'), 'PUBLICATION: rouge docs — x')
  assert.equal(codeDeVerdict({ etat: 'vert' }), 0)
  assert.equal(codeDeVerdict({ etat: 'rouge', etape: 'docs' }), 1)
  assert.equal(codeDeVerdict({ etat: 'rouge', etape: 'moteur' }), CODE_ARRET_MOTEUR)
  assert.equal(codeDeVerdict({ etat: 'indeterminee' }), CODE_INDETERMINEE)
  assert.equal(new Set([0, 1, CODE_INDETERMINEE, CODE_ARRET_MOTEUR, CODE_BORNE_DEPASSEE]).size, 5)
})

test('commandeDeVeille / idDeRun / runDe : la commande que `--detache` imprime', () => {
  const run = idDeRun({ pid: 4242, lancement: LANCEMENT_DU_RUN })
  assert.equal(run, RUN)
  assert.deepEqual(runDe(run), { pid: 4242, lancement: LANCEMENT_DU_RUN })
  assert.equal(pidDeRun(run), 4242)
  assert.equal(pidDeRun('0-1'), null)
  assert.equal(pidDeRun('abc'), null)
  const commande = commandeDeVeille({ script: 'Mes Projets\\Game\\scripts\\ops\\publier.mjs', run })
  assert.equal(commande, 'node "Mes Projets/Game/scripts/ops/publier.mjs" --veiller 4242-1790000000000; node "Mes Projets/Game/scripts/ops/publier.mjs" --veiller 4242-1790000000000 --constat')
  assert.equal(commandeDeVeille({ script: '/r/publier.mjs', run, depuis: 7 }), 'node "/r/publier.mjs" --veiller 4242-1790000000000 --depuis 7; node "/r/publier.mjs" --veiller 4242-1790000000000 --constat')
  // Ses arguments, relus par `optionsDe`, désignent le même run.
  const [veillee, constat] = commande.split('; ').map((partie) => optionsDe(partie.split('.mjs" ')[1].split(' ')))
  assert.deepEqual([veillee.veiller, veillee.constat, veillee.inconnus], [run, false, []])
  assert.deepEqual([constat.veiller, constat.constat, constat.inconnus], [run, true, []])
  assert.equal(optionsDe(['--veiller', run, '--depuis', '7']).depuis, 7)
  assert.deepEqual(optionsDe(['--depuis', '-1']).inconnus, ['--depuis -1'])
})

test('lancement : le parent de `--detache` et l’enfant nomment le MÊME run', () => {
  const env = { ...process.env, ...envDeLancement(LANCEMENT_DU_RUN) }
  assert.deepEqual(Object.keys(envDeLancement(LANCEMENT_DU_RUN)), [ENV_LANCEMENT])
  // L'enfant (pid 4242, celui que le parent reçoit de `lancerDetache`) relit le lancement du parent.
  assert.equal(idDeRun({ pid: 4242, lancement: lancementDe(env, () => 0) }), idDeRun({ pid: 4242, lancement: LANCEMENT_DU_RUN }))
  // Un run direct, sans parent, prend l'instant présent.
  assert.equal(lancementDe({}, () => 99), 99)
  assert.equal(lancementDe({ [ENV_LANCEMENT]: 'x' }, () => 99), 99)
  // `lancerDetache` passe cet environnement à l'enfant.
  let vuEnv = null
  lancerDetache({
    script: 's.mjs', args: [], cwd: '.', fdLog: 'ignore', plateforme: 'linux', envSupplementaire: envDeLancement(LANCEMENT_DU_RUN),
    detacher: (_n, _a, o) => {
      vuEnv = o.env
      return { pid: 4242, unref: () => {} }
    },
  })
  assert.equal(lancementDe(vuEnv), LANCEMENT_DU_RUN)
})

// ── #2493 : la mort d'un train sans verdict, CONSTATÉE (T2, T3) ─────────────────────────

/** Le témoin 6 de #2493 (2026-10-08) : journal et log du train `42408`, tué en `fin` PR fusionnée (provenance :
 *  `fixtures/temoin-2493-fin-tuee/provenance.json`). */
const TEMOIN_6 = Object.freeze({
  dossier: fileURLToPath(new URL('./fixtures/temoin-2493-fin-tuee/', import.meta.url)),
  run: '42408-1791457996063',
  tete: '565f26dfc4784f5a237d97cedb80df14c72eb4ee',
  empreintes: {
    'chantier_2497.json': 'e9239e833c54857198c759029b8dbe7b0de6c6fca1be1a9ad2a559a91e3653f9',
    'chantier_2497.log': '96bd327017afdc9e985d0e614fc5405cbda1164302907877303e3dca160308e5',
  },
})

/** Le journal et le log du témoin 6, empreintes vérifiées, copiés sous un dossier jetable. */
function copieDuTemoin6() {
  const dossier = mkdtempSync(join(tmpdir(), 'temoin-2493-'))
  for (const [nom, empreinte] of Object.entries(TEMOIN_6.empreintes)) {
    const source = join(TEMOIN_6.dossier, nom)
    assert.equal(createHash('sha256').update(readFileSync(source)).digest('hex'), empreinte, `${nom} : fixture altérée`)
    copyFileSync(source, join(dossier, nom))
  }
  return { dossier, json: join(dossier, 'chantier_2497.json'), log: join(dossier, 'chantier_2497.log') }
}

/** Un principal laissé `interrompu` après « commit » (journal à `avance`, HEAD = U), et son U. */
async function principalInterrompu() {
  const env = envDeDepotForge()
  const amont = instanceDeDepot({ fichiers: { 'a.md': 'a\n' } })
  const principal = instanceDeDepot({ fichiers: { 'a.md': 'a\n' } })
  const jeter = () => { for (const d of [amont.racine, principal.racine]) rmSync(d, { recursive: true, force: true }) }
  assert.ok(reussi(ajouterOrigine(depotDe(principal.racine, { env }), amont.racine)))
  writeFileSync(join(amont.racine, 'a.md'), 'b\n')
  assert.ok(reussi(commitDe(depotDe(amont.racine, { env }), { message: 'amont', chemins: ['a.md'] })))
  const U = /** @type {string} */ (shaDe(depotDe(amont.racine, { env }), 'HEAD'))
  const vu = await synchroniserPrincipal({ depuis: principal.racine, env, gestes: { etape: (nom) => { if (nom === 'commit') throw new Error('mort après commit') } } })
  assert.equal(vu.etat, 'interrompu', JSON.stringify(vu))
  return { racine: principal.racine, U, env, jeter }
}

test('#2493 T2 : la `fin` tuée du témoin 6 — la veille CONSTATE au journal : vert INTERROMPUE, principal re-mesuré, une seule fois', async () => {
  const chemins = copieDuTemoin6()
  const monde = await principalInterrompu()
  try {
    const mesurer = () => mesurerPrincipal({ depuis: monde.racine, visee: monde.U, env: monde.env })
    const par = `veille ${process.pid}`
    const lignes = []
    const code = veillerLeTrain({
      run: TEMOIN_6.run, fileTimeoutMin: 120, journal: chemins.json, ecrire: (l) => lignes.push(l), dormir: () => {},
      lire: () => lireJournal(chemins.json, 'chantier/2497'),
      constater: () => constaterLaMort({ chemins, par, mesurer }),
    })
    assert.equal(code, 0, lignes.join('\n'))
    const fin = new RegExp(`^#13 fin — vert — INTERROMPUE : train 42408 mort sans verdict \\(constat : ${par}, \\d{4}-[\\d:.TZ-]+\\) ; principal interrompu : avance \\w{9}\\.\\.\\w{9} entamée \\(étape avance\\), HEAD \\w{9} — reprise due \\(journal .+\\) ; post-merge \\w{9}\\.\\.\\w{9} dû depuis .+, aucun consommateur vivant$`)
    assert.match(lignes.at(-2), fin)
    assert.equal(lignes.at(-1), `PUBLICATION: vert ${TEMOIN_6.tete}`)
    const journal = JSON.parse(readFileSync(chemins.json, 'utf8'))
    assert.deepEqual([journal.verdict.etat, journal.verdict.constat.par, journal.etapes.fin.seq, journal.etapes.fin.etat], ['vert', par, 13, 'vert'])
    const log = readFileSync(chemins.log, 'utf8').trimEnd().split('\n')
    assert.match(log.at(-2), /^\[publier\] fin — INTERROMPUE : train 42408 mort sans verdict \(constat : /)
    assert.equal(log.at(-1), `PUBLICATION: vert ${TEMOIN_6.tete}`)
    const avant = [readFileSync(chemins.json, 'utf8'), readFileSync(chemins.log, 'utf8')]
    assert.equal(constaterLaMort({ chemins, par: 'second constat', mesurer }), null)
    assert.deepEqual([readFileSync(chemins.json, 'utf8'), readFileSync(chemins.log, 'utf8')], avant, 'un second constat n’ajoute rien')
  } finally {
    monde.jeter()
    rmSync(chemins.dossier, { recursive: true, force: true })
  }
})

test('#2493 T2 variante : le même train mort pendant `file` — `rouge moteur`, code 4', () => {
  const chemins = copieDuTemoin6()
  try {
    const journal = JSON.parse(readFileSync(chemins.json, 'utf8'))
    delete journal.etapes.pilotage
    delete journal.etapes.fin
    Object.assign(journal.etapes.file, { etat: 'en-vol', fin: undefined, detail: null, seq: 8 })
    journal.seq = 8
    ecrireJsonAtomique(chemins.json, journal)
    const lignes = []
    const code = veillerLeTrain({
      run: TEMOIN_6.run, fileTimeoutMin: 120, journal: chemins.json, ecrire: (l) => lignes.push(l), dormir: () => {}, vivant: () => false,
      lire: () => lireJournal(chemins.json, 'chantier/2497'),
      constater: () => constaterLaMort({ chemins, par: 'veille 1', vivant: () => false, mesurer: () => assert.fail('aucune mesure hors de `fin`') }),
    })
    assert.equal(code, CODE_ARRET_MOTEUR)
    assert.match(lignes.at(-1), /^PUBLICATION: rouge moteur — train 42408 mort pendant file \(constat : veille 1, .+\)$/)
  } finally {
    rmSync(chemins.dossier, { recursive: true, force: true })
  }
})

/** `processus` tué : `Stop-Process -Force` sous win32 (Git Bash en rend 127), `SIGKILL` ailleurs. */
function tuer(pid) {
  if (process.platform === 'win32') spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', `Stop-Process -Id ${pid} -Force`], { windowsHide: true })
  else process.kill(pid, 'SIGKILL')
}

test('#2493 T3 : la veille COMPOSITE sous bash, sa première veille TUÉE, puis le train : le constat rend le verdict, code 0, jamais 127', async () => {
  const { racine, sha: fusion } = implantationDuCli()
  let train, bash, borne, veille = 0
  try {
    const branche = `chantier/2493-t3-${process.pid}-${Date.now()}`
    const chemins = cheminsDeJournal(racine, branche)
    train = spawn(process.execPath, ['-e', 'setTimeout(() => {}, 120000)'], { stdio: 'ignore' })
    const run = idDeRun({ pid: /** @type {number} */ (train.pid), lancement: Date.now() })
    const tete = 'c'.repeat(40)
    mkdirSync(chemins.dossier, { recursive: true })
    ecrireJsonAtomique(chemins.json, {
      branche, base: null, tete, ejections: 0, run, pid: train.pid, fileTimeoutMin: 10, seq: 2, verdict: null,
      etapes: {
        file: { etat: 'vert', detail: { fusion }, tete, run, seq: 1 },
        fin: { etat: 'en-vol', debut: new Date().toISOString(), detail: null, tete, run, seq: 2 },
      },
    })
    writeFileSync(chemins.log, '')
    const env = { ...envDeDepotForge(), ...envGitFeint([{ si: ['symbolic-ref', '--quiet', '--short', 'HEAD'], stdout: branche, status: 0 }]), WFRP_PUBLIER_ENFANT: '' }
    bash = spawn('bash', ['-c', commandeDeVeille({ script: join(racine, 'scripts/ops/publier.mjs'), run })], { cwd: racine, env, stdio: ['ignore', 'pipe', 'pipe'] })
    let sortie = ''
    bash.stdout.on('data', (d) => { sortie += d })
    const fini = new Promise((ok) => bash.on('close', (code) => ok(code)))
    const attendre = (motif) => sousEcheanceAsync({ attente: { echeanceMs: 60_000, pasMs: 50 }, essai: () => motif.exec(sortie), abouti: (vu) => vu !== null })
    const premiere = await attendre(/^\[veille\] PID (\d+) veille le run /m)
    assert.ok(premiere, sortie)
    veille = Number(premiere[1])
    tuer(veille)
    assert.ok(await attendre(new RegExp(`^\\[veille\\] constat du run ${run} après la sortie de sa veille$`, 'm')), sortie)
    train.kill()
    borne = setTimeout(() => bash.kill(), 60_000)
    const code = await fini
    clearTimeout(borne)
    assert.equal(code, 0, sortie)
    assert.match(sortie, new RegExp(`^#3 fin — vert — INTERROMPUE : train ${train.pid} mort sans verdict \\(constat : veille \\d+, .+\\) ; principal `, 'm'))
    assert.equal(sortie.trimEnd().split('\n').at(-1), `PUBLICATION: vert ${tete}`)
  } finally {
    clearTimeout(borne)
    try {
      train?.kill()
      bash?.kill()
      if (veille && estPidVivant(veille)) tuer(veille)
      for (const pid of [veille, train?.pid, bash?.pid]) {
        if (pid) assert.equal(await sousEcheanceAsync({ attente: { echeanceMs: 10_000, pasMs: 50 }, essai: () => estPidVivant(pid), abouti: (vit) => !vit }), false, `PID ${pid} survit`)
      }
    } finally {
      rmSync(racine, { recursive: true, force: true })
    }
  }
})
