import { test } from 'node:test'
import assert from 'node:assert/strict'
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
  return { dossier, fichier: join(dossier, 'sortie'), limiteMs: 20000, fluxDistincts: true }
}
const SUPERVISION = { timeout: 30000 }
const diagnostic = (r) => JSON.stringify(diagnosticDuLancement(r))

test('capture : flux réels de la cible, UTF8 entier, statut de la cible', SUPERVISION, async (t) => {
  const p = banc(t)
  const r = await spawnBorne({ ...p, argv: ['-e', "process.stdout.write('é'.repeat(200));process.stderr.write('è'.repeat(200));process.exitCode=23"] })
  assert.deepEqual([r.code, r.status, r.signal, r.error, r.arret.etat], [23, 23, null, null, 'mort'], diagnostic(r))
  assert.equal(r.stdout, 'é'.repeat(200)); assert.equal(r.stderr, 'è'.repeat(200))
  assert.equal(readFileSync(p.fichier, 'utf8'), r.sortie)
  assert.equal(r.sortie.length, 400)
})

test('capture : flux unifiés par défaut, journaux vidés à chaque lancement', SUPERVISION, async (t) => {
  const p = banc(t)
  for (const texte of ['premier', 'second']) {
    const r = await spawnBorne({ ...p, fluxDistincts: false, argv: ['-e', `console.log('${texte}')`] })
    assert.equal(r.stdout, ''); assert.equal(r.stderr, '')
    assert.equal(r.sortie, texte + '\n', diagnostic(r)); assert.equal(readFileSync(p.fichier, 'utf8'), texte + '\n')
  }
})

test('surControle reçoit le contrôle rendu avant que surPid reçoive le PID de sa cible', SUPERVISION, async (t) => {
  const appels = []; let recu
  const r = await spawnBorne({ ...banc(t), argv: ['-e', 'setTimeout(()=>{},20)'],
    surControle: (controle) => { appels.push('controle'); recu = controle }, surPid: (pid) => { appels.push('pid'); assert.equal(pid, recu.pid) } })
  assert.equal(r.code, 0, diagnostic(r)); assert.deepEqual(appels, ['controle', 'pid'])
  assert.equal(r.controle, recu); assert.equal(r.pid, recu.pid)
})

test('annulation préalable : rien n’est ouvert ni lancé', async (t) => {
  const p = banc(t); const signal = AbortSignal.abort()
  const r = await spawnBorne({ ...p, argv: ['-e', 'process.exit(0)'], signal })
  assert.deepEqual([r.annulee, r.code, r.pid], [true, 1, undefined])
  assert.equal(existsSync(p.fichier), false)
})

test('annulation pendant le lancement, puis en vol : jamais un succès, la cible lancée arrêtée par son propriétaire natif', SUPERVISION, async (t) => {
  const pendant = new AbortController()
  const attente = spawnBorne({ ...banc(t), argv: ['-e', 'setInterval(()=>{},1000)'], signal: pendant.signal })
  pendant.abort()
  const lancement = await attente
  assert.deepEqual([lancement.annulee, lancement.code], [true, 1], diagnostic(lancement))
  const enVol = new AbortController()
  const r = await spawnBorne({ ...banc(t), argv: ['-e', 'setInterval(()=>{},1000)'], signal: enVol.signal, surPid: () => enVol.abort() })
  assert.deepEqual([r.annulee, r.expiree, r.code, r.arret.etat], [true, false, 1, 'mort'], diagnostic(r))
})

test('plafond : l’échéance demande l’arrêt au propriétaire natif, dont la fin est attendue', SUPERVISION, async (t) => {
  const r = await spawnBorne({ ...banc(t), limiteMs: 1500, argv: ['-e', 'setInterval(()=>{},1000)'] })
  assert.deepEqual([r.expiree, r.code, r.arret.etat], [true, 1, 'mort'], diagnostic(r))
})

test('capture bornée en octets : ENOBUFS demande l’arrêt, journal borné et fin attendue', SUPERVISION, async (t) => {
  const p = banc(t)
  const r = await spawnBorne({ ...p, maxBuffer: 9, argv: ['-e', "process.stdout.write('é'.repeat(20));setInterval(()=>{},1000)"] })
  assert.deepEqual([r.error?.code, r.code, r.expiree, r.arret.etat], ['ENOBUFS', 1, false, 'mort'], diagnostic(r))
  assert.equal(readFileSync(p.fichier).length, 9)
})

