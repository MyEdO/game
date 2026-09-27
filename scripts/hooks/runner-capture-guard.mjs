// Hook PreToolUse(Bash|PowerShell|mcp__lean-ctx__ctx_shell) : un runner qui n'ÉCRIT PAS sa sortie
// ne se lit pas par un filtre tronquant. Clause RUNNER du skill `orchestrer-des-agents` (audit
// 2026-08-30) : « toute commande de runner écrit sa sortie COMPLÈTE dans un fichier du scratchpad,
// puis LIT le fichier ; jamais un filtre inline (`| grep`, `| tail`) comme SEULE lecture ».
//
// CIBLE = le runner SANS capture, mesuré (2026-09-02) :
//   - `npm test` et `node scripts/test/run.mjs` CAPTURENT déjà tout (`run.mjs:55`, fichier
//     `vitest-run-<pid>.txt`, relais l.189), et `npm run typecheck:fast` écrit
//     `node_modules/.cache/typecheck-last.txt` : un `| tail` y est une LECTURE de plus, pas une
//     perte — ces portes restent SILENCIEUSES, et recommandées.
//   - `npx vitest`, `vitest`, `tsc`, `eslint`, `npm run typecheck|lint|build`,
//     `node scripts/lancer-local.mjs …` n'écrivent rien : tronquer leur flux, c'est perdre la
//     sortie, et c'est là que le REFUS tombe.
//
// Le rappel `runner-fast-reminder.mjs` reste ce qu'il est (contexte doux, aucune décision) : la
// porte vit ICI, dans un garde séparé, pour qu'un blocage ne se cache pas dans un rappel.
//
// VU / HORS PORTÉE, dit :
//   - `cut` ne tronque pas (il coupe des COLONNES, toutes les lignes sortent), `grep <motif>` sans
//     `-m` filtre sans borner : aucun des deux n'est un lecteur tronquant.
//   - `runner | tee f.txt | tail -5` : le fichier de `tee` porte la sortie ENTIÈRE → silence.
//   - `runner > f.txt ; tail -20 f.txt` : la capture précède la lecture, et le `tail` porte un
//     OPÉRANDE de fichier (il ne lit pas le flux) → silence. C'est le geste prescrit.
//   - le lien mesuré est le PIPELINE, pas le rang : `pipelinesProfonds` (socle) rend les segments
//     qu'un `|` chaîne réellement, et le lecteur n'est cherché qu'EN AVAL du runner, DANS son
//     pipeline. Deux commandes sans rapport enchaînées par `;` ou `&&` (`npx eslint . ; git log |
//     head -5`) n'en forment pas un : rien n'y tronque la sortie du runner, et le garde se tait
//     (3 faux positifs mesurés avant ce groupement). La profondeur reste couverte : les pipelines
//     d'un `sh -c "npx vitest | tail"` sont rendus comme les autres.
import '../node-requis.mjs'
import { pipelinesProfonds } from './solde-ticket-guard.mjs'

/** `{ exe, args }` d'un segment : basename sans extension, en minuscules (call-operator sauté). */
function executableDe(segment) {
  const start = segment[0] === '&' ? 1 : 0
  if (segment.length <= start) return { exe: '', args: [] }
  const exe = segment[start].replace(/\\/g, '/').split('/').pop().replace(/\.(exe|cmd|bat|mjs|js)$/i, '').toLowerCase()
  return { exe, args: segment.slice(start + 1) }
}

/** Scripts npm qui CAPTURENT leur sortie (voir en-tête) : jamais un runner à garder. */
const SCRIPTS_CAPTURANTS = ['typecheck:fast']
/** Scripts npm qui n'écrivent RIEN : leur flux est la seule sortie. */
const SCRIPTS_RUNNERS = ['typecheck', 'lint', 'build']
const EXES_RUNNERS = ['vitest', 'tsc', 'eslint']
const GESTIONNAIRES = ['npm', 'pnpm', 'yarn']

/** Le segment lance-t-il un runner SANS capture propre ? (`npm test` capture : voir en-tête) */
export function estRunnerNonCapturant(segment) {
  const { exe, args } = executableDe(segment)
  if (EXES_RUNNERS.includes(exe)) return true
  if (GESTIONNAIRES.includes(exe)) {
    const script = args[0] === 'run' ? args[1] : args[0]
    if (script === undefined) return false
    if (script === 'test' || script.startsWith('test:') || SCRIPTS_CAPTURANTS.includes(script)) return false
    return SCRIPTS_RUNNERS.includes(script)
  }
  if (exe === 'node') {
    const cible = String(args.find((a) => !a.startsWith('-')) ?? '').replace(/\\/g, '/')
    if (/scripts\/test\/run\.mjs$/.test(cible)) return false
    return /scripts\/lancer-local\.mjs$/.test(cible)
  }
  return false
}

