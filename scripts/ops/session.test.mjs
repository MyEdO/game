import test from 'node:test'
import fs from 'node:fs'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, rmSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { EventEmitter } from 'node:events'
import { spawnSync, spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { creerSessions, envAgent, planAgent, validerRapport, lireJsonc, ligneControleur, mesurerProcessus, publierSession } from './session-runtime.mjs'
import { lancerSession, optionsSession, profilTerminal, profilCodexExiste, verifierContratAgent, commandeSession, argsTerminal } from './session.mjs'
import { veillerLeTrain } from './publier.mjs'

const identite = (pid) => ({ pid, creation: `date-${pid}` })
function banc(t, { auSommeil = () => {} } = {}) {
  const dossier = mkdtempSync(join(process.env.WFRP_SESSION_TEST_FIXTURES ?? tmpdir(), 'sessions-'))
  t.after(() => rmSync(dossier, { recursive: true, force: true }))
  const fixtures = join(dossier, 'fixtures'); mkdirSync(fixtures)
  const fichiers = { codex: join(fixtures, 'codex.exe'), claude: join(fixtures, 'claude.exe'), rapport: join(fixtures, 'rapport.json'), schema: join(fixtures, 'schema.json') }
  for (const fichier of Object.values(fichiers)) writeFileSync(fichier, '')
  let maintenant = 1000
  const vivants = new Map([[10, identite(10)], [20, identite(20)], [30, identite(30)]])
  const sessions = creerSessions({ dossier, horloge: () => maintenant, processus: (pid) => vivants.get(pid) ?? null, inventaire: () => [...vivants.values(), { ...identite(99), nom: 'codex.exe' }], dormir: async () => { maintenant += 50; auSommeil(sessions, vivants) }, lanceur: () => identite(99) })
  const reserver = (p = {}) => sessions.reserver({ ticket: 2461, nom: 'banc', agent: 'claude', consigne: join(dossier, 'consigne.md'), worktree: dossier, racine: dossier, branche: 'chantier/2461', head: 'a'.repeat(40), ...p })
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

test('agent natif, politique Codex explicite, env secret retiré et rapport lié au Git mesuré', (t) => {
  const b = banc(t)
  const carte = { sessionId: 'id', ticket: 2461, worktree: b.dossier, branche: 'chantier/2461', head: 'a'.repeat(40), agent: 'codex' }
  const politique = JSON.parse(readFileSync(new URL('./session-policy.json', import.meta.url)))
  const plan = planAgent(carte, { natif: b.fichiers.codex, consigne: 'faire', gitCommun: join(b.dossier, '.git'), rapport: b.fichiers.rapport, schema: b.fichiers.schema, profilExiste: true, politique })
  assert.equal(plan.shell, false)
  assert.ok(plan.args.includes('sandbox_workspace_write.network_access=false'))
  assert.ok(plan.args.includes('--approve-for-me'))
  assert.throws(() => planAgent(carte, { natif: 'codex.cmd', profilExiste: true, politique }), /NATIF/)
  assert.throws(() => planAgent(carte, { natif: 'codex.exe', profilExiste: false, politique }), /PROFIL ABSENT/)
  assert.equal(envAgent({ WFRP_SESSION_JETON: 'secret', WFRP_SESSION_REVENDICATION: 'nonce', CLAUDE_CODE_CHILD_SESSION: '1', OK: 'oui' }).OK, 'oui')
  assert.equal(Object.keys(envAgent({ WFRP_SESSION_JETON: 'secret', CLAUDE_CODE_CHILD_SESSION: '1' })).length, 0)
  assert.deepEqual(envAgent({ GH_TOKEN: 'feint', GITHUB_TOKEN: 'feint', OK: 'oui' }), { OK: 'oui' })
  const rapport = { sessionId: 'id', ticket: 2461, worktree: b.dossier, head: carte.head, publier: true, resume: 'fait' }
  assert.equal(validerRapport(rapport, carte, { branche: carte.branche, head: carte.head, propre: true }).ok, true)
  for (const change of [{ head: 'b'.repeat(40) }, { sessionId: 'autre' }, { ticket: 4 }, { worktree: 'autre' }]) assert.equal(validerRapport({ ...rapport, ...change }, carte, { branche: carte.branche, head: carte.head, propre: true }).ok, false)
  assert.equal(validerRapport(rapport, carte, { branche: 'main', head: carte.head, propre: true }).ok, false)
  assert.equal(validerRapport(rapport, carte, { branche: carte.branche, head: carte.head, propre: false }).ok, false)
  assert.deepEqual(lireJsonc('{"url":"https://x",/* commentaire */"a":1,}'), { url: 'https://x', a: 1 })
  assert.deepEqual(lireJsonc('{"url":"https://x",/* commentaire */"a":1,/* fin */}'), { url: 'https://x', a: 1 })
})

test('lanceur injecté : capacité une fois, bootstrap nonce consommé, refus profil avant WT, aucun argument jeton', async (t) => {
  const b = banc(t)
  const consigne = join(b.dossier, 'consigne.md'); writeFileSync(consigne, 'consigne réelle')
  const options = { ticket: 2461, nom: 'banc', agent: 'codex', worktree: b.dossier, consigne }
  let ouvert = 0, argv, env
  const gestes = {
    contexte: () => ({ racine: b.dossier, gitCommun: b.dossier, worktree: b.dossier, branche: 'chantier/2461', head: 'a'.repeat(40) }),
    terminal: () => ({ nom: 'PS', closeOnExit: 'graceful' }), natif: () => b.fichiers.codex, profilExiste: () => true, contrat: () => true,
    sessionsDe: () => b.sessions, env: { WFRP_SESSION_JETON: 'ancien', GH_TOKEN: 'feint', GITHUB_TOKEN: 'feint' },
    lancerWT: (exe, args, opts) => { ouvert++; argv = args; env = opts.env; assert.equal(exe, 'wt.exe'); const c = b.sessions.lister().cartes.find((c) => c.nom === 'banc'); b.sessions.revendiquer(c.sessionId, undefined, { controleur: identite(10), jobHost: identite(30) }); return { status: 0 } },
  }
  await assert.rejects(lancerSession(options, { ...gestes, profilExiste: () => false }), /PROFIL ABSENT/)
  assert.equal(ouvert, 0)
  const r = await lancerSession(options, gestes)
  assert.ok(r.jeton); assert.ok(r.veille.includes('attendre'))
  assert.ok(!argv.join(' ').includes(r.jeton)); assert.ok(argv.includes('0'))
  assert.equal(env.WFRP_SESSION_JETON, undefined); assert.equal(env.GH_TOKEN, undefined); assert.equal(env.GITHUB_TOKEN, undefined)
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

test('raccord : claim entre snapshot et mutation ferme sur constat frais sous verrou', async (t) => {
  const b = banc(t, { auSommeil: (sessions, vivants) => {
    assert.equal(sessions.lire(id).etat, 'arret-demande')
    sessions.sortie(id, { codeAgent: null, arret: true }); vivants.clear()
  } }), r = b.reserver(), id = r.carte.sessionId
  b.vivants.delete(10); b.vivants.delete(30)
  const rm = fs.rmSync
  let intercale = false
  fs.rmSync = function (chemin, ...args) {
    const resultat = rm.call(this, chemin, ...args)
    if (!intercale && String(chemin) === join(b.dossier, 'registre.lock')) {
      intercale = true
      b.vivants.set(10, identite(10)); b.vivants.set(30, identite(30)); b.revendiquer(r)
    }
    return resultat
  }
  try { assert.equal((await b.sessions.fermer(id, r.jeton, { timeoutMs: 100 })).etat, 'sortie'); assert.ok(intercale) }
  finally { fs.rmSync = rm }
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

test('profil WT JSONC default/override : never refusé, profil absent refusé ; profil Codex local requis', (t) => {
  const b = banc(t), chemin = join(b.dossier, 'settings.json'), config = join(b.dossier, 'wfrp-agent.config.toml')
  writeFileSync(chemin, '{ // mesure\n "defaultProfile":"id", "profiles":{"defaults":{"closeOnExit":"never"}, "list":[{"guid":"id","name":"PS"},{"guid":"autre","name":"Compatible","closeOnExit":"graceful"}]}}')
  assert.throws(() => profilTerminal({ chemin }), /INCOMPATIBLE/)
  assert.equal(profilTerminal({ chemin, nom: 'Compatible' }).closeOnExit, 'graceful')
  assert.throws(() => profilTerminal({ chemin, nom: 'inconnu' }), /ABSENT/)
  assert.equal(profilCodexExiste({ chemin: config }), false)
  writeFileSync(config, 'sandbox_mode="workspace-write"\n')
  assert.equal(profilCodexExiste({ chemin: config }), true)
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
    const vu = spawnSync('powershell.exe', ['-NoLogo', '-NoProfile', '-NonInteractive', '-File', host, '-Node', node, '-CommandLine', commande, '-Worktree', b.dossier, '-TimeoutMs', '300'], { encoding: 'utf8', windowsHide: true, timeout: 15_000, env: envAgent(process.env) })
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

test('publication compose train et veille canonique, refuse exit0 sans MERGED ou journal étranger', async (t) => {
  const b = banc(t)
  for (const cas of ['merged', 'rouge', 'ouverte', 'journal-etranger']) {
    const child = new EventEmitter(); child.pid = 100; child.kill = () => true
    let mesures = 0
    const journal = { run: cas === 'journal-etranger' ? '200-10' : '100-10', tete: 'a'.repeat(40), etapes: {}, verdict: { etat: cas === 'rouge' ? 'rouge' : 'vert', etape: 'file', raison: 'CI rouge' } }
    const fin = publierSession({ worktree: b.dossier, branche: 'chantier/2461' }, {}, undefined, {
      horloge: () => 10, lancer: (exe, args) => { assert.equal(args[0], join(b.dossier, 'scripts', 'ops', 'publier.mjs')); queueMicrotask(() => child.emit('exit', cas === 'rouge' ? 1 : 0)); return child },
      lire: () => journal,
      veiller: (options) => veillerLeTrain({ ...options, vivant: () => false }),
      executer: (exe, args) => { mesures++; assert.equal(exe, 'gh'); assert.deepEqual(args.slice(0, 2), ['pr', 'view']); return { status: 0, stdout: JSON.stringify({ number: 42, state: cas === 'ouverte' ? 'OPEN' : 'MERGED', mergeCommit: { oid: 'b'.repeat(40) } }) } },
      mesurerHead: () => 'a'.repeat(40),
    })
    const resultat = await fin
    assert.equal(resultat.etat, cas === 'merged' ? 'fusionnee' : 'echouee')
    assert.equal(mesures, ['merged', 'ouverte'].includes(cas) ? 1 : 0)
  }
})

test('supervision spawn échoué, arrêt via handle, sortie nonzero et publication MERGED/échec', async (t) => {
  for (const cas of ['spawn', 'error-event', 'arret', 'nonzero', 'rapport', 'fusionnee', 'echouee']) {
    const b = banc(t), r = b.reserver({ agent: 'codex' }); b.revendiquer(r)
    const child = new EventEmitter(); child.pid = 20
    let kills = 0, publications = 0
    child.kill = () => { kills++; b.vivants.delete(20); queueMicrotask(() => child.emit('exit', null, 'SIGTERM')); return true }
    const promesse = b.sessions.superviser(r.carte.sessionId, {
      lancer: () => { if (cas === 'spawn') throw new Error('spawn refusé'); return child },
      lireRapport: () => cas === 'rapport' ? {} : { sessionId: r.carte.sessionId, ticket: 2461, worktree: b.dossier, head: r.carte.head, publier: true, resume: 'fait' },
      mesurerGit: () => ({ branche: r.carte.branche, head: r.carte.head, propre: true }),
      publier: async () => { publications++; return cas === 'echouee' ? { etat: 'echouee', raison: 'CI rouge' } : { etat: 'fusionnee', pr: 42, sha: 'b'.repeat(40), statut: 'MERGED' } },
      periodeMs: 1,
    })
    if (cas === 'arret') b.sessions.demanderArret('banc', r.jeton)
    else if (cas === 'error-event') queueMicrotask(() => child.emit('error', new Error('spawn async refusé')))
    else if (cas !== 'spawn') { b.vivants.delete(20); queueMicrotask(() => child.emit('exit', cas === 'nonzero' ? 9 : 0, null)) }
    const fin = await promesse
    assert.equal(fin.codeEnveloppe, 0)
    assert.equal(kills, cas === 'arret' ? 1 : 0)
    assert.equal(publications, ['fusionnee', 'echouee'].includes(cas) ? 1 : 0)
    if (cas === 'fusionnee') assert.equal(fin.publication.statut, 'MERGED')
    if (cas === 'echouee') assert.equal(fin.publication.raison, 'CI rouge')
  }
})

test('JobHost possède Job sans breakaway, suspend/assign/resume, cleanup handle et wait avant exit0', () => {
  const ps = readFileSync(new URL('./session-process.ps1', import.meta.url), 'utf8')
  assert.match(ps, /0x00002000/)
  assert.match(ps, /0x00000004/)
  assert.ok(ps.indexOf('if (!AssignProcessToJobObject') < ps.indexOf('if (ResumeThread'))
  assert.match(ps, /TerminateProcess\(pi\.hProcess/)
  assert.match(ps, /TerminateJobObject\(job/)
  assert.match(ps, /ActiveProcesses/)
  assert.match(ps, /WaitForSingleObject\(pi\.hProcess/)
  assert.match(ps, /exit 0/)
  assert.doesNotMatch(ps, /BREAKAWAY|taskkill|Stop-Process|ConvertFrom-Json|RedirectStandard|AnonymousPipe/)
})

test('correction 1 : profil v2 fichier dédié, ancien profiles.X refusé', (t) => {
  const b = banc(t), config = join(b.dossier, 'config.toml'), profil = join(b.dossier, 'wfrp-agent.config.toml')
  writeFileSync(config, '[profiles.wfrp-agent]\nsandbox_mode="workspace-write"\n')
  assert.equal(profilCodexExiste({ chemin: config }), false)
  writeFileSync(profil, 'sandbox_mode="workspace-write"\n')
  assert.equal(profilCodexExiste({ chemin: profil }), true)
})

test('correction 2 : lancer consigne relative, Claude défaut depuis main, Codex chantier existant', async (t) => {
  const b = banc(t), consigne = join(b.dossier, '2461.md'); writeFileSync(consigne, 'ouvrir le chantier')
  const options = optionsSession(['lancer', '2461.md'])
  let wt = 0
  const gestes = {
    cwd: b.dossier, contexte: (worktree) => ({ racine: b.dossier, gitCommun: b.dossier, worktree, branche: 'main', head: 'a'.repeat(40) }),
    terminal: () => ({ nom: 'PS' }), natif: () => b.fichiers.claude, profilExiste: () => true, contrat: () => true,
    sessionsDe: () => b.sessions, lancerWT: () => { wt++; const c = b.sessions.lister().cartes.find((c) => c.nom === 's2461'); b.sessions.revendiquer(c.sessionId, undefined, { controleur: identite(10), jobHost: identite(30) }); return { status: 0 } }, env: {},
  }
  const r = await lancerSession(options, gestes), c = b.sessions.lire(r.sessionId)
  assert.equal(c.agent, 'claude'); assert.equal(c.nom, 's2461'); assert.equal(c.ticket, 2461); assert.equal(c.worktree, b.dossier); assert.equal(c.branche, 'main')
  assert.equal(wt, 1)
  assert.throws(() => optionsSession(['lancer', 'lettre.md']), /TICKET/)
  assert.equal(optionsSession(['lancer', 'lettre.md', '--ticket', '3']).ticket, 3)
  await assert.rejects(lancerSession(optionsSession(['lancer', '2462.md', '--agent', 'codex']), { ...gestes, contexte: () => ({ racine: b.dossier, gitCommun: b.dossier, worktree: b.dossier, branche: 'main', head: 'a'.repeat(40) }) }), /ops:chantier/)
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
  const gestes = { cwd: b.dossier, contexte: () => ({ racine: b.dossier, gitCommun: b.dossier, worktree: b.dossier, branche: 'chantier/2461', head: 'a'.repeat(40) }), terminal: () => ({ nom: 'PS' }), natif: () => b.fichiers.codex, profilExiste: () => true, sessionsDe: () => b.sessions, lancerWT: () => { wt++; return { status: 0 } }, env: {}, contrat: () => { contrats++; throw new Error('CONTRAT CLI INCOMPATIBLE') } }
  await assert.rejects(lancerSession({ ticket: 2461, consigne, nom: 'banc', agent: 'codex', worktree: b.dossier }, gestes), /CONTRAT CLI INCOMPATIBLE/)
  assert.equal(contrats, 1); assert.equal(wt, 0); assert.equal(b.sessions.lister().cartes.length, 0)
  const requis = ['--profile', '--sandbox', '--approve-for-me', '--add-dir', '--output-schema', '--output-last-message', '<name>.config.toml']
  const executer = (omis) => (exe, args, options) => { assert.equal(exe, b.fichiers.codex); assert.equal(options.shell, false); assert.ok(options.timeout <= 10000); return { status: 0, stdout: args[0] === '--version' ? 'codex-cli 1.0' : args[0] === '--help' ? 'Commands: exec' : requis.filter((x) => x !== omis).join('\n') } }
  verifierContratAgent('codex', b.fichiers.codex, { executer: executer(), env: {} })
  for (const omis of requis) assert.throws(() => verifierContratAgent('codex', b.fichiers.codex, { executer: executer(omis), env: {} }), /CONTRAT CLI INCOMPATIBLE/)
})

test('snapshot OS unique par passe pour plusieurs dizaines de cartes historiques', (t) => {
  const b = banc(t)
  for (let i = 0; i < 30; i++) { const r = b.reserver({ ticket: i + 1, nom: `s${i}` }); b.revendiquer(r); b.sessions.sortie(r.carte.sessionId, { codeAgent: 0 }); b.vivants.clear(); b.sessions.lister(); b.vivants.set(10, identite(10)); b.vivants.set(30, identite(30)) }
  let snapshots = 0, sondes = 0
  const sessions = creerSessions({ dossier: b.dossier, horloge: () => 2000, inventaire: () => { snapshots++; return [] }, processus: () => { sondes++; return null } })
  assert.equal(sessions.lister().cartes.length, 30)
  assert.equal(snapshots, 1); assert.equal(sondes, 0)
})

test('course : cartes lues sous verrou avant snapshot, inscription pendant constat ne clôture pas un host vivant', (t) => {
  const b = banc(t), r = b.reserver()
  let premiere = true
  const sessions = creerSessions({ dossier: b.dossier, horloge: () => 2000, lanceur: () => identite(99), inventaire: () => {
    assert.ok(existsSync(join(b.dossier, 'registre.lock')), 'snapshot acquis sous verrou')
    if (!premiere) return [identite(40)]
    premiere = false
    const c = JSON.parse(readFileSync(join(b.dossier, `${r.carte.sessionId}.json`), 'utf8'))
    Object.assign(c, { etat: 'nettoyage', controleur: identite(10), jobHost: identite(40), issueSortie: 'sortie', sortieLe: new Date(2000).toISOString(), codeAgent: 0 })
    delete c.empreinteNonce
    writeFileSync(join(b.dossier, `${r.carte.sessionId}.json`), JSON.stringify(c))
    return []
  } })
  const vu = sessions.lister()
  assert.equal(vu.evenements.filter((e) => e.type === 'clôture').length, 0)
  assert.equal(sessions.lire(r.carte.sessionId).etat, 'nettoyage')
  assert.throws(() => sessions.reserver({ ...r.carte, sessionId: undefined }), /COLLISION/)
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
  assert.equal(vu.carte.publication.etat, 'non-demandee')
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
