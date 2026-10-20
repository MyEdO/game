import test from 'node:test'
import assert from 'node:assert/strict'
import { once } from 'node:events'
import { spawn } from 'node:child_process'
import { createHash, randomUUID } from 'node:crypto'
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, appendFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { createConnection, createServer } from 'node:net'
import { attendreSuivi } from './session.mjs'
import { prefixeDeRefus } from '../guards/lib/categorieDeRefus.mjs'
import { Writable } from 'node:stream'
import { NAISSANCE_ABSENTE, estPidVivantDepuis } from '../guards/lib/pid.mjs'
import { IDENTITE_MESUREE } from '../test/identiteMesuree.mjs'
import { lancerPontCodex, envoyerCodex, veillerCodex, verifierProtocoleCodex, projeterJournalCodex, VERSION_PROTOCOLE_CODEX, MAX_MESSAGE_CODEX } from './session-codex.mjs'

/** L'écouteur `error` de la projection se retire au tick qui suit la dernière écriture close : attendre ce
 *  tick, borné, au lieu d'en supposer le nombre. */
async function ecouteursRendus(flux, attendus) {
  for (let tours = 0; tours < 100 && flux.listenerCount('error') !== attendus; tours++) await new Promise(setImmediate)
  assert.equal(flux.listenerCount('error'), attendus)
}

const FIXTURE = `
import {createInterface} from 'node:readline';
const send=x=>process.stdout.write(JSON.stringify(x)+'\\n');
const tid='thread-owned';let turn=0,active,started=false,initial,steers=0;
const notify=(method,params)=>send({method,params:{threadId:tid,...params}});
function complete(text){if(active===null)return;const id=active;
notify('thread/tokenUsage/updated',{turnId:id,tokenUsage:{total:{totalTokens:42}}});
notify('item/completed',{turnId:id,item:{id:'progress',type:'agentMessage',text:'Je vérifie le résultat.'}});
notify('item/started',{turnId:id,item:{id:'tool1',type:'commandExecution',command:'node --version',status:'inProgress'}});
notify('item/completed',{turnId:id,item:{id:'tool1',type:'commandExecution',command:'node --version',status:'completed'}});
for(let i=0;i<4;i++)notify('item/agentMessage/delta',{turnId:id,delta:'delta'});
const report=text==='INVALID'?'invalid':JSON.stringify({resultat:text,sessionId:'fixture'});
notify('item/completed',{turnId:id,item:{id:'answer',type:'agentMessage',text:report}});notify('thread/status/changed',{status:{type:'idle'}});
const fin={turn:{id,status:'completed',items:[],durationMs:321}};notify('turn/completed',fin);if(text==='DUPLICATE')notify('turn/completed',fin);active=null;}
createInterface({input:process.stdin}).on('line',line=>{const q=JSON.parse(line);if(!q.method)return;const p=q.params||{};
if(q.method==='initialize')send({id:q.id,result:{userAgent:'fixture'}});
if(q.method==='thread/start')setTimeout(()=>send({id:q.id,result:{thread:{id:tid}}}),Number(process.argv[2]));
if(q.method==='turn/start'){active='turn-'+(++turn);initial=p.input[0].text;started=false;send({id:q.id,result:{turn:{id:active}}});const id=active;setTimeout(()=>{if(active!==id)return;started=true;notify('turn/started',{turn:{id:active,status:'inProgress',items:[]}});if(initial==='AUTO'||initial==='INVALID')complete(initial);if(initial==='ERROR_ACTIVE')notify('error',{turnId:active,error:{message:'temporary active error'}});if(initial==='EOF_LIVE'){process.on('SIGTERM',()=>{});setInterval(()=>{},1000);notify('fixture/perte-protocole',{});}},initial==='WAIT_START'?150:5);}
if(q.method==='turn/steer'){if(active===null){send({id:q.id,error:{code:78,message:'no active turn to steer'}});return;}if(p.threadId!==tid||p.expectedTurnId!==active)throw Error('foreign turn');const text=p.input[0].text;if(text==='NATIVE_ERROR')send({id:q.id,error:{code:77,message:'native refusal'}});else{send({id:q.id,result:{turnId:active,steers:++steers}});if(text==='CRASH'){process.stderr.write('first native cause\\nsecond native cause\\n');process.exit(9);}else if(text==='FAIL'){notify('turn/completed',{turn:{id:active,status:'failed',items:[],error:{message:'server overloaded'}}});active=null;}else if(text==='APPROVAL'){notify('request/input',{});send({id:900,method:'item/tool/requestUserInput',params:{threadId:tid}});}else setTimeout(()=>complete(text),5);}}
if(q.method==='turn/interrupt'){if(!started)send({id:q.id,error:{code:1,message:'no active turn'}});else {send({id:q.id,result:{}});notify('turn/completed',{turn:{id:active,status:'interrupted',items:[]}});active=null;}}
}).on('close',()=>{if(initial!=='EOF_LIVE')process.exit(0)});
`
async function banc(t, { consigne = 'BUSY', validation = () => {}, echo, delaiDemarrageMs = 0, demarrageJusqua = Date.now() + 60_000, mesurerCreation = IDENTITE_MESUREE.lireCreation } = {}) {
  const dossier = mkdtempSync(join(tmpdir(), 'wfrp-pont-banc-'))
  const fixture = join(dossier, 'app-server.mjs')
  writeFileSync(fixture, FIXTURE)
  const sessionId = randomUUID(), jeton = 'secret-exclusif-pont'
  const projections = [], affichage = [], requetesEmises = []
  let natif, pont, fermetureNatif, nettoyage, naissanceNatif, vivantALaRupture = false
  const nettoyer = () => nettoyage ??= (async () => {
    const secours = setTimeout(() => natif?.kill('SIGKILL'), 3000)
    try {
      if (pont) pont.child.kill()
      else natif?.kill()
      await fermetureNatif
    } finally {
      clearTimeout(secours)
      rmSync(dossier, { recursive: true, force: true })
    }
  })()
  t.after(nettoyer)
  try {
    pont = lancerPontCodex({
    plan: { executable: process.execPath, args: [fixture, String(delaiDemarrageMs)] },
    carte: { sessionId, worktree: dossier, demarrageJusqua, empreinteJeton: createHash('sha256').update(jeton).digest('hex') },
    dossier, consigne, schema: { type: 'object' }, env: process.env,
    echo: echo && typeof echo !== 'function' ? echo : (texte) => { affichage.push(texte); echo?.(texte) },
    notifier(p) { validation(p); projections.push(p) }, lancer(...args) {
      natif = spawn(...args)
      fermetureNatif = once(natif, 'close')
      const ecrire = natif.stdin.write.bind(natif.stdin)
      natif.stdin.write = (texte, ...options) => {
        requetesEmises.push(JSON.parse(String(texte)))
        return ecrire(texte, ...options)
      }
      naissanceNatif = mesurerCreation(natif.pid)
      assert.ok(Number.isFinite(naissanceNatif), 'Création du processus natif mesurée')
      let flux = ''
      natif.stdout.on('data', (b) => {
        flux += b.toString()
        if (flux.includes('fixture/perte-protocole')) {
          assert.equal(estPidVivantDepuis(natif.pid, naissanceNatif, IDENTITE_MESUREE), true)
          vivantALaRupture = true
          natif.stdout.destroy()
        }
      })
      return natif
    },
    })
  } catch (erreur) {
    await nettoyer()
    throw erreur
  }
  const sortie = once(pont.child, 'exit')
  const base = { dossier, sessionId, jeton, timeoutMs: 2000 }
  return { ...base, pont, projections, affichage, requetesEmises, sortie, naissanceNatif, vivantALaRupture: () => vivantALaRupture, envoyer: (message, requestId = randomUUID()) => envoyerCodex({ ...base, message, requestId }), veille: (depuis = 0) => veillerCodex({ ...base, depuis }) }
}
async function sousBorne(promesse, ms) {
  let timer
  try { return await Promise.race([promesse, new Promise((_, reject) => { timer = setTimeout(() => reject(Error('Processus natif toujours vivant après borne')), ms) })]) }
  finally { clearTimeout(timer) }
}

