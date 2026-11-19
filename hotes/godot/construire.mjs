#!/usr/bin/env node
// LA CONSTRUCTION DE L'HÔTE GODOT (#2928) : sept modes.
// `--pont-seul` bâtit le bundle du pont par `vite build` en production, en bibliothèque, format iife, depuis l'entrée d'hôte unique
// (`entreeDHote`, `scripts/entree-d-hote.mjs` : le gel du catalogue, puis `hotes/godot/pont/entree.ts`, avec le greffon
// `proseSource()`) ; le bundle tient seul dans une page et expose `globalThis.wfrpPont` (`hotes/godot/pont/CONTRAT.md`).
// Il dit sa taille, le LIT (`lecturesDuBundle`) : chaque nom de navigateur lu en identifiant libre est porté par le
// processus (`API_DU_NAVIGATEUR`) ou compté dans `HORS_DU_PROCESSUS` à son nombre de lectures ; puis l'EXÉCUTE dans un
// `node:vm` qui ne porte que les API de navigateur déclarées : `demarrer`, `vue`, `sauvegardes` et `salon` répondent
// `ok: true`, un second `demarrer` `ok: false`,
// `morceaux` par `appelerEnOctets` tient les octets que dit son en-tête, sinon le code de sortie est 1 ;
// `--sortie <dossier>` l'y écrit, sans quoi rien ne s'écrit. La CI le joue (`npm run pont:godot`), pour
// qu'un changement du moteur qui casse le bundle de navigateur, à sa construction comme à son évaluation, ne passe pas
// vert. `--sonde` importe le projet (`hotes/godot/projet/`) par l'éditeur épinglé (`EDITEUR`), puis contrôle chaque
// script (`--check-only`) et joue les recettes déclarant `const RECETTE_AUTONOME := true` sous `recettes/`, les vues
// de l'écran figées par le pont (`hotes/godot/recettes/ecran.ts`), le véhicule, le repos et les échantillons de
// l'atelier figés (`hotes/godot/recettes/vehicule.ts`, `hotes/godot/recettes/atelier.ts`,
// `hotes/godot/recettes/decor.ts`), le chemin du groupe (`hotes/godot/recettes/chemin.ts`), l'éditeur du navire
// (`hotes/godot/recettes/editeur.ts`) et le dégagement du combat (`hotes/godot/recettes/degagement.ts`) écrits dans la copie,
// chaque recette lancée avec `--pont=<vivant.mjs>` ; la CI la joue
// (`npm run godot:sonde`). `--export --sortie <dossier>` y écrit le bundle,
// puis l'export Web du projet (`export_presets.cfg`), sans les dossiers de `PAQUETS_DU_WEB`, chacun exporté à côté en
// paquet `<dossier>.pck` que la page charge avant l'accueil (#4402), et, à côté, le dossier des modèles et son listage
// (`deposerLesModeles`, #3778), chaque modèle en scène que l'éditeur fabrique de son GLB (`fabriquer`, #3946), les avis
// de licence de ce qu'il embarque sous `licences/` (`avis.mjs`, #4063 : le moteur, les paquets npm du bundle, les
// assets du projet ; un avis qui manque fait échouer l'export), et les planches figées par le pont sur ces modèles
// (`figerLesPlanches`, `deposerLesPlanches`, #3935) ; un fichier de la sortie au-delà de `LIMITE_DE_GITHUB` le fait
// échouer (`fichiersAuDelaDeGitHub`) : un site statique, que `deploy.yml` publie et que `recette.mjs` joue au navigateur, sur le modèle d'export que
// son préréglage nomme (`modeleDuPreset`) : tiré par tranches (`Range`) de l'archive des modèles publiée, vérifié par sa
// somme épinglée (`EDITEUR.modeles`), gardé sous `CACHE` (#2943), donné par `custom_template/release`. Godot ne
// travaille que sur une copie jetable du projet sous le dossier temporaire, tirée de sa copie importée gardée hors de
// l'arbre (`surUneCopie`, #3935) : l'arbre n'en reçoit rien, ni les modèles d'export du profil Godot
// (`export_templates`). Chaque étape du démarrage écrit sa durée au journal (`[démarrage]`, `chronometrer`). Avant d'ouvrir Godot, `--sonde`, `--rendus`, `--coop`, `--export` et `--bureau` déposent les GLB, les textures et les
// sons du projet, tirés de la Release des modèles et vérifiés par l'empreinte de leur provenance commitée
// (`recupererModeles`, #2948 ; `recupererEpingles`, #3476), et la copie reçoit le catalogue des dessins
// (`deposerLesDessins`, #3935). `--ouvrir` dépose de même les GLB, les textures, les sons et le catalogue des dessins, ce
// dernier dans le projet en place, puis ouvre l'éditeur épinglé sur ce projet (#3945) : F5 y joue sur le noyau vivant
// (`vivant.mjs`), qui partage `empaqueter` en développement. `--bureau --sortie <dossier>` y écrit l'exécutable de bureau de cette
// plateforme (#3951, `BUREAU`) : sous `noyau/`, le bundle, le point d'entrée embarqué empaqueté en un fichier
// (`empaqueterLeProcessus`, `embarque.mjs`) et le Node qui joue l'export ; l'export de son préréglage sur son modèle
// épinglé ; à côté, les modèles en scène et les avis de licence, Node et les paquets npm des deux bundles compris ;
// puis l'exécutable joue une partie sur son noyau embarqué
// (`jouerLExecutable`). `--rendus` joue en rendu réel, sous chacun des deux rendus du projet (`RENDUS`), les recettes
// déclarant `const RECETTE_RENDUE := true` (`rendre`), sur le pont vivant comme la sonde ; la CI le joue (`npm run godot:rendus`).
// `--coop` (#3009) lance le relay local (`npm run relay:dev`, `server/` installé) et joue la coop par deux processus Godot
// sans écran, l'hôte et l'invité (`coop`) ; la CI le joue (`npm run godot:coop`). L'import de ce module
// ne lance aucun mode ; il charge les assets par `listage.mjs` (#3963).
import { fileURLToPath } from 'node:url'
import { spawn, spawnSync } from 'node:child_process'
import { once } from 'node:events'
import { createServer } from 'node:net'
import { createHash } from 'node:crypto'
import { closeSync, cpSync, existsSync, mkdirSync, mkdtempSync, openSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { availableParallelism, homedir, tmpdir } from 'node:os'
import { basename, dirname, join, relative, resolve, sep } from 'node:path'
import { stripVTControlCharacters } from 'node:util'
import { createContext, runInContext } from 'node:vm'
import { gzipSync, inflateRawSync } from 'node:zlib'
import { Linter } from 'eslint'
import { build } from 'vite'
import { entreeDHote } from '../../scripts/entree-d-hote.mjs'
import { ecrireTexteAtomique } from '../../scripts/guards/lib/ecritureJsonAtomique.mjs'
import { enFileBornee } from '../../scripts/guards/lib/fileBornee.mjs'
import { listerArbre, listerDossier } from '../../scripts/guards/lib/lister.mjs'
import { estGroupeVivant } from '../../scripts/guards/lib/pid.mjs'
import { prendreVerrouAsync } from '../../scripts/test/verrou.mjs'
import { tableTotale } from '../../src/lib/tableTotale.ts'
import { assetsDeLHote } from './asset/charger.mjs'
import { avisDeGodot, avisDeNode, avisDesAssets, avisDesPaquets, deposerLesAvis } from './avis.mjs'
import { deposerLesModeles, listage } from './listage.mjs'
import { deposerLesPlanches, VUE_DE_BASE } from './planches.mjs'
import { API_DU_NAVIGATEUR, HORS_DU_PROCESSUS, PONT, ecartsDesLectures, pontDuBundle } from './processus.mjs'
import { stockageDuProcessus } from './stockage.mjs'

const RACINE = fileURLToPath(new URL('../..', import.meta.url))
const PROJET = join(RACINE, 'hotes', 'godot', 'projet')
/** Le pont vivant que l'hôte natif lance (`--pont=<chemin>`, `vivant.mjs`). */
const VIVANT = join(RACINE, 'hotes', 'godot', 'vivant.mjs')
const USAGE = `Usage : node hotes/godot/construire.mjs --pont-seul [--sortie <dossier>] | --sonde | --export --sortie <dossier> | --bureau --sortie <dossier> | --rendus | --ouvrir | --coop
  --pont-seul         le bundle ${PONT}, sans Godot, bâti puis exécuté
  --sonde             les GLB tirés de la Release, le projet importé, chaque script contrôlé et les recettes autonomes exécutées par l'éditeur Godot épinglé
  --export            le bundle, l'export Web du projet et ses paquets, ses modèles fabriqués en scène et les avis de licence de ce qu'il embarque, dans --sortie, sur le modèle d'export épinglé (téléchargé au premier appel)
  --rendus            le projet importé et les recettes rendues jouées en rendu réel sous chacun des deux rendus, Forward+ et compatibilité, par l'éditeur Godot épinglé
  --bureau            l'exécutable de bureau de cette plateforme, son noyau embarqué, ses modèles fabriqués en scène et les avis de licence de ce qu'il embarque, dans --sortie, puis la partie vivante jouée par l'exécutable
  --ouvrir            les GLB tirés de la Release et le catalogue des dessins déposés, puis l'éditeur Godot épinglé ouvert sur le projet en place, qui y joue sur le noyau vivant
  --coop              le projet importé, le relay local lancé (npm run relay:dev, server/ installé) et la coop jouée par deux processus Godot sans écran, l'hôte et l'invité (Linux seul)
  --sortie <dossier>  le dossier où les écrire (sans lui, --pont-seul n'écrit rien)
  GODOT=<binaire>     un éditeur Godot de la version épinglée, à la place du téléchargement (le modèle d'export n'en dépend pas)`

/** Les modes : l'option qui choisit chacun. */
const MODES = { '--pont-seul': 'pont', '--sonde': 'sonde', '--export': 'export', '--bureau': 'bureau', '--rendus': 'rendus', '--ouvrir': 'ouvrir', '--coop': 'coop' }

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
  if ((options.mode === 'export' || options.mode === 'bureau') && !options.sortie) return { erreur: `--${options.mode} attend --sortie <dossier>` }
  if (['sonde', 'ouvrir', 'rendus', 'coop'].includes(options.mode) && options.sortie) return { erreur: `--${options.mode} : --sortie hors de propos` }
  return { options }
}

