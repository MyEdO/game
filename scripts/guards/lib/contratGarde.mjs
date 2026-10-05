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

/** Les familles d'outil : LECTURE passe sans garde, hors ses actions refusées ; ÉDITION est jugée par
 *  les gardes d'écriture, SHELL (un `tool_input` à champ `command`) par les gardes de commande ; la
 *  PASSERELLE n'appelle que les outils de `LECTURES_LIBRES` que nomment ses clés `CLES_PASSERELLE`. */
export const LECTURE = 'lecture'
export const EDITION = 'edition'
export const SHELL = 'shell'
export const PASSERELLE = 'passerelle'

const PREFIXE_LEAN_CTX = 'mcp__lean-ctx__'

/** Motif de matcher qui couvre TOUT outil lean-ctx : un outil non classé y passe, et se fait refuser
 *  (garde `canal-outil`). */
export const MOTIF_LEAN_CTX = `${PREFIXE_LEAN_CTX}.*`

/** Le classement d'un outil : sa famille, et les valeurs de son `action` refusées. */
const classe = (famille, ...actionsRefusees) => Object.freeze({ famille, actionsRefusees: Object.freeze(actionsRefusees) })
const L = classe(LECTURE)

/** La version de lean-ctx, et son tag, aux sources de laquelle `FAMILLES_LEAN_CTX` et `OPS_CTX_PATCH` sont
 *  audités ; le binaire de l'hôte y est confronté (`scripts/hooks/canal-outil-guard.test.mjs`). */
export const LEAN_CTX_VERSION = Object.freeze({ version: '3.10.2', tag: 'd4f9beb3f' })

/**
 * CLASSEMENT des outils de lean-ctx `LEAN_CTX_VERSION`, par nom nu :
 * la seule table. Un outil ABSENT n'est dans aucune famille gardée — la garde `canal-outil` le refuse.
 * LECTURE admet les outils qui n'écrivent que l'état interne de lean-ctx ; une action qui écrit hors de
 * lui, IMPORTE un fichier désigné dans cet état ou lance un programme est REFUSÉE. Sources au tag de
 * `LEAN_CTX_VERSION` : ctx_fill (`tools/ctx_fill.rs` l.31) et ctx_benchmark (`tools/ctx_benchmark.rs` l.12)
 * lisent un `path` comme ctx_read ; ctx_compress n'écrit que sa session (`tools/ctx_compress.rs`
 * l.205) ; ctx_plan, ctx_response, ctx_discover n'écrivent rien. Chaînes du binaire :
 * - ctx_knowledge : « export/import: bundle directory (OKF) or file path », « ERROR: import requires
 *   `path` (a file or an OKF directory) » ;
 * - ctx_session : « ctx_session.export », « Export write failed: », « ERROR: path is required for
 *   action=import » ;
 * - ctx_verify : « action=proof|v2 for Lean4 proof verification » ;
 * - ctx_graph, ctx_index, ctx_impact, ctx_search : « graphs », « bm25_index.bin.zst » (`~/.config/lean-ctx/`) ;
 * - ctx_cache : « ANTIPATTERN: does NOT affect disk files ».
 */
export const FAMILLES_LEAN_CTX = Object.freeze({
  ctx_read: L, ctx_smart_read: L, ctx_multi_read: L, ctx_search: L, ctx_semantic_search: L, ctx_symbol: L,
  ctx_glob: L, ctx_tree: L, ctx_compose: L, ctx_overview: L, ctx_repomap: L, ctx_outline: L, ctx_explore: L,
  ctx_callgraph: L, ctx_graph: L, ctx_impact: L, ctx_architecture: L, ctx_routes: L, ctx_smells: L,
  ctx_quality: L, ctx_review: L, ctx_expand: L, ctx_delta: L, ctx_retrieve: L, ctx_url_read: L,
  ctx_knowledge: classe(LECTURE, 'export', 'import'),
  ctx_session: classe(LECTURE, 'export', 'import'),
  ctx_summary: L, ctx_memory: L, ctx_cache: L, ctx_index: L, ctx_context: L, ctx_metrics: L, ctx_gain: L,
  ctx_heatmap: L, ctx_cost: L, ctx_perf: L,
  ctx_verify: classe(LECTURE, 'proof', 'v2'),
  ctx_compare: L, ctx_analyze: L, ctx_benchmark: L, ctx_discover: L, ctx_discover_tools: L,
  ctx_load_tools: L, ctx_plan: L, ctx_fill: L, ctx_compress: L, ctx_response: L,
  ctx_patch: classe(EDITION),
  ctx_shell: classe(SHELL), shell: classe(SHELL),
  ctx_call: classe(PASSERELLE),
})

