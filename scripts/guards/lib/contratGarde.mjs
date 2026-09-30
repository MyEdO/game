// CONTRAT d'une garde d'appel d'outil (#2125) : `garde = { nom, outils, evaluer(entree, contexte) }`,
// `evaluer` PUR (ni stdin, ni sortie, ni état de module), éventuellement `async`. Il rend `null`, un
// verdict, ou une liste de verdicts :
//   - `{ decision: 'deny', raison }` — un refus, dont la raison dit quoi faire à la place ;
//   - `{ contexte }` — du contexte transmis à l'agent ;
//   - `{ trace: { fichier, ligne } }` — une ligne que le répartiteur AJOUTE au fichier.
// Le répartiteur (`scripts/hooks/repartiteur.mjs`) lit, construit le contexte, évalue et cumule.
// Aucune garde ne DEMANDE (`ask`) : doctrine `user-doctrine-gardes-jamais-de-ask` (2026-09-28).

/** La commande shell d'une entrée de hook (`''` sans commande). */
export const commandeDe = (entree) => String(entree?.tool_input?.command ?? '')

/** Le `tool_input` d'une entrée de hook, `null` s'il n'est pas un objet. */
export const entreeDOutil = (entree) => (entree?.tool_input && typeof entree.tool_input === 'object' ? entree.tool_input : null)

/** Les familles d'outil : LECTURE passe sans garde, ÉDITION est jugée par les gardes d'écriture,
 *  SHELL (un `tool_input` à champ `command`) par les gardes de commande ; la PASSERELLE appelle
 *  l'outil que nomme son `tool_input.tool`. */
export const LECTURE = 'lecture'
export const EDITION = 'edition'
export const SHELL = 'shell'
export const PASSERELLE = 'passerelle'

const PREFIXE_LEAN_CTX = 'mcp__lean-ctx__'

/** Motif de matcher qui couvre TOUT outil lean-ctx : un outil non classé y passe, et se fait refuser
 *  (garde `canal-outil`). */
export const MOTIF_LEAN_CTX = `${PREFIXE_LEAN_CTX}.*`

/**
 * CLASSEMENT des outils de lean-ctx 3.10.2 (`C:\Users\gauch\.local\bin\lean-ctx.exe`), par nom nu :
 * la seule table. Un outil ABSENT n'est dans aucune famille gardée — la garde `canal-outil` le refuse.
 * LECTURE admet les outils qui n'écrivent que l'état interne de lean-ctx, hors du dépôt
 * (`~/.config/lean-ctx/{knowledge,sessions,read_cache,graphs,memory,…}`, mesuré le 2026-09-30).
 */
export const FAMILLES_LEAN_CTX = Object.freeze({
  ctx_read: LECTURE, ctx_smart_read: LECTURE, ctx_multi_read: LECTURE, ctx_search: LECTURE,
  ctx_semantic_search: LECTURE, ctx_symbol: LECTURE, ctx_glob: LECTURE, ctx_tree: LECTURE,
  ctx_compose: LECTURE, ctx_overview: LECTURE, ctx_repomap: LECTURE, ctx_outline: LECTURE,
  ctx_explore: LECTURE, ctx_callgraph: LECTURE, ctx_graph: LECTURE, ctx_impact: LECTURE,
  ctx_architecture: LECTURE, ctx_routes: LECTURE, ctx_smells: LECTURE, ctx_quality: LECTURE,
  ctx_review: LECTURE, ctx_expand: LECTURE, ctx_delta: LECTURE, ctx_retrieve: LECTURE,
  ctx_url_read: LECTURE, ctx_knowledge: LECTURE, ctx_session: LECTURE, ctx_summary: LECTURE,
  ctx_memory: LECTURE, ctx_cache: LECTURE, ctx_index: LECTURE, ctx_context: LECTURE,
  ctx_metrics: LECTURE, ctx_gain: LECTURE, ctx_heatmap: LECTURE, ctx_cost: LECTURE, ctx_perf: LECTURE,
  ctx_verify: LECTURE, ctx_compare: LECTURE, ctx_analyze: LECTURE, ctx_benchmark: LECTURE,
  ctx_discover: LECTURE, ctx_discover_tools: LECTURE, ctx_load_tools: LECTURE, ctx_plan: LECTURE,
  ctx_fill: LECTURE, ctx_compress: LECTURE, ctx_response: LECTURE,
  ctx_patch: EDITION,
  ctx_shell: SHELL, shell: SHELL,
  ctx_call: PASSERELLE,
})

