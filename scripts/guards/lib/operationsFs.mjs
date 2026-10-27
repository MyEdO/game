import { constants } from 'node:fs'

export const ouvreEnEcriture = (drapeaux = 'r') => typeof drapeaux === 'number'
  ? (drapeaux & (constants.O_WRONLY | constants.O_RDWR | constants.O_CREAT | constants.O_TRUNC | constants.O_APPEND)) !== 0
  : !['r', 'rs', 'sr'].includes(drapeaux)

/**
 * Opérations de `fs` et de `fs.promises` qui écrivent, par nom exact (variante `Sync` comprise). `chemins` : où
 * l'appel nomme sa cible — un indice d'argument, ou `[indice, clé]` pour l'option `clé` de l'argument d'options ;
 * `entree` : la cible est l'entrée de répertoire elle-même, pas ce qu'elle désigne ; `drapeaux` : indice des
 * drapeaux d'ouverture (`ouvreEnEcriture`) ; `detecteeParGateHistorique` : nom reconnu par `ECRITURE` de
 * `scripts/gates/ecrivainsAtteints.mjs`. Lus par `intercepterEcritures.mjs` et `ciblesDEcritureJS`.
 */
export const OPERATIONS_FS = {
  writeFileSync: { chemins: [0], detecteeParGateHistorique: true },
  writeFile: { chemins: [0], detecteeParGateHistorique: true },
  createWriteStream: { chemins: [0], detecteeParGateHistorique: true },
  WriteStream: { chemins: [0], detecteeParGateHistorique: false },
  FileWriteStream: { chemins: [0], detecteeParGateHistorique: false },
  Utf8Stream: { chemins: [[0, 'dest']], detecteeParGateHistorique: false },
  appendFileSync: { chemins: [0], detecteeParGateHistorique: true },
  appendFile: { chemins: [0], detecteeParGateHistorique: true },
  mkdirSync: { chemins: [0], detecteeParGateHistorique: true },
  mkdir: { chemins: [0], detecteeParGateHistorique: true },
  rmSync: { chemins: [0], entree: true, detecteeParGateHistorique: true },
  rm: { chemins: [0], entree: true, detecteeParGateHistorique: false },
  rmdirSync: { chemins: [0], entree: true, detecteeParGateHistorique: true },
  rmdir: { chemins: [0], entree: true, detecteeParGateHistorique: false },
  unlinkSync: { chemins: [0], entree: true, detecteeParGateHistorique: true },
  unlink: { chemins: [0], entree: true, detecteeParGateHistorique: false },
  renameSync: { chemins: [0, 1], entree: true, detecteeParGateHistorique: true },
  rename: { chemins: [0, 1], entree: true, detecteeParGateHistorique: true },
  cpSync: { chemins: [1], detecteeParGateHistorique: true },
  cp: { chemins: [1], detecteeParGateHistorique: false },
  copyFileSync: { chemins: [1], detecteeParGateHistorique: true },
  copyFile: { chemins: [1], detecteeParGateHistorique: false },
  truncateSync: { chemins: [0], detecteeParGateHistorique: true },
  truncate: { chemins: [0], detecteeParGateHistorique: false },
  linkSync: { chemins: [1], entree: true, detecteeParGateHistorique: false },
  link: { chemins: [1], entree: true, detecteeParGateHistorique: false },
  symlinkSync: { chemins: [1], entree: true, detecteeParGateHistorique: false },
  symlink: { chemins: [1], entree: true, detecteeParGateHistorique: false },
  openSync: { chemins: [0], drapeaux: 1, detecteeParGateHistorique: false },
  open: { chemins: [0], drapeaux: 1, detecteeParGateHistorique: false },
  writeSync: { chemins: [0], detecteeParGateHistorique: false },
  write: { chemins: [0], detecteeParGateHistorique: false },
  writevSync: { chemins: [0], detecteeParGateHistorique: false },
  writev: { chemins: [0], detecteeParGateHistorique: false },
  ftruncateSync: { chemins: [0], detecteeParGateHistorique: false },
  ftruncate: { chemins: [0], detecteeParGateHistorique: false },
  chmodSync: { chemins: [0], detecteeParGateHistorique: false },
  chmod: { chemins: [0], detecteeParGateHistorique: false },
  fchmodSync: { chemins: [0], detecteeParGateHistorique: false },
  fchmod: { chemins: [0], detecteeParGateHistorique: false },
  chownSync: { chemins: [0], detecteeParGateHistorique: false },
  chown: { chemins: [0], detecteeParGateHistorique: false },
  fchownSync: { chemins: [0], detecteeParGateHistorique: false },
  fchown: { chemins: [0], detecteeParGateHistorique: false },
  lchownSync: { chemins: [0], entree: true, detecteeParGateHistorique: false },
  lchown: { chemins: [0], entree: true, detecteeParGateHistorique: false },
  utimesSync: { chemins: [0], detecteeParGateHistorique: false },
  utimes: { chemins: [0], detecteeParGateHistorique: false },
  futimesSync: { chemins: [0], detecteeParGateHistorique: false },
  futimes: { chemins: [0], detecteeParGateHistorique: false },
  lutimesSync: { chemins: [0], entree: true, detecteeParGateHistorique: false },
  lutimes: { chemins: [0], entree: true, detecteeParGateHistorique: false },
  mkdtempSync: { chemins: [0], detecteeParGateHistorique: false },
  mkdtemp: { chemins: [0], detecteeParGateHistorique: false },
  mkdtempDisposableSync: { chemins: [0], detecteeParGateHistorique: false },
  mkdtempDisposable: { chemins: [0], detecteeParGateHistorique: false },
  lchmodSync: { chemins: [0], entree: true, detecteeParGateHistorique: false },
  lchmod: { chemins: [0], entree: true, detecteeParGateHistorique: false },
}

/** Fonctions de `fs` et de `fs.promises` (nom sans `Sync`) qui n'écrivent rien : lectures, synchronisation d'un
 *  descripteur déjà ouvert, et classes de lecture. `operationsFs.test.mjs` confronte les exports du Node courant à
 *  `OPERATIONS_FS` ∪ cet ensemble. */
export const SANS_ECRITURE_FS = new Set([
  'access', 'close', 'createReadStream', 'exists', 'fdatasync', 'fstat', 'fsync', 'glob', 'lstat', 'openAsBlob',
  'opendir', 'read', 'readdir', 'readFile', 'readlink', 'readv', 'realpath', 'stat', 'statfs', 'unwatchFile', 'watch',
  'watchFile', 'Dir', 'Dirent', 'FileReadStream', 'ReadStream', 'Stats', '_toUnixTimestamp',
])
