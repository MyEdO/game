// PUBLICATION — le TRAIN, en un processus du dépôt.
//
// INVARIANT (ticket #1736, « Design », 2026-09-14) : « La PUBLICATION est un train d'ÉTAPES FIXES,
// jouées par UN processus du dépôt, détaché du harnais, idempotent et REPRENABLE ; l'orchestrateur
// lance, lit un journal, juge le contenu — il ne joue plus aucune étape à la main. Critère
// "l'étape N+1 coûte une ligne" : ajouter une étape = une entrée dans la table `ETAPES` (nom,
// `jouer(ctx)`, `dejaFaite(ctx)`), rien d'autre. » La table vit dans `etapesDuTrain.mjs`.
//
// #2178 ; #2437 ; https://docs.github.com/en/graphql/reference/input-objects#enqueuepullrequestinput
//
// CLÔTURE DES ÉTAPES, gardée contre une retouche de bonne foi — les étapes vivent dans
// `etapesDuTrain.mjs`, et le test de clôture (`etapesDuTrain.test.mjs`) refuse à ce module toute
// liaison, importée de n'importe quel module de sa clôture, qui atteint un lancement de processus
// par l'une des SOURCES de capacité de sa table : import d'un module intégré hors de ses inertes,
// import d'un paquet, import d'un module du dépôt qui l'exporte lanceuse ou n'est pas lu, import
// dynamique ou `require`, `createRequire`/`getBuiltinModule`/`binding`, accès ambiant (global lu hors
// de ses inertes), évaluation ; `import.meta` est inerte. Résidu que le test ne garde pas :
// évaluation par `.constructor`, état mutable posé par un autre module, effet au chargement d'un
// module de la clôture (#2073). Une étape passe par le contexte (`contexteDe`), qui porte des
// QUESTIONS (`questionsDuTrain`) et des gestes NOMMÉS aux arguments validés — `commitDe` (des
// FICHIERS, sous `--literal-pathspecs`),
// `fusionner`, `abandonnerFusion`, `pousser`, `fetchOrigin` sous `tronc` (`gitPorte.mjs`), `npm` (un
// nom de script), `docs` (un mode de build-all), `coursesCi` (un sha), `coursesDeFile`, `parentsDe` (un
// sha), `jobsEnEchec` (un id de course et son essai), `lirePr`, `ouvrirPr`, `demanderFusion` (un numéro et un sha), `lireTicket` et `commenter`
// (un numéro de ticket) —, jamais la poignée du dépôt ni un argv libre. Ce fichier ne porte aucun
// `gh issue close` (la fermeture appartient au job `fermetures` de la CI). D'où, pour les étapes :
// ni `git add -A`, ni un commit de l'arbre ou de l'index entier, ni `git stash`, ni `push --force`,
// ni aucun push vers `main` (`pousser` le refuse), ni `reset --hard`, `branch -D`,
// `worktree remove --force`, `checkout` ou `restore`.
// Un rebase INTERROMPU trouvé sur disque à la préflight est NOMMÉ, jamais avorté d'office.
//
// Usage : node scripts/ops/publier.mjs [--detache] [--reprendre] [--etapes] [--file-timeout-min <n>] [--veiller <run> [--depuis <seq>] [--constat]]
// `--veiller <run>` suit le run nommé par `--detache` (`veillerLeTrain`), sans rien jouer ; `--depuis <seq>`
// la ré-arme après la dernière transition `#<seq>` lue ; `--constat` la reprend après la sortie de sa veille
// (#2493), depuis la dernière transition du journal.
import { optionsDe, idDeRun, runDe, pidDeRun, lancementDe, journalVide, journalInitial, modeDuLog, ouvrirLog, CODE_BORNE_DEPASSEE, entameDuRun, ligneDePublication, codeDeVerdict, cheminsDeJournal, lireJournal, lancementNpm } from './publicationDonnee.mjs'
import { spawnSync } from 'node:child_process'
import { appendFileSync, closeSync, existsSync, mkdirSync, readFileSync, writeSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  GitIndisponible, TRONC, abandonnerFusion, attributsDe, baseCommune, brancheDe, ceQuiChange, cheminsEnConflit, combienDe, commitDe, refusDeGit,
  conclureFusionSansChemins, depotDe, TIMEOUT_DU_HOOK_MS,
  estAncetre, estShaComplet, etatDeLArbre, fetchOrigin, fusionner, indisponible, lireEnLot, origineDe, pousser, racineDe, rebaseEntame, reussi, shaDe,
} from '../guards/lib/gitPorte.mjs'
import { BORNE_RAISON, DEPOT, lireTicket, poserCommentaire } from '../guards/lib/ticketsGh.mjs'
import { coursesCi, jobsEnEchecDe } from '../guards/lib/coursesCi.mjs'
import { texteDeCi } from '../gates/gatesDeCi.mjs'
import { DOSSIER, PORTE, branchesDePush } from '../gates/workflowsDuDepot.mjs'
import { commitsDeLaPlage } from '../guards/lib/plageFermante.mjs'
import { verdictDePublication } from '../guards/lib/livraison.mjs'
import { GENERATORS, estCiblePure } from '../docs/build-all.mjs'
import { etatFileDePr, fusionDePr } from '../guards/lib/fusionPr.mjs'
import { BORNE_EJECTIONS, ETAPES, prDeRest } from './etapesDuTrain.mjs'
import { attendreSync } from '../guards/lib/spawnResilient.mjs'
import { ecrireJsonAtomique } from '../guards/lib/ecritureJsonAtomique.mjs'
import { TIMEOUT_SYNCHRONISEUR } from '../agents/compat-core.mjs'
import { prendreVerrou } from '../test/verrou.mjs'
import { estPidVivant } from '../guards/lib/pid.mjs'
import { publicationDe } from './publicationIsolee.mjs'
import { ligneDeLEtat, mesurerPrincipal } from './synchroniser.mjs'
import { attendreLaReconstruction, demandesDe } from '../git-hooks/reconstruction.mjs'

