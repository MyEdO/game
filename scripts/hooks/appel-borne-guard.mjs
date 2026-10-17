// #2596 A2 ; commentaire 6142833266.
// Garde PreToolUse : à un SOUS-AGENT, un appel Bash ou PowerShell au premier plan dont la borne dépasse
// `BORNE_D_APPEL_MS` est refusé ; la commande part en fond et se sonde (`scripts/ops/sonde.mjs`).
// La borne d'un appel, schéma des outils de Claude Code 2.1.296 :
// - Bash : « `timeout` is in milliseconds: default 120000, max 600000 for a foreground command » ;
//   « `run_in_background` runs the command detached » ;
// - PowerShell : « optional timeout (up to 600000ms / 10 minutes for a foreground command). If not specified,
//   commands will timeout after 120000ms (2 minutes) » ;
// - à l'échéance, la commande n'est pas tuée : « Command did not complete within its 5s timeout and was moved to
//   the background » (mesuré 2026-10-13, Bash et PowerShell) ;
// - `mcp__lean-ctx__ctx_shell` : « timeout_ms: Job lifetime in ms (max 3600000) — NOT the inline wait. A command
//   still running at the ~110s foreground cap detaches to a pollable shell_* job » : hors garde.
// Limite : un agent qui ATTEND une notification (Monitor, commande de fond sans sonde) reste inactif au-delà de
// 5 min sans qu'aucun appel ne le porte ; la garde ne le juge pas, `.claude/rules/outils.md` prescrit la sonde.
import { createHash } from 'node:crypto'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { ECHEANCE_PAR_DEFAUT_MS, commandeDe, entreeDOutil, sousAgent, timeoutDe, verdictDe } from '../guards/lib/contratGarde.mjs'
import { appelleServeurVite } from '../guards/lib/appelsRunners.mjs'
import { REFUS_SATURE, borneDeVie, nouveauBudget, pipelinesDeJetons } from '../guards/lib/commandeShell.mjs'
import { BORNE_DE_SONDE_S, CODE_EN_COURS, commandeDeSonde } from '../ops/sonde.mjs'

/** La borne d'un appel d'outil d'un sous-agent : sous le TTL de 5 min de son cache de prompt (#2596). */
export const BORNE_D_APPEL_MS = 270_000

/** Le `timeout` d'un appel de sonde : sa borne, plus le lancement de node. */
const TIMEOUT_DE_SONDE_MS = BORNE_DE_SONDE_S * 1000 + 20_000

/** Les outils dont un champ `timeout` borne l'attente au premier plan. */
const OUTILS_BORNES = ['Bash', 'PowerShell']

/** La borne de l'attente au premier plan d'un `tool_input`, `null` en fond. PURE. */
function borneDe(input) {
  if (input?.run_in_background === true) return null
  return timeoutDe(input) ?? ECHEANCE_PAR_DEFAUT_MS
}

/**
 * La base des fichiers `.log` et `.code` d'une commande : hors de l'arbre (#2585), nommée par l'empreinte de
 * l'appelant (session, agent, répertoire) et de la commande. PURE.
 */
function baseDe({ session, agent, cwd, commande }) {
  const empreinte = createHash('sha1').update(JSON.stringify([session, agent, cwd, commande])).digest('hex').slice(0, 12)
  return join(tmpdir(), `appel-${empreinte}`).replaceAll('\\', '/')
}

/** La commande de fond à copier, pour l'outil `outil`. PURE. */
function commandeDeFond(outil, commande, base) {
  if (outil === 'PowerShell') {
    return `Remove-Item -ErrorAction Ignore '${base}.code'; $global:LASTEXITCODE = 0; $Error.Clear(); `
      + `try { & { ${commande} } *> '${base}.log'; $c = if ($LASTEXITCODE) { $LASTEXITCODE } elseif ($Error.Count) { 1 } else { 0 } } `
      + `catch { $_ *>> '${base}.log'; $c = 1 }; Set-Content '${base}.code' $c`
  }
  return `rm -f "${base}.code"; ( ${commande} ) > "${base}.log" 2>&1; echo $? > "${base}.code"`
}

/** Le refus d'un appel de `outil` borné à `borne` ms, avec son remède à copier. PURE. */
function refus(outil, commande, borne, base) {
  return {
    decision: 'deny',
    raison: `⛔ Appel ${outil} au premier plan borné à ${borne} ms : un sous-agent ne tient pas un appel plus de `
      + `${BORNE_D_APPEL_MS} ms (#2596 — au-delà de 5 min, son cache de prompt expire et tout son contexte se réécrit). `
      + `Lance-la EN FOND — ${outil} avec \`run_in_background: true\` — sous cette forme :\n${commandeDeFond(outil, commande, base)}\n`
      + `puis SONDE-la par des appels bornés (Bash, \`timeout: ${TIMEOUT_DE_SONDE_MS}\`), autant de fois qu'elle rend ${CODE_EN_COURS} (EN COURS) :\n`
      + `${commandeDeSonde(`${base}.code`)}\n`
      + `Elle rend dès la fin de la commande, avec son code et la fin de ${base}.log, sinon à ${BORNE_DE_SONDE_S} s.`,
  }
}

/** Le refus d'un serveur vite lancé sans borne de vie, `graphie` = le segment vu. PURE. */
function refusServeur(outil, graphie) {
  return {
    decision: 'deny',
    raison: `⛔ Serveur vite SANS BORNE DE VIE REFUSÉ (${graphie}, ${outil}, #2603) : vite ne s'arrête pas sur inactivité, et `
      + 'un serveur lancé sans `timeout` survit à l\'appel, au shell et à l\'agent. Lance-le par l\'outil Bash, borné et en fond : '
      + '`timeout <N> npm run dev` (N en secondes, la durée de la recette), puis `node scripts/recette/arreter-dev.mjs` en fin de '
      + 'recette. Sous PowerShell, `timeout` est le `timeout.exe` de Windows, qui ne borne rien : passe par Bash. '
      + 'Variable d\'environnement : `VITE_RELAY_URL=… timeout <N> npm run dev`.',
  }
}

/** Le refus d'un serveur vite que la commande lance sans borne de vie (`borneDeVie`), `null` sans. PURE. */
function serveurSansBorne(outil, commande) {
  const budget = nouveauBudget()
  const segments = pipelinesDeJetons(commande, 0, { budget }).flat()
  if (budget.sature) return verdictDe(REFUS_SATURE)
  const texte = (s) => s.jetons.map((j) => j.text).join(' ')
  const vu = segments.find((s) => appelleServeurVite(texte(s)) && (outil === 'PowerShell' || borneDeVie(s) === null))
  return vu ? refusServeur(outil, texte(vu)) : null
}

function evaluer(entree, contexte) {
  const serveur = serveurSansBorne(entree.tool_name, commandeDe(entree))
  if (serveur) return serveur
  if (!sousAgent(entree)) return null
  const borne = borneDe(entreeDOutil(entree))
  if (borne === null || borne <= BORNE_D_APPEL_MS) return null
  const commande = commandeDe(entree)
  const base = baseDe({ session: entree.session_id, agent: entree.agent_id, cwd: entree.cwd ?? contexte?.cwd, commande })
  return refus(entree.tool_name, commande, borne, base)
}

export const garde = { nom: 'appel-borne', outils: OUTILS_BORNES, evaluer }
