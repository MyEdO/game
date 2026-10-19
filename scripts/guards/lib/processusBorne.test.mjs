import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { mesurerArbreProcessus } from './arbreProcessus.mjs'
import { arretIndetermine } from './arretNatif.mjs'
import { relancerApresNettoyage } from './controleEcritures.mjs'
import { diagnosticDuLancement, diagnosticArret, spawnBorne, tuerArbre } from './processusBorne.mjs'
import { BACKOFFS_MS, STATUS_DLL_INIT_FAILED } from './spawnResilient.mjs'

function banc(t) {
  const dossier = mkdtempSync(join(tmpdir(), 'borne-controle-'))
  t.after(() => rmSync(dossier, { recursive: true, force: true }))
  return { fichier: join(dossier, 'sortie'), limiteMs: 3000, fluxDistincts: true }
}

function fabriqueDeFixture(source, { resultat, etat = 'mort', retarderFin = 0, surDemande = () => {} } = {}) {
  return async () => {
    const hote = spawn(process.execPath, ['-e', source], { stdio: ['ignore', 'pipe', 'pipe'] })
    const controle = { pid: hote.pid, pret: new Promise((ok) => hote.once('spawn', () => ok({ pidCible: hote.pid, instanceCible: 'fixture' }))),
      demanderArret(cause) { surDemande(cause); hote.kill('SIGTERM') },
      fin: new Promise((ok) => hote.once('close', (status, signal) => setTimeout(() => ok({ resultatCible: resultat ?? { status, signal }, arret: { pid: hote.pid, etat, erreurs: [] } }), retarderFin))) }
    return { hote, controle }
  }
}

test('capture : vrais flux hôte, UTF8 entier et résultat cible distinct du code hôte', async (t) => {
  const p = banc(t)
  const r = await spawnBorne({ ...p, argv: [], superviser: fabriqueDeFixture("process.stdout.write('é'.repeat(200));process.stderr.write('è'.repeat(200))", { resultat: { status: 23, signal: null } }) })
  assert.equal(r.code, 23); assert.equal(r.status, 23); assert.equal(r.signal, null); assert.equal(r.error, null)
  assert.equal(r.stdout, 'é'.repeat(200)); assert.equal(r.stderr, 'è'.repeat(200))
  assert.equal(readFileSync(p.fichier, 'utf8'), r.sortie)
  assert.equal(r.sortie.length, 400); assert.equal(r.arret.etat, 'mort')
})

test('capture : flux unifiés par défaut, journaux vidés à chaque lancement', async (t) => {
  const p = banc(t)
  for (const texte of ['premier', 'second']) {
    const r = await spawnBorne({ ...p, fluxDistincts: false, argv: [], superviser: fabriqueDeFixture(`console.log('${texte}')`) })
    assert.equal(r.stdout, ''); assert.equal(r.stderr, '')
    assert.equal(r.sortie, texte + '\n'); assert.equal(readFileSync(p.fichier, 'utf8'), texte + '\n')
  }
})

test('factory asynchrone : surControle précède pret et surPid désigne la cible', async (t) => {
  const p = banc(t); const appels = []
  let valeurControle
  const factory = fabriqueDeFixture('setTimeout(()=>{},20)')
  const r = await spawnBorne({ ...p, argv: [], superviser: async (...args) => {
    await Promise.resolve()
    const lancement = await factory(...args)
    valeurControle = lancement.controle
    return lancement
  }, surControle: (controle) => { appels.push('controle'); assert.equal(controle, valeurControle) }, surPid: (pid) => { appels.push('pid'); assert.equal(pid, valeurControle.pid) } })
  assert.equal(r.code, 0); assert.deepEqual(appels, ['controle', 'pid'])
  assert.equal(r.controle, valeurControle)
})

