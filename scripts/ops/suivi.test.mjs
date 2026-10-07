// CLIQUET du suivi de vague (node --test) : la donnée et ses mutations sont PURES (`suiviDonnee.mjs`) ;
// l'écriture se joue sur un dossier jetable sous `os.tmpdir()`, `fs` injecté au besoin ; la portée se
// mesure sur un dépôt FORGÉ (fixture partagée + origin nu), issues injectées. Tout suivi est construit par
// `appliquer` ou par l'outil (`poserSuivi`), jamais par un JSON écrit à la main (#2460).
// Lancé par `npm run test:ops`.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { DEPOT } from '../guards/lib/ticketsGh.mjs'
import { execFileSync, spawn, spawnSync } from 'node:child_process'
import * as FS from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { z } from 'zod'
import { instanceDeDepot } from '../guards/lib/depotGabarit.mjs'
import { GESTES_DU_BOARD, indexerIssues, mesurer } from './board.mjs'
import {
  ESSAIS_D_EDITION, GESTES, GESTES_DE_LA_DONNEE, HEURES_PEREMPTION, JOURNAL, PLAFOND_INJECTION, argumentsDuSuivi, digestDuSuivi,
  ecrireSuivi, editer, etatDeSession, horodatage, ligneDeJournal, lignesDeSituation, lignesDuJournal, lireLeSuivi, listerSuivis,
  mesureProfilee, mesurerLeSuivi, mutationsDuLot, renduDuSuivi, texteDeLaListe,
} from './suivi.mjs'
import {
  ETAPES_OUVERTES_PAR_ITEM, LONGUEUR_ETAPE, LONGUEUR_LIBELLE, Lot, OUTIL_SUIVI, appliquer, lireSuivi, sceller, texteDuSuivi,
} from './suiviDonnee.mjs'
import { gitDe, lancerGit } from '../test/gitDeBanc.mjs'
import { poserSuivi } from '../test/suiviDeBanc.mjs'

const SCRIPT = fileURLToPath(new URL('./suivi.mjs', import.meta.url))
const MAINTENANT = new Date(2026, 9, 7, 10, 0)

/** Le suivi #665 d'exemple : un item #2400 actif à deux étapes (la première faite), un #2187 en attente, une file. */
const BASE = [
  { geste: 'creer', titre: 'Vague du tome 1', objectif: 'livrer le tome 1' },
  { geste: 'ajouter-item', ticket: 2400, libelle: 'périmètre de tests', porteur: 'game-21' },
  { geste: 'ajouter-etape', ticket: 2400, texte: 'juge du brief' },
  { geste: 'ajouter-etape', ticket: 2400, texte: 'juge du diff' },
  { geste: 'cocher', ticket: 2400, n: 1 },
  { geste: 'ajouter-item', ticket: 2187, libelle: 'arbre principal à jour', etat: 'attente' },
  { geste: 'enfiler', ticket: 2497, libelle: 'durées apprises', bloquePar: [2400] },
]
const exemple = () => {
  const vu = appliquer(null, BASE, { maintenant: MAINTENANT, epique: 665 })
  assert.equal(vu.ok, true, vu.refus)
  return vu.suivi
}
/** Le suivi après `mutations` sur `suivi`, qui doit passer. */
const apres = (suivi, mutations) => {
  const vu = appliquer(suivi, mutations, { maintenant: MAINTENANT })
  assert.equal(vu.ok, true, vu.refus)
  return vu.suivi
}
/** Le refus de `mutations` sur `suivi`, qui doit être refusé. */
const refusDe = (suivi, mutations) => {
  const vu = appliquer(suivi, mutations, { maintenant: MAINTENANT })
  assert.equal(vu.ok, false, JSON.stringify(mutations))
  return vu.refus
}

const dossierJetable = () => FS.mkdtempSync(join(tmpdir(), 'suivi-'))
const restes = (dossier) => FS.readdirSync(dossier).filter((n) => n.endsWith('.tmp'))

// ————————————————————————————————————— la donnée —————————————————————————————————————

test('IDENTITÉ — un lot ajoute un item puis une étape à un AUTRE : rien n’est écrasé, les `n` ne bougent pas, un `n` retiré n’est jamais réutilisé', () => {
  const avant = exemple()
  const vu = apres(avant, [
    { geste: 'ajouter-item', ticket: 2472, libelle: 'témoin de plus' },
    { geste: 'ajouter-etape', ticket: 2400, texte: 'tour 10 publié' },
  ])
  const item = (s, t) => s.items.find((i) => i.ticket === t)
  assert.deepEqual(item(vu, 2400).etapes.map((e) => [e.n, e.texte, e.faite]), [[1, 'juge du brief', true], [2, 'juge du diff', false], [3, 'tour 10 publié', false]])
  assert.deepEqual(item(vu, 2187), item(avant, 2187), 'l’autre item intact')
  assert.deepEqual(vu.items.map((i) => i.ticket), [2400, 2187, 2472])
  const retire = apres(vu, [{ geste: 'retirer-etape', ticket: 2400, n: 3 }, { geste: 'ajouter-etape', ticket: 2400, texte: 'reprise' }])
  assert.deepEqual(item(retire, 2400).etapes.map((e) => e.n), [1, 2, 4], 'le n° 3 retiré n’est pas réutilisé')
  assert.equal(avant.items.length, 2, 'le suivi d’entrée n’est jamais modifié')
})

