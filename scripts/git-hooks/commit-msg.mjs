// Hook commit-msg : la porte du COMMIT (#1728 train B, #2071). Elle LIT le fichier du message FINAL que
// git lui passe en `$1` — le seul endroit où le message est connu tel qu'il sera enregistré, quelle
// que soit la façon dont `git commit` l'a composé (`-m`, heredoc substitué, `-F`, éditeur, `--amend`),
// ainsi que sous `git merge` qui crée un commit et sous le `reword` de `git rebase -i`. Un `git rebase`
// simple et `git cherry-pick`, même `-e`, ne l'appellent PAS ; `--no-verify` le saute (#1806, git 2.43),
// et la garde `scripts/hooks/hooks-git-contournes-guard.mjs` le refuse aux agents.
// Elle juge le SUJET (`scripts/guards/lib/sujetDeCommit.mjs`) et la porte du ticket (`jugerLeCommit`,
// `scripts/git-hooks/porte-du-commit.mjs`) sur l'index que git a préparé, en UN verdict, sous le
// caractère de commentaire du dépôt (`caractereDeCommentaire`) ; ici, l'entrée/sortie
// seulement.
//
// Contrat, comme `pre-commit` et `pre-push` : ce hook DOIT pouvoir refuser le commit (exit != 0).
// Sans fichier de message lisible, il REFUSE : un message que la porte n'a pas lu n'est pas jugé.
// Porte de version de Node en PREMIER import (`scripts/node-requis.mjs`).
import '../node-requis.mjs'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { decisionCumulee } from '../guards/lib/contratGarde.mjs'
import { dateLocale } from '../guards/lib/dateLocale.mjs'
import { caractereDeCommentaire, depotAuxPannes } from '../guards/lib/gitPorte.mjs'
import { lectureDuMessage, refusDeSujet } from '../guards/lib/sujetDeCommit.mjs'
import { jugerLeCommit } from './porte-du-commit.mjs'
import { journaliserLeHook } from './journal.mjs'

/**
 * Verdict sur le fichier de message passé par git, `null` = rien à refuser. `editeur` = `GIT_EDITOR`
 * du hook : git le pose à `:` quand aucun éditeur ne s'ouvre, et le message ne se coupe aux ciseaux
 * que sous l'éditeur (`lectureDuMessage`). `dir` = le cwd du hook, que git pose à la racine de l'arbre
 * (githooks(5)). `commentaire(pannes)` lit le caractère de commentaire du dépôt de `dir`
 * (`caractereDeCommentaire`), ses pannes de lecture refusées au verdict (`refusDesPannes`) ; `auto` (git choisit le caractère message par message) est
 * refusé : la porte ne lit pas un message dont elle ne connaît pas les commentaires.
 * @param {string|undefined} chemin
 * @param {{ lire?: (c: string) => string, editeur?: string, dir?: string, today?: string, commentaire?: (pannes: string[]) => string, juger?: typeof jugerLeCommit }} [io]
 * @returns {Promise<{ reason: string } | null>}
 */
export async function jugerFichierDeMessage(chemin, {
  lire = (c) => readFileSync(c, 'utf8'),
  editeur = process.env.GIT_EDITOR,
  dir = resolve(process.cwd()),
  today = dateLocale(new Date()),
  commentaire = (pannes) => caractereDeCommentaire(depotAuxPannes(dir, pannes)),
  juger = jugerLeCommit,
} = {}) {
  if (!chemin) return { reason: '⛔ commit-msg : git n’a passé aucun fichier de message ($1) — rien n’est jugé, le commit est refusé.' }
  let brut
  try { brut = lire(chemin) } catch (e) {
    return { reason: `⛔ commit-msg : message illisible (${chemin}) — rien n’est jugé, le commit est refusé : ${e.message}` }
  }
  const pannes = []
  const car = commentaire(pannes)
  if (car === 'auto') {
    return {
      reason: '⛔ commit-msg : caractère de commentaire `auto` (`core.commentChar`, `core.commentString`) — git le '
        + 'choisit message par message, la porte ne sait pas quelles lignes il retire : rien n’est jugé, le commit est '
        + 'refusé. Geste : `git config --unset core.commentChar` et `core.commentString`, ou un caractère fixe.',
    }
  }
  const { texte } = lectureDuMessage(brut, { ciseaux: editeur !== ':', commentaire: car })
  const sujet = refusDeSujet(texte, { commentaire: car })
  return decisionCumulee([sujet && { reason: sujet }, await juger({ message: texte, commentaire: car, dir, today, pannes })])
}

if (import.meta.main) {
  const journal = journaliserLeHook('commit-msg')
  const refus = await jugerFichierDeMessage(process.argv[2])
  if (refus) { journal.refuser(refus.reason); process.stderr.write(`${refus.reason}\n`); process.exit(1) }
  process.exit(0)
}
