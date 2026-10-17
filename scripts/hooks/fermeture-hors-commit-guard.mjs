// Garde PreToolUse(`OUTILS_SHELL`, `scripts/guards/lib/contratGarde.mjs`) : une FERMETURE de ticket
// HORS commit. La fermeture passe par un commit `corrige #N` porteur de son solde
// (`scripts/git-hooks/porte-du-commit.mjs`) ; `gh issue close` & co fermaient le MÊME ticket sans que
// rien ne demande ce solde (sonde `scripts/ops/sondes/audit-2026-09-01/sonde-guard-fermetures.mjs`,
// archive `.claude/soldes/revue-palier-2205fde51.md:17`). Reconnaisseur du geste : `fermetureGh`
// (`scripts/guards/lib/fermetures.mjs`).
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { OUTILS_SHELL, commandeDe, verdictDe } from '../guards/lib/contratGarde.mjs'
import { REFUS_SATURE, basenameExecutable, nouveauBudget, segmentsProfonds } from '../guards/lib/commandeShell.mjs'
import { fermetureGh } from '../guards/lib/fermetures.mjs'
import { grammaireDesNatures } from '../guards/lib/nature.mjs'

// Endpoint d'UN ticket : `repos/<o>/<r>/issues/<N>` (avec ou sans barre de tête). SEUL cet appel peut
// FERMER — la collection `/issues` CRÉE, `graphql` ne porte pas d'état sur cette route, et un GET ne
// modifie rien.
const ENDPOINT_UN_TICKET_RE = /(^|\/)issues\/\d+(\/|$)/

/** Méthode HTTP demandée (`-X`/`--method`), `GET` par défaut comme `gh api`. */
function methodeGh(args) {
  const i = args.findIndex((a) => a === '-X' || a === '--method' || a.startsWith('--method='))
  if (i === -1) return 'GET'
  const brut = args[i].startsWith('--method=') ? args[i].slice('--method='.length) : (args[i + 1] ?? '')
  return brut.toUpperCase() || 'GET'
}

/** Corps de requête d'un `gh api --input <fichier>` VISANT UN TICKET : le chemin est SUR LA LIGNE, le
 *  fichier se LIT. `{ chemin, etat }` si le corps est lisible, `{ chemin, illisible: true }` sinon,
 *  `null` sinon.
 *
 *  PÉRIMÈTRE, dit — le corps n'est LU que là où une fermeture est possible : endpoint d'UN ticket
 *  (`…/issues/<N>`) et méthode qui ÉCRIT. La création (`…/issues`), `graphql` et les GET passent en
 *  SILENCE, corps absent ou non : au PreToolUse leur fichier est souvent écrit par la commande
 *  elle-même, et un refus y mordrait un geste ROUTINIER. `--input -` (stdin) rend `null` : le corps
 *  n'existe nulle part avant l'exécution. */
function corpsInputGh(segment, lire) {
  const start = segment[0] === '&' ? 1 : 0
  if (basenameExecutable(segment[start]) !== 'gh') return null
  const args = segment.slice(start + 1)
  if (args[0] !== 'api') return null
  // L'endpoint se cherche parmi TOUS les arguments nus : à position fixe, la valeur d'un flag de tête
  // (`gh api -X PATCH /repos/…`) passerait pour lui.
  const viseUnTicket = args.some((a) => !a.startsWith('-') && ENDPOINT_UN_TICKET_RE.test(a))
  if (!viseUnTicket || methodeGh(args) === 'GET') return null
  const i = args.findIndex((a) => a === '--input' || a.startsWith('--input='))
  if (i === -1) return null
  const chemin = args[i].startsWith('--input=') ? args[i].slice('--input='.length) : (args[i + 1] ?? '')
  if (!chemin || chemin === '-') return null
  try {
    return { chemin, etat: JSON.parse(lire(chemin))?.state }
  } catch {
    return { chemin, illisible: true }
  }
}

/**
 * Décision « fermeture d'un ticket HORS commit ». Le corps d'un `gh api --input <fichier>` est LU
 * (`lire`, résolu par l'appelant dans le répertoire d'exécution).
 *
 * HORS PORTÉE, dit : `gh api --input -`, dont le corps arrive par l'entrée standard. Un fichier
 * annoncé mais ILLISIBLE est refusé, jamais silencé (fail-closed sur sa propre annonce). Lire aussi la
 * sortie de `scripts/ops/sondes/audit-2026-09-01/sonde-guard-fermetures.mjs`, qui joue ces cas.
 * @returns {{ reason: string } | null}
 */
export function evaluateFermetureHorsCommit(command, { lire = (p) => readFileSync(p, 'utf8') } = {}) {
  if (!command) return null
  const budget = nouveauBudget()
  const segments = segmentsProfonds(command, 0, { budget })
  if (budget.sature) return REFUS_SATURE
  const parCommit =
    `la fermeture passe par un commit \`corrige #N\` porteur de son solde (.claude/soldes/<N>.md) — ` +
    `le job \`fermetures\` de fermetures.yml (\`scripts/ops/fermer-depuis-main.mjs\`) ferme l'issue ET y poste ` +
    `le solde, checks requis du sha publié sur main verts. Une issue sans objet se ferme par le même chemin : ` +
    `la ligne "NATURE: ${grammaireDesNatures()}" de son solde (scripts/guards/lib/nature.mjs) fait le ` +
    `state_reason (absente = corrigé). Fermer à la main court-circuite le contrôle entier.`
  for (const segment of segments) {
    const forme = fermetureGh(segment)
    if (forme) {
      return { reason: `⛔ Fermeture de ticket HORS commit (${forme}) : ${parCommit}` }
    }
    const corps = corpsInputGh(segment, lire)
    if (!corps) continue
    if (corps.illisible) {
      return {
        reason:
          `⛔ Corps de requête \`gh api --input ${corps.chemin}\` illisible ou non-JSON pour le contrôle de ` +
          `fermeture — écrire un corps JSON lisible à ce chemin (fail-closed : pas de \`state: closed\` ` +
          `invisible).`,
      }
    }
    if (corps.etat === 'closed') {
      return {
        reason: `⛔ Fermeture de ticket HORS commit (gh api --input ${corps.chemin}, "state": "closed") : ${parCommit}`,
      }
    }
  }
  return null
}

/** Le verdict sur la commande de `entree` ; le corps `--input` se lit dans `contexte.dir`, où la commande
 *  s'exécute (`construireContexte`, `scripts/hooks/repartition.mjs`). Un lieu non jugeable (`dir` nul)
 *  est refusé par la garde `canal-outil`. */
function evaluer(entree, contexte) {
  if (contexte.dir === null) return null
  return verdictDe(evaluateFermetureHorsCommit(commandeDe(entree), {
    lire: (chemin) => readFileSync(resolve(contexte.dir, chemin), 'utf8'),
  }))
}

export const garde = { nom: 'fermeture-hors-commit', outils: OUTILS_SHELL, evaluer }