/** Le nom nu d'un outil lean-ctx, `null` hors lean-ctx. */
export const nomLeanCtx = (outil) => (String(outil).startsWith(PREFIXE_LEAN_CTX) ? String(outil).slice(PREFIXE_LEAN_CTX.length) : null)

/** La famille d'un outil lean-ctx par son nom nu, `null` s'il n'est pas classé. */
export const familleLeanCtx = (nu) => (Object.hasOwn(FAMILLES_LEAN_CTX, nu) ? FAMILLES_LEAN_CTX[nu] : null)

const outilsDeFamille = (famille) => Object.keys(FAMILLES_LEAN_CTX).filter((nu) => FAMILLES_LEAN_CTX[nu] === famille).map((nu) => PREFIXE_LEAN_CTX + nu)

/** Les canaux shell : Bash, PowerShell, et la famille SHELL de lean-ctx. */
export const OUTILS_SHELL = ['Bash', 'PowerShell', ...outilsDeFamille(SHELL)]

/** Les canaux d'écriture de fichier : Write, Edit, et la famille ÉDITION de lean-ctx (`ctx_patch`, le
 *  canal prescrit par `~/.claude/CLAUDE.md`). */
export const OUTILS_ECRITURE = ['Write', 'Edit', ...outilsDeFamille(EDITION)]

/** Les canaux d'écriture qui CRÉENT un fichier : `Edit` n'en crée pas. */
export const OUTILS_CREATION = OUTILS_ECRITURE.filter((outil) => outil !== 'Edit')

/** L'outil `nom` est-il couvert par `outils` ? Une entrée `….*` (`MOTIF_LEAN_CTX`) couvre son préfixe. */
export const outilCouvert = (outils, nom) =>
  outils.some((o) => (o.endsWith('.*') ? String(nom).startsWith(o.slice(0, -2)) : o === nom))

const echapper = (texte) => texte.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/**
 * Le matcher d'une liste d'`outils` pour le moteur d'une surface. Sans `MOTIF_LEAN_CTX` et si la
 * surface lit une liste de noms EXACTS (`listeExacte`), la liste. Sinon une regex ANCRÉE (non ancrée,
 * `Edit` couvre `NotebookEdit`) : les noms hors lean-ctx et les lean-ctx de la famille LECTURE nommés,
 * puis, avec le motif, tout outil lean-ctx HORS LECTURE — par lookahead si le moteur le sait
 * (`lookaround`), sinon tout outil lean-ctx.
 * @param {string[]} outils @param {{ lookaround: boolean, listeExacte: RegExp | null }} moteur
 */
export function matcherDOutils(outils, { lookaround, listeExacte }) {
  if (!outils.includes(MOTIF_LEAN_CTX)) return listeExacte ? outils.join('|') : `^(?:${outils.map(echapper).join('|')})$`
  const nommes = outils.filter((o) => o !== MOTIF_LEAN_CTX && (nomLeanCtx(o) === null || familleLeanCtx(nomLeanCtx(o)) === LECTURE))
  const lectures = Object.keys(FAMILLES_LEAN_CTX).filter((nu) => FAMILLES_LEAN_CTX[nu] === LECTURE)
  const horsLecture = lookaround ? `(?!(?:${lectures.map(echapper).join('|')})$)` : ''
  return `^(?:${[...nommes.map(echapper), `${echapper(PREFIXE_LEAN_CTX)}${horsLecture}.+`].join('|')})$`
}

/** Le nom nu de l'outil qu'une passerelle appelle (`''` sans `tool`). */
export const outilAppele = (entree) => String(entreeDOutil(entree)?.tool ?? '').replace(PREFIXE_LEAN_CTX, '')

/**
 * Les écritures d'une entrée de hook, chacune à la forme d'un `tool_input` à UN fichier : le
 * `tool_input` de `Write`/`Edit`/`ctx_patch`, ou chaque op du lot `ops` de `ctx_patch` (qui porte son
 * propre `path`, le `path` de tête à défaut). Un `dry_run` n'écrit rien : aucune écriture.
 * @returns {object[]}
 */
