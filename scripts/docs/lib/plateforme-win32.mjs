// Rendu d'un générateur SOUS win32 (#1801) — module `node --import`, composé par la garde du rendu
// sous win32 (`renduSousWin32` de `plateforme-win32.test.mjs`) devant `rendre-seul.mjs`, seul : ce
// rendu se compare et ne se mesure pas, l'enregistreur de lectures n'y est pas. Il se pose AVANT
// `tsx/esm`.
//
// Ce que voit le code du dépôt : `node:path` = `path.win32` et `fileURLToPath` en graphie Windows
// (`plateforme-win32-hooks.mjs`), `process.cwd()` sous le lecteur `C:`. Le code de `node_modules`,
// node lui-même et les enveloppes de ce module voient l'hôte, `process.cwd()` compris : leur `path`
// est celui de l'hôte, et un cwd en `C:\` le rendrait incohérent (tsx ne trouvait plus
// `tsconfig.json`, donc plus son `jsx` ; `realpathSync('.')` visait `C:\…`). `path.posix` du dépôt
// résout sur le cwd POSIX (`posixCwd`, lib/path.js de node). Aucune source ne lit le chemin du
// script dans `argv` (garde `src/point-d-entree-guard.test.ts`).
// Ce qu'il touche : le disque POSIX — les ENTRÉES de `fs` (chemins en argument, `cwd` de `glob`) et
// de `child_process` (exécutable, argv absolus, `cwd`, PATH de `env`) sont ramenées en POSIX. Chaque
// fonction de `fs` et de `fs.promises` est enveloppée ou déclarée SANS CHEMIN (`SANS_CHEMIN_FS`). La
// racine du dépôt rendu : `WFRP_PLATEFORME_RACINE`, posée par la garde, et lue canonique
// (`urlDuDepot`).
//
// NON SIMULÉ — ce que le code du dépôt reçoit de l'hôte, et la garde qui le ferme quand il y en a une :
//   · `import.meta.dirname`/`filename`, `__dirname`/`__filename` (chargeur CJS),
//     `require`/`createRequire`/`getBuiltinModule` de `path` ou `url` (hors hooks ESM) — garde
//     `src/graphies-d-hote-guard.test.ts` ;
//   · l'ORDRE des sorties de `readdir`/`opendir`/`glob` (NTFS trie sans casse, ext4 rend l'ordre d'un
//     hash) et le séparateur des chemins qu'ils rendent (`glob`, `recursive: true`) — mur de l'ordre total
//     d'`oxlint.config.mjs` (seul `listerDossier`/`listerArbre` de `scripts/guards/lib/lister.mjs` liste
//     un dossier, `listerArbre` joint par `/`) ;
//   · le même ORDRE quand le nom échappe au mur (le mur ferme membre, clé littérale ou gabarit,
//     déstructuration, alias d'import TypeScript, membre JSX) : clé calculée non littérale (`fs[nom]`,
//     `fs['gl' + 'ob']`, gabarit à expression, `const { [nom]: g } = fs`), accès réflexif
//     (`Reflect.get(fs, 'glob')`, `Object.entries(fs)`), paquet tiers qui liste (`tinyglobby`), listing
//     par un processus enfant (`find`, `ls`) — rien ;
//   · la casse des chemins — rien ;
//   · locale et ICU : `localeCompare` et `toLocale*` sous toute forme de clé, toute référence à la
//     valeur `Intl` — mur de l'ordre total d'`oxlint.config.mjs` (globs de ses blocs et clôture des
//     générateurs) ; `globalThis.Intl`, un nom calculé, la collation d'un module d'UI qu'aucun
//     générateur n'atteint — rien ;
//   · ce qui éteint le mur de l'ordre total (`murs/ordre-total`, `murs/ordre-total-imports`,
//     `murs/ordre-total-locale`) — `scripts/guards/lib/lister.test.mjs` : un bloc d'`oxlint.config.mjs`
//     qui redéclare une de ces règles (UNICITÉ : chacune par UN bloc, en `error`, avec ses options) ; un
//     ignore global qui couvre un fichier sous le mur (IGNORES) ; une directive `eslint-disable` ou un
//     commentaire de configuration `/* eslint … */` qui la nomme — ou, pour la directive, ne nomme
//     aucune règle —, lus par la grammaire d'ESLint elle-même (`SourceCode#getDisableDirectives`/
//     `applyInlineConfig`, `ConfigCommentParser#parseListConfig`) : seules les exemptions AU SITE
//     nommées passent (DIRECTIVES sous les globs ; `suppressedMessages` et la même sonde au volet
//     CLÔTURE). Une option de ligne de commande (`--rule`, `-c`, `--ignore-pattern`, `--no-ignore`) qui
//     redéclare le mur ou en retire un fichier — rien ;
//   · `os.EOL` — rien ;
//   · `process.platform` — rien ;
//   · le lancement d'un `.cmd` — rien ;
//   · les sorties de git — rien ;
//   · les SORTIES de `fs` et de `child_process` — rien ;
//   · `process.env` tel que lu, PATH compris (joint par `:`) — rien ;
//   · les URL `file:` sans lecteur (`import.meta.url`, `pathToFileURL`, leur `pathname`) — rien ;
//   · `os.tmpdir()`, `os.homedir()`, `process.execPath` — rien ;
//   · la chaîne de commande d'`exec`/`execSync`, et celle de `spawn*`/`execFile*` sous `shell: true`,
//     passée telle quelle au shell de l'hôte — rien ;
//   · un chemin ENCASTRÉ dans un argument de `child_process` (`--sortie=C:\…`), passé tel quel — rien.
import cp from 'node:child_process'
import fs from 'node:fs'
import { register, registerHooks, syncBuiltinESMExports } from 'node:module'
import { pathToFileURL } from 'node:url'
import { cwdDonne, estAbsoluWindows, estModuleDuDepot, hooksSdkSousWin32, urlDuDepot, versPosix, versWindows } from './plateforme-win32-hooks.mjs'