/** Le nom nu d'un outil lean-ctx, `null` hors lean-ctx. */
export const nomLeanCtx = (outil) => (String(outil).startsWith(PREFIXE_LEAN_CTX) ? String(outil).slice(PREFIXE_LEAN_CTX.length) : null)

const classement = (nu) => (Object.hasOwn(FAMILLES_LEAN_CTX, nu) ? FAMILLES_LEAN_CTX[nu] : null)

/** La famille d'un outil lean-ctx par son nom nu, `null` s'il n'est pas classé. */
export const familleLeanCtx = (nu) => classement(nu)?.famille ?? null

/** Les valeurs d'`action` refusées d'un outil lean-ctx par son nom nu. */
export const actionsRefuseesDe = (nu) => classement(nu)?.actionsRefusees ?? []

/** L'appel DIRECT à l'outil `nu` porte-t-il une action refusée ? Une `action` qui n'est pas une chaîne
 *  ne se juge pas : refusée. */
export function actionRefusee(nu, entree) {
  const action = entreeDOutil(entree)?.action
  if (actionsRefuseesDe(nu).length === 0 || action === undefined) return false
  return typeof action !== 'string' || actionsRefuseesDe(nu).includes(action.trim().toLowerCase())
}

/** Les outils LECTURE sans action refusée, par nom nu : ceux que le matcher peut exclure du répartiteur. */
export const LECTURES_LIBRES = Object.keys(FAMILLES_LEAN_CTX).filter((nu) => familleLeanCtx(nu) === LECTURE && actionsRefuseesDe(nu).length === 0)

const outilsDeFamille = (famille) => Object.keys(FAMILLES_LEAN_CTX).filter((nu) => familleLeanCtx(nu) === famille).map((nu) => PREFIXE_LEAN_CTX + nu)

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
 * `Edit` couvre `NotebookEdit`) : les noms hors lean-ctx et les lean-ctx de `LECTURES_LIBRES` nommés,
 * puis, avec le motif, tout outil lean-ctx hors `LECTURES_LIBRES` — par lookahead si le moteur le sait
 * (`lookaround`), sinon tout outil lean-ctx.
 * @param {string[]} outils @param {{ lookaround: boolean, listeExacte: RegExp | null }} moteur
 */
export function matcherDOutils(outils, { lookaround, listeExacte }) {
  if (!outils.includes(MOTIF_LEAN_CTX)) return listeExacte ? outils.join('|') : `^(?:${outils.map(echapper).join('|')})$`
  const nommes = outils.filter((o) => o !== MOTIF_LEAN_CTX && (nomLeanCtx(o) === null || LECTURES_LIBRES.includes(nomLeanCtx(o))))
  const horsLecture = lookaround ? `(?!(?:${LECTURES_LIBRES.map(echapper).join('|')})$)` : ''
  return `^(?:${[...nommes.map(echapper), `${echapper(PREFIXE_LEAN_CTX)}${horsLecture}.+`].join('|')})$`
}

/** Les clés de l'outil appelé par la passerelle : `name` (schéma de `ctx_call`), `tool` (chaîne du
 *  binaire « ctx_call(tool=<name>) »). */
export const CLES_PASSERELLE = ['name', 'tool']

/** Le nom nu de l'outil qu'une passerelle appelle, `null` sans clé, avec une clé non-chaîne, ou avec
 *  deux clés qui nomment des outils différents. */
export function outilAppele(entree) {
  const input = entreeDOutil(entree)
  const noms = CLES_PASSERELLE.map((cle) => input?.[cle]).filter((nom) => nom !== undefined)
  if (noms.length === 0 || noms.some((nom) => typeof nom !== 'string')) return null
  const nus = new Set(noms.map((nom) => nomLeanCtx(nom) ?? nom))
  return nus.size === 1 ? [...nus][0] : null
}

