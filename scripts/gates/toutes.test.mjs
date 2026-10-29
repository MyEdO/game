// Contrat des LANES du REJEU LOCAL `npm run gates` (#1776) : les lanes sont les jobs de `ci.yml`
// (`lanesDeCi`, #2178), aucune lane n'écrit ce qu'une autre lit, `--serie` joue les mêmes, `--gates a,b`
// n'en joue que les nommées, un enfant qui dépasse son plafond tombe AVEC SON ARBRE, le refus du verrou
// de suite se reconnaît à sa sortie — et la POLITIQUE D'ARRÊT comme le RÉSUMÉ se mesurent pour de
// bon, sur un dépôt jetable à gates factices réparties en jobs (c'est ce que
// `principal({ racine, ecritLu, journal })` rend possible).
//   node --test scripts/gates/toutes.test.mjs
import { tableTotale } from '../../src/lib/tableTotale.ts'
import test from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { existsSync, globSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, isAbsolute, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { instanceDeDepot } from '../guards/lib/depotGabarit.mjs'
import { cheminsIgnores, depotDe } from '../guards/lib/gitPorte.mjs'
import { GATES_DELEGUEES } from '../test/perimetre.mjs'
import {
  COEURS_SUITE_EN_LANES,
  arreterGatesSurSignal,
  lanesPortees,
  ECRIT_LU,
  PLAFOND_LANES,
  TIMEOUTS,
  conflitsEntreLanes,
  fichierDeSortie,
  lanesAJouer,
  lanesDeCi,
  limiteDe,
  photoArbre,
  prerequisAbsents,
  principal,
  queue,
  refusDeCouverture,
} from './toutes.mjs'
import { LANE_LOCALE_DE_JOB, gatesDeCi } from './gatesDeCi.mjs'
import { coeurs, repartitionWorkers } from '../test/partition.mjs'
import { gitDe, lancerGit } from '../test/gitDeBanc.mjs'
import { prendreVerrouAsync } from '../test/verrou.mjs'
import { CODE_DIFFERE } from '../guards/lib/codesDeSortie.mjs'
import { spawnBorne } from '../guards/lib/processusBorne.mjs'
import { STATUS_DLL_INIT_FAILED } from '../guards/lib/spawnResilient.mjs'

const RACINE = fileURLToPath(new URL('../..', import.meta.url))
const GATES = gatesDeCi({ cwd: RACINE })
const NOMS = GATES.map((g) => g.nom)
const LANES = lanesDeCi(GATES)
const gate = (nom) => ({ nom, commande: `npm run ${nom}` })

/**
 * Double de `lancer` : le VRAI `spawnBorne`, dont seul le superviseur est injecté (#2776). L'essai `n` joue la forme
 * `essais[n]` (la dernière se répète) : le superviseur attend `avantControle`, puis `leve` lève sans rendre de
 * contrôle ; sinon un `ControleSupervision` (processusBorne.d.mts) dont la `fin` native rend
 * `{ status, arret: { pid, etat, erreurs } }` une fois le contrôle remis à `surControle`, après `pendant(demande)` ou,
 * `expiree`, à la demande d'arrêt de l'échéance ; `demande` se résout à la première demande d'arrêt. `demandes` reçoit
 * le PID de chaque demande d'arrêt.
 */
const lancement = (options, ...essais) => {
  let essai = 0, remettre
  const superviser = async () => {
    const { pid, etat = 'mort', erreurs = [], status = 0, expiree = false, demandes = [], pendant, leve = false, avantControle } = essais[Math.min(essai++, essais.length - 1)]
    await avantControle?.()
    if (leve) throw Object.assign(new Error('superviseur lève sans contrôle'), { code: 'EAGAIN' })
    let arreter
    const demande = new Promise((resolve) => { arreter = resolve })
    const remis = new Promise((resolve) => { remettre = resolve })
    const fin = (async () => {
      await remis
      await (expiree ? demande : pendant?.(demande))
      return { resultatCible: { status, signal: null }, arret: { pid, etat, erreurs } }
    })()
    return { hote: { stdout: null, stderr: null }, controle: { pid, pret: Promise.resolve({ pidCible: pid }),
      demanderArret() { demandes.push(pid); arreter() }, fin, finPhysique: fin.then(() => {}) } }
  }
  return spawnBorne({ ...options, superviser, limiteMs: essais.some((forme) => forme.expiree) ? 0 : options.limiteMs,
    surControle: () => remettre() })
}

test('arrêt sur signal : le signal des gates est aborté avant toute attente, le verdict de chacune est attendu, un arrêt indéterminé est nommé', async () => {
  for (const etat of ['mort', 'indetermine']) {
    const lignes = [], arret = new AbortController()
    let terminer, rendu = false
    const enCours = new Promise((ok) => { terminer = ok })
    const verdicts = new Map([['a', { arret: { pid: 123, etat: 'mort', erreurs: [] } }]])
    const attente = arreterGatesSurSignal({ signal: 'SIGINT', journal: (texte) => lignes.push(texte), verdicts, gatesEnCours: new Set([enCours]), arret })
      .then((code) => { rendu = true; return code })
    assert.equal(arret.signal.aborted, true)
    await new Promise((ok) => setImmediate(ok))
    assert.equal(rendu, false, 'le gestionnaire rend avant le verdict de la gate en cours')
    verdicts.set('b', { arret: { pid: 456, etat, erreurs: [] } })
    terminer()
    assert.equal(await attente, 130)
    const sortie = lignes.join('')
    if (etat === 'mort') assert.doesNotMatch(sortie, /arrêt indéterminé/, sortie)
    else assert.match(sortie, /\[gates\] arrêt indéterminé : b PID 456 — verrou retenu\.\n/, sortie)
  }
})


test('capacité de gate : arrêt indéterminé, expiré ou non, retient PID et verrou, fin confirmée libère une fois par charge', async (t) => {
  const { racine } = depotDeGates([
    { nom: 'premiere', fichier: 'scripts/test/run.mjs', corps: '' },
    { nom: 'suivante', job: 'b', fichier: 'scripts/test/run.mjs', corps: '' },
  ])
  const dossierVerrou = mkdtempSync(join(tmpdir(), 'gates-capacite-'))
  t.after(() => { rmSync(racine, { recursive: true, force: true }); rmSync(dossierVerrou, { recursive: true, force: true }) })
  for (const mode of ['serie', 'lanes']) for (const forme of [{ etat: 'mort' }, { etat: 'indetermine' }, { etat: 'indetermine', expiree: true }]) {
    const indetermine = forme.etat === 'indetermine'
    const lignes = []
    const chemin = join(dossierVerrou, 'suite.lock')
    const observations = { lancements: 0, prises: 0, tracesPrises: [], liberations: 0 }
    let code
    const diagnostic = () => JSON.stringify({ mode, forme, code: code ?? null, ...observations, verrouPresent: existsSync(chemin) }) + '\n' + lignes.join('')
    try {
      code = await principal({ racine, machine: MACHINE_A_LANES, argv: ['node', 'toutes.mjs', ...(mode === 'lanes' ? [] : ['--serie'])], journal: (texte) => lignes.push(texte),
        ecritLu: tableTotale(['premiere', 'suivante'], () => ({ ecrit: [], lit: ['src/'] })),
        verrou: { chemin, libelle: 'suite du banc', attente: { pasMs: 1, echeanceMs: 10 } },
        prendre: async (options) => {
          observations.prises++
          let temps = 0
          const trace = { annonces: [], horloges: 0, sommeils: [] }
          observations.tracesPrises.push(trace)
          const resultat = await prendreVerrouAsync({ ...options,
            horloge: () => { trace.horloges++; return temps },
            dormir: async (ms) => { trace.sommeils.push(ms); await new Promise(resolve => setImmediate(resolve)); temps += ms },
            attente: options.attente && { ...options.attente,
              annoncer: (tenant) => { trace.annonces.push({ tenant }); options.attente.annoncer?.(tenant) },
            } })
          return resultat.liberer ? { ...resultat, liberer: (...args) => {
            observations.liberations++
            return resultat.liberer(...args)
          } } : resultat
        },
        lancer: (options) => {
          observations.lancements++
          return lancement(options, { pid: 123, ...forme })
        },
      })
      assert.equal(code, indetermine ? 1 : 0, diagnostic())
      assert.equal(observations.lancements, indetermine ? 1 : 2, diagnostic())
      assert.equal(observations.prises, indetermine && mode === 'serie' ? 1 : 2, diagnostic())
      for (const trace of observations.tracesPrises) assert.ok(trace.horloges >= 2, diagnostic())
      // En lanes, la seconde prise attend le verrou de la première au pas de 1 ms, autant de pas que dure la première.
      const [premiere, suivante] = observations.tracesPrises
      assert.deepEqual(premiere.sommeils, [], diagnostic())
      if (mode === 'lanes') {
        assert.ok(suivante.sommeils.length >= 1 && suivante.sommeils.every((ms) => ms === 1), diagnostic())
        assert.equal(suivante.annonces[0].tenant.pid, process.pid, diagnostic())
      } else assert.deepEqual(suivante?.sommeils ?? [], [], diagnostic())
      assert.equal(observations.liberations, indetermine ? 0 : 2, diagnostic())
      assert.equal(existsSync(chemin), indetermine, diagnostic())
      if (indetermine) {
        assert.match(lignes.join(''), new RegExp(`premiere — ${forme.expiree ? 'EXPIRÉE' : 'ROUGE'} \\(exit 1\\)`), diagnostic())
        assert.match(lignes.join(''), /suivante — REFUS CAPACITE_ARRET_INDETERMINE : premiere PID 123/, diagnostic())
        assert.equal((lignes.join('').match(/attente du geste lourd :/g) ?? []).length, mode === 'lanes' ? suivante.annonces.length : 0, diagnostic())
      }
    } finally {
      rmSync(chemin, { force: true })
    }
  }
})

test('arrêt global : une attente étrangère se réveille sans échéance et une gate active garde le signal appelant', async (t) => {
  const { racine } = depotDeGates([
    { nom: 'premiere', job: 'a', fichier: 'scripts/test/run.mjs', corps: '' },
    { nom: 'suivante', job: 'a', fichier: 'scripts/test/run.mjs', corps: '' },
    { nom: 'etrangere', job: 'b', fichier: 'scripts/test/run.mjs', corps: '' },
  ])
  t.after(() => rmSync(racine, { recursive: true, force: true }))
  for (const mode of ['attente', 'active', 'course', 'erreur']) {
    const lignes = [], appelant = new AbortController()
    const cause = new Error('cause acquisition')
    const erreur = new Error('acquisition échouée', { cause })
    let engager, terminerPrise
    const engagement = new Promise(resolve => { engager = resolve })
    const cloture = new Promise(resolve => { terminerPrise = resolve })
    const observations = { lancements: [], prises: [], liberations: [], signaux: [], erreur }
    const liberer = nom => ({ etat: 'pris', liberer() { observations.liberations.push(nom) } })
    const execution = principal({ racine, machine: MACHINE_A_LANES,
      argv: ['node', 'toutes.mjs'], signal: appelant.signal,
      lancer: options => {
        const nom = options.site.slice(5)
        observations.lancements.push(nom)
        observations.signaux.push(options.signal)
        return nom === 'premiere'
          ? lancement(options, { pid: 123, etat: 'indetermine', erreurs: [{ operation: 'preuve', pid: 123, code: 'EIO', message: 'cause arrêt', cause }], pendant: () => engagement })
          : lancement(options, { pid: 456, pendant: () => { engager(); return cloture } })
      },
      journal: texte => {
        lignes.push(texte)
        if (texte.includes('premiere — ROUGE')) terminerPrise()
      },
      ecritLu: tableTotale(['premiere', 'suivante', 'etrangere'], () => ({ ecrit: [], lit: ['src/'] })),
      verrou: { chemin: join(racine, 'global.lock'), libelle: 'global' },
      prendre: async options => {
        const nom = options.commande.slice(6)
        observations.prises.push(nom)
        if (nom !== 'etrangere' || mode === 'active') return liberer(nom)
        engager()
        if (mode === 'course') { await cloture; return liberer(nom) }
        await new Promise(resolve => {
          options.signal.addEventListener('abort', resolve, { once: true })
          if (options.signal.aborted) resolve()
        })
        if (mode === 'erreur') throw erreur
        return { etat: 'refus', message: 'annulée' }
      },
    })
    assert.equal(await execution, 1, lignes.join(''))
    assert.deepEqual(observations.prises, ['premiere', 'etrangere'])
    assert.deepEqual(observations.lancements, mode === 'active' ? ['premiere', 'etrangere'] : ['premiere'])
    assert.deepEqual(observations.liberations, mode === 'active' || mode === 'course' ? ['etrangere'] : [])
    assert.ok(observations.signaux.every(signal => !signal.aborted))
    appelant.abort()
    assert.ok(observations.signaux.every(signal => signal.aborted), 'le signal d’une gate suit le signal appelant')
    assert.match(lignes.join(''), /suivante — REFUS CAPACITE_ARRET_INDETERMINE : premiere PID 123/)
    if (mode === 'erreur') assert.match(lignes.join(''), /erreur : Error — acquisition échouée[\s\S]*etrangere — ROUGE \(exit 1\)/)
    else if (mode !== 'active') assert.match(lignes.join(''), /etrangere — REFUS CAPACITE_ARRET_INDETERMINE : premiere PID 123/)
    assert.match(lignes.join(''), /preuve PID 123 EIO — cause arrêt/)
    assert.match(lignes.join(''), /cause acquisition/)
    assert.match(lignes.join(''), /premiere — ROUGE \(exit 1\)/)
    assert.match(lignes.join(''), /——— résumé ———/)
  }
})

test('un refus de prise est un rouge différé sans enfant ni annulation ; une gate sans geste lourd ne prend rien', async (t) => {
  const { racine } = depotDeGates([{ nom: 'refusee', fichier: 'scripts/test/run.mjs', corps: '' }, { nom: 'legere', corps: '' }, { nom: 'suivante', fichier: 'scripts/test/run.mjs', corps: '' }])
  t.after(() => rmSync(racine, { recursive: true, force: true }))
  const prises = [], rendues = [], lignes = [], lancements = []
  const code = await principal({ racine, argv: ['node', 'toutes.mjs', '--serie'],
    journal: texte => lignes.push(texte),
    lancer: o => {
      lancements.push(o.site)
      return lancement(o, { pid: 123 })
    },
    ecritLu: tableTotale(['refusee', 'legere', 'suivante'], () => ({ ecrit: [], lit: ['src/'] })),
    prendre: async options => {
      assert.equal(options.signal.aborted, false)
      const nom = options.commande.slice(6)
      prises.push(nom)
      return nom === 'refusee' ? { etat: 'refus', message: 'refus du banc' } : { etat: 'pris', liberer() { rendues.push(nom) } }
    },
  })
  assert.equal(code, 1)
  assert.deepEqual(prises, ['refusee', 'suivante'])
  assert.deepEqual(rendues, ['suivante'])
  assert.deepEqual(lancements, ['gate legere', 'gate suivante'])
  assert.match(lignes.join(''), new RegExp(`\\[gates\\] refusee — ROUGE \\(exit ${CODE_DIFFERE}\\)`))
  assert.doesNotMatch(lignes.join(''), /arrêt indéterminé|CAPACITE_ARRET_INDETERMINE/)
})

/** Échéance de `sortir` dans `jouerSousSignal` : un gestionnaire muet rougit au lieu de pendre (#2776). */
const ECHEANCE_SORTIE_MS = 10_000

/** Joue `principal` en série ; `lancer` et `journal` reçoivent `declencher`, qui appelle SON gestionnaire de SIGINT. */
async function jouerSousSignal(racine, { argv, lancer, journal }) {
  const avant = new Set(process.listeners('SIGINT'))
  let signaleA = null, apresSignalMs = null
  const declencher = () => { signaleA ??= Date.now(); for (const ecouteur of process.listeners('SIGINT')) if (!avant.has(ecouteur)) ecouteur('SIGINT') }
  let sortir, minuterie
  const sortie = Promise.race([
    new Promise((resolve) => { sortir = (code) => { apresSignalMs = Date.now() - signaleA; resolve(code) } }),
    new Promise((_, rejeter) => { minuterie = setTimeout(() => rejeter(new Error(`jouerSousSignal attendait sortir(code) du gestionnaire de SIGINT : rien en ${ECHEANCE_SORTIE_MS} ms`)), ECHEANCE_SORTIE_MS) }),
  ]).finally(() => clearTimeout(minuterie))
  const liberations = [], lignes = []
  const [code, codeDeSortie] = await Promise.all([principal({ racine, machine: MACHINE_A_LANES, argv, sortir,
    journal: (texte) => { lignes.push(texte); journal?.(texte, declencher) },
    ecritLu: tableTotale(['premiere', 'suivante'], () => ({ ecrit: [], lit: ['src/'] })),
    prendre: async (options) => {
      const nom = options.commande.slice(6)
      return { etat: 'pris', liberer() { liberations.push(nom) } }
    },
    lancer: (options) => lancer(options, declencher, () => signaleA !== null),
  }), sortie])
  return { code, sortie: codeDeSortie, apresSignalMs, liberations, lignes }
}

test('#1772 — le gestionnaire de signal ne vise plus une gate à l’arrêt confirmé ni ne rend deux fois son verrou', async (t) => {
  const { racine } = depotDeGates([{ nom: 'premiere', fichier: 'scripts/test/run.mjs', corps: '' }, { nom: 'suivante', fichier: 'scripts/test/run.mjs', corps: '' }])
  t.after(() => rmSync(racine, { recursive: true, force: true }))
  const demandes = []
  const r = await jouerSousSignal(racine, { argv: ['node', 'toutes.mjs', '--serie'], lancer: (options, declencher) => options.site === 'gate premiere'
    ? lancement(options, { pid: 123, demandes })
    : lancement(options, { pid: 456, demandes, pendant: declencher }) })
  const diagnostic = JSON.stringify({ demandes, liberations: r.liberations }) + '\n' + r.lignes.join('')
  assert.equal(r.sortie, 130, diagnostic)
  assert.deepEqual([...new Set(demandes)], [456], diagnostic)
  assert.deepEqual(r.liberations, ['premiere', 'suivante'], diagnostic)
})

test('#1772 #2776 — le gestionnaire de signal juge l’arrêt de l’essai RENDU : indéterminé, rejeu compris, en vol ou terminé, il retient le verrou sous un seul diagnostic', async (t) => {
  const { racine } = depotDeGates([{ nom: 'premiere', fichier: 'scripts/test/run.mjs', corps: '' }, { nom: 'suivante', fichier: 'scripts/test/run.mjs', corps: '' }])
  t.after(() => rmSync(racine, { recursive: true, force: true }))
  const CAS = {
    'rejeu : essai 0 au chargement raté, essai rendu dont le superviseur lève': { essais: (demandes) => [{ pid: 10, status: STATUS_DLL_INIT_FAILED, demandes }, { leve: true, demandes }], pid: undefined, demandes: [] },
    'superviseur qui lève dès le premier essai': { essais: (demandes) => [{ leve: true, demandes }], pid: undefined, demandes: [] },
    'fin native indéterminée': { essais: (demandes) => [{ pid: 123, etat: 'indetermine', demandes }], pid: 123, demandes: [] },
    'fin native indéterminée, signal en vol': { essais: (demandes, declencher) => [{ pid: 123, etat: 'indetermine', demandes, pendant: declencher }], pid: 123, demandes: [123], enVol: true },
  }
  for (const [nom, cas] of Object.entries(CAS)) {
    const demandes = []
    const r = await jouerSousSignal(racine, { argv: ['node', 'toutes.mjs', '--serie'],
      journal: (texte, declencher) => { if (!cas.enVol && texte.includes('suivante — REFUS CAPACITE_ARRET_INDETERMINE')) declencher() },
      lancer: (options, declencher) => lancement(options, ...cas.essais(demandes, declencher)),
    })
    const sortie = r.lignes.join('')
    const diagnostic = nom + '\n' + JSON.stringify({ demandes, liberations: r.liberations }) + '\n' + sortie
    assert.equal(r.code, 1, diagnostic)
    assert.equal(r.sortie, 130, diagnostic)
    const retenue = cas.pid === undefined ? 'premiere' : `premiere PID ${cas.pid}`
    assert.match(sortie, new RegExp(`suivante — REFUS CAPACITE_ARRET_INDETERMINE : ${retenue} ;`), diagnostic)
    assert.deepEqual(demandes, cas.demandes, diagnostic)
    assert.deepEqual(r.liberations, [], diagnostic)
    assert.match(sortie, new RegExp(`\\[gates\\] arrêt indéterminé : ${retenue} — verrou retenu\\.`), diagnostic)
    assert.equal(sortie.match(/diagnostic arrêt :/g)?.length, 1, diagnostic)
  }
})

/** Durée d'une gate des bancs de fenêtre : sans demande d'arrêt, la gate court jusqu'au bout (#2776). */
const DUREE_GATE_MS = 8000

/** `pendant` d'une gate qui court `DUREE_GATE_MS`, ou s'arrête à la demande. */
const jusquALArret = (demande) => new Promise((resolve) => {
  const minuterie = setTimeout(resolve, DUREE_GATE_MS)
  demande.then(() => { clearTimeout(minuterie); resolve() })
})

test('#2776 — une gate en vol au SIGINT reçoit la demande d’arrêt en toute phase : superviseur pas encore rendu, backoff de rejeu', async (t) => {
  const { racine } = depotDeGates([{ nom: 'premiere', fichier: 'scripts/test/run.mjs', corps: '' }, { nom: 'suivante', fichier: 'scripts/test/run.mjs', corps: '' }])
  t.after(() => rmSync(racine, { recursive: true, force: true }))
  const FENETRES = {
    'superviseur pas encore rendu, arrêt prouvé': { etat: 'mort', essais: (lance, declencher) => [{ pid: 10, avantControle: async () => { lance(); declencher(); await new Promise((ok) => setTimeout(ok, 50)) }, pendant: jusquALArret }] },
    'superviseur pas encore rendu, arrêt indéterminé': { etat: 'indetermine', essais: (lance, declencher) => [{ pid: 10, etat: 'indetermine', avantControle: async () => { lance(); declencher(); await new Promise((ok) => setTimeout(ok, 50)) }, pendant: jusquALArret }] },
    'backoff de rejeu': { etat: 'mort', essais: (lance, declencher) => [
      { pid: 10, status: STATUS_DLL_INIT_FAILED, avantControle: lance, pendant: () => { setTimeout(declencher, 300) } },
      { pid: 11, avantControle: lance, pendant: jusquALArret },
    ] },
  }
  for (const [nom, fenetre] of Object.entries(FENETRES)) await t.test(nom, async () => {
    const lancements = []
    const r = await jouerSousSignal(racine, { argv: ['node', 'toutes.mjs', '--serie'],
      lancer: (options, declencher, signale) => lancement(options, ...fenetre.essais(() => lancements.push(signale() ? 'après signal' : 'avant signal'), declencher)),
    })
    const sortie = r.lignes.join('')
    const diagnostic = nom + '\n' + JSON.stringify({ lancements, apresSignalMs: r.apresSignalMs, liberations: r.liberations }) + '\n' + sortie
    assert.equal(r.sortie, 130, diagnostic)
    assert.ok(r.apresSignalMs < DUREE_GATE_MS / 2, diagnostic)
    assert.deepEqual(lancements, ['avant signal'], diagnostic)
    if (fenetre.etat === 'mort') {
      assert.deepEqual(r.liberations, ['premiere'], diagnostic)
      assert.doesNotMatch(sortie, /arrêt indéterminé/, diagnostic)
    } else {
      assert.deepEqual(r.liberations, [], diagnostic)
      assert.match(sortie, /\[gates\] arrêt indéterminé : premiere PID 10 — verrou retenu\./, diagnostic)
    }
  })
})

test('#2776 — un lanceur ou une prise qui lève pose le verdict de sa gate : nommée, et un lanceur levé retient son verrou', async (t) => {
  const { racine } = depotDeGates([{ nom: 'premiere', fichier: 'scripts/test/run.mjs', corps: '' }, { nom: 'suivante', fichier: 'scripts/test/run.mjs', corps: '' }])
  t.after(() => rmSync(racine, { recursive: true, force: true }))
  for (const leve of ['lancer', 'prendre']) {
    const lignes = [], liberations = [], lancements = []
    const erreur = Object.assign(new Error(`${leve} cassé`), { code: 'EMFILE' })
    const code = await principal({ racine, machine: MACHINE_A_LANES, argv: ['node', 'toutes.mjs', '--serie'], journal: (texte) => lignes.push(texte),
      ecritLu: tableTotale(['premiere', 'suivante'], () => ({ ecrit: [], lit: ['src/'] })),
      prendre: async (options) => {
        const nom = options.commande.slice(6)
        if (leve === 'prendre' && nom === 'premiere') throw erreur
        return { etat: 'pris', liberer() { liberations.push(nom) } }
      },
      lancer: async (options) => {
        lancements.push(options.site)
        if (leve === 'lancer' && options.site === 'gate premiere') throw erreur
        return lancement(options, { pid: 456 })
      },
    })
    const sortie = lignes.join('')
    const diagnostic = leve + '\n' + JSON.stringify({ liberations, lancements }) + '\n' + sortie
    assert.equal(code, 1, diagnostic)
    assert.match(sortie, new RegExp(`erreur : EMFILE — ${leve} cassé[\\s\\S]*premiere — ROUGE \\(exit 1\\)`), diagnostic)
    if (leve === 'lancer') {
      assert.deepEqual(liberations, [], diagnostic)
      assert.deepEqual(lancements, ['gate premiere'], diagnostic)
      assert.match(sortie, /arrêt indéterminé : lancement EMFILE — lanceur levé : arrêt non prouvé/, diagnostic)
      assert.match(sortie, /suivante — REFUS CAPACITE_ARRET_INDETERMINE : premiere ; capacité retenue/, diagnostic)
      assert.doesNotMatch(sortie, /undefined/, diagnostic)
    } else {
      assert.deepEqual(liberations, ['suivante'], diagnostic)
      assert.deepEqual(lancements, ['gate suivante'], diagnostic)
      assert.match(sortie, /suivante — vert/, diagnostic)
    }
  }
})

test('#2776 — le résumé compte les rejeux du RUN : un run sans rejeu en compte 0 après un run qui en compte 1', async (t) => {
  const { racine } = depotDeGates([{ nom: 'premiere', corps: '' }])
  t.after(() => rmSync(racine, { recursive: true, force: true }))
  const jouer = async (...essais) => {
    const lignes = []
    const code = await principal({ racine, machine: MACHINE_A_LANES, argv: ['node', 'toutes.mjs'], journal: (texte) => lignes.push(texte),
      ecritLu: { premiere: { ecrit: [], lit: ['src/'] } }, lancer: (options) => lancement(options, ...essais) })
    const sortie = lignes.join('')
    assert.equal(code, 0, sortie)
    return sortie
  }
  const avecRejeu = await jouer({ pid: 10, status: STATUS_DLL_INIT_FAILED }, { pid: 11 })
  assert.match(avecRejeu, /\[gates\] 1 spawn\(s\) rejoué\(s\)/, avecRejeu)
  const sansRejeu = await jouer({ pid: 12 })
  assert.match(sansRejeu, /\[gates\] 0 spawn rejoué/, sansRejeu)
})

test('un résultat ordinaire conserve tous les diagnostics d’arrêt, même expiré', async () => {
  for (const expiree of [false, true]) {
    const { racine } = depotDeGates([{ nom: 'interrompue', corps: '' }])
    const lignes = []
    try {
      const code = await principal({ racine, argv: ['node', 'toutes.mjs'], machine: MACHINE_A_LANES,
        journal: (texte) => lignes.push(texte), ecritLu: { interrompue: { ecrit: [], lit: ['src/'] } },
        lancer: (options) => lancement(options, { pid: 123, etat: 'indetermine', expiree, erreurs: [
          { operation: 'taskkill', pid: 123, code: 'EPERM', message: 'refus physique', cause: { code: 'EIO', message: 'inspection impossible' } },
          { operation: 'inspection', pid: 456, code: 'EACCES', message: 'arbre illisible' },
        ] }) })
      const sortie = lignes.join('')
      assert.equal(code, 1)
      assert.match(sortie, /ARRET_INDETERMINE — zéro natif non confirmé/)
      assert.match(sortie, /cause : EIO — inspection impossible/)
      assert.match(sortie, /taskkill PID 123 EPERM — refus physique/)
      assert.match(sortie, /inspection PID 456 EACCES — arbre illisible/)
      assert.match(sortie, new RegExp(`interrompue — ${expiree ? 'EXPIRÉE' : 'ROUGE'}`))
    } finally {
      rmSync(racine, { recursive: true, force: true })
    }
  }
})

/** Un `ci.yml` de fixture, un job par entrée `[job, [gates]]` — écrit sous os.tmpdir(). */
function ciDeJobs(jobs) {
  const fichier = join(mkdtempSync(join(tmpdir(), 'gates-ci-')), 'ci.yml')
  writeFileSync(
    fichier,
    ['jobs:', ...jobs.flatMap(([job, noms]) => [`  ${job}:`, '    steps:', ...noms.map((n) => `      - run: npm run ${n}`)]), ''].join('\n'),
  )
  return fichier
}

test('les lanes SONT les jobs de ci.yml : chaque gate dans la lane de son job (ou celle que LANE_LOCALE_DE_JOB lui donne), une seule fois', () => {
  assert.deepEqual(refusDeCouverture(NOMS), [], 'ECRIT_LU ne couvre pas ci.yml')
  assert.deepEqual(LANES.flatMap((l) => l.gates).sort(), [...NOMS].sort())
  for (const lane of LANES)
    for (const nom of lane.gates) {
      const { job } = GATES.find((g) => g.nom === nom)
      assert.equal(LANE_LOCALE_DE_JOB[job]?.lane ?? job, lane.nom, `${nom} hors de la lane de son job ${job}`)
    }
  assert.deepEqual(LANES.map((l) => l.nom), ['docs', 'types', 'suite'])
  for (const [job, { raison }] of Object.entries(LANE_LOCALE_DE_JOB)) {
    assert.ok(GATES.some((g) => g.job === job), `LANE_LOCALE_DE_JOB nomme ${job}, qu’aucun job de gates de ci.yml ne porte`)
    assert.ok(raison.length > 40, `${job} : raison absente ou creuse`)
  }
})

test('LANE_LOCALE_DE_JOB rattache un job à la lane d’un AUTRE ; vers une lane qu’aucun job ne porte, REFUS nommé', () => {
  const gates = gatesDeCi({ fichier: ciDeJobs([['a', ['x']], ['a-bis', ['y']], ['b', ['z']]]) })
  const table = { 'a-bis': { lane: 'a', raison: 'r' } }
  assert.deepEqual(lanesDeCi(gates, table), [{ nom: 'a', gates: ['x', 'y'] }, { nom: 'b', gates: ['z'] }])
  assert.throws(() => lanesDeCi(gates, { 'a-bis': { lane: 'c', raison: 'r' } }), /le job a-bis rejoint la lane c .* qu’aucun job de gates de ci\.yml ne porte/)
  assert.throws(() => lanesDeCi(gates, { 'a-bis': { lane: 'a-bis', raison: 'r' } }), /le job a-bis rejoint la lane a-bis/)
})

test('une gate jouée par DEUX jobs fait LEVER `gatesDeCi` — elle serait jouée deux fois', () => {
  const fichier = ciDeJobs([['a', ['x', 'y']], ['b', ['x']]])
  assert.throws(() => gatesDeCi({ fichier }), /gate x jouée par deux jobs de ci\.yml \(a ET b\)/)
})

test(`au-delà de ${PLAFOND_LANES} jobs de gates, \`lanesDeCi\` REFUSE en nommant les jobs`, () => {
  const jobs = Array.from({ length: PLAFOND_LANES + 1 }, (_, i) => [`j${i}`, [`g${i}`]])
  const gates = gatesDeCi({ fichier: ciDeJobs(jobs) })
  assert.throws(() => lanesDeCi(gates), new RegExp(`${PLAFOND_LANES + 1} jobs de gates \\(j0, j1, j2, j3\\)`))
  assert.deepEqual(lanesDeCi(gates.slice(0, PLAFOND_LANES)).map((l) => l.nom), ['j0', 'j1', 'j2'])
})

test('la couverture est un DÉTECTEUR : une gate sans ÉCRIT/LU, ou sans « lit », est nommée', () => {
  assert.match(refusDeCouverture(['vigie'], {}).join('\n'), /vigie : aucune entrée ÉCRIT\/LU/)
  // `lit` VIDE est un refus à part : c'est `lit` qui décide si la gate est sautable sur un push
  // documentaire (`gatesSautables`, scripts/gates/classerPush.mjs).
  assert.match(
    refusDeCouverture(['muette'], { muette: { ecrit: [], lit: [] } }).join('\n'),
    /muette : entrée ÉCRIT\/LU sans « lit »/,
  )
})

test('aucune gate de ci.yml n’écrit dans l’arbre — aucune lane n’écrit ce qu’une AUTRE lit', () => {
  assert.deepEqual(conflitsEntreLanes(LANES), [])
  for (const lane of LANES)
    for (const g of lane.gates)
      assert.deepEqual(ECRIT_LU[g].ecrit, [], `${g} écrit à chaque run : un dérivé se VÉRIFIE (\`--check\`), il ne se réécrit pas en gate`)
})

test('le détecteur de course VOIT : un écrivain mis en lane ouvre le conflit', () => {
  // MORSURE : un écrivain fictif de docs/raw/coverage.md dans la lane docs, alors que la suite LIT
  // docs/ — le conflit doit être nommé, sinon la table ne protège plus rien.
  const lanes = LANES.map((l) => (l.nom === 'docs' ? { ...l, gates: [...l.gates, 'ecrivain'] } : l))
  const ecritLu = { ...ECRIT_LU, ecrivain: { ecrit: ['docs/raw/coverage.md'], lit: ['docs/'] } }
  assert.match(
    conflitsEntreLanes(lanes, ecritLu).join('\n'),
    /lane docs : ecrivain ÉCRIT docs\/raw\/coverage\.md · lane suite : test LIT docs\//,
  )
})

test('chaque gate porte une RAISON, et chaque écriture fermée porte SA porte', () => {
  for (const nom of NOMS) {
    const e = ECRIT_LU[nom]
    assert.ok(e.raison?.length > 20, `${nom} : raison absente ou creuse`)
    for (const [chemin, porte] of Object.entries(e.ecritFerme ?? {}))
      assert.ok(porte?.length > 40, `${nom} : « ${chemin} » est fermé sans dire par quoi`)
  }
})

const estVivant = (chemin) => {
  if (chemin.includes('*')) return globSync(chemin, { cwd: RACINE }).length > 0
  return existsSync(join(RACINE, chemin)) && (!chemin.endsWith('/') || statSync(join(RACINE, chemin)).isDirectory())
}

test('chaque chemin `lit`/`ecrit` de la table est VIVANT ; une clé `ecritFerme` l’est, ou git l’ignore', () => {
  const entrees = Object.entries(ECRIT_LU)
  const stricts = entrees.flatMap(([nom, e]) => [...e.lit, ...e.ecrit].filter((c) => !estVivant(c)).map((c) => `${nom} : ${c}`))
  const fermes = entrees.flatMap(([nom, e]) => Object.keys(e.ecritFerme ?? {}).filter((c) => !estVivant(c)).map((chemin) => ({ nom, chemin })))
  const ignores = cheminsIgnores(depotDe(RACINE), fermes.map(({ chemin }) => chemin), { suivisCompris: true })
  assert.deepEqual([...stricts, ...fermes.filter(({ chemin }) => !ignores.has(chemin)).map(({ nom, chemin }) => `${nom} : ${chemin}`)], [])
})

test('chaque gate que `test:perimetre` délègue à la CI est une gate de ci.yml, désignée par des chemins qu’elle LIT (#3145)', () => {
  const ecarts = Object.entries(GATES_DELEGUEES).flatMap(([nom, { prefixes }]) => [
    ...(NOMS.includes(nom) ? [] : [`${nom} : aucune gate de ci.yml de ce nom`]),
    ...prefixes.filter((p) => !(ECRIT_LU[nom]?.lit ?? []).some((lu) => p.startsWith(lu))).map((p) => `${nom} : ${p} hors de son lit`),
  ])
  assert.deepEqual(ecarts, [])
})

test('--serie joue EXACTEMENT les mêmes gates que les lanes, dans l’ordre de ci.yml', () => {
  const aJouer = NOMS.map(gate)
  assert.deepEqual(lanesAJouer(aJouer, { serie: true, lanes: LANES })[0].gates, NOMS)
  const sous = ['test', 'lint', 'docs:build'].map(gate)
  assert.deepEqual(lanesAJouer(sous, { serie: true, lanes: LANES })[0].gates, ['test', 'lint', 'docs:build'])
  assert.deepEqual(new Set(lanesAJouer(sous, { lanes: LANES }).flatMap((l) => l.gates)), new Set(['test', 'lint', 'docs:build']))
  assert.deepEqual(lanesAJouer(sous, { lanes: LANES }).map((l) => l.nom), ['docs', 'types', 'suite'], 'une lane vide ne se lance pas')
})

test('un plafond par gate, jamais un défaut muet', () => {
  assert.equal(limiteDe('gate-inconnue'), TIMEOUTS.defaut * 1000)
  assert.equal(limiteDe('test'), TIMEOUTS.test * 1000)
  assert.ok(TIMEOUTS.test > TIMEOUTS.defaut)
  assert.ok(limiteDe('docs:build') >= 759 * 1000, 'docs:build vaut 252,7 s au pire observé — ×3 = 759 s au moins')
})

test('la SUITE est bornée pendant les lanes, par la couture qui existe déjà', () => {
  assert.ok(COEURS_SUITE_EN_LANES > 0 && COEURS_SUITE_EN_LANES < 16)
  assert.equal(coeurs({ WFRP_TEST_COEURS: String(COEURS_SUITE_EN_LANES) }, () => 16), COEURS_SUITE_EN_LANES)
  const borne = repartitionWorkers(COEURS_SUITE_EN_LANES)
  const plein = repartitionWorkers(16)
  assert.ok(borne.node + borne.jsdom < plein.node + plein.jsdom, 'la borne ne borne rien')
})

test('les LANES ne tournent que sur une machine AU-DELÀ de la borne de la suite', () => {
  assert.equal(lanesPortees(16), true)
  assert.equal(lanesPortees(COEURS_SUITE_EN_LANES + 1), true)
  for (const machine of [1, 4, COEURS_SUITE_EN_LANES]) assert.equal(lanesPortees(machine), false, `machine de ${machine} cœurs`)
})

test('une sortie de gate porte un nom de fichier LÉGAL sous NTFS', () => {
  assert.equal(fichierDeSortie('docs:check', 123), 'docs%3Acheck-123.txt')
  for (const nom of NOMS) assert.ok(!fichierDeSortie(nom, 1).includes(':'), `${nom} : « : » est un flux ADS sous NTFS`)
})

test('la queue d’un rouge rend les DERNIÈRES lignes utiles', () => {
  assert.deepEqual(queue('a\n\nb\n\n\nc\n', 2), ['b', 'c'])
  assert.deepEqual(queue('seule\n', 40), ['seule'])
})

test('une photo de l’arbre IMPOSSIBLE ne LÈVE pas : elle se rend', () => {
  const base = mkdtempSync(join(tmpdir(), 'sans-git-'))
  try {
    const photo = photoArbre(base)
    assert.equal(photo.texte, null)
    assert.ok(photo.erreur, 'une photo impossible doit porter sa cause')
  } finally {
    rmSync(base, { recursive: true, force: true })
  }
})

/**
 * Dépôt jetable : un `ci.yml` de gates FACTICES réparties en jobs (`job` de chaque gate, `a` par
 * défaut ; un job = une lane, `lanesDeCi`), un `package.json` qui les porte, un commit.
 * `principal` y est joué pour de vrai — c'est la seule façon de mesurer la politique d'arrêt et le
 * résumé sans payer les vraies gates.
 */
function depotDeGates(gatesFactices) {
  // Le gabarit est VIDE (donc partagé par tous les cas : les gates factices diffèrent à chaque
  // appel) ; les fichiers du cas entrent dans le MÊME et unique commit `jetable`.
  const { racine } = instanceDeDepot({ commit: false })
  const git = gitDe(racine)
  mkdirSync(join(racine, '.github', 'workflows'), { recursive: true })
  const jobs = Map.groupBy(gatesFactices, (g) => g.job ?? 'a')
  writeFileSync(
    join(racine, '.github', 'workflows', 'ci.yml'),
    [
      'name: CI',
      'jobs:',
      ...[...jobs].flatMap(([job, gates]) => [`  ${job}:`, '    steps:', ...gates.map((g) => `      - run: npm run ${g.nom}`)]),
      '',
    ].join('\n'),
  )
  // Le lanceur écrit ses sorties et ses durées sous `node_modules/.cache/gates/` (`dossierSorties` de toutes.mjs) :
  // sans cet ignore, tout run réel finirait sur « l'arbre a CHANGÉ », et le code du lanceur ne
  // discriminerait plus rien.
  writeFileSync(join(racine, '.gitignore'), 'node_modules/\n')
  const scripts = { gen: 'node gen.mjs' }
  writeFileSync(join(racine, 'gen.mjs'), '\n')
  for (const g of gatesFactices) {
    // `:` sépare un flux de données alternatif sous NTFS : `docs:check.mjs` y est un nom illégal.
    const fichier = g.fichier ?? `${g.nom.replace(/:/g, '-')}.mjs`
    scripts[g.nom] = `node ${fichier}`
    mkdirSync(dirname(join(racine, fichier)), { recursive: true })
    writeFileSync(join(racine, fichier), g.corps)
  }
  writeFileSync(join(racine, 'package.json'), `${JSON.stringify({ name: 'jetable', version: '0.0.0', scripts }, null, 2)}\n`)
  git('add', '-A')
  git('commit', '-qm', 'jetable')
  return { racine, git }
}

/** Machine qui porte les lanes : les cas ci-dessous décrivent les LANES, quel que soit l'hôte du test. */
const MACHINE_A_LANES = COEURS_SUITE_EN_LANES + 1

const LENTE = "setTimeout(() => { console.log('fini'); process.exit(0) }, 2500)\n"

const ROUGE = (mot, code) => `console.error(${JSON.stringify(mot)})\nprocess.exit(${code})\n`

test('un ROUGE ne coupe RIEN : ce qui le suit dans sa lane est JOUÉ, et le résumé les nomme tous', async () => {
  // `rouge` et `apres` dans la MÊME lane : la première tombe, la seconde lit le MÊME arbre propre
  // et rend donc un verdict JUSTE — la payer maintenant évite un passage de plus (#1772).
  const { racine } = depotDeGates([
    { nom: 'lente', job: 'a', corps: LENTE },
    { nom: 'rouge', job: 'b', corps: ROUGE('ce rouge est le sujet', 4) },
    { nom: 'apres', job: 'b', corps: LENTE },
    { nom: 'lente2', job: 'c', corps: LENTE },
  ])
  try {
    const lignes = []
    const code = await principal({
      racine,
      machine: MACHINE_A_LANES,
      argv: ['node', 'toutes.mjs'],
      journal: (t) => lignes.push(t),
      ecritLu: tableTotale(['lente', 'rouge', 'apres', 'lente2'], () => ({ ecrit: [], lit: ['src/'] })),
    })
    const sortie = lignes.join('')
    assert.doesNotMatch(sortie, /arrêt indéterminé/, sortie)
    assert.equal(code, 1, 'un rouge doit rendre 1' + '\n' + sortie)
    assert.match(sortie, /——— résumé ———/)
    // Le code de sortie de CHAQUE gate est imprimé : `build` a rendu ROUGE sans une ligne exploitable.
    assert.match(sortie, /\[gates\] rouge — ROUGE \(exit 4\) — /)
    assert.match(sortie, /\[gates\] lente — vert \(exit 0\) — /)
    assert.match(sortie, /\[gates\] lente2 — vert \(exit 0\) — /)
    assert.match(sortie, /\[gates\] apres — vert \(exit 0\) — /, '`apres` suit un rouge dans SA lane : elle est jouée')
    assert.match(sortie, /ce rouge est le sujet/, 'la queue du rouge doit être imprimée')
    assert.match(sortie, /0 spawn rejoué/)
  } finally {
    rmSync(racine, { recursive: true, force: true })
  }
})

test('#2187 — la gate qui lance la suite ATTEND le verrou de suite HORS de son chronomètre, et son enfant reçoit un fragment d’emprunt', async () => {
  const { racine } = depotDeGates([
    { nom: 'suite', fichier: 'scripts/test/run.mjs', corps: "console.log('emprunt=' + Object.keys(process.env).some(k => k.startsWith('WFRP_VERROU_')))\n" },
  ])
  const dossier = mkdtempSync(join(tmpdir(), 'gates-verrou-suite-'))
  const chemin = join(dossier, 'suite.lock')
  const arret = join(dossier, 'arret-tenant')
  // Un TENANT réel, vivant jusqu'au fichier `arret` (borne de secours 60 s) ; son verrou se reprend à sa mort.
  const tenant = spawn(process.execPath, ['-e', `
    const { existsSync } = require('node:fs')
    const fin = Date.now() + 60000
    const t = setInterval(() => { if (existsSync(${JSON.stringify(arret)}) || Date.now() > fin) clearInterval(t) }, 20)
  `], { stdio: 'ignore' })
  // `arret` posé à la PAS_TENUS-ième annonce du tenant : l'attente compte ces pas, la gate n'en compte aucun.
  const PAS_TENUS = 20
  let annonces = 0
  let horloge = 0
  try {
    writeFileSync(chemin, JSON.stringify({ pid: tenant.pid, commande: 'tenant du banc', cwd: dossier }))
    const lignes = []
    const code = await principal({
      racine,
      machine: MACHINE_A_LANES,
      argv: ['node', 'toutes.mjs'],
      horloge: () => horloge,
      journal: (t) => {
        lignes.push(t)
        if (t.includes(`attente du geste lourd :`) && t.includes(`PID ${tenant.pid}`)) {
          horloge += 100
          if (++annonces === PAS_TENUS) writeFileSync(arret, '')
        }
      },
      ecritLu: tableTotale(['suite'], () => ({ ecrit: [], lit: ['src/'] })),
      verrou: { chemin, libelle: 'suite du banc', attente: { pasMs: 100, echeanceMs: 20_000 } },
    })
    const sortie = lignes.join('')
    assert.equal(code, 0, sortie)
    assert.match(sortie, new RegExp(`\\[gates\\] suite — attente du geste lourd : .*PID ${tenant.pid}`), 'l’attente annonce le tenant')
    const attente = Number(/\[gates\] suite — ([\d.]+) s d'attente du geste lourd \(hors chronomètre\)/.exec(sortie)?.[1])
    const duree = Number(/\[gates\] suite — vert \(exit 0\) en ([\d.]+) s/.exec(sortie)?.[1])
    assert.ok(annonces >= PAS_TENUS, `annonces du tenant : ${annonces}`)
    assert.equal(attente, annonces / 10, 'l’attente compte les pas de l’horloge pendant le verrou')
    assert.equal(duree, 0, 'la gate ne compte aucun pas de l’horloge pendant le verrou')
    assert.match(readFileSync(/\[gates\] suite — vert \(exit 0\) en [\d.]+ s · (.+)\n/.exec(sortie)?.[1] ?? '', 'utf8'), /emprunt=true/, 'l’enfant reçoit le fragment explicite')
    assert.equal(existsSync(chemin), false, 'le verrou est rendu après la gate')
  } finally {
    writeFileSync(arret, '')
    tenant.kill()
    rmSync(dossier, { recursive: true, force: true })
    rmSync(racine, { recursive: true, force: true })
  }
})

test('DEUX rouges dans DEUX lanes distinctes sont rendus par UN SEUL run', async () => {
  const { racine } = depotDeGates([
    { nom: 'rouge1', job: 'a', corps: ROUGE('premier rouge', 4) },
    { nom: 'rouge2', job: 'b', corps: ROUGE('second rouge', 7) },
    { nom: 'lente', job: 'b', corps: LENTE },
  ])
  try {
    const lignes = []
    const code = await principal({
      racine,
      machine: MACHINE_A_LANES,
      argv: ['node', 'toutes.mjs'],
      journal: (t) => lignes.push(t),
      ecritLu: tableTotale(['rouge1', 'rouge2', 'lente'], () => ({ ecrit: [], lit: ['src/'] })),
    })
    const sortie = lignes.join('')
    assert.equal(code, 1)
    assert.match(sortie, /\[gates\] rouge1 — ROUGE \(exit 4\) — /)
    assert.match(sortie, /\[gates\] rouge2 — ROUGE \(exit 7\) — /)
    assert.match(sortie, /premier rouge/)
    assert.match(sortie, /second rouge/)
  } finally {
    rmSync(racine, { recursive: true, force: true })
  }
})

test('une machine qui ne porte pas les lanes joue en SÉRIE, et le dit', async () => {
  const { racine } = depotDeGates([
    { nom: 'alpha', job: 'a', corps: "console.log('alpha')\n" },
    { nom: 'beta', job: 'b', corps: "console.log('beta')\n" },
  ])
  try {
    const jouer = async (machine) => {
      const lignes = []
      const code = await principal({
        racine,
        machine,
        argv: ['node', 'toutes.mjs'],
        journal: (t) => lignes.push(t),
        ecritLu: { alpha: { ecrit: [], lit: ['src/'] }, beta: { ecrit: [], lit: ['src/'] } },
      })
      return { code, sortie: lignes.join('') }
    }
    const petite = await jouer(COEURS_SUITE_EN_LANES)
    assert.equal(petite.code, 0, petite.sortie)
    assert.match(petite.sortie, /machine de 10 cœur\(s\), pas au-delà des 10 de la suite : une seule lane/)
    assert.match(petite.sortie, /lanes : serie /)
    const grande = await jouer(MACHINE_A_LANES)
    assert.equal(grande.code, 0, grande.sortie)
    assert.doesNotMatch(grande.sortie, /une seule lane/)
    assert.match(grande.sortie, /lanes : a .* · b /)
  } finally {
    rmSync(racine, { recursive: true, force: true })
  }
})

test('--serie rend les MÊMES verdicts que les lanes : deux rouges, deux lignes, exit 1', async () => {
  // La morsure de `lanesAJouer` (« --serie joue EXACTEMENT les mêmes gates ») ne mesure que l'ensemble
  // et l'ORDRE des gates ; elle ne dit rien des VERDICTS. Ici c'est `principal` entier qui est rejoué
  // en `--serie` sur le même cas que le test des deux lanes distinctes : `--serie` ne change que la
  // COMPOSITION des lanes.
  const { racine } = depotDeGates([
    { nom: 'rouge1', job: 'a', corps: ROUGE('premier rouge', 4) },
    { nom: 'rouge2', job: 'b', corps: ROUGE('second rouge', 7) },
    { nom: 'lente', job: 'b', corps: LENTE },
  ])
  try {
    const lignes = []
    const code = await principal({
      racine,
      machine: MACHINE_A_LANES,
      argv: ['node', 'toutes.mjs', '--serie'],
      journal: (t) => lignes.push(t),
      ecritLu: tableTotale(['rouge1', 'rouge2', 'lente'], () => ({ ecrit: [], lit: ['src/'] })),
    })
    const sortie = lignes.join('')
    assert.equal(code, 1)
    assert.match(sortie, /\[gates\] rouge1 — ROUGE \(exit 4\) — /)
    assert.match(sortie, /\[gates\] rouge2 — ROUGE \(exit 7\) — /)
    assert.match(sortie, /\[gates\] lente — vert \(exit 0\) — /)
    assert.match(sortie, /premier rouge/)
    assert.match(sortie, /second rouge/)
  } finally {
    rmSync(racine, { recursive: true, force: true })
  }
})

test('DEUX rouges dans la MÊME lane sont tous deux JOUÉS et rendus', async () => {
  const { racine } = depotDeGates([
    { nom: 'rouge1', corps: ROUGE('premier rouge', 3) },
    { nom: 'rouge2', corps: ROUGE('second rouge', 5) },
  ])
  try {
    const lignes = []
    const code = await principal({
      racine,
      machine: MACHINE_A_LANES,
      argv: ['node', 'toutes.mjs'],
      journal: (t) => lignes.push(t),
      ecritLu: tableTotale(['rouge1', 'rouge2'], () => ({ ecrit: [], lit: ['src/'] })),
    })
    const sortie = lignes.join('')
    assert.equal(code, 1)
    assert.match(sortie, /\[gates\] rouge1 — ROUGE \(exit 3\) — /)
    assert.match(sortie, /\[gates\] rouge2 — ROUGE \(exit 5\) — /)
    assert.match(sortie, /premier rouge/)
    assert.match(sortie, /second rouge/)
  } finally {
    rmSync(racine, { recursive: true, force: true })
  }
})

test('le RÉSUMÉ s’imprime même si la photo de fin devient impossible', async () => {
  // Le 2026-09-04, `git status` a rendu STATUS_DLL_INIT_FAILED APRÈS sept minutes de gates : l'appel
  // levait, et vingt-deux verdicts payés n'ont jamais été imprimés. Ici la gate emporte le `.git`.
  const { racine } = depotDeGates([
    { nom: 'saborde', corps: `import { renameSync } from 'node:fs'\nrenameSync(${JSON.stringify(join('.git'))}, '.git-parti')\n` },
  ])
  try {
    const lignes = []
    const code = await principal({
      racine,
      machine: MACHINE_A_LANES,
      argv: ['node', 'toutes.mjs'],
      journal: (t) => lignes.push(t),
      ecritLu: { saborde: { ecrit: [], lit: ['src/'] } },
    })
    const sortie = lignes.join('')
    assert.match(sortie, /——— résumé ———/, 'le résumé doit être imprimé AVANT la photo de fin')
    assert.match(sortie, /\[gates\] saborde — vert \(exit 0\)/)
    assert.match(sortie, /photo de l'arbre IMPOSSIBLE/)
    assert.equal(code, 0, 'une photo impossible se DIT, elle ne fabrique pas un rouge')
  } finally {
    rmSync(racine, { recursive: true, force: true })
  }
})

test('une gate qui réécrit l’arbre fait REFUSER le run à la photo de fin', async () => {
  const { racine } = depotDeGates([
    { nom: 'ecrivain', corps: `import { writeFileSync } from 'node:fs'\nwriteFileSync('rapport.md', 'périmé\\n')\n` },
    { nom: 'lecteur', corps: LENTE },
  ])
  try {
    writeFileSync(join(racine, 'rapport.md'), 'à jour\n')
    lancerGit(['add', '-A'], { cwd: racine })
    lancerGit(['commit', '-qm', 'rapport'], { cwd: racine })
    const lignes = []
    const code = await principal({
      racine,
      machine: MACHINE_A_LANES,
      argv: ['node', 'toutes.mjs'],
      journal: (t) => lignes.push(t),
      ecritLu: {
        ecrivain: { ecrit: [], lit: ['src/'] },
        lecteur: { ecrit: [], lit: ['rapport.md'] },
      },
    })
    const sortie = lignes.join('')
    assert.equal(code, 1, 'un arbre réécrit rend le run ROUGE, même quand chaque gate est verte')
    assert.match(sortie, /\[gates\] ecrivain — vert/)
    assert.match(sortie, /\[gates\] lecteur — vert/, 'un écrivain ne fait sauter aucune gate')
    assert.match(sortie, /——— résumé ———[\s\S]*l'arbre a CHANGÉ pendant le run/)
  } finally {
    rmSync(racine, { recursive: true, force: true })
  }
})

test('pré-vol : un `npm run gen` rouge est un REFUS nommé, avant toute gate (#1801, #2203)', async () => {
  const { racine, git } = depotDeGates([{ nom: 'lente', corps: LENTE }])
  try {
    writeFileSync(
      join(racine, 'gen.mjs'),
      "import { writeFileSync } from 'node:fs'\n" +
        "console.error('registre.generated.ts : ÉCHEC du rendu'); process.exit(2)\n",
    )
    git('commit', '-qam', 'gen rouge')
    const lignes = []
    const code = await principal({
      racine,
      machine: MACHINE_A_LANES,
      argv: ['node', 'toutes.mjs'],
      journal: (t) => lignes.push(t),
      ecritLu: { lente: { ecrit: [], lit: ['src/'] } },
    })
    const sortie = lignes.join('')
    assert.equal(code, 1, sortie)
    assert.match(sortie, /REFUS — « npm run gen » rouge \(exit 2\)[\s\S]*registre\.generated\.ts : ÉCHEC du rendu/)
    assert.doesNotMatch(sortie, /\[gates\] lente — (?:vert|ROUGE)/, 'le refus du pré-vol précède toute gate')
    assert.equal(git('status', '--porcelain'), '', 'le pré-vol n’écrit rien dans l’arbre')
  } finally {
    rmSync(racine, { recursive: true, force: true })
  }
})

/**
 * PRÉREQUIS (#1708 geste 2) : une gate dont le prérequis manque ne mesure rien — `server:typecheck`
 * sans `server/node_modules` rend un TS2688 brut, qui ne nomme ni le dossier absent ni la commande
 * qui le pose. Le dépôt jetable porte une gate qui écrit un TÉMOIN HORS de l'arbre : sa présence dit
 * si elle a été spawnée, et l'arbre reste propre dans les deux cas.
 */
function depotATemoin() {
  const hors = mkdtempSync(join(tmpdir(), 'gates-prerequis-'))
  const temoin = join(hors, 'temoin.txt')
  const { racine, git } = depotDeGates([
    {
      nom: 'serveur',
      corps: `import { writeFileSync } from 'node:fs'\nwriteFileSync(${JSON.stringify(temoin)}, 'jouee')\n`,
    },
  ])
  return { racine, git, hors, temoin }
}

// `argv` vient du CORPS du test : un littéral de module qui nomme un fichier serait une entrée de
// stock nominatif de plus (scripts/guards/lib/stocksNominatifs.mjs) — ici c'est une donnée de cas.
const jouerAvecPrerequis = (racine, prerequis, lignes, argv) =>
  principal({
    racine,
    argv,
    machine: MACHINE_A_LANES,
    journal: (t) => lignes.push(t),
    ecritLu: { serveur: { ecrit: [], lit: ['deps/'], prerequis } },
  })

test('un PRÉREQUIS absent rend un ROUGE qui NOMME le chemin et la commande qui le pose — sans rien jouer', async () => {
  const { racine, hors, temoin } = depotATemoin()
  try {
    const lignes = []
    const code = await jouerAvecPrerequis(racine, [{ chemin: 'deps/absent', pose: 'cmd qui pose' }], lignes, ['node', 'toutes.mjs'])
    const sortie = lignes.join('')
    assert.match(sortie, /prérequis absent : `deps\/absent` \(le pose : `cmd qui pose`\)/)
    assert.equal(existsSync(temoin), false, 'la gate a été SPAWNÉE : son erreur brute aurait remplacé le refus')
    assert.match(sortie, /\[gates\] serveur — ROUGE \(exit 1\)/)
    assert.equal(code, 1, 'un prérequis absent est un ROUGE')
    // Le fichier de sortie porte le même refus : c'est lui que le résumé imprime en queue.
    const fichier = join(racine, 'node_modules', '.cache', 'gates', fichierDeSortie('serveur', process.pid))
    assert.match(readFileSync(fichier, 'utf8'), /`deps\/absent` \(le pose : `cmd qui pose`\)/)
  } finally {
    rmSync(racine, { recursive: true, force: true })
    rmSync(hors, { recursive: true, force: true })
  }
})

test('un PRÉREQUIS absent ne fait sauter AUCUNE gate — ni sa lane, ni les autres', async () => {
  // #1772 : le refus de prérequis est un ROUGE comme un autre. Il ne concerne que la gate qui LIT ce
  // chemin — `prerequisAbsents` est appelé PAR GATE (toutes.mjs, `jouerUneFois`) — donc les autres
  // lisent le même arbre propre et leur verdict est JUSTE. Les faire sauter coûtait un passage entier.
  // `serveur` (prérequis absent) et `suivante` dans la MÊME lane ; `voisine` dans une AUTRE.
  const { racine } = depotDeGates([
    { nom: 'serveur', job: 'a', corps: "console.log('jamais spawnée')\nprocess.exit(0)\n" },
    { nom: 'suivante', job: 'a', corps: LENTE },
    { nom: 'voisine', job: 'b', corps: ROUGE('la voisine a son propre rouge', 9) },
  ])
  try {
    const lignes = []
    const code = await principal({
      racine,
      machine: MACHINE_A_LANES,
      argv: ['node', 'toutes.mjs'],
      journal: (t) => lignes.push(t),
      ecritLu: {
        serveur: { ecrit: [], lit: ['deps/'], prerequis: [{ chemin: 'deps/absent', pose: 'cmd qui pose' }] },
        suivante: { ecrit: [], lit: ['src/'] },
        voisine: { ecrit: [], lit: ['src/'] },
      },
    })
    const sortie = lignes.join('')
    assert.equal(code, 1)
    // Le refus NOMME encore le chemin et la commande : le sujet du test « un PRÉREQUIS absent rend un
    // ROUGE qui NOMME le chemin et la commande qui le pose » est intact.
    assert.match(sortie, /prérequis absent : `deps\/absent` \(le pose : `cmd qui pose`\)/)
    assert.match(sortie, /\[gates\] serveur — ROUGE \(exit 1\) — /)
    assert.match(sortie, /\[gates\] suivante — vert \(exit 0\) — /, 'la MÊME lane continue après un refus de prérequis')
    assert.match(sortie, /\[gates\] voisine — ROUGE \(exit 9\) — /, 'une AUTRE lane rend son verdict réel')
    assert.match(sortie, /la voisine a son propre rouge/, 'les DEUX rouges sont rendus par un seul run')
  } finally {
    rmSync(racine, { recursive: true, force: true })
  }
})

test('un PRÉREQUIS présent ne change RIEN : la gate est jouée et rend son verdict réel', async () => {
  const { racine, git, hors, temoin } = depotATemoin()
  try {
    mkdirSync(join(racine, 'deps', 'present'), { recursive: true })
    writeFileSync(join(racine, 'deps', 'present', 'marqueur.txt'), 'posé\n')
    git('add', '-A')
    git('commit', '-qm', 'prérequis posé')
    const lignes = []
    const code = await jouerAvecPrerequis(racine, [{ chemin: 'deps/present', pose: 'cmd qui pose' }], lignes, ['node', 'toutes.mjs'])
    const sortie = lignes.join('')
    assert.equal(code, 0, 'un prérequis présent ne coûte aucun verdict')
    assert.match(sortie, /\[gates\] serveur — vert \(exit 0\)/)
    assert.doesNotMatch(sortie, /prérequis absent/)
    assert.equal(readFileSync(temoin, 'utf8'), 'jouee', 'la gate n’a pas été jouée')
  } finally {
    rmSync(racine, { recursive: true, force: true })
    rmSync(hors, { recursive: true, force: true })
  }
})

/** Un prérequis est un chemin RELATIF à la racine, et la gate qui l'exige le LIT (sinon il ne la
 *  concerne pas) — chaque entrée porte aussi la commande qui le pose, sans quoi le refus est muet. */
const incoherencesDePrerequis = (ecritLu) => {
  const refus = []
  for (const [nom, e] of Object.entries(ecritLu))
    for (const p of e.prerequis ?? []) {
      if (!p.chemin || isAbsolute(p.chemin) || p.chemin.startsWith('..'))
        refus.push(`${nom} : « ${p.chemin} » n’est pas un chemin relatif à la racine`)
      else if (!(e.lit ?? []).some((lu) => p.chemin.startsWith(lu)))
        refus.push(`${nom} : exige « ${p.chemin} » sans déclarer le LIRE — le prérequis ne la concerne pas`)
      if (!p.pose) refus.push(`${nom} : « ${p.chemin} » est exigé sans dire la commande qui le pose`)
    }
  return refus
}

test('tout PRÉREQUIS de la table est relatif, posé par une commande, et LU par sa gate', () => {
  assert.deepEqual(incoherencesDePrerequis(ECRIT_LU), [])
  const exiges = Object.values(ECRIT_LU).flatMap((e) => e.prerequis ?? [])
  assert.ok(exiges.length, 'aucun prérequis déclaré : ce contrat ne mesure plus rien')
  assert.deepEqual(
    ECRIT_LU['server:typecheck'].prerequis,
    [{ chemin: 'server/node_modules', pose: 'npm --prefix server ci' }],
    'le sous-projet serveur a ses propres dépendances (step `npm --prefix server ci` de .github/workflows/ci.yml)',
  )
  // Le détecteur VOIT : un chemin absolu, un chemin hors des lectures, une pose absente.
  assert.match(
    incoherencesDePrerequis({ g: { lit: ['server/'], prerequis: [{ chemin: join(tmpdir(), 'x'), pose: 'c' }] } }).join('\n'),
    /n’est pas un chemin relatif/,
  )
  assert.match(
    incoherencesDePrerequis({ g: { lit: ['server/'], prerequis: [{ chemin: 'autre/dep', pose: 'c' }] } }).join('\n'),
    /sans déclarer le LIRE/,
  )
  assert.match(
    incoherencesDePrerequis({ g: { lit: ['server/'], prerequis: [{ chemin: 'server/node_modules' }] } }).join('\n'),
    /sans dire la commande qui le pose/,
  )
})

test('`prerequisAbsents` ne rend que ce qui MANQUE sous la racine', () => {
  const base = mkdtempSync(join(tmpdir(), 'gates-prereq-unite-'))
  try {
    const entree = { lit: ['server/'], prerequis: [{ chemin: 'server/node_modules', pose: 'npm --prefix server ci' }] }
    assert.deepEqual(prerequisAbsents(entree, base), entree.prerequis)
    mkdirSync(join(base, 'server', 'node_modules'), { recursive: true })
    assert.deepEqual(prerequisAbsents(entree, base), [])
    assert.deepEqual(prerequisAbsents({ lit: [] }, base), [], 'une gate sans prérequis n’en a aucun d’absent')
    assert.deepEqual(prerequisAbsents(undefined, base), [], 'une gate hors table ne fait pas lever le lanceur')
  } finally {
    rmSync(base, { recursive: true, force: true })
  }
})

// ── `--gates a,b` : rejouer le rouge d'un run CI sans repayer les vingt autres (#1776) ──────────

const lanceParGates = async (racine, argv, lignes) =>
  principal({
    racine,
    argv,
    machine: MACHINE_A_LANES,
    journal: (t) => lignes.push(t),
    ecritLu: { alpha: { ecrit: [], lit: ['src/'] }, beta: { ecrit: [], lit: ['src/'] } },
  })

test('--gates ne joue QUE les gates nommées, et le dit avec le total', async () => {
  const { racine } = depotDeGates([
    { nom: 'alpha', corps: "console.log('alpha')\n" },
    { nom: 'beta', corps: "console.log('beta')\n" },
  ])
  const lignes = []
  const ecouteursAvant = ['SIGINT', 'SIGTERM'].map((signal) => process.listeners(signal))
  const verifierEcouteurs = () => {
    for (const [i, signal] of ['SIGINT', 'SIGTERM'].entries()) assert.deepEqual(process.listeners(signal), ecouteursAvant[i], signal)
  }
  try {
    const code = await lanceParGates(racine, ['node', 'toutes.mjs', '--gates', 'beta', '--serie'], lignes)
    const sortie = lignes.join('')
    assert.equal(code, 0, sortie)
    assert.match(sortie, /1 gate\(s\) lues dans ci\.yml \(sur 2\)/)
    assert.match(sortie, /\[gates\] beta — vert \(exit 0\)/)
    assert.doesNotMatch(sortie, /\[gates\] alpha —/, 'une gate non nommée ne se joue ni ne se résume')
    verifierEcouteurs()
    assert.equal(await lanceParGates(racine, ['node', 'toutes.mjs', '--gates', 'beta', '--serie'], []), 0)
    verifierEcouteurs()
    const journalException = []
    try {
      await assert.rejects(principal({
        racine, argv: ['node', 'toutes.mjs', '--gates', 'beta', '--serie'], machine: MACHINE_A_LANES,
        ecritLu: { alpha: { ecrit: [], lit: ['src/'] }, beta: { ecrit: [], lit: ['src/'] } },
        journal: (texte) => { journalException.push(texte); if (texte.includes('[gates] beta — vert')) throw new Error('journal interrompu') },
      }), /journal interrompu/)
    } catch (erreur) {
      erreur.message += '\n' + journalException.join('')
      throw erreur
    }
    verifierEcouteurs()
  } finally {
    rmSync(racine, { recursive: true, force: true })
  }
})

test('--gates sur un nom que ci.yml ne porte PAS est un REFUS nommé, jamais un run vide', async () => {
  const { racine } = depotDeGates([
    { nom: 'alpha', corps: '\n' },
    { nom: 'beta', corps: '\n' },
  ])
  const lignes = []
  try {
    const code = await lanceParGates(racine, ['node', 'toutes.mjs', '--gates', 'beta,gamma'], lignes)
    const sortie = lignes.join('')
    assert.equal(code, 1, 'une faute de frappe qui jouerait zéro gate en s’annonçant verte est le pire verdict')
    assert.match(sortie, /REFUS — ci\.yml ne porte aucune gate nommée gamma/)
    assert.match(sortie, /gates lisibles : alpha, beta/)
  } finally {
    rmSync(racine, { recursive: true, force: true })
  }
})

test('sans --gates, TOUTES les gates de ci.yml sont à jouer', async () => {
  const { racine } = depotDeGates([
    { nom: 'alpha', corps: '\n' },
    { nom: 'beta', corps: '\n' },
  ])
  const lignes = []
  try {
    await lanceParGates(racine, ['node', 'toutes.mjs', '--liste'], lignes)
    const sortie = lignes.join('')
    assert.match(sortie, /2 gate\(s\) lues dans ci\.yml\n/, 'sans restriction, aucun « (sur N) »')
    assert.match(sortie, /\[gates\] lane a \(job de ci\.yml\) : alpha, beta\n/, '`--liste` montre les lanes DÉRIVÉES des jobs')
    assert.match(sortie, /\[gates\] alpha — à jouer : npm run alpha/)
    assert.match(sortie, /\[gates\] beta — à jouer : npm run beta/)
  } finally {
    rmSync(racine, { recursive: true, force: true })
  }
})