test('banc : mesure NaN rejette après fermeture du natif sans PowerShell', async (t) => {
  let pid
  await assert.rejects(banc(t, {
    mesurerCreation: (natifPid) => { pid = natifPid; return NaN },
  }), /Création du processus natif mesurée/)
  assert.ok(Number.isInteger(pid))
  assert.equal(estPidVivantDepuis(pid, NAISSANCE_ABSENTE, IDENTITE_MESUREE), false)
})

test('thread/start réel au-delà de vingt secondes consomme le budget de démarrage', { timeout: 35000 }, async (t) => {
  const debut = Date.now()
  const b = await banc(t, {
    consigne: 'AUTO',
    delaiDemarrageMs: 21000,
    demarrageJusqua: debut + 32000,
  })
  let transition
  do {
    transition = await veillerCodex({ ...b, depuis: transition?.seq ?? 0, timeoutMs: 30000 })
    assert.notEqual(transition.type, 'erreur', transition.cause)
  } while (transition.type !== 'fin')
  assert.ok(Date.now() - debut >= 21000)
  assert.deepEqual(transition.rapport, { resultat: 'AUTO', sessionId: 'fixture' })
  assert.equal(b.requetesEmises.filter((q) => q.method === 'thread/start').length, 1)
  assert.equal(b.requetesEmises.filter((q) => q.method === 'turn/start').length, 1)
  assert.equal(b.pont.cause(), '')
  t.diagnostic(JSON.stringify({ dureeMs: Date.now() - debut, rapport: transition.rapport }))
})

test('thread/start avec échéance épuisée refuse avant toute émission native', { timeout: 5000 }, async (t) => {
  const b = await banc(t, { demarrageJusqua: Date.now() - 1 })
  await veillerCodex({ ...b, timeoutMs: 2000 })
  assert.equal(b.requetesEmises.some((q) => q.method === 'initialize'), true)
  assert.equal(b.requetesEmises.some((q) => q.method === 'thread/start'), false)
  assert.equal(b.requetesEmises.some((q) => q.method === 'turn/start'), false)
  assert.ok(b.pont.cause().startsWith(prefixeDeRefus('transitoire')))
  assert.match(b.pont.cause(), /thread\/start atteinte avant émission : échéance de démarrage épuisée/)
  await sousBorne(b.sortie, 3000)
  assert.ok(b.projections.some((p) => p.etat === 'fermee'))
})

