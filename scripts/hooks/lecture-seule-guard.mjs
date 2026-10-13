// #2537 — garde des types en LECTURE SEULE (`enLectureSeule`, scripts/guards/lib/typesDAgent.mjs) : elle refuse ce qui
// est PROUVÉ écrire hors du scratchpad de leur session — une cible résolue hors de lui, une commande de la table
// FERMÉE des écrivains (`ecrivain`, `ciblesDEcritureDeCommande`) —, et rien d'autre.
// Non jugé, donc admis (#2537) : cible non résolue hors de la table des écrivains (variable inconnue, chemin JS non
// littéral, `import()` calculé, lanceur à exécutable non constant), git, npm, npx ou gh à sous-commande non
// constante, script non lu (lancé par un interpréteur autre que `node`, `tsx`, `vitest` ; hors du scratchpad,
// illisible, non parsable, écrit par la commande qui le lance, au-delà de `BUDGET_ANALYSE_MS`), tsconfig de `tsc` ou dossier balayé au-delà de
// ce budget, code en ligne d'un langage
// autre que JS, suite de `vitest` choisie par un filtre non constant.
// Trous (#2537) : suites de `vitest` lues à `estSuiteVitest`, jamais aux `include`/`exclude` de sa config ;
// `awk system()`, `sed e`, `rg --pre`, script SUIVI qui écrit, module importé par un script du scratchpad, écritures
// `.git/` de `git status`.
// Évasion intentionnelle, hors de la classe que la garde ferme (#2537) : programme lancé par git (`GIT_PAGER`,
// `GIT_EXTERNAL_DIFF`, `git -c core.pager=`, `grep -O`), interpréteur hors liste (`bun`, `deno`, `php`), code en ligne de `ruby`,
// `fs['write'+…]`, `createRequire`, `getBuiltinModule`, global masqué (`const process = …`), classe locale.
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { OUTILS_SHELL, commandeDe } from '../guards/lib/contratGarde.mjs'
import { scriptKindDe } from '../guards/lib/dialecte.mjs'
import { cheminsDe, versCheminNatif } from '../guards/lib/commandeShell.mjs'
import { ciblesDEcritureDeCommande } from '../guards/lib/ecrituresShell.mjs'
import { ciblesDEcritureJS, repertoireTemporaire } from '../guards/lib/ecrituresFichiers.mjs'
import { estSuiteVitest } from '../guards/lib/fichierVitest.mjs'
import { enLectureSeule, fichesDAgent } from '../guards/lib/typesDAgent.mjs'
import { canoniser } from '../docs/lib/chemin-mesure.mjs'

const RACINE = fileURLToPath(new URL('../../', import.meta.url))
const SEGMENT = /^[A-Za-z0-9._-]+$/

/**
 * Le scratchpad de la session : `<tmpdir>/claude/<slug>/<session_id>/scratchpad`, `<slug>` étant le
 * segment qui suit `.claude/projects/` dans `transcript_path`, joint par le `node:path` de `platform` ; `null` s'il ne
 * se dérive pas. PURE.
 * @param {{ transcript_path?: unknown, session_id?: unknown }} entree @param {string} [tmp] @param {NodeJS.Platform} [platform]
 */
export function scratchpadDeSession(entree, tmp = tmpdir(), platform = process.platform) {
  const { transcript_path: transcript, session_id: session } = entree ?? {}
  if (typeof transcript !== 'string' || typeof session !== 'string' || !SEGMENT.test(session) || /^\.+$/.test(session)) return null
  const parties = transcript.split(/[\\/]+/)
  const k = parties.findIndex((p, i) => p === 'projects' && parties[i - 1] === '.claude')
  const slug = k < 0 ? undefined : parties[k + 1]
  if (!slug || !SEGMENT.test(slug) || /^\.+$/.test(slug)) return null
  return cheminsDe(platform).join(tmp, 'claude', slug, session, 'scratchpad')
}

/** `chemin` est-il `dossier` ou sous lui ? Chemins du `node:path` de `platform`, canonisés sur l'hôte de même
 *  plateforme, casse ignorée sous win32. */
