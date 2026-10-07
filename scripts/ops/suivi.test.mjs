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
  ESSAIS_D_EDITION, JOURNAL, argumentsDuSuivi, digestDuSuivi,
  editer, etatDeSession, ligneDeJournal, lignesDeSituation, lignesDuJournal,
  mutationsDuLot, renduDuSuivi, texteDeLaListe,
} from './suivi.mjs'
import { ecrireSuivi, lireLeSuivi, listerSuivis } from './suiviFichiers.mjs'
import { mesureProfilee, mesurerLeSuivi } from './suiviMesure.mjs'
import {
  BUDGET_DU_SUIVI, ETAPES_OUVERTES_PAR_ITEM, HEURES_PEREMPTION, LONGUEUR_ETAPE, LONGUEUR_LIBELLE, Lot, OUTIL_SUIVI, PLAFOND_INJECTION, appliquer,
  confronter, horodatage, lireMesure, lireSuivi, sceller, tailleDuSuivi, texteDuSuivi,
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
  assert.match(refusDe(s, [{ geste: 'ajouter-item', ticket: 2400, libelle: 'encore' }]), /^lot refusé : l'état final est hors schéma : doublon : le ticket #2400/)
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
  assert.match(refusDe(s, ouvertes), new RegExp(`^lot refusé : l'état final est hors schéma : .*${ETAPES_OUVERTES_PAR_ITEM + 1} étapes ouvertes`))
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
    assert.match(creer.stdout, /^\[suivi #665\] ⚠ jamais mesurée \(re-mesure demandée\)\n\[suivi #665\] en cours : #2400 périmètre de tests\n {2}prochain geste : #2400\.2 juge du diff\n/)
    const stdin = cli(['665', '--lot', '-', '--session', 's', '--json'], JSON.stringify({ epique: 665, mutations: [{ geste: 'cocher', ticket: 2400, n: 2 }] }))
    assert.equal(stdin.status, 0, stdin.stderr)
    assert.deepEqual(JSON.parse(stdin.stdout).suivis[0].lignes[1], '[suivi #665] en cours : #2400 périmètre de tests')
    assert.deepEqual(lignesDuJournal(FS.readFileSync(join(dossier, JOURNAL), 'utf8')).map((l) => [l.session, l.epique]), [['s', 665]])
    const autre = cli(['665', '--lot', JSON.stringify({ epique: 1, mutations: [{ geste: 'friction', texte: 'x' }] })])
    assert.deepEqual([autre.status, /--lot porte l'épique #1, la commande vise #665/.test(autre.stderr)], [1, true])
    assert.match(mutationsDuLot('{"epique": 665, "mutations": []}', 665).refus, /--lot hors schéma : mutations/)
  } finally { FS.rmSync(racine, { recursive: true, force: true }) }
})

test('PROCESSUS `--mesurer --sans-fetch` — le CLI réel, point d’entrée, va au bout : code 0 et `<N>.mesure.json` écrit ; jamais 13 (« unsettled top-level await »)', () => {
  const { racine } = instanceDeDepot({ fichiers: { 'a.txt': 'a' }, message: 'fondation' })
  const cli = (argv) => spawnSync(process.execPath, [SCRIPT, ...argv], { cwd: racine, encoding: 'utf8', timeout: 60_000 })
  try {
    assert.equal(cli(['665', '--creer', 'banc']).status, 0)
    const vu = cli(['665', '--mesurer', '--sans-fetch'])
    assert.doesNotMatch(vu.stderr, /unsettled top-level await/)
    assert.equal(vu.status, 0, vu.stderr)
    assert.match(vu.stdout, /^## Mesure\nmesurée le .* \(sans fetch\)\n/)
    assert.equal(lireMesure(FS.readFileSync(join(racine, '.git', 'suivi', '665.mesure.json'), 'utf8')).ok, true)
  } finally { FS.rmSync(racine, { recursive: true, force: true }) }
})

test('SCHÉMA MCP — `--outil --json` rend `OUTIL_SUIVI`, dont l’`inputSchema` est `z.toJSONSchema(Lot)`', () => {
  const sortie = JSON.parse(execFileSync(process.execPath, [SCRIPT, '--outil', '--json'], { encoding: 'utf8' }))
  assert.deepEqual(sortie, JSON.parse(JSON.stringify(OUTIL_SUIVI)))
  assert.deepEqual(sortie.inputSchema, JSON.parse(JSON.stringify(z.toJSONSchema(Lot))))
  assert.equal(sortie.name, 'suivi')
})

test('ÉTAT FINAL — le schéma valide l’état FINAL du lot : ajouter une 6e étape ouverte puis cocher passe, cocher puis ajouter aussi ; le refus d’un GESTE garde son rang', () => {
  let s = exemple()
  for (let k = 0; k < ETAPES_OUVERTES_PAR_ITEM - 1; k += 1) s = apres(s, [{ geste: 'ajouter-etape', ticket: 2400, texte: `e${k}` }])
  assert.equal(s.items[0].etapes.filter((e) => !e.faite).length, ETAPES_OUVERTES_PAR_ITEM)
  const ajouterPuisCocher = apres(s, [{ geste: 'ajouter-etape', ticket: 2400, texte: 'sixième' }, { geste: 'cocher', ticket: 2400, n: 2 }])
  assert.equal(ajouterPuisCocher.items[0].etapes.filter((e) => !e.faite).length, ETAPES_OUVERTES_PAR_ITEM)
  assert.equal(apres(s, [{ geste: 'cocher', ticket: 2400, n: 2 }, { geste: 'ajouter-etape', ticket: 2400, texte: 'sixième' }]).items[0].etapes.length, 7)
  assert.match(refusDe(s, [{ geste: 'ajouter-etape', ticket: 2400, texte: 'sixième' }]), /^lot refusé : l'état final est hors schéma : .*6 étapes ouvertes, 5 au plus — rien n'est écrit$/)
  assert.match(refusDe(s, [{ geste: 'ajouter-etape', ticket: 2400, texte: 'x' }, { geste: 'cocher', ticket: 2400, n: 1 }]), /^mutation 2 \(cocher\) : étape #2400\.1 déjà faite/)
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
function mesureFactice(compte, { fetchOrigin, issues, branches = [], avance = 0 } = {}) {
  const fait = (valeur) => ({ disponible: true, valeur })
  return {
    cwd: '/dep',
    annoncer: () => {},
    gestes: {
      arbrePrincipal: () => fait('/dep'),
      fetchOrigin: fetchOrigin ?? (() => { compte.fetch += 1; return fait({ status: 0, signal: null, stdout: '', stderr: '' }) }),
      branchesDe: () => branches,
      divergenceDe: () => ({ avance, retard: 0 }),
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
    assert.match(lignesDeSituation(lu, { maintenant: new Date(MAINTENANT.getTime() + 30 * 60_000), age: true }).at(-1), /mesurée il y a 30 min, sans fetch$/)
    const tard = new Date(MAINTENANT.getTime() + (HEURES_PEREMPTION + 1) * 3_600_000)
    const perimee = lignesDeSituation(lu, { maintenant: tard, age: true })
    assert.deepEqual([perimee[0], perimee.at(-1)], ['[suivi #665] ⚠ mesure PÉRIMÉE (re-mesure demandée)', `  ouverts : 2 item(s), 1 étape(s) · mesurée il y a ${HEURES_PEREMPTION + 1} h, sans fetch`])
    assert.match(digestDuSuivi(lu, { maintenant: tard }), /\n\[suivi #665\] ⚠ mesure PÉRIMÉE \(re-mesure demandée\)\n# Vague du tome 1/)
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
    assert.deepEqual(vu.anomalies, [{ genre: 'ticket-introuvable', cle: '#1', texte: `ticket #1 introuvable dans ${DEPOT}` }])
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
      '[suivi #9] ⚠ jamais mesurée (re-mesure demandée)', '[suivi #9] en cours : #2400 périmètre de tests', '  prochain geste : #2400.2 juge du diff',
      '  ouverts : 3 item(s), 1 étape(s) · jamais mesurée',
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
    assert.ok(digest.startsWith(`[suivi #665] ${join(dossier, '665.json')} — écrit le 2026-10-07 10:00\n[suivi #665] ⚠ jamais mesurée (re-mesure demandée)\n`
      + '# Vague du tome 1\n\nObjectif : livrer le tome 1'), digest)
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
    assert.equal(a.ajout, ['[suivi] situation relue le 2026-10-07 10:00', '[suivi #9] ⚠ jamais mesurée (re-mesure demandée)',
      '[suivi #9] en cours : #2400 périmètre de tests', '  prochain geste : #2400.2 juge du diff', '  ouverts : 2 item(s), 1 étape(s) · jamais mesurée'].join('\n'))
    assert.deepEqual(a.aMesurer, [9], 'jamais mesurée : le lecteur DEMANDE la mesure, sans la faire')
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
    assert.deepEqual(Object.keys(etat), ['session', 'suivis', 'contexte', 'ajout', 'cle', 'aMesurer'])
    assert.deepEqual([etat.suivis[0].lignes[1], etat.aMesurer], ['[suivi #9] en cours : #2400 périmètre de tests', [9]])
    assert.equal(FS.realpathSync(dirname(etat.suivis[0].chemin)), FS.realpathSync(dossier), 'le dossier des suivis du dépôt forgé')
    assert.deepEqual(FS.readdirSync(dossier).map((n) => [n, FS.statSync(join(dossier, n)).mtimeMs]), avant, 'rien n’est écrit')
  } finally {
    FS.rmSync(racine, { recursive: true, force: true })
  }
})

// ———————————————————————————— la confrontation à la réalité (#2460, C2) ————————————————————————————

/** Une ligne de mesure ouverte, `En cours`, sans mise à jour d'issue, que `reste` précise. */
const ligneOuverte = (ticket, reste = {}) => ({ ticket, statut: 'En cours', etatIssue: 'ouvert', issueMiseAJour: '', branches: [], worktrees: [], avance: '', dernierCommit: '', ...reste })

/** Une mesure LUE (`lireMesure`) datée de `date`, sur la portée de `suivi`, que `reste` précise. */
const mesureLue = (suivi, { date = MAINTENANT, lignes, vivants = [], anomalies = [], portee } = {}) => ({
  ok: true,
  mesure: {
    version: 1, epique: suivi.epique, date: date.toISOString(), sansFetch: true, portee: portee ?? [...suivi.items, ...suivi.file].map((e) => e.ticket),
    ok: true, refus: null, lignes: lignes ?? [...suivi.items, ...suivi.file].map((e) => ligneOuverte(e.ticket)), vivants, anomalies,
  },
})

/** Un suivi LU (forme de `lireLeSuivi`), scellé par l'outil, avec sa mesure et les autres suivis du dossier. */
const luDe = (suivi, mesure, autres = []) => ({ epique: suivi.epique, chemin: `/s/${suivi.epique}.json`, suivi, alerte: null, mesure, autres })

/** Le suivi d'exemple, l'item #2001 clos en plus. */
const exempleClos = () => apres(exemple(), [{ geste: 'ajouter-item', ticket: 2001, libelle: 'fini', etat: 'clos' }])

test('CONTRE-TÉMOIN — un suivi et une mesure COHÉRENTS ne rendent AUCUNE anomalie ; le bandeau n’a ni ⚠ ni ligne d’anomalies', () => {
  const s = exempleClos()
  const mesure = mesureLue(s, {
    lignes: [ligneOuverte(2400), ligneOuverte(2187), ligneOuverte(2497), ligneOuverte(2001, { statut: 'Fermé', etatIssue: 'fermé' })],
    vivants: [{ branche: 'chantier/2400', tickets: [2400], avance: 2, retard: 0, worktrees: ['/dep/.wt-2400 (propre)'], dernierCommit: MAINTENANT.toISOString(), sale: false }],
  })
  const c = confronter({ suivi: s, mesure, maintenant: MAINTENANT })
  assert.deepEqual([c.alertes, c.anomalies, c.taisees, c.aMesurer], [[], [], 0, false])
  const bandeau = lignesDeSituation(luDe(s, mesure), { maintenant: MAINTENANT, age: true })
  assert.deepEqual(bandeau, ['[suivi #665] en cours : #2400 périmètre de tests', '  prochain geste : #2400.2 juge du diff', '  ouverts : 2 item(s), 1 étape(s) · mesurée il y a 0 min, sans fetch'])
  assert.doesNotMatch(digestDuSuivi(luDe(s, mesure), { maintenant: MAINTENANT }), /## Anomalies|⚠/)
})

test('ANOMALIE 1 — ticket FERMÉ d’un item non clos ou d’une entrée de file ; symétrique : item CLOS, ticket OUVERT', () => {
  const s = exempleClos()
  const mesure = mesureLue(s, {
    lignes: [ligneOuverte(2400), ligneOuverte(2187, { statut: 'Fermé', etatIssue: 'fermé' }), ligneOuverte(2497, { statut: 'Fermé', etatIssue: 'fermé' }), ligneOuverte(2001)],
  })
  const c = confronter({ suivi: s, mesure, maintenant: MAINTENANT })
  assert.deepEqual(c.anomalies.map((a) => [a.genre, a.cle, a.court]), [
    ['ticket-ferme', '#2187', '#2187 fermé'], ['clos-ticket-ouvert', '#2001', '#2001 clos, ticket ouvert'], ['ticket-ferme', '#2497', '#2497 fermé'],
  ])
  const bandeau = lignesDeSituation(luDe(s, mesure), { maintenant: MAINTENANT, age: true })
  assert.equal(bandeau[2], '  anomalies : 3 — #2187 fermé · #2001 clos, ticket ouvert · #2497 fermé')
  assert.match(digestDuSuivi(luDe(s, mesure), { maintenant: MAINTENANT }), /\n## Anomalies\n- ⚠ #2187 fermé, item « attente » : `--etat 2187 clos`\n/)
})

test('ANOMALIE 2 — chantier vivant que ne nomme AUCUN suivi du dossier ; celui d’une AUTRE vague n’est pas rendu', () => {
  const s = exemple()
  const autre = appliquer(null, [{ geste: 'creer', titre: 'autre vague' }, { geste: 'ajouter-item', ticket: 1882, libelle: 'garé', etat: 'gare' }], { maintenant: MAINTENANT, epique: 1816 }).suivi
  const vivant = (branche, tickets) => ({ branche, tickets, avance: 1, retard: 4, worktrees: [], dernierCommit: MAINTENANT.toISOString(), sale: false })
  const mesure = mesureLue(s, { vivants: [vivant('chantier/2400', [2400]), vivant('chantier/1882', [1882]), vivant('chantier/2456', [2456])] })
  const c = confronter({ suivi: s, mesure, autresSuivis: [autre], maintenant: MAINTENANT })
  assert.deepEqual(c.anomalies.map((a) => [a.genre, a.cle, a.court]), [['chantier-sans-item', 'chantier/2456', 'chantier/2456 sans item']])
  assert.match(c.anomalies[0].texte, /^chantier\/2456 \(#2456\) vivant \(\+1 \/ −4\), nommé par AUCUN suivi/)
  assert.equal(confronter({ suivi: s, mesure, maintenant: MAINTENANT }).anomalies.length, 2, 'sans l’autre suivi, #1882 crierait')
})

test('ANOMALIE 3 — prochain geste antérieur à l’issue ou à la publication : heuristique libellée « à revalider »', () => {
  const s = exemple()
  const plusTard = new Date(MAINTENANT.getTime() + 3_600_000).toISOString()
  const parIssue = confronter({ suivi: s, mesure: mesureLue(s, { lignes: [ligneOuverte(2400, { issueMiseAJour: plusTard }), ligneOuverte(2187), ligneOuverte(2497)] }), maintenant: MAINTENANT })
  assert.deepEqual(parIssue.anomalies.map((a) => [a.genre, a.cle, a.court]), [['geste-a-revalider', '#2400.2', '#2400.2 à revalider']])
  assert.match(parIssue.anomalies[0].texte, /antérieur à l'issue, mise à jour le 2026-10-07 — heuristique, à revalider$/)
  const parBase = confronter({ suivi: s, mesure: mesureLue(s, { lignes: [ligneOuverte(2400, { statut: 'Fusionné', dernierCommit: '2026-10-08' }), ligneOuverte(2187), ligneOuverte(2497)] }), maintenant: MAINTENANT })
  assert.match(parBase.anomalies.find((a) => a.genre === 'geste-a-revalider').texte, /antérieur à la publication du 2026-10-08/)
  const avant = new Date(MAINTENANT.getTime() - 3_600_000).toISOString()
  assert.deepEqual(confronter({ suivi: s, mesure: mesureLue(s, { lignes: [ligneOuverte(2400, { issueMiseAJour: avant }), ligneOuverte(2187), ligneOuverte(2497)] }), maintenant: MAINTENANT }).anomalies, [])
})

test('ANOMALIE 4 — mesure absente, PÉRIMÉE ou portée changée : EN TÊTE du bandeau, et `aMesurer`', () => {
  const s = exemple()
  const tard = new Date(MAINTENANT.getTime() + (HEURES_PEREMPTION + 1) * 3_600_000)
  const perimee = confronter({ suivi: s, mesure: mesureLue(s), maintenant: tard })
  assert.deepEqual([perimee.alertes.map((a) => a.genre), perimee.aMesurer], [['mesure-perimee'], true])
  assert.equal(confronter({ suivi: s, mesure: mesureLue(s), maintenant: new Date(MAINTENANT.getTime() + HEURES_PEREMPTION * 3_600_000 - 1) }).aMesurer, false)
  const changee = mesureLue(s, { portee: [2400, 2187] })
  assert.deepEqual(confronter({ suivi: s, mesure: changee, maintenant: MAINTENANT }).alertes.map((a) => a.court), ['portée changée depuis la mesure (re-mesure demandée)'])
  assert.equal(confronter({ suivi: s, mesure: mesureLue(s, { portee: [2497, 2187, 2400] }), maintenant: MAINTENANT }).aMesurer, false, 'l’ordre de la portée ne compte pas')
  const [tete] = lignesDeSituation(luDe(s, changee), { maintenant: tard, age: true })
  assert.equal(tete, '[suivi #665] ⚠ mesure PÉRIMÉE (re-mesure demandée) · portée changée depuis la mesure (re-mesure demandée)')
  assert.deepEqual(confronter({ suivi: s, mesure: null, maintenant: MAINTENANT }).alertes.map((a) => [a.genre, a.court]), [['mesure-absente', 'jamais mesurée (re-mesure demandée)']])
  assert.equal(confronter({ suivi: s, mesure: { ok: false, refus: 'x' }, maintenant: MAINTENANT }).aMesurer, true)
})

/** Le suivi d'exemple, signalements de 280 caractères ajoutés lot après lot jusqu'au refus de budget ; rend le dernier accepté et le refus. */
function jusquAuBudget() {
  let s = exemple()
  for (let k = 1; k < 100; k += 1) {
    const vu = appliquer(s, [{ geste: 'signaler', texte: `signalement ${k} ${'x'.repeat(260)}` }], { maintenant: MAINTENANT })
    if (!vu.ok) return { s, refus: vu.refus }
    s = vu.suivi
  }
  throw new Error('jamais refusé')
}

test('ANOMALIE 6 — BUDGET : un lot qui GROSSIT au-delà est refusé, candidats nommés ; un lot qui réduit, ou qui condense puis ajoute, passe ; hors budget, la lecture reste possible et le dit', () => {
  const { s, refus } = jusquAuBudget()
  assert.ok(tailleDuSuivi(s) <= BUDGET_DU_SUIVI)
  assert.match(refus, new RegExp(`^lot refusé : le suivi ferait \\d+ caractères \\(${tailleDuSuivi(s)} avant\\), au-delà du budget de ${BUDGET_DU_SUIVI} — `))
  assert.match(refus, /candidats : --retirer-etape 2400\.1 · --retirer-signalement 1 · --retirer-signalement 2 · .*\(\+\d+\) — rien n'est écrit$/)
  const condenserPuisAjouter = appliquer(s, [{ geste: 'retirer-signalement', n: 1 }, { geste: 'retirer-signalement', n: 2 }, { geste: 'signaler', texte: 'court' }], { maintenant: MAINTENANT })
  assert.equal(condenserPuisAjouter.ok, true, condenserPuisAjouter.refus)
  const trop = sceller({ ...s, compteurs: { ...s.compteurs, signalement: s.compteurs.signalement + 5 },
    aSignaler: [...s.aSignaler, ...Array.from({ length: 5 }, (_, k) => ({ n: s.compteurs.signalement + k + 1, date: '2026-10-07', texte: 'y'.repeat(290) }))] }, { maintenant: MAINTENANT })
  assert.ok(tailleDuSuivi(trop) > BUDGET_DU_SUIVI)
  const lu = lireSuivi(texteDuSuivi(trop))
  assert.equal(lu.ok, true, 'hors budget : LISIBLE, jamais refusé à la lecture')
  const c = confronter({ suivi: lu.suivi, mesure: mesureLue(lu.suivi), maintenant: MAINTENANT })
  assert.deepEqual(c.anomalies.map((a) => [a.genre, a.court]), [['budget', `hors budget (${tailleDuSuivi(trop)}/${BUDGET_DU_SUIVI})`]])
  assert.match(c.anomalies[0].texte, /seuls les lots qui réduisent passent — candidats : --retirer-etape 2400\.1/)
  assert.equal(appliquer(trop, [{ geste: 'retirer-signalement', n: 1 }], { maintenant: MAINTENANT }).ok, true, 'un lot qui réduit passe, même au-dessus du budget')
  assert.match(appliquer(trop, [{ geste: 'cocher', ticket: 2400, n: 2 }, { geste: 'signaler', texte: 'encore' }], { maintenant: MAINTENANT }).refus, /^lot refusé : .*au-delà du budget/)
})

test('ANOMALIE 9 — récurrentes AGRÉGÉES en une ligne ; `ignorer` en tait une ; une disposition dont la clé n’apparaît plus est « sans objet »', () => {
  const s = apres(exemple(), [
    { geste: 'ignorer-anomalie', genre: 'branche-sans-ticket', cle: 'essai/a', motif: 'essai local' },
    { geste: 'ignorer-anomalie', genre: 'worktree-detache', cle: '/dep/parti', motif: 'disparu depuis' },
  ])
  const vieille = new Date(MAINTENANT.getTime() - 48 * 3_600_000).toISOString()
  const anomalie = (genre, cle, vueDepuis) => ({ genre, cle, texte: `${genre} ${cle} (+3 / −9)`, vueDepuis })
  const mesure = mesureLue(s, { anomalies: [
    anomalie('branche-sans-ticket', 'essai/neuve', MAINTENANT.toISOString()),
    anomalie('branche-sans-ticket', 'essai/a', vieille), anomalie('branche-sans-ticket', 'essai/b', vieille), anomalie('worktree-detache', '/dep/w', vieille),
  ] })
  const c = confronter({ suivi: s, mesure, maintenant: MAINTENANT })
  assert.deepEqual(c.anomalies.map((a) => a.court), [
    'branche-sans-ticket essai/neuve', '2 récurrente(s) depuis le 2026-10-05', 'disposition sans objet : worktree-detache /dep/parti',
  ])
  assert.equal(c.taisees, 1)
  assert.match(c.anomalies[1].texte, /branche-sans-ticket « essai\/b » · worktree-detache « \/dep\/w »/)
  assert.doesNotMatch(c.anomalies[1].texte, /essai\/a/, 'tue par sa disposition')
  assert.match(digestDuSuivi(luDe(s, mesure), { maintenant: MAINTENANT }), /- 1 anomalie\(s\) tue\(s\) par disposition/)
  assert.equal(confronter({ suivi: s, mesure: null, maintenant: MAINTENANT }).anomalies.length, 0, 'sans mesure, aucune disposition n’est jugée sans objet')
})

test('ALLER-RETOUR — la mesure ÉCRITE par `mesurerLeSuivi` se RELIT (`lireMesure`) : un vivant porte son dernier commit et sa saleté', () => {
  const dossier = dossierJetable()
  try {
    poserSuivi({ dossier, epique: 665, lots: [BASE], maintenant: MAINTENANT })
    const branches = [{ nom: 'chantier/2400-perimetre', dernierCommitISO: MAINTENANT.toISOString(), sha: 'aaaaaaa' }]
    const vu = mesurerLeSuivi({ numero: 665, dossier, sansFetch: true, maintenant: MAINTENANT, mesure: mesureFactice({ fetch: 0, issues: [] }, { branches, avance: 2 }) })
    assert.equal(vu.code, 0, vu.stderr)
    const lue = lireLeSuivi({ dossier, epique: 665 }).mesure
    assert.equal(lue.ok, true, lue.refus)
    assert.deepEqual(lue.mesure.vivants.map((v) => [v.branche, v.dernierCommit, v.sale]), [['chantier/2400-perimetre', MAINTENANT.toISOString(), false]])
  } finally { FS.rmSync(dossier, { recursive: true, force: true }) }
})

test('ANOMALIE 9 — `vueDepuis` est REPORTÉ d’une mesure à la suivante, par (genre, clé)', () => {
  const dossier = dossierJetable()
  try {
    poserSuivi({ dossier, epique: 665, lots: [BASE], maintenant: MAINTENANT })
    const plusTard = new Date(MAINTENANT.getTime() + 3_600_000)
    for (const maintenant of [MAINTENANT, plusTard]) {
      assert.equal(mesurerLeSuivi({ numero: 665, dossier, sansFetch: true, maintenant, mesure: mesureFactice({ fetch: 0, issues: [] }) }).code, 0)
    }
    const ecrite = JSON.parse(FS.readFileSync(join(dossier, '665.mesure.json'), 'utf8'))
    assert.deepEqual([ecrite.date, ecrite.anomalies.map((a) => [a.genre, a.cle, a.vueDepuis]), ecrite.vivants],
      [plusTard.toISOString(), [['origin-non-rafraichi', 'origin/main', MAINTENANT.toISOString()]], []])
    const c = confronter({ suivi: lireLeSuivi({ dossier, epique: 665 }).suivi, mesure: lireLeSuivi({ dossier, epique: 665 }).mesure, maintenant: plusTard })
    assert.deepEqual(c.anomalies, [], '`origin-non-rafraichi` qualifie la mesure, ce n’est pas une anomalie du suivi')
  } finally { FS.rmSync(dossier, { recursive: true, force: true }) }
})

test('SANS FETCH — une mesure `sansFetch` COHÉRENTE ne rend AUCUNE anomalie : « sans fetch » se dit sur la ligne de mesure, jamais en anomalie', () => {
  const s = exemple()
  const anomalies = [{ genre: 'origin-non-rafraichi', cle: 'origin/main', texte: 'origin non rafraîchi (--sans-fetch)', vueDepuis: new Date(MAINTENANT.getTime() - 48 * 3_600_000).toISOString() }]
  const mesure = mesureLue(s, { anomalies })
  assert.equal(mesure.mesure.sansFetch, true)
  const c = confronter({ suivi: s, mesure, maintenant: MAINTENANT })
  assert.deepEqual([c.alertes, c.anomalies, c.taisees], [[], [], 0])
  const bandeau = lignesDeSituation(luDe(s, mesure), { maintenant: MAINTENANT, age: true })
  assert.deepEqual([bandeau.length, bandeau.at(-1)], [3, '  ouverts : 2 item(s), 1 étape(s) · mesurée il y a 0 min, sans fetch'])
  const digest = digestDuSuivi(luDe(s, mesure), { maintenant: MAINTENANT })
  assert.doesNotMatch(digest, /## Anomalies|⚠/)
  assert.match(digest, /\nmesurée le 2026-10-07 10:00 \(sans fetch\)\n/)
})

test('LIBELLÉ 10 — `Fusionné` se dit « lot publié le <date>, ticket ouvert », `Fermé` « clos », sur la ligne d’item', () => {
  const s = exempleClos()
  const mesure = mesureLue(s, { lignes: [
    ligneOuverte(2400, { statut: 'Fusionné', dernierCommit: '2026-10-06' }), ligneOuverte(2187), ligneOuverte(2497), ligneOuverte(2001, { statut: 'Fermé', etatIssue: 'fermé' }),
  ] })
  assert.deepEqual(confronter({ suivi: s, mesure, maintenant: MAINTENANT }).etiquettes, { 2400: 'lot publié le 2026-10-06, ticket ouvert', 2001: 'clos' })
  const rendu = renduDuSuivi(luDe(s, mesure), { maintenant: MAINTENANT })
  assert.ok(rendu.includes('- #2400 [actif] périmètre de tests — game-21 · lot publié le 2026-10-06, ticket ouvert\n'), rendu)
  assert.ok(rendu.includes('- #2001 [clos] fini · clos\n'), rendu)
})

test('RECONNAÎTRE — un suivi écrit hors de l’outil n’accepte que `reconnaitre` en tête, qui le re-scelle EN LE SIGNALANT ; ailleurs, refusé ; hors schéma, rien ne le reconnaît', () => {
  const dossier = dossierJetable()
  try {
    poserSuivi({ dossier, epique: 665, lots: [BASE], maintenant: MAINTENANT })
    const cible = join(dossier, '665.json')
    const texte = FS.readFileSync(cible, 'utf8')
    assert.match(refusDe(lireSuivi(texte).suivi, [{ geste: 'reconnaitre', motif: 'rien' }]), /`reconnaitre` ne vaut qu'en tête de lot, sur un suivi lu « écrit hors de l'outil »/)
    FS.writeFileSync(cible, texte.replace('juge du diff', 'juge du diff édité'))
    assert.match(lireLeSuivi({ dossier, epique: 665 }).alerte, /`npm run ops:suivi -- 665 --reconnaitre <motif>` le re-scelle en le signalant$/)
    const sansReconnaitre = editer({ numero: 665, dossier, mutations: [{ geste: 'cocher', ticket: 2400, n: 2 }], maintenant: MAINTENANT })
    assert.match(sansReconnaitre.stderr, /mutation 1 \(cocher\) : suivi écrit hors de l'outil : `reconnaitre` \(`--reconnaitre <motif>`\), en tête de lot/)
    const enSecond = editer({ numero: 665, dossier, mutations: [{ geste: 'friction', texte: 'x' }, { geste: 'reconnaitre', motif: 'm' }], maintenant: MAINTENANT })
    assert.equal(enSecond.code, 1)
    const reconnu = editer({ numero: 665, dossier, mutations: [{ geste: 'reconnaitre', motif: 'sed de game-11' }, { geste: 'cocher', ticket: 2400, n: 2 }], maintenant: MAINTENANT })
    assert.equal(reconnu.code, 0, reconnu.stderr)
    const relu = lireSuivi(FS.readFileSync(cible, 'utf8'))
    assert.equal(relu.ok, true)
    assert.equal(relu.suivi.items[0].etapes[1].texte, 'juge du diff édité', 'le contenu reconnu TEL QUEL')
    assert.deepEqual(relu.suivi.aSignaler.map((x) => x.texte), ['écrit hors de l\'outil, reconnu le 2026-10-07 : sed de game-11'])
    FS.writeFileSync(cible, JSON.stringify({ ...JSON.parse(texte), version: 2 }))
    assert.match(editer({ numero: 665, dossier, mutations: [{ geste: 'reconnaitre', motif: 'm' }], maintenant: MAINTENANT }).stderr, /hors schéma : version.*rien n'est écrit/)
    assert.deepEqual(argumentsDuSuivi(['665', '--reconnaitre', 'sed de game-11']).gestes, [{ geste: 'reconnaitre', motif: 'sed de game-11' }])
  } finally { FS.rmSync(dossier, { recursive: true, force: true }) }
})

test('RE-MESURE — un verrou de mesure tenu par un processus VIVANT : sortie 0 « déjà en cours », rien n’est mesuré ni écrit', () => {
  const dossier = dossierJetable()
  try {
    poserSuivi({ dossier, epique: 665, lots: [BASE], maintenant: MAINTENANT })
    FS.writeFileSync(join(dossier, '.665.mesure.verrou'), JSON.stringify({ pid: process.ppid, commande: 'autre mesure', cwd: dossier, date: 'x' }))
    const compte = { fetch: 0, issues: [] }
    const vu = mesurerLeSuivi({ numero: 665, dossier, sansFetch: true, json: true, maintenant: MAINTENANT, mesure: mesureFactice(compte) })
    assert.deepEqual([vu.code, JSON.parse(vu.stdout), compte.issues, FS.existsSync(join(dossier, '665.mesure.json'))], [0, { epique: 665, dejaEnCours: true }, [], false])
    FS.rmSync(join(dossier, '.665.mesure.verrou'))
    assert.equal(mesurerLeSuivi({ numero: 665, dossier, sansFetch: true, maintenant: MAINTENANT, mesure: mesureFactice(compte) }).code, 0)
    assert.deepEqual([compte.issues.length, FS.existsSync(join(dossier, '.665.mesure.verrou'))], [1, false], 'mesurée, verrou rendu')
  } finally { FS.rmSync(dossier, { recursive: true, force: true }) }
})
