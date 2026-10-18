import fs from 'node:fs'
import { join, resolve, isAbsolute, basename, extname, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import { spawnSync } from 'node:child_process'
import { creerSessions, contexteSessions, envAgent, planAgent, lireJsonc, ligneControleur, lirePolitique } from './session-runtime.mjs'
import { preflightSessionStart } from './session-start.mjs'
import { verifierVersionCodex } from './session-version.mjs'
import { verifierProtocoleCodex } from './session-codex.mjs'
import { prefixeDeRefus, CATEGORIES_DE_REFUS } from '../guards/lib/categorieDeRefus.mjs'
import { estPidVivantDepuis } from '../guards/lib/pid.mjs'
import { IDENTITE_MESUREE } from '../test/identiteMesuree.mjs'

const script = fileURLToPath(import.meta.url), ops = fileURLToPath(new URL('.', import.meta.url))
const refuser = (raison, categorie = 'validation') => { throw new Error(`${prefixeDeRefus(categorie)} ${raison}`) }

export function refusSession(erreur) {
  const message = erreur instanceof Error ? erreur.message : String(erreur)
  const categorie = Object.keys(CATEGORIES_DE_REFUS).find((c) => message.startsWith(prefixeDeRefus(c))) ?? 'panne'
  const prefixe = prefixeDeRefus(categorie)
  return { prefixe, categorie, retentable: CATEGORIES_DE_REFUS[categorie], raison: message.startsWith(prefixe) ? message.slice(prefixe.length).trim() : message, ...(erreur?.reprise ? { reprise: erreur.reprise } : {}) }
}

/** `true` si ces arguments ATTENDENT une session (`attendre`) : la garde `commande-piege` la refuse en fond (#2603). PURE.
 *  @param {string[]} argv */
export const estUneAttente = (argv) => argv[0] === 'attendre'

export function optionsSession(argv) {
  const [action, ...argumentsAction] = argv
  const cible = argumentsAction[0] && !argumentsAction[0].startsWith('--') ? argumentsAction.shift() : undefined
  const options = { action, cible }
  if (!['lancer', 'lister', 'fermer', 'attendre', 'envoyer', 'etat', 'outils'].includes(action)) refuser('usage : ops:session lancer <consigne> [--ticket <n>] [--agent claude|codex] | lister [--json] | fermer <ticket|nom|PID|UUID> | envoyer <cible> --message <texte> | etat <cible> --json | attendre <cible> [--depuis <seq>] [--timeout-ms <n>] [--suivre] | outils --json')
  const permises = {
    lancer: new Set(['--ticket', '--nom', '--agent', '--consigne', '--worktree', '--executable', '--profil-wt', '--json']),
    lister: new Set(['--json']), fermer: new Set(['--json', '--timeout-ms']), attendre: new Set(['--json', '--timeout-ms', '--depuis', '--suivre']),
    envoyer: new Set(['--json', '--message', '--request-id', '--timeout-ms']), etat: new Set(['--json']), outils: new Set(['--json']),
  }[action]
  const args = argumentsAction
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    if (!permises.has(arg)) refuser(`OPTION REFUSÉE : ${arg}`)
    if (arg === '--json') { options.json = true; continue }
    if (arg === '--suivre') { options.suivre = true; continue }
    const cle = ({ '--ticket': 'ticket', '--nom': 'nom', '--agent': 'agent', '--consigne': 'consigne', '--worktree': 'worktree', '--executable': 'executable', '--timeout-ms': 'timeoutMs', '--profil-wt': 'profilWT', '--message': 'message', '--request-id': 'requestId', '--depuis': 'depuis' })[arg]
    if (!cle || !args[i + 1] || args[i + 1].startsWith('--')) refuser(`OPTION REFUSÉE : ${arg}`)
    options[cle] = args[++i]
  }
  if (options.timeoutMs !== undefined && (!/^\d+$/.test(options.timeoutMs) || Number(options.timeoutMs) > 3_600_000)) refuser('TIMEOUT INVALIDE : 0..3600000 ms')
  if (action === 'envoyer' && options.timeoutMs !== undefined && (Number(options.timeoutMs) < 1 || Number(options.timeoutMs) > 240_000)) refuser('TIMEOUT ENVOI INVALIDE : 1..240000 ms')
  if (options.depuis !== undefined && (!/^\d+$/.test(options.depuis) || !Number.isSafeInteger(Number(options.depuis)))) refuser('CURSEUR INVALIDE : entier positif ou nul')
  if (options.requestId !== undefined && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(options.requestId)) refuser('REQUEST ID INVALIDE : UUID requis')
  if (action === 'envoyer' && (!options.message?.trim() || options.message.length > 65_536)) refuser('MESSAGE INVALIDE : texte non vide, 65536 caractères maximum')
  if (action === 'lancer') return normaliserLancement(options)
  if (!['lister', 'outils'].includes(action) && !cible) refuser('CIBLE ABSENTE')
  if (['lister', 'outils'].includes(action) && cible) refuser('OPTION REFUSÉE : cible de liste')
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
    if (vu.error?.code === 'ETIMEDOUT') refuser(`CONTRAT CLI NON MESURÉ : ${agent} ${args.join(' ')} — ${vu.error.message}`, 'transitoire')
    if (vu.error || vu.status !== 0) refuser(`CONTRAT CLI INCOMPATIBLE : ${agent} ${args.join(' ')} — ${vu.error?.message ?? vu.stderr ?? vu.status}`)
    return `${vu.stdout ?? ''}\n${vu.stderr ?? ''}`
  }
  const version = aide(['--version'])
  if (!new RegExp(agent, 'i').test(version)) refuser(`CONTRAT CLI INCOMPATIBLE : version ${agent} non reconnue`)
  const general = aide(['--help'])
  if (agent === 'claude') { if (!/prompt/i.test(general)) refuser('CONTRAT CLI INCOMPATIBLE : prompt Claude absent'); return }
  const app = aide(['app-server', '--help'])
  const manquants = ['--dangerously-bypass-hook-trust', '--config'].filter((option) => !general.includes(option))
  if (!/\bapp-server\b/.test(general)) manquants.push('app-server')
  if (!app.includes('--listen')) manquants.push('--listen')
  if (manquants.length) refuser(`CONTRAT CLI INCOMPATIBLE : ${manquants.join(', ')}`)
}