test('projection réelle : enfant natif, progression, outils, fin et journal unique', async (t) => {
  const b = await banc(t)
  await b.envoyer('FIN')
  await b.veille()
  const texte = b.affichage.join('')
  assert.match(texte, /Agent : Je vérifie le résultat/)
  assert.match(texte, /Outil commandExecution \[inProgress\] : node --version/)
  assert.match(texte, /Outil commandExecution \[completed\] : node --version/)
  assert.match(texte, /Agent : .*"resultat":"FIN"/)
  assert.match(texte, /Fin du tour : completed/)
  assert.doesNotMatch(texte, /delta|tokenUsage|thread\/status/)
  assert.deepEqual(readdirSync(b.dossier).filter((p) => p.endsWith('.jsonl')), [`${b.sessionId}.codex.jsonl`])
})
const CONTEXTE_PROJECTION = [
  { notification: { id: 1, result: { thread: { id: 'thread-owned' } } } },
  { notification: { id: 2, result: { turn: { id: 'turn-owned' } } } },
].map((x) => JSON.stringify(x)).join('\n') + '\n'
const notificationProjection = (method, params) => ({ notification: { method, params: { threadId: 'thread-owned', turnId: 'turn-owned', ...params } } })
test('projection du journal : reprise incrémentale, UTF-8 partiel et contrôles neutralisés', (t) => {
  const dossier = mkdtempSync(join(tmpdir(), 'wfrp-projection-'))
  t.after(() => rmSync(dossier, { recursive: true, force: true }))
  const fichier = join(dossier, 'native.jsonl'), sortie = []
  const lire = projeterJournalCodex(fichier, (s) => sortie.push(s))
  lire()
  const ligne = Buffer.from(CONTEXTE_PROJECTION + `${JSON.stringify(notificationProjection('item/completed', { item: { type: 'agentMessage', text: '\x1b[31mété\x1b[0m\n\r\u202eSUITE' } }))}\n`)
  const coupe = ligne.indexOf(Buffer.from('é')) + 1
  writeFileSync(fichier, ligne.subarray(0, coupe)); lire()
  assert.deepEqual(sortie, [])
  appendFileSync(fichier, ligne.subarray(coupe)); lire(); lire()
  assert.deepEqual(sortie, ['[Codex] Agent : été SUITE\n'])
  const relecture = []
  projeterJournalCodex(fichier, (s) => relecture.push(s))()
  assert.deepEqual(relecture, sortie)
})
test('projection bornée : gros événements gardent leur statut et fin malgré leur payload', async (t) => {
  const dossier = mkdtempSync(join(tmpdir(), 'wfrp-projection-borne-'))
  t.after(() => rmSync(dossier, { recursive: true, force: true }))
  const fichier = join(dossier, 'native.jsonl'), sortie = []
  const agent = (text) => `${JSON.stringify(notificationProjection('item/completed', { item: { type: 'agentMessage', text } }))}\n`
  const outil = notificationProjection('item/completed', { item: { type: 'commandExecution', command: 'node --version', status: 'completed', aggregatedOutput: 'x'.repeat(300_000) } })
  const fin = notificationProjection('turn/completed', { turn: { id: 'turn-owned', status: 'completed', items: [{ type: 'agentMessage', text: 'x'.repeat(300_000) }] } })
  writeFileSync(fichier, CONTEXTE_PROJECTION + agent('mot '.repeat(2500)) + agent('mot '.repeat(500_000)) + JSON.stringify(outil) + '\n' + JSON.stringify(fin) + '\n')
  const lire = projeterJournalCodex(fichier, (s) => sortie.push(s))
  lire()
  assert.equal(sortie.some((s) => s.includes('Fin du tour')), false, 'budget par lecture')
  for (let i = 0; i < 30 && !sortie.some((s) => s.includes('Fin du tour')); i++) await new Promise(setImmediate)
  assert.equal(sortie.length, 4)
  assert.ok(sortie.every((s) => s.length < 4200))
  assert.match(sortie[0], /…\n$/)
  assert.match(sortie[1], /Agent : (?:mot )*mot…\n$/)
  assert.match(sortie[2], /Outil commandExecution \[completed\] : node --version/)
  assert.match(sortie[3], /Fin du tour : completed/)
})
test('projection : nettoyage intégral avant coupe au mot, unicode et premier mot entier', (t) => {
  const dossier = mkdtempSync(join(tmpdir(), 'wfrp-projection-mot-'))
  t.after(() => rmSync(dossier, { recursive: true, force: true }))
  const fichier = join(dossier, 'native.jsonl'), sortie = []
  const textes = ['a '.repeat(2045) + 'chevauchement suite', 'x'.repeat(10_000), '\u001b[31m'.repeat(2000) + ' \t\u202e'.repeat(3000) + 'été 🐉 utile', 'é🐉 '.repeat(3000)]
  writeFileSync(fichier, CONTEXTE_PROJECTION + textes.map((text) => JSON.stringify(notificationProjection('item/completed', { item: { type: 'agentMessage', text } }))).join('\n') + '\n')
  projeterJournalCodex(fichier, (s) => sortie.push(s))()
  assert.equal(sortie[0], '[Codex] Agent : ' + 'a '.repeat(2044) + 'a…\n')
  assert.ok(sortie[0].length <= '[Codex] Agent : '.length + 4096 + 1)
  assert.equal(sortie[1], '[Codex] Agent : ' + 'x'.repeat(10_000) + '\n')
  assert.equal(sortie[2], '[Codex] Agent : été 🐉 utile\n')
  assert.equal(sortie[3], '[Codex] Agent : ' + 'é🐉 '.repeat(1024).trimEnd() + '…\n')
})
test('projection facultative : panne de sortie pendant agent ou outil laisse contrôle, abonnement et rapport valides', async (t) => {
  for (const cible of ['Agent', 'Outil']) await t.test(cible, async (t) => {
    let pannes = 0
    const b = await banc(t, { echo(texte) { if (texte.includes(cible)) { pannes++; throw new Error('sortie indisponible') } } })
    const reveil = b.veille()
    assert.equal((await b.envoyer('FIN')).ok, true)
    const fin = await reveil
    assert.equal(fin.etat, 'inactif')
    assert.equal(fin.rapport.resultat, 'FIN')
    assert.equal(pannes, 1)
    assert.match(readFileSync(join(b.dossier, `${b.sessionId}.codex.stderr.log`), 'utf8'), /^\[Codex\] Affichage suspendu : sortie indisponible\n$/)
    assert.equal((await b.envoyer('AUTO')).ok, true)
    assert.equal((await b.veille(fin.curseur)).rapport.resultat, 'AUTO')
  })
})
test('projection facultative : Writable en panne asynchrone conserve le pont et libère son écouteur', async (t) => {
  let ecritures = 0
  const sortie = new Writable({ write(_texte, _encodage, callback) {
    ecritures++
    setImmediate(() => callback(Object.assign(Error('pipe fermé'), { code: 'EPIPE' })))
  } })
  const ecouteurs = sortie.listenerCount('error')
  const b = await banc(t, { echo: sortie })
  const reveil = b.veille()
  assert.equal((await b.envoyer('FIN')).ok, true)
  const fin = await reveil
  await new Promise(setImmediate)
  assert.equal(fin.rapport.resultat, 'FIN')
  assert.equal(ecritures, 1)
  assert.equal((await b.envoyer('AUTO')).ok, true)
  assert.equal((await b.veille(fin.curseur)).rapport.resultat, 'AUTO')
  assert.equal(readFileSync(b.pont.journalDiagnostic, 'utf8'), '[Codex] Affichage suspendu : pipe fermé\n')
  b.pont.child.kill()
  await b.sortie
  await ecouteursRendus(sortie, ecouteurs)
})
test('projection : spawn ENOENT sans exit libère son écouteur après close', async (t) => {
  const dossier = mkdtempSync(join(tmpdir(), 'wfrp-projection-enoent-'))
  t.after(() => rmSync(dossier, { recursive: true, force: true }))
  const sortie = new Writable({ write(_texte, _encodage, callback) { callback() } })
  const ecouteurs = sortie.listenerCount('error'), erreurs = [], evenements = []
  let fermeture
  const pont = lancerPontCodex({
    plan: { executable: join(dossier, 'executable-absent'), args: [] },
    carte: { sessionId: randomUUID(), worktree: dossier, demarrageJusqua: Date.now() + 60_000, empreinteJeton: 'a'.repeat(64) },
    dossier, consigne: 'test', schema: {}, env: process.env, notifier() {}, echo: sortie,
    lancer(...args) {
      const natif = spawn(...args)
      natif.on('exit', () => evenements.push('exit'))
      fermeture = new Promise((resolve) => natif.once('close', () => { evenements.push('close'); resolve() }))
      return natif
    },
  })
  pont.child.on('error', (e) => erreurs.push(e.code))
  await sousBorne(fermeture, 2000)
  await new Promise(setImmediate)
  assert.deepEqual(erreurs, ['ENOENT'])
  assert.deepEqual(evenements, ['close'])
  await ecouteursRendus(sortie, ecouteurs)
})
test('projection : fermeture protège les écritures en vol jusqu’au callback et à error', async (t) => {
  const dossier = mkdtempSync(join(tmpdir(), 'wfrp-projection-pending-'))
  t.after(() => rmSync(dossier, { recursive: true, force: true }))
  const fichier = join(dossier, 'journal.jsonl'), erreurs = []
  let terminer
  const sortie = new Writable({ write(_texte, _encodage, callback) { terminer = callback } })
  const ecouteurs = sortie.listenerCount('error')
  writeFileSync(fichier, JSON.stringify({ erreur: 'test' }) + '\n')
  const lire = projeterJournalCodex(fichier, sortie, (e) => erreurs.push(e.message))
  lire()
  lire.fermer()
  await new Promise(setImmediate)
  assert.equal(sortie.listenerCount('error'), ecouteurs + 1)
  terminer(Error('écriture en vol échouée'))
  await new Promise(setImmediate)
  assert.deepEqual(erreurs, ['écriture en vol échouée'])
  await ecouteursRendus(sortie, ecouteurs)
})
test('projection facultative : journal illisible suspendu une fois et diagnostic défaillant isolé', (t) => {
  const dossier = mkdtempSync(join(tmpdir(), 'wfrp-projection-illisible-'))
  t.after(() => rmSync(dossier, { recursive: true, force: true }))
  const erreurs = []
  const lire = projeterJournalCodex(dossier, () => assert.fail('journal illisible'), (e) => { erreurs.push(e); throw Error('diagnostic indisponible') })
  assert.doesNotThrow(lire)
  assert.doesNotThrow(lire)
  assert.equal(erreurs.length, 1)
  assert.match(erreurs[0].message, /non régulier|EISDIR|EPERM/)
})
test('projection facultative : reprise asynchrone défaillante suspendue sans exception non gérée', async (t) => {
  const dossier = mkdtempSync(join(tmpdir(), 'wfrp-projection-reprise-'))
  t.after(() => rmSync(dossier, { recursive: true, force: true }))
  const fichier = join(dossier, 'native.jsonl'), erreurs = [], sortie = []
  writeFileSync(fichier, CONTEXTE_PROJECTION + JSON.stringify({ inconnu: 'x'.repeat(300_000) }) + '\n' + JSON.stringify(notificationProjection('item/completed', { item: { type: 'agentMessage', text: 'tardif' } })) + '\n')
  const lire = projeterJournalCodex(fichier, (s) => { sortie.push(s); throw Error('sortie de reprise indisponible') }, (e) => erreurs.push(e.message))
  lire()
  assert.deepEqual(sortie, [])
  await new Promise(setImmediate)
  assert.deepEqual(erreurs, ['sortie de reprise indisponible'])
  lire()
  await new Promise(setImmediate)
  assert.equal(sortie.length, 1)
  assert.equal(erreurs.length, 1)
})
test('projection facultative : sortie du diagnostic JSON invalide protégée', (t) => {
  const dossier = mkdtempSync(join(tmpdir(), 'wfrp-projection-json-'))
  t.after(() => rmSync(dossier, { recursive: true, force: true }))
  const fichier = join(dossier, 'native.jsonl'), erreurs = []
  writeFileSync(fichier, '{cassé}\n')
  const lire = projeterJournalCodex(fichier, () => { throw new SyntaxError('sortie JSON indisponible') }, (e) => erreurs.push(e.message))
  assert.doesNotThrow(lire)
  lire()
  assert.deepEqual(erreurs, ['sortie JSON indisponible'])
})
test('projection : statuts natifs par famille, erreurs et notifications inconnues', (t) => {
  const dossier = mkdtempSync(join(tmpdir(), 'wfrp-projection-formes-'))
  t.after(() => rmSync(dossier, { recursive: true, force: true }))
  const fichier = join(dossier, 'native.jsonl'), sortie = []
  const notifications = [
    ...['fileChange', 'mcpToolCall', 'dynamicToolCall', 'collabAgentToolCall', 'imageGeneration', 'webSearch', 'imageView', 'sleep'].flatMap((type) => ['item/started', 'item/completed'].map((method) => ({ method, params: { item: { type, status: 'failed', server: 'serveur', tool: 'outil' } } }))),
    { method: 'error', params: { error: { message: 'panne native' } } },
    { id: 3, error: { message: 'refus natif' } },
    { method: 'extension/inconnue', params: { message: 'ne pas afficher' } },
    { method: 'item/agentMessage/delta', params: { delta: 'ne pas afficher' } },
  ]
  writeFileSync(fichier, CONTEXTE_PROJECTION + notifications.map((n) => JSON.stringify({ notification: n.params ? { ...n, params: { threadId: 'thread-owned', turnId: 'turn-owned', ...n.params } } : n })).join('\n') + '\n' + [
    { transition: { type: 'erreur', cause: 'rapport refusé' } },
    { transition: { type: 'fermeture', cause: 'onglet fermé' } },
    { transition: { type: 'mort', etat: 'mort' } },
    { erreur: 'journal en erreur' },
  ].map((x) => JSON.stringify(x)).join('\n') + '\n')
  projeterJournalCodex(fichier, (s) => sortie.push(s))()
  const texte = sortie.join('')
  assert.match(texte, /mcpToolCall \[failed\] : serveur \/ outil/)
  assert.match(texte, /dynamicToolCall \[failed\] : outil/)
  assert.match(texte, /collabAgentToolCall \[failed\] : outil/)
  assert.match(texte, /fileChange \[failed\]/)
  assert.match(texte, /imageGeneration \[failed\]/)
  for (const type of ['webSearch', 'imageView', 'sleep']) {
    assert.match(texte, new RegExp(`${type} \\[inProgress\\]`))
    assert.match(texte, new RegExp(`${type} \\[completed\\]`))
  }
  assert.match(texte, /Erreur native : panne native/)
  assert.match(texte, /Refus natif : refus natif/)
  assert.match(texte, /erreur : rapport refusé/)
  assert.match(texte, /fermeture : onglet fermé/)
  assert.match(texte, /mort : mort/)
  assert.match(texte, /Erreur : journal en erreur/)
  assert.doesNotMatch(texte, /ne pas afficher/)
})
test('projection : sortie standard réelle par défaut et ligne invalide sans perte de la suite', async (t) => {
  const dossier = mkdtempSync(join(tmpdir(), 'wfrp-projection-stdout-'))
  t.after(() => rmSync(dossier, { recursive: true, force: true }))
  const fichier = join(dossier, 'native.jsonl'), sortie = []
  writeFileSync(fichier, CONTEXTE_PROJECTION + '{cassé}\n' + JSON.stringify(notificationProjection('turn/completed', { turn: { id: 'turn-owned', status: 'interrupted' } })) + '\n')
  const write = process.stdout.write
  const ecouteurs = process.stdout.listenerCount('error')
  const lire = projeterJournalCodex(fichier)
  try {
    process.stdout.write = (s, callback) => { sortie.push(s); callback(); return true }
    lire()
  } finally { process.stdout.write = write; lire.fermer() }
  await ecouteursRendus(process.stdout, ecouteurs)
  assert.deepEqual(sortie, ['[Codex] Journal : ligne JSON invalide\n', '[Codex] Fin du tour : interrupted\n'])
})
test('projection : propriété du thread et du tour dérivée du journal uniquement', (t) => {
  const dossier = mkdtempSync(join(tmpdir(), 'wfrp-projection-propriete-'))
  t.after(() => rmSync(dossier, { recursive: true, force: true }))
  const fichier = join(dossier, 'native.jsonl'), sortie = []
  const message = (text, params = {}) => notificationProjection('item/completed', { item: { type: 'agentMessage', text }, ...params })
  const lignes = [
    message('avant identité interdit'),
    ...CONTEXTE_PROJECTION.trim().split('\n').map(JSON.parse),
    message('thread étranger interdit', { threadId: 'foreign' }),
    message('tour étranger interdit', { turnId: 'foreign' }),
    notificationProjection('turn/started', { turn: { id: 'foreign' } }),
    message('après faux début étranger interdit', { turnId: 'foreign' }),
    notificationProjection('turn/completed', { turn: { id: 'foreign', status: 'failed' } }),
    message('tour possédé visible'),
    notificationProjection('turn/completed', { turn: { id: 'turn-owned', status: 'completed' } }),
    message('après fin interdit'),
    { notification: { id: 9, result: { turn: { id: 'turn-next' } } } },
    notificationProjection('turn/started', { turnId: 'turn-next', turn: { id: 'turn-next' } }),
    message('tour suivant visible', { turnId: 'turn-next' }),
  ]
  writeFileSync(fichier, lignes.map((x) => JSON.stringify(x)).join('\n') + '\n')
  projeterJournalCodex(fichier, (s) => sortie.push(s))()
  assert.deepEqual(sortie, ['[Codex] Agent : tour possédé visible\n', '[Codex] Fin du tour : completed\n', '[Codex] Agent : tour suivant visible\n'])
})
test('EOF vivant : perte du protocole tue le processus natif sous borne, sans faux exit', async (t) => {
  const b = await banc(t, { consigne: 'EOF_LIVE' })
  const [code, signal] = await sousBorne(b.sortie, 2800)
  assert.equal(b.vivantALaRupture(), true)
  assert.ok(code !== 0 || signal)
  assert.equal(estPidVivantDepuis(b.pont.child.pid, b.naissanceNatif, IDENTITE_MESUREE), false)
  const transitions = readFileSync(join(b.dossier, `${b.sessionId}.codex.jsonl`), 'utf8').split('\n').filter(Boolean).map(JSON.parse).flatMap((x) => x.transition ? [x.transition] : [])
  assert.ok(transitions.some((x) => x.type === 'mort'))
  assert.equal(transitions.some((x) => x.type === 'fin'), false)
  assert.match(b.pont.cause(), /EOF/)
  assert.equal(b.pont.journalDiagnostic, join(b.dossier, `${b.sessionId}.codex.stderr.log`))
})
test('provenance : rapport du tour1 absent du tour2 invalide ou mort', async (t) => {
  for (const suite of ['INVALID', 'EOF_LIVE']) {
    const b = await banc(t)
    await b.envoyer('FIN')
    const premier = await b.veille()
    assert.equal(premier.rapport.resultat, 'FIN')
    await b.envoyer(suite)
    const second = await b.veille(premier.seq)
    assert.equal(second.turnId, 'turn-2')
    assert.equal(Object.hasOwn(second, 'rapport'), false)
    for (const p of b.projections.filter((p) => p.turnId === 'turn-2')) assert.equal(Object.hasOwn(p, 'rapport'), false)
    if (suite === 'EOF_LIVE') await sousBorne(b.sortie, 2800)
  }
})
test('fin dupliquée : même tour terminé ne republie aucune transition ni nouveau curseur', async (t) => {
  const b = await banc(t)
  await b.envoyer('DUPLICATE')
  const fin = await b.veille()
  const suivant = await veillerCodex({ ...b, depuis: fin.seq, timeoutMs: 0 })
  assert.equal(suivant.type, 'aucune')
  assert.equal(suivant.seq, fin.seq)
  const journal = readFileSync(join(b.dossier, `${b.sessionId}.codex.jsonl`), 'utf8').split('\n').filter(Boolean).map(JSON.parse)
  assert.equal(journal.filter((x) => x.notification?.method === 'turn/completed').length, 2)
  assert.equal(journal.filter((x) => x.transition?.type === 'fin').length, 1)
})

