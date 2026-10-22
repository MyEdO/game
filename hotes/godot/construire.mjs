#!/usr/bin/env node
// LA CONSTRUCTION DE L'HÔTE GODOT (#2928, plan `docs/plans/2026-10-21-vague6-hote-godot.md` B5, B-c, M-f) : trois modes.
// `--pont-seul` bâtit le bundle du pont par `vite build` en bibliothèque, format iife, depuis l'entrée d'hôte unique
// (`entreeDHote`, `scripts/entree-d-hote.mjs` : le gel du catalogue, puis `hotes/godot/pont/entree.ts`, avec le greffon
// `proseSource()`) ; le bundle tient seul dans une page et expose `globalThis.wfrpPont` (`hotes/godot/pont/CONTRAT.md`).
// Il dit sa taille, puis l'EXÉCUTE dans un `node:vm` qui ne porte que les API de navigateur déclarées
// (`API_DU_NAVIGATEUR`) : `demarrer` et `vue` répondent `ok: true`, un second `demarrer` `ok: false`, sinon le code de
// sortie est 1 ; `--sortie <dossier>` l'y écrit, sans quoi rien ne s'écrit. La CI le joue (`npm run pont:godot`), pour
// qu'un changement du moteur qui casse le bundle de navigateur, à sa construction comme à son évaluation, ne passe pas
// vert. `--sonde` importe le projet (`hotes/godot/projet/`) par l'éditeur épinglé (`EDITEUR`), puis contrôle chaque
// script (`--check-only`) ; la CI la joue (`npm run godot:sonde`). `--export --sortie <dossier>` y écrit le bundle,
// puis l'export Web du projet (`export_presets.cfg`, modèles d'export 4.7 de la machine), que `recette.mjs` joue au
// navigateur. Godot ne travaille que sur une copie du projet sous le dossier temporaire : l'arbre n'en reçoit rien.
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { chmodSync, cpSync, existsSync, mkdirSync, mkdtempSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { join, relative, resolve, sep } from 'node:path'
import { stripVTControlCharacters } from 'node:util'
import { gzipSync, inflateRawSync } from 'node:zlib'
import { createContext, runInContext } from 'node:vm'
import { build } from 'vite'
import { entreeDHote } from '../../scripts/entree-d-hote.mjs'
import { listerDossier } from '../../scripts/guards/lib/lister.mjs'
import { tableTotale } from '../../src/lib/tableTotale.ts'

const RACINE = fileURLToPath(new URL('../..', import.meta.url))
const PROJET = join(RACINE, 'hotes', 'godot', 'projet')
const PONT = 'wfrp-pont.js'
const USAGE = `Usage : node hotes/godot/construire.mjs --pont-seul [--sortie <dossier>] | --sonde | --export --sortie <dossier>
  --pont-seul         le bundle ${PONT}, sans Godot, bâti puis exécuté
  --sonde             le projet importé, puis chaque script contrôlé, par l'éditeur Godot épinglé
  --export            le bundle et l'export Web du projet, dans --sortie
  --sortie <dossier>  le dossier où les écrire (sans lui, --pont-seul n'écrit rien)
  GODOT=<binaire>     un éditeur Godot de la version épinglée, à la place du téléchargement`

/** Les modes : l'option qui choisit chacun. */
const MODES = { '--pont-seul': 'pont', '--sonde': 'sonde', '--export': 'export' }

/** Les options de la ligne de commande, ou l'erreur qui les refuse. */
function lireOptions(argv) {
  const options = { mode: null, sortie: null }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a in MODES && !options.mode) options.mode = MODES[a]
    else if (a === '--sortie' && argv[i + 1]) options.sortie = resolve(argv[++i])
    else return { erreur: `option inconnue, incomplète ou en double : ${a}` }
  }
  if (!options.mode) return { erreur: `un mode attendu : ${Object.keys(MODES).join(', ')}` }
  if (options.mode === 'export' && !options.sortie) return { erreur: '--export attend --sortie <dossier>' }
  if (options.mode === 'sonde' && options.sortie) return { erreur: '--sonde n’écrit rien : --sortie hors de propos' }
  return { options }
}