function sous(chemin, dossier, platform) {
  const { isAbsolute, relative } = cheminsDe(platform)
  const canon = (p) => (platform === process.platform ? canoniser(p) : p)
  const pli = (p) => (platform === 'win32' ? canon(p).toLowerCase() : canon(p))
  const rel = relative(pli(dossier), pli(chemin))
  return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel))
}

/** Débit de l'analyse JS d'un corpus en une session (`ciblesDEcritureJS`), en octets par ms : la plus lente des mesures
 *  sur les suites de `src/`, arrondie sous (#2537, 2026-10-13 : 458 à 771 o/ms, de 50 à 1896 suites). */
export const DEBIT_ANALYSE_JS = 400
/** Coût fixe d'une session d'analyse, en ms (#2537, 2026-10-13 : médiane 92 ms sur 40 sessions d'un script). */
export const COUT_SESSION_MS = 100
/** Coût fixe d'un script mis au corpus, en ms : stat, lecture, `canoniser`, filtre de `vitest` et part d'analyse par
 *  fichier, hors octets (#2537, 2026-10-13 : 1,22 à 2,00 ms par suite, 3 001 et 6 001 suites d'une ligne). */
export const COUT_SCRIPT_MS = 2
/** Coût d'une entrée de dossier parcourue, en ms (#2537, 2026-10-13 : 24 µs, 21 519 entrées). */
export const COUT_ENTREE_MS = 0.025
/** Facteur de marge du budget : une machine deux fois plus lente, et les autres gardes du répartiteur en série. */
export const MARGE_BUDGET = 4
/** Le temps d'analyse qu'un appel s'accorde : le `timeout` du répartiteur (`.claude/settings.json:34`, 10 s),
 *  barrière (`ATTENTE_BARRIERE`) déduite, divisé par `MARGE_BUDGET`. Sessions, scripts, octets de JS et entrées parcourues
 *  s'y décomptent ; au-delà, un script, un tsconfig ou un dossier n'est pas jugé. */
export const BUDGET_ANALYSE_MS = 2125

/**
 * La suite `suite` est-elle choisie par les `filtres` positionnels de `vitest` balayant `dossier`, lancé depuis `depuis` ?
 * Prédicat de `filterFiles` (`node_modules/vitest/dist/chunks/index.DpLw24bj.js:12276-12286`) : sous-chaîne, casse
 * ignorée, du chemin relatif à `dossier`, ou préfixe absolu ; aucun filtre choisit tout, un filtre non constant (`null`)
 * ne choisit rien de PROUVÉ. PURE.
 * @param {string} suite @param {(string | null)[]} filtres @param {string} dossier @param {string} depuis @param {NodeJS.Platform} platform
 */
export function choisieParVitest(suite, filtres, dossier, depuis, platform) {
  if (filtres.length === 0) return true
  const P = cheminsDe(platform)
  const oblique = (chemin) => (platform === 'win32' ? chemin.split('\\').join('/') : chemin)
  const t = oblique(suite), relatif = oblique(P.relative(dossier, suite)).toLowerCase()
  return filtres.some((brut) => {
    if (brut === null) return false
    const f = oblique(brut)
    if (P.isAbsolute(brut) && t.startsWith(f)) return true
    const chemin = oblique(P.relative(dossier, P.resolve(depuis, brut))) + (f.endsWith('/') ? '/' : '')
    return relatif.includes(f.toLowerCase()) || relatif.includes(chemin.toLowerCase())
  })
}

