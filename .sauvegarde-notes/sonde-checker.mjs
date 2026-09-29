import { ast, typescript } from '/home/user/game/.wt-1806-L1/scripts/guards/lib/dialecte.mjs'
const ts = typescript()
for (const rel of ['x.tsx', 'scripts/a/b.mjs']) {
const racine = ast({ rel, text: "const E = 'x';\nfunction f() { const E = '…'; return E }\nconst a = s.slice(0, 20) + E;" })
const host = {
  getSourceFile: (n) => (n === racine.fileName ? racine : undefined),
  getDefaultLibFileName: () => 'lib.d.ts', writeFile: () => {}, getCurrentDirectory: () => '/',
  getCanonicalFileName: (f) => f, useCaseSensitiveFileNames: () => true, getNewLine: () => '\n',
  fileExists: (n) => n === racine.fileName, readFile: () => undefined,
}
const t0 = performance.now()
const prog = ts.createProgram({ rootNames: [racine.fileName], options: { noLib: true, noResolve: true, allowJs: true, noEmit: true, types: [] }, host })
const ch = prog.getTypeChecker()
console.log(rel, racine.fileName, prog.getSourceFile(racine.fileName) === racine, performance.now() - t0)
const ids = []; const v = (n) => { if (ts.isIdentifier(n) && n.text === 'E') ids.push(n); ts.forEachChild(n, v) }; v(racine)
for (const id of ids) { const s = ch.getSymbolAtLocation(id); console.log(id.getStart(), s?.valueDeclaration?.initializer?.text) }
}
