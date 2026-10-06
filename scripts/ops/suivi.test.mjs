// CLIQUET du suivi de vague (node --test) : la grammaire et le rendu sont PURS ; l'écriture se joue
// sur un dossier jetable sous `os.tmpdir()` avec un `fs` injecté ; la portée se mesure sur un dépôt
// FORGÉ (fixture partagée + origin nu), issues injectées. La fixture `fixtures/suivi-1816.md` est la
// copie à l'octet de `.git/suivi/1816.md` du 2026-09-28, premier suivi réel.
// Lancé par `npm run test:ops`.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { DEPOT } from '../guards/lib/ticketsGh.mjs'
import { execFileSync, spawn } from 'node:child_process'
import * as FS from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { instanceDeDepot } from '../guards/lib/depotGabarit.mjs'
import { GESTES_DU_BOARD, indexerIssues, mesurer } from './board.mjs'
import {
  HEURES_PEREMPTION, LIGNES_D_UN_TICKET_FERME, MARQUE_DEBUT, MARQUE_FIN, PLAFOND_INJECTION, digestDuSuivi, ecrireSuivi,
  gabaritDuSuivi, horodatage, lireHorodatage, listerSuivis, mesureProfilee, renduDuSuivi,
  suivre, texteDeLaListe, ticketsPrevus, zonesDe, JOURNAL, argumentsDuSuivi, editer, editionDuSuivi, etatDeSession,
  ESSAIS_D_EDITION, structureDuSuivi, ligneDeJournal, lignesDeSituation, lignesDuJournal,
} from './suivi.mjs'
import { gitDe, lancerGit } from '../test/gitDeBanc.mjs'

const REEL = FS.readFileSync(new URL('./fixtures/suivi-1816.md', import.meta.url), 'utf8')
const REEL_CRLF = REEL.replace(/\r?\n/g, '\r\n')
const MAINTENANT = new Date(2026, 8, 29, 14, 3)
const MESURE = {
  ok: true,
  lignes: [{ ticket: 2132, statut: 'Ouvert', etatIssue: 'ouvert', branches: ['chantier/2132-suivi'], worktrees: [], avance: '+1 / −0', dernierCommit: '2026-09-28' }],
  anomalies: ['branche sans ticket dérivable : ab/phanes'],
}
const rendre = (texte, mesure = MESURE) => renduDuSuivi({ texte, mesure, epique: 1816, maintenant: MAINTENANT })

test('le suivi RÉEL #1816 prévoit [2132, 1988, 1887], sans anomalie, en LF comme en CRLF', () => {
  const sections = new Map([[2132, 30], [1988, 51], [1887, 28]])
  assert.deepEqual(ticketsPrevus(REEL), { tickets: [2132, 1988, 1887], sections, anomalies: [], refus: null })
  assert.deepEqual(ticketsPrevus(REEL_CRLF), { tickets: [2132, 1988, 1887], sections, anomalies: [], refus: null })
})

test('la zone ÉCRITE ressort intacte À L’OCTET, marqueurs absents puis présents, LF et CRLF', () => {
  for (const texte of [REEL, REEL_CRLF]) {
    const premier = rendre(texte)
    assert.ok(premier.startsWith(texte), 'marqueurs absents : la zone est AJOUTÉE en fin, rien avant ne bouge')
    const ecrite = premier.slice(0, premier.indexOf(MARQUE_DEBUT))
    const second = rendre(premier, { ok: false, refus: 'origin non consultable' })
    assert.equal(second.slice(0, second.indexOf(MARQUE_DEBUT)), ecrite)
    assert.match(second, /\*\*Mesure refusée le 2026-09-29 14:03\*\* : origin non consultable/)
    assert.equal(rendre(second), premier, 'la même mesure rend le même texte')
    const fin = texte === REEL_CRLF ? '\r\n' : '\n'
    assert.equal(premier.split(fin).length, premier.split('\n').length, 'la zone mesurée prend la fin de ligne du fichier')
  }
  const autour = `# T\n\n## En cours\n1. #5\n${MARQUE_DEBUT}\r\nvieux\n${MARQUE_FIN}\r\n\n## Après\r\nfin sans retour`
  const rendu = rendre(autour)
  assert.ok(rendu.startsWith(`# T\n\n## En cours\n1. #5\n${MARQUE_DEBUT}\r\n`), 'avant la zone, à l’octet ; un fichier qui porte un CRLF rend sa zone en CRLF')
  assert.ok(rendu.endsWith(`${MARQUE_FIN}\r\n\n## Après\r\nfin sans retour`), 'ce qui SUIT la zone reste à l’octet, fin du marqueur comprise')
  const derniere = `## En cours\n1. #5\n${MARQUE_DEBUT}\n${MARQUE_FIN}`
  assert.ok(rendre(derniere).endsWith(`\n${MARQUE_FIN}`), 'un marqueur de fin sans retour final le reste')
})

test('point fixe : la zone rendue ne change jamais les tickets prévus, ni les anomalies de grammaire', () => {
  for (const texte of [REEL, REEL_CRLF, '## En cours\n1. #7\n2. sans ticket\n', gabaritDuSuivi(9)]) {
    const rendu = rendre(texte)
    assert.deepEqual(ticketsPrevus(rendu), ticketsPrevus(texte))
    assert.deepEqual(ticketsPrevus(rendre(rendu)), ticketsPrevus(texte))
  }
})

