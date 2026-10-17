// Garde PreToolUse des shells HORS Bash (`OUTILS_SHELL`, `scripts/guards/lib/contratGarde.mjs`) : une commande
// qu'un motif `Bash(…)` de `permissions.ask` (`.claude/settings.json`) soumet à confirmation ne part que par
// Bash, seul outil que ces motifs couvrent — décision « Confirmation » du 2026-10-17 (#2712). Les shells
// lean-ctx restent pré-approuvés pour les agents de fond (fiche `user-doctrine-ctx-shell-pre-approuve`) ;
// la garde REFUSE et renvoie à Bash, jamais ne demande (`user-doctrine-gardes-jamais-de-ask`). #2721.
import { readFileSync } from 'node:fs'
import { OUTILS_SHELL, commandeDe } from '../guards/lib/contratGarde.mjs'
import { segmentsProfonds } from '../guards/lib/commandeShell.mjs'

const SETTINGS = new URL('../../.claude/settings.json', import.meta.url)

/** Les motifs `Bash(<motif>)` de `permissions.ask` d'un `settings`, chacun `{ regle, re }` — `*` joker
 *  n'importe où (doc permissions de Claude Code). PURE. */
export const motifsDeConfirmation = (settings) => (settings?.permissions?.ask ?? [])
  .flatMap((regle) => /^Bash\((.+)\)$/.exec(regle)?.slice(1).map((motif) => ({
    regle,
    re: new RegExp(`^${motif.split('*').map((p) => p.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('.*')}$`),
  })) ?? [])

/** La règle `ask` qui soumet `commande` à confirmation — la commande entière ou l'un des segments qu'elle
 *  exécute —, `null` sinon. PURE. */
export function regleDeConfirmation(commande, motifs) {
  const textes = [commande.trim(), ...segmentsProfonds(commande).map((s) => s.join(' '))]
  return motifs.find(({ re }) => textes.some((t) => re.test(t)))?.regle ?? null
}

export function evaluer(entree, { lireSettings = () => JSON.parse(readFileSync(SETTINGS, 'utf8')) } = {}) {
  const commande = commandeDe(entree)
  if (!commande.trim()) return null
  const regle = regleDeConfirmation(commande, motifsDeConfirmation(lireSettings()))
  if (!regle) return null
  return {
    decision: 'deny',
    raison: `⛔ « ${commande} » est soumise à confirmation (\`${regle}\`, \`permissions.ask\` de .claude/settings.json), `
      + `que seul l'outil Bash porte : ${entree.tool_name} la lancerait sans elle. Relance-la par Bash.`,
  }
}

export const garde = { nom: 'confirmation-hors-bash', outils: OUTILS_SHELL.filter((o) => o !== 'Bash'), evaluer: (entree) => evaluer(entree) }
