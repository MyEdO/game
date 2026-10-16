import { spawn } from 'node:child_process'
import { capturerDescendants, filiationValide, identitePresente, mesurerArbreProcessus, tuerArbre, tuerCaptures } from './arbreProcessus.mjs'

export async function superviserProcessus({ commande, args = [], cwd = process.cwd(), env, shell = false, timeout, entree, heriter = false, stdio, surveillerGit = false, mesurer = mesurerArbreProcessus }) {
  const vueInitiale = mesurer()
  const gardiens = []
  let enfantCourant = vueInitiale.find((p) => p.pid === process.pid)
  let parent = vueInitiale.find((p) => p.pid === process.ppid)
  if (surveillerGit && !filiationValide(parent, enfantCourant)) return { status: null, signal: null, stdout: '', stderr: '', error: { code: 'EPARENT', message: 'parent disparu avant démarrage du hook' } }
  if (parent) gardiens.push(parent)
  const vus = new Set([process.pid])
  let gitPresent = false
  while (parent && !vus.has(parent.pid) && (!surveillerGit || filiationValide(parent, enfantCourant))) {
    vus.add(parent.pid)
    if (surveillerGit && /(?:^|[\\/])git(?:\.exe)?$/i.test(parent.nom)) { gardiens.push(parent); gitPresent = true }
    enfantCourant = parent
    parent = vueInitiale.find((p) => p.pid === parent.ppid)
  }
  if (surveillerGit && !gitPresent) return { status: null, signal: null, stdout: '', stderr: '', error: { code: 'EPARENT', message: 'ancêtre git absent avant démarrage du hook' } }
  const enfant = spawn(commande, args, { cwd, env, shell, detached: process.platform !== 'win32', windowsHide: true, stdio: stdio ?? (heriter ? 'inherit' : ['pipe', 'pipe', 'pipe']) })
  let stdout = ''; let stderr = ''; let interruption = null
  let erreur
  const ferme = new Promise((resolve) => enfant.once('close', resolve))
  const termine = new Promise((resolve) => {
    enfant.once('exit', (status, signal) => resolve({ status, signal }))
    enfant.once('error', (e) => { erreur = e.message; resolve({ status: null, signal: null }) })
  })
  if (!heriter) {
    enfant.stdout?.on('data', (b) => { stdout += b })
    enfant.stderr?.on('data', (b) => { stderr += b })
    enfant.stdin?.on('error', () => {})
    enfant.stdin?.end(entree)
  }
  const captures = new Map()
  let dernier = vueInitiale
  let racine
  const capturer = () => {
    dernier = mesurer()
    if (racine && !identitePresente(racine, dernier)) return dernier
    capturerDescendants(enfant.pid, dernier, captures)
    const identite = dernier.find((p) => p.pid === enfant.pid)
    if (identite?.creation) { racine ??= identite; captures.set(identite.pid, identite) }
    return dernier
  }
  const interrompre = (raison, code = 'EINTR') => {
    if (interruption) return
    interruption = { raison, code }
    try { capturer(); tuerCaptures(captures, dernier) }
    catch { if (enfant.exitCode === null && enfant.pid) tuerArbre(enfant.pid) }
  }
  try { capturer() } catch (e) { interrompre(e.message, 'EMESURE') }
  const intervalle = setInterval(() => {
    try {
      const vue = capturer()
      if (gardiens.some((p) => !identitePresente(p, vue))) interrompre('parent disparu', 'EPARENT')
    } catch (e) { interrompre(e.message, 'EMESURE') }
  }, 250)
  const borne = timeout ? setTimeout(() => interrompre(`échéance ${timeout} ms`, 'ETIMEDOUT'), timeout) : null
  const signaux = ['SIGINT', 'SIGTERM', 'SIGHUP'].map((signal) => {
    const handler = () => interrompre(signal)
    process.on(signal, handler)
    return [signal, handler]
  })
  const resultat = await termine
  clearInterval(intervalle)
  if (borne) clearTimeout(borne)
  for (const [signal, handler] of signaux) process.off(signal, handler)
  try { tuerCaptures(captures) } catch (e) { interruption ??= { raison: e.message, code: 'EMESURE' } }
  const draine = await new Promise((resolve) => {
    const borne = setTimeout(() => resolve(false), 1500)
    ferme.then(() => { clearTimeout(borne); resolve(true) })
  })
  if (!draine) interruption ??= { raison: 'flux encore ouverts après arrêt des descendants', code: 'EFLUX' }
  if (!heriter) {
    enfant.stdout?.destroy(); enfant.stderr?.destroy()
  }
  return { ...resultat, stdout, stderr, ...(erreur || interruption ? { error: { message: erreur ?? interruption.raison, code: erreur ? 'ENOENT' : interruption.code } } : {}) }
}

export function sortieDeSupervision(resultat, journal = process.stderr) {
  if (resultat.error) {
    journal.write(`[supervision] ${resultat.error.code} : ${resultat.error.message}\n`)
    return 1
  }
  return resultat.status ?? 1
}

if (import.meta.main) {
  const options = JSON.parse(Buffer.from(process.argv[2], 'base64').toString())
  const resultat = await superviserProcessus(options)
  if (options.heriter) process.exitCode = sortieDeSupervision(resultat)
  else process.stdout.write(JSON.stringify(resultat))
}