test('annulation préalable : aucune ouverture ni factory', async (t) => {
  const p = banc(t); const signal = AbortSignal.abort()
  const r = await spawnBorne({ ...p, argv: [], signal, superviser: () => assert.fail('factory interdite') })
  assert.equal(r.annulee, true); assert.equal(r.code, 1); assert.equal(r.arret.etat, 'mort')
  assert.equal(existsSync(p.fichier), false)
})

test('annulation pendant attente factory : demande mémorisée, fin native attendue', async (t) => {
  const p = banc(t); const annulation = new AbortController(); let demandes = 0
  const factory = fabriqueDeFixture('setInterval(()=>{},1000)', { surDemande: () => { demandes++ } })
  const r = await spawnBorne({ ...p, argv: [], signal: annulation.signal, superviser: async (...args) => {
    annulation.abort()
    return factory(...args)
  } })
  assert.equal(r.annulee, true); assert.equal(r.code, 1); assert.equal(r.arret.etat, 'mort'); assert.equal(demandes, 1)
})

test('plafond : demande au propriétaire puis attente de fin sans seconde horloge', async (t) => {
  const p = banc(t); let demandes = 0
  const r = await spawnBorne({ ...p, limiteMs: 30, argv: [], superviser: fabriqueDeFixture('setInterval(()=>{},1000)', { retarderFin: 50, surDemande: (cause) => { assert.equal(cause.code, 'ETIMEDOUT'); demandes++ } }) })
  assert.equal(r.expiree, true); assert.equal(r.code, 1); assert.equal(r.arret.etat, 'mort'); assert.equal(demandes, 1)
})

test('capture bornée en octets : ENOBUFS demande arrêt, journal borné et fin attendue', async (t) => {
  const p = banc(t); let demandes = 0
  const r = await spawnBorne({ ...p, maxBuffer: 9, argv: [], superviser: fabriqueDeFixture("process.stdout.write('é'.repeat(20));setInterval(()=>{},1000)", { surDemande: () => { demandes++ } }) })
  assert.equal(r.error.code, 'ENOBUFS'); assert.equal(r.code, 1); assert.equal(r.arret.etat, 'mort'); assert.equal(demandes, 1)
  assert.equal(readFileSync(p.fichier).length, 9)
})

test('zéro hôte ne remplace ni erreur cible ni certificat indéterminé', async (t) => {
  const p = banc(t)
  const erreurCible = await spawnBorne({ ...p, argv: [], superviser: fabriqueDeFixture('', { resultat: { status: null, signal: null, error: { code: 'ENOENT', message: 'cible absente' } } }) })
  assert.equal(erreurCible.error.code, 'ENOENT'); assert.equal(erreurCible.code, 1)
  const indetermine = await spawnBorne({ ...p, argv: [], superviser: fabriqueDeFixture('', { etat: 'indetermine' }) })
  assert.equal(indetermine.code, 1); assert.equal(indetermine.error.code, 'ARRET_INDETERMINE')
})

test('échec factory avant hôte : résultat d’erreur fermé et fd libéré', async (t) => {
  const p = banc(t)
  const r = await spawnBorne({ ...p, argv: [], superviser: async () => { throw Object.assign(new Error('capacité absente'), { code: 'EPREREQUIS' }) } })
  assert.equal(r.error.code, 'EPREREQUIS'); assert.equal(r.code, 1); assert.equal(r.arret.etat, 'indetermine')
  rmSync(p.fichier)
})

test('échec factory après le spawn de l’hôte : arrêt indéterminé, jamais `mort` sans fin native', async (t) => {
  const p = banc(t)
  const r = await spawnBorne({ ...p, argv: [], superviser: async () => {
    const hote = spawn(process.execPath, ['-e', ''], { stdio: 'ignore' })
    await new Promise((ok) => hote.once('close', ok))
    throw Object.assign(new Error('contrôle natif perdu'), { code: 'ECONTROLE' })
  } })
  assert.equal(r.arret.etat, 'indetermine'); assert.equal(r.code, 1); assert.equal(r.error.code, 'ECONTROLE')
  assert.deepEqual(r.arret.erreurs.map((e) => [e.operation, e.code]), [['lancement', 'ECONTROLE']])
})

