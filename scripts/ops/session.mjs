import fs from 'node:fs'
import { join, resolve, isAbsolute, basename, extname, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import { spawnSync } from 'node:child_process'
import { creerSessions, contexteSessions, envAgent, planAgent, lireJsonc, ligneControleur, lirePolitique } from './session-runtime.mjs'
import { preflightSessionStart } from './session-start.mjs'

const script = fileURLToPath(import.meta.url), ops = fileURLToPath(new URL('.', import.meta.url))
const politique = lirePolitique()
const refuser = (raison) => { throw new Error(raison) }

export function optionsSession(argv) {
  const [action, ...argumentsAction] = argv
  const cible = argumentsAction[0] && !argumentsAction[0].startsWith('--') ? argumentsAction.shift() : undefined
  const options = { action, cible }
  if (!['lancer', 'lister', 'fermer', 'attendre'].includes(action)) refuser('usage : ops:session lancer <consigne> [--ticket <n>] [--agent claude|codex] | lister [--json] | fermer <ticket|nom|PID|UUID> | attendre <ticket|nom|UUID> [--timeout-ms <n>]')
  const args = argumentsAction
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    if (arg === '--json') { options.json = true; continue }
    const cle = ({ '--ticket': 'ticket', '--nom': 'nom', '--agent': 'agent', '--consigne': 'consigne', '--worktree': 'worktree', '--executable': 'executable', '--timeout-ms': 'timeoutMs', '--profil-wt': 'profilWT' })[arg]
    if (!cle || !args[i + 1] || args[i + 1].startsWith('--')) refuser(`OPTION REFUSÉE : ${arg}`)
    options[cle] = args[++i]
  }
  if (options.timeoutMs !== undefined && (!/^\d+$/.test(options.timeoutMs) || Number(options.timeoutMs) > 3_600_000)) refuser('TIMEOUT INVALIDE : 0..3600000 ms')
  if (action === 'lancer') return normaliserLancement(options)
  if (action !== 'lister' && !cible) refuser('CIBLE ABSENTE')
  if (action === 'lister' && cible) refuser('OPTION REFUSÉE : cible de liste')
  return options
}

export function normaliserLancement(options, cwd) {
  const consigne = options.consigne ?? options.cible
  if (!consigne) refuser('CONSIGNE ABSENTE')
  const numerique = /^(\d+)(?:\.[^.]+)?$/.exec(basename(consigne))?.[1]
  const ticket = Number(options.ticket ?? numerique)
  if (!Number.isSafeInteger(ticket) || ticket <= 0) refuser('TICKET INVALIDE : nom de consigne numérique ou --ticket requis')
  const agent = options.agent ?? 'claude'
  if (!['claude', 'codex'].includes(agent)) refuser('AGENT INCONNU')
  return { ...options, ticket, nom: options.nom ?? `s${ticket}`, agent, consigne: cwd ? resolve(cwd, consigne) : consigne, worktree: options.worktree && cwd ? resolve(cwd, options.worktree) : options.worktree }
}

export function profilTerminal({ chemin, nom } = {}) {
  const chemins = chemin ? [chemin] : [join(process.env.LOCALAPPDATA ?? '', 'Packages/Microsoft.WindowsTerminal_8wekyb3d8bbwe/LocalState/settings.json'), join(process.env.LOCALAPPDATA ?? '', 'Microsoft/Windows Terminal/settings.json')]
  const existants = chemins.filter((p) => fs.existsSync(p))
  if (existants.length !== 1) refuser('PROFIL WT NON MESURÉ : préciser WFRP_WT_SETTINGS')
  const config = lireJsonc(fs.readFileSync(existants[0], 'utf8'))
  const profil = (config.profiles?.list ?? []).find((p) => nom ? (p.name === nom || p.guid === nom) : p.guid === config.defaultProfile)
  if (!profil) refuser('PROFIL WT ABSENT OU DYNAMIQUE NON MESURÉ')
  const fermeture = profil.closeOnExit ?? config.profiles?.defaults?.closeOnExit ?? 'automatic'
  if (!['always', 'graceful', 'automatic', true].includes(fermeture)) refuser(`PROFIL WT INCOMPATIBLE : closeOnExit=${fermeture}`)
  return { nom: profil.guid ?? profil.name, closeOnExit: fermeture, chemin: existants[0] }
}

const TRIPLES_CODEX = { x64: 'x86_64-pc-windows-msvc', arm64: 'aarch64-pc-windows-msvc' }
const estFichier = (chemin) => { try { return fs.statSync(chemin).isFile() } catch { return false } }

