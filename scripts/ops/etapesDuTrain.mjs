// LES ÉTAPES DU TRAIN DE PUBLICATION (`scripts/ops/publier.mjs`) et les purs qu'elles composent.
//
// CLÔTURE, gardée contre une retouche de bonne foi (#1806) : une étape ne tient que son contexte
// (`contexteDe`, `publier.mjs`), qui porte des QUESTIONS (`questionsDuTrain`) et des gestes NOMMÉS aux
// arguments validés (`commit` → `commitDe`, `fusionner`, `abandonnerFusion`, `conclureFusionSansCiblesPures`,
// `pousser`, `tronc`, `npm`,
// `docs`, `coursesCi`, `coursesDeFile`, `parentsDe`, `jobsEnEchec`, `lirePr`, `ouvrirPr`, `demanderFusion`,
// `lireFusion`, `lireTicket`, `commenter`). Le test de clôture (`etapesDuTrain.test.mjs`) refuse
// à ce module toute liaison, importée de n'importe quel module de sa clôture, qui atteint un lancement
// de processus par l'une des SOURCES de capacité de sa table : import d'un module intégré hors de ses
// inertes, import d'un paquet, import d'un module du dépôt qui l'exporte lanceuse ou n'est pas lu,
// import dynamique ou `require`, `createRequire`/`getBuiltinModule`/`binding`, accès ambiant (global
// lu hors de ses inertes), évaluation ; `import.meta` est inerte. Résidu que le test ne garde pas :
// évaluation par `.constructor`, état mutable posé par un autre module, effet au chargement d'un
// module de la clôture (#2073).
import { TRONC, reussi, urlOrigineAcceptee } from '../guards/lib/gitPorte.mjs'
import { corpsDePr } from '../guards/lib/fusionPr.mjs'
import { ANNULEE, ROUGES } from '../guards/lib/coursesCi.mjs'
import { numerosCites, numerosFermes } from '../guards/lib/fermetures.mjs'
import { DEPOT } from '../guards/lib/ticketsGh.mjs'
import { refusDeSujet } from '../guards/lib/sujetDeCommit.mjs'
import { marqueDe } from '../guards/lib/plageFermante.mjs'
import { estCiblePure, perimetreDesMixtes } from '../docs/build-all.mjs'
import { MANAGED_ROOTS } from '../agents/compat-core.mjs'
import { sourcesMesurees, touchesDocSources } from '../git-hooks/docs-rebuild.mjs'
import { resoudreOutilLocal } from '../lancer-local.mjs'
import { correspondGlob } from '../guards/lib/lister.mjs'
import { coupeAuMot } from '../../src/lib/coupeAuMot.mjs'

/** Période des sondes de la PR et des courses, en millisecondes. */
export const PERIODE_SONDE_MS = 30_000

/** Nom du workflow que la sonde reconnaît (`.github/workflows/ci.yml`, `name: CI`). */
export const WORKFLOW = 'CI'

/** Éjections de la file qu'un lot reprend (FUSION d'`origin/main`, `docs`, push, nouvelle demande de
 *  fusion) avant de rendre la main : au-delà, la cause n'est pas le tronc. */
export const BORNE_EJECTIONS = 1

/** Marque d'IDEMPOTENCE du pilotage : elle porte le commit de fusion publié. */
export const marquePublication = (sha) => `<!-- publier: ${sha} -->`

/** Titre de la PR d'une branche : aucun mot fermant (`closing keywords`), la fermeture appartient au
 *  workflow `fermetures.yml`. */
export const titreDePr = (branche) => `publication ${branche}`


// ── Purs : verdicts et mise en forme ───────────────────────────────────────────────────

/**
 * Verdict de la CI pour un sha, lu dans les courses TRIÉES (`coursesCi` trie `createdAt`
 * décroissant). PUR. Une conclusion inconnue n'est PAS verte : elle rougit, et se nomme.
 * @returns {{etat:'absente'|'en-vol'|'verte'|'rouge'|'annulee', course?:object}}
 */
export function verdictDesRuns(courses, sha, { workflow = WORKFLOW } = {}) {
  const notres = (courses ?? []).filter(
    (c) => String(c?.headSha ?? '') === String(sha) && (!c?.workflowName || String(c.workflowName) === workflow),
  )
  if (!notres.length) return { etat: 'absente' }
  const course = notres[0]
  if (String(course.status ?? 'completed') !== 'completed') return { etat: 'en-vol', course }
  const conclusion = String(course.conclusion ?? '')
  if (conclusion === ANNULEE) return { etat: 'annulee', course }
  if (conclusion === 'success') return { etat: 'verte', course }
  // `ROUGES` nomme les trois échecs connus ; toute AUTRE conclusion (`neutral`, `skipped`, une
  // valeur neuve de GitHub) n'est pas verte non plus — elle rougit, et le journal la porte.
  return { etat: 'rouge', course, inattendue: !ROUGES.has(conclusion) }
}

/**
 * Le verdict d'une course `rouge` (`verdictDesRuns`) jugé sur ses JOBS (`jobsEnEchecDe`). PUR. Une course
 * conclue en échec dont AUCUN job n'est rouge et dont un job au moins est annulé (panne d'Actions) est
 * `annulee` : personne n'a jugé ce contenu, le geste est une relance. Sans job rouge ni annulé, elle reste
 * `rouge`, marquée `sansJobEnEchec`, pour que son lecteur le dise. Tout autre verdict passe tel quel.
 * @param {{etat:string, course?:object}} verdict @param {{rouges:string[], annules:string[]}} jobs
 * @returns {{etat:string, course?:object, rouges:string[], annules:string[], sansJobEnEchec?:true}}
 */