/** Le bundle du pont : son code, écrit dans `sortie` si elle est donnée. */
async function empaqueter(sortie) {
  const entree = entreeDHote('wfrp-pont', ["import '/hotes/godot/pont/entree.ts';"])
  const resultat = await build({
    root: RACINE,
    configFile: false,
    publicDir: false,
    logLevel: 'warn',
    mode: 'production',
    plugins: entree.greffons,
    build: {
      // `lib.entry` se résout en chemin sous la racine ; le module virtuel entre par `input`, tel quel.
      lib: { entry: entree.entree, formats: ['iife'], name: 'wfrpPont', fileName: () => PONT },
      rolldownOptions: { input: entree.entree },
      write: sortie !== null,
      ...(sortie ? { outDir: sortie } : {}),
      emptyOutDir: false,
      copyPublicDir: false,
      reportCompressedSize: false,
    },
  })
  const [sortieDeRollup] = Array.isArray(resultat) ? resultat : [resultat]
  const morceau = sortieDeRollup.output.find((o) => o.type === 'chunk' && o.fileName === PONT)
  if (!morceau) throw new Error(`[pont] ${PONT} absent de la sortie de vite build`)
  return morceau.code
}

/** Les API de navigateur que le bundle lit, et que la page de Godot porte : chacune prise au global de Node, rien de plus. */
const API_DU_NAVIGATEUR = ['structuredClone', 'console', 'performance', 'URL', 'atob', 'setTimeout', 'clearTimeout', 'queueMicrotask']

/** Le scénario que l'exécution démarre : le combat des tests du pont (`hotes/godot/pont/tour.hors-store.test.ts`). */
const SCENARIO = 'dome'

/** Exécute le bundle comme la page de Godot : évalué dans un contexte qui ne porte que `API_DU_NAVIGATEUR`, son pont
 *  appelé. Rend la liste des écarts au contrat (`hotes/godot/pont/CONTRAT.md`), vide quand il tient. */
function executer(code) {
  const page = createContext(tableTotale(API_DU_NAVIGATEUR, (nom) => globalThis[nom]))
  try {
    runInContext(code, page, { filename: PONT })
  } catch (erreur) {
    return [`l’évaluation lève : ${erreur}`]
  }
  const pont = page.wfrpPont
  if (typeof pont?.appeler !== 'function') return ['`globalThis.wfrpPont.appeler` absent']
  const appel = (methode, entree) => {
    const brut = pont.appeler(methode, entree === undefined ? undefined : JSON.stringify(entree))
    return typeof brut === 'string' ? JSON.parse(brut) : { ok: null, brut }
  }
  const attendus = [
    ['demarrer', { scenario: SCENARIO }, (r) => r.ok === true && r.vue?.projection != null],
    ['vue', undefined, (r) => r.ok === true && r.vue?.projection != null],
    ['demarrer', { scenario: SCENARIO }, (r) => r.ok === false && r.erreur?.categorie === 'validation'],
    ['erreursGlobales', undefined, (r) => r.ok === true && Array.isArray(r.erreurs) && r.erreurs.length === 0],
  ]
  return attendus.flatMap(([methode, entree, tient]) => {
    const r = appel(methode, entree)
    return tient(r) ? [] : [`${methode} ${JSON.stringify(entree ?? null)} : ${JSON.stringify(r).slice(0, 400)}`]
  })
}


/** L'éditeur Godot épinglé (plan M-f) : sa version, et par plateforme l'archive publiée, sa somme SHA-256, les
 *  entrées qu'on en tire et celle qu'on lance (la console, sous Windows). */
const EDITEUR = {
  version: '4.7-stable',
  plateformes: {
    linux: { archive: 'Godot_v4.7-stable_linux.x86_64.zip', sha256: '0b1a6c54c2c619c12e169fe9241edda4b81080b519451cec2984bf0d2c6cb73c', entrees: ['Godot_v4.7-stable_linux.x86_64'] },
    win32: { archive: 'Godot_v4.7-stable_win64.exe.zip', sha256: '02a5312236f4e0209c78bcb2f52135b1963e6b8888c873c9cee81459e60bcd71', entrees: ['Godot_v4.7-stable_win64.exe', 'Godot_v4.7-stable_win64_console.exe'] },
  },
}

