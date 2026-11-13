#!/usr/bin/env node
// LA CONSTRUCTION DE L'HÔTE GODOT (#2928) : six modes.
// `--pont-seul` bâtit le bundle du pont par `vite build` en bibliothèque, format iife, depuis l'entrée d'hôte unique
// (`entreeDHote`, `scripts/entree-d-hote.mjs` : le gel du catalogue, puis `hotes/godot/pont/entree.ts`, avec le greffon
// `proseSource()`) ; le bundle tient seul dans une page et expose `globalThis.wfrpPont` (`hotes/godot/pont/CONTRAT.md`).
// Il dit sa taille, puis l'EXÉCUTE dans un `node:vm` qui ne porte que les API de navigateur déclarées
// (`API_DU_NAVIGATEUR`) : `demarrer`, `vue` et `sauvegardes` répondent `ok: true`, un second `demarrer` `ok: false`,
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
// puis l'export Web du projet (`export_presets.cfg`) et, à côté, le dossier des modèles et son listage
// (`deposerLesModeles`, #3778), chaque modèle en scène que l'éditeur fabrique de son GLB (`fabriquer`, #3946), les avis
// de licence de ce qu'il embarque sous `licences/` (`avis.mjs`, #4063 : le moteur, les paquets npm du bundle, les
// assets du projet ; un avis qui manque fait échouer l'export), et les planches (`deposerLesPlanches`, #3935) : un site statique, que `deploy.yml` publie et que `recette.mjs` joue au navigateur, sur le modèle d'export que
// son préréglage nomme (`modeleDuPreset`) : tiré par tranches (`Range`) de l'archive des modèles publiée, vérifié par sa
// somme épinglée (`EDITEUR.modeles`), gardé sous `CACHE` (#2943), donné par `custom_template/release`. Godot ne
// travaille que sur une copie du projet sous le dossier temporaire : l'arbre n'en reçoit rien, ni les modèles d'export
// du profil Godot (`export_templates`). Avant d'ouvrir Godot, `--sonde`, `--rendus`, `--export` et `--bureau` déposent les GLB, les textures et le
// kit des arêtes du projet, tirés de la Release des modèles et vérifiés par l'empreinte de leur provenance commitée
// (`recupererModeles`, #2948 ; `recupererEpingles`, #3476), et la copie reçoit le catalogue des dessins
// (`deposerLesDessins`, #3935). `--ouvrir` dépose de même les GLB, les textures, le kit et le catalogue des dessins, ce
// dernier dans le projet en place, puis ouvre l'éditeur épinglé sur ce projet (#3945) : F5 y joue sur le noyau vivant
// (`vivant.mjs`), qui partage `empaqueter`. `--bureau --sortie <dossier>` y écrit l'exécutable de bureau de cette
// plateforme (#3951, `BUREAU`) : sous `noyau/`, le bundle, le point d'entrée embarqué empaqueté en un fichier
// (`empaqueterLeProcessus`, `embarque.mjs`) et le Node qui joue l'export ; l'export de son préréglage sur son modèle
// épinglé ; à côté, les modèles en scène et les avis de licence, Node et les paquets npm des deux bundles compris ;
// puis l'exécutable joue une partie sur son noyau embarqué
// (`jouerLExecutable`). `--rendus` joue en rendu réel, sous chacun des deux rendus du projet (`RENDUS`), les recettes
// déclarant `const RECETTE_RENDUE := true` (`rendre`) ; la CI le joue (`npm run godot:rendus`). L'import de ce module
// ne lance rien et ne charge aucun asset.
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { chmodSync, closeSync, cpSync, existsSync, mkdirSync, mkdtempSync, openSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { basename, dirname, join, relative, resolve, sep } from 'node:path'
import { stripVTControlCharacters } from 'node:util'
import { gzipSync, inflateRawSync } from 'node:zlib'
import { build } from 'vite'
import { entreeDHote } from '../../scripts/entree-d-hote.mjs'
import { listerDossier } from '../../scripts/guards/lib/lister.mjs'
import { chargerAssets } from './asset/charger.mjs'
import { avisDeGodot, avisDeNode, avisDesAssets, avisDesPaquets, deposerLesAvis } from './avis.mjs'
import { deposerLesModeles, listage } from './listage.mjs'
import { deposerLesPlanches } from './planches.mjs'
import { API_DU_NAVIGATEUR, PONT, pontDuBundle } from './processus.mjs'
import { stockageDuProcessus } from './stockage.mjs'

let assetsCharges = null
/** Les assets que `--sonde`, `--rendus`, `--export`, `--bureau` et `--ouvrir` lisent (`chargerAssets`), chargés à la première demande, jamais à l'import. */
const assets = () => (assetsCharges ??= chargerAssets([
  "export { figerLesDessins } from '/hotes/godot/asset/dessins.ts';",
  "export { figerVuesDeLEcran } from '/hotes/godot/recettes/ecran.ts';",
  "export { figerLeVehicule } from '/hotes/godot/recettes/vehicule.ts';",
  "export { figerLeRepos } from '/hotes/godot/recettes/atelier.ts';",
  "export { figerLeDecor } from '/hotes/godot/recettes/decor.ts';",
  "export { figerLeChemin } from '/hotes/godot/recettes/chemin.ts';",
  "export { figerLEditeurDuNavire } from '/hotes/godot/recettes/editeur.ts';",
  "export { figerLeDegagement } from '/hotes/godot/recettes/degagement.ts';",
  "export { recupererEpingles } from '/hotes/godot/asset/epingles.ts';",
]))

const RACINE = fileURLToPath(new URL('../..', import.meta.url))
const PROJET = join(RACINE, 'hotes', 'godot', 'projet')
/** Le pont vivant que l'hôte natif lance (`--pont=<chemin>`, `vivant.mjs`). */
const VIVANT = join(RACINE, 'hotes', 'godot', 'vivant.mjs')
const USAGE = `Usage : node hotes/godot/construire.mjs --pont-seul [--sortie <dossier>] | --sonde | --export --sortie <dossier> | --bureau --sortie <dossier> | --rendus | --ouvrir
  --pont-seul         le bundle ${PONT}, sans Godot, bâti puis exécuté
  --sonde             les GLB tirés de la Release, le projet importé, chaque script contrôlé et les recettes autonomes exécutées par l'éditeur Godot épinglé
  --export            le bundle, l'export Web du projet, ses modèles fabriqués en scène et les avis de licence de ce qu'il embarque, dans --sortie, sur le modèle d'export épinglé (téléchargé au premier appel)
  --rendus            le projet importé et les recettes rendues jouées en rendu réel sous chacun des deux rendus, Forward+ et compatibilité, par l'éditeur Godot épinglé
  --bureau            l'exécutable de bureau de cette plateforme, son noyau embarqué, ses modèles fabriqués en scène et les avis de licence de ce qu'il embarque, dans --sortie, puis la partie vivante jouée par l'exécutable
  --ouvrir            les GLB tirés de la Release et le catalogue des dessins déposés, puis l'éditeur Godot épinglé ouvert sur le projet en place, qui y joue sur le noyau vivant
  --sortie <dossier>  le dossier où les écrire (sans lui, --pont-seul n'écrit rien)
  GODOT=<binaire>     un éditeur Godot de la version épinglée, à la place du téléchargement (le modèle d'export n'en dépend pas)`

/** Les modes : l'option qui choisit chacun. */
const MODES = { '--pont-seul': 'pont', '--sonde': 'sonde', '--export': 'export', '--bureau': 'bureau', '--rendus': 'rendus', '--ouvrir': 'ouvrir' }

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
  if (['sonde', 'ouvrir', 'rendus'].includes(options.mode) && options.sortie) return { erreur: `--${options.mode} : --sortie hors de propos` }
  return { options }
}

