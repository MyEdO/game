import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)

export const BORNE_JOURNAL = 256 * 1024 * 1024
export const ETAPE_INCONNUE = 'UNKNOWN STEP'

const FICHIER_JOB = /^-?\d+_([^/]+)\.txt$/
const FICHIER_ETAPE = /^([^/]+)\/(\d+)_[^/]+\.txt$/

function nomsDesJobs(jobs) {
  const noms = new Map()
  for (const job of jobs) {
    if (typeof job?.name !== 'string' || !job.name.trim() || /[\t\r\n]/.test(job.name) || !Array.isArray(job.steps))
      throw new Error('métadonnées de job illisibles')
    const variantes = new Set([job.name.replaceAll('/', '_'), job.name.replace(/[/:]/g, '')])
    for (const nom of variantes) {
      if (!noms.has(nom)) noms.set(nom, [])
      noms.get(nom).push(job)
    }
  }
  return noms
}

function indexerJournaux(archive, noms, selection, unzipSync) {
  const journaux = new Map([...selection].map((job) => [job, new Map()]))
  unzipSync(archive, {
    filter({ name, originalSize }) {
      const fichierJob = FICHIER_JOB.exec(name)
      const fichierEtape = FICHIER_ETAPE.exec(name)
      const nom = fichierJob?.[1] ?? fichierEtape?.[1]
      const candidats = noms.get(nom) ?? []
      if (!candidats.some((job) => selection.has(job))) return false
      if (candidats.length !== 1) throw new Error(`journal ambigu pour « ${nom} »`)
      const job = candidats[0]
      const cle = fichierJob ? null : Number(fichierEtape[2])
      const journal = journaux.get(job)
      if (journal.has(cle)) throw new Error(`plusieurs fichiers du journal pour « ${job.name} »`)
      journal.set(cle, { name, originalSize })
      return false
    },
  })
  return journaux
}

function apercuDesEtapes(etapes, journal) {
  if (!etapes.length || etapes.some(({ number }) => !journal.get(number)?.originalSize)) return null
  return [...etapes].sort((a, b) => a.number - b.number).map(({ name, number }) => [name, journal.get(number)])
}

function entreesDuJob(job, journal, { echecsSeuls, estRouge, debutEssai }) {
  const execution = job.steps.filter((step) => step.conclusion !== 'skipped')
  const etapes = echecsSeuls ? execution.filter((step) => estRouge(step.conclusion)) : execution
  const regroupement = journal.get(null)
  const tout = regroupement?.originalSize ? [[ETAPE_INCONNUE, regroupement]] : null
  if (!echecsSeuls && tout) return tout
  const parEtape = apercuDesEtapes(etapes, journal)
  if (parEtape || tout) return parEtape ?? tout

  const herite = Date.parse(job.startedAt) < debutEssai && Date.parse(job.completedAt) < debutEssai
  const sansExecution = !job.steps.length && ['skipped', 'cancelled'].includes(job.conclusion)
  if (!echecsSeuls && (sansExecution || herite)) return []
  throw new Error(`journal absent ou incomplet pour le job « ${job.name} »`)
}

/** Projette l'archive REST d'un essai dans le format commun job, étape et ligne. */
export function projeterJournal(archive, jobs, { echecsSeuls, estRouge, debutEssai, borne = BORNE_JOURNAL }) {
  if (!Buffer.isBuffer(archive) || archive.byteLength < 22) throw new Error('archive ZIP illisible')
  const { unzipSync } = require('fflate')
  const noms = nomsDesJobs(jobs)
  const selection = new Set(echecsSeuls ? jobs.filter((job) => estRouge(job.conclusion)) : jobs)
  const journaux = indexerJournaux(archive, noms, selection, unzipSync)
  const entrees = [...selection].flatMap((job) => entreesDuJob(job, journaux.get(job), { echecsSeuls, estRouge, debutEssai })
    .map(([etape, fichier]) => ({ job: job.name, etape, ...fichier })))
  if (!echecsSeuls && !entrees.length) throw new Error('archive ZIP sans journal de job exploitable')

  const tailles = new Map(entrees.map(({ name, originalSize }) => [name, originalSize]))
  const tailleArchive = [...tailles.values()].reduce((total, taille) => total + taille, 0)
  if (tailleArchive > borne) throw new Error(`archive ZIP trop volumineuse (plus de ${borne} octets décompressés)`)
  const fichiers = unzipSync(archive, { filter: ({ name }) => tailles.has(name) })
  let taille = 0
  return entrees.map(({ job, etape, name }) => {
    if (typeof etape !== 'string' || !etape || /[\t\r\n]/.test(etape)) throw new Error(`étape du job « ${job} » illisible`)
    const octets = fichiers[name]
    if (octets.byteLength !== tailles.get(name)) throw new Error(`fichier ZIP tronqué pour le job « ${job} »`)
    const texte = Buffer.from(octets.buffer, octets.byteOffset, octets.byteLength).toString('utf8').replaceAll('\r\n', '\n').replace(/\n$/, '')
    const prefixe = `${job}\t${etape}\t`
    const taillePrefixe = Buffer.byteLength(prefixe)
    taille += Buffer.byteLength(texte) + taillePrefixe + 1
    for (let pos = texte.indexOf('\n'); pos !== -1 && taille <= borne; pos = texte.indexOf('\n', pos + 1)) taille += taillePrefixe
    if (taille > borne) throw new Error(`journal projeté trop volumineux (plus de ${borne} octets)`)
    return prefixe + texte.replaceAll('\n', () => `\n${prefixe}`)
  }).join('\n')
}