/** L'arbre où VIT ce script — jamais `process.cwd()` : le train publie SON worktree. */
export const RACINE = fileURLToPath(new URL('../..', import.meta.url))



// ── Purs : options, journal, plan ──────────────────────────────────────────────────────

/**
 * Première étape NON VERTE du journal — le point de reprise. Une étape verte POUR UNE AUTRE TÊTE est
 * « à faire » : sans cela, un 2ᵉ lot sur la même branche sauterait l'attente de la file et le pilotage et
 * s'annoncerait vert. PURE.
 *
 * RÈGLE DE TÊTE, une seule : la comparaison porte sur la TÊTE VIVANTE (`git rev-parse HEAD` au
 * moment où l'on juge), jamais sur `journal.tete` (la tête PUBLIÉE, posée par `preflight`/`docs`), et
 * une étape SANS estampille est « à faire ». Sans cela, une étape estampillée `null` restait verte
 * pour TOUTE tête, à jamais.
 * @param {{etapes?:object}} journal @param {string[]} noms ordre de `ETAPES`
 * @param {string|null} teteVivante `HEAD` mesuré maintenant
 * @returns {string|null} `null` = tout est vert pour cette tête
 */
export function planDeReprise(journal, noms, teteVivante) {
  const etapes = journal?.etapes ?? {}
  for (const nom of noms) {
    const vue = etapes[nom]
    if (!vue || vue.etat !== 'vert') return nom
    if (vue.tete == null || vue.tete !== teteVivante) return nom
  }
  return null
}

/** État affiché d'une étape au journal (`--etapes`), sous la MÊME règle de tête que `planDeReprise`. PURE. */
export const etatDeLEtape = (journal, nom, teteVivante) => {
  const vue = journal?.etapes?.[nom]
  if (!vue) return 'à faire'
  if (vue.etat === 'vert' && (vue.tete == null || vue.tete !== teteVivante)) return 'à faire (verte pour une autre tête)'
  return vue.etat
}

/** L'état d'un VERDICT au journal, sous le nom que porte l'état du train. */
const ETAT_DU_VERDICT = Object.freeze({ vert: 'vert', indeterminee: 'indéterminée' })

/**
 * L'ÉTAT DU TRAIN lu dans son journal — l'unique lecteur du journal pour `--etapes` et la vigie
 * (`scripts/ops/vigie.mjs`). PUR hors de `vivant`. `etat` :
 *   · `aucun` : aucun run au journal ;
 *   · `en-vol` : pas de verdict, le pid du run vit — quelle que soit la tête, que le train fait avancer ;
 *   · `périmé` : un run fini (verdict) ou mort dont la tête publiée n'est plus `teteVivante` ;
 *   · `vert`, `rouge`, `indéterminée` : le verdict du run, pour la tête vivante ;
 *   · `mort` : pas de verdict, le pid ne vit pas, pour la tête vivante.
 * `etape` est la dernière TRANSITION du run (`seq` le plus haut), `rang` sa place dans `noms` (1 à
 * `total`, 0 sans transition). `etapes` et `reprise` suivent la règle de tête (`etatDeLEtape`, `planDeReprise`).
 * @param {object|null} journal @param {{teteVivante:string|null, noms?:string[], vivant?:(pid:number) => boolean}} p `noms` : ceux d’`ETAPES`
 * @returns {{etat:string, etape:string|null, rang:number, total:number, run:string|null, seq:number,
 *            etapes:{nom:string, etat:string}[], reprise:string|null}}
 */
export function etatDuTrain(journal, { teteVivante, noms = ETAPES.map((e) => e.nom), vivant: estVivant = estPidVivant }) {
  const run = journal?.run ?? null
  const transitions = Object.entries(journal?.etapes ?? {})
    .filter(([nom, vue]) => run && vue?.run === run && Number.isInteger(vue.seq) && noms.includes(nom))
    .sort(([, a], [, b]) => b.seq - a.seq)
  const etape = transitions[0]?.[0] ?? null
  const verdict = journal?.verdict ?? null
  const etat = !run ? 'aucun'
    : !verdict && estVivant(journal.pid) ? 'en-vol'
      : journal.tete && journal.tete !== teteVivante ? 'périmé'
        : verdict ? ETAT_DU_VERDICT[verdict.etat] ?? 'rouge'
          : 'mort'
  return {
    etat,
    etape,
    rang: etape ? noms.indexOf(etape) + 1 : 0,
    total: noms.length,
    run,
    seq: journal?.seq ?? 0,
    etapes: noms.map((nom) => ({ nom, etat: etatDeLEtape(journal, nom, teteVivante) })),
    reprise: planDeReprise(journal, noms, teteVivante),
  }
}

// ── Purs : le run courant et sa veille (#2227) ────────────────────────────────────────────────

/**
 * Borne de la veille, en minutes, DÉRIVÉE de celle du train : l'étape `file` se joue au plus
 * `BORNE_EJECTIONS + 1` fois, chacune bornée par `fileTimeoutMin`, et les étapes locales reçoivent une
 * borne de file de plus. PURE.
 */
export const borneDeVeilleMin = (fileTimeoutMin) => (BORNE_EJECTIONS + 2) * fileTimeoutMin

/** Un `dit` en UNE ligne : la veille émet une ligne par transition. PURE. */
const enUneLigne = (texte) => String(texte).split('\n').map((l) => l.trim()).filter(Boolean).join(' · ')

/**
 * Les TRANSITIONS du run `run` de `seq` supérieur à `depuis`, dans l'ordre des `seq`, et son verdict.
 * Une étape ne compte que si le run courant l'a écrite (`run`) ; son `seq` est celui de sa dernière
 * transition (`jouerLeTrain`), donc une étape en vol relue ne se répète pas, une étape rejouée après une
 * relance s'émet à nouveau, et une veille RÉ-ARMÉE (`--depuis <seq>`) ne ré-émet rien. PURE.
 * @param {object|null} journal @param {string} run @param {number} depuis
 * @returns {{courant:boolean, lignes:string[], seq:number, verdict:object|null}}
 */
