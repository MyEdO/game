// Garde PreToolUse de l'outil `Workflow` (#2537) : tout `agent()` du script porte des options
// littérales FERMÉES et un `agentType` LITTÉRAL qui nomme un type déclaré sous `.claude/agents/`
// (`defautsDesSitesDAgent`, couche universelle, scripts/guards/lib/formeDeWorkflow.mjs). Calibrage :
// `.claude/skills/orchestrer-des-agents/SKILL.md`.
//
// Le script jugé, dans cet ordre : `tool_input.script` ; le fichier `tool_input.scriptPath` ;
// `tool_input.name`, résolu en `<cwd>/.claude/workflows/<name>.js`. `resumeFromRunId` accompagne
// `scriptPath` ou `name` : le script se juge comme eux ; seul, il ne désigne aucun script jugeable et
// se refuse. Un script introuvable, illisible ou qui ne parse pas se refuse, non jugeable.
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { analyserTexte } from '../guards/lib/dialecte.mjs'
import { entreeDOutil } from '../guards/lib/contratGarde.mjs'
import { versCheminNatif } from '../guards/lib/commandeShell.mjs'
import { defautsDesSitesDAgent } from '../guards/lib/formeDeWorkflow.mjs'
import { typesDeclares } from '../guards/lib/typesDAgent.mjs'

const RACINE = fileURLToPath(new URL('../../', import.meta.url))
const CONSIGNE = 'chaque `agent(prompt, { … })` porte un objet d’options littéral fermé et `agentType: \'<type>\'`, un type de `.claude/agents/` (table « Calibrage » de `.claude/skills/orchestrer-des-agents/SKILL.md`)'

const refus = (raison) => ({ decision: 'deny', raison: `⛔ Workflow : ${raison} — ${CONSIGNE}.` })

/** Le script désigné par l'entrée : `{ texte, lieu }`, ou `{ nonJugeable }`. */
function scriptDe(input, base) {
  const lire = (chemin, quoi) => {
    try {
      return { texte: readFileSync(chemin, 'utf8'), lieu: chemin }
    } catch (e) {
      return { nonJugeable: `${quoi} illisible (${chemin} : ${e?.code ?? e?.message ?? e})` }
    }
  }
  if (typeof input.script === 'string') return { texte: input.script, lieu: 'script' }
  if (typeof input.scriptPath === 'string' && input.scriptPath) return lire(resolve(base, versCheminNatif(input.scriptPath)), '`scriptPath`')
  if (typeof input.name === 'string' && input.name) {
    const chemin = join(base, '.claude', 'workflows', `${input.name}.js`)
    const lu = lire(chemin, '`name`')
    return lu.nonJugeable ? { nonJugeable: `nom « ${input.name} » non résolu dans ${join(base, '.claude', 'workflows')} — un script hors du dépôt ne se juge pas ; passer \`scriptPath\` ou \`script\`` } : lu
  }
  if (input.resumeFromRunId !== undefined) return { nonJugeable: '`resumeFromRunId` sans `scriptPath` ni `name` : aucun script à juger' }
  return { nonJugeable: 'ni `script`, ni `scriptPath`, ni `name`' }
}

function evaluer(entree, { baseDeLAppel }) {
  const input = entreeDOutil(entree)
  if (input === null) return refus('entrée sans objet `tool_input`, non jugeable')
  const lu = scriptDe(input, baseDeLAppel ?? process.cwd())
  if (lu.nonJugeable) return refus(`script non jugeable : ${lu.nonJugeable}`)
  const { sourceFile: sf, diagnostics } = analyserTexte({ rel: 'workflow.js', text: lu.texte })
  if (diagnostics.length) return refus(`script non jugeable : ${lu.lieu} ne parse pas`)
  const defauts = defautsDesSitesDAgent(sf, { typesDeclares: typesDeclares(RACINE) })
  if (defauts.length === 0) return null
  return refus(`${lu.lieu} : ${defauts.map((d) => d.message.replace(/^.*?:(\d+) — /, 'l.$1 — ')).join(' ; ')}`)
}

export const garde = { nom: 'workflow-type', outils: ['Workflow'], evaluer }