/** Nom → nombre d'arguments-CHEMINS en tête, pour la forme synchrone, à rappel et `fs.promises`. */
const ENTREES_FS = {
  access: 1, appendFile: 1, chmod: 1, chown: 1, copyFile: 2, cp: 2, exists: 1, glob: 1, lchmod: 1,
  lchown: 1, link: 2, lstat: 1, lutimes: 1, mkdir: 1, mkdtemp: 1, open: 1, opendir: 1, readdir: 1,
  readFile: 1, readlink: 1, realpath: 1, rename: 2, rm: 1, rmdir: 1, stat: 1, statfs: 1, symlink: 2,
  truncate: 1, unlink: 1, utimes: 1, watch: 1, writeFile: 1,
}
/** Sans variante `Sync` ni `fs.promises`. */
const SEULES_FS = { createReadStream: 1, createWriteStream: 1, openAsBlob: 1, watchFile: 1, unwatchFile: 1 }
/** Fonctions de `fs` (nom sans `Sync`) qui ne prennent aucun chemin : descripteurs, classes, interne. */
export const SANS_CHEMIN_FS = new Set([
  'close', 'fchmod', 'fchown', 'fdatasync', 'fstat', 'fsync', 'ftruncate', 'futimes', 'read', 'readv',
  'write', 'writev', 'Dir', 'Dirent', 'FileReadStream', 'FileWriteStream', 'ReadStream', 'Stats',
  'WriteStream', '_toUnixTimestamp',
])
/** Nom → position de l'argument d'options qui porte un `cwd`. */
const OPTIONS_FS = { glob: 1 }

/** Entrée de PATH : chaque segment `;` ramené en POSIX, recollé par `:`. Un PATH POSIX passe tel quel. */
const pathPosix = (valeur) => (typeof valeur === 'string' ? valeur.split(';').map(versPosix).join(':') : valeur)

/** Options d'un appel : `cwd` et PATH de `env` (clé en toute casse) ramenés en POSIX. */
function optionsPosix(options) {
  if (!options || typeof options !== 'object') return options
  const posix = { ...options }
  if (typeof options.cwd === 'string') posix.cwd = versPosix(options.cwd)
  if (options.env && typeof options.env === 'object') {
    posix.env = { ...options.env }
    for (const cle of Object.keys(posix.env)) if (cle.toUpperCase() === 'PATH') posix.env[cle] = pathPosix(posix.env[cle])
  }
  return posix
}

