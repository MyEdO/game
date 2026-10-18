// LE BUDGET DU CONTEXTE PERMANENT : ce que chaque session charge avant son premier mot (`mesurerBudget`), et la
// porte qui refuse sa croissance sans la ligne `CLIQUET:` du porteur du plafond, au commit (`refusDeBudget`,
// scripts/git-hooks/porte-du-commit.mjs) et sur une plage (`controlerBudgetDeLaPlage`).
//
// L'ÈRE (#2503) : sur une plage, chaque commit se juge par la porte de son ère (`groupesParEre`,
// `porteDEre.mjs`), `merge-base` de ce commit avec le tronc que la plage exclut (`debut`). Le JUGEMENT vient
// de l'arbre de l'ère : `importsDe` et `estCheminDuBudget` (quels commits touchent le budget),
// `mesurerBudget` (ce qui se compte), `refusDeBudget` (ce qui se refuse). La LECTURE reste celle de l'arbre
// qui juge : graphe, `ceQueFaitLeCommit`, messages, et les lecteurs `lireTout`/`lister` sur les objets git.
// Le contrat d'entrée de `importsDe(texte)`, `estCheminDuBudget(chemin, imports)`,
// `mesurerBudget(cwd, { lireTout, lister })` et `refusDeBudget({ reference, mesure, message })` est donc
// APPEND-ONLY : une ère ancienne le reçoit tel que l'arbre qui juge le lit.
import { readFileSync, readdirSync } from 'node:fs'
import { Buffer } from 'node:buffer'
import { resolve } from 'node:path'
import { cliquetsDuMessage, declarationLue, mesuresNonCouvertes } from './lib/stocksNominatifs.mjs'
import { cheminDuModule, groupesParEre } from './lib/porteDEre.mjs'
import { depotDe, grapheDe, journalDe, ceQueFaitLeCommit, lireEnLot, listerImage, enfantsDirects, GitIndisponible } from './lib/gitPorte.mjs'
import { baseDuDiff } from '../gates/classerPush.mjs'
import { lireRegle } from '../hooks/regles-projection-guard.mjs'

export const PORTEUR_DU_PLAFOND = 'scripts/guards/budget-contexte.mjs'

export const CARACTERES_PAR_TOKEN = 2.2

const octetsDe = (texte) => Buffer.byteLength(String(texte ?? '').replace(/\r\n/g, '\n'), 'utf8')

const enTokens = (n) => Math.round(n / CARACTERES_PAR_TOKEN)

export function importsDe(texte) {
  const out = []
  for (const ligne of String(texte ?? '').split(/\r?\n/)) {
    const m = /^@(\S+)$/.exec(ligne.trim())
    if (m) out.push(m[1].replace(/\\/g, '/'))
  }
  return out
}

export function ligneDeDescription(texte) {
  const lignes = String(texte ?? '').split(/\r?\n/)
  if (lignes[0]?.trim() !== '---') return null
  for (let i = 1; i < lignes.length; i += 1) {
    if (lignes[i].trim() === '---') return null
    if (/^description:/.test(lignes[i])) return lignes[i]
  }
  return null
}

