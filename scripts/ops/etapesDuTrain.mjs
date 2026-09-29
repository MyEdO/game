// LES ÉTAPES DU TRAIN DE PUBLICATION (`scripts/ops/publier.mjs`) et les purs qu'elles composent.
//
// CLÔTURE, gardée contre une retouche de bonne foi (#1806) : une étape ne tient que son contexte
// (`contexteDe`, `publier.mjs`), qui porte des QUESTIONS (`questionsDuTrain`) et des gestes NOMMÉS aux
// arguments validés (`commit` → `commitDe`, `rebaser`, `abandonnerRebase`, `pousser`, `tronc`, `npm`,
// `docs`, `coursesCi`, `lireTicket`, `commenter`). Le test de clôture (`etapesDuTrain.test.mjs`) refuse
// à ce module toute liaison, importée de n'importe quel module de sa clôture, qui atteint un lancement
// de processus par l'une des SOURCES de capacité de sa table : import d'un module intégré hors de ses
// inertes, import d'un paquet, import d'un module du dépôt qui l'exporte lanceuse ou n'est pas lu,
// import dynamique ou `require`, `createRequire`/`getBuiltinModule`/`binding`, accès ambiant (global
// lu hors de ses inertes), évaluation ; `import.meta` est inerte. Résidu que le test ne garde pas :
// évaluation par `.constructor`, état mutable posé par un autre module, effet au chargement d'un
// module de la clôture (#2073).
import { TRONC, raisonCourte, reussi, urlOrigineAcceptee } from '../guards/lib/gitPorte.mjs'
import { ANNULEE, ROUGES } from '../guards/lib/coursesCi.mjs'
import { numerosCites, numerosFermes } from '../guards/lib/fermetures.mjs'
import { DEPOT } from '../guards/lib/ticketsGh.mjs'
import { refusDeSujet } from '../guards/lib/sujetDeCommit.mjs'
import { marqueDe } from '../guards/lib/plageFermante.mjs'
import { natureDuRouge, rougesNommes, SOURCES_LUES } from '../docs/build-all.mjs'
import { CODE_CORPS_PERIME } from '../docs/lib/empreinte-sources.mjs'
import { MANAGED_ROOTS } from '../agents/compat-core.mjs'
import { sourcesMesurees, touchesDocSources } from '../git-hooks/docs-rebuild.mjs'
import { resoudreOutilLocal } from '../lancer-local.mjs'
import { correspondGlob } from '../guards/lib/lister.mjs'
import { coupeAuMot } from '../../src/lib/coupeAuMot.mjs'

/** Période de la sonde CI, en millisecondes. */
export const PERIODE_SONDE_MS = 30_000

/** Nom du workflow que la sonde reconnaît (`.github/workflows/ci.yml`, `name: CI`). */
export const WORKFLOW = 'CI'

/** Marque d'IDEMPOTENCE du pilotage : elle porte la tête publiée. */
export const marquePublication = (sha) => `<!-- publier: ${sha} -->`


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
 * Ce chemin est-il DÉRIVÉ, donc committable par l'étape `docs` ? Trois familles, toutes déclarées
 * ailleurs : les `targets`/`injecte` des `generators` (`GENERATORS` de `build-all.mjs`, porté par le
 * contexte du train, `ctx.generators`), la mesure `docs/.sources-lues.json`
 * (`build-all.mjs` REFUSE si elle n'est pas dans l'index), et les sorties de `npm run agents:sync`
 * (le pre-commit joue `agents:check` à chaque commit). PURE.
 */
