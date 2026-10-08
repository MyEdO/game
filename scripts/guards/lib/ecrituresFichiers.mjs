import { analyserCorpus, typescript } from './dialecte.mjs'
import { creerProvenanceFs } from './provenanceFs.mjs'

export const OPERATIONS_FS = {
  writeFileSync: { chemins: [0], detecteeParGateHistorique: true },
  writeFile: { chemins: [0], detecteeParGateHistorique: true },
  createWriteStream: { chemins: [0], detecteeParGateHistorique: true },
  appendFileSync: { chemins: [0], detecteeParGateHistorique: true },
  appendFile: { chemins: [0], detecteeParGateHistorique: true },
  mkdirSync: { chemins: [0], detecteeParGateHistorique: true },
  mkdir: { chemins: [0], detecteeParGateHistorique: true },
  rmSync: { chemins: [0], detecteeParGateHistorique: true },
  rm: { chemins: [0], detecteeParGateHistorique: false },
  rmdirSync: { chemins: [0], detecteeParGateHistorique: true },
  rmdir: { chemins: [0], detecteeParGateHistorique: false },
  unlinkSync: { chemins: [0], detecteeParGateHistorique: true },
  unlink: { chemins: [0], detecteeParGateHistorique: false },
  renameSync: { chemins: [0, 1], detecteeParGateHistorique: true },
  rename: { chemins: [0, 1], detecteeParGateHistorique: true },
  cpSync: { chemins: [1], detecteeParGateHistorique: true },
  cp: { chemins: [1], detecteeParGateHistorique: false },
  copyFileSync: { chemins: [1], detecteeParGateHistorique: true },
  copyFile: { chemins: [1], detecteeParGateHistorique: false },
  truncateSync: { chemins: [0], detecteeParGateHistorique: true },
  truncate: { chemins: [0], detecteeParGateHistorique: false },
  linkSync: { chemins: [1], detecteeParGateHistorique: false },
  link: { chemins: [1], detecteeParGateHistorique: false },
  symlinkSync: { chemins: [1], detecteeParGateHistorique: false },
  symlink: { chemins: [1], detecteeParGateHistorique: false },
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
      for (const indice of Object.hasOwn(OPERATIONS_FS, operation) ? OPERATIONS_FS[operation].chemins : []) {
        const chemin = litteral(n.arguments[indice])
        sorties.push({ chemin, inconnue: chemin === null, operation })
      }
    })
  }
  return sorties
}