export function ecrituresDe(entree) {
  const input = entreeDOutil(entree)
  if (input === null || input.dry_run === true) return []
  if (!Array.isArray(input.ops)) return [input]
  return input.ops.filter((op) => op && typeof op === 'object').map((op) => ({ path: input.path, ...op }))
}

/** Le chemin visé : `file_path` (`Write`, `Edit`), `path` (`ctx_patch`) ; `undefined` sans chemin, ou
 *  fait de blancs. */
export const cheminVise = (ecrit) => {
  const chemin = ecrit?.file_path ?? ecrit?.path
  return typeof chemin === 'string' && chemin.trim() !== '' ? chemin : undefined
}

/** Le texte posé : `new_string` (`Edit`), `content` (`Write`), `new_text` (`ctx_patch`), `replace`
 *  (`ctx_patch` op `replace_all`). */
export const texteNeuf = (ecrit) => ecrit?.new_string ?? ecrit?.content ?? ecrit?.new_text ?? ecrit?.replace

/** Le texte remplacé, quand l'écriture le porte : `old_string` (`Edit`), `old_text`, `find` (`ctx_patch`). */
export const texteRemplace = (ecrit) => ecrit?.old_string ?? ecrit?.old_text ?? ecrit?.find

/** L'écriture pose-t-elle le fichier ENTIER ? `Write` (`content`), `ctx_patch` op `create`. */
export const ecritLeFichierEntier = (ecrit) => typeof ecrit?.content === 'string' || ecrit?.op === 'create'

/** Les ops ANCRÉES de `ctx_patch` qui remplacent des lignes : `line`, ou `start_line`..`end_line`. */
const OPS_DE_LIGNES = new Set(['set_line', 'replace_lines', 'delete'])

/** Le texte que l'écriture remplace se RÉSOUT-il ? Porté, fichier entier, ou op ancrée
 *  (`insert_after` compris) ; sinon (`replace_symbol`, op inconnue) l'écriture n'est pas jugeable. */
export const remplaceResoluble = (ecrit) =>
  texteRemplace(ecrit) !== undefined || ecritLeFichierEntier(ecrit) || ecrit?.op === 'insert_after' || OPS_DE_LIGNES.has(ecrit?.op)

/** Les lignes que vise une op ancrée dans `contenu` (le fichier AVANT écriture) ; `''` pour
 *  `insert_after`, qui n'en remplace aucune ; `undefined` hors op ancrée ou ancre illisible. */
export function lignesVisees(ecrit, contenu) {
  if (ecrit?.op === 'insert_after') return ''
  if (!OPS_DE_LIGNES.has(ecrit?.op)) return undefined
  const debut = Number(ecrit.start_line ?? ecrit.line)
  const fin = Number(ecrit.end_line ?? debut)
  if (!Number.isInteger(debut) || !Number.isInteger(fin) || debut < 1 || fin < debut) return undefined
  return String(contenu ?? '').split(/\r?\n/).slice(debut - 1, fin).join('\n')
}

/** Le texte que l'écriture remplace, AVANT elle : le texte remplacé qu'elle porte, sinon le fichier
 *  entier (`Write`, `create`) ou les lignes visées (op ancrée) lus par `lire()`, sinon `''`. */
export function texteAvant(ecrit, lire) {
  const remplace = texteRemplace(ecrit)
  if (remplace !== undefined) return remplace
  if (ecritLeFichierEntier(ecrit)) return lire()
  return lignesVisees(ecrit, lire()) ?? ''
}

/** Le verdict d'un refus d'évaluateur `{ reason }`, `null` sans refus. */
export const verdictDe = (d) => (d ? { decision: 'deny', raison: d.reason } : null)

/**
 * Décision d'ensemble d'un cumul de refus `{ reason }` : `null` sans refus, sinon un `deny` qui porte
 * leurs raisons, jointes.
 * @param {Array<{ reason: string } | null | undefined>} decisions
 * @returns {{ decision: 'deny', reason: string } | null}
 */
export function decisionCumulee(decisions) {
  const refus = decisions.filter(Boolean)
  return refus.length ? { decision: 'deny', reason: refus.map((d) => d.reason).join(' || ') } : null
}