export function transitionsDuRun(journal, run, depuis) {
  if (!journal || journal.run !== run) return { courant: false, lignes: [], seq: depuis, verdict: null }
  const neuves = Object.entries(journal.etapes ?? {})
    .filter(([, vue]) => vue?.run === run && Number.isInteger(vue.seq) && vue.seq > depuis)
    .sort(([, a], [, b]) => a.seq - b.seq)
  const lignes = neuves.map(([nom, vue]) => `#${vue.seq} ${nom} — ${vue.etat}${vue.dit ? ` — ${enUneLigne(vue.dit)}` : ''}`)
  return { courant: true, lignes, seq: neuves.length ? neuves.at(-1)[1].seq : depuis, verdict: journal.verdict ?? null }
}

/** La TRANSITION `vue` de l'étape `nom` du run de `journal`, estampillée de son `run` et du `seq` suivant.
 *  MUTE `journal`. */
export function transitionDuRun(journal, nom, vue) {
  journal.seq = (journal.seq ?? 0) + 1
  journal.etapes[nom] = { ...vue, run: journal.run ?? null, seq: journal.seq }
}

/**
 * Le MOTEUR du train : joue les étapes dans l'ordre, saute celles que `dejaFaite` déclare, arrête à
 * la première rouge, écrit le journal à l'ENTRÉE de chaque étape jouée (`en-vol`) et après son verdict ;
 * chaque TRANSITION y porte le `run` qui l'a écrite, son `dit` (le `dit` d'un vert, la `raison` sinon)
 * et le `seq` suivant du journal (`transition`). PUR hors des `jouer` qu'on lui donne —
 * testable avec des étapes factices.
 *
 * Une étape peut demander une RELANCE (`{ relancer: [<noms>] }`, cas « PR éjectée de la file ») : les
 * étapes nommées repassent « à faire » et le train reprend du début. Le compteur `ejections` du
 * journal est la borne, et l'étape qui demande la relance la lit.
 * @returns {{etat:'vert'|'rouge'|'indeterminee', etape?:string, raison?:string}}
 */
export function jouerLeTrain(ctx, etapes, journal, { sauver = () => {}, journaliser = () => {} } = {}) {
  const noms = etapes.map((e) => e.nom)
  const transition = (nom, vue) => transitionDuRun(journal, nom, vue)
  for (let tour = 0; tour <= etapes.length; tour += 1) {
    let relance = null
    for (const etape of etapes) {
      if (etape.dejaFaite(ctx, journal)) {
        // Une étape déjà faite s'ENREGISTRE, estampillée comme une étape jouée : sans cela, le journal
        // d'un run repris ne portait AUCUNE trace machine des étapes constatées, et `--etapes` les
        // rendait « à faire » après coup. Le détail précédent est CONSERVÉ : `file.dejaFaite` le
        // relit (`detail.fusion`), l'écraser referait attendre la file à chaque reprise.
        // Une étape DÉJÀ verte n'est pas une TRANSITION : ses bornes, son `run` et son `seq` tiennent,
        // la veille (`transitionsDuRun`) se tait ; toute autre devient une transition du run courant.
        const vu = journal.etapes[etape.nom]
        const detail = { ...(vu?.detail ?? {}), dejaFaite: true }
        if (vu?.etat === 'vert') journal.etapes[etape.nom] = { ...vu, detail, tete: ctx.tete ?? null }
        else {
          const instant = new Date().toISOString()
          transition(etape.nom, { etat: 'vert', debut: instant, fin: instant, detail, tete: ctx.tete ?? null, dit: 'déjà faite' })
        }
        sauver(journal)
        journaliser(`[publier] ${etape.nom} — déjà faite\n`)
        continue
      }
      journaliser(`[publier] ${etape.nom} — début\n`)
      const debut = Date.now()
      transition(etape.nom, {
        etat: 'en-vol',
        debut: new Date(debut).toISOString(),
        detail: journal.etapes[etape.nom]?.detail ?? null,
        tete: ctx.tete ?? null,
      })
      sauver(journal)
      const vu = etape.jouer(ctx, journal) ?? { ok: false, raison: 'aucun verdict rendu' }
      const secondes = (Date.now() - debut) / 1000
      transition(etape.nom, {
        etat: vu.ok ? 'vert' : vu.indetermine ? 'indéterminée' : 'rouge',
        debut: new Date(debut).toISOString(),
        fin: new Date().toISOString(),
        detail: vu.detail ?? null,
        tete: ctx.tete ?? null,
        dit: (vu.ok ? vu.dit : vu.raison) ?? null,
      })
      sauver(journal)
      if (vu.ok) {
        journaliser(`[publier] ${etape.nom} — vert (${secondes.toFixed(1)} s)${vu.dit ? ` : ${vu.dit}` : ''}\n`)
        if (vu.relancer) {
          relance = vu.relancer
          break
        }
        continue
      }
      if (vu.indetermine) {
        journaliser(`[publier] ${etape.nom} — INDÉTERMINÉE : ${vu.raison}\n`)
        return { etat: 'indeterminee', etape: etape.nom, raison: vu.raison }
      }
      journaliser(`[publier] ${etape.nom} — ROUGE : ${vu.raison}\n`)
      return { etat: 'rouge', etape: etape.nom, raison: vu.raison }
    }
    if (!relance) return { etat: 'vert' }
    for (const nom of relance) if (noms.includes(nom)) transition(nom, { etat: 'à faire', tete: null, dit: `relance depuis ${relance[0]}` })
    sauver(journal)
    journaliser(`[publier] relance du train depuis ${relance[0]}\n`)
  }
  return { etat: 'rouge', etape: 'moteur', raison: 'trop de relances du train' }
}

// ── Impur : le train réel ──────────────────────────────────────────────────────────────

/** Période de relecture du journal par la veille, en millisecondes (un fichier local). */
export const PERIODE_DE_VEILLE_MS = 5_000