/** Le segment REDIRIGE-t-il sa sortie dans un fichier (`> f`, `>> f`, `2> f`, `&> f`, `>f`) ? */
export function capture(segment) {
  return segment.some((t) => /^(&|\d)?>>?/.test(t))
}

/** Le segment est-il un `tee <fichier>` (la sortie complète part dans un fichier) ? */
function estTee(segment) {
  const { exe, args } = executableDe(segment)
  return exe === 'tee' && args.some((a) => !a.startsWith('-'))
}

/** Opérandes d'un lecteur : tokens qui ne sont ni un flag, ni la valeur d'un flag à valeur. */
function operandes(args, flagsAValeur) {
  const out = []
  for (let i = 0; i < args.length; i++) {
    const a = args[i]
    if (a.startsWith('-') || /^\+\d+$/.test(a)) {
      if (flagsAValeur.includes(a)) i += 1
      continue
    }
    out.push(a)
  }
  return out
}

const FLAGS_NOMBRE = ['-n', '-c', '--lines', '--bytes', '-m', '--max-count']

/**
 * Le segment TRONQUE-t-il un FLUX ? (`null` sinon). Un lecteur qui porte un opérande de FICHIER lit
 * ce fichier, pas le tube : c'est la lecture d'après capture, elle passe.
 */
export function lecteurTronquantDeFlux(segment) {
  const { exe, args } = executableDe(segment)
  const fichiers = (n = 0) => operandes(args, FLAGS_NOMBRE).slice(n)
  switch (exe) {
    case 'head':
      return fichiers().length === 0 ? 'head' : null
    // `tail -n +N` rend TOUT à partir de la ligne N (mesuré : 9 lignes sur 9) — il ne tronque pas.
    case 'tail':
      if (args.some((a) => /^\+\d+$/.test(a) || /^-n\+\d+$/.test(a))) return null
      return fichiers().length === 0 ? 'tail' : null
    case 'sed':
      if (!args.some((a) => /^-[a-z]*n[a-z]*$/.test(a))) return null
      return fichiers(1).length === 0 ? 'sed -n' : null
    case 'awk':
      if (!args.some((a) => /\bNR\b/.test(a))) return null
      return fichiers(1).length === 0 ? 'awk NR' : null
    case 'grep':
    case 'rg':
      if (!args.some((a) => a === '-m' || /^-m\d+$/.test(a) || a === '--max-count' || /^--max-count=/.test(a))) return null
      return fichiers(1).length === 0 ? 'grep -m' : null
    // PowerShell : `Select-Object` ne lit QUE le pipeline, jamais un fichier.
    case 'select-object':
    case 'select':
      return args.some((a) => /^-(first|last)/i.test(a)) ? 'Select-Object -First/-Last' : null
    default:
      return null
  }
}

/**
 * Décision du hook (PURE, testable). `null` = silence ; `{ decision, reason }` sinon — `deny` quand
 * la sortie d'un runner NON capturant part dans un lecteur qui la TRONQUE.
 */
export function evaluate(command) {
  if (!command) return null
  for (const pipeline of pipelinesProfonds(command)) {
    const rangRunner = pipeline.findIndex((s) => estRunnerNonCapturant(s) && !capture(s))
    if (rangRunner === -1) continue
    // `tee <fichier>` DANS ce pipeline : la sortie entière est écrite, ce qui suit peut tronquer.
    if (pipeline.some(estTee)) continue
    for (let i = rangRunner + 1; i < pipeline.length; i++) {
      const lecteur = lecteurTronquantDeFlux(pipeline[i])
      if (!lecteur) continue
      const runner = pipeline[rangRunner].join(' ')
      return {
        decision: 'deny',
        reason:
          '⛔ Sortie de runner TRONQUÉE sans capture (`' + runner + '` → `' + lecteur + '`) : ce runner ' +
          'n\'écrit sa sortie nulle part, ce qui passe le filtre est donc perdu — et le code de sortie ' +
          'lu à travers un tube est celui du DERNIER maillon. Écrire la sortie COMPLÈTE dans un fichier ' +
          'du scratchpad puis LIRE ce fichier : `' + runner + ' > sortie.txt 2>&1` (le code de sortie se ' +
          'relève juste après), puis `tail -40 sortie.txt`. Portes qui capturent déjà et restent libres : ' +
          '`npm test`, `node scripts/test/run.mjs`, `npm run typecheck:fast`.',
      }
    }
  }
  return null
}

// ── Driver stdin (n'exécute QUE lancé en direct, jamais à l'import du module de test) ─────────────
if (import.meta.main) {
  let raw = ''
  process.stdin.setEncoding('utf8')
  for await (const chunk of process.stdin) raw += chunk
  let command = ''
  try { command = String(JSON.parse(raw)?.tool_input?.command ?? '') } catch { /* stdin illisible → silence */ }
  const decision = evaluate(command)
  if (decision) {
    console.log(JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: decision.decision ?? 'deny',
        permissionDecisionReason: decision.reason,
      },
    }))
  }
  process.exit(0)
}