/** Le bundle du pont bâti dans le `mode` donné (`'production'` ou `'development'`) : son code et les ids des modules
 *  qu'il porte (`avisDesPaquets`), écrit dans `sortie` si elle est donnée. Vite lit le mode dans `process.env.NODE_ENV`,
 *  posé au `mode` le temps de la construction, puis rendu à sa valeur d'avant, ou retiré s'il était absent. */
export async function empaqueter(sortie, mode) {
  const entree = entreeDHote('wfrp-pont', ["import '/hotes/godot/pont/entree.ts';"])
  const avant = process.env.NODE_ENV
  process.env.NODE_ENV = mode
  try {
    const resultat = await build({
      root: RACINE,
      configFile: false,
      publicDir: false,
      logLevel: 'warn',
      mode,
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
    const { code, moduleIds } = morceauDe(resultat, PONT)
    return { code, modules: moduleIds }
  } finally {
    if (avant === undefined) delete process.env.NODE_ENV
    else process.env.NODE_ENV = avant
  }
}

/** Le morceau `fichier` de `resultat`, la sortie de `vite build`. */
function morceauDe(resultat, fichier) {
  const [sortieDeRollup] = Array.isArray(resultat) ? resultat : [resultat]
  const morceau = sortieDeRollup.output.find((o) => o.type === 'chunk' && o.fileName === fichier)
  if (!morceau) throw new Error(`[pont] ${fichier} absent de la sortie de vite build`)
  return morceau
}

/** Le point d'entrée embarqué du processus du pont (`embarque.mjs`), et le fichier où il s'empaquette à côté du bundle. */
const EMBARQUE = join(RACINE, 'hotes', 'godot', 'embarque.mjs')
const PROCESSUS = 'vivant.mjs'

/** Le point d'entrée embarqué empaqueté en un seul fichier, `PROCESSUS`, dans `sortie` : il n'importe que Node. Rend
 *  son chemin et les ids des modules qu'il porte (`avisDesPaquets`). */
export async function empaqueterLeProcessus(sortie) {
  const resultat = await build({
    root: RACINE,
    configFile: false,
    publicDir: false,
    logLevel: 'warn',
    ssr: { noExternal: true },
    build: {
      ssr: EMBARQUE,
      outDir: sortie,
      emptyOutDir: false,
      copyPublicDir: false,
      rolldownOptions: { output: { entryFileNames: PROCESSUS } },
    },
  })
  return { chemin: join(sortie, PROCESSUS), modules: morceauDe(resultat, PROCESSUS).moduleIds }
}

/** Le scénario que l'exécution démarre : le combat des tests du pont (`hotes/godot/pont/tour.hors-store.test.ts`). */
const SCENARIO = 'dome'

/** Les lectures du bundle `code` en identifiant libre : par nom, leur nombre. Une passe de la règle `no-undef` du `Linter`
 *  d'ESLint, ses globaux ceux d'un contexte `node:vm` vide ; un nom lu sous `typeof` seul n'y est pas une lecture. */
export function lecturesDuBundle(code) {
  const globaux = runInContext('Object.getOwnPropertyNames(globalThis)', createContext())
  const messages = new Linter({ configType: 'flat' }).verify(code, [{
    languageOptions: { ecmaVersion: 'latest', sourceType: 'script', globals: tableTotale(globaux, () => 'readonly') },
    rules: { 'no-undef': 'error' },
  }])
  const lectures = {}
  for (const { ruleId, message } of messages) {
    const nom = ruleId === 'no-undef' ? /^'(.+)' is not defined\.$/.exec(message)?.[1] : undefined
    if (nom === undefined) throw new Error(`[pont] lecture du bundle : ${message}`)
    lectures[nom] = (lectures[nom] ?? 0) + 1
  }
  return lectures
}

/** Lit le bundle (`lecturesDuBundle`), puis l'exécute comme la page de Godot (`pontDuBundle`), son pont appelé. Rend la
 *  liste des écarts au contrat (`hotes/godot/pont/CONTRAT.md`), vide quand il tient : un nom lu que le processus ne
 *  porte pas, hors de `HORS_DU_PROCESSUS` ou à un autre compte, en est un, même dans une branche que l'exécution ne joue pas. */
function executer(code) {
  const lus = ecartsDesLectures(lecturesDuBundle(code), API_DU_NAVIGATEUR, HORS_DU_PROCESSUS)
  let pont
  try {
    pont = pontDuBundle(code, console, stockageDuProcessus(null))
  } catch (erreur) {
    return [...lus, `l’évaluation lève : ${erreur}`]
  }
  if (typeof pont?.appeler !== 'function') return [...lus, '`globalThis.wfrpPont.appeler` absent']
  const appel = (methode, entree) => {
    const brut = pont.appeler(methode, entree === undefined ? undefined : JSON.stringify(entree))
    return typeof brut === 'string' ? JSON.parse(brut) : { ok: null, brut }
  }
  const attendus = [
    ['demarrer', { scenario: SCENARIO }, (r) => r.ok === true && r.vue?.projection != null && r.vue?.corps != null],
    ['vue', undefined, (r) => r.ok === true && r.vue?.projection != null && r.vue?.corps != null],
    ['demarrer', { scenario: SCENARIO }, (r) => r.ok === false && r.erreur?.categorie === 'validation'],
    ['sauvegardes', undefined, (r) => r.ok === true && Array.isArray(r.zones?.['sauvegardes.emplacements'])],
    ['salon', undefined, (r) => r.ok === true && Array.isArray(r.zones?.['salon.etat']) && Array.isArray(r.zones?.['salon.gestes'])],
    ['erreursGlobales', undefined, (r) => r.ok === true && Array.isArray(r.erreurs) && r.erreurs.length === 0],
  ]
  const ecarts = attendus.flatMap(([methode, entree, tient]) => {
    const r = appel(methode, entree)
    return tient(r) ? [] : [`${methode} ${JSON.stringify(entree ?? null)} : ${JSON.stringify(r).slice(0, 400)}`]
  })
  return [...lus, ...ecarts, ...ecartsDesOctets(pont, appel('monde'))]
}

/** Les écarts de la porte en octets du pont (`appelerEnOctets`, `octets`) sur toutes les clés du manifeste `monde` :
 *  `morceaux` tient un `ArrayBuffer` de la longueur que dit son en-tête, une autre méthode aucun. */
function ecartsDesOctets(pont, monde) {
  if (typeof pont.appelerEnOctets !== 'function' || typeof pont.octets !== 'function') return ['`globalThis.wfrpPont.appelerEnOctets` ou `octets` absent']
  const cles = (liste) => liste.map(({ cle }) => cle)
  const entree = { source: 'partie', volume: cles(monde.monde.morceaux), toits: cles(monde.toits), couronnes: cles(monde.couronnes) }
  const entete = JSON.parse(pont.appelerEnOctets('morceaux', JSON.stringify(entree)))
  const tenus = pont.octets()
  const ecarts = entete.ok === true && entete.volume?.length > 0 && Object.prototype.toString.call(tenus) === '[object ArrayBuffer]' && tenus.byteLength === entete.octets
    ? []
    : [`morceaux en octets : ${JSON.stringify(entete).slice(0, 400)}, octets() ${Object.prototype.toString.call(tenus)} de ${tenus?.byteLength}`]
  pont.appelerEnOctets('vue')
  return pont.octets() === null ? ecarts : [...ecarts, 'octets() après vue : des octets au lieu de null']
}


/** L'éditeur Godot épinglé (plan M-f) : sa version, et par plateforme l'archive publiée, sa somme SHA-256, les
 *  entrées qu'on en tire et celle qu'on lance (la console, sous Windows). `modeles` : l'archive des modèles d'export
 *  de la même version, et la somme SHA-256 de chaque modèle qu'on en tire, par entrée (#2943). */
const EDITEUR = {
  version: '4.7-stable',
  plateformes: {
    linux: { archive: 'Godot_v4.7-stable_linux.x86_64.zip', sha256: '0b1a6c54c2c619c12e169fe9241edda4b81080b519451cec2984bf0d2c6cb73c', entrees: ['Godot_v4.7-stable_linux.x86_64'] },
    win32: { archive: 'Godot_v4.7-stable_win64.exe.zip', sha256: '02a5312236f4e0209c78bcb2f52135b1963e6b8888c873c9cee81459e60bcd71', entrees: ['Godot_v4.7-stable_win64.exe', 'Godot_v4.7-stable_win64_console.exe'] },
  },
  modeles: {
    archive: 'Godot_v4.7-stable_export_templates.tpz',
    sha256: {
      'templates/web_nothreads_release.zip': '6e1d01e7d8995a2dfec8b33dc530f02c034906267ec441288c2a3318d49e00b9',
      'templates/linux_release.x86_64': '3154bb4465f616e24b811dd576e9230022872cd80f8d5ab854efed2716b926d4',
      'templates/windows_release_x86_64.exe': 'c42eb5d17f683eb8bcd52c19a9f36ebf811b1788623878d5276a7d9ffc09f95c',
    },
  },
}

/** La version que `--version` imprime pour l'éditeur épinglé. */
const VERSION_IMPRIMEE = EDITEUR.version.replace('-', '.')

/** Le dossier où l'éditeur et le modèle d'export se gardent, hors de l'arbre : la CI le met en cache sous ce chemin (`ci.yml`). */
const CACHE = join(homedir(), '.cache', 'wfrp-godot', EDITEUR.version)

/** Une archive zip en mémoire, lue comme une archive par tranches. */
const enMemoire = (zip) => ({ taille: zip.length, lire: async (debut, fin) => zip.subarray(debut, fin) })

/** Une archive zip publiée à `url`, lue par tranches (requêtes `Range`, réponse 206 exigée) ; `telecharges()` rend
 *  les octets reçus. */
async function aDistance(url) {
  let telecharges = 0
  const tranche = async (debut, fin) => {
    const reponse = await fetch(url, { headers: { Range: `bytes=${debut}-${fin - 1}` } })
    if (reponse.status !== 206) throw new Error(`${url} : HTTP ${reponse.status} sur la tranche ${debut}-${fin - 1}, 206 attendu`)
    const octets = Buffer.from(await reponse.arrayBuffer())
    telecharges += octets.length
    return { reponse, octets }
  }
  const { reponse } = await tranche(0, 1)
  const taille = Number(reponse.headers.get('content-range')?.split('/')[1])
  if (!Number.isSafeInteger(taille)) throw new Error(`${url} : Content-Range « ${reponse.headers.get('content-range')} » sans taille`)
  return { taille, lire: async (debut, fin) => (await tranche(debut, fin)).octets, telecharges: () => telecharges }
}

/** La fin d'une archive zip qui contient à coup sûr la fin du répertoire central : 22 octets et un commentaire d'au plus 65 535. */
const QUEUE_ZIP = 22 + 0xffff

/** Les entrées `noms` d'une archive zip lue par tranches (`archive` : `{ taille, lire(debut, fin) }`), décompressées :
 *  la fin du répertoire central, le répertoire central, puis l'en-tête local et les données de chaque entrée. */
async function extraire({ taille, lire }, noms) {
  const queue = await lire(Math.max(0, taille - QUEUE_ZIP), taille)
  const fin = queue.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]))
  if (fin < 0) throw new Error('archive sans répertoire central')
  const [nombre, longueur, debut] = [queue.readUInt16LE(fin + 10), queue.readUInt32LE(fin + 12), queue.readUInt32LE(fin + 16)]
  if (nombre === 0xffff || longueur === 0xffffffff || debut === 0xffffffff) throw new Error('archive zip64 : non prise en charge')
  const central = await lire(debut, debut + longueur)
  const entrees = new Map()
  for (let n = nombre, p = 0; n > 0; n--) {
    const longueurs = [28, 30, 32].map((o) => central.readUInt16LE(p + o))
    entrees.set(central.toString('utf8', p + 46, p + 46 + longueurs[0]), { methode: central.readUInt16LE(p + 10), taille: central.readUInt32LE(p + 20), local: central.readUInt32LE(p + 42) })
    p += 46 + longueurs[0] + longueurs[1] + longueurs[2]
  }
  const extraites = []
  for (const nom of noms) {
    const e = entrees.get(nom)
    if (!e) throw new Error(`${nom} absent de l’archive (entrées : ${[...entrees.keys()].join(', ')})`)
    const entete = await lire(e.local, e.local + 30)
    const donnees = e.local + 30 + entete.readUInt16LE(26) + entete.readUInt16LE(28)
    const octets = await lire(donnees, donnees + e.taille)
    if (e.methode !== 0 && e.methode !== 8) throw new Error(`${nom} : méthode ${e.methode} non prise en charge`)
    extraites.push({ nom, octets: e.methode === 0 ? octets : inflateRawSync(octets) })
  }
  return extraites
}

