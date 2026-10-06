import { readFileSync, readdirSync } from 'node:fs'
import { Buffer } from 'node:buffer'
import { resolve } from 'node:path'
import { cliquetsDuMessage } from './lib/stocksNominatifs.mjs'
import { depotDe, grapheDe, journalDe, ceQueFaitLeCommit, lireEnLot, listerImage, enfantsDirects, GitIndisponible } from './lib/gitPorte.mjs'
import { baseDuDiff } from '../gates/classerPush.mjs'

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
  const lus = lireTout([...imports, '.claude/memory/MEMORY.md', ...descriptions])
  const lu = (chemin) => lus.get(chemin) ?? null
  poser('CLAUDE.md', claude)
  for (const importe of imports) poser(importe, lu(importe))
  poser('.claude/memory/MEMORY.md', lu('.claude/memory/MEMORY.md'))
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
  const plafond = reference.total
  if (mesure.total <= plafond) return null
  const montee = mesure.total - plafond
  const pourLePorteur = cliquetsDuMessage(message).filter((k) => k.fichier === PORTEUR_DU_PLAFOND)
  if (pourLePorteur.some((k) => k.n === montee)) return null
  const declare = pourLePorteur.length
    ? ` Le message annonce \`+${pourLePorteur[0].n}\`, pas +${montee}.`
    : ''
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

export function controlerBudgetDeLaPlage({ cwd = process.cwd(), debut, fin = 'HEAD' } = {}) {
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
  const mesurerImage = (arbre) => {
    const chemins = listerImage(depot, arbre, '.claude/skills', '.claude/agents')
    const mesure = mesurerBudget(cwd, {
      lireTout: (rels) => lireEnLot(depot, arbre, rels),
      lister: (dossier) => enfantsDirects(chemins, dossier),
    })
    exigerLectures()
    return mesure
  }
  const resultat = { commitsControles: 0, refus: [] }
  for (const commit of commits) {
    const apport = ceQueFaitLeCommit(depot, commit)
    const chemins = apport.chemins()
    exigerLectures()
    if (!chemins.length) continue
    const imports = [
      ...importsDe(lireEnLot(depot, apport.base, ['CLAUDE.md']).get('CLAUDE.md')),
      ...importsDe(lireEnLot(depot, commit.sha, ['CLAUDE.md']).get('CLAUDE.md')),
    ]
    exigerLectures()
    if (!chemins.some((chemin) => estCheminDuBudget(chemin, imports))) continue
    const reference = mesurerImage(apport.base)
    const mesure = mesurerImage(commit.sha)
    const message = messages.get(commit.sha)
    if (message === undefined) throw new Error(`budget : message absent — ${commit.sha}`)
    const refus = refusDeBudget({ reference, mesure, message })
    resultat.commitsControles += 1
    if (refus) resultat.refus.push({ sha: commit.sha, ...refus })
  }
  exigerLectures()
  return resultat
}

if (import.meta.main) {
  try {
    const mesure = mesurerBudget(process.cwd())
    for (const p of mesure.postes) process.stdout.write(`${String(p.octets).padStart(6)}  ${p.nom}\n`)
    process.stdout.write(`${String(mesure.total).padStart(6)}  TOTAL (~${enTokens(mesure.total)} tokens)\n`)
    if (!process.argv.includes('--mesure')) {
      const argument = (nom) => {
        const i = process.argv.indexOf(nom)
        if (i < 0) return undefined
        const valeur = process.argv[i + 1]
        if (!valeur || valeur.startsWith('--')) throw new Error(`budget : valeur absente pour ${nom}`)
        return valeur
      }
      const resultat = controlerBudgetDeLaPlage({ debut: argument('--base'), fin: argument('--tete') ?? 'HEAD' })
      process.stdout.write(`${resultat.commitsControles} commit contrôlé(s)\n`)
      for (const refus of resultat.refus) process.stderr.write(`${refus.sha}: ${refus.reason}\n`)
      if (resultat.refus.length) process.exitCode = 1
    }
  } catch (erreur) {
    process.stderr.write(`budget : ${erreur.message}\n`)
    process.exitCode = 1
  }
}
