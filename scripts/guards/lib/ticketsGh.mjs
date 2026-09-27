// LECTURE DES TICKETS GITHUB — la couture REST des scripts qui LISENT une issue depuis une session
// Claude Code (#1813) : `fermer-depuis-main.mjs`, `fermetures-non-citees.mjs` et le train de
// publication, et la MESURE de `board.mjs` (`issuesDeGh`). Ce n'est PAS la seule ROUTE `gh` du
// dépôt : `synchroniser` (`board.mjs`), `signaler` (signaler-rouge.mjs) et
// `deps-report.mjs` (deps-report.mjs:85,89) parlent d'une issue ou d'un Project en GraphQL ou par
// sous-commande CLI — ils tournent sur RUNNER, où GraphQL n'est pas refusé, et le solde de #1804 les
// en ÉCARTE explicitement, mesurés CI-seulement.
//
// LE FAIT : `gh issue view|list|comment`, `gh label list` et `gh api graphql` sont servis par
// GraphQL, refusé HTTP 403 aux sessions Claude Code (« GitHub GraphQL is not available from Claude
// Code sessions; use the REST API »). Et `gh api --paginate` est refusé lui aussi dès la page
// SUIVANTE (« This GitHub API path is not available in agent sessions ») : son objet d'erreur entre
// DANS le flux de sortie là où le consommateur attend un tableau. Il ne reste qu'une route ouverte à
// TOUTES les sessions : `gh api repos/{owner}/{repo}/…`, page par page.
//
// CONTRAT de la couture : `appel(args, { input }) => { ok, stdout, raison }`. Les fonctions de
// LECTURE ne spawnent RIEN — elles reçoivent `appel`, et c'est ce qui rend leur banc hermétique.
// `appelGhRunner` est le SEUL site de spawn du module, et l'enrobeur des scripts de runner qui
// passent par cette couture — `board.mjs` y compris : son `gh` qui JETTE (`board.mjs`) est un
// CONTRAT différent posé sur ce spawn-ci, pas un second spawn. Deux enrobeurs vivent hors d'elle,
// avec le même contrat de sortie : le train de publication garde le sien (`spawnSync` borné en
// temps, contrainte qu'il est seul à porter), et `signaler-rouge.mjs` le sien
// (`gh` de signaler-rouge.mjs), qui LÈVE au lieu de rendre un verdict — un signalement muet ne sert à
// rien.
//
// Aucune FERMETURE ici. Le dépôt en compte DEUX sites, recensés et déclarés par
// `sitesDeFermeture.mjs` : `fermer-depuis-main.mjs` pour les tickets SOLDÉS du job `fermetures`, et
// `signaler-rouge.mjs` pour la survivante d'un signalement de course rouge. Le premier porte le geste
// que la porte de commit impose, et il n'est hors de portée d'un tiers que parce qu'il est une
// FEUILLE que rien n'importe (`modulesFeuilles.mjs`) : le vocabulaire de lecture d'une plage fermante
// vit dans `plageFermante.mjs`, et le cliquet « le train n'importe pas le module qui FERME »
// (`publier.test.mjs`) le mesure. Un cliquet qui ne lirait que des argv littéraux serait aveugle à
// un appel indirect, qui n'en laisse aucun.
import { execFileSync } from 'node:child_process'

/** Le dépôt, `<owner>/<repo>` — SOURCE UNIQUE. Il vit avec la couture qui construit les routes REST
 *  (`cheminTicket`) : quatre copies littérales de cette chaîne, c'est quatre dépôts à corriger le jour
 *  d'un renommage, et trois qui restent muettes. */
export const DEPOT = 'cgauche/game'

/** Taille de page REST demandée (maximum autorisé par l'API GitHub). */
export const PAR_PAGE = 100

/** Plafond de pages, ANTI-EMBALLEMENT — jamais une borne de lecture. Le dépasser REFUSE la lecture :
 *  une liste TRONQUÉE perdrait une marque d'idempotence, et l'appelant reposterait. */