/** L'URL de `fichier` dans la publication de la version épinglée. */
const publie = (fichier) => `https://github.com/godotengine/godot/releases/download/${EDITEUR.version}/${fichier}`

/** La version que le binaire `binaire` imprime. */
const versionDe = (binaire) => spawnSync(binaire, ['--version'], { encoding: 'utf8', timeout: 60_000 }).stdout?.trim() ?? ''

/** Le binaire de l'éditeur épinglé : `GODOT` s'il est posé et de la version épinglée, sinon celui du cache, téléchargé
 *  et vérifié par sa somme à sa première demande. Chaque entrée se pose sous un nom propre au processus puis se
 *  renomme, le lanceur en dernier : deux lancements menés de front sur un cache vide ne s'écrivent pas l'un sur l'autre. */
async function editeur() {
  const { verifierSomme } = await assetsDeLHote()
  if (process.env.GODOT) {
    const version = versionDe(process.env.GODOT)
    if (!version.startsWith(VERSION_IMPRIMEE)) throw new Error(`GODOT=${process.env.GODOT} imprime « ${version} », ${VERSION_IMPRIMEE} attendu`)
    return process.env.GODOT
  }
  const plateforme = EDITEUR.plateformes[process.platform]
  if (!plateforme) throw new Error(`aucun éditeur épinglé pour ${process.platform} : pose GODOT=<binaire ${VERSION_IMPRIMEE}>`)
  const lanceur = join(CACHE, plateforme.entrees.at(-1))
  if (existsSync(lanceur)) return lanceur
  const url = publie(plateforme.archive)
  console.log(`[godot] téléchargement de ${url}`)
  const reponse = await fetch(url)
  if (!reponse.ok) throw new Error(`${url} : HTTP ${reponse.status}`)
  const zip = Buffer.from(await reponse.arrayBuffer())
  verifierSomme(plateforme.archive, zip, plateforme.sha256)
  // #4199 : `extraire` rend les entrées dans l'ordre de `entrees`, le lanceur (testé par `existsSync`) se renomme en dernier.
  for (const { nom, octets } of await extraire(enMemoire(zip), plateforme.entrees)) {
    ecrireTexteAtomique(join(CACHE, nom), octets, { mode: 0o755 })
  }
  return lanceur
}

/** Le préréglage d'export du projet, relatif au projet (et à sa copie). */
const PRESETS = 'export_presets.cfg'

/** Les dossiers du projet que l'export Web sert hors de `index.pck`, chacun en paquet `<dossier>.pck` à côté de la page
 *  (#4402), nommés dans `PAQUETS`, que la scène de démarrage de la page lit (`projet/scripts/demarrage.gd`). */
const PAQUETS_DU_WEB = ['textures']
/** La liste des paquets écrite à côté de la page. */
const PAQUETS = 'paquets.json'
/** Le préréglage qui exporte chaque paquet (`export_presets.cfg`), son `include_filter` réécrit par paquet. */
const PRESET_DES_PAQUETS = 'Paquet Web'
/** La taille d'un fichier au-delà de laquelle GitHub refuse un push, en octets (100 Mo). */
const LIMITE_DE_GITHUB = 100 * 1024 * 1024

/** Chaque fichier de `dossier`, à toute profondeur, au-delà de `LIMITE_DE_GITHUB` : `{ fichier, taille }`, son chemin
 *  relatif et sa taille en octets. */
export const fichiersAuDelaDeGitHub = (dossier) => listerArbre(dossier)
  .map((fichier) => ({ fichier, taille: statSync(join(dossier, fichier)).size }))
  .filter(({ taille }) => taille > LIMITE_DE_GITHUB)

/** Le préréglage `preset` du fichier des préréglages de la copie `copie` réécrit : chaque clé de `reecrire`, une ligne
 *  `cle="…"` du préréglage ou de ses options, reçoit ce que sa fonction rend de sa valeur d'avant. Rend l'erreur qui
 *  le refuse, ou `null`. */