/**
 * L'étape `en-vol` de plus haut `seq` du run de `journal`, `null` sans étape en vol. PURE.
 * @param {object|null} journal
 */
const etapeEnVol = (journal) => Object.entries(journal?.etapes ?? {})
  .filter(([, vue]) => vue?.etat === 'en-vol' && vue.run === journal.run && Number.isInteger(vue.seq))
  .sort(([, a], [, b]) => b.seq - a.seq)[0]?.[0] ?? null

/**
 * La MORT du run de `journal` sans verdict (#2493, verdict §2) : son pid ne vit plus, ou son étape `fin` en vol
 * dépasse la borne du synchroniseur (`TIMEOUT_SYNCHRONISEUR`) d'une minute. REND `{ pid, nom }` (`nom` =
 * l'étape en vol, `etapeEnVol`), `null` pour un run vivant, sans run ou déjà jugé. PURE hors de `vivant`.
 * @param {object|null} journal @param {{vivant?:(pid:number) => boolean, maintenant?:() => number}} [p]
 * @returns {{pid:number, nom:string|null}|null}
 */
export function mortDuRun(journal, { vivant: estVivant = estPidVivant, maintenant = Date.now } = {}) {
  if (!journal?.run || journal.verdict) return null
  const pid = journal.pid ?? pidDeRun(journal.run)
  const nom = etapeEnVol(journal)
  const debut = Date.parse(journal.etapes?.fin?.debut ?? '')
  const finEchue = nom === 'fin' && Number.isFinite(debut) && maintenant() - debut > TIMEOUT_SYNCHRONISEUR * 1000 + 60_000
  return !estVivant(pid) || finEchue ? { pid, nom } : null
}

/**
 * Le CONSTAT de la mort d'un run sans verdict (#2493, verdict §2), sous le verrou `<journal>.constat.verrou` :
 * le journal relu, rien s'il ne porte pas de run, un verdict, ou un run vivant (`mortDuRun`). Mort en `fin`,
 * la publication est faite : transition `fin` VERTE, `INTERROMPUE`, avec la mesure du principal sur la
 * fusion (`mesurer`). Mort ailleurs : transition ROUGE, verdict `rouge moteur`. Le verdict porte
 * `constat: { par, a }` ; journal et log écrits. REND le verdict, `null` sans constat.
 * @param {{chemins:{json:string, log:string}, par:string, vivant?:(pid:number) => boolean, maintenant?:() => number,
 *          mesurer?:(visee:string|null) => object}} p
 */
export function constaterLaMort({ chemins, par, vivant: estVivant = estPidVivant, maintenant = Date.now, mesurer = (visee) => mesurerPrincipal({ depuis: RACINE, visee }) }) {
  if (!existsSync(chemins.json)) return null
  const verrou = prendreVerrou({
    chemin: `${chemins.json}.constat.verrou`, libelle: 'constat de la mort du train', commande: par,
    attente: { echeanceMs: 10_000, pasMs: 100 },
  })
  if (verrou.etat !== 'pris') return null
  try {
    const journal = lireJournal(chemins.json, null)
    const mort = mortDuRun(journal, { vivant: estVivant, maintenant })
    if (!mort) return null
    const { pid, nom } = mort
    const a = new Date(maintenant()).toISOString()
    const constat = { par, a }
    const precedente = nom ? journal.etapes[nom] : {}
    let verdict
    let dit
    if (nom === 'fin') {
      const mesure = mesurer(journal.etapes.file?.detail?.fusion ?? null)
      dit = `INTERROMPUE : train ${pid} mort sans verdict (constat : ${par}, ${a}) ; principal ${ligneDeLEtat(mesure)}`
      transitionDuRun(journal, nom, { ...precedente, etat: 'vert', fin: a, dit })
      verdict = { etat: 'vert', constat }
    } else {
      const raison = `train ${pid} mort pendant ${nom ?? 'son entame'} (constat : ${par}, ${a})`
      dit = `INTERROMPUE : ${raison}`
      if (nom) transitionDuRun(journal, nom, { ...precedente, etat: 'rouge', fin: a, dit })
      verdict = { etat: 'rouge', etape: 'moteur', raison, constat }
    }
    journal.verdict = verdict
    ecrireJsonAtomique(chemins.json, journal)
    appendFileSync(chemins.log, `[publier] ${nom ?? 'moteur'} — ${dit}\n${ligneDePublication(verdict, journal.tete)}\n`)
    return verdict
  } finally {
    verrou.liberer()
  }
}

/**
 * La VEILLE d'un run (`--veiller <run>`) : sa première ligne nomme son PID, le run et le `journal` ; elle relit
 * le JOURNAL toutes les `periodeMs`, émet une ligne par transition du run courant (`transitionsDuRun`), puis
 * sa ligne `PUBLICATION:` et sort sur son code (`codeDeVerdict`). Tant que le journal porte un autre run
 * (course d'ouverture : le run d'avant), elle se tait. Ré-armée (`depuis` = le dernier `#seq` lu), elle ne
 * ré-émet aucune transition ; `constat` (`--constat`, après la sortie d'une veille) part de la dernière
 * transition du journal. Le run mort sans verdict (`mortDuRun`) est CONSTATÉ (`constater`, qui l'écrit au
 * journal), puis relu ; un train mort avant d'écrire son run au journal, relu une fois, sort en
 * `CODE_ARRET_MOTEUR`. La borne (`borneDeVeilleMin` de la borne de file du run, ou de `fileTimeoutMin` tant
 * qu'il n'a rien écrit), comptée depuis le LANCEMENT du run (`runDe`), jamais depuis le départ de la veille,
 * passée sans verdict sort en `CODE_BORNE_DEPASSEE`.
 * @param {{run:string, fileTimeoutMin:number, lire:() => object|null, ecrire:(ligne:string) => void,
 *          constater?:() => object|null, depuis?:number, constat?:boolean, journal?:string, pid?:number,
 *          vivant?:(pid:number) => boolean, maintenant?:() => number, dormir?:(ms:number) => void, periodeMs?:number}} p
 * @returns {number} code de sortie
 */
