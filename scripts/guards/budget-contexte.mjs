// BUDGET DU CONTEXTE PERMANENT — ce que le harnais charge AVANT le premier mot d'une session, mesuré
// en OCTETS, et plafonné. Sans plafond, ce contexte grossit par accrétion : 52,7 Ko de `CLAUDE.md` et
// 17,3 Ko de `MEMORY.md` au 2026-09-13, pour un credo tronqué par le seuil de persistance du hook.
//
// PÉRIMÈTRE MESURÉ (un POSTE par fichier, nommé) :
//   1. `CLAUDE.md` à la racine ;
//   2. tout fichier que `CLAUDE.md` importe par une ligne `@<chemin>` — UNE passe, pas de récursion :
//      un import d'import n'est PAS suivi, et c'est dit ici plutôt que deviné ;
//   3. `.claude/memory/MEMORY.md` (l'INDEX de la mémoire) ;
//   4. la ligne `description:` du frontmatter de chaque `.claude/skills/*/SKILL.md` et de chaque
//      `.claude/agents/*.md` — c'est cette ligne que le harnais charge au démarrage, jamais le corps.
//
// ANGLES MORTS DÉCLARÉS, parce qu'ils sont hors dépôt ou chargés à la demande : le CLAUDE.md GLOBAL
// (`~/.claude/CLAUDE.md`), les plugins et skills globaux, les descriptions d'outils du harnais, les
// fiches `.claude/memory/*.md` hors index, et le CORPS des skills/agents. Aucun de ces postes n'entre
// dans le total ; un plafond tenu ici ne dit donc rien du contexte total d'une session.
//
// LECTURE EN TOKENS : le ratio mesuré le 2026-09-13 sur ce français balisé est ~2,2 caractères par
// token (76 Ko de contexte permanent rendaient 35,4k tokens). Diviser les octets par 2,2 pour lire un
// plafond en tokens.
//
// LE PLAFOND EST EN ÉGALITÉ avec la mesure (`verdictDuPlafond`, joué par `budget-contexte.test.mjs`) :
// un dépassement est rouge, et une BAISSE l'est aussi tant que le plafond n'est pas abaissé d'autant
// (« plafond mou » — un plafond qui traîne au-dessus de la mesure rend la prochaine accrétion
// gratuite). Sa MONTÉE se déclare au message de commit par le `CLIQUET:` du dépôt, lu par la même
// fonction que les stocks nominatifs (`scripts/guards/lib/stocksNominatifs.mjs`).
//
// La mesure est faite sur des octets NORMALISÉS en LF : un worktree ouvert en CRLF ne doit pas
// changer le total.
import { readFileSync, readdirSync } from 'node:fs'
import { Buffer } from 'node:buffer'
import { resolve } from 'node:path'
import { cliquetsDuMessage } from './lib/stocksNominatifs.mjs'

/**
 * Plafond du contexte permanent, en OCTETS : la MESURE de l'arbre. Il ne se relève qu'en le DISANT au
 * message de commit (`CLIQUET: scripts/guards/budget-contexte.mjs +N — <motif>`), et il s'abaisse à
 * chaque allègement.
 */
export const PLAFOND_OCTETS = 27213

/** Le fichier qui PORTE le plafond : c'est lui que le `CLIQUET:` d'un message de commit nomme. */
export const PORTEUR_DU_PLAFOND = 'scripts/guards/budget-contexte.mjs'

/** Caractères par token mesurés sur ce corpus (2026-09-13) — sert à LIRE un plafond, pas à le poser. */
export const CARACTERES_PAR_TOKEN = 2.2

const octetsDe = (texte) => Buffer.byteLength(String(texte ?? '').replace(/\r\n/g, '\n'), 'utf8')

const enTokens = (n) => Math.round(n / CARACTERES_PAR_TOKEN)

/** Les chemins importés par une ligne `@<chemin>` d'un fichier de contexte. PURE, UNE passe. */
export function importsDe(texte) {
  const out = []
  for (const ligne of String(texte ?? '').split(/\r?\n/)) {
    const m = /^@(\S+)$/.exec(ligne.trim())
    if (m) out.push(m[1].replace(/\\/g, '/'))
  }
  return out
}

/** La ligne `description:` du frontmatter YAML, sans son saut de ligne. `null` si absente. PURE. */
export function ligneDeDescription(texte) {
  const lignes = String(texte ?? '').split(/\r?\n/)
  if (lignes[0]?.trim() !== '---') return null
  for (let i = 1; i < lignes.length; i += 1) {
    if (lignes[i].trim() === '---') return null
    if (/^description:/.test(lignes[i])) return lignes[i]
  }
  return null
}