function reglerLePreset(copie, preset, reecrire) {
  const presets = join(copie, PRESETS)
  const sections = readFileSync(presets, 'utf8').split(/^(?=\[preset\.\d+\]\r?$)/m)
  const rang = sections.findIndex((section) => new RegExp(`^name=${JSON.stringify(preset)}\\r?$`, 'm').test(section))
  if (rang < 0) return `${PRESETS} : préréglage ${preset} absent`
  for (const [cle, valeur] of Object.entries(reecrire)) {
    const ligne = new RegExp(`^${cle}=("[^\\r\\n]*")(\\r?)$`, 'm')
    const avant = sections[rang].match(ligne)
    if (!avant) return `${PRESETS} : ${cle} absent du préréglage ${preset}`
    sections[rang] = sections[rang].replace(ligne, () => `${cle}=${JSON.stringify(valeur(JSON.parse(avant[1])))}${avant[2]}`)
  }
  writeFileSync(presets, sections.join(''))
  return null
}

/** Le modèle d'export Web que le préréglage `cfg` consomme en release : son entrée dans l'archive des modèles, au nom
 *  que Godot cherche (`platform/web/export/export_plugin.h`, `_get_template_name`, Godot 4.7-stable). */
function modeleDuPreset(cfg) {
  const option = (nom) => {
    const valeur = cfg.match(new RegExp(`^variant/${nom}=(true|false)\\r?$`, 'm'))?.[1]
    if (!valeur) throw new Error(`${PRESETS} : variant/${nom} absent`)
    return valeur === 'true'
  }
  return `templates/web${option('extensions_support') ? '_dlink' : ''}${option('thread_support') ? '' : '_nothreads'}_release.zip`
}

/** Le préréglage d'export de bureau de chaque plateforme (`export_presets.cfg`), son modèle d'export en release dans
 *  l'archive des modèles (`platform/linuxbsd/export/export_plugin.cpp`, `platform/windows/export/export_plugin.cpp`,
 *  Godot 4.7-stable), l'exécutable qu'il écrit, le nom sous lequel il cherche le Node du noyau embarqué
 *  (`projet/scripts/transport_du_processus.gd`), et le `LICENSE` de la distribution de Node de la plateforme, relatif
 *  au dossier de son exécutable (archives `node-v<version>-linux-x64.tar.xz`, `bin/node`, et
 *  `node-v<version>-win-x64.zip`, `node.exe`, que pose aussi `actions/setup-node`). */
const BUREAU = {
  linux: { preset: 'Linux', modele: 'templates/linux_release.x86_64', executable: 'wfrp.x86_64', node: 'node', licenceDeNode: '../LICENSE' },
  win32: { preset: 'Windows Desktop', modele: 'templates/windows_release_x86_64.exe', executable: 'wfrp.exe', node: 'node.exe', licenceDeNode: 'LICENSE' },
}

/** Le dossier du noyau embarqué, à côté de l'exécutable de bureau (`projet/scripts/transport_du_processus.gd`). */
const NOYAU = 'noyau'

/** Le chemin du modèle d'export `entree` de l'archive des modèles : celui du cache si sa somme est l'épinglée, sinon
 *  tiré par tranches de l'archive publiée et vérifié par sa somme épinglée. */
async function modeleDExport(entree) {
  const { enCacheOuTire } = await assetsDeLHote()
  const attendue = EDITEUR.modeles.sha256[entree]
  if (!attendue) throw new Error(`${entree} : aucune somme épinglée (EDITEUR.modeles)`)
  const chemin = join(CACHE, basename(entree))
  await enCacheOuTire(chemin, attendue, entree, async () => {
    const url = publie(EDITEUR.modeles.archive)
    console.log(`[godot] modèle d'export ${entree}, tiré de ${url}`)
    const archive = await aDistance(url)
    const [{ octets: modele }] = await extraire(archive, [entree])
    console.log(`[godot] ${octets(archive.telecharges())} téléchargés sur ${octets(archive.taille)}, ${basename(entree)} (${octets(modele.length)}) pour ${CACHE}`)
    return modele
  })
  return chemin
}

/** Les scripts du projet sous `dossier`, chemins `res://`. */
function scriptsDe(dossier, sous = dossier) {
  return listerDossier(sous).flatMap((nom) => {
    const chemin = join(sous, nom)
    if (statSync(chemin).isDirectory()) return nom === '.godot' ? [] : scriptsDe(dossier, chemin)
    return nom.endsWith('.gd') ? [`res://${relative(dossier, chemin).split(sep).join('/')}`] : []
  })
}

/** Les erreurs que Godot écrit parmi `lignes`. */
const erreursDe = (lignes) => lignes.filter((l) => /^(SCRIPT )?ERROR\b/.test(l.trim()))

/** Un journal neuf pour un lancement de `commande` sur `args`, qui y écrit sa sortie et sa sortie d'erreur (`fd`, le
 *  même fichier pour les deux). `bilan(r)`, `r` disant comment il finit (`{ error?, signal, status }`), rend les lignes
 *  du journal, sans séquences de terminal, dans l'ordre où il les écrit, et son échec, s'il y en a un : sa cause (le
 *  signal qui l'a tué, ou son code de sortie) et la fin de sa sortie (`FIN_DE_SORTIE` lignes). `clore()` l'efface. */
const FIN_DE_SORTIE = 40
function journaliser(commande, args) {
  const dossier = mkdtempSync(join(tmpdir(), 'wfrp-sortie-'))
  const journal = join(dossier, 'sortie.log')
  const fd = openSync(journal, 'a')
  const clore = () => {
    closeSync(fd)
    rmSync(dossier, { recursive: true, force: true })
  }
  const bilan = (r) => {
    const lignes = stripVTControlCharacters(readFileSync(journal, 'utf8')).split('\n')
    const cause = r.error ? r.error.message : r.signal ? `tué par ${r.signal}` : r.status !== 0 ? `code de sortie ${r.status}` : null
    return { lignes, echec: cause ? [`${basename(commande)} ${args.join(' ')} : ${cause}\n${lignes.slice(-FIN_DE_SORTIE).join('\n')}`] : [] }
  }
  return { fd, bilan, clore }
}

/** L'échéance d'un lancement attendu, ou mené de front avec d'autres. */
const ECHEANCE_MS = 600_000

/** `commande` (l'éditeur, un exécutable du projet, ou l'écran virtuel qui les porte) lancée sur `args`, attendue : les
 *  lignes de sa sortie et son échec (`journaliser`). */
function lancer(commande, args) {
  const { fd, bilan, clore } = journaliser(commande, args)
  try {
    return bilan(spawnSync(commande, args, { stdio: ['ignore', fd, fd], timeout: ECHEANCE_MS }))
  } finally {
    clore()
  }
}

/** `commande` lancée sur `args` sans tenir le fil, `env` ajouté à son environnement : `lance(tuer)` appelé une fois
 *  lancée, `tuer()` la tuant, puis, à sa sortie, les lignes de sa sortie et son échec (`journaliser`). */
async function lancerSansTenirLeFil(commande, args, env, lance) {
  const { fd, bilan, clore } = journaliser(commande, args)
  try {
    const enfant = spawn(commande, args, { stdio: ['ignore', fd, fd], env: { ...process.env, ...env } })
    enfant.once('spawn', () => lance(() => enfant.kill()))
    const [status, signal] = await once(enfant, 'exit')
    return bilan({ status, signal })
  } catch (error) {
    return bilan({ error })
  } finally {
    clore()
  }
}

/** L'éditeur `binaire` sans écran sur le projet `projet` : sa sortie et ses erreurs, son échec compris. */
function godot(binaire, projet, args) {
  const { lignes, echec } = lancer(binaire, ['--headless', '--path', projet, ...args])
  return { lignes, erreurs: [...erreursDe(lignes), ...echec] }
}

/** La variable d'environnement d'où Godot tire le dossier des données de l'utilisateur (`user://`) sous Linux
 *  (`OS_Unix::get_data_path`). Un lancement mené de front y reçoit SON dossier ; là où elle manque, les lancements
 *  partagent `user://` et se jouent à la suite (`menerDeFront`). */
const DONNEES_DE_L_UTILISATEUR = process.platform === 'linux' ? 'XDG_DATA_HOME' : null

/** Les lancements de Godot que cette machine mène de front quand chacun tient `coeurs` cœurs : autant qu'elle a de fois
 *  `coeurs` cœurs (au moins un) là où chacun a ses données d'utilisateur (`DONNEES_DE_L_UTILISATEUR`), un seul ailleurs. */
const lancementsDeFront = (coeurs) => (DONNEES_DE_L_UTILISATEUR ? Math.max(1, Math.floor(availableParallelism() / coeurs)) : 1)

/** Chaque lancement de `lancements` (`{ commande, args(donnees), juger({ lignes, echec }) }`) mené de front
 *  (`enFileBornee`), autant que la machine a de fois `coeurs` cœurs, ce qu'un lancement en tient (au moins un, #3950),
 *  là où chacun a ses données d'utilisateur (`DONNEES_DE_L_UTILISATEUR`), à la suite ailleurs : chacun reçoit un
 *  dossier `donnees` neuf sous le projet `copie`, s'arrête à `ECHEANCE_MS`, et `juger` rend ses erreurs à sa sortie.
 *  Rend les erreurs de tous. */
