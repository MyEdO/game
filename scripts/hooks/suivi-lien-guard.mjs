// LIEN DE SESSION du suivi de vague (#2132) : `npm run ops:suivi -- <N>` lie la session qui le
// lance à l'épique `<N>`. Le lien est une ligne du JOURNAL `<dossierDesSuivis>/.journal`
// (`scripts/ops/suivi.mjs`), que seul le `trace` du répartiteur écrit (`scripts/guards/lib/contratGarde.mjs`) ;
// le hook de session `scripts/hooks/inject-suivi.mjs` le relit pour choisir les suivis à mettre en
// contexte. Une ligne TSV par lien : iso, session_id, épique.
//
// La garde ne rend de contexte que pour un `ops:suivi` dont elle ne lit pas les arguments : la session
// n'est alors pas liée, et l'avertissement le dit (#2233). Sans `session_id`, ou avec `agent_id`
// (sous-agent : il partage le `session_id` de son parent), elle ne trace rien. Un lien déjà au
// journal pour ce `session_id` et cette épique n'est pas retracé : le journal ne croît pas d'une ligne
// par appel.
//
// Le lien se trace en PreToolUse, AVANT la commande, jamais en PostToolUse : un PostToolUse sur les
// outils shell coûte un démarrage de node à CHAQUE appel shell, mesuré 5,2 à 8,5 s (répartiteur sur
// une charge PostToolUse Bash, 5 lancers, 2026-09-30). Limite : une permission refusée, ou un
// `--creer` en échec, lie quand même la session. Sans effet nuisible : le hook de session lit le suivi
// s'il existe, et dit « lié à cette session, mais absent » sinon.
import * as FS from 'node:fs'
import { join } from 'node:path'
import { OUTILS_SHELL, commandeDe } from '../guards/lib/contratGarde.mjs'
import { argumentsDuSuivi, dossierDesSuivis, relire } from '../ops/suivi.mjs'
import { finAvantOperateur, segmentsProfonds } from './solde-ticket-guard.mjs'

/** Nom du journal, dans le dossier des suivis (le listage des suivis, `^\d+\.md$`, l'ignore). */
export const JOURNAL = '.journal'

/** Un segment qui lance `scripts/ops/suivi.mjs`, et ses arguments. */
const LANCE_SUIVI = /^node\s+(?:\S*[\\/])?scripts[\\/]ops[\\/]suivi\.mjs(?=\s|$)(.*)$/

/** La ligne TSV d'un lien, fin comprise. PURE. */
export const ligneDeJournal = ({ iso, session, epique }) =>
  `${[iso, session, epique].map((v) => String(v).replace(/[\t\r\n]/g, ' ')).join('\t')}\n`

/**
 * Les lignes lisibles d'un journal ; une ligne mal formée est ignorée. PURE.
 * @param {string} texte
 * @returns {Array<{iso: string, session: string, epique: number}>}
 */
export function lignesDuJournal(texte) {
  return String(texte ?? '').split(/\r?\n/).map((l) => l.split('\t')).filter((c) => c.length === 3 && /^\d+$/.test(c[2]))
    .map(([iso, session, epique]) => ({ iso, session, epique: Number(epique) }))
}

/** Les épiques liées à `session`, dans l'ordre de leur premier lien. PURE. */
export const epiquesLiees = (lignes, session) =>
  [...new Set(lignes.filter((l) => l.session === session).map((l) => l.epique))]

/** Vrai pour la session PRINCIPALE : un `session_id`, aucun `agent_id` (sous-agent). PURE. */
export const sessionPrincipale = (entree) => typeof entree?.session_id === 'string' && entree.session_id !== '' && !entree.agent_id

/**
 * Les arguments de chaque segment qui lance `scripts/ops/suivi.mjs`, par npm comme en direct, sans
 * ses redirections (`finAvantOperateur`). `segmentsProfonds` découpe la commande et y déplie chaque
 * `npm run <x>` en la commande de son script. PURE.
 * @param {string} commande
 * @returns {string[][]}
 */
export function appelsDuSuivi(commande) {
  if (!commande) return []
  return segmentsProfonds(commande)
    .map((segment) => LANCE_SUIVI.exec(segment.slice(0, finAvantOperateur(segment)).join(' ')))
    .filter(Boolean)
    .map((m) => m[1].split(/\s+/).filter(Boolean))
}

/** L'épique que lie le premier des `appels` dont le script accepte les arguments (`argumentsDuSuivi`),
 *  `null` sinon. PURE. */
const epiqueDesAppels = (appels) => appels.map(argumentsDuSuivi).find((lus) => lus?.numero)?.numero ?? null

/** L'épique que la commande lie (`epiqueDesAppels`), `null` sinon. PURE. */
export const epiqueLiee = (commande) => epiqueDesAppels(appelsDuSuivi(commande))

/** L'avertissement d'un `ops:suivi` aux arguments illisibles, qui ne lie pas la session. PURE. */
export const avertissementIllisible = (argv) =>
  `lien de suivi : \`ops:suivi\` lancé avec \`${argv.join(' ')}\`, que la garde ne lit pas — cette session `
  + "N'EST PAS liée à l'épique. Pour la lier : `npm run ops:suivi -- <N>` (numéro nu, `--creer`, `--sans-fetch`)."

export const garde = {
  nom: 'suivi-lien',
  outils: OUTILS_SHELL,
  evaluer(entree, contexte) {
    if (!sessionPrincipale(entree)) return null
    const appels = appelsDuSuivi(commandeDe(entree))
    const epique = epiqueDesAppels(appels)
    if (epique === null) {
      const illisible = appels.find((argv) => argumentsDuSuivi(argv) === null)
      return illisible ? { contexte: avertissementIllisible(illisible) } : null
    }
    const vu = dossierDesSuivis(contexte.dir)
    if (!vu.disponible) return null
    const fichier = join(vu.valeur, JOURNAL)
    if (epiquesLiees(lignesDuJournal(relire(fichier, FS) ?? ''), entree.session_id).includes(epique)) return null
    const ligne = ligneDeJournal({ iso: new Date().toISOString(), session: entree.session_id, epique })
    return { trace: { fichier, ligne } }
  },
}
