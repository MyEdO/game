// Hook PreToolUse(Write|Edit) : rappel de GROUNDING quand une donnée app-owned (src/data/*.json) est
// éditée. Non bloquant — injecte du contexte (le hard-gate reste `npm test`). Atteint aussi les
// SOUS-AGENTS, où les skills ne se déclenchent jamais. Motivé par l'incident #148 (doublon « Bélier »).
import { cheminDEcriture } from './solde-ticket-guard.mjs'

let raw = ''
process.stdin.setEncoding('utf8')
for await (const chunk of process.stdin) raw += chunk

let chemin = null
try { chemin = cheminDEcriture(JSON.parse(raw)?.tool_input) } catch { /* stdin illisible → silence */ }

const isData = chemin !== null && /(^|\/)src\/data\/[^/]+\.json$/.test(chemin.relatif) && !chemin.horsContenu

if (isData) {
  const rel = chemin.relatif.slice(chemin.relatif.lastIndexOf('src/data/'))
  const lines = [
    `⚠ Donnée app-owned éditée (${rel}). AVANT d'écrire — cf. incident #148 (doublon « Bélier ») :`,
    `1. CHECK-FIRST : grep l'id, le label ET le concept dans TOUT src/data/*.json — un concept vit peut-être déjà dans un autre sous-système (le Bélier existe dans 6 fichiers).`,
    `2. docs/donnees.md = carte « où va chaque donnée » + conventions (book, page, formes). Une « machine de guerre / véhicule / navire » n'est PAS un trapping.`,
    `3. Sort / créature / effet mécanique / icône / livre → utilise le skill de domaine dédié.`,
    `4. Chaque champ = Source RAW (en-tête de table incluse) ⊕ convention des entrées voisines. Zéro inflexion RAW silencieuse (issue #101+ ou valeur « maison » taguée).`,
    `4bis. La FORME de modélisation suit l'INTENTION du RAW, pas seulement les valeurs : une donnée dont une qualité/champ implique un mode d'emploi (Équipe N ⇒ poste SERVI, jamais un loadout porté ; monture ⇒ monté…) doit être déployée dans le bon mécanisme — précédent : bélier #156 modélisé « arme portée », stats parfaites, règle d'Équipe contournée.`,
    `5. Après édition : canonicaliser via serializeDataset, puis npm test (serialize, no-html-in-prose, id-collisions) + npm run typecheck.`,
  ]
  console.log(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      additionalContext: lines.join('\n'),
    },
  }))
}