export const PLAFOND_PAGES = 50

/** Borne du motif de refus. Large : `err.message` d'`execFileSync` commence par la commande ENTIÈRE
 *  (« Command failed: gh api repos/… -X POST -F body=@- »), qui mange à elle seule ~120 caractères —
 *  une borne étroite ne laisserait rien passer du motif. */
export const BORNE_RAISON = 600

/**
 * L'enrobeur `gh` des scripts de RUNNER — un seul, paramétré. `gh` sur un runner GitHub Actions
 * hérite d'un stdin jamais fermé : sans `stdio[0] = 'ignore'` (l'équivalent programmatique du
 * `< /dev/null` de la ligne de commande, mesuré au grounding L2), il peut rester pendu à attendre une
 * entrée qui ne vient pas. Un appel qui PASSE une entrée la referme après écriture — `input` impose
 * `stdio[0] = 'pipe'` et Node ferme le tube —, donc l'invariant tient dans les deux cas.
 * JAMAIS `shell: true` : `gh` est un exécutable, et sous `cmd.exe` le `&` d'une query
 * (`…&per_page=100`) coupe la commande en deux (mesuré 2026-09-04, HTTP 422 puis « 'per_page' n'est
 * pas reconnu en tant que commande interne »).
 * Le motif d'un refus est sur STDERR ; `err.message` ne porte que la commande et le code.
 * `executer` n'est là QUE pour rendre le banc hermétique : un banc qui prouverait cet enrobeur en
 * appelant le vrai `gh` partirait sur le réseau, et la gate le jouerait sans jeton.
 * @param {{cwd:string, maxBuffer?:number, executer?:Function}} p
 * @returns {(args: string[], options?: {input?: string}) => {ok:boolean, stdout?:string, raison?:string}}
 */
export const appelGhRunner = ({ cwd, maxBuffer = 64 * 1024 * 1024, executer = execFileSync }) => (args, { input } = {}) => {
  try {
    return {
      ok: true,
      stdout: executer('gh', args, {
        cwd,
        encoding: 'utf8',
        maxBuffer,
        stdio: [input === undefined ? 'ignore' : 'pipe', 'pipe', 'pipe'],
        ...(input === undefined ? {} : { input }),
      }),
    }
  } catch (err) {
    return { ok: false, raison: String(err?.stderr || err?.message || err).trim().slice(0, BORNE_RAISON) }
  }
}

/** Route REST d'un ticket. @param {string} depot `<owner>/<repo>` @param {string|number} numero */
export const cheminTicket = (depot, numero) => `repos/${depot}/issues/${numero}`

/**
 * Les entrées d'UNE page REST. PURE. Une page est un TABLEAU ; une réponse d'erreur de l'API est un
 * OBJET (`{"message": …}`) — sans cette distinction, un refus serait lu comme une page VIDE, et
 * l'appelant conclurait à l'absence d'une marque d'idempotence qu'il n'a jamais lue.
 * @param {string} stdout @returns {object[]}
 */
export function corpsDeLaPage(stdout) {
  const lu = JSON.parse(stdout)
  if (!Array.isArray(lu)) throw new Error(`réponse REST non tabulaire : ${JSON.stringify(lu).slice(0, 200)}`)
  return lu
}