// Un glob dont chaque segment n'est fait que d'étoiles (`*`, `**`, `**/*`) : il couvre tout l'arbre. PURE.
const couvreTout = (glob) => glob.replace(/^\.?\//, '').split('/').every((segment) => /^\*+$/.test(segment))

/** Une règle `.md` de `.claude/rules/`, sous-dossiers compris, se charge au démarrage, sous-agents compris, sauf si
 *  son frontmatter FERMÉ porte un `paths:` (`lireRegle`, scripts/hooks/regles-projection-guard.mjs) à au moins un
 *  glob non vide, dont aucun ne couvre tout l'arbre (`.claude/rules/contexte-agents.md`) : elle compte alors en
 *  ENTIER au contexte permanent. PURE. */
export function estRegleSansPaths(texte) {
  const globs = (lireRegle(String(texte ?? '')).paths ?? []).map((glob) => glob.trim()).filter(Boolean)
  return !globs.length || globs.some(couvreTout)
}

/** La SEULE règle admise sans `paths:` : des consignes de machine valables pour tout appel d'outil, qu'aucun
 *  `paths:` ne cible (#2683). Sa taille est bornée en dur : ni une ligne `CLIQUET:` ni le plafond du budget ne la
 *  relèvent. */
export const REGLE_PERMANENTE = Object.freeze({ chemin: '.claude/rules/outils.md', octetsMax: 3072 })

/** Les postes de règle sans `paths:` qui sortent du contrat : toute autre règle que `REGLE_PERMANENTE`, et celle-ci
 *  au-delà de sa borne. `[]` si rien. PURE. */
export function reglesPermanentesHorsContrat(mesure) {
  return (mesure?.postes ?? [])
    .filter((p) => /^\.claude\/rules\/.+\.md$/.test(p.nom))
    .flatMap((p) => {
      if (p.nom !== REGLE_PERMANENTE.chemin) {
        return [`${p.nom} (${p.octets} octets) n'a pas d'en-tête \`paths:\` qui la cible : seule ${REGLE_PERMANENTE.chemin} `
          + 'se charge au démarrage ; ciblez-la par `paths:` ou versez sa consigne à son porteur.']
      }
      if (p.octets > REGLE_PERMANENTE.octetsMax) {
        return [`${p.nom} pèse ${p.octets} octets pour une borne de ${REGLE_PERMANENTE.octetsMax} `
          + `(REGLE_PERMANENTE, ${PORTEUR_DU_PLAFOND}) : renvoyez le détail derrière son déclencheur.`]
      }
      return []
    })
}

const lecteurDisque = (racine) => (chemins) => new Map(chemins.map((chemin) => {
  try { return [chemin, readFileSync(resolve(racine, chemin), 'utf8')] } catch { return [chemin, null] }
}))
const listeurDisque = (racine) => (dossier) => {
  try { return readdirSync(resolve(racine, dossier)).sort() } catch { return [] }
}

export function mesurerBudget(racine = process.cwd(), io = {}) {
  const lireTout = io.lireTout ?? lecteurDisque(racine)
  const lister = io.lister ?? listeurDisque(racine)
  const postes = []
  const poser = (nom, texte) => {
    if (typeof texte !== 'string') return
    postes.push({ nom, octets: octetsDe(texte) })
  }
  const claude = lireTout(['CLAUDE.md']).get('CLAUDE.md') ?? null
  const imports = importsDe(claude)
  const descriptions = [
    ...lister('.claude/skills').map((nom) => `.claude/skills/${nom}/SKILL.md`),
    ...lister('.claude/agents').filter((nom) => nom.endsWith('.md')).map((nom) => `.claude/agents/${nom}`),
  ]
  const reglesSous = (dossier) => lister(dossier)
    .flatMap((nom) => (nom.endsWith('.md') ? [`${dossier}/${nom}`] : reglesSous(`${dossier}/${nom}`)))
  const regles = reglesSous('.claude/rules')
  const lus = lireTout([...imports, '.claude/memory/MEMORY.md', ...regles, ...descriptions])
  const lu = (chemin) => lus.get(chemin) ?? null
  poser('CLAUDE.md', claude)
  for (const importe of imports) poser(importe, lu(importe))
  poser('.claude/memory/MEMORY.md', lu('.claude/memory/MEMORY.md'))
  for (const regle of regles) if (estRegleSansPaths(lu(regle))) poser(regle, lu(regle))
  for (const chemin of descriptions) {
    const desc = ligneDeDescription(lu(chemin))
    if (desc !== null) poser(`${chemin}#description`, desc)
  }
  return { postes, total: postes.reduce((n, p) => n + p.octets, 0) }
}

export function estCheminDuBudget(chemin, imports = []) {
  const normaliser = (p) => String(p ?? '').replace(/\\/g, '/')
  const rel = normaliser(chemin)
  return rel === 'CLAUDE.md'
    || imports.some((i) => normaliser(i) === rel)
    || rel === '.claude/memory/MEMORY.md'
    || /^\.claude\/rules\/.+\.md$/.test(rel)
    || /^\.claude\/skills\/[^/]+\/SKILL\.md$/.test(rel)
    || /^\.claude\/agents\/[^/]+\.md$/.test(rel)
}

export function postesQuiGrossissent(reference, mesure) {
  const avant = new Map((reference?.postes ?? []).map((p) => [p.nom, p.octets]))
  return mesure.postes
    .map((p) => ({ nom: p.nom, avant: avant.get(p.nom) ?? 0, apres: p.octets }))
    .map((p) => ({ ...p, delta: p.apres - p.avant }))
    .filter((p) => p.delta > 0)
    .sort((a, b) => b.delta - a.delta)
}

export function refusDeBudget({ mesure, reference, message }) {
  if (!reference || typeof reference.total !== 'number') throw new Error('budget : référence de mesure absente')
  if (!mesure || typeof mesure.total !== 'number') throw new Error('budget : mesure absente')
  const horsContrat = reglesPermanentesHorsContrat(mesure)
  if (horsContrat.length) {
    return {
      decision: 'deny',
      reason: `⛔ RÈGLE CHARGÉE AU DÉMARRAGE hors contrat, qu'aucun CLIQUET ne couvre : ${horsContrat.join(' · ')}`,
    }
  }
  const plafond = reference.total
  if (mesure.total <= plafond) return null
  const montee = mesure.total - plafond
  const [nonCouverte] = mesuresNonCouvertes([{ fichier: PORTEUR_DU_PLAFOND, n: montee }], cliquetsDuMessage(message))
  if (!nonCouverte) return null
  const declare = ` Déclaration : ${declarationLue(nonCouverte)}.`
  const grossis = postesQuiGrossissent(reference, mesure)
  const dits = grossis.length
    ? grossis.slice(0, 5).map((p) => `${p.nom} +${p.delta} octets (${p.avant} → ${p.apres})`).join(' · ')
    : 'aucun poste ne grossit par rapport à la pré-image'
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

/** La porte de budget telle qu'une ère la charge (`jugeDeLEre`) : son module, ses juges, et sa VIE. */
export const PORTE_DE_BUDGET = Object.freeze({
  module: cheminDuModule(import.meta.url),
  exports: ['importsDe', 'estCheminDuBudget', 'mesurerBudget', 'refusDeBudget'],
  vie: vieDuBudget,
})

/** La VIE d'une porte de budget chargée : son `mesurerBudget` rend un `total` numérique sur une image connue, et
 *  son `refusDeBudget` refuse une montée que le message ne déclare pas. */
function vieDuBudget({ module }) {
  const mesure = module.mesurerBudget('.', { lireTout: (rels) => new Map(rels.map((rel) => [rel, 'vie\n'])), lister: () => [] })
  if (typeof mesure?.total !== 'number' || mesure.total <= 0) return false
  return Boolean(module.refusDeBudget({ reference: { postes: [], total: 0 }, mesure, message: '' }))
}

/**
 * Les commits de `debut..fin` qui font grossir le budget sans leur ligne `CLIQUET:`, chacun jugé par la porte
 * de son ère : `{ commitsControles, refus: [{ sha, ere, decision, reason }], notes }`.
 */
export async function controlerBudgetDeLaPlage({ cwd = process.cwd(), debut, fin = 'HEAD' } = {}) {
  if (debut === undefined) {
    const evenement = process.env.GITHUB_EVENT_PATH
      ? JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8'))
      : null
    const socle = baseDuDiff({ cwd, sha: fin, base: evenement?.merge_group?.base_sha })
    if (socle.base === null) throw new Error(`budget : base absente — ${socle.motif}`)
    debut = socle.base
  }
  if (!debut || !fin) throw new Error('budget : base ou tête absente')
  const pannes = []
  const depot = depotDe(cwd, { enPanne: (raison) => pannes.push(raison) })
  const exigerLectures = () => {
    if (pannes.length) throw new GitIndisponible(pannes.join(' ; '))
  }
  const revisions = [`${debut}..${fin}`]
  const commits = grapheDe(depot, revisions)
  exigerLectures()
  if (commits === null) throw new Error(`budget : plage illisible — ${revisions[0]}`)
  const journal = journalDe(depot, revisions)
  exigerLectures()
  if (journal === null) throw new Error(`budget : messages illisibles — ${revisions[0]}`)
  const messages = new Map(journal.map((c) => [c.sha, c.message]))
  const mesurerImage = (juge, arbre) => {
    const chemins = listerImage(depot, arbre, '.claude/rules', '.claude/skills', '.claude/agents')
    const mesure = juge.mesurerBudget(cwd, {
      lireTout: (rels) => lireEnLot(depot, arbre, rels),
      lister: (dossier) => enfantsDirects(chemins, dossier),
    })
    exigerLectures()
    return mesure
  }
  const resultat = { commitsControles: 0, refus: [], notes: [] }
  const actuelle = { importsDe, estCheminDuBudget, mesurerBudget, refusDeBudget }
  const groupes = await groupesParEre(depot, commits, debut, PORTE_DE_BUDGET)
  exigerLectures()
  for (const { ere, commits: groupe, juge: deLEre, note } of groupes) {
    if (note) resultat.notes.push(note)
    const juge = deLEre ?? actuelle
    for (const commit of groupe) {
      const apport = ceQueFaitLeCommit(depot, commit)
      const chemins = apport.chemins()
      exigerLectures()
      if (!chemins.length) continue
      const imports = [
        ...juge.importsDe(lireEnLot(depot, apport.base, ['CLAUDE.md']).get('CLAUDE.md')),
        ...juge.importsDe(lireEnLot(depot, commit.sha, ['CLAUDE.md']).get('CLAUDE.md')),
      ]
      exigerLectures()
      if (!chemins.some((chemin) => juge.estCheminDuBudget(chemin, imports))) continue
      const reference = mesurerImage(juge, apport.base)
      const mesure = mesurerImage(juge, commit.sha)
      const message = messages.get(commit.sha)
      if (message === undefined) throw new Error(`budget : message absent — ${commit.sha}`)
      const refus = juge.refusDeBudget({ reference, mesure, message })
      resultat.commitsControles += 1
      if (refus) resultat.refus.push({ sha: commit.sha, ere, ...refus })
    }
  }
  const rang = new Map(commits.map((c, i) => [c.sha, i]))
  resultat.refus.sort((a, b) => rang.get(a.sha) - rang.get(b.sha))
  exigerLectures()
  return resultat
}

/** Le CLI : la mesure, puis le contrôle de la plage. Hors évaluation du module (aucun `await` de premier
 *  niveau) : la porte de son ère peut être ce module même, que `jugeDeLEre` importe. */
async function principal() {
  try {
    const mesure = mesurerBudget(process.cwd())
    for (const p of mesure.postes) process.stdout.write(`${String(p.octets).padStart(6)}  ${p.nom}\n`)
    process.stdout.write(`${String(mesure.total).padStart(6)}  TOTAL (~${enTokens(mesure.total)} tokens)\n`)
    const horsContrat = reglesPermanentesHorsContrat(mesure)
    for (const ligne of horsContrat) process.stderr.write(`budget : ${ligne}\n`)
    if (horsContrat.length) process.exitCode = 1
    if (!process.argv.includes('--mesure')) {
      const argument = (nom) => {
        const i = process.argv.indexOf(nom)
        if (i < 0) return undefined
        const valeur = process.argv[i + 1]
        if (!valeur || valeur.startsWith('--')) throw new Error(`budget : valeur absente pour ${nom}`)
        return valeur
      }
      const resultat = await controlerBudgetDeLaPlage({ debut: argument('--base'), fin: argument('--tete') ?? 'HEAD' })
      for (const note of resultat.notes) process.stdout.write(`note : ${note}\n`)
      process.stdout.write(`${resultat.commitsControles} commit contrôlé(s)\n`)
      for (const refus of resultat.refus) process.stderr.write(`${refus.sha}: ${refus.reason}\n`)
      if (resultat.refus.length) process.exitCode = 1
    }
  } catch (erreur) {
    process.stderr.write(`budget : ${erreur.message}\n`)
    process.exitCode = 1
  }
}

if (import.meta.main) principal()