export function estDocDerive(chemin, generators, { sourcesLues = SOURCES_LUES, racinesAgents = MANAGED_ROOTS } = {}) {
  const c = String(chemin ?? '').replace(/\\/g, '/')
  if (!c) return false
  if (c === sourcesLues) return true
  if (racinesAgents.some((r) => c === r || c.startsWith(`${r}/`))) return true
  return generators.some((g) =>
    [...(g.targets ?? []), ...(g.injecte ?? [])].some((motif) => correspondGlob(c, motif)),
  )
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

/** Motif du commit de dérivés de l'étape `derives` — ceux que le hook `post-rewrite` a laissés. */
export const MOTIF_POST_REWRITE = 'docs dérivés laissés non commités par le hook post-rewrite d’un rebase manuel'

/** Motif du commit de dérivés de l'étape `docs` — ceux que la régénération du train vient d'écrire. */
export const MOTIF_APRES_REBASE = 'docs dérivés régénérés après rebase sur origin/main (post-rewrite)'

/** Refus commun aux deux commits de dérivés : sans `#N`, la porte de commit refuserait le message. */
export const REFUS_SANS_TICKET =
  'aucun `#N` cité par la plage : le commit `chore(docs)` n’aurait aucun ticket, et la porte de commit le refuse — cite un ticket dans un commit de la plage'

/**
 * La PLAGE dont les `#N` légitiment un commit de dérivés. PURE. Le journal la porte dès que l'étape
 * `rebase` a rendu ; AVANT elle (étape `derives`), `origin/main..HEAD` la remplace — `origin/main`
 * vient d'être fetché par la préflight.
 */
export const plageDeCitations = (journal) =>
  journal?.base && journal?.tete ? `${journal.base}..${journal.tete}` : `${TRONC.suivi}..HEAD`

/**
 * Message du commit de docs dérivés. PURE — une seule forme pour les deux étapes qui commettent.
 * Le SUJET tient la règle du dépôt (`scripts/guards/lib/sujetDeCommit.mjs`, mesurée ici par
 * `refusDeSujet`, jamais par un compte recopié) ; le MOTIF va au CORPS. Quand les `refs` d'une plage
 * chargée feraient déborder le sujet, elles descendent au corps : `numerosCites` lit le message
 * ENTIER (`scripts/guards/lib/fermetures.mjs:63`), corps compris.
 */
export const messageDeDerives = (numeros, motif) => {
  const refs = numeros.map((n) => `refs #${n}`).join(' ')
  const avecRefs = `chore(docs): ${refs} — docs dérivés\n\n${motif}\n`
  if (refs && refusDeSujet(avecRefs) === null) return avecRefs
  return `chore(docs): docs dérivés\n\n${motif}\n${refs ? `\n${refs}\n` : ''}`
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

/** Refus du train quand le tronc bouge une SECONDE fois — une seule formulation, deux sites de lecture. */
export const REFUS_DEUX_FOIS = 'origin/main a bougé DEUX fois pendant le train — relancer `npm run ops:publier`'

/**
 * Le tronc a-t-il bougé sous le train ? PURE — UNE comparaison et UNE borne, lues AVANT le push et
 * APRÈS un push refusé (origin/main peut recevoir des commits entre les deux).
 * @param {{distant:string|null, base:string|null, reprises?:number}} p
 * @returns {'inchangé'|'relancer'|'rouge-deux-fois'}
 */
export function verdictDuTronc({ distant, base, reprises = 0 }) {
  if (distant === base) return 'inchangé'
  return (reprises ?? 0) >= 1 ? 'rouge-deux-fois' : 'relancer'
}

/** Refus de l'étape `rebase` sur un train de FUSION qui ne contient pas le tronc (#1998). */
export const REFUS_TRAIN_DE_FUSION =
  'train de fusion : fusionner `origin/main` dans la branche, puis `--reprendre` — jamais un rebase qui linéarise les fusions'

/**
 * Ce que l'étape `rebase` fait de la relation d'`origin/main` à HEAD (#1998). PURE.
 * @param {{contenu:boolean, fusions:boolean}} p `contenu` = `origin/main` ancêtre de HEAD ;
 *   `fusions` = `origin/main..HEAD` porte au moins un commit de fusion.
 * @returns {'contenu'|'fusions'|'rebase'}
 */
export function decisionDeRebase({ contenu, fusions }) {
  if (contenu) return 'contenu'
  return fusions ? 'fusions' : 'rebase'
}


/** Première ligne d'un message de commit, coupée au mot vers `max` (`coupeAuMot`). PURE. */
export const titreDeCommit = (message, max = 120) => {
  const ligne = String(message ?? '').split('\n')[0].trim()
  return coupeAuMot(ligne, max)
}

/**
 * Corps du commentaire de pilotage d'UN ticket. PURE — la marque est TOUJOURS la dernière ligne.
 * @param {{numero:string, base:string, tete:string, commits:{sha:string,message:string}[],
 *   ci:{etat:string, course?:object, attenteCiSecondes?:number},
 *   ferme:boolean, fermeParCi?:boolean, fermeAutrement?:boolean}} p
 */
export function corpsDePilotage({ numero, base, tete, commits, ci, ferme, fermeParCi = false, fermeAutrement = false }) {
  const court = (sha) => String(sha ?? '').slice(0, 9)
  const lignes = [
    `## Publication ${court(tete)}`,
    '',
    `Plage publiée : \`${court(base)} → ${court(tete)}\` sur \`main\`.`,
    '',
    `### Commits (${commits.length})`,
    ...commits.map((c) => `- \`${court(c.sha)}\` ${titreDeCommit(c.message)}`),
    '',
    '### CI',
  ]
  const course = ci?.course
  lignes.push(
    course
      ? `- ${ci.etat} — course \`${course.databaseId}\` : https://github.com/${DEPOT}/actions/runs/${course.databaseId}`
      : `- ${ci?.etat ?? 'non lue'} — aucune course rattachée à cette tête.`,
  )
  if (typeof ci?.attenteCiSecondes === 'number')
    lignes.push(`- attente du verdict CI : ${(ci.attenteCiSecondes / 60).toFixed(1)} min (temps d’attente, pas de machine locale).`)
  lignes.push('')
  if (fermeAutrement) lignes.push(`#${numero} était déjà FERMÉ par un autre geste que cette publication.`)
  else if (fermeParCi) lignes.push(`#${numero} a été FERMÉ par la CI (job \`fermetures\`) sur cette publication.`)
  else if (ferme) lignes.push(`Ce commit FERME #${numero} : fermeture par le job \`fermetures\` de la CI.`)
  else lignes.push(`#${numero} est rattaché (\`refs\`) par cette publication, non fermé.`)
  lignes.push('', marquePublication(tete))
  return `${lignes.join('\n')}\n`
}


/** Les `#N` cités par la plage de `journal` (ou `origin/main..HEAD` avant le rebase), dédupliqués. */
function numerosDeLaPlage(questions, journal) {
  return [...new Set(questions.commitsDeLaPlage(plageDeCitations(journal)).flatMap((c) => numerosCites(c.message)))]
}

/**
 * COMMIT de docs DÉRIVÉS : stage des chemins EXPLICITES, message qui cite les tickets de la plage,
 * `journal.tete` avancé. UNE implémentation, deux appelants (`derives` avant le rebase, `docs`
 * après) — le geste est le même, seul le MOTIF change.
 * @param {object} ctx @param {{chemins:string[], numeros:string[], motif:string, journal:object}} p
 * @returns {{ok:boolean, raison?:string, detail?:object, dit?:string}}
 */
function commettreDerives(ctx, { chemins, numeros, motif, journal }) {
  const commit = ctx.commit({ message: messageDeDerives(numeros, motif), chemins })
  if (!reussi(commit)) return { ok: false, raison: `\`git add\` puis \`git commit\` des docs ont échoué : ${refusDeGit(commit)}` }
  journal.tete = ctx.tete
  return { ok: true, detail: { chemins, numeros }, dit: `${chemins.length} doc(s) dérivé(s) commis — tête ${journal.tete.slice(0, 9)}` }
}

/**
 * Le verdict d'étape que porte un tronc MESURÉ, ou `null` s'il n'a pas bougé. Seul site qui
 * incrémente `journal.reprises` : la décision, elle, est la pure `verdictDuTronc`.
 * @param {object} journal @param {string|null} distant sha lu d'`origin/main` @param {string} phrase
 * @returns {{ok:boolean, relancer?:string[], dit?:string, raison?:string}|null}
 */
function jugerLeTronc(journal, distant, phrase) {
  const verdict = verdictDuTronc({ distant, base: journal.base, reprises: journal.reprises })
  if (verdict === 'inchangé') return null
  if (verdict === 'rouge-deux-fois') return { ok: false, raison: REFUS_DEUX_FOIS }
  journal.reprises = (journal.reprises ?? 0) + 1
  return {
    ok: true,
    relancer: ['rebase', 'docs', 'push-branche', 'ci'],
    dit: `${phrase} (${distant?.slice(0, 9)}) : le train reprend au rebase`,
  }
}


/** Attente BLOQUANTE sans busy-loop (le train est synchrone de bout en bout). */
function attendre(ms) {
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

/** La table des ÉTAPES : nom, `jouer(ctx, journal)`, `dejaFaite(ctx, journal)`. Ajouter une étape,
 *  c'est ajouter UNE entrée ici — rien d'autre. */
export const ETAPES = [
  {
    nom: 'preflight',
    // TOUJOURS rejouée : elle EST la garde.
    dejaFaite: () => false,
    jouer(ctx) {
      const { racine, questions } = ctx
      const entame = questions.rebaseEntame()
      if (entame)
        return { ok: false, raison: `rebase interrompu (${entame}) : \`git rebase --abort\` ou \`--continue\` à la main, puis \`--reprendre\`` }
      if (questions.brancheDe() === null)
        return { ok: false, raison: 'HEAD DÉTACHÉ : le train publie une branche, pas un sha errant' }
      const { derives, manuscrits } = partitionSales(questions.cheminsSales(), ctx.generators)
      if (manuscrits.length)
        return {
          ok: false,
          raison:
            `arbre NON COMMITÉ (${manuscrits.length}) — on ne publie que du committé :\n` +
            `${manuscrits.map((s) => `    ${s}`).join('\n')}` +
            (derives.length ? `\n  (et ${derives.length} doc(s) dérivé(s) régénéré(s) que l’étape derives aurait commis)` : ''),
        }
      const origine = questions.origineDe()
      if (!urlOrigineAcceptee(origine)) return { ok: false, raison: `origin étranger au dépôt : ${origine ?? 'illisible'}` }
      const vuFetch = ctx.tronc()
      if (!vuFetch.disponible) return { ok: false, raison: `origin non consultable : ${vuFetch.raison}` }
      const outil = resoudreOutilLocal(racine, 'vitest', 'vitest')
      if (outil.refus) return { ok: false, raison: outil.refus }
      const reste = derives.length
        ? `${derives.length} doc(s) dérivé(s) régénéré(s) non commités (post-rewrite) : l’étape derives les commet`
        : 'arbre propre'
      return {
        ok: true,
        detail: { derivesSales: derives },
        dit: `${reste}, origin consultable, outillage local posé`,
      }
    },
  },
  {
    // Les docs DÉRIVÉS sales sont commis ICI, AVANT le rebase. Mesuré (2026-09-14, 2ᵉ train réel) :
    // `git rebase origin/main` REFUSE de démarrer sur un arbre sale (« cannot rebase: You have
    // unstaged changes ») — tolérer la saleté à la préflight sans la committer avant le rebase ne
    // faisait que déplacer le refus d'une étape.
    nom: 'derives',
    dejaFaite(ctx) {
      return partitionSales(ctx.questions.cheminsSales(), ctx.generators).derives.length === 0
    },
    jouer(ctx, journal) {
      const { questions } = ctx
      const { derives, manuscrits } = partitionSales(questions.cheminsSales(), ctx.generators)
      if (manuscrits.length)
        return {
          ok: false,
          raison:
            `MANUSCRIT(S) sale(s) que la préflight venait de refuser — l’arbre a bougé depuis :\n` +
            manuscrits.map((c) => `    ${c}`).join('\n'),
        }
      if (!derives.length) return { ok: true, dit: 'aucun doc dérivé sale' }
      const numeros = numerosDeLaPlage(ctx.questions, journal)
      if (!numeros.length) return { ok: false, raison: REFUS_SANS_TICKET }
      return commettreDerives(ctx, { chemins: derives, numeros, motif: MOTIF_POST_REWRITE, journal })
    },
  },
  {
    nom: 'rebase',
    dejaFaite(ctx, journal) {
      return Boolean(journal.base) && journal.base === ctx.questions.shaDe(TRONC.suivi) && journal.tete === ctx.tete
    },
    jouer(ctx, journal) {
      const { questions } = ctx
      const teteAvant = ctx.tete
      const relation = questions.relationAuTronc()
      if (!relation.disponible) return { ok: false, raison: `relation d’origin/main à HEAD illisible : ${relation.raison}` }
      const decision = decisionDeRebase(relation)
      if (decision === 'fusions') return { ok: false, raison: REFUS_TRAIN_DE_FUSION }
      const vu = decision === 'rebase' ? ctx.rebaser() : null
      if (vu && (!vu.disponible || vu.absent || vu.valeur.status !== 0)) {
        const conflits = questions.cheminsEnConflit()
        const entame = questions.rebaseEntame() !== null
        // Un rebase qui REFUSE DE DÉMARRER (arbre sale, HEAD détaché…) n'a rien entamé : `--abort`
        // y rendrait « No rebase in progress » et masquerait la vraie raison. Mesuré (2026-09-14) :
        // tout échec était classé CONFLIT, sans un seul fichier à nommer.
        if (!conflits.length && !entame) {
          const brut = vu.disponible && !vu.absent ? `${vu.valeur.stderr ?? ''}\n${vu.valeur.stdout ?? ''}` : vu.raison
          return { ok: false, raison: `rebase sur origin/main REFUSÉ (aucun rebase entamé) : ${raisonCourte(brut)}` }
        }
        ctx.abandonnerRebase()
        return {
          ok: false,
          raison: `rebase sur origin/main en CONFLIT (abandonné)${conflits.length ? ` — fichiers :\n${conflits.map((f) => `    ${f}`).join('\n')}` : ''}`,
        }
      }
      journal.base = questions.shaDe(TRONC.suivi)
      journal.tete = ctx.tete
      journal.teteAvant = teteAvant
      if (!journal.base || !questions.combienDe([`${journal.base}..HEAD`])) return { ok: false, raison: `rien à publier : ${journal.base?.slice(0, 9)}..HEAD est VIDE` }
      const dit = `base ${journal.base.slice(0, 9)} → tête ${journal.tete.slice(0, 9)}`
      return {
        ok: true,
        detail: { base: journal.base, tete: journal.tete, reecrit: teteAvant !== journal.tete },
        dit: decision === 'contenu' ? `tronc déjà contenu — ${dit}` : dit,
      }
    },
  },
  {
    nom: 'docs',
    // La tête ENREGISTRÉE sur l'étape, jamais `journal.tete` — celui-ci est réécrit par l'étape
    // `rebase` du lot SUIVANT, et un `docs` vert du lot précédent serait alors sauté à tort.
    dejaFaite(ctx, journal) {
      return journal.etapes.docs?.etat === 'vert' && journal.etapes.docs.tete === ctx.tete
    },
    jouer(ctx, journal) {
      const { racine } = ctx
      const touches = ctx.questions.ceQuiChange(journal.base, journal.tete).chemins()
      // La saleté est lue AVANT toute décision de saut : le hook `post-rewrite` d'un rebase MANUEL a
      // pu régénérer des dérivés sans les committer, alors que la plage ne touche aucune source de
      // doc. `touchesDocSources` ne court-circuite donc que la RÉGÉNÉRATION, jamais le COMMIT —
      // sauter celui-ci laisserait l'arbre sale jusqu'aux gates, qui le refusent.
      const salesAvant = ctx.questions.cheminsSales()
      const regenerer = touchesDocSources(touches, sourcesMesurees(racine))
      if (!regenerer && !salesAvant.length) return { ok: true, dit: 'aucune source de doc dans la plage, arbre propre : docs inchangés' }
      if (regenerer) {
        const check = ctx.docs('--check')
        // Seul un rouge que la régénération GUÉRIT la déclenche (`executer`, build-all.mjs) : un
        // cliquet, un vérificateur ou un refus rendrait un `docs:build` vain, ou le masquerait.
        if (check.status !== 0 && check.status !== CODE_CORPS_PERIME) {
          const nommes = rougesNommes(check.stderr)
          return {
            ok: false,
            raison: `\`build-all --check\` rouge, que \`docs:build\` ne guérit pas (${natureDuRouge({ status: check.status, signal: check.signal, code: check.error?.code ?? null })})${nommes.length ? ` :\n${nommes.map((r) => `    ${r}`).join('\n')}` : ''}`,
          }
        }
        if (check.status === CODE_CORPS_PERIME) {
          ctx.journaliser('[publier] docs — `--check` : dérivés périmés, passe COMPLÈTE de build-all\n')
          const passe = ctx.docs('--quiet')
          if (passe.status !== 0)
            return {
              ok: false,
              raison: `build-all a rendu ${passe.status} : docs/ possiblement incohérent — \`git checkout -- docs/\` puis corriger la cause (rien n'a été staged ni commité)`,
            }
        }
      }
      const agents = synchroniserAgents(ctx)
      if (!agents.ok) return agents
      const chemins = ctx.questions.cheminsSales()
      const { manuscrits } = partitionSales(chemins, ctx.generators)
      if (manuscrits.length)
        return { ok: false, raison: `doc MANUSCRIT modifié par la régénération :\n${manuscrits.map((c) => `    ${c}`).join('\n')}` }
      if (!chemins.length) return { ok: true, dit: 'docs dérivés déjà à jour : rien à committer' }
      const numeros = numerosDeLaPlage(ctx.questions, journal)
      if (!numeros.length) return { ok: false, raison: REFUS_SANS_TICKET }
      return commettreDerives(ctx, { chemins, numeros, motif: MOTIF_APRES_REBASE, journal })
    },
  },
  {
    // PUSH DE LA BRANCHE : c'est lui qui DÉCLENCHE la CI, et la CI est la porte (#1776). Le rebase a
    // réécrit l'histoire de la branche, donc `--force-with-lease` : il n'écrase que ce qu'on a lu.
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
    // ATTENTE DU VERDICT CI sur la TÊTE, lue par son COMMIT : c'est ce sha-là que le ruleset exigera
    // vert au fast-forward. Le temps passé ici est du temps d'ATTENTE, pas du temps machine local —
    // le journal les sépare (`attenteCiSecondes`).
    nom: 'ci',
    dejaFaite(ctx, journal) {
      const vue = journal.etapes.ci
      return vue?.etat === 'vert' && vue.tete === ctx.tete && vue.detail?.etat === 'verte'
    },
    jouer(ctx, journal) {
      const debut = Date.now()
      const fin = debut + ctx.options.ciTimeoutMin * 60_000
      const attendu = (v) => ({ ...v, detail: { ...(v.detail ?? {}), attenteCiSecondes: (Date.now() - debut) / 1000 } })
      let dernier = { etat: 'absente' }
      while (Date.now() < fin) {
        const vu = ctx.coursesCi(journal.tete)
        if (!vu.disponible) ctx.journaliser(`[publier] ci — courses non lues : ${vu.raison}\n`)
        else {
          dernier = verdictDesRuns(vu.valeur, journal.tete)
          const id = dernier.course?.databaseId
          const url = id ? `https://github.com/${DEPOT}/actions/runs/${id}` : null
          ctx.journaliser(`[publier] ci — ${dernier.etat}${url ? ` — ${url}` : ''}\n`)
          if (dernier.etat === 'verte') return attendu({ ok: true, detail: dernier, dit: `course ${id} verte` })
          if (dernier.etat === 'rouge' || dernier.etat === 'annulee')
            return attendu({
              ok: false,
              detail: dernier,
              raison:
                `course CI ${dernier.etat}${id ? ` (${id})` : ''} sur ${journal.tete.slice(0, 9)} — RIEN n'est entré `
                + `dans main. Lire le job/step rouge : ${url ?? `gh run list --commit ${journal.tete.slice(0, 12)}`}`,
            })
        }
        attendre(PERIODE_SONDE_MS)
      }
      return attendu({
        indetermine: true,
        detail: dernier,
        raison: `aucun verdict de la CI en ${ctx.options.ciTimeoutMin} min sur ${journal.tete.slice(0, 9)} — rien n'est entré dans main`,
      })
    },
  },
  {
    // FAST-FORWARD de `main` sur une tête dont la CI est VERTE. Le ruleset `main` refuse tout le
    // reste côté serveur ; ici on ne fait que le geste, et on RELANCE quand le tronc a bougé pendant
    // l'attente CI (patron #1751) — la tête rebasée devra repasser par sa propre course.
    nom: 'ff-main',
    dejaFaite(ctx, journal) {
      if (!journal.tete) return false
      const vu = ctx.questions.estAncetre(journal.tete, TRONC.suivi)
      return vu.disponible && !vu.absent && vu.valeur === true
    },
    jouer(ctx, journal) {
      const avant = ctx.tronc()
      if (!avant.disponible) return { ok: false, raison: `origin non consultable avant le fast-forward : ${avant.raison}` }
      const vuAvant = jugerLeTronc(journal, avant.sha, 'origin/main a bougé pendant l’attente CI')
      if (vuAvant) return vuAvant
      const vu = ctx.pousser({ vers: TRONC.nom })
      if (!reussi(vu)) {
        // Le tronc se REMESURE après un refus : origin/main peut recevoir des commits entre la
        // lecture d'amont et le push, et git refuse alors en `non-fast-forward` — c'est la MÊME
        // relance, jugée par la MÊME décision, pas une panne.
        const apres = ctx.tronc()
        const vuApres = apres.disponible ? jugerLeTronc(journal, apres.sha, 'origin/main a bougé pendant le push') : null
        if (vuApres) return vuApres
        return { ok: false, raison: `fast-forward de main REFUSÉ :\n${refusDeGit(vu)}` }
      }
      return { ok: true, dit: `${journal.tete.slice(0, 9)} entré dans main en fast-forward` }
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
      const commits = ctx.questions.commitsDeLaPlage(`${journal.base}..${journal.tete}`)
      const numeros = [...new Set(commits.flatMap((c) => numerosCites(c.message)))]
      const fermes = new Set(commits.flatMap((c) => numerosFermes(c.message)))
      const ci = journal.etapes.ci?.detail ?? { etat: 'non lue' }
      const rates = []
      const poses = []
      for (const numero of numeros) {
        const vue = ctx.lireTicket(numero)
        if (!vue.ok) {
          rates.push(`#${numero} : ${vue.raison}`)
          continue
        }
        const corpsVus = vue.corps
        if (corpsVus.some((c) => c.includes(marquePublication(journal.tete)))) {
          ctx.journaliser(`[publier] pilotage — #${numero} déjà piloté\n`)
          continue
        }
        const fermeParCi = corpsVus.some((c) => commits.some((k) => c.includes(marqueDe(k.sha))))
        const corps = corpsDePilotage({
          numero,
          base: journal.base,
          tete: journal.tete,
          commits,
          ci,
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
      journal.etat = 'vert'
      return { ok: true, dit: `publication complète de ${journal.tete?.slice(0, 9)}` }
    },
  },
]
