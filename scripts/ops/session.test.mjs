import test from 'node:test'
import fs from 'node:fs'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, rmSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { EventEmitter } from 'node:events'
import { spawnSync, spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { creerSessions, envAgent, planAgent, validerRapport, lireJsonc, ligneControleur, mesurerProcessus, lirePolitique, contratCodex, consigneAgent, lancerAgent, lireRapportDe, validateurDeSchema, piloterAgent } from './session-runtime.mjs'
import { lancerSession, optionsSession, profilTerminal, executableNatif, verifierContratAgent, commandeSession, argsTerminal, outilsSession, refusSession } from './session.mjs'
import { preflightSessionStart } from './session-start.mjs'
import { aplatirHooks } from '../agents/compat-core.mjs'
import { estPidVivantDepuis } from '../guards/lib/pid.mjs'
import { IDENTITE_MESUREE } from '../test/identiteMesuree.mjs'
import { verifierVersionCodex } from './session-version.mjs'

const racineScripts = fileURLToPath(new URL('../../', import.meta.url))
const hooksBanc = { claude: await preflightSessionStart(racineScripts, 'claude'), codex: await preflightSessionStart(racineScripts, 'codex') }
const identite = (pid) => ({ pid, creation: `date-${pid}` })

test('Codex : cible canonique, envoi authentifié, veille native sans sondage et état sans secret', async (t) => {
  const appels = []
  const b = banc(t, { envoyer: async (p) => { appels.push(p); return { ok: true } }, veiller: async (p) => { appels.push(p); return { seq: 4, etat: 'inactif', type: 'fin' } }, auSommeil: () => assert.fail('veille par sondage') })
  const r = b.reserver({ agent: 'codex' }); b.revendiquer(r)
  await assert.rejects(b.sessions.envoyer('banc', 'faux', { message: 'corriger' }), /\[permission · non retentable\]/)
  assert.equal(appels.length, 0)
  assert.deepEqual(await b.sessions.envoyer('2461', r.jeton, { message: 'corriger', requestId: r.carte.sessionId, timeoutMs: 123 }), { ok: true, requestId: r.carte.sessionId })
  assert.equal(appels[0].sessionId, r.carte.sessionId); assert.equal(appels[0].message, 'corriger'); assert.equal(appels[0].jeton, r.jeton)
  assert.equal((await b.sessions.attendre('banc', { depuis: 3, timeoutMs: 456 })).type, 'fin')
  assert.deepEqual(appels[1], { dossier: b.dossier, sessionId: r.carte.sessionId, depuis: 3, timeoutMs: 456 })
  const etat = b.sessions.etat(r.carte.sessionId)
  for (const cle of ['empreinteJeton', 'empreinteNonce', 'empreinteNonceHook']) assert.equal(cle in etat, false)
  assert.throws(() => b.sessions.etat('thread-libre'), /\[métier · non retentable\].*NON INSCRIT/)
  rmSync(join(b.dossier, `${r.carte.sessionId}.sessionstart`))
  assert.throws(() => b.sessions.projectionCodex(r.carte.sessionId, { rapport: { sessionId: r.carte.sessionId, ticket: 2461, worktree: b.dossier, atterrissage: null, resume: 'fait' } }), /REÇU SESSIONSTART ABSENT/)
})

test('CLI : envoi sans requestId génère une identité réutilisable à la couture canonique', async (t) => {
  const appels = []
  const b = banc(t, { envoyer: async (p) => {
    assert.match(p.requestId ?? '', /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)
    appels.push(p)
    return { ok: true }
  } })
  const r = b.reserver({ agent: 'codex' }); b.revendiquer(r)
  const appeler = async (options) => {
    let texte = ''
    const code = await commandeSession(['envoyer', 'banc', '--message', 'ajuste', '--json', ...options], { stdout: { write: (m) => { texte += m } }, contexte: () => ({ gitCommun: b.dossier }), sessionsDe: () => b.sessions, env: {}, stdin: (async function* () { yield JSON.stringify({ jeton: r.jeton }) })() })
    assert.equal(code, 0)
    return JSON.parse(texte)
  }
  const premier = await appeler([])
  assert.equal(premier.requestId, appels[0].requestId)
  const rejoue = await appeler(['--request-id', premier.requestId])
  assert.equal(rejoue.requestId, premier.requestId)
  assert.equal(appels[1].requestId, appels[0].requestId)
})

test('CLI : envoi reçoit la capacité stdin ; outils expose le contrat et refuse options étrangères', async () => {
  const id = 'd4afafad-8b29-4df4-9847-8f8f15e58a5c', appels = []
  const sessions = { envoyer: async (...p) => { appels.push(p); return { ok: true } }, etat: (cible) => ({ sessionId: cible }) }
  const dependances = { stdout: { write() {} }, contexte: () => ({ gitCommun: 'C:/registre' }), sessionsDe: () => sessions, stdin: (async function* () { yield '{"jeton":"capacité"}' })(), env: {} }
  assert.equal(await commandeSession(['envoyer', id, '--message', 'ajuste', '--request-id', id, '--timeout-ms', '12'], dependances), 0)
  assert.deepEqual(appels[0], [id, 'capacité', { message: 'ajuste', requestId: id, timeoutMs: 12 }])
  const outils = outilsSession()
  assert.deepEqual(outils.outils.map((o) => o.name), ['codex_envoyer', 'codex_attendre', 'codex_etat'])
  assert.ok(outils.outils.every((o) => o.description.length > 100 && o.inputSchema.additionalProperties === false))
  assert.match(outils.refusTechnique, /^\[panne · non retentable\]/)
  assert.deepEqual(refusSession(new Error('[permission · non retentable] Jeton incorrect')), { prefixe: '[permission · non retentable]', categorie: 'permission', retentable: false, description: 'Jeton incorrect' })
  assert.equal(refusSession(new Error('I/O inconnu')).categorie, 'panne')
  assert.deepEqual(outils.prefixesDeRefus.length, 5)
  assert.equal(outils.outils.find((o) => o.name === 'codex_attendre').inputSchema.properties.timeoutMs.maximum, 240_000)
  assert.equal(await commandeSession(['outils', '--json'], { stdout: { write() {} }, contexte: () => assert.fail('registre requis') }), 0)
  let reponse = ''
  assert.equal(await commandeSession(['attendre', id, '--json'], { ...dependances, stdout: { write: (m) => { reponse += m } }, sessionsDe: () => ({ attendre: async () => ({ etat: 'indeterminee' }) }) }), 3)
  assert.equal(JSON.parse(reponse).refus.categorie, 'transitoire')
  for (const argv of [['etat', id, '--message', 'x'], ['envoyer', id, '--message', ' '], ['attendre', id, '--depuis', '-1'], ['envoyer', id, '--message', 'x', '--request-id', 'thread-libre']]) assert.throws(() => optionsSession(argv), /\[validation · non retentable\]/)
})

test('lanceur Codex : version et protocole contrôlés avant réservation et fenêtre', async (t) => {
  const b = banc(t), consigne = join(b.dossier, '2528.md'); writeFileSync(consigne, 'faire')
  for (const faute of ['version', 'protocole']) {
    const appels = []
    await assert.rejects(lancerSession({ ticket: 2528, agent: 'codex', consigne }, { contexte: () => ({ worktree: b.dossier, branche: 'b', head: 'a'.repeat(40) }), natif: () => b.fichiers.codex, version: async (exe) => { assert.equal(exe, b.fichiers.codex); appels.push('version'); if (faute === 'version') throw new Error('version refusée') }, protocole: ({ executable }) => { assert.equal(executable, b.fichiers.codex); appels.push('protocole'); throw new Error('protocole refusé') }, sessionsDe: () => assert.fail('réservation atteinte'), terminal: () => assert.fail('fenêtre atteinte') }), /refus/)
    assert.deepEqual(appels, faute === 'version' ? ['version'] : ['version', 'protocole'])
  }
})

test('préflights Codex : chaque exécuteur reçoit le même environnement nettoyé et garde les réglages utilisateur', async (t) => {
  const b = banc(t), consigne = join(b.dossier, '2528.md'); writeFileSync(consigne, 'faire')
  const env = { WFRP_SESSION_JETON: 'parent', WFRP_SESSION_REVENDICATION: 'nonce', CLAUDE_CODE_CHILD_SESSION: '1', WFRP_SESSION_START: 'reçu-parent', GH_TOKEN: 'github-conservé', CODEX_HOME: 'config-utilisateur', PATH: 'natif' }
  const propre = { GH_TOKEN: 'github-conservé', CODEX_HOME: 'config-utilisateur', PATH: 'natif' }, appels = []
  const executer = (exe, args, options) => {
    assert.equal(exe, b.fichiers.codex)
    assert.deepEqual(options.env, propre)
    appels.push(args.join(' '))
    return { status: 0, stdout: args[0] === '--version' ? 'codex-cli 0.163.0' : args[0] === '--help' ? 'app-server --dangerously-bypass-hook-trust --config' : '--listen' }
  }
  await assert.rejects(lancerSession({ ticket: 2528, agent: 'codex', consigne }, {
    contexte: () => ({ worktree: b.dossier, branche: 'b', head: 'a'.repeat(40) }), natif: () => b.fichiers.codex, env, executer,
    version: (exe, options = {}) => verifierVersionCodex(exe, { ...options, executer: options.executer ?? executer, fetcher: async () => ({ ok: true, json: async () => ({ version: '0.163.0' }) }) }),
    protocole: ({ executable, executer: commande = executer }) => { commande(executable, ['--version'], {}); commande(executable, ['app-server', 'generate-json-schema'], {}) },
    preflight: async () => hooksBanc.codex, terminal: () => { throw new Error('préflights terminés') },
  }), /préflights terminés/)
  assert.deepEqual(appels, ['--version', '--version', 'app-server generate-json-schema', '--version', '--help', 'app-server --help'])
  assert.equal(env.WFRP_SESSION_JETON, 'parent')
})

function banc(t, { auSommeil = () => {}, envoyer, veiller } = {}) {
  const dossier = mkdtempSync(join(process.env.WFRP_SESSION_TEST_FIXTURES ?? tmpdir(), 'sessions-'))
  t.after(() => rmSync(dossier, { recursive: true, force: true }))
  const fixtures = join(dossier, 'fixtures'); mkdirSync(fixtures)
  for (const surface of ['claude', 'codex']) mkdirSync(join(dossier, `.${surface}`), { recursive: true })
  fs.copyFileSync(join(racineScripts, '.claude/credo.md'), join(dossier, '.claude/credo.md'))
  for (const surface of ['claude', 'codex']) {
    const rel = surface === 'claude' ? '.claude/settings.json' : '.codex/hooks.json'
    fs.copyFileSync(join(racineScripts, rel), join(dossier, rel))
    for (const hook of aplatirHooks(JSON.parse(readFileSync(join(dossier, rel), 'utf8')), rel)) {
      mkdirSync(join(dossier, 'scripts/hooks'), { recursive: true })
      fs.copyFileSync(join(racineScripts, 'scripts/hooks', hook.script), join(dossier, 'scripts/hooks', hook.script))
    }
  }
  const fichiers = { codex: join(fixtures, 'codex.exe'), claude: join(fixtures, 'claude.exe'), rapport: join(fixtures, 'rapport.json'), schema: join(fixtures, 'schema.json') }
  for (const fichier of Object.values(fichiers)) writeFileSync(fichier, '')
  let maintenant = 1000
  const vivants = new Map([[10, identite(10)], [20, identite(20)], [30, identite(30)]])
  const sessions = creerSessions({ dossier, horloge: () => maintenant, processus: (pid) => vivants.get(pid) ?? null, inventaire: () => [...vivants.values(), { ...identite(99), nom: 'codex.exe' }], dormir: async () => { maintenant += 50; auSommeil(sessions, vivants) }, lanceur: () => identite(99), envoyer, veiller })
  const claim = sessions.revendiquer
  sessions.revendiquer = (...args) => {
    const carte = claim(...args)
    const { chemin, ...contexte } = JSON.parse(readFileSync(join(dossier, `${carte.sessionId}.hook-context`), 'utf8'))
    writeFileSync(chemin, JSON.stringify({ ...contexte, version: 1, date: carte.date, nativeSessionId: 'native-banc' }))
    return carte
  }
  const reserver = (p = {}) => sessions.reserver({ ticket: 2461, nom: 'banc', agent: 'claude', hooks: hooksBanc[p.agent ?? 'claude'], consigne: join(dossier, 'consigne.md'), worktree: dossier, racine: dossier, branche: 'chantier/2461', head: 'a'.repeat(40), ...p })
  const revendiquer = (r) => sessions.revendiquer(r.carte.sessionId, r.nonce, { controleur: identite(10), jobHost: identite(30) })
  return { sessions, reserver, revendiquer, vivants, dossier, fichiers, avance: (ms) => { maintenant += ms } }
}

test('cycle réservé, revendiqué, mesuré, arrêt puis ACK seulement après sortie observée', async (t) => {
  const b = banc(t), r = b.reserver()
  assert.equal(r.carte.etat, 'reservee')
  assert.ok(!JSON.stringify(b.sessions.lister()).includes(r.jeton))
  b.revendiquer(r)
  b.sessions.agentDemarre(r.carte.sessionId, identite(20))
  assert.equal(b.sessions.lister().cartes[0].etatMesure, 'vivante')
  const demande = b.sessions.demanderArret('2461', r.jeton)
  assert.equal(demande.etat, 'arret-demande')
  assert.equal(b.sessions.ackArret(r.carte.sessionId, demande.demandeId), null)
  b.vivants.delete(20)
  b.sessions.sortie(r.carte.sessionId, { codeAgent: null, signal: 'SIGTERM', arret: true })
  assert.equal(b.sessions.lister().cartes[0].etatMesure, 'nettoyage-en-cours')
  assert.equal(b.sessions.ackArret(r.carte.sessionId, demande.demandeId), null)
  b.vivants.delete(10); b.vivants.delete(30)
  assert.equal(b.sessions.ackArret(r.carte.sessionId, demande.demandeId).codeEnveloppe, 0)
  assert.equal(b.sessions.lister().evenements.length, 2)
  assert.equal(b.sessions.lister().nonInscrits[0].etatMesure, 'NON INSCRIT')
})

test('autorité refuse absent, étranger, ambigu, jeton absent/faux, PID recyclé et contrôle perdu', (t) => {
  const b = banc(t), r = b.reserver(); b.revendiquer(r)
  assert.throws(() => b.sessions.demanderArret('ailleurs', r.jeton), /NON INSCRIT/)
  assert.throws(() => b.sessions.demanderArret('banc'), /JETON ABSENT/)
  assert.throws(() => b.sessions.demanderArret('banc', 'faux'), /JETON INCORRECT/)
  b.vivants.set(10, { pid: 10, creation: 'recycle' })
  assert.throws(() => b.sessions.demanderArret('banc', r.jeton), /PID RECYCLÉ/)
  b.vivants.delete(10)
  assert.throws(() => b.sessions.demanderArret('banc', r.jeton), /CONTRÔLE PERDU/)
  assert.equal(b.sessions.lister().cartes[0].etatMesure, 'orpheline')
  b.sessions.ecrireCarte({ sessionId: 'etrangere', producteur: 'autre', ticket: 111, nom: 'autre' })
  assert.throws(() => b.sessions.demanderArret('autre', r.jeton), /ÉTRANGÈRE/)
  assert.ok(b.sessions.lister().cartes.some((c) => c.sessionId === 'etrangere'))
  b.sessions.ecrireCarte({ sessionId: 'ambigue', producteur: 'autre', ticket: 2461, nom: 'autre2' })
  assert.throws(() => b.sessions.demanderArret('2461', r.jeton), /AMBIGUË/)
})

test('réservation bornée, nonce distinct, double revendication et collisions', (t) => {
  const b = banc(t), r = b.reserver()
  assert.notEqual(r.nonce, r.jeton)
  assert.throws(() => b.reserver(), /COLLISION/)
  assert.throws(() => b.reserver({ ticket: 2 }), /COLLISION/)
  assert.throws(() => b.sessions.revendiquer(r.carte.sessionId, 'faux', {}), /REVENDICATION/)
  b.revendiquer(r)
  assert.throws(() => b.revendiquer(r), /REVENDICATION/)
  const tardif = b.reserver({ ticket: 3, nom: 'tardif' })
  b.avance(61_000)
  assert.throws(() => b.revendiquer(tardif), /RÉSERVATION EXPIRÉE/)
  const reprise = b.reserver({ ticket: 3, nom: 'tardif' })
  assert.notEqual(reprise.carte.sessionId, tardif.carte.sessionId)
  assert.equal(b.sessions.lire(tardif.carte.sessionId).raison, 'RÉSERVATION EXPIRÉE')
})

test('réservation sans contrôleur fermée par capacité, même expirée, interdit claim tardif', async (t) => {
  for (const expiree of [false, true]) {
    const b = banc(t), r = b.reserver()
    if (expiree) { b.avance(61_000); b.sessions.lister() }
    await assert.rejects(b.sessions.fermer(r.carte.sessionId), /JETON ABSENT/)
    await assert.rejects(b.sessions.fermer(r.carte.sessionId, 'faux'), /JETON INCORRECT/)
    const fin = await b.sessions.fermer(r.carte.sessionId, r.jeton)
    assert.equal(fin.etat, 'fermee'); assert.equal(fin.carte.etat, 'fermee')
    assert.equal(fin.carte.codeEnveloppe, undefined)
    assert.equal(fin.carte.empreinteNonce, undefined)
    assert.equal(existsSync(join(b.dossier, `${r.carte.sessionId}.bootstrap`)), false)
    assert.throws(() => b.revendiquer(r), /REVENDICATION REFUSÉE/)
  }
})

test('attente démarrage observe revendication et fin naturelle ou libère absence contrôleur', async (t) => {
  const b = banc(t), r = b.reserver()
  b.revendiquer(r)
  assert.equal((await b.sessions.attenteDemarrage(r.carte.sessionId, r.jeton)).etat, 'vivante')
  b.sessions.sortie(r.carte.sessionId, { codeAgent: 0 }); b.vivants.clear()
  assert.equal((await b.sessions.attenteDemarrage(r.carte.sessionId, r.jeton)).etat, 'fermee')
  const absent = b.reserver({ ticket: 2, nom: 'absent' })
  assert.equal((await b.sessions.attenteDemarrage(absent.carte.sessionId, absent.jeton)).etat, 'echec-reservation')
  assert.equal(existsSync(join(b.dossier, `${absent.carte.sessionId}.bootstrap`)), false)
  assert.equal(b.sessions.lire(absent.carte.sessionId).codeEnveloppe, undefined)
})

test('démarrage sans reçu ou nonce étranger arrête le fils et attend le nettoyage du JobHost', async (t) => {
  for (const panne of ['absent', 'nonce']) {
    let arret = false
    const b = banc(t, { auSommeil: (sessions, vivants) => {
      const c = sessions.lire(id)
      if (c.etat !== 'arret-demande') return
      arret = true
      sessions.sortie(id, { codeAgent: null, arret: true }); vivants.clear()
    } })
    const r = b.reserver(), id = r.carte.sessionId; b.revendiquer(r)
    b.sessions.muter(id, (c) => { c.demarrageJusqua = 1100 })
    const path = join(b.dossier, `${id}.sessionstart`)
    if (panne === 'absent') rmSync(path)
    else { const recu = JSON.parse(readFileSync(path)); recu.nonce = 'f'.repeat(64); writeFileSync(path, JSON.stringify(recu)) }
    const c = await b.sessions.attenteDemarrage(id, r.jeton)
    assert.match(c.raison, new RegExp(panne === 'absent' ? 'REÇU SESSIONSTART ABSENT' : 'NONCE INCORRECT'))
    assert.equal(arret, true); assert.equal(c.etat, 'fermee'); assert.equal(c.issueSortie, 'echec')
    assert.equal(existsSync(join(b.dossier, `${id}.stop`)), true)
  }
})

test('sortie rapide sans reçu natif refuse le succès même avec revendication mesurée', async (t) => {
  const b = banc(t), r = b.reserver(), id = r.carte.sessionId
  b.revendiquer(r); rmSync(join(b.dossier, `${id}.sessionstart`))
  b.sessions.sortie(id, { codeAgent: 0 }); b.vivants.clear()
  const c = await b.sessions.attenteDemarrage(id, r.jeton)
  assert.match(c.raison, /REÇU SESSIONSTART ABSENT/)
  assert.equal(c.issueSortie, 'echec'); assert.equal(c.recuSessionStart, undefined)
})

test('contrôleur refuse une empreinte modifiée juste avant spawn et purge son contexte temporaire', async (t) => {
  const b = banc(t), r = b.reserver({ executable: b.fichiers.claude }), id = r.carte.sessionId
  b.revendiquer(r)
  fs.appendFileSync(join(b.dossier, 'scripts/hooks/bootstrap-conteneur.mjs'), '\n')
  let spawns = 0
  await assert.rejects(piloterAgent({ sessions: b.sessions, dossier: b.dossier, carte: b.sessions.lire(id), consigne: 'faire', lancer: () => { spawns++; throw new Error('spawn atteint') } }), /HOOKS : EMPREINTE CHANGÉE AVANT SPAWN/)
  assert.equal(spawns, 0)
  assert.equal(existsSync(join(b.dossier, `${id}.hook-context`)), false)
  assert.equal(existsSync(join(b.dossier, `${id}.sessionstart`)), false)
})

test('argsTerminal transporte valeurs arbitraires dans PowerShell réel sans interpolation', { skip: process.platform !== 'win32' }, (t) => {
  const b = banc(t), capture = join(b.dossier, "capture ; ' ‘ ’ “ ”.ps1"), sortie = join(b.dossier, 'capture.json')
  writeFileSync(capture, 'param($Node,$CommandLine,$Worktree)\n@{Node=$Node;CommandLine=$CommandLine;Worktree=$Worktree}|ConvertTo-Json -Compress|Set-Content -LiteralPath $Worktree -Encoding UTF8')
  const node = join(b.dossier, 'Node espace ; "quote"', 'node.exe'), commande = JSON.stringify(join(b.dossier, 'script ; apostrophe\' ‘ ’ “ ”', 'x'))
  const args = argsTerminal({ profil: 'profil ; spécial', nom: 'nom ; spécial', script: capture, node, commande, worktree: sortie })
  assert.equal(args[4], 'profil \\; spécial'); assert.equal(args[6], 'nom \\; spécial')
  assert.ok(args.includes('-EncodedCommand')); assert.ok(!args.includes('-File'))
  const debut = args.indexOf('powershell.exe')
  const vu = spawnSync(args[debut], args.slice(debut + 1), { encoding: 'utf8', windowsHide: true, timeout: 10_000 })
  assert.equal(vu.status, 0, vu.stderr); assert.equal(vu.error, undefined)
  assert.deepEqual(JSON.parse(readFileSync(sortie, 'utf8').replace(/^\uFEFF/, '')), { Node: node, CommandLine: commande, Worktree: sortie })
})

test('fermeture concurrente idempotente et fin naturelle refuse arrêt', (t) => {
  const b = banc(t), r = b.reserver(); b.revendiquer(r)
  const a = b.sessions.demanderArret('banc', r.jeton)
  assert.equal(b.sessions.demanderArret('10', r.jeton).demandeId, a.demandeId)
  b.sessions.sortie(r.carte.sessionId, { codeAgent: 0 })
  assert.throws(() => b.sessions.demanderArret('banc', r.jeton), /DÉJÀ SORTIE/)
})

test('attendre borne, rapporte et accuse consommation après sortie', async (t) => {
  const b = banc(t), r = b.reserver(); b.revendiquer(r)
  assert.equal((await b.sessions.attendre('banc', { timeoutMs: 100 })).etat, 'indeterminee')
  b.sessions.sortie(r.carte.sessionId, { codeAgent: 0, rapport: { resultat: 'ok' } })
  b.vivants.clear()
  const sortie = await b.sessions.attendre('banc', { timeoutMs: 100 })
  assert.equal(sortie.carte.rapport.resultat, 'ok')
  assert.ok(b.sessions.lire(r.carte.sessionId).consommeLe)
})

test('planAgent dérive l’argv Codex de la politique, envAgent retire les secrets, validerRapport juge forme et identité, lireJsonc tolère commentaires et virgules finales', (t) => {
  const b = banc(t)
  const carte = { sessionId: 'id', ticket: 2461, worktree: b.dossier, branche: 'chantier/2461', head: 'a'.repeat(40), agent: 'codex' }
  const politique = lirePolitique()
  const plan = planAgent(carte, { natif: b.fichiers.codex, consigne: 'faire', rapport: b.fichiers.rapport, schema: b.fichiers.schema, politique })
  assert.equal(plan.shell, false)
  assert.deepEqual(plan.args, ['-c', `model="${politique.model}"`, '-c', `model_reasoning_effort="${politique.reasoningEffort}"`, '-c', 'approval_policy="never"', '-c', 'sandbox_mode="danger-full-access"', '-c', 'features.hooks=true', '--dangerously-bypass-hook-trust', 'app-server', '--listen', 'stdio://'])
  for (const interdit of [/dangerously-bypass-approvals/, /^--add-dir$/, /^--sandbox$/, /^--approve-for-me$/, /^-p$/, /windows\.sandbox/, /network_access/]) assert.ok(!plan.args.some((a) => interdit.test(a)), String(interdit))
  assert.throws(() => planAgent(carte, { natif: 'codex.cmd', politique }), /NATIF/)
  for (const fautive of [{ ...politique, sandbox: 'workspace-write' }, { ...politique, profile: 'wfrp-agent' }, { ...politique, ignoreUserConfig: false }, { ...politique, reasoningEffort: 'banane' }, { ...politique, model: 'gpt-5' }]) assert.throws(() => planAgent(carte, { natif: 'codex.exe', consigne: 'faire', rapport: 'r', schema: 's', politique: fautive }), /POLITIQUE INVALIDE/)
  assert.equal(envAgent({ WFRP_SESSION_JETON: 'secret', WFRP_SESSION_REVENDICATION: 'nonce', CLAUDE_CODE_CHILD_SESSION: '1', OK: 'oui' }).OK, 'oui')
  assert.equal(Object.keys(envAgent({ WFRP_SESSION_JETON: 'secret', CLAUDE_CODE_CHILD_SESSION: '1' })).length, 0)
  assert.deepEqual(envAgent({ GH_TOKEN: 'feint', GITHUB_TOKEN: 'feint', OK: 'oui' }), { GH_TOKEN: 'feint', GITHUB_TOKEN: 'feint', OK: 'oui' })
  const rapport = { sessionId: 'id', ticket: 2461, worktree: b.dossier, atterrissage: 'b'.repeat(40), resume: 'fait' }
  assert.deepEqual(validerRapport(rapport, carte), { ok: true })
  assert.deepEqual(validerRapport({ ...rapport, atterrissage: null }, carte), { ok: true })
  const { atterrissage, ...sansAtterrissage } = rapport
  for (const fautif of [{ ...rapport, atterrissage: 'b'.repeat(7) }, { ...rapport, atterrissage: 'B'.repeat(40) }, { ...rapport, atterrissage: 'b'.repeat(64) }, { ...rapport, atterrissage: 5 }, { ...rapport, publier: true }, { ...rapport, head: atterrissage }, sansAtterrissage, { ...rapport, resume: 3 }, { ...rapport, ticket: '2461' }, { ...rapport, sessionId: 1 }, null]) assert.equal(validerRapport(fautif, carte).raison, 'RAPPORT INVALIDE', JSON.stringify(fautif))
  for (const change of [{ sessionId: 'autre' }, { ticket: 4 }, { worktree: join(b.dossier, 'autre') }]) assert.equal(validerRapport({ ...rapport, ...change }, carte).raison, 'RAPPORT ÉTRANGER', JSON.stringify(change))
  assert.deepEqual(lireJsonc('{"url":"https://x",/* commentaire */"a":1,}'), { url: 'https://x', a: 1 })
  assert.deepEqual(lireJsonc('{"url":"https://x",/* commentaire */"a":1,/* fin */}'), { url: 'https://x', a: 1 })
})

test('lanceur injecté : Codex sans fichier de profil, capacité une fois, bootstrap nonce consommé, refus natif avant WT, aucun argument jeton', async (t) => {
  const b = banc(t)
  const consigne = join(b.dossier, 'consigne.md'); writeFileSync(consigne, 'consigne réelle')
  const options = { ticket: 2461, nom: 'banc', agent: 'codex', worktree: b.dossier, consigne }
  let ouvert = 0, argv, env
  const gestes = {
    contexte: () => ({ racine: b.dossier, gitCommun: b.dossier, worktree: b.dossier, branche: 'chantier/2461', head: 'a'.repeat(40) }),
    terminal: () => ({ nom: 'PS', closeOnExit: 'graceful' }), natif: () => b.fichiers.codex, contrat: () => true, version: async () => true, protocole: () => true,
    sessionsDe: () => b.sessions, env: { WFRP_SESSION_JETON: 'ancien', GH_TOKEN: 'feint', GITHUB_TOKEN: 'feint' },
    lancerWT: (exe, args, opts) => { ouvert++; argv = args; env = opts.env; assert.equal(exe, 'wt.exe'); const c = b.sessions.lister().cartes.find((c) => c.nom === 'banc'); b.sessions.revendiquer(c.sessionId, undefined, { controleur: identite(10), jobHost: identite(30) }); return { status: 0 } },
  }
  await assert.rejects(lancerSession(options, { ...gestes, natif: () => { throw new Error('AGENT NATIF ABSENT : banc') } }), /AGENT NATIF ABSENT/)
  assert.equal(ouvert, 0)
  const r = await lancerSession(options, gestes)
  assert.equal('profilExiste' in b.sessions.lire(r.sessionId), false)
  assert.ok(r.jeton); assert.ok(r.veille.includes('attendre'))
  assert.ok(!argv.join(' ').includes(r.jeton)); assert.ok(argv.includes('0'))
  assert.equal(env.WFRP_SESSION_JETON, undefined); assert.equal(env.GH_TOKEN, 'feint'); assert.equal(env.GITHUB_TOKEN, 'feint')
  assert.equal(env.WFRP_SESSION_REVENDICATION, undefined)
  assert.equal(r.etat, 'vivante')
  assert.throws(() => readFileSync(join(b.dossier, `${r.sessionId}.bootstrap`)), /ENOENT/)
  assert.throws(() => optionsSession(['fermer', '2461', '--jeton', 'secret']), /OPTION REFUSÉE/)
})

test('fermer attend cleanup du host ; crash contrôleur avec agent vivant donne orpheline et refuse arrêt', async (t) => {
  const b = banc(t), r = b.reserver(); b.revendiquer(r)
  b.sessions.agentDemarre(r.carte.sessionId, identite(20))
  const ferme = b.sessions.fermer('banc', r.jeton, { timeoutMs: 100 })
  b.sessions.sortie(r.carte.sessionId, { codeAgent: 0, arret: true })
  b.vivants.delete(20); b.vivants.delete(10)
  assert.equal((await ferme).etat, 'indeterminee')
  b.vivants.delete(30)
  assert.equal(b.sessions.ackArret(r.carte.sessionId, b.sessions.lire(r.carte.sessionId).demandeId).codeEnveloppe, 0)
  const autre = b.reserver({ ticket: 2, nom: 'crash' }); b.vivants.set(10, identite(10)); b.vivants.set(20, identite(20)); b.vivants.set(30, identite(30)); b.revendiquer(autre)
  b.sessions.agentDemarre(autre.carte.sessionId, identite(20)); b.vivants.delete(10)
  assert.equal(b.sessions.lister().cartes.find((c) => c.nom === 'crash').etatMesure, 'orpheline')
  assert.throws(() => b.sessions.demanderArret('crash', autre.jeton), /CONTRÔLE PERDU/)
  assert.ok(b.vivants.has(20))
})

test('lanceur WT échoué conserve raison ; carte voisine inchangée', async (t) => {
  const b = banc(t), consigne = join(b.dossier, 'consigne.md'); writeFileSync(consigne, 'faire')
  b.sessions.ecrireCarte({ sessionId: 'voisine', producteur: '#2281', ticket: 50, nom: 'voisine', metier: { observation: 1 } })
  const avant = readFileSync(join(b.dossier, 'voisine.json'), 'utf8')
  await assert.rejects(lancerSession({ ticket: 2461, nom: 'banc', agent: 'claude', worktree: b.dossier, consigne }, {
    contexte: () => ({ racine: b.dossier, gitCommun: b.dossier, worktree: b.dossier, branche: 'chantier/2461', head: 'a'.repeat(40) }),
    terminal: () => ({ nom: 'PS' }), natif: () => b.fichiers.claude, contrat: () => true, sessionsDe: () => b.sessions, lancerWT: () => ({ error: new Error('refus banc'), status: null }), env: {},
  }), /WT SPAWN ÉCHOUÉ/)
  assert.match(b.sessions.lister().cartes.find((c) => c.nom === 'banc').raison, /refus banc/)
  assert.equal(readFileSync(join(b.dossier, 'voisine.json'), 'utf8'), avant)
})

test('lanceur : WT thrown libère nonce ; erreur après claim demande arrêt et attend host', async (t) => {
  for (const revendique of [false, true]) {
    let id, attenduHost = false
    const b = banc(t, { auSommeil: (sessions, vivants) => {
      if (!revendique) return
      const c = sessions.lire(id)
      assert.equal(c.etat, 'arret-demande')
      assert.ok(existsSync(join(b.dossier, `${id}.stop`)))
      assert.equal(c.issueSortie, undefined)
      assert.equal(c.codeEnveloppe, undefined)
      attenduHost = true
      sessions.sortie(id, { codeAgent: null, arret: true }); vivants.clear()
    } })
    const consigne = join(b.dossier, 'consigne.md'); writeFileSync(consigne, 'faire')
    await assert.rejects(lancerSession({ ticket: 2461, nom: 'banc', agent: 'claude', consigne }, {
      contexte: () => ({ racine: b.dossier, gitCommun: b.dossier, worktree: b.dossier, branche: 'chantier/2461', head: 'a'.repeat(40) }),
      terminal: () => ({ nom: 'PS' }), natif: () => b.fichiers.claude, contrat: () => true, sessionsDe: () => b.sessions, env: {},
      lancerWT: () => {
        id = b.sessions.lister().cartes.find((c) => c.nom === 'banc').sessionId
        if (revendique) { b.sessions.revendiquer(id, undefined, { controleur: identite(10), jobHost: identite(30) }); return { status: 1, stderr: 'erreur après claim' } }
        throw new Error('throw WT')
      },
    }), /WT SPAWN ÉCHOUÉ/)
    const c = b.sessions.lire(id)
    assert.equal(c.etat, revendique ? 'fermee' : 'echec-reservation')
    assert.equal(attenduHost, revendique)
    assert.equal(existsSync(join(b.dossier, `${id}.bootstrap`)), false)
    if (!revendique) { assert.match(c.raison, /throw WT/); assert.equal(c.codeEnveloppe, undefined) }
  }
})

test('lanceur : absence contrôleur échoue, claim rapide et sortie naturelle rapide observés', async (t) => {
  for (const mode of ['absent', 'vivante', 'sortie']) {
    const b = banc(t), consigne = join(b.dossier, 'consigne.md'); writeFileSync(consigne, 'faire')
    const lancement = lancerSession({ ticket: 2461, nom: 'banc', agent: 'claude', consigne }, {
      contexte: () => ({ racine: b.dossier, gitCommun: b.dossier, worktree: b.dossier, branche: 'chantier/2461', head: 'a'.repeat(40) }),
      terminal: () => ({ nom: 'PS' }), natif: () => b.fichiers.claude, contrat: () => true, sessionsDe: () => b.sessions, env: {},
      lancerWT: () => {
        const id = b.sessions.lister().cartes.find((c) => c.nom === 'banc').sessionId
        if (mode !== 'absent') b.sessions.revendiquer(id, undefined, { controleur: identite(10), jobHost: identite(30) })
        if (mode === 'sortie') { b.sessions.sortie(id, { codeAgent: 0 }); b.vivants.clear() }
        return { status: 0 }
      },
    })
    if (mode === 'absent') await assert.rejects(lancement, /DÉMARRAGE ÉCHOUÉ/)
    else assert.equal((await lancement).etat, mode === 'sortie' ? 'fermee' : 'vivante')
  }
})

test('raccord : WT zéro après fermeture sans claim refuse faux succès', async (t) => {
  const b = banc(t), consigne = join(b.dossier, 'consigne.md'); writeFileSync(consigne, 'faire')
  let reservation
  await assert.rejects(lancerSession({ ticket: 2461, nom: 'banc', agent: 'claude', consigne }, {
    contexte: () => ({ racine: b.dossier, gitCommun: b.dossier, worktree: b.dossier, branche: 'chantier/2461', head: 'a'.repeat(40) }),
    terminal: () => ({ nom: 'PS' }), natif: () => b.fichiers.claude, contrat: () => true, env: {},
    sessionsDe: () => ({ ...b.sessions, reserver: (p) => { reservation = b.sessions.reserver(p); return reservation } }),
    lancerWT: () => { b.sessions.demanderArret(reservation.carte.sessionId, reservation.jeton); return { status: 0 } },
  }), /DÉMARRAGE ÉCHOUÉ/)
})

test('raccord : WT erreur après claim conserve raison et événement unique après sortie superviseur', async (t) => {
  let id
  const b = banc(t, { auSommeil: (sessions, vivants) => {
    assert.equal(sessions.lire(id).etat, 'arret-demande')
    sessions.sortie(id, { codeAgent: null, arret: true, raison: undefined }); vivants.clear()
  } }), consigne = join(b.dossier, 'consigne.md'); writeFileSync(consigne, 'faire')
  await assert.rejects(lancerSession({ ticket: 2461, nom: 'banc', agent: 'claude', consigne }, {
    contexte: () => ({ racine: b.dossier, gitCommun: b.dossier, worktree: b.dossier, branche: 'chantier/2461', head: 'a'.repeat(40) }),
    terminal: () => ({ nom: 'PS' }), natif: () => b.fichiers.claude, contrat: () => true, env: {}, sessionsDe: () => b.sessions,
    lancerWT: () => { id = b.sessions.lister().cartes.find((c) => c.nom === 'banc').sessionId; b.sessions.revendiquer(id, undefined, { controleur: identite(10), jobHost: identite(30) }); return { status: 1, stderr: 'diagnostic WT original' } },
  }), /WT SPAWN ÉCHOUÉ/)
  const c = b.sessions.lire(id)
  assert.equal(c.etat, 'fermee'); assert.equal(c.raison, 'WT SPAWN : diagnostic WT original'); assert.equal(c.issueSortie, 'echec')
  assert.equal(c.evenements.filter((e) => e.type === 'échec').length, 1)
  assert.equal(c.evenements.filter((e) => e.type === 'clôture').length, 1)
})

test('profil WT JSONC default/override : never refusé, profil absent refusé', (t) => {
  const b = banc(t), chemin = join(b.dossier, 'settings.json')
  writeFileSync(chemin, '{ // mesure\n "defaultProfile":"id", "profiles":{"defaults":{"closeOnExit":"never"}, "list":[{"guid":"id","name":"PS"},{"guid":"autre","name":"Compatible","closeOnExit":"graceful"}]}}')
  assert.throws(() => profilTerminal({ chemin }), /INCOMPATIBLE/)
  assert.equal(profilTerminal({ chemin, nom: 'Compatible' }).closeOnExit, 'graceful')
  assert.throws(() => profilTerminal({ chemin, nom: 'inconnu' }), /ABSENT/)
})

test('JobHost réel borné : child neutre sort42, descendant nettoyé, host sort0', { skip: process.platform !== 'win32', timeout: 30_000 }, (t) => {
  const b = banc(t), fixture = join(b.dossier, 'neutre.mjs'), pids = join(b.dossier, 'pids.json')
  writeFileSync(fixture, `import {spawn} from 'node:child_process'; import fs from 'node:fs'; const enfant=spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{stdio:'inherit',shell:false}); fs.writeFileSync(${JSON.stringify(pids)},JSON.stringify({parent:process.pid,enfant:enfant.pid})); setTimeout(()=>process.exit(42),300);`)
  const commande = ligneControleur({ script: fixture, dossier: b.dossier, id: 'neutre' })
  const host = fileURLToPath(new URL('./session-process.ps1', import.meta.url))
  const vu = spawnSync('powershell.exe', ['-NoLogo', '-NoProfile', '-NonInteractive', '-File', host, '-Node', process.execPath, '-CommandLine', commande, '-Worktree', b.dossier, '-TimeoutMs', '10000'], { cwd: b.dossier, encoding: 'utf8', windowsHide: true, timeout: 20_000, env: envAgent(process.env) })
  assert.equal(vu.error, undefined, vu.error?.message)
  assert.equal(vu.status, 0, vu.stderr)
  assert.equal(vu.stderr, '', vu.stderr)
  const ids = JSON.parse(readFileSync(pids, 'utf8'))
  assert.equal(mesurerProcessus(ids.parent), null)
  assert.equal(mesurerProcessus(ids.enfant), null)
  console.log(`JOBHOST preuve : host=${vu.status}, parent=${ids.parent} absent, descendant=${ids.enfant} absent`)
})

test('JobHost erreurs contrôlées : image absente et timeout du child neutre rendent0 et nettoient', { skip: process.platform !== 'win32', timeout: 30_000 }, (t) => {
  const b = banc(t), fixture = join(b.dossier, 'bloque.mjs'), pids = join(b.dossier, 'pids.json')
  writeFileSync(fixture, `import fs from 'node:fs'; fs.writeFileSync(${JSON.stringify(pids)},JSON.stringify({pid:process.pid})); setInterval(()=>{},1000);`)
  const host = fileURLToPath(new URL('./session-process.ps1', import.meta.url))
  for (const node of [join(b.dossier, 'absent.exe'), process.execPath]) {
    const commande = ligneControleur({ node, script: fixture, dossier: b.dossier, id: 'neutre' })
    const vu = spawnSync('powershell.exe', ['-NoLogo', '-NoProfile', '-NonInteractive', '-File', host, '-Node', node, '-CommandLine', commande, '-Worktree', b.dossier, '-TimeoutMs', '3000'], { encoding: 'utf8', windowsHide: true, timeout: 15_000, env: envAgent(process.env) })
    assert.equal(vu.error, undefined)
    assert.equal(vu.status, 0)
    assert.match(vu.stderr, /session JobHost/)
    if (node === process.execPath) { const ids = JSON.parse(readFileSync(pids, 'utf8')); assert.equal(mesurerProcessus(ids.pid), null); console.log(`JOBHOST erreur preuve : host=0, child=${ids.pid} absent après timeout`) }
  }
})

test('JobHost crash : fermeture du handle host tue la descendance kernel sans arrêt par PID', { skip: process.platform !== 'win32', timeout: 30_000 }, async (t) => {
  const b = banc(t), fixture = join(b.dossier, 'crash-host.mjs'), pids = join(b.dossier, 'pids.json')
  writeFileSync(fixture, `import fs from 'node:fs'; import {spawn} from 'node:child_process'; const enfant=spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{stdio:'inherit',shell:false}); fs.writeFileSync(${JSON.stringify(pids)},JSON.stringify({parent:process.pid,enfant:enfant.pid})); setInterval(()=>{},1000);`)
  const commande = ligneControleur({ script: fixture, dossier: b.dossier, id: 'neutre' }), host = fileURLToPath(new URL('./session-process.ps1', import.meta.url))
  const child = spawn('powershell.exe', ['-NoLogo', '-NoProfile', '-NonInteractive', '-File', host, '-Node', process.execPath, '-CommandLine', commande, '-Worktree', b.dossier, '-TimeoutMs', '10000'], { encoding: 'utf8', stdio: 'ignore', windowsHide: true, env: envAgent(process.env) })
  const fin = new Promise((ok, non) => { child.once('error', non); child.once('exit', ok) })
  t.after(() => child.kill())
  let ids
  for (let i = 0; i < 100; i++) { try { ids = JSON.parse(readFileSync(pids, 'utf8')); break } catch { await new Promise((r) => setTimeout(r, 50)) } }
  assert.ok(ids, 'fixture neutre démarrée')
  child.kill(); await fin
  assert.equal(mesurerProcessus(ids.parent), null)
  assert.equal(mesurerProcessus(ids.enfant), null)
  console.log(`JOBHOST crash preuve : parent=${ids.parent} absent, descendant=${ids.enfant} absent`)
})

test('exécutable natif Codex résolu depuis le shim npm comme le lanceur ; ambiguïté et absence refusées', (t) => {
  const b = banc(t), triples = { x64: 'x86_64-pc-windows-msvc', arm64: 'aarch64-pc-windows-msvc' }
  const installer = (nom, { plateforme = 'imbrique', arch = 'x64', exe = true } = {}) => {
    const racine = join(b.dossier, nom), paquet = join(racine, 'node_modules', '@openai', 'codex')
    mkdirSync(paquet, { recursive: true }); writeFileSync(join(paquet, 'package.json'), '{"name":"@openai/codex"}'); writeFileSync(join(racine, 'codex.cmd'), '')
    const dossierPlateforme = { imbrique: join(paquet, 'node_modules', '@openai', `codex-win32-${arch}`), hisse: join(racine, 'node_modules', '@openai', `codex-win32-${arch}`) }[plateforme]
    if (dossierPlateforme) { mkdirSync(dossierPlateforme, { recursive: true }); writeFileSync(join(dossierPlateforme, 'package.json'), '{}') }
    const binaire = join(dossierPlateforme ?? paquet, 'vendor', triples[arch], 'bin', 'codex.exe')
    if (exe) { mkdirSync(join(binaire, '..'), { recursive: true }); writeFileSync(binaire, '') }
    return { shim: join(racine, 'codex.cmd'), binaire }
  }
  const where = (vus) => (exe, args, options) => { assert.equal(exe, 'where.exe'); assert.ok(options.timeout <= 10_000); const v = vus[args[0]]; return v ? { status: 0, stdout: `${v.join('\r\n')}\r\n` } : { status: 1, stdout: '' } }
  const meme = (a, z) => assert.equal(fs.realpathSync(a), fs.realpathSync(z))
  const imbrique = installer('imbrique'), hisse = installer('hisse', { plateforme: 'hisse', arch: 'arm64' }), repli = installer('repli', { plateforme: null }), vide = installer('vide', { exe: false })
  meme(executableNatif('codex', undefined, where({ 'codex.cmd': [imbrique.shim] }), { arch: 'x64' }), imbrique.binaire)
  meme(executableNatif('codex', undefined, where({ 'codex.cmd': [hisse.shim] }), { arch: 'arm64' }), hisse.binaire)
  meme(executableNatif('codex', undefined, where({ 'codex.cmd': [repli.shim] }), { arch: 'x64' }), repli.binaire)
  assert.equal(executableNatif('codex', undefined, where({ 'codex.exe': [imbrique.binaire], 'codex.cmd': [repli.shim] }), { arch: 'x64' }), imbrique.binaire)
  assert.throws(() => executableNatif('codex', undefined, where({ 'codex.cmd': [vide.shim] }), { arch: 'x64' }), /AGENT NATIF ABSENT/)
  assert.throws(() => executableNatif('codex', undefined, where({}), { arch: 'x64' }), /AGENT NATIF ABSENT/)
  assert.throws(() => executableNatif('codex', undefined, where({ 'codex.cmd': [imbrique.shim, repli.shim] }), { arch: 'x64' }), /AGENT NATIF AMBIGU/)
  assert.throws(() => executableNatif('codex', undefined, where({ 'codex.cmd': [imbrique.shim] }), { arch: 'ia32' }), /AGENT NATIF ABSENT/)
  assert.throws(() => executableNatif('claude', undefined, where({ 'claude.cmd': [imbrique.shim] }), { arch: 'x64' }), /AGENT NATIF ABSENT : claude\.exe/)
})

test('consigne Codex : le contrat ne porte que la phrase du rapport et suit la consigne humaine', () => {
  const carte = { sessionId: 'id-1', ticket: 2501, worktree: 'W', agent: 'codex' }
  const contrat = contratCodex({ sessionId: 'id-1', ticket: 2501, worktree: 'W' })
  assert.equal(contrat, "Rapport final JSON : sessionId=id-1, ticket=2501, worktree=W ; atterrissage = sha du commit d'atterrissage sur main si ta publication est MERGED, sinon null ; resume décrit le résultat.")
  for (const absent of ['réseau', 'Interdits', 'ops:publier']) assert.ok(!contrat.includes(absent), absent)
  const consigne = consigneAgent(carte, 'Ouvre le chantier et publie.')
  assert.ok(consigne.startsWith('Ouvre le chantier et publie.')); assert.ok(consigne.endsWith(contrat))
  assert.equal(consigneAgent({ ...carte, agent: 'claude' }, 'Ouvre le chantier et publie.'), 'Ouvre le chantier et publie.')
})

test('rapport : worktree comparé sans casse ni sens des barres sous win32', { skip: process.platform !== 'win32' }, (t) => {
  const b = banc(t), carte = { sessionId: 'id', ticket: 2461, worktree: b.dossier }
  const rapport = { sessionId: 'id', ticket: 2461, worktree: b.dossier.toUpperCase().replaceAll('\\', '/'), atterrissage: null, resume: 'fait' }
  assert.equal(validerRapport(rapport, carte).ok, true)
  assert.equal(validerRapport({ ...rapport, worktree: join(b.dossier, 'autre') }, carte).raison, 'RAPPORT ÉTRANGER')
})

test('Codex : stderr relayé à l’onglet et journalisé ; sortie non nulle nommée dans la carte avec sa cause ; Claude garde le terminal', async (t) => {
  const b = banc(t), r = b.reserver({ agent: 'codex' }); b.revendiquer(r)
  const journal = join(b.dossier, `${r.carte.sessionId}.stderr`), echo = []
  const plan = { executable: process.execPath, args: ['-e', "process.stderr.write('bruit\\n\\nerror: the argument --sandbox cannot be used with --approve-for-me\\n'); process.exit(2)"] }
  let cause
  const fin = await b.sessions.superviser(r.carte.sessionId, {
    lancer: (carte) => { const agent = lancerAgent(plan, carte, { journal, echo: (m) => echo.push(String(m)) }); cause = agent.cause; return agent.child },
    causeSortie: () => cause(), lireRapport: () => assert.fail('rapport lu'), periodeMs: 1,
  })
  assert.equal(fin.codeAgent, 2); assert.equal(fin.issueSortie, 'echec')
  assert.equal(b.sessions.lire(r.carte.sessionId).raison, 'AGENT SORTI EN 2 : bruit · error: the argument --sandbox cannot be used with --approve-for-me')
  assert.match(echo.join(''), /cannot be used with/); assert.match(readFileSync(journal, 'utf8'), /cannot be used with/)
  const stdio = (agent) => { let vu; lancerAgent(plan, { agent, worktree: b.dossier }, { journal, lancer: (exe, args, options) => { vu = options.stdio; return new EventEmitter() } }); return vu }
  assert.equal(stdio('claude'), 'inherit'); assert.deepEqual(stdio('codex'), ['inherit', 'inherit', 'pipe'])
})

test('supervision Codex : spawn échoué, arrêt via handle, sortie non nulle ; rapport invalide nommé, rapport valide posé avec son atterrissage ; aucune publication', async (t) => {
  for (const cas of ['spawn', 'error-event', 'arret', 'nonzero', 'rapport', 'atterri', 'non-atterri']) {
    const b = banc(t), r = b.reserver({ agent: 'codex' }); b.revendiquer(r)
    const child = new EventEmitter(); child.pid = 20
    let kills = 0, lectures = 0
    const rapport = { sessionId: r.carte.sessionId, ticket: 2461, worktree: b.dossier, atterrissage: cas === 'atterri' ? 'b'.repeat(40) : null, resume: 'fait' }
    child.kill = () => { kills++; b.vivants.delete(20); queueMicrotask(() => child.emit('exit', null, 'SIGTERM')); return true }
    const promesse = b.sessions.superviser(r.carte.sessionId, {
      lancer: () => { if (cas === 'spawn') throw new Error('spawn refusé'); return child },
      lireRapport: () => { lectures++; return cas === 'rapport' ? { ...rapport, publier: true } : rapport },
      periodeMs: 1,
    })
    if (cas === 'arret') b.sessions.demanderArret('banc', r.jeton)
    else if (cas === 'error-event') queueMicrotask(() => child.emit('error', new Error('spawn async refusé')))
    else if (cas !== 'spawn') { b.vivants.delete(20); queueMicrotask(() => child.emit('exit', cas === 'nonzero' ? 9 : 0, null)) }
    const fin = await promesse
    assert.equal(fin.codeEnveloppe, 0)
    assert.equal(kills, cas === 'arret' ? 1 : 0)
    assert.equal(lectures, ['rapport', 'atterri', 'non-atterri'].includes(cas) ? 1 : 0)
    assert.equal('publication' in fin, false)
    if (cas === 'rapport') { assert.equal(fin.raison, 'RAPPORT INVALIDE'); assert.equal(fin.issueSortie, 'echec'); assert.equal(fin.rapport, undefined) }
    if (['atterri', 'non-atterri'].includes(cas)) { assert.deepEqual(b.sessions.lire(r.carte.sessionId).rapport, rapport); assert.equal(fin.issueSortie, 'sortie'); assert.equal(fin.raison, undefined) }
  }
})

test('supervision Codex : rapport absent ou JSON illisible sur sortie 0 nommés, jamais le message brut de Node', async (t) => {
  for (const cas of [{ contenu: null, attendu: 'RAPPORT ABSENT' }, { contenu: '{ casse', attendu: 'RAPPORT INVALIDE' }]) {
    const b = banc(t), r = b.reserver({ agent: 'codex' }); b.revendiquer(r)
    const chemin = join(b.dossier, `${r.carte.sessionId}.rapport`), child = new EventEmitter(); child.pid = 20; child.kill = () => true
    if (cas.contenu !== null) writeFileSync(chemin, cas.contenu)
    const promesse = b.sessions.superviser(r.carte.sessionId, { lancer: () => child, lireRapport: () => lireRapportDe(chemin), periodeMs: 1 })
    b.vivants.delete(20); queueMicrotask(() => child.emit('exit', 0, null))
    const fin = await promesse
    assert.equal(fin.codeAgent, 0); assert.equal(fin.issueSortie, 'echec'); assert.match(fin.raison, new RegExp(cas.attendu)); assert.equal(fin.rapport, undefined)
  }
})

test('supervision extrait la cause native sans reçu et garde le défaut du reçu séparément', async (t) => {
  for (const panne of ['absent', 'nonce']) for (const sortie of ['nonzero', 'rapport-invalide', 'rapport-valide']) {
    await t.test(`${panne}/${sortie}`, async (t) => {
    const b = banc(t), r = b.reserver({ agent: 'codex' }); b.revendiquer(r)
    const cheminRecu = join(b.dossier, `${r.carte.sessionId}.sessionstart`)
    if (panne === 'absent') rmSync(cheminRecu)
    else { const recu = JSON.parse(readFileSync(cheminRecu, 'utf8')); recu.nonce = 'f'.repeat(64); writeFileSync(cheminRecu, JSON.stringify(recu)) }
    const child = new EventEmitter(); child.pid = 20; child.kill = () => true
    let lectures = 0
    const rapport = { sessionId: r.carte.sessionId, ticket: 2461, worktree: b.dossier, atterrissage: null, resume: 'fait' }
    const promesse = b.sessions.superviser(r.carte.sessionId, {
      lancer: () => child, causeSortie: async () => 'cause secondaire de sortie',
      lireRapport: () => { lectures++; return sortie === 'rapport-invalide' ? { ...rapport, inconnu: true } : rapport },
      periodeMs: 1,
    })
    b.vivants.delete(20); queueMicrotask(() => child.emit('exit', sortie === 'nonzero' ? 9 : 0, null))
    const fin = await promesse
    const defautRecu = panne === 'absent' ? 'REÇU SESSIONSTART ABSENT' : 'REÇU SESSIONSTART NONCE INCORRECT'
    assert.equal(fin.raison, sortie === 'nonzero' ? 'AGENT SORTI EN 9 : cause secondaire de sortie' : defautRecu, `${panne}/${sortie}`)
    if (sortie === 'nonzero') assert.ok(fin.observations.includes(defautRecu))
    assert.equal(fin.issueSortie, 'echec'); assert.equal(fin.rapport, undefined); assert.equal(lectures, 0)
    assert.equal(b.sessions.lire(r.carte.sessionId).rapport, undefined)
    })
  }
})

test('supervision avec reçu natif valide conserve preuve et rapport normaux', async (t) => {
  const b = banc(t), r = b.reserver({ agent: 'codex' }); b.revendiquer(r)
  const child = new EventEmitter(); child.pid = 20; child.kill = () => true
  const rapport = { sessionId: r.carte.sessionId, ticket: 2461, worktree: b.dossier, atterrissage: null, resume: 'fait' }
  const promesse = b.sessions.superviser(r.carte.sessionId, { lancer: () => child, lireRapport: () => rapport, periodeMs: 1 })
  b.vivants.delete(20); queueMicrotask(() => child.emit('exit', 0, null))
  const fin = await promesse
  assert.equal(fin.raison, undefined); assert.equal(fin.issueSortie, 'sortie'); assert.deepEqual(fin.rapport, rapport)
  assert.equal(fin.recuSessionStart.nativeSessionId, 'native-banc')
})

test('rapport : le schéma est la seule source ; un mot-clé hors de l’interprète lève', () => {
  const schema = JSON.parse(readFileSync(new URL('./session-report.schema.json', import.meta.url), 'utf8'))
  const conforme = validateurDeSchema(schema), rapport = { sessionId: 'id', ticket: 1, worktree: 'W', atterrissage: null, resume: 'fait' }
  assert.equal(conforme(rapport), true); assert.equal(conforme({ ...rapport, atterrissage: 'a'.repeat(40) }), true)
  for (const fautif of [{ ...rapport, atterrissage: 'a'.repeat(39) }, { ...rapport, ticket: 1.5 }, { ...rapport, autre: 1 }, { ...rapport, resume: null }, [], 'texte']) assert.equal(conforme(fautif), false, JSON.stringify(fautif))
  assert.equal(validateurDeSchema({ ...schema, required: [...schema.required, 'publier'] })(rapport), false)
  for (const inconnu of [{ type: 'toString' }, { type: ['string', 'constructor'] }, { ...schema, properties: { ...schema.properties, x: false } }, true, [], null, 3, { ...schema, minProperties: 1 }, { ...schema, properties: { ...schema.properties, resume: { type: 'string', format: 'uri' } } }, { type: 'number' }, { ...schema, additionalProperties: true }]) assert.throws(() => validateurDeSchema(inconnu), /SCHÉMA HORS INTERPRÈTE/, JSON.stringify(inconnu))
})

test('contrôleur : le pont conserve la carte et le rapport entre tours, transporte contexte et diagnostic', async (t) => {
  const b = banc(t), r = b.reserver({ agent: 'codex', executable: b.fichiers.codex }), id = r.carte.sessionId
  b.revendiquer(r)
  const rapport = { sessionId: id, ticket: 2461, worktree: b.dossier, atterrissage: null, resume: 'fait' }
  let terminer, notification
  const travail = piloterAgent({ sessions: b.sessions, dossier: b.dossier, carte: b.sessions.lire(id), consigne: 'faire', pont: ({ plan, carte, dossier, consigne, schema, env, notifier }) => {
    assert.ok(plan.args.includes('app-server')); assert.equal(carte.sessionId, id)
    assert.ok(consigne.includes('Rapport final JSON')); assert.ok(existsSync(schema))
    assert.equal(env.WFRP_SESSION_JETON, undefined)
    const contexte = JSON.parse(Buffer.from(env.WFRP_SESSION_START, 'base64').toString())
    assert.equal(contexte.sessionId, id)
    const child = new EventEmitter(); child.pid = 20
    terminer = () => child.emit('exit', 0, null)
    notification = notifier
    const journalDiagnostic = join(dossier, 'trace-du-pont.log')
    writeFileSync(journalDiagnostic, 'trace conservée')
    notifier({ etat: 'inactif', rapport, threadId: 'propre', dureeMs: 42, outils: 3, jetons: { totalTokens: 100 } })
    return { child, cause: async () => '', journalDiagnostic }
  } })
  let fin
  try {
    await new Promise((ok) => setImmediate(ok))
    assert.deepEqual(b.sessions.lire(id).rapport, rapport)
    assert.equal(b.sessions.lire(id).etat, 'vivante')
    assert.equal(b.sessions.lire(id).codex.etat, 'inactif')
    assert.throws(() => notification({ etat: 'inactif', rapport: { ...rapport, ticket: 4 } }), /RAPPORT ÉTRANGER/)
    assert.deepEqual(b.sessions.lire(id).rapport, rapport)
  } finally { terminer(); fin = await travail }
  assert.deepEqual(fin.rapport, rapport); assert.equal(fin.issueSortie, 'sortie')
  assert.equal(existsSync(join(b.dossier, `${id}.rapport`)), false)
  assert.equal(readFileSync(fin.journalDiagnostic, 'utf8'), 'trace conservée')
})

test('contrôleur : démarrage raté conserve stderr primaire, reçu absent secondaire et première cause', async (t) => {
  const b = banc(t), r = b.reserver({ agent: 'codex', executable: b.fichiers.codex }), id = r.carte.sessionId
  b.revendiquer(r)
  rmSync(join(b.dossier, `${id}.sessionstart`))
  const fin = await piloterAgent({ sessions: b.sessions, dossier: b.dossier, carte: b.sessions.lire(id), consigne: 'faire', pont: ({ dossier }) => {
    const child = new EventEmitter(); child.pid = 20
    const journalDiagnostic = join(dossier, 'diagnostic-du-transport.log')
    writeFileSync(journalDiagnostic, 'première erreur native')
    queueMicrotask(() => child.emit('exit', 2, null))
    return { child, cause: async () => 'première erreur native', journalDiagnostic }
  } })
  assert.equal(fin.raison, 'AGENT SORTI EN 2 : première erreur native')
  assert.ok(fin.observations.includes('REÇU SESSIONSTART ABSENT'))
  assert.equal(readFileSync(fin.journalDiagnostic, 'utf8'), 'première erreur native')
  b.vivants.clear()
  const apres = await b.sessions.echecDemarrage(id, r.jeton, 'REÇU SESSIONSTART ABSENT : observation tardive')
  assert.equal(apres.raison, fin.raison)
  assert.ok(apres.observations.includes('REÇU SESSIONSTART ABSENT : observation tardive'))
})

function runSessionJob(t, programme, timeoutMs) {
  const dossier = mkdtempSync(join(tmpdir(), 'session-job-run-')), script = join(dossier, 'worker.mjs'), sonde = join(dossier, 'run.ps1')
  t.after(() => rmSync(dossier, { recursive: true, force: true }))
  writeFileSync(script, programme)
  writeFileSync(sonde, [
    'param([string]$Cs, [string]$Node, [string]$Script, [string]$Tmp, [int]$TimeoutMs)',
    "$ErrorActionPreference = 'Stop'",
    '$env:TMP = $Tmp; $env:TEMP = $Tmp',
    'Add-Type -Path $Cs',
    '$chrono = [Diagnostics.Stopwatch]::StartNew(); $erreur = $null',
    'try { [SessionJob]::Run($Node, (\'"\' + $Node + \'" "\' + $Script + \'"\'), $Tmp, $TimeoutMs) } catch { $erreur = $_.Exception.GetBaseException().Message }',
    'ConvertTo-Json -Compress @{ ms = $chrono.ElapsedMilliseconds; erreur = $erreur }',
  ].join('\r\n'))
  const cs = fileURLToPath(new URL('../guards/lib/processusJob.cs', import.meta.url))
  const vu = spawnSync('powershell.exe', ['-NoLogo', '-NoProfile', '-NonInteractive', '-File', sonde, '-Cs', cs, '-Node', process.execPath, '-Script', script, '-Tmp', dossier, '-TimeoutMs', String(timeoutMs)], { encoding: 'utf8', windowsHide: true, timeout: 60_000 })
  assert.equal(vu.error, undefined, vu.error?.message)
  assert.equal(vu.status, 0, vu.stderr)
  return { dossier, ...JSON.parse(vu.stdout) }
}

test('SessionJob.Run lève ETIMEDOUT à l\'échéance du worker au lieu de rendre normalement', { skip: process.platform !== 'win32', timeout: 60_000 }, (t) => {
  const vu = runSessionJob(t, 'setTimeout(() => {}, 10_000)', 500)
  assert.equal(vu.erreur, 'ECLOTURE ETIMEDOUT Node controller timeout')
  assert.ok(vu.ms < 5000, `Run rendu en ${vu.ms} ms`)
})

test('JobHost : le Job tient la descendance détachée du worker et la vide sous la borne de clôture de 2000 ms', { skip: process.platform !== 'win32', timeout: 60_000 }, (t) => {
  const vu = runSessionJob(t, `import { spawn } from 'node:child_process'; import fs from 'node:fs'; import { join, dirname } from 'node:path'; import { fileURLToPath } from 'node:url'; const dossier = dirname(fileURLToPath(import.meta.url)); const publier = 'require("fs").writeFileSync(require("path").join(process.argv[1], process.argv[2] + ".json"), JSON.stringify({ pid: process.pid, naissance: performance.timeOrigin }))'; spawn(process.execPath, ['-e', publier + '; setInterval(() => {}, 1000)', dossier, 'enfant'], { detached: true, stdio: 'ignore' }).unref(); fs.writeFileSync(join(dossier, 'worker.json'), JSON.stringify({ pid: process.pid, naissance: performance.timeOrigin })); setInterval(() => {}, 1000)`, 5000)
  assert.equal(vu.erreur, 'ECLOTURE ETIMEDOUT Node controller timeout')
  assert.ok(vu.ms < 5000 + 2000 + 1500, `Run rendu en ${vu.ms} ms`)
  for (const nom of ['worker', 'enfant']) {
    const { pid, naissance } = JSON.parse(readFileSync(join(vu.dossier, `${nom}.json`), 'utf8'))
    assert.equal(estPidVivantDepuis(pid, naissance, IDENTITE_MESUREE), false, nom)
  }
})

test('politique : schéma strict lu une fois ; sandbox et approbation à leur seule valeur prouvée ; clé inconnue, réseau, profil et type faux refusés', (t) => {
  const b = banc(t), chemin = join(b.dossier, 'politique.json')
  const valide = { sandbox: 'danger-full-access', approvalPolicy: 'never', model: 'gpt-6.1-sol', reasoningEffort: 'medium' }
  const sans = (cle) => Object.fromEntries(Object.entries(valide).filter(([k]) => k !== cle))
  assert.deepEqual(Object.keys(lirePolitique()).sort(), Object.keys(valide).sort())
  writeFileSync(chemin, JSON.stringify(valide)); assert.deepEqual(lirePolitique(chemin), valide)
  for (const fautive of [{ ...valide, sandbox: 'workspace-write' }, { ...valide, sandbox: 'read-only' }, { ...valide, inconnue: 1 }, { ...valide, profile: 'wfrp-agent' }, { ...valide, networkAccess: false }, { ...valide, windowsSandbox: 'elevated' }, { ...valide, ignoreUserConfig: 'true' }, { ...valide, ignoreUserConfig: false }, { ...valide, reasoningEffort: 'banane' }, { ...valide, model: 'gpt-5' }, { sandbox: 'danger-full-access' }, sans('model'), sans('reasoningEffort'), { ...valide, model: '' }, { ...valide, reasoningEffort: 'Moyen!' }, { ...valide, approvalPolicy: 'on-request' }, { ...valide, approveForMe: true }, sans('approvalPolicy')]) {
    writeFileSync(chemin, JSON.stringify(fautive)); assert.throws(() => lirePolitique(chemin), /POLITIQUE INVALIDE/, JSON.stringify(fautive))
  }
})

test('correction 2 : lancer consigne relative, Claude défaut depuis main, Codex hors chantier comme Claude, worktree absent refusé aux deux', async (t) => {
  const b = banc(t), consigne = join(b.dossier, '2461.md'); writeFileSync(consigne, 'ouvrir le chantier'); writeFileSync(join(b.dossier, '2462.md'), 'ouvrir le chantier')
  const options = optionsSession(['lancer', '2461.md'])
  let wt = 0
  const gestes = {
    cwd: b.dossier, contexte: (worktree) => ({ racine: b.dossier, gitCommun: b.dossier, worktree, branche: 'main', head: 'a'.repeat(40) }),
    terminal: () => ({ nom: 'PS' }), natif: () => b.fichiers.claude, contrat: () => true, version: async () => true, protocole: () => true,
    sessionsDe: () => b.sessions, lancerWT: () => { wt++; const c = b.sessions.lister().cartes.find((c) => c.etat === 'reservee'); b.sessions.revendiquer(c.sessionId, undefined, { controleur: identite(10), jobHost: identite(30) }); return { status: 0 } }, env: {},
  }
  const r = await lancerSession(options, gestes), c = b.sessions.lire(r.sessionId)
  assert.equal(c.agent, 'claude'); assert.equal(c.nom, 's2461'); assert.equal(c.ticket, 2461); assert.equal(c.worktree, b.dossier); assert.equal(c.branche, 'main')
  assert.equal(wt, 1)
  assert.throws(() => optionsSession(['lancer', 'lettre.md']), /TICKET/)
  assert.equal(optionsSession(['lancer', 'lettre.md', '--ticket', '3']).ticket, 3)
  const accepte = { ticket: 2462, consigne: '2462.md', nom: 's2462', agent: 'codex' }, absent = { ticket: 2463, consigne: '2463.md', nom: 's2463', worktree: 'absent' }
  for (const cas of [accepte, { ...absent, agent: 'claude' }, { ...absent, agent: 'codex' }]) {
    const lancement = lancerSession(cas, { ...gestes, natif: () => b.fichiers[cas.agent] })
    if (cas.worktree) await assert.rejects(lancement, /WORKTREE ABSENT/, cas.agent)
    else { const carteCodex = b.sessions.lire((await lancement).sessionId); assert.equal(carteCodex.agent, 'codex'); assert.equal(carteCodex.branche, 'main'); assert.equal(carteCodex.worktree, b.dossier) }
    assert.equal(wt, 2)
  }
})

test('correction 3 : historique ne rend pas le ticket ambigu ; attendre dernière sortie', async (t) => {
  const b = banc(t), ancien = b.reserver(); b.revendiquer(ancien); b.sessions.sortie(ancien.carte.sessionId, { codeAgent: 0 }); b.vivants.clear()
  b.avance(1)
  const nouveau = b.reserver(); b.vivants.set(10, identite(10)); b.vivants.set(30, identite(30)); b.revendiquer(nouveau)
  const ferme = b.sessions.demanderArret('2461', nouveau.jeton)
  assert.equal(ferme.sessionId, nouveau.carte.sessionId)
  assert.equal(b.sessions.lire(ancien.carte.sessionId).demandeId, undefined)
  b.sessions.sortie(nouveau.carte.sessionId, { codeAgent: 0, arret: true }); b.vivants.clear()
  assert.equal((await b.sessions.attendre('2461', { timeoutMs: 0 })).carte.sessionId, nouveau.carte.sessionId)
})

test('correction 4 : sortie locale n’autorise pas relance tant que host vivant', (t) => {
  const b = banc(t), r = b.reserver(); b.revendiquer(r); b.sessions.sortie(r.carte.sessionId, { codeAgent: 0 })
  b.vivants.delete(10)
  assert.throws(() => b.reserver(), /COLLISION/)
  b.vivants.clear()
  assert.ok(b.reserver().carte.sessionId)
})

test('correction 5 : réconciliation clôture unique après cleanup ; expiration distincte', async (t) => {
  const b = banc(t), r = b.reserver(); b.revendiquer(r); b.sessions.sortie(r.carte.sessionId, { codeAgent: 0 })
  assert.equal(b.sessions.lister().evenements.filter((e) => e.type === 'clôture').length, 0)
  assert.equal(b.sessions.lire(r.carte.sessionId).etat, 'nettoyage')
  b.vivants.clear()
  const l = b.sessions.lister()
  assert.equal(l.evenements.filter((e) => e.type === 'clôture').length, 1)
  assert.equal(b.sessions.lire(r.carte.sessionId).etat, 'fermee')
  await b.sessions.attendre('banc', { timeoutMs: 0 })
  assert.equal(b.sessions.lister().evenements.filter((e) => e.type === 'clôture').length, 1)
  const expiree = b.reserver({ ticket: 8, nom: 'expiree' }); b.avance(61000)
  b.sessions.lister()
  const carte = b.sessions.lire(expiree.carte.sessionId)
  assert.equal(carte.etat, 'echec-reservation'); assert.equal(carte.codeEnveloppe, undefined)
  assert.equal(carte.evenements.filter((e) => e.type === 'clôture').length, 0)
  assert.equal(carte.evenements.filter((e) => e.type === 'échec').length, 1)
})

test('correction 6 : cartes null/tableau/propres invalides signalées, voisine visible intacte, mutations refusées', async (t) => {
  const b = banc(t), r = b.reserver()
  const invalides = { nul: null, tableau: [], mauvais: { producteur: 'ops:session', sessionId: 'mauvais', ticket: 'texte' } }
  for (const [id, carte] of Object.entries(invalides)) writeFileSync(join(b.dossier, `${id}.json`), JSON.stringify(carte))
  b.sessions.ecrireCarte({ sessionId: 'voisine', producteur: 'presence', champ: 'opaque' })
  const avant = readFileSync(join(b.dossier, 'voisine.json'), 'utf8')
  const liste = b.sessions.lister()
  assert.equal(liste.anomalies.length, 3)
  assert.deepEqual(liste.anomalies.map((a) => a.fichier).sort(), ['mauvais.json', 'nul.json', 'tableau.json'])
  assert.ok(liste.cartes.some((c) => c.sessionId === r.carte.sessionId))
  assert.ok(liste.cartes.some((c) => c.sessionId === 'voisine'))
  for (const id of Object.keys(invalides)) assert.throws(() => b.sessions.muter(id, () => {}), /CARTE INVALIDE/)
  assert.equal(readFileSync(join(b.dossier, 'voisine.json'), 'utf8'), avant)
  let sortie = ''
  assert.equal(await commandeSession(['lister'], { cwd: b.dossier, stdout: { write: (texte) => { sortie += texte } }, contexte: () => ({ gitCommun: b.dossier }), sessionsDe: () => b.sessions }), 0)
  for (const fichier of liste.anomalies.map((a) => a.fichier)) assert.ok(sortie.includes(`ANOMALIE : ${fichier}`))
})

test('correction 7 : existence exe insuffisante, contrat CLI injecté requis avant réserve/WT', async (t) => {
  const b = banc(t), consigne = join(b.dossier, '2461.md'); writeFileSync(consigne, 'faire')
  let wt = 0, contrats = 0
  const gestes = { cwd: b.dossier, contexte: () => ({ racine: b.dossier, gitCommun: b.dossier, worktree: b.dossier, branche: 'chantier/2461', head: 'a'.repeat(40) }), terminal: () => ({ nom: 'PS' }), natif: () => b.fichiers.codex, version: async () => true, protocole: () => true, sessionsDe: () => b.sessions, lancerWT: () => { wt++; return { status: 0 } }, env: {}, contrat: () => { contrats++; throw new Error('CONTRAT CLI INCOMPATIBLE') } }
  await assert.rejects(lancerSession({ ticket: 2461, consigne, nom: 'banc', agent: 'codex', worktree: b.dossier }, gestes), /CONTRAT CLI INCOMPATIBLE/)
  assert.equal(contrats, 1); assert.equal(wt, 0); assert.equal(b.sessions.lister().cartes.length, 0)
  const requis = ['--dangerously-bypass-hook-trust', '--config', '--listen']
  const executer = (omis) => (exe, args, options) => { assert.equal(exe, b.fichiers.codex); assert.equal(options.shell, false); assert.ok(options.timeout <= 10000); return { status: 0, stdout: args[0] === '--version' ? 'codex-cli 0.163.0' : args[0] === '--help' ? `Commands: app-server\n${requis.filter((x) => x !== '--listen' && x !== omis).join('\n')}` : omis === '--listen' ? '' : '--listen' } }
  verifierContratAgent('codex', b.fichiers.codex, { executer: executer(), env: {} })
  for (const omis of requis) assert.throws(() => verifierContratAgent('codex', b.fichiers.codex, { executer: executer(omis), env: {} }), new RegExp(`CONTRAT CLI INCOMPATIBLE : ${omis}`))
  assert.throws(() => verifierContratAgent('codex', b.fichiers.codex, { executer: (exe, args) => ({ status: 0, stdout: args[0] === '--version' ? 'codex-cli 0.163.0' : args[0] === '--help' ? `Commands: review\n${requis.join('\n')}` : requis.join('\n') }), env: {} }), /CONTRAT CLI INCOMPATIBLE : app-server/)
})

test('snapshot OS unique par passe pour plusieurs dizaines de cartes historiques', (t) => {
  const b = banc(t)
  for (let i = 0; i < 30; i++) { const r = b.reserver({ ticket: i + 1, nom: `s${i}` }); b.revendiquer(r); b.sessions.sortie(r.carte.sessionId, { codeAgent: 0 }); b.vivants.clear(); b.sessions.lister(); b.vivants.set(10, identite(10)); b.vivants.set(30, identite(30)) }
  let snapshots = 0, sondes = 0
  const sessions = creerSessions({ dossier: b.dossier, horloge: () => 2000, inventaire: () => { snapshots++; return [] }, processus: () => { sondes++; return null } })
  assert.equal(sessions.lister().cartes.length, 30)
  assert.equal(snapshots, 1); assert.equal(sondes, 0)
})

test('mesure hors verrou : réconciliation, revendication et arrêt laissent projeter Codex', (t) => {
  const b = banc(t), r = b.reserver({ agent: 'codex' })
  let snapshots = 0
  const sessions = creerSessions({ dossier: b.dossier, horloge: () => 2000, inventaire: () => {
    assert.equal(existsSync(join(b.dossier, 'registre.lock')), false, 'inventaire sans registre.lock')
    b.sessions.projectionCodex(r.carte.sessionId, { seq: ++snapshots })
    return [...b.vivants.values()]
  } })
  sessions.lister()
  sessions.revendiquer(r.carte.sessionId, r.nonce, { controleurPid: 10, jobHostPid: 30 })
  assert.equal(sessions.demanderArret(r.carte.sessionId, r.jeton).etat, 'arret-demande')
  assert.equal(snapshots, 3)
  assert.equal(sessions.lire(r.carte.sessionId).codex.seq, 3)
})

test('mesure périmée : naissance, revendication et changements de chaque identité restent indéterminés', (t) => {
  for (const changement of ['naissance', 'revendication', 'controleur', 'jobHost', 'agentProcessus', 'creation', 'absence']) {
    const b = banc(t), r = b.reserver()
    if (!['naissance', 'revendication'].includes(changement)) { b.revendiquer(r); b.sessions.agentDemarre(r.carte.sessionId, identite(20)) }
    let id = r.carte.sessionId, premiere = true
    const sessions = creerSessions({ dossier: b.dossier, horloge: () => 2000, inventaire: () => {
      if (!premiere) return [...b.vivants.values()]
      premiere = false
      if (changement === 'naissance') { const neuve = b.reserver({ ticket: 2462, nom: 'neuve' }); b.revendiquer(neuve); id = neuve.carte.sessionId }
      else if (changement === 'revendication') b.revendiquer(r)
      else b.sessions.muter(id, (c) => {
        if (changement === 'absence') delete c.agentProcessus
        else if (changement === 'creation') { c.jobHost = { pid: 30, creation: 'nouvelle-date' }; b.vivants.set(30, c.jobHost) }
        else { c[changement] = identite(40); b.vivants.set(40, identite(40)) }
      })
      return []
    } })
    const vu = sessions.lister().cartes.find((c) => c.sessionId === id)
    assert.equal(vu.etat, 'vivante', changement)
    assert.equal(vu.etatMesure, 'indeterminee', changement)
    assert.equal(vu.evenements.some((e) => ['échec', 'clôture'].includes(e.type)), false, changement)
    assert.equal(sessions.lister().cartes.find((c) => c.sessionId === id).etatMesure, 'vivante', changement)
  }
})

test('mesure périmée : arrêt refuse une identité changée et nettoyage attend une mesure fraîche', (t) => {
  for (const nettoyage of [false, true]) {
    const b = banc(t), r = b.reserver(); b.revendiquer(r)
    if (nettoyage) b.sessions.sortie(r.carte.sessionId, { codeAgent: 0 })
    let premiere = true
    const sessions = creerSessions({ dossier: b.dossier, horloge: () => 2000, inventaire: () => {
      if (!premiere) return []
      premiere = false
      b.sessions.muter(r.carte.sessionId, (c) => { c.jobHost = identite(40) })
      return []
    } })
    if (nettoyage) {
      const c = sessions.lister().cartes[0]
      assert.equal(c.etat, 'nettoyage'); assert.equal(c.etatMesure, 'indeterminee')
      assert.equal(c.evenements.some((e) => e.type === 'clôture'), false)
      assert.equal(sessions.lister().cartes[0].etat, 'fermee')
    } else {
      assert.throws(() => sessions.demanderArret(r.carte.sessionId, r.jeton), /\[transitoire · retentable\]/)
      assert.equal(sessions.lire(r.carte.sessionId).etat, 'vivante')
      assert.equal(existsSync(join(b.dossier, `${r.carte.sessionId}.stop`)), false)
      assert.equal(sessions.lister().cartes[0].etat, 'echec-controle')
    }
  }
})

test('crash host : présence garde orpheline ; absence complète donne échec consommable sans code0 ni publication et libère slot', async (t) => {
  const b = banc(t), r = b.reserver(); b.revendiquer(r); b.sessions.agentDemarre(r.carte.sessionId, identite(20))
  b.vivants.delete(10); b.vivants.delete(30)
  assert.equal(b.sessions.lister().cartes[0].etatMesure, 'orpheline')
  assert.throws(() => b.sessions.demanderArret('banc', r.jeton), /CONTRÔLE PERDU/)
  assert.throws(() => b.reserver(), /COLLISION/)
  b.vivants.delete(20)
  const vu = await b.sessions.attendre('banc', { timeoutMs: 0 })
  assert.equal(vu.etat, 'echec-controle')
  assert.equal(vu.carte.etat, 'echec-controle')
  assert.match(vu.carte.raison, /contrôle perdu, sortie inconnue/)
  assert.equal(vu.carte.codeEnveloppe, undefined)
  assert.equal('publication' in vu.carte, false)
  assert.equal(vu.carte.evenements.filter((e) => e.type === 'clôture').length, 0)
  assert.equal(vu.carte.evenements.filter((e) => e.type === 'échec').length, 1)
  const suite = b.reserver(); assert.notEqual(suite.carte.sessionId, r.carte.sessionId)
  assert.equal(b.sessions.lister().evenements.filter((e) => e.type === 'échec').length, 1)
  let sortie = ''
  assert.equal(await commandeSession(['attendre', r.carte.sessionId], { cwd: b.dossier, stdout: { write: (texte) => { sortie += texte } }, contexte: () => ({ gitCommun: b.dossier }), sessionsDe: () => b.sessions }), 1)
  assert.ok(sortie.includes('echec-controle'))
})

test('inventaire : PID historique recyclé avec date différente reste Codex NON INSCRIT', (t) => {
  const b = banc(t), r = b.reserver(); b.revendiquer(r); b.sessions.agentDemarre(r.carte.sessionId, identite(20))
  b.sessions.sortie(r.carte.sessionId, { codeAgent: 0 }); b.vivants.clear(); b.sessions.lister()
  const recycle = { pid: 20, creation: 'autre-date', nom: 'codex.exe' }
  const sessions = creerSessions({ dossier: b.dossier, horloge: () => 2000, inventaire: () => [recycle] })
  const codex = sessions.lister().nonInscrits.find((p) => p.pid === 20)
  assert.ok(codex)
  assert.equal(codex.creation, 'autre-date'); assert.equal(codex.etatMesure, 'NON INSCRIT'); assert.equal(codex.stoppable, false)
})