export function verdictDesJobs(verdict, { rouges, annules }) {
  if (verdict.etat !== 'rouge' || rouges.length) return { ...verdict, rouges, annules }
  return annules.length ? { ...verdict, etat: 'annulee', rouges, annules } : { ...verdict, rouges, annules, sansJobEnEchec: true }
}

/** Ce que disent les jobs d'un verdict jugé (`verdictDesJobs`), en une phrase. PUR. */
export function phraseDesJobs({ rouges, annules, sansJobEnEchec }) {
  if (sansJobEnEchec) return 'aucun job rouge ni annulé dans la course'
  return [rouges.length ? `jobs rouges : ${rouges.join(', ')}` : '', annules.length ? `jobs annulés : ${annules.join(', ')}` : ''].filter(Boolean).join(' ; ')
}

/**
 * Le refus d'une branche qu'aucun filtre `push.branches` de `ci.yml` (`branchesDePush`,
 * scripts/gates/workflowsDuDepot.mjs) ne déclenche, ou `null`. PUR. Sans course de branche, l'étape
 * `file` attendrait jusqu'à sa borne. `filtres === null` : un `push` sans filtre de branche.
 * @param {string} branche @param {string[]|null} filtres @returns {string|null}
 */
export function refusDeBranche(branche, filtres) {
  if (filtres === null || filtres.some((f) => correspondGlob(branche, f))) return null
  return `la branche ${branche} ne déclenche pas \`ci.yml\` (push.branches : ${filtres.join(', ') || 'aucun `push`'}) : aucune course de branche, la file ne l’accepterait pas — publier depuis une branche qu’un de ces filtres nomme`
}

/** Préfixe de la ref d'une entrée de file de la PR `numero` : `gh-readonly-queue/main/pr-<N>-<sha>`
 *  (managing-a-merge-queue.md, « temporary branches ... with a special prefix »). */
export const prefixeDeFile = (numero) => `gh-readonly-queue/${TRONC.nom}/pr-${numero}-`

/**
 * La course de file la plus récente de la PR `numero` sur la tête `tete`, ou `null`. `courses`
 * triées ; `parentsDe(sha)` rend `{ok, parents}`. Méthode MERGE (scripts/ops/ruleset-main.mjs) : le
 * commit de file de la tête a `tete` pour parent — la course d'une entrée antérieure de la même PR,
 * éjectée, n'est pas celle de la tête.
 */
export const courseDeFile = (courses, numero, { tete, parentsDe }) =>
  (courses ?? []).find((c) => {
    if (!String(c?.headBranch ?? '').startsWith(prefixeDeFile(numero))) return false
    const vu = parentsDe(String(c.headSha ?? ''))
    return vu.ok && vu.parents.includes(tete)
  }) ?? null

/**
 * Une PR de l'API REST (`GET /repos/{owner}/{repo}/pulls`), réduite à ce que le train lit. PUR.
 * `mergeable_state` n'est rendu que par la lecture d'UNE PR (`GET …/pulls/{n}`).
 * @returns {{numero:number, etat:'ouverte'|'fusionnee'|'fermee', tete:string,
 *   fusion:string|null, conflit:boolean}}
 */
export const prDeRest = (p) => ({
  numero: p.number,
  etat: p.merged_at ? 'fusionnee' : p.state === 'open' ? 'ouverte' : 'fermee',
  tete: p.head?.sha ?? null,
  fusion: p.merged_at ? p.merge_commit_sha ?? null : null,
  conflit: p.mergeable_state === 'dirty',
})

/**
 * La PR d'une branche parmi ses PR réduites (`prDeRest`, récentes d'abord) : l'OUVERTE, sinon la
 * FUSIONNÉE dont la tête est `tete`. PUR.
 * @returns {object|null}
 */
export function prDeLaBranche(prs, tete) {
  const liste = prs ?? []
  return liste.find((p) => p?.etat === 'ouverte')
    ?? liste.find((p) => p?.etat === 'fusionnee' && p?.tete === tete)
    ?? null
}

/**
 * Où en est la PR `pr` de la tête `tete`. PUR. L'appartenance à la file n'est exposée qu'en GraphQL
 * (#1804) : une PR `ouverte` sur la tête est jugée par la demande de fusion de l'étape `file`.
 * @returns {'fusionnee'|'absente'|'tete-changee'|'ouverte'}
 */
export function etatDeLaPr(pr, tete) {
  if (!pr) return 'absente'
  if (pr.etat === 'fusionnee') return 'fusionnee'
  if (pr.tete !== tete) return 'tete-changee'
  return 'ouverte'
}

/**
 * Ce chemin est-il DÉRIVÉ, donc committable par l'étape `docs` ? Deux familles, toutes deux déclarées
 * ailleurs : les `injecte` des `generators` (`GENERATORS` de `build-all.mjs`, porté par le contexte du
 * train, `ctx.generators`) hors cibles PURES (`estCiblePure`) — les MIXTES, seuls dérivés de docs
 * commités (#2203) —, et les sorties de `npm run agents:sync` (le pre-commit joue `agents:check` à
 * chaque commit). PURE.
 */
export function estDocDerive(chemin, generators, { racinesAgents = MANAGED_ROOTS } = {}) {
  const c = String(chemin ?? '').replace(/\\/g, '/')
  if (!c) return false
  if (racinesAgents.some((r) => c === r || c.startsWith(`${r}/`))) return true
  return !estCiblePure(c, generators) && generators.some((g) => (g.injecte ?? []).some((motif) => correspondGlob(c, motif)))
}

/**
 * Partage des chemins SALES en deux tas : ce que l'étape `docs` sait committer (`estDocDerive`) et
 * le reste. PURE. Mesuré (2026-09-14, premier train réel) : après un rebase MANUEL, le hook
 * `post-rewrite` régénère les docs dérivés SANS les committer (`scripts/git-hooks/docs-rebuild.mjs`)
 * — sans ce partage, la préflight refusait le train pour une saleté que l'étape `docs` commet.
 * @param {string[]} chemins @param {readonly object[]} generators
 * @returns {{derives:string[], manuscrits:string[]}}
 */