async function menerDeFront(copie, lancements, coeurs = 1) {
  const erreurs = await enFileBornee(lancements.map((lancement) => (signal) => lancerAvecSesDonnees(copie, lancement, signal)), { deFront: lancementsDeFront(coeurs) })
  return erreurs.flat()
}

/** Le lancement `{ commande, args(donnees), juger({ lignes, echec }) }` sans tenir le fil, un dossier `donnees` neuf
 *  sous le projet `copie` pour ses données d'utilisateur (`DONNEES_DE_L_UTILISATEUR`), `env` ajouté à son
 *  environnement, tué à `signal` ou à `ECHEANCE_MS` : les erreurs que `juger` rend à sa sortie. */
async function lancerAvecSesDonnees(copie, { commande, args, juger }, signal, env = {}) {
  const donnees = mkdtempSync(join(copie, 'donnees-'))
  const arret = AbortSignal.any([signal, AbortSignal.timeout(ECHEANCE_MS)])
  return juger(await lancerSansTenirLeFil(
    commande, args(donnees), { ...env, ...(DONNEES_DE_L_UTILISATEUR ? { [DONNEES_DE_L_UTILISATEUR]: donnees } : {}) },
    (tuer) => arret.addEventListener('abort', tuer, { once: true }),
  ))
}

/** Les arguments du pont d'une recette lancée avec ses données `donnees` (`menerDeFront`) : `--pont=<VIVANT>`, que la
 *  copie ne porte pas sous `res://../vivant.mjs`, et `--stockage=<fichier à elle>`, pour qu'aucune ne touche aux
 *  sauvegardes de l'utilisateur ni à celles d'une autre. */
const argumentsDuPont = (donnees) => ['--', `--pont=${VIVANT}`, `--stockage=${join(donnees, 'stockage.json')}`]

/** Chaque recette de `recettes` jouée par l'éditeur `binaire` sans écran sur le projet importé `copie`, menées de
 *  front (`menerDeFront`), avec les arguments du pont (`argumentsDuPont`). Sa sortie s'imprime à sa fin, d'un bloc ;
 *  rend les erreurs de toutes. */
function jouerLesRecettes(binaire, copie, recettes) {
  return menerDeFront(copie, recettes.map((recette) => ({
    commande: binaire,
    args: (donnees) => ['--headless', '--path', copie, '--script', recette, ...argumentsDuPont(donnees)],
    juger: ({ lignes, echec }) => {
      console.log(`[godot] recette autonome : ${recette}\n${lignes.join('\n')}`)
      return [...erreursDe(lignes), ...echec]
    },
  })))
}

/** Les recettes de la coop à deux processus (`coop`), l'hôte puis l'invité. */
const RECETTES_DE_LA_COOP = ['res://recettes/coop-hote.gd', 'res://recettes/coop-invite.gd']

/** L'attente la plus longue du relay local, de son lancement à sa première room. */
const ATTENTE_DU_RELAY_MS = 120_000

/** Un port de la boucle locale libre à l'instant. */
async function unPortLibre() {
  const serveur = createServer().listen(0, '127.0.0.1')
  await once(serveur, 'listening')
  const { port } = serveur.address()
  serveur.close()
  return port
}

/** Le relay local de la coop (`npm run relay:dev`, `server/`), sur un port libre de la boucle locale, son état dans un
 *  dossier temporaire, sans télémétrie : son `url` une fois que `POST /rooms` y rend une room, ou les `erreurs` de son
 *  lancement ; `arreter()` tue tout son groupe de processus (npm, wrangler, workerd), efface son état et rend les
 *  erreurs de son arrêt, dont un processus qui lui survit. */
async function leRelayLocal() {
  const port = await unPortLibre()
  const etat = mkdtempSync(join(tmpdir(), 'wfrp-relay-'))
  const args = ['run', 'relay:dev', '--', '--', '--port', String(port), '--ip', '127.0.0.1', '--persist-to', etat]
  const { fd, bilan, clore } = journaliser('npm', args)
  const relay = spawn('npm', args, { cwd: RACINE, detached: true, stdio: ['ignore', fd, fd], env: { ...process.env, WRANGLER_SEND_METRICS: 'false' } })
  const sortie = once(relay, 'exit')
  let fini = null
  void sortie.then(([status, signal]) => { fini = { status, signal } })
  const groupeVivant = () => estGroupeVivant(relay.pid)
  const arreter = async () => {
    if (groupeVivant()) process.kill(-relay.pid, 'SIGTERM')
    await sortie
    const limite = Date.now() + 5_000
    while (groupeVivant() && Date.now() < limite) await new Promise((r) => setTimeout(r, 50))
    const survivants = groupeVivant()
    if (survivants) process.kill(-relay.pid, 'SIGKILL')
    clore()
    rmSync(etat, { recursive: true, force: true })
    return survivants ? [`le relay local laisse des processus après son arrêt (groupe ${relay.pid})`] : []
  }
  const url = `http://127.0.0.1:${port}`
  const debut = performance.now()
  while (fini === null && performance.now() - debut < ATTENTE_DU_RELAY_MS) {
    const room = await fetch(`${url}/rooms`, { method: 'POST' }).then((r) => r.ok, () => false)
    if (room) {
      console.log(`[godot] relay local sur ${url}, prêt en ${Math.round(performance.now() - debut)} ms`)
      return { url, erreurs: [], arreter }
    }
    await new Promise((r) => setTimeout(r, 250))
  }
  const { lignes } = bilan({ status: fini?.status ?? null, signal: fini?.signal ?? null })
  return { url, erreurs: [`le relay local (npm ${args.join(' ')}) ne rend aucune room en ${ATTENTE_DU_RELAY_MS} ms${fini ? `, sorti (${fini.signal ?? fini.status})` : ''} :\n${lignes.slice(-FIN_DE_SORTIE).join('\n')}`], arreter }
}

/** La coop à deux processus Godot (#3009) : le projet importé par l'éditeur `binaire` sur une copie, le relay local
 *  lancé (`leRelayLocal`), puis les deux recettes de `RECETTES_DE_LA_COOP` lancées ensemble, sans écran, chacune avec
 *  les arguments du pont (`argumentsDuPont`), ses données d'utilisateur à elle (`lancerAvecSesDonnees`), le relay en
 *  `VITE_RELAY_URL` et, en `--echange=<dossier>`, le dossier qu'elles partagent pour s'y passer le code de la room.
 *  Le relay est arrêté à la fin, quoi qu'il arrive. Refusée là où les lancements partagent `user://`
 *  (`DONNEES_DE_L_UTILISATEUR`). Rend les erreurs des deux recettes et du relay. */
function coop(binaire, { figerLesDessins }) {
  if (!DONNEES_DE_L_UTILISATEUR) return [`--coop : ${process.platform} ne sépare pas les données d'utilisateur de deux lancements de Godot (Linux seul)`]
  return surUneCopie(binaire, figerLesDessins, async (copie) => {
    const relay = await leRelayLocal()
    const erreurs = [...relay.erreurs]
    try {
      if (erreurs.length) return erreurs
      const echange = mkdtempSync(join(copie, 'echange-'))
      const debut = performance.now()
      const jouees = await Promise.all(RECETTES_DE_LA_COOP.map((recette) => lancerAvecSesDonnees(copie, {
        commande: binaire,
        args: (donnees) => ['--headless', '--path', copie, '--script', recette, ...argumentsDuPont(donnees), `--echange=${echange}`],
        juger: ({ lignes, echec }) => {
          console.log(`[godot] recette de la coop : ${recette}\n${lignes.join('\n')}`)
          return [...erreursDe(lignes), ...echec]
        },
      }, AbortSignal.timeout(ECHEANCE_MS), { VITE_RELAY_URL: relay.url })))
      erreurs.push(...jouees.flat())
      if (!erreurs.length) console.log(`[godot] coop à deux processus jouée en ${Math.round(performance.now() - debut)} ms`)
      return erreurs
    } finally {
      erreurs.push(...await relay.arreter())
    }
  })
}

