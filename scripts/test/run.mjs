#!/usr/bin/env node
// Lanceur de `npm test` : DEUX processus Vitest concurrents, l'un pour les fichiers `node`,
// l'autre pour les fichiers `@vitest-environment jsdom`.
//
// Mesure de référence — 2026-08-23, dos à dos sur arbre identique, 16 cœurs : mono 127,5 s →
// split 97,8 s (−23 %), mêmes 1 451 fichiers. La parité porte sur les FICHIERS : sous
// `isolate:false` le groupement change, et un flake d'ordre (`bascule-de-vue`) change de verdict.
//
// `WFRP_TEST_PARTIE=i/K` ne joue que la tranche `i` de la suite (`trancher`, partition.mjs), sous
// le même choix partagé/mono : c'est le job matrice `suite` de `.github/workflows/ci.yml`.
//
// `--regime=lot|suite` (`regimeDeArgv`, partition.mjs ; `suite` par défaut) choisit l'empreinte d'un worker
// (`EMPREINTES_WORKER_MO`) qui borne les workers ; il n'est jamais transmis à Vitest.
//
// La sortie des enfants est relayée telle quelle ET tee-ée AU FIL DE L'EAU dans
// `node_modules/.cache/vitest-run-<pid>.txt` : un run tué (timeout, coupure) laisse quand même son
// début, et le fichier porte LUI-MÊME son `status:` — seul artefact hors du pont d'outillage.
import os from 'node:os'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawn, spawnSync } from 'node:child_process'
import {
  argumentsEnfant,
  bilanDiagnostic,
  bornesWorkers,
  demandeWorkers,
  maxWorkersMono,
  capaciteDuLanceur,
  codeAgrege,
  compterSentinelles,
  enteteCapture,
  envEnfant,
  partieDe,
  regimeDeArgv,
  partitionner,
  porteBilan,
  refusDePartie,
  trancher,
  VARIABLE_PARTIE,
  repartitionWorkers,
  resumeLancement,
  SENTINELLES,
  cotesRequis,
  separerArguments,
  cheminsGlobSuspects,
  TAS_UTILISE,
  ateliersMorts,
  nomDAtelier,
} from './partition.mjs'
import { refusOutillageLocal } from '../outillage-local.mjs'
import { IDENTITE_MESUREE } from './identiteMesuree.mjs'
import { prendreVerrouAsync, tenantEnUneLigne } from './verrou.mjs'
import { verrouGestesLourds } from './verrouGestesLourds.mjs'
import { CODE_DIFFERE, codeEnfant } from '../guards/lib/codesDeSortie.mjs'
import { PEREMPTION_MS, purgerPerimes } from '../guards/lib/purgerPerimes.mjs'

