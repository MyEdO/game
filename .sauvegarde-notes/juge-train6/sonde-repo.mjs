import ts from '/home/user/game/.wt-1806-L2/node_modules/typescript/lib/typescript.js'
import path from 'node:path'
import { repoProgram } from '/home/user/game/.wt-1806-L2/scripts/guards/lib/tsProgram.mjs'
const ROOT = '/home/user/game/.wt-1806-L2'
const DOCUMENT = ['src/state/scene.ts', 'src/data/schemas/defs-scenes/scene.ts']
const choisir = (fileNames) => fileNames.filter((f) => DOCUMENT.includes(path.relative(ROOT, f).split(path.sep).join('/')))
// Ancien repoProgram (HEAD 7270396a6, sans hôte) répliqué verbatim.
function ancien(root, choisirRootNames) {
  const key = path.resolve(root).replace(/\\/g, '/')
  const cfgPath = ts.findConfigFile(key, ts.sys.fileExists, 'tsconfig.json')
  const cfg = ts.readConfigFile(cfgPath, ts.sys.readFile)
  const parsed = ts.parseJsonConfigFileContent(cfg.config, ts.sys, path.dirname(cfgPath))
  return ts.createProgram({ rootNames: choisirRootNames(parsed.fileNames, key), options: { ...parsed.options, noEmit: true } })
}
const resume = (p) => ({ fichiers: p.getSourceFiles().length, diag: ts.getPreEmitDiagnostics(p).map((d) => d.code).sort().join(',') || '-',
  noms: p.getSourceFiles().map((s) => s.fileName).sort().join('\n') })
const a = resume(ancien(ROOT, choisir)), b = resume(repoProgram(ROOT, choisir))
console.log('ancien', a.fichiers, a.diag); console.log('neuf  ', b.fichiers, b.diag); console.log('memes fichiers', a.noms === b.noms)
const marque = '// SONDE-JUGE-6\n'
const vrai = ts.sys.readFile(path.join(ROOT, 'src/state/scene.ts'))
const p = repoProgram(ROOT, choisir, { 'src/state/scene.ts': marque + vrai })
console.log('recouvrement servi', p.getSourceFile(path.join(ROOT, 'src/state/scene.ts'))?.text.startsWith(marque))
console.log('disque intact', !ts.sys.readFile(path.join(ROOT, 'src/state/scene.ts')).startsWith(marque))