test('grammaire : item sans #N, #N en gras, sous-item indenté ou en colonne 0, premier #N, commentaires, code, parenthèse, numéro inexistant', () => {
  const cas = [
    ['item sans #N, ticket nommé dans une sous-puce', '## En cours\n1. Train H de la phase 3\n   - chantier #1988\n2. #1887 lot 7\n', [1887], [/^item 1 sans ticket \(l\.2\)/]],
    ['#N en gras', '## En cours\n1. **#1887 lot 6a-2**\n', [1887], []],
    ['item imbriqué numéroté, indenté', '## En cours\n1. #1887 lot 6a-2\n   1. attendre #2125\n2. #1988\n', [1887, 1988], []],
    ['sous-item en COLONNE 0 : c’est un item', '## En cours\n1. #1887 lot 6a-2\n1. sous-étape bloquée par #2125\n', [1887, 2125], []],
    ['le PREMIER #N de la ligne', '## En cours\n1. Etape #2 du plan : #1887 lot 7\n', [2], []],
    ['gabarit commenté sur plusieurs lignes', '## En cours\n<!--\n1. #1234 exemple\n-->\n', [], []],
    ['gabarit commenté sur une ligne', '## En cours\n<!-- 1. #1234 exemple -->\n', [], []],
    ['bloc de code dans la section', '## En cours\n1. #1887\n```\n2. #9999 sortie collée\n```\n', [1887], []],
    ['item à parenthèse', '## En cours\n1) #1887\n', [], [/^ligne hors grammaire qui porte un #N \(l\.2\)/]],
    ['numéro inexistant : la grammaire le prend, la mesure le dira introuvable', '## En cours\n1. #21320 (faute de frappe)\n', [21320], []],
  ]
  for (const [nom, texte, tickets, anomalies] of cas) {
    const vu = ticketsPrevus(texte)
    assert.deepEqual(vu.tickets, tickets, nom)
    assert.equal(vu.anomalies.length, anomalies.length, `${nom} : ${JSON.stringify(vu.anomalies)}`)
    anomalies.forEach((re, i) => assert.match(vu.anomalies[i], re, nom))
  }
})

test('clôtures CommonMark nettoyées AVANT la découpe : un `## ` dans un bloc ne coupe pas la section, ``` ne ferme pas ````', () => {
  const b = ['## En cours', '1. #2132', '```', '## exemple collé', '```', '2. #1988', '## Autre', ''].join('\n')
  const unParTicket = new Map([[2132, 1], [1988, 1]])
  assert.deepEqual(ticketsPrevus(b), { tickets: [2132, 1988], sections: unParTicket, anomalies: [], refus: null })
  const c = ['## En cours', '1. #2132', '````', '```', '3. #999', '```', '````', '2. #1988', ''].join('\n')
  assert.deepEqual(ticketsPrevus(c), { tickets: [2132, 1988], sections: unParTicket, anomalies: [], refus: null })
  const tilde = ['## En cours', '1. #1', '  ~~~ js', '2. #999', '```', '~~~~', '3. #3', ''].join('\n')
  assert.deepEqual(ticketsPrevus(tilde).tickets, [1, 3], 'une clôture ~ se ferme par ~, indentée de 0 à 3 espaces')
  const ouvert = ticketsPrevus(['## En cours', '1. #1', '```', '2. #999', '## Autre', '3. #3'].join('\n'))
  assert.deepEqual(ouvert.tickets, [1])
  assert.deepEqual(ouvert.anomalies, ['bloc de code non fermé (ouvert l.3) : il court jusqu\'à la fin du document'])
})

test('anomalies : lignes de colonne 0 hors grammaire, numéro invalide, item sans ticket ; dédoublonnage', () => {
  const vu = ticketsPrevus(['## En cours', '1.#1887', '- #1887', '1) #1887', '  - #42 indenté : une étape', '1. #00',
    '2. rien', '3. #5', '4. #5 encore', 'Texte libre sans numéro', '## Suite', '- #77 hors section'].join('\n'))
  assert.deepEqual(vu.tickets, [5])
  assert.deepEqual(vu.anomalies.map((a) => a.replace(/ :.*$/, '')), [
    'ligne hors grammaire qui porte un #N (l.2)',
    'ligne hors grammaire qui porte un #N (l.3)',
    'ligne hors grammaire qui porte un #N (l.4)',
    'numéro invalide à l\'item 1 (l.6)',
    'item 2 sans ticket (l.7)',
  ])
})

test('refus nommés : section absente, marqueurs doublés ou désordonnés', () => {
  assert.match(ticketsPrevus('# Suivi\n1. #5\n').refus, /section `## En cours` absente/)
  assert.match(ticketsPrevus('## En cours précis\n').refus ?? '', /^$/)
  assert.equal(ticketsPrevus('## En coursier\n1. #5\n').refus !== null, true, '`\\b` : « En coursier » n’est pas la section')
  const double = `## En cours\n${MARQUE_DEBUT}\n${MARQUE_DEBUT}\n${MARQUE_FIN}\n`
  assert.match(ticketsPrevus(double).refus, /doublés ou désordonnés : debut l\.2, debut l\.3, fin l\.4/)
  const inverse = `## En cours\n${MARQUE_FIN}\n${MARQUE_DEBUT}\n`
  assert.match(zonesDe(inverse).refus, /fin l\.2, debut l\.3/)
  assert.throws(() => rendre(inverse), /désordonnés/)
  assert.deepEqual(zonesDe(`## En cours\n  ${MARQUE_DEBUT}\n`).debut, -1, 'un marqueur est une LIGNE ENTIÈRE')
})

const dossierJetable = () => FS.mkdtempSync(join(tmpdir(), 'suivi-'))
const restes = (dossier) => FS.readdirSync(dossier).filter((n) => n.endsWith('.tmp'))

test('écriture : texte changé → refus, cible intacte, aucun temporaire ; sinon remplacée', () => {
  const dossier = dossierJetable()
  try {
    const cible = join(dossier, '7.md')
    FS.writeFileSync(cible, 'édité ailleurs')
    const refus = ecrireSuivi({ cible, contenu: 'neuf', attendu: 'lu avant', geste: 'la mesure', pid: 11 })
    assert.equal(refus.ok, false)
    assert.match(refus.refus, /a changé pendant la mesure/)
    assert.equal(FS.readFileSync(cible, 'utf8'), 'édité ailleurs')
    assert.deepEqual(restes(dossier), [])
    assert.deepEqual(ecrireSuivi({ cible, contenu: 'neuf', attendu: 'édité ailleurs', geste: 'la mesure', pid: 11 }), { ok: true })
    assert.equal(FS.readFileSync(cible, 'utf8'), 'neuf')
    assert.deepEqual(restes(dossier), [])
  } finally { FS.rmSync(dossier, { recursive: true, force: true }) }
})

test('écriture : rename en EPERM/EACCES/EBUSY → refus « tenu », sans temporaire ; une autre erreur est relancée', () => {
  const dossier = dossierJetable()
  try {
    const cible = join(dossier, '7.md')
    FS.writeFileSync(cible, 'avant')
    const jette = (code) => ({ ...FS, renameSync: () => { throw Object.assign(new Error(code), { code }) } })
    for (const code of ['EPERM', 'EACCES', 'EBUSY']) {
      const vu = ecrireSuivi({ cible, contenu: 'neuf', attendu: 'avant', geste: 'la mesure', fs: jette(code), pid: 12 })
      assert.deepEqual([vu.ok, /suivi tenu par un autre processus/.test(vu.refus)], [false, true], code)
      assert.equal(FS.readFileSync(cible, 'utf8'), 'avant')
      assert.deepEqual(restes(dossier), [], code)
    }
    assert.throws(() => ecrireSuivi({ cible, contenu: 'neuf', attendu: 'avant', geste: 'la mesure', fs: jette('ENOSPC'), pid: 12 }), /ENOSPC/)
    assert.deepEqual(restes(dossier), [])
  } finally { FS.rmSync(dossier, { recursive: true, force: true }) }
})

test('écriture : temporaire non écrit, ou cible disparue → refus NOMMÉ, sans temporaire restant', () => {
  const dossier = dossierJetable()
  try {
    const cible = join(dossier, '7.md')
    FS.writeFileSync(cible, 'avant')
    const plein = {
      ...FS,
      writeFileSync: (chemin) => { FS.writeFileSync(chemin, 'part'); throw Object.assign(new Error('ENOSPC'), { code: 'ENOSPC' }) },
    }
    const nonEcrit = ecrireSuivi({ cible, contenu: 'neuf', attendu: 'avant', geste: 'la mesure', fs: plein, pid: 13 })
    assert.equal(nonEcrit.ok, false)
    assert.match(nonEcrit.refus, /temporaire .*\.7\.md\.13\.tmp non écrit \(ENOSPC\)/)
    assert.equal(FS.readFileSync(cible, 'utf8'), 'avant')
    assert.deepEqual(restes(dossier), [])
    FS.rmSync(cible)
    const disparue = ecrireSuivi({ cible, contenu: 'neuf', attendu: 'avant', geste: 'la mesure', pid: 13 })
    assert.equal(disparue.ok, false)
    assert.match(disparue.refus, /7\.md a disparu pendant la mesure/)
    assert.equal(FS.existsSync(cible), false, 'une cible disparue n’est pas recréée')
    assert.deepEqual(restes(dossier), [])
  } finally { FS.rmSync(dossier, { recursive: true, force: true }) }
})

test('écriture : temporaire non écrit ET non supprimable → refus qui nomme les deux erreurs et le temporaire restant', () => {
  const dossier = dossierJetable()
  try {
    const cible = join(dossier, '7.md')
    FS.writeFileSync(cible, 'avant')
    const tenu = {
      ...FS,
      writeFileSync: (chemin) => { FS.writeFileSync(chemin, 'part'); throw Object.assign(new Error('ENOSPC'), { code: 'ENOSPC' }) },
      rmSync: () => { throw Object.assign(new Error('EPERM'), { code: 'EPERM' }) },
    }
    const vu = ecrireSuivi({ cible, contenu: 'neuf', attendu: 'avant', geste: 'la mesure', fs: tenu, pid: 14 })
    assert.equal(vu.ok, false)
    assert.match(vu.refus, /non écrit \(ENOSPC\).*temporaire RESTANT, non supprimé \(EPERM\) : .*\.7\.md\.14\.tmp$/)
    assert.equal(FS.readFileSync(cible, 'utf8'), 'avant')
    assert.deepEqual(listerSuivis({ dossier }).orphelins, ['.7.md.14.tmp'], 'le temporaire restant est retrouvé par le listage')
  } finally { FS.rmSync(dossier, { recursive: true, force: true }) }
})

test('écriture : une erreur RELANCÉE garde son code, et son message nomme le temporaire que le nettoyage n’a pas pu supprimer', () => {
  const dossier = dossierJetable()
  try {
    const cible = join(dossier, '7.md')
    FS.writeFileSync(cible, 'avant')
    const temporaire = join(dossier, '.7.md.15.tmp')
    const suffixe = ` ; temporaire RESTANT, non supprimé (EPERM) : ${temporaire}`
    const erreur = (code) => Object.assign(new Error(code), { code })
    const rmBloque = () => { throw erreur('EPERM') }
    const cas = {
      'relecture en EACCES': { ...FS, rmSync: rmBloque, readFileSync: (chemin, ...r) => (chemin === cible ? (() => { throw erreur('EACCES') })() : FS.readFileSync(chemin, ...r)) },
      'rename en ENOENT': { ...FS, rmSync: rmBloque, renameSync: () => { throw erreur('ENOENT') } },
    }
    for (const [nom, fs] of Object.entries(cas)) {
      const code = nom.endsWith('EACCES') ? 'EACCES' : 'ENOENT'
      assert.throws(
        () => ecrireSuivi({ cible, contenu: 'neuf', attendu: 'avant', geste: 'la mesure', fs, pid: 15 }),
        (e) => e.code === code && e.message === `${code}${suffixe}`,
        nom,
      )
      assert.equal(FS.readFileSync(cible, 'utf8'), 'avant', nom)
      assert.deepEqual(listerSuivis({ dossier }).orphelins, ['.7.md.15.tmp'], nom)
    }
  } finally { FS.rmSync(dossier, { recursive: true, force: true }) }
})

test('suivre : la cible disparaît PENDANT la mesure → refus nommé, rien n’est recréé', () => {
  const dossier = dossierJetable()
  try {
    const cible = join(dossier, '5.md')
    FS.writeFileSync(cible, '## En cours\n1. #1\n')
    const mesure = mesureFactice({ fetch: 0, issues: [] }, {
      issues: (numeros) => { FS.rmSync(cible); return indexerIssues([], numeros) },
    })
    const vu = suivre({ numero: 5, dossier, mesure })
    assert.equal(vu.code, 1)
    assert.match(vu.stderr, /5\.md a disparu pendant la mesure : rien n'est écrit/)
    assert.equal(FS.existsSync(cible), false)
    assert.deepEqual(restes(dossier), [])
  } finally { FS.rmSync(dossier, { recursive: true, force: true }) }
})

test('listage : les suivis avec leur date, les orphelins NOMMÉS à part, un .tmp hors motif et le journal ignorés', () => {
  const dossier = dossierJetable()
  try {
    for (const nom of ['2132.md', '1816.md', '.1816.md.4242.tmp', 'notes.md', 'x.tmp', '.a.md.1.tmp', '.1816.md.tmp', '.journal']) {
      FS.writeFileSync(join(dossier, nom), '')
    }
    const vu = listerSuivis({ dossier })
    assert.deepEqual(vu.suivis.map((s) => s.nom), ['1816.md', '2132.md'])
    assert.ok(vu.suivis.every((s) => s.date instanceof Date))
    assert.deepEqual(vu.orphelins, ['.1816.md.4242.tmp'])
    const texte = texteDeLaListe({ dossier, ...vu })
    assert.match(texte, new RegExp(`^1816\\.md\\t${horodatage(vu.suivis[0].date)}\\n`))
    assert.match(texte, /ORPHELINS[^\n]*\n {2}\.1816\.md\.4242\.tmp\n$/)
    assert.equal(FS.existsSync(join(dossier, '.1816.md.4242.tmp')), true, 'un orphelin n’est jamais supprimé en silence')
    assert.match(texteDeLaListe({ dossier: join(dossier, 'absent'), ...listerSuivis({ dossier: join(dossier, 'absent') }) }), /aucun suivi/)
  } finally { FS.rmSync(dossier, { recursive: true, force: true }) }
})

/** Des gestes de mesure FACTICES : un dépôt sans branche, `fetchOrigin` COMPTÉ, issues comptées. */
function mesureFactice(compte, { fetchOrigin, issues } = {}) {
  const fait = (valeur) => ({ disponible: true, valeur })
  return {
    cwd: '/dep',
    gestes: {
      arbrePrincipal: () => fait('/dep'),
      fetchOrigin: fetchOrigin ?? (() => { compte.fetch += 1; return fait({ status: 0, signal: null, stdout: '', stderr: '' }) }),
      branchesDe: () => [],
      divergenceDe: () => ({ avance: 0, retard: 0 }),
      journalDe: () => [],
    },
    inv: () => ({ ok: true, worktrees: [{ chemin: '/dep', principal: true, branche: 'main' }] }),
    issues: issues ?? ((numeros) => { compte.issues.push(numeros); return indexerIssues(numeros.map((n) => ({ number: n, state: 'open' })), numeros) }),
  }
}

test('--creer annonce fetch et inventaire avant leurs gestes, conserve le profil final', () => {
  const dossier = join(dossierJetable(), 'suivi')
  const sorties = []
  const mesure = mesureFactice({ fetch: 0, issues: [] }, { fetchOrigin: () => {
    assert.equal(sorties.at(-1), '[suivi] fetchOrigin — début\n')
    return { disponible: true, valeur: { status: 0, signal: null, stdout: '', stderr: '' } }
  } })
  const inv = mesure.inv
  mesure.inv = (...args) => {
    assert.equal(sorties.at(-1), '[suivi] inv — début\n')
    return inv(...args)
  }
  mesure.annoncer = (texte) => sorties.push(texte)
  try {
    const vu = suivre({ numero: 2329, dossier, creer: true, mesure })
    assert.equal(vu.code, 0, vu.stderr)
    assert.match(vu.stdout, /\[suivi\] profil \(ms\)/)
    assert.match(sorties.join(''), /fetchOrigin — fin \(\d+ ms\)/)
  } finally { FS.rmSync(dossier, { recursive: true, force: true }) }
})

test('--creer : gabarit, portée VIDE donc aucune lecture d’issues, un fetch ; puis refus si le fichier existe', () => {
  const dossier = join(dossierJetable(), 'suivi')
  try {
    const compte = { fetch: 0, issues: [] }
    const vu = suivre({ numero: 9, dossier, creer: true, maintenant: MAINTENANT, mesure: mesureFactice(compte) })
    assert.equal(vu.code, 0, vu.stderr)
    assert.deepEqual([compte.fetch, compte.issues], [1, []])
    const texte = FS.readFileSync(join(dossier, '9.md'), 'utf8')
    assert.ok(texte.startsWith(gabaritDuSuivi(9).slice(0, gabaritDuSuivi(9).indexOf(MARQUE_DEBUT))))
    assert.match(texte, /Aucun ticket prévu/)
    assert.equal(vu.stdout.startsWith(texte), true, 'le fichier ENTIER est imprimé, puis le profil')
    assert.match(vu.stdout, /\[suivi\] profil \(ms\) : arbrePrincipal \d+ · fetchOrigin \d+ · branchesDe \d+ · divergenceDe \d+ · journalDe \d+ · inv \d+ · issues \d+ · total \d+ · reste -?\d+\.\d\n$/)
    const encore = suivre({ numero: 9, dossier, creer: true, mesure: mesureFactice(compte) })
    assert.deepEqual([encore.code, /existe déjà/.test(encore.stderr)], [1, true])
    const absent = suivre({ numero: 10, dossier, mesure: mesureFactice(compte) })
    assert.deepEqual([absent.code, /`npm run ops:suivi -- 10 --creer`/.test(absent.stderr)], [1, true])
  } finally { FS.rmSync(join(dossier, '..'), { recursive: true, force: true }) }
})

test('suivre : UNE lecture d’issues sur la portée seule, zéro fetch sous --sans-fetch', () => {
  const dossier = dossierJetable()
  try {
    FS.writeFileSync(join(dossier, '1816.md'), REEL)
    const compte = { fetch: 0, issues: [] }
    const vu = suivre({ numero: 1816, dossier, sansFetch: true, maintenant: MAINTENANT, mesure: mesureFactice(compte) })
    assert.equal(vu.code, 0, vu.stderr)
    assert.deepEqual([compte.fetch, compte.issues], [0, [[2132, 1988, 1887]]])
    const texte = FS.readFileSync(join(dossier, '1816.md'), 'utf8')
    assert.ok(texte.startsWith(REEL))
    assert.match(texte, /\| #2132 \| Ouvert \| ouvert \| {2}\|/)
    assert.match(texte, /origin non rafraîchi \(--sans-fetch\)/)
    assert.deepEqual(restes(dossier), [])
  } finally { FS.rmSync(dossier, { recursive: true, force: true }) }
})

test('suivre : la portée change PENDANT la mesure → refus, l’édition concurrente n’est pas écrasée', () => {
  const dossier = dossierJetable()
  try {
    const cible = join(dossier, '5.md')
    FS.writeFileSync(cible, '## En cours\n1. #1\n')
    const compte = { fetch: 0, issues: [] }
    const mesure = mesureFactice(compte, {
      issues: (numeros) => { FS.appendFileSync(cible, '2. #2\n'); return indexerIssues([], numeros) },
    })
    const vu = suivre({ numero: 5, dossier, mesure })
    assert.equal(vu.code, 1)
    assert.match(vu.stderr, /la portée de .* a changé pendant la mesure \(\[1\] → \[1,2\]\)/)
    assert.equal(FS.readFileSync(cible, 'utf8'), '## En cours\n1. #1\n2. #2\n')
    assert.deepEqual(restes(dossier), [])
  } finally { FS.rmSync(dossier, { recursive: true, force: true }) }
})

test('suivre : une mesure REFUSÉE réécrit la zone avec son motif daté, code non nul ; elle cite la commande d’ops:suivi', () => {
  const dossier = dossierJetable()
  try {
    FS.writeFileSync(join(dossier, '5.md'), '## En cours\n1. #1\n')
    const mesure = mesureFactice({ fetch: 0, issues: [] }, { fetchOrigin: () => ({
      disponible: false, issue: 'refus', raison: 'réseau coupé',
      diagnostic: { status: null, signal: null, stderr: 'stderr début\nCAUSE TARDIVE stderr', stdout: 'stdout début\nCAUSE TARDIVE stdout' },
    }) })
    const vu = suivre({ numero: 5, dossier, maintenant: MAINTENANT, mesure })
    assert.equal(vu.code, 1)
    const texte = FS.readFileSync(join(dossier, '5.md'), 'utf8')
    assert.ok(texte.includes('**Mesure refusée le 2026-09-29 14:03** : origin non consultable (refus (status ?) — réseau coupé stderr début CAUSE TARDIVE stderr stdout début CAUSE TARDIVE stdout) — la mesure contre origin/main serait fausse ; `npm run ops:suivi -- 5 --sans-fetch` mesure sur les refs déjà là\n'))
    assert.match(texte, /`npm run ops:suivi -- 5 --sans-fetch` mesure sur les refs déjà là/)
    const jette = mesureFactice({ fetch: 0, issues: [] }, { fetchOrigin: () => { throw new Error('git introuvable') } })
    assert.match(FS.readFileSync(join(dossier, '5.md'), 'utf8'), /origin non consultable/)
    assert.equal(suivre({ numero: 5, dossier, maintenant: MAINTENANT, mesure: jette }).code, 1)
    assert.match(FS.readFileSync(join(dossier, '5.md'), 'utf8'), /\*\*Mesure refusée le 2026-09-29 14:03\*\* : git introuvable/)
  } finally { FS.rmSync(dossier, { recursive: true, force: true }) }
})

test('profil : chaque geste de GESTES_DU_BOARD, inv et issues chronométrés ; reste = total − somme', () => {
  let t = 0
  const horloge = () => { t += 1; return t }
  const { vu, profil } = mesureProfilee({ ...mesureFactice({ fetch: 0, issues: [] }), portee: [1], horloge })
  assert.equal(vu.ok, true)
  assert.deepEqual(Object.keys(profil.durees), [...Object.keys(GESTES_DU_BOARD), 'inv', 'issues'])
  const somme = Object.values(profil.durees).reduce((a, b) => a + b, 0)
  assert.equal(profil.reste, profil.total - somme)
  assert.ok(Object.entries(profil.durees).every(([nom, ms]) => (nom === 'divergenceDe' ? ms === 0 : ms > 0)), JSON.stringify(profil.durees))
})

test('portée sur dépôt FORGÉ : une ligne par ticket, dans SON ordre ; publié puis fermé conservé ; introuvable nommé', () => {
  const nu = FS.mkdtempSync(join(tmpdir(), 'origin-nu-'))
  lancerGit(['init', '--bare', '-q', '-b', 'main', nu])
  const { racine } = instanceDeDepot({ fichiers: { 'a.txt': 'a' }, message: 'fondation' })
  const git = gitDe(racine, { net: true })
  try {
    git('remote', 'add', 'origin', nu)
    git('commit', '-q', '--allow-empty', '-m', 'feat(x): refs #1759 — publié')
    git('push', '-q', 'origin', 'main')
    git('switch', '-q', '-c', 'chantier/2132-suivi')
    git('commit', '-q', '--allow-empty', '-m', 'wip')
    git('switch', '-q', 'main')
    const lectures = []
    const issues = (numeros) => {
      lectures.push(numeros)
      return indexerIssues([
        { number: 2132, state: 'open' }, { number: 1988, state: 'open' }, { number: 1759, state: 'closed' },
        { number: 1887, state: 'open' },
      ], numeros)
    }
    const portee = [2132, 1988, 1759, 1]
    const vu = mesurer({ cwd: racine, base: 'origin/main', portee, issues })
    assert.equal(vu.ok, true, vu.refus)
    assert.deepEqual(lectures, [portee], 'UNE lecture, sur la portée SEULE')
    assert.deepEqual(vu.lignes.map((l) => [l.ticket, l.statut, l.etatIssue, l.branches]), [
      [2132, 'En cours', 'ouvert', ['chantier/2132-suivi']],
      [1988, 'Ouvert', 'ouvert', []],
      [1759, 'Fermé', 'fermé', []],
      [1, 'Introuvable', 'introuvable', []],
    ])
    assert.match(vu.lignes[2].dernierCommit, /^\d{4}-\d{2}-\d{2}$/, 'la publication de #1759 date sa ligne')
    assert.deepEqual(vu.anomalies, [`ticket #1 introuvable dans ${DEPOT}`])
    assert.deepEqual(mesurer({ cwd: racine, base: 'origin/main', portee: [], issues }).lignes, [])
    assert.equal(lectures.length, 1, 'une portée VIDE ne lit aucune issue')
  } finally {
    for (const d of [racine, nu]) FS.rmSync(d, { recursive: true, force: true })
  }
})

const CHEMIN = '.git/suivi/1816.md'
const digest = (texte, options = {}) => digestDuSuivi(texte, { epique: 1816, chemin: CHEMIN, mtime: MAINTENANT, maintenant: MAINTENANT, ...options })

test('T2 — digestDuSuivi du suivi RÉEL : sous PLAFOND_INJECTION, chaque item et chaque étape `[ ]`, aucun `[x]`', () => {
  const vu = digest(REEL)
  assert.ok(vu.length <= PLAFOND_INJECTION, `${vu.length} > ${PLAFOND_INJECTION}`)
  const lignes = REEL.split('\n')
  for (const ligne of lignes.filter((l) => /^\d+\.\s/.test(l) || l.includes('[ ]'))) assert.ok(vu.includes(ligne), ligne)
  assert.ok(lignes.filter((l) => l.includes('[ ]')).length > 5, 'la fixture porte des étapes ouvertes')
  assert.doesNotMatch(vu, /\[x\]/i)
  assert.ok(vu.includes('## Objectif') && vu.includes('- Phase 3 = langue (ids, jamais libellés), #1988.'))
  assert.match(vu, /zone mesurée jamais rafraîchie : `npm run ops:suivi -- 1816`/)
})

test('T2 — digestDuSuivi : coupé au plafond, terminé par « tronqué, lire <chemin> »', () => {
  const vu = digest(REEL, { plafond: 1200 })
  assert.ok(vu.length <= 1200, `${vu.length} > 1200`)
  assert.ok(vu.endsWith(`… tronqué, lire ${CHEMIN}`), vu.slice(-80))
  assert.ok(vu.startsWith('[suivi #1816] .git/suivi/1816.md — écrit le 2026-09-29 14:03\n# Suivi de vague — épique #1816'))
})

test('digestDuSuivi : jamais plus que son plafond, même plus court que la fin « tronqué » ; l’en-tête d’abord', () => {
  for (const plafond of [0, 10, 40, 80, 120]) {
    const vu = digest(REEL, { plafond })
    assert.ok(vu.length <= plafond, `plafond ${plafond} : ${vu.length}`)
    assert.ok('[suivi #1816] .git/suivi/1816.md'.startsWith(vu.split('\n')[0].slice(0, 31)), `plafond ${plafond} : l’en-tête d’abord — ${vu}`)
  }
  assert.equal(digest(REEL, { plafond: 10 }), '[suivi #18')
  const fin = `… tronqué, lire ${CHEMIN}`
  assert.equal(digest(REEL, { plafond: 80 }), `${'[suivi #1816] .git/suivi/1816.md — écrit le 2026-09-29 14:03'.slice(0, 80 - fin.length - 1)}\n${fin}`)
})

test('lireHorodatage relit horodatage à la minute : un seul gabarit pour l’écriture et la lecture', () => {
  for (const d of [MAINTENANT, new Date(2026, 0, 1, 0, 0), new Date(1999, 11, 31, 23, 59, 42, 7), new Date(2026, 8, 5, 9, 7)]) {
    const minute = new Date(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes())
    assert.equal(lireHorodatage(horodatage(d))?.getTime(), minute.getTime(), horodatage(d))
  }
  for (const faux of ['2026-9-5 09:07', '2026-09-05T09:07', '2026-09-05 09:07 ', '']) assert.equal(lireHorodatage(faux), null, faux)
})

test('digestDuSuivi : la zone mesurée DATÉE suit le plan ; PÉRIMÉE au-delà de HEURES_PEREMPTION', () => {
  const mesure = rendre(REEL)
  const frais = digest(mesure, { maintenant: new Date(MAINTENANT.getTime() + HEURES_PEREMPTION * 3_600_000) })
  assert.match(frais, /> Zone MESURÉE par `npm run ops:suivi -- 1816` le 2026-09-29 14:03/)
  assert.match(frais, /\| #2132 \| Ouvert \|/)
  assert.doesNotMatch(frais, /PÉRIMÉE|jamais rafraîchie/)
  const perime = digest(mesure, { maintenant: new Date(MAINTENANT.getTime() + (HEURES_PEREMPTION + 1) * 3_600_000) })
  assert.match(perime, /\*\*PÉRIMÉE\*\* : mesurée il y a 25 h \(au-delà de 24 h\) — `npm run ops:suivi -- 1816`/)
})

const A_CONDENSER = [
  '# Suivi de vague — épique #1816', '', '## En cours', '',
  '1. #10 premier lot', '   - [x] brief', '   - [x] verdict', '', '   - [x] commit', '   <!-- note -->', '   - [x] publié',
  '2. #11 fini court', '   - [x] publié',
  '3. #10 second lot', '   - [ ] reste',
  '4. #12 ouvert', ...Array.from({ length: 29 }, (_, i) => `   - [ ] étape ${i + 1}`),
  '5. #13 faute de frappe', '   - [x] a', '   - [x] b', '   - [x] c',
  '6. #14 sans étape',
  '## Suite', '   - #10 hors section', '',
].join('\n')
const ligneMesuree = (ticket, etatIssue) => ({ ticket, statut: etatIssue, etatIssue, branches: [], worktrees: [], avance: '', dernierCommit: '' })
const MESURE_FERMES = {
  ok: true,
  lignes: [ligneMesuree(10, 'fermé'), ligneMesuree(11, 'fermé'), ligneMesuree(12, 'ouvert'), ligneMesuree(13, 'introuvable'), ligneMesuree(14, 'fermé')],
  anomalies: ['ticket #13 introuvable'],
}
const PUCE_10 = '- #10 fermé : sa section fait 7 lignes → la condenser à l\'essentiel (arbitrages verbatim au ticket d\'abord)'

test('T1 — section d’un ticket : lignes non vides de ses items (item + indentées), SOMMÉES sur les items qui le citent', () => {
  assert.equal(LIGNES_D_UN_TICKET_FERME, 3)
  assert.deepEqual(ticketsPrevus(A_CONDENSER).sections, new Map([[10, 7], [11, 2], [12, 30], [13, 4], [14, 1]]))
})

test('T2 — « À condenser » : un ticket FERMÉ au-delà du seuil, seul ; ni ouvert, ni introuvable, ni fermé court', () => {
  const zone = rendre(A_CONDENSER, MESURE_FERMES).split('\n')
  const titre = zone.indexOf('**À condenser**')
  assert.ok(titre > zone.findIndex((l) => l.startsWith('| #14 ')), 'après le tableau')
  assert.ok(titre < zone.indexOf('**Anomalies de la mesure (hors vague comprises)**'), 'avant les anomalies')
  assert.deepEqual(zone.filter((l) => /^- #\d+ fermé : sa section/.test(l) || /^- #\d+ (ouvert|introuvable)/.test(l)), [PUCE_10])
  assert.equal(zone[titre + 2], PUCE_10)
  assert.doesNotMatch(rendre(A_CONDENSER, { ...MESURE_FERMES, lignes: MESURE_FERMES.lignes.filter((l) => l.ticket !== 10) }), /À condenser/,
    'rien quand la liste est vide')
})

test('T3 — zone ÉCRITE intacte à l’octet quand la zone porte « À condenser », LF et CRLF', () => {
  for (const texte of [A_CONDENSER, A_CONDENSER.replace(/\n/g, '\r\n')]) {
    const premier = rendre(texte, MESURE_FERMES)
    assert.ok(premier.startsWith(texte))
    assert.match(premier, /\*\*À condenser\*\*/)
    const second = rendre(premier, MESURE_FERMES)
    assert.equal(second, premier, 'la même mesure rend le même texte')
    assert.deepEqual(ticketsPrevus(second), ticketsPrevus(texte), 'la zone rendue ne change pas les sections')
  }
})

test('T4 — digestDuSuivi porte la puce « À condenser » de la zone mesurée', () => {
  const vu = digest(rendre(A_CONDENSER, MESURE_FERMES))
  assert.ok(vu.includes(`**À condenser**\n\n${PUCE_10}`), vu)
})

// ————————————————————————————— #2279 : état structuré, lecteur, édition —————————————————————————————

const ZONE_DATEE = (quand) => [MARQUE_DEBUT, `> Zone MESURÉE par \`npm run ops:suivi -- 9\` le ${horodatage(quand)} : x`, '| t |', MARQUE_FIN]
const PLAN = [
  '# Suivi #9', '', '## Objectif', 'livrer', '', '## En cours',
  '   - [ ] étape d’avant tout item',
  '1. [x] #3 fait',
  '   - [x] faite',
  '2. #4 ouvert, en cours',
  '   - [x] brief écrit',
  '   - [ ] juge du brief',
  '   - [ ] juge du diff',
  '   note libre',
  '3. #5 suivant',
  '<!-- 4. #6 commenté -->',
  '', ...ZONE_DATEE(new Date(2026, 9, 4, 10, 0)), '',
].join('\n')

test('#2279 — structureDuSuivi : titre, Objectif, items (ticket, libellé, fait), étapes et leur état, étapes hors item, zone datée PÉRIMÉE', () => {
  const structure = structureDuSuivi(PLAN, { maintenant: new Date(2026, 9, 5, 11, 0) })
  assert.equal(structure.refus, null)
  assert.equal(structure.titre.texte, 'Suivi #9')
  assert.deepEqual(structure.sections.map((s) => s.nature), ['objectif', 'en-cours'])
  assert.deepEqual(structure.sections[0].objectif.map((l) => l.ligne), ['livrer'])
  const [enCours] = structure.sections.slice(1)
  assert.deepEqual(enCours.etapesHorsItem.map((e) => [e.texte, e.ouverte]), [['étape d’avant tout item', true]])
  assert.deepEqual(enCours.items.map((it) => [it.ticket, it.libelle, it.fait]), [[3, '#3 fait', true], [4, '#4 ouvert, en cours', false], [5, '#5 suivant', false]])
  assert.deepEqual(enCours.items[1].etapes.map((e) => [e.texte, e.ouverte]), [['brief écrit', false], ['juge du brief', true], ['juge du diff', true]])
  assert.equal(PLAN.split('\n')[enCours.items[1].fin], '   note libre', 'la fin d’un item : sa dernière ligne indentée')
  assert.equal(structure.zone.date.getTime(), new Date(2026, 9, 4, 10, 0).getTime())
  assert.equal(structure.zone.perimee, true)
  assert.equal(structureDuSuivi(PLAN, { maintenant: new Date(2026, 9, 4, 12, 0) }).zone.perimee, false)
})

test('#2279 — lignesDeSituation : item en cours, prochain geste, ouverts ; âge pour le bandeau, date pour l’ajout ; absent dit tel quel', () => {
  const lu = { epique: 9, chemin: '/s/9.md', texte: PLAN }
  const maintenant = new Date(2026, 9, 4, 13, 30)
  assert.deepEqual(lignesDeSituation(lu, { maintenant, age: true }), [
    '[suivi #9] en cours : #4 ouvert, en cours',
    '  prochain geste : juge du brief',
    '  ouverts : 2 item(s), 3 étape(s) · mesurée il y a 3 h',
  ])
  assert.equal(lignesDeSituation(lu, { maintenant, age: false })[2], '  ouverts : 2 item(s), 3 étape(s) · mesurée le 2026-10-04 10:00')
  assert.deepEqual(lignesDeSituation({ ...lu, texte: null }, { maintenant, age: true }), ['[suivi #9] lié à cette session, mais absent : /s/9.md'])
  assert.deepEqual(lignesDeSituation({ ...lu, texte: '# T\n## En cours\n1. [x] #1 fait\n' }, { maintenant, age: true }),
    ['[suivi #9] aucun item ouvert', '  ouverts : 0 item(s), 0 étape(s) · jamais mesurée'])
})

test('#2279 — argumentsDuSuivi : forme historique, lecteur, édition (texte cité ou découpé) ; toute autre forme refusée', () => {
  assert.deepEqual(argumentsDuSuivi([]), { numero: null, creer: false, sansFetch: false, session: null, json: false, depuis: null, geste: null })
  assert.equal(argumentsDuSuivi(['1816', '--creer']).numero, 1816)
  assert.deepEqual(argumentsDuSuivi(['--session', 'abc', '--json']), { numero: null, creer: false, sansFetch: false, session: 'abc', json: true, depuis: null, geste: null })
  const cite = argumentsDuSuivi(['9', '--session', 'abc', '--json', '--ajouter-item', '#12 un libellé'])
  assert.deepEqual([cite.numero, cite.geste], [9, { quoi: 'ajouter-item', texte: '#12 un libellé' }])
  assert.deepEqual(argumentsDuSuivi(['9', '--session', 'abc', '--json', '--ajouter-item', '#12', 'un', 'libellé']).geste, cite.geste)
  assert.deepEqual(argumentsDuSuivi(['9', '--json', '--session', 'abc', '--ticket', '4', '--cocher', 'juge', 'du']).geste, { quoi: 'cocher', ticket: 4, texte: 'juge du' })
  assert.equal(argumentsDuSuivi(['--session', 'abc', '--depuis', 'k1', '--json']).depuis, 'k1')
  for (const refuse of [
    ['--creer'], ['1', '2'], ['0'], ['--session', 'abc'], ['--json'], ['--session', '--json'], ['--session', 'abc', '--json', '--creer'],
    ['9', '--session', 'abc', '--json'], ['--session', 'abc', '--json', '--ticket', '4', '--cocher', 'x'], ['9', '--session', 'abc', '--ticket', '4', '--cocher', 'x'],
    ['9', '--session', 'abc', '--json', '--cocher', 'x'], ['9', '--session', 'abc', '--json', '--ticket', '0', '--ajouter-etape', 'x'], ['1816', '--bogue'],
    ['9', '--session', 'abc', '--json', '--ticket', '4', '--ajouter-item', '#4 x'], ['9', '--ticket', '4'], ['--session', 'abc', '--json', '--ticket', '4'],
    ['9', '--session', 'abc', '--json', '--ticket', 'x', '--cocher', 'y'], ['9', '--session', 'abc', '--json', '--ticket', '--cocher', 'y'],
    ['--depuis', 'k1'], ['1816', '--depuis', 'k1'], ['--session', 'abc', '--json', '--depuis'], ['--session', 'abc', '--json', '--depuis', '--x'],
    ['9', '--session', 'abc', '--json', '--depuis', 'k1', '--ticket', '4', '--cocher', 'x'],
  ]) assert.equal(argumentsDuSuivi(refuse), null, refuse.join(' '))
})

test('#2279 — editionDuSuivi : ajouter un item, une étape, cocher ; zone mesurée et commentaires intacts à l’octet, LF et CRLF', () => {
  for (const fin of ['\n', '\r\n']) {
    const texte = PLAN.split('\n').join(fin)
    const zone = (t) => { const z = zonesDe(t); return z.lignes.slice(z.debut, z.fin + 1).join('') }
    const item = editionDuSuivi(texte, { quoi: 'ajouter-item', texte: '#7 nouveau' })
    assert.equal(item.ok, true)
    assert.equal(item.texte, texte.replace(`3. #5 suivant${fin}`, `3. #5 suivant${fin}4. #7 nouveau${fin}`))
    const etape = editionDuSuivi(texte, { quoi: 'ajouter-etape', ticket: 4, texte: 'publier' })
    assert.equal(etape.texte, texte.replace(`   note libre${fin}`, `   note libre${fin}   - [ ] publier${fin}`))
    const coche = editionDuSuivi(texte, { quoi: 'cocher', ticket: 4, texte: 'juge du b' })
    assert.equal(coche.texte, texte.replace('   - [ ] juge du brief', '   - [x] juge du brief'))
    for (const { texte: apres } of [item, etape, coche]) {
      assert.equal(zone(apres), zone(texte))
      assert.ok(apres.includes(`<!-- 4. #6 commenté -->${fin}`))
    }
  }
})

test('#2279 — editionDuSuivi : refus NOMMÉS — texte vide, item sans ticket ou déjà présent, item absent, aucune étape, étape ambiguë, suivi illisible', () => {
  const refus = (geste, texte = PLAN) => { const r = editionDuSuivi(texte, geste); assert.equal(r.ok, false, JSON.stringify(geste)); return r.refus }
  assert.match(refus({ quoi: 'ajouter-item', texte: '  ' }), /texte vide/)
  assert.match(refus({ quoi: 'ajouter-item', texte: 'sans ticket' }), /item sans ticket/)
  assert.match(refus({ quoi: 'ajouter-item', texte: '#4 doublon' }), /item #4 déjà présent \(l\.10\)/)
  assert.match(refus({ quoi: 'ajouter-etape', ticket: 6, texte: 'x' }), /item #6 absent/)
  assert.match(refus({ quoi: 'cocher', ticket: 4, texte: 'brief écrit' }), /aucune étape ouverte de l'item #4/)
  assert.match(refus({ quoi: 'cocher', ticket: 4, texte: 'juge du' }), /étape ambiguë : 2 étapes ouvertes de l'item #4 .*\(l\.12, l\.13\)/)
  assert.match(refus({ quoi: 'ajouter-item', texte: '#7 x' }, '# T\n'), /section `## En cours` absente/)
})

/** Un dossier de suivis jetable : `9.md` (PLAN), sans journal. */
function dossierDeSuivis() {
  const dossier = dossierJetable()
  FS.writeFileSync(join(dossier, '9.md'), PLAN)
  return dossier
}

test('#2279 — editer : écrit, lie la session UNE fois, rend l’état ; un refus ne touche ni le suivi ni le journal', () => {
  const dossier = dossierDeSuivis()
  const maintenant = new Date(2026, 9, 4, 13, 30)
  const journal = () => lignesDuJournal(FS.readFileSync(join(dossier, JOURNAL), 'utf8')).map((l) => [l.session, l.epique])
  try {
    const absent = editer({ numero: 8, dossier, session: 's', geste: { quoi: 'ajouter-item', texte: '#1 x' }, maintenant })
    assert.deepEqual([absent.code, absent.stdout], [1, ''])
    assert.match(absent.stderr, /suivi #8 absent/)
    const refuse = editer({ numero: 9, dossier, session: 's', geste: { quoi: 'cocher', ticket: 4, texte: 'juge du' }, maintenant })
    assert.equal(refuse.code, 1)
    assert.match(refuse.stderr, /étape ambiguë/)
    assert.equal(FS.readFileSync(join(dossier, '9.md'), 'utf8'), PLAN)
    assert.equal(FS.existsSync(join(dossier, JOURNAL)), false)
    const fait = editer({ numero: 9, dossier, session: 's', geste: { quoi: 'cocher', ticket: 4, texte: 'juge du b' }, maintenant })
    assert.equal(fait.code, 0, fait.stderr)
    assert.deepEqual(JSON.parse(fait.stdout), etatDeSession({ session: 's', dossier, maintenant }))
    assert.equal(JSON.parse(fait.stdout).suivis[0].lignes[1], '  prochain geste : juge du diff')
    editer({ numero: 9, dossier, session: 's', geste: { quoi: 'ajouter-etape', ticket: 5, texte: 'brief' }, maintenant })
    assert.deepEqual(journal(), [['s', 9]], 'le lien n’est tracé qu’une fois')
    assert.deepEqual(restes(dossier), [])
  } finally { FS.rmSync(dossier, { recursive: true, force: true }) }
})

test('#2279 — etatDeSession : sans lien, bandeau et ajout vides, l’index en contexte ; lié, la clé suit l’ÉTAT, jamais l’heure de relecture', () => {
  const dossier = dossierDeSuivis()
  try {
    const seul = etatDeSession({ session: 's', dossier, maintenant: new Date() })
    assert.deepEqual([seul.suivis, seul.ajout], [[], ''])
    assert.match(seul.contexte, /^\[suivi\] session sans suivi lié/)
    FS.writeFileSync(join(dossier, JOURNAL), ligneDeJournal({ iso: 'x', session: 's', epique: 9 }))
    const a = etatDeSession({ session: 's', dossier, maintenant: new Date(2026, 9, 4, 13, 30) })
    const b = etatDeSession({ session: 's', dossier, maintenant: new Date(2026, 9, 4, 15, 50) })
    assert.deepEqual(a.suivis.map((s) => [s.epique, s.chemin]), [[9, join(dossier, '9.md')]])
    assert.match(a.contexte, /^\[suivi #9\] /)
    assert.equal(a.ajout, ['[suivi] situation relue le 2026-10-04 13:30', '[suivi #9] en cours : #4 ouvert, en cours',
      '  prochain geste : juge du brief', '  ouverts : 2 item(s), 3 étape(s) · mesurée le 2026-10-04 10:00'].join('\n'))
    assert.doesNotMatch(a.ajout, /npm run|lire |relancer|mets|mettre/)
    assert.notEqual(a.ajout, b.ajout)
    assert.equal(a.cle, b.cle, 'même état, même clé')
    assert.notEqual(a.cle, seul.cle)
    FS.writeFileSync(join(dossier, '9.md'), editionDuSuivi(PLAN, { quoi: 'cocher', ticket: 4, texte: 'juge du b' }).texte)
    assert.notEqual(etatDeSession({ session: 's', dossier, maintenant: new Date(2026, 9, 4, 13, 30) }).cle, a.cle, 'état changé, clé changée')
  } finally { FS.rmSync(dossier, { recursive: true, force: true }) }
})

test('#2279 — CLI `--session <id> --json` sur un dépôt FORGÉ : l’état de la session, en LECTURE SEULE', () => {
  const { racine } = instanceDeDepot({ commit: false })
  const dossier = join(racine, '.git', 'suivi')
  try {
    FS.mkdirSync(dossier, { recursive: true })
    FS.writeFileSync(join(dossier, '9.md'), PLAN)
    FS.writeFileSync(join(dossier, JOURNAL), ligneDeJournal({ iso: 'x', session: 's', epique: 9 }))
    const avant = FS.readdirSync(dossier).map((n) => [n, FS.statSync(join(dossier, n)).mtimeMs])
    const sortie = execFileSync(process.execPath, [fileURLToPath(new URL('./suivi.mjs', import.meta.url)), '--session', 's', '--json'], { cwd: racine, encoding: 'utf8' })
    const etat = JSON.parse(sortie)
    assert.deepEqual(Object.keys(etat), ['session', 'suivis', 'contexte', 'ajout', 'cle'])
    assert.equal(etat.session, 's')
    assert.equal(etat.suivis[0].lignes[0], '[suivi #9] en cours : #4 ouvert, en cours')
    const vu = dirname(etat.suivis[0].chemin)
    assert.equal(FS.realpathSync(vu), FS.realpathSync(dossier), 'le dossier des suivis du dépôt forgé')
    assert.equal(etat.contexte, etatDeSession({ session: 's', dossier: vu, maintenant: new Date() }).contexte)
    assert.deepEqual(FS.readdirSync(dossier).map((n) => [n, FS.statSync(join(dossier, n)).mtimeMs]), avant, 'rien n’est écrit')
  } finally {
    FS.rmSync(racine, { recursive: true, force: true })
  }
})

test('#2279 — etatDeSession `depuis` : ajout VIDE quand la clé d’état vaut `depuis`, rendu dès qu’elle change ; la clé, elle, est rendue toujours', () => {
  const dossier = dossierDeSuivis()
  try {
    FS.writeFileSync(join(dossier, JOURNAL), ligneDeJournal({ iso: 'x', session: 's', epique: 9 }))
    const maintenant = new Date(2026, 9, 4, 13, 30)
    const premier = etatDeSession({ session: 's', dossier, maintenant })
    assert.notEqual(premier.ajout, '')
    const inchange = etatDeSession({ session: 's', dossier, maintenant, depuis: premier.cle })
    assert.deepEqual([inchange.ajout, inchange.cle], ['', premier.cle])
    assert.equal(etatDeSession({ session: 's', dossier, maintenant, depuis: 'autre' }).ajout, premier.ajout)
    FS.writeFileSync(join(dossier, '9.md'), editionDuSuivi(PLAN, { quoi: 'cocher', ticket: 4, texte: 'juge du b' }).texte)
    const change = etatDeSession({ session: 's', dossier, maintenant, depuis: premier.cle })
    assert.match(change.ajout, /prochain geste : juge du diff/)
    assert.notEqual(change.cle, premier.cle)
  } finally { FS.rmSync(dossier, { recursive: true, force: true }) }
})

// ————————————————————— #2279, correction n° 2 : verrou, structure vérifiée, formes historiques —————————————————————

test('#2279 B1 — N `editer` en PARALLÈLE (processus distincts) : aucune édition perdue, chaque succès est dans le fichier', async () => {
  const module = pathToFileURL(fileURLToPath(new URL('./suivi.mjs', import.meta.url))).href
  const lancer = (dossier, k) => new Promise((fini) => {
    const code = `const { editer } = await import(${JSON.stringify(module)}); const r = editer({ numero: 9, dossier: ${JSON.stringify(dossier)}, `
      + `session: 's${k}', geste: { quoi: 'ajouter-etape', ticket: 5, texte: 'étape ${k}' } }); process.stdout.write(String(r.code))`
    const enfant = spawn(process.execPath, ['--input-type=module', '-e', code], { stdio: ['ignore', 'pipe', 'inherit'] })
    let sortie = ''
    enfant.stdout.on('data', (d) => { sortie += d })
    enfant.on('close', () => fini({ k, code: sortie.trim() }))
  })
  for (let essai = 0; essai < 6; essai += 1) {
    const dossier = dossierDeSuivis()
    try {
      const codes = await Promise.all(Array.from({ length: 6 }, (_, k) => lancer(dossier, k)))
      const texte = FS.readFileSync(join(dossier, '9.md'), 'utf8')
      for (const { k, code } of codes) assert.equal(code, '0', `essai ${essai}, édition ${k} : refusée`)
      for (const { k } of codes) assert.ok(texte.includes(`   - [ ] étape ${k}\n`), `essai ${essai} : l’édition ${k} a réussi mais n’est pas dans le fichier`)
      assert.deepEqual(FS.readdirSync(dossier).filter((n) => n.startsWith('.9.md')), [], 'ni temporaire ni verrou restant')
    } finally { FS.rmSync(dossier, { recursive: true, force: true }) }
  }
})

test('#2279 B1 — un verrou tenu par un processus VIVANT : écriture refusée et rejouable ; tenu par un mort, repris', () => {
  const dossier = dossierDeSuivis()
  const cible = join(dossier, '9.md')
  const verrou = join(dossier, '.9.md.verrou')
  try {
    FS.writeFileSync(verrou, JSON.stringify({ pid: process.ppid, commande: 'autre', cwd: dossier, date: 'x' }))
    const refus = ecrireSuivi({ cible, contenu: 'neuf', attendu: PLAN, geste: 'la mesure' })
    assert.deepEqual([refus.ok, refus.rejouable], [false, true])
    assert.match(refus.refus, /en cours d'écriture par un autre processus/)
    assert.equal(FS.readFileSync(cible, 'utf8'), PLAN)
    FS.writeFileSync(verrou, JSON.stringify({ pid: 2 ** 30, commande: 'mort', cwd: dossier, date: 'x' }))
    assert.deepEqual(ecrireSuivi({ cible, contenu: 'neuf', attendu: PLAN, geste: 'la mesure' }), { ok: true })
    assert.equal(FS.existsSync(verrou), false, 'le verrou repris est libéré')
  } finally { FS.rmSync(dossier, { recursive: true, force: true }) }
})

test('#2279 B1 — `editer` sur un verrou qui ne se libère pas : refus nommé après ESSAIS_D_EDITION essais, sans écrire', () => {
  const dossier = dossierDeSuivis()
  try {
    FS.writeFileSync(join(dossier, '.9.md.verrou'), JSON.stringify({ pid: process.ppid, commande: 'autre', cwd: dossier, date: 'x' }))
    const vu = editer({ numero: 9, dossier, session: 's', geste: { quoi: 'ajouter-etape', ticket: 5, texte: 'brief' } })
    assert.equal(vu.code, 1)
    assert.match(vu.stderr, new RegExp(`en cours d'écriture par un autre processus.*\\(${ESSAIS_D_EDITION} essais\\)`))
    assert.equal(FS.readFileSync(join(dossier, '9.md'), 'utf8'), PLAN)
    assert.equal(FS.existsSync(join(dossier, JOURNAL)), false)
  } finally { FS.rmSync(dossier, { recursive: true, force: true }) }
})

test('#2279 B2 — une édition ne porte qu’UNE ligne : `\\n` et `\\r` refusés, marqueur de zone et faux titre compris', () => {
  for (const [geste, quoi] of [
    [{ quoi: 'ajouter-item', texte: `#12 libellé\n${MARQUE_DEBUT}` }, 'marqueur de zone'],
    [{ quoi: 'ajouter-etape', ticket: 4, texte: 'z\n## Faux titre' }, 'faux titre'],
    [{ quoi: 'cocher', ticket: 4, texte: 'juge du b\r' }, 'retour chariot'],
  ]) {
    const r = editionDuSuivi(PLAN, geste)
    assert.equal(r.ok, false, quoi)
    assert.match(r.refus, /texte sur plusieurs lignes/, quoi)
  }
})

test('#2279 B2 — la structure relue doit être celle d’avant plus l’élément visé : insertion dans un commentaire jamais fermé (C1), case derrière un commentaire (R2), refusées', () => {
  const ouvert = PLAN.replace('3. #5 suivant', '3. #5 suivant <!-- note ouverte').replace('<!-- 4. #6 commenté -->', 'suite')
  for (const [texte, geste, quoi] of [
    [ouvert, { quoi: 'ajouter-item', texte: '#7 nouveau' }, 'item dans un commentaire ouvert'],
    [ouvert, { quoi: 'ajouter-etape', ticket: 5, texte: 'étape' }, 'étape dans un commentaire ouvert'],
    [PLAN.replace('   - [ ] juge du brief', '   <!-- [ ] --> - [ ] juge du brief'), { quoi: 'cocher', ticket: 4, texte: 'juge du b' }, 'case derrière un commentaire'],
    [PLAN, { quoi: 'ajouter-etape', ticket: 4, texte: 'cachée <!-- jamais fermée' }, 'étape qui ouvre un commentaire'],
  ]) {
    const r = editionDuSuivi(texte, geste)
    assert.equal(r.ok, false, quoi)
    assert.match(r.refus, /ne serait pas lue telle quelle/, quoi)
  }
})

test('#2279 N7 — la dernière ligne de l’item ou de la section ouvre un commentaire fermé plus bas : l’insertion va APRÈS sa fermeture', () => {
  const note = PLAN.replace('3. #5 suivant', '3. #5 suivant <!-- note').replace('<!-- 4. #6 commenté -->', '   suite -->')
  const item = editionDuSuivi(note, { quoi: 'ajouter-item', texte: '#7 nouveau' })
  assert.equal(item.ok, true, item.refus)
  assert.match(item.texte, /3\. #5 suivant <!-- note\n {3}suite -->\n4\. #7 nouveau\n/)
  const etape = editionDuSuivi(note, { quoi: 'ajouter-etape', ticket: 5, texte: 'brief' })
  assert.equal(etape.ok, true, etape.refus)
  assert.match(etape.texte, /3\. #5 suivant <!-- note\n {3}suite -->\n {3}- \[ \] brief\n/)
  const crlf = editionDuSuivi(note.replace(/\n/g, '\r\n'), { quoi: 'ajouter-etape', ticket: 5, texte: 'brief' })
  assert.equal(crlf.texte, etape.texte.replace(/\n/g, '\r\n'))
})

test('#2279 R1 — les formes HISTORIQUES des arguments gardent leur sens (2 380 formes énumérées, 52 acceptées hier)', () => {
  const historique = (argv) => {
    const numeros = argv.filter((a) => /^\d+$/.test(a)).map(Number)
    const valides = argv.every((a) => a === '--creer' || a === '--sans-fetch' || /^\d+$/.test(a))
    if (argv.length && (!valides || numeros.length !== 1 || numeros[0] < 1)) return null
    return { numero: numeros[0] ?? null, creer: argv.includes('--creer'), sansFetch: argv.includes('--sans-fetch') }
  }
  const jetons = ['5', '0', '12', '--creer', '--sans-fetch', '--json', '--session', 'abc', '--depuis', 'k', '--x', '-5', '05']
  const formes = [[]]
  for (const a of jetons) { formes.push([a]); for (const b of jetons) { formes.push([a, b]); for (const c of jetons) formes.push([a, b, c]) } }
  let acceptees = 0
  for (const forme of formes) {
    const avant = historique(forme)
    if (avant === null) continue
    acceptees += 1
    const neuf = argumentsDuSuivi(forme)
    assert.deepEqual(neuf, { ...avant, session: null, json: false, depuis: null, geste: null }, JSON.stringify(forme))
  }
  assert.deepEqual([formes.length, acceptees], [2380, 52])
})