/** Le bundle du pont : son code et les ids des modules qu'il porte (`avisDesPaquets`), écrit dans `sortie` si elle est
 *  donnée. */
export async function empaqueter(sortie) {
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
  const { code, moduleIds } = morceauDe(resultat, PONT)
  return { code, modules: moduleIds }
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

/** Exécute le bundle comme la page de Godot (`pontDuBundle`), son pont appelé. Rend la liste des écarts au contrat
 *  (`hotes/godot/pont/CONTRAT.md`), vide quand il tient. */
function executer(code) {
  let pont
  try {
    pont = pontDuBundle(code, console, stockageDuProcessus(null))
  } catch (erreur) {
    return [`l’évaluation lève : ${erreur}`]
  }
  if (typeof pont?.appeler !== 'function') return ['`globalThis.wfrpPont.appeler` absent']
  const appel = (methode, entree) => {
    const brut = pont.appeler(methode, entree === undefined ? undefined : JSON.stringify(entree))
    return typeof brut === 'string' ? JSON.parse(brut) : { ok: null, brut }
  }
  const attendus = [
    ['demarrer', { scenario: SCENARIO }, (r) => r.ok === true && r.vue?.projection != null && r.vue?.corps != null],
    ['vue', undefined, (r) => r.ok === true && r.vue?.projection != null && r.vue?.corps != null],
    ['demarrer', { scenario: SCENARIO }, (r) => r.ok === false && r.erreur?.categorie === 'validation'],
    ['sauvegardes', undefined, (r) => r.ok === true && Array.isArray(r.zones?.['sauvegardes.emplacements'])],
    ['erreursGlobales', undefined, (r) => r.ok === true && Array.isArray(r.erreurs) && r.erreurs.length === 0],
  ]
  const ecarts = attendus.flatMap(([methode, entree, tient]) => {
    const r = appel(methode, entree)
    return tient(r) ? [] : [`${methode} ${JSON.stringify(entree ?? null)} : ${JSON.stringify(r).slice(0, 400)}`]
  })
  return [...ecarts, ...ecartsDesOctets(pont, appel('monde'))]
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
 *  et vérifié par sa somme à sa première demande. */
async function editeur() {
  const { verifierSomme } = await assets()
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
  mkdirSync(CACHE, { recursive: true })
  for (const { nom, octets } of await extraire(enMemoire(zip), plateforme.entrees)) {
    writeFileSync(join(CACHE, nom), octets)
    chmodSync(join(CACHE, nom), 0o755)
  }
  return lanceur
}

/** Le préréglage d'export du projet, relatif au projet (et à sa copie). */
const PRESETS = 'export_presets.cfg'

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
  const { enCacheOuTire } = await assets()
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

/** `commande` (l'éditeur, un exécutable du projet, ou l'écran virtuel qui les porte) lancée sur `args` : les lignes de
 *  sa sortie, sans séquences de terminal, dans l'ordre où elle les écrit (sa sortie et sa sortie d'erreur vont au même
 *  fichier), et son échec, s'il y en a un : sa cause (le signal qui l'a tuée, ou son code de sortie) et la fin de sa
 *  sortie (`FIN_DE_SORTIE` lignes). */
const FIN_DE_SORTIE = 40
function lancer(commande, args) {
  const dossier = mkdtempSync(join(tmpdir(), 'wfrp-sortie-'))
  const journal = join(dossier, 'sortie.log')
  const fd = openSync(journal, 'a')
  try {
    const r = spawnSync(commande, args, { stdio: ['ignore', fd, fd], timeout: 600_000 })
    const lignes = stripVTControlCharacters(readFileSync(journal, 'utf8')).split('\n')
    const cause = r.error ? r.error.message : r.signal ? `tué par ${r.signal}` : r.status !== 0 ? `code de sortie ${r.status}` : null
    return { lignes, echec: cause ? [`${basename(commande)} ${args.join(' ')} : ${cause}\n${lignes.slice(-FIN_DE_SORTIE).join('\n')}`] : [] }
  } finally {
    closeSync(fd)
    rmSync(dossier, { recursive: true, force: true })
  }
}

/** L'éditeur `binaire` sans écran sur le projet `projet` : sa sortie et ses erreurs, son échec compris. */
function godot(binaire, projet, args) {
  const { lignes, echec } = lancer(binaire, ['--headless', '--path', projet, ...args])
  return { lignes, erreurs: [...erreursDe(lignes), ...echec] }
}

/** Le catalogue des dessins (`figerLesDessins`) déposé sous `art/dessins.json` du projet `projet`, que lit `projet/scripts/dessin.gd`. */
function deposerLesDessins(projet, figerLesDessins) {
  writeFileSync(join(projet, 'art', 'dessins.json'), JSON.stringify(figerLesDessins()))
}

/** Joue `faire(copie)` sur une copie du projet, le catalogue des dessins déposé (`deposerLesDessins`), importée par
 *  `binaire`, sous le dossier temporaire ; rend ses erreurs. */
function surUneCopie(binaire, figerLesDessins, faire) {
  const copie = mkdtempSync(join(tmpdir(), 'wfrp-godot-'))
  try {
    cpSync(PROJET, copie, { recursive: true, filter: (source) => !source.split(sep).includes('.godot') })
    deposerLesDessins(copie, figerLesDessins)
    const { erreurs } = godot(binaire, copie, ['--import'])
    return erreurs.length ? erreurs : faire(copie)
  } finally {
    rmSync(copie, { recursive: true, force: true })
  }
}

/** La sonde : chaque script contrôlé et chaque recette déclarée autonome exécutée dans le projet importé, les vues de
 *  l'écran figées (`figerVuesDeLEcran`) écrites sous `recettes/vues/ecran.json` de la copie, et le véhicule de l'atelier
 *  figé sur le listage des modèles du projet (`figerLeVehicule`) sous `recettes/vues/vehicule.json`, l'atelier du
 *  repos (`figerLeRepos`) sous `recettes/vues/repos.json`, les échantillons de l'atelier figés (`figerLeDecor`) sous
 *  `recettes/vues/decor.json`, le chemin du groupe figé (`figerLeChemin`) sous `recettes/vues/chemin.json`, l'éditeur
 *  du navire figé (`figerLEditeurDuNavire`) sous `recettes/vues/editeur-navire.json` et le dégagement du combat figé
 *  (`figerLeDegagement`) sous `recettes/vues/degagement.json`, que lisent leurs recettes ; chaque recette reçoit
 *  `--pont=<VIVANT>`, que la copie ne porte pas sous `res://../vivant.mjs`, et `--stockage=<fichier de la copie>`,
 *  pour qu'aucune ne touche aux sauvegardes de l'utilisateur. */
function sonder(binaire, { DOSSIER_DES_MODELES, figerVuesDeLEcran, figerLeVehicule, figerLeRepos, figerLeDecor, figerLeChemin, figerLEditeurDuNavire, figerLeDegagement, figerLesDessins }) {
  return surUneCopie(binaire, figerLesDessins, (copie) => {
    mkdirSync(join(copie, 'recettes', 'vues'), { recursive: true })
    writeFileSync(join(copie, 'recettes', 'vues', 'ecran.json'), JSON.stringify(figerVuesDeLEcran()))
    const modeles = listage(DOSSIER_DES_MODELES)
    writeFileSync(join(copie, 'recettes', 'vues', 'vehicule.json'), JSON.stringify(figerLeVehicule(modeles)))
    writeFileSync(join(copie, 'recettes', 'vues', 'repos.json'), JSON.stringify(figerLeRepos(modeles)))
    writeFileSync(join(copie, 'recettes', 'vues', 'decor.json'), JSON.stringify(figerLeDecor(modeles)))
    writeFileSync(join(copie, 'recettes', 'vues', 'chemin.json'), JSON.stringify(figerLeChemin(modeles)))
    writeFileSync(join(copie, 'recettes', 'vues', 'editeur-navire.json'), JSON.stringify(figerLEditeurDuNavire(modeles)))
    writeFileSync(join(copie, 'recettes', 'vues', 'degagement.json'), JSON.stringify(figerLeDegagement(modeles)))
    const scripts = scriptsDe(copie)
    if (!scripts.length) return [`aucun script sous ${PROJET}`]
    const erreurs = scripts.flatMap((script) => godot(binaire, copie, ['--check-only', '--script', script]).erreurs)
    if (erreurs.length) return erreurs
    console.log(`[godot] ${VERSION_IMPRIMEE} : projet importé, ${scripts.length} scripts contrôlés (${scripts.join(', ')})`)
    const recettes = scripts.filter((script) => script.startsWith('res://recettes/') &&
      /^const RECETTE_AUTONOME := true\s*$/m.test(readFileSync(join(copie, script.slice('res://'.length)), 'utf8')))
    for (const recette of recettes) {
      console.log(`[godot] recette autonome : ${recette}`)
      const resultat = godot(binaire, copie, ['--script', recette, '--', `--pont=${VIVANT}`, `--stockage=${join(copie, 'stockage.json')}`])
      console.log(resultat.lignes.join('\n'))
      erreurs.push(...resultat.erreurs)
    }
    if (!erreurs.length) console.log(`[godot] ${recettes.length} recette(s) autonome(s) exécutée(s)`)
    return erreurs
  })
}

/** Les deux rendus du projet (`rendering/renderer/rendering_method` de `projet/project.godot`) : celui de l'hôte hors
 *  d'une page, et celui de la page. */
const RENDUS = ['forward_plus', 'gl_compatibility']

/** L'écran virtuel qui porte un rendu réel là où aucun écran n'est ouvert (la CI, un conteneur). */
const ECRAN_VIRTUEL = process.platform === 'linux' && !process.env.DISPLAY ? ['xvfb-run', '-a', '-s', '-screen 0 1280x720x24'] : []

/** Le projet importé par l'éditeur `binaire`, puis chaque recette déclarant `const RECETTE_RENDUE := true` jouée en
 *  rendu réel sous chacun des `RENDUS` (#3951), sur un écran (`ECRAN_VIRTUEL` sans lui). Une recette rendue dit son
 *  rendu (`rendu=<méthode>`) : un rendu demandé que la machine ne tient pas, et que Godot remplace, est une erreur.
 *  Son verdict est son code de sortie et ce qu'elle écrit jusqu'à sa ligne de clôture (`erreurs=<n>`) ; ce que le
 *  moteur écrit ensuite en se fermant n'en est pas. */
function rendre(binaire, { figerLesDessins }) {
  return surUneCopie(binaire, figerLesDessins, (copie) => {
    const recettes = scriptsDe(copie).filter((script) => script.startsWith('res://recettes/') &&
      /^const RECETTE_RENDUE := true\s*$/m.test(readFileSync(join(copie, script.slice('res://'.length)), 'utf8')))
    if (!recettes.length) return [`aucune recette rendue sous ${PROJET}`]
    const [commande, ...prefixe] = [...ECRAN_VIRTUEL, binaire]
    const erreurs = []
    for (const recette of recettes) {
      for (const rendu of RENDUS) {
        console.log(`[godot] recette rendue sous ${rendu} : ${recette}`)
        const { lignes, echec } = lancer(commande, [...prefixe, '--path', copie, '--rendering-method', rendu, '--audio-driver', 'Dummy', '--script', recette])
        console.log(lignes.join('\n'))
        const cloture = lignes.findLastIndex((l) => /\] erreurs=\d+$/.test(l.trim()))
        erreurs.push(...erreursDe(lignes.slice(0, cloture + 1)), ...echec)
        if (cloture < 0) erreurs.push(`${recette} sous ${rendu} : aucune ligne de clôture (erreurs=<n>)`)
        if (!lignes.some((l) => l.includes(` rendu=${rendu}`))) erreurs.push(`${recette} : le rendu ${rendu} demandé n'est pas celui qui a rendu`)
      }
    }
    if (!erreurs.length) console.log(`[godot] ${recettes.length} recette(s) rendue(s) sous ${RENDUS.join(' et ')}`)
    return erreurs
  })
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
 *  préréglage de la copie le reçoit par `custom_template/release` ; puis, à côté, le dossier des modèles
 *  `DOSSIER_DES_MODELES` déposé, ses scènes fabriquées sur la même copie, et les avis de licence de ce que l'export
 *  embarque (`deposerLesAvis`) : ceux du moteur, des assets du projet, et `embarques`, ceux de ce que la fabrication
 *  ajoute à côté. */
function exporter(binaire, { preset, fichier, modele }, sortie, { DOSSIER_DES_MODELES, figerLesDessins }, embarques) {
  return surUneCopie(binaire, figerLesDessins, (copie) => {
    const presets = join(copie, PRESETS)
    const sections = readFileSync(presets, 'utf8').split(/^(?=\[preset\.\d+\]\r?$)/m)
    const rang = sections.findIndex((section) => new RegExp(`^name=${JSON.stringify(preset)}\\r?$`, 'm').test(section))
    const release = /^custom_template\/release=.*$/m
    if (rang < 0 || !release.test(sections[rang])) return [`${PRESETS} : préréglage ${preset} ou son custom_template/release absent`]
    sections[rang] = sections[rang].replace(release, `custom_template/release=${JSON.stringify(modele.split(sep).join('/'))}`)
    writeFileSync(presets, sections.join(''))
    const { erreurs } = godot(binaire, copie, ['--export-release', preset, join(sortie, fichier)])
    if (erreurs.length) return erreurs
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
  const { code, modules } = await empaqueter(sortie)
  const brut = Buffer.byteLength(code)
  console.log(`[pont] ${PONT} : ${octets(brut)} brut, ${octets(gzipSync(code).length)} gzip, bâti en ${Math.round(performance.now() - debut)} ms${sortie ? `, écrit dans ${sortie}` : ''}`)
  const ecarts = executer(code)
  if (ecarts.length) {
    console.error(`[pont] le bundle exécuté (API : ${API_DU_NAVIGATEUR.join(', ')}) ne tient pas son contrat :\n  ${ecarts.join('\n  ')}`)
    return { statut: 1, modules }
  }
  console.log(`[pont] exécuté (API : ${API_DU_NAVIGATEUR.join(', ')}) : demarrer ${SCENARIO}, vue et sauvegardes ok, second demarrer refusé, erreursGlobales vide`)
  return { statut: 0, modules }
}

/** Les erreurs de Godot dites, et le code de sortie qu'elles valent. */
function verdict(erreurs) {
  if (!erreurs.length) return 0
  console.error(`[godot] ${erreurs.length} erreur(s) :\n  ${erreurs.join('\n  ')}`)
  return 1
}

/** Les GLB, les textures et le kit du projet déposés (`recupererModeles`, `recupererEpingles`) avant d'ouvrir Godot : rend les assets. */
async function deposerLesAssets() {
  const a = await assets()
  await a.recupererModeles({ dossier: a.DOSSIER_DES_MODELES })
  await a.recupererEpingles({})
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
  const exporte = verdict(exporter(await editeur(), { preset: plateforme.preset, fichier: plateforme.executable, modele: await modeleDExport(plateforme.modele) }, sortie, a, embarques))
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
    return verdict(sonder(await editeur(), a))
  }
  if (options.mode === 'rendus') return verdict(rendre(await editeur(), await deposerLesAssets()))
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
  const sortie = verdict(exporter(await editeur(), { preset: 'Web', fichier: 'index.html', modele }, options.sortie, a, avisDesPaquets(bundle.modules)))
  if (sortie) return sortie
  deposerLesPlanches(options.sortie)
  console.log(`[godot] export Web : ${listerDossier(options.sortie).map((f) => `${f} ${octets(statSync(join(options.sortie, f)).size)}`).join(', ')}`)
  return 0
}

if (import.meta.main) process.exitCode = await principal()
