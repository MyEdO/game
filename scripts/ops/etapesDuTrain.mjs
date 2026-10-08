// LES ÉTAPES DU TRAIN DE PUBLICATION (`scripts/ops/publier.mjs`) et les purs qu'elles composent.
//
// CLÔTURE, gardée contre une retouche de bonne foi (#1806) : une étape ne tient que son contexte
// (`contexteDe`, `publier.mjs`), qui porte des QUESTIONS (`questionsDuTrain`) et des gestes NOMMÉS aux
// arguments validés (`commit` → `commitDe`, `fusionner`, `abandonnerFusion`, `conclureFusionSansCiblesPures`,
// `pousser`, `tronc`, `npm`,
// `docs`, `coursesCi`, `coursesDeFile`, `parentsDe`, `jobsEnEchec`, `lirePr`, `ouvrirPr`, `demanderFusion`,
// `lireFusion`, `lireTicket`, `commenter`, `synchroniserPrincipal`). Le test de clôture (`etapesDuTrain.test.mjs`) refuse
// à ce module toute liaison, importée de n'importe quel module de sa clôture, qui atteint un lancement
// de processus par l'une des SOURCES de capacité de sa table : import d'un module intégré hors de ses
// inertes, import d'un paquet, import d'un module du dépôt qui l'exporte lanceuse ou n'est pas lu,
// import dynamique ou `require`, `createRequire`/`getBuiltinModule`/`binding`, accès ambiant (global
// lu hors de ses inertes), évaluation ; `import.meta` est inerte. Résidu que le test ne garde pas :
// évaluation par `.constructor`, état mutable posé par un autre module, effet au chargement d'un
// module de la clôture (#2073).
import { TRONC, refusDeGit, reussi, urlOrigineAcceptee } from '../guards/lib/gitPorte.mjs'
import { attendreSync } from '../guards/lib/spawnResilient.mjs'
import { corpsDePr } from '../guards/lib/fusionPr.mjs'
import { PLAFOND_RELANCES, phraseDesJobs, verdictDesRuns, verdictJuge } from '../guards/lib/coursesCi.mjs'
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
 * éjectée, n'est pas celle de la tête. Une course d'`ecartees` (`coursesDeFileTerminees`) non plus (#2392).
 */
export const courseDeFile = (courses, numero, { tete, parentsDe, ecartees = new Set() }) =>
  (courses ?? []).find((c) => {
    if (!String(c?.headBranch ?? '').startsWith(prefixeDeFile(numero)) || ecartees.has(c.databaseId)) return false
    const vu = parentsDe(String(c.headSha ?? ''))
    return vu.ok && vu.parents.includes(tete)
  }) ?? null

/** Les `databaseId` des courses de file TERMINÉES de la PR `numero`, relevés à l'accusé d'une demande de
 *  fusion : aucune ne juge cette demande (#2392). PUR. */
export const coursesDeFileTerminees = (courses, numero) => (courses ?? [])
  .filter((c) => String(c?.headBranch ?? '').startsWith(prefixeDeFile(numero)) && String(c.status ?? 'completed') === 'completed')
  .map((c) => c.databaseId)

/**
 * Une PR de l'API REST (`GET /repos/{owner}/{repo}/pulls`), réduite à ce que le train lit. PUR.
 * `mergeable_state` n'est rendu que par la lecture d'UNE PR (`GET …/pulls/{n}`), et GitHub le calcule
 * en différé : `conflit` vaut `true` sur `dirty`, `null` sur `unknown` ou absent (calcul en cours),
 * `false` sinon.
 * @returns {{numero:number, etat:'ouverte'|'fusionnee'|'fermee', tete:string,
 *   fusion:string|null, conflit:boolean|null}}
 */
export const prDeRest = (p) => ({
  numero: p.number,
  etat: p.merged_at ? 'fusionnee' : p.state === 'open' ? 'ouverte' : 'fermee',
  tete: p.head?.sha ?? null,
  fusion: p.merged_at ? p.merge_commit_sha ?? null : null,
  conflit: p.mergeable_state === 'dirty' ? true : p.mergeable_state === 'unknown' || p.mergeable_state == null ? null : false,
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
 * commités (#2203) —, et les sorties de `npm run agents:sync` (`synchroniserAgents`). PURE.
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

/** Motif de la fusion d'`origin/main` qui REPREND une PR que le serveur ne fusionne pas : en conflit
 *  avec la base, refusée à la demande, ou éjectée de la file. */
export const MOTIF_EJECTION = 'fusion d’origin/main : reprise d’une PR que la file de fusion refuse'

/** Motif du commit des stocks de sites régénérés par l'étape `docs` après une fusion du tronc. */
export const MOTIF_STOCKS = 'stocks de sites régénérés au point fixe après fusion du tronc'

/** Refus commun aux commits du train : sans `#N`, la porte du commit refuserait le message. */
export const REFUS_SANS_TICKET =
  'aucun `#N` cité par la plage : le commit du train n’aurait aucun ticket, et la porte du commit le refuse — cite un ticket dans un commit de la plage'

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


/**
 * Remet les miroirs d'agents en phase AVANT le commit des dérivés, par la porte `ctx.npm`.
 * `agents:sync` se déclenche sur un `agents:check` ROUGE, jamais sur la saleté de `CLAUDE.md` : un
 * commit de la plage qui touche `.claude/skills/**` ou `.claude/credo.md` sans resynchroniser laisse
 * `agents:check` rouge, et la gate `agents:check` de la CI refuserait la plage sans nommer la cause.
 * @param {{npm: Function, journaliser: Function}} ctx
 * @returns {{ok: true} | {ok: false, raison: string}}
 */
export function synchroniserAgents(ctx) {
  const verif = ctx.npm('agents:check')
  if (verif.status === 0) return { ok: true }
  ctx.journaliser(`[publier] docs — \`agents:check\` rendu ${verif.status} : \`npm run agents:sync\`\n`)
  const sync = ctx.npm('agents:sync')
  if (sync.status !== 0)
    return { ok: false, raison: `\`npm run agents:sync\` a rendu ${sync.status} : la gate \`agents:check\` de la CI refuserait la plage` }
  return { ok: true }
}

/**
 * Régénère les stocks de sites au point fixe (`npm run stocks:regen`, `regenStock.mts --tous`) quand la
 * branche a absorbé le tronc pendant le lot, puis commet ceux qu'elle a écrits. Une fusion sous pilote
 * (`merge-stocks.mjs`) rend l'union des côtés, pas la mesure de l'arbre fusionné (#2525). Les chemins
 * commis sont les manuscrits sales dont l'attribut `merge` vaut `stocks` ; tout autre manuscrit sale
 * est laissé au contrôle de l'étape, rien n'est commis. Une croissance refusée par la porte du commit
 * reste rouge : le train n'écrit jamais de `CLIQUET:`.
 * @returns {{ok: true, dit?: string} | {ok: false, raison: string}}
 */
function regenererStocks(ctx, journal) {
  const vu = ctx.npm('stocks:regen')
  if (vu.status !== 0)
    return { ok: false, raison: `\`npm run stocks:regen\` a rendu ${vu.status ?? vu.signal} après la fusion du tronc : stocks de sites non régénérés (sortie au journal du train)` }
  const { manuscrits } = partitionSales(ctx.questions.cheminsSales(), ctx.generators)
  const attributs = ctx.questions.attributsDeFusion(manuscrits)
  const stocks = manuscrits.filter((c) => attributs.get(c) === 'stocks')
  if (!stocks.length || stocks.length !== manuscrits.length) return { ok: true }
  const numeros = numerosDeLaPlage(ctx.questions)
  if (!numeros.length) return { ok: false, raison: REFUS_SANS_TICKET }
  const commit = ctx.commit({ message: messageDuTrain({ portee: 'chore(stocks)', titre: 'stocks de sites', numeros, motif: MOTIF_STOCKS }), chemins: stocks })
  if (!reussi(commit))
    return { ok: false, raison: `commit des stocks de sites régénérés REFUSÉ par la porte du commit (une croissance née de la fusion du tronc : \`CLIQUET:\` à écrire à la main) :\n${stocks.map((c) => `    ${c}`).join('\n')}\n${refusDeGit(commit)}` }
  journal.tete = ctx.tete
  return { ok: true, dit: `${stocks.length} stock(s) de sites régénéré(s) commis — tête ${journal.tete.slice(0, 9)}` }
}

/** La course de BRANCHE de la tête `tete`, jugée (`verdictJuge`) ; une lecture indisponible est `illisible`. */
function brancheJugee(ctx, tete) {
  const vues = ctx.coursesCi(tete)
  return vues.disponible ? verdictJuge(vues.valeur, tete, ctx.jobsEnEchec) : { etat: 'illisible', raison: vues.raison }
}

/**
 * Ce que la course de branche jugée `ci` (`brancheJugee`) dit de la PR `pr` sur la tête `tete`. PUR. `null` :
 * verte. `{raison}` : rouge, ou annulée à son `PLAFOND_RELANCES`ᵉ essai. `{dit}` : on attend — en vol,
 * absente, illisible, ou annulée sous le plafond (#2392).
 */
function issueDeBranche(ci, pr, tete) {
  if (ci.etat === 'verte') return null
  if (ci.etat !== 'rouge' && ci.etat !== 'annulee')
    return { dit: `course de la branche ${ci.etat === 'illisible' ? `illisible : ${ci.raison}` : ci.etat}` }
  const id = ci.course.databaseId
  const essai = ci.course.attempt ?? 1
  const jobs = ci.jobsIllisibles ? ` (jobs illisibles : ${ci.jobsIllisibles})` : ci.rouges ? ` (${phraseDesJobs(ci)})` : ''
  const course = `course CI ${ci.etat} de la branche sur ${tete.slice(0, 9)}${jobs}`
  const url = `https://github.com/${DEPOT}/actions/runs/${id}`
  if (ci.etat === 'rouge') return { raison: `${course} — la PR #${pr.numero} n’entre pas dans la file : ${url}` }
  if (essai < PLAFOND_RELANCES) return { dit: `${course}, essai ${essai}/${PLAFOND_RELANCES} : ${url}` }
  return { raison: `${course}, essai ${essai}/${PLAFOND_RELANCES} — \`gh run rerun ${id} --failed\` puis \`npm run ops:publier -- --reprendre\` — la PR #${pr.numero} n’entre pas dans la file : ${url}` }
}

/**
 * Une PR mise en file y est encore, ou en a été ÉJECTÉE (`merge-queue-reject.md`, « will be removed
 * from the queue »). La course de branche et le CONFLIT avec la base se jugent en tête de l'étape
 * `file`. Une course de file rouge ATTRIBUÉE à la PR se REPREND (#2525) : la file n'admet qu'une tête
 * dont la course de branche est verte. Elle n'est attribuée que si `G^1`, le premier parent de son
 * commit de file, est dans `origin/main` ; sinon GitHub reconstruit l'entrée (`managing-a-merge-queue.md`
 * l.104-109) et on attend. Des jobs illisibles se NOMMENT. Une course de file ANNULÉE se redemande sur la
 * même tête (#2392) ; `ecartees` : les courses terminées avant la demande (`coursesDeFileTerminees`).
 * @returns {{attendre:true, dit:string}|{redemander:true, raison:string}|{reprendre:boolean, raison:string}}
 */
function causeDEjection(ctx, pr, tete, ecartees, enFile) {
  const vues = ctx.coursesDeFile()
  if (!vues.disponible) return { attendre: true, dit: `courses de file illisibles : ${vues.raison}` }
  const course = courseDeFile(vues.valeur, pr.numero, { tete, parentsDe: ctx.parentsDe, ecartees })
  const etat = course ? verdictDesRuns([course], course.headSha).etat : 'absente'
  if (!['rouge', 'annulee'].includes(etat)) return enFile
    ? { attendre: true, dit: `course de file ${etat}` }
    : { redemander: true, raison: `PR #${pr.numero} sortie de la file sans course en échec (course de file ${etat})` }
  const url = `https://github.com/${DEPOT}/actions/runs/${course.databaseId}`
  const base = ctx.parentsDe(course.headSha).parents?.[0]
  const vuTronc = ctx.tronc()
  if (!vuTronc.disponible) return { attendre: true, dit: `course de file ${etat} ${url}, origin non consultable : ${refusDeGit(vuTronc)}` }
  const dansLeTronc = base && vuTronc.sha ? ctx.questions.estAncetre(base, vuTronc.sha) : null
  if (!(dansLeTronc?.disponible && !dansLeTronc.absent && dansLeTronc.valeur))
    return { attendre: true, dit: `course de file ${etat} ${url} sur un groupe (G^1 ${String(base ?? '?').slice(0, 9)} hors d’${TRONC.suivi}) : GitHub reconstruit l’entrée` }
  const juge = verdictJuge([course], course.headSha, ctx.jobsEnEchec)
  if (juge.jobsIllisibles) return { reprendre: false, raison: `PR #${pr.numero} éjectée par la course ${url} ; jobs illisibles : ${juge.jobsIllisibles}` }
  const jobs = phraseDesJobs(juge) || 'aucun job nommé'
  if (juge.etat === 'annulee') return { redemander: true, raison: `PR #${pr.numero} éjectée par la course ${url} ANNULÉE — ${jobs}` }
  return { reprendre: true, raison: `PR #${pr.numero} éjectée par la course ${url} — ${jobs}` }
}

/** Le refus d'une reprise au-delà de `BORNE_EJECTIONS`, ou `null`. PUR. */
const ejectionHorsBorne = (journal, cause) => (journal.ejections ?? 0) >= BORNE_EJECTIONS
  ? `${cause.raison} — reprise une ${(journal.ejections ?? 0) + 1}ᵉ fois, au-delà de la borne (${BORNE_EJECTIONS})`
  : null

/**
 * Reprise BORNÉE d'une PR que le serveur ne fusionne pas (#2178, design v3 ; #2525) : en conflit avec la
 * base, refusée à la demande, ou éjectée. FUSION d'`origin/main` dans la branche — jamais un rebase —,
 * puis `docs` (qui régénère les stocks de sites), `push-branche`, `pr` et `file` se rejouent.
 * Un conflit dont TOUS les chemins sont des cibles PURES (`estCiblePure`) se conclut en les retirant
 * de l'index, puis les cibles de code se produisent (`post-merge` ne joue pas sur un `git commit`) ;
 * tout autre conflit abandonne la fusion.
 */
function reprendreApresEjection(ctx, journal, cause) {
  const horsBorne = ejectionHorsBorne(journal, cause)
  if (horsBorne) return { ok: false, raison: `${horsBorne} : la cause n’est pas le tronc` }
  const vuTronc = ctx.tronc()
  if (!vuTronc.disponible) return { ok: false, raison: `${cause.raison} — origin non consultable pour la reprise : ${refusDeGit(vuTronc)}` }
  const numeros = numerosDeLaPlage(ctx.questions)
  if (!numeros.length) return { ok: false, raison: REFUS_SANS_TICKET }
  const message = messageDuTrain({ portee: 'chore(merge)', titre: `fusion de ${TRONC.suivi} dans ${ctx.branche}`, numeros, motif: MOTIF_EJECTION })
  const vu = ctx.fusionner({ message })
  if (!reussi(vu)) {
    // #2203
    const conflits = ctx.questions.cheminsEnConflit()
    const pures = conflits.length > 0 && conflits.every((c) => estCiblePure(c, ctx.generators))
    const conclue = pures ? ctx.conclureFusionSansCiblesPures({ chemins: conflits, message }) : null
    if (!conclue || !reussi(conclue)) {
      if (conflits.length) ctx.abandonnerFusion()
      return {
        ok: false,
        raison: `${cause.raison} — fusion de ${TRONC.suivi} REFUSÉE${conflits.length ? ` (CONFLIT, abandonnée) — fichiers :\n${conflits.map((f) => `    ${f}`).join('\n')}\n  → \`git merge ${TRONC.suivi}\` à la main, puis \`--reprendre\`` : ''} : ${refusDeGit(vu)}${conclue ? `\n  retrait des cibles pures en échec : ${refusDeGit(conclue)}` : ''}`,
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
      if (!vuFetch.disponible) return { ok: false, raison: `origin non consultable : ${refusDeGit(vuFetch)}` }
      // #2328 A3
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
    // (#2193) ; les stocks de sites, si la branche a absorbé le tronc pendant le lot (`regenererStocks`,
    // un état git qui survit à `--reprendre`).
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
      const fusionDuTronc = ctx.questions.baseAuTronc() !== journal.base
      if (!regenerer && !fusionDuTronc && !salesAvant.length) return { ok: true, dit: 'aucune source de mixte dans la plage, arbre propre : docs inchangés' }
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
      if (fusionDuTronc) {
        const stocks = regenererStocks(ctx, journal)
        if (!stocks.ok) return stocks
        if (stocks.dit) ctx.journaliser(`[publier] docs — ${stocks.dit}\n`)
      }
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
    // #2178 ; #2437 ; #2392 ; https://docs.github.com/en/graphql/reference/input-objects#enqueuepullrequestinput
    nom: 'file',
    dejaFaite(ctx, journal) {
      const vue = journal.etapes.file
      return vue?.etat === 'vert' && vue.tete === ctx.tete && Boolean(vue.detail?.fusion)
    },
    jouer(ctx, journal) {
      const debut = Date.now()
      const fin = debut + ctx.options.fileTimeoutMin * 60_000
      // Le compte de la PREMIÈRE issue qui le porte (`fusionDePr`).
      let compte = null
      const attendu = (v) => ({ ...v, detail: { ...(v.detail ?? {}), ...(compte ? { compte } : {}), attenteSecondes: (Date.now() - debut) / 1000 } })
      const sousLeCompte = (issue) => (issue.compte ? ` sous le compte « ${issue.compte} »` : '')
      const noterLeCompte = (issue) => {
        if (compte || !issue.compte) return
        compte = issue.compte
        ctx.journaliser(issue.deja && issue.statut === 'enqueued'
          ? `[publier] file — déjà en file, constaté sous le compte « ${compte} »\n`
          : `[publier] file — demande de fusion sous le compte « ${compte} »\n`)
      }
      const fusionnee = (pr, fusion) =>
        attendu({ ok: true, detail: { pr: pr.numero, fusion }, dit: `PR #${pr.numero} fusionnée en ${String(fusion ?? '?').slice(0, 9)}` })
      // `null` : aucune demande ; `{uuid}` : demande PENDANTE ; `{enFile:true}` : PR mise en file.
      let demande = null
      // Le refus de la demande (`{pr, raison}`), en attente de la relecture de la PR : un conflit la
      // reprend, une PR propre le rend ; aucune nouvelle demande tant qu'il est posé.
      let refus = null
      const refuser = (pr, raison) => { refus = { pr: pr.numero, raison }; demande = null }
      const ecartees = new Set()
      const patienter = () => attendreSync(Math.max(0, Math.min(PERIODE_SONDE_MS, fin - Date.now())))
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
          const branche = issueDeBranche(brancheJugee(ctx, journal.tete), pr, journal.tete)
          if (branche?.raison) return attendu({ ok: false, detail: { pr: pr.numero }, raison: branche.raison })
          // #2525
          if (pr.conflit === true) return attendu(reprendreApresEjection(ctx, journal, { raison: `PR #${pr.numero} en CONFLIT avec la base` }))
          if (refus) {
            if (pr.conflit === false) return attendu({ ok: false, detail: { pr: refus.pr }, raison: refus.raison })
            ctx.journaliser(`[publier] file — PR #${pr.numero} : demande refusée, conflit avec la base pas encore jugé par GitHub\n`)
            patienter()
            continue
          }
          let issue = null
          if (!demande) {
            if (branche) ctx.journaliser(`[publier] file — ${branche.dit}\n`)
            else {
              issue = ctx.demanderFusion({ numero: pr.numero, sha: journal.tete })
              noterLeCompte(issue)
              if (!issue.ok) {
                refuser(pr, `demande de fusion de la PR #${pr.numero} REFUSÉE${sousLeCompte(issue)} : ${issue.raison}`)
                continue
              }
              if (issue.statut === 'pending' && issue.deja && issue.attendue !== journal.tete)
                return attendu({ ok: false, detail: { pr: pr.numero }, raison: `une demande de fusion de la PR #${pr.numero} est DÉJÀ pendante (409, ${issue.uuid}) sur ${String(issue.attendue).slice(0, 9)}, pas la tête publiée ${journal.tete.slice(0, 9)} : GitHub l’annule (schéma de \`merge-async\`, \`sha\`) — \`--reprendre\` après son échec` })
              if (issue.statut === 'pending' && issue.deja)
                ctx.journaliser(`[publier] file — demande DÉJÀ pendante (409) ${issue.uuid} sur la tête publiée : elle est suivie\n`)
            }
          } else if (demande.uuid) {
            issue = ctx.lireFusion({ numero: pr.numero, sha: journal.tete, uuid: demande.uuid })
            noterLeCompte(issue)
            if (!issue.ok) {
              ctx.journaliser(`[publier] file — demande ${demande.uuid} illisible : ${issue.raison}\n`)
              issue = null
            }
          }
          if (issue?.statut === 'merged') return fusionnee(pr, issue.fusion)
          if (issue?.statut === 'failed') {
            refuser(pr, `demande de fusion de la PR #${pr.numero} en ÉCHEC${sousLeCompte(issue)} : ${issue.message}`)
            continue
          }
          if (!demande && (issue?.statut === 'pending' || issue?.statut === 'enqueued')) {
            const vues = ctx.coursesDeFile()
            if (vues.disponible) for (const id of coursesDeFileTerminees(vues.valeur, pr.numero)) ecartees.add(id)
            else ctx.journaliser(`[publier] file — courses de file illisibles à la demande : ${vues.raison}\n`)
          }
          if (issue?.statut === 'pending') demande = { uuid: issue.uuid }
          if (issue?.statut === 'enqueued') demande = { enFile: true }
          if (demande?.enFile) {
            const file = ctx.etatFileDePr({ numero: pr.numero, sha: journal.tete })
            noterLeCompte(file)
            if (!file.ok || file.statut === 'anomalie')
              return attendu({ ok: false, detail: { pr: pr.numero }, raison: `lecture de file de la PR #${pr.numero} REFUSÉE${sousLeCompte(file)} : ${file.raison}` })
            if (file.statut === 'merged') return fusionnee(pr, file.fusion)
            const cause = causeDEjection(ctx, pr, journal.tete, ecartees, file.statut === 'enqueued')
            if (cause.attendre) ctx.journaliser(`[publier] file — PR #${pr.numero} : ${cause.dit}\n`)
            else if (cause.redemander) {
              const horsBorne = ejectionHorsBorne(journal, cause)
              if (horsBorne) return attendu({ ok: false, detail: { pr: pr.numero }, raison: horsBorne })
              journal.ejections = (journal.ejections ?? 0) + 1
              ctx.journaliser(`[publier] file — ${cause.raison} : nouvelle demande de fusion sur ${journal.tete.slice(0, 9)}\n`)
              demande = null
              continue
            } else if (!cause.reprendre) return attendu({ ok: false, detail: { pr: pr.numero }, raison: cause.raison })
            else return attendu(reprendreApresEjection(ctx, journal, cause))
          }
        }
        patienter()
      }
      if (refus) return attendu({ ok: false, detail: { pr: refus.pr }, raison: refus.raison })
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
      if (!vuTronc.disponible) return { ok: false, raison: `origin non consultable : ${refusDeGit(vuTronc)}` }
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
    // #2187, #2493 : le principal synchronisé sur la fusion ; son état est un fait distinct de la publication,
    // jamais un échec du train.
    jouer(ctx, journal) {
      const fusion = journal.etapes.file?.detail?.fusion ?? null
      const principal = ctx.synchroniserPrincipal({ visee: fusion })
      return { ok: true, detail: { principal }, dit: `publication complète de ${journal.tete?.slice(0, 9)} en ${String(fusion ?? '?').slice(0, 9)} ; principal ${principal.ligne}` }
    },
  },
]