test('exception callback : arrêt du vrai hôte et fin attendue', async (t) => {
  const p = banc(t); let demandes = 0
  const r = await spawnBorne({ ...p, argv: [], superviser: fabriqueDeFixture('setInterval(()=>{},1000)', { surDemande: () => { demandes++ } }), surControle() { throw new Error('callback impossible') } })
  assert.equal(r.code, 1); assert.match(r.error.message, /callback impossible/); assert.equal(demandes, 1)
})

test('une cause sans prototype levée par `surPid` arrête la vraie cible avant l’échéance et se diagnostique sans lever', async (t) => {
  const cause = Object.create(null)
  const r = await spawnBorne({ ...banc(t), limiteMs: 20000, argv: ['-e', 'setInterval(()=>{},1000)'], surPid() { throw cause } })
  assert.equal(r.error, cause)
  assert.deepEqual([r.code, r.expiree, r.arret.etat], [1, false, 'mort'], JSON.stringify(diagnosticDuLancement(r)))
  const lignes = []
  diagnosticArret(r, (l) => lignes.push(l))
  assert.deepEqual(lignes, ['[gates] erreur : [object Object]'])
})

test('rejeu au chargement : l’annulation réveille l’attente du rejeu et rend l’annulation, sans second lancement', async (t) => {
  const annulation = new AbortController(); let lancements = 0
  const debut = Date.now()
  const r = await spawnBorne({ ...banc(t), argv: [], signal: annulation.signal, superviser: async () => {
    lancements++
    setTimeout(() => annulation.abort(), 30)
    const fin = Promise.resolve({ resultatCible: { status: STATUS_DLL_INIT_FAILED, signal: null }, arret: { pid: 5, etat: 'mort', erreurs: [] } })
    return { hote: {}, controle: { pid: 5, pret: Promise.resolve({ pidCible: 5, instanceCible: 'fixture' }), fin, finPhysique: Promise.resolve(), demanderArret() {} } }
  } })
  const duree = Date.now() - debut
  assert.equal(lancements, 1)
  assert.deepEqual({ code: r.code, annulee: r.annulee, status: r.status }, { code: 1, annulee: true, status: null })
  assert.ok(duree < BACKOFFS_MS[0] / 2, `sortie à ${duree} ms, attente de rejeu ${BACKOFFS_MS[0]} ms`)
})

test('tuerArbre : demande immédiate et résultat de l’unique fin', async () => {
  const demandes = []; let finir
  const fin = new Promise((ok) => { finir = ok })
  const controle = { demanderArret(cause) { demandes.push(cause) }, fin }
  const arret = { etat: 'mort', erreurs: [] }
  const attente = tuerArbre(controle, 'cause')
  assert.deepEqual(demandes, ['cause'])
  finir({ arret }); assert.equal(await attente, arret)
})

test('arrêt indéterminé : une cause sans code garde sa chaîne, jamais son nom de classe pour code', () => {
  const racine = Object.assign(new Error('pipe rompu'), { code: 'EPIPE' })
  const cause = new AggregateError([racine], 'fins natives rompues')
  const arret = arretIndetermine({ operation: 'fin', pid: 77, cause })
  assert.deepEqual(arret.erreurs.map(({ operation, code, message }) => ({ operation, code, message })), [{ operation: 'fin', code: undefined, message: 'fins natives rompues' }])
  assert.equal(arret.erreurs[0].cause, cause)
  const lignes = []
  diagnosticArret({ arret }, (l) => lignes.push(l))
  assert.deepEqual(lignes.slice(0, 2), ['[gates] arrêt indéterminé : fin PID 77 AggregateError — fins natives rompues', '[gates] cause agrégée : EPIPE — pipe rompu'])
})