/**
 * Toutes les entrées d'une liste REST, page par page. JAMAIS `--paginate`.
 * C'est la LISTE qui dit où elle s'arrête : une page qui rend moins de `PAR_PAGE` entrées est la
 * dernière. Aucun compteur EXTERNE ne borne la boucle — un compteur lu dans un appel ANTÉRIEUR peut
 * être faux (une entrée arrivée entre les deux appels) et faire manquer la dernière page.
 * Un refus sur une page quelconque rend `ok:false`, jamais une liste partielle.
 *
 * ARRÊT ANTICIPÉ, `assezLu` : un appelant qui demande à l'API un ORDRE (`sort=…&direction=…`) et ne
 * cherche qu'une PARTIE de la liste s'arrête dès que ce qu'il cherche est LÀ. Le prédicat lit les
 * entrées DÉJÀ accumulées, APRÈS chaque page entière : il ne peut donc jamais tronquer une page, et
 * son absence laisse la lecture exhaustive à l'octet. Ce n'est PAS un compteur externe — il ne dit
 * pas combien de pages lire, il lit ce qui est arrivé. Un prédicat qui ne se satisfait jamais
 * ramène au cas exhaustif, plafond compris.
 * @param {string} chemin route REST, query de tête comprise (`repos/o/r/issues?state=closed`)
 * @param {(args: string[]) => {ok:boolean, stdout?:string, raison?:string}} appel
 * @param {{assezLu?: (entrees: object[]) => boolean}} [options] arrêt anticipé, évalué après chaque page
 * @returns {{ok:true, entrees:object[]} | {ok:false, raison:string}}
 */
export function pagesRest(chemin, appel, { assezLu } = {}) {
  const jointeur = chemin.includes('?') ? '&' : '?'
  const entrees = []
  for (let page = 1; page <= PLAFOND_PAGES; page += 1) {
    const vue = appel(['api', `${chemin}${jointeur}per_page=${PAR_PAGE}&page=${page}`])
    if (!vue.ok) return { ok: false, raison: vue.raison }
    let lues
    try {
      lues = corpsDeLaPage(vue.stdout)
    } catch (e) {
      return { ok: false, raison: e.message }
    }
    entrees.push(...lues)
    if (lues.length < PAR_PAGE) return { ok: true, entrees }
    if (assezLu?.(entrees)) return { ok: true, entrees }
  }
  return { ok: false, raison: `${chemin} : plus de ${PLAFOND_PAGES} pages de ${PAR_PAGE} entrées` }
}

/**
 * État et corps des commentaires d'un ticket.
 * @param {{depot:string, numero:string|number, appel:(args:string[]) => {ok:boolean, stdout?:string, raison?:string}}} p
 * @returns {{ok:true, etat:string, corps:string[]} | {ok:false, raison:string}}
 */
export function lireTicket({ depot, numero, appel }) {
  const chemin = cheminTicket(depot, numero)
  const vue = appel(['api', chemin])
  if (!vue.ok) return { ok: false, raison: vue.raison }
  let issue
  try {
    issue = JSON.parse(vue.stdout)
  } catch (e) {
    return { ok: false, raison: `réponse gh illisible (${e.message})` }
  }
  // La route `/issues/<n>` sert AUSSI les pull requests : la refuser AVANT toute lecture.
  if (issue?.pull_request) return { ok: false, raison: `#${numero} est une pull request, pas un ticket` }
  const pages = pagesRest(`${chemin}/comments`, appel)
  if (!pages.ok) return { ok: false, raison: pages.raison }
  return { ok: true, etat: String(issue?.state ?? ''), corps: pages.entrees.map((c) => String(c?.body ?? '')) }
}

/**
 * Pose un commentaire sur un ticket. Le corps passe par l'ENTRÉE STANDARD : `-F body=@-` fait lire
 * la valeur du champ sur stdin (`gh api --help`, `cli/cli` 2.45.0 : « if the value starts with `@`,
 * the rest of the value is interpreted as a filename to read the value from. Pass `-` to read from
 * standard input. »). Un solde entier fait plusieurs kilo-octets : ni la liste d'arguments du
 * processus, ni un fichier temporaire à écrire puis à balayer.
 * @param {{depot:string, numero:string|number, corps:string, appel:(args:string[], o?:{input?:string}) => {ok:boolean, stdout?:string, raison?:string}}} p
 */
export const poserCommentaire = ({ depot, numero, corps, appel }) =>
  appel(['api', `${cheminTicket(depot, numero)}/comments`, '-X', 'POST', '-F', 'body=@-'], { input: corps })