/**
 * Les écritures d'une entrée de hook, chacune à la forme d'un `tool_input` à UN fichier : le
 * `tool_input` de `Write`/`Edit`/`ctx_patch`, ou chaque op du lot `ops` de `ctx_patch` (qui porte son
 * propre `path`, le `path` de tête à défaut). Un `dry_run` de `ctx_patch` n'écrit rien : aucune écriture.
 * `dry_run` et `ops` ne se lisent que sur la famille ÉDITION de lean-ctx ; tout autre outil fait UNE
 * écriture, son `tool_input` tel quel.
 * @returns {object[]}
 */
export function ecrituresDe(entree) {
  const input = entreeDOutil(entree)
  if (input === null) return []
  if (familleLeanCtx(nomLeanCtx(entree.tool_name)) !== EDITION) return [input]
  if (input.dry_run === true) return []
  if (!Array.isArray(input.ops)) return [input]
  return input.ops.filter((op) => op && typeof op === 'object').map((op) => ({ path: input.path, ...op }))
}

/** Le lot `ops` de `ctx_patch` est-il ambigu ? Oui s'il n'est pas un tableau, si l'un de ses éléments
 *  n'est pas un objet, ou s'il nomme plus d'un `path` (le sien, celui de tête à défaut) : lean-ctx groupe
 *  un lot par `path` BRUT (`registered/ctx_patch.rs` l.428, `group_ops_by_path`) et applique chaque
 *  groupe à l'état laissé par le précédent (l.148-166, `ctx_patch/mod.rs` l.112) : deux `path` d'un même
 *  fichier y font deux préimages. */
export const lotAmbigu = (input) =>
  input?.ops !== undefined &&
  (!Array.isArray(input.ops) ||
    input.ops.some((op) => !op || typeof op !== 'object' || Array.isArray(op)) ||
    new Set(input.ops.map((op) => op.path ?? input.path)).size > 1)

/** Les clés du schéma MCP de la famille SHELL que les gardes de commande savent juger, lean-ctx
 *  `LEAN_CTX_VERSION` (schéma de `ctx_shell`) : la seule déclaration. Toute autre clé est refusée
 *  (`scripts/hooks/canal-outil-guard.mjs`), `env` compris, comme toute clé d'une version future. */
export const CLES_SHELL = Object.freeze(['command', 'cwd', 'raw', 'inline', 'timeout_ms', 'run_in_background', 'background_action', 'job_id'])

/** Les clés de l'entrée d'un outil SHELL hors de `CLES_SHELL`. */
export const clesHorsSchemaShell = (input) =>
  input !== null && typeof input === 'object' ? Object.keys(input).filter((cle) => !CLES_SHELL.includes(cle)) : []

const opCtxPatch = (formes, { neuf = 'new_text', remplace = null, enLot = true } = {}) =>
  Object.freeze({ formes: Object.freeze(formes.map((forme) => Object.freeze(forme))), neuf, remplace, enLot })

/**
 * Les ops de `ctx_patch`, lean-ctx `LEAN_CTX_VERSION` : la seule déclaration de ses clés. `formes` :
 * les jeux de clés que l'op CONSOMME, hors `path` — une entrée porte les clés d'UNE forme ; `neuf`,
 * `remplace` : la clé de son texte posé, de son texte remplacé ; `enLot` : admise dans `ops[]`, où
 * seule une op ANCRÉE se juge contre la préimage que lean-ctx lui présente (`ctx_patch/apply.rs` l.127).
 * - schéma MCP, `registered/ctx_patch.rs` l.58-69 (`if`/`then`) ;
 * - set_line, replace_lines, insert_after, delete, create : `ctx_patch/anchors.rs` l.94-180 ;
 * - replace_symbol : `ctx_patch/symbol.rs` l.35-58 ;
 * - replace_unique : `registered/ctx_patch.rs` l.348-366 ; replace_all : l.599-623 ;
 * - hors lot : l.196-200 ; déléguées, appliquées à l'état laissé par les ops qui les précèdent :
 *   l.183-187, l.228-255.
 */
