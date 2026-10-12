// #2537 — garde des types en LECTURE SEULE (`enLectureSeule`, scripts/guards/lib/typesDAgent.mjs) : elle refuse ce qui
// est PROUVÉ écrire hors du scratchpad de leur session — une cible résolue hors de lui, une commande de la table
// FERMÉE des écrivains (`ecrivain`, `ciblesDEcritureDeCommande`) —, et rien d'autre.
// Non jugé, donc admis (#2537) : cible non résolue hors de la table des écrivains (variable inconnue, chemin JS non
// littéral, `import()` calculé, lanceur à exécutable non constant), git, npm, npx ou gh à sous-commande non
// constante, script non lu (langage autre que JS, hors du scratchpad, illisible, non parsable, écrit par la commande
// qui le lance).
// Trous (#2537) : `awk system()`, `sed e`, `rg --pre`, script SUIVI qui écrit, module importé par un script du
// scratchpad, écritures `.git/` de `git status`.
// Évasion intentionnelle, hors de la classe que la garde ferme (#2537) : programme lancé par git (`GIT_PAGER`,
// `GIT_EXTERNAL_DIFF`, `git -c core.pager=`, `grep -O`), interpréteur hors liste (`bun`, `deno`, `ruby`, `php`),
// `fs['write'+…]`, `createRequire`, `getBuiltinModule`, global masqué (`const process = …`), classe locale.
import { readFileSync, readdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { extname, isAbsolute, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { OUTILS_SHELL, commandeDe } from '../guards/lib/contratGarde.mjs'
import { analyserTexte, scriptKindDe } from '../guards/lib/dialecte.mjs'
import { versCheminNatif } from '../guards/lib/commandeShell.mjs'
import { ciblesDEcritureDeCommande } from '../guards/lib/ecrituresShell.mjs'
import { ciblesDEcritureJS } from '../guards/lib/ecrituresFichiers.mjs'
import { estSuiteVitest } from '../guards/lib/fichierVitest.mjs'
import { enLectureSeule, fichesDAgent } from '../guards/lib/typesDAgent.mjs'
import { canoniser } from '../docs/lib/chemin-mesure.mjs'

const RACINE = fileURLToPath(new URL('../../', import.meta.url))
const SEGMENT = /^[A-Za-z0-9._-]+$/

/**
 * Le scratchpad de la session : `<tmpdir>/claude/<slug>/<session_id>/scratchpad`, `<slug>` étant le
 * segment qui suit `.claude/projects/` dans `transcript_path` ; `null` s'il ne se dérive pas. PURE.
 * @param {{ transcript_path?: unknown, session_id?: unknown }} entree @param {string} [tmp]
 */
export function scratchpadDeSession(entree, tmp = tmpdir()) {
  const { transcript_path: transcript, session_id: session } = entree ?? {}
  if (typeof transcript !== 'string' || typeof session !== 'string' || !SEGMENT.test(session) || /^\.+$/.test(session)) return null
  const parties = transcript.split(/[\\/]+/)
  const k = parties.findIndex((p, i) => p === 'projects' && parties[i - 1] === '.claude')
  const slug = k < 0 ? undefined : parties[k + 1]
  if (!slug || !SEGMENT.test(slug) || /^\.+$/.test(slug)) return null
  return join(tmp, 'claude', slug, session, 'scratchpad')
}

/** `chemin` est-il `dossier` ou sous lui ? Chemins canonisés, casse ignorée sous win32. */
function sous(chemin, dossier, platform) {
  const pli = (p) => (platform === 'win32' ? canoniser(p).toLowerCase() : canoniser(p))
  const rel = relative(pli(dossier), pli(chemin))
  return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel))
}

/** Le texte du script `chemin`, ou la raison qui l'empêche de se lire. */
function lireSurDisque(chemin) {
  try {
    return { texte: readFileSync(chemin, 'utf8') }
  } catch (e) {
    return { raison: `illisible (${e?.code ?? e?.message ?? e})` }
  }
}

/** Les suites (`estSuiteVitest`) sous `dossier`, hors `node_modules` ; `[]` s'il ne se lit pas. */
function testsSurDisque(dossier) {
  try {
    return readdirSync(dossier, { recursive: true, withFileTypes: true })
      .filter((e) => e.isFile() && estSuiteVitest(e.name) && !/[\\/]node_modules(?:[\\/]|$)/.test(e.parentPath))
      .map((e) => join(e.parentPath, e.name))
  } catch {
    return []
  }
}

/** Le CANAL d'un refus, par famille : ce que l'agent fait à la place. */
const CANAUX = {
  scratchpad: (sp) => `écris sous \`${sp}\``,
  inconnue: (sp) => `une cible littérale sous \`${sp}\``,
  git: () => 'la sous-commande de lecture de git (`log`, `show`, `diff`, `status`, `reflog <ref>`…)',
  npm: () => '`npx tsc --noEmit`, `npx vitest run <fichiers>` ou `npm test -- <fichiers>`',
  npx: () => 'un outil de la table de lecture de `npx` (`vitest run`, `tsc --noEmit`, `eslint` sans `--fix`/`--cache`, `prettier --check`)',
  gh: () => 'la sous-commande de lecture de `gh` (`issue view`, `pr view`, `run view`, `api` en GET)',
  session: () => 'un appel porteur de `transcript_path` et `session_id`',
}
/** La famille de l'écrivain `operation` (`git …`, `npm …`, `npx …`, `gh …`), `inconnue` pour tout autre. */
const canalDeLEcrivain = (operation) => (['git', 'npm', 'npx', 'gh'].includes(operation.split(' ')[0]) ? operation.split(' ')[0] : 'inconnue')

