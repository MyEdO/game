// CONTRAT d'une garde d'appel d'outil (#2125) : `garde = { nom, outils, evaluer(entree, contexte) }`,
// `evaluer` PUR (ni stdin, ni sortie, ni état de module), éventuellement `async`. Il rend `null`, un
// verdict, ou une liste de verdicts :
//   - `{ decision: 'deny', raison }` — un refus, dont la raison dit quoi faire à la place ;
//   - `{ contexte }` — du contexte transmis à l'agent ;
//   - `{ trace: { fichier, ligne } }` — une ligne que le répartiteur AJOUTE au fichier.
// Le répartiteur (`scripts/hooks/repartiteur.mjs`) lit, construit le contexte, évalue et cumule.
// Aucune garde ne DEMANDE (`ask`) : doctrine `user-doctrine-gardes-jamais-de-ask` (2026-09-28).

/** Les canaux shell : Bash, PowerShell, et le `ctx_shell` de lean-ctx. */
export const OUTILS_SHELL = ['Bash', 'PowerShell', 'mcp__lean-ctx__ctx_shell']

/** La commande shell d'une entrée de hook (`''` sans commande). */
export const commandeDe = (entree) => String(entree?.tool_input?.command ?? '')

/** Le `tool_input` d'une entrée de hook, `null` s'il n'est pas un objet. */
export const entreeDOutil = (entree) => (entree?.tool_input && typeof entree.tool_input === 'object' ? entree.tool_input : null)

/** Les canaux d'écriture de fichier : Write, Edit, et le `ctx_patch` de lean-ctx (canal d'édition
 *  prescrit par `~/.claude/CLAUDE.md`). */
export const OUTILS_ECRITURE = ['Write', 'Edit', 'mcp__lean-ctx__ctx_patch']

/** Les canaux d'écriture qui CRÉENT un fichier : `Edit` n'en crée pas. */
export const OUTILS_CREATION = OUTILS_ECRITURE.filter((outil) => outil !== 'Edit')

/** Les canaux qui écrivent un fichier HORS d'`OUTILS_ECRITURE` : aucune garde d'écriture n'en lit la
 *  forme, la garde `canal-ecriture` les REFUSE (lean-ctx 3.10.2 : `ctx_edit` « str_replace »,
 *  `ctx_refactor` « replace_symbol_body|insert_before_symbol|… »). */
export const OUTILS_ECRITURE_REFUSES = ['mcp__lean-ctx__ctx_edit', 'mcp__lean-ctx__ctx_refactor']

/** La passerelle de lean-ctx : elle appelle l'outil nommé par `tool_input.tool` (lean-ctx 3.10.2 :
 *  « 'tool' is required for ctx meta-tool »). */
export const PASSERELLE = 'mcp__lean-ctx__ctx_call'

const PREFIXE_LEAN_CTX = 'mcp__lean-ctx__'

/** Les outils d'écriture de lean-ctx, par le nom nu qu'une passerelle reçoit : la passerelle n'en
 *  appelle aucun (les gardes lisent le `tool_input` de l'outil, jamais les arguments d'une passerelle). */
export const ECRIVAINS_DE_PASSERELLE = [...OUTILS_ECRITURE, ...OUTILS_ECRITURE_REFUSES]
  .filter((outil) => outil.startsWith(PREFIXE_LEAN_CTX))
  .map((outil) => outil.slice(PREFIXE_LEAN_CTX.length))

/** Le nom nu de l'outil qu'une passerelle appelle (`''` sans nom). */
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

/** Le chemin visé : `file_path` (`Write`, `Edit`), `path` (`ctx_patch`). */
export const cheminVise = (ecrit) => ecrit?.file_path ?? ecrit?.path

/** Le texte posé : `new_string` (`Edit`), `content` (`Write`), `new_text` (`ctx_patch`), `replace`
 *  (`ctx_patch` op `replace_all`). */
export const texteNeuf = (ecrit) => ecrit?.new_string ?? ecrit?.content ?? ecrit?.new_text ?? ecrit?.replace

/** Le texte remplacé, quand l'écriture le porte : `old_string` (`Edit`), `old_text`, `find` (`ctx_patch`). */
export const texteRemplace = (ecrit) => ecrit?.old_string ?? ecrit?.old_text ?? ecrit?.find

/** L'écriture pose-t-elle le fichier ENTIER ? `Write` (`content`), `ctx_patch` op `create`. */
export const ecritLeFichierEntier = (ecrit) => typeof ecrit?.content === 'string' || ecrit?.op === 'create'

/** Les ops ANCRÉES de `ctx_patch` qui remplacent des lignes : `line`, ou `start_line`..`end_line`. */
const OPS_DE_LIGNES = new Set(['set_line', 'replace_lines', 'delete'])

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
