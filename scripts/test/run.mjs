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
  capacite,
  coeurs,
  codeAgrege,
  codeEnfant,
  compterSentinelles,
  enteteCapture,
  envEnfant,
  partieDe,
  partitionner,
  porteBilan,
  refusDePartie,
  trancher,
  VARIABLE_PARTIE,
  repartitionWorkers,
  resumeLancement,
  SENTINELLES,
  cotesRequis,
  memoireDisponibleMo,
  separerArguments,
  cheminsGlobSuspects,
  TAS_UTILISE,
} from './partition.mjs'
import { refusOutillageLocal } from '../outillage-local.mjs'
import { estPidVivant } from './verrou.mjs'
import { attenteDeSuite, prendreVerrouDeSuite, verrouRequis } from './verrouDeSuite.mjs'
import { PEREMPTION_MS, purgerPerimes } from '../guards/lib/purgerPerimes.mjs'

const RACINE = fileURLToPath(new URL('../..', import.meta.url))
const VITEST = path.join(RACINE, 'node_modules/vitest/vitest.mjs')
// Outillage LOCAL exigé AVANT tout lancement (#1679 L1c) : sans `node_modules/vitest` dans CET
// arbre, la remontée de Node servirait le vitest d'un AUTRE arbre au lieu d'échouer.
const refusVitest = refusOutillageLocal(RACINE, 'vitest', VITEST)
if (refusVitest) {
  console.error(refusVitest)
  process.exit(2)
}
// Atelier jetable, un dossier par processus lanceur (deux runs concurrents ne se recouvrent pas) :
// hors de l'arbre versionné, mais SOUS le projet — les configs générées y résolvent
// `vite`/`@vitejs/plugin-react` par remontée normale de `node_modules`.
const ATELIERS = path.join(RACINE, 'node_modules/.vitest-split')
const ATELIER = path.join(ATELIERS, String(process.pid))
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
  for (const nom of fs.existsSync(ATELIERS) ? fs.readdirSync(ATELIERS) : []) {
    const pid = Number(nom)
    if (!Number.isInteger(pid) || pid === process.pid || estPidVivant(pid)) continue
    supprimer(path.join(ATELIERS, nom))
  }
}

const posix = (p) => p.split(path.sep).join('/')

const DEBUT = Date.now()
const ARGV = process.argv.slice(2)
const { filtres, mono } = separerArguments(ARGV, (t) => fs.existsSync(path.resolve(RACINE, t)))
const PARTIE = partieDe(process.env[VARIABLE_PARTIE])
const refusPartie = PARTIE?.refus ?? (PARTIE ? refusDePartie({ filtres, argv: ARGV }) : null)
if (refusPartie) {
  console.error(`[test] REFUS — ${refusPartie}`)
  process.exit(2)
}
// Verrou de SUITE à l'échelle machine (#1679 L1c-M7) : deux suites COMPLÈTES concurrentes se volent
// cœurs et mémoire. Un run FILTRÉ reste libre — il est court et ne sature rien — à condition que
// CHAQUE filtre nomme un FICHIER : un filtre-DOSSIER (`npm test src`) est une suite déguisée.
const estFichier = (t) => {
  try {
    return fs.statSync(path.resolve(RACINE, t)).isFile()
  } catch {
    return false
  }
}
const verrou = prendreVerrouDeSuite({
  requis: verrouRequis(filtres, estFichier),
  commande: [process.execPath, ...process.argv.slice(1)].join(' '),
  cwd: RACINE,
  annoncer: (tenant) => console.error(`[verrou] ${attenteDeSuite(tenant)}`),
})
if (verrou.etat === 'refus') {
  console.error(verrou.message)
  process.exit(2)
}
if (verrou.avertissement) console.error(verrou.avertissement)
const ENV = envEnfant(process.env)
// Mémoire DISPONIBLE, pas totale : ce que ce processus peut encore obtenir au lancement, limite de
// cgroup et autres processus déjà servis — c'est elle que les workers se partagent (#1801).
const CAPACITE = capacite(
  coeurs(process.env, () => os.availableParallelism()),
  memoireDisponibleMo(process.env),
)
const CPUS = CAPACITE.servis
const WORKERS = repartitionWorkers(CPUS)
// Mode RÉELLEMENT servi : le partage se décide au-delà du seuil, mais se retire encore après coup
// (drapeau global à un seul processus, filtre qui ne touche qu'un côté, chemin à métacaractère).
let partageEffectif = false

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
      commande: [process.execPath, ...process.argv.slice(1)].join(' '),
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
    sortie.write(`${prefixe}${l}\n`)
    ecrireCapture(`${prefixe}${l}\n`)
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

