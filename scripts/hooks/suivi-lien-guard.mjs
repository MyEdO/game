// LIEN DE SESSION du suivi de vague (#2132) : `npm run ops:suivi -- <N> …` lie la session qui le
// lance à l'épique `<N>`. Le lien est une ligne du JOURNAL `<dossierDesSuivis>/.journal`
// (`JOURNAL`, `ligneDeLien` : `scripts/ops/suivi.mjs`), qu'écrivent le `trace` du répartiteur
// (`scripts/guards/lib/contratGarde.mjs`) et le lot `editer` de `suivi.mjs` (#2279) ; `etatDeSession`
// le relit pour choisir les suivis à mettre en contexte. Une ligne TSV par lien : iso, session_id, épique.
//
// La garde ne rend de contexte que pour un `ops:suivi` dont elle ne lit pas les arguments
// (`argumentsDuSuivi` les refuse) : la session n'est alors pas liée, et l'avertissement le dit (#2233).
// Sans `session_id`, ou avec `agent_id` (sous-agent : il partage le `session_id` de son parent), elle ne
// trace rien. Un lien déjà au journal pour ce `session_id` et cette épique n'est pas retracé.
//
// LES ARGUMENTS se lisent jeton par jeton, citations comprises : un geste du CLI a une arité FIXE, et son
// texte cité est UN argument. Un `npm run ops:suivi -- …` se lit sur ses PROPRES jetons, non sur la
// commande que `segmentsProfonds` en déplie (qui recolle les arguments d'une espace et perd leurs
// citations) ; le segment déplié de ce lancement n'est pas relu.
//
// Le lien se trace en PreToolUse, AVANT la commande, jamais en PostToolUse : un PostToolUse sur les
// outils shell coûte un démarrage de node à CHAQUE appel shell, mesuré 5,2 à 8,5 s (répartiteur sur
// une charge PostToolUse Bash, 5 lancers, 2026-09-30). Limite : une permission refusée, ou un lot en
// échec, lie quand même la session. Sans effet nuisible : le hook de session lit le suivi s'il existe,
// et dit « lié à cette session, mais absent » sinon.
import * as FS from 'node:fs'
import { join } from 'node:path'
import { OUTILS_SHELL, commandeDe } from '../guards/lib/contratGarde.mjs'
import { JOURNAL, argumentsDuSuivi, dossierDesSuivis, ligneDeLien, relire } from '../ops/suivi.mjs'
import { basenameExecutable, finAvantOperateur, pipelinesDeJetons } from '../guards/lib/commandeShell.mjs'

/** Le script lancé par un segment `node <…>/scripts/ops/suivi.mjs`. */
const SCRIPT_DU_SUIVI = /(?:^|[\\/])scripts[\\/]ops[\\/]suivi\.mjs$/

/** Les sous-commandes npm qui lancent un script. */
const RUN = new Set(['run', 'run-script'])

/** Vrai pour la session PRINCIPALE : un `session_id`, aucun `agent_id` (sous-agent). PURE. */
export const sessionPrincipale = (entree) => typeof entree?.session_id === 'string' && entree.session_id !== '' && !entree.agent_id

/** Les arguments d'un `npm run <script> [--] …` : ce qui suit le premier `--`, sinon le nom du script. PURE. */
function argumentsNpm(jetons) {
  const separateur = jetons.indexOf('--')
  if (separateur >= 0) return jetons.slice(separateur + 1)
  const run = jetons.findIndex((t) => RUN.has(t))
  const nom = jetons.findIndex((t, k) => k > run && !t.startsWith('-'))
  return nom < 0 ? [] : jetons.slice(nom + 1)
}

/**
 * Les LANCEMENTS de `scripts/ops/suivi.mjs` d'une commande, par npm comme en direct : `segments`, les
 * segments exécutés (`pipelinesDeJetons`) ; `lancements`, ceux qui lancent le script (un `npm run` et le
 * segment qu'il déplie) ; `appels`, l'argv de chaque lancement, sans redirections (`finAvantOperateur`),
 * dans l'ordre de la commande. PURE.
 * @param {string} commande
 * @returns {{segments: {jetons: string[]}[], lancements: Set<object>, appels: string[][]}}
 */
export function lancementsDuSuivi(commande) {
  const segments = (commande ? pipelinesDeJetons(commande).flat() : [])
    .filter((s) => s.jetons.length > 0).map((s) => ({ ...s, jetons: s.jetons.map((j) => j.text), source: s }))
  const lance = (s) => basenameExecutable(s.jetons[0]) === 'node' && SCRIPT_DU_SUIVI.test(s.jetons[1] ?? '')
  const deplieDe = (npm) => segments.find((s) => lance(s) && s.source.shell?.parent === npm.source.shell)
  const lancements = new Set()
  const appels = []
  for (const s of segments.filter((x) => x.deploye && basenameExecutable(x.jetons[0]) === 'npm')) {
    const deplie = deplieDe(s)
    if (deplie) lancements.add(s).add(deplie)
  }
  for (const s of segments) {
    const jetons = s.jetons.slice(0, finAvantOperateur(s.jetons))
    if (lancements.has(s) && !lance(s)) appels.push(argumentsNpm(jetons))
    else if (!lancements.has(s) && lance(s)) {
      lancements.add(s)
      appels.push(jetons.slice(2))
    }
  }
  return { segments, lancements, appels }
}

/** L'argv de chaque lancement de `scripts/ops/suivi.mjs` (`lancementsDuSuivi`). PURE. */
export const appelsDuSuivi = (commande) => lancementsDuSuivi(commande).appels

/** L'épique que lie le premier des `appels` dont le script accepte les arguments (`argumentsDuSuivi`),
 *  `null` sinon. PURE. */
const epiqueDesAppels = (appels) => appels.map(argumentsDuSuivi).find((lus) => !lus.refus && lus.numero !== null)?.numero ?? null

/** L'épique que la commande lie (`epiqueDesAppels`), `null` sinon. PURE. */
export const epiqueLiee = (commande) => epiqueDesAppels(appelsDuSuivi(commande))

/** L'avertissement d'un `ops:suivi` aux arguments refusés, qui ne lie pas la session. PURE. */
export const avertissementIllisible = (argv) =>
  `lien de suivi : \`ops:suivi\` lancé avec \`${argv.join(' ')}\`, que la garde ne lit pas (${argumentsDuSuivi(argv).refus}) — `
  + "cette session N'EST PAS liée à l'épique. Pour la lier : `npm run ops:suivi -- <N>`."

export const garde = {
  nom: 'suivi-lien',
  outils: OUTILS_SHELL,
  evaluer(entree, contexte) {
    if (!sessionPrincipale(entree)) return null
    const appels = appelsDuSuivi(commandeDe(entree))
    const epique = epiqueDesAppels(appels)
    if (epique === null) {
      const illisible = appels.find((argv) => argumentsDuSuivi(argv).refus)
      return illisible ? { contexte: avertissementIllisible(illisible) } : null
    }
    const vu = dossierDesSuivis(contexte.dir)
    if (!vu.disponible) return null
    const fichier = join(vu.valeur, JOURNAL)
    const ligne = ligneDeLien({ journal: relire(fichier, FS) ?? '', session: entree.session_id, epique, iso: new Date().toISOString() })
    return ligne ? { trace: { fichier, ligne } } : null
  },
}