/**
 * Les défauts `{ texte, canal }` d'une commande d'un type en lecture seule, contre son `scratchpad` : une cible résolue
 * hors de lui, une cible inconnue d'un ÉCRIVAIN (`ecrivain`). Un script JS du scratchpad (un positionnel ou un `--dir`
 * de `vitest` qui y mène compris) se juge à ses écritures déclarées (`ciblesDEcritureJS`), au texte que la commande y
 * écrit AVANT de le lancer (`contenu`), sinon au disque (`lire`, `lister`) ; tout autre script n'est pas jugé.
 * @param {string} commande
 * @param {{ base: string, scratchpad: string | null, platform?: NodeJS.Platform, env?: Record<string, string | undefined>, powershell?: boolean, lire?: typeof lireSurDisque, lister?: typeof testsSurDisque }} contexte
 * @returns {{ texte: string, canal: keyof typeof CANAUX }[]}
 */
export function defautsDeCommande(commande, contexte) {
  const { base, scratchpad, platform = process.platform, env = {}, powershell = false, lire = lireSurDisque, lister = testsSurDisque } = contexte
  const cle = (chemin) => (platform === 'win32' ? chemin.toLowerCase() : chemin)
  const dansLeScratchpad = (chemin) => scratchpad !== null && sous(chemin, scratchpad, platform)
  const ecrits = new Map()
  /** Les défauts du script JS `chemin` du scratchpad, de texte `texte`, lancé depuis `depuis` avec `argv`. */
  const defautsDuScript = (chemin, texte, depuis, argv) => {
    const rel = scriptKindDe(chemin, { inconnu: 'refus' }) === null ? 'script.mjs' : `script${extname(chemin)}`
    if (analyserTexte({ rel, text: texte }).diagnostics.length) return []
    return ciblesDEcritureJS(texte, { rel, fichier: chemin, argv, env, platform }).flatMap((cible) => {
      if (cible.commande !== undefined) {
        return defautsDeCommande(cible.commande, { ...contexte, base: depuis ?? base, powershell: false })
          .map((d) => ({ ...d, texte: `script ${chemin} : ${cible.operation} « ${cible.commande} » : ${d.texte}` }))
      }
      if (cible.inconnue || depuis === null) return []
      return dansLeScratchpad(resolve(depuis, versCheminNatif(cible.chemin, platform))) ? [] : [{ texte: `script ${chemin} : ${cible.operation} hors du scratchpad (${cible.chemin})`, canal: 'scratchpad' }]
    })
  }
  /** Les défauts du script `chemin` que lance `cible` : lu s'il est un JS du scratchpad, non jugé sinon. */
  const defautsDuLancement = (chemin, cible) => {
    if (!dansLeScratchpad(chemin) || cible.langage !== 'js') return []
    const ecrit = ecrits.get(cle(chemin))
    if (ecrit === null) return []
    const lu = ecrit === undefined ? lire(chemin) : { texte: ecrit }
    return lu.raison ? [] : defautsDuScript(chemin, lu.texte, cible.base ?? base, cible.argv)
  }
  return ciblesDEcritureDeCommande(commande, { base, platform, env, powershell, scripts: true }).flatMap((cible) => {
    if (cible.puits) return []
    if (cible.inconnue) {
      return cible.ecrivain ? [{ texte: `${cible.operation} : écrivain à cible non résolue (« ${cible.segment?.source ?? commande} »)`, canal: canalDeLEcrivain(cible.operation) }] : []
    }
    if (cible.operation === 'script') {
      if (!cible.dossier) return defautsDuLancement(cible.chemin, cible)
      return dansLeScratchpad(cible.chemin) ? lister(cible.chemin).flatMap((test) => defautsDuLancement(test, cible)) : []
    }
    ecrits.set(cle(cible.chemin), cible.contenu ?? null)
    if (scratchpad === null) return [{ texte: `écriture ${cible.operation} (${cible.chemin}) : scratchpad de session non dérivable (\`transcript_path\`, \`session_id\`)`, canal: 'session' }]
    return dansLeScratchpad(cible.chemin) ? [] : [{ texte: `${cible.operation} hors du scratchpad (${cible.chemin})`, canal: 'scratchpad' }]
  })
}

function evaluer(entree, { baseDeLAppel, platform = process.platform, env = {} }) {
  if (typeof entree?.agent_type !== 'string') return null
  const fiche = fichesDAgent(RACINE).get(entree.agent_type)
  if (!fiche || !enLectureSeule(fiche)) return null
  const scratchpad = scratchpadDeSession(entree)
  const defauts = defautsDeCommande(commandeDe(entree), { base: baseDeLAppel ?? process.cwd(), scratchpad, platform, env, powershell: entree.tool_name === 'PowerShell' })
  if (defauts.length === 0) return null
  const canaux = [...new Set(defauts.map((d) => d.canal))].map((canal) => CANAUX[canal](scratchpad ?? 'non dérivable'))
  return {
    decision: 'deny',
    raison: `⛔ Type \`${fiche.name}\` en lecture seule (\`.claude/agents/${fiche.name}.md\`) : ${defauts.map((d) => d.texte).join(' ; ')} — canal : ${canaux.join(' ; ')}.`,
  }
}

export const garde = { nom: 'lecture-seule', outils: OUTILS_SHELL, evaluer }
