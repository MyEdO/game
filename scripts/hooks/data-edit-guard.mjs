// Garde PreToolUse des canaux d'écriture (`OUTILS_ECRITURE`) sur une donnée app-owned (`src/data/*.json`).
// Non bloquante. La consigne vit dans `.claude/rules/donnees.md`, que Claude Code charge sur Write et Edit
// natifs et que `regles-projection-guard.mjs` projette sur l'édition lean-ctx (#2683) : sur ces canaux la
// garde se tait ; sur les autres (`apply_patch` de Codex, NotebookEdit), elle renvoie à la règle. #148 #2725
import { OUTILS_ECRITURE, cheminDEcriture, ecrituresDe, outilCouvert } from '../guards/lib/contratGarde.mjs'
import { gardeEdition as projectionEdition } from './regles-projection-guard.mjs'

export const REGLE_DES_DONNEES = '.claude/rules/donnees.md'

/** Les canaux où la règle est déjà au contexte de l'agent. */
const REGLE_CHARGEE = ['Write', 'Edit', ...projectionEdition.outils]

/** Le renvoi pour UNE écriture, `null` hors donnée app-owned ; un relatif se résout contre `base`. */
function renvoi(ecrit, base) {
  const chemin = cheminDEcriture(ecrit, { base })
  if (chemin === null || !/(^|\/)src\/data\/[^/]+\.json$/.test(chemin.relatif) || chemin.horsContenu) return null
  const rel = chemin.relatif.slice(chemin.relatif.lastIndexOf('src/data/'))
  return { contexte: `Donnée app-owned éditée (${rel}) : suis \`${REGLE_DES_DONNEES}\` avant d'écrire.` }
}

const evaluer = (entree, { dir }) =>
  (outilCouvert(REGLE_CHARGEE, entree?.tool_name) ? [] : ecrituresDe(entree).map((ecrit) => renvoi(ecrit, dir)))

export const garde = { nom: 'data-edit', outils: OUTILS_ECRITURE, evaluer }
