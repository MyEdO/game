// #2537 — garde des types en LECTURE SEULE (`enLectureSeule`, scripts/guards/lib/typesDAgent.mjs) : leurs
// écritures shell DÉCLARÉES (`ciblesDEcritureDeCommande`) ne visent que le scratchpad de leur session.
// Trous (#2537) : `awk system()`, `sed e`, `rg --pre`, `git -c core.pager=`, `gh pr checkout`, script SUIVI qui
// écrit, module importé par un script du scratchpad, `wget`, écritures `.git/` de `git status`.
import { readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { extname, isAbsolute, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { OUTILS_SHELL, commandeDe } from '../guards/lib/contratGarde.mjs'
import { analyserTexte, scriptKindDe } from '../guards/lib/dialecte.mjs'
import { versCheminNatif } from '../guards/lib/commandeShell.mjs'
import { ciblesDEcritureDeCommande } from '../guards/lib/ecrituresShell.mjs'
import { ciblesDEcritureJS } from '../guards/lib/ecrituresFichiers.mjs'
import { SUIVI, depotAuxPannes, listerImage, racineSurDisque } from '../guards/lib/gitPorte.mjs'
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

/** Le fichier `chemin` est-il SUIVI par l'arbre git qui le contient ? Une panne de git répond non. */
function suiviParGit(chemin) {
  const racine = racineSurDisque(join(chemin, '..'))
  if (racine === null) return false
  const rel = relative(racine, chemin).split(sep).join('/')
  if (rel.startsWith('..')) return false
  const vu = listerImage(depotAuxPannes(racine, []), SUIVI, rel)
  return Array.isArray(vu) && vu.includes(rel)
}

/** Le texte du script `chemin`, ou la raison qui l'empêche de se lire. */
function lireSurDisque(chemin) {
  try {
    return { texte: readFileSync(chemin, 'utf8') }
  } catch (e) {
    return { raison: `illisible (${e?.code ?? e?.message ?? e})` }
  }
}

/**
 * Les défauts d'une commande d'un type en lecture seule, contre son `scratchpad`. Un script lancé passe s'il
 * est suivi (`suivi`) ; dans le scratchpad, un script JS se juge à ses écritures déclarées
 * (`ciblesDEcritureJS`), au texte que la commande y écrit AVANT de le lancer (`contenu`), sinon au disque
 * (`lire`) ; tout autre script, et tout langage non lu, se refuse.
 * @param {string} commande
 * @param {{ base: string, scratchpad: string | null, platform?: NodeJS.Platform, env?: Record<string, string | undefined>, lire?: typeof lireSurDisque, suivi?: (chemin: string) => boolean }} contexte
 */
export function defautsDeCommande(commande, contexte) {
  const { base, scratchpad, platform = process.platform, env = {}, lire = lireSurDisque, suivi = suiviParGit } = contexte
  const cle = (chemin) => (platform === 'win32' ? chemin.toLowerCase() : chemin)
  const ecrits = new Map()
  /** Les défauts du script JS `chemin` du scratchpad, de texte `texte`, lancé depuis `depuis` avec `argv`. */
  const defautsDuScript = (chemin, texte, depuis, argv) => {
    const rel = scriptKindDe(chemin, { inconnu: 'refus' }) === null ? 'script.mjs' : `script${extname(chemin)}`
    if (analyserTexte({ rel, text: texte }).diagnostics.length) return [`script ${chemin} non jugeable : il ne se parse pas (${rel})`]
    return ciblesDEcritureJS(texte, { rel, fichier: chemin, argv, env, platform }).flatMap((cible) => {
      if (cible.commande !== undefined) return defautsDeCommande(cible.commande, { ...contexte, base: depuis ?? base }).map((d) => `script ${chemin} : ${cible.operation} « ${cible.commande} » : ${d}`)
      if (cible.inconnue || depuis === null) return [`script ${chemin} : écriture ${cible.operation} à chemin non littéral`]
      return sous(resolve(depuis, versCheminNatif(cible.chemin, platform)), scratchpad, platform) ? [] : [`script ${chemin} : ${cible.operation} hors du scratchpad (${cible.chemin})`]
    })
  }
  return ciblesDEcritureDeCommande(commande, { base, platform, env, scripts: true }).flatMap((cible) => {
    if (cible.puits) return []
    if (cible.inconnue) return [`cible d'écriture non résolue (${cible.operation} dans « ${cible.segment?.source ?? commande} »)`]
    if (cible.operation === 'script') {
      const dansLeScratchpad = scratchpad !== null && sous(cible.chemin, scratchpad, platform)
      if (!dansLeScratchpad) return suivi(cible.chemin) ? [] : [`script ${cible.chemin} ni dans le scratchpad, ni suivi par le dépôt`]
      if (cible.langage !== 'js') return suivi(cible.chemin) ? [] : [`script ${cible.chemin} : langage ${cible.langage} non lu`]
      const ecrit = ecrits.get(cle(cible.chemin))
      const lu = ecrit === undefined ? lire(cible.chemin) : ecrit === null ? { raison: "modifié par la commande qui le lance : son texte ne se lit qu’après exécution — l’écrire par `cat > <script> <<'MOT'` dans cette commande, ou le modifier dans un appel séparé" } : { texte: ecrit }
      return lu.raison ? [`script ${cible.chemin} ${lu.raison}`] : defautsDuScript(cible.chemin, lu.texte, cible.base ?? base, cible.argv)
    }
    ecrits.set(cle(cible.chemin), cible.contenu ?? null)
    if (scratchpad === null) return [`écriture ${cible.operation} (${cible.chemin}) : scratchpad de session non dérivable (\`transcript_path\`, \`session_id\`)`]
    return sous(cible.chemin, scratchpad, platform) ? [] : [`${cible.operation} hors du scratchpad (${cible.chemin})`]
  })
}

function evaluer(entree, { baseDeLAppel, platform = process.platform, env = {} }) {
  if (typeof entree?.agent_type !== 'string') return null
  const fiche = fichesDAgent(RACINE).get(entree.agent_type)
  if (!fiche || !enLectureSeule(fiche)) return null
  const scratchpad = scratchpadDeSession(entree)
  const defauts = defautsDeCommande(commandeDe(entree), { base: baseDeLAppel ?? process.cwd(), scratchpad, platform, env })
  if (defauts.length === 0) return null
  return {
    decision: 'deny',
    raison: `⛔ Type \`${fiche.name}\` en lecture seule (\`.claude/agents/${fiche.name}.md\`) : ${defauts.join(' ; ')} — `
      + `canal : écrire sous le scratchpad de la session (${scratchpad ?? 'non dérivable'}), par la commande ou par un script JS, que la garde lit.`,
  }
}

export const garde = { nom: 'lecture-seule', outils: OUTILS_SHELL, evaluer }