export function veillerLeTrain({
  run,
  fileTimeoutMin,
  lire,
  ecrire,
  constater = () => null,
  depuis = 0,
  constat = false,
  journal: cheminDuJournal = '',
  pid: pidDeLaVeille = process.pid,
  vivant: estVivant = estPidVivant,
  maintenant = Date.now,
  dormir = attendreSync,
  periodeMs = PERIODE_DE_VEILLE_MS,
}) {
  const { pid, lancement } = runDe(run)
  ecrire(`[veille] PID ${pidDeLaVeille} veille le run ${run} (journal ${cheminDuJournal})`)
  let seq = depuis
  if (constat) {
    const lu = lire()
    if (lu?.run === run && Number.isInteger(lu.seq)) seq = Math.max(seq, lu.seq)
    ecrire(`[veille] constat du run ${run} après la sortie de sa veille`)
  }
  let borneMin = fileTimeoutMin
  let sansJournal = false
  for (;;) {
    const journal = lire()
    const vu = transitionsDuRun(journal, run, seq)
    for (const ligne of vu.lignes) ecrire(ligne)
    seq = vu.seq
    if (vu.courant && Number.isFinite(journal.fileTimeoutMin)) borneMin = journal.fileTimeoutMin
    if (vu.verdict) {
      ecrire(ligneDePublication(vu.verdict, journal.tete))
      return codeDeVerdict(vu.verdict)
    }
    if (vu.courant && mortDuRun(journal, { vivant: estVivant, maintenant }) && constater()) continue
    if (!vu.courant && !estVivant(pid)) {
      if (sansJournal) {
        const verdict = { etat: 'rouge', etape: 'moteur', raison: `train ${pid} mort avant d'écrire son run au journal` }
        ecrire(ligneDePublication(verdict))
        return codeDeVerdict(verdict)
      }
      sansJournal = true
      continue
    }
    const borneMs = borneDeVeilleMin(borneMin) * 60_000
    if (maintenant() - lancement >= borneMs) {
      ecrire(`[veille] borne de ${borneDeVeilleMin(borneMin)} min dépassée sans verdict du run ${run} — \`npm run ops:publier -- --etapes\``)
      return CODE_BORNE_DEPASSEE
    }
    dormir(periodeMs)
  }
}

/** Le dépôt du train dans `racine` : une panne de lecture y LÈVE `GitIndisponible`, et le train
 *  s'arrête ROUGE en la nommant (`main`) — lue `null`, elle passait pour un arbre propre ou pour
 *  l'absence d'un rebase entamé. */
const depotDuTrain = (racine) => depotDe(racine)

/** Chemins que l'état de l'arbre (`etatDeLArbre`) rend SALES, dédupliqués. @param {import('../guards/lib/gitPorte.mjs').Depot} depot */
const cheminsSales = (depot) => [...new Set(etatDeLArbre(depot).flatMap((e) => e.chemins).filter(Boolean))]

/**
 * Les QUESTIONS git des étapes, posées au dépôt `depot` : le contexte les porte à la place de la
 * poignée, qui ouvrirait tout écrivain de l'hôte.
 * @param {import('../guards/lib/gitPorte.mjs').Depot} depot
 */
const questionsDuTrain = (depot) => Object.freeze({
  shaDe: (ref) => shaDe(depot, ref),
  brancheDe: () => brancheDe(depot),
  origineDe: () => origineDe(depot),
  rebaseEntame: () => rebaseEntame(depot),
  cheminsEnConflit: () => cheminsEnConflit(depot),
  combienDe: (revisions) => combienDe(depot, revisions),
  estAncetre: (ancetre, descendant) => estAncetre(depot, ancetre, descendant),
  baseAuTronc: () => baseCommune(depot, TRONC.suivi, 'HEAD'),
  ceQuiChange: (avant, apres) => ceQuiChange(depot, avant, apres),
  cheminsSales: () => cheminsSales(depot),
  textesDe: (chemin) => ({ tete: lireEnLot(depot, 'HEAD', [chemin]).get(chemin) ?? null, disque: existsSync(join(depot.cwd, chemin)) ? readFileSync(join(depot.cwd, chemin), 'utf8') : null }),
  attributsDeFusion: (chemins) => attributsDe(depot, chemins, 'merge'),
  commitsDeLaPlage: (plage) => commitsDeLaPlage(plage, depot.cwd),
  verdictDesFusions: () => verdictDePublication(depot),
})

/** `gh <args>`, en union simple. Jamais `shell: true`. Un refus garde `stdout` : sous `--include`, un 4xx
 *  y porte son état et son corps (le corps HTTP). */
function gh(args, cwd, input) {
  const vu = spawnSync('gh', args, {
    cwd, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024, timeout: 120_000,
    stdio: [input === undefined ? 'ignore' : 'pipe', 'pipe', 'pipe'],
    ...(input === undefined ? {} : { input }),
  })
  if (vu.error) return { ok: false, raison: vu.error.message }
  if (vu.status !== 0) return { ok: false, raison: `gh a rendu ${vu.status} : ${String(vu.stderr ?? '').trim().slice(0, BORNE_RAISON)}`, stdout: String(vu.stdout ?? '') }
  return { ok: true, stdout: String(vu.stdout ?? '') }
}

/** La couture `appel(args, { input }) => { ok, stdout, raison }` que `scripts/guards/lib/ticketsGh.mjs`
 *  attend, adossée au `gh` du train — le seul enrobeur qui borne son spawn en TEMPS. */
const appelGh = (racine) => (args, { input } = {}) => gh(args, racine, input)

/** Les modes de `scripts/docs/build-all.mjs` que joue le train : l'étape `docs`, et les cibles de code
 *  après une fusion conclue sur les cibles pures. */
const MODES_DES_DOCS = Object.freeze(['--mixtes', '--code'])



