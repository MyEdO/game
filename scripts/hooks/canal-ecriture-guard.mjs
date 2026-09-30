// Garde PreToolUse des CANAUX d'écriture (#2180) : les gardes d'écriture lisent la forme des seuls
// `OUTILS_ECRITURE` et jugent un CHEMIN. Un canal qui écrit hors de cette famille
// (`OUTILS_ECRITURE_REFUSES`, ou la `PASSERELLE` qui appelle un écrivain), ou une écriture dont le
// chemin ne se lit pas (`ctx_patch` op `replace_symbol` adressée par `name` seul), passerait sous elles
// en silence : refus, avec le canal prescrit (`~/.claude/CLAUDE.md` : « Project edits:
// `ctx_read(mode="anchored")` → `ctx_patch` »).
import {
  ECRIVAINS_DE_PASSERELLE, OUTILS_ECRITURE, OUTILS_ECRITURE_REFUSES, PASSERELLE, cheminVise, ecrituresDe, outilAppele,
} from '../guards/lib/contratGarde.mjs'

export const CONSIGNE = 'passe par ctx_patch (avec `path`)'

const refus = (raison) => ({ decision: 'deny', raison: `⛔ ${raison} : ${CONSIGNE}.` })

function evaluer(entree) {
  const outil = String(entree?.tool_name ?? '')
  if (OUTILS_ECRITURE_REFUSES.includes(outil)) return refus(`canal d'écriture non gardé (${outil})`)
  if (outil === PASSERELLE) {
    const appele = outilAppele(entree)
    return ECRIVAINS_DE_PASSERELLE.includes(appele) ? refus(`canal d'écriture non gardé (${outil} → ${appele})`) : null
  }
  const sansChemin = ecrituresDe(entree).filter((ecrit) => typeof cheminVise(ecrit) !== 'string' || cheminVise(ecrit) === '')
  if (sansChemin.length === 0) return null
  const ops = [...new Set(sansChemin.map((ecrit) => ecrit.op).filter(Boolean))]
  return refus(`écriture sans chemin (${outil}${ops.length ? ` op ${ops.join(', ')}` : ''}) : aucune garde d'écriture ne peut la juger`)
}

export const garde = { nom: 'canal-ecriture', outils: [...OUTILS_ECRITURE, ...OUTILS_ECRITURE_REFUSES, PASSERELLE], evaluer }