test('bornes : refus avant toute factory et ouverture', () => {
  for (const options of [{ maxBuffer: -1 }, { maxBuffer: 0.5 }, { limiteMs: NaN }, { limiteMs: Infinity }, { delaiArretMs: 0 }, { delaiArretMs: 2147483648 }])
    assert.throws(() => spawnBorne({ argv: [], fichier: 'interdit', limiteMs: 100, ...options, superviser: () => assert.fail('factory interdite') }), { code: 'BORNE_INVALIDE' })
})

test('diagnostic : causes agrégées et cycliques, secrets de lancement exclus', () => {
  const cause = Object.assign(new Error('racine'), { code: 'EIO' })
  const error = new AggregateError([cause], 'agrégée', { cause }); cause.cause = error
  const d = diagnosticDuLancement({ error, argv: ['secret'], env: { TOKEN: 'secret' }, arret: { etat: 'indetermine', erreurs: [] } })
  assert.equal(d.error.cause.cause.cycle, true)
  assert.ok(!JSON.stringify(d).includes('secret'))
  const lignes = []; assert.equal(diagnosticArret({ error, arret: { etat: 'indetermine', erreurs: [] } }, (l) => lignes.push(l)), true)
  assert.match(lignes.join('\n'), /EIO — racine/)
  for (const ligne of lignes) assert.match(ligne, /^\[gates\] [^\n]+$/)
  assert.equal(diagnosticArret({ arret: { etat: 'mort', erreurs: [] } }, () => {}), false)
})

test('diagnostic : une erreur sans code s’imprime sous son nom, une valeur nue sous son seul message', () => {
  const lignes = []
  diagnosticArret({ error: new TypeError('acquisition échouée'), defautCollecte: 'collecte rompue', arret: { etat: 'mort', erreurs: [] } }, (l) => lignes.push(l))
  assert.deepEqual(lignes, ['[gates] erreur : TypeError — acquisition échouée', '[gates] collecte : collecte rompue'])
})

/** Les lignes de `diagnosticArret(resultat)` hors projection JSON, jugées : aucune valeur absente imprimée, aucun corps (ligne
 *  sans son contexte) répété, chaque couple code–message de chaque chaîne cité, le rôle de collecte et l'en-tête de chaque
 *  entrée d'arrêt présents (#2586). */
function diagnosticJuge(resultat) {
  const lignes = []
  diagnosticArret(resultat, (l) => lignes.push(l))
  const lues = lignes.filter((l) => !l.startsWith('[gates] diagnostic arrêt : '))
  const texte = lues.join('\n')
  assert.ok(!/undefined|null/.test(texte), texte)
  const corps = lues.map((l) => l.slice('[gates] '.length).replace(/^(?:erreur|cause|cause agrégée|collecte) : |^arrêt indéterminé : (?:\S+ )?(?:PID \d+ ?)?/, '')).filter(Boolean)
  assert.deepEqual(corps.filter((c, i) => corps.indexOf(c) !== i), [], texte)
  const vues = new Set()
  const recenser = (e) => {
    if (e == null || vues.has(e)) return
    vues.add(e)
    if (typeof e !== 'object') { assert.ok(texte.includes(String(e)), `${e} : ${texte}`); return }
    assert.ok(texte.includes(e.code ? `${e.code} — ${e.message}` : e.message), `${e.code} — ${e.message} : ${texte}`)
    recenser(e.cause); for (const c of e.errors ?? []) recenser(c)
  }
  recenser(resultat.error); recenser(resultat.defautCollecte); for (const e of resultat.arret?.erreurs ?? []) recenser(e)
  if (resultat.defautCollecte) assert.match(texte, /^\[gates\] collecte : /m)
  for (const e of resultat.arret?.erreurs ?? []) assert.ok(lues.some((l) => l.startsWith(['[gates] arrêt indéterminé :', e.operation, e.pid == null ? '' : `PID ${e.pid}`].filter(Boolean).join(' '))), texte)
  return lues
}