export function partitionSales(chemins, generators, ...reste) {
  const derives = []
  const manuscrits = []
  for (const c of chemins ?? []) (estDocDerive(c, generators, ...reste) ? derives : manuscrits).push(c)
  return { derives, manuscrits }
}

/** Motif du commit de dérivés de l'étape `docs` — ceux que la régénération du train vient d'écrire. */
export const MOTIF_REGENERATION = 'docs dérivés régénérés par le train de publication'

/** Motif de la fusion d'`origin/main` qui reprend une PR éjectée de la file. */
export const MOTIF_EJECTION = 'fusion d’origin/main après éjection de la file de fusion'

/** Refus commun aux commits du train : sans `#N`, la porte de commit refuserait le message. */
export const REFUS_SANS_TICKET =
  'aucun `#N` cité par la plage : le commit du train n’aurait aucun ticket, et la porte de commit le refuse — cite un ticket dans un commit de la plage'

/** La PLAGE dont les `#N` légitiment un commit du train : les commits de la branche absents du tronc. */
export const PLAGE_DE_CITATIONS = `${TRONC.suivi}..HEAD`

/**
 * Message d'un commit du train (`chore(docs)` des dérivés, `chore(merge)` de la reprise). PURE — une
 * seule forme. Le SUJET tient la règle du dépôt (`scripts/guards/lib/sujetDeCommit.mjs`, mesurée ici
 * par `refusDeSujet`, jamais par un compte recopié) ; le MOTIF va au CORPS. Quand les `refs` d'une
 * plage chargée feraient déborder le sujet, elles descendent au corps : `numerosCites` lit le message
 * ENTIER (`scripts/guards/lib/fermetures.mjs:63`), corps compris.
 * @param {{portee:string, titre:string, numeros:string[], motif:string}} p
 */
export const messageDuTrain = ({ portee, titre, numeros, motif }) => {
  const refs = numeros.map((n) => `refs #${n}`).join(' ')
  const avecRefs = `${portee}: ${refs} — ${titre}\n\n${motif}\n`
  if (refs && refusDeSujet(avecRefs) === null) return avecRefs
  return `${portee}: ${titre}\n\n${motif}\n${refs ? `\n${refs}\n` : ''}`
}

/**
 * La FIN d'une sortie de commande — là où une porte imprime son verdict. PURE : les lignes `⛔` si
 * la sortie en porte, sinon ses `max` DERNIERS caractères.
 */
export const finDeSortie = (texte, max = 400) => {
  const t = String(texte ?? '').trim()
  const refus = t.split(/\r?\n/).filter((l) => l.includes('⛔'))
  if (refus.length) return refus.join('\n').slice(-max)
  return t.slice(-max)
}

/**
 * Ce que git a IMPRIMÉ dans une union de `scripts/guards/lib/gitPorte.mjs` : la `raison` d'une
 * indisponibilité, puis `stderr`, puis `stdout` — chaque morceau retenu sur son CONTENU, jamais par
 * un repli `??` (une chaîne vide n'est pas nullish : `classer` rend `{status, stdout, stderr:''}`
 * quand git n'écrit que sur stdout). PURE.
 * @param {object} vu union git @param {number} [max] borne de `finDeSortie`
 * @returns {string} '' quand git n'a rien imprimé
 */
export const sortieDe = (vu, max = 400) =>
  finDeSortie(
    [vu?.raison, vu?.valeur?.stderr, vu?.valeur?.stdout]
      .map((t) => String(t ?? '').trim())
      .filter(Boolean)
      .join('\n'),
    max,
  )

/** Ce que DIT un échec de git, jamais vide : sa sortie, ou son code de sortie nommé. PURE. */
export const refusDeGit = (vu, max = 400) => sortieDe(vu, max) || `(status ${vu?.valeur?.status ?? '?'}) — git n'a rien imprimé`

/** Première ligne d'un message de commit, coupée au mot vers `max` (`coupeAuMot`). PURE. */
export const titreDeCommit = (message, max = 120) => {
  const ligne = String(message ?? '').split('\n')[0].trim()
  return coupeAuMot(ligne, max)
}

/**
 * Corps du commentaire de pilotage d'UN ticket. PURE — la marque est TOUJOURS la dernière ligne.
 * @param {{numero:string, base:string, tete:string, fusion:string, commits:{sha:string,message:string}[],
 *   file:{pr?:number, attenteSecondes?:number},
 *   ferme:boolean, fermeParCi?:boolean, fermeAutrement?:boolean}} p
 */
export function corpsDePilotage({ numero, base, tete, fusion, commits, file, ferme, fermeParCi = false, fermeAutrement = false }) {
  const court = (sha) => String(sha ?? '').slice(0, 9)
  const lignes = [
    `## Publication ${court(fusion)}`,
    '',
    `Plage publiée : \`${court(base)} → ${court(tete)}\`, entrée sur \`main\` par le commit de file \`${court(fusion)}\`.`,
    '',
    `### Commits (${commits.length})`,
    ...commits.map((c) => `- \`${court(c.sha)}\` ${titreDeCommit(c.message)}`),
    '',
    '### File de fusion',
    file?.pr ? `- PR #${file.pr} : https://github.com/${DEPOT}/pull/${file.pr}` : '- PR non lue.',
  ]
  if (typeof file?.attenteSecondes === 'number')
    lignes.push(`- attente de la file : ${(file.attenteSecondes / 60).toFixed(1)} min (temps d’attente, pas de machine locale).`)
  lignes.push('')
  if (fermeAutrement) lignes.push(`#${numero} était déjà FERMÉ par un autre geste que cette publication.`)
  else if (fermeParCi) lignes.push(`#${numero} a été FERMÉ par la CI (job \`fermetures\`) sur cette publication.`)
  else if (ferme) lignes.push(`Ce commit FERME #${numero} : fermeture par le job \`fermetures\` de la CI.`)
  else lignes.push(`#${numero} est rattaché (\`refs\`) par cette publication, non fermé.`)
  lignes.push('', marquePublication(fusion))
  return `${lignes.join('\n')}\n`
}


