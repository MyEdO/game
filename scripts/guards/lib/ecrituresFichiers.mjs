import { analyserCorpus, typescript } from './dialecte.mjs'
import { creerProvenanceFs } from './provenanceFs.mjs'
import { constants } from 'node:fs'

export const ouvreEnEcriture = (drapeaux = 'r') => typeof drapeaux === 'number'
  ? (drapeaux & (constants.O_WRONLY | constants.O_RDWR | constants.O_CREAT | constants.O_TRUNC | constants.O_APPEND)) !== 0
  : !['r', 'rs', 'sr'].includes(drapeaux)

export const OPERATIONS_FS = {
  writeFileSync: { chemins: [0], detecteeParGateHistorique: true },
  writeFile: { chemins: [0], detecteeParGateHistorique: true },
  createWriteStream: { chemins: [0], detecteeParGateHistorique: true },
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
  mkdtempDisposable: { chemins: [0], detecteeParGateHistorique: false },
  lchmodSync: { chemins: [0], entree: true, detecteeParGateHistorique: false },
  lchmod: { chemins: [0], entree: true, detecteeParGateHistorique: false },
}

export function ciblesDEcritureJS(texte) {
  const ts = typescript()
  const sorties = []
  for (const { sourceFile, diagnostics, checker } of analyserCorpus([{ rel: 'inline.mjs', text: texte }])) {
    if (diagnostics.length || !sourceFile) return []
    const provenance = creerProvenanceFs({ sourceFile, checker, ts })
    const litteral = (n) => n && (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) ? n.text : null
    const parcours = (n, fn) => { fn(n); n.forEachChild((c) => parcours(c, fn)) }
    parcours(sourceFile, (n) => {
      if (!ts.isCallExpression(n)) return
      const operation = provenance(n.expression)?.operation
      const definition = OPERATIONS_FS[operation]
      if (definition?.drapeaux !== undefined) {
        const argument = n.arguments[definition.drapeaux]
        const drapeaux = argument && ts.isNumericLiteral(argument) ? Number(argument.text) : litteral(argument)
        if ((!argument || drapeaux !== null) && !ouvreEnEcriture(drapeaux ?? undefined)) return
      }
      for (const indice of Object.hasOwn(OPERATIONS_FS, operation) ? OPERATIONS_FS[operation].chemins : []) {
        const chemin = litteral(n.arguments[indice])
        sorties.push({ chemin, inconnue: chemin === null, operation })
      }
    })
  }
  return sorties
}
