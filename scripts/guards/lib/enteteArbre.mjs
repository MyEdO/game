// FILIGRANE D'ARBRE — l'unique fabrique de la ligne qui dit SUR QUOI une mesure a porté : sha court,
// sujet du dernier commit, et nombre de fichiers non committés. Une planche QC, une capture d'écran
// ou un chiffre de volume rendus sans cette ligne ne se rattachent à aucun arbre : deux sessions
// mesurent alors deux états différents en croyant se comparer.
// Consommateurs : scripts/recette/intentions-portee.mjs, scripts/qc/mesure-volume.mts,
// scripts/qc/capture-jeu.mjs — une seule implémentation, jamais une copie par script.
//
// Le filigrane ne JETTE JAMAIS : il est imprimé juste avant les refus d'un hook, et une exception ici
// emporterait les refus nommés avec elle. Git indisponible donne une ligne DÉGRADÉE qui le dit.
import { depotDe, etatDeLArbre, journalDe, shaDe } from './gitPorte.mjs'

/** Les trois QUESTIONS du filigrane au dépôt de `racine` : le nombre de fichiers non committés
 *  (`etatDeLArbre`), le sha court de HEAD (`shaDe`) et le sujet de son commit (`journalDe`), `null`
 *  si git ne le rend pas. Une INDISPONIBILITÉ JETTE avec sa raison — `enteteArbre` en fait sa ligne
 *  dégradée.
 *  @param {string} racine
 *  @returns {{ sales: () => number, sha: () => string | null, sujet: () => string | null }} */
export function lectureDeLArbre(racine) {
  const depot = depotDe(racine)
  return {
    sales: () => etatDeLArbre(depot).length,
    sha: () => shaDe(depot, 'HEAD', { court: true }),
    sujet: () => journalDe(depot, ['HEAD^!'])?.[0]?.message.split('\n')[0] ?? null,
  }
}

/**
 * Ligne de filigrane : `arbre <sha7> « <sujet, 70 car. max> » + N fichier(s) non committé(s)`.
 * `lecture` (`lectureDeLArbre`) est injectable pour la mesure, jamais pour cacher l'arbre réel.
 * @param {string} racine @param {ReturnType<typeof lectureDeLArbre>} [lecture]
 * @returns {string}
 */
export function enteteArbre(racine, lecture = lectureDeLArbre(racine)) {
  const lu = (question) => {
    try {
      return question()
    } catch (e) {
      return { panne: e.message }
    }
  }
  const sales = lu(lecture.sales)
  const sha = lu(lecture.sha)
  const sujet = lu(lecture.sujet)
  const panne = [sales, sha, sujet].find((v) => v?.panne)?.panne
  if (panne) return `arbre (git indisponible : ${panne})`
  if (sha === null || sujet === null) return 'arbre (git indisponible : aucune réponse de git dans cet arbre)'
  return `arbre ${sha} « ${String(sujet).slice(0, 70)} » + ${sales} fichier(s) non committé(s)`
}
