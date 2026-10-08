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
// texte cité est UN argument. Un `npm run ops:suivi -- …` se lit sur le segment `node scripts/ops/suivi.mjs …`
// que le socle en déplie (`commandeScriptNpm` y CITE chaque argument recollé), sans ses redirections
// (`sansRedirections`, sur les jetons : un argument CITÉ qui commence par `>` reste un argument).
//
// Le lien se trace en PreToolUse, AVANT la commande, jamais en PostToolUse : un PostToolUse sur les
// outils shell coûte un démarrage de node à CHAQUE appel shell, mesuré 5,2 à 8,5 s (répartiteur sur
// une charge PostToolUse Bash, 5 lancers, 2026-09-30). Limite : une permission refusée, ou un lot en
// échec, lie quand même la session. Sans effet nuisible : le hook de session lit le suivi s'il existe,
// et dit « lié à cette session, mais absent » sinon.
import * as FS from 'node:fs'
import { join } from 'node:path'
import { OUTILS_SHELL, commandeDe } from '../guards/lib/contratGarde.mjs'
import { dossierDesSuivis } from '../guards/lib/gitPorte.mjs'
import { JOURNAL, argumentsDuSuivi, ligneDeLien } from '../ops/suivi.mjs'
import { relire } from '../ops/suiviFichiers.mjs'
import { basenameExecutable, pipelinesDeJetons, sansRedirections } from '../guards/lib/commandeShell.mjs'

/** Le script lancé par un segment `node <…>/scripts/ops/suivi.mjs`. */
const SCRIPT_DU_SUIVI = /(?:^|[\\/])scripts[\\/]ops[\\/]suivi\.mjs$/

/** Vrai pour la session PRINCIPALE : un `session_id`, aucun `agent_id` (sous-agent). PURE. */
export const sessionPrincipale = (entree) => typeof entree?.session_id === 'string' && entree.session_id !== '' && !entree.agent_id

/**
 * Les LANCEMENTS de `scripts/ops/suivi.mjs` d'une commande, par npm comme en direct : `segments`, les
 * segments exécutés (`pipelinesDeJetons`) ; `lancements`, ceux qui lancent le script (un `npm run` et le
 * segment qu'il déplie, ou un `node` direct) ; `appels`, l'argv de chaque segment `node …/suivi.mjs`, sans
 * ses redirections (`sansRedirections`), dans l'ordre de la commande. Chaque segment garde ses jetons
 * objets sous `source`. PURE.
 * @param {string} commande
 * @returns {{segments: {jetons: string[], source: object}[], lancements: Set<object>, appels: string[][]}}
 */
export function lancementsDuSuivi(commande) {
  const segments = (commande ? pipelinesDeJetons(commande).flat() : [])
    .filter((s) => s.jetons.length > 0).map((s) => ({ ...s, jetons: s.jetons.map((j) => j.text), source: s }))
  const lance = (s) => basenameExecutable(s.jetons[0]) === 'node' && SCRIPT_DU_SUIVI.test(s.jetons[1] ?? '')
  const deplieDe = (npm) => segments.find((s) => lance(s) && s.source.shell?.parent === npm.source.shell)
  const lancements = new Set(segments.filter(lance))
  for (const s of segments.filter((x) => x.deploye && basenameExecutable(x.jetons[0]) === 'npm')) {
    if (deplieDe(s)) lancements.add(s)
  }
  const appels = segments.filter(lance).map((s) => sansRedirections(s.source.jetons).slice(2).map((j) => j.text))
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