/** Les `#N` cités par les commits de la branche absents du tronc, dédupliqués. */
function numerosDeLaPlage(questions) {
  return [...new Set(questions.commitsDeLaPlage(PLAGE_DE_CITATIONS).flatMap((c) => numerosCites(c.message)))]
}

/**
 * COMMIT des DÉRIVÉS de l'étape `docs` : stage des chemins EXPLICITES, message qui cite les tickets de
 * la plage, `journal.tete` avancé.
 * @param {object} ctx @param {{chemins:string[], numeros:string[], journal:object}} p
 * @returns {{ok:boolean, raison?:string, detail?:object, dit?:string}}
 */
function commettreDerives(ctx, { chemins, numeros, journal }) {
  const commit = ctx.commit({ message: messageDuTrain({ portee: 'chore(docs)', titre: 'docs dérivés', numeros, motif: MOTIF_REGENERATION }), chemins })
  if (!reussi(commit)) return { ok: false, raison: `\`git add\` puis \`git commit\` des docs ont échoué : ${refusDeGit(commit)}` }
  journal.tete = ctx.tete
  return { ok: true, detail: { chemins, numeros }, dit: `${chemins.length} doc(s) dérivé(s) commis — tête ${journal.tete.slice(0, 9)}` }
}


/** Attente BLOQUANTE sans busy-loop (le train est synchrone de bout en bout). */
export function attendre(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms)
}


/**
 * Remet les miroirs d'agents en phase AVANT le commit des dérivés, par la porte `ctx.npm`.
 * `agents:sync` se déclenche sur un `agents:check` ROUGE, jamais sur la saleté de `CLAUDE.md` : un
 * commit de la plage qui touche `.claude/skills/**` ou `.claude/credo.md` sans resynchroniser laisse
 * `agents:check` rouge au pre-commit, et le commit des docs échouerait sans nommer la cause.
 * @param {{npm: Function, journaliser: Function}} ctx
 * @returns {{ok: true} | {ok: false, raison: string}}
 */
export function synchroniserAgents(ctx) {
  const verif = ctx.npm('agents:check')
  if (verif.status === 0) return { ok: true }
  ctx.journaliser(`[publier] docs — \`agents:check\` rendu ${verif.status} : \`npm run agents:sync\`\n`)
  const sync = ctx.npm('agents:sync')
  if (sync.status !== 0)
    return { ok: false, raison: `\`npm run agents:sync\` a rendu ${sync.status} : le pre-commit jouerait \`agents:check\` et refuserait le commit` }
  return { ok: true }
}

/** Le refus nommé d'une course de BRANCHE rouge ou annulée sur la tête `tete` de la PR `pr`, ou `null` ; une
 *  course rouge se juge sur ses jobs (`verdictDesJobs`). */
function rougeDeBranche(ctx, pr, tete) {
  const vues = ctx.coursesCi(tete)
  const lu = vues.disponible ? verdictDesRuns(vues.valeur, tete) : null
  if (!lu || (lu.etat !== 'rouge' && lu.etat !== 'annulee')) return null
  const jobs = lu.etat === 'rouge' ? ctx.jobsEnEchec(lu.course.databaseId, lu.course.attempt) : null
  const ci = jobs?.disponible ? verdictDesJobs(lu, jobs.valeur) : lu
  const dit = jobs ? ` (${jobs.disponible ? phraseDesJobs(ci) : `jobs illisibles : ${jobs.raison}`})` : ''
  return `course CI ${ci.etat} de la branche sur ${tete.slice(0, 9)}${dit} — la PR #${pr.numero} n’entre pas dans la file : https://github.com/${DEPOT}/actions/runs/${ci.course.databaseId}`
}

/**
 * Une PR mise en file y est encore, ou en a été ÉJECTÉE. `merge-queue-reject.md` : « if there are
 * failed required status checks or conflicts with the base branch, the pull request will be removed
 * from the queue ». Un CONFLIT avec la base (`mergeable_state: dirty`), ou une course de file rouge
 * sur les seuls jobs des DÉRIVÉS (`ctx.jobsDesDerives`), se reprennent ; tout autre rouge se NOMME.
 * Sans course de file terminée rouge ni conflit, la PR est dans la file : on attend. Une course rouge
 * n'est ATTRIBUÉE à la PR que si `G^1`, le premier parent de son commit de file, est dans `origin/main` :
 * sinon elle juge un GROUPE dont une entrée précédente a pu casser, et GitHub reconstruit l'entrée
 * (`managing-a-merge-queue.md` l.104-109) — on attend.
 * @returns {{attendre:true, dit:string}|{reprendre:boolean, raison:string}}
 */