test('diagnostic, banc des résultats de production : rien de perdu, rien de répété, aucun rôle ni en-tête effacé', async (t) => {
  const err = (code, message) => Object.assign(new Error(message), { code })
  const lanceur = err('ELANCEUR', 'lanceur cassé')
  diagnosticJuge({ code: 1, error: lanceur, arret: arretIndetermine({ operation: 'lancement', cause: lanceur, message: 'lanceur levé : arrêt non prouvé' }) })
  const agrege = await spawnBorne({ ...banc(t), argv: [], superviser: async () => relancerApresNettoyage(err('EPANNE', 'écouteur de l’hôte levé'), () => { throw err('EBUSY', 'rmdir occupé') }) })
  assert.equal(agrege.error.name, 'AggregateError')
  assert.ok(diagnosticJuge(agrege).includes('[gates] cause agrégée : EPANNE — écouteur de l’hôte levé'))
  const parent = err('EPARENT', 'parent disparu')
  const certifie = { pid: 9, etat: 'indetermine', erreurs: [parent, 'EWORKER statut non nul', 'EWORKER statut non nul'].flatMap((cause) => arretIndetermine({ operation: 'cloture', pid: 9, cause }).erreurs) }
  assert.deepEqual(diagnosticJuge({ code: 1, error: parent, arret: certifie }), ['[gates] erreur : EPARENT — parent disparu', '[gates] arrêt indéterminé : cloture PID 9', '[gates] arrêt indéterminé : cloture PID 9 EWORKER statut non nul'])
  const vue = err('EMESURE', 'vue absente')
  assert.deepEqual(diagnosticJuge({ code: 1, error: new Error('lancement interrompu ou arrêt non confirmé', { cause: vue }), defautCollecte: vue, arret: { pid: 3, etat: 'mort', erreurs: [] } }),
    ['[gates] erreur : Error — lancement interrompu ou arrêt non confirmé', '[gates] collecte : EMESURE — vue absente'])
  diagnosticJuge({ code: 1, error: new Error('lancement interrompu ou arrêt non confirmé', { cause: err('ETIMEDOUT', 'échéance 20 ms') }),
    arret: arretIndetermine({ operation: 'cloture', pid: 4, cause: err('ECONTROLE', 'EOF du worker avant résultat') }) })
})

test('diagnostic d’un hôte natif réellement tué : chaque message une seule fois, l’entrée d’arrêt nommée', { timeout: 30000 }, async (t) => {
  const p = banc(t)
  const r = await spawnBorne({ ...p, limiteMs: 20000, argv: ['-e', 'setInterval(()=>{},1000)'], surPid: () => {
    const hote = mesurerArbreProcessus().find((h) => h.ppid === process.pid && /^(?:powershell|python)/i.test(h.nom))
    assert.ok(hote, 'hôte natif propriétaire présent')
    process.kill(hote.pid)
  } })
  assert.equal(r.arret.etat, 'indetermine', JSON.stringify(diagnosticDuLancement(r)))
  const lignes = []
  assert.equal(diagnosticArret(r, (l) => lignes.push(l)), true)
  const lues = lignes.filter((l) => !l.startsWith('[gates] diagnostic arrêt : '))
  const messages = new Set()
  const recenser = (e) => { if (e && typeof e === 'object') { messages.add(e.message); recenser(e.cause); for (const c of e.errors ?? []) recenser(c) } }
  recenser(r.error); for (const e of r.arret.erreurs) recenser(e)
  for (const message of messages) assert.equal(lues.filter((l) => l.endsWith(message)).length, 1, message + ' : ' + JSON.stringify(lues))
  assert.ok(lues.some((l) => l.startsWith(`[gates] arrêt indéterminé : ${r.arret.erreurs[0].operation} PID ${r.arret.pid}`)), JSON.stringify(lues))
})
