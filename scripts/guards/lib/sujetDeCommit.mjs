// SUJET d'un message de commit — une seule définition, PURE, pour le seul siège qui le juge
// (`scripts/git-hooks/commit-msg.mjs`).
//
// POURQUOI UN SIÈGE, ET LEQUEL : lire le sujet dans la LIGNE DE COMMANDE d'un `git commit` ne voit
// pas ce que git va réellement enregistrer — la graphie dominante du dépôt est
// `git commit -m "$(cat <<'EOF' … EOF)"`, où la valeur du `-m` est la chaîne littérale
// `$(cat <<'EOF'` (13 caractères) tant que le shell n'a pas substitué. Un lecteur de commande dit
// donc « 13 » là où le message fait 2 795 caractères de sujet (mesure du 2026-09-13 sur 20 commits,
// dont 19 dépassaient 100). Le hook `commit-msg` de git reçoit, lui, le FICHIER du message FINAL,
// quelle que soit la façon dont il a été composé (`-m`, `-F`, éditeur, `--amend`, rebase, merge).
//
// AUCUNE EXEMPTION : ni fusion, ni rebase, ni fixup. Un « Merge branch 'x' » automatique fait moins
// de 100 caractères — la règle ne coûte donc rien aux messages que git écrit lui-même, et une
// exemption aurait ouvert la porte par le chemin que personne ne relit.
//
// PÉRIMÈTRE : le SUJET seul. Le CORPS n'est jamais borné — c'est là que vont le solde, les preuves et
// les `CLIQUET:`. Le sujet se lit sur les lignes hors commentaire (`lectureDuMessage`, `satisfactions`).
//
// LECTURE DU MESSAGE (#2071) : `lectureDuMessage` est la seule lecture du fichier que git passe à
// `commit-msg`, pour le sujet comme pour la porte (`jugerLeCommit`, scripts/git-hooks/porte-du-commit.mjs),
// sous le caractère de commentaire du dépôt (`caractereDeCommentaire`, scripts/guards/lib/gitPorte.mjs).
// Mesures du 2026-10-07 (git 2.51.0.windows.2) : sous `-m`/`-F`, git pose `GIT_EDITOR=:` et le
// nettoyage `whitespace` ENREGISTRE les lignes `#` ; sous l'éditeur, `-v` écrit le diff après la ligne
// des ciseaux, que git coupe, mais `-e` sans `-v` (nettoyage `strip`) ENREGISTRE ce qui la suit (sonde
// P3bis du juge de #2071) : le hook ne distingue pas les deux.

import { coupeAuMot } from '../../../src/lib/coupeAuMot.mjs'

/** Longueur maximale du SUJET d'un commit. Mesure du 2026-09-13 : 2 795 caractères de sujet en
 *  moyenne sur 20 commits — un sujet qui porte le solde et les preuves n'est plus un sujet, et
 *  aucun outil (git log --oneline, `gh`, la CI) ne le rend lisible. */
export const SUJET_MAX = 100

/** La ligne des CISEAUX (`wt-status.c`, `cut_line`), derrière le caractère de commentaire et une espace. */
const LIGNE_DES_CISEAUX = '------------------------ >8 ------------------------'

/**
 * Le message d'un commit et ses deux lectures. PURE.
 *  - `texte` : le message tel que la porte le lit ; sous `ciseaux` (l'éditeur : `GIT_EDITOR` ≠ `:`), chaque
 *    ligne qui suit la ligne des ciseaux y devient commentaire — git la coupe ou l'enregistre ;
 *  - `exigences` : toutes ses lignes, commentaires compris ;
 *  - `satisfactions` : ses lignes hors commentaire (`commentaire` en colonne 0, `#` par défaut).
 * @param {string | null | undefined} message @param {{ ciseaux?: boolean, commentaire?: string }} [options]
 * @returns {{ texte: string, exigences: string, satisfactions: string }}
 */
export function lectureDuMessage(message, { ciseaux = false, commentaire = '#' } = {}) {
  const lignes = String(message ?? '').split(/\r?\n/)
  const fin = ciseaux ? lignes.indexOf(`${commentaire} ${LIGNE_DES_CISEAUX}`) : -1
  const lues = fin === -1 ? lignes : [...lignes.slice(0, fin + 1), ...lignes.slice(fin + 1).map((l) => `${commentaire} ${l}`)]
  const texte = lues.join('\n')
  return { texte, exigences: texte, satisfactions: lues.filter((l) => !l.startsWith(commentaire)).join('\n') }
}

/** La première ligne NON VIDE des `satisfactions` d'un message (`lectureDuMessage`) — son SUJET. `''`
 *  si le message n'en porte aucune (message vide, gabarit tout en commentaires). PURE.
 *  @param {string | null | undefined} message @param {{ commentaire?: string }} [options] */
export function sujetDuMessage(message, { commentaire = '#' } = {}) {
  return lectureDuMessage(message, { commentaire }).satisfactions.split('\n').map((l) => l.trim()).find((l) => l !== '') ?? ''
}

/** La raison NOMMÉE de refuser un message, `null` si son sujet tient. PURE.
 *  @param {string | null | undefined} message @param {{ commentaire?: string }} [options] */
export function refusDeSujet(message, { commentaire = '#' } = {}) {
  const sujet = sujetDuMessage(message, { commentaire })
  if (sujet.length <= SUJET_MAX) return null
  return (
    `⛔ SUJET de commit de ${sujet.length} caractères : sujet ≤ ${SUJET_MAX} caractères, le solde et les `
    + `preuves dans le CORPS (une ligne vide, puis tout le reste). Le sujet lu : `
    + `« ${coupeAuMot(sujet, 120)} ».`
  )
}
