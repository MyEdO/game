// LIEN DE SESSION du suivi de vague (#2132, lot 2) : `npm run ops:suivi -- <N>` lie la session qui le
// lance à l'épique `<N>`. Le lien est une ligne du JOURNAL `<dossierDesSuivis>/.journal`
// (`scripts/ops/suivi.mjs`), que seul le `trace` du répartiteur écrit (`scripts/guards/lib/contratGarde.mjs`) ;
// le hook de session `scripts/hooks/inject-suivi.mjs` le relit pour choisir les suivis à mettre en
// contexte. Une ligne TSV par lien : iso, session_id, épique.
//
// La garde ne rend jamais de contexte. Sans `session_id`, ou avec `agent_id` (sous-agent : il partage
// le `session_id` de son parent), elle ne trace rien.
import { join } from 'node:path'
import { OUTILS_SHELL, commandeDe } from '../guards/lib/contratGarde.mjs'
import { argumentsDuSuivi, dossierDesSuivis } from '../ops/suivi.mjs'
import { segmentsProfonds } from './solde-ticket-guard.mjs'

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
 * L'épique que la commande lie (`ops:suivi -- N`, par npm comme en direct, arguments que le script
 * accepte : `argumentsDuSuivi`), `null` sinon. `segmentsProfonds` découpe la commande et y déplie
 * chaque `npm run <x>` en la commande de son script.
 * @param {string} commande
 * @returns {number|null}
 */
export function epiqueLiee(commande) {
  if (!commande) return null
  for (const segment of segmentsProfonds(commande)) {
    const m = LANCE_SUIVI.exec(segment.join(' '))
    const lus = m ? argumentsDuSuivi(m[1].split(/\s+/).filter(Boolean)) : null
    if (lus?.numero) return lus.numero
  }
  return null
}

export const garde = {
  nom: 'suivi-lien',
  outils: OUTILS_SHELL,
  evaluer(entree, contexte) {
    if (!sessionPrincipale(entree)) return null
    const epique = epiqueLiee(commandeDe(entree))
    if (epique === null) return null
    const vu = dossierDesSuivis(contexte.dir)
    if (!vu.disponible) return null
    const ligne = ligneDeJournal({ iso: new Date().toISOString(), session: entree.session_id, epique })
    return { trace: { fichier: join(vu.valeur, JOURNAL), ligne } }
  },
}
