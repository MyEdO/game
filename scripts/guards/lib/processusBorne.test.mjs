import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
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

/** Contrôle natif sans processus dont la `fin` REJETTE par `cause`, d'elle-même (`spontanee`) ou à la demande d'arrêt. */
function controleAFinRejetee(cause, { spontanee = false } = {}) {
  let rejeter; const demandes = []
  const fin = new Promise((_, non) => { rejeter = non })
  fin.catch(() => {})
  if (spontanee) rejeter(cause)
  return { demandes, controle: { pid: 77, pret: Promise.resolve({ pidCible: 77, instanceCible: 'fixture' }), fin, finPhysique: Promise.resolve(),
    demanderArret(raison) { demandes.push(raison); rejeter(cause) } } }
}

test('fin native rejetée : arrêt indéterminé nommé par sa cause, jamais un rejet ni une demande d’arrêt sans motif', async (t) => {
  const cause = Object.assign(new Error('fin native rompue'), { code: 'EFIN' })
  const arretAttendu = { pid: 77, etat: 'indetermine', erreurs: [{ operation: 'fin', pid: 77, code: 'EFIN', message: 'fin native rompue', cause }] }
  const seule = controleAFinRejetee(cause, { spontanee: true })
  const r = await spawnBorne({ ...banc(t), argv: [], superviser: async () => ({ hote: {}, controle: seule.controle }) })
  assert.equal(r.code, 1); assert.deepEqual(r.arret, arretAttendu); assert.equal(r.error.code, 'EFIN'); assert.equal(r.error.cause, cause)
  assert.deepEqual(seule.demandes, [])
  const sansPret = controleAFinRejetee(cause, { spontanee: true })
  sansPret.controle.pret = new Promise(() => {})
  const p = await spawnBorne({ ...banc(t), argv: [], superviser: async () => ({ hote: {}, controle: sansPret.controle }) })
  assert.deepEqual(p.arret, arretAttendu, 'une fin rejetée ne garantit plus pret : son attente ne retient pas le rendu')
  const surException = controleAFinRejetee(cause)
  const s = await spawnBorne({ ...banc(t), argv: [], superviser: async () => ({ hote: {}, controle: surException.controle }),
    surControle() { throw Object.assign(new Error('callback impossible'), { code: 'ECALLBACK' }) } })
  assert.equal(s.code, 1); assert.deepEqual(s.arret, arretAttendu); assert.equal(s.error.code, 'ECALLBACK')
  assert.equal(surException.demandes.length, 1)
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
  const absent = Object.assign(new Error('arrêt sans propriétaire natif'), { code: 'CONTROLE_ABSENT' })
  assert.deepEqual(await tuerArbre(null), { pid: undefined, etat: 'indetermine', erreurs: [{ operation: 'controle', pid: undefined, code: 'CONTROLE_ABSENT', message: 'arrêt sans propriétaire natif', cause: absent }] })
})

test('tuerArbre : une fin rejetée rend l’arrêt indéterminé nommé par sa cause', async () => {
  const cause = Object.assign(new Error('fin native rompue'), { code: 'EFIN' })
  const { controle, demandes } = controleAFinRejetee(cause)
  assert.deepEqual(await tuerArbre(controle, 'cause'), { pid: 77, etat: 'indetermine', erreurs: [{ operation: 'fin', pid: 77, code: 'EFIN', message: 'fin native rompue', cause }] })
  assert.deepEqual(demandes, ['cause'])
})

test('tuerArbre : une cause sans code garde sa chaîne, jamais son nom de classe pour code', async () => {
  const racine = Object.assign(new Error('pipe rompu'), { code: 'EPIPE' })
  const cause = new AggregateError([racine], 'fins natives rompues')
  const arret = await tuerArbre(controleAFinRejetee(cause).controle, 'cause')
  assert.deepEqual(arret.erreurs.map(({ operation, code, message }) => ({ operation, code, message })), [{ operation: 'fin', code: undefined, message: 'fins natives rompues' }])
  assert.equal(arret.erreurs[0].cause, cause)
  const lignes = []
  diagnosticArret({ arret }, (l) => lignes.push(l))
  assert.deepEqual(lignes.slice(0, 3), ['[gates] arrêt indéterminé : fin PID 77 fins natives rompues', '[gates] cause : AggregateError — fins natives rompues', '[gates] cause agrégée : EPIPE — pipe rompu'])
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
