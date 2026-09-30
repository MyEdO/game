// CLIQUET du suivi de vague (node --test) : la grammaire et le rendu sont PURS ; l'écriture se joue
// sur un dossier jetable sous `os.tmpdir()` avec un `fs` injecté ; la portée se mesure sur un dépôt
// FORGÉ (fixture partagée + origin nu), issues injectées. La fixture `fixtures/suivi-1816.md` est la
// copie à l'octet de `.git/suivi/1816.md` du 2026-09-28, premier suivi réel.
// Lancé par `npm run test:ops`.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { DEPOT } from '../guards/lib/ticketsGh.mjs'
import { execFileSync } from 'node:child_process'
import * as FS from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { envDeDepotForge, instanceDeDepot } from '../guards/lib/depotGabarit.mjs'
import { GESTES_DU_BOARD, indexerIssues, mesurer } from './board.mjs'
import {
  HEURES_PEREMPTION, LIGNES_D_UN_TICKET_FERME, MARQUE_DEBUT, MARQUE_FIN, PLAFOND_INJECTION, digestDuSuivi, ecrireSuivi,
  gabaritDuSuivi, horodatage, lireHorodatage, listerSuivis, mesureProfilee, renduDuSuivi,
  suivre, texteDeLaListe, ticketsPrevus, zonesDe,
} from './suivi.mjs'

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
    const refus = ecrireSuivi({ cible, contenu: 'neuf', attendu: 'lu avant', pid: 11 })
    assert.equal(refus.ok, false)
    assert.match(refus.refus, /a changé pendant la mesure/)
    assert.equal(FS.readFileSync(cible, 'utf8'), 'édité ailleurs')
    assert.deepEqual(restes(dossier), [])
    assert.deepEqual(ecrireSuivi({ cible, contenu: 'neuf', attendu: 'édité ailleurs', pid: 11 }), { ok: true })
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
      const vu = ecrireSuivi({ cible, contenu: 'neuf', attendu: 'avant', fs: jette(code), pid: 12 })
      assert.deepEqual([vu.ok, /suivi tenu par un autre processus/.test(vu.refus)], [false, true], code)
      assert.equal(FS.readFileSync(cible, 'utf8'), 'avant')
      assert.deepEqual(restes(dossier), [], code)
    }
    assert.throws(() => ecrireSuivi({ cible, contenu: 'neuf', attendu: 'avant', fs: jette('ENOSPC'), pid: 12 }), /ENOSPC/)
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
    const nonEcrit = ecrireSuivi({ cible, contenu: 'neuf', attendu: 'avant', fs: plein, pid: 13 })
    assert.equal(nonEcrit.ok, false)
    assert.match(nonEcrit.refus, /temporaire .*\.7\.md\.13\.tmp non écrit \(ENOSPC\)/)
    assert.equal(FS.readFileSync(cible, 'utf8'), 'avant')
    assert.deepEqual(restes(dossier), [])
    FS.rmSync(cible)
    const disparue = ecrireSuivi({ cible, contenu: 'neuf', attendu: 'avant', pid: 13 })
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
    const vu = ecrireSuivi({ cible, contenu: 'neuf', attendu: 'avant', fs: tenu, pid: 14 })
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
        () => ecrireSuivi({ cible, contenu: 'neuf', attendu: 'avant', fs, pid: 15 }),
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
      fetchOrigin: fetchOrigin ?? (() => { compte.fetch += 1; return fait('') }),
      branchesDe: () => [],
      divergenceDe: () => ({ avance: 0, retard: 0 }),
      journalDe: () => [],
    },
    inv: () => ({ ok: true, worktrees: [{ chemin: '/dep', principal: true, branche: 'main' }] }),
    issues: issues ?? ((numeros) => { compte.issues.push(numeros); return indexerIssues(numeros.map((n) => ({ number: n, state: 'open' })), numeros) }),
  }
}

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
    const mesure = mesureFactice({ fetch: 0, issues: [] }, { fetchOrigin: () => ({ disponible: false, raison: 'réseau coupé' }) })
    const vu = suivre({ numero: 5, dossier, maintenant: MAINTENANT, mesure })
    assert.equal(vu.code, 1)
    const texte = FS.readFileSync(join(dossier, '5.md'), 'utf8')
    assert.match(texte, /\*\*Mesure refusée le 2026-09-29 14:03\*\* : origin non consultable \(réseau coupé\)/)
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
  execFileSync('git', ['init', '--bare', '-q', '-b', 'main', nu], { env: envDeDepotForge(), encoding: 'utf8' })
  const { racine } = instanceDeDepot({ fichiers: { 'a.txt': 'a' }, message: 'fondation' })
  const git = (...args) => execFileSync('git', args, { cwd: racine, env: envDeDepotForge(), encoding: 'utf8' }).trim()
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