/** `ms` millisecondes en secondes, au dixième, à la française. */
const secondes = (ms) => (ms / 1000).toLocaleString('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })

/** L'étape `etape` du démarrage écrite au journal à la durée `ms` (`[démarrage] <etape> : <s> s`). */
export const direLEtape = (etape, ms) => console.log(`[démarrage] ${etape} : ${secondes(ms)} s`)

/** `faire()` attendu, sa durée écrite au journal (`direLEtape`) : ce qu'il rend. */
export async function chronometrer(etape, faire) {
  const debut = performance.now()
  try {
    return await faire()
  } finally {
    direLEtape(etape, performance.now() - debut)
  }
}

/** Le catalogue des dessins (`figerLesDessins`) déposé sous `art/dessins.json` du projet `projet`, que lit `projet/scripts/dessin.gd`. */
function deposerLesDessins(projet, figerLesDessins) {
  writeFileSync(join(projet, 'art', 'dessins.json'), JSON.stringify(figerLesDessins()))
}

/** Les fichiers de `dossier`, hors de tout dossier `.godot` : par chemin relatif, leur signature `taille:date`. */
export function signaturesDu(dossier, sous = dossier, signatures = {}) {
  for (const nom of listerDossier(sous)) {
    const chemin = join(sous, nom)
    const etat = statSync(chemin)
    if (etat.isDirectory()) {
      if (nom !== '.godot') signaturesDu(dossier, chemin, signatures)
    } else if (etat.isFile()) signatures[relative(dossier, chemin)] = `${etat.size}:${etat.mtimeMs}`
  }
  return signatures
}

/** Ce que la copie, mise à jour aux signatures `avant`, reçoit pour l'être aux signatures `apres` (`signaturesDu`) :
 *  les fichiers neufs ou de signature changée à copier, ceux qui ont quitté le projet à retirer. Ce que Godot écrit
 *  dans la copie (`.godot`, ses `.import` et `.uid`) n'est dans aucune des deux et n'y est pas touché. */
export function ecartsDeLaCopie(avant, apres) {
  return {
    copier: Object.keys(apres).filter((rel) => avant[rel] !== apres[rel]),
    retirer: Object.keys(avant).filter((rel) => !Object.hasOwn(apres, rel)),
  }
}

/** La copie importée du projet de cet arbre, hors de l'arbre et hors de `CACHE`, que la CI garde entre ses jobs
 *  (`.github/actions/caches-3d`) : une par version de l'éditeur, son `.godot` gardé d'un lancement à l'autre, l'import
 *  n'y retraite que ce qui a changé. Son marqueur porte les signatures du projet (`signaturesDu`) au dernier import
 *  réussi ; son verrou la garde des lancements menés de front. */
const COPIE_IMPORTEE = join(homedir(), '.cache', 'wfrp-godot-copies', EDITEUR.version, createHash('sha256').update(PROJET).digest('hex').slice(0, 16))
const MARQUEUR_DE_LA_COPIE = `${COPIE_IMPORTEE}.json`
const VERROU_DE_LA_COPIE = `${COPIE_IMPORTEE}.verrou`

/** La copie importée (`COPIE_IMPORTEE`) mise au projet et au catalogue des dessins (`deposerLesDessins`), puis importée
 *  par `binaire` si l'un ou l'autre a changé depuis le dernier import réussi : les erreurs de l'import. */
async function mettreAJourLaCopie(binaire, figerLesDessins) {
  const apres = signaturesDu(PROJET)
  const marque = existsSync(MARQUEUR_DE_LA_COPIE) ? JSON.parse(readFileSync(MARQUEUR_DE_LA_COPIE, 'utf8')) : null
  const { copier, retirer } = ecartsDeLaCopie(existsSync(COPIE_IMPORTEE) && marque ? marque.fichiers : {}, apres)
  await chronometrer(`copie importée mise à jour (${copier.length} fichier(s) copiés, ${retirer.length} retirés)`, () => {
    for (const rel of retirer) rmSync(join(COPIE_IMPORTEE, rel), { force: true })
    for (const rel of copier) cpSync(join(PROJET, rel), join(COPIE_IMPORTEE, rel), { preserveTimestamps: true })
  })
  const dessins = join(COPIE_IMPORTEE, 'art', 'dessins.json')
  const avantLesDessins = existsSync(dessins) ? readFileSync(dessins, 'utf8') : null
  await chronometrer('catalogue des dessins', () => deposerLesDessins(COPIE_IMPORTEE, figerLesDessins))
  if (marque && !copier.length && !retirer.length && readFileSync(dessins, 'utf8') === avantLesDessins) return []
  const { erreurs } = await chronometrer('import Godot', () => godot(binaire, COPIE_IMPORTEE, ['--import']))
  if (!erreurs.length) ecrireTexteAtomique(MARQUEUR_DE_LA_COPIE, JSON.stringify({ fichiers: apres }))
  return erreurs
}

/** Joue `faire(copie)` sur une copie jetable, sous le dossier temporaire, de la copie importée du projet
 *  (`mettreAJourLaCopie`), son `.godot` compris et ses dates gardées : l'arbre n'en reçoit rien, et ce que `faire`
 *  écrit dans sa copie ne revient pas à la copie importée. Rend ses erreurs. */
async function surUneCopie(binaire, figerLesDessins, faire) {
  const copie = mkdtempSync(join(tmpdir(), 'wfrp-godot-'))
  try {
    const verrou = await prendreVerrouAsync({ chemin: VERROU_DE_LA_COPIE, libelle: 'copie importée du projet Godot', attente: { echeanceMs: ECHEANCE_MS, pasMs: 500 } })
    if (verrou.etat !== 'pris') return [verrou.message]
    let erreurs
    try {
      mkdirSync(COPIE_IMPORTEE, { recursive: true })
      erreurs = await mettreAJourLaCopie(binaire, figerLesDessins)
      if (!erreurs.length) await chronometrer('copie jetable de la copie importée', () => cpSync(COPIE_IMPORTEE, copie, { recursive: true, preserveTimestamps: true }))
    } finally {
      verrou.liberer()
    }
    return erreurs.length ? erreurs : await faire(copie)
  } finally {
    rmSync(copie, { recursive: true, force: true })
  }
}

/** La vue figée `vue` écrite sous `recettes/vues/<nom>.json` de la copie `copie`, que lit sa recette. */
function deposerLaVue(copie, nom, vue) {
  mkdirSync(join(copie, 'recettes', 'vues'), { recursive: true })
  writeFileSync(join(copie, 'recettes', 'vues', `${nom}.json`), JSON.stringify(vue))
}

/** La sonde : chaque script contrôlé et chaque recette déclarée autonome exécutée dans le projet importé, les vues de
 *  l'écran figées (`figerVuesDeLEcran`) écrites sous `recettes/vues/ecran.json` de la copie, et le véhicule de l'atelier
 *  figé sur le listage des modèles du projet (`figerLeVehicule`) sous `recettes/vues/vehicule.json`, l'atelier du
 *  repos (`figerLeRepos`) sous `recettes/vues/repos.json`, les échantillons de l'atelier figés (`figerLeDecor`) sous
 *  `recettes/vues/decor.json`, le chemin du groupe figé (`figerLeChemin`) sous `recettes/vues/chemin.json`, l'éditeur
 *  du navire figé (`figerLEditeurDuNavire`) sous `recettes/vues/editeur-navire.json` et le dégagement du combat figé
 *  (`figerLeDegagement`) sous `recettes/vues/degagement.json`, que lisent leurs recettes (`jouerLesRecettes`). */
function sonder(binaire, { DOSSIER_DES_MODELES, figerVuesDeLEcran, figerLeVehicule, figerLeRepos, figerLeDecor, figerLeChemin, figerLEditeurDuNavire, figerLeDegagement, figerLesDessins }) {
  return surUneCopie(binaire, figerLesDessins, async (copie) => {
    deposerLaVue(copie, 'ecran', figerVuesDeLEcran())
    const modeles = listage(DOSSIER_DES_MODELES)
    deposerLaVue(copie, 'vehicule', figerLeVehicule(modeles))
    deposerLaVue(copie, 'repos', figerLeRepos(modeles))
    deposerLaVue(copie, 'decor', figerLeDecor(modeles))
    deposerLaVue(copie, 'chemin', figerLeChemin(modeles))
    deposerLaVue(copie, 'editeur-navire', figerLEditeurDuNavire(modeles))
    deposerLaVue(copie, 'degagement', figerLeDegagement(modeles))
    const scripts = scriptsDe(copie)
    if (!scripts.length) return [`aucun script sous ${PROJET}`]
    const erreurs = await menerDeFront(copie, scripts.map((script) => ({
      commande: binaire,
      args: () => ['--headless', '--path', copie, '--check-only', '--script', script],
      juger: ({ lignes, echec }) => [...erreursDe(lignes), ...echec],
    })))
    if (erreurs.length) return erreurs
    console.log(`[godot] ${VERSION_IMPRIMEE} : projet importé, ${scripts.length} scripts contrôlés (${scripts.join(', ')})`)
    const recettes = scripts.filter((script) => script.startsWith('res://recettes/') &&
      /^const RECETTE_AUTONOME := true\s*$/m.test(readFileSync(join(copie, script.slice('res://'.length)), 'utf8')))
    erreurs.push(...await jouerLesRecettes(binaire, copie, recettes))
    if (!erreurs.length) console.log(`[godot] ${recettes.length} recette(s) autonome(s) exécutée(s)`)
    return erreurs
  })
}

/** Les deux rendus du projet (`rendering/renderer/rendering_method` de `projet/project.godot`) : celui de l'hôte hors
 *  d'une page, et celui de la page. */
const RENDUS = ['forward_plus', 'gl_compatibility']

/** L'écran virtuel de `largeur` × `hauteur` qui porte un rendu réel là où aucun écran n'est ouvert (la CI, un
 *  conteneur). */
const ecranVirtuel = ({ largeur, hauteur }) => process.platform === 'linux' && !process.env.DISPLAY ? ['xvfb-run', '-a', '-s', `-screen 0 ${largeur}x${hauteur}x24`] : []
/** L'écran virtuel des recettes rendues (`rendre`), à la vue de base du projet. */
const ECRAN_VIRTUEL = ecranVirtuel(VUE_DE_BASE)

/** Les cœurs que tient une recette rendue : son moteur en rendu réel et son pont (#3950). */
const COEURS_D_UNE_RECETTE_RENDUE = 2

/** Les jeux pilotés (`piloter`) que cette machine mène de front : chacun tient les cœurs d'une recette rendue, son
 *  moteur et le processus de son parcours, qui sert son pont (#3412). */
export const jeuxPilotesDeFront = () => lancementsDeFront(COEURS_D_UNE_RECETTE_RENDUE)

/** Le projet importé par l'éditeur `binaire`, les échantillons de l'atelier figés (`figerLeDecor`) sous
 *  `recettes/vues/decor.json` de la copie, que lit `aretes-en-instances.gd`, puis chaque recette déclarant
 *  `const RECETTE_RENDUE := true` jouée en
 *  rendu réel sous chacun des `RENDUS` (#3951), sur un écran (`ECRAN_VIRTUEL` sans lui), menées de front
 *  (`menerDeFront`), chacune tenant `COEURS_D_UNE_RECETTE_RENDUE` cœurs, avec les arguments du pont (`argumentsDuPont`). Une recette rendue dit son rendu (`rendu=<méthode>`) : un rendu demandé que la machine ne tient
 *  pas, et que Godot remplace, est une erreur. Son verdict est son code de sortie et ce qu'elle écrit jusqu'à sa ligne
 *  de clôture (`erreurs=<n>`) ; ce que le moteur écrit ensuite en se fermant n'en est pas. */
function rendre(binaire, { DOSSIER_DES_MODELES, figerLeDecor, figerLesDessins }) {
  return surUneCopie(binaire, figerLesDessins, async (copie) => {
    deposerLaVue(copie, 'decor', figerLeDecor(listage(DOSSIER_DES_MODELES)))
    const recettes = scriptsDe(copie).filter((script) => script.startsWith('res://recettes/') &&
      /^const RECETTE_RENDUE := true\s*$/m.test(readFileSync(join(copie, script.slice('res://'.length)), 'utf8')))
    if (!recettes.length) return [`aucune recette rendue sous ${PROJET}`]
    const [commande, ...prefixe] = [...ECRAN_VIRTUEL, binaire]
    const erreurs = await menerDeFront(copie, recettes.flatMap((recette) => RENDUS.map((rendu) => ({
      commande,
      args: (donnees) => [...prefixe, '--path', copie, '--rendering-method', rendu, '--audio-driver', 'Dummy', '--script', recette, ...argumentsDuPont(donnees)],
      juger: ({ lignes, echec }) => {
        console.log(`[godot] recette rendue sous ${rendu} : ${recette}\n${lignes.join('\n')}`)
        const cloture = lignes.findLastIndex((l) => /\] erreurs=\d+$/.test(l.trim()))
        return [
          ...erreursDe(lignes.slice(0, cloture + 1)),
          ...echec,
          ...(cloture < 0 ? [`${recette} sous ${rendu} : aucune ligne de clôture (erreurs=<n>)`] : []),
          ...(lignes.some((l) => l.includes(` rendu=${rendu}`)) ? [] : [`${recette} : le rendu ${rendu} demandé n'est pas celui qui a rendu`]),
        ]
      },
    }))), COEURS_D_UNE_RECETTE_RENDUE)
    if (!erreurs.length) console.log(`[godot] ${recettes.length} recette(s) rendue(s) sous ${RENDUS.join(' et ')}`)
    return erreurs
  })
}