/** Propriétés d'une fonction de `fs` à porter sur son enveloppe (`realpathSync.native`, symboles). */
const PROPRES_NON_PORTEES = new Set(['length', 'name', 'prototype', 'arguments', 'caller'])

function envelopper(originale, nombre, positionOptions) {
  const enveloppe = function (...args) {
    for (let i = 0; i < nombre && i < args.length; i++) args[i] = versPosix(args[i])
    if (positionOptions !== undefined && positionOptions < args.length) args[positionOptions] = optionsPosix(args[positionOptions])
    return originale.apply(this, args)
  }
  for (const cle of Reflect.ownKeys(originale)) {
    if (PROPRES_NON_PORTEES.has(cle)) continue
    const valeur = originale[cle]
    enveloppe[cle] = cle === 'native' && typeof valeur === 'function' ? envelopper(valeur, nombre, positionOptions) : valeur
  }
  return enveloppe
}

const envelopperSurPlace = (hote, nom, nombre, positionOptions) => {
  if (typeof hote[nom] === 'function') hote[nom] = envelopper(hote[nom], nombre, positionOptions)
}

for (const [nom, nombre] of Object.entries(ENTREES_FS)) {
  envelopperSurPlace(fs, nom, nombre, OPTIONS_FS[nom])
  envelopperSurPlace(fs, `${nom}Sync`, nombre, OPTIONS_FS[nom])
  envelopperSurPlace(fs.promises, nom, nombre, OPTIONS_FS[nom])
}
for (const [nom, nombre] of Object.entries(SEULES_FS)) envelopperSurPlace(fs, nom, nombre)

const argvPosix = (args) => args.map((a) => (estAbsoluWindows(a) ? versPosix(a) : a))

for (const nom of ['spawn', 'spawnSync', 'execFile', 'execFileSync', 'fork']) {
  const originale = cp[nom]
  cp[nom] = function (fichier, args, options, ...reste) {
    const executable = estAbsoluWindows(fichier) ? versPosix(fichier) : fichier
    return originale.call(this, executable, Array.isArray(args) ? argvPosix(args) : optionsPosix(args), optionsPosix(options), ...reste)
  }
}
for (const nom of ['exec', 'execSync']) {
  const originale = cp[nom]
  cp[nom] = function (commande, options, ...reste) {
    return originale.call(this, commande, optionsPosix(options), ...reste)
  }
}
syncBuiltinESMExports()

const racine = process.env.WFRP_PLATEFORME_RACINE
if (!racine) throw new Error('plateforme-win32 : WFRP_PLATEFORME_RACINE absent — ce module se compose par `renduSousWin32` de scripts/docs/lib/plateforme-win32.test.mjs')
const depot = urlDuDepot(racine)
const racineReelle = fs.realpathSync(racine)

/** Adresse `file:` du module qui a appelé `fonction` : premier cadre de pile hors de node. */
function moduleAppelant(fonction) {
  const { prepareStackTrace, stackTraceLimit } = Error
  Error.stackTraceLimit = 32
  Error.prepareStackTrace = (_, cadres) => cadres
  try {
    const trace = {}
    Error.captureStackTrace(trace, fonction)
    for (const cadre of trace.stack) {
      const fichier = cadre.getFileName()
      if (!fichier || fichier.startsWith('node:')) continue
      return fichier.startsWith('/') ? pathToFileURL(fichier).href : fichier
    }
    return null
  } finally {
    Error.prepareStackTrace = prepareStackTrace
    Error.stackTraceLimit = stackTraceLimit
  }
}

const cwdHote = process.cwd.bind(process)
const chdirHote = process.chdir.bind(process)
function cwdSimule() {
  return estModuleDuDepot(moduleAppelant(cwdSimule), depot) ? versWindows(cwdDonne(cwdHote(), racine, racineReelle)) : cwdHote()
}
process.cwd = cwdSimule
process.chdir = (dossier) => chdirHote(versPosix(dossier))

registerHooks(hooksSdkSousWin32(racine))
register(new URL('plateforme-win32-hooks.mjs', import.meta.url).href, { data: { racine } })