function causeDEjection(ctx, pr, tete) {
  const rouge = rougeDeBranche(ctx, pr, tete)
  if (rouge) return { reprendre: false, raison: rouge }
  if (pr.conflit) return { reprendre: true, raison: `PR #${pr.numero} en CONFLIT avec la base de la file` }
  const vues = ctx.coursesDeFile()
  if (!vues.disponible) return { attendre: true, dit: `courses de file illisibles : ${vues.raison}` }
  const course = courseDeFile(vues.valeur, pr.numero, { tete, parentsDe: ctx.parentsDe })
  const verdict = course ? verdictDesRuns([course], course.headSha) : null
  if (!verdict || !['rouge', 'annulee'].includes(verdict.etat)) return { attendre: true, dit: `course de file ${verdict?.etat ?? 'absente'}` }
  const url = `https://github.com/${DEPOT}/actions/runs/${course.databaseId}`
  const base = ctx.parentsDe(course.headSha).parents?.[0]
  const vuTronc = ctx.tronc()
  if (!vuTronc.disponible) return { attendre: true, dit: `course de file ${verdict.etat} ${url}, origin non consultable : ${vuTronc.raison}` }
  const dansLeTronc = base && vuTronc.sha ? ctx.questions.estAncetre(base, vuTronc.sha) : null
  if (!(dansLeTronc?.disponible && !dansLeTronc.absent && dansLeTronc.valeur))
    return { attendre: true, dit: `course de file ${verdict.etat} ${url} sur un groupe (G^1 ${String(base ?? '?').slice(0, 9)} hors d’${TRONC.suivi}) : GitHub reconstruit l’entrée` }
  const jobs = ctx.jobsEnEchec(course.databaseId, course.attempt)
  if (!jobs.disponible) return { reprendre: false, raison: `PR #${pr.numero} éjectée par la course ${url} ; jobs illisibles : ${jobs.raison}` }
  const juge = verdictDesJobs(verdict, jobs.valeur)
  const derives = new Set(ctx.jobsDesDerives)
  const reprendre = juge.etat === 'rouge' && juge.rouges.length > 0 && juge.rouges.every((j) => derives.has(j))
  return { reprendre, raison: `PR #${pr.numero} éjectée par la course ${url}${juge.etat === 'annulee' ? ' ANNULÉE' : ''} — ${phraseDesJobs(juge) || 'aucun job nommé'}` }
}

/**
 * Reprise BORNÉE d'une PR éjectée (#2178, design v3) : FUSION d'`origin/main` dans la branche — jamais
 * un rebase —, puis `docs`, `push-branche`, `pr` et `file` (nouvelle demande de fusion) se rejouent.
 * Un conflit dont TOUS les chemins sont des cibles PURES (`estCiblePure`) se conclut en les retirant
 * de l'index, puis les cibles de code se produisent (`post-merge` ne joue pas sur un `git commit`) ;
 * tout autre conflit abandonne la fusion.
 */