/** La `root` littérale d'un `vitest.config` de texte `texte`, `undefined` sans elle. */
const racineDeConfig = (texte) => /\broot\s*:\s*(['"`])([^'"`$]*)\1/.exec(texte)?.[2]

/** Le texte du script `chemin`, ou la raison qui l'empêche de se lire : `trop` quand sa taille (`statSync`) dépasse
 *  `plafond` octets, sans le lire. */
function lireSurDisque(chemin, plafond = Infinity) {
  try {
    if (statSync(chemin).size > plafond) return { raison: 'au-delà du budget', trop: true }
    return { texte: readFileSync(chemin, 'utf8') }
  } catch (e) {
    return { raison: `illisible (${e?.code ?? e?.message ?? e})` }
  }
}

/** Les suites (`estSuiteVitest`) sous `dossier`, `node_modules` élagués à la descente, et le compte des entrées
 *  parcourues (`parcourues`) ; `null` au-delà de `plafond` entrées. Un dossier illisible n'a pas de suite. */
function testsSurDisque(dossier, plafond = Infinity) {
  const { join } = cheminsDe(process.platform)
  const suites = [], pile = [dossier]
  let parcourues = 0
  while (pile.length) {
    const courant = pile.pop()
    let entrees
    try {
      entrees = readdirSync(courant, { withFileTypes: true })
    } catch {
      continue
    }
    parcourues += entrees.length
    if (parcourues > plafond) return null
    for (const e of entrees) {
      if (e.isDirectory() && e.name !== 'node_modules') pile.push(join(courant, e.name))
      else if (e.isFile() && estSuiteVitest(e.name)) suites.push(join(courant, e.name))
    }
  }
  return { suites, parcourues }
}

/** Le CANAL d'un refus, par famille : ce que l'agent fait à la place. */
const CANAUX = {
  scratchpad: (sp) => `écris sous \`${sp}\``,
  temporaire: (sp) => `amorce le répertoire temporaire de la commande sous le scratchpad (\`TEMP="${sp}/tmp" node …\`, \`TMPDIR=… npx vitest run …\`)`,
  inconnue: (sp) => `une cible littérale sous \`${sp}\``,
  git: () => 'la sous-commande de lecture de git (`log`, `show`, `diff`, `status`, `reflog <ref>`…)',
  npm: () => '`npx tsc --noEmit`, `npx vitest run <fichiers>` ou `npm test -- <fichiers>`',
  npx: () => 'un outil de la table de lecture de `npx` (`vitest run`, `tsc --noEmit`, `eslint` sans `--fix`/`--cache`, `prettier --check`)',
  gh: () => 'la sous-commande de lecture de `gh` (`issue view`, `pr view`, `run view`, `api` en GET)',
  session: () => 'un appel porteur de `transcript_path` et `session_id`',
}

/**
 * Les défauts `{ texte, canal }` d'une commande d'un type en lecture seule, contre son `scratchpad` : une cible résolue
 * hors de lui, une cible inconnue d'un ÉCRIVAIN (`ecrivain`, canal de sa `famille`). Un script JS du scratchpad se
 * juge à ses écritures déclarées (`ciblesDEcritureJS`), au texte que la commande y écrit AVANT de le lancer
 * (`contenu`), sinon au disque (`lire`) ; un dossier du scratchpad que `vitest` balaie (`--dir`, cwd, `root` littérale
 * d'un `--config`) se juge à ses suites (`lister`) que choisissent ses filtres (`choisieParVitest`), analysées en un
 * corpus ; tout autre script n'est pas jugé. Tous les scripts que lance la commande s'analysent en UN corpus, dans le
 * budget `BUDGET_ANALYSE_MS` que décomptent sessions, octets et entrées parcourues ; au-delà, un script ou un dossier
 * n'est pas jugé : il est nommé dans `nonJuges`.
 * @param {string} commande
 * @param {{ base: string, scratchpad: string | null, platform?: NodeJS.Platform, env?: Record<string, string | null | undefined>, powershell?: boolean, lire?: typeof lireSurDisque, lister?: typeof testsSurDisque }} contexte
 * @returns {{ defauts: { texte: string, canal: keyof typeof CANAUX }[], nonJuges: string[] }}
 */
export function defautsDeCommande(commande, contexte) {
  const budget = { ms: BUDGET_ANALYSE_MS, nonJuges: [] }
  return { defauts: defautsSousBudget(commande, contexte, budget), nonJuges: budget.nonJuges }
}

/** Les défauts de `defautsDeCommande`, l'analyse décomptée de `budget` (`ms` restantes, `nonJuges`). */
function defautsSousBudget(commande, contexte, budget) {
  const { base, scratchpad, platform = process.platform, env = {}, powershell = false, lire = lireSurDisque, lister = testsSurDisque } = contexte
  const { dirname, extname, resolve } = cheminsDe(platform)
  const cle = (chemin) => (platform === 'win32' ? chemin.toLowerCase() : chemin)
  const dansLeScratchpad = (chemin) => scratchpad !== null && sous(chemin, scratchpad, platform)
  const ecrits = new Map()
  /** Le corpus de la commande : `{ chemin, texte, depuis, argv, env }` par script lancé. */
  const lances = []
  /** Décompte `ms` du budget s'il les a : vrai, sinon faux sans rien décompter. */
  const paye = (ms) => budget.ms >= ms && ((budget.ms -= ms), true)
  /** Le tsconfig `chemin` de `tsc`, lu comme un script : `COUT_SCRIPT_MS` décompté avant la lecture, plafonnée au budget, ses
   *  octets après ; `undefined` illisible, ou au-delà du budget, nommé. */
  const lireTsconfig = (chemin) => {
    const lu = paye(COUT_SCRIPT_MS) ? lire(chemin, budget.ms * DEBIT_ANALYSE_JS) : { trop: true }
    if (lu.trop) return void budget.nonJuges.push(chemin)
    if (lu.texte !== undefined) budget.ms -= Buffer.byteLength(lu.texte) / DEBIT_ANALYSE_JS
    return lu.texte
  }
  /** Met au corpus le script `chemin` que lance `cible` (ou son code en ligne `enLigne`), s'il est un JS lisible du scratchpad dans le budget : la marque
   *  `{ script }` de son rang, que ses défauts remplacent ; `[]` sinon. `COUT_SCRIPT_MS` se décompte AVANT tout accès au
   *  disque ; au-delà du budget, `horsBudget` nomme le script. */
  const lance = (chemin, cible, enLigne, horsBudget = () => budget.nonJuges.push(chemin)) => {
    if (!paye(COUT_SCRIPT_MS)) return horsBudget(), []
    if (enLigne === undefined && !dansLeScratchpad(chemin)) return []
    const ecrit = enLigne ?? ecrits.get(cle(chemin))
    if (ecrit === null) return []
    const session = lances.length ? 0 : COUT_SESSION_MS
    const lu = ecrit === undefined ? lire(chemin, Math.max(0, (budget.ms - session) * DEBIT_ANALYSE_JS)) : { texte: ecrit }
    if (lu.trop) return horsBudget(), []
    if (lu.texte === undefined) return []
    if (!paye(session + Buffer.byteLength(lu.texte) / DEBIT_ANALYSE_JS)) return horsBudget(), []
    lances.push({ chemin, texte: lu.texte, depuis: cible.base ?? base, argv: cible.argv, env: cible.env ?? env })
    return [{ script: lances.length - 1 }]
  }
  /** Les défauts du script `lance` du corpus, à ses cibles d'écriture `cibles`. */
  const defautsDuScript = ({ chemin, depuis, env: envDuScript }, cibles) => cibles.flatMap((cible) => {
    if (cible.commande !== undefined) {
      return defautsSousBudget(cible.commande, { ...contexte, base: depuis ?? base, env: envDuScript, powershell: false }, budget)
        .map((d) => ({ ...d, texte: `script ${chemin} : ${cible.operation} « ${cible.commande} » : ${d.texte}` }))
    }
    if (cible.inconnue || depuis === null) return []
    if (dansLeScratchpad(resolve(depuis, versCheminNatif(cible.chemin, platform)))) return []
    const temp = repertoireTemporaire(envDuScript, platform)
    const temporaire = cible.operation === 'mkdtempSync' && temp !== null && sous(resolve(depuis, versCheminNatif(cible.chemin, platform)), temp, platform)
    return [{ texte: `script ${chemin} : ${cible.operation} hors du scratchpad (${cible.chemin})`, canal: temporaire ? 'temporaire' : 'scratchpad' }]
  })
  /** Les suites du dossier `dossier` mises au corpus, quand il est du scratchpad, que choisissent les filtres de `cible` ;
   *  au-delà des entrées que le budget permet de parcourir, le dossier n'est pas jugé ; les suites au-delà du budget se
   *  nomment par leur compte. */
  const defautsDuDossier = (dossier, cible) => {
    if (!dansLeScratchpad(dossier)) return []
    const liste = lister(dossier, Math.floor(budget.ms / COUT_ENTREE_MS))
    if (liste === null) return !budget.nonJuges.push(`${dossier} (entrées)`) || []
    budget.ms -= liste.parcourues * COUT_ENTREE_MS
    const choisies = liste.suites.filter((suite) => choisieParVitest(suite, cible.filtres, dossier, cible.base ?? base, platform))
    let horsBudget = 0
    const marques = choisies.flatMap((suite) => lance(suite, cible, undefined, () => horsBudget++))
    if (horsBudget) budget.nonJuges.push(`${dossier} (${horsBudget}/${choisies.length} suites)`)
    return marques
  }
  /** Les défauts du `--config` `chemin` : le config lancé, puis les suites de sa `root` littérale (cwd sans elle). */
  const defautsDeLaConfig = (chemin, cible) => {
    const lancee = lance(chemin, cible)
    const racine = lancee.length ? racineDeConfig(lances[lancee[0].script].texte) : undefined
    return [...lancee, ...defautsDuDossier(racine === undefined ? cible.base ?? base : resolve(dirname(chemin), racine), cible)]
  }
  const morceaux = ciblesDEcritureDeCommande(commande, { base, platform, env, powershell, scripts: true, lireTexte: lireTsconfig }).flatMap((cible) => {
    if (cible.puits) return []
    if (cible.inconnue) {
      return cible.ecrivain ? [{ texte: `${cible.operation} : écrivain à cible non résolue (« ${cible.segment?.source ?? commande} »)`, canal: cible.famille ?? 'inconnue' }] : []
    }
    if (cible.operation === 'script') {
      if (cible.config) return defautsDeLaConfig(cible.chemin, cible)
      if (cible.dossier) return defautsDuDossier(cible.chemin, cible)
      if (cible.enLigne !== undefined) return lance(`${cible.segment?.source ?? commande} (code en ligne)`, cible, cible.enLigne)
      return lance(cible.chemin, cible)
    }
    ecrits.set(cle(cible.chemin), cible.contenu ?? null)
    if (scratchpad === null) return [{ texte: `écriture ${cible.operation} (${cible.chemin}) : scratchpad de session non dérivable (\`transcript_path\`, \`session_id\`)`, canal: 'session' }]
    return dansLeScratchpad(cible.chemin) ? [] : [{ texte: `${cible.operation} hors du scratchpad (${cible.chemin})`, canal: 'scratchpad' }]
  })
  if (lances.length === 0) return morceaux
  const rel = (chemin) => (scriptKindDe(chemin, { inconnu: 'refus' }) === null ? 'script.mjs' : `script${extname(chemin)}`)
  const cibles = ciblesDEcritureJS(lances.map(({ chemin, texte, argv, env: envDuScript }) => ({ texte, rel: rel(chemin), fichier: chemin, argv, env: envDuScript })), { platform })
  return morceaux.flatMap((m) => (m.script === undefined ? [m] : defautsDuScript(lances[m.script], cibles[m.script])))
}

/** `tmp`, `lire`, `lister` : le répertoire temporaire et le disque de l'hôte, que le banc forge pour la plateforme jouée.
 *  Les scripts non jugés au-delà de la borne se nomment en contexte. */
function evaluer(entree, { baseDeLAppel, platform = process.platform, env = {}, tmp = tmpdir(), lire, lister }) {
  if (typeof entree?.agent_type !== 'string') return null
  const fiche = fichesDAgent(RACINE).get(entree.agent_type)
  if (!fiche || !enLectureSeule(fiche)) return null
  const scratchpad = scratchpadDeSession(entree, tmp, platform)
  const { defauts, nonJuges } = defautsDeCommande(commandeDe(entree), { base: baseDeLAppel ?? process.cwd(), scratchpad, platform, env, powershell: entree.tool_name === 'PowerShell', lire, lister })
  const contexte = nonJuges.length ? { contexte: `Garde lecture-seule : NON JUGÉS, au-delà du budget d'analyse de ${BUDGET_ANALYSE_MS} ms par appel (#2537) : ${nonJuges.join(', ')}.` } : null
  if (defauts.length === 0) return contexte
  const canaux = [...new Set(defauts.map((d) => d.canal))].map((canal) => CANAUX[canal](scratchpad ?? 'non dérivable'))
  return {
    ...contexte,
    decision: 'deny',
    raison: `⛔ Type \`${fiche.name}\` en lecture seule (\`.claude/agents/${fiche.name}.md\`) : ${defauts.map((d) => d.texte).join(' ; ')} — canal : ${canaux.join(' ; ')}.`,
  }
}

export const garde = { nom: 'lecture-seule', outils: OUTILS_SHELL, evaluer }