export const OPS_CTX_PATCH = Object.freeze({
  set_line: opCtxPatch([['line', 'hash', 'new_text']]),
  replace_lines: opCtxPatch([['start_line', 'start_hash', 'end_line', 'end_hash', 'new_text']]),
  insert_after: opCtxPatch([['line', 'hash', 'new_text']]),
  delete: opCtxPatch([['line', 'hash'], ['start_line', 'start_hash', 'end_line', 'end_hash']], { neuf: null }),
  replace_unique: opCtxPatch([['old_text', 'new_text']], { remplace: 'old_text', enLot: false }),
  replace_symbol: opCtxPatch([['name', 'line', 'end_line', 'new_text']], { enLot: false }),
  create: opCtxPatch([['new_text']], { enLot: false }),
  replace_all: opCtxPatch([['find', 'replace']], { neuf: 'replace', remplace: 'find', enLot: false }),
})

/** Les clés communes à toute op : `path` ; en tête seulement, `dry_run` (`registered/ctx_patch.rs`
 *  l.276-294 : l'élément délégué garde le sien sur celui de tête). */
const COMMUNES_OP = ['path']
const COMMUNES_TETE = ['path', 'dry_run']

const opDe = (objet) => (typeof objet?.op === 'string' && Object.hasOwn(OPS_CTX_PATCH, objet.op) ? OPS_CTX_PATCH[objet.op] : null)

/** Les clés d'une op que sa déclaration ne consomme pas, hors `communes` : celles hors de la forme la plus
 *  proche ; `op` qualifiée si l'op est absente, inconnue, ou hors lot (`enLot` faux dans `ops[]`). */
function clesNonConsommees(objet, communes, dansUnLot) {
  const propres = Object.keys(objet).filter((cle) => cle !== 'op' && !communes.includes(cle))
  const spec = opDe(objet)
  if (spec === null) return [objet.op === undefined ? 'op absente' : `op ${JSON.stringify(objet.op)} inconnue`]
  if (dansUnLot && !spec.enLot) return [`op ${objet.op} hors lot`]
  const horsDe = (forme) => propres.filter((cle) => !forme.includes(cle))
  return spec.formes.map(horsDe).reduce((a, b) => (b.length < a.length ? b : a))
}

/** Les clés de l'entrée `ctx_patch` qu'aucune op ne consomme (`OPS_CTX_PATCH`), préfixées `ops[i].` pour
 *  un élément objet de `ops[]` ; en tête d'un lot, toute clé hors `COMMUNES_TETE` et `ops`. */
export function clesNonAdmises(input) {
  if (input === null || typeof input !== 'object') return []
  if (input.ops === undefined) return clesNonConsommees(input, COMMUNES_TETE, false)
  const tete = Object.keys(input).filter((cle) => cle !== 'ops' && !COMMUNES_TETE.includes(cle))
  const ops = Array.isArray(input.ops) ? input.ops : []
  const elements = ops.flatMap((op, i) =>
    op && typeof op === 'object' && !Array.isArray(op) ? clesNonConsommees(op, COMMUNES_OP, true).map((cle) => `ops[${i}].${cle}`) : [],
  )
  return [...tete, ...elements]
}

/** La valeur de la clé que l'op de `ecrit` déclare pour `role` (`neuf`, `remplace`), `undefined` sans. */
const texteDeLOp = (ecrit, role) => {
  const cle = opDe(ecrit)?.[role]
  return cle ? ecrit[cle] : undefined
}

/** Le chemin visé : `file_path` (`Write`, `Edit`), `path` (`ctx_patch`) ; `undefined` sans chemin, ou
 *  fait de blancs. */
export const cheminVise = (ecrit) => {
  const chemin = ecrit?.file_path ?? ecrit?.path
  return typeof chemin === 'string' && chemin.trim() !== '' ? chemin : undefined
}

/** Le texte posé : `new_string` (`Edit`), `content` (`Write`), la clé `neuf` de son op (`ctx_patch`,
 *  `OPS_CTX_PATCH`). */
export const texteNeuf = (ecrit) => ecrit?.new_string ?? ecrit?.content ?? texteDeLOp(ecrit, 'neuf')

/** Le texte remplacé, quand l'écriture le porte : `old_string` (`Edit`), la clé `remplace` de son op
 *  (`ctx_patch`, `OPS_CTX_PATCH`). */
export const texteRemplace = (ecrit) => ecrit?.old_string ?? texteDeLOp(ecrit, 'remplace')

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
