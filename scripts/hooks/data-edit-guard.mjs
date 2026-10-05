// Garde PreToolUse des canaux d'écriture (`OUTILS_ECRITURE`) : rappel de GROUNDING quand une donnée app-owned (src/data/*.json) est
// éditée. Non bloquant — injecte du contexte (le hard-gate reste `npm test`). Atteint aussi les
// SOUS-AGENTS, où les skills ne se déclenchent jamais. Motivé par l'incident #148 (doublon « Bélier »).
import { OUTILS_ECRITURE, ecrituresDe } from '../guards/lib/contratGarde.mjs'
import { cheminDEcriture } from './solde-ticket-guard.mjs'

/** Le rappel pour UNE écriture, `null` hors donnée app-owned ; un relatif se résout contre `base`. */
function rappel(ecrit, base) {
  const chemin = cheminDEcriture(ecrit, { base })
  if (chemin === null || !/(^|\/)src\/data\/[^/]+\.json$/.test(chemin.relatif) || chemin.horsContenu) return null
  const rel = chemin.relatif.slice(chemin.relatif.lastIndexOf('src/data/'))
  return {
    contexte: [
      `⚠ Donnée app-owned éditée (${rel}). AVANT d'écrire — cf. incident #148 (doublon « Bélier ») :`,
      `1. CHECK-FIRST : grep l'id, le label ET le concept dans TOUT src/data/*.json — un concept vit peut-être déjà dans un autre sous-système (le Bélier existe dans 6 fichiers).`,
      `2. docs/donnees.md = carte « où va chaque donnée » + conventions (book, page, formes). Une « machine de guerre / véhicule / navire » n'est PAS un trapping.`,
      `3. Sort / créature / effet mécanique / icône / livre → utilise le skill de domaine dédié.`,
      `4. Chaque champ = Source RAW (en-tête de table incluse) ⊕ convention des entrées voisines. Zéro inflexion RAW silencieuse (issue #101+ ou valeur « maison » taguée).`,
      `4bis. La FORME de modélisation suit l'INTENTION du RAW, pas seulement les valeurs : une donnée dont une qualité/champ implique un mode d'emploi (Équipe N ⇒ poste SERVI, jamais un loadout porté ; monture ⇒ monté…) doit être déployée dans le bon mécanisme — précédent : bélier #156 modélisé « arme portée », stats parfaites, règle d'Équipe contournée.`,
      `5. Après édition : canonicaliser via serializeDataset, puis npm test (serialize, no-html-in-prose, id-collisions) + npm run typecheck.`,
    ].join('\n'),
  }
}

const evaluer = (entree, { dir }) => ecrituresDe(entree).map((ecrit) => rappel(ecrit, dir))

export const garde = { nom: 'data-edit', outils: OUTILS_ECRITURE, evaluer }
