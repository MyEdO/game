import test from 'node:test'
import assert from 'node:assert/strict'
import { once } from 'node:events'
import { spawn } from 'node:child_process'
import { createHash, randomUUID } from 'node:crypto'
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { createConnection } from 'node:net'
import { lancerPontCodex, envoyerCodex, veillerCodex, verifierProtocoleCodex, VERSION_PROTOCOLE_CODEX, MAX_MESSAGE_CODEX } from './session-codex.mjs'

const FIXTURE = `
import {createInterface} from 'node:readline';
const send=x=>process.stdout.write(JSON.stringify(x)+'\\n');
const tid='thread-owned';let turn=0,active,started=false,initial,steers=0;
const notify=(method,params)=>send({method,params:{threadId:tid,...params}});
function complete(text){if(active===null)return;const id=active;notify('thread/tokenUsage/updated',{turnId:id,tokenUsage:{total:{totalTokens:42}}});notify('item/started',{turnId:id,item:{id:'tool1',type:'commandExecution'}});notify('item/completed',{turnId:id,item:{id:'tool1',type:'commandExecution'}});for(let i=0;i<4;i++)notify('item/agentMessage/delta',{turnId:id,delta:'delta'});const report=text==='INVALID'?'invalid':JSON.stringify({resultat:text,sessionId:'fixture'});notify('item/completed',{turnId:id,item:{id:'answer',type:'agentMessage',text:report}});notify('thread/status/changed',{status:{type:'idle'}});const fin={turn:{id,status:'completed',items:[],durationMs:321}};notify('turn/completed',fin);if(text==='DUPLICATE')notify('turn/completed',fin);active=null;}
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
  const projections = []
  let natif, vivantALaRupture = false
  const pont = lancerPontCodex({
    plan: { executable: process.execPath, args: [fixture] },
    carte: { sessionId, worktree: dossier, empreinteJeton: createHash('sha256').update(jeton).digest('hex') },
    dossier, consigne, schema: { type: 'object' }, env: process.env,
    notifier(p) { validation(p); projections.push(p) }, lancer(...args) {
      natif = spawn(...args)
      let flux = ''
      natif.stdout.on('data', (b) => {
        flux += b.toString()
        if (flux.includes('fixture/perte-protocole')) {
          process.kill(natif.pid, 0)
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
  return { ...base, pont, projections, sortie, vivantALaRupture: () => vivantALaRupture, envoyer: (message, requestId = randomUUID()) => envoyerCodex({ ...base, message, requestId }), veille: (depuis = 0) => veillerCodex({ ...base, depuis }) }
}
async function sousBorne(promesse, ms) {
  let timer
  try { return await Promise.race([promesse, new Promise((_, reject) => { timer = setTimeout(() => reject(Error('Processus natif toujours vivant après borne')), ms) })]) }
  finally { clearTimeout(timer) }
}

test('EOF vivant : perte du protocole tue le processus natif sous borne, sans faux exit', async (t) => {
  const b = await banc(t, { consigne: 'EOF_LIVE' })
  const [code, signal] = await sousBorne(b.sortie, 2800)
  assert.equal(b.vivantALaRupture(), true)
  assert.ok(code !== 0 || signal)
  assert.throws(() => process.kill(b.pont.child.pid, 0), /ESRCH|no such process/i)
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
  const item = { oneOf: [objet({ type: { type: 'string', enum: ['agentMessage'] }, text: chaine }), ...outils.map((v) => objet({ type: { type: 'string', enum: [v] }, id: chaine }))] }
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
