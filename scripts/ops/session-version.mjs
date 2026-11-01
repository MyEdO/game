import { spawn, spawnSync } from 'node:child_process'
import { appendFileSync, closeSync, existsSync, mkdirSync, openSync, readdirSync, readFileSync, renameSync, rmSync, statSync, unlinkSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { prefixeDeRefus } from '../guards/lib/categorieDeRefus.mjs'
import { estPidVivant } from '../guards/lib/pid.mjs'
import { coupeAuMot } from '../../src/lib/coupeAuMot.mjs'

export const DOSSIER_VERSIONS_CODEX = join(homedir(), '.cache', 'wfrp-codex')
export const TRIPLES_CODEX = Object.freeze({ x64: 'x86_64-pc-windows-msvc', arm64: 'aarch64-pc-windows-msvc' })
const MARQUEUR = 'complet.json', VERROU_NAISSANT_MS = 60_000

const analyser = (texte) => {
  const m = /^(?:codex(?:-cli)?\s+)?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/.exec(String(texte).trim())
  if (!m || m[4]?.split('.').some((s) => /^0\d+$/.test(s))) return null
  return { texte: String(texte).trim().replace(/^codex(?:-cli)?\s+/, ''), nombres: m.slice(1, 4).map(Number), pre: m[4]?.split('.') }
}
const versionDe = (texte) => {
  const v = analyser(texte)
  if (!v) throw new Error(`${prefixeDeRefus('validation')} VERSION CODEX INVALIDE : ${texte}`)
  return v
}
export function comparerVersions(a, b) {
  const x = versionDe(a), y = versionDe(b)
  for (let i = 0; i < 3; i++) if (x.nombres[i] !== y.nombres[i]) return Math.sign(x.nombres[i] - y.nombres[i])
  if (!x.pre || !y.pre) return x.pre ? -1 : y.pre ? 1 : 0
  for (let i = 0; i < Math.max(x.pre.length, y.pre.length); i++) {
    const p = x.pre[i], q = y.pre[i]
    if (p === q) continue
    if (p === undefined || q === undefined) return p === undefined ? -1 : 1
    const pn = /^\d+$/.test(p), qn = /^\d+$/.test(q)
    if (pn && qn) return Math.sign(Number(p) - Number(q))
    if (pn !== qn) return pn ? -1 : 1
    return p < q ? -1 : 1
  }
  return 0
}

export function codexDuPaquet(paquet, arch = process.arch) {
  const plateforme = `codex-win32-${arch}`, binaire = (racine) => join(racine, 'vendor', TRIPLES_CODEX[arch], 'bin', 'codex.exe')
  const candidats = [binaire(join(paquet, 'node_modules', '@openai', plateforme)), binaire(join(paquet, '..', plateforme)), binaire(paquet)]
  return candidats.find((chemin) => existsSync(chemin)) ?? candidats.at(-1)
}

const estVersion = (nom) => analyser(nom)?.texte === nom
export function versionsCompletes(dossier) {
  let noms
  try { noms = readdirSync(dossier) } catch { return [] }
  return noms.filter(estVersion).flatMap((version) => {
    try {
      const m = JSON.parse(readFileSync(join(dossier, version, MARQUEUR), 'utf8'))
      return m.version === version && typeof m.executable === 'string' && existsSync(m.executable) ? [{ version, executable: m.executable }] : []
    } catch { return [] }
  }).sort((a, b) => comparerVersions(b.version, a.version))
}

export function choisirCodex({ globale, dossier = DOSSIER_VERSIONS_CODEX, executer = spawnSync, avertir = (message) => process.stderr.write(`${message}\n`) }) {
  const completes = versionsCompletes(dossier)
  let executable
  try { executable = globale() } catch (e) {
    if (!completes.length) throw e
    return completes[0]
  }
  const vu = executer(executable, ['--version'], { encoding: 'utf8', shell: false, windowsHide: true, timeout: 10_000 })
  const version = vu.error || vu.status !== 0 ? null : analyser(vu.stdout)?.texte ?? null
  if (completes.length && (version === null || comparerVersions(completes[0].version, version) > 0)) return completes[0]
  if (!version && !vu.error && vu.status === 0) avertir(`${prefixeDeRefus('validation')} VERSION CODEX ILLISIBLE : ${coupeAuMot(String(vu.stdout).trim(), 200)} ; ${executable} lancé tel quel`)
  return { executable, version }
}

export function planifierMiseAJourCodex({ meilleure, dossier = DOSSIER_VERSIONS_CODEX, env = process.env, lancer = spawn, avertir = (message) => process.stderr.write(`${message}\n`) }) {
  const echec = (e) => avertir(`${prefixeDeRefus('panne')} MISE À JOUR CODEX NON PLANIFIÉE : ${e.message} ; lancement poursuivi`)
  try {
    mkdirSync(dossier, { recursive: true })
    const enfant = lancer(process.execPath, [fileURLToPath(import.meta.url), '--installer', dossier, meilleure ?? ''], { cwd: dossier, detached: true, stdio: 'ignore', windowsHide: true, shell: false, env })
    enfant.on('error', (e) => { try { journaliser(dossier, `lancement de la mise à jour : ${e.message}`) } catch { echec(e) } })
    enfant.unref()
  } catch (e) { echec(e) }
}

export function npmCliDeNode(node = process.execPath) {
  return [join(dirname(node), 'node_modules', 'npm', 'bin', 'npm-cli.js'), join(dirname(node), '..', 'lib', 'node_modules', 'npm', 'bin', 'npm-cli.js')].find((p) => existsSync(p)) ?? null
}
const journaliser = (dossier, message) => appendFileSync(join(dossier, 'maj.log'), `${new Date().toISOString()} ${message}\n`)
const echecDe = (vu) => vu.error?.message ?? (vu.status !== 0 ? coupeAuMot((vu.stderr || `code ${vu.status}`).trim(), 500) : null)

function tenant(verrou, estVivant) {
  let pid
  try { pid = readFileSync(verrou, 'utf8') } catch (e) { if (e.code === 'ENOENT') return false; throw e }
  return pid ? estVivant(Number(pid)) : Date.now() - statSync(verrou).mtimeMs < VERROU_NAISSANT_MS
}
function verrouiller(verrou, pid, estVivant) {
  for (let essai = 0; essai < 2; essai++) {
    try {
      const fd = openSync(verrou, 'wx')
      try { writeFileSync(fd, String(pid)) } finally { closeSync(fd) }
      return true
    } catch (e) { if (e.code !== 'EEXIST') throw e }
    if (tenant(verrou, estVivant)) return false
    rmSync(verrou, { force: true })
  }
  return false
}

const codexDeVersion = (dossier, version, arch) => codexDuPaquet(join(dossier, version, 'node_modules', '@openai', 'codex'), arch)

function menage({ dossier, installee, arch, pid, estVivant, delier }) {
  const gardee = versionsCompletes(dossier).find((v) => comparerVersions(v.version, installee) < 0)?.version
  for (const nom of readdirSync(dossier).filter((n) => estVersion(n) && n !== gardee && comparerVersions(n, installee) < 0)) {
    const verrou = join(dossier, `${nom}.verrou`)
    if (!verrouiller(verrou, pid, estVivant)) continue
    try {
      try { delier(codexDeVersion(dossier, nom, arch)) } catch (e) {
        if (e.code !== 'ENOENT') { journaliser(dossier, `ménage de ${nom} reporté : ${e.message}`); continue }
      }
      rmSync(join(dossier, nom, MARQUEUR), { force: true })
      rmSync(join(dossier, nom), { recursive: true, force: true })
    } catch (e) { journaliser(dossier, `ménage de ${nom} inachevé : ${e.message}`) } finally { rmSync(verrou, { force: true }) }
  }
}

export async function installerCodex({ dossier = DOSSIER_VERSIONS_CODEX, meilleure = null, fetcher = fetch, executer = spawnSync, npmCli = npmCliDeNode(), arch = process.arch, estVivant = estPidVivant, delier = unlinkSync, pid = process.pid, timeoutMs = 8000 } = {}) {
  mkdirSync(dossier, { recursive: true })
  let issue
  try { issue = await installer() } catch (e) { issue = `échouée : ${e.message}` }
  journaliser(dossier, issue)
  return issue

  async function installer() {
    const abort = new AbortController()
    let timer, derniere
    try {
      derniere = await Promise.race([
        (async () => {
          const reponse = await fetcher('https://registry.npmjs.org/@openai%2fcodex/latest', { signal: abort.signal })
          if (!reponse.ok) throw new Error(`HTTP ${reponse.status}`)
          return versionDe((await reponse.json()).version).texte
        })(),
        new Promise((_, non) => { timer = setTimeout(() => { abort.abort(); non(new Error('délai registre dépassé')) }, timeoutMs) }),
      ])
    } finally { clearTimeout(timer); abort.abort() }
    const complete = () => versionsCompletes(dossier).some((v) => v.version === derniere)
    if ((meilleure && comparerVersions(derniere, meilleure) <= 0) || complete()) return `à jour : ${derniere}`
    if (!npmCli) return `échouée : npm-cli.js introuvable à côté de ${process.execPath}`
    const verrou = join(dossier, `${derniere}.verrou`)
    if (!verrouiller(verrou, pid, estVivant)) return `occupée : ${derniere}`
    try {
      if (complete()) return `à jour : ${derniere}`
      const cible = join(dossier, derniere), executable = () => codexDeVersion(dossier, derniere, arch)
      rmSync(cible, { recursive: true, force: true })
      mkdirSync(cible, { recursive: true })
      const npm = (scripts) => executer(process.execPath, [npmCli, 'install', '--prefix', cible, '--no-audit', '--no-fund', ...(scripts ? [] : ['--ignore-scripts']), `@openai/codex@${derniere}`], { encoding: 'utf8', shell: false, windowsHide: true })
      let vu = npm(false)
      if (!existsSync(executable())) vu = npm(true)
      const installe = executable()
      if (!existsSync(installe)) return `échouée : ${derniere} sans codex.exe (${echecDe(vu) ?? 'npm sans erreur'})`
      const repond = executer(installe, ['--version'], { encoding: 'utf8', shell: false, windowsHide: true, timeout: 10_000 })
      if (echecDe(repond)) return `échouée : ${derniere} --version : ${echecDe(repond)}`
      const provisoire = join(cible, `${MARQUEUR}.${pid}`)
      writeFileSync(provisoire, JSON.stringify({ version: derniere, executable: installe }))
      renameSync(provisoire, join(cible, MARQUEUR))
      menage({ dossier, installee: derniere, arch, pid, estVivant, delier })
      return `installée : ${derniere}`
    } finally { unlinkSync(verrou) }
  }
}

if (import.meta.main && process.argv[2] === '--installer') await installerCodex({ dossier: process.argv[3], meilleure: process.argv[4] || null })
