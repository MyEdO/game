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
