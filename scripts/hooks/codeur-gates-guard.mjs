// Hook PreToolUse (canaux shell) : un sous-agent `codeur` ne joue PAS les gates de la CI.
// POURQUOI — verbatims utilisateur du 2026-09-15 :
//   « C'est absurde ... on a dépêché un agent pour créer un fichier (+ son test, + le lien pour
//     l'appeler) et ça va nous prendre 25 min ? »
//   « La mémoire c'est cool mais ça n'empêche pas de réitérer la même erreur plus tard »
// Mesuré sur #1768 : ~12 min de code + test verts, puis ~13 min de gates (lint, knip, docs:check,
// test:ops) imposées au codeur par son BRIEF. Le run CI de la branche les joue TOUTES, UNE fois, sur
// la tête poussée (`.github/workflows/ci.yml`, #1776) : les payer aussi en local, par agent, c'est
// les payer deux fois. `.claude/agents/codeur.md` le disait déjà — une consigne, pas un verrou : le
// brief l'a écrasée. D'où ce hook, qui refuse le geste au lieu de le déconseiller.
//
// Les gates sont déclarées UNE fois dans le dépôt (`ECRIT_LU` de `scripts/gates/toutes.mjs`, dont
// les clés sont des noms de scripts npm) et ce hook les LIT : ajouter une gate = une ligne dans
// `ci.yml` et une dans `ECRIT_LU`, zéro ligne ici (#1750 : « un geste du régime qu'une session doit
// encore savoir par cœur est un défaut d'outillage »).
//
// Le champ `agent_type` du payload PreToolUse nomme le type du sous-agent appelant (doc Claude Code,
// hooks.md § Subagent Behavior) et n'existe pas depuis la session principale : l'orchestrateur n'est
// jamais visé. Sous Codex (`.codex/hooks.json`, même script) ces champs n'existent pas non plus — le
// hook y est un no-op silencieux, par construction.
import '../node-requis.mjs'
import { lireStdinBorne } from '../guards/lib/stdinBorne.mjs'
import { appelleTscNu, appelleVitestNu, segmentsHorsServer, LECTEURS } from '../guards/lib/appelsRunners.mjs'
import { segmentsProfonds, basenameExecutable } from './solde-ticket-guard.mjs'
import { ECRIT_LU } from '../gates/toutes.mjs'

/** Types de sous-agent visés : seul le `codeur` reçoit des briefs porteurs de gates. */
const TYPES_VISES = new Set(['codeur'])

/**
 * Gates qu'un codeur joue LÉGITIMEMENT : lecture seule, coût quasi nul, et elles portent sur son
 * propre livrable (la parité des définitions d'agent se vérifie au site qui l'édite).
 */
const HORS_VERROU = new Set(['agents:check'])

/**
 * `npm test` est la suite ENTIÈRE sous son nom npm canonique — une gate même si la liste ne la
 * nomme pas —, ET le seul script de gate qui porte aussi une forme de PÉRIMÈTRE :
 * `npm test -- <chemins>` est le lanceur RESTREINT que le dépôt recommande (capture en fichier +
 * bornes de charge). Sans chemin, c'est la suite entière, donc la gate.
 */
const SUITE_ENTIERE_NPM = new Set(['test'])

/** Dossiers dont l'analyse entière EST la gate (par opposition à une liste de fichiers). */
const CIBLES_DE_GATE = new Set(['.', 'src', 'scripts', 'server', 'docs'])

/** Sous-commandes de `npm` qui nomment leur script, et raccourcis qui portent leur nom pour nom. */
const SOUS_COMMANDES_RUN = new Set(['run', 'run-script'])
const RACCOURCIS_NPM = new Set(['test', 'start', 'stop', 'restart'])
/** Appel d'un exécutable local, sous ses graphies `npx`/`node`/chemin. */
const appelDe = (outil) =>
  new RegExp(`^(?:npx\\s+|node\\s+)?(?:\\S*[\\\\/])?${outil}(?:\\.cmd|\\.js|\\.mjs)?(?=\\s|$)`)
const APPEL_KNIP = appelDe('knip')
const APPEL_ESLINT = appelDe('eslint')
/** Le lanceur d'une gate entière : `node scripts/gates/…`, `node scripts/test/node-tests.mjs <gate>`. */
const LANCEUR_DE_GATE = /^node\s+(?:\S*[\\/])?scripts[\\/]gates[\\/]/
const LANCEUR_NODE_TESTS = /^node\s+(?:\S*[\\/])?scripts[\\/]test[\\/]node-tests\.mjs(?=\s|$)/