function codexDuShim(shim, arch) {
  const paquet = join(dirname(shim), 'node_modules', '@openai', 'codex')
  let vendor
  try { vendor = join(dirname(createRequire(join(paquet, 'package.json')).resolve(`@openai/codex-win32-${arch}/package.json`)), 'vendor') }
  catch { vendor = join(paquet, 'vendor') }
  return join(vendor, TRIPLES_CODEX[arch], 'bin', 'codex.exe')
}

export function executableNatif(agent, explicite, executer = spawnSync, { arch = process.arch } = {}) {
  if (explicite) { if (!isAbsolute(explicite) || extname(explicite).toLowerCase() !== '.exe' || !fs.existsSync(explicite) || !fs.statSync(explicite).isFile()) refuser('AGENT NATIF ABSENT : fichier .exe absolu requis'); return explicite }
  const ou = (nom) => { const vu = executer('where.exe', [nom], { encoding: 'utf8', windowsHide: true, timeout: 10_000 }); return vu.error || vu.status !== 0 ? [] : vu.stdout.trim().split(/\r?\n/).filter(Boolean) }
  let chemins = ou(`${agent}.exe`)
  if (!chemins.length && agent === 'codex') {
    if (!TRIPLES_CODEX[arch]) refuser(`AGENT NATIF ABSENT : codex.exe (architecture ${arch} non supportée)`)
    chemins = [...new Set(ou('codex.cmd').map((shim) => codexDuShim(shim, arch)).filter(estFichier))]
  }
  if (!chemins.length) refuser(`AGENT NATIF ABSENT : ${agent}.exe${agent === 'codex' ? ' (ni natif ni paquet npm @openai/codex)' : ''}`)
  if (chemins.length !== 1) refuser(`AGENT NATIF AMBIGU : ${agent}.exe ; préciser --executable`)
  return chemins[0]
}

export function verifierContratAgent(agent, executable, { executer = spawnSync, env = process.env } = {}) {
  const aide = (args) => {
    const vu = executer(executable, args, { encoding: 'utf8', windowsHide: true, shell: false, timeout: 10_000, env: envAgent(env) })
    if (vu.error || vu.status !== 0) refuser(`CONTRAT CLI INCOMPATIBLE : ${agent} ${args.join(' ')} — ${vu.error?.message ?? vu.stderr ?? vu.status}`)
    return `${vu.stdout ?? ''}\n${vu.stderr ?? ''}`
  }
  const version = aide(['--version'])
  if (!new RegExp(agent, 'i').test(version)) refuser(`CONTRAT CLI INCOMPATIBLE : version ${agent} non reconnue`)
  const general = aide(['--help'])
  if (agent === 'claude') { if (!/prompt/i.test(general)) refuser('CONTRAT CLI INCOMPATIBLE : prompt Claude absent'); return }
  const exec = aide(['exec', '--help'])
  const manquants = ['--dangerously-bypass-hook-trust', '--model', '--config', '--output-schema', '--output-last-message'].filter((option) => !exec.includes(option))
  if (!/\bexec\b/.test(general)) manquants.push('exec')
  if (manquants.length) refuser(`CONTRAT CLI INCOMPATIBLE : ${manquants.join(', ')}`)
}

export function argsTerminal({ profil, nom, worktree, script, node, commande }) {
  const payload = Buffer.from(JSON.stringify({ script, node, commande, worktree }), 'utf8').toString('base64')
  const expression = `$p=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${payload}'))|ConvertFrom-Json; & $p.script -Node $p.node -CommandLine $p.commande -Worktree $p.worktree; if ($null -ne $LASTEXITCODE) { exit $LASTEXITCODE }`
  const optionWT = (valeur) => valeur.replaceAll(';', '\\;')
  return ['-w', '0', 'new-tab', '--profile', optionWT(profil), '--title', optionWT(nom), '--suppressApplicationTitle', '--startingDirectory', optionWT(worktree), 'powershell.exe', '-NoLogo', '-NoProfile', '-EncodedCommand', Buffer.from(expression, 'utf16le').toString('base64')]
}