/** Le pilote d'une recette native (`projet/recettes/pilote.gd`), et la ligne qu'il écrit avant de quitter. */
const PILOTE = 'res://recettes/pilote.gd'
const FIN_DU_PILOTE = '[pilote] fin'

/** Les planches figées (`figerLesPlanches`) sur les modèles du projet, déposées sous `planches/` de `sortie`
 *  (`deposerLesPlanches`), les assets `a` chargés (`deposerLesAssets`). */
const deposerLesPlanchesFigees = (sortie, a) => chronometrer('planches figées', () => deposerLesPlanches(sortie, a.figerLesPlanches(listage(a.DOSSIER_DES_MODELES))))

/** Le jeu piloté par une recette (#3945) : le projet importé sur une copie par l'éditeur épinglé (`surUneCopie`), puis
 *  `PILOTE` en boucle principale, à la fenêtre `fenetre`, `{ largeur, hauteur }` (ses paramètres `largeur` et
 *  `hauteur`), `args` passés au jeu après `--` et `env` ajouté à son environnement, avec ses
 *  données d'utilisateur (`DONNEES_DE_L_UTILISATEUR`) sous la copie, que ses relances gardent, sans tenir le
 *  fil ; sans écran, ou, avec `rendu`, en rendu réel sous cette méthode, sur un écran (`ecranVirtuel` de la taille de
 *  `fenetre` sans lui).
 *  `lance(tuer)` est appelé une fois le jeu lancé, `tuer()` le tuant ; à sa sortie, il est relancé sur la même copie
 *  tant que `encore()` le demande. Rend les lignes de chaque sortie jusqu'à `FIN_DU_PILOTE` (ce que le moteur écrit
 *  ensuite en se fermant n'en est pas), et ses erreurs : celles de ces lignes, et ses échecs. Avec `planches`, les
 *  planches figées y sont déposées avant le lancement (`deposerLesPlanchesFigees`). */
export async function piloter({ args, env, rendu, lance, encore, planches, fenetre }) {
  const a = await deposerLesAssets()
  if (planches) await deposerLesPlanchesFigees(planches, a)
  const binaire = await chronometrer('éditeur Godot', editeur)
  const lignes = []
  const erreurs = await surUneCopie(binaire, a.figerLesDessins, async (copie) => {
    const [commande, ...prefixe] = rendu ? [...ecranVirtuel(fenetre), binaire, '--rendering-method', rendu, '--audio-driver', 'Dummy'] : [binaire, '--headless']
    const erreurs = []
    const donnees = DONNEES_DE_L_UTILISATEUR ? { [DONNEES_DE_L_UTILISATEUR]: mkdtempSync(join(copie, 'donnees-')) } : {}
    do {
      const taille = [`--largeur=${fenetre.largeur}`, `--hauteur=${fenetre.hauteur}`]
      const joue = await lancerSansTenirLeFil(commande, [...prefixe, '--path', copie, '--script', PILOTE, '--', ...taille, ...args], { ...env, ...donnees }, lance)
      const fin = joue.lignes.findLastIndex((l) => l.trim() === FIN_DU_PILOTE)
      const jouees = fin < 0 ? joue.lignes : joue.lignes.slice(0, fin)
      lignes.push(...jouees)
      erreurs.push(...erreursDe(jouees), ...joue.echec)
    } while (encore())
    return erreurs
  })
  return { lignes, erreurs }
}

/** La fabrique des modèles du projet (`projet/outils/fabrique_de_modeles.gd`), et la commande que `fabriquer` lui écrit. */
const FABRIQUE = 'res://outils/fabrique_de_modeles.gd'
const COMMANDE = 'fabrique.json'

/** La scène de chaque modèle de `modeles` (`{ id, glb, scene }`, `deposerLesModeles`) fabriquée de son GLB par
 *  l'éditeur sur la copie importée `copie`, qui reçoit la commande. */
function fabriquer(binaire, copie, modeles) {
  const commande = join(copie, COMMANDE)
  writeFileSync(commande, JSON.stringify(modeles))
  const { erreurs } = godot(binaire, copie, ['--script', FABRIQUE, '--', commande])
  if (!erreurs.length) console.log(`[godot] ${modeles.length} modèles fabriqués en scène`)
  return erreurs
}

/** Le script du projet qui écrit ce que le moteur rend de ses licences (`avisDeGodot`). */
const AVIS_DU_MOTEUR = 'res://outils/avis_du_moteur.gd'

/** L'export en release du préréglage `preset` du projet vers `fichier` de `sortie`, sur le modèle `modele` : le
 *  préréglage de la copie le reçoit par `custom_template/release` ; chaque dossier de `paquets` exclu de l'export,
 *  exporté à côté en paquet `<dossier>.pck` par `PRESET_DES_PAQUETS`, et leur liste écrite dans `PAQUETS` ; puis, à
 *  côté, le dossier des modèles
 *  `DOSSIER_DES_MODELES` déposé, ses scènes fabriquées sur la même copie, et les avis de licence de ce que l'export
 *  embarque (`deposerLesAvis`) : ceux du moteur, des assets du projet, et `embarques`, ceux de ce que la fabrication
 *  ajoute à côté. */