/** La version que `--version` imprime pour l'éditeur épinglé. */
const VERSION_IMPRIMEE = EDITEUR.version.replace('-', '.')

/** Le dossier où l'éditeur se garde, hors de l'arbre : la CI le met en cache sous ce chemin (`ci.yml`). */
const CACHE = join(homedir(), '.cache', 'wfrp-godot', EDITEUR.version)

/** Les entrées `noms` d'une archive zip (`zip`), décompressées : le répertoire central, puis chaque en-tête local. */
function extraire(zip, noms) {
  const fin = zip.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]))
  if (fin < 0) throw new Error('archive sans répertoire central')
  const entrees = new Map()
  for (let n = zip.readUInt16LE(fin + 10), p = zip.readUInt32LE(fin + 16); n > 0; n--) {
    const longueurs = [28, 30, 32].map((o) => zip.readUInt16LE(p + o))
    entrees.set(zip.toString('utf8', p + 46, p + 46 + longueurs[0]), { methode: zip.readUInt16LE(p + 10), taille: zip.readUInt32LE(p + 20), local: zip.readUInt32LE(p + 42) })
    p += 46 + longueurs[0] + longueurs[1] + longueurs[2]
  }
  return noms.map((nom) => {
    const e = entrees.get(nom)
    if (!e) throw new Error(`${nom} absent de l’archive (entrées : ${[...entrees.keys()].join(', ')})`)
    const debut = e.local + 30 + zip.readUInt16LE(e.local + 26) + zip.readUInt16LE(e.local + 28)
    const donnees = zip.subarray(debut, debut + e.taille)
    return { nom, octets: e.methode === 0 ? donnees : inflateRawSync(donnees) }
  })
}

/** La version que le binaire `binaire` imprime. */
const versionDe = (binaire) => spawnSync(binaire, ['--version'], { encoding: 'utf8', timeout: 60_000 }).stdout?.trim() ?? ''

/** Le binaire de l'éditeur épinglé : `GODOT` s'il est posé et de la version épinglée, sinon celui du cache, téléchargé
 *  et vérifié par sa somme à sa première demande. */
async function editeur() {
  if (process.env.GODOT) {
    const version = versionDe(process.env.GODOT)
    if (!version.startsWith(VERSION_IMPRIMEE)) throw new Error(`GODOT=${process.env.GODOT} imprime « ${version} », ${VERSION_IMPRIMEE} attendu`)
    return process.env.GODOT
  }
  const plateforme = EDITEUR.plateformes[process.platform]
  if (!plateforme) throw new Error(`aucun éditeur épinglé pour ${process.platform} : pose GODOT=<binaire ${VERSION_IMPRIMEE}>`)
  const lanceur = join(CACHE, plateforme.entrees.at(-1))
  if (existsSync(lanceur)) return lanceur
  const url = `https://github.com/godotengine/godot/releases/download/${EDITEUR.version}/${plateforme.archive}`
  console.log(`[godot] téléchargement de ${url}`)
  const reponse = await fetch(url)
  if (!reponse.ok) throw new Error(`${url} : HTTP ${reponse.status}`)
  const zip = Buffer.from(await reponse.arrayBuffer())
  const somme = createHash('sha256').update(zip).digest('hex')
  if (somme !== plateforme.sha256) throw new Error(`${plateforme.archive} : SHA-256 ${somme}, ${plateforme.sha256} attendue`)
  mkdirSync(CACHE, { recursive: true })
  for (const { nom, octets } of extraire(zip, plateforme.entrees)) {
    writeFileSync(join(CACHE, nom), octets)
    chmodSync(join(CACHE, nom), 0o755)
  }
  return lanceur
}

/** Les scripts du projet sous `dossier`, chemins `res://`. */
function scriptsDe(dossier, sous = dossier) {
  return listerDossier(sous).flatMap((nom) => {
    const chemin = join(sous, nom)
    if (statSync(chemin).isDirectory()) return nom === '.godot' ? [] : scriptsDe(dossier, chemin)
    return nom.endsWith('.gd') ? [`res://${relative(dossier, chemin).split(sep).join('/')}`] : []
  })
}

