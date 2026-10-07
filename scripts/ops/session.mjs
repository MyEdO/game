import fs from 'node:fs'
import { join, resolve, isAbsolute, basename, extname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { homedir } from 'node:os'
import { spawnSync } from 'node:child_process'
import { creerSessions, contexteSessions, envAgent, planAgent, lireJsonc, ligneControleur } from './session-runtime.mjs'

const script = fileURLToPath(import.meta.url), ops = fileURLToPath(new URL('.', import.meta.url))
const politique = JSON.parse(fs.readFileSync(new URL('./session-policy.json', import.meta.url), 'utf8'))
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

export function profilCodexExiste({ profil = politique.profile, chemin = join(process.env.CODEX_HOME ?? join(homedir(), '.codex'), `${profil}.config.toml`) } = {}) {
  try { if (basename(chemin) !== `${profil}.config.toml` || !fs.statSync(chemin).isFile()) return false; fs.readFileSync(chemin, 'utf8'); return true } catch { return false }
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

export function executableNatif(agent, explicite, executer = spawnSync) {
  if (explicite) { if (!isAbsolute(explicite) || extname(explicite).toLowerCase() !== '.exe' || !fs.existsSync(explicite) || !fs.statSync(explicite).isFile()) refuser('AGENT NATIF ABSENT : fichier .exe absolu requis'); return explicite }
  const vu = executer('where.exe', [`${agent}.exe`], { encoding: 'utf8', windowsHide: true, timeout: 10_000 })
  if (vu.error || vu.status !== 0) refuser(`AGENT NATIF ABSENT : ${agent}.exe (aucun shim cmd)`)
  const chemins = vu.stdout.trim().split(/\r?\n/).filter(Boolean)
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
  const manquants = ['--profile', '--sandbox', '--approve-for-me', '--add-dir', '--output-schema', '--output-last-message'].filter((option) => !exec.includes(option))
  if (!/\bexec\b/.test(general) || !exec.includes('<name>.config.toml')) manquants.push('exec/profil-v2')
  if (manquants.length) refuser(`CONTRAT CLI INCOMPATIBLE : ${manquants.join(', ')}`)
}

export async function lancerSession(entree, { cwd = process.cwd(), contexte = contexteSessions, terminal = profilTerminal, natif = executableNatif, profilExiste = profilCodexExiste, contrat = verifierContratAgent, lancerWT = spawnSync, sessionsDe = (dossier) => creerSessions({ dossier }), env = process.env } = {}) {
  const options = normaliserLancement(entree, cwd)
  if (options.agent === 'codex' && options.worktree && !fs.existsSync(options.worktree)) refuser(`CHANTIER ABSENT : npm run ops:chantier -- ${options.ticket}`)
  let c = contexte(options.worktree ?? cwd)
  if (options.agent === 'codex') {
    const cible = options.worktree ?? join(c.racine, `.wt-${options.ticket}`)
    if (!fs.existsSync(cible)) refuser(`CHANTIER ABSENT : npm run ops:chantier -- ${options.ticket}`)
    c = contexte(cible)
    if (!c.branche?.startsWith('chantier/')) refuser(`BRANCHE DE CHANTIER REQUISE : npm run ops:chantier -- ${options.ticket}`)
  }
  if (!c.head || !c.branche) refuser('ÉTAT GIT INDISPONIBLE')
  const texte = fs.readFileSync(options.consigne, 'utf8')
  const existe = options.agent !== 'codex' || profilExiste()
  if (!existe) refuser(`PROFIL ABSENT : ${politique.profile}`)
  const executable = natif(options.agent, options.executable)
  contrat(options.agent, executable, { env })
  planAgent({ ...c, agent: options.agent }, { natif: executable, consigne: texte, gitCommun: c.gitCommun, rapport: 'rapport', schema: 'schema', profilExiste: existe, politique })
  const profil = terminal({ chemin: env.WFRP_WT_SETTINGS, nom: options.profilWT })
  const dossier = join(c.gitCommun, 'sessions'), sessions = sessionsDe(dossier)
  const r = sessions.reserver({ ...c, ticket: options.ticket, nom: options.nom, agent: options.agent, consigne: options.consigne, executable, profilExiste: existe, onglet: { titre: options.nom, profil } })
  const commande = ligneControleur({ script: join(ops, 'session-runtime.mjs'), dossier, id: r.carte.sessionId })
  const args = ['-w', '0', 'new-tab', '--profile', profil.nom, '--title', options.nom, '--suppressApplicationTitle', '--startingDirectory', c.worktree, 'powershell.exe', '-NoLogo', '-NoProfile', '-File', join(ops, 'session-process.ps1'), '-Node', process.execPath, '-CommandLine', commande, '-Worktree', c.worktree]
  const vu = lancerWT('wt.exe', args, { cwd: c.worktree, shell: false, encoding: 'utf8', windowsHide: true, timeout: 15_000, env: envAgent(env) })
  if (vu.error || vu.status !== 0) { sessions.sortie(r.carte.sessionId, { codeAgent: null, raison: `WT SPAWN : ${vu.error?.message ?? vu.stderr}` }); refuser('WT SPAWN ÉCHOUÉ') }
  return { sessionId: r.carte.sessionId, ticket: r.carte.ticket, etat: r.carte.etat, jeton: r.jeton, veille: `node ${JSON.stringify(script)} attendre ${r.carte.sessionId} --timeout-ms 3600000` }
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

if (process.argv[1] && resolve(process.argv[1]) === script) {
  try { process.exitCode = await commandeSession(process.argv.slice(2)) }
  catch (e) { process.stderr.write(`[session] REFUS : ${e.message}\n`); process.exitCode = 1 }
}