const lecteurDisque = (racine) => (chemin) => {
  try { return readFileSync(resolve(racine, chemin), 'utf8') } catch { return null }
}
const listeurDisque = (racine) => (dossier) => {
  try { return readdirSync(resolve(racine, dossier)).sort() } catch { return [] }
}

/**
 * Le budget du contexte permanent : un poste par fichier mesuré, et leur total en OCTETS. PURE hors
 * les deux lectures injectées — c'est par elles que la mesure se fait sur l'INDEX (`git show :<x>`)
 * plutôt que sur l'arbre.
 * @param {string} racine
 * @param {{lire?: (chemin: string) => string|null, lister?: (dossier: string) => string[]}} [io]
 * @returns {{postes: {nom: string, octets: number}[], total: number}}
 */
export function mesurerBudget(racine = process.cwd(), io = {}) {
  const lire = io.lire ?? lecteurDisque(racine)
  const lister = io.lister ?? listeurDisque(racine)
  const postes = []
  const poser = (nom, texte) => {
    if (typeof texte !== 'string') return
    postes.push({ nom, octets: octetsDe(texte) })
  }
  const claude = lire('CLAUDE.md')
  poser('CLAUDE.md', claude)
  for (const importe of importsDe(claude)) poser(importe, lire(importe))
  poser('.claude/memory/MEMORY.md', lire('.claude/memory/MEMORY.md'))
  for (const nom of lister('.claude/skills')) {
    const chemin = `.claude/skills/${nom}/SKILL.md`
    const desc = ligneDeDescription(lire(chemin))
    if (desc !== null) poser(`${chemin}#description`, desc)
  }
  for (const nom of lister('.claude/agents')) {
    if (!nom.endsWith('.md')) continue
    const chemin = `.claude/agents/${nom}`
    const desc = ligneDeDescription(lire(chemin))
    if (desc !== null) poser(`${chemin}#description`, desc)
  }
  return { postes, total: postes.reduce((n, p) => n + p.octets, 0) }
}

/**
 * Un chemin entre-t-il dans le budget ? Sert à BORNER la porte : hors de ces chemins, un commit ne
 * paie aucune mesure. Volontairement plus LARGE que `mesurerBudget` (tout `.claude/skills/**` et
 * `.claude/agents/*.md`, pas seulement leur `description:`) — une porte qui rate un chemin est pire
 * qu'une porte qui mesure une fois pour rien. PURE.
 *
 * Les fichiers IMPORTÉS ne sont pas figés ici : `mesurerBudget` suit les lignes `@<chemin>` de
 * `CLAUDE.md`, et la porte doit suivre LA MÊME liste — une seconde liste en dur (`.claude/credo.md`
 * écrit à la main) mentirait dès le prochain import. L'appelant passe donc `importsDe(<image de
 * CLAUDE.md>)`.
 * @param {string} chemin
 * @param {string[]} [imports] les chemins importés par `CLAUDE.md`, tels que `importsDe` les rend
 */
export function estCheminDuBudget(chemin, imports = []) {
  const normaliser = (p) => String(p ?? '').replace(/\\/g, '/')
  const rel = normaliser(chemin)
  return rel === 'CLAUDE.md'
    || imports.some((i) => normaliser(i) === rel)
    || rel === '.claude/memory/MEMORY.md'
    || /^\.claude\/skills\/[^/]+\/SKILL\.md$/.test(rel)
    || /^\.claude\/agents\/[^/]+\.md$/.test(rel)
}

/** Le `PLAFOND_OCTETS` déclaré par une IMAGE de ce fichier (pré-image d'un commit). `null` si
 *  illisible — l'appelant ne juge alors RIEN plutôt que de juger sur un plafond deviné. PURE. */
export function plafondDeLaSource(texte) {
  const m = /export const PLAFOND_OCTETS = (\d+)/.exec(String(texte ?? ''))
  return m ? Number(m[1]) : null
}

/**
 * Ce qu'un plafond dit d'une mesure : `null` si l'égalité tient, sinon la raison NOMMÉE. PURE.
 * @param {{postes: {nom: string, octets: number}[], total: number}} mesure
 * @param {number} [plafond]
 * @returns {string|null}
 */