/** Un sha COMPLET, sinon levée. */
function shaComplet(geste, sha) {
  if (typeof sha === 'string' && estShaComplet(sha)) return sha
  throw new Error(`ctx.${geste} : un sha COMPLET — refusé : ${JSON.stringify(sha)}`)
}

/**
 * Les PR de `branche`, réduites (`prDeRest`), récentes d'abord, en union `{ ok, prs }` / `{ ok:false,
 * raison }`. REST seul (#1804) : `GET /repos/{owner}/{repo}/pulls?head=`, puis `GET …/pulls/{n}` de
 * l'OUVERTE, seule lecture qui rend `mergeable_state`.
 */
function lirePr(racine, branche) {
  const proprietaire = DEPOT.split('/')[0]
  const vu = gh(['api', `repos/${DEPOT}/pulls?head=${encodeURIComponent(`${proprietaire}:${branche}`)}&state=all&per_page=10`], racine)
  if (!vu.ok) return vu
  try {
    const liste = JSON.parse(vu.stdout)
    if (!Array.isArray(liste)) return { ok: false, raison: 'réponse REST sans tableau de PR' }
    const ouverte = liste.find((pr) => pr?.state === 'open')
    if (!ouverte) return { ok: true, prs: liste.map(prDeRest) }
    const une = gh(['api', `repos/${DEPOT}/pulls/${ouverte.number}`], racine)
    if (!une.ok) return une
    const detail = JSON.parse(une.stdout)
    return { ok: true, prs: liste.map((pr) => prDeRest(pr.number === detail.number ? detail : pr)) }
  } catch (e) {
    return { ok: false, raison: e.message }
  }
}

/** Le numéro d'un ticket, sinon levée. */
function numeroDeTicket(geste, numero) {
  if ((typeof numero === 'string' || Number.isSafeInteger(numero)) && /^[1-9]\d*$/.test(String(numero))) return numero
  throw new Error(`ctx.${geste} : un NUMÉRO de ticket — refusé : ${JSON.stringify(numero)}`)
}

/**
 * Le contexte que les étapes partagent (`etapesDuTrain.mjs`) : le test de clôture
 * (`etapesDuTrain.test.mjs`) refuse au module des étapes toute liaison qui atteint un lancement de
 * processus, contre une retouche de bonne foi (résidu : #2073) : chaque processus d'une étape passe
 * par un geste d'ici. Écrivains nommés de l'hôte :
 * `commit`, `fusionner` (un message), `abandonnerFusion`, `conclureFusionSansCiblesPures` (des cibles pures
 * et un message), `pousser`, `tronc`. Hors git : `npm` (un NOM
 * de script), `docs` (un mode de `build-all.mjs`), `attendreReconstruction` (la reconstruction des dérivés de
 * l'arbre jusqu'à ses demandes courantes, `attendreLaReconstruction`), `coursesCi` (un sha), `coursesDeFile`, `parentsDe`
 * (un sha), `jobsEnEchec` (un id de course et son essai), `lirePr`, `ouvrirPr` (un titre et un corps), `demanderFusion` (un numéro de PR et
 * un sha), `lireTicket` (un numéro), `commenter` (un numéro et un corps) ; chacun valide ses arguments avant tout spawn.
 * Données : `generators` (`GENERATORS` de `build-all.mjs`), la table des dérivés que lit
 * `estDocDerive` ; `filtresDePush`, les
 * filtres `push.branches` de `ci.yml` (`branchesDePush`).
 */