/** Godot sur le projet `projet` : rend les lignes d'erreur de sa sortie, ou celle qui dit son code de sortie. */
function godot(binaire, projet, args) {
  const r = spawnSync(binaire, ['--headless', '--path', projet, ...args], { encoding: 'utf8', timeout: 600_000, maxBuffer: 64 * 1024 * 1024 })
  const lignes = stripVTControlCharacters(`${r.stdout ?? ''}\n${r.stderr ?? ''}`).split('\n')
  const erreurs = lignes.filter((l) => /^(SCRIPT )?ERROR\b/.test(l.trim()))
  if (r.error) erreurs.push(`godot ${args.join(' ')} : ${r.error.message}`)
  else if (r.status !== 0) erreurs.push(`godot ${args.join(' ')} : code de sortie ${r.status}`)
  return erreurs
}

/** Joue `faire(copie)` sur une copie du projet, importée par `binaire`, sous le dossier temporaire ; rend ses erreurs. */
function surUneCopie(binaire, faire) {
  const copie = mkdtempSync(join(tmpdir(), 'wfrp-godot-'))
  try {
    cpSync(PROJET, copie, { recursive: true, filter: (source) => !source.split(sep).includes('.godot') })
    const importees = godot(binaire, copie, ['--import'])
    return importees.length ? importees : faire(copie)
  } finally {
    rmSync(copie, { recursive: true, force: true })
  }
}

/** La sonde : le projet importé, puis chaque script contrôlé. */
function sonder(binaire) {
  return surUneCopie(binaire, (copie) => {
    const scripts = scriptsDe(copie)
    if (!scripts.length) return [`aucun script sous ${PROJET}`]
    const erreurs = scripts.flatMap((script) => godot(binaire, copie, ['--check-only', '--script', script]))
    if (!erreurs.length) console.log(`[godot] ${VERSION_IMPRIMEE} : projet importé, ${scripts.length} scripts contrôlés (${scripts.join(', ')})`)
    return erreurs
  })
}

/** L'export Web du projet dans `sortie`. */
function exporter(binaire, sortie) {
  return surUneCopie(binaire, (copie) => godot(binaire, copie, ['--export-release', 'Web', join(sortie, 'index.html')]))
}

const octets = (n) => `${n.toLocaleString('fr-FR')} o`

/** Le bundle bâti, mesuré, puis exécuté : 0, ou 1 s'il ne tient pas son contrat. */
async function pont(sortie) {
  const debut = performance.now()
  const code = await empaqueter(sortie)
  const brut = Buffer.byteLength(code)
  console.log(`[pont] ${PONT} : ${octets(brut)} brut, ${octets(gzipSync(code).length)} gzip, bâti en ${Math.round(performance.now() - debut)} ms${sortie ? `, écrit dans ${sortie}` : ''}`)
  const ecarts = executer(code)
  if (ecarts.length) {
    console.error(`[pont] le bundle exécuté (API : ${API_DU_NAVIGATEUR.join(', ')}) ne tient pas son contrat :\n  ${ecarts.join('\n  ')}`)
    return 1
  }
  console.log(`[pont] exécuté (API : ${API_DU_NAVIGATEUR.join(', ')}) : demarrer ${SCENARIO} et vue ok, second demarrer refusé, erreursGlobales vide`)
  return 0
}

/** Les erreurs de Godot dites, et le code de sortie qu'elles valent. */
function verdict(erreurs) {
  if (!erreurs.length) return 0
  console.error(`[godot] ${erreurs.length} erreur(s) :\n  ${erreurs.join('\n  ')}`)
  return 1
}

async function principal() {
  const { options, erreur } = lireOptions(process.argv.slice(2))
  if (erreur) {
    console.error(`${erreur}\n${USAGE}`)
    return 2
  }
  if (options.mode === 'pont') return pont(options.sortie)
  if (options.mode === 'sonde') return verdict(sonder(await editeur()))
  mkdirSync(options.sortie, { recursive: true })
  const code = await pont(options.sortie)
  if (code) return code
  const sortie = verdict(exporter(await editeur(), options.sortie))
  if (!sortie) console.log(`[godot] export Web : ${listerDossier(options.sortie).map((f) => `${f} ${octets(statSync(join(options.sortie, f)).size)}`).join(', ')}`)
  return sortie
}

process.exitCode = await principal()