test('TOUT OU RIEN — `cocher` + `ajouter-etape` + `etat` passent ENSEMBLE ; une mutation invalide laisse le fichier identique À L’OCTET', () => {
  const dossier = dossierJetable()
  try {
    poserSuivi({ dossier, epique: 665, lots: [BASE], maintenant: MAINTENANT })
    const cible = join(dossier, '665.json')
    const lot = [{ geste: 'cocher', ticket: 2400, n: 2 }, { geste: 'ajouter-etape', ticket: 2400, texte: 'publier' }, { geste: 'etat', ticket: 2187, etat: 'actif' }]
    assert.equal(editer({ numero: 665, dossier, mutations: lot, maintenant: MAINTENANT }).code, 0)
    const suivi = lireSuivi(FS.readFileSync(cible, 'utf8')).suivi
    assert.deepEqual(suivi.items.map((i) => [i.ticket, i.etat, i.etapes.map((e) => `${e.n}${e.faite ? 'x' : ' '}`).join()]), [[2400, 'actif', '1x,2x,3 '], [2187, 'actif', '']])
    const octets = FS.readFileSync(cible)
    const vu = editer({ numero: 665, dossier, mutations: [{ geste: 'cocher', ticket: 2400, n: 3 }, { geste: 'etat', ticket: 9999, etat: 'clos' }], maintenant: MAINTENANT })
    assert.equal(vu.code, 1)
    assert.match(vu.stderr, /mutation 2 \(etat\) : item #9999 absent — rien n'est écrit/)
    assert.deepEqual(FS.readFileSync(cible), octets, 'à l’octet')
    assert.deepEqual(restes(dossier), [])
  } finally { FS.rmSync(dossier, { recursive: true, force: true }) }
})

test('DOUBLON — refusé à l’ÉCRITURE (item ∪ file) ET à la LECTURE', () => {
  const s = exemple()
  assert.match(refusDe(s, [{ geste: 'ajouter-item', ticket: 2400, libelle: 'encore' }]), /mutation 1 \(ajouter-item\) : .*doublon : le ticket #2400/)
  assert.match(refusDe(s, [{ geste: 'enfiler', ticket: 2187, libelle: 'en file aussi' }]), /doublon : le ticket #2187 est deux fois sur items ∪ file \(items, file\)/)
  const double = sceller({ ...s, items: [...s.items, s.items[0]] }, { maintenant: MAINTENANT })
  const lu = lireSuivi(texteDuSuivi(double))
  assert.deepEqual([lu.ok, lu.genre], [false, 'schema'])
  assert.match(lu.refus, /^hors schéma : doublon : le ticket #2400/)
})

test('BORNES — libellé, étape, têtes de liste `[ ]`/`-`/`1.`, texte qui porte 64 caractères hexadécimaux', () => {
  const s = exemple()
  assert.match(refusDe(s, [{ geste: 'ajouter-item', ticket: 1, libelle: 'x'.repeat(LONGUEUR_LIBELLE + 1) }]), /mutation 1 \(ajouter-item\) : hors schéma : libelle : /)
  assert.ok(appliquer(s, [{ geste: 'ajouter-item', ticket: 1, libelle: 'x'.repeat(LONGUEUR_LIBELLE) }], { maintenant: MAINTENANT }).ok)
  assert.match(refusDe(s, [{ geste: 'ajouter-etape', ticket: 2400, texte: 'y'.repeat(LONGUEUR_ETAPE + 1) }]), /hors schéma : texte/)
  for (const tete of ['[ ] grounding', '[x] fait', '- puce', '1. numéro', 'deux\nlignes']) {
    assert.match(refusDe(s, [{ geste: 'ajouter-etape', ticket: 2400, texte: tete }]), /hors schéma : texte : (sans tête de liste|une seule ligne)/, tete)
  }
  const jeton = `jeton ${'cd4452560c'.repeat(6)}abcd`
  assert.match(refusDe(s, [{ geste: 'signaler', texte: jeton }]), /64 caractères hexadécimaux/)
  assert.match(refusDe(s, [{ geste: 'arbitrer', date: '2026-10-07', nature: 'utilisateur', verbatim: jeton }]), /64 caractères hexadécimaux/)
  const ouvertes = Array.from({ length: ETAPES_OUVERTES_PAR_ITEM + 1 }, (_, k) => ({ geste: 'ajouter-etape', ticket: 2187, texte: `étape ${k}` }))
  assert.match(refusDe(s, ouvertes), new RegExp(`mutation ${ETAPES_OUVERTES_PAR_ITEM + 1} \\(ajouter-etape\\) : l'état produit est hors schéma : .*${ETAPES_OUVERTES_PAR_ITEM + 1} étapes ouvertes`))
  assert.match(refusDe(s, [{ geste: 'arbitrer', date: '2026-10-07', nature: 'utilisateur', texte: 'sans verbatim' }]), /un arbitrage utilisateur porte son verbatim/)
})

test('GESTES — file (placer, démarrer, défiler), condensation d’un clos, arbitrages, signalements, frictions, dispositions : chacun par identité', () => {
  let s = apres(exemple(), [
    { geste: 'enfiler', ticket: 2474, libelle: 'trois runs' }, { geste: 'enfiler', ticket: 2498, libelle: 'groupe' },
    { geste: 'placer', ticket: 2498, apres: null }, { geste: 'placer', ticket: 2497, apres: 2474 },
  ])
  assert.deepEqual(s.file.map((f) => f.ticket), [2498, 2474, 2497])
  s = apres(s, [{ geste: 'demarrer', ticket: 2474 }, { geste: 'defiler', ticket: 2498 }])
  assert.deepEqual([s.file.map((f) => f.ticket), s.items.at(-1)], [[2497], { ticket: 2474, libelle: 'trois runs', etat: 'actif', prochaineEtape: 1, etapes: [] }])
  assert.match(refusDe(s, [{ geste: 'condenser', ticket: 2400, resume: 'publié' }]), /seul un item clos se condense/)
  s = apres(s, [{ geste: 'etat', ticket: 2400, etat: 'clos' }, { geste: 'condenser', ticket: 2400, resume: 'publié en 3 lots' }])
  assert.deepEqual([s.items[0].libelle, s.items[0].etapes, s.items[0].prochaineEtape], ['publié en 3 lots', [], 3])
  s = apres(s, [
    { geste: 'arbitrer', date: '2026-10-07', nature: 'utilisateur', verbatim: 'On va repasser a 2 sessions', portee: 'budget' },
    { geste: 'arbitrer', date: '2026-10-07', nature: 'ingenierie', texte: 'C1 publié seul', tickets: [2071] },
    { geste: 'retirer-arbitrage', n: 1 }, { geste: 'signaler', texte: '#2404 jette le roster', tickets: [2404] },
    { geste: 'friction', texte: 'usage muet' }, { geste: 'verser-friction', n: 1, ticket: 2373 },
    { geste: 'ignorer-anomalie', genre: 'branche-sans-ticket', cle: 'essai/x', motif: 'essai local' },
  ])
  assert.deepEqual([s.compteurs, s.arbitrages.map((a) => a.n), s.frictions[0].verseeA, s.dispositions.length], [{ arbitrage: 2, signalement: 1, friction: 1 }, [2], 2373, 1])
  assert.match(refusDe(s, [{ geste: 'ignorer-anomalie', genre: 'branche-sans-ticket', cle: 'essai/x', motif: 'm' }]), /déjà posée/)
  assert.equal(apres(s, [{ geste: 'lever-disposition', genre: 'branche-sans-ticket', cle: 'essai/x' }]).dispositions.length, 0)
  assert.match(refusDe(s, [{ geste: 'creer', titre: 'x' }]), /le suivi existe déjà/)
  assert.match(appliquer(null, [{ geste: 'ajouter-item', ticket: 1, libelle: 'x' }], { maintenant: MAINTENANT, epique: 9 }).refus, /suivi absent : la première mutation/)
})

test('INTÉGRITÉ — un fichier hors schéma est ILLISIBLE et nommé ; une empreinte fausse se rend « écrit hors de l’outil », en TÊTE', () => {
  const dossier = dossierJetable()
  try {
    poserSuivi({ dossier, epique: 665, lots: [BASE], maintenant: MAINTENANT })
    const cible = join(dossier, '665.json')
    const texte = FS.readFileSync(cible, 'utf8')
    assert.equal(lireSuivi(texte).ok, true)
    const brut = JSON.parse(texte)
    assert.deepEqual(lireSuivi('{ pas du JSON').genre, 'json')
    const hors = lireSuivi(JSON.stringify({ ...brut, items: 'x' }))
    assert.deepEqual([hors.genre, /^hors schéma : items : /.test(hors.refus)], ['schema', true])
    FS.writeFileSync(cible, texte.replace('juge du diff', 'juge du diff édité'))
    const lu = lireLeSuivi({ dossier, epique: 665 })
    assert.equal(lu.suivi.items[0].etapes[1].texte, 'juge du diff édité', 'le suivi valide reste lu')
    const [tete] = lignesDeSituation(lu, { maintenant: MAINTENANT, age: true })
    assert.match(tete, /^\[suivi #665\] ⚠ écrit hors de l'outil : l'empreinte ne correspond pas au contenu/)
    const refus = editer({ numero: 665, dossier, mutations: [{ geste: 'cocher', ticket: 2400, n: 2 }], maintenant: MAINTENANT })
    assert.equal(refus.code, 1)
    assert.match(refus.stderr, /écrit hors de l'outil .* rien n'est écrit/)
    FS.writeFileSync(cible, JSON.stringify({ ...brut, version: 2 }))
    assert.match(lignesDeSituation(lireLeSuivi({ dossier, epique: 665 }), { maintenant: MAINTENANT, age: true })[0], /^\[suivi #665\] ⚠ illisible, hors schéma : version/)
    assert.match(digestDuSuivi(lireLeSuivi({ dossier, epique: 665 }), { maintenant: MAINTENANT }), /^\[suivi #665\] ⚠ illisible/)
  } finally { FS.rmSync(dossier, { recursive: true, force: true }) }
})

// ————————————————————————————————————— le CLI —————————————————————————————————————

test('ARITÉ CLI — chaque geste consomme son arité : un mot en trop est refusé et NOMMÉ ; `--cocher` ne mange plus la suite ; deux gestes en un appel', () => {
  const deux = argumentsDuSuivi(['665', '--cocher', '2400.4', '--ajouter-etape', '2400', 'tour 10 publié', '--etat', '2400', 'attente'])
  assert.equal(deux.mode, 'lot')
  assert.deepEqual(deux.gestes, [
    { geste: 'cocher', ticket: 2400, n: 4 }, { geste: 'ajouter-etape', ticket: 2400, texte: 'tour 10 publié' }, { geste: 'etat', ticket: 2400, etat: 'attente' },
  ])
  assert.equal(argumentsDuSuivi(['665', '--ajouter-etape', '2400', 'tour', '10']).refus,
    'argument en trop « 10 » : un texte se cite en UN argument, une option se nomme `--<option>`')
  assert.match(argumentsDuSuivi(['665', '--cocher', 'juge du brief']).refus, /--cocher : `ticket.n` attendu/)
  assert.match(argumentsDuSuivi(['665', '--ajouter-etape', '2400']).refus, /--ajouter-etape attend 2 argument\(s\)/)
  assert.match(argumentsDuSuivi(['665', '--ajouter-etape', '2400', '--json']).refus, /attend 2 argument/)
  assert.deepEqual(Object.keys(GESTES).sort(), [...GESTES_DE_LA_DONNEE].sort(), 'le CLI couvre chaque mutation')
  const modes = {
    '': 'liste', '665': 'situation', '665 --rendu': 'rendu', '665 --mesurer --sans-fetch --json': 'mesurer', '--outil --json': 'outil',
    '--session s --json --depuis k': 'session', '665 --lot -': 'lot', '665 --session s --json --cocher 2400.1': 'lot',
  }
  for (const [argv, mode] of Object.entries(modes)) assert.equal(argumentsDuSuivi(argv.split(' ').filter(Boolean)).mode, mode, argv)
  for (const refuse of ['--creer x', '665 --rendu --mesurer', '665 --json --cocher 1.1', '665 --sans-fetch', '--session s', '0', '665 666', '--outil', '665 --depuis k']) {
    assert.ok(argumentsDuSuivi(refuse.split(' ')).refus, refuse)
  }
})

test('`--lot` par ARGV et par STDIN, sur le CLI réel d’un dépôt forgé ; un lot d’une autre épique est refusé', () => {
  const { racine } = instanceDeDepot({ commit: false })
  const dossier = join(racine, '.git', 'suivi')
  const cli = (argv, input) => spawnSync(process.execPath, [SCRIPT, ...argv], { cwd: racine, input, encoding: 'utf8', timeout: 30_000 })
  try {
    const creer = cli(['665', '--lot', JSON.stringify({ epique: 665, mutations: BASE })])
    assert.equal(creer.status, 0, creer.stderr)
    assert.match(creer.stdout, /^\[suivi #665\] en cours : #2400 périmètre de tests\n {2}prochain geste : #2400\.2 juge du diff\n/)
    const stdin = cli(['665', '--lot', '-', '--session', 's', '--json'], JSON.stringify({ epique: 665, mutations: [{ geste: 'cocher', ticket: 2400, n: 2 }] }))
    assert.equal(stdin.status, 0, stdin.stderr)
    assert.deepEqual(JSON.parse(stdin.stdout).suivis[0].lignes[0], '[suivi #665] en cours : #2400 périmètre de tests')
    assert.deepEqual(lignesDuJournal(FS.readFileSync(join(dossier, JOURNAL), 'utf8')).map((l) => [l.session, l.epique]), [['s', 665]])
    const autre = cli(['665', '--lot', JSON.stringify({ epique: 1, mutations: [{ geste: 'friction', texte: 'x' }] })])
    assert.deepEqual([autre.status, /--lot porte l'épique #1, la commande vise #665/.test(autre.stderr)], [1, true])
    assert.match(mutationsDuLot('{"epique": 665, "mutations": []}', 665).refus, /--lot hors schéma : mutations/)
  } finally { FS.rmSync(racine, { recursive: true, force: true }) }
})

test('SCHÉMA MCP — `--outil --json` rend `OUTIL_SUIVI`, dont l’`inputSchema` est `z.toJSONSchema(Lot)`', () => {
  const sortie = JSON.parse(execFileSync(process.execPath, [SCRIPT, '--outil', '--json'], { encoding: 'utf8' }))
  assert.deepEqual(sortie, JSON.parse(JSON.stringify(OUTIL_SUIVI)))
  assert.deepEqual(sortie.inputSchema, JSON.parse(JSON.stringify(z.toJSONSchema(Lot))))
  assert.equal(sortie.name, 'suivi')
  assert.deepEqual(sortie.inputSchema.properties.mutations.items.oneOf.map((o) => o.properties.geste.const), GESTES_DE_LA_DONNEE)
})

// ————————————————————————————————————— l'écriture —————————————————————————————————————

test('écriture : texte changé → refus, cible intacte, aucun temporaire ; sinon remplacée ; `attendu: null` exige une cible ABSENTE', () => {
  const dossier = dossierJetable()
  try {
    const cible = join(dossier, '7.json')
    FS.writeFileSync(cible, 'édité ailleurs')
    const refus = ecrireSuivi({ cible, contenu: 'neuf', attendu: 'lu avant', geste: 'la mesure', pid: 11 })
    assert.deepEqual([refus.ok, refus.rejouable], [false, true])
    assert.match(refus.refus, /a changé pendant la mesure/)
    assert.equal(FS.readFileSync(cible, 'utf8'), 'édité ailleurs')
    assert.deepEqual(restes(dossier), [])
    assert.deepEqual(ecrireSuivi({ cible, contenu: 'neuf', attendu: 'édité ailleurs', geste: 'la mesure', pid: 11 }), { ok: true })
    assert.equal(FS.readFileSync(cible, 'utf8'), 'neuf')
    const apparu = ecrireSuivi({ cible, contenu: 'autre', attendu: null, geste: 'le lot', pid: 11 })
    assert.deepEqual([apparu.ok, apparu.rejouable, /est apparu pendant le lot/.test(apparu.refus)], [false, true, true])
    const neuve = join(dossier, '8.json')
    assert.deepEqual(ecrireSuivi({ cible: neuve, contenu: 'créé', attendu: null, geste: 'le lot', pid: 11 }), { ok: true })
    assert.equal(FS.readFileSync(neuve, 'utf8'), 'créé')
    assert.deepEqual(restes(dossier), [])
  } finally { FS.rmSync(dossier, { recursive: true, force: true }) }
})

test('écriture : rename en EPERM/EACCES/EBUSY → refus « tenu », sans temporaire ; une autre erreur est relancée', () => {
  const dossier = dossierJetable()
  try {
    const cible = join(dossier, '7.json')
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
    const cible = join(dossier, '7.json')
    FS.writeFileSync(cible, 'avant')
    const plein = { ...FS, writeFileSync: (chemin) => { FS.writeFileSync(chemin, 'part'); throw Object.assign(new Error('ENOSPC'), { code: 'ENOSPC' }) } }
    const nonEcrit = ecrireSuivi({ cible, contenu: 'neuf', attendu: 'avant', geste: 'la mesure', fs: plein, pid: 13 })
    assert.equal(nonEcrit.ok, false)
    assert.match(nonEcrit.refus, /temporaire .*\.7\.json\.13\.tmp non écrit \(ENOSPC\)/)
    assert.equal(FS.readFileSync(cible, 'utf8'), 'avant')
    assert.deepEqual(restes(dossier), [])
    FS.rmSync(cible)
    const disparue = ecrireSuivi({ cible, contenu: 'neuf', attendu: 'avant', geste: 'la mesure', pid: 13 })
    assert.match(disparue.refus, /7\.json a disparu pendant la mesure/)
    assert.equal(FS.existsSync(cible), false, 'une cible disparue n’est pas recréée')
    assert.deepEqual(restes(dossier), [])
  } finally { FS.rmSync(dossier, { recursive: true, force: true }) }
})

test('écriture : temporaire non écrit ET non supprimable → refus qui nomme les deux erreurs et le temporaire restant', () => {
  const dossier = dossierJetable()
  try {
    const cible = join(dossier, '7.json')
    FS.writeFileSync(cible, 'avant')
    const tenu = {
      ...FS,
      writeFileSync: (chemin) => { FS.writeFileSync(chemin, 'part'); throw Object.assign(new Error('ENOSPC'), { code: 'ENOSPC' }) },
      rmSync: () => { throw Object.assign(new Error('EPERM'), { code: 'EPERM' }) },
    }
    const vu = ecrireSuivi({ cible, contenu: 'neuf', attendu: 'avant', geste: 'la mesure', fs: tenu, pid: 14 })
    assert.match(vu.refus, /non écrit \(ENOSPC\).*temporaire RESTANT, non supprimé \(EPERM\) : .*\.7\.json\.14\.tmp$/)
    assert.equal(FS.readFileSync(cible, 'utf8'), 'avant')
    assert.deepEqual(listerSuivis({ dossier }).orphelins, ['.7.json.14.tmp'], 'le temporaire restant est retrouvé par le listage')
  } finally { FS.rmSync(dossier, { recursive: true, force: true }) }
})

test('écriture : une erreur RELANCÉE garde son code, et son message nomme le temporaire que le nettoyage n’a pas pu supprimer', () => {
  const dossier = dossierJetable()
  try {
    const cible = join(dossier, '7.json')
    FS.writeFileSync(cible, 'avant')
    const temporaire = join(dossier, '.7.json.15.tmp')
    const suffixe = ` ; temporaire RESTANT, non supprimé (EPERM) : ${temporaire}`
    const erreur = (code) => Object.assign(new Error(code), { code })
    const rmBloque = () => { throw erreur('EPERM') }
    const cas = {
      'relecture en EACCES': { ...FS, rmSync: rmBloque, readFileSync: (chemin, ...r) => (chemin === cible ? (() => { throw erreur('EACCES') })() : FS.readFileSync(chemin, ...r)) },
      'rename en ENOENT': { ...FS, rmSync: rmBloque, renameSync: () => { throw erreur('ENOENT') } },
    }
    for (const [nom, fs] of Object.entries(cas)) {
      const code = nom.endsWith('EACCES') ? 'EACCES' : 'ENOENT'
      assert.throws(() => ecrireSuivi({ cible, contenu: 'neuf', attendu: 'avant', geste: 'la mesure', fs, pid: 15 }), (e) => e.code === code && e.message === `${code}${suffixe}`, nom)
      assert.equal(FS.readFileSync(cible, 'utf8'), 'avant', nom)
      assert.deepEqual(listerSuivis({ dossier }).orphelins, ['.7.json.15.tmp'], nom)
    }
  } finally { FS.rmSync(dossier, { recursive: true, force: true }) }
})

test('listage : les suivis `^\\d+\\.json$` avec leur date, les orphelins NOMMÉS à part ; mesure, `.md`, `.tmp` hors motif et journal ignorés', () => {
  const dossier = dossierJetable()
  try {
    for (const nom of ['2132.json', '1816.json', '1816.mesure.json', '665.md', '2437-query.json', '.1816.json.4242.tmp', '.1816.mesure.json.7.tmp', 'x.tmp', '.journal']) {
      FS.writeFileSync(join(dossier, nom), '')
    }
    const vu = listerSuivis({ dossier })
    assert.deepEqual(vu.suivis.map((s) => s.nom), ['1816.json', '2132.json'])
    assert.deepEqual(vu.orphelins, ['.1816.json.4242.tmp', '.1816.mesure.json.7.tmp'])
    const texte = texteDeLaListe({ dossier, ...vu })
    assert.match(texte, new RegExp(`^1816\\.json\\t${horodatage(vu.suivis[0].date)}\\n`))
    assert.match(texte, /ORPHELINS[^\n]*\n {2}\.1816\.json\.4242\.tmp\n/)
    assert.match(texteDeLaListe({ dossier: join(dossier, 'absent'), ...listerSuivis({ dossier: join(dossier, 'absent') }) }), /aucun suivi/)
  } finally { FS.rmSync(dossier, { recursive: true, force: true }) }
})

// ————————————————————————————————————— la mesure —————————————————————————————————————

/** Des gestes de mesure FACTICES : un dépôt sans branche, `fetchOrigin` COMPTÉ, issues comptées. */
function mesureFactice(compte, { fetchOrigin, issues } = {}) {
  const fait = (valeur) => ({ disponible: true, valeur })
  return {
    cwd: '/dep',
    annoncer: () => {},
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

test('mesure : `<N>.mesure.json` écrit, JAMAIS le suivi ; portée = items ∪ file ; zéro fetch sous --sans-fetch ; datée, PÉRIMÉE au-delà du seuil', () => {
  const dossier = dossierJetable()
  try {
    poserSuivi({ dossier, epique: 665, lots: [BASE], maintenant: MAINTENANT })
    const suivi = FS.readFileSync(join(dossier, '665.json'))
    const compte = { fetch: 0, issues: [] }
    const vu = mesurerLeSuivi({ numero: 665, dossier, sansFetch: true, maintenant: MAINTENANT, mesure: mesureFactice(compte) })
    assert.equal(vu.code, 0, vu.stderr)
    assert.deepEqual([compte.fetch, compte.issues], [0, [[2400, 2187, 2497]]])
    assert.deepEqual(FS.readFileSync(join(dossier, '665.json')), suivi, 'le suivi n’est jamais réécrit par la mesure')
    const mesure = JSON.parse(FS.readFileSync(join(dossier, '665.mesure.json'), 'utf8'))
    assert.deepEqual([mesure.epique, mesure.portee, mesure.sansFetch, mesure.ok, mesure.lignes.map((l) => l.ticket)], [665, [2400, 2187, 2497], true, true, [2400, 2187, 2497]])
    assert.match(vu.stdout, /^## Mesure\nmesurée le 2026-10-07 10:00 \(sans fetch\)\n- #2400 Ouvert · issue ouvert/)
    assert.match(vu.stdout, /\[suivi\] profil \(ms\) : arbrePrincipal \d+ .* reste -?\d+\.\d\n$/)
    const lu = lireLeSuivi({ dossier, epique: 665 })
    assert.match(lignesDeSituation(lu, { maintenant: new Date(MAINTENANT.getTime() + 30 * 60_000), age: true }).at(-1), /mesurée il y a 30 min$/)
    const tard = new Date(MAINTENANT.getTime() + (HEURES_PEREMPTION + 1) * 3_600_000)
    assert.match(lignesDeSituation(lu, { maintenant: tard, age: true }).at(-1), /PÉRIMÉE, mesurée il y a 25 h$/)
    assert.match(digestDuSuivi(lu, { maintenant: tard }), /\*\*PÉRIMÉE\*\* : mesurée il y a 25 h \(au-delà de 24 h\) — `npm run ops:suivi -- 665 --mesurer`/)
    assert.deepEqual(restes(dossier), [])
    const absent = mesurerLeSuivi({ numero: 10, dossier, mesure: mesureFactice(compte) })
    assert.deepEqual([absent.code, /absent/.test(absent.stderr)], [1, true])
  } finally { FS.rmSync(dossier, { recursive: true, force: true }) }
})

test('mesure REFUSÉE : écrite avec son motif, code non nul ; elle cite la commande `--mesurer --sans-fetch`', () => {
  const dossier = dossierJetable()
  try {
    poserSuivi({ dossier, epique: 5, lots: [[{ geste: 'creer', titre: 'cinq' }, { geste: 'ajouter-item', ticket: 1, libelle: 'un' }]], maintenant: MAINTENANT })
    const mesure = mesureFactice({ fetch: 0, issues: [] }, { fetchOrigin: () => ({ disponible: false, issue: 'refus', raison: 'réseau coupé', diagnostic: { status: null, signal: null, stderr: '', stdout: '' } }) })
    const vu = mesurerLeSuivi({ numero: 5, dossier, maintenant: MAINTENANT, mesure })
    assert.equal(vu.code, 1)
    const ecrite = JSON.parse(FS.readFileSync(join(dossier, '5.mesure.json'), 'utf8'))
    assert.equal(ecrite.ok, false)
    assert.match(ecrite.refus, /origin non consultable .*`npm run ops:suivi -- 5 --mesurer --sans-fetch` mesure sur les refs déjà là/)
    assert.match(vu.stdout, /\*\*Mesure refusée\*\* : origin non consultable/)
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
      return indexerIssues([{ number: 2132, state: 'open' }, { number: 1988, state: 'open' }, { number: 1759, state: 'closed' }, { number: 1887, state: 'open' }], numeros)
    }
    const portee = [2132, 1988, 1759, 1]
    const vu = mesurer({ cwd: racine, base: 'origin/main', portee, issues })
    assert.equal(vu.ok, true, vu.refus)
    assert.deepEqual(lectures, [portee], 'UNE lecture, sur la portée SEULE')
    assert.deepEqual(vu.lignes.map((l) => [l.ticket, l.statut, l.etatIssue, l.branches]), [
      [2132, 'En cours', 'ouvert', ['chantier/2132-suivi']], [1988, 'Ouvert', 'ouvert', []], [1759, 'Fermé', 'fermé', []], [1, 'Introuvable', 'introuvable', []],
    ])
    assert.match(vu.lignes[2].dernierCommit, /^\d{4}-\d{2}-\d{2}$/, 'la publication de #1759 date sa ligne')
    assert.deepEqual(vu.anomalies, [`ticket #1 introuvable dans ${DEPOT}`])
    assert.deepEqual(mesurer({ cwd: racine, base: 'origin/main', portee: [], issues }).lignes, [])
    assert.equal(lectures.length, 1, 'une portée VIDE ne lit aucune issue')
  } finally {
    for (const d of [racine, nu]) FS.rmSync(d, { recursive: true, force: true })
  }
})

// ————————————————————————————————————— les vues —————————————————————————————————————

test('lignesDeSituation : alerte en tête, PREMIER item actif, prochain geste NUMÉROTÉ, ouverts ; âge pour le bandeau, date pour l’ajout ; absent et `.md` abandonné dits tels quels', () => {
  const dossier = dossierJetable()
  try {
    poserSuivi({ dossier, epique: 9, lots: [[{ geste: 'creer', titre: 'neuf' }, { geste: 'ajouter-item', ticket: 1, libelle: 'en attente', etat: 'attente' }], BASE.slice(1)], maintenant: MAINTENANT })
    const lu = lireLeSuivi({ dossier, epique: 9 })
    assert.deepEqual(lignesDeSituation(lu, { maintenant: MAINTENANT, age: true }), [
      '[suivi #9] en cours : #2400 périmètre de tests', '  prochain geste : #2400.2 juge du diff', '  ouverts : 3 item(s), 1 étape(s) · jamais mesurée',
    ])
    assert.deepEqual(lignesDeSituation(lireLeSuivi({ dossier, epique: 8 }), { maintenant: MAINTENANT, age: true }), [`[suivi #8] lié à cette session, mais absent : ${join(dossier, '8.json')}`])
    FS.writeFileSync(join(dossier, '7.md'), '# ancien')
    assert.deepEqual(lignesDeSituation(lireLeSuivi({ dossier, epique: 7 }), { maintenant: MAINTENANT, age: true }), [`[suivi #7] format .md abandonné : ${join(dossier, '7.md')}`])
  } finally { FS.rmSync(dossier, { recursive: true, force: true }) }
})

test('digest et rendu : le digest tait le fait et le clos, le rendu `--rendu` montre tout ; le digest se coupe au plafond, l’en-tête d’abord', () => {
  const dossier = dossierJetable()
  try {
    poserSuivi({ dossier, epique: 665, lots: [BASE, [{ geste: 'ajouter-item', ticket: 2001, libelle: 'fini', etat: 'clos' }, { geste: 'arbitrer', date: '2026-10-07', nature: 'utilisateur', verbatim: 'deux sessions' }]], maintenant: MAINTENANT })
    const lu = lireLeSuivi({ dossier, epique: 665 })
    const digest = digestDuSuivi(lu, { maintenant: MAINTENANT })
    assert.ok(digest.length <= PLAFOND_INJECTION)
    assert.ok(digest.startsWith(`[suivi #665] ${join(dossier, '665.json')} — écrit le 2026-10-07 10:00\n# Vague du tome 1\n\nObjectif : livrer le tome 1`), digest)
    assert.ok(digest.includes('- #2400 [actif] périmètre de tests — game-21\n  - [ ] #2400.2 juge du diff\n- #2187 [attente]'))
    assert.ok(digest.includes('## File\n1. #2497 durées apprises (bloqué par #2400)'))
    assert.ok(digest.includes('## Arbitrages\n- n° 1, 2026-10-07, utilisateur : « deux sessions »'))
    assert.doesNotMatch(digest, /#2400\.1|#2001/)
    const rendu = renduDuSuivi(lu, { maintenant: MAINTENANT })
    assert.ok(rendu.includes('  - [x] #2400.1 juge du brief') && rendu.includes('- #2001 [clos] fini'))
    for (const plafond of [0, 10, 80, 200]) assert.ok(digestDuSuivi(lu, { maintenant: MAINTENANT, plafond }).length <= plafond, `plafond ${plafond}`)
    assert.match(digestDuSuivi(lu, { maintenant: MAINTENANT, plafond: 300 }), /\n… tronqué, `npm run ops:suivi -- 665 --rendu` le rend entier$/)
  } finally { FS.rmSync(dossier, { recursive: true, force: true }) }
})

test('etatDeSession : sans lien, l’index en contexte ; lié, la clé suit l’ÉTAT, jamais l’heure de relecture ; `depuis` vide l’ajout tant que la clé ne change pas', () => {
  const dossier = dossierJetable()
  try {
    poserSuivi({ dossier, epique: 9, lots: [BASE], maintenant: MAINTENANT })
    const seul = etatDeSession({ session: 's', dossier, maintenant: new Date() })
    assert.deepEqual([seul.suivis, seul.ajout], [[], ''])
    assert.match(seul.contexte, /^\[suivi\] session sans suivi lié[^\n]*\n- #9 — Vague du tome 1 — /)
    FS.writeFileSync(join(dossier, JOURNAL), ligneDeJournal({ iso: 'x', session: 's', epique: 9 }))
    const a = etatDeSession({ session: 's', dossier, maintenant: MAINTENANT })
    const b = etatDeSession({ session: 's', dossier, maintenant: new Date(MAINTENANT.getTime() + 3_600_000) })
    assert.equal(a.ajout, ['[suivi] situation relue le 2026-10-07 10:00', '[suivi #9] en cours : #2400 périmètre de tests',
      '  prochain geste : #2400.2 juge du diff', '  ouverts : 2 item(s), 1 étape(s) · jamais mesurée'].join('\n'))
    assert.equal(a.cle, b.cle, 'même état, même clé')
    assert.deepEqual([etatDeSession({ session: 's', dossier, maintenant: MAINTENANT, depuis: a.cle }).ajout, a.cle !== seul.cle], ['', true])
    poserSuivi({ dossier, epique: 9, lots: [[{ geste: 'cocher', ticket: 2400, n: 2 }]], maintenant: MAINTENANT })
    const change = etatDeSession({ session: 's', dossier, maintenant: MAINTENANT, depuis: a.cle })
    assert.notEqual(change.cle, a.cle)
    assert.doesNotMatch(change.ajout, /prochain geste/)
  } finally { FS.rmSync(dossier, { recursive: true, force: true }) }
})

test('editer : lie la session UNE fois, rend l’état ; un refus ne touche ni le suivi ni le journal ; absent sans `creer` → refus qui nomme `--creer`', () => {
  const dossier = dossierJetable()
  const journal = () => lignesDuJournal(FS.readFileSync(join(dossier, JOURNAL), 'utf8')).map((l) => [l.session, l.epique])
  try {
    const absent = editer({ numero: 8, dossier, session: 's', mutations: [{ geste: 'ajouter-item', ticket: 1, libelle: 'x' }], maintenant: MAINTENANT })
    assert.deepEqual([absent.code, absent.stdout], [1, ''])
    assert.match(absent.stderr, /suivi absent .*`npm run ops:suivi -- 8 --creer <titre>` le pose/)
    assert.equal(FS.existsSync(join(dossier, JOURNAL)), false)
    poserSuivi({ dossier, epique: 9, lots: [BASE], maintenant: MAINTENANT })
    const fait = editer({ numero: 9, dossier, session: 's', json: true, mutations: [{ geste: 'cocher', ticket: 2400, n: 2 }], maintenant: MAINTENANT })
    assert.equal(fait.code, 0, fait.stderr)
    assert.deepEqual(JSON.parse(fait.stdout), etatDeSession({ session: 's', dossier, maintenant: MAINTENANT }))
    editer({ numero: 9, dossier, session: 's', mutations: [{ geste: 'ajouter-etape', ticket: 2187, texte: 'brief' }], maintenant: MAINTENANT })
    assert.deepEqual(journal(), [['s', 9]], 'le lien n’est tracé qu’une fois')
    assert.deepEqual(restes(dossier), [])
  } finally { FS.rmSync(dossier, { recursive: true, force: true }) }
})

// ————————————————————————————————————— la concurrence —————————————————————————————————————

test('#2279 B1 — N lots en PARALLÈLE (processus distincts) : aucun perdu, chaque succès est dans le fichier', async () => {
  const module = pathToFileURL(SCRIPT).href
  const lancer = (dossier, k) => new Promise((fini) => {
    const code = `const { editer } = await import(${JSON.stringify(module)}); const r = editer({ numero: 9, dossier: ${JSON.stringify(dossier)}, `
      + `session: 's${k}', mutations: [{ geste: 'enfiler', ticket: ${100 + k}, libelle: 'lot ${k}' }] }); process.stdout.write(String(r.code))`
    const enfant = spawn(process.execPath, ['--input-type=module', '-e', code], { stdio: ['ignore', 'pipe', 'inherit'] })
    let sortie = ''
    enfant.stdout.on('data', (d) => { sortie += d })
    enfant.on('close', () => fini({ k, code: sortie.trim() }))
  })
  for (let essai = 0; essai < 6; essai += 1) {
    const dossier = dossierJetable()
    try {
      poserSuivi({ dossier, epique: 9, lots: [BASE], maintenant: MAINTENANT })
      const codes = await Promise.all(Array.from({ length: 6 }, (_, k) => lancer(dossier, k)))
      const suivi = lireSuivi(FS.readFileSync(join(dossier, '9.json'), 'utf8'))
      assert.equal(suivi.ok, true, suivi.refus)
      for (const { k, code } of codes) assert.equal(code, '0', `essai ${essai}, lot ${k} : refusé`)
      for (const { k } of codes) assert.ok(suivi.suivi.file.some((f) => f.ticket === 100 + k), `essai ${essai} : le lot ${k} a réussi mais n’est pas dans le fichier`)
      assert.deepEqual(FS.readdirSync(dossier).filter((n) => n.startsWith('.9.json')), [], 'ni temporaire ni verrou restant')
    } finally { FS.rmSync(dossier, { recursive: true, force: true }) }
  }
})

test('#2279 B1 — un verrou tenu par un processus VIVANT : écriture refusée et rejouable ; tenu par un mort, repris ; `editer` refuse après ESSAIS_D_EDITION essais', () => {
  const dossier = dossierJetable()
  try {
    poserSuivi({ dossier, epique: 9, lots: [BASE], maintenant: MAINTENANT })
    const cible = join(dossier, '9.json')
    const texte = FS.readFileSync(cible, 'utf8')
    const verrou = join(dossier, '.9.json.verrou')
    FS.writeFileSync(verrou, JSON.stringify({ pid: process.ppid, commande: 'autre', cwd: dossier, date: 'x' }))
    const refus = ecrireSuivi({ cible, contenu: 'neuf', attendu: texte, geste: 'le lot' })
    assert.deepEqual([refus.ok, refus.rejouable], [false, true])
    const vu = editer({ numero: 9, dossier, session: 's', mutations: [{ geste: 'friction', texte: 'x' }] })
    assert.equal(vu.code, 1)
    assert.match(vu.stderr, new RegExp(`en cours d'écriture par un autre processus.*\\(${ESSAIS_D_EDITION} essais\\)`))
    assert.equal(FS.readFileSync(cible, 'utf8'), texte)
    assert.equal(FS.existsSync(join(dossier, JOURNAL)), false)
    FS.writeFileSync(verrou, JSON.stringify({ pid: 2 ** 30, commande: 'mort', cwd: dossier, date: 'x' }))
    assert.deepEqual(ecrireSuivi({ cible, contenu: texte, attendu: texte, geste: 'le lot' }), { ok: true })
    assert.equal(FS.existsSync(verrou), false, 'le verrou repris est libéré')
  } finally { FS.rmSync(dossier, { recursive: true, force: true }) }
})

test('CLI `--session <id> --json` sur un dépôt FORGÉ : l’état de la session, en LECTURE SEULE', () => {
  const { racine } = instanceDeDepot({ commit: false })
  const dossier = join(racine, '.git', 'suivi')
  try {
    FS.mkdirSync(dossier, { recursive: true })
    poserSuivi({ dossier, epique: 9, lots: [BASE], maintenant: MAINTENANT })
    FS.writeFileSync(join(dossier, JOURNAL), ligneDeJournal({ iso: 'x', session: 's', epique: 9 }))
    const avant = FS.readdirSync(dossier).map((n) => [n, FS.statSync(join(dossier, n)).mtimeMs])
    const etat = JSON.parse(execFileSync(process.execPath, [SCRIPT, '--session', 's', '--json'], { cwd: racine, encoding: 'utf8' }))
    assert.deepEqual(Object.keys(etat), ['session', 'suivis', 'contexte', 'ajout', 'cle'])
    assert.equal(etat.suivis[0].lignes[0], '[suivi #9] en cours : #2400 périmètre de tests')
    assert.equal(FS.realpathSync(dirname(etat.suivis[0].chemin)), FS.realpathSync(dossier), 'le dossier des suivis du dépôt forgé')
    assert.deepEqual(FS.readdirSync(dossier).map((n) => [n, FS.statSync(join(dossier, n)).mtimeMs]), avant, 'rien n’est écrit')
  } finally {
    FS.rmSync(racine, { recursive: true, force: true })
  }
})