test('une cible introuvable échoue en ENOENT sous un arrêt prouvé', SUPERVISION, async (t) => {
  const p = banc(t)
  const r = await spawnBorne({ ...p, commande: join(p.dossier, 'introuvable.exe'), argv: [] })
  assert.deepEqual([r.error?.code, r.code, r.arret.etat], ['ENOENT', 1, 'mort'], diagnostic(r))
})

test('refus du superviseur avant l’hôte : un dossier de travail absent échoue sous son nom, le journal libéré', SUPERVISION, async (t) => {
  const p = banc(t); const cwd = join(p.dossier, 'absent')
  const r = await spawnBorne({ ...p, cwd, argv: ['--version'] })
  assert.deepEqual([r.code, r.error?.code, r.error?.message], [1, 'ENOENT', 'dossier de travail absent : ' + cwd], diagnostic(r))
  rmSync(p.fichier)
})

test('exception de surControle : l’arrêt du vrai hôte est demandé et sa fin attendue', SUPERVISION, async (t) => {
  const r = await spawnBorne({ ...banc(t), argv: ['-e', 'setInterval(()=>{},1000)'], surControle() { throw new Error('callback impossible') } })
  assert.equal(r.code, 1); assert.match(r.error.message, /callback impossible/); assert.equal(r.arret.etat, 'mort', diagnostic(r))
})

test('une cause sans prototype levée par `surPid` arrête la vraie cible avant l’échéance et se diagnostique sans lever', async (t) => {
  const cause = Object.create(null)
  const r = await spawnBorne({ ...banc(t), limiteMs: 20000, argv: ['-e', 'setInterval(()=>{},1000)'], surPid() { throw cause } })
  assert.equal(r.error, cause)
  assert.deepEqual([r.code, r.expiree, r.arret.etat], [1, false, 'mort'], diagnostic(r))
  const lignes = []
  diagnosticArret(r, (l) => lignes.push(l))
  assert.deepEqual(lignes, ['[gates] erreur : [object Object]'])
})

test('rejeu au chargement : l’annulation réveille l’attente du rejeu et rend l’annulation, sans second lancement',
  { skip: process.platform !== 'win32' && 'STATUS_DLL_INIT_FAILED est un statut du chargeur Windows', ...SUPERVISION }, async (t) => {
    const annulation = new AbortController(); let lancements = 0; let finPremier
    const r = await spawnBorne({ ...banc(t), argv: ['-e', `process.exit(${STATUS_DLL_INIT_FAILED})`], signal: annulation.signal,
      surControle: (controle) => {
        lancements++
        controle.fin.then(() => { finPremier = Date.now(); setTimeout(() => annulation.abort(), 30) })
      } })
    const attente = Date.now() - finPremier
    assert.equal(lancements, 1)
    assert.deepEqual({ code: r.code, annulee: r.annulee, status: r.status }, { code: 1, annulee: true, status: null }, diagnostic(r))
    assert.ok(attente < BACKOFFS_MS[0] / 2, `sortie ${attente} ms après la fin du premier essai, attente de rejeu ${BACKOFFS_MS[0]} ms`)
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

test('bornes : refus avant toute ouverture', (t) => {
  const { fichier } = banc(t)
  for (const options of [{ maxBuffer: -1 }, { maxBuffer: 0.5 }, { limiteMs: NaN }, { limiteMs: Infinity }, { delaiArretMs: 0 }, { delaiArretMs: 2147483648 }])
    assert.throws(() => spawnBorne({ argv: ['-e', 'process.exit(0)'], fichier, limiteMs: 100, ...options }), { code: 'BORNE_INVALIDE' })
  assert.equal(existsSync(fichier), false)
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
  assert.deepEqual([r.arret.etat, r.code], ['indetermine', 1], JSON.stringify(diagnosticDuLancement(r)))
  const lignes = []
  assert.equal(diagnosticArret(r, (l) => lignes.push(l)), true)
  const lues = lignes.filter((l) => !l.startsWith('[gates] diagnostic arrêt : '))
  const messages = new Set()
  const recenser = (e) => { if (e && typeof e === 'object') { messages.add(e.message); recenser(e.cause); for (const c of e.errors ?? []) recenser(c) } }
  recenser(r.error); for (const e of r.arret.erreurs) recenser(e)
  for (const message of messages) assert.equal(lues.filter((l) => l.endsWith(message)).length, 1, message + ' : ' + JSON.stringify(lues))
  assert.ok(lues.some((l) => l.startsWith(`[gates] arrêt indéterminé : ${r.arret.erreurs[0].operation} PID ${r.arret.pid}`)), JSON.stringify(lues))
})