export function contexteDe({ racine, branche, options, journaliser, fdLog, publication = null, maintenant = Date.now }) {
  const depot = depotDuTrain(racine)
  const stdio = ['ignore', fdLog, fdLog]
  const parentsVus = new Map()
  return {
    racine,
    questions: questionsDuTrain(depot),
    branche,
    publication,
    options,
    journaliser,
    fdLog,
    generators: GENERATORS,
    get filtresDePush() {
      return branchesDePush(texteDeCi({ cwd: racine }), `${DOSSIER}/${PORTE}`)
    },
    npm(script) {
      if (typeof script !== 'string' || !/^[\w:.-]+$/.test(script)) throw new Error(`ctx.npm : un NOM de script \`npm run\`, jamais une commande — refusé : ${JSON.stringify(script)}`)
      const { executable, args, shell } = lancementNpm(script, process.platform)
      return spawnSync(executable, args, { cwd: racine, stdio, shell })
    },
    docs(mode) {
      if (!MODES_DES_DOCS.includes(mode)) throw new Error(`ctx.docs : mode de build-all inconnu — ${JSON.stringify(mode)}`)
      const vu = spawnSync(process.execPath, [join(racine, 'scripts/docs/build-all.mjs'), mode], {
        cwd: racine, stdio: ['ignore', fdLog, 'pipe'], encoding: 'utf8', maxBuffer: 256 * 1024 * 1024,
      })
      if (vu.stderr) writeSync(fdLog, vu.stderr)
      return vu
    },
    attendreReconstruction: () => attendreLaReconstruction(racine, demandesDe(racine), { echeanceMs: TIMEOUT_DU_HOOK_MS }),
    coursesCi(sha) {
      return coursesCi({ cwd: racine, commit: shaComplet('coursesCi', sha), limit: 30 })
    },
    coursesDeFile: () => coursesCi({ cwd: racine, evenement: 'merge_group', limit: 30 }),
    /** Les parents d'un commit (`GET /repos/{owner}/{repo}/commits/{ref}`), mémorisés : un commit ne
     *  change jamais de parents. */
    parentsDe(sha) {
      const cle = shaComplet('parentsDe', sha)
      if (parentsVus.has(cle)) return parentsVus.get(cle)
      const vu = gh(['api', `repos/${DEPOT}/commits/${cle}`, '--jq', '[.parents[].sha]'], racine)
      if (!vu.ok) return vu
      try {
        const parents = JSON.parse(vu.stdout)
        if (!Array.isArray(parents)) return { ok: false, raison: 'réponse REST sans tableau de parents' }
        const lu = { ok: true, parents }
        parentsVus.set(cle, lu)
        return lu
      } catch (e) {
        return { ok: false, raison: e.message }
      }
    },
    jobsEnEchec(id, attempt = null) {
      if (!Number.isSafeInteger(id) || id <= 0) throw new Error(`ctx.jobsEnEchec : un id de course — refusé : ${JSON.stringify(id)}`)
      if (attempt !== null && !(Number.isSafeInteger(attempt) && attempt > 0)) throw new Error(`ctx.jobsEnEchec : un essai de course — refusé : ${JSON.stringify(attempt)}`)
      return jobsEnEchecDe({ cwd: racine, id, attempt })
    },
    lirePr: () => lirePr(racine, branche),
    ouvrirPr({ titre, corps }) {
      if (typeof titre !== 'string' || !titre.trim() || typeof corps !== 'string') throw new Error(`ctx.ouvrirPr : un TITRE et un corps — refusé : ${JSON.stringify({ titre, corps })}`)
      return gh(['api', '-X', 'POST', `repos/${DEPOT}/pulls`, '-f', `title=${titre}`, '-f', `head=${branche}`, '-f', `base=${TRONC.nom}`, '-f', `body=${corps}`], racine)
    },
    demanderFusion({ numero, sha } = {}) {
      numeroDeTicket('demanderFusion', numero)
      return fusionDePr({ depot: DEPOT, numero, sha: shaComplet('demanderFusion', sha), appel: appelGh(racine), maintenant, journaliser })
    },
    etatFileDePr({ numero, sha } = {}) {
      numeroDeTicket('etatFileDePr', numero)
      return etatFileDePr({ depot: DEPOT, numero, sha: shaComplet('etatFileDePr', sha), appel: appelGh(racine), maintenant })
    },
    lireTicket: (numero) => lireTicket({ depot: DEPOT, numero: numeroDeTicket('lireTicket', numero), appel: appelGh(racine) }),
    commenter(numero, corps) {
      numeroDeTicket('commenter', numero)
      if (typeof corps !== 'string' || !corps.trim()) throw new Error(`ctx.commenter : un CORPS de commentaire — refusé : ${JSON.stringify(corps)}`)
      return poserCommentaire({ depot: DEPOT, numero, corps, appel: appelGh(racine) })
    },
    get tete() {
      return shaDe(depot, 'HEAD')
    },
    /**
     * Le TRONC distant, fetché puis relu — la seule porte d'`origin/main` des étapes qui doivent le
     * mesurer À CHAUD (`push`), donc le seul point d'injection en test.
     * @returns {{disponible:true, sha:string|null}|import('../guards/lib/gitPorte.mjs').EchecGit}
     */
    tronc() {
      const vu = fetchOrigin(depot)
      if (!vu.disponible) return vu
      if (!reussi(vu)) return indisponible(`git fetch refusé (status ${(vu.diagnostic ?? vu.valeur)?.status ?? '?'})`, { issue: 'refus', diagnostic: vu.diagnostic ?? vu.valeur })
      return { disponible: true, sha: shaDe(depot, TRONC.suivi) }
    },
    commit: ({ message, chemins }) => commitDe(depot, { message, chemins }),
    fusionner({ message, de = TRONC.suivi }) {
      if (typeof message !== 'string' || !message.trim()) throw new Error(`ctx.fusionner : un MESSAGE — refusé : ${JSON.stringify(message)}`)
      if (de !== TRONC.suivi && !(estShaComplet(de) && de === publication?.rattraper))
        throw new Error(`ctx.fusionner : cible hors de la publication — ${JSON.stringify(de)}`)
      return fusionner(depot, { de, message })
    },
    abandonnerFusion: () => abandonnerFusion(depot),
    // #2203
    conclureFusionSansCiblesPures({ chemins, message }) {
      if (typeof message !== 'string' || !message.trim()) throw new Error(`ctx.conclureFusionSansCiblesPures : un MESSAGE — refusé : ${JSON.stringify(message)}`)
      const autres = (chemins ?? []).filter((c) => !estCiblePure(c, GENERATORS))
      if (!chemins?.length || autres.length) throw new Error(`ctx.conclureFusionSansCiblesPures : des cibles PURES seulement — refusé : ${JSON.stringify(autres)}`)
      return conclureFusionSansChemins(depot, { chemins, message })
    },
    pousser: ({ vers, bail }) => pousser(depot, { vers, bail }),
    /** La synchronisation du principal (`scripts/ops/synchroniser.mjs --json`, #2187) en processus neuf :
     *  `{ ok: true, vu, ligne }` (l'état rendu et sa `ligneDeLEtat`), ou, sans état lisible, `{ ok: false,
     *  raison, mesure, ligne }` : la cause et la RE-MESURE du principal (`mesurerPrincipal`) contre `visee`,
     *  un sha complet ou `null` (#2493). */
    synchroniserPrincipal({ visee = null } = {}) {
      const cible = visee === null ? null : shaComplet('synchroniserPrincipal', visee)
      const vu = spawnSync(process.execPath, [join(racine, 'scripts/ops/synchroniser.mjs'), '--json'], {
        cwd: racine, stdio: ['ignore', 'pipe', fdLog], encoding: 'utf8', timeout: TIMEOUT_SYNCHRONISEUR * 1000,
      })
      try {
        const lu = JSON.parse(vu.stdout)
        return { ok: true, vu: lu, ligne: ligneDeLEtat(lu) }
      } catch {
        const cause = vu.error?.message ?? `code ${vu.status}${vu.signal ? ` signal ${vu.signal}` : ''}`
        const mesure = mesurerPrincipal({ depuis: racine, visee: cible })
        return { ok: false, raison: cause, mesure, ligne: `synchroniseur sorti sans état (${cause}) ; re-mesure : ${ligneDeLEtat(mesure)}` }
      }
    },
  }
}

