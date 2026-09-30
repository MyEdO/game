// Garde PreToolUse des CANAUX d'outil (#2180) : tout outil lean-ctx est CLASSÉ dans une famille gardée
// (`FAMILLES_LEAN_CTX`, `scripts/guards/lib/contratGarde.mjs`) ou REFUSÉ, direct comme appelé par la
// passerelle ; une écriture que les gardes d'écriture ne sauraient juger (sans chemin, texte remplacé
// non résoluble) est REFUSÉE. Canal prescrit : `~/.claude/CLAUDE.md` (« Project edits:
// `ctx_read(mode="anchored")` → `ctx_patch` »).
import {
  EDITION, LECTURE, MOTIF_LEAN_CTX, OUTILS_ECRITURE, PASSERELLE, cheminVise, ecrituresDe, familleLeanCtx, nomLeanCtx,
  outilAppele, remplaceResoluble,
} from '../guards/lib/contratGarde.mjs'

export const CONSIGNE = 'canal prescrit : ctx_patch (avec `path`, op ancrée ou texte remplacé) pour écrire, ctx_shell pour une commande, un outil de lecture classé pour lire'

const refus = (raison) => ({ decision: 'deny', raison: `⛔ ${raison} — ${CONSIGNE}.` })

function evaluer(entree) {
  const outil = String(entree?.tool_name ?? '')
  const nu = nomLeanCtx(outil)
  if (nu !== null) {
    const famille = familleLeanCtx(nu)
    if (famille === PASSERELLE) {
      const appele = outilAppele(entree)
      return familleLeanCtx(appele) === LECTURE ? null : refus(`la passerelle n'appelle qu'un outil de LECTURE (${outil} → ${appele || 'aucun `tool`'})`)
    }
    if (famille === null) return refus(`outil lean-ctx non classé (${outil}) : aucune garde ne le juge`)
    if (famille !== EDITION) return null
  }
  if (!OUTILS_ECRITURE.includes(outil)) return null
  const nonJugeables = ecrituresDe(entree).filter((ecrit) => cheminVise(ecrit) === undefined || !remplaceResoluble(ecrit))
  if (nonJugeables.length === 0) return null
  const ops = [...new Set(nonJugeables.map((ecrit) => ecrit.op).filter(Boolean))]
  return refus(`écriture non jugeable (${outil}${ops.length ? ` op ${ops.join(', ')}` : ''}) : chemin absent ou texte remplacé non résoluble`)
}

export const garde = { nom: 'canal-outil', outils: [...OUTILS_ECRITURE, MOTIF_LEAN_CTX], evaluer }