function reprendreApresEjection(ctx, journal, cause) {
  if ((journal.ejections ?? 0) >= BORNE_EJECTIONS)
    return { ok: false, raison: `${cause.raison} — éjectée une ${journal.ejections + 1}ᵉ fois, au-delà de la borne (${BORNE_EJECTIONS}) : la cause n’est pas le tronc` }
  const vuTronc = ctx.tronc()
  if (!vuTronc.disponible) return { ok: false, raison: `${cause.raison} — origin non consultable pour la reprise : ${vuTronc.raison}` }
  const numeros = numerosDeLaPlage(ctx.questions)
  if (!numeros.length) return { ok: false, raison: REFUS_SANS_TICKET }
  const message = messageDuTrain({ portee: 'chore(merge)', titre: `fusion de ${TRONC.suivi} dans ${ctx.branche}`, numeros, motif: MOTIF_EJECTION })
  const vu = ctx.fusionner({ message })
  if (!reussi(vu)) {
    // FOSSILE #2203 — mort quand aucune branche chantier/* n'a de merge-base antérieur à 64100b74a.
    const conflits = ctx.questions.cheminsEnConflit()
    const pures = conflits.length > 0 && conflits.every((c) => estCiblePure(c, ctx.generators))
    const conclue = pures ? ctx.conclureFusionSansCiblesPures({ chemins: conflits, message }) : null
    if (!conclue || !reussi(conclue)) {
      if (conflits.length) ctx.abandonnerFusion()
      return {
        ok: false,
        raison: `${cause.raison} — fusion de ${TRONC.suivi} REFUSÉE${conflits.length ? ` (CONFLIT, abandonnée) — fichiers :\n${conflits.map((f) => `    ${f}`).join('\n')}\n  → \`git merge ${TRONC.suivi}\` à la main, puis \`--reprendre\`` : ` : ${refusDeGit(vu)}`}${conclue ? `\n  retrait des cibles pures en échec : ${refusDeGit(conclue)}` : ''}`,
      }
    }
    const code = ctx.docs('--code')
    if (code.status !== 0)
      return { ok: false, raison: `${cause.raison} — fusion conclue, mais les cibles de code ne sont pas produites (\`npm run gen\` a rendu ${code.status ?? code.signal})${code.stderr ? `\n${finDeSortie(code.stderr)}` : ''}` }
  }
  journal.ejections = (journal.ejections ?? 0) + 1
  journal.tete = ctx.tete
  return {
    ok: true,
    relancer: ['docs', 'push-branche', 'pr', 'file'],
    dit: `${cause.raison} — ${TRONC.suivi} fusionné (tête ${journal.tete.slice(0, 9)}) : le train reprend à \`docs\``,
  }
}

/** La table des ÉTAPES : nom, `jouer(ctx, journal)`, `dejaFaite(ctx, journal)`. Ajouter une étape,
 *  c'est ajouter UNE entrée ici — rien d'autre. */
export const ETAPES = [
  {
    nom: 'preflight',
    // TOUJOURS rejouée : elle EST la garde. Elle pose la tête et, sur un lot neuf, la base du lot
    // (`merge-base origin/main HEAD`) que l'étape `docs` compare à la tête.
    dejaFaite: () => false,
    jouer(ctx, journal) {
      const { racine, questions } = ctx
      const entame = questions.rebaseEntame()
      if (entame)
        return { ok: false, raison: `rebase interrompu (${entame}) : \`git rebase --abort\` ou \`--continue\` à la main, puis \`--reprendre\`` }
      if (questions.brancheDe() === null)
        return { ok: false, raison: 'HEAD DÉTACHÉ : le train publie une branche, pas un sha errant' }
      let filtres
      try {
        filtres = ctx.filtresDePush
      } catch (e) {
        return { ok: false, raison: e.message }
      }
      const horsCi = refusDeBranche(ctx.branche, filtres)
      if (horsCi) return { ok: false, raison: horsCi }
      const { derives, manuscrits } = partitionSales(questions.cheminsSales(), ctx.generators)
      if (manuscrits.length)
        return {
          ok: false,
          raison:
            `arbre NON COMMITÉ (${manuscrits.length}) — on ne publie que du committé :\n` +
            `${manuscrits.map((s) => `    ${s}`).join('\n')}` +
            (derives.length ? `\n  (et ${derives.length} dérivé(s) sale(s) que l’étape docs aurait commis)` : ''),
        }
      const origine = questions.origineDe()
      if (!urlOrigineAcceptee(origine)) return { ok: false, raison: `origin étranger au dépôt : ${origine ?? 'illisible'}` }
      const vuFetch = ctx.tronc()
      if (!vuFetch.disponible) return { ok: false, raison: `origin non consultable : ${vuFetch.raison}` }
      // #2328 A3 : la résolution substantielle d'une fusion de la plage se juge avant la publication.
      const fusions = questions.verdictDesFusions()
      if (!fusions.ok) return { ok: false, raison: fusions.texte }
      const outil = resoudreOutilLocal(racine, 'vitest', 'vitest')
      if (outil.refus) return { ok: false, raison: outil.refus }
      // Une branche déjà fusionnée (étape `file` verte) n'a plus rien d'absent du tronc : sa reprise
      // rejoue le pilotage.
      if (!journal.etapes.file?.detail?.fusion && !questions.combienDe([PLAGE_DE_CITATIONS]))
        return { ok: false, raison: `rien à publier : ${PLAGE_DE_CITATIONS} est VIDE` }
      journal.base ??= questions.baseAuTronc()
      if (!journal.base) return { ok: false, raison: `aucune base commune entre ${TRONC.suivi} et HEAD` }
      journal.tete = ctx.tete
      const reste = derives.length
        ? `${derives.length} dérivé(s) sale(s) non commité(s) : l’étape docs les commet`
        : 'arbre propre'
      return {
        ok: true,
        detail: { derivesSales: derives, base: journal.base },
        dit: `${reste}, origin consultable, outillage local posé, base ${journal.base.slice(0, 9)}`,
      }
    },
  },
  {
    // Les MIXTES (`injecte` des `generators`) et les miroirs d'agents : régénérés, puis commis. Une
    // saleté de dérivés laissée par un hook (post-merge, post-rewrite) est commise ici aussi. Le train
    // ne régénère que ce qu'il commet : `--mixtes`, si la plage touche une source de `perimetreDesMixtes`
    // (#2193).
    nom: 'docs',
    // La tête ENREGISTRÉE sur l'étape, jamais `journal.tete` — celui-ci avance à la fusion d'une
    // reprise, et un `docs` vert d'avant serait alors sauté à tort ; un dérivé sali depuis la rejoue.
    dejaFaite(ctx, journal) {
      return journal.etapes.docs?.etat === 'vert' && journal.etapes.docs.tete === ctx.tete &&
        partitionSales(ctx.questions.cheminsSales(), ctx.generators).derives.length === 0
    },
    jouer(ctx, journal) {
      const { racine } = ctx
      const touches = ctx.questions.ceQuiChange(journal.base, journal.tete).chemins()
      // La saleté est lue AVANT toute décision de saut : `touchesDocSources` ne court-circuite que la
      // RÉGÉNÉRATION, jamais le COMMIT.
      const salesAvant = ctx.questions.cheminsSales()
      const seulement = perimetreDesMixtes(ctx.generators).map((g) => g.script)
      const regenerer = touchesDocSources(touches, sourcesMesurees(racine), { seulement })
      if (!regenerer && !salesAvant.length) return { ok: true, dit: 'aucune source de mixte dans la plage, arbre propre : docs inchangés' }
      if (regenerer) {
        const passe = ctx.docs('--mixtes')
        if (passe.status !== 0)
          return {
            ok: false,
            raison: `\`build-all --mixtes\` a rendu ${passe.status ?? passe.signal} : dérivés possiblement incohérents (rien n'a été staged ni commité)${passe.stderr ? `\n${finDeSortie(passe.stderr)}` : ''}`,
          }
      }
      const agents = synchroniserAgents(ctx)
      if (!agents.ok) return agents
      const chemins = ctx.questions.cheminsSales()
      const { manuscrits } = partitionSales(chemins, ctx.generators)
      if (manuscrits.length)
        return { ok: false, raison: `fichier MANUSCRIT sale après la régénération :\n${manuscrits.map((c) => `    ${c}`).join('\n')}` }
      if (!chemins.length) return { ok: true, dit: 'dérivés déjà à jour : rien à committer' }
      const numeros = numerosDeLaPlage(ctx.questions)
      if (!numeros.length) return { ok: false, raison: REFUS_SANS_TICKET }
      return commettreDerives(ctx, { chemins, numeros, journal })
    },
  },
  {
    // PUSH DE LA BRANCHE : il déclenche la CI de la tête, que la PR exige verte avant d'entrer dans la
    // file. `--force-with-lease` : il n'écrase que ce qu'on a lu (`pousser`, gitPorte.mjs).
    nom: 'push-branche',
    dejaFaite(ctx, journal) {
      if (!journal.tete) return false
      return ctx.questions.shaDe(`origin/${ctx.branche}`) === journal.tete
    },
    jouer(ctx, journal) {
      const vu = ctx.pousser({ vers: `refs/heads/${ctx.branche}`, bail: true })
      if (!reussi(vu))
        return { ok: false, raison: `push de la branche REFUSÉ :\n${refusDeGit(vu)}` }
      return { ok: true, dit: `${journal.tete.slice(0, 9)} poussé sur ${ctx.branche} — la CI de la branche juge` }
    },
  },
  {
    // LA PR vers `main`, créée si elle manque. Elle entre dans la file à l'étape `file`.
    nom: 'pr',
    dejaFaite(ctx, journal) {
      const vu = ctx.lirePr()
      return vu.ok && ['ouverte', 'fusionnee'].includes(etatDeLaPr(prDeLaBranche(vu.prs, journal.tete), journal.tete))
    },
    jouer(ctx, journal) {
      const lu = ctx.lirePr()
      if (!lu.ok) return { ok: false, raison: `PR de ${ctx.branche} illisible : ${lu.raison}` }
      let pr = prDeLaBranche(lu.prs, journal.tete)
      if (!pr) {
        const ouverte = ctx.ouvrirPr({
          titre: titreDePr(ctx.branche),
          corps: corpsDePr(journal.tete),
        })
        if (!ouverte.ok) return { ok: false, raison: `\`POST /repos/{owner}/{repo}/pulls\` REFUSÉ : ${ouverte.raison}` }
        const relu = ctx.lirePr()
        pr = relu.ok ? prDeLaBranche(relu.prs, journal.tete) : null
        if (!pr) return { ok: false, raison: `PR de ${ctx.branche} créée mais illisible${relu.ok ? '' : ` : ${relu.raison}`}` }
      }
      return { ok: true, detail: { pr: pr.numero }, dit: `PR #${pr.numero} ${pr.etat === 'fusionnee' ? 'déjà fusionnée' : `ouverte sur ${pr.tete?.slice(0, 9)}`}` }
    },
  },
  {
    // ATTENTE BORNÉE (`--file-timeout-min`), en trois temps : la course VERTE de la branche sur la tête
    // (managing-a-merge-queue.md : « Once a pull request has passed all required branch protection
    // checks, a user with write access to the repository can add the pull request to the queue »),
    // puis `PUT …/pulls/{n}/merge-async` sur cette tête (`merge_action: default` : la file si elle
    // est configurée, la fusion directe sinon), puis le suivi de la demande (`GET …/merge-async/{uuid}`)
    // et, mise en file, de la PR jusqu'à sa fusion. Le serveur sérialise : aucun rebase, aucun
    // fast-forward client. Une éjection se NOMME, et se reprend une fois (`reprendreApresEjection`)
    // quand sa cause est le tronc. Le temps passé ici est du temps d'ATTENTE (`attenteSecondes`).
    nom: 'file',
    dejaFaite(ctx, journal) {
      const vue = journal.etapes.file
      return vue?.etat === 'vert' && vue.tete === ctx.tete && Boolean(vue.detail?.fusion)
    },
    jouer(ctx, journal) {
      const debut = Date.now()
      const fin = debut + ctx.options.fileTimeoutMin * 60_000
      const attendu = (v) => ({ ...v, detail: { ...(v.detail ?? {}), attenteSecondes: (Date.now() - debut) / 1000 } })
      const fusionnee = (pr, fusion) =>
        attendu({ ok: true, detail: { pr: pr.numero, fusion }, dit: `PR #${pr.numero} fusionnée en ${String(fusion ?? '?').slice(0, 9)}` })
      // `null` : aucune demande ; `{uuid}` : demande PENDANTE ; `{enFile:true}` : PR mise en file.
      let demande = null
      const patienter = () => attendre(Math.max(0, Math.min(PERIODE_SONDE_MS, fin - Date.now())))
      while (Date.now() < fin) {
        const lu = ctx.lirePr()
        if (!lu.ok) ctx.journaliser(`[publier] file — PR illisible : ${lu.raison}\n`)
        else {
          const pr = prDeLaBranche(lu.prs, journal.tete)
          const etat = etatDeLaPr(pr, journal.tete)
          ctx.journaliser(`[publier] file — ${etat}${pr ? ` (PR #${pr.numero})` : ''}\n`)
          if (etat === 'fusionnee') return fusionnee(pr, pr.fusion)
          if (etat === 'absente') return attendu({ ok: false, raison: `aucune PR ouverte ni fusionnée pour ${ctx.branche} à ${journal.tete.slice(0, 9)}` })
          if (etat === 'tete-changee') {
            const avant = ctx.questions.estAncetre(pr.tete, journal.tete)
            if (!(avant.disponible && !avant.absent && avant.valeur))
              return attendu({ ok: false, raison: `la PR #${pr.numero} porte ${String(pr.tete).slice(0, 9)}, pas la tête publiée ${journal.tete.slice(0, 9)} : un push hors du train — relancer \`npm run ops:publier\`` })
            ctx.journaliser(`[publier] file — la PR #${pr.numero} porte ${String(pr.tete).slice(0, 9)}, ancêtre de la tête publiée : GitHub n’a pas encore vu le push\n`)
            patienter()
            continue
          }
          let issue = null
          if (!demande) {
            const vues = ctx.coursesCi(journal.tete)
            const ci = vues.disponible ? verdictDesRuns(vues.valeur, journal.tete) : null
            if (ci?.etat === 'rouge' || ci?.etat === 'annulee')
              return attendu({ ok: false, detail: { pr: pr.numero }, raison: rougeDeBranche(ctx, pr, journal.tete) ?? `course CI ${ci.etat} de la branche sur ${journal.tete.slice(0, 9)}` })
            if (ci?.etat !== 'verte') ctx.journaliser(`[publier] file — course de la branche ${ci?.etat ?? `illisible : ${vues.raison}`}\n`)
            else {
              issue = ctx.demanderFusion({ numero: pr.numero, sha: journal.tete })
              if (!issue.ok) return attendu({ ok: false, detail: { pr: pr.numero }, raison: `\`PUT …/pulls/${pr.numero}/merge-async\` REFUSÉ : ${issue.raison}` })
              if (issue.statut === 'pending' && issue.deja && issue.attendue !== journal.tete)
                return attendu({ ok: false, detail: { pr: pr.numero }, raison: `une demande de fusion de la PR #${pr.numero} est DÉJÀ pendante (409, ${issue.uuid}) sur ${String(issue.attendue).slice(0, 9)}, pas la tête publiée ${journal.tete.slice(0, 9)} : GitHub l’annule (schéma de \`merge-async\`, \`sha\`) — \`--reprendre\` après son échec` })
              if (issue.statut === 'pending' && issue.deja)
                ctx.journaliser(`[publier] file — demande DÉJÀ pendante (409) ${issue.uuid} sur la tête publiée : elle est suivie\n`)
            }
          } else if (demande.uuid) {
            issue = ctx.lireFusion({ numero: pr.numero, uuid: demande.uuid })
            if (!issue.ok) {
              ctx.journaliser(`[publier] file — demande ${demande.uuid} illisible : ${issue.raison}\n`)
              issue = null
            }
          }
          if (issue?.statut === 'merged') return fusionnee(pr, issue.fusion)
          if (issue?.statut === 'failed')
            return attendu({ ok: false, detail: { pr: pr.numero }, raison: `demande de fusion de la PR #${pr.numero} en ÉCHEC : ${issue.message}` })
          if (issue?.statut === 'pending') demande = { uuid: issue.uuid }
          if (issue?.statut === 'enqueued') demande = { enFile: true }
          if (demande?.enFile) {
            const cause = causeDEjection(ctx, pr, journal.tete)
            if (cause.attendre) ctx.journaliser(`[publier] file — PR #${pr.numero} dans la file : ${cause.dit}\n`)
            else if (!cause.reprendre) return attendu({ ok: false, detail: { pr: pr.numero }, raison: cause.raison })
            else return attendu(reprendreApresEjection(ctx, journal, cause))
          }
        }
        patienter()
      }
      return attendu({
        indetermine: true,
        raison: `aucune fusion en ${ctx.options.fileTimeoutMin} min pour ${journal.tete.slice(0, 9)} — \`--reprendre\` reprend l’attente (une nouvelle demande rend la demande pendante, 409, ou la file, 200)`,
      })
    },
  },
  {
    nom: 'pilotage',
    // Le journal SUFFIT : chaque commentaire est déjà idempotent par sa marque (relue par `gh` dans
    // `jouer`), et une étape verte pour CETTE tête a posé ou constaté les N de CETTE plage.
    dejaFaite(ctx, journal) {
      const vue = journal.etapes.pilotage
      return vue?.etat === 'vert' && vue.tete === ctx.tete
    },
    jouer(ctx, journal) {
      const file = journal.etapes.file?.detail ?? {}
      const fusion = file.fusion
      if (!fusion) return { ok: false, raison: 'aucun commit de fusion au journal de l’étape `file`' }
      const vuTronc = ctx.tronc()
      if (!vuTronc.disponible) return { ok: false, raison: `origin non consultable : ${vuTronc.raison}` }
      // Méthode MERGE (scripts/ops/ruleset-main.mjs) : `fusion^1` = `main` d'avant, `fusion^2` = la tête
      // de la PR. La plage est celle de la branche, jamais le commit de fusion (« Merge pull request #N »).
      const base = ctx.questions.shaDe(`${fusion}^1`)
      const tete = ctx.questions.shaDe(`${fusion}^2`)
      if (!base || !tete) return { ok: false, raison: `${fusion.slice(0, 9)} n’a pas deux parents lisibles après fetch` }
      const commits = ctx.questions.commitsDeLaPlage(`${base}..${tete}`)
      const numeros = [...new Set(commits.flatMap((c) => numerosCites(c.message)))]
      const fermes = new Set(commits.flatMap((c) => numerosFermes(c.message)))
      const rates = []
      const poses = []
      for (const numero of numeros) {
        const vue = ctx.lireTicket(numero)
        if (!vue.ok) {
          rates.push(`#${numero} : ${vue.raison}`)
          continue
        }
        const corpsVus = vue.corps
        if (corpsVus.some((c) => c.includes(marquePublication(fusion)))) {
          ctx.journaliser(`[publier] pilotage — #${numero} déjà piloté\n`)
          continue
        }
        const fermeParCi = corpsVus.some((c) => commits.some((k) => c.includes(marqueDe(k.sha))))
        const corps = corpsDePilotage({
          numero,
          base,
          tete,
          fusion,
          commits,
          file,
          ferme: fermes.has(numero),
          fermeParCi,
          fermeAutrement: vue.etat.toLowerCase() === 'closed' && !fermeParCi,
        })
        const pose = ctx.commenter(numero, corps)
        if (pose.ok) poses.push(numero)
        else rates.push(`#${numero} : ${pose.raison}`)
      }
      if (rates.length) return { ok: false, detail: { poses, rates }, raison: `pilotage manqué sur ${rates.length} ticket(s) :\n${rates.map((r) => `    ${r}`).join('\n')}` }
      return { ok: true, detail: { poses, numeros }, dit: `${poses.length} commentaire(s) posé(s) sur ${numeros.length} ticket(s) cité(s)` }
    },
  },
  {
    nom: 'fin',
    dejaFaite(ctx, journal) {
      return journal.etapes.fin?.etat === 'vert' && journal.etapes.fin.tete === ctx.tete
    },
    jouer(ctx, journal) {
      return { ok: true, dit: `publication complète de ${journal.tete?.slice(0, 9)} en ${String(journal.etapes.file?.detail?.fusion ?? '?').slice(0, 9)}` }
    },
  },
]