export async function lancerSession(entree, { cwd = process.cwd(), contexte = contexteSessions, terminal = profilTerminal, natif = executableNatif, contrat = verifierContratAgent, lancerWT = spawnSync, sessionsDe = (dossier) => creerSessions({ dossier }), env = process.env, preflight = preflightSessionStart } = {}) {
  const options = normaliserLancement(entree, cwd)
  if (options.worktree && !fs.existsSync(options.worktree)) refuser(`WORKTREE ABSENT : ${options.worktree}`)
  const c = contexte(options.worktree ?? cwd)
  if (!c.head || !c.branche) refuser('ÉTAT GIT INDISPONIBLE')
  const texte = fs.readFileSync(options.consigne, 'utf8')
  const executable = natif(options.agent, options.executable)
  contrat(options.agent, executable, { env })
  const hooks = await preflight(c.worktree, options.agent)
  planAgent({ ...c, agent: options.agent }, { natif: executable, consigne: texte, rapport: 'rapport', schema: 'schema', politique })
  const profil = terminal({ chemin: env.WFRP_WT_SETTINGS, nom: options.profilWT })
  const dossier = join(c.gitCommun, 'sessions'), sessions = sessionsDe(dossier)
  const r = sessions.reserver({ ...c, hooks, ticket: options.ticket, nom: options.nom, agent: options.agent, consigne: options.consigne, executable, onglet: { titre: options.nom, profil } })
  const commande = ligneControleur({ script: join(ops, 'session-runtime.mjs'), dossier, id: r.carte.sessionId })
  const args = argsTerminal({ profil: profil.nom, nom: options.nom, script: join(ops, 'session-process.ps1'), node: process.execPath, commande, worktree: c.worktree })
  let vu
  try { vu = lancerWT('wt.exe', args, { cwd: c.worktree, shell: false, encoding: 'utf8', windowsHide: true, timeout: 15_000, env: envAgent(env) }) }
  catch (error) { vu = { error } }
  if (vu.error || vu.status !== 0) { await sessions.echecDemarrage(r.carte.sessionId, r.jeton, `WT SPAWN : ${vu.error?.message ?? vu.stderr ?? vu.status}`); refuser('WT SPAWN ÉCHOUÉ') }
  const carte = await sessions.attenteDemarrage(r.carte.sessionId, r.jeton)
  if (!carte.recuSessionStart || !carte.revendiqueLe || !['vivante', 'nettoyage', 'fermee'].includes(carte.etat) || (carte.etat !== 'vivante' && !['sortie', 'echec'].includes(carte.issueSortie))) refuser(`DÉMARRAGE ÉCHOUÉ : ${carte.raison ?? 'REÇU NATIF OU REVENDICATION ABSENT'}`)
  return { sessionId: carte.sessionId, ticket: carte.ticket, etat: carte.etat, jeton: r.jeton, veille: `node ${JSON.stringify(script)} attendre ${carte.sessionId} --timeout-ms 3600000` }
}

async function jetonDe(env, stdin) {
  const jeton = env.WFRP_SESSION_JETON
  delete env.WFRP_SESSION_JETON
  if (jeton) return jeton
  if (stdin.isTTY) return undefined
  let texte = ''
  for await (const morceau of stdin) { texte += morceau; if (texte.length > 4096) refuser('STDIN CAPACITÉ TROP LONGUE') }
  if (!texte.trim()) return undefined
  try { const lu = JSON.parse(texte); return typeof lu.jeton === 'string' ? lu.jeton : undefined } catch { refuser('STDIN CAPACITÉ JSON INVALIDE') }
}

export async function commandeSession(argv, { stdout = process.stdout, stdin = process.stdin, env = process.env, cwd = process.cwd(), contexte = contexteSessions, sessionsDe = (dossier) => creerSessions({ dossier }) } = {}) {
  const options = optionsSession(argv)
  let resultat
  if (options.action === 'lancer') resultat = await lancerSession(options, { cwd, env })
  else {
    const c = contexte(cwd), sessions = sessionsDe(join(c.gitCommun, 'sessions'))
    if (options.action === 'lister') resultat = sessions.lister()
    else if (options.action === 'fermer') resultat = await sessions.fermer(options.cible, await jetonDe(env, stdin), { timeoutMs: Number(options.timeoutMs ?? 30_000) })
    else resultat = await sessions.attendre(options.cible, { timeoutMs: Number(options.timeoutMs ?? 60_000) })
  }
  if (options.json || options.action !== 'lister') stdout.write(`${JSON.stringify(resultat, null, 2)}\n`)
  else {
    for (const a of resultat.anomalies) stdout.write(`ANOMALIE : ${a.fichier} — ${a.raison}\n`)
    for (const c of resultat.cartes) stdout.write(`${c.sessionId} · #${c.ticket ?? '—'} · ${c.nom ?? '—'} · ${c.etatMesure} · âge ${Math.round(c.ageMs / 1000)}s · ${c.worktree ?? '—'}\n`)
    for (const p of resultat.nonInscrits) stdout.write(`${p.pid} · ${p.nom} · NON INSCRIT · arrêt refusé\n`)
  }
  return resultat.etat === 'indeterminee' ? 3 : resultat.etat === 'echec-reservation' || resultat.carte?.issueSortie === 'echec' ? 1 : 0
}

if (import.meta.main) {
  try { process.exitCode = await commandeSession(process.argv.slice(2)) }
  catch (e) { process.stderr.write(`[session] REFUS : ${e.message}\n`); process.exitCode = 1 }
}