export async function lancerTests({ racine = fileURLToPath(new URL('../..', import.meta.url)), verrou: instance, env = process.env, argv = process.argv.slice(2), signal, inventorier = spawnSync, enfant = spawn } = {}) {
  const RACINE = racine
  const VITEST = path.join(RACINE, 'node_modules/vitest/vitest.mjs')
  // Outillage LOCAL exigé AVANT tout lancement (#1679 L1c) : sans `node_modules/vitest` dans CET
  // arbre, la remontée de Node servirait le vitest d'un AUTRE arbre au lieu d'échouer.
  const refusVitest = refusOutillageLocal(RACINE, 'vitest', VITEST)
  if (refusVitest) {
    console.error(refusVitest)
    return 2
  }
  // Atelier jetable, un dossier par processus lanceur (deux runs concurrents ne se recouvrent pas) :
  // hors de l'arbre versionné, mais SOUS le projet — les configs générées y résolvent
  // `vite`/`@vitejs/plugin-react` par remontée normale de `node_modules`.
  const ATELIERS = path.join(RACINE, 'node_modules/.vitest-split')
  const ATELIER = path.join(ATELIERS, nomDAtelier(process.pid, performance.timeOrigin))
  const CACHE = path.join(RACINE, 'node_modules/.cache')
  // Un fichier PAR PID : deux sessions concurrentes ne s'écrasent pas.
  const CAPTURE = path.join(CACHE, `vitest-run-${process.pid}.txt`)

  // Windows refuse d'effacer un fichier encore tenu par un enfant fraîchement tué : l'échec de
  // suppression se signale sur stderr, il ne change pas le verdict de la suite.
  const supprimer = (cible) => {
    try {
      fs.rmSync(cible, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 })
    } catch (e) {
      process.stderr.write(`[test] suppression de ${cible} impossible : ${e.message}\n`)
    }
  }

  /** Ateliers des lanceurs morts (suppression refusée sur le coup, machine éteinte en plein run) :
   *  le lanceur suivant les balaie, ceux des lanceurs vivants restent intacts. */
  const balayerAteliersMorts = () => {
    const noms = fs.existsSync(ATELIERS) ? fs.readdirSync(ATELIERS) : []
    for (const nom of ateliersMorts(noms, { pid: process.pid, identite: IDENTITE_MESUREE })) supprimer(path.join(ATELIERS, nom))
  }

  const posix = (p) => p.split(path.sep).join('/')

  const DEBUT = Date.now()
  const ARGV_DU_LANCEUR = argv
  const REGIME = regimeDeArgv(ARGV_DU_LANCEUR)
  if (REGIME.refus) {
    console.error(`[test] REFUS — ${REGIME.refus}`)
    return 2
  }
  const DEMANDE = demandeWorkers(REGIME.argv)
  if (DEMANDE.refus) {
    console.error(`[test] REFUS — ${DEMANDE.refus}`)
    return 2
  }
  const ARGV = DEMANDE.argv
  const { filtres, mono } = separerArguments(ARGV, (t) => fs.existsSync(path.resolve(RACINE, t)))
  const PARTIE = partieDe(env[VARIABLE_PARTIE])
  const refusPartie = PARTIE?.refus ?? (PARTIE ? refusDePartie({ filtres, argv: ARGV_DU_LANCEUR }) : null)
  if (refusPartie) {
    console.error(`[test] REFUS — ${refusPartie}`)
    return 2
  }
  const configuration = instance ?? verrouGestesLourds(RACINE)
  const verrou = await prendreVerrouAsync({
    ...configuration, env, signal, cwd: RACINE,
    commande: [process.execPath, 'scripts/test/run.mjs', ...argv].join(' '),
    attente: { ...configuration.attente, annoncer: (tenant) => console.error('[verrou] ' + tenantEnUneLigne(tenant)) },
  })
  if (verrou.etat !== 'pris') { console.error(verrou.message); return CODE_DIFFERE }
  const ENV = envEnfant({ ...env, ...verrou.env })
  // Mémoire DISPONIBLE, pas totale : ce que ce processus peut encore obtenir au lancement, limite de
  // cgroup et autres processus déjà servis — c'est elle que les workers se partagent (#1801).
  const CAPACITE = capaciteDuLanceur(env, REGIME.regime)
  if (CAPACITE.refus) {
    console.error('[memoire] ' + CAPACITE.refus + ' : minimum ' + CAPACITE.minimumMo + ' Mo, disponible ' + CAPACITE.memoireMo + ' Mo')
    verrou.liberer()
    return CODE_DIFFERE
  }
  console.log('[memoire] admission Vitest : ' + JSON.stringify(CAPACITE))
  const CPUS = CAPACITE.servis
  const WORKERS = repartitionWorkers(CPUS)
  const refuserDemande = (plafond) => {
    if (DEMANDE.maxWorkers === null || DEMANDE.maxWorkers <= plafond) return false
    console.error('[memoire] CONCURRENCE_SUPERIEURE_CAPACITE : maxWorkers admis ' + plafond)
    return true
  }
  // Mode RÉELLEMENT servi : le partage se décide au-delà du seuil, mais se retire encore après coup
  // (drapeau global à un seul processus, filtre qui ne touche qu'un côté, chemin à métacaractère).
  let partageEffectif = false
  // Enfants Vitest vivants, chacun avec la promesse de son `close` : l'atelier et le verrou ne se rendent
  // qu'après le `close` de tous. Un arrêt (signal du lanceur, annulation) est relayé à chacun et interdit
  // tout lancement ultérieur.
  const enfants = new Map()
  let arret = null
  const arreter = (s) => {
    arret ??= s
    for (const p of enfants.keys()) p.kill(s)
  }
  const annuler = () => arreter('SIGTERM')
  signal?.addEventListener('abort', annuler, { once: true })
  process.on('SIGINT', arreter)
  process.on('SIGTERM', arreter)

  let fdCapture = null
  const ecrireCapture = (texte) => {
    if (fdCapture === null) return
    try {
      fs.writeSync(fdCapture, texte)
    } catch (e) {
      fdCapture = null
      process.stderr.write(`[test] capture interrompue : ${e.message}\n`)
    }
  }
  /** Motif de nom d'une capture : `vitest-run-<pid>.txt` — une par run, un run en cours garde la sienne. */
  const MOTIF_CAPTURE = /^vitest-run-\d+\.txt$/

  try {
    fs.mkdirSync(CACHE, { recursive: true })
    purgerPerimes({ dossier: CACHE, motif: MOTIF_CAPTURE, ageMs: PEREMPTION_MS })
    fdCapture = fs.openSync(CAPTURE, 'w')
    ecrireCapture(
      enteteCapture({
        commande: [process.execPath, 'scripts/test/run.mjs', ...argv].join(' '),
        pid: process.pid,
        cwd: RACINE,
        date: new Date(),
      }),
    )
  } catch (e) {
    fdCapture = null
    process.stderr.write(`[test] capture impossible (${CAPTURE}) : ${e.message}\n`)
  }

  // Ce que le lanceur sait du run au moment du résumé : bilan vu, et dernières lignes utiles.
  const vu = { bilan: false, erreur: [], tout: [] }
  const empiler = (file, ligne) => {
    if (ligne.trim() === '') return
    file.push(ligne)
    if (file.length > 20) file.shift()
  }
  const compteSentinelles = compterSentinelles([])
  let tasMaxMo = null
  const observer = (ligne, erreur) => {
    if (porteBilan(ligne)) vu.bilan = true
    const tas = ligne.match(TAS_UTILISE)
    if (tas) tasMaxMo = Math.max(tasMaxMo ?? 0, Number(tas[1]))
    const ajout = compterSentinelles([ligne])
    for (const [libelle] of SENTINELLES) compteSentinelles[libelle] += ajout[libelle]
    empiler(erreur ? vu.erreur : vu.tout, ligne)
  }

  // La charge ne se lit qu'AU FIL du run : un pic passé est introuvable après coup. Deux maxima,
  // relevés toutes les 2 s — mémoire SYSTÈME (les processus Vitest sont des enfants) et rss du
  // lanceur. La minuterie est `unref`ée : elle ne retient jamais la sortie du processus.
  const memoire = { systemeMax: 0, rssMax: 0 }
  const echantillonnerMemoire = () => {
    memoire.systemeMax = Math.max(memoire.systemeMax, os.totalmem() - os.freemem())
    memoire.rssMax = Math.max(memoire.rssMax, process.memoryUsage.rss())
  }
  echantillonnerMemoire()
  const minuterieMemoire = setInterval(echantillonnerMemoire, 2000)
  minuterieMemoire.unref()

  /** Relais d'un flux d'enfant : vers la sortie du lanceur ET vers la capture, ligne à ligne. */
  const relayer = (flux, sortie, { prefixe = '', erreur = false } = {}) => {
    let reste = ''
    flux.setEncoding('utf8')
    const poser = (l) => {
      ecrireCapture(`${prefixe}${l}\n`)
      sortie.write(`${prefixe}${l}\n`)
      observer(l, erreur)
    }
    flux.on('data', (d) => {
      const lignes = (reste + d).split('\n')
      reste = lignes.pop()
      for (const l of lignes) poser(l)
    })
    flux.on('end', () => {
      if (reste) poser(reste)
    })
  }

  /** Un processus Vitest lancé directement, sorties relayées : rend son code (`codeEnfant`), 1 si son
   *  lancement ou son arrêt échoue, ou si un arrêt est déjà demandé. */
  function lancerVitest(args, prefixe = '') {
    if (arret || signal?.aborted) return Promise.resolve(1)
    const echouer = (quoi, e) => {
      const ligne = prefixe + '[test] ' + quoi + ' : ' + e.message
      process.stderr.write(ligne + '\n'); ecrireCapture(ligne + '\n'); observer(ligne, true)
      arreter('SIGTERM')
    }
    let p
    try {
      p = enfant(process.execPath, args, { cwd: RACINE, env: ENV, stdio: ['inherit', 'pipe', 'pipe'] })
    } catch (e) {
      echouer('lancement de Vitest impossible', e)
      return Promise.resolve(1)
    }
    relayer(p.stdout, process.stdout, { prefixe })
    relayer(p.stderr, process.stderr, { prefixe, erreur: true })
    let echec = false
    const fin = new Promise((res) => {
      p.on('error', (e) => {
        echec = true
        echouer(p.pid === undefined ? 'lancement de Vitest impossible' : `arrêt du processus Vitest ${p.pid} impossible`, e)
      })
      p.on('close', (code, s) => {
        enfants.delete(p)
        res(echec ? 1 : codeEnfant(code, s))
      })
    })
    enfants.set(p, fin)
    return fin
  }

  /** Lancement à un seul processus Vitest : machine sous le seuil de partage, drapeau global à un
   *  seul processus, ou filtre qui ne touche qu'un côté. */
  function lancementUnique(args) {
    if (refuserDemande(Math.min(CAPACITE.portes, maxWorkersMono(CPUS)))) return Promise.resolve(2)
    return lancerVitest([VITEST, 'run', ...bornesWorkers(args, CPUS, DEMANDE), ...args])
  }

  /** Config Vitest générée dans l'atelier : celle de `vite.config.ts`, `include` REMPLACÉ par `inclus`. */
  function ecrireConfig(nom, inclus) {
    const config = path.join(ATELIER, `vitest.${nom}.config.ts`)
    fs.writeFileSync(
      config,
      `// Généré par scripts/test/run.mjs à chaque lancement — jamais édité, jamais committé.\n` +
        `import base from ${JSON.stringify(posix(path.join(RACINE, 'vite.config.ts')))};\n` +
        // `mergeConfig` CONCATÈNE les `include` (mesuré 2026-08-23) : l'étalement explicite est
        // le seul moyen de REMPLACER la liste du fichier de base.
        `export default { ...base, root: ${JSON.stringify(posix(RACINE))}, ` +
        `test: { ...base.test, include: ${JSON.stringify(inclus)} } };\n`,
    )
    return config
  }

  async function principal() {
    if (signal?.aborted) return 1
    if (!PARTIE && (mono || !WORKERS.split)) return lancementUnique(ARGV)

    balayerAteliersMorts()
    fs.mkdirSync(ATELIER, { recursive: true })

    // Énumération par Vitest lui-même (1,0 s mesuré) : les `include`/`exclude` de vite.config.ts
    // ne sont recopiés nulle part.
    const liste = path.join(ATELIER, 'fichiers.json')
    const inventaire = inventorier(process.execPath, [VITEST, 'list', '--filesOnly', `--json=${liste}`], {
      cwd: RACINE,
      env: ENV,
      encoding: 'utf8',
    })
    if (inventaire.status !== 0) {
      const sortie = inventaire.stdout + inventaire.stderr
      process.stderr.write(sortie)
      ecrireCapture(sortie)
      for (const l of sortie.split('\n')) observer(l, true)
      return inventaire.status ?? 1
    }
    const tous = JSON.parse(fs.readFileSync(liste, 'utf8')).map((e) => e.file)
    let fichiers = tous
    let args = ARGV
    if (PARTIE) {
      const tranche = trancher(tous.map((f) => posix(path.relative(RACINE, f))), PARTIE)
      const ligne =
        `[partie] ${PARTIE.i}/${PARTIE.k} : ${tranche.fichiers.length} fichier(s) sur ${tous.length}` +
        ` · empreinte ${tranche.empreinte} · liste ${tranche.empreinteListe}\n`
      process.stdout.write(ligne)
      ecrireCapture(ligne)
      const suspects = cheminsGlobSuspects(tranche.fichiers)
      if (suspects.length) {
        const refus = `[partie] chemin à métacaractère de glob, tranche inexprimable en \`include\` : ${suspects[0]}`
        process.stderr.write(`${refus}\n`)
        ecrireCapture(`${refus}\n`)
        observer(refus, true)
        return 1
      }
      const garde = new Set(tranche.fichiers)
      fichiers = tous.filter((f) => garde.has(posix(path.relative(RACINE, f))))
      args = ['--config', ecrireConfig('partie', tranche.fichiers), ...ARGV]
    }
    const partition = partitionner(fichiers, (f) => fs.readFileSync(f, 'utf8'))
    if (mono || !WORKERS.split) return lancementUnique(args)

    const cotes = cotesRequis(filtres, partition, RACINE)
    const suspects = cheminsGlobSuspects(fichiers)
    if (cotes.length < 2 || suspects.length) {
      if (suspects.length) {
        process.stderr.write(
          `[split] chemin à métacaractère de glob, partage impossible : ${suspects[0]}\n`,
        )
      }
      return lancementUnique(args)
    }

    if (refuserDemande(WORKERS.node)) return 2
    partageEffectif = true
    const debut = Date.now()

    const lancerCote = async (cote) => {
      const config = ecrireConfig(cote, partition[cote].map((f) => posix(path.relative(RACINE, f))))
      return { cote, code: await lancerVitest(argumentsEnfant(VITEST, config, WORKERS[cote], ARGV, DEMANDE), '[' + cote + '] ') }
    }

    const resultats = await Promise.all(cotes.map(lancerCote))
    const real = ((Date.now() - debut) / 1000).toFixed(1)
    const synthese = resultats.map((r) => `${r.cote}: exit ${r.code}`).join(' · ')
    process.stdout.write(`${synthese} · real ${real}s\n`)
    ecrireCapture(`${synthese} · real ${real}s\n`)
    return codeAgrege(resultats.map((r) => r.code))
  }

  let code
  try {
    code = await principal()
  } finally {
    arreter('SIGTERM')
    await Promise.all(enfants.values())
    process.removeListener('SIGINT', arreter)
    process.removeListener('SIGTERM', arreter)
    signal?.removeEventListener('abort', annuler)
    clearInterval(minuterieMemoire)
    supprimer(ATELIER)
    verrou.liberer()
  }
  echantillonnerMemoire()
  // Le bloc `[diag]` précède le résumé (dont la ligne `capture :` clôt la sortie) et, dans le
  // fichier, la ligne `status:` — un run lu à travers un pont d'outillage garde ainsi sa mesure.
  const diagnostic = bilanDiagnostic(compteSentinelles, {
    capacite: CAPACITE,
    memGo: os.totalmem() / 2 ** 30,
    memMaxGo: memoire.systemeMax / 2 ** 30,
    rssMaxMo: memoire.rssMax / 2 ** 20,
    secondes: (Date.now() - DEBUT) / 1000,
    partage: partageEffectif,
    maxWorkers: partageEffectif
      ? `node ${Math.min(WORKERS.node, DEMANDE.maxWorkers ?? Infinity)}+jsdom ${Math.min(WORKERS.jsdom, DEMANDE.maxWorkers ?? Infinity)}`
      : bornesWorkers(ARGV, CPUS, DEMANDE)[0].split('=')[1],
    tasMaxMo,
  })
  process.stdout.write(diagnostic)
  ecrireCapture(diagnostic)
  process.stdout.write(
    resumeLancement({
      statut: code,
      bilan: vu.bilan,
      queue: vu.erreur.length ? vu.erreur : vu.tout,
      capture: CAPTURE,
    }),
  )
  ecrireCapture(`status: ${code}\n`)
  if (fdCapture !== null) {
    try {
      fs.closeSync(fdCapture)
    } catch {
      fdCapture = null
    }
  }
  return code
}

if (import.meta.main) process.exitCode = await lancerTests()