function exporter(binaire, { preset, fichier, modele, paquets = [] }, sortie, { DOSSIER_DES_MODELES, figerLesDessins }, embarques) {
  return surUneCopie(binaire, figerLesDessins, (copie) => {
    const release = { 'custom_template/release': () => modele.split(sep).join('/') }
    const exclus = paquets.length ? { exclude_filter: (avant) => [avant, ...paquets.map((dossier) => `${dossier}/*`)].join(',') } : {}
    const refus = reglerLePreset(copie, preset, { ...release, ...exclus })
    if (refus) return [refus]
    const { erreurs } = godot(binaire, copie, ['--export-release', preset, join(sortie, fichier)])
    if (erreurs.length) return erreurs
    for (const dossier of paquets) {
      const refusDuPaquet = reglerLePreset(copie, PRESET_DES_PAQUETS, { ...release, include_filter: () => `${dossier}/*` })
      if (refusDuPaquet) return [refusDuPaquet]
      const paquet = godot(binaire, copie, ['--export-pack', PRESET_DES_PAQUETS, join(sortie, `${dossier}.pck`)])
      if (paquet.erreurs.length) return paquet.erreurs
    }
    if (paquets.length) writeFileSync(join(sortie, PAQUETS), JSON.stringify(paquets))
    const fabrication = deposerLesModeles(DOSSIER_DES_MODELES, sortie, (modeles) => fabriquer(binaire, copie, modeles))
    if (fabrication.length) return fabrication
    const moteur = join(copie, 'avis-du-moteur.json')
    const lancement = godot(binaire, copie, ['--script', AVIS_DU_MOTEUR, '--', moteur])
    if (lancement.erreurs.length) return lancement.erreurs
    return deposerLesAvis(sortie, [avisDeGodot(existsSync(moteur) ? JSON.parse(readFileSync(moteur, 'utf8')) : null), ...avisDesAssets(copie), ...embarques])
  })
}

const octets = (n) => `${n.toLocaleString('fr-FR')} o`

/** Le bundle bâti, mesuré, puis exécuté : son `statut`, 0, ou 1 s'il ne tient pas son contrat, et les ids des modules
 *  qu'il porte. */
async function pont(sortie) {
  const debut = performance.now()
  const { code, modules } = await empaqueter(sortie, 'production')
  const brut = Buffer.byteLength(code)
  console.log(`[pont] ${PONT} : ${octets(brut)} brut, ${octets(gzipSync(code).length)} gzip, bâti en ${Math.round(performance.now() - debut)} ms${sortie ? `, écrit dans ${sortie}` : ''}`)
  const ecarts = executer(code)
  if (ecarts.length) {
    console.error(`[pont] le bundle lu et exécuté (API : ${API_DU_NAVIGATEUR.join(', ')}) ne tient pas son contrat :\n  ${ecarts.join('\n  ')}`)
    return { statut: 1, modules }
  }
  console.log(`[pont] lu : chaque nom de navigateur lu est porté (API : ${API_DU_NAVIGATEUR.join(', ')}) ou compté hors du processus (${Object.entries(HORS_DU_PROCESSUS).map(([nom, { lectures }]) => `${nom} ${lectures}`).join(', ')})`)
  console.log(`[pont] exécuté : demarrer ${SCENARIO}, vue, sauvegardes et salon ok, second demarrer refusé, erreursGlobales vide`)
  return { statut: 0, modules }
}

/** Les erreurs de Godot dites, et le code de sortie qu'elles valent. */
function verdict(erreurs) {
  if (!erreurs.length) return 0
  console.error(`[godot] ${erreurs.length} erreur(s) :\n  ${erreurs.join('\n  ')}`)
  return 1
}

/** Les GLB, les textures et les sons du projet déposés (`recupererModeles`, `recupererEpingles`) avant d'ouvrir Godot : rend les assets. */
async function deposerLesAssets() {
  const a = await chronometrer('assets chargés (Vite)', assetsDeLHote)
  await chronometrer('modèles vérifiés', () => a.recupererModeles({ dossier: a.DOSSIER_DES_MODELES }))
  await chronometrer('textures et sons vérifiés', () => a.recupererEpingles({}))
  return a
}

/** L'éditeur `binaire` ouvert sur le projet en place, entrées et sorties héritées : son code de sortie. */
function ouvrir(binaire) {
  const r = spawnSync(binaire, ['--editor', '--path', PROJET], { stdio: 'inherit' })
  if (r.error) throw r.error
  return r.status ?? 1
}

/** La recette que l'exécutable de bureau joue pour s'éprouver : la classe de `projet/recettes/partie-vivante.gd`. */
const RECETTE_DE_L_EXECUTABLE = 'PartieVivante'

/** `executable`, l'exécutable de bureau exporté, lancé sans écran avec `RECETTE_DE_L_EXECUTABLE` pour boucle principale
 *  (`application/run/main_loop_type` d'un `override.cfg` posé à côté de lui le temps du lancement, un modèle d'export
 *  ignorant `--script`) : sur son noyau embarqué, il joue une partie, son stockage dans un dossier temporaire
 *  (`--stockage=`), jamais celui du joueur sous `user://`. Rend ses erreurs. */
function jouerLExecutable(executable) {
  const surcharge = join(dirname(executable), 'override.cfg')
  const dossier = mkdtempSync(join(tmpdir(), 'wfrp-stockage-'))
  writeFileSync(surcharge, `[application]\n\nrun/main_loop_type=${JSON.stringify(RECETTE_DE_L_EXECUTABLE)}\n`)
  try {
    const { lignes, echec } = lancer(executable, ['--headless', '--', `--stockage=${join(dossier, 'stockage.json')}`])
    console.log(lignes.join('\n'))
    return [...erreursDe(lignes), ...echec]
  } finally {
    rmSync(surcharge)
    rmSync(dossier, { recursive: true, force: true })
  }
}

/** L'exécutable de bureau de cette plateforme dans `sortie` (#3951) : sous `NOYAU`, le bundle du pont, le point d'entrée
 *  embarqué (`empaqueterLeProcessus`) et le Node qui joue cet export ; l'export de son préréglage (`BUREAU`) sur son
 *  modèle épinglé, les modèles déposés à côté, et les avis de licence (#4063), ceux des paquets npm des deux bundles et
 *  de Node compris ; puis la partie vivante jouée par l'exécutable (`jouerLExecutable`). Son code de sortie : 0, ou 1
 *  à la première étape qui échoue. */
async function bureau(sortie) {
  const plateforme = BUREAU[process.platform]
  if (!plateforme) throw new Error(`aucun préréglage de bureau pour ${process.platform} (${Object.keys(BUREAU).join(', ')})`)
  const noyau = join(sortie, NOYAU)
  mkdirSync(noyau, { recursive: true })
  const bundle = await pont(noyau)
  if (bundle.statut) return bundle.statut
  const processus = await empaqueterLeProcessus(noyau)
  cpSync(process.execPath, join(noyau, plateforme.node))
  const embarques = [...avisDesPaquets([...bundle.modules, ...processus.modules]), avisDeNode(process.execPath, plateforme.licenceDeNode, process.version)]
  const a = await deposerLesAssets()
  const exporte = verdict(await exporter(await editeur(), { preset: plateforme.preset, fichier: plateforme.executable, modele: await modeleDExport(plateforme.modele) }, sortie, a, embarques))
  if (exporte) return exporte
  const joue = verdict(jouerLExecutable(join(sortie, plateforme.executable)))
  if (joue) return joue
  console.log(`[godot] exécutable de bureau : ${join(sortie, plateforme.executable)}, partie vivante jouée sur son noyau embarqué`)
  return 0
}

async function principal() {
  const { options, erreur } = lireOptions(process.argv.slice(2))
  if (erreur) {
    console.error(`${erreur}\n${USAGE}`)
    return 2
  }
  if (options.mode === 'pont') return (await pont(options.sortie)).statut
  if (options.mode === 'sonde') {
    const a = await deposerLesAssets()
    return verdict(await sonder(await editeur(), a))
  }
  if (options.mode === 'rendus') return verdict(await rendre(await editeur(), await deposerLesAssets()))
  if (options.mode === 'coop') return verdict(await coop(await editeur(), await deposerLesAssets()))
  if (options.mode === 'ouvrir') {
    deposerLesDessins(PROJET, (await deposerLesAssets()).figerLesDessins)
    return ouvrir(await editeur())
  }
  if (options.mode === 'bureau') return bureau(options.sortie)
  mkdirSync(options.sortie, { recursive: true })
  const bundle = await pont(options.sortie)
  if (bundle.statut) return bundle.statut
  const a = await deposerLesAssets()
  const modele = await modeleDExport(modeleDuPreset(readFileSync(join(PROJET, PRESETS), 'utf8')))
  const sortie = verdict(await exporter(await editeur(), { preset: 'Web', fichier: 'index.html', modele, paquets: PAQUETS_DU_WEB }, options.sortie, a, avisDesPaquets(bundle.modules)))
  if (sortie) return sortie
  await deposerLesPlanchesFigees(options.sortie, a)
  const lourds = fichiersAuDelaDeGitHub(options.sortie)
  if (lourds.length) {
    console.error(`[godot] export Web : au-delà des ${octets(LIMITE_DE_GITHUB)} qu'un fichier poussé sur GitHub tient :\n  ${lourds.map(({ fichier, taille }) => `${fichier} ${octets(taille)}`).join('\n  ')}`)
    return 1
  }
  console.log(`[godot] export Web : ${listerDossier(options.sortie).map((f) => `${f} ${octets(statSync(join(options.sortie, f)).size)}`).join(', ')}`)
  return 0
}

if (import.meta.main) process.exitCode = await principal()
