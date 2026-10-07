// Hook commit-msg : la porte du COMMIT (#1728 train B, #2071). Elle LIT le fichier du message FINAL que
// git lui passe en `$1` — le seul endroit où le message est connu tel qu'il sera enregistré, quelle
// que soit la façon dont `git commit` l'a composé (`-m`, heredoc substitué, `-F`, éditeur, `--amend`),
// ainsi que sous `git merge` qui crée un commit et sous le `reword` de `git rebase -i`. Un `git rebase`
// simple et `git cherry-pick`, même `-e`, ne l'appellent PAS ; `--no-verify` le saute (#1806, git 2.43).
// Elle juge le SUJET (`scripts/guards/lib/sujetDeCommit.mjs`) et la porte du ticket (`jugerLeCommit`,
// `scripts/hooks/solde-ticket-guard.mjs`) sur l'index que git a préparé, en UN verdict ; ici,
// l'entrée/sortie seulement.
//
// Contrat, comme `pre-commit` et `pre-push` : ce hook DOIT pouvoir refuser le commit (exit != 0).
// Sans fichier de message lisible, il REFUSE : un message que la porte n'a pas lu n'est pas jugé.
// Porte de version de Node en PREMIER import (`scripts/node-requis.mjs`).
import '../node-requis.mjs'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { decisionCumulee } from '../guards/lib/contratGarde.mjs'
import { depotDe, racineDe } from '../guards/lib/gitPorte.mjs'
import { lectureDuMessage, refusDeSujet } from '../guards/lib/sujetDeCommit.mjs'
import { dateLocale } from '../hooks/repartition.mjs'
import { jugerLeCommit } from '../hooks/solde-ticket-guard.mjs'
import { journaliserLeHook } from './journal.mjs'

/**
 * Verdict sur le fichier de message passé par git, `null` = rien à refuser. `editeur` = `GIT_EDITOR`
 * du hook : git le pose à `:` quand aucun éditeur ne s'ouvre, et le message ne se coupe aux ciseaux
 * que sous l'éditeur (`lectureDuMessage`).
 * @param {string|undefined} chemin
 * @param {{ lire?: (c: string) => string, editeur?: string, dir?: string, today?: string, juger?: typeof jugerLeCommit }} [io]
 * @returns {Promise<{ reason: string } | null>}
 */
export async function jugerFichierDeMessage(chemin, {
  lire = (c) => readFileSync(c, 'utf8'),
  editeur = process.env.GIT_EDITOR,
  dir = resolve(racineDe(depotDe(process.cwd())) ?? process.cwd()),
  today = dateLocale(new Date()),
  juger = jugerLeCommit,
} = {}) {
  if (!chemin) return { reason: '⛔ commit-msg : git n’a passé aucun fichier de message ($1) — rien n’est jugé, le commit est refusé.' }
  let brut
  try { brut = lire(chemin) } catch (e) {
    return { reason: `⛔ commit-msg : message illisible (${chemin}) — rien n’est jugé, le commit est refusé : ${e.message}` }
  }
  const { texte } = lectureDuMessage(brut, { ciseaux: editeur !== ':' })
  const sujet = refusDeSujet(texte)
  return decisionCumulee([sujet && { reason: sujet }, await juger({ message: texte, dir, today })])
}

if (import.meta.main) {
  const journal = journaliserLeHook('commit-msg')
  const refus = await jugerFichierDeMessage(process.argv[2])
  if (refus) { journal.refuser(refus.reason); process.stderr.write(`${refus.reason}\n`); process.exit(1) }
  process.exit(0)
}