export function argsTerminal({ profil, nom, worktree, script, node, commande, sessionId, dossier }) {
  const payload = Buffer.from(JSON.stringify({ script, node, commande, worktree, sessionId, dossier }), 'utf8').toString('base64')
  const expression = `$p=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${payload}'))|ConvertFrom-Json; & $p.script -Node $p.node -CommandLine $p.commande -Worktree $p.worktree -SessionId $p.sessionId -Dossier $p.dossier; if ($null -ne $LASTEXITCODE) { exit $LASTEXITCODE }`
  const optionWT = (valeur) => valeur.replaceAll(';', '\\;')
  return ['-w', '0', 'new-tab', '--profile', optionWT(profil), '--title', optionWT(nom), '--suppressApplicationTitle', '--startingDirectory', optionWT(worktree), 'powershell.exe', '-NoLogo', '-NoProfile', '-EncodedCommand', Buffer.from(expression, 'utf16le').toString('base64')]
}

export async function lancerSession(entree, { cwd = process.cwd(), contexte = contexteSessions, terminal = profilTerminal, natif = executableNatif, contrat = verifierContratAgent, version = verifierVersionCodex, protocole = verifierProtocoleCodex, executer = spawnSync, lancerWT = spawnSync, sessionsDe = (dossier) => creerSessions({ dossier }), env = process.env, preflight = preflightSessionStart } = {}) {
  const options = normaliserLancement(entree, cwd)
  if (options.worktree && !fs.existsSync(options.worktree)) refuser(`WORKTREE ABSENT : ${options.worktree}`)
  const c = contexte(options.worktree ?? cwd)
  if (!c.head || !c.branche) refuser('ÉTAT GIT INDISPONIBLE')
  const texte = fs.readFileSync(options.consigne, 'utf8')
  const environnementPreflight = envAgent(env)
  delete environnementPreflight.WFRP_SESSION_START
  const executerPreflight = (fichier, args, parametres) => executer(fichier, args, { ...parametres, env: environnementPreflight })
  const executable = natif(options.agent, options.executable, executerPreflight)
  if (options.agent === 'codex') { await version(executable, { executer: executerPreflight }); protocole({ executable, executer: executerPreflight }) }
  contrat(options.agent, executable, { env: environnementPreflight, executer: executerPreflight })
  const hooks = await preflight(c.worktree, options.agent)
  planAgent({ ...c, agent: options.agent }, { natif: executable, consigne: texte, rapport: 'rapport', schema: 'schema', politique: lirePolitique() })
  const profil = terminal({ chemin: env.WFRP_WT_SETTINGS, nom: options.profilWT })
  const dossier = join(c.gitCommun, 'sessions'), sessions = sessionsDe(dossier)
  const r = sessions.reserver({ ...c, hooks, ticket: options.ticket, nom: options.nom, agent: options.agent, consigne: options.consigne, executable, onglet: { titre: options.nom, profil } })
  const abandonner = async (e) => {
    try {
      const carte = await sessions.echecDemarrage(r.carte.sessionId, r.jeton, e.message)
      if (!['fermee', 'echec-reservation', 'echec-controle'].includes(carte.etat)) throw new Error(`${prefixeDeRefus('transitoire')} NETTOYAGE EN ATTENTE`)
    }
    catch (nettoyage) {
      const bloque = new Error(`${prefixeDeRefus('métier')} ${refusSession(e).raison}`, { cause: e })
      bloque.reprise = { sessionId: r.carte.sessionId, jeton: r.jeton, action: 'fermer', transport: 'stdin', raison: refusSession(nettoyage).raison }
      throw bloque
    }
    throw e
  }
  const commande = ligneControleur({ script: join(ops, 'session-runtime.mjs'), dossier, id: r.carte.sessionId })
  const args = argsTerminal({ profil: profil.nom, nom: options.nom, script: join(ops, 'session-process.ps1'), node: process.execPath, commande, worktree: c.worktree, sessionId: r.carte.sessionId, dossier })
  let vu
  try { vu = lancerWT('wt.exe', args, { cwd: c.worktree, shell: false, encoding: 'utf8', windowsHide: true, timeout: 15_000, env: envAgent(env) }) }
  catch (error) { vu = { error } }
  if (vu.error || vu.status !== 0) return abandonner(new Error(`${prefixeDeRefus('transitoire')} WT SPAWN ÉCHOUÉ : ${vu.error?.message ?? vu.stderr ?? vu.status}`))
  let carte
  try { carte = await sessions.attenteDemarrage(r.carte.sessionId, r.jeton) }
  catch (e) { return abandonner(e) }
  if (!carte.recuSessionStart || !carte.revendiqueLe || !['vivante', 'nettoyage', 'fermee'].includes(carte.etat) || carte.issueSortie === 'echec' || (carte.etat !== 'vivante' && carte.issueSortie !== 'sortie')) {
    const refus = refusSession(carte.raison ?? 'REÇU NATIF OU REVENDICATION ABSENT')
    return abandonner(new Error(`${refus.prefixe} DÉMARRAGE ÉCHOUÉ : ${refus.raison}`))
  }
  return { sessionId: carte.sessionId, ticket: carte.ticket, etat: carte.etat, jeton: r.jeton, veille: `node ${JSON.stringify(script)} attendre ${carte.sessionId} --timeout-ms 1740000 --suivre` }
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

export function outilsSession() {
  const sessionId = { type: 'string', format: 'uuid' }
  const timeoutMs = { type: 'integer', minimum: 0, maximum: 3_600_000 }
  const envoyer = {
    name: 'codex_envoyer',
    description: 'Envoie un message à une session Codex vivante inscrite. Le pont le sérialise avec les tours natifs ; le résultat confirme la livraison, pas la fin du travail. Le jeton autorise exclusivement cette session. Réutiliser requestId pour un nouvel essai du même envoi.',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: { ...sessionId, description: 'UUID d’une session inscrite au registre ops:session. Aucune identité de thread libre.' },
        jeton: { type: 'string', minLength: 1, description: 'Capacité remise au lancement, transmise par stdin et jamais en argument de processus.' },
        message: { type: 'string', minLength: 1, maxLength: 65536, description: 'Consigne à livrer à la session.' },
        requestId: { type: 'string', format: 'uuid', description: 'Identifiant de déduplication de cet envoi.' },
        timeoutMs: { ...timeoutMs, minimum: 1, maximum: 240_000, description: 'Délai maximum de livraison en millisecondes ; 1..240000.' },
      },
      required: ['sessionId', 'jeton', 'message'],
      additionalProperties: false,
    },
  }
  const attendre = {
    name: 'codex_attendre',
    description: 'Attend une transition native de la session Codex inscrite après le curseur depuis. Retourne une transition avec son curseur, son état et le rapport final validé lorsqu’il existe. Une fin de tour laisse le pont vivant. Réutiliser le curseur reçu pour la veille suivante.',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: { ...sessionId, description: 'UUID d’une session inscrite au registre ops:session. Aucune identité de thread libre.' },
        depuis: { type: 'integer', minimum: 0, description: 'Dernier curseur consommé ; 0 rejoue depuis le début.' },
        timeoutMs: { ...timeoutMs, maximum: 240_000, description: 'Délai maximum en millisecondes ; 0 effectue une observation immédiate.' },
      },
      required: ['sessionId'],
      additionalProperties: false,
    },
  }
  const etat = {
    name: 'codex_etat',
    description: 'Lit la carte publique d’une session inscrite : état du processus, projection native Codex, jetons, durée, appels d’outils et rapport validé. Ne retourne aucune capacité de contrôle.',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: { ...sessionId, description: 'UUID d’une session inscrite au registre ops:session. Aucune identité de thread libre.' },
      },
      required: ['sessionId'],
      additionalProperties: false,
    },
  }
  return {
    outils: [envoyer, attendre, etat],
    refusTechnique: `${prefixeDeRefus('panne')} Réponse ou transport ops:session invalide`,
    prefixesDeRefus: Object.keys(CATEGORIES_DE_REFUS).map(prefixeDeRefus),
  }
}