export function verdictDuPlafond(mesure, plafond = PLAFOND_OCTETS) {
  if (mesure.total === plafond) return null
  if (mesure.total > plafond) {
    const gros = [...mesure.postes].sort((a, b) => b.octets - a.octets).slice(0, 5)
    return (
      `⛔ BUDGET DU CONTEXTE DÉPASSÉ : ${mesure.total} octets (~${enTokens(mesure.total)} tokens) pour un `
      + `plafond de ${plafond} (~${enTokens(plafond)} tokens), soit +${mesure.total - plafond}. Les plus gros `
      + `postes : ${gros.map((p) => `${p.nom} ${p.octets}`).join(' · ')}. Alléger — ce qui sert AU MOMENT d'un `
      + `geste vit derrière son déclencheur, pas dans le contexte permanent — ou relever `
      + `${PORTEUR_DU_PLAFOND} en le DISANT au message de commit `
      + `(\`CLIQUET: ${PORTEUR_DU_PLAFOND} +${mesure.total - plafond} — <motif>\`).`
    )
  }
  return (
    `⛔ plafond mou : abaisser à ${mesure.total} — le contexte permanent mesure ${mesure.total} octets `
    + `(~${enTokens(mesure.total)} tokens) et ${PORTEUR_DU_PLAFOND} en déclare ${plafond}. Un plafond qui `
    + `traîne au-dessus de la mesure rend la prochaine accrétion gratuite : le reporter dans CE commit `
    + `(PLAFOND_OCTETS = ${mesure.total}).`
  )
}

/**
 * Les postes qui ont GROSSI entre deux mesures, du plus gros écart au plus petit. PURE.
 * @returns {{nom: string, avant: number, apres: number, delta: number}[]}
 */
export function postesQuiGrossissent(reference, mesure) {
  const avant = new Map((reference?.postes ?? []).map((p) => [p.nom, p.octets]))
  return mesure.postes
    .map((p) => ({ nom: p.nom, avant: avant.get(p.nom) ?? 0, apres: p.octets }))
    .map((p) => ({ ...p, delta: p.apres - p.avant }))
    .filter((p) => p.delta > 0)
    .sort((a, b) => b.delta - a.delta)
}

/**
 * Le refus d'un commit qui pousse le contexte permanent AU-DESSUS du plafond de sa PRÉ-IMAGE, sauf
 * `CLIQUET:` qui le DIT. PURE : `mesure` est prise sur ce que le commit emporte, `reference` sur sa
 * pré-image, `plafond` est celui de la pré-image — sans quoi relever la ligne dans le même commit
 * suffirait à tout faire passer. `null` = rien à refuser.
 * @param {{mesure: object, reference?: object, plafond: number|null, message: string}} entree
 * @returns {{decision: 'deny', reason: string}|null}
 */
export function refusDeBudget({ mesure, reference, plafond, message }) {
  if (typeof plafond !== 'number' || !mesure) return null
  if (mesure.total <= plafond) return null
  // Un cliquet ne couvre QUE s'il annonce le bon compte (`+N` = la montée réelle au-dessus du
  // plafond) — même exigence que les stocks nominatifs (`croissancesNonCouvertes`, stocksNominatifs.mjs).
  // Sans elle, un `+1` de tampon survivrait à toutes les accrétions suivantes.
  const montee = mesure.total - plafond
  const pourLePorteur = cliquetsDuMessage(message).filter((k) => k.fichier === PORTEUR_DU_PLAFOND)
  if (pourLePorteur.some((k) => k.n === montee)) return null
  const declare = pourLePorteur.length
    ? ` Le message annonce \`+${pourLePorteur[0].n}\`, pas +${montee}.`
    : ''
  const grossis = postesQuiGrossissent(reference, mesure)
  const dits = grossis.length
    ? grossis.slice(0, 5).map((p) => `${p.nom} +${p.delta} octets (${p.avant} → ${p.apres})`).join(' · ')
    : 'aucun poste ne grossit par rapport à la pré-image — le plafond a été ABAISSÉ sans alléger'
  return {
    decision: 'deny',
    reason:
      `⛔ CONTEXTE PERMANENT qui GRANDIT : ${mesure.total} octets (~${enTokens(mesure.total)} tokens) pour un `
      + `plafond de ${plafond}, soit +${montee}.${declare} ${dits}. Ce contexte est chargé AVANT le premier `
      + `mot de chaque session : ce qui sert AU MOMENT d'un geste vit derrière son déclencheur, pas ici. Si la `
      + `montée est délibérée, le message de commit la DIT : `
      + `\`CLIQUET: ${PORTEUR_DU_PLAFOND} +${montee} — <motif>\` (motif d'au moins 20 caractères).`,
  }
}

// ── Driver (n'exécute QUE lancé en direct, jamais à l'import d'un test) ────────────────────────
if (import.meta.main) {
  const mesure = mesurerBudget(process.cwd())
  for (const p of mesure.postes) process.stdout.write(`${String(p.octets).padStart(6)}  ${p.nom}\n`)
  process.stdout.write(
    `${String(mesure.total).padStart(6)}  TOTAL (~${enTokens(mesure.total)} tokens à `
    + `${CARACTERES_PAR_TOKEN} caractères/token) — plafond ${PLAFOND_OCTETS}\n`,
  )
  if (!process.argv.includes('--mesure')) {
    const verdict = verdictDuPlafond(mesure)
    if (verdict) { process.stderr.write(`${verdict}\n`); process.exit(1) }
  }
}
