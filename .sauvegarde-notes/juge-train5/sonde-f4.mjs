import ts from '/home/user/game/.wt-1806-L2/node_modules/typescript/lib/typescript.js'
import { readFileSync } from 'node:fs'
import { virtualProgram } from '/home/user/game/.wt-1806-L2/scripts/guards/lib/tsProgram.mjs'
const lire = (f) => readFileSync('/home/user/game/.wt-1806-L2/' + f, 'utf8')
// Gabarits EXTRAITS des tests (lecture seule), interpolation rejouée à la main.
const gabarit = (src, nom, param) => { const m = src.match(new RegExp('const ' + nom + ' = \\(' + param + '[^)]*\\) => `([\\s\\S]*?)`;')); return (v) => m[1].replaceAll('${' + param + '}', v) }
const bb = lire('src/state/built-brand-lint.test.ts'), rs = lire('src/state/roll-seam-mints.test.ts')
// Réplique VERBATIM de l'hôte des deux tests (built-brand-lint.test.ts:157-181).
function main(code) {
  const fileName = 'sonde-murage.ts'
  const options = { strict: true, noEmit: true, target: ts.ScriptTarget.ES2020, types: [], skipLibCheck: true }
  const libPath = ts.getDefaultLibFilePath(options)
  const sf = ts.createSourceFile(fileName, code, ts.ScriptTarget.ES2020, true)
  const host = { getSourceFile: (n) => { if (n === fileName) return sf; const t = ts.sys.readFile(n); return t === undefined ? undefined : ts.createSourceFile(n, t, ts.ScriptTarget.ES2020) },
    writeFile: () => {}, getDefaultLibFileName: () => libPath, useCaseSensitiveFileNames: () => false, getCanonicalFileName: (n) => n.toLowerCase(),
    getCurrentDirectory: () => '', getNewLine: () => '\n', fileExists: (n) => n === fileName || ts.sys.fileExists(n), readFile: (n) => (n === fileName ? code : ts.sys.readFile(n)) }
  return ts.getPreEmitDiagnostics(ts.createProgram([fileName], options, host)).map((d) => d.code)
}
const virt = (code) => ts.getPreEmitDiagnostics(virtualProgram({ 'sonde.ts': code })).map((d) => d.code)
const cas = [
  ['SONDE', bb, 'signature', ['BuiltCascadeStep', 'CascadeStep']],
  ['SONDE_ENJEU', bb, 'enjeu', ['stake: Stake', 'stake?: Stake']],
  ['SONDE_MONO', bb, 'enjeu', ['stake: Stake | undefined', 'stake?: Stake']],
  ['SONDE_RANGEE', bb, 'marque', ['readonly [BRAND]: true', 'readonly [BRAND]?: true']],
  ['SONDE_CHOIX', bb, 'go', ['groupOwner?: never', '']],
  ['SONDE_TEXTE', bb, 'champ', ['label?: PlayerText', 'label?: string']],
  ['SONDE_PORTE', bb, 'champ', ['label: PlayerText', 'label: string']],
  ['SONDE_DISPLAY', rs, 'decl', [", actorId: 'h1'", ', worldOwner: true', ", actorId: 'h1', worldOwner: true", '']],
]
let ecarts = 0
for (const [nom, src, p, vals] of cas) { const g = gabarit(src, nom, p); for (const v of vals) { const a = JSON.stringify(main(g(v))), b = JSON.stringify(virt(g(v))); if (a !== b) ecarts++; console.log(nom, JSON.stringify(v), 'main', a, 'virtual', b) } }
console.log('ecarts', ecarts)
