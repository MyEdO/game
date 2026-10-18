// Garde PreToolUse des CANAUX d'outil (#2180) : tout outil lean-ctx est CLASSÉ dans une famille gardée
// (`FAMILLES_LEAN_CTX`, `scripts/guards/lib/contratGarde.mjs`) ou REFUSÉ, direct avec ses actions
// refusées ; la passerelle n'appelle qu'un outil de `LECTURES_LIBRES`, quelle que soit la forme de ses
// arguments (lean-ctx `LEAN_CTX_VERSION`, `registered/ctx_call.rs` l.75 : « Preserve the existing flattened-call contract »),
// tout autre outil s'appelle DIRECTEMENT ; une écriture que les gardes d'écriture ne sauraient juger
// (sans chemin, texte remplacé non résoluble, lot `ops` ambigu) est REFUSÉE, comme une entrée `ctx_patch` qui
// porte une clé que son op ne consomme pas (`OPS_CTX_PATCH`), ou un shell lean-ctx qui porte une clé hors de
// `CLES_SHELL` ; un appel dont le contexte (`construireContexte`, `scripts/hooks/repartition.mjs`) dit le
// lieu NON JUGEABLE (#2224) est refusé avec le canal que ce contexte prescrit. Un refus ne prescrit que la
// famille d'outils de l'appel refusé, donc présente (#2726) : canal par geste, `.claude/rules/outils.md`.
import {
  CLES_SHELL, LECTURE, LECTURES_LIBRES, MOTIF_LEAN_CTX, OUTILS_ECRITURE, OUTILS_SHELL, PASSERELLE, SHELL, actionRefusee, cheminVise,
  clesHorsSchemaShell, clesNonAdmises, ecrituresDe, entreeDOutil, familleLeanCtx, lotAmbigu, nomLeanCtx, outilAppele, remplaceResoluble,
} from '../guards/lib/contratGarde.mjs'

/** Le canal prescrit à un appel lean-ctx refusé. */
export const CONSIGNE = 'canal prescrit : ctx_patch (avec `path`, op ancrée ou texte remplacé) pour écrire, ctx_shell pour une commande, un outil de lecture classé pour lire'

/** Le canal prescrit à une écriture native refusée. */
export const CONSIGNE_NATIVE = 'canal prescrit : la même écriture avec un chemin explicite et un texte remplacé présent dans le fichier'

const refus = (raison, consigne = CONSIGNE) => ({ decision: 'deny', raison: `⛔ ${raison} — ${consigne}.` })

function evaluer(entree, contexte) {
  const outil = String(entree?.tool_name ?? '')
  const nu = nomLeanCtx(outil)
  if (nu !== null) {
    const famille = familleLeanCtx(nu)
    if (famille === PASSERELLE) {
      const appele = outilAppele(entree)
      if (appele === null) return refus(`la passerelle n'appelle qu'un outil nommé sans ambiguïté (${outil} : \`name\`/\`tool\` absents, non-chaînes ou divergents)`)
      return LECTURES_LIBRES.includes(appele) ? null : refus(`la passerelle n'appelle qu'un outil de lecture sans action refusée (${outil} → ${appele}) : appeler ${appele} DIRECTEMENT`)
    }
    if (famille === null) return refus(`outil lean-ctx non classé (${outil}) : aucune garde ne le juge`)
    if (famille === LECTURE) return actionRefusee(nu, entree) ? refus(`action refusée (${outil})`) : null
    if (famille === SHELL) {
      const horsSchema = clesHorsSchemaShell(entreeDOutil(entree))
      if (horsSchema.length) return { decision: 'deny', raison: `⛔ clé hors du schéma admis du shell (${outil} : ${horsSchema.join(', ')}) — canal prescrit : le même appel sans cette clé (admises : ${CLES_SHELL.join(', ')}).` }
    } else {
      const horsSchema = clesNonAdmises(entreeDOutil(entree))
      if (horsSchema.length) return refus(`clé hors du schéma MCP de son op (${outil} : ${horsSchema.join(', ')})`)
      if (lotAmbigu(entreeDOutil(entree))) return refus(`écriture non jugeable (${outil}) : lot \`ops\` ambigu (non-tableau, élément non-objet, plus d'un \`path\` ou op ancrée après une op déléguée)`)
    }
  }
  if (contexte?.nonJugeable) return { decision: 'deny', raison: `⛔ appel non jugeable (${outil}) : ${contexte.nonJugeable.raison} — canal prescrit : ${contexte.nonJugeable.canal}.` }
  if (!OUTILS_ECRITURE.includes(outil)) return null
  const nonJugeables = ecrituresDe(entree).filter((ecrit) => cheminVise(ecrit) === undefined || !remplaceResoluble(ecrit))
  if (nonJugeables.length === 0) return null
  const ops = [...new Set(nonJugeables.map((ecrit) => ecrit.op).filter(Boolean))]
  return refus(`écriture non jugeable (${outil}${ops.length ? ` op ${ops.join(', ')}` : ''}) : chemin absent ou texte remplacé non résoluble`, nu === null ? CONSIGNE_NATIVE : CONSIGNE)
}

export const garde = { nom: 'canal-outil', categorie: 'validation', outils: [...OUTILS_ECRITURE, ...OUTILS_SHELL, MOTIF_LEAN_CTX], evaluer }