test('autorité, identité, validation UTF-8 et idempotence sur un vrai pipe', async (t) => {
  const b = await banc(t)
  await assert.rejects(envoyerCodex({ ...b, sessionId: '../foreign', message: 'x', requestId: 'r' }), /\[validation/)
  await assert.rejects(envoyerCodex({ ...b, jeton: 'wrong', message: 'x', requestId: 'r' }), /\[permission/)
  await assert.rejects(b.envoyer(' '), /\[validation/)
  await assert.rejects(b.envoyer('é'.repeat(MAX_MESSAGE_CODEX)), /\[validation/)
  const [a, a2] = await Promise.all([b.envoyer('FIN', 'same'), b.envoyer('FIN', 'same')])
  assert.deepEqual(a, a2)
  assert.equal(a.ok, true)
  const fin = await b.veille()
  assert.equal(fin.type, 'fin')
  assert.equal(fin.rapport.resultat, 'FIN')
  await assert.rejects(b.envoyer('different', 'same'), /\[validation/)
  const journal = readFileSync(join(b.dossier, `${b.sessionId}.codex.jsonl`), 'utf8')
  assert.equal(journal.includes(b.jeton), false)
  assert.equal(journal.match(/"type":"fin"/g).length, 1)
})
test('steer occupé puis nouveau tour inactif et télémétrie sans transitions de delta', async (t) => {
  const b = await banc(t)
  const abonne = b.veille()
  const ack = await b.envoyer('APPLIED')
  assert.equal(ack.resultat.turnId, 'turn-1')
  const fin = await abonne
  assert.equal(fin.rapport.resultat, 'APPLIED')
  assert.equal(fin.jetons.total.totalTokens, 42)
  assert.equal(fin.outils, 1)
  assert.equal(fin.dureeMs, 321)
  assert.equal(fin.etat, 'inactif')
  assert.equal(b.pont.child.exitCode, null)
  const ack2 = await b.envoyer('AUTO')
  assert.equal(ack2.turnId, 'turn-2')
  const fin2 = await b.veille(fin.seq)
  assert.equal(fin2.seq, fin.seq + 1)
  assert.equal(fin2.rapport.resultat, 'AUTO')
  assert.deepEqual(await b.veille(), fin)
})
test('reprise après échec terminal : nouveau tour sur le même thread et la même capacité', async (t) => {
  const b = await banc(t)
  await b.envoyer('FAIL')
  const echec = await b.veille()
  assert.equal(echec.etat, 'erreur')
  assert.equal(echec.turnId, 'turn-1')
  assert.match(echec.cause, /server overloaded/)
  const ack = await b.envoyer('AUTO')
  assert.equal(ack.ok, true)
  assert.equal(ack.threadId, echec.threadId)
  assert.equal(ack.turnId, 'turn-2')
  const fin = await b.veille(echec.seq)
  assert.equal(fin.rapport.resultat, 'AUTO')
  assert.equal(fin.threadId, echec.threadId)
  assert.equal(fin.turnId, 'turn-2')
  assert.deepEqual(b.requetesEmises.filter((q) => q.method === 'turn/steer').map((q) => q.params.expectedTurnId), ['turn-1'])
  assert.equal(b.requetesEmises.filter((q) => q.method === 'thread/start').length, 1)
})

test('erreur pendant un tour actif : envoi conservé dans le tour par steer', async (t) => {
  const b = await banc(t, { consigne: 'ERROR_ACTIVE' })
  const erreur = await b.veille()
  assert.equal(erreur.etat, 'erreur')
  assert.match(erreur.cause, /temporary active error/)
  const ack = await b.envoyer('FIN')
  assert.equal(ack.turnId, 'turn-1')
  const fin = await b.veille(erreur.seq)
  assert.equal(fin.rapport.resultat, 'FIN')
  assert.equal(b.requetesEmises.filter((q) => q.method === 'turn/start').length, 1)
  assert.deepEqual(b.requetesEmises.filter((q) => q.method === 'turn/steer').map((q) => q.params.expectedTurnId), ['turn-1'])
})

test('arrêt avant turn/started attend le latch natif, ferme proprement et refuse les envois', async (t) => {
  const b = await banc(t, { consigne: 'WAIT_START' })
  assert.equal(b.pont.child.kill(), true)
  await assert.rejects(b.envoyer('late'), /\[métier/)
  const [code] = await b.sortie
  assert.equal(code, 0)
  const journal = readFileSync(join(b.dossier, `${b.sessionId}.codex.jsonl`), 'utf8')
  assert.match(journal, /"type":"fermeture"/)
  assert.doesNotMatch(journal, /no active turn|"type":"mort"/)
})
test('rapport invalidé par le runtime ne peut publier fin', async (t) => {
  const b = await banc(t, { validation: (p) => { if (p.rapport) throw Error('rapport interdit') } })
  await b.envoyer('FIN')
  const erreur = await b.veille()
  assert.equal(erreur.type, 'erreur')
  assert.match(erreur.cause, /rapport interdit/)
  const journal = readFileSync(join(b.dossier, `${b.sessionId}.codex.jsonl`), 'utf8')
  assert.doesNotMatch(journal, /"type":"fin"/)
})
test('rapport JSON absent devient une erreur et refus natif reste structuré', async (t) => {
  const b = await banc(t)
  await assert.rejects(b.envoyer('NATIVE_ERROR'), (e) => e.native.code === 77 && /\[métier/.test(e.message))
  await b.envoyer('INVALID')
  assert.match((await b.veille()).cause, /JSON invalide/)
})
test('crash : EOF signifie mort, diagnostic complet et première cause disponibles', async (t) => {
  const b = await banc(t)
  await b.envoyer('CRASH')
  await b.sortie
  const premier = await b.veille()
  assert.ok(['erreur', 'mort'].includes(premier.type))
  const journal = readFileSync(join(b.dossier, `${b.sessionId}.codex.jsonl`), 'utf8')
  assert.match(journal, /"type":"mort"/)
  assert.doesNotMatch(journal, /"type":"fin"/)
  assert.match(readFileSync(join(b.dossier, `${b.sessionId}.codex.stderr.log`), 'utf8'), /first native cause\nsecond native cause/)
  assert.ok(b.pont.cause())
})
test('approbation : attente publiée puis refus déterministe, aucune attente humaine', async (t) => {
  const b = await banc(t)
  await b.envoyer('APPROVAL')
  const attente = await b.veille()
  assert.equal(attente.type, 'approbation')
  const erreur = await b.veille(attente.seq)
  assert.equal(erreur.type, 'erreur')
  assert.match(erreur.cause, /\[permission/)
})
test('veille bornée et curseur fermé', async (t) => {
  const b = await banc(t)
  assert.equal((await veillerCodex({ ...b, timeoutMs: 0 })).type, 'aucune')
  await assert.rejects(veillerCodex({ ...b, depuis: -1 }), /\[validation/)
  await assert.rejects(veillerCodex({ ...b, timeoutMs: 25 }), /\[transitoire/)
})
test('borne serveur : réponse IPC porte le code canonique avant la borne client', async (t) => {
  const b = await banc(t)
  const socket = createConnection(process.platform === 'win32' ? `\\\\.\\pipe\\wfrp-codex-${b.sessionId}` : join(b.dossier, `${b.sessionId}.codex.sock`))
  t.after(() => socket.destroy())
  socket.setEncoding('utf8')
  await once(socket, 'connect')
  socket.write(JSON.stringify({ op: 'veiller', sessionId: b.sessionId, depuis: 0, timeoutMs: 10 }) + '\n')
  const [data] = await sousBorne(once(socket, 'data'), 1000)
  assert.deepEqual(JSON.parse(data), { erreur: prefixeDeRefus('transitoire') + ' Borne de veille Codex atteinte', code: 'BORNE_IPC_CODEX' })
})
test('borne transportée : suivi se réarme au raccord IPC puis reçoit la transition', async (t) => {
  const dossier = mkdtempSync(join(tmpdir(), 'wfrp-veille-raccord-')), sessionId = randomUUID()
  const adresse = process.platform === 'win32' ? `\\\\.\\pipe\\wfrp-codex-${sessionId}` : join(dossier, `${sessionId}.codex.sock`)
  const borne = { erreur: prefixeDeRefus('transitoire') + ' Borne de veille Codex atteinte', code: 'BORNE_IPC_CODEX' }
  const fin = { type: 'fin', etat: 'inactif', sessionId, seq: 1, curseur: 1 }
  let appels = 0, reponses = [borne, fin]
  const serveur = createServer((socket) => socket.once('data', () => {
    appels++
    const reponse = reponses.shift()
    socket.end(reponse === null ? undefined : JSON.stringify(reponse) + '\n')
  }))
  t.after(async () => { await new Promise((resolve) => serveur.close(resolve)); rmSync(dossier, { recursive: true, force: true }) })
  serveur.listen(adresse)
  await once(serveur, 'listening')
  const sessions = { attendre: (_cible, options) => veillerCodex({ dossier, sessionId, ...options }), etat: () => ({ etat: 'occupe' }) }
  assert.deepEqual(await attendreSuivi(sessions, sessionId, { depuis: 0, timeoutMs: 1000 }), fin)
  assert.equal(appels, 2)
  for (const reponse of [
    { erreur: borne.erreur },
    { erreur: prefixeDeRefus('permission') + ' refus', code: 'BORNE_IPC_CODEX' },
    { erreur: prefixeDeRefus('métier') + ' refus' },
    { erreur: borne.erreur, code: 'AUTRE' },
    { ...borne, native: 'permission' },
    null,
  ]) {
    reponses = [reponse]
    const avant = appels
    await assert.rejects(attendreSuivi(sessions, sessionId, { depuis: 0, timeoutMs: 1000 }), (e) => e.code !== 'BORNE_IPC_CODEX')
    assert.equal(appels, avant + 1)
  }
})
for (const etape of ['version', 'schéma']) {
  test(`protocole : timeout de mesure ${etape} retentable, erreur native conservée`, () => {
    const erreur = Object.assign(new Error(`spawnSync codex ${etape} ETIMEDOUT`), { code: 'ETIMEDOUT' })
    assert.throws(() => verifierProtocoleCodex({ executable: 'timeout', executer(exe, args) {
      if (etape === 'schéma' && args[0] === '--version') return { status: 0, stdout: 'codex-cli 0.163.0\n' }
      return { status: null, error: erreur }
    } }), (e) => {
      assert.equal(e.message, `${prefixeDeRefus('transitoire')} ${etape === 'version' ? 'Version' : 'Schéma'} Codex invérifiable`)
      assert.equal(e.native, erreur.message)
      return true
    })
  })
}
test('version protocole : binaire mesuré, schéma nécessaire et refus fermés', () => {
  assert.equal(VERSION_PROTOCOLE_CODEX, '0.163.0')
  assert.throws(() => verifierProtocoleCodex({ executable: 'missing', executer: () => ({ status: 1, stderr: 'absent' }) }), /\[panne/)
  assert.throws(() => verifierProtocoleCodex({ executable: 'old', executer: () => ({ status: 0, stdout: 'codex-cli 0.162.0\n' }) }), /\[validation/)
  const appels = []
  assert.throws(() => verifierProtocoleCodex({ executable: 'future', executer: (exe, args) => { appels.push([exe, args]); return args[0] === '--version' ? { status: 0, stdout: 'codex-cli 0.164.0\n' } : { status: 0 } } }), /\[panne/)
  assert.equal(appels[1][1][0], 'app-server')
  assert.equal(appels[1][0], 'future')
})
function corpusProtocole() {
  const chaine = { type: 'string' }
  const objet = (properties, required = Object.keys(properties)) => ({ type: 'object', properties, required })
  const nullable = (s) => ({ anyOf: [s, { type: 'null' }] })
  const texte = objet({ type: { type: 'string', enum: ['text'] }, text: chaine })
  const outils = ['commandExecution', 'fileChange', 'mcpToolCall', 'dynamicToolCall', 'collabAgentToolCall', 'webSearch', 'imageView', 'imageGeneration', 'sleep']
  const statuts = (enumere) => ({ type: 'string', enum: enumere })
  const communs = ['inProgress', 'completed', 'failed']
  const champs = {
    commandExecution: { command: chaine, status: statuts([...communs, 'declined']) },
    fileChange: { status: statuts([...communs, 'declined']) },
    mcpToolCall: { server: chaine, tool: chaine, status: statuts(communs) },
    dynamicToolCall: { tool: chaine, status: statuts(communs) },
    collabAgentToolCall: { tool: { allOf: [statuts(['spawnAgent', 'sendInput', 'resumeAgent', 'wait', 'closeAgent', 'sendMessage', 'followupTask', 'interruptAgent', 'listAgents'])] }, status: { allOf: [statuts([...communs, 'interrupted'])] } },
    imageGeneration: { status: chaine },
  }
  const item = { oneOf: [objet({ type: { type: 'string', enum: ['agentMessage'] }, text: chaine }), ...outils.map((v) => objet({ type: { type: 'string', enum: [v] }, id: chaine, ...champs[v] }))] }
  const tour = objet({ id: chaine, status: { type: 'string', enum: ['completed', 'interrupted', 'failed', 'inProgress'] }, items: { type: 'array', items: item }, durationMs: { type: ['integer', 'null'] }, error: nullable(objet({ message: chaine })) }, ['id', 'items', 'status'])
  const input = { type: 'array', items: { oneOf: [texte] } }
  return {
    'v1/InitializeParams': objet({ clientInfo: objet({ name: chaine, version: chaine }), capabilities: nullable(objet({ experimentalApi: { type: 'boolean' } }, [])) }, ['clientInfo']),
    'v1/InitializeResponse': objet({ userAgent: chaine }),
    'v2/ThreadStartParams': objet({ cwd: { type: ['string', 'null'] } }, []),
    'v2/ThreadStartResponse': objet({ thread: objet({ id: chaine }) }),
    'v2/TurnStartParams': objet({ threadId: chaine, input, outputSchema: {} }, ['input', 'threadId']),
    'v2/TurnStartResponse': objet({ turn: objet({ id: chaine }) }),
    'v2/TurnSteerParams': objet({ threadId: chaine, expectedTurnId: chaine, input }),
    'v2/TurnSteerResponse': objet({ turnId: chaine }),
    'v2/TurnInterruptParams': objet({ threadId: chaine, turnId: chaine }),
    'v2/TurnInterruptResponse': objet({}),
    'v2/TurnStartedNotification': objet({ threadId: chaine, turn: objet({ id: chaine }) }),
    'v2/TurnCompletedNotification': objet({ threadId: chaine, turn: tour }),
    'v2/ItemCompletedNotification': objet({ threadId: chaine, turnId: chaine, item }),
    'v2/ItemStartedNotification': objet({ threadId: chaine, turnId: chaine, item }),
    'v2/ThreadTokenUsageUpdatedNotification': objet({ threadId: chaine, turnId: chaine, tokenUsage: objet({ total: objet({ totalTokens: { type: 'integer' } }) }) }),
    'v2/ThreadStatusChangedNotification': objet({ threadId: chaine, status: { oneOf: [objet({ type: { type: 'string', enum: ['active'] }, activeFlags: { type: 'array', items: { type: 'string', enum: ['waitingOnApproval', 'waitingOnUserInput'] } } })] } }),
    'v2/ErrorNotification': objet({ threadId: chaine, error: objet({ message: chaine }) }),
  }
}
test('protocole : formes consommées requises, types, enums et nullabilité ; extensions ignorées', () => {
  function verifier(changer = () => {}) {
    return verifierProtocoleCodex({ executable: 'audited', executer(exe, args) {
      assert.equal(exe, 'audited')
      if (args[0] === '--version') return { status: 0, stdout: 'codex-cli 0.163.0\n' }
      const corpus = corpusProtocole()
      const defs = Object.fromEntries(Object.entries(corpus).map(([n, s]) => [n.split('/')[1], s]))
      const enveloppe = (methodes, request = false) => ({ definitions: defs, oneOf: Object.entries(methodes).map(([m, n]) => ({ type: 'object', properties: { method: { type: 'string', enum: [m] }, ...(n ? { params: { $ref: `#/definitions/${n}` } } : {}) }, required: ['method', ...(n ? ['params'] : []), ...(request ? ['id'] : [])] })) })
      corpus.ClientRequest = enveloppe({ initialize: 'InitializeParams', 'thread/start': 'ThreadStartParams', 'turn/start': 'TurnStartParams', 'turn/steer': 'TurnSteerParams', 'turn/interrupt': 'TurnInterruptParams' }, true)
      corpus.ClientNotification = enveloppe({ initialized: null })
      corpus.ServerNotification = enveloppe({ 'turn/started': 'TurnStartedNotification', 'turn/completed': 'TurnCompletedNotification', 'item/started': 'ItemStartedNotification', 'item/completed': 'ItemCompletedNotification', 'thread/tokenUsage/updated': 'ThreadTokenUsageUpdatedNotification', 'thread/status/changed': 'ThreadStatusChangedNotification', error: 'ErrorNotification' })
      changer(corpus)
      for (const [nom, document] of Object.entries(corpus)) {
        if (nom.includes('/')) mkdirSync(join(args[3], nom.split('/')[0]), { recursive: true })
        writeFileSync(join(args[3], `${nom}.json`), JSON.stringify(document))
      }
      return { status: 0 }
    } })
  }
  assert.equal(verifier().version, '0.163.0')
  assert.equal(verifier((c) => { c['v2/ThreadStartResponse'].description = 'prose'; c['v2/ThreadStartResponse'].properties.nouveau = { type: 'boolean' } }).version, '0.163.0')
  for (const changer of [
    (c) => { c['v2/ThreadStartResponse'].properties.thread.properties.id = { type: 'integer' } },
    (c) => { c['v2/ThreadStartResponse'].properties.thread.required = [] },
    (c) => { c['v2/TurnCompletedNotification'].properties.turn.properties.status.enum = ['completed'] },
    (c) => { c['v2/TurnCompletedNotification'].properties.turn.properties.durationMs.type = 'integer' },
    (c) => { c['v2/ItemCompletedNotification'].properties.item.oneOf.find((b) => b.properties.type.enum[0] === 'mcpToolCall').properties.tool.type = 'integer' },
    (c) => { c['v2/ItemStartedNotification'].properties.item.oneOf.find((b) => b.properties.type.enum[0] === 'commandExecution').properties.status.enum = ['inProgress'] },
    (c) => { c.ClientRequest.oneOf = c.ClientRequest.oneOf.filter((b) => b.properties.method.enum[0] !== 'turn/steer') },
  ]) assert.throws(() => verifier(changer), /\[validation.*incompatible/)
})
test('envoi, fin et arrêt concurrents : chaque commande est acquittée ou refusée, aucun rejet perdu', async (t) => {
  const b = await banc(t)
  const envoi = b.envoyer('FIN')
  const fermeture = envoi.then(() => b.pont.child.kill())
  const autre = b.envoyer('AUTO')
  const verdicts = await Promise.allSettled([envoi, autre, fermeture])
  assert.equal(verdicts[0].status, 'fulfilled')
  for (const v of verdicts) if (v.status === 'rejected') assert.match(v.reason.message, /^\[(métier|panne|transitoire)/)
  await b.sortie
  const transitions = readFileSync(join(b.dossier, `${b.sessionId}.codex.jsonl`), 'utf8').split('\n').filter(Boolean).map(JSON.parse).flatMap((x) => x.transition ? [x.transition] : [])
  assert.equal(transitions.at(-1).type, 'fermeture', JSON.stringify(transitions))
  assert.deepEqual(transitions.map((x) => x.seq), transitions.map((_, i) => i + 1))
})
test('IPC fermé : identité étrangère et thread libre refusés par le serveur', async (t) => {
  const b = await banc(t)
  const adresse = process.platform === 'win32' ? `\\\\.\\pipe\\wfrp-codex-${b.sessionId}` : join(b.dossier, `${b.sessionId}.codex.sock`)
  const raw = (q) => new Promise((resolve, reject) => {
    const s = createConnection(adresse)
    s.on('error', reject)
    s.on('connect', () => s.write(`${JSON.stringify(q)}\n`))
    let data = ''
    s.on('data', (x) => { data += x; if (data.includes('\n')) { s.destroy(); resolve(JSON.parse(data.trim())) } })
  })
  assert.match((await raw({ op: 'envoyer', sessionId: randomUUID(), jeton: b.jeton, message: 'x', requestId: 'r' })).erreur, /\[permission/)
  assert.match((await raw({ op: 'envoyer', sessionId: b.sessionId, jeton: b.jeton, message: 'x', requestId: 'r', threadId: 'external' })).erreur, /\[validation/)
})