/** Drapeaux qui CONSOMMENT le mot suivant : sa valeur n'est pas un chemin. */
const DRAPEAUX_A_VALEUR = new Set(['-t', '--testNamePattern', '--reporter', '--project', '--config', '-c'])

/**
 * Arguments POSITIONNELS d'un segment, l'exécutable et les drapeaux (avec leur valeur) retirés.
 * @param {string} segment
 * @param {RegExp} appel motif de l'exécutable, à retirer en tête
 * @returns {string[]}
 */
function argumentsPositionnels(segment, appel) {
  const mots = segment.replace(appel, '').trim().split(/\s+/).filter(Boolean)
  const positionnels = []
  for (let i = 0; i < mots.length; i += 1) {
    const mot = mots[i]
    if (mot.startsWith('-')) {
      if (DRAPEAUX_A_VALEUR.has(mot)) i += 1
      continue
    }
    positionnels.push(mot)
  }
  return positionnels
}

/** `true` si ce mot est un dossier dont l'analyse ENTIÈRE est la gate (slash final indifférent). */
const estCibleDeGate = (mot) => CIBLES_DE_GATE.has(mot.replace(/[\\/]+$/, ''))

/** `true` si ce mot DÉSIGNE un chemin de fichier ou de sous-dossier (≠ un dossier-gate, ≠ un motif). */
const designeUnChemin = (mot) =>
  !estCibleDeGate(mot) && (/[\\/]/.test(mot) || /\.(?:ts|tsx|mts|mjs|cjs|js|jsx|json)$/.test(mot))

/**
 * Nom du script npm qu'un segment lance (`npm run <x>`, `npm <raccourci>`), ou `null`. Le segment
 * arrive TOKENISÉ par le socle : l'exécutable se juge sur son basename (`npm.cmd`, `& npm`) et les
 * drapeaux propres à npm (`--silent`, `-s`) se sautent aux deux crans, comme npm lui-même le fait.
 * @param {string[]} tokens
 * @returns {string|null}
 */
function nomScriptNpm(tokens) {
  const debut = tokens[0] === '&' ? 1 : 0
  if (basenameExecutable(tokens[debut] ?? '') !== 'npm') return null
  const apresFlags = (i) => {
    while (tokens[i] !== undefined && tokens[i].startsWith('-') && tokens[i] !== '--') i += 1
    return i
  }
  const iSub = apresFlags(debut + 1)
  const sub = tokens[iSub]
  if (SOUS_COMMANDES_RUN.has(sub)) return tokens[apresFlags(iSub + 1)] ?? null
  return RACCOURCIS_NPM.has(sub) ? sub : null
}

/** Noms de scripts npm que la CI joue, tirés de la table `ECRIT_LU` du dépôt. */
export const gatesDeLaCi = (ecritLu = ECRIT_LU) =>
  Object.keys(ecritLu).filter((nom) => !HORS_VERROU.has(nom))

/**
 * Le GESTE à nommer dans le refus : le segment fautif quand il figure tel quel dans la commande,
 * sinon la commande entière — un segment issu d'une RÉSOLUTION (`npm run gates` → le corps lu dans
 * `package.json`) ou d'un déballage d'enrobeur ne se retrouve pas dans ce que le codeur a tapé.
 * @param {string} segment
 * @param {string} commande
 * @returns {string}
 */
const gesteNomme = (segment, commande) => (commande.includes(segment) ? segment : commande.trim())

/**
 * La raison du refus, en une phrase : ce qui est refusé, qui le porte, et ce que le codeur joue
 * à la place — y compris le geste à faire quand c'est le BRIEF qui impose la gate.
 * @param {string} geste la commande refusée, telle qu'écrite
 * @returns {string}
 */
const raisonDuRefus = (geste) =>
  `[codeur] « ${geste} » est une gate de la CI — le run de la branche la joue une fois sur la tête ` +
  `poussée, et c'est lui la porte. Joue le test de TON périmètre (\`node --test <fichier>\`, ` +
  `\`npx vitest run <fichiers>\`, \`npm run typecheck:fast\`). Un brief qui te l'impose se REFUSE : ` +
  `« BRIEF REFUSÉ : gates hors périmètre ».`

/**
 * Décision PURE du hook.
 * @param {{ agentType?: string|null, commande?: string, gates?: string[] }} entree
 *   `gates` = les noms de scripts npm que la CI joue (défaut : lus dans `ECRIT_LU`).
 * @returns {{ decision: 'deny', reason: string }|null} `null` = rien à dire (exit 0, aucune sortie).
 */