export async function attendreSuivi(sessions, cible, options, { parentVivant, lireParent = () => process.ppid, horloge = Date.now, identite = IDENTITE_MESUREE } = {}) {
  if (options.timeoutMs === 0) refuser('SUIVI : timeout strictement positif requis')
  if (!parentVivant) {
    const pidParent = lireParent(), instantParent = horloge()
    parentVivant = () => estPidVivantDepuis(pidParent, instantParent, identite)
  }
  let depuis = options.depuis
  do {
    if (!parentVivant()) return { etat: 'indeterminee', raison: 'PARENT DISPARU' }
    let resultat
    try { resultat = await sessions.attendre(cible, { ...options, depuis }) }
    catch (e) { if (e.code !== 'BORNE_IPC_CODEX') throw e }
    if (resultat && resultat.type !== 'aucune' && resultat.etat !== 'indeterminee') return resultat
    depuis = resultat?.curseur ?? resultat?.seq ?? depuis
    const carte = sessions.etat(cible)
    if (['fermee', 'echec-reservation', 'echec-controle'].includes(carte.etat)) return sessions.attendre(cible, { timeoutMs: 0, depuis })
  } while (true)
}

export async function commandeSession(argv, { stdout = process.stdout, stdin = process.stdin, env = process.env, cwd = process.cwd(), contexte = contexteSessions, sessionsDe = (dossier) => creerSessions({ dossier }) } = {}) {
  const options = optionsSession(argv)
  let resultat
  if (options.action === 'outils') resultat = outilsSession()
  else if (options.action === 'lancer') resultat = await lancerSession(options, { cwd, env })
  else {
    const c = contexte(cwd), sessions = sessionsDe(join(c.gitCommun, 'sessions'))
    if (options.action === 'lister') resultat = sessions.lister()
    else if (options.action === 'etat') resultat = sessions.etat(options.cible)
    else if (options.action === 'envoyer') resultat = await sessions.envoyer(options.cible, await jetonDe(env, stdin), { message: options.message, requestId: options.requestId, timeoutMs: Number(options.timeoutMs ?? 30_000) })
    else if (options.action === 'fermer') resultat = await sessions.fermer(options.cible, await jetonDe(env, stdin), { timeoutMs: Number(options.timeoutMs ?? 30_000) })
    else resultat = await (options.suivre ? attendreSuivi : (s, cible, attente) => s.attendre(cible, attente))(sessions, options.cible, { timeoutMs: Number(options.timeoutMs ?? 60_000), depuis: Number(options.depuis ?? 0) })
  }
  const code = resultat.etat === 'indeterminee' ? 3 : resultat.etat === 'echec-reservation' || resultat.carte?.issueSortie === 'echec' ? 1 : 0
  if (options.json && code !== 0) resultat = { ...resultat, refus: refusSession(new Error(code === 3 ? `${prefixeDeRefus('transitoire')} ${resultat.raison ?? 'Aucune transition dans le délai demandé'}` : resultat.carte?.raison ?? resultat.raison ?? `${prefixeDeRefus('métier')} Session en échec`)) }
  if (options.json || options.action !== 'lister') stdout.write(`${JSON.stringify(resultat, null, 2)}\n`)
  else {
    for (const a of resultat.anomalies) stdout.write(`ANOMALIE : ${a.fichier} — ${a.raison}\n`)
    for (const c of resultat.cartes) stdout.write(`${c.sessionId} · #${c.ticket ?? '—'} · ${c.nom ?? '—'} · ${c.etatMesure} · âge ${Math.round(c.ageMs / 1000)}s · ${c.worktree ?? '—'}\n`)
    for (const p of resultat.nonInscrits) stdout.write(`${p.pid} · ${p.nom} · NON INSCRIT · arrêt refusé\n`)
  }
  return code
}

if (import.meta.main) {
  try { process.exitCode = await commandeSession(process.argv.slice(2)) }
  catch (e) {
    const refus = refusSession(e)
    if (process.argv.includes('--json')) process.stdout.write(`${JSON.stringify({ refus })}\n`)
    else { process.stderr.write(`${refus.prefixe} ${refus.raison}\n`); if (refus.reprise) process.stdout.write(`${JSON.stringify({ reprise: refus.reprise })}\n`) }
    process.exitCode = 1
  }
}
