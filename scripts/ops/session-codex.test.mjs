import test from 'node:test'
import assert from 'node:assert/strict'
import { once } from 'node:events'
import { spawn } from 'node:child_process'
import { createHash, randomUUID } from 'node:crypto'
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, appendFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { createConnection } from 'node:net'
import { estPidVivantDepuis } from '../guards/lib/pid.mjs'
import { IDENTITE_MESUREE } from '../test/identiteMesuree.mjs'
import { lancerPontCodex, envoyerCodex, veillerCodex, verifierProtocoleCodex, projeterJournalCodex, VERSION_PROTOCOLE_CODEX, MAX_MESSAGE_CODEX } from './session-codex.mjs'

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
if(q.method==='thread/start')send({id:q.id,result:{thread:{id:tid}}});
if(q.method==='turn/start'){active='turn-'+(++turn);initial=p.input[0].text;started=false;send({id:q.id,result:{turn:{id:active}}});setTimeout(()=>{started=true;notify('turn/started',{turn:{id:active,status:'inProgress',items:[]}});if(initial==='AUTO'||initial==='INVALID')complete(initial);if(initial==='EOF_LIVE'){process.on('SIGTERM',()=>{});setInterval(()=>{},1000);notify('fixture/perte-protocole',{});}},initial==='WAIT_START'?150:5);}
if(q.method==='turn/steer'){if(p.threadId!==tid||p.expectedTurnId!==active)throw Error('foreign turn');const text=p.input[0].text;if(text==='NATIVE_ERROR')send({id:q.id,error:{code:77,message:'native refusal'}});else{send({id:q.id,result:{turnId:active,steers:++steers}});if(text==='CRASH'){process.stderr.write('first native cause\\nsecond native cause\\n');process.exit(9);}else if(text==='APPROVAL'){notify('request/input',{});send({id:900,method:'item/tool/requestUserInput',params:{threadId:tid}});}else setTimeout(()=>complete(text),5);}}
if(q.method==='turn/interrupt'){if(!started)send({id:q.id,error:{code:1,message:'no active turn'}});else {send({id:q.id,result:{}});notify('turn/completed',{turn:{id:active,status:'interrupted',items:[]}});active=null;}}
}).on('close',()=>{if(initial!=='EOF_LIVE')process.exit(0)});
`
async function banc(t, { consigne = 'BUSY', validation = () => {} } = {}) {
  const dossier = mkdtempSync(join(tmpdir(), 'wfrp-pont-banc-'))
  const fixture = join(dossier, 'app-server.mjs')
  writeFileSync(fixture, FIXTURE)
  const sessionId = randomUUID(), jeton = 'secret-exclusif-pont'
  const projections = [], affichage = []
  let natif, naissanceNatif, vivantALaRupture = false
  const pont = lancerPontCodex({
    plan: { executable: process.execPath, args: [fixture] },
    carte: { sessionId, worktree: dossier, empreinteJeton: createHash('sha256').update(jeton).digest('hex') },
    dossier, consigne, schema: { type: 'object' }, env: process.env,
    echo(texte) { affichage.push(texte) },
    notifier(p) { validation(p); projections.push(p) }, lancer(...args) {
      natif = spawn(...args)
      naissanceNatif = IDENTITE_MESUREE.lireCreation(natif.pid)
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
  const sortie = once(pont.child, 'exit')
  t.after(async () => {
    const secours = setTimeout(() => natif.kill('SIGKILL'), 3000)
    try { pont.child.kill(); await sortie } finally { clearTimeout(secours); rmSync(dossier, { recursive: true, force: true }) }
  })
  const base = { dossier, sessionId, jeton, timeoutMs: 2000 }
  return { ...base, pont, projections, affichage, sortie, naissanceNatif, vivantALaRupture: () => vivantALaRupture, envoyer: (message, requestId = randomUUID()) => envoyerCodex({ ...base, message, requestId }), veille: (depuis = 0) => veillerCodex({ ...base, depuis }) }
}
async function sousBorne(promesse, ms) {
  let timer
  try { return await Promise.race([promesse, new Promise((_, reject) => { timer = setTimeout(() => reject(Error('Processus natif toujours vivant après borne')), ms) })]) }
  finally { clearTimeout(timer) }
}

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
test('projection : coupe au mot et premier mot long sous budget de traitement', (t) => {
  const dossier = mkdtempSync(join(tmpdir(), 'wfrp-projection-mot-'))
  t.after(() => rmSync(dossier, { recursive: true, force: true }))
  const fichier = join(dossier, 'native.jsonl'), sortie = []
  const textes = ['a '.repeat(2045) + 'chevauchement suite', 'x'.repeat(10_000)]
  writeFileSync(fichier, CONTEXTE_PROJECTION + textes.map((text) => JSON.stringify(notificationProjection('item/completed', { item: { type: 'agentMessage', text } }))).join('\n') + '\n')
  projeterJournalCodex(fichier, (s) => sortie.push(s))()
  assert.equal(sortie[0], '[Codex] Agent : ' + 'a '.repeat(2044) + 'a…\n')
  assert.ok(sortie[0].length <= '[Codex] Agent : '.length + 4096 + 1)
  assert.equal(sortie[1], '[Codex] Agent : ' + 'x'.repeat(8192) + '\n')
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
test('projection : sortie standard réelle par défaut et ligne invalide sans perte de la suite', (t) => {
  const dossier = mkdtempSync(join(tmpdir(), 'wfrp-projection-stdout-'))
  t.after(() => rmSync(dossier, { recursive: true, force: true }))
  const fichier = join(dossier, 'native.jsonl'), sortie = []
  writeFileSync(fichier, CONTEXTE_PROJECTION + '{cassé}\n' + JSON.stringify(notificationProjection('turn/completed', { turn: { id: 'turn-owned', status: 'interrupted' } })) + '\n')
  const write = process.stdout.write
  try {
    process.stdout.write = (s) => { sortie.push(s); return true }
    projeterJournalCodex(fichier)()
  } finally { process.stdout.write = write }
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
