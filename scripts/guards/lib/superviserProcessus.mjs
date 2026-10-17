import { spawn } from 'node:child_process'
import { accessSync, constants, mkdtempSync, realpathSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { delimiter, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { StringDecoder } from 'node:string_decoder'
import { createServer } from 'node:net'
import { randomUUID } from 'node:crypto'
import { ancetresValidesDe, identitePresente, mesurerArbreProcessus } from './arbreProcessus.mjs'
import { ecrireJsonAtomique } from './ecritureJsonAtomique.mjs'
import { citerArgv } from './lancerDetache.mjs'
import { estPidVivant } from './pid.mjs'

const DELAI_IPC = 15000
/** Mesures consécutives en échec au-delà desquelles l'indétermination interrompt le hook (#2626). */
export const MESURES_INDETERMINEES_MAX = 20

function interpreteurHote() {
  if (process.platform === 'win32') {
    if (!process.env.SystemRoot) throw new Error('prérequis supervision Windows absent : SystemRoot')
    return join(process.env.SystemRoot, process.arch === 'ia32' ? 'Sysnative' : 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe')
  }
  if (process.platform !== 'linux') throw new Error('supervision non supportée : ' + process.platform)
  for (const dossier of (process.env.PATH ?? '').split(delimiter)) {
    const candidat = resolve(dossier || process.cwd(), 'python3')
    try { accessSync(candidat, constants.X_OK); return realpathSync(candidat) } catch {}
  }
  throw new Error('prérequis supervision Linux absent : Python3')
}

function resultatValide(vu) {
  return vu && (vu.status === null || Number.isInteger(vu.status)) &&
    (vu.signal === null || typeof vu.signal === 'string') &&
    (!vu.error || (typeof vu.error.code === 'string' && typeof vu.error.message === 'string'))
}

export async function superviserProcessus({ commande, args = [], cwd = process.cwd(), env, shell = false, timeout, entree, heriter = false, stdio, surveillerGit = false, mesurer = mesurerArbreProcessus, estVivant = estPidVivant }) {
  let stdout = ''; let stderr = ''
  const decodeSortie = new StringDecoder('utf8'); const decodeErreur = new StringDecoder('utf8')
  const refus = (code, message) => ({ status: null, signal: null, stdout, stderr, error: { code, message } })
  let vueInitiale = []; let interpreteur
  if (surveillerGit) {
    try { vueInitiale = mesurer() } catch (e) { return refus('EMESURE', e.message) }
  }
  try { interpreteur = interpreteurHote() } catch (e) { return refus('EPREREQUIS', e.message) }
  const ancetres = ancetresValidesDe(process.pid, vueInitiale)
  const parent = ancetres[0]
  if (surveillerGit && parent?.pid !== process.ppid) return refus('EPARENT', 'parent disparu avant démarrage du hook')
  const gardiens = parent ? [parent] : []
  const git = ancetres.filter((p) => /(?:^|[\\/])git(?:\.exe)?$/i.test(p.nom))
  if (surveillerGit && !git.length) return refus('EPARENT', 'ancêtre git absent avant démarrage du hook')
  if (surveillerGit) gardiens.push(...git)
  const dossier = mkdtempSync(join(tmpdir(), 'wfrp-supervision-'))
  const stop = join(dossier, 'arret.json')
  const jeton = randomUUID()
  const adresse = process.platform === 'win32' ? '\\\\.\\pipe\\wfrp-supervision-' + jeton : join(dossier, 'controle.sock')
  let interruption = null; let resultat
  let hote; let canal; let serveur
  let intervalle; let borne; let connexion; let drainage
  let terminerCanal
  const finCanal = new Promise((ok) => { terminerCanal = ok })
  const signaux = []
  const sockets = new Set()
  const interrompre = (message, code = 'EINTR') => {
    if (interruption) return
    interruption = { code, message }
    try { ecrireJsonAtomique(stop, interruption) }
    catch (e) { interruption = { code: 'ECONTROLE', message: e.message }; hote?.kill('SIGTERM') }
  }
  try {
    serveur = createServer((socket) => {
      sockets.add(socket)
      socket.once('close', () => {
        sockets.delete(socket)
        if (socket === canal) {
          if (!socket.readableEnded) interrompre('canal worker fermé avant EOF', 'ECONTROLE')
          terminerCanal()
        }
      })
      socket.setEncoding('utf8')
      let tampon = ''; let authentifie = false
      socket.on('error', (e) => {
        if (socket === canal) { interrompre('canal worker : ' + e.message, 'ECONTROLE'); terminerCanal() }
      })
      socket.on('end', () => {
        if (socket !== canal) return
        if (tampon.length) interrompre('message IPC tronqué à EOF', 'ECONTROLE')
        else if (!resultat) interrompre('EOF du worker avant résultat', 'ECONTROLE')
        terminerCanal()
      })
      socket.on('data', (texte) => {
        tampon += texte
        for (;;) {
          const fin = tampon.indexOf('\n')
          if (fin < 0) break
          let message
          try { message = JSON.parse(tampon.slice(0, fin)) }
          catch { socket.destroy(); interrompre('message IPC malformé', 'ECONTROLE'); return }
          tampon = tampon.slice(fin + 1)
          if (!authentifie) {
            if (canal || message.type !== 'pret' || message.jeton !== jeton) { socket.destroy(); return }
            authentifie = true; canal = socket
            clearTimeout(connexion)
            socket.write(JSON.stringify({ type: 'options', options: { commande, args, cwd, env, shell } }) + '\n')
          } else if (message.type === 'resultat' && !resultat && resultatValide(message.resultat)) {
            resultat = message.resultat
          } else {
            interrompre('résultat IPC invalide', 'ERESULTAT')
          }
        }
      })
    })
    await new Promise((ok, non) => {
      serveur.once('error', non)
      serveur.listen(adresse, () => { serveur.off('error', non); ok() })
    })
    serveur.on('error', (e) => interrompre('serveur IPC : ' + e.message, 'ECONTROLE'))
    const worker = fileURLToPath(new URL('./enfantSupervise.mjs', import.meta.url))
    const argv = process.platform === 'win32'
      ? ['-NoLogo', '-NoProfile', '-NonInteractive', '-File', fileURLToPath(new URL('./hoteSupervision.ps1', import.meta.url)), '-Node', process.execPath, '-CommandLine', [process.execPath, worker, adresse, jeton].map(citerArgv).join(' '), '-Worktree', cwd, '-ParentPid', String(process.pid), '-StopFile', stop]
      : [fileURLToPath(new URL('./hoteSupervision.py', import.meta.url)), String(process.pid), process.execPath, worker, adresse, jeton, stop]
    hote = spawn(interpreteur, argv, { cwd, windowsHide: true, stdio: stdio ?? (heriter ? 'inherit' : ['pipe', 'pipe', 'pipe']) })
    const ferme = new Promise((ok) => {
      hote.once('error', (erreur) => ok({ erreur }))
      hote.once('close', (status, signal) => ok({ status, signal }))
    })
    hote.stdout?.on('data', (b) => { stdout += decodeSortie.write(b) })
    hote.stderr?.on('data', (b) => { stderr += decodeErreur.write(b) })
    if (!heriter) { hote.stdin?.on('error', () => {}); hote.stdin?.end(entree) }
    connexion = setTimeout(() => interrompre('échéance de connexion du worker', 'ECONTROLE'), DELAI_IPC)
    const mortProuvee = ({ pid }) => { try { return !estVivant(pid) } catch { return false } }
    let echecs = 0
    if (surveillerGit) intervalle = setInterval(() => {
      let vue
      try { vue = mesurer() } catch (e) {
        echecs += 1
        if (gardiens.some(mortProuvee)) interrompre('parent disparu', 'EPARENT')
        else if (echecs >= MESURES_INDETERMINEES_MAX) interrompre(`${echecs} mesures consécutives indéterminées : ${e.message}`, 'EMESURE')
        return
      }
      echecs = 0
      if (gardiens.some((p) => !identitePresente(p, vue))) interrompre('parent disparu', 'EPARENT')
    }, 250)
    if (timeout) borne = setTimeout(() => interrompre(`échéance ${timeout} ms`, 'ETIMEDOUT'), timeout)
    for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
      const handler = () => interrompre(signal)
      process.on(signal, handler); signaux.push([signal, handler])
    }
    const finHote = await ferme
    stdout += decodeSortie.end(); stderr += decodeErreur.end()
    if (interruption) return refus(interruption.code, interruption.message)
    if (finHote.erreur) return refus(finHote.erreur.code ?? 'EHOTE', finHote.erreur.message)
    if (finHote.status !== 0) return refus('EHOTE', `hôte sorti sans nettoyage confirmé : ${finHote.status ?? finHote.signal}`)
    drainage = setTimeout(() => {
      interrompre('échéance de drainage du canal worker', 'ECONTROLE')
      terminerCanal()
    }, DELAI_IPC)
    await finCanal
    clearTimeout(drainage)
    if (interruption) return refus(interruption.code, interruption.message)
    if (!resultat) return refus('ERESULTAT', 'résultat worker absent')
    return { ...resultat, stdout, stderr }
  } catch (e) {
    return refus('ECONTROLE', e.message)
  } finally {
    clearInterval(intervalle); clearTimeout(connexion); clearTimeout(drainage)
    if (borne) clearTimeout(borne)
    for (const [signal, handler] of signaux) process.off(signal, handler)
    for (const socket of sockets) socket.destroy()
    if (serveur?.listening) await new Promise((ok) => serveur.close(ok))
    rmSync(dossier, { recursive: true, force: true })
  }
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