export function evaluate({ agentType = null, commande = '', gates = gatesDeLaCi(), options } = {}) {
  if (!TYPES_VISES.has(String(agentType ?? ''))) return null
  const deLaCi = new Set(gates)
  const brute = String(commande)

  // Le sous-projet `server/` est retiré AVANT la segmentation profonde : ses scripts se résoudraient
  // sinon dans le `package.json` de la RACINE (`cd server && npm run typecheck` y deviendrait la gate
  // du train, alors que c'est le périmètre d'un codeur dépêché sur `server/`). Portée = l'autorité
  // unique de `segmentsHorsServer`. Le recollage par `&&` est sans perte pour la suite : le socle
  // re-tokenise, et le groupement en tubes n'entre dans aucune de ces décisions.
  const aAnalyser = segmentsHorsServer(brute).join(' && ')

  // Segmentation PROFONDE (socle partagé) : sous-shells, enrobeurs de tête, et RÉSOLUTION d'un
  // `npm run <x>` vers le corps lu dans `package.json` — c'est elle qui fait tomber `npm run gates`
  // (résolu en `node scripts/gates/toutes.mjs`, le rejeu local) et les sept enrobages mesurés.
  for (const tokens of segmentsProfonds(aAnalyser, 0, options)) {
    const segment = tokens.join(' ')
    if (!segment || LECTEURS.test(segment)) continue

    // 1. Un script npm que la CI joue, sous son nom.
    const script = nomScriptNpm(tokens)
    if (script) {
      const estUneGate = SUITE_ENTIERE_NPM.has(script) || deLaCi.has(script)
      const restreintAUnPerimetre =
        SUITE_ENTIERE_NPM.has(script) && argumentsPositionnels(segment, /^\S+/).some(designeUnChemin)
      if (estUneGate && !restreintAUnPerimetre) {
        return { decision: 'deny', reason: raisonDuRefus(gesteNomme(segment, brute)) }
      }
    }

    // 2. Le lanceur d'une gate entière.
    if (LANCEUR_DE_GATE.test(segment) || LANCEUR_NODE_TESTS.test(segment)) {
      return { decision: 'deny', reason: raisonDuRefus(gesteNomme(segment, brute)) }
    }

    // 3. `knip` : il n'y a pas de knip « de périmètre », il balaie le graphe entier.
    if (APPEL_KNIP.test(segment)) return { decision: 'deny', reason: raisonDuRefus(gesteNomme(segment, brute)) }

    // 4. `eslint` sur un DOSSIER (ou sans cible) = la gate `lint` ; sur des FICHIERS = le périmètre.
    if (APPEL_ESLINT.test(segment)) {
      const cibles = argumentsPositionnels(segment, APPEL_ESLINT)
      if (cibles.length === 0 || cibles.every(estCibleDeGate)) {
        return { decision: 'deny', reason: raisonDuRefus(gesteNomme(segment, brute)) }
      }
    }

    // 5. `vitest run` SANS chemin = la suite entière ; avec des chemins = le test du périmètre.
    if (appelleVitestNu(segment)) {
      const cibles = argumentsPositionnels(segment, /^(?:npx\s+|node\s+)?(?:\S*[\\/])?vitest(?:\.cmd|\.mjs|\.js)?/)
        .filter((cible) => cible !== 'run')
      if (!cibles.some(designeUnChemin)) return { decision: 'deny', reason: raisonDuRefus(gesteNomme(segment, brute)) }
    }

    // 6. `tsc --noEmit` nu : la porte de vérité full, ~42 s, portée par le train.
    if (appelleTscNu(segment)) return { decision: 'deny', reason: raisonDuRefus(gesteNomme(segment, brute)) }
  }

  return null
}

// ── Driver stdin (n'exécute QUE lancé en direct, jamais à l'import du module de test) ─────────────
if (import.meta.main) {
  const brut = await lireStdinBorne()
  let agentType = null
  let commande = ''
  try {
    const charge = JSON.parse(brut || '{}')
    agentType = typeof charge?.agent_type === 'string' ? charge.agent_type : null
    commande = String(charge?.tool_input?.command ?? '')
  } catch {
    /* stdin illisible → silence */
  }
  const decision = evaluate({ agentType, commande })
  if (decision) {
    console.log(
      JSON.stringify({
        hookSpecificOutput: {
          hookEventName: 'PreToolUse',
          permissionDecision: decision.decision,
          permissionDecisionReason: decision.reason,
        },
      }),
    )
  }
  process.exit(0)
}