async function main() {
  const options = optionsDe(process.argv.slice(2))
  if (options.inconnus.length) {
    process.stderr.write(`[publier] option inconnue : ${options.inconnus.join(' ')}\n  usage : node scripts/ops/publier.mjs [--detache] [--reprendre] [--etapes] [--file-timeout-min <n>] [--veiller <run> [--depuis <seq>] [--constat]]\n`)
    process.exit(1)
  }
  const depot = depotDuTrain(RACINE)
  const toplevel = racineDe(depot)
  if (!toplevel || resolve(toplevel) !== resolve(RACINE)) {
    process.stderr.write(`[publier] REFUS : ${RACINE} n'est pas la racine de son dépôt (git dit ${toplevel ?? 'rien'})\n`)
    process.exit(1)
  }
  const publication = publicationDe(process.env, RACINE)
  const branche = publication?.branche ?? brancheDe(depot) ?? 'HEAD'
  const chemins = cheminsDeJournal(publication?.source ?? RACINE, branche)
  mkdirSync(chemins.dossier, { recursive: true })
  const surDisque = existsSync(chemins.json) ? lireJournal(chemins.json, branche) : null
  // #2493 : le run mort sans verdict est constaté AVANT tout mode, et avant la rotation du log (`ouvrirLog`).
  if (surDisque) constaterLaMort({ chemins, par: `publier ${process.argv.slice(2).join(' ') || '(train)'} ${process.pid}` })

  if (options.veiller) {
    return veillerLeTrain({
      run: options.veiller,
      fileTimeoutMin: options.fileTimeoutMin,
      depuis: options.depuis,
      constat: options.constat,
      journal: chemins.json,
      lire: () => lireJournal(chemins.json, branche),
      ecrire: (ligne) => process.stdout.write(`${ligne}\n`),
      constater: () => constaterLaMort({ chemins, par: `veille ${process.pid}` }),
    })
  }

  // La TÊTE VIVANTE : la seule contre laquelle une étape verte se juge (`planDeReprise`).
  const teteVivante = shaDe(depot, 'HEAD')

  if (options.etapes) {
    const journal = surDisque ?? journalVide(branche)
    const train = etatDuTrain(journal, { teteVivante })
    process.stdout.write(
      `publication ${branche} — journal ${chemins.json}\n` +
        `base=${journal.base ?? '—'} tete=${journal.tete ?? '—'} (publiée) · HEAD=${teteVivante ?? '—'} (vivante) ejections=${journal.ejections ?? 0} run=${train.run ?? '—'}\n` +
        `train : ${train.etat}${train.etape ? ` — ${train.etape} ${train.rang}/${train.total}` : ''}\n` +
        train.etapes.map((e) => `  ${e.nom.padEnd(10)} ${e.etat}`).join('\n') +
        `\nreprise : ${train.reprise ?? 'rien à jouer (tout est vert pour cette tête)'}\n`,
    )
    return 0
  }

  if (!publication) throw new Error('train de publication sans snapshot validé')

  const enfant = process.env.WFRP_PUBLIER_ENFANT === '1'
  const fdLog = ouvrirLog(chemins.log, modeDuLog({ reprendre: options.reprendre, enfant }))
  const journaliser = (texte) => {
    writeSync(fdLog, texte)
    if (!enfant) process.stderr.write(texte)
  }
  const ctx = contexteDe({ racine: RACINE, branche, options, journaliser, fdLog, publication })
  const { journal, repris, vertes } = journalInitial({ reprendre: options.reprendre, lu: surDisque, branche })
  const lancement = lancementDe(process.env)
  entameDuRun(journal, { run: idDeRun({ pid: publication?.pid ?? process.pid, lancement }), pid: process.pid, fileTimeoutMin: options.fileTimeoutMin })
  ecrireJsonAtomique(chemins.json, journal)
  journaliser(`[publier] ${new Date().toISOString()} — branche ${branche}${options.reprendre ? ' (--reprendre)' : ''}\n`)
  journaliser(`[publier] ${repris ? `journal repris (${vertes} étape(s) verte(s))` : 'journal neuf'}\n`)
  let verdict
  try {
    if (repris) {
      const reprise = planDeReprise(journal, ETAPES.map((e) => e.nom), ctx.tete)
      journaliser(`[publier] reprise : ${reprise ?? 'rien à jouer (tout est vert pour cette tête)'}\n`)
    }
    verdict = jouerLeTrain(ctx, ETAPES, journal, { sauver: (j) => ecrireJsonAtomique(chemins.json, j), journaliser })
  } catch (e) {
    verdict = { etat: 'rouge', etape: 'moteur', raison: e instanceof GitIndisponible ? refusDeGit(e) : `ARRÊT INATTENDU : ${e?.stack ?? e}` }
    if (e instanceof GitIndisponible) journaliser(`${verdict.raison}\n`)
  }
  journal.verdict = verdict
  if (journal.publication && journal.etapes['push-branche']?.etat === 'vert')
    journal.publication.publie = journal.etapes['push-branche'].tete
  ecrireJsonAtomique(chemins.json, journal)
  journaliser(`${ligneDePublication(verdict, journal.tete)}\n`)
  closeSync(fdLog)
  return codeDeVerdict(verdict)
}

/**
 * `main`, dont une panne de git AVANT le train (racine, branche, tête vivante) sort en ligne finale
 * NOMMÉE — au log de l'enfant détaché, sur stderr sinon —, jamais en pile brute.
 * @returns {number}
 */
export async function executerPublication() {
  try {
    return await main()
  } catch (e) {
    const verdict = { etat: 'rouge', etape: 'moteur', raison: e instanceof GitIndisponible ? refusDeGit(e) : String(e?.message ?? e) }
    const ligne = `${verdict.raison}\n${ligneDePublication(verdict)}\n`
    if (process.env.WFRP_PUBLIER_ENFANT === '1' && process.env.WFRP_PUBLIER_LOG) appendFileSync(process.env.WFRP_PUBLIER_LOG, ligne)
    else process.stderr.write(ligne)
    return codeDeVerdict(verdict)
  }
}

if (import.meta.main) process.exit(await executerPublication())