/** Lancement à un seul processus Vitest : machine sous le seuil de partage, drapeau global à un
 *  seul processus, ou filtre qui ne touche qu'un côté. */
function lancementUnique(args) {
  const p = spawn(process.execPath, [VITEST, 'run', ...bornesWorkers(args, CPUS), ...args], {
    cwd: RACINE,
    env: ENV,
    stdio: ['inherit', 'pipe', 'pipe'],
  })
  relayer(p.stdout, process.stdout)
  relayer(p.stderr, process.stderr, { erreur: true })
  const relais = (s) => p.kill(s)
  process.on('SIGINT', relais)
  process.on('SIGTERM', relais)
  return new Promise((res) => {
    p.on('error', (e) => {
      const ligne = `[test] lancement de Vitest impossible : ${e.message}`
      process.stderr.write(`${ligne}\n`)
      ecrireCapture(`${ligne}\n`)
      observer(ligne, true)
      res(1)
    })
    p.on('close', (code, signal) => res(codeEnfant(code, signal)))
  })
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
  if (!PARTIE && (mono || !WORKERS.split)) return lancementUnique(ARGV)

  balayerAteliersMorts()
  fs.mkdirSync(ATELIER, { recursive: true })

  // Énumération par Vitest lui-même (1,0 s mesuré) : les `include`/`exclude` de vite.config.ts
  // ne sont recopiés nulle part.
  const liste = path.join(ATELIER, 'fichiers.json')
  const inventaire = spawnSync(process.execPath, [VITEST, 'list', '--filesOnly', `--json=${liste}`], {
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

  partageEffectif = true
  const debut = Date.now()
  const enfants = []

  const lancer = (cote) => {
    const config = ecrireConfig(cote, partition[cote].map((f) => posix(path.relative(RACINE, f))))
    const p = spawn(process.execPath, argumentsEnfant(VITEST, config, WORKERS[cote], ARGV), {
      cwd: RACINE,
      env: ENV,
    })
    enfants.push(p)
    relayer(p.stdout, process.stdout, { prefixe: `[${cote}] ` })
    relayer(p.stderr, process.stderr, { prefixe: `[${cote}] `, erreur: true })
    return new Promise((res) => {
      p.on('error', (e) => {
        const ligne = `[${cote}] lancement de Vitest impossible : ${e.message}`
        process.stderr.write(`${ligne}\n`)
        ecrireCapture(`${ligne}\n`)
        observer(ligne, true)
        for (const frere of enfants) if (frere !== p) frere.kill()
        res({ cote, code: 1 })
      })
      p.on('close', (code, signal) => res({ cote, code: codeEnfant(code, signal) }))
    })
  }

  const relais = (s) => enfants.forEach((p) => p.kill(s))
  process.on('SIGINT', relais)
  process.on('SIGTERM', relais)

  const resultats = await Promise.all(cotes.map(lancer))
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
  supprimer(ATELIER)
  verrou.liberer?.()
}
clearInterval(minuterieMemoire)
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
    ? `node ${WORKERS.node}+jsdom ${WORKERS.jsdom}`
    : (bornesWorkers(ARGV, CPUS).find((b) => b.startsWith('--maxWorkers=')) ?? '=appelant').split('=')[1],
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
process.exit(code)
