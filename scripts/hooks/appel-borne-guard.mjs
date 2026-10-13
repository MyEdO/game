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
import { createHash } from 'node:crypto'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { commandeDe, entreeDOutil, sousAgent } from '../guards/lib/contratGarde.mjs'
import { BORNE_DE_SONDE_S, CODE_EN_COURS, commandeDeSonde } from '../ops/sonde.mjs'

/** La borne d'un appel d'outil d'un sous-agent : sous le TTL de 5 min de son cache de prompt (#2596). */
export const BORNE_D_APPEL_MS = 270_000

/** La borne d'un appel Bash ou PowerShell sans `timeout`. */
const BORNE_PAR_DEFAUT_MS = 120_000

/** Le `timeout` d'un appel de sonde : sa borne, plus le lancement de node. */
const TIMEOUT_DE_SONDE_MS = BORNE_DE_SONDE_S * 1000 + 20_000

/** Les outils dont un champ `timeout` borne l'attente au premier plan. */
const OUTILS_BORNES = ['Bash', 'PowerShell']

/** La borne de l'attente au premier plan d'un `tool_input`, `null` en fond. PURE. */
function borneDe(input) {
  if (input?.run_in_background === true) return null
  return typeof input?.timeout === 'number' ? input.timeout : BORNE_PAR_DEFAUT_MS
}

/** La base des fichiers `.log` et `.code` d'une commande : hors de l'arbre (#2585), nommée par son empreinte. */
const baseDe = (commande) => join(tmpdir(), `appel-${createHash('sha1').update(commande).digest('hex').slice(0, 10)}`).replaceAll('\\', '/')

/** La commande de fond à copier, pour l'outil `outil`. PURE. */
function commandeDeFond(outil, commande, base) {
  if (outil === 'PowerShell') {
    return `Remove-Item -ErrorAction Ignore '${base}.code'; & { ${commande} } *> '${base}.log'; Set-Content '${base}.code' $LASTEXITCODE`
  }
  return `rm -f "${base}.code"; ( ${commande} ) > "${base}.log" 2>&1; echo $? > "${base}.code"`
}

/** Le refus d'un appel de `outil` borné à `borne` ms, avec son remède à copier. PURE. */
function refus(outil, commande, borne) {
  const base = baseDe(commande)
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

function evaluer(entree) {
  if (!sousAgent(entree)) return null
  const borne = borneDe(entreeDOutil(entree))
  return borne !== null && borne > BORNE_D_APPEL_MS ? refus(entree.tool_name, commandeDe(entree), borne) : null
}

export const garde = { nom: 'appel-borne', outils: OUTILS_BORNES, evaluer }
