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
// les `CLIQUET:`. Les lignes de commentaire (`#`), que git retire du message final, ne sont pas lues.

import { coupeAuMot } from '../../../src/lib/coupeAuMot.mjs'

/** Longueur maximale du SUJET d'un commit. Mesure du 2026-09-13 : 2 795 caractères de sujet en
 *  moyenne sur 20 commits — un sujet qui porte le solde et les preuves n'est plus un sujet, et
 *  aucun outil (git log --oneline, `gh`, la CI) ne le rend lisible. */
export const SUJET_MAX = 100

/** La première ligne NON VIDE et NON COMMENTÉE d'un message — son SUJET. `''` si le message n'en
 *  porte aucune (message vide, gabarit tout en commentaires). PURE. */
export function sujetDuMessage(message) {
  return String(message ?? '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .find((l) => l !== '' && !l.startsWith('#')) ?? ''
}

/** La raison NOMMÉE de refuser un message, `null` si son sujet tient. PURE. */
export function refusDeSujet(message) {
  const sujet = sujetDuMessage(message)
  if (sujet.length <= SUJET_MAX) return null
  return (
    `⛔ SUJET de commit de ${sujet.length} caractères : sujet ≤ ${SUJET_MAX} caractères, le solde et les `
    + `preuves dans le CORPS (une ligne vide, puis tout le reste). Le sujet lu : `
    + `« ${coupeAuMot(sujet, 120)} ».`
  )
}
